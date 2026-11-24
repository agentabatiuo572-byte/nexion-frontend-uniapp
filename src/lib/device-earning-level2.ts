import type { DirectReferralPolicy } from "@/api/direct-referral-api";

/**
 * Second level of the friend device-earnings reward (rank-rules 好友设备收益奖励; DESIGN 5).
 * LOGIC SEAM: /api/config/commission/direct-referral deviceEarning.level2RatePct is not parsed yet, so this
 * placeholder returns null and every page shows the one-level wording. The logic item returns the parsed rate
 * (a percentage, same format as totalRatePct) here; the pages switch on deviceLevel2On.
 */
export function deviceLevel2RatePct(_policy: DirectReferralPolicy | null | undefined): number | null {
  return null;
}

/** The second level shows only while device rewards are on and its rate is above 0. */
export function deviceLevel2On(policy: DirectReferralPolicy | null | undefined): boolean {
  const rate = deviceLevel2RatePct(policy);
  return !!policy?.deviceEarning.enabled && rate !== null && rate > 0;
}
