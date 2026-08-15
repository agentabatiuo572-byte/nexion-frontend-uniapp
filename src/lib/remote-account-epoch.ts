export interface RemoteAccountRequest {
  accountKey: string;
  epoch: number;
}

export interface RemoteAccountEpoch {
  bind(accountKey: string): number;
  snapshot(): RemoteAccountRequest;
  isCurrent(request: RemoteAccountRequest): boolean;
  accountKey(): string;
}

/**
 * Account-scoped remote request fence. A bind always advances the epoch,
 * including a rebind to the same account, so every prior response becomes
 * stale before the next account snapshot is requested.
 */
export function createRemoteAccountEpoch(initialAccountKey = "default"): RemoteAccountEpoch {
  let currentAccountKey = initialAccountKey;
  let epoch = 0;

  return {
    bind(accountKey: string): number {
      currentAccountKey = accountKey;
      epoch += 1;
      return epoch;
    },
    snapshot(): RemoteAccountRequest {
      return { accountKey: currentAccountKey, epoch };
    },
    isCurrent(request: RemoteAccountRequest): boolean {
      return request.epoch === epoch && request.accountKey === currentAccountKey;
    },
    accountKey(): string {
      return currentAccountKey;
    },
  };
}
