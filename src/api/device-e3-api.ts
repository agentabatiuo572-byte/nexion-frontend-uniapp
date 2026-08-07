import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";

export interface CanonicalE3Device {
  id: number;
  instanceNo: string;
  name: string;
  deviceType: string;
  productCode: string;
  status: string;
  activatedAt: number | null;
  purchasedAt: number | null;
  dailyUsdt: number;
  dailyNex: number;
  gpuModel: string;
  vramTotalGb: number;
  basePowerW: number;
  location: string;
  capacityPct: number;
  capacityAgeMonths: number;
  capacityConfigKey: string;
  capacitySubsidized: boolean;
  capacitySubsidyDays: number;
  actualPaidUsdt: number;
  cumulativeOutputUsdt: number;
}

export interface CanonicalE3Fleet {
  dailyUsdt: number;
  dailyNex: number;
  walletUsdt: number;
  walletNex: number;
  userJoinedAt: number;
  serverNow: number;
  devices: CanonicalE3Device[];
  capacitySchedule: Record<string, string>;
  source: string;
}

export interface CanonicalTradeinConfig {
  enabled: boolean;
  eligibility: string;
  outputRatioCutsPct: number[];
  creditRatesPct: number[];
  requireHigherPrice: boolean;
  maxDevicesPerOrder: number;
  source: string;
}

export interface CanonicalTradeinQuote {
  sourceDeviceId: number;
  sourceProductName: string;
  targetProductId: number;
  targetProductNo: string;
  targetProductName: string;
  sourceActualPaidUsdt: number;
  cumulativeOutputUsdt: number;
  outputRatioPct: number;
  creditRatePct: number;
  discountUsdt: number;
  targetPriceUsdt: number;
  payableUsdt: number;
  walletBalanceUsdt: number;
  walletShortfallUsdt: number;
  sufficientFunds: boolean;
  discountToWallet: false;
  pricingSource: string;
}

export interface CanonicalTradeinResult {
  tradeinNo: string;
  orderNo: string;
  sourceDeviceId: number;
  targetDeviceId: number;
  applicationStatus: string;
  orderStatus: string;
  discountUsdt: number;
  walletDebitUsdt: number;
  walletBalanceAfterUsdt: number;
}

export interface DeviceE3Api {
  fleet(): Promise<CanonicalE3Fleet>;
  tradeinConfig(): Promise<CanonicalTradeinConfig>;
  quote(sourceDeviceId: number, targetProductNo: string): Promise<CanonicalTradeinQuote>;
  submit(
    sourceDeviceId: number,
    targetProductNo: string,
    idempotencyKey: string,
  ): Promise<CanonicalTradeinResult>;
  activate(deviceId: number, clientMaxDevices: number, idempotencyKey: string): Promise<void>;
}

function invalid(message = "E3_CANONICAL_RESPONSE_INVALID"): never {
  throw new ApiError({ kind: "protocol", message });
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}

function string(value: unknown, allowEmpty = false): string {
  if (typeof value !== "string") return invalid();
  const normalized = value.trim();
  if (!allowEmpty && !normalized) return invalid();
  return normalized;
}

function number(value: unknown, minimum = 0): number {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed < minimum) return invalid();
  return parsed;
}

function integer(value: unknown, minimum = 0): number {
  const parsed = number(value, minimum);
  if (!Number.isInteger(parsed)) return invalid();
  return parsed;
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") return invalid();
  return value;
}

function timestamp(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return invalid();
}

function numberArray(value: unknown, length: number): number[] {
  if (!Array.isArray(value) || value.length !== length) return invalid();
  return value.map((entry) => number(entry));
}

function stringMap(value: unknown): Record<string, string> {
  const source = record(value);
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (!key.trim() || typeof entry !== "string" || !entry.trim()) return invalid();
    result[key] = entry;
  }
  return result;
}

function device(value: unknown): CanonicalE3Device {
  const source = record(value);
  return {
    id: integer(source.id, 1),
    instanceNo: string(source.instanceNo),
    name: string(source.name),
    deviceType: string(source.deviceType),
    productCode: string(source.productCode),
    status: string(source.status).toUpperCase(),
    activatedAt: timestamp(source.activatedAt),
    purchasedAt: timestamp(source.purchasedAt),
    dailyUsdt: number(source.dailyUsdt),
    dailyNex: number(source.dailyNex),
    gpuModel: string(source.gpuModel ?? "", true),
    vramTotalGb: integer(source.vramTotalGb ?? 0),
    basePowerW: number(source.basePowerW ?? 0),
    location: string(source.location ?? "", true),
    capacityPct: number(source.capacityPct),
    capacityAgeMonths: integer(source.capacityAgeMonths),
    capacityConfigKey: string(source.capacityConfigKey),
    capacitySubsidized: boolean(source.capacitySubsidized),
    capacitySubsidyDays: integer(source.capacitySubsidyDays),
    actualPaidUsdt: number(source.actualPaidUsdt),
    cumulativeOutputUsdt: number(source.cumulativeOutputUsdt),
  };
}

