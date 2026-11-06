import { reactive } from 'vue';
import { apiClient } from '@/api/runtime';
import { asApiError } from '@/api/errors';
import { createPurchasePaymentApi, type ExternalPaymentMethod, type PurchaseKind, type PurchaseMethod, type PurchasePaymentIntent, type PurchaseQuote } from '@/api/purchase-payment-api';
import { useApp } from './app';
import { readAccountRow, writeAccountRow, acquireAccountCommandKey, releaseAccountCommandKey } from './account-scoped-storage';
import { clearOrderAction, readOrderAction } from '@/lib/order-command-fence';
import { navTo, navReplace } from '@/lib/route';
import { formatAmount } from '@/lib/amount-display';
import { validatePurchasePaymentReceipt } from '@/lib/purchase-payment-receipt';
import { releasePurchaseCallerRecord } from '@/lib/purchase-caller-record';
import { purchasePaymentTiming } from '@/lib/purchase-payment-timing';

/** `orderNo`, `deadlineAt` and `image` only feed the payment screens; `reorder` runs after a timed-out order. */
export type PurchasePaymentContext = { kind: PurchaseKind; payload: Record<string, unknown>; amount: number | string; summary: string; current: () => boolean; commandKey?: () => string;
  orderNo?: string; deadlineAt?: number | null; image?: string; reorder?: () => void; navigate?: (href: string) => void };
type PendingExternal = { fingerprint: string; kind: PurchaseKind; commandKey: string; paymentQuoteId: string;
  paymentMethod?: PurchaseQuote['paymentMethod']; network?: PurchaseQuote['network'];
  intentNo?: string; summary: string; lastStatus?: string; validated?: boolean; businessDelivered?: boolean };
type PendingRow = { records: Record<string, PendingExternal> };
export type PurchaseChoice = { method: 'WALLET' } | { method: 'EXTERNAL'; receipt: unknown; commandKey: string; accountKey: string };
export type PurchaseStep = 'methods' | 'network' | 'bank';
export type PurchaseNotice = '' | 'reminder' | 'timeShort' | 'timeout' | 'bankFailed' | 'review' | 'late' | 'delivery' | 'leave' | 'changed' | 'quoteChanged' | 'orderExpired' | 'orderClosed' | 'orderMissing' | 'gone';
const TABLE = 'uvel-purchase-payment-accounts-v1', KEYS = 'uvel-purchase-payment-keys-accounts-v1';
const POLL_MS = 5000, POLL_BACKOFF = [5000, 10000, 20000, 30000], SHORT_DEADLINE_MS = 5 * 60000;
const REVIEW_REASONS = ['PAYMENT_AMOUNT_MISMATCH', 'PAYMENT_MULTIPLE_ARRIVALS', 'PAYMENT_BEFORE_ALLOCATION', 'PAYMENT_REORG_REVIEW', 'PAYMENT_TIME_UNVERIFIED', 'PAYMENT_REFUNDED_REVIEW'];
const ORDER_REFUSALS: Record<string, PurchaseNotice> = { ORDER_PAYMENT_EXPIRED: 'orderExpired', ORDER_NOT_PAYABLE: 'orderClosed', ORDER_NOT_FOUND: 'orderMissing' };
const TRIAL_REFUSALS = ['TRIAL_QUOTE_CHANGED', 'TRIAL_AMOUNT_MISMATCH'];
const api = createPurchasePaymentApi(apiClient);
const state = reactive({ open: false, coldResume: false, accountKey: '', summary: '', amount: '' as string | number, method: 'WALLET' as PurchaseMethod,
  step: 'methods' as PurchaseStep, kind: 'ORDER_PAY' as PurchaseKind, orderNo: '', image: '', deadlineAt: null as number | null,
  policy: null as Partial<Record<ExternalPaymentMethod, boolean>> | null, notice: '' as PurchaseNotice, cashier: false,
  quote: null as PurchaseQuote | null, intent: null as PurchasePaymentIntent | null, pending: null as PendingExternal | null,
  loading: false, retrying: false, busy: false, error: false, unavailable: false, pendingReadError: false, concluded: false, revision: 0 });
