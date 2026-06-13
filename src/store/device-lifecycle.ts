/**
 * ⚠️ MOCK-ONLY DEGRADATION_PER_MONTH + MIN_EFFICIENCY constants.
 * Production: endpoint TBD; candidate: GET /api/config/lifecycle.
 * Not yet listed in PRD §9.11 — see lib/v3/_config/README.md inventory.
 * Degradation curve drives user earnings, must be server-authoritative +
 * server-time-based.
 * All `now: number = mockServerNow()` defaults route through the central
 * server-time helper for single-point cutover.
 * See lib/v3/_config/README.md.
 *
 * Device lifecycle — degradation curve engine.
 *
 * Real compute hardware loses effective output over time (thermal wear,
 * driver bit-rot, network-difficulty inflation). Nexion models this with a
 * three-stage monthly degradation curve, calibrated to make a fresh device
 * produce ~22% of its baseline yield by month 12 — at which point the user
 * is expected to make a choice (trade-in / new device / NEX v2 lock).
 *
 *   Month 1-3   −4% / mo   100% → 88.5%
 *   Month 4-8   −6% / mo   88.5% → 65.1%
 *   Month 9-12  −23.7% / mo 65.1% → ~22% (floor)
 *
 * The curve is pure / stateless: pass `purchasedAt` (and an optional `now`
 * for tests) and you get current efficiency back. UI calls `useEfficiency`
 * which re-derives whenever the store ticks the per-device timer.
 *
 * Phone and cloud-share devices are exempt — phone yield is already trivial,
 * and cloud-share is rented compute that the platform refreshes on its side.
 */

import type { Device, DeviceKind } from "./types";

export const DEGRADATION_PER_MONTH = {
  early:  -0.04, // months 1-3
  middle: -0.06, // months 4-8
  late:   -0.237, // months 9-12 — calibrated so eff(month 12) ≈ MIN_EFFICIENCY (22%): 0.96^3·0.94^5·0.763^4 ≈ 0.22
} as const;

import { ONE_MONTH_MS, mockServerNow } from "./server-time";

const MIN_EFFICIENCY = 0.22; // floor at month 12+

export function isDegradable(kind: DeviceKind): boolean {
  return kind !== "phone" && kind !== "cloud-share";
}

/**
 * 1-based month index since purchase (1 = first month of ownership, 12+ = end of cycle).
 * Returns a fractional month so the UI can render a smooth efficiency curve.
 */
export function getMonthsOwned(purchasedAt: number, now: number = mockServerNow()): number {
  return Math.max(0, (now - purchasedAt) / ONE_MONTH_MS);
}

/**
 * Multiplier in [MIN_EFFICIENCY, 1.0]. Smooth across stage boundaries by integrating
 * the monthly rate up to the current fractional month.
 *
 *   eff(t) = product over k in 1..floor(t) of (1 + rate(k))  ×  (1 + rate(floor(t)+1))^(t - floor(t))
 */
export function getEfficiency(monthsOwned: number): number {
  if (monthsOwned <= 0) return 1;

  const rateAt = (m: number): number => {
    if (m <= 3) return DEGRADATION_PER_MONTH.early;
    if (m <= 8) return DEGRADATION_PER_MONTH.middle;
    return DEGRADATION_PER_MONTH.late;
  };

  const whole = Math.floor(monthsOwned);
  const frac = monthsOwned - whole;

  let eff = 1;
  for (let m = 1; m <= whole; m++) {
    eff *= 1 + rateAt(m);
  }
  if (frac > 0) {
    eff *= 1 + rateAt(whole + 1) * frac;
  }
  return Math.max(MIN_EFFICIENCY, eff);
}

/**
 * Convenience: full degradation summary for a single device.
 */
export interface DeviceLifecycleSummary {
  isDegradable: boolean;
  monthsOwned: number;
  efficiency: number;       // 0..1, applied to baseRate
  dailyRateAtFull: number;  // baseRate (USD/day at 100% efficiency)
  dailyRateNow: number;     // baseRate × efficiency
  dailyLossUSD: number;     // dailyRateAtFull − dailyRateNow
  monthlyLossUSD: number;   // dailyLossUSD × 30
}

export function getLifecycleSummary(
  device: Device,
  now: number = mockServerNow(),
): DeviceLifecycleSummary {
  const degradable = isDegradable(device.kind);
  if (!degradable) {
    return {
      isDegradable: false,
      monthsOwned: 0,
      efficiency: 1,
      dailyRateAtFull: device.baseRate,
      dailyRateNow: device.baseRate,
      dailyLossUSD: 0,
      monthlyLossUSD: 0,
    };
  }
  const monthsOwned = getMonthsOwned(device.purchasedAt, now);
  const efficiency = getEfficiency(monthsOwned);
  const dailyRateAtFull = device.baseRate;
  const dailyRateNow = dailyRateAtFull * efficiency;
  const dailyLossUSD = dailyRateAtFull - dailyRateNow;
  return {
    isDegradable: true,
    monthsOwned,
    efficiency,
    dailyRateAtFull,
    dailyRateNow,
    dailyLossUSD,
    monthlyLossUSD: dailyLossUSD * 30,
  };
}

/**
 * Aggregate monthly loss across all degradable devices (used by /earn banner).
 */
export function getNetworkMonthlyLoss(
  devices: Device[],
  now: number = mockServerNow(),
): { totalMonthlyLossUSD: number; degradableCount: number } {
  let totalMonthlyLossUSD = 0;
  let degradableCount = 0;
  for (const d of devices) {
    if (!isDegradable(d.kind)) continue;
    degradableCount += 1;
    const { monthlyLossUSD } = getLifecycleSummary(d, now);
    totalMonthlyLossUSD += monthlyLossUSD;
  }
  return { totalMonthlyLossUSD, degradableCount };
}
