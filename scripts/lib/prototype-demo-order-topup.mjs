// B84 scenarios seed independent order stories against the preview account's shared wallet.
import { demoAccountOrders, demoProducts, demoTimedOutOrder, paymentWindow } from './prototype-demo-data.mjs';
import { demoPurchasingAccountId, previewAccountId } from './prototype-demo-identity.mjs';
import { demoChainDepositAddress, demoChainDepositFee as FEE, demoChainDepositMinimum as MIN, demoWalletUsdt,
  postDemoWalletEntries, recordDemoChainDeposit } from './prototype-demo-wallet.mjs';

const MICRO = 1000000n;
const networks = ['BEP20', 'ERC20'];
const pendingOrder = { canonicalStatus: 'placed', paymentStatus: 'PENDING', orderStatus: 'PENDING_PAYMENT',
  activationStatus: 'WAITING_PAYMENT' };
const paidOrder = { canonicalStatus: 'paid', paymentStatus: 'PAID', orderStatus: 'PAID',
  activationStatus: 'WAITING_PROVISIONING' };
const terminalOrders = {
  closed: { canonicalStatus: 'cancelled', paymentStatus: 'CANCELLED', orderStatus: 'CANCELLED',
    closeReasonCode: 'USER_CANCELLED' },
  expired: demoTimedOutOrder,
  'paid-unverified': paidOrder,
  'provisioning-failed': { ...paidOrder, canonicalStatus: 'provisioning_failed', orderStatus: 'PROVISIONING_FAILED',
    activationStatus: 'PROVISIONING_FAILED', closeReasonCode: 'DELIVERY_UNAVAILABLE' },
  chargeback: { canonicalStatus: 'chargeback', paymentStatus: 'CHARGEBACK', orderStatus: 'CHARGEBACK',
    activationStatus: 'DEACTIVATED', closeReasonCode: 'PAYMENT_DISPUTED', activatedAt: null },
  refunded: { canonicalStatus: 'refunded', paymentStatus: 'REFUNDED', orderStatus: 'REFUNDED',
    activationStatus: 'REFUNDED', refundChannel: 'WALLET', refundReasonCode: 'DELIVERY_UNAVAILABLE' },
};
const originals = {
  'open-intent': { paymentMethod: 'HDPAY_BANK', status: 'AWAITING_PAYMENT' },
  'open-intent-usdt': { paymentMethod: 'CREGIS_USDT_ERC20', status: 'AWAITING_PAYMENT' },
  'open-intent-readonly': { paymentMethod: 'HDPAY_BANK', status: 'FUNDS_CONFIRMED' },
  'snapshot-error': { paymentMethod: 'HDPAY_BANK', status: 'AWAITING_PAYMENT', snapshotUnavailable: true },
  'finance-review': { paymentMethod: 'HDPAY_BANK', status: 'MANUAL_REVIEW' },
  paid: { paymentMethod: 'HDPAY_BANK', status: 'DELIVERED' },
  chargeback: { paymentMethod: 'HDPAY_BANK', status: 'DELIVERED' },
};
const waitingScenes = new Set(['waiting', 'partial', 'below-min', 'preparing', 'paused', 'address-error', 'order-error']);
const orderScenes = new Set([...waitingScenes, ...Object.keys(originals), ...Object.keys(terminalOrders),
  'min-floor', 'covered', 'debt', 'zero-voucher', 'review', 'deadline', 'missing']);

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
const ok = data => ({ status: 200, body: { code: 0, message: 'OK', data } });
const refuse = (status, message) => ({ status, body: { code: status, message, data: null } });

function postWalletMovement(state, bizNo, bizType, category, direction, amount, at) {
  return postDemoWalletEntries(state, { bizNo, bizType, asset: 'USDT', direction, category, at,
    amount: Number(decimal(amount)), amountExact: decimal(amount) });
}

function creditDeposit(state, net, createdAt) {
  return recordDemoChainDeposit(state, { network: 'BEP20', grossAmountUsdt: decimal(net + micro(FEE)),
    creditedUsdt: decimal(net), createdAt });
}

function fundWallet(state, target, orderNo, now) {
  const gap = target - micro(demoWalletUsdt(state));
  if (gap > 0n) creditDeposit(state, max(gap, micro(MIN) - micro(FEE)), now);
  const surplus = micro(demoWalletUsdt(state)) - target;
  if (surplus > 0n) {
    postWalletMovement(state, `DEMO-ADJ-${orderNo}-${now}`, 'ADJUSTMENT', 'other', 'OUT', surplus, now);
  }
}

