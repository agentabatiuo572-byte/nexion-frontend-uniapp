import type { Product } from "@/mock/products";

/**
 * Landing context for a store visit that started at an earning goal (BUG 71).
 *
 * The goals page recommends a SKU and used to drop that context on navigation,
 * so the store silently featured its own first product. The store now receives
 * `focus=<productNo>` (+ `focusName=<server name>`) and must either locate the
 * recommended device or say plainly why it is not the one being offered.
 */
export type StoreGoalFocusVariant =
  /** No goal context on this visit — the store behaves as before. */
  | "none"
  /** The recommended SKU is purchasable and owns the recommendation slot. */
  | "located"
  /** The catalog read has not landed; nothing can be confirmed yet. */
  | "pending"
  /** The SKU is in the catalog but is not purchasable right now. */
  | "not-purchasable"
  /** The SKU is no longer in the catalog at all. */
  | "replaced";

export interface StoreGoalFocusResolution {
  variant: StoreGoalFocusVariant;
  /** The catalog product that takes over the "Recommended for you" slot. */
  featured: Product | null;
  /** Display name for the explanation — catalog truth first, query hint second. */
  name: string;
}

export function resolveStoreGoalFocus(
  focusId: string,
  focusName: string,
  products: readonly Product[],
  purchasable: readonly Product[],
  catalogHasProducts: boolean,
): StoreGoalFocusResolution {
  const id = focusId.trim();
  if (!id) return { variant: "none", featured: null, name: "" };
  const featured = purchasable.find((product) => product.id === id) ?? null;
  if (featured) return { variant: "located", featured, name: featured.name };
  if (!catalogHasProducts) return { variant: "pending", featured: null, name: focusName.trim() || id };
  const known = products.find((product) => product.id === id) ?? null;
  if (known) return { variant: "not-purchasable", featured: null, name: known.name };
  return { variant: "replaced", featured: null, name: focusName.trim() || id };
}
