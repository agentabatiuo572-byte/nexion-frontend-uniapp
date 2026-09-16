import { describe, expect, it, vi } from "vitest";
import { bankAccountNotice, bankBeneficiaryReady, bankCanQuote, bankOrderOutcome } from "./bank-withdrawal-state";
import { createBankWithdrawalApi, parseBankRecovery, parseBankUnresolvedIntent, type BankBeneficiary, type BankConfig } from "@/api/bank-withdrawal-api";

const now = Date.parse("2026-09-16T00:00:00Z");
const beneficiary: BankBeneficiary = {
  bankCode: "", bankName: "BANKQR", maskedAccount: "****6789", effectiveAt: "2026-09-15T00:00:00Z", nextChangeAt: "2026-09-21T00:00:00Z",
  verificationStatus: "verified", payoutCapability: "supported", ownershipStatus: "matched", accountType: "payment_account", canWithdraw: true,
  checkedAt: "2026-09-15T00:00:00Z", expiresAt: "2026-10-01T00:00:00Z", evidenceRef: "verification-1", capabilityVersion: "1",
};
const config: BankConfig = { enabled: true, banks: [], beneficiary, unresolvedIntent: null };
const quote = { quoteNo: `BQ-${"a".repeat(32)}`, amountUsdt: 100, feeUsdt: 1, netUsdt: 99, rateVnd: 25000,
  amountVnd: 2475000, bankCode: "", bankName: "BANKQR", maskedAccount: "****6789", expiresAt: "2026-09-16T00:05:00Z" };
const receipt = { state: "COMMITTED", withdrawalNo: "WD-TEST", withdrawal: { withdrawalNo: "WD-TEST", chain: "BANK-VND", status: "CONFIRMED" },
  providerState: "PAID", bank: quote,
  settlementEvidence: { status: "paid", evidenceRef: "ledger-1", providerOrderId: "provider-1", providerStatus: 3, checkedAt: "2026-09-16T00:00:00Z", amountUsdt: 100 } };
function outcome(value: unknown) { const order = parseBankRecovery(value); if (order.state !== "COMMITTED") throw new Error("Expected order"); return bankOrderOutcome(order); }

