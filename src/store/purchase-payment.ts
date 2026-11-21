import { reactive } from 'vue';
import { apiClient } from '@/api/runtime';
import { asApiError, isApiRefusal, type ApiError } from '@/api/errors';
import { createCregisDepositApi } from '@/api/cregis-deposit-api';
import { createPurchasePaymentApi, type ExternalPaymentMethod, type PurchaseKind, type PurchaseMethod, type PurchasePaymentIntent, type PurchaseQuote } from '@/api/purchase-payment-api';
import { useApp } from './app';
import { useOrders } from './orders';
import { readAccountRow, writeAccountRow, acquireAccountCommandKey, releaseAccountCommandKey } from './account-scoped-storage';
import { clearOrderAction, readOrderAction } from '@/lib/order-command-fence';
import { navTo, navReplace } from '@/lib/route';
import { formatAmount } from '@/lib/amount-display';
import { validatePurchasePaymentReceipt } from '@/lib/purchase-payment-receipt';
import { releasePurchaseCallerRecord } from '@/lib/purchase-caller-record';
import { purchasePaymentTiming } from '@/lib/purchase-payment-timing';
import { tradeinPaymentRejection, TRADEIN_RUNTIME_RECOVERING } from '@/lib/order-payment-rejection';
import { getT } from '@/i18n/use-t';
import { toast } from './ui';

/** `orderNo`, `deadlineAt` and `image` only feed the payment screens; `reorder` runs after a timed-out order. */
export type PurchasePaymentContext = { kind: PurchaseKind; payload: Record<string, unknown>; amount: number | string; summary: string; current: () => boolean; commandKey?: () => string;
  refusedPaymentKey?: string; tradeinKey?: string; onReplacementRefused?: (reason: NonNullable<ReturnType<typeof tradeinPaymentRejection>>) => void; orderNo?: string; deadlineAt?: number | null; image?: string; reorder?: () => void; navigate?: (href: string) => void };
type PendingExternal = { fingerprint: string; kind: PurchaseKind; commandKey: string; paymentQuoteId: string;
  paymentMethod?: PurchaseQuote['paymentMethod']; network?: PurchaseQuote['network'];
  intentNo?: string; lookupOnly?: boolean; quotaRefusal?: DefinitePaymentNotice; summary: string; lastStatus?: string; validated?: boolean; businessDelivered?: boolean };
