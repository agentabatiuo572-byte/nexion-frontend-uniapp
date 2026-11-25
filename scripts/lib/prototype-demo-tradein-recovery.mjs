const targetProductNo = 'stellarbox-pro';
const checkoutTable = 'nexgrid-checkout-server-order-recovery-v1';
const capacityTable = 'nexgrid-e3-capacity-payment-accounts-v1';
const purchasePaymentTable = 'uvel-purchase-payment-accounts-v1';

export const tradeinRecoveryStates = ['off', 'tradein-pending', 'keep-unpaid', 'replace-refused', 'replace-unpaid'];

export function demoTradeinRecovery(selection, accountId, scenario, read) {
  const entries = [];
  // Matches uni.setStorageSync on H5. Each table holds rows keyed by the App's account scope.
  const write = (key, row) => entries.push([key, { type: 'object', data: { ['user:' + accountId]: row } }]);
  const reject = message => { throw Object.assign(new Error(message), { status: 409 }); };
  if (selection === 'tradein-pending') {
    const sourceDeviceId = 41;
    const tradeinQuote = read('/api/app/trade-in/quote', { sourceDeviceId, targetProductNo });
    const intent = [targetProductNo, '', 'nexgrid-wallet', sourceDeviceId, tradeinQuote.sourceRowVersion].join('|');
    const suffix = 'preview-' + scenario;
    write(checkoutTable, { orders: { [targetProductNo]: {
      productNo: targetProductNo, orderNo: '', intent, commandKey: 'h7-order:' + suffix,
      tradeinQuote, tradeinCommandSubmitted: true,
    } } });
    // The original wallet command has an unresolved result. A read does not debit or retire the device.
    const command = { kind: 'trade-in', commandKey: 'e3-tradein:' + suffix, status: 'PROCESSING',
      canResumeSameKey: false, code: 409, message: 'PURCHASE_PAYMENT_PROCESSING' };
    return { entries, command };
  }

  const operation = selection === 'keep-unpaid' ? 'keep' : 'replace';
  const quote = read('/api/app/trade-in/capacity-quote', { targetProductNo });
  const expected = operation === 'keep' ? 'CAPACITY_AVAILABLE' : 'REPLACE_REQUIRED';
  if (quote.decision !== expected) reject('PREVIEW_CAPACITY_RECOVERY_FLEET_MISMATCH');
  const intent = [operation, quote.sourceDeviceId ?? 'none', targetProductNo, quote.targetProductId,
    quote.targetPriceUsdt, quote.payableUsdt, quote.maxActiveDevices].join('|');
  const key = 'e3-capacity-' + operation + ':preview-' + scenario;
  const eligibility = read('/api/store/purchase-eligibility?productNo=' + targetProductNo);
  if (selection === 'replace-refused') {
    if (eligibility.decisionCode !== 'F4B_MONTHLY_QUOTA_EXHAUSTED') reject('PREVIEW_CAPACITY_RECOVERY_QUOTA_NOT_EXHAUSTED');
    // The provider intent was never created. Checkout retains this original command after the payment refusal.
    const kind = 'CAPACITY_REPLACE';
    const payload = { targetProductNo, expectedPayableUsdt: quote.payableUsdt, sourceDeviceId: quote.sourceDeviceId };
    write(purchasePaymentTable, { records: { [key]: {
      fingerprint: JSON.stringify([kind, payload]), kind, commandKey: key,
      paymentQuoteId: 'PPQ-PREVIEW-REFUSED-' + scenario, paymentMethod: 'CREGIS_USDT_BSC', network: 'BSC',
      summary: quote.targetProductName, quotaRefusal: 'rejectQuotaMonthFull',
    } } });
  } else if (!eligibility.eligible) {
    reject('PREVIEW_CAPACITY_RECOVERY_TARGET_NOT_ELIGIBLE');
  }
  // No completed payment exists for these originals. The existing command lookup returns NOT_SEEN with same-key resume.
  write(capacityTable, { pending: { operation, intent, key, quote } });
  return { entries };
}
