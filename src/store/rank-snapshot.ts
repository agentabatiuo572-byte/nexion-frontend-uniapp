import { defineStore } from "pinia";
import { ref } from "vue";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";
import { normalizeAccountKey } from "@/store/account-cloud";

/**
 * 首页排名的 24h 快照(规格 FEAT-HOME02 ③ `rankSnapshot24h`)。
 *
 * 只为一件事存在:排名格副文本的「24h 上升 {n} 名」。规格异常4 明写 ——
 * **无快照就不显示变化,禁编造「↑12」**;所以它必须真落盘、按账号分行
 * (per-user 字段按账号作用域:设备级存储会让换号用户看到别人的昨日名次)。
 *
 * 滚动语义:快照存「≈24h 前的名次」。首次见到名次 → 只落盘不显示;
 * 快照满 24h → 用旧快照算一次前进量,同时滚动成当前名次。
 * 前进量 ≤ 0 不显示(名次单调由分位表保证,倒退只可能来自运营改配置 —— 那不叫「上升」)。
 *
 * PROD: 快照改由服务端按账号存取(endpoint TBD; candidate: GET /api/pulse/rank-snapshot,
 * 前端 PRD 尚无此接口,接入时以 PRD 定名为准);此处结构同形,接后台零重写。
 */
const ACCOUNTS_KEY = "nexgrid-rank-snapshot-accounts-v1"; // { [accountKey]: { rank, at } }

interface Snap {
  rank: number;
  at: number;
}

const DAY_MS = 24 * 3_600_000;

function hydrate(accountKey: string): Snap | null {
  const row = readAccountRow<Partial<Snap>>(ACCOUNTS_KEY, accountKey);
  if (row && typeof row.rank === "number" && Number.isFinite(row.rank) && typeof row.at === "number") {
    return { rank: row.rank, at: row.at };
  }
  return null;
}

export const useRankSnapshot = defineStore("rankSnapshot", () => {
  let boundKey = normalizeAccountKey("");
  const snap = ref<Snap | null>(hydrate(boundKey));

  function persist() {
    writeAccountRow(ACCOUNTS_KEY, boundKey, snap.value);
  }

  /** 账号切换重绑(与 weekly-quest 同范式;account-scope.ts 统一调度)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    snap.value = hydrate(boundKey);
  }

  /**
   * 报到当前名次,返回该显示的 24h 前进量(null = 不显示)。
   * 调用方每次渲染用当下名次现算(禁缓存名次 —— 缓存的是**快照**,不是名次)。
   */
  function deltaFor(currentRank: number, now: number): number | null {
    if (!Number.isFinite(currentRank) || currentRank < 1) return null;
    const s = snap.value;
    if (s === null) {
      snap.value = { rank: currentRank, at: now };
      persist();
      return null; // 首见:落盘,不显示(规格异常4)
    }
    if (now - s.at >= DAY_MS) {
      const delta = s.rank - currentRank;
      snap.value = { rank: currentRank, at: now };
      persist();
      return delta > 0 ? delta : null;
    }
    const delta = s.rank - currentRank;
    return delta > 0 ? delta : null;
  }

  return { snap, bindAccount, deltaFor };
});
