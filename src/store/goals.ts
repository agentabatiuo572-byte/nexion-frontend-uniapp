import { defineStore } from "pinia";
import { ref } from "vue";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";
import { goalsApi, remoteApiEnabled } from "@/api/runtime";

// Ported from Nexion-prototype/lib/store/goals.ts (zustand+persist → Pinia).
// User-defined earning goals (Sprint A-3 / F.3). Mock mode keeps the legacy
// account row for demos; remote and explicit sandbox modes are server-owned.
// 旧设备级单键 "nexgrid-goals-v1" 废弃(存量无账号归属,mock 可重建);目标按账号分行。
const ACCOUNTS_KEY = "nexgrid-goals-accounts-v1"; // { [accountKey]: { goals: Goal[] } }

export interface Goal {
  id: string;
  targetUSDT: number;
  deadlineMs: number; // user-set deadline (timestamp)
  createdAt: number;
  achieved: boolean;
}

export type GoalsLoadStatus = "idle" | "loading" | "ready" | "error";

function hydrate(accountKey: string): Goal[] {
  if (remoteApiEnabled) return [];
  const row = readAccountRow<{ goals?: Goal[] }>(ACCOUNTS_KEY, accountKey);
  if (row && Array.isArray(row.goals)) return row.goals;
  return [];
}

export const useGoals = defineStore("goals", () => {
  // 账号维度:boot 期落 "default",账号确定后由 lib/account-scope 统一重绑。
  let boundKey = "default";
  let scopeEpoch = 0;
  const goals = ref<Goal[]>(remoteApiEnabled ? [] : hydrate(boundKey));
  const lifetimeEarningsUsdt = ref(0);
  const status = ref<GoalsLoadStatus>(remoteApiEnabled ? "idle" : "ready");
  const error = ref("");
  const recommendation = ref<Awaited<ReturnType<typeof goalsApi.recommendation>> | null>(null);
  const recommendationStatus = ref<GoalsLoadStatus>(remoteApiEnabled ? "idle" : "ready");

  function persist() {
    if (remoteApiEnabled) return;
    writeAccountRow<{ goals: Goal[] }>(ACCOUNTS_KEY, boundKey, { goals: goals.value });
  }

  /** 账号切换重绑:装载该账号的目标(P2-8 设备级泄漏修复)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    if (remoteApiEnabled) {
      scopeEpoch += 1;
      goals.value = [];
      lifetimeEarningsUsdt.value = 0;
      recommendation.value = null;
      status.value = "loading";
      void refresh(scopeEpoch);
    } else {
      goals.value = hydrate(boundKey);
    }
  }

  async function refresh(expectedEpoch = scopeEpoch) {
    if (!remoteApiEnabled) return;
    status.value = "loading";
    error.value = "";
    try {
      const snapshot = await goalsApi.list();
      if (expectedEpoch !== scopeEpoch) return;
      goals.value = snapshot.goals.map((goal) => ({
        id: String(goal.id), targetUSDT: goal.targetUsdt, deadlineMs: goal.deadlineAt,
        createdAt: goal.createdAt, achieved: goal.achieved,
      }));
      lifetimeEarningsUsdt.value = snapshot.lifetimeEarningsUsdt;
      status.value = "ready";
    } catch (cause) {
      if (expectedEpoch !== scopeEpoch) return;
      status.value = "error";
      error.value = cause instanceof Error ? cause.message : "GOALS_UNAVAILABLE";
      goals.value = [];
    }
  }

  async function refreshRecommendation(targetUSDT: number, deadlineMs: number) {
    if (!remoteApiEnabled) return;
    const expectedEpoch = scopeEpoch;
    recommendationStatus.value = "loading";
    try {
      recommendation.value = await goalsApi.recommendation(targetUSDT, deadlineMs);
      if (expectedEpoch !== scopeEpoch) return;
      recommendationStatus.value = "ready";
    } catch {
      if (expectedEpoch !== scopeEpoch) return;
      recommendation.value = null;
      recommendationStatus.value = "error";
    }
  }

  async function setGoal(g: Pick<Goal, "targetUSDT" | "deadlineMs">) {
    if (remoteApiEnabled) {
      const expectedEpoch = scopeEpoch;
      const goal = await goalsApi.create({ targetUsdt: g.targetUSDT, deadlineAt: g.deadlineMs });
      if (expectedEpoch !== scopeEpoch) return;
      goals.value = [...goals.value, {
        id: String(goal.id), targetUSDT: goal.targetUsdt, deadlineMs: goal.deadlineAt,
        createdAt: goal.createdAt, achieved: goal.achieved,
      }];
      lifetimeEarningsUsdt.value = goal.lifetimeEarningsUsdt;
      return;
    }
    goals.value = [
      ...goals.value,
      { ...g, id: `goal-${Date.now()}`, createdAt: Date.now(), achieved: false },
    ];
    persist();
  }

  async function markAchieved(id: string) {
    if (remoteApiEnabled) {
      const expectedEpoch = scopeEpoch;
      const goal = await goalsApi.setStatus(Number(id), true);
      if (expectedEpoch !== scopeEpoch) return;
      goals.value = goals.value.map((item) => item.id === id ? { ...item, achieved: goal.achieved } : item);
      return;
    }
    goals.value = goals.value.map((g) => (g.id === id ? { ...g, achieved: true } : g));
    persist();
  }

  async function remove(id: string) {
    if (remoteApiEnabled) {
      const expectedEpoch = scopeEpoch;
      await goalsApi.remove(Number(id));
      if (expectedEpoch !== scopeEpoch) return;
    }
    goals.value = goals.value.filter((g) => g.id !== id);
    if (!remoteApiEnabled) persist();
  }

  function clear() {
    if (remoteApiEnabled) {
      goals.value = [];
      return;
    }
    goals.value = [];
    persist();
  }

  return {
    goals, lifetimeEarningsUsdt, status, error, recommendation, recommendationStatus,
    refresh, refreshRecommendation, setGoal, markAchieved, remove, clear, bindAccount,
  };
});
