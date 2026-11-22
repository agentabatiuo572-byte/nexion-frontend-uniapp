import { invalidateBeforePassiveTabRead, invalidatePassiveTabRead, rememberPassiveTabRead, runPassiveTabRead } from "@/lib/passive-tab-read";
import { isTransientReadFailure } from "@/lib/remote-read-failure";
import { reactive } from "vue";
import { productPhaseApi, remoteApiEnabled } from "@/api/runtime";
import type { PhaseId } from "./product-phase";

export type ServerProductPhaseStatus = "loading" | "ready" | "error";

export const serverProductPhaseState = reactive<{
  status: ServerProductPhaseStatus;
  phase: PhaseId | null;
  source: string;
  error: string;
  retryableError: boolean;
}>({
  status: remoteApiEnabled ? "loading" : "ready",
  phase: null,
  source: remoteApiEnabled ? "" : "local-account-age",
  error: "",
  retryableError: false,
});

let refreshInFlight: Promise<boolean> | null = null;
let phaseEpoch = 0;

export function prepareServerProductPhase(): void {
  if (!remoteApiEnabled) return;
  invalidatePassiveTabRead("product-phase");
  phaseEpoch += 1;
  refreshInFlight = null;
  serverProductPhaseState.status = "loading";
  serverProductPhaseState.phase = null;
  serverProductPhaseState.source = "";
  serverProductPhaseState.error = "";
  serverProductPhaseState.retryableError = false;
}

export function ensureServerProductPhase(): Promise<boolean> {
  if (serverProductPhaseState.retryableError) return refreshInFlight ?? Promise.resolve(false);
  return runPassiveTabRead("product-phase", () => refreshServerProductPhase(true), undefined, undefined, 30_000);
}

export function refreshServerProductPhase(force = false): Promise<boolean> {
  if (!remoteApiEnabled) return Promise.resolve(true);
  if (!force && serverProductPhaseState.status === "ready" && serverProductPhaseState.phase) {
    return Promise.resolve(true);
  }
  if (refreshInFlight) return refreshInFlight;
  invalidateBeforePassiveTabRead("product-phase");

  serverProductPhaseState.status = "loading";
  serverProductPhaseState.error = "";
  const requestEpoch = phaseEpoch;
  const request = productPhaseApi.current()
    .then((snapshot) => {
      if (requestEpoch !== phaseEpoch) return false;
      serverProductPhaseState.phase = snapshot.phase;
      serverProductPhaseState.source = snapshot.source;
      serverProductPhaseState.status = "ready";
      serverProductPhaseState.retryableError = false;
      return true;
    })
    .catch((error: unknown) => {
      if (requestEpoch !== phaseEpoch) return false;
      serverProductPhaseState.phase = null;
      serverProductPhaseState.source = "";
      serverProductPhaseState.status = "error";
      serverProductPhaseState.error = error instanceof Error ? error.message : "PRODUCT_PHASE_UNAVAILABLE";
      serverProductPhaseState.retryableError = isTransientReadFailure(error);
      return false;
    })
    .finally(() => {
      if (refreshInFlight === request) refreshInFlight = null;
    });
  refreshInFlight = request;
  return rememberPassiveTabRead("product-phase", request);
}
