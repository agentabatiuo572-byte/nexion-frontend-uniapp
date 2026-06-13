import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Ported from Nexion-prototype/lib/v3/points.ts (zustand persist → Pinia + uni storage).
 * v3 玩法 — 贡献积分(控提现的核心机制):提现 USDT 消耗积分(100 USDT 提现 = 10 积分)。
 * 积分来源:每日签到 +1(7 天连续 +5 bonus)/ 复投 +50 / 邀请激活 +20 / 新手任务 +5。
 * 默认 8 积分(只够提 $80)→ 制造"差一点"焦虑。
 *
 * ⚠️ MOCK-ONLY: lucky multiplier + day-boundary check are client-side.
 * PRODUCTION: POST /api/points/sign-in → server returns {gained, streak, multiplier};
 * server enforces day boundary in platform TZ, prevents tampered clocks.
 */

const ONE_DAY = 86400 * 1000;

export interface PointsEvent {
  ts: number;
  delta: number;
  reason: string;
}

interface PointsData {
  points: number;
  history: PointsEvent[];
  lastSignedInAt: number;
  signInStreak: number;
  longestStreak: number;
  streakSavers: number;
  claimedMilestones: number[];
}

const STORAGE_KEY = "nexion-points-v1";

function defaults(): PointsData {
  return {
    points: 8,                      // 故意只给 8(提现 $80 门槛)
    history: [
      { ts: Date.now() - 1 * ONE_DAY, delta: 1, reason: "Daily check-in" },
      { ts: Date.now() - 2 * ONE_DAY, delta: 1, reason: "Daily check-in" },
      { ts: Date.now() - 3 * ONE_DAY, delta: 5, reason: "Tutorial completed" },
      { ts: Date.now() - 4 * ONE_DAY, delta: 1, reason: "Daily check-in" },
    ],
    lastSignedInAt: 0,
    signInStreak: 0,
    longestStreak: 0,
    streakSavers: 1,
    claimedMilestones: [],
  };
}

function hydrate(): PointsData {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as Partial<PointsData> | "";
    if (s && typeof s === "object" && typeof s.points === "number") {
      return { ...defaults(), ...s };
    }
  } catch {
    // first run
  }
  return defaults();
}

export const usePoints = defineStore("points", () => {
  const init = hydrate();
  const points = ref(init.points);
  const history = ref<PointsEvent[]>(init.history);
  const lastSignedInAt = ref(init.lastSignedInAt);
  const signInStreak = ref(init.signInStreak);
  const longestStreak = ref(init.longestStreak);
  const streakSavers = ref(init.streakSavers);
  const claimedMilestones = ref<number[]>(init.claimedMilestones);

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, {
        points: points.value,
        history: history.value,
        lastSignedInAt: lastSignedInAt.value,
        signInStreak: signInStreak.value,
        longestStreak: longestStreak.value,
        streakSavers: streakSavers.value,
        claimedMilestones: claimedMilestones.value,
      });
    } catch {
      // storage unavailable
    }
  }

  function signIn(): { ok: boolean; gained: number; streak: number; multiplier: number } {
    const t = Date.now();
    const last = lastSignedInAt.value;
    // 同一天不可重复
    if (last && new Date(last).toDateString() === new Date(t).toDateString()) {
      return { ok: false, gained: 0, streak: signInStreak.value, multiplier: 1 };
    }
    // 中断 streak?
    const continuous = last && t - last < 2 * ONE_DAY;
    const newStreak = continuous ? signInStreak.value + 1 : 1;
    const baseGain = 1;
    const bonus = newStreak > 0 && newStreak % 7 === 0 ? 5 : 0;
    // Lucky multiplier: 1.0x baseline, 15% chance of 1.5x, 5% chance of 2x.
    const roll = Math.random();
    const multiplier = roll < 0.05 ? 2 : roll < 0.20 ? 1.5 : 1;
    const gained = Math.round((baseGain + bonus) * multiplier);
    const newLongest = Math.max(longestStreak.value, newStreak);
    points.value = points.value + gained;
    lastSignedInAt.value = t;
    signInStreak.value = newStreak;
    longestStreak.value = newLongest;
    history.value = [
      {
        ts: t,
        delta: gained,
        reason:
          multiplier > 1
            ? `Daily +${baseGain + bonus} × ${multiplier}x lucky`
            : bonus
              ? `Day-${newStreak} streak bonus`
              : "Daily check-in",
      },
      ...history.value.slice(0, 49),
    ];
    persist();
    return { ok: true, gained, streak: newStreak, multiplier };
  }

  function useSaver(): boolean {
    if (streakSavers.value <= 0) return false;
    if (signInStreak.value !== 0 && lastSignedInAt.value > 0 && Date.now() - lastSignedInAt.value < 2 * ONE_DAY) {
      // Streak isn't actually broken
      return false;
    }
    // Restore to "as if checked in yesterday"
    const yesterday = Date.now() - ONE_DAY;
    streakSavers.value = streakSavers.value - 1;
    lastSignedInAt.value = yesterday;
    signInStreak.value = Math.max(1, Math.min(30, longestStreak.value || 1));
    history.value = [
      { ts: Date.now(), delta: 0, reason: "Streak saver used" },
      ...history.value.slice(0, 49),
    ];
    persist();
    return true;
  }

  function claimMilestone(day: number, gained: number, reason: string): boolean {
    if (claimedMilestones.value.includes(day)) return false;
    if (signInStreak.value < day) return false;
    points.value = points.value + gained;
    claimedMilestones.value = [...claimedMilestones.value, day];
    history.value = [{ ts: Date.now(), delta: gained, reason }, ...history.value.slice(0, 49)];
    persist();
    return true;
  }

  function earn(n: number, reason: string) {
    if (n <= 0) return;
    points.value = points.value + n;
    history.value = [{ ts: Date.now(), delta: n, reason }, ...history.value.slice(0, 49)];
    persist();
  }

  function spend(n: number, reason: string): boolean {
    if (points.value < n) return false;
    points.value = points.value - n;
    history.value = [{ ts: Date.now(), delta: -n, reason }, ...history.value.slice(0, 49)];
    persist();
    return true;
  }

  /** 提现所需积分:每 100 USDT = 10 积分 */
  function pointsRequiredFor(usdtAmount: number, pointsPer100 = 10) {
    return Math.ceil((usdtAmount * pointsPer100) / 100);
  }

  return {
    points, history, lastSignedInAt, signInStreak, longestStreak, streakSavers, claimedMilestones,
    signIn, useSaver, claimMilestone, earn, spend, pointsRequiredFor,
  };
});
