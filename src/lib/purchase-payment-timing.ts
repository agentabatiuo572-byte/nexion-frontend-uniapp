import type { PurchasePaymentIntent } from '@/api/purchase-payment-api';

export function isUnpaidPaymentTerminal(intent: PurchasePaymentIntent | null, legacyTrialExpiry = false) {
  return intent?.status === 'EXPIRED' && (intent.kind !== 'TRIAL_CONVERT' || intent.trialPurchaseOutcome === 'UNPAID_TERMINAL'
    || legacyTrialExpiry && intent.claimNo === undefined);
}

export function isTrialPaymentReviewPending(intent: PurchasePaymentIntent | null) {
  return intent?.kind === 'TRIAL_CONVERT' && intent.status === 'MANUAL_REVIEW' && !intent.trialPurchaseOutcome
    && !intent.refundStatus && intent.fulfilmentStatus !== 'DELIVERED';
}

/** The confirmation window never grants additional time to send a payment. */
export function purchasePaymentTiming(intent: PurchasePaymentIntent | null, now: number, orderDeadline: number | null = null, legacyTrialExpiry = false) {
  const ends = [intent?.expiresAt, intent?.deadlineAt, intent?.expirationTime].filter((value): value is string => !!value).map(Date.parse);
  if (orderDeadline !== null) ends.push(orderDeadline);
  const cutoff = ends.length ? Math.min(...ends) : null;
  const pending = !!intent && ['CREATING', 'SUBMIT_UNKNOWN', 'AWAITING_PAYMENT'].includes(intent.status);
  const pastDeadline = cutoff !== null && now >= cutoff;
  const networkPaused = intent?.status === 'AWAITING_PAYMENT' && intent.paymentMethod !== 'HDPAY_BANK'
    && intent.paymentAllowed === false && !pastDeadline;
  return { cutoff, left: cutoff === null ? null : Math.max(0, cutoff - now),
    canPay: !!intent && intent.status === 'AWAITING_PAYMENT' && intent.paymentAllowed !== false && !pastDeadline,
    networkPaused,
    confirming: isTrialPaymentReviewPending(intent)
      || intent?.kind === 'TRIAL_CONVERT' && intent.status === 'EXPIRED' && !isUnpaidPaymentTerminal(intent, legacyTrialExpiry)
      || pending && (pastDeadline || intent?.status === 'AWAITING_PAYMENT' && intent.paymentAllowed === false && !networkPaused) };
}
