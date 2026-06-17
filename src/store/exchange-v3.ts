import { defineStore } from "pinia";
import { ref } from "vue";

// Ported from Nexion-prototype/lib/v3/exchange.ts (zustand → Pinia).
// Risk-control layer on top of the basic swap store (exchange.ts).
//
// Enforces spec §8 caps:
//   - Per-user daily cap: $50 USDT equivalent
//   - Platform daily cap: $20,000 USDT equivalent (shared, simulated)
//   - KYC trigger: lifetime exchanged ≥ $100 → KYC-Express required
//   - Queue: requests over today's cap wait until tomorrow's reset
//
// `canExchange(usd)` returns the gating decision; `record(usd)` commits after
// success. `resetIfNewDay()` rolls the daily counters at midnight.
// MOCK-ONLY: real backend owns counters server-side (anti-tamper). localStorage
// here is a prototype stub.
export const USER_DAILY_CAP_USD = 50;
export const PLATFORM_DAILY_CAP_USD = 20_000;
export const KYC_LIFETIME_THRESHOLD_USD = 100;

export interface QueuedExchange {
  id: string;
  amountUSD: number;
  direction: "nex2usdt" | "usdt2nex";
  requestedAt: number;
}

export type Gate =
  | { ok: true }
  | { ok: false; reason: "user-cap"; usedToday: number; cap: number }
  | { ok: false; reason: "platform-cap"; usedToday: number; cap: number }
  | { ok: false; reason: "kyc-required"; lifetime: number; threshold: number };

const STORAGE_KEY = "nexion-exchange-v3";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface PersistShape {
  todayUserUsedUSD: number;
  todayPlatformUsedUSD: number;
  dayKey: string;
  lifetimeExchangedUSD: number;
  kycVerified: boolean;
  queue: QueuedExchange[];
}

function defaults(): PersistShape {
  return {
    todayUserUsedUSD: 0,
    todayPlatformUsedUSD: 0,
    dayKey: todayKey(),
    lifetimeExchangedUSD: 0,
    kycVerified: false,
    queue: [],
  };
}

function hydrate(): PersistShape {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as Partial<PersistShape> | "";
    if (s && typeof s === "object") return { ...defaults(), ...s };
  } catch {
    // first run
  }
  return defaults();
}

export const useExchangeV3 = defineStore("exchangeV3", () => {
  const init = hydrate();
  const todayUserUsedUSD = ref(init.todayUserUsedUSD);
  const todayPlatformUsedUSD = ref(init.todayPlatformUsedUSD);
  const dayKey = ref(init.dayKey);
  const lifetimeExchangedUSD = ref(init.lifetimeExchangedUSD);
  const kycVerified = ref(init.kycVerified);
  const queue = ref<QueuedExchange[]>(init.queue);

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, {
        todayUserUsedUSD: todayUserUsedUSD.value,
        todayPlatformUsedUSD: todayPlatformUsedUSD.value,
        dayKey: dayKey.value,
        lifetimeExchangedUSD: lifetimeExchangedUSD.value,
        kycVerified: kycVerified.value,
        queue: queue.value,
      });
    } catch {
      // storage unavailable
    }
  }

  function resetIfNewDay() {
    const t = todayKey();
    if (dayKey.value !== t) {
      dayKey.value = t;
      todayUserUsedUSD.value = 0;
      todayPlatformUsedUSD.value = 0;
      persist();
    }
  }

  function canExchange(usd: number): Gate {
    // KYC gate triggers at lifetime ≥ $100
    if (!kycVerified.value && lifetimeExchangedUSD.value + usd > KYC_LIFETIME_THRESHOLD_USD) {
      return {
        ok: false,
        reason: "kyc-required",
        lifetime: lifetimeExchangedUSD.value,
        threshold: KYC_LIFETIME_THRESHOLD_USD,
      };
    }
    if (todayUserUsedUSD.value + usd > USER_DAILY_CAP_USD) {
      return { ok: false, reason: "user-cap", usedToday: todayUserUsedUSD.value, cap: USER_DAILY_CAP_USD };
    }
    if (todayPlatformUsedUSD.value + usd > PLATFORM_DAILY_CAP_USD) {
      return { ok: false, reason: "platform-cap", usedToday: todayPlatformUsedUSD.value, cap: PLATFORM_DAILY_CAP_USD };
    }
    return { ok: true };
  }

  function record(usd: number) {
    todayUserUsedUSD.value += usd;
    todayPlatformUsedUSD.value += usd;
    lifetimeExchangedUSD.value += usd;
    persist();
  }

  function enqueue(req: Omit<QueuedExchange, "id" | "requestedAt">) {
    const item: QueuedExchange = {
      ...req,
      id: `Q-${Date.now().toString(36).slice(-5).toUpperCase()}`,
      requestedAt: Date.now(),
    };
    queue.value = [item, ...queue.value].slice(0, 20);
    persist();
  }

  function setKycVerified(v: boolean) {
    kycVerified.value = v;
    persist();
  }

  return {
    todayUserUsedUSD, todayPlatformUsedUSD, dayKey, lifetimeExchangedUSD,
    kycVerified, queue,
    resetIfNewDay, canExchange, record, enqueue, setKycVerified,
  };
});

export function dailyUserPctUsed(used: number): number {
  return Math.min(1, used / USER_DAILY_CAP_USD);
}
export function dailyPlatformPctUsed(used: number): number {
  return Math.min(1, used / PLATFORM_DAILY_CAP_USD);
}
