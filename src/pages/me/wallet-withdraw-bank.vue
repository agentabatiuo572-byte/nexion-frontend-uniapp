<template>
  <AppChassis active="me">
    <SubPageHeader back="/pages/me/wallet-withdraw-method" :title="c.title" :back-action="goBack" />
    <view class="bank-withdraw" :aria-busy="busy">
      <view v-if="error" class="notice danger" role="alert"><text>{{ error }}</text></view>
      <text v-if="busy && !silentRead" class="muted loading" role="status">{{ c.loading }}</text>
      <view v-if="remoteSessionReady && pendingAttempt" class="notice" role="status" data-testid="bank-pending-usdt">
        <text>{{ c.resumeUsdt }}</text>
        <view class="action secondary" role="button" tabindex="0" data-testid="bank-resume-usdt" :aria-disabled="busy" @click="openUsdt" @keydown.enter.prevent="openUsdt" @keydown.space.prevent="openUsdt"><text>USDT</text></view>
      </view>

      <template v-if="order">
        <view class="status-mark" aria-hidden="true"><text>{{ outcome === 'paid' ? '✓' : outcome === 'refunded' ? '↶' : '⋯' }}</text></view>
        <text class="screen-title" data-testid="bank-order-status" role="status" aria-live="polite" aria-atomic="true">{{ statusLabel }}</text>
        <text class="intro">{{ c.resultNotes[outcome] }}</text>
        <view class="amount-card"><text class="muted">{{ c.receiveLabel }}</text><text class="money">{{ formatAmount(order.bank.amountVnd, 'VND') }}</text><text class="currency">VND</text></view>
        <view class="account-card"><text class="muted">{{ useTranslations.bankBinding.accountRoutedLabel }}</text><text class="account-number">{{ order.bank.maskedAccount }}</text></view>
        <view class="details">
          <view class="row"><text>{{ c.orderNumber }}</text><view class="code-value"><text>{{ order.withdrawalNo }}</text><CopyCodeButton :value="order.withdrawalNo" :label="c.orderNumber" /></view></view>
          <view class="row"><text>{{ c.totalDebit }}</text><text>{{ money(order.bank.amountUsdt) }} USDT</text></view>
          <view class="row"><text>{{ c.fee }}</text><text>{{ money(order.bank.feeUsdt) }}</text></view>
          <view v-if="outcome === 'refunded'" class="row"><text>{{ c.refundAmount }}</text><text>{{ money(order.settlementEvidence!.amountUsdt!) }}</text></view>
          <view v-if="terminal && order.settlementEvidence?.checkedAt" class="row"><text>{{ c.confirmedAt }}</text><text>{{ displayDate(order.settlementEvidence.checkedAt) }}</text></view>
        </view>
        <view v-if="terminal" class="action secondary" role="button" tabindex="0" data-testid="bank-new" :aria-disabled="busy || !newWithdrawalAllowed" :style="{ opacity: silentRead ? 1 : undefined }" @click="startNew" @keydown.enter.prevent="startNew" @keydown.space.prevent="startNew"><text>{{ c.newWithdrawal }}</text></view>
        <view class="action secondary" role="button" tabindex="0" :aria-disabled="busy" :style="{ opacity: silentRead ? 1 : undefined }" @click="backToWallet" @keydown.enter.prevent="backToWallet" @keydown.space.prevent="backToWallet"><text>{{ c.backToWallet }}</text></view>
      </template>

      <template v-else-if="uncertain || displayIntents.length || (displayConfig && displayConfig.unresolvedIntent === undefined)">
        <text class="screen-title">{{ c.title }}</text>
        <view v-if="!busy || !uncertain" class="notice" role="alert"><text>{{ displayIntents.length ? c.multipleIntents : uncertain ? c.unknown : c.recoveryUnavailable }}</text></view>
        <view v-for="intent in displayIntents" :key="intent.quoteNo" class="action secondary" role="button" tabindex="0" :aria-disabled="busy" @click="openIntent(intent)" @keydown.enter.prevent="openIntent(intent)" @keydown.space.prevent="openIntent(intent)"><text>{{ intent.withdrawalNo || intent.quoteNo }}</text></view>
        <view v-if="!uncertain" class="action primary" role="button" tabindex="0" data-testid="bank-refresh" :aria-disabled="busy" @click="load" @keydown.enter.prevent="load" @keydown.space.prevent="load"><text>{{ c.reload }}</text></view>
      </template>

      <template v-else-if="displayConfig && remoteSessionReady && (!pendingAttempt || quote)">
        <text class="vh" role="heading" aria-level="1">{{ title }}</text>
        <!-- P-45 account step: the bound account as a physical bank card, then the binding rule. -->
        <template v-if="!quote && formStep === 'account'">
          <view class="bcard" :aria-label="`${c.recipientTitle} ${recipient?.maskedAccount ?? '—'}`">
            <view class="bcard__top">
              <view class="bcard__bk" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M12 3 3 8h18z" /></svg></view>
              <text class="bcard__nm">{{ c.recipientSubtitle }}</text>
              <view class="bcard__tag" :class="{ warn: !displayConfig.enabled || !displayConfig.beneficiary?.canWithdraw }" data-testid="bank-account-status" role="status"><text>{{ !displayConfig.enabled ? c.unavailable : !displayConfig.beneficiary ? c.unbound : displayConfig.beneficiary.canWithdraw ? c.available : accountStatus }}</text></view>
            </view>
            <view class="bcard__bot">
              <view><text class="vh">{{ c.recipientTitle }}</text><text class="bcard__lb">{{ useTranslations.bankBinding.accountRoutedLabel }}</text><text class="bcard__no">{{ recipient ? dots(recipient.maskedAccount) : "—" }}</text></view>
              <text class="bcard__cur">VND</text>
            </view>
          </view>
        </template>
        <!-- Amount / quote steps: the account as a compact row. -->
        <view v-else-if="recipient" class="acct">
          <view class="acct__ico" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M12 3 3 8h18z" /></svg></view>
          <view class="acct__grow"><text class="k">{{ c.recipientTitle }}</text><text class="acct__no">{{ dots(recipient.maskedAccount) }}</text></view>
          <!-- Changing the account is offered before a quote exists; a live quote is left with "重新填写金额" first. -->
          <view v-if="!quote" class="acct__change nx-frosted-button" role="button" tabindex="0" :aria-disabled="busy" :aria-label="c.changeAccount" @click="goBack" @keydown.enter.prevent="goBack" @keydown.space.prevent="goBack"><text>{{ c.change }}</text></view>
        </view>
        <view v-if="(displayConfig.beneficiary && !hasVerifiedBankIdentity(displayConfig.beneficiary)) || (quote && !hasVerifiedBankIdentity(quote))" class="notice" role="status"><text>{{ c.bankRoutingUnverified }}</text></view>

        <template v-if="quote">
          <view class="stage">
            <view class="aura" aria-hidden="true"><view /><view /></view>
            <view class="slab nx-tint">
              <view class="slab__head"><text class="k">{{ c.amount }}</text></view>
              <text class="slab__amt">{{ money(quote.amountUsdt) }}<text class="slab__unit">USDT</text></text>
              <text v-if="displayConfig.policy && displayConfig.capacity" class="hint">{{ format(c.availableLabel, { amount: money(displayConfig.capacity.maxWithdrawableUsdt) }) }} · {{ format(c.rangeLabel, { min: money(displayConfig.policy.minAmountUsd), max: money(displayConfig.policy.maxAmountUsd) }) }}</text>
            </view>
          </view>
          <view class="ticket" :aria-label="c.quoteTitle">
            <view class="ticket__top">
              <text class="ticket__title">{{ c.quoteTitle }}</text>
              <view class="cdw" role="timer" :aria-label="`${c.expiresIn} ${quoteExpired ? c.quoteExpired : format(c.seconds, { s: secondsLeft })}`">
                <text class="k">{{ c.expiresIn }}</text>
                <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle class="cdw__trk" cx="11" cy="11" r="10" /><circle class="cdw__val" cx="11" cy="11" r="10" :style="{ strokeDashoffset: `${(63 * (1 - quoteRatio)).toFixed(1)}` }" /></svg>
                <text data-testid="bank-countdown" class="cdw__s" :class="{ warn: quoteExpired }">{{ quoteExpired ? c.quoteExpired : format(c.seconds, { s: secondsLeft }) }}</text>
              </view>
            </view>
            <view class="ticket__rows">
              <view class="qrow"><text class="k">{{ c.fee }}</text><text class="qrow__v">{{ money(quote.feeUsdt) }}</text></view>
              <view class="qrow"><text class="k">{{ c.net }}</text><text class="qrow__v">{{ money(quote.netUsdt) }}</text></view>
              <view class="qrow"><text class="k">{{ c.rate }}</text><text class="qrow__v">{{ formatHowNumber(quote.rateVnd, dateLocale()) }}</text></view>
            </view>
            <view class="tear" aria-hidden="true" />
            <view class="ticket__net">
              <text class="k">{{ c.receiveLabel }}（VND）</text>
              <text class="ticket__vnd">{{ formatAmount(quote.amountVnd, 'VND') }}₫</text>
              <text class="hint">{{ c.feeIncluded }}</text>
            </view>
          </view>
          <text v-if="displayConfig.capacity" class="hint pad">{{ format(c.dailyLabel, { remaining: displayConfig.capacity.dailyRemainingCount, total: displayConfig.capacity.dailyLimitCount }) }}</text>
          <view v-if="!quoteExpired" class="consent" role="checkbox" tabindex="0" data-testid="bank-consent" :aria-checked="accepted" :aria-disabled="busy" @click="toggleConsent" @keydown.enter.prevent="toggleConsent" @keydown.space.prevent="toggleConsent"><view class="checkbox" :class="{ checked: accepted }" aria-hidden="true"><svg v-if="accepted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg></view><text>{{ c.consent }}</text></view>
          <text class="hint pad">{{ c.confirmNotice }}</text>
          <view class="action text-link" role="button" tabindex="0" data-testid="bank-abandon" :aria-disabled="busy" @click="abandon" @keydown.enter.prevent="abandon" @keydown.space.prevent="abandon"><text>{{ c.backToAmount }}</text></view>
        </template>

        <template v-else-if="formStep === 'account'">
          <view class="note"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-9h.01" /></svg><text>{{ displayConfig.beneficiary ? c.bindingNotice : c.unboundNotice }}</text></view>
          <view v-if="displayConfig.enabled && displayConfig.beneficiary && (!displayConfig.policy || !displayConfig.capacity)" class="notice" role="status"><text>{{ c.capacityUnavailable }}</text></view>
          <view v-else-if="displayConfig.capacity && !displayConfig.capacity.withdrawalEnabled" class="notice"><text>{{ c.unavailable }}</text></view>
        </template>

        <template v-else>
          <view class="stage">
            <view class="aura" aria-hidden="true"><view /><view /></view>
            <view class="slab nx-tint">
              <view class="slab__head">
                <text class="k">{{ c.amount }}</text>
                <view class="use-max" role="button" tabindex="0" data-testid="bank-max" :aria-disabled="busy || !canContinue || maxAmount <= 0" @click="useMax" @keydown.enter.prevent="useMax" @keydown.space.prevent="useMax"><text>{{ c.all }}</text></view>
              </view>
              <view class="amount-input">
                <input data-testid="bank-amount" v-model="amount" type="text" inputmode="decimal" :disabled="busy || !canContinue" placeholder="0.00" :aria-label="c.amount" :style="{ width: `calc(${Math.max(amount.length, 4)} * (1ch - .02em) + 4px)` }" />
                <text class="slab__unit">USDT</text>
              </view>
              <view class="limits" v-if="displayConfig.policy && displayConfig.capacity">
                <text><text data-testid="bank-balance">{{ format(c.availableLabel, { amount: money(displayConfig.capacity.maxWithdrawableUsdt) }) }}</text> · <text data-testid="bank-single-limit">{{ format(c.rangeLabel, { min: money(displayConfig.policy.minAmountUsd), max: money(displayConfig.policy.maxAmountUsd) }) }}</text></text>
              </view>
              <text v-if="amountError" class="error-text" role="alert">{{ amountError }}</text>
            </view>
          </view>
          <view v-if="displayConfig.policy && displayConfig.capacity" class="daily">
            <text>{{ format(c.dailyLabel, { remaining: displayConfig.capacity.dailyRemainingCount, total: displayConfig.capacity.dailyLimitCount }) }}</text>
            <view class="refresh-limits" role="button" tabindex="0" data-testid="bank-refresh-limits" :aria-disabled="busy" @click="load" @keydown.enter.prevent="load" @keydown.space.prevent="load"><text>{{ c.refreshLimits }}</text></view>
          </view>
          <view v-if="displayConfig.capacity?.dailyRemainingCount === 0" class="notice" role="status"><text>{{ c.dailyExhausted }} {{ displayDate(displayConfig.capacity.dailyCountResetAt) }}</text></view>
          <text class="hint pad">{{ c.feeIncluded }} {{ feeRule }}</text>
          <view class="action text-link" role="button" tabindex="0" :aria-disabled="busy" @click="goBack" @keydown.enter.prevent="goBack" @keydown.space.prevent="goBack"><text>{{ c.backToAccount }}</text></view>
        </template>
        <view v-if="error || (!quote && displayConfig.enabled && (!displayConfig.policy || !displayConfig.capacity))" class="action secondary" role="button" tabindex="0" data-testid="bank-refresh" :aria-disabled="busy" @click="load" @keydown.enter.prevent="load" @keydown.space.prevent="load"><text>{{ c.reload }}</text></view>
        <view class="bar-space" />
      </template>
      <template v-else-if="requestedOrder === null && !pendingAttempt">
        <text class="screen-title" role="heading" aria-level="1">{{ title }}</text>
        <text class="intro">{{ formStep === 'amount' ? c.amountHint : c.recipientSubtitle }}</text>
        <template v-if="formStep === 'account'">
          <view class="account-card"><text class="muted">{{ c.recipientTitle }}</text><text class="account-number">—</text><text class="bank-name">—</text></view>
          <view class="action primary is-placeholder" aria-hidden="true" data-testid="bank-continue"><text>{{ c.continueWithdrawal }}</text></view>
        </template>
        <template v-else>
          <text class="field-label">{{ c.totalDebit }} · USDT</text>
          <view class="amount-input"><input data-testid="bank-amount" type="text" inputmode="decimal" disabled placeholder="—" :aria-label="c.amount" /><view class="use-max is-placeholder" aria-hidden="true"><text>{{ c.all }}</text></view></view>
          <view class="notice"><text>{{ c.feeIncluded }}</text></view>
          <view class="action primary is-placeholder" aria-hidden="true" data-testid="bank-quote"><text>{{ c.quote }}</text></view>
          <view class="action secondary" role="button" tabindex="0" :aria-disabled="busy" @click="goBack"><text>{{ c.backToAccount }}</text></view>
        </template>
        <view v-if="error" class="action secondary" role="button" tabindex="0" data-testid="bank-refresh" :aria-disabled="busy" @click="load" @keydown.enter.prevent="load" @keydown.space.prevent="load"><text>{{ c.reload }}</text></view>
      </template>
      <view v-else-if="error" class="action primary" role="button" tabindex="0" data-testid="bank-refresh" :aria-disabled="busy" @click="load" @keydown.enter.prevent="load" @keydown.space.prevent="load"><text>{{ c.reload }}</text></view>
    </view>
    <!-- Main actions in the fixed bottom bar (DS-30): account → change + continue; amount → quote; quote → confirm. -->
    <template #pageFixed>
      <view v-if="displayConfig && remoteSessionReady && (!pendingAttempt || quote) && !order && !(uncertain || displayIntents.length || displayConfig.unresolvedIntent === undefined)" class="bar nx-glass-bar">
        <template v-if="quote">
          <view v-if="!quoteExpired" class="action primary" role="button" tabindex="0" data-testid="bank-submit" :aria-disabled="busy || !canSubmit" @click="submit" @keydown.enter.prevent="submit" @keydown.space.prevent="submit"><text>{{ c.confirm }}</text></view>
        </template>
        <template v-else-if="formStep === 'account'">
          <view class="action secondary nx-frosted-button" role="button" tabindex="0" :aria-disabled="busy" @click="manageBank" @keydown.enter.prevent="manageBank" @keydown.space.prevent="manageBank"><text>{{ displayConfig.beneficiary ? c.changeAccount : c.addAccount }}</text></view>
          <view v-if="displayConfig.beneficiary" class="action primary" role="button" tabindex="0" data-testid="bank-continue" :aria-disabled="busy || !canContinue" @click="continueWithdrawal" @keydown.enter.prevent="continueWithdrawal" @keydown.space.prevent="continueWithdrawal"><text>{{ c.continueWithdrawal }}</text></view>
        </template>
        <view v-else class="action primary" role="button" tabindex="0" data-testid="bank-quote" :aria-disabled="busy || !canContinue || !!amountProblem" @click="getQuote" @keydown.enter.prevent="getQuote" @keydown.space.prevent="getQuote"><text>{{ c.quote }}</text></view>
      </view>
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import { formatHowNumber } from "@/lib/rank-how-content";
import { formatFinanceAmount as formatAmount } from "@/lib/finance-amount-display";
import { computed, ref, watch } from "vue";
import { toast } from "@/store/ui";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { onLoad, onShow, onHide, onUnload } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import CopyCodeButton from "@/components/copy-code-button.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { dateLocale } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { apiClient, remoteApiEnabled, sessionVault } from "@/api/runtime";
import { binarySessionReady } from "@/lib/binary-session-ready";
import { readWithdrawAttempt } from "@/lib/withdraw-attempt";
import { foregroundReadAllowed } from "@/lib/foreground-read";
import { captureRuntimeRevision, isCurrentRuntimeRevision, subscribeRuntimeRevision } from "@/api/order-api";
import { createBankWithdrawalApi, hasVerifiedBankIdentity, type BankConfig, type BankQuote, type BankOrder, type BankIntent, type BankRecovery } from "@/api/bank-withdrawal-api";
import { parseServerTimestamp } from "@/api/server-time";
import { formatBankDateTime } from "@/lib/bank-date";
import { bankAccountNotice, bankBeneficiaryReady, bankCanQuote, bankOrderOutcome, bankAmountError, bankMaximumAmount } from "@/lib/bank-withdrawal-state";
import { navBack, navTo, takeNavigationQuery } from "@/lib/route";

