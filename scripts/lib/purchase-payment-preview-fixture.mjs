// Local preview only: external purchase payments (bank page / USDT address) for the
// design walkthrough. Never imported by src. The bank page URL points at the real
// provider host (the App only frames trusted hosts), so that frame shows the provider's
// reply for an unknown order; no payment is created anywhere.
import {demoAccountOrders,demoCapacityReplacementSource,demoFixture,demoFleetFacts,demoHasAccountOrder,demoOrderFitsCapacity,demoProducts,demoReplacementSourceCheck,demoTimedOutOrder,paymentWindow,addDemoPaymentQuotaHold,removeDemoPaymentQuotaHold,requireDemoExternalPaymentQuota,requireDemoExternalOrderGate,requireDemoPurchase,requireDemoQuoteStock,reserveDemoPaymentQuotaHold} from './prototype-demo-data.mjs';
import {demoDepositNetworkDisabledReason} from './prototype-demo-deposit-network.mjs';
import {demoPaymentIntentMissing,demoPaymentScenario} from './prototype-demo-payment-mode.mjs';
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
  const suspendedIntents = new Map();
  let sequence = 0;
  const paymentMode = () => demoPaymentScenario(state);
  // D1 switch closure leaves fee configuration intact (PurchasePaymentPolicyService.current).
  const configured = method => !(paymentMode() === 'bank-off' && method === 'HDPAY_BANK');
  const refused = (status, message) => ({status, message, data: null});
  const networkGate = method => {
    if (method === 'HDPAY_BANK') return null;
    const reason = demoDepositNetworkDisabledReason(state, method === 'CREGIS_USDT_ERC20' ? 'ERC20' : 'BEP20');
    if (reason === 'NOT_CONFIGURED') return refused(503, 'CREGIS_DIRECT_PAYMENT_UNAVAILABLE');
    return reason === 'NETWORK_SWITCH_OFF' ? refused(409, 'CREGIS_DIRECT_PAYMENT_PAUSED') : null;
  };
  const handles = path => path.startsWith(base);
  // The preview models one purchasing account, including its seeded payments.
  const ownsPreviewPayments = request => previewAccountId(state, request.headers?.() ?? {}) === demoAccountId;
  function existingIntentRefusal(intent, payload) {
    if (intent.kind === 'TRIAL_CONVERT') {
      const productNo = String(payload.productNo ?? '');
      if (!/^[A-Za-z0-9._-]{2,64}$/.test(productNo)) return refused(422, 'TRIAL_PRODUCT_REQUIRED');
      const canonicalProductNo = value => value === 'device-trial-standard' ? 'stellarbox-s1' : value;
      if (canonicalProductNo(productNo) !== canonicalProductNo(intent.payload.productNo)) {
        return refused(409, 'TRIAL_PRODUCT_NOT_ELIGIBLE');
      }
    }
    return {
      ...refused(409, 'PURCHASE_PAYMENT_EXISTING_INTENT_REQUIRED'),
      data: intent.kind === 'ORDER_PAY' ? null : {intentNo: intent.intentNo},
    };
  }
  function replacementRefusal(url, request, kind, sourceId) {
    if (kind !== 'TRADE_IN' && kind !== 'CAPACITY_REPLACE') return null;
    const fleet = demoFleetFacts(url, locale(), state);
    if (kind === 'CAPACITY_REPLACE' && (!Number.isSafeInteger(sourceId)
      || demoCapacityReplacementSource(fleet, demoProducts(state, url.origin))?.id !== sourceId))
      return refused(409, 'CAPACITY_REPLACEMENT_SOURCE_CHANGED');
    const source = fleet.devices.find(device => device.id === sourceId);
    const { refusal } = demoReplacementSourceCheck(source, state, true,
      path => demoFixture(new URL(path, url.origin), locale(), state, {...request, method: () => 'GET'}));
    return refusal ? refused(409, refusal) : null;
  }
  const replacementPaths = {TRADE_IN:'submit', CAPACITY_REPLACE:'capacity-replace', CAPACITY_KEEP:'capacity-keep'};
  function replacementPricing(url, request, subject, payload) {
    const {kind} = subject;
    if (!subject.targetProductNo) reject('TRADEIN_TARGET_NOT_ACTIVE');
    const refusal = replacementRefusal(url, request, kind, subject.sourceDeviceId);
    if (refusal) throw Object.assign(new Error(refusal.message), {status:refusal.status});
    const tradein = kind === 'TRADE_IN';
    const quoted = demoFixture(new URL('/api/app/trade-in/' + (tradein ? 'quote' : 'capacity-quote'), url.origin),
      locale(), state, {...request, externalPurchasePricing: true, method: () => 'POST',
        postDataJSON: () => ({sourceDeviceId: subject.sourceDeviceId, targetProductNo: subject.targetProductNo})});
    const {sourceDeviceId, targetProductId, targetProductNo, targetPriceUsdt, payableUsdt} = quoted;
    const discountUsdt = tradein ? quoted.discountUsdt : 0;
    const targetDeviceStatus = tradein ? quoted.targetDeviceStatus : 'ACTIVE';
    const sourceRowVersion = tradein ? quoted.sourceRowVersion : sourceDeviceId == null ? null
      : demoFleetFacts(url, locale(), state).devices.find(device => device.id === sourceDeviceId)?.rowVersion;
    if (tradein && (payload.expectedSourceVersion == null || Number(payload.expectedSourceVersion) !== sourceRowVersion))
      reject('TRADEIN_SOURCE_VERSION_CONFLICT');
    if (!tradein && quoted.decision !== (kind === 'CAPACITY_REPLACE' ? 'REPLACE_REQUIRED' : 'CAPACITY_AVAILABLE'))
      reject('CAPACITY_REPLACEMENT_SOURCE_CHANGED');
    if (!Number.isFinite(payload.expectedPayableUsdt) || Math.abs(payload.expectedPayableUsdt - payableUsdt) > 0.000001
      || tradein && (!Number.isFinite(payload.expectedDiscountUsdt) || Math.abs(payload.expectedDiscountUsdt - discountUsdt) > 0.000001))
      reject('PURCHASE_PAYMENT_PRICING_CHANGED');
    return {sourceDeviceId, sourceRowVersion, targetProductId, targetProductNo, targetPriceUsdt, payableUsdt, discountUsdt, targetDeviceStatus};
  }
  function checkedReplacementPricing(url, request, subject, payload, original) {
    const pricing = replacementPricing(url, request, subject, payload);
    if (original && JSON.stringify(pricing) !== JSON.stringify(original))
      reject('PURCHASE_PAYMENT_PRICING_CHANGED');
    return pricing;
  }
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
  // The account's one order list.
  const ordersOf = origin => demoAccountOrders(new URL(origin), locale(), state);
  // A reset or scenario change starts a fresh account; the old scenario's quotes and intents go with it.
  let epoch = state.scenarioEpoch;
  const sync = () => {
    if (epoch === state.scenarioEpoch) return;
    epoch = state.scenarioEpoch;
    for (const intent of intents.values()) removeDemoPaymentQuotaHold(state, intent.quotaHold);
    quotes.clear();
    intents.clear();
    suspendedIntents.clear();
  };
  const sameSubject = (row, subject) => row.kind === subject.kind
    && (row.kind === 'ORDER_PAY' ? !!subject.orderNo && row.orderNo === subject.orderNo
      : subject.identity != null && row.identity === subject.identity);
  function selectPaymentMode(wasMissing) {
    sync();
    const missing = demoPaymentIntentMissing(state);
    if (missing === wasMissing) return;
    if (missing) {
      // The alternative scenario has no original unpaid provider order. Retain that
      // sample outside the live intent store so no read, write or observer can use it.
      for (const [no, intent] of intents) {
        if (intent.status !== 'AWAITING_PAYMENT') continue;
        suspendedIntents.set(no, intent);
        intents.delete(no);
        removeDemoPaymentQuotaHold(state, intent.quotaHold);
        if (intent.orderNo && state.intentOrders) delete state.intentOrders[intent.orderNo];
      }
    } else {
      for (const [no, intent] of suspendedIntents) {
        if ([...intents.values()].some(row => sameSubject(row, intent))) continue;
        if (intent.orderNo) {
          const order = ordersOf(intent.origin).find(row => row.orderNo === intent.orderNo);
          if (order?.paymentStatus !== 'PENDING' || order.orderStatus !== 'PENDING_PAYMENT') continue;
          (state.intentOrders ??= {})[intent.orderNo] = true;
        }
        addDemoPaymentQuotaHold(state, intent.quotaHold);
        intents.set(no, intent);
      }
      suspendedIntents.clear();
    }
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
  // Recover the latest open intent for the same purchase after a replacement attempt.
  const openIntent = (subject, excluding) => [...intents.values()].findLast(row => row !== excluding && sameSubject(row, subject)
    && !row.receipt && !['DELIVERED', 'EXPIRED'].includes(row.status));
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
      const request = {
        method: () => 'POST', headers: () => ({'idempotency-key': intent.commandKey}),
        postDataJSON: () => intent.payload, verifiedPayment: intent,
      };
      const replacementQuote = intent.replacementQuote
        ? checkedReplacementPricing(url, request, intent, intent.payload, intent.replacementQuote) : undefined;
      receipt = demoFixture(url, locale(), state, {...request, replacementQuote});
    } catch (error) {
      return Object.assign(intent, {status: 'MANUAL_REVIEW', reconciliationStatus: 'REVIEW',
        reason: error.status ? error.message : 'PURCHASE_PAYMENT_DELIVERY_BLOCKED'});
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
    const graceOver = now >= graceEnd(intent.paymentMethod, intent.deadline);
    if (intent.status === 'EXPIRED') {
      if (intent.reason === 'PAYMENT_FAILED' && graceOver) closeUnpaidOrder(intent);
      // A new provider success after release is evidence for support. It cannot deliver or hold quota again.
      if (['delivered', 'delivery-failed'].includes(scenario)) return lateArrival(intent, now);
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
    if (networkGate(intent.paymentMethod)) return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'CREGIS_DIRECT_PAYMENT_PAUSED', reconciliationStatus: 'REVIEW'});
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
    const {createdAt, orderNo, deadline, origin, payload, identity, targetProductNo, sourceDeviceId, pricingAt, paidAt, replacementQuote, quotaHold, ...row} = intent, open = Date.now() < deadline;
    const networkEnabled = networkGate(row.paymentMethod) === null;
    return {...row, fulfilmentStatus: row.receipt ? 'DELIVERED' : 'NOT_DELIVERED', paymentAllowed: row.status === 'AWAITING_PAYMENT' && open && networkEnabled, address: open && networkEnabled ? row.address : null, paymentUrl: open && row.status === 'AWAITING_PAYMENT' ? row.paymentUrl : null};
  };
  function paymentCommand(kind, key) {
    sync();
    if (state.paymentState === 'read-error') throw Object.assign(new Error('PAYMENT_COMMAND_READ_UNAVAILABLE'), {status:503});
    const intent = [...intents.values()].find(row => commandKinds[row.kind] === kind && row.commandKey === key);
    if (!intent) return null;
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
      message: intent.reason ?? 'PURCHASE_PAYMENT_PROCESSING'};
  }
  // The preview server observes providers independently of order, intent and receipt reads.
  function observePayments() {
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
    return handlePayment(url, request, ownsPreviewPayments(request));
  }
  function handlePayment(url, request, ownsPayments) {
    sync();
    const path = url.pathname, method = request.method();
    const byOrder = path.match(/^\/api\/app\/purchase-payment-intents\/by-order\/([^/]+)$/);
    if (byOrder && method === 'GET') {
      const orderNo = decodeURIComponent(byOrder[1]);
      if (!ownsPayments || !demoHasAccountOrder(url,state,orderNo)) return refused(404, 'ORDER_NOT_FOUND');
      if (state.paymentState === 'read-error') return refused(503, 'PURCHASE_PAYMENT_LOOKUP_UNAVAILABLE');
      const intent = openIntent({kind: 'ORDER_PAY', orderNo});
      return {status: 200, message: 'OK', data: {orderNo, state: intent ? 'IN_PROGRESS' : 'NONE', intentNo: intent?.intentNo ?? null}};
    }
    if (path === `${base}-policy` && method === 'GET') return {status: 200, message: 'OK', data: {version: 3, channels: ['HDPAY_BANK', 'CREGIS_USDT_BSC', 'CREGIS_USDT_ERC20'].map(paymentMethod => ({paymentMethod, configured: configured(paymentMethod)}))}};
    if (path === `${base}-quotes` && method === 'POST') {
      if (!ownsPayments) return refused(404, 'PURCHASE_PAYMENT_QUOTE_NOT_FOUND');
      const body = request.postDataJSON(), {kind, payload} = body;
      if (!Object.hasOwn(commandKinds, kind) || !payload) return refused(409, 'PURCHASE_PAYMENT_PRICING_CHANGED');
      const products = demoProducts(state, url.origin), subject = purchaseSubject(kind, payload, products);
      const existing = openIntent(subject);
      if (existing) return existingIntentRefusal(existing, payload);
      const gate = networkGate(body.paymentMethod);
      if (gate) return gate;
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
      const items = quotaItems(subject, payload, order);
      const quoteProducts = items.map(({productNo}) =>
        state.dataState === 'empty' ? undefined : products.find(product => product.id === productNo));
      if (order && quoteProducts.some(product => !product)) return refused(409, 'ORDER_ITEM_SNAPSHOT_CONFLICT');
      if (!order) requireDemoQuoteStock(quoteProducts);
      const replacementQuote = Object.hasOwn(replacementPaths, kind)
        ? replacementPricing(url, request, subject, payload) : undefined;
      const amount = trial ? trial.quote.amountUsdt : order?.amountUsdt ?? replacementQuote.payableUsdt;
      // Trial business amounts retain six decimals; the external principal confirms HALF_UP cents.
      const micros = BigInt(Number(amount).toFixed(6).replace('.', ''));
      const subtotal = trial ? Number((micros + 5000n) / 10000n) : cents(amount);
      if (trial && subtotal > cents(payload.expectedAmountUsdt)) return refused(409, 'TRIAL_AMOUNT_MISMATCH');
      if (!configured(body.paymentMethod)) return refused(503, 'PURCHASE_PAYMENT_FEES_NOT_CONFIGURED');
      const now = Date.now(), deadline = order ? Number(order.expiresAt) : now + paymentWindow;
      if (deadline <= now) return refused(409, 'ORDER_PAYMENT_EXPIRED');
      requireDemoExternalPaymentQuota(state, products, items, now);
      if (order) requireDemoExternalOrderGate(state, products, items, now);
      const adjustment = Number(BigInt(subtotal) * 10000n - micros) / 1000000;
      const channel = Math.round(subtotal * 0.0125) + 50, network = bank ? 0 : erc20 ? 380 : 25;
      if (trial) state.lastTrialPaymentQuote = {...body,amountUsdt:amount,subtotalUsdt:money(subtotal)};
      const quote = {paymentQuoteId: `PPQ-PREVIEW-${++sequence}`, kind: body.kind, paymentMethod: body.paymentMethod, network: bank ? 'VND_BANK' : erc20 ? 'ERC20' : 'BSC',
        businessAmountUsdt: Number(amount).toFixed(6), roundingAdjustmentUsdt: adjustment.toFixed(6), subtotalUsdt: money(subtotal), channelFeeUsdt: money(channel),
        networkConfirmFeeUsdt: money(network), totalUsdt: money(subtotal + channel + network), feePolicyVersion: 3, pricingAsOf: new Date(now).toISOString(), expiresAt: new Date(Math.min(now + QUOTE_TTL, deadline)).toISOString(),
        deadlineAt: new Date(deadline).toISOString(), confirmationGraceEndsAt: new Date(graceEnd(body.paymentMethod, deadline)).toISOString(),
        fxRateVndPerUsdt: bank ? '25000.000000' : null, amountVnd: bank ? String((subtotal + channel) * 250) : null};
      quotes.set(quote.paymentQuoteId, {quote, subject, deadline, pricingAt: now, payload, replacementQuote});
      return {status: 200, message: 'OK', data: quote};
    }
    if (path === `${base}-intents` && method === 'POST') {
      if (!ownsPayments) return refused(404, 'PURCHASE_PAYMENT_QUOTE_NOT_FOUND');
      const key = request.headers()['idempotency-key'], quoteId = request.postDataJSON().paymentQuoteId, source = quotes.get(quoteId);
      if (!key) return refused(422, 'IDEMPOTENCY_KEY_REQUIRED');
      if (!source) return refused(404, 'PURCHASE_PAYMENT_QUOTE_NOT_FOUND');
      const {subject, deadline} = source, known = [...intents.values()].find(row => row.kind === subject.kind && row.commandKey === key);
      if (known) return known.paymentQuoteId === quoteId ? {status: 200, message: 'OK', data: view(known)} : refused(409, 'IDEMPOTENCY_KEY_CONFLICT');
      const suspended = [...suspendedIntents.values()].find(row => row.kind === subject.kind && row.commandKey === key);
      if (suspended && suspended.paymentQuoteId !== quoteId) return refused(409, 'IDEMPOTENCY_KEY_CONFLICT');
      if ([...intents.values()].some(row => row.paymentQuoteId === quoteId)) return refused(409, 'PURCHASE_PAYMENT_QUOTE_ALREADY_USED');
      const existing = openIntent(subject);
      if (existing) return existingIntentRefusal(existing, source.payload);
      const gate = networkGate(source.quote.paymentMethod);
      if (gate) return gate;
      if (deadline <= Date.now()) return refused(409, 'ORDER_PAYMENT_EXPIRED');
      if (Date.parse(source.quote.expiresAt) <= Date.now()) return refused(409, 'PURCHASE_PAYMENT_QUOTE_EXPIRED');
      const order = subject.kind === 'ORDER_PAY' ? ordersOf(url.origin).find(row => row.orderNo === subject.orderNo) : null;
      if (subject.kind === 'ORDER_PAY') {
        if (!order) return refused(404, 'ORDER_NOT_FOUND');
        if (order.paymentStatus !== 'PENDING' || order.orderStatus !== 'PENDING_PAYMENT') return refused(409, 'ORDER_NOT_PAYABLE');
      }
      // Reprice the trial at the original quote time while applying the current policy.
      const trial = subject.kind === 'TRIAL_CONVERT' ? trialPricing(url, request, source.payload, source.pricingAt) : null;
      if (trial && trial.claimedAtEpochMs !== subject.identity) return refused(409, 'TRIAL_NOT_CONVERTIBLE');
      if (source.replacementQuote)
        checkedReplacementPricing(url, request, subject, source.payload, source.replacementQuote);
      const amount = trial?.quote.amountUsdt ?? order?.amountUsdt;
      if (amount != null && Number(amount).toFixed(6) !== source.quote.businessAmountUsdt)
        return refused(409, 'PURCHASE_PAYMENT_PRICING_CHANGED');
      const products = demoProducts(state, url.origin), items = quotaItems(subject, source.payload, order);
      const now = Date.now();
      const quantity = requireDemoExternalPaymentQuota(state, products, items, now);
      if (order) requireDemoExternalOrderGate(state, products, items, now);
      // One deadline: the intent closes with the order, or 30 minutes from the quote when there is no order.
      const intentNo = suspended?.intentNo ?? `PPI-PREVIEW-${++sequence}`;
      const intent = suspended ?? {...source.quote, intentNo, commandKey: key, status: 'AWAITING_PAYMENT', reason: '', receipt: null, expiresAt: source.quote.deadlineAt,
        paymentUrl: source.quote.paymentMethod === 'HDPAY_BANK' ? `https://api.hdpayadmin.com/pay/${intentNo}` : null,
        address: source.quote.paymentMethod === 'HDPAY_BANK' ? null : '0x' + (source.quote.paymentMethod === 'CREGIS_USDT_ERC20' ? '7d3a' : '4b1f') + String(sequence).padStart(36, '0'),
        createdAt: Date.now(), ...subject, payload: source.payload, replacementQuote: source.replacementQuote, pricingAt: source.pricingAt, deadline, origin: url.origin};
      if (suspended) {
        suspendedIntents.delete(intentNo);
        addDemoPaymentQuotaHold(state, suspended.quotaHold);
      } else {
        intent.quotaHold = reserveDemoPaymentQuotaHold(state, now, quantity);
      }
      intents.set(intentNo, intent);
      // The deadline task leaves an order with a payment intent to the payment's own outcome.
      if (subject.orderNo) (state.intentOrders ??= {})[subject.orderNo] = true;
      return {status: 200, message: 'OK', data: view(intent)};
    }
    if (path === `${base}-intents` && method === 'GET') {
      if (!ownsPayments) return refused(404, 'PURCHASE_PAYMENT_INTENT_NOT_FOUND');
      const intent = [...intents.values()].find(row => row.kind === url.searchParams.get('kind') && row.commandKey === url.searchParams.get('commandKey'));
      return readIntent(intent);
    }
    const snapshot = path.match(/^\/api\/app\/purchase-payment-intents\/snapshots\/([^/]+)$/);
    if (snapshot && method === 'GET') {
      if (!ownsPayments) return refused(404, 'PURCHASE_PAYMENT_INTENT_NOT_FOUND');
      return readIntent(intents.get(decodeURIComponent(snapshot[1])));
    }
    const one = path.match(/^\/api\/app\/purchase-payment-intents\/([^/]+)$/);
    if (one && method === 'GET') {
      if (!ownsPayments) return refused(404, 'PURCHASE_PAYMENT_INTENT_NOT_FOUND');
      return readIntent(intents.get(decodeURIComponent(one[1])));
    }
    return {status: 404, message: 'PURCHASE_PAYMENT_NOT_MODELED', data: null};
  }
  function seedRemoteOrderPayment(origin) {
    const orderNo = 'DEMO-ORDER-001';
    if (openOrderPayment(orderNo)) return {status: 200};
    const request = (body, headers = {}) => ({method: () => 'POST', postDataJSON: () => body, headers: () => headers});
    const quote = handlePayment(new URL(`${base}-quotes`, origin), request({kind: 'ORDER_PAY', paymentMethod: 'CREGIS_USDT_BSC', payload: {orderNo}}), true);
    if (quote.status !== 200) return quote;
    return handlePayment(new URL(`${base}-intents`, origin), request({paymentQuoteId: quote.data.paymentQuoteId},
      {'idempotency-key': `wallet-pay:${orderNo}:other-device`}), true);
  }
  return {handles, handle, paymentCommand, sync, observePayments, openOrderPayment, seedRemoteOrderPayment, selectPaymentMode, ownsPreviewPayments};
}
