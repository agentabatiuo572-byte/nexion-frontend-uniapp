// Local preview only: external purchase payments (bank page / USDT address) for the
// design walkthrough. Never imported by src. The bank page URL points at the real
// provider host (the App only frames trusted hosts), so that frame shows the provider's
// reply for an unknown order; no payment is created anywhere.
import {demoAccountOrders,demoCapacityReplacementSource,demoFixture,demoFleetFacts,demoHasAccountOrder,demoOrderFitsCapacity,demoProducts,demoReplacementSourceCheck,demoTimedOutOrder,paymentWindow,requireDemoExternalPaymentQuota,requireDemoExternalOrderGate,requireDemoPurchase} from './prototype-demo-data.mjs';
import {demoAccountId,previewAccountId} from './prototype-demo-identity.mjs';
import {demoPaymentIntentMissing,demoPaymentScenario} from './prototype-demo-payment-mode.mjs';

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
  const networkOpen = method => !(paymentMode() === 'erc20-off' && method === 'CREGIS_USDT_ERC20'
    || paymentMode() === 'usdt-off' && method !== 'HDPAY_BANK');
  const refused = (status, message) => ({status, message, data: null});
  const handles = path => path.startsWith(base);
  // The preview models one purchasing account, including its seeded payments.
  const ownsPreviewPayments = request => {
    const headers = request.headers?.() ?? {};
    // The preview sign-in endpoint also issues a credential for its formal probe account.
    const formalProbe = headers.authorization === 'Bearer formal-probe-access-token' && state.authUser?.nickname === 'Formal Probe';
    return previewAccountId(state, formalProbe ? {...headers, authorization: 'Bearer local-demo-token'} : headers) === demoAccountId;
  };
  const existingIntent = intent => ({
    ...refused(409, 'PURCHASE_PAYMENT_EXISTING_INTENT_REQUIRED'),
    data: intent.kind === 'ORDER_PAY' ? null : {intentNo: intent.intentNo, commandKey: intent.commandKey},
  });
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
  // An open payment belongs to the same purchase even when a new request changes the reviewed price.
  const openIntent = (subject, excluding) => [...intents.values()].find(row => row !== excluding && sameSubject(row, subject)
    && !row.receipt && !['DELIVERED', 'EXPIRED'].includes(row.status));
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
    return recordDelivery(intent, receipt);
  }
  function deliverReplacement(intent) {
    const url = new URL('/api/app/trade-in/' + replacementPaths[intent.kind], intent.origin);
    const request = {method: () => 'POST', postDataJSON: () => intent.payload};
    let receipt;
    try {
      const replacementQuote = checkedReplacementPricing(url, request, intent, intent.payload, intent.replacementQuote);
      receipt = demoFixture(url, locale(), state, {...request, verifiedPayment: intent, replacementQuote});
    } catch (error) {
      return Object.assign(intent, {status: 'MANUAL_REVIEW', reconciliationStatus: 'REVIEW',
        reason: error.status ? error.message : 'PURCHASE_PAYMENT_DELIVERY_BLOCKED'});
    }
    return recordDelivery(intent, receipt);
  }
  function recordDelivery(intent, receipt) {
    return Object.assign(intent, {status: 'DELIVERED', fulfilmentStatus: 'DELIVERED', receipt: {...receipt, paymentNo: intent.intentNo, amountUsdt: intent.businessAmountUsdt, paymentSubtotalUsdt: intent.subtotalUsdt,
      roundingAdjustmentUsdt: intent.roundingAdjustmentUsdt, walletDebitUsdt: '0.00', paymentMethod: intent.paymentMethod, paymentRail: intent.paymentMethod, paidTotalUsdt: intent.totalUsdt}});
  }
  // The intent advances by elapsed time according to the preview panel's 外部付款结果.
  function advance(intent) {
    const now = Date.now(), age = now - intent.createdAt, scenario = paymentMode(), bank = intent.paymentMethod === 'HDPAY_BANK';
    const graceOver = now >= graceEnd(intent.paymentMethod, intent.deadline);
    if (intent.status === 'EXPIRED' && intent.reason === 'PAYMENT_FAILED' && graceOver) return timeOut(intent);
    if (!['AWAITING_PAYMENT', 'FUNDS_CONFIRMED'].includes(intent.status)) return intent;
    if (intent.status === 'AWAITING_PAYMENT' && ['waiting', 'urgent', 'late', 'remote-in-progress'].includes(scenario)) {
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
    // Observation continues during closure; deliver()/cregisGate records the refusal for manual review.
    // Reopening alone does not revalidate a MANUAL_REVIEW intent or erase its observed arrival.
    if (!networkOpen(intent.paymentMethod)) return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'CREGIS_DIRECT_PAYMENT_PAUSED', reconciliationStatus: 'REVIEW'});
    if (age < DELIVER_AFTER) return Object.assign(intent, {status: 'FUNDS_CONFIRMED'});
    if (scenario === 'delivery-failed') return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'PURCHASE_PAYMENT_DELIVERY_BLOCKED'});
    if (intent.kind === 'TRIAL_CONVERT') return deliverTrial(intent);
    if (intent.kind !== 'ORDER_PAY') return deliverReplacement(intent);
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
        order.lineItems.map(line=>({productNo:line.sku,quantity:line.quantity})),now,true);
    } catch (error) {
      if(error.status!==409&&error.status!==404)throw error;
      return Object.assign(intent,{status:'MANUAL_REVIEW',reason:error.message});
    }
    settle(intent.orderNo, 'activated', intent, hardwareQuotaUsedAt);
    return Object.assign(intent, {status: 'DELIVERED', fulfilmentStatus: 'DELIVERED', receipt: {
      ...(order?.promotionQuoteId ? order : {}),
      orderNo: intent.orderNo, paymentNo: intent.intentNo, paymentStatus: 'PAID', orderStatus: 'COMPLETED', activationStatus: 'ACTIVATED', canonicalStatus: 'activated',
      amountUsdt: intent.businessAmountUsdt, paymentSubtotalUsdt: intent.subtotalUsdt, walletDebitUsdt: '0.00', paymentMethod: intent.paymentMethod, paidTotalUsdt: intent.totalUsdt,
      walletBalanceAfterUsdt: null, idempotent: false, serverCanonical: true, source: 'server', sourceEnvironment: 'PRODUCTION', runId: ''}});
  }
  // Payment details follow the current network gate without changing the stored address (PurchasePaymentService.view).
  const view = intent => {
    const {createdAt, orderNo, deadline, origin, payload, identity, targetProductNo, sourceDeviceId, pricingAt, paidAt, replacementQuote, ...row} = intent, open = Date.now() < deadline;
    const networkEnabled = networkOpen(row.paymentMethod);
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
      if (existing) {
        if (kind === 'TRIAL_CONVERT') {
          const productNo = String(payload.productNo ?? '');
          if (!/^[A-Za-z0-9._-]{2,64}$/.test(productNo)) return refused(422, 'TRIAL_PRODUCT_REQUIRED');
          const canonicalProductNo = value => value === 'device-trial-standard' ? 'stellarbox-s1' : value;
          if (canonicalProductNo(productNo) !== canonicalProductNo(existing.payload.productNo)) {
            return refused(409, 'TRIAL_PRODUCT_NOT_ELIGIBLE');
          }
        }
        return existingIntent(existing);
      }
      if (!networkOpen(body.paymentMethod)) return refused(409, 'CREGIS_DIRECT_PAYMENT_PAUSED');
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
      const items = quotaItems(subject, payload, order);
      if (order) requireDemoPurchase(state, products, items, now, true);
      else requireDemoExternalPaymentQuota(state, products, items, now);
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
      if (existing) return existingIntent(existing);
      if (!networkOpen(source.quote.paymentMethod)) return refused(409, 'CREGIS_DIRECT_PAYMENT_PAUSED');
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
      requireDemoExternalPaymentQuota(state, products, items, Date.now());
      if (order) requireDemoExternalOrderGate(products, items);
      // One deadline: the intent closes with the order, or 30 minutes from the quote when there is no order.
      const intentNo = suspended?.intentNo ?? `PPI-PREVIEW-${++sequence}`;
      const intent = suspended ?? {...source.quote, intentNo, commandKey: key, status: 'AWAITING_PAYMENT', reason: '', receipt: null, expiresAt: source.quote.deadlineAt,
        paymentUrl: source.quote.paymentMethod === 'HDPAY_BANK' ? `https://api.hdpayadmin.com/pay/${intentNo}` : null,
        address: source.quote.paymentMethod === 'HDPAY_BANK' ? null : '0x' + (source.quote.paymentMethod === 'CREGIS_USDT_ERC20' ? '7d3a' : '4b1f') + String(sequence).padStart(36, '0'),
        createdAt: Date.now(), ...subject, payload: source.payload, replacementQuote: source.replacementQuote, pricingAt: source.pricingAt, deadline, origin: url.origin};
      if (suspended) suspendedIntents.delete(intentNo);
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
  return {handles, handle, paymentCommand, observePayments, openOrderPayment, seedRemoteOrderPayment, selectPaymentMode, ownsPreviewPayments};
}
