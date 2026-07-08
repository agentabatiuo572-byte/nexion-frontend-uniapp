const routeScroll = new Map<string, number>();
const routeReturnScroll = new Map<string, number>();
let restoreAfterBack = false;
const RESTORE_KEY = "nx-scroll:restore-after-back";
let navGuardInstalled = false;

function storageKey(route: string): string {
  return `nx-scroll:${route}`;
}
function returnStorageKey(route: string): string {
  return `nx-scroll-return:${route}`;
}

export function saveRouteScroll(route: string, top: number): void {
  if (!route) return;
  const value = Math.max(0, Math.round(top));
  routeScroll.set(route, value);
  // #ifdef H5
  try {
    sessionStorage.setItem(storageKey(route), String(value));
  } catch {
    // ignore unavailable storage
  }
  // #endif
}

export function getRouteScroll(route: string): number | undefined {
  const memoryValue = routeScroll.get(route);
  if (memoryValue != null) return memoryValue;
  // #ifdef H5
  try {
    const raw = sessionStorage.getItem(storageKey(route));
    if (raw != null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  } catch {
    // ignore unavailable storage
  }
  // #endif
  return undefined;
}

export function saveRouteReturnScroll(route: string, top: number): void {
  if (!route) return;
  const value = Math.max(0, Math.round(top));
  routeReturnScroll.set(route, value);
  // #ifdef H5
  try {
    sessionStorage.setItem(returnStorageKey(route), String(value));
  } catch {
    // ignore unavailable storage
  }
  // #endif
}

function getRouteReturnScroll(route: string): number | undefined {
  const memoryValue = routeReturnScroll.get(route);
  if (memoryValue != null) return memoryValue;
  // #ifdef H5
  try {
    const raw = sessionStorage.getItem(returnStorageKey(route));
    if (raw != null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  } catch {
    // ignore unavailable storage
  }
  // #endif
  return undefined;
}

export function markBackScrollRestore(): void {
  restoreAfterBack = true;
  // #ifdef H5
  try {
    sessionStorage.setItem(RESTORE_KEY, "1");
  } catch {
    // ignore unavailable storage
  }
  // #endif
}

export function clearBackScrollRestore(): void {
  restoreAfterBack = false;
  // #ifdef H5
  try {
    sessionStorage.removeItem(RESTORE_KEY);
  } catch {
    // ignore unavailable storage
  }
  // #endif
}

function hasBackScrollRestore(): boolean {
  if (restoreAfterBack) return true;
  // #ifdef H5
  try {
    return sessionStorage.getItem(RESTORE_KEY) === "1";
  } catch {
    return false;
  }
  // #endif
  return false;
}

export function restoreBackScrollForRoute(route: string, apply: (top: number) => void): boolean {
  if (!hasBackScrollRestore()) return false;
  const top = getRouteReturnScroll(route) ?? getRouteScroll(route);
  if (top == null) return false;
  clearBackScrollRestore();
  apply(top);
  return true;
}

function readRoute(): string {
  try {
    const ps = getCurrentPages();
    const route = ps.length ? ((ps[ps.length - 1] as { route?: string }).route ?? "") : "";
    if (route) return route;
  } catch {
    // fall through to H5 hash fallback
  }
  // #ifdef H5
  try {
    return window.location.hash.replace(/^#\/?/, "").replace(/^\//, "");
  } catch {
    return "";
  }
  // #endif
  return "";
}

function applyDomScroll(top: number): void {
  // #ifdef H5
  const apply = () => {
    const el = document.querySelector(".nx-content") as HTMLElement | null;
    if (el) el.scrollTop = top;
  };
  apply();
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(apply));
  } else {
    setTimeout(apply, 32);
  }
  [80, 180, 360, 700].forEach((delay) => setTimeout(apply, delay));
  // #endif
}

export function restoreBackScrollInDom(skipRoute = "", attempt = 0): void {
  const route = readRoute();
  if (skipRoute && route === skipRoute && attempt < 8) {
    setTimeout(() => restoreBackScrollInDom(skipRoute, attempt + 1), 80);
    return;
  }
  if (skipRoute && route === skipRoute) {
    clearBackScrollRestore();
    return;
  }
  if (getRouteScroll(route) == null && attempt >= 8) {
    clearBackScrollRestore();
    return;
  }
  restoreBackScrollForRoute(route, applyDomScroll);
}

export function saveCurrentDomRouteScrollForReturn(): void {
  // #ifdef H5
  const route = readRoute();
  const el = document.querySelector(".nx-content") as HTMLElement | null;
  if (!route || !el) return;
  saveRouteScroll(route, el.scrollTop);
  saveRouteReturnScroll(route, el.scrollTop);
  // #endif
}

export function installRouteScrollNavigationGuard(): void {
  // #ifdef H5
  if (navGuardInstalled) return;
  navGuardInstalled = true;
  const originalNavigateTo = uni.navigateTo.bind(uni);
  (uni as { navigateTo: typeof uni.navigateTo }).navigateTo = ((options: Parameters<typeof uni.navigateTo>[0]) => {
    saveCurrentDomRouteScrollForReturn();
    return originalNavigateTo(options);
  }) as typeof uni.navigateTo;
  // #endif
}
