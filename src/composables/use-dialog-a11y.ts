import { watch, nextTick, onBeforeUnmount, inject, ref, type Ref, type InjectionKey } from "vue";
import { TAB_LIFECYCLE, onShow as onTabShow, onHide as onTabHide } from "./use-tab-page-lifecycle";
// #ifdef APP-PLUS
import { getCurrentInstance } from "vue";
import { onBackPress, onShow as onPageShow, onHide as onPageHide } from "@dcloudio/uni-app";

type Dialog = { close?: () => void; priority: number };
type DialogPage = { stack: Dialog[]; visible: boolean; backRegistered: boolean };
const dialogPages = new WeakMap<object, DialogPage>();
// Back presses a dialog answered. Uni runs every onBackPress handler of the page on one press, so a page's own handler
// asks here (or whether a dialog is still open) to know the press was not meant for leaving the page.
const backTaken = new WeakSet<object>();
// Back handlers this module put on each page root. Uni keeps every page's onBackPress on the root, so more handlers than
// these means the page has its own, and the page decides what a back press does (header mirror below).
const moduleHandlers = new WeakMap<object, number>();
const countModuleHandler = (owner: object) => moduleHandlers.set(owner, (moduleHandlers.get(owner) ?? 0) + 1);
type HeaderMirror = { action: (() => (() => void) | null) | null };
const headerMirrors = new WeakMap<object, HeaderMirror>();

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
    countModuleHandler(owner);
    onPageShow(() => { dialogs.visible = true; }, owner);
    onPageHide(() => { dialogs.visible = false; }, owner);
    onBackPress(event => {
      if (event.from !== "backbutton" || !dialogs.visible) return false;
      // Global masks stay above page sheets even after a retained tab reappears.
      // Equal visual layers retain their ordinary last-opened-first ordering.
      const top = dialogs.stack.reduce<Dialog | undefined>((current, entry) =>
        !current || entry.priority >= current.priority ? entry : current, undefined);
      if (!top) return false;
      backTaken.add(event);
      // A retry-only overlay has no cancel action; never close a lower dialog.
      top.close?.();
      return true;
    }, owner);
  }
}
// #endif

/** For a page with its own onBackPress: true when this press belongs to a dialog on the page (02.7 top layer first), so
 *  the page keeps its leave logic for the next press. Works whichever handler Uni runs first. */
export function useDialogBackHeld(): (event: object) => boolean {
  let held = (_event: object) => false;
  // #ifdef APP-PLUS
  const owner = getCurrentInstance()?.root;
  held = (event) => {
    const page = owner ? dialogPages.get(owner) : undefined;
    return backTaken.has(event) || !!page && page.backRegistered && page.visible && page.stack.length > 0;
  };
  // #endif
  return held;
}

/**
 * The page header's back or close, done by the system back button too (02 §2.7.3). Only when the page is alone on the
 * stack (a redirect or cold open; with history the system pops the page as usual), no dialog takes this press, and the
 * page has no onBackPress of its own (then the page decides). `action` returns what the header's back or close does
 * now, or null when the header shows neither. One header per page counts: the last one mounted.
 */
export function useHeaderSystemBack(action: () => (() => void) | null): void {
  // #ifdef APP-PLUS
  const owner = getCurrentInstance()?.root;
  if (!owner) return;
  const held = useDialogBackHeld();
  let mirror = headerMirrors.get(owner);
  if (!mirror) {
    const created: HeaderMirror = { action: null };
    mirror = created;
    headerMirrors.set(owner, created);
    countModuleHandler(owner);
    onBackPress(event => {
      if (event.from !== "backbutton" || held(event)) return false;
      const hooks = (owner as unknown as { onBackPress?: unknown[] }).onBackPress ?? [];
      if (hooks.length > (moduleHandlers.get(owner) ?? 0)) return false;
      let pages = 0;
      try { pages = getCurrentPages().length; } catch { return false; }
      const run = pages === 1 ? created.action?.() : null;
      if (!run) return false;
      run();
      return true;
    }, owner);
  }
  const current = mirror;
  current.action = action;
  onBeforeUnmount(() => { if (current.action === action) current.action = null; });
  // #endif
}

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
      // A hidden page has no focus moved for it, in a layer or on the page.
      if (document.hidden) return;
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
type Layer = { order: number; root: () => HTMLElement | null | undefined; close?: () => void };
const openLayers: Layer[] = [];

