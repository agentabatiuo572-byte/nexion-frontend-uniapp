import { attachManualScrollLoadMore } from "./manual-scroll-load-more";
import { mountLiquidGlass, type GlassConfiguration } from "./liquid-glass-renderer";
import { glassSpring, glassLogoHidden } from "./liquid-glass-core";
import { normalizedScrollTop, saveScrollPos, getScrollPos } from "./scroll-memory";

export interface SegmentsConfiguration {
  hostId: string; value: string; values: string[]; fromValue?: string;
  layout: string; variant: string;
  navigationOnArrival?: boolean;
}

type LensRect = { x: number; y: number; width: number; height: number };
const axes = ["x", "y", "width", "height"] as const;
const zeroVelocity = (): LensRect => ({ x: 0, y: 0, width: 0, height: 0 });
type Motion = { rect: LensRect; velocity: LensRect; expansion: number; expansionVelocity: number };
const frameMs = 1000 / 60;
type Flight = { steps: Motion[]; held: number; lens: Animation; track?: Animation };
/** Where the compositor shows a flight now (or last showed it); keyframes are linear between steps. */
function sampleFlight(f: Flight): Motion {
  const at = Math.max(0, Number(f.lens.currentTime ?? f.held) / frameMs);
  const i = Math.min(f.steps.length - 1, Math.floor(at)), a = f.steps[i], b = f.steps[Math.min(f.steps.length - 1, i + 1)];
  const k = Math.min(1, at - i), mix = (x: number, y: number) => x + (y - x) * k;
  const mixRect = (x: LensRect, y: LensRect) => ({ x: mix(x.x, y.x), y: mix(x.y, y.y), width: mix(x.width, y.width), height: mix(x.height, y.height) });
  return { rect: mixRect(a.rect, b.rect), velocity: mixRect(a.velocity, b.velocity), expansion: mix(a.expansion, b.expansion), expansionVelocity: mix(a.expansionVelocity, b.expansionVelocity) };
}
// A new H5 page resumes the outgoing lens, including velocity, instead of restarting.
// It holds a running flight only while that flight is shown; grounding freezes it to one sample.
let navigationFlight: { from: string; value: string; sequence: number; width: number; motion: Motion | Flight } | undefined;
let navigationSequence = 0;