type PendingRow = { records: Record<string, PendingExternal> };
export type PurchaseChoice = { method: 'WALLET' } | { method: 'EXTERNAL'; receipt: unknown; commandKey: string; accountKey: string };
export type PurchaseStep = 'methods' | 'network' | 'bank';
type DefinitePaymentNotice = 'rejectQuotaPaused' | 'rejectQuotaMonthFull' | 'rejectQuotaSoldOut' | 'rejectConditionsUnmet' | 'rejectGateConditionsUnmet' | 'rejectPurchaseSetup' | 'trialConversionClosed' | 'trialNotConvertible';
type EligibilityRetry = 'rejectEligibilityUnavailable';
export type PurchaseNotice = '' | 'reminder' | 'timeShort' | 'timeout' | 'bankFailed' | 'review' | 'late' | 'delivery' | 'leave' | 'changed' | 'quoteChanged' | 'orderExpired' | 'orderClosed' | 'orderMissing' | 'gone' | 'networkPaused' | 'existing' | 'rejectTradeinBusy' | 'rejectTradeinWalletOnly' | 'rejectTradeinOwner' | 'rejectCapacitySourceChanged' | DefinitePaymentNotice;
const TABLE = 'uvel-purchase-payment-accounts-v1', KEYS = 'uvel-purchase-payment-keys-accounts-v1';
const POLL_MS = 5000, POLL_BACKOFF = [5000, 10000, 20000, 30000], SHORT_DEADLINE_MS = 5 * 60000;
const REVIEW_REASONS = ['PAYMENT_AMOUNT_MISMATCH', 'PAYMENT_MULTIPLE_ARRIVALS', 'PAYMENT_BEFORE_ALLOCATION', 'PAYMENT_REORG_REVIEW', 'PAYMENT_TIME_UNVERIFIED', 'PAYMENT_REFUNDED_REVIEW'];
// Another payment for this purchase is still open, perhaps from another device: say so rather than asking to review the order.
const ORDER_REFUSALS: Record<string, PurchaseNotice> = { ORDER_PAYMENT_EXPIRED: 'orderExpired', ORDER_NOT_PAYABLE: 'orderClosed', ORDER_NOT_FOUND: 'orderMissing', PURCHASE_PAYMENT_EXISTING_INTENT_REQUIRED: 'existing' };
const TRIAL_REFUSALS = ['TRIAL_QUOTE_CHANGED', 'TRIAL_AMOUNT_MISMATCH'];
function paymentRefusalNotice(cause: ApiError, kind: PurchaseKind): DefinitePaymentNotice | EligibilityRetry | undefined {
  if (cause.kind !== 'http' || cause.status !== cause.code) return;
  if (cause.status === 409) {
    switch (cause.message) {
      case 'ORDER_MONTHLY_QUOTA_PAUSED': return 'rejectQuotaPaused';
      case 'ORDER_MONTHLY_QUOTA_REQUIREMENTS_NOT_MET': return 'rejectConditionsUnmet';
      case 'ORDER_MONTHLY_QUOTA_EXHAUSTED': return 'rejectQuotaMonthFull';
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
const api = createPurchasePaymentApi(apiClient);
const deposits = createCregisDepositApi(apiClient);
const state = reactive({ open: false, coldResume: false, accountKey: '', summary: '', amount: '' as string | number, method: 'WALLET' as PurchaseMethod,
  step: 'methods' as PurchaseStep, kind: 'ORDER_PAY' as PurchaseKind, orderNo: '', productNo: '', image: '', deadlineAt: null as number | null,
  policy: null as Partial<Record<ExternalPaymentMethod, boolean>> | null, notice: '' as PurchaseNotice, cashier: false,
  retryNotice: '' as '' | EligibilityRetry,
  pausedPaymentMethod: null as ExternalPaymentMethod | null,
  quote: null as PurchaseQuote | null, intent: null as PurchasePaymentIntent | null, pending: null as PendingExternal | null,
  loading: false, retrying: false, busy: false, error: false, unavailable: false, pendingReadError: false, concluded: false, revision: 0 });
let context: PurchasePaymentContext | null = null;
let reviewedQuote: PurchaseQuote | null = null, confirmedQuote: PurchaseQuote | null = null;
let activeChoice: { promise: Promise<PurchaseChoice | null>; resolve: (result: PurchaseChoice | null) => void } | null = null;
let requestVersion = 0, quoteFailures = 0, pollFailures = 0, paused = false, openCashierOnReady = false;
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
  if (!writeAccountRow(TABLE, accountKey, { records: { ...value.records, [pending.commandKey]: pending } })) throw new Error('ACCOUNT_COMMAND_STORAGE_UNAVAILABLE');
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
    if (observed || record.lastStatus !== 'EXPIRED') {
      save({ ...(observed ?? record), lastStatus: 'EXPIRED' }, accountKey);
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
function release(pending: PendingExternal) {
  const orderNo = state.orderNo;
  const orderKey = pending.kind === 'ORDER_PAY' && !!orderNo && readOrderAction(state.accountKey, orderNo)?.key === pending.commandKey;
  retire(pending, state.accountKey);
  if (orderKey) clearOrderAction(state.accountKey, orderNo, pending.commandKey, true);
  return orderKey;
}
function fingerprint(value: PurchasePaymentContext): string {
  const stable = (raw: unknown): unknown => raw && typeof raw === 'object' && !Array.isArray(raw)
    ? Object.fromEntries(Object.keys(raw).sort().map(key => [key, stable((raw as Record<string, unknown>)[key])]))
    : Array.isArray(raw) ? raw.map(stable) : raw;
  return JSON.stringify([value.kind, stable(value.payload)]);
}
function owns(version: number, accountKey: string) { return state.open && requestVersion === version && account() === accountKey && state.accountKey === accountKey; }
function matches(intent: PurchasePaymentIntent, pending: PendingExternal) {
  if (intent.commandKey !== pending.commandKey || intent.kind !== pending.kind || intent.paymentQuoteId !== pending.paymentQuoteId
    || pending.paymentMethod !== undefined && intent.paymentMethod !== pending.paymentMethod
    || pending.network !== undefined && intent.network !== pending.network
    || pending.intentNo && intent.intentNo !== pending.intentNo) throw new Error('PURCHASE_PAYMENT_RESPONSE_INVALID');
}
function readIntent(pending: PendingExternal) {
  return pending.intentNo ? api.get(pending.intentNo) : api.find(pending.kind, pending.commandKey);
}
function displayRecords() {
  state.revision;
  const accountKey = account();
  const expired = unsavedExpiries.get(accountKey);
  return Object.values(rows(accountKey).records).filter(row => !row.quotaRefusal).map(row => expired?.get(row.commandKey) === row.kind
    ? { ...row, lastStatus: 'EXPIRED' } : row);
}
function pendingPayments() {
  try {
    const records = displayRecords();
    state.pendingReadError = false;
    return records.filter(row => row.lastStatus !== 'EXPIRED' && !(row.lastStatus === 'DELIVERED' && row.validated));
  } catch {
    state.pendingReadError = true;
    return [];
  }
}
function unsettledCheckoutPayments(includeTradein: boolean) {
  return pendingPayments().filter(row => (row.kind === 'ORDER_PAY' || (includeTradein && row.kind === 'TRADE_IN'))
    && row.lastStatus !== 'MANUAL_REVIEW' && row.lastStatus !== 'DELIVERED' && !row.businessDelivered);
}

/** The progress bar can outlive both a closed payment layer and a released checkout pointer. */
export async function refreshExpiredCheckoutPayments(accountKey: string, current: () => boolean, includeTradein: boolean) {
  if (!current() || account() !== accountKey || state.open) return;
  await Promise.allSettled(unsettledCheckoutPayments(includeTradein).map(async pending => {
    const result = await readIntent(pending);
    if (!current() || account() !== accountKey || state.open || result?.status !== 'EXPIRED') return;
    matches(result, pending);
    saveExpiry(accountKey, pending.commandKey, pending.kind);
  }));
}
function settled(intent: PurchasePaymentIntent | null) {
  return !!intent && ['EXPIRED', 'MANUAL_REVIEW', 'DELIVERED'].includes(intent.status);
}
/** The outcome an intent has reached that ends the payment here; a failed bank attempt reports EXPIRED with its own reason. */
export function purchaseConclusion(intent: PurchasePaymentIntent | null): PurchaseNotice {
  if (intent?.status === 'EXPIRED') return intent.reason === 'PAYMENT_FAILED' ? 'bankFailed' : 'timeout';
  if (intent?.status === 'MANUAL_REVIEW') return intent.reason === 'PAYMENT_LATE_REVIEW' ? 'late' : REVIEW_REASONS.includes(intent.reason ?? '') ? 'review' : 'delivery';
  return '';
}
function accept(intent: PurchasePaymentIntent, pending: PendingExternal) {
  matches(intent, pending);
  // Legacy recovery rows have only the quote identity; bind their first validated original intent for subsequent reads.
  const known = { ...pending, paymentMethod: intent.paymentMethod, network: intent.network,
    intentNo: intent.intentNo, lastStatus: intent.status, businessDelivered: intent.status === 'DELIVERED' || intent.fulfilmentStatus === 'DELIVERED' };
  delete known.quotaRefusal;
  if (known.businessDelivered) {
    const payload = JSON.parse(known.fingerprint)[1] as Record<string, unknown>;
    validatePurchasePaymentReceipt(known.kind, payload, intent.receipt, intent);
  }
  if (intent.status === 'EXPIRED') saveExpiry(state.accountKey, known.commandKey, known.kind, known);
  else {
    try { save(known); }
    catch (error) {
      if (!settled(intent)) throw error;
      toast.error(known.businessDelivered ? getT().errors.billMissingTitle : getT().errors.txNotSavedTitle);
    }
  }
  state.pending = known; state.intent = intent; state.method = intent.paymentMethod;
  if (intent.deadlineAt) state.deadlineAt = Date.parse(intent.deadlineAt);
  if (intent.status === 'DELIVERED') {
    finish({ method: 'EXTERNAL', receipt: intent.receipt, commandKey: known.commandKey, accountKey: state.accountKey });
    return;
  }
  if (!purchasePaymentTiming(intent, Date.now(), state.deadlineAt).canPay) state.cashier = false;
  else if (openCashierOnReady && intent.paymentUrl) { openCashierOnReady = false; state.cashier = true; }
  const conclusion = purchaseConclusion(intent);
  if (conclusion) state.notice = conclusion;
}
/** The server holds no payment for this command: release it and its fences. Only the user may start another one, from the order. */
function gone(pending: PendingExternal, accountKey: string) {
  try {
    release(pending);
    releasePurchaseCallerRecord(accountKey, pending.kind, pending.commandKey);
    releaseListeners.forEach(listener => listener(accountKey, pending.commandKey));
  } catch {
    // Local cleanup can fail after the server has already answered definitively.
  }
  Object.assign(state, { pending: null, intent: null, quote: null, error: false });
  conclude('gone');
}
function releaseUncreatedPayment(pending: PendingExternal, accountKey: string) {
  releasePurchaseCallerRecord(accountKey, pending.kind, pending.commandKey);
  releaseListeners.forEach(listener => listener(accountKey, pending.commandKey));
  release(pending);
  Object.assign(state, { pending: null, quote: null, intent: null });
}
/** The payment ended with an answer: nothing of it stays behind the notice and no further read or write runs. */
function conclude(notice: PurchaseNotice) { stopTimers(); Object.assign(state, { notice, retryNotice: '', concluded: true, cashier: false }); }
function stopTimers() { clearTimeout(quoteTimer); clearTimeout(pollTimer); quoteTimer = pollTimer = undefined; }
function finish(result: PurchaseChoice | null) {
  requestVersion++; stopTimers(); openCashierOnReady = false;
  reviewedQuote = confirmedQuote = null;
  Object.assign(state, { open: false, loading: false, retrying: false, busy: false, cashier: false, notice: '', concluded: false });
  const choice = activeChoice; activeChoice = null; context = null; choice?.resolve(result);
}
function waitForChoice(): Promise<PurchaseChoice | null> {
  let resolve!: (result: PurchaseChoice | null) => void;
  const promise = new Promise<PurchaseChoice | null>(done => { resolve = done; });
  activeChoice = { promise, resolve };
  return promise;
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
    return pending?.quotaRefusal ? pending : null;
  } catch { return null; }
}

function readPendingPayment() {
  return state.unavailable ? submitOriginal() : query();
}
// A checkout owner may defer navigation until its payment operation releases
// the page leave guard. Cold resumes use ordinary navigation directly.
function closeAndNavigate(href: string) {
  const navigate = context?.navigate;
  finish(null);
  if (navigate) navigate(href); else void navTo(href);
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
      if (order && (order.lineItems?.length ?? 1) === 1) productNo = order.lineItems?.[0]?.sku ?? order.productId;
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
/** Reads continue on their own: every 5 s while the payment is open, backing off after failures, paused in the background. */
function schedule(version: number, accountKey: string, failed: boolean) {
  pollFailures = failed ? pollFailures + 1 : 0;
  clearTimeout(pollTimer); pollTimer = undefined;
  if (paused || !owns(version, accountKey) || !state.pending || settled(state.intent) || state.concluded) return;
  pollTimer = setTimeout(() => { if (owns(version, accountKey)) void readPendingPayment(); },
    failed ? POLL_BACKOFF[Math.min(pollFailures - 1, POLL_BACKOFF.length - 1)]! : POLL_MS);
}
async function loadPolicy() {
  const accountKey = state.accountKey;
  const [fees, networks] = await Promise.allSettled([api.policy(), deposits.policy()]);
  if (!state.open || state.accountKey !== accountKey) return;
  // A failed read leaves the existing quote-led availability behaviour in place.
  const policy: Partial<Record<ExternalPaymentMethod, boolean>> = fees.status === 'fulfilled' ? fees.value : { HDPAY_BANK: true, CREGIS_USDT_BSC: true, CREGIS_USDT_ERC20: true };
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
  reconcileChannel();
}
function available(method: PurchaseMethod) {
  if (method === 'CREGIS_USDT_TRC20') return state.policy?.[method] === true;
  return method === 'WALLET' || !state.policy || state.policy[method] === true;
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
  if (state.concluded || state.pending || state.step === 'methods' || available(state.method)) return;
  state.notice = ''; reviewedQuote = confirmedQuote = null;
  const other = state.method === 'HDPAY_BANK' ? null : (['CREGIS_USDT_ERC20', 'CREGIS_USDT_BSC', 'CREGIS_USDT_TRC20'] as const)
    .find(method => method !== state.method && available(method));
  if (other && available(other)) void select(other);
  else choose('WALLET');
}
async function select(method: PurchaseMethod, step?: PurchaseStep) {
  if (state.busy || state.pending || state.concluded || !context) return;
  if (state.deadlineAt !== null && state.deadlineAt <= Date.now()) { deadlinePassed(); return; }
  if (step) state.step = step;
  if (method !== state.method) { quoteFailures = 0; reviewedQuote = confirmedQuote = null; state.retryNotice = ''; }
  state.method = method; state.quote = null; state.error = false; state.retrying = false; state.unavailable = false;
  clearTimeout(quoteTimer);
  const version = ++requestVersion, accountKey = state.accountKey, expected = context;
  if (method === 'WALLET' || !available(method)) { state.loading = false; return; }
  state.loading = true;
  try {
    if (!expected.current()) throw new Error('PURCHASE_CONTEXT_CHANGED');
    const quote = await api.quote(expected.kind, method, expected.payload);
    if (!owns(version, accountKey)) return;
    // A trial's offset grows with accrual under one quote version, so only its rise needs a new confirmation.
    const amountChanged = expected.kind === 'TRIAL_CONVERT' ? Number(quote.subtotalUsdt) > Number(expected.amount) : formatAmount(quote.subtotalUsdt) !== formatAmount(expected.amount);
    if (quote.kind !== expected.kind || quote.paymentMethod !== method || amountChanged || !expected.current()) throw new Error('PURCHASE_CONTEXT_CHANGED');
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
    const cause = asApiError(error);
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
  if (option === 'WALLET') { state.step = 'methods'; void select('WALLET'); return; }
  if (option === 'HDPAY_BANK') { void select('HDPAY_BANK', 'bank'); return; }
  // Preserve ERC20/BEP20 priority; TRC20 is selectable only when explicitly open.
  const network = (['CREGIS_USDT_ERC20', 'CREGIS_USDT_BSC', 'CREGIS_USDT_TRC20'] as const)
    .find(available) ?? 'CREGIS_USDT_ERC20';
  void select(network, 'network');
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
async function query() {
  const pending = state.pending;
  if (!pending || state.busy || state.concluded || settled(state.intent)) return;
  const version = requestVersion, accountKey = state.accountKey;
  let failed = false;
  state.busy = true; state.unavailable = false;
  try {
    const result = await readIntent(pending);
    if (!owns(version, accountKey) || state.concluded) return;
    state.error = false;
    if (result) accept(result, pending);
    else if (pending.quotaRefusal) {
      releaseUncreatedPayment(pending, accountKey);
      conclude(pending.quotaRefusal);
    }
    else if (pending.intentNo || pending.lookupOnly) gone(pending, accountKey);
    else state.unavailable = true;
  } catch {
    failed = true;
    if (owns(version, accountKey) && !state.concluded) {
      state.error = true;
      if (pending.quotaRefusal) conclude(pending.quotaRefusal);
    }
  }
  finally { if (owns(version, accountKey)) { state.busy = false; schedule(version, accountKey, failed); } }
}
/** Resubmits the original quote under the original key; the server applies it at most once. */
async function submitOriginal() {
  const pending = state.pending;
  if (!pending || state.busy || state.concluded) return;
  if (pending.intentNo || pending.lookupOnly || pending.quotaRefusal) return query();
  const version = requestVersion, accountKey = state.accountKey;
  let failed = false, requote = false, lookup = false;
  state.busy = true; state.unavailable = false;
  try {
    const intent = await api.create(pending.paymentQuoteId, pending.commandKey);
    if (owns(version, accountKey) && !state.concluded) { state.error = false; state.retryNotice = ''; accept(intent, pending); }
  } catch (error) {
    failed = true;
    if (owns(version, accountKey) && !state.concluded) {
      // A definite HTTP/business refusal before an intent exists permits a new review;
      // ambiguous transport outcomes keep the original key and quote for read-only query.
      const cause = asApiError(error);
      const paymentRefusal = paymentRefusalNotice(cause, pending.kind);
      state.retryNotice = '';
      if (paymentRefusal === 'rejectEligibilityUnavailable') {
        // Retry the stored quote under the same command key.
        state.retryNotice = paymentRefusal;
        state.unavailable = true;
        state.error = true;
        return;
      }
      const replacement = pending.kind === 'TRADE_IN' || pending.kind === 'CAPACITY_REPLACE';
      const replacementRefusal = replacement && tradeinPaymentRejection(cause, 'external');
      if (replacementRefusal) {
        // An existing intent is returned before the replacement precheck. This response ends the saved create attempt.
        releasePurchaseCallerRecord(accountKey, pending.kind, pending.commandKey);
        release(pending);
        releaseListeners.forEach(listener => listener(accountKey, pending.commandKey));
        Object.assign(state, { pending: null, quote: null, intent: null, error: false });
        context?.onReplacementRefused?.(replacementRefusal);
        conclude(replacementRefusal);
        return;
      }
      if (replacement && isApiRefusal(cause, 503, TRADEIN_RUNTIME_RECOVERING)) {
        // The precheck is temporarily unavailable. Retry the same create through the existing backoff.
        state.unavailable = true;
        state.error = true;
        return;
      }
      if (isApiRefusal(cause, 409, 'PURCHASE_PAYMENT_QUOTE_ALREADY_USED')) {
        // Another command owns this quote. Never retry its POST; only the server's own not-found releases this one.
        const readOnly = { ...pending, lookupOnly: true };
        state.pending = readOnly; lookup = true;
        try { save(readOnly); } catch { /* Keep read-only recovery for this session even if storage fails. */ }
        return;
      }
      const unavailable = channelUnavailable(cause, pending.paymentMethod ?? state.method);
      const rejectedQuote = unavailable || cause.kind === 'http' && cause.status === cause.code
        && (cause.status === 409 && ['PURCHASE_PAYMENT_FEE_POLICY_CHANGED', 'PURCHASE_PAYMENT_QUOTE_EXPIRED', 'PURCHASE_PAYMENT_PRICING_CHANGED', 'PURCHASE_PAYMENT_EXISTING_INTENT_REQUIRED', 'ORDER_NOT_PAYABLE', 'ORDER_PAYMENT_EXPIRED', ...TRIAL_REFUSALS].includes(cause.message)
          || cause.status === 404 && cause.message === 'ORDER_NOT_FOUND');
      const definiteRefusal = !pending.intentNo && (paymentRefusal || rejectedQuote || cause.kind === 'business' && !/UNKNOWN|PROCESSING/.test(cause.message));
      state.error = !definiteRefusal;
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
        let existing: PurchasePaymentIntent | null;
        try { existing = await api.find(pending.kind, pending.commandKey); }
        catch {
          // Only a read can prove no intent exists: the record stays, and the refusal still stands for the user.
          if (owns(version, accountKey)) {
            state.error = true;
            if (refusal) conclude(refusal);
          }
          return;
        }
        if (!owns(version, accountKey)) return;
        state.error = false;
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
  if (!context || state.loading || state.busy || state.pending || account() !== state.accountKey) return;
  if (!context.current()) { state.notice = 'changed'; return; }
  if (state.method === 'WALLET') { finish({ method: 'WALLET' }); return; }
  const quote = state.quote;
  if (quote?.deadlineAt && Date.parse(quote.deadlineAt) <= Date.now()) { deadlinePassed(); return; }
  if (!quote || Date.parse(quote.expiresAt) <= Date.now()) { confirmedQuote = null; state.notice = ''; void select(state.method); return; }
  // A new id is silent. Trials keep the confirmed ceiling; other purchases require the reviewed amount exactly.
  if (state.notice !== 'reminder' || !confirmedQuote || !samePaymentTerms(confirmedQuote, quote)) {
    confirmedQuote = null; state.notice = 'quoteChanged'; return;
  }
  state.notice = ''; confirmedQuote = null;
  const scope = fingerprint(context);
  const commandKey = context.commandKey?.() ?? acquireAccountCommandKey(KEYS, state.accountKey, scope, 'purchase');
  openCashierOnReady = quote.paymentMethod === 'HDPAY_BANK';
  clearTimeout(quoteTimer);
  const original = rows(state.accountKey).records[commandKey];
  if (original) { state.pending = original; await query(); return; }
  const pending = { fingerprint: scope, kind: context.kind, commandKey, paymentQuoteId: quote.paymentQuoteId,
    paymentMethod: quote.paymentMethod, network: quote.network, summary: context.summary };
  save(pending); state.pending = pending;
  await submitOriginal();
}
/** After a failed bank attempt: retire that intent and its key, then start a fresh choice.
 *  Only a key this flow can renew (its own, or the order's payment key) continues here; any other
 *  caller-owned key ends the flow so that page starts a new purchase. */
function restart(step: 'bank' | 'methods') {
  const pending = state.pending;
  // A local countdown or failed read never authorizes replacing an intent.
  if (!pending || state.busy || state.intent?.status !== 'EXPIRED') return;
  const orderNo = state.orderNo;
  if (!context && !orderNo) { finish(null); return; }
  const orderKey = release(pending);
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
function open(value: Pick<PurchasePaymentContext, 'summary' | 'kind' | 'payload' | 'orderNo' | 'image' | 'deadlineAt'> & { amount?: number | string }, pending: PendingExternal | null) {
  const accountKey = account();
  stopTimers(); requestVersion++; quoteFailures = pollFailures = 0; paused = false; openCashierOnReady = false;
  reviewedQuote = confirmedQuote = null;
  const productNo = value.kind === 'TRIAL_CONVERT' ? value.payload.productNo : value.payload.targetProductNo;
  Object.assign(state, { open: true, coldResume: context === null, accountKey, summary: value.summary, amount: value.amount ?? '', method: 'WALLET', step: 'methods', kind: value.kind,
    orderNo: value.orderNo ?? '', productNo: typeof productNo === 'string' ? productNo.trim() : '', image: value.image ?? '', deadlineAt: value.deadlineAt ?? null,
    policy: null, notice: '', retryNotice: '', cashier: false,
    pausedPaymentMethod: null, quote: null, intent: null, pending, loading: false, retrying: false, busy: false, error: false, unavailable: false, concluded: false });
}
export function requestPurchasePayment(value: PurchasePaymentContext): Promise<PurchaseChoice | null> {
  if (state.open) throw new Error('PURCHASE_PAYMENT_ALREADY_OPEN');
  const records = rows(account()).records;
  const scope = fingerprint(value);
  const existing = value.refusedPaymentKey ? records[value.refusedPaymentKey]
    : Object.values(records).find(row => row.fingerprint === scope && row.lastStatus !== 'EXPIRED' && !(row.lastStatus === 'DELIVERED' && row.validated));
  if (value.refusedPaymentKey && (!existing?.quotaRefusal || existing.fingerprint !== scope)) throw new Error('ORIGINAL_PAYMENT_MISMATCH');
  context = value;
  open(value, existing ?? null);
  const result = waitForChoice();
  if (existing) void query();
  return result;
}
async function resume(pending: PendingExternal) {
  if (state.open) return;
  context = null;
  const payload = JSON.parse(pending.fingerprint)[1] as Record<string, unknown>;
  open({ summary: pending.summary, kind: pending.kind, payload, orderNo: pending.kind === 'ORDER_PAY' && typeof payload.orderNo === 'string' ? payload.orderNo : undefined }, pending);
  // No active purchase callback after reload. A delivered intent returns to the original order.
  void waitForChoice().then(result => {
    if (result?.method !== 'EXTERNAL' || !result.receipt || typeof result.receipt !== 'object') return;
    acknowledgePurchasePayment(result);
    const orderNo = (result.receipt as { orderNo?: unknown }).orderNo;
    if (typeof orderNo === 'string' && orderNo) void navTo(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}`);
  });
  await query();
}
function onOrderPage(orderNo: string) {
  const pages = getCurrentPages(), top = pages[pages.length - 1] as { route?: string; options?: Record<string, string> } | undefined;
  return top?.route === 'pages/store/order-detail' && top.options?.id === orderNo;
}
export function usePurchasePayment() {
  return { state, select, choose, proceed, confirm, query, submitOriginal, restart, loadPolicy, close: () => finish(null),
    back: () => choose('WALLET'), available,
    notify: (notice: PurchaseNotice) => { state.notice = notice; },
    openCashier: () => { if (state.intent?.paymentUrl && purchasePaymentTiming(state.intent, Date.now(), state.deadlineAt).canPay) state.cashier = true; },
    closeCashier: () => { state.cashier = false; paused = false; if (!state.busy) void query(); },
    pause: () => { paused = true; clearTimeout(pollTimer); pollTimer = undefined; },
    wake: () => { paused = false; if (state.open && state.pending && !state.busy && !settled(state.intent) && !state.concluded) void readPendingPayment(); },
    topup: (shortfall: number) => {
      const { orderNo, amount, deadlineAt, summary } = state;
      const query = `amount=${Number(amount)}&shortfall=${shortfall.toFixed(6)}&name=${encodeURIComponent(summary)}`
        + (orderNo ? `&orderNo=${encodeURIComponent(orderNo)}` : '')
        + (deadlineAt ? `&deadline=${deadlineAt}` : '');
      closeAndNavigate(`/pages/me/wallet-topup?${query}`);
    },
    openOrder: () => { const orderNo = state.orderNo; if (orderNo && !onOrderPage(orderNo)) closeAndNavigate(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}`); else finish(null); },
    support: () => closeAndNavigate('/pages/me/support'),
    openConditions,
    reorder: () => { const again = context?.reorder, orderNo = state.orderNo; finish(null); if (again) again(); else if (orderNo && !onOrderPage(orderNo)) void navTo(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}`); },
    pending: pendingPayments, unsettledCheckoutPayments, resume,
    records: () => { try { return displayRecords(); } catch { return []; } },
    viewOrder: () => { const intent = state.intent, pending = state.pending; if (!intent?.receipt || !pending) return; const orderNo = validatePurchasePaymentReceipt(pending.kind, JSON.parse(pending.fingerprint)[1], intent.receipt); finish(null); void navTo(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}`); },
  };
}
export function acknowledgePurchasePayment(result: Extract<PurchaseChoice, { method: 'EXTERNAL' }>) {
  try {
    const pending = rows(result.accountKey).records[result.commandKey];
    if (pending) save({ ...pending, validated: true, businessDelivered: true }, result.accountKey);
  } catch {
    toast.error(getT().errors.billMissingTitle);
  }
}
/** The order detail asks whether this order already has an external payment underway. */
export function pendingOrderPayment(accountKey: string, orderNo: string, knownOnly = false): PendingExternal | null {
  try {
    const records = Object.values(rows(accountKey).records).filter(row => row.kind === 'ORDER_PAY' && JSON.parse(row.fingerprint)[1]?.orderNo === orderNo
      && !row.quotaRefusal && !['EXPIRED', 'DELIVERED'].includes(row.lastStatus ?? '') && !row.businessDelivered
      && (row.lastStatus !== 'MANUAL_REVIEW' || row.lookupOnly && !!row.intentNo));
    return records.find(row => row.intentNo) ?? (knownOnly ? null : records[0] ?? null);
  } catch { return null; }
}

/** Attach the server's original payment to this order for the existing resume action. */
export async function discoverOrderPayment(accountKey: string, orderNo: string, summary: string, current: () => boolean) {
  try {
    const intentNo = await api.activeByOrder(orderNo);
    if (!intentNo || !current()) return;
    const intent = await api.get(intentNo);
    if (!current() || !intent || intent.intentNo !== intentNo || intent.kind !== 'ORDER_PAY'
        || intent.status === 'EXPIRED' || intent.status === 'DELIVERED' || pendingOrderPayment(accountKey, orderNo, true)) return;
    save({ fingerprint: JSON.stringify(['ORDER_PAY', { orderNo }]), kind: intent.kind, commandKey: intent.commandKey,
      paymentQuoteId: intent.paymentQuoteId, paymentMethod: intent.paymentMethod, network: intent.network, intentNo,
      summary, lastStatus: intent.status, lookupOnly: true }, accountKey);
  } catch {
    // Discovery is silent. A failed lookup cannot declare the original payment absent.
  }
}