// #ifdef H5
// Browser back on H5 answers the top layer first (02.7, 03 §3.5), as Esc does, through the same close callback and so the
// same guards. Each open layer pushes its own history entry: a copy of the page's router state with a marker, at the
// same URL. Opening a layer is therefore a forward step, and like any forward step it drops the browser's forward
// entries; closing it returns the history to its shape before the layer opened. A back that pops a layer entry is kept
// from vue-router and uni (uni would drop the page) and closes that layer; if its guard keeps it open (a submitting
// payment PIN) the entry is pushed again, so the history still matches the screen. A layer closed by code steps back
// off its own entry and that one pop is ignored. A marker whose layer is already gone is stepped over, so no back is
// ever empty. uni.navigateBack from the app steps over layer entries to the page before. This also covers a page opened
// straight from another document (deep link, reload). The native App keeps registerNativeDialog for its back button.
type LayerEntry = { id: number; layer: Layer };
const layerEntries: LayerEntry[] = [];
let entrySeq = 0;
let currentMarker: number | null = null;
// The router position of the entry the browser sits on, to tell a forward step from a back step.
let currentPosition: unknown;
const positionOf = (state: unknown): unknown => (state as { position?: unknown } | null)?.position;
// How many layer entries the current entry sits above its page entry (0 on the page entry), to know how far a jump went.
let currentDepth = 0;
// Pops this guard caused itself, each with the layer entry it expected to start from ("any" for a correcting step).
const ignoredPops: (number | "any")[] = [];
// Depth of the entry the user left before this guard began stepping forward over gone layer entries (see the forward
// step in the popstate listener); null when no such run is under way.
let forwardFrom: number | null = null;
// Router state (current, position) of page entries replaced away from under a layer entry.
const stalePageEntries: { current: unknown; position: unknown }[] = [];
let appBackAt = 0;
let browserBackGuarded = false;
const markerOf = (state: unknown): number | null => {
  const marker = (state as { __nxLayer?: unknown } | null)?.__nxLayer;
  return typeof marker === "number" ? marker : null;
};
// Something was pushed above this layer entry (a page navigated to from inside the layer, or the next layer), so a
// forward step from it has somewhere to go. Kept in the entry's state, it survives a reload.
const hasNextOf = (state: unknown): boolean => (state as { __nxNext?: unknown } | null)?.__nxNext === true;
// Entries written before depths were kept count as one above the page.
const depthOf = (state: unknown): number => markerOf(state) === null ? 0 : (state as { __nxDepth?: number }).__nxDepth ?? 1;
function pushLayerEntry(layer: Layer): void {
  if (!browserBackGuarded) return;
  const id = ++entrySeq;
  const { __nxNext: _next, ...below } = (history.state as Record<string, unknown> | null) ?? {};
  history.pushState({ ...below, __nxLayer: id, __nxDepth: currentDepth + 1 }, "", location.href);
  layerEntries.push({ id, layer });
}
/** A layer closed by code (or unmounted) leaves its entry: step back off it once the current step has settled, so a
 *  navigation started in the same step lands first. Only when the browser is still on that entry. */
function releaseLayerEntry(layer: Layer): void {
  const index = layerEntries.findIndex((entry) => entry.layer === layer);
  if (index < 0) return;
  const [entry] = layerEntries.splice(index, 1);
  setTimeout(() => {
    if (markerOf(history.state) !== entry.id) return;
    ignoredPops.push(entry.id);
    history.back();
  }, 0);
}
/** Called once at app start, before the router exists: listeners on window run in the order they were added (whatever
 *  the capture flag), and vue-router's own popstate listener must not see a pop that belongs to a layer. */
