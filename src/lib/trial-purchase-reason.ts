import type { Messages } from "@/i18n/messages/en";
import type { LocaleCode } from "@/i18n";
import { TRIAL_DEVICE_RESELECTION_CODES } from "@/api/trial-api";
import { checkoutFlowCopy } from "./checkout-flow-copy";

export function trialDeviceNeedsReselection(reason?: string): boolean {
  return TRIAL_DEVICE_RESELECTION_CODES.some(code => code === reason);
}

export function trialPurchaseReasonMessage(t: Messages, reason?: string, locale?: LocaleCode): string | undefined {
  switch (reason) {
    case "TRIAL_WALLET_INSUFFICIENT":
      return t.errors.insufficientBalanceTitle;
    case "TRIAL_QUOTE_CHANGED":
    case "TRIAL_AMOUNT_MISMATCH":
    case "TRIAL_QUOTE_VERSION_INVALID":
      return t.store.coTrialQuoteChanged;
    case "TRIAL_KILL_SWITCH_DISABLED":
      return locale ? checkoutFlowCopy(locale).trialConversionClosedTitle : undefined;
    case "TRIAL_NOT_CONVERTIBLE":
      return locale ? checkoutFlowCopy(locale).trialNotConvertibleTitle : undefined;
    case "PRODUCT_OUT_OF_STOCK":
    case "TRIAL_PRODUCT_STOCK_CONFLICT":
      return t.store.temporarilyOutOfStock;
    case "ORDER_MONTHLY_QUOTA_EXHAUSTED":
    case "ORDER_MONTHLY_QUOTA_CONFLICT":
      return t.store.purchaseMonthlyQuotaDepleted;
    case "ORDER_MONTHLY_QUOTA_PAUSED":
    case "ORDER_MONTHLY_QUOTA_UNAVAILABLE":
      return t.quota.stockUnavailable;
    case "PURCHASE_GATE_NOT_MET":
    case "ORDER_MONTHLY_QUOTA_REQUIREMENTS_NOT_MET":
      return t.store.purchaseEligibilityIneligible;
    case "PURCHASE_GATE_SOLD_OUT":
      return t.store.purchaseEligibilityQuotaDepleted;
  }
  // Off sale, not released or held back by a listing rule: the store does not sell it now.
  if (trialDeviceNeedsReselection(reason)) return t.store.trialDeviceNotOnSale;
}
