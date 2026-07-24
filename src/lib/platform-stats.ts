// Platform-level display stats — the SINGLE-SOURCE anchor for every
// platform-wide money/fleet figure rendered anywhere in the app
// (home pulse card, on-grid footer, ref social proof, onboarding intro,
// store global seed). Hand-written literals elsewhere are a regression;
// verify.sh `platform_stats_anchor` sentinel enforces this.
//
// Backend-replaceable: mock of `GET /api/platform/stats`. PROD returns the
// same accounting identity ({ activeDevices, totalPaidUsd, … }) server-side;
// the client keeps rendering the derived expressions below.
// Rework record: docs/changes/2026-07-24-platform-stats-single-anchor.md.

/** Fleet anchor — the ONLY platform device-count model (intro/trust/globe/home). */
export const FLEET_DEVICES = 28_432;

/** Published credible average yield tier, ~$24/device/day (PRD Q1–Q17 remediation). */
export const FLEET_AVG_DAILY_USD = 24;

/** Daily payout anchor: 28,432 × $24 = $682,368/day. */
export const DAILY_PAYOUT_USD = FLEET_DEVICES * FLEET_AVG_DAILY_USD;

/** ≈ $7.9/sec — live rate displays wobble around this, never accumulate. */
export const PAYOUT_PER_SEC_USD = DAILY_PAYOUT_USD / 86_400;

/** ≈ $20.5M — the "this month" round expression (30-day anchor month). */
export const MONTHLY_PAYOUT_USD = DAILY_PAYOUT_USD * 30;

/** This-month new joiners — people-role mock (ref page + share poster ×3
 *  locales). Deliberately NOT the fleet figure: 28,432 is devices-only. */
export const MONTHLY_NEW_JOINERS = 41_286;

// Cumulative payout, time-anchored (moved verbatim from intro.vue; see
// docs/changes/2026-07-24-intro-stats-cumulative.md). Seed = growth-curve
// integral (~187 equivalent days at today's rate), NOT fleet × age.
const PAID_ANCHOR_MS = Date.UTC(2026, 6, 24);
const PAID_CUMULATIVE_SEED_USD = 127_438_905;
const PAID_RATE_PER_MS = DAILY_PAYOUT_USD / 86_400_000;

/** All-time paid out — recomputed from the time anchor (derive, don't
 *  accumulate) so the total can never regress across visits/reloads. */
export function paidCumulativeNow(): number {
  return Math.round(PAID_CUMULATIVE_SEED_USD + Math.max(0, Date.now() - PAID_ANCHOR_MS) * PAID_RATE_PER_MS);
}
