import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Ported from Nexion-prototype/lib/v3/staking.ts (zustand persist → Pinia + uni storage).
 * v3 玩法 — 质押锁仓:4 档 USDT 锁仓产品。
 *   30 天   12% APY  提前赎回罚 5%
 *   90 天   35% APY  提前赎回罚 15%
 *   180 天  80% APY  提前赎回罚 30%
 *   365 天 180% APY  提前赎回罚 50%
 *
 * ⚠️ MOCK-ONLY: APY/penalty tables + interest formula are client-side.
 * PRODUCTION: GET /api/config/staking/pools returns a unified
 * {poolId, currency, term, apy, penalty, enabled} list; claim()/earlyWithdraw()
 * route via POST /api/stakes/:id/{claim|early-withdraw} (one server transaction
 * returning canonical {balance, billId, receiptId}). Any client-hardcoded APY
 * must be deleted when wiring the backend.
 */

const ONE_DAY = 86400 * 1000;

export type StakingTerm = 30 | 90 | 180 | 365;

export const STAKING_APY: Record<StakingTerm, number> = {
  30: 0.12,
  90: 0.35,
  180: 0.8,
  365: 1.8,
};

export const STAKING_PENALTY: Record<StakingTerm, number> = {
  30: 0.05,
  90: 0.15,
  180: 0.3,
  365: 0.5,
};

export interface StakingPosition {
  id: string;
  amountUSDT: number;
  termDays: StakingTerm;
  apy: number;
  startTs: number;
  unlockTs: number;
  status: "active" | "matured" | "early-withdrawn" | "claimed";
}

const STORAGE_KEY = "nexion-v3-staking-v1";

function seedPositions(): StakingPosition[] {
  const now = Date.now();
  return [
    {
      id: "stk-1",
      amountUSDT: 500,
      termDays: 90,
      apy: 0.35,
      startTs: now - 30 * ONE_DAY,
      unlockTs: now + 60 * ONE_DAY,
      status: "active",
    },
  ];
}

function hydrate(): StakingPosition[] {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as { positions?: StakingPosition[] } | "";
    if (s && typeof s === "object" && Array.isArray(s.positions)) {
      return s.positions;
    }
  } catch {
    // first run
  }
  return seedPositions();
}

export const useStaking = defineStore("staking", () => {
  const positions = ref<StakingPosition[]>(hydrate());

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, { positions: positions.value });
    } catch {
      // storage unavailable
    }
  }

  function totalLocked() {
    return positions.value
      .filter((p) => p.status === "active")
      .reduce((s, p) => s + p.amountUSDT, 0);
  }

  function totalEarnedSoFar() {
    const t = Date.now();
    return positions.value
      .filter((p) => p.status === "active" || p.status === "matured")
      .reduce((s, p) => {
        const elapsed = Math.min(t, p.unlockTs) - p.startTs;
        const yrs = elapsed / (365 * ONE_DAY);
        return s + p.amountUSDT * p.apy * yrs;
      }, 0);
  }

  function activeCount() {
    return positions.value.filter((p) => p.status === "active").length;
  }

  function stake(amount: number, termDays: StakingTerm): StakingPosition {
    const t = Date.now();
    const pos: StakingPosition = {
      id: `stk-${t}`,
      amountUSDT: amount,
      termDays,
      apy: STAKING_APY[termDays],
      startTs: t,
      unlockTs: t + termDays * ONE_DAY,
      status: "active",
    };
    positions.value = [pos, ...positions.value];
    persist();
    return pos;
  }

  function earlyWithdraw(id: string): { ok: boolean; refund: number; penalty: number } {
    const p = positions.value.find((x) => x.id === id);
    if (!p || p.status !== "active") return { ok: false, refund: 0, penalty: 0 };
    const penaltyRate = STAKING_PENALTY[p.termDays];
    const penalty = p.amountUSDT * penaltyRate;
    const refund = p.amountUSDT - penalty;
    positions.value = positions.value.map((x) =>
      x.id === id ? { ...x, status: "early-withdrawn" as const } : x,
    );
    persist();
    return { ok: true, refund, penalty };
  }

  // ⚠️ MOCK-ONLY: interest computed client-side via simple APY formula.
  // PRODUCTION: POST /api/stakes/:id/claim returns {principal, interest}.
  function claim(id: string): { ok: boolean; principal: number; interest: number } {
    const p = positions.value.find((x) => x.id === id);
    if (!p || (p.status !== "active" && p.status !== "matured")) {
      return { ok: false, principal: 0, interest: 0 };
    }
    if (Date.now() < p.unlockTs) return { ok: false, principal: 0, interest: 0 };
    const interest = p.amountUSDT * p.apy * (p.termDays / 365);
    positions.value = positions.value.map((x) =>
      x.id === id ? { ...x, status: "claimed" as const } : x,
    );
    persist();
    return { ok: true, principal: p.amountUSDT, interest };
  }

  function markMatured() {
    const t = Date.now();
    let changed = false;
    const next = positions.value.map((p) => {
      if (p.status === "active" && p.unlockTs <= t) {
        changed = true;
        return { ...p, status: "matured" as const };
      }
      return p;
    });
    if (changed) {
      positions.value = next;
      persist();
    }
  }

  return {
    positions,
    totalLocked,
    totalEarnedSoFar,
    activeCount,
    stake,
    earlyWithdraw,
    claim,
    markMatured,
  };
});
