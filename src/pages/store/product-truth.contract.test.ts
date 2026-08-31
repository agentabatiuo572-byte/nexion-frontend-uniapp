import { describe, expect, it } from "vitest";

const detail = (import.meta.glob("./detail.vue", {
  query: "?raw",
  import: "default",
  eager: true,
})["./detail.vue"] ?? "") as string;
const productCard = (import.meta.glob("../../components/store/product-card.vue", {
  query: "?raw",
  import: "default",
  eager: true,
})["../../components/store/product-card.vue"] ?? "") as string;
const productRender = (import.meta.glob("../../components/store/product-render.vue", {
  query: "?raw",
  import: "default",
  eager: true,
})["../../components/store/product-render.vue"] ?? "") as string;
const socialProof = (import.meta.glob("../../components/store/live-social-proof.vue", {
  query: "?raw",
  import: "default",
  eager: true,
})["../../components/store/live-social-proof.vue"] ?? "") as string;

describe("store product truth rendering", () => {
  it("uses the catalog product image in both card and detail views with a local fallback", () => {
    expect(productCard).toContain("props.product.imageUrl");
    expect(productCard).toContain("PRODUCT_PHOTO[props.product.id]");
    expect(productRender).toContain("imageUrl?: string");
    expect(productRender).toContain("props.imageUrl");
    expect(productRender).toContain("PHOTO_MAP[props.tier]");
  });

  it("keeps video playback on the detail page and falls back without autoplay", () => {
    expect(productCard).not.toContain("<video");
    expect(productRender).toContain("videoUrl?: string");
    expect(productRender).toContain("<video");
    expect(productRender).toContain(":autoplay=\"false\"");
    expect(productRender).toContain("fallbackProductVideo");
  });

  it("shows the canonical cumulative sales once and labels the order-derived activity window separately", () => {
    expect(detail).toContain("product.value?.sold");
    expect(detail).toContain("LiveSocialProof");
    expect(detail).toContain("cumulativeSalesLabel");
    expect(socialProof).toContain("cumulativeSalesLabel");
    expect(socialProof).toContain("proof.windowDays");
  });

  it("does not claim a fixed data-center location in the FAQ", () => {
    expect(detail).toContain("product.value?.datacenter");
    expect(detail).not.toContain("f.location, f.withdraw");
  });
});
