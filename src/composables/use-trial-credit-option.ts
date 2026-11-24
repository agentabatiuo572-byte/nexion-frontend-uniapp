import { computed, watch } from "vue";
import type { TrialPurchaseOption } from "@/api/trial-api";
import { useFreeTrial } from "@/store/free-trial";
import { useTrialPurchaseOptions } from "@/store/trial-purchase-options";

/**
 * The store's trial-credit entry (PLAN §2.3, R14): a product shows the 「可用试用抵扣金」 tag, the detail entry and the tray
 * note only while the trial can still buy with its credit (active, deduction period or extended hold all map to
 * "active"/"grace"), the list for the current claim has been read, and this product is on it, buyable now, not the
 * user's own trial device and carries a server quote. Loading, failed and unsupported lists show nothing, so the store
 * reads exactly as it does without the feature.
 */
export function useTrialCreditOption(productNo: () => string | undefined) {
  const trial = useFreeTrial();
  const options = useTrialPurchaseOptions();
  return computed<TrialPurchaseOption | null>(() => {
    if (trial.status !== "active" && trial.status !== "grace") return null;
    if (!trial.authorityClaimNo || options.claimNo !== trial.authorityClaimNo || options.current.status !== "ready") return null;
    const no = productNo();
    return options.current.options.find((option) => option.productNo === no
      && option.canBuy && !option.isTrialProduct && option.quote !== undefined) ?? null;
  });
}

/**
 * Binds the purchase list to the current trial claim and reads it while the page is visible, so the store and the
 * detail page share one read (PLAN §2.3). 读取时机由接线项复核: recovery after a failed read, foreground and
 * pull-to-refresh are the wiring item's.
 */
export function useTrialCreditOptionsRead(visible: () => boolean) {
  const trial = useFreeTrial();
  const options = useTrialPurchaseOptions();
  watch(() => [visible(), trial.status, trial.authorityClaimNo] as const, ([shown, status, claimNo]) => {
    if (!shown || !claimNo || (status !== "active" && status !== "grace")) return;
    if (options.claimNo !== claimNo) options.bindClaim(claimNo);
    // A failed read stays in current.status ("failed"), which hides the entry; retrying it is the wiring item's.
    options.refresh().catch(() => {});
  }, { immediate: true });
}
