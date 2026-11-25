import { reactive, type InjectionKey, type Ref } from 'vue';
import { canSelectNewUsdtNetwork, isVisibleUsdtNetwork } from '@/lib/usdt-network-options';
import { cregisDepositApi as deposits, purchasePaymentApi as api, purchaseEligibilityApi } from '@/api/runtime';
import { asApiError, isApiRefusal, type ApiError } from '@/api/errors';
import { trialExternalRequote, type TrialPurchaseOutcome, type ExternalPaymentMethod, type OrderTopupIntent, type PurchaseKind, type PurchaseMethod, type PurchasePaymentIntent, type PurchaseQuote, type TrialExternalRefusal } from '@/api/purchase-payment-api';
import { parseTrialConvertReceipt } from '@/api/trial-api';
import type { PaymentCommandReceipt } from '@/api/payment-command-api';
import { useApp } from './app';
import { useOrders, type Order } from './orders';
import { readAccountRow, writeAccountRow, acquireAccountCommandKey, releaseAccountCommandKey } from './account-scoped-storage';
import { clearOrderAction, readOrderAction } from '@/lib/order-command-fence';
import { navTo, navReplace, navBack } from '@/lib/route';
import { formatAmount } from '@/lib/amount-display';
import { validatePurchasePaymentReceipt } from '@/lib/purchase-payment-receipt';
import { legacyTrialExternalMatches, PURCHASE_PAYMENT_RECORDS_TABLE, releasePurchaseCallerRecord } from '@/lib/purchase-caller-record';
import { isTrialPaymentReviewPending, isUnpaidPaymentTerminal, purchasePaymentTiming } from '@/lib/purchase-payment-timing';
import { originalTrialCheckoutHref } from '@/lib/trial-topup-return';
import { useTrialCheckout } from './trial-checkout';
import { useTrialPurchaseOptions } from './trial-purchase-options';
import { useFreeTrial } from './free-trial';
import { orderTopupHref } from '@/lib/order-usdt-topup';
import { appReadOnline, foregroundReadAllowed } from '@/lib/foreground-read';
import { tradeinPaymentRejection, TRADEIN_RUNTIME_RECOVERING } from '@/lib/order-payment-rejection';
import { getT } from '@/i18n/use-t';
import { toast } from './ui';
import { useLocaleStore } from './locale';
import { purchasePaymentCopy } from '@/lib/purchase-payment-copy';
import { checkoutFlowCopy } from '@/lib/checkout-flow-copy';

/** Height of the page's floating payment bar, 0 while it is hidden. The bar measures itself and writes it; the chassis
 *  only reads it to lift the support shortcut and pad the content, so the two never measure each other. */
export const PAYMENT_BAR_HEIGHT_KEY: InjectionKey<Ref<number>> = Symbol('nx-payment-bar-height');
export const TRIAL_PAYMENT_CARD_KEY: InjectionKey<() => string | null> = Symbol('nx-trial-payment-card');
/** `orderNo`, `deadlineAt` and `image` only feed the payment screens; `reorder` runs after a timed-out order. */
export type PurchasePaymentContext = { kind: PurchaseKind; payload: Record<string, unknown>; amount: number | string; summary: string; current: () => boolean; commandKey?: () => string;
  scopeCurrent?: () => boolean;
  /** The server allowed resuming an existing wallet command with its original key. */
  walletOnly?: boolean;
  paymentMethods?: readonly PurchaseMethod[];
  /** Recheck order facts after any read already in flight. */
  checkCurrent?: (method: PurchaseMethod) => Promise<PurchaseContextCheck>;
  topupHref?: (shortfall: number) => string | undefined;
  claimNo?: string;
  legacyTrialExpiry?: boolean;
  onTrialRefusal?: (refusal: TrialExternalRefusal) => void;
  onTrialWalletRequired?: () => void;
  onTrialSubmit?: (submission: { claimNo: string; key: string }) => void;
  refusedPaymentKey?: string; tradeinKey?: string; onReplacementRefused?: (reason: NonNullable<ReturnType<typeof tradeinPaymentRejection>>) => void; orderNo?: string; deadlineAt?: number | null; image?: string; reorder?: () => void; navigate?: (href: string, replace?: boolean) => void };
export type PurchaseContextCheck = 'current' | 'changed' | 'abandoned' | 'wallet-required';
type PendingExternal = { fingerprint: string; kind: PurchaseKind; commandKey: string; paymentQuoteId: string;
  paymentMethod?: PurchaseQuote['paymentMethod']; network?: PurchaseQuote['network'];
  intentNo?: string; lookupOnly?: boolean; resumedOnThisDevice?: boolean; useOrderTopup?: boolean; quotaRefusal?: DefinitePaymentNotice; summary: string; startedAt?: number;
  orderDeadlineAt?: number; hiddenOrder?: { sku: string; imageUrl?: string; total: Order['total']; placedAt?: number };
  lastStatus?: string; validated?: boolean; businessDelivered?: boolean;
  claimNo?: string; legacyTrialExpiry?: boolean; expiryConfirmed?: boolean;
  structuredTrialRefusals?: boolean; trialPurchaseOutcome?: TrialPurchaseOutcome; trialCreateRefusal?: TrialExternalRefusal;
  quoteExpiresAt?: number };
type PendingRow = { records: Record<string, PendingExternal> };
export type PurchaseChoice = { method: 'WALLET' } | { method: 'EXTERNAL'; receipt: unknown; commandKey: string; accountKey: string };
export type PurchaseStep = 'methods' | 'network' | 'bank';
type DefinitePaymentNotice = 'rejectQuotaPaused' | 'rejectQuotaMonthFull' | 'rejectQuotaSoldOut' | 'rejectConditionsUnmet' | 'rejectGateConditionsUnmet' | 'rejectPurchaseSetup' | 'trialConversionClosed' | 'trialNotConvertible';
type EligibilityRetry = 'rejectEligibilityUnavailable';
export type PurchaseNotice = '' | 'keepOrder' | 'reminder' | 'timeShort' | 'timeout' | 'bankFailed' | 'review' | 'late' | 'refunded' | 'delivery' | 'leave' | 'changed' | 'quoteChanged' | 'orderExpired' | 'orderClosed' | 'orderMissing' | 'gone' | 'networkPaused' | 'existing' | 'originalUnavailable' | 'rejectTradeinBusy' | 'rejectTradeinWalletOnly' | 'rejectTradeinOwner' | 'rejectCapacitySourceChanged' | 'rejectCapacityPurchaseRetired' | DefinitePaymentNotice;
const TABLE = PURCHASE_PAYMENT_RECORDS_TABLE, KEYS = 'uvel-purchase-payment-keys-accounts-v1';
const POLL_MS = 5000, POLL_BACKOFF = [5000, 10000, 20000, 30000], SHORT_DEADLINE_MS = 5 * 60000;
const REVIEW_POLL_MS = 60000;
const REVIEW_REASONS = ['PAYMENT_AMOUNT_MISMATCH', 'PAYMENT_MULTIPLE_ARRIVALS', 'PAYMENT_BEFORE_ALLOCATION', 'PAYMENT_REORG_REVIEW', 'PAYMENT_TIME_UNVERIFIED', 'PAYMENT_REFUNDED_REVIEW'];
// Another payment for this purchase is still open, perhaps from another device: say so rather than asking to review the order.
const ORDER_REFUSALS: Record<string, PurchaseNotice> = { ORDER_PAYMENT_EXPIRED: 'orderExpired', ORDER_NOT_PAYABLE: 'orderClosed', ORDER_NOT_FOUND: 'orderMissing', PURCHASE_PAYMENT_EXISTING_INTENT_REQUIRED: 'existing' };
const TRIAL_REFUSALS = ['TRIAL_QUOTE_CHANGED', 'TRIAL_AMOUNT_MISMATCH'];
function isTerminalTrialRequote(reason: string) {
  return reason !== 'PURCHASE_PAYMENT_QUOTE_ALREADY_USED'
    && (trialExternalRequote(reason) || TRIAL_REFUSALS.includes(reason));
}
function paymentRefusalNotice(cause: ApiError, kind: PurchaseKind): DefinitePaymentNotice | EligibilityRetry | undefined {
  if (cause.kind !== 'http' || cause.status !== cause.code) return;
  if (cause.status === 409) {
    switch (cause.message) {
      case 'ORDER_MONTHLY_QUOTA_PAUSED': return 'rejectQuotaPaused';
      case 'ORDER_MONTHLY_QUOTA_REQUIREMENTS_NOT_MET': return 'rejectConditionsUnmet';
      case 'ORDER_MONTHLY_QUOTA_EXHAUSTED': return 'rejectQuotaMonthFull';
      case 'ORDER_MONTHLY_QUOTA_CONFLICT': return kind === 'TRIAL_CONVERT' ? 'rejectQuotaMonthFull' : undefined;
      case 'PURCHASE_GATE_BLOCKED':
      case 'PURCHASE_GATE_NOT_MET': return kind === 'ORDER_PAY' ? 'rejectGateConditionsUnmet' : undefined;
      case 'PURCHASE_GATE_SOLD_OUT': return kind === 'ORDER_PAY' ? 'rejectQuotaSoldOut' : undefined;
      case 'PURCHASE_GATE_INVALID': return kind === 'ORDER_PAY' ? 'rejectPurchaseSetup' : undefined;
      case 'TRIAL_KILL_SWITCH_DISABLED': return kind === 'TRIAL_CONVERT' ? 'trialConversionClosed' : undefined;
      case 'TRIAL_NOT_CONVERTIBLE': return kind === 'TRIAL_CONVERT' ? 'trialNotConvertible' : undefined;
    }
  }
  if (cause.status === 503 && cause.message === 'ORDER_MONTHLY_QUOTA_UNAVAILABLE') return 'rejectEligibilityUnavailable';
  if (cause.status === 503 && kind === 'ORDER_PAY' && cause.message === 'PURCHASE_GATE_FACTS_UNAVAILABLE') return 'rejectEligibilityUnavailable';
  if (cause.status === 403 && kind !== 'ORDER_PAY' && kind !== 'TRIAL_CONVERT') {
    switch (cause.message) {
      case 'PURCHASE_GATE_SOLD_OUT': return 'rejectQuotaSoldOut';
      case 'PURCHASE_GATE_NOT_MET': return 'rejectGateConditionsUnmet';
      case 'PURCHASE_GATE_INVALID':
      case 'PURCHASE_GATE_FACTS_INVALID': return 'rejectPurchaseSetup';
      case 'PURCHASE_GATE_FACTS_UNAVAILABLE': return 'rejectEligibilityUnavailable';
    }
  }
}
const state = reactive({ open: false, coldResume: false, accountKey: '', summary: '', amount: '' as string | number, method: 'WALLET' as PurchaseMethod, walletOnly: false,
  step: 'methods' as PurchaseStep, kind: 'ORDER_PAY' as PurchaseKind, orderNo: '', productNo: '', image: '', deadlineAt: null as number | null,
  policy: null as Partial<Record<ExternalPaymentMethod, boolean>> | null, orderPayUsdtRoute: null as string | null,
  orderTopupNetworks: [] as ExternalPaymentMethod[], notice: '' as PurchaseNotice, cashier: false,
  retryNotice: '' as '' | EligibilityRetry,
  pausedPaymentMethod: null as ExternalPaymentMethod | null,
  quote: null as PurchaseQuote | null, intent: null as PurchasePaymentIntent | null, pending: null as PendingExternal | null,
  originalRecovery: null as { intentNo: string; kind: PurchaseKind; fingerprint: string; summary: string } | null,
  orderTopupIntent: null as OrderTopupIntent | null,
  loading: false, retrying: false, reading: false, busy: false, canResubmit: false, pendingReadError: false, concluded: false, revision: 0 });
