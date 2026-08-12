/**
 * Durable idempotency intent registry for external-funds mutations.
 *
 * This storage contains command metadata only. Wallet balances, orders and
 * ledger entries remain server-authoritative and must never be hydrated from
 * this registry. A key is deterministic for account + environment + method +
 * payload fingerprint + generation, so a response-lost retry (including after
 * reload, or from another tab) cannot mint a second funds command.
 */
export type FundsMutationEnvironment = "SANDBOX";

export interface FundsMutationIdentity {
  accountKey: string;
  environment: FundsMutationEnvironment;
  method: string;
  fingerprint: string;
}

interface PendingFundsMutation extends FundsMutationIdentity {
  key: string;
  orderNo?: string;
}

interface FundsMutationState {
  schema: 1;
  pending: Record<string, PendingFundsMutation>;
  generations: Record<string, number>;
}

export interface FundsMutationStorage {
  read(): unknown;
  write(value: FundsMutationState): void;
}

const STORAGE_KEY = "nexgrid-funds-pending-mutations-v1";
const EMPTY_STATE = (): FundsMutationState => ({ schema: 1, pending: {}, generations: {} });

function normalized(identity: FundsMutationIdentity): FundsMutationIdentity {
  const accountKey = identity.accountKey.trim().toLowerCase();
  const method = identity.method.trim().toUpperCase();
  const fingerprint = identity.fingerprint.trim();
  if (!accountKey || identity.environment !== "SANDBOX" || !method || !fingerprint) {
    throw new Error("FUNDS_MUTATION_IDENTITY_INVALID");
  }
  return { accountKey, environment: identity.environment, method, fingerprint };
}

function scopeOf(identity: FundsMutationIdentity): string {
  const row = normalized(identity);
  return JSON.stringify([row.accountKey, row.environment, row.method, row.fingerprint]);
}

