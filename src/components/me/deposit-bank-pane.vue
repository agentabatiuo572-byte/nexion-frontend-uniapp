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
    <FxRateLine v-if="paymentSessionReady" :style="readFailure || paneView !== 'form' ? { display: 'none' } : undefined" :key="app.accountBindingEpoch" />
    <view v-if="readFailure" class="nx-bank-read-error" style="margin-top: 10px; font-size: 12px; color: var(--v5-ink-2)" role="status">
      <text>{{ readFailure }}</text>
      <view class="nx-bank-read-retry" role="button" :tabindex="readRetryBusy ? -1 : 0" :aria-disabled="readRetryBusy" style="min-height: 44px; display: flex; align-items: center; color: var(--v5-brand)" @click="retryReadData" @keydown.enter.prevent="retryReadData" @keydown.space.prevent="retryReadData">
        <text>{{ readRetryBusy ? t.help.loadingMore : t.ui.retry }}</text>
      </view>
    </view>
    <view v-if="createError" style="margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: var(--v5-danger-soft)">
      <text class="block break-all" style="font-size: 12px; line-height: 1.5; color: var(--v5-danger)">{{ createError }}</text>
      <view v-if="createRecovery" class="nx-bank-setup-recovery active-press" role="button" tabindex="0"
        @click="goCreateRecovery" @keydown.enter.prevent="goCreateRecovery" @keydown.space.prevent="goCreateRecovery"
        style="min-height: 44px; display: flex; align-items: center; color: var(--v5-brand)">
        <text>{{ t.bankPane.termsRecoveryCta }}</text>
      </view>
    </view>

    <!-- ── 下单前:金额输入 + 生成付款单 ── -->
    <template v-if="paneView === 'form' && paymentSessionReady && fx.configReady && !fx.syncFailed">
      <!-- An unconfigured bank channel is not shown: the page hides this segment and moves to USDT. -->
      <view v-if="bankRailAvailable" :style="fxUsable ? undefined : disabledWrapStyle" :aria-disabled="!fxUsable">
        <view v-if="dailyCapacityExhausted" class="flex" :style="warnRowStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" style="margin-top: 1px"><circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><path d="M12 17h.01" /></svg>
          <view class="flex-1 min-w-0">
            <text class="block" :style="warnTextStyle" style="font-weight: 600">{{ t.bankPane.dailyCapacityExhaustedTitle }}</text>
            <text class="block" :style="warnTextStyle" style="margin-top: 2px">{{ fmt(t.bankPane.dailyCapacityExhaustedBody, { remaining: todayRemainingLabel, min: minLabel }) }}</text>
          </view>
        </view>
        <!-- Amount on a liquid-glass slab over a soft aura; preset amounts sit under it (selected = brand glass, others flat). -->
        <view class="nx-bank-stage">
          <view class="nx-bank-slab nx-frosted-button">
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
                class="nx-bank-chip" :class="{ 'nx-bank-chip--on nx-frosted-button': amount === String(preset.value) }"
                role="button" :tabindex="preset.enabled ? 0 : -1" :aria-disabled="!preset.enabled" :aria-pressed="amount === String(preset.value)"
                @click="pickAmount(preset)"
              ><text>{{ preset.label }}</text></view>
            </view>
            <text v-if="amountError" class="nx-bank-err">{{ amountError }}</text>
          </view>
        </view>

        <view class="nx-bank-facts">
          <view class="nx-bank-fact"><text class="nx-bank-k">{{ t.bankPane.factFee }}</text><text class="nx-bank-fact__v">{{ feeFact }}</text><text v-if="fx.configReady && fx.feeUsdt > 0 && fx.feeVnd > 0" class="nx-bank-fact__sub">{{ fmtVnd(fx.feeVnd) }}</text></view>
          <view class="nx-bank-fact"><text class="nx-bank-k">{{ t.bankPane.factTodayRemaining }}</text><text class="nx-bank-fact__v">{{ todayRemainingFact }}</text></view>
          <view class="nx-bank-fact"><text class="nx-bank-k">{{ t.bankPane.factSingleLimit }}</text><text class="nx-bank-fact__v">{{ limitFact }}</text></view>
        </view>

        <view class="nx-bank-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
          <text>{{ t.bankPane.hostedSecureNote }}</text>
        </view>
      </view>
    </template>

    <!-- ── 付款单(awaiting_payment)── -->
    <template v-else-if="paneView === 'order' && intent">
      <view class="nx-step-in" :style="intent.paymentMode === 'hosted' ? undefined : 'margin-top: 14px'">
        <!-- Hosted bank payment (P-44): live countdown ring on glass, order summary, then the bank page in the bottom bar. -->
        <template v-if='intent.paymentMode === "hosted"'>
          <view class="nx-bank-stage">
            <view class="nx-bank-slab nx-bank-pay nx-frosted-button">
              <template v-if="!hostedRejected">
                <view class="nx-bank-ring" role="timer" :aria-label="`${t.bankPane.remainingLabel} ${countdownText}`">
                  <svg width="148" height="148" viewBox="0 0 148 148" aria-hidden="true">
                    <circle class="nx-bank-ring__track" cx="74" cy="74" r="68" />
                    <circle class="nx-bank-ring__value" cx="74" cy="74" r="68" :style="{ strokeDashoffset: `${(427 * (1 - countdownRatio)).toFixed(1)}` }" />
                  </svg>
                  <view class="nx-bank-ring__c"><text class="nx-bank-ring__t">{{ countdownText }}</text><text class="nx-bank-k">{{ t.bankPane.remainingLabel }}</text></view>
                </view>
                <text class="nx-bank-cd">{{ countdownParts[0] }}<text class="nx-bank-cd__time">{{ countdownText }}</text>{{ countdownParts[1] }}</text>
              </template>
              <view v-else class="nx-bank-pay__rejected">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><path d="M12 17h.01" /></svg>
                <text>{{ t.bankPane.hostedRejectedNote }}</text>
              </view>
            </view>
          </view>
          <view class="nx-bank-sum">
            <view class="nx-bank-sum__r"><text class="nx-bank-k">{{ t.bankPane.expectedLabel }}</text><text class="nx-bank-sum__v nx-bank-sum__v--big">{{ fmtVnd(intent.vndAmount) }}</text></view>
            <view class="nx-bank-sum__r"><text class="nx-bank-k">{{ t.bankPane.creditLabel }}</text><text class="nx-bank-sum__v">{{ formatAmount(intent.usdtAmount) }} USDT</text></view>
            <view class="nx-bank-sum__r"><text class="nx-bank-k">{{ t.fx.rateLabel }}</text><text class="nx-bank-sum__v">1 USDT ≈ {{ fmtVnd(intent.fxRate) }}</text></view>
          </view>
          <view v-if="!hostedRejected" class="nx-bank-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
            <text>{{ hostedCanOpen ? t.bankPane.hostedSecureNote : t.bankPane.hostedPendingNote }}</text>
          </view>
          <view
            v-if="hostedRejected"
            :class="['nx-bank-new-topup-cta w-full grid place-items-center', creating ? '' : 'active:opacity-70']"
            :style="ghostBtnStyle" role="button" tabindex="0"
            :aria-disabled="creating"
            @click="hostedRejected && paneView === 'order' && !creating && startNewTopup()"
          >
            <text :style="ghostTextStyle">{{ t.bankPane.newTopupCta }}</text>
          </view>
          <view v-if="hostedRejected" class="nx-bank-support-link w-full grid place-items-center active:opacity-70" :style="ghostBtnStyle" role="button" tabindex="0" @click="goSupport">
            <text :style="ghostTextStyle">{{ t.help.contactSupport }}</text>
          </view>
        </template>

        <template v-else>
        <view><text class="block text-center tabular-nums" style="font-size: 13px; color: var(--v5-ink-3)">{{ fmt(t.bankPane.countdown, { time: countdownText }) }}</text></view>
        <view><text class="block text-center tabular-nums" style="margin-top: 8px; font-family: var(--font-amount); font-size: 26px; font-weight: 600; color: var(--v5-ink); white-space: nowrap">{{ fmtVnd(intent.vndAmount) }}</text></view>
        <view><text class="block text-center" style="margin-top: 4px; font-size: 12px; color: var(--v5-ink-3)">{{ creditLineText }}</text></view>
        </template>

        <template v-if="intent.paymentMode !== 'hosted'">
        <!-- 远程没有服务端签发的二维码载荷时，禁止展示本地点阵与扫码文案。 -->
        <view v-if="intent.qrPayload" :style="qrBoxStyle">
          <image :src="intent.qrPayload" mode="aspectFit" style="width: 100%; height: 100%" />
        </view>
        <view v-if="intent.qrPayload"><text class="block text-center" style="margin-top: 8px; font-size: 12px; color: var(--v5-ink-3)">{{ t.bankPane.scanHint }}</text></view>

        <!-- 收款账户(完整账号,转账要用,不脱敏;规格 ③) -->
        <view style="margin-top: 14px">
          <view class="flex items-center justify-between" :style="bankRowStyle">
            <view class="shrink-0"><text :style="bankKeyStyle">{{ t.bankPane.accountName }}</text></view>
            <view class="min-w-0"><text :style="bankValStyle">{{ intent.bankAccount?.accountName }}</text></view>
          </view>
          <view class="flex items-center justify-between" :style="bankRowStyle">
            <view class="shrink-0"><text :style="bankKeyStyle">{{ t.bankPane.accountNo }}</text></view>
            <view class="flex items-center min-w-0" style="gap: 4px">
              <text class="font-mono-tabular" :style="bankValStyle" style="white-space: nowrap">{{ intent.bankAccount?.accountNumber }}</text>
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
            <view class="min-w-0"><text :style="bankValStyle">{{ intent.bankAccount?.bankName }}</text></view>
          </view>
        </view>

        <!-- 附言码强调块 + 复制(转账匹配的生命线,规格「务必填写」) -->
        <view class="flex items-center justify-between" :style="memoBoxStyle">
          <view class="flex-1 min-w-0">
            <text class="block font-mono-tabular" :style="metaLabelStyle">{{ t.bankPane.memoLabel }}</text>
            <text class="block font-mono-code" :style="memoCodeStyle">{{ intent.memoCode }}</text>
          </view>
          <view class="nx-bank-copy-memo-cta grid place-items-center shrink-0 active:opacity-80" :style="memoCopyBtnStyle" role="button" tabindex="0" @click="copyMemo">
            <text style="font-size: 13px; font-weight: 600; color: var(--v5-ink)">{{ t.bankPane.copyCta }}</text>
          </view>
        </view>

        <!-- 三步指引 -->
        <view style="margin-top: 14px">
          <view v-for="(s, i) in steps" :key="i" class="flex items-start" style="gap: 10px; padding: 5px 0">
            <view class="grid place-items-center shrink-0" :style="stepNumStyle"><text style="font-size: 12px; font-weight: 600; color: var(--v5-brand)">{{ i + 1 }}</text></view>
            <view class="flex-1 min-w-0"><text style="font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-2); line-height: 1.5">{{ s }}</text></view>
          </view>
        </view>

        </template>
        <!-- HDPay 无关闭订单/退款接口，provider order 创建后禁止制造本地取消分叉。 -->
        <view v-if="intent.paymentMode !== 'hosted'" class="nx-bank-cancel-cta w-full grid place-items-center active:opacity-70" :style="ghostBtnStyle" role="button" tabindex="0" @click="askCancel">
          <text :style="ghostTextStyle">{{ t.bankPane.cancelCta }}</text>
        </view>
      </view>
    </template>

    <!-- ── 等待回调(仅 UI 等待提示,单仍 awaiting;到点过期由 store 引擎翻面)── -->
    <template v-else-if="paneView === 'waiting'">
      <view class="flex flex-col items-center nx-step-in" style="padding: 36px 0 8px">
        <view class="nx-bank-pulse grid place-items-center" :style="waitIconStyle">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
        </view>
        <view><text class="block text-center" :style="stateTitleStyle">{{ t.bankPane.waitingTitle }}</text></view>
        <view><text class="block text-center" :style="stateBodyStyle">{{ t.bankPane.waitingBody }}</text></view>
      </view>
      <view class="nx-bank-support-link w-full grid place-items-center active:opacity-70" :style="ghostBtnStyle" role="button" tabindex="0" @click="goSupport">
        <text :style="ghostTextStyle">{{ t.topupChrome.depositNotArrived }}</text>
      </view>
    </template>

    <!-- ── 成功(credited)── -->
    <template v-else-if="paneView === 'credited' && intent">
      <!-- Credited (P-44): medal with a one-time ring, the credited amount, then a details card; actions sit in the bottom bar. -->
      <view class="nx-bank-done nx-step-in" role="status">
        <view class="nx-bank-done__medal"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success-ink)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17 19 7.5" /></svg></view>
        <text class="nx-bank-done__title">{{ t.bankPane.successTitle }}</text>
        <text class="nx-bank-done__amt">+{{ formatAmount(creditedUsdt) }}<text class="nx-bank-done__unit">USDT</text></text>
        <text class="nx-bank-done__line">{{ fmt(t.bankPane.successLine, { rate: fmtVnd(intent.fxRate) }) }}</text>
      </view>
      <view class="nx-bank-sum nx-bank-sum--done">
        <view class="nx-bank-sum__r"><text class="nx-bank-k">{{ t.bankPane.methodLabel }}</text><text class="nx-bank-sum__v nx-bank-sum__v--text">{{ t.bankPane.segBank }}</text></view>
        <view class="nx-bank-sum__r"><text class="nx-bank-k">{{ t.bankPane.expectedLabel }}</text><text class="nx-bank-sum__v">{{ fmtVnd(intent.vndAmount) }}</text></view>
        <view v-if="creditedAtText" class="nx-bank-sum__r"><text class="nx-bank-k">{{ t.bankPane.creditedAtLabel }}</text><text class="nx-bank-sum__v">{{ creditedAtText }}</text></view>
      </view>
    </template>

    <!-- ── 过期(expired;迟到转账已登记时加人工核对行)── -->
    <template v-else-if="paneView === 'expired' && intent">
      <view class="flex flex-col items-center nx-step-in" style="padding: 32px 0 8px">
        <view class="grid place-items-center" :style="expiredIconStyle">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </view>
        <view><text class="block text-center" :style="stateTitleStyle">{{ t.bankPane.expiredTitle }}</text></view>
        <view><text class="block text-center" :style="stateBodyStyle">{{ fmt(t.bankPane.expiredBody, { min: lockMinText }) }}</text></view>
      </view>
      <view v-if="intent.receivedVnd" class="flex" :style="warnRowStyle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" style="margin-top: 1px"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
        <view class="flex-1 min-w-0"><text :style="warnTextStyle">{{ t.bankPane.lateNote }}</text></view>
      </view>
      <view class="nx-bank-support-link w-full grid place-items-center active:opacity-70" :style="ghostBtnStyle" role="button" tabindex="0" @click="goSupport">
        <text :style="ghostTextStyle">{{ t.topupChrome.depositNotArrived }}</text>
      </view>
      <view
        v-for="choice in existingPaymentChoices" :key="choice.intentId"
        class="nx-bank-existing-order-cta w-full grid place-items-center"
        :style="ghostBtnStyle" role="button" tabindex="0"
        :aria-disabled="!canSelectExistingPayment(choice)"
        @click="selectExistingPayment(choice)"
        @keydown.enter.prevent="selectExistingPayment(choice)"
        @keydown.space.prevent="selectExistingPayment(choice)"
      >
        <text :style="ghostTextStyle">{{ t.store.viewDetails }} · {{ t.store.pendingBarLabel }} · {{ formatAmount(choice.usdtAmount) }} USDT</text>
      </view>
    </template>

    <!-- ── 金额不符(mismatch_review 黄警示态)── -->
    <template v-else-if="paneView === 'mismatch' && intent">
      <view class="flex flex-col items-center nx-step-in" style="padding: 32px 0 8px">
        <view class="grid place-items-center" :style="waitIconStyle">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
        </view>
        <view><text class="block text-center" :style="stateTitleStyle">{{ t.bankPane.mismatchTitle }}</text></view>
      </view>
      <view class="flex" :style="warnRowStyle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" style="margin-top: 1px"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
        <view class="flex-1 min-w-0"><text :style="warnTextStyle">{{ t.bankPane.mismatchBody }}</text></view>
      </view>
      <view style="margin-top: 10px">
        <view class="flex items-center justify-between" :style="bankRowStyle">
          <view class="shrink-0"><text :style="bankKeyStyle">{{ t.bankPane.expectedLabel }}</text></view>
          <view class="min-w-0"><text class="tabular-nums" :style="bankValStyle" style="white-space: nowrap">{{ fmtVnd(intent.vndAmount) }}</text></view>
        </view>
        <view class="flex items-center justify-between" :style="bankRowStyle">
          <view class="shrink-0"><text :style="bankKeyStyle">{{ t.bankPane.receivedLabel }}</text></view>
          <view class="min-w-0"><text class="tabular-nums" :style="bankValStyle" style="white-space: nowrap">{{ fmtVnd(intent.receivedVnd ?? 0) }}</text></view>
        </view>
      </view>
      <view class="nx-bank-new-topup-cta w-full grid place-items-center active:opacity-70" :style="ghostBtnStyle" role="button" tabindex="0" @click="startNewTopup">
        <text :style="ghostTextStyle">{{ t.bankPane.newTopupCta }}</text>
      </view>
      <view class="nx-bank-support-link w-full grid place-items-center active:opacity-70" :style="ghostBtnStyle" role="button" tabindex="0" @click="goSupport">
        <text :style="ghostTextStyle">{{ t.topupChrome.depositNotArrived }}</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { formatFinanceAmount as formatAmount } from "@/lib/finance-amount-display";
