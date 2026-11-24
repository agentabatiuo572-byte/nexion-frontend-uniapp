import type { DirectReferralPolicy } from "@/api/direct-referral-api";

export function deviceLevel2RatePct(policy: DirectReferralPolicy | null | undefined): number | null {
  return policy?.deviceEarning.level2RatePct ?? null;
}

/** The second level shows only while device rewards are on and its rate is above 0. */
export function deviceLevel2On(policy: DirectReferralPolicy | null | undefined): boolean {
  const rate = deviceLevel2RatePct(policy);
  return !!policy?.deviceEarning.enabled && rate !== null && rate > 0;
}
