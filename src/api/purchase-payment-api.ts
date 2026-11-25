import type { ApiClient, ApiRequest } from './api-client';
import { ApiError, isApiRefusal } from './errors';
import { validateHostedPaymentUrl } from '@/lib/hosted-payment';
import { isTronAddressValid } from '@/lib/tron-address';
import { ORDER_STATUSES, type CanonicalOrderStatus } from './order-api';
import { parseTrialChangedQuote, parseTrialOriginalPurchase, TRIAL_DEVICE_RESELECTION_CODES, TRIAL_PRICE_CHANGES, trialPriceChanged, type TrialConversionQuote, type TrialOriginalPurchase } from './trial-api';

export const purchaseKinds = ['ORDER_PAY', 'TRIAL_CONVERT', 'TRADE_IN', 'CAPACITY_REPLACE', 'CAPACITY_KEEP'] as const;
export type PurchaseKind = typeof purchaseKinds[number];
export type ExternalPaymentMethod = 'HDPAY_BANK' | 'CREGIS_USDT_BSC' | 'CREGIS_USDT_ERC20' | 'CREGIS_USDT_TRC20';
export type PurchaseMethod = 'WALLET' | ExternalPaymentMethod;
export type OrderTopupNetwork = 'BEP20' | 'ERC20';
export const orderTopupNetwork = (value: unknown): OrderTopupNetwork | null => value === 'BEP20' || value === 'ERC20' ? value : null;
export type OrderTopupIntent = { intentNo: string; paymentMethod: ExternalPaymentMethod; paymentAllowed: boolean };
export type OrderUsdtTopupRead = {
  orderNo: string; network: OrderTopupNetwork; state: 'PENDING' | 'PAID' | 'CLOSED'; canonicalStatus: CanonicalOrderStatus;
  payable: boolean; deadlineAt: string | null; amountDueUsdt: string; walletAvailableUsdt: string; shortfallUsdt: string;
  minDepositUsdt: string; depositFeeUsdt: string; suggestedTransferUsdt: string; blocker: 'NONE' | 'OPEN_INTENT' | 'NEEDS_REVIEW';
  openIntent: OrderTopupIntent | null; reviewReason: 'BANK_SESSION' | 'FINANCE_REVIEW' | null; paidAt: string | null; paidAmountUsdt: string | null;
};
const externalMethods: readonly string[] = ['HDPAY_BANK', 'CREGIS_USDT_BSC', 'CREGIS_USDT_ERC20', 'CREGIS_USDT_TRC20'];
type PurchaseFinancialSnapshot = { businessAmountUsdt?: string; roundingAdjustmentUsdt?: string; fxRateVndPerUsdt: string | null; feePolicyVersion: number;
  deadlineAt?: string; confirmationGraceEndsAt?: string };
export type PurchaseQuote = {
  paymentQuoteId: string; kind: PurchaseKind; paymentMethod: ExternalPaymentMethod; network: string | null;
  subtotalUsdt: string; channelFeeUsdt: string; networkConfirmFeeUsdt: string; totalUsdt: string;
  expiresAt: string; amountVnd: string | null;
} & PurchaseFinancialSnapshot;
export const purchasePaymentStatuses = ['CREATING', 'SUBMIT_UNKNOWN', 'AWAITING_PAYMENT', 'FUNDS_CONFIRMED', 'DELIVERED', 'MANUAL_REVIEW', 'EXPIRED'] as const;
export type PurchasePaymentStatus = typeof purchasePaymentStatuses[number];
export type TrialPurchaseOutcome = 'UNPAID_TERMINAL' | 'LATE_PAYMENT_REVIEW';
const trialOriginalCodes = ['TRIAL_BALANCE_SUBMISSION_IN_PROGRESS', 'PURCHASE_PAYMENT_EXISTING_INTENT_REQUIRED'] as const;
const trialRequoteCodes = ['PURCHASE_PAYMENT_FEE_POLICY_CHANGED', 'PURCHASE_PAYMENT_PRICING_CHANGED',
  'PURCHASE_PAYMENT_QUOTE_EXPIRED', 'PURCHASE_PAYMENT_QUOTE_ALREADY_USED', 'PURCHASE_PAYMENT_QUOTE_NOT_FOUND'] as const;