const c = computed(() => useTranslations.value.bankWithdrawal);
const useTranslations = useT();
const app = useApp();
const auth = useAuth();
const remoteSessionReady = computed(() => binarySessionReady({
  remote: remoteApiEnabled,
  authenticated: auth.isAuthenticated,
  accountId: auth.accountId,
  appAccountKey: app.accountKey,
  sessionUserId: sessionVault.read()?.user.userId ?? null,
}));
const pendingAttempt = ref(remoteSessionReady.value ? readWithdrawAttempt(app.accountKey) : null);
const newWithdrawalAllowed = computed(() => remoteSessionReady.value && !pendingAttempt.value);
function refreshPendingAttempt() {
  pendingAttempt.value = remoteSessionReady.value ? readWithdrawAttempt(app.accountKey) : null;
}
watch([() => app.accountKey, () => app.accountBindingEpoch, remoteSessionReady], refreshPendingAttempt, { flush: "sync" });
const api = createBankWithdrawalApi(apiClient);
const config = ref<BankConfig | null>(null);
const quote = ref<BankQuote | null>(null);
const order = ref<BankOrder | null>(null);
const busy = ref(false);
const silentRead = ref(false);
const error = ref("");
const configPresentation = ref<{ owner: string; epoch: number; value: BankConfig } | null>(null);
const displayConfig = computed(() => {
  const snapshot = configPresentation.value;
  if (!snapshot || snapshot.owner !== app.accountKey || snapshot.epoch !== app.accountBindingEpoch) return null;
  return config.value ?? (busy.value && !error.value ? snapshot.value : null);
});
const uncertain = ref(false);
const pendingQuoteNo = ref<string | null>(null);
const amount = ref("");
const formStep = ref<"account" | "amount">("account");
const accepted = ref(false);
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
let requestedOrder: string | null = null;
let lastCapacityResetRead = "";
let revision = 0;
let inFlight: { current: () => boolean; orderNo: string | null } | null = null;
let alive = true;
const visible = ref(false);
const pendingKey = () => `nexgrid.bank-withdraw.pending:${app.accountKey}`;
const money = (value: number) => formatAmount(value);
const displayDate = (value: string) => formatBankDateTime(value, dateLocale());
const quoteExpired = computed(() => !!quote.value && (parseServerTimestamp(quote.value.expiresAt) ?? 0) <= now.value);
const canSubmit = computed(() => newWithdrawalAllowed.value && accepted.value && !!quote.value && !quoteExpired.value && !uncertain.value && config.value?.enabled === true
  && config.value.unresolvedIntent !== undefined && config.value.unresolvedIntent?.state !== "MULTIPLE"
  && bankBeneficiaryReady(config.value.beneficiary) && hasVerifiedBankIdentity(quote.value));
