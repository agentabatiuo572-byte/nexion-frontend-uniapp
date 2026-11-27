import { isTransientReadFailure } from "@/lib/remote-read-failure";
import { hasExternalTrialPaymentRecord, TRIAL_CONVERT_COMMANDS_TABLE } from '@/lib/purchase-caller-record';
import { invalidateBeforePassiveTabRead, runForegroundStoreRead, runPassiveTabRead } from "@/lib/passive-tab-read";
import { foregroundReadAllowed } from "@/lib/foreground-read";
import { defineStore } from "pinia";
import { computed, ref, shallowRef, watch } from "vue";
import { useTrialConfig, computeDiscountedPrice, computeTrialOffset, resolveTrialCheckoutProductId, resolveTrialDeviceName, type TrialConfig } from "./trial-config";
import { useTrialPurchaseResult } from "./trial-purchase-result";
import { mockServerNow, ONE_DAY_MS } from "./server-time";
import { normalizeAccountKey } from "./account-cloud";
import { acquireAccountCommandKey, readAccountRow, releaseAccountCommandKey, removeAccountRow, writeAccountRow } from "./account-scoped-storage";
import { remoteApiEnabled, trialApi, apiClient, sessionVault } from "@/api/runtime";
import { isTrialAuthorizationRefusal, parseTrialConvertReceipt, type TrialConvertReceipt } from "@/api/trial-api";
import { readPaymentCommand } from "@/api/payment-command-api";
import type { PaymentPasswordAuthorization } from "@/api/payment-password-api";
import type { TrialAuthorityState, TrialConversionOutcome, TrialConversionQuote, TrialLifecycleKind, TrialLifecycleReceipt, TrialStartPayload } from "@/api/trial-api";
import { asApiError, isAmbiguousEnvelopeOutcome, isApiRefusal } from "@/api/errors";
import {
  resolveTrialAt,
  accruedShadow,
  type TrialBoundaryConfig,
  type TrialRowSnapshot,
  type TrialStatus,
} from "./trial-boundary";

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
 *   convert()      → POST /api/trial/convert       (PRD §9.11a.2 / §9.11e — server
 *                                                   settles offset + creates the order
 *                                                   in one transaction)
 *   cancel()       → POST /api/trial/cancel
 *   eligibility()  → GET  /api/trial/eligibility → { ok, reason? }
 *   poll()         → GET  /api/trial/state (server cron advances the machine)
 *
 * 🔴 时间边界单一不变量(2026-08-03):所有时钟判定收敛到 trial-boundary.ts 的
 * `resolveTrialAt` —— poll/convert/eligibility/影子累计全部调它,本文件不再
 * 出现任何 `now >= 边界` 的手写比对(cancel 是用户显式动作、非时钟判定,除外)。
 */

export type { TrialStatus } from "./trial-boundary";

/** Why the trial can't start right now (spec 异常2 — concrete reasons, no generic error).
 *  "risk" = spec 异常2 第三具名原因(风控命中)。MOCK 无风控引擎,本地 eligibility()
 *  无触发路径;生产由后端 GET /api/trial/eligibility 下发该 reason。 */
export type TrialIneligibleReason = "in-progress" | "converted" | "used" | "phase-closed" | "quota-exhausted" | "risk" | "product-unavailable" | "capacity-full" | "unknown";
export type TrialStartFailure = TrialIneligibleReason | "terms-changed" | "read-failed" | "rejected" | "confirming" | "storage-unavailable";
export type TrialClaimTerms = Pick<TrialConfig, "trialProductId" | "trialTermsVersion" | "trialDays" | "shadowDailyUSD" | "trialOffsetCapUSD">
  & { deviceName: string | null };

function claimTermsChanged(confirmed: TrialClaimTerms, current: TrialConfig, deviceName: string | null): boolean {
  return confirmed.trialProductId !== current.trialProductId || confirmed.deviceName !== deviceName
    || confirmed.trialDays !== current.trialDays || confirmed.shadowDailyUSD !== current.shadowDailyUSD
    || confirmed.trialOffsetCapUSD !== current.trialOffsetCapUSD
    || (confirmed.trialTermsVersion !== undefined && current.trialTermsVersion !== undefined
      && confirmed.trialTermsVersion !== current.trialTermsVersion);
}
/** The service's settled "not now": the same claim cannot succeed by trying again. */
export function isTrialStartDenied(reason: TrialStartFailure | undefined): boolean {
  return reason === "quota-exhausted" || reason === "phase-closed" || reason === "risk" || reason === "product-unavailable";
}
type TrialConversionFailure = TrialIneligibleReason | "insufficient-funds" | "quote-changed" | "rejected"
  | "refusal-readback" | "storage-unavailable" | "payment-required";
const CONVERT_COMMANDS_KEY = TRIAL_CONVERT_COMMANDS_TABLE;
type ConversionCommands = { commands: Record<string, string> };
type LegacyConversion = {
  claimNo: string;
  productNo: string;
  intent: string;
  key: string;
  amount: number | null;
  quoteVersion: string | null;
};
type ConversionResult = { ok: boolean; reason?: TrialConversionFailure; orderNo?: string };
type TrialReadStreak = { consecutiveReads: number; lastCountedAt?: number };
const LIFECYCLE_COMMAND_KEY = "nexgrid-trial-lifecycle-commands-v1";
const TRIAL_TERMS_CHANGED = "TRIAL_TERMS_CHANGED";
type LifecycleCommand = { key: string; state: "pending" | "retry"; successfulClaimNo?: string; retryNotSeen?: true } & (
  ({ kind: "start"; previousClaimNo: string | null } & TrialStartPayload)
  | { kind: "cancel"; previousClaimNo: string });
type PendingLifecycle = TrialReadStreak & {
  command: LifecycleCommand;
  writing?: boolean;
  refusal?: TrialIneligibleReason;
  authenticationRejected?: boolean;
  lastFallbackState?: string;
};
type LifecycleStateRead = { pending: PendingLifecycle; mode: "succeeded" | "fallback" | "legacy" };
type TrialCancelDenial = "not-cancellable" | "payment-in-progress" | "rejected";

function readLifecycleCommand(accountKey: string, strict = false): LifecycleCommand | null {
  const row = readAccountRow<LifecycleCommand>(LIFECYCLE_COMMAND_KEY, accountKey, strict);
  if (!row || typeof row.key !== "string" || !row.key || !["pending", "retry"].includes(row.state)) return null;
  if (row.kind === "start" && typeof row.deviceName === "string" && row.deviceName
      && (row.previousClaimNo === null || typeof row.previousClaimNo === "string")) return row;
  if (row.kind === "cancel" && typeof row.previousClaimNo === "string" && row.previousClaimNo) return row;
  return null;
}

function confirmedByThreeReads(streak: TrialReadStreak, serverNow: number): boolean {
  if (streak.lastCountedAt !== undefined && serverNow - streak.lastCountedAt < 5_000) return false;
  streak.lastCountedAt = serverNow;
  return ++streak.consecutiveReads >= 3;
}

// These structured refusals happen before settlement in the conversion contract.
// Other 4xx/idempotency errors retain the original intent until its result is known.
function conversionRefusal(error: unknown): TrialConversionFailure | null {
  const failure = asApiError(error);
  if (!["business", "http"].includes(failure.kind) || ![409, 422].includes(failure.code ?? 0)) return null;
  if (failure.kind === "http" && failure.status !== failure.code) return null;
  if (failure.message === "TRIAL_WALLET_INSUFFICIENT") return "insufficient-funds";
  if (["TRIAL_AMOUNT_MISMATCH", "TRIAL_AMOUNT_INVALID", "TRIAL_QUOTE_CHANGED", "TRIAL_QUOTE_VERSION_INVALID"]
    .includes(failure.message)) return "quote-changed";
  return ["TRIAL_KILL_SWITCH_DISABLED", "TRIAL_PRODUCT_REQUIRED", "TRIAL_NOT_CONVERTIBLE",
    "TRIAL_PRODUCT_NOT_ELIGIBLE", "TRIAL_PRODUCT_NOT_AVAILABLE", "TRIAL_PRODUCT_NOT_RELEASED",
    "TRIAL_DAILY_YIELD_INVALID", "CAPACITY_REPLACEMENT_REQUIRED", "TRIAL_PRICE_SNAPSHOT_INVALID",
    "TRIAL_WALLET_UNAVAILABLE"].includes(failure.message) ? "rejected" : null;
}

/** Persisted row shape — single source lives in trial-boundary.ts (resolver 同型)。 */
type FreeTrialState = TrialRowSnapshot;

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
 * 同根补齐(2026-08-03):legacy 行进到 grace 却缺 `shadowFrozenAtUSD/NEX`
 * (卡时代无此字段)时,用 resolver 同一个 `accruedShadow` 公式按冻结窗口
 * 就地补齐 —— 迁移与边界推进共用唯一冻结公式,不允许第二套算法。
 */
