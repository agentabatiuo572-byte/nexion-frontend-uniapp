import { apiClient, sessionVault } from "@/api/runtime";
import type { SessionSnapshot } from "@/api/session-vault";
import { foregroundReadAllowed } from "@/lib/foreground-read";

const carrierStartedAt = Date.now();
let observedRevision = -1;
let renewAt = Infinity;
let retryAt = 0;
let inFlight: Promise<unknown> | null = null;

function renewalTime(session: SessionSnapshot): number {
  const payload = session.accessToken.split(".")[1];
  if (!payload) return Infinity;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = new Uint8Array(uni.base64ToArrayBuffer(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    const { exp, iat } = JSON.parse(String.fromCharCode(...bytes)) as { exp: number; iat: number };
    if (!Number.isSafeInteger(exp) || !Number.isSafeInteger(iat) || exp <= iat) return Infinity;
    const lifetimeMs = (exp - iat) * 1000;
    const minimumLead = Math.min(30_000, Math.floor(lifetimeMs / 10));
    const spread = Math.min(30 * 60_000, Math.floor(lifetimeMs / 5));
    const key = `${session.user.userId}:${session.installationId || carrierStartedAt}`;
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
    return exp * 1000 - minimumLead - (hash >>> 0) % spread;
  } catch {
    // Expiry is a scheduling hint. Foreground checks and API 401s still use server authority.
    return Infinity;
  }
}

/** The existing foreground guard checks deadlines after suspension or timer delays. */
export function maintainRemoteSession(validate = false): void {
  if (!foregroundReadAllowed()) return;
  const revision = sessionVault.revision();
  if (revision !== observedRevision) {
    const session = sessionVault.read();
    observedRevision = revision;
    renewAt = session?.accessToken ? renewalTime(session) : Infinity;
    retryAt = 0;
    inFlight = null;
  }
  const now = Date.now();
  const renew = now >= renewAt && now >= retryAt;
  if (inFlight || (!renew && !validate) || !sessionVault.read()?.accessToken) return;
  if (renew) retryAt = now + 15_000;
  const request = (renew ? apiClient.refreshSession(revision) : apiClient.request({ path: "/api/app/profile" }))
    .catch(() => { /* The API client applies server rejections. Network failures can be retried. */ })
    .finally(() => { if (inFlight === request) inFlight = null; });
  inFlight = request;
}
