import type { ApiClient } from "./api-client";
import type { SecurityMutation, SecurityState } from "./contracts";
import { ApiError } from "./errors";

export interface AccountApi {
  securityOverview(): Promise<SecurityState>;
  changePassword(currentPassword: string, newPassword: string): Promise<SecurityMutation>;
  updateTwoFactor(enabled: boolean, currentPassword: string): Promise<SecurityMutation>;
  revokeSession(sessionId: string): Promise<SecurityMutation>;
  revokeOtherSessions(): Promise<SecurityMutation>;
  accountDeletionStatus(): Promise<AccountDeletionStatus>;
  requestAccountDeletion(currentPassword: string, idempotencyKey: string): Promise<AccountDeletionRequest>;
}

export interface AccountDeletionRequest {
  requestNo: string;
  status: "REQUESTED" | "IN_REVIEW" | "BLOCKED" | "COMPLETED" | "CANCELLED";
  requestedAt: string;
}

export type AccountDeletionStatus = AccountDeletionRequest | { status: "NONE" };

let idempotencySequence = 0;

function mutationKey(operation: string): string {
  idempotencySequence += 1;
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${idempotencySequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `app-security:${operation}:${randomId}`;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function parseSecurityState(value: unknown): SecurityState {
  const source = record(value);
  if (
    !source
    || typeof source.twoFactorEnabled !== "boolean"
    || (source.passwordChangedAt !== null && !validDate(source.passwordChangedAt))
    || !Array.isArray(source.sessions)
  ) {
    throw new ApiError({ kind: "protocol", message: "SECURITY_RESPONSE_INVALID" });
  }
  const sessions = source.sessions.map((item) => {
    const session = record(item);
    if (
      !session
      || typeof session.id !== "string"
      || !session.id
      || typeof session.deviceName !== "string"
      || typeof session.ipMasked !== "string"
      || !validDate(session.lastActiveAt)
      || typeof session.current !== "boolean"
    ) {
      throw new ApiError({ kind: "protocol", message: "SECURITY_RESPONSE_INVALID" });
    }
    return {
      id: session.id,
      deviceName: session.deviceName,
      ipMasked: session.ipMasked,
      lastActiveAt: session.lastActiveAt,
      current: session.current,
    };
  });
  return {
    twoFactorEnabled: source.twoFactorEnabled,
    passwordChangedAt: source.passwordChangedAt,
    sessions,
  };
}

function parseMutation(value: unknown): SecurityMutation {
  const source = record(value);
  if (!source) throw new ApiError({ kind: "protocol", message: "SECURITY_MUTATION_RESPONSE_INVALID" });
  if (
    (source.twoFactorEnabled !== undefined && source.twoFactorEnabled !== null
      && typeof source.twoFactorEnabled !== "boolean")
    || (source.passwordChangedAt !== undefined && source.passwordChangedAt !== null
      && !validDate(source.passwordChangedAt))
    || (source.revokedSessionCount !== undefined && source.revokedSessionCount !== null
      && (typeof source.revokedSessionCount !== "number"
        || !Number.isSafeInteger(source.revokedSessionCount)
        || source.revokedSessionCount < 0))
  ) {
    throw new ApiError({ kind: "protocol", message: "SECURITY_MUTATION_RESPONSE_INVALID" });
  }
  return source as SecurityMutation;
}

function parseAccountDeletion(value: unknown): AccountDeletionRequest {
  const source = record(value);
  const allowed = ["REQUESTED", "IN_REVIEW", "BLOCKED", "COMPLETED", "CANCELLED"];
  if (!source || typeof source.requestNo !== "string" || !/^ADR-[a-f0-9]{32}$/i.test(source.requestNo)
      || typeof source.status !== "string" || !allowed.includes(source.status)
      || !validDate(source.requestedAt)) {
    throw new ApiError({ kind: "protocol", message: "ACCOUNT_DELETION_RESPONSE_INVALID" });
  }
  return source as unknown as AccountDeletionRequest;
}

function parseAccountDeletionStatus(value: unknown): AccountDeletionStatus {
  const source = record(value);
  if (source?.status === "NONE") return { status: "NONE" };
  return parseAccountDeletion(value);
}

export function createAccountApi(client: ApiClient): AccountApi {
  return {
    securityOverview: async () => parseSecurityState(await client.request({
      method: "GET",
      path: "/api/app/security",
    })),
    changePassword: async (currentPassword, newPassword) => parseMutation(await client.request({
      method: "POST",
      path: "/api/app/security/password",
      body: { currentPassword, newPassword },
      idempotencyKey: mutationKey("password"),
    })),
    updateTwoFactor: async (enabled, currentPassword) => parseMutation(await client.request({
      method: "PUT",
      path: "/api/app/security/two-factor",
      body: { enabled, currentPassword },
      idempotencyKey: mutationKey("two-factor"),
    })),
    revokeSession: async (sessionId) => parseMutation(await client.request({
      method: "POST",
      path: `/api/app/security/sessions/${encodeURIComponent(sessionId)}/revoke`,
      idempotencyKey: mutationKey("revoke-session"),
    })),
    revokeOtherSessions: async () => parseMutation(await client.request({
      method: "POST",
      path: "/api/app/security/sessions/revoke-others",
      idempotencyKey: mutationKey("revoke-other-sessions"),
    })),
    accountDeletionStatus: async () => parseAccountDeletionStatus(await client.request({
      method: "GET",
      path: "/api/app/security/account-deletion",
    })),
    requestAccountDeletion: async (currentPassword, idempotencyKey) => parseAccountDeletion(await client.request({
      method: "POST",
      path: "/api/app/security/account-deletion",
      body: { currentPassword, confirmation: "DELETE" },
      idempotencyKey,
    })),
  };
}
