import { watch, nextTick, onBeforeUnmount, inject, ref, type Ref, type InjectionKey } from "vue";
import { TAB_LIFECYCLE, onShow as onTabShow, onHide as onTabHide } from "./use-tab-page-lifecycle";
// #ifdef APP-PLUS
import { getCurrentInstance } from "vue";
import { onBackPress, onShow as onPageShow, onHide as onPageHide } from "@dcloudio/uni-app";

type Dialog = { close?: () => void; priority: number };
type DialogPage = { stack: Dialog[]; visible: boolean; backRegistered: boolean };
const dialogPages = new WeakMap<object, DialogPage>();

export function registerNativeDialog(open: Ref<boolean>, close: (() => void) | undefined, nativeBack: boolean, priority: number) {
  // Uni invokes page hooks on the page root, not on a nested sheet component.
  const owner = getCurrentInstance()?.root;
  if (!owner) return;
  let page = dialogPages.get(owner);
  if (!page) {
    page = { stack: [], visible: true, backRegistered: false };
    dialogPages.set(owner, page);
  }
  const dialogs = page;
  const entry: Dialog = { close, priority };
  const tab = inject(TAB_LIFECYCLE, null);
  const shown = ref(!tab);
  if (tab) {
    onTabShow(() => { shown.value = true; });
    onTabHide(() => { shown.value = false; });
  }
  const remove = () => {
    const index = dialogs.stack.indexOf(entry);
    if (index >= 0) dialogs.stack.splice(index, 1);
  };
  watch([open, shown], ([isOpen, isShown]) => {
    remove();
    if (isOpen && isShown) dialogs.stack.push(entry);
  }, { immediate: true, flush: "sync" });
  onBeforeUnmount(remove);

  // NxSheet opts in by default; each close callback retains its submission guards.
  // One handler per page avoids Uni invoking several sheet callbacks on one press.
  if (nativeBack && !dialogs.backRegistered) {
    dialogs.backRegistered = true;
    onPageShow(() => { dialogs.visible = true; }, owner);
    onPageHide(() => { dialogs.visible = false; }, owner);
    onBackPress(event => {
      if (event.from !== "backbutton" || !dialogs.visible) return false;
      // Global masks stay above page sheets even after a retained tab reappears.
      // Equal visual layers retain their ordinary last-opened-first ordering.
      const top = dialogs.stack.reduce<Dialog | undefined>((current, entry) =>
        !current || entry.priority >= current.priority ? entry : current, undefined);
      if (!top) return false;
      // A retry-only overlay has no cancel action; never close a lower dialog.
      top.close?.();
      return true;
    }, owner);
  }
}
// #endif

/**
 * AppChassis provides this. Dialogs render inside the page's own scroller, so without it a drag on
 * the mask or sheet scrolled the page underneath and could start a pull-to-refresh, whose content
 * transform then dragged the fixed sheet along with the page. Each open dialog holds a lock; the
 * call returns its release.
 */
export const DIALOG_SCROLL_LOCK: InjectionKey<() => () => void> = Symbol("nx-dialog-scroll-lock");

/** Holds the chassis scroll lock while `open` is true. Dialogs that manage focus themselves call this alone. */
export function useDialogScrollLock(open: Ref<boolean>): void {
  const acquireScrollLock = inject(DIALOG_SCROLL_LOCK, null);
  if (!acquireScrollLock) return;
  // The native tab host shares one chassis across tabs: a dialog left open in a hidden tab
  // must not lock the tab on screen.
  const inTab = !!inject(TAB_LIFECYCLE, null);
  const shown = ref(!inTab);
  if (inTab) {
    onTabShow(() => { shown.value = true; });
    onTabHide(() => { shown.value = false; });
  }
  let release: (() => void) | null = null;
  watch([open, shown], ([isOpen, isShown]) => {
    release?.();
    release = isOpen && isShown ? acquireScrollLock() : null;
  }, { immediate: true, flush: "sync" });
  onBeforeUnmount(() => { release?.(); release = null; });
}

