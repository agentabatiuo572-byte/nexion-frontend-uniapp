export interface ProductImageMeta {
  src?: string;
  tierCode: string;
}

const PRODUCT_IMAGE_META: Record<string, ProductImageMeta> = {
  "stellarbox-s1": { src: "/static/img/products/nexgridbox-s1-v4.png", tierCode: "S1" },
  "stellarbox-pro": { src: "/static/img/products/nexgridbox-pro-v2.png", tierCode: "Pro" },
  "stellarbox-pro-v2": { src: "/static/img/products/nexgridbox-pro-v2.png", tierCode: "Pro v2" },
  "stellarrack-p1": { src: "/static/img/products/nexgridrack-p1-v2.png", tierCode: "Rack P1" },
  "stellarrack-p2": { tierCode: "Rack P2" },
};

export function productImageMeta(productId: string): ProductImageMeta | undefined {
  return PRODUCT_IMAGE_META[productId];
}
