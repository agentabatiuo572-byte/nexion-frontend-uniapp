<template>
  <AppChassis active="me">
    <SubPageHeader back="/pages/me/me" :title="t.bankWithdrawal.chooseMethod" />
    <!-- P-45: each method is a card (medal, title, hint); the payout address / bank account is not shown here. -->
    <view class="withdraw-methods">
      <text class="intro">{{ t.bankWithdrawal.chooseMethodHint }}</text>
      <view class="method" role="button" tabindex="0" data-testid="withdraw-method-usdt" :aria-disabled="!canOpenUsdt" @click="openUsdt" @keydown.enter.prevent="openUsdt" @keydown.space.prevent="openUsdt">
        <view class="method-top">
          <view class="method-icon method-icon--usdt" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8 8h8M12 8v9M8.5 11.5c2 .8 5 .8 7 0" /></svg></view>
          <view class="method-copy"><text class="method-title">USDT</text><text class="method-note">{{ pending ? t.bankWithdrawal.resumeUsdt : t.bankWithdrawal.usdtMethodHint }}</text></view>
          <svg class="method-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </view>
      </view>
      <view class="method" role="button" tabindex="0" data-testid="withdraw-method-bank" :aria-disabled="!canOpenBank" @click="openBank" @keydown.enter.prevent="openBank" @keydown.space.prevent="openBank">
        <view class="method-top">
          <view class="method-icon method-icon--bank" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M12 3 3 8h18z" /></svg></view>
          <view class="method-copy"><text class="method-title">{{ t.bankWithdrawal.bankMethod }}</text><text class="method-note">{{ bankIntent ? t.bankWithdrawal.resumeBank : bankUnavailable ? t.bankWithdrawal.unavailable : t.bankWithdrawal.bankMethodHint }}</text></view>
          <svg v-if="canOpenBank" class="method-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </view>
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
import { apiClient } from "@/api/runtime";
import { createBankWithdrawalApi } from "@/api/bank-withdrawal-api";
import { captureRuntimeRevision, isCurrentRuntimeRevision, subscribeRuntimeRevision } from "@/api/order-api";

const t = useT(), app = useApp();
const pending = ref(readWithdrawAttempt(app.accountKey));
const checking = ref(false), recoveryKnown = ref(false), bankIntent = ref(false);
const bankEnabled = ref(false);
const readFailed = ref(false);
let revision = 0, visible = false;
const canOpenUsdt = computed(() => !!pending.value || (!checking.value && recoveryKnown.value && !bankIntent.value));
const bankUnavailable = computed(() => recoveryKnown.value && !bankIntent.value && !bankEnabled.value);
const canOpenBank = computed(() => !pending.value && !checking.value && !bankUnavailable.value);
async function load() {
  const currentRevision = ++revision, account = app.accountKey, epoch = app.accountBindingEpoch, runtime = captureRuntimeRevision();
  const current = () => visible && currentRevision === revision && account === app.accountKey && epoch === app.accountBindingEpoch && isCurrentRuntimeRevision(runtime);
  readFailed.value = false;
  pending.value = readWithdrawAttempt(account); checking.value = true; recoveryKnown.value = false; bankIntent.value = false; bankEnabled.value = false;
  try {
    const config = await createBankWithdrawalApi(apiClient).config(); if (!current()) return;
    recoveryKnown.value = config.unresolvedIntent !== undefined; bankIntent.value = !!config.unresolvedIntent; bankEnabled.value = config.enabled;
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
// An unresolved USDT attempt resumes on the withdraw page itself (it restores the frozen network); otherwise choose a network first.
function openUsdt() { if (canOpenUsdt.value) navTo(pending.value ? "/pages/me/wallet-withdraw" : "/pages/me/wallet-withdraw-network"); }
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
.status { display: block; margin: 4px 4px 0; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); }
.reload { display: inline-flex; align-items: center; min-height: 44px; margin-left: 4px; color: var(--v5-brand); font: 500 13px/18px var(--font-v5); cursor: pointer; }
.method[aria-disabled="true"] { opacity: .5; cursor: default; }
.method[aria-disabled="true"]:active { transform: none; }
.method:focus-visible, .reload:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .method { transition: none; } .method:active { transform: none; } }
</style>