// Detail can discover the original payment in another H5 tab while checkout and its floating bar stay mounted.
// #ifdef H5
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.storageArea === window.localStorage && event.key === TABLE) state.revision++;
});
// #endif
let context: PurchasePaymentContext | null = null;
let reviewedQuote: PurchaseQuote | null = null, confirmedQuote: PurchaseQuote | null = null;
let activeChoice: { promise: Promise<PurchaseChoice | null>; resolve: (result: PurchaseChoice | null) => void; onExpired?: () => void; onTerminalDismiss?: () => void } | null = null;
let requestVersion = 0, quoteFailures = 0, pollFailures = 0, paused = false, openCashierOnReady = false;
let activeTrialRefreshPending = false;
let policyVersion = 0;
let policyRead: Promise<void> | null = null;
let accountBindingEpoch = 0;
let quoteTimer: ReturnType<typeof setTimeout> | undefined, pollTimer: ReturnType<typeof setTimeout> | undefined;
const releaseListeners = new Set<(accountKey: string, commandKey: string) => void>();
const unsavedExpiries = new Map<string, Map<string, PurchaseKind>>();
/** A page holding its own copy of a payment's record hears when the server no longer holds that payment. */
export function onPurchaseRecordReleased(listener: (accountKey: string, commandKey: string) => void) {
  releaseListeners.add(listener);
  return () => { releaseListeners.delete(listener); };
}
const account = () => useApp().accountKey;
function rows(accountKey = account()): PendingRow { return readAccountRow<PendingRow>(TABLE, accountKey, true) ?? { records: {} }; }
function save(pending: PendingExternal, accountKey = state.accountKey) {
  const value = rows(accountKey);
  const previous = value.records[pending.commandKey];
  const record = { ...pending, startedAt: previous?.startedAt ?? pending.startedAt,
    claimNo: pending.claimNo ?? previous?.claimNo,
    structuredTrialRefusals: pending.structuredTrialRefusals ?? previous?.structuredTrialRefusals,
    resumedOnThisDevice: pending.resumedOnThisDevice ?? previous?.resumedOnThisDevice,
    orderDeadlineAt: pending.orderDeadlineAt ?? previous?.orderDeadlineAt,
    quoteExpiresAt: pending.quoteExpiresAt ?? previous?.quoteExpiresAt,
    hiddenOrder: pending.hiddenOrder ?? previous?.hiddenOrder };
  if (!writeAccountRow(TABLE, accountKey, { records: { ...value.records, [pending.commandKey]: record } })) throw new Error('ACCOUNT_COMMAND_STORAGE_UNAVAILABLE');
  if (!isExpiredPaymentRecord(record)) {
    const expired = unsavedExpiries.get(accountKey);
    expired?.delete(record.commandKey);
    if (expired && !expired.size) unsavedExpiries.delete(accountKey);
  }
  state.revision++;
}
function saveExpiry(accountKey: string, commandKey: string, kind: PurchaseKind, observed?: PendingExternal) {
  // uni storage can return an empty table on read failure. Publish the server's
  // result for this row before trying to update its durable projection.
  const expired = unsavedExpiries.get(accountKey) ?? new Map<string, PurchaseKind>();
  const newlyObserved = expired.get(commandKey) !== kind;
  if (newlyObserved) {
    expired.set(commandKey, kind);
    unsavedExpiries.set(accountKey, expired);
    state.revision++;
  }
  try {
    const record = rows(accountKey).records[commandKey];
    if (record?.kind !== kind) return;
    closeTrialPaymentCaller(record, accountKey);
    if (observed || record.lastStatus !== 'EXPIRED') {
      save({ ...(observed ?? record), lastStatus: 'EXPIRED', expiryConfirmed: true }, accountKey);
    }
    expired.delete(commandKey);
    if (!expired.size) unsavedExpiries.delete(accountKey);
  } catch {
    if (newlyObserved) toast.error(getT().errors.txNotSavedTitle);
  }
}

/** Records the server's expiry of the original trade-in payment without reopening it. */
export function markTradeinPurchaseExpired(accountKey: string, commandKey: string) {
  saveExpiry(accountKey, commandKey, 'TRADE_IN');
}
function retire(pending: PendingExternal, accountKey: string) {
  const records = { ...rows(accountKey).records }; delete records[pending.commandKey];
  if (!writeAccountRow(TABLE, accountKey, { records })) throw new Error('ACCOUNT_COMMAND_STORAGE_UNAVAILABLE');
  releaseAccountCommandKey(KEYS, accountKey, pending.fingerprint, pending.commandKey);
  state.revision++;
}
/** Ends this intent's record and, when it was the order's payment key, renews that key. */
function release(pending: PendingExternal, accountKey: string, orderNo: string) {
  const orderKey = pending.kind === 'ORDER_PAY' && !!orderNo && readOrderAction(accountKey, orderNo)?.key === pending.commandKey;
  retire(pending, accountKey);
  if (orderKey) clearOrderAction(accountKey, orderNo, pending.commandKey, true);
  return orderKey;
}
function fingerprint(value: PurchasePaymentContext): string {
  const stable = (raw: unknown): unknown => raw && typeof raw === 'object' && !Array.isArray(raw)
    ? Object.fromEntries(Object.keys(raw).sort().map(key => [key, stable((raw as Record<string, unknown>)[key])]))
    : Array.isArray(raw) ? raw.map(stable) : raw;
  const scope = [value.kind, stable(value.payload)];
  if (value.kind === 'TRIAL_CONVERT' && value.claimNo) scope.push(value.claimNo);
  return JSON.stringify(scope);
}
function closeTrialPaymentCaller(row: PendingExternal, accountKey: string) {
  if (row.kind !== 'TRIAL_CONVERT') return;
  releasePurchaseCallerRecord(accountKey, row.kind, row.commandKey);
  releaseAccountCommandKey(KEYS, accountKey, row.fingerprint, row.commandKey);
}
function owns(version: number, accountKey: string) {
  return state.open && requestVersion === version && account() === accountKey && state.accountKey === accountKey
    && useApp().accountBindingEpoch === accountBindingEpoch;
}
function matches(intent: PurchasePaymentIntent, pending: PendingExternal) {
  if (intent.commandKey !== pending.commandKey || intent.kind !== pending.kind || intent.paymentQuoteId !== pending.paymentQuoteId
    || pending.paymentMethod !== undefined && intent.paymentMethod !== pending.paymentMethod
    || pending.network !== undefined && intent.network !== pending.network
    || pending.intentNo && intent.intentNo !== pending.intentNo
    || intent.claimNo && paymentRecordClaimNo(pending) && intent.claimNo !== paymentRecordClaimNo(pending)) throw new Error('PURCHASE_PAYMENT_RESPONSE_INVALID');
}
function readIntent(pending: PendingExternal) {
  if (!pending.intentNo) return api.find(pending.kind, pending.commandKey);
  return pending.lookupOnly ? api.snapshot(pending.intentNo) : api.get(pending.intentNo);
}
function isVisiblePayment(row: Pick<PendingExternal, 'paymentMethod' | 'network'>): boolean {
  return isVisibleUsdtNetwork(row.paymentMethod) && isVisibleUsdtNetwork(row.network);
}
function hideOriginalPayment(accountKey: string, pending: PendingExternal, intent: PurchasePaymentIntent): void {
  if (pending.commandKey !== intent.commandKey || pending.kind !== intent.kind || pending.paymentQuoteId !== intent.paymentQuoteId) return;
  try {
    save({ ...pending, paymentMethod: intent.paymentMethod, network: intent.network, intentNo: intent.intentNo }, accountKey);
  } catch { /* Keep the read silent if storage is unavailable. */ }
}
function displayRecords() {
  state.revision;
  const accountKey = account();
  const expired = unsavedExpiries.get(accountKey);
  return Object.values(rows(accountKey).records).filter(row => !row.quotaRefusal && isVisiblePayment(row)).map(row => expired?.get(row.commandKey) === row.kind
    ? { ...row, lastStatus: 'EXPIRED', expiryConfirmed: true } : row);
}
function pendingPayments() {
  try {
    const records = displayRecords();
    state.pendingReadError = false;
    return records.filter(row => !isReleasedLateTrialPayment(row) && !isExpiredPaymentRecord(row) && row.lastStatus !== 'REFUNDED' && !(row.lastStatus === 'DELIVERED' && row.validated));
  } catch {
    state.pendingReadError = true;
    return [];
  }
}
export function unfinishedPurchasePayments(records = pendingPayments()) {
  return records.filter(isUnfinishedPurchaseRecord);
}

export function trialExternalCreatePending(claimNo: string | null | undefined): boolean {
  return !!claimNo && pendingPayments().some(row => row.kind === 'TRIAL_CONVERT' && paymentRecordClaimNo(row) === claimNo
    && unsettledTrialExternalCreate(row));
}

function unsettledTrialExternalCreate(row: PendingExternal): boolean {
  return isUnfinishedPurchaseRecord(row) && (!row.intentNo || row.lastStatus === 'CREATING' || row.lastStatus === 'SUBMIT_UNKNOWN');
}

export function hasUnsettledTrialExternalSubmission(): boolean {
  void state.revision;
  try { return Object.values(rows().records).some(row => row.kind === 'TRIAL_CONVERT' && unsettledTrialExternalCreate(row)); }
  catch { return true; }
}

export function trialExternalPaymentActive(claimNo: string): boolean {
  return pendingPayments().some(row => row.kind === 'TRIAL_CONVERT' && paymentRecordClaimNo(row) === claimNo
    && isUnfinishedPurchaseRecord(row));
}

function canReleaseUncreatedTrialPayment(row: PendingExternal, notFoundAt?: number) {
  return typeof row.quoteExpiresAt === 'number' && Number.isFinite(row.quoteExpiresAt)
    && notFoundAt !== undefined && notFoundAt >= row.quoteExpiresAt + 60_000;
}

function finishUncreatedTrialPayment(pending: PendingExternal, accountKey: string) {
  releaseMissingPayment(pending, accountKey, '');
  const locale = useLocaleStore().code;
  toast.warn(purchasePaymentCopy(locale).originalPaymentUnavailableTitle, checkoutFlowCopy(locale).noCharge);
}

export function unfinishedOrderPayment(orderNo: string) {
  return unfinishedPurchasePayments().find(row => row.kind === 'ORDER_PAY' && purchaseRecordPayload(row).orderNo === orderNo);
}
// Rows closed on the floating bar, for this run of the App only. The records stay; a new payment or a new status shows again.
const dismissedResume = reactive(new Set<string>());
// Only entering manual confirmation brings a closed payment back (PRD 购买付款流程 line 50); other status changes do not.
const resumeKey = (row: PendingExternal) => [account(), row.commandKey, row.lastStatus === 'MANUAL_REVIEW' ? 'MANUAL_REVIEW' : '', row.businessDelivered ? 1 : 0].join('|');
function unsettledCheckoutPayments(includeTradein: boolean) {
  return pendingPayments().filter(row => (row.kind === 'ORDER_PAY' || (includeTradein && row.kind === 'TRADE_IN'))
    && row.lastStatus !== 'MANUAL_REVIEW' && row.lastStatus !== 'DELIVERED' && !row.businessDelivered);
}

