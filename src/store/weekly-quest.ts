import { defineStore } from "pinia";
import { ref } from "vue";
import { currentWeekKey, type Tier1QuestId, type Tier2QuestId } from "@/mock/weekly-quests";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";

/**
 * Weekly Quest store — ported from Nexion-prototype/lib/store/weekly-quest.ts
 * (zustand persist → Pinia + uni storage).
 *
 * Tracks per-week completion + claim state, deterministically reset on ISO-week
 * rollover (every Monday 00:00 UTC). rollWeekIfStale() compares the persisted
 * weekKey vs current on mount → on mismatch wipes completions + claim flags and
 * persists the new weekKey. Tier 1/2 quest defs live in mock/weekly-quests.ts;
 * this store only records what's been completed / claimed.
 *
 * Backend-replaceable: claim → POST /api/quests/weekly/{tier1|tier2/:id|bonus}
 * (PRD §9.11e atomic pattern); GET /api/quests/weekly is the config source
 * (admin H3 WEEKLY_T1/T2). Persist key carries a version suffix for migration.
 */

// 旧设备级单键 "nexgrid-weekly-quest-v1" 废弃(存量无账号归属,mock 可重建);周任务进度按账号分行。
const ACCOUNTS_KEY = "nexgrid-weekly-quest-accounts-v1"; // { [accountKey]: PersistShape }

interface PersistShape {
  weekKey: string;
  tier1Completed: Tier1QuestId | null;
  tier1Claimed: boolean;
  tier2Completed: Tier2QuestId[];
  tier2Claimed: Tier2QuestId[];
  bonusClaimed: boolean;
}

function hydrate(accountKey: string): PersistShape {
  const row = readAccountRow<Partial<PersistShape>>(ACCOUNTS_KEY, accountKey);
  if (row) {
    return {
      weekKey: typeof row.weekKey === "string" ? row.weekKey : currentWeekKey(),
      tier1Completed: (row.tier1Completed ?? null) as Tier1QuestId | null,
      tier1Claimed: row.tier1Claimed === true,
      tier2Completed: Array.isArray(row.tier2Completed) ? row.tier2Completed : [],
      tier2Claimed: Array.isArray(row.tier2Claimed) ? row.tier2Claimed : [],
      bonusClaimed: row.bonusClaimed === true,
    };
  }
  return {
    weekKey: currentWeekKey(),
    tier1Completed: null,
    tier1Claimed: false,
    tier2Completed: [],
    tier2Claimed: [],
    bonusClaimed: false,
  };
}

export const useWeeklyQuest = defineStore("weeklyQuest", () => {
  // 账号维度:boot 期落 "default",账号确定后由 lib/account-scope 统一重绑。
  let boundKey = "default";
  const init = hydrate(boundKey);
  const weekKey = ref(init.weekKey);
  const tier1Completed = ref<Tier1QuestId | null>(init.tier1Completed);
  const tier1Claimed = ref(init.tier1Claimed);
  const tier2Completed = ref<Tier2QuestId[]>(init.tier2Completed);
  const tier2Claimed = ref<Tier2QuestId[]>(init.tier2Claimed);
  const bonusClaimed = ref(init.bonusClaimed);

  function persist() {
    writeAccountRow<PersistShape>(ACCOUNTS_KEY, boundKey, {
      weekKey: weekKey.value,
      tier1Completed: tier1Completed.value,
      tier1Claimed: tier1Claimed.value,
      tier2Completed: tier2Completed.value,
      tier2Claimed: tier2Claimed.value,
      bonusClaimed: bonusClaimed.value,
    });
  }

  /** 账号切换重绑:装载该账号的周任务进度(P2-8 设备级泄漏修复)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    const next = hydrate(boundKey);
    weekKey.value = next.weekKey;
    tier1Completed.value = next.tier1Completed;
    tier1Claimed.value = next.tier1Claimed;
    tier2Completed.value = next.tier2Completed;
    tier2Claimed.value = next.tier2Claimed;
    bonusClaimed.value = next.bonusClaimed;
    // 🔴 换账号后必须立刻滚周(2026-08-05 独立证伪 A4)。周滚只挂在 onMounted 上,
    //   而账号切换时首页 hero 早已挂载、不会重跑 —— 于是装进来的若是**上周**那一行,
    //   上周的完成态会被当成本周的直接渲染,领取键可用。rollWeekIfStale 本就幂等,
    //   不陈旧时一个字节都不写。
    rollWeekIfStale();
  }

  /** Roll to current week if persisted weekKey is stale; called on mount. */
  function rollWeekIfStale() {
    const current = currentWeekKey();
    if (weekKey.value !== current) {
      weekKey.value = current;
      tier1Completed.value = null;
      tier1Claimed.value = false;
      tier2Completed.value = [];
      tier2Claimed.value = [];
      bonusClaimed.value = false;
      persist();
    }
  }

  /** Mark tier 1 as complete (one-shot per week). Returns true if newly set. */
  function markTier1Complete(id: Tier1QuestId): boolean {
    if (tier1Completed.value === id) return false;
    tier1Completed.value = id;
    persist();
    return true;
  }
  function claimTier1(): boolean {
    if (!tier1Completed.value || tier1Claimed.value) return false;
    tier1Claimed.value = true;
    persist();
    return true;
  }

  /** Mark tier 2 task complete. Idempotent. Returns true if newly set. */
  function markTier2Complete(id: Tier2QuestId): boolean {
    if (tier2Completed.value.includes(id)) return false;
    tier2Completed.value = [...tier2Completed.value, id];
    persist();
    return true;
  }
  function claimTier2(id: Tier2QuestId): boolean {
    if (!tier2Completed.value.includes(id)) return false;
    if (tier2Claimed.value.includes(id)) return false;
    tier2Claimed.value = [...tier2Claimed.value, id];
    persist();
    return true;
  }

  /** Claim the all-five-done bonus. Returns true if newly claimed. */
  function claimBonus(): boolean {
    if (bonusClaimed.value) return false;
    bonusClaimed.value = true;
    persist();
    return true;
  }

  /** Demo helper — force a fresh week + clear completions. */
  function reset() {
    weekKey.value = currentWeekKey();
    tier1Completed.value = null;
    tier1Claimed.value = false;
    tier2Completed.value = [];
    tier2Claimed.value = [];
    bonusClaimed.value = false;
    persist();
  }

  return {
    weekKey,
    tier1Completed,
    tier1Claimed,
    tier2Completed,
    tier2Claimed,
    bonusClaimed,
    rollWeekIfStale,
    markTier1Complete,
    claimTier1,
    markTier2Complete,
    claimTier2,
    claimBonus,
    reset,
    bindAccount,
  };
});
