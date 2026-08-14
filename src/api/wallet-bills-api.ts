import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";

export type WalletBillAsset = "USDT" | "NEX";
export type WalletBillDirection = "IN" | "OUT";
export type WalletBillStatus = "SUCCESS" | "PENDING" | "FAILED";

export interface WalletBillRow {
  id: string;
  bizNo: string;
  bizType: string;
  asset: WalletBillAsset;
  direction: WalletBillDirection;
  amount: number;
  balanceAfter: number;
  status: WalletBillStatus;
  remark: string;
  createdAt: number;
}

export interface WalletBillsSnapshot {
  source: "server";
  sourceEnvironment: "PRODUCTION";
  bills: WalletBillRow[];
}

function invalid(): never {
  throw new ApiError({ kind: "protocol", message: "WALLET_BILLS_RESPONSE_INVALID" });
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function money(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function bill(value: unknown): WalletBillRow {
  const row = object(value);
  const id = text(row?.id);
  const bizNo = text(row?.bizNo);
  const bizType = text(row?.bizType);
  const asset = text(row?.asset)?.toUpperCase();
  const direction = text(row?.direction)?.toUpperCase();
  const amount = money(row?.amount);
  const balanceAfter = money(row?.balanceAfter);
  const status = text(row?.status)?.toUpperCase();
  const createdAtRaw = text(row?.createdAt);
  const createdAt = createdAtRaw ? Date.parse(createdAtRaw) : Number.NaN;
  if (!row || !id || !bizNo || !bizType || (asset !== "USDT" && asset !== "NEX")
      || (direction !== "IN" && direction !== "OUT") || amount === null || balanceAfter === null
      || (status !== "SUCCESS" && status !== "PENDING" && status !== "FAILED")
      || !Number.isFinite(createdAt)) return invalid();
  return {
    id,
    bizNo,
    bizType,
    asset,
    direction,
    amount,
    balanceAfter,
    status,
    remark: typeof row.remark === "string" ? row.remark : "",
    createdAt,
  };
}

export function parseWalletBillsSnapshot(value: unknown): WalletBillsSnapshot {
  const row = object(value);
  if (!row || row.source !== "server" || row.sourceEnvironment !== "PRODUCTION" || !Array.isArray(row.bills)) {
    return invalid();
  }
  return { source: "server", sourceEnvironment: "PRODUCTION", bills: row.bills.map(bill) };
}

export function createWalletBillsApi(client: ApiClient) {
  return {
    list: async (): Promise<WalletBillsSnapshot> => parseWalletBillsSnapshot(await client.request({
      method: "GET",
      path: "/api/app/wallet/bills",
    })),
  };
}
