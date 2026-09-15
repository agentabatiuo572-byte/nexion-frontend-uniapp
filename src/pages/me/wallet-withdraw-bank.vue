<template>
  <AppChassis active="me">
    <SubPageHeader back="/pages/me/wallet" :title="c.title" />
    <view class="bank-withdraw">
      <text v-if="busy" role="status">{{ c.loading }}</text>
      <view v-if="error" class="notice danger" role="alert"><text>{{ error }}</text></view>
      <view v-if="config && !config.enabled" class="notice"><text>{{ c.unavailable }}</text></view>
      <view v-if="uncertain" class="notice" role="alert"><text>{{ c.unknown }}</text></view>
      <view class="action" role="button" tabindex="0" data-testid="bank-refresh" :aria-disabled="busy" @click="load" @keydown.enter.prevent="load" @keydown.space.prevent="load"><text>{{ c.refresh }}</text></view>
      <view class="action" role="button" tabindex="0" data-testid="bank-abandon" v-if="quote && !order" :aria-disabled="busy" @click="abandon" @keydown.enter.prevent="abandon" @keydown.space.prevent="abandon"><text>{{ c.requote }}</text></view>

      <view v-if="order" class="section">
        <text class="title" data-testid="bank-order-status">{{ statusLabel }}</text>
        <text class="muted">{{ order.withdrawalNo }}</text>
        <view class="row"><text>{{ c.bank }}</text><text>{{ order.bank.bankName }}</text></view>
        <view class="row"><text>{{ c.account }}</text><text>{{ order.bank.maskedAccount }}</text></view>
        <view class="row"><text>{{ c.amount }}</text><text>{{ money(order.bank.amountUsdt) }}</text></view>
        <view class="row"><text>{{ c.fee }}</text><text>{{ money(order.bank.feeUsdt) }}</text></view>
        <view class="row"><text>{{ c.rate }}</text><text>{{ money(order.bank.rateVnd) }}</text></view>
        <view class="row"><text>{{ c.receive }}</text><text class="amount">{{ order.bank.amountVnd.toLocaleString() }}</text></view>
        <view class="action" role="button" tabindex="0" data-testid="bank-new" v-if="terminal" :aria-disabled="busy" @click="startNew" @keydown.enter.prevent="startNew" @keydown.space.prevent="startNew"><text>{{ c.newWithdrawal }}</text></view>
      </view>

      <template v-else-if="config">
        <view v-if="config.beneficiary" class="section">
          <text class="title">{{ config.beneficiary.bankName }} · {{ config.beneficiary.maskedAccount }}</text>
          <text class="muted">{{ c.effective }}: {{ displayDate(config.beneficiary.effectiveAt) }}</text>
          <text class="muted">{{ c.changeAfter }}: {{ displayDate(config.beneficiary.nextChangeAt) }}</text>
        </view>
        <view v-if="!quote && !uncertain" class="section">
          <text class="muted">{{ c.bindingNotice }}</text>
          <view class="action" role="button" tabindex="0" :aria-disabled="busy" @click="manageBank" @keydown.enter.prevent="manageBank" @keydown.space.prevent="manageBank"><text>{{ useTranslations.bankBinding.manage }}</text></view>
        </view>
        <view v-if="config.beneficiary && !uncertain" class="section">
          <input data-testid="bank-amount" v-if="!quote" v-model="amount" class="field" type="text" inputmode="decimal" :disabled="busy || !config.enabled" :placeholder="c.amount" :aria-label="c.amount" />
          <view class="action" role="button" tabindex="0" data-testid="bank-quote" v-if="!quote" :aria-disabled="busy || !config.enabled || !amount" @click="getQuote" @keydown.enter.prevent="getQuote" @keydown.space.prevent="getQuote"><text>{{ c.quote }}</text></view>
          <template v-else>
            <view class="row"><text>{{ c.amount }}</text><text>{{ money(quote.amountUsdt) }}</text></view>
            <view class="row"><text>{{ c.fee }}</text><text>{{ money(quote.feeUsdt) }}</text></view>
            <view class="row"><text>{{ c.net }}</text><text>{{ money(quote.netUsdt) }}</text></view>
            <view class="row"><text>{{ c.rate }}</text><text>{{ money(quote.rateVnd) }}</text></view>
            <view class="row"><text>{{ c.receive }}</text><text class="amount">{{ quote.amountVnd.toLocaleString() }}</text></view>
            <text class="muted">{{ quote.bankName }} · {{ quote.maskedAccount }}</text>
            <text class="muted">{{ c.expires }}: {{ displayDate(quote.expiresAt) }}</text>
            <text class="muted">{{ c.confirmNotice }}</text>
            <view class="action" role="button" tabindex="0" data-testid="bank-submit" :aria-disabled="busy || !config.enabled || uncertain" @click="submit" @keydown.enter.prevent="submit" @keydown.space.prevent="submit"><text>{{ c.confirm }}</text></view>
          </template>
        </view>
      </template>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onLoad, onShow, onHide, onUnload } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { apiClient } from "@/api/runtime";
