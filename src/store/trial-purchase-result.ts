import { defineStore } from "pinia";
import { computed, ref, shallowRef, watch } from "vue";
import { useApp } from "./app";

type TrialPurchaseResult =
  | { status: "settled"; claimNo: string; orderNo: string }
  | { status: "refused"; claimNo: string; key: string; reason: string };

export const trialOrderResultKey = (orderNo: string) => JSON.stringify(["settled", orderNo]);
export const trialRefusalResultKey = (claimNo: string, key: string) => JSON.stringify(["refused", claimNo, key]);
function resultKey(result: TrialPurchaseResult) {
  return result.status === "settled" ? trialOrderResultKey(result.orderNo) : trialRefusalResultKey(result.claimNo, result.key);
}

/** A visible trial surface handles its own result. Any remaining delivery belongs to App. */
export const useTrialPurchaseResult = defineStore("trial-purchase-result", () => {
  const app = useApp();
  const pending = shallowRef<TrialPurchaseResult[]>([]);
  const delivered = new Set<string>();
  const outsideRefusals = new Set<string>();
  const presenters = new Set<(claimNo: string) => boolean>();
  const visibilityRevision = ref(0);
  const outsidePage = computed(() => {
    void visibilityRevision.value;
    return pending.value.filter(result => ![...presenters].some(presents => presents(result.claimNo)));
  });
  watch(() => app.accountBindingEpoch, () => {
    pending.value = [];
    delivered.clear();
    outsideRefusals.clear();
  }, { flush: "sync" });

  function publish(result: TrialPurchaseResult) {
    const key = resultKey(result);
    if (!delivered.has(key) && !pending.value.some(item => resultKey(item) === key))
      pending.value = [...pending.value, result];
  }

  function consume(key: string, outsideRefusal = false) {
    if (delivered.has(key)) return false;
    delivered.add(key);
    if (outsideRefusal) outsideRefusals.add(key);
    pending.value = pending.value.filter(item => resultKey(item) !== key);
    return true;
  }

  // The next matching selection invalidation can use the refusal already shown by App.
  function takeOutsideRefusal(key: string) {
    return outsideRefusals.delete(key);
  }

  function registerPresenter(presents: (claimNo: string) => boolean) {
    presenters.add(presents);
    visibilityRevision.value++;
    return () => {
      presenters.delete(presents);
      visibilityRevision.value++;
    };
  }

  return { outsidePage, publish, consume, takeOutsideRefusal, registerPresenter, resultKey, wasDelivered: (key: string) => delivered.has(key) };
});
