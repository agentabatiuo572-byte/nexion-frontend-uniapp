import { defineStore } from "pinia";
import { reactive } from "vue";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";

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

// 旧设备级单键 "nexgrid-event-quest-v1" 废弃(存量无账号归属,mock 可重建);活动参与态按账号分行。
const ACCOUNTS_KEY = "nexgrid-event-quest-accounts-v1"; // { [accountKey]: PersistShape }

interface PersistShape {
  joined: string[];
  claimed: string[];
}

function hydrate(accountKey: string): PersistShape {
  const row = readAccountRow<Partial<PersistShape>>(ACCOUNTS_KEY, accountKey);
  if (row) {
    return {
      joined: Array.isArray(row.joined) ? row.joined : [],
      claimed: Array.isArray(row.claimed) ? row.claimed : [],
    };
  }
  return { joined: [], claimed: [] };
}

export const useEventQuest = defineStore("eventQuest", () => {
  // 账号维度:boot 期落 "default",账号确定后由 lib/account-scope 统一重绑。
  let boundKey = "default";
  const init = hydrate(boundKey);
  // Record<id, true> membership maps (P-027: reactive Record, not Set/ref).
  const joinedMap = reactive<Record<string, boolean>>({});
  const claimedMap = reactive<Record<string, boolean>>({});
  for (const id of init.joined) joinedMap[id] = true;
  for (const id of init.claimed) claimedMap[id] = true;

  function persist() {
    writeAccountRow<PersistShape>(ACCOUNTS_KEY, boundKey, {
      joined: Object.keys(joinedMap).filter((k) => joinedMap[k]),
      claimed: Object.keys(claimedMap).filter((k) => claimedMap[k]),
    });
  }

  /** 账号切换重绑:清空并装载该账号的活动参与/领取态(P2-8 设备级泄漏修复)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    const next = hydrate(boundKey);
    for (const k of Object.keys(joinedMap)) delete joinedMap[k];
    for (const k of Object.keys(claimedMap)) delete claimedMap[k];
    for (const id of next.joined) joinedMap[id] = true;
    for (const id of next.claimed) claimedMap[id] = true;
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

  return { joinedMap, claimedMap, isJoined, isClaimed, join, claim, bindAccount };
});
