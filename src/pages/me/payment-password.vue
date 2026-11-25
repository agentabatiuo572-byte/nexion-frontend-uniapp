<template>
  <AppChassis active="me">
    <SubPageHeader back="/pages/me/me" :title="state?.configured ? t.paymentPin.change : t.paymentPin.title" :back-action="canBackToVerify ? backToVerify : undefined" />
    <view class="payment-pin-page">
      <text v-if="!state" class="payment-pin-page__note">{{ t.paymentPin.purpose }}</text>
      <template v-if="pendingVisible">
        <text class="payment-pin-page__note" role="status">{{ ui.pendingOperation === 'change' ? t.paymentPin.changePending : t.paymentPin.pending }}</text>
      </template>
      <view v-else-if="loading && !state?.configured" role="status"><text class="payment-pin-page__note">{{ t.paymentPin.loading }}</text></view>
      <!-- Nothing to show (03 §3.4, §3.5.2): one sentence in the middle of the page and the page's single reload. -->
      <view v-else-if="!state" class="payment-pin-page__empty">
        <text class="payment-pin-page__empty-text" role="alert">{{ t.paymentPin.readFailed }}</text>
        <view class="nx-card-recovery-action" role="button" tabindex="0" @click="load">{{ t.paymentPin.reload }}</view>
      </view>
      <template v-else-if="!state.configured">
        <view class="payment-vault-stage"><view class="payment-vault-aura payment-vault-aura--outer" aria-hidden="true" /><view class="payment-vault nx-tint">
          <view class="payment-vault-lock" aria-hidden="true"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14.5v2.5"/></svg></view>
          <view class="payment-vault-dots" aria-hidden="true"><view v-for="n in 6" :key="n" :style="{ animationDelay: `${n * 80}ms` }" /></view>
          <text class="payment-vault-title">{{ t.paymentPin.title }}</text><NxTag class="payment-vault-status" :label="t.paymentPin.notConfigured" /><text class="payment-vault-purpose">{{ t.paymentPin.purpose }}</text>
        </view></view>
      </template>
      <!-- Change in two steps (PRD §4.6.6): 1 verify the current PIN, 2 set the new one (enter, then enter again).
           One input group per screen, high on the page, so it and the step's action stay above the keyboard (BUG-738). -->
      <view v-else class="pin-change">
        <view class="pin-change__progress">
          <view class="pin-change__bars" aria-hidden="true"><view class="on" /><view :class="{ on: step !== 'verify' }" /></view>
          <text>{{ step === 'verify' ? t.paymentPin.stepOne : t.paymentPin.stepTwo }}</text>
        </view>
        <text class="pin-change__heading" role="heading" aria-level="2">{{ heading }}</text>
        <text class="pin-change__hint">{{ hint }}</text>
        <PaymentPasswordInput :key="step" v-model="passwords[stepField]" class="pin-change__input" :label="heading" :adjust-position="false"
          :auto-focus="!inputDisabled" :disabled="inputDisabled" @complete="completeStep" />
        <!-- In-place result line under the digits: lock (with time) wins, then the error, then the busy status. -->
        <text v-if="step === 'verify' && (pin.locked() || ui.changeLockUnconfirmed)" class="pin-change__error" role="alert">{{ lockMessage }}</text>
        <text v-else-if="stepError" id="pin-change-error" class="pin-change__error" role="alert">{{ stepError }}</text>
        <text v-else-if="stepStatus" id="pin-change-status" class="pin-change__status" role="status">{{ stepStatus }}</text>
        <view v-if="step === 'verify'" class="pin-change__links">
          <view v-if="retryVerification || (lockNeedsRead && statusReadFailed && !loading)" class="pin-change__link" role="button" tabindex="0" @click="retryVerification ? verifyCurrent() : load()">{{ t.paymentPin.retry }}</view>
          <view class="pin-change__link" role="button" :tabindex="actionBusy ? -1 : 0" :aria-disabled="actionBusy" @click="recover">{{ t.paymentPin.forgot }}</view>
        </view>
        <view v-else-if="step === 'confirm'" class="pin-change__links">
          <view class="pin-change__link" role="button" :tabindex="ui.busy ? -1 : 0" :aria-disabled="ui.busy" @click="!ui.busy && restartNew()">{{ t.paymentPin.startAgain }}</view>
        </view>
      </view>
    </view>
    <template #pageFixed>
      <view v-if="!loading && state && !state.configured && !ui.pendingOperation" class="payment-pin-page__dock nx-glass-bar"><NxButton variant="primary" @click="setup">{{ t.paymentPin.setup }}</NxButton></view>
      <!-- Step 2's action is the lone floating button (04 §4.0). Its box follows the visible viewport, so with the keyboard up
           it rests above the keyboard instead of under it (BUG-738; same measure as the PIN layer, BUG-735). -->
      <view v-if="dockOpen" class="pin-change-dock" :style="{ top: dockViewport.top, height: dockViewport.height }">
        <!-- While the action is unavailable its reason sits above it (03 §3.1 bottom bar, 04 §4.0 tray note) and names it for
             screen readers; a reason already on screen (the error or status line under the digits) is linked instead. -->
        <view class="nx-glass-bar pin-change-dock__bar">
          <text v-if="dockReason" id="pin-change-reason" class="nx-tray-note">{{ dockReason }}</text>
          <NxButton variant="primary" :disabled="step === 'new' ? !canNext : !canSave" :busy="step === 'confirm' && ui.busy" :aria-describedby="dockDescribedBy"
            @click="step === 'new' ? toConfirm() : save()">{{ step === 'new' ? t.paymentPin.next : ui.busy ? t.paymentPin.changing : t.paymentPin.save }}</NxButton>
        </view>
      </view>
    </template>
  </AppChassis>
