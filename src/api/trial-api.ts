import type { ApiClient } from "./api-client";
import { ApiError, isApiRefusal } from "./errors";
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
  /** True when an in-term purchase qualifies for full-term settlement. */
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
  /** Fraction for display, normalized from the quote's wire percentage. */
  discountRate?: number;
  discountCapUSD?: number;
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
  productType: "DEVICE" | "SERVER" | "SHARE";
}

type TrialExternalMethod = "HDPAY_BANK" | "CREGIS_USDT_BSC" | "CREGIS_USDT_ERC20" | "CREGIS_USDT_TRC20";
export type TrialPaymentMethod = "WALLET" | TrialExternalMethod;

export interface TrialPurchaseOption extends TrialPurchaseDevice {
  inventoryMode: "FINITE" | "UNLIMITED" | null;
  isTrialProduct: boolean;
  priceUSD: number | null;
  marketPriceUSD?: number;
  paymentMethods: TrialPaymentMethod[];
  canBuy: boolean;
  reasonCode?: string;
  quote?: TrialConversionQuote;
}

export type TrialPurchaseOptionsRead =
  | { status: "unsupported" }
  | { status: "not-convertible" }
  | { status: "ready"; claimNo: string; serverNow: number; options: TrialPurchaseOption[] };

type TrialPurchaseSnapshot = {
  claimNo: string;
  device: TrialPurchaseDevice;
  confirmedAmountUSD: number | null;
};

