// Local preview only: external purchase payments (bank page / USDT address) for the
// design walkthrough. Never imported by src. The bank page URL points at the real
// provider host (the App only frames trusted hosts), so that frame shows the provider's
// reply for an unknown order; no payment is created anywhere.
import {demoAccountOrders,demoAssignablePurchaseSlots,demoCapacityReplacementSource,demoFixture,demoFleetFacts,demoHasAccountOrder,demoOrderDelivery,demoOrderPaymentDeadline,demoPaidOrderDelivery,demoProducts,demoReplacementSourceCheck,demoTimedOutOrder,paymentWindow,addDemoPaymentQuotaHold,removeDemoPaymentQuotaHold,requireDemoExternalPaymentQuota,requireDemoExternalOrderGate,requireDemoPurchase,requireDemoQuoteStock,reserveDemoPaymentQuotaHold} from './prototype-demo-data.mjs';
import {demoDepositNetworkDisabledReason} from './prototype-demo-deposit-network.mjs';
import {demoPaymentIntentMissing,demoPaymentScenario} from './prototype-demo-payment-mode.mjs';
import {demoPurchasingAccountId,previewAccountId} from './prototype-demo-identity.mjs';
import {trialPurchaseDevice,trialPurchaseOptionsEnabled,wireTrialQuote} from './prototype-demo-trial.mjs';

export const previewPurchaseCashier = new URL('/__demo/purchase-cashier/', 'https://api.hdpayadmin.com');

const base = '/api/app/purchase-payment';
const sampleOrderNo = 'DEMO-ORDER-001';
const cents = value => Math.round(Number(value) * 100);
const money = value => (value / 100).toFixed(2);
// Seconds after the intent is created when the scenario moves on.
const ARRIVE_AFTER = 15000, DELIVER_AFTER = 25000;
// Like PurchasePaymentService: a quote lives 15 minutes, never past the deadline; a purchase that has no order gets 30
// minutes from its quote; funds may be confirmed for 3 (BSC) or 5 minutes after the deadline.
const QUOTE_TTL = 15 * 60000;
const paymentMethods = ['HDPAY_BANK', 'CREGIS_USDT_BSC', 'CREGIS_USDT_ERC20'];
const graceEnd = (method, deadline) => deadline + (method === 'CREGIS_USDT_BSC' ? 3 : 5) * 60000;

