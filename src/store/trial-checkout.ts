import { defineStore } from "pinia";
import { computed, shallowRef, watch } from "vue";
import { apiClient, trialApi } from "@/api/runtime";
import { asApiError, isAmbiguousOutcome } from "@/api/errors";
import { readPaymentCommand } from "@/api/payment-command-api";
import type { PaymentPasswordAuthorization } from "@/api/payment-password-api";
import {
  parseTrialOriginalPurchase, parseTrialPurchaseConvertResult,
  type TrialAuthorityState, type TrialConvertReceipt, type TrialOriginalPurchase, type TrialPurchaseConvertResult,
} from "@/api/trial-api";
import { requireCryptoUuid } from "@/lib/secure-command-id";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";
import { useApp } from "./app";
import { useFreeTrial } from "./free-trial";

type TrialBalancePurchase = Extract<TrialOriginalPurchase, { kind: "BALANCE" }>;
type TrialRefusal = Extract<TrialPurchaseConvertResult, { status: "refused" }>;
type Submission = Omit<TrialBalancePurchase, "status">;

type TrialCheckoutOutcome =
  | { status: "idle" | "storage-error" }
  | { status: "submitting" | "processing" | "resumable"; submission: Submission }
  | { status: "original"; originalPurchase: TrialOriginalPurchase }
  | { status: "refused"; claimNo: string; submissionNo: string; productNo: string; confirmedAmountUSD: number; refusal: TrialRefusal }
  | { status: "settled"; claimNo: string; receipt: TrialConvertReceipt };

const COMMANDS = "nexgrid-trial-checkout-accounts-v1";
interface TrialCheckoutRow { submission: Submission | null }

