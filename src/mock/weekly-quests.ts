// Weekly Quest task definitions & dispatcher — ported from
// Nexion-prototype/lib/mock/weekly-quests.ts.
//
// Two-tier structure:
//   Tier 1 Priority Quest    — 1 per week, single-pick from a 9-entry priority
//                              list based on user state (balance / hardware /
//                              V-rank / phase). The single biggest reward.
//   Tier 2 Engagement Quests — 4 per week, deterministically sampled from an
//                              8-entry pool keyed on weekKey. Stable across
//                              reloads within the same ISO week.
//
// Phase awareness: getPhaseRewardMultiplier(phase) 1.0 → 1.5 across P1..P6.
// Phase id is never surfaced in UI text — only modifies the displayed reward.
//
// Backend-replaceable: dispatch logic + reward table mirror the real
// GET /api/quests/weekly contract (admin H3 WEEKLY_T1/T2 config single source).
// Store-product hrefs use the uni detail route (/store/detail?id=) since uni
// has no file-based dynamic segment; navTo() flattens logical paths to uni
// routes.

import type { PhaseId } from "@/store/product-phase";

// ─────────────── Tier 1 Priority Quest ───────────────

export type Tier1QuestId =
  | "nex_v2_lock"          // P6+ founders
  | "buy_genesis"          // V6+ no genesis
  | "buy_additional_hw"    // has Rack + balance ≥ $2K
  | "tradein_upgrade"      // has Pro/Rack older gen
  | "upgrade_s1_to_pro_v2" // has S1 only
  | "subscribe_premium"    // P4+ no premium
  | "buy_first_box"        // no hardware + balance ≥ $200
  | "topup_balance"        // no hardware + balance < $200
  | "stake_fallback";      // fallback always-on

export interface Tier1QuestDef {
  id: Tier1QuestId;
  /** i18n key suffix → `weeklyQuest.tier1_{id}_{title|body|cta}` */
  i18nKey: Tier1QuestId;
  href: string;
  /** Base NEX reward before phase multiplier. */
  rewardNex: number;
  /** Optional USDT side reward. */
  rewardUsdt?: number;
  /** Optional badge unlock on completion. */
  badgeId?: string;
}

export const TIER1_QUESTS: Record<Tier1QuestId, Tier1QuestDef> = {
  nex_v2_lock:          { id: "nex_v2_lock",          i18nKey: "nex_v2_lock",          href: "/me/wallet/nex-v2-lock",          rewardNex: 3000, badgeId: "founders_backer" },
  buy_genesis:          { id: "buy_genesis",          i18nKey: "buy_genesis",          href: "/genesis",                        rewardNex: 2500, badgeId: "genesis_believer" },
  buy_additional_hw:    { id: "buy_additional_hw",    i18nKey: "buy_additional_hw",    href: "/store",                          rewardNex: 2000 },
  tradein_upgrade:      { id: "tradein_upgrade",      i18nKey: "tradein_upgrade",      href: "/me/devices",                     rewardNex: 1800 },
  upgrade_s1_to_pro_v2: { id: "upgrade_s1_to_pro_v2", i18nKey: "upgrade_s1_to_pro_v2", href: "/store/detail?id=stellarbox-pro-v2", rewardNex: 1500 },
  subscribe_premium:    { id: "subscribe_premium",    i18nKey: "subscribe_premium",    href: "/me/wallet/premium",              rewardNex: 800 },
  buy_first_box:        { id: "buy_first_box",        i18nKey: "buy_first_box",        href: "/store/detail?id=stellarbox-s1",  rewardNex: 1000, rewardUsdt: 10 },
  topup_balance:        { id: "topup_balance",        i18nKey: "topup_balance",        href: "/me/wallet/topup",                rewardNex: 100 },
  stake_fallback:       { id: "stake_fallback",       i18nKey: "stake_fallback",       href: "/staking",                        rewardNex: 250 },
};

// ─────────────── Tier 1 dispatcher ───────────────

export interface Tier1Context {
  phase: PhaseId;
  balanceUSDT: number;
  hasGenesis: boolean;
  myRank: number;
  hasHardware: boolean;
  hasS1Only: boolean;
  hasProOrRackP1: boolean;
  hasRackAnyGen: boolean;
  hasPremium: boolean;
  nexBalance: number;
  /** Whether the current Genesis gate allows a purchase. */
  genesisPurchasable: boolean;
}

/**
 * Pick the single most relevant Tier 1 quest for the user this week. Top match
 * wins; falls back to staking encouragement.
 */