import { captureRuntimeRevision, isCurrentRuntimeRevision, subscribeRuntimeRevision } from "@/api/order-api";
import { createBankWithdrawalApi, type BankConfig, type BankQuote, type BankOrder } from "@/api/bank-withdrawal-api";
import { parseServerTimestamp } from "@/api/server-time";
import { navTo } from "@/lib/route";

const c = computed(() => useTranslations.value.bankWithdrawal);
const useTranslations = useT();
const app = useApp();
const api = createBankWithdrawalApi(apiClient);
const config = ref<BankConfig | null>(null);
const quote = ref<BankQuote | null>(null);
const order = ref<BankOrder | null>(null);
const busy = ref(false);
const error = ref("");
const uncertain = ref(false);
const amount = ref("");
let requestedOrder = "";
let revision = 0;
let alive = true;
let visible = false;
const pendingKey = () => `nexgrid.bank-withdraw.pending:${app.accountKey}`;
const money = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 6 });
const displayDate = (value: string) => new Date(parseServerTimestamp(value) ?? NaN).toLocaleString();
const terminal = computed(() => !!order.value && ["CONFIRMED", "FAILED", "REFUNDED", "REVIEW_REJECTED"].includes(order.value.status)
  && order.value.providerState !== "MANUAL_REVIEW");