export const useTrialCheckout = defineStore("trial-checkout", () => {
  const app = useApp();
  const outcome = shallowRef<TrialCheckoutOutcome>({ status: "idle" });
  const authority = shallowRef<TrialAuthorityState | null>(null);
  const local = shallowRef<Submission | null>(null);
  let commandRead: Promise<void> | null = null;

  watch(() => app.accountBindingEpoch, () => {
    outcome.value = { status: "idle" };
    authority.value = null;
    local.value = null;
    commandRead = null;
  }, { flush: "sync" });

  function currentAccount() {
    const key = app.accountKey;
    const epoch = app.accountBindingEpoch;
    return () => key === app.accountKey && epoch === app.accountBindingEpoch;
  }

  function readStoredSubmission(): Submission | null {
    const value = readAccountRow<TrialCheckoutRow>(COMMANDS, app.accountKey, true)?.submission;
    if (!value) return null;
    const parsed = parseTrialOriginalPurchase({
      ...value, status: "PROCESSING", confirmedAmountUsdt: value.confirmedAmountUSD,
    });
    if (parsed.kind !== "BALANCE") throw new Error("TRIAL_SUBMISSION_INVALID");
    return parsed;
  }

  function readLocal(claimNo: string | null): Submission | null {
    const saved = readStoredSubmission();
    return saved?.claimNo === claimNo ? saved : null;
  }

  function save(submission: Submission | null): boolean {
    if (!writeAccountRow<TrialCheckoutRow>(COMMANDS, app.accountKey, { submission })) return false;
    local.value = submission;
    return true;
  }

  function adoptOriginal(purchase: TrialOriginalPurchase) {
    outcome.value = purchase.kind === "EXTERNAL"
      ? { status: "original", originalPurchase: purchase }
      : { status: "processing", submission: purchase };
  }

  function adoptAuthority(next: TrialAuthorityState) {
    if (authority.value && authority.value.claimNo !== next.claimNo) outcome.value = { status: "idle" };
    authority.value = next;
    try {
      const saved = readStoredSubmission();
      if (saved && saved.claimNo !== next.claimNo && !release(saved)) throw new Error("TRIAL_SUBMISSION_STORAGE_UNAVAILABLE");
      local.value = saved?.claimNo === next.claimNo ? saved : null;
    } catch {
      outcome.value = { status: "storage-error" };
      return;
    }
    const current = outcome.value, original = next.originalPurchase;
    if (!original && next.status !== "active" && next.status !== "grace") {
      outcome.value = { status: !local.value || release(local.value) ? "idle" : "storage-error" };
      return;
    }
    if (current.status === "submitting" || current.status === "settled") return;
    if (original) {
      if (original.kind === "BALANCE" && current.status === "refused" && current.submissionNo === original.submissionNo) return;
      adoptOriginal(original);
    } else if (local.value && current.status !== "resumable") {
      outcome.value = { status: "processing", submission: local.value };
    } else if (current.status === "original") {
      outcome.value = { status: "idle" };
    }
  }

  function release(submission: Submission): boolean {
    try {
      const saved = readLocal(submission.claimNo);
      return saved?.submissionNo !== submission.submissionNo || save(null);
    } catch {
      return false;
    }
  }

  function finish(submission: Submission, result: TrialPurchaseConvertResult) {
    if (result.status === "processing") {
      if (result.originalPurchase.claimNo !== submission.claimNo) throw new Error("TRIAL_SUBMISSION_MISMATCH");
      adoptOriginal(result.originalPurchase);
      return;
    }
    if (result.status === "settled") {
      if (result.receipt.productNo !== submission.device.productNo) throw new Error("TRIAL_SUBMISSION_MISMATCH");
      release(submission);
      outcome.value = { status: "settled", claimNo: submission.claimNo, receipt: result.receipt };
      return;
    }
    if (result.originalPurchase && result.originalPurchase.claimNo !== submission.claimNo)
      throw new Error("TRIAL_SUBMISSION_MISMATCH");
    if (!release(submission)) {
      outcome.value = { status: "storage-error" };
    } else if (result.originalPurchase) {
      adoptOriginal(result.originalPurchase);
    } else {
      outcome.value = {
        status: "refused", claimNo: submission.claimNo, submissionNo: submission.submissionNo, productNo: submission.device.productNo,
        confirmedAmountUSD: submission.confirmedAmountUSD, refusal: result,
      };
    }
  }

  const workingSubmission = computed(() => {
    const state = outcome.value;
    return "submission" in state ? state.submission : null;
  });

  async function submit(input: Omit<Submission, "submissionNo" | "kind" | "paymentMethod">, authorization: PaymentPasswordAuthorization) {
    const before = outcome.value;
    if (["submitting", "processing", "original", "settled", "storage-error"].includes(before.status)
        || authority.value?.claimNo !== input.claimNo) return;
    const resumed = before.status === "resumable";
    const target = resumed ? before.submission : input;
    if (target.claimNo !== input.claimNo || target.device.productNo !== input.device.productNo
        || target.confirmedAmountUSD !== input.confirmedAmountUSD || target.quoteVersion !== input.quoteVersion) return;
    const current = currentAccount();
    let submission: Submission;
    try {
      const saved = readStoredSubmission();
      if (saved && saved.claimNo !== input.claimNo) return;
      if (saved && (!resumed || saved.submissionNo !== before.submission.submissionNo)) {
        local.value = saved;
        outcome.value = { status: "processing", submission: saved };
        return;
      }
      if (resumed && !saved) return;
      submission = resumed ? before.submission : {
        ...input, kind: "BALANCE", paymentMethod: "UVEL_USDT_WALLET", submissionNo: "trial-checkout:" + requireCryptoUuid(),
      };
      if (!resumed && !save(submission)) throw new Error("TRIAL_SUBMISSION_STORAGE_UNAVAILABLE");
    } catch {
      outcome.value = { status: "storage-error" };
      return;
    }
    outcome.value = { status: "submitting", submission };
    try {
      const response = await trialApi.convertPurchase(submission.device.productNo, submission.confirmedAmountUSD,
        submission.quoteVersion, submission.submissionNo, authorization);
      if (current() && workingSubmission.value?.submissionNo === submission.submissionNo) finish(submission, response);
    } catch (cause) {
      if (!current() || workingSubmission.value?.submissionNo !== submission.submissionNo) return;
      if (/^PAYMENT_PASSWORD_(INCORRECT|LOCKED|VERSION_CONFLICT|NOT_CONFIGURED|REQUIRED)$/.test(asApiError(cause).message)) {
        if (resumed || release(submission)) outcome.value = before;
        else outcome.value = { status: "storage-error" };
        throw cause;
      }
      if (isAmbiguousOutcome(cause)) outcome.value = { status: "processing", submission };
      else finish(submission, { status: "refused", reasonCode: "TRIAL_PURCHASE_UNAVAILABLE" });
    }
  }

  function readSubmission(): Promise<void> {
    if (commandRead) return commandRead;
    const state = outcome.value;
    if (state.status !== "processing") return Promise.resolve();
    const { submission } = state;
    const current = currentAccount();
    const read = readPaymentCommand(apiClient, "trial-convert", submission.submissionNo).then(async reply => {
      if (!current() || workingSubmission.value?.submissionNo !== submission.submissionNo) return;
      if (reply.status === "SUCCEEDED") finish(submission, parseTrialPurchaseConvertResult(reply.receipt, 200));
      else if (reply.status === "REJECTED") {
        const refusal = reply.receipt ?? { reasonCode: reply.message };
        finish(submission, parseTrialPurchaseConvertResult(refusal, 409));
      } else if (reply.status === "NOT_SEEN" && reply.canResumeSameKey) {
        const trial = useFreeTrial();
        if (!await trial.refreshRemote() || !current() || workingSubmission.value?.submissionNo !== submission.submissionNo) return;
        const next = trial.displayState;
        if (next) adoptAuthority(next);
        if (next?.claimNo === submission.claimNo && (next.status === "active" || next.status === "grace")
          && !next.originalPurchase && readLocal(submission.claimNo)?.submissionNo === submission.submissionNo)
          outcome.value = { status: "resumable", submission };
      }
    }).finally(() => { if (commandRead === read) commandRead = null; });
    commandRead = read;
    return read;
  }

  function settleExternal(claimNo: string, receipt: TrialConvertReceipt) {
    if (authority.value?.claimNo !== claimNo) return;
    outcome.value = { status: "settled", claimNo, receipt };
  }

  function rememberExternalQuoteChange(claimNo: string, productNo: string, commandKey: string, amount: number,
    quote: NonNullable<TrialRefusal["quote"]>) {
    outcome.value = { status: "refused", claimNo, productNo, submissionNo: commandKey, confirmedAmountUSD: amount,
      refusal: { status: "refused", reasonCode: "TRIAL_QUOTE_CHANGED", quote } };
  }

  function clearSettled(orderNo: string) {
    if (outcome.value.status === "settled" && outcome.value.receipt.orderNo === orderNo)
      outcome.value = { status: "idle" };
  }

  return { authority, outcome, workingSubmission, adoptAuthority, adoptOriginal, readSubmission, submit, settleExternal, clearSettled, rememberExternalQuoteChange };
});
