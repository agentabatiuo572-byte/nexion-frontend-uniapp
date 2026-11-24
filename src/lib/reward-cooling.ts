import type { DirectReferralPolicy } from "@/api/direct-referral-api";

export function purchaseCoolingDays(policy: DirectReferralPolicy | null): number | null {
  return policy?.sevenLayerReference?.coolingDays ?? null;
}

export function creditsAtOnce(coolingDays: number | null | undefined): boolean {
  return coolingDays === 0;
}