function fleet(value: unknown): CanonicalE3Fleet {
  const source = record(value);
  if (!Array.isArray(source.devices)) return invalid();
  const devices = source.devices.map(device);
  if (new Set(devices.map((entry) => entry.id)).size !== devices.length) return invalid();
  return {
    dailyUsdt: number(source.dailyUsdt),
    dailyNex: number(source.dailyNex),
    walletUsdt: number(source.walletUsdt),
    walletNex: number(source.walletNex),
    userJoinedAt: integer(source.userJoinedAt),
    serverNow: integer(source.serverNow),
    devices,
    capacitySchedule: stringMap(source.capacitySchedule),
    source: string(source.source),
  };
}

function config(value: unknown): CanonicalTradeinConfig {
  const source = record(value);
  const cuts = numberArray(source.outputRatioCutsPct, 4);
  const credits = numberArray(source.creditRatesPct, 5);
  if (!cuts.every((entry, index) => index === 0 || cuts[index - 1] < entry)) return invalid();
  if (!credits.every((entry, index) => index === 0 || credits[index - 1] > entry)) return invalid();
  return {
    enabled: boolean(source.enabled),
    eligibility: string(source.eligibility),
    outputRatioCutsPct: cuts,
    creditRatesPct: credits,
    requireHigherPrice: boolean(source.requireHigherPrice),
    maxDevicesPerOrder: integer(source.maxDevicesPerOrder, 1),
    source: string(source.source),
  };
}

function quote(value: unknown): CanonicalTradeinQuote {
  const source = record(value);
  const discountToWallet = boolean(source.discountToWallet);
  if (discountToWallet) return invalid("TRADEIN_WALLET_CREDIT_FORBIDDEN");
  const result: CanonicalTradeinQuote = {
    sourceDeviceId: integer(source.sourceDeviceId, 1),
    sourceProductName: string(source.sourceProductName),
    targetProductId: integer(source.targetProductId, 1),
    targetProductNo: string(source.targetProductNo),
    targetProductName: string(source.targetProductName),
    sourceActualPaidUsdt: number(source.sourceActualPaidUsdt),
    cumulativeOutputUsdt: number(source.cumulativeOutputUsdt),
    outputRatioPct: number(source.outputRatioPct),
    creditRatePct: number(source.creditRatePct),
    discountUsdt: number(source.discountUsdt),
    targetPriceUsdt: number(source.targetPriceUsdt),
    payableUsdt: number(source.payableUsdt),
    walletBalanceUsdt: number(source.walletBalanceUsdt),
    walletShortfallUsdt: number(source.walletShortfallUsdt),
    sufficientFunds: boolean(source.sufficientFunds),
    discountToWallet: false,
    pricingSource: string(source.pricingSource),
  };
  if (
    result.discountUsdt > result.targetPriceUsdt
    || Math.abs((result.targetPriceUsdt - result.discountUsdt) - result.payableUsdt) > 0.00001
    || result.sufficientFunds !== (result.walletShortfallUsdt === 0)
  ) return invalid();
  return result;
}

function result(value: unknown): CanonicalTradeinResult {
  const source = record(value);
  return {
    tradeinNo: string(source.tradeinNo),
    orderNo: string(source.orderNo),
    sourceDeviceId: integer(source.sourceDeviceId, 1),
    targetDeviceId: integer(source.targetDeviceId, 1),
    applicationStatus: string(source.applicationStatus).toUpperCase(),
    orderStatus: string(source.orderStatus).toUpperCase(),
    discountUsdt: number(source.discountUsdt),
    walletDebitUsdt: number(source.walletDebitUsdt),
    walletBalanceAfterUsdt: number(source.walletBalanceAfterUsdt),
  };
}

function validTargetNo(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._:-]{1,64}$/.test(normalized)) {
    throw new ApiError({ kind: "configuration", message: "TRADEIN_TARGET_PRODUCT_INVALID" });
  }
  return normalized;
}

export function createDeviceE3Api(client: ApiClient): DeviceE3Api {
  return {
    async fleet() {
      return fleet(await client.request<unknown>({ path: "/api/devices/earnings" }));
    },
    async tradeinConfig() {
      return config(await client.request<unknown>({ path: "/api/app/trade-in/config" }));
    },
    async quote(sourceDeviceId, targetProductNo) {
      return quote(await client.request<unknown>({
        method: "POST",
        path: "/api/app/trade-in/quote",
        body: { sourceDeviceId: integer(sourceDeviceId, 1), targetProductNo: validTargetNo(targetProductNo) },
      }));
    },
    async submit(sourceDeviceId, targetProductNo, idempotencyKey) {
      const key = idempotencyKey.trim();
      if (!key) throw new ApiError({ kind: "configuration", message: "IDEMPOTENCY_KEY_REQUIRED" });
      return result(await client.request<unknown>({
        method: "POST",
        path: "/api/app/trade-in/submit",
        body: { sourceDeviceId: integer(sourceDeviceId, 1), targetProductNo: validTargetNo(targetProductNo) },
        idempotencyKey: key,
      }));
    },
    async activate(deviceId, clientMaxDevices, idempotencyKey) {
      const key = idempotencyKey.trim();
      if (!key) throw new ApiError({ kind: "configuration", message: "IDEMPOTENCY_KEY_REQUIRED" });
      await client.request<unknown>({
        method: "POST",
        path: "/api/devices/activate",
        body: { deviceId: integer(deviceId, 1), clientMaxDevices: integer(clientMaxDevices, 1) },
        idempotencyKey: key,
      });
    },
  };
}
