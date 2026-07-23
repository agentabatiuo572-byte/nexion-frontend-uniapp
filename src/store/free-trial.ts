import { defineStore } from "pinia";
import { ref } from "vue";
import { useTrialConfig, computeDiscountedPrice, computeTrialOffset } from "./trial-config";
import { mockServerNow, ONE_DAY_MS } from "./server-time";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";

/**
 * Free trial — classic SaaS free-trial → auto-billing model.
 * Ported from Nexion-prototype/lib/store/free-trial.ts (zustand persist →
 * Pinia + uni storage).
 *
 * ⚠️ MOCK-VS-PRODUCTION: every action maps to a REST endpoint (PRD §9.11a).
 * Server-side responsibilities mocked here: all time decisions (mockServerNow),
 * all charge attempts (mockChargeAttempt), eligibility (canStart cooldown),
 * shadow accrual freeze (poll active→grace).
 *
 * State machine: idle → active → grace → extended → {redeemed|failed|cancelled}
 */

/** ⚠️ MOCK: client-side RNG. PRODUCTION: POST /api/trial/charge (server decides). */
function mockChargeAttempt(failRate: number): { ok: boolean; reason: ChargeFailReason | null } {
  if (Math.random() < failRate) {
    return { ok: false, reason: "insufficient_funds" };
  }
  return { ok: true, reason: null };
}

export type TrialStatus =
  | "idle"
  | "active"
  | "grace"
  | "extended"
  | "redeemed"
  | "failed"
  | "cancelled";

export type ChargeFailReason = "insufficient_funds" | "card_invalid" | "unknown";

interface FreeTrialState {
  status: TrialStatus;
  cardTokenId: string | null;
  startedAt: number | null;
  activeEndsAt: number | null;
  graceEndsAt: number | null;
  extendedEndsAt: number | null;
  scheduledChargeAt: number | null;
  finishedAt: number | null;
  failReason: ChargeFailReason | null;
  extensionGranted: boolean;
  shadowFrozenAtUSD: number;
  shadowFrozenAtNEX: number;
}

const INITIAL: FreeTrialState = {
  status: "idle",
  cardTokenId: null,
  startedAt: null,
  activeEndsAt: null,
  graceEndsAt: null,
  extendedEndsAt: null,
  scheduledChargeAt: null,
  finishedAt: null,
  failReason: null,
  extensionGranted: false,
  shadowFrozenAtUSD: 0,
  shadowFrozenAtNEX: 0,
};

// 旧设备级单键 "nexgrid-trial-v1" 废弃(存量无账号归属,mock 可重建);试用状态机按账号分行。
const ACCOUNTS_KEY = "nexgrid-trial-accounts-v1"; // { [accountKey]: FreeTrialState }

function hydrate(accountKey: string): FreeTrialState {
  const row = readAccountRow<Partial<FreeTrialState>>(ACCOUNTS_KEY, accountKey);
  if (row && typeof row.status === "string") return { ...INITIAL, ...row };
  return { ...INITIAL };
}

