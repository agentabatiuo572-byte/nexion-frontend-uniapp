import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";

export interface ProofSnapshot {
  source: "server"; sourceEnvironment: "PRODUCTION" | "SANDBOX"; runId: string; generatedAt: string;
  joinedAt: string; activeDays: number | null; onlineDevices: number | null; topPercentile: number | null;
  earningsTotalUsdt: number | null; referralCode: string; referral: { invitedCount: number; lifetimeInviterNex: number };
  team: { totalMembers: number; activeMembers: number };
}
function invalid(): never { throw new ApiError({ kind: "protocol", message: "PROOF_RESPONSE_INVALID" }); }
function row(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) return invalid(); return value as Record<string, unknown>; }
function text(value: unknown): string { if (typeof value !== "string" || !value.trim()) return invalid(); return value.trim(); }
function runId(value: unknown, environment: "PRODUCTION" | "SANDBOX"): string {
  if (typeof value !== "string") return invalid();
  const normalized = value.trim();
  if (environment === "SANDBOX" && !normalized) return invalid();
  if (environment === "PRODUCTION" && normalized) return invalid();
  return normalized;
}
function optionalNum(value: unknown, integer = false): number | null { if (value === null) return null; if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || integer && !Number.isSafeInteger(value)) return invalid(); return value; }
export function parseProofSnapshot(value: unknown): ProofSnapshot {
  const source = row(value); const environment = source.sourceEnvironment;
  if (source.source !== "server" || (environment !== "PRODUCTION" && environment !== "SANDBOX")) return invalid();
  if (Object.prototype.hasOwnProperty.call(source, "topPct")) return invalid();
  const runIdValue = runId(source.runId, environment);
  const generatedAt = text(source.generatedAt); const joinedAt = text(source.joinedAt);
  if (!Number.isFinite(Date.parse(generatedAt)) || !Number.isFinite(Date.parse(joinedAt))) return invalid();
  const referral = row(source.referral); const team = row(source.team);
  const invitedCount = optionalNum(referral.invitedCount, true); const lifetimeInviterNex = optionalNum(referral.lifetimeInviterNex);
  const totalMembers = optionalNum(team.totalMembers, true); const activeMembers = optionalNum(team.activeMembers, true);
  if (invitedCount === null || lifetimeInviterNex === null || totalMembers === null || activeMembers === null || activeMembers > totalMembers) return invalid();
  return { source: "server", sourceEnvironment: environment, runId: runIdValue, generatedAt, joinedAt,
    activeDays: optionalNum(source.activeDays, true), onlineDevices: optionalNum(source.onlineDevices, true),
    topPercentile: optionalNum(source.topPercentile), earningsTotalUsdt: optionalNum(source.earningsTotalUsdt),
    referralCode: text(source.referralCode), referral: { invitedCount, lifetimeInviterNex }, team: { totalMembers, activeMembers } };
}
export function createProofApi(client: ApiClient) {
  return { snapshot: async (): Promise<ProofSnapshot> => parseProofSnapshot(await client.request({ method: "GET", path: "/api/app/proof" })) };
}
