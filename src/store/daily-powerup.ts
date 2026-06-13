import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Ported from Nexion-prototype/lib/store/daily-powerup.ts (zustand persist →
 * Pinia + uni storage). Tracks which streak-tied conversion power-ups the user
 * has claimed (activated). Unlock state is derived from current streak vs
 * threshold at the call site, not stored here — only the "activated" decision
 * is durable.
 */

export type StreakPowerUpId =
  | "royalty_boost"
  | "premium_trial"
  | "staking_boost"
  | "genesis_whitelist";

interface DailyPowerUpData {
  claimed: StreakPowerUpId[];
  claimedAt: Record<string, number>;
}

const STORAGE_KEY = "nexion-daily-powerup-v1";

function hydrate(): DailyPowerUpData {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as Partial<DailyPowerUpData> | "";
    if (s && typeof s === "object" && Array.isArray(s.claimed)) {
      return {
        claimed: s.claimed,
        claimedAt: s.claimedAt && typeof s.claimedAt === "object" ? s.claimedAt : {},
      };
    }
  } catch {
    // first run
  }
  return { claimed: [], claimedAt: {} };
}

export const useDailyPowerUp = defineStore("dailyPowerUp", () => {
  const init = hydrate();
  const claimed = ref<StreakPowerUpId[]>(init.claimed);
  const claimedAt = ref<Record<string, number>>(init.claimedAt);

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, { claimed: claimed.value, claimedAt: claimedAt.value });
    } catch {
      // storage unavailable
    }
  }

  function claim(id: StreakPowerUpId): boolean {
    if (claimed.value.includes(id)) return false;
    claimed.value = [...claimed.value, id];
    claimedAt.value = { ...claimedAt.value, [id]: Date.now() };
    persist();
    return true;
  }

  function hasClaimed(id: StreakPowerUpId): boolean {
    return claimed.value.includes(id);
  }

  function reset() {
    claimed.value = [];
    claimedAt.value = {};
    persist();
  }

  return { claimed, claimedAt, claim, hasClaimed, reset };
});