const multipleIntents = computed(() => config.value?.unresolvedIntent?.state === "MULTIPLE" ? config.value.unresolvedIntent.intents : []);
const displayIntents = computed(() => displayConfig.value?.unresolvedIntent?.state === "MULTIPLE" ? displayConfig.value.unresolvedIntent.intents : []);
const accountStatus = computed(() => displayConfig.value?.beneficiary ? c.value.accountStatus[bankAccountNotice(displayConfig.value.beneficiary)] : "");
const outcome = computed(() => order.value ? bankOrderOutcome(order.value) : "review");
const terminal = computed(() => !!order.value && ["paid", "refunded"].includes(outcome.value));
const statusLabel = computed(() => c.value[outcome.value]);
const recipient = computed(() => order.value?.bank ?? quote.value ?? displayConfig.value?.beneficiary);
const canContinue = computed(() => newWithdrawalAllowed.value && bankCanQuote(config.value) && !!config.value?.policy && !!config.value?.capacity && config.value.capacity.withdrawalEnabled);
const amountProblem = computed(() => bankAmountError(amount.value, config.value));
const maxAmount = computed(() => bankMaximumAmount(config.value));
// Card/row tail as "•••• 1234"; the masked prefix comes from the server.
function dots(masked: string): string { return masked.replace(/^[*•]+/, "•••• "); }
// Quote ring: share of the quote window still left. The quote carries only its expiry, so the window starts
// when this page first sees the quote; the seconds shown are the server countdown itself.
const quoteIssuedAt = ref<number | null>(null);
watch(() => quote.value?.quoteNo, (quoteNo) => { quoteIssuedAt.value = quoteNo ? now.value : null; });
const quoteRatio = computed(() => {
  const end = parseServerTimestamp(quote.value?.expiresAt) ?? 0, start = quoteIssuedAt.value ?? 0;
  return end > start ? Math.min(1, Math.max(0, (end - now.value) / (end - start))) : 0;
});
const secondsLeft = computed(() => Math.max(0, Math.ceil(((parseServerTimestamp(quote.value?.expiresAt) ?? 0) - now.value) / 1000)));
const title = computed(() => quote.value ? c.value.confirmTitle : formStep.value === "amount" ? c.value.amountTitle : c.value.recipientTitle);
const feeRule = computed(() => displayConfig.value?.policy ? format(c.value.feeRule, { rate: formatHowNumber(displayConfig.value.policy.feeRatePct, dateLocale()), min: money(displayConfig.value.policy.feeMinUsd), max: money(displayConfig.value.policy.feeMaxUsd) }) : "");
const amountError = computed(() => {
  const problem = silentRead.value ? bankAmountError(amount.value, displayConfig.value) : amountProblem.value;
  if (!amount.value || !problem) return "";
  return c.value.amountErrors[problem];
});
function format(template: string, values: Record<string, string | number>) { return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? "")); }
function continueWithdrawal() { if (!busy.value && canContinue.value) formStep.value = "amount"; }
function useMax() { if (!busy.value && canContinue.value && maxAmount.value > 0) amount.value = maxAmount.value.toFixed(6).replace(/\.?0+$/, ""); }
function toggleConsent() { if (!busy.value && !quoteExpired.value) accepted.value = !accepted.value; }
function goBack() {
  if (busy.value) return;
  // The quote reference is saved, so leaving is safe; the result is read again on return.
  if (uncertain.value) { navBack("/pages/me/wallet-withdraw-method"); return; }
  if (quote.value) { void abandon(); return; }
  if (!order.value && formStep.value === "amount") { formStep.value = "account"; return; }
  navBack("/pages/me/wallet-withdraw-method");
}
function backToWallet() { if (!busy.value) navTo("/pages/me/me"); }
function openUsdt() { if (!busy.value && remoteSessionReady.value && pendingAttempt.value) navTo("/pages/me/wallet-withdraw"); }
function scope() {
  const id = ++revision, owner = app.accountKey, epoch = app.accountBindingEpoch, runtime = captureRuntimeRevision();
  return () => alive && revision === id && app.accountKey === owner && app.accountBindingEpoch === epoch && isCurrentRuntimeRevision(runtime);
}
function report(_err: unknown) {
  if (!config.value) configPresentation.value = null;
  error.value = c.value.error;
}
async function run(action: (current: () => boolean) => Promise<void>, quietRead = false) {
  await orderRead?.catch(() => {}); // Continue the explicit action even when the read failed.
  if (!canReadVisibleBankPage()) return;
  if (busy.value) return;
  const current = scope(); busy.value = true; silentRead.value = quietRead; error.value = "";
  inFlight = { current, orderNo: requestedOrder ?? order.value?.withdrawalNo ?? null };
  try { await action(current); } catch (err) { if (current()) report(err); }
  finally { if (inFlight?.current === current) inFlight = null; if (current()) { busy.value = false; silentRead.value = false; } }
}
async function load() {
  await run(async current => {
    const owner = app.accountKey, epoch = app.accountBindingEpoch;
    config.value = null; accepted.value = false;
    if (requestedOrder !== null || order.value) {
      const orderNo = requestedOrder ?? order.value!.withdrawalNo;
      if (!/^WD-[A-Z0-9]+$/.test(orderNo)) throw new Error("BANK_ORDER_ROUTE_INVALID");
      const loadedOrder = await api.get(orderNo);
      if (current()) { order.value = loadedOrder; uncertain.value = false; }
      return;
    }
    const pending: unknown = uni.getStorageSync(pendingKey());
    if (typeof pending === "string" && /^BQ-[a-f0-9]{32}$/.test(pending)) {
      uncertain.value = true; pendingQuoteNo.value = pending;
      const recovered = await api.recover(pending); if (!current()) return;
      applyRecovery(recovered);
      if (recovered.state === "COMMITTED") return;
    }
    const loaded = await api.config(); if (!current()) return; config.value = loaded;
    configPresentation.value = { owner, epoch, value: loaded };
    if (loaded.unresolvedIntent?.state === "MULTIPLE") { quote.value = null; uncertain.value = true; return; }
    const intent = loaded.unresolvedIntent?.intents[0];
    if (intent) {
      uncertain.value = true; pendingQuoteNo.value = intent.quoteNo;
      const recovered = await api.recover(intent.quoteNo); if (!current()) return;
      applyRecovery(recovered);
    } else if (loaded.unresolvedIntent === null) {
      quote.value = null; uncertain.value = false;
    }
  }, order.value !== null || config.value !== null);
}

