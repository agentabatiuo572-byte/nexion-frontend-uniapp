import { opaqueSupportIntentSlot } from "@/lib/support-intent-slot";
import { MESSAGE_MAX_LENGTH } from "@/lib/message-length-policy";
import type { HumanComposer } from "@/store/conversations";

export type FailedHumanSend = NonNullable<HumanComposer["failedSend"]>;
export const HUMAN_OUTBOX_PREFIX = "support-human-outbox:";
export const LEGACY_PENDING_PREFIX = "support-human-pending:";
export const HUMAN_SEND_PREFIX = "support-human-send:";
export const HUMAN_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
export const humanOutboxKey = (account: string) => HUMAN_OUTBOX_PREFIX + account;

export function humanOutboxStorage(durable = false) {
  if (typeof plus === "undefined") {
    const storage = durable ? localStorage : sessionStorage;
    return {
      getItem: (key: string) => storage.getItem(key),
      setItem: (key: string, value: string) => storage.setItem(key, value),
      removeItem: (key: string) => storage.removeItem(key),
      keys: () => Object.keys(storage),
    };
  }
  return {
    getItem: (key: string) => uni.getStorageSync(key) as string,
    setItem: (key: string, value: string) => uni.setStorageSync(key, value),
    removeItem: (key: string) => uni.removeStorageSync(key),
    keys: () => uni.getStorageInfoSync().keys,
  };
}

function readJson(key: string, durable: boolean): unknown {
  const raw = humanOutboxStorage(durable).getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch { return null; }
}

export function writeHumanStorage(key: string, value: unknown | null, durable: boolean) {
  try {
    const storage = humanOutboxStorage(durable);
    if (value === null) {
      storage.removeItem(key);
      if (!storage.getItem(key)) return;
    } else {
      const encoded = JSON.stringify(value);
      storage.setItem(key, encoded);
      if (storage.getItem(key) === encoded) return;
    }
  } catch { /* Normalize browser and native storage failures. */ }
  throw new Error("SUPPORT_HUMAN_OUTBOX_PERSIST_FAILED");
}

export function humanSendSlot(key: string, failed: FailedHumanSend): string {
  const intent = key.startsWith("start:")
    ? `conversation-create:${key.slice(6)}:${failed.attachmentId ?? "text"}:${failed.text.trim()}`
    : `conversation-reply:${key.slice(13)}:${failed.attachmentId ?? "text"}:${failed.text.trim()}`;
  return opaqueSupportIntentSlot(intent);
}

export function validHumanCommandKey(composerKey: string, key: unknown): key is string {
  const prefix = composerKey.startsWith("start:") ? "support-conversation-create-" : "support-conversation-reply-";
  return typeof key === "string" && key.length <= 128 && key.startsWith(prefix)
    && /^[a-z0-9-]+$/.test(key.slice(prefix.length));
}

function parseComposer(key: string, value: unknown): HumanComposer | undefined {
  if (!/^(start:(advisor|support)|conversation:[A-Za-z0-9_-]{1,80})$/.test(key) || !value || typeof value !== "object") return;
  const saved = value as Partial<HumanComposer>;
  const text = typeof saved.text === "string" ? saved.text.slice(0, MESSAGE_MAX_LENGTH) : "";
  const userClearThrough = Number.isSafeInteger(saved.userClearThrough) && saved.userClearThrough! >= 0 ? saved.userClearThrough : undefined;
  const draft = { text, imageDraft: null, userClearThrough };
  const failed = saved.failedSend;
  if (key.startsWith("start:") && typeof saved.recoveredId === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(saved.recoveredId)) {
    return { ...draft, failedSend: null, recoveredId: saved.recoveredId, retainDraft: true };
  }
  if (!failed && saved.retainDraft === true && text) return { ...draft, failedSend: null, retainDraft: true };
  if (!failed || typeof failed.text !== "string" || !Number.isSafeInteger(failed.attempts)
      || (failed.attachmentId !== undefined && typeof failed.attachmentId !== "string")) return;
  const rejected = key.startsWith("conversation:") && (failed.peerChanged === true || failed.replyRejected === true)
    && failed.settled === true && failed.kind === "failed" && failed.retryable === false;
  if (!rejected && (failed.settled !== false || failed.kind !== "unknown" || failed.retryable !== true)) return;
  const commandKey = validHumanCommandKey(key, failed.commandKey) ? failed.commandKey : undefined;
  const expiresAt = Number.isSafeInteger(failed.expiresAt) && failed.expiresAt! > 0 ? failed.expiresAt : undefined;
  return { ...draft, failedSend: { ...failed, commandKey, expiresAt } };
}

export function readHumanOutbox(key: string, durable = false): Record<string, HumanComposer> {
  const rows = readJson(key, durable);
  if (!rows || typeof rows !== "object" || Array.isArray(rows)) return {};
  const restored: Record<string, HumanComposer> = {};
  for (const [composerKey, value] of Object.entries(rows)) {
    const saved = parseComposer(composerKey, value);
    if (saved) restored[composerKey] = saved;
  }
  return restored;
}

export function humanSendStorageKey(account: string, composerKey: string, failed: FailedHumanSend): string {
  return `${HUMAN_SEND_PREFIX}${account}:${failed.commandKey ?? humanSendSlot(composerKey, failed)}`;
}

export function readRetainedHumanSend(storageKey: string) {
  const row = readJson(storageKey, true) as { composerKey?: unknown; saved?: unknown } | null;
  if (typeof row?.composerKey !== "string") return;
  const { composerKey } = row;
  const saved = parseComposer(composerKey, row.saved), failed = saved?.failedSend;
  if (!saved || !failed || failed.settled || failed.expiresAt === undefined) return;
  return { composerKey, saved, failed };
}

export function writeRetainedHumanSend(account: string, composerKey: string, saved: HumanComposer, failed: FailedHumanSend) {
  const storageKey = humanSendStorageKey(account, composerKey, failed);
  writeHumanStorage(storageKey, {
    composerKey,
    saved: { text: "", imageDraft: null, failedSend: failed, userClearThrough: saved.userClearThrough },
  }, true);
}

export function retainedHumanSends(account: string) {
  const prefix = `${HUMAN_SEND_PREFIX}${account}:`;
  const rows = [];
  for (const storageKey of humanOutboxStorage(true).keys()) {
    if (!storageKey.startsWith(prefix)) continue;
    const row = readRetainedHumanSend(storageKey);
    if (row && storageKey === humanSendStorageKey(account, row.composerKey, row.failed)) rows.push({ ...row, storageKey });
  }
  return rows;
}
