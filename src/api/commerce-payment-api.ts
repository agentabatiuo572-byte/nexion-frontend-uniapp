import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";

export interface CommercePaymentReceipt {
  orderNo: string;
  paymentNo: string;
  paymentStatus: "PAID";
  orderStatus: "COMPLETED";
  activationStatus: "ACTIVATED";
  canonicalStatus: "activated";
  source: "mock";
  sourceEnvironment: "SANDBOX";
  runId: "local-dev";
  walletBalanceAfterUsdt: number;
  serverCanonical: true;
}

export interface CommercePaymentApi {
  confirm(orderNo: string, idempotencyKey: string): Promise<CommercePaymentReceipt>;
}

function invalid(): never {
  throw new ApiError({ kind: "protocol", message: "COMMERCE_PAYMENT_RESPONSE_INVALID" });
}

function parse(value: unknown): CommercePaymentReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  const walletBalanceAfterUsdt = typeof row.walletBalanceAfterUsdt === "number"
    && Number.isFinite(row.walletBalanceAfterUsdt) && row.walletBalanceAfterUsdt >= 0
    ? row.walletBalanceAfterUsdt : null;
  if (typeof row.orderNo !== "string" || !row.orderNo.trim()
      || typeof row.paymentNo !== "string" || !/^PAY-DEV-[A-Z0-9]{16,64}$/.test(row.paymentNo)
      || row.paymentStatus !== "PAID" || row.orderStatus !== "COMPLETED"
      || row.activationStatus !== "ACTIVATED" || row.canonicalStatus !== "activated"
      || row.source !== "mock" || row.sourceEnvironment !== "SANDBOX"
      || row.runId !== "local-dev" || walletBalanceAfterUsdt === null
      || row.serverCanonical !== true) return invalid();
  return {
    orderNo: row.orderNo.trim(), paymentNo: row.paymentNo,
    paymentStatus: "PAID", orderStatus: "COMPLETED", activationStatus: "ACTIVATED",
    canonicalStatus: "activated", source: "mock", sourceEnvironment: "SANDBOX",
    runId: "local-dev", walletBalanceAfterUsdt, serverCanonical: true,
  };
}

export function createCommercePaymentApi(client: ApiClient): CommercePaymentApi {
  return {
    async confirm(orderNo, idempotencyKey) {
      const normalizedOrderNo = orderNo.trim();
      if (!normalizedOrderNo || !idempotencyKey.trim()) return invalid();
      return parse(await client.request<unknown>({
        method: "POST", path: `/api/orders/${encodeURIComponent(normalizedOrderNo)}/pay`,
        idempotencyKey,
      }));
    },
  };
}
