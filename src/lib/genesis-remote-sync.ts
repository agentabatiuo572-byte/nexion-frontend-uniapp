import type {
  GenesisAccountState,
  GenesisEligibility,
  GenesisPublicState,
} from "@/api/genesis-api";

export interface GenesisRemoteReadApi {
  state(): Promise<GenesisPublicState>;
  account(): Promise<GenesisAccountState>;
  eligibility(): Promise<GenesisEligibility>;
}

export interface GenesisRemoteReadScope {
  hasAuthority(): boolean;
  isCurrent(): boolean;
  clear(): void;
  clearAccount(): void;
  applyEligibilityError?(reason: GenesisEligibilityReadError): void;
  applyPublicState(state: GenesisPublicState): void;
  applyAccount(state: GenesisAccountState): void;
  applyEligibility(eligibility: GenesisEligibility): void;
}

export type GenesisEligibilityReadError = "GENESIS_ELIGIBILITY_UNAVAILABLE";

function eligibilityReadError(..._errors: unknown[]): GenesisEligibilityReadError {
  return "GENESIS_ELIGIBILITY_UNAVAILABLE";
}

/**
 * Read Genesis projections without making the public market snapshot a
 * prerequisite for account-scoped holder facts. The public state is a
 * separate capability (sale/market controls); a schema/transport failure in
 * that capability must not erase a valid account + eligibility projection.
 *
 * Account and RunID fences remain checked immediately before committing any
 * result. A wrong account is rejected before issuing a protected request, and
 * a stale response is never written into the active store.
 */
export async function readGenesisRemoteFacts(
  api: GenesisRemoteReadApi,
  scope: GenesisRemoteReadScope,
): Promise<boolean> {
  if (!scope.hasAuthority()) {
    // Supply, sale and market state are intentionally public. Anonymous users
    // may read those facts, but protected account/eligibility endpoints must
    // remain untouched and any prior account projection must be removed.
    const publicState = await api.state().catch(() => null);
    if (!scope.isCurrent()) return false;
    if (!publicState) {
      scope.clear();
      return false;
    }
    scope.clearAccount();
    scope.applyPublicState(publicState);
    return true;
  }

  // Public and protected projections are independent capabilities. A fresh
  // account can temporarily lack its holder projection, but that must not
  // erase canonical public supply and make a live sale look sold out.
  const [publicResult, accountResult, eligibilityResult] = await Promise.allSettled([
    api.state(),
    api.account(),
    api.eligibility(),
  ]);

  if (!scope.isCurrent() || !scope.hasAuthority()) {
    if (scope.isCurrent()) scope.clear();
    return false;
  }
  const publicAvailable = publicResult.status === "fulfilled";
  const accountAvailable = accountResult.status === "fulfilled"
    && eligibilityResult.status === "fulfilled";
  if (!publicAvailable && !accountAvailable) {
    scope.clear();
    return false;
  }
  // Commit the public control plane first, then let an authenticated account
  // projection overlay only its explicitly scoped facts. This keeps a
  // just-confirmed purchase visible without changing public supply ownership.
  if (publicAvailable) scope.applyPublicState(publicResult.value);
  if (accountAvailable) {
    scope.applyAccount(accountResult.value);
    scope.applyEligibility(eligibilityResult.value);
  } else {
    const protectedReadError = eligibilityReadError(
      accountResult.status === "rejected" ? accountResult.reason : null,
      eligibilityResult.status === "rejected" ? eligibilityResult.reason : null,
    );
    console.warn("GENESIS_PROTECTED_READ_UNAVAILABLE", {
      reason: protectedReadError,
      accountAvailable: accountResult.status === "fulfilled",
      eligibilityAvailable: eligibilityResult.status === "fulfilled",
    });
    scope.clearAccount();
    scope.applyEligibilityError?.(protectedReadError);
  }
  return true;
}
