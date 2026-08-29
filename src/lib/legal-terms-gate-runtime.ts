import { legalTermsApi, remoteApiEnabled, sessionVault } from "@/api/runtime";
import { useLocaleStore } from "@/store/locale";
import { captureRuntimeRevision } from "@/api/order-api";
import {
  buildLegalTermsRoute,
  claimLegalTermsRedirect,
  LEGAL_TERMS_ROUTE,
  sameLegalTermsRun,
  isLegalTermsAcknowledged,
  sameLegalTermsSession,
  type LegalTermsSessionFence,
} from "@/lib/legal-terms-gate";

let inFlight: { key: string; promise: Promise<void> } | null = null;
const failedKeys = new Set<string>();
const redirectedKeys = new Set<string>();

function fence(): LegalTermsSessionFence | null {
  const session = sessionVault.read();
  if (!session?.accessToken) return null;
  const revision = captureRuntimeRevision();
  return { accessToken: session.accessToken, userId: session.user.userId, runEpoch: revision.epoch };
}

/**
 * Check the server's current version after login and on session restore.
 * The request is fenced to the exact in-memory bearer + account; a late
 * response can never redirect a subsequent account. A failed check redirects
 * once to the Terms page so the error is visible, while the page remains
 * escapable and retryable after the session changes.
 */
export function scheduleLegalTermsGate(returnTo = "/pages/index/index"): void {
  if (!remoteApiEnabled) return;
  // The Terms page owns its own snapshot/ack flow.  Re-running the global
  // gate while that page is visible loses its query return target because the
  // App route reader intentionally strips query strings.
  if (returnTo.split("?", 1)[0] === LEGAL_TERMS_ROUTE) return;
  const requestFence = fence();
  if (!requestFence) return;
  const key = `${requestFence.userId}:${requestFence.accessToken}`;
  if (inFlight?.key === key) return;
  const promise = legalTermsApi.current(useLocaleStore().code, "GLOBAL", true)
    .then((snapshot) => {
      if (!sameLegalTermsSession(requestFence, fence())) return;
      if (!sameLegalTermsRun(snapshot, captureRuntimeRevision().runId)) return;
      if (!isLegalTermsAcknowledged(snapshot)) {
        const redirectKey = `${key}:${snapshot.sourceEnvironment}:${snapshot.runId}:${snapshot.version}:${returnTo}`;
        if (claimLegalTermsRedirect(redirectedKeys, redirectKey)) {
          uni.reLaunch({ url: buildLegalTermsRoute(returnTo), fail: () => {} });
        }
      }
    })
    .catch(() => {
      if (!sameLegalTermsSession(requestFence, fence()) || failedKeys.has(key)) return;
      failedKeys.add(key);
      uni.reLaunch({ url: buildLegalTermsRoute(returnTo), fail: () => {} });
    })
    .finally(() => {
      if (inFlight?.key === key) inFlight = null;
    });
  inFlight = { key, promise };
}
