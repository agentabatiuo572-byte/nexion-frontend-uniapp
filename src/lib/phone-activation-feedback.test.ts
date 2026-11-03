import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { en } from "@/i18n/messages/en";
import { zh } from "@/i18n/messages/zh";
import { vi as vietnamese } from "@/i18n/messages/vi";
import { confirmedPhoneActivationRejection, phoneActivationFeedback } from "./phone-activation-feedback";

const groups = [
  ["CAPACITY_REPLACEMENT_REQUIRED", "devices"],
  ["PHONE_REPLACEMENT_DISABLED PHONE_REPLACEMENT_LIMIT_REACHED PHONE_REPLACEMENT_HISTORY_UNKNOWN PHONE_BINDING_TIME_UNKNOWN PHONE_REPLACEMENT_RISK_PAUSED PHONE_EXECUTION_UNSUPPORTED ONBOARDING_USER_ENVIRONMENT_MISMATCH ONBOARDING_RUNTIME_PROFILE_UNSUPPORTED", "support"],
  ["PHONE_REPLACEMENT_COOLDOWN PHONE_REPLACEMENT_POLICY_UNAVAILABLE BINDING_VERSION_CHANGED POLICY_VERSION_CHANGED GRANT_STATE_CHANGED PHONE_REPLACEMENT_CONFIRMATION_REQUIRED", "retry"],
  ["PHONE_CALIBRATION_RULES_CHANGED ONBOARDING_CALIBRATION_REQUIRED ONBOARDING_CALIBRATION_NOT_FOUND ONBOARDING_CALIBRATION_REVISION_CONFLICT PHONE_CALIBRATION_PENDING_VERIFICATION", "recalibrate"],
  ["CURRENT_APP_REQUIRED APP_SESSION_REQUIRED PHONE_EXECUTION_SESSION_REQUIRED INSTALLATION_MISMATCH PHONE_INSTALLATION_ID_MISMATCH SESSION_REPLACED USER_AUTH_REQUIRED", "login"],
  ["ONBOARDING_DEVICE_INVALID ONBOARDING_SIGNAL_INVALID ONBOARDING_ACTIVATION_REQUEST_INVALID ONBOARDING_REVISION_INVALID PHONE_ACTIVATION_VERSIONS_REQUIRED IDEMPOTENCY_KEY_INVALID IDEMPOTENCY_KEY_REQUIRED IDEMPOTENCY_MISMATCH ONBOARDING_ACTIVATION_IDEMPOTENCY_CONFLICT ONBOARDING_IDEMPOTENCY_CONFLICT PHONE_OPERATION_NOT_PENDING", "support"],
  ["ONBOARDING_CALIBRATION_CONFIG_UNAVAILABLE ONBOARDING_CALIBRATION_READBACK_FAILED ONBOARDING_CALIBRATION_PAYLOAD_INVALID ONBOARDING_COMPARISON_UNAVAILABLE PHONE_RISK_SETTINGS_UNAVAILABLE PHONE_BINDING_STATUS_UNAVAILABLE ONBOARDING_PHONE_BIND_FAILED ONBOARDING_PHONE_BIND_READBACK_FAILED ONBOARDING_ACTIVATION_READBACK_FAILED ONBOARDING_PHONE_TASK_READ_FAILED ONBOARDING_PHONE_TASK_CANCEL_CONFLICT PHONE_REPLACEMENT_WRITE_CONFLICT PHONE_OPERATION_SERIALIZATION_FAILED PHONE_OPERATION_RECEIPT_UNAVAILABLE", "retry"],
] as const;

describe("phone activation reason feedback", () => {
  for (const [codes, action] of groups) {
    it.each(codes.split(" "))("provides a translated cause and recovery for %s", code => {
      const feedback = phoneActivationFeedback(code);
      expect(feedback?.action).toBe(action);
      for (const locale of [en, zh, vietnamese]) {
        const copy = locale.onboarding[feedback!.detail];
        expect(typeof copy).toBe("string"); expect(String(copy).length).toBeGreaterThan(10);
        expect(copy).not.toContain(code);
      }
    });
  }
  it("does not treat a matching message or unknown conflict as a settled rejection", () => {
    for (const cause of [new Error("CAPACITY_REPLACEMENT_REQUIRED"),
      new ApiError({ kind: "network", message: "CAPACITY_REPLACEMENT_REQUIRED" }),
      new ApiError({ kind: "protocol", message: "CAPACITY_REPLACEMENT_REQUIRED" }),
      new ApiError({ kind: "http", status: 503, message: "CAPACITY_REPLACEMENT_REQUIRED" }),
      new ApiError({ kind: "business", code: 503, message: "CAPACITY_REPLACEMENT_REQUIRED" }),
      new ApiError({ kind: "http", status: 409, message: "UNKNOWN_CONFLICT" }),
      new ApiError({ kind: "business", code: 409, message: "IDEMPOTENCY_MISMATCH" })]) {
      expect(confirmedPhoneActivationRejection(cause)).toBe(false);
    }
    expect(confirmedPhoneActivationRejection(new ApiError({ kind: "business", code: 409, message: "CAPACITY_REPLACEMENT_REQUIRED" }))).toBe(true);
    expect(confirmedPhoneActivationRejection(new ApiError({ kind: "http", status: 409, message: "POLICY_VERSION_CHANGED" }))).toBe(true);
    for (const code of ["FUTURE_UNKNOWN_REASON", "__proto__", "constructor", "toString"]) {
      expect(phoneActivationFeedback(code)).toBeUndefined();
    }
  });
});
