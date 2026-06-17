import { defineStore } from "pinia";
import { reactive } from "vue";

/**
 * Event-quest store — ported from Nexion-prototype/lib/store/event-quest.ts
 * (zustand persist → Pinia + uni storage).
 *
 * Tracks which trackable events the user has joined / claimed. The source
 * persisted two string[] sets; here (per PITFALL P-027) membership is modeled
 * as reactive<Record<string, boolean>> so template `.has()`-style reads stay
 * reactive across join/claim mutations (Vue does not track Set internals).
 *
 * Backend-replaceable: join → POST /api/events/:id/join, claim →
 * POST /api/events/:id/claim (PRD §9.11e atomic pattern). Persist key carries
 * a version suffix for forward migration.
 */

const STORAGE_KEY = "nexion-event-quest-v1";

interface PersistShape {
  joined: string[];
  claimed: string[];
}

function hydrate(): PersistShape {
  try {
    const s = uni.getStorageSync(STORAGE_KEY) as Partial<PersistShape> | "";
    if (s && typeof s === "object") {
      return {
        joined: Array.isArray(s.joined) ? s.joined : [],
        claimed: Array.isArray(s.claimed) ? s.claimed : [],
      };
    }
  } catch {
    // first run
  }
  return { joined: [], claimed: [] };
}

export const useEventQuest = defineStore("eventQuest", () => {
  const init = hydrate();
  // Record<id, true> membership maps (P-027: reactive Record, not Set/ref).
  const joinedMap = reactive<Record<string, boolean>>({});
  const claimedMap = reactive<Record<string, boolean>>({});
  for (const id of init.joined) joinedMap[id] = true;
  for (const id of init.claimed) claimedMap[id] = true;

  function persist() {
    try {
      uni.setStorageSync(STORAGE_KEY, {
        joined: Object.keys(joinedMap).filter((k) => joinedMap[k]),
        claimed: Object.keys(claimedMap).filter((k) => claimedMap[k]),
      } satisfies PersistShape);
    } catch {
      // storage unavailable
    }
  }

  function isJoined(id: string): boolean {
    return joinedMap[id] === true;
  }
  function isClaimed(id: string): boolean {
    return claimedMap[id] === true;
  }

  /** Returns true if this call newly joined (was not already joined). */
  function join(id: string): boolean {
    if (joinedMap[id]) return false;
    joinedMap[id] = true;
    persist();
    return true;
  }

  /** Returns true if this call newly claimed (was not already claimed). */
  function claim(id: string): boolean {
    if (claimedMap[id]) return false;
    claimedMap[id] = true;
    persist();
    return true;
  }

  return { joinedMap, claimedMap, isJoined, isClaimed, join, claim };
});
