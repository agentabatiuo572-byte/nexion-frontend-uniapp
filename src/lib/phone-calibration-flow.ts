import type { CalibrationRequestSignals, OnboardingCalibration, OnboardingCalibrationApi } from "@/api/onboarding-calibration-api";
import { ApiError } from "@/api/errors";
import { beginPhoneCommand, confirmedPhoneWriteRejection, finishPhoneCommand, readPhoneCommand, type PhoneCommand } from "@/lib/phone-onboarding-commands";

interface Options {
  deviceId: string;
  accountKey: string;
  isCurrent: () => boolean;
}

export function calibrationBelongsTo(result: OnboardingCalibration, accountKey: string, deviceId: string): boolean {
  return result.serverCanonical === true && result.source === "server"
    && result.sourceEnvironment === "PRODUCTION" && result.runId === ""
    && accountKey === `user:${result.userId}` && result.deviceId === deviceId;
}

export function isMissingPhoneCalibration(error: unknown): boolean {
  return error instanceof ApiError && error.message === "ONBOARDING_CALIBRATION_NOT_FOUND"
    && ((error.kind === "http" && error.status === 404) || (error.kind === "business" && error.code === 404));
}

function checkScope(options: Options) {
  if (!options.isCurrent()) throw new Error("ONBOARDING_CALIBRATION_SCOPE_STALE");
}

function accept(result: OnboardingCalibration, options: Options) {
  checkScope(options);
  if (!calibrationBelongsTo(result, options.accountKey, options.deviceId)) {
    throw new ApiError({ kind: "protocol", message: "ONBOARDING_CALIBRATION_SCOPE_INVALID" });
  }
  return result;
}

/** A pending write keeps its exact observations, revision and key across page instances. */
export function createPhoneCalibrationFlow(deps: {
  api: Pick<OnboardingCalibrationApi, "result" | "calibrate">;
  collect: () => CalibrationRequestSignals | Promise<CalibrationRequestSignals>;
}) {
  let intent: PhoneCommand<"calibrate"> | null = null;
  function settle() {
    if (intent) finishPhoneCommand("calibrate", intent);
    intent = null;
  }

  return {
    reset() { intent = null; },
    restore(options: Options) {
      intent = readPhoneCommand(options, "calibrate");
      return !!intent;
    },
    hasPendingWrite() { return intent !== null; },
    async read(options: Options): Promise<OnboardingCalibration | null> {
      checkScope(options);
      let result: OnboardingCalibration;
      try {
        result = await deps.api.result(options.deviceId);
      } catch (cause) {
        checkScope(options);
        if (isMissingPhoneCalibration(cause)) return null;
        throw cause;
      }
      return accept(result, options);
    },
    reconcile(current: OnboardingCalibration | null): OnboardingCalibration | null {
      if (!intent || !current || (intent.hadResult && current.revision <= intent.revision)) return null;
      settle();
      return current;
    },
    async write(options: Options, current: OnboardingCalibration | null, resend = false): Promise<OnboardingCalibration> {
      checkScope(options);
      if (resend && !intent) throw new Error("PHONE_CALIBRATION_COMMAND_UNAVAILABLE");
      if (!resend) {
        const signals = await deps.collect();
        checkScope(options);
        const command = beginPhoneCommand(options, "calibrate", {
          signals, revision: current?.revision ?? 0, hadResult: current !== null,
        });
        intent = command.value;
        if (command.reused) throw new Error("PHONE_CALIBRATION_COMMAND_PENDING");
      }
      const command = intent!;
      try {
        const result = accept(await deps.api.calibrate(command.deviceId, command.signals,
          command.revision, command.idempotencyKey), options);
        settle();
        return result;
      } catch (cause) {
        checkScope(options);
        if (confirmedPhoneWriteRejection(cause)) settle();
        throw cause;
      }
    },
  };
}
