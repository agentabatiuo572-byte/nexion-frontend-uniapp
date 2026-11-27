import { reactive, watch } from "vue";
import { apiClient, apiRuntimeConfig, sessionVault } from "@/api/runtime";
import { runPassiveTabRead, invalidatePassiveTabRead } from "@/lib/passive-tab-read";
import { isTransientReadFailure } from "@/lib/remote-read-failure";
import { createPaymentPasswordApi, validPaymentPassword, type PaymentPasswordApi, type PaymentPasswordAuthorization, type PaymentPasswordChallenge, type PaymentPasswordChangeCommand, type PaymentPasswordChangeVerification, type PaymentPasswordProof, type PaymentPasswordReceipt, type PaymentPasswordState } from "@/api/payment-password-api";
import { ApiError, asApiError, isAmbiguousOutcome, isApiRefusal } from "@/api/errors";
import { requireCryptoUuid } from "@/lib/secure-command-id";
import { projectServerNow, readTrustedMonotonicNowMs } from "@/lib/server-deadline-clock";
import { readAccountRow, writeAccountRow } from "@/store/account-scoped-storage";

export type { PaymentPasswordAuthorization } from "@/api/payment-password-api";
export { validPaymentPassword } from "@/api/payment-password-api";
export interface PaymentPasswordContext {
  amount: number | string;
  currency: string;
  summary: string;
  details?: { name: string; quantity?: number; amount?: number | string }[];
  readDetailAmounts?: () => Promise<(number | string | undefined)[]>;
  /** Display precision for the authorized quote. Defaults to two decimal places. */
  precision?: 6 | 'full';
  belowCent?: boolean;
}
type Stage = "loading" | "read-error" | "setup" | "confirm" | "pay" | "recovery" | "reset" | "reset-confirm" | "pending";
type ErrorKey = "" | "readFailed" | "failed" | "mismatch" | "simple" | "incorrect" | "locked" | "versionChanged" | "recoveryUnavailable" | "codeInvalid" | "proofExpired" | "changeProofExpired" | "changeNotCompleted" | "samePassword" | "verifyReenter";
type PendingCommand = { commandKey: string; operation: "setup" | "change" | "reset"; expiresAt?: string };
const CHANGE_PROOF_EXPIRY_GRACE_MS = 30_000;
interface PendingStorage { read(): unknown; write(command: PendingCommand | null): boolean }

export function simplePaymentPassword(value: string): boolean {
  return /^(.)\1{5}$/.test(value) || "0123456789012345".includes(value) || "9876543210987654".includes(value);
}
export function paymentPasswordErrorKey(error: unknown): ErrorKey {
  const message = asApiError(error).message;
  if (message === "PAYMENT_PASSWORD_INCORRECT") return "incorrect";
  if (message === "PAYMENT_PASSWORD_LOCKED") return "locked";
  if (/PAYMENT_PASSWORD_(VERSION_CONFLICT|ALREADY_CONFIGURED|NOT_CONFIGURED)/.test(message)) return "versionChanged";
  if (message === "PAYMENT_PASSWORD_TOO_SIMPLE") return "simple";
  if (message === "PAYMENT_PASSWORD_CONFIRM_MISMATCH") return "mismatch";
  if (message === "PAYMENT_PASSWORD_NEW_MUST_DIFFER") return "samePassword";
  if (message === "PAYMENT_PASSWORD_CHANGE_PROOF_INVALID_OR_EXPIRED") return "changeProofExpired";
  if (message === "PAYMENT_PASSWORD_ATTEMPT_ALREADY_USED") return "verifyReenter";
  if (message.includes("RECOVERY_UNAVAILABLE")) return "recoveryUnavailable";
  if (/PROOF|RESET_EXPIRED/.test(message)) return "proofExpired";
  if (/CODE|CHALLENGE/.test(message)) return "codeInvalid";
  return "failed";
}

