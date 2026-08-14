const STORAGE_KEY = "nexgrid-ambassador-pending-command-v1";

interface PendingCommand { slot: string; key: string }

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function read(): PendingCommand | null {
  try {
    const value = uni.getStorageSync(STORAGE_KEY) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const row = value as Partial<PendingCommand>;
    return typeof row.slot === "string" && typeof row.key === "string" && row.key ? row as PendingCommand : null;
  } catch { return null; }
}

function commandSlot(accountKey: string, payload: string): string {
  const account = accountKey.trim().toLowerCase();
  if (!account) throw new Error("AMBASSADOR_COMMAND_SCOPE_INVALID");
  return `${fingerprint(account)}:${fingerprint(payload)}`;
}

export function acquireAmbassadorCommandKey(accountKey: string, payload: string): string {
  const slot = commandSlot(accountKey, payload);
  const pending = read();
  if (pending?.slot === slot) return pending.key;
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const key = `app-ambassador:${id}`;
  uni.setStorageSync(STORAGE_KEY, { slot, key } satisfies PendingCommand);
  return key;
}

export function finishAmbassadorCommand(accountKey: string, payload: string): void {
  const pending = read();
  if (pending?.slot !== commandSlot(accountKey, payload)) return;
  uni.removeStorageSync(STORAGE_KEY);
}