// Two independent 53-bit hashes make a compact deterministic 106-bit token.
// A hash collision is still fail-safe: the server binds the idempotency key to
// a request hash and rejects a different payload rather than executing it.
function hash53(value: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function stableKey(scope: string, generation: number): string {
  const material = `${scope}\u0000${generation}`;
  return `funds-${hash53(material, 0)}${hash53(material, 0x9e3779b9)}`;
}

function parsedState(value: unknown): FundsMutationState {
  const row = value && typeof value === "object" ? value as Partial<FundsMutationState> : null;
  if (!row || row.schema !== 1 || !row.pending || typeof row.pending !== "object"
      || !row.generations || typeof row.generations !== "object") return EMPTY_STATE();
  const pending: Record<string, PendingFundsMutation> = {};
  for (const [scope, candidate] of Object.entries(row.pending)) {
    if (!candidate || typeof candidate !== "object") continue;
    const item = candidate as Partial<PendingFundsMutation>;
    if (typeof item.key !== "string" || typeof item.accountKey !== "string"
        || item.environment !== "SANDBOX"
        || typeof item.method !== "string" || typeof item.fingerprint !== "string") continue;
    pending[scope] = {
      key: item.key,
      accountKey: item.accountKey,
      environment: item.environment,
      method: item.method,
      fingerprint: item.fingerprint,
      ...(typeof item.orderNo === "string" && item.orderNo ? { orderNo: item.orderNo } : {}),
    };
  }
  const generations: Record<string, number> = {};
  for (const [scope, generation] of Object.entries(row.generations)) {
    if (Number.isSafeInteger(generation) && Number(generation) >= 0) generations[scope] = Number(generation);
  }
  return { schema: 1, pending, generations };
}

export class FundsMutationKeyRegistry {
  constructor(private readonly storage: FundsMutationStorage) {}

  getOrCreate(identity: FundsMutationIdentity): string {
    const item = normalized(identity);
    const scope = scopeOf(item);
    const state = parsedState(this.storage.read());
    const existing = state.pending[scope];
    if (existing) return existing.key;
    const generation = state.generations[scope] ?? 0;
    const key = stableKey(scope, generation);
    state.pending[scope] = { ...item, key };
    this.storage.write(state);
    // Re-read after write so storage implementations with cross-context merge
    // semantics can return the one canonical pending key.
    return parsedState(this.storage.read()).pending[scope]?.key ?? key;
  }

  bindOrder(identity: FundsMutationIdentity, key: string, orderNo: string): void {
    const scope = scopeOf(identity);
    const state = parsedState(this.storage.read());
    const pending = state.pending[scope];
    if (!pending || pending.key !== key) throw new Error("FUNDS_MUTATION_KEY_MISMATCH");
    state.pending[scope] = { ...pending, orderNo };
    this.storage.write(state);
  }

  finish(identity: FundsMutationIdentity, key: string): boolean {
    const scope = scopeOf(identity);
    const state = parsedState(this.storage.read());
    const pending = state.pending[scope];
    if (!pending || pending.key !== key) return false;
    delete state.pending[scope];
    state.generations[scope] = (state.generations[scope] ?? 0) + 1;
    this.storage.write(state);
    return true;
  }

  finishByOrder(accountKey: string, environment: FundsMutationEnvironment, orderNo: string): boolean {
    const account = accountKey.trim().toLowerCase();
    const state = parsedState(this.storage.read());
    let changed = false;
    for (const [scope, pending] of Object.entries(state.pending)) {
      if (pending.accountKey !== account || pending.environment !== environment || pending.orderNo !== orderNo) continue;
      delete state.pending[scope];
      state.generations[scope] = (state.generations[scope] ?? 0) + 1;
      changed = true;
    }
    if (changed) this.storage.write(state);
    return changed;
  }
}

const uniStorage: FundsMutationStorage = {
  read: () => uni.getStorageSync(STORAGE_KEY),
  write: (value) => uni.setStorageSync(STORAGE_KEY, value),
};
const registry = new FundsMutationKeyRegistry(uniStorage);

export function pendingFundsMutationKey(identity: FundsMutationIdentity): string {
  return registry.getOrCreate(identity);
}

export function bindPendingFundsMutationOrder(identity: FundsMutationIdentity, key: string, orderNo: string): void {
  registry.bindOrder(identity, key, orderNo);
}

export function finishPendingFundsMutation(identity: FundsMutationIdentity, key: string): boolean {
  return registry.finish(identity, key);
}

export function finishPendingFundsMutationByOrder(
  accountKey: string,
  environment: FundsMutationEnvironment,
  orderNo: string,
): boolean {
  return registry.finishByOrder(accountKey, environment, orderNo);
}

export function fundsAmountFingerprint(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("FUNDS_MUTATION_AMOUNT_INVALID");
  return amount.toFixed(6);
}

/**
 * Production is intentionally outside the durable sandbox registry: this app
 * has no production terminal-order readback with which to retire a persisted
 * key. Until that authority exists, a submitted production command uses a
 * cryptographically generated one-shot transport key and is never written to
 * the sandbox registry.
 */
export function createProductionFundsRequestKey(nonceFactory?: () => string): string {
  const nonce = nonceFactory?.() ?? (() => {
    const secure = globalThis.crypto;
    if (secure?.randomUUID) return secure.randomUUID();
    if (secure?.getRandomValues) {
      const words = secure.getRandomValues(new Uint32Array(4));
      return Array.from(words, (word) => word.toString(16).padStart(8, "0")).join("");
    }
    throw new Error("FUNDS_PRODUCTION_IDEMPOTENCY_RANDOM_UNAVAILABLE");
  })();
  const normalizedNonce = nonce.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  if (normalizedNonce.length < 8) throw new Error("FUNDS_PRODUCTION_IDEMPOTENCY_RANDOM_INVALID");
  return `funds-prod-${normalizedNonce}`;
}
