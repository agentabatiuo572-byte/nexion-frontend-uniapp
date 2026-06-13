import { defineStore } from "pinia";
import { ref } from "vue";
import type { VRank } from "./v-rank";

/**
 * Ported from Nexion-prototype/lib/v3/leadership-pool.ts (zustand → Pinia).
 * ⚠️ MOCK-ONLY V_VOTES + GLOBAL_V_DISTRIBUTION tables.
 * Production: GET /api/config/leadership-pool + GET /api/pool/state.
 * Client display only; server computes mySharePct + payouts.
 *
 * v3 玩法 — 全球领导奖池(顶级骨干虹吸):每周平台总交易额 5% 进入池子,
 * 按 V 级权重分票数(V3=1 ... V12=512 指数翻倍),顶部 10 人吃池子 80%。
 * 纯派生 store(无 mutation)→ 直接 seed,不需持久化。
 */

const ONE_DAY = 86400 * 1000;
const ONE_WEEK = 7 * ONE_DAY;

/** V 级 → 票数 */
export const V_VOTES: Record<VRank, number> = {
  0: 0, 1: 0, 2: 0,
  3: 1, 4: 2, 5: 4, 6: 8, 7: 16, 8: 32, 9: 64, 10: 128, 11: 256, 12: 512,
};

/** 全网 V 级分布(seed) */
const GLOBAL_V_DISTRIBUTION: Record<VRank, number> = {
  0: 84231,    // 大多数
  1: 12483,
  2: 3247,
  3: 487,
  4: 102,
  5: 21,
  6: 3,
  7: 1,
  8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
};

export interface LeadershipPayout {
  weekId: string;
  weekStartTs: number;
  poolUSDT: number;
  myVotes: number;
  totalVotes: number;
  mySharePct: number;
  payoutUSDT: number;
}

const now = Date.now();
const weekStart = now - (now % ONE_WEEK);

export const useLeadershipPool = defineStore("leadershipPool", () => {
  const globalVDistribution = ref<Record<VRank, number>>(GLOBAL_V_DISTRIBUTION);
  const currentWeekPoolUSDT = ref(487_321);   // 周交易 ~$9.7M × 5%
  const history = ref<LeadershipPayout[]>([
    {
      weekId: "w-2026-19",
      weekStartTs: weekStart - 1 * ONE_WEEK,
      poolUSDT: 412_897,
      myVotes: 0, totalVotes: 14_823,
      mySharePct: 0, payoutUSDT: 0,
    },
    {
      weekId: "w-2026-18",
      weekStartTs: weekStart - 2 * ONE_WEEK,
      poolUSDT: 398_412,
      myVotes: 0, totalVotes: 14_750,
      mySharePct: 0, payoutUSDT: 0,
    },
  ]);

  function totalVotes() {
    const dist = globalVDistribution.value;
    let sum = 0;
    for (const key of Object.keys(dist)) {
      const rank = Number(key) as VRank;
      sum += dist[rank] * V_VOTES[rank];
    }
    return sum;
  }

  function myVotes(myRank: VRank) {
    return V_VOTES[myRank];
  }

  function mySharePct(myRank: VRank) {
    const total = totalVotes();
    if (total === 0) return 0;
    return myVotes(myRank) / total;
  }

  function myProjectedPayout(myRank: VRank) {
    return currentWeekPoolUSDT.value * mySharePct(myRank);
  }

  function nextPayoutTs() {
    return weekStart + ONE_WEEK;
  }

  return {
    globalVDistribution, currentWeekPoolUSDT, history,
    totalVotes, myVotes, mySharePct, myProjectedPayout, nextPayoutTs,
  };
});
