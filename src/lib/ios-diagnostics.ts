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

export function readLogicDiagnostics() {
  const pages = getCurrentPages();
  const logical = logicalNativePage(pages[pages.length - 1]);
  return {
    sampledAt: new Date().toISOString(),
    sourceSha: __UVEL_DIAGNOSTIC_SOURCE__,
    sourceBaseline: "b39422619d934ded7277dcb1053c2b3a8731fd27",
    diagnosticRevision: "ios-perf-accessibility-v1",
    compiledResourceVersion,
    pages: pages.map(page => ({ route: page.route, id: (page as { $page?: { id?: number } }).$page?.id })),
    logicalPage: { route: logical.route, options: diagnosticQuery(logical.options) },
    readers: Array.from(readers, reader => ({ section: reader.section, uid: reader.uid, owner: reader.owner, hostId: reader.hostId, state: reader.read() })),
  };
}

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
