import { describe, expect, it } from "vitest";
import { courseRewardId } from "./course-reward-link";

describe("course reward detail link", () => {
  it("opens only a projected course reward source", () => {
    expect(courseRewardId({ memoKey: "learningReward", ref: "account-security@v1" })).toBe("account-security");
    expect(courseRewardId({ memoKey: "bonus", ref: "account-security@v1" })).toBeNull();
    expect(courseRewardId({ memoKey: "learningReward", ref: "LEARN:7:account-security:v1" })).toBeNull();
    expect(courseRewardId({ memoKey: "learningReward", ref: "bad/id@v1" })).toBeNull();
    expect(courseRewardId({ memoKey: "learningReward" })).toBeNull();
  });
});
