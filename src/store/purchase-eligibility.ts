import { computed, reactive, watch, type Ref } from "vue";
import { isApiRefusal } from "@/api/errors";
import { purchaseEligibilityApi, remoteApiEnabled } from "@/api/runtime";
import type { PurchaseEligibilitySnapshot } from "@/api/purchase-eligibility-api";
import { remoteAccountScope, type RemoteAccountEpoch, type RemoteAccountRequest } from "@/lib/remote-account-epoch";

export type PurchaseEligibilityStatus = "idle" | "loading" | "ready" | "unavailable" | "error";

export interface PurchaseEligibilityState {
  status: PurchaseEligibilityStatus;
  eligible: boolean;
  snapshot: PurchaseEligibilitySnapshot | null;
  error: string;
}

interface PurchaseEligibilityApi {
  get(productNo: string): Promise<PurchaseEligibilitySnapshot>;
}

function normalizeProductNo(productNo: string): string {
  return productNo.trim();
}

function keyFor(accountKey: string, productNo: string): string {
  return `${accountKey}\u0000${productNo}`;
}

/**
 * Account-scoped remote eligibility cache. The cache is deliberately small and
 * in-memory: the server decision is refreshed by each account-bound UI surface,
 * while the request map prevents four product cards plus detail from issuing
 * the same request at once.
 */
export function createPurchaseEligibilityStore(
  api: PurchaseEligibilityApi,
  scope: RemoteAccountEpoch,
) {
  const entries = reactive(new Map<string, PurchaseEligibilityState>());
  const inFlight = new Map<string, Promise<boolean>>();

  function state(productNo: string): PurchaseEligibilityState {
    const normalized = normalizeProductNo(productNo);
    const key = keyFor(scope.accountKey(), normalized);
    let entry = entries.get(key);
    if (!entry) {
      entry = reactive({
        status: "idle",
        eligible: false,
        snapshot: null,
        error: "",
      }) as PurchaseEligibilityState;
      entries.set(key, entry);
    }
    return entry;
  }

  function ensure(productNo: string, force = false): Promise<boolean> {
    const normalized = normalizeProductNo(productNo);
    if (!normalized) return Promise.resolve(false);

    const requestScope: RemoteAccountRequest = scope.snapshot();
    const key = keyFor(requestScope.accountKey, normalized);
    const entry = state(normalized);
    if (!force && (entry.status === "ready" || entry.status === "unavailable")) {
      return Promise.resolve(entry.eligible);
    }
    const existing = inFlight.get(key);
    if (!force && existing) return existing;

    entry.status = "loading";
    entry.eligible = false;
    entry.error = "";
    const request = api.get(normalized)
      .then((snapshot) => {
        if (!scope.isCurrent(requestScope) || inFlight.get(key) !== request) return false;
        entry.status = "ready";
        entry.snapshot = snapshot;
        entry.eligible = snapshot.eligible;
        entry.error = "";
        return snapshot.eligible;
      })
      .catch((error: unknown) => {
        if (!scope.isCurrent(requestScope) || inFlight.get(key) !== request) return false;
        if (isApiRefusal(error, 404, "PRODUCT_NOT_AVAILABLE")) {
          entry.snapshot = null;
          entry.status = "unavailable";
          return false;
        }
        entry.status = "error";
        entry.eligible = false;
        entry.error = error instanceof Error ? error.message : "PURCHASE_ELIGIBILITY_UNAVAILABLE";
        return false;
      })
      .finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      });
    inFlight.set(key, request);
    return request;
  }

  function clear(): void {
    entries.clear();
    inFlight.clear();
  }

  return { state, ensure, clear };
}

export const purchaseEligibilityStore = createPurchaseEligibilityStore(
  purchaseEligibilityApi,
  remoteAccountScope,
);

/**
 * UI adapter used by cards, detail and quota. In mock mode it stays idle and never
 * triggers a request; callers continue to use their local demo gate there.
 * Detail reads immediately; catalog cards supply their actual visibility.
 */
export function useRemotePurchaseEligibility(
  productNo: Ref<string> | (() => string),
  active: Ref<boolean> | (() => boolean) = () => true,
) {
  return bindPurchaseEligibility(productNo, purchaseEligibilityStore, remoteApiEnabled, active);
}

export function bindPurchaseEligibility(
  productNo: Ref<string> | (() => string),
  store: ReturnType<typeof createPurchaseEligibilityStore>,
  enabled: boolean,
  active: Ref<boolean> | (() => boolean) = () => true,
) {
  const product = computed(() => typeof productNo === "function" ? productNo() : productNo.value);
  const eligibility = computed(() => {
    const entry = store.state(product.value);
    const status = entry.status;
    // Keep the actionable snapshot fresh. The conditions page can retain the
    // presentation for this account and SKU while a fresh decision is pending.
    return {
      ...entry,
      status: status === "unavailable" ? "error" as const : status,
      error: status === "unavailable" ? "PRODUCT_NOT_AVAILABLE" : entry.error,
      unavailable: status === "unavailable",
      snapshot: status === "ready" ? entry.snapshot : null,
      displaySnapshot: entry.snapshot,
    };
  });
  const readActive = computed(() => typeof active === "function" ? active() : active.value);

  // `watch` is intentionally kept out of the store so a shared cache does not
  // acquire component lifecycle ownership. An account rebind clears the Map;
  // mounted pages must reload its new idle entry even if the SKU is unchanged.
  // Errors wait for an explicit retry, so persistent failures cannot poll.
  watch([product, () => eligibility.value.status, readActive], ([value, status, visible]) => {
    if (enabled && visible && value && status === "idle") void store.ensure(value);
  }, { immediate: true });

  function retry(): Promise<boolean> {
    return enabled ? store.ensure(product.value, true) : Promise.resolve(false);
  }

  return { eligibility, retry };
}
