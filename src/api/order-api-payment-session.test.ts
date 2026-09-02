import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { createOrderApi } from "./order-api";

describe("HDPay commerce payment session", () => {
  it("posts an idempotent command and accepts only a trusted hosted HTTPS page", async () => {
    const request = vi.fn().mockResolvedValue({
      orderNo: "ORD-1",
      intentNo: "VQR-COMMERCE-1",
      paymentMode: "hosted",
      providerStatus: "created",
      paymentUrl: "https://c.gmobvfxllc.com/order/1",
      paymentUrlTrusted: true,
      status: "awaiting_payment",
      amountUsdt: 1,
      vndAmount: 26000,
      serverCanonical: true,
      source: "server",
      sourceEnvironment: "PRODUCTION",
      runId: "",
    });
    const api = createOrderApi({ request } as unknown as ApiClient, "prod");

    await expect(api.createPaymentSession("ORD-1", "session-key"))
      .resolves.toMatchObject({
        orderNo: "ORD-1",
        intentNo: "VQR-COMMERCE-1",
        paymentUrl: "https://c.gmobvfxllc.com/order/1",
        paymentUrlTrusted: true,
      });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/api/orders/ORD-1/payment-session",
      idempotencyKey: "session-key",
    }));
  });

  it.each([
    { paymentUrl: "http://c.gmobvfxllc.com/order/1", paymentUrlTrusted: true },
    { paymentUrl: "https://pay.example.com/order/1", paymentUrlTrusted: true },
    { paymentUrl: "https://c.gmobvfxllc.com/order/1", paymentUrlTrusted: false },
  ])("rejects an unsafe provider page: %o", async (override) => {
    const api = createOrderApi({ request: vi.fn().mockResolvedValue(Object.assign({
      orderNo: "ORD-1", intentNo: "VQR-COMMERCE-1",
      paymentMode: "hosted", providerStatus: "created",
      paymentUrl: "https://c.gmobvfxllc.com/order/1", paymentUrlTrusted: true,
      status: "awaiting_payment", amountUsdt: 1, vndAmount: 26000,
      serverCanonical: true, source: "server", sourceEnvironment: "PRODUCTION", runId: "",
    }, override)) } as unknown as ApiClient, "prod");

    await expect(api.createPaymentSession("ORD-1", "session-key"))
      .rejects.toMatchObject({ kind: "protocol", message: "ORDER_RESPONSE_INVALID" });
  });
});
