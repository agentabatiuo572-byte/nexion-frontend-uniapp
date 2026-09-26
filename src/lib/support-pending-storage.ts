const PREFIX = "support-pending-commands";
const SLOT = /^sha256:[a-f0-9]{64}$/;
const KEY = /^support-[a-z0-9-]+-/;

function storageKey(accountKey: string, runId: string, kind: "tickets" | "conversations"): string {
  return `${PREFIX}:${accountKey}:${runId}:${kind}`;
}

function read(key: string): string | null {
  try {
    if (typeof plus === "undefined") return localStorage.getItem(key);
    const value = uni.getStorageSync(key);
    if (value !== "" && typeof value !== "string") throw new Error("invalid storage value");
    if (value) return value;
    // Upgrade an earlier App build that exposed localStorage to its service layer.
    let legacy: string | null = null;
    try { legacy = localStorage.getItem(key); } catch { /* no WebView storage in App service */ }
    if (legacy !== null) {
      write(key, legacy);
      return legacy;
    }
    return null;
  } catch {
    throw new Error("SUPPORT_PENDING_PERSIST_FAILED");
  }
}

function write(key: string, value: string): void {
  try {
    if (typeof plus === "undefined") localStorage.setItem(key, value);
    else uni.setStorageSync(key, value);
    // Uni App storage can swallow a write error; do not send with an unrecorded key.
    const stored = typeof plus === "undefined" ? localStorage.getItem(key) : uni.getStorageSync(key);
    if (stored !== value) throw new Error("storage write did not persist");
  } catch {
    throw new Error("SUPPORT_PENDING_PERSIST_FAILED");
  }
}

export function restoreSupportPending(accountKey: string, runId: string, kind: "tickets" | "conversations"): Map<string, string> {
  const raw = read(storageKey(accountKey, runId, kind));
  if (raw === null) return new Map();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    const entries = Object.entries(parsed);
    if (entries.some(([slot, key]) => !SLOT.test(slot) || typeof key !== "string" || !KEY.test(key))) throw new Error();
    return new Map(entries as [string, string][]);
  } catch {
    throw new Error("SUPPORT_PENDING_PERSIST_FAILED");
  }
}

export function persistSupportPending(accountKey: string, runId: string, kind: "tickets" | "conversations", values: Map<string, string>): void {
  write(storageKey(accountKey, runId, kind), JSON.stringify(Object.fromEntries(values)));
}
