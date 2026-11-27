import { remoteApiEnabled } from "@/api/runtime";
import { getProduct } from "@/mock/products";
import { isProductCatalogDisplayCurrent, productCatalogPresentation } from "@/store/product-catalog";

/** Resolve a display name without exposing the number used to identify the product. */
export function productDisplayName(productNo: string, fallback: string, frozenName?: string | null): string {
  const frozen = typeof frozenName === "string" ? frozenName.trim() : "";
  if (frozen && frozen.toLowerCase() !== productNo.toLowerCase()) return frozen;
  const product = !remoteApiEnabled ? getProduct(productNo)
    : isProductCatalogDisplayCurrent() ? productCatalogPresentation.value?.products.find(row => row.id === productNo)
    : undefined;
  return product?.name && product.name.toLowerCase() !== productNo.toLowerCase() ? product.name : fallback;
}