export function installBrowserBackGuard(): void {
  if (browserBackGuarded || typeof window === "undefined") return;
  browserBackGuarded = true;
  currentMarker = markerOf(history.state);
  currentPosition = positionOf(history.state);
  currentDepth = depthOf(history.state);
  // A reload restarts the counter while the history still holds this tab's earlier markers: new ids start above them.
  entrySeq = Math.max(entrySeq, currentMarker ?? 0);
  // Every entry the router or a layer pushes or replaces tells us whether the browser now sits on a layer entry.
  const push = history.pushState.bind(history), replace = history.replaceState.bind(history);
  history.pushState = (state, title, url) => {
    if (currentMarker !== null && !hasNextOf(history.state)) replace({ ...(history.state as object), __nxNext: true }, "", location.href);
    push(state, title, url);
    currentMarker = markerOf(state);
    currentPosition = positionOf(state);
    currentDepth = depthOf(state);
  };
  history.replaceState = (state, title, url) => {
    const before = history.state as { __nxLayer?: unknown; current?: unknown; position?: unknown } | null;
    let next = state;
    // The router replaced the page while a layer entry was current (a tab switch or reset started from inside a layer).
    // The new page's entry is not a layer entry; the page entry and layer entries left below it belong to a page that is
    // gone, and are stepped over on the way back.
    if (markerOf(before) !== null && state && typeof state === "object" && (state as { current?: unknown }).current !== before?.current) {
      stalePageEntries.push({ current: before?.current, position: before?.position });
      const { __nxLayer: _layer, __nxDepth: _depth, __nxNext: _next, ...rest } = state as Record<string, unknown>;
      next = rest;
    }
    replace(next, title, url);
    currentMarker = markerOf(next);
    currentPosition = positionOf(next);
    currentDepth = depthOf(next);
  };
  uni.addInterceptor("navigateBack", { invoke() { appBackAt = Date.now(); } });
  window.addEventListener("popstate", (ev) => {
    const from = currentMarker, fromPosition = currentPosition, fromDepth = currentDepth;
    const landed = markerOf(ev.state), landedPosition = positionOf(ev.state), landedDepth = depthOf(ev.state);
    currentMarker = landed;
    currentPosition = landedPosition;
    currentDepth = landedDepth;
    entrySeq = Math.max(entrySeq, landed ?? 0);
    if (ignoredPops.length) {
      const expected = ignoredPops.shift();
      ev.stopImmediatePropagation();
      // A navigation pushed its entry between the step back and the browser carrying it out, so the step went back over
      // that navigation instead of over the layer entry: go forward to it again, unseen by the router.
      if (expected !== "any" && from !== expected) { ignoredPops.push("any"); history.forward(); }
      return;
    }
    const landedState = ev.state as { current?: unknown; position?: unknown } | null;
    if (landedState && stalePageEntries.some((entry) => entry.current === landedState.current && entry.position === landedState.position)) {
      ev.stopImmediatePropagation();
      history.back();
      return;
    }
    const gone = (marker: number | null) => marker !== null && !layerEntries.some((entry) => entry.id === marker);
    const crossPage = typeof landedPosition === "number" && typeof fromPosition === "number" && landedPosition !== fromPosition;
    // A forward step on the same page onto a layer entry whose layer is gone (it was closed by back or by code, and the
    // browser kept the entry as a forward entry): there is nothing to reopen. Unseen by the router, keep going forward to
    // the next real entry (a page navigated to from inside the layer); with none, step back to where the user was, so the
    // route stays and the next back does one thing. On the same page a forward step lands on a layer entry above the one
    // left (a page entry sits below its layer entries). A step to another page's entry (the history menu,
    // history.go(2)) is the router's, whatever entry it lands on.
    if (gone(landed) && !crossPage && (from === null || landed! > from)) {
      ev.stopImmediatePropagation();
      // A jump (history.go(2)) can cross several gone entries at once: measure by depth, not by the number of pops.
      if (forwardFrom === null || !gone(from)) forwardFrom = fromDepth;
      // Without the Navigation API (older iOS WebKit) the entry's own state says whether anything follows it.
      const navigation = (window as { navigation?: { canGoForward: boolean } }).navigation;
      if (navigation ? navigation.canGoForward : hasNextOf(ev.state)) { history.forward(); return; }
      // Nothing real after them: back over every gone entry crossed, to the entry the user left.
      ignoredPops.push(landed!);
      history.go(forwardFrom - landedDepth);
      forwardFrom = null;
      return;
    }
    forwardFrom = null;
    // The pop did not start on a live layer entry: an ordinary page step for the router. That includes a forward step off
    // a gone layer entry to a later page (the step above, or the browser's own forward).
    if (from === null || (gone(from) && crossPage && (landedPosition as number) > (fromPosition as number))) return;
    ev.stopImmediatePropagation();
    // Entries above where the browser landed have been popped (one, for a single back).
    const popped = layerEntries.filter((entry) => landed === null || entry.id > landed);
    popped.forEach((entry) => layerEntries.splice(layerEntries.indexOf(entry), 1));
    const top = popped[popped.length - 1];
    // uni.navigateBack, or a step off an entry whose layer is gone: keep going back to the real page step.
    if (!top || Date.now() - appBackAt < 1_000) { history.back(); return; }
    top.layer.close?.();
    // The layer's guard kept it open (or it has no close at all): its entry goes back so history matches the screen.
    setTimeout(() => { if (openLayers.includes(top.layer)) pushLayerEntry(top.layer); }, 0);
  });
}
// #endif
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
/** How a trigger is found again once the page redrew it while the dialog was open (a re-read redraws the order
 *  detail tray): its test id; its slot, a page class only it carried when the dialog opened (`order-hero__pay`), which
 *  holds while a busy label changes its name; else its role, name and first class. Shared component, variant and state
 *  classes (`nx-button`, `nx-button--primary`, `is-active`) never make a slot: after a redraw they match other controls. */
