import { diagnosticHref } from "./ios-diagnostics-route";

type Reader = { read(): unknown; reset(): void };
const chassisReaders = new Map<string, Reader>();
export function registerChassisDiagnostics(hostId: string, reader: Reader) {
  chassisReaders.set(hostId, reader);
  return () => { chassisReaders.delete(hostId); };
}

export interface DiagnosticConfiguration { hostId: string; snapshot: unknown; }
type Control = { action: "open" | "close" | "reset" };
const hosts = new Map<string, { root: HTMLElement; notify(value: Control): void; resetIncident(): void }>();
let activeHost: string | null = null;
let opened = false;
let snapshot: unknown = null;
let openingEvidence: unknown = null;
let latestHost: string | null = null;
let latestSnapshot: unknown = null;
let fingerCount = 0;
let noFingerSince = Date.now();
let incidentSerial = 0;
const incidents: { id: number; snapshot: unknown }[] = [];
const accessibleNodes = new Map<string, HTMLElement[]>();
const statistics = { samples: 0, totalMs: 0, maxMs: 0, lastMs: 0, lastCharacters: 0, labelWrites: 0 };

const selectors = [
  ".nx-mask--confirm", ".nx-mask--neterr", ".nx-modal", ".ps-root", ".ps-mask", ".ps-sheet",
  ".invite-detail", ".invite-detail__mask", ".invite-detail__sheet", ".nx-sheet-mask", ".nx-sheet",
  ".tcs-root", ".tcs-backdrop", ".tcs-panel", ".vcs-root", ".vcs-backdrop", ".vcs-panel",
  ".sas-root", ".sas-backdrop", ".sas-panel", ".lss-root", ".lss-backdrop", ".lss-panel",
  ".tis-root", ".tis-backdrop", ".tis-panel", ".ms-overlay", ".ms-backdrop", ".ms-card",
  ".payment-pin-mask", ".payment-pin-sheet", ".pp-mask", "#pp-sheet", "#pp-page", ".pp-cashier",
  ".nx-notice-mask", ".nx-notice", ".ss-root",
];
const styleKeys = ["display", "visibility", "opacity", "position", "z-index", "pointer-events", "overflow-x", "overflow-y",
  "transform", "transition", "filter", "backdrop-filter", "-webkit-backdrop-filter", "animation-name", "animation-duration", "animation-fill-mode", "animation-play-state"];
