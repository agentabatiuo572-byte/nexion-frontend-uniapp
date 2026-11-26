import { ref } from "vue";
import { apiRuntimeClientOrigin } from "@/api/runtime";
import type { CalibrationRequestSignals, PhoneActivationVersions } from "@/api/onboarding-calibration-api";
import { ApiError } from "@/api/errors";
import { acquireAccountCommand, readAccountRow, releaseAccountCommandKey, type AccountCommandRow } from "@/store/account-scoped-storage";
import { confirmedPhoneActivationRejection } from "@/lib/phone-activation-feedback";

const TABLE = "nexgrid-phone-onboarding-commands-v1";
const MIN_READ_INTERVAL_MS = 5_000;

export interface PhoneCommandScope {
  accountKey: string;
  deviceId: string;
}

type PhoneCommandPayload = {
  activate: { revision: number; versions: PhoneActivationVersions };
  calibrate: { revision: number; hadResult: boolean; signals: CalibrationRequestSignals };
  defer: { revision: number; initialOnly: boolean };
};

type CommandKind = keyof PhoneCommandPayload;
export type PhoneCommand<K extends CommandKind> = PhoneCommandPayload[K] & PhoneCommandScope & { idempotencyKey: string };

function storageIntent(scope: PhoneCommandScope, kind: CommandKind) {
  const { environment, baseUrl } = apiRuntimeClientOrigin;
  if (!/^user:[1-9]\d*$/.test(scope.accountKey) || !scope.deviceId) throw new Error("PHONE_COMMAND_SCOPE_INVALID");
  return JSON.stringify([environment, baseUrl, scope.deviceId, kind]);
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseCommand<K extends CommandKind>(scope: PhoneCommandScope, kind: K, key: string, raw: string | undefined): PhoneCommand<K> {
  const validVersion = (value: unknown) => value === null || (Number.isSafeInteger(value) && Number(value) > 0);
  let value: unknown;
  try { value = JSON.parse(raw ?? ""); } catch { /* Invalid data must not authorize a new write. */ }
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key) || !object(value)
      || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0) throw new Error("PHONE_COMMAND_STORAGE_INVALID");
  if (kind === "activate" && (!object(value.versions)
      || !validVersion(value.versions.expectedBindingVersion) || !validVersion(value.versions.expectedPolicyVersion)
      || typeof value.versions.replacementConfirmed !== "boolean"
      || (value.versions.exceptionGrantId !== undefined && typeof value.versions.exceptionGrantId !== "string")))
    throw new Error("PHONE_COMMAND_STORAGE_INVALID");
  if (kind === "calibrate" && (typeof value.hadResult !== "boolean" || !object(value.signals)))
    throw new Error("PHONE_COMMAND_STORAGE_INVALID");
  if (kind === "defer" && typeof value.initialOnly !== "boolean") throw new Error("PHONE_COMMAND_STORAGE_INVALID");
  return { ...value, ...scope, revision: Number(value.revision), idempotencyKey: key } as unknown as PhoneCommand<K>;
}

export function readPhoneCommand<K extends CommandKind>(scope: PhoneCommandScope, kind: K): PhoneCommand<K> | null {
  const intent = storageIntent(scope, kind);
  const row = readAccountRow<AccountCommandRow>(TABLE, scope.accountKey, true);
  const key = row?.commands?.[intent];
  return key === undefined ? null : parseCommand(scope, kind, key, row?.payloads?.[intent]);
}

export function beginPhoneCommand<K extends CommandKind>(scope: PhoneCommandScope, kind: K, payload: PhoneCommandPayload[K]) {
  const command = acquireAccountCommand(TABLE, scope.accountKey, storageIntent(scope, kind), `onboarding:${kind}`, JSON.stringify(payload));
  return { value: parseCommand(scope, kind, command.key, command.payload), reused: command.reused };
}

export function finishPhoneCommand<K extends CommandKind>(kind: K, command: PhoneCommand<K>) {
  releaseAccountCommandKey(TABLE, command.accountKey, storageIntent(command, kind), command.idempotencyKey);
}

export function confirmedPhoneWriteRejection(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return confirmedPhoneActivationRejection(error) || error.kind === "configuration"
    || (error.kind === "auth" && error.message === "AUTH_SESSION_REQUIRED")
    || ((error.kind === "http" || error.kind === "business") && error.message === "ONBOARDING_CALIBRATION_CONFIG_UNAVAILABLE"
      && (error.status === 503 || error.code === 503));
}

/** A failed read breaks the streak. Every resend consumes the authorization. */
export function createPhoneWriteReadback() {
  let count = 0;
  let lastReadAt: number | undefined;
  const resendAvailable = ref(false);
  return {
    resendAvailable,
    reset() { count = 0; lastReadAt = undefined; resendAvailable.value = false; },
    notBefore: () => lastReadAt === undefined ? 0 : lastReadAt + MIN_READ_INTERVAL_MS,
    observe() {
      const now = Date.now();
      if (lastReadAt === undefined || now - lastReadAt >= MIN_READ_INTERVAL_MS) {
        count += 1;
        lastReadAt = now;
      }
      resendAvailable.value = count >= 3;
    },
  };
}
