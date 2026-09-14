import ts from "typescript";
import * as vue from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import pageSource from "./notifications.vue?raw";
import drawerSource from "@/components/message-drawer.vue?raw";
import { createRemoteAccountEpoch } from "@/lib/remote-account-epoch";
import { zh } from "@/i18n/messages/zh";
import { fmt } from "@/i18n/format";
import { createPinia, setActivePinia } from "pinia";
import { useUI } from "@/store/ui";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const scopes: vue.EffectScope[] = [];
afterEach(() => { for (const scope of scopes.splice(0)) scope.stop(); });

// Run the actual SFC worker with controlled IO and real Vue watchers.
function mount(kind: "page" | "drawer", remote = true, realQueue = false) {
  const epoch = createRemoteAccountEpoch("a");
  const app = vue.reactive({ accountKey: "a", accountBindingEpoch: 0 });
  const account = { ...epoch, bind(key: string) { const value = epoch.bind(key); app.accountKey = key; app.accountBindingEpoch += 1; return value; } };
  setActivePinia(createPinia());
  const ui = useUI();
  const confirmation = deferred<boolean>();
  const action = deferred<string | null>();
  const read = deferred<void>();
  const hooks: Record<string, Array<() => void>> = { show: [], hide: [], unmount: [], mounted: [] };
  const notifs = vue.reactive({
    items: [], unread: 0, error: null, loading: false, nextCursor: null,
    clearRead: vi.fn(async () => {}), refreshRemote: vi.fn(),
    recordCta: vi.fn(() => action.promise), recordSwipeConversion: vi.fn(() => action.promise),
    markRead: vi.fn(() => read.promise), markAllRead: vi.fn(),
  });
  const drawer = vue.reactive({ open: true, close: vi.fn(() => { drawer.open = false; }) });
  const navTo = vi.fn();
  const confirm = vi.fn((options: Parameters<typeof ui.confirm>[0]) => realQueue ? ui.confirm(options) : confirmation.promise);
  const modules: Record<string, unknown> = {
    vue: { ...vue, onMounted: (fn: () => void) => hooks.mounted.push(fn), onUnmounted: (fn: () => void) => hooks.unmount.push(fn) },
    "@dcloudio/uni-app": { onShow: (fn: () => void) => hooks.show.push(fn), onHide: (fn: () => void) => hooks.hide.push(fn) },
    "@/i18n/use-t": { useT: () => vue.ref(zh) }, "@/i18n/format": { fmt },
    "@/store/notifications": { useNotifications: () => notifs },
    "@/store/message-drawer": { useMessageDrawer: () => drawer },
    "@/composables/use-dialog-a11y": { useDialogA11y: vi.fn() },
    "@/lib/route": { navTo }, "@/api/runtime": { remoteApiEnabled: remote },
    "@/lib/remote-account-epoch": { remoteAccountScope: account },
    "@/lib/notification-swipe": { isLeftConversionSwipe: () => true },
    "@/store/ui": { confirm, useUI: () => ui },
    "@/store/app": { useApp: () => app },
  };
  const source = kind === "page" ? pageSource : drawerSource;
  const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
  const output = ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const scope = vue.effectScope(); scopes.push(scope);
  const worker = scope.run(() => new Function("require", "exports", output + (kind === "page"
    ? ";return { confirmClearRead, onTap, onTouchStart, onTouchEnd };"
    : ";return { onCta };"))((name: string) => {
    if (name.endsWith(".vue")) return {};
    if (!(name in modules)) throw new Error(`Unexpected dependency ${name}`);
    return modules[name];
  }, {}));
  const fire = (name: string) => hooks[name].forEach(fn => fn());
  return { worker, account, confirmation, action, read, notifs, drawer, navTo, confirm, fire, ui };
}
const notification = { id: "fixture", ctaHref: "/pages/team/team" };
const touch = (x: number) => ({ changedTouches: [{ clientX: x, clientY: 20 }] });

