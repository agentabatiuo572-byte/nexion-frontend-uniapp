import { defineStore } from "pinia";
import { ref } from "vue";
import { useTrialConfig, computeDiscountedPrice, computeTrialOffset } from "./trial-config";
import { mockServerNow, ONE_DAY_MS } from "./server-time";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";

/**
 * Free trial — FEAT-TRIAL02 cardless machine (spec signed 2026-07-31).
 *
 * State machine (spec ④):
 *   none →(claim)active →(expiry)grace →(grace end)ended
 *   active|grace →(buy with credit via checkout)converted   (terminal)
 *   active →(explicit user cancel)ended
 *
 * Hard behavior boundaries (spec ④): NEVER auto-charge, NEVER auto-order,
 * NEVER require a payment method to claim; `ended` stops shadow accrual;
 * `converted` is terminal (no rollback). Conversion money/order side effects
 * live in the checkout page (cross-store composition, P-031/032) — this store
 * only moves its own state.
 *
 * Eligibility (spec 异常2): one trial per account — `ended`/`converted` are
 * permanently ineligible ("已用过"/"已购机"); the spec state machine has no
 * ended→claim edge, so there is no cooldown-based re-claim.
 *
 * ⚠️ MOCK-VS-PRODUCTION: every action maps to a REST endpoint (PRD §9.11a).
 *   start()        → POST /api/trial/start          (no body — cardless)
 *   convert()      → server-side within POST /api/orders (same transaction)
 *   cancel()       → POST /api/trial/cancel
 *   eligibility()  → GET  /api/trial/eligibility → { ok, reason? }
 *   poll()         → GET  /api/trial/state (server cron advances the machine)
 */

export type TrialStatus = "none" | "active" | "grace" | "ended" | "converted";

/** Why the trial can't start right now (spec 异常2 — concrete reasons, no generic error). */
export type TrialIneligibleReason = "in-progress" | "converted" | "used" | "phase-closed";

interface FreeTrialState {
  status: TrialStatus;
  startedAt: number | null;
  /** Trial-period end (server-canonical name per spec ③; legacy rows stored `activeEndsAt`). */
  expiresAt: number | null;
  graceEndsAt: number | null;
  finishedAt: number | null;
  shadowFrozenAtUSD: number;
  shadowFrozenAtNEX: number;
  /** Legacy card-era trial migrated onto the cardless rules (spec 异常6) — page shows a notice. */
  legacyCardMigrated: boolean;
}

const INITIAL: FreeTrialState = {
  status: "none",
  startedAt: null,
  expiresAt: null,
  graceEndsAt: null,
  finishedAt: null,
  shadowFrozenAtUSD: 0,
  shadowFrozenAtNEX: 0,
  legacyCardMigrated: false,
};

// 存量键不换(规格 异常6):旧行在 hydrate 时就地迁移到新状态机。
const ACCOUNTS_KEY = "nexgrid-trial-accounts-v1"; // { [accountKey]: FreeTrialState }

/** Legacy (card-era) persisted row shape — superset read for migration.
 *  `status` widens to string because legacy rows carry retired enum values. */
interface LegacyTrialRow extends Omit<Partial<FreeTrialState>, "status"> {
  status?: string;
  cardTokenId?: string | null;
  activeEndsAt?: number | null;
  extendedEndsAt?: number | null;
}

/**
 * Migrate a persisted row (legacy or current) to the FEAT-TRIAL02 shape
 * (spec 异常6): idle→none · extended→grace (graceEndsAt takes the later of the
 * two boundaries) · redeemed→converted · failed|cancelled→ended (finishedAt
 * kept for the "ended at" display). A card-era row still active/grace gets
 * `legacyCardMigrated` so the trial page can show the rules-changed notice.
 */
