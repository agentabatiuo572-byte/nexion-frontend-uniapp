import type { PlatformConfig } from "@/store/config-types";

export interface VisibleReferralGift {
  usdtAmount: number;
  nexAmount: number;
}

/** Keep every local/demo reward surface fail-closed behind the same H8 gate. */
export function visibleReferralGift(rewards: PlatformConfig["rewards"]): VisibleReferralGift {
  if (!rewards.enabled) return { usdtAmount: 0, nexAmount: 0 };
  return {
    usdtAmount: rewards.welcomeGift.usdtAmount,
    nexAmount: rewards.welcomeGift.nexAmount,
  };
}

/** Never let a configured reward promise bypass the current H8 reward gate. */
export function referralShareText(
  enabled: boolean,
  enabledTemplate: string,
  disabledTemplate: string,
  link: string,
): string {
  const template = enabled ? enabledTemplate : disabledTemplate;
  return template.split("{link}").join(link);
}
