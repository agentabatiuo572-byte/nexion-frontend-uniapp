import { reactive } from "vue";
import type { BankConfig, BankBeneficiary, createBankWithdrawalApi } from "@/api/bank-withdrawal-api";
import { isAmbiguousOutcome } from "@/api/errors";
import { parseServerTimestamp } from "@/api/server-time";
import { requireCryptoUuid } from "@/lib/secure-command-id";

type Recipient = { account: string; holder: string };
type BindingApi = Pick<ReturnType<typeof createBankWithdrawalApi>, "config" | "bind">;
type BindBody = Parameters<BindingApi["bind"]>[0];
type Phase = "details" | "uncertain" | "saved";
export function validBankRecipient(draft: Recipient): boolean {
  const name = draft.holder.trim();
  return /^[0-9]{6,32}$/.test(draft.account.trim()) && name.length >= 2 && name.length <= 100
    && /^[\p{L}\p{M} .'-]+$/u.test(name);
}
export function directBankBindingAvailable(config: BankConfig | null): boolean {
  return config?.payType === "BANKQR" && config.bankCodeRequired === false && config.bindingOtpRequired === false;
}
function sameBeneficiary(a: BankBeneficiary | null, b: BankBeneficiary): boolean {
  return !!a && a.bankCode === b.bankCode && a.maskedAccount === b.maskedAccount
    && a.effectiveAt === b.effectiveAt && a.nextChangeAt === b.nextChangeAt;
}

/** Page-memory-only recipient data. No local storage, OTP, card tokenization, or payout calls. */
export function createBankBindingForm(api: BindingApi, identity: () => string) {
  const state = reactive({ config: null as BankConfig | null, account: "", holder: "",
    busy: false, phase: "details" as Phase, error: "" });
  let revision = 0;
  let pending: { body: BindBody; key: string; receipt: BankBeneficiary | null } | null = null;
  const canContinue = () => !state.busy && state.phase === "details" && directBankBindingAvailable(state.config)
    && (!state.config?.beneficiary || (parseServerTimestamp(state.config.beneficiary.nextChangeAt) ?? Infinity) <= Date.now())
    && validBankRecipient(state);
  function scope() {
    const id = ++revision, owner = identity();
    return () => id === revision && owner === identity();
  }
  function clearDraft() { state.account = ""; state.holder = ""; pending = null; }
  function reset() {
    revision++; clearDraft(); state.config = null; state.phase = "details"; state.busy = false; state.error = "";
  }
  async function load() {
    if (state.busy || state.phase === "uncertain") return;
    const current = scope(); state.busy = true; state.error = "";
    try {
      const config = await api.config(); if (!current()) return;
      state.config = config;
      if (!directBankBindingAvailable(config)) state.error = "unsupported";
    } catch { if (current()) { state.config = null; state.error = "load"; } }
    finally { if (current()) state.busy = false; }
  }
  async function submit() {
    if (state.busy || (state.phase !== "uncertain" && !canContinue())) return;
    if (!pending) {
      try {
        pending = { body: { bankCode: "", account: state.account.trim(), holder: state.holder.trim() },
          key: `bank-bind:${requireCryptoUuid()}`, receipt: null };
      } catch { state.error = "bind"; return; }
    }
    const operation = pending, current = scope(); state.busy = true; state.error = "";
    try {
      if (!operation.receipt) {
        const receipt = await api.bind({ ...operation.body }, operation.key); if (!current()) return;
        operation.receipt = receipt;
      }
      const config = await api.config(); if (!current()) return;
      if (!sameBeneficiary(config.beneficiary, operation.receipt)) throw new Error("BANK_BIND_READBACK_MISMATCH");
      state.config = config; clearDraft(); state.phase = "saved";
    } catch (error) {
      if (!current()) return;
      if (operation.receipt || isAmbiguousOutcome(error)) { state.phase = "uncertain"; state.error = "unknown"; }
      else { pending = null; state.phase = "details"; state.error = "bind"; }
    } finally { if (current()) state.busy = false; }
  }
  return { state, canContinue, load, reset, submit };
}
