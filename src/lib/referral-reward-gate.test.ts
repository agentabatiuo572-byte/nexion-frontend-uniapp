import { describe, expect, it } from "vitest";
import type { PlatformConfig } from "@/store/config-types";
import { newcomerSubtitleKind, referralShareText, visibleReferralGift } from "@/lib/referral-reward-gate";

function rewards(enabled: boolean): PlatformConfig["rewards"] {
  return {
    enabled,
    effectiveAt: "2026-09-02T00:00:00Z",
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

describe("newcomerSubtitleKind", () => {
  /**
   * zentao #227:闸门关闭时金额会被归零,而「金额为 0」那一支的文案仍是
   * 「新人奖励已备好,连接设备即刻到账」—— 只看金额就会在奖励停用期间
   * 照样承诺一份不会到账的奖励。分档必须**先看闸门**。
   */
  it("never promises a newcomer reward while the reward gate is disabled", () => {
    expect(newcomerSubtitleKind(false, 5)).toBe("gated");
    // 关键用例:闸门关 + 金额已被归零,不能落进「已备好」那一支。
    expect(newcomerSubtitleKind(false, 0)).toBe("gated");
  });

  it("reports the amount only when the gate is on and an amount is configured", () => {
    expect(newcomerSubtitleKind(true, 5)).toBe("amount");
  });

  it("falls back to the no-amount wording when the gate is on but nothing is configured", () => {
    expect(newcomerSubtitleKind(true, 0)).toBe("prepared");
  });
});