export function createPurchasePaymentPreviewFixture(state, locale) {
  const quotes = new Map(), intents = new Map();
  const refusedTrialCreates = new Map();
  const suspendedIntents = new Map();
  let sequence = 0;
  const paymentMode = () => demoPaymentScenario(state);
  // D1 switch closure leaves fee configuration intact (PurchasePaymentPolicyService.current).
  const configured = method => !(paymentMode() === 'bank-off' && method === 'HDPAY_BANK');
  const refused = (status, message) => ({status, message, data: null});
  const networkGate = method => {
    if (!paymentMethods.includes(method)) return refused(503, 'PURCHASE_PAYMENT_FEES_NOT_CONFIGURED');
    if (method === 'HDPAY_BANK') return null;
    const reason = demoDepositNetworkDisabledReason(state, method === 'CREGIS_USDT_ERC20' ? 'ERC20' : 'BEP20');
    if (reason === 'NOT_CONFIGURED') return refused(503, 'CREGIS_DIRECT_PAYMENT_UNAVAILABLE');
    return reason === 'NETWORK_SWITCH_OFF' ? refused(409, 'CREGIS_DIRECT_PAYMENT_PAUSED') : null;
  };
  const orderTopupEnabled = () => state.orderTopupState !== 'disabled';
  const orderUsdt = (kind, method) => kind === 'ORDER_PAY' && ['CREGIS_USDT_BSC', 'CREGIS_USDT_ERC20'].includes(method);
  const handles = path => path.startsWith(base);
  // The preview models one purchasing account, including its seeded payments.
  const ownsPreviewPayments = request => previewAccountId(state, request.headers?.() ?? {}) === demoPurchasingAccountId(state);
  function existingIntentRefusal(intent, payload) {
    if (intent.kind === 'TRIAL_CONVERT') {
      if (trialPurchaseOptionsEnabled(state)) {
        return {status:409,message:'PURCHASE_PAYMENT_EXISTING_INTENT_REQUIRED',data:trialPurchaseSnapshot(intent)};
      }
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
  const reject = (message,data) => { throw Object.assign(new Error(message), {status: 409,data}); };
  function purchaseSubject(kind, payload, products) {
    if (kind === 'ORDER_PAY') return {kind, orderNo: String(payload.orderNo ?? '').trim().toUpperCase()};
    if (kind === 'TRIAL_CONVERT') return {kind, identity: state.trialRow?.claimNo ?? null};
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
    if (payload.productNo !== trial.config.trialProductId)
      reject(trialPurchaseOptionsEnabled(state)?'TRIAL_EXTERNAL_PAYMENT_METHOD_UNSUPPORTED':'TRIAL_PRODUCT_NOT_ELIGIBLE');
    if ((trialPurchaseOptionsEnabled(state)||payload.quoteVersion)&&payload.quoteVersion !== trial.quote.quoteVersion)
      reject('TRIAL_QUOTE_CHANGED',trialPurchaseOptionsEnabled(state)?changedTrialQuote(trial,payload.productNo):null);
    // The claim's own SKU bypasses product purchase conditions. Release, stock and hardware quota still apply.
    requireDemoPurchase(state,demoProducts(state,url.origin),[{productNo:payload.productNo,quantity:1}],Date.now(),true,null,true);
    return trial;
  }
  function changedTrialQuote(trial,productNo) {
    return {claimNo:trial.claimNo,productNo,quoteVersion:trial.quote.quoteVersion,
      quote:{...wireTrialQuote(trial.quote),claimNo:trial.claimNo,productNo,sourceVersion:trial.version}};
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
    refusedTrialCreates.clear();
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
        if (intent.status !== 'AWAITING_PAYMENT' || intent.topupSample) continue;
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
    if (status === 'paid') {
      const now = Date.now();
      const slots = demoAssignablePurchaseSlots(new URL(intent.origin), locale(), state);
      const delivery = demoOrderDelivery(state, order, now, slots);
      Object.assign(order, delivery, {paymentStatus: 'PAID', orderStatus: 'COMPLETED', paymentMethod: intent.paymentMethod,
        paidTotalUsdt: intent.totalUsdt, paymentNo: intent.intentNo, paidAt: intent.paidAt, inventoryUsedAt: now, hardwareQuotaUsedAt});
    } else Object.assign(order, demoTimedOutOrder);
    return order;
  }
  // Recover the latest open intent for the same purchase after a replacement attempt.
  const openIntent = (subject, excluding) => [...intents.values()].findLast(row => row !== excluding && sameSubject(row, subject)
    && !row.receipt && row.status!=='DELIVERED' && row.refundStatus!=='REFUNDED'
    && (row.status!=='EXPIRED'||row.kind==='TRIAL_CONVERT'&&row.reconciliationStatus==='QUERY_UNKNOWN')
    && row.trialPurchaseOutcome!=='LATE_PAYMENT_REVIEW');
  function trialPurchaseSnapshot(intent) {
    const {productNo,name,imageUrl}=intent.trialDeviceSnapshot;
    const cutoff=Math.min(intent.deadline,intent.expirationTime?Date.parse(intent.expirationTime):Infinity);
    return {claimNo:intent.claimNo,kind:'EXTERNAL',intentNo:intent.intentNo,productNo,name,imageUrl,
      paymentMethod:intent.paymentMethod,expectedAmountUsdt:String(intent.payload.expectedAmountUsdt),
      deadlineAt:new Date(cutoff).toISOString(),status:intent.status};
  }
  function originalTrialPurchase() {
    sync();
    const intent=openIntent({kind:'TRIAL_CONVERT',identity:state.trialRow?.claimNo});
    return intent?trialPurchaseSnapshot(intent):undefined;
  }
  const currentTrialBalance=()=>state.trialBalancePurchase?.claimNo===state.trialRow?.claimNo ? state.trialBalancePurchase : undefined;
  const balanceConflict=()=>({status:409,message:'TRIAL_BALANCE_SUBMISSION_IN_PROGRESS',data:currentTrialBalance()});
  // An old failed attempt cannot cancel a successor or change an already settled order.
  function closeUnpaidOrder(intent) {
    if (!intent.orderNo || openIntent(intent, intent)) return null;
    const order = ordersOf(intent.origin).find(row => row.orderNo === intent.orderNo);
    if (order?.paymentStatus !== 'PENDING' || order.orderStatus !== 'PENDING_PAYMENT') return null;
    return settle(intent.orderNo, 'expired', intent);
  }
  function expire(intent, reason) {
    removeDemoPaymentQuotaHold(state, intent.quotaHold);
    return Object.assign(intent, {status: 'EXPIRED', reason,
      ...(intent.kind==='TRIAL_CONVERT'&&{trialPurchaseOutcome:'UNPAID_TERMINAL',reconciliationStatus:'PROVIDER_FAILED'})});
  }
  function lateArrival(intent, paidAt, confirmedAt = paidAt) {
    Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'PAYMENT_LATE_REVIEW', paidAt});
    if (intent.kind === 'TRIAL_CONVERT') {
      Object.assign(intent, {confirmedAt, reconciliationStatus: 'REVIEW'});
      delete intent.trialPurchaseOutcome;
      const cutoff = Math.min(intent.deadline, intent.expirationTime ? Date.parse(intent.expirationTime) : Infinity);
      if (paidAt >= cutoff && confirmedAt >= graceEnd(intent.paymentMethod, intent.deadline)) {
        intent.trialPurchaseOutcome = 'LATE_PAYMENT_REVIEW';
        removeDemoPaymentQuotaHold(state, intent.quotaHold);
      }
    }
    return intent;
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
      ...receipt, ...(intent.kind!=='TRIAL_CONVERT'&&{paymentNo:intent.intentNo}), amountUsdt: intent.businessAmountUsdt, paymentSubtotalUsdt: intent.subtotalUsdt,
      roundingAdjustmentUsdt: intent.roundingAdjustmentUsdt, walletDebitUsdt: '0.00', paymentMethod: intent.paymentMethod,
      paymentRail: intent.paymentMethod, paidTotalUsdt: intent.totalUsdt,
    }});
  }
  const waitingModes = ['waiting', 'urgent', 'late', 'remote-in-progress', 'intent-missing'];
  const noProviderSuccess = [...waitingModes, 'expired', 'mismatch'];
  // The intent advances by elapsed time according to the preview panel's 外部付款结果.
  function advance(intent, now) {
    if (intent.unpaidTerminalSample) return intent;
    // Ordinary provider outcomes do not advance the independently seeded B84 stories.
    const age = now - intent.createdAt, scenario = intent.topupSample||intent.trialSample ? 'waiting' : paymentMode();
    const bank = intent.paymentMethod === 'HDPAY_BANK';
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
      if (waitingModes.includes(scenario)) {
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
        if (order) Object.assign(order, {placedAt: deadline - paymentWindow, expiresAt: deadline,
          ...(order.promotionQuoteId && {payBy: new Date(deadline).toISOString()})});
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
      if (graceOver) return lateArrival(intent, intent.kind === 'TRIAL_CONVERT' ? intent.paidAt : now, now);
      if (intent.paidAt >= intent.deadline) return lateArrival(intent, intent.paidAt);
      intent.status = 'FUNDS_CONFIRMED';
    }
    if (scenario === 'funds-confirmed') return intent;
    if (networkGate(intent.paymentMethod)) return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'CREGIS_DIRECT_PAYMENT_PAUSED', reconciliationStatus: 'REVIEW'});
    if (age < DELIVER_AFTER) return intent;
    if (scenario === 'delivery-failed') return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'PURCHASE_PAYMENT_DELIVERY_BLOCKED'});
    if (intent.kind !== 'ORDER_PAY') return deliverPurchase(intent);
    return deliverOrderPayment(intent, now);
  }
  function deliverOrderPayment(intent, now) {
    const order = ordersOf(intent.origin).find(row => row.orderNo === intent.orderNo);
    // Delivery needs the order; funds for an order that cannot be found never become a success.
    if (!order) return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'PURCHASE_PAYMENT_DELIVERY_BLOCKED'});
    let hardwareQuotaUsedAt;
    try {
      hardwareQuotaUsedAt=requireDemoPurchase(state,demoProducts(state,intent.origin),
        order.lineItems.map(line=>({productNo:line.sku,quantity:line.quantity})),now,true,intent.quotaHold);
    } catch (error) {
      if(error.status!==409&&error.status!==404)throw error;
      return Object.assign(intent,{status:'MANUAL_REVIEW',reason:error.message});
    }
    const paidOrder = settle(intent.orderNo, 'paid', intent, hardwareQuotaUsedAt);
    removeDemoPaymentQuotaHold(state, intent.quotaHold);
    return Object.assign(intent, {status: 'DELIVERED', fulfilmentStatus: 'DELIVERED', receipt: {
      ...(paidOrder.promotionQuoteId ? paidOrder : {}),
      orderNo: intent.orderNo, paymentNo: intent.intentNo, paymentStatus: 'PAID', orderStatus: 'COMPLETED', ...demoPaidOrderDelivery(paidOrder),
      amountUsdt: intent.businessAmountUsdt, paymentSubtotalUsdt: intent.subtotalUsdt, walletDebitUsdt: '0.00', paymentMethod: intent.paymentMethod, paidTotalUsdt: intent.totalUsdt,
      walletBalanceAfterUsdt: null, idempotent: false, serverCanonical: true, source: 'server', sourceEnvironment: 'PRODUCTION', runId: ''}});
  }
  // Payment details follow the current network gate without changing the stored address (PurchasePaymentService.view).
  const view = intent => {
    const {createdAt, orderNo, deadline, origin, payload, identity, targetProductNo, sourceDeviceId, pricingAt, paidAt, confirmedAt, replacementQuote, quotaHold, topupSample, snapshotUnavailable, trialDeviceSnapshot, trialSample, unpaidTerminalSample, ...row} = intent, open = Date.now() < deadline;
    if (row.kind === 'TRIAL_CONVERT' && !trialPurchaseOptionsEnabled(state)) {
      delete row.claimNo;
      delete row.trialPurchaseOutcome;
    }
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
      return {...original, status: 'SUCCEEDED', code: 0, message:'success', receipt};
    }
    if (intent.status === 'EXPIRED' && (intent.kind!=='TRIAL_CONVERT'||intent.trialPurchaseOutcome==='UNPAID_TERMINAL'))
      return {...original, status: 'REJECTED', code:409, message: 'PURCHASE_PAYMENT_EXPIRED'};
    return {...original, status: intent.status === 'DELIVERED' ? 'INDETERMINATE' : 'PROCESSING',
      message: intent.reason ?? 'PURCHASE_PAYMENT_PROCESSING'};
  }
  // The preview server observes providers independently of order, intent and receipt reads.
  function observePayments(observedAt = Date.now()) {
    sync();
    for (const intent of intents.values()) advance(intent, observedAt);
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
  function handlePayment(url, request, ownsPayments, historicalSeed = false) {
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
    if (path === `${base}-policy` && method === 'GET') return {status: 200, message: 'OK', data: {version: 3,
      ...(orderTopupEnabled() ? {orderPayUsdtRoute: 'WALLET_TOPUP'} : {}),
      channels: paymentMethods.map(paymentMethod => ({paymentMethod, configured: configured(paymentMethod)}))}};
    if (path === `${base}-quotes` && method === 'POST') {
      if (!ownsPayments) return refused(404, 'PURCHASE_PAYMENT_QUOTE_NOT_FOUND');
      const body = request.postDataJSON(), {kind, payload} = body;
      if (kind === 'CAPACITY_REPLACE') return refused(409, 'CAPACITY_REPLACEMENT_PURCHASE_RETIRED');
      if (!Object.hasOwn(commandKinds, kind) || !payload) return refused(409, 'PURCHASE_PAYMENT_PRICING_CHANGED');
      if (kind==='TRIAL_CONVERT'&&currentTrialBalance()) return balanceConflict();
      const products = demoProducts(state, url.origin), subject = purchaseSubject(kind, payload, products);
      const existing = openIntent(subject);
      if (existing) return existingIntentRefusal(existing, payload);
      if (!historicalSeed && orderTopupEnabled() && orderUsdt(kind, body.paymentMethod)) return refused(409, 'ORDER_USDT_USE_TOPUP');
      const gate = networkGate(body.paymentMethod);
      if (gate) return gate;
      const order = kind === 'ORDER_PAY' ? ordersOf(url.origin).find(row => row.orderNo === subject.orderNo) : null;
      if (kind === 'ORDER_PAY' && !order) return refused(404, 'ORDER_NOT_FOUND');
      if (order && (order.paymentStatus !== 'PENDING' || order.orderStatus !== 'PENDING_PAYMENT')) return refused(409, 'ORDER_NOT_PAYABLE');
      const bank = body.paymentMethod === 'HDPAY_BANK', erc20 = body.paymentMethod === 'CREGIS_USDT_ERC20';
      const trial = kind === 'TRIAL_CONVERT' ? trialPricing(url, request, payload) : null;
      if (trial) {
        subject.identity = trial.claimNo;
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
      if (trial && subtotal > cents(payload.expectedAmountUsdt)) {
        if (!trialPurchaseOptionsEnabled(state)) return refused(409,'TRIAL_AMOUNT_MISMATCH');
        return {status:409,message:'TRIAL_AMOUNT_MISMATCH',data:changedTrialQuote(trial,payload.productNo)};
      }
      if (trial&&subtotal<=0) return refused(409,'ZERO_PAYMENT_REQUIRES_WALLET');
      if (!configured(body.paymentMethod)) return refused(503, 'PURCHASE_PAYMENT_FEES_NOT_CONFIGURED');
      const now = Date.now(), deadline = order ? demoOrderPaymentDeadline(order)
        : trial ? Math.min(now+paymentWindow,trial.graceEndsAtEpochMs) : now+paymentWindow;
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
        fxRateVndPerUsdt: bank ? '25000.000000' : null, amountVnd: bank ? String((subtotal + channel) * 250) : null,
        ...(trial&&{currency:bank?'VND':'USDT',channelFeeRatePct:'1.25',channelFeeFixed:'0.50',paymentFeesConfigured:true,
          trialOffsetBasis:trialPurchaseOptionsEnabled(state)?'ACCRUED_B90':'ACCRUED',...(bank&&{fxVersion:1})})};
      const trialDeviceSnapshot=trial?trialPurchaseDevice(quoteProducts[0],trial.config.trialProductName):undefined;
      quotes.set(quote.paymentQuoteId, {quote, subject, deadline, pricingAt: now, payload, replacementQuote, trialDeviceSnapshot});
      return {status: 200, message: 'OK', data: quote};
    }
    if (path === `${base}-intents` && method === 'POST') {
      if (!ownsPayments) return refused(404, 'PURCHASE_PAYMENT_QUOTE_NOT_FOUND');
      const key = request.headers()['idempotency-key'], quoteId = request.postDataJSON().paymentQuoteId, source = quotes.get(quoteId);
      if (!key) return refused(422, 'IDEMPOTENCY_KEY_REQUIRED');
      const refusal = source?.subject.kind==='TRIAL_CONVERT'&&refusedTrialCreates.get(key);
      if (refusal) return refusal.quoteId===quoteId?refusal.result:refused(409,'IDEMPOTENCY_KEY_CONFLICT');
      if (!source) return refused(404, 'PURCHASE_PAYMENT_QUOTE_NOT_FOUND');
      const {subject, deadline} = source, known = [...intents.values()].find(row => row.kind === subject.kind && row.commandKey === key);
      if (known) return known.paymentQuoteId === quoteId ? {status: 200, message: 'OK', data: view(known)} : refused(409, 'IDEMPOTENCY_KEY_CONFLICT');
      const suspended = [...suspendedIntents.values()].find(row => row.kind === subject.kind && row.commandKey === key);
      if (suspended && suspended.paymentQuoteId !== quoteId) return refused(409, 'IDEMPOTENCY_KEY_CONFLICT');
      if ([...intents.values()].some(row => row.paymentQuoteId === quoteId)) return refused(409, 'PURCHASE_PAYMENT_QUOTE_ALREADY_USED');
      const rememberTrialRefusal = result => {
        if (subject.kind!=='TRIAL_CONVERT'||result.message!=='TRIAL_QUOTE_CHANGED'||!trialPurchaseOptionsEnabled(state)) return result;
        refusedTrialCreates.set(key,{quoteId,result});
        if (!state.trialDropNextExternalRefusal) return result;
        delete state.trialDropNextExternalRefusal;
        return refused(503,'TRIAL_CREATE_RESPONSE_UNAVAILABLE');
      };
      const existing = openIntent(subject);
      if (existing) return existingIntentRefusal(existing, source.payload);
      if (subject.kind==='TRIAL_CONVERT'&&currentTrialBalance()) return balanceConflict();
      if (!historicalSeed && orderTopupEnabled() && orderUsdt(subject.kind, source.quote.paymentMethod)) return refused(409, 'ORDER_USDT_USE_TOPUP');
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
      let trial = null;
      try {
        if (subject.kind==='TRIAL_CONVERT') {
          if (state.trialDropNextExternalRefusal&&state.trialQuoteState==='precision') state.trialQuoteState='precision-repriced';
          trial=trialPricing(url,request,source.payload,source.pricingAt);
        }
      } catch (error) {
        if (error.message!=='TRIAL_QUOTE_CHANGED'||!error.data) throw error;
        return rememberTrialRefusal({status:409,message:error.message,data:error.data});
      }
      if (trial && trial.claimNo !== subject.identity) return refused(409, 'TRIAL_NOT_CONVERTIBLE');
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
        paymentUrl: source.quote.paymentMethod === 'HDPAY_BANK' ? new URL(intentNo, previewPurchaseCashier).href : null,
        address: source.quote.paymentMethod === 'HDPAY_BANK' ? null : '0x' + (source.quote.paymentMethod === 'CREGIS_USDT_ERC20' ? '7d3a' : '4b1f') + String(sequence).padStart(36, '0'),
        createdAt: Date.now(), ...subject, payload: source.payload, replacementQuote: source.replacementQuote, pricingAt: source.pricingAt, deadline, origin: url.origin,
        trialDeviceSnapshot:source.trialDeviceSnapshot,...(trial&&{claimNo:trial.claimNo,version:1,reconciliationStatus:'PENDING'})};
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
      if (intent) return readIntent(intent);
      const denial=url.searchParams.get('kind')==='TRIAL_CONVERT'&&refusedTrialCreates.get(url.searchParams.get('commandKey'));
      return denial?.result??readIntent(null);
    }
    const snapshot = path.match(/^\/api\/app\/purchase-payment-intents\/snapshots\/([^/]+)$/);
    if (snapshot && method === 'GET') {
      if (!ownsPayments) return refused(404, 'PURCHASE_PAYMENT_INTENT_NOT_FOUND');
      const intent = intents.get(decodeURIComponent(snapshot[1]));
      if (intent?.snapshotUnavailable && openOrderPayment(intent.orderNo) === intent && intent.status !== 'MANUAL_REVIEW')
        return refused(503, 'PURCHASE_PAYMENT_INTENT_READ_UNAVAILABLE');
      return readIntent(intent);
    }
    const one = path.match(/^\/api\/app\/purchase-payment-intents\/([^/]+)$/);
    if (one && method === 'GET') {
      if (!ownsPayments) return refused(404, 'PURCHASE_PAYMENT_INTENT_NOT_FOUND');
      return readIntent(intents.get(decodeURIComponent(one[1])));
    }
    return {status: 404, message: 'PURCHASE_PAYMENT_NOT_MODELED', data: null};
  }
  function setTrialExternalSample(origin, enabled, transition) {
    sync();
    const current=originalTrialPurchase();
    if (!enabled) {
      const intent=intents.get(current?.intentNo);
      if (intent?.trialSample) expire(intent,'PAYMENT_TIMEOUT');
      return {status:200};
    }
    if (transition) {
      const subject={kind:'TRIAL_CONVERT',identity:state.trialRow?.claimNo};
      const intent=[...intents.values()].findLast(row=>sameSubject(row,subject)&&!row.trialSample
        &&(['AWAITING_PAYMENT','EXPIRED'].includes(row.status)||row.reason==='PAYMENT_LATE_REVIEW'));
      if (!intent) return refused(409,'TRIAL_PREVIEW_START_PAYMENT_FIRST');
      const noPaymentFacts=transition==='external-expired'||transition==='external-unpaid-terminal';
      if (noPaymentFacts&&(intent.paidAt!=null||intent.confirmedAt!=null)) return refused(409,'TRIAL_PREVIEW_PAYMENT_ALREADY_OBSERVED');
      const now=Date.now(), deadline=now-graceEnd(intent.paymentMethod,0)-60000;
      const pricingAt=deadline-paymentWindow;
      Object.assign(intent,{deadline,expiresAt:new Date(deadline).toISOString(),deadlineAt:new Date(deadline).toISOString(),
        createdAt:pricingAt,pricingAt,pricingAsOf:new Date(pricingAt).toISOString(),
        confirmationGraceEndsAt:new Date(graceEnd(intent.paymentMethod,deadline)).toISOString()});
      delete intent.trialPurchaseOutcome;
      delete intent.unpaidTerminalSample;
      if (transition==='external-expired'&&trialPurchaseOptionsEnabled(state)) {
        Object.assign(intent,{status:'EXPIRED',reason:'PAYMENT_TIMEOUT',reconciliationStatus:'QUERY_UNKNOWN'});
      } else if (noPaymentFacts) {
        expire(intent,'PAYMENT_TIMEOUT');
        intent.unpaidTerminalSample=true;
      } else {
        // In the unmarked case the customer sent the funds on time, but the provider confirmed them after grace.
        lateArrival(intent,transition==='external-late'?now:deadline-1000,now);
      }
      return {status:200};
    }
    if (current) return {status:200};
    const trial=demoFixture(new URL('/api/trial/state',origin),locale(),state,{method:()=>'GET'});
    if (!trial.quote) return refused(409,'TRIAL_NOT_CONVERTIBLE');
    const quote=handlePayment(new URL(base+'-quotes',origin),{
      method:()=>'POST',postDataJSON:()=>({kind:'TRIAL_CONVERT',paymentMethod:'CREGIS_USDT_BSC',
        payload:{productNo:trial.config.trialProductId,expectedAmountUsdt:cents(trial.quote.amountUsdt)/100,quoteVersion:trial.quote.quoteVersion}}),
    },true);
    if (quote.status!==200) return quote;
    const result=handlePayment(new URL(base+'-intents',origin),{
      method:()=>'POST',headers:()=>({'idempotency-key':`trial-external-preview-${sequence}`}),
      postDataJSON:()=>({paymentQuoteId:quote.data.paymentQuoteId}),
    },true);
    if (result.status===200) intents.get(result.data.intentNo).trialSample=true;
    return result;
  }
  function seedHistoricalOrderPayment(origin, orderNo, paymentMethod) {
    if (openOrderPayment(orderNo)) return {status: 200};
    const request = (body, headers = {}) => ({method: () => 'POST', postDataJSON: () => body, headers: () => headers});
    // Import the fixture's historical direct-payment sample under its original quote and key.
    const quote = handlePayment(new URL(`${base}-quotes`, origin), request({kind: 'ORDER_PAY', paymentMethod, payload: {orderNo}}), true, true);
    if (quote.status !== 200) return quote;
    return handlePayment(new URL(`${base}-intents`, origin), request({paymentQuoteId: quote.data.paymentQuoteId},
      {'idempotency-key': `wallet-pay:${orderNo}:other-device`}), true, true);
  }
  const seedRemoteOrderPayment = origin => seedHistoricalOrderPayment(origin, sampleOrderNo, 'CREGIS_USDT_BSC');
  function seedOrderTopupOriginal(origin, orderNo, {paymentMethod, status, snapshotUnavailable}) {
    const result = seedHistoricalOrderPayment(origin, orderNo, paymentMethod);
    if (result.status !== 200) return result;
    const intent = intents.get(result.data.intentNo);
    intent.topupSample = true;
    intent.snapshotUnavailable = snapshotUnavailable;
    if (status === 'MANUAL_REVIEW') Object.assign(intent, {status, reason: 'PAYMENT_AMOUNT_MISMATCH'});
    if (status === 'FUNDS_CONFIRMED' || status === 'DELIVERED') {
      const now = Date.now();
      Object.assign(intent, {status: 'FUNDS_CONFIRMED', paidAt: now});
      if (status === 'DELIVERED') {
        deliverOrderPayment(intent, now);
        if (intent.status !== 'DELIVERED') {
          removeDemoPaymentQuotaHold(state, intent.quotaHold);
          intents.delete(intent.intentNo);
          quotes.delete(intent.paymentQuoteId);
          delete state.intentOrders[orderNo];
          return refused(409, intent.reason);
        }
      }
    }
    return { ...result, data: view(intent) };
  }
  function deliveredOrderPayment(order) {
    sync();
    const intent = intents.get(order.paymentNo);
    if (intent?.status !== 'DELIVERED' || intent.kind !== 'ORDER_PAY' || intent.orderNo !== order.orderNo) return null;
    return { amount: intent.totalUsdt, at: intent.paidAt };
  }
  // Compress the deadline and grace so the App can observe expiry before a separate late receipt.
  function expireOrderPayment(orderNo) {
    const intent = openOrderPayment(orderNo);
    if (intent?.status !== 'AWAITING_PAYMENT') return false;
    const now = Date.now(), deadline = now - graceEnd(intent.paymentMethod, 0) - 1000;
    const order = closeUnpaidOrder(intent);
    if (!order) return false;
    Object.assign(order, {placedAt: deadline - paymentWindow, expiresAt: deadline,
      ...(order.promotionQuoteId && {payBy: new Date(deadline).toISOString()})});
    Object.assign(intent, {createdAt: deadline - 60000, deadline, expiresAt: new Date(deadline).toISOString(),
      deadlineAt: new Date(deadline).toISOString(), confirmationGraceEndsAt: new Date(graceEnd(intent.paymentMethod, deadline)).toISOString()});
    expire(intent, 'PAYMENT_TIMEOUT');
    return true;
  }
  function observeLateOrderPayment(orderNo) {
    const open = openOrderPayment(orderNo);
    if (open && !expireOrderPayment(orderNo)) return false;
    const intent = [...intents.values()].findLast(row=>row.orderNo===orderNo&&row.status==='EXPIRED');
    const now = Date.now();
    if (!intent || now<graceEnd(intent.paymentMethod,intent.deadline)) return false;
    lateArrival(intent, now);
    return true;
  }
  // An explicit operator correction is separate from provider observation and
  // from fulfilment. A late receipt alone never changes the expired order.
  function confirmLateOrderPayment(orderNo) {
    sync();
    const intent = [...intents.values()].findLast(row=>row.orderNo===orderNo&&row.status==='MANUAL_REVIEW'&&row.reason==='PAYMENT_LATE_REVIEW');
    const order = state.createdOrders?.find(row=>row.orderNo===orderNo&&row.orderStatus==='EXPIRED'&&row.paymentStatus==='EXPIRED');
    if (!intent?.paidAt || !order) return false;
    Object.assign(order,{canonicalStatus:'paid',paymentStatus:'PAID',orderStatus:'PAID',activationStatus:'WAITING_PROVISIONING',
      paymentMethod:intent.paymentMethod,paymentNo:intent.intentNo,paidAt:intent.paidAt,paidTotalUsdt:intent.totalUsdt,closeReasonCode:null});
    return true;
  }
  const topupIntent = orderNo => {
    const intent = openOrderPayment(orderNo);
    return intent ? view(intent) : null;
  };
  function orderPaymentRecords(orderNo) {
    sync();
    return [
      ...[...quotes.values()].filter(record => record.subject.orderNo === orderNo),
      ...[...intents.values(), ...suspendedIntents.values()].filter(record => record.orderNo === orderNo),
    ];
  }
  return {handles, handle, paymentCommand, sync, observePayments, openOrderPayment, topupIntent, seedRemoteOrderPayment, selectPaymentMode, ownsPreviewPayments,
    originalTrialPurchase,setTrialExternalSample,
    seedOrderTopupOriginal, deliveredOrderPayment, orderPaymentRecords, expireOrderPayment, observeLateOrderPayment, confirmLateOrderPayment};
}
