<!--
  DepositBankPane — 充值页「银行转账」通道段(PAY-规格 [FEAT-PAY02] 全部 + [FEAT-PAY03] 消费面)。
  视图随 deposits.intents 派生(状态 server-canonical,mock 引擎在 store;本组件唯一
  可写动作 = 生成付款单 / 取消 awaiting 单,与规格 ④「client 仅可取消」一致):
    form(金额输入 + 实时 ≈VND)→ order(VietQR + 收款账户 + 附言码 + 真倒计时)→
    waiting(「我已完成转账」仅 UI 等待提示,不改单状态)→ credited / expired / mismatch_review。
  牌价消费面:FxRateLine 顶部自治;fxAvailable=false 段内容置灰禁下单(② 异常1),
  换算 vndForUsdt 精确到盾、fmtVnd 千分位;牌价未返回换算位「—」不显示 0。
-->
<template>
  <view class="mx-4" style="padding: 0 2px">
    <FxRateLine v-if="paymentSessionReady" :style="paneView !== 'form' ? { display: 'none' } : undefined" :key="app.accountBindingEpoch" />
    <!-- A failed read of the rate or the order list leaves the form in place with 「—」 for what it could not read; 生成付款单
         stays grey with the reason above it in the bar while the page re-reads by itself (03 §3.4, §3.5.2). -->

    <!-- ── 下单前:金额输入 + 生成付款单 ── -->
    <template v-if="paneView === 'form' && paymentSessionReady && (fx.configReady || fx.syncFailed)">
      <!-- An unconfigured bank channel is not shown: the page hides this segment and moves to USDT. A failed read is not a
           closed channel: the form stays, its controls off, and nothing dims the rest (03 §3.4 其他内容照常). -->
      <view v-if="bankRailAvailable || fx.syncFailed" :style="fxUsable || fx.syncFailed ? undefined : disabledWrapStyle" :aria-disabled="!fxUsable">
        <view v-if="dailyCapacityExhausted" class="flex" :style="warnRowStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" style="margin-top: 3px" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><path d="M12 17h.01" /></svg>
          <view class="flex-1 min-w-0">
            <text class="block" :style="warnTextStyle">{{ fmt(t.bankPane.dailyCapacityExhaustedBody, { remaining: todayRemainingLabel, min: minLabel }) }}</text>
          </view>
        </view>
        <!-- Amount on a liquid-glass slab over a soft aura; preset amounts sit under it (selected = brand glass, others flat). -->
        <view class="nx-bank-stage">
          <view class="nx-bank-stage__aura" aria-hidden="true"><view /><view /></view>
          <view class="nx-bank-slab nx-tint">
            <text class="nx-bank-k">{{ t.bankPane.amountLabel }}</text>
            <view class="nx-bank-amtrow">
              <input
                class="nx-bank-amt"
                :style="{ width: `calc(${Math.max(amount.length, 1)} * (1ch - .02em) + 8px)` }"
                type="text"
                inputmode="numeric"
                :value="amount"
                placeholder="0"
                :disabled="creating || !fxUsable || dailyCapacityExhausted"
                :aria-label="t.bankPane.amountLabel"
                @input="onAmount"
              />
              <text class="nx-bank-unit">USDT</text>
            </view>
            <text class="nx-bank-vnd">{{ vndPreview }}</text>
            <view class="nx-bank-chips">
              <view
                v-for="preset in quickAmounts" :key="preset.value"
                class="nx-bank-chip" :class="{ 'nx-bank-chip--on': amount === String(preset.value) }"
                role="button" :tabindex="preset.enabled ? 0 : -1" :aria-disabled="!preset.enabled" :aria-pressed="amount === String(preset.value)"
                @click="pickAmount(preset)"
              ><text>{{ preset.label }}</text></view>
            </view>
          </view>
        </view>

        <!-- Same unit in all three: written once across the well and read per figure (03 §3.6.1); a fee in ₫ makes the row
             mixed, and then each figure carries its own unit. -->
        <view class="nx-bank-facts">
          <text v-if="factsUnit" class="nx-bank-facts__unit" aria-hidden="true">{{ factsUnit }}</text>
          <view class="nx-bank-fact"><text class="nx-bank-k">{{ t.bankPane.factFee }}</text><text class="nx-bank-fact__v">{{ feeFact.text }}<text v-if="feeFact.unit" :class="factsUnit ? 'nx-sr-only' : 'nx-bank-fact__u'">{{ '\u00A0' + feeFact.unit }}</text></text><text v-if="fx.configReady && fx.feeUsdt > 0 && fx.feeVnd > 0" class="nx-bank-fact__sub">{{ fmtVnd(fx.feeVnd) }}</text></view>
          <view class="nx-bank-fact"><text class="nx-bank-k">{{ t.bankPane.factTodayRemaining }}</text><text class="nx-bank-fact__v">{{ todayRemainingFact }}<text v-if="todayRemainingFact !== '—'" :class="factsUnit ? 'nx-sr-only' : 'nx-bank-fact__u'">{{ '\u00A0USDT' }}</text></text></view>
          <view class="nx-bank-fact"><text class="nx-bank-k">{{ t.bankPane.factSingleLimit }}</text><text class="nx-bank-fact__v">{{ limitFact }}<text v-if="limitFact !== '—'" :class="factsUnit ? 'nx-sr-only' : 'nx-bank-fact__u'">{{ '\u00A0USDT' }}</text></text></view>
        </view>

        <view class="nx-bank-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
          <text>{{ t.bankPane.hostedSecureNote }}</text>
        </view>
      </view>
    </template>

    <!-- ── 付款单(awaiting_payment)── -->
    <template v-else-if="paneView === 'order'">
      <view class="nx-step-in" :style="createPending || hostedRejected || intent?.paymentMode === 'hosted' ? undefined : 'margin-top: 14px'">
        <!-- Hosted bank payment (P-44): live countdown ring on glass, order summary, then the bank page in the bottom bar. -->
        <template v-if="createPending || hostedRejected || intent?.paymentMode === 'hosted'">
          <!-- Use the existing result head for an unknown or rejected create. Only confirmed orders show payment details. -->
          <view v-if="createPending || hostedRejected" class="nx-bank-state"><NxResultHead :tone="createPending ? 'warning' : 'danger'" :title="createPending ? t.bankPane.createPendingTitle : t.bankPane.hostedRejectedTitle" :description="createPending ? t.bankPane.createPendingBody : undefined" /></view>
          <view v-else class="nx-bank-stage">
            <view class="nx-bank-stage__aura" aria-hidden="true"><view /><view /></view>
            <view class="nx-bank-slab nx-bank-pay nx-tint">
                <view class="nx-bank-ring" role="timer" :aria-label="`${t.bankPane.remainingLabel} ${countdownText}`">
                  <svg width="148" height="148" viewBox="0 0 148 148" aria-hidden="true">
                    <circle class="nx-bank-ring__track" cx="74" cy="74" r="68" />
                    <circle class="nx-bank-ring__value" cx="74" cy="74" r="68" :style="{ strokeDashoffset: `${(427 * (1 - countdownRatio)).toFixed(1)}` }" />
                  </svg>
                  <view class="nx-bank-ring__c"><text class="nx-bank-ring__t">{{ countdownText }}</text><text class="nx-bank-k">{{ t.bankPane.remainingLabel }}</text></view>
                </view>
                <text class="nx-bank-cd">{{ countdownParts[0] }}<text class="nx-bank-cd__time">{{ countdownText }}</text>{{ countdownParts[1] }}</text>
            </view>
          </view>
          <view v-if="!createPending && !hostedRejected && intent" class="nx-bank-sum">
            <view class="nx-bank-sum__r"><text class="nx-bank-k">{{ t.bankPane.expectedLabel }}</text><text class="nx-bank-sum__v nx-bank-sum__v--big">{{ fmtVnd(intent.vndAmount) }}</text></view>
            <view class="nx-bank-sum__r"><text class="nx-bank-k">{{ t.bankPane.creditLabel }}</text><text class="nx-bank-sum__v">{{ formatAmount(intent.usdtAmount) + '\u00A0USDT' }}</text></view>
            <view class="nx-bank-sum__r"><text class="nx-bank-k">{{ t.fx.rateLabel }}</text><text class="nx-bank-sum__v">1 USDT ≈ {{ fmtVnd(intent.fxRate) }}</text></view>
          </view>
          <view v-if="!createPending && !hostedRejected" class="nx-bank-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
            <text>{{ hostedCanOpen ? t.bankPane.hostedSecureNote : t.bankPane.hostedPendingNote }}</text>
          </view>
          <view v-if="createPending || hostedRejected" class="nx-bank-link-row"><NxButton class="nx-bank-support-link" variant="link" icon="chevron-right" :label="t.help.contactSupport" @click="goSupport" /></view>
        </template>

        <template v-else-if="intent">
        <view><text class="nx-bank-manual__cd">{{ fmt(t.bankPane.countdown, { time: countdownText }) }}</text></view>
        <view><text class="nx-bank-manual__amt">{{ fmtVnd(intent.vndAmount) }}</text></view>
        <view><text class="nx-bank-manual__line">{{ creditLineText }}</text></view>
        </template>

        <template v-if="intent && intent.paymentMode !== 'hosted'">
        <!-- 远程没有服务端签发的二维码载荷时，禁止展示本地点阵与扫码文案。 -->
        <view v-if="intent.qrPayload" :style="qrBoxStyle">
          <image :src="intent.qrPayload" mode="aspectFit" style="width: 100%; height: 100%" />
        </view>
        <view v-if="intent.qrPayload"><text class="nx-bank-manual__line nx-bank-manual__line--scan">{{ t.bankPane.scanHint }}</text></view>

        <!-- 收款账户(完整账号,转账要用,不脱敏;规格 ③) -->
        <view style="margin-top: 14px">
          <view class="flex items-center justify-between" :style="bankRowStyle">
            <view class="shrink-0"><text :style="bankKeyStyle">{{ t.bankPane.accountName }}</text></view>
            <view class="min-w-0"><text :style="bankTextStyle">{{ intent.bankAccount?.accountName }}</text></view>
          </view>
          <view class="flex items-center justify-between" :style="bankRowStyle">
            <view class="shrink-0"><text :style="bankKeyStyle">{{ t.bankPane.accountNo }}</text></view>
            <view class="flex items-center min-w-0" style="gap: 4px">
              <text class="font-mono-tabular" :style="bankFigStyle">{{ intent.bankAccount?.accountNumber }}</text>
              <view
                class="nx-bank-copy-account-cta grid place-items-center shrink-0 active:opacity-80"
                :style="copyIconBtnStyle"
                role="button" tabindex="0"
                :aria-label="t.bankPane.copyCta"
                @click="copyAccount"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
              </view>
            </view>
          </view>
          <view class="flex items-center justify-between" :style="bankRowStyle">
            <view class="shrink-0"><text :style="bankKeyStyle">{{ t.bankPane.bankLabel }}</text></view>
            <view class="min-w-0"><text :style="bankTextStyle">{{ intent.bankAccount?.bankName }}</text></view>
          </view>
        </view>

        <!-- 附言码强调块 + 复制(转账匹配的生命线,规格「务必填写」) -->
        <view class="nx-bank-memo">
          <view class="flex-1 min-w-0">
            <text class="nx-bank-memo__k">{{ t.bankPane.memoLabel }}</text>
            <text class="nx-bank-memo__code">{{ intent.memoCode }}</text>
          </view>
          <!-- The shared compact copy control, as on the USDT ticket: brand glass S, 32px with a 44px target (03 §3.1). -->
          <NxButton class="nx-bank-copy-memo-cta" variant="brand" size="small" :label="t.bankPane.copyCta" @click="copyMemo" />
        </view>

        <!-- 三步指引 -->
        <view style="margin-top: 14px">
          <view v-for="(s, i) in steps" :key="i" class="nx-bank-step">
            <text class="nx-bank-step__n">{{ i + 1 }}</text>
            <text class="nx-bank-step__t">{{ s }}</text>
          </view>
        </view>

        </template>
        <!-- HDPay 无关闭订单/退款接口，provider order 创建后禁止制造本地取消分叉。 -->
        <!-- No 取消订单 on a manual order: B28 retired the manual rail and the server refuses its cancel (410); a hosted
             provider order has no close interface either. -->
      </view>
    </template>

    <!-- ── 等待回调(仅 UI 等待提示,单仍 awaiting;到点过期由 store 引擎翻面)── -->
    <template v-else-if="paneView === 'waiting' || reviewCopy">
      <!-- Waiting, expired and mismatch open with the shared result head (03 §3.6.1), as credited does. -->
      <view class="nx-bank-state nx-step-in"><NxResultHead tone="warning" :title="reviewCopy?.title ?? t.bankPane.waitingTitle" :description="reviewCopy?.body ?? t.bankPane.waitingBody" /></view>
      <view class="nx-bank-link-row"><NxButton class="nx-bank-support-link" variant="link" icon="chevron-right" :label="reviewCopy ? t.help.contactSupport : t.topupChrome.depositNotArrived" @click="goSupport" /></view>
    </template>

    <!-- ── 成功(credited)── -->
    <template v-else-if="paneView === 'credited' && intent">
      <!-- Credited: the shared result head (03 §3.6.1: 56px success circle, its one-time pop), the credited amount and its line
           in the head's slot, then a details card; actions sit in the bottom bar. -->
      <view class="nx-bank-done nx-step-in">
        <NxResultHead tone="success" :title="t.bankPane.successTitle">
          <text class="nx-bank-done__amt">+{{ formatTruncatedAmount(creditedUsdt).replace(/\.\d*$/, "") }}<text class="nx-bank-done__dec">{{ formatTruncatedAmount(creditedUsdt).replace(/^[^.]*/, "") }}</text><text class="nx-bank-done__unit">{{ '\u00A0' }}USDT</text></text>
          <text class="nx-bank-done__line">{{ fmt(t.bankPane.successLine, { rate: fmtVnd(intent.fxRate) }) }}</text>
        </NxResultHead>
      </view>
      <view class="nx-bank-sum nx-bank-sum--done">
        <view class="nx-bank-sum__r"><text class="nx-bank-k">{{ t.bankPane.methodLabel }}</text><text class="nx-bank-sum__v nx-bank-sum__v--text">{{ t.bankPane.segBank }}</text></view>
        <view class="nx-bank-sum__r"><text class="nx-bank-k">{{ t.bankPane.expectedLabel }}</text><text class="nx-bank-sum__v">{{ fmtVnd(intent.vndAmount) }}</text></view>
        <view v-if="creditedAtText" class="nx-bank-sum__r"><text class="nx-bank-k">{{ t.bankPane.creditedAtLabel }}</text><text class="nx-bank-sum__v">{{ creditedAtText }}</text></view>
      </view>
    </template>

    <!-- ── 过期(expired;迟到转账已登记时加人工核对行)── -->
    <template v-else-if="paneView === 'expired' && intent">
      <!-- Closed by timeout: neutral with the clock glyph, as the checkout's expired order (03 §3.8). -->
      <view class="nx-bank-state nx-step-in"><NxResultHead tone="neutral" icon="clock" :title="t.bankPane.expiredTitle" :description="fmt(t.bankPane.expiredBody, { min: lockMinText })" /></view>
      <view v-if="intent.receivedVnd" class="flex" :style="warnRowStyle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" style="margin-top: 3px" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
        <view class="flex-1 min-w-0"><text :style="warnTextStyle">{{ t.bankPane.lateNote }}</text></view>
      </view>
      <view class="nx-bank-link-row"><NxButton class="nx-bank-support-link" variant="link" icon="chevron-right" :label="t.topupChrome.depositNotArrived" @click="goSupport" /></view>
      <view v-for="choice in existingPaymentChoices" :key="choice.intentId" class="nx-bank-link-row">
        <NxButton class="nx-bank-existing-order-cta" variant="link" icon="chevron-right"
          :label="`${t.store.viewDetails} · ${t.store.pendingBarLabel} · ${formatAmount(choice.usdtAmount)}\u00A0USDT`"
          :disabled="!canSelectExistingPayment(choice)" @click="selectExistingPayment(choice)" />
      </view>
    </template>

    <!-- ── 金额不符(mismatch_review 黄警示态)── -->
    <template v-else-if="paneView === 'mismatch' && intent">
      <!-- The check that follows is the head's line, so no second warning row repeats the head's warning (03 §3.6.1). -->
      <view class="nx-bank-state nx-step-in"><NxResultHead tone="warning" icon="alert" :title="t.bankPane.mismatchTitle" :description="t.bankPane.mismatchBody" /></view>
      <view style="margin-top: 10px">
        <view class="flex items-center justify-between" :style="bankRowStyle">
          <view class="shrink-0"><text :style="bankKeyStyle">{{ t.bankPane.expectedLabel }}</text></view>
          <view class="min-w-0"><text class="nx-bank-fig">{{ fmtVnd(intent.vndAmount) }}</text></view>
        </view>
        <view class="flex items-center justify-between" :style="bankRowStyle">
          <view class="shrink-0"><text :style="bankKeyStyle">{{ t.bankPane.receivedLabel }}</text></view>
          <view class="min-w-0"><text class="nx-bank-fig">{{ fmtVnd(intent.receivedVnd ?? 0) }}</text></view>
        </view>
      </view>
      <view class="nx-bank-link-row"><NxButton class="nx-bank-support-link" variant="link" icon="chevron-right" :label="t.topupChrome.depositNotArrived" @click="goSupport" /></view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { formatFinanceAmount as formatAmount } from "@/lib/finance-amount-display";
