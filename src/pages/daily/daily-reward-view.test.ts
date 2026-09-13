import { describe, expect, it } from "vitest";
import { dailyBaseReward, dailyLuckyHint, dailyMilestoneRewardText, dailyUpcomingMilestone } from "./daily-reward-view";

describe("daily reward presentation", () => {
  it("reads the configured base rather than assuming a final reward of two", () => {
    expect(dailyBaseReward([{ key: "baseline", value: "7" }])).toBe(7);
    expect(dailyBaseReward([{ key: "BASELINE", value: " 1 " }])).toBe(1);
    expect(dailyBaseReward([])).toBeNull();
  });
  it.each(["", "0", "-1", "1.5", "NaN", "2147483648"])("does not quote an invalid base %s", value => {
    expect(dailyBaseReward([{ key: "baseline", value }])).toBeNull();
  });
  it("uses the nearest unclaimed configured tier and its actual currency and amount", () => {
    expect(dailyUpcomingMilestone(8, [
      { day: 21, rewardText: "NEX 100", claimed: false },
      { day: 14, rewardText: "USDT 1.25", claimed: false },
      { day: 7, rewardText: "NEX 15", claimed: false },
    ])).toEqual({ remainingDays: 6, rewardText: "USDT 1.25" });
  });
  it("does not promise another reward when empty, reached, or already claimed before a streak reset", () => {
    expect(dailyUpcomingMilestone(1, [])).toBeNull();
    expect(dailyUpcomingMilestone(100, [{ day: 100, rewardText: "Badge", claimed: false }])).toBeNull();
    expect(dailyUpcomingMilestone(1, [{ day: 3, rewardText: "NEX 5", claimed: true }])).toBeNull();
  });
  it("uses the current p15 and p2 values delivered by the server", () => {
    expect(dailyLuckyHint(
      [{ key: "p15", value: "12" }, { key: "p2", value: "3.5" }],
      "Streak NEX + 15% chance for 1.5×, 5% chance for 2×",
    ))
      .toBe("Streak NEX + 12% chance for 1.5×, 3.5% chance for 2×");
  });

  it("keeps the bundled hint only when the authoritative rules are incomplete", () => {
    expect(dailyLuckyHint([{ key: "p15", value: "12" }], "fallback")).toBe("fallback");
  });

  it("presents a badge identity instead of a zero quantity", () => {
    expect(dailyMilestoneRewardText({ rewardType: "BADGE", rewardAmount: 0, badgeCode: "STREAK_100" }))
      .toBe("Badge · STREAK_100");
  });
});
