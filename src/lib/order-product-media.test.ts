import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ products: [] as { id: string; imageUrl?: string }[], status: "ready", proof: false, display: [] as { id: string; imageUrl?: string }[] }));
vi.mock("@/mock/products", () => ({ getProduct: (id: string) => state.products.find(product => product.id === id) }));
vi.mock("@/store/product-catalog", () => ({ productCatalogState: { get status() { return state.status; } },
  productCatalogPresentation: { get value() { return { products: state.display }; } }, isProductCatalogDisplayCurrent: () => state.proof }));
import { getOrderProductMedia, getProductMedia } from "./product-media";

const skus = ["stellarbox-s1", "stellarbox-pro", "stellarbox-pro-v2", "stellarrack-p1", "stellarrack-p2", "cloud-share"];
const catalog = skus.map(id => ({ id, imageUrl: `https://catalog.example/approved/${id}.webp` }));

beforeEach(() => { state.products = catalog; state.status = "ready"; state.proof = false; state.display = []; });

describe("order art follows the storefront catalog", () => {
  it.each(skus)("uses the approved %s main image for plain and quantity snapshots", sku => {
    for (const productNo of [sku, `${sku}×1`, `${sku}×12`]) {
      expect(getOrderProductMedia(productNo)).toMatchObject({ src: `https://catalog.example/approved/${sku}.webp` });
    }
  });
  it("uses the first structured bundle SKU and supports a new SKU absent from bundled art", () => {
    state.products = [...catalog, { id: "new-sku", imageUrl: "https://catalog.example/new.webp" }];
    expect(getOrderProductMedia("aggregate", [{ sku: "new-sku" }, { sku: "stellarbox-s1" }])?.src).toBe("https://catalog.example/new.webp");
  });
  it("follows a catalog image replacement without changing the order snapshot", () => {
    const productNo = "stellarbox-pro-v2×1";
    state.products = [{ id: "stellarbox-pro-v2", imageUrl: "https://catalog.example/black-pro-v2.webp" }];
    expect(getOrderProductMedia(productNo)?.src)
      .toBe("https://catalog.example/black-pro-v2.webp");
    expect(productNo).toBe("stellarbox-pro-v2×1");
  });
  it("does not substitute a bundled family image when the catalog image is missing or withdrawn", () => {
    state.products = [];
    expect(getOrderProductMedia("stellarbox-pro-v2×1")).toBeNull();
    state.products = [{ id: "stellarbox-pro-v2" }];
    expect(getOrderProductMedia("stellarbox-pro-v2×1")).toBeNull();
    state.products = catalog;
    expect(getOrderProductMedia("aggregate", [{ sku: "unknown" }])).toBeNull();
  });
  it("uses only a current retained catalog while loading and drops it when its proof is invalid", () => {
    state.status = "loading"; state.proof = true; state.display = catalog;
    expect(getProductMedia("stellarbox-pro-v2")?.src).toBe(catalog[2].imageUrl);
    state.proof = false;
    expect(getProductMedia("stellarbox-pro-v2")).toBeNull();
  });
  it.each(["unknown×1", "stellarbox-s1×0", "stellarbox-s1x1", "stellarbox-s1×-1", "UVELBox S1", "stellarbox-s1×1 + cloud-share×1"])("does not guess an unrecognized identity: %s", sku => {
    expect(getOrderProductMedia(sku)).toBeNull();
  });
});