import { formatGroupedAmount, formatTruncatedAmount } from "@/lib/amount-display";
import { formatDisplayDateTime } from "@/lib/display-date";
import { useLocaleStore } from "@/store/locale";
import { ref, computed, watch, onMounted, onUnmounted, type CSSProperties } from "vue";
import { onShow, onHide, onUnload, useVisibleInterval } from "@/composables/use-tab-page-lifecycle";
import FxRateLine from "@/components/me/fx-rate-line.vue";
import NxResultHead from "@/components/ui/nx-result-head.vue";
import NxButton from "@/components/ui/nx-button.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { navBack, navTo } from "@/lib/route";
import { toast } from "@/store/ui";
import { useDeposits } from "@/store/deposits";
import { useFx } from "@/store/fx";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { binarySessionReady as accountSessionReady } from "@/lib/binary-session-ready";
import { vndForUsdt } from "@/store/fx-core";
import { mockServerNow } from "@/store/server-time";
import { BANK_MAX_DEPOSIT_USDT, MIN_DEPOSIT_USDT } from "@/store/deposits-core";
import type { DepositIntent } from "@/store/types";
import { remoteApiEnabled, sessionVault } from "@/api/runtime";
import { ApiError } from "@/api/errors";
import { runRecoverableFundsOperation } from "@/lib/recoverable-funds-operation";
import { buildVietQrTransferSteps, vietQrCreateUnavailableCopy } from "@/lib/vietqr-remote-safety";
import { findResumablePaymentIntent, openHostedPaymentPage, validateHostedPaymentUrl } from "@/lib/hosted-payment";