/** The progress bar can outlive both a closed payment layer and a released checkout pointer. */
// Checkout, the floating bar and Orders share one passive read, at most every 10 seconds.
let passiveRead: Promise<unknown> | null = null, passiveReadAt = 0;
function sharedPassiveRead(run: () => Promise<unknown>): Promise<unknown> {
  if (passiveRead || Date.now() - passiveReadAt < 10_000) return passiveRead ?? Promise.resolve();
  passiveRead = run().finally(() => { passiveRead = null; passiveReadAt = Date.now(); });
  return passiveRead;
}
/** Read the currently displayed payments and project their latest confirmed result. */
export function refreshPendingPayments(accountKey: string, current: () => boolean, shouldRead: (row: PendingExternal) => boolean = () => true,
  includeExpiredOrderPayments = false): Promise<unknown> {
  if (!current() || account() !== accountKey || state.open) return passiveRead ?? Promise.resolve();
  const app = useApp();
  const binding = app.accountBindingEpoch;
  const sameAccount = () => app.accountKey === accountKey && app.accountBindingEpoch === binding;
  let candidates: PendingExternal[];
  try { candidates = includeExpiredOrderPayments ? displayRecords() : pendingPayments(); }
  catch { return Promise.resolve(); }
  const records = candidates.filter(row => row.lastStatus !== 'DELIVERED' && !row.businessDelivered && shouldRead(row));
  if (!records.length) return passiveRead ?? Promise.resolve();
  return sharedPassiveRead(() => Promise.allSettled(records.map(async pending => {
    const expired = pending.lastStatus === 'EXPIRED';
    const trialLookup = pending.kind === 'TRIAL_CONVERT' && !pending.intentNo
      ? await api.findTrial(pending.commandKey, !!pending.structuredTrialRefusals) : undefined;
    const result = trialLookup ? trialLookup.result
      : pending.intentNo && (expired || pending.kind === 'TRIAL_CONVERT')
      ? await api.snapshot(pending.intentNo) : await readIntent(pending);
    if (!sameAccount() || !current() || state.open || !shouldRead(pending) || result?.status === 'processing') return;
    if (pending.kind === 'TRIAL_CONVERT') {
      if (result?.status === 'refused' || (!result && pending.trialCreateRefusal)) {
        projectTrialRefusal(result?.status === 'refused' ? result : pending.trialCreateRefusal!, pending, accountKey);
        return;
      }
      if (!result && !pending.intentNo) {
        if (canReleaseUncreatedTrialPayment(pending, trialLookup?.notFoundAt)) finishUncreatedTrialPayment(pending, accountKey);
        return;
      }
      if (result && (!pending.intentNo || (result.refundStatus === 'REFUNDED' ? 'REFUNDED' : result.status) !== pending.lastStatus
          || result.trialPurchaseOutcome !== pending.trialPurchaseOutcome)) {
        await useFreeTrial().refreshRemote();
        if (!sameAccount() || !current() || state.open) return;
      }
    }
    if (result?.status === 'refused') return;
    const intent = result;
    if (expired && pending.kind !== 'TRIAL_CONVERT' && intent && intent.status !== 'MANUAL_REVIEW') return;
    const orderNo = projectPassivePayment(accountKey, pending, intent);
    if (orderNo) await useOrders().reconcileRemoteOrder(orderNo, () => sameAccount() && foregroundReadAllowed());
  })));
}
function projectPassivePayment(accountKey: string, pending: PendingExternal, intent: PurchasePaymentIntent | null): string | undefined {
  if (!intent) {
    if (pending.intentNo) {
      const orderNo = pending.kind === 'ORDER_PAY' ? JSON.parse(pending.fingerprint)[1].orderNo : '';
      releaseMissingPayment(pending, accountKey, orderNo);
    }
    return;
  }
  if (!isVisiblePayment(intent)) { hideOriginalPayment(accountKey, pending, intent); return; }
  matches(intent, pending);
  const businessDelivered = intent.status === 'DELIVERED' || intent.fulfilmentStatus === 'DELIVERED';
  // A manual refund ends the payment, though user clients still receive MANUAL_REVIEW for it.
  const status = intent.refundStatus === 'REFUNDED' ? 'REFUNDED' : intent.status;
  const trialPurchaseOutcome = intent.trialPurchaseOutcome;
  const discoveredTrialIntent = pending.kind === 'TRIAL_CONVERT' && !pending.intentNo;
  const legacyTrialExpiry = intent.claimNo === undefined && hasLegacyTrialExpiry(pending);
  const expiryConfirmed = !!isUnpaidPaymentTerminal(intent, legacyTrialExpiry);
  if (!discoveredTrialIntent && !businessDelivered && ((status === pending.lastStatus && trialPurchaseOutcome === pending.trialPurchaseOutcome)
      && expiryConfirmed === isExpiredPaymentRecord(pending)
      || pending.kind !== 'TRIAL_CONVERT' && !settled(intent) && intent.status !== 'FUNDS_CONFIRMED')) return;
  const orderDeadlineAt = pending.kind === 'ORDER_PAY' || pending.kind === 'TRIAL_CONVERT' ? Date.parse(intent.deadlineAt ?? intent.expiresAt) : undefined;
  if (expiryConfirmed) {
    saveExpiry(accountKey, pending.commandKey, pending.kind, { ...pending, intentNo: intent.intentNo,
      paymentMethod: intent.paymentMethod, network: intent.network, orderDeadlineAt, trialPurchaseOutcome, legacyTrialExpiry,
      claimNo: intent.claimNo ?? paymentRecordClaimNo(pending) });
  } else {
    if (businessDelivered) validatePurchasePaymentReceipt(pending.kind, JSON.parse(pending.fingerprint)[1], intent.receipt, intent);
    if (businessDelivered || status === 'REFUNDED' || trialPurchaseOutcome) closeTrialPaymentCaller(pending, accountKey);
    save({ ...pending, intentNo: intent.intentNo, lastStatus: status, businessDelivered, trialPurchaseOutcome, legacyTrialExpiry, expiryConfirmed,
      claimNo: intent.claimNo ?? paymentRecordClaimNo(pending) }, accountKey);
  }
  if (businessDelivered && pending.kind === 'TRIAL_CONVERT') {
    const claimNo = intent.claimNo ?? paymentRecordClaimNo(pending);
    if (claimNo) useTrialCheckout().settleExternal(claimNo, parseTrialConvertReceipt(intent.receipt), pending.commandKey);
  }
  if (pending.kind === 'ORDER_PAY') return JSON.parse(pending.fingerprint)[1].orderNo;
}

type CheckoutCapacityPaymentRead = PaymentCommandReceipt | { status: 'AWAITING_PAYMENT'; intentNo: string; cutoff: number | null };
let checkoutIntentRead: { accountKey: string; commandKey: string; result: ReturnType<typeof readIntent> } | null = null;

/** Project a checkout-owned external read into the same records used by the floating bar.
 *  Undefined leaves the command lookup to checkout. Null means the known intent was released. */
export async function readCheckoutCapacityPayment(accountKey: string, kind: 'CAPACITY_KEEP' | 'CAPACITY_REPLACE',
  commandKey: string, current: () => boolean): Promise<CheckoutCapacityPaymentRead | null | undefined> {
  const pending = rows(accountKey).records[commandKey];
  if (pending?.kind !== kind) return;
  const read = { accountKey, commandKey, result: readIntent(pending) };
  checkoutIntentRead = read;
  const intent = await read.result.finally(() => {
    if (checkoutIntentRead === read) checkoutIntentRead = null;
  });
  if (!current()) return;
  if (intent?.status === 'processing') return { status: 'PROCESSING', canResumeSameKey: false };
  projectPassivePayment(accountKey, pending, intent);
  if (intent && !isVisiblePayment(intent)) return;
  if (!intent) return pending.intentNo ? null : undefined;
  if (intent.status === 'EXPIRED') return { status: 'REJECTED', canResumeSameKey: false, message: 'PURCHASE_PAYMENT_EXPIRED' };
  if (intent.status === 'DELIVERED' || intent.fulfilmentStatus === 'DELIVERED') {
    return { status: 'SUCCEEDED', canResumeSameKey: false, receipt: intent.receipt };
  }
  // A manual refund ended it; user reads still say MANUAL_REVIEW, the command query says REJECTED for the same key.
  if (intent.refundStatus === 'REFUNDED') return { status: 'REJECTED', canResumeSameKey: false, message: 'PURCHASE_PAYMENT_REFUNDED' };
  const timing = purchasePaymentTiming(intent, Date.now());
  if (timing.canPay) return { status: 'AWAITING_PAYMENT', intentNo: intent.intentNo, cutoff: timing.cutoff };
  return { status: 'PROCESSING', canResumeSameKey: false };
}
function settled(intent: PurchasePaymentIntent | null) {
  return !!intent && ['EXPIRED', 'MANUAL_REVIEW', 'DELIVERED'].includes(intent.status);
}
function paymentReadFinished() {
  const intent = state.intent;
  return state.concluded || isUnpaidPaymentTerminal(intent, hasLegacyTrialExpiry(state.pending)) || intent?.status === 'DELIVERED'
    || intent?.fulfilmentStatus === 'DELIVERED' || intent?.refundStatus === 'REFUNDED';
}
/** The outcome shown on the payment page; a failed bank attempt reports EXPIRED with its own reason. */
export function purchaseConclusion(intent: PurchasePaymentIntent | null): PurchaseNotice {
  if (intent && isUnpaidPaymentTerminal(intent, hasLegacyTrialExpiry(state.pending))) return intent.reason === 'PAYMENT_FAILED' ? 'bankFailed' : 'timeout';
  // A manual refund still reaches user clients as MANUAL_REVIEW; refundStatus says it has ended (BUG-690).
  if (intent?.status === 'MANUAL_REVIEW' && intent.refundStatus === 'REFUNDED') return 'refunded';
  if (intent?.trialPurchaseOutcome === 'LATE_PAYMENT_REVIEW') return 'late';
  if (isTrialPaymentReviewPending(intent)) return '';
  if (intent?.status === 'MANUAL_REVIEW') return intent.reason === 'PAYMENT_LATE_REVIEW' ? 'late' : REVIEW_REASONS.includes(intent.reason ?? '') ? 'review' : 'delivery';
  return '';
}
function accept(intent: PurchasePaymentIntent, pending: PendingExternal) {
  if (!isVisiblePayment(intent)) {
    hideOriginalPayment(state.accountKey, pending, intent);
    finish(null);
    return;
  }
  matches(intent, pending);
  // Legacy recovery rows have only the quote identity; bind their first validated original intent for subsequent reads.
  const legacyTrialExpiry = intent.claimNo === undefined && hasLegacyTrialExpiry(pending);
  const known = { ...pending, paymentMethod: intent.paymentMethod, network: intent.network,
    orderDeadlineAt: pending.kind === 'ORDER_PAY' || pending.kind === 'TRIAL_CONVERT' ? Date.parse(intent.deadlineAt ?? intent.expiresAt) : undefined,
    trialPurchaseOutcome: intent.trialPurchaseOutcome, legacyTrialExpiry, expiryConfirmed: !!isUnpaidPaymentTerminal(intent, legacyTrialExpiry),
    claimNo: intent.claimNo ?? paymentRecordClaimNo(pending),
    intentNo: intent.intentNo, lastStatus: intent.refundStatus === 'REFUNDED' ? 'REFUNDED' : intent.status, businessDelivered: intent.status === 'DELIVERED' || intent.fulfilmentStatus === 'DELIVERED' };
  if (isOrderPaymentDiscoveryOnly(pending)) known.resumedOnThisDevice = true;
  delete known.quotaRefusal;
  delete known.useOrderTopup;
  delete known.trialCreateRefusal;
  if (known.businessDelivered) {
    const payload = JSON.parse(known.fingerprint)[1] as Record<string, unknown>;
    validatePurchasePaymentReceipt(known.kind, payload, intent.receipt, intent);
  }
  if (known.expiryConfirmed) saveExpiry(state.accountKey, known.commandKey, known.kind, known);
  else {
    try {
      if (known.businessDelivered || known.lastStatus === 'REFUNDED' || known.trialPurchaseOutcome)
        closeTrialPaymentCaller(known, state.accountKey);
      save(known);
    }
    catch (error) {
      if (!settled(intent)) throw error;
      if (pending.lastStatus !== known.lastStatus || (pending.businessDelivered ?? false) !== known.businessDelivered) {
        toast.error(known.businessDelivered ? getT().errors.billMissingTitle : getT().errors.txNotSavedTitle);
      }
    }
  }
  const previousConclusion = purchaseConclusion(state.intent);
  state.pending = known; state.intent = intent; state.method = intent.paymentMethod;
  if (intent.deadlineAt) state.deadlineAt = Date.parse(intent.deadlineAt);
  if (known.businessDelivered) {
    if (known.kind === 'TRIAL_CONVERT' && known.claimNo)
      useTrialCheckout().settleExternal(known.claimNo, parseTrialConvertReceipt(intent.receipt), known.commandKey);
    finish({ method: 'EXTERNAL', receipt: intent.receipt, commandKey: known.commandKey, accountKey: state.accountKey });
    return;
  }
  if (!purchasePaymentTiming(intent, Date.now(), state.deadlineAt).canPay) state.cashier = false;
  else if (openCashierOnReady && intent.paymentUrl) { openCashierOnReady = false; state.cashier = true; }
  const conclusion = purchaseConclusion(intent);
  if (isTrialPaymentReviewPending(intent) && ['review', 'late', 'delivery'].includes(state.notice)) state.notice = '';
  if (!conclusion || conclusion === previousConclusion) return;
  if (conclusion === 'refunded') {
    const orderNo = known.kind === 'ORDER_PAY' ? purchaseRecordPayload(known).orderNo : undefined;
    // A refund without an order has nothing to choose: the page itself states it and its close leaves (03 §3.5.1).
    if (typeof orderNo !== 'string') {
      if (['review', 'late', 'delivery', 'leave'].includes(state.notice)) state.notice = '';
      return;
    }
    // The refund closes the order on the server; refresh it so an order page under this layer stops showing it unpaid.
    const accountKey = state.accountKey;
    void useOrders().reconcileRemoteOrder(orderNo, () => account() === accountKey && foregroundReadAllowed()).catch(() => undefined);
  }
  state.notice = conclusion;
}
/** The server holds no payment for this command: release it and its fences. Only the user may start another one, from the order. */
function releaseMissingPayment(pending: PendingExternal, accountKey: string, orderNo: string) {
  release(pending, accountKey, orderNo);
  releasePurchaseCallerRecord(accountKey, pending.kind, pending.commandKey);
  releaseListeners.forEach(listener => listener(accountKey, pending.commandKey));
}
function gone(pending: PendingExternal, accountKey: string) {
  try {
    releaseMissingPayment(pending, accountKey, state.orderNo);
  } catch {
    // Local cleanup can fail after the server has already answered definitively.
  }
  Object.assign(state, { pending: null, intent: null, quote: null });
  conclude('gone');
}
function releaseUncreatedPayment(pending: PendingExternal, accountKey: string) {
  releasePurchaseCallerRecord(accountKey, pending.kind, pending.commandKey);
  releaseListeners.forEach(listener => listener(accountKey, pending.commandKey));
  release(pending, accountKey, state.orderNo);
  Object.assign(state, { pending: null, quote: null, intent: null });
}

