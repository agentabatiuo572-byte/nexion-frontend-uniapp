import * as Vue from "vue";
import { compileScript, parse } from "@vue/compiler-sfc";
import { compile } from "@vue/compiler-dom";
import ts from "typescript";
import { expect, it, vi } from "vitest";
import source from "./trial-device-row.vue?raw";
import { trialFleetCopy } from "@/i18n/trial-fleet";
import { formatTrialRemaining } from "@/i18n/trial-lifecycle";
import { formatAmount } from "@/lib/amount-display";

const descriptor = parse(source).descriptor;
const code = ts.transpileModule(compileScript(descriptor, { id: "trial-device-row" }).content,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const render = new Function("Vue", compile(descriptor.template!.content, { mode: "function", prefixIdentifiers: true,
  isCustomElement: tag => ["view", "text"].includes(tag) }).code)(Vue);

function nodes(node: Vue.VNode): Vue.VNode[] {
  return [node, ...(Array.isArray(node.children) ? node.children.flatMap(child => Vue.isVNode(child) ? nodes(child) : []) : [])];
}
function mount() {
  const presentation = {
    active: Vue.ref(true), status: Vue.ref("active"), deviceName: Vue.ref("Server Trial B"), remainingMs: Vue.ref<number | null>(48 * 3_600_000),
    offsetUSD: Vue.ref<number | null>(5), estimatedOffsetUSD: Vue.ref<number | null>(21), offsetProgress: Vue.ref<number | null>(5 / 21),
    actionsReady: Vue.ref(true), presentationReady: Vue.ref(true), refresh: vi.fn(),
  };
  const props = Vue.reactive({ showCancel: true, cancelBusy: false });
  const navTo = vi.fn(), emit = vi.fn();
  const modules: Record<string, unknown> = {
    vue: Vue,
    "@/composables/use-trial-presentation": { useTrialPresentation: () => presentation },
    "@/i18n/trial-fleet": { useTrialFleetCopy: () => Vue.ref(trialFleetCopy.en) },
    "@/i18n/trial-lifecycle": { formatTrialRemaining },
    "@/lib/amount-display": { formatAmount }, "@/lib/route": { navTo },
  };
  const exports: Record<string, any> = {};
  new Function("require", "exports", code)((id: string) => {
    if (!(id in modules)) throw new Error(id); return modules[id];
  }, exports);
  const view = exports.default.setup(props, { expose() {}, emit });
  const node = () => render(Vue.proxyRefs({ ...props, ...view }), []) as Vue.VNode;
  const byClass = (className: string) => nodes(node()).find(vnode => vnode.props?.class?.split(" ").includes(className));
  return { props, presentation, navTo, emit, node, byClass };
}

it("renders one separate trial identity, an elapsed-time countdown, actual credit and a clearly separate estimate", () => {
  const screen = mount(); const tree = nodes(screen.node());
  expect(tree.filter(node => node.props?.["data-trial-device-row"] === "true")).toHaveLength(1);
  expect(tree.filter(node => typeof node.children === "string").map(node => node.children)).toEqual(expect.arrayContaining([
    "Server Trial B", "Trial device", "2d 0h", "$5.00", "$21.00", "Available credit", "Estimated trial credit",
  ]));
  expect(screen.byClass("trial-device-row__progress")?.props?.["aria-valuenow"]).toBe(24);
});

it("keeps details reachable while unavailable purchase/cancel actions remain closed and amounts unknown", () => {
  const screen = mount(); screen.presentation.actionsReady.value = false; screen.presentation.presentationReady.value = false;
  screen.presentation.offsetUSD.value = null; screen.presentation.estimatedOffsetUSD.value = null; screen.presentation.offsetProgress.value = null;
  screen.byClass("trial-device-row__buy")!.props!.onClick(); screen.byClass("trial-device-row__cancel")!.props!.onClick();
  expect(screen.navTo).not.toHaveBeenCalled(); expect(screen.emit).not.toHaveBeenCalled();
  expect(screen.byClass("trial-device-row__buy")!.props).toMatchObject({ tabindex: -1, "aria-disabled": true });
  expect(screen.byClass("trial-device-row__amount")!.children).toBe("—");
  expect(screen.byClass("trial-device-row__progress")!.props!["aria-valuenow"]).toBeUndefined();
  screen.byClass("trial-device-row__details")!.props!.onClick(); expect(screen.navTo).toHaveBeenCalledWith("/pages/me/trial");
  screen.byClass("trial-device-row__retry")!.props!.onClick(); expect(screen.presentation.refresh).toHaveBeenCalledTimes(1);
});

it("uses the existing trial detail purchase path and prevents cancellation while busy", () => {
  const screen = mount(); screen.byClass("trial-device-row__buy")!.props!.onClick();
  expect(screen.navTo).toHaveBeenCalledWith("/pages/me/trial");
  screen.byClass("trial-device-row__cancel")!.props!.onClick(); expect(screen.emit).toHaveBeenCalledExactlyOnceWith("cancel");
  screen.props.cancelBusy = true; screen.byClass("trial-device-row__cancel")!.props!.onClick(); expect(screen.emit).toHaveBeenCalledTimes(1);
  screen.presentation.status.value = "grace"; expect(screen.byClass("trial-device-row__cancel")).toBeUndefined();
});

it("leaves no trial row after the confirmed lifecycle exits the active queue", () => {
  const screen = mount(); screen.presentation.active.value = false;
  expect(screen.byClass("trial-device-row")).toBeUndefined();
});
