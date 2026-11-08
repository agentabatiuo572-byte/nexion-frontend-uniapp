import { asApiError, ApiError } from "@/api/errors";
import type { ApiRuntimeConfig } from "@/api/runtime-config";

export type WithdrawalTrackingReadStatus = "waiting" | "loading" | "ready" | "error" | "not-found";

export interface WithdrawalTrackingReadScope {
  withdrawalNo: string;
  accountKey: string;
  accountBindingEpoch: number;
  /** Advances whenever the in-memory bearer session is replaced or cleared. */
  sessionRevision: number;
  apiOrigin: ApiRuntimeConfig;
  pageEpoch: number;
}

interface WithdrawalTrackingReadOptions<T extends { withdrawalNo: string }> {
  read(withdrawalNo: string): Promise<T>;
  currentScope(): WithdrawalTrackingReadScope | null;
  apply(result: T): void;
  setStatus(status: WithdrawalTrackingReadStatus): void;
  /** Injectable solely for deterministic cold-session tests. */
  wait?(milliseconds: number): Promise<void>;
  waitAttempts?: number;
  waitMilliseconds?: number;
}

const DEFAULT_WAIT_ATTEMPTS = 12;
const DEFAULT_WAIT_MILLISECONDS = 500;

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * The page's first exact result is useful while the list has not caught up.
 * Once the store replaces that row after a later authoritative list/poll
 * update, prefer the newer store row instead of pinning this page to its old
 * exact-read status.
 */
export function resolveTrackedWithdrawal<T>(
  exact: T | null,
  currentStoreRow: T | null,
  storeRowAtExactRead: T | null,
): T | null {
  if (!exact) return currentStoreRow;
  return currentStoreRow !== null && currentStoreRow !== storeRowAtExactRead
    ? currentStoreRow
    : exact;
}

/**
 * Owns one page's exact, read-only withdrawal lookup. A result may only update
 * the page that requested it while the same authenticated account and page
 * generation remain active.
 */
export function createWithdrawalTrackingRead<T extends { withdrawalNo: string }>(
  options: WithdrawalTrackingReadOptions<T>,
) {
  let requestEpoch = 0;
  // The recovery lock is request-owned. An invalidated older request may
  // finish after a newer one has started; it must never unlock that newer
  // recovery chain.
  let automaticScopeRecovery: { sourceRequest: number; recoveryRequest: number | null } | null = null;

  function isCurrent(scope: WithdrawalTrackingReadScope, request: number): boolean {
    const active = options.currentScope();
    return request === requestEpoch
      && active?.withdrawalNo === scope.withdrawalNo
      && active.accountKey === scope.accountKey
      && active.accountBindingEpoch === scope.accountBindingEpoch
      && active.sessionRevision === scope.sessionRevision
      && active.apiOrigin.environment === scope.apiOrigin.environment
      && active.apiOrigin.baseUrl === scope.apiOrigin.baseUrl
      && active.pageEpoch === scope.pageEpoch;
  }

  async function refresh(quiet = false, automaticScopeRetry = false): Promise<void> {
    const request = ++requestEpoch;
    if (automaticScopeRetry && automaticScopeRecovery?.recoveryRequest === null) {
      automaticScopeRecovery.recoveryRequest = request;
    }
    const wait = options.wait ?? pause;
    const attempts = Math.max(0, options.waitAttempts ?? DEFAULT_WAIT_ATTEMPTS);
    const milliseconds = Math.max(0, options.waitMilliseconds ?? DEFAULT_WAIT_MILLISECONDS);
    let scope: WithdrawalTrackingReadScope | null = null;
    let retryForChangedScope = false;
    try {
      for (let attempt = 0; attempt <= attempts; attempt += 1) {
        if (request !== requestEpoch) return;
        scope = options.currentScope();
        if (scope) break;
        if (quiet) return;
        if (attempt === attempts) {
          options.setStatus("error");
          return;
        }
        options.setStatus("waiting");
        await wait(milliseconds);
      }
      if (!scope || request !== requestEpoch) return;

      if (!quiet) options.setStatus("loading");
      try {
        const result = await options.read(scope.withdrawalNo);
        if (!isCurrent(scope, request)) {
          retryForChangedScope = !quiet && request === requestEpoch && options.currentScope() !== null;
          return;
        }
        if (result.withdrawalNo !== scope.withdrawalNo) {
          throw new ApiError({ kind: "protocol", message: "WITHDRAWAL_RESPONSE_INVALID" });
        }
        options.apply(result);
        options.setStatus("ready");
      } catch (error) {
        if (!isCurrent(scope, request)) {
          retryForChangedScope = !quiet && request === requestEpoch && options.currentScope() !== null;
          return;
        }
        if (asApiError(error).status === 404) options.setStatus("not-found");
        else if (!quiet) options.setStatus("error");
      }
    } finally {
      // sessionVault.revision() is intentionally non-reactive. If a bearer is
      // replaced while this request is outstanding, re-evaluate the live
      // visible scope after this request settles. A hidden page returns
      // null and therefore never starts background reads.
      const ownsAutomaticRecovery = automaticScopeRecovery?.recoveryRequest === request;
      if (retryForChangedScope && options.currentScope() !== null && automaticScopeRecovery === null) {
        automaticScopeRecovery = { sourceRequest: request, recoveryRequest: null };
        void refresh(false, true);
      } else if (retryForChangedScope && ownsAutomaticRecovery) {
        // One request may recover a non-reactive bearer revision. If it changes
        // again before that recovery settles, stop rather than chasing an
        // unstable session forever; the visible page exposes its normal retry.
        automaticScopeRecovery = null;
        options.setStatus("error");
      } else if (ownsAutomaticRecovery || automaticScopeRecovery?.sourceRequest === request) {
        automaticScopeRecovery = null;
      }
    }
  }

  function invalidate(): void {
    requestEpoch += 1;
    automaticScopeRecovery = null;
  }

  return { refresh, invalidate };
}
