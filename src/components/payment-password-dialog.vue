<template>
  <view v-if="ui.visible && active" class="payment-pin-mask" :class="{ 'payment-pin-mask--standalone': standalone }" :style="{ ...viewportStyle, '--pin-status-height': statusHeight + 'px' }" role="dialog" aria-modal="true" :aria-label="title">
    <view class="payment-pin-sheet" @click.stop>
      <view class="payment-pin-header">
        <text class="payment-pin-title" role="heading" aria-level="2" aria-live="polite">{{ title }}</text>
        <view class="payment-pin-close" :class="{ 'nx-frosted-button': standalone }" role="button" tabindex="0" :aria-label="t.paymentPin.close" @click="pin.cancel">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path :d="standalone ? 'm15 18-6-6 6-6' : 'm6 6 12 12M18 6 6 18'" /></svg>
        </view>
      </view>
      <view class="payment-pin-body" @touchmove.stop>
        <template v-if="ui.stage === 'setup' && !standalone">
          <text class="payment-pin-note payment-pin-note--important">{{ t.paymentPin.firstNotice }}</text>
          <text v-if="ui.context" class="payment-pin-note">{{ t.paymentPin.continueNotice }}</text>
        </template>
        <text v-if="ui.notice" class="payment-pin-note" role="status">{{ t.paymentPin[ui.notice] }}</text>
        <view v-if="ui.context" class="payment-pin-summary">
          <text class="payment-pin-summary__name">{{ ui.context.summary }}</text>
          <view class="payment-pin-summary__amount"><text>{{ t.paymentPin.due }}</text><CheckoutAmount v-if="ui.context.currency === 'USD' || ui.context.currency === 'USDT'" :value="ui.context.amount" :currency="ui.context.currency" /><text v-else>{{ formatGroupedAmount(ui.context.amount) }} <text class="payment-pin-note">{{ ui.context.currency }}</text></text></view>
          <view v-if="ui.context.details?.length" class="payment-pin-link" role="button" tabindex="0" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? t.paymentPin.hideDetails : t.paymentPin.details }}</view>
          <view v-if="expanded" class="payment-pin-details"><view v-for="(item, index) in ui.context.details" :key="index"><text>{{ item.name }}<template v-if="item.quantity"> × {{ item.quantity }}</template><template v-if="item.amount !== undefined"> · {{ formatGroupedAmount(item.amount) }}</template></text></view></view>
        </view>
        <text v-if="ui.stage === 'loading'" class="payment-pin-note" role="status">{{ t.paymentPin.loading }}</text>
        <template v-else-if="ui.stage === 'pending'">
          <text class="payment-pin-note" role="status">{{ t.paymentPin.pending }}</text>
          <view class="payment-pin-link" role="button" tabindex="0" @click="support">{{ t.paymentPin.support }}</view>
        </template>
        <view v-else-if="ui.stage === 'read-error'" class="payment-pin-primary" role="button" tabindex="0" :aria-disabled="ui.busy" @click="pin.load">{{ t.paymentPin.retry }}</view>
        <template v-else-if="ui.stage === 'recovery'">
          <text class="payment-pin-note">{{ t.paymentPin.recoveryIntro }}</text>
          <template v-if="ui.challenge">
            <text class="payment-pin-phone">{{ ui.challenge.phoneMasked }}</text>
            <input v-model="code" class="payment-pin-code" type="text" inputmode="numeric" maxlength="6" :adjust-position="false" :disabled="ui.busy" :placeholder="t.paymentPin.code" :aria-label="t.paymentPin.code" autocomplete="one-time-code" />
            <view class="payment-pin-link" role="button" :tabindex="ui.busy || resendLeft ? -1 : 0" :aria-disabled="ui.busy || resendLeft > 0" @click="pin.sendChallenge">{{ t.paymentPin.resend }}<template v-if="resendLeft"> ({{ resendLeft }})</template></view>
            <view class="payment-pin-primary" role="button" :tabindex="ui.busy || !validCode ? -1 : 0" :aria-disabled="ui.busy || !validCode" @click="pin.verify(code)">{{ t.paymentPin.verify }}</view>
          </template>
          <view v-else-if="ui.error !== 'recoveryUnavailable'" class="payment-pin-primary" role="button" tabindex="0" :aria-disabled="ui.busy" @click="pin.sendChallenge">{{ t.paymentPin.sendCode }}</view>
          <view class="payment-pin-link" role="button" tabindex="0" @click="ui.error === 'recoveryUnavailable' ? support() : pin.unavailableRecovery()">{{ ui.error === 'recoveryUnavailable' ? t.paymentPin.support : t.paymentPin.phoneUnavailable }}</view>
        </template>
        <template v-else>
          <view v-if="ui.stage !== 'pay'" class="payment-pin-step"><view v-if="standalone" class="payment-pin-step-bars" aria-hidden="true"><view class="on"/><view :class="{ on: confirming }"/></view><text>{{ confirming ? t.paymentPin.stepTwo : t.paymentPin.stepOne }}</text></view>
          <text class="payment-pin-note payment-pin-instruction">{{ confirming ? t.paymentPin.repeatDigits : t.paymentPin.sixDigits }}</text>
          <PaymentPasswordInput :key="`${ui.stage}:${ui.revision}`" v-model="password" :label="title" :adjust-position="false" :auto-focus="!ui.busy && !(ui.stage === 'pay' && !!ui.state?.lockedUntil)" :disabled="ui.busy || (ui.stage === 'pay' && !!ui.state?.lockedUntil)" @complete="complete" />
          <template v-if="ui.stage === 'pay'">
            <text class="payment-pin-note">{{ Number(ui.context?.amount) === 0 ? t.paymentPin.autoConfirm : t.paymentPin.autoSubmit }}</text>
            <text v-if="pin.locked()" class="payment-pin-error" role="alert">{{ lockMessage }}</text>
            <view v-if="unlockReady" class="payment-pin-link" role="button" tabindex="0" @click="pin.load">{{ t.paymentPin.retry }}</view>
            <view class="payment-pin-link" role="button" tabindex="0" @click="pin.startRecovery">{{ t.paymentPin.forgot }}</view>
          </template>
          <template v-else>
            <view class="payment-pin-notes"><view v-if="standalone && !confirming" class="payment-pin-note payment-pin-note--info"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9h.01"/></svg><text>{{ t.paymentPin.firstNotice }}</text></view><view v-if="!confirming" class="payment-pin-note payment-pin-note--info"><svg v-if="standalone" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9h.01"/></svg><text>{{ t.paymentPin.rule }}</text></view></view>
            <text v-if="!completePin" class="payment-pin-note payment-pin-incomplete">{{ t.paymentPin.incomplete }}</text>
            <NxButton variant="primary" class="payment-pin-primary payment-pin-next" :disabled="!canContinue" @click="submit">{{ ui.busy ? (ui.stage.startsWith('reset') ? t.paymentPin.resetting : t.paymentPin.setting) : confirming ? (ui.stage === 'reset-confirm' ? t.paymentPin.confirmReset : t.paymentPin.confirmSetup) : t.paymentPin.next }}</NxButton>
            <view v-if="confirming" class="payment-pin-link" role="button" tabindex="0" :aria-disabled="ui.busy" @click="!ui.busy && pin.restart()">{{ t.paymentPin.startAgain }}</view>
          </template>
        </template>
        <text v-if="errorMessage" class="payment-pin-error" role="alert">{{ errorMessage }}</text>
        <view v-if="!standalone" class="payment-pin-link payment-pin-link--muted" role="button" tabindex="0" @click="pin.cancel">{{ ui.context ? t.paymentPin.cancel : t.paymentPin.back }}</view>
      </view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { onHide, onShow } from "@dcloudio/uni-app";
