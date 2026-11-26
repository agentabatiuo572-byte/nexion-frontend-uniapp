import { deviceE3Api, onboardingCalibrationApi } from "@/api/runtime";
import { isCanonicalDeviceActiveLifecycle } from "@/api/device-e3-api";
import { ApiError } from "@/api/errors";
import type { OnboardingCalibration } from "@/api/onboarding-calibration-api";

async function readPhoneFleet() {
  const fleet = await deviceE3Api.fleet();
  if (!fleet.serverCanonical || fleet.sourceEnvironment !== "PRODUCTION" || fleet.runId !== "")
    throw new ApiError({ kind: "protocol", message: "ONBOARDING_PHONE_FLEET_SCOPE_INVALID" });
  return fleet.devices.filter(device => /^(phone|mobile)$/i.test(device.deviceType));
}

/** The calibration row can remain ACTIVE after H5 login releases the phone's slot. */
export async function readCurrentPhoneActive(result: OnboardingCalibration): Promise<boolean> {
  if (result.activationStatus !== "ACTIVE" || !result.userDeviceId) return false;
  const [eligibility, devices] = await Promise.all([onboardingCalibrationApi.activationEligibility(), readPhoneFleet()]);
  const binding = eligibility.binding;
  const device = devices.find(entry => entry.id === result.userDeviceId);
  return binding?.installationId === result.deviceId && binding.userDeviceId === result.userDeviceId
    && !!device && isCanonicalDeviceActiveLifecycle(device.status)
    && device.activatedAt !== null && device.deactivatedAt === null;
}

export async function readReplacementSourceDevice(id: number | null) {
  if (id === null) return null;
  try {
    const device = (await readPhoneFleet()).find(entry => entry.id === id);
    return device?.name && device.instanceNo && device.productCode ? {
      name: device.name, instanceNo: device.instanceNo, imageKey: device.productCode,
      imageUrl: device.imageUrl ?? null, destination: "stop-accepting-tasks" as const,
    } : null;
  } catch {
    return null;
  }
}
