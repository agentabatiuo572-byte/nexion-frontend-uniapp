import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import type { ApiEnvironment } from "./runtime-config";
import { isCurrentCommerceSandboxRun } from "./order-api";

export type PayoutAddressNetwork = "USDT-TRC20" | "USDT-BEP20" | "USDT-ERC20";
export type PayoutAddressSourceEnvironment = "PRODUCTION" | "SANDBOX";
export type PayoutAddressSource = "server" | "mock";

export interface PayoutAddressProvenance {
  source: PayoutAddressSource;
  sourceEnvironment: PayoutAddressSourceEnvironment;
  runId: string;
  serverCanonical: true;
}

export interface PayoutAddressRow extends PayoutAddressProvenance {
  network: PayoutAddressNetwork;
  address: string;
  status: "ACTIVE";
  effectiveAt: string;
  createdAt: string;
  nextChangeAllowedAt: string;
  changePending: boolean;
}

export interface PayoutAddressSnapshot extends PayoutAddressProvenance {
  addresses: PayoutAddressRow[];
  changeCooldownDays: number;
  effectiveDelayHours: number;
  inFlightWithdrawalBlocked: true;
}

export interface PayoutAddressOtpChallenge extends PayoutAddressProvenance {
  challengeNo: string;
  expiresInSeconds: number;
}

export interface PayoutAddressApi {
  list(): Promise<PayoutAddressSnapshot>;
  sendOtp(): Promise<PayoutAddressOtpChallenge>;
  save(input: {
    network: PayoutAddressNetwork;
    address: string;
    challengeNo: string;
    code: string;
    idempotencyKey: string;
  }): Promise<PayoutAddressRow & PayoutAddressProvenance>;
}

const NETWORKS = new Set<PayoutAddressNetwork>(["USDT-TRC20", "USDT-BEP20", "USDT-ERC20"]);
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function timestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function provenance(value: unknown, mode: ApiEnvironment): PayoutAddressProvenance {
  const row = record(value);
  const source = row?.source;
  const sourceEnvironment = row?.sourceEnvironment;
  const runId = typeof row?.runId === "string" ? row.runId.trim() : null;
  const sandbox = mode === "dev" && source === "mock" && sourceEnvironment === "SANDBOX"
    && runId !== null && RUN_ID.test(runId) && isCurrentCommerceSandboxRun(runId);
  const production = mode === "prod" && source === "server" && sourceEnvironment === "PRODUCTION" && runId === "";
  if (row?.serverCanonical !== true || (!sandbox && !production)) {
    throw new ApiError({ kind: "protocol", message: "PAYOUT_ADDRESS_PROVENANCE_INVALID" });
  }
  return {
    source: source as PayoutAddressSource,
    sourceEnvironment: sourceEnvironment as PayoutAddressSourceEnvironment,
    runId: runId!,
    serverCanonical: true,
  };
}

function parseRow(value: unknown, mode: ApiEnvironment, expected?: PayoutAddressProvenance): PayoutAddressRow {
  const row = record(value);
  if (
    !row
    || !NETWORKS.has(row.network as PayoutAddressNetwork)
    || typeof row.address !== "string"
    || !row.address.trim()
    || row.status !== "ACTIVE"
    || !timestamp(row.effectiveAt)
    || !timestamp(row.createdAt)
    || !timestamp(row.nextChangeAllowedAt)
    || typeof row.changePending !== "boolean"
  ) {
    throw new ApiError({ kind: "protocol", message: "PAYOUT_ADDRESS_RESPONSE_INVALID" });
  }
  if (row.serverCanonical !== true) {
    throw new ApiError({ kind: "protocol", message: "PAYOUT_ADDRESS_PROVENANCE_INVALID" });
  }
  const actual = provenance(row, mode);
  if (!expected || actual.source !== expected.source
    || actual.sourceEnvironment !== expected.sourceEnvironment || actual.runId !== expected.runId) {
    throw new ApiError({ kind: "protocol", message: "PAYOUT_ADDRESS_PROVENANCE_INVALID" });
  }
  return row as unknown as PayoutAddressRow;
}

function parseSnapshot(value: unknown, mode: ApiEnvironment): PayoutAddressSnapshot {
  const row = record(value);
  if (!row || !Array.isArray(row.addresses)
      || typeof row.changeCooldownDays !== "number" || !Number.isSafeInteger(row.changeCooldownDays)
      || row.changeCooldownDays <= 0
      || typeof row.effectiveDelayHours !== "number" || !Number.isSafeInteger(row.effectiveDelayHours)
      || row.effectiveDelayHours <= 0 || row.inFlightWithdrawalBlocked !== true) {
    throw new ApiError({ kind: "protocol", message: "PAYOUT_ADDRESS_RESPONSE_INVALID" });
  }
  const proof = provenance(row, mode);
  const addresses = row.addresses.map((item) => parseRow(item, mode, proof));
  if (new Set(addresses.map((item) => item.network)).size !== addresses.length) {
    throw new ApiError({ kind: "protocol", message: "PAYOUT_ADDRESS_RESPONSE_INVALID" });
  }
  return {
    addresses,
    ...proof,
    changeCooldownDays: row.changeCooldownDays,
    effectiveDelayHours: row.effectiveDelayHours,
    inFlightWithdrawalBlocked: true,
  };
}

function parseChallenge(value: unknown, mode: ApiEnvironment): PayoutAddressOtpChallenge {
  const row = record(value);
  if (
    !row
    || typeof row.challengeNo !== "string"
    || !/^PAYOUT-[A-Z0-9]+$/.test(row.challengeNo)
    || typeof row.expiresInSeconds !== "number"
    || !Number.isSafeInteger(row.expiresInSeconds)
    || row.expiresInSeconds <= 0
  ) {
    throw new ApiError({ kind: "protocol", message: "PAYOUT_ADDRESS_OTP_RESPONSE_INVALID" });
  }
  return { challengeNo: row.challengeNo, expiresInSeconds: row.expiresInSeconds, ...provenance(row, mode) };
}

export function createPayoutAddressApi(client: ApiClient, mode: ApiEnvironment = "prod"): PayoutAddressApi {
  return {
    list: async () => parseSnapshot(await client.request({
      method: "GET",
      path: "/api/payout-addresses",
    }), mode),
    sendOtp: async () => parseChallenge(await client.request({
      method: "POST",
      path: "/api/payout-addresses/otp/send",
    }), mode),
    save: async (input) => {
      const raw = await client.request({
        method: "PUT",
        path: "/api/payout-addresses",
        body: {
          network: input.network,
          address: input.address,
          challengeNo: input.challengeNo,
          code: input.code,
        },
        idempotencyKey: input.idempotencyKey,
        timeoutMs: 30_000,
      });
      const row = record(raw);
      const proof = provenance(raw, mode);
      parseRow(raw, mode, proof);
      return { ...(row as unknown as PayoutAddressRow), ...proof };
    },
  };
}