let context: PurchasePaymentContext | null = null;
let reviewedQuote: PurchaseQuote | null = null, confirmedQuote: PurchaseQuote | null = null;
let resolveChoice: ((result: PurchaseChoice | null) => void) | null = null;
let requestVersion = 0, quoteFailures = 0, pollFailures = 0, paused = false, openCashierOnReady = false;
let quoteTimer: ReturnType<typeof setTimeout> | undefined, pollTimer: ReturnType<typeof setTimeout> | undefined;
const releaseListeners = new Set<(accountKey: string, commandKey: string) => void>();
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
  save(known); state.pending = known; state.intent = intent; state.method = intent.paymentMethod;
  if (intent.deadlineAt) state.deadlineAt = Date.parse(intent.deadlineAt);
  if (intent.status === 'DELIVERED' || intent.fulfilmentStatus === 'DELIVERED') {
    const payload = JSON.parse(known.fingerprint)[1] as Record<string, unknown>;
    validatePurchasePaymentReceipt(known.kind, payload, intent.receipt, intent);
    if (intent.status === 'DELIVERED') {
      finish({ method: 'EXTERNAL', receipt: intent.receipt, commandKey: known.commandKey, accountKey: state.accountKey });
      return;
    }
  }
  if (!purchasePaymentTiming(intent, Date.now(), state.deadlineAt).canPay) state.cashier = false;
  else if (openCashierOnReady && intent.paymentUrl) { openCashierOnReady = false; state.cashier = true; }
  const conclusion = purchaseConclusion(intent);
  if (conclusion) state.notice = conclusion;
}
/** The payment ended with an answer: nothing of it stays behind the notice and no further read or write runs. */
function conclude(notice: PurchaseNotice) { Object.assign(state, { notice, concluded: true, cashier: false }); }
function stopTimers() { clearTimeout(quoteTimer); clearTimeout(pollTimer); quoteTimer = pollTimer = undefined; }
function finish(result: PurchaseChoice | null) {
  requestVersion++; stopTimers(); openCashierOnReady = false;
  reviewedQuote = confirmedQuote = null;
  Object.assign(state, { open: false, loading: false, retrying: false, busy: false, cashier: false, notice: '', concluded: false });
  const done = resolveChoice; resolveChoice = null; context = null; done?.(result);
}
// A checkout owner may defer navigation until its payment operation releases
// the page leave guard. Cold resumes use ordinary navigation directly.
function closeAndNavigate(href: string) {
  const navigate = context?.navigate;
  finish(null);
  if (navigate) navigate(href); else void navTo(href);
}
/** Reads continue on their own: every 5 s while the payment is open, backing off after failures, paused in the background. */
function schedule(version: number, accountKey: string, failed: boolean) {
  pollFailures = failed ? pollFailures + 1 : 0;
  clearTimeout(pollTimer); pollTimer = undefined;
  if (paused || !owns(version, accountKey) || !state.pending || settled(state.intent) || state.concluded) return;
  pollTimer = setTimeout(() => { if (owns(version, accountKey)) void (state.unavailable ? submitOriginal() : query()); },
    failed ? POLL_BACKOFF[Math.min(pollFailures - 1, POLL_BACKOFF.length - 1)]! : POLL_MS);
}
async function loadPolicy() {
  const accountKey = state.accountKey;
  try {
    const policy = await api.policy();
    if (state.open && state.accountKey === accountKey) { state.policy = policy; reconcileChannel(); }
  } catch { /* Without the policy every channel stays selectable; its quote reports an unconfigured channel. */ }
}
function available(method: PurchaseMethod) { return method === 'WALLET' || !state.policy || state.policy[method] === true; }
/** Before an intent exists, leave an unconfigured channel and try another payment method. */
function reconcileChannel() {
  if (state.pending || state.step === 'methods' || available(state.method)) return;
  const other = state.method === 'CREGIS_USDT_ERC20' ? 'CREGIS_USDT_BSC' : state.method === 'CREGIS_USDT_BSC' ? 'CREGIS_USDT_ERC20' : null;
  if (other && available(other)) void select(other);
  else choose('WALLET');
}
async function select(method: PurchaseMethod, step?: PurchaseStep) {
  if (state.busy || state.pending || !context) return;
  if (state.deadlineAt !== null && state.deadlineAt <= Date.now()) { deadlinePassed(); return; }
  if (step) state.step = step;
  if (method !== state.method) { quoteFailures = 0; reviewedQuote = confirmedQuote = null; }
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
    state.quote = quote; quoteFailures = 0;
    if (reviewedQuote && !samePaymentTerms(reviewedQuote, quote)) {
      confirmedQuote = null; state.notice = 'quoteChanged';
    }
    reviewedQuote = quote;
    if (quote.deadlineAt) state.deadlineAt = Date.parse(quote.deadlineAt);
    // Swap in a fresh quote 30 s before this one lapses.
    // (setTimeout fires at once beyond 2^31-1 ms, so far-off expiries are capped.)
    quoteTimer = setTimeout(() => { if (owns(version, accountKey)) void select(method); }, Math.min(2147483647, Math.max(1000, Date.parse(quote.expiresAt) - Date.now() - 30000)));
  } catch (error) {
    if (!owns(version, accountKey)) return;
    if (error instanceof Error && error.message === 'PURCHASE_CONTEXT_CHANGED') { state.notice = 'changed'; return; }
    const cause = asApiError(error);
    if (cause.status === 503 && cause.message === 'PURCHASE_PAYMENT_FEES_NOT_CONFIGURED') {
      // An unknown policy keeps the other channels selectable; only this one is known to be unconfigured.
      state.policy = { ...(state.policy ?? { HDPAY_BANK: true, CREGIS_USDT_BSC: true, CREGIS_USDT_ERC20: true }), [method]: false };
      reconcileChannel();
      return;
    }
    // Only a network failure or a 5xx can change on retry; anything else is the server's answer.
    if (cause.kind !== 'network' && (cause.status ?? 0) < 500) {
      const refusal = ORDER_REFUSALS[cause.message];
      if (refusal) conclude(refusal); else state.notice = 'changed';
      return;
    }
    state.retrying = true;
    quoteTimer = setTimeout(() => { if (owns(version, accountKey)) void select(method); }, Math.min(30000, 3000 * 2 ** quoteFailures++));
  } finally { if (owns(version, accountKey)) state.loading = false; }
}
/** An order past its deadline can no longer be paid; other purchases get a fresh quote and deadline from their own page. */
function deadlinePassed() { if (state.kind === 'ORDER_PAY') conclude('orderExpired'); else state.notice = 'changed'; }
function choose(option: 'WALLET' | 'HDPAY_BANK' | 'USDT') {
  if (option === 'WALLET') { state.step = 'methods'; void select('WALLET'); return; }
  if (option === 'HDPAY_BANK') { void select('HDPAY_BANK', 'bank'); return; }
  // ERC20 is the default network; BEP20 only when ERC20 is not configured.
  const network: ExternalPaymentMethod = !available('CREGIS_USDT_ERC20') && available('CREGIS_USDT_BSC') ? 'CREGIS_USDT_BSC' : 'CREGIS_USDT_ERC20';
  void select(network, 'network');
}
function samePaymentTerms(left: PurchaseQuote, right: PurchaseQuote) {
  return left.paymentMethod === right.paymentMethod && formatAmount(left.totalUsdt) === formatAmount(right.totalUsdt)
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
  if (!pending || state.busy) return;
  const version = requestVersion, accountKey = state.accountKey;
  let failed = false;
  state.busy = true; state.unavailable = false;
  try {
    const result = pending.intentNo ? await api.get(pending.intentNo) : await api.find(pending.kind, pending.commandKey);
    if (!owns(version, accountKey)) return;
    state.error = false;
    if (result) accept(result, pending); else state.unavailable = true;
  } catch (error) {
    failed = true;
    if (owns(version, accountKey)) {
      const cause = asApiError(error);
      // The server no longer holds a payment it has shown us. Only the user may start another one, from the order.
      if (pending.intentNo && cause.status === 404 && cause.message === 'PURCHASE_PAYMENT_INTENT_NOT_FOUND') {
        release(pending);
        releasePurchaseCallerRecord(accountKey, pending.kind, pending.commandKey);
        releaseListeners.forEach(listener => listener(accountKey, pending.commandKey));
        Object.assign(state, { pending: null, intent: null, quote: null, error: false });
        conclude('gone');
      } else state.error = true;
    }
  }
  finally { if (owns(version, accountKey)) { state.busy = false; schedule(version, accountKey, failed); } }
}
/** Resubmits the original quote under the original key; the server applies it at most once. */
async function submitOriginal() {
  const pending = state.pending;
  if (!pending || state.busy) return;
  const version = requestVersion, accountKey = state.accountKey;
  let failed = false, requote = false;
  state.busy = true; state.unavailable = false;
  try {
    const intent = await api.create(pending.paymentQuoteId, pending.commandKey);
    if (owns(version, accountKey)) { state.error = false; accept(intent, pending); }
  } catch (error) {
    failed = true;
    if (owns(version, accountKey)) {
      state.error = true;
      // A definite HTTP/business refusal before an intent exists permits a new review;
      // ambiguous transport outcomes keep the original key and quote for read-only query.
      const cause = asApiError(error);
      const rejectedQuote = cause.kind === 'http' && cause.status === cause.code
        && (cause.status === 409 && ['PURCHASE_PAYMENT_FEE_POLICY_CHANGED', 'PURCHASE_PAYMENT_QUOTE_EXPIRED', 'PURCHASE_PAYMENT_PRICING_CHANGED', 'PURCHASE_PAYMENT_EXISTING_INTENT_REQUIRED', 'ORDER_NOT_PAYABLE', 'ORDER_PAYMENT_EXPIRED', ...TRIAL_REFUSALS].includes(cause.message)
          || cause.status === 404 && cause.message === 'ORDER_NOT_FOUND'
          || cause.status === 503 && cause.message === 'PURCHASE_PAYMENT_FEES_NOT_CONFIGURED');
      if (!pending.intentNo && (rejectedQuote || cause.kind === 'business' && !/UNKNOWN|PROCESSING/.test(cause.message))) {
        // These answers are final for this purchase: a new quote could only repeat them or fall back into retrying.
        const refusal = pending.kind === 'ORDER_PAY' ? ORDER_REFUSALS[cause.message] : TRIAL_REFUSALS.includes(cause.message) ? 'changed' : undefined;
        let existing: PurchasePaymentIntent | null;
        try { existing = await api.find(pending.kind, pending.commandKey); }
        catch {
          // Only a read can prove no intent exists: the record stays, and the refusal still stands for the user.
          if (refusal && owns(version, accountKey)) conclude(refusal);
          return;
        }
        if (!owns(version, accountKey)) return;
        state.error = false;
        if (existing) accept(existing, pending);
        else if (refusal) { release(pending); Object.assign(state, { pending: null, quote: null, intent: null }); conclude(refusal); }
        else { retire(pending, accountKey); state.pending = null; state.quote = null; state.intent = null; requote = true; }
      }
    }
  } finally {
    if (owns(version, accountKey)) { state.busy = false; if (requote) void select(state.method); else schedule(version, accountKey, failed); }
  }
}
async function confirm() {
  if (!context || state.loading || state.busy || state.pending || account() !== state.accountKey) return;
  if (!context.current()) { state.notice = 'changed'; return; }
  if (state.method === 'WALLET') { finish({ method: 'WALLET' }); return; }
  const quote = state.quote;
  if (quote?.deadlineAt && Date.parse(quote.deadlineAt) <= Date.now()) { deadlinePassed(); return; }
  if (!quote || Date.parse(quote.expiresAt) <= Date.now()) { confirmedQuote = null; state.notice = ''; void select(state.method); return; }
  // A new quote id alone is silent; the amount, fee version and method must still be the terms reviewed in the reminder.
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
function open(value: Pick<PurchasePaymentContext, 'summary' | 'kind' | 'orderNo' | 'image' | 'deadlineAt'> & { amount?: number | string }, pending: PendingExternal | null) {
  const accountKey = account();
  stopTimers(); requestVersion++; quoteFailures = pollFailures = 0; paused = false; openCashierOnReady = false;
  reviewedQuote = confirmedQuote = null;
  Object.assign(state, { open: true, coldResume: context === null, accountKey, summary: value.summary, amount: value.amount ?? '', method: 'WALLET', step: 'methods', kind: value.kind,
    orderNo: value.orderNo ?? '', image: value.image ?? '', deadlineAt: value.deadlineAt ?? null, policy: null, notice: '', cashier: false,
    quote: null, intent: null, pending, loading: false, retrying: false, busy: false, error: false, unavailable: false, concluded: false });
}
export function requestPurchasePayment(value: PurchasePaymentContext): Promise<PurchaseChoice | null> {
  if (state.open) throw new Error('PURCHASE_PAYMENT_ALREADY_OPEN');
  const existing = Object.values(rows(account()).records).find(row => row.fingerprint === fingerprint(value) && row.lastStatus !== 'EXPIRED' && !(row.lastStatus === 'DELIVERED' && row.validated));
  context = value;
  open(value, existing ?? null);
  const result = new Promise<PurchaseChoice | null>(resolve => { resolveChoice = resolve; });
  if (existing) void query();
  return result;
}
async function resume(pending: PendingExternal) {
  if (state.open) return;
  context = null;
  const payload = JSON.parse(pending.fingerprint)[1] as Record<string, unknown>;
  open({ summary: pending.summary, kind: pending.kind, orderNo: pending.kind === 'ORDER_PAY' && typeof payload.orderNo === 'string' ? payload.orderNo : undefined }, pending);
  // No active purchase callback after reload. A delivered intent returns to the original order.
  resolveChoice = result => { if (result?.method === 'EXTERNAL' && result.receipt && typeof result.receipt === 'object') {
    acknowledgePurchasePayment(result);
    const orderNo = (result.receipt as { orderNo?: unknown }).orderNo;
    if (typeof orderNo === 'string' && orderNo) void navTo(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}`);
  } };
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
    wake: () => { paused = false; if (state.open && state.pending && !state.busy && !settled(state.intent) && !state.concluded) void (state.unavailable ? submitOriginal() : query()); },
    topup: () => {
      const orderNo = state.orderNo, total = Number(state.amount), deadlineAt = state.deadlineAt, summary = state.summary;
      const query = orderNo ? `?orderNo=${encodeURIComponent(orderNo)}&amount=${total}&name=${encodeURIComponent(summary)}${deadlineAt ? `&deadline=${deadlineAt}` : ''}` : '';
      closeAndNavigate(`/pages/me/wallet-topup${query}`);
    },
    openOrder: () => { const orderNo = state.orderNo; if (orderNo && !onOrderPage(orderNo)) closeAndNavigate(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}`); else finish(null); },
    support: () => closeAndNavigate('/pages/me/support'),
    reorder: () => { const again = context?.reorder, orderNo = state.orderNo; finish(null); if (again) again(); else if (orderNo && !onOrderPage(orderNo)) void navTo(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}`); },
    pending: () => { state.revision; try { const records = Object.values(rows().records); state.pendingReadError = false; return records.filter(row => row.lastStatus !== 'EXPIRED' && !(row.lastStatus === 'DELIVERED' && row.validated)); } catch { state.pendingReadError = true; return []; } }, resume,
    records: () => { state.revision; try { return Object.values(rows().records); } catch { return []; } },
    viewOrder: () => { const intent = state.intent, pending = state.pending; if (!intent?.receipt || !pending) return; const orderNo = validatePurchasePaymentReceipt(pending.kind, JSON.parse(pending.fingerprint)[1], intent.receipt); finish(null); void navTo(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}`); },
  };
}
export function acknowledgePurchasePayment(result: Extract<PurchaseChoice, { method: 'EXTERNAL' }>) {
  const pending = rows(result.accountKey).records[result.commandKey];
  if (pending) save({ ...pending, validated: true, businessDelivered: true }, result.accountKey);
}
/** The order detail asks whether this order already has an external payment underway. */
export function pendingOrderPayment(accountKey: string, orderNo: string): PendingExternal | null {
  try {
    return Object.values(rows(accountKey).records).find(row => row.kind === 'ORDER_PAY' && JSON.parse(row.fingerprint)[1]?.orderNo === orderNo
      && !['EXPIRED', 'DELIVERED', 'MANUAL_REVIEW'].includes(row.lastStatus ?? '') && !row.businessDelivered) ?? null;
  } catch { return null; }
}
