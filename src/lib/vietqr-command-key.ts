export interface VietQrCommandIdentity {
  accountKey: string;
  action: "CREATE" | "CANCEL";
  fingerprint: string;
}

interface PendingVietQrCommand extends VietQrCommandIdentity {
  key: string;
  intentNo?: string;
}

interface VietQrCommandState {
  schema: 1;
  pending: Record<string, PendingVietQrCommand>;
  generations: Record<string, number>;
}

export interface VietQrCommandStorage {
  read(): unknown;
  write(value: VietQrCommandState): void;
}

const STORAGE_KEY = "nexgrid-vietqr-command-keys-v1";
const empty = (): VietQrCommandState => ({ schema: 1, pending: {}, generations: {} });

function identityScope(identity: VietQrCommandIdentity): string {
  const accountKey = identity.accountKey.trim().toLowerCase();
  const fingerprint = identity.fingerprint.trim();
  if (!accountKey || !fingerprint || (identity.action !== "CREATE" && identity.action !== "CANCEL")) {
    throw new Error("VIETQR_COMMAND_IDENTITY_INVALID");
  }
  return JSON.stringify([accountKey, identity.action, fingerprint]);
}

function parse(value: unknown): VietQrCommandState {
  const source = value && typeof value === "object" ? value as Partial<VietQrCommandState> : null;
  if (!source || source.schema !== 1 || !source.pending || !source.generations) return empty();
  return {
    schema: 1,
    pending: source.pending as Record<string, PendingVietQrCommand>,
    generations: source.generations as Record<string, number>,
  };
}

function hash(value: string): string {
  let current = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    current = Math.imul(current ^ value.charCodeAt(index), 16777619);
  }
  return (current >>> 0).toString(36);
}

export class VietQrCommandKeyRegistry {
  constructor(private readonly storage: VietQrCommandStorage) {}

  getOrCreate(identity: VietQrCommandIdentity): string {
    const scope = identityScope(identity);
    const state = parse(this.storage.read());
    const pending = state.pending[scope];
    if (pending) return pending.key;
    const generation = state.generations[scope] ?? 0;
    const key = `vietqr-${hash(`${scope}\u0000${generation}`)}-${hash(`${generation}\u0000${scope}`)}`;
    state.pending[scope] = { ...identity, accountKey: identity.accountKey.trim().toLowerCase(), key };
    this.storage.write(state);
    return parse(this.storage.read()).pending[scope]?.key ?? key;
  }

  bindIntent(identity: VietQrCommandIdentity, key: string, intentNo: string): void {
    const scope = identityScope(identity);
    const state = parse(this.storage.read());
    const pending = state.pending[scope];
    if (!pending || pending.key !== key || !intentNo.trim()) throw new Error("VIETQR_COMMAND_KEY_MISMATCH");
    state.pending[scope] = { ...pending, intentNo: intentNo.trim() };
    this.storage.write(state);
  }

  finish(identity: VietQrCommandIdentity, key: string): boolean {
    const scope = identityScope(identity);
    const state = parse(this.storage.read());
    if (state.pending[scope]?.key !== key) return false;
    delete state.pending[scope];
    state.generations[scope] = (state.generations[scope] ?? 0) + 1;
    this.storage.write(state);
    return true;
  }

  finishByIntent(accountKey: string, intentNo: string): boolean {
    const normalizedAccount = accountKey.trim().toLowerCase();
    const state = parse(this.storage.read());
    let changed = false;
    for (const [scope, pending] of Object.entries(state.pending)) {
      if (pending.accountKey !== normalizedAccount || pending.intentNo !== intentNo) continue;
      delete state.pending[scope];
      state.generations[scope] = (state.generations[scope] ?? 0) + 1;
      changed = true;
    }
    if (changed) this.storage.write(state);
    return changed;
  }
}

const registry = new VietQrCommandKeyRegistry({
  read: () => uni.getStorageSync(STORAGE_KEY),
  write: (value) => uni.setStorageSync(STORAGE_KEY, value),
});

export const vietQrCommandKey = (identity: VietQrCommandIdentity) => registry.getOrCreate(identity);
export const bindVietQrIntent = (identity: VietQrCommandIdentity, key: string, intentNo: string) =>
  registry.bindIntent(identity, key, intentNo);
export const finishVietQrCommand = (identity: VietQrCommandIdentity, key: string) => registry.finish(identity, key);
export const finishVietQrCommandByIntent = (accountKey: string, intentNo: string) =>
  registry.finishByIntent(accountKey, intentNo);
