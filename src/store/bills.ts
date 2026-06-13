import { defineStore } from "pinia";
import { ref } from "vue";
import { mockServerId } from "./mock-id";

// Ported from Nexion-prototype/lib/store/bills.ts (zustand → Pinia).
// MOCK-ONLY: 30-day history fabricated client-side; production replaces seed
// with GET /api/bills and lets the server own ids + balanceAfter.
export type BillType =
  | "earn" | "refer" | "bonus" | "topup" | "withdraw"
  | "purchase" | "swap" | "kyc" | "stake" | "unstake" | "achievement";
export type BillStatus = "posted" | "pending" | "failed";

export interface Bill {
  id: string;
  type: BillType;
  amount: number; // signed: +credit, -debit
  symbol: "USDT" | "NEX";
  status: BillStatus;
  ts: number; // epoch ms
  memo: string;
  ref?: string;
  balanceAfter?: number;
}

const STORAGE_KEY = "nexion-bills-v1";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedBills(): Bill[] {
  const now = Date.now();
  const DAY = 24 * 3600 * 1000;
  const list: Omit<Bill, "id" | "balanceAfter">[] = [];
  const rngEarn = mulberry32(1);
  const rngRefer = mulberry32(2);

  for (let i = 30; i > 0; i--) {
    list.push({
      ts: now - i * DAY + 10 * 3600 * 1000,
      type: "earn",
      symbol: "USDT",
      amount: +(0.04 + rngEarn() * 0.08).toFixed(4),
      status: "posted",
      memo: "Daily AI inference earnings",
    });
  }
  for (let i = 26; i > 0; i -= 6) {
    list.push({
      ts: now - i * DAY + 14 * 3600 * 1000,
      type: "refer",
      symbol: "USDT",
      amount: +(0.18 + rngRefer() * 0.4).toFixed(4),
      status: "posted",
      memo: "Direct referral 5% commission",
    });
  }
  list.push({ ts: now - 29 * DAY, type: "bonus", symbol: "USDT", amount: 5.0, status: "posted", memo: "Welcome bonus credited on activation" });
  list.push({ ts: now - 29 * DAY + 60 * 1000, type: "bonus", symbol: "NEX", amount: 50, status: "posted", memo: "Achievement · First Contribution" });
  list.push({ ts: now - 14 * DAY + 5 * 3600 * 1000, type: "achievement", symbol: "NEX", amount: 100, status: "posted", memo: "Achievement · First Dollar" });
  list.push({ ts: now - 7 * DAY, type: "kyc", symbol: "USDT", amount: 1.0, status: "posted", memo: "KYC-Express · wallet ownership verification", ref: "KYC-2026-A78214" });
  list.push({ ts: now - 12 * DAY, type: "topup", symbol: "USDT", amount: 50.0, status: "posted", memo: "Top-up · USDT-TRC20", ref: "TX-20260503-7621" });
  list.push({ ts: now - 4 * 3600 * 1000, type: "withdraw", symbol: "USDT", amount: -20.0, status: "pending", memo: "Withdraw · USDT-TRC20 · processing", ref: "WD-20260516-3284" });

  return list.sort((a, b) => b.ts - a.ts).map((b) => ({ ...b, id: mockServerId("BL") }));
}

function recomputeBalance(bills: Bill[]): Bill[] {
  const ordered = [...bills].sort((a, b) => a.ts - b.ts);
  let running = 0;
  ordered.forEach((b) => {
    if (b.symbol === "USDT" && b.status === "posted") running += b.amount;
    b.balanceAfter = +running.toFixed(4);
  });
  return ordered.sort((a, b) => b.ts - a.ts);
}

function hydrate(): Bill[] {
  try {
    const saved = uni.getStorageSync(STORAGE_KEY) as { bills?: Bill[] } | "";
    if (saved && saved.bills && saved.bills.length) return saved.bills;
  } catch {
    // first run
  }
  return recomputeBalance(seedBills());
}

export const useBills = defineStore("bills", () => {
  const bills = ref<Bill[]>(hydrate());

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, { bills: bills.value });
    } catch {
      // storage unavailable
    }
  }

  function add(b: Omit<Bill, "id" | "ts" | "balanceAfter">): Bill {
    const next: Bill = { ...b, id: mockServerId("BL"), ts: Date.now() };
    bills.value = recomputeBalance([next, ...bills.value]);
    persist();
    return next;
  }

  function seed() {
    bills.value = recomputeBalance(seedBills());
    persist();
  }

  return { bills, add, seed };
});
