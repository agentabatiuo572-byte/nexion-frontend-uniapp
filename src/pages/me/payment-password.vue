<template>
  <AppChassis active="me">
    <SubPageHeader back="/pages/me/me" :title="state?.configured ? t.paymentPin.change : t.paymentPin.title" />
    <view class="payment-pin-page">
      <text v-if="!state || state.configured" class="payment-pin-page__note">{{ t.paymentPin.purpose }}</text>
      <view v-if="loading" role="status"><text class="payment-pin-page__note">{{ t.paymentPin.loading }}</text></view>
      <template v-else-if="ui.pendingOperation">
        <text class="payment-pin-page__note" role="status">{{ t.paymentPin.pending }}</text>
        <NxButton variant="primary" class="payment-pin-page__primary" @click="pin.resumePending">{{ t.paymentPin.query }}</NxButton>
      </template>
      <template v-else-if="!state">
        <text class="payment-pin-page__error" role="alert">{{ t.paymentPin.readFailed }}</text>
        <NxButton variant="primary" class="payment-pin-page__primary" @click="load">{{ t.paymentPin.retry }}</NxButton>
      </template>
      <template v-else-if="!state.configured">
        <view class="payment-vault-stage"><view class="payment-vault-aura payment-vault-aura--outer" aria-hidden="true" /><view class="payment-vault-glow" aria-hidden="true"><view class="payment-vault-aura" /></view><view class="payment-vault nx-frosted-button">
          <view class="payment-vault-lock" aria-hidden="true"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14.5v2.5"/></svg></view>
          <view class="payment-vault-dots" aria-hidden="true"><view v-for="n in 6" :key="n" :style="{ animationDelay: `${n * 80}ms` }" /></view>
          <text class="payment-vault-title">{{ t.paymentPin.title }}</text><text class="payment-vault-status">{{ t.paymentPin.notConfigured }}</text><text class="payment-vault-purpose">{{ t.paymentPin.purpose }}</text>
        </view></view>
      </template>
      <template v-else>
        <view v-for="field in fields" :key="field.key" class="payment-pin-page__field">
          <text class="payment-pin-page__label">{{ field.label }}</text>
          <PaymentPasswordInput v-model="passwords[field.key]" :label="field.label" :disabled="ui.busy || !!state.lockedUntil" />
        </view>
        <text class="payment-pin-page__note">{{ t.paymentPin.rule }}</text>
        <text v-if="validation" class="payment-pin-page__error" role="alert">{{ validation }}</text>
        <text v-else-if="error" class="payment-pin-page__error" role="alert">{{ error }}</text>
        <text v-if="pin.locked()" class="payment-pin-page__error" role="alert">{{ lockMessage }}</text>
        <text v-else-if="!complete" class="payment-pin-page__note">{{ t.paymentPin.incomplete }}</text>
        <NxButton variant="primary" class="payment-pin-page__primary" :disabled="!canSave" @click="save">{{ ui.busy ? t.paymentPin.changing : t.paymentPin.save }}</NxButton>
        <view v-if="state.lockedUntil && !pin.locked()" class="payment-pin-page__link" role="button" tabindex="0" @click="load">{{ t.paymentPin.retry }}</view>
        <view class="payment-pin-page__link" role="button" tabindex="0" :aria-disabled="ui.busy" @click="recover">{{ t.paymentPin.forgot }}</view>
      </template>
    </view>
    <template #pageFixed><view v-if="!loading && state && !state.configured && !ui.pendingOperation" class="payment-pin-page__dock"><NxButton variant="primary" @click="setup">{{ t.paymentPin.setup }}</NxButton></view></template>
  </AppChassis>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { onHide, onShow, onUnload } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import NxButton from "@/components/ui/nx-button.vue";
