import { describe, expect, it, vi } from "vitest";
import { bankAccountNotice, bankBeneficiaryReady, bankCanQuote, bankOrderOutcome } from "./bank-withdrawal-state";
import { createBankWithdrawalApi, parseBankRecovery, parseBankUnresolvedIntent, type BankBeneficiary, type BankConfig } from "@/api/bank-withdrawal-api";

const now = Date.parse("2026-09-16T00:00:00Z");
const beneficiary: BankBeneficiary = {
  bankCode: "", bankName: "BANKQR", maskedAccount: "****6789", effectiveAt: "2026-09-15T00:00:00Z", nextChangeAt: "2026-09-21T00:00:00Z",
  canWithdraw: true,
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
    expect(bankCanQuote(loaded)).toBe(true);
    expect(loaded.unresolvedIntent).toBeNull();
  });
  it("accepts a bound account immediately while retaining authoritative channel and intent gates", () => {
    expect(bankCanQuote(config)).toBe(true);
    expect(bankBeneficiaryReady({ ...beneficiary, effectiveAt: "2026-09-17T00:00:00Z" })).toBe(true);
    expect(bankAccountNotice(beneficiary)).toBe("ready");
    for (const canWithdraw of [false, undefined]) {
      expect(bankBeneficiaryReady({ ...beneficiary, canWithdraw })).toBe(false);
      expect(bankAccountNotice({ ...beneficiary, canWithdraw })).toBe("unavailable");
    }
    expect(bankCanQuote({ ...config, enabled: false })).toBe(false);
    expect(bankCanQuote({ ...config, beneficiary: null })).toBe(false);
    expect(bankCanQuote({ ...config, unresolvedIntent: undefined })).toBe(false);
  });
  it("restores server account intents across devices and rejects ambiguous or malformed pointers", async () => {
    const intent = { state: "NOT_SUBMITTED", quoteNo: quote.quoteNo, withdrawalNo: null, expiresAt: quote.expiresAt, providerState: null };
    const unresolvedIntent = { state: "NOT_SUBMITTED", intents: [intent], quoteNo: quote.quoteNo, withdrawalNo: null };
    const request = vi.fn().mockResolvedValue({ ...config, unresolvedIntent });
    const api = createBankWithdrawalApi({ request } as never);
    const loaded = await api.config();
    expect(loaded.unresolvedIntent?.quoteNo).toBe(quote.quoteNo);
    expect(bankCanQuote(loaded)).toBe(false);
    expect(() => parseBankUnresolvedIntent({ ...unresolvedIntent, quoteNo: `BQ-${"b".repeat(32)}` })).toThrow();
    expect(() => parseBankUnresolvedIntent({ ...unresolvedIntent, state: "UNKNOWN" })).toThrow();
    expect(() => parseBankUnresolvedIntent({ ...unresolvedIntent, state: "MULTIPLE" })).toThrow();
    expect(parseBankRecovery({ state: "EXPIRED" })).toEqual({ state: "EXPIRED" });
  });
  it("does not expose or call the retired external verification endpoint", async () => {
    const request = vi.fn().mockResolvedValue({ ...config, beneficiary: { ...beneficiary,
      verificationStatus: "unavailable", expiresAt: "invalid", ownershipStatus: "unknown" } });
    const api = createBankWithdrawalApi({ request } as never);
    expect("verify" in api).toBe(false);
    expect(bankBeneficiaryReady((await api.config()).beneficiary)).toBe(true);
    expect(request).toHaveBeenCalledExactlyOnceWith({path: "/api/withdrawals/bank/config", authenticated: true});
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
