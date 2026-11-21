// Local preview only: external purchase payments (bank page / USDT address) for the
// design walkthrough. Never imported by src. The bank page URL points at the real
// provider host (the App only frames trusted hosts), so that frame shows the provider's
// reply for an unknown order; no payment is created anywhere.
import {demoAccountOrders,demoFixture,demoFleetFacts,demoOrderFitsCapacity,demoProducts,demoReplacementSourceCheck,demoTimedOutOrder,paymentWindow,removeDemoPaymentQuotaHold,requireDemoExternalPaymentQuota,requireDemoPurchase,reserveDemoPaymentQuotaHold} from './prototype-demo-data.mjs';
import {demoAccountId,previewAccountId} from './prototype-demo-identity.mjs';

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
  const paymentMode = () => state.paymentState === 'read-error' ? state.paymentBeforeReadError ?? 'delivered' : state.paymentState ?? 'delivered';
  // D1 switch closure leaves fee configuration intact (PurchasePaymentPolicyService.current).
  const configured = method => !(paymentMode() === 'bank-off' && method === 'HDPAY_BANK');
  const networkOpen = method => !(paymentMode() === 'erc20-off' && method === 'CREGIS_USDT_ERC20'
    || paymentMode() === 'usdt-off' && method !== 'HDPAY_BANK');
  const refused = (status, message) => ({status, message, data: null});
  const handles = path => path.startsWith(base);
  const commandKinds = {ORDER_PAY:'order-pay',TRIAL_CONVERT:'trial-convert',TRADE_IN:'trade-in',CAPACITY_REPLACE:'capacity-replace',CAPACITY_KEEP:'capacity-keep'};
  const positiveId = value => /^\+?\d+$/.test(String(value).trim()) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
  const reject = message => { throw Object.assign(new Error(message), {status: 409}); };
  function purchaseSubject(kind, payload, products) {
    if (kind === 'ORDER_PAY') return {kind, orderNo: String(payload.orderNo ?? '').trim().toUpperCase()};
    // Preview claims reuse a sample number. The persisted start distinguishes each claim from its predecessors.
    if (kind === 'TRIAL_CONVERT') return {kind, identity: state.trialRow?.state === 'ELIGIBLE' ? null : state.trialRow?.startedAt};
    const requested = String(payload.targetProductNo ?? '').trim().toLowerCase();
    const targetId = kind === 'TRADE_IN' ? positiveId(payload.targetProductId) : null;
    const target = targetId ? products[targetId - 1]?.id : products.find(product => product.id === requested)?.id;
    const targetProductNo = target && (!requested || requested === target) ? target : null;
    const sourceDeviceId = positiveId(payload.sourceDeviceId);
    const identity = targetProductNo && (kind === 'CAPACITY_KEEP' || sourceDeviceId)
      ? JSON.stringify([targetProductNo, kind === 'CAPACITY_KEEP' ? null : sourceDeviceId]) : null;
    return {kind, identity, targetProductNo, sourceDeviceId};
  }
  function replacementPrice(url, request, subject, payload) {
    const {kind, sourceDeviceId, targetProductNo} = subject;
    if (!targetProductNo) reject('TRADEIN_TARGET_NOT_ACTIVE');
    const tradein = kind === 'TRADE_IN';
    const endpoint = tradein ? '/api/app/trade-in/quote' : '/api/app/trade-in/capacity-quote';
    const quote = demoFixture(new URL(endpoint, url.origin), locale(), state, {...request,
      method: () => 'POST', postDataJSON: () => ({sourceDeviceId, targetProductNo})});
    if (tradein) {
      if (payload.expectedSourceVersion == null || Number(payload.expectedSourceVersion) !== quote.sourceRowVersion) reject('TRADEIN_SOURCE_VERSION_CONFLICT');
    } else if (kind === 'CAPACITY_REPLACE'
      ? quote.decision !== 'REPLACE_REQUIRED' || sourceDeviceId === null || quote.sourceDeviceId !== sourceDeviceId
      : quote.decision !== 'CAPACITY_AVAILABLE') reject('CAPACITY_REPLACEMENT_SOURCE_CHANGED');
    if (tradein || kind === 'CAPACITY_REPLACE') {
      const source = demoFleetFacts(url, locale(), state).devices.find(device => device.id === sourceDeviceId);
      const {refusal} = demoReplacementSourceCheck(source, state, true,
        path => demoFixture(new URL(path, url.origin), locale(), state, {...request, method: () => 'GET'}));
      if (refusal) reject(refusal);
    }
    return quote.payableUsdt;
  }
  function trialPricing(url, request, payload, pricingAt) {
    if (state.trialConversionEnabled === false) reject('TRIAL_KILL_SWITCH_DISABLED');
    const trial = demoFixture(new URL('/api/trial/state', url.origin), locale(), state, {...request, method: () => 'GET', pricingAt});
    if (!['ACTIVE', 'GRACE', 'EXTENDED'].includes(trial.state) || !trial.quote) reject('TRIAL_NOT_CONVERTIBLE');
    if (payload.productNo !== trial.config.trialProductId) reject('TRIAL_PRODUCT_NOT_ELIGIBLE');
    if (payload.quoteVersion !== trial.quote.quoteVersion) reject('TRIAL_QUOTE_CHANGED');
    return trial;
  }
  const quotaItems = (subject, payload, order) => subject.kind === 'ORDER_PAY'
    ? order.lineItems.map(line => ({productNo: line.sku, quantity: line.quantity}))
    : [{productNo: subject.kind === 'TRIAL_CONVERT' ? payload.productNo : subject.targetProductNo, quantity: 1}];
  function requirePurchase(products, items, order, now) {
    const quantity = requireDemoExternalPaymentQuota(state, products, items, now);
    if (order) requireDemoPurchase(state, products, items, now);
    return quantity;
  }
  // The account's one order list.
  const ordersOf = origin => demoAccountOrders(new URL(origin), locale(), state);
  // A reset or scenario change starts a fresh account; the old scenario's quotes and intents go with it.
  let epoch = state.scenarioEpoch;
  function sync() {
    if (epoch === state.scenarioEpoch) return;
    epoch = state.scenarioEpoch;
    for (const intent of intents.values()) removeDemoPaymentQuotaHold(state, intent.quotaHold);
    quotes.clear();
    intents.clear();
  }
  // A state sample is adopted into the account's writable orders first, so its payment and delivery facts are kept
  // as delivered (paid total with fees, channel, payment number, times) instead of being regenerated on the next read.
  function settle(orderNo, status, intent, hardwareQuotaUsedAt=null) {
    if (!orderNo) return null;
    let order = state.createdOrders?.find(row => row.orderNo === orderNo);
    if (!order) {
      order = ordersOf(intent.origin).find(row => row.orderNo === orderNo);
      if (!order) return null;
      (state.createdOrders ||= []).push(order);
    }
    if (status === 'activated') Object.assign(order, {canonicalStatus: 'activated', paymentStatus: 'PAID', orderStatus: 'COMPLETED', activationStatus: 'ACTIVATED', paymentMethod: intent.paymentMethod, paidTotalUsdt: intent.totalUsdt, paymentNo: intent.intentNo, paidAt: intent.paidAt, activatedAt: Date.now(), inventoryUsedAt: Date.now(), hardwareQuotaUsedAt});
    else Object.assign(order, demoTimedOutOrder);
    return order;
  }
  // An open payment belongs to the same business even when a new request changes the reviewed price.
  const openIntent = (subject, excluding) => [...intents.values()].findLast(row => row !== excluding && row.kind === subject.kind
    && !row.receipt && !['DELIVERED', 'EXPIRED'].includes(row.status)
    && (row.kind === 'ORDER_PAY' ? !!subject.orderNo && row.orderNo === subject.orderNo
      : subject.identity != null && row.identity === subject.identity));
  // An old failed attempt cannot cancel a successor or change an already settled order.
  function closeUnpaidOrder(intent) {
    if (!intent.orderNo || openIntent(intent, intent)) return null;
    const order = ordersOf(intent.origin).find(row => row.orderNo === intent.orderNo);
    if (order?.paymentStatus !== 'PENDING' || order.orderStatus !== 'PENDING_PAYMENT') return null;
    return settle(intent.orderNo, 'expired', intent);
  }
  function expire(intent, reason) {
    removeDemoPaymentQuotaHold(state, intent.quotaHold);
    return Object.assign(intent, {status: 'EXPIRED', reason});
  }
  function lateArrival(intent, now) {
    return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'PAYMENT_LATE_REVIEW', paidAt: now});
  }
  const deliveryPaths = {
    TRIAL_CONVERT: '/api/trial/convert',
    TRADE_IN: '/api/app/trade-in/submit',
    CAPACITY_REPLACE: '/api/app/trade-in/capacity-replace',
    CAPACITY_KEEP: '/api/app/trade-in/capacity-keep',
  };
  // Settle through the same business fixture as the wallet path, with the intent's verified payment and quota.
  function deliverPurchase(intent) {
    let receipt;
    const url = new URL(deliveryPaths[intent.kind], intent.origin);
    try {
      receipt = demoFixture(url, locale(), state, {
        method: () => 'POST', headers: () => ({'idempotency-key': intent.commandKey}),
        postDataJSON: () => intent.payload, verifiedPayment: intent,
      });
    } catch (error) {
      if (!error.status) throw error;
      return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: error.message});
    }
    removeDemoPaymentQuotaHold(state, intent.quotaHold);
    return Object.assign(intent, {status: 'DELIVERED', fulfilmentStatus: 'DELIVERED', receipt: {
      ...receipt, paymentNo: intent.intentNo, amountUsdt: intent.businessAmountUsdt, paymentSubtotalUsdt: intent.subtotalUsdt,
      roundingAdjustmentUsdt: intent.roundingAdjustmentUsdt, walletDebitUsdt: '0.00', paymentMethod: intent.paymentMethod,
      paymentRail: intent.paymentMethod, paidTotalUsdt: intent.totalUsdt,
    }});
  }
  const noProviderSuccess = ['waiting', 'urgent', 'late', 'remote-in-progress', 'expired', 'mismatch'];
  // The intent advances by elapsed time according to the preview panel's 外部付款结果.
  function advance(intent) {
    const now = Date.now(), age = now - intent.createdAt, scenario = paymentMode(), bank = intent.paymentMethod === 'HDPAY_BANK';
    if (scenario === 'intent-missing') return intent;
    const graceOver = now >= graceEnd(intent.paymentMethod, intent.deadline);
    if (intent.status === 'EXPIRED') {
      if (intent.reason === 'PAYMENT_FAILED' && graceOver) closeUnpaidOrder(intent);
      // A new provider success after release is evidence for support. It cannot deliver or hold quota again.
      // Only money arriving after the payment window is a late payment; a failed bank attempt before the deadline stays failed.
      if (['delivered', 'delivery-failed'].includes(scenario) && graceOver) return lateArrival(intent, now);
      return intent;
    }
    if (!['AWAITING_PAYMENT', 'FUNDS_CONFIRMED'].includes(intent.status)) return intent;
    if (intent.status === 'AWAITING_PAYMENT') {
      if (['waiting', 'urgent', 'late', 'remote-in-progress'].includes(scenario)) {
        if (!graceOver) return intent;
        closeUnpaidOrder(intent);
        expire(intent, 'PAYMENT_TIMEOUT');
        return scenario === 'late' ? lateArrival(intent, now) : intent;
      }
      if (age < ARRIVE_AFTER) return intent;
      if (scenario === 'expired') {
        // This result compresses the wait through the deadline and confirmation grace.
        const deadline = now - graceEnd(intent.paymentMethod, 0);
        const order = closeUnpaidOrder(intent);
        if (order) Object.assign(order, {placedAt: deadline - paymentWindow, expiresAt: deadline});
        return Object.assign(expire(intent, 'PAYMENT_TIMEOUT'), {deadline, expiresAt: new Date(deadline).toISOString(),
          deadlineAt: new Date(deadline).toISOString(), confirmationGraceEndsAt: new Date(now).toISOString()});
      }
      if (scenario === 'bank-failed' && bank) return expire(intent, 'PAYMENT_FAILED');
      if (scenario === 'mismatch') return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'PAYMENT_AMOUNT_MISMATCH'});
    }
    // Confirmation is durable. The current provider response must independently verify that payment before delivery.
    if (noProviderSuccess.includes(scenario) || (bank && scenario === 'bank-failed')) return intent;
    if (intent.status === 'AWAITING_PAYMENT') {
      intent.paidAt = intent.createdAt + ARRIVE_AFTER;
      if (intent.paidAt >= intent.deadline) return lateArrival(intent, intent.paidAt);
      intent.status = 'FUNDS_CONFIRMED';
    }
    if (!networkOpen(intent.paymentMethod)) return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'CREGIS_DIRECT_PAYMENT_PAUSED', reconciliationStatus: 'REVIEW'});
    if (age < DELIVER_AFTER) return intent;
    if (scenario === 'delivery-failed') return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'PURCHASE_PAYMENT_DELIVERY_BLOCKED'});
    if (intent.kind !== 'ORDER_PAY') return deliverPurchase(intent);
    const order = ordersOf(intent.origin).find(row => row.orderNo === intent.orderNo);
    // Delivery needs the order; funds for an order that cannot be found never become a success.
    if (!order) return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'PURCHASE_PAYMENT_DELIVERY_BLOCKED'});
    // Like AppOrderCommandService.prepare inside delivery: an unpaid order holds no slot, so paid funds that no
    // longer fit the slots go to manual review with the capacity code instead of activating over the cap.
    if (!demoOrderFitsCapacity(new URL(intent.origin), locale(), state, null,
      order.lineItems.map(line => ({productNo: line.sku, quantity: line.quantity})), intent.orderNo))
      return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'CAPACITY_REPLACEMENT_REQUIRED'});
    let hardwareQuotaUsedAt;
    try {
      hardwareQuotaUsedAt=requireDemoPurchase(state,demoProducts(state,intent.origin),
        order.lineItems.map(line=>({productNo:line.sku,quantity:line.quantity})),now,true,intent.quotaHold);
    } catch (error) {
      if(error.status!==409&&error.status!==404)throw error;
      return Object.assign(intent,{status:'MANUAL_REVIEW',reason:error.message});
    }
    settle(intent.orderNo, 'activated', intent, hardwareQuotaUsedAt);
    removeDemoPaymentQuotaHold(state, intent.quotaHold);
    return Object.assign(intent, {status: 'DELIVERED', fulfilmentStatus: 'DELIVERED', receipt: {
      ...(order?.promotionQuoteId ? order : {}),
      orderNo: intent.orderNo, paymentNo: intent.intentNo, paymentStatus: 'PAID', orderStatus: 'COMPLETED', activationStatus: 'ACTIVATED', canonicalStatus: 'activated',
      amountUsdt: intent.businessAmountUsdt, paymentSubtotalUsdt: intent.subtotalUsdt, walletDebitUsdt: '0.00', paymentMethod: intent.paymentMethod, paidTotalUsdt: intent.totalUsdt,
      walletBalanceAfterUsdt: null, idempotent: false, serverCanonical: true, source: 'server', sourceEnvironment: 'PRODUCTION', runId: ''}});
  }
  // Payment details follow the current network gate without changing the stored address (PurchasePaymentService.view).
  const view = intent => {
    const {createdAt, orderNo, deadline, origin, payload, identity, targetProductNo, pricingAt, paidAt, quotaHold, ...row} = advance(intent), open = Date.now() < deadline;
    const networkEnabled = networkOpen(row.paymentMethod);
    return {...row, fulfilmentStatus: row.receipt ? 'DELIVERED' : 'NOT_DELIVERED', paymentAllowed: row.status === 'AWAITING_PAYMENT' && open && networkEnabled, address: open && networkEnabled ? row.address : null, paymentUrl: open && row.status === 'AWAITING_PAYMENT' ? row.paymentUrl : null};
  };
  function paymentCommand(kind, key) {
    sync();
    const intent = [...intents.values()].find(row => commandKinds[row.kind] === kind && row.commandKey === key);
    if (!intent) return null;
    if (state.paymentState === 'read-error') throw Object.assign(new Error('PAYMENT_COMMAND_READ_UNAVAILABLE'), {status:503});
    advance(intent);
    const original = {kind, commandKey: key, canResumeSameKey: false};
    const receipt = intent.receipt;
    if (receipt != null) {
      if (typeof receipt !== 'object' || Array.isArray(receipt) || !Object.keys(receipt).length) {
        return {...original, status: 'INDETERMINATE', message: 'PURCHASE_PAYMENT_RECEIPT_UNAVAILABLE'};
      }
      return {...original, status: 'SUCCEEDED', code: 0, receipt};
    }
    if (intent.status === 'EXPIRED') return {...original, status: 'REJECTED', message: 'PURCHASE_PAYMENT_EXPIRED'};
    return {...original, status: intent.status === 'DELIVERED' ? 'INDETERMINATE' : 'PROCESSING',
      message: intent.reason || 'PURCHASE_PAYMENT_PROCESSING'};
  }
  // The server's own observation of payments, independent of whether the App is polling.
  function sweep() {
    sync();
    for (const intent of intents.values()) advance(intent);
  }
  // AppOrderCommandService refuses a wallet pay or a cancel while an order's external payment is open.
  const openOrderPayment = orderNo => { sync(); return openIntent({kind: 'ORDER_PAY', orderNo}); };
  function readIntent(intent) {
    if (state.paymentState === 'read-error') return refused(503, 'PURCHASE_PAYMENT_INTENT_READ_UNAVAILABLE');
    return intent ? {status: 200, message: 'OK', data: view(intent)} : refused(404, 'PURCHASE_PAYMENT_INTENT_NOT_FOUND');
  }
  function handle(url, request) {
    sync();
    const path = url.pathname, method = request.method();
    const byOrder = path.match(/^\/api\/app\/purchase-payment-intents\/by-order\/([^/]+)$/);
    if (byOrder && method === 'GET') {
      const orderNo = decodeURIComponent(byOrder[1]);
      if (previewAccountId(state, request.headers?.() ?? {}) !== demoAccountId
          || !ordersOf(url.origin).some(order => order.orderNo === orderNo)) return refused(404, 'ORDER_NOT_FOUND');
      if (state.paymentState === 'read-error') return refused(503, 'PURCHASE_PAYMENT_LOOKUP_UNAVAILABLE');
      const intent = openIntent({kind: 'ORDER_PAY', orderNo});
      return {status: 200, message: 'OK', data: {orderNo, state: intent ? 'IN_PROGRESS' : 'NONE', intentNo: intent?.intentNo ?? null}};
    }
    if (path === `${base}-policy` && method === 'GET') return {status: 200, message: 'OK', data: {version: 3, channels: ['HDPAY_BANK', 'CREGIS_USDT_BSC', 'CREGIS_USDT_ERC20'].map(paymentMethod => ({paymentMethod, configured: configured(paymentMethod)}))}};
    if (path === `${base}-quotes` && method === 'POST') {
      const body = request.postDataJSON(), {kind, payload} = body;
      if (!Object.hasOwn(commandKinds, kind) || !payload) return refused(409, 'PURCHASE_PAYMENT_PRICING_CHANGED');
      const products = demoProducts(state, url.origin), subject = purchaseSubject(kind, payload, products);
      if (openIntent(subject)) return refused(409, 'PURCHASE_PAYMENT_EXISTING_INTENT_REQUIRED');
      if (!networkOpen(body.paymentMethod)) return refused(409, 'CREGIS_DIRECT_PAYMENT_PAUSED');
      // Prices and eligibility apply only to a new purchase.
      const order = kind === 'ORDER_PAY' ? ordersOf(url.origin).find(row => row.orderNo === subject.orderNo) : null;
      if (kind === 'ORDER_PAY' && !order) return refused(404, 'ORDER_NOT_FOUND');
      if (order && (order.paymentStatus !== 'PENDING' || order.orderStatus !== 'PENDING_PAYMENT')) return refused(409, 'ORDER_NOT_PAYABLE');
      const bank = body.paymentMethod === 'HDPAY_BANK', erc20 = body.paymentMethod === 'CREGIS_USDT_ERC20';
      const trial = kind === 'TRIAL_CONVERT' ? trialPricing(url, request, payload) : null;
      if (trial) {
        subject.identity = trial.claimedAtEpochMs;
        const expected = payload.expectedAmountUsdt;
        if (typeof expected !== 'number' || !Number.isFinite(expected) || expected < 0 || expected > 1000000
          || !/^\d+(?:\.\d{1,2})?$/.test(String(expected))) return refused(409, 'TRIAL_AMOUNT_INVALID');
      }
      const amount = trial ? trial.quote.amountUsdt : order?.amountUsdt ?? replacementPrice(url, request, subject, payload);
      // Trial business amounts retain six decimals; the external principal confirms HALF_UP cents.
      const micros = BigInt(Number(amount).toFixed(6).replace('.', ''));
      const subtotal = trial ? Number((micros + 5000n) / 10000n) : cents(amount);
      if (trial && subtotal > cents(payload.expectedAmountUsdt)) return refused(409, 'TRIAL_AMOUNT_MISMATCH');
      if (!configured(body.paymentMethod)) return refused(503, 'PURCHASE_PAYMENT_FEES_NOT_CONFIGURED');
      const now = Date.now(), deadline = order ? Number(order.expiresAt) : now + paymentWindow;
      if (deadline <= now) return refused(409, 'ORDER_PAYMENT_EXPIRED');
      const items = quotaItems(subject, payload, order);
      requirePurchase(products, items, order, now);
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
      if ([...intents.values()].some(row => row.paymentQuoteId === quoteId)) return refused(409, 'PURCHASE_PAYMENT_QUOTE_ALREADY_USED');
      if (openIntent(subject)) return refused(409, 'PURCHASE_PAYMENT_EXISTING_INTENT_REQUIRED');
      if (!networkOpen(source.quote.paymentMethod)) return refused(409, 'CREGIS_DIRECT_PAYMENT_PAUSED');
      // Recheck current purchase eligibility before allocating an intent.
      const trial = subject.kind === 'TRIAL_CONVERT' ? trialPricing(url, request, source.payload, source.pricingAt) : null;
      if (trial && trial.claimedAtEpochMs !== subject.identity) return refused(409, 'TRIAL_NOT_CONVERTIBLE');
      if (deadline <= Date.now()) return refused(409, 'ORDER_PAYMENT_EXPIRED');
      if (Date.parse(source.quote.expiresAt) <= Date.now()) return refused(409, 'PURCHASE_PAYMENT_QUOTE_EXPIRED');
      const order = subject.orderNo ? ordersOf(url.origin).find(row => row.orderNo === subject.orderNo) : null;
      if (subject.kind === 'ORDER_PAY') {
        if (!order) return refused(404, 'ORDER_NOT_FOUND');
        if (order.paymentStatus !== 'PENDING' || order.orderStatus !== 'PENDING_PAYMENT') return refused(409, 'ORDER_NOT_PAYABLE');
      }
      const amount = trial ? trial.quote.amountUsdt : order?.amountUsdt ?? replacementPrice(url, request, subject, source.payload);
      if (Number(amount).toFixed(6) !== source.quote.businessAmountUsdt) return refused(409, 'PURCHASE_PAYMENT_PRICING_CHANGED');
      const products = demoProducts(state, url.origin), items = quotaItems(subject, source.payload, order), now = Date.now();
      const quantity = requirePurchase(products, items, order, now);
      const quotaHold = reserveDemoPaymentQuotaHold(state, now, quantity);
      const intentNo = `PPI-PREVIEW-${++sequence}`;
      // One deadline: the intent closes with the order, or 30 minutes from the quote when there is no order.
      const intent = {...source.quote, intentNo, commandKey: key, status: 'AWAITING_PAYMENT', reason: '', receipt: null, expiresAt: source.quote.deadlineAt,
        paymentUrl: source.quote.paymentMethod === 'HDPAY_BANK' ? `https://api.hdpayadmin.com/pay/${intentNo}` : null,
        address: source.quote.paymentMethod === 'HDPAY_BANK' ? null : '0x' + (source.quote.paymentMethod === 'CREGIS_USDT_ERC20' ? '7d3a' : '4b1f') + String(sequence).padStart(36, '0'),
        createdAt: Date.now(), orderNo: subject.orderNo, identity: subject.identity, targetProductNo: subject.targetProductNo, payload: source.payload, pricingAt: source.pricingAt, deadline, origin: url.origin, quotaHold};
      intents.set(intentNo, intent);
      // The deadline task leaves an order with a payment intent to the payment's own outcome.
      if (subject.orderNo) (state.intentOrders ??= {})[subject.orderNo] = true;
      return {status: 200, message: 'OK', data: view(intent)};
    }
    if (path === `${base}-intents` && method === 'GET') {
      const intent = [...intents.values()].find(row => row.kind === url.searchParams.get('kind') && row.commandKey === url.searchParams.get('commandKey'));
      return readIntent(intent);
    }
    const one = path.match(/^\/api\/app\/purchase-payment-intents\/([^/]+)$/);
    if (one && method === 'GET') {
      return readIntent(intents.get(decodeURIComponent(one[1])));
    }
    return {status: 404, message: 'PURCHASE_PAYMENT_NOT_MODELED', data: null};
  }
  function seedRemoteOrderPayment(origin) {
    const orderNo = 'DEMO-ORDER-001';
    if (openOrderPayment(orderNo)) return {status: 200};
    const request = (body, headers = {}) => ({method: () => 'POST', postDataJSON: () => body, headers: () => headers});
    const quote = handle(new URL(`${base}-quotes`, origin), request({kind: 'ORDER_PAY', paymentMethod: 'CREGIS_USDT_BSC', payload: {orderNo}}));
    if (quote.status !== 200) return quote;
    return handle(new URL(`${base}-intents`, origin), request({paymentQuoteId: quote.data.paymentQuoteId},
      {'idempotency-key': `wallet-pay:${orderNo}:other-device`}));
  }
  return {handles, handle, paymentCommand, sweep, sync, openOrderPayment, seedRemoteOrderPayment};
}
