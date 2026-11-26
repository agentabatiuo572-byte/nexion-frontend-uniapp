import { defineStore } from "pinia";
import { computed, shallowRef, watch } from "vue";
import { apiClient, trialApi } from "@/api/runtime";
import { asApiError, isAmbiguousEnvelopeOutcome, isApiRefusal } from "@/api/errors";
import { readPaymentCommand, type PaymentCommandReceipt } from "@/api/payment-command-api";
import type { PaymentPasswordAuthorization } from "@/api/payment-password-api";
import {
  isTrialAuthorizationRefusal, parseTrialOriginalPurchase, parseTrialPurchaseConvertResult,
  type TrialAuthorityState, type TrialConvertReceipt, type TrialOriginalPurchase, type TrialPurchaseConvertResult,
} from "@/api/trial-api";
import { requireCryptoUuid } from "@/lib/secure-command-id";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";
import { useApp } from "./app";
import { useFreeTrial } from "./free-trial";
import { useTrialPurchaseResult } from "./trial-purchase-result";

type TrialBalancePurchase = Extract<TrialOriginalPurchase, { kind: "BALANCE" }>;
type TrialRefusal = Extract<TrialPurchaseConvertResult, { status: "refused" }>;
type Submission = Omit<TrialBalancePurchase, "status">;
type SubmissionResultTarget = Pick<Submission, "claimNo" | "submissionNo" | "confirmedAmountUSD"> & { device: Pick<Submission["device"], "productNo"> };
type ConfirmedSubmission = Submission & { confirmedAmountUSD: number; quoteVersion: string };

type RefusedTrialCheckout = {
  status: "refused"; claimNo: string; submissionNo: string; productNo: string;
  confirmedAmountUSD: number | null; refusal: TrialRefusal; legacyRefusal?: boolean; recovered?: boolean;
};
type TrialCheckoutOutcome =
  | { status: "idle" | "storage-error" }
  | { status: "submitting" | "processing"; submission: Submission }
  | { status: "resumable"; submission: ConfirmedSubmission; accepted: boolean }
  | { status: "original"; originalPurchase: TrialOriginalPurchase }
  | RefusedTrialCheckout
  | { status: "settled"; claimNo: string; receipt: TrialConvertReceipt };

const COMMANDS = "nexgrid-trial-checkout-accounts-v1";
interface TrialCheckoutRow { submission: Submission | null }

function sameSubmission(left: Submission, right: Submission) {
  return left.claimNo === right.claimNo && left.submissionNo === right.submissionNo && left.device.productNo === right.device.productNo;
}

