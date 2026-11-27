<template>
  <AppChassis active="me">
    <SubPageHeader back="/pages/me/wallet-withdraw-method" :title="c.title" :back-action="goBack" />
    <view class="bank-withdraw" :aria-busy="!remoteSessionReady || busy">
      <template v-if="remoteSessionReady">
      <!-- Not on the first-read failure below: its centred result already says it once. -->
      <view v-if="error && (order || uncertain || displayIntents.length || displayConfig || requestedOrder !== null || pendingAttempt)" class="notice danger" role="alert"><text>{{ error }}</text></view>
      <!-- Not while a still placeholder below stands in: it already carries the loading status in the loaded layout's place. -->
      <text v-if="busy && !silentRead && !stillPlaceholder()" class="muted loading" role="status">{{ c.loading }}</text>
      <view v-if="remoteSessionReady && pendingAttempt" class="notice" role="status" data-testid="bank-pending-usdt">
        <text>{{ c.resumeUsdt }}</text>
        <NxButton class="page-action" variant="secondary" label="USDT" data-testid="bank-resume-usdt" :disabled="busy" @click="openUsdt" />
      </view>

      <template v-if="order">
        <NxResultHead class="result-head" :tone="resultTone" :icon="outcome === 'held' ? 'shield' : undefined" :title="statusLabel" :description="c.resultNotes[outcome]" title-testid="bank-order-status" :live="!terminal" />
        <view class="amount-card"><text class="muted">{{ c.receiveLabel }}</text><text class="money">{{ formatAmount(order.bank.amountVnd, 'VND') }}<text class="money__unit">{{ '\u00A0' }}VND</text></text></view>
        <view class="account-card"><text class="muted">{{ useTranslations.bankBinding.accountRoutedLabel }}</text><text class="account-number">{{ dots(order.bank.maskedAccount) }}</text></view>
        <view class="details">
          <view class="row row--code"><text>{{ c.orderNumber }}</text><NxCodeValue :value="order.withdrawalNo" :label="c.orderNumber" fill /></view>
          <view class="row"><text>{{ c.totalDebit }}</text><text>{{ usdt2(order.bank.amountUsdt) + '\u00A0USDT' }}</text></view>
          <view class="row"><text>{{ c.fee }}</text><text>{{ usdt2(order.bank.feeUsdt) }}</text></view>
          <view class="row"><text>{{ c.net }}</text><text>{{ usdt2(order.bank.netUsdt) }}</text></view>
          <view v-if="outcome === 'refunded'" class="row"><text>{{ c.refundAmount }}</text><text>{{ usdt2(order.settlementEvidence!.amountUsdt!) }}</text></view>
          <view v-if="terminal && order.settlementEvidence?.checkedAt" class="row"><text>{{ c.confirmedAt }}</text><text>{{ displayDate(order.settlementEvidence.checkedAt) }}</text></view>
        </view>
        <view class="bar-space bar-space--result" />
      </template>

      <template v-else-if="uncertain || displayIntents.length || (displayConfig && displayConfig.unresolvedIntent === undefined)">
        <text class="screen-title">{{ c.title }}</text>
        <view v-if="!busy || !uncertain" class="notice" role="alert"><text>{{ displayIntents.length ? c.multipleIntents : uncertain ? c.unknown : c.recoveryUnavailable }}</text></view>
        <NxButton v-for="intent in displayIntents" :key="intent.quoteNo" class="page-action page-action--intent" variant="secondary" :disabled="busy" @click="openIntent(intent)"><NxCodeValue class="intent-code" :value="intent.withdrawalNo || intent.quoteNo" :label="c.orderNumber" :copyable="false" /></NxButton>
        <NxButton v-if="!uncertain" class="page-text-action" variant="text" size="small" :label="c.reload" data-testid="bank-refresh" :disabled="busy" @click="load" />
      </template>

      <template v-else-if="displayConfig && remoteSessionReady && (!pendingAttempt || quote)">
        <text class="vh" role="heading" aria-level="1">{{ title }}</text>
        <!-- P-45 account step: the bound account as a physical bank card, then the binding rule. -->
        <template v-if="!quote && formStep === 'account'">
          <view class="bcard" :aria-label="`${c.recipientTitle} ${recipient?.maskedAccount ?? '—'}`">
            <view class="bcard__top">
              <view class="bcard__bk" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M12 3 3 8h18z" /></svg></view>
              <text class="bcard__nm">{{ c.recipientSubtitle }}</text>
              <NxTag class="bcard__tag" :tone="cardTag.tone" :label="cardTag.label" data-testid="bank-account-status" role="status" />
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
          <view v-if="!quote" class="acct__change nx-frosted-button" role="button" tabindex="0" :aria-disabled="navigationLocked" :aria-label="c.changeAccount" @click="goBack" @keydown.enter.prevent="goBack" @keydown.space.prevent="goBack"><text>{{ c.change }}</text></view>
        </view>
        <!-- On the account step this reason sits in the tray above 继续提现 (continueReason); the amount and quote steps keep the notice. -->
        <view v-if="(formStep === 'amount' && displayConfig.beneficiary && !hasVerifiedBankIdentity(displayConfig.beneficiary)) || (quote && !hasVerifiedBankIdentity(quote))" class="notice" role="status"><text>{{ c.bankRoutingUnverified }}</text></view>

        <template v-if="quote">
          <view class="stage">
            <view class="aura" aria-hidden="true"><view /><view /></view>
            <view class="slab nx-tint">
              <view class="slab__head"><text class="k">{{ c.amount }}</text></view>
              <text class="slab__amt">{{ usdt2(quote.amountUsdt).replace(/\.\d*$/, "") }}<text class="slab__dec">{{ usdt2(quote.amountUsdt).replace(/^[^.]*/, "") }}</text><text class="slab__unit">{{ '\u00A0' }}USDT</text></text>
              <!-- Balance and single limit on two lines, as on the amount step, so the range never breaks at its dash. -->
              <view v-if="displayConfig.policy && displayConfig.capacity" class="limits">
                <text>{{ format(c.availableLabel, { amount: usdt2(displayConfig.capacity.maxWithdrawableUsdt) }) }}</text>
                <text>{{ format(c.rangeLabel, { min: usdt2(displayConfig.policy.minAmountUsd), max: usdt2(displayConfig.policy.maxAmountUsd) }) }}</text>
              </view>
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
              <view class="qrow"><text class="k">{{ c.fee }}</text><text class="qrow__v">{{ usdt2(quote.feeUsdt) }}</text></view>
              <view class="qrow"><text class="k">{{ c.net }}</text><text class="qrow__v">{{ usdt2(quote.netUsdt) }}</text></view>
              <view class="qrow"><text class="k">{{ c.rate }}</text><text class="qrow__v">{{ formatHowNumber(quote.rateVnd, dateLocale()) }}</text></view>
            </view>
            <view class="tear" aria-hidden="true" />
            <view class="ticket__net">
              <text class="k">{{ c.receiveLabel }}（VND）</text>
              <text class="ticket__vnd">{{ formatAmount(quote.amountVnd, 'VND') }}<text class="ticket__cur">₫</text></text>
              <text class="hint">{{ c.feeIncluded }}</text>
            </view>
          </view>
          <text v-if="displayConfig.capacity" class="hint pad">{{ format(c.dailyLabel, { remaining: displayConfig.capacity.dailyRemainingCount, total: displayConfig.capacity.dailyLimitCount }) }}</text>
          <view v-if="!quoteExpired" class="consent" role="checkbox" tabindex="0" data-testid="bank-consent" :aria-checked="accepted" :aria-disabled="busy" @click="toggleConsent" @keydown.enter.prevent="toggleConsent" @keydown.space.prevent="toggleConsent"><view class="checkbox" :class="{ checked: accepted }" aria-hidden="true"><svg v-if="accepted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg></view><text>{{ c.consent }}</text></view>
          <text class="hint pad">{{ c.confirmNotice }}</text>
          <NxButton class="page-text-action nx-reverse-action" variant="text" size="small" :label="c.backToAmount" data-testid="bank-abandon" :disabled="busy" @click="abandon" />
        </template>

        <template v-else-if="formStep === 'account'">
          <view class="note"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-9h.01" /></svg><text>{{ displayConfig.beneficiary ? c.bindingNotice : c.unboundNotice }}</text></view>
        </template>

        <template v-else>
          <view class="stage">
            <view class="aura" aria-hidden="true"><view /><view /></view>
            <view class="slab nx-tint">
              <view class="slab__head">
                <text class="k">{{ c.amount }}</text>
                <NxButton variant="text" size="small" :label="c.all" data-testid="bank-max" :disabled="busy || !canContinue || maxAmount <= 0" @click="useMax" />
              </view>
              <view class="amount-input">
                <input data-testid="bank-amount" v-model="amount" type="text" inputmode="decimal" :disabled="busy || !canContinue" placeholder="0.00" :aria-label="c.amount" :aria-describedby="quoteReason ? 'bank-quote-reason' : undefined" :aria-invalid="!!amount.trim() && ['format', 'range', 'balance'].includes(amountProblem ?? '') ? 'true' : undefined" :style="{ width: `calc(${Math.max(amount.length, 4)} * (1ch - .02em) + 4px)` }" />
                <text class="slab__unit">USDT</text>
              </view>
              <!-- Limits that came back missing keep their lines with 「—」 while the system re-reads them (03 §3.4, §3.5.2). -->
              <view class="limits">
                <text data-testid="bank-balance">{{ format(c.availableLabel, { amount: displayConfig.capacity ? usdt2(displayConfig.capacity.maxWithdrawableUsdt) : "—" }) }}</text>
                <text v-if="displayConfig.policy" data-testid="bank-single-limit">{{ format(c.rangeLabel, { min: usdt2(displayConfig.policy.minAmountUsd), max: usdt2(displayConfig.policy.maxAmountUsd) }) }}</text>
              </view>
            </view>
          </view>
          <view v-if="displayConfig.capacity && app.user.usdtBalance < 0" class="note note--debt" role="note"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg><text>{{ format(useTranslations.me.walletDebtNote, { amount: usdt2(-app.user.usdtBalance) }) }}</text></view>
          <view class="daily" data-testid="bank-daily">
            <text>{{ format(c.dailyLabel, { remaining: displayConfig.capacity?.dailyRemainingCount ?? "—", total: displayConfig.capacity?.dailyLimitCount ?? "—" }) }}</text>
          </view>
          <text class="hint pad">{{ feeNote || c.feeIncluded }}</text>
          <view v-if="rulesReady" class="rules-link"><NxButton variant="link" icon="chevron-right" :label="c.rules.title" aria-haspopup="dialog" @click="rulesMode = 'read'" /></view>
          <NxButton class="page-text-action nx-reverse-action" variant="text" size="small" :label="c.backToAccount" :disabled="navigationLocked" @click="goBack" />
        </template>
        <NxButton v-if="error" class="page-text-action" variant="text" size="small" :label="c.reload" data-testid="bank-refresh" :disabled="busy" @click="load" />
        <!-- The account step bar holds two buttons that stack in long languages; leave room for both. -->
        <view class="bar-space" :class="{ 'bar-space--result': !quote && formStep === 'account' && !!displayConfig.beneficiary, 'bar-space--result-note': !quote && formStep === 'account' && !!continueReason, 'bar-space--note': quote ? !!submitReason : formStep === 'amount' && !!quoteReason }" />
      </template>
      <!-- First config read with no snapshot (03 §3.4, §3.5.2): when it fails, the page's one centred result and its one
           重新加载; while it runs, the still placeholder below. -->
      <template v-else-if="requestedOrder === null && !pendingAttempt">
        <EmptyState v-if="error" kind="recoverable-error" page :title="useTranslations.pageLoad.unknown" :cta-label="c.reload" :cta-busy="busy" @cta="load" />
      </template>
      <NxButton v-else-if="error" class="page-text-action" variant="text" size="small" :label="c.reload" data-testid="bank-refresh" :disabled="busy" @click="load" />
      </template>
      <!-- Session restore and first reads (03 §3.4): a still placeholder at the size of the layout the read lands on, the bound
           account step or the ?order= receipt, with an empty tray in the bar; no grey main-action buttons. -->
      <view v-if="stillPlaceholder() === 'account'" class="first-read" role="status" aria-busy="true" data-testid="bank-first-read">
        <text class="vh">{{ c.loading }}</text>
        <view class="first-read__card" aria-hidden="true">
          <view class="first-read__top"><view class="first-read__dot" /><view class="first-read__bar first-read__bar--name" /><view class="first-read__bar first-read__bar--tag" /></view>
          <view class="first-read__bot"><view class="first-read__bar first-read__bar--label" /><view class="first-read__bar first-read__bar--no" /></view>
        </view>
        <view class="first-read__bar first-read__bar--note" aria-hidden="true" />
        <view class="bar-space bar-space--result" />
      </view>
      <view v-else-if="stillPlaceholder() === 'receipt'" class="first-read" role="status" aria-busy="true" data-testid="bank-receipt-read">
        <text class="vh">{{ c.loading }}</text>
        <view class="result-head first-read__head" aria-hidden="true"><view class="first-read__dot first-read__dot--head" /><view class="first-read__bar first-read__bar--title" /><view class="first-read__bar first-read__bar--desc" /><view class="first-read__bar first-read__bar--desc2" /></view>
        <view class="amount-card" aria-hidden="true"><view class="first-read__bar first-read__bar--muted" /><view class="first-read__bar first-read__bar--money" /></view>
        <view class="account-card" aria-hidden="true"><view class="first-read__bar first-read__bar--muted" /><view class="first-read__bar first-read__bar--account" /></view>
        <view class="details" aria-hidden="true"><view v-for="n in 4" :key="n" class="row first-read__row"><view class="first-read__bar first-read__bar--k" /><view class="first-read__bar first-read__bar--v" /></view></view>
        <view class="bar-space bar-space--result" />
      </view>
    </view>
    <!-- Main actions in the fixed bottom bar (DS-30): account → change + continue; amount → quote; quote → confirm; result → new withdrawal + back to wallet. -->
    <template #pageFixed>
      <!-- While a still placeholder stands in: the tray in its place, empty until the read lands. -->
      <view v-if="stillPlaceholder()" class="bar bar--first-read nx-glass-bar" aria-hidden="true"><view class="bar__hold" /></view>
      <view v-if="remoteSessionReady && order" class="bar bar--result nx-glass-bar">
        <NxButton v-if="terminal" variant="secondary" :label="c.newWithdrawal" data-testid="bank-new" :disabled="busy || !newWithdrawalAllowed" :style="{ opacity: silentRead ? 1 : undefined }" @click="startNew" />
        <NxButton variant="primary" :label="c.backToWallet" :disabled="busy" :style="{ opacity: silentRead ? 1 : undefined }" @click="backToWallet" />
      </view>
      <view v-if="displayConfig && remoteSessionReady && (!pendingAttempt || quote) && !order && !(uncertain || displayIntents.length || displayConfig.unresolvedIntent === undefined)" class="bar nx-glass-bar">
        <template v-if="quote">
          <text v-if="submitReason" class="nx-tray-note" role="status" data-testid="bank-submit-reason">{{ submitReason }}</text>
          <NxButton v-if="!quoteExpired" variant="primary" :label="c.confirm" data-testid="bank-submit" :disabled="busy || !canSubmit" @click="confirmSubmit" />
        </template>
        <template v-else-if="formStep === 'account'">
          <!-- Grey 「继续提现」: its reason above both buttons (03 §3.1 bottom bar), as on the amount step. -->
          <text v-if="continueReason" class="nx-tray-note" role="status" data-testid="bank-continue-reason">{{ continueReason }}</text>
          <!-- Unbound: 添加收款账户 is the page's one action, so it is the primary (04 §4.0 floating button). -->
          <NxButton :variant="displayConfig.beneficiary ? 'secondary' : 'primary'" :label="displayConfig.beneficiary ? c.changeAccount : c.addAccount" :disabled="navigationLocked" @click="manageBank" />
          <NxButton v-if="displayConfig.beneficiary" variant="primary" :label="c.continueWithdrawal" data-testid="bank-continue" :disabled="busy || !canContinue" @click="continueWithdrawal" />
        </template>
        <template v-else>
          <!-- Grey 「获取报价」: its reason above it (03 §3.1 bottom bar); the amount field no longer repeats it. -->
          <text v-if="quoteReason" id="bank-quote-reason" class="nx-tray-note" role="status" data-testid="bank-quote-reason">{{ quoteReason }}</text>
          <NxButton variant="primary" :label="c.quote" data-testid="bank-quote" :disabled="quoteDisabled" @click="getQuote" />
        </template>
      </view>
    </template>
    <!-- 提现说明:只读时一个「确认」;确认提现时同一个弹窗,「确认提现」按原流程提交,「取消」回到报价(勾选保留)。
         确认时先列这笔的对象和后果(03 §3.5),取同一份报价:收款账号尾号、总扣、银行到账金额,再接提现说明。 -->
    <NxNoticeDialog :open="rulesMode !== null && rulesReady" :title="rulesMode === 'submit' && quote ? c.confirmTitle : c.rules.title" :primary="rulesMode === 'submit' ? c.confirm : useTranslations.ui.confirm"
      :secondary="rulesMode === 'submit' ? useTranslations.ui.cancel : undefined" icon="none" scroll-body focus-title mask-secondary :dismissible="rulesMode === 'read'"
      @primary="rulesPrimary" @secondary="rulesMode = null" @dismiss="rulesMode = null">
      <template v-if="rulesMode === 'submit' && rulesQuoteDetails">
        <view class="cfm-rows" data-testid="bank-confirm-rows">
          <view class="cfm-row"><text class="cfm-k">{{ useTranslations.bankBinding.accountRoutedLabel }}</text><text class="cfm-v">{{ rulesQuoteDetails.account }}</text></view>
          <view class="cfm-row"><text class="cfm-k">{{ c.totalDebit }}</text><text class="cfm-v">{{ rulesQuoteDetails.debit }}</text></view>
          <view class="cfm-row cfm-row--amount"><text class="cfm-k">{{ c.receive }}</text><text class="cfm-v">{{ rulesQuoteDetails.receive }}</text></view>
        </view>
        <text class="cfm-rules-title" role="heading" aria-level="3">{{ c.rules.title }}</text>
      </template>
      <NxRulesList :items="rulesItems" />
    </NxNoticeDialog>
  </AppChassis>
