import type { BankBeneficiary, BankConfig, BankOrder } from "@/api/bank-withdrawal-api";
import { parseServerTimestamp } from "@/api/server-time";

export function bankBeneficiaryReady(beneficiary: BankBeneficiary | null | undefined): boolean {
  return !!beneficiary && beneficiary.canWithdraw === true;
}

export function bankCanQuote(config: BankConfig | null): boolean {
  return config?.enabled === true && config.unresolvedIntent === null && bankBeneficiaryReady(config.beneficiary);
}

export type BankAccountNotice = "ready" | "unavailable";
export function bankAccountNotice(beneficiary: BankBeneficiary): BankAccountNotice {
  return bankBeneficiaryReady(beneficiary) ? "ready" : "unavailable";
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