function applyWalletStory(state, scene, order, sample, now) {
  const balance = micro(demoWalletUsdt(state)), due = micro(order.amountUsdt);
  if (scene === 'debt' && balance !== micro('-12.123456')) {
    fundWallet(state, micro('160'), order.orderNo, now);
    const rewardNo = `DEMO-REWARD-${order.orderNo}-${now}`;
    const reward = micro('172.123456');
    postWalletMovement(state, rewardNo, 'VRANK_REWARD_PAYOUT', 'bonus', 'IN', reward, now);
    postWalletMovement(state, `DEMO-ADJ-${rewardNo}`, 'ADJUSTMENT', 'other', 'OUT', reward, now);
    postDemoWalletEntries(state, { bizNo: rewardNo + ':REVERSAL', bizType: 'VRANK_REWARD_PAYOUT_REVERSED',
      asset: 'USDT', category: 'clawback', direction: 'OUT', amount: Number(decimal(reward)), amountExact: decimal(reward),
      presentationCode: 'rewardClawback', publicReference: null, at: now });
  }
  if (scene === 'min-floor') fundWallet(state, due - micro('10'), order.orderNo, now);
  if (scene === 'covered' && balance < due) creditDeposit(state, max(due - balance, micro(MIN) - micro(FEE)), now);
  if (scene === 'partial' && sample.depositId && balance === micro('370.5')) return;
  if (scene === 'partial') {
    fundWallet(state, micro('120.5'), order.orderNo, now);
    sample.depositId = creditDeposit(state, micro('250'), now).depositId;
  } else if (waitingScenes.has(scene) && (balance > due - micro(MIN) || balance < 0n)) {
    fundWallet(state, micro('120.5'), order.orderNo, now);
  }
  if (scene === 'below-min' && !sample.depositId) {
    sample.depositId = recordDemoChainDeposit(state,
      { network: 'BEP20', grossAmountUsdt: '20', creditedUsdt: '0', createdAt: now }).depositId;
  }
}

function newOrder(url, state, scene, orderNo, now) {
  const products = demoProducts(state, url.origin);
  const product = products.find(row => row.id === (scene === 'zero-voucher' ? 'cloud-share' : 'stellarbox-s1'));
  const subtotal = product.price, voucher = scene === 'zero-voucher';
  const deadline = scene === 'deadline' ? now - 1000 : scene === 'expired' ? now - 61000 : now + paymentWindow - 1;
  return { ...pendingOrder, orderNo, orderType: 'SINGLE', itemCount: 1, productId: products.indexOf(product) + 1,
    productNo: product.id, productName: product.name, quantity: 1, computePoints: product.computePoints,
    unitPriceUsdt: subtotal, subtotalUsdt: subtotal, discountUsdt: voucher ? subtotal : 0, amountUsdt: voucher ? 0 : subtotal,
    lineItems: [{ sku: product.id, name: product.name, quantity: 1, unitPriceUsdt: subtotal, lineAmountUsdt: subtotal }],
    ...(voucher && { voucherId: 'V-B84-ZERO', voucherRedemption: { voucherId: 'V-B84-ZERO', grantId: orderNo, status: 'REDEEMED', discountUsdt: subtotal } }),
    ...(scene === 'review' && { retiredBankPaymentSession: true }),
    dataCenter: 'Singapore', placedAt: deadline - paymentWindow, expiresAt: deadline, paymentMethod: 'PENDING',
    paidAt: null, paidTotalUsdt: null, activatedAt: null };
}

