<template>
  <view class="bank-binding" data-testid="bank-account-binding">
    <SubPageHeader back="/pages/me/me" :title="headerTitle" :back-action="headerBack" />
    <view class="binding-body">
      <text v-if="state.busy && !state.config" class="hint" role="status">{{ t.bankWithdrawal.loading }}</text>
      <view v-if="state.error" class="error-note" role="alert"><text>{{ errorMessage }}</text></view>
      <view v-if="state.error === 'load' || state.error === 'unsupported' || state.error === 'routingUnverified'" class="text-action" role="button" tabindex="0" :aria-disabled="state.busy" @click="form.load" @keydown.enter.prevent="form.load" @keydown.space.prevent="form.load"><text>{{ c.retry }}</text></view>

      <!-- Saved: first binding or a completed change. -->
      <view v-if="screen === 'saved'" class="binding-done">
        <view class="done-icon" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg></view>
        <text class="done-title" role="status" data-testid="bank-bind-saved">{{ savedAfterChange ? c.savedChangedTitle : t.bankWithdrawal.bound }}</text>
        <text v-if="state.config?.beneficiary" class="done-account mono">{{ state.config.beneficiary.maskedAccount }}</text>
        <view class="done-notes">
          <text class="hint" data-testid="bank-binding-status">{{ accountStatus }}</text>
          <text class="hint">{{ c.doneNote }}</text>
        </view>
        <view class="done-actions">
          <view class="submit ready" role="button" tabindex="0" @click="goWithdraw" @keydown.enter.prevent="goWithdraw" @keydown.space.prevent="goWithdraw"><text>{{ c.goWithdraw }}</text></view>
          <view class="glass-action" role="button" tabindex="0" data-testid="bank-bind-done" @click="done" @keydown.enter.prevent="done" @keydown.space.prevent="done"><LiquidGlass :radius="24" tone="control" /><text>{{ c.done }}</text></view>
        </view>
      </view>

      <!-- Bound account overview: change entry, or why it is locked. -->
      <template v-else-if="screen === 'overview' && state.config?.beneficiary">
        <!-- P-52: the bound account as a physical bank card; rules as a numbered list; the change action sits in the page bar. -->
        <view class="bcard" :aria-label="`${c.currentAccount} ${state.config.beneficiary.maskedAccount}`">
          <view class="bcard__top">
            <view class="bcard__bk" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M12 3 3 8h18z" /></svg></view>
            <text class="bcard__nm">{{ t.bankWithdrawal.recipientSubtitle }}</text>
            <text class="bcard__tag" :class="{ warn: accountNotice !== 'ready' }">{{ accountNotice === 'ready' ? c.statusReady : c.statusUnavailable }}</text>
          </view>
          <view class="bcard__bot">
            <text class="bcard__lb">{{ c.accountLabel }}</text>
            <text class="bcard__no">{{ dots(state.config.beneficiary.maskedAccount) }}</text>
            <text class="bcard__eff">{{ t.bankWithdrawal.effective }} {{ displayDate(state.config.beneficiary.effectiveAt) }}</text>
          </view>
        </view>
        <text v-if="accountNotice !== 'ready'" class="hint warn-text" data-testid="bank-binding-status">{{ accountStatus }}</text>
        <template v-if="changeLocked">
          <text class="hint">{{ c.lockedReason }}</text>
          <view class="link-row" role="link" tabindex="0" @click="goWithdraw" @keydown.enter.prevent="goWithdraw"><text>{{ c.viewWithdrawal }}</text><text aria-hidden="true">›</text></view>
        </template>
        <text class="sec-title">{{ copy.bankRules }}</text>
        <view class="rules-card" role="group" :aria-label="copy.bankRules">
          <view v-for="(rule, i) in rules" :key="rule" class="rule-item"><text class="rule-num">{{ i + 1 }}</text><text class="rule-text">{{ rule }}</text></view>
        </view>
      </template>

      <!-- Change step 2: review the new account and confirm with the SMS code. -->
      <template v-else-if="screen === 'verify' && state.config?.beneficiary">
        <view class="steps" aria-hidden="true"><text class="step step--on">1 {{ c.stepNew }}</text><text class="step step--on">2 {{ c.stepVerify }}</text></view>
        <view class="section-head"><text class="section-title">{{ c.verifyTitle }}</text><text class="hint">{{ c.verifyHint }}</text></view>
        <view class="group" role="group" :aria-label="c.reviewTitle" data-testid="bank-binding-review">
          <view class="review-row"><text>{{ c.oldAccount }}</text><text class="mono muted">{{ state.config.beneficiary.maskedAccount }}</text></view>
          <view class="review-row"><text>{{ c.newAccount }}</text><text class="mono strong" data-testid="bank-review-account">{{ state.account.trim() }}</text></view>
          <view class="review-row"><text>{{ c.holderLabel }}</text><text class="strong" data-testid="bank-review-holder">{{ state.holder.trim() }}</text></view>
          <view v-if="state.phase === 'details'" class="group-link" role="button" tabindex="0" data-testid="bank-bind-edit" @click="changeStep = 1" @keydown.enter.prevent="changeStep = 1" @keydown.space.prevent="changeStep = 1"><text>{{ c.editDetails }}</text></view>
        </view>
        <view class="field-block">
        <view class="group">
          <view class="field-row">
            <text class="field-label">{{ t.bankWithdrawal.code }}</text>
            <input v-model="state.code" class="field mono" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" :disabled="fieldsDisabled" :placeholder="c.otpPlaceholder" placeholder-style="color: var(--v5-ink-4)" :aria-label="`${t.bankWithdrawal.code} · ${c.required}`" aria-required="true" data-testid="bank-otp" />
            <view class="otp-send nx-frosted-button" role="button" tabindex="0" data-testid="bank-send-otp" :aria-disabled="!canSendOtp" @click="sendOtp" @keydown.enter.prevent="sendOtp" @keydown.space.prevent="sendOtp"><text>{{ resendSeconds > 0 ? c.otpResendIn.replace('{s}', String(resendSeconds)) : t.bankWithdrawal.sendCode }}</text></view>
          </view>
        </view>
        <text v-if="state.challengeNo" class="hint" role="status" data-testid="bank-otp-status">{{ state.otpExpiresAt > now ? c.otpSentValid.replace('{m}', String(otpMinutesLeft)) : c.otpExpired }}</text>
        <text v-else class="hint">{{ c.otpHint }}</text>
        </view>
        <text class="hint footnote">{{ c.changeEffectiveNote }}</text>
      </template>

      <!-- First binding, or change step 1: the new account. -->
      <template v-else-if="screen === 'first' || screen === 'details'">
        <!-- Change step 1 (P-52): step track, a live preview card of the new account, then the two fields in wells. -->
        <view v-if="screen === 'details'" class="steps2" :aria-label="`1 / 2 ${c.stepNew}`"><view class="steps2__on"><text class="steps2__i">1</text><text>{{ c.stepNew }}</text></view><view class="steps2__ln" aria-hidden="true" /><view class="steps2__off" aria-hidden="true" /></view>
        <view v-if="screen === 'details'" class="bcard bcard--preview" aria-hidden="true">
          <text class="bcard__lb">{{ c.newAccount }}</text>
          <text class="bcard__no">{{ groupedAccount || "—" }}</text>
          <text class="bcard__ho">{{ state.holder.trim().toUpperCase() || "—" }}</text>
        </view>
        <text v-if="screen === 'details'" class="vh" data-testid="bank-account-routed-notice">{{ c.accountRoutedNotice }}</text>
        <view v-else class="first-head">
          <view class="first-icon" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h18" /><path d="M5 10v8" /><path d="M9.5 10v8" /><path d="M14.5 10v8" /><path d="M19 10v8" /><path d="M3 21h18" /><path d="m12 3 9 5H3z" /></svg></view>
          <text class="first-title">{{ c.firstTitle }}</text>
          <text class="hint">{{ t.bankWithdrawal.recipientSubtitle }}</text>
        </view>
        <view class="field-block">
        <view class="group">
          <view class="field-row">
            <text class="field-label">{{ c.accountLabel }}</text>
            <input v-model="state.account" class="field mono" type="text" inputmode="numeric" maxlength="32" autocomplete="off" required aria-required="true" :disabled="fieldsDisabled" :placeholder="c.accountPlaceholder" placeholder-style="color: var(--v5-ink-4)" :aria-label="`${c.accountLabel} · ${c.required}`" data-testid="bank-account" />
            <text class="hint field-hint">{{ c.accountHint }}</text>
          </view>
          <view class="field-row">
            <text class="field-label">{{ c.holderLabel }}</text>
            <input v-model="state.holder" class="field" type="text" maxlength="100" autocomplete="off" required aria-required="true" :disabled="fieldsDisabled" :placeholder="c.holderPlaceholder" placeholder-style="color: var(--v5-ink-4)" :aria-label="`${c.holderLabel} · ${c.required}`" data-testid="bank-holder" />
          </view>
        </view>
        <view class="hint-stack">
          <text v-if="screen === 'first'" class="hint">{{ c.firstNoSms }}</text>
        </view>
        </view>
        <view class="footnote-row"><text>{{ copy.bankFooter }}</text></view>
      </template>
    </view>

    <!-- First binding confirmation: the user must confirm account number and holder before saving. -->
    <view v-if="review" class="review-sheet-root">
      <view class="review-scrim nx-sheet-fade-in" @click="cancelReview" />
      <view class="nx-glass-sheet nx-sheet-slide-up review-sheet" role="dialog" aria-modal="true" :aria-label="c.reviewTitle" data-testid="bank-binding-review">
        <view class="sheet-handle" aria-hidden="true" />
        <view class="sheet-head"><text class="section-title" role="heading" aria-level="2">{{ c.reviewTitle }}</text><text class="hint">{{ c.reviewHint }}</text></view>
        <view class="group group--inset">
          <view class="review-row"><text>{{ c.accountLabel }}</text><text class="mono strong" data-testid="bank-review-account">{{ review.account }}</text></view>
          <view class="review-row"><text>{{ c.holderLabel }}</text><text class="strong" data-testid="bank-review-holder">{{ review.holder }}</text></view>
        </view>
        <text class="hint">{{ c.effectiveNote }}</text>
        <view class="sheet-actions">
          <view class="submit ready" role="button" tabindex="0" data-testid="bank-bind-confirm" @click="confirmBinding" @keydown.enter.prevent="confirmBinding" @keydown.space.prevent="confirmBinding"><text>{{ c.confirmSave }}</text></view>
          <view class="glass-action" role="button" tabindex="0" data-testid="bank-bind-edit" @click="cancelReview" @keydown.enter.prevent="cancelReview" @keydown.space.prevent="cancelReview"><LiquidGlass :radius="24" tone="control" /><text>{{ c.editDetails }}</text></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { dateLocale } from "@/i18n/format";
