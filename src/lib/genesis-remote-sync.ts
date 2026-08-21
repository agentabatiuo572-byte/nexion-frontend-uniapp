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
  applyPublicState(state: GenesisPublicState): void;
  applyAccount(state: GenesisAccountState): void;
  applyEligibility(eligibility: GenesisEligibility): void;
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
    if (scope.isCurrent()) scope.clear();
    return false;
  }

  // Public state can be unavailable or on a different rollout schema while
  // account facts remain canonical. Keep the rejection local to this read.
  const publicState = api.state().catch(() => null);

  let accountState: GenesisAccountState;
  let eligibility: GenesisEligibility;
  try {
    [accountState, eligibility] = await Promise.all([api.account(), api.eligibility()]);
  } catch {
    if (scope.isCurrent()) scope.clear();
    return false;
  }

  if (!scope.isCurrent() || !scope.hasAuthority()) {
    if (scope.isCurrent()) scope.clear();
    return false;
  }
  scope.applyAccount(accountState);
  scope.applyEligibility(eligibility);

  const nextPublicState = await publicState;
  if (!scope.isCurrent() || !scope.hasAuthority()) {
    if (scope.isCurrent()) scope.clear();
    return false;
  }
  if (nextPublicState) scope.applyPublicState(nextPublicState);
  return true;
}
