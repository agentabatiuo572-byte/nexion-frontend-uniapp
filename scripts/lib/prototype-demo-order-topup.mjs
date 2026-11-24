// B84 preview facts. These routes only read the selected fixture account.
import { demoAccountOrders } from './prototype-demo-data.mjs';
import { demoPurchasingAccountId, previewAccountId } from './prototype-demo-identity.mjs';
import { demoWalletUsdt } from './prototype-demo-wallet.mjs';

const FEE = '0.123456', MIN = '50', MICRO = 1000000n;
const sampleOrder = 'DEMO-ORDER-001', sampleIntent = 'PPI-PREVIEW-7001';
const intentSampleStates = ['open-intent', 'open-intent-usdt', 'open-intent-readonly', 'snapshot-error'];
const micro = value => {
  const text = String(value), negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  const units = BigInt(whole) * MICRO + BigInt((fraction + '000000').slice(0, 6));
  return negative ? -units : units;
};
const decimal = units => {
  const negative = units < 0n, abs = negative ? -units : units;
  const fraction = (abs % MICRO).toString().padStart(6, '0').replace(/0+$/, '');
  return (negative ? '-' : '') + (abs / MICRO) + (fraction ? '.' + fraction : '');
};
const max = (a, b) => a > b ? a : b;
const address = network => '0x' + (network === 'ERC20' ? '2' : '1').repeat(40);
const ok = data => ({ status: 200, body: { code: 0, message: 'OK', data } });
const refuse = (status, message) => ({ status, body: { code: status, message, data: null } });
const snapshotPath = `/api/app/purchase-payment-intents/snapshots/${sampleIntent}`;

export function demoOrderTopupPayRefusal(state, orderNo) {
  const scenario = state.orderTopupState;
  if (scenario === 'deadline' || scenario === 'expired') return 'ORDER_PAYMENT_EXPIRED';
  if (['closed', 'paid', 'paid-unverified'].includes(scenario)) return 'ORDER_NOT_PAYABLE';
  if (scenario === 'review') return 'HDPAY_COMMERCE_PAYMENT_REVIEW_REQUIRED';
  if (scenario === 'finance-review' || orderNo === sampleOrder && intentSampleStates.includes(scenario)) return 'ORDER_EXTERNAL_PAYMENT_IN_PROGRESS';
  return null;
}

function deposit(network, gross, credited, status, at) {
  const marker = network === 'ERC20' ? '2' : '1';
  return { depositId: 'CR-' + at + marker, network, txHash: '0x' + marker.repeat(64), address: address(network),
    grossAmountUsdt: Number(gross), grossAmountUsdtExact: gross, creditedUsdt: Number(credited), creditedUsdtExact: credited,
    confirmations: 15, requiredConfirmations: 15, status, createdAt: at, creditedAt: status === 'CREDITED' ? at : null };
}

// The original payment behind the open-intent samples: a bank card one, or a historical ERC20 USDT one.
function sampleIntentSnapshot(order, allowed, usdt) {
  const deadline = order.expiresAt;
  const timing = new Date(deadline).toISOString();
  const subtotalUsdt = Number(order.amountUsdt).toFixed(2);
  return { intentNo: sampleIntent, commandKey: `wallet-pay:${order.orderNo}:other-device`, paymentQuoteId: 'PPQ-PREVIEW-7001',
    kind: 'ORDER_PAY', paymentMethod: usdt ? 'CREGIS_USDT_ERC20' : 'HDPAY_BANK', network: usdt ? 'ERC20' : 'VND_BANK', status: 'AWAITING_PAYMENT', subtotalUsdt,
    channelFeeUsdt: '0.00', networkConfirmFeeUsdt: '0.00', totalUsdt: subtotalUsdt,
    amountVnd: usdt ? null : String(Math.round(Number(subtotalUsdt) * 25000)), fxRateVndPerUsdt: usdt ? null : '25000.000000', feePolicyVersion: 3,
    expiresAt: timing, deadlineAt: timing, confirmationGraceEndsAt: new Date(deadline + 5 * 60000).toISOString(),
    paymentAllowed: allowed, paymentUrl: allowed && !usdt ? `https://api.hdpayadmin.com/__demo/purchase-cashier/${sampleIntent}` : null,
    address: usdt ? address('ERC20') : null, reason: null, receipt: null };
}

