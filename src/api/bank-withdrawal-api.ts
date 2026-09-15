import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import { parseServerTimestamp } from "./server-time";

export interface BankBeneficiary { bankCode: string; bankName: string; maskedAccount: string; effectiveAt: string; nextChangeAt: string }
export interface BankConfig { enabled: boolean; banks: { code: string; name: string }[]; beneficiary: BankBeneficiary | null; bankCodeRequired?: boolean; bindingOtpRequired?: boolean; payType?: string }
export interface BankQuote {
  quoteNo: string; amountUsdt: number; feeUsdt: number; netUsdt: number; rateVnd: number;
  amountVnd: number; bankCode: string; bankName: string; maskedAccount: string; expiresAt: string;
}
export interface BankOrder { state: "COMMITTED"; withdrawalNo: string; status: string; providerState: string; bank: BankQuote }
export type BankRecovery = BankOrder | { state: "NOT_SUBMITTED"; quote: BankQuote } | { state: "ABANDONED" };
const invalid = () => new ApiError({ kind: "protocol", message: "BANK_WITHDRAWAL_RESPONSE_INVALID" });
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string { if (typeof value !== "string" || !value.trim()) throw invalid(); return value; }
function bankCode(value: unknown): string { if (typeof value !== "string" || !/^(?:[A-Za-z0-9]{2,16})?$/.test(value)) throw invalid(); return value; }
function number(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") throw invalid();
  const n = Number(value); if (!Number.isFinite(n) || n < 0) throw invalid(); return n;
}
function date(value: unknown): string {
  const s = text(value); if (parseServerTimestamp(s) == null) throw invalid(); return s;
}
function beneficiary(value: unknown): BankBeneficiary {
  const r = record(value);
  if (typeof r.maskedAccount !== "string" || !/^[*•]{2,}[0-9]{4}$/.test(r.maskedAccount)) throw invalid();
  return { bankCode: bankCode(r.bankCode), bankName: text(r.bankName), maskedAccount: text(r.maskedAccount),
    effectiveAt: date(r.effectiveAt), nextChangeAt: date(r.nextChangeAt) };
}
export function parseBankQuote(value: unknown): BankQuote {
  const r = record(value);
  const q: BankQuote = { quoteNo: text(r.quoteNo), amountUsdt: number(r.amountUsdt), feeUsdt: number(r.feeUsdt),
    netUsdt: number(r.netUsdt), rateVnd: number(r.rateVnd), amountVnd: number(r.amountVnd), bankCode: bankCode(r.bankCode),
    bankName: text(r.bankName), maskedAccount: text(r.maskedAccount), expiresAt: date(r.expiresAt) };
  if (!/^BQ-[a-f0-9]{32}$/.test(q.quoteNo) || q.amountUsdt <= 0 || q.netUsdt <= 0 || q.rateVnd <= 0
      || !Number.isSafeInteger(q.amountVnd) || q.amountVnd <= 0 || Math.abs(q.amountUsdt - q.feeUsdt - q.netUsdt) > 0.000001) throw invalid();
  return q;
}
export function parseBankRecovery(value: unknown): BankRecovery {
  const r = record(value);
  if (r.state === "ABANDONED") return { state: "ABANDONED" };
  if (r.state === "NOT_SUBMITTED") return { state: "NOT_SUBMITTED", quote: parseBankQuote(r.quote) };
  const withdrawal = record(r.withdrawal);
  const no = text(r.withdrawalNo);
  if (r.state !== "COMMITTED" || !/^WD-[A-Z0-9]+$/.test(no) || withdrawal.withdrawalNo !== no || withdrawal.chain !== "BANK-VND") throw invalid();
  const status = text(withdrawal.status);
  if (!["REVIEW_PENDING", "REVIEWING", "REVIEW_PASSED", "DELAYED", "EXTENDED_HOLD", "FROZEN", "PROCESSING", "SENT", "TX_ORPHANED", "CONFIRMED", "FAILED", "REFUNDED", "REVIEW_REJECTED"].includes(status)) throw invalid();
  const providerState = text(r.providerState);
  if (!["READY", "DISPATCHING", "PENDING", "PAID", "FAILED", "MANUAL_REVIEW"].includes(providerState)) throw invalid();
  return { state: "COMMITTED", withdrawalNo: no, status, providerState, bank: parseBankQuote(r.bank) };
}
function forQuote(value: BankRecovery, quoteNo: string): BankRecovery {
  if (value.state === "COMMITTED" && value.bank.quoteNo !== quoteNo) throw invalid();
  if (value.state === "NOT_SUBMITTED" && value.quote.quoteNo !== quoteNo) throw invalid();
  return value;
}
export function createBankWithdrawalApi(client: ApiClient) {
  const base = "/api/withdrawals/bank";
  return {
    async config(): Promise<BankConfig> {
      const r = record(await client.request({ path: `${base}/config`, authenticated: true }));
      if (typeof r.enabled !== "boolean" || !Array.isArray(r.banks)) throw invalid();
      return { enabled: r.enabled, banks: r.banks.map(v => { const b = record(v); return { code: text(b.code), name: text(b.name) }; }),
        bankCodeRequired: r.bankCodeRequired !== false, bindingOtpRequired: r.bindingOtpRequired !== false,
        payType: typeof r.payType === "string" ? r.payType : undefined,
        beneficiary: r.beneficiary == null ? null : beneficiary(r.beneficiary) };
    },
    async bind(body: { bankCode: string; account: string; holder: string }, key: string): Promise<BankBeneficiary> {
      const r = record(await client.request({ path: `${base}/beneficiary`, method: "POST", body, idempotencyKey: key, authenticated: true }));
      const saved = beneficiary(r.beneficiary);
      if (saved.bankCode !== body.bankCode || !saved.maskedAccount.endsWith(body.account.slice(-4))) throw invalid();
      return saved;
    },
    async quote(amountUsdt: string): Promise<BankQuote> {
      return parseBankQuote(await client.request({ path: `${base}/quotes`, method: "POST", body: { amountUsdt }, authenticated: true }));
    },
    async submit(quoteNo: string, key: string): Promise<BankOrder> {
      const r = parseBankRecovery(await client.request({ path: `${base}/orders`, method: "POST", body: { quoteNo }, idempotencyKey: key, authenticated: true }));
      if (r.state !== "COMMITTED" || r.bank.quoteNo !== quoteNo) throw invalid(); return r;
    },
    async recover(quoteNo: string): Promise<BankRecovery> {
      return forQuote(parseBankRecovery(await client.request({ path: `${base}/quotes/${encodeURIComponent(quoteNo)}`, authenticated: true })), quoteNo);
    },
    async abandon(quoteNo: string): Promise<BankRecovery> {
      return forQuote(parseBankRecovery(await client.request({ path: `${base}/quotes/${encodeURIComponent(quoteNo)}/abandon`, method: "POST", authenticated: true })), quoteNo);
    },
    async get(orderNo: string): Promise<BankOrder> {
      const r = parseBankRecovery(await client.request({ path: `${base}/orders/${encodeURIComponent(orderNo)}`, authenticated: true }));
      if (r.state !== "COMMITTED" || r.withdrawalNo !== orderNo) throw invalid(); return r;
    },
  };
}