export type TrialOriginalPurchase = TrialPurchaseSnapshot & (
  | {
      kind: "EXTERNAL";
      paymentNo: string;
      paymentMethod: TrialExternalMethod;
      /** Frozen business principal, separate from the user's confirmation limit. */
      amountUSD?: number;
      expiresAt: number;
      status: "CREATING" | "SUBMIT_UNKNOWN" | "AWAITING_PAYMENT" | "FUNDS_CONFIRMED" | "MANUAL_REVIEW" | "EXPIRED";
    }
  | {
      kind: "BALANCE";
      submissionNo: string;
      paymentMethod: "WALLET";
      quoteVersion: string | null;
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
  originalPurchase?: TrialOriginalPurchase | null;
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
  claimNo?: string;
  orderNo: string;
  paymentNo?: string;
  productNo: string;
  amountUsdt: number;
  discountUsdt: number;
  paymentStatus: "PENDING" | "PAID";
  orderStatus: "PENDING_PAYMENT" | "PAID";
  purchasedDevice?: TrialPurchaseDevice;
  /** Present from FEAT-TRIAL05 servers: what this conversion actually settled. */
  settlement?: TrialConversionQuote | {
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

export const TRIAL_PRICE_CHANGES = ["TRIAL_QUOTE_CHANGED", "TRIAL_AMOUNT_MISMATCH"] as const;
export const TRIAL_DEVICE_RESELECTION_CODES = [
  "TRIAL_PRODUCT_NOT_ELIGIBLE", "TRIAL_PRODUCT_NOT_RELEASED", "PRODUCT_NOT_AVAILABLE", "PRODUCT_NOT_RELEASED",
  "PRODUCT_PRICE_INVALID", "PRODUCT_TYPE_UNSUPPORTED", "PRODUCT_TEST_IDENTIFIER", "PRODUCT_NO_EFFECTIVE_EARNINGS", "H1_RHYTHM_UNAVAILABLE", "E1_PHASE_CONFIG_UNAVAILABLE",
  "E1_UNLOCK_PHASE_REQUIRED", "E1_GENERATION_ELIGIBILITY_REQUIRED", "E1_GENERATION_PHASE_NOT_REACHED",
  "E1_GENERATION_PHASE_MISMATCH", "E1_GENERATION_RELEASE_MONTH_NOT_REACHED", "E1_UNLOCK_PHASE_INVALID", "E1_PHASE_NOT_REACHED",
] as const;
const BALANCE_ORIGINAL_CODES = ["TRIAL_BALANCE_SUBMISSION_IN_PROGRESS", "TRIAL_EXTERNAL_PAYMENT_IN_PROGRESS"] as const;
const BALANCE_SERVICE_REFUSALS = ["ORDER_MONTHLY_QUOTA_UNAVAILABLE", "TEST_CLOUD_RESOURCE_CAPACITY_UNAVAILABLE"] as const;
const AUTHORIZATION_REFUSALS = /^PAYMENT_PASSWORD_(?:REQUIRED|INVALID|INCORRECT|ATTEMPT_CONFLICT|ATTEMPT_ALREADY_USED|NOT_CONFIGURED|VERSION_CONFLICT|LOCKED|UNAVAILABLE)$/;

export function trialPriceChanged(message: string): boolean {
  return TRIAL_PRICE_CHANGES.some(code => code === message);
}

export type TrialPurchaseConvertResult =
  | { status: "settled"; receipt: TrialConvertReceipt }
  | { status: "refused"; reasonCode: string; quote?: TrialConversionQuote; claimNo?: string; productNo?: string; originalPurchase?: TrialOriginalPurchase };

export type TrialCancelResult = { status: "cancelled"; state: TrialAuthorityState }
  | { status: "payment-in-progress"; originalPurchase?: TrialOriginalPurchase };

export type TrialLifecycleKind = "start" | "cancel";
export type TrialLifecycleReceipt =
  | { status: "NOT_SEEN" | "PROCESSING" | "INDETERMINATE" | "unsupported" }
  | { status: "SUCCEEDED"; claimNo: string }
  | { status: "REJECTED"; code: number; message: string };

export interface TrialStartPayload {
  deviceName: string;
  trialProductId?: string;
  trialTermsVersion?: string;
}

export interface TrialApi {
  state(): Promise<TrialAuthorityState>;
  purchaseOptions(): Promise<TrialPurchaseOptionsRead>;
  eligibility(): Promise<TrialAuthorityState>;
  command(kind: TrialLifecycleKind, commandKey: string): Promise<TrialLifecycleReceipt>;
  start(idempotencyKey: string, body: TrialStartPayload): Promise<TrialAuthorityState>;
  convert(productNo: string, expectedAmountUsdt: number | null, quoteVersion: string | null,
    idempotencyKey: string, authorization?: PaymentPasswordAuthorization): Promise<TrialConvertReceipt>;
  convertPurchase(productNo: string, expectedAmountUsdt: number, quoteVersion: string,
    idempotencyKey: string, authorization: PaymentPasswordAuthorization): Promise<TrialPurchaseConvertResult>;
  cancel(reason: "explicit" | "unbind", idempotencyKey: string): Promise<TrialCancelResult>;
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

function purchaseProductType(value: unknown): TrialPurchaseDevice["productType"] | null {
  return value === "DEVICE" || value === "SERVER" || value === "SHARE" ? value : null;
}

function purchaseDevice(row: Record<string, unknown>, productNo: string): TrialPurchaseDevice {
  return {
    productNo,
    productName: text(row.name) ?? productNo,
    imageUrl: text(row.imageUrl),
    productType: purchaseProductType(row.productType) ?? "DEVICE",
  };
}

function parseTrialPurchaseDevice(value: unknown): TrialPurchaseDevice {
  const row = record(value);
  const productNo = text(row?.productNo);
  if (!row || !productNo || !text(row.name)) return invalid();
  return purchaseDevice(row, productNo);
}

const EXTERNAL_METHODS = new Set(["HDPAY_BANK", "CREGIS_USDT_BSC", "CREGIS_USDT_ERC20", "CREGIS_USDT_TRC20"]);
const EXTERNAL_PURCHASE_STATES = new Set([
  "CREATING", "SUBMIT_UNKNOWN", "AWAITING_PAYMENT", "FUNDS_CONFIRMED", "MANUAL_REVIEW", "EXPIRED",
]);

export function parseTrialOriginalPurchase(value: unknown): TrialOriginalPurchase {
  const row = record(value);
  const claimNo = text(row?.claimNo);
  const productNo = text(row?.productNo);
  if (!row || !claimNo || !productNo) return invalid();
  const confirmedAmountUSD = finiteNumber(row.expectedAmountUsdt);
  if (row.expectedAmountUsdt != null && confirmedAmountUSD === null) return invalid();
  if (row.kind === "BALANCE") {
    const submissionNo = text(row.commandKey);
    const quoteVersion = text(row.quoteVersion);
    if (!submissionNo || row.paymentMethod !== "WALLET" || row.status !== "PROCESSING") return invalid();
    return { kind: row.kind, paymentMethod: row.paymentMethod, status: row.status, claimNo, submissionNo, quoteVersion,
      confirmedAmountUSD, device: purchaseDevice(row, productNo) };
  }
  const paymentNo = text(row.intentNo);
  const expiresAt = timestamp(row.deadlineAt);
  const amountUSD = finiteNumber(row.amountUsdt);
  if (row.kind !== "EXTERNAL" || !paymentNo || expiresAt === null || !text(row.name)
      || (row.amountUsdt != null && amountUSD === null)
      || !EXTERNAL_METHODS.has(row.paymentMethod as string)
      || !EXTERNAL_PURCHASE_STATES.has(row.status as string)) return invalid();
  type ExternalPurchase = Extract<TrialOriginalPurchase, { kind: "EXTERNAL" }>;
  return { kind: row.kind, claimNo, paymentNo, expiresAt, confirmedAmountUSD,
    ...(amountUSD !== null ? { amountUSD } : {}),
    device: { ...purchaseDevice(row, productNo), productType: "DEVICE" },
    paymentMethod: row.paymentMethod as TrialExternalMethod,
    status: row.status as ExternalPurchase["status"] };
}

const SETTLEMENT_POLICIES = new Set(["FULL_TERM_ON_CONVERSION", "ACCRUED_ON_CONVERSION"]);

export function parseTrialDiscountTerms(row: Record<string, unknown>) {
  const rawRate = row.discountRate;
  const pct = typeof rawRate === "string" && /^\d+(?:\.\d+)?$/.test(rawRate) ? finiteNumber(rawRate) : null;
  const cap = finiteNumber(row.discountCapUsdt);
  return {
    ...(pct !== null && pct <= 100 ? { discountRate: Number(`${rawRate}e-2`) } : {}),
    ...(cap !== null ? { discountCapUSD: cap } : {}),
  };
}

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
    earlyPurchase: row.earlyPurchase, ...amounts as { [K in keyof typeof amounts]: number }, earlyEndsAt,
    ...parseTrialDiscountTerms(row) };
}

const QUOTE_UNAVAILABLE = "TRIAL_PRODUCT_QUOTE_UNAVAILABLE";

function parsePurchaseOption(row: Record<string, unknown>, productNo: string, isTrialProduct: boolean): TrialPurchaseOption {
  const device = purchaseDevice(row, productNo);
  const inventoryMode: TrialPurchaseOption["inventoryMode"] =
    row.inventoryMode === "FINITE" || row.inventoryMode === "UNLIMITED" ? row.inventoryMode : null;
  const priceUSD = finiteNumber(row.priceUsdt, 0.000001);
  const marketPriceUSD = finiteNumber(row.storePriceUsdt);
  const methods = Array.isArray(row.paymentMethods) ? row.paymentMethods : [];
  const validMethods = methods.includes("WALLET") && methods.every(method => method === "WALLET" || EXTERNAL_METHODS.has(method));
  const metadata: Omit<TrialPurchaseOption, "canBuy"> = { ...device, inventoryMode, isTrialProduct, priceUSD,
    paymentMethods: validMethods ? methods as TrialPaymentMethod[] : [],
    ...(marketPriceUSD !== null ? { marketPriceUSD } : {}) };
  const reasonCode = text(row.unavailableReason);
  if (!text(row.name) || !purchaseProductType(row.productType) || !inventoryMode || !validMethods
      || (row.imageUrl !== null && !text(row.imageUrl)) || typeof row.canPurchase !== "boolean"
      || (row.canPurchase ? row.unavailableReason !== null : !reasonCode))
    return { ...metadata, canBuy: false, reasonCode: "PRODUCT_NOT_AVAILABLE" };
  if (!row.canPurchase && reasonCode !== QUOTE_UNAVAILABLE) return { ...metadata, canBuy: false, reasonCode: reasonCode! };
  try {
    const quote = parseTrialConversionQuote(row.quote);
    if (row.canPurchase && quote.priceUSD === priceUSD && row.quoteVersion === quote.quoteVersion)
      return { ...metadata, canBuy: true, quote };
  } catch { /* An unreadable quote disables just this product. */ }
  return { ...metadata, canBuy: false, reasonCode: QUOTE_UNAVAILABLE };
}

export function parseTrialPurchaseOptions(value: unknown): Extract<TrialPurchaseOptionsRead, { status: "ready" }> {
  const row = record(value);
  const claimNo = text(row?.claimNo);
  const serverNow = timestamp(row?.serverTime);
  if (!row || !claimNo || serverNow === null || !Array.isArray(row.options)) return invalid();
  const options: TrialPurchaseOption[] = [];
  for (const item of row.options) {
    const option = record(item);
    const productNo = text(option?.productNo);
    if (!option || !productNo || typeof option.originalTrialProduct !== "boolean") return invalid();
    options.push(parsePurchaseOption(option, productNo, option.originalTrialProduct));
  }
  if (options.filter(option => option.isTrialProduct).length !== 1
      || new Set(options.map(option => option.productNo)).size !== options.length) return invalid();
  return { status: "ready", claimNo, serverNow, options };
}

export function parseTrialChangedQuote(value: unknown) {
  const row = record(value);
  const claimNo = text(row?.claimNo);
  const productNo = text(row?.productNo);
  const quote = parseTrialConversionQuote(row?.quote);
  if (!claimNo || !productNo || row?.quoteVersion !== quote.quoteVersion) return invalid();
  return { claimNo, productNo, quote };
}

export function parseTrialPurchaseConvertResult(value: unknown, code: number, reasonCode = ""): TrialPurchaseConvertResult {
  if (code !== 0) {
    return { status: "refused", reasonCode,
      ...(trialPriceChanged(reasonCode) ? parseTrialChangedQuote(value) : {}),
      ...(BALANCE_ORIGINAL_CODES.some(message => message === reasonCode) ? { originalPurchase: parseTrialOriginalPurchase(value) } : {}) };
  }
  const receipt = parseTrialConvertReceipt(value);
  if (receipt.paymentStatus !== "PAID" || receipt.orderStatus !== "PAID") return invalid();
  return { status: "settled", receipt };
}

function isStructuredBalanceRefusal(cause: unknown): cause is ApiError {
  return cause instanceof ApiError && cause.kind === "http" && cause.code === cause.status
    && cause.message !== "PAYMENT_COMMAND_INPUT_CHANGED"
    && !/^(?:IDEMPOTENCY_|PAYMENT_COMMAND_)|(?:_UNKNOWN|_PROCESSING)$/.test(cause.message)
    && !AUTHORIZATION_REFUSALS.test(cause.message)
    && ((cause.code === 503 && BALANCE_SERVICE_REFUSALS.some(message => message === cause.message))
      || (cause.code !== undefined && cause.code >= 400 && cause.code < 500 && ![408, 425, 429].includes(cause.code)));
}

export function isTrialAuthorizationRefusal(message: string): boolean {
  return AUTHORIZATION_REFUSALS.test(message);
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
  const claimNo = text(row?.claimNo);
  const purchasedDevice = row?.purchasedDevice == null ? undefined : parseTrialPurchaseDevice(row.purchasedDevice);
  const settlement = row?.settlement != null ? parseTrialConversionQuote(row.settlement) : row ? receiptSettlement(row) : undefined;
  if (settlement === null || !/^TRC-[A-Z0-9]+$/.test(orderNo) || !productNo || amountUsdt === null || discountUsdt === null
      || !paymentStatus || !orderStatus || !source
      || row?.serverCanonical !== true || row?.sourceEnvironment !== "PRODUCTION" || row?.runId !== ""
      || provenance?.serverCanonical !== true || provenance.source !== source
      || provenance.sourceEnvironment !== "PRODUCTION" || provenance.runId !== "") return invalid();
  if (purchasedDevice && purchasedDevice.productNo !== productNo) return invalid();
  return { orderNo, ...(paymentNo ? { paymentNo } : {}), productNo, amountUsdt, discountUsdt,
    ...(claimNo ? { claimNo } : {}), ...(purchasedDevice ? { purchasedDevice } : {}),
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
    if (key === "trialProductId" && (typeof item !== "string" || !/^[A-Za-z0-9._-]{2,64}$/.test(item.trim()))) return invalid();
    if (key === "trialTermsVersion" && (typeof item !== "string" || !/^[a-f0-9]{64}$/.test(item))) return invalid();
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
  const originalPurchase = row.originalPurchase === null ? null
    : row.originalPurchase === undefined ? undefined : parseTrialOriginalPurchase(row.originalPurchase);
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
    ...(originalPurchase !== undefined ? { originalPurchase } : {}),
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
        if (cause instanceof ApiError && cause.kind === "http" && cause.status === 404 && cause.message !== "USER_NOT_FOUND")
          return { status: "unsupported" };
        if (isApiRefusal(cause, 409, "TRIAL_NOT_CONVERTIBLE")) return { status: "not-convertible" };
        throw cause;
      }
    },
    eligibility: () => parse({ method: "GET", path: "/api/trial/eligibility" }),
    async command(kind, commandKey) {
      const path = `/api/trial/commands/${kind}?commandKey=${encodeURIComponent(commandKey)}`;
      try {
        const row = record(await client.request({ method: "GET", path }));
        if (row?.kind !== kind || row.commandKey !== commandKey) return invalid();
        const { status } = row;
        if (status === "NOT_SEEN" || status === "PROCESSING" || status === "INDETERMINATE") return { status };
        const claimNo = text(row.claimNo);
        if (status === "SUCCEEDED" && claimNo) return { status, claimNo };
        const message = text(row.message);
        const code = row.code;
        if (status === "REJECTED" && message && typeof code === "number" && Number.isInteger(code) && code >= 400 && code < 500)
          return { status, code, message };
        return invalid();
      } catch (cause) {
        if (cause instanceof ApiError && cause.kind === "http"
            && (cause.status === 405 || (cause.status === 404 && cause.message !== "USER_NOT_FOUND")))
          return { status: "unsupported" };
        throw cause;
      }
    },
    start: (idempotencyKey, body) => parse({
      method: "POST",
      path: "/api/trial/start",
      body,
      idempotencyKey,
      retryAfterAuth: false,
    }),
    convert: async (...args) => parseTrialConvertReceipt(await client.request(convertRequest(...args))),
    async convertPurchase(...args) {
      if (!args[2].trim()) throw new Error("TRIAL_QUOTE_VERSION_REQUIRED");
      try {
        return await client.request<TrialPurchaseConvertResult>({
          ...convertRequest(...args),
          acceptedResponses: [...TRIAL_PRICE_CHANGES, ...BALANCE_ORIGINAL_CODES].map(message => ({ status: 409, code: 409, message })),
          parseResponseData: (data, _, { code, message }) => parseTrialPurchaseConvertResult(data, code, message),
        });
      } catch (cause) {
        if (isStructuredBalanceRefusal(cause)) return { status: "refused", reasonCode: cause.message };
        throw cause;
      }
    },
    cancel: (reason, idempotencyKey) => client.request<TrialCancelResult>({
      method: "POST",
      path: "/api/trial/cancel",
      body: { reason },
      idempotencyKey,
      retryAfterAuth: false,
      acceptedResponses: BALANCE_ORIGINAL_CODES.map(message => ({ status: 409, code: 409, message })),
      parseResponseData: (data, _, { code, message }): TrialCancelResult => code === 0
        ? { status: "cancelled", state: parseTrialAuthorityState(data) }
        : { status: "payment-in-progress", ...(message === "TRIAL_BALANCE_SUBMISSION_IN_PROGRESS"
          ? { originalPurchase: parseTrialOriginalPurchase(data) } : {}) },
    }),
  };
}