function migrateRow(row: LegacyTrialRow, cfg: TrialBoundaryConfig): FreeTrialState {
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
  const out: FreeTrialState = {
    status,
    startedAt: row.startedAt ?? null,
    expiresAt: row.expiresAt ?? row.activeEndsAt ?? null,
    graceEndsAt,
    finishedAt: row.finishedAt ?? null,
    shadowFrozenAtUSD: row.shadowFrozenAtUSD ?? 0,
    shadowFrozenAtNEX: row.shadowFrozenAtNEX ?? 0,
    legacyCardMigrated,
  };
  // legacy extended→grace 行缺冻结影子值:按冻结窗口在边界时刻补齐(公式单源
  // accruedShadow;窗口锚点缺失时补 0 —— fail-closed,不发明收益)。
  if (out.status === "grace" && out.shadowFrozenAtUSD === 0 && out.shadowFrozenAtNEX === 0 && out.expiresAt !== null) {
    const frozen = accruedShadow(out, out.expiresAt, cfg);
    out.shadowFrozenAtUSD = frozen.usd;
    out.shadowFrozenAtNEX = frozen.nex;
  }
  return out;
}

function hydrate(accountKey: string, cfg: TrialBoundaryConfig): FreeTrialState {
  const row = readAccountRow<LegacyTrialRow>(ACCOUNTS_KEY, accountKey);
  if (row && typeof row.status === "string") return migrateRow(row, cfg);
  return { ...INITIAL };
}