const shown = (el: Element) => el.isConnected && el.getClientRects().length > 0;
// The last element that held focus. A trigger that is redrawn as the dialog opens (the checkout pay button turns busy
// while the order is created) has already let focus fall to <body> by the time the open watch runs.
let lastFocus: HTMLElement | SVGElement | null = null;
let tracking = false;
// When the dialog last handed focus back to the page; a control removed soon after (a card moving once its action
// finished) must not leave focus on <body>.
let restoredAt = 0;
function trackFocus(): void {
  if (tracking || typeof document === "undefined") return;
  tracking = true;
  document.addEventListener("focusin", (ev) => {
    if (ev.target instanceof HTMLElement || ev.target instanceof SVGElement) lastFocus = ev.target;
  }, true);
  // The focused control was removed or hidden (not an ordinary blur such as a tap on empty space): inside an open layer
  // focus goes to that layer, and right after a dialog closed it goes to the page's next reasonable place (03 §3.5).
  document.addEventListener("focusout", (ev) => {
    const left = ev.target instanceof Element ? ev.target : null;
    setTimeout(() => {
      const active = document.activeElement;
      const top = topLayer();
      // While a layer is open focus stays in it (a removed control, a tap on a persistent sheet's scrim or on empty
      // space): back to the layer root, not its first field, so no keyboard opens.
      if (top?.el) {
        if (!active || active === document.body || !top.el.contains(active)) focusFirst([() => landingSpot(top.el)]);
        return;
      }
      if (!left || (active && active !== document.body) || (left.isConnected && canTake(left))) return;
      if (Date.now() - restoredAt < 5_000) {
        const landing = focusFirst(fallbacks(null, null));
        if (landing) settleOnLanding(landing);
      }
    }, 0);
  }, true);
}
// Dialogs that close in the same tick (a notice over the payment page, both closed by one exit) return focus once:
// the one opened first owns the trigger; the ones stacked on it drop theirs.
let openSeq = 0;
const closing: { order: number; run: () => void; drop: () => void }[] = [];
function scheduleRestore(order: number, run: () => void, drop: () => void): void {
  closing.push({ order, run, drop });
  if (closing.length > 1) return;
  void nextTick(() => {
    const batch = closing.splice(0).sort((a, b) => a.order - b.order);
    batch[0]?.run();
    batch.slice(1).forEach((entry) => entry.drop());
  });
}
// Dialogs open on this document, in opening order. Each one listens on the document, so a stacked pair would both see
// one key press (stopPropagation cannot stop another listener on the same node). The top shown layer alone answers Esc
// and Tab, is the only part of the page a screen reader can reach (everything beside its ancestor path is inert), and
// takes focus when it opens; closing it hands focus back inside the layer below (03 §3.5). A layer whose root is not on
// screen (a dialog left open in a hidden tab) never counts as the top.
type Layer = { order: number; root: () => HTMLElement | null | undefined };
const openLayers: Layer[] = [];
const dropLayer = (layer: Layer) => { const index = openLayers.indexOf(layer); if (index >= 0) openLayers.splice(index, 1); };
function topLayer(): { layer: Layer; el: HTMLElement | null } | null {
  for (let i = openLayers.length - 1; i >= 0; i--) {
    const el = openLayers[i].root() ?? null;
    if (!el || shown(el)) return { layer: openLayers[i], el };
  }
  return null;
}
const inertByUs = new Set<Element>();
// Live regions (the toast host) stay readable over a dialog; inert set by someone else is left alone.
const KEEP_READABLE = "script, style, link, template, [aria-live]";
const FOCUSABLE = '[tabindex]:not([tabindex="-1"]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]';
const CAN_FOCUS = 'a[href], button, input, select, textarea, [tabindex]';
// A layer's own tap-to-close scrim sits beside its root (NxSheet, the payment method sheet): an aria-hidden surface with no
// controls of its own. It is part of that layer, so it stays clickable; its persistent / busy guard stays in its handler.
const ownScrim = (el: Element) => el.getAttribute("aria-hidden") === "true" && !el.querySelector(CAN_FOCUS);
function syncInert(): void {
  if (typeof document === "undefined") return;
  inertByUs.forEach((el) => el.removeAttribute("inert"));
  inertByUs.clear();
  const top = topLayer()?.el;
  for (let node: Element | null = top ?? null; node && node !== document.body && node.parentElement; node = node.parentElement) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (sibling === node || sibling.hasAttribute("inert") || sibling.matches(KEEP_READABLE) || (node === top && ownScrim(sibling))) continue;
      sibling.setAttribute("inert", "");
      inertByUs.add(sibling);
    }
  }
}
/** One test for every focus target (the trigger, its replacement, a Tab stop, a fallback): on screen and not
 *  visibility-hidden, focusable, not inert, not disabled. */