// Retry the story with a new sample only if an ordinary action or time finished the old one.
// Keep every posted wallet movement and the user's receipts for the previous sample.
export function applyDemoOrderTopupScene(url, state, now, checkoutFlow, scene) {
  if (!orderScenes.has(scene)) return null;
  const defaultOrderNo = `DEMO-B84-${scene.toUpperCase()}`;
  const network = scene === 'preparing' ? ['ERC20', 'BEP20'].find(net => !demoChainDepositAddress(state, net))
    : scene === 'open-intent-usdt' ? 'ERC20' : 'BEP20';
  if (!network) return refuse(409, 'PREVIEW_NO_UNASSIGNED_DEPOSIT_NETWORK');
  if (scene === 'missing') return ok({ orderNo: defaultOrderNo, network });

  const samples = state.orderTopupSamples ??= {};
  const previous = samples[scene];
  let order = state.createdOrders?.find(row => row.orderNo === previous?.orderNo);
  const original = originals[scene];
  const reusable = order && (terminalOrders[scene] || scene === 'paid' || scene === 'deadline'
    || (order.canonicalStatus === 'placed' && order.expiresAt > now
      && (!original || checkoutFlow?.topupIntent(order.orderNo)?.status === original.status)));
  if (!reusable) {
    const generation = previous ? previous.generation + 1 : 1;
    const orderNo = generation === 1 ? defaultOrderNo : `${defaultOrderNo}-${generation}`;
    order = newOrder(url, state, scene, orderNo, now);
    (state.createdOrders ??= []).unshift(order);
    if (original) {
      const result = checkoutFlow?.seedOrderTopupOriginal(url.origin, orderNo, original) ?? refuse(503, 'PREVIEW_CHECKOUT_REQUIRED');
      if (result.status !== 200) {
        state.createdOrders.shift();
        return result;
      }
    }
    if (terminalOrders[scene]) Object.assign(order, terminalOrders[scene], { expiresAt: scene === 'expired' ? order.expiresAt : null });
    if (scene === 'paid-unverified') order.paidAt = now;
    if (scene === 'provisioning-failed' || scene === 'refunded') {
      // A historical wallet settlement has an actual debit. The refund is a separate credit.
      if (micro(demoWalletUsdt(state)) < micro(order.amountUsdt))
        creditDeposit(state, max(micro(order.amountUsdt) - micro(demoWalletUsdt(state)), micro(MIN) - micro(FEE)), now);
      const balance = postWalletMovement(state, orderNo, 'ORDER_PURCHASE', 'purchase', 'OUT', micro(order.amountUsdt), now);
      Object.assign(order, { paymentMethod: 'UVEL_WALLET', paymentNo: `DEMO-PAY-${orderNo}`, paidAt: now,
        paidTotalUsdt: order.amountUsdt.toFixed(2) });
      checkoutFlow?.seedOrderTopupWalletReceipt(order, balance.USDT);
      if (scene === 'refunded') {
        const refundBillNo = `E4-REFUND-${orderNo}`;
        postWalletMovement(state, refundBillNo, 'ORDER_REFUND', 'refund', 'IN', micro(order.amountUsdt), now);
        Object.assign(order, { refundBillNo, refundedAt: now, refundAmountUsdt: order.amountUsdt });
      }
    }
    samples[scene] = { orderNo, generation };
  }
  if (scene === 'deadline') Object.assign(order, pendingOrder, { placedAt: now - 1000 - paymentWindow,
    expiresAt: now - 1000, closeReasonCode: null });
  applyWalletStory(state, scene, order, samples[scene], now);
  return ok({ orderNo: order.orderNo, network, name: order.productName });
}

function walletOrderPayment(state, order) {
  if (order.paymentMethod === 'UVEL_WALLET') {
    const debit = state.walletMovements?.find(row => row.bizNo === order.orderNo && row.bizType === 'ORDER_PURCHASE'
      && row.asset === 'USDT' && row.direction === 'OUT' && row.status === 'SUCCESS');
    return debit ? { amount: debit.amountExact ?? String(debit.amount), at: debit.at } : null;
  }
  if (order.paymentMethod === 'VOUCHER' && order.paymentNo) {
    const payment = Object.values(state.commands ?? {}).find(row => row.operation === 'payOrder' && row.status === 'SUCCEEDED'
      && row.order?.orderNo === order.orderNo && row.response?.paymentNo === order.paymentNo);
    if (payment) return { amount: '0', at: payment.order.paidAt };
  }
  return null;
}