function identity(element: Element) {
  return { tag: element.tagName, id: element.id, class: element.getAttribute("class"), role: element.getAttribute("role") };
}
function geometry(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom,
    left: rect.left, right: rect.right, rectCount: element.getClientRects().length };
}
function ancestry(element: Element | null) {
  const ancestors = [];
  for (let node = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    ancestors.push({ ...identity(node), transform: style.transform, filter: style.filter,
      backdropFilter: style.getPropertyValue("backdrop-filter") || style.getPropertyValue("-webkit-backdrop-filter"),
      display: style.display, visibility: style.visibility, opacity: style.opacity });
    if (node.matches(".nx-chassis")) break;
  }
  return ancestors;
}
function elementEvidence(element: HTMLElement) {
  const style = getComputedStyle(element);
  const tab = element.closest<HTMLElement>(".nx-tab-content");
  return { ...identity(element), hostId: element.closest(".nx-chassis")?.id ?? null,
    tab: tab ? { key: diagnosticHref(tab.dataset.tabContentKey ?? ""), rect: geometry(tab), display: getComputedStyle(tab).display } : null,
    rect: geometry(element), style: Object.fromEntries(styleKeys.map(key => [key, style.getPropertyValue(key)])),
    inlineMotion: { transform: element.style.transform, transition: element.style.transition },
    ancestors: ancestry(element),
    animations: typeof element.getAnimations === "function" ? element.getAnimations().map(animation => ({
      name: (animation as CSSAnimation).animationName ?? null, currentTime: animation.currentTime, playState: animation.playState })) : null };
}
function hitEvidence(points: { x: number; y: number }[]) {
  return { sampledAt: new Date().toISOString(), points: points.map(point => ({ ...point,
    first: ancestry(document.elementFromPoint(point.x, point.y)),
    stack: document.elementsFromPoint(point.x, point.y).map(element => identity(element)),
  })) };
}
function readViewDiagnostics() {
  return { sampledAt: new Date().toISOString(), fingers: { count: fingerCount, noFingerSince }, visibility: document.visibilityState,
    viewport: { width: innerWidth, height: innerHeight, visual: window.visualViewport ? {
      width: visualViewport!.width, height: visualViewport!.height, offsetTop: visualViewport!.offsetTop,
      offsetLeft: visualViewport!.offsetLeft, scale: visualViewport!.scale } : null },
    chassis: Array.from(document.querySelectorAll<HTMLElement>(".nx-chassis"), root => ({ id: root.id,
      tabKey: diagnosticHref(root.dataset.tabKey ?? ""), tabRevision: root.dataset.tabRevision, pageVisible: root.dataset.pageVisible,
      rect: geometry(root), tabs: Array.from(root.querySelectorAll<HTMLElement>(".nx-tab-content"), tab => ({
        key: diagnosticHref(tab.dataset.tabContentKey ?? ""), rect: geometry(tab), display: getComputedStyle(tab).display })),
      scroll: Array.from(root.querySelectorAll<HTMLElement>(".nx-content"), scroll => ({ ...elementEvidence(scroll),
        rawTop: scroll.scrollTop, scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight,
        max: Math.max(0, scroll.scrollHeight - scroll.clientHeight),
        wrappers: Array.from(scroll.querySelectorAll<HTMLElement>(".nx-page-enter"), page => ({
          page: elementEvidence(page), wrapper: page.parentElement ? elementEvidence(page.parentElement) : null })) })),
    })),
    overlays: Array.from(document.querySelectorAll<HTMLElement>(selectors.join(",")), element => elementEvidence(element)),
    restore: Array.from(chassisReaders, ([hostId, reader]) => ({ hostId, state: reader.read() })),
  };
}
function publish() {
  document.dispatchEvent(new CustomEvent("uvel-ios-diagnostics", { detail: { open: opened, hostId: activeHost, snapshot } }));
}
function close() {
  if (!opened) return;
  opened = false;
  if (activeHost) hosts.get(activeHost)?.notify({ action: "close" });
  snapshot = null;
  openingEvidence = null;
  publish();
}
function reset() {
  const hostId = activeHost ?? latestHost;
  if (!hostId) return;
  incidents.length = 0;
  for (const [key, nodes] of accessibleNodes) if (key.startsWith("diag-incident:")) { nodes.forEach(node => node.remove()); accessibleNodes.delete(key); }
  hosts.forEach(host => host.resetIncident());
  chassisReaders.forEach(reader => reader.reset());
  hosts.get(hostId)?.notify({ action: "reset" });
}
function touchStart(event: TouchEvent) {
  fingerCount = event.touches.length; noFingerSince = 0;
  if (event.touches.length !== 3) return;
  if (opened) { close(); return; }
  const host = Array.from(hosts.entries()).reverse().find(([, entry]) => entry.root.dataset.pageVisible !== "false" && entry.root.getClientRects().length > 0);
  if (!host) return;
  activeHost = host[0];
  // Capture before publishing open: a future panel must never contaminate the hit sample.
  openingEvidence = { hits: hitEvidence([...Array.from(event.touches, touch => ({ x: touch.clientX, y: touch.clientY })),
    { x: innerWidth / 2, y: innerHeight / 2 }, { x: innerWidth / 2, y: Math.max(0, innerHeight - 100) }]),
    view: readViewDiagnostics() };
  opened = true;
  publish();
  host[1].notify({ action: "open" });
}

function touchEnd(event: TouchEvent) {
  fingerCount = event.touches.length;
  if (!fingerCount) noFingerSince = Date.now();
}

// Follow-up 1 explicitly prescribes invisible, accessibility-readable output.
// Each node is initialized once; subsequent sampling changes only its aria-label.
function writeAccessible(root: HTMLElement, prefix: string, value: unknown) {
  const content = `at=${new Date().toISOString()};data=${JSON.stringify(value)}`;
  const chunks = content.match(/[\s\S]{1,750}/g) ?? [""];
  const nodes = accessibleNodes.get(prefix) ?? [];
  while (nodes.length > chunks.length) nodes.pop()!.remove();
  chunks.forEach((chunk, index) => {
    let node = nodes[index];
    if (!node) {
      node = document.createElement("div");
      node.setAttribute("role", "note");
      node.style.cssText = "position:absolute;width:1px;height:1px;top:0;left:0;opacity:0;overflow:hidden;pointer-events:none";
      nodes.push(node);
    }
    if (node.parentElement !== root) root.appendChild(node);
    node.setAttribute("aria-label", `${prefix}${index + 1}/${chunks.length} ${chunk}`);
    statistics.labelWrites += 1;
  });
  accessibleNodes.set(prefix, nodes);
  return content.length;
}