function canTake(el: Element | null | undefined): el is HTMLElement | SVGElement {
  if (!(el instanceof HTMLElement || el instanceof SVGElement) || el === document.body) return false;
  if (!shown(el) || el.closest("[inert]") || el.getAttribute("aria-disabled") === "true" || (el as HTMLButtonElement).disabled) return false;
  return getComputedStyle(el).visibility === "visible" && el.matches(CAN_FOCUS);
}
type Candidate = Element | null | undefined | (() => Element | null | undefined);
/** Focus the first candidate that can take it and really does; otherwise go on down the list. */
function focusFirst(candidates: Candidate[]): HTMLElement | SVGElement | null {
  for (const candidate of candidates) {
    const el = typeof candidate === "function" ? candidate() : candidate;
    if (!canTake(el)) continue;
    el.focus();
    if (document.activeElement === el) return el;
  }
  return null;
}
const firstFocusable = (scope: ParentNode): HTMLElement | null =>
  Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).find(canTake) ?? null;
/** A heading, the main region or a layer root takes focus through tabindex -1, which keeps it out of the Tab order. */
function landingSpot(el: HTMLElement | null | undefined): HTMLElement | null {
  if (!el || !shown(el) || el.closest("[inert]")) return null;
  // Given back on blur: a lasting tabindex would make later taps on empty space focus this element.
  // It is not a control, so no focus ring around a whole sheet or page; real controls keep theirs.
  if (!el.hasAttribute("tabindex")) {
    el.setAttribute("tabindex", "-1");
    el.style.outline = "none";
    el.addEventListener("blur", () => { el.removeAttribute("tabindex"); el.style.removeProperty("outline"); }, { once: true });
  }
  return el;
}
/** Focus something real inside el: its first usable control, else el itself. */
function focusInside(el: HTMLElement): void {
  if (el.contains(document.activeElement) && canTake(document.activeElement)) return;
  focusFirst([() => firstFocusable(el), () => landingSpot(el)]);
}
const MAIN_REGION = '[role="main"], main, uni-page-body';
/** Focus that fell back to the page's main region moves on to its heading or bottom-bar action once the page draws one
 *  (a result page renders its head just after the payment dialog closes), unless the user has moved on. */
function settleOnLanding(landing: Element): void {
  if (!landing.matches(MAIN_REGION)) return;
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (document.activeElement !== landing || tries > 10) { clearInterval(timer); return; }
    const better = fallbacks(null, null).map((next) => () => { const el = next(); return el && el !== landing && !el.matches(MAIN_REGION) ? el : null; });
    if (focusFirst(better)) clearInterval(timer);
  }, 150);
}
const accessibleName = (el: Element) => (el.getAttribute("aria-label") || el.textContent || "").trim();

/** Where focus goes when the trigger cannot take it, in order: the trigger's replacement (same test id, else same role,
 *  name and first class); inside a layer still open below, its first control, else its root; with no layer left, the
 *  page's bottom-bar action, the visible heading, the main region. Never <body>. */
function fallbacks(trace: { testid: string | null; role: string | null; name: string; cls: string | null } | null, scope: HTMLElement | null): (() => Element | null | undefined)[] {
  const within: ParentNode = scope ?? document;
  const all = (selector: string) => Array.from(within.querySelectorAll<HTMLElement>(selector));
  const list: (() => Element | null | undefined)[] = [];
  if (trace?.testid) for (const el of all(`[data-testid="${CSS.escape(trace.testid)}"]`)) list.push(() => el);
  if (trace?.name) {
    const same = trace.role ? `[role="${CSS.escape(trace.role)}"]` : '[tabindex]:not([tabindex="-1"]), button, a[href], input, select, textarea';
    // Same name and same first class: a redrawn copy of the control, not another control that happens to share its name.
    for (const el of all(same)) if (accessibleName(el) === trace.name && (!trace.cls || el.classList.contains(trace.cls))) list.push(() => el);
  }
  if (scope) return [...list, () => firstFocusable(scope), () => landingSpot(scope)];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('.nx-glass-bar [role="button"]')).reverse()) list.push(() => el);
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[role="heading"], h1, h2'))) list.push(() => landingSpot(el));
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(MAIN_REGION))) list.push(() => landingSpot(el));
  return list;
}

