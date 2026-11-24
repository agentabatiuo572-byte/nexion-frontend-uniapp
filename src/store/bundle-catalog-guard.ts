import type { ProductCatalogStatus } from "./product-catalog";
import type { Product } from "@/mock/products";
import type { PhaseParams } from "./product-phase";
import { isProductAvailable, productOutOfStock } from "./product-availability";

/** Bundle pages may render local compatibility data only after a live snapshot is ready. */
export function bundleCatalogReady(remote: boolean, status: ProductCatalogStatus): boolean {
  return !remote || status === "ready";
}

export function isBundleHardwareAvailable(product: Product, phase: PhaseParams): boolean {
  return product.productType !== "SHARE" && isProductAvailable(product, phase) && !productOutOfStock(product);
}
