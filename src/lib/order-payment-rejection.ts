import { asApiError, isApiRefusal } from '@/api/errors';
import type { LocaleCode } from '@/i18n';
import { checkoutFlowCopy } from './checkout-flow-copy';

// Definitive /pay refusals: nothing was charged and the order is unchanged.
const REASONS = {
  CAPACITY_REPLACEMENT_REQUIRED: 'rejectCapacity',
  ORDER_PRODUCT_NOT_PAYABLE: 'rejectUnavailable',
  ORDER_MONTHLY_QUOTA_PAUSED: 'rejectQuota',
  ORDER_MONTHLY_QUOTA_EXHAUSTED: 'rejectQuota',
  ORDER_MONTHLY_QUOTA_REQUIREMENTS_NOT_MET: 'rejectRequirements',
  COMMERCE_PAYMENT_EMERGENCY_STOPPED: 'rejectPaused',
  ORDER_NOT_PAYABLE: 'closed',
  ORDER_PAYMENT_EXPIRED: 'closed',
} as const;

const TRADEIN_REASONS = new Map<string, 'rejectTradeinBusy' | 'rejectTradeinOwner'>([
  ['SIMULATED_DEVICE_BUSY', 'rejectTradeinBusy'],
  ['COMPUTE_V2_DEVICE_BUSY', 'rejectTradeinBusy'],
  ['COMPUTE_V2_LEGACY_REQUEST_UNRESOLVED', 'rejectTradeinBusy'],
  ['COMPUTE_V2_OWNER_CHANGED', 'rejectTradeinOwner'],
]);

export const TRADEIN_RUNTIME_RECOVERING = 'COMPUTE_V2_RUNTIME_RECOVERING';

export function tradeinRejectionKey(message?: string) {
  return message ? TRADEIN_REASONS.get(message) : undefined;
}

export function tradeinPaymentRejection(error: unknown) {
  const { message } = asApiError(error);
  return isApiRefusal(error, 409, message) ? tradeinRejectionKey(message) : undefined;
}

/** The user-facing reason for a definitive payment refusal, or null when the outcome is not a known refusal. */
export function orderPaymentRejection(error: unknown, locale: LocaleCode): string | null {
  const key = REASONS[asApiError(error).message as keyof typeof REASONS];
  return key ? checkoutFlowCopy(locale)[key] : null;
}
