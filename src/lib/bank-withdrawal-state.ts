import type { BankBeneficiary, BankConfig, BankOrder } from "@/api/bank-withdrawal-api";
import { parseServerTimestamp } from "@/api/server-time";

export function bankBeneficiaryReady(beneficiary: BankBeneficiary | null | undefined, now = Date.now()): boolean {
  return !!beneficiary && beneficiary.canWithdraw === true && beneficiary.verificationStatus === "verified"
    && beneficiary.payoutCapability === "supported" && beneficiary.ownershipStatus === "matched"
    && beneficiary.accountType === "payment_account" && !!beneficiary.evidenceRef && !!beneficiary.capabilityVersion
    && (parseServerTimestamp(beneficiary.checkedAt) ?? Infinity) <= now
    && (parseServerTimestamp(beneficiary.expiresAt) ?? -Infinity) > now
    && (parseServerTimestamp(beneficiary.effectiveAt) ?? Infinity) <= now;
}

export function bankCanQuote(config: BankConfig | null, now = Date.now()): boolean {
  return config?.enabled === true && config.unresolvedIntent === null && bankBeneficiaryReady(config.beneficiary, now);
}

export type BankAccountNotice = "verified" | "pending" | "unavailable" | "unsupported" | "mismatch" | "expired" | "protected";
export function bankAccountNotice(beneficiary: BankBeneficiary, now = Date.now()): BankAccountNotice {
  if (beneficiary.payoutCapability === "unsupported" || ["credit_card", "prepaid"].includes(beneficiary.accountType ?? "")) return "unsupported";
  if (beneficiary.ownershipStatus === "mismatched" || beneficiary.verificationStatus === "rejected") return "mismatch";
  if (beneficiary.verificationStatus === "pending") return "pending";
  if (beneficiary.verificationStatus !== "verified" || beneficiary.payoutCapability !== "supported") return "unavailable";
  if ((parseServerTimestamp(beneficiary.expiresAt) ?? -Infinity) <= now) return "expired";
  if ((parseServerTimestamp(beneficiary.effectiveAt) ?? Infinity) > now) return "protected";
  return bankBeneficiaryReady(beneficiary, now) ? "verified" : "unavailable";
}

export function bankOrderOutcome(order: BankOrder): "paid" | "refunded" | "review" | "processing" | "held" {
  const e = order.settlementEvidence;
  if (order.providerState === "MANUAL_REVIEW" || e?.status === "review_required") return "held";
  const proven = !!e?.evidenceRef && parseServerTimestamp(e.checkedAt) != null
    && e.amountUsdt != null && e.amountUsdt > 0 && e.amountUsdt === order.bank.amountUsdt;
  if (proven && e?.status === "paid" && e.providerOrderId && e.providerStatus === 3
    && order.status === "CONFIRMED" && order.providerState === "PAID") return "paid";
  if (proven && e?.status === "refunded" && ["FAILED", "REFUNDED", "REVIEW_REJECTED"].includes(order.status)
    && order.providerState !== "PAID") return "refunded";
  if (["CONFIRMED", "FAILED", "REFUNDED", "REVIEW_REJECTED", "FROZEN", "TX_ORPHANED"].includes(order.status)
    || order.providerState === "PAID" || order.providerState === "FAILED") return "held";
  return ["PROCESSING", "SENT"].includes(order.status) ? "processing" : "review";
}
