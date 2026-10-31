vi.mock("@/services/native-push", () => ({ revokeNativePush: vi.fn(), resumeNativePush: vi.fn() }));
import * as Vue from "vue";
import { compileScript, parse } from "@vue/compiler-sfc";
import { compile } from "@vue/compiler-dom";
import ts from "typescript";
import { expect, it, vi } from "vitest";
import source from "./device-inventory-row.vue?raw";
import { en } from "@/i18n/messages/en";
import { zh } from "@/i18n/messages/zh";
import { vi as vietnamese } from "@/i18n/messages/vi";
import { deviceName } from "@/lib/device-copy";
import { fmtMoney } from "@/i18n/format";
import { deviceOnlineState } from "@/lib/hashpower";

import type { Device } from "@/store/types";

const messages = { en, zh, vi: vietnamese };
const descriptor = parse(source).descriptor;
const code = ts.transpileModule(compileScript(descriptor, { id: "device-inventory-row" }).content,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const render = new Function("Vue", compile(descriptor.template!.content, { mode: "function", prefixIdentifiers: true,
  isCustomElement: tag => ["view", "text", "image"].includes(tag) }).code)(Vue);
function nodes(node: Vue.VNode): Vue.VNode[] {
  return [node, ...(Array.isArray(node.children) ? node.children.flatMap(child => Vue.isVNode(child) ? nodes(child) : []) : [])];
}
function mount(locale: keyof typeof messages = "en") {
  const t = messages[locale];
  const visibility = Vue.reactive({ hidden: false, mask: (value: string) => visibility.hidden ? "••••" : value });
  const device = Vue.reactive({ id: "paid-1", productCode: "stellarbox-pro-v2", kind: "stellarbox-pro-v2", name: "UVELBox Pro v2", gpu: "RTX 4090",
    activatedAt: 1, capacitySource: "server", runtimeStatus: "ONLINE", status: "online", baseRate: 2, baseRateNEX: 3,
    cumulativeEarningsUsdt: 1234.5, todayEarnings: 12.34,
  } as Device);
  const props = Vue.reactive({ device, active: true, runtimeConfirmed: true, showAction: true, disabled: false, actionDisabled: false,
    disabledLabel: undefined as string | undefined, activateLabel: t.myDevices.inventoryRowActivate, deactivateLabel: t.myDevices.inventoryRowDeactivate,
    slotsFullLabel: t.myDevices.inventoryRowSlotsFull, pendingChipLabel: t.myDevices.inventoryPendingDeactivateChip,
    tradeinCreditText: "Credit $200", tradeinQuoteAmount: 200 as number | undefined, quoteInfoOpen: false,
    tradeinCtaLabel: t.tradein.stripCta as string | undefined, tradeinDisabledText: undefined as string | undefined });
  const emit = vi.fn((event: string, open?: boolean) => { if (event === "quote-info") props.quoteInfoOpen = !!open; });
  const modules: Record<string, unknown> = { vue: Vue, "@/i18n/use-t": { useT: () => Vue.ref(t) },
    "@/lib/device-copy": { deviceName }, "@/lib/hashpower": { deviceOnlineState },
    "@/i18n/format": { fmtMoney }, "@/store/data-visibility": { useDataVisibility: () => visibility },
    "@/components/ui/nx-button.vue": { name: "NxButton" }, "@/composables/use-tab-page-lifecycle": { useVisibleInterval() {} },
    "@/lib/server-deadline-clock": { advanceMonotonicHighWater: (value: number) => value, projectServerNow: (value: number) => value, readMonotonicNowMs: () => 0 },
    "@/lib/task-progress": { taskProgressPercent: () => 50 },
    "@/composables/use-device-product-image": { useDeviceProductImage: (device: () => Device) => ({ imageSrc: Vue.computed(() => `https://catalog.example/${device().productCode}`), imageError() {} }) } };
  const exports: Record<string, any> = {};
  new Function("require", "exports", code)((id: string) => {
    if (!(id in modules)) throw new Error(id); return modules[id];
  }, exports);
  const view = exports.default.setup(props, { expose() {}, emit });
  const node = () => render(Vue.proxyRefs({ ...props, ...view }), []) as Vue.VNode;
  const byClass = (className: string) => nodes(node()).find(item => item.props?.class?.split(" ").includes(className));
  return { props, device, emit, node, byClass, t, visibility };
}

it.each(["zh", "en", "vi"] as const)("shows the %s purchased card open with its job, earnings and actions", locale => {
  const screen = mount(locale);
  expect(screen.byClass("device-inventory-row__name")!.children).toBe("UVELBox Pro v2");
  expect(screen.byClass("device-inventory-row__image")!.props!.src).toBe("https://catalog.example/stellarbox-pro-v2");
  expect(nodes(screen.byClass("device-inventory-row__state")!).some(node => node.children === "Online")).toBe(true);
  expect(screen.byClass("device-inventory-row__status")).toBeUndefined();
  expect(screen.byClass("device-inventory-row__heading")).toBeUndefined();
  expect(screen.byClass("device-inventory-row__earned")!.children).toBe("$1,234.50");
  expect(screen.byClass("device-inventory-row__today")!.children).toBe("+$12.34");
  expect(nodes(screen.byClass("device-inventory-row__task")!).some(node => node.children === screen.t.earn.noCurrentTask)).toBe(true);
  expect(nodes(screen.byClass("device-inventory-row__quote")!).some(node => node.children === screen.t.tradein.inventoryCreditLabel)).toBe(true);
  expect(screen.byClass("device-inventory-row__credit")!.children).toBe("$200.00");
  const cta = screen.byClass("device-inventory-row__tradein-cta")!, action = screen.byClass("device-inventory-row__action")!;
  expect(cta.props).toMatchObject({ variant: "brand", label: screen.t.tradein.stripCta });
  expect(action.props).toMatchObject({ variant: "secondary", label: screen.t.myDevices.inventoryRowDeactivate, disabled: false });
  cta.props!.onClick(); action.props!.onClick();
  expect(screen.emit.mock.calls).toEqual([["quote-info", false], ["tradein"], ["toggle"]]);
});

it("shows the live job with its progress while the device runs it", () => {
  const screen = mount("zh");
  screen.device.currentTask = { id: "T-1", model: "SDXL", status: "RUNNING", startedAt: 0, totalSec: 100 } as unknown as Device["currentTask"];
  expect(nodes(screen.byClass("device-inventory-row__task")!).some(node => node.children === "50%")).toBe(true);
  expect(screen.byClass("device-inventory-row__fill")!.props!.style).toMatchObject({ width: "50%" });
  screen.visibility.hidden = true;
  expect(screen.byClass("device-inventory-row__fill")).toBeUndefined();
});

it("preserves disabled activation, remote pending-deactivation, and read-only controls", () => {
  const screen = mount();
  screen.props.active = false; screen.props.disabled = true;
  const activate = () => screen.byClass("device-inventory-row__action")!;
  expect(activate().props).toMatchObject({ variant: "brand", disabled: true, label: screen.t.myDevices.inventoryRowSlotsFull });
  activate().props!.onClick(); expect(screen.emit).not.toHaveBeenCalled();
  expect(screen.byClass("device-inventory-row__task")).toBeUndefined();
  expect(screen.byClass("device-inventory-row__tradein-cta")!.props!.variant).toBe("secondary");
  screen.props.disabledLabel = "Refresh before activation";
  expect(activate().props!.label).toBe("Refresh before activation");
  screen.props.active = true; screen.props.disabled = false; screen.props.actionDisabled = true; screen.device.pendingDeactivate = true;
  expect(screen.byClass("device-inventory-row__pending")).toBeDefined();
  activate().props!.onClick(); expect(screen.emit).not.toHaveBeenCalled();
  screen.props.showAction = false; expect(screen.byClass("device-inventory-row__action")).toBeUndefined();
  expect(screen.byClass("device-inventory-row__tradein-cta")).toBeUndefined();
});

it("keeps a confirmed pending-deactivation visible on the card", () => {
  const screen = mount(); screen.device.pendingDeactivate = true;
  expect(nodes(screen.byClass("device-inventory-row__pending")!).some(node => node.children === screen.t.myDevices.inventoryPendingDeactivateChip)).toBe(true);
  expect(screen.byClass("device-inventory-row__state--active")).toBeDefined();
});

it.each(["zh", "en", "vi"] as const)("shows only activated Online and preserves read failure in %s", locale => {
  const screen = mount(locale);
  for (const runtime of ["OFFLINE", "UNKNOWN"] as const) {
    screen.device.runtimeStatus = runtime;
    expect(nodes(screen.byClass("device-inventory-row__state")!).some(node => node.children === screen.t.earn.online)).toBe(true);
    expect(screen.byClass("device-inventory-row__status")).toBeUndefined();
    expect(screen.byClass("device-inventory-row__state--active")).toBeDefined();
  }
  screen.props.runtimeConfirmed = false;
  expect(screen.byClass("device-inventory-row__status")!.children).toBe(screen.t.earn.runtimeUnknown);
  expect(screen.byClass("device-inventory-row__state")).toBeUndefined();
  screen.props.runtimeConfirmed = true;
  screen.props.active = false; screen.device.activatedAt = null;
  expect(screen.byClass("device-inventory-row__status")).toBeUndefined();
  expect(screen.byClass("device-inventory-row__state--active")).toBeUndefined();
  screen.device.activationUnconfirmed = true;
  expect(screen.byClass("device-inventory-row__status")!.children).toBe(screen.t.earn.runtimeUnknown);
  expect(screen.t.myDevices.inventorySectionDevices).toBe("Online");
  expect(screen.t.myDevices.inventorySectionInventory).not.toBe("Offline");
});

it.each(["stellarbox-s1", "stellarbox-pro", "stellarbox-pro-v2", "stellarrack-p1", "stellarrack-p2", "cloud-share"] as const)("uses the actual %s product artwork", kind => {
  const screen = mount(); screen.device.kind = kind; screen.device.productCode = kind;
  expect(screen.byClass("device-inventory-row__image")!.props!.src).toBe(`https://catalog.example/${kind}`);
});

it("masks hidden earnings and does not claim an amount before the fleet read is confirmed", () => {
  const screen = mount("zh");
  screen.visibility.hidden = true;
  expect(screen.byClass("device-inventory-row__earned")!.children).toBe("••••");
  expect(screen.byClass("device-inventory-row__today")!.children).toBe("••••");
  expect(screen.byClass("device-inventory-row__info")!.props!["aria-label"]).not.toContain("200.00");
  screen.visibility.hidden = false; screen.props.runtimeConfirmed = false;
  expect(screen.byClass("device-inventory-row__earned")!.children).toBe("—");
  expect(screen.byClass("device-inventory-row__today")!.children).toBe("—");
});

it("opens quote help with the keyboard and closes it on Escape or Tab without moving focus", () => {
  const screen = mount("zh");
  const key = (value: string) => {
    const handlers = screen.byClass("device-inventory-row__info")!.props!.onKeydown;
    for (const handler of [handlers].flat()) handler({ key: value, stopPropagation() {}, preventDefault() {} });
  };
  key("Enter"); expect(screen.props.quoteInfoOpen).toBe(true);
  key("Escape"); expect(screen.props.quoteInfoOpen).toBe(false);
  key(" "); expect(screen.props.quoteInfoOpen).toBe(true);
  key("Tab"); expect(screen.props.quoteInfoOpen).toBe(false);
});

it("shows quote help in a dismissible bubble, including when the quote is unavailable", () => {
  const screen = mount("zh");
  screen.props.tradeinQuoteAmount = undefined;
  expect(screen.byClass("device-inventory-row__tradein-disabled")!.children).toBe(screen.t.tradein.quoteUnavailable);
  expect(screen.byClass("device-inventory-row__info")!.props!["aria-label"]).toContain(screen.t.tradein.quoteUnavailable);
  expect(screen.byClass("device-inventory-row__popover")).toBeUndefined();
  screen.byClass("device-inventory-row__info")!.props!.onClick({ stopPropagation() {} });
  expect(screen.byClass("device-inventory-row__popover-copy")!.children).toBe(screen.t.tradein.ladderIntro);
  expect(screen.byClass("device-inventory-row__popover-footnote")!.children).toBe(screen.t.tradein.ladderFootnote);
  screen.byClass("device-inventory-row__info")!.props!.onClick({ stopPropagation() {} });
  expect(screen.byClass("device-inventory-row__popover")).toBeUndefined();
  expect(screen.emit.mock.calls).toEqual([["quote-info", true], ["quote-info", false]]);
  screen.props.tradeinCtaLabel = undefined;
  screen.props.tradeinDisabledText = screen.t.tradein.stripNoTarget;
  expect(screen.byClass("device-inventory-row__tradein-cta")).toBeUndefined();
  expect(screen.byClass("device-inventory-row__tradein-disabled")!.children).toBe(screen.t.tradein.stripNoTarget);
  expect(screen.byClass("device-inventory-row__info")!.props!["aria-label"]).toContain(screen.t.tradein.stripNoTarget);
});
