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
const productImage = (import.meta.glob("../../lib/product-image.ts", {
  query: "?raw",
  import: "default",
  eager: true,
})["../../lib/product-image.ts"] ?? "") as string;
const p2TestImage = import.meta.glob("../../static/img/products/stellarrack-p2-test-s1-reference.png", {
  query: "?url",
  import: "default",
  eager: true,
});
const socialProof = (import.meta.glob("../../components/store/live-social-proof.vue", {
  query: "?raw",
  import: "default",
  eager: true,
})["../../components/store/live-social-proof.vue"] ?? "") as string;

describe("store product truth rendering", () => {
  it("uses the catalog product image in both card and detail views with a local fallback", () => {
    expect(productCard).toContain("props.product.imageUrl");
    expect(productCard).toContain("productImageMeta(props.product.id)");
    expect(detail).toContain(':product-id="product.id"');
    expect(productRender).toContain("productId: string");
    expect(productRender).toContain("imageUrl?: string");
    expect(productRender).toContain("props.imageUrl");
    expect(productRender).toContain("productImageMeta(props.productId)");
  });

  it("uses the user-approved test visual for Rack P2 without reusing Rack P1", () => {
    expect(productImage).toContain('"stellarrack-p1": { src: "/static/img/products/nexgridrack-p1-v2.png", tierCode: "Rack P1" }');
    expect(productImage).toContain('"stellarrack-p2": { src: "/static/img/products/stellarrack-p2-test-s1-reference.png", tierCode: "Rack P2" }');
    expect(productImage).not.toMatch(/"stellarrack-p2"\s*:\s*\{[^}]*nexgridrack-p1-v2\.png/);
    expect(Object.keys(p2TestImage)).toHaveLength(1);
    expect(productImage).toContain("Public-test visual only");
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

/**
 * zentao #239:商品卡上的「解锁后购买」看起来是可展开的按钮,点了却没有任何实质反馈。
 *
 * 成因:展开区那两处渲染都带 `!remoteApiEnabled` 前置条件,而 remote 模式恰恰是线上模式 ——
 * 于是点一下只翻转一个不可见的开关、箭头转一下。未满足的条件其实**已经在商品详情页渲染**
 * (detail.vue 用服务端 policies),而卡片本身点击也去详情页。
 *
 * 判据:remote 模式下这一下必须**去详情页**(有真实去处),local 模式才原地展开;
 * 并且箭头形状要如实 —— remote 给前进箭头,不再用「展开箭头」暗示会展开。
 */
describe("locked card gate affordance tells the truth", () => {
  it("makes the actual footer CTA lead to eligibility details or retry instead of silently returning", () => {
    expect(productCard).toMatch(/<view[^>]*:aria-disabled="buyUnavailable \? 'true' : 'false'"[^>]*@click\.stop="onBuy"/);
    expect(productCard).toMatch(/const buyUnavailable = computed\([\s\S]{0,240}?eligibility\.value\.status === "loading"/);
    expect(productCard).toMatch(/if \(remoteApiEnabled\) \{\s*if \(eligibility\.value\.status === "error"\) void retryEligibility\(\);\s*else if \(eligibility\.value\.status === "ready" && eligibility\.value\.eligible\) goCheckout\(\);\s*else if \(eligibility\.value\.status === "ready"\) goDetail\(\);/);
  });

  it("routes a locked card to the product page in remote mode instead of expanding nothing", () => {
    const gateClick = productCard.slice(productCard.indexOf("function toggleGateDetails()"), productCard.indexOf("// Text helpers", productCard.indexOf("function toggleGateDetails()")));
    expect(gateClick).toContain('if (eligibility.value.status === "error") { void retryEligibility(); return; }');
    expect(gateClick).toMatch(/if \(remoteApiEnabled\) \{[\s\S]*?goDetail\(\);\s*return;/);
    expect(gateClick).not.toContain("gateDetailsOpen.value = !gateDetailsOpen.value");
  });

  it("uses a forward chevron for the gate route rather than an expand chevron", () => {
    const gateMarkup = productCard.slice(productCard.indexOf("<!-- Purchase gate"), productCard.indexOf("<!-- Trade-in callout"));
    expect(gateMarkup).toContain('<path d="m9 18 6-6-6-6"');
    expect(gateMarkup).not.toContain('<path d="m6 9 6 6 6-6"');
  });
});