import { computed, ref, watch, nextTick, onBeforeUnmount } from "vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import LiquidGlass from "@/components/liquid-glass.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { apiClient } from "@/api/runtime";
import { createBankWithdrawalApi } from "@/api/bank-withdrawal-api";
import { captureRuntimeRevision, subscribeRuntimeRevision } from "@/api/order-api";
import { formatBankDateTime } from "@/lib/bank-date";
import { createBankBindingForm, directBankBindingAvailable, validBankRecipient } from "@/lib/bank-binding-form";
import { bankAccountNotice } from "@/lib/bank-withdrawal-state";
import { navBack, navReplace, navTo } from "@/lib/route";
import { requireAccountPhone } from "@/lib/require-account-phone";
import { useFinanceReviewCopy } from "@/lib/finance-review-copy";
import { onShow, onHide } from "@dcloudio/uni-app";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { toast } from "@/store/ui";
import { useDialogA11y } from "@/composables/use-dialog-a11y";

const props = defineProps<{ active: boolean; returnTo: string }>();
const t = useT(), c = computed(() => t.value.bankBinding), app = useApp();
const copy = useFinanceReviewCopy();
const identity = () => `${app.accountKey}:${app.accountBindingEpoch}:${captureRuntimeRevision().epoch}`;
const form = createBankBindingForm(createBankWithdrawalApi(apiClient), identity, () => app.accountKey);
const state = form.state, now = ref(Date.now());
const pageVisible = ref(true);
let readGeneration = 0;
onShow(() => { pageVisible.value = true; });
onHide(() => { pageVisible.value = false; readGeneration++; });
useAutoRecovery({
  failed: () => props.active && pageVisible.value && state.phase === "uncertain" && state.hasReceipt && !state.busy && !state.reading,
  retry: () => {
    const generation = readGeneration;
    return form.readOutcome(() => props.active && pageVisible.value && generation === readGeneration);
  }, repeatMs: 15_000,
});
watch(() => state.phase, (phase, previous) => {
  if (props.active && pageVisible.value && phase === "saved" && previous === "uncertain") toast.success(t.value.bankWithdrawal.bound);
});
const review = ref<{ account: string; holder: string; code: string; challengeNo: string; owner: string; config: typeof state.config } | null>(null);
// A bound account opens on its overview; changing it is an explicit two-step flow
// (new account, then review + SMS). First binding needs no SMS.
const changing = ref(false);
const changeStep = ref<1 | 2>(1);
const savedAfterChange = ref(false);
const screen = computed(() => state.phase === "saved" ? "saved"
  // The server has accepted this binding, so an empty form would only invite a second one.
  : state.phase === "uncertain" && state.hasReceipt ? "confirming"
  : !state.config?.beneficiary ? "first"
  : !changing.value ? "overview" : changeStep.value === 1 ? "details" : "verify");
