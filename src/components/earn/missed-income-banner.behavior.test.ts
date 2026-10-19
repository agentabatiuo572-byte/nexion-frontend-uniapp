import { compileScript, parse } from "@vue/compiler-sfc";
import { renderToString } from "@vue/server-renderer";
import * as Vue from "vue";
import ts from "typescript";
import { expect, it, vi } from "vitest";
import source from "./missed-income-banner.vue?raw";
import { zh } from "@/i18n/messages/zh";
import { formatAmount } from "@/lib/amount-display";
import { fmt } from "@/i18n/format";
import { deviceNameByKind } from "@/lib/device-copy";

const script = compileScript(parse(source).descriptor, { id: "lite-upgrade", inlineTemplate: true });
const code = ts.transpileModule(script.content, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

it("hides phone comparisons across changing projections while preserving hardware upgrades", async () => {
  const projection = (baseKind: string, targetKind = "stellarbox-pro") => ({
    base: { kind: baseKind, name: "Base", dailyUsdt: 1 },
    target: { kind: targetKind, name: "Target", dailyUsdt: 13, productNo: "stellarbox-pro" },
    multiplier: 13, paybackDays: 100,
  });
  const state = Vue.reactive({
    user: { joinedAt: Date.parse("2026-10-01T00:00:00Z") },
    homeTruth: { generatedAt: "2026-10-19T12:00:00Z", doTheMath: projection("phone") as ReturnType<typeof projection> | null },
  });
  const deps: Record<string, unknown> = {
    vue: Vue,
    "@/lib/amount-display": { formatAmount },
    "@/lib/route": { navTo: vi.fn() },
    "@/store/app": { useApp: () => state },
    "@/store/device-types": { derivePromoUpgrade: vi.fn(() => { throw new Error("Unexpected mock fallback"); }) },
    "@/api/runtime": { remoteApiEnabled: true },
    "@/lib/device-copy": { deviceNameByKind },
    "@/i18n/use-t": { useT: () => Vue.ref(zh) },
    "@/i18n/format": { fmt },
    "@/composables/use-scroll-grow-progress": {
      useScrollGrowProgress: () => ({ elRef: Vue.ref(null), inView: Vue.ref(true) }), PROGRESS_GROW_TRANSITION: "none",
    },
  };
  const exports = { default: {} as Vue.Component };
  new Function("require", "exports", code)((id: string) => {
    if (!(id in deps)) throw new Error(`Unexpected import: ${id}`);
    return deps[id];
  }, exports);
  const render = () => renderToString(Vue.createSSRApp(exports.default));
  expect(await render()).not.toContain(zh.earn.capExplainCta);
  state.homeTruth.doTheMath = projection("stellarbox-s1");
  const hardware = await render();
  expect(hardware).toContain(zh.earn.capExplainCta);
  expect(hardware).toContain("13.00/d");
  state.homeTruth.doTheMath = projection("stellarbox-s1", "phone");
  expect(await render()).not.toContain(zh.earn.capExplainCta);
  state.homeTruth.doTheMath = null;
  expect(await render()).not.toContain(zh.earn.capExplainCta);
});