import { formatDisplayDateTime } from "@/lib/display-date";
import { useLocaleStore } from "@/store/locale";
import { ref, computed, watch, onMounted, onUnmounted, type CSSProperties } from "vue";
import FxRateLine from "@/components/me/fx-rate-line.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { navBack, navTo } from "@/lib/route";
import { toast, confirm } from "@/store/ui";
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
import { buildVietQrTransferSteps } from "@/lib/vietqr-remote-safety";
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
const readFailure = computed(() => readError.value || (paymentSessionReady.value && fx.syncFailed ? t.value.bankPane.createFxUnavailable : ""));
useAutoRecovery({
  failed: () => pageActive.value && paymentSessionReady.value && !readRetryBusy.value && !!readFailure.value,
  retry: retryReadData,
});
async function retryReadData() {
  if (!pageActive.value || !paymentSessionReady.value || readRetryBusy.value) return;
  const accountKey = app.accountKey, bindingEpoch = app.accountBindingEpoch;
  readRetryPending.value = true;
  try {
    const results = await Promise.allSettled([fx.load(), dep.refreshRemoteVietQrDeposits()]);
    if (!pageActive.value || !paymentSessionReady.value || accountKey !== app.accountKey || bindingEpoch !== app.accountBindingEpoch) return;
    readError.value = dep.serverStatus === "error" || results.some(result => result.status === "rejected")
      ? t.value.topupChrome.depositOpFailedNote : "";
  } finally { readRetryPending.value = false; }
}
type PaymentReadScope = { accountKey: string; bindingEpoch: number };
type ExistingPaymentChoice = PaymentReadScope & { intentId: string; usdtAmount: number; expireAt: number; paymentUrl: string };
let pendingPaymentRead: (PaymentReadScope & { intents: DepositIntent[] }) | null = null;
const successfulPaymentRead = ref<PaymentReadScope | null>(null);
const existingPaymentChoice = ref<ExistingPaymentChoice | null>(null);