export function dispatchTier1(ctx: Tier1Context): Tier1QuestDef {
  // 1. P6 + 持有 NEX → Vault
  if (ctx.phase === "P6" && ctx.nexBalance >= 5000) return TIER1_QUESTS.nex_v2_lock;
  // 2. V6+ + 无 Genesis
  if (ctx.myRank >= 6 && !ctx.hasGenesis && ctx.genesisPurchasable) return TIER1_QUESTS.buy_genesis;
  // 3. 有 Rack + 余额 ≥ $2K
  if (ctx.hasRackAnyGen && ctx.balanceUSDT >= 2000) return TIER1_QUESTS.buy_additional_hw;
  // 4. 有 Pro/Rack P1(存在更高价升级目标即可置换,FEAT-DEV02)
  if (ctx.hasProOrRackP1) return TIER1_QUESTS.tradein_upgrade;
  // 5. 有 S1 only
  if (ctx.hasS1Only) return TIER1_QUESTS.upgrade_s1_to_pro_v2;
  // 6. Phase P4+ 无 Premium
  if ((ctx.phase === "P4" || ctx.phase === "P5" || ctx.phase === "P6") && !ctx.hasPremium) {
    return TIER1_QUESTS.subscribe_premium;
  }
  // 7. 无 hardware + 余额够
  if (!ctx.hasHardware && ctx.balanceUSDT >= 200) return TIER1_QUESTS.buy_first_box;
  // 8. 无 hardware + 余额不够
  if (!ctx.hasHardware && ctx.balanceUSDT < 200) return TIER1_QUESTS.topup_balance;
  // 9. Fallback
  return TIER1_QUESTS.stake_fallback;
}

// ─────────────── Tier 2 Engagement Quest pool ───────────────

export type Tier2QuestId =
  | "invite_friend"
  | "reinvest"
  | "stake_small"
  | "nex_swap"
  | "top_up_small"
  | "browse_store"
  | "ai_jobs_50"
  | "genesis_browse";

export interface Tier2QuestDef {
  id: Tier2QuestId;
  i18nKey: Tier2QuestId;
  href: string;
  rewardNex: number;
  rewardUsdt?: number;
}

export const TIER2_QUESTS: Record<Tier2QuestId, Tier2QuestDef> = {
  invite_friend:  { id: "invite_friend",  i18nKey: "invite_friend",  href: "/team",                 rewardNex: 200, rewardUsdt: 2 },
  reinvest:       { id: "reinvest",       i18nKey: "reinvest",       href: "/me/wallet/repurchase", rewardNex: 120 },
  stake_small:    { id: "stake_small",    i18nKey: "stake_small",    href: "/staking",              rewardNex: 150 },
  nex_swap:       { id: "nex_swap",       i18nKey: "nex_swap",       href: "/me/wallet/exchange",   rewardNex: 80 },
  top_up_small:   { id: "top_up_small",   i18nKey: "top_up_small",   href: "/me/wallet/topup",      rewardNex: 100 },
  browse_store:   { id: "browse_store",   i18nKey: "browse_store",   href: "/store",                rewardNex: 50 },
  ai_jobs_50:     { id: "ai_jobs_50",     i18nKey: "ai_jobs_50",     href: "/earn",                 rewardNex: 80 },
  genesis_browse: { id: "genesis_browse", i18nKey: "genesis_browse", href: "/genesis/marketplace",  rewardNex: 60 },
};

export interface Tier2Context {
  balanceUSDT: number;
  nexBalance: number;
  hasHardware: boolean;
  /** ISO week key for the deterministic shuffle. */
  weekKey: string;
}

// FNV-1a hash, used as PRNG seed so the same week always renders the same set.
function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Sample 4 quests from the eligible pool for the given week. Deterministic by
 * weekKey — reloading within the same ISO week yields an identical set.
 */
export function dispatchTier2(ctx: Tier2Context): Tier2QuestDef[] {
  const eligible: Tier2QuestDef[] = [];
  eligible.push(TIER2_QUESTS.invite_friend);              // always
  if (ctx.balanceUSDT >= 100) eligible.push(TIER2_QUESTS.reinvest);
  if (ctx.balanceUSDT >= 200) eligible.push(TIER2_QUESTS.stake_small);
  if (ctx.nexBalance >= 100)  eligible.push(TIER2_QUESTS.nex_swap);
  if (ctx.balanceUSDT < 200)  eligible.push(TIER2_QUESTS.top_up_small);
  eligible.push(TIER2_QUESTS.browse_store);                // always
  if (ctx.hasHardware)        eligible.push(TIER2_QUESTS.ai_jobs_50);
  eligible.push(TIER2_QUESTS.genesis_browse);              // always

  // Deterministic shuffle (Fisher-Yates) seeded by weekKey.
  const rng = mulberry32(hashSeed(ctx.weekKey));
  const arr = [...eligible];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.slice(0, 4);
}

// ─────────────── Phase reward multiplier ───────────────

export function getPhaseRewardMultiplier(phase: PhaseId): number {
  switch (phase) {
    case "P1": return 1.0;
    case "P2": return 1.0;
    case "P3": return 1.1;
    case "P4": return 1.2;
    case "P5": return 1.3;
    case "P6": return 1.5;
  }
}

// ─────────────── Week key (ISO week-based bucket) ───────────────

/** Returns YYYY-W## where ## = ISO week number, 01-53. */
export function currentWeekKey(now: number = Date.now()): string {
  const d = new Date(now);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ─────────────── Constants ───────────────

export const WEEKLY_BONUS_NEX = 500;
export const WEEKLY_CHAMPION_BADGE_ID = "weekly_champion";
