import { readAccountRow, writeAccountRow } from "@/store/account-scoped-storage";

// A join, claim or reminder whose result is not known yet, per account and event, so the page confirms it again after a
// reload or a later visit (03 §3.5.2), as checkout keeps its pending create. Only what identifies the command is kept.
// A receipt may stay unavailable, so confirmation stops after a day. A later tap still uses the same key.
const KEY = "uvel-event-pending-accounts-v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export interface PendingEventCommand {
  action: "join" | "claim" | "remind";
  /** The idempotency key the command was sent with. */
  key: string;
  /** The claim key a tiered claim used (the reinvest bonus); "" for other commands. */
  claimKey: string;
  /** When it was recorded (ms epoch). */
  at: number;
}
type Row = Record<string, PendingEventCommand>;

export function isPendingEventCommandExpired(command: PendingEventCommand, now = Date.now()): boolean {
  return !(now - command.at <= MAX_AGE_MS);
}

/** Storage is the boundary: an entry this page did not write, or one older than a day, is removed and reads as none. */
export function readPendingEventCommand(accountKey: string, code: string, now = Date.now()): PendingEventCommand | null {
  const entry = readAccountRow<Row>(KEY, accountKey)?.[code];
  if (!entry) return null;
  if (!["join", "claim", "remind"].includes(entry.action) || typeof entry.key !== "string" || !entry.key || typeof entry.claimKey !== "string"
    || typeof entry.at !== "number" || isPendingEventCommandExpired(entry, now)) {
    forgetPendingEventCommand(accountKey, code);
    return null;
  }
  return entry;
}
export function rememberPendingEventCommand(accountKey: string, code: string, command: PendingEventCommand): boolean {
  return writeAccountRow(KEY, accountKey, { ...readAccountRow<Row>(KEY, accountKey), [code]: command });
}
/** With `at`, only the record of that attempt goes: a newer attempt on the same event keeps its own. */
export function forgetPendingEventCommand(accountKey: string, code: string, at?: number): boolean {
  const row = readAccountRow<Row>(KEY, accountKey);
  if (!row?.[code] || (at !== undefined && row[code].at !== at)) return true;
  const next = { ...row };
  delete next[code];
  return writeAccountRow(KEY, accountKey, next);
}
