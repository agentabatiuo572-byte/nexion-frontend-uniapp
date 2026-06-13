import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Trial config — "后台可控" parameters surfaced as a store rather than
 * constants. Real platform would back this with a server config + admin UI.
 * Ported from Nexion-prototype/lib/store/trial-config.ts (zustand persist →
 * Pinia + uni storage). MOCK-ONLY.
 */
export interface TrialConfig {
  /** Free trial duration in days (shadow accrues during this window) */
  trialDays: number;
  /** Grace window after trial — shadow frozen, conversion pushes continue */
  graceDays: number;
  /** Extension granted to "high-quality" users at grace expiry */
  extensionDays: number;
  /** Active-purchase discount rate (applies during trial + grace + extension) */
  discountRate: number;
  /** Active-purchase discount hard cap, USD */
  discountCapUSD: number;
  /** Trial-earnings offset cap, USD (offsets device price at purchase; remainder
   *  credited to balance AFTER purchase; before purchase only offsets). 后台可调。 */
  trialOffsetCapUSD: number;
  /** Auto-charge full price at end of grace + extension */
  autoChargeAtEnd: boolean;
  /** High-quality user threshold: shadow USD accrued (any time) */
  highQualityThresholdUSD: number;
  /** Mock charge failure rate (0..1) for demoing the failed-charge path */
  chargeFailRate: number;
  /** Trial product id (currently only S1 supported) */
  trialProductId: "stellarbox-s1";
  /** Trial product price (auto-charge target) */
  trialPriceUSD: number;
  /** Shadow accrual rates (S1 baseline per spec §3.1) */
  shadowDailyUSD: number;
  shadowDailyNEX: number;
  /** Cooldown days between trial attempts (per account) */
  cooldownDays: number;
  /** Whether trial is open in the current product phase */
  phaseOpen: boolean;
  // ── Auto-push controls (claim sheet 弹出策略,后台可控)──
  autoPushEnabled: boolean;
  autoPushDelayMs: number;
  autoPushCooldownHours: number;
  autoPushMaxPerSession: number;
}

export const DEFAULT_TRIAL_CONFIG: TrialConfig = {
  trialDays: 3,
  graceDays: 7,
  extensionDays: 3,
  discountRate: 0.15,
  discountCapUSD: 20,
  trialOffsetCapUSD: 50,
  autoChargeAtEnd: true,
  highQualityThresholdUSD: 100,
  chargeFailRate: 0.01,
  trialProductId: "stellarbox-s1",
  trialPriceUSD: 1299,
  shadowDailyUSD: 38.52,
  shadowDailyNEX: 65,
  cooldownDays: 30,
  phaseOpen: true,
  autoPushEnabled: true,
  autoPushDelayMs: 1500,
  autoPushCooldownHours: 24,
  autoPushMaxPerSession: 1,
};

const STORAGE_KEY = "nexion-trial-config-v1";

function hydrate(): TrialConfig {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as { config?: Partial<TrialConfig> } | "";
    if (s && typeof s === "object" && s.config) {
      // Merge over defaults so newly-added fields exist for old persisted state.
      return { ...DEFAULT_TRIAL_CONFIG, ...s.config };
    }
  } catch {
    // first run
  }
  return { ...DEFAULT_TRIAL_CONFIG };
}

export const useTrialConfig = defineStore("trialConfig", () => {
  const config = ref<TrialConfig>(hydrate());

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, { config: config.value });
    } catch {
      // storage unavailable
    }
  }
  function update(patch: Partial<TrialConfig>) {
    config.value = { ...config.value, ...patch };
    persist();
  }
  function reset() {
    config.value = { ...DEFAULT_TRIAL_CONFIG };
    persist();
  }

  return { config, update, reset };
});

/** Compute discounted price for a manual redeem during trial/grace/extension. */
export function computeDiscountedPrice(config: TrialConfig): {
  subtotal: number;
  discount: number;
  total: number;
} {
  const subtotal = config.trialPriceUSD;
  const discount = Math.min(subtotal * config.discountRate, config.discountCapUSD);
  return { subtotal, discount: +discount.toFixed(2), total: +(subtotal - discount).toFixed(2) };
}

/**
 * Split accrued trial earnings into price-offset portion (capped) + post-purchase
 * balance remainder. Single source of truth shared by BOTH conversion paths
 * (early-redeem + auto-charge) so the two never diverge.
 * Real backend: server computes this in POST /api/trial/charge / redeem-early.
 */
export function computeTrialOffset(
  config: TrialConfig,
  shadowUSD: number,
): { offsetUSD: number; remainderUSD: number } {
  const earnings = Math.max(0, shadowUSD);
  const offsetUSD = +Math.min(earnings, config.trialOffsetCapUSD).toFixed(2);
  const remainderUSD = +(earnings - offsetUSD).toFixed(2);
  return { offsetUSD, remainderUSD };
}
