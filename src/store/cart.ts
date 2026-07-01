/**
 * Bundle cart — ported from Nexion-prototype/lib/store/cart.ts
 * (zustand persist → Pinia + uni storage).
 *
 * Lets the user add multiple Store products into a single bundle for tiered
 * discounts:
 *   2 items  → 5% off total
 *   3 items  → 8% off total
 *   4+ items → 12% off total
 *
 * Cart is persisted (uni storage) so users can compose bundles across sessions.
 * Backend-replaceable: items[] is a plain serializable string[] of product ids.
 */

import { defineStore } from "pinia";
import { ref, watch } from "vue";

export interface BundleDiscountTier {
  minItems: number;
  pct: number;
}

export const BUNDLE_DISCOUNT_TIERS: ReadonlyArray<BundleDiscountTier> = [
  { minItems: 4, pct: 0.12 },
  { minItems: 3, pct: 0.08 },
  { minItems: 2, pct: 0.05 },
];

export function bundleDiscountForCount(count: number): number {
  for (const tier of BUNDLE_DISCOUNT_TIERS) {
    if (count >= tier.minItems) return tier.pct;
  }
  return 0;
}

const STORAGE_KEY = "nexion-cart-v1";

function hydrate(): string[] {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as { items?: string[] } | string[] | "";
    if (Array.isArray(s)) return s;
    if (s && typeof s === "object" && Array.isArray(s.items)) return s.items;
  } catch {
    // first run
  }
  return [];
}

export const useCart = defineStore("cart", () => {
  const items = ref<string[]>(hydrate());

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, { items: items.value });
    } catch {
      // storage unavailable
    }
  }
  watch(items, persist, { deep: true });

  function add(id: string) {
    if (!items.value.includes(id)) items.value = [...items.value, id];
  }
  function remove(id: string) {
    items.value = items.value.filter((x) => x !== id);
  }
  function clear() {
    items.value = [];
  }
  function has(id: string): boolean {
    return items.value.includes(id);
  }

  return { items, add, remove, clear, has };
});