function rememberTrialCreateRefusal(pending: PendingExternal, refusal: TrialExternalRefusal) {
  const readOnly = { ...pending, lookupOnly: true, trialCreateRefusal: refusal };
  state.pending = readOnly;
  try { save(readOnly); } catch { /* Keep the rejected quote read-only for this session. */ }
}

function projectTrialRefusal(refusal: TrialExternalRefusal, pending: PendingExternal, accountKey: string) {
  const claimNo = paymentRecordClaimNo(pending);
  const payload = purchaseRecordPayload(pending);
  if (!claimNo || typeof payload.productNo !== 'string' || typeof payload.expectedAmountUsdt !== 'number') return;
  if ((refusal.action === 'original' && refusal.originalPurchase.claimNo !== claimNo)
      || (refusal.action === 'review' && (refusal.claimNo && refusal.claimNo !== claimNo || refusal.productNo && refusal.productNo !== payload.productNo))) return;
  releasePurchaseCallerRecord(accountKey, pending.kind, pending.commandKey);
  release(pending, accountKey, '');
  const checkout = useTrialCheckout();
  if (refusal.action === 'original') checkout.adoptOriginal(refusal.originalPurchase);
  else checkout.rememberExternalRefusal(claimNo, payload.productNo, pending.commandKey, payload.expectedAmountUsdt, {
    status: 'refused', reasonCode: refusal.action === 'wallet' ? 'ZERO_PAYMENT_REQUIRES_WALLET' : refusal.reasonCode,
    ...(refusal.action === 'review' && refusal.quote ? { quote: refusal.quote } : {}),
  });
}
function finishTrialRefusal(refusal: TrialExternalRefusal, pending?: PendingExternal) {
  const owner = context;
  const payload = pending ? purchaseRecordPayload(pending) : owner?.payload;
  const claimNo = pending ? paymentRecordClaimNo(pending) : owner?.claimNo;
  if (refusal.action === 'review' && (refusal.claimNo && refusal.claimNo !== claimNo || refusal.productNo && refusal.productNo !== payload?.productNo)
      || refusal.action === 'original' && refusal.originalPurchase.claimNo !== claimNo) throw new Error('PURCHASE_PAYMENT_RESPONSE_INVALID');
  if (pending) releaseUncreatedPayment(pending, state.accountKey);
  finish(null);
  if (refusal.action !== 'original' && pending && claimNo && payload
      && typeof payload.productNo === 'string' && typeof payload.expectedAmountUsdt === 'number') {
    const reason = refusal.action === 'wallet' ? 'ZERO_PAYMENT_REQUIRES_WALLET' : refusal.reasonCode;
    useTrialCheckout().rememberExternalRefusal(claimNo, payload.productNo, pending.commandKey, payload.expectedAmountUsdt,
      { status: 'refused', reasonCode: reason, ...(refusal.action === 'review' && refusal.quote ? { quote: refusal.quote } : {}) });
  } else if (owner?.onTrialRefusal && owner.scopeCurrent?.() !== false) {
    owner.onTrialRefusal(refusal);
  } else if (refusal.action === 'original') {
    useTrialCheckout().adoptOriginal(refusal.originalPurchase);
    if (!owner) void navTo(originalTrialCheckoutHref(refusal.originalPurchase));
  }
}
/** The payment ended with an answer: nothing of it stays behind the notice and no further read or write runs. */
function conclude(notice: PurchaseNotice) { stopTimers(); Object.assign(state, { notice, retryNotice: '', concluded: true, cashier: false }); }
function stopTimers() { clearTimeout(quoteTimer); clearTimeout(pollTimer); quoteTimer = pollTimer = undefined; }
function finish(result: PurchaseChoice | null) {
  const expired = isUnpaidPaymentTerminal(state.intent, hasLegacyTrialExpiry(state.pending));
  requestVersion++; policyVersion++; stopTimers(); openCashierOnReady = false;
  activeTrialRefreshPending = false;
  policyRead = null;
  reviewedQuote = confirmedQuote = null;
  Object.assign(state, { open: false, loading: false, retrying: false, reading: false, busy: false, cashier: false, notice: '', concluded: false,
    originalRecovery: null, canResubmit: false });
  const choice = activeChoice; activeChoice = null; context = null; choice?.resolve(result);
  if (expired) choice?.onExpired?.();
}
function waitForChoice(onExpired?: () => void, onTerminalDismiss?: () => void): Promise<PurchaseChoice | null> {
  let resolve!: (result: PurchaseChoice | null) => void;
  const promise = new Promise<PurchaseChoice | null>(done => { resolve = done; });
  activeChoice = { promise, resolve, onExpired, onTerminalDismiss };
  return promise;
}

function dismissRoutedTerminalTrialPayment(): boolean {
  const dismiss = activeChoice?.onTerminalDismiss;
  if (!dismiss) return false;
  finish(null);
  dismiss();
  return true;
}

/** Replace the expired page's unsubmitted choice, or let its original intent finish in the existing layer. */
export function prepareTradeinPaymentRecovery(accountKey: string, commandKey: string, unsubmitted: boolean): Promise<PurchaseChoice | null> | null {
  if (!state.open || state.accountKey !== accountKey || account() !== accountKey) return null;
  if (state.pending?.kind === 'TRADE_IN' && state.pending.commandKey === commandKey) {
    return activeChoice?.promise ?? null;
  }
  if (unsubmitted && !state.pending && context?.tradeinKey === commandKey && !context.current()) finish(null);
  return null;
}

export function hasTradeinPurchaseIntent(accountKey: string, commandKey: string): boolean {
  return rows(accountKey).records[commandKey]?.kind === 'TRADE_IN';
}

/** A refusal awaiting readback retains its original key outside the payment-in-progress lists. */
export function refusedPurchasePayment(accountKey: string, commandKey: string): PendingExternal | null {
  state.revision;
  try {
    const pending = rows(accountKey).records[commandKey];
    return pending?.quotaRefusal && isVisiblePayment(pending) ? pending : null;
  } catch { return null; }
}

// A checkout owner may defer navigation until its payment operation releases
// the page leave guard. Cold resumes use ordinary navigation directly.
/** A purchase page whose payment ends on its order is finished: the order page takes its place, so back skips it.
 *  When that order's page is right below (a purchase continued from it), going back to it avoids a second copy. */
