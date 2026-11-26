import type { CalibrationRequestSignals, OnboardingCalibration, OnboardingCalibrationApi } from "@/api/onboarding-calibration-api";
import { ApiError } from "@/api/errors";
import { confirmedPhoneActivationRejection } from "@/lib/phone-activation-feedback";

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

/** Keep this page's exact observations, revision and key while its write is unconfirmed. */
export function createPhoneCalibrationFlow(deps: {
  api: Pick<OnboardingCalibrationApi, "result" | "calibrate">;
  collect: () => CalibrationRequestSignals | Promise<CalibrationRequestSignals>;
  key: () => string;
}) {
  let intent: { signals: CalibrationRequestSignals; expectedRevision: number;
    hadResult: boolean; idempotencyKey: string } | null = null;

  return {
    reset() { intent = null; },
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
      if (!intent || !current) return null;
      // The first insert may return revision 0. For an existing row we need
      // a newer revision or an authoritative ACTIVE decision.
      if (intent.hadResult && current.revision <= intent.expectedRevision
          && current.activationStatus !== "ACTIVE") return null;
      intent = null;
      return current;
    },
    async write(options: Options, current: OnboardingCalibration | null): Promise<OnboardingCalibration> {
      checkScope(options);
      if (!intent) {
        const signals = await deps.collect();
        checkScope(options);
        intent = { signals, expectedRevision: current?.revision ?? 0, hadResult: current !== null, idempotencyKey: deps.key() };
      }
      const command = intent;
      try {
        const result = accept(await deps.api.calibrate(options.deviceId, command.signals,
          command.expectedRevision, command.idempotencyKey), options);
        intent = null;
        return result;
      } catch (cause) {
        checkScope(options);
        if (confirmedPhoneActivationRejection(cause)) intent = null;
        throw cause;
      }
    },
  };
}
