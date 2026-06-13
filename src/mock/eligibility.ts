/**
 * Device purchase eligibility — pure-function rule evaluator.
 * Ported from Nexion-prototype/lib/v3/eligibility.ts (zero React deps — plain
 * functions over a context object; "use client" stripped, import paths
 * rewritten to @/mock + @/store).
 *
 * ⚠️ MOCK-ONLY client-side check. Production: GET /api/devices/eligibility?kind=X
 * (TBD; candidate, not yet in PRD §9.11). Server is sole authority; client
 * eligibility is for UI affordance only (which sheet to open / lock button +
 * hint) and never gates the actual POST /api/orders/create call.
 *
 * Each device kind has a `mode` (open / any-of / all-of) and a list of `rules`
 * (see @/mock/tradein-config schema). We evaluate every rule and aggregate per
 * mode.
 */

import type { Device, DeviceKind } from "@/store/types";
import type {
  EligibilityRule,
  EligibilityMode,
  TradeinConfig,
} from "@/mock/tradein-config";
import { previousTier, UPGRADE_LADDER } from "@/mock/tradein-config";

// ─────────────────────────────────────────────────────────────── Context

export interface EligibilityContext {
  /** Full device list (active + inventory). */
  devices: Device[];
  /** V-rank level (1-13). */
  vRank: number;
  /** Cumulative USDT deposit lifetime. */
  cumulativeDepositUsdt: number;
  /** KYC level. "none" passes nothing requiring KYC. */
  kycTier: "none" | "basic" | "verified" | "enhanced";
  /** Account creation timestamp (ms epoch). */
  accountCreatedAt: number;
  /** Confirmed referral count (binding completed + not refunded). */
  referralConfirmedCount: number;
  /** If user is currently in a trade-in flow trading in this kind, the
   *  `trade-in` rule for `fromKind` will pass. Null = not in trade-in flow. */
  tradeInFromKind?: DeviceKind | null;
}

// ─────────────────────────────────────────────────────────────── Result

export interface EligibilityResult {
  eligible: boolean;
  mode: EligibilityMode;
  /** Rules that passed under this context. */
  passed: EligibilityRule[];
  /** Rules that failed, with current/required values + i18n hint key. */
  missing: Array<{
    rule: EligibilityRule;
    current?: number | string;
    required?: number | string;
    /** i18n key under `t.tradein.eligibilityHint*` describing what to do. */
    hintKey: string;
  }>;
}

// ─────────────────────────────────────────────────────────────── Helpers

const KYC_RANK: Record<EligibilityContext["kycTier"], number> = {
  none: 0,
  basic: 1,
  verified: 2,
  enhanced: 3,
};

function daysSince(ms: number): number {
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
}

function countOwned(devices: Device[], kind: DeviceKind): number {
  // Count both active (activatedAt !== null) AND inventory devices of kind.
  return devices.filter((d) => d.kind === kind).length;
}

// ─────────────────────────────────────────────────────────────── Single-rule check

/**
 * Evaluate a single rule. Returns { pass: boolean, current?, required?, hintKey }.
 */
export function checkRule(
  rule: EligibilityRule,
  ctx: EligibilityContext,
): {
  pass: boolean;
  current?: number | string;
  required?: number | string;
  hintKey: string;
} {
  switch (rule.type) {
    case "open":
      return { pass: true, hintKey: "tradein.eligibilityHintOpen" };

    case "own-kind": {
      const have = countOwned(ctx.devices, rule.kind);
      return {
        pass: have >= rule.count,
        current: have,
        required: rule.count,
        hintKey: "tradein.eligibilityHintOwnKind",
      };
    }

    case "own-prev-tier": {
      // Caller doesn't know the target kind — we'd need it for previousTier.
      // This rule is rarely used directly; prefer `own-kind` with explicit kind.
      // If used, fall back to checking S1 ownership (most-likely floor).
      const have = countOwned(ctx.devices, "stellarbox-s1");
      return {
        pass: have >= rule.count,
        current: have,
        required: rule.count,
        hintKey: "tradein.eligibilityHintOwnPrevTier",
      };
    }

    case "v-rank-min":
      return {
        pass: ctx.vRank >= rule.level,
        current: ctx.vRank,
        required: rule.level,
        hintKey: "tradein.eligibilityHintVRank",
      };

    case "cumulative-deposit-usdt":
      return {
        pass: ctx.cumulativeDepositUsdt >= rule.amount,
        current: ctx.cumulativeDepositUsdt,
        required: rule.amount,
        hintKey: "tradein.eligibilityHintDeposit",
      };

    case "kyc-tier": {
      const cur = KYC_RANK[ctx.kycTier];
      const req = KYC_RANK[rule.tier];
      return {
        pass: cur >= req,
        current: ctx.kycTier,
        required: rule.tier,
        hintKey: "tradein.eligibilityHintKyc",
      };
    }

    case "days-active": {
      const days = daysSince(ctx.accountCreatedAt);
      return {
        pass: days >= rule.days,
        current: days,
        required: rule.days,
        hintKey: "tradein.eligibilityHintDaysActive",
      };
    }

    case "referral-count":
      return {
        pass: ctx.referralConfirmedCount >= rule.count,
        current: ctx.referralConfirmedCount,
        required: rule.count,
        hintKey: "tradein.eligibilityHintReferral",
      };

    case "trade-in":
      // Trade-in rule only passes when user is currently in a trade-in flow
      // trading in fromKind (ctx.tradeInFromKind === rule.fromKind).
      return {
        pass: ctx.tradeInFromKind === rule.fromKind,
        current: ctx.tradeInFromKind ?? "none",
        required: rule.fromKind,
        hintKey: "tradein.eligibilityHintTradeIn",
      };
  }
}

