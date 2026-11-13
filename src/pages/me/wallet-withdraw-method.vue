<template>
  <AppChassis active="me">
    <SubPageHeader back="/pages/me/me" :title="t.bankWithdrawal.chooseMethod" />
    <!-- P-45: each method is a card (medal, title, hint); the payout address / bank account is not shown here. -->
    <view class="withdraw-methods">
      <text class="intro">{{ t.bankWithdrawal.chooseMethodHint }}</text>
      <view v-if="preview" class="method" role="button" tabindex="0" data-testid="withdraw-method-test-preview" @click="previewOpen = true" @keydown.enter.prevent="previewOpen = true" @keydown.space.prevent="previewOpen = true">
        <text class="method-title">测试提现（不会出款）</text>
        <text class="method-note">仅预览参数，不扣余额，不创建提现单。</text>
      </view>
      <view v-if="previewMetaError" class="method" role="status">
        <text class="method-note">{{ previewMetaError }}</text>
        <NxButton :disabled="previewDiscovering" label="重试测试预览" @click="loadPreview()">重试测试预览</NxButton>
      </view>
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
          <view class="method-copy"><text class="method-title">{{ t.bankWithdrawal.bankMethod }}</text><text class="method-note">{{ bankNote }}</text></view>
          <svg v-if="canOpenBank" class="method-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </view>
      </view>
      <!-- Use a view: uni-app wraps text in a span that escapes the existing clip pattern. -->
      <view class="method-sr-only" role="status" aria-live="polite" aria-atomic="true">{{ bankNote }}</view>
      <view v-if="!checking && !recoveryKnown" class="reload" role="button" tabindex="0" @click="load" @keydown.enter.prevent="load" @keydown.space.prevent="load"><text>{{ t.bankWithdrawal.reload }}</text></view>
    </view>
    <NxSheet :open="previewOpen && !!preview" title="测试提现（不会出款）" @close="closePreview">
      <view v-if="preview" class="preview">
        <text class="method-note">仅校验金额、费用、余额和次数限制，不代表真实提现资格；不会调用出款通道。</text>
        <text>网络：BEP20 · USDT</text>
        <text>余额：{{ preview.walletUsdt }} USDT</text>
        <text>最低金额：{{ preview.minAmount }} USDT</text>
        <text>网络费用：{{ preview.networkFeeUsdt }} USDT（不使用 UVT 抵扣）</text>
        <text>每日次数：{{ preview.dailyCount }} / {{ preview.dailyLimitCount }}</text>
        <text>余额比例上限：{{ preview.balanceMaxRatio * 100 }}%</text>
        <input v-model="previewAmount" type="digit" placeholder="输入预览金额（USDT）" aria-label="测试提现预览金额（USDT）" @input="invalidatePreviewAmount" />
        <NxButton :disabled="previewChecking" label="校验预览参数" @click="checkPreview">校验预览参数</NxButton>
        <text v-if="previewError" role="status">{{ previewError }}</text>
        <template v-if="previewChecked">
          <text v-if="preview.validationPassed">参数校验通过；仍不可提交或出款。</text>
          <text v-for="reason in preview.reasons" :key="reason" role="status">{{ previewReason(reason) }}</text>
          <text>预览净额：{{ preview.netReceiveUsdt }} USDT</text>
        </template>
        <text class="method-note">此入口只读，真实提现仍关闭。</text>
      </view>
    </NxSheet>
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
import { apiClient, apiRuntimeConfig } from "@/api/runtime";
import { createBankWithdrawalApi } from "@/api/bank-withdrawal-api";
import { createWithdrawalApi, type WithdrawalTestPreview } from "@/api/withdrawal-api";
import NxSheet from "@/components/ui/nx-sheet.vue";
import NxButton from "@/components/ui/nx-button.vue";
import { ApiError } from "@/api/errors";

