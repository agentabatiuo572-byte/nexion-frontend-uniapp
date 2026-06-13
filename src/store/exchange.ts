import { defineStore } from "pinia";
import { ref } from "vue";

// Ported from Nexion-prototype/lib/store/exchange.ts (zustand → Pinia).
// Basic swap store: live-jittered NEX↔USDT rate + swap history.
// MOCK-ONLY: client mints swap id + rate; production POSTs /api/swap and
// subscribes the canonical rate (server is the authority).
export interface SwapEvent {
  id: string;
  ts: number;
  fromSym: "USDT" | "NEX";
  toSym: "USDT" | "NEX";
  fromAmount: number;
  toAmount: number;
  rate: number; // USDT per NEX
}

const STORAGE_KEY = "nexion-exchange-v1";

function jitterRate(base = 0.085): number {
  // 1 NEX ≈ $0.07–0.10 with light jitter
  return +(base + (Math.random() - 0.5) * 0.02).toFixed(5);
}

function hydrate(): { history: SwapEvent[]; rate: number } {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as { history?: SwapEvent[]; rate?: number } | "";
    if (s && typeof s === "object") {
      return { history: s.history ?? [], rate: typeof s.rate === "number" ? s.rate : jitterRate() };
    }
  } catch {
    // first run
  }
  return { history: [], rate: jitterRate() };
}

export const useExchange = defineStore("exchange", () => {
  const init = hydrate();
  const history = ref<SwapEvent[]>(init.history);
  const rate = ref(init.rate);
  const rateUpdatedAt = ref(Date.now());

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, { history: history.value, rate: rate.value });
    } catch {
      // storage unavailable
    }
  }

  function refreshRate() {
    rate.value = jitterRate(rate.value);
    rateUpdatedAt.value = Date.now();
    persist();
  }

  function recordSwap(e: Omit<SwapEvent, "id" | "ts">): SwapEvent {
    const evt: SwapEvent = {
      ...e,
      id: `SW-${Date.now().toString(36).slice(-5).toUpperCase()}`,
      ts: Date.now(),
    };
    history.value = [evt, ...history.value].slice(0, 50);
    persist();
    return evt;
  }

  return { history, rate, rateUpdatedAt, refreshRate, recordSwap };
});
