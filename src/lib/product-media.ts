import { PRODUCTS, type Product } from "@/mock/products";
import { productCatalogState, productCatalogPresentation, isProductCatalogDisplayCurrent } from "@/store/product-catalog";
import { productTierCode } from "./product-image";

const ROOT = "/static/img/products/uvel-v3";

/** Older device instances can carry the same catalog number in a different case. */
export function findDeviceCatalogProduct(products: readonly Product[], productCode?: string | null): Product | undefined {
  if (!productCode) return undefined;
  const normalized = productCode.toLowerCase();
  return products.find(product => product.id === productCode)
    ?? products.find(product => product.id.toLowerCase() === normalized);
}

/** SKU images come only from the same approved catalog used by the storefront. */
export function getProductMedia(id: string | null | undefined) {
  const display = isProductCatalogDisplayCurrent() ? productCatalogPresentation.value?.products
    : productCatalogState.status === "ready" ? PRODUCTS : undefined;
  const current = display && findDeviceCatalogProduct(display, id);
  return current?.imageUrl ? { src: current.imageUrl, tierCode: productTierCode(current.seriesCode, current.tier) } : null;
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