function mountSegments(root: HTMLElement, initial: SegmentsConfiguration) {
  let config = initial, disposed = false, frame = 0, motionFrame = 0, lastTime = 0;
  let current: LensRect | undefined, target: LensRect | undefined, velocity = zeroVelocity();
  let transformLayer: Animation | undefined, trackLayer: Animation | undefined;
  // A tap's whole spring is precomputed and played by the compositor, so a busy
  // main thread (page switch) cannot drop its frames. Drag still follows per frame.
  let flight: Flight | undefined;
  let expansion = 0, expansionVelocity = 0;
  let maxTrackScroll = 0;
  let destination = initial.value, suppressClick = false;
  let pendingNavigation: string[] = [];
  let outgoingSequence = 0;
  let drag: { id: number; x: number; y: number; lastX: number; at: number; engaged: boolean } | undefined;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const nodes = () => Array.from(root.querySelectorAll<HTMLElement>(":scope > .nx-glass-option"));
  const rect = (el: HTMLElement) => ({ x: el.offsetLeft, y: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
  const lens = root.querySelector<HTMLElement>(":scope > .nx-glass-indicator")!;
  const track = root.querySelector<HTMLElement>(":scope > .nx-glass-backdrop, :scope > .nx-glass-track-viewport > .nx-glass-backdrop");
  const trackViewport = root.querySelector<HTMLElement>(":scope > .nx-glass-track-viewport");
  const enabled = (el: HTMLElement) => el.getAttribute("aria-disabled") !== "true";
  function lensTransform(at: LensRect, speed: LensRect, size: LensRect) {
    const stretch = reduced.matches ? 0 : Math.min(.18, Math.abs(speed.x) / 4200);
    const squash = reduced.matches ? 0 : Math.min(.08, Math.abs(speed.y) / 3000);
    const w = at.width * (1 + stretch - squash / 2), h = at.height * (1 - stretch / 2 + squash);
    return `translate3d(${at.x - (w - at.width) / 2}px,${at.y - (h - at.height) / 2}px,0) scale(${w / size.width},${h / size.height})`;
  }
  function trackTransform(amount: number) {
    // Rapid impulses remain continuous without growing beyond the safe gutters.
    const limit = Math.min(.06, 18 / Math.max(1, config.layout === "vertical" ? root.clientHeight : root.clientWidth));
    const scale = reduced.matches ? 0 : limit * Math.tanh(amount / limit);
    return config.layout === "vertical" ? `scale(${1 - scale * .5},${1 + scale})` : `scale(${1 + scale},${1 - scale * .5})`;
  }
  function handOff(motion: Motion | Flight) {
    if (config.variant === "navigation" && destination !== config.value && root.clientWidth > 0 && outgoingSequence === navigationSequence) {
      navigationFlight = { from: config.value, value: destination, sequence: outgoingSequence, width: root.clientWidth, motion };
    }
  }
  function paint() {
    if (!current || !target) return;
    // Clip only the scrolling rail's decoration. Its stretched child must not
    // enlarge scrollWidth and feed its own overflow back into scrollLeft.
    if (track && trackViewport) {
      const offset = `translate3d(${Math.min(root.scrollLeft, maxTrackScroll)}px,0,0)`;
      if (trackViewport.style.transform !== offset) trackViewport.style.transform = offset;
    }
    if (flight) return;
    const transform = lensTransform(current, velocity, target);
    // Updating an effect avoids a DOM style mutation on every frame. WebKit's
    // background capture otherwise repeatedly snapshots the entire page mid-drag.
    if (lens.animate) {
      if (!transformLayer) {
        transformLayer = lens.animate([{ transform }, { transform }], { duration: 1, fill: "both" });
        transformLayer.pause(); transformLayer.currentTime = 0;
      } else (transformLayer.effect as KeyframeEffect).setKeyframes([{ transform }, { transform }]);
    } else lens.style.transform = transform;
    // Only the material deforms. Its labels, focus rings and hit areas stay put.
    if (track) {
      const backdropTransform = trackTransform(expansion);
      if (track.animate) {
        if (!trackLayer) {
          trackLayer = track.animate([{ transform: backdropTransform }, { transform: backdropTransform }], { duration: 1, fill: "both" });
          trackLayer.pause(); trackLayer.currentTime = 0;
        } else (trackLayer.effect as KeyframeEffect).setKeyframes([{ transform: backdropTransform }, { transform: backdropTransform }]);
      } else track.style.transform = backdropTransform;
    }
    handOff({ rect: { ...current }, velocity: { ...velocity }, expansion, expansionVelocity });
  }
  /** Ends any flight; with a motion, the static layer takes over in the same task so nothing flashes. */
  function ground(motion?: Motion) {
    const f = flight;
    flight = undefined;
    // An H5 page that leaves mid-flight hands over the lens where it was last shown.
    if (f) {
      f.held = Number(f.lens.currentTime ?? f.held);
      if (navigationFlight?.motion === f) navigationFlight.motion = sampleFlight(f);
    }
    if (motion) {
      current = { ...motion.rect }; velocity = { ...motion.velocity };
      expansion = motion.expansion; expansionVelocity = motion.expansionVelocity;
      paint();
    }
    f?.lens.cancel(); f?.track?.cancel();
  }
  function fly() {
    cancelAnimationFrame(motionFrame); motionFrame = 0; lastTime = 0;
    if (!current || !target) return;
    if (!lens.animate) { motionFrame = requestAnimationFrame(tick); return; }
    // Same 1/60 s steps and settle thresholds as tick().
    const steps: Motion[] = [{ rect: { ...current }, velocity: { ...velocity }, expansion, expansionVelocity }];
    for (let moving = true; moving;) {
      const prev = steps[steps.length - 1], rect = { ...prev.rect }, speed = { ...prev.velocity };
      moving = false;
      for (const axis of axes) {
        const next = glassSpring(rect[axis], speed[axis], target[axis], 1 / 60);
        rect[axis] = next.position; speed[axis] = next.velocity;
        moving ||= Math.abs(next.position - target[axis]) > .08 || Math.abs(next.velocity) > .8;
      }
      const body = glassSpring(prev.expansion, prev.expansionVelocity, 0, 1 / 60);
      const bodyMoving = Math.abs(body.position) > .0001 || Math.abs(body.velocity) > .002;
      steps.push(moving
        ? { rect, velocity: speed, expansion: bodyMoving ? body.position : 0, expansionVelocity: bodyMoving ? body.velocity : 0 }
        : { rect: { ...target }, velocity: zeroVelocity(), expansion: bodyMoving ? body.position : 0, expansionVelocity: bodyMoving ? body.velocity : 0 });
      moving ||= bodyMoving;
    }
    // Settled within one step, as tick() would: no animation, and the flag reads settled.
    if (steps.length === 2) { ground(steps[1]); root.dataset.glassMoving = "false"; return; }
    const size = target;
    transformLayer?.cancel(); trackLayer?.cancel(); transformLayer = trackLayer = undefined;
    const timing = { duration: (steps.length - 1) * frameMs, easing: "linear", fill: "forwards" as const };
    const f: Flight = {
      steps, held: 0,
      lens: lens.animate(steps.map(step => ({ transform: lensTransform(step.rect, step.velocity, size) })), timing),
      track: track?.animate(steps.map(step => ({ transform: trackTransform(step.expansion) })), timing),
    };
    flight = f;
    f.lens.onfinish = () => {
      if (flight !== f) return;
      ground(steps[steps.length - 1]);
      root.dataset.glassMoving = "false";
    };
    root.dataset.glassMoving = "true";
    handOff(f);
  }
  function tick(now: number) {
    motionFrame = 0;
    if (disposed || !current || !target) return;
    const dt = lastTime ? (now - lastTime) / 1000 : 1 / 60;
    lastTime = now;
    let moving = false;
    if (!drag?.engaged) for (const axis of axes) {
      const next = glassSpring(current[axis], velocity[axis], target[axis], dt);
      current[axis] = next.position; velocity[axis] = next.velocity;
      moving ||= Math.abs(next.position - target[axis]) > .08 || Math.abs(next.velocity) > .8;
    }
    if (!drag?.engaged && (!moving || reduced.matches)) { current = { ...target }; velocity = zeroVelocity(); }
    const stretchTarget = drag?.engaged && !reduced.matches ? .018 + Math.min(.035, Math.abs(velocity.x) / 50000) : 0;
    const body = glassSpring(expansion, expansionVelocity, stretchTarget, dt);
    expansion = body.position; expansionVelocity = body.velocity;
    const bodyMoving = Math.abs(expansion - stretchTarget) > .0001 || Math.abs(expansionVelocity) > .002;
    if (!bodyMoving || reduced.matches) { expansion = stretchTarget; expansionVelocity = 0; }
    moving ||= bodyMoving;
    paint();
    const active = String(moving && !reduced.matches);
    if (root.dataset.glassMoving !== active) root.dataset.glassMoving = active;
    if (moving && !reduced.matches) motionFrame = requestAnimationFrame(tick);
    else lastTime = 0;
  }
  function moveTo(item: HTMLElement, value: string) {
    const next = rect(item);
    destination = value;
    const changed = !target || axes.some(axis => next[axis] !== target![axis]);
    // Layout/config notifications re-measure the same tab; the running flight already lands there.
    // A repeat tap or the drag-release click may have advanced the navigation sequence: re-record the handoff.
    if (flight && !changed) { handOff(flight); return; }
    ground(flight && sampleFlight(flight));
    if (changed && current && !reduced.matches) expansionVelocity = Math.min(3, expansionVelocity + 2.8);
    if (!current) {
      const from = config.fromValue ? nodes()[config.values.indexOf(config.fromValue)] : undefined;
      const flight = navigationFlight;
      // The logic layer has already validated/consumed this navigation intent.
      // A second, shorter clock would discard a valid flight on a cold page.
      if (config.variant === "navigation" && config.fromValue && flight?.from === config.fromValue && flight.value === value && flight.sequence === navigationSequence && Math.abs(flight.width - root.clientWidth) < 1) {
        const motion = "steps" in flight.motion ? sampleFlight(flight.motion) : flight.motion;
        current = { ...motion.rect }; velocity = { ...motion.velocity };
        expansion = motion.expansion; expansionVelocity = motion.expansionVelocity;
        navigationFlight = undefined;
      } else {
        current = from ? rect(from) : { ...next };
        if (from && !reduced.matches) expansionVelocity = 2.8;
      }
    }
    target = next;
    Object.assign(lens.style, { visibility: "visible", width: next.width + "px", height: next.height + "px" });
    if (reduced.matches) { current = { ...next }; velocity = zeroVelocity(); expansion = expansionVelocity = 0; }
    paint();
    if ((changed || axes.some(axis => Math.abs(current![axis] - next[axis]) > .08) || Math.abs(expansion) > .0001 || Math.abs(expansionVelocity) > .002) && !reduced.matches && !drag?.engaged) fly();
  }
  function measure() {
    frame = 0;
    if (disposed || !root.offsetWidth) return;
    // The view responds before the logic thread can commit the new model.
    // Font/layout/config notifications must not retarget that flight to the old tab.
    const selected = pendingNavigation[pendingNavigation.length - 1] ?? config.value;
    const items = nodes(), item = items[config.values.indexOf(selected)];
    const last = items[items.length - 1];
    // An equal filter whose one-line labels cannot fit scrolls like a scroll rail (glass-segments.vue).
    const overflow = config.layout === "equal" && config.variant !== "navigation" && root.scrollWidth > root.clientWidth + 1;
    if (root.dataset.glassOverflow !== String(overflow)) root.dataset.glassOverflow = String(overflow);
    maxTrackScroll = (config.layout === "scroll" || overflow) && last
      ? Math.max(0, last.offsetLeft + last.offsetWidth + parseFloat(getComputedStyle(root).paddingRight || "0") - root.clientWidth) : 0;
    if (!lens) return;
    if (!item) { ground(); lens.style.visibility = "hidden"; current = target = undefined; return; }
    if (!drag?.engaged) moveTo(item, selected);
    if ((config.layout === "scroll" || overflow) && (item.offsetLeft < root.scrollLeft || item.offsetLeft + item.offsetWidth > root.scrollLeft + root.clientWidth)) {
      root.scrollLeft = Math.max(0, item.offsetLeft - (root.clientWidth - item.offsetWidth) / 2);
    }
  }
  function schedule() { if (!disposed && !frame) frame = requestAnimationFrame(measure); }
  function onClick(event: MouseEvent) {
    if (suppressClick && event.detail > 0) { suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); return; }
    const item = (event.target as Element).closest<HTMLElement>(".nx-glass-option");
    if (item?.parentElement === root && enabled(item)) {
      // App pages have separate renderjs contexts. Only the arriving page owns
      // a tap animation; starting here as well would replay it after reLaunch.
      if (config.variant === "navigation" && config.navigationOnArrival) return;
      if (config.variant === "navigation") {
        const value = item.dataset.glassValue!;
        if ((pendingNavigation.length || value !== config.value) && pendingNavigation[pendingNavigation.length - 1] !== value) pendingNavigation.push(value);
      }
      if (config.variant === "navigation" && item.dataset.glassValue !== config.value) outgoingSequence = ++navigationSequence;
      moveTo(item, item.dataset.glassValue!);
    }
  }
  function onDown(event: PointerEvent) {
    suppressClick = false;
    if (!event.isPrimary || event.button !== 0 || config.layout !== "equal" || root.dataset.glassOverflow === "true") return;
    const item = (event.target as Element).closest<HTMLElement>(".nx-glass-option");
    if (item?.parentElement !== root || !enabled(item)) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, at: event.timeStamp, engaged: false };
  }
  function onMove(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId || !current || !target) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.engaged) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { drag = undefined; return; }
      if (Math.abs(dx) < 8) return;
      drag.engaged = true; root.setPointerCapture(event.pointerId);
      ground(flight && sampleFlight(flight));
      cancelAnimationFrame(motionFrame); motionFrame = 0; lastTime = 0;
    }
    event.preventDefault();
    const items = nodes().filter(enabled);
    if (!items.length) { endDrag(event); return; }
    const left = items[0].offsetLeft, last = items[items.length - 1];
    current.x = Math.max(left, Math.min(last.offsetLeft + last.offsetWidth - current.width, event.clientX - root.getBoundingClientRect().left + root.scrollLeft - current.width / 2));
    velocity.x = Math.max(-1800, Math.min(1800, (event.clientX - drag.lastX) / Math.max(8, event.timeStamp - drag.at) * 1000));
    drag.lastX = event.clientX; drag.at = event.timeStamp;
    if (root.dataset.glassDragging !== "true") root.dataset.glassDragging = "true";
    paint();
    if (!motionFrame) motionFrame = requestAnimationFrame(tick);
  }
  function endDrag(event: PointerEvent) {
    // Touch initially captures on the pressed child. Its handoff to this root
    // bubbles a lostpointercapture event; only losing our own capture cancels.
    if (event.type === "lostpointercapture" && event.target !== root) return;
    if (!drag || drag.id !== event.pointerId) return;
    const engaged = drag.engaged;
    drag = undefined; root.dataset.glassDragging = "false";
    if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
    if (!engaged || !current) return;
    suppressClick = true;
    const bounds = root.getBoundingClientRect();
    if (event.type !== "pointerup" || event.clientY < bounds.top - 24 || event.clientY > bounds.bottom + 24) { schedule(); return; }
    const center = current.x + current.width / 2;
    const items = nodes().filter(enabled);
    if (!items.length) { schedule(); return; }
    const item = items.reduce((best, el) => Math.abs(el.offsetLeft + el.offsetWidth / 2 - center) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - center) ? el : best);
    moveTo(item, item.dataset.glassValue!);
    item.dataset.glassActivation = "drag";
    item.focus({ preventScroll: true });
    item.click(); // The Vue owner commits once; drag previews never change business state.
    delete item.dataset.glassActivation;
  }
  function onArrow(event: KeyboardEvent) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (["Enter", " ", "Spacebar"].includes(event.key)) {
      const item = nodes().find(el => el === event.target);
      if (!item) return;
      if (config.variant === "navigation" && event.key !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat && item.getAttribute("aria-disabled") !== "true") item.click();
      return;
    }
    const keys = config.layout === "vertical" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
    if (![...keys, "Home", "End"].includes(event.key)) return;
    const items = nodes().filter(el => el.getAttribute("aria-disabled") !== "true");
    const current = items.indexOf(event.target as HTMLElement);
    if (current < 0) return;
    event.preventDefault();
    event.stopPropagation();
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === keys[1] ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
    if (config.variant !== "navigation" && items[next]) {
      items[next].dataset.glassKeyboard = "arrow";
      items[next].click();
      delete items[next].dataset.glassKeyboard;
    }
  }
  const resize = new ResizeObserver(schedule);
  function observe() { resize.disconnect(); resize.observe(root); nodes().forEach(el => resize.observe(el)); }
  const stopMotion = () => {
    ground(flight && sampleFlight(flight));
    cancelAnimationFrame(motionFrame); motionFrame = 0; lastTime = 0;
    expansion = expansionVelocity = 0;
    if (target) { current = { ...target }; velocity = zeroVelocity(); paint(); }
    root.dataset.glassMoving = "false"; schedule();
  };
  root.addEventListener("keydown", onArrow);
  root.addEventListener("scroll", paint, { passive: true });
  root.addEventListener("click", onClick, true);
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove, { passive: false });
  root.addEventListener("pointerup", endDrag);
  root.addEventListener("pointercancel", endDrag);
  root.addEventListener("lostpointercapture", endDrag);
  reduced.addEventListener("change", stopMotion);
  void document.fonts?.ready.then(schedule);
  observe(); schedule();
  return {
    update(value: SegmentsConfiguration) {
      if (value.value !== config.value && pendingNavigation.length) {
        const committed = pendingNavigation.indexOf(value.value);
        // A queued earlier tap can commit before the newest one. An unrelated
        // model value is an authoritative redirect; the newest tap ends the queue.
        if (committed < 0 || value.value === pendingNavigation[pendingNavigation.length - 1]) pendingNavigation = [];
        else pendingNavigation.splice(0, committed + 1);
      }
      config = value; observe(); schedule();
    },
    destroy() {
      disposed = true; cancelAnimationFrame(frame); cancelAnimationFrame(motionFrame); ground(); transformLayer?.cancel(); trackLayer?.cancel(); resize.disconnect();
      root.removeEventListener("keydown", onArrow); root.removeEventListener("click", onClick, true);
      root.removeEventListener("scroll", paint);
      root.removeEventListener("pointerdown", onDown); root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerup", endDrag); root.removeEventListener("pointercancel", endDrag); root.removeEventListener("lostpointercapture", endDrag);
      reduced.removeEventListener("change", stopMotion);
    },
  };
}