describe("notification pending intent isolation", () => {
  for (const invalidation of ["hide", "unmount", "account", "rebind"]) {
    it(`cancels only this page's queued confirmation on ${invalidation}`, async () => {
      const h = mount("page", true, true);
      const pending = h.worker.confirmClearRead();
      const foreign = h.ui.confirm({ title: "Another page", owner: "foreign" });
      if (invalidation === "account") h.account.bind("b");
      else if (invalidation === "rebind") h.account.bind("a");
      else h.fire(invalidation);
      expect(h.ui.confirmQueue.map(row => row.owner)).toEqual(["foreign"]);
      await pending; expect(h.notifs.clearRead).not.toHaveBeenCalled();
      h.ui.clearConfirmsBy("foreign"); expect(await foreign).toBe(false);
    });
  }
  for (const invalidation of ["account", "rebind", "hide-show", "unmount"]) {
    it(`does not clear notifications when confirmation outlives ${invalidation}`, async () => {
      const h = mount("page");
      const pending = h.worker.confirmClearRead();
      if (invalidation === "account") h.account.bind("b");
      if (invalidation === "rebind") h.account.bind("a");
      if (invalidation === "hide-show") { h.fire("hide"); h.fire("show"); }
      if (invalidation === "unmount") h.fire("unmount");
      h.confirmation.resolve(true); await pending;
      expect(h.notifs.clearRead).not.toHaveBeenCalled();
    });
  }
  for (const accepted of [true, false]) {
    it(`honors a current confirmation (${accepted})`, async () => {
      const h = mount("page"); const pending = h.worker.confirmClearRead();
      h.confirmation.resolve(accepted); await pending;
      expect(h.notifs.clearRead).toHaveBeenCalledTimes(accepted ? 1 : 0);
    });
  }
  for (const action of ["tap", "swipe", "mock-tap"]) {
    it(`allows a current ${action} route`, async () => {
      const h = mount("page", action !== "mock-tap");
      h.worker.onTouchStart(notification, touch(100));
      const pending = action === "swipe" ? h.worker.onTouchEnd(notification, touch(10)) : h.worker.onTap(notification);
      h.action.resolve("/pages/team/team"); h.read.resolve(); await pending;
      expect(h.navTo).toHaveBeenCalledWith("/pages/team/team");
    });
    for (const invalidation of ["hide-show", "account", "rebind", "unmount"]) {
    it(`ignores a late ${action} route after ${invalidation}`, async () => {
      const h = mount("page", action !== "mock-tap");
      h.worker.onTouchStart(notification, touch(100));
      const pending = action === "swipe" ? h.worker.onTouchEnd(notification, touch(10)) : h.worker.onTap(notification);
      if (invalidation === "hide-show") { h.fire("hide"); h.fire("show"); }
      if (invalidation === "account") h.account.bind("b");
      if (invalidation === "rebind") h.account.bind("a");
      if (invalidation === "unmount") h.fire("unmount");
      h.action.resolve("/pages/team/team"); h.read.resolve(); await pending;
      expect(h.navTo).not.toHaveBeenCalled();
    });
    }
  }
  it("does not carry a touch gesture into a new account", async () => {
    const h = mount("page"); h.worker.onTouchStart(notification, touch(100));
    h.account.bind("b"); h.action.resolve(null);
    await h.worker.onTouchEnd(notification, touch(10));
    expect(h.notifs.recordSwipeConversion).not.toHaveBeenCalled();
  });
  it("refreshes on foreground but ignores hooks and actions after disposal", async () => {
    const h = mount("page"); h.fire("show");
    expect(h.notifs.refreshRemote).toHaveBeenCalledTimes(1);
    h.fire("unmount"); h.fire("show"); h.confirmation.resolve(true);
    await h.worker.confirmClearRead();
    expect(h.notifs.refreshRemote).toHaveBeenCalledTimes(1);
    expect(h.confirm).not.toHaveBeenCalled();
  });
  for (const invalidation of ["close-reopen", "account", "rebind", "unmount"]) {
    it(`keeps a drawer intact after stale CTA (${invalidation})`, async () => {
      const h = mount("drawer"); const pending = h.worker.onCta(notification);
      if (invalidation === "close-reopen") { h.drawer.open = false; h.drawer.open = true; }
      if (invalidation === "account") h.account.bind("b");
      if (invalidation === "rebind") h.account.bind("a");
      if (invalidation === "unmount") h.fire("unmount");
      h.action.resolve("/pages/team/team"); await pending;
      expect(h.drawer.close).not.toHaveBeenCalled(); expect(h.navTo).not.toHaveBeenCalled();
    });
  }
  it("navigates and closes a current drawer CTA", async () => {
    const h = mount("drawer"); const pending = h.worker.onCta(notification);
    h.action.resolve("/pages/team/team"); await pending;
    expect(h.drawer.close).toHaveBeenCalledOnce(); expect(h.navTo).toHaveBeenCalledWith("/pages/team/team");
  });
  it("does not submit a CTA when the drawer is closed", async () => {
    const h = mount("drawer"); h.drawer.open = false; h.action.resolve(null);
    await h.worker.onCta(notification); expect(h.notifs.recordCta).not.toHaveBeenCalled();
  });
});
