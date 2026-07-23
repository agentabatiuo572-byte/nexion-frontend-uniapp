import { defineStore } from "pinia";
import { ref } from "vue";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";

/**
 * Earnings milestone store. Ported from
 * Nexion-prototype/lib/store/milestones.ts (zustand persist → Pinia + uni
 * storage) and Nexion-prototype/app/components/milestone-watcher.tsx (the
 * celebration overlay state moved into this store so a global overlay host can
 * drive it).
 *
 * Tracks which lifetime-earnings thresholds the user has already crossed so
 * each one fires a celebration exactly once. `firedIds` is persisted across
 * reloads — milestones do not re-fire after refresh.
 *
 * ⚠️ MOCK-ONLY thresholds + reward table. backend-replaceable structure:
 *   - Production: GET /api/config/milestones for threshold + reward
 *     (PRD §9.11c.1), POST /api/me/milestones/:id/claim for server-validated
 *     payout with idempotency key (PRD §9.11e atomic pattern).
 *   - This store only mirrors fired ids + drives the overlay; the NEX payout +
 *     bill-ledger write are composed by the caller (App.vue) so this store
 *     stays import-free of creditNex / bills (cross-store orchestration rule).
 */

export interface MilestoneStep {
  id: string;             // e.g. "earn-100"
  thresholdUSD: number;   // life-to-date earnings to cross
  label: string;          // i18n key resolved by caller, e.g. "milestones.earn100"
  nexReward: number;      // NEX bonus credited on first fire
}

export const EARNINGS_MILESTONES: ReadonlyArray<MilestoneStep> = [
  { id: "earn-100",   thresholdUSD: 100,    label: "earn100",   nexReward: 100 },
  { id: "earn-500",   thresholdUSD: 500,    label: "earn500",   nexReward: 250 },
  { id: "earn-1000",  thresholdUSD: 1_000,  label: "earn1000",  nexReward: 500 },
  { id: "earn-5000",  thresholdUSD: 5_000,  label: "earn5000",  nexReward: 1_500 },
  { id: "earn-10000", thresholdUSD: 10_000, label: "earn10000", nexReward: 3_000 },
];

/** Active celebration payload driving the overlay (session-only, not persisted). */
export interface ActiveMilestone {
  id: string;
  threshold: number;
  nexReward: number;
  label: string;
}

// 旧设备级单键 "nexgrid-milestones-v1" 废弃(存量无账号归属,mock 可重建);里程碑 fired 态按账号分行。
// 🔴 spec6-entry-surface-runtime.mjs 的反泄漏护栏键同步改为 nexgrid-milestones-accounts-v1。
const ACCOUNTS_KEY = "nexgrid-milestones-accounts-v1"; // { [accountKey]: { firedIds: string[] } }

function hydrate(accountKey: string): string[] {
  const row = readAccountRow<{ firedIds?: string[] }>(ACCOUNTS_KEY, accountKey);
  if (row && Array.isArray(row.firedIds)) return row.firedIds;
  return [];
}

/**
 * Pure selector — returns the lowest unfired milestone the given life-to-date
 * earnings has crossed, or null. App.vue polls this every 4s and, when it
 * returns a step, composes markFired + creditNex + bills.add + show().
 *
 * `firedIds` is passed in (not read off the store) so this stays a pure
 * function callable from anywhere without coupling.
 */
export function nextUnfired(
  lifeToDate: number,
  firedIds: ReadonlyArray<string>,
): MilestoneStep | null {
  for (const m of EARNINGS_MILESTONES) {
    if (firedIds.includes(m.id)) continue;
    if (lifeToDate >= m.thresholdUSD) return m;
  }
  return null;
}

export const useMilestones = defineStore("milestones", () => {
  // 账号维度:boot 期落 "default",账号确定后由 lib/account-scope 统一重绑。
  let boundKey = "default";
  // ── persisted (cross-session) ──
  const firedIds = ref<string[]>(hydrate(boundKey));

  // ── session-only (drives the celebration overlay) ──
  const active = ref<ActiveMilestone | null>(null);

  function persist() {
    writeAccountRow<{ firedIds: string[] }>(ACCOUNTS_KEY, boundKey, { firedIds: firedIds.value });
  }

  /** 账号切换重绑:装载该账号的里程碑 fired 态;清掉会话庆祝弹窗(别把 A 的庆祝弹给 B)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    firedIds.value = hydrate(boundKey);
    active.value = null;
  }

  function isFired(id: string): boolean {
    return firedIds.value.includes(id);
  }

  function markFired(id: string) {
    if (firedIds.value.includes(id)) return;
    firedIds.value = [...firedIds.value, id];
    persist();
  }

  function reset() {
    firedIds.value = [];
    active.value = null;
    persist();
  }

  /** Open the celebration overlay for a crossed milestone. */
  function show(milestone: ActiveMilestone) {
    active.value = milestone;
  }

  /** Close the celebration overlay (auto-called after the duration, or on tap). */
  function dismiss() {
    active.value = null;
  }

  return {
    firedIds,
    active,
    isFired,
    markFired,
    reset,
    show,
    dismiss,
    bindAccount,
  };
});
