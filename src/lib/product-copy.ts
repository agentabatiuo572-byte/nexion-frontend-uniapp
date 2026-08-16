// Localized per-SKU marketing copy.
//
// src/mock/products.ts owns the backend-replaceable data shape and the English
// source strings; the display layer resolves the active locale here so store
// cards / detail / search never render raw mock English. Product `name`
// (NexGridBox S1, Cloud Share …) is a brand mark and is deliberately NOT
// translated — only prose fields are.
//
// Falls back to the products.ts English when a SKU has no catalog entry, so a
// newly added product degrades to English instead of crashing. verify.sh
// asserts id parity so that fallback stays unreachable in practice.

import type { Messages } from "@/i18n/messages/en";
import type { Product } from "@/mock/products";
import { SPEC_UNAVAILABLE } from "@/api/product-catalog-contract";

export interface ProductCopy {
  tagline: string;
  badge: string;
  /** AI pool this SKU books tasks from (product.ai.unlocks). "" when the SKU has none. */
  unlocks: string;
}

type CatalogEntry = { tagline: string; badge: string; unlocks: string };

export function productCopy(t: Messages, p: Product): ProductCopy {
  const entry = (t.store.catalog as Record<string, CatalogEntry | undefined>)[p.id];
  return {
    tagline: entry?.tagline ?? p.tagline,
    badge: entry?.badge ?? p.badge ?? "",
    unlocks: entry?.unlocks ?? p.ai?.unlocks ?? "",
  };
}

/**
 * Display gate for the server-owned spec strings (every `displayString` field in
 * product-catalog-contract). SPEC_UNAVAILABLE is the server's own "no certified
 * value" sentinel, and a mock SKU may not carry the field at all — both degrade
 * to one locale string so the raw token never reaches the screen.
 *
 * Every render of those fields goes through here; `spec-sentinel-render-gate.mjs`
 * fails the build on any unwrapped read in the store render face.
 */
export function specText(t: Messages, value: string | undefined): string {
  return !value || value === SPEC_UNAVAILABLE ? t.store.specValueUnavailable : value;
}
