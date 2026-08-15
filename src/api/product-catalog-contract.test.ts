import { describe, expect, it } from "vitest";
import { parseProductCatalogPayload } from "./product-catalog-contract";

const product = {
  id: "sku-1", name: "Box", tier: "Pro", tagline: "managed", badge: null,
  gpu: "H100", vram: "80GB", power: "700W", datacenter: "Singapore DC",
  uptime: "99.9%", warranty: "24 months", phoneDailyEarn: "0.06 USDT/day",
  phoneDailyEarnNEX: "10 NEX/day", hashRate: null, dailyEarn: 13, dailyEarnNEX: 80,
  price: 1000, sold: 0, stock: 1, features: [], ai: null, status: "active",
  available: true, releaseState: null, releasePhaseId: null, unlocksAtPhase: null,
  purchaseGate: null,
};

describe("product catalog strict specification contract", () => {
  it("accepts complete remote specs and preserves them for detail pages", () => {
    const result = parseProductCatalogPayload({ source: "nx_product", revision: null, products: [product] });
    expect(result.products[0]).toMatchObject({ gpu: "H100", datacenter: "Singapore DC", warranty: "24 months" });
  });

  it("accepts explicit unavailable values but rejects blank specification fields", () => {
    const unavailable = { ...product, gpu: "unavailable", vram: "unavailable", power: "unavailable", datacenter: "unavailable", uptime: "unavailable", warranty: "unavailable", phoneDailyEarn: "unavailable", phoneDailyEarnNEX: "unavailable" };
    expect(() => parseProductCatalogPayload({ source: "nx_product", revision: null, products: [unavailable] })).not.toThrow();
    expect(() => parseProductCatalogPayload({ source: "nx_product", revision: null, products: [{ ...product, power: "  " }] })).toThrow("PRODUCT_CATALOG_RESPONSE_INVALID");
  });

  it("requires a reason when the server blocks purchase", () => {
    expect(() => parseProductCatalogPayload({ source: "nx_product", revision: null, products: [{ ...product, purchaseBlocked: true }] })).toThrow("PRODUCT_CATALOG_RESPONSE_INVALID");
    expect(parseProductCatalogPayload({ source: "nx_product", revision: null, products: [{ ...product, purchaseBlocked: true, purchaseBlockedReason: "PRODUCT_SPECS_UNAVAILABLE" }] }).products[0].purchaseBlocked).toBe(true);
  });

  it("rejects an untagged mock catalog", () => {
    expect(() => parseProductCatalogPayload({ source: "mock", revision: null, products: [product] }))
      .toThrow("PRODUCT_CATALOG_RESPONSE_INVALID");
  });
});