type Trace = { testid: string | null; role: string | null; name: string; cls: string | null; slot: string | null; area: string };
const SHARED_CLASS = /--|^is-|^nx-|^uni-/;
/** The region a control sits in (a dialog, the bottom bar, the page), so a copy found elsewhere is not taken for it. */
function areaOf(el: Element): string {
  const area = el.closest('[aria-modal="true"], .nx-glass-bar');
  return area ? (area.id ? "#" + area.id : area.classList[0] ?? area.tagName) : "page";
}
function traceOf(el: HTMLElement | SVGElement): Trace {
  const slot = Array.from(el.classList).find((c) => !SHARED_CLASS.test(c) && document.getElementsByClassName(c).length === 1) ?? null;
  return { testid: el.getAttribute("data-testid"), role: el.getAttribute("role"), name: accessibleName(el), cls: el.classList[0] ?? null, slot, area: areaOf(el) };
}
/** The trigger's redrawn copies inside scope (or the page), best match first. A test id or slot match counts only when
 *  it is the one control on screen with it, in the same role and region. */
function replacements(trace: Trace | null, scope: HTMLElement | null): HTMLElement[] {
  if (!trace) return [];
  const within: ParentNode = scope ?? document;
  const all = (selector: string) => Array.from(within.querySelectorAll<HTMLElement>(selector));
  const verified = (found: HTMLElement[]) => {
    const onScreen = found.filter((el) => el.isConnected && shown(el));
    const [only] = onScreen;
    return onScreen.length === 1 && (!trace.role || only.getAttribute("role") === trace.role) && areaOf(only) === trace.area ? [only] : [];
  };
  const list: HTMLElement[] = [];
  if (trace.testid) list.push(...verified(all(`[data-testid="${CSS.escape(trace.testid)}"]`)));
  if (trace.slot) list.push(...verified(all(`.${CSS.escape(trace.slot)}`)));
  if (trace.name) {
    const same = trace.role ? `[role="${CSS.escape(trace.role)}"]` : '[tabindex]:not([tabindex="-1"]), button, a[href], input, select, textarea';
    // Same name and same first class: a redrawn copy of the control, not another control that happens to share its name.
    for (const el of all(same)) if (accessibleName(el) === trace.name && (!trace.cls || el.classList.contains(trace.cls))) list.push(el);
  }
  return [...new Set(list)];
}
/** A trigger still on screen that is only disabled for the moment: not removed, hidden or inert. */
const onlyDisabled = (el: Element) => el.isConnected && shown(el) && !el.closest("[inert]") && getComputedStyle(el).visibility === "visible"
  && (el.getAttribute("aria-disabled") === "true" || (el as HTMLButtonElement).disabled === true);
