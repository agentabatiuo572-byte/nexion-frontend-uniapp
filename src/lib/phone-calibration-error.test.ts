import { describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { phoneCalibrationErrorDetail } from "./phone-calibration-error";

describe("phone calibration failure copy", () => {
  it("explains missing server trust and the safe deferred path", () => {
    const detail = phoneCalibrationErrorDetail("PHONE_NATIVE_PROOF_NOT_CONFIGURED", en.onboarding);
    expect(detail).toContain("does not trust this Android package");
    expect(detail).toContain("Not now");
    expect(detail).toContain("Device inventory");
  });

  it("explains when the TEST server has not enabled defer", () => {
    expect(phoneCalibrationErrorDetail("PHONE_NATIVE_SESSION_REQUIRED", en.onboarding, true))
      .toContain("server is updated");
    expect(phoneCalibrationErrorDetail("PHONE_NATIVE_SESSION_REQUIRED", en.onboarding)).toBeNull();
    expect(phoneCalibrationErrorDetail("NETWORK_UNAVAILABLE", en.onboarding)).toBeNull();
  });
});
