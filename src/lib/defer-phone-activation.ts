import { onboardingCalibrationApi, remoteApiEnabled } from "@/api/runtime";
import { beginPhoneCommand, confirmedPhoneWriteRejection, finishPhoneCommand, type PhoneCommand, type PhoneCommandScope } from "@/lib/phone-onboarding-commands";
import { isMissingPhoneCalibration } from "@/lib/phone-calibration-flow";
import { useApp } from "@/store/app";
import { useSession } from "@/store/session";
import type { OnboardingCalibration } from "@/api/onboarding-calibration-api";

interface ConfirmDeferredPhoneActivationOptions {
  current?: OnboardingCalibration | null;
  initialOnly?: boolean;
  deviceId: string;
  isCurrent: () => boolean;
  accept: (result: OnboardingCalibration) => boolean;
}

function stale(): never {
  throw new Error("ONBOARDING_CALIBRATION_SCOPE_STALE");
}

/**
 * Persist an explicit "activate later" choice as a server-authoritative
 * DEFERRED state. A missing calibration is valid here: the backend records a
 * revision-0 tombstone without inventing phone capability or reward facts.
 */
export async function confirmDeferredPhoneActivation(
  options: ConfirmDeferredPhoneActivationOptions & PhoneCommandScope,
  remember: (command: PhoneCommand<"defer">) => void,
  original?: PhoneCommand<"defer">,
): Promise<OnboardingCalibration | null> {
  let command = original;
  if (!command) {
    let current = options.current ?? null;
    if (!current) {
      try {
        current = await onboardingCalibrationApi.result(options.deviceId);
        if (!options.accept(current)) stale();
      } catch (error: unknown) {
        if (!options.isCurrent()) stale();
        if (!isMissingPhoneCalibration(error)) throw error;
      }
    }
    if (current?.activationStatus === "DEFERRED") return current;
    if (current?.activationStatus === "ACTIVE") throw new Error("PHONE_DEFER_ACTIVE");
    if (!options.isCurrent()) stale();
    const pending = beginPhoneCommand(options, "defer", { revision: current?.revision ?? 0, initialOnly: options.initialOnly ?? false });
    command = pending.value;
    remember(command);
    if (pending.reused) return null;
  }
  if (!options.isCurrent()) stale();
  try {
    const result = await onboardingCalibrationApi.defer(command.deviceId, command.revision, command.idempotencyKey, command.initialOnly);
    if (!options.isCurrent()) stale();
    if (!options.accept(result) || result.activationStatus !== "DEFERRED") return null;
    finishPhoneCommand("defer", command);
    return result;
  } catch (cause) {
    if (!options.isCurrent()) stale();
    if (confirmedPhoneWriteRejection(cause)) {
      finishPhoneCommand("defer", command);
      throw cause;
    }
    return null;
  }
}

/** Update this installation only after the server has confirmed DEFERRED. */
export function syncDeferredPhoneActivation(accountKey: string): boolean {
  const session = useSession();
  if (session.isCurrentDevicePhoneActivationDeferred(accountKey)) return true;
  const app = useApp();
  const phone = app.devices.find((device) => device.kind === "phone");
  return (remoteApiEnabled || !phone || app.deactivateDevice(phone.id))
    && session.markPhoneActivationDeferred(accountKey);
}
