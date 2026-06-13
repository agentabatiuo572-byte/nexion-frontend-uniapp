/**
 * ⚠️ MOCK-ONLY TRADEIN_CONFIG — server-authoritative business config.
 * Production: GET /api/config/tradein (TBD; candidate name, not yet in PRD §9.11).
 * Admin mutates via PUT /api/admin/tradein/config (TBD; candidate).
 * Ported from Nexion-prototype/lib/v3/_config/tradein-config.ts (plain data +
 * pure helpers, zero React deps → copied faithfully). Salvage / age curve is
 * the only part the trade-in sheets consume (computeSalvageCredit +
 * DEFAULT_TRADEIN_CONFIG); the eligibility / promo schema is mirrored so the
 * mock stays backend-replaceable when /me/devices wires the promo banner.
 *
 * Schema:
 *   - eligibility: per-deviceKind rule sets (mode: open|any-of|all-of + rules[])
 *   - salvage: trade-in credit (in-checkout deduction only, NEVER to balance)
 *     with age-based decay reverse-derived from 12-month platform lifecycle.
 *   - promo: trade-in promo banner config (cooldown / delay / routes).
 *
 * Default values reverse-derived from §13 12-month lifecycle:
 *   - salvage 30% baseline, 2.5%/mo decay, 0 floor at month 12 (matches device EOL)
 *   - Pro/P1 eligibility = own-prev-tier OR V-rank OR cumulative-deposit OR trade-in
 *     (4 channels per tier → conversion path each direction)
 */

import type { DeviceKind } from "@/store/types";

// ─────────────────────────────────────────────────────────────── Rule schema

export type EligibilityRule =
  | { type: "open" }
  | { type: "own-kind"; kind: DeviceKind; count: number }
  | { type: "own-prev-tier"; count: number }
  | { type: "v-rank-min"; level: number }
  | { type: "cumulative-deposit-usdt"; amount: number }
  | { type: "kyc-tier"; tier: "basic" | "verified" | "enhanced" }
  | { type: "days-active"; days: number }
  | { type: "referral-count"; count: number }
  | { type: "trade-in"; fromKind: DeviceKind };

export type EligibilityMode = "open" | "any-of" | "all-of";

export interface DeviceEligibility {
  mode: EligibilityMode;
  rules: EligibilityRule[];
}

// ─────────────────────────────────────────────────────────────── Top-level

export interface TradeinConfig {
  enabled: boolean;
  /** Eligibility per device kind. Devices not listed = treated as `open`. */
  eligibility: Partial<Record<DeviceKind, DeviceEligibility>>;
  /** Trade-in salvage credit — applied AT CHECKOUT only, never to balance. */
  salvage: {
    enabled: boolean;
    /** Baseline salvage rate at month 0 (e.g. 0.30 = 30% of original price). */
    rate: number;
    /** Mode locked to "credit-only-at-checkout" — never credits balance. */
    mode: "credit-only-at-checkout";
    /** Device kinds that yield salvage credit when recycled. */
    applyTo: DeviceKind[];
    /** Age-based decay. monthlyDecay reverse-derived from 12-month lifecycle. */
    ageAdjustment: {
      /** % decay per month (0.025 = 2.5%/mo). At baseline=30%, hits 0 at month 12. */
      monthlyDecay: number;
      /** Minimum salvage rate (0 = can decay to zero). */
      floor: number;
    };
    /** Minimum holding period before any salvage is paid. Prevents buy-then-
     *  instant-trade-in arbitrage (user could net 30% of price back day 1).
     *  Server is sole authority; client value is render hint. Months as float. */
    minHoldingMonths: number;
  };
  /** Trade-in promo banner config. Surfaces when user has eligible device. */
  promo: {
    enabled: boolean;
    cooldownHours: number;
    maxPerSession: number;
    delayMs: number;
    /** Routes where the banner can show. */
    routes: string[];
    triggerWhen: {
      hasEligibleDeviceInInventoryOrSlot: boolean;
      /** Don't promo on freshly-purchased devices. */
      minDeviceAgeDays: number;
    };
  };
  /** Inventory soft/hard caps (currently no upper limit per product decision,
   *  but reserved for future abuse-prevention). */
  inventory: {
    /** Soft hint shown to user when approaching this count. 0 = disabled. */
    softMax: number;
    /** Hard server-side cap. 0 = unlimited. */
    hardMax: number;
  };
}

// ─────────────────────────────────────────────────────────────── Default