</template>

<script setup lang="ts">
import { formatHowNumber } from "@/lib/rank-how-content";
import { formatFinanceAmount as formatAmount } from "@/lib/finance-amount-display";
import { formatGroupedAmount, formatTruncatedAmount } from "@/lib/amount-display";
import { computed, ref, watch } from "vue";
import { toast, type RuleItem } from "@/store/ui";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { onLoad, onShow, onHide, onUnload } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import NxCodeValue from "@/components/ui/nx-code-value.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import NxResultHead from "@/components/ui/nx-result-head.vue";
import NxButton from "@/components/ui/nx-button.vue";
import EmptyState from "@/components/empty-state.vue";
import NxNoticeDialog from "@/components/ui/nx-notice-dialog.vue";
import NxRulesList from "@/components/ui/nx-rules-list.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { dateLocale } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { apiClient, apiRuntimeConfig, remoteApiEnabled, sessionVault } from "@/api/runtime";
import { isApiRefusal } from "@/api/errors";
import { binarySessionReady } from "@/lib/binary-session-ready";
import { readWithdrawAttempt } from "@/lib/withdraw-attempt";
import { foregroundReadAllowed } from "@/lib/foreground-read";
import { createBankWithdrawalApi, hasVerifiedBankIdentity, type BankConfig, type BankQuote, type BankOrder, type BankIntent, type BankRecovery } from "@/api/bank-withdrawal-api";
import { parseServerTimestamp } from "@/api/server-time";
import { formatBankDateTime } from "@/lib/bank-date";
import { bankAccountNotice, bankBeneficiaryReady, bankCanQuote, bankOrderOutcome, bankAmountError, bankMaximumAmount } from "@/lib/bank-withdrawal-state";
import { navBack, navTo, takeNavigationQuery } from "@/lib/route";
// #ifdef H5
import { useRouter } from "vue-router";
// #endif

