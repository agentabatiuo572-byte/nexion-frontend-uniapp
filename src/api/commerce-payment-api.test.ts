import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { createCommercePaymentApi } from "./commerce-payment-api";

describe("commerce development payment API", () => {
  it("posts a user-confirmed payment and validates Java canonical provenance", async () => {
    const request = vi.fn().mockResolvedValue({
      orderNo: "ORD-1", paymentNo: "PAY-DEV-0000000000000001", paymentStatus: "PAID",
      orderStatus: "COMPLETED", activationStatus: "ACTIVATED", canonicalStatus: "activated",
      source: "mock", sourceEnvironment: "SANDBOX", runId: "local-dev",
      walletBalanceAfterUsdt: 801, serverCanonical: true,
    });
    const api = createCommercePaymentApi({ request } as unknown as ApiClient);
    await expect(api.confirm("ORD-1", "pay-key")).resolves.toMatchObject({
      orderNo: "ORD-1", paymentNo: "PAY-DEV-0000000000000001", sourceEnvironment: "SANDBOX",
      walletBalanceAfterUsdt: 801,
    });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST", path: "/api/orders/ORD-1/pay", idempotencyKey: "pay-key",
    }));
  });

  it("rejects an acceptance-run receipt or malformed development receipt", async () => {
    const request = vi.fn().mockResolvedValue({
      orderNo: "CSO-1", paymentNo: "PAY-SBX-0000000000000001", paymentStatus: "PAID", orderStatus: "PAID",
      canonicalStatus: "paid", source: "mock", sourceEnvironment: "SANDBOX", runId: "sandbox-run-1",
    });
    await expect(createCommercePaymentApi({ request } as unknown as ApiClient)
      .confirm("CSO-1", "pay-key")).rejects.toMatchObject({ message: "COMMERCE_PAYMENT_RESPONSE_INVALID" });
  });
});
