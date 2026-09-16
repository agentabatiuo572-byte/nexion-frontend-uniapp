export interface LeadershipHowSnapshot {
  injectRate: number;
  unlockRank: number;
  nextPayoutAt: string;
  distribution: readonly { vRank: number }[];
}

/** Public F4 facts allowed in the instructional page. */
export function leadershipHowFacts(snapshot: LeadershipHowSnapshot) {
  return {
    unlockRank: snapshot.unlockRank,
    injectRatePct: snapshot.injectRate * 100,
    nextPayoutAt: snapshot.nextPayoutAt,
  };
}

/** The current server distribution is the only valid set of rows to explain. */
export function leadershipHowRanks(snapshot: LeadershipHowSnapshot): number[] {
  return [...new Set(snapshot.distribution.map((row) => row.vRank))].sort((left, right) => left - right);
}
