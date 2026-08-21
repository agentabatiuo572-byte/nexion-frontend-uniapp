import { describe, expect, it } from "vitest";
import { countRemoteReceipts, summarizeRemoteAchievements } from "./remote-me-summary";

describe("remote Me summary", () => {
  it("deduplicates compute and payment receipts from server projections", () => {
    expect(countRemoteReceipts(
      [{ receiptNo: "PAY-1" }, { receiptNo: "PAY-2" }],
      [{ recentTasks: [{ receiptNo: "TASK-1" }, { receiptNo: "PAY-1" }] }],
    )).toBe(3);
  });

  it("keeps the receipt count unavailable until every required projection is ready", () => {
    expect(countRemoteReceipts(null, [{ recentTasks: [] }])).toBeNull();
    expect(countRemoteReceipts([], null)).toBeNull();
  });

  it("counts only canonical claimed or fired point milestones", () => {
    expect(summarizeRemoteAchievements({
      dailyMilestones: [
        { status: "CLAIMED" },
        { status: "LOCKED" },
      ],
      earningMilestones: [
        { status: "FIRED" },
        { status: "CLAIMABLE" },
      ],
    })).toEqual({ unlocked: 2, total: 4 });
  });

  it("keeps achievements unavailable when the points projection is missing", () => {
    expect(summarizeRemoteAchievements(null)).toBeNull();
  });
});