export interface ChassisConfiguration {
  hostId?: string; tabKey?: string; tabRevision?: number; visible?: boolean; debug?: boolean; scrollKey?: string;
  memoryKey?: string; pageVisit?: number; visit?: string; isRefreshing?: boolean; scrollLocks?: number; pullInset?: number;
}

export function mountChassis(root: HTMLElement, initial: ChassisConfiguration = {}, notifyScrollBottom?: (key: string) => void,
  notifyScrolling?: (value: boolean) => void, notifyRefresh?: (visit: string) => void) {
  const scroll = root.querySelector<HTMLElement>(".nx-content")!;
  const indicator = scroll.querySelector<HTMLElement>(".nx-refresher")!;
  const icon = indicator.querySelector<HTMLElement>(".nx-refresher-icon")!;
  const wrapper = indicator.nextElementSibling as HTMLElement;
  let config = initial;
  let tabKey = initial.tabKey;
  let tabRevision = initial.tabRevision;
  let visible = initial.visible ?? true;
  let scrollKey = initial.scrollKey;
  let detachPagination = () => {};
  const physicalTop = () => normalizedScrollTop(scroll.scrollTop, scroll.scrollHeight - scroll.clientHeight);
  let pageTop = initial.memoryKey ? getScrollPos(initial.memoryKey) ?? physicalTop() : physicalTop();
  let pendingTop: number | null = null;
  let restoreFrame = 0;
  const tabPositions = new Map<string, { href: string; top: number }>();
  let hidden = scroll.scrollTop > 8;
  let scrolling = false;
  let touching = false;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let startY: number | null = null;
  let pullY = 0, pulling = false, pullActive = false, awaitingRefresh = false;
  let deactivate: ReturnType<typeof setTimeout> | undefined;
  let pullHeader: HTMLElement | null = null;
  let headerHeight = 0;
  const spring = "transform .28s cubic-bezier(.16,1,.3,1)";
  const trace = (event: string) => {
    if (config.debug) console.info("UvelScroll", JSON.stringify({ event, visible, pending: pendingTop !== null,
      target: pendingTop, top: scroll.scrollTop, max: Math.max(0, scroll.scrollHeight - scroll.clientHeight) }));
  };
  const tabLayoutReady = () => {
    const contents = Array.from(root.querySelectorAll<HTMLElement>(".nx-tab-content"));
    if (!contents.length) return true;
    const shown = contents.filter(content => content.getClientRects().length > 0);
    return shown.length === 1 && shown[0].dataset.tabContentKey === tabKey;
  };
  const viewReady = () => visible && root.dataset.pageVisible !== "false"
    && (root.dataset.pageVisit === undefined || root.dataset.pageVisit === String(config.pageVisit))
    && (root.dataset.tabKey === undefined || root.dataset.tabKey === tabKey)
    && (root.dataset.tabRevision === undefined || root.dataset.tabRevision === String(tabRevision))
    && tabLayoutReady() && root.getClientRects().length > 0 && document.visibilityState !== "hidden";
  function paintPull() {
    const refreshing = config.isRefreshing || awaitingRefresh;
    const y = refreshing ? 56 : pullY;
    const active = pullActive && !config.scrollLocks;
    indicator.style.top = `${(config.pullInset ?? 0) + headerHeight}px`;
    indicator.style.transform = `translate(-50%, ${y / 2 - 18}px)`;
    indicator.style.opacity = refreshing || pullY > 6 ? "1" : "0";
    indicator.style.transition = pulling ? "opacity .15s" : `${spring}, opacity .2s`;
    icon.classList.toggle("nx-spinning", !!refreshing);
    icon.style.transform = refreshing ? "" : `rotate(${Math.min(1, pullY / 70) * 270}deg)`;
    wrapper.style.transform = active ? `translateY(${y}px)` : "";
    wrapper.style.transition = active ? (pulling ? "none" : spring) : "";
    wrapper.style.willChange = active ? "transform" : "";
    if (pullHeader) {
      pullHeader.style.transform = active ? `translateY(${-y}px)` : "";
      pullHeader.style.transition = active ? (pulling ? "none" : spring) : "";
    }
  }
  function resetPull(immediate = false) {
    startY = null; pullY = 0; pulling = false; awaitingRefresh = false;
    clearTimeout(deactivate);
    if (immediate) pullActive = false;
    else deactivate = setTimeout(() => { pullActive = false; paintPull(); }, 340);
    paintPull();
  }
  function cancelPull() {
    // A second finger can invalidate the origin while feedback is still drawn.
    // Submitted refresh holds are released only by the business refresh state.
    if (!awaitingRefresh && !config.isRefreshing && (startY !== null || pullActive)) resetPull();
  }
  function setScrolling(value: boolean) {
    if (scrolling === value) return;
    scrolling = value;
    root.dataset.scrolling = String(value);
    notifyScrolling?.(value);
  }
  function scheduleIdle() {
    clearTimeout(idle);
    idle = setTimeout(() => { if (!touching) { setScrolling(false); trace("capture"); } }, 200);
  }
  function finishTouch() { touching = false; if (scrolling) scheduleIdle(); }
  function stopScrolling() { touching = false; clearTimeout(idle); setScrolling(false); }
  const remember = () => {
    if (!viewReady() || pendingTop !== null) return;
    pageTop = physicalTop();
    if (config.memoryKey) saveScrollPos(config.memoryKey, pageTop, scroll.scrollHeight - scroll.clientHeight);
    if (tabKey) tabPositions.set(tabKey.split("?")[0], { href: tabKey, top: pageTop });
  };
  const markScroll = () => {
    if (!viewReady()) return;
    remember();
    setScrolling(true);
    scheduleIdle();
    onScroll();
  };
  function onScroll() {
    const top = physicalTop();
    root.dataset.scrolled = String(top > 16);
    hidden = glassLogoHidden(top, hidden);
    for (const title of Array.from(root.querySelectorAll<HTMLElement>(".nx-header__l, .spv-titlewrap, .nx-nav-titlewrap"))) {
      const value = String(hidden && title.dataset.persistent !== "true");
      if (title.dataset.hidden !== value) title.dataset.hidden = value;
      if (title.getAttribute("aria-hidden") !== value) title.setAttribute("aria-hidden", value);
    }
  }
  function attemptRestore() {
    if (pendingTop === null || !viewReady()) return;
    const target = pendingTop;
    // A short first layout can still be waiting for data or image dimensions.
    // Keep its saved destination without repeatedly writing an unreachable top.
    if (target > Math.max(0, scroll.scrollHeight - scroll.clientHeight)) return;
    scroll.scrollTop = target;
    if (Math.abs(scroll.scrollTop - target) < 1) pendingTop = null;
    trace(pendingTop === null ? "restored" : "restore-pending");
    onScroll();
  }
  function scheduleRestore() {
    if (pendingTop === null || restoreFrame) return;
    restoreFrame = requestAnimationFrame(() => { restoreFrame = 0; attemptRestore(); });
  }
  const restore = () => {
    const saved = tabKey ? tabPositions.get(tabKey.split("?")[0]) : undefined;
    pendingTop = tabKey ? (saved && saved.href === tabKey ? saved.top : 0) : pageTop;
    if (tabKey && (!saved || saved.href !== tabKey)) tabPositions.set(tabKey.split("?")[0], { href: tabKey, top: pendingTop });
    attemptRestore(); scheduleRestore();
  };
  const cancelRestore = () => {
    if (pendingTop === null) return;
    pendingTop = null;
    cancelAnimationFrame(restoreFrame); restoreFrame = 0;
    remember(); trace("user-cancel");
  };
  const requestTop = () => {
    if (!viewReady()) return;
    cancelRestore();
    pageTop = 0;
    if (config.memoryKey) saveScrollPos(config.memoryKey, 0, scroll.scrollHeight - scroll.clientHeight);
    if (tabKey) tabPositions.set(tabKey.split("?")[0], { href: tabKey, top: 0 });
  };
  const keyScroll = (event: KeyboardEvent) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) cancelRestore(); };
  const inside = (touch: Touch) => {
    const rect = scroll.getBoundingClientRect();
    return touch.clientX >= rect.left && touch.clientX <= rect.right && touch.clientY >= rect.top && touch.clientY <= rect.bottom;
  };
  const touchStart = (event: TouchEvent) => {
    touching = true;
    cancelRestore();
    if (!viewReady() || config.scrollLocks || config.isRefreshing || awaitingRefresh || scroll.scrollTop > 0 || event.touches.length !== 1) { cancelPull(); startY = null; return; }
    startY = event.touches[0].clientY;
  };
  const touchMove = (event: TouchEvent) => {
    if (startY === null) return;
    if (!viewReady() || config.scrollLocks || event.touches.length !== 1 || !inside(event.touches[0])) { resetPull(); return; }
    const dy = event.touches[0].clientY - startY;
    if (dy <= 0) { pullY = 0; pulling = false; paintPull(); return; }
    if (!pulling) {
      pullHeader = Array.from(scroll.querySelectorAll<HTMLElement>(".spv")).find(header => header.getClientRects().length > 0) ?? null;
      headerHeight = pullHeader ? pullHeader.getBoundingClientRect().height + (parseFloat(getComputedStyle(pullHeader).marginBottom) || 0) : 0;
    }
    clearTimeout(deactivate);
    pulling = true; pullActive = true; pullY = Math.min(110, dy * 0.5);
    paintPull();
  };
  const touchEnd = (event: TouchEvent) => {
    finishTouch();
    if (startY === null) { cancelPull(); return; }
    const touch = event.changedTouches[0];
    if (!touch || !inside(touch) || !viewReady() || config.scrollLocks || config.isRefreshing || pullY < 70) { resetPull(); return; }
    startY = null; pulling = false; awaitingRefresh = true;
    paintPull();
    notifyRefresh?.(config.visit ?? "");
  };
  const touchCancel = () => { finishTouch(); cancelPull(); };
  scroll.addEventListener("scroll", markScroll, { passive: true });
  scroll.addEventListener("touchstart", touchStart, { passive: true });
  scroll.addEventListener("touchmove", touchMove, { passive: true });
  scroll.addEventListener("touchend", touchEnd, { passive: true });
  scroll.addEventListener("touchcancel", touchCancel, { passive: true });
  const cancelEvents = ["wheel", "pointerdown"];
  for (const event of cancelEvents) scroll.addEventListener(event, cancelRestore, { passive: true });
  scroll.addEventListener("uvel-scroll-to-top", requestTop);
  root.addEventListener("keydown", keyScroll);
  const layoutChanged = () => {
    const revision = Number(root.dataset.tabRevision);
    if (root.dataset.tabKey !== undefined && root.dataset.tabRevision !== undefined
      && (tabRevision === undefined || revision >= tabRevision)
      && (root.dataset.tabKey !== tabKey || revision !== tabRevision)) {
      resetPull(true); stopScrolling();
      tabKey = root.dataset.tabKey; tabRevision = revision; restore();
    }
    if (!viewReady()) { resetPull(true); stopScrolling(); }
    attemptRestore(); onScroll(); scheduleRestore();
  };
  const observer = new MutationObserver(records => {
    // Pull styles are owned here; they must not trigger full-shell layout work
    // on every finger movement (nor observe their own writes in a loop).
    if (records.some(record => record.type !== "attributes"
      || ![indicator, icon, wrapper, pullHeader].includes(record.target as HTMLElement))) layoutChanged();
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-page-visible", "data-page-visit", "data-tab-key", "data-tab-revision", "data-tab-content-key", "style", "class"] });
  const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(layoutChanged);
  resize?.observe(scroll);
  const body = scroll.querySelector<HTMLElement>(".nx-page-enter");
  if (body) resize?.observe(body);
  if (initial.memoryKey && getScrollPos(initial.memoryKey) !== undefined) restore();
  onScroll(); paintPull();
  const documentVisibility = () => {
    if (document.visibilityState === "visible" && visible) restore();
    else { resetPull(true); stopScrolling(); }
  };
  const interrupted = () => { finishTouch(); cancelPull(); };
  document.addEventListener("visibilitychange", documentVisibility);
  window.addEventListener("blur", interrupted);
  const bindPagination = () => {
    detachPagination();
    const key = scrollKey;
    if (!key || !notifyScrollBottom) return;
    detachPagination = attachManualScrollLoadMore({ closest: () => scroll }, {
      enabled: () => viewReady() && pendingTop === null,
      hasMore: () => true, loading: () => false,
      loadMore: async () => { notifyScrollBottom(key); },
    });
  };
  bindPagination();
  return { update(value: ChassisConfiguration = {}) {
    if (value.tabRevision !== undefined && tabRevision !== undefined && value.tabRevision < tabRevision) return;
    const shown = (value.visible ?? true) && (!visible || value.pageVisit !== config.pageVisit);
    const changed = value.tabKey !== tabKey || value.tabRevision !== tabRevision;
    const finished = config.isRefreshing && !value.isRefreshing;
    const interrupted = value.visit !== config.visit || changed || !(value.visible ?? true) || !!value.scrollLocks;
    config = value;
    visible = value.visible ?? true;
    if (interrupted) { resetPull(true); stopScrolling(); }
    else if (finished) resetPull();
    else if (value.isRefreshing) { awaitingRefresh = false; paintPull(); }
    else paintPull();
    if (value.scrollKey !== scrollKey) { scrollKey = value.scrollKey; bindPagination(); }
    if (changed || shown) {
      tabKey = value.tabKey; tabRevision = value.tabRevision; restore();
    }
    trace(visible ? "show-update" : "hide-update");
    onScroll();
  }, destroy() {
    detachPagination(); clearTimeout(idle); clearTimeout(deactivate); cancelAnimationFrame(restoreFrame);
    tabPositions.clear();
    scroll.removeEventListener("scroll", markScroll);
    scroll.removeEventListener("touchstart", touchStart); scroll.removeEventListener("touchmove", touchMove);
    scroll.removeEventListener("touchend", touchEnd); scroll.removeEventListener("touchcancel", touchCancel);
    for (const event of cancelEvents) scroll.removeEventListener(event, cancelRestore);
    scroll.removeEventListener("uvel-scroll-to-top", requestTop); root.removeEventListener("keydown", keyScroll);
    observer.disconnect(); resize?.disconnect();
    document.removeEventListener("visibilitychange", documentVisibility); window.removeEventListener("blur", interrupted);
  } };
}

// App renderjs mounts a separate empty Vue instance: its $el is a comment.
// Explicit host IDs work on both App's view thread and H5's renderjs mixin.
type ViewInstance = { $ownerInstance?: { callMethod(name: string, value: unknown): void } };
function viewAdapter<T extends { hostId?: string }>(mount: (host: HTMLElement, value: T, instance: ViewInstance) => { update(value: T): void; destroy(): void }) {
  const states = new WeakMap<object, { value: T; frame: number; controller?: ReturnType<typeof mount> }>();
  function schedule(instance: ViewInstance) {
    const state = states.get(instance);
    if (!state || state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      if (!states.has(instance)) return;
      const host = state.value.hostId ? document.getElementById(state.value.hostId) : null;
      if (!host) return;
      if (state.controller) state.controller.update(state.value);
      else state.controller = mount(host, state.value, instance);
    });
  }
  return {
    mounted(this: object) { schedule(this); },
    beforeUnmount(this: object) { const state = states.get(this); if (state) { cancelAnimationFrame(state.frame); state.controller?.destroy(); states.delete(this); } },
    methods: {
      update(this: object, value: T) {
        const state = states.get(this);
        if (state) state.value = value;
        else states.set(this, { value, frame: 0 });
        schedule(this);
      },
    },
  };
}
export default viewAdapter<GlassConfiguration>(mountLiquidGlass);
export const segmentsView = viewAdapter<SegmentsConfiguration>(mountSegments);
export const chassisView = viewAdapter<ChassisConfiguration>((host, value, instance) =>
  mountChassis(host, value,
    key => instance.$ownerInstance?.callMethod("onNativeScrollLoadMore", key),
    scrolling => instance.$ownerInstance?.callMethod("onChassisScrolling", scrolling),
    visit => instance.$ownerInstance?.callMethod("onChassisRefresh", visit)));
