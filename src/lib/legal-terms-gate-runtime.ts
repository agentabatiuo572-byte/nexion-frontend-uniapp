import { navReset } from "@/lib/route";
import { legalTermsApi, remoteApiEnabled, sessionVault } from "@/api/runtime";
import { useLocaleStore } from "@/store/locale";
import { captureRuntimeRevision } from "@/api/order-api";
import {
  buildLegalTermsRoute,
  claimLegalTermsRedirect,
  isLegalTermsGateExemptRoute,
  LEGAL_TERMS_ROUTE,
  PRIVACY_POLICY_ROUTE,
  sameLegalTermsRun,
  isLegalTermsAcknowledged,
  sameLegalTermsSession,
  type LegalTermsSessionFence,
} from "@/lib/legal-terms-gate";

let inFlight: { key: string; promise: Promise<void> } | null = null;
const failedKeys = new Set<string>();
const redirectedKeys = new Set<string>();
const verificationKeys = new Set<string>();
const REDIRECT_RETRY_MS = 5_000;
let lastRedirectAttempt: { key: string; url: string; at: number } | null = null;
let pendingRequirement: {
  key: string;
  version: string;
  reason: "verification" | "acknowledgement";
} | null = null;
const latestGateRouteByKey = new Map<string, string>();

function fence(): LegalTermsSessionFence | null {
  const session = sessionVault.read();
  if (!session?.accessToken) return null;
  return { accessToken: session.accessToken, userId: session.user.userId, sessionRevision: sessionVault.revision() };
}

function sessionKey(value: LegalTermsSessionFence): string {
  return `${value.userId}:${value.accessToken}:${value.sessionRevision ?? 0}`;
}

function rescheduleAfterSessionChange(expected: LegalTermsSessionFence, returnTo: string): Promise<void> {
  const current = fence();
  if (!current
      || current.userId !== expected.userId
      || sameLegalTermsSession(expected, current)) {
    return Promise.resolve();
  }
  return scheduleLegalTermsGate(returnTo);
}

function currentPendingRequirement(): typeof pendingRequirement {
  const current = fence();
  return current && pendingRequirement?.key === sessionKey(current) ? pendingRequirement : null;
}

function beginVerification(key: string): void {
  verificationKeys.add(key);
  uni.showLoading({ title: "", mask: true });
}

function finishVerification(key: string): void {
  if (!verificationKeys.delete(key)) return;
  if (verificationKeys.size === 0) uni.hideLoading();
}

function redirectToRequiredTerms(key: string, returnTo: string): void {
  const url = buildLegalTermsRoute(returnTo);
  const now = Date.now();
  // The App guard polls every second. Keep the obligation active but avoid
  // concurrent reset storms and a fresh platform toast on every guard tick.
  if (lastRedirectAttempt?.key === key && lastRedirectAttempt.url === url
      && now - lastRedirectAttempt.at < REDIRECT_RETRY_MS) return;
  lastRedirectAttempt = { key, url, at: now };
  void navReset(url);
}

/**
 * Report a known obligation without redirecting. Legal-document routes are
 * readable while pending, but they must not restart earnings or order loops.
 */
export function hasPendingLegalTermsRequirement(): boolean {
  if (!remoteApiEnabled) return false;
  return currentPendingRequirement() !== null;
}

/**
 * Re-apply a known unacknowledged requirement synchronously. This closes the
 * browser-history/system-back gap without another network round trip.
 */
export function enforcePendingLegalTermsGate(returnTo: string): boolean {
  if (!remoteApiEnabled) return false;
  const pending = currentPendingRequirement();
  if (!pending) return false;
  const path = `/${returnTo.replace(/^#?\/?/, "").split("?", 1)[0]}`;
  if (path === PRIVACY_POLICY_ROUTE) return false;
  // While current() is unresolved, the masked loading layer blocks input and
  // App treats true as a signal to stop every business loop. Do not flash an
  // already-acknowledged user through the Terms page merely to verify state.
  if (pending.reason === "verification") return true;
  if (isLegalTermsGateExemptRoute(path)) return false;
  redirectToRequiredTerms(pending.key, returnTo);
  return true;
}

