// Local preview only: external purchase payments (bank page / USDT address) for the
// design walkthrough. Never imported by src. The bank page URL points at the real
// provider host (the App only frames trusted hosts), so that frame shows the provider's
// reply for an unknown order; no payment is created anywhere.
import {demoAccountOrders,demoFixture,demoOrderFitsCapacity,demoTimedOutOrder,paymentWindow} from './prototype-demo-data.mjs';

const base = '/api/app/purchase-payment';
const cents = value => Math.round(Number(value) * 100);
const money = value => (value / 100).toFixed(2);
// Seconds after the intent is created when the scenario moves on.
const ARRIVE_AFTER = 15000, DELIVER_AFTER = 25000;
// Like PurchasePaymentService: a quote lives 15 minutes, never past the deadline; a purchase that has no order gets 30
// minutes from its quote; funds may be confirmed for 3 (BSC) or 5 minutes after the deadline.
const QUOTE_TTL = 15 * 60000;
const graceEnd = (method, deadline) => deadline + (method === 'CREGIS_USDT_BSC' ? 3 : 5) * 60000;

export function createPurchasePaymentPreviewFixture(state, locale) {
  const quotes = new Map(), intents = new Map();
  let sequence = 0;
  // Like the channel policy: one answer for the policy read and for quotes.
  const configured = method => !(state.paymentState === 'bank-off' && method === 'HDPAY_BANK'
    || state.paymentState === 'erc20-off' && method === 'CREGIS_USDT_ERC20'
    || state.paymentState === 'usdt-off' && method !== 'HDPAY_BANK');
  const refused = (status, message) => ({status, message, data: null});
  const handles = path => path.startsWith(base);
  const commandKinds = {ORDER_PAY:'order-pay',TRIAL_CONVERT:'trial-convert',TRADE_IN:'trade-in',CAPACITY_REPLACE:'capacity-replace',CAPACITY_KEEP:'capacity-keep'};
  // The account's one order list.
  const ordersOf = origin => demoAccountOrders(new URL(origin), locale(), state);
  // A reset or scenario change starts a fresh account; the old scenario's quotes and intents go with it.
  let epoch = state.scenarioEpoch;
  const sync = () => { if (epoch !== state.scenarioEpoch) { epoch = state.scenarioEpoch; quotes.clear(); intents.clear(); } };
  // A state sample is adopted into the account's writable orders first, so its payment and delivery facts are kept
  // as delivered (paid total with fees, channel, payment number, times) instead of being regenerated on the next read.
  function settle(orderNo, status, intent) {
    if (!orderNo) return null;
    let order = state.createdOrders?.find(row => row.orderNo === orderNo);
    if (!order) {
      order = ordersOf(intent.origin).find(row => row.orderNo === orderNo);
      if (!order) return null;
      (state.createdOrders ||= []).push(order);
    }
    if (status === 'activated') Object.assign(order, {canonicalStatus: 'activated', paymentStatus: 'PAID', orderStatus: 'COMPLETED', activationStatus: 'ACTIVATED', paymentMethod: intent.paymentMethod, paidTotalUsdt: intent.totalUsdt, paymentNo: intent.intentNo, paidAt: intent.paidAt, activatedAt: Date.now()});
    else Object.assign(order, demoTimedOutOrder);
    return order;
  }
  // Another open intent for the same order or the same non-order payload (PurchasePaymentService.activeIntents).
  const openIntent = (subject, excluding) => [...intents.values()].some(row => row !== excluding && row.kind === subject.kind
    && !['DELIVERED', 'EXPIRED'].includes(row.status) && (row.kind === 'ORDER_PAY' ? row.orderNo === subject.orderNo : row.payloadKey === subject.payloadKey));
  // Like PurchasePaymentService.expire: no funds by the deadline plus grace ends the intent and its order together,
  // unless a successor to a failed attempt now owns the order, or the order has already ended another way.
  function timeOut(intent) {
    if (openIntent(intent, intent)) return intent;
    if (intent.orderNo) {
      const order = ordersOf(intent.origin).find(row => row.orderNo === intent.orderNo);
      if (order?.paymentStatus !== 'PENDING' || order.orderStatus !== 'PENDING_PAYMENT') return intent;
    }
    settle(intent.orderNo, 'expired', intent);
    return Object.assign(intent, {status: 'EXPIRED', reason: 'PAYMENT_TIMEOUT'});
  }
  // TRIAL_CONVERT settles through the trial lifecycle at the quote's pricing time, as VerifiedPurchasePayment does. A
  // refusal keeps the funds for support under its own code.
  function deliverTrial(intent) {
    let receipt;
    try { receipt = demoFixture(new URL('/api/trial/convert', intent.origin), locale(), state, {method: () => 'POST', headers: () => ({'idempotency-key': intent.commandKey}), postDataJSON: () => intent.payload, verifiedPayment: intent}); }
    catch (error) { return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: error.message}); }
    return Object.assign(intent, {status: 'DELIVERED', fulfilmentStatus: 'DELIVERED', receipt: {...receipt, paymentNo: intent.intentNo, amountUsdt: intent.businessAmountUsdt, paymentSubtotalUsdt: intent.subtotalUsdt,
      roundingAdjustmentUsdt: intent.roundingAdjustmentUsdt, walletDebitUsdt: '0.00', paymentMethod: intent.paymentMethod, paymentRail: intent.paymentMethod, paidTotalUsdt: intent.totalUsdt}});
  }
  // The intent advances by elapsed time according to the preview panel's 外部付款结果.
  function advance(intent) {
    const now = Date.now(), age = now - intent.createdAt, scenario = state.paymentState ?? 'delivered', bank = intent.paymentMethod === 'HDPAY_BANK';
    const graceOver = now >= graceEnd(intent.paymentMethod, intent.deadline);
    if (intent.status === 'EXPIRED' && intent.reason === 'PAYMENT_FAILED' && graceOver) return timeOut(intent);
    if (!['AWAITING_PAYMENT', 'FUNDS_CONFIRMED'].includes(intent.status)) return intent;
    if (intent.status === 'AWAITING_PAYMENT' && ['waiting', 'urgent', 'read-error', 'late'].includes(scenario)) {
      if (!graceOver) return intent;
      timeOut(intent);
      // Funds that come in once the order has been cancelled stay with support: never delivery, refund or wallet credit.
      return scenario === 'late' ? Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'PAYMENT_LATE_REVIEW'}) : intent;
    }
    if (age < ARRIVE_AFTER) return intent;
    if (scenario === 'expired') {
      // This result compresses the wait: the payment reads as one whose deadline and grace have just passed.
      const deadline = now - (graceEnd(intent.paymentMethod, 0)), order = settle(intent.orderNo, 'expired', intent);
      if (order) Object.assign(order, {placedAt: deadline - paymentWindow, expiresAt: deadline});
      return Object.assign(intent, {status: 'EXPIRED', reason: 'PAYMENT_TIMEOUT', deadline, expiresAt: new Date(deadline).toISOString(), deadlineAt: new Date(deadline).toISOString(), confirmationGraceEndsAt: new Date(now).toISOString()});
    }
    if (scenario === 'bank-failed' && bank) return Object.assign(intent, {status: 'EXPIRED', reason: 'PAYMENT_FAILED'});
    if (scenario === 'mismatch') return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'PAYMENT_AMOUNT_MISMATCH'});
    // PurchasePaymentService.arrivalReason: funds paid before the deadline deliver normally, also when delivery itself
    // lands after it, and the order waits for them. Funds paid at or after it go to review, which delivery skips.
    intent.paidAt ??= intent.createdAt + ARRIVE_AFTER;
    if (intent.paidAt >= intent.deadline) return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'PAYMENT_LATE_REVIEW'});
    if (age < DELIVER_AFTER) return Object.assign(intent, {status: 'FUNDS_CONFIRMED'});
    if (scenario === 'delivery-failed') return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'PURCHASE_PAYMENT_DELIVERY_BLOCKED'});
    if (intent.kind === 'TRIAL_CONVERT') return deliverTrial(intent);
    // Trade-in and capacity fixtures cover open, unknown and rejected commands. Their
    // business delivery/fleet mutation is not simulated here.
    if (intent.kind !== 'ORDER_PAY') throw Object.assign(new Error('PURCHASE_PAYMENT_DELIVERY_NOT_MODELED'), {status:503});
    const order = ordersOf(intent.origin).find(row => row.orderNo === intent.orderNo);
    // Delivery needs the order; funds for an order that cannot be found never become a success.
    if (!order) return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'PURCHASE_PAYMENT_DELIVERY_BLOCKED'});
    // Like AppOrderCommandService.prepare inside delivery: an unpaid order holds no slot, so paid funds that no
    // longer fit the slots go to manual review with the capacity code instead of activating over the cap.
    if (!demoOrderFitsCapacity(new URL(intent.origin), locale(), state, null,
      order.lineItems.map(line => ({productNo: line.sku, quantity: line.quantity})), intent.orderNo))
      return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'CAPACITY_REPLACEMENT_REQUIRED'});
    settle(intent.orderNo, 'activated', intent);
    return Object.assign(intent, {status: 'DELIVERED', fulfilmentStatus: 'DELIVERED', receipt: {
      ...(order?.promotionQuoteId ? order : {}),
      orderNo: intent.orderNo, paymentNo: intent.intentNo, paymentStatus: 'PAID', orderStatus: 'COMPLETED', activationStatus: 'ACTIVATED', canonicalStatus: 'activated',
      amountUsdt: intent.businessAmountUsdt, paymentSubtotalUsdt: intent.subtotalUsdt, walletDebitUsdt: '0.00', paymentMethod: intent.paymentMethod, paidTotalUsdt: intent.totalUsdt,
      walletBalanceAfterUsdt: null, idempotent: false, serverCanonical: true, source: 'server', sourceEnvironment: 'PRODUCTION', runId: ''}});
  }
  // Payment details stop at the deadline (PurchasePaymentService.view).
  const view = intent => {
    const {createdAt, orderNo, deadline, origin, payload, payloadKey, pricingAt, paidAt, ...row} = advance(intent), open = Date.now() < deadline;
    return {...row, paymentAllowed: row.status === 'AWAITING_PAYMENT' && open, address: open ? row.address : null, paymentUrl: open && row.status === 'AWAITING_PAYMENT' ? row.paymentUrl : null};
  };
  function paymentCommand(kind, key) {
    sync();
    const intent = [...intents.values()].find(row => commandKinds[row.kind] === kind && row.commandKey === key);
    if (!intent) return null;
    if (state.paymentState === 'read-error') throw Object.assign(new Error('PAYMENT_COMMAND_READ_UNAVAILABLE'), {status:503});
    advance(intent);
    return {kind,commandKey:key,status:intent.status==='DELIVERED'?'SUCCEEDED':intent.status==='EXPIRED'?'REJECTED':'PROCESSING',canResumeSameKey:false,...(intent.receipt?{receipt:intent.receipt}:{})};
  }
  // The server's own observation of open order payments, so an order read follows them without the App polling.
  function sweep() {
    sync();
    for (const intent of intents.values()) if (intent.kind === 'ORDER_PAY') advance(intent);
  }
  // AppOrderCommandService refuses a wallet pay or a cancel while an order's external payment is open.
  const openOrderPayment = orderNo => { sync(); return openIntent({kind: 'ORDER_PAY', orderNo}); };
  function handle(url, request) {
    sync();
    const path = url.pathname, method = request.method();
    if (path === `${base}-policy` && method === 'GET') return {status: 200, message: 'OK', data: {version: 3, channels: ['HDPAY_BANK', 'CREGIS_USDT_BSC', 'CREGIS_USDT_ERC20'].map(paymentMethod => ({paymentMethod, configured: configured(paymentMethod)}))}};
    if (path === `${base}-quotes` && method === 'POST') {
      const body = request.postDataJSON(), order = ordersOf(url.origin).find(row => row.orderNo === body.payload?.orderNo);
      // Like PurchasePaymentService.quote: an order payment is quoted only for an existing unpaid order; an expired
      // one has already been closed by the deadline task, so it is not payable either.
      if (body.kind === 'ORDER_PAY' && !order) return {status: 404, message: 'ORDER_NOT_FOUND', data: null};
      if (body.kind === 'ORDER_PAY' && (order.paymentStatus !== 'PENDING' || order.orderStatus !== 'PENDING_PAYMENT')) return {status: 409, message: 'ORDER_NOT_PAYABLE', data: null};
      if (!commandKinds[body.kind] || (body.kind === 'TRIAL_CONVERT' ? !body.payload?.productNo : body.kind !== 'ORDER_PAY' && !body.payload?.targetProductNo)) return {status: 409, message: 'PURCHASE_PAYMENT_PRICING_CHANGED', data: null};
      const bank = body.paymentMethod === 'HDPAY_BANK', erc20 = body.paymentMethod === 'CREGIS_USDT_ERC20';
      const trial = body.kind === 'TRIAL_CONVERT'
        ? demoFixture(new URL('/api/trial/state',url.origin),locale(),state,{...request,method:()=> 'GET'}) : null;
      if (trial) {
        const expected = body.payload.expectedAmountUsdt;
        if (typeof expected !== 'number' || !Number.isFinite(expected) || expected < 0 || expected > 1000000
          || !/^\d+(?:\.\d{1,2})?$/.test(String(expected))) return {status:409,message:'TRIAL_AMOUNT_INVALID',data:null};
        if (!['ACTIVE','GRACE'].includes(trial.state) || !trial.quote || body.payload.productNo !== trial.config.trialProductId)
          return {status:409,message:'TRIAL_NOT_CONVERTIBLE',data:null};
        if (body.payload.quoteVersion !== trial.quote.quoteVersion) return {status:409,message:'TRIAL_QUOTE_CHANGED',data:null};
      }
      const amount = trial ? trial.quote.amountUsdt : order?.amountUsdt ?? body.payload.expectedPayableUsdt;
      // Trial business amounts retain six decimals; the external principal confirms HALF_UP cents.
      const micros = BigInt(Number(amount).toFixed(6).replace('.', ''));
      const subtotal = trial ? Number((micros + 5000n) / 10000n) : cents(amount);
      if (trial && subtotal > cents(body.payload.expectedAmountUsdt)) return {status:409,message:'TRIAL_AMOUNT_MISMATCH',data:null};
      const subject = {kind: body.kind, orderNo: order?.orderNo, payloadKey: JSON.stringify(body.payload)};
      if (openIntent(subject)) return refused(409, 'PURCHASE_PAYMENT_EXISTING_INTENT_REQUIRED');
      if (!configured(body.paymentMethod)) return refused(503, 'PURCHASE_PAYMENT_FEES_NOT_CONFIGURED');
      const now = Date.now(), deadline = order ? Number(order.expiresAt) : now + paymentWindow;
      if (deadline <= now) return refused(409, 'ORDER_PAYMENT_EXPIRED');
      const adjustment = Number(BigInt(subtotal) * 10000n - micros) / 1000000;
      const channel = Math.round(subtotal * 0.0125) + 50, network = bank ? 0 : erc20 ? 380 : 25;
      if (trial) state.lastTrialPaymentQuote = {...body,amountUsdt:amount,subtotalUsdt:money(subtotal)};
      const quote = {paymentQuoteId: `PPQ-PREVIEW-${++sequence}`, kind: body.kind, paymentMethod: body.paymentMethod, network: bank ? 'VND_BANK' : erc20 ? 'ERC20' : 'BSC',
        businessAmountUsdt: Number(amount).toFixed(6), roundingAdjustmentUsdt: adjustment.toFixed(6), subtotalUsdt: money(subtotal), channelFeeUsdt: money(channel),
        networkConfirmFeeUsdt: money(network), totalUsdt: money(subtotal + channel + network), feePolicyVersion: 3, pricingAsOf: new Date(now).toISOString(), expiresAt: new Date(Math.min(now + QUOTE_TTL, deadline)).toISOString(),
        deadlineAt: new Date(deadline).toISOString(), confirmationGraceEndsAt: new Date(graceEnd(body.paymentMethod, deadline)).toISOString(),
        fxRateVndPerUsdt: bank ? '25000.000000' : null, amountVnd: bank ? String((subtotal + channel) * 250) : null};
      quotes.set(quote.paymentQuoteId, {quote, subject, deadline, pricingAt: now, payload: body.payload});
      return {status: 200, message: 'OK', data: quote};
    }
    if (path === `${base}-intents` && method === 'POST') {
      const key = request.headers()['idempotency-key'], quoteId = request.postDataJSON().paymentQuoteId, source = quotes.get(quoteId);
      if (!key) return refused(422, 'IDEMPOTENCY_KEY_REQUIRED');
      if (!source) return refused(404, 'PURCHASE_PAYMENT_QUOTE_NOT_FOUND');
      const {subject, deadline} = source, known = [...intents.values()].find(row => row.kind === subject.kind && row.commandKey === key);
      if (known) return known.paymentQuoteId === quoteId ? {status: 200, message: 'OK', data: view(known)} : refused(409, 'IDEMPOTENCY_KEY_CONFLICT');
      // Like PurchasePaymentService.create: the quote is checked again before an intent exists.
      if ([...intents.values()].some(row => row.paymentQuoteId === quoteId)) return refused(409, 'PURCHASE_PAYMENT_QUOTE_ALREADY_USED');
      if (deadline <= Date.now()) return refused(409, 'ORDER_PAYMENT_EXPIRED');
      if (Date.parse(source.quote.expiresAt) <= Date.now()) return refused(409, 'PURCHASE_PAYMENT_QUOTE_EXPIRED');
      if (subject.orderNo) {
        const order = ordersOf(url.origin).find(row => row.orderNo === subject.orderNo);
        if (!order) return refused(404, 'ORDER_NOT_FOUND');
        if (order.paymentStatus !== 'PENDING' || order.orderStatus !== 'PENDING_PAYMENT') return refused(409, 'ORDER_NOT_PAYABLE');
      }
      if (openIntent(subject)) return refused(409, 'PURCHASE_PAYMENT_EXISTING_INTENT_REQUIRED');
      const intentNo = `PPI-PREVIEW-${++sequence}`;
      // One deadline: the intent closes with the order, or 30 minutes from the quote when there is no order.
      const intent = {...source.quote, intentNo, commandKey: key, status: 'AWAITING_PAYMENT', reason: '', receipt: null, expiresAt: source.quote.deadlineAt,
        paymentUrl: source.quote.paymentMethod === 'HDPAY_BANK' ? `https://api.hdpayadmin.com/pay/${intentNo}` : null,
        address: source.quote.paymentMethod === 'HDPAY_BANK' ? null : '0x' + (source.quote.paymentMethod === 'CREGIS_USDT_ERC20' ? '7d3a' : '4b1f') + String(sequence).padStart(36, '0'),
        createdAt: Date.now(), orderNo: subject.orderNo, payloadKey: subject.payloadKey, payload: source.payload, pricingAt: source.pricingAt, deadline, origin: url.origin};
      intents.set(intentNo, intent);
      // The deadline task leaves an order with a payment intent to the payment's own outcome.
      if (subject.orderNo) (state.intentOrders ??= {})[subject.orderNo] = true;
      return {status: 200, message: 'OK', data: view(intent)};
    }
    if (path === `${base}-intents` && method === 'GET') {
      const intent = [...intents.values()].find(row => row.kind === url.searchParams.get('kind') && row.commandKey === url.searchParams.get('commandKey'));
      return intent ? {status: 200, message: 'OK', data: view(intent)} : {status: 404, message: 'PURCHASE_PAYMENT_INTENT_NOT_FOUND', data: null};
    }
    const one = path.match(/^\/api\/app\/purchase-payment-intents\/([^/]+)$/);
    if (one && method === 'GET') {
      const intent = intents.get(decodeURIComponent(one[1]));
      return intent ? {status: 200, message: 'OK', data: view(intent)} : {status: 404, message: 'PURCHASE_PAYMENT_INTENT_NOT_FOUND', data: null};
    }
    return {status: 404, message: 'PURCHASE_PAYMENT_NOT_MODELED', data: null};
  }
  return {handles, handle, paymentCommand, sweep, openOrderPayment};
}
