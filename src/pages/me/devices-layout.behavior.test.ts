import * as Vue from "vue";
import { parse } from "@vue/compiler-sfc";
import { compile } from "@vue/compiler-dom";
import { expect, it, vi } from "vitest";
import source from "./devices.vue?raw";
import { en } from "@/i18n/messages/en";
import { zh } from "@/i18n/messages/zh";
import { vi as vietnamese } from "@/i18n/messages/vi";

const messages = { en, zh, vi: vietnamese };
// AppChassis renders as a plain element here, so its fixed-bar slot is asserted on the source instead.
const render = new Function("Vue", compile(parse(source).descriptor.template!.content.replace(/<template #pageFixed>[\s\S]*?<\/template>/, ""), {
  mode: "function", prefixIdentifiers: true, isCustomElement: () => true,
}).code)(Vue);
function nodes(node: Vue.VNode): Vue.VNode[] {
  return [node, ...(Array.isArray(node.children) ? node.children.flatMap(child => Vue.isVNode(child) ? nodes(child) : []) : [])];
}
function mount(locale: keyof typeof messages = "en") {
  const paid = { id: "paid-1" }, pending = { id: "paid-2" }, unconfirmed = { id: "paid-3" };
  const context = {
    t: messages[locale], inventoryReady: true, inventoryLoading: false, inventoryError: false, inventoryStale: false,
    app: { slotCap: 6, remoteFleetStatus: "ready" }, slotMeterLabel: "3/6", slotsUsed: 3, segStyle: () => ({}),
    activeDevices: [paid], inactiveDevices: [pending], unconfirmedDevices: [unconfirmed], inventoryEmpty: false,
    trialPresentation: { active: { value: true } }, cancelTrialBusy: false, handleCancelTrial: vi.fn(),
    remoteApiEnabled: true, canControlDevice: () => true, tradeinStrip: () => ({}),
    handleActivate: vi.fn(), handleDeactivate: vi.fn(), handleTradein: vi.fn(), quoteInfoDeviceId: null as string | null,
    slotsFull: false, activationReady: true, phoneNeedsActivation: true, nativePhoneAvailable: false,
    phoneActivationGuidance: { title: "Phone", body: "Connect in the Android app" }, goPhoneActivation: vi.fn(),
    goStore: vi.fn(), sheetDevice: null, onSheetWait: vi.fn(), onSheetForce: vi.fn(),
    bays: [] as Array<Record<string, unknown>>, openBay: vi.fn(), onlineCount: 2, trialCopy: { imageBadge: "Trial" },
    fmt: (text: string, args: Record<string, unknown>) => text.replace(/\{(\w+)\}/g, (_, key) => String(args[key])),
  };
  const node = () => render(context, []) as Vue.VNode;
  return { context, paid, pending, node };
}

it.each(["zh", "en", "vi"] as const)("places trial and purchased devices together before inventory and connection entries in %s", locale => {
  const screen = mount(locale), tree = nodes(screen.node());
  const sections = tree.filter(node => node.props?.["data-inventory-section"]);
  expect(sections.map(node => node.props!["data-inventory-section"])).toEqual(["devices", "pending", "unconfirmed", "connections"]);
  expect(tree.some(node => node.type === "ComputeShareEntry")).toBe(false);
  const fleet = nodes(sections[0]);
  expect(fleet.some(node => node.children === messages[locale].myDevices.inventorySectionDevices)).toBe(true);
  expect(fleet.some(node => node.type === "text" && node.children === "2")).toBe(true);
  expect(fleet.filter(node => ["TrialDeviceRow", "DeviceInventoryRow"].includes(String(node.type))).map(node => node.type)).toEqual(["TrialDeviceRow", "DeviceInventoryRow"]);
  screen.context.trialPresentation.active.value = false;
  expect(nodes(screen.node()).filter(node => node.type === "TrialDeviceRow")).toHaveLength(0);
  expect(screen.context.slotsUsed).toBe(3);
});

it("keeps original paid and trial action handlers and the native phone gate", () => {
  const screen = mount(), tree = nodes(screen.node());
  const rows = tree.filter(node => node.type === "DeviceInventoryRow");
  rows[0].props!.onToggle(); expect(screen.context.handleDeactivate).toHaveBeenCalledExactlyOnceWith(screen.paid);
  rows[1].props!.onToggle(); expect(screen.context.handleActivate).toHaveBeenCalledExactlyOnceWith(screen.pending);
  rows[0].props!.onTradein(); expect(screen.context.handleTradein).toHaveBeenCalledExactlyOnceWith(screen.paid);
  expect(tree.some(node => node.type === "TradeinLadderSheet")).toBe(false);
  rows[0].props!.onQuoteInfo(true); expect(screen.context.quoteInfoDeviceId).toBe(screen.paid.id);
  tree.find(node => node.type === "AppChassis")!.props!.onClick(); expect(screen.context.quoteInfoDeviceId).toBeNull();
  tree.find(node => node.type === "TrialDeviceRow")!.props!.onCancel(); expect(screen.context.handleCancelTrial).toHaveBeenCalledTimes(1);
  const phoneCta = () => nodes(screen.node()).find(node => node.props?.label === en.myDevices.phoneActivationCta);
  expect(phoneCta()).toBeUndefined();
  screen.context.nativePhoneAvailable = true;
  phoneCta()!.props!.onClick(); expect(screen.context.goPhoneActivation).toHaveBeenCalledTimes(1);
});

it("puts the store action in the bottom bar and turns free bays into store entries", () => {
  expect(source).toMatch(/<template #pageFixed>\s*<view class="device-page__bar"><NxButton class="device-page__bar-btn" variant="primary" :label="t\.myDevices\.inventoryCtaGoStore" @click="goStore">/);
  const screen = mount("zh");
  screen.context.bays = [{ key: "empty:0", kind: "empty" }];
  const free = nodes(screen.node()).find(node => String(node.props?.class ?? "").includes("device-bay-slot--empty"))!;
  expect(free.props!["aria-label"]).toBe(messages.zh.myDevices.inventoryCtaGoStore);
  free.props!.onClick(); expect(screen.context.goStore).toHaveBeenCalledTimes(1);
});
