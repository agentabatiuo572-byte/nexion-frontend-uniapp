import {
  PURCHASE_ELIGIBILITY_SOURCE,
  type PurchaseEligibilitySnapshot,
} from "@/api/purchase-eligibility-api";

export type PurchaseEligibilityRequestStatus = "idle" | "loading" | "ready" | "error";
export type PurchaseEligibilityMessage = "eligible" | "ineligible" | "quotaDepleted" | "error";

/**
 * Resolve checkout copy from the server response only. A response that is
 * unknown, internally inconsistent, or absent is an error: local rank/team
 * snapshots must never turn it into a more specific deny reason.
 */
export function resolvePurchaseEligibilityMessage(
  status: PurchaseEligibilityRequestStatus,
  snapshot: PurchaseEligibilitySnapshot | null,
): PurchaseEligibilityMessage {
  if (status !== "ready" || !snapshot) return "error";
  if (snapshot.source !== PURCHASE_ELIGIBILITY_SOURCE) return "error";
  if (snapshot.decisionCode === "ELIGIBLE") return snapshot.eligible ? "eligible" : "error";
  if (snapshot.decisionCode === "PURCHASE_GATE_NOT_MET") return snapshot.eligible ? "error" : "ineligible";
  if (snapshot.decisionCode === "PURCHASE_GATE_SOLD_OUT") return snapshot.eligible ? "error" : "quotaDepleted";
  if (snapshot.decisionCode === "F4B_REQUIREMENTS_NOT_MET") return snapshot.eligible ? "error" : "ineligible";
  if (snapshot.decisionCode === "F4B_MONTHLY_QUOTA_EXHAUSTED") return snapshot.eligible ? "error" : "quotaDepleted";
  return "error";
}