/** A page may hand the trigger back only once the layer has fully closed, or after redrawing it (order detail turns
 *  「继续支付」 back on after the payment sheet is gone). Focus already sits on a fallback (`landing`); while the trigger,
 *  or its redrawn copy, is busy (aria-busy: the page is still working and will release it) or only briefly disabled,
 *  move focus to it once it can take focus, but only while focus is still on that landing: a user who moved on (Tab,
 *  a tap, a new layer) or a hidden page is left alone. If it goes away, or stays disabled without being busy, focus
 *  stays on the landing. */
function waitForTrigger(find: () => Element | null, landing: Element | null, done: () => void): void {
  let idle = 0;
  let total = 0;
  const timer = setInterval(() => {
    total += 1;
    const active = document.activeElement;
    const untouched = landing ? active === landing : !active || active === document.body;
    const el = find();
    if (!untouched || document.hidden) { clearInterval(timer); return; }
    if (el && canTake(el)) { clearInterval(timer); el.focus(); return; }
    if (el?.getAttribute("aria-busy") !== "true") idle += 1;
    // A disabled trigger that is not busy gets a second; a busy one is waited for, with a cap so no timer outlives a
    // control that never comes back.
    if (el && onlyDisabled(el) && idle < 20 && total < 300) return;
    clearInterval(timer);
    done();
  }, 50);
}
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
// The sub-page header title (either header component): the page's own title when the content draws no heading of its
// own (03 §3.5).
const PAGE_TITLE = '.spv-title, .nx-nav-title';
/** Focus that fell back to the page's main region moves on to its heading or bottom-bar action once the page draws one
 *  (a result page renders its head just after the payment dialog closes), unless the user has moved on. */
function settleOnLanding(landing: Element): void {
  if (!landing.matches(MAIN_REGION) && !landing.matches(PAGE_TITLE)) return;
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (document.activeElement !== landing || tries > 10 || document.hidden) { clearInterval(timer); return; }
    const better = fallbacks(null, null).map((next) => () => { const el = next(); return el && el !== landing && !el.matches(MAIN_REGION) && !el.matches(PAGE_TITLE) ? el : null; });
    if (focusFirst(better)) clearInterval(timer);
  }, 150);
}
const accessibleName = (el: Element) => (el.getAttribute("aria-label") || el.textContent || "").trim();

/** Where focus goes when the trigger cannot take it, in order: the trigger's replacement (same test id, else same role,
 *  name and first class); inside a layer still open below, its first control, else its root; with no layer left, the
 *  page's bottom-bar action, the visible heading, the page title, the main region. Never <body>. */
function fallbacks(trace: Trace | null, scope: HTMLElement | null): (() => Element | null | undefined)[] {
  const list: (() => Element | null | undefined)[] = replacements(trace, scope).map((el) => () => el);
  if (scope) return [...list, () => firstFocusable(scope), () => landingSpot(scope)];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('.nx-glass-bar [role="button"]')).reverse()) list.push(() => el);
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[role="heading"], h1, h2'))) list.push(() => landingSpot(el));
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(PAGE_TITLE))) list.push(() => landingSpot(el));
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(MAIN_REGION))) list.push(() => landingSpot(el));
  return list;
}

/** Where focus waits on the page while the trigger is still busy: something that only says where the user is (the
 *  content heading, else the sub-page title), never another action such as 取消订单 that a screen reader would
 *  announce as the next step; the bar actions and the main region only when the page has no title. */
