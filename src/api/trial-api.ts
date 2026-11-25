import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import type { PaymentPasswordAuthorization } from "./payment-password-api";
import type { TrialStatus } from "../store/trial-boundary";

export type TrialEligibilityReason =
  "in-progress" | "converted" | "used" | "phase-closed" | "quota-exhausted" | "risk" | "product-unavailable" | "capacity-full" | "unknown";
export type TrialConfigValue = string | boolean | null;
export type TrialSettlementPolicy = "FULL_TERM_ON_CONVERSION" | "ACCRUED_ON_CONVERSION";

/**
 * FEAT-TRIAL05 server quote for converting this claim now. The App only
 * displays it and echoes `quoteVersion` back on convert; it never derives
 * credit, rewards or the early discount itself.
 */
export interface TrialConversionOutcome {
  orderNo: string | null;
  refunded: boolean;
  /** Full-term conversions take their trial rewards back on refund; older rules do not. */
  rewardsReversed: boolean;
}

export interface TrialConversionQuote {
  settlementPolicy: TrialSettlementPolicy;
  quoteVersion: string;
  /** True only inside the original term with the early-purchase policy on. */
  earlyPurchase: boolean;
  priceUSD: number;
  /** Real accrual so far — never replaced by the settled totals. */
  accruedUSD: number;
  accruedNEX: number;
  settledUSD: number;
  rewardNEX: number;
  /** Not yet accrued part of the full term, granted for converting early. */
  earlyRewardUSD: number;
  earlyRewardNEX: number;
  offsetUSD: number;
  remainderUSD: number;
  promoDiscountUSD: number;
  /** The configured fixed discount (rules copy); this order may apply less. */
  earlyDiscountConfiguredUSD: number;
  earlyDiscountUSD: number;
  amountUSD: number;
  earlyEndsAt: number | null;
}

export interface TrialPurchaseDevice {
  productNo: string;
  productName: string;
  imageUrl: string | null;
  productType: "DEVICE" | "SHARE";
}

export interface TrialPurchaseOption extends TrialPurchaseDevice {
  inventoryMode: "FINITE" | "UNLIMITED";
  isTrialProduct: boolean;
  priceUSD: number;
  marketPriceUSD?: number;
  canBuy: boolean;
  reasonCode?: string;
  quote?: TrialConversionQuote;
}

export type TrialPurchaseOptionsRead =
  | { status: "unsupported" }
  | { status: "ready"; claimNo: string; serverNow: number; options: TrialPurchaseOption[] };

type TrialPurchaseSnapshot = {
  claimNo: string;
  device: TrialPurchaseDevice;
  confirmedAmountUSD: number;
};

export type TrialOriginalPurchase = TrialPurchaseSnapshot & (
  | {
      kind: "EXTERNAL";
      paymentNo: string;
      paymentMethod: "HDPAY_BANK" | "CREGIS_USDT_BSC" | "CREGIS_USDT_ERC20" | "CREGIS_USDT_TRC20";
      expiresAt: number;
      status: "CREATING" | "SUBMIT_UNKNOWN" | "AWAITING_PAYMENT" | "CONFIRMING" | "FUNDS_CONFIRMED" | "MANUAL_REVIEW";
    }
  | {
      kind: "BALANCE";
      submissionNo: string;
      paymentMethod: "UVEL_USDT_WALLET";
      quoteVersion: string;
      status: "PROCESSING" | "RESUMABLE";
    }
);

