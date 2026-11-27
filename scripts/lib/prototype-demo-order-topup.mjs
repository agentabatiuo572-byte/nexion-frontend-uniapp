// B84 scenarios seed independent order stories against the preview account's shared wallet.
import { isDeepStrictEqual } from 'node:util';
import { demoAccountOrders, demoAssignablePurchaseSlots, demoOrderTimedOut, demoProducts, demoTimedOutOrder, paymentWindow } from './prototype-demo-data.mjs';
import { demoChainDepositDisabledReason } from './prototype-demo-deposit-network.mjs';
import { demoPurchasingAccountId, previewAccountId } from './prototype-demo-identity.mjs';
import { demoChainDepositAddress, demoChainDepositPolicyFee, demoChainDepositMinimum as MIN, demoWalletUsdt,
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
const min = (a, b) => a < b ? a : b;
const minCredit = state => micro(MIN) - micro(demoChainDepositPolicyFee(state));
const belowMinimum = micro(MIN) / 2n;
const ok = data => ({ status: 200, body: { code: 0, message: 'OK', data } });
const refuse = (status, message) => ({ status, body: { code: status, message, data: null } });
export const orderTopupResetRequired = 'PREVIEW_ORDER_TOPUP_RESET_REQUIRED';

function postWalletMovement(state, bizNo, bizType, category, direction, amount, at) {
  postDemoWalletEntries(state, { bizNo, bizType, asset: 'USDT', direction, category, at,
    amount: Number(decimal(amount)), amountExact: decimal(amount) });
}

function creditDeposit(state, net, createdAt) {
  const fee = micro(demoChainDepositPolicyFee(state));
  return recordDemoChainDeposit(state, { network: 'BEP20', grossAmountUsdt: decimal(net + fee),
    creditedUsdt: decimal(net), createdAt });
}

function fundWallet(state, target, orderNo, now) {
  const gap = target - micro(demoWalletUsdt(state));
  if (gap > 0n) creditDeposit(state, max(gap, minCredit(state)), now);
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
  if (scene === 'min-floor') fundWallet(state, max(0n, due - belowMinimum), order.orderNo, now);
  if (scene === 'covered' && balance < due) creditDeposit(state, max(due - balance, minCredit(state)), now);
  if (scene === 'partial') {
    const credit = min(micro('250'), max(minCredit(state), due / 2n));
    const opening = min(micro('120.5'), due - credit - 1n);
    if (sample.depositId && balance === opening + credit) return;
    fundWallet(state, opening, order.orderNo, now);
    sample.depositId = creditDeposit(state, credit, now).depositId;
  } else if (waitingScenes.has(scene)) {
    const ceiling = max(0n, due - micro(MIN));
    if (balance > ceiling || balance < 0n) fundWallet(state, min(micro('120.5'), ceiling), order.orderNo, now);
  }
  if (scene === 'below-min' && !sample.depositId) {
    sample.depositId = recordDemoChainDeposit(state,
      { network: 'BEP20', grossAmountUsdt: decimal(belowMinimum), creditedUsdt: '0', createdAt: now }).depositId;
  }
}

function newOrder(url, state, scene, orderNo, now) {
  const products = demoProducts(state, url.origin);
  const product = products.find(row => row.id === (scene === 'zero-voucher' ? 'cloud-share' : 'stellarbox-s1'));
  if (!product || !Number.isFinite(product.price) || product.price <= 0) return null;
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

function canReuseSample(order, sample, scene, state, checkoutFlow, now) {
  if (!order || !isDeepStrictEqual(order, sample.initialOrder)) return false;
  if (demoOrderTimedOut(order, state, now)
      || (order.canonicalStatus === 'placed' && scene !== 'deadline' && order.expiresAt <= now)) return false;
  const orderNo = order.orderNo;
  if (checkoutFlow?.hasOrderCommands(orderNo)
      || Object.values(state.commands ?? {}).some(command => command.order?.orderNo === orderNo)) return false;
  return isDeepStrictEqual(checkoutFlow?.orderPaymentRecords(orderNo) ?? [], sample.initialPayments);
}

// Plan the story against the requested preview before assigning an address, order or wallet entry.
export function planDemoOrderTopupScene(url, locale, state, now, checkoutFlow, scene, accountId) {
  const rejected = () => ({ failure: orderTopupResetRequired });
  const open = network => !demoChainDepositDisabledReason(state, network, scene);
  if (scene === 'erc20-only') return open('ERC20') ? {} : rejected();
  if (!orderScenes.has(scene)) return {};
  if (accountId !== demoPurchasingAccountId(state) || state.dataState === 'empty' || state.accountDeletionState !== 'follow') return rejected();
  const network = scene === 'preparing' ? ['ERC20', 'BEP20'].find(net => open(net) && !demoChainDepositAddress(state, net))
    : scene === 'open-intent-usdt' ? 'ERC20' : 'BEP20';
  if (!network || !open(network)) return rejected();
  const defaultOrderNo = `DEMO-B84-${scene.toUpperCase()}`;
  if (scene === 'missing') return { network, orderNo: defaultOrderNo };

  const sample = state.orderTopupSamples?.[scene];
  const existing = state.createdOrders?.find(row => row.orderNo === sample?.orderNo);
  const reuse = canReuseSample(existing, sample, scene, state, checkoutFlow, now);
  const generation = !sample ? 1 : sample.generation + (reuse ? 0 : 1);
  const orderNo = generation === 1 ? defaultOrderNo : `${defaultOrderNo}-${generation}`;
  const order = reuse ? existing : newOrder(url, state, scene, orderNo, now);
  if (!order || scene === 'partial' && micro(order.amountUsdt) <= minCredit) return rejected();
  if (!reuse && scene === 'paid-unverified' && !demoAssignablePurchaseSlots(url, locale, structuredClone(state))) return rejected();
  return { network, orderNo, order, reuse, generation };
}

// Reuse the sample only while its seeded facts still hold. Keep earlier orders and their records intact.
export function applyDemoOrderTopupScene(url, state, now, checkoutFlow, scene, plan) {
  const { network, orderNo, order, reuse, generation } = plan;
  if (!network) return null;
  if (!order) return ok({ orderNo, network });

  const samples = state.orderTopupSamples ??= {};
  let sample = samples[scene];
  if (!reuse) {
    (state.createdOrders ??= []).unshift(order);
    const original = originals[scene];
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
        creditDeposit(state, max(micro(order.amountUsdt) - micro(demoWalletUsdt(state)), minCredit), now);
      postWalletMovement(state, orderNo, 'ORDER_PURCHASE', 'purchase', 'OUT', micro(order.amountUsdt), now);
      Object.assign(order, { paymentMethod: 'UVEL_WALLET', paymentNo: `DEMO-PAY-${orderNo}`, paidAt: now,
        paidTotalUsdt: order.amountUsdt.toFixed(2) });
      if (scene === 'refunded') {
        const refundBillNo = `E4-REFUND-${orderNo}`;
        postWalletMovement(state, refundBillNo, 'ORDER_REFUND', 'refund', 'IN', micro(order.amountUsdt), now);
        Object.assign(order, { refundBillNo, refundedAt: now, refundAmountUsdt: order.amountUsdt });
      }
    }
    sample = samples[scene] = { orderNo, generation,
      initialPayments: structuredClone(checkoutFlow?.orderPaymentRecords(orderNo) ?? []) };
  }
  if (scene === 'deadline') {
    order.expiresAt = now - 1000;
    order.placedAt = order.expiresAt - paymentWindow;
  }
  sample.initialOrder = structuredClone(order);
  applyWalletStory(state, scene, order, sample, now);
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
  const fee = demoChainDepositPolicyFee(state);
  if (path === '/api/deposits/policy') {
    if (scenario === 'policy-error') return refuse(503, 'CREGIS_DEPOSIT_POLICY_UNAVAILABLE');
  }
  if (path === '/api/deposits/address' && networks.includes(network) && owns && !demoChainDepositDisabledReason(state, network)) {
    if (scenario === 'address-error' && network === state.orderTopupPreview?.network) return refuse(503, 'CREGIS_ADDRESS_UNAVAILABLE');
    if (scenario === 'preparing' && network === state.orderTopupPreview?.network && !demoChainDepositAddress(state, network))
      return ok({ enabled: false, creditEnabled: false, network, reason: 'CREGIS_ADDRESS_PREPARING' });
    if (scenario === 'paused' && network === state.orderTopupPreview?.network) {
      const address = demoChainDepositAddress(state, network);
      return ok({ enabled: !!address, creditEnabled: false, network, ...(address && { address }), reason: 'CREGIS_DEPOSIT_PAUSED',
        confirmations: 15, feeUsdt: Number(fee), feeUsdtExact: fee, minDepositUsdt: Number(MIN), minDepositUsdtExact: MIN });
    }
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
  const suggested = shortfall === 0n ? 0n : max(micro(MIN), shortfall + micro(fee));
  const paidAt = paid ? order.paidAt ?? payment?.at : null;
  return ok({
    orderNo, network, state: paid ? 'PAID' : pending ? 'PENDING' : 'CLOSED',
    canonicalStatus: order.canonicalStatus,
    payable, deadlineAt: deadline === null ? null : new Date(deadline).toISOString(),
    amountDueUsdt: decimal(due), walletAvailableUsdt: decimal(balance), shortfallUsdt: decimal(shortfall),
    minDepositUsdt: MIN, depositFeeUsdt: fee, suggestedTransferUsdt: decimal(suggested),
    blocker, openIntent, reviewReason,
    paidAt: paidAt != null ? new Date(paidAt).toISOString() : null,
    paidAmountUsdt: payment?.amount ?? null,
  });
}
