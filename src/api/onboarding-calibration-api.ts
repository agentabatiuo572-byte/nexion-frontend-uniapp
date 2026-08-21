import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import { captureCommerceSandboxRun, isCurrentCommerceSandboxRun, setCurrentCommerceSandboxRun } from "./order-api";

export type OnboardingCalibrationEnvironment = "PRODUCTION" | "SANDBOX";
export type PhoneActivationStatus = "CALIBRATED" | "ACTIVE" | "DEFERRED";

export interface CalibrationSignals {
  memGB: number | null;
  cores: number | null;
  model: string;
  brand: string;
  gpu: string;
  pxDensity: number | null;
  pingMs: number | null;
  batteryLevel: number | null;
  charging: boolean | null;
  networkReachable: boolean | null;
}

/** Raw device observations may be unavailable; null is preserved to the server. */
export type CalibrationRequestSignals = CalibrationSignals;

export interface CalibrationComparison {
  key: string;
  label: string;
  dailyUsdt: number;
  dailyNex: number;
  sortOrder: number;
}

interface OnboardingCalibrationBase {
  userId: number;
  deviceId: string;
  serverCanonical: true;
  source: "server";
  sourceEnvironment: OnboardingCalibrationEnvironment;
  runId: string;
  revision: number;
  configRevision: number;
  activationStatus: PhoneActivationStatus;
  comparisonConfig: CalibrationComparison[];
}

export interface MeasuredOnboardingCalibration extends OnboardingCalibrationBase {
  calibrationAvailable: true;
  score: number;
  tier: number;
  tierName: string;
  tops: number;
  baseRateUsdt: number;
  baseRateNex: number;
  signals: CalibrationSignals;
}

export interface DeferredOnboardingCalibration extends OnboardingCalibrationBase {
  activationStatus: "DEFERRED";
  calibrationAvailable: false;
  score: null;
  tier: null;
  tierName: null;
  tops: null;
  baseRateUsdt: null;
  baseRateNex: null;
  signals: null;
}

export type OnboardingCalibration = MeasuredOnboardingCalibration | DeferredOnboardingCalibration;

export interface OnboardingCalibrationApi {
  calibrate(deviceId: string, signals: CalibrationRequestSignals, expectedRevision: number, idempotencyKey: string): Promise<OnboardingCalibration>;
  result(deviceId: string): Promise<OnboardingCalibration>;
  activate(deviceId: string, expectedRevision: number, idempotencyKey: string): Promise<OnboardingCalibration>;
  defer(deviceId: string, expectedRevision: number, idempotencyKey: string): Promise<OnboardingCalibration>;
}

function invalid(): never {
  throw new ApiError({ kind: "protocol", message: "ONBOARDING_CALIBRATION_RESPONSE_INVALID" });
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return invalid();
  return value.trim();
}

function optionalText(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length > max) return invalid();
  return value;
}

function bool(value: unknown): boolean {
  if (typeof value !== "boolean") return invalid();
  return value;
}

function number(value: unknown, min = 0, max = Number.POSITIVE_INFINITY): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return invalid();
  return value;
}

function integer(value: unknown, min = 0): number {
  const result = number(value, min);
  if (!Number.isInteger(result)) return invalid();
  return result;
}

function boundedInteger(value: unknown, min: number, max: number): number {
  const result = integer(value, min);
  if (result > max) return invalid();
  return result;
}

function nullableNumber(value: unknown, min = 0, max = Number.POSITIVE_INFINITY): number | null {
  return value === null ? null : number(value, min, max);
}

function nullableBoundedInteger(value: unknown, min: number, max: number): number | null {
  return value === null ? null : boundedInteger(value, min, max);
}

function signals(value: unknown): CalibrationSignals {
  const row = record(value);
  return {
    memGB: nullableNumber(row.memGB, 0, 128), cores: nullableBoundedInteger(row.cores, 1, 256), model: optionalText(row.model, 128), brand: optionalText(row.brand, 128),
    gpu: optionalText(row.gpu, 256), pxDensity: nullableNumber(row.pxDensity, 1, 10_000), pingMs: nullableNumber(row.pingMs, 0, 5_000),
    batteryLevel: nullableBoundedInteger(row.batteryLevel, 0, 100), charging: row.charging === null ? null : bool(row.charging), networkReachable: row.networkReachable === null ? null : bool(row.networkReachable),
  };
}

const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{7,95}$/;

export function commitOnboardingSandboxRun(result: OnboardingCalibration): boolean {
  if (result.sourceEnvironment !== "SANDBOX") return true;
  // Parsing a response must never mutate shared sandbox scope. The page first
  // proves that the response still belongs to its mounted account/request and
  // only then commits the first authenticated RunID without an await gap.
  if (captureCommerceSandboxRun().runId === null) setCurrentCommerceSandboxRun(result.runId);
  return isCurrentCommerceSandboxRun(result.runId);
}

