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