export const useFreeTrial = defineStore("freeTrial", () => {
  // 账号维度。boot 期落 "default";账号确定后由 lib/account-scope 统一重绑(P-031 store 不互 import)。
  let boundKey = "default";
  const init = hydrate(boundKey);
  const status = ref<TrialStatus>(init.status);
  const cardTokenId = ref<string | null>(init.cardTokenId);
  const startedAt = ref<number | null>(init.startedAt);
  const activeEndsAt = ref<number | null>(init.activeEndsAt);
  const graceEndsAt = ref<number | null>(init.graceEndsAt);
  const extendedEndsAt = ref<number | null>(init.extendedEndsAt);
  const scheduledChargeAt = ref<number | null>(init.scheduledChargeAt);
  const finishedAt = ref<number | null>(init.finishedAt);
  const failReason = ref<ChargeFailReason | null>(init.failReason);
  const extensionGranted = ref<boolean>(init.extensionGranted);
  const shadowFrozenAtUSD = ref<number>(init.shadowFrozenAtUSD);
  const shadowFrozenAtNEX = ref<number>(init.shadowFrozenAtNEX);

  function persist() {
    writeAccountRow<FreeTrialState>(ACCOUNTS_KEY, boundKey, {
      status: status.value,
      cardTokenId: cardTokenId.value,
      startedAt: startedAt.value,
      activeEndsAt: activeEndsAt.value,
      graceEndsAt: graceEndsAt.value,
      extendedEndsAt: extendedEndsAt.value,
      scheduledChargeAt: scheduledChargeAt.value,
      finishedAt: finishedAt.value,
      failReason: failReason.value,
      extensionGranted: extensionGranted.value,
      shadowFrozenAtUSD: shadowFrozenAtUSD.value,
      shadowFrozenAtNEX: shadowFrozenAtNEX.value,
    });
  }

  /** 账号切换重绑:装载该账号的试用状态机(防跨账号继承试用资格/冷却/影子收益)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    const next = hydrate(boundKey);
    status.value = next.status;
    cardTokenId.value = next.cardTokenId;
    startedAt.value = next.startedAt;
    activeEndsAt.value = next.activeEndsAt;
    graceEndsAt.value = next.graceEndsAt;
    extendedEndsAt.value = next.extendedEndsAt;
    scheduledChargeAt.value = next.scheduledChargeAt;
    finishedAt.value = next.finishedAt;
    failReason.value = next.failReason;
    extensionGranted.value = next.extensionGranted;
    shadowFrozenAtUSD.value = next.shadowFrozenAtUSD;
    shadowFrozenAtNEX.value = next.shadowFrozenAtNEX;
  }

  // PRODUCTION: GET /api/trial/eligibility → { canStart, reason? }
  function canStart(): boolean {
    const cfg = useTrialConfig().config;
    if (!cfg.phaseOpen) return false;
    if (status.value !== "idle") {
      if (finishedAt.value === null) return false;
      const cooldownEndsAt = finishedAt.value + cfg.cooldownDays * ONE_DAY_MS;
      if (mockServerNow() < cooldownEndsAt) return false;
    }
    return status.value === "idle" || ["redeemed", "failed", "cancelled"].includes(status.value);
  }

  // PRODUCTION: POST /api/trial/start { cardTokenId } → returns full state.
  function startWithCard(tokenId: string) {
    const cfg = useTrialConfig().config;
    if (!canStart()) return;
    const now = mockServerNow();
    const ae = now + cfg.trialDays * ONE_DAY_MS;
    const ge = ae + cfg.graceDays * ONE_DAY_MS;
    status.value = "active";
    cardTokenId.value = tokenId;
    startedAt.value = now;
    activeEndsAt.value = ae;
    graceEndsAt.value = ge;
    extendedEndsAt.value = null;
    scheduledChargeAt.value = ge;
    finishedAt.value = null;
    failReason.value = null;
    extensionGranted.value = false;
    shadowFrozenAtUSD.value = 0;
    shadowFrozenAtNEX.value = 0;
    persist();
  }

  // PRODUCTION: POST /api/trial/redeem-early → server PSP charge + discount.
  function redeemEarly(): { ok: boolean; reason?: ChargeFailReason } {
    const cfg = useTrialConfig().config;
    if (!["active", "grace", "extended"].includes(status.value)) return { ok: false, reason: "unknown" };
    const result = mockChargeAttempt(cfg.chargeFailRate);
    if (!result.ok) {
      status.value = "failed";
      failReason.value = result.reason;
      finishedAt.value = mockServerNow();
      persist();
      return { ok: false, reason: result.reason ?? "unknown" };
    }
    status.value = "redeemed";
    finishedAt.value = mockServerNow();
    scheduledChargeAt.value = null;
    persist();
    return { ok: true };
  }

  // PRODUCTION: POST /api/trial/cancel { reason }
  function cancel(reason: "unbind" | "explicit") {
    if (!["active", "grace", "extended"].includes(status.value)) return;
    status.value = "cancelled";
    finishedAt.value = mockServerNow();
    scheduledChargeAt.value = null;
    void reason;
    persist();
  }

  // PRODUCTION: POST /api/trial/extension { accept: true }
  function acceptExtension(): boolean {
    const cfg = useTrialConfig().config;
    if (status.value !== "grace" || extensionGranted.value) return false;
    if (graceEndsAt.value === null) return false;
    const ee = graceEndsAt.value + cfg.extensionDays * ONE_DAY_MS;
    status.value = "extended";
    extensionGranted.value = true;
    extendedEndsAt.value = ee;
    scheduledChargeAt.value = ee;
    persist();
    return true;
  }

  // PRODUCTION: POST /api/trial/extension { accept: false }
  function declineExtension() {
    extensionGranted.value = true; // mark decided so the sheet doesn't re-fire
    persist();
  }

  // PRODUCTION: client polls GET /api/trial/state (or SSE/WS). State-machine
  // advancement done server-side by a scheduled job; this mock poll runs it
  // client-side so the demo works standalone.
  function poll(now: number) {
    const cfg = useTrialConfig().config;
    if (status.value === "active" && activeEndsAt.value !== null && now >= activeEndsAt.value) {
      const elapsedDays = Math.min(cfg.trialDays, (now - (startedAt.value ?? now)) / ONE_DAY_MS);
      status.value = "grace";
      shadowFrozenAtUSD.value = +(cfg.shadowDailyUSD * elapsedDays).toFixed(2);
      shadowFrozenAtNEX.value = +(cfg.shadowDailyNEX * elapsedDays).toFixed(0);
      persist();
      return;
    }
    if (status.value === "grace" && graceEndsAt.value !== null && now >= graceEndsAt.value) {
      if (cfg.autoChargeAtEnd && !extensionGranted.value && shadowFrozenAtUSD.value >= cfg.highQualityThresholdUSD) {
        return;
      }
      if (cfg.autoChargeAtEnd) {
        const result = mockChargeAttempt(cfg.chargeFailRate);
        if (!result.ok) {
          status.value = "failed";
          failReason.value = result.reason;
        } else {
          status.value = "redeemed";
        }
      } else {
        status.value = "cancelled";
      }
      finishedAt.value = now;
      scheduledChargeAt.value = null;
      persist();
      return;
    }
    if (status.value === "extended" && extendedEndsAt.value !== null && now >= extendedEndsAt.value) {
      if (cfg.autoChargeAtEnd) {
        const result = mockChargeAttempt(cfg.chargeFailRate);
        if (!result.ok) {
          status.value = "failed";
          failReason.value = result.reason;
        } else {
          status.value = "redeemed";
        }
      } else {
        status.value = "cancelled";
      }
      finishedAt.value = now;
      scheduledChargeAt.value = null;
      persist();
    }
  }

  function reset() {
    status.value = INITIAL.status;
    cardTokenId.value = INITIAL.cardTokenId;
    startedAt.value = INITIAL.startedAt;
    activeEndsAt.value = INITIAL.activeEndsAt;
    graceEndsAt.value = INITIAL.graceEndsAt;
    extendedEndsAt.value = INITIAL.extendedEndsAt;
    scheduledChargeAt.value = INITIAL.scheduledChargeAt;
    finishedAt.value = INITIAL.finishedAt;
    failReason.value = INITIAL.failReason;
    extensionGranted.value = INITIAL.extensionGranted;
    shadowFrozenAtUSD.value = INITIAL.shadowFrozenAtUSD;
    shadowFrozenAtNEX.value = INITIAL.shadowFrozenAtNEX;
    persist();
  }

  // Keeps finishedAt so the 30d cooldown clock starts (never bypass via reset).
  function markChargeFailed(reason: ChargeFailReason) {
    status.value = "failed";
    failReason.value = reason;
    finishedAt.value = mockServerNow();
    scheduledChargeAt.value = null;
    persist();
  }

  return {
    status, cardTokenId, startedAt, activeEndsAt, graceEndsAt, extendedEndsAt,
    scheduledChargeAt, finishedAt, failReason, extensionGranted,
    shadowFrozenAtUSD, shadowFrozenAtNEX,
    canStart, startWithCard, redeemEarly, cancel, acceptExtension,
    declineExtension, poll, reset, markChargeFailed, bindAccount,
  };
});

/** Live shadow accrual — display value during active/grace/extended. */
export function liveShadowUSD(now: number): number {
  const s = useFreeTrial();
  const cfg = useTrialConfig().config;
  if (s.status === "active" && s.startedAt !== null) {
    const elapsedMs = Math.min(cfg.trialDays * ONE_DAY_MS, now - s.startedAt);
    return +(cfg.shadowDailyUSD * (elapsedMs / ONE_DAY_MS)).toFixed(2);
  }
  if (["grace", "extended"].includes(s.status)) {
    return s.shadowFrozenAtUSD;
  }
  return 0;
}

export function liveShadowNEX(now: number): number {
  const s = useFreeTrial();
  const cfg = useTrialConfig().config;
  if (s.status === "active" && s.startedAt !== null) {
    const elapsedMs = Math.min(cfg.trialDays * ONE_DAY_MS, now - s.startedAt);
    return +(cfg.shadowDailyNEX * (elapsedMs / ONE_DAY_MS)).toFixed(0);
  }
  if (["grace", "extended"].includes(s.status)) {
    return s.shadowFrozenAtNEX;
  }
  return 0;
}

/** Remaining ms until the next state boundary. */
export function remainingMs(now: number): number {
  const s = useFreeTrial();
  if (s.status === "active" && s.activeEndsAt !== null) return Math.max(0, s.activeEndsAt - now);
  if (s.status === "grace" && s.graceEndsAt !== null) return Math.max(0, s.graceEndsAt - now);
  if (s.status === "extended" && s.extendedEndsAt !== null) return Math.max(0, s.extendedEndsAt - now);
  return 0;
}

/** Whether user is currently eligible for the high-quality extension offer. */
export function isHighQualityEligible(): boolean {
  const s = useFreeTrial();
  const cfg = useTrialConfig().config;
  return s.status === "grace" && !s.extensionGranted && s.shadowFrozenAtUSD >= cfg.highQualityThresholdUSD;
}

const SLOT_RESERVING_STATUSES: TrialStatus[] = ["active", "grace", "extended"];

/** Non-reactive variant for store actions (e.g. useApp.activateDevice slot cap). */
export function trialReservesSlotNow(): boolean {
  return SLOT_RESERVING_STATUSES.includes(useFreeTrial().status);
}

export { computeDiscountedPrice, computeTrialOffset };
