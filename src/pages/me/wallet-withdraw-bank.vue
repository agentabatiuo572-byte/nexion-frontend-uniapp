<template>
  <AppChassis active="me">
    <SubPageHeader back="/pages/me/wallet-withdraw-method" :title="c.title" />
    <view class="bank-withdraw">
      <text v-if="busy" role="status">{{ c.loading }}</text>
      <view v-if="error" class="notice danger" role="alert"><text>{{ error }}</text></view>
      <view v-if="config && !config.enabled" class="notice"><text>{{ c.unavailable }}</text></view>
      <view v-if="uncertain" class="notice" role="alert"><text>{{ c.unknown }}</text></view>
      <view v-if="config?.unresolvedIntent === undefined && config" class="notice" role="status"><text>{{ c.recoveryUnavailable }}</text></view>
      <view v-if="multipleIntents.length && !order" class="section">
        <text class="muted">{{ c.multipleIntents }}</text>
        <view v-for="intent in multipleIntents" :key="intent.quoteNo" class="action" role="button" tabindex="0" :aria-disabled="busy" @click="openIntent(intent)" @keydown.enter.prevent="openIntent(intent)" @keydown.space.prevent="openIntent(intent)"><text>{{ intent.withdrawalNo || intent.quoteNo }}</text></view>
      </view>
      <view class="action" role="button" tabindex="0" data-testid="bank-refresh" :aria-disabled="busy" @click="load" @keydown.enter.prevent="load" @keydown.space.prevent="load"><text>{{ c.refresh }}</text></view>
      <view class="action" role="button" tabindex="0" data-testid="bank-abandon" v-if="quote && !order" :aria-disabled="busy" @click="abandon" @keydown.enter.prevent="abandon" @keydown.space.prevent="abandon"><text>{{ c.requote }}</text></view>

      <view v-if="order" class="section">
        <text class="title" data-testid="bank-order-status" role="status" aria-live="polite" aria-atomic="true">{{ statusLabel }}</text>
        <text class="muted">{{ order.withdrawalNo }}</text>
        <view class="row"><text>{{ c.bank }}</text><text>{{ displayBank(order.bank.bankName) }}</text></view>
        <view class="row"><text>{{ c.account }}</text><text>{{ order.bank.maskedAccount }}</text></view>
        <view class="row"><text>{{ c.amount }}</text><text>{{ money(order.bank.amountUsdt) }}</text></view>
        <view class="row"><text>{{ c.fee }}</text><text>{{ money(order.bank.feeUsdt) }}</text></view>
        <view class="row"><text>{{ c.rate }}</text><text>{{ money(order.bank.rateVnd) }}</text></view>
        <view class="row"><text>{{ c.receive }}</text><text class="amount">{{ money(order.bank.amountVnd) }}</text></view>
        <view v-if="outcome === 'refunded'" class="row"><text>{{ c.refundAmount }}</text><text>{{ money(order.settlementEvidence!.amountUsdt!) }}</text></view>
        <text v-if="terminal && order.settlementEvidence?.checkedAt" class="muted">{{ c.confirmedAt }}: {{ displayDate(order.settlementEvidence.checkedAt) }}</text>
        <view class="action" role="button" tabindex="0" data-testid="bank-new" v-if="terminal" :aria-disabled="busy" @click="startNew" @keydown.enter.prevent="startNew" @keydown.space.prevent="startNew"><text>{{ c.newWithdrawal }}</text></view>
      </view>

      <template v-else-if="config">
        <view v-if="config.beneficiary" class="section">
          <text class="title">{{ displayBank(config.beneficiary.bankName) }} · {{ config.beneficiary.maskedAccount }}</text>
          <text class="muted" role="status" data-testid="bank-account-status">{{ accountStatus }}</text>
          <text class="muted">{{ c.effective }}: {{ displayDate(config.beneficiary.effectiveAt) }}</text>
          <text class="muted">{{ c.changeAfter }}: {{ displayDate(config.beneficiary.nextChangeAt) }}</text>
          <view class="action" role="button" tabindex="0" data-testid="bank-verify" :aria-disabled="busy || uncertain || !!quote || !!multipleIntents.length" @click="verifyAccount" @keydown.enter.prevent="verifyAccount" @keydown.space.prevent="verifyAccount"><text>{{ c.verifyAgain }}</text></view>
        </view>
        <view v-if="!quote && !uncertain && !multipleIntents.length" class="section">
          <text class="muted">{{ c.bindingNotice }}</text>
          <view class="action" role="button" tabindex="0" :aria-disabled="busy" @click="manageBank" @keydown.enter.prevent="manageBank" @keydown.space.prevent="manageBank"><text>{{ config.beneficiary ? c.changeAccount : c.addAccount }}</text></view>
        </view>
        <view v-if="config.beneficiary && !uncertain && !multipleIntents.length" class="section">
          <input data-testid="bank-amount" v-if="!quote" v-model="amount" class="field" type="text" inputmode="decimal" :disabled="busy || !canQuote" :placeholder="c.amount" :aria-label="c.amount" />
          <view class="action" role="button" tabindex="0" data-testid="bank-quote" v-if="!quote" :aria-disabled="busy || !canQuote || !amount" @click="getQuote" @keydown.enter.prevent="getQuote" @keydown.space.prevent="getQuote"><text>{{ c.quote }}</text></view>
          <template v-else>
            <view class="row"><text>{{ c.amount }}</text><text>{{ money(quote.amountUsdt) }}</text></view>
            <view class="row"><text>{{ c.fee }}</text><text>{{ money(quote.feeUsdt) }}</text></view>
            <view class="row"><text>{{ c.net }}</text><text>{{ money(quote.netUsdt) }}</text></view>
            <view class="row"><text>{{ c.rate }}</text><text>{{ money(quote.rateVnd) }}</text></view>
            <view class="row"><text>{{ c.receive }}</text><text class="amount">{{ money(quote.amountVnd) }}</text></view>
            <text class="muted">{{ displayBank(quote.bankName) }} · {{ quote.maskedAccount }}</text>
            <text class="muted">{{ c.expires }}: {{ displayDate(quote.expiresAt) }}</text>
            <text v-if="quoteExpired" class="muted" role="status">{{ c.quoteExpired }}</text>
            <text class="muted">{{ c.confirmNotice }}</text>
            <view class="action" role="button" tabindex="0" data-testid="bank-submit" :aria-disabled="busy || !canSubmit" @click="submit" @keydown.enter.prevent="submit" @keydown.space.prevent="submit"><text>{{ c.confirm }}</text></view>
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
import { dateLocale } from "@/i18n/format";
import { useApp } from "@/store/app";
import { apiClient } from "@/api/runtime";
import { captureRuntimeRevision, isCurrentRuntimeRevision, subscribeRuntimeRevision } from "@/api/order-api";
import { createBankWithdrawalApi, type BankConfig, type BankQuote, type BankOrder, type BankIntent, type BankRecovery } from "@/api/bank-withdrawal-api";
import { parseServerTimestamp } from "@/api/server-time";
import { isAmbiguousOutcome } from "@/api/errors";
import { bankAccountNotice, bankBeneficiaryReady, bankCanQuote, bankOrderOutcome } from "@/lib/bank-withdrawal-state";
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
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
let requestedOrder = "";
let revision = 0;
let alive = true;
let visible = false;
const pendingKey = () => `nexgrid.bank-withdraw.pending:${app.accountKey}`;
const money = (value: number) => value.toLocaleString(dateLocale(), { maximumFractionDigits: 6 });
const displayDate = (value: string) => new Date(parseServerTimestamp(value) ?? NaN).toLocaleString(dateLocale(), { timeZone: "Asia/Ho_Chi_Minh", timeZoneName: "short" });
const displayBank = (name: string) => name === "BANKQR" ? useTranslations.value.bankBinding.type : name;
const canQuote = computed(() => bankCanQuote(config.value, now.value));
const quoteExpired = computed(() => !!quote.value && (parseServerTimestamp(quote.value.expiresAt) ?? 0) <= now.value);
const canSubmit = computed(() => !!quote.value && !quoteExpired.value && !uncertain.value && config.value?.enabled === true
  && config.value.unresolvedIntent !== undefined && config.value.unresolvedIntent?.state !== "MULTIPLE" && bankBeneficiaryReady(config.value.beneficiary, now.value));
