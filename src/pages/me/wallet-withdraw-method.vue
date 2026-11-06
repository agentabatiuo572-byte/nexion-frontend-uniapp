<template>
  <AppChassis active="me">
    <SubPageHeader back="/pages/me/me" :title="t.bankWithdrawal.chooseMethod" />
    <!-- P-45: each method is a route card (medal, title, hint) with the real destination it pays into. -->
    <view class="withdraw-methods">
      <text class="intro">{{ t.bankWithdrawal.chooseMethodHint }}</text>
      <view class="method" role="button" tabindex="0" data-testid="withdraw-method-usdt" :aria-disabled="!canOpenUsdt" @click="openUsdt" @keydown.enter.prevent="openUsdt" @keydown.space.prevent="openUsdt">
        <view class="method-top">
          <view class="method-icon method-icon--usdt" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8 8h8M12 8v9M8.5 11.5c2 .8 5 .8 7 0" /></svg></view>
          <view class="method-copy"><text class="method-title">USDT</text><text class="method-note">{{ pending ? t.bankWithdrawal.resumeUsdt : t.bankWithdrawal.usdtMethodHint }}</text></view>
          <svg class="method-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </view>
        <view v-if="usdtRoute" class="route" aria-hidden="true"><text class="route-from">{{ t.bankWithdrawal.routeFrom }}</text><view class="route-arrow" /><text class="route-tag route-tag--brand">{{ usdtRoute.network }}</text><view class="route-arrow" /><text class="route-to">{{ usdtRoute.to }}</text></view>
      </view>
      <view class="method" role="button" tabindex="0" data-testid="withdraw-method-bank" :aria-disabled="!canOpenBank" @click="openBank" @keydown.enter.prevent="openBank" @keydown.space.prevent="openBank">
        <view class="method-top">
          <view class="method-icon method-icon--bank" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M12 3 3 8h18z" /></svg></view>
          <view class="method-copy"><text class="method-title">{{ t.bankWithdrawal.bankMethod }}</text><text class="method-note">{{ bankIntent ? t.bankWithdrawal.resumeBank : bankUnavailable ? t.bankWithdrawal.unavailable : t.bankWithdrawal.bankMethodHint }}</text></view>
          <svg v-if="canOpenBank" class="method-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </view>
        <view v-if="bankRoute" class="route" aria-hidden="true"><text class="route-from">{{ t.bankWithdrawal.routeFrom }}</text><view class="route-arrow" /><text class="route-tag route-tag--ok">VND</text><view class="route-arrow" /><text class="route-to">{{ bankRoute }}</text></view>
      </view>
      <text v-if="pending" class="status" role="status">{{ t.bankWithdrawal.resumeUsdt }}</text>
      <text v-else-if="checking" class="status" role="status">{{ t.bankWithdrawal.loading }}</text>
      <text v-else-if="!recoveryKnown" class="status" role="status">{{ t.bankWithdrawal.recoveryUnavailable }}</text>
      <text v-else-if="bankIntent" class="status" role="status">{{ t.bankWithdrawal.resumeBank }}</text>
      <view v-if="!checking && !recoveryKnown" class="reload" role="button" tabindex="0" @click="load" @keydown.enter.prevent="load" @keydown.space.prevent="load"><text>{{ t.bankWithdrawal.reload }}</text></view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { computed, ref, watch } from "vue";
import { onShow, onHide, onUnload } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { readWithdrawAttempt } from "@/lib/withdraw-attempt";
import { navTo } from "@/lib/route";
import { apiClient, payoutAddressApi } from "@/api/runtime";
import { createBankWithdrawalApi } from "@/api/bank-withdrawal-api";
import { captureRuntimeRevision, isCurrentRuntimeRevision, subscribeRuntimeRevision } from "@/api/order-api";

const t = useT(), app = useApp();
const pending = ref(readWithdrawAttempt(app.accountKey));
const checking = ref(false), recoveryKnown = ref(false), bankIntent = ref(false);
const bankEnabled = ref(false);
const readFailed = ref(false);
// Destination summary on each card: the bound payout address / bank account tail, only when the server returned one.
const payout = ref<{ network: string; address: string } | null>(null), beneficiaryTail = ref("");
const usdtRoute = computed(() => payout.value ? { network: payout.value.network.replace(/^USDT-/, ""),
  to: payout.value.address.length > 12 ? `${payout.value.address.slice(0, 6)}…${payout.value.address.slice(-4)}` : payout.value.address } : null);