const c = computed(() => useTranslations.value.bankWithdrawal);
const useTranslations = useT();
const app = useApp();
const auth = useAuth();
// #ifdef H5
const routeHistory = useRouter().options.history;
// #endif
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
const configRefreshFailed = ref(false);
watch(config, () => { configRefreshFailed.value = false; }, { flush: "sync" });
const quote = ref<BankQuote | null>(null);
const refusedQuoteNo = ref<string | null>(null);
const order = ref<BankOrder | null>(null);
const busy = ref(false);
const silentRead = ref(false);
const readingConfig = ref(false);
// Any config read, cold or warm, leaves the page free to navigate (03 §3.4, §3.5.2); writes (quote, submit, abandon) lock it.
const configReadInFlight = ref(false);
const navigationLocked = computed(() => busy.value && !readingConfig.value && !configReadInFlight.value);
const error = ref("");
const configPresentation = ref<{ owner: string; epoch: number; value: BankConfig } | null>(null);
const displayConfig = computed(() => {
  const snapshot = configPresentation.value;
  if (!snapshot || snapshot.owner !== app.accountKey || snapshot.epoch !== app.accountBindingEpoch) return null;
  return config.value ?? (busy.value && !error.value ? snapshot.value : null);
});
const uncertain = ref(false);
// Which loaded layout a still placeholder stands in for while nothing can show yet (03 §3.4): the ?order= receipt, else the
// account step; none once there is content or a failure to show. A function, not a computed: requestedOrder is a plain let.
function stillPlaceholder(): "receipt" | "account" | null {
  if (remoteSessionReady.value && (order.value || uncertain.value || displayConfig.value || error.value || (requestedOrder === null && pendingAttempt.value))) return null;
  return requestedOrder === null ? "account" : "receipt";
}
const pendingQuoteNo = ref<string | null>(null);
const amount = ref("");
const formStep = ref<"account" | "amount">("account");
const accepted = ref(false);
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
let requestedOrder: string | null = null;
let capacityRefusalQuoteNo: string | null = null;
let lastCapacityResetRead = "";
let revision = 0;
let alive = true;
const visible = ref(false);
const pendingKey = () => `nexgrid.bank-withdraw.pending:${app.accountKey}`;
function readPendingQuoteNo(): string | null {
  const pending: unknown = uni.getStorageSync(pendingKey());
  return typeof pending === "string" && /^BQ-[a-f0-9]{32}$/.test(pending) ? pending : null;
}
const money = (value: number) => formatAmount(value);
// Quote, confirm and result amounts (principal, fee, net, refund): two decimals cut off, never rounded. Display only.
const usdt2 = (value: number) => formatTruncatedAmount(value);
const displayDate = (value: string) => formatBankDateTime(value, dateLocale());
const quoteExpired = computed(() => !!quote.value && (parseServerTimestamp(quote.value.expiresAt) ?? 0) <= now.value);
const quoteLimitsChanged = computed(() => {
  const current = quote.value;
  if (!current) return false;
  if (refusedQuoteNo.value === current.quoteNo) return true;
  const policy = config.value?.policy;
  return !!policy && (current.amountUsdt < policy.minAmountUsd || current.amountUsdt > policy.maxAmountUsd
    || (current.d7Version !== undefined && policy.version > current.d7Version));
});
const canSubmit = computed(() => newWithdrawalAllowed.value && !submitReason.value && accepted.value && !!quote.value && !quoteExpired.value && !uncertain.value && config.value?.enabled === true
  && config.value.unresolvedIntent !== undefined && config.value.unresolvedIntent?.state !== "MULTIPLE"
  && bankBeneficiaryReady(config.value.beneficiary) && hasVerifiedBankIdentity(quote.value));