export const useFreeTrial = defineStore("freeTrial", () => {
  // 账号维度。boot 期落 "default";账号确定后由 lib/account-scope 统一重绑(P-031 store 不互 import)。
  let boundKey = "default";
  const init = remoteApiEnabled ? { ...INITIAL } : hydrate(boundKey, useTrialConfig().config);
  const status = ref<TrialStatus>(init.status);
  const startedAt = ref<number | null>(init.startedAt);
  const expiresAt = ref<number | null>(init.expiresAt);
  const graceEndsAt = ref<number | null>(init.graceEndsAt);
  const finishedAt = ref<number | null>(init.finishedAt);
  const shadowFrozenAtUSD = ref<number>(init.shadowFrozenAtUSD);
  const shadowFrozenAtNEX = ref<number>(init.shadowFrozenAtNEX);
  const legacyCardMigrated = ref<boolean>(init.legacyCardMigrated);
  const authorityStatus = ref<"mock" | "loading" | "ready" | "unknown" | "error">(
    remoteApiEnabled ? "unknown" : "mock",
  );
  const authorityError = ref<string | null>(null);
  // Display only. A transient GET failure still clears the live command authority.
  const displayState = shallowRef<TrialAuthorityState | null>(null);
  const checkoutState = shallowRef<TrialAuthorityState | null>(null);
  // Request sequences: the /state read behind checkoutState, and the moment a start or cancel was found not to have run.
  let checkoutStateSequence = 0;
  let lifecycleRetrySequence = 0;
  const originalPurchase = computed(() => displayState.value?.originalPurchase ?? null);
  const purchasedDevice = computed(() => displayState.value?.status === "converted"
    ? displayState.value.purchasedDevice ?? null : null);
  const pendingLifecycle = shallowRef<PendingLifecycle | null>(null);
  const pendingStart = computed(() => pendingLifecycle.value?.command.kind === "start" ? pendingLifecycle.value : null);
  const pendingCancel = computed(() => pendingLifecycle.value?.command.kind === "cancel" ? pendingLifecycle.value : null);
  const startRetryable = ref(false);
  const startNotSeen = ref(false);
  const confirmedStartDenial = ref<TrialIneligibleReason | "rejected" | "terms-changed">();
  const confirmedStartClaimNo = ref<string | null>(null);
  const confirmedCancelClaimNo = ref<string | null>(null);
  const confirmedCancelDenial = ref<TrialCancelDenial>();
  let lifecycleRead: Promise<void> | null = null;
  let lifecycleReceiptsUnsupported = false;
  const legacyConversions = shallowRef<LegacyConversion[]>([]);
  const legacyClaimNo = ref<string | null>(null);
  const legacyResumableKey = ref<string | null>(null);
  const legacyConversion = computed(() => legacyConversions.value.find(command => command.claimNo === legacyClaimNo.value) ?? null);
  const legacyConversionResumable = computed(() => !!legacyConversion.value && legacyConversion.value.key === legacyResumableKey.value);
  const legacyConversionPending = computed(() => !!legacyConversion.value && !legacyConversionResumable.value);
  const legacyReadbackPending = computed(() => legacyConversions.value.some(command => command.key !== legacyResumableKey.value));
  const confirmedLegacyConversion = shallowRef<{ claimNo: string; key: string; orderNo: string; productNo: string } | null>(null);
  const deniedLegacyConversion = shallowRef<{ claimNo: string; key: string; reason: string } | null>(null);
  let legacyConversionRead: Promise<void> | null = null;
  let legacyConversionWriting: string | null = null;
  let legacyStorageRead = false;
  const authorityResultUnknown = computed(() => !!pendingLifecycle.value);
  const lifecycleReadbackPending = computed(() => !!pendingLifecycle.value && !pendingLifecycle.value.writing);
  const lastReadFailed = ref(false);
  const transientReadFailure = ref(false);
  const authoritativeShadowUSD = ref(0);
  const authoritativeShadowNEX = ref(0);
  const authoritativeOffsetUSD = ref<number | null>(null);
  const authoritativeRemainderUSD = ref<number | null>(null);
  const authorityIncomplete = computed(() => (status.value === "active" || status.value === "grace")
    && (authoritativeOffsetUSD.value === null || authoritativeRemainderUSD.value === null));
  const authoritativePriceUSD = ref<number | null>(null);
  /** FEAT-TRIAL05 server conversion quote; null on older servers or terminal claims. */
  const authoritativeQuote = ref<TrialConversionQuote | null>(null);
  const authoritativeConversion = ref<TrialConversionOutcome | null>(null);
  const remoteCanStart = ref(false);
  // Presentation only: keep the last confirmed promotion mounted during reads.
  // Never use this retained value to authorize a claim; canStart stays fail-closed.
  const confirmedPromoVisible = ref(false);
  const confirmedPromoKnown = ref(false);
  const confirmedHeroVisible = ref(false);
  const confirmedHomeOffer = shallowRef<{
    status: "none" | "ended";
    capacityFull: boolean;
    reason?: TrialIneligibleReason;
    deviceName: string;
    productId: string | null;
    trialDays: number;
    estimatedOffsetUSD: number | null;
  } | null>(null);
  const remoteEligibilityReason = ref<TrialIneligibleReason>("unknown");
  const authorityClaimNo = ref<string | null>(null);
  const authorityServerState = ref<TrialAuthorityState["serverState"] | null>(null);
  // The server projects the current offer for claimable cycles and the pinned
  // claim identity for active and redeemed cycles.
  const authoritativeProductIdentity = computed(() => {
    if (authorityServerState.value === null) return null;
    const { trialProductId, trialProductName } = useTrialConfig().config;
    const productNo = resolveTrialCheckoutProductId(trialProductId);
    return productNo ? { productNo, name: trialProductName } : null;
  });
  const authorityVersion = ref(0);
  const serverClockOffsetMs = ref(0);
  let sampledServerTime = 0;
  type StateRead = { applied: boolean; snapshot: TrialAuthorityState | null };
  let refreshInFlight: Promise<StateRead> | null = null;
  let refreshInFlightAccount: string | null = null;
  let authorityRequestSequence = 0;
  let lastAppliedSequence = 0;
  let accountBindingEpoch = 0;
  // Presentation evidence only. A failed read still clears every live permission below.
  let confirmedLifecycle: Pick<TrialAuthorityState, "claimNo" | "version" | "status"> | null = null;
  let pendingExpiryClaim: string | null = null;
  const announcedExpiryClaims = new Set<string>();

  function getBindingEpoch(): number { return accountBindingEpoch; }
  function serverTimeAt(localNow: number): number { return localNow + serverClockOffsetMs.value; }

  const conversionWindowOpen = ref(false);
  watch([displayState, serverClockOffsetMs], ([state], _, onCleanup) => {
    const deadline = state?.status === "active" || state?.status === "grace"
      ? state.serverState === "EXTENDED" ? state.extendedEndsAt : state.graceEndsAt : null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      const remaining = (deadline ?? 0) - serverTimeAt(Date.now());
      conversionWindowOpen.value = remaining > 0;
      if (remaining > 0) timer = setTimeout(update, Math.min(remaining, 2_147_483_647));
    };
    update();
    onCleanup(() => clearTimeout(timer));
  });

  function takeExpiryNotice(expectedEpoch: number): boolean {
    if (expectedEpoch !== accountBindingEpoch || authorityStatus.value !== "ready"
        || !pendingExpiryClaim || pendingExpiryClaim !== authorityClaimNo.value) return false;
    announcedExpiryClaims.add(pendingExpiryClaim);
    pendingExpiryClaim = null;
    return true;
  }

  /** Current row as a plain snapshot — resolver 的唯一输入形态(生产 = GET /api/trial/state 行)。 */
  function snapshot(): FreeTrialState {
    return {
      status: status.value,
      startedAt: startedAt.value,
      expiresAt: expiresAt.value,
      graceEndsAt: graceEndsAt.value,
      finishedAt: finishedAt.value,
      shadowFrozenAtUSD: shadowFrozenAtUSD.value,
      shadowFrozenAtNEX: shadowFrozenAtNEX.value,
      legacyCardMigrated: legacyCardMigrated.value,
    };
  }

  /** 远端档不落本地盘 = 预期结果;mock 档如实返回写入结果(convert 据此决定终态算不算落定)。 */
  function persist(): boolean {
    if (remoteApiEnabled) return true;
    return writeAccountRow<FreeTrialState>(ACCOUNTS_KEY, boundKey, snapshot());
  }

  /** 边界推进唯一入口:resolve 后有变化才落盘(poll/convert 共用;渲染路径禁调)。 */
  function advanceTo(now: number): FreeTrialState {
    if (remoteApiEnabled) return snapshot();
    const row = snapshot();
    const resolved = resolveTrialAt(row, now, useTrialConfig().config);
    if (resolved !== row) {
      load(resolved);
      persist(); // persist-verdict-ok: 边界推进 = 行 + now 纯推导,没落盘下次从旧行重算得到同一结果
    }
    return resolved;
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

  function clearRemoteFacts(nextStatus: "unknown" | "error" = "unknown", error: string | null = null, retainDisplay = false) {
    if (!retainDisplay) {
      displayState.value = null;
      checkoutState.value = null;
      checkoutStateSequence = 0;
      lifecycleRetrySequence = 0;
    }
    load({ ...INITIAL });
    authoritativeShadowUSD.value = 0;
    authoritativeShadowNEX.value = 0;
    authoritativeOffsetUSD.value = null;
    authoritativeRemainderUSD.value = null;
    authoritativePriceUSD.value = null;
    authoritativeQuote.value = null;
    authoritativeConversion.value = null;
    remoteCanStart.value = false;
    remoteEligibilityReason.value = "unknown";
    authorityClaimNo.value = null;
    authorityServerState.value = null;
    authorityVersion.value = 0;
    authorityStatus.value = nextStatus;
    authorityError.value = error;
  }

  function markAuthorityReadFailure(error: string, transient = false) {
    transientReadFailure.value = transient;
    lastReadFailed.value = true;
    const boundary = status.value === "active" ? expiresAt.value : status.value === "grace" ? graceEndsAt.value : null;
    if (boundary !== null && serverTimeAt(Date.now()) >= boundary) {
      authorityStatus.value = "error";
      authorityError.value = error;
    } else {
      clearRemoteFacts("error", error, transient);
    }
  }

  function applyAuthority(next: TrialAuthorityState, sequence: number, stateRead = false): boolean {
    if (sequence < lastAppliedSequence) return false;
    if (confirmedLifecycle?.claimNo === next.claimNo && next.version === confirmedLifecycle.version
        && next.status === "ended" && (confirmedLifecycle.status === "active" || confirmedLifecycle.status === "grace")) {
      lastAppliedSequence = Math.max(lastAppliedSequence, sequence);
      markAuthorityReadFailure("TRIAL_RESPONSE_STALE");
      return false;
    }
    if (confirmedLifecycle?.claimNo === next.claimNo && next.version < confirmedLifecycle.version) {
      // Retain the newer canonical receipt even while a read is loading.
      lastAppliedSequence = Math.max(lastAppliedSequence, sequence);
      // A failed read cleared live authority. Old data cannot restore its permissions.
      if (authorityClaimNo.value !== next.claimNo || authorityVersion.value !== confirmedLifecycle.version) {
        markAuthorityReadFailure("TRIAL_RESPONSE_STALE");
        return false;
      }
      authorityStatus.value = "ready";
      authorityError.value = null;
      lastReadFailed.value = false;
      transientReadFailure.value = false;
      return true;
    }
    // Validate the whole policy before committing snapshot or promotion presentation.
    const trialConfig = useTrialConfig();
    const productUnavailable = !next.canStart && next.eligibilityReason === "product-unavailable"
      && ["ELIGIBLE", "FAILED", "CANCELLED"].includes(next.serverState);
    trialConfig.applyAuthoritative(next.config, productUnavailable);
    const confirmedExpiry = next.status === "ended" && next.endReason === "expired";
    if (pendingExpiryClaim !== next.claimNo || !confirmedExpiry) pendingExpiryClaim = null;
    if (confirmedExpiry && next.claimNo && confirmedLifecycle?.claimNo === next.claimNo
        && (confirmedLifecycle.status === "active" || confirmedLifecycle.status === "grace")
        && next.version > confirmedLifecycle.version && !announcedExpiryClaims.has(next.claimNo)) {
      pendingExpiryClaim = next.claimNo;
    }
    confirmedLifecycle = { claimNo: next.claimNo, version: next.version, status: next.status };
    lastAppliedSequence = Math.max(lastAppliedSequence, sequence);
    sampledServerTime = next.serverNow;
    serverClockOffsetMs.value = next.serverNow - Date.now();
    load({
      status: next.status,
      startedAt: next.startedAt,
      expiresAt: next.expiresAt,
      graceEndsAt: next.serverState === "EXTENDED" ? next.extendedEndsAt ?? null : next.graceEndsAt,
      finishedAt: next.finishedAt,
      // Remote shadow values are server projections, never locally accrued facts.
      shadowFrozenAtUSD: next.shadowUSD,
      shadowFrozenAtNEX: next.shadowNEX,
      legacyCardMigrated: false,
    });
    authoritativeShadowUSD.value = next.shadowUSD;
    authoritativeShadowNEX.value = next.shadowNEX;
    authoritativeOffsetUSD.value = next.offsetUSD ?? null;
    authoritativeRemainderUSD.value = next.remainderUSD ?? null;
    authoritativePriceUSD.value = next.priceUSD ?? null;
    authoritativeQuote.value = next.quote ?? null;
    authoritativeConversion.value = next.conversion ?? null;
    remoteCanStart.value = next.canStart;
    confirmedPromoVisible.value = next.canStart && next.status === "none";
    confirmedPromoKnown.value = true;
    confirmedHeroVisible.value = next.status === "none"
      && (next.canStart || next.eligibilityReason === "product-unavailable");
    // Keep the confirmed home offer through failed reads and tab remounts.
    const config = trialConfig.config;
    const capacityFull = next.eligibilityReason === "capacity-full";
    confirmedHomeOffer.value = (next.status === "none" && (confirmedHeroVisible.value || capacityFull))
      || (next.status === "ended" && next.canStart) ? {
        status: next.status,
        capacityFull,
        reason: next.eligibilityReason,
        deviceName: config.trialProductName,
        productId: resolveTrialCheckoutProductId(config.trialProductId),
        trialDays: config.trialDays,
        estimatedOffsetUSD: config.shadowDailyUSD === null ? null
          : computeTrialOffset(config, config.shadowDailyUSD * config.trialDays).offsetUSD,
      } : null;
    remoteEligibilityReason.value = next.eligibilityReason ?? "unknown";
    authorityClaimNo.value = next.claimNo;
    authorityServerState.value = next.serverState;
    authorityVersion.value = next.version;
    displayState.value = authorityIncomplete.value ? null : next;
    authorityStatus.value = "ready";
    authorityError.value = null;
    if (stateRead) {
      // Checkout needs the claim and SKU even when amounts are missing.
      checkoutState.value = next;
      checkoutStateSequence = sequence;
      if (legacyClaimNo.value !== next.claimNo) {
        legacyClaimNo.value = next.claimNo;
        legacyResumableKey.value = null;
      }
      if (!legacyStorageRead) {
        legacyStorageRead = true;
        try {
          legacyConversions.value = readLegacyConversions();
        } catch { /* The payment entry point reports unreadable command storage. */ }
      }
    }
    lastReadFailed.value = false;
    transientReadFailure.value = false;
    return true;
  }

  async function readRemoteState(force = false, lifecycle?: LifecycleStateRead): Promise<StateRead> {
    invalidateBeforePassiveTabRead("trial-state");
    if (!remoteApiEnabled) return { applied: true, snapshot: null };
    if (!force && refreshInFlight && refreshInFlightAccount === boundKey) return refreshInFlight;
    const requestedAccount = boundKey;
    const requestedEpoch = accountBindingEpoch;
    const lifecycleKey = pendingLifecycle.value?.command.key;
    const currentLifecycle = () => lifecycleKey && pendingLifecycle.value?.command.key === lifecycleKey
      ? pendingLifecycle.value : null;
    const sequence = ++authorityRequestSequence;
    authorityStatus.value = "loading";
    authorityError.value = null;
    let request!: Promise<StateRead>;
    request = trialApi.state()
      .then((next) => {
        if (requestedEpoch !== accountBindingEpoch) return { applied: false, snapshot: null };
        const applied = applyAuthority(next, sequence, true);
        const pending = currentLifecycle();
        if (pending && applied && displayState.value === next
            && (pending.command.kind === "start" || next.claimNo === pending.command.previousClaimNo
              || lifecycle?.mode === "succeeded")) {
          const answer = JSON.stringify([next.claimNo, next.serverState, next.canStart, next.eligibilityReason]);
          if (answer !== pending.lastFallbackState) resetLifecycleStreak(pending);
          pending.lastFallbackState = answer;
          if (lifecycle?.pending === pending) settleLifecycleState(next, lifecycle);
        }
        return { applied, snapshot: applied && displayState.value === next ? next : null };
      })
      .catch((error: unknown) => {
        if (requestedEpoch !== accountBindingEpoch) return { applied: false, snapshot: null };
        if (sequence >= lastAppliedSequence) {
          lastAppliedSequence = sequence;
          markAuthorityReadFailure(asApiError(error).message, isTransientReadFailure(error));
        }
        return { applied: false, snapshot: null };
      })
      .finally(() => {
        if (refreshInFlight === request) {
          refreshInFlight = null;
          refreshInFlightAccount = null;
        }
      });
    refreshInFlight = request;
    refreshInFlightAccount = requestedAccount;
    return request;
  }

  async function refreshRemote(force = false, lifecycle?: LifecycleStateRead): Promise<boolean> {
    return (await readRemoteState(force, lifecycle)).applied;
  }

  async function refreshCheckoutState(force = false): Promise<TrialAuthorityState | null> {
    return (await readRemoteState(force)).snapshot;
  }

  function canReadVisible(): boolean {
    const session = sessionVault.read();
    return remoteApiEnabled && foregroundReadAllowed() && !!session && boundKey === `user:${session.user.userId}`;
  }

  async function readVisibleAuthority(readState: () => Promise<boolean>, eligibilityFallback?: () => boolean): Promise<boolean> {
    if (!canReadVisible()) return false;
    const epoch = accountBindingEpoch;
    const ready = await readState();
    if (ready || !eligibilityFallback?.() || epoch !== accountBindingEpoch || !canReadVisible()) return ready;
    return runPassiveTabRead("trial-eligibility", () => refreshEligibilityRemote(), undefined, () => authorityStatus.value === "ready");
  }

  function refreshVisible(eligibilityFallback: false | (() => boolean) = false, foregroundInventory = false): Promise<boolean> {
    const read = foregroundInventory ? runForegroundStoreRead : runPassiveTabRead;
    return readVisibleAuthority(
      () => read("trial-state", () => refreshRemote(), undefined, () => authorityStatus.value === "ready"),
      eligibilityFallback || undefined,
    );
  }

  function recoverVisible(eligibilityFallback?: () => boolean): Promise<boolean> {
    return readVisibleAuthority(() => refreshRemote(), eligibilityFallback);
  }

  async function refreshAtBoundary(boundary: number): Promise<boolean> {
    if (sampledServerTime >= boundary && authorityStatus.value === "ready") return true;
    if (refreshInFlight) {
      const epoch = accountBindingEpoch;
      await refreshInFlight;
      if (epoch !== accountBindingEpoch) return false;
      if (sampledServerTime >= boundary && authorityStatus.value === "ready") return true;
    }
    if (!canReadVisible()) return false;
    await refreshRemote();
    return true;
  }

  async function refreshEligibilityRemote(): Promise<boolean> {
    invalidateBeforePassiveTabRead("trial-eligibility");
    if (!remoteApiEnabled) return true;
    const requestedEpoch = accountBindingEpoch;
    const sequence = ++authorityRequestSequence;
    authorityStatus.value = "loading";
    authorityError.value = null;
    try {
      const next = await trialApi.eligibility();
      return requestedEpoch === accountBindingEpoch && applyAuthority(next, sequence);
    } catch (error) {
      if (requestedEpoch === accountBindingEpoch && sequence >= lastAppliedSequence) {
        lastAppliedSequence = sequence;
        markAuthorityReadFailure(asApiError(error).message, isTransientReadFailure(error));
      }
      return false;
    }
  }

  /** 账号切换重绑:装载该账号的试用状态机(防跨账号继承试用资格/影子收益)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    if (remoteApiEnabled) {
      accountBindingEpoch++;
      lastAppliedSequence = ++authorityRequestSequence;
      confirmedPromoVisible.value = false;
      confirmedPromoKnown.value = false;
      confirmedHeroVisible.value = false;
      confirmedHomeOffer.value = null;
      lastReadFailed.value = false;
      transientReadFailure.value = false;
      const savedCommand = readLifecycleCommand(boundKey);
      pendingLifecycle.value = savedCommand?.state === "pending" ? { command: savedCommand, consecutiveReads: 0 } : null;
      startRetryable.value = false;
      startNotSeen.value = savedCommand?.kind === "start" && savedCommand.state === "retry" && savedCommand.retryNotSeen === true;
      confirmedStartDenial.value = undefined;
      confirmedStartClaimNo.value = null;
      confirmedCancelClaimNo.value = null;
      confirmedCancelDenial.value = undefined;
      lifecycleRead = null;
      legacyConversions.value = [];
      legacyClaimNo.value = null;
      legacyResumableKey.value = null;
      legacyStorageRead = false;
      confirmedLegacyConversion.value = null;
      deniedLegacyConversion.value = null;
      legacyConversionRead = null;
      legacyConversionWriting = null;
      confirmedLifecycle = null;
      pendingExpiryClaim = null;
      announcedExpiryClaims.clear();
      sampledServerTime = 0;
      serverClockOffsetMs.value = 0;
      clearRemoteFacts();
      refreshInFlight = null;
      refreshInFlightAccount = null;
      return;
    }
    load(hydrate(boundKey, useTrialConfig().config));
  }

  // PRODUCTION: GET /api/trial/eligibility → { ok, reason? }
  // 判定基于 resolveTrialAt 解析后的状态(只读、不落盘):离线跨过边界的行在
  // 内存状态推进前就按真实时点判 —— 真 ended 的行拿 "used" 而不是 "in-progress"。
  function eligibility(): { ok: boolean; reason?: TrialIneligibleReason } {
    if (remoteApiEnabled) {
      if (authorityStatus.value !== "ready" || pendingCancel.value || (pendingStart.value && !startRetryable.value))
        return { ok: false, reason: "unknown" };
      return remoteCanStart.value
        ? { ok: true }
        : { ok: false, reason: remoteEligibilityReason.value };
    }
    const cfg = useTrialConfig().config;
    const resolved = resolveTrialAt(snapshot(), mockServerNow(), cfg);
    if (resolved.status === "active" || resolved.status === "grace") return { ok: false, reason: "in-progress" };
    if (resolved.status === "converted") return { ok: false, reason: "converted" };
    if (resolved.status === "ended") return { ok: false, reason: "used" };
    if (!cfg.phaseOpen) return { ok: false, reason: "phase-closed" };
    return { ok: true };
  }

  /** Boolean view of eligibility() — kept for the many entry-surface gates. */
  function canStart(): boolean {
    return eligibility().ok;
  }

  // A pending background read can keep an already confirmed claim entry openable.
  // The sheet still uses canStart(), and start() reads eligibility again before posting.
  function canOpenClaim(): boolean {
    return canStart() || (authorityStatus.value === "loading" && remoteCanStart.value
      && !lastReadFailed.value && !authorityResultUnknown.value);
  }

  function latestCheckoutState() {
    return displayState.value ?? (authorityIncomplete.value && checkoutState.value?.claimNo === authorityClaimNo.value
      ? checkoutState.value : null);
  }

  function isOwnTrialDevice(productNo: string): boolean {
    const latest = latestCheckoutState();
    return !!latest?.claimNo && (latest.status === "active" || latest.status === "grace")
      && !!productNo && productNo === resolveTrialCheckoutProductId(latest.config.trialProductId);
  }

  /**
   * Only /state can establish the claim identity used by ordinary checkout. The backend sells the claimed trial
   * device at full price through an ordinary order, so the one product that may be that device waits for authority;
   * every other product is an ordinary purchase (R13), also while a conversion of this claim is still in progress.
   */
  function canConfirmOrdinaryProduct(productNo: string): boolean {
    const snapshot = checkoutState.value, latest = latestCheckoutState();
    if (!snapshot || !latest || !productNo || snapshot.claimNo !== latest.claimNo
        || (lastReadFailed.value && !transientReadFailure.value)) return false;
    const snapshotLive = snapshot.status === "active" || snapshot.status === "grace";
    const latestLive = latest.status === "active" || latest.status === "grace";
    if (snapshotLive !== latestLive) return false;
    const sku = resolveTrialCheckoutProductId(snapshot.config.trialProductId);
    if (snapshotLive) return !!sku && sku === resolveTrialCheckoutProductId(latest.config.trialProductId) && productNo !== sku;
    // No claim in the snapshot. A start that is still being confirmed may already have claimed the trial device.
    let command: LifecycleCommand | null;
    try {
      command = pendingLifecycle.value?.command ?? readLifecycleCommand(boundKey, true);
    } catch {
      return false;
    }
    if (command?.kind !== "start") return true;
    // A start known not to have run stops counting once a later /state read still shows no claim.
    if (command.state === "retry" && !pendingLifecycle.value && checkoutStateSequence > lifecycleRetrySequence) return true;
    const target = resolveTrialCheckoutProductId(useTrialConfig().config.trialProductId);
    return !!sku && !!target && productNo !== sku && productNo !== target;
  }

  function showPromo(): boolean {
    return remoteApiEnabled ? confirmedPromoVisible.value : canStart();
  }

  function showHeroPromo(): boolean {
    return remoteApiEnabled ? confirmedHeroVisible.value
      : status.value === "none" && (canStart() || eligibility().reason === "product-unavailable");
  }

  /**
   * 试用推广槽位的三态(BUG 173)。只有「显示/不显示」两态时,remoteApiEnabled 下
   * 首帧恒等于「不显示」——卡片整块不渲染,等首次读取回来才凭空插入,把下面所有
   * 模块整体推下去。页面必须能区分「还没问过服务器」(pending,渲染固定高度骨架)
   * 与「服务器说没有」(hidden,真正不占位)。
   * 已确认过的可领取快照在后台重拉期间保持 visible,不回退成 pending/hidden。
   */
  const promoSlot = computed<"pending" | "visible" | "hidden">(() => {
    if (confirmedPromoVisible.value) return "visible";
    if (!remoteApiEnabled) return canStart() ? "visible" : "hidden";
    // Initial skeletons must not reappear during reads of a confirmed hidden slot.
    if (confirmedPromoKnown.value) return "hidden";
    return authorityStatus.value === "loading" || authorityStatus.value === "unknown"
      ? "pending" : "hidden";
  });

  /**
   * Offer state for the promotional surfaces, retaining the LAST CONFIRMED
   * answer while a background read is in flight. Both banners key their action
   * label off this so a re-read cannot change the button width/structure
   * (BUG 14 / 56: "正在核实资格" ↔ "马上领取" churn). It never authorizes a
   * claim — canStart() stays fail-closed during every read.
   */
  function confirmedOfferState(): "claimable" | "unavailable" | "checking" | "error" {
    if (authorityStatus.value === "error") return "error";
    if (authorityStatus.value === "ready") return remoteCanStart.value ? "claimable" : "unavailable";
    // loading / unknown: keep the last confirmed state when we have one, so the
    // card neither unmounts nor rewrites its action mid-read. No confirmed
    // snapshot (first read, or a rebind) → an honest checking placeholder.
    if (confirmedPromoVisible.value || confirmedHeroVisible.value) {
      return remoteEligibilityReason.value === "product-unavailable" ? "unavailable" : "claimable";
    }
    return "checking";
  }

  function beginLifecycle(draft: LifecycleCommand): PendingLifecycle | null {
    const saved = readLifecycleCommand(boundKey, true);
    const retrying = startRetryable.value && pendingStart.value?.command.key === saved?.key;
    if (saved?.state === "pending" && !retrying) {
      pendingLifecycle.value = { command: saved, consecutiveReads: 0 };
      return null;
    }
    // Reuse the whole request. Start's device name, product and version are part of the idempotency hash.
    const command = saved?.kind === draft.kind && saved.previousClaimNo === draft.previousClaimNo
      ? { ...saved, state: "pending" as const, retryNotSeen: undefined } : draft;
    if (!writeAccountRow(LIFECYCLE_COMMAND_KEY, boundKey, command)) throw new Error("ACCOUNT_COMMAND_STORAGE_UNAVAILABLE");
    const pending = { command, writing: true, consecutiveReads: 0 };
    startRetryable.value = false;
    if (draft.kind === "start") startNotSeen.value = false;
    pendingLifecycle.value = pending;
    return pending;
  }

  function finishLifecycle(pending: PendingLifecycle, retry: boolean | "not-seen" = false) {
    if (readLifecycleCommand(boundKey)?.key === pending.command.key) {
      if (retry) {
        const retryNotSeen = pending.command.kind === "start" && retry === "not-seen";
        const saved = writeAccountRow(LIFECYCLE_COMMAND_KEY, boundKey, {
          ...pending.command, state: "retry", retryNotSeen: retryNotSeen ? true : undefined,
        });
        if (retryNotSeen && saved) startNotSeen.value = true;
        lifecycleRetrySequence = authorityRequestSequence;
      }
      else removeAccountRow(LIFECYCLE_COMMAND_KEY, boundKey);
    }
    pendingLifecycle.value = null;
    startRetryable.value = false;
  }

  function rememberLifecycleSuccess(pending: PendingLifecycle, claimNo: string) {
    pending.command = { ...pending.command, successfulClaimNo: claimNo };
    writeAccountRow(LIFECYCLE_COMMAND_KEY, boundKey, pending.command);
  }

  async function rejectLifecycleStart(reason: TrialIneligibleReason | "terms-changed") {
    // In-flight eligibility started before the refusal cannot restore the old permission.
    lastAppliedSequence = ++authorityRequestSequence;
    remoteCanStart.value = false;
    remoteEligibilityReason.value = reason === "terms-changed" ? "unknown" : reason;
    confirmedPromoVisible.value = false;
    confirmedHeroVisible.value = false;
    confirmedStartDenial.value = reason === "unknown" ? "rejected" : reason;
    await refreshEligibilityRemote();
  }

  function resetLifecycleStreak(pending: PendingLifecycle) {
    pending.consecutiveReads = 0;
    pending.lastCountedAt = undefined;
    pending.lastFallbackState = undefined;
  }

  function settleLifecycleState(next: TrialAuthorityState, { pending, mode }: LifecycleStateRead) {
    const { kind, previousClaimNo, successfulClaimNo } = pending.command;
    const active = next.status === "active" || next.status === "grace";
    const cancelled = next.serverState === "CANCELLED" && next.endReason === "cancelled";
    if (mode === "succeeded") {
      if (kind === "cancel" && successfulClaimNo && successfulClaimNo !== previousClaimNo) {
        finishLifecycle(pending);
        if (cancelled && next.claimNo === previousClaimNo) confirmedCancelClaimNo.value = previousClaimNo;
        return;
      }
      if (!successfulClaimNo || !next.claimNo
          || (kind === "start" && next.claimNo === previousClaimNo && next.claimNo !== successfulClaimNo)
          || (kind === "cancel" && next.claimNo === successfulClaimNo && !cancelled && active)) return;
      finishLifecycle(pending);
      if (kind === "start") confirmedStartClaimNo.value = successfulClaimNo;
      else confirmedCancelClaimNo.value = successfulClaimNo;
      return;
    }
    // B93 outages and indeterminate records use three matching state reads. The
    // unsupported endpoint keeps the original clients' state-only behavior.
    if (mode === "fallback" && !confirmedByThreeReads(pending, next.serverNow)) return;
    if (kind === "cancel") {
      if (next.claimNo !== previousClaimNo) {
        resetLifecycleStreak(pending);
        return;
      }
      if (mode === "legacy" && active && !pending.authenticationRejected && !confirmedByThreeReads(pending, next.serverNow)) return;
      finishLifecycle(pending, active);
      if (cancelled) confirmedCancelClaimNo.value = previousClaimNo;
      return;
    }
    if (active && next.claimNo && next.claimNo !== previousClaimNo) {
      finishLifecycle(pending);
      confirmedStartClaimNo.value = next.claimNo;
      return;
    }
    const sameClaim = next.claimNo === previousClaimNo;
    const retryable = !active && sameClaim && !pending.refusal && next.canStart;
    if (mode === "legacy" && retryable && !confirmedByThreeReads(pending, next.serverNow)) return;
    startRetryable.value = retryable;
    const reason = pending.refusal ?? next.eligibilityReason;
    if (active || !sameClaim || !reason || reason === "unknown" || startRetryable.value) {
      resetLifecycleStreak(pending);
      return;
    }
    if (mode === "legacy" && !pending.refusal && !confirmedByThreeReads(pending, next.serverNow)) return;
    finishLifecycle(pending);
    confirmedStartDenial.value = reason;
  }

  function recoverLifecycleCommand(): Promise<void> {
    if (lifecycleRead) return lifecycleRead;
    const pending = pendingLifecycle.value;
    if (!pending || pending.writing || !canReadVisible()) return Promise.resolve();
    const epoch = accountBindingEpoch;
    const current = () => epoch === accountBindingEpoch && pending === pendingLifecycle.value;
    const request = Promise.resolve().then(async () => {
      if (!current()) return;
      const { kind, key, successfulClaimNo } = pending.command;
      if (successfulClaimNo) {
        await refreshRemote(true, { pending, mode: "succeeded" });
        return;
      }
      const receipt: TrialLifecycleReceipt | null = lifecycleReceiptsUnsupported ? { status: "unsupported" }
        : await trialApi.command(kind, key).catch(() => null);
      if (!current()) return;
      switch (receipt?.status) {
        case "SUCCEEDED":
          rememberLifecycleSuccess(pending, receipt.claimNo);
          await refreshRemote(true, { pending, mode: "succeeded" });
          return;
        case "REJECTED":
          finishLifecycle(pending);
          if (kind === "start") {
            await rejectLifecycleStart(receipt.code === 409 && receipt.message === TRIAL_TERMS_CHANGED
              ? "terms-changed" : commandFailureReason(receipt.message));
          } else {
            confirmedCancelDenial.value = cancelDenial(receipt.message);
            await refreshRemote(true);
          }
          return;
        case "NOT_SEEN":
          finishLifecycle(pending, "not-seen");
          await refreshRemote(true);
          return;
        case "PROCESSING":
          resetLifecycleStreak(pending);
          startRetryable.value = false;
          return;
        case "unsupported":
          lifecycleReceiptsUnsupported = true;
          await refreshRemote(true, { pending, mode: "legacy" });
          return;
        default:
          await refreshRemote(true, { pending, mode: "fallback" });
      }
    }).finally(() => { if (lifecycleRead === request) lifecycleRead = null; });
    lifecycleRead = request;
    return request;
  }

  // PRODUCTION: POST /api/trial/start (no card token — cardless claim, spec ③).
  // Idempotent: a second call while ineligible is a no-op (spec 异常3 — one
  // trial per account, concurrent taps produce exactly one).
  async function start(confirmedTerms?: TrialClaimTerms): Promise<{ ok: boolean; reason?: TrialStartFailure }> {
    if (remoteApiEnabled) {
      if (pendingCancel.value || (pendingStart.value && !startRetryable.value)) return { ok: false, reason: "confirming" };
      const retry = pendingStart.value;
      const requestedEpoch = accountBindingEpoch;
      // Each submit reports its own refusal, also the same one twice.
      confirmedStartDenial.value = undefined;
      const answered = await refreshEligibilityRemote();
      if (requestedEpoch !== accountBindingEpoch) return { ok: false, reason: "read-failed" };
      // A newer state read may have answered first; its answer decides this claim.
      if (!answered && authorityStatus.value !== "ready") return { ok: false, reason: "read-failed" };
      if (confirmedStartClaimNo.value && (status.value === "active" || status.value === "grace")) return { ok: true };
      if (pendingCancel.value || (pendingStart.value && !startRetryable.value)
          || (retry && retry !== pendingStart.value)) return { ok: false, reason: "confirming" };
      const remoteEligibility = eligibility();
      if (!remoteEligibility.ok) {
        if (pendingStart.value) {
          startRetryable.value = false;
          return { ok: false, reason: "confirming" };
        }
        if (remoteEligibility.reason !== "unknown") confirmedStartDenial.value = remoteEligibility.reason;
        return { ok: false, reason: remoteEligibility.reason };
      }
      const trialConfig = useTrialConfig().config;
      const deviceName = resolveTrialDeviceName(trialConfig.trialProductId, trialConfig.trialProductName);
      if (!deviceName) {
        markAuthorityReadFailure("TRIAL_CONFIG_RESPONSE_INVALID");
        return { ok: false, reason: "read-failed" };
      }
      const confirmedPayload: TrialStartPayload = {
        deviceName,
        ...(confirmedTerms?.trialTermsVersion && confirmedTerms.trialProductId ? {
          trialProductId: confirmedTerms.trialProductId, trialTermsVersion: confirmedTerms.trialTermsVersion,
        } : {}),
      };
      let pending: PendingLifecycle | null;
      try {
        if (confirmedTerms) {
          const changed = claimTermsChanged(confirmedTerms, trialConfig, deviceName);
          const saved = readLifecycleCommand(boundKey, true);
          // A saved retry was refused before execution or explicitly NOT_SEEN.
          // A still-pending start may only be retried with its original key and payload.
          if (saved?.kind === "start" && saved.state === "retry"
              && (changed || saved.deviceName !== confirmedPayload.deviceName
                || saved.trialProductId !== confirmedPayload.trialProductId
                || saved.trialTermsVersion !== confirmedPayload.trialTermsVersion)) {
            if (!removeAccountRow(LIFECYCLE_COMMAND_KEY, boundKey)) return { ok: false, reason: "storage-unavailable" };
            startNotSeen.value = false;
          }
          if (changed) {
            confirmedStartDenial.value = "terms-changed";
            return { ok: false, reason: "terms-changed" };
          }
        }
        pending = beginLifecycle({ kind: "start", key: commandKey("start"), state: "pending",
          previousClaimNo: authorityClaimNo.value, ...confirmedPayload,
        });
      } catch { return { ok: false, reason: "storage-unavailable" }; }
      if (!pending || pending.command.kind !== "start") return { ok: false, reason: "confirming" };
      confirmedStartClaimNo.value = null;
      const { key, deviceName: sentDeviceName, trialProductId, trialTermsVersion } = pending.command;
      const authRevision = sessionVault.revision();
      try {
        const receipt = await trialApi.start(key, {
          deviceName: sentDeviceName,
          ...(trialProductId === undefined ? {} : { trialProductId }),
          ...(trialTermsVersion === undefined ? {} : { trialTermsVersion }),
        });
        if (requestedEpoch !== accountBindingEpoch) return { ok: false, reason: "read-failed" };
        if (receipt.claimNo) rememberLifecycleSuccess(pending, receipt.claimNo);
      } catch (error) {
        if (requestedEpoch !== accountBindingEpoch) return { ok: false, reason: "read-failed" };
        const failure = asApiError(error);
        const reason = commandFailureReason(failure.message);
        const termsChanged = isApiRefusal(error, 409, TRIAL_TERMS_CHANGED);
        if (failure.kind === "http" && failure.status === 409 && failure.code === 409 && reason !== "unknown") {
          pending.refusal = reason;
        } else if (failure.kind === "auth") {
          await apiClient.refreshSession(authRevision).catch(() => {});
          if (requestedEpoch !== accountBindingEpoch) return { ok: false, reason: "read-failed" };
        } else if (termsChanged || !isAmbiguousEnvelopeOutcome(error)) {
          finishLifecycle(pending);
          await rejectLifecycleStart(termsChanged ? "terms-changed" : reason);
          if (requestedEpoch !== accountBindingEpoch) return { ok: false, reason: "read-failed" };
          return { ok: false, reason: confirmedStartDenial.value };
        }
      }
      pendingLifecycle.value = { ...pending, writing: false };
      await recoverLifecycleCommand();
      if (requestedEpoch !== accountBindingEpoch) return { ok: false, reason: "read-failed" };
      if (confirmedStartDenial.value) return { ok: false, reason: confirmedStartDenial.value };
      return confirmedStartClaimNo.value ? { ok: true } : { ok: false, reason: "confirming" };
    }
    const elig = eligibility();
    if (!elig.ok) return { ok: false, reason: elig.reason };
    const cfg = useTrialConfig().config;
    if (confirmedTerms && claimTermsChanged(confirmedTerms, cfg, resolveTrialDeviceName(cfg.trialProductId, cfg.trialProductName))) {
      return { ok: false, reason: "terms-changed" };
    }
    const now = mockServerNow();
    const exp = now + cfg.trialDays * ONE_DAY_MS;
    // 🔴 快照取在**任何**字段改动之前(审计 R7 P0:曾取在 status 置 active 之后,落盘失败回滚成
    // 「active + 全空边界」的坏行,解析器 fail-closed 判 ended 并被 poll 落盘 —— 一次性试用资格被永久烧掉)。
    const beforeStart = snapshot();
    status.value = "active";
    startedAt.value = now;
    expiresAt.value = exp;
    graceEndsAt.value = exp + cfg.graceDays * ONE_DAY_MS;
    finishedAt.value = null;
    shadowFrozenAtUSD.value = 0;
    shadowFrozenAtNEX.value = 0;
    legacyCardMigrated.value = false;
    if (!persist()) {
      load(beforeStart); // 没落盘 = 没开始:别让页面宣布「试用已开始」而刷新后什么都没有
      return { ok: false, reason: "unknown" };
    }
    return { ok: true };
  }

  // PRODUCTION: POST /api/trial/convert (PRD §9.11a.2 / §9.11e — order + convert atomic).
  // Only active|grace convert (spec ④); terminal, no rollback. Returns false
  // when the machine isn't convertible — the checkout must have bailed earlier.
  // 🔴 P0 防线:convert 内部自己取 mockServerNow() 并先 resolveTrialAt 推进边界,
  // 绝不信任调用方(结算页)缓存的 now 或内存里的旧 status —— 用户离线跨过宽限期
  // 后趁 poll 未跑下单,这里按真实时点判到 ended 即拒绝(边界推进结果已落盘)。
  async function convert(productNo?: string, expectedAmountUsdt?: number, quoteVersion?: string | null,
    authorization?: PaymentPasswordAuthorization, onSubmit?: (submission: Pick<LegacyConversion, "claimNo" | "key">) => void): Promise<ConversionResult> {
    const requestedProductNo = productNo ?? useTrialConfig().config.trialProductId;
    if (remoteApiEnabled) {
      const requestedEpoch = accountBindingEpoch;
      if (authorityStatus.value !== "ready") await refreshRemote();
      if (requestedEpoch !== accountBindingEpoch || authorityStatus.value !== "ready" || !authorityClaimNo.value
          || authorityResultUnknown.value) return { ok: false, reason: "unknown" };
      const claimNo = authorityClaimNo.value;
      let pending: LegacyConversion | null;
      try {
        pending = legacyConversion.value ?? readLegacyConversions().find(command =>
          command.claimNo === claimNo && command.productNo === requestedProductNo) ?? null;
      } catch {
        return { ok: false, reason: "storage-unavailable" };
      }
      if (pending) {
        if (pending.claimNo !== claimNo || pending.productNo !== requestedProductNo) return { ok: false, reason: "unknown" };
        if (!legacyConversion.value) legacyConversions.value = [...legacyConversions.value, pending];
        if (!legacyConversionResumable.value) {
          onSubmit?.(pending);
          await recoverLegacyConversion().catch(() => {});
          if (requestedEpoch !== accountBindingEpoch) return { ok: false, reason: "unknown" };
          const settled = confirmedLegacyConversion.value;
          if (settled?.claimNo === claimNo && settled.key === pending.key) return { ok: true, orderNo: settled.orderNo };
          if (!legacyConversion.value) return { ok: false, reason: "refusal-readback" };
          if (!legacyConversionResumable.value) return { ok: false, reason: "unknown" };
        }
        if (pending.amount !== expectedAmountUsdt || pending.quoteVersion !== (quoteVersion ?? null))
          return { ok: false, reason: "quote-changed" };
      }
      if (!authorization) return { ok: false, reason: "payment-required" };
      if (expectedAmountUsdt === undefined) return { ok: false, reason: "unknown" };
      const account = boundKey;
      const resuming = pending !== null;
      if (!pending) {
        const version = quoteVersion ?? null;
        const intent = JSON.stringify(version ? [claimNo, requestedProductNo, expectedAmountUsdt, version]
          : [claimNo, requestedProductNo, expectedAmountUsdt]);
        try {
          const key = acquireAccountCommandKey(CONVERT_COMMANDS_KEY, account, intent, "h2-convert");
          pending = { claimNo, productNo: requestedProductNo, intent, key, amount: expectedAmountUsdt, quoteVersion: version };
        } catch {
          return { ok: false, reason: "storage-unavailable" };
        }
      }
      // Keep the key from dispatch onward. The recovery owner can only read it.
      const submission = pending;
      if (submission.amount === null) return { ok: false, reason: "unknown" };
      legacyResumableKey.value = null;
      if (!resuming) legacyConversions.value = [...legacyConversions.value, submission];
      legacyConversionWriting = submission.key;
      try {
        onSubmit?.(submission);
        const receipt = await trialApi.convert(submission.productNo, submission.amount, submission.quoteVersion, submission.key, authorization);
        if (requestedEpoch !== accountBindingEpoch) return { ok: false, reason: "unknown" };
        if (await confirmLegacyConversion(submission, receipt, requestedEpoch, true)) return { ok: true, orderNo: receipt.orderNo };
      } catch (error) {
        if (requestedEpoch !== accountBindingEpoch) return { ok: false, reason: "unknown" };
        if (isTrialAuthorizationRefusal(asApiError(error).message)) {
          if (resuming) legacyResumableKey.value = submission.key;
          else releaseLegacyConversion(submission);
          throw error;
        }
        const refusal = conversionRefusal(error);
        if (refusal && !resuming) {
          if (refusal === "quote-changed") void refreshRemote(true);
          return { ok: false, reason: releaseLegacyConversion(submission) ? refusal : "storage-unavailable" };
        }
      } finally {
        if (requestedEpoch === accountBindingEpoch && legacyConversionWriting === submission.key) legacyConversionWriting = null;
      }
      return { ok: false, reason: "unknown" };
    }
    const now = mockServerNow();
    const resolved = advanceTo(now);
    if (resolved.status !== "active" && resolved.status !== "grace") return { ok: false, reason: "used" };
    const prevStatus = status.value;
    const prevFinishedAt = finishedAt.value;
    status.value = "converted";
    finishedAt.value = now;
    // 终态必须落盘才算裁决成立:写不进去就退回内存,报 ok:false —— 否则调用方按「已转化」发放试用减免与
    // 入账,刷新后试用行仍是 active,同一份福利可再吃一次(审计 R5 P1)。
    if (!persist()) {
      status.value = prevStatus;
      finishedAt.value = prevFinishedAt;
      return { ok: false, reason: "unknown" };
    }
    return { ok: true };
  }

  function readLegacyConversions(): LegacyConversion[] {
    const commands = readAccountRow<ConversionCommands>(CONVERT_COMMANDS_KEY, boundKey, true)?.commands ?? {};
    const byClaim = new Map<string, LegacyConversion>();
    for (const [intent, key] of Object.entries(commands)) {
      if (hasExternalTrialPaymentRecord(boundKey, key)) continue;
      const original: unknown = JSON.parse(intent);
      if (typeof key !== "string" || !key.trim()
          || !Array.isArray(original) || (original.length !== 3 && original.length !== 4)
          || typeof original[0] !== "string" || !original[0] || byClaim.has(original[0])
          || typeof original[1] !== "string" || !original[1]
          || (original[2] !== null && (typeof original[2] !== "number" || !Number.isFinite(original[2]) || original[2] < 0))
          || (original.length === 4 && (typeof original[3] !== "string" || !original[3]))) {
        throw new Error("TRIAL_CONVERSION_INTENT_INVALID");
      }
      const [claimNo, productNo, amount, quoteVersion] = original;
      byClaim.set(claimNo, { claimNo, productNo, intent, key, amount, quoteVersion: quoteVersion ?? null });
    }
    return [...byClaim.values()];
  }

  /** Used by legacy checkout to authorize exactly the original amount and version. */
  function pendingConversion(productNo: string) {
    const submission = legacyConversion.value;
    return submission?.productNo === productNo
      ? { key: submission.key, amount: submission.amount, quoteVersion: submission.quoteVersion } : null;
  }

  function releaseLegacyConversion(submission: LegacyConversion): boolean {
    if (!releaseAccountCommandKey(CONVERT_COMMANDS_KEY, boundKey, submission.intent, submission.key)) return false;
    legacyConversions.value = legacyConversions.value.filter(command => command !== submission);
    if (legacyResumableKey.value === submission.key) legacyResumableKey.value = null;
    return true;
  }

  async function confirmLegacyConversion(submission: LegacyConversion, receipt: TrialConvertReceipt, epoch: number, force = false) {
    if (receipt.productNo !== submission.productNo || (receipt.claimNo && receipt.claimNo !== submission.claimNo)) return false;
    if (legacyClaimNo.value === submission.claimNo) {
      if (!await refreshRemote(force) || epoch !== accountBindingEpoch) return false;
      if (legacyClaimNo.value === submission.claimNo) {
        const stateOrderNo = authoritativeConversion.value?.orderNo;
        if (status.value !== "converted" || (stateOrderNo && stateOrderNo !== receipt.orderNo)) return false;
      }
    }
    confirmedLegacyConversion.value = { claimNo: submission.claimNo, key: submission.key, productNo: submission.productNo, orderNo: receipt.orderNo };
    useTrialPurchaseResult().publish({ status: "settled", claimNo: submission.claimNo, key: submission.key, orderNo: receipt.orderNo });
    releaseLegacyConversion(submission);
    return true;
  }

  function recoverLegacyConversion(): Promise<void> {
    if (legacyConversionRead) return legacyConversionRead;
    const epoch = accountBindingEpoch;
    const pending = legacyConversions.value.filter(command =>
      command.key !== legacyConversionWriting && command.key !== legacyResumableKey.value);
    if (!pending.length) return Promise.resolve();
    const read = (async () => {
      for (const submission of pending) {
        if (epoch !== accountBindingEpoch) return;
        await readLegacyResult(submission, epoch).catch(() => {});
      }
    })().finally(() => { if (legacyConversionRead === read) legacyConversionRead = null; });
    legacyConversionRead = read;
    return read;
  }

  async function readLegacyResult(submission: LegacyConversion, epoch: number) {
    const command = await readPaymentCommand(apiClient, "trial-convert", submission.key);
    if (epoch !== accountBindingEpoch || !legacyConversions.value.includes(submission)
        || (command.paymentMethod && command.paymentMethod !== "WALLET")) return;
    if (command.status === "NOT_SEEN") {
      // The server projects the current claim on NOT_SEEN, rather than the key's original claim.
      const currentClaim = command.claimNo || (authorityStatus.value === "ready" ? checkoutState.value?.claimNo : null);
      if (currentClaim && currentClaim !== submission.claimNo) {
        releaseLegacyConversion(submission);
        return;
      }
    } else if ((command.claimNo && command.claimNo !== submission.claimNo)
        || (command.productNo && command.productNo !== submission.productNo)) return;
    if (command.status === "SUCCEEDED") {
      await confirmLegacyConversion(submission, parseTrialConvertReceipt(command.receipt), epoch);
    } else if (command.status === "REJECTED") {
      if (releaseLegacyConversion(submission)) {
        const denial = { claimNo: submission.claimNo, key: submission.key, reason: command.message ?? "" };
        deniedLegacyConversion.value = denial;
        useTrialPurchaseResult().publish({ status: "refused", ...denial });
      }
    } else if (legacyConversion.value === submission && command.canResumeSameKey && submission.amount !== null
        && (command.status === "NOT_SEEN" || command.status === "PROCESSING")) {
      if (!await refreshRemote() || epoch !== accountBindingEpoch || legacyConversion.value !== submission
          || (status.value !== "active" && status.value !== "grace")) return;
      const original = originalPurchase.value;
      const canResume = command.status === "NOT_SEEN" ? !original : !!submission.quoteVersion
        && original?.kind === "BALANCE" && original.claimNo === submission.claimNo && original.submissionNo === submission.key
        && original.device.productNo === submission.productNo
        && (original.confirmedAmountUSD === null || original.confirmedAmountUSD === submission.amount)
        && (original.quoteVersion === null || original.quoteVersion === submission.quoteVersion);
      if (canResume) legacyResumableKey.value = submission.key;
    }
  }

  function clearLegacyConversionResult(orderNo: string) {
    if (confirmedLegacyConversion.value?.orderNo === orderNo) confirmedLegacyConversion.value = null;
  }

  // PRODUCTION: POST /api/trial/cancel. Spec ④: only `active →(用户主动取消)ended`
  // — grace has nothing left to cancel (production already stopped).
  async function cancel(): Promise<{ ok: boolean; reason?: TrialIneligibleReason | "payment-in-progress" | "confirming" | "not-executed" | "storage-unavailable" }> {
    if (remoteApiEnabled) {
      if (authorityResultUnknown.value) return { ok: false, reason: "confirming" };
      const requestedEpoch = accountBindingEpoch;
      if (authorityStatus.value !== "ready") await refreshRemote();
      if (requestedEpoch !== accountBindingEpoch) return { ok: false, reason: "unknown" };
      if (authorityResultUnknown.value) return { ok: false, reason: "confirming" };
      if (authorityStatus.value !== "ready" || !authorityClaimNo.value || status.value !== "active") {
        return { ok: false, reason: "unknown" };
      }
      const claimNo = authorityClaimNo.value;
      const sequence = ++authorityRequestSequence;
      let pending: PendingLifecycle | null;
      try {
        pending = beginLifecycle({ kind: "cancel", key: commandKey("cancel"), previousClaimNo: claimNo, state: "pending" });
      } catch { return { ok: false, reason: "storage-unavailable" }; }
      if (!pending) return { ok: false, reason: "confirming" };
      confirmedCancelClaimNo.value = null;
      confirmedCancelDenial.value = undefined;
      const authRevision = sessionVault.revision();
      try {
        const receipt = await trialApi.cancel("explicit", pending.command.key);
        if (requestedEpoch !== accountBindingEpoch) return { ok: false, reason: "unknown" };
        if (receipt.status === "payment-in-progress") {
          finishLifecycle(pending);
          const state = displayState.value;
          if (state?.claimNo === claimNo && receipt.originalPurchase?.claimNo === claimNo
              && lastAppliedSequence <= sequence) {
            displayState.value = { ...state, originalPurchase: receipt.originalPurchase };
          }
          await refreshRemote(true);
          return requestedEpoch === accountBindingEpoch ? { ok: false, reason: "payment-in-progress" } : { ok: false, reason: "unknown" };
        }
        if (receipt.state.claimNo) rememberLifecycleSuccess(pending, receipt.state.claimNo);
      } catch (error) {
        if (requestedEpoch !== accountBindingEpoch) return { ok: false, reason: "unknown" };
        const failure = asApiError(error);
        pending.authenticationRejected = failure.kind === "auth";
        if (pending.authenticationRejected) {
          await apiClient.refreshSession(authRevision).catch(() => {});
          if (requestedEpoch !== accountBindingEpoch) return { ok: false, reason: "unknown" };
        } else if (!isAmbiguousEnvelopeOutcome(error)) {
          finishLifecycle(pending);
          return { ok: false, reason: commandFailureReason(failure.message) };
        }
      }
      pendingLifecycle.value = { ...pending, writing: false };
      await recoverLifecycleCommand();
      if (requestedEpoch !== accountBindingEpoch) return { ok: false, reason: "unknown" };
      if (pendingCancel.value) return { ok: false, reason: "confirming" };
      return confirmedCancelClaimNo.value === claimNo ? { ok: true } : { ok: false, reason: "not-executed" };
    }
    if (status.value !== "active") return { ok: false, reason: eligibility().reason ?? "unknown" };
    const beforeEnd = snapshot();
    status.value = "ended";
    finishedAt.value = mockServerNow();
    if (!persist()) {
      load(beforeEnd);
      return { ok: false, reason: "unknown" };
    }
    return { ok: true };
  }

  // PRODUCTION: client polls GET /api/trial/state; advancement runs server-side
  // by cron. Spec ④ 禁止动作:grace→ended flips STATE ONLY — zero debit, zero
  // order, zero device writes ever happen here. 边界判定/级联/补齐全在
  // resolveTrialAt(冻结窗口、finishedAt=真边界、null graceEndsAt 就地补齐)。
  async function poll(now: number): Promise<boolean> {
    if (remoteApiEnabled) return refreshRemote();
    advanceTo(now);
    return true;
  }

  function commandKey(operation: string): string {
    const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `h2-${operation}:${suffix}`;
  }

  function cancelDenial(message: string): TrialCancelDenial {
    if (message === "TRIAL_BALANCE_SUBMISSION_IN_PROGRESS" || message === "TRIAL_EXTERNAL_PAYMENT_IN_PROGRESS")
      return "payment-in-progress";
    return message === "TRIAL_NOT_CANCELLABLE" ? "not-cancellable" : "rejected";
  }

  function commandFailureReason(message: string): TrialIneligibleReason {
    switch (message) {
      case "TRIAL_ALREADY_ACTIVE": return "in-progress";
      case "TRIAL_ALREADY_REDEEMED": return "converted";
      case "TRIAL_COOLDOWN_ACTIVE": return "used";
      case "TRIAL_QUOTA_EXHAUSTED": return "quota-exhausted";
      case "TRIAL_CYCLE_RISK_BLOCKED": return "risk";
      case "TRIAL_PRODUCT_NOT_AVAILABLE":
      case "TRIAL_PRODUCT_NOT_RELEASED":
      case "TRIAL_PRODUCT_CONFIG_INVALID":
      case "TRIAL_DAILY_YIELD_INVALID": return "product-unavailable";
      case "TRIAL_CAPACITY_FULL": return "capacity-full";
      case "TRIAL_PHASE_CLOSED":
      case "TRIAL_KILL_SWITCH_DISABLED": return "phase-closed";
      default: return "unknown";
    }
  }

  return {
    status, startedAt, expiresAt, graceEndsAt, finishedAt, pendingConversion, legacyConversionPending, legacyConversionResumable,
    legacyReadbackPending, confirmedLegacyConversion,
    deniedLegacyConversion, recoverLegacyConversion, clearLegacyConversionResult,
    shadowFrozenAtUSD, shadowFrozenAtNEX, legacyCardMigrated,
    authorityStatus, authorityError, authorityResultUnknown, authorityIncomplete, lastReadFailed, transientReadFailure,
    displayState, conversionWindowOpen, originalPurchase, purchasedDevice, pendingStart, startRetryable, startNotSeen, confirmedStartClaimNo, confirmedStartDenial,
    pendingCancel, confirmedCancelClaimNo, confirmedCancelDenial, lifecycleReadbackPending, recoverLifecycleCommand, confirmedHomeOffer,
    authoritativeShadowUSD, authoritativeShadowNEX,
    authoritativeOffsetUSD, authoritativeRemainderUSD, authoritativePriceUSD, authoritativeQuote, authoritativeConversion,
    authorityClaimNo, authorityVersion, authorityServerState, authoritativeProductIdentity,
    eligibility, canStart, canOpenClaim, canConfirmOrdinaryProduct, isOwnTrialDevice, showPromo, showHeroPromo, confirmedOfferState,
    promoSlot,
    start, convert, cancel, poll, bindAccount, snapshot, getBindingEpoch, takeExpiryNotice,
    refreshRemote, refreshCheckoutState, refreshEligibilityRemote, refreshVisible, recoverVisible, refreshAtBoundary, serverTimeAt,
  };
});