function confirmed(submission: Submission): submission is ConfirmedSubmission {
  return submission.confirmedAmountUSD !== null && !!submission.quoteVersion;
}

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
      claimNo: value.claimNo, kind: value.kind, commandKey: value.submissionNo, status: "PROCESSING", paymentMethod: "WALLET",
      productNo: value.device?.productNo, name: value.device?.productName, imageUrl: value.device?.imageUrl,
      productType: value.device?.productType, expectedAmountUsdt: value.confirmedAmountUSD, quoteVersion: value.quoteVersion,
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
    if (authority.value?.claimNo && authority.value.claimNo !== purchase.claimNo) return;
    const current = outcome.value;
    if (purchase.kind === "BALANCE" && current.status === "resumable" && current.accepted && sameSubmission(current.submission, purchase)
        && (purchase.quoteVersion === null || current.submission.quoteVersion === purchase.quoteVersion)
        && (purchase.confirmedAmountUSD === null || current.submission.confirmedAmountUSD === purchase.confirmedAmountUSD)) return;
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
    if (current.status === "submitting" || current.status === "settled") return;
    if (original?.kind === "BALANCE" && useFreeTrial().pendingConversion(original.device.productNo)?.key === original.submissionNo) {
      // The legacy store reads this key. Publish its lock without giving checkout a second reader.
      outcome.value = { status: "original", originalPurchase: original };
    } else if (original) {
      if (original.kind === "BALANCE" && current.status === "refused" && current.submissionNo === original.submissionNo) return;
      adoptOriginal(original);
    } else if (local.value && (current.status !== "resumable" || current.accepted || !sameSubmission(current.submission, local.value))) {
      outcome.value = { status: "processing", submission: local.value };
    } else if (current.status === "original" || (current.status === "resumable" && !local.value)) {
      outcome.value = { status: "idle" };
    }
  }

  function release(submission: Pick<Submission, "claimNo" | "submissionNo">): boolean {
    try {
      const saved = readLocal(submission.claimNo);
      return saved?.submissionNo !== submission.submissionNo || save(null);
    } catch {
      return false;
    }
  }

  function finish(submission: SubmissionResultTarget, result: TrialPurchaseConvertResult, recovered = false) {
    if (result.status === "settled") {
      if (result.receipt.productNo !== submission.device.productNo || (result.receipt.claimNo && result.receipt.claimNo !== submission.claimNo))
        throw new Error("TRIAL_SUBMISSION_MISMATCH");
      release(submission);
      outcome.value = { status: "settled", claimNo: submission.claimNo, receipt: result.receipt };
      useTrialPurchaseResult().publish({ status: "settled", claimNo: submission.claimNo, orderNo: result.receipt.orderNo });
      return;
    }
    if ((result.originalPurchase && result.originalPurchase.claimNo !== submission.claimNo)
        || (result.claimNo && result.claimNo !== submission.claimNo) || (result.productNo && result.productNo !== submission.device.productNo))
      throw new Error("TRIAL_SUBMISSION_MISMATCH");
    if (!release(submission)) {
      outcome.value = { status: "storage-error" };
    } else if (result.originalPurchase) {
      adoptOriginal(result.originalPurchase);
    } else {
      outcome.value = {
        status: "refused", claimNo: submission.claimNo, submissionNo: submission.submissionNo, productNo: submission.device.productNo,
        confirmedAmountUSD: submission.confirmedAmountUSD, refusal: result, recovered,
      };
      useTrialPurchaseResult().publish({ status: "refused", claimNo: submission.claimNo, key: submission.submissionNo, reason: result.reasonCode });
    }
  }

  const workingSubmission = computed(() => {
    const state = outcome.value;
    return "submission" in state ? state.submission : null;
  });

  const originalPurchase = computed<TrialOriginalPurchase | null>(() => {
    const trial = useFreeTrial();
    const claimNo = trial.displayState?.claimNo;
    if (!claimNo) return null;
    const current = outcome.value, snapshot = trial.originalPurchase;
    if (current.status === "settled" && current.claimNo === claimNo) return null;
    if (current.status === "refused" && current.claimNo === claimNo && snapshot?.kind === "BALANCE"
        && snapshot.submissionNo === current.submissionNo) return null;
    if ("submission" in current && current.submission.claimNo === claimNo)
      return { ...current.submission, status: current.status === "resumable" ? "RESUMABLE" : "PROCESSING" };
    const original = current.status === "original" && current.originalPurchase.claimNo === claimNo
      ? current.originalPurchase : snapshot;
    if (original?.claimNo === claimNo) {
      if (original.kind === "BALANCE" && trial.legacyConversionResumable
          && trial.pendingConversion(original.device.productNo)?.key === original.submissionNo)
        return { ...original, status: "RESUMABLE" };
      return original;
    }
    try {
      const saved = readLocal(claimNo);
      return saved ? { ...saved, status: "PROCESSING" } : null;
    } catch { return null; }
  });

  function hasUnsettledBalanceSubmission(): boolean {
    if (workingSubmission.value || originalPurchase.value?.kind === "BALANCE") return true;
    try { return !!readStoredSubmission(); }
    catch { return true; }
  }

  async function submit(input: Omit<ConfirmedSubmission, "submissionNo" | "kind" | "paymentMethod">, authorization: PaymentPasswordAuthorization) {
    const before = outcome.value;
    if (["submitting", "processing", "original", "settled", "storage-error"].includes(before.status)
        || authority.value?.claimNo !== input.claimNo) return;
    const resumed = before.status === "resumable";
    const target = resumed ? before.submission : input;
    if (target.claimNo !== input.claimNo || target.device.productNo !== input.device.productNo
        || target.confirmedAmountUSD !== input.confirmedAmountUSD || target.quoteVersion !== input.quoteVersion) return;
    const current = currentAccount();
    let submission: ConfirmedSubmission;
    try {
      const saved = readStoredSubmission();
      if (saved && saved.claimNo !== input.claimNo) return;
      if (saved && (!resumed || !sameSubmission(saved, before.submission))) {
        local.value = saved;
        outcome.value = { status: "processing", submission: saved };
        return;
      }
      if (resumed && !saved && !before.accepted) return;
      submission = resumed ? before.submission : {
        ...input, kind: "BALANCE", paymentMethod: "WALLET", submissionNo: "trial-checkout:" + requireCryptoUuid(),
      };
      if (!saved && !save(submission)) throw new Error("TRIAL_SUBMISSION_STORAGE_UNAVAILABLE");
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
      if (isApiRefusal(cause, 409, "PAYMENT_COMMAND_INPUT_CHANGED", "PAYMENT_PASSWORD_VERSION_CONFLICT")) {
        outcome.value = { status: "processing", submission };
        await readSubmission().catch(() => {});
        return;
      }
      if (isTrialAuthorizationRefusal(asApiError(cause).message)) {
        if (resumed || release(submission)) outcome.value = before;
        else outcome.value = { status: "storage-error" };
        throw cause;
      }
      const failure = asApiError(cause);
      if (isAmbiguousEnvelopeOutcome(cause) || /^(?:IDEMPOTENCY_|PAYMENT_COMMAND_)|(?:_UNKNOWN|_PROCESSING)$/.test(failure.message))
        outcome.value = { status: "processing", submission };
      else finish(submission, { status: "refused", reasonCode: asApiError(cause).message });
    }
  }

  function terminalResult(reply: PaymentCommandReceipt) {
    if (reply.status === "SUCCEEDED") return parseTrialPurchaseConvertResult(reply.receipt, 0);
    if (reply.status === "REJECTED" && reply.code && reply.message)
      return parseTrialPurchaseConvertResult(reply.receipt, reply.code, reply.message);
    return null;
  }

  // The original disappears from trial/state once it settles or is refused.
  // A cold checkout then has only the route identity to read its final receipt.
  async function readRoutedResult(claimNo: string, productNo: string, submissionNo: string): Promise<
    RefusedTrialCheckout | Extract<TrialCheckoutOutcome, { status: "settled" }> | undefined
  > {
    const current = currentAccount();
    const reply = await readPaymentCommand(apiClient, "trial-convert", submissionNo);
    if (!current() || authority.value?.claimNo !== claimNo || (reply.paymentMethod && reply.paymentMethod !== "WALLET")) return;
    const result = terminalResult(reply);
    if (!result || (result.status === "refused" && result.originalPurchase)) return;
    const receiptClaim = result.status === "settled" ? result.receipt.claimNo : result.claimNo;
    if ((reply.claimNo && reply.claimNo !== claimNo) || (receiptClaim && receiptClaim !== claimNo)
        || (reply.productNo && reply.productNo !== productNo)) return;
    if (result.status === "settled") {
      if ((reply.claimNo || receiptClaim) && result.receipt.productNo === productNo)
        return { status: "settled", claimNo, receipt: result.receipt };
      return;
    }
    if (result.productNo && result.productNo !== productNo) return;
    const original = useFreeTrial().pendingConversion(productNo);
    if (!(reply.productNo || result.productNo) && original?.key !== submissionNo) return;
    return { status: "refused", claimNo, submissionNo, productNo, confirmedAmountUSD: null,
      refusal: result, legacyRefusal: !reply.claimNo && !receiptClaim, recovered: true };
  }

  function readSubmission(): Promise<void> {
    if (commandRead) return commandRead;
    const state = outcome.value;
    if (state.status !== "processing") return Promise.resolve();
    const { submission } = state;
    const current = currentAccount();
    const read = readPaymentCommand(apiClient, "trial-convert", submission.submissionNo).then(async reply => {
      if (!current() || workingSubmission.value?.submissionNo !== submission.submissionNo
          || (reply.claimNo && reply.claimNo !== submission.claimNo) || (reply.productNo && reply.productNo !== submission.device.productNo)
          || (reply.paymentMethod && reply.paymentMethod !== "WALLET")) return;
      const result = terminalResult(reply);
      if (result) finish(submission, result, true);
      else if (reply.canResumeSameKey && (reply.status === "PROCESSING" || reply.status === "NOT_SEEN")) {
        const trial = useFreeTrial();
        if (!await trial.refreshRemote() || !current() || workingSubmission.value?.submissionNo !== submission.submissionNo) return;
        const next = trial.displayState;
        if (next) adoptAuthority(next);
        if (next?.claimNo !== submission.claimNo || (next.status !== "active" && next.status !== "grace")) return;
        const original = next.originalPurchase;
        if (reply.status === "PROCESSING" && original?.kind === "BALANCE" && sameSubmission(submission, original)) {
          const saved = readLocal(submission.claimNo);
          const exact = confirmed(original) ? original : saved && sameSubmission(saved, original)
            && (original.quoteVersion === null || saved.quoteVersion === original.quoteVersion)
            && (original.confirmedAmountUSD === null || saved.confirmedAmountUSD === original.confirmedAmountUSD) ? saved : null;
          if (exact && confirmed(exact)) outcome.value = { status: "resumable", submission: exact, accepted: true };
        } else if (reply.status === "NOT_SEEN" && !original) {
          const saved = readLocal(submission.claimNo);
          if (saved && sameSubmission(saved, submission) && confirmed(saved)) outcome.value = { status: "resumable", submission: saved, accepted: false };
        }
      }
    }).finally(() => { if (commandRead === read) commandRead = null; });
    commandRead = read;
    return read;
  }

  function settleExternal(claimNo: string, receipt: TrialConvertReceipt, key?: string) {
    if (receipt.claimNo && receipt.claimNo !== claimNo) return;
    useTrialPurchaseResult().publish({ status: "settled", claimNo, key, orderNo: receipt.orderNo });
    if (authority.value?.claimNo !== claimNo) return;
    outcome.value = { status: "settled", claimNo, receipt };
  }

  function rememberExternalRefusal(claimNo: string, productNo: string, commandKey: string, amount: number, refusal: TrialRefusal) {
    useTrialPurchaseResult().publish({ status: "refused", claimNo, key: commandKey, reason: refusal.reasonCode });
    const current = outcome.value;
    if (authority.value?.claimNo !== claimNo || "submission" in current
        || current.status === "original" || current.status === "settled") return;
    outcome.value = { status: "refused", claimNo, productNo, submissionNo: commandKey, confirmedAmountUSD: amount,
      refusal, recovered: true };
  }

  function clearSettled(orderNo: string) {
    if (outcome.value.status === "settled" && outcome.value.receipt.orderNo === orderNo)
      outcome.value = { status: "idle" };
  }

  return { authority, outcome, workingSubmission, originalPurchase, hasUnsettledBalanceSubmission, adoptAuthority, adoptOriginal, readSubmission, readRoutedResult, submit, settleExternal, clearSettled, rememberExternalRefusal };
});