/**
 * 弹层的键盘可用性:焦点移入 → Tab 只在层内循环 → Esc 关闭 → 关闭后焦点归还。
 *
 * 【为什么要抽出来】
 * 遮罩只拦指针,不拦键盘。全仓 15 个可开关的全屏遮罩里,此前只有 1 个做了焦点管理,
 * 其余 14 个打开后 Tab 会直接走到背景 —— 而背景里有提现、下单这类按钮。
 * 2026-08-11 的键盘可达性整改给 43 个控件补了 tabindex,**把这个既有缺陷放大了**:
 * 能被 Tab 到的背景控件比以前多。
 *
 * 逐个手写焦点管理的下场,看这次量面就知道:15 个里 14 个没写。所以抽成一处,
 * 弹层只需调用一次,行为由这里保证。写法抄自仓内两个已经做对的实现
 * (`country-code-sheet.vue` 的焦点归还、`earn/device-card-pc.vue` 的 Tab 陷阱)。
 *
 * 【为什么是 Tab 陷阱而不是给背景上 inert】
 * uni 的弹层就渲染在页面自己的组件树里(不是传送到 body 末尾),"背景"是同一棵树里的
 * 兄弟节点,拿不到一个稳定的"页面根"来上 inert。Tab 陷阱不依赖 DOM 结构,对键盘用户
 * 等效,且不会误伤别的东西。
 *
 * @param open 弹层开关(响应式)
 * @param root 弹层根:给根元素的选择器(如 `.vcs-root`),或自己取元素的函数。
 *             用选择器是因为 uni 的 template ref 可能拿到组件实例而非 DOM
 *             (`country-code-sheet.vue` 为此专门写了 `$el` 兜底类型);按根类名找最稳,
 *             `earn/device-card-pc.vue` 的既有实现也是这么做的。
 * @param close Esc 时怎么关。**可以不传** —— 有些弹层没有"取消"这个语义
 *              (断网遮罩只有「重试」一条路),给它接上 Esc 等于凭空造出一个
 *              用户以为处理了、其实什么都没处理的出口。不传则 Esc 不做任何事,
 *              但 Tab 陷阱与焦点归还照常。
 * @param nativeBack 在当前原生页面启用 Android 返回键,仅取消最上层可见弹层。
 * @param nativePriority 全局遮罩的既有视觉层级;同级弹层按打开顺序处理。
 */
