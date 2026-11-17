import { getCurrentInstance, inject, onBeforeUnmount, type InjectionKey } from "vue";
import { compiledResourceVersion, readNativeResourceVersion, type ResourceVersion } from "./app-version";
import { logicalNativePage } from "./native-tab-navigation";
export { diagnosticQuery, diagnosticHref } from "./ios-diagnostics-route";
import { diagnosticQuery } from "./ios-diagnostics-route";

declare const __UVEL_DIAGNOSTIC_SOURCE__: string;

// Explicit allowlisted readers only: never serialize a store, component, options, or URL wholesale.
export const DIAGNOSTIC_HOST: InjectionKey<string> = Symbol("ios-diagnostic-host");
const readers = new Set<{ section: string; uid: number; owner: number; hostId: string | null; read: () => unknown; reset?: () => void }>();

export function useDiagnosticReader(section: string, read: () => unknown, reset?: () => void, hostId?: string) {
  const component = getCurrentInstance()!;
  const reader = { section, uid: component.uid, owner: component.root.uid, hostId: hostId ?? inject(DIAGNOSTIC_HOST, null), read, reset };
  readers.add(reader);
  onBeforeUnmount(() => { readers.delete(reader); });
}

// Diagnostic-only error log for the logic layer (kept: first five plus the latest three).
const logicErrors: { id: number; at: string; kind: string; message: string }[] = [];
let logicErrorTotal = 0;
function recordLogicError(kind: string, value: unknown) {
  logicErrorTotal += 1;
  const error = value as { message?: string; stack?: string } | undefined;
  logicErrors.push({ id: logicErrorTotal, at: new Date().toISOString(), kind, message: `${error?.message ?? String(value)} ${error?.stack ?? ""}`.slice(0, 600) });
  if (logicErrors.length > 8) logicErrors.splice(5, 1);
}
for (const level of ["error", "warn"] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => { recordLogicError(`console.${level}`, args.map(arg => arg instanceof Error ? `${arg.message} ${arg.stack ?? ""}` : typeof arg === "string" ? arg : JSON.stringify(arg) ?? String(arg)).join(" ")); original(...args); };
}
const uniOnError = (uni as unknown as { onError?: (hook: (error: unknown) => void) => void }).onError;
if (typeof uniOnError === "function") uniOnError(error => recordLogicError("uni.onError", error));

export function readLogicDiagnostics() {
  const pages = getCurrentPages();
  const logical = logicalNativePage(pages[pages.length - 1]);
  return {
    sampledAt: new Date().toISOString(),
    sourceSha: __UVEL_DIAGNOSTIC_SOURCE__,
    sourceBaseline: "95947465",
    diagnosticRevision: "ios-perf-accessibility-v5",
    compiledResourceVersion,
    pages: pages.map(page => ({ route: page.route, id: (page as { $page?: { id?: number } }).$page?.id })),
    logicalPage: { route: logical.route, options: diagnosticQuery(logical.options) },
    errors: { total: logicErrorTotal, latest: logicErrors.length ? { ...logicErrors[logicErrors.length - 1], message: logicErrors[logicErrors.length - 1].message.slice(0, 200) } : null },
    readers: Array.from(readers, reader => ({ section: reader.section, uid: reader.uid, owner: reader.owner, hostId: reader.hostId, state: reader.read() })),
  };
}

export function readLogicFailures() { return logicErrors.slice(); }

export function resetLogicDiagnostics() { readers.forEach(reader => reader.reset?.()); }

type NativeWebview = {
  id: string; getURL(): string; isVisible(): boolean; parent(): NativeWebview | null;
  children(): NativeWebview[]; getStyle(): Record<string, unknown>;
};
// Follow-up 1 samples the foreground host every two seconds; the backup panel samples at 500 ms.
export function readNativeDiagnostics(done: (value: unknown) => void) {
  readNativeResourceVersion((version: ResourceVersion) => {
    const webview = (globalThis as typeof globalThis & { plus?: { webview?: { all(): NativeWebview[] } } }).plus?.webview;
    done({ sampledAt: new Date().toISOString(), resourceVersion: version, webviews: webview ? webview.all().map(view => {
      const url = view.getURL();
      const style = view.getStyle();
      return { id: view.id, urlCategory: /^https?:/.test(url) ? "remote-http" : url ? "local-resource" : "empty",
        visible: view.isVisible(), parent: view.parent()?.id ?? null, children: view.children().map(child => child.id),
        style: Object.fromEntries(["top", "left", "width", "height", "bottom", "right", "zindex", "position", "opacity", "render"].map(key => [key, style[key]])) };
    }) : null });
  });
}