import NxButton from "@/components/ui/nx-button.vue";
import { h5DevicePreviewStatusBarHeight } from "@/lib/device-preview";
import PaymentPasswordInput from "@/components/payment-password-input.vue";
import CheckoutAmount from '@/components/checkout/CheckoutAmount.vue';
import { formatGroupedAmount } from '@/lib/amount-display';
import { usePaymentPassword, simplePaymentPassword, validPaymentPassword } from "@/store/payment-password";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { useDialogA11y } from "@/composables/use-dialog-a11y";
import { usePaymentPinViewport } from '@/composables/use-payment-pin-viewport';
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { navTo } from "@/lib/route";
const pin = usePaymentPassword(); const ui = pin.ui; const t = useT();
const active = ref(true); const password = ref(""); const code = ref(""); const expanded = ref(false);
const standalone = computed(() => !ui.context && (ui.stage === "setup" || ui.stage === "confirm"));
const statusHeight = (() => { try { return uni.getSystemInfoSync().statusBarHeight || h5DevicePreviewStatusBarHeight(); } catch { return h5DevicePreviewStatusBarHeight(); } })();
const open = computed(() => ui.visible && active.value);
useAutoRecovery({
  failed: () => open.value && ui.stage === "pending" && !!ui.pendingOperation && !ui.busy && !ui.reading,
  retry: () => pin.query(() => active.value), repeatMs: 15_000,
});
const viewportStyle = usePaymentPinViewport(open);
const confirming = computed(() => ui.stage === "confirm" || ui.stage === "reset-confirm");
const completePin = computed(() => validPaymentPassword(password.value));
const canContinue = computed(() => !ui.busy && completePin.value && (confirming.value || !simplePaymentPassword(password.value)));
const validCode = computed(() => /^[0-9]{6}$/.test(code.value));
const title = computed(() => {
  if (ui.stage === "setup") return t.value.paymentPin.setup;
  if (ui.stage === "confirm") return t.value.paymentPin.confirm;
  if (ui.stage === "pay") return t.value.paymentPin.enter;
  if (ui.stage === "recovery") return t.value.paymentPin.reset;
  if (ui.stage === "reset") return t.value.paymentPin.newTitle;
  if (ui.stage === "reset-confirm") return t.value.paymentPin.confirmNewTitle;
  return t.value.paymentPin.verification;
});
const resendLeft = computed(() => Math.max(0, Math.ceil((ui.resendAt - ui.now) / 1000)));
const unlockReady = computed(() => !!ui.state?.lockedUntil && !pin.locked());
const lockMessage = computed(() => {
  const seconds = Math.max(0, Math.ceil((Date.parse(ui.state?.lockedUntil ?? "") - ui.now) / 1000));
  return fmt(t.value.paymentPin.locked, { time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` });
});
const errorMessage = computed(() => {
  if (!ui.error || (ui.error === "locked" && pin.locked())) return "";
  return ui.error === "incorrect" ? fmt(t.value.paymentPin.incorrect, { n: ui.state?.remainingAttempts ?? 0 }) : t.value.paymentPin[ui.error];
});
watch(() => [ui.stage, ui.revision, ui.visible], () => { password.value = ""; code.value = ""; }, { flush: "sync" });
watch(() => ui.visible, () => { expanded.value = false; });
function complete(value: string) { if (ui.stage === "pay") { password.value = ""; uni.hideKeyboard(); pin.authorize(value); } }
function submit() { if (!canContinue.value) return; if (confirming.value) void pin.confirm(password.value); else pin.next(password.value); }
function support() { pin.cancel(); navTo("/me/support"); }
function hide() { if (active.value && ui.visible) pin.cancel(); active.value = false; password.value = ""; code.value = ""; }
function visibility() { if (typeof document !== "undefined" && document.hidden) { if (active.value && ui.visible) pin.cancel(); password.value = ""; code.value = ""; } }
onShow(() => { active.value = true; }); onHide(hide);
let timer: ReturnType<typeof setInterval>;
onMounted(() => { timer = setInterval(pin.tick, 1000); if (typeof document !== "undefined") document.addEventListener("visibilitychange", visibility); });
onUnmounted(() => { clearInterval(timer); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", visibility); });
useDialogA11y(open, ".payment-pin-mask", pin.cancel, true, 5);
</script>
<style scoped>
.payment-pin-mask { position: fixed; z-index: 1700; inset: 0; display: flex; align-items: flex-end; justify-content: center; box-sizing: border-box; overflow: hidden; padding: var(--nx-overlay-top) var(--v5-space-3) var(--nx-overlay-bottom); background: var(--v5-bg-color-mask); }
.payment-pin-sheet { display: flex; flex-direction: column; width: 100%; max-width: 440px; max-height: 100%; min-height: 0; overflow: hidden; padding: var(--v5-space-5); background: var(--v5-surface); color: var(--v5-ink); border-radius: var(--v5-radius-m); box-shadow: 0 16px 48px var(--v5-bg-color-mask); }
.payment-pin-header { flex: none; display: flex; align-items: flex-start; gap: var(--v5-space-3); margin-bottom: var(--v5-space-4); }
.payment-pin-title { flex: 1; font-size: var(--ui-type-section); font-weight: 650; line-height: 1.4; overflow-wrap: anywhere; }
.payment-pin-close { width: 44px; min-height: 44px; flex: 0 0 44px; margin-top: -10px; margin-right: -10px; display: flex; align-items: center; justify-content: center; color: var(--v5-ink-2); }
.payment-pin-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; margin-inline: calc(-1 * var(--v5-space-2)); padding-inline: var(--v5-space-2); display: flex; flex-direction: column; gap: var(--v5-space-2); }
.payment-pin-body > * { flex-shrink: 0; }
.payment-pin-note { display: block; color: var(--v5-ink-2); font-size: var(--ui-type-list-subtitle); line-height: 1.65; }
.payment-pin-note--important { color: var(--v5-ink); }
.payment-pin-step { color: var(--v5-ink-3); font-size: var(--ui-type-meta); margin-top: var(--v5-space-2); }
.payment-pin-summary { padding: var(--v5-space-3) 0; margin-bottom: var(--v5-space-1); border-top: 1px solid var(--v5-border); border-bottom: 1px solid var(--v5-border); }
.payment-pin-summary__name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--ui-type-list-subtitle); }
.payment-pin-summary__amount { display:flex; flex-wrap:wrap; align-items:baseline; gap:var(--v5-space-2); margin-top:var(--v5-space-2); font-weight:650; font-size:var(--ui-type-card-title); }
.payment-pin-details { font-size: var(--ui-type-list-subtitle); line-height: 1.6; overflow-wrap: anywhere; }
.payment-pin-primary { display: flex; align-items: center; justify-content: center; min-height: 48px; margin-top: var(--ui-space-row-y); padding: var(--v5-space-3) var(--v5-space-4); border-radius: var(--v5-radius-full); background: var(--v5-brand); color: var(--v5-on-brand); text-align: center; font-size: var(--ui-type-button); font-weight: 600; }
.payment-pin-primary.nx-button { padding:0; background:none; }
.payment-pin-primary:not(.nx-button)[aria-disabled="true"] { opacity: .45; }
.payment-pin-link { display: flex; align-items: center; justify-content: center; min-height: 44px; color: var(--v5-brand); font-size: var(--ui-type-list-subtitle); text-align: center; }
.payment-pin-link--muted { color: var(--v5-ink-2); }
.payment-pin-link[aria-disabled="true"] { opacity: .45; }
.payment-pin-phone { display: block; font-weight: 600; margin-top: var(--v5-space-2); }
.payment-pin-code { width: 100%; min-height: 48px; padding: var(--v5-space-3); border-radius: var(--v5-radius-s); color: var(--v5-ink); background: var(--v5-surface-2); border: 1px solid var(--v5-border); }
.payment-pin-error { display: block; color: var(--v5-danger); font-size: var(--ui-type-list-subtitle); line-height: 1.5; }
@media (min-width: 500px) { .payment-pin-mask { align-items: center; } }
</style>

<style scoped>
.payment-pin-mask--standalone { padding:var(--pin-status-height) 0 0; background:var(--v5-bg); align-items:stretch; }
.payment-pin-mask--standalone .payment-pin-sheet { max-width:none; padding:0; border-radius:0; background:var(--v5-bg); box-shadow:none; }
.payment-pin-mask--standalone .payment-pin-header { position:relative; height:63px; align-items:center; justify-content:center; margin:0; padding:0 64px; }
.payment-pin-mask--standalone .payment-pin-title { margin-top:-7px; flex:initial; font-size:15px; line-height:20px; text-align:center; }
.payment-pin-mask--standalone .payment-pin-close { position:absolute; left:12px; top:6px; margin:0; border-radius:50%; background:color-mix(in srgb,var(--v5-ink) 6%,transparent); box-shadow:var(--ui-glass-edge-shadow); }
.payment-pin-mask--standalone .payment-pin-body { margin:0; padding:0 0 110px; gap:0; }
.payment-pin-mask--standalone .payment-pin-step { display:flex; align-items:center; gap:10px; margin:var(--v5-space-1) 20px 0; font-size:12px; line-height:16px; }
.payment-pin-step-bars { display:flex; width:64px; gap:var(--v5-space-1); }
.payment-pin-step-bars > view { flex:1; height:4px; border-radius:2px; background:var(--v5-surface-3); }
.payment-pin-step-bars > .on { background:var(--v5-brand); }
.payment-pin-mask--standalone .payment-pin-instruction { margin:var(--v5-space-5) 20px 0; color:var(--v5-ink); font-size:20px; line-height:28px; font-weight:600; }
.payment-pin-mask--standalone :deep(.payment-pin-input) { width:auto; margin:var(--v5-space-6) 16px 0; }
.payment-pin-mask--standalone .payment-pin-notes { margin:var(--v5-space-5) 20px 0; display:flex; flex-direction:column; gap:6px; }
.payment-pin-mask--standalone .payment-pin-note--info { display:flex; gap:var(--v5-space-2); font-size:12px; line-height:18px; color:var(--v5-ink-3); }
.payment-pin-mask--standalone .payment-pin-note--info > svg { flex:none; margin-top:2px; }
.payment-pin-mask--standalone .payment-pin-incomplete { position:absolute; width:1px; height:1px; clip-path:inset(50%); overflow:hidden; }
.payment-pin-mask--standalone .payment-pin-next { position:absolute; left:16px; right:16px; bottom:calc(30px + env(safe-area-inset-bottom)); margin:0; padding:0; background:none; }
.payment-pin-mask--standalone .payment-pin-error { margin:var(--v5-space-4) 20px; }
</style>

<style scoped>
.payment-pin-mask--standalone .payment-pin-body::after { content:""; position:absolute; left:0; right:0; bottom:0; height:91px; box-sizing:border-box; background:linear-gradient(180deg,color-mix(in srgb,var(--v5-surface) 70%,transparent),color-mix(in srgb,var(--v5-surface) 94%,transparent)); border-top:1px solid color-mix(in srgb,var(--v5-ink) 5%,transparent); z-index:0; pointer-events:none; }
.payment-pin-mask--standalone .payment-pin-next { z-index:1; }
.payment-pin-mask--standalone .payment-pin-close { box-shadow:var(--ui-glass-edge-shadow); }
</style>
