import type { Product } from "@/mock/products";

/** Per-unit catalog estimates. A Share without the server's daily range has none, and its surfaces show "—". */
export function productDailyEstimateRange(product: Product): { low: number; high: number } | null {
  if (product.productType !== "SHARE") return { low: product.dailyEarn, high: product.dailyEarn };
  if (product.dailyEstimateLowUsdt == null || product.dailyEstimateHighUsdt == null) return null;
  return { low: product.dailyEstimateLowUsdt, high: product.dailyEstimateHighUsdt };
}
