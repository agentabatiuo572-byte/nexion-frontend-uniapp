import type { Messages } from "@/i18n/messages/en";
import { TRIAL_DEVICE_RESELECTION_CODES } from "@/api/trial-api";

export function trialDeviceNeedsReselection(reason?: string): boolean {
  return TRIAL_DEVICE_RESELECTION_CODES.some(code => code === reason);
}

export function trialPurchaseReasonMessage(t: Messages, reason?: string): string | undefined {
  switch (reason) {
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
