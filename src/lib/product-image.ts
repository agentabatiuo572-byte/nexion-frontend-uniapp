import type { ProductSeriesCode } from "@/mock/products";

// Text labels for approved catalog photos. These never select an image asset.
const PRODUCT_TIER_CODES: Partial<Record<ProductSeriesCode, string>> = {
  S1: "S1",
  PRO: "Pro",
  PRO_V2: "Pro v2",
  RACK_P1: "Rack P1",
  RACK_P2: "Rack P2",
};

export function productTierCode(seriesCode: ProductSeriesCode | null, fallback: string): string {
  return (seriesCode && PRODUCT_TIER_CODES[seriesCode]) || fallback;
}

/** Only the current catalog image may render; a failed URL stays hidden until it changes. */
export function catalogProductImageUrl(imageUrl: string | undefined, failedImageUrl: string): string | null {
  return imageUrl && imageUrl !== failedImageUrl ? imageUrl : null;
}
