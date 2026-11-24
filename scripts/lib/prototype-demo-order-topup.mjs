// B84 preview scenes update the account's records. The API projects those same records.
import { demoAccountOrders, demoAssignablePurchaseSlots, demoTimedOutOrder, paymentWindow } from './prototype-demo-data.mjs';
import { demoPurchasingAccountId, previewAccountId } from './prototype-demo-identity.mjs';
import { demoChainDepositAddress, demoChainDepositFee as FEE, demoChainDepositMinimum as MIN, demoWalletUsdt,
  recordDemoChainDeposit, seedDemoRewardClawback } from './prototype-demo-wallet.mjs';

const MICRO = 1000000n;
const sampleOrderNo = 'DEMO-ORDER-001';
const networks = ['BEP20', 'ERC20'];
const walletScenes = ['waiting', 'partial', 'below-min', 'min-floor', 'covered', 'debt'];
const originalScenes = ['open-intent', 'open-intent-usdt', 'open-intent-readonly', 'snapshot-error', 'finance-review'];
const orderScenes = ['paid', 'paid-unverified', 'closed', 'expired', 'deadline', 'missing'];
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

function applyWalletScene(state, scene, order, now, freshAccount) {
  // Start a low-balance story only before the account has posted any USDT movements.
  const openingScene = scene !== 'covered' && (scene !== 'below-min' || freshAccount);
  if (openingScene && state.walletBalance === undefined && !state.walletLegacySeed
      && !state.walletMovements?.some(row => row.asset === 'USDT') && !state.walletPurchaseDebits?.length) {
    state.walletBalance = state.walletUsdtCheckpoint = scene === 'debt' ? 160 : 120.5;
    if (scene === 'debt') seedDemoRewardClawback(state, now);
  }
  const createdAt = Math.max(now, order.placedAt + 1);
  if (scene === 'below-min' || scene === 'partial') {
    const [grossAmountUsdt, creditedUsdt] = scene === 'below-min' ? ['20', '0'] : ['250.123456', '250'];
    for (const network of networks) recordDemoChainDeposit(state, { network, grossAmountUsdt, creditedUsdt, createdAt });
  }
  if (scene === 'min-floor' || scene === 'covered') {
    const minimumCredit = micro(MIN) - micro(FEE);
    const target = scene === 'min-floor' ? micro(order.amountUsdt) - micro('10') : micro('52800.64');
    const credit = target - micro(demoWalletUsdt(state));
    if (credit <= 0n || scene === 'min-floor' && credit < minimumCredit) return;
    const net = max(credit, minimumCredit);
    recordDemoChainDeposit(state, { network: 'BEP20', grossAmountUsdt: decimal(net + micro(FEE)),
      creditedUsdt: decimal(net), createdAt });
  }
}

