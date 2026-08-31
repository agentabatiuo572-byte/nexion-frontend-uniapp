export interface DailyRule { key: string; value: string }

export function dailyLuckyHint(rules: readonly DailyRule[], fallback: string): string {
  const probability = (key: string): string | null => {
    const value = rules.find((rule) => rule.key.toLowerCase() === key)?.value.trim() ?? "";
    if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100 ? value : null;
  };
  const p15 = probability("p15");
  const p2 = probability("p2");
  if (p15 === null || p2 === null) return fallback;

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

export function dailyMilestoneRewardText(reward: {
  rewardType: string;
  rewardAmount: number;
  badgeCode: string | null;
}): string {
  if (reward.rewardType.trim().toUpperCase() !== "BADGE") return `${reward.rewardType} ${reward.rewardAmount}`;
  return reward.badgeCode?.trim() ? `Badge · ${reward.badgeCode.trim()}` : "Badge";
}
