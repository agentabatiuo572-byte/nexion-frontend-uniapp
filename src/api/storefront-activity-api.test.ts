import { describe, expect, it, vi } from "vitest";
import { createStorefrontActivityApi } from "./storefront-activity-api";
import { setCurrentCommerceSandboxRun } from "./order-api";

describe("storefront activity api", () => {
  it("accepts anonymous paid-order facts without inventing identity or viewing fields", async () => {
    const request = vi.fn().mockResolvedValue({
      source: "nx_order/nx_order_item/nx_product",
      sourceEnvironment: "PRODUCTION",
      runId: "",
      items: [{ eventType: "ORDER_PAID", productName: "StellarBox Pro", occurredAt: "2026-08-15T11:00" }],
      nextCursor: null,
    });

    await expect(createStorefrontActivityApi({ request } as never).activity(5)).resolves.toEqual({
      source: "nx_order/nx_order_item/nx_product",
      sourceEnvironment: "PRODUCTION",
      runId: "",
      items: [{ eventType: "ORDER_PAID", productName: "StellarBox Pro", occurredAt: "2026-08-15T11:00" }],
      nextCursor: null,
    });
    expect(request).toHaveBeenCalledWith({ path: "/api/storefront/activity?limit=5" });
  });

  it("rejects malformed social proof instead of filling missing numbers locally", async () => {
    const request = vi.fn().mockResolvedValue({
      source: "nx_product/nx_order/nx_order_item",
      sourceEnvironment: "SANDBOX",
      productName: "StellarBox Pro",
      cumulativeSales: 3,
      windowDays: 30,
    });

    await expect(createStorefrontActivityApi({ request } as never).socialProof("stellarbox-pro", 30))
      .rejects.toMatchObject({ message: "STOREFRONT_SOCIAL_PROOF_RESPONSE_INVALID" });
  });

  it("accepts sandbox social proof only from the current commerce run", async () => {
    const runId = "sandbox-run-20260816";
    setCurrentCommerceSandboxRun(runId);
    const request = vi.fn().mockResolvedValue({
      source: "nx_commerce_sandbox_catalog/nx_commerce_sandbox_order/nx_commerce_sandbox_inventory",
      sourceEnvironment: "SANDBOX",
      runId,
      productName: "StellarBox Pro",
      cumulativeSales: 3,
      windowDays: 30,
      windowSales: 1,
    });

    await expect(createStorefrontActivityApi({ request } as never, "dev").socialProof("stellarbox-pro", 30))
      .resolves.toMatchObject({ sourceEnvironment: "SANDBOX", runId, cumulativeSales: 3, windowSales: 1 });
    setCurrentCommerceSandboxRun(null);
  });

  it("rejects stale sandbox social proof and production facts in sandbox mode", async () => {
    setCurrentCommerceSandboxRun("sandbox-run-20260816");
    const request = vi.fn()
      .mockResolvedValueOnce({
        source: "nx_commerce_sandbox_catalog/nx_commerce_sandbox_order/nx_commerce_sandbox_inventory",
        sourceEnvironment: "SANDBOX",
        runId: "sandbox-run-20260815",
        productName: "StellarBox Pro", cumulativeSales: 3, windowDays: 30, windowSales: 1,
      })
      .mockResolvedValueOnce({
        source: "nx_product/nx_order/nx_order_item",
        sourceEnvironment: "PRODUCTION", runId: "",
        productName: "StellarBox Pro", cumulativeSales: 3, windowDays: 30, windowSales: 1,
      });
    const api = createStorefrontActivityApi({ request } as never, "dev");
    await expect(api.socialProof("stellarbox-pro", 30)).rejects.toMatchObject({ message: "STOREFRONT_SOCIAL_PROOF_RESPONSE_INVALID" });
    await expect(api.socialProof("stellarbox-pro", 30)).rejects.toMatchObject({ message: "STOREFRONT_SOCIAL_PROOF_RESPONSE_INVALID" });
    setCurrentCommerceSandboxRun(null);
  });
});