function migrateRow(row: LegacyTrialRow): FreeTrialState {
  let status: TrialStatus;
  let graceEndsAt = row.graceEndsAt ?? null;
  let legacyCardMigrated = row.legacyCardMigrated ?? false;
  switch (row.status) {
    case "idle":
      status = "none";
      break;
    case "extended": {
      status = "grace";
      const merged = Math.max(graceEndsAt ?? 0, row.extendedEndsAt ?? 0);
      graceEndsAt = merged > 0 ? merged : null;
      break;
    }
    case "redeemed":
      status = "converted";
      break;
    case "failed":
    case "cancelled":
      status = "ended";
      break;
    case "none":
    case "active":
    case "grace":
    case "ended":
    case "converted":
      status = row.status;
      break;
    default:
      return { ...INITIAL };
  }
  if ((status === "active" || status === "grace") && row.cardTokenId) legacyCardMigrated = true;
  return {
    status,
    startedAt: row.startedAt ?? null,
    expiresAt: row.expiresAt ?? row.activeEndsAt ?? null,
    graceEndsAt,
    finishedAt: row.finishedAt ?? null,
    shadowFrozenAtUSD: row.shadowFrozenAtUSD ?? 0,
    shadowFrozenAtNEX: row.shadowFrozenAtNEX ?? 0,
    legacyCardMigrated,
  };
}

function hydrate(accountKey: string): FreeTrialState {
  const row = readAccountRow<LegacyTrialRow>(ACCOUNTS_KEY, accountKey);
  if (row && typeof row.status === "string") return migrateRow(row);
  return { ...INITIAL };
}

export const useFreeTrial = defineStore("freeTrial", () => {
  // 账号维度。boot 期落 "default";账号确定后由 lib/account-scope 统一重绑(P-031 store 不互 import)。
  let boundKey = "default";
  const init = hydrate(boundKey);
  const status = ref<TrialStatus>(init.status);
  const startedAt = ref<number | null>(init.startedAt);
  const expiresAt = ref<number | null>(init.expiresAt);
  const graceEndsAt = ref<number | null>(init.graceEndsAt);
  const finishedAt = ref<number | null>(init.finishedAt);
  const shadowFrozenAtUSD = ref<number>(init.shadowFrozenAtUSD);
  const shadowFrozenAtNEX = ref<number>(init.shadowFrozenAtNEX);
  const legacyCardMigrated = ref<boolean>(init.legacyCardMigrated);

  function persist() {
    writeAccountRow<FreeTrialState>(ACCOUNTS_KEY, boundKey, {
      status: status.value,
      startedAt: startedAt.value,
      expiresAt: expiresAt.value,
      graceEndsAt: graceEndsAt.value,
      finishedAt: finishedAt.value,
      shadowFrozenAtUSD: shadowFrozenAtUSD.value,
      shadowFrozenAtNEX: shadowFrozenAtNEX.value,
      legacyCardMigrated: legacyCardMigrated.value,
    });
  }

  function load(next: FreeTrialState) {
    status.value = next.status;
    startedAt.value = next.startedAt;
    expiresAt.value = next.expiresAt;
    graceEndsAt.value = next.graceEndsAt;
    finishedAt.value = next.finishedAt;
    shadowFrozenAtUSD.value = next.shadowFrozenAtUSD;
    shadowFrozenAtNEX.value = next.shadowFrozenAtNEX;
    legacyCardMigrated.value = next.legacyCardMigrated;
  }

  /** 账号切换重绑:装载该账号的试用状态机(防跨账号继承试用资格/影子收益)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    load(hydrate(boundKey));
  }

  // PRODUCTION: GET /api/trial/eligibility → { ok, reason? }
  function eligibility(): { ok: boolean; reason?: TrialIneligibleReason } {
    if (status.value === "active" || status.value === "grace") return { ok: false, reason: "in-progress" };
    if (status.value === "converted") return { ok: false, reason: "converted" };
    if (status.value === "ended") return { ok: false, reason: "used" };
    if (!useTrialConfig().config.phaseOpen) return { ok: false, reason: "phase-closed" };
    return { ok: true };
  }

  /** Boolean view of eligibility() — kept for the many entry-surface gates. */
  function canStart(): boolean {
    return eligibility().ok;
  }

  // PRODUCTION: POST /api/trial/start (no card token — cardless claim, spec ③).
  // Idempotent: a second call while ineligible is a no-op (spec 异常3 — one
  // trial per account, concurrent taps produce exactly one).
  function start(): { ok: boolean; reason?: TrialIneligibleReason } {
    const elig = eligibility();
    if (!elig.ok) return { ok: false, reason: elig.reason };
    const cfg = useTrialConfig().config;
    const now = mockServerNow();
    const exp = now + cfg.trialDays * ONE_DAY_MS;
    status.value = "active";
    startedAt.value = now;
    expiresAt.value = exp;
    graceEndsAt.value = exp + cfg.graceDays * ONE_DAY_MS;
    finishedAt.value = null;
    shadowFrozenAtUSD.value = 0;
    shadowFrozenAtNEX.value = 0;
    legacyCardMigrated.value = false;
    persist();
    return { ok: true };
  }

  // PRODUCTION: server-side inside POST /api/orders (order + convert atomic).
  // Only active|grace convert (spec ④); terminal, no rollback. Returns false
  // when the machine isn't convertible — the checkout must have bailed earlier.
  function convert(): boolean {
    if (status.value !== "active" && status.value !== "grace") return false;
    status.value = "converted";
    finishedAt.value = mockServerNow();
    persist();
    return true;
  }

  // PRODUCTION: POST /api/trial/cancel. Spec ④: only `active →(用户主动取消)ended`
  // — grace has nothing left to cancel (production already stopped).
  function cancel() {
    if (status.value !== "active") return;
    status.value = "ended";
    finishedAt.value = mockServerNow();
    persist();
  }

  // PRODUCTION: client polls GET /api/trial/state; advancement runs server-side
  // by cron. Spec ④ 禁止动作:grace→ended flips STATE ONLY — zero debit, zero
  // order, zero device writes ever happen here.
  function poll(now: number) {
    const cfg = useTrialConfig().config;
    if (status.value === "active" && expiresAt.value !== null && now >= expiresAt.value) {
      const elapsedDays = Math.min(cfg.trialDays, (now - (startedAt.value ?? now)) / ONE_DAY_MS);
      status.value = "grace";
      shadowFrozenAtUSD.value = +(cfg.shadowDailyUSD * elapsedDays).toFixed(2);
      shadowFrozenAtNEX.value = +(cfg.shadowDailyNEX * elapsedDays).toFixed(0);
      persist();
      return;
    }
    if (status.value === "grace" && graceEndsAt.value !== null && now >= graceEndsAt.value) {
      status.value = "ended";
      finishedAt.value = now;
      persist();
    }
  }

  return {
    status, startedAt, expiresAt, graceEndsAt, finishedAt,
    shadowFrozenAtUSD, shadowFrozenAtNEX, legacyCardMigrated,
    eligibility, canStart, start, convert, cancel, poll, bindAccount,
  };
});

