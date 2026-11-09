import { computed, ref, watch } from "vue";
import { runPassiveTabRead, invalidatePassiveTabRead, invalidateBeforePassiveTabRead, rememberPassiveTabRead } from "@/lib/passive-tab-read";
import { apiRuntimeConfig, earnConfigApi, remoteApiEnabled, sessionVault } from "@/api/runtime";
import type { EarnPhoneTiers, EarnTaskRoute } from "@/api/earn-config-api";
import { applyCanonicalPhoneTierYields } from "@/mock/phone-tiers";

type EarnConfigStatus = "idle" | "loading" | "ready" | "error";

const phoneTiers = ref<EarnPhoneTiers | null>(null);
const status = ref<EarnConfigStatus>("idle");
const error = ref("");
const route = ref<EarnTaskRoute | null>(null);
const routeError = ref("");
let loadVersion = 0;
let environmentInvalidated = false;
let inFlight: Promise<boolean> | null = null;

function clearEarnConfig() {
  invalidatePassiveTabRead("earn-config");
  loadVersion += 1;
  inFlight = null;
  phoneTiers.value = null;
  route.value = null;
  routeError.value = "";
  status.value = "idle";
  error.value = "";
  if (remoteApiEnabled) applyCanonicalPhoneTierYields([]);
}
watch(() => [apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl], () => {
  environmentInvalidated = true;
  clearEarnConfig();
}, { flush: "sync" });
sessionVault.subscribe?.((_previous, _next, continuation) => { if (!continuation) clearEarnConfig(); });

// The mutable compatibility table is consumed by legacy presentation code.
// Clear its prototype rows immediately in server mode; only a validated
// /api/config/phone-tiers response is allowed to repopulate it.
if (remoteApiEnabled) applyCanonicalPhoneTierYields([]);

export function ensureEarnConfig(): Promise<boolean> {
  return runPassiveTabRead("earn-config", () => inFlight ?? refreshEarnConfig(), undefined,
    () => status.value === "ready", 60_000);
}

export function refreshEarnConfig(): Promise<boolean> {
  invalidateBeforePassiveTabRead("earn-config");
  const promise = readEarnConfig();
  inFlight = promise;
  rememberPassiveTabRead("earn-config", promise, undefined, undefined, () => status.value === "ready");
  const clear = () => { if (inFlight === promise) inFlight = null; };
  void promise.then(clear, clear);
  return promise;
}

async function readEarnConfig(): Promise<boolean> {
  if (!remoteApiEnabled) return true;
  if (environmentInvalidated) return false;
  const version = ++loadVersion;
  status.value = "loading";
  error.value = "";
  try {
    const tiers = await earnConfigApi.phoneTiers();
    if (version !== loadVersion) return false;
    phoneTiers.value = tiers;
    applyCanonicalPhoneTierYields(tiers.tiers);
    status.value = "ready";
    error.value = "";
    return true;
  } catch (cause) {
    if (version !== loadVersion) return false;
    phoneTiers.value = null;
    applyCanonicalPhoneTierYields([]);
    status.value = "error";
    error.value = cause instanceof Error ? cause.message : "E2_CONFIG_UNAVAILABLE";
    return false;
  }
}

async function refreshRoute(deviceVramGb: number): Promise<void> {
  if (!remoteApiEnabled || environmentInvalidated) return;
  const version = loadVersion;
  routeError.value = "";
  try {
    const next = await earnConfigApi.route(deviceVramGb);
    if (version !== loadVersion) return;
    route.value = next;
  } catch (cause) {
    if (version !== loadVersion) return;
    route.value = null;
    routeError.value = cause instanceof Error ? cause.message : "E2_TASK_ROUTE_UNAVAILABLE";
  }
}

export function useEarnConfig() {
  return {
    status: computed(() => status.value),
    error: computed(() => error.value),
    phoneTiers: computed(() => phoneTiers.value),
    route: computed(() => route.value),
    routeError: computed(() => routeError.value),
    refresh: refreshEarnConfig,
    ensure: ensureEarnConfig,
    refreshRoute,
  };
}
