import { defineStore } from "pinia";
import { computed, ref, shallowRef, watch } from "vue";
import { useApp } from "./app";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";

const REFUSALS_KEY = "nexgrid-trial-shown-refusals-v1";
const REFUSAL_LIMIT = 64;

type TrialPurchaseResult =
  | { status: "settled"; claimNo: string; orderNo: string; key?: string }
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
  const openingOrders = new Set<string>();
  const failedOrderNavigations = new Map<string, boolean>();
  const announcedRefusals = new Set<string>();
  const presenters = new Set<(result: TrialPurchaseResult) => boolean>();
  const visibilityRevision = ref(0);
  function savedRefusals() {
    const keys = readAccountRow<{ keys: string[] }>(REFUSALS_KEY, app.accountKey)?.keys;
    return Array.isArray(keys) ? keys.filter(key => typeof key === "string").slice(-REFUSAL_LIMIT) : [];
  }
  const wasDelivered = (key: string) => delivered.has(key)
    || (key.startsWith('["refused",') && savedRefusals().includes(key));
  const outsidePage = computed(() => {
    void visibilityRevision.value;
    return pending.value.filter(result => !openingOrders.has(resultKey(result))
      && failedOrderNavigations.get(resultKey(result)) !== true
      && ![...presenters].some(presents => presents(result)));
  });
  watch(() => app.accountBindingEpoch, () => {
    pending.value = [];
    delivered.clear();
    openingOrders.clear();
    failedOrderNavigations.clear();
    announcedRefusals.clear();
  }, { flush: "sync" });

  function publish(result: TrialPurchaseResult) {
    const key = resultKey(result);
    if (!wasDelivered(key) && !pending.value.some(item => resultKey(item) === key))
      pending.value = [...pending.value, result];
  }

  function consume(key: string, announcedRefusal = false) {
    if (wasDelivered(key)) return false;
    delivered.add(key);
    if (announcedRefusal) announcedRefusals.add(key);
    if (key.startsWith('["refused",'))
      writeAccountRow(REFUSALS_KEY, app.accountKey, { keys: [...savedRefusals(), key].slice(-REFUSAL_LIMIT) });
    pending.value = pending.value.filter(item => resultKey(item) !== key);
    return true;
  }

  function announceOrder(orderNo: string) {
    const key = trialOrderResultKey(orderNo);
    if (failedOrderNavigations.has(key)) {
      // The notification can still be delivered off page. Keep the result available for another navigation attempt.
      failedOrderNavigations.set(key, true);
      visibilityRevision.value++;
    } else consume(key);
  }

  async function deliverOrder(orderNo: string, navigate: () => Promise<boolean>, replay = false) {
    const key = trialOrderResultKey(orderNo);
    if (openingOrders.has(key) || (!replay && delivered.has(key))) return false;
    const epoch = app.accountBindingEpoch;
    openingOrders.add(key);
    visibilityRevision.value++;
    try {
      const opened = await navigate();
      if (app.accountBindingEpoch !== epoch) return false;
      if (!opened) {
        if (!failedOrderNavigations.has(key)) failedOrderNavigations.set(key, false);
        return false;
      }
      failedOrderNavigations.delete(key);
      consume(key);
      return true;
    } finally {
      if (app.accountBindingEpoch === epoch) {
        openingOrders.delete(key);
        visibilityRevision.value++;
      }
    }
  }

  // A selection invalidation can use the same refusal notification already shown.
  function takeAnnouncedRefusal(key: string) {
    return announcedRefusals.delete(key);
  }

  function registerPresenter(presents: (result: TrialPurchaseResult) => boolean) {
    presenters.add(presents);
    visibilityRevision.value++;
    return () => {
      presenters.delete(presents);
      visibilityRevision.value++;
    };
  }

  return { outsidePage, publish, consume, announceOrder, deliverOrder, takeAnnouncedRefusal, registerPresenter, resultKey, wasDelivered };
});
