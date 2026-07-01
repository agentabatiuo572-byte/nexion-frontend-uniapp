import { defineStore } from "pinia";
import { ref } from "vue";
import { currentWeekKey, type Tier1QuestId, type Tier2QuestId } from "@/mock/weekly-quests";

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

const STORAGE_KEY = "nexion-weekly-quest-v1";

interface PersistShape {
  weekKey: string;
  tier1Completed: Tier1QuestId | null;
  tier1Claimed: boolean;
  tier2Completed: Tier2QuestId[];
  tier2Claimed: Tier2QuestId[];
  bonusClaimed: boolean;
}

function hydrate(): PersistShape {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as Partial<PersistShape> | "";
    if (s && typeof s === "object") {
      return {
        weekKey: typeof s.weekKey === "string" ? s.weekKey : currentWeekKey(),
        tier1Completed: (s.tier1Completed ?? null) as Tier1QuestId | null,
        tier1Claimed: s.tier1Claimed === true,
        tier2Completed: Array.isArray(s.tier2Completed) ? s.tier2Completed : [],
        tier2Claimed: Array.isArray(s.tier2Claimed) ? s.tier2Claimed : [],
        bonusClaimed: s.bonusClaimed === true,
      };
    }
  } catch {
    // first run
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
  const init = hydrate();
  const weekKey = ref(init.weekKey);
  const tier1Completed = ref<Tier1QuestId | null>(init.tier1Completed);
  const tier1Claimed = ref(init.tier1Claimed);
  const tier2Completed = ref<Tier2QuestId[]>(init.tier2Completed);
  const tier2Claimed = ref<Tier2QuestId[]>(init.tier2Claimed);
  const bonusClaimed = ref(init.bonusClaimed);

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, {
        weekKey: weekKey.value,
        tier1Completed: tier1Completed.value,
        tier1Claimed: tier1Claimed.value,
        tier2Completed: tier2Completed.value,
        tier2Claimed: tier2Claimed.value,
        bonusClaimed: bonusClaimed.value,
      } satisfies PersistShape);
    } catch {
      // storage unavailable
    }
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
  };
});