const t = useT(), app = useApp();
const pending = ref(readWithdrawAttempt(app.accountKey));
const checking = ref(false), recoveryKnown = ref(false), bankIntent = ref(false);
const bankEnabled = ref(false);
const readFailed = ref(false);
let revision = 0, visible = false;
const preview = ref<WithdrawalTestPreview | null>(null), previewOpen = ref(false);
const previewAmount = ref(""), previewError = ref(""), previewChecking = ref(false), previewChecked = ref(false);
const previewMetaError = ref(""), previewDiscovering = ref(false);
let previewRevision = 0;
function closePreview() { previewOpen.value = false; previewRevision++; previewChecking.value = false; previewChecked.value = false; previewError.value = ""; }
function invalidatePreviewAmount() { previewRevision++; previewChecking.value = false; previewChecked.value = false; previewError.value = ""; }
function previewReason(reason: string): string {
  return ({ BELOW_MINIMUM: "低于最低提现金额", INSUFFICIENT_BALANCE: "余额不足", BALANCE_RATIO_LIMIT: "超过余额比例上限",
    DAILY_LIMIT_REACHED: "已达到每日次数限制", NET_RECEIVE_NON_POSITIVE: "金额不足以支付网络费用" } as Record<string, string>)[reason] ?? "参数校验未通过";
}
async function loadPreview(amount?: string) {
  const sequence = ++previewRevision, account = app.accountKey, epoch = app.accountBindingEpoch;
  const { environment, baseUrl } = apiRuntimeConfig;
  const current = () => visible && sequence === previewRevision && account === app.accountKey && epoch === app.accountBindingEpoch
    && environment === apiRuntimeConfig.environment && baseUrl === apiRuntimeConfig.baseUrl;
  if (amount !== undefined) previewChecking.value = true;
  else previewDiscovering.value = true;
  try {
    const result = await createWithdrawalApi(apiClient).testPreview(amount);
    if (!current()) return;
    preview.value = result; previewChecked.value = amount !== undefined; previewMetaError.value = "";
  } catch (cause) {
    if (!current()) return;
    previewChecked.value = false;
    if (cause instanceof ApiError && (cause.status === 404 || cause.code === 404)) {
      closePreview(); preview.value = null; previewMetaError.value = ""; previewDiscovering.value = false;
    } else if (amount === undefined) {
      preview.value = null; previewMetaError.value = "测试预览暂不可用，请重试；未创建提现单。";
    } else previewError.value = "预览读取失败，请重试；未创建提现单。";
  } finally { if (current()) { previewChecking.value = false; previewDiscovering.value = false; } }
}
function checkPreview() {
  const value = previewAmount.value.trim();
  previewChecked.value = false; previewError.value = "";
  if (!/^\d+(?:\.\d{1,6})?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) <= 0) {
    previewError.value = "请输入大于 0、最多六位小数的金额。"; return;
  }
  void loadPreview(value);
}
const canOpenUsdt = computed(() => !!pending.value || (!checking.value && recoveryKnown.value && !bankIntent.value));
const bankUnavailable = computed(() => recoveryKnown.value && !bankIntent.value && !bankEnabled.value);
const bankNote = computed(() => checking.value ? t.value.bankWithdrawal.loading
  : !recoveryKnown.value ? t.value.bankWithdrawal.recoveryUnavailable
  : bankIntent.value ? t.value.bankWithdrawal.resumeBank
  : bankUnavailable.value ? t.value.bankWithdrawal.unavailable : t.value.bankWithdrawal.bankMethodHint);
const canOpenBank = computed(() => (!pending.value || bankIntent.value || !recoveryKnown.value) && !checking.value && !bankUnavailable.value);
async function load() {
  if (!previewOpen.value) void loadPreview();
  const currentRevision = ++revision, account = app.accountKey, epoch = app.accountBindingEpoch;
  const { environment, baseUrl } = apiRuntimeConfig;
  const current = () => visible && currentRevision === revision && account === app.accountKey && epoch === app.accountBindingEpoch
    && environment === apiRuntimeConfig.environment && baseUrl === apiRuntimeConfig.baseUrl;
  readFailed.value = false;
  pending.value = readWithdrawAttempt(account); checking.value = true; recoveryKnown.value = false; bankIntent.value = false; bankEnabled.value = false;
  try {
    const config = await createBankWithdrawalApi(apiClient).config(); if (!current()) return;
    recoveryKnown.value = config.unresolvedIntent !== undefined; bankIntent.value = !!config.unresolvedIntent; bankEnabled.value = config.enabled;
  } catch { if (current()) readFailed.value = true; /* Keep original bank requests reachable. */ }
  finally { if (current()) checking.value = false; }
}
useAutoRecovery({ failed: () => readFailed.value && !checking.value, retry: load });
function reset() { revision++; closePreview(); preview.value = null; previewAmount.value = ""; previewMetaError.value = ""; previewDiscovering.value = false; recoveryKnown.value = false; bankIntent.value = false; pending.value = readWithdrawAttempt(app.accountKey); if (visible) void load(); }
watch(() => [app.accountKey, app.accountBindingEpoch, apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl] as const, reset);
onShow(() => { visible = true; void load(); });
onHide(() => { visible = false; revision++; closePreview(); preview.value = null; });
onUnload(() => { visible = false; revision++; closePreview(); preview.value = null; });
// An unresolved USDT attempt resumes on the withdraw page itself (it restores the frozen network); otherwise choose a network first.
function openUsdt() { if (canOpenUsdt.value) navTo(pending.value ? "/pages/me/wallet-withdraw" : "/pages/me/wallet-withdraw-network"); }
function openBank() {
  pending.value = readWithdrawAttempt(app.accountKey);
  if (canOpenBank.value) navTo("/pages/me/wallet-withdraw-bank");
}
</script>

<style scoped>
.withdraw-methods { padding: 0 16px 32px; color: var(--v5-ink); }
.preview { display: flex; flex-direction: column; gap: 12px; font-size: 14px; }
.preview input { min-height: 44px; padding: 8px 12px; border: 1px solid var(--v5-border); border-radius: 12px; }
.method-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
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
.reload { display: inline-flex; align-items: center; min-height: 44px; margin-left: 4px; color: var(--v5-brand); font: 500 13px/18px var(--font-v5); cursor: pointer; }
.method[aria-disabled="true"] { opacity: .5; cursor: default; }
.method[aria-disabled="true"]:active { transform: none; }
.method:focus-visible, .reload:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .method { transition: none; } .method:active { transform: none; } }
</style>