const intent = computed<DepositIntent | null>(
  () => dep.intents.find((i) => i.intentId === viewIntentId.value) ?? null,
);

type PaneView = "form" | "order" | "waiting" | "credited" | "expired" | "mismatch";
const paneView = computed<PaneView>(() => {
  const it = intent.value;
  if (!it || it.status === "cancelled" || it.status === "return_pending") return "form";
  if (it.status === "awaiting_payment") return paidPressed.value ? "waiting" : "order";
  if (it.status === "credited") return "credited";
  if (it.status === "expired") return "expired";
  return "mismatch";
});

// 进段即接管在途单 / 人工核对单(刷新不丢单;credited/expired 旧单不复活)
onMounted(() => {
  pageActive.value = true;
});
watch(
  () => [pageActive.value, paymentSessionReady.value, app.accountBindingEpoch] as const,
  ([active, ready]) => {
    if (!remoteApiEnabled) return;
    if (!active || !ready) {
      readError.value = "";
      dep.stopRemoteVietQrPolling();
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
        readError.value = t.value.topupChrome.depositOpFailedNote;
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
      if (status === "error" && initialStatus === "error") readError.value = t.value.topupChrome.depositOpFailedNote;
    }
  },
  { flush: "post" },
);
watch(
  () => dep.intents.map((item) => `${item.intentId}:${item.status}`).join("|"),
  () => {
    if (!autoResumePending.value || viewIntentId.value) return;
    const resume = findResumablePaymentIntent(dep.intents);
    if (!resume) return;
    viewIntentId.value = resume.intentId;
    autoResumePending.value = false;
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
function recoveryAmount(): string {
  const draft = dep.bankRecoveryDraft;
  return paymentSessionReady.value && dep.currentAccountKey() === app.accountKey
    && draft?.accountKey === app.accountKey ? draft.amount : "";
}
const amount = ref(recoveryAmount());
watch(() => [app.accountKey, paymentSessionReady.value], () => { amount.value = recoveryAmount(); });
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
  return `$${formatAmount(value)}`;
}
function fmtVnd(value: number): string { return `${formatAmount(value, "VND")} ₫`; }
const minLabel = computed(() => usdtLabel(minDeposit.value));
const maxLabel = computed(() => usdtLabel(maxDeposit.value));
// Facts well under the amount: unknown values stay "—", never a fabricated 0.
const limitFact = computed(() => fx.configReady ? `${shortUsdt(minDeposit.value)}–${shortUsdt(maxDeposit.value)}` : "—");
const todayRemainingLabel = computed(() => usdtLabel(todayRemainingDeposit.value));
const todayRemainingFact = computed(() => dailyCapacityKnown.value ? todayRemainingLabel.value : "—");
const feeFact = computed(() => {
  if (!fx.configReady) return "—";
  if (fx.feeUsdt <= 0 && fx.feeVnd > 0) return fmtVnd(fx.feeVnd);
  return `${formatAmount(Math.max(fx.feeUsdt, 0))} USDT`;
});
// Whole-dollar labels for presets and limits ("$1,000"), keeping cents only when present.
function shortUsdt(value: number): string { return usdtLabel(value).replace(/\.00$/, ""); }
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
const createError = ref("");
const createRecovery = ref<"terms" | null>(null);
const formCtaVisible = computed(() => paneView.value === "form" && paymentSessionReady.value && fx.configReady && !fx.syncFailed && bankRailAvailable.value);
function goCreateRecovery() {
  if (!paymentSessionReady.value || creating.value || dep.currentAccountKey() !== app.accountKey) return;
  if (createRecovery.value !== "terms") return;
  dep.bankRecoveryDraft = { accountKey: app.accountKey, amount: amount.value };
  navTo("/pages/onboarding/terms");
}
watch(() => app.accountBindingEpoch, () => {
  if (createRecovery.value) createError.value = "";
  createRecovery.value = null;
});
let createTimer: ReturnType<typeof setTimeout> | undefined;
function createOrder(presetUsdt?: number) {
  const usdt = presetUsdt ?? amountNum.value;
  if ((presetUsdt === undefined && !amountValid.value) || !Number.isSafeInteger(usdt)
    || creating.value || readError.value || !fxUsable.value || usdt < minDeposit.value
    || usdt > maxDeposit.value || (dailyCapacityKnown.value && usdt > todayRemainingDeposit.value)) return;
  creating.value = true;
  createRecovery.value = null;
  if (presetUsdt === undefined) createError.value = "";
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
      createError.value = t.value.topupChrome.depositOpFailedNote;
      toast.error(createError.value);
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
      createError.value = reason;
      toast.error(reason);
      creating.value = false;
      return;
    }
  }
  if (!stillCurrent()) {
    creating.value = false;
    return;
  }
  let approvedBusinessFailureCopy = "";
  await runRecoverableFundsOperation(async () => {
    try {
      const it = remoteApiEnabled
        ? await dep.createRemoteBankIntent(usdt, expectedAccountKey)
        : dep.createBankIntent(usdt);
      if (!it) throw new Error(t.value.fx.updating);
      return it;
    } catch (cause) {
      // Only translate the exact known 503 envelope; never render raw server
      // text or use this presentation choice to classify/retire a command key.
      if (cause instanceof ApiError && cause.kind === "http" && cause.status === 503 && cause.code === 503) {
        switch (cause.message) {
          case "USER_ONBOARDING_STATE_UNAVAILABLE":
            approvedBusinessFailureCopy = t.value.bankPane.createOnboardingUnavailable;
            break;
          case "LEGAL_TERMS_UNAVAILABLE":
            approvedBusinessFailureCopy = t.value.bankPane.createTermsUnavailable;
            break;
          case "FX_QUOTE_UNAVAILABLE":
            approvedBusinessFailureCopy = t.value.bankPane.createFxUnavailable;
            break;
          case "VIETQR_BANK_RAIL_UNAVAILABLE":
          case "VIETQR_CHANNEL_UNAVAILABLE":
            approvedBusinessFailureCopy = t.value.bankPane.createBankUnavailable;
            break;
          case "HDPAY_CONFIGURATION_INCOMPLETE":
          case "PAYMENT_CONFIG_UNAVAILABLE":
            approvedBusinessFailureCopy = t.value.bankPane.createServiceUnavailable;
            break;
        }
      }
      if (cause instanceof ApiError && cause.kind === "http" && cause.status === 428 && cause.code === 428) {
        if (cause.message === "LEGAL_TERMS_ACK_REQUIRED") {
          approvedBusinessFailureCopy = t.value.bankPane.termsRequired;
          if (stillCurrent()) createRecovery.value = "terms";
        }
      }
      if (cause instanceof ApiError && cause.message === "HDPAY_ORDER_CREATE_REJECTED") {
        approvedBusinessFailureCopy = t.value.bankPane.hostedRejectedNote;
      }
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
        if (!stillCurrent()) return;
        createError.value = "";
        createRecovery.value = null;
        dep.bankRecoveryDraft = null;
        autoResumePending.value = false;
        viewIntentId.value = it.intentId;
        paidPressed.value = false;
        if (pageActive.value && it.paymentMode === "hosted") openHostedOrder(it);
      },
      failure: (reason) => {
        if (!stillCurrent()) return;
        const userFacingReason = approvedBusinessFailureCopy || reason;
        createError.value = userFacingReason;
        toast.error(userFacingReason);
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
    createError.value = t.value.bankPane.amountFormatError;
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
function startNewTopup() {
  autoResumePending.value = false;
  viewIntentId.value = null;
  paidPressed.value = false;
  createError.value = "";
}

// ── 真倒计时(派生自 expireAt,与 store 过期引擎同源;到点 store 翻 expired 视图自换)──
const nowTick = ref(mockServerNow());
let tickTimer: ReturnType<typeof setInterval> | undefined;
let hostedOpenTimer: ReturnType<typeof setTimeout> | undefined;
onMounted(() => {
  tickTimer = setInterval(() => {
    nowTick.value = mockServerNow();
  }, 1000);
});
onUnmounted(() => {
  pageActive.value = false;
  if (tickTimer) clearInterval(tickTimer);
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
const hostedRejected = computed(() => intent.value?.paymentMode === "hosted"
  && intent.value.providerStatus === "rejected");
const hostedCanOpen = computed(() => intent.value?.paymentMode === "hosted"
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
  createError.value = "";
}

// ── 展示派生 ──
/** 成功态入账额读关联 DepositRecord(差额核销/迟到补入账时 ≠ 原下单额);
 *  记录与意向单同号(depositId = intentId)。 */
const creditedUsdt = computed(() => {
  const it = intent.value;
  if (!it) return 0;
  return dep.records.find((r) => r.depositId === it.intentId)?.creditedUsdt ?? it.usdtAmount;
});
const rateText = computed(() => (intent.value ? intent.value.fxRate.toLocaleString("en-US") : "—"));
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
    createError.value = t.value.bankPane.hostedOpenFailed;
    toast.error(createError.value);
    return;
  }
  openingHosted.value = true;
  if (!openHostedPaymentPage(it.paymentUrl)) {
    openingHosted.value = false;
    createError.value = t.value.bankPane.hostedOpenFailed;
    toast.error(createError.value);
    return;
  }
  hostedOpenTimer = setTimeout(() => { openingHosted.value = false; }, 1000);
}
async function askCancel() {
  const it = intent.value;
  if (!it || it.status !== "awaiting_payment") return;
  const ok = await confirm({
    title: t.value.bankPane.cancelConfirmTitle,
    message: t.value.bankPane.cancelConfirmBody,
    confirmLabel: t.value.bankPane.cancelConfirmOk,
    cancelLabel: t.value.bankPane.cancelConfirmNo,
    danger: true,
    icon: "warn",
  });
  if (!ok) return;
  const r = remoteApiEnabled
    ? await dep.cancelRemoteBankIntent(it.intentId)
    : dep.cancelBankIntent(it.intentId);
  if (r.ok) {
    toast.success(t.value.bankPane.cancelledToast);
    viewIntentId.value = null;
  } else if (r.conflict) {
    // 这张付款单在别处已经付掉 / 超时 / 撤掉了,store 已把最新状态刷回来。
    toast.warn(t.value.errors.staleTitle, t.value.errors.staleMsg);
  }
}
function goSupport() {
  // cat=deposit:从充值场景进工单,预选「充值」分类(同 usdt 段入口)
  navTo("/pages/support/messages");
}
function goBills() {
  navTo("/pages/me/wallet-bills");
}

// ── styles ──
const metaLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
// 牌价不可用:段内容置灰禁下单([FEAT-PAY03] ② 异常1;文案由 FxRateLine 灰态给出)
const disabledWrapStyle: CSSProperties = {
  opacity: 0.45,
  pointerEvents: "none",
};
const ghostBtnStyle: CSSProperties = {
  marginTop: "6px",
  minHeight: "44px",
  borderRadius: "999px",
  background: "transparent",
};
const ghostTextStyle: CSSProperties = {
  fontSize: "var(--ui-type-list-subtitle)",
  color: "var(--v5-ink-3)",
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
const bankValStyle: CSSProperties = {
  fontSize: "var(--ui-type-list-subtitle)",
  fontWeight: 500,
  color: "var(--v5-ink)",
  textAlign: "right",
};
const memoBoxStyle: CSSProperties = {
  marginTop: "10px",
  padding: "12px",
  gap: "8px",
  borderRadius: "12px",
  background: "var(--v5-brand-soft)",
};
const memoCodeStyle: CSSProperties = {
  marginTop: "2px",
  fontSize: "20px",
  fontWeight: 600,
  color: "var(--v5-brand)",
  letterSpacing: "1px",
  whiteSpace: "nowrap",
};
const memoCopyBtnStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 16px",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
};
const copyIconBtnStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  margin: "-10px -6px -10px 0", // 44 热区不撑 9px 行距(负 margin 同 fx-rate-line 手法)
  borderRadius: "10px",
};
const stepNumStyle: CSSProperties = {
  width: "22px",
  height: "22px",
  borderRadius: "50%",
  background: "var(--v5-brand-soft)",
};
const stateTitleStyle: CSSProperties = {
  marginTop: "12px",
  fontFamily: "var(--font-v5)",
  fontSize: "var(--ui-type-card-title)",
  fontWeight: "var(--ui-type-card-title-weight)",
  color: "var(--v5-ink)",
};
const stateBodyStyle: CSSProperties = {
  marginTop: "6px",
  fontSize: "13px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.55,
  maxWidth: "280px",
};
const waitIconStyle: CSSProperties = {
  width: "52px",
  height: "52px",
  borderRadius: "50%",
  background: "var(--v5-warning-soft)",
};
const expiredIconStyle: CSSProperties = {
  width: "52px",
  height: "52px",
  borderRadius: "50%",
  background: "var(--v5-surface-2)",
};
const warnRowStyle: CSSProperties = {
  marginTop: "8px",
  padding: "10px 12px",
  gap: "8px",
  borderRadius: "12px",
  background: "var(--v5-warning-soft)",
};
const warnTextStyle: CSSProperties = {
  fontSize: "12px",
  color: "var(--v5-warning)",
  lineHeight: 1.45,
};

// ── Main actions for the page's fixed bottom bar (DS-30): one per stage, plus the credited stage's bills link. ──
type PaneAction = { className: string; label: string; enabled: boolean; busy: boolean; external: boolean; run: () => void };
const primaryAction = computed<PaneAction | null>(() => {
  const it = intent.value, copy = t.value.bankPane;
  const regenAction = (enabled: boolean): PaneAction => ({ className: "nx-bank-regen-cta", label: creating.value ? copy.creating : copy.regenCta,
    enabled, busy: creating.value, external: false, run: regen });
  if (paneView.value === "form") return formCtaVisible.value ? { className: "nx-bank-create-cta", label: creating.value ? copy.creating : copy.createCta,
    enabled: ctaEnabled.value, busy: creating.value, external: false, run: () => createOrder() } : null;
  if (paneView.value === "order" && it) {
    if (it.paymentMode !== "hosted") return { className: "nx-bank-paid-cta", label: copy.paidCta, enabled: true, busy: false, external: false, run: () => { paidPressed.value = true; } };
    if (hostedCanOpen.value) return { className: "nx-bank-hosted-continue-cta", label: copy.hostedContinueCta, enabled: true, busy: false, external: true, run: () => openHostedOrder(it) };
    return hostedRejected.value ? regenAction(!creating.value && fxUsable.value) : null;
  }
  if (paneView.value === "credited" && it) return { className: "nx-bank-done-cta", label: copy.doneCta, enabled: true, busy: false, external: false, run: () => { void finishCreditedFlow(); } };
  if (paneView.value === "expired" && it) return regenAction(!creating.value);
  return null;
});
const secondaryAction = computed<PaneAction | null>(() => paneView.value === "credited" && intent.value
  ? { className: "nx-bank-bills-link", label: t.value.bankPane.viewBills, enabled: true, busy: false, external: false, run: goBills } : null);
defineExpose({ paneView, primaryAction, secondaryAction });
</script>

<style scoped>
/* 等待回调脉冲(规格 ⑤ 加载态「等待到账确认」脉冲;匹配形状,非通用转圈) */
.nx-bank-pulse {
  animation: nx-bank-pulse 1.6s ease-in-out infinite;
}
@keyframes nx-bank-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.06);
    opacity: 0.72;
  }
}
</style>

