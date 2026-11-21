import { getProduct } from "@/mock/products";
import { productCatalogState, productCatalogPresentation, isProductCatalogDisplayCurrent } from "@/store/product-catalog";
import { productTierCode } from "./product-image";

const ROOT = "/static/img/products/uvel-v3";

/** SKU images come only from the same approved catalog used by the storefront. */
export function getProductMedia(id: string | null | undefined) {
  if (!id) return null;
  const product = productCatalogState.status === "ready" ? getProduct(id) ?? getProduct(id.toLowerCase()) : undefined;
  const display = isProductCatalogDisplayCurrent() ? productCatalogPresentation.value?.products : undefined;
  const current = product ?? display?.find(product => product.id.toLowerCase() === id.toLowerCase());
  return current?.imageUrl ? { src: current.imageUrl, tierCode: productTierCode(current.id, current.tier) } : null;
}

/** Historical trade-in snapshots can append a quantity to the SKU. Artwork only; never rewrite order identity. */
export function getOrderProductMedia(productNo: string, lineItems?: readonly { sku: string }[]) {
  return getProductMedia(lineItems?.[0]?.sku ?? productNo.replace(/×[1-9]\d*$/, ""));
}

// Genesis is an independent entitlement, never a seventh device SKU.
export const GENESIS_MEDIA = {
  showcase: `${ROOT}/genesis.png`,
  holding: `${ROOT}/genesis-holder-base.png`,
} as const;

/** Format a supplied display identity without deriving or changing a holding number. */
export function formatGenesisSerial(serial: string | number | null | undefined): string {
  if (serial === null || serial === undefined || serial === "") return "";
  return `No.${typeof serial === "number" ? String(serial).padStart(4, "0") : serial}`;
}