</template>
<script setup lang="ts">
import { useVisibleInterval } from "@/composables/use-tab-page-lifecycle";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from "vue";
import { onBackPress, onHide, onShow, onUnload } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import NxButton from "@/components/ui/nx-button.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import PaymentPasswordInput from "@/components/payment-password-input.vue";
import { useDialogBackHeld } from "@/composables/use-dialog-a11y";
// #ifdef H5
import { hasOpenDialog, registerBrowserPageBack } from "@/composables/use-dialog-a11y";
// #endif
import { usePaymentPinViewport } from "@/composables/use-payment-pin-viewport";
import { usePaymentPassword, paymentPasswordErrorKey, simplePaymentPassword, validPaymentPassword } from "@/store/payment-password";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { navBack, navTo } from "@/lib/route";
import { toast } from "@/store/ui";
import { sessionVault } from "@/api/runtime";
import { isAmbiguousOutcome } from "@/api/errors";
import type { PaymentPasswordChangeProof, PaymentPasswordChangeVerification } from "@/api/payment-password-api";
import { requireCryptoUuid } from "@/lib/secure-command-id";
const pin = usePaymentPassword(); const ui = pin.ui; const state = computed(() => ui.state); const t = useT();
const passwords = reactive({ current: "", new: "", confirm: "" }); const loading = ref(true);
const active = ref(true);
const statusReadFailed = ref(false);
const verifying = ref(false);
const verificationAttempt = shallowRef<PaymentPasswordChangeVerification>();
const verifiedChange = shallowRef<PaymentPasswordChangeProof & { expectedCredentialVersion: number }>();
let pageGeneration = 0;
const validation = computed(() => {
  if (validPaymentPassword(passwords.new) && simplePaymentPassword(passwords.new)) return t.value.paymentPin.simple;
  if (validPaymentPassword(passwords.confirm) && passwords.confirm !== passwords.new) return t.value.paymentPin.mismatch;
  return "";
});
const error = computed(() => !ui.changeError || ui.changeError === "locked" ? "" : ui.changeError === "incorrect" ? fmt(t.value.paymentPin.incorrect, { n: state.value?.remainingAttempts ?? 0 }) : t.value.paymentPin[ui.changeError]);
const changeLocked = computed(() => ui.changeLockUnconfirmed || !!state.value?.lockedUntil);
const lockNeedsRead = computed(() => changeLocked.value && !pin.locked());
const lockMessage = computed(() => {
  if (!pin.locked()) return t.value.paymentPin.lockedLabel;
  const seconds = Math.max(0, Math.ceil((Date.parse(state.value?.lockedUntil ?? "") - ui.now) / 1000));
  return fmt(t.value.paymentPin.locked, { time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` });
});
type Step = "verify" | "new" | "confirm";
const step = ref<Step>("verify");
const stepField = computed(() => step.value === "verify" ? "current" as const : step.value);
const heading = computed(() => step.value === "verify" ? t.value.paymentPin.verifyTitle : step.value === "new" ? t.value.paymentPin.newTitle : t.value.paymentPin.confirmNewTitle);
const hint = computed(() => step.value === "verify" ? t.value.paymentPin.verifyHint : step.value === "new" ? t.value.paymentPin.rule : t.value.paymentPin.repeatDigits);
const actionBusy = computed(() => ui.busy || verifying.value);
const retryVerification = computed(() => !!verificationAttempt.value && !verifying.value);
const submittingChange = computed(() => ui.pendingOperation === "change" && ui.busy && !ui.visible && step.value === "confirm");
const pendingVisible = computed(() => !!ui.pendingOperation && !submittingChange.value);
const canBackToVerify = computed(() => step.value !== "verify" && !pendingVisible.value);
const proofUsable = computed(() => {
  const verified = verifiedChange.value;
  return !!verified && Date.parse(verified.expiresAt) > ui.now && verified.expectedCredentialVersion === state.value?.credentialVersion;
});
const inputDisabled = computed(() => loading.value || statusReadFailed.value || actionBusy.value || (step.value === "verify" && (changeLocked.value || retryVerification.value)));
const stepError = computed(() => {
  if (submittingChange.value || verifying.value) return "";
  if (retryVerification.value) return t.value.paymentPin.verifyUnavailable;
  if (step.value === "verify" && lockNeedsRead.value) {
    return statusReadFailed.value && !loading.value ? t.value.paymentPin.unavailable : "";
  }
  return validation.value || error.value || (statusReadFailed.value ? t.value.paymentPin.unavailable : "");
});
const stepStatus = computed(() => {
  if (submittingChange.value) return t.value.paymentPin.changing;
  if (verifying.value) return t.value.paymentPin.verifying;
  return loading.value || (step.value === "verify" && lockNeedsRead.value) ? t.value.paymentPin.loading : "";
});
const canNext = computed(() => step.value === "new" && !inputDisabled.value && validPaymentPassword(passwords.new) && !validation.value);
const canSave = computed(() => step.value === "confirm" && !!verifiedChange.value && !inputDisabled.value && validPaymentPassword(passwords.new) && validPaymentPassword(passwords.confirm) && !validation.value && !state.value?.lockedUntil && !ui.pendingOperation);
const dockOpen = computed(() => active.value && !loading.value && !!state.value?.configured && canBackToVerify.value);
const dockViewport = usePaymentPinViewport(dockOpen);
// Why step 2's action is unavailable: digits still missing is said above the button; any other reason is the line under
// the digits, which the button points to.
const dockReason = computed(() => {
  if (actionBusy.value || stepError.value || stepStatus.value) return "";
  const digits = step.value === "new" ? passwords.new : step.value === "confirm" ? passwords.confirm : "";
  return validPaymentPassword(digits) ? "" : t.value.paymentPin.incomplete;
});
const dockDescribedBy = computed(() => {
  if (step.value === "new" ? canNext.value : canSave.value) return undefined;
  return dockReason.value ? "pin-change-reason" : stepError.value ? "pin-change-error" : stepStatus.value ? "pin-change-status" : undefined;
});
function completeStep() {
  if (!active.value || step.value !== "verify" || inputDisabled.value || !state.value?.configured || !validPaymentPassword(passwords.current)) return;
  try {
    verificationAttempt.value = { currentPassword: passwords.current, expectedCredentialVersion: state.value.credentialVersion, attemptNo: requireCryptoUuid() };
  } catch {
    clear();
    ui.changeError = "failed";
    return;
  }
  void verifyCurrent();
}
async function verifyCurrent() {
  const attempt = verificationAttempt.value;
  if (!attempt || actionBusy.value) return;
  const isCurrent = () => active.value && verificationAttempt.value === attempt;
  verifying.value = true;
  ui.changeError = "";
  try {
    const result = await pin.changeVerify(attempt, isCurrent);
    if (!isCurrent()) return;
    if (!result || "error" in result) {
      clear();
      if (result) ui.changeError = result.error;
      return;
    }
    verifiedChange.value = { ...result, expectedCredentialVersion: attempt.expectedCredentialVersion };
    verificationAttempt.value = undefined;
    passwords.current = "";
    verifying.value = false;
    step.value = "new";
  } catch (error) {
    if (!isCurrent() || isAmbiguousOutcome(error)) return;
    clear();
    ui.changeError = paymentPasswordErrorKey(error);
  } finally {
    if (isCurrent()) verifying.value = false;
  }
}
function toConfirm() { if (canNext.value) { ui.changeError = ""; step.value = "confirm"; } }
function restartNew() { passwords.new = ""; passwords.confirm = ""; step.value = "new"; }
function clear() {
  verifying.value = false;
  verificationAttempt.value = undefined;
  verifiedChange.value = undefined;
  passwords.current = "";
  passwords.new = "";
  passwords.confirm = "";
  step.value = "verify";
}
function backToVerify() {
  if (ui.busy) return;
  clear();
  ui.changeError = "";
}
const dialogHoldsBack = useDialogBackHeld();
onBackPress(event => {
  if (event.from !== "backbutton" || dialogHoldsBack(event)) return false;
  if (canBackToVerify.value) {
    backToVerify();
    return true;
  }
  // #ifdef APP-PLUS
  // Preserve the header's fallback when Android opened this page with no back stack.
  if (getCurrentPages().length === 1) {
    navBack("/pages/me/me");
    return true;
  }
  // #endif
  return false;
});
// #ifdef H5
let releaseBrowserBack: (() => void) | undefined;
onMounted(() => {
  releaseBrowserBack = registerBrowserPageBack(() => {
    if (active.value && canBackToVerify.value && !hasOpenDialog()) return backToVerify;
  });
});
onUnmounted(() => releaseBrowserBack?.());
// #endif
// Observe the settled UI state before rendering the pending screen, after the busy flag and durable key update together.
watch(pendingVisible, visible => {
  if (visible && ui.pendingOperation === "change") clear();
});
watch(() => ui.changeError, key => {
  if (!key) return;
  pin.tick();
  if (key === "samePassword" && proofUsable.value) {
    restartNew();
    return;
  }
  clear();
  if (key === "samePassword") ui.changeError = "changeProofExpired";
});
watch(() => ui.changeRecheckRevision, () => {
  if (active.value && !ui.visible) void readStatus(true);
});
async function readStatus(keepSnapshot = false) {
  const generation = pageGeneration;
  const isCurrent = () => active.value && generation === pageGeneration;
  if (!isCurrent() || !sessionVault.read()) return;
  loading.value = true;
  const result = await pin.refreshStatus({ isCurrent, silent: keepSnapshot || changeLocked.value, keepTransientSnapshot: true });
  if (isCurrent()) {
    statusReadFailed.value = !result;
    loading.value = false;
  }
}
async function load() {
  if (!sessionVault.read()) return;
  try { pin.restorePendingRead(); }
  catch { if (active.value) { ui.changeError = "failed"; loading.value = false; } return; }
  await readStatus();
}
useAutoRecovery({
  active: () => active.value && !ui.visible,
  failed: () => !loading.value && !ui.busy && !ui.pendingOperation && (statusReadFailed.value || lockNeedsRead.value),
  retry: readStatus, repeatMs: 30_000, quiet: false,
});
useAutoRecovery({
  active: () => active.value && !ui.visible,
  failed: () => !loading.value && pendingVisible.value && !ui.busy && !ui.reading,
  retry: () => {
    const generation = pageGeneration;
    return pin.query(() => active.value && generation === pageGeneration && !ui.visible);
  }, repeatMs: 15_000, quiet: true,
});
async function setup() { await pin.waitForQuery(); if (!await pin.setup()) await load(); }
async function recover() { await pin.waitForQuery(); if (actionBusy.value) return; clear(); if (!await pin.recover()) await load(); }
async function save() {
  await pin.waitForQuery();
  const verified = verifiedChange.value;
  if (!active.value || !canSave.value || !verified) return;
  try {
    void pin.change({ changeProof: verified.changeProof, expectedCredentialVersion: verified.expectedCredentialVersion,
      newPassword: passwords.new, confirmPassword: passwords.confirm, commandKey: requireCryptoUuid(), attemptNo: requireCryptoUuid() }, verified.expiresAt);
  } catch { ui.changeError = "failed"; return; }
}
watch(() => ui.completedRevision, () => {
  if (!active.value || ui.context || !ui.completedOperation) return;
  clear(); toast.success(t.value.paymentPin[`${ui.completedOperation}Success`]); navTo("/me");
});
watch(() => ui.rejectedRevision, () => {
  if (active.value && !ui.visible) toast.error(t.value.paymentPin[ui.error || "failed"]);
});
// After an H5 reload the session is restored after the page shows: load() waits for it and reads here.
const unsubscribe = sessionVault.subscribe?.((_previous, next, continuation) => {
  if (continuation) return;
  clear();
  statusReadFailed.value = false;
  if (next && active.value) void load();
});
function hide() { pageGeneration++; active.value = false; clear(); }
function visibility() { if (typeof document !== "undefined" && document.hidden) hide(); }
onShow(() => { active.value = true; void load(); }); onHide(hide); onUnload(hide);
useVisibleInterval(pin.tick, 1000, () => active.value && !ui.visible);
onMounted(() => { if (typeof document !== "undefined") document.addEventListener("visibilitychange", visibility); });
onUnmounted(() => { clear(); unsubscribe?.(); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", visibility); });
</script>
<style scoped>
.payment-pin-page { padding: var(--v5-space-4) var(--v5-space-5) calc(var(--v5-space-6) + var(--v5-space-1) + env(safe-area-inset-bottom)); max-width: 480px; margin: 0 auto; color: var(--v5-ink); }
.payment-pin-page__note { display: block; font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-2); line-height: 1.65; margin-bottom: var(--v5-space-4); }
/* Whole page unreadable (03 §3.4): one centred sentence (empty-state line, 10 §10.1: 13/18, ink-3) and the one reload. */
.payment-pin-page__empty { min-height: 50vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--v5-space-2); text-align: center; }
.payment-pin-page__empty-text { font-size: 13px; line-height: 18px; color: var(--v5-ink-3); }
/* Step screen: progress, heading (overview title role), one 4px-close hint, then the six digits. */
.pin-change { display: flex; flex-direction: column; padding-top: var(--v5-space-1); }
.pin-change__progress { display: flex; align-items: center; gap: 10px; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.pin-change__bars { display: flex; width: 64px; gap: var(--v5-space-1); }
.pin-change__bars > view { flex: 1; height: 4px; border-radius: 2px; background: var(--v5-surface-3); }
.pin-change__bars > .on { background: var(--v5-brand); }
.pin-change__heading { margin-top: var(--v5-space-5); color: var(--v5-ink); font: var(--ui-type-hero-title-weight) var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5); overflow-wrap: break-word; }
.pin-change__hint { margin-top: var(--v5-space-1); color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); overflow-wrap: break-word; }
.pin-change__input { margin: var(--v5-space-6) 0 0; }
/* Result line under the digits (10 §10.2 status/hint line size): error in danger, busy status in body ink. */
.pin-change__error, .pin-change__status { margin-top: var(--v5-space-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); overflow-wrap: break-word; }
.pin-change__error { color: var(--v5-danger); }
.pin-change__status { color: var(--v5-ink-2); }
/* Text buttons (03 §3.1: brand, no arrow; 10 §10.1 text link 13/18, 500), 44px target, centred under the digits. */
.pin-change__links { display: flex; flex-wrap: wrap; justify-content: center; column-gap: var(--v5-space-4); margin-top: var(--v5-space-3); }
.pin-change__link { display: flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 var(--v5-space-2); color: var(--v5-brand); font: var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); white-space: nowrap; }
.pin-change__link[aria-disabled="true"] { opacity: .5; }
/* The dock spans the visible viewport (keyboard excluded) and passes touches through; only the button takes them. */
.pin-change-dock { position: fixed; z-index: 20; left: 0; right: 0; top: 0; bottom: 0; pointer-events: none; }
.pin-change-dock[style*="height"] { bottom: auto; }
.pin-change-dock__bar { position: absolute; display: flex; flex-direction: column; pointer-events: auto; }
</style>

<style scoped>
.payment-pin-page { padding: 3px 16px 100px; }
.payment-vault-stage { position:relative; isolation:isolate; }
/* The outer halo fades uniformly; the vault keeps the halo's cyan as one uniform tint (.nx-tint). */
.payment-vault-aura.payment-vault-aura--outer { opacity:.5; z-index:-2; }
.payment-vault-aura { position:absolute; z-index:-1; inset:-8px -6px; pointer-events:none; }
.payment-vault-aura::before,.payment-vault-aura::after { content:""; position:absolute; width:180px; height:140px; border-radius:50%; filter:blur(42px); }
.payment-vault-aura::before { left:-10px; top:-6px; background:color-mix(in srgb,var(--v5-aura-sky) 40%,transparent); }
.payment-vault-aura::after { right:-14px; bottom:10px; background:color-mix(in srgb,var(--v5-tech-cyan) 43%,transparent); }
:global([data-theme="light"] .payment-vault-aura::before) { background:color-mix(in srgb,var(--v5-aura-sky) 14%,transparent); }
:global([data-theme="light"] .payment-vault-aura::after) { background:color-mix(in srgb,var(--v5-tech-cyan) 16%,transparent); }
.payment-vault { --nx-tint:var(--v5-tech-cyan); display:flex; flex-direction:column; align-items:center; text-align:center; padding:var(--v5-space-8) 20px 26px; border-radius:var(--v5-radius-xl); }
.payment-vault-lock { display:grid; place-items:center; width:88px; height:88px; border-radius:var(--v5-radius-2xl); background:var(--v5-brand-soft); color:var(--v5-brand); box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--v5-brand) 35%,transparent); animation:nx-viz-pop 520ms both; }
.payment-vault-dots { display:flex; gap:10px; margin-top:22px; }
.payment-vault-dots > view { width:12px; height:12px; border-radius:50%; background:var(--v5-brand); animation:nx-viz-pop 360ms both; }
.payment-vault-title { margin-top:22px; font-size:20px; line-height:28px; font-weight:600; }
/* 「未设置」 is a status: the shared NxTag, status size, neutral tone (03 §3.8). */
.payment-vault-status { margin-top:var(--v5-space-2); }
.payment-vault-purpose { margin-top:var(--v5-space-3); font-size:13px; line-height:20px; color:var(--v5-ink-3); }
.payment-pin-page__dock { position:fixed; display:flex; }
.payment-pin-page__dock > .nx-button { flex:1; }
@media(prefers-reduced-motion:reduce) { .payment-vault-lock,.payment-vault-dots > view { animation:none; } }
</style>
