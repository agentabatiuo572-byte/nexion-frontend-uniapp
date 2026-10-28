import { compile } from "@vue/compiler-dom";
import { compileScript, parse } from "@vue/compiler-sfc";
import { renderToString } from "@vue/server-renderer";
import * as Vue from "vue";
import ts from "typescript";
import { expect, it, vi } from "vitest";
import source from "./live-social-proof.vue?raw";
import { en } from "@/i18n/messages/en";
import { zh } from "@/i18n/messages/zh";
import { vi as vietnamese } from "@/i18n/messages/vi";
import { fmt } from "@/i18n/format";
import { nexGridBrandText } from "@/lib/brand-copy";
import { createRemoteAccountEpoch } from "@/lib/remote-account-epoch";
import * as fixtures from "@/mock/storefront-social-proof";

const { descriptor } = parse(source);
const code = ts.transpileModule(compileScript(descriptor, { id: "proof-brand" }).content, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const render = new Function("Vue", compile(descriptor.template!.content, {
  mode: "function", prefixIdentifiers: true, isCustomElement: tag => ["view", "text"].includes(tag),
}).code)(Vue);

// Execute the real setup, mounted read and template; adapt only the remote boundary.
async function proofView(copy: typeof en, name: string | null, theme: string, live = false) {
  const mounted: Array<() => void> = [];
  const unmounted: Array<() => void> = [];
  const snapshot = { productName: name, windowSales: 0, cumulativeSales: 7, windowDays: 30, ...(live ? { liveActivity: { viewers: 32, sales24h: 12, sales30m: 3 } } : {}) };
  let tick = () => {};
  const inView = Vue.ref(true);
  const socialProof = vi.fn(() => name === null ? Promise.reject(new Error("unavailable")) : Promise.resolve(snapshot));
  const imports: Record<string, unknown> = {
    vue: { ...Vue, onMounted: (fn: () => void) => mounted.push(fn), onUnmounted: (fn: () => void) => unmounted.push(fn) },
    "@/i18n/use-t": { useT: () => Vue.ref(copy) }, "@/i18n/format": { fmt },
    "@/lib/brand-copy": { nexGridBrandText }, "@/lib/remote-account-epoch": { createRemoteAccountEpoch },
    "@/api/runtime": { remoteApiEnabled: true, storefrontActivityApi: { socialProof } },
    "@/store/app": { useApp: () => Vue.reactive({ accountKey: "test-user" }) },
    "@/store/product-catalog": { productCatalogState: Vue.reactive({ status: "ready", source: "server", revision: 1 }) },
    "@/api/order-api": { captureRuntimeRevision: () => 1, isCurrentRuntimeRevision: () => true },
    "@/mock/storefront-social-proof": fixtures,
    "@/composables/use-scroll-grow-progress": { useScrollGrowProgress: () => ({ elRef: Vue.ref(null), inView }) },
    "@/composables/use-tab-page-lifecycle": { useVisibleInterval: (fn: () => void) => { tick = fn; } },
  };
  const exports = { default: {} as { setup: (...args: unknown[]) => Record<string, unknown> } };
  new Function("require", "exports", code)((id: string) => {
    if (!(id in imports)) throw new Error(`Unexpected social proof import: ${id}`);
    return imports[id];
  }, exports);
  const scope = Vue.effectScope();
  try {
    const state = scope.run(() => exports.default.setup({ product: { id: "nexgridbox-pro-v2", stock: 3, sold: 7 } }, { expose() {} }))!;
    const html = () => renderToString(Vue.createSSRApp({ render, setup: () => Vue.proxyRefs({ ...state }) }));
    const loading = await html();
    mounted.forEach(fn => fn());
    await Promise.resolve(); await Promise.resolve();
    if (live) {
      inView.value = false; tick();
      expect(socialProof).toHaveBeenCalledTimes(1);
      inView.value = true; tick();
      await Promise.resolve(); await Promise.resolve();
      expect(socialProof).toHaveBeenCalledTimes(2);
    }
    return { loading, body: `<main data-theme="${theme}">${await html()}</main>`, snapshot, socialProof };
  } finally {
    unmounted.forEach(fn => fn());
    scope.stop();
  }
}

for (const [locale, copy] of [["en", en], ["zh", zh], ["vi", vietnamese]] as const) {
  it(`${locale}: renders live activity supplied by the endpoint and polls only in view`, async () => {
    const result = await proofView(copy, "UVEL Box S1", "dark", true);
    for (const label of [copy.store.liveProof.viewingLabel, copy.store.liveProof.sold24hLabel, copy.store.liveProof.sold30mLabel]) expect(result.body).toContain(label);
    for (const count of [32, 12, 3]) expect(result.body).toContain(`>${count}</text>`);
  });
  for (const theme of ["light", "dark"]) {
    it(`${locale}/${theme}: normalizes the hero accessible name without changing the snapshot, product key or counts`, async () => {
      const original = "NexGridBox Pro v2";
      const result = await proofView(copy, original, theme);
      expect(result.body).toContain('aria-label="UVELBox Pro v2"');
      expect(result.body).not.toContain(original);
      expect(result.body).toContain(copy.store.liveProof.cumulativeSalesLabel);
      expect(result.body).toContain(">7</text>");
      expect(result.body).toContain(">0</text>");
      expect(result.body).toContain(">3</text>");
      expect(result.snapshot.productName).toBe(original);
      expect(result.socialProof).toHaveBeenCalledExactlyOnceWith("nexgridbox-pro-v2", 30);
      expect(result.loading).toContain(`aria-label="${copy.store.liveProof.unavailableLabel}"`);
    });
  }
  it(`${locale}: preserves unavailable feedback and does not render sales after failed reads`, async () => {
    const result = await proofView(copy, null, "light");
    expect(result.body).toContain(`aria-label="${copy.store.liveProof.unavailableLabel}"`);
    expect(result.body).toContain(copy.store.liveProof.unavailableLabel);
    expect(result.body).not.toContain(copy.store.liveProof.cumulativeSalesLabel);
  });
}

it.each(["UVELBox Pro v2", "CloudShare", "Custom Compute Model"])("preserves other current product names: %s", async name => {
  expect((await proofView(en, name, "light")).body).toContain(`aria-label="${name}"`);
});
