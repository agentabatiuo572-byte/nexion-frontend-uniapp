import type { Messages } from "@/i18n/messages/en";

export function phoneCalibrationErrorDetail(code: string, t: Messages["onboarding"], defer = false): string | null {
  switch (code) {
    case "PHONE_NATIVE_PROOF_NOT_CONFIGURED": return t.phoneProofNotConfigured;
    case "PHONE_NATIVE_PROOF_UNAVAILABLE": return t.phoneProofUnavailable;
    case "PHONE_NATIVE_PROOF_INVALID": return t.phoneProofInvalid;
    case "PHONE_NATIVE_TRUST_UNAVAILABLE": return t.phoneProofTrustUnavailable;
    case "PHONE_NATIVE_SESSION_REQUIRED": return defer ? t.phoneDeferServerOutdated : null;
    default: return null;
  }
}
