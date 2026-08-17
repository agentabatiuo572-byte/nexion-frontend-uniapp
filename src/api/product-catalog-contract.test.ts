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

  it("accepts explicit unavailable values", () => {
    const unavailable = { ...product, gpu: "unavailable", vram: "unavailable", power: "unavailable", datacenter: "unavailable", uptime: "unavailable", warranty: "unavailable", phoneDailyEarn: "unavailable", phoneDailyEarnNEX: "unavailable" };
    expect(() => parseProductCatalogPayload({ source: "nx_product", revision: null, products: [unavailable] })).not.toThrow();
  });

  // 🔴 这一格以前不存在,而它才是真后端的常态:`uptime` / `warranty` / `phoneDailyEarn` /
  // `phoneDailyEarnNEX` 在后端既无列、也无运营录入面、PRD 亦未承诺;`gpu` / `vram` / `power` /
  // `datacenter` 后端可空,运营在后台表单留空即不下发。旧契约把八个字段全设成必填,于是
  // **少一个规格 = 整份目录抛错 = 商城一件商品都没有**。缺失必须降级,不能作废全量。
  const SPEC_FIELDS = ["gpu", "vram", "power", "datacenter", "uptime", "warranty", "phoneDailyEarn", "phoneDailyEarnNEX"] as const;

  it("keeps the catalog alive when the server omits display specs", () => {
    const serverShaped: Record<string, unknown> = { ...product };
    for (const f of SPEC_FIELDS) delete serverShaped[f];
    const parsed = parseProductCatalogPayload({ source: "nx_product", revision: null, products: [serverShaped] });
    expect(parsed.products).toHaveLength(1);
    for (const f of SPEC_FIELDS) expect(parsed.products[0][f]).toBeUndefined();
  });

  it("treats every absent / null / blank spec as missing rather than fatal", () => {
    for (const f of SPEC_FIELDS) {
      for (const blank of [undefined, null, "", "   "]) {
        const one = { ...product, [f]: blank };
        expect(() => parseProductCatalogPayload({ source: "nx_product", revision: null, products: [one] }),
          `${f} = ${JSON.stringify(blank)} must not void the whole catalog`).not.toThrow();
      }
    }
  });

  it("still rejects a spec of the wrong type", () => {
    for (const bad of [42, {}, []]) {
      expect(() => parseProductCatalogPayload({ source: "nx_product", revision: null, products: [{ ...product, gpu: bad }] }))
        .toThrow("PRODUCT_CATALOG_RESPONSE_INVALID");
    }
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