const maskPairs = [
  [".nx-mask--confirm", ".nx-mask--confirm", ".nx-modal"], [".nx-mask--neterr", ".nx-mask--neterr", ".nx-modal"],
  [".ps-mask", ".ps-root", ".ps-sheet"], [".invite-detail__mask", ".invite-detail", ".invite-detail__sheet"],
  [".nx-sheet-mask", ".nx-sheet-mask", ".nx-sheet"], [".tcs-backdrop", ".tcs-root", ".tcs-panel"],
  [".vcs-backdrop", ".vcs-root", ".vcs-panel"], [".sas-backdrop", ".sas-root", ".sas-panel"],
  [".lss-backdrop", ".lss-root", ".lss-panel"], [".tis-backdrop", ".tis-root", ".tis-panel"],
  [".ms-backdrop", ".ms-overlay", ".ms-card"], [".payment-pin-mask", ".payment-pin-mask", ".payment-pin-sheet"],
  [".pp-mask", ".pp-mask", "#pp-sheet"], [".nx-notice-mask", ".nx-notice-mask", ".nx-notice"],
];
function visibleElement(element: HTMLElement | null): element is HTMLElement {
  if (!element || !element.getClientRects().length) return false;
  const rect = element.getBoundingClientRect();
  if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return false;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    if (node.matches(".nx-chassis")) break;
  }
  return true;
}