export function replaceWithOrder(href: string): Promise<boolean> {
  const pages = getCurrentPages(), below = pages[pages.length - 2] as { route?: string } | undefined, id = /[?&]id=([^&]+)/.exec(href)?.[1];
  if (below?.route === 'pages/store/order-detail' && id && pageQuery(below)?.id === decodeURIComponent(id)) { navBack(href); return Promise.resolve(true); }
  return navReplace(href);
}
// A purchase page whose payment ends on its order is finished: replace sends the order page in its place, so back skips it.
function closeAndNavigate(href: string, replace = false) {
  const owner = context, navigate = owner?.navigate;
  finish(null);
  if (navigate) navigate(href, replace && !!owner); else if (replace && owner) void replaceWithOrder(href); else void navTo(href);
}
async function openConditions() {
  const { accountKey, orderNo, notice } = state;
  const version = requestVersion;
  let productNo = state.productNo;
  try {
    if (orderNo) {
      const orders = useOrders();
      const order = orders.getById(orderNo) ?? await orders.ensureRemoteOrder(orderNo);
      if (!owns(version, accountKey)) return;
      const items = order?.lineItems;
      if (order && (items?.length ?? 1) === 1) {
        productNo = items?.[0]?.sku ?? order.productId;
      } else if (!productNo && notice !== 'rejectConditionsUnmet' && items && items.length > 1) {
        for (const { sku } of items) {
          if (!owns(version, accountKey)) return;
          const eligibility = await purchaseEligibilityApi.get(sku);
          if (!owns(version, accountKey)) return;
          if (eligibility.policies.some(policy => policy.policy === 'E1' && !policy.eligible)) {
            productNo = sku;
            break;
          }
        }
      }
    }
  } catch {
    // The order detail can retry its own product read.
  }
  if (!owns(version, accountKey)) return;
  if (notice === 'rejectConditionsUnmet') {
    closeAndNavigate(productNo ? `/pages/team/quota?product=${encodeURIComponent(productNo)}` : '/pages/team/quota');
  } else if (orderNo && !productNo) {
    if (onOrderPage(orderNo)) finish(null);
    else closeAndNavigate(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}`);
  } else if (productNo) {
    closeAndNavigate(`/pages/store/detail?id=${encodeURIComponent(productNo)}`);
  } else finish(null);
}
/** Reads pause in the background. Manual review uses a fixed interval, including after failures. */
function schedule(version: number, accountKey: string, failed: boolean) {
  const inReview = state.intent?.status === 'MANUAL_REVIEW';
  pollFailures = failed && !inReview ? pollFailures + 1 : 0;
  clearTimeout(pollTimer); pollTimer = undefined;
  if (paused || !appReadOnline.value || !owns(version, accountKey)
      || !(state.pending || state.originalRecovery) || paymentReadFinished()) return;
  pollTimer = setTimeout(() => { if (owns(version, accountKey)) void query(); },
    inReview ? REVIEW_POLL_MS : failed ? POLL_BACKOFF[Math.min(pollFailures - 1, POLL_BACKOFF.length - 1)]! : POLL_MS);
}
function loadPolicy(): Promise<void> {
  if (state.walletOnly) return Promise.resolve();
  if (policyRead) return policyRead;
  const request = readPolicy().finally(() => { if (policyRead === request) policyRead = null; });
  policyRead = request;
  return request;
}
async function readPolicy() {
  const accountKey = state.accountKey, binding = useApp().accountBindingEpoch, version = ++policyVersion;
  state.orderPayUsdtRoute = null;
  state.orderTopupNetworks = [];
  const [fees, networks] = await Promise.allSettled([api.policy(), deposits.policy()]);
  if (!state.open || state.accountKey !== accountKey || account() !== accountKey || useApp().accountBindingEpoch !== binding || version !== policyVersion) return;
  // A failed read leaves the existing quote-led availability behaviour in place.
  const policy: Partial<Record<ExternalPaymentMethod, boolean>> = fees.status === 'fulfilled' ? fees.value.channels : { HDPAY_BANK: true, CREGIS_USDT_BSC: true, CREGIS_USDT_ERC20: true };
  // TRC20 needs both explicit channel configuration and a current open-network policy.
  policy.CREGIS_USDT_TRC20 = policy.CREGIS_USDT_TRC20 === true && networks.status === 'fulfilled'
    && networks.value.some(row => row.network === 'TRC20' && row.enabled);
  if (networks.status === 'fulfilled') for (const row of networks.value) {
    const method = row.network === 'TRC20' ? 'CREGIS_USDT_TRC20' : row.network === 'ERC20' ? 'CREGIS_USDT_ERC20' : 'CREGIS_USDT_BSC';
    policy[method] = policy[method] === true && row.enabled;
  }
  // A quote/create refusal remains authoritative if it arrived while the policies were loading.
  for (const method of ['HDPAY_BANK', 'CREGIS_USDT_BSC', 'CREGIS_USDT_ERC20', 'CREGIS_USDT_TRC20'] as const) {
    if (state.policy?.[method] === false) policy[method] = false;
  }
  state.policy = policy;
  state.orderPayUsdtRoute = fees.status === 'fulfilled' ? fees.value.orderPayUsdtRoute : null;
  if (networks.status === 'fulfilled') {
    state.orderTopupNetworks = networks.value.flatMap(row => !row.enabled || row.network === 'TRC20' ? []
      : [row.network === 'BEP20' ? 'CREGIS_USDT_BSC' : 'CREGIS_USDT_ERC20']);
  }
  reconcileChannel();
}
const orderTopupMethod = (method: PurchaseMethod) => method === 'CREGIS_USDT_BSC' || method === 'CREGIS_USDT_ERC20';
function available(method: PurchaseMethod) {
  if (state.walletOnly) return method === 'WALLET';
  if (!canSelectNewUsdtNetwork(method) || context?.paymentMethods && !context.paymentMethods.includes(method)) return false;
  if (state.kind === 'ORDER_PAY' && method !== 'HDPAY_BANK' && method !== 'WALLET') {
    return !!state.orderNo && state.orderPayUsdtRoute === 'WALLET_TOPUP' && state.orderTopupNetworks.includes(method);
  }
  return method === 'WALLET' || !state.policy || state.policy[method] === true;
}
function goOrderTopup(method = state.method) {
  if (state.kind !== 'ORDER_PAY' || !orderTopupMethod(method) || !available(method) || !state.orderNo) return false;
  closeAndNavigate(orderTopupHref(state.orderNo, method === 'CREGIS_USDT_ERC20' ? 'ERC20' : 'BEP20', state.summary));
  return true;
}
async function redirectOrderUsdt(method: PurchaseMethod, version: number, accountKey: string) {
  await loadPolicy();
  if (!owns(version, accountKey)) return;
  if (!goOrderTopup(method)) {
    if (context) choose('WALLET');
    else finish(null);
  }
}
function channelUnavailable(error: unknown, method: PurchaseMethod) {
  return isApiRefusal(error, 503, 'PURCHASE_PAYMENT_FEES_NOT_CONFIGURED')
    || (method === 'CREGIS_USDT_ERC20' || method === 'CREGIS_USDT_BSC' || method === 'CREGIS_USDT_TRC20')
      && (isApiRefusal(error, 409, 'CREGIS_DIRECT_PAYMENT_PAUSED') || isApiRefusal(error, 503, 'CREGIS_DIRECT_PAYMENT_UNAVAILABLE'));
}
function hideChannel(method: ExternalPaymentMethod) {
  state.policy = { ...(state.policy ?? { HDPAY_BANK: true, CREGIS_USDT_BSC: true, CREGIS_USDT_ERC20: true }), [method]: false };
  state.notice = ''; state.retryNotice = ''; reviewedQuote = confirmedQuote = null;
}
/** Before an intent exists, leave an unavailable channel and try another payment method. */
function reconcileChannel() {
  if (state.concluded || state.pending || state.originalRecovery || state.step === 'methods' || available(state.method)) return;
  state.notice = ''; reviewedQuote = confirmedQuote = null;
  if (state.kind === 'ORDER_PAY' && state.step === 'network') return;
  const networks = !canSelectNewUsdtNetwork(state.method)
    ? (['CREGIS_USDT_BSC', 'CREGIS_USDT_ERC20'] as const)
    : (['CREGIS_USDT_ERC20', 'CREGIS_USDT_BSC'] as const);
  const other = state.method === 'HDPAY_BANK' ? null : networks.find(method => method !== state.method && available(method));
  if (other && available(other)) void select(other);
  else choose('WALLET');
}
function acceptQuoteContext(check: PurchaseContextCheck, expected: PurchasePaymentContext): boolean {
  if (check === 'changed') throw new Error('PURCHASE_CONTEXT_CHANGED');
  if (check === 'abandoned') { finish(null); return false; }
  if (check === 'wallet-required') {
    finish(null);
    expected.onTrialWalletRequired?.();
    return false;
  }
  return true;
}
async function select(method: PurchaseMethod, step?: PurchaseStep) {
  if (state.busy || state.pending || state.originalRecovery || state.concluded || !context) return;
  if (state.walletOnly && method !== 'WALLET') return;
  if (state.deadlineAt !== null && state.deadlineAt <= Date.now()) { deadlinePassed(); return; }
  if (step) state.step = step;
  if (method !== state.method) { quoteFailures = 0; reviewedQuote = confirmedQuote = null; state.retryNotice = ''; }
  state.method = method; state.quote = null; state.retrying = false; state.canResubmit = false;
  clearTimeout(quoteTimer);
  const version = ++requestVersion, accountKey = state.accountKey, expected = context;
  if (method === 'WALLET' || !available(method)) { state.loading = false; return; }
  if (expected.kind === 'ORDER_PAY' && orderTopupMethod(method)) { state.loading = false; return; }
  state.loading = true;
  try {
    const before = expected.checkCurrent ? await expected.checkCurrent(method) : expected.current() ? 'current' : 'changed';
    if (!owns(version, accountKey) || !acceptQuoteContext(before, expected)) return;
    const quote = await (expected.kind === 'TRIAL_CONVERT' && expected.onTrialRefusal
      ? api.trialQuote(method, expected.payload) : api.quote(expected.kind, method, expected.payload));
    if (!owns(version, accountKey)) return;
    if ('status' in quote) { finishTrialRefusal(quote); return; }
    const after = expected.checkCurrent ? await expected.checkCurrent(method) : expected.current() ? 'current' : 'changed';
    if (!owns(version, accountKey) || !acceptQuoteContext(after, expected)) return;
    if (!isVisiblePayment(quote)) { finish(null); return; }
    // A trial's offset grows with accrual under one quote version, so only its rise needs a new confirmation.
    const amountChanged = expected.kind === 'TRIAL_CONVERT' ? Number(quote.subtotalUsdt) > Number(expected.amount) : formatAmount(quote.subtotalUsdt) !== formatAmount(expected.amount);
    if (quote.kind !== expected.kind || quote.paymentMethod !== method || amountChanged) throw new Error('PURCHASE_CONTEXT_CHANGED');
    state.quote = quote; quoteFailures = 0; state.retryNotice = '';
    const reviewed = confirmedQuote ?? reviewedQuote;
    if (reviewed && !samePaymentTerms(reviewed, quote)) {
      confirmedQuote = null; state.notice = 'quoteChanged'; reviewedQuote = quote;
    } else reviewedQuote = reviewed ?? quote;
    if (quote.deadlineAt) state.deadlineAt = Date.parse(quote.deadlineAt);
    // Swap in a fresh quote 30 s before this one lapses.
    // (setTimeout fires at once beyond 2^31-1 ms, so far-off expiries are capped.)
    quoteTimer = setTimeout(() => { if (owns(version, accountKey)) void select(method); }, Math.min(2147483647, Math.max(1000, Date.parse(quote.expiresAt) - Date.now() - 30000)));
  } catch (error) {
    if (!owns(version, accountKey)) return;
    if (expected.scopeCurrent?.() === false) { finish(null); return; }
    const cause = asApiError(error);
    if (expected.kind === 'TRIAL_CONVERT' && expected.onTrialWalletRequired
        && isApiRefusal(cause, 409, 'ZERO_PAYMENT_REQUIRES_WALLET')) {
      finish(null);
      expected.onTrialWalletRequired();
      return;
    }
    if (expected.kind === 'ORDER_PAY' && orderTopupMethod(method) && isApiRefusal(cause, 409, 'ORDER_USDT_USE_TOPUP')) {
      await redirectOrderUsdt(method, version, accountKey);
      return;
    }
    if (cause.purchaseIntentNo && expected.kind !== 'ORDER_PAY') {
      state.originalRecovery = { intentNo: cause.purchaseIntentNo, kind: expected.kind, fingerprint: fingerprint(expected), summary: expected.summary };
      await query();
      return;
    }
    const paymentRefusal = paymentRefusalNotice(cause, expected.kind);
    state.retryNotice = paymentRefusal === 'rejectEligibilityUnavailable' ? paymentRefusal : '';
    if (error instanceof Error && error.message === 'PURCHASE_CONTEXT_CHANGED') { state.notice = 'changed'; return; }
    if (paymentRefusal && paymentRefusal !== 'rejectEligibilityUnavailable') { conclude(paymentRefusal); return; }
    const replacement = expected.kind === 'TRADE_IN' || expected.kind === 'CAPACITY_REPLACE';
    const replacementRefusal = replacement && tradeinPaymentRejection(cause, 'external');
    if (replacementRefusal) {
      if (expected.tradeinKey) releasePurchaseCallerRecord(accountKey, expected.kind, expected.tradeinKey);
      expected.onReplacementRefused?.(replacementRefusal);
      conclude(replacementRefusal);
      return;
    }
    if (channelUnavailable(cause, method)) {
      hideChannel(method);
      reconcileChannel();
      return;
    }
    // Eligibility reads can also fail transiently with a specific 403.
    if (!state.retryNotice && cause.kind !== 'network' && (cause.status ?? 0) < 500
        && !(replacement && isApiRefusal(cause, 503, TRADEIN_RUNTIME_RECOVERING))) {
      const refusal = ORDER_REFUSALS[cause.message];
      if (refusal) conclude(refusal); else state.notice = 'changed';
      return;
    }
    state.retrying = true;
    quoteTimer = setTimeout(() => { if (owns(version, accountKey)) void select(method); }, Math.min(30000, 3000 * 2 ** quoteFailures++));
  } finally { if (owns(version, accountKey)) state.loading = false; }
}
/** An order past its deadline can no longer be paid; other purchases get a fresh quote and deadline from their own page. */
function deadlinePassed() { state.retryNotice = ''; if (state.kind === 'ORDER_PAY') conclude('orderExpired'); else state.notice = 'changed'; }
function choose(option: 'WALLET' | 'HDPAY_BANK' | 'USDT') {
  if (state.originalRecovery) return;
  if (option === 'WALLET') { state.step = 'methods'; void select('WALLET'); return; }
  if (option === 'HDPAY_BANK') { void select('HDPAY_BANK', 'bank'); return; }
  const methods = state.kind === 'ORDER_PAY' ? ['CREGIS_USDT_BSC', 'CREGIS_USDT_ERC20'] as const : ['CREGIS_USDT_ERC20', 'CREGIS_USDT_BSC'] as const;
  const network = methods.find(available);
  if (network || state.kind !== 'ORDER_PAY') void select(network ?? 'CREGIS_USDT_ERC20', 'network');
}
function samePaymentTerms(left: PurchaseQuote, right: PurchaseQuote) {
  const amountAllowed = left.kind === 'TRIAL_CONVERT' ? Number(right.totalUsdt) <= Number(left.totalUsdt)
    : formatAmount(left.totalUsdt) === formatAmount(right.totalUsdt);
  return left.paymentMethod === right.paymentMethod && amountAllowed
    && left.feePolicyVersion === right.feePolicyVersion;
}
/** 前往付款: a short deadline warns first, then the pre-payment reminder; the intent is created only after the reminder. */
function proceed() {
  if (!state.quote || state.loading || state.busy) return;
  confirmedQuote = state.quote;
  state.notice = state.deadlineAt !== null && state.deadlineAt - Date.now() < SHORT_DEADLINE_MS ? 'timeShort' : 'reminder';
}
async function query(refreshTrialIntent = false) {
  const pending = state.pending;
  const recovery = state.originalRecovery;
  const topupIntent = state.orderTopupIntent;
  if (!appReadOnline.value || !(pending || recovery) || state.busy || paymentReadFinished()) return;
  if (state.reading) {
    if (refreshTrialIntent && pending?.kind === 'TRIAL_CONVERT' && pending.intentNo) activeTrialRefreshPending = true;
    return;
  }
  const version = requestVersion, accountKey = state.accountKey;
  let failed = false;
  state.reading = true;
  try {
    if (topupIntent && pending) {
      const intent = await api.snapshot(topupIntent.intentNo);
      if (!owns(version, accountKey)) return;
      if (!intent || intent.intentNo !== topupIntent.intentNo || intent.kind !== 'ORDER_PAY' || intent.paymentMethod !== topupIntent.paymentMethod) {
        throw new Error('PURCHASE_PAYMENT_RESPONSE_INVALID');
      }
      if (intent.status === 'DELIVERED' || intent.fulfilmentStatus === 'DELIVERED') {
        const orderNo = state.orderNo;
        finish(null);
        if (orderNo) void replaceWithOrder(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}`);
        return;
      }
      state.intent = topupIntent.paymentAllowed ? intent : { ...intent, paymentAllowed: false };
      state.pending = { ...pending, intentNo: intent.intentNo, paymentMethod: intent.paymentMethod, network: intent.network };
      if (intent.deadlineAt) state.deadlineAt = Date.parse(intent.deadlineAt);
      return;
    }
    if (recovery) {
      let intent = await api.snapshot(recovery.intentNo);
      if (!owns(version, accountKey) || state.concluded) return;
      if (!intent) {
        // The 409 only names the intent. A locally known key is usable only for that same intent.
        const original = Object.values(rows(accountKey).records)
          .find(row => row.intentNo === recovery.intentNo && row.kind === recovery.kind);
        if (original) {
          const result = await api.find(original.kind, original.commandKey);
          if (!owns(version, accountKey) || state.concluded) return;
          if (result?.status === 'processing') {
            state.canResubmit = false;
            return;
          }
          intent = result;
        }
      }
      if (!owns(version, accountKey) || state.concluded) return;
      if (intent && (intent.intentNo !== recovery.intentNo || intent.kind !== recovery.kind)) {
        throw new Error('PURCHASE_PAYMENT_RESPONSE_INVALID');
      }
      if (intent && !isVisiblePayment(intent)) {
        if (pending) hideOriginalPayment(accountKey, pending, intent);
        finish(null);
        return;
      }
      if (pending && pending.commandKey !== intent?.commandKey) releaseUncreatedPayment(pending, accountKey);
      state.retrying = false;
      if (intent) {
        const [, payload, claimNo] = JSON.parse(recovery.fingerprint) as [PurchaseKind, Record<string, unknown>, string?];
        if (intent.kind === 'TRIAL_CONVERT') payload.expectedAmountUsdt = intent.subtotalUsdt;
        else if (intent.businessAmountUsdt) payload.expectedPayableUsdt = intent.businessAmountUsdt;
        const original = { ...recovery, fingerprint: JSON.stringify(claimNo ? [recovery.kind, payload, claimNo] : [recovery.kind, payload]), claimNo,
          legacyTrialExpiry: context?.legacyTrialExpiry,
          commandKey: intent.commandKey, paymentQuoteId: intent.paymentQuoteId, lookupOnly: true,
          startedAt: intent.createdAt ? Date.parse(intent.createdAt) : undefined };
        if (context) {
          const caller = activeChoice;
          context = null;
          state.coldResume = true;
          waitForResumedChoice();
          caller?.resolve(null);
        }
        openCashierOnReady = false;
        accept(intent, original);
      } else conclude('originalUnavailable');
      state.originalRecovery = null;
      return;
    }
    if (!pending) return;
    const checkoutRead = checkoutIntentRead;
    const trialLookup = pending.kind === 'TRIAL_CONVERT' && !pending.intentNo
      ? await api.findTrial(pending.commandKey, !!pending.structuredTrialRefusals) : undefined;
    const result = trialLookup ? trialLookup.result
      : await (refreshTrialIntent && pending.kind === 'TRIAL_CONVERT' && pending.intentNo ? api.get(pending.intentNo)
      : checkoutRead?.accountKey === accountKey && checkoutRead.commandKey === pending.commandKey ? checkoutRead.result : readIntent(pending));
    if (!owns(version, accountKey) || state.concluded) return;
    if (result?.status === 'processing') {
      state.canResubmit = false;
      return;
    }
    if (result?.status === 'refused') { finishTrialRefusal(result, pending); return; }
    if (result) {
      state.canResubmit = false;
      accept(result, pending);
    }
    else if (pending.trialCreateRefusal) {
      const owner = context;
      if (pending.structuredTrialRefusals || !owner) finishTrialRefusal(pending.trialCreateRefusal, pending);
      else {
        releaseUncreatedPayment(pending, accountKey);
        if (!owner.current()) finish(null);
        else {
          Object.assign(state, { reading: false, cashier: false, deadlineAt: owner.deadlineAt ?? null });
          if (available(state.method)) await select(state.method); else reconcileChannel();
        }
      }
    }
    else if (pending.useOrderTopup) {
      const method = pending.paymentMethod ?? state.method;
      releaseUncreatedPayment(pending, accountKey);
      await redirectOrderUsdt(method, version, accountKey);
    }
    else if (pending.quotaRefusal) {
      releaseUncreatedPayment(pending, accountKey);
      conclude(pending.quotaRefusal);
    }
    else if (pending.kind === 'TRIAL_CONVERT' && !pending.intentNo) {
      if (canReleaseUncreatedTrialPayment(pending, trialLookup?.notFoundAt)) {
        finishUncreatedTrialPayment(pending, accountKey);
        finish(null);
      } else {
        state.canResubmit = !pending.lookupOnly;
      }
    }
    else if (pending.intentNo || pending.lookupOnly) gone(pending, accountKey);
    else {
      state.canResubmit = true;
    }
  } catch {
    failed = true;
    if (owns(version, accountKey) && !state.concluded && pending?.quotaRefusal) conclude(pending.quotaRefusal);
  }
  finally {
    if (owns(version, accountKey)) {
      state.reading = false;
      if (activeTrialRefreshPending) {
        activeTrialRefreshPending = false;
        void query(true);
      } else schedule(version, accountKey, failed);
    }
  }
}
function retryOriginal() {
  if (state.canResubmit && !state.reading) void submitOriginal(true);
}
/** Resubmits the original quote under the original key; the server applies it at most once. */
async function submitOriginal(manualRetry = false) {
  const pending = state.pending;
  if (!pending || state.busy || state.reading || state.concluded) return;
  if (state.originalRecovery || pending.intentNo || pending.lookupOnly || pending.quotaRefusal || pending.useOrderTopup) return query();
  const version = requestVersion, accountKey = state.accountKey;
  const retryingUnknownTrial = pending.kind === 'TRIAL_CONVERT' && manualRetry;
  let failed = false, requote = false, lookup = false;
  Object.assign(state, { busy: true, canResubmit: false, retryNotice: '' });
  try {
    const intent = await (pending.structuredTrialRefusals ? api.trialCreate(pending.paymentQuoteId, pending.commandKey)
      : api.create(pending.paymentQuoteId, pending.commandKey));
    if (owns(version, accountKey) && !state.concluded) {
      state.retryNotice = '';
      if (intent.status !== 'refused') accept(intent, pending);
      else if (intent.action === 'original') finishTrialRefusal(intent, pending);
      else {
        // A definite quote refusal follows the server's same-key replay check.
        if (!retryingUnknownTrial || intent.action === 'review' && isTerminalTrialRequote(intent.reasonCode))
          rememberTrialCreateRefusal(pending, intent);
        lookup = true;
      }
    }
  } catch (error) {
    failed = true;
    if (owns(version, accountKey) && !state.concluded) {
      // A definite HTTP/business refusal before an intent exists permits a new review;
      // ambiguous transport outcomes keep the original key and quote for read-only query.
      const cause = asApiError(error);
      if (pending.kind === 'ORDER_PAY' && orderTopupMethod(pending.paymentMethod ?? state.method) && isApiRefusal(cause, 409, 'ORDER_USDT_USE_TOPUP')) {
        const readOnly = { ...pending, useOrderTopup: true };
        state.pending = readOnly;
        lookup = true;
        try { save(readOnly); } catch { /* Keep the original key and read-only recovery in this session. */ }
        return;
      }
      if (cause.purchaseIntentNo && pending.kind !== 'ORDER_PAY') {
        state.originalRecovery = { intentNo: cause.purchaseIntentNo, kind: pending.kind, fingerprint: pending.fingerprint, summary: pending.summary };
        Object.assign(state, { retrying: false, retryNotice: '' });
        lookup = true;
        return;
      }
      const paymentRefusal = paymentRefusalNotice(cause, pending.kind);
      state.retryNotice = '';
      if (paymentRefusal === 'rejectEligibilityUnavailable') {
        state.retryNotice = paymentRefusal;
        return;
      }
      const replacement = pending.kind === 'TRADE_IN' || pending.kind === 'CAPACITY_REPLACE';
      const replacementRefusal = replacement && tradeinPaymentRejection(cause, 'external');
      if (replacementRefusal) {
        // An existing intent is returned before the replacement precheck. This response ends the saved create attempt.
        releasePurchaseCallerRecord(accountKey, pending.kind, pending.commandKey);
        release(pending, accountKey, state.orderNo);
        releaseListeners.forEach(listener => listener(accountKey, pending.commandKey));
        Object.assign(state, { pending: null, quote: null, intent: null });
        context?.onReplacementRefused?.(replacementRefusal);
        conclude(replacementRefusal);
        return;
      }
      if (replacement && isApiRefusal(cause, 503, TRADEIN_RUNTIME_RECOVERING)) {
        // Keep checking for the original intent while the precheck recovers.
        return;
      }
      if (isApiRefusal(cause, 409, 'PURCHASE_PAYMENT_QUOTE_ALREADY_USED')
          || pending.kind === 'TRIAL_CONVERT' && isApiRefusal(cause, 409, 'IDEMPOTENCY_KEY_CONFLICT')) {
        // Another command owns this quote. Never retry its POST; only the server's own not-found releases this one.
        const readOnly = { ...pending, lookupOnly: true };
        state.pending = readOnly; lookup = true;
        try { save(readOnly); } catch { /* Keep read-only recovery for this session even if storage fails. */ }
        return;
      }
      if (retryingUnknownTrial) {
        const status = cause.message === 'PURCHASE_PAYMENT_QUOTE_NOT_FOUND' ? 404 : 409;
        if (isTerminalTrialRequote(cause.message) && isApiRefusal(cause, status, cause.message))
          rememberTrialCreateRefusal(pending, { status: 'refused', action: 'review', reasonCode: cause.message });
        lookup = true;
        return;
      }
      const unavailable = channelUnavailable(cause, pending.paymentMethod ?? state.method);
      const rejectedQuote = unavailable || cause.kind === 'http' && cause.status === cause.code
        && (cause.status === 409 && ['PURCHASE_PAYMENT_FEE_POLICY_CHANGED', 'PURCHASE_PAYMENT_QUOTE_EXPIRED', 'PURCHASE_PAYMENT_PRICING_CHANGED', 'PURCHASE_PAYMENT_EXISTING_INTENT_REQUIRED', 'ORDER_NOT_PAYABLE', 'ORDER_PAYMENT_EXPIRED', ...TRIAL_REFUSALS].includes(cause.message)
          || cause.status === 404 && (cause.message === 'ORDER_NOT_FOUND'
            || pending.kind === 'TRIAL_CONVERT' && cause.message === 'PURCHASE_PAYMENT_QUOTE_NOT_FOUND'));
      const definiteRefusal = !pending.intentNo && (paymentRefusal || rejectedQuote || cause.kind === 'business'
        && !/^(?:IDEMPOTENCY_|PAYMENT_COMMAND_)|UNKNOWN|PROCESSING/.test(cause.message));
      if (definiteRefusal) {
        // These answers are final for this purchase: a new quote could only repeat them or fall back into retrying.
        // Another open payment ends every kind of purchase here; it must not fall back to quoting again.
        const refusal = paymentRefusal ?? (pending.kind === 'ORDER_PAY' || cause.message === 'PURCHASE_PAYMENT_EXISTING_INTENT_REQUIRED'
          ? ORDER_REFUSALS[cause.message] : TRIAL_REFUSALS.includes(cause.message) ? 'changed' : undefined);
        if (paymentRefusal) {
          // Remember the refusal across reloads until the original-key lookup has an answer.
          const readOnly = { ...pending, quotaRefusal: paymentRefusal };
          state.pending = readOnly;
          try { save(readOnly); } catch { /* Keep read-only recovery for this session even if storage fails. */ }
        }
        let existing: Awaited<ReturnType<typeof api.find>>;
        try { existing = await api.find(pending.kind, pending.commandKey); }
        catch {
          // Only a read can prove no intent exists: the record stays, and the refusal still stands for the user.
          if (owns(version, accountKey)) {
            if (refusal) conclude(refusal);
          }
          return;
        }
        if (!owns(version, accountKey)) return;
        if (existing?.status === 'processing') {
          state.canResubmit = false;
          lookup = true;
          return;
        }
        if (existing) accept(existing, pending);
        else {
          // A definite refusal plus a successful empty lookup releases the caller's matching unknown command too.
          releaseUncreatedPayment(pending, accountKey);
          if (refusal) { conclude(refusal); return; }
          if (unavailable) hideChannel(pending.paymentMethod ?? (state.method as ExternalPaymentMethod));
          // A cold resume has no caller to quote again; return through the existing order exit.
          if (state.coldResume) {
            const networkPaused = unavailable && cause.message !== 'PURCHASE_PAYMENT_FEES_NOT_CONFIGURED';
            if (networkPaused) state.pausedPaymentMethod = pending.paymentMethod ?? null;
            conclude(networkPaused ? 'networkPaused' : 'changed');
          }
          else if (context && !context.current()) finish(null);
          else requote = true;
        }
      }
    }
  } finally {
    if (owns(version, accountKey)) {
      state.busy = false;
      if (requote) { if (available(state.method)) void select(state.method); else reconcileChannel(); }
      else if (lookup) void query();
      else schedule(version, accountKey, failed);
    }
  }
}
async function confirm() {
  const expected = context, accountKey = state.accountKey;
  if (!expected || state.loading || state.busy || state.pending || state.originalRecovery || account() !== accountKey) return;
  if (expected.checkCurrent) {
    const version = requestVersion, notice = state.notice;
    state.loading = true;
    try {
      const check = await expected.checkCurrent(state.method);
      if (!owns(version, accountKey) || state.notice !== notice) return;
      if (check === 'changed') { state.notice = 'changed'; return; }
      if (!acceptQuoteContext(check, expected)) return;
    } finally {
      if (owns(version, accountKey)) state.loading = false;
    }
  } else if (!expected.current()) { state.notice = 'changed'; return; }
  if (state.method === 'WALLET') { finish({ method: 'WALLET' }); return; }
  const quote = state.quote;
  if (quote?.deadlineAt && Date.parse(quote.deadlineAt) <= Date.now()) { deadlinePassed(); return; }
  if (!quote || Date.parse(quote.expiresAt) <= Date.now()) { confirmedQuote = null; state.notice = ''; void select(state.method); return; }
  // A new id is silent. Trials keep the confirmed ceiling; other purchases require the reviewed amount exactly.
  if (state.notice !== 'reminder' || !confirmedQuote || !samePaymentTerms(confirmedQuote, quote)) {
    confirmedQuote = null; state.notice = 'quoteChanged'; return;
  }
  state.notice = ''; confirmedQuote = null;
  const scope = fingerprint(expected);
  const commandKey = expected.commandKey?.() ?? acquireAccountCommandKey(KEYS, state.accountKey, scope, 'purchase');
  openCashierOnReady = quote.paymentMethod === 'HDPAY_BANK';
  clearTimeout(quoteTimer);
  const original = rows(state.accountKey).records[commandKey];
  if (original) { state.pending = original; await query(); return; }
  const orderDeadlineAt = expected.kind === 'ORDER_PAY'
    ? (quote.deadlineAt ? Date.parse(quote.deadlineAt) : expected.deadlineAt ?? undefined) : undefined;
  const pending = { fingerprint: scope, kind: expected.kind, commandKey, paymentQuoteId: quote.paymentQuoteId,
    paymentMethod: quote.paymentMethod, network: quote.network, summary: expected.summary, startedAt: Date.now(), orderDeadlineAt,
    ...(expected.kind === 'TRIAL_CONVERT' ? { quoteExpiresAt: Date.parse(quote.expiresAt) } : {}),
    claimNo: expected.claimNo, legacyTrialExpiry: expected.legacyTrialExpiry, structuredTrialRefusals: !!expected.onTrialRefusal };
  save(pending); state.pending = pending;
  if (pending.kind === 'TRIAL_CONVERT' && pending.claimNo)
    expected.onTrialSubmit?.({ claimNo: pending.claimNo, key: commandKey });
  await submitOriginal();
}
/** After a failed bank attempt: retire that intent and its key, then start a fresh choice.
 *  Only a key this flow can renew (its own, or the order's payment key) continues here; any other
 *  caller-owned key ends the flow so that page starts a new purchase. */