const bankRoute = computed(() => beneficiaryTail.value ? `•••• ${beneficiaryTail.value}` : "");
let revision = 0, visible = false;
const canOpenUsdt = computed(() => !!pending.value || (!checking.value && recoveryKnown.value && !bankIntent.value));
const bankUnavailable = computed(() => recoveryKnown.value && !bankIntent.value && !bankEnabled.value);
const canOpenBank = computed(() => !pending.value && !checking.value && !bankUnavailable.value);
async function load() {
  const currentRevision = ++revision, account = app.accountKey, epoch = app.accountBindingEpoch, runtime = captureRuntimeRevision();
  const current = () => visible && currentRevision === revision && account === app.accountKey && epoch === app.accountBindingEpoch && isCurrentRuntimeRevision(runtime);
  readFailed.value = false;
  pending.value = readWithdrawAttempt(account); checking.value = true; recoveryKnown.value = false; bankIntent.value = false; bankEnabled.value = false;
  payout.value = null; beneficiaryTail.value = "";
  // The route summary is decoration: a failed address read leaves the card without it and never gates a method.
  void payoutAddressApi.list().then(snapshot => {
    if (!current()) return;
    const row = snapshot.addresses.find(item => item.status === "ACTIVE");
    payout.value = row ? { network: row.network, address: row.address } : null;
  }, () => {});
  try {
    const config = await createBankWithdrawalApi(apiClient).config(); if (!current()) return;
    recoveryKnown.value = config.unresolvedIntent !== undefined; bankIntent.value = !!config.unresolvedIntent; bankEnabled.value = config.enabled;
    beneficiaryTail.value = /[0-9]{4}$/.exec(config.beneficiary?.maskedAccount ?? "")?.[0] ?? "";
  } catch { if (current()) readFailed.value = true; /* Keep original bank requests reachable. */ }
  finally { if (current()) checking.value = false; }
}
useAutoRecovery({ failed: () => readFailed.value && !checking.value, retry: load });
function reset() { revision++; recoveryKnown.value = false; bankIntent.value = false; pending.value = readWithdrawAttempt(app.accountKey); if (visible) void load(); }
watch(() => [app.accountKey, app.accountBindingEpoch] as const, reset);
const stopRuntime = subscribeRuntimeRevision(reset);
onShow(() => { visible = true; void load(); });
onHide(() => { visible = false; revision++; });
onUnload(() => { visible = false; revision++; stopRuntime(); });
function openUsdt() { if (canOpenUsdt.value) navTo("/pages/me/wallet-withdraw"); }
function openBank() {
  pending.value = readWithdrawAttempt(app.accountKey);
  if (canOpenBank.value) navTo("/pages/me/wallet-withdraw-bank");
}
</script>

<style scoped>
.withdraw-methods { padding: 0 16px 32px; color: var(--v5-ink); }
.intro { display: block; margin: -1px 4px 12px; color: var(--v5-ink-3); font: 400 13px/20px var(--font-v5); }
.method { position: relative; display: block; margin-bottom: 12px; padding: 16px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); cursor: pointer; transition: transform 120ms cubic-bezier(.2,.8,.2,1); }
.method:active { transform: scale(.97); }
.method-top { display: flex; align-items: center; gap: 14px; }
.method-icon { display: grid; place-items: center; flex: none; width: 48px; height: 48px; border-radius: var(--v5-radius-m); }
.method-icon--usdt { background: var(--v5-tech-cyan-soft); color: var(--v5-tech-cyan); }
.method-icon--bank { background: var(--v5-success-soft); color: var(--v5-success-ink); }
.method-copy { flex: 1; min-width: 0; }
.method-title { display: block; font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); }
.method-note { display: block; color: var(--v5-ink-3); font: 400 13px/20px var(--font-v5); }
.method-chev { flex: none; color: var(--v5-ink-4); }
.route { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding: 12px 14px; border-radius: 14px; background: color-mix(in srgb, var(--v5-ink) 4%, transparent); box-shadow: inset 0 2px 8px rgba(0,0,0,.45), inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .route { box-shadow: inset 0 1px 4px rgba(20,16,8,.10), inset 0 0 0 1px var(--v5-border); }
.route-from { color: var(--v5-ink-3); font: 400 12px/16px var(--font-v5); white-space: nowrap; }
.route-arrow { flex: 1; min-width: 18px; height: 1px; background: repeating-linear-gradient(90deg, var(--v5-ink-4) 0 4px, transparent 4px 8px); }
.route-tag { display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: var(--v5-radius-full); font: 500 12px/16px var(--font-v5); white-space: nowrap; }
.route-tag--brand { background: var(--v5-brand-soft); color: var(--v5-brand); }
.route-tag--ok { background: var(--v5-success-soft); color: var(--v5-success-ink); }
.route-to { color: var(--v5-ink); font: 500 13px/18px var(--font-metric); white-space: nowrap; }
.status { display: block; margin: 4px 4px 0; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); }
.reload { display: inline-flex; align-items: center; min-height: 44px; margin-left: 4px; color: var(--v5-brand); font: 500 13px/18px var(--font-v5); cursor: pointer; }
.method[aria-disabled="true"] { opacity: .5; cursor: default; }
.method[aria-disabled="true"]:active { transform: none; }
.method:focus-visible, .reload:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .method { transition: none; } .method:active { transform: none; } }
</style>