// ─────────────────────────────────────────────────────────────── Top-level

/**
 * Evaluate eligibility for a specific device kind.
 *
 * If the kind has no entry in cfg.eligibility, treat as `open` (default).
 */
export function checkEligibility(
  kind: DeviceKind,
  cfg: TradeinConfig,
  ctx: EligibilityContext,
): EligibilityResult {
  const elig = cfg.eligibility[kind];
  if (!elig) {
    return {
      eligible: true,
      mode: "open",
      passed: [{ type: "open" }],
      missing: [],
    };
  }

  const evals = elig.rules.map((rule) => ({ rule, ...checkRule(rule, ctx) }));
  const passed = evals.filter((e) => e.pass).map((e) => e.rule);
  const missing = evals
    .filter((e) => !e.pass)
    .map((e) => ({
      rule: e.rule,
      current: e.current,
      required: e.required,
      hintKey: e.hintKey,
    }));

  let eligible: boolean;
  switch (elig.mode) {
    case "open":
      eligible = true;
      break;
    case "any-of":
      eligible = passed.length > 0;
      break;
    case "all-of":
      eligible = missing.length === 0;
      break;
  }

  return { eligible, mode: elig.mode, passed, missing };
}

// ─────────────────────────────────────────────────────────────── Trade-in eligibility

/**
 * Returns the set of owned device kinds that, if traded in, would unlock
 * the target kind via the `trade-in` rule.
 *
 * Used by Path A trade-in UI: "Trade in your S1 to unlock Pro" affordance.
 */
export function eligibleTradeInSources(
  targetKind: DeviceKind,
  cfg: TradeinConfig,
  ctx: EligibilityContext,
): DeviceKind[] {
  const elig = cfg.eligibility[targetKind];
  if (!elig) return [];

  const sources: DeviceKind[] = [];
  for (const rule of elig.rules) {
    if (rule.type === "trade-in") {
      // User must own at least 1 ACTIVE device of rule.fromKind to trade in.
      // Inventory devices (activatedAt === null) are explicitly excluded so
      // the UI hint matches the action contract — showing "Trade in your S1
      // to unlock Pro" when the only S1 is inactive would silently fail.
      const activeCount = ctx.devices.filter(
        (d) => d.kind === rule.fromKind && d.activatedAt !== null,
      ).length;
      if (activeCount > 0) {
        sources.push(rule.fromKind);
      }
    }
  }
  return sources;
}

/**
 * Returns next tier above the user's highest-tier owned device.
 * Used by trade-in promo banner: "Trade in to upgrade to Pro / Rack".
 */
export function nextUpgradeTier(ctx: EligibilityContext): DeviceKind | null {
  const owned = new Set(ctx.devices.map((d) => d.kind));
  // Walk ladder from top down; find highest owned kind, return next above.
  for (let i = UPGRADE_LADDER.length - 1; i >= 0; i--) {
    if (owned.has(UPGRADE_LADDER[i])) {
      return i < UPGRADE_LADDER.length - 1 ? UPGRADE_LADDER[i + 1] : null;
    }
  }
  return UPGRADE_LADDER[1]; // first tier above phone
}

// Re-export previousTier for callers that need ladder math.
export { previousTier };
