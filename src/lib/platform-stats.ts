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

/**
 * 注册用户展示值:从锚点按月增速**推算**,不累加、不回退(规格 FEAT-HOME02 ③,
 * 与上面 PAYOUT 同范式)。刷新页面得到同一时刻同一值;运营改基数即重置锚点。
 * 🔴 它同时是排名分母里的「真实人口」—— 首页第一格与第三格必须用同一次派生,
 * 两处各算一份就会出现「注册 1.42M 人、你排 1.5M 名」这种自相矛盾。
 */
export function derivedRegisteredUsers(
  ps: { registeredUsersBase: number; registeredUsersMonthlyGrowthPct: number; registeredUsersAnchorAt: number },
  now: number,
): number {
  const months = Math.max(0, (now - ps.registeredUsersAnchorAt) / (30 * 24 * 3_600_000));
  const v = ps.registeredUsersBase * Math.pow(1 + ps.registeredUsersMonthlyGrowthPct / 100, months);
  return Number.isFinite(v) ? Math.floor(v) : Number.NaN;
}

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
