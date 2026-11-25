import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { onHide, onShow } from "@/composables/use-tab-page-lifecycle";
import { apiRuntimeClientOrigin, vRankApi } from "@/api/runtime";
import { isAmbiguousOutcome, isApiRefusal } from "@/api/errors";
import { readRankSalaryAttempt, type RankSalaryAttempt, type RankSalaryReceipt } from "@/api/v-rank-api";
import { appReadForeground, documentReadVisible, foregroundReadAllowed } from "@/lib/foreground-read";
import { remoteAccountScope } from "@/lib/remote-account-epoch";
import type { SalaryClaimPhase } from "@/lib/rank-salary-view";
import { acquireAccountCommand, readAccountRow, releaseAccountCommandKey, type AccountCommandRow } from "@/store/account-scoped-storage";

const STORAGE = "nexgrid-rank-salary-command-v1";
const INTENT = JSON.stringify([apiRuntimeClientOrigin.environment, apiRuntimeClientOrigin.baseUrl]);
const RECEIPT_INTERVAL_MS = 30_000;
type Attempt = RankSalaryAttempt & { key: string };
type Outcome = Extract<RankSalaryReceipt, { status: "SUCCEEDED" | "REJECTED" }> | { status: "FAILED" };

export function useRankSalaryClaim(options: {
  account: () => string | null;
  settled: (outcome: Outcome, attempt: RankSalaryAttempt, isVisible: () => boolean) => void | Promise<void>;
  failed: () => void;
}) {
  const phase = ref<SalaryClaimPhase>("idle");
  const pending = shallowRef<Attempt | null>(null);
  const shown = ref(false);
  const receiptInFlight = ref(false);
  let working: Attempt | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const visible = () => shown.value && foregroundReadAllowed();

  function clearTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  async function run(attempt: Attempt, account: string, write: boolean) {
    clearTimer();
    working = attempt;
    phase.value = write ? "claiming" : "confirming";
    const scope = remoteAccountScope.snapshot();
    const current = () => pending.value === attempt && options.account() === account && remoteAccountScope.isCurrent(scope);
    const isVisible = () => current() && shown.value && appReadForeground.value && documentReadVisible.value;
    const { month, amountUsdt } = attempt.item;
    const nextRead = (delay: number) => {
      if (visible()) timer = setTimeout(() => {
        timer = undefined;
        if (current() && visible()) void run(attempt, account, false);
      }, delay);
    };

    try {
      let receipt: RankSalaryReceipt | { status: "FAILED" };
      try {
        if (write) {
          receipt = await vRankApi.claimSalary(attempt.key, { month, amountUsdt });
        } else {
          receiptInFlight.value = true;
          try {
            receipt = await vRankApi.salaryReceipt(attempt.key, month);
          } finally {
            if (working === attempt) receiptInFlight.value = false;
          }
        }
      } catch (error) {
        if (!current()) return;
        if (write && isApiRefusal(error, 409, "SALARY_NOT_CLAIMABLE", "IDEMPOTENCY_KEY_CONFLICT")) {
          receipt = { status: "REJECTED", month, rejectionCode: "SALARY_NOT_CLAIMABLE" };
        } else if (write && !isApiRefusal(error, 503, "SALARY_RECEIPT_UNAVAILABLE") && !isAmbiguousOutcome(error)) {
          receipt = { status: "FAILED" };
        } else {
          phase.value = "confirming";
          nextRead(write ? 0 : RECEIPT_INTERVAL_MS);
          return;
        }
      }
      if (!current()) return;
      if (!isVisible()) {
        phase.value = "confirming";
        return;
      }
      if (receipt.status === "NOT_FOUND") {
        phase.value = "resend";
      } else if (receipt.status === "PROCESSING") {
        phase.value = "confirming";
        nextRead(RECEIPT_INTERVAL_MS);
      } else {
        releaseAccountCommandKey(STORAGE, account, INTENT, attempt.key);
        try {
          await options.settled(receipt, attempt, isVisible);
        } finally {
          if (current()) {
            pending.value = null;
            phase.value = "idle";
          }
        }
      }
    } finally {
      if (working === attempt) working = null;
    }
  }

  function restore(account: string) {
    const saved = readAccountRow<AccountCommandRow>(STORAGE, account, true);
    const key = saved?.commands?.[INTENT];
    if (!key) return null;
    const payload = saved?.payloads?.[INTENT];
    return { key, ...readRankSalaryAttempt(JSON.parse(payload ?? "")) };
  }

  function resume() {
    clearTimer();
    const account = options.account();
    if (!account || !shown.value || working) return;
    try {
      pending.value ??= restore(account);
    } catch {
      return;
    }
    const attempt = pending.value;
    if (!attempt) return;
    phase.value = "confirming";
    if (visible()) void run(attempt, account, false);
  }

  function submit(input: RankSalaryAttempt) {
    const account = options.account();
    if (!account || !shown.value || working || phase.value !== "idle") return;
    try {
      const command = acquireAccountCommand(STORAGE, account, INTENT, "rank-salary", JSON.stringify({
        ...input, item: { ...input.item },
      }));
      const attempt = { key: command.key, ...readRankSalaryAttempt(JSON.parse(command.payload ?? "")) };
      pending.value = attempt;
      void run(attempt, account, !command.reused);
    } catch {
      options.failed();
    }
  }

  function resend() {
    const account = options.account(), attempt = pending.value;
    if (account && shown.value && !working && phase.value === "resend" && attempt) void run(attempt, account, true);
  }

  watch(options.account, () => {
    working = null;
    receiptInFlight.value = false;
    pending.value = null;
    phase.value = "idle";
    resume();
  }, { flush: "sync" });
  watch(visible, (active) => { if (active) resume(); else clearTimer(); });
  const show = () => { if (!shown.value) { shown.value = true; resume(); } };
  const hide = () => { shown.value = false; clearTimer(); };
  onShow(show);
  onMounted(show);
  onHide(hide);
  onBeforeUnmount(hide);

  return { phase, pending, receiptInFlight, submit, resend };
}
