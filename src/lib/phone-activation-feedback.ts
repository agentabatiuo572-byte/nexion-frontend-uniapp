import { ApiError } from "@/api/errors";
import type { Messages } from "@/i18n/messages/en";

type Action = "retry" | "recalibrate" | "support" | "login" | "devices" | "terms";
type Feedback = { detail: keyof Messages["onboarding"]; action: Action };
const reasons: Record<string, Feedback> = Object.create(null);
function add(codes: string, detail: Feedback["detail"], action: Action = "retry") {
  for (const code of codes.split(" ")) reasons[code] = { detail, action };
}
add("CAPACITY_REPLACEMENT_REQUIRED", "phoneActivationCapacityFull", "devices");
add("PHONE_REPLACEMENT_DISABLED", "phoneReplacementDisabled", "support");
add("PHONE_REPLACEMENT_COOLDOWN", "phoneReplacementCooldown");
add("PHONE_REPLACEMENT_LIMIT_REACHED", "phoneReplacementLimitReached", "support");
add("PHONE_REPLACEMENT_HISTORY_UNKNOWN", "phoneReplacementHistoryUnknown", "support");
add("PHONE_BINDING_TIME_UNKNOWN", "phoneBindingTimeUnknown", "support");
add("PHONE_REPLACEMENT_RISK_PAUSED", "phoneReplacementRiskPaused", "support");
add("PHONE_REPLACEMENT_POLICY_UNAVAILABLE", "phoneReplacementPolicyUnavailable");
add("BINDING_VERSION_CHANGED", "phoneActivationBindingChanged");
add("POLICY_VERSION_CHANGED", "phoneActivationPolicyChanged");
add("GRANT_STATE_CHANGED", "phoneActivationGrantChanged");
add("PHONE_REPLACEMENT_CONFIRMATION_REQUIRED", "phoneActivationConfirmationRequired");
add("PHONE_CALIBRATION_RULES_CHANGED", "phoneCalibrationRulesChanged", "recalibrate");
add("ONBOARDING_CALIBRATION_REQUIRED ONBOARDING_CALIBRATION_NOT_FOUND", "phoneActivationCalibrationRequired", "recalibrate");
add("ONBOARDING_CALIBRATION_REVISION_CONFLICT", "phoneActivationCalibrationChanged", "recalibrate");
add("PHONE_CALIBRATION_PENDING_VERIFICATION", "phoneCalibrationPendingBody", "recalibrate");
add("CURRENT_APP_REQUIRED APP_SESSION_REQUIRED PHONE_EXECUTION_SESSION_REQUIRED", "phoneActivationAppSessionRequired", "login");
add("PHONE_EXECUTION_UNSUPPORTED", "phoneActivationUnsupported", "support");
add("INSTALLATION_MISMATCH PHONE_INSTALLATION_ID_MISMATCH", "phoneActivationInstallationMismatch", "login");
add("SESSION_REPLACED", "phoneActivationSessionReplaced", "login");
add("USER_AUTH_REQUIRED", "phoneActivationAuthRequired", "login");
add("ONBOARDING_USER_ENVIRONMENT_MISMATCH ONBOARDING_RUNTIME_PROFILE_UNSUPPORTED", "phoneActivationEnvironmentMismatch", "support");
add("TERMS_ACCEPTANCE_REQUIRED LEGAL_TERMS_ACCEPTANCE_REQUIRED LEGAL_TERMS_VERSION_CHANGED", "phoneActivationTermsRequired", "terms");
add("ONBOARDING_DEVICE_INVALID ONBOARDING_SIGNAL_INVALID ONBOARDING_ACTIVATION_REQUEST_INVALID ONBOARDING_REVISION_INVALID PHONE_ACTIVATION_VERSIONS_REQUIRED IDEMPOTENCY_KEY_INVALID IDEMPOTENCY_KEY_REQUIRED", "phoneActivationRequestInvalid", "support");
add("IDEMPOTENCY_MISMATCH ONBOARDING_ACTIVATION_IDEMPOTENCY_CONFLICT ONBOARDING_IDEMPOTENCY_CONFLICT PHONE_OPERATION_NOT_PENDING", "phoneActivationOperationConflict", "support");
add("ONBOARDING_CALIBRATION_CONFIG_UNAVAILABLE ONBOARDING_CALIBRATION_READBACK_FAILED ONBOARDING_CALIBRATION_PAYLOAD_INVALID ONBOARDING_COMPARISON_UNAVAILABLE PHONE_RISK_SETTINGS_UNAVAILABLE PHONE_BINDING_STATUS_UNAVAILABLE ONBOARDING_PHONE_BIND_FAILED ONBOARDING_PHONE_BIND_READBACK_FAILED ONBOARDING_ACTIVATION_READBACK_FAILED ONBOARDING_PHONE_TASK_READ_FAILED ONBOARDING_PHONE_TASK_CANCEL_CONFLICT PHONE_REPLACEMENT_WRITE_CONFLICT PHONE_OPERATION_SERIALIZATION_FAILED PHONE_OPERATION_RECEIPT_UNAVAILABLE LEGAL_TERMS_UNAVAILABLE LEGAL_TERMS_ENVIRONMENT_UNAVAILABLE", "phoneActivationServiceUnavailable");

export function phoneActivationFeedback(code: string): Feedback | undefined { return reasons[code]; }

/** A message alone cannot prove a rejection: transport/protocol/5xx errors remain uncertain. */
export function confirmedPhoneActivationRejection(cause: unknown): boolean {
  if (!(cause instanceof ApiError)) return false;
  const status = cause.kind === "http" ? cause.status : cause.code ?? cause.status;
  if (cause.kind !== "business" && cause.kind !== "http" && cause.kind !== "auth") return false;
  if (status === undefined || status < 400 || status >= 500 || [408, 425, 429].includes(status)) return false;
  if (status === 409 && (!reasons[cause.message] || cause.message.includes("IDEMPOTENCY")
      || cause.message === "PHONE_OPERATION_NOT_PENDING")) return false;
  return true;
}
