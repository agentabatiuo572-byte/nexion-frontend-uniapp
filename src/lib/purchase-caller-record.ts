import type { PurchaseKind } from '@/api/purchase-payment-api';
import { readAccountRow, releaseAccountCommandByKey, writeAccountRow } from '@/store/account-scoped-storage';
import { CAPACITY_RECOVERY_TABLE } from './capacity-command-recovery';
import { releaseCheckoutTradein } from './checkout-order-recovery';
import { CAPACITY_COMMAND_TABLE } from './keep-command-recovery';
import { PROMOTION_CHECKOUT_TABLE, withoutPromotionPayment, type PromotionCheckoutRecord } from './promotion-checkout-session';

export const TRIAL_CONVERT_COMMANDS_TABLE = 'nexgrid-trial-convert-accounts-v1';

/** Each purchase keeps its own recovery record under the payment's key. When the server no longer holds that payment the
 *  record goes too, from storage, so this works on any page and after a reload. Nothing here starts another payment. */
export function releasePurchaseCallerRecord(accountKey: string, kind: PurchaseKind, commandKey: string): void {
  if (kind === 'ORDER_PAY') {
    const rows = readAccountRow<Record<string, PromotionCheckoutRecord>>(PROMOTION_CHECKOUT_TABLE, accountKey, true) ?? {};
    const released = Object.fromEntries(Object.entries(rows).map(([intent, record]) => [intent, withoutPromotionPayment(record, commandKey)]));
    if (Object.keys(rows).some(intent => rows[intent] !== released[intent]) && !writeAccountRow(PROMOTION_CHECKOUT_TABLE, accountKey, released)) {
      throw new Error('ACCOUNT_COMMAND_STORAGE_UNAVAILABLE');
    }
  } else if (kind === 'TRIAL_CONVERT') {
    releaseAccountCommandByKey(TRIAL_CONVERT_COMMANDS_TABLE, accountKey, commandKey);
  } else if (kind === 'TRADE_IN') {
    releaseCheckoutTradein(accountKey, commandKey);
  } else {
    const pending = readAccountRow<{ pending?: { key?: string } | null }>(CAPACITY_RECOVERY_TABLE, accountKey, true)?.pending;
    if (pending?.key === commandKey && !writeAccountRow(CAPACITY_RECOVERY_TABLE, accountKey, { pending: null })) {
      throw new Error('ACCOUNT_COMMAND_STORAGE_UNAVAILABLE');
    }
    releaseAccountCommandByKey(CAPACITY_COMMAND_TABLE, accountKey, commandKey);
  }
}