function restart(step: 'bank' | 'methods') {
  const pending = state.pending;
  // A local countdown or failed read never authorizes replacing an intent.
  if (!pending || state.busy || !isUnpaidPaymentTerminal(state.intent, hasLegacyTrialExpiry(pending))) return;
  const orderNo = state.orderNo;
  if (!context && !orderNo) { finish(null); return; }
  const orderKey = release(pending, state.accountKey, orderNo);
  // A reloaded dialog has no business callback. Re-read the original order and
  // its command before it may offer another payment, including promoted orders.
  if (!context) {
    finish(null);
    void navReplace(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}&pay=1`);
    return;
  }
  if (!orderKey && context.commandKey) { finish(null); return; }
  Object.assign(state, { pending: null, intent: null, quote: null, notice: '', cashier: false });
  if (step === 'bank') void select('HDPAY_BANK', 'bank'); else choose('WALLET');
}
function choosePaymentMethodAgain() {
  if (state.notice !== 'originalUnavailable' || !context || state.accountKey !== account()) return;
  Object.assign(state, { notice: '', concluded: false, quote: null, deadlineAt: context.deadlineAt ?? null });
  choose('WALLET');
}
function open(value: Pick<PurchasePaymentContext, 'summary' | 'kind' | 'payload' | 'orderNo' | 'image' | 'deadlineAt' | 'walletOnly'> & { amount?: number | string }, pending: PendingExternal | null) {
  const accountKey = account();
  accountBindingEpoch = useApp().accountBindingEpoch;
  stopTimers(); requestVersion++; policyVersion++; quoteFailures = pollFailures = 0; paused = false; openCashierOnReady = false;
  activeTrialRefreshPending = false;
  policyRead = null;
  reviewedQuote = confirmedQuote = null;
  const productNo = value.kind === 'TRIAL_CONVERT' ? value.payload.productNo : value.payload.targetProductNo;
  Object.assign(state, { open: true, coldResume: context === null, accountKey, summary: value.summary, amount: value.amount ?? '', method: 'WALLET', step: 'methods', kind: value.kind,
    orderNo: value.orderNo ?? '', productNo: typeof productNo === 'string' ? productNo.trim() : '', image: value.image ?? '', deadlineAt: value.deadlineAt ?? null,
    policy: null, walletOnly: value.walletOnly === true, orderPayUsdtRoute: null, orderTopupNetworks: [], notice: '', retryNotice: '', cashier: false,
    pausedPaymentMethod: null, quote: null, intent: null, pending, originalRecovery: null, orderTopupIntent: null,
    loading: false, retrying: false, reading: false, busy: false, canResubmit: false, concluded: false });
}
export function requestPurchasePayment(value: PurchasePaymentContext): Promise<PurchaseChoice | null> {
  if (state.open) throw new Error('PURCHASE_PAYMENT_ALREADY_OPEN');
  const records = rows(account()).records;
  const scope = fingerprint(value);
  const refused = value.refusedPaymentKey ? records[value.refusedPaymentKey] : undefined;
  if (refused && !isVisiblePayment(refused)) return Promise.resolve(null);
  const existing = value.refusedPaymentKey ? refused : Object.values(records).find(row => {
    if (!isVisiblePayment(row) || row.kind !== value.kind || isExpiredPaymentRecord(row) || row.lastStatus === 'REFUNDED'
        || row.lastStatus === 'DELIVERED' && row.validated || isReleasedLateTrialPayment(row)) return false;
    if (row.fingerprint === scope) return true;
    const sku = value.payload.productNo;
    return row.kind === 'TRIAL_CONVERT' && value.claimNo && typeof sku === 'string' && purchaseRecordPayload(row).productNo === sku
      && (paymentRecordClaimNo(row) === value.claimNo || !paymentRecordClaimNo(row) && legacyTrialExternalMatches(account(), row.commandKey, value.claimNo, sku));
  });
  if (value.refusedPaymentKey && (!existing?.quotaRefusal || existing.fingerprint !== scope)) throw new Error('ORIGINAL_PAYMENT_MISMATCH');
  context = value;
  open(value, existing && value.legacyTrialExpiry !== undefined ? { ...existing, legacyTrialExpiry: value.legacyTrialExpiry } : existing ?? null);
  const result = waitForChoice();
  if (existing) void query();
  return result;
}
type DeliveredPayment = Extract<PurchaseChoice, { method: 'EXTERNAL' }>;
type CheckoutCapacityResume = { onDelivered: (result: DeliveredPayment) => void; onExpired: () => void };
async function resume(pending: PendingExternal, checkout?: CheckoutCapacityResume, refreshed?: PurchasePaymentIntent, onTerminalDismiss?: () => void) {
  if (state.open || !isVisiblePayment(pending)) return;
  context = null;
  const payload = JSON.parse(pending.fingerprint)[1] as Record<string, unknown>;
  open({ summary: pending.summary, kind: pending.kind, payload, orderNo: pending.kind === 'ORDER_PAY' && typeof payload.orderNo === 'string' ? payload.orderNo : undefined }, pending);
  waitForResumedChoice(checkout, onTerminalDismiss);
  if (refreshed) {
    accept(refreshed, pending);
    schedule(requestVersion, state.accountKey, false);
  } else await query(pending.kind === 'TRIAL_CONVERT');
}
function openOrderTopupIntent(orderNo: string, summary: string, intent: OrderTopupIntent) {
  if (state.open) return;
  const payload = { orderNo };
  const value = { summary, kind: 'ORDER_PAY' as const, payload, orderNo };
  open(value, { fingerprint: fingerprint({ ...value, amount: '', current: () => true }), kind: value.kind,
    commandKey: '', paymentQuoteId: '', paymentMethod: intent.paymentMethod, summary, lookupOnly: true });
  state.orderTopupIntent = intent;
  void query();
}
function waitForResumedChoice(checkout?: CheckoutCapacityResume, onTerminalDismiss?: () => void) {
  // No active purchase callback after reload. A delivered intent returns to the original order.
  const trial = state.kind === 'TRIAL_CONVERT';
  void waitForChoice(checkout?.onExpired, onTerminalDismiss).then(result => {
    if (result?.method !== 'EXTERNAL' || !result.receipt || typeof result.receipt !== 'object') return;
    acknowledgePurchasePayment(result);
    if (checkout) { checkout.onDelivered(result); return; }
    if (trial) return; // The trial result is delivered through its visible page or App.
    const orderNo = (result.receipt as { orderNo?: unknown }).orderNo;
    if (typeof orderNo === 'string' && orderNo) void navTo(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}`);
  });
}
/** Open the original payment and hand final results back to its owning checkout. */
export function resumeCheckoutCapacityPayment(accountKey: string, kind: 'CAPACITY_KEEP' | 'CAPACITY_REPLACE',
  commandKey: string, intentNo: string | undefined, checkout: CheckoutCapacityResume): boolean {
  if (state.open || accountKey !== account()) return false;
  const pending = pendingPayments().find(row => row.commandKey === commandKey && row.kind === kind);
  if (!pending || intentNo && pending.intentNo && pending.intentNo !== intentNo) return false;
  void resume(intentNo ? { ...pending, intentNo } : pending, checkout);
  return true;
}