const trialRefusalCodes = {
  403: ['PURCHASE_PAYMENT_USER_UNAVAILABLE'],
  404: ['PURCHASE_PAYMENT_QUOTE_NOT_FOUND'],
  409: [...trialOriginalCodes, ...TRIAL_PRICE_CHANGES, ...trialRequoteCodes.filter(code => code !== 'PURCHASE_PAYMENT_QUOTE_NOT_FOUND'),
    ...TRIAL_DEVICE_RESELECTION_CODES, 'ZERO_PAYMENT_REQUIRES_WALLET', 'TRIAL_NOT_CONVERTIBLE', 'ORDER_PAYMENT_EXPIRED',
    'TRIAL_PRODUCT_NOT_AVAILABLE', 'TRIAL_KILL_SWITCH_DISABLED', 'TRIAL_EXTERNAL_PAYMENT_METHOD_UNSUPPORTED', 'TRIAL_AMOUNT_INVALID',
    'PRODUCT_OUT_OF_STOCK', 'PRODUCT_INVENTORY_MODE_INVALID', 'PRODUCT_SPECS_UNAVAILABLE', 'TRIAL_DAILY_YIELD_INVALID',
    'ORDER_MONTHLY_QUOTA_CONFLICT', 'ORDER_MONTHLY_QUOTA_EXHAUSTED', 'ORDER_MONTHLY_QUOTA_PAUSED', 'ORDER_MONTHLY_QUOTA_REQUIREMENTS_NOT_MET',
    'CREGIS_DIRECT_PAYMENT_PAUSED', 'CREGIS_DIRECT_ADDRESS_REQUIRES_REVIEW', 'CREGIS_DIRECT_ADDRESS_ALLOCATION_RETRY'],
  422: ['B1_COVERAGE_REDLINE_BLOCKED', 'PURCHASE_PAYMENT_KIND_INVALID', 'EXTERNAL_PAYMENT_CREDENTIAL_FORBIDDEN',
    'PURCHASE_PAYMENT_METHOD_INVALID', 'TRIAL_PRODUCT_REQUIRED', 'IDEMPOTENCY_KEY_REQUIRED'],
  503: ['ORDER_MONTHLY_QUOTA_UNAVAILABLE', 'TEST_CLOUD_RESOURCE_CAPACITY_UNAVAILABLE', 'PURCHASE_PAYMENT_FEES_NOT_CONFIGURED',
    'HDPAY_CONFIGURATION_INCOMPLETE', 'CREGIS_DIRECT_PAYMENT_UNAVAILABLE', 'CREGIS_DIRECT_PAYMENT_ASSET_UNAVAILABLE', 'FX_QUOTE_UNAVAILABLE',
    'CREGIS_DIRECT_ADDRESS_POOL_UNAVAILABLE', 'CREGIS_DIRECT_ALLOCATION_ANCHOR_INVALID'],
};
export function trialExternalRequote(message: string): boolean {
  return trialRequoteCodes.some(code => code === message);
}
export type TrialExternalRefusal =
  | { status: 'refused'; action: 'original'; originalPurchase: TrialOriginalPurchase }
  | { status: 'refused'; action: 'review'; reasonCode: string; quote?: TrialConversionQuote; claimNo?: string; productNo?: string }
  | { status: 'refused'; action: 'wallet' }
  | { status: 'refused'; action: 'unavailable'; reasonCode: string };
