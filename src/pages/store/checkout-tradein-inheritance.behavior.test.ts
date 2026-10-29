import { ref } from "vue";
import { expect, it, vi } from "vitest";
import ts from "typescript";
import source from "./checkout.vue?raw";
import { completeVerifiedMutation } from "@/domain/e20-capacity-coordinator";
import { asApiError } from "@/api/errors";
import { en } from "@/i18n/messages/en";

const ast = ts.createSourceFile("checkout.ts", source.split('<script setup lang="ts">')[1].split("</script>")[0], ts.ScriptTarget.Latest, true);
function handler(name: string, deps: Record<string, unknown>) {
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)!;
  const code = ts.transpileModule(node.getText(ast) + `; return ${name};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(deps), code)(...Object.values(deps));
}
function checkout(active: boolean) {
  const quote = { sourceDeviceId: 11, sourceRowVersion: 9, targetDeviceStatus: active ? "ACTIVE" : "INACTIVE" };
  const submitted = { tradeinNo: "TI-1", orderNo: "ORD-1", sourceDeviceId: 11, targetDeviceId: 33,
    targetDeviceStatus: quote.targetDeviceStatus, walletDebitUsdt: 80, discountUsdt: 20 };
  const order = { ...submitted, canonicalStatus: active ? "activated" : "inventory", paymentStatus: "PAID",
    orderStatus: "COMPLETED", activationStatus: active ? "ACTIVATED" : "INVENTORY", amountUsdt: 80 };
  const target = { id: "33", activatedAt: active ? 1000 : null, activationUnconfirmed: false };
  const deps = {
    completeVerifiedMutation, asApiError, captureCheckoutRoute: () => ({}), isCurrentCheckoutRoute: () => true,
    app: { user: { usdtBalance: 100 }, captureRemoteAccountRequest: () => ({}), devices: [target],
      refreshRemoteFleet: vi.fn().mockResolvedValue(true) },
    product: ref({ id: "stellarbox-pro" }), purchaseUnavailable: ref(false), voucherQuote: { id: null },
    quotedTotal: 80, confirming: true, offerWalletTopup: vi.fn(), refreshPurchaseEligibility: vi.fn().mockResolvedValue("eligible"),
    tradein: { appliedTradein: { canonicalQuote: quote }, clearApplied: vi.fn() },
    appliedTradeinView: ref({ device: { id: "11" }, canonicalQuote: quote }),
    deviceE3Api: { submit: vi.fn().mockResolvedValue(submitted) },
    orderApi: { list: vi.fn().mockResolvedValue({ orders: [order] }), create: vi.fn(), pay: vi.fn() },
    orders: { refreshRemote: vi.fn().mockResolvedValue(true) }, remoteOrderKey: () => "e3-same-key",
    remoteTradeinRecoveryRequired: ref(false), retireRemoteOrderKey: vi.fn(), orderId: ref(null), step: ref("confirm"),
    t: ref(en), toast: { warn: vi.fn(), error: vi.fn() },
  };
  return { ...deps, target, order, quote, submit: handler("submitRemoteOrder", deps) };
}

it.each([true, false])("the actual RETIRE handler verifies the selected source placement active=%s", async active => {
  const h = checkout(active); await h.submit();
  expect(h.deviceE3Api.submit).toHaveBeenCalledWith(11, "stellarbox-pro", "e3-same-key", h.quote);
  expect(h.orderId.value).toBe("ORD-1"); expect(h.step.value).toBe("live");
  expect(h.orderApi.create).not.toHaveBeenCalled(); expect(h.orderApi.pay).not.toHaveBeenCalled();
  expect(h.tradein.clearApplied).toHaveBeenCalledOnce();
  expect(h.retireRemoteOrderKey.mock.invocationCallOrder[0]).toBeLessThan(h.tradein.clearApplied.mock.invocationCallOrder[0]);
  expect(h.app.user.usdtBalance).toBe(100);
});

it.each([true, false])("does not commit a changed target placement active=%s", async active => {
  const h = checkout(active); h.target.activatedAt = active ? null : 1000;
  await h.submit();
  expect(h.orderId.value).toBeNull(); expect(h.step.value).toBe("confirm");
  expect(h.tradein.clearApplied).not.toHaveBeenCalled();
});

it("rejects an activated order for a warehouse quote before refreshing or committing", async () => {
  const h = checkout(false); h.order.canonicalStatus = "activated"; h.order.activationStatus = "ACTIVATED";
  await h.submit(); expect(h.app.refreshRemoteFleet).not.toHaveBeenCalled();
  expect(h.orderId.value).toBeNull(); expect(h.tradein.clearApplied).not.toHaveBeenCalled();
});

it("an already selected RETIRE source skips the full-slot capacity choice", async () => {
  const api = { capacityQuote: vi.fn(), eligibility: vi.fn() };
  const intercept = handler("fireTradeinIntercept", { interceptFired: false, trialConversionMode: ref(false),
    getProduct: () => ({ id: "stellarbox-pro" }), productId: ref("stellarbox-pro"), KNOWN_KINDS: ["stellarbox-pro"],
    tradein: { appliedTradein: { targetKind: "stellarbox-pro", oldDeviceId: "11" } }, deviceE3Api: api });
  await intercept(true); expect(api.capacityQuote).not.toHaveBeenCalled(); expect(api.eligibility).not.toHaveBeenCalled();
});

it("keeps ordinary recovery identities unchanged and isolates a new source revision", () => {
  const tradein = { appliedTradein: null as null | { canonicalQuote: { sourceDeviceId: number; sourceRowVersion: number } } };
  const intent = handler("remoteOrderIntent", { product: ref({ id: "stellarbox-pro" }), voucherQuote: { id: null }, payment: ref("wallet"), tradein });
  expect(intent()).toBe("stellarbox-pro||wallet|ordinary");
  tradein.appliedTradein = { canonicalQuote: { sourceDeviceId: 11, sourceRowVersion: 9 } };
  expect(intent()).toBe("stellarbox-pro||wallet|11|9");
  tradein.appliedTradein.canonicalQuote.sourceRowVersion = 10;
  expect(intent()).toBe("stellarbox-pro||wallet|11|10");
});
