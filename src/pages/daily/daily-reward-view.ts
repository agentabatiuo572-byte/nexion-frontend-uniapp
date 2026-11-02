import { formatAmount } from "../../lib/amount-display";
export type DailyMilestoneRewardKind = "usdt" | "uvt" | "spin" | "badge" | "unknown";

export function dailyMilestoneRewardKind(value: string): DailyMilestoneRewardKind {
  const kind = value.trim().toLowerCase();
  return kind === "usdt" || kind === "uvt" || kind === "spin" || kind === "badge" ? kind : "unknown";
}

export interface DailyRule { key: string; value: string }

export function dailyBaseReward(rules: readonly DailyRule[]): number | null {
  const value = rules.find(rule => rule.key.toLowerCase() === 'baseline')?.value.trim();
  if (!value || !/^\d+$/.test(value)) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 2147483647 ? amount : null;
}

export function dailyUpcomingMilestone(streak: number, milestones: readonly {
  day: number; rewardText: string; claimed: boolean;
}[]): { remainingDays: number; rewardText: string } | null {
  const next = milestones.filter(m => !m.claimed && m.day > streak)
    .reduce<(typeof milestones)[number] | null>((nearest, m) => !nearest || m.day < nearest.day ? m : nearest, null);
  return next ? { remainingDays: next.day - streak, rewardText: next.rewardText } : null;
}

/** The configured 1.5× / 2× lucky probabilities (percent strings), or null when either is missing or invalid. */
export function dailyLuckyOdds(rules: readonly DailyRule[]): { p15: string; p2: string } | null {
  const probability = (key: string): string | null => {
    const value = rules.find((rule) => rule.key.toLowerCase() === key)?.value.trim() ?? "";
    if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100 ? value : null;
  };
  const p15 = probability("p15");
  const p2 = probability("p2");
  return p15 === null || p2 === null ? null : { p15, p2 };
}

export function dailyLuckyHint(rules: readonly DailyRule[], fallback: string): string {
  const odds = dailyLuckyOdds(rules);
  if (odds === null) return fallback;
  const { p15, p2 } = odds;

  // Keep the locale-owned sentence intact. Only the two configured percentages
  // are authoritative runtime values; this deliberately does not manufacture
  // translated operational copy when a locale has no authored text.
  let position = 0;
  const values = [p15, p2];
  const localized = fallback.replace(/\d+(?:\.\d+)?[%％]/g, (matched) => {
    const value = values[position++];
    const sign = matched.endsWith("％") ? "％" : "%";
    return value === undefined ? matched : `${value}${sign}`;
  });
  return position >= 2 ? localized : fallback;
}

/**
 * Server milestone rewards arrive as enum codes (`rewardType` = POINTS / SPIN /
 * NEX / USDT / BADGE, `badgeCode` = STREAK_MASTER). Those codes are transport
 * values, never user copy, so every branch resolves through the locale labels
 * and an unknown code degrades to the generic unit instead of printing itself.
 */
export interface DailyRewardLabels {
  points: string;
  spin: string;
  nex: string;
  usdt: string;
  unknown: string;
  badge: string;
  badges: Readonly<Record<string, string>>;
}

/** Builds the label table from the shared `daily.milestones` vocabulary. */
export function dailyRewardLabels(m: {
  badgeLabel: string;
  rewardPoints: string;
  rewardSpin: string;
  rewardNex: string;
  rewardUsdt: string;
  rewardUnknown: string;
  badgeStreakMaster: string;
}): DailyRewardLabels {
  return {
    points: m.rewardPoints,
    spin: m.rewardSpin,
    nex: m.rewardNex,
    usdt: m.rewardUsdt,
    unknown: m.rewardUnknown,
    badge: m.badgeLabel,
    badges: { STREAK_MASTER: m.badgeStreakMaster },
  };
}

/** Readable badge name for a shipped achievement code, `null` when unmapped. */
export function dailyBadgeName(badgeCode: string | null | undefined, labels: DailyRewardLabels): string | null {
  const code = badgeCode?.trim().toUpperCase();
  return code ? labels.badges[code] ?? null : null;
}

export function dailyMilestoneRewardText(reward: {
  rewardType: string;
  rewardAmount: number;
  badgeCode: string | null;
}, labels: DailyRewardLabels): string {
  const type = reward.rewardType.trim().toUpperCase();
  if (type === "BADGE") {
    const name = dailyBadgeName(reward.badgeCode, labels);
    return name ? `${labels.badge} · ${name}` : labels.badge;
  }
  const unit = type === "POINTS" ? labels.points
    : type === "SPIN" ? labels.spin
    : type === "UVT" ? labels.nex
    : type === "USDT" ? labels.usdt
    : labels.unknown;
  return `${unit} ${type === "USDT" || type === "UVT" ? formatAmount(reward.rewardAmount) : reward.rewardAmount}`;
}

/**
 * Streak ring for the current stage: the segments between the last reached
 * milestone day (`prev`, 0 when none) and the next one. Past the last tier the
 * ring is a full seven-segment circle with no next reward.
 */
export function dailyStreakRing(streak: number, milestoneDays: readonly number[]): {
  segments: number; done: number; next: number | null;
} {
  const days = [...new Set(milestoneDays.filter(day => day > 0))].sort((a, b) => a - b);
  const next = days.find(day => day > streak) ?? null;
  if (next === null) return { segments: 7, done: 7, next: null };
  const prev = days.filter(day => day <= streak).pop() ?? 0;
  return { segments: next - prev, done: streak - prev, next };
}
