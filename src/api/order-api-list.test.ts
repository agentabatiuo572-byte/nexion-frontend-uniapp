import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { createOrderApi, advanceRuntimeRevision } from "./order-api";

function order() {
  return {
    orderNo: "ORD-1", productId: 1, productNo: "stellarrack-p1", productName: "Rack",
    quantity: 1, subtotalUsdt: 100, unitPriceUsdt: 100, discountUsdt: 0, amountUsdt: 100,
    paymentMethod: "USDT", paymentStatus: "PENDING", orderStatus: "PENDING_PAYMENT",
    activationStatus: "WAITING_PAYMENT", canonicalStatus: "placed", orderType: "SINGLE",
    placedAt: 1, paidAt: null, activatedAt: null, dataCenter: "Frankfurt DC",
    tradeinNo: null, sourceDeviceId: null, targetDeviceId: null,
    targetDeviceInstanceNo: null, itemCount: null,
  };
}

function api(payload: unknown, mode: "prod" | "dev") {
  return createOrderApi({ request: vi.fn().mockResolvedValue(payload) } as unknown as ApiClient, mode);
}

afterEach(() => advanceRuntimeRevision(null));

describe("order list provenance", () => {
  it("remote mode accepts only server production data", async () => {
    await expect(api({ source: "server", sourceEnvironment: "PRODUCTION", runId: null, serverCanonical: true, orders: [order()] }, "prod").list())
      .resolves.toMatchObject({ source: "server", sourceEnvironment: "PRODUCTION", runId: null, serverCanonical: true });
  });

  it("remote mode rejects sandbox/mock data", async () => {
    advanceRuntimeRevision("run-20260817");
    await expect(api({ source: "mock", sourceEnvironment: "SANDBOX", runId: "run-20260817", serverCanonical: true, orders: [order()] }, "prod").list())
      .rejects.toMatchObject({ message: "ORDER_RESPONSE_INVALID" });
  });

  it("development mode accepts the same Java production-shaped order authority", async () => {
    await expect(api({ source: "server", sourceEnvironment: "PRODUCTION", runId: null, serverCanonical: true, orders: [order()] }, "dev").list())
      .resolves.toMatchObject({ source: "server", sourceEnvironment: "PRODUCTION", runId: null, serverCanonical: true });
  });

  it("development mode rejects sandbox data even when its RunID is current", async () => {
    advanceRuntimeRevision("run-20260817");
    await expect(api({ source: "mock", sourceEnvironment: "SANDBOX", runId: "run-20260817", serverCanonical: true, orders: [order()] }, "dev").list())
      .rejects.toMatchObject({ message: "ORDER_RESPONSE_INVALID" });
  });

  it("rejects an order envelope without the server canonical marker", async () => {
    await expect(api({ source: "server", sourceEnvironment: "PRODUCTION", runId: null, orders: [order()] }, "prod").list())
      .rejects.toMatchObject({ message: "ORDER_RESPONSE_INVALID" });
    await expect(api({ source: "server", sourceEnvironment: "PRODUCTION", runId: null, serverCanonical: false, orders: [order()] }, "prod").list())
      .rejects.toMatchObject({ message: "ORDER_RESPONSE_INVALID" });
  });
});
