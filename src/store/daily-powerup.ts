import { defineStore } from "pinia";
import { ref } from "vue";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";

/**
 * Ported from Nexion-prototype/lib/store/daily-powerup.ts (zustand persist →
 * Pinia + uni storage). Tracks which streak-tied conversion power-ups the user
 * has claimed (activated). Unlock state is derived from current streak vs
 * threshold at the call site, not stored here — only the "activated" decision
 * is durable.
 */

export type StreakPowerUpId =
  | "royalty_boost"
  | "nex_boost"
  | "staking_boost"
  | "genesis_whitelist";

interface DailyPowerUpData {
  claimed: StreakPowerUpId[];
  claimedAt: Record<string, number>;
}

// 旧设备级单键 "nexgrid-daily-powerup-v1" 废弃(存量无账号归属,mock 可重建);增益领取态按账号分行。
const ACCOUNTS_KEY = "nexgrid-daily-powerup-accounts-v1"; // { [accountKey]: DailyPowerUpData }

function hydrate(accountKey: string): DailyPowerUpData {
  const row = readAccountRow<Partial<DailyPowerUpData>>(ACCOUNTS_KEY, accountKey);
  if (row && Array.isArray(row.claimed)) {
    return {
      claimed: row.claimed,
      claimedAt: row.claimedAt && typeof row.claimedAt === "object" ? row.claimedAt : {},
    };
  }
  return { claimed: [], claimedAt: {} };
}

export const useDailyPowerUp = defineStore("dailyPowerUp", () => {
  // 账号维度:boot 期落 "default",账号确定后由 lib/account-scope 统一重绑。
  let boundKey = "default";
  const init = hydrate(boundKey);
  const claimed = ref<StreakPowerUpId[]>(init.claimed);
  const claimedAt = ref<Record<string, number>>(init.claimedAt);

  function persist() {
    writeAccountRow<DailyPowerUpData>(ACCOUNTS_KEY, boundKey, { claimed: claimed.value, claimedAt: claimedAt.value });
  }

  /** 账号切换重绑:装载该账号的增益领取态(P2-8 设备级泄漏修复)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    const next = hydrate(boundKey);
    claimed.value = next.claimed;
    claimedAt.value = next.claimedAt;
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

  return { claimed, claimedAt, claim, hasClaimed, reset, bindAccount };
});