export function parseOnboardingCalibration(
  value: unknown,
  expectedEnvironment?: OnboardingCalibrationEnvironment,
  allowUnestablishedSandboxRun = false,
): OnboardingCalibration {
  const row = record(value);
  if (row.serverCanonical !== true || row.source !== "server") return invalid();
  const sourceEnvironment = row.sourceEnvironment;
  const runId = row.runId;
  if ((sourceEnvironment !== "PRODUCTION" && sourceEnvironment !== "SANDBOX")
      || (expectedEnvironment !== undefined && sourceEnvironment !== expectedEnvironment)
      || typeof runId !== "string"
      || (sourceEnvironment === "PRODUCTION" && runId !== "")
      || (sourceEnvironment === "SANDBOX" && (
        !RUN_ID.test(runId)
        || (!isCurrentCommerceSandboxRun(runId)
          && !(allowUnestablishedSandboxRun && captureCommerceSandboxRun().runId === null))
      ))) return invalid();
  if (row.activationStatus !== "CALIBRATED" && row.activationStatus !== "ACTIVE" && row.activationStatus !== "DEFERRED") return invalid();
  if (typeof row.calibrationAvailable !== "boolean") return invalid();
  const comparisonConfig = Array.isArray(row.comparisonConfig) ? row.comparisonConfig.map((entry) => {
    const item = record(entry);
    return { key: text(item.key), label: text(item.label),
      dailyUsdt: number(item.dailyUsdt, Number.MIN_VALUE, 999_999_999_999.999999),
      dailyNex: number(item.dailyNex, Number.MIN_VALUE, 999_999_999_999.999999),
      sortOrder: integer(item.sortOrder) };
  }) : invalid();
  const common = {
    userId: integer(row.userId, 1), deviceId: text(row.deviceId), serverCanonical: true, source: "server",
    sourceEnvironment, runId,
    revision: integer(row.revision), configRevision: integer(row.configRevision), activationStatus: row.activationStatus,
  } as const;
  if (!row.calibrationAvailable) {
    if (row.activationStatus !== "DEFERRED" || common.configRevision !== 0 || comparisonConfig.length !== 0
        || row.score !== null || row.tier !== null || row.tierName !== null || row.tops !== null
        || row.baseRateUsdt !== null || row.baseRateNex !== null || row.signals !== null) return invalid();
    return {
      ...common, activationStatus: "DEFERRED", calibrationAvailable: false, score: null, tier: null, tierName: null, tops: null,
      baseRateUsdt: null, baseRateNex: null, signals: null, comparisonConfig,
    };
  }
  if (!Number.isInteger(row.tier) || (row.tier as number) < 1 || (row.tier as number) > 5) return invalid();
  return {
    ...common, calibrationAvailable: true,
    score: boundedInteger(row.score, 62, 98),
    tier: row.tier as number, tierName: text(row.tierName), tops: number(row.tops, 8, 58),
    baseRateUsdt: number(row.baseRateUsdt, Number.MIN_VALUE), baseRateNex: number(row.baseRateNex, Number.MIN_VALUE), signals: signals(row.signals), comparisonConfig,
  };
}

function key(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(normalized)) {
    throw new ApiError({ kind: "configuration", message: "IDEMPOTENCY_KEY_REQUIRED" });
  }
  return normalized;
}

export function createOnboardingCalibrationApi(client: ApiClient, environment: OnboardingCalibrationEnvironment = "PRODUCTION"): OnboardingCalibrationApi {
  return {
    async calibrate(deviceId, rawSignals, expectedRevision, idempotencyKey) {
      const normalizedDeviceId = text(deviceId);
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
        throw new ApiError({ kind: "configuration", message: "ONBOARDING_REVISION_INVALID" });
      }
      const response = await client.request({
        method: "POST", path: "/api/onboarding/calibrate", idempotencyKey: key(idempotencyKey),
        body: { deviceId: normalizedDeviceId, expectedRevision, signals: rawSignals },
      });
      return parseOnboardingCalibration(response, environment, true);
    },
    async result(deviceId) {
      const normalizedDeviceId = text(deviceId);
      const response = await client.request({
        method: "GET", path: `/api/onboarding/calibrate/result?deviceId=${encodeURIComponent(normalizedDeviceId)}`,
      });
      return parseOnboardingCalibration(response, environment, true);
    },
    async activate(deviceId, expectedRevision, idempotencyKey) {
      const normalizedDeviceId = text(deviceId);
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
        throw new ApiError({ kind: "configuration", message: "ONBOARDING_REVISION_INVALID" });
      }
      const response = await client.request({
        method: "POST", path: "/api/onboarding/calibrate/activate", idempotencyKey: key(idempotencyKey),
        body: { deviceId: normalizedDeviceId, expectedRevision },
      });
      return parseOnboardingCalibration(response, environment, true);
    },
    async defer(deviceId, expectedRevision, idempotencyKey) {
      const normalizedDeviceId = text(deviceId);
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
        throw new ApiError({ kind: "configuration", message: "ONBOARDING_REVISION_INVALID" });
      }
      const response = await client.request({
        method: "POST", path: "/api/onboarding/calibrate/defer", idempotencyKey: key(idempotencyKey),
        body: { deviceId: normalizedDeviceId, expectedRevision },
      });
      return parseOnboardingCalibration(response, environment, true);
    },
  };
}
