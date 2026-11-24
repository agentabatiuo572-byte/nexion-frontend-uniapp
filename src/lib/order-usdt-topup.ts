import type { OrderTopupNetwork, OrderUsdtTopupRead } from '@/api/purchase-payment-api';
import { isApiRefusal } from '@/api/errors';
import { formatGroupedAmount } from '@/lib/amount-display';
import { getT } from '@/i18n/use-t';
import { fmt } from '@/i18n/format';
import { confirm } from '@/store/ui';

export function orderTopupPayable(read: OrderUsdtTopupRead, now = Date.now()): boolean {
  return read.payable && read.deadlineAt !== null && now < Date.parse(read.deadlineAt);
}

export const hasUsdt = (amount: string): boolean => /[1-9]/.test(amount);

export function orderTopupPaymentChanged(error: unknown): boolean {
  return isApiRefusal(error, 409, 'ORDER_WALLET_INSUFFICIENT', 'ORDER_EXTERNAL_PAYMENT_IN_PROGRESS',
    'HDPAY_COMMERCE_PAYMENT_REVIEW_REQUIRED', 'ORDER_NOT_PAYABLE', 'ORDER_PAYMENT_EXPIRED');
}

export function orderTopupHref(orderNo: string, network: OrderTopupNetwork, name: string): string {
  return `/pages/me/wallet-topup?${new URLSearchParams({ orderNo, network, name })}`;
}

export function confirmOrderTopupPayment(amount: string, owner: string): Promise<boolean> {
  const { store } = getT();
  return confirm({ title: store.coConfirmPurchase,
    message: fmt(store.coConfirmPurchaseMessage, { amount: formatGroupedAmount(amount, 'full') }),
    confirmLabel: store.coConfirmPayment, cancelLabel: store.coCancel, owner });
}

/** Convert decimal strings to a common integer scale for display calculations. */
export function usdtUnits(...amounts: string[]): bigint[] {
  const parts = amounts.map(amount => amount.split('.'));
  const scale = Math.max(...parts.map(([, fraction]) => fraction?.length ?? 0));
  return parts.map(([whole, fraction = '']) => BigInt(whole + fraction.padEnd(scale, '0')));
}
