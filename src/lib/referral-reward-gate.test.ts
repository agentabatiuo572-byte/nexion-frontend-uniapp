import { describe, expect, it } from "vitest";
import type { PlatformConfig } from "@/store/config-types";
import { referralShareText, visibleReferralGift } from "@/lib/referral-reward-gate";

function rewards(enabled: boolean): PlatformConfig["rewards"] {
  return {
    enabled,
    welcomeGift: { lockMode: "risk_bucket", usdtAmount: 5, nexAmount: 20 },
    inviterReward: { nexAmount: 200 },
  };
}

describe("visibleReferralGift", () => {
  it("fails closed when referral rewards are disabled even if stale amounts remain", () => {
    expect(visibleReferralGift(rewards(false))).toEqual({ usdtAmount: 0, nexAmount: 0 });
  });

  it("exposes the configured gift only while referral rewards are enabled", () => {
    expect(visibleReferralGift(rewards(true))).toEqual({ usdtAmount: 5, nexAmount: 20 });
  });

  it("ignores a configured reward promise when the gate is disabled", () => {
    expect(referralShareText(
      false,
      "Claim $5 + 20 NEX at {link}",
      "Invitation links are still available: {link}",
      "https://nexgrid.ai/ref/ABC",
    )).toBe("Invitation links are still available: https://nexgrid.ai/ref/ABC");
  });
});
