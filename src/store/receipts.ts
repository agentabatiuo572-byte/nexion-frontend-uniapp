import { defineStore } from "pinia";
import { ref } from "vue";
import type { Receipt, ReceiptCategory } from "@/mock/receipt";

// Ported from Nexion-prototype/lib/store/receipts.ts (zustand → Pinia).
// Proof-of-Compute receipts (design doc §6.9), newest-first, capped + persisted.
const MAX_RECEIPTS = 200;
const STORAGE_KEY = "nexion-receipts-v1";

function hydrate(): Receipt[] {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as { receipts?: Receipt[] } | "";
    if (s && s.receipts && s.receipts.length) return s.receipts;
  } catch {
    // first run
  }
  return [];
}

export const useReceipts = defineStore("receipts", () => {
  const receipts = ref<Receipt[]>(hydrate());

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, { receipts: receipts.value });
    } catch {
      // storage unavailable
    }
  }
  function add(receipt: Receipt) {
    receipts.value = [receipt, ...receipts.value].slice(0, MAX_RECEIPTS);
    persist();
  }
  function byId(id: string): Receipt | undefined {
    return receipts.value.find((r) => r.id === id);
  }
  function clear() {
    receipts.value = [];
    persist();
  }

  return { receipts, add, byId, clear };
});

// Convenience selector for the Me → Receipts page tabs.
export function filterByCategory(receipts: Receipt[], category: ReceiptCategory | "ALL"): Receipt[] {
  if (category === "ALL") return receipts;
  return receipts.filter((r) => r.category === category);
}