export function useDialogA11y(
  open: Ref<boolean>,
  root: string | (() => HTMLElement | null | undefined),
  close?: () => void,
  nativeBack = false,
  nativePriority = 0,
): void {
  // #ifdef APP-PLUS
  registerNativeDialog(open, close, nativeBack, nativePriority);
  // #endif
  useDialogScrollLock(open);
  trackFocus();
  let previousFocus: HTMLElement | SVGElement | null = null;
  // How to find the trigger again when the page re-rendered it while the dialog was open (a fresh checkout creates the
  // order and redraws its pay button): its test id, else its role and accessible name.
  let previousTrace: { testid: string | null; role: string | null; name: string; cls: string | null } | null = null;
  let openedAt = 0;
  const layer: Layer = { order: 0, root: () => rootEl() };
  // Closed only because a newer layer took over (a notice over the payment page): the trigger is kept for its return.
  let paused = false;
  // Only a layer that really opened hands focus back (the immediate watch runs the closed branch on mount).
  let wasOpen = false;
  const forget = () => { previousFocus = null; previousTrace = null; };

  const rootEl = (): HTMLElement | null | undefined =>
    typeof root === "string"
      ? (typeof document === "undefined" ? null : document.querySelector<HTMLElement>(root))
      : root();

  /** 层内当前可聚焦的元素。offsetParent 为空的是隐藏元素,Tab 不该停在上面。 */
  function focusables(): HTMLElement[] {
    const el = rootEl();
    if (!el) return [];
    const root_ = el;
    const sel = '[tabindex]:not([tabindex="-1"]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]';
    // 🔴 用 getClientRects 判可见,不用 offsetParent:`position: fixed` 元素的 offsetParent
    // **恒为 null**(除非祖先有 transform),而弹层里恰恰常有 fixed 的吸底操作条 ——
    // 拿 offsetParent 过滤会把它们整批当成"隐藏"剔掉,Tab 就再也停不到确认按钮上。
    // Same test as every other focus target: visibility:hidden still has a rect, and inert / aria-disabled controls are no Tab stop.
    return Array.from(root_.querySelectorAll<HTMLElement>(sel)).filter(canTake);
  }

  function onKeydown(ev: KeyboardEvent): void {
    if (!open.value) return;
    const top = topLayer();
    if (top && top.layer !== layer) return;
    if (ev.key === "Escape") {
      if (!close) return;   // 没有取消语义的弹层:别吃掉 Esc,更别假装关掉了
      ev.preventDefault();
      ev.stopPropagation();
      close();
      return;
    }
    if (ev.key !== "Tab") return;
    const items = focusables();
    if (!items.length || typeof document === "undefined") return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    // 焦点已经在层外(current < 0)也要拉回来 —— 否则从背景 Tab 进来的人会继续往背景走。
    if (ev.shiftKey && current <= 0) {
      ev.preventDefault();
      ev.stopPropagation();
      items[items.length - 1].focus();
    } else if (!ev.shiftKey && (current < 0 || current === items.length - 1)) {
      ev.preventDefault();
      ev.stopPropagation();
      items[0].focus();
    }
  }

  /** 关闭后把焦点还回触发它的那个控件,否则焦点回到文档开头,用户要重新 Tab 一遍。
   *  触发控件已被重绘或藏起时,回到同一位置的新控件,再不行落到页面主操作或可见标题(03 §3.5)。 */
  function restore(): void {
    if (!wasOpen) return;
    wasOpen = false;
    const top = topLayer();
    // A layer opened after this one is on screen: this one was only paused. Keep its trigger and leave focus up there.
    if (top && top.layer.order > openedAt) {
      paused = true;
      if (top.el) focusInside(top.el);
      return;
    }
    // Otherwise focus goes back inside the layer still open below, if any, else to the page.
    const scope = top?.el ?? null;
    const inScope = (el: Element | null | undefined) => !!el && (!scope || scope.contains(el));
    const active = document.activeElement;
    // A parent dialog closing in the same step may already have restored focus; move it only when it is really lost.
    const settled = canTake(active) && inScope(active);
    const back = focusFirst([() => (inScope(previousFocus) ? previousFocus : null), ...(settled ? [] : fallbacks(previousTrace, scope))]);
    restoredAt = Date.now();
    if (back) settleOnLanding(back);
    previousFocus = null;
    previousTrace = null;
  }

  function detach(): void {
    if (typeof document === "undefined") return;
    // capture 阶段:要赶在层内控件自己的 handler 之前拿到 Tab/Esc。
    document.removeEventListener("keydown", onKeydown, true);
  }

  watch(open, async (isOpen) => {
    if (typeof document === "undefined") return;
    detach();
    dropLayer(layer);
    if (isOpen) {
      const active = document.activeElement;
      const candidate = active instanceof HTMLElement && active !== document.body || active instanceof SVGElement ? active : lastFocus;
      const modal = candidate?.closest('[aria-modal="true"]');
      // Back from a pause, focus sits in the layer that is about to go: keep the trigger recorded before the pause.
      if (!(paused && (previousFocus || previousTrace) && (!candidate || modal && modal !== rootEl()))) {
        previousFocus = candidate;
        previousTrace = previousFocus && previousFocus !== document.body ? { testid: previousFocus.getAttribute("data-testid"), role: previousFocus.getAttribute("role"), name: accessibleName(previousFocus), cls: previousFocus.classList[0] ?? null } : null;
      }
      paused = false;
      wasOpen = true;
      openedAt = ++openSeq;
      layer.order = openedAt;
      openLayers.push(layer);
      document.addEventListener("keydown", onKeydown, true);
      await nextTick();
      // 焦点必须真的移进来:不移的话读屏用户不知道弹层开了,键盘用户按 Tab 时
      // 焦点还在背景的触发按钮上,第一下 Tab 就走去了背景的下一个控件。
      // A layer that is still animating in may have no control on screen yet: try for a few frames, then take the root.
      for (let frame = 0; frame < 6 && open.value; frame++) {
        const top = topLayer();
        if (top && top.layer.order > openedAt) break; // a newer layer already took over
        syncInert();
        const el = rootEl();
        if (el && (firstFocusable(el) || frame === 5)) { focusInside(el); break; }
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      }
      return;
    }
    syncInert();
    scheduleRestore(openedAt, restore, forget);
  // immediate:有些弹层不是靠自身的 v-if 开关,而是**整个组件被父级 v-if 挂载**
  // (captcha-slider 就是这样)。它们的 open 恒为 true,不给 immediate 的话 watch
  // 永远不触发,焦点管理一次都不会生效。对 open 初值为 false 的弹层,immediate 只会
  // 走一次"关闭"分支,而那时 previousFocus 是 null,无副作用。
  }, { immediate: true });

  // A dialog removed by its parent's v-if while still open (open stays true) is closing too: return focus the same way.
  onBeforeUnmount(() => {
    detach();
    dropLayer(layer);
    syncInert();
    if (open.value && (previousFocus || previousTrace)) scheduleRestore(openedAt, restore, forget);
  });
}