export interface TrialAuthorityState {
  authoritative: true;
  serverState: "ELIGIBLE" | "ACTIVE" | "GRACE" | "EXTENDED" | "REDEEMED" | "FAILED" | "CANCELLED";
  status: TrialStatus;
  canStart: boolean;
  eligibilityReason?: TrialEligibilityReason;
  claimNo: string | null;
  version: number;
  serverNow: number;
  startedAt: number | null;
  expiresAt: number | null;
  graceEndsAt: number | null;
  extendedEndsAt?: number | null;
  /** Explicit server expiry/cancellation classification; absent on older servers. */
  endReason?: "expired" | "cancelled" | null;
  finishedAt: number | null;
  cooldownUntil: number | null;
  shadowUSD: number;
  shadowNEX: number;
  /** Claim-snapshot amounts. Missing on older responses; never infer available credit. */
  offsetUSD?: number;
  remainderUSD?: number;
  priceUSD?: number;
  /** Missing on older servers and on terminal claims: keep the accrued-only presentation. */
  quote?: TrialConversionQuote;
  /** Redeemed claims: the purchase may have been refunded since. Missing on older servers. */
  conversion?: TrialConversionOutcome;
  originalPurchase?: TrialOriginalPurchase;
  purchasedDevice?: TrialPurchaseDevice;
  source: string;
  serverCanonical: true;
  sourceEnvironment: "PRODUCTION";
  runId: "";
  provenance: {
    serverCanonical: true;
    source: string;
    sourceEnvironment: "PRODUCTION";
    runId: "";
  };
  paymentRail: "UVEL_USDT_WALLET";
  config: Record<string, TrialConfigValue>;
}

export interface TrialConvertReceipt {
  orderNo: string;
  paymentNo?: string;
  productNo: string;
  amountUsdt: number;
  discountUsdt: number;
  paymentStatus: "PENDING" | "PAID";
  orderStatus: "PENDING_PAYMENT" | "PAID";
  /** Present from FEAT-TRIAL05 servers: what this conversion actually settled. */
  settlement?: {
    settlementPolicy: TrialSettlementPolicy;
    earlyPurchase: boolean;
    remainderUSD: number;
    rewardNEX: number;
    earlyRewardUSD: number;
    earlyRewardNEX: number;
    earlyDiscountUSD: number;
  };
  source: "nx_trial_claim + nx_order + nx_order_item";
  serverCanonical: true;
  sourceEnvironment: "PRODUCTION";
  runId: "";
  provenance: {
    source: "nx_trial_claim + nx_order + nx_order_item";
    serverCanonical: true;
    sourceEnvironment: "PRODUCTION";
    runId: "";
  };
}

const PURCHASE_REFUSALS = [
  "TRIAL_QUOTE_CHANGED", "TRIAL_PRODUCT_REMOVED", "TRIAL_PRODUCT_SOLD_OUT",
  "TRIAL_PRODUCT_QUOTA_EXHAUSTED", "TRIAL_PRODUCT_REQUIREMENTS_NOT_MET",
  "TRIAL_WALLET_INSUFFICIENT", "TRIAL_PURCHASE_UNAVAILABLE", "TRIAL_BALANCE_ONLY",
  "TRIAL_EXISTING_PURCHASE", "TRIAL_NOT_CONVERTIBLE",
] as const;
type TrialPurchaseRefusalCode = typeof PURCHASE_REFUSALS[number];

export type TrialPurchaseConvertResult =
  | { status: "settled"; receipt: TrialConvertReceipt }
  | { status: "processing"; originalPurchase: TrialOriginalPurchase }
  | { status: "refused"; reasonCode: TrialPurchaseRefusalCode; quote?: TrialConversionQuote; originalPurchase?: TrialOriginalPurchase };

export interface TrialApi {
  state(): Promise<TrialAuthorityState>;
  purchaseOptions(): Promise<TrialPurchaseOptionsRead>;
  eligibility(): Promise<TrialAuthorityState>;
  start(idempotencyKey: string, deviceName: string): Promise<TrialAuthorityState>;
  convert(productNo: string, expectedAmountUsdt: number | null, quoteVersion: string | null,
    idempotencyKey: string, authorization?: PaymentPasswordAuthorization): Promise<TrialConvertReceipt>;
  convertPurchase(productNo: string, expectedAmountUsdt: number, quoteVersion: string,
    idempotencyKey: string, authorization: PaymentPasswordAuthorization): Promise<TrialPurchaseConvertResult>;
  cancel(reason: "explicit" | "unbind", idempotencyKey: string): Promise<TrialAuthorityState>;
}