export function demoOrderTopupResponse(url, state, locale, now, headers, findIntent) {
  const scenario = state.orderTopupState ?? 'off';
  const path = url.pathname;
  const owner = previewAccountId(state, headers);
  const owns = owner === demoPurchasingAccountId(state);
  const network = url.searchParams.get('network');
  const networks = ['BEP20', 'ERC20'];
  if (path === '/api/deposits/policy') {
    if (scenario === 'policy-error') return refuse(503, 'CREGIS_DEPOSIT_POLICY_UNAVAILABLE');
    if (scenario === 'erc20-only') return ok({ networks: networks.map(net => ({ network: net, enabled: net === 'ERC20',
      disabledReason: net === 'ERC20' ? null : 'NETWORK_SWITCH_OFF', confirmations: 15,
      feeUsdt: Number(FEE), feeUsdtExact: FEE, minDepositUsdt: Number(MIN), minDepositUsdtExact: MIN })) });
  }
  if (path === '/api/deposits/address' && networks.includes(network) && owns) {
    if (scenario === 'address-error') return refuse(503, 'CREGIS_ADDRESS_UNAVAILABLE');
    if (scenario === 'preparing') return ok({ enabled: false, creditEnabled: false, network, reason: 'CREGIS_ADDRESS_PREPARING' });
    if (scenario === 'paused') return ok({ enabled: true, creditEnabled: false, network, address: address(network), reason: 'CREGIS_DEPOSIT_PAUSED',
      confirmations: 15, feeUsdt: Number(FEE), feeUsdtExact: FEE, minDepositUsdt: Number(MIN), minDepositUsdtExact: MIN });
    if (scenario === 'erc20-only' && network === 'BEP20')
      return ok({ enabled: false, creditEnabled: false, network, reason: 'CREGIS_DEPOSIT_PAUSED' });
  }
  if (path === '/api/deposits' && owns && ['partial', 'below-min'].includes(scenario)) {
    const at = state.orderTopupTransferAt ?? now;
    return ok(networks.map(net => scenario === 'partial' ? deposit(net, '250.123456', '250', 'CREDITED', at)
      : deposit(net, '20', '0', 'DUST_HOLD', at)));
  }
  const match = path.match(/^\/api\/app\/orders\/([^/]+)\/usdt-topup$/);
  const sampleSnapshot = path === snapshotPath && intentSampleStates.includes(scenario);
  if (!match && !sampleSnapshot) return undefined;
  if (match && !networks.includes(network)) return refuse(400, 'ORDER_TOPUP_NETWORK_INVALID');
  if (match && scenario === 'disabled') return refuse(409, 'ORDER_USDT_TOPUP_DISABLED');
  if (!owner) return refuse(401, 'LOGIN_REQUIRED');
  const orderNo = match ? decodeURIComponent(match[1]) : sampleOrder;
  const order = owns && demoAccountOrders(url, locale, state, now).find(row => row.orderNo === orderNo);
  if (!order || scenario === 'missing') return refuse(404, sampleSnapshot ? 'PURCHASE_PAYMENT_INTENT_NOT_FOUND' : 'ORDER_NOT_FOUND');
  if (sampleSnapshot) return scenario === 'snapshot-error' ? refuse(503, 'PURCHASE_PAYMENT_INTENT_READ_UNAVAILABLE')
    : ok(sampleIntentSnapshot(order, ['open-intent', 'open-intent-usdt'].includes(scenario) && now < order.expiresAt, scenario === 'open-intent-usdt'));
  if (scenario === 'order-error' || state.dataState === 'error') return refuse(503, 'ORDER_TOPUP_READ_FAILED');

  const actualPaid = order.paidAt != null || ['PAID', 'REFUNDED', 'CHARGEBACK'].includes(order.paymentStatus);
  const actualPending = !actualPaid && order.canonicalStatus === 'placed';
  const paid = actualPaid || actualPending && ['paid', 'paid-unverified'].includes(scenario);
  const pending = actualPending && !paid && !['expired', 'closed'].includes(scenario);
  const deadline = !pending ? null : scenario === 'deadline' ? now - 1000
    : Math.min(order.expiresAt, order.payBy ? Date.parse(order.payBy) : Number.POSITIVE_INFINITY);
  const intent = pending ? findIntent?.(orderNo) : null;
  const intentSample = pending && orderNo === sampleOrder && intentSampleStates.includes(scenario);
  const openIntent = intent && intent.status !== 'MANUAL_REVIEW'
    ? { intentNo: intent.intentNo, paymentMethod: intent.paymentMethod, paymentAllowed: intent.paymentAllowed }
    : intentSample ? { intentNo: sampleIntent, paymentMethod: scenario === 'open-intent-usdt' ? 'CREGIS_USDT_ERC20' : 'HDPAY_BANK',
      paymentAllowed: ['open-intent', 'open-intent-usdt'].includes(scenario) && now < deadline } : null;
  const reviewReason = pending && !openIntent ? intent?.status === 'MANUAL_REVIEW' || scenario === 'finance-review'
    ? 'FINANCE_REVIEW' : scenario === 'review' ? 'BANK_SESSION' : null : null;
  const blocker = openIntent ? 'OPEN_INTENT' : reviewReason ? 'NEEDS_REVIEW' : 'NONE';
  const payable = pending && now < deadline && blocker === 'NONE';
  const due = micro(order.amountUsdt);
  const balance = micro(scenario === 'min-floor' ? decimal(due - micro('10')) : demoWalletUsdt(state));
  const shortfall = payable && due > 0n ? max(0n, due - balance) : 0n;
  const suggested = shortfall === 0n ? 0n : max(micro(MIN), shortfall + micro(FEE));
  const previewStatus = { paid: 'paid', 'paid-unverified': 'paid', expired: 'expired', closed: 'cancelled' }[scenario];
  return ok({
    orderNo, network, state: paid ? 'PAID' : pending ? 'PENDING' : 'CLOSED',
    canonicalStatus: actualPending && previewStatus ? previewStatus : order.canonicalStatus,
    payable, deadlineAt: deadline === null ? null : new Date(deadline).toISOString(),
    amountDueUsdt: decimal(due), walletAvailableUsdt: decimal(balance), shortfallUsdt: decimal(shortfall),
    minDepositUsdt: MIN, depositFeeUsdt: FEE, suggestedTransferUsdt: decimal(suggested),
    blocker, openIntent, reviewReason,
    paidAt: actualPaid ? order.paidAt == null ? null : new Date(order.paidAt).toISOString()
      : paid && scenario !== 'paid-unverified' ? new Date(now).toISOString() : null,
    paidAmountUsdt: actualPaid ? order.paidTotalUsdt ?? null : paid && scenario !== 'paid-unverified' ? decimal(due) : null,
  });
}