/** Live shadow accrual — accrues during active, frozen during grace, 0 on
 *  none/ended/converted (spec ④: `ended` never accrues further).
 *  渲染路径游离函数:只读 resolveTrialAt 的解析结果拿正确时点语义(离线跨界的
 *  行按真实状态显示,累计上限 = 冻结窗口),绝不在此写状态/落盘(Vue 反模式);
 *  落盘由 poll/convert 独占。 */
export function liveShadowUSD(now: number): number {
  const s = useFreeTrial();
  if (remoteApiEnabled) return s.authoritativeShadowUSD;
  const cfg = useTrialConfig().config;
  const r = resolveTrialAt(s.snapshot(), now, cfg);
  if (r.status === "active") return accruedShadow(r, now, cfg).usd;
  if (r.status === "grace") return r.shadowFrozenAtUSD;
  return 0;
}

export function liveShadowNEX(now: number): number {
  const s = useFreeTrial();
  if (remoteApiEnabled) return s.authoritativeShadowNEX;
  const cfg = useTrialConfig().config;
  const r = resolveTrialAt(s.snapshot(), now, cfg);
  if (r.status === "active") return accruedShadow(r, now, cfg).nex;
  if (r.status === "grace") return r.shadowFrozenAtNEX;
  return 0;
}

/** Remaining ms until the next state boundary. */
export function remainingMs(now: number): number {
  const s = useFreeTrial();
  now = s.serverTimeAt(now);
  if (s.status === "active" && s.expiresAt !== null) return Math.max(0, s.expiresAt - now);
  if (s.status === "grace" && s.graceEndsAt !== null) return Math.max(0, s.graceEndsAt - now);
  return 0;
}

const SLOT_RESERVING_STATUSES: TrialStatus[] = ["active", "grace"];

/** Non-reactive variant for store actions (e.g. useApp.activateDevice slot cap). */
export function trialReservesSlotNow(): boolean {
  return SLOT_RESERVING_STATUSES.includes(useFreeTrial().status);
}

/** Reserved capacity is not proof that a trial is producing. */
export function trialProducesNow(): boolean {
  const trial = useFreeTrial();
  return trial.status === "active" && (!remoteApiEnabled || trial.authorityStatus === "ready" || trial.authorityStatus === "loading");
}

export { computeDiscountedPrice, computeTrialOffset };