const multipleIntents = computed(() => config.value?.unresolvedIntent?.state === "MULTIPLE" ? config.value.unresolvedIntent.intents : []);
const accountStatus = computed(() => config.value?.beneficiary ? c.value.accountStatus[bankAccountNotice(config.value.beneficiary, now.value)] : "");
const outcome = computed(() => order.value ? bankOrderOutcome(order.value) : "review");
const terminal = computed(() => !!order.value && ["paid", "refunded"].includes(outcome.value));
const statusLabel = computed(() => c.value[outcome.value]);
function scope() {
  const id = ++revision, owner = app.accountKey, epoch = app.accountBindingEpoch, runtime = captureRuntimeRevision();
  return () => alive && revision === id && app.accountKey === owner && app.accountBindingEpoch === epoch && isCurrentRuntimeRevision(runtime);
}
function report(_err: unknown) { error.value = c.value.error; }
async function run(action: (current: () => boolean) => Promise<void>) {
  if (busy.value) return;
  const current = scope(); busy.value = true; error.value = "";
  try { await action(current); } catch (err) { if (current()) report(err); }
  finally { if (current()) busy.value = false; }
}
async function load() {
  await run(async current => {
    config.value = null;
    if (requestedOrder || order.value) {
      const loadedOrder = await api.get(requestedOrder || order.value!.withdrawalNo);
      if (current()) { order.value = loadedOrder; uncertain.value = false; }
      return;
    }
    const pending: unknown = uni.getStorageSync(pendingKey());
    if (typeof pending === "string" && /^BQ-[a-f0-9]{32}$/.test(pending)) {
      uncertain.value = true;
      const recovered = await api.recover(pending); if (!current()) return;
      applyRecovery(recovered);
      if (recovered.state === "COMMITTED") return;
    }
    const loaded = await api.config(); if (!current()) return; config.value = loaded;
    if (loaded.unresolvedIntent?.state === "MULTIPLE") { quote.value = null; uncertain.value = true; return; }
    const intent = loaded.unresolvedIntent?.intents[0];
    if (intent) {
      uncertain.value = true;
      const recovered = await api.recover(intent.quoteNo); if (!current()) return;
      applyRecovery(recovered);
    } else if (loaded.unresolvedIntent === null) {
      quote.value = null; uncertain.value = false;
    }
  });
}
function applyRecovery(recovered: BankRecovery) {
  if (recovered.state === "COMMITTED") { order.value = recovered; quote.value = null; uni.removeStorageSync(pendingKey()); }
  else if (recovered.state === "NOT_SUBMITTED") quote.value = recovered.quote;
  else { quote.value = null; uni.removeStorageSync(pendingKey()); if (config.value) config.value.unresolvedIntent = undefined; }
  uncertain.value = false;
}
async function openIntent(intent: BankIntent) {
  await run(async current => {
    uncertain.value = true;
    const recovered = await api.recover(intent.quoteNo); if (!current()) return;
    applyRecovery(recovered);
  });
}
async function verifyAccount() {
  if (!config.value?.beneficiary || uncertain.value || quote.value || multipleIntents.value.length) return;
  await run(async current => {
    await api.verify(); if (!current()) return;
    config.value = null;
    const loaded = await api.config(); if (current()) config.value = loaded;
  });
}
function manageBank() { if (!busy.value && !quote.value && !uncertain.value && !multipleIntents.value.length) navTo("/pages/me/wallet-cards-new?returnTo=%2Fpages%2Fme%2Fwallet-withdraw-bank"); }
async function getQuote() {
  if (!canQuote.value || !amount.value || uncertain.value || quote.value) return;
  await run(async current => {
    uncertain.value = true;
    try {
      const value = await api.quote(amount.value.trim().replace(",", "."));
      if (current()) { quote.value = value; uncertain.value = false; }
    } catch (error) {
      if (current() && !isAmbiguousOutcome(error)) uncertain.value = false;
      throw error;
    }
  });
}
async function submit() {
  if (!canSubmit.value) return;
  await run(async current => {
    const no = quote.value!.quoteNo;
    uni.setStorageSync(pendingKey(), no); // Recovery reference only; never persist bank details, OTPs or balances.
    if (uni.getStorageSync(pendingKey()) !== no) throw new Error("BANK_RECOVERY_NOT_DURABLE");
    uncertain.value = true;
    const value = await api.submit(no, `bank-submit:${no}`);
    if (!current()) return;
    order.value = value; quote.value = null; uncertain.value = false; uni.removeStorageSync(pendingKey());
  });
}
async function abandon() {
  if (!quote.value) return;
  await run(async current => {
    uncertain.value = true;
    const recovered = await api.abandon(quote.value!.quoteNo); if (!current()) return;
    applyRecovery(recovered);
    if (recovered.state === "ABANDONED" || recovered.state === "EXPIRED") {
      config.value = null;
      const loaded = await api.config(); if (current()) config.value = loaded;
    }
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
function stopTimer() { if (timer) clearInterval(timer); timer = undefined; }
onShow(() => { visible = true; now.value = Date.now(); stopTimer(); timer = setInterval(() => { now.value = Date.now(); }, 1000); void load(); });
onHide(() => { visible = false; stopTimer(); });
onUnload(() => { alive = false; visible = false; stopTimer(); stopRuntime(); revision++; });
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