// A pending quote or withdrawal blocks a change; the server rejects one as well.
const changeLocked = computed(() => !!state.config?.unresolvedIntent);
const accountNotice = computed(() => state.config?.beneficiary ? bankAccountNotice(state.config.beneficiary) : "ready");
const accountStatus = computed(() => state.config?.beneficiary ? t.value.bankWithdrawal.accountStatus[accountNotice.value] : "");
const headerTitle = computed(() => screen.value === "details" || screen.value === "verify" || (screen.value === "saved" && savedAfterChange.value)
  ? c.value.changeTitle : screen.value === "overview" ? c.value.overviewTitle : t.value.cards.newTitle);
const rules = computed(() => [c.value.rule1, c.value.rule2, c.value.rule3, c.value.rule4]);
const fieldsDisabled = computed(() => state.busy || state.phase !== "details" || !directBankBindingAvailable(state.config));
const canSubmit = computed(() => { void now.value; return !state.busy && (state.phase === "uncertain" || form.canContinue()); });
const canSendOtp = computed(() => { void now.value; return form.canSendOtp(); });
const canGoNext = computed(() => !fieldsDisabled.value && validBankRecipient(state));
const resendSeconds = computed(() => Math.max(0, Math.ceil((state.resendAt - now.value) / 1000)));
const otpMinutesLeft = computed(() => Math.max(1, Math.ceil((state.otpExpiresAt - now.value) / 60000)));
function sendOtp() { if (canSendOtp.value && requireAccountPhone()) void form.sendOtp(); }
const errorMessage = computed(() => ({ load: c.value.loadError, unsupported: c.value.unsupported, routingUnverified: c.value.routingUnverified, bind: c.value.bindError, unknown: state.hasReceipt ? c.value.confirming : c.value.unknown, otpSend: c.value.otpSendError, otpInvalid: c.value.otpInvalid, otpRateLimited: c.value.otpRateLimited }[state.error] || c.value.bindError));
const displayDate = (value: string) => formatBankDateTime(value, dateLocale());
function focusTestId(id: string) {
  void nextTick(() => { if (typeof document !== "undefined") document.querySelector<HTMLElement>(`[data-testid="${id}"]`)?.focus(); });
}
function startChange() {
  if (changeLocked.value || !directBankBindingAvailable(state.config)) return;
  changing.value = true; changeStep.value = 1;
}
function goVerify() {
  if (!canGoNext.value) return;
  changeStep.value = 2;
  focusTestId("bank-send-otp");
}
// Header back walks the change flow one step at a time; outside it, the page goes back.
const headerBack = computed(() => {
  if (state.phase === "uncertain") return () => navBack("/pages/me/me");
  if (state.phase !== "details" || !changing.value) return undefined;
  return () => { if (changeStep.value === 2) changeStep.value = 1; else changing.value = false; };
});
function submitBinding() {
  if (!canSubmit.value) return;
  if (state.phase === "uncertain") { void form.submit(); return; }
  review.value = { account: state.account.trim(), holder: state.holder.trim(), code: state.code,
    challengeNo: state.challengeNo, owner: identity(), config: state.config };
  focusTestId("bank-bind-confirm");
}
// Step 2 shows the new account next to the SMS code, so submitting it is the routing confirmation.
function submitChange() {
  if (!canSubmit.value) return;
  savedAfterChange.value = true;
  void form.submit(state.phase !== "uncertain");
}
// Grouped preview of the new account number on the change card ("0123 4567 8899").
const groupedAccount = computed(() => state.account.replace(/\s+/g, "").replace(/(.{4})(?=.)/g, "$1 "));
function dots(masked: string): string { return masked.replace(/^[*•]+/, "•••• "); }
// Each screen's main action, rendered by the page in its fixed bottom bar (DS-30); same test ids as before.
type BindingAction = { testid: string; label: string; enabled: boolean; run: () => void };
const primaryAction = computed<BindingAction | null>(() => {
  if (state.phase === "uncertain" && state.hasReceipt) return null;
  const loading = t.value.bankWithdrawal.loading;
  if (screen.value === "overview" && state.config?.beneficiary) {
    if (changeLocked.value) return { testid: "bank-change", label: c.value.locked, enabled: false, run: () => {} };
    return directBankBindingAvailable(state.config) ? { testid: "bank-change", label: c.value.changeAccount, enabled: true, run: startChange } : null;
  }
  if (screen.value === "details") return { testid: "bank-change-next", label: canGoNext.value ? c.value.next : t.value.cards.formSubmitDisabled, enabled: canGoNext.value, run: goVerify };
  if (screen.value === "verify") return { testid: "bank-bind-continue", label: state.busy ? loading : state.phase === "uncertain" ? c.value.retryOriginal : c.value.confirmChange, enabled: canSubmit.value, run: submitChange };
  if (screen.value === "first") return { testid: "bank-bind-continue", label: state.busy ? loading : state.phase === "uncertain" ? c.value.retryOriginal : canSubmit.value ? c.value.continue : t.value.cards.formSubmitDisabled, enabled: canSubmit.value, run: submitBinding };
  return null;
});
defineExpose({ primaryAction });
function cancelReview() { review.value = null; focusTestId("bank-bind-continue"); }
useDialogA11y(computed(() => review.value !== null), ".review-sheet-root", cancelReview);
function confirmBinding() {
  const checked = review.value;
  if (!checked) return;
  review.value = null;
  if (checked.owner !== identity() || checked.config !== state.config || checked.account !== state.account.trim()
    || checked.holder !== state.holder.trim() || checked.code !== state.code || checked.challengeNo !== state.challengeNo
    || !form.canContinue()) return;
  savedAfterChange.value = false;
  void form.submit(true);
}
watch(() => state.phase, phase => {
  if (phase === "saved") focusTestId("bank-bind-done");
});
let timer: ReturnType<typeof setInterval> | undefined;
function reset() {
  review.value = null;
  changing.value = false; changeStep.value = 1; savedAfterChange.value = false;
  form.reset();
  if (timer) clearInterval(timer); timer = undefined;
  if (props.active) { now.value = Date.now(); timer = setInterval(() => { now.value = Date.now(); }, 1000); void form.load(); }
}
watch(() => [props.active, app.accountKey, app.accountBindingEpoch] as const, reset, { immediate: true });
const stopRuntime = subscribeRuntimeRevision(reset);
onBeforeUnmount(() => { stopRuntime(); if (timer) clearInterval(timer); form.reset(); });
function done() { void navReplace(props.returnTo === "/pages/me/wallet-cards" ? "/pages/me/me" : props.returnTo); }
function goWithdraw() { navTo("/pages/me/wallet-withdraw-bank"); }
</script>