const statusLabel = computed(() => {
  if (!order.value) return "";
  if (order.value.providerState === "MANUAL_REVIEW" && ["CONFIRMED", "FAILED", "REFUNDED"].includes(order.value.status)) return c.value.resultReview;
  if (order.value.providerState === "MANUAL_REVIEW" || ["FROZEN", "TX_ORPHANED"].includes(order.value.status)) return c.value.held;
  if (order.value.status === "CONFIRMED") return c.value.paid;
  if (terminal.value) return c.value.failed;
  return ["PROCESSING", "SENT"].includes(order.value.status) ? c.value.processing : c.value.review;
});
function scope() {
  const id = ++revision, owner = app.accountKey, epoch = app.accountBindingEpoch, runtime = captureRuntimeRevision();
  return () => alive && revision === id && app.accountKey === owner && app.accountBindingEpoch === epoch && isCurrentRuntimeRevision(runtime);
}
function report(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  error.value = `${c.value.error}${/^[A-Z][A-Z0-9_]{4,90}$/.test(message) ? ` (${message})` : ""}`;
}
async function run(action: (current: () => boolean) => Promise<void>) {
  if (busy.value) return;
  const current = scope(); busy.value = true; error.value = "";
  try { await action(current); } catch (err) { if (current()) report(err); }
  finally { if (current()) busy.value = false; }
}
async function load() {
  await run(async current => {
    const loaded = await api.config(); if (!current()) return; config.value = loaded;
    if (requestedOrder || order.value) {
      const loadedOrder = await api.get(requestedOrder || order.value!.withdrawalNo);
      if (current()) { order.value = loadedOrder; uncertain.value = false; }
      return;
    }
    const pending: unknown = uni.getStorageSync(pendingKey());
    if (typeof pending === "string" && /^BQ-[a-f0-9]{32}$/.test(pending)) {
      uncertain.value = true;
      const recovered = await api.recover(pending); if (!current()) return;
      if (recovered.state === "COMMITTED") { order.value = recovered; uni.removeStorageSync(pendingKey()); }
      else if (recovered.state === "NOT_SUBMITTED") quote.value = recovered.quote;
      else { quote.value = null; uni.removeStorageSync(pendingKey()); }
      uncertain.value = false;
    }
  });
}
function manageBank() { if (!busy.value) navTo("/pages/me/wallet-cards-new?returnTo=%2Fpages%2Fme%2Fwallet-withdraw-bank"); }
async function getQuote() {
  if (!config.value?.enabled || !amount.value || uncertain.value) return;
  await run(async current => { const value = await api.quote(amount.value); if (current()) quote.value = value; });
}
async function submit() {
  if (!quote.value || uncertain.value || !config.value?.enabled) return;
  await run(async current => {
    const no = quote.value!.quoteNo;
    uni.setStorageSync(pendingKey(), no); // Recovery reference only; never persist bank details, OTPs or balances.
    uncertain.value = true;
    const value = await api.submit(no, `bank-submit:${no}`);
    if (!current()) return;
    order.value = value; quote.value = null; uncertain.value = false; uni.removeStorageSync(pendingKey());
  });
}
async function abandon() {
  if (!quote.value) return;
  await run(async current => {
    const recovered = await api.abandon(quote.value!.quoteNo); if (!current()) return;
    if (recovered.state === "COMMITTED") order.value = recovered;
    else if (recovered.state !== "ABANDONED") return;
    quote.value = null; uncertain.value = false; uni.removeStorageSync(pendingKey());
  });
}
function startNew() {
  if (!terminal.value || busy.value) return;
  order.value = null; quote.value = null; requestedOrder = ""; amount.value = ""; void load();
}
function invalidate() {
  revision++; config.value = null; quote.value = null; order.value = null; busy.value = false; error.value = ""; uncertain.value = false;
  amount.value = ""; requestedOrder = "";
  if (alive && visible) void load();
}
watch(() => [app.accountKey, app.accountBindingEpoch] as const, invalidate);
const stopRuntime = subscribeRuntimeRevision(invalidate);
onLoad(params => { if (typeof params?.order === "string" && /^WD-[A-Z0-9]+$/.test(params.order)) requestedOrder = params.order; });
onShow(() => { visible = true; void load(); });
onHide(() => { visible = false; });
onUnload(() => { alive = false; visible = false; stopRuntime(); revision++; });
</script>

<style scoped>
.bank-withdraw { padding: 0 20px 40px; color: var(--v5-ink); }
.section { display: flex; flex-direction: column; gap: 12px; padding: 20px 0; border-bottom: 1px solid var(--v5-border); }
.title { font-size: 20px; font-weight: 600; overflow-wrap: anywhere; }
.muted { color: var(--v5-ink-3); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.notice { padding: 12px; background: color-mix(in srgb, var(--v5-warning) 12%, transparent); border-radius: 10px; margin-bottom: 12px; font-size: 13px; }
.danger { color: var(--v5-danger); }
.row { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 13px; }
.field { min-height: 44px; padding: 6px 12px; border: 1px solid var(--v5-border); border-radius: 8px; box-sizing: border-box; font-size: 15px; flex: 1; }
.amount { color: var(--v5-brand); font-weight: 600; }
.action { min-height: 44px; display: flex; align-items: center; justify-content: center; padding: 6px 12px; border-radius: 8px; background: color-mix(in srgb, var(--v5-brand) 10%, transparent); font-size: 15px; cursor: pointer; }
.action[aria-disabled="true"] { opacity: .5; cursor: default; }
.row .action { flex-shrink: 0; }
.bank-choices { display: flex; flex-direction: column; gap: 8px; }
</style>
