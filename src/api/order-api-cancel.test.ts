import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { createOrderApi } from "./order-api";

describe("order cancellation API", () => {
  it("sends the authenticated idempotent cancel command and parses server state", async () => {
    const request = vi.fn().mockResolvedValue({
      orderNo: "ORD-1", orderStatus: "CANCELLED", paymentStatus: "CANCELLED",
      sourceEnvironment: "PRODUCTION", idempotent: false,
    });
    const api = createOrderApi({ request } as unknown as ApiClient);
    await expect(api.cancel("ORD-1", "cancel-key")).resolves.toMatchObject({ orderNo: "ORD-1" });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST", path: "/api/orders/ORD-1/cancel", idempotencyKey: "cancel-key",
    }));
  });
});
