import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { createBundleOrderApi } from "./bundle-order-api";
import { advanceRuntimeRevision } from "./order-api";
import bundleSource from "../pages/store/bundle.vue?raw";

describe("bundle order API", () => {
  afterEach(() => advanceRuntimeRevision(null));

  it("accepts a dynamically configured server discount", async () => {
    const request = vi.fn().mockResolvedValue({
      orderNo: "BND-DYNAMIC", orderType: "BUNDLE", itemCount: 2,
      productNos: ["a", "b"], subtotalUsdt: 300, discountRate: 0.07,
      discountUsdt: 21, amountUsdt: 279, paymentStatus: "PENDING",
      orderStatus: "PENDING_PAYMENT", idSource: "server", policyVersion: 7,
    });
    await expect(createBundleOrderApi({ request } as unknown as ApiClient)
      .create(["a", "b"], 7, "idem-dynamic"))
      .resolves.toMatchObject({ discountRate: 0.07, discountUsdt: 21, amountUsdt: 279 });
  });

  it("creates one server-priced bundle", async () => {
    const request = vi.fn().mockResolvedValue({
      orderNo: "BND-1", orderType: "BUNDLE", itemCount: 2,
      productNos: ["stellarbox-s1", "stellarbox-pro"], subtotalUsdt: 300,
      discountRate: 0.05, discountUsdt: 15, amountUsdt: 285,
      paymentStatus: "PENDING", orderStatus: "PENDING_PAYMENT", idSource: "server", policyVersion: 3,
    });
    const api = createBundleOrderApi({ request } as unknown as ApiClient);
    await expect(api.create(["stellarbox-s1", "stellarbox-pro"], 3, "bundle-key"))
      .resolves.toMatchObject({ orderNo: "BND-1", amountUsdt: 285 });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      path: "/api/orders/bundle", idempotencyKey: "bundle-key",
      body: { productNos: ["stellarbox-s1", "stellarbox-pro"], policyVersion: 3 },
    }));
  });

  it("rejects client-like or inconsistent totals", async () => {
    const request = vi.fn().mockResolvedValue({
      orderNo: "BND-1", orderType: "BUNDLE", itemCount: 2,
      productNos: ["a", "b"], subtotalUsdt: 300, discountRate: 0.05,
      discountUsdt: 15, amountUsdt: 300, paymentStatus: "PENDING",
      orderStatus: "PENDING_PAYMENT", idSource: "client", policyVersion: 3,
    });
    await expect(createBundleOrderApi({ request } as unknown as ApiClient)
      .create(["a", "b"], 3, "bundle-key")).rejects.toMatchObject({ message: "BUNDLE_ORDER_RESPONSE_INVALID" });
  });

  it("rejects retired sandbox receipts even when their run matches", async () => {
    advanceRuntimeRevision("sandbox-run-20260815");
    const request = vi.fn().mockResolvedValue({
      orderNo: "BND-SBX-1", orderType: "BUNDLE", itemCount: 2,
      productNos: ["stellarbox-s1", "stellarbox-pro"], subtotalUsdt: 300,
      discountRate: 0.05, discountUsdt: 15, amountUsdt: 285,
      paymentStatus: "PENDING", orderStatus: "PENDING_PAYMENT", idSource: "sandbox-server",
      source: "mock", sourceEnvironment: "SANDBOX", runId: "sandbox-run-20260815",
    });
    await expect(createBundleOrderApi({ request } as unknown as ApiClient)
      .create(["stellarbox-s1", "stellarbox-pro"], 3, "sandbox-key"))
      .rejects.toMatchObject({ kind: "protocol", message: "BUNDLE_ORDER_RESPONSE_INVALID" });
    advanceRuntimeRevision(null);
  });

  it("rejects a sandbox receipt from another run", async () => {
    advanceRuntimeRevision("sandbox-run-current");
    const request = vi.fn().mockResolvedValue({
      orderNo: "BND-SBX-2", orderType: "BUNDLE", itemCount: 2,
      productNos: ["a", "b"], subtotalUsdt: 300, discountRate: 0.05,
      discountUsdt: 15, amountUsdt: 285, paymentStatus: "PENDING",
      orderStatus: "PENDING_PAYMENT", idSource: "sandbox-server", source: "mock",
      sourceEnvironment: "SANDBOX", runId: "sandbox-run-other",
    });
    await expect(createBundleOrderApi({ request } as unknown as ApiClient)
      .create(["a", "b"], 3, "sandbox-key"))
      .rejects.toMatchObject({ message: "BUNDLE_ORDER_RESPONSE_INVALID" });
    advanceRuntimeRevision(null);
  });

  it("settles a remote bundle only through the NexGrid wallet", () => {
    expect(bundleSource).toContain("orderApi.pay(");
    expect(bundleSource).toContain("ORDER_WALLET_INSUFFICIENT");
    expect(bundleSource).toContain("/pages/me/wallet-topup");
    expect(bundleSource).not.toContain("createPaymentSession");
    expect(bundleSource).not.toContain("openHostedPaymentPage");
  });

  it("retires the purchase intent after a confirmed debit and treats order refresh as read-only recovery", () => {
    const confirmed = bundleSource.indexOf("paymentConfirmed = true");
    const retire = bundleSource.indexOf("retireBundleKey(list, accountKey)", confirmed);
    const clear = bundleSource.indexOf("cart.clear()", confirmed);
    const readback = bundleSource.indexOf("await orders.refreshRemote()", confirmed);
    expect(confirmed).toBeGreaterThan(-1);
    expect(retire).toBeGreaterThan(confirmed);
    expect(clear).toBeGreaterThan(retire);
    expect(readback).toBeGreaterThan(clear);
    expect(bundleSource).toContain("walletPaymentConfirmedRefreshPending");
  });

  it("rechecks the account after policy refresh before creating a bundle", () => {
    const policyRead = bundleSource.indexOf("const latestPolicy = await bundleDiscountApi.current()");
    const create = bundleSource.indexOf("const created = await bundleOrderApi.create(");
    const fence = bundleSource.indexOf("if (!scopeIsCurrent())", policyRead);
    expect(policyRead).toBeGreaterThan(-1);
    expect(fence).toBeGreaterThan(policyRead);
    expect(fence).toBeLessThan(create);
  });
});
