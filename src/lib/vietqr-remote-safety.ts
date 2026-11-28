import { ApiError, isAmbiguousOutcome } from "@/api/errors";

export interface VietQrTransferStepCopy {
  scan: string;
  manual: (accountNumber: string, amountText: string) => string;
  amount: string;
  complete: string;
}

export function buildVietQrTransferSteps(
  qrPayload: string | undefined,
  accountNumber: string,
  amountText: string,
  copy: VietQrTransferStepCopy,
): string[] {
  const first = typeof qrPayload === "string" && qrPayload.trim().length > 0
    ? copy.scan
    : copy.manual(accountNumber, amountText);
  return [first, copy.amount, copy.complete];
}

export function remoteGenerationMatches(
  expectedAccountKey: string,
  expectedGeneration: number,
  currentAccountKey: string,
  currentGeneration: number,
): boolean {
  return expectedAccountKey === currentAccountKey && expectedGeneration === currentGeneration;
}

export function isPayableVietQrCreateStatus(status: string): boolean {
  return status === "awaiting_payment";
}

export function vietQrCreateUnavailableCopy(cause: unknown) {
  if (!(cause instanceof ApiError) || cause.kind !== "http" || cause.status !== 503 || cause.code !== 503) return;
  switch (cause.message) {
    case "LEGAL_TERMS_UNAVAILABLE": return "createTermsUnavailable";
    case "FX_QUOTE_UNAVAILABLE": return "createFxUnavailable";
    case "VIETQR_BANK_RAIL_UNAVAILABLE":
    case "VIETQR_CHANNEL_CONFIG_INVALID":
    case "VIETQR_CHANNEL_UNAVAILABLE": return "createBankUnavailable";
    case "HDPAY_CONFIGURATION_INCOMPLETE":
    case "PAYMENT_CONFIG_UNAVAILABLE": return "createServiceUnavailable";
  }
}

export function isVietQrCreateOutcomeUnknown(cause: unknown): boolean {
  if (!(cause instanceof ApiError) || vietQrCreateUnavailableCopy(cause)) return false;
  if (cause.kind === "network" || cause.kind === "protocol") return true;
  if (cause.kind !== "http") return false;
  if (cause.status === 409) return cause.message === "HDPAY_ORDER_SUBMISSION_IN_PROGRESS";
  return isAmbiguousOutcome(cause);
}

export function appendVietQrReceipts<T extends { receiptNo: string }>(
  existing: readonly T[],
  incoming: readonly T[],
): T[] {
  const seen = new Set(existing.map((item) => item.receiptNo));
  const appended = incoming.filter((item) => {
    if (seen.has(item.receiptNo)) return false;
    seen.add(item.receiptNo);
    return true;
  });
  return [...existing, ...appended];
}
