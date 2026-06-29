/**
 * Ported from Nexion-prototype/lib/store/product-phase.ts
 * (zustand persist → Pinia + uni storage).
 *
 * ⚠️ MOCK-ONLY PHASES table (12-month platform tightening dials).
 * Production: GET /api/admin/platform/phase-config — server is sole source
 * of truth for withdrawal cooldown, binary cap, point thresholds, etc.
 * getMonthsSince uses mockServerNow() → server time in production.
 *
 * Computes the current operational phase from `user.joinedAt` and exposes a
 * single source of truth for time-varying platform parameters. The companion
 * override store (`useProductPhaseOverride`) lets a PM demo pin a phase without
 * time-traveling user.joinedAt.
 */

import { defineStore } from "pinia";
import { ref } from "vue";
import { ONE_MONTH_MS, mockServerNow } from "./server-time";

export type PhaseId = "P1" | "P2" | "P3" | "P4" | "P5" | "P6";

export interface PhaseParams {
  id: PhaseId;
  label: string;             // i18n key suffix (resolved by caller)
  monthsFrom: number;        // inclusive lower bound
  monthsTo: number;          // exclusive upper bound
  // Tightening dials (everything goes from "loose" to "harsh" across P1 → P6)
  inviteBonusMultiplier: number;       // 2.0 P1 → 1.0 by P3 onward
  withdrawalPointsPer100: number;      // 10 P1-P4, 20 P5+
  withdrawalCooldownDays: number;      // 30 P1-P4, 45 P5+
  binaryDailyCapUSD: number;           // 5000 P1-P3, 2000 P4+
  // Feature gates (unlock incrementally as phases advance)
  nexV2LockAvailable: boolean;
  complianceHoldEnabled: boolean;      // P5+ adds an extra compliance-review step to withdrawal
}

export const PHASES: ReadonlyArray<PhaseParams> = [
  {
    id: "P1",
    label: "rapidAcquisition",
    monthsFrom: 0,
    monthsTo: 2,
    inviteBonusMultiplier: 2.0,
    withdrawalPointsPer100: 10,
    withdrawalCooldownDays: 30,
    binaryDailyCapUSD: 5_000,
    nexV2LockAvailable: false,
    complianceHoldEnabled: false,
  },
  {
    id: "P2",
    label: "softTransition",
    monthsFrom: 2,
    monthsTo: 4,
    inviteBonusMultiplier: 1.5,
    withdrawalPointsPer100: 10,
    withdrawalCooldownDays: 30,
    binaryDailyCapUSD: 5_000,
    nexV2LockAvailable: false,
    complianceHoldEnabled: false,
  },
  {
    id: "P3",
    label: "firstUpgradeWave",
    monthsFrom: 4,
    monthsTo: 6,
    inviteBonusMultiplier: 1.0,
    withdrawalPointsPer100: 10,
    withdrawalCooldownDays: 30,
    binaryDailyCapUSD: 5_000,
    nexV2LockAvailable: false,
    complianceHoldEnabled: false,
  },
  {
    id: "P4",
    label: "subscriptionPush",
    monthsFrom: 6,
    monthsTo: 8,
    inviteBonusMultiplier: 1.0,
    withdrawalPointsPer100: 10,
    withdrawalCooldownDays: 30,
    binaryDailyCapUSD: 2_000,
    nexV2LockAvailable: false,
    complianceHoldEnabled: false,
  },
  {
    id: "P5",
    label: "depositLockIn",
    monthsFrom: 8,
    monthsTo: 10,
    inviteBonusMultiplier: 1.0,
    withdrawalPointsPer100: 20,
    withdrawalCooldownDays: 45,
    binaryDailyCapUSD: 2_000,
    nexV2LockAvailable: false,
    complianceHoldEnabled: true,
  },
  {
    id: "P6",
    label: "softExit",
    monthsFrom: 10,
    monthsTo: 999,
    inviteBonusMultiplier: 1.0,
    withdrawalPointsPer100: 20,
    withdrawalCooldownDays: 45,
    binaryDailyCapUSD: 2_000,
    nexV2LockAvailable: true,
    complianceHoldEnabled: true,
  },
];

export function getMonthsSince(joinedAt: number, now: number = mockServerNow()): number {
  return Math.max(0, (now - joinedAt) / ONE_MONTH_MS);
}

export function getPhaseForMonth(month: number): PhaseParams {
  for (const p of PHASES) {
    if (month >= p.monthsFrom && month < p.monthsTo) return p;
  }
  return PHASES[PHASES.length - 1];
}

/**
 * True when `current` has advanced to or past `target` on the P1 → P6 scale.
 * Used by gen-2 product gating: Pro v2 unlocks at P3, Rack P2 at P5.
 */
export function isPhaseReached(current: PhaseParams, target: PhaseId): boolean {
  const currentIdx = PHASES.findIndex((p) => p.id === current.id);
  const targetIdx = PHASES.findIndex((p) => p.id === target);
  return currentIdx >= targetIdx;
}

// PM-facing override (replay-tour demo). Persisted so the demo state survives
// reload. When `pinned` is null the engine falls back to time-based phase.
//
// ⚠️ PRODUCTION GUARD: in production any user could call setPinned to skip
// months of ramp and unlock a higher invite multiplier / shorter cooldown.
// The setter no-ops in production. Real phase decision is server canonical;
// client only mirrors server-issued phase.
const OVERRIDE_STORAGE_KEY = "nexion-product-phase-override-v1";

function hydratePinned(): PhaseId | null {
  try {
    const s = uni.getStorageSync(OVERRIDE_STORAGE_KEY) as { pinned?: PhaseId } | "";
    if (s && typeof s === "object" && typeof s.pinned === "string") return s.pinned;
  } catch {
    // first run
  }
  return null;
}

// Mirror Next's process.env.NODE_ENV guard. Vite/uni exposes the build mode via
// import.meta.env.PROD (always defined; avoids a `process is not defined` runtime
// error on App/native targets where the Node `process` global is absent).
const IS_PRODUCTION = import.meta.env.PROD;

export const useProductPhaseOverride = defineStore("productPhaseOverride", () => {
  const pinned = ref<PhaseId | null>(hydratePinned());

  function setPinned(id: PhaseId | null) {
    if (IS_PRODUCTION) return;
    pinned.value = id;
    try {
      uni.setStorageSync(OVERRIDE_STORAGE_KEY, { pinned: id });
    } catch {
      // storage unavailable
    }
  }

  return { pinned, setPinned };
});