function canReadVisibleBankPage(): boolean {
  return visible.value && remoteSessionReady.value && auth.isAuthenticated && foregroundReadAllowed();
}

function canPollOrder(): boolean {
  return canReadVisibleBankPage() && !!order.value
    && !terminal.value;
}

function canRecoverQuote(): boolean {
  return canReadVisibleBankPage() && uncertain.value && !order.value && !!pendingQuoteNo.value && !multipleIntents.value.length;
}
const readingOrder = ref(false);
let orderRead: Promise<void> | null = null;
let orderReadGeneration = 0;
function pollOrder(): Promise<void> {
  if (orderRead) return orderRead;
  const snapshot = order.value, quoteNo = pendingQuoteNo.value;
  const session = sessionVault.read();
  if ((!canPollOrder() && !canRecoverQuote()) || busy.value
      || !session?.accessToken || app.accountKey !== `user:${session.user.userId}`) return Promise.resolve();
  const readRevision = revision;
  const generation = orderReadGeneration;
  const runtime = captureRuntimeRevision(), owner = app.accountKey, epoch = app.accountBindingEpoch;
  const current = () => generation === orderReadGeneration && (canPollOrder() || canRecoverQuote())
    && order.value === snapshot && pendingQuoteNo.value === quoteNo
    && revision === readRevision && app.accountKey === owner && app.accountBindingEpoch === epoch
    && isCurrentRuntimeRevision(runtime);
  readingOrder.value = true;
  const read = Promise.resolve().then(async () => {
    if (!current()) return;
    if (snapshot) {
      const loaded = await api.get(snapshot.withdrawalNo);
      if (!current()) return;
      order.value = loaded;
      if (terminal.value) toast.success(statusLabel.value);
    } else if (quoteNo) {
      const recovered = await api.recover(quoteNo);
      if (!current()) return;
      if (recovered.state !== "COMMITTED" && !config.value) {
        const loaded = await api.config();
        if (!current()) return;
        config.value = loaded; configPresentation.value = { owner, epoch, value: loaded };
      }
      applyRecovery(recovered); error.value = "";
      if (recovered.state === "COMMITTED") toast.info(statusLabel.value);
      else if (recovered.state === "NOT_SUBMITTED") toast.info(c.value.confirmTitle, c.value.confirmHint);
      else toast.info(c.value.intentClosed);
    }
  }).finally(() => {
    if (orderRead === read) { orderRead = null; readingOrder.value = false; }
  });
  orderRead = read;
  return read;
}

