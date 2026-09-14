import ts from "typescript";
import * as vue from "vue";
import { describe, expect, it, vi } from "vitest";
import source from "./notifications.vue?raw";
import drawerSource from "@/components/message-drawer.vue?raw";
import { zh } from "@/i18n/messages/zh";
import { fmt } from "@/i18n/format";
import { createRemoteAccountEpoch } from "@/lib/remote-account-epoch";

// Execute the actual page worker; evaluate the actual template bindings below.
// No user notification or backend state is changed by these fixtures.
function mountPage() {
  const notifs = vue.reactive({
    items: [{ id: "team-read", kind: "team", readAt: 1 }, { id: "system-unread", kind: "system", readAt: null as number | null }],
    error: null as string | null, loading: false, nextCursor: null as string | null,
    clearRead: vi.fn(async () => { notifs.items = notifs.items.filter(item => !item.readAt); }),
    refreshRemote: vi.fn(),
  });
  const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
  const output = ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const modules: Record<string, unknown> = {
    vue: { ...vue, onMounted: vi.fn(), onUnmounted: vi.fn(), watch: vi.fn() },
    "@dcloudio/uni-app": { onShow: vi.fn(), onHide: vi.fn() },
    "@/lib/remote-account-epoch": { remoteAccountScope: createRemoteAccountEpoch("fixture") },
    "@/i18n/use-t": { useT: () => vue.ref(zh) },
    "@/i18n/format": { fmt },
    "@/store/notifications": { useNotifications: () => notifs },
    "@/lib/route": { navTo: vi.fn() },
    "@/api/runtime": { remoteApiEnabled: true },
    "@/lib/notification-swipe": { isLeftConversionSwipe: vi.fn() },
    "@/store/ui": { confirm: async () => true, useUI: () => ({ clearConfirmsBy: vi.fn() }) },
    "@/store/app": { useApp: () => ({ accountKey: "fixture", accountBindingEpoch: 0 }) },
  };
  const page = new Function("require", "exports", output + ";return { t, notifs, filter, filtered, countOf, filterLabel, emptyTitle, confirmClearRead };")(
    (name: string) => {
      if (name.endsWith(".vue")) return {};
      if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
      return modules[name];
    }, {},
  );
  return { page, notifs };
}

function evaluateBinding(expression: string, values: Record<string, unknown>) {
  return new Function("values", `with (values) { return (${expression}); }`)(values);
}

describe("notification empty-state context", () => {
  for (const [name, template] of [["page", source], ["drawer", drawerSource]]) {
    it(`${name} waits for the remaining cursor before declaring the selected category empty`, () => {
      const { page, notifs } = mountPage();
      page.filter.value = "team";
      // A refresh/account rebind can replace the loaded later-page category
      // with a first page of other kinds while the selected filter remains.
      notifs.items = [{ id: "first-page-system", kind: "system", readAt: null }];
      notifs.nextCursor = "older-page";
      const condition = name === "page"
        ? template.match(/<EmptyState[^>]*v-if="([^\"]+)"/)![1]
        : template.match(/<view v-if="(!notifs.loading[^\"]+)" class="md-empty">/)![1];
      expect(evaluateBinding(condition, vue.proxyRefs(page))).toBe(false);
      const partial = template.match(/v-if="([^\"]+)"[^>]*role="status"/)![1];
      expect(Boolean(evaluateBinding(partial, vue.proxyRefs(page)))).toBe(true);
      notifs.loading = true;
      expect(Boolean(evaluateBinding(partial, vue.proxyRefs(page)))).toBe(false);
      notifs.loading = false;
      notifs.error = "read failed";
      expect(Boolean(evaluateBinding(partial, vue.proxyRefs(page)))).toBe(false);
      notifs.error = null;
      notifs.nextCursor = null;
      expect(evaluateBinding(condition, vue.proxyRefs(page))).toBe(true);
      expect(Boolean(evaluateBinding(partial, vue.proxyRefs(page)))).toBe(false);
    });
  }
  it("keeps the selected category visible after clearing its last read notification", async () => {
    const { page } = mountPage();
    page.filter.value = "team";
    await page.confirmClearRead();
    expect(page.filtered.value).toHaveLength(0);
    expect(page.notifs.items).toHaveLength(1);
    for (const template of [source, drawerSource]) {
      const condition = template.match(/v-if="(id === 'all'[^\"]*)"/)![1];
      expect(evaluateBinding(condition, { id: "team", filter: page.filter.value, countOf: page.countOf })).toBe(true);
    }
  });

  it("renders the category empty title rather than implying all notifications are gone", async () => {
    const { page } = mountPage();
    page.filter.value = "team";
    await page.confirmClearRead();
    const title = source.match(/<EmptyState[^>]*:title="([^\"]+)"/)![1];
    expect(evaluateBinding(title, vue.proxyRefs(page))).toBe(fmt(zh.notifs.emptyFilterTitle, { filter: zh.notifs.kindTeam }));
  });

  it("uses the global notification empty title only when the feed is actually empty", () => {
    const { page, notifs } = mountPage();
    notifs.items = [];
    expect(page.emptyTitle.value).toBe(zh.notifs.emptyAllTitle);
  });

  it("does not present an empty feed alongside a failed or still-loading request", () => {
    const { page } = mountPage();
    const condition = source.match(/<EmptyState[^>]*v-if="([^\"]+)"/)![1];
    for (const state of [{ error: "failed", loading: false }, { error: null, loading: true }]) {
      expect(evaluateBinding(condition, { ...vue.proxyRefs(page), filtered: [], notifs: state })).toBe(false);
    }
  });
});