export function demoOrderTopupResponse(url, state, locale, now, headers, checkoutFlow) {
  const scenario = state.orderTopupState ?? 'off';
  const path = url.pathname;
  const owner = previewAccountId(state, headers);
  const owns = owner === demoPurchasingAccountId(state);
  const network = url.searchParams.get('network');
  if (path === '/api/deposits/policy') {
    if (scenario === 'policy-error') return refuse(503, 'CREGIS_DEPOSIT_POLICY_UNAVAILABLE');
    if (scenario === 'erc20-only') return ok({ networks: networks.map(net => ({ network: net, enabled: net === 'ERC20',
      disabledReason: net === 'ERC20' ? null : 'NETWORK_SWITCH_OFF', confirmations: 15,
      feeUsdt: Number(FEE), feeUsdtExact: FEE, minDepositUsdt: Number(MIN), minDepositUsdtExact: MIN })) });
  }
  if (path === '/api/deposits/address' && networks.includes(network) && owns) {
    if (scenario === 'address-error' && network === state.orderTopupPreview?.network) return refuse(503, 'CREGIS_ADDRESS_UNAVAILABLE');
    if (scenario === 'preparing' && network === state.orderTopupPreview?.network && !demoChainDepositAddress(state, network))
      return ok({ enabled: false, creditEnabled: false, network, reason: 'CREGIS_ADDRESS_PREPARING' });
    if (scenario === 'paused' && network === state.orderTopupPreview?.network) {
      const address = demoChainDepositAddress(state, network);
      return ok({ enabled: !!address, creditEnabled: false, network, ...(address && { address }), reason: 'CREGIS_DEPOSIT_PAUSED',
        confirmations: 15, feeUsdt: Number(FEE), feeUsdtExact: FEE, minDepositUsdt: Number(MIN), minDepositUsdtExact: MIN });
    }
    if (scenario === 'erc20-only' && network === 'BEP20')
      return ok({ enabled: false, creditEnabled: false, network, reason: 'CREGIS_DEPOSIT_PAUSED' });
  }
  const match = path.match(/^\/api\/app\/orders\/([^/]+)\/usdt-topup$/);
  if (!match) return undefined;
  if (!networks.includes(network)) return refuse(400, 'ORDER_TOPUP_NETWORK_INVALID');
  if (scenario === 'disabled') return refuse(409, 'ORDER_USDT_TOPUP_DISABLED');
  if (!owner) return refuse(401, 'LOGIN_REQUIRED');
  const orderNo = decodeURIComponent(match[1]);
  const order = owns && demoAccountOrders(url, locale, state, now).find(row => row.orderNo === orderNo);
  if (!order) return refuse(404, 'ORDER_NOT_FOUND');
  if (state.orderTopupSamples?.['order-error']?.orderNo === orderNo || state.dataState === 'error') return refuse(503, 'ORDER_TOPUP_READ_FAILED');

  const paid = order.paidAt != null || ['PAID', 'REFUNDED', 'CHARGEBACK'].includes(order.paymentStatus);
  const pending = !paid && order.canonicalStatus === 'placed';
  const deadline = pending ? order.expiresAt : null;
  const intent = pending ? checkoutFlow?.topupIntent(orderNo) : null;
  const payment = paid ? checkoutFlow?.deliveredOrderPayment(order) ?? walletOrderPayment(state, order) : null;
  const openIntent = intent && intent.status !== 'MANUAL_REVIEW'
    ? { intentNo: intent.intentNo, paymentMethod: intent.paymentMethod, paymentAllowed: intent.paymentAllowed }
    : null;
  const reviewReason = pending && !openIntent ? intent?.status === 'MANUAL_REVIEW'
    ? 'FINANCE_REVIEW' : order.retiredBankPaymentSession ? 'BANK_SESSION' : null : null;
  const blocker = openIntent ? 'OPEN_INTENT' : reviewReason ? 'NEEDS_REVIEW' : 'NONE';
  const payable = pending && now < deadline && blocker === 'NONE';
  const due = micro(order.amountUsdt);
  const balance = micro(demoWalletUsdt(state));
  const shortfall = payable && due > 0n ? max(0n, due - balance) : 0n;
  const suggested = shortfall === 0n ? 0n : max(micro(MIN), shortfall + micro(FEE));
  const paidAt = paid ? order.paidAt ?? payment?.at : null;
  return ok({
    orderNo, network, state: paid ? 'PAID' : pending ? 'PENDING' : 'CLOSED',
    canonicalStatus: order.canonicalStatus,
    payable, deadlineAt: deadline === null ? null : new Date(deadline).toISOString(),
    amountDueUsdt: decimal(due), walletAvailableUsdt: decimal(balance), shortfallUsdt: decimal(shortfall),
    minDepositUsdt: MIN, depositFeeUsdt: FEE, suggestedTransferUsdt: decimal(suggested),
    blocker, openIntent, reviewReason,
    paidAt: paidAt != null ? new Date(paidAt).toISOString() : null,
    paidAmountUsdt: payment?.amount ?? null,
  });
}
