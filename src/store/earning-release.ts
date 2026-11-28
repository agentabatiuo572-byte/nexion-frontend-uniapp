import { captureTabSnapshotWrite, saveTabSnapshot, invalidateTabSnapshots } from "@/lib/tab-first-screen-snapshot";
import { isTransientReadFailure } from "@/lib/remote-read-failure";
import { earningsReleaseApi, sessionVault } from "@/api/runtime";
import type { EarningsReleaseStatus } from "@/api/earnings-release-api";
import type { RiskClusterSummary } from "@/store/risk-cluster";
import { shallowRef } from "vue";
import { passiveTabReadScope } from "@/lib/passive-tab-read";
import { createPassiveReadWindow } from "@/lib/passive-read-window";

export type LedgerRoute = "pending_review" | "bonus_locked";
export type ReleaseSource = "attest" | "manual";
export interface EarningLedgerEntry { id: string; accountKey: string; clusterId: string; route: LedgerRoute; usdt: number; nex: number; bucketedAt: number; }
export interface ReleaseOutcome {
  releasedPendingUsdt: number; releasedPendingNex: number;
  releasedLockedUsdt: number; releasedLockedNex: number;
  escalatedUsdt: number; escalatedNex: number; releasedBy: ReleaseSource | null;
}

export const earningsReleaseSnapshot = shallowRef<EarningsReleaseStatus | null>(null);
// The withdrawal page can keep displaying this through a transient read failure.
export const earningsReleaseDisplaySnapshot = shallowRef<EarningsReleaseStatus | null>(null);
export const earningsReleaseStatus = shallowRef<"idle" | "loading" | "ready" | "error">("idle");
export const earningsReleaseHasSnapshot = shallowRef(false);
let activeEarningsReleaseAccountKey = "default";
let earningsReleaseRefreshSequence = 0;
let earningsReleasePending: { owner: string; promise: Promise<EarningsReleaseStatus> } | null = null;
const releaseResource = "earning-release";
const releaseReadIntervalMs = 30_000;
const releaseReadWindow = createPassiveReadWindow();
// Profile locale hydration can finish between startup and page entry. Release
// status is locale-independent, so both callers keep the same read scope.
const releaseReadScope = () => passiveTabReadScope(true, false);

export function bindEarningsReleaseAccount(accountKey: string): void {
  releaseReadWindow.invalidate(releaseResource);
  activeEarningsReleaseAccountKey = accountKey || "default";
  earningsReleaseRefreshSequence += 1;
  earningsReleaseSnapshot.value = null;
  earningsReleaseDisplaySnapshot.value = null;
  earningsReleaseHasSnapshot.value = false;
  earningsReleaseStatus.value = "idle";
}

const hasEarningsReleaseSnapshot = () => earningsReleaseStatus.value === "ready" && earningsReleaseHasSnapshot.value;

export async function ensureEarningsReleaseStatus(
  accountKey = activeEarningsReleaseAccountKey,
): Promise<EarningsReleaseStatus | undefined> {
  const session = sessionVault.read();
  if (!session?.accessToken || accountKey !== `user:${session.user.userId}`
    || accountKey !== activeEarningsReleaseAccountKey) return;
  return releaseReadWindow.run(releaseReadScope(), releaseResource, () => refreshEarningsReleaseStatus(accountKey),
    undefined, hasEarningsReleaseSnapshot, releaseReadIntervalMs, releaseReadIntervalMs);
}

export function refreshEarningsReleaseStatus(
  requestedAccountKey = activeEarningsReleaseAccountKey,
): Promise<EarningsReleaseStatus> {
  // A caller that already belongs to an older account generation must not
  // advance the current request sequence or put the current account into a
  // loading state. Its request has no financial authority here.
  if (activeEarningsReleaseAccountKey !== requestedAccountKey) {
    return Promise.reject(new Error("EARNINGS_RELEASE_ACCOUNT_CHANGED"));
  }
  const readScope = releaseReadScope();
  const snapshotWrite = captureTabSnapshotWrite();
  const owner = JSON.stringify([requestedAccountKey, earningsReleaseRefreshSequence, readScope]);
  if (earningsReleasePending?.owner === owner) return earningsReleasePending.promise;
  releaseReadWindow.invalidate(releaseResource, true);
  const refreshSequence = ++earningsReleaseRefreshSequence;
  const promise = Promise.resolve().then(async () => {
    if (activeEarningsReleaseAccountKey !== requestedAccountKey || refreshSequence !== earningsReleaseRefreshSequence
      || readScope !== releaseReadScope()) throw new Error("EARNINGS_RELEASE_ACCOUNT_CHANGED");
    earningsReleaseStatus.value = "loading";
    try {
      const status = await earningsReleaseApi.status();
      // A response from an account that signed out or switched while the request
      // was in flight must never become the next account's financial truth.
      if (activeEarningsReleaseAccountKey !== requestedAccountKey
        || refreshSequence !== earningsReleaseRefreshSequence || readScope !== releaseReadScope()) return status;
      earningsReleaseSnapshot.value = status;
      earningsReleaseDisplaySnapshot.value = status;
      earningsReleaseHasSnapshot.value = true;
      earningsReleaseStatus.value = "ready";
      saveTabSnapshot(snapshotWrite, "release", { pending: status.buckets.pending_review, locked: status.buckets.bonus_locked }, null);
      return status;
    } catch (error) {
      if (activeEarningsReleaseAccountKey === requestedAccountKey
        && refreshSequence === earningsReleaseRefreshSequence && readScope === releaseReadScope()) {
        // Clear the current result for direct consumers. Only transient failures
        // preserve the separate display copy.
        if (!isTransientReadFailure(error)) {
          earningsReleaseDisplaySnapshot.value = null;
          invalidateTabSnapshots(["release"], snapshotWrite);
        }
        earningsReleaseSnapshot.value = null;
        earningsReleaseHasSnapshot.value = false;
        earningsReleaseStatus.value = "error";
      }
      throw error;
    }
  }).finally(() => { if (earningsReleasePending?.promise === promise) earningsReleasePending = null; });
  earningsReleasePending = { owner: JSON.stringify([requestedAccountKey, refreshSequence, readScope]), promise };
  return releaseReadWindow.remember(readScope, releaseResource, promise, undefined, undefined, hasEarningsReleaseSnapshot);
}
export function currentEarningsReleaseStatus(): EarningsReleaseStatus | null { return earningsReleaseSnapshot.value; }
const zero = (): ReleaseOutcome => ({ releasedPendingUsdt: 0, releasedPendingNex: 0, releasedLockedUsdt: 0, releasedLockedNex: 0, escalatedUsdt: 0, escalatedNex: 0, releasedBy: null });
export function hasReleaseEffect(_outcome?: ReleaseOutcome): boolean { return false; }
/** Client reward producers are disabled: only the backend credit facade may create entries. */
export function appendLedgerEntry(..._ignored: unknown[]): boolean { return false; }
/** Historical call compatibility only; this client cannot release funds. */
export function evaluateAttestRelease(_accountKey: string, _cluster: RiskClusterSummary): ReleaseOutcome { return zero(); }
export function _devGrantManualRelease(..._ignored: unknown[]): ReleaseOutcome { return zero(); }
export function listLedgerEntries(..._ignored: unknown[]): EarningLedgerEntry[] { return []; }
