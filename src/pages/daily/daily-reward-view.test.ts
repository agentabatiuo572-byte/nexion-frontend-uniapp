import { describe, expect, it } from "vitest";
import { dailyLuckyHint, dailyMilestoneRewardText } from "./daily-reward-view";

describe("daily reward presentation", () => {
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