/** Secrets stay in these in-memory fields only. The coordinator never executes a purchase. */
export function createPaymentPasswordCoordinator(api: PaymentPasswordApi, identity: () => string, randomId = requireCryptoUuid, pendingStorage?: PendingStorage) {
  const display = reactive({ state: null as Pick<PaymentPasswordState, "configured" | "lockedUntil" | "serverTime"> | null, loading: false });
  let displayReadEpoch = 0;
  let environmentInvalidated = false;
  const ui = reactive({
    visible: false, stage: "loading" as Stage, context: null as PaymentPasswordContext | null,
    state: null as PaymentPasswordState | null, busy: false, reading: false, rejectedRevision: 0, error: "" as ErrorKey,
    notice: "" as "" | "setupDonePay" | "resetDonePay", challenge: null as PaymentPasswordChallenge | null,
    resendAt: 0, now: Date.now(), revision: 0,
    completedOperation: "" as "" | "setup" | "change" | "reset", completedRevision: 0,
    changeError: "" as ErrorKey, changeRecheckRevision: 0, changeLockUnconfirmed: false,
    pendingOperation: "" as "" | PendingCommand["operation"],
  });
  let firstPassword = "";
  let proof: PaymentPasswordProof | null = null;
  let owner = "";
  let generation = 0;
  let statusReadInProgress = false;
  let resolve: ((auth: PaymentPasswordAuthorization | null) => void) | null = null;
  let personalResolve: ((success: boolean) => void) | null = null;
  let pending: (PendingCommand & { owner: string }) | null = null;
  let promptError: ErrorKey = "";
  let serverOffset = 0;
  let statusClock: { serverTime: number; receivedAt: number } | null = null;
  let receiptRead: Promise<void> | null = null;
  async function waitForQuery() { await receiptRead?.catch(() => {}); }
  function restorePendingRead() {
    if (!ui.visible) owner = identity();
    restorePending();
  }

  function clearSecrets() { firstPassword = ""; proof = null; ui.challenge = null; ui.resendAt = 0; ui.revision++; }
  function clearInputs() { firstPassword = ""; ui.revision++; }
  function current(token: number) { return token === generation && owner === identity(); }
  function restorePending() {
    if (!pendingStorage || pending?.owner === identity()) return;
    const value = pendingStorage.read();
    if (value === null) { pending = null; ui.pendingOperation = ""; return; }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("PAYMENT_PASSWORD_COMMAND_INVALID");
    const row = value as Record<string, unknown>;
    const { commandKey, operation, expiresAt } = row;
    if (typeof commandKey !== "string" || !commandKey || (operation !== "setup" && operation !== "change" && operation !== "reset")
      || (expiresAt !== undefined && (operation !== "change" || typeof expiresAt !== "string" || !Number.isFinite(Date.parse(expiresAt))))
      || Object.keys(row).some(key => key !== "commandKey" && key !== "operation" && key !== "expiresAt")) {
      throw new Error("PAYMENT_PASSWORD_COMMAND_INVALID");
    }
    pending = { commandKey, operation, expiresAt, owner: identity() };
    ui.pendingOperation = pending.operation;
  }
  function savePending(command: PendingCommand): boolean {
    if (pendingStorage && !pendingStorage.write(command)) return false;
    pending = { ...command, owner }; ui.pendingOperation = command.operation; return true;
  }
  function retirePending(): boolean {
    if (pendingStorage && !pendingStorage.write(null)) return false;
    pending = null; ui.pendingOperation = ""; return true;
  }
  function setState(state: PaymentPasswordState) {
    ui.state = state; serverOffset = Date.parse(state.serverTime) - Date.now(); ui.now = Date.now() + serverOffset;
    ui.changeLockUnconfirmed = false;
    invalidatePassiveTabRead("payment-password-display");
    displayReadEpoch++;
    display.loading = false;
    display.state = { configured: state.configured, lockedUntil: state.lockedUntil, serverTime: state.serverTime };
  }
  function sampleStatusClock(state: PaymentPasswordState) {
    const receivedAt = readTrustedMonotonicNowMs();
    statusClock = receivedAt === null ? null : { serverTime: Date.parse(state.serverTime), receivedAt };
  }
  function statusServerNow(): number | null {
    const now = readTrustedMonotonicNowMs();
    return statusClock && now !== null ? projectServerNow(statusClock.serverTime, statusClock.receivedAt, now) : null;
  }
  function applyStatusRead(state: PaymentPasswordState) {
    sampleStatusClock(state);
    setState(state);
  }
  function cancel() {
    generation++; statusReadInProgress = false; promptError = "";
    clearSecrets(); ui.visible = false; ui.busy = false; ui.context = null; ui.error = ""; ui.notice = "";
    resolve?.(null); resolve = null; personalResolve?.(false); personalResolve = null;
  }
  function accountChanged() {
    cancel(); pending = null; ui.pendingOperation = ""; ui.state = null; ui.changeError = "";
    ui.changeLockUnconfirmed = false;
    statusClock = null;
    invalidatePassiveTabRead("payment-password-display");
    displayReadEpoch++; display.state = null; display.loading = false;
  }
  watch(() => [apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl], () => {
    environmentInvalidated = true;
    accountChanged();
  }, { flush: "sync" });
  function ensureStatus(): Promise<boolean> {
    return runPassiveTabRead("payment-password-display", readDisplayStatus, identity(), () => display.state !== null);
  }
  async function readDisplayStatus(): Promise<boolean> {
    if (!identity() || environmentInvalidated) return false;
    const account = identity(), epoch = ++displayReadEpoch;
    const currentRead = () => epoch === displayReadEpoch && account === identity();
    display.loading = true;
    try {
      const state = await api.status();
      if (!currentRead()) return false;
      sampleStatusClock(state);
      display.state = { configured: state.configured, lockedUntil: state.lockedUntil, serverTime: state.serverTime };
      serverOffset = Date.parse(state.serverTime) - Date.now(); ui.now = Date.now() + serverOffset;
      return true;
    } catch (cause) {
      if (currentRead() && !isTransientReadFailure(cause)) display.state = null;
      return false;
    } finally { if (epoch === displayReadEpoch && account === identity()) display.loading = false; }
  }
  function displayLocked(): boolean { return !!display.state?.lockedUntil && Date.parse(display.state.lockedUntil) > ui.now; }
  async function refreshStatus(options: { isCurrent?: () => boolean; silent?: boolean; keepTransientSnapshot?: boolean } = {}): Promise<PaymentPasswordState | null> {
    const account = identity(), token = generation;
    const currentRead = () => account === identity() && token === generation && (options.isCurrent?.() ?? true);
    if (!currentRead()) return null;
    try { const result = await api.status(); if (!currentRead()) return null; applyStatusRead(result); return result; }
    catch (error) {
      if (currentRead() && !options.silent && !(options.keepTransientSnapshot && isTransientReadFailure(error))) ui.state = null;
      return null;
    }
  }
  async function load(showLoading = true) {
    if (!ui.visible || statusReadInProgress) return;
    const token = generation, startStage = ui.stage;
    statusReadInProgress = true;
    if (showLoading) { ui.stage = "loading"; ui.error = ""; }
    try {
      restorePending();
      if (pending?.owner === owner) { ui.stage = "pending"; ui.error = ""; promptError = ""; return; }
      const state = await api.status(); if (!current(token)) return; applyStatusRead(state);
      // A background re-read (lock expiry, read-failure recovery) only settles the step it started from; a step the user
      // has moved on to (recovery) keeps its own flow.
      if (!showLoading && ui.stage !== startStage) return;
      const error = promptError; promptError = "";
      if (state.configured && !ui.context) { const done = personalResolve; personalResolve = null; ui.visible = false; done?.(false); return; }
      ui.stage = state.configured ? "pay" : "setup";
      ui.error = error;
    } catch { if (current(token) && (showLoading || ui.stage === startStage)) { ui.stage = "read-error"; ui.error = "readFailed"; } }
    finally { if (current(token)) statusReadInProgress = false; }
  }
  async function recoverDetailAmounts() {
    const context = ui.context, token = generation;
    if (!ui.visible || !context?.details || !context.readDetailAmounts) return;
    const amounts = await context.readDetailAmounts();
    if (!current(token) || !ui.visible) return;
    context.details.forEach((item, index) => { item.amount ??= amounts[index]; });
  }
  function open(context: PaymentPasswordContext | null, retryError: ErrorKey = ""): void {
    cancel(); owner = identity(); ui.context = context ? { ...context, details: context.details?.map(item => ({ ...item })) } : null;
    promptError = retryError;
    ui.visible = true; void load();
  }
  function request(context: PaymentPasswordContext, retryError?: ErrorKey): Promise<PaymentPasswordAuthorization | null> {
    open(context, retryError); return new Promise(done => { resolve = done; });
  }
  function setup(): Promise<boolean> { open(null); return new Promise(done => { personalResolve = done; }); }
  async function recover(): Promise<boolean> {
    cancel(); owner = identity(); ui.visible = true;
    const result = new Promise<boolean>(done => { personalResolve = done; });
    void startRecovery(); return result;
  }
  function finishMutation(receipt: PaymentPasswordReceipt): boolean {
    if (receipt.status !== "SUCCEEDED") return false;
    if (receipt.state) setState(receipt.state);
    const operation = pending?.operation;
    ui.completedOperation = operation ?? ""; ui.completedRevision++;
    retirePending(); clearSecrets(); ui.error = "";
    if (ui.context) { ui.stage = "pay"; ui.notice = operation === "reset" ? "resetDonePay" : "setupDonePay"; }
    else { const done = personalResolve; personalResolve = null; ui.visible = false; done?.(true); }
    return true;
  }
  function next(password: string) {
    if (!validPaymentPassword(password) || ui.busy) return;
    if (simplePaymentPassword(password)) { ui.error = "simple"; return; }
    if (ui.stage === "reset" && (!proof || Date.parse(proof.expiresAt) <= Date.now() + serverOffset)) {
      clearSecrets(); ui.stage = "recovery"; ui.error = "proofExpired"; return;
    }
    firstPassword = password; ui.stage = ui.stage === "reset" ? "reset-confirm" : "confirm"; ui.error = ""; ui.revision++;
  }
  function restart() { clearInputs(); ui.error = ""; ui.stage = ui.stage === "reset-confirm" ? "reset" : "setup"; }
  function showMutationRejection(error: ErrorKey, reset: boolean) {
    if (error === "versionChanged") {
      promptError = error;
      ui.busy = false;
      void load();
      return;
    }
    ui.error = error;
    ui.stage = reset ? "recovery" : "setup";
  }
  async function confirm(password: string) {
    if (ui.busy || !validPaymentPassword(password)) return;
    if (password !== firstPassword) { ui.error = "mismatch"; ui.revision++; return; }
    const reset = ui.stage === "reset-confirm";
    if (reset && (!proof || Date.parse(proof.expiresAt) <= Date.now() + serverOffset)) {
      clearSecrets(); ui.stage = "recovery"; ui.error = "proofExpired"; return;
    }
    const token = generation;
    const command: PendingCommand = { commandKey: randomId(), operation: reset ? "reset" : "setup" };
    if (!savePending(command)) { ui.error = "failed"; return; }
    ui.busy = true; ui.error = "";
    const input = { newPassword: firstPassword, confirmPassword: password, commandKey: command.commandKey };
    const resetInput = reset ? { ...input, resetProof: proof!.resetProof, expectedCredentialVersion: ui.state!.credentialVersion } : null;
    clearSecrets();
    try {
      const result = resetInput ? await api.reset(resetInput) : await api.setup(input);
      if (!current(token)) return;
      if (!finishMutation(result)) ui.stage = "pending";
    } catch (error) {
      if (!current(token)) return;
      const credentialConflict = isApiRefusal(error, 409, "PAYMENT_PASSWORD_VERSION_CONFLICT", "PAYMENT_PASSWORD_ALREADY_CONFIGURED");
      if (!credentialConflict && isAmbiguousOutcome(error)) ui.stage = "pending";
      else {
        if (!retirePending()) { ui.stage = "pending"; ui.error = "failed"; return; }
        showMutationRejection(paymentPasswordErrorKey(error), reset);
      }
    } finally { if (current(token)) ui.busy = false; }
  }
  function settleChangeRejection(error: ErrorKey, state?: PaymentPasswordState): boolean {
    if (!retirePending()) return false;
    clearSecrets();
    if (state) setState(state);
    ui.changeLockUnconfirmed = error === "locked" && !state?.lockedUntil;
    ui.changeError = error;
    // A wallet payment that opened the layer still owns it after the old change settles.
    if (ui.context) void load();
    else {
      ui.visible = false;
      if (error !== "changeNotCompleted" && error !== "samePassword" && (error !== "locked" || ui.changeLockUnconfirmed)) ui.changeRecheckRevision++;
    }
    return true;
  }
  function query(readAllowed: () => boolean = () => true): Promise<void> {
    if (receiptRead) return receiptRead;
    if (!pending || ui.busy || !readAllowed()) return Promise.resolve();
    const command = pending, token = generation;
    const currentRead = () => current(token) && pending === command && readAllowed();
    ui.reading = true;
    const read = Promise.resolve().then(async () => {
      if (!currentRead()) return;
      // Legacy records keep their previous NOT_SEEN policy. For a dated record, establish
      // expiry before dispatching the receipt read so a pre-expiry NOT_SEEN cannot settle it.
      let mayRetireUnseenChange = command.operation === "change" && !command.expiresAt;
      if (command.operation === "change" && command.expiresAt) {
        let serverNow = statusServerNow();
        if (serverNow === null) {
          const state = await refreshStatus({ isCurrent: currentRead, silent: true });
          if (!currentRead()) return;
          if (state) serverNow = Date.parse(state.serverTime);
        }
        mayRetireUnseenChange = serverNow !== null
          && serverNow >= Date.parse(command.expiresAt) + CHANGE_PROOF_EXPIRY_GRACE_MS;
      }
      const result = await api.receipt(command.commandKey);
      if (!currentRead()) return;
      if (finishMutation(result)) return;
      const expiredChangeNotSeen = mayRetireUnseenChange && result.status === "NOT_SEEN";
      if (result.status === "REJECTED" || expiredChangeNotSeen) {
        const error = expiredChangeNotSeen ? "changeNotCompleted" : paymentPasswordErrorKey(new ApiError({
          kind: "business", message: result.message ?? "PAYMENT_PASSWORD_UPDATE_REJECTED",
        }));
        if (command.operation === "change") {
          // A rejected receipt describes the old command, including any lock at the time of rejection.
          if (!settleChangeRejection(error)) throw new Error("PAYMENT_PASSWORD_COMMAND_RETIRE_FAILED");
          return;
        }
        if (!retirePending()) throw new Error("PAYMENT_PASSWORD_COMMAND_RETIRE_FAILED");
        clearSecrets();
        ui.error = error;
        ui.rejectedRevision++;
        if (!ui.visible) {
          ui.changeError = ui.error; ui.visible = false; await refreshStatus({ isCurrent: readAllowed, silent: true }); return;
        }
        showMutationRejection(ui.error, command.operation === "reset");
      }
    }).finally(() => {
      if (receiptRead === read) { receiptRead = null; ui.reading = false; }
    });
    receiptRead = read;
    return read;
  }
  function authorize(password: string) {
    if (ui.stage !== "pay" || ui.busy || !validPaymentPassword(password) || !ui.state?.configured || ui.state.lockedUntil !== null) return;
    const auth = { paymentPassword: password, credentialVersion: ui.state.credentialVersion, attemptNo: randomId() };
    const done = resolve; resolve = null; clearSecrets(); ui.visible = false; ui.context = null; done?.(auth);
  }
  function locked(): boolean { return !!ui.state?.lockedUntil && Date.parse(ui.state.lockedUntil) > ui.now; }
  async function startRecovery() {
    if (ui.busy) return; clearSecrets(); ui.stage = "recovery"; ui.error = "";
    await sendChallenge();
  }
  function unavailableRecovery() { clearSecrets(); ui.stage = "recovery"; ui.error = "recoveryUnavailable"; }
  async function sendChallenge() {
    tick();
    if (ui.busy || ui.resendAt > ui.now) return;
    const token = generation; ui.busy = true; ui.error = "";
    try {
      const state = await api.status(); if (!current(token)) return; applyStatusRead(state);
      const challenge = await api.challenge(); if (!current(token)) return;
      ui.challenge = challenge; ui.resendAt = Date.now() + serverOffset + challenge.resendAfterSec * 1000;
    } catch (error) { if (current(token)) ui.error = paymentPasswordErrorKey(error); }
    finally { if (current(token)) ui.busy = false; }
  }
  async function verify(code: string) {
    if (ui.busy || !ui.challenge || !/^[0-9]{6}$/.test(code)) return;
    const token = generation; ui.busy = true; ui.error = ""; ui.revision++;
    try { const result = await api.verify(ui.challenge.challengeNo, code); if (!current(token)) return;
      proof = result; ui.stage = "reset"; ui.challenge = null;
    } catch (error) { if (current(token)) ui.error = paymentPasswordErrorKey(error); }
    finally { if (current(token)) ui.busy = false; }
  }
  async function changeVerify(input: PaymentPasswordChangeVerification, isCurrent: () => boolean) {
    const account = identity(), token = generation;
    const currentRead = () => isCurrent() && account === identity() && token === generation;
    const result = await api.changeVerify(input);
    if (!currentRead()) return null;
    if ("changeProof" in result) return result;
    setState(result.state);
    const error = paymentPasswordErrorKey(new ApiError({ kind: "business", message: result.reason }));
    if (error === "versionChanged") await refreshStatus({ isCurrent: currentRead, silent: true });
    return currentRead() ? { error } : null;
  }
  async function change(input: PaymentPasswordChangeCommand, expiresAt: string): Promise<boolean> {
    if (ui.busy || !ui.state?.configured) return false;
    try { restorePending(); } catch { ui.changeError = "failed"; return false; }
    if (pending) return false;
    owner = identity(); const token = generation;
    if (!savePending({ commandKey: input.commandKey, operation: "change", expiresAt })) { ui.changeError = "failed"; return false; }
    ui.changeError = "";
    ui.busy = true;
    try {
      const result = await api.change(input);
      if (!current(token)) return false;
      if (result.status === "REJECTED") {
        settleChangeRejection(paymentPasswordErrorKey(new ApiError({
          kind: "business", message: result.message ?? "PAYMENT_PASSWORD_UPDATE_REJECTED",
        })), result.state);
        return false;
      }
      return finishMutation(result);
    } catch (error) {
      if (!current(token)) return false;
      const credentialRefusal = isApiRefusal(error, 409, "PAYMENT_PASSWORD_VERSION_CONFLICT", "PAYMENT_PASSWORD_NOT_CONFIGURED")
        || isApiRefusal(error, 429, "PAYMENT_PASSWORD_LOCKED");
      if (!credentialRefusal && isAmbiguousOutcome(error)) return false;
      settleChangeRejection(paymentPasswordErrorKey(error));
      return false;
    } finally { if (current(token)) ui.busy = false; }
  }
  function tick() { ui.now = Date.now() + serverOffset; }
  return { ui, display, waitForQuery, restorePendingRead, ensureStatus, displayLocked, cancel, accountChanged, refreshStatus, request, setup, recover, recoverDetailAmounts, load, next, restart, confirm, query, authorize, startRecovery, unavailableRecovery, sendChallenge, verify, changeVerify, change, locked, tick };
}

const coordinator = createPaymentPasswordCoordinator(createPaymentPasswordApi(apiClient), () => {
  const session = sessionVault.read(); return session ? `${session.user.userId}:${session.sessionChainId}` : "";
}, requireCryptoUuid, {
  read: () => {
    const account = sessionVault.read()?.user.userId;
    if (!account) return null;
    return readAccountRow<{ pending: unknown }>("nexgrid-payment-password-commands-accounts-v1", `user:${account}`, true)?.pending ?? null;
  },
  write: pending => {
    const account = sessionVault.read()?.user.userId;
    return !!account && writeAccountRow("nexgrid-payment-password-commands-accounts-v1", `user:${account}`, { pending });
  },
});
sessionVault.subscribe?.((_previous, _next, continuation) => { if (!continuation) coordinator.accountChanged(); });
export const usePaymentPassword = () => coordinator;
export const requestPaymentPassword = coordinator.request;
export const cancelPaymentPassword = coordinator.cancel;
