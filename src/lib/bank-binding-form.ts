import { reactive } from "vue";
import type { BankConfig, BankBeneficiary, createBankWithdrawalApi } from "@/api/bank-withdrawal-api";
import { isAmbiguousOutcome } from "@/api/errors";
import { requireCryptoUuid } from "@/lib/secure-command-id";
import { BANK_HOLDER_NAME_RE } from "@/lib/native-unicode-regex";
import { readAccountRow, writeAccountRow } from "@/store/account-scoped-storage";

type Recipient = { account: string; holder: string };
type BindingApi = Pick<ReturnType<typeof createBankWithdrawalApi>, "config" | "bind" | "sendOtp">;
type BindBody = Parameters<BindingApi["bind"]>[0];
type Phase = "details" | "uncertain" | "saved";
/** Reference fields only, so no bank details leave page memory. */
type ReceiptReference = { beneficiaryNo: string | null; effectiveAt: string; nextChangeAt: string; savedAt: number };
const RECEIPT_TABLE = "nexgrid-bank-binding-receipt-accounts-v1";
// The binding may change elsewhere, so a receipt that never matches must not block the form forever.
const RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;
export function validBankRecipient(draft: Recipient): boolean {
  const name = draft.holder.trim();
  return /^[0-9]{6,32}$/.test(draft.account.trim()) && name.length >= 2 && name.length <= 100
    && BANK_HOLDER_NAME_RE.test(name);
}
/** Account-only binding needs explicit server proof that bank routing is verified. */
export function directBankBindingAvailable(config: BankConfig | null): boolean {
  return config?.bankRoutingVerified === true && config.bankSelection === "ACCOUNT_ROUTED"
    && config.banks.length === 0 && config.payType === "BANKQR" && config.bankCodeRequired === false
    && config.bindingOtpRequired === !!config.beneficiary;
}
function sameBeneficiary(a: BankBeneficiary | null, b: BankBeneficiary): boolean {
  return !!a && a.bankCode === b.bankCode && a.maskedAccount === b.maskedAccount
    && a.beneficiaryNo === b.beneficiaryNo
    && a.effectiveAt === b.effectiveAt && a.nextChangeAt === b.nextChangeAt;
}

function matchesReceipt(a: BankBeneficiary | null, b: ReceiptReference): boolean {
  return !!a && (a.beneficiaryNo ?? null) === b.beneficiaryNo && a.effectiveAt === b.effectiveAt && a.nextChangeAt === b.nextChangeAt;
}