useAutoRecovery({
  failed: () => (canPollOrder() || canRecoverQuote()) && !busy.value && !readingOrder.value,
  retry: pollOrder,
  repeatMs: 15_000,
});

watch([visible, foregroundReadAllowed, remoteSessionReady, () => auth.isAuthenticated], ([isVisible, allowed, sessionReady, authenticated], [wasVisible]) => {
  if (!isVisible || !allowed || !sessionReady || !authenticated) return;
  // Orders and unknown results have one read owner; load() would reset consent.
  if (order.value || uncertain.value) return;
  if (!wasVisible || (!config.value && !quote.value)) void load();
});

function applyRecovery(recovered: BankRecovery) {
  accepted.value = false;
  if (recovered.state === "COMMITTED") { order.value = recovered; quote.value = null; uni.removeStorageSync(pendingKey()); }
  else if (recovered.state === "NOT_SUBMITTED") quote.value = recovered.quote;
  else { quote.value = null; uni.removeStorageSync(pendingKey()); if (config.value) config.value.unresolvedIntent = undefined; }
  uncertain.value = false; pendingQuoteNo.value = null;
}
async function openIntent(intent: BankIntent) {
  await run(async current => {
    uncertain.value = true; pendingQuoteNo.value = intent.quoteNo;
    if (config.value) config.value.unresolvedIntent = { state: intent.state, intents: [intent],
      quoteNo: intent.quoteNo, withdrawalNo: intent.withdrawalNo };
    const recovered = await api.recover(intent.quoteNo); if (!current()) return;
    applyRecovery(recovered);
  });
}
function manageBank() { if (!busy.value && !quote.value && !uncertain.value && !multipleIntents.value.length) navTo("/pages/me/wallet-cards-new?returnTo=%2Fpages%2Fme%2Fwallet-withdraw-bank"); }
async function getQuote() {
  refreshPendingAttempt();
  if (!canContinue.value || amountProblem.value || uncertain.value || quote.value) return;
  await run(async current => {
    refreshPendingAttempt();
    if (!newWithdrawalAllowed.value) return;
    const value = await api.quote(amount.value.trim().replace(",", "."));
    if (current()) { quote.value = value; accepted.value = false; }
  });
}
async function submit() {
  refreshPendingAttempt();
  if (!canSubmit.value || uncertain.value) return;
  await run(async current => {
    refreshPendingAttempt();
    if (!newWithdrawalAllowed.value) return;
    const no = quote.value!.quoteNo;
    uni.setStorageSync(pendingKey(), no); // Recovery reference only; never persist bank details, OTPs or balances.
    if (uni.getStorageSync(pendingKey()) !== no) throw new Error("BANK_RECOVERY_NOT_DURABLE");
    uncertain.value = true; pendingQuoteNo.value = no;
    const value = await api.submit(no, `bank-submit:${no}`);
    if (!current()) return;
    order.value = value; quote.value = null; uncertain.value = false; pendingQuoteNo.value = null; uni.removeStorageSync(pendingKey());
  });
}
async function abandon() {
  if (!quote.value || busy.value || uncertain.value) return;
  await run(async current => {
    uncertain.value = true; pendingQuoteNo.value = quote.value!.quoteNo;
    const recovered = await api.abandon(quote.value!.quoteNo); if (!current()) return;
    applyRecovery(recovered);
    if (recovered.state === "ABANDONED" || recovered.state === "EXPIRED") {
      config.value = null; formStep.value = "amount";
      const owner = app.accountKey, epoch = app.accountBindingEpoch;
      const loaded = await api.config(); if (current()) {
        config.value = loaded; configPresentation.value = { owner, epoch, value: loaded };
      }
    }
  });
}
function startNew() {
  refreshPendingAttempt();
  if (!newWithdrawalAllowed.value || !terminal.value || busy.value) return;
  order.value = null; quote.value = null; requestedOrder = null; amount.value = ""; formStep.value = "account"; accepted.value = false; void load();
}
function clearScope() {
  pendingQuoteNo.value = null; orderReadGeneration++;
  revision++; configPresentation.value = null; config.value = null; quote.value = null; order.value = null; busy.value = false; silentRead.value = false; error.value = ""; uncertain.value = false;
  amount.value = ""; formStep.value = "account"; accepted.value = false; lastCapacityResetRead = "";
}
function invalidate() {
  if (busy.value && inFlight?.current() && inFlight.orderNo === (requestedOrder ?? order.value?.withdrawalNo ?? null)) return;
  clearScope();
  if (alive && canReadVisibleBankPage()) void load();
}
watch(() => [app.accountKey, app.accountBindingEpoch] as const, clearScope, { flush: "sync" });
watch(() => [app.accountKey, app.accountBindingEpoch] as const, invalidate);
const stopRuntime = subscribeRuntimeRevision(invalidate);
onLoad(params => {
  const fallback = new URLSearchParams(takeNavigationQuery("/pages/me/wallet-withdraw-bank")).get("order");
  const value = params?.order ?? fallback;
  requestedOrder = value == null ? null : typeof value === "string" ? value : "";
});
watch(now, () => {
  const resetAt = config.value?.capacity?.dailyCountResetAt;
  if (!canReadVisibleBankPage() || busy.value || quote.value || order.value || uncertain.value || !resetAt || lastCapacityResetRead === resetAt) return;
  if ((parseServerTimestamp(resetAt) ?? Infinity) <= now.value) { lastCapacityResetRead = resetAt; void load(); }
});
function stopTimer() { if (timer) clearInterval(timer); timer = undefined; }
onShow(() => {
  refreshPendingAttempt();
  visible.value = true; now.value = Date.now(); stopTimer(); timer = setInterval(() => { now.value = Date.now(); }, 1000);
});
onHide(() => { visible.value = false; orderReadGeneration++; stopTimer(); });
onUnload(() => { alive = false; visible.value = false; stopTimer(); stopRuntime(); revision++; });
</script>

