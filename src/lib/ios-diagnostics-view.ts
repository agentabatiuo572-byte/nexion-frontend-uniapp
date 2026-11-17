import { diagnosticHref } from "./ios-diagnostics-route";

type Reader = { read(): unknown; reset(): void };
const chassisReaders = new Map<string, Reader>();
export function registerChassisDiagnostics(hostId: string, reader: Reader) {
  chassisReaders.set(hostId, reader);
  return () => { chassisReaders.delete(hostId); };
}

export interface DiagnosticConfiguration { hostId: string; snapshot: unknown; failures?: { id: number; at: string; kind: string; message: string }[]; }
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
let cardBackgroundMode: "A" | "B" = "B";
let cardBackgroundSwitches = 0;
let threeFingerHeld = false;
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
// Match the installed uni-app-view.umd.js db switch: 9 removes an event; 12 adds WXS.
// wp (#text/#comment and id 0) supplies insert/remove/setText/addWxsEvent.
// Yp/E_ add attributes and ordinary events. In particular comments CAN setText.
type ViewNode = { tag: string; pid: number; $: Node; $children?: ViewNode[]; id: number; [method: string]: unknown };
type NodeHistory = { tag: string; createdBatch: number; parentId: number; removedBatch?: number };
type Failure = { id: number; at: string; kind: string; details: unknown };
const nodeHistory = new Map<number, NodeHistory>();
const recentBatches: { batch: number; length: number; create: number; remove: number; setAttr: number; at: string }[] = [];
const failures: Failure[] = [];
let batchSerial = 0;
let failureSerial = 0;
let removedActionTotal = 0;
let lastRemovedAction: unknown = null;
let viewErrorTotal = 0;
let lastViewError: { at: string; kind: string; message: string } | null = null;
let lastLogicFailure = 0;
let errorsCaptured = false;
const methods: Record<number, string> = { 4: "insert", 5: "remove", 6: "setAttr", 7: "removeAttr", 8: "addEvent", 9: "removeEvent", 10: "setText", 12: "addWxsEvent" };
function recordFailure(kind: string, details: unknown) {
  const failure = { id: ++failureSerial, at: new Date().toISOString(), kind, details };
  failures.push(failure);
  const root = Array.from(hosts.values()).reverse().find(host => host.root.dataset.pageVisible !== "false")?.root ?? document.body;
  writeAccessible(root, `diag-fail:${failure.id}:`, failure);
  if (failures.length > 8) {
    const old = failures.splice(5, 1)[0];
    const prefix = `diag-fail:${old.id}:`;
    accessibleNodes.get(prefix)?.forEach(node => node.remove());
    accessibleNodes.delete(prefix);
  }
}
function recordViewError(kind: string, value: unknown, context?: unknown) {
  viewErrorTotal += 1;
  const error = value as { message?: string; stack?: string } | undefined;
  const entry = { at: new Date().toISOString(), kind, message: `${error?.message ?? String(value)} ${error?.stack ?? ""}`.slice(0, 1500) };
  lastViewError = { ...entry, message: entry.message.slice(0, 200) };
  recordFailure(kind, { ...entry, context });
}
function prevalidateSync(actions: unknown[][]) {
  const lookup = (window as unknown as { __$__?: (id: number) => ViewNode | undefined }).__$__;
  if (!lookup) return actions;
  const batch = ++batchSerial;
  recentBatches.push({ batch, length: actions.length, create: actions.filter(action => action[0] === 3).length,
    remove: actions.filter(action => action[0] === 5).length, setAttr: actions.filter(action => action[0] === 6).length, at: new Date().toISOString() });
  if (recentBatches.length > 8) recentBatches.shift();
  const dictionary = actions[0]?.[0] === 0 ? actions[0][1] as unknown[] : [];
  const word = (value: unknown, decodeValues = true): unknown => {
    if (!dictionary.length) return value;
    if (typeof value === "number") return dictionary[value];
    if (Array.isArray(value)) return Object.fromEntries(value.map(([key, item]) => [String(word(key)), decodeValues ? word(item) : item]));
    return value;
  };
  const properties = (value: unknown) => value ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    key === "e" ? word(item, false) : key === "w" && Array.isArray(item)
      ? Object.fromEntries(item.map(([event, [handler, flags]]) => [String(word(event)), [word(handler), flags]])) : word(item)])) : value;
  const created = new Map<number, { tag: string; parentId: number; ownerId: number }>();
  const removed = new Set<number>();
  const get = (id: number) => removed.has(id) ? undefined : created.get(id) ?? lookup(id);
  const parentOf = (id: number) => created.get(id)?.parentId ?? nodeHistory.get(id)?.parentId ?? lookup(id)?.pid;
  const supports = (id: number, method: string) => {
    if (removed.has(id)) return false;
    const fresh = created.get(id);
    if (fresh) return !["#text", "#comment"].includes(fresh.tag) || ["insert", "remove", "setText", "addWxsEvent"].includes(method);
    const node = lookup(id);
    return !!node && typeof node[method] === "function";
  };
  const canContain = (id: number) => {
    const node = get(id);
    return !!node && !["#text", "#comment"].includes(node.tag);
  };
  const markRemoved = (id: number) => {
    if (removed.has(id)) return;
    removed.add(id);
    const history = nodeHistory.get(id);
    const node = lookup(id);
    if (history) history.removedBatch = batch;
    else if (node) nodeHistory.set(id, { tag: node.tag, createdBatch: 0, parentId: node.pid, removedBatch: batch });
    for (const child of node?.$children ?? []) markRemoved(child.id);
    for (const [childId, child] of created) if (child.ownerId === id) markRemoved(childId);
  };
  const describe = (node: Node | null | undefined) => node ? { tag: node.nodeName,
    class: (node as Element).getAttribute?.("class")?.slice(0, 200) ?? null, id: (node as Element).id || null } : null;
  const filtered: unknown[][] = [];
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    const op = action[0] as number, id = action[1] as number;
    const method = methods[op];
    let reason = method && !get(id) ? "missing target" : method && !supports(id, method) ? `unsupported ${method}` : "";
    if (!reason && (op === 3 || op === 4)) {
      const parentId = (op === 3 ? action[3] === -1 ? 0 : action[3] : action[2]) as number;
      const refId = (op === 3 ? action[4] : action[3]) as number;
      if (!canContain(parentId)) reason = "missing or non-container insertion parent";
      else if (refId !== -1 && (!get(refId) || parentOf(refId) !== parentId)) reason = "missing or misplaced insertion reference";
    }
    // wp.remove dereferences parentNode; a detached wrapper would also abort the batch.
    if (!reason && op === 5 && !created.has(id) && lookup(id)?.$ && !lookup(id)!.$.parentNode) reason = "detached remove target";
    if (reason) {
      const node = lookup(id), element = node?.$;
      const parentId = parentOf(id) ?? null;
      const args = op === 3 ? { tag: word(action[2]), parentId: action[3], refId: action[4], properties: properties(action[5]) }
        : op === 4 ? { parentId: action[2], refId: action[3], properties: properties(action[4]) }
        : op === 6 ? { name: word(action[2]), value: word(action[3]) }
        : op === 8 ? { name: word(action[2]), flags: action[3] }
        : op === 12 ? { name: word(action[2]), handler: word(action[3]), flags: action[4] }
        : op === 10 ? { text: word(action[2]) } : { name: word(action[2]) };
      // Snapshot copies prevent later batches from changing retained failure history.
      const details = JSON.parse(JSON.stringify({ batch, batchLength: actions.length, index, op, method, id, reason, args,
        nodeName: element?.nodeName ?? created.get(id)?.tag ?? null, textContent: element?.textContent?.slice(0, 60) ?? null,
        parent: describe(element?.parentElement), previous: describe(element?.previousSibling), next: describe(element?.nextSibling),
        history: nodeHistory.get(id) ?? null, parentId, parentHistory: parentId === null ? null : nodeHistory.get(parentId) ?? null,
        recentBatches }, (_key, value) => typeof value === "string" ? value.slice(0, 200) : value));
      removedActionTotal += 1;
      lastRemovedAction = { batch, index, op, id, reason };
      recordFailure("vdSync:skipped", details);
      continue;
    }
    filtered.push(action);
    if (op === 3) {
      const parentId = action[3] === -1 ? 0 : action[3] as number;
      const tag = String(word(action[2]));
      removed.delete(id);
      created.set(id, { tag, parentId, ownerId: parentId });
      nodeHistory.delete(id);
      nodeHistory.set(id, { tag, createdBatch: batch, parentId });
    } else if (op === 4) {
      const parentId = action[2] as number;
      const fresh = created.get(id);
      if (fresh) fresh.parentId = parentId;
      const history = nodeHistory.get(id);
      if (history) history.parentId = parentId;
      else nodeHistory.set(id, { tag: lookup(id)!.tag, createdBatch: 0, parentId });
    } else if (op === 5) markRemoved(id);
  }
  while (nodeHistory.size > 5000) nodeHistory.delete(nodeHistory.keys().next().value!);
  return filtered.length === actions.length ? actions : filtered;
}
function captureViewErrors() {
  if (errorsCaptured) return;
  errorsCaptured = true;
  const bridge = (window as unknown as { UniViewJSBridge?: { subscribeHandler?: (name: string, data: unknown, pageId: unknown) => unknown } }).UniViewJSBridge;
  const subscribe = bridge?.subscribeHandler;
  if (bridge && subscribe) bridge.subscribeHandler = function(name, data, pageId) {
    let actions = data;
    try {
      if (name === "vdSync" && Array.isArray(data)) actions = prevalidateSync(data as unknown[][]);
      return subscribe.call(this, name, actions, pageId);
    }
    catch (error) {
      recordViewError(`bridge:${name}`, error, { batch: batchSerial, length: Array.isArray(actions) ? actions.length : null, recentBatches });
      throw error;
    }
  };
  window.addEventListener("error", event => recordViewError("error", event.error ?? `${event.message} @${event.filename}:${event.lineno}:${event.colno}`), true);
  window.addEventListener("unhandledrejection", event => recordViewError("rejection", event.reason));
  for (const level of ["error", "warn"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => { recordViewError(`console.${level}`, args.map(arg => arg instanceof Error ? `${arg.message} ${arg.stack ?? ""}` : typeof arg === "string" ? arg : JSON.stringify(arg) ?? String(arg)).join(" ")); original(...args); };
  }
}
function readViewDiagnostics() {
  return { sampledAt: new Date().toISOString(), errors: { total: viewErrorTotal, latest: lastViewError },
    sync: { batches: batchSerial, skippedActions: removedActionTotal, latest: lastRemovedAction, recentBatches, historySize: nodeHistory.size, failures: failureSerial },
    cardBackground: { mode: cardBackgroundMode, switches: cardBackgroundSwitches }, fingers: { count: fingerCount, noFingerSince }, visibility: document.visibilityState,
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
  if (event.touches.length !== 3 || threeFingerHeld) return;
  threeFingerHeld = true;
  cardBackgroundMode = cardBackgroundMode === "B" ? "A" : "B";
  cardBackgroundSwitches += 1;
  hosts.forEach(host => { host.root.dataset.diagCardBackground = cardBackgroundMode; });
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
  if (!fingerCount) { noFingerSince = Date.now(); threeFingerHeld = false; }
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
      // iOS exposes only leaf elements: a labelled img is read, a note container or opacity:0 node is not.
      node.setAttribute("role", "img");
      node.style.cssText = "position:absolute;width:1px;height:1px;top:0;left:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%);pointer-events:none";
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
  root.dataset.diagCardBackground = cardBackgroundMode;
  hosts.set(initial.hostId, { root, notify, resetIncident() { lockedSince.clear(); pendingSince.clear(); previousReasons.clear(); lastAccessibleAt = 0; } });
  if (hosts.size === 1) {
    captureViewErrors();
    document.addEventListener("touchstart", touchStart, { capture: true, passive: true });
    document.addEventListener("touchend", touchEnd, { capture: true, passive: true });
    document.addEventListener("touchcancel", touchEnd, { capture: true, passive: true });
    (window as Window & { __uvelIosDiagnostics?: unknown }).__uvelIosDiagnostics = {
      get open() { return opened; }, get snapshot() { return snapshot; }, get liveSnapshot() { return latestSnapshot; },
      get incidents() { return incidents; }, get failures() { return failures; }, get statistics() { return statistics; }, close, reset,
    };
  }
  return { update(value: DiagnosticConfiguration) {
    for (const failure of value.failures ?? []) if (failure.id > lastLogicFailure) {
      lastLogicFailure = failure.id;
      recordFailure(`logic:${failure.kind}`, failure);
    }
    if (!value.snapshot) return;
    const now = Date.now();
    if (root.dataset.pageVisible !== "false" && root.getClientRects().length && now - lastAccessibleAt >= 1900) {
      const began = performance.now();
      latestHost = value.hostId;
      for (const [prefix, nodes] of accessibleNodes) if (prefix.startsWith("diag-incident:") || prefix.startsWith("diag-fail:")) {
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
        const pull = (chassisReaders.get(chassis.id)?.read() as { pullActive?: boolean } | undefined)?.pullActive;
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