const t = useT();
const fx = useFx();
const dep = useDeposits();
const app = useApp();
const auth = useAuth();
const paymentSessionReady = computed(() => {
  void app.accountBindingEpoch;
  return accountSessionReady({
    remote: remoteApiEnabled,
    authenticated: auth.isAuthenticated,
    accountId: auth.accountId,
    appAccountKey: app.accountKey,
    sessionUserId: sessionVault.read()?.user.userId ?? null,
  });
});

// ── 视图派生(单选真源 = store intents;本地只记「正在看哪张单」+ UI 等待旗)──
const viewIntentId = ref<string | null>(null);
const paidPressed = ref(false);
const autoResumePending = ref(true);
const openingHosted = ref(false);
const pageActive = ref(false);
const readError = ref("");
const readRetryPending = ref(false);
const readRetryBusy = computed(() => readRetryPending.value || fx.loading || dep.serverStatus === "loading");
const fxReadFailure = computed(() => paymentSessionReady.value && fx.syncFailed ? t.value.bankPane.createFxUnavailable : "");
const readFailure = computed(() => readError.value || fxReadFailure.value);
useAutoRecovery({
  failed: () => pageActive.value && paymentSessionReady.value && !readRetryBusy.value && !!readFailure.value,
  retry: retryReadData,
  repeatMs: 30_000,
});
async function retryReadData() {
  if (!pageActive.value || !paymentSessionReady.value || readRetryBusy.value) return;
  const accountKey = app.accountKey, bindingEpoch = app.accountBindingEpoch;
  readRetryPending.value = true;
  try {
    const results = await Promise.allSettled([fx.load(), dep.refreshRemoteVietQrDeposits()]);
    if (!pageActive.value || !paymentSessionReady.value || accountKey !== app.accountKey || bindingEpoch !== app.accountBindingEpoch) return;
    readError.value = dep.serverStatus === "error" || results.some(result => result.status === "rejected")
      ? t.value.topupChrome.depositReadRetrying : "";
  } finally { readRetryPending.value = false; }
}
type PaymentReadScope = { accountKey: string; bindingEpoch: number };
const confirmedCreateRejection = ref<PaymentReadScope | null>(null);
const currentCreateRejected = computed(() => paymentSessionReady.value
  && confirmedCreateRejection.value?.accountKey === app.accountKey
  && confirmedCreateRejection.value.bindingEpoch === app.accountBindingEpoch);
type ExistingPaymentChoice = PaymentReadScope & { intentId: string; usdtAmount: number; expireAt: number; paymentUrl: string };
let pendingPaymentRead: (PaymentReadScope & { intents: DepositIntent[] }) | null = null;
const successfulPaymentRead = ref<PaymentReadScope | null>(null);
const existingPaymentChoice = ref<ExistingPaymentChoice | null>(null);

const createPending = computed(() => paymentSessionReady.value && dep.currentAccountKey() === app.accountKey
  && dep.remoteBankCreatePending);
const intent = computed<DepositIntent | null>(
  () => createPending.value ? dep.remoteBankCreateIntent : dep.intents.find(i => i.intentId === viewIntentId.value) ?? null,
);

type PaneView = "form" | "order" | "waiting" | "credited" | "expired" | "mismatch" | "receipt_review" | "late_review";
const paneView = computed<PaneView>(() => {
  if (createPending.value || currentCreateRejected.value) return "order";
  const it = intent.value;
  if (!it || it.status === "cancelled" || it.status === "return_pending") return "form";
  if (it.status === "awaiting_payment") return paidPressed.value ? "waiting" : "order";
  return it.status === "mismatch_review" ? "mismatch" : it.status;
});
const reviewCopy = computed(() => {
  const copy = t.value.bankPane;
  if (paneView.value === "receipt_review") return { title: copy.receiptReviewTitle, body: copy.receiptReviewBody };
  if (paneView.value === "late_review") return { title: copy.lateReviewTitle, body: copy.lateReviewBody };
  return null;
});

