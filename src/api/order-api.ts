import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";

export const ORDER_STATUSES = [
  "placed",
  "paid",
  "provisioning",
  "activated",
  "payment_failed",
  "expired",
  "provisioning_failed",
  "refunded",
  "chargeback",
  "cancelled",
] as const;

export type CanonicalOrderStatus = typeof ORDER_STATUSES[number];

export interface CanonicalOrder {
  orderNo: string;
  productId: number;
  productNo: string;
  productName: string;
  quantity: number;
  unitPriceUsdt: number;
  discountUsdt: number;
  amountUsdt: number;
  paymentMethod: string | null;
  paymentStatus: string;
  orderStatus: string;
  activationStatus: string;
  canonicalStatus: CanonicalOrderStatus;
  orderType: string;
  placedAt: number;
  paidAt: number | null;
  activatedAt: number | null;
  dataCenter: string | null;
  tradeinNo: string | null;
  sourceDeviceId: number | null;
  targetDeviceId: number | null;
  targetDeviceInstanceNo: string | null;
}

export interface CanonicalOrderList {
  source: string;
  orders: CanonicalOrder[];
}

export interface CreatedOrder {
  orderNo: string;
  subtotalUsdt: number;
  discountUsdt: number;
  amountUsdt: number;
  voucherId: string | null;
  voucherRedemption: { voucherId: string; grantId: string; status: "REDEEMED"; discountUsdt: number } | null;
  paymentStatus: string;
  orderStatus: string;
  idSource: "server";
}

export interface CreateOrderRequest {
  productNo: string;
  quantity: number;
  voucherId?: string | null;
  idempotencyKey: string;
}

export interface OrderApi {
  list(): Promise<CanonicalOrderList>;
  create(request: CreateOrderRequest): Promise<CreatedOrder>;
}

const STATUS_SET = new Set<string>(ORDER_STATUSES);

function invalid(): never {
  throw new ApiError({ kind: "protocol", message: "ORDER_RESPONSE_INVALID" });
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return invalid();
  return value.trim();
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return nonEmptyString(value);
}

function finiteNumber(value: unknown, minimum = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) return invalid();
  return value;
}

function integer(value: unknown, minimum = 0): number {
  const parsed = finiteNumber(value, minimum);
  if (!Number.isSafeInteger(parsed)) return invalid();
  return parsed;
}

function nullableInteger(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return integer(value, 1);
}

function nullableTimestamp(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return integer(value, 0);
}