/** Recipient and change OTP stay in page memory only; ambiguous writes replay the exact request. */
export function createBankBindingForm(api: BindingApi, identity: () => string, accountKey: () => string, clock = Date.now) {
  const state = reactive({ config: null as BankConfig | null, account: "", holder: "",
    busy: false, reading: false, hasReceipt: false, phase: "details" as Phase, error: "", code: "", challengeNo: "", otpExpiresAt: 0, resendAt: 0 });
  let revision = 0;
  let pending: { body: BindBody; key: string; receipt: BankBeneficiary | null } | null = null;
  let receiptReference: ReceiptReference | null = null;
  let outcomeRead: Promise<void> | null = null;
  async function waitForRead() { await outcomeRead?.catch(() => {}); }
  const canContinue = () => !state.busy && state.phase === "details" && directBankBindingAvailable(state.config)
    && (!state.config?.beneficiary || (!!state.challengeNo && /^[0-9]{6}$/.test(state.code) && state.otpExpiresAt > clock()))
    && validBankRecipient(state);
  const canSendOtp = () => !state.busy && state.phase === "details" && directBankBindingAvailable(state.config)
    && !!state.config?.beneficiary && state.resendAt <= clock();
  function scope() {
    const id = ++revision, owner = identity();
    return () => id === revision && owner === identity();
  }
  function clearOtp() { state.code = ""; state.challengeNo = ""; state.otpExpiresAt = 0; }
  function clearDraft() { state.account = ""; state.holder = ""; clearOtp(); state.resendAt = 0; pending = null; receiptReference = null; state.hasReceipt = false; }
  function rememberReceipt(receipt: BankBeneficiary) {
    receiptReference = { beneficiaryNo: receipt.beneficiaryNo ?? null, effectiveAt: receipt.effectiveAt, nextChangeAt: receipt.nextChangeAt, savedAt: clock() };
    state.hasReceipt = true;
    writeAccountRow(RECEIPT_TABLE, accountKey(), { receipt: receiptReference });
  }
  function forgetReceipt() { writeAccountRow(RECEIPT_TABLE, accountKey(), { receipt: null }); }
  function savedReceipt(): ReceiptReference | null {
    const saved = readAccountRow<{ receipt: ReceiptReference | null }>(RECEIPT_TABLE, accountKey())?.receipt ?? null;
    if (saved && clock() - saved.savedAt <= RECEIPT_TTL_MS) return saved;
    if (saved) forgetReceipt();
    return null;
  }
  function finishSaved(config: BankConfig) { forgetReceipt(); state.config = config; clearDraft(); state.phase = "saved"; state.error = ""; }
  function reset() {
    revision++; clearDraft(); state.config = null; state.phase = "details"; state.busy = false; state.error = "";
  }
  async function load() {
    if (state.busy || state.phase === "uncertain") return;
    const current = scope(); state.busy = true; state.error = "";
    const saved = savedReceipt();
    if (saved) { receiptReference = saved; state.hasReceipt = true; state.phase = "uncertain"; state.error = "unknown"; }
    try {
      const config = await api.config(); if (!current()) return;
      state.config = config; clearOtp();
      if (!saved && !directBankBindingAvailable(config)) state.error = config.bankRoutingVerified === true ? "unsupported" : "routingUnverified";
    } catch { if (current()) { state.config = null; if (!saved) state.error = "load"; } }
    finally { if (current()) state.busy = false; }
  }
  async function sendOtp() {
    if (!canSendOtp()) return;
    const current = scope(); state.busy = true; state.error = ""; clearOtp();
    // An unknown delivery result must not invite immediate duplicate SMS sends.
    state.resendAt = clock() + 60000;
    try {
      const receipt = await api.sendOtp(); if (!current()) return;
      state.challengeNo = receipt.challengeNo; state.otpExpiresAt = clock() + receipt.expiresInSeconds * 1000;
      state.resendAt = clock() + receipt.retryAfterSeconds * 1000;
    } catch (error) {
      if (current()) state.error = error instanceof Error && /BANK_CHANGE_OTP_(COOLDOWN|DAILY_LIMIT)/.test(error.message) ? "otpRateLimited" : "otpSend";
    } finally { if (current()) state.busy = false; }
  }
  async function submit(accountRoutingConfirmed = false) {
    await waitForRead();
    if (state.busy || (state.phase !== "uncertain" && (!accountRoutingConfirmed || !canContinue()))) return;
    if (state.phase === "uncertain" && !pending) return;
    if (!pending) {
      try {
        pending = { body: { bankCode: "", account: state.account.trim(), holder: state.holder.trim(), accountRoutingConfirmed: true,
          ...(state.config?.beneficiary ? { challengeNo: state.challengeNo, code: state.code } : {}) },
          key: `bank-bind:${requireCryptoUuid()}`, receipt: null };
      } catch { state.error = "bind"; return; }
    }
    const operation = pending, current = scope(); state.busy = true; state.error = "";
    try {
      if (!operation.receipt) {
        const receipt = await api.bind({ ...operation.body }, operation.key); if (!current()) return;
        operation.receipt = receipt; rememberReceipt(receipt);
      }
      const config = await api.config(); if (!current()) return;
      if (!sameBeneficiary(config.beneficiary, operation.receipt)) throw new Error("BANK_BIND_READBACK_MISMATCH");
      finishSaved(config);
    } catch (error) {
      if (!current()) return;
      if (operation.receipt || isAmbiguousOutcome(error)) { state.phase = "uncertain"; state.error = "unknown"; }
      else { pending = null; state.phase = "details";
        state.error = error instanceof Error && error.message === "BANK_CHANGE_OTP_INVALID" ? "otpInvalid" : "bind";
        if (state.error === "otpInvalid") state.code = "";
      }
    } finally { if (current()) state.busy = false; }
  }
  function readOutcome(readAllowed: () => boolean): Promise<void> {
    if (outcomeRead) return outcomeRead;
    const receipt = receiptReference;
    if (state.busy || state.phase !== "uncertain" || !receipt || !readAllowed()) return Promise.resolve();
    const token = revision, owner = identity();
    const current = () => token === revision && owner === identity() && receiptReference === receipt && readAllowed();
    state.reading = true;
    const read = Promise.resolve().then(async () => {
      if (!current()) return;
      const config = await api.config();
      if (!current()) return;
      if (!matchesReceipt(config.beneficiary, receipt)) throw new Error("BANK_BIND_READBACK_MISMATCH");
      finishSaved(config);
    }).finally(() => { if (outcomeRead === read) { outcomeRead = null; state.reading = false; } });
    outcomeRead = read;
    return read;
  }
  return { state, readOutcome, canContinue, canSendOtp, sendOtp, load, reset, submit };
}