<style scoped>
.bank-withdraw { padding: 0 16px 40px; color: var(--v5-ink); font-family: var(--font-v5); }
.screen-title { display: block; font-size: 26px; line-height: 1.3; font-weight: 600; letter-spacing: -.5px; overflow-wrap: anywhere; }
.intro { display: block; margin: 10px 0 24px; color: var(--v5-ink-3); font-size: var(--ui-type-list-subtitle); line-height: 1.6; }
.muted { display: block; color: var(--v5-ink-3); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.loading { margin-bottom: 12px; }
.account-card, .amount-card { border-radius: 16px; background: var(--v5-surface-2); padding: 18px; margin: 20px 0; }
.account-number { display: block; font-size: 20px; letter-spacing: 1px; font-variant-numeric: tabular-nums; margin: 6px 0; overflow-wrap: anywhere; }
.bank-name { font-size: var(--ui-type-body); }
.chip { display: inline-block; border-radius: 999px; background: var(--v5-surface-2); color: var(--v5-brand); padding: 4px 10px; font-size: 12px; }
.notice { border-left: 2px solid var(--v5-warning); padding-left: 12px; color: var(--v5-ink-2); font-size: 12px; line-height: 1.7; margin: 20px 0; }
.danger, .error-text { color: var(--v5-danger); }
.error-text { display: block; font-size: 12px; margin-top: 10px; }
.warn { color: var(--v5-warning); }
.action { min-height: 50px; display: flex; align-items: center; justify-content: center; text-align: center; padding: 12px 20px; border-radius: 999px; font-size: var(--ui-type-button); font-weight: 600; cursor: pointer; box-sizing: border-box; }
.primary { background: var(--v5-brand); color: var(--v5-on-brand); margin-top: 24px; }
.secondary { background: var(--v5-surface-2); color: var(--v5-ink); margin-top: 12px; }
[aria-disabled="true"], .is-placeholder { opacity: .4; cursor: default; }
.action:focus-visible, .use-max:focus-visible, .consent:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 3px; }
.field-label { display: block; font-size: 12px; color: var(--v5-ink-2); margin: 18px 0 6px; }
.amount-input { display: flex; align-items: center; gap: 8px; border: 1px solid var(--v5-border-strong); border-radius: 12px; padding: 8px 12px; }
.amount-input input { flex: 1; min-width: 0; font-size: 26px; height: 44px; color: var(--v5-ink); }
.use-max { min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; color: var(--v5-brand); font-size: var(--ui-type-body); cursor: pointer; }
.limits { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--v5-ink-3); margin-top: 12px; line-height: 1.5; }
.refresh-limits { min-height: 44px; display: flex; align-items: center; color: var(--v5-brand); cursor: pointer; align-self: flex-start; }
.fee-rule { display: block; margin-top: 6px; }
.details { margin: 20px 0; }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--v5-border); font-size: var(--ui-type-list-subtitle); }
.row > text:first-child { color: var(--v5-ink-3); font-size: 12px; }
.row > text:last-child { max-width: 65%; overflow-wrap: anywhere; text-align: right; font-variant-numeric: tabular-nums; }
.code-value { display: flex; align-items: center; gap: var(--v5-space-2); max-width: 65%; min-width: 0; }
.code-value > text { min-width: 0; overflow-wrap: anywhere; text-align: right; font-variant-numeric: tabular-nums; }
.money { font-family: var(--font-amount); display: block; margin-top: 8px; font-size: 34px; font-weight: 600; line-height: 1.25; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.currency { display: block; margin-top: 8px; font-size: 12px; color: var(--v5-ink-3); }
.consent { display: flex; align-items: flex-start; gap: 10px; min-height: 44px; font-size: 12px; line-height: 1.6; cursor: pointer; margin-bottom: 10px; }
.checkbox { width: 20px; height: 20px; flex-shrink: 0; border: 1px solid var(--v5-border-strong); border-radius: 4px; display: flex; align-items: center; justify-content: center; }
.checkbox.checked { background: var(--v5-brand); color: var(--v5-on-brand); border-color: var(--v5-brand); }
.status-mark { width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; background: var(--v5-surface-2); color: var(--v5-brand); border-radius: 50%; font-size: 26px; margin-bottom: 22px; }
/* P-45 bank withdrawal: physical bank card, compact account row, amount on glass, quote ticket, fixed actions. */
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.k { display: block; color: var(--v5-ink-3); font: 400 12px/16px var(--font-v5); }
.hint { display: block; margin-top: 4px; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); }
.hint.pad { margin: 12px 4px 0; }
.bcard { position: relative; display: flex; flex-direction: column; height: 208px; margin-top: 15px; padding: 20px; box-sizing: border-box; overflow: hidden; border-radius: var(--ui-radius-surface); color: color-mix(in srgb, white 96%, transparent);
  --bcard-ok: #9EDC1D; --bcard-warn: #FFCB4D;
  background: radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,.09), transparent 55%), linear-gradient(150deg, #2B2E35, #17191D 55%, #0F1013);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), inset 0 8px 12px -10px rgba(255,255,255,.35), inset 0 -12px 18px -14px rgba(0,0,0,.6), 0 16px 36px rgba(0,0,0,.40); }
/* The card stays dark in both themes; on a light page a lighter, cooler drop shadow keeps it from looking heavy. */
[data-theme="light"] .bcard { box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), inset 0 8px 12px -10px rgba(255,255,255,.35), inset 0 -12px 18px -14px rgba(0,0,0,.6), 0 2px 4px rgba(15,17,22,.10), 0 18px 32px -14px rgba(15,17,22,.40); }
.bcard::before { content: ""; position: absolute; right: -70px; top: -90px; width: 300px; height: 300px; border-radius: 50%; background: repeating-radial-gradient(circle, rgba(255,255,255,.07) 0 1px, transparent 1px 9px); -webkit-mask-image: radial-gradient(circle, #000 0 30%, transparent 71%); mask-image: radial-gradient(circle, #000 0 30%, transparent 71%); pointer-events: none; }
.bcard::after { content: ""; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.16) 50%, transparent 65%); transform: translateX(-110%); animation: bcard-sweep 1200ms 480ms cubic-bezier(.4,0,.2,1) both; pointer-events: none; }
@keyframes bcard-sweep { to { transform: translateX(110%); } }
.bcard__top { position: relative; display: flex; align-items: center; gap: 10px; }
.bcard__bk { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,.10); box-shadow: inset 0 1px 0 rgba(255,255,255,.12); }
.bcard__nm { flex: 1; min-width: 0; color: color-mix(in srgb, white 72%, transparent); font: 400 13px/18px var(--font-v5); }
.bcard__tag { flex: none; display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: var(--v5-radius-full); background: color-mix(in srgb, var(--bcard-ok) 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bcard-ok) 24%, transparent); color: var(--bcard-ok); font: 500 12px/16px var(--font-v5); }
.bcard__tag.warn { background: color-mix(in srgb, var(--bcard-warn) 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bcard-warn) 24%, transparent); color: var(--bcard-warn); }
.bcard__bot { position: relative; display: flex; align-items: flex-end; justify-content: space-between; margin-top: auto; }
.bcard__lb { display: block; color: color-mix(in srgb, white 55%, transparent); font: 400 12px/16px var(--font-v5); }
.bcard__no { display: block; margin-top: 4px; font: 500 26px/32px var(--font-metric); letter-spacing: .08em; text-shadow: 0 1px 0 rgba(0,0,0,.45); }
.bcard__cur { color: color-mix(in srgb, white 55%, transparent); font: 500 12px/16px var(--font-metric); letter-spacing: .08em; }
.note { display: flex; align-items: flex-start; gap: 8px; margin: 14px 4px 0; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); }
.note > svg { flex: none; margin-top: 2px; }
.acct { display: flex; align-items: center; gap: 12px; min-height: 56px; margin-top: 15px; padding: 8px 14px; box-sizing: border-box; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.acct__ico { display: grid; place-items: center; flex: none; width: 32px; height: 32px; border-radius: 10px; background: var(--v5-success-soft); color: var(--v5-success-ink); }
.acct__grow { flex: 1; min-width: 0; }
.acct__no { display: block; color: var(--v5-ink); font: 500 14px/20px var(--font-metric); }
.stage { position: relative; margin-top: 12px; }
.aura { position: absolute; inset: -8px -6px; pointer-events: none; }
.aura > view { position: absolute; width: 180px; height: 140px; border-radius: 50%; filter: blur(42px); }
.aura > view:first-child { left: -10px; top: -6px; background: color-mix(in srgb, var(--v5-warning) 22%, transparent); }
.aura > view:last-child { right: -14px; bottom: 10px; background: color-mix(in srgb, var(--v5-brand-2) 26%, transparent); }
[data-theme="light"] .aura > view:first-child { background: color-mix(in srgb, var(--v5-warning) 14%, transparent); }
[data-theme="light"] .aura > view:last-child { background: color-mix(in srgb, var(--v5-brand-2) 16%, transparent); }
/* Amount slab: its amber as one uniform tint (.nx-tint) over the outer aura. */
.slab { --nx-tint: var(--v5-warning); position: relative; padding: 18px 20px 16px; border-radius: var(--v5-radius-xl); }
.slab__head { display: flex; align-items: center; justify-content: space-between; min-height: 32px; }
.slab__amt { display: block; margin-top: 4px; color: var(--v5-ink); font: 500 40px/48px var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.slab__unit { margin-left: 6px; color: var(--v5-ink-3); font: 500 12px/16px var(--font-v5); letter-spacing: 0; }
.slab .amount-input { display: flex; align-items: baseline; gap: 0; margin-top: 4px; padding: 0; border: 0; border-radius: 0; }
.slab .amount-input input { flex: 0 1 auto; max-width: calc(100% - 48px); height: 48px; color: var(--v5-ink); font: 500 40px/48px var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.slab .use-max { min-width: 0; min-height: 32px; padding: 0 4px; font: 500 13px/18px var(--font-v5); }
.slab .limits { margin-top: 4px; font: 400 12px/18px var(--font-v5); }
.daily { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 12px 4px 0; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); }
.daily .refresh-limits { font: 500 12px/18px var(--font-v5); }
.ticket { position: relative; margin-top: 12px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.ticket__top { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 10px; }
.ticket__title { font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); }
.cdw { display: flex; align-items: center; gap: 8px; }
.cdw > svg { transform: rotate(-90deg); }
.cdw__trk { fill: none; stroke: color-mix(in srgb, var(--v5-ink) 12%, transparent); stroke-width: 3; }
.cdw__val { fill: none; stroke: var(--v5-brand); stroke-width: 3; stroke-linecap: round; stroke-dasharray: 63; transition: stroke-dashoffset 1s linear; }
.cdw__s { color: var(--v5-ink); font: 500 13px/18px var(--font-metric); }
.ticket__rows { padding: 0 16px 12px; }
.qrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; }
.qrow__v { color: var(--v5-ink); font: 500 14px/20px var(--font-metric); font-variant-numeric: tabular-nums; }
.tear { position: relative; height: 0; margin: 0 18px; border-top: 1.5px dashed var(--v5-border-strong); }
.tear::before, .tear::after { content: ""; position: absolute; top: -11px; width: 20px; height: 20px; border-radius: 50%; background: var(--v5-bg); }
.tear::before { left: -28px; } .tear::after { right: -28px; }
.ticket__net { padding: 14px 16px 16px; }
.ticket__net > .k:first-child { padding-top: 3.5px; }
.ticket__vnd { display: block; margin-top: 4px; color: var(--v5-success-ink); font: 500 28px/34px var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ticket__net .hint { margin-top: 6px; }
.consent { margin: 16px 4px 0; }
.acct__change { position: relative; flex: none; display: inline-flex; align-items: center; height: 32px; padding: 0 12px; border-radius: var(--v5-radius-full); color: var(--v5-ink); font: 500 13px/18px var(--font-v5); cursor: pointer; }
.acct__change::after { content: ""; position: absolute; inset: -6px -2px; }
.consent { color: var(--v5-ink-3); font: 400 13px/20px var(--font-v5); }
.consent .checkbox { width: 22px; height: 22px; border-radius: 7px; font-size: 13px; }
.text-link { min-height: 44px; margin-top: 8px; background: transparent; color: var(--v5-ink-3); font: 500 13px/18px var(--font-v5); }
.bar-space { height: 110px; }
.bar { position: absolute; left: 0; right: 0; bottom: 0; z-index: 36; display: flex; gap: 12px; padding: var(--v5-space-3) var(--v5-space-4) calc(30px + env(safe-area-inset-bottom)); }
.bar .action { flex: 1 1 0; min-height: 48px; margin: 0; padding: 0 20px; font: 500 15px/20px var(--font-v5); }
.bar .secondary.nx-frosted-button { background: linear-gradient(145deg, var(--ui-button-sheen), transparent 38%, transparent 66%, var(--ui-button-sheen)), color-mix(in srgb, var(--v5-ink) 7%, transparent); box-shadow: var(--ui-glass-edge-shadow); color: var(--v5-ink); }
@media (prefers-reduced-motion: reduce) { .bcard::after { animation: none; opacity: 0; } .cdw__val { transition: none; } }
</style>