function canonicalOrder(value: unknown): CanonicalOrder {
  const source = record(value);
  const status = nonEmptyString(source.canonicalStatus);
  if (!STATUS_SET.has(status)) return invalid();
  const parsed: CanonicalOrder = {
    orderNo: nonEmptyString(source.orderNo),
    productId: integer(source.productId, 1),
    productNo: nonEmptyString(source.productNo),
    productName: nonEmptyString(source.productName),
    quantity: integer(source.quantity, 1),
    unitPriceUsdt: finiteNumber(source.unitPriceUsdt),
    discountUsdt: finiteNumber(source.discountUsdt),
    amountUsdt: finiteNumber(source.amountUsdt),
    paymentMethod: nullableString(source.paymentMethod),
    paymentStatus: nonEmptyString(source.paymentStatus),
    orderStatus: nonEmptyString(source.orderStatus),
    activationStatus: nonEmptyString(source.activationStatus),
    canonicalStatus: status as CanonicalOrderStatus,
    orderType: nonEmptyString(source.orderType),
    placedAt: integer(source.placedAt, 0),
    paidAt: nullableTimestamp(source.paidAt),
    activatedAt: nullableTimestamp(source.activatedAt),
    dataCenter: nullableString(source.dataCenter),
    tradeinNo: nullableString(source.tradeinNo),
    sourceDeviceId: nullableInteger(source.sourceDeviceId),
    targetDeviceId: nullableInteger(source.targetDeviceId),
    targetDeviceInstanceNo: nullableString(source.targetDeviceInstanceNo),
  };
  const paymentStatus = parsed.paymentStatus.toUpperCase();
  const orderStatus = parsed.orderStatus.toUpperCase();
  const activationStatus = parsed.activationStatus.toUpperCase();
  const coherentStatus = (() => {
    switch (parsed.canonicalStatus) {
      case "placed":
        return paymentStatus === "PENDING" && orderStatus === "PENDING_PAYMENT"
          && activationStatus === "WAITING_PAYMENT" && parsed.paidAt === null
          && parsed.activatedAt === null;
      case "paid":
        return paymentStatus === "PAID" && orderStatus === "PAID"
          && activationStatus === "WAITING_PROVISIONING" && parsed.paidAt !== null
          && parsed.activatedAt === null;
      case "provisioning":
        return paymentStatus === "PAID" && (orderStatus === "PROCESSING" || orderStatus === "PROVISIONING")
          && activationStatus === "PROVISIONING" && parsed.paidAt !== null
          && parsed.activatedAt === null;
      case "activated":
        return paymentStatus === "PAID" && orderStatus === "COMPLETED"
          && activationStatus === "ACTIVATED" && parsed.paidAt !== null && parsed.activatedAt !== null;
      case "payment_failed":
        return paymentStatus === "FAILED" && orderStatus === "PAYMENT_FAILED"
          && activationStatus === "WAITING_PAYMENT";
      case "expired":
        return paymentStatus === "EXPIRED" && orderStatus === "EXPIRED"
          && activationStatus === "WAITING_PAYMENT";
      case "provisioning_failed":
        return paymentStatus === "PAID" && orderStatus === "PROVISIONING_FAILED"
          && activationStatus === "PROVISIONING_FAILED";
      case "refunded":
        return paymentStatus === "REFUNDED" && orderStatus === "REFUNDED"
          && activationStatus === "REFUNDED";
      case "chargeback":
        return paymentStatus === "CHARGEBACK" && orderStatus === "CHARGEBACK"
          && activationStatus === "DEACTIVATED";
      case "cancelled":
        return paymentStatus === "CANCELLED" && orderStatus === "CANCELLED"
          && activationStatus === "WAITING_PAYMENT";
    }
  })();
  if (!coherentStatus) return invalid();
  return parsed;
}

function createdOrder(value: unknown): CreatedOrder {
  const source = record(value);
  if (source.idSource !== "server") return invalid();
  const rawRedemption = source.voucherRedemption;
  const redemption = rawRedemption === null || rawRedemption === undefined ? null : record(rawRedemption);
  const voucherRedemption = redemption === null ? null : {
    voucherId: nonEmptyString(redemption.voucherId),
    grantId: nonEmptyString(redemption.grantId),
    status: redemption.status === "REDEEMED" ? "REDEEMED" as const : invalid(),
    discountUsdt: finiteNumber(redemption.discountUsdt),
  };
  const parsed: CreatedOrder = {
    orderNo: nonEmptyString(source.orderNo),
    subtotalUsdt: finiteNumber(source.subtotalUsdt),
    discountUsdt: finiteNumber(source.discountUsdt),
    amountUsdt: finiteNumber(source.amountUsdt),
    voucherId: nullableString(source.voucherId),
    voucherRedemption,
    paymentStatus: nonEmptyString(source.paymentStatus),
    orderStatus: nonEmptyString(source.orderStatus),
    idSource: "server",
  };
  if (parsed.paymentStatus.toUpperCase() !== "PENDING"
      || parsed.orderStatus.toUpperCase() !== "PENDING_PAYMENT") {
    return invalid();
  }
  return parsed;
}

export function createOrderApi(client: ApiClient): OrderApi {
  return {
    async list(): Promise<CanonicalOrderList> {
      const payload = record(await client.request<unknown>({
        method: "GET",
        path: "/api/orders",
      }));
      if (!Array.isArray(payload.orders)) return invalid();
      return {
        source: nonEmptyString(payload.source),
        orders: payload.orders.map(canonicalOrder),
      };
    },

    async create(request): Promise<CreatedOrder> {
      const productNo = request.productNo.trim();
      if (!productNo || !Number.isSafeInteger(request.quantity) || request.quantity < 1
          || !request.idempotencyKey.trim()) {
        return invalid();
      }
      return createdOrder(await client.request<unknown>({
        method: "POST",
        path: "/api/orders",
        idempotencyKey: request.idempotencyKey,
        body: {
          productNo,
          quantity: request.quantity,
          voucherId: request.voucherId ?? null,
        },
      }));
    },
  };
}