const SERVER_STATES = new Set([
  "ELIGIBLE", "ACTIVE", "GRACE", "EXTENDED", "REDEEMED", "FAILED", "CANCELLED",
]);
const REASONS = new Set([
  "in-progress", "converted", "used", "phase-closed", "quota-exhausted", "risk", "product-unavailable", "capacity-full", "unknown",
]);

function invalid(): never {
  throw new Error("TRIAL_RESPONSE_INVALID");
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finiteNumber(value: unknown, min = 0): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= min ? parsed : null;
}

function timestamp(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Date.parse(String(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : invalid();
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseTrialPurchaseDevice(value: unknown): TrialPurchaseDevice {
  const row = record(value);
  const productNo = text(row?.productNo);
  const productName = text(row?.productName);
  const imageUrl = row?.imageUrl === null ? null : text(row?.imageUrl);
  const productType = row?.productType;
  if (!productNo || !productName || (imageUrl === null && row?.imageUrl !== null)
      || (productType !== "DEVICE" && productType !== "SHARE")) return invalid();
  return { productNo, productName, imageUrl, productType };
}

const EXTERNAL_METHODS = new Set(["HDPAY_BANK", "CREGIS_USDT_BSC", "CREGIS_USDT_ERC20", "CREGIS_USDT_TRC20"]);
const EXTERNAL_PURCHASE_STATES = new Set([
  "CREATING", "SUBMIT_UNKNOWN", "AWAITING_PAYMENT", "CONFIRMING", "FUNDS_CONFIRMED", "MANUAL_REVIEW",
]);

export function parseTrialOriginalPurchase(value: unknown): TrialOriginalPurchase {
  const row = record(value);
  const claimNo = text(row?.claimNo);
  const confirmedAmountUSD = finiteNumber(row?.confirmedAmountUsdt);
  if (!row || !claimNo || confirmedAmountUSD === null) return invalid();
  const snapshot = { claimNo, device: parseTrialPurchaseDevice(row.device), confirmedAmountUSD };
  if (row.kind === "BALANCE") {
    const submissionNo = text(row.submissionNo);
    const quoteVersion = text(row.quoteVersion);
    if (!submissionNo || !quoteVersion || row.paymentMethod !== "UVEL_USDT_WALLET" || row.status !== "PROCESSING") return invalid();
    return { ...snapshot, kind: row.kind, paymentMethod: row.paymentMethod, status: row.status, submissionNo, quoteVersion };
  }
  const paymentNo = text(row.paymentNo);
  const expiresAt = timestamp(row.expiresAt);
  if (row.kind !== "EXTERNAL" || !paymentNo || expiresAt === null
      || !EXTERNAL_METHODS.has(row.paymentMethod as string)
      || !EXTERNAL_PURCHASE_STATES.has(row.status as string)) return invalid();
  type ExternalPurchase = Extract<TrialOriginalPurchase, { kind: "EXTERNAL" }>;
  return { ...snapshot, kind: row.kind, paymentNo, expiresAt,
    paymentMethod: row.paymentMethod as ExternalPurchase["paymentMethod"],
    status: row.status as ExternalPurchase["status"] };
}

const SETTLEMENT_POLICIES = new Set(["FULL_TERM_ON_CONVERSION", "ACCRUED_ON_CONVERSION"]);

export function parseTrialConversionQuote(value: unknown): TrialConversionQuote {
  const row = record(value);
  const policy = row?.settlementPolicy;
  const version = typeof row?.quoteVersion === "string" ? row.quoteVersion.trim() : "";
  const amounts = {
    priceUSD: finiteNumber(row?.priceUsdt), accruedUSD: finiteNumber(row?.accruedUsdt),
    accruedNEX: finiteNumber(row?.accruedNex), settledUSD: finiteNumber(row?.settledUsdt),
    rewardNEX: finiteNumber(row?.rewardNex), earlyRewardUSD: finiteNumber(row?.earlyRewardUsdt),
    earlyRewardNEX: finiteNumber(row?.earlyRewardNex), offsetUSD: finiteNumber(row?.offsetUsdt),
    remainderUSD: finiteNumber(row?.remainderUsdt), promoDiscountUSD: finiteNumber(row?.promoDiscountUsdt),
    earlyDiscountConfiguredUSD: finiteNumber(row?.earlyDiscountConfiguredUsdt),
    earlyDiscountUSD: finiteNumber(row?.earlyDiscountUsdt), amountUSD: finiteNumber(row?.amountUsdt),
  };
  const earlyEndsAt = timestamp(row?.earlyEndsAtEpochMs);
  if (!row || typeof policy !== "string" || !SETTLEMENT_POLICIES.has(policy) || !version || version.length > 96
      || typeof row.earlyPurchase !== "boolean"
      || row.earlyPurchase !== (policy === "FULL_TERM_ON_CONVERSION")
      || (row.earlyPurchase && earlyEndsAt === null)
      || Object.values(amounts).some(amount => amount === null)) return invalid();
  return { settlementPolicy: policy as TrialSettlementPolicy, quoteVersion: version,
    earlyPurchase: row.earlyPurchase, ...amounts as { [K in keyof typeof amounts]: number }, earlyEndsAt };
}

function parsePurchaseOption(row: Record<string, unknown>): TrialPurchaseOption {
  const device = parseTrialPurchaseDevice(row);
  const { inventoryMode, isTrialProduct } = row;
  const priceUSD = finiteNumber(row.priceUsdt);
  if ((inventoryMode !== "FINITE" && inventoryMode !== "UNLIMITED") || typeof isTrialProduct !== "boolean"
      || priceUSD === null || priceUSD === 0) return invalid();
  const marketPriceUSD = finiteNumber(row.marketPriceUsdt);
  const metadata = { ...device, inventoryMode, isTrialProduct, priceUSD,
    ...(marketPriceUSD !== null ? { marketPriceUSD } : {}) } as const;
  const unavailable = { ...metadata, canBuy: false };
  let quote: TrialConversionQuote;
  try {
    quote = parseTrialConversionQuote(row.quote);
  } catch {
    return { ...unavailable, reasonCode: "TRIAL_OPTION_QUOTE_UNAVAILABLE" };
  }
  if (quote.priceUSD !== priceUSD) return { ...unavailable, reasonCode: "TRIAL_OPTION_QUOTE_UNAVAILABLE" };
  const reasonCode = text(row.reasonCode);
  if (row.canBuy === true && !reasonCode) return { ...metadata, canBuy: true, quote };
  if (row.canBuy === false && reasonCode) return { ...unavailable, reasonCode, quote };
  return { ...unavailable, reasonCode: "TRIAL_OPTION_DATA_UNAVAILABLE", quote };
}

export function parseTrialPurchaseOptions(value: unknown): Extract<TrialPurchaseOptionsRead, { status: "ready" }> {
  const row = record(value);
  const claimNo = text(row?.claimNo);
  const serverNow = timestamp(row?.serverTime);
  if (!row || !claimNo || serverNow === null || !Array.isArray(row.options)) return invalid();
  const options: TrialPurchaseOption[] = [];
  for (const item of row.options) {
    const option = record(item);
    if (!option || typeof option.visible !== "boolean" || (option.visible === false && option.isTrialProduct !== false))
      return invalid();
    if (option.visible) options.push(parsePurchaseOption(option));
  }
  if (options.filter(option => option.isTrialProduct).length !== 1
      || new Set(options.map(option => option.productNo)).size !== options.length) return invalid();
  return { status: "ready", claimNo, serverNow, options };
}

export function parseTrialPurchaseConvertResult(value: unknown, status: number): TrialPurchaseConvertResult {
  const row = record(value);
  if (status === 202) {
    const originalPurchase = parseTrialOriginalPurchase(row?.originalPurchase);
    if (originalPurchase.kind !== "BALANCE" || originalPurchase.status !== "PROCESSING") return invalid();
    return { status: "processing", originalPurchase };
  }
  if (status === 409) {
    const reasonCode = row?.reasonCode as TrialPurchaseRefusalCode;
    if (!PURCHASE_REFUSALS.includes(reasonCode)) return invalid();
    return { status: "refused", reasonCode,
      ...(reasonCode === "TRIAL_QUOTE_CHANGED" ? { quote: parseTrialConversionQuote(row?.quote) } : {}),
      ...(reasonCode === "TRIAL_EXISTING_PURCHASE" ? { originalPurchase: parseTrialOriginalPurchase(row?.originalPurchase) } : {}) };
  }
  const receipt = parseTrialConvertReceipt(value);
  if (receipt.paymentStatus !== "PAID" || receipt.orderStatus !== "PAID") return invalid();
  return { status: "settled", receipt };
}

function receiptSettlement(row: Record<string, unknown>): TrialConvertReceipt["settlement"] | null | undefined {
  if (row.settlementPolicy === undefined) return undefined;
  const policy = row.settlementPolicy;
  const remainderUSD = finiteNumber(row.remainderUsdt);
  const rewardNEX = finiteNumber(row.rewardNex);
  const earlyRewardUSD = finiteNumber(row.earlyRewardUsdt);
  const earlyRewardNEX = finiteNumber(row.earlyRewardNex);
  const earlyDiscountUSD = finiteNumber(row.earlyDiscountUsdt);
  if (typeof policy !== "string" || !SETTLEMENT_POLICIES.has(policy) || typeof row.earlyPurchase !== "boolean"
      || remainderUSD === null || rewardNEX === null || earlyRewardUSD === null || earlyRewardNEX === null
      || earlyDiscountUSD === null) return null;
  return { settlementPolicy: policy as TrialSettlementPolicy, earlyPurchase: row.earlyPurchase,
    remainderUSD, rewardNEX, earlyRewardUSD, earlyRewardNEX, earlyDiscountUSD };
}

export function parseTrialConvertReceipt(value: unknown): TrialConvertReceipt {
  const row = record(value) ? { ...record(value)! } : null;
  if (row && (row.paymentMethod === 'HDPAY_BANK' || row.paymentMethod === 'CREGIS_USDT_BSC' || row.paymentMethod === 'CREGIS_USDT_ERC20' || row.paymentMethod === 'CREGIS_USDT_TRC20') && typeof row.amountUsdt === 'string') {
    if (!/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(row.amountUsdt)) return invalid();
    row.amountUsdt = Number(row.amountUsdt);
  }
  const orderNo = typeof row?.orderNo === "string" ? row.orderNo.trim() : "";
  const productNo = typeof row?.productNo === "string" ? row.productNo.trim() : "";
  const amountUsdt = finiteNumber(row?.amountUsdt);
  const discountUsdt = finiteNumber(row?.discountUsdt);
  const paymentStatus = row?.paymentStatus === "PAID" ? "PAID" : row?.paymentStatus === "PENDING" ? "PENDING" : null;
  const orderStatus = row?.orderStatus === "PAID" ? "PAID" : row?.orderStatus === "PENDING_PAYMENT" ? "PENDING_PAYMENT" : null;
  const source = row?.source === "nx_trial_claim + nx_order + nx_order_item" ? row.source : null;
  const provenance = record(row?.provenance);
  const paymentNo = row?.paymentNo == null ? undefined : String(row.paymentNo).trim();
  const settlement = row ? receiptSettlement(row) : undefined;
  if (settlement === null || !/^TRC-[A-Z0-9]+$/.test(orderNo) || !productNo || amountUsdt === null || discountUsdt === null
      || !paymentStatus || !orderStatus || !source
      || row?.serverCanonical !== true || row?.sourceEnvironment !== "PRODUCTION" || row?.runId !== ""
      || provenance?.serverCanonical !== true || provenance.source !== source
      || provenance.sourceEnvironment !== "PRODUCTION" || provenance.runId !== "") return invalid();
  return { orderNo, ...(paymentNo ? { paymentNo } : {}), productNo, amountUsdt, discountUsdt,
    paymentStatus, orderStatus, ...(settlement ? { settlement } : {}), source, serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "",
    provenance: { source, serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "" } };
}

function clientStatus(serverState: TrialAuthorityState["serverState"]): TrialStatus {
  switch (serverState) {
    case "ELIGIBLE": return "none";
    case "ACTIVE": return "active";
    case "GRACE":
    case "EXTENDED": return "grace";
    case "REDEEMED": return "converted";
    case "FAILED":
    case "CANCELLED": return "ended";
  }
}

function trialConfig(value: unknown): Record<string, TrialConfigValue> {
  const source = record(value);
  if (!source) return invalid();
  const result: Record<string, TrialConfigValue> = {};
  for (const [key, item] of Object.entries(source)) {
    const nullable = key === "trialOffsetCapUSD" || key === "shadowDailyUSD" || key === "shadowDailyNEX";
    if ((typeof item !== "string" && typeof item !== "boolean"
        && !(nullable && item === null)) || !key.trim()) return invalid();
    result[key] = item;
  }
  return result;
}

export function parseTrialAuthorityState(value: unknown): TrialAuthorityState {
  const row = record(value);
  const rawState = typeof row?.state === "string" ? row.state.trim().toUpperCase() : "";
  if (!row || row.authoritative !== true || !SERVER_STATES.has(rawState)) return invalid();
  const serverState = rawState as TrialAuthorityState["serverState"];
  const canStart = row.canStart;
  const serverNow = finiteNumber(row.serverNowEpochMs, 1);
  const version = finiteNumber(row.version);
  const source = row.source === "nx_trial_claim" || row.source === "nx_trial_claim + nx_user_wallet"
    ? row.source : null;
  const provenance = record(row.provenance);
  const reason = row.eligibilityReason == null ? undefined : String(row.eligibilityReason);
  const claimNo = row.claimNo == null ? null : String(row.claimNo).trim();
  const shadowUSD = finiteNumber(row.shadowUsdt ?? 0);
  const shadowNEX = finiteNumber(row.shadowNex ?? 0);
  const hasAmounts = ["offsetUsdt", "remainderUsdt", "priceUsdt"].some(key => key in row);
  const offsetUSD = hasAmounts ? finiteNumber(row.offsetUsdt) : null;
  const remainderUSD = hasAmounts ? finiteNumber(row.remainderUsdt) : null;
  const priceUSD = hasAmounts ? finiteNumber(row.priceUsdt) : null;
  if (hasAmounts && (offsetUSD === null || remainderUSD === null || priceUSD === null)) return invalid();
  const quote = row.quote == null ? undefined : parseTrialConversionQuote(row.quote);
  if (typeof canStart !== "boolean" || serverNow === null || version === null || !Number.isInteger(version)
      || !source || row.serverCanonical !== true || row.sourceEnvironment !== "PRODUCTION" || row.runId !== ""
      || provenance?.serverCanonical !== true || provenance.source !== source
      || provenance.sourceEnvironment !== "PRODUCTION" || provenance.runId !== ""
      || row.paymentRail !== "UVEL_USDT_WALLET"
      || (reason !== undefined && !REASONS.has(reason))
      || (canStart && reason !== undefined)
      || (!canStart && reason === undefined)
      || (["ACTIVE", "GRACE", "EXTENDED", "REDEEMED"].includes(serverState) && canStart)
      || (serverState !== "ELIGIBLE" && !claimNo)
      || shadowUSD === null || shadowNEX === null) return invalid();

  const startedAt = timestamp(row.claimedAtEpochMs ?? row.claimedAt);
  const expiresAt = timestamp(row.expiresAtEpochMs ?? row.expiresAt);
  const graceEndsAt = timestamp(row.graceEndsAtEpochMs ?? row.graceEndsAt);
  const extendedEndsAt = timestamp(row.extendedEndsAtEpochMs ?? row.extendedEndsAt);
  if (serverState === "EXTENDED" && extendedEndsAt === null) return invalid();
  const finishedAt = timestamp(row.finishedAtEpochMs ?? row.finishedAt);
  const endReason = row.endReason;
  if (endReason !== undefined && endReason !== null && endReason !== "expired" && endReason !== "cancelled") return invalid();
  const cooldownUntil = timestamp(row.cooldownUntilEpochMs ?? row.cooldownUntil);
  const conversion = typeof row.conversionRefunded === "boolean"
    ? {
      orderNo: typeof row.conversionOrderNo === "string" && row.conversionOrderNo.trim() ? row.conversionOrderNo.trim() : null,
      refunded: row.conversionRefunded,
      rewardsReversed: row.conversionRewardsReversed === true,
    }
    : null;
  const originalPurchase = row.originalPurchase == null ? undefined : parseTrialOriginalPurchase(row.originalPurchase);
  const purchasedDevice = row.purchasedDevice == null ? undefined : parseTrialPurchaseDevice(row.purchasedDevice);
  if (originalPurchase && originalPurchase.claimNo !== claimNo) return invalid();
  if (["ACTIVE", "GRACE", "EXTENDED", "REDEEMED"].includes(serverState)
      && (startedAt === null || expiresAt === null)) return invalid();

  return {
    authoritative: true,
    serverState,
    status: clientStatus(serverState),
    canStart,
    ...(reason ? { eligibilityReason: reason as TrialEligibilityReason } : {}),
    claimNo,
    version,
    serverNow,
    startedAt,
    expiresAt,
    graceEndsAt,
    extendedEndsAt,
    ...(endReason !== undefined ? { endReason } : {}),
    finishedAt,
    cooldownUntil,
    shadowUSD,
    shadowNEX,
    ...(hasAmounts ? { offsetUSD: offsetUSD!, remainderUSD: remainderUSD!, priceUSD: priceUSD! } : {}),
    ...(quote ? { quote } : {}),
    ...(conversion ? { conversion } : {}),
    ...(originalPurchase ? { originalPurchase } : {}),
    ...(purchasedDevice ? { purchasedDevice } : {}),
    source,
    serverCanonical: true,
    sourceEnvironment: "PRODUCTION",
    runId: "",
    provenance: {
      serverCanonical: true,
      source,
      sourceEnvironment: "PRODUCTION",
      runId: "",
    },
    paymentRail: "UVEL_USDT_WALLET",
    config: trialConfig(row.config),
  };
}

export function createTrialApi(client: ApiClient): TrialApi {
  const parse = async (request: Parameters<ApiClient["request"]>[0]) =>
    parseTrialAuthorityState(await client.request(request));
  function convertRequest(productNo: string, expectedAmountUsdt: number | null, quoteVersion: string | null,
    idempotencyKey: string, authorization?: PaymentPasswordAuthorization): Parameters<ApiClient["request"]>[0] {
    return {
      method: "POST",
      path: "/api/trial/convert",
      // Older intents carry no version; omitting it keeps their idempotent replay byte-identical.
      body: { productNo, expectedAmountUsdt, ...(quoteVersion ? { quoteVersion } : {}), ...authorization },
      idempotencyKey,
      retryAfterAuth: false,
    };
  }
  return {
    state: () => parse({ method: "GET", path: "/api/trial/state" }),
    async purchaseOptions() {
      try {
        return parseTrialPurchaseOptions(await client.request({ method: "GET", path: "/api/trial/purchase-options" }));
      } catch (cause) {
        if (cause instanceof ApiError && cause.kind === "http" && cause.status === 404) return { status: "unsupported" };
        throw cause;
      }
    },
    eligibility: () => parse({ method: "GET", path: "/api/trial/eligibility" }),
    start: (idempotencyKey, deviceName) => parse({
      method: "POST",
      path: "/api/trial/start",
      body: { deviceName },
      idempotencyKey,
    }),
    convert: async (...args) => parseTrialConvertReceipt(await client.request(convertRequest(...args))),
    convertPurchase: (...args) => {
      if (!args[2].trim()) return Promise.reject(new Error("TRIAL_QUOTE_VERSION_REQUIRED"));
      return client.request<TrialPurchaseConvertResult>({
        ...convertRequest(...args),
        acceptedResponses: [
          ...PURCHASE_REFUSALS.map(message => ({ status: 409, code: 409, message })),
          { status: 202, code: 202, message: "TRIAL_PURCHASE_PROCESSING" },
        ],
        parseResponseData: parseTrialPurchaseConvertResult,
      });
    },
    cancel: (reason, idempotencyKey) => parse({
      method: "POST",
      path: "/api/trial/cancel",
      body: { reason },
      idempotencyKey,
    }),
  };
}
