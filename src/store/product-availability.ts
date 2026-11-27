import type { Product } from "@/mock/products";
import { isPhaseReached, type PhaseParams } from "./product-phase";

/**
 * Remote products carry a server-computed release decision. Mock products keep
 * the historical P1-P6 rule so the offline prototype remains deterministic.
 */
export function isProductAvailable(product: Product, currentPhase: PhaseParams): boolean {
  if (typeof product.available === "boolean") return product.available;
  return !product.unlocksAtPhase || isPhaseReached(currentPhase, product.unlocksAtPhase);
}

export function isProductReleased(product: Product, currentPhase: PhaseParams): boolean {
  return product.releaseState ? product.releaseState === "AVAILABLE" : isProductAvailable(product, currentPhase);
}

export function productOutOfStock(product: Product | undefined): boolean {
  return product?.purchaseBlockedReason === "PRODUCT_OUT_OF_STOCK"
    || product?.inventoryMode === "FINITE" && product.stock === 0;
}

export function productHasStock(product: Product | undefined): boolean {
  return !!product && !productOutOfStock(product) && (product.inventoryMode === "UNLIMITED"
    || typeof product.stock === "number" && product.stock > 0);
}
