import type { EntitlementVRankReward, VRankReward } from "@/store/v-rank";

export function isEntitlementVRankReward(reward: VRankReward): reward is EntitlementVRankReward {
  return reward.type === "VOUCHER" || reward.type === "SKU" || reward.type === "CUSTOM";
}

export function rankEntitlementLabel(reward: EntitlementVRankReward,
  unavailable: { voucher: string; sku: string; custom: string }): string {
  if (reward.type === "CUSTOM") return reward.customLabel?.trim() || unavailable.custom;
  return reward.displayName?.trim() || (reward.type === "VOUCHER" ? unavailable.voucher : unavailable.sku);
}
