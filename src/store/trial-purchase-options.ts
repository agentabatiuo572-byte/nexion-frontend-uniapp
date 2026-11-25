import { defineStore } from "pinia";
import { computed, ref, shallowReactive, watch } from "vue";
import type { TrialPurchaseOption } from "@/api/trial-api";
import { remoteApiEnabled, trialApi } from "@/api/runtime";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";
import { useApp } from "./app";
import { useFreeTrial } from "./free-trial";

const PRESELECTIONS_KEY = "nexgrid-trial-purchase-preselection-accounts-v1";
interface ClaimPreselection { productNo: string | null; hasOtherDevices: boolean }
interface Preselections { byClaim: Record<string, string | ClaimPreselection> }

interface ClaimOptions {
  status: "idle" | "unsupported" | "not-convertible" | "loading" | "ready" | "failed";
  options: TrialPurchaseOption[];
  serverNow: number | null;
  selectedProductNo: string | null;
  invalidatedProductNo: string | null;
}

const EMPTY: ClaimOptions = {
  status: "idle", options: [], serverNow: null, selectedProductNo: null, invalidatedProductNo: null,
};

export const useTrialPurchaseOptions = defineStore("trial-purchase-options", () => {
  const app = useApp();
  const claimNo = ref<string | null>(null);
  const scopeKey = computed(() => claimNo.value === null ? null : keyFor(app.accountKey, claimNo.value));
  const claims = shallowReactive(new Map<string, ClaimOptions>());
  const preselected = shallowReactive(new Map<string, string>());
  const requests = new Map<string, Promise<void>>();
  const current = computed(() => scopeKey.value === null ? EMPTY : claims.get(scopeKey.value) ?? EMPTY);
  const selectedOption = computed(() =>
    current.value.options.find(option => option.productNo === current.value.selectedProductNo) ?? null);

  function keyFor(accountKey: string, claim: string) {
    return JSON.stringify([accountKey, claim]);
  }

  watch(() => app.accountBindingEpoch, () => {
    claimNo.value = null;
    requests.clear();
    claims.clear();
    preselected.clear();
  }, { flush: "sync" });

  function readPreselection(accountKey: string, claim: string): ClaimPreselection {
    const saved = readAccountRow<Preselections>(PRESELECTIONS_KEY, accountKey)?.byClaim?.[claim];
    if (typeof saved === "string") return { productNo: saved, hasOtherDevices: false };
    return { productNo: typeof saved?.productNo === "string" ? saved.productNo : null, hasOtherDevices: saved?.hasOtherDevices === true };
  }

  function remember(accountKey: string, claim: string, productNo: string | null, hasOtherDevices?: boolean) {
    const saved = readAccountRow<Preselections>(PRESELECTIONS_KEY, accountKey);
    const byClaim = { ...saved?.byClaim };
    const next = { productNo, hasOtherDevices: hasOtherDevices ?? readPreselection(accountKey, claim).hasOtherDevices };
    if (!next.productNo && !next.hasOtherDevices) delete byClaim[claim];
    else byClaim[claim] = next;
    writeAccountRow<Preselections>(PRESELECTIONS_KEY, accountKey, { byClaim });
  }

  const remembered = computed(() => {
    const claim = claimNo.value, key = scopeKey.value;
    if (!claim || !key) return { productNo: null, hasOtherDevices: false };
    const view = current.value;
    const saved = readPreselection(app.accountKey, claim);
    return { ...saved, productNo: preselected.get(key) ?? view.selectedProductNo ?? saved.productNo };
  });

  /** Only the active authoritative claim needs a scope. An explicit entry target takes precedence. */
  function bindClaim(claim: string | null, entryProductNo?: string) {
    claimNo.value = claim;
    const key = scopeKey.value;
    if (key === null || !entryProductNo) return;
    preselected.set(key, entryProductNo);
    claims.set(key, { ...current.value, selectedProductNo: null, invalidatedProductNo: null });
  }

  function select(productNo: string): boolean {
    const key = scopeKey.value;
    const view = current.value;
    if (key === null || claimNo.value === null || view.status !== "ready"
        || !view.options.some(option => option.productNo === productNo && option.canBuy)) return false;
    preselected.delete(key);
    claims.set(key, { ...view, selectedProductNo: productNo, invalidatedProductNo: null });
    remember(app.accountKey, claimNo.value, productNo);
    return true;
  }

  function invalidateSelection(productNo: string) {
    const key = scopeKey.value;
    if (key === null || claimNo.value === null) return;
    preselected.delete(key);
    claims.set(key, { ...current.value, selectedProductNo: null, invalidatedProductNo: productNo });
    remember(app.accountKey, claimNo.value, null);
  }

  /** Share a read per claim across the detail, checkout and catalog entry points. */
  function refresh(): Promise<void> {
    const key = scopeKey.value;
    const claim = claimNo.value;
    if (key === null || claim === null) return Promise.resolve();
    const inFlight = requests.get(key);
    if (inFlight) return inFlight;
    const accountKey = app.accountKey;
    const accountEpoch = app.accountBindingEpoch;
    const sameAccount = () => accountEpoch === app.accountBindingEpoch && accountKey === app.accountKey;

    const request = Promise.resolve().then(async () => {
      try {
        if (!sameAccount()) return;
        const result = remoteApiEnabled ? await trialApi.purchaseOptions() : { status: "unsupported" } as const;
        if (!sameAccount()) return;
        if (result.status === "unsupported") {
          claims.set(key, { ...EMPTY, status: "unsupported" });
          return;
        }
        if (result.status === "not-convertible") {
          claims.set(key, { ...EMPTY, status: "not-convertible" });
          await useFreeTrial().refreshRemote(true);
          return;
        }
        if (result.claimNo !== claim) throw new Error("TRIAL_PURCHASE_OPTIONS_CLAIM_MISMATCH");
        const view = claims.get(key) ?? EMPTY;
        const entryProduct = preselected.get(key);
        preselected.delete(key);
        const saved = readPreselection(accountKey, claim).productNo;
        const requested = entryProduct ?? view.selectedProductNo ?? saved;
        const options = [...result.options].sort((a, b) =>
          Number(b.isTrialProduct) - Number(a.isTrialProduct) || (a.priceUSD ?? Infinity) - (b.priceUSD ?? Infinity));
        let invalidatedProductNo = view.invalidatedProductNo;
        let selectedProductNo: string | null = null;
        if (requested) {
          const option = options.find(item => item.productNo === requested);
          if (option?.canBuy || trialOptionReadFailed(option)) {
            selectedProductNo = requested;
          } else {
            invalidatedProductNo = requested;
          }
        } else if (!invalidatedProductNo) {
          selectedProductNo = options.find(option => option.canBuy)?.productNo ?? null;
        }
        remember(accountKey, claim, requested ? selectedProductNo : saved, options.some(option => !option.isTrialProduct));
        claims.set(key, { status: "ready", options, serverNow: result.serverNow, selectedProductNo, invalidatedProductNo });
      } catch (cause) {
        if (sameAccount()) claims.set(key, { ...(claims.get(key) ?? EMPTY), status: "failed" });
        throw cause;
      }
    }).finally(() => {
      if (requests.get(key) === request) requests.delete(key);
    });
    requests.set(key, request);
    claims.set(key, { ...current.value, status: "loading" });
    return request;
  }

  return { claimNo, current, selectedOption, remembered, bindClaim, select, invalidateSelection, refresh };
});

export function trialOptionReadFailed(option?: TrialPurchaseOption): boolean {
  return option?.reasonCode === "TRIAL_PRODUCT_QUOTE_UNAVAILABLE";
}