describe("bank account authority and settlement evidence", () => {
  it("keeps malformed auxiliary evidence readable without authorizing a payout or terminal result", async () => {
    for (const change of [{checkedAt:"invalid"},{amountUsdt:"0x64"},{amountUsdt:"1e200"},{amountUsdt:"100.0000001"},{amountUsdt:100.0000001},{providerStatus:"3"}]) {
      expect(outcome({...receipt,settlementEvidence:{...receipt.settlementEvidence,...change}})).toBe("held");
    }
    expect(outcome({...receipt,settlementEvidence:{...receipt.settlementEvidence,amountUsdt:99.999999}})).toBe("held");
    const request = vi.fn().mockResolvedValue({...config,beneficiary:{...beneficiary,checkedAt:"invalid"}});
    const loaded = await createBankWithdrawalApi({request} as never).config();
    expect(loaded.beneficiary?.maskedAccount).toBe(beneficiary.maskedAccount);
    expect(bankCanQuote(loaded,now)).toBe(false);
    expect(loaded.unresolvedIntent).toBeNull();
  });
  it("requires all independent gates; waiting 24 hours or possessing a payment card cannot authorize payout", () => {
    expect(bankCanQuote(config, now)).toBe(true);
    const changes: Partial<BankBeneficiary>[] = [
      { canWithdraw: false }, { canWithdraw: undefined }, { verificationStatus: undefined }, { verificationStatus: "pending" },
      { payoutCapability: "unknown" }, { payoutCapability: "unsupported" }, { ownershipStatus: "mismatched" }, { ownershipStatus: "unknown" },
      { accountType: "credit_card" }, { accountType: "prepaid" }, { accountType: "unknown" }, { evidenceRef: null }, { checkedAt: null },
      { capabilityVersion: null }, { expiresAt: null }, { expiresAt: "2026-09-15T00:00:00Z" }, { effectiveAt: "2026-09-17T00:00:00Z" },
    ];
    for (const change of changes) expect(bankBeneficiaryReady({ ...beneficiary, ...change }, now), JSON.stringify(change)).toBe(false);
    expect(bankCanQuote({ ...config, enabled: false }, now)).toBe(false);
    expect(bankCanQuote({ ...config, beneficiary: null }, now)).toBe(false);
    expect(bankCanQuote({ ...config, unresolvedIntent: undefined }, now)).toBe(false);
    expect(bankAccountNotice({ ...beneficiary, payoutCapability: "unsupported" }, now)).toBe("unsupported");
    expect(bankAccountNotice({ ...beneficiary, effectiveAt: "2026-09-17T00:00:00Z", canWithdraw: false }, now)).toBe("protected");
    expect(bankBeneficiaryReady({ ...beneficiary, canWithdraw: false }, now + 86400000)).toBe(false);
  });
  it("restores server account intents across devices and rejects ambiguous or malformed pointers", async () => {
    const intent = { state: "NOT_SUBMITTED", quoteNo: quote.quoteNo, withdrawalNo: null, expiresAt: quote.expiresAt, providerState: null };
    const unresolvedIntent = { state: "NOT_SUBMITTED", intents: [intent], quoteNo: quote.quoteNo, withdrawalNo: null };
    const request = vi.fn().mockResolvedValue({ ...config, unresolvedIntent });
    const api = createBankWithdrawalApi({ request } as never);
    const loaded = await api.config();
    expect(loaded.unresolvedIntent?.quoteNo).toBe(quote.quoteNo);
    expect(bankCanQuote(loaded, now)).toBe(false);
    expect(() => parseBankUnresolvedIntent({ ...unresolvedIntent, quoteNo: `BQ-${"b".repeat(32)}` })).toThrow();
    expect(() => parseBankUnresolvedIntent({ ...unresolvedIntent, state: "UNKNOWN" })).toThrow();
    expect(() => parseBankUnresolvedIntent({ ...unresolvedIntent, state: "MULTIPLE" })).toThrow();
    expect(parseBankRecovery({ state: "EXPIRED" })).toEqual({ state: "EXPIRED" });
  });
  it("verification retries use the existing account endpoint and keep unavailable capability closed", async () => {
    const request = vi.fn().mockResolvedValue({ beneficiary: { ...beneficiary, verificationStatus: "unavailable", payoutCapability: "unknown", canWithdraw: false } });
    const actual = await createBankWithdrawalApi({ request } as never).verify();
    expect(request).toHaveBeenCalledExactlyOnceWith({ path: "/api/withdrawals/bank/beneficiary/verify", method: "POST", authenticated: true });
    expect(bankBeneficiaryReady(actual, now)).toBe(false);
  });
  it("terminal labels and new-withdrawal access require matching ledger evidence", () => {
    expect(outcome(receipt)).toBe("paid");
    for (const settlementEvidence of [undefined, { ...receipt.settlementEvidence, evidenceRef: null },
      { ...receipt.settlementEvidence, amountUsdt: 99 }, { ...receipt.settlementEvidence, status: "unconfirmed" },
      { ...receipt.settlementEvidence, checkedAt: null }, { ...receipt.settlementEvidence, providerOrderId: null }])
      expect(outcome({ ...receipt, settlementEvidence })).toBe("held");
    expect(outcome({ ...receipt, providerState: "MANUAL_REVIEW" })).toBe("held");
    const failed = { ...receipt, withdrawal: { ...receipt.withdrawal, status: "FAILED" }, providerState: "FAILED", settlementEvidence: undefined };
    expect(outcome(failed)).toBe("held");
    expect(outcome({ ...failed, settlementEvidence: { ...receipt.settlementEvidence, status: "refunded", providerStatus: 5 } })).toBe("refunded");
    expect(outcome({ ...receipt, withdrawal: { ...receipt.withdrawal, status: "SENT" }, providerState: "PENDING", settlementEvidence: undefined })).toBe("processing");
  });
});