<style scoped>
.bank-binding { color: var(--v5-ink); }
.binding-body { display: flex; flex-direction: column; gap: 16px; padding: 0 16px 28px; }
/* Standalone notes share the 4px inset of section titles. */
.binding-body > .hint, .field-block > .hint, .hint-stack { padding: 0 4px; }
.hint-stack { display: flex; flex-direction: column; }
.hint { display: block; color: var(--v5-ink-3); font: 400 var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); overflow-wrap: anywhere; }
.warn-text { color: var(--v5-warning-ink); }
/* Account numbers and codes are read character by character (01 §1.2). */
.mono { font-family: var(--font-jet-mono); font-variant-numeric: tabular-nums; letter-spacing: .03em; }
.error-note { display: block; padding: 12px; background: color-mix(in srgb, var(--v5-danger) 10%, transparent); border-radius: 12px; color: var(--v5-danger); font-size: 12px; line-height: 1.6; }
.text-action { min-height: 44px; display: flex; align-items: center; color: var(--v5-brand); font-size: 13px; }
/* Current account */
.account-card { display: flex; flex-direction: column; gap: 12px; padding: var(--ui-space-inset-hero); border: 1px solid var(--v5-border); border-radius: var(--ui-radius-surface); background: var(--v5-surface); }
.account-head { display: flex; align-items: center; gap: 12px; }
.account-icon, .first-icon { display: grid; place-items: center; flex: none; color: var(--v5-brand); background: color-mix(in srgb, var(--v5-brand) 16%, transparent); }
.account-icon { width: 36px; height: 36px; border-radius: 12px; }
.account-title { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.row-title { font: var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); }
.account-number { display: flex; flex-direction: column; gap: 4px; padding-top: 12px; border-top: 1px solid var(--v5-border); }
.account-masked { font-size: 20px; line-height: 28px; font-weight: 500; letter-spacing: .06em; }
.rules { display: flex; flex-direction: column; gap: 4px; margin-top: 16px; padding: 0 4px; }
.rules-title { font: 500 13px/18px var(--font-v5); color: var(--v5-ink); margin-bottom: 4px; }
.rule { padding-left: 14px; position: relative; }
.rule::before { content: "•"; position: absolute; left: 2px; }
.link-row { display: flex; align-items: center; justify-content: space-between; min-height: 44px; padding: 0 4px; color: var(--v5-ink-3); font: 500 13px/18px var(--font-v5); }
/* Steps and sections */
.steps { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.step { padding-top: 9px; border-top: 3px solid var(--v5-surface-3); color: var(--v5-ink-3); font: 500 12px/16px var(--font-v5); }
.step--on { border-top-color: var(--v5-brand); color: var(--v5-brand); }
.section-head { display: flex; flex-direction: column; gap: 4px; padding: 4px 4px 0; }
.section-head .hint, .first-head .hint, .sheet-head .hint { font: 400 var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.section-title { font: var(--ui-type-section-weight) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); }
.first-head { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 16px 8px; text-align: center; }
.first-icon { width: 56px; height: 56px; border-radius: 18px; }
.first-title { font: var(--ui-type-hero-title-weight, 600) var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5); }
/* Grouped fields and review rows */
.field-block { display: flex; flex-direction: column; gap: 8px; }
.group { border-radius: var(--ui-radius-surface); border: 1px solid var(--v5-border); background: var(--v5-surface); overflow: hidden; }
.group--inset { border: 0; background: var(--v5-surface-2); }
.field-row { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 16px; border-bottom: 1px solid var(--v5-border); }
.field-row:last-child { border-bottom: 0; }
/* At least 72px so zh labels align; longer en/vi labels keep one line. */
.field-label { flex: none; min-width: 72px; max-width: 45%; color: var(--v5-ink-3); font: 400 14px/20px var(--font-v5); }
.field { flex: 1; min-width: 0; box-sizing: border-box; height: 44px; min-height: 44px; padding: 0; background: transparent; border: 0; font-size: var(--ui-type-input); line-height: var(--ui-type-input-lh); color: var(--v5-ink); }
/* Brand glass S (03 §3.1): frosted material with a 14% brand fill. */
.otp-send { --ui-button-fill: color-mix(in srgb, var(--v5-brand) 14%, transparent); --ui-button-ink: var(--v5-brand); flex: none; display: inline-flex; align-items: center; min-height: 32px; padding: 0 12px; border-radius: 999px; font: var(--ui-type-compact-button-weight) var(--ui-type-compact-button)/var(--ui-type-compact-button-lh) var(--font-v5); white-space: nowrap; }
.otp-send[aria-disabled="true"] { opacity: .5; }
.review-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; padding: 0 16px; border-bottom: 1px solid var(--v5-border); color: var(--v5-ink-3); font: 400 14px/20px var(--font-v5); overflow-wrap: anywhere; }
.review-row:last-child { border-bottom: 0; }
.strong { color: var(--v5-ink); font-size: 15px; font-weight: 500; text-align: right; }
.muted { color: var(--v5-ink-3); }
.group-link { display: flex; align-items: center; justify-content: center; min-height: 44px; color: var(--v5-brand); font: var(--ui-type-compact-button-weight) var(--ui-type-compact-button)/var(--ui-type-compact-button-lh) var(--font-v5); }
/* Actions */
/* Primary L (03 §3.1); disabled is the same button at 50%. */
.submit { display: flex; align-items: center; justify-content: center; box-sizing: border-box; min-height: 48px; padding: 8px 20px; border-radius: 999px; background: var(--v5-brand); color: var(--v5-on-brand); font: var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5); text-align: center; opacity: .5; }
.submit.ready { opacity: 1; cursor: pointer; }
.submit.ready:active { transform: scale(.98); }
/* Neutral glass L (03 §3.1). */
.glass-action { position: relative; isolation: isolate; display: grid; place-items: center; min-height: 48px; border-radius: 24px; color: var(--v5-ink); font: var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5); cursor: pointer; }
.glass-action[aria-disabled="true"], .glass-action.is-locked { opacity: .5; cursor: default; }
.glass-action > text { position: relative; z-index: 1; }
.footnote { padding: 0 4px; }
.footnote-row { display: flex; gap: 8px; padding: 0 4px; color: var(--v5-ink-3); font: 400 var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); }
.footnote-row svg { flex: none; margin-top: 2px; }
.field-hint { margin-top: -2px; padding: 0 4px; }
.field-block + .footnote-row { margin-top: -8px; }
/* Saved */
.binding-done { display: flex; flex-direction: column; align-items: center; gap: 12px; padding-top: 48px; text-align: center; }
.done-notes { display: flex; flex-direction: column; padding: 0 16px; }
.done-icon { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 999px; background: color-mix(in srgb, var(--v5-brand) 16%, transparent); color: var(--v5-brand); }
.done-title { font: 600 var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5); }
.done-account { font-size: 17px; line-height: 24px; font-weight: 500; letter-spacing: .06em; }
.done-actions { align-self: stretch; display: flex; flex-direction: column; gap: 8px; margin-top: 24px; }
/* First-binding review sheet */
.review-sheet-root { position: fixed; inset: 0; z-index: 790; display: flex; align-items: flex-end; }
.review-scrim { position: absolute; inset: 0; background: var(--v5-bg-color-mask); }
.review-sheet { position: relative; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px; padding: 8px 16px calc(16px + var(--nx-overlay-safe-bottom, 0px)); border-radius: 28px 28px 0 0; }
.sheet-handle { width: 36px; height: 4px; border-radius: 999px; background: color-mix(in srgb, var(--v5-ink) 18%, transparent); align-self: center; }
.sheet-head { display: flex; flex-direction: column; gap: 4px; padding: 4px 4px 0; }
.sheet-actions { display: flex; flex-direction: column; gap: 8px; }
[aria-disabled="true"] { cursor: default; }
/* P-52 bank account: physical bank card, numbered rules, change step track + live preview, fields as wells. */
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.binding-body { padding-top: 3px; }
.bcard { position: relative; display: flex; flex-direction: column; height: 208px; padding: 20px; box-sizing: border-box; overflow: hidden; border-radius: var(--ui-radius-surface); color: color-mix(in srgb, white 96%, transparent);
  background: linear-gradient(150deg, #2B2E35, #17191D 55%, #0F1013); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), inset 0 8px 12px -10px rgba(255,255,255,.35), 0 16px 36px rgba(0,0,0,.40); }
.bcard::before { content: ""; position: absolute; right: -70px; top: -90px; width: 300px; height: 300px; border-radius: 50%; background: repeating-radial-gradient(circle, rgba(255,255,255,.055) 0 1px, transparent 1px 9px); pointer-events: none; }
.bcard::after { content: ""; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.16) 50%, transparent 65%); transform: translateX(-110%); animation: bcard-sweep 1200ms 480ms cubic-bezier(.4,0,.2,1) both; pointer-events: none; }
@keyframes bcard-sweep { to { transform: translateX(110%); } }
.bcard--preview { height: 160px; padding: 18px 20px; justify-content: flex-start; }
.bcard--preview .bcard__no { margin-top: auto; font-size: 24px; line-height: 30px; }
.bcard--preview .bcard__ho { font-family: var(--font-metric); }
.bcard--preview::before { right: -70px; top: -90px; width: 280px; height: 280px; }
.bcard--preview::after { inset: 0; transform: none; animation: none; border-radius: inherit; padding: 1.5px; background: conic-gradient(from 120deg, transparent 0 50%, color-mix(in srgb, var(--v5-brand) 80%, transparent) 72%, transparent 94%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
.bcard__top { position: relative; display: flex; align-items: center; gap: 10px; }
.bcard__bk { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,.10); }
.bcard__nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: color-mix(in srgb, white 72%, transparent); font: 400 13px/18px var(--font-v5); }
.bcard__tag { flex: none; display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: var(--v5-radius-full); background: color-mix(in srgb, var(--v5-success) 18%, transparent); color: var(--v5-success); font: 500 12px/16px var(--font-v5); }
.bcard__tag.warn { background: color-mix(in srgb, var(--v5-warning) 18%, transparent); color: var(--v5-warning); }
.bcard__bot { position: relative; display: flex; flex-direction: column; margin-top: auto; }
.bcard__lb { position: relative; display: block; padding-top: 2px; color: color-mix(in srgb, white 55%, transparent); font: 400 12px/16px var(--font-v5); }
.bcard__no { position: relative; display: block; margin-top: 4px; font: 500 26px/32px var(--font-metric); letter-spacing: .08em; }
.bcard__eff { display: block; margin-top: 6px; color: color-mix(in srgb, white 55%, transparent); font: 400 12px/16px var(--font-metric); }
.bcard__ho { position: relative; display: block; margin-top: 6px; color: color-mix(in srgb, white 72%, transparent); font: 500 13px/18px var(--font-v5); letter-spacing: .06em; }
.sec-title { display: block; margin: 16px 4px -4px; color: var(--v5-ink); font: 600 17px/24px var(--font-v5); }
.rules-card { padding: 4px 16px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.rule-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; }
.rule-item + .rule-item { border-top: 1px solid var(--v5-border); }
.rule-num { flex: none; display: grid; place-items: center; width: 24px; height: 24px; margin-top: -1px; border-radius: 50%; background: var(--v5-brand-soft); color: var(--v5-brand); font: 500 12px/1 var(--font-metric); }
.rule-text { color: var(--v5-ink-2); font: 400 13px/20px var(--font-v5); }
.steps2 { display: flex; align-items: center; gap: 10px; margin: -4px 4px 0; }
.steps2__on { display: inline-flex; align-items: center; gap: 8px; color: var(--v5-brand); font: 500 13px/18px var(--font-v5); }
.steps2__i { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--v5-brand); color: var(--v5-on-brand); font: 600 11px/1 var(--font-metric); }
.steps2__ln { flex: 1; height: 2px; border-radius: 2px; background: var(--v5-surface-3); }
.steps2__off { width: 10px; height: 10px; border-radius: 50%; background: var(--v5-ink-4); }
/* Change/first form: label above, input in a recessed well (the .field height contract stays 44px inside). */
.field-block .group { border: 0; background: transparent; overflow: visible; }
.field-block .field-row { flex-direction: column; align-items: stretch; gap: 8px; min-height: 0; padding: 0; margin-top: 16px; border-bottom: 0; }
.field-block .field-row:first-child { margin-top: 0; }
.field-block .field-label { min-width: 0; max-width: none; padding: 3px 4px 0; font: 400 12px/16px var(--font-v5); }
.field-block .field-row > .field { display: flex; align-items: center; min-height: 52px; height: 52px; padding: 0 14px; border-radius: 14px; background: color-mix(in srgb, var(--v5-ink) 4%, transparent); box-shadow: inset 0 2px 8px rgba(0,0,0,.45), inset 0 0 0 1px var(--v5-border); font: 500 16px/24px var(--font-v5); }
[data-theme="light"] .field-block .field-row > .field { box-shadow: inset 0 1px 4px rgba(20,16,8,.10), inset 0 0 0 1px var(--v5-border); }
.field-block .field-row > .field.mono { font-family: var(--font-metric); letter-spacing: .04em; }
@media (prefers-reduced-motion: reduce) { .bcard::after { animation: none; opacity: 0; } }
</style>