export type PurchasePaymentIntent = {
  intentNo: string; commandKey: string; paymentQuoteId: string; kind: PurchaseKind; paymentMethod: ExternalPaymentMethod;
  network: string | null; status: PurchasePaymentStatus; subtotalUsdt: string; channelFeeUsdt: string;
  networkConfirmFeeUsdt: string; totalUsdt: string; amountVnd: string | null; paymentUrl: string | null;
  address: string | null; expiresAt: string; reason: string | null; receipt: unknown;
  fulfilmentStatus?: 'DELIVERED' | 'NOT_DELIVERED';
  paymentAllowed?: boolean; expirationTime?: string; createdAt?: string;
  /** A refunded payment still reports MANUAL_REVIEW to user clients; refundStatus says it has ended. */
  refundStatus?: 'REFUNDED';
  trialPurchaseOutcome?: TrialPurchaseOutcome;
  claimNo?: string | null;
} & PurchaseFinancialSnapshot;
const invalid = () => new ApiError({ kind: 'protocol', message: 'PURCHASE_PAYMENT_RESPONSE_INVALID' });
const object = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid();
  return raw as Record<string, unknown>;
};
const text = (raw: unknown): string => { if (typeof raw !== 'string' || !raw.trim()) throw invalid(); return raw; };
const money = (raw: unknown): string => {
  if (typeof raw !== 'string' || !/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(raw)) throw invalid();
  return raw;
};
const micros = (value: string): bigint => {
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const units = BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  return value.startsWith('-') ? -units : units;
};
const timestamp = (raw: unknown): string => {
  const value = text(raw);
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw invalid();
  return value;
};
function common(raw: Record<string, unknown>) {
  if (!purchaseKinds.includes(raw.kind as PurchaseKind) || typeof raw.paymentMethod !== 'string'
    || !externalMethods.includes(raw.paymentMethod)) throw invalid();
  const paymentMethod = raw.paymentMethod as ExternalPaymentMethod;
  const network = raw.network == null ? null : text(raw.network);
  if (paymentMethod === 'CREGIS_USDT_BSC' && !['BSC', 'BEP20', 'USDT-BSC'].includes(network ?? '')) throw invalid();
  if (paymentMethod === 'CREGIS_USDT_ERC20' && network !== 'ERC20') throw invalid();
  if (paymentMethod === 'CREGIS_USDT_TRC20' && network !== 'TRC20') throw invalid();
  const amountVnd = raw.amountVnd == null ? null : text(raw.amountVnd);
  if (paymentMethod === 'HDPAY_BANK' && (!amountVnd || !/^[1-9]\d*$/.test(amountVnd))) throw invalid();
  const subtotalUsdt = money(raw.subtotalUsdt), channelFeeUsdt = money(raw.channelFeeUsdt), networkConfirmFeeUsdt = money(raw.networkConfirmFeeUsdt), totalUsdt = money(raw.totalUsdt);
  if (Number(totalUsdt) <= 0 || paymentMethod === 'HDPAY_BANK' && Number(networkConfirmFeeUsdt) !== 0) throw invalid();
  // Compare in integer cents; these checks validate a complete server quote, not client pricing.
  const cents = (v: string) => { const [whole, fraction = ''] = v.split('.'); return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0')); };
  if (cents(subtotalUsdt) + cents(channelFeeUsdt) + cents(networkConfirmFeeUsdt) !== cents(totalUsdt)) throw invalid();
  if (!Number.isSafeInteger(raw.feePolicyVersion) || Number(raw.feePolicyVersion) < 0) throw invalid();
  const fxRateVndPerUsdt = raw.fxRateVndPerUsdt == null ? null : text(raw.fxRateVndPerUsdt);
  if (paymentMethod === 'HDPAY_BANK' && (!fxRateVndPerUsdt || !/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(fxRateVndPerUsdt) || Number(fxRateVndPerUsdt) <= 0)) throw invalid();
  const businessAmountUsdt = raw.businessAmountUsdt, roundingAdjustmentUsdt = raw.roundingAdjustmentUsdt;
  if (businessAmountUsdt !== undefined || roundingAdjustmentUsdt !== undefined) {
    if (typeof businessAmountUsdt !== 'string' || !/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(businessAmountUsdt)
      || typeof roundingAdjustmentUsdt !== 'string' || !/^-?(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(roundingAdjustmentUsdt)
      || micros(businessAmountUsdt) + micros(roundingAdjustmentUsdt) !== micros(subtotalUsdt)
      || (micros(businessAmountUsdt) + 5000n) / 10000n !== cents(subtotalUsdt)) throw invalid();
  }
  const expiresAt = timestamp(raw.expiresAt);
  const timing: { deadlineAt?: string; confirmationGraceEndsAt?: string } = {};
  if (raw.deadlineAt !== undefined || raw.confirmationGraceEndsAt !== undefined) {
    timing.deadlineAt = timestamp(raw.deadlineAt);
    timing.confirmationGraceEndsAt = timestamp(raw.confirmationGraceEndsAt);
    if (Date.parse(expiresAt) > Date.parse(timing.deadlineAt)
      || Date.parse(timing.confirmationGraceEndsAt) - Date.parse(timing.deadlineAt) !== (paymentMethod === 'CREGIS_USDT_BSC' ? 3 : 5) * 60000) throw invalid();
  }
  return { kind: raw.kind as PurchaseKind, paymentMethod, network, subtotalUsdt, channelFeeUsdt, networkConfirmFeeUsdt, totalUsdt, amountVnd, ...timing,
    feePolicyVersion: Number(raw.feePolicyVersion), fxRateVndPerUsdt,
    ...(typeof businessAmountUsdt === 'string' && typeof roundingAdjustmentUsdt === 'string' ? { businessAmountUsdt, roundingAdjustmentUsdt } : {}),
    expiresAt, paymentQuoteId: text(raw.paymentQuoteId) };
}
export function parsePurchaseQuote(value: unknown): PurchaseQuote {
  return common(object(value));
}
export function parsePurchaseIntent(value: unknown): PurchasePaymentIntent {
  const raw = object(value), fields = common(raw);
  if (!purchasePaymentStatuses.includes(raw.status as PurchasePaymentStatus)) throw invalid();
  const paymentUrl = raw.paymentUrl == null ? null : text(raw.paymentUrl), address = raw.address == null ? null : text(raw.address);
  if (paymentUrl && (fields.paymentMethod !== 'HDPAY_BANK' || !validateHostedPaymentUrl(paymentUrl))) throw invalid();
  if (address && (fields.paymentMethod === 'HDPAY_BANK'
    || !(fields.paymentMethod === 'CREGIS_USDT_TRC20' ? isTronAddressValid(address) : /^0x[0-9a-fA-F]{40}$/.test(address)))) throw invalid();
  if ((raw.status === 'DELIVERED' || raw.fulfilmentStatus === 'DELIVERED') && (!raw.receipt || typeof raw.receipt !== 'object')) throw invalid();
  if (raw.paymentAllowed !== undefined && (typeof raw.paymentAllowed !== 'boolean' || !fields.deadlineAt)) throw invalid();
  const expirationTime = raw.expirationTime === undefined ? undefined : timestamp(raw.expirationTime);
  const createdAt = raw.createdAt == null ? undefined : timestamp(raw.createdAt);
  if (expirationTime && fields.paymentMethod !== 'HDPAY_BANK') throw invalid();
  return { ...fields, intentNo: text(raw.intentNo), commandKey: text(raw.commandKey), status: raw.status as PurchasePaymentStatus,
    paymentUrl, address, reason: raw.reason == null || typeof raw.reason === 'string' && !raw.reason.trim() ? null : text(raw.reason), receipt: raw.receipt ?? null,
    ...(raw.fulfilmentStatus === 'DELIVERED' || raw.fulfilmentStatus === 'NOT_DELIVERED' ? { fulfilmentStatus: raw.fulfilmentStatus } : {}),
    ...(raw.paymentAllowed !== undefined ? { paymentAllowed: raw.paymentAllowed as boolean } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(raw.refundStatus === 'REFUNDED' ? { refundStatus: 'REFUNDED' as const } : {}),
    ...(fields.kind === 'TRIAL_CONVERT' && (raw.claimNo === null || typeof raw.claimNo === 'string') ? { claimNo: raw.claimNo } : {}),
    ...(fields.kind === 'TRIAL_CONVERT'
      && (raw.status === 'MANUAL_REVIEW' && raw.trialPurchaseOutcome === 'LATE_PAYMENT_REVIEW'
        || raw.status === 'EXPIRED' && raw.trialPurchaseOutcome === 'UNPAID_TERMINAL') ? { trialPurchaseOutcome: raw.trialPurchaseOutcome } : {}),
    ...(expirationTime ? { expirationTime } : {}) };
}
function parseOrderTopup(value: unknown, orderNo: string, network: OrderTopupNetwork): OrderUsdtTopupRead {
  const raw = object(value);
  const { state, canonicalStatus, payable, blocker, reviewReason } = raw;
  if (raw.orderNo !== orderNo || raw.network !== network || !ORDER_STATUSES.includes(canonicalStatus as CanonicalOrderStatus)
      || (state !== 'PENDING' && state !== 'PAID' && state !== 'CLOSED') || typeof payable !== 'boolean'
      || (blocker !== 'NONE' && blocker !== 'OPEN_INTENT' && blocker !== 'NEEDS_REVIEW')) throw invalid();
  if (state !== 'PENDING' && (payable || blocker !== 'NONE') || payable && blocker !== 'NONE') throw invalid();
  if (blocker === 'NEEDS_REVIEW' ? reviewReason !== 'BANK_SESSION' && reviewReason !== 'FINANCE_REVIEW' : reviewReason !== null) throw invalid();
  const deadlineAt = raw.deadlineAt === null ? null : timestamp(raw.deadlineAt);
  if ((state === 'PENDING') !== (deadlineAt !== null) || state !== 'PAID' && (raw.paidAt !== null || raw.paidAmountUsdt !== null)) throw invalid();
  let openIntent: OrderTopupIntent | null = null;
  if (blocker === 'OPEN_INTENT') {
    const intent = object(raw.openIntent);
    if (typeof intent.paymentMethod !== 'string' || !externalMethods.includes(intent.paymentMethod) || typeof intent.paymentAllowed !== 'boolean') throw invalid();
    openIntent = { intentNo: text(intent.intentNo), paymentMethod: intent.paymentMethod as ExternalPaymentMethod, paymentAllowed: intent.paymentAllowed };
  } else if (raw.openIntent !== null) throw invalid();
  const decimal = (amount: unknown, signed = false) => {
    if (typeof amount !== 'string' || !/^\d+(?:\.\d+)?$/.test(signed ? amount.replace(/^-/, '') : amount)) throw invalid();
    return amount;
  };
  return { orderNo, network, state, canonicalStatus: canonicalStatus as CanonicalOrderStatus, payable, blocker, openIntent,
    reviewReason: reviewReason as OrderUsdtTopupRead['reviewReason'], deadlineAt,
    paidAt: raw.paidAt === null ? null : timestamp(raw.paidAt), paidAmountUsdt: raw.paidAmountUsdt === null ? null : decimal(raw.paidAmountUsdt),
    amountDueUsdt: decimal(raw.amountDueUsdt), walletAvailableUsdt: decimal(raw.walletAvailableUsdt, true), shortfallUsdt: decimal(raw.shortfallUsdt),
    minDepositUsdt: decimal(raw.minDepositUsdt), depositFeeUsdt: decimal(raw.depositFeeUsdt), suggestedTransferUsdt: decimal(raw.suggestedTransferUsdt) };
}
export function createPurchasePaymentApi(client: ApiClient) {
  const base = '/api/app/purchase-payment';
  function trialRequest<T>(request: ApiRequest, parse: (data: unknown) => T) {
    return client.request<T | TrialExternalRefusal>({
      ...request,
      acceptedResponses: Object.entries(trialRefusalCodes).flatMap(([code, messages]) =>
        messages.map(message => ({ status: Number(code), code: Number(code), message }))),
      parseResponseData(data, _, { code, message }): T | TrialExternalRefusal {
        if (code === 0) return parse(data);
        if (trialOriginalCodes.some(value => value === message))
          return { status: 'refused', action: 'original', originalPurchase: parseTrialOriginalPurchase(data) };
        if (trialPriceChanged(message)) return { status: 'refused', action: 'review', reasonCode: message, ...parseTrialChangedQuote(data) };
        if (trialExternalRequote(message)) return { status: 'refused', action: 'review', reasonCode: message };
        if (message === 'ZERO_PAYMENT_REQUIRES_WALLET') return { status: 'refused', action: 'wallet' };
        return { status: 'refused', action: 'unavailable', reasonCode: message };
      },
    });
  }
  return {
    /** Which external channels operations have configured; unlisted channels count as unavailable. */
    async policy() {
      const raw = object(await client.request({ path: `${base}-policy` }));
      if (!Array.isArray(raw.channels)) throw invalid();
      const channels: Partial<Record<ExternalPaymentMethod, boolean>> = Object.fromEntries(raw.channels.map(value => {
        const row = object(value);
        if (typeof row.paymentMethod !== 'string' || typeof row.configured !== 'boolean') throw invalid();
        return [row.paymentMethod, row.configured];
      }));
      return { channels, orderPayUsdtRoute: typeof raw.orderPayUsdtRoute === 'string' ? raw.orderPayUsdtRoute : null };
    },
    async orderTopup(orderNo: string, network: OrderTopupNetwork) {
      return parseOrderTopup(await client.request({ path: `/api/app/orders/${encodeURIComponent(orderNo)}/usdt-topup?network=${network}` }), orderNo, network);
    },
    async quote(kind: PurchaseKind, paymentMethod: ExternalPaymentMethod, payload: Record<string, unknown>) {
      return parsePurchaseQuote(await client.request({ method: 'POST', path: `${base}-quotes`, body: { kind, paymentMethod, payload } }));
    },
    trialQuote(paymentMethod: ExternalPaymentMethod, payload: Record<string, unknown>) {
      if (typeof payload.quoteVersion !== 'string' || !payload.quoteVersion.trim())
        return Promise.reject(new ApiError({ kind: 'protocol', message: 'TRIAL_QUOTE_VERSION_REQUIRED' }));
      return trialRequest({ method: 'POST', path: `${base}-quotes`, body: { kind: 'TRIAL_CONVERT', paymentMethod, payload } }, parsePurchaseQuote);
    },
    async create(paymentQuoteId: string, commandKey: string) {
      return parsePurchaseIntent(await client.request({ method: 'POST', path: `${base}-intents`, body: { paymentQuoteId }, idempotencyKey: commandKey, retryAfterAuth: false }));
    },
    trialCreate(paymentQuoteId: string, commandKey: string) {
      return trialRequest({ method: 'POST', path: `${base}-intents`, body: { paymentQuoteId }, idempotencyKey: commandKey, retryAfterAuth: false }, parsePurchaseIntent);
    },
    async get(intentNo: string) {
      try { return parsePurchaseIntent(await client.request({ path: `${base}-intents/${encodeURIComponent(intentNo)}` })); }
      catch (error) { if (isApiRefusal(error, 404, 'PURCHASE_PAYMENT_INTENT_NOT_FOUND')) return null; throw error; }
    },
    async snapshot(intentNo: string) {
      try { return parsePurchaseIntent(await client.request({ path: `${base}-intents/snapshots/${encodeURIComponent(intentNo)}` })); }
      catch (error) { if (isApiRefusal(error, 404, 'PURCHASE_PAYMENT_INTENT_NOT_FOUND')) return null; throw error; }
    },
    async activeByOrder(orderNo: string): Promise<string | null> {
      const data = object(await client.request({ path: `${base}-intents/by-order/${encodeURIComponent(orderNo)}` }));
      if (data.orderNo !== orderNo) throw invalid();
      if (data.state === 'NONE' && data.intentNo === null) return null;
      if (data.state === 'IN_PROGRESS') return text(data.intentNo);
      throw invalid();
    },
    async find(kind: PurchaseKind, commandKey: string) {
      try { return parsePurchaseIntent(await client.request({ path: `${base}-intents?kind=${encodeURIComponent(kind)}&commandKey=${encodeURIComponent(commandKey)}` })); }
      // Only the server's own not-found proves there is no intent; any other 404 keeps the original command.
      catch (error) { if (isApiRefusal(error, 404, 'PURCHASE_PAYMENT_INTENT_NOT_FOUND')) return null; throw error; }
    },
    async findTrial(commandKey: string, structuredRefusals: boolean): Promise<{
      result: PurchasePaymentIntent | TrialExternalRefusal | null; notFoundAt?: number;
    }> {
      const request = { path: `${base}-intents?kind=TRIAL_CONVERT&commandKey=${encodeURIComponent(commandKey)}` };
      try {
        const result = structuredRefusals ? await trialRequest(request, parsePurchaseIntent)
          : parsePurchaseIntent(await client.request(request));
        return { result };
      } catch (error) {
        if (error instanceof ApiError && isApiRefusal(error, 404, 'PURCHASE_PAYMENT_INTENT_NOT_FOUND')) {
          return { result: null, notFoundAt: error.responseDateMs };
        }
        throw error;
      }
    },
  };
}
