import { describe, expect, it } from "vitest";
import { leadershipHowFacts, leadershipHowRanks } from "@/lib/leadership-how-facts";

describe("leadership How facts", () => {
  const snapshot = {
    injectRate: 0.07,
    unlockRank: 4,
    nextPayoutAt: "2026-09-13T23:59:00Z",
    distribution: [
      { vRank: 4, people: 2, votes: 3 },
      { vRank: 6, people: 1, votes: 12 },
    ],
  };

  it("derives qualification, rate and schedule from the live public snapshot", () => {
    const facts = leadershipHowFacts(snapshot);
    expect(facts.unlockRank).toBe(4);
    expect(facts.injectRatePct).toBeCloseTo(7);
    expect(facts.nextPayoutAt).toBe(snapshot.nextPayoutAt);
  });

  it("does not invent a V3 row when current F4 eligibility starts at V4", () => {
    expect(leadershipHowRanks(snapshot)).toEqual([4, 6]);
  });
});
