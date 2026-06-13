import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Achievement records. Ported from Nexion-prototype/lib/store/achievements.ts
 * (zustand persist → Pinia + uni storage). Tracks unlocked/claimed state per
 * achievement id; definitions + reward amounts live in mock/achievements.ts.
 */

export interface AchievementRecord {
  id: string;
  unlockedAt: number;
  claimed: boolean;
}

const STORAGE_KEY = "nexion-achievements-v1";

function hydrate(): AchievementRecord[] {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as { records?: AchievementRecord[] } | "";
    if (s && typeof s === "object" && Array.isArray(s.records)) return s.records;
  } catch {
    // first run
  }
  return [];
}

export const useAchievements = defineStore("achievements", () => {
  const records = ref<AchievementRecord[]>(hydrate());

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, { records: records.value });
    } catch {
      // storage unavailable
    }
  }

  /** Returns true if newly unlocked. */
  function unlock(id: string): boolean {
    if (records.value.find((r) => r.id === id)) return false;
    records.value = [...records.value, { id, unlockedAt: Date.now(), claimed: false }];
    persist();
    return true;
  }

  /** Returns true if newly claimed. */
  function claim(id: string): boolean {
    const rec = records.value.find((r) => r.id === id);
    if (!rec || rec.claimed) return false;
    records.value = records.value.map((r) => (r.id === id ? { ...r, claimed: true } : r));
    persist();
    return true;
  }

  function isUnlocked(id: string): boolean {
    return !!records.value.find((r) => r.id === id);
  }

  function isClaimed(id: string): boolean {
    return !!records.value.find((r) => r.id === id && r.claimed);
  }

  function unlockedCount(): number {
    return records.value.length;
  }

  return { records, unlock, claim, isUnlocked, isClaimed, unlockedCount };
});