// 进段即接管在途单 / 人工核对单(刷新不丢单;credited/expired 旧单不复活)
let pageUnloaded = false;
onShow(() => { if (!pageUnloaded) pageActive.value = true; });
onHide(() => { pageActive.value = false; });
onUnload(() => { pageUnloaded = true; pageActive.value = false; });
onMounted(() => {
  if (!pageUnloaded) pageActive.value = true;
});
watch(
  () => [pageActive.value, paymentSessionReady.value, app.accountBindingEpoch] as const,
  ([active, ready]) => {
    if (!remoteApiEnabled) return;
    if (!ready) {
      readError.value = "";
      dep.stopRemoteVietQrPolling();
      return;
    }
    if (!active) {
      readError.value = "";
      dep.startRemoteVietQrPolling(false);
      return;
    }
    const accountKey = app.accountKey;
    const bindingEpoch = app.accountBindingEpoch;
    readError.value = "";
    // 🔴 失败信号改读 store 状态,不再靠 reject:那条缝已按 ADR 改成自吞降级
    //   (docs/changes/2026-08-13-remote-refresh-resilience.md「需要失败信号的消费方
    //   改走返回值 / store 状态字段」)。若继续 .catch,缝不抛了这里就永远拿不到错,
    //   充值页的报错横幅会**静默变哑** —— 改缝必须连消费方一起改,这就是那一半。
    void dep.refreshRemoteVietQrDeposits().then(() => {
      if (!pageActive.value || !paymentSessionReady.value
          || app.accountKey !== accountKey || app.accountBindingEpoch !== bindingEpoch) return;
      if (dep.serverStatus === "error" && dep.serverError) {
        console.warn("[deposit] refresh failed:", dep.serverError);
        readError.value = t.value.topupChrome.depositReadRetrying;
      }
    });
    dep.startRemoteVietQrPolling();
  },
  { immediate: true, flush: "post" },
);
watch(
  () => [dep.serverStatus, pageActive.value, paymentSessionReady.value, app.accountKey, app.accountBindingEpoch, dep.remoteReceiptInitialStatus] as const,
  ([status, active, ready, accountKey, bindingEpoch, initialStatus], previous) => {
    if (previous && (previous[3] !== accountKey || previous[4] !== bindingEpoch)) {
      pendingPaymentRead = null;
      successfulPaymentRead.value = null;
      existingPaymentChoice.value = null;
      if (status === "loading" && previous[0] === "loading") return;
    }
    if (!remoteApiEnabled || !active || !ready || dep.currentAccountKey() !== accountKey) {
      pendingPaymentRead = null;
      successfulPaymentRead.value = null;
      existingPaymentChoice.value = null;
      return;
    }
    if (status === "loading") {
      pendingPaymentRead = initialStatus === "loading" ? { accountKey, bindingEpoch, intents: dep.intents } : null;
      successfulPaymentRead.value = null;
    } else if (status === "ready") {
      readError.value = "";
      // Only a full initial read can authorize another order; command readbacks
      // also replace intents while receipt-only pagination is in flight.
      if (initialStatus !== "ready" || pendingPaymentRead?.accountKey !== accountKey || pendingPaymentRead.bindingEpoch !== bindingEpoch
        || pendingPaymentRead.intents === dep.intents) return;
      successfulPaymentRead.value = { accountKey, bindingEpoch };
      pendingPaymentRead = null;
      const candidate = dep.intents.find(item => item.intentId !== viewIntentId.value && isExistingPaymentPayable(item));
      existingPaymentChoice.value = candidate ? { accountKey, bindingEpoch, intentId: candidate.intentId,
        usdtAmount: candidate.usdtAmount, expireAt: candidate.expireAt, paymentUrl: candidate.paymentUrl! } : null;
    } else {
      pendingPaymentRead = null;
      successfulPaymentRead.value = null;
      if (status === "error" && initialStatus === "error") readError.value = t.value.topupChrome.depositReadRetrying;
    }
  },
  { flush: "post" },
);
watch(
  () => dep.intents.map((item) => `${item.intentId}:${item.status}`).join("|"),
  () => {
    if (!autoResumePending.value || viewIntentId.value || createPending.value) return;
    const resume = findResumablePaymentIntent(dep.intents);
    if (!resume) return;
    viewIntentId.value = resume.intentId;
    autoResumePending.value = false;
  },
  { immediate: true },
);
watch(
  [pageActive, createPending, () => dep.remoteBankCreateIntent],
  ([active, pending]) => {
    if (!active || !pending) return;
    const resolved = dep.resolveRemoteBankCreate();
    if (!resolved) return;
    autoResumePending.value = false;
    viewIntentId.value = resolved.intentId;
    paidPressed.value = false;
  },
  { immediate: true },
);
watch(
  () => intent.value?.intentId,
  () => {
    paidPressed.value = false;
  },
);

// ── 金额输入(USDT 主位 + 实时 ≈VND 副显)──
const amount = ref("");
watch(() => [app.accountKey, paymentSessionReady.value], () => { amount.value = ""; });
function onAmount(e: Event) {
  if (creating.value) return;
  // 保留原输入；非法符号或超精度必须提示，不能静默变成另一笔金额。
  amount.value = (e as unknown as { detail?: { value?: string } }).detail?.value ?? "";
}
// User-entered top-up principal is a positive integer; purchase quotes and fees keep cents.
const amountValid = computed(() => /^[1-9]\d*$/.test(amount.value)
  && Number.isSafeInteger(Number(amount.value)));
const amountNum = computed(() => amountValid.value ? Number(amount.value) : 0);
const minDeposit = computed(() => remoteApiEnabled ? fx.minDepositUsdt : MIN_DEPOSIT_USDT);
const maxDeposit = computed(() => remoteApiEnabled ? fx.maxDepositUsdt : BANK_MAX_DEPOSIT_USDT);
const dailyCapacityKnown = computed(() => !remoteApiEnabled || fx.dailyCapacityKnown);
const todayRemainingDeposit = computed(() => remoteApiEnabled ? fx.todayRemainingDepositUsdt : BANK_MAX_DEPOSIT_USDT);
const bankRailAvailable = computed(() => remoteApiEnabled ? fx.vietQrEnabled : dep.bankRailAvailable);
const fxUsable = computed(() => paymentSessionReady.value && fx.fxAvailable && fx.configReady && bankRailAvailable.value);
const dailyCapacityExhausted = computed(() =>
  fxUsable.value && dailyCapacityKnown.value && todayRemainingDeposit.value < minDeposit.value,
);
const inRange = computed(() =>
  amountValid.value && amountNum.value >= minDeposit.value
  && amountNum.value <= maxDeposit.value
  && (!dailyCapacityKnown.value || amountNum.value <= todayRemainingDeposit.value),
);

function usdtLabel(value: number): string {
  return `${formatAmount(value)}\u00A0USDT`;
}
function fmtVnd(value: number): string { return `${formatAmount(value, "VND")}\u00A0₫`; }
const minLabel = computed(() => usdtLabel(minDeposit.value));
const maxLabel = computed(() => usdtLabel(maxDeposit.value));
// Facts well under the amount: unknown values stay "—", never a fabricated 0 (a failed read clears the config). Figures
// only; the template sets each unit after its figure in the smaller secondary role, as the USDT ticket does.
const limitFact = computed(() => fx.configReady ? `${shortUsdt(minDeposit.value)}\u2060–\u2060${shortUsdt(maxDeposit.value)}` : "—");
const todayRemainingLabel = computed(() => usdtLabel(todayRemainingDeposit.value));
const todayRemainingFact = computed(() => fx.configReady && dailyCapacityKnown.value ? shortUsdt(todayRemainingDeposit.value) : "—");
const feeFact = computed(() => {
  if (!fx.configReady) return { text: "—", unit: "" };
  if (fx.feeUsdt <= 0 && fx.feeVnd > 0) return { text: formatAmount(fx.feeVnd, "VND"), unit: "₫" };
  return { text: shortUsdt(Math.max(fx.feeUsdt, 0)), unit: "USDT" };
});
// Remaining and limit are always USDT; only a fee in ₫ mixes the row. Kept while the facts read "—", so the well holds its height.
const factsUnit = computed(() => feeFact.value.unit === "₫" ? "" : "USDT");
// Whole numbers for presets and the three facts ("1,000"), keeping cents only when present.
function shortUsdt(value: number): string { return formatAmount(value).replace(/\.00$/, ""); }
const quickAmounts = computed(() => [100, 500, 1000, 5000].map(value => ({ value, label: shortUsdt(value),
  enabled: fxUsable.value && !creating.value && !dailyCapacityExhausted.value && value >= minDeposit.value && value <= maxDeposit.value
    && (!dailyCapacityKnown.value || value <= todayRemainingDeposit.value) })));
function pickAmount(preset: { value: number; enabled: boolean }) {
  if (preset.enabled) amount.value = String(preset.value);
}
const amountError = computed(() => {
  if (amount.value === "" || amount.value === "." || dailyCapacityExhausted.value) return "";
  if (!amountValid.value) return t.value.bankPane.amountFormatError;
  if (amountNum.value < minDeposit.value) {
    return fmt(t.value.bankPane.minimumLimitExceeded, { min: minLabel.value });
  }
  if (amountNum.value > maxDeposit.value) {
    return fmt(t.value.bankPane.singleLimitExceeded, { max: maxLabel.value });
  }
  if (dailyCapacityKnown.value && amountNum.value > todayRemainingDeposit.value) {
    return fmt(t.value.bankPane.dailyCapacityExceeded, { max: todayRemainingLabel.value });
  }
  return "";
});
// 牌价未返回/不可用 → 占位「—」不显示 0([FEAT-PAY03] ⑤ 空状态)
const vndPreview = computed(() =>
  fxUsable.value && amountNum.value > 0
    ? fmt(t.value.bankPane.approx, { vnd: fmtVnd(vndForUsdt(amountNum.value, fx.quoteRate)) })
    : fmt(t.value.bankPane.approx, { vnd: "—" }),
);
const ctaEnabled = computed(() => fxUsable.value && inRange.value && !creating.value && !readError.value);