// Presentation contract for the visual worker: subscribe to uvel-ios-diagnostics,
// render detail.snapshot without editing it, and connect controls to close/reset.
// Only the prescribed hidden output is created here; there is no visible panel, focus change, observer, or animation loop.
export function mountDiagnosticView(root: HTMLElement, initial: DiagnosticConfiguration, notify: (value: Control) => void) {
  let lastAccessibleAt = 0;
  const lockedSince = new Map<string, number>();
  const pendingSince = new Map<string, number>();
  let previousReasons = new Set<string>();
  hosts.set(initial.hostId, { root, notify, resetIncident() { lockedSince.clear(); pendingSince.clear(); previousReasons.clear(); lastAccessibleAt = 0; } });
  if (hosts.size === 1) {
    document.addEventListener("touchstart", touchStart, { capture: true, passive: true });
    document.addEventListener("touchend", touchEnd, { capture: true, passive: true });
    document.addEventListener("touchcancel", touchEnd, { capture: true, passive: true });
    (window as Window & { __uvelIosDiagnostics?: unknown }).__uvelIosDiagnostics = {
      get open() { return opened; }, get snapshot() { return snapshot; }, get liveSnapshot() { return latestSnapshot; },
      get incidents() { return incidents; }, get statistics() { return statistics; }, close, reset,
    };
  }
  return { update(value: DiagnosticConfiguration) {
    if (!value.snapshot) return;
    const now = Date.now();
    if (root.dataset.pageVisible !== "false" && root.getClientRects().length && now - lastAccessibleAt >= 1900) {
      const began = performance.now();
      latestHost = value.hostId;
      for (const [prefix, nodes] of accessibleNodes) if (prefix.startsWith("diag-incident:")) {
        nodes.forEach(node => { if (node.parentElement !== root) root.appendChild(node); });
      }
      const view = readViewDiagnostics();
      latestSnapshot = { logic: value.snapshot, view };
      const reasons: string[] = [];
      const panels = Array.from(document.querySelectorAll<HTMLElement>(maskPairs.map(pair => pair[2]).concat(["#pp-page", ".pp-cashier"]).join(",")));
      const anyPanel = panels.some(visibleElement);
      for (const [maskSelector, ownerSelector, panelSelector] of maskPairs) {
        for (const mask of Array.from(document.querySelectorAll<HTMLElement>(maskSelector))) {
          const rect = mask.getBoundingClientRect();
          if (visibleElement(mask) && rect.left <= 1 && rect.top <= 1 && rect.right >= innerWidth - 1 && rect.bottom >= innerHeight - 1
            && !visibleElement(mask.closest<HTMLElement>(ownerSelector)?.querySelector<HTMLElement>(panelSelector) ?? null)) reasons.push(`a:${maskSelector}`);
        }
      }
      for (const chassis of Array.from(document.querySelectorAll<HTMLElement>(".nx-chassis"))) {
        if (!visibleElement(chassis)) continue;
        const scroll = chassis.querySelector<HTMLElement>(".nx-content");
        if (!scroll) continue;
        const locked = scroll.classList.contains("nx-content--locked") || getComputedStyle(scroll).overflowY === "hidden";
        if (!locked) lockedSince.delete(chassis.id);
        else if (!lockedSince.has(chassis.id)) lockedSince.set(chassis.id, now);
        if (locked && now - lockedSince.get(chassis.id)! > 3000 && !anyPanel) reasons.push(`b:${chassis.id}`);
        const wrapper = scroll.querySelector<HTMLElement>(".nx-page-enter")?.parentElement;
        const transform = wrapper ? getComputedStyle(wrapper).transform : "none";
        const pull = (value.snapshot as { readers: { section: string; state: { chassisHostId?: string; pullActive?: boolean } }[] }).readers
          .find(reader => reader.section === "D1/D2 chassis" && reader.state.chassisHostId === chassis.id)?.state.pullActive;
        if ((pull || (transform !== "none" && !new DOMMatrixReadOnly(transform).isIdentity)) && fingerCount === 0 && noFingerSince && now - noFingerSince > 2000) reasons.push(`d:${chassis.id}`);
      }
      const center = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      if (center?.closest(maskPairs.map(pair => pair[0]).join(",")) && !anyPanel) reasons.push("c:center-mask");
      for (const [hostId, reader] of chassisReaders) {
        const state = reader.read() as { pendingTop: number | null; visible: boolean };
        if (state.pendingTop === null || !state.visible) pendingSince.delete(hostId);
        else if (!pendingSince.has(hostId)) pendingSince.set(hostId, now);
        if (pendingSince.has(hostId) && now - pendingSince.get(hostId)! > 5000) reasons.push(`e:${hostId}`);
      }
      if (reasons.some(reason => !previousReasons.has(reason))) {
        const id = ++incidentSerial;
        const incident = { id, snapshot: { at: new Date().toISOString(), reasons, logic: value.snapshot,
          hits: hitEvidence([{ x: innerWidth / 2, y: innerHeight / 2 }, { x: innerWidth / 2, y: Math.max(0, innerHeight - 100) }]), view: readViewDiagnostics() } };
        incidents.push(incident);
        writeAccessible(root, `diag-incident:${id}:`, incident.snapshot);
        if (incidents.length > 3) {
          const old = incidents.shift()!;
          const prefix = `diag-incident:${old.id}:`;
          accessibleNodes.get(prefix)?.forEach(node => node.remove()); accessibleNodes.delete(prefix);
        }
      }
      previousReasons = new Set(reasons);
      statistics.lastCharacters = writeAccessible(root, "diag:", latestSnapshot);
      lastAccessibleAt = now;
      statistics.samples += 1; statistics.lastMs = performance.now() - began;
      statistics.totalMs += statistics.lastMs; statistics.maxMs = Math.max(statistics.maxMs, statistics.lastMs);
    }
    if (opened && activeHost === value.hostId) {
      snapshot = { logic: value.snapshot, opening: openingEvidence, view: readViewDiagnostics() };
      publish();
    }
  }, destroy() {
    if (activeHost === initial.hostId) { close(); activeHost = null; }
    hosts.delete(initial.hostId);
    if (latestHost === initial.hostId) latestHost = null;
    if (!hosts.size) {
      document.removeEventListener("touchstart", touchStart, true);
      document.removeEventListener("touchend", touchEnd, true);
      document.removeEventListener("touchcancel", touchEnd, true);
      accessibleNodes.forEach(nodes => nodes.forEach(node => node.remove())); accessibleNodes.clear(); incidents.length = 0;
      delete (window as Window & { __uvelIosDiagnostics?: unknown }).__uvelIosDiagnostics;
    }
  } };
}