/** A trial's state names its original intent even on a device that never opened the payment. */
export async function resumeTrialPurchasePayment(
  paymentNo: string,
  claimNo: string,
  productNo: string,
  summary: string,
  current: () => boolean,
  checkout: CheckoutCapacityResume,
): Promise<void> {
  if (state.open || !current()) return;
  const intent = await api.get(paymentNo);
  if (!current() || state.open) return;
  if (!intent || intent.intentNo !== paymentNo || intent.kind !== 'TRIAL_CONVERT' || intent.claimNo && intent.claimNo !== claimNo)
    throw new Error('PURCHASE_PAYMENT_RESPONSE_INVALID');
  if (isUnpaidPaymentTerminal(intent) || intent.trialPurchaseOutcome === 'LATE_PAYMENT_REVIEW') { checkout.onExpired(); return; }
  await resumeTrialIntent(intent, claimNo, productNo, summary, checkout);
}

/** Explicit recovery links read the authenticated original without refreshing the provider. */
export async function readTrialPurchasePayment(paymentNo: string, claimNo: string) {
  const intent = await api.snapshot(paymentNo);
  return intent?.intentNo === paymentNo && intent.kind === 'TRIAL_CONVERT' && intent.claimNo === claimNo ? intent : null;
}

export async function showTerminalTrialPurchasePayment(intent: PurchasePaymentIntent, claimNo: string, productNo: string, summary: string, onDismiss: () => void) {
  if (state.open || !isVisiblePayment(intent)
      || (!intent.trialPurchaseOutcome && intent.refundStatus !== 'REFUNDED')) return false;
  await resumeTrialIntent(intent, claimNo, productNo, summary, undefined, onDismiss);
  return true;
}