// ── 生成付款单(mock ~600ms 延迟演加载态:按钮内联 spinner「生成中…」)──
const creating = ref(false);
const formCtaVisible = computed(() => paneView.value === "form" && paymentSessionReady.value
  && (fx.syncFailed || (fx.configReady && bankRailAvailable.value)));
let createTimer: ReturnType<typeof setTimeout> | undefined;
function createOrder(presetUsdt?: number) {
  const usdt = presetUsdt ?? amountNum.value;
  if ((presetUsdt === undefined && !amountValid.value) || !Number.isSafeInteger(usdt)
    || creating.value || createPending.value || readError.value || !fxUsable.value || usdt < minDeposit.value
    || usdt > maxDeposit.value || (dailyCapacityKnown.value && usdt > todayRemainingDeposit.value)) return;
  creating.value = true;
  const expectedAccountKey = dep.currentAccountKey();
  createTimer = setTimeout(() => { void completeCreateOrder(usdt, expectedAccountKey); }, 600);
}
async function completeCreateOrder(usdt: number, expectedAccountKey: string) {
  const expectedAppAccountKey = app.accountKey;
  const expectedBindingEpoch = app.accountBindingEpoch;
  const stillCurrent = () => pageActive.value && app.accountKey === expectedAppAccountKey
    && app.accountBindingEpoch === expectedBindingEpoch && dep.currentAccountKey() === expectedAccountKey;
  if (remoteApiEnabled) {
    // 收款账户的日额度会在另一笔入账后变化；提交前必须重读服务端快照，
    // 不能拿进入页面时缓存的 5000 上限继续创建一张服务端必拒绝的付款单。
    await fx.load();
    if (!stillCurrent()) {
      creating.value = false;
      return;
    }
    if (!fx.fxAvailable || !fx.configReady) {
      toast.error(t.value.topupChrome.depositOpFailedNote);
      creating.value = false;
      return;
    }
    if (!fx.vietQrEnabled) {
      // The page hides the bank segment and moves to USDT; no "unavailable" message.
      creating.value = false;
      return;
    }
    if (usdt < minDeposit.value || usdt > maxDeposit.value
      || (dailyCapacityKnown.value && usdt > todayRemainingDeposit.value)) {
      const reason = usdt < minDeposit.value
        ? fmt(t.value.bankPane.minimumLimitExceeded, { min: minLabel.value })
        : usdt > maxDeposit.value
          ? fmt(t.value.bankPane.singleLimitExceeded, { max: maxLabel.value })
          : fmt(t.value.bankPane.dailyCapacityExceeded, { max: todayRemainingLabel.value });
      toast.error(reason);
      creating.value = false;
      return;
    }
  }
  if (!stillCurrent()) {
    creating.value = false;
    return;
  }
  autoResumePending.value = false;
  let approvedBusinessFailureCopy = "";
  let explicitlyRejected = false;
  await runRecoverableFundsOperation(async () => {
    try {
      const it = remoteApiEnabled
        ? await dep.createRemoteBankIntent(usdt, expectedAccountKey)
        : dep.createBankIntent(usdt);
      if (it === "pending") return null;
      if (!it) throw new Error(t.value.fx.updating);
      return it;
    } catch (cause) {
      const unavailableCopy = vietQrCreateUnavailableCopy(cause);
      if (unavailableCopy) approvedBusinessFailureCopy = t.value.bankPane[unavailableCopy];
      explicitlyRejected = cause instanceof ApiError && cause.kind === "http" && cause.status === 422
        && cause.code === 422 && cause.message === "HDPAY_ORDER_CREATE_REJECTED";
      // Another payment can consume the last daily capacity after our preflight.
      // The server remains the final authority; translate this settled 422 into
      // the same explicit today-limit guidance instead of a generic retry error.
      if (cause instanceof ApiError && cause.kind === "business"
        && cause.message === "VIETQR_DAILY_CAPACITY_EXCEEDED") {
        await fx.load();
        if (fx.fxAvailable && fx.configReady && dailyCapacityKnown.value) {
          approvedBusinessFailureCopy = fmt(t.value.bankPane.dailyCapacityExceeded, {
            max: todayRemainingLabel.value,
          });
        }
      }
      throw cause;
    }
    }, {
      success: (it) => {
        if (!stillCurrent() || !it) return;
        viewIntentId.value = it.intentId;
        paidPressed.value = false;
        if (it.status === "awaiting_payment" && hostedCanOpen.value) openHostedOrder(it);
      },
      failure: (reason) => {
        if (!stillCurrent()) return;
        if (explicitlyRejected) {
          // The 422 is tied to this submit and carries no intent ID.
          startNewTopup();
          confirmedCreateRejection.value = { accountKey: expectedAppAccountKey, bindingEpoch: expectedBindingEpoch };
          return;
        }
        toast.error(approvedBusinessFailureCopy || reason);
      },
      settled: () => { creating.value = false; },
      // lib 新契约:fallback = 用户面人话(原始 cause 由 lib 进日志)。审计 R3 抓获:此处
      // 曾仍传 "VIETQR_CREATE_FAILED",lib 改版后它从「极端边界才漏出」变成「每次失败必弹」。
    }, t.value.bankPane.createFailedNote);
}
/** 整数金额可显式重建；历史小数单保留原快照并返回整数输入，不创建新收款。 */
function regen() {
  const it = intent.value;
  if (!it) return;
  if (!Number.isSafeInteger(it.usdtAmount)) {
    startNewTopup(); amount.value = "";
    toast.warn(t.value.bankPane.amountFormatError);
    return;
  }
  createOrder(it.usdtAmount);
}
async function finishCreditedFlow() {
  if (remoteApiEnabled) {
    const accountScope = app.captureRemoteAccountRequest();
    if (!(await app.refreshRemoteFleet(accountScope))) {
      if (pageActive.value) toast.warn(t.value.topupChrome.depositOpFailedNote);
      return;
    }
    if (!pageActive.value) return;
  }
  navBack("/pages/me/me");
}
// Resubmit of the create whose outcome is unknown (BUG-819), started only by the user from the bottom bar (03 §3.5.2).
// Placeholder, wired by the logic side: replay the original create under its original key in the body below. The bar
// shows its busy state and takes no second tap while replayingCreate is true.
const replayingCreate = ref(false);
async function replayPendingCreate() {
  if (replayingCreate.value) return;
  replayingCreate.value = true;
  try {
    // Logic side: replay the original create key here.
  } finally { replayingCreate.value = false; }
}
function startNewTopup() {
  autoResumePending.value = false;
  confirmedCreateRejection.value = null;
  viewIntentId.value = null;
  paidPressed.value = false;
}