export function applyDemoOrderTopupScene(url, state, locale, now, checkoutFlow, freshAccount, scene) {
  if (![...walletScenes, ...originalScenes, ...orderScenes, 'review'].includes(scene)) return;
  const sample = demoAccountOrders(url, locale, state, now).find(row => row.orderNo === sampleOrderNo);
  if (originalScenes.includes(scene) || scene === 'paid' || scene === 'paid-unverified') {
    if (sample?.canonicalStatus !== 'placed' || scene === 'paid-unverified' && checkoutFlow?.topupIntent(sampleOrderNo))
      return {status: 409, message: 'PREVIEW_ORDER_TOPUP_RESET_REQUIRED'};
    if (scene !== 'paid-unverified') return checkoutFlow?.seedOrderTopupOriginal(url.origin, sampleOrderNo, scene);
  }
  if (sample?.canonicalStatus !== 'placed') return;
  if (walletScenes.includes(scene)) return applyWalletScene(state, scene, sample, now, freshAccount);
  if (checkoutFlow?.topupIntent(sampleOrderNo)) return;
  if (scene === 'review') {
    state.orderTopupBankReviewOrderNo = sampleOrderNo;
    return;
  }
  if (scene === 'missing') {
    state.orderTopupMissingOrderNo = sampleOrderNo;
    return;
  }
  const order = state.createdOrders?.find(row => row.orderNo === sampleOrderNo) ?? sample;
  if (scene === 'closed') {
    Object.assign(order, { canonicalStatus: 'cancelled', paymentStatus: 'CANCELLED', orderStatus: 'CANCELLED',
      closeReasonCode: 'USER_CANCELLED', expiresAt: null });
  } else if (scene === 'deadline' || scene === 'expired') {
    const expiresAt = now - (scene === 'deadline' ? 1000 : 61000);
    Object.assign(order, { placedAt: expiresAt - paymentWindow, expiresAt });
    if (scene === 'expired') Object.assign(order, demoTimedOutOrder);
  } else {
    if (order.quantity > demoAssignablePurchaseSlots(url, locale, state)) return;
    Object.assign(order, { canonicalStatus: 'paid', paymentStatus: 'PAID', orderStatus: 'PAID',
      activationStatus: 'WAITING_PROVISIONING', expiresAt: null, paymentMethod: null, paidAt: null, paidTotalUsdt: null });
  }
  if (order === sample) (state.createdOrders ??= []).push(order);
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
    if (scenario === 'address-error') return refuse(503, 'CREGIS_ADDRESS_UNAVAILABLE');
    if (scenario === 'preparing' && !demoChainDepositAddress(state, network))
      return ok({ enabled: false, creditEnabled: false, network, reason: 'CREGIS_ADDRESS_PREPARING' });
    if (scenario === 'paused') {
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
  if (scenario === 'order-error' || state.dataState === 'error') return refuse(503, 'ORDER_TOPUP_READ_FAILED');

  const paid = order.paidAt != null || ['PAID', 'REFUNDED', 'CHARGEBACK'].includes(order.paymentStatus);
  const pending = !paid && order.canonicalStatus === 'placed';
  const deadline = pending ? order.expiresAt : null;
  const intent = pending ? checkoutFlow?.topupIntent(orderNo) : null;
  const payment = paid ? checkoutFlow?.deliveredOrderPayment(order) ?? walletOrderPayment(state, order) : null;
  const openIntent = intent && intent.status !== 'MANUAL_REVIEW'
    ? { intentNo: intent.intentNo, paymentMethod: intent.paymentMethod, paymentAllowed: intent.paymentAllowed }
    : null;
  const reviewReason = pending && !openIntent ? intent?.status === 'MANUAL_REVIEW'
    ? 'FINANCE_REVIEW' : state.orderTopupBankReviewOrderNo === orderNo ? 'BANK_SESSION' : null : null;
  const blocker = openIntent ? 'OPEN_INTENT' : reviewReason ? 'NEEDS_REVIEW' : 'NONE';
  const payable = pending && now < deadline && blocker === 'NONE';
  const due = micro(order.amountUsdt);
  const balance = micro(demoWalletUsdt(state));
  const shortfall = payable && due > 0n ? max(0n, due - balance) : 0n;
  const suggested = shortfall === 0n ? 0n : max(micro(MIN), shortfall + micro(FEE));
  return ok({
    orderNo, network, state: paid ? 'PAID' : pending ? 'PENDING' : 'CLOSED',
    canonicalStatus: order.canonicalStatus,
    payable, deadlineAt: deadline === null ? null : new Date(deadline).toISOString(),
    amountDueUsdt: decimal(due), walletAvailableUsdt: decimal(balance), shortfallUsdt: decimal(shortfall),
    minDepositUsdt: MIN, depositFeeUsdt: FEE, suggestedTransferUsdt: decimal(suggested),
    blocker, openIntent, reviewReason,
    paidAt: payment?.at != null ? new Date(payment.at).toISOString() : null,
    paidAmountUsdt: payment?.amount ?? null,
  });
}