async function resumeTrialIntent(intent: PurchasePaymentIntent, claimNo: string, productNo: string, summary: string, checkout?: CheckoutCapacityResume, onTerminalDismiss?: () => void) {
  const paymentNo = intent.intentNo;
  const existing = rows(account()).records[intent.commandKey];
  await resume(existing?.kind === 'TRIAL_CONVERT' && (!existing.intentNo || existing.intentNo === paymentNo) ? { ...existing, intentNo: paymentNo } : {
    fingerprint: JSON.stringify(['TRIAL_CONVERT', { productNo, expectedAmountUsdt: intent.subtotalUsdt }, claimNo]),
    kind: intent.kind, commandKey: intent.commandKey, paymentQuoteId: intent.paymentQuoteId,
    intentNo: paymentNo, paymentMethod: intent.paymentMethod, network: intent.network, summary, claimNo, lookupOnly: true,
  }, checkout, intent, onTerminalDismiss);
}
// The App runtime keeps a page's query on $page.options; H5 also sets options.
function pageQuery(page: unknown) {
  const value = page as { options?: Record<string, string>; $page?: { options?: Record<string, string> } } | undefined;
  return value?.options ?? value?.$page?.options;
}
function onOrderPage(orderNo: string) {
  const pages = getCurrentPages(), top = pages[pages.length - 1] as { route?: string } | undefined;
  return top?.route === 'pages/store/order-detail' && pageQuery(top)?.id === orderNo;
}
export function usePurchasePayment() {
  return { state, select, choose, proceed, confirm, query, retryOriginal, restart, choosePaymentMethodAgain, loadPolicy, close: () => finish(null), dismissRoutedTerminalTrialPayment,
    back: () => choose('WALLET'), available, goOrderTopup, openOrderTopupIntent,
    notify: (notice: PurchaseNotice) => { state.notice = notice; },
    openCashier: () => { if (state.intent?.paymentUrl && purchasePaymentTiming(state.intent, Date.now(), state.deadlineAt).canPay) state.cashier = true; },
    closeCashier: () => { state.cashier = false; paused = false; if (!state.busy) void query(); },
    confirmCashierPayment: () => { state.cashier = false; paused = false; void query(true); },
    legacyTrialExpiry: () => hasLegacyTrialExpiry(state.pending),
    pause: () => { paused = true; clearTimeout(pollTimer); pollTimer = undefined; },
    wake: () => { paused = false; if (state.open) void query(); },
    topup: (shortfall: number) => {
      if (state.kind === 'TRIAL_CONVERT' && context?.topupHref) {
        const href = context.topupHref(shortfall);
        if (href) closeAndNavigate(href);
        return;
      }
      const { orderNo, amount, deadlineAt, summary } = state;
      const query = `amount=${Number(amount)}&shortfall=${shortfall.toFixed(6)}&name=${encodeURIComponent(summary)}`
        + (orderNo ? `&orderNo=${encodeURIComponent(orderNo)}` : '')
        + (deadlineAt ? `&deadline=${deadlineAt}` : '');
      closeAndNavigate(`/pages/me/wallet-topup?${query}`);
    },
    // Every close at the top of a payment page ends on the store home (user 2026-11-22); records and the bar stay.
    leaveToStore: () => closeAndNavigate('/pages/store/store'),
    openOrders: () => closeAndNavigate('/pages/store/orders'),
    openOrder: () => { const orderNo = state.orderNo; if (orderNo && !onOrderPage(orderNo)) closeAndNavigate(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}`, true); else finish(null); },
    support: () => closeAndNavigate('/pages/me/support'),
    openConditions,
    reorder: () => { const again = context?.reorder, orderNo = state.orderNo; finish(null); if (again) again(); else if (orderNo && !onOrderPage(orderNo)) void navTo(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}`); },
    pending: pendingPayments, unsettledCheckoutPayments, resume,
    resumeDismissed: (row: PendingExternal) => dismissedResume.has(resumeKey(row)),
    dismissResume: (rows: PendingExternal[]) => { rows.forEach(row => dismissedResume.add(resumeKey(row))); },
    records: () => { try { return displayRecords(); } catch { return []; } },
    viewOrder: () => { const intent = state.intent, pending = state.pending; if (!intent?.receipt || !pending) return; const orderNo = validatePurchasePaymentReceipt(pending.kind, JSON.parse(pending.fingerprint)[1], intent.receipt); finish(null); void navTo(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}`); },
  };
}
export function acknowledgePurchasePayment(result: Extract<PurchaseChoice, { method: 'EXTERNAL' }>) {
  try {
    const pending = rows(result.accountKey).records[result.commandKey];
    if (pending) {
      closeTrialPaymentCaller(pending, result.accountKey);
      save({ ...pending, validated: true, businessDelivered: true }, result.accountKey);
    }
  } catch {
    toast.error(getT().errors.billMissingTitle);
  }
}

export function purchaseRecordPayload(row: PendingExternal): Record<string, unknown> {
  try {
    const payload: unknown = JSON.parse(row.fingerprint)[1];
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) return payload as Record<string, unknown>;
  } catch { /* An unreadable local record has no purchase fields to display. */ }
  return {};
}

function paymentRecordClaimNo(row: PendingExternal): string | undefined {
  if (row.claimNo) return row.claimNo;
  try {
    const claim: unknown = JSON.parse(row.fingerprint)[2];
    return typeof claim === 'string' ? claim : undefined;
  } catch { return undefined; }
}

function hasLegacyTrialExpiry(row: PendingExternal | null): boolean {
  if (row?.kind !== 'TRIAL_CONVERT') return false;
  const options = useTrialPurchaseOptions();
  if (options.claimNo && options.claimNo === paymentRecordClaimNo(row)) {
    if (options.current.status === 'unsupported') return true;
    if (options.current.status === 'ready' || options.current.status === 'not-convertible') return false;
  }
  return row.legacyTrialExpiry === true;
}

function isExpiredPaymentRecord(row: PendingExternal): boolean {
  return row.lastStatus === 'EXPIRED' && (row.kind !== 'TRIAL_CONVERT' || row.expiryConfirmed === true
    || row.trialPurchaseOutcome === 'UNPAID_TERMINAL');
}

export function isUnfinishedPurchaseRecord(row: PendingExternal): boolean {
  return !row.validated && !row.businessDelivered && !row.quotaRefusal && !isReleasedLateTrialPayment(row)
    && !isExpiredPaymentRecord(row) && row.lastStatus !== 'DELIVERED' && row.lastStatus !== 'REFUNDED';
}

export function isReleasedLateTrialPayment(row: PendingExternal): boolean {
  return row.kind === 'TRIAL_CONVERT' && row.trialPurchaseOutcome === 'LATE_PAYMENT_REVIEW' && row.lastStatus === 'MANUAL_REVIEW';
}

function isOrderPaymentDiscoveryOnly(row: PendingExternal): boolean {
  return row.kind === 'ORDER_PAY' && !!row.lookupOnly && row.startedAt === undefined && row.resumedOnThisDevice !== true;
}

/** Orders shows discovered order payments and checks their expiry after an explicit local resume. */
export function isOrdersPurchaseRecord(row: PendingExternal): boolean {
  if (row.kind === 'ORDER_PAY') return !isOrderPaymentDiscoveryOnly(row);
  return !row.lookupOnly || row.startedAt !== undefined || !!row.intentNo;
}

export function orderPaymentDeadline(row: PendingExternal, order?: Pick<Order, 'expiresAt' | 'placedAt'>): number | undefined {
  if (row.orderDeadlineAt !== undefined && Number.isFinite(row.orderDeadlineAt)) return row.orderDeadlineAt;
  const deadlineAt = purchaseRecordPayload(row).deadlineAt;
  const time = typeof deadlineAt === 'string' ? Date.parse(deadlineAt) : deadlineAt;
  if (typeof time === 'number' && Number.isFinite(time)) return time;
  if (order) return order.expiresAt ?? order.placedAt + 30 * 60_000;
}

/** Keep the expired order's facts before B81 can remove it from later reads. */
export function rememberOrderPaymentBeforeHide(accountKey: string, order: Order) {
  if (accountKey !== account()) return;
  try {
    for (const row of displayRecords()) {
      if (row.kind !== 'ORDER_PAY' || row.lastStatus !== 'EXPIRED' || !row.intentNo || row.validated || row.businessDelivered
        || !isOrdersPurchaseRecord(row) || purchaseRecordPayload(row).orderNo !== order.id) continue;
      save({ ...row, orderDeadlineAt: orderPaymentDeadline(row, order),
        hiddenOrder: { sku: order.lineItems?.[0]?.sku ?? order.productId, total: order.total, placedAt: order.placedAt } }, accountKey);
    }
  } catch {
    toast.error(getT().errors.txNotSavedTitle);
  }
}

/** An order with a known unfinished payment cannot be hidden, even during confirmation. */
export function hasUnfinishedOrderPayment(accountKey: string, orderNo: string): boolean {
  state.revision;
  try {
    const expired = unsavedExpiries.get(accountKey);
    return Object.values(rows(accountKey).records).some(row => row.kind === 'ORDER_PAY'
      && isUnfinishedPurchaseRecord(row) && expired?.get(row.commandKey) !== row.kind
      && purchaseRecordPayload(row).orderNo === orderNo);
  } catch {
    return true;
  }
}

/** The order detail asks whether this order already has an external payment underway. */
export function pendingOrderPayment(accountKey: string, orderNo: string, knownOnly = false): PendingExternal | null {
  try {
    const records = Object.values(rows(accountKey).records).filter(row => row.kind === 'ORDER_PAY' && isVisiblePayment(row) && JSON.parse(row.fingerprint)[1]?.orderNo === orderNo
      && !row.quotaRefusal && !['EXPIRED', 'DELIVERED', 'REFUNDED'].includes(row.lastStatus ?? '') && !row.businessDelivered
      && (row.lastStatus !== 'MANUAL_REVIEW' || row.lookupOnly && !!row.intentNo));
    return records.find(row => row.intentNo) ?? (knownOnly ? null : records[0] ?? null);
  } catch { return null; }
}

/** Attach the server's original payment to this order for the existing resume action. */
export async function discoverOrderPayment(accountKey: string, orderNo: string, summary: string, current: () => boolean): Promise<'active' | 'none' | 'unavailable'> {
  let active = false;
  try {
    const intentNo = await api.activeByOrder(orderNo);
    if (!current()) return 'unavailable';
    if (!intentNo) return 'none';
    active = true;
    if (pendingOrderPayment(accountKey, orderNo, true)?.intentNo === intentNo) return 'active';
    const intent = await api.get(intentNo);
    if (current() && intent && !isVisiblePayment(intent)) return 'none';
    if (current() && intent?.intentNo === intentNo && intent.kind === 'ORDER_PAY'
        && intent.status !== 'EXPIRED' && intent.status !== 'DELIVERED') {
      save({ fingerprint: JSON.stringify(['ORDER_PAY', { orderNo }]), kind: intent.kind, commandKey: intent.commandKey,
        paymentQuoteId: intent.paymentQuoteId, paymentMethod: intent.paymentMethod, network: intent.network, intentNo,
        summary, lastStatus: intent.refundStatus === 'REFUNDED' ? 'REFUNDED' : intent.status, lookupOnly: true }, accountKey);
    }
  } catch {
    // Discovery is silent. A failed lookup cannot declare the original payment absent.
  }
  return active && current() ? 'active' : 'unavailable';
}
