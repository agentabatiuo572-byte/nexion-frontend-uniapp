import type { DeveloperAccessReceipt, DeveloperAccessStatus } from "@/api/developer-access-api";

type DeveloperAccessStatusCopyKey =
  | "requestStatusPending"
  | "requestStatusApproved"
  | "requestStatusRejected"
  | "requestStatusRevoked"
  | "requestStatusExpired"
  | "requestStatusPendingDetail"
  | "requestStatusApprovedDetail"
  | "requestStatusRejectedDetail"
  | "requestStatusRevokedDetail"
  | "requestStatusExpiredDetail";

export type DeveloperAccessCopyKey = DeveloperAccessStatusCopyKey
  | "reviewReasonIdentityVerificationRequired"
  | "reviewReasonBusinessInformationInsufficient"
  | "reviewReasonPolicyRequirementsNotMet"
  | "reviewReasonAccessRevokedByPolicy";

export interface DeveloperAccessState {
  label: Extract<DeveloperAccessStatusCopyKey, `requestStatus${string}`>;
  detail: Extract<DeveloperAccessStatusCopyKey, `requestStatus${string}Detail`>;
  canReapply: boolean;
}

const STATE: Record<DeveloperAccessStatus, DeveloperAccessState> = {
  PENDING: { label: "requestStatusPending", detail: "requestStatusPendingDetail", canReapply: false },
  APPROVED: { label: "requestStatusApproved", detail: "requestStatusApprovedDetail", canReapply: false },
  REJECTED: { label: "requestStatusRejected", detail: "requestStatusRejectedDetail", canReapply: true },
  REVOKED: { label: "requestStatusRevoked", detail: "requestStatusRevokedDetail", canReapply: true },
  // This is a legacy read-model value. The App never derives it from time or
  // changes a request into EXPIRED locally.
  EXPIRED: { label: "requestStatusExpired", detail: "requestStatusExpiredDetail", canReapply: true },
};

export function developerAccessState(receipt: DeveloperAccessReceipt | null): DeveloperAccessState | null {
  return receipt ? STATE[receipt.status] : null;
}

export function developerAccessReviewReasonKey(receipt: DeveloperAccessReceipt | null):
  | "reviewReasonIdentityVerificationRequired"
  | "reviewReasonBusinessInformationInsufficient"
  | "reviewReasonPolicyRequirementsNotMet"
  | "reviewReasonAccessRevokedByPolicy"
  | null {
  switch (receipt?.reviewReason) {
    case "IDENTITY_VERIFICATION_REQUIRED": return "reviewReasonIdentityVerificationRequired";
    case "BUSINESS_INFORMATION_INSUFFICIENT": return "reviewReasonBusinessInformationInsufficient";
    case "POLICY_REQUIREMENTS_NOT_MET": return "reviewReasonPolicyRequirementsNotMet";
    case "ACCESS_REVOKED_BY_POLICY": return "reviewReasonAccessRevokedByPolicy";
    default: return null;
  }
}