import PaymentPasswordInput from "@/components/payment-password-input.vue";
import { usePaymentPassword, simplePaymentPassword, validPaymentPassword } from "@/store/payment-password";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { navTo } from "@/lib/route";
import { toast } from "@/store/ui";
import { sessionVault } from "@/api/runtime";
const pin = usePaymentPassword(); const ui = pin.ui; const state = computed(() => ui.state); const t = useT();
const passwords = reactive({ current: "", new: "", confirm: "" }); const loading = ref(true);
let active = true; let submitted = false;
const fields = computed(() => ([{ key: "current" as const, label: t.value.paymentPin.current }, { key: "new" as const, label: t.value.paymentPin.new }, { key: "confirm" as const, label: t.value.paymentPin.confirmNew }]));
const complete = computed(() => Object.values(passwords).every(validPaymentPassword));
const validation = computed(() => {
  if (validPaymentPassword(passwords.new) && simplePaymentPassword(passwords.new)) return t.value.paymentPin.simple;
  if (passwords.current && passwords.new === passwords.current) return t.value.paymentPin.samePassword;
  if (validPaymentPassword(passwords.confirm) && passwords.confirm !== passwords.new) return t.value.paymentPin.mismatch;
  return "";
});
const error = computed(() => !ui.changeError || ui.changeError === "locked" ? "" : ui.changeError === "incorrect" ? fmt(t.value.paymentPin.incorrect, { n: state.value?.remainingAttempts ?? 0 }) : t.value.paymentPin[ui.changeError]);
const lockMessage = computed(() => {
  const seconds = Math.max(0, Math.ceil((Date.parse(state.value?.lockedUntil ?? "") - ui.now) / 1000));
  return fmt(t.value.paymentPin.locked, { time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` });
});
const canSave = computed(() => complete.value && !validation.value && !ui.busy && !state.value?.lockedUntil && !ui.pendingOperation);
function clear() { passwords.current = ""; passwords.new = ""; passwords.confirm = ""; }
async function load() { loading.value = true; ui.changeError = ""; if (!sessionVault.read()) return; await pin.refreshStatus(); if (active) { loading.value = false; await pin.resumePending(); } }
async function setup() { if (await pin.setup()) { toast.success(t.value.paymentPin.setupSuccess); navTo("/me"); } else await load(); }
async function recover() { if (ui.busy) return; clear(); if (await pin.recover()) { toast.success(t.value.paymentPin.resetSuccess); navTo("/me"); } else await load(); }
async function save() {
  if (!canSave.value || !state.value) return;
  submitted = true;
  const result = pin.change(passwords.current, passwords.new, passwords.confirm);
  passwords.current = "";
  const success = await result;
  if (!success && !ui.visible) submitted = false;
  if (pin.locked() || ui.visible) clear();
}
watch(() => ui.completedRevision, () => {
  if (submitted && ui.completedOperation === "change") {
    submitted = false; clear(); toast.success(t.value.paymentPin.changeSuccess); navTo("/me");
  }
});
// After an H5 reload the session is restored after the page shows: load() waits for it and reads here.
const unsubscribe = sessionVault.subscribe?.((_previous, next, continuation) => { if (!continuation) { clear(); submitted = false; if (next && active) void load(); } });
function hide() { active = false; clear(); }
function visibility() { if (typeof document !== "undefined" && document.hidden) hide(); }
onShow(() => { active = true; void load(); }); onHide(hide); onUnload(hide);
let timer: ReturnType<typeof setInterval>;
onMounted(() => { timer = setInterval(pin.tick, 1000); if (typeof document !== "undefined") document.addEventListener("visibilitychange", visibility); });
onUnmounted(() => { clear(); clearInterval(timer); unsubscribe?.(); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", visibility); });
</script>
<style scoped>
.payment-pin-page { padding: var(--v5-space-4) var(--v5-space-5) calc(var(--v5-space-6) + var(--v5-space-1) + env(safe-area-inset-bottom)); max-width: 480px; margin: 0 auto; color: var(--v5-ink); }
.payment-pin-page__note { display: block; font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-2); line-height: 1.65; margin-bottom: var(--v5-space-4); }
.payment-pin-page__field { margin-top: var(--v5-space-6); }
.payment-pin-page__label { display: block; font-size: var(--ui-type-list-title); font-weight: 600; line-height: 1.5; }
.payment-pin-page__error { display: block; color: var(--v5-danger); font-size: var(--ui-type-list-subtitle); line-height: 1.6; margin: var(--ui-space-row-y) 0; }
.payment-pin-page__primary { display: flex; align-items: center; justify-content: center; min-height: 48px; padding: var(--v5-space-3) var(--v5-space-4); border-radius: var(--v5-radius-full); background: var(--v5-brand); color: var(--v5-on-brand); font-size: var(--ui-type-button); font-weight: 600; text-align: center; margin-top: var(--v5-space-5); }
.payment-pin-page__primary[aria-disabled="true"] { opacity: .45; }
.payment-pin-page__link { display: flex; align-items: center; justify-content: center; min-height: 48px; margin-top: var(--v5-space-2); color: var(--v5-brand); font-size: var(--ui-type-list-subtitle); text-align: center; }
</style>

<style scoped>
.payment-pin-page { padding: 3px 16px 100px; }
.payment-vault-stage { position:relative; isolation:isolate; }
/* The outer halo fades uniformly; the clipped inner copy preserves the glass backdrop. */
.payment-vault-aura.payment-vault-aura--outer { opacity:.5; z-index:-2; }
.payment-vault-glow { position:absolute; inset:0; z-index:-1; overflow:hidden; border-radius:var(--v5-radius-xl); background:var(--v5-bg); pointer-events:none; }
.payment-vault-aura { position:absolute; z-index:-1; inset:-8px -6px; pointer-events:none; }
.payment-vault-aura::before,.payment-vault-aura::after { content:""; position:absolute; width:180px; height:140px; border-radius:50%; filter:blur(42px); }
.payment-vault-aura::before { left:-10px; top:-6px; background:color-mix(in srgb,var(--v5-aura-sky) 40%,transparent); }
.payment-vault-aura::after { right:-14px; bottom:10px; background:color-mix(in srgb,var(--v5-tech-cyan) 43%,transparent); }
:global([data-theme="light"] .payment-vault) { background:color-mix(in srgb,var(--v5-surface) 58%,transparent); backdrop-filter:blur(16px) saturate(140%); }
:global([data-theme="light"] .payment-vault-aura::before) { background:color-mix(in srgb,var(--v5-aura-sky) 14%,transparent); }
:global([data-theme="light"] .payment-vault-aura::after) { background:color-mix(in srgb,var(--v5-tech-cyan) 16%,transparent); }
.payment-vault { display:flex; flex-direction:column; align-items:center; text-align:center; padding:var(--v5-space-8) 20px 26px; border-radius:var(--v5-radius-xl); background:color-mix(in srgb,var(--v5-ink) 5.5%,transparent); box-shadow:var(--ui-glass-edge-shadow); backdrop-filter:blur(16px) saturate(125%); }
.payment-vault-lock { display:grid; place-items:center; width:88px; height:88px; border-radius:var(--v5-radius-2xl); background:var(--v5-brand-soft); color:var(--v5-brand); box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--v5-brand) 35%,transparent); animation:nx-viz-pop 520ms both; }
.payment-vault-dots { display:flex; gap:10px; margin-top:22px; }
.payment-vault-dots > view { width:12px; height:12px; border-radius:50%; background:var(--v5-brand); animation:nx-viz-pop 360ms both; }
.payment-vault-title { margin-top:22px; font-size:20px; line-height:28px; font-weight:600; }
.payment-vault-status { margin-top:var(--v5-space-2); height:24px; box-sizing:border-box; padding:var(--v5-space-1) 8px; border-radius:var(--v5-radius-full); background:color-mix(in srgb,var(--v5-warning) 16%,transparent); color:var(--v5-warning); font-size:12px; line-height:16px; font-weight:500; }
.payment-vault-purpose { margin-top:var(--v5-space-3); font-size:13px; line-height:20px; color:var(--v5-ink-3); }
.payment-pin-page__dock { position:fixed; bottom:0; left:0; right:0; padding:var(--v5-space-3) 16px calc(30px + env(safe-area-inset-bottom)); background:linear-gradient(180deg,color-mix(in srgb,var(--v5-surface) 70%,transparent),color-mix(in srgb,var(--v5-surface) 94%,transparent)); border-top:1px solid color-mix(in srgb,var(--v5-ink) 5%,transparent); backdrop-filter:blur(18px) saturate(160%); }
.payment-pin-page__dock > .nx-button { width:100%; }
.payment-pin-page__primary { width:100%; padding:0; background:none; }
@media(prefers-reduced-motion:reduce) { .payment-vault-lock,.payment-vault-dots > view { animation:none; } }
</style>
