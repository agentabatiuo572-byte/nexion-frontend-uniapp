/**
 * Task-lock cumulative — ported from Nexion-prototype/lib/store/task-lock.ts.
 *
 * The platform's "premium queue" (Fine-tune, Sora-class video gen, full-precision
 * 405B inference) is gated by VRAM. A user on phone-only earns ~$0/d from these
 * tiers; a user on NexionBox S1 still misses the top-end. This helper projects
 * what the user "leaves on the table" each month — a phase-keyed cumulative
 * loss number used by <TaskLockCumulativeBanner> on /earn.
 *
 *   P1-P2 (months 0-4):   ~$40/mo locked  (entry-grade tasks)
 *   P3-P4 (months 4-8):   ~$140/mo locked (mid-tier model demand grows)
 *   P5-P6 (months 8-12):  ~$450/mo locked (high-end model demand peaks)
 *
 * Pure functions (no store) — mirrors source. Reads server time via
 * mockServerNow() so production swaps in real server time with no UI change.
 */

import {
  PHASES,
  getMonthsSince,
  getPhaseForMonth,
  type PhaseId,
  type PhaseParams,
} from "./product-phase";
import { mockServerNow } from "./server-time";

export const MONTHLY_LOCKED_TASK_USD: Record<PhaseId, number> = {
  P1: 40,
  P2: 40,
  P3: 140,
  P4: 140,
  P5: 450,
  P6: 450,
};

export interface TaskLockSummary {
  /** Current phase (used for label + CTA target hint) */
  phase: PhaseParams;
  /** Phase-keyed full-month value (e.g. 140 for P3) */
  phaseMonthlyUSD: number;
  /** Phase value × fraction of current calendar month elapsed */
  thisMonthUSD: number;
  /** Full historic sum since signup (complete months + current partial) */
  cumulativeUSD: number;
  /** Calendar-month progress (0..1) for the progress strip */
  monthProgress: number;
}

/**
 * Calendar-month-aware projection — uses Date.getMonth() so the partial-month
 * ramp aligns with month-end Stella push cadence.
 */
export function getTaskLockSummary(
  joinedAt: number,
  now: number = mockServerNow(),
): TaskLockSummary {
  const phase = getPhaseForMonth(getMonthsSince(joinedAt, now));
  const phaseMonthlyUSD = MONTHLY_LOCKED_TASK_USD[phase.id];

  // Current calendar month progress (0..1)
  const today = new Date(now);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1).getTime();
  const monthProgress = Math.min(
    1,
    Math.max(0, (now - monthStart) / (nextMonthStart - monthStart)),
  );
  const thisMonthUSD = phaseMonthlyUSD * monthProgress;

  // Cumulative across past full months since signup
  const monthsSinceJoin = getMonthsSince(joinedAt, now);
  const fullMonthsElapsed = Math.floor(monthsSinceJoin);
  let cumulativeUSD = 0;
  for (let m = 1; m <= fullMonthsElapsed; m++) {
    const monthPhase = getPhaseForMonth(m - 1); // month index → phase boundary
    cumulativeUSD += MONTHLY_LOCKED_TASK_USD[monthPhase.id];
  }
  cumulativeUSD += thisMonthUSD;

  return {
    phase,
    phaseMonthlyUSD,
    thisMonthUSD,
    cumulativeUSD,
    monthProgress,
  };
}

/**
 * Reasonable defaults for pre-mount — a stable shape so the first paint doesn't
 * flicker. Returns P1 baseline values matching a brand-new account.
 */
export function getInitialTaskLockSummary(): TaskLockSummary {
  return {
    phase: PHASES[0],
    phaseMonthlyUSD: MONTHLY_LOCKED_TASK_USD.P1,
    thisMonthUSD: 0,
    cumulativeUSD: 0,
    monthProgress: 0,
  };
}