const multipleIntents = computed(() => config.value?.unresolvedIntent?.state === "MULTIPLE" ? config.value.unresolvedIntent.intents : []);
const displayIntents = computed(() => displayConfig.value?.unresolvedIntent?.state === "MULTIPLE" ? displayConfig.value.unresolvedIntent.intents : []);
const configBlockReason = computed(() => {
  const shown = displayConfig.value;
  if (!shown) return "";
  if (!shown.enabled) return c.value.unavailable;
  if (shown.beneficiary && !bankBeneficiaryReady(shown.beneficiary)) return c.value.accountStatus[bankAccountNotice(shown.beneficiary)];
  if (shown.beneficiary && (!shown.policy || !shown.capacity)) return c.value.capacityUnavailable;
  if (shown.capacity?.withdrawalEnabled === false) return c.value.unavailable;
  if (shown.capacity?.dailyRemainingCount === 0) return `${c.value.dailyExhausted} ${displayDate(shown.capacity.dailyCountResetAt)}`;
  if (configRefreshFailed.value && shown.beneficiary) return c.value.capacityUnavailable;
  // Balance reasons need a bound account: unbound, the only action is 添加收款账户.
  if (shown.beneficiary && shown.policy && shown.capacity && shown.capacity.maxWithdrawableUsdt < shown.policy.minAmountUsd) {
    return format(c.value.balanceBelowMin, { min: usdt2(shown.policy.minAmountUsd) });
  }
  if (shown.beneficiary && shown.capacity && quote.value && shown.capacity.maxWithdrawableUsdt < quote.value.amountUsdt) return c.value.amountErrors.balance;
  return "";
});
const submitReason = computed(() => {
  if (!quote.value || quoteExpired.value) return "";
  return quoteLimitsChanged.value ? c.value.quoteLimitsChanged : configBlockReason.value;
});
// The card tag: a short word, green only when a withdrawal can start; a closed channel reads 暂不可用 like the tray (04.4, 03 §3.8).
const cardTag = computed(() => {
  const shown = displayConfig.value, c0 = c.value;
  if (readingConfig.value) return { tone: "warning", label: c0.loading } as const;
  if (!shown?.enabled) return { tone: "warning", label: c0.tagUnavailable } as const;
  if (!shown.beneficiary) return { tone: "warning", label: c0.unbound } as const;
  if (!bankBeneficiaryReady(shown.beneficiary)) return { tone: "warning", label: bankAccountNotice(shown.beneficiary) === "unverified" ? c0.tagUnverified : c0.tagUnavailable } as const;
  if (configBlockReason.value) return { tone: "warning", label: c0.tagUnavailable } as const;
  return { tone: "success", label: c0.available } as const;
});
const outcome = computed(() => order.value ? bankOrderOutcome(order.value) : "review");
const terminal = computed(() => !!order.value && ["paid", "refunded"].includes(outcome.value));
const statusLabel = computed(() => c.value[outcome.value]);
// Status map (DS 03 §3.8): paid = success, refunded = neutral, waiting / in transfer / under review = warning.
const resultTone = computed(() => outcome.value === "paid" ? "success" : outcome.value === "refunded" ? "neutral" : "warning");
const recipient = computed(() => order.value?.bank ?? quote.value ?? displayConfig.value?.beneficiary);
const canContinue = computed(() => newWithdrawalAllowed.value && bankCanQuote(config.value) && !configBlockReason.value);
const amountProblem = computed(() => bankAmountError(amount.value, config.value));
const quoteDisabled = computed(() => busy.value || !canContinue.value || !!amountProblem.value);
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
const feeNote = computed(() => displayConfig.value?.policy ? format(c.value.feeNote, { rate: formatHowNumber(displayConfig.value.policy.feeRatePct, dateLocale()), min: money(displayConfig.value.policy.feeMinUsd), max: money(displayConfig.value.policy.feeMaxUsd) }) : "");
const quoteReason = computed(() => {
  if (!quoteDisabled.value) return "";
  if (configBlockReason.value) return configBlockReason.value;
  if (displayConfig.value && !displayConfig.value.beneficiary) return c.value.unboundNotice;
  const problem = bankAmountError(amount.value, displayConfig.value);
  if (!problem || problem === "unavailable") return busy.value ? c.value.loading : "";
  return problem === "format" && !amount.value.trim() ? useTranslations.value.walletV3.submitReasonAmountRequired : c.value.amountErrors[problem];
});
const continueReason = computed(() => configBlockReason.value || (busy.value && displayConfig.value?.beneficiary ? c.value.loading : ""));
function format(template: string, values: Record<string, string | number>) { return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? "")); }
// ── 提现说明:只在拿到单笔限额（policy）时出现。'submit' 是提交前的同一个弹窗,报价失效时收起。──
const rulesMode = ref<"read" | "submit" | null>(null);
const rulesReady = computed(() => !!displayConfig.value?.policy);
const rulesItems = computed(() => {
  const policy = displayConfig.value?.policy, r = c.value.rules;
  if (!policy) return [];
  const items: RuleItem[] = [
    { title: r.amountTitle, body: r.amountBody, figures: { range: `${formatGroupedAmount(policy.minAmountUsd, "full")}–${formatGroupedAmount(policy.maxAmountUsd, "full")}\u00A0USDT` } },
    { title: r.etaTitle, body: r.etaBody, figures: { window: r.window, weekend: r.weekend } },
    { title: r.feeTitle, body: r.feeBody },
    { title: r.accountTitle, body: r.accountBody },
  ];
  return items;
});
watch(() => !!quote.value && !quoteExpired.value, (live) => { if (!live && rulesMode.value === "submit") rulesMode.value = null; });
function confirmSubmit() {
  refreshPendingAttempt();
  if (busy.value || !canSubmit.value || uncertain.value) return;
  if (rulesReady.value) rulesMode.value = "submit";
  else void submit();
}
function rulesPrimary() {
  const submitting = rulesMode.value === "submit";
  rulesMode.value = null;
  if (submitting) void submit();
}
const rulesQuoteDetails = computed(() => {
  const current = quote.value;
  if (!current) return null;
  return {
    account: dots(current.maskedAccount),
    debit: `${usdt2(current.amountUsdt)}\u00A0USDT`,
    receive: formatAmount(current.amountVnd, "VND"),
  };
});
function continueWithdrawal() { if (!busy.value && canContinue.value) formStep.value = "amount"; }
function useMax() { if (!busy.value && canContinue.value && maxAmount.value > 0) amount.value = maxAmount.value.toFixed(6).replace(/\.?0+$/, ""); }
function toggleConsent() { if (!busy.value && !quoteExpired.value) accepted.value = !accepted.value; }
function goBack() {
  if (navigationLocked.value) return;
  // The quote reference is saved, so leaving is safe; the result is read again on return.
  if (uncertain.value || (quote.value && configReadInFlight.value)) { navBack("/pages/me/wallet-withdraw-method"); return; }
  if (quote.value) { void abandon(); return; }
  if (!order.value && formStep.value === "amount") { formStep.value = "account"; return; }
  navBack("/pages/me/wallet-withdraw-method");
}
function backToWallet() { if (!busy.value) navTo("/pages/me/me"); }
function openUsdt() { if (!busy.value && remoteSessionReady.value && pendingAttempt.value) navTo("/pages/me/wallet-withdraw"); }
function scope() {
  const id = ++revision, owner = app.accountKey, epoch = app.accountBindingEpoch;
  const { environment, baseUrl } = apiRuntimeConfig;
  return () => alive && revision === id && app.accountKey === owner && app.accountBindingEpoch === epoch
    && apiRuntimeConfig.environment === environment && apiRuntimeConfig.baseUrl === baseUrl;
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
  try { await action(current); } catch (err) {
    if (current()) {
      if (readingConfig.value) throw err;
      report(err);
    }
  } finally {
    if (current()) { readingConfig.value = false; configReadInFlight.value = false; busy.value = false; silentRead.value = false; }
  }
}
function load() { return loadConfig(false); }
async function loadConfig(recoverConfig: boolean) {
  await run(async current => {
    const owner = app.accountKey, epoch = app.accountBindingEpoch;
    const readingReceipt = requestedOrder !== null || !!order.value;
    const displayedQuote = quote.value;
    const storedPending = readingReceipt ? null : readPendingQuoteNo();
    const pending = storedPending === displayedQuote?.quoteNo ? null : storedPending;
    const warmRead = !readingReceipt && !pending && config.value !== null;
    readingConfig.value = !readingReceipt && !pending && (warmRead || recoverConfig);
    configReadInFlight.value = true;
    if (!readingConfig.value) config.value = null;
    if (!displayedQuote || pending) accepted.value = false;
    if (readingReceipt) {
      const orderNo = requestedOrder ?? order.value!.withdrawalNo;
      if (!/^WD-[A-Z0-9]+$/.test(orderNo)) throw new Error("BANK_ORDER_ROUTE_INVALID");
      const loadedOrder = await api.get(orderNo);
      if (current()) { order.value = loadedOrder; uncertain.value = false; }
      return;
    }
    if (pending) {
      uncertain.value = true; pendingQuoteNo.value = pending;
      const recovered = await api.recover(pending); if (!current()) return;
      applyRecovery(recovered, pending);
      if (recovered.state === "COMMITTED" || uncertain.value) return;
    }
    let loaded: BankConfig;
    try {
      loaded = await api.config();
    } catch (err) {
      if (current() && warmRead) {
        configRefreshFailed.value = true;
        if (!recoverConfig) return;
      }
      throw err;
    }
    if (!current() || (recoverConfig && readingConfig.value && !canReadVisibleBankPage())) return;
    readingConfig.value = false;
    config.value = loaded;
    configPresentation.value = { owner, epoch, value: loaded };
    if (loaded.unresolvedIntent?.state === "MULTIPLE") { quote.value = null; uncertain.value = true; return; }
    const intent = loaded.unresolvedIntent?.intents[0];
    if (displayedQuote && !pending && (!intent || (intent.state === "NOT_SUBMITTED" && intent.quoteNo === displayedQuote.quoteNo))) return;
    if (intent) {
      uncertain.value = true; pendingQuoteNo.value = intent.quoteNo;
      const recovered = await api.recover(intent.quoteNo); if (!current()) return;
      applyRecovery(recovered, intent.quoteNo);
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
  const owner = app.accountKey, epoch = app.accountBindingEpoch;
  const { environment, baseUrl } = apiRuntimeConfig;
  const current = () => generation === orderReadGeneration && (canPollOrder() || canRecoverQuote())
    && order.value === snapshot && pendingQuoteNo.value === quoteNo
    && revision === readRevision && app.accountKey === owner && app.accountBindingEpoch === epoch
    && apiRuntimeConfig.environment === environment && apiRuntimeConfig.baseUrl === baseUrl;
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
      const refreshCapacity = recovered.state === "NOT_SUBMITTED" && capacityRefusalQuoteNo === quoteNo;
      if (recovered.state !== "COMMITTED" && (!config.value || refreshCapacity)) {
        const loaded = await api.config();
        if (!current()) return;
        config.value = loaded; configPresentation.value = { owner, epoch, value: loaded };
      }
      capacityRefusalQuoteNo = null;
      const switched = applyRecovery(recovered, quoteNo); error.value = "";
      if (!switched && !(recovered.state === "NOT_SUBMITTED" && configBlockReason.value)) {
        const title = recovered.state === "COMMITTED" ? c.value[bankOrderOutcome(recovered)]
          : recovered.state === "NOT_SUBMITTED" ? c.value.confirmTitle : c.value.intentClosed;
        toast.info(title, recovered.state === "NOT_SUBMITTED" ? c.value.confirmHint : undefined);
      }
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
// Re-read missing limits and failed refreshes through the same recovery owner (03 §3.5.2).
const limitsMissing = computed(() => !!config.value?.enabled && !!config.value.beneficiary && (!config.value.policy || !config.value.capacity));
const canRereadConfig = () => !order.value && !uncertain.value && (configRefreshFailed.value || limitsMissing.value);
useAutoRecovery({
  failed: () => canReadVisibleBankPage() && canRereadConfig() && !busy.value,
  retry: () => loadConfig(true),
  repeatMs: 30_000,
});

watch([visible, foregroundReadAllowed, remoteSessionReady, () => auth.isAuthenticated], ([isVisible, allowed, sessionReady, authenticated], [wasVisible]) => {
  if (!isVisible || !allowed || !sessionReady || !authenticated) return;
  // Orders and unknown results have one read owner; load() would reset consent.
  if (order.value || uncertain.value || canRereadConfig()) return;
  if (!wasVisible || (!config.value && !quote.value)) void load();
});

function applyRecovery(recovered: BankRecovery, quoteNo: string) {
  accepted.value = false;
  if (recovered.state !== "NOT_SUBMITTED" && uni.getStorageSync(pendingKey()) === quoteNo) uni.removeStorageSync(pendingKey());
  if (recovered.state === "COMMITTED") { order.value = recovered; quote.value = null; }
  else if (recovered.state === "NOT_SUBMITTED") quote.value = recovered.quote;
  else { quote.value = null; if (config.value) config.value.unresolvedIntent = undefined; }
  uncertain.value = false; pendingQuoteNo.value = null;
  const pending = readPendingQuoteNo();
  if (pending && pending !== quoteNo) {
    // Recover the adopted reference with fresh configuration, just like opening its page.
    config.value = null; configPresentation.value = null; amount.value = ""; formStep.value = "account";
    order.value = null; quote.value = null; uncertain.value = true; pendingQuoteNo.value = pending;
    // Every recovery entry point reports this receipt once, before the adopted reference recovers.
    const title = recovered.state === "COMMITTED" ? c.value[bankOrderOutcome(recovered)]
      : recovered.state === "NOT_SUBMITTED" ? c.value.notSubmitted : c.value.intentClosed;
    toast.info(format(useTranslations.value.walletV3.withdrawEarlierOutcome, { outcome: title }),
      useTranslations.value.walletV3.withdrawOtherPending);
    return true;
  }
  if (recovered.state === "COMMITTED") replaceOrderInH5(recovered.withdrawalNo);
  return false;
}
async function openIntent(intent: BankIntent) {
  await run(async current => {
    uncertain.value = true; pendingQuoteNo.value = intent.quoteNo;
    if (config.value) config.value.unresolvedIntent = { state: intent.state, intents: [intent],
      quoteNo: intent.quoteNo, withdrawalNo: intent.withdrawalNo };
    const recovered = await api.recover(intent.quoteNo); if (!current()) return;
    applyRecovery(recovered, intent.quoteNo);
  });
}
function manageBank() { if (!navigationLocked.value && !quote.value && !uncertain.value && !multipleIntents.value.length) navTo("/pages/me/wallet-cards-new?returnTo=%2Fpages%2Fme%2Fwallet-withdraw-bank"); }
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
    if (!canSubmit.value) return;
    const no = quote.value!.quoteNo;
    const pending = readPendingQuoteNo();
    if (pending && pending !== no) {
      config.value = null; configPresentation.value = null; amount.value = ""; formStep.value = "account";
      quote.value = null; accepted.value = false; uncertain.value = true; pendingQuoteNo.value = pending;
      const recovered = await api.recover(pending); if (!current()) return;
      if (recovered.state !== "COMMITTED") {
        const loaded = await api.config(); if (!current()) return;
        config.value = loaded; configPresentation.value = { owner: app.accountKey, epoch: app.accountBindingEpoch, value: loaded };
      }
      applyRecovery(recovered, pending);
      return;
    }
    uni.setStorageSync(pendingKey(), no); // Recovery reference only; never persist bank details, OTPs or balances.
    if (uni.getStorageSync(pendingKey()) !== no) throw new Error("BANK_RECOVERY_NOT_DURABLE");
    uncertain.value = true; pendingQuoteNo.value = no;
    try {
      const value = await api.submit(no, `bank-submit:${no}`);
      if (current()) applyRecovery(value, no);
    } catch (cause) {
      if (!current()) throw cause;
      if (isApiRefusal(cause, 409, "BANK_QUOTE_RECONFIRM_REQUIRED")) {
        refusedQuoteNo.value = no;
        if (readPendingQuoteNo() === no) uni.removeStorageSync(pendingKey());
        accepted.value = false; uncertain.value = false; pendingQuoteNo.value = null;
        return;
      }
      if (!isApiRefusal(cause, 409, "WITHDRAWAL_BALANCE_LIMIT_EXCEEDED",
        "WITHDRAWAL_RELEASE_BUCKET_INSUFFICIENT", "WITHDRAWAL_DAILY_LIMIT_EXCEEDED")) throw cause;
      capacityRefusalQuoteNo = no;
    }
  });
}
async function abandon() {
  if (!quote.value || busy.value || uncertain.value) return;
  await run(async current => {
    const no = quote.value!.quoteNo;
    uncertain.value = true; pendingQuoteNo.value = no;
    const recovered = await api.abandon(no); if (!current()) return;
    const switched = applyRecovery(recovered, no);
    if (!switched && (recovered.state === "ABANDONED" || recovered.state === "EXPIRED")) {
      config.value = null; formStep.value = "amount";
      const owner = app.accountKey, epoch = app.accountBindingEpoch;
      const loaded = await api.config(); if (current()) {
        config.value = loaded; configPresentation.value = { owner, epoch, value: loaded };
      }
    }
  });
}
function replaceOrderInH5(orderNo: string | null) {
  // #ifdef H5
  const location = routeHistory.location;
  const question = location.indexOf("?");
  const path = question < 0 ? location : location.slice(0, question);
  if (path !== "/pages/me/wallet-withdraw-bank") return;
  const query = new URLSearchParams(question < 0 ? "" : location.slice(question + 1));
  if (query.get("order") === orderNo) return;
  if (orderNo === null) query.delete("order");
  else query.set("order", orderNo);
  const search = query.toString();
  // Sync the router's history state without navigating or remounting the page.
  routeHistory.replace(search ? `${path}?${search}` : path);
  // #endif
}
function startNew() {
  refreshPendingAttempt();
  if (!newWithdrawalAllowed.value || !terminal.value || busy.value) return;
  replaceOrderInH5(null);
  order.value = null; quote.value = null; requestedOrder = null; amount.value = ""; formStep.value = "account"; accepted.value = false; void load();
}
function clearScope() {
  pendingQuoteNo.value = null; refusedQuoteNo.value = null; capacityRefusalQuoteNo = null; orderReadGeneration++;
  revision++; configPresentation.value = null; config.value = null; quote.value = null; order.value = null; busy.value = false; silentRead.value = false; readingConfig.value = false; configReadInFlight.value = false; error.value = ""; uncertain.value = false;
  amount.value = ""; formStep.value = "account"; accepted.value = false; lastCapacityResetRead = "";
}
function invalidate() {
  clearScope();
  if (alive && canReadVisibleBankPage()) void load();
}
watch(() => [app.accountKey, app.accountBindingEpoch, apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl] as const, clearScope, { flush: "sync" });
watch(() => [app.accountKey, app.accountBindingEpoch, apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl] as const, invalidate);
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
onUnload(() => { alive = false; visible.value = false; stopTimer(); revision++; });
</script>

<style scoped>
.bank-withdraw { padding: 0 16px 40px; color: var(--v5-ink); font-family: var(--font-v5); }
.screen-title { display: block; font-size: 26px; line-height: 1.3; font-weight: 600; letter-spacing: -.5px; overflow-wrap: break-word; }
.muted { display: block; color: var(--v5-ink-3); font-size: 12px; line-height: 1.6; overflow-wrap: break-word; }
.loading { margin-bottom: 12px; }
.account-card, .amount-card { border-radius: 16px; background: var(--v5-surface-2); padding: 18px; margin: 20px 0; }
.account-number { display: block; font-family: var(--font-metric); font-size: 20px; letter-spacing: 1px; font-variant-numeric: tabular-nums; margin: 6px 0; overflow-wrap: break-word; }
.chip { display: inline-block; border-radius: 999px; background: var(--v5-surface-2); color: var(--v5-brand); padding: 4px 10px; font-size: 12px; }
/* Page notices (pending, unknown result, routing, limits, daily count): a 16px status icon before the text instead of a
   side stripe (design-rules: warnings in the warning colour with an icon); errors in the error colour, plain facts neutral. */
.notice { --notice-glyph: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M12 8v4M12 16h.01'/%3E%3C/svg%3E"); display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; color: var(--v5-ink-2); font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); margin: 20px 0; }
.notice::before { content: ""; flex: none; width: 16px; height: 16px; margin-top: calc((var(--ui-type-note-lh) - 16px) / 2); background: var(--v5-warning-ink); -webkit-mask: var(--notice-glyph) center / contain no-repeat; mask: var(--notice-glyph) center / contain no-repeat; }
.notice > text { flex: 1 1 0; min-width: 0; overflow-wrap: break-word; }
.notice > .page-action { flex: 1 1 100%; }
.notice.danger::before { background: var(--v5-danger); }
@media (forced-colors: active) { .notice::before { forced-color-adjust: none; background: CanvasText; } }
.danger { color: var(--v5-danger); }
.warn { color: var(--v5-warning); }
/* In-page buttons are the shared NxButton (03 §3.1); the page sets only layout. Full-width: the USDT entry and the intent
   rows (neutral glass L). Text buttons sit centred on their label
   line with the shared 44px hit layer: 重新加载 in brand; 重新填写金额 and 返回收款账户 give up or step back, so they take
   the shared quiet reverse-action style (.nx-reverse-action: ink-3, 13/18, 400) and do not compete with the bar. */
.page-action { width: 100%; margin-top: 12px; }
.bank-withdraw .page-action--intent { min-width: 0; }
.bank-withdraw .page-text-action { display: flex; width: max-content; margin: 21px auto 13px; }
/* Margins collapse, so a second text button right below takes 34: the two 44px hit layers keep 8 between them. */
.bank-withdraw .page-text-action + .page-text-action { margin-top: 34px; }
[aria-disabled="true"]:not(.nx-button) { opacity: .4; cursor: default; }
.consent:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 3px; }
.amount-input { display: flex; align-items: center; gap: 8px; border: 1px solid var(--v5-border-strong); border-radius: 12px; padding: 8px 12px; }
.amount-input input { flex: 1; min-width: 0; font-size: 26px; height: 44px; color: var(--v5-ink); }
.limits { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--v5-ink-3); margin-top: 12px; line-height: 1.5; }
.fee-rule { display: block; margin-top: 6px; }
/* 「提现说明 ›」 under the fee sentence, right-aligned (03 §3.9 文字链接). */
.rules-link { display: flex; justify-content: flex-end; min-height: 44px; align-items: center; margin: 4px 0 0; }
.rules-link :deep(text) { white-space: nowrap; }
.details { margin: 20px 0; }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--v5-border); font-size: var(--ui-type-list-subtitle); }
/* The label wraps before a value is squeezed: amounts and dates stay on one line, the code ellipsizes in the middle. */
.row > text:first-child { flex: 0 1 auto; min-width: 0; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.row > text:last-child { flex: none; white-space: nowrap; text-align: right; font-variant-numeric: tabular-nums; }
.row--code { align-items: center; }
/* Result amount: the 10.1 钱包主金额上限 role (390: 36/44, 360: 32/38), the page's main amount, at 500 (01.2). The unit follows
   a no-break space (03 §3.6.1) instead of a margin. */
.money { display: block; margin-top: 8px; font: 500 var(--ui-type-wallet-amount)/var(--ui-type-wallet-amount-lh) var(--font-amount); font-variant-numeric: tabular-nums; white-space: nowrap; }
.money__unit { margin-left: 4px; color: var(--v5-ink-3); font: 500 max(12px, .4em)/16px var(--font-v5); }
/* Result: centred head, then the amount; actions sit in the fixed bar. */
.result-head { margin: var(--v5-space-2) 0 var(--v5-space-1); }
.intent-code { max-width: 100%; color: inherit; }
.consent { display: flex; align-items: flex-start; gap: 10px; min-height: 44px; font-size: 12px; line-height: 1.6; cursor: pointer; margin-bottom: 10px; }
.checkbox { width: 20px; height: 20px; flex-shrink: 0; border: 1px solid var(--v5-border-strong); border-radius: 4px; display: flex; align-items: center; justify-content: center; }
.checkbox.checked { background: var(--v5-brand); color: var(--v5-on-brand); border-color: var(--v5-brand); }
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
/* The card's NxTag (03 §3.8) in the card-face colours, not the theme's (04.4): available green, otherwise amber; 14% fill,
   24% ring. Size, padding and type stay NxTag's. */
.bcard .bcard__tag { --bcard-tag: var(--bcard-ok); background: color-mix(in srgb, var(--bcard-tag) 14%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bcard-tag) 24%, transparent); color: var(--bcard-tag); }
.bcard .bcard__tag.nx-tag--warning { --bcard-tag: var(--bcard-warn); }
.bcard__bot { position: relative; display: flex; align-items: flex-end; justify-content: space-between; margin-top: auto; }
.bcard__lb { display: block; color: color-mix(in srgb, white 55%, transparent); font: 400 12px/16px var(--font-v5); }
.bcard__no { display: block; margin-top: 4px; font: 500 26px/32px var(--font-metric); letter-spacing: .08em; text-shadow: 0 1px 0 rgba(0,0,0,.45); }
.bcard__cur { color: color-mix(in srgb, white 55%, transparent); font: 500 12px/16px var(--font-metric); letter-spacing: .08em; }
.note { display: flex; align-items: flex-start; gap: 8px; margin: 14px 4px 0; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); }
.note--debt { color: var(--v5-ink-2); }
.note--debt svg { flex-shrink: 0; margin-top: 2px; color: var(--v5-warning-ink); }
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
/* The quote amount: the 10.1 钱包主金额上限 role (390: 36/44, 360: 32/38) at 500 (01.2, as the result amount); the amount
   input keeps its own size (10.2). */
