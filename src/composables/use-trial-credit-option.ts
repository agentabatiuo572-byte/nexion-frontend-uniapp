import { computed, watch } from "vue";
import type { TrialPurchaseOption } from "@/api/trial-api";
import { foregroundReadAllowed } from "@/lib/foreground-read";
import { hasVisiblePullRefresh } from "@/lib/active-page-refresh";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { useFreeTrial } from "@/store/free-trial";
import { useTrialCheckout } from "@/store/trial-checkout";
import { trialExternalCreatePending } from "@/store/purchase-payment";
import { trialOptionReadFailed, useTrialPurchaseOptions } from "@/store/trial-purchase-options";

/**
 * The store's trial-credit entry (PLAN §2.3, R14): a product shows the 「可用试用抵扣金」 tag, the detail entry and the tray
 * note only while the trial can still buy with its credit (active, deduction period or extended hold all map to
 * "active"/"grace"), the list for the current claim has been read, and this product is on it, buyable now, not the
 * user's own trial device and carries a server quote. Loading, failed and unsupported lists show nothing, so the store
 * reads exactly as it does without the feature.
 */
export function useTrialPurchaseConfirmation() {
  const trial = useFreeTrial(), checkout = useTrialCheckout();
  return computed(() => {
    const original = checkout.originalPurchase;
    return trial.legacyConversionPending || trialExternalCreatePending(trial.displayState?.claimNo)
      || checkout.outcome.status === "submitting" || checkout.outcome.status === "processing"
      || original?.status === "PROCESSING" || original?.status === "CREATING" || original?.status === "SUBMIT_UNKNOWN";
  });
}

export function useTrialCreditOption(productNo: () => string | undefined, forConfirmationNote = false) {
  const trial = useFreeTrial(), options = useTrialPurchaseOptions(), checkout = useTrialCheckout();
  const confirming = useTrialPurchaseConfirmation();
  return computed<TrialPurchaseOption | null>(() => {
    const state = trial.displayState;
    if (!state?.claimNo || (state.status !== "active" && state.status !== "grace") || options.claimNo !== state.claimNo
        || options.current.status !== "ready") return null;
    if (forConfirmationNote ? !confirming.value
      : state.claimNo !== trial.authorityClaimNo || checkout.originalPurchase || confirming.value || trial.authorityResultUnknown) return null;
    const no = productNo();
    return options.current.options.find((option) => option.productNo === no
      && option.canBuy && !option.isTrialProduct && option.quote !== undefined) ?? null;
  });
}

/**
 * Visible consumers share one authoritative list read per claim. Pages call the returned
 * refresh alongside their other pull-to-refresh reads.
 */
export function useTrialCreditOptionsRead(visible: () => boolean, takeEntryProduct?: () => string | undefined) {
  const trial = useFreeTrial();
  const options = useTrialPurchaseOptions();
  const confirming = useTrialPurchaseConfirmation();
  const claim = computed(() => {
    const state = trial.displayState;
    return state?.claimNo === trial.authorityClaimNo && (state?.status === "active" || state?.status === "grace")
      ? state.claimNo : null;
  });
  const active = () => visible() && claim.value !== null;
  const failed = () => active() && (options.current.status === "failed"
    || (options.current.status === "ready" && options.current.options.some(trialOptionReadFailed)));
  async function read() {
    if (active() && foregroundReadAllowed() && options.claimNo === claim.value
        && options.current.status !== "unsupported" && options.current.status !== "not-convertible") await options.refresh();
  }
  const recovery = useAutoRecovery({
    active, failed, retry: read, quiet: () => trial.authorityResultUnknown || confirming.value, repeatMs: 30_000,
    repeatWhile: () => !hasVisiblePullRefresh(),
  });
  watch([visible, claim, foregroundReadAllowed], ([shown, claimNo, allowed]) => {
    if (!shown) return;
    if (claimNo === null) {
      if (!trial.displayState || !["active", "grace"].includes(trial.displayState.status)) options.bindClaim(null);
      return;
    }
    const productNo = takeEntryProduct?.();
    if (options.claimNo !== claimNo || productNo) options.bindClaim(claimNo, productNo);
    if (allowed && (!failed() || productNo)) void read().catch(() => {});
  }, { immediate: true });
  return { refresh: () => failed() ? recovery.retry() : read() };
}
