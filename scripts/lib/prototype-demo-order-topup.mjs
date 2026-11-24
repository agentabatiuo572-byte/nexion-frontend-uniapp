// Local preview only, never imported by src: the order top-up page's reads per preview scenario (orderTopupState).
// The B84 order read (contract-b84.md BE-05) is answered here, and for the address and deposit scenarios the existing
// deposit address and deposit list reads too. Every number comes from the scenario's order amount and balance, so
// amount due − balance = shortfall and suggested = max(minimum, shortfall + fee) hold in every state; the fee and
// minimum are the deposits policy fixture's (prototype-demo-finance.mjs). With the default 'off' the order read answers as
// 'waiting' and the address and deposit reads stay with the other fixtures.
import { demoAccountOrders } from './prototype-demo-data.mjs';
import { demoWalletUsdt } from './prototype-demo-wallet.mjs';

const FEE = '0.123456', MIN = '50';
const MICRO = 1000000n;
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

/** The scenario's response for a GET, or undefined when the scenario leaves that read to the other fixtures. */
export function demoOrderTopupResponse(url, state, locale, now) {
  const scenario = state.orderTopupState ?? 'off';
  const network = url.searchParams.get('network') === 'ERC20' ? 'ERC20' : 'BEP20';
  if (url.pathname === '/api/deposits/address') {
    if (scenario === 'address-error') return { status: 503, body: { code: 503, message: 'CREGIS_ADDRESS_UNAVAILABLE', data: null } };
    if (scenario === 'preparing') return ok({ enabled: false, creditEnabled: false, network, reason: 'CREGIS_ADDRESS_PREPARING' });
    if (scenario === 'paused') return ok({ enabled: true, creditEnabled: false, network, address: address(network), reason: 'CREGIS_DEPOSIT_PAUSED',
      confirmations: 15, feeUsdt: Number(FEE), feeUsdtExact: FEE, minDepositUsdt: Number(MIN), minDepositUsdtExact: MIN });
    return undefined;
  }
  if (url.pathname === '/api/deposits') {
    if (scenario === 'partial') return ok([deposit(network, '500.123456', '500', 'CREDITED', now - 2 * 60000)]);
    if (scenario === 'below-min') return ok([deposit(network, '20', '0', 'DUST_HOLD', now - 3 * 60000)]);
    return scenario === 'off' ? undefined : ok([]);
  }
  const match = url.pathname.match(/^\/api\/app\/orders\/([^/]+)\/usdt-topup$/);
  if (!match) return undefined;
  if (scenario === 'order-error') return { status: 503, body: { code: 503, message: 'ORDER_TOPUP_READ_FAILED', data: null } };
  const orderNo = decodeURIComponent(match[1]);
  const order = demoAccountOrders(new URL(url.origin), locale, state, now).find(row => row.orderNo === orderNo);
  const long = state.contentState === 'long';
  const due = micro(long ? '12345678.123456' : order?.amountUsdt ?? 899);
  const balance = micro({
    covered: long ? '12400000.5' : String(demoWalletUsdt(state)), partial: long ? '501.358024' : '620.5', debt: '-12.123456',
  }[scenario] ?? (long ? '1.234567' : '120.5'));
  const shortfall = max(0n, due - balance);
  const suggested = shortfall === 0n ? 0n : max(micro(MIN), shortfall + micro(FEE));
  const closed = scenario === 'expired', paid = scenario === 'paid';
  return ok({
    orderNo, network,
    orderStatus: paid ? 'PAID' : closed ? 'EXPIRED' : 'PENDING_PAYMENT',
    payable: !paid && !closed && !['open-intent', 'review'].includes(scenario),
    deadlineAt: new Date(closed ? now - 60000 : order?.expiresAt ?? now + 25 * 60000).toISOString(),
    amountDueUsdt: decimal(due), walletAvailableUsdt: decimal(balance), shortfallUsdt: decimal(shortfall),
    minDepositUsdt: MIN, depositFeeUsdt: FEE, suggestedTransferUsdt: decimal(suggested),
    blocker: scenario === 'open-intent' ? 'OPEN_INTENT' : scenario === 'review' ? 'NEEDS_REVIEW' : 'NONE',
    openIntent: scenario === 'open-intent' ? { intentNo: 'PPI-PREVIEW-7001', paymentMethod: 'HDPAY_BANK', paymentAllowed: true } : null,
    reviewReason: scenario === 'review' ? 'BANK_SESSION' : null,
    paidAt: paid ? new Date(now - 5 * 60000).toISOString() : null,
    paidAmountUsdt: paid ? decimal(due) : null,
  });
}
const ok = data => ({ status: 200, body: { code: 0, message: 'OK', data } });
function deposit(network, gross, credited, status, at) {
  return { depositId: 'CR-' + at, network, txHash: '0x' + 'b'.repeat(64), address: address(network),
    grossAmountUsdt: Number(gross), grossAmountUsdtExact: gross, creditedUsdt: Number(credited), creditedUsdtExact: credited,
    confirmations: 15, requiredConfirmations: 15, status, createdAt: at, creditedAt: status === 'CREDITED' ? at : null };
}
