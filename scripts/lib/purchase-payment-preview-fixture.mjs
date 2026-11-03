// Local preview only: external purchase payments (bank page / USDT address) for the
// design walkthrough. Never imported by src. The bank page URL points at the real
// provider host (the App only frames trusted hosts), so that frame shows the provider's
// reply for an unknown order; no payment is created anywhere.
import {demoAccountOrders,demoFixture,demoOrderFitsCapacity} from './prototype-demo-data.mjs';

const base = '/api/app/purchase-payment';
const cents = value => Math.round(Number(value) * 100);
const money = value => (value / 100).toFixed(2);
// Seconds after the intent is created when the scenario moves on.
const ARRIVE_AFTER = 15000, DELIVER_AFTER = 25000;

export function createPurchasePaymentPreviewFixture(state, locale) {
  const quotes = new Map(), intents = new Map();
  let sequence = 0;
  const handles = path => path.startsWith(base);
  const commandKinds = {ORDER_PAY:'order-pay',TRIAL_CONVERT:'trial-convert',TRADE_IN:'trade-in',CAPACITY_REPLACE:'capacity-replace',CAPACITY_KEEP:'capacity-keep'};
  // The account's one order list.
  const ordersOf = origin => demoAccountOrders(new URL(origin), locale(), state);
  // A reset or scenario change starts a fresh account; the old scenario's quotes and intents go with it.
  let epoch = state.scenarioEpoch;
  const sync = () => { if (epoch !== state.scenarioEpoch) { epoch = state.scenarioEpoch; quotes.clear(); intents.clear(); } };
  function settle(orderNo, status, intent) {
    if (!orderNo) return;
    state.orderStatuses ||= {};
    state.orderStatuses[orderNo] = status;
    const order = state.createdOrders?.find(row => row.orderNo === orderNo);
    if (!order) return;
    if (status === 'activated') Object.assign(order, {canonicalStatus: 'activated', paymentStatus: 'PAID', orderStatus: 'COMPLETED', activationStatus: 'ACTIVATED', paymentMethod: intent.paymentMethod, paidTotalUsdt: intent.totalUsdt, paymentNo: intent.intentNo, paidAt: Date.now(), activatedAt: Date.now()});
    else Object.assign(order, {canonicalStatus: 'expired', paymentStatus: 'EXPIRED', orderStatus: 'EXPIRED', activationStatus: 'WAITING_PAYMENT', closeReasonCode: 'PAYMENT_TIMEOUT'});
  }
  // The intent advances by elapsed time according to the preview panel's 外部付款结果.
  function advance(intent) {
    const age = Date.now() - intent.createdAt, scenario = state.paymentState ?? 'delivered', bank = intent.paymentMethod === 'HDPAY_BANK';
    if (!['AWAITING_PAYMENT', 'FUNDS_CONFIRMED'].includes(intent.status) || ['waiting', 'urgent', 'read-error'].includes(scenario)) return intent;
    if (age < ARRIVE_AFTER) return intent;
    if (scenario === 'expired') { settle(intent.orderNo, 'expired', intent); return Object.assign(intent, {status: 'EXPIRED', reason: 'PAYMENT_TIMEOUT'}); }
    if (scenario === 'bank-failed' && bank) return Object.assign(intent, {status: 'EXPIRED', reason: 'PAYMENT_FAILED'});
    if (scenario === 'mismatch') return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'PAYMENT_AMOUNT_MISMATCH'});
    if (age < DELIVER_AFTER) return Object.assign(intent, {status: 'FUNDS_CONFIRMED'});
    if (scenario === 'delivery-failed') return Object.assign(intent, {status: 'MANUAL_REVIEW', reason: 'PURCHASE_PAYMENT_DELIVERY_BLOCKED'});
    // Non-order fixtures cover open, unknown and rejected commands. Their
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
  const view = intent => { const {createdAt, orderNo, origin, ...row} = advance(intent); return row; };
  function paymentCommand(kind, key) {
    sync();
    const intent = [...intents.values()].find(row => commandKinds[row.kind] === kind && row.commandKey === key);
    if (!intent) return null;
    if (state.paymentState === 'read-error') throw Object.assign(new Error('PAYMENT_COMMAND_READ_UNAVAILABLE'), {status:503});
    advance(intent);
    return {kind,commandKey:key,status:intent.status==='DELIVERED'?'SUCCEEDED':intent.status==='EXPIRED'?'REJECTED':'PROCESSING',canResumeSameKey:false,...(intent.receipt?{receipt:intent.receipt}:{})};
  }
  function handle(url, request) {
    sync();
    const path = url.pathname, method = request.method();
    if (path === `${base}-policy` && method === 'GET') return {status: 200, message: 'OK', data: {version: 3, channels: [
      {paymentMethod: 'HDPAY_BANK', configured: state.paymentState !== 'bank-off'}, {paymentMethod: 'CREGIS_USDT_BSC', configured: true},
      {paymentMethod: 'CREGIS_USDT_ERC20', configured: state.paymentState !== 'erc20-off'}]}};
    if (path === `${base}-quotes` && method === 'POST') {
      const body = request.postDataJSON(), order = ordersOf(url.origin).find(row => row.orderNo === body.payload?.orderNo);
      if (!commandKinds[body.kind] || (body.kind === 'ORDER_PAY' ? !order : body.kind === 'TRIAL_CONVERT' ? !body.payload?.productNo : !body.payload?.targetProductNo)) return {status: 409, message: 'PURCHASE_PAYMENT_PRICING_CHANGED', data: null};
      if (body.paymentMethod === 'CREGIS_USDT_ERC20' && state.paymentState === 'erc20-off') return {status: 503, message: 'PURCHASE_PAYMENT_FEES_NOT_CONFIGURED', data: null};
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
      const adjustment = Number(BigInt(subtotal) * 10000n - micros) / 1000000;
      const channel = Math.round(subtotal * 0.0125) + 50, network = bank ? 0 : erc20 ? 380 : 25;
      if (trial) state.lastTrialPaymentQuote = {...body,amountUsdt:amount,subtotalUsdt:money(subtotal)};
      const quote = {paymentQuoteId: `PPQ-PREVIEW-${++sequence}`, kind: body.kind, paymentMethod: body.paymentMethod, network: bank ? 'VND_BANK' : erc20 ? 'ERC20' : 'BSC',
        businessAmountUsdt: Number(amount).toFixed(6), roundingAdjustmentUsdt: adjustment.toFixed(6), subtotalUsdt: money(subtotal), channelFeeUsdt: money(channel),
        networkConfirmFeeUsdt: money(network), totalUsdt: money(subtotal + channel + network), feePolicyVersion: 3, expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
        fxRateVndPerUsdt: bank ? '25000.000000' : null, amountVnd: bank ? String((subtotal + channel) * 250) : null};
      quotes.set(quote.paymentQuoteId, {quote, orderNo: order?.orderNo, expiresAt: order?.expiresAt});
      return {status: 200, message: 'OK', data: quote};
    }
    if (path === `${base}-intents` && method === 'POST') {
      const key = request.headers()['idempotency-key'], source = quotes.get(request.postDataJSON().paymentQuoteId);
      if (!source || !key) return {status: 409, message: 'PURCHASE_PAYMENT_QUOTE_EXPIRED', data: null};
      let intent = [...intents.values()].find(row => row.commandKey === key && row.paymentQuoteId === source.quote.paymentQuoteId);
      if (!intent) {
        const intentNo = `PPI-PREVIEW-${++sequence}`, urgent = state.paymentState === 'urgent';
        // The intent closes with the order (design: one 30-minute deadline).
        const expiresAt = urgent ? Date.now() + 4 * 60000 + 50000 : Number(source.expiresAt) || Date.now() + 15 * 60000;
        intent = {...source.quote, intentNo, commandKey: key, status: 'AWAITING_PAYMENT', reason: '', receipt: null, expiresAt: new Date(expiresAt).toISOString(),
          paymentUrl: source.quote.paymentMethod === 'HDPAY_BANK' ? `https://api.hdpayadmin.com/pay/${intentNo}` : null,
          address: source.quote.paymentMethod === 'HDPAY_BANK' ? null : '0x' + (source.quote.paymentMethod === 'CREGIS_USDT_ERC20' ? '7d3a' : '4b1f') + String(sequence).padStart(36, '0'),
          createdAt: Date.now(), orderNo: source.orderNo, origin: url.origin};
        intents.set(intentNo, intent);
      }
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
  return {handles, handle, paymentCommand};
}