/** Clear the current account obligation after an authoritative current snapshot. */
export function recordLegalTermsAcknowledged(snapshot: Parameters<typeof isLegalTermsAcknowledged>[0]): void {
  const current = fence();
  if (!current || !sameLegalTermsRun(snapshot, captureRuntimeRevision().runId)
      || !isLegalTermsAcknowledged(snapshot)) return;
  const key = sessionKey(current);
  finishVerification(key);
  if (pendingRequirement?.key === key) pendingRequirement = null;
  if (lastRedirectAttempt?.key === key) lastRedirectAttempt = null;
  failedKeys.delete(key);
}

/**
 * Check the server's current version after login and on session restore.
 * The request is fenced to the exact in-memory bearer + account; a late
 * response can never redirect a subsequent account. A failed check redirects
 * once to the Terms page and retains a fail-closed in-memory obligation until
 * the server confirms the current account has acknowledged its current terms.
 */
export function scheduleLegalTermsGate(returnTo = "/pages/index/index"): Promise<void> {
  if (!remoteApiEnabled) return Promise.resolve();
  // The Terms page owns its own snapshot/ack flow.  Re-running the global
  // gate while that page is visible loses its query return target because the
  // App route reader intentionally strips query strings.
  const path = `/${returnTo.replace(/^#?\/?/, "").split("?", 1)[0]}`;
  if (path === LEGAL_TERMS_ROUTE) return Promise.resolve();
  const requestFence = fence();
  if (!requestFence) return Promise.resolve();
  const key = sessionKey(requestFence);
  latestGateRouteByKey.set(key, returnTo);
  const publicPrivacyRoute = path === PRIVACY_POLICY_ROUTE;
  // A known obligation is authoritative until acknowledgement succeeds. Do
  // not let browser history or a repeated failed check downgrade it to the
  // non-redirecting verification state or replace its original return target.
  if (pendingRequirement?.key === key
      && pendingRequirement.reason === "acknowledgement") return Promise.resolve();
  if (inFlight?.key === key) {
    if (publicPrivacyRoute) finishVerification(key);
    return inFlight.promise;
  }
  // Every authoritative recheck is fail-closed, including a previously
  // acknowledged session: a newly published version must not gain a network
  // response window in which business activity can continue.
  pendingRequirement = { key, version: "", reason: "verification" };
  if (!publicPrivacyRoute) beginVerification(key);
  const promise = legalTermsApi.current(useLocaleStore().code, "GLOBAL", true)
    .then((snapshot) => {
      if (!sameLegalTermsSession(requestFence, fence())) {
        return rescheduleAfterSessionChange(requestFence, returnTo);
      }
      if (!sameLegalTermsRun(snapshot, captureRuntimeRevision().runId)) return;
      if (!isLegalTermsAcknowledged(snapshot)) {
        finishVerification(key);
        pendingRequirement = { key, version: snapshot.version, reason: "acknowledgement" };
        const currentReturnTo = latestGateRouteByKey.get(key) ?? returnTo;
        const currentPath = `/${currentReturnTo.replace(/^#?\/?/, "").split("?", 1)[0]}`;
        const redirectKey = `${key}:${snapshot.sourceEnvironment}:${snapshot.runId}:${snapshot.version}:${currentReturnTo}`;
        if (currentPath !== PRIVACY_POLICY_ROUTE && claimLegalTermsRedirect(redirectedKeys, redirectKey)) {
          redirectToRequiredTerms(key, currentReturnTo);
        }
      } else {
        recordLegalTermsAcknowledged(snapshot);
      }
    })
    .catch(() => {
      if (!sameLegalTermsSession(requestFence, fence())) {
        return rescheduleAfterSessionChange(requestFence, returnTo);
      }
      if (failedKeys.has(key)) return;
      finishVerification(key);
      pendingRequirement = { key, version: "", reason: "acknowledgement" };
      failedKeys.add(key);
      const currentReturnTo = latestGateRouteByKey.get(key) ?? returnTo;
      const currentPath = `/${currentReturnTo.replace(/^#?\/?/, "").split("?", 1)[0]}`;
      if (currentPath !== PRIVACY_POLICY_ROUTE) redirectToRequiredTerms(key, currentReturnTo);
    })
    .finally(() => {
      finishVerification(key);
      if (inFlight?.key === key) inFlight = null;
      latestGateRouteByKey.delete(key);
    });
  inFlight = { key, promise };
  return promise;
}