export const DEFAULT_TRADEIN_CONFIG: TradeinConfig = {
  enabled: true,
  eligibility: {
    "stellarbox-s1": {
      mode: "open",
      rules: [{ type: "open" }],
    },
    "stellarbox-pro": {
      mode: "any-of",
      rules: [
        { type: "own-kind", kind: "stellarbox-s1", count: 1 },
        { type: "v-rank-min", level: 2 },
        { type: "cumulative-deposit-usdt", amount: 1000 },
        { type: "trade-in", fromKind: "stellarbox-s1" },
      ],
    },
    "stellarrack-p1": {
      mode: "any-of",
      rules: [
        { type: "own-kind", kind: "stellarbox-pro", count: 1 },
        { type: "v-rank-min", level: 4 },
        { type: "cumulative-deposit-usdt", amount: 5000 },
        { type: "trade-in", fromKind: "stellarbox-pro" },
      ],
    },
  },
  salvage: {
    enabled: true,
    rate: 0.3,
    mode: "credit-only-at-checkout",
    applyTo: ["stellarbox-s1", "stellarbox-pro", "stellarrack-p1"],
    ageAdjustment: {
      // 30% / 12 months = 2.5%/mo → salvage hits 0 at platform EOL (month 12).
      // Pairs with device-lifecycle.ts efficiency curve (also bottoms ~22%
      // at month 12). Operationally this nudges users toward upgrade /
      // exit by EOL rather than holding a dead device.
      monthlyDecay: 0.025,
      floor: 0,
    },
    // 30 days = 1 month. Buy-then-instant-trade-in cycles inside this window
    // get 0 salvage. Matches the spirit of "device must actually be deployed
    // to earn the wear-and-tear credit". Server is canonical; admin can lower
    // for promo windows (e.g. holiday upgrade campaign).
    minHoldingMonths: 1,
  },
  promo: {
    enabled: true,
    cooldownHours: 24,
    maxPerSession: 1,
    delayMs: 1500,
    // Routes the banner may render on. Must align with actual mount sites —
    // expansion to additional routes requires either trimming this list to
    // only mounted routes OR moving the mount to a chassis-level component.
    // Production: server-canonical via GET /api/config/tradein.promo.routes.
    routes: ["/pages/me/devices"],
    triggerWhen: {
      hasEligibleDeviceInInventoryOrSlot: true,
      // Don't push trade-in on freshly-bought devices (UX trust).
      minDeviceAgeDays: 30,
    },
  },
  inventory: {
    softMax: 0, // no soft hint by default
    hardMax: 0, // no hard limit per product decision (2026-05-26)
  },
};

// ─────────────────────────────────────────────────────────────── Helpers

/**
 * Compute current salvage rate for a device of given age.
 * Returns a fraction [0, rate].
 *
 *   rate(t) = max(floor, baseline - monthlyDecay * t_months)
 *
 * Example: baseline=0.30, monthlyDecay=0.025, floor=0
 *   month 0  → 0.30
 *   month 6  → 0.15
 *   month 12 → 0.00
 */
export function computeSalvageRate(ageMonths: number, cfg: TradeinConfig): number {
  if (!cfg.salvage.enabled) return 0;
  // Buy-then-instant-trade-in arbitrage guard. Devices must be held at least
  // minHoldingMonths before salvage credit is paid. Server enforces; here we
  // mirror so UI hints render the correct (zero) credit on fresh devices.
  if (ageMonths < cfg.salvage.minHoldingMonths) return 0;
  const baseline = cfg.salvage.rate;
  const decay = cfg.salvage.ageAdjustment.monthlyDecay * Math.max(0, ageMonths);
  return Math.max(cfg.salvage.ageAdjustment.floor, baseline - decay);
}

/**
 * USD salvage credit for a specific device at trade-in time.
 *
 *   salvage = price × computeSalvageRate(ageMonths)
 */
export function computeSalvageCredit(
  originalPriceUsdt: number,
  ageMonths: number,
  cfg: TradeinConfig,
): number {
  return originalPriceUsdt * computeSalvageRate(ageMonths, cfg);
}

/** Upgrade ladder used by `own-prev-tier` rule and trade-in inference. */
export const UPGRADE_LADDER: DeviceKind[] = [
  "phone",
  "stellarbox-s1",
  "stellarbox-pro",
  "stellarrack-p1",
];

/** Returns the kind one tier below `kind`, or null if at floor. */
export function previousTier(kind: DeviceKind): DeviceKind | null {
  const idx = UPGRADE_LADDER.indexOf(kind);
  return idx > 0 ? UPGRADE_LADDER[idx - 1] : null;
}
