<template>
  <AppChassis active="me">
    <SubPageHeader back="/pages/me/me" :title="state?.configured ? t.paymentPin.change : t.paymentPin.title" />
    <view class="payment-pin-page">
      <text v-if="!state || state.configured" class="payment-pin-page__note">{{ t.paymentPin.purpose }}</text>
      <view v-if="loading" role="status"><text class="payment-pin-page__note">{{ t.paymentPin.loading }}</text></view>
      <template v-else-if="ui.pendingOperation">
        <text class="payment-pin-page__note" role="status">{{ t.paymentPin.pending }}</text>
      </template>
      <template v-else-if="!state">
        <text class="payment-pin-page__error" role="alert">{{ t.paymentPin.readFailed }}</text>
        <NxButton variant="primary" class="payment-pin-page__primary" @click="load">{{ t.paymentPin.retry }}</NxButton>
      </template>
      <template v-else-if="!state.configured">
        <view class="payment-vault-stage"><view class="payment-vault-aura payment-vault-aura--outer" aria-hidden="true" /><view class="payment-vault nx-tint">
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
    <template #pageFixed><view v-if="!loading && state && !state.configured && !ui.pendingOperation" class="payment-pin-page__dock nx-glass-bar"><NxButton variant="primary" @click="setup">{{ t.paymentPin.setup }}</NxButton></view></template>
  </AppChassis>
</template>
<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
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
const active = ref(true);
let pageGeneration = 0;
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
async function load() {
  const generation = pageGeneration;
  loading.value = true; ui.changeError = "";
  if (!sessionVault.read()) return;
  try { pin.restorePendingRead(); }
  catch { if (active.value) { ui.changeError = "failed"; loading.value = false; } return; }
  await pin.refreshStatus({ isCurrent: () => active.value && generation === pageGeneration });
  if (active.value && generation === pageGeneration) loading.value = false;
}
useAutoRecovery({
  failed: () => active.value && !loading.value && !ui.visible && !!ui.pendingOperation && !ui.busy && !ui.reading,
  retry: () => {
    const generation = pageGeneration;
    return pin.query(() => active.value && generation === pageGeneration && !ui.visible);
  }, repeatMs: 15_000,
});
async function setup() { await pin.waitForQuery(); if (!await pin.setup()) await load(); }
async function recover() { await pin.waitForQuery(); if (ui.busy) return; clear(); if (!await pin.recover()) await load(); }
async function save() {
  await pin.waitForQuery();
  if (!canSave.value || !state.value) return;
  const result = pin.change(passwords.current, passwords.new, passwords.confirm);
  passwords.current = "";
  await result;
  if (pin.locked() || ui.visible) clear();
}
watch(() => ui.completedRevision, () => {
  if (!active.value || ui.context || !ui.completedOperation) return;
  clear(); toast.success(t.value.paymentPin[`${ui.completedOperation}Success`]); navTo("/me");
});
watch(() => ui.rejectedRevision, () => {
  if (active.value && !ui.visible) toast.error(t.value.paymentPin[ui.error || "failed"]);
});
// After an H5 reload the session is restored after the page shows: load() waits for it and reads here.
const unsubscribe = sessionVault.subscribe?.((_previous, next, continuation) => { if (!continuation) { clear(); if (next && active.value) void load(); } });
function hide() { pageGeneration++; active.value = false; clear(); }
function visibility() { if (typeof document !== "undefined" && document.hidden) hide(); }
onShow(() => { active.value = true; void load(); }); onHide(hide); onUnload(hide);
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
.payment-vault-status { margin-top:var(--v5-space-2); height:24px; box-sizing:border-box; padding:var(--v5-space-1) 8px; border-radius:var(--v5-radius-full); background:color-mix(in srgb,var(--v5-warning) 16%,transparent); color:var(--v5-warning-ink); font-size:12px; line-height:16px; font-weight:500; }
/* Warning ink on its own soft chip falls under 4.5:1 on the light tint; the light chip uses primary ink. */
:global([data-theme="light"] .payment-vault-status) { color:var(--v5-ink); }
.payment-vault-purpose { margin-top:var(--v5-space-3); font-size:13px; line-height:20px; color:var(--v5-ink-3); }
.payment-pin-page__dock { position:fixed; bottom:0; left:0; right:0; padding:var(--v5-space-3) 16px calc(30px + env(safe-area-inset-bottom)); }
.payment-pin-page__dock > .nx-button { width:100%; }
.payment-pin-page__primary { width:100%; padding:0; background:none; }
@media(prefers-reduced-motion:reduce) { .payment-vault-lock,.payment-vault-dots > view { animation:none; } }
</style>