function pageWaitLandings(): (() => Element | null | undefined)[] {
  const list: (() => Element | null | undefined)[] = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[role="heading"], h1, h2'))) list.push(() => landingSpot(el));
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(PAGE_TITLE))) list.push(() => landingSpot(el));
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('.nx-glass-bar [role="button"]')).reverse()) list.push(() => el);
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
 * @param nativeBack 在当前原生页面启用 Android 返回键,仅取消最上层可见弹层。默认开启:能关的弹层都先吃掉系统返回
 *             (02 §2.7、03 §3.5),close 里的提交守卫照旧;只有确有理由不接系统返回的弹层才显式传 false 并写明原因。
 * @param nativePriority 全局遮罩的既有视觉层级;同级弹层按打开顺序处理。
 */
export function useDialogA11y(
  open: Ref<boolean>,
  root: string | (() => HTMLElement | null | undefined),
  close?: () => void,
  nativeBack = true,
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
  let previousTrace: Trace | null = null;
  let openedAt = 0;
  const layer: Layer = { order: 0, root: () => rootEl(), close };
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
      if (top.el && !document.hidden) focusInside(top.el);
      return;
    }
    // Otherwise focus goes back inside the layer still open below, if any, else to the page.
    const scope = top?.el ?? null;
    const inScope = (el: Element | null | undefined) => !!el && (!scope || scope.contains(el));
    const active = document.activeElement;
    // A parent dialog closing in the same step may already have restored focus; move it only when it is really lost.
    const settled = canTake(active) && inScope(active);
    const trigger = inScope(previousFocus) ? previousFocus : null;
    const trace = previousTrace;
    previousFocus = null;
    previousTrace = null;
    // A hidden page (the app sent to the background) does not have focus moved for it.
    if (document.hidden) return;
    const find = () => (trigger?.isConnected ? trigger : replacements(trace, scope)[0] ?? null);
    const current = settled ? null : find();
    if (!(current && !canTake(current) && onlyDisabled(current))) {
      const back = focusFirst([() => trigger, ...(settled ? [] : fallbacks(trace, scope))]);
      restoredAt = Date.now();
      if (back) settleOnLanding(back);
      return;
    }
    // The trigger, or the copy the page redrew in its place, is still there and only disabled for now. Focus never
    // waits on <body>: it lands at once on the next fallback (the trigger and its copies skipped), and goes on to the
    // trigger once that can take it, unless the user has moved on meanwhile (03 §3.5).
    // On the page the wait lands on a title, not on another action; inside a layer below, its usual order applies.
    const copies = new Set<Element | null>([trigger, current, ...replacements(trace, scope)]);
    const candidates = scope ? fallbacks(trace, scope) : pageWaitLandings();
    const landing = focusFirst(candidates.map((next) => () => { const el = next(); return el && !copies.has(el) ? el : null; }));
    restoredAt = Date.now();
    waitForTrigger(find, landing, () => { if (landing) settleOnLanding(landing); });
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
        previousTrace = previousFocus && previousFocus !== document.body ? traceOf(previousFocus) : null;
      }
      paused = false;
      wasOpen = true;
      openedAt = ++openSeq;
      layer.order = openedAt;
      openLayers.push(layer);
      // #ifdef H5
      pushLayerEntry(layer);
      // #endif
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
    // #ifdef H5
    releaseLayerEntry(layer);
    // #endif
    if (wasOpen) scheduleRestore(openedAt, restore, forget);
  // immediate:有些弹层不是靠自身的 v-if 开关,而是**整个组件被父级 v-if 挂载**
  // (captcha-slider 就是这样)。它们的 open 恒为 true,不给 immediate 的话 watch
  // 永远不触发,焦点管理一次都不会生效。对 open 初值为 false 的弹层,immediate 只会
  // 走一次"关闭"分支,不参与真正关闭的焦点归还队列。
  }, { immediate: true });

  // A dialog removed by its parent's v-if while still open (open stays true) is closing too: return focus the same way.
  onBeforeUnmount(() => {
    detach();
    dropLayer(layer);
    // #ifdef H5
    releaseLayerEntry(layer);
    // #endif
    syncInert();
    if (open.value && (previousFocus || previousTrace)) scheduleRestore(openedAt, restore, forget);
  });
}