// ── 真倒计时(派生自 expireAt,与 store 过期引擎同源;到点 store 翻 expired 视图自换)──
const nowTick = ref(mockServerNow());
let hostedOpenTimer: ReturnType<typeof setTimeout> | undefined;
useVisibleInterval(() => { nowTick.value = mockServerNow(); }, 1000);
onUnmounted(() => {
  pageActive.value = false;
  if (createTimer) clearTimeout(createTimer);
  if (hostedOpenTimer) clearTimeout(hostedOpenTimer);
  if (remoteApiEnabled) dep.stopRemoteVietQrPolling();
});
const countdownText = computed(() => {
  const it = intent.value;
  if (!it) return "00:00";
  const left = Math.max(0, Math.floor((it.expireAt - nowTick.value) / 1000));
  return `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
});
// Ring share of the lock window still left; the copy keeps the time as its own bold run.
const countdownRatio = computed(() => {
  const it = intent.value;
  const total = it ? it.expireAt - it.createdAt : 0;
  return it && total > 0 ? Math.min(1, Math.max(0, (it.expireAt - nowTick.value) / total)) : 0;
});
const countdownParts = computed(() => { const [head = "", tail = ""] = t.value.bankPane.countdown.split("{time}"); return [head, tail]; });
const hostedRejected = computed(() => !createPending.value && (currentCreateRejected.value
  || (intent.value?.paymentMode === "hosted" && intent.value.providerStatus === "rejected")));
const hostedCanOpen = computed(() => !createPending.value && intent.value?.paymentMode === "hosted"
  && intent.value.providerStatus === "created"
  && Boolean(intent.value.paymentUrl));
const existingPaymentChoices = computed(() => {
  const choice = existingPaymentChoice.value;
  void nowTick.value;
  return choice && remoteApiEnabled && pageActive.value && paymentSessionReady.value && paneView.value === "expired"
    && !paidPressed.value && !intent.value?.receivedVnd && !intent.value?.matchedAt
    && intent.value?.providerStatus !== "pending" && intent.value?.providerStatus !== "submit_unknown"
    && !dep.records.some(record => record.depositId === viewIntentId.value && record.creditedUsdt > 0)
    && !dep.remoteReceipts.some(receipt => receipt.intentNo === viewIntentId.value)
    && choice.accountKey === app.accountKey && choice.bindingEpoch === app.accountBindingEpoch
    && choice.intentId !== viewIntentId.value && choice.expireAt > mockServerNow() ? [choice] : [];
});
function isExistingPaymentPayable(item: DepositIntent) {
  return item.status === "awaiting_payment" && item.paymentMode === "hosted" && item.providerStatus === "created"
    && item.expireAt > mockServerNow() && Boolean(item.paymentUrl && validateHostedPaymentUrl(item.paymentUrl))
    && !item.receivedVnd && !item.matchedAt
    && !dep.records.some(record => record.depositId === item.intentId && record.creditedUsdt > 0)
    && !dep.remoteReceipts.some(receipt => receipt.intentNo === item.intentId);
}
function canSelectExistingPayment(choice: ExistingPaymentChoice) {
  const current = dep.intents.find(item => item.intentId === choice.intentId);
  return existingPaymentChoices.value[0] === choice && !creating.value && !openingHosted.value
    && dep.serverStatus === "ready" && dep.currentAccountKey() === choice.accountKey
    && successfulPaymentRead.value?.accountKey === choice.accountKey
    && successfulPaymentRead.value.bindingEpoch === choice.bindingEpoch
    && Boolean(current && current.usdtAmount === choice.usdtAmount && current.expireAt === choice.expireAt
      && current.paymentUrl === choice.paymentUrl && isExistingPaymentPayable(current));
}
function selectExistingPayment(choice: ExistingPaymentChoice) {
  if (!canSelectExistingPayment(choice)) return;
  viewIntentId.value = choice.intentId;
  paidPressed.value = false;
}

// ── 展示派生 ──
/** 成功态入账额读关联 DepositRecord(差额核销/迟到补入账时 ≠ 原下单额);
 *  记录与意向单同号(depositId = intentId)。 */
const creditedUsdt = computed(() => {
  const it = intent.value;
  if (!it) return 0;
  return dep.records.find((r) => r.depositId === it.intentId)?.creditedUsdt ?? it.usdtAmount;
});
const rateText = computed(() => (intent.value ? formatGroupedAmount(intent.value.fxRate, "full") : "—"));
const locale = useLocaleStore();
// Credited time comes from the credit record; without one the row is left out.
const creditedAtText = computed(() => {
  const at = intent.value ? dep.records.find((r) => r.depositId === intent.value!.intentId)?.creditedAt : undefined;
  return at ? formatDisplayDateTime(at, locale.code) : "";
});
const creditLineText = computed(() =>
  intent.value
    ? fmt(t.value.bankPane.creditLine, { usdt: formatAmount(intent.value.usdtAmount), rate: rateText.value })
    : "",
);
// 过期文案的锁价分钟数:配置未返回用「—」占位,不显示 0(同 fx-rate-line 口径)
const lockMinText = computed(() => (fx.lockWindowMin > 0 ? String(fx.lockWindowMin) : "—"));
const steps = computed(() => {
  const it = intent.value;
  return buildVietQrTransferSteps(
    it?.qrPayload,
    it?.bankAccount?.accountNumber ?? "",
    it ? fmtVnd(it.vndAmount) : "",
    {
      scan: t.value.bankPane.step1,
      manual: (account, amount) => fmt(t.value.bankPane.manualStep1, { account, amount }),
      amount: t.value.bankPane.step2,
      complete: t.value.bankPane.step3,
    },
  );
});

// ── 动作 ──
function copyText(data: string, okText: string) {
  uni.setClipboardData({
    data,
    showToast: false, // 系统 toast 恒中文,关掉,只留应用内三语 toast(同 deposit-usdt-pane 收敛)
    success: () => {
      uni.hideToast();
      toast.success(okText);
    },
    fail: () => {},
  });
}
function copyMemo() {
  if (intent.value?.memoCode) copyText(intent.value.memoCode, t.value.bankPane.memoCopied);
}
function copyAccount() {
  // 复制纯数字账号(去空格,银行 App 粘贴即用)
  if (intent.value?.bankAccount) copyText(intent.value.bankAccount.accountNumber.replace(/\s/g, ""), t.value.bankPane.accountCopied);
}
function openHostedOrder(it: DepositIntent) {
  if (openingHosted.value) return;
  if (it.paymentMode !== "hosted" || it.providerStatus !== "created" || !it.paymentUrl) {
    toast.error(t.value.bankPane.hostedOpenFailed);
    return;
  }
  openingHosted.value = true;
  if (!openHostedPaymentPage(it.paymentUrl)) {
    openingHosted.value = false;
    toast.error(t.value.bankPane.hostedOpenFailed);
    return;
  }
  hostedOpenTimer = setTimeout(() => { openingHosted.value = false; }, 1000);
}
function goSupport() {
  // cat=deposit:从充值场景进工单,预选「充值」分类(同 usdt 段入口)
  navTo("/pages/support/messages");
}
function goBills() {
  navTo("/pages/me/wallet-bills");
}

// ── styles ──
// 牌价不可用:段内容置灰禁下单([FEAT-PAY03] ② 异常1;文案由 FxRateLine 灰态给出)
const disabledWrapStyle: CSSProperties = {
  opacity: 0.45,
  pointerEvents: "none",
};
const qrBoxStyle: CSSProperties = {
  width: "160px",
  height: "160px",
  margin: "14px auto 0",
  borderRadius: "16px",
  background: "#ffffff", // QR 物理白卡,双主题固定(同 deposit-usdt-pane 先例)
  padding: "8px",
  display: "grid",
  placeItems: "center",
};
const qrGridStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  gridTemplateColumns: "repeat(21, 1fr)",
  gridTemplateRows: "repeat(21, 1fr)",
};
const qrDarkCellStyle: CSSProperties = {
  background: "rgba(0,0,0,0.85)", // QR 物理黑,白卡内固定色(同旧点阵先例)
  borderRadius: "1px",
};
const bankRowStyle: CSSProperties = {
  padding: "9px 0",
  gap: "10px",
  borderTop: "1px solid var(--v5-border)",
};
const bankKeyStyle: CSSProperties = {
  fontSize: "var(--ui-type-list-subtitle)",
  color: "var(--v5-ink-3)",
};
// Manual order rows (10.1): names in the list-subtitle role in main ink, the account number in the inline-figure role.
const bankTextStyle: CSSProperties = {
  fontSize: "var(--ui-type-list-subtitle)",
  lineHeight: "var(--ui-type-list-subtitle-lh)",
  fontWeight: "var(--ui-type-list-subtitle-weight)" as CSSProperties["fontWeight"],
  color: "var(--v5-ink)",
  textAlign: "right",
};
const bankFigStyle: CSSProperties = {
  fontSize: "var(--ui-type-inline-figure)",
  lineHeight: "var(--ui-type-inline-figure-lh)",
  fontWeight: "var(--ui-type-inline-figure-weight)" as CSSProperties["fontWeight"],
  color: "var(--v5-ink)",
  whiteSpace: "nowrap",
};
const copyIconBtnStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  margin: "-10px -6px -10px 0", // 44 热区不撑 9px 行距(负 margin 同 fx-rate-line 手法)
  borderRadius: "10px",
};
const warnRowStyle: CSSProperties = {
  marginTop: "8px",
  padding: "10px 12px",
  gap: "8px",
  borderRadius: "12px",
  background: "var(--v5-warning-soft)",
};
// Warning notice rows in the 辅助说明 role (10.1; 10.2 提示行) in warning ink, 4.74:1 on warning-soft (01 §1.1.1).
const warnTextStyle: CSSProperties = {
  fontSize: "var(--ui-type-description)",
  lineHeight: "var(--ui-type-description-lh)",
  color: "var(--v5-warning-ink)",
};

// ── Main actions for the page's fixed bottom bar (DS-30): one per stage, plus the credited stage's bills link. ──
type PaneAction = { className: string; label: string; enabled: boolean; busy: boolean; external: boolean; note?: string; run: () => void };
// Why 生成付款单 is grey, said once above it in the bar (03 §3.1 bottom bar). A failed rate read says the page is re-reading
// it (03 §3.5.2); a remaining capacity above 0 but under the minimum says so, as the warning above the amount does.
const createReason = computed(() => {
  if (ctaEnabled.value || creating.value) return "";
  if (readError.value) return readError.value;
  if (paymentSessionReady.value && fx.syncFailed) return t.value.bankPane.fxReadRetrying;
  if (!fxUsable.value) return t.value.bankPane.createFxUnavailable;
  if (dailyCapacityExhausted.value) return todayRemainingDeposit.value > 0
    ? fmt(t.value.bankPane.dailyCapacityBelowMin, { min: formatAmount(minDeposit.value) }) : t.value.bankPane.dailyCapacityExhaustedTitle;
  return amountError.value || t.value.bankPane.amountFormatError;
});
const primaryAction = computed<PaneAction | null>(() => {
  const it = intent.value, copy = t.value.bankPane;
  // Outcome unknown: the retried action is this page's main action and it sat in the bar, so it stays the bar's primary
  // (03 §3.1 提交动作重试 exception, 04.0), with what it does said once above it.
  if (createPending.value) return { className: "nx-bank-replay-create-cta", label: copy.createPendingReplayCta, enabled: !replayingCreate.value,
    busy: replayingCreate.value, external: false, note: copy.createPendingReplayNote, run: () => { void replayPendingCreate(); } };
  const regenAction = (enabled: boolean): PaneAction => ({ className: "nx-bank-regen-cta", label: creating.value ? copy.creating : copy.regenCta,
    enabled, busy: creating.value, external: false, run: regen });
  if (paneView.value === "form") return formCtaVisible.value ? { className: "nx-bank-create-cta", label: creating.value ? copy.creating : copy.createCta,
    enabled: ctaEnabled.value, busy: creating.value, external: false, note: createReason.value, run: () => createOrder() } : null;
  if (paneView.value === "order" && hostedRejected.value) {
    return { className: "nx-bank-new-topup-cta", label: copy.newTopupCta, enabled: !creating.value, busy: false, external: false, run: startNewTopup };
  }
  if (paneView.value === "order" && it) {
    if (it.paymentMode !== "hosted") return { className: "nx-bank-paid-cta", label: copy.paidCta, enabled: true, busy: false, external: false, run: () => { paidPressed.value = true; } };
    if (hostedCanOpen.value) return { className: "nx-bank-hosted-continue-cta", label: copy.hostedContinueCta, enabled: true, busy: false, external: true, run: () => openHostedOrder(it) };
  }
  if (paneView.value === "credited" && it) return { className: "nx-bank-done-cta", label: copy.doneCta, enabled: true, busy: false, external: false, run: () => { void finishCreditedFlow(); } };
  if (paneView.value === "expired" && it) return regenAction(!creating.value);
  if (paneView.value === "mismatch" && it) return { className: "nx-bank-new-topup-cta", label: copy.newTopupCta, enabled: true, busy: false, external: false, run: startNewTopup };
  return null;
});
const secondaryAction = computed<PaneAction | null>(() => paneView.value === "credited" && intent.value
  ? { className: "nx-bank-bills-link", label: t.value.bankPane.viewBills, enabled: true, busy: false, external: false, run: goBills } : null);
defineExpose({ paneView, primaryAction, secondaryAction });
</script>

<style scoped>
/* P-44 top-up form: amount on a tinted slab over a two-tone aura, presets, and a recessed facts well. */
.nx-bank-stage { position: relative; margin: 4px -2px 0; }
.nx-bank-stage__aura { position: absolute; inset: -8px -6px; pointer-events: none; }
.nx-bank-stage__aura > view { position: absolute; width: 180px; height: 140px; border-radius: 50%; filter: blur(42px); }
.nx-bank-stage__aura > view:first-child { left: -10px; top: -6px; background: color-mix(in srgb, var(--v5-warning) 22%, transparent); }
.nx-bank-stage__aura > view:last-child { right: -14px; bottom: 10px; background: color-mix(in srgb, var(--v5-tech-cyan) 26%, transparent); }
[data-theme="light"] .nx-bank-stage__aura > view:first-child { background: color-mix(in srgb, var(--v5-warning) 14%, transparent); }
[data-theme="light"] .nx-bank-stage__aura > view:last-child { background: color-mix(in srgb, var(--v5-tech-cyan) 16%, transparent); }
/* The slab keeps its amber as one uniform tint (.nx-tint); the aura's cyan shows around it. */
.nx-bank-slab { --nx-tint: var(--v5-warning); position: relative; padding: 23px 20px 20px; border-radius: 24px; }
.nx-bank-k { display: block; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.nx-bank-amtrow { display: flex; align-items: baseline; gap: 10px; margin-top: 6px; }
.nx-bank-amt { flex: 0 1 auto; min-width: 0; max-width: calc(100% - 74px); height: 52px; padding: 0; border: 0; outline: 0; background: transparent; color: var(--v5-ink); caret-color: var(--v5-brand);
  font: 500 44px/52px var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.nx-bank-unit { flex: none; display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 999px; background: var(--v5-surface-3); color: var(--v5-ink-2); font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.nx-bank-vnd { display: block; margin-top: 2px; color: var(--v5-ink-3); font: var(--ui-type-inline-figure-weight) var(--ui-type-inline-figure)/var(--ui-type-inline-figure-lh) var(--font-metric); font-variant-numeric: tabular-nums; white-space: nowrap; }
.nx-bank-chips { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 18px; }
.nx-bank-chip { position: relative; height: 36px; display: grid; place-items: center; border-radius: 999px; background: color-mix(in srgb, var(--v5-ink) 6%, transparent);
  color: var(--v5-ink-2); font: var(--ui-type-inline-figure-weight) var(--ui-type-inline-figure)/var(--ui-type-inline-figure-lh) var(--font-metric); font-variant-numeric: tabular-nums; cursor: pointer; transition: transform 120ms cubic-bezier(.2,.8,.2,1); }
.nx-bank-chip::after { content: ""; position: absolute; inset: -4px 0; }
/* Selected preset: flat brand tint, no glass rim or sheen inside the tinted slab (P-67). */
.nx-bank-chip--on { color: var(--v5-brand); background: color-mix(in srgb, var(--v5-brand) 14%, transparent); }
@media (forced-colors: active) { .nx-bank-chip--on { outline: 2px solid ButtonText; outline-offset: -2px; } }
.nx-bank-chip[aria-disabled="true"] { opacity: .45; cursor: default; }
.nx-bank-chip:not([aria-disabled="true"]):active { transform: scale(.97); }
.nx-bank-chip:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
/* Statistic cells: the 纯色 material (01 §1.1.2), surface with the light-only soft shadow, card corners and inset (01.3).
   Positioned so it paints over the slab's blurred aura instead of taking a corner glow. */
.nx-bank-facts { position: relative; display: grid; grid-template-columns: repeat(3, minmax(min-content, 1fr)); gap: 8px; margin: 12px -2px 0; padding: 16px; border-radius: var(--ui-radius-surface);
  background: var(--v5-surface); }
[data-theme="light"] .nx-bank-facts { box-shadow: var(--v5-glass-shadow); }
.nx-bank-facts__unit { grid-column: 1 / -1; justify-self: end; margin: -6px 0 -6px; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.nx-bank-fact { min-width: 0; }
.nx-bank-fact > .nx-bank-k { padding-top: 3px; }
.nx-bank-fact + .nx-bank-fact { padding-left: 12px; border-left: 1px solid var(--v5-border); }
/* Three-column data block (10.1 统计数值), as the USDT ticket: the figure in the metric face, its unit after it in the 辅助数值
   role and secondary ink. A figure and its unit are one unbreakable run (03 §3.6.1), so a column whose run is wider than its
   third grows to it and the others give way. */
.nx-bank-fact__v { display: block; margin-top: 2px; color: var(--v5-ink); font: var(--ui-type-metric-value-weight) var(--ui-type-metric-value)/var(--ui-type-metric-value-lh) var(--font-metric); font-variant-numeric: tabular-nums; white-space: nowrap; }
.nx-bank-fact__u { color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.nx-bank-fact__sub { display: block; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-metric); white-space: nowrap; }
.nx-bank-hint { display: flex; align-items: flex-start; gap: 8px; margin: 14px 2px 0; color: var(--v5-ink-3); font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); }
.nx-bank-hint > svg { flex: none; margin-top: 2px; color: var(--v5-success-ink, var(--v5-success)); }
/* Hosted payment: countdown ring on the glass slab, order summary card. */
/* Order/credited stages open right under the header (switch and rate line hidden); 15px clears its collapsing 12px margin as on the board. */
.nx-step-in > .nx-bank-stage:first-child { margin-top: 15px; }
.nx-bank-pay { --nx-tint: var(--v5-tech-cyan); padding: 28px 20px 22px; text-align: center; }
.nx-bank-ring { position: relative; width: 148px; height: 148px; margin: 0 auto; }
.nx-bank-ring > svg { position: absolute; inset: 0; transform: rotate(-90deg); }
.nx-bank-ring__track { fill: none; stroke: color-mix(in srgb, var(--v5-ink) 9%, transparent); stroke-width: 8; }
.nx-bank-ring__value { fill: none; stroke: var(--v5-brand); stroke-width: 8; stroke-linecap: round; stroke-dasharray: 427; transition: stroke-dashoffset 1s linear; }
.nx-bank-ring__c { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.nx-bank-ring__t { color: var(--v5-ink); font: 500 32px/38px var(--font-metric); letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.nx-bank-cd { display: block; margin-top: 16px; color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.nx-bank-cd__time { color: var(--v5-ink); font-family: var(--font-metric); font-weight: 500; font-variant-numeric: tabular-nums; }
/* Manual order (10.1 roles): countdown in 辅助说明; the amount to transfer at the 10.2 待付金额 size (page-title role) in
   Montserrat 500 (01.2: amounts never 600); the credit and scan lines in 辅助数值. */
.nx-bank-manual__cd { display: block; color: var(--v5-ink-3); text-align: center; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); font-variant-numeric: tabular-nums; }
.nx-bank-manual__amt { display: block; margin-top: 8px; color: var(--v5-ink); text-align: center; font: 500 var(--ui-type-page-title)/var(--ui-type-page-title-lh) var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.nx-bank-manual__line { display: block; margin-top: 4px; color: var(--v5-ink-3); text-align: center; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.nx-bank-manual__line--scan { margin-top: 8px; }
/* Memo block: a 12px brand-soft info block; label in 辅助数值, the code in the 卡内主数值 role in the mono face (01.2), the
   shared brand glass S copy button beside it. */
.nx-bank-memo { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; padding: 12px; border-radius: 12px; background: var(--v5-brand-soft); }
.nx-bank-memo__k { display: block; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.nx-bank-memo__code { display: block; margin-top: 2px; color: var(--v5-brand); font: var(--ui-type-card-figure-weight) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-metric); white-space: nowrap; }
.nx-bank-copy-memo-cta { flex: none; }
/* Transfer steps (04 §4.7 numbered item): 24px brand-soft index in 辅助说明 at 500, step text in 说明正文 with body ink. */
.nx-bank-step { display: flex; align-items: flex-start; gap: 10px; padding: 5px 0; }
.nx-bank-step__n { display: grid; place-items: center; flex: none; width: 24px; height: 24px; border-radius: 999px; background: var(--v5-brand-soft); color: var(--v5-brand); font: 500 var(--ui-type-description)/1 var(--font-v5); font-variant-numeric: tabular-nums; }
.nx-bank-step__t { flex: 1; min-width: 0; color: var(--v5-ink-2); font: var(--ui-type-guide-body-weight) var(--ui-type-guide-body)/var(--ui-type-guide-body-lh) var(--font-v5); overflow-wrap: break-word; }
.nx-bank-sum { margin: 12px -2px 0; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); overflow: hidden; }
.nx-bank-sum__r { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 14px 16px; }
.nx-bank-sum__r + .nx-bank-sum__r { border-top: 1px solid var(--v5-border); }
/* Summary values in the 10.1 list title role (390 15/20, 360 14/20) at its 500; the amount to pay is the card's main number
   below 30px, so the card figure role in the amount face (as the withdrawal confirm's bank amount). */
.nx-bank-sum__v { min-width: 0; color: var(--v5-ink); font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-metric); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.nx-bank-sum__v--big { font: var(--ui-type-card-figure-weight) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-amount); }
.nx-bank-sum__v--text { font-family: var(--font-v5); }
/* Credited: the shared result head over a soft success glow behind its title and amount (01 §1.1.2 page effects). */
.nx-bank-done, .nx-bank-state { position: relative; margin-top: -5px; padding: 20px 20px 8px; }
.nx-bank-done::before { content: ""; position: absolute; left: 50%; top: 54px; width: 300px; height: 180px; margin-left: -150px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-success) 20%, transparent), transparent); pointer-events: none; }
.nx-bank-done > .nx-result-head { position: relative; }
/* The credited amount is the result's main amount: the 10.1 钱包主金额上限 role (390: 36/44, 360: 32/38) at 500 (01.2), in
   main ink; success colour is for status only (01 §1.1.1 rule 4). Decimals in secondary ink, unit max(12px, .4em), 500,
   secondary ink (01.2). Cut to two places, not rounded (06 §6.2). */
.nx-bank-done__amt { position: relative; display: block; margin-top: 10px; color: var(--v5-ink); font: 500 var(--ui-type-wallet-amount)/var(--ui-type-wallet-amount-lh) var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.nx-bank-done__dec { color: var(--v5-ink-3); }
.nx-bank-done__unit { margin-left: 2px; color: var(--v5-ink-3); font: 500 max(12px, .4em)/16px var(--font-v5); letter-spacing: 0; }
.nx-bank-done__line { position: relative; display: block; margin-top: 8px; color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.nx-bank-sum--done { margin-top: 24px; }
/* Result-state entries to the next layer: the shared text link (03 §3.9), centred under the head, 44px target row. */
.nx-bank-link-row { display: flex; justify-content: center; align-items: center; min-height: 44px; margin-top: 6px; }
/* The pending-payment link's composed label wraps inside the row instead of running past it. */
.nx-bank-existing-order-cta { min-width: 0; max-width: 100%; }
.nx-bank-existing-order-cta :deep(.nx-button__content), .nx-bank-existing-order-cta :deep(uni-text), .nx-bank-existing-order-cta :deep(text) { white-space: normal; }
/* Mismatch expected/received values: the 10.1 行内数值 size, line height and weight; amounts in a label/value row keep the
   interface face (01.2 plain figures). */
.nx-bank-fig { color: var(--v5-ink); font: var(--ui-type-inline-figure-weight) var(--ui-type-inline-figure)/var(--ui-type-inline-figure-lh) var(--font-v5); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
/* Credited details: the same role, in the interface face (01.2 plain figures). */
.nx-bank-sum--done .nx-bank-sum__v { font-family: var(--font-v5); }
@media (prefers-reduced-motion: reduce) { .nx-bank-chip { transition: none; } .nx-bank-chip:not([aria-disabled="true"]):active { transform: none; } .nx-bank-ring__value { transition: none; } }
</style>
