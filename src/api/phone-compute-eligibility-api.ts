import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import { matchesRuntimeProvenance } from "./runtime-provenance";
import type { ApiEnvironment } from "./runtime-config";

export const phoneComputeBlockers = ["PHONE_DEVICE_INACTIVE", "PHONE_BINDING_REQUIRED", "PHONE_CALIBRATION_REQUIRED",
  "PHONE_EXECUTION_SESSION_REQUIRED", "PHONE_TELEMETRY_STALE", "PHONE_OFFLINE", "PHONE_LOW_BATTERY",
  "PHONE_DEVICE_PAUSED", "PHONE_EXECUTOR_UNAVAILABLE"] as const;
export type PhoneComputeBlocker = typeof phoneComputeBlockers[number];
export interface PhoneComputeEligibility {
  executorSupported: boolean;
  supportedTaskClasses: string[];
  devices: { deviceId: number; eligible: boolean; blockers: PhoneComputeBlocker[] }[];
}

/** Capability is a server fact; a native shell or a calibrated score cannot grant it. */
export function createPhoneComputeEligibilityApi(client: ApiClient, mode: ApiEnvironment) {
  return { async read(): Promise<PhoneComputeEligibility> {
    const value = await client.request<unknown>({ path: "/api/tasks/phone/eligibility" });
    const invalid = (): never => { throw new ApiError({ kind: "protocol", message: "PHONE_COMPUTE_ELIGIBILITY_INVALID" }); };
    if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
    const source = value as Record<string, unknown>;
    if (!matchesRuntimeProvenance(source, mode, "server") || source.serverCanonical !== true
      || source.executionLocation !== "LOCAL_PHONE" || typeof source.executorSupported !== "boolean"
      || !Array.isArray(source.supportedTaskClasses) || !source.supportedTaskClasses.every(item => typeof item === "string" && /^(IG|VG|LL|FT|EM|SP)$/.test(item))
      || !Array.isArray(source.devices)) return invalid();
    const devices = source.devices.map(value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
      const row = value as Record<string, unknown>;
      if (typeof row.deviceId !== "number" || !Number.isInteger(row.deviceId) || row.deviceId <= 0
        || typeof row.eligible !== "boolean" || !Array.isArray(row.blockers)
        || !row.blockers.every(code => phoneComputeBlockers.includes(code))
        || (row.eligible && (!source.executorSupported || row.blockers.length > 0))) return invalid();
      return { deviceId: row.deviceId, eligible: row.eligible, blockers: row.blockers as PhoneComputeBlocker[] };
    });
    if (new Set(devices.map(row => row.deviceId)).size !== devices.length) return invalid();
    return { executorSupported: source.executorSupported, supportedTaskClasses: source.supportedTaskClasses as string[], devices };
  } };
}