<style scoped>
/* P-44 top-up form: amount on the step's soft-glass slab, presets, and a recessed facts well. */
.nx-bank-stage { position: relative; margin: 4px -2px 0; }
/* No backdrop-filter: the slab sits on the plain page floor, and the blur only took effect while the
   page-enter animation composited the page, so the slab flashed brighter and then dimmed. */
.nx-bank-slab { position: relative; padding: 23px 20px 20px; border-radius: 24px; backdrop-filter: none; -webkit-backdrop-filter: none; }
[data-theme="light"] .nx-bank-slab { box-shadow: var(--ui-glass-edge-shadow), var(--v5-glass-shadow); }
.nx-bank-k { display: block; color: var(--v5-ink-3); font: 400 12px/16px var(--font-v5); }
.nx-bank-amtrow { display: flex; align-items: baseline; gap: 10px; margin-top: 6px; }
.nx-bank-amt { flex: 0 1 auto; min-width: 0; max-width: calc(100% - 74px); height: 52px; padding: 0; border: 0; outline: 0; background: transparent; color: var(--v5-ink); caret-color: var(--v5-brand);
  font: 500 44px/52px var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.nx-bank-unit { flex: none; display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 999px; background: var(--v5-surface-3); color: var(--v5-ink-2); font: 500 12px/16px var(--font-v5); }
.nx-bank-vnd { display: block; margin-top: 2px; color: var(--v5-ink-3); font: 500 13px/18px var(--font-metric); font-variant-numeric: tabular-nums; white-space: nowrap; }
.nx-bank-chips { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 18px; }
.nx-bank-chip { position: relative; height: 36px; display: grid; place-items: center; border-radius: 999px; background: color-mix(in srgb, var(--v5-ink) 6%, transparent);
  color: var(--v5-ink-2); font: 500 13px/18px var(--font-metric); font-variant-numeric: tabular-nums; cursor: pointer; transition: transform 120ms cubic-bezier(.2,.8,.2,1); }
.nx-bank-chip::after { content: ""; position: absolute; inset: -4px 0; }
.nx-bank-chip--on { color: var(--v5-brand); background: linear-gradient(145deg, var(--ui-button-sheen), transparent 38%, transparent 66%, var(--ui-button-sheen)), color-mix(in srgb, var(--v5-brand) 14%, transparent); }
.nx-bank-chip[aria-disabled="true"] { opacity: .45; cursor: default; }
.nx-bank-chip:not([aria-disabled="true"]):active { transform: scale(.97); }
.nx-bank-chip:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.nx-bank-err { display: block; margin-top: 10px; color: var(--v5-danger); font: 400 12px/18px var(--font-v5); }
.nx-bank-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 12px -2px 0; padding: 14px 16px; border-radius: 14px;
  background: color-mix(in srgb, var(--v5-ink) 4%, transparent); box-shadow: inset 0 2px 8px rgba(0,0,0,.45), inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .nx-bank-facts { box-shadow: inset 0 1px 4px rgba(20,16,8,.10), inset 0 0 0 1px var(--v5-border); }
.nx-bank-fact { min-width: 0; }
.nx-bank-fact > .nx-bank-k { padding-top: 3px; }
.nx-bank-fact + .nx-bank-fact { padding-left: 12px; border-left: 1px solid var(--v5-border); }
.nx-bank-fact__v { display: block; margin-top: 4px; overflow: hidden; color: var(--v5-ink); font: 500 13px/18px var(--font-metric); font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.nx-bank-fact__sub { display: block; color: var(--v5-ink-3); font: 400 11px/16px var(--font-metric); white-space: nowrap; }
.nx-bank-hint { display: flex; align-items: flex-start; gap: 8px; margin: 14px 2px 0; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); }
.nx-bank-hint > svg { flex: none; margin-top: 2px; color: var(--v5-success-ink, var(--v5-success)); }
/* Hosted payment: countdown ring on the glass slab, order summary card. */
/* Order/credited stages open right under the header (switch and rate line hidden); 15px clears its collapsing 12px margin as on the board. */
.nx-step-in > .nx-bank-stage:first-child { margin-top: 15px; }
.nx-bank-pay { padding: 28px 20px 22px; text-align: center; }
.nx-bank-ring { position: relative; width: 148px; height: 148px; margin: 0 auto; }
.nx-bank-ring > svg { position: absolute; inset: 0; transform: rotate(-90deg); }
.nx-bank-ring__track { fill: none; stroke: color-mix(in srgb, var(--v5-ink) 9%, transparent); stroke-width: 8; }
.nx-bank-ring__value { fill: none; stroke: var(--v5-brand); stroke-width: 8; stroke-linecap: round; stroke-dasharray: 427; transition: stroke-dashoffset 1s linear; }
.nx-bank-ring__c { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.nx-bank-ring__t { color: var(--v5-ink); font: 500 32px/38px var(--font-metric); letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.nx-bank-cd { display: block; margin-top: 16px; color: var(--v5-ink-2); font: 400 13px/20px var(--font-v5); }
.nx-bank-cd__time { color: var(--v5-ink); font-family: var(--font-metric); font-weight: 500; font-variant-numeric: tabular-nums; }
.nx-bank-pay__rejected { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--v5-ink-2); font: 400 var(--ui-type-list-subtitle)/1.55 var(--font-v5); }
.nx-bank-sum { margin: 12px -2px 0; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); overflow: hidden; }
.nx-bank-sum__r { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 14px 16px; }
.nx-bank-sum__r + .nx-bank-sum__r { border-top: 1px solid var(--v5-border); }
.nx-bank-sum__v { min-width: 0; color: var(--v5-ink); font: 500 15px/20px var(--font-metric); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.nx-bank-sum__v--big { font-family: var(--font-amount); font-size: 22px; line-height: 28px; letter-spacing: -.02em; }
.nx-bank-sum__v--text { font: 500 14px/20px var(--font-v5); }
/* Credited: medal pops once and rings once; amount in the success ink. */
.nx-bank-done { position: relative; display: flex; flex-direction: column; align-items: center; margin-top: -5px; padding: 28px 20px 8px; text-align: center; }
.nx-bank-done__medal { position: relative; width: 88px; height: 88px; display: grid; place-items: center; border-radius: 50%; background: var(--v5-success-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--v5-success) 35%, transparent); animation: nx-viz-pop 520ms cubic-bezier(.2,1.4,.4,1) 120ms both; }
.nx-bank-done__medal::after { content: ""; position: absolute; inset: -8px; border-radius: 50%; border: 2px solid var(--v5-success); opacity: 0; animation: nx-bank-ring-out 900ms 620ms ease-out both; }
.nx-bank-done__title { position: relative; display: block; margin-top: 20px; color: var(--v5-ink); font: 600 20px/28px var(--font-v5); }
.nx-bank-done__amt { position: relative; display: block; margin-top: 10px; color: var(--v5-success-ink); font: 500 36px/44px var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.nx-bank-done__unit { margin-left: 6px; color: var(--v5-ink-3); font: 500 14px/16px var(--font-v5); letter-spacing: 0; }
.nx-bank-done__line { position: relative; display: block; margin-top: 8px; color: var(--v5-ink-3); font: 400 13px/20px var(--font-v5); }
.nx-bank-sum--done { margin-top: 24px; }
.nx-bank-sum--done .nx-bank-sum__v { font: 500 14px/20px var(--font-v5); }
@keyframes nx-bank-ring-out { 0% { opacity: .55; transform: scale(.96); } 100% { opacity: 0; transform: scale(1.14); } }
@media (prefers-reduced-motion: reduce) { .nx-bank-chip { transition: none; } .nx-bank-chip:not([aria-disabled="true"]):active { transform: none; } .nx-bank-ring__value { transition: none; } .nx-bank-done__medal, .nx-bank-done__medal::after { animation: none; } }
</style>