.slab__amt { display: block; margin-top: 4px; color: var(--v5-ink); font: 500 var(--ui-type-wallet-amount)/var(--ui-type-wallet-amount-lh) var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.slab__unit { margin-left: 6px; color: var(--v5-ink-3); font: 500 12px/16px var(--font-v5); letter-spacing: 0; }
/* The quote amount follows the 01.2 anatomy: integer in main ink, decimals and unit in secondary ink, unit max(12px, .4em),
   after a no-break space (03 §3.6.1), not the input row's 6px margin. The unit beside the amount input keeps 12/16 (10.2:
   the amount input is outside the type roles). Descendant, not child: uni-text puts nested text inside its own span. */
.slab__dec { color: var(--v5-ink-3); }
.slab__amt .slab__unit { margin-left: 2px; font-size: max(12px, .4em); }
.slab .amount-input { display: flex; align-items: baseline; gap: 0; margin-top: 4px; padding: 0; border: 0; border-radius: 0; }
.slab .amount-input input { flex: 0 1 auto; max-width: calc(100% - 48px); height: 48px; color: var(--v5-ink); font: 500 40px/48px var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.slab .limits { gap: 0; margin-top: 4px; font: 400 12px/18px var(--font-v5); }
.daily { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 12px 4px 0; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); }
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
.qrow__v { color: var(--v5-ink); font: var(--ui-type-inline-figure-weight) var(--ui-type-inline-figure)/var(--ui-type-inline-figure-lh) var(--font-metric); font-variant-numeric: tabular-nums; }
.tear { position: relative; height: 0; margin: 0 18px; border-top: 1.5px dashed var(--v5-border-strong); }
.tear::before, .tear::after { content: ""; position: absolute; top: -11px; width: 20px; height: 20px; border-radius: 50%; background: var(--v5-bg); }
.tear::before { left: -28px; } .tear::after { right: -28px; }
.ticket__net { padding: 14px 16px 16px; }
.ticket__net > .k:first-child { padding-top: 3.5px; }
/* The bank amount in main ink like both confirms: success colour is for status only (01 §1.1.1 rule 4); the ₫ symbol
   follows the 01.2 amount anatomy (max(12px, .55em), 500, secondary ink). Size: the 10.1 display-title role, the nearest
   to the old 28/34 (390: 26/34, 360: 24/32), in the amount face at 500 (01.2: amounts do not take 600). */
.ticket__vnd { display: block; margin-top: 4px; color: var(--v5-ink); font: 500 var(--ui-type-display-title)/var(--ui-type-display-title-lh) var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ticket__cur { margin-left: 2px; color: var(--v5-ink-3); font-size: max(12px, .55em); font-weight: 500; letter-spacing: 0; }
.ticket__net .hint { margin-top: 6px; }
.consent { margin: 16px 4px 0; }
.acct__change { position: relative; flex: none; display: inline-flex; align-items: center; height: 32px; padding: 0 12px; border-radius: var(--v5-radius-full); color: var(--v5-ink); font: 500 13px/18px var(--font-v5); cursor: pointer; }
.acct__change::after { content: ""; position: absolute; inset: -6px -2px; }
.consent { color: var(--v5-ink-3); font: 400 13px/20px var(--font-v5); }
.consent .checkbox { width: 22px; height: 22px; border-radius: 7px; font-size: 13px; }
/* Confirm: this withdrawal's rows above the rules, the recessed detail list of the USDT submit confirm. */
.cfm-rows { padding: 4px 14px; border-radius: 16px; background: color-mix(in srgb, var(--v5-ink) 4%, transparent); box-shadow: inset 0 2px 8px rgba(0,0,0,.45), inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .cfm-rows { box-shadow: inset 0 1px 4px rgba(20,16,8,.10), inset 0 0 0 1px var(--v5-border); }
.cfm-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; min-height: 40px; padding: 8px 0; box-sizing: border-box; }
.cfm-row + .cfm-row { border-top: 1px solid var(--v5-border); }
.cfm-k { min-width: 0; overflow-wrap: break-word; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.cfm-v { flex: none; white-space: nowrap; color: var(--v5-ink); font: var(--ui-type-inline-figure-weight) var(--ui-type-inline-figure)/var(--ui-type-inline-figure-lh) var(--font-metric); font-variant-numeric: tabular-nums; }
.cfm-row--amount .cfm-v { color: var(--v5-ink); font: var(--ui-type-card-figure-weight) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-amount); }
.cfm-rules-title { display: block; margin: 20px 0 12px; color: var(--v5-ink); font: var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); }
/* First config read (03 §3.4): still blocks where the bound account step's card and binding note land, no shimmer. */
.first-read__card { display: flex; flex-direction: column; justify-content: space-between; height: 208px; margin-top: 15px; padding: 20px; box-sizing: border-box; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.first-read__top, .first-read__bot { display: flex; align-items: center; gap: 10px; }
.first-read__bot { flex-direction: column; align-items: flex-start; gap: 8px; }
.first-read__dot { flex: none; width: 36px; height: 36px; border-radius: 50%; background: color-mix(in srgb, var(--v5-ink) 6%, transparent); }
.first-read__bar { height: 12px; border-radius: 6px; background: color-mix(in srgb, var(--v5-ink) 6%, transparent); }
.first-read__bar--name { width: 40%; }
.first-read__bar--tag { width: 64px; height: 24px; margin-left: auto; border-radius: 999px; }
.first-read__bar--label { width: 30%; }
.first-read__bar--no { width: 62%; height: 28px; border-radius: 8px; }
.first-read__bar--note { width: 62%; margin: 17px 4px 0; }
/* Receipt first read: the result head, amount card, account card and detail rows at their loaded sizes. */
.first-read__head { display: flex; flex-direction: column; align-items: center; padding-top: 8px; }
.first-read__dot--head { width: 56px; height: 56px; }
.first-read__bar--title { width: 36%; height: 24px; margin: 20px 0 4px; border-radius: 8px; }
.first-read__bar--desc { width: 56%; margin: 8px 0 4px; }
.first-read__bar--desc2 { width: 40%; margin: 4px 0 4px; }  /* the result description usually runs to two lines */
.first-read__bar--muted { width: 28%; margin: 4px 0; }
.first-read__bar--money { width: 52%; height: 32px; margin: 17px 0 6px; border-radius: 8px; }
.first-read__bar--account { width: 44%; height: 20px; margin: 11px 0; }
.first-read__row { align-items: center; height: 38.5px; box-sizing: border-box; }
.first-read__bar--k { width: 22%; }
.first-read__bar--v { width: 30%; }
.bar--first-read .bar__hold { flex: 1 1 100%; height: 48px; }
.bar-space { height: 110px; }
.bar-space--result { height: 168px; }
/* A reason above the button makes the tray taller: up to two note lines over the 48 button (04 §4.0 clearance). */
.bar-space--note { height: 150px; }
/* Account step with a reason: up to two note lines over the two buttons, which stack in long languages. */
.bar-space--result-note { height: 208px; }
.bar > .nx-tray-note { flex: 1 1 100%; }
/* Buttons size to their words so no label wraps; when two labels cannot share one row (long languages at 360), the bar stacks them. */
.bar { position: absolute; z-index: 36; display: flex; flex-wrap: wrap; }
.bar > .nx-button { flex: 1 1 0; }
@media (prefers-reduced-motion: reduce) { .bcard::after { animation: none; opacity: 0; } .cdw__val { transition: none; } }
</style>