/** Live shadow accrual — accrues during active, frozen during grace, 0 on
 *  none/ended/converted (spec ④: `ended` never accrues further). */
export function liveShadowUSD(now: number): number {
  const s = useFreeTrial();
  const cfg = useTrialConfig().config;
  if (s.status === "active" && s.startedAt !== null) {
    const elapsedMs = Math.min(cfg.trialDays * ONE_DAY_MS, now - s.startedAt);
    return +(cfg.shadowDailyUSD * (elapsedMs / ONE_DAY_MS)).toFixed(2);
  }
  if (s.status === "grace") return s.shadowFrozenAtUSD;
  return 0;
}

export function liveShadowNEX(now: number): number {
  const s = useFreeTrial();
  const cfg = useTrialConfig().config;
  if (s.status === "active" && s.startedAt !== null) {
    const elapsedMs = Math.min(cfg.trialDays * ONE_DAY_MS, now - s.startedAt);
    return +(cfg.shadowDailyNEX * (elapsedMs / ONE_DAY_MS)).toFixed(0);
  }
  if (s.status === "grace") return s.shadowFrozenAtNEX;
  return 0;
}

/** Remaining ms until the next state boundary. */
export function remainingMs(now: number): number {
  const s = useFreeTrial();
  if (s.status === "active" && s.expiresAt !== null) return Math.max(0, s.expiresAt - now);
  if (s.status === "grace" && s.graceEndsAt !== null) return Math.max(0, s.graceEndsAt - now);
  return 0;
}

const SLOT_RESERVING_STATUSES: TrialStatus[] = ["active", "grace"];

/** Non-reactive variant for store actions (e.g. useApp.activateDevice slot cap). */
export function trialReservesSlotNow(): boolean {
  return SLOT_RESERVING_STATUSES.includes(useFreeTrial().status);
}

export { computeDiscountedPrice, computeTrialOffset };
