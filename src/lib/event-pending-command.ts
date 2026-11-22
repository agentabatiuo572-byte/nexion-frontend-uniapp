import { readAccountRow, writeAccountRow } from "@/store/account-scoped-storage";

// A join, claim or reminder whose result is not known yet, per account and event, so the page confirms it again after a
// reload or a later visit (03 §3.5.2), as checkout keeps its pending create. Only what identifies the command is kept.
const KEY = "uvel-event-pending-accounts-v1";
export interface PendingEventCommand {
  action: "join" | "claim" | "remind";
  /** The idempotency key the command was sent with. */
  key: string;
  /** The claim key a tiered claim used (the reinvest bonus); "" for other commands. */
  claimKey: string;
}
type Row = Record<string, PendingEventCommand>;

/** Storage is the boundary: an entry this page did not write reads as none. */
export function readPendingEventCommand(accountKey: string, code: string): PendingEventCommand | null {
  const entry = readAccountRow<Row>(KEY, accountKey)?.[code];
  if (!entry || !["join", "claim", "remind"].includes(entry.action) || typeof entry.key !== "string" || !entry.key || typeof entry.claimKey !== "string") return null;
  return entry;
}
export function rememberPendingEventCommand(accountKey: string, code: string, command: PendingEventCommand): boolean {
  return writeAccountRow(KEY, accountKey, { ...readAccountRow<Row>(KEY, accountKey), [code]: command });
}
export function forgetPendingEventCommand(accountKey: string, code: string): boolean {
  const row = readAccountRow<Row>(KEY, accountKey);
  if (!row?.[code]) return true;
  const next = { ...row };
  delete next[code];
  return writeAccountRow(KEY, accountKey, next);
}
