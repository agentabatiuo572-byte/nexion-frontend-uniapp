import { ref } from "vue";
import { accountApi, remoteApiEnabled, sessionVault } from "@/api/runtime";
import type { KycState, SecurityState } from "@/api/contracts";

export type RemoteLoadStatus = "idle" | "loading" | "ready" | "error";

const securityState = ref<SecurityState | null>(null);
const kycState = ref<KycState | null>(null);
const securityStatus = ref<RemoteLoadStatus>("idle");
const kycStatus = ref<RemoteLoadStatus>("idle");
let accountUserId: number | null = null;
let loadVersion = 0;

function resetState(nextUserId: number | null): void {
  loadVersion += 1;
  accountUserId = nextUserId;
  securityState.value = null;
  kycState.value = null;
  securityStatus.value = "idle";
  kycStatus.value = "idle";
}

export function clearRemoteAccountState(): void {
  resetState(null);
}

export async function loadRemoteAccountState(): Promise<void> {
  if (!remoteApiEnabled) return;
  const userId = sessionVault.read()?.user.userId ?? null;
  if (!userId) {
    resetState(null);
    return;
  }
  if (accountUserId !== userId) resetState(userId);
  const version = ++loadVersion;
  securityState.value = null;
  kycState.value = null;
  securityStatus.value = "loading";
  kycStatus.value = "loading";

  await Promise.all([
    accountApi.securityOverview()
      .then((value) => {
        if (version !== loadVersion || accountUserId !== userId) return;
        securityState.value = value;
        securityStatus.value = "ready";
      })
      .catch(() => {
        if (version !== loadVersion || accountUserId !== userId) return;
        securityState.value = null;
        securityStatus.value = "error";
      }),
    accountApi.kycStatus()
      .then((value) => {
        if (version !== loadVersion || accountUserId !== userId) return;
        kycState.value = value;
        kycStatus.value = "ready";
      })
      .catch(() => {
        if (version !== loadVersion || accountUserId !== userId) return;
        kycState.value = null;
        kycStatus.value = "error";
      }),
  ]);
}

export function useRemoteAccountState() {
  return {
    securityState,
    kycState,
    securityStatus,
    kycStatus,
  };
}
