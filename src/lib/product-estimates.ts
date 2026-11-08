import type { Product } from "@/mock/products";

/** Per-unit catalog estimates. Legacy Share keeps each surface's annual-rate display. */
export function productDailyEstimateRange(product: Product): { low: number; high: number } | null {
  if (product.productType !== "SHARE") return { low: product.dailyEarn, high: product.dailyEarn };
  if (product.dailyEstimateLowUsdt == null || product.dailyEstimateHighUsdt == null) return null;
  return { low: product.dailyEstimateLowUsdt, high: product.dailyEstimateHighUsdt };
}
