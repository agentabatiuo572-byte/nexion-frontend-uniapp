import { deviceE3Api, onboardingCalibrationApi, remoteApiEnabled } from "@/api/runtime";
import { ApiError } from "@/api/errors";
import { beginPhoneCommand, confirmedPhoneWriteRejection, finishPhoneCommand, type PhoneCommand, type PhoneCommandScope } from "@/lib/phone-onboarding-commands";
import { isMissingPhoneCalibration } from "@/lib/phone-calibration-flow";
import { useApp } from "@/store/app";
import { useSession } from "@/store/session";
import type { OnboardingCalibration } from "@/api/onboarding-calibration-api";

interface DeferredPhoneActivationCommand {
  revision: number;
  idempotencyKey: string;
}

interface ConfirmDeferredPhoneActivationOptions {
  current?: OnboardingCalibration | null;
  initialOnly?: boolean;
  deviceId: string;
  command: (revision: number) => DeferredPhoneActivationCommand;
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
  options: Omit<ConfirmDeferredPhoneActivationOptions, "command"> & PhoneCommandScope,
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

/** H5 initial setup only: never convert an existing calibration/phone to DEFERRED. */
export async function confirmInitialWebPhoneDeferral(
  options: ConfirmDeferredPhoneActivationOptions,
): Promise<OnboardingCalibration> {
  const check = () => { if (!options.isCurrent()) stale(); };
  const read = async () => {
    check();
    const result = await onboardingCalibrationApi.result(options.deviceId);
    if (!options.accept(result)) stale();
    return result;
  };
  const deferred = (result: OnboardingCalibration) => {
    if (result.activationStatus !== "DEFERRED") throw new Error("PHONE_WEB_SETUP_READ_ONLY");
    return result;
  };
  try { return deferred(await read()); }
  catch (cause) {
    check();
    if (!(cause instanceof ApiError) || cause.kind !== "http" || cause.status !== 404
        || cause.message !== "ONBOARDING_CALIBRATION_NOT_FOUND") throw cause;
  }
  // Read the real fleet, including inactive phone records. A browser must not
  // use its missing installation row to stop a phone bound on another install.
  const fleet = await deviceE3Api.fleet();
  check();
  if (fleet.serverCanonical !== true || fleet.sourceEnvironment !== "PRODUCTION" || fleet.runId !== "") stale();
  if (fleet.devices.some(device => /phone|mobile/i.test(device.deviceType))) {
    throw new Error("PHONE_WEB_SETUP_READ_ONLY");
  }
  const command = options.command(0);
  check();
  try {
    const result = await onboardingCalibrationApi.defer(options.deviceId, 0, command.idempotencyKey, true);
    if (!options.accept(result)) stale();
    deferred(result);
  } catch (cause) {
    check();
    // A lost reply may already have committed. Recover only by the same scoped
    // GET; a later explicit retry reads first and reuses this page's command.
    try { return deferred(await read()); }
    catch (readError) {
      check();
      if (readError instanceof Error && readError.message === "ONBOARDING_CALIBRATION_SCOPE_STALE") throw readError;
      throw cause;
    }
  }
  // A POST acknowledgement alone never completes the browser's setup.
  return deferred(await read());
}
