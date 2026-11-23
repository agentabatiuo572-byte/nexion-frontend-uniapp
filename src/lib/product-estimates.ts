import type { EstimateRange } from "@/api/estimate-range";
import type { Product } from "@/mock/products";

export function productPublishedDailyUsdtRange(
  product: Pick<Product, "dailyEstimateLowUsdt" | "dailyEstimateHighUsdt">,
): EstimateRange | null {
  const { dailyEstimateLowUsdt: low, dailyEstimateHighUsdt: high } = product;
  return low != null && high != null ? { low, high } : null;
}

/**
 * Per-unit catalog USDT estimate. The catalog's daily range wins for every product; a device without one keeps its
 * single estimate (both ends equal). A Share without the server's range has none, and its surfaces show "—".
 */
export function productDailyEstimateRange(
  product: Pick<Product, "productType" | "dailyEarn" | "dailyEstimateLowUsdt" | "dailyEstimateHighUsdt">,
): { low: number; high: number } | null {
  return productPublishedDailyUsdtRange(product)
    ?? (product.productType === "SHARE" ? null : { low: product.dailyEarn, high: product.dailyEarn });
}

/** Per-unit catalog UVT estimate: the catalog's daily range when sent, otherwise the single daily figure. */
export function productDailyUvtRange(
  product: Pick<Product, "dailyEarnNEX" | "dailyEstimateLowNex" | "dailyEstimateHighNex">,
): { low: number; high: number } {
  return product.dailyEstimateLowNex != null && product.dailyEstimateHighNex != null
    ? { low: product.dailyEstimateLowNex, high: product.dailyEstimateHighNex }
    : { low: product.dailyEarnNEX, high: product.dailyEarnNEX };
}
