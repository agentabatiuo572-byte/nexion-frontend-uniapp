import { executePaymentWithPassword } from './authorized-payment';
import { requestPurchasePayment, acknowledgePurchasePayment, type PurchasePaymentContext } from '@/store/purchase-payment';
import type { PaymentPasswordContext } from '@/store/payment-password';
import type { PaymentPasswordAuthorization } from '@/api/payment-password-api';
import { remoteApiEnabled } from '@/api/runtime';

export type PurchaseExecution<T> = Omit<PurchasePaymentContext, 'amount' | 'summary' | 'current'> & {
  exactAmount?: number;
  parseReceipt: (raw: unknown) => T | Promise<T>;
};
export async function executeSelectedPurchase<T>(
  context: PaymentPasswordContext,
  wallet: (authorization: PaymentPasswordAuthorization) => Promise<T>,
  current: () => boolean,
  purchase: PurchaseExecution<T>,
  walletOnly = false,
): Promise<T | null> {
  if (!current()) return null;
  // Zero-value rights still use the approved wallet confirmation; never create a zero external collection.
  const { exactAmount, parseReceipt: _receipt, ...external } = purchase;
  if (walletOnly || !remoteApiEnabled || (exactAmount ?? Number(context.amount)) === 0)
    return executePaymentWithPassword(context, wallet, current);
  const choice = await requestPurchasePayment({ ...external, amount: context.amount, summary: context.summary, current });
  if (!choice) return null;
  if (choice.method === 'EXTERNAL') {
    const receipt = await purchase.parseReceipt(choice.receipt);
    acknowledgePurchasePayment(choice);
    return receipt;
  }
  if (!current()) return null;
  return executePaymentWithPassword(context, wallet, current);
}
