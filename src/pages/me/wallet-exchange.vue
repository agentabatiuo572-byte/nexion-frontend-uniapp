<!--
  Wallet Exchange — ported from Nexion-prototype/app/(main)/me/wallet/exchange/page.tsx.
  NEX↔USDT swap: pay/receive cards with live-jittered rate + flip, free network
  fee, plus the v3 risk-control dashboard (per-user $50/day cap, platform
  $20K/day pool, queue). Confirm flow gates via
  useExchangeV3.canExchange → debit/credit app balances, recordSwap, write two
  bills (debit + credit), commit v3 counters.

  Ports the basic exchange store + the v3 risk store (both new — exchange.ts /
  exchange-v3.ts). Reuses app (credit/debit USDT+NEX), bills.
  useScrollGrowProgress + IntersectionObserver ($el) is dropped (P-018 precedent)
  — cap bars render at their final width directly. window.location.href → uni
  navigateTo. SSR mounted-guard dropped. Intervals cleaned in onUnmounted
  (page-level component, P-021). Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/me" :title="t.exchange.title" />
      <view v-if="remoteApiEnabled && exchangeAuthorityStatus !== 'ready'" class="block" style="margin: 0 16px; font-size: 12px; color: var(--v5-ink-3)" role="status" aria-live="polite" :aria-busy="exchangeAuthorityStatus === 'loading' ? 'true' : 'false'">
        <text :style="exchangeAuthorityStatus === 'unavailable' ? { color: 'var(--v5-danger)' } : undefined">
          {{ exchangeAuthorityStatus === "loading" ? t.wallet.loadingTransactions : t.exchange.remoteUnavailableClosed }}
        </text>
      </view>
      <view v-else-if="exchangePaused" class="block" style="margin: 0 16px; font-size: 12px; color: var(--v5-warning)" role="status" aria-live="polite">
        <text>{{ t.exchange.swapPaused }}</text>
      </view>
      <!-- 同 staking:开发诊断,DEV 构建才渲染,裸英文字面量不进三语词典。 i18n-en-ok: 工程话诊断横幅,仅 DEV 构建渲染 -->
      <text v-else-if="isDevBuild && !remoteApiEnabled" class="block" style="margin: 0 16px; font-size: 12px; color: var(--v5-warning)">Dev build · mock data</text>

      <!-- How-it-works entry + rate freshness ring + refresh (P-46). -->
      <view class="ex-top">
        <view class="ex-how" role="button" tabindex="0" :aria-label="t.exchange.howItWorksEntry" @click="goHowItWorks"  @keydown.enter.prevent="goHowItWorks" @keydown.space.prevent="goHowItWorks">
          <text>{{ t.exchange.howItWorksEntry }} ›</text>
        </view>
        <view class="ex-fresh">
          <svg class="ex-fresh__ring" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle class="ex-fresh__trk" cx="9" cy="9" r="7" /><circle class="ex-fresh__val" cx="9" cy="9" r="7" :style="{ strokeDashoffset: `${(44 * (1 - rateFreshness)).toFixed(1)}` }" /></svg>
          <text class="ex-k ex-fresh__t">{{ updatedLabel }}</text>
        </view>
      </view>

      <!-- Pay / receive legs with the direction swap floating between them. -->
      <view class="ex-pair">
        <view class="ex-leg">
          <view class="ex-leg__h">
            <text class="ex-k">{{ t.exchange.pay }}</text>
            <view class="ex-max" role="button" tabindex="0" :aria-label="t.uiChrome.max" @click="setMax"  @keydown.enter.prevent="setMax" @keydown.space.prevent="setMax">
              <text class="ex-k">{{ t.exchange.balanceLabel }} </text><text class="ex-bal" :class="fromSym === 'UVT' ? 'ex-bal--uvt' : ''">{{ fromBalLabel }}</text><text class="ex-bal" :class="fromSym === 'UVT' ? 'ex-bal--uvt' : ''"> {{ platformDisplayText(fromSym) }}</text><text class="ex-k"> · </text><text class="ex-max__all">{{ t.uiChrome.max }}</text>
            </view>
          </view>
          <view class="ex-leg__m">
            <input
            class="ex-amt-input"
            type="text"
            inputmode="decimal"
            :value="input"
            placeholder="0"
            placeholder-style="color: var(--v5-ink-2)"
            :disabled="submitting"
            :aria-label="fmt(t.exchange.payAmountLabel, { sym: platformDisplayText(fromSym) })"
            @input="onInput"
            @blur="onInputBlur"
            />
            <view class="ex-coin" :class="fromSym === 'UVT' ? 'ex-coin--uvt' : 'ex-coin--usdt'"><text class="ex-coin__i">{{ fromSym === 'UVT' ? 'U' : '₮' }}</text><text>{{ platformDisplayText(fromSym) }}</text></view>
          </view>
          <text class="ex-k ex-leg__f">{{ minLabel }}</text>
        </view>
        <view class="ex-swap nx-frosted-button" role="button" tabindex="0" :aria-label="t.exchange.flip" @click="flip"  @keydown.enter.prevent="flip" @keydown.space.prevent="flip">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" /></svg>
        </view>
        <view class="ex-leg">
          <text class="ex-k ex-leg__label">{{ remoteApiEnabled ? t.exchange.netReceive : t.exchange.receive }}</text>
          <view class="ex-leg__m">
            <text class="ex-amt">{{ toParts[0] }}<text class="ex-dec">{{ toParts[1] }}</text></text>
            <view class="ex-coin" :class="toSym === 'UVT' ? 'ex-coin--uvt' : 'ex-coin--usdt'"><text class="ex-coin__i">{{ toSym === 'UVT' ? 'U' : '₮' }}</text><text>{{ platformDisplayText(toSym) }}</text></view>
          </view>
          <view class="ex-leg__f"><text class="ex-k ex-mono">{{ rateLabel }}</text></view>
        </view>
      </view>

      <!-- Fees well -->
      <view class="ex-fees">
        <view v-if="remoteApiEnabled" class="ex-fees__r"><text class="ex-k">{{ t.exchange.exchangeFee }}</text><text class="ex-fees__v">{{ remoteQuote ? `${amtLabel(remoteQuote.feeUsdt)} USDT` : '—' }}</text></view>
        <view class="ex-fees__r"><text class="ex-k">{{ t.exchange.feeLabel }}</text><text class="ex-tag-ok">{{ t.exchange.feeFree }}</text></view>
      </view>

      <!-- Error -->
      <view v-if="overBalance || underMin || feeInvalid" :style="errorStyle">
        <text>{{ errorLabel }}</text>
      </view>

      <view v-if="remoteApiEnabled && pendingExchangeLeases.length" style="margin: 16px 16px 0">
        <text style="font-size: 12px; color: var(--v5-ink-3)">{{ t.exchange.pendingRecoveryHint }}</text>
      </view>
      <!-- UVT note (plain text, no box) -->
      <view class="ex-note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
        <text>{{ t.exchange.nexInfo }}</text>
      </view>

      <!-- Daily cap as a ring card (risk-control dashboard), queue below when present. -->
      <view class="ex-quota">
        <view class="ex-quota__top">
          <view class="ex-ring" role="img" :aria-label="`${t.exchange.yourDaily} ${userCapPct}%`">
            <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden="true"><circle class="ex-ring__trk" cx="30" cy="30" r="26" /><circle class="ex-ring__val" cx="30" cy="30" r="26" :style="{ strokeDashoffset: `${(163 * (1 - userCapPct / 100)).toFixed(1)}` }" /></svg>
            <text class="ex-ring__b">{{ remoteApiEnabled && !remoteState ? '—' : `${userCapPct}%` }}</text>
          </view>
          <view class="ex-quota__grow">
            <text class="ex-quota__t">{{ t.exchange.capsLabel }}</text>
            <!-- DOM order [label, value, reset] keeps the label/value pair together; CSS lifts the value above (board order). -->
            <view class="ex-quota__row">
              <text class="ex-k">{{ t.exchange.yourDaily }}</text>
              <view class="ex-quota__v font-mono-tabular tabular-nums">
                <text>{{ remoteApiEnabled && !remoteState ? '-' :`$${formatAmount(displayUserUsed)}` }} </text>
                <text v-if="!remoteApiEnabled || remoteState" class="ex-quota__cap">/ ${{ formatAmount(displayUserCap) }}</text>
              </view>
              <text class="ex-k">&nbsp;· {{ fmt(t.exchange.capsReset, { zone: businessOffsetLabel("LEGACY") }) }}</text>
            </view>
          </view>
        </view>
        <!-- Queue -->
        <view v-if="displayQueue.length > 0" :style="queueWrapStyle">
          <view class="flex items-center" :style="queueTitleStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            <text style="margin-left: 6px">{{ queuedLabel }}</text>
          </view>
          <text class="block" style="margin: 4px 0 6px; font-size: 12px; line-height: 1.4; color: var(--v5-ink-3)">{{ t.exchange.queuedReservation }}</text>
          <view v-for="q in displayQueue.slice(0, 3)" :key="q.id" class="flex items-center justify-between" style="padding: 4px 0">
            <view class="flex items-center min-w-0" style="gap: 8px">
              <text class="font-mono-tabular truncate" style="font-size: 12px; color: var(--v5-ink-3)">{{ q.id }} · {{ q.direction === "nex2usdt" ? "UVT → USDT" : "USDT → UVT" }}</text>
              <view
                v-if="remoteApiEnabled"
                class="shrink-0"
                role="button"
                tabindex="0"
                :aria-disabled="cancellingOrderNo === q.id ? 'true' : 'false'"
                :style="cancelQueueButtonStyle(cancellingOrderNo === q.id)"
                @click.stop="handleCancelQueued(q.id)"
              >
                <text>{{ cancellingOrderNo === q.id ? t.exchange.cancelling : t.exchange.cancelQueued }}</text>
              </view>
            </view>
            <text class="font-mono-tabular tabular-nums shrink-0" style="font-size: 12px; color: var(--v5-ink)">${{ formatAmount(q.amountUSD) }}</text>
          </view>
        </view>
      </view>

      <!-- History -->
      <view v-if="!remoteApiEnabled || exchangeAuthorityStatus === 'ready'" class="ex-hist">
        <text class="ex-sec">{{ t.exchange.historyTitle }}</text>
        <EmptyState v-if="history.length === 0" kind="empty-list" :title="t.empty.listTitle" :desc="t.empty.listDesc" compact />
        <view v-else class="ex-rows">
          <view v-for="h in history" :key="h.id" class="ex-row">
            <view class="ex-row__ico">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <text class="ex-row__p">{{ swapLine(h) }}</text>
              <text class="ex-k ex-mono">@ {{ h.rate.toFixed(5) }} · {{ formatDisplayDateTime(h.ts, dateLocale(), true) }}</text>
            </view>
          </view>
        </view>
        <view v-if="canLoadMoreHistory" class="flex items-center justify-center active:opacity-70" style="min-height: 44px; color: var(--v5-brand)" role="button" tabindex="0" :aria-disabled="historyLoadingMore" @click="loadMoreHistory"  @keydown.enter.prevent="loadMoreHistory" @keydown.space.prevent="loadMoreHistory">
          <text>{{ historyLoadingMore ? t.exchange.loadingMore : t.exchange.loadMore }}</text>
        </view>
      </view>
      <view class="ex-bar-space" />
    </view>
    <!-- 金额无效 / 本次兑换在途时点了没用 → 显式 aria-disabled + 置灰;主操作在底部固定栏(DS-30)。 -->
    <template #pageFixed>
      <view class="ex-bar">
        <view class="ex-confirm" :class="{ 'ex-confirm--on': ctaEnabled }" role="button" tabindex="0" :aria-disabled="ctaEnabled ? 'false' : 'true'" @click="handleConfirm">
          <text>{{ t.exchange.confirm }}</text>
        </view>
      </view>
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { formatDisplayDateTime } from "@/lib/display-date";
import { platformDisplayText } from "@/lib/brand-copy";

import { formatFinanceAmount as formatAmount } from "@/lib/finance-amount-display";
import { onLoad, onHide, onShow } from "@dcloudio/uni-app";
import { navTo } from "@/lib/route";
import { exchangeQuote } from "@/lib/exchange-quote";
import { computed, ref, watch, onUnmounted, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import EmptyState from "@/components/empty-state.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { dateLocale, fmt } from "@/i18n/format";
import { businessOffsetLabel } from "@/lib/business-calendar";
import { geoPolicyUserMessage } from "@/api/geo-policy-error";
import { remoteAuthorityStatus } from "@/lib/remote-authority-display";
import { toast, confirm } from "@/store/ui";
import { useApp } from "@/store/app";
import { postMoneyBills } from "@/lib/money-receipt";
import { createExchangePendingMutationStore, executeExchangeSwap, recoverExchangeSwap, ExchangeRejectedError, ExchangeOutcomeUnknownError, type ExchangeSwapIntent } from "@/lib/exchange-pending-mutation";
import { acquireExchangeCancelCommand, createExchangeCancelStorage, exchangeOrderCanCancel, finishExchangeCancelCommand, isCurrentExchangeCancelScope, visibleQueuedExchangeOrders } from "@/lib/exchange-cancel";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import { captureRuntimeRevision, isCurrentRuntimeRevision, subscribeRuntimeRevision, type RuntimeRevisionScope } from "@/api/order-api";
import { canShowExchangeToast } from "@/lib/exchange-scope-toast";
import { canonicalExchangeAmount, sanitizeExchangeAmountInput } from "@/lib/exchange-input-amount";
import { resolveWithdrawalUseMax } from "@/lib/withdrawal-use-max";
import { createRemoteAuthorityCoordinator } from "@/lib/remote-authority-coordinator";
import { refreshWalletAfterCommittedExchange } from "@/lib/remote-commerce-refresh";
import { exchangeApi, remoteApiEnabled } from "@/api/runtime";
import type { ExchangeOrder, ExchangeSnapshot } from "@/api/exchange-api";
import { useExchange, type SwapEvent } from "@/store/exchange";
import { useExchangeV3, USER_DAILY_CAP_USD, dailyUserPctUsed } from "@/store/exchange-v3";

const t = useT();
// 同 staking:生产构建里 import.meta.env.DEV 恒为 false,Mock 横幅被摇掉。
const isDevBuild = import.meta.env.DEV;
const app = useApp();
const exchange = useExchange();
const v3 = useExchangeV3();
const remoteState = ref<ExchangeSnapshot | null>(null);
const remoteError = ref<string | null>(null);
const remoteSnapshotReceivedAt = ref(0);
const exchangeAuthorityStatus = computed(() => remoteAuthorityStatus({
  remoteApiEnabled,
  hasSnapshot: remoteState.value !== null,
  hasError: remoteError.value !== null,
}));
const exchangeSnapshotReady = computed(() => exchangeAuthorityStatus.value === "ready");
const pendingExchangeMutations = createExchangePendingMutationStore();
const pendingExchangeRevision = ref(0);
const pendingExchangeLeases = computed(() => {
  pendingExchangeRevision.value;
  return pendingExchangeMutations.list(app.accountKey);
});
const recoveringExchange = ref(false);
const submitting = ref(false);
let pendingRecoveryGeneration = 0;
let pendingRecoveryRead: Promise<void> | null = null;
const exchangeCancelStorage = createExchangeCancelStorage();
const cancellingOrderNo = ref<string | null>(null);
const historyLoadingMore = ref(false);
const remoteAuthority = createRemoteAuthorityCoordinator();
let exchangeMounted = true;
let exchangePageEpoch = 0;

function captureExchangeScope() {
  return { ...captureAccountScope(), pageEpoch: exchangePageEpoch };
}

function remoteScopeCurrent(scope: ReturnType<typeof captureExchangeScope>, runScope: RuntimeRevisionScope): boolean {
  return canShowExchangeToast({
    mounted: exchangeMounted && scope.pageEpoch === exchangePageEpoch,
    accountScopeCurrent: isCurrentAccountScope(scope) && app.accountKey === scope.accountKey,
    runScopeCurrent: isCurrentRuntimeRevision(runScope),
  });
}

function toastIfRemoteScopeCurrent(
  scope: ReturnType<typeof captureExchangeScope>,
  runScope: RuntimeRevisionScope,
  show: () => void,
): boolean {
  if (!remoteScopeCurrent(scope, runScope)) return false;
  show();
  return true;
}

function refreshExchangeScope() {
  invalidateRemoteReads();
  commitRemoteSnapshot(null);
  remoteError.value = null;
  remoteSnapshotReceivedAt.value = 0;
  pendingExchangeRevision.value += 1;
  if (exchangeMounted && remoteApiEnabled) void syncRemoteState().catch(() => {});
}
watch(() => app.accountKey, refreshExchangeScope);
const unsubscribeExchangeRuntime = subscribeRuntimeRevision(refreshExchangeScope);

let remoteReadGeneration = 0;
let remoteSnapshotVersion = 0;
const remoteFirstPagePending = ref(false);
function commitRemoteSnapshot(snapshot: ExchangeSnapshot | null) {
  remoteSnapshotVersion += 1;
  remoteState.value = snapshot;
}
function invalidateRemoteReads() {
  remoteReadGeneration += 1;
  remoteSnapshotVersion += 1;
  historyLoadingMore.value = false;
  remoteFirstPagePending.value = false;
}
function beginRemoteMutation(accountKey: string) {
  invalidateRemoteReads();
  return remoteAuthority.beginMutation(accountKey);
}

async function syncRemoteState(
  scope = captureExchangeScope(),
  runScope = captureRuntimeRevision(),
): Promise<boolean> {
  if (!remoteApiEnabled) return true;
  if (pendingExchangeLeases.value.length || recoveringExchange.value) return false;
  if (!remoteScopeCurrent(scope, runScope)) return false;
  if (remoteFirstPagePending.value) return false;
  const readGeneration = ++remoteReadGeneration;
  const snapshotVersion = remoteSnapshotVersion;
  historyLoadingMore.value = false;
  remoteFirstPagePending.value = true;
  const current = () => remoteScopeCurrent(scope, runScope)
    && readGeneration === remoteReadGeneration && snapshotVersion === remoteSnapshotVersion;
  try {
    const snapshot = await remoteAuthority.guardedRead(scope.accountKey, () => exchangeApi.fetchState(1, 20));
    if (!snapshot) return false;
    if (!current()) return false;
    if (snapshot.ordersPage.pageNum !== 1
        || snapshot.ordersPage.pageSize !== 20
        || snapshot.orders.length > snapshot.ordersPage.total) {
      throw new Error("EXCHANGE_HISTORY_PAGINATION_INVALID");
    }
    commitRemoteSnapshot(snapshot);
    remoteError.value = null;
    remoteSnapshotReceivedAt.value = Date.now();
    return true;
  } catch {
    if (!current()) return false;
    // Failure-close: local balances, rates, queues and history are not a remote fallback.
    commitRemoteSnapshot(null);
    remoteError.value = "G2_REMOTE_AUTHORITY_UNAVAILABLE";
    throw new Error(remoteError.value);
  } finally {
    if (readGeneration === remoteReadGeneration) remoteFirstPagePending.value = false;
  }
}

const canLoadMoreHistory = computed(() => remoteApiEnabled
  && !remoteFirstPagePending.value
  && !!remoteState.value
  && remoteState.value.orders.length < remoteState.value.ordersPage.total);

async function loadMoreHistory() {
  await pendingRecoveryRead?.catch(() => {});
  if (!remoteState.value || !canLoadMoreHistory.value || historyLoadingMore.value) return;
  const scope = captureExchangeScope();
  const runScope = captureRuntimeRevision();
  const baseline = remoteState.value;
  const readGeneration = ++remoteReadGeneration;
  const snapshotVersion = remoteSnapshotVersion;
  const current = () => remoteScopeCurrent(scope, runScope)
    && readGeneration === remoteReadGeneration && snapshotVersion === remoteSnapshotVersion
    && remoteState.value === baseline;
  const nextPage = baseline.ordersPage.pageNum + 1;
  const snapshotId = baseline.ordersPage.snapshotId;
  historyLoadingMore.value = true;
  try {
    const next = await remoteAuthority.guardedRead(scope.accountKey,
      () => exchangeApi.fetchState(nextPage, baseline.ordersPage.pageSize, snapshotId));
    if (!next || !current()) return;
    if (next.ordersPage.pageNum !== nextPage
        || next.ordersPage.pageSize !== baseline.ordersPage.pageSize
        || next.ordersPage.total !== baseline.ordersPage.total
        || next.ordersPage.snapshotId !== snapshotId
        || next.orders.length === 0) {
      throw new Error("EXCHANGE_HISTORY_PAGINATION_INVALID");
    }
    const merged = [...baseline.orders, ...next.orders];
    if (new Set(merged.map((order) => order.exchangeNo)).size !== merged.length) {
      throw new Error("EXCHANGE_HISTORY_DUPLICATE");
    }
    if (merged.length > next.ordersPage.total) throw new Error("EXCHANGE_HISTORY_PAGINATION_INVALID");
    commitRemoteSnapshot({ ...next, orders: merged });
    remoteSnapshotReceivedAt.value = Date.now();
  } catch {
    if (current()) toast.error(t.value.exchange.remoteUnavailableToast);
  } finally {
    if (readGeneration === remoteReadGeneration) historyLoadingMore.value = false;
  }
}

async function cancelRemoteOrder(exchangeNo: string): Promise<"cancelled" | "unknown" | "stale" | "not-cancellable"> {
  await pendingRecoveryRead?.catch(() => {});
  if (!remoteApiEnabled) return "unknown";
  const scope = captureExchangeScope();
  const runScope = captureRuntimeRevision();
  if (!remoteScopeCurrent(scope, runScope)) return "stale";
  const current = remoteState.value?.orders.find((order) => order.exchangeNo === exchangeNo);
  if (!exchangeOrderCanCancel(current)) {
    toastIfRemoteScopeCurrent(scope, runScope, () => toast.info(t.value.exchange.cancelNotAllowed));
    return "not-cancellable";
  }
  const key = acquireExchangeCancelCommand(exchangeCancelStorage, scope.accountKey, exchangeNo);
  const mutation = beginRemoteMutation(scope.accountKey);
  cancellingOrderNo.value = exchangeNo;
  try {
    const snapshot = await exchangeApi.cancel(exchangeNo, key);
    if (!isCurrentExchangeCancelScope(scope, captureExchangeScope()) || !remoteScopeCurrent(scope, runScope)) return "stale";
    commitRemoteSnapshot(snapshot);
    remoteError.value = null;
    remoteSnapshotReceivedAt.value = Date.now();
    const updated = snapshot.orders.find((order) => order.exchangeNo === exchangeNo);
    if (updated?.status !== "CANCELLED") return "unknown";
    finishExchangeCancelCommand(exchangeCancelStorage, scope.accountKey, exchangeNo, key);
    toastIfRemoteScopeCurrent(scope, runScope, () => toast.success(
      t.value.exchange.cancelDone,
      t.value.exchange.cancelDoneBody,
    ));
    return "cancelled";
  } catch {
    if (!isCurrentExchangeCancelScope(scope, captureExchangeScope()) || !remoteScopeCurrent(scope, runScope)) return "stale";
    // A timeout may happen after the server committed. Re-read the current
    // account's authority before telling the user whether retry is needed.
    try {
      const snapshot = await exchangeApi.fetchState();
      if (!isCurrentExchangeCancelScope(scope, captureExchangeScope()) || !remoteScopeCurrent(scope, runScope)) return "stale";
      commitRemoteSnapshot(snapshot);
      remoteError.value = null;
      remoteSnapshotReceivedAt.value = Date.now();
      const updated = snapshot.orders.find((order) => order.exchangeNo === exchangeNo);
      if (updated?.status === "CANCELLED") {
        finishExchangeCancelCommand(exchangeCancelStorage, scope.accountKey, exchangeNo, key);
        toastIfRemoteScopeCurrent(scope, runScope, () => toast.success(
          t.value.exchange.cancelDone,
          t.value.exchange.cancelDoneBody,
        ));
        return "cancelled";
      }
      if (updated && !exchangeOrderCanCancel(updated)) {
        finishExchangeCancelCommand(exchangeCancelStorage, scope.accountKey, exchangeNo, key);
        toastIfRemoteScopeCurrent(scope, runScope, () => toast.info(t.value.exchange.cancelNotAllowed));
        return "not-cancellable";
      }
    } catch {
      // Keep the command key so a later retry is the same idempotent request.
      if (!isCurrentExchangeCancelScope(scope, captureExchangeScope()) || !remoteScopeCurrent(scope, runScope)) return "stale";
      commitRemoteSnapshot(null);
      remoteError.value = "G2_REMOTE_AUTHORITY_UNAVAILABLE";
    }
    toastIfRemoteScopeCurrent(scope, runScope, () => toast.error(
      t.value.exchange.cancelUnknownTitle,
      t.value.exchange.cancelUnknownBody,
    ));
    return "unknown";
  } finally {
    mutation.finish();
    if (cancellingOrderNo.value === exchangeNo) cancellingOrderNo.value = null;
  }
}

function handleCancelQueued(exchangeNo: string) {
  if (cancellingOrderNo.value) return;
  void cancelRemoteOrder(exchangeNo);
}

function cancelQueueButtonStyle(disabled: boolean): CSSProperties {
  return {
    minHeight: "24px",
    padding: "0 8px",
    borderRadius: "999px",
    background: disabled ? "var(--v5-surface-3)" : "color-mix(in srgb, var(--v5-danger) 10%, transparent)",
    color: disabled ? "var(--v5-ink-4)" : "var(--v5-danger)",
    fontSize: "12px",
    pointerEvents: disabled ? "none" : "auto",
  };
}

const history = computed<SwapEvent[]>(() => {
  if (!remoteApiEnabled) return exchange.history;
  return (remoteState.value?.orders ?? []).map((order) => ({
    id: order.exchangeNo,
    ts: order.createdAt ?? 0,
    fromSym: order.fromAsset,
    toSym: order.toAsset,
    fromAmount: order.fromAmount,
    toAmount: order.toAmount,
    rate: order.rate,
  }));
});
// remote mode must never render persisted exchange or v3 facts.
const displayUserUsed = computed(() => remoteApiEnabled ? (remoteState.value?.todayUserUsedUsdt ?? 0) : v3.todayUserUsedUSD);
const displayUserCap = computed(() => remoteApiEnabled ? (remoteState.value?.caps.userDailyCapUsdt ?? 0) : USER_DAILY_CAP_USD);
const displayQueue = computed(() => remoteApiEnabled
  ? visibleQueuedExchangeOrders(remoteState.value?.orders ?? []).map((order) => ({
    id: order.exchangeNo,
    amountUSD: order.fromAsset === "USDT" ? order.fromAmount : order.toAmount,
    direction: order.fromAsset === "UVT" ? "nex2usdt" as const : "usdt2nex" as const,
  }))
  : v3.queue);
const rate = computed(() => remoteApiEnabled ? (remoteState.value?.caps.currentPrice ?? 0) : exchange.rate);

const direction = ref<"usdt2nex" | "nex2usdt">("nex2usdt");
onLoad((options) => {
  direction.value = options?.direction === "usdt2nex" ? "usdt2nex" : "nex2usdt";
});
const input = ref("");
const secsAgo = ref(0);

// A retained native page needs a fresh read whenever it becomes visible again.
onShow(() => {
  exchangeMounted = true;
  pendingExchangeRevision.value += 1;
  if (remoteApiEnabled) {
    const scope = captureExchangeScope();
    const runScope = captureRuntimeRevision();
    // The inline authority state owns read failures and its refresh action.
    void syncRemoteState(scope, runScope).catch(() => undefined);
    return;
  }
  // Explicit mock mode only: local counters and local wallet receipts are never remote success.
  v3.resetIfNewDay();
});

// Hidden native pages stop polling as well as invalidating their in-flight work.
let rateTimer: ReturnType<typeof setInterval> | null = null;
let agoTimer: ReturnType<typeof setInterval> | null = null;
onShow(() => {
  if (rateTimer !== null || agoTimer !== null) return;
  if (remoteApiEnabled) {
    rateTimer = setInterval(() => { void syncRemoteState().catch(() => {}); }, 15000);
    agoTimer = setInterval(() => {
      secsAgo.value = remoteSnapshotReceivedAt.value > 0
        ? Math.floor((Date.now() - remoteSnapshotReceivedAt.value) / 1000)
        : 0;
    }, 500);
    return;
  }
  rateTimer = setInterval(() => exchange.refreshRate(), 15000);
  agoTimer = setInterval(() => {
    secsAgo.value = Math.floor((Date.now() - exchange.rateUpdatedAt) / 1000);
  }, 500);
});
onHide(() => {
  exchangeMounted = false;
  exchangePageEpoch += 1;
  pendingRecoveryGeneration += 1;
  recoveringExchange.value = false;
  invalidateRemoteReads();
  commitRemoteSnapshot(null);
  remoteSnapshotReceivedAt.value = 0;
  if (rateTimer) clearInterval(rateTimer);
  if (agoTimer) clearInterval(agoTimer);
  rateTimer = null;
  agoTimer = null;
});
onUnmounted(() => {
  exchangeMounted = false;
  exchangePageEpoch += 1;
  pendingRecoveryGeneration += 1;
  unsubscribeExchangeRuntime();
  invalidateRemoteReads();
  if (rateTimer) clearInterval(rateTimer);
  if (agoTimer) clearInterval(agoTimer);
});

function recoverPendingExchange(): Promise<void> {
  if (pendingRecoveryRead) return pendingRecoveryRead;
  if (!remoteApiEnabled || !exchangeMounted || submitting.value || cancellingOrderNo.value) return Promise.resolve();
  const scope = captureExchangeScope(), runScope = captureRuntimeRevision();
  if (!remoteScopeCurrent(scope, runScope)) return Promise.resolve();
  const leases = pendingExchangeMutations.list(scope.accountKey);
  if (!leases.length) return Promise.resolve();
  const generation = ++pendingRecoveryGeneration;
  const current = () => generation === pendingRecoveryGeneration && remoteScopeCurrent(scope, runScope);
  recoveringExchange.value = true;
  const mutation = beginRemoteMutation(scope.accountKey);
  const read = Promise.resolve().then(async () => {
    for (const lease of leases) {
      if (!current()) return;
      try {
        const result = await recoverExchangeSwap({
          pending: pendingExchangeMutations, lease,
          recover: saved => exchangeApi.recover(saved.intent.direction, saved.intent.fromAmount,
            saved.intent.queueIfCapped, saved.key),
          fetchState: () => exchangeApi.fetchState(), isCurrent: current,
        });
        if (!current()) return;
        commitRemoteSnapshot(result.snapshot);
        remoteError.value = null;
        remoteSnapshotReceivedAt.value = Date.now();
        refreshCommittedExchangeWalletProjection(result.order as ExchangeOrder, scope, runScope);
        notifyRemoteSwapResult(result.order as ExchangeOrder, scope, runScope);
      } catch (cause) {
        if (!(cause instanceof ExchangeRejectedError)) throw cause;
        if (current()) toast.error(t.value.exchange.swapFailedReason);
      }
    }
  }).finally(() => {
    mutation.finish();
    if (pendingRecoveryRead === read) { pendingRecoveryRead = null; recoveringExchange.value = false; }
    pendingExchangeRevision.value += 1;
  });
  pendingRecoveryRead = read;
  return read;
}
useAutoRecovery({
  failed: () => remoteApiEnabled && exchangeMounted && pendingExchangeLeases.value.length > 0
    && !recoveringExchange.value && !submitting.value && !cancellingOrderNo.value,
  retry: recoverPendingExchange, repeatMs: 15_000,
});

const fromSym = computed(() => (direction.value === "usdt2nex" ? "USDT" : "UVT"));
const toSym = computed(() => (direction.value === "usdt2nex" ? "UVT" : "USDT"));
const fromBal = computed(() => {
  if (remoteApiEnabled) return direction.value === "usdt2nex"
    ? (remoteState.value?.wallet.usdtAvailable ?? 0)
    : (remoteState.value?.wallet.nexAvailable ?? 0);
  return direction.value === "usdt2nex" ? app.user.usdtBalance : app.user.nexBalance;
});
// Remote mode consumes the same direction-specific minimums the submit endpoint
// enforces. No local 1/10 fallback is safe: a config change would otherwise make
// the visible validation disagree with the server's final gate.
const minFrom = computed<number | null>(() => remoteApiEnabled
  ? (remoteState.value?.caps[direction.value === "usdt2nex" ? "minUsdt" : "minNex"] ?? null)
  : (direction.value === "usdt2nex" ? 1 : 10));
const remoteMinimumReady = computed(() => !remoteApiEnabled || (remoteState.value !== null && minFrom.value !== null && minFrom.value > 0));
// A readable snapshot is insufficient authority to submit: the platform can
// explicitly pause swaps while retaining balances, history and queue recovery.
const exchangeSubmissionAllowed = computed(() => !remoteApiEnabled
  || (exchangeSnapshotReady.value && remoteState.value?.caps.swapEnabled === true
    && pendingExchangeLeases.value.length === 0));
const exchangePaused = computed(() => remoteApiEnabled
  && exchangeSnapshotReady.value && remoteState.value?.caps.swapEnabled === false);

/**
 * 🔴 **账本精度 = 2 位,两个币种都是**:app.ts 的 creditBalance / debitBalance /
 * creditNex / debitNex 落账时一律 `+(...).toFixed(2)` —— 0.01 就是这个平台真正能
 * 成交的最小单位。报价、展示、成交必须**全部站在这一个精度上**:
 *   · 有一处比它**粗** → 用户看到的不是实际到账的数(展示「12 NEX」实入 11.76,每笔差 0.24);
 *   · 有一处比它**细** → 展示的小数位落账时被账本抹掉(报价 10.5374 实入 10.54)。
 * 所以 money() 只此一个取整口径,报价 / 输入 / 展示三条路径共用,不给「二次舍入」留位置。
 */
const money = (n: number): number => +n.toFixed(2);
/** 展示口径与 money() 同精度 —— 屏幕上的数 = 报价的数 = 落账的数。 */
const amtLabel = (n: number): string =>
  formatAmount(n);

// 输入在**进入资金链路的那一刻**就归到账本精度:此后报价 / 额度门 / 扣款 / 账单 / 历史
// 拿到的是同一个数。留着 1.2345 往下走的话,弹窗显示 1.23、账本扣 1.23、账单却记 1.2345。
const fromAmount = computed(() => {
  const n = parseFloat(input.value || "0");
  return isNaN(n) ? 0 : money(n);
});
/**
 * 报价公式**单源**:页面展示与「确认后复验」跑同一个函数、同一套取整。
 * 分成两份写的话,复验永远只是在跟自己的复制品比对 —— 判据自证,漂移照样漏过去。
 */
function quoteTo(dir: "usdt2nex" | "nex2usdt", from: number, r: number): number {
  if (from === 0) return 0;
  return money(dir === "usdt2nex" ? from / r : from * r);
}
const remoteQuote = computed(() => {
  const caps = remoteState.value?.caps;
  return caps ? exchangeQuote(direction.value, fromAmount.value, rate.value, caps.feePct, caps.feeMinUsdt) : null;
});
const feeInvalid = computed(() => remoteApiEnabled && fromAmount.value > 0 && remoteState.value !== null && !remoteQuote.value);
const toAmount = computed(() => remoteApiEnabled ? (remoteQuote.value?.toAmount ?? 0) : quoteTo(direction.value, fromAmount.value, rate.value));
const overBalance = computed(() => exchangeSnapshotReady.value && fromAmount.value > fromBal.value);
const underMin = computed(() => fromAmount.value > 0 && minFrom.value !== null && fromAmount.value < minFrom.value);
const valid = computed(() => exchangeSubmissionAllowed.value
  && remoteMinimumReady.value && fromAmount.value > 0 && !overBalance.value && !underMin.value && !feeInvalid.value);
/**
 * 🔴 提交在途守卫(范式同 wallet-cards-new.vue 的 isBinding:`ref(false)` 挂在
 * **组件实例**上,不用 checkout.vue 那个模块级 `let` —— 模块级变量跨实例共享,
 * 任一提前 return 忘复位就把后续所有兑换永久锁死)。
 * 置位点在**第一个 await 之前**,复位统一交给 finally:确认弹窗打开的那几秒
 * 页面还活着,不挡就能叠出第二个弹窗 → 两次确认 = 两条完整兑换链。
 */
const ctaEnabled = computed(() => valid.value && !submitting.value);
// USD value of this swap = the leg denominated in USDT
const swapUSDValue = computed(() => remoteApiEnabled ? (remoteQuote.value?.grossUsdt ?? 0) : (direction.value === "usdt2nex" ? fromAmount.value : toAmount.value));

// uni input event → e.detail.value (typed Event; mirrors topup-card-form).
function detailVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onInput(e: Event) {
  input.value = sanitizeExchangeAmountInput(detailVal(e));
}

function onInputBlur() {
  input.value = canonicalExchangeAmount(input.value);
}
function setMax() {
  // 提交在途时输入面整体冻结(输入框有 :disabled,这两个裸 <view @click> 入口没有)。
  // 快照已让改动动不了钱,但页面会立刻显示与刚确认的弹窗不同的数字,同一笔出现两个口径。
  if (submitting.value) return;
  // Reuse decimal flooring so Max cannot round above the authoritative balance.
  input.value = resolveWithdrawalUseMax(fromBal.value, 0).amount ?? "";
}
function flip() {
  if (submitting.value) return;
  direction.value = direction.value === "usdt2nex" ? "nex2usdt" : "usdt2nex";
  input.value = "";
}

useAutoRecovery({
  failed: () => remoteApiEnabled && !pendingExchangeLeases.value.length && !submitting.value && !cancellingOrderNo.value
    && remoteError.value !== null && !remoteFirstPagePending.value && !historyLoadingMore.value,
  retry: () => syncRemoteState(),
});
async function goHowItWorks() {
  await pendingRecoveryRead?.catch(() => {});
  if (!exchangeMounted) return;
  navTo("/pages/me/wallet-exchange-how");
}

function notifyRemoteSwapResult(
  order: ExchangeOrder,
  scope: ReturnType<typeof captureExchangeScope>,
  runScope: RuntimeRevisionScope,
) {
  if (!remoteScopeCurrent(scope, runScope)) return;
  if (order.status === "COMPLETED" || order.status === "SUCCESS") {
    toastIfRemoteScopeCurrent(scope, runScope, () => toast.success(t.value.exchange.swapped));
    return;
  }
  if (order.status === "QUEUED") {
    toastIfRemoteScopeCurrent(scope, runScope, () => toast.info(
      t.value.exchange.queuedToastTitle,
      fmt(t.value.exchange.queuedToastBody, { amount: formatAmount(order.fromAsset === "USDT" ? order.fromAmount : order.toAmount), zone: businessOffsetLabel("LEGACY") }),
    ));
    return;
  }
  const reason = {
    CANCELLED: t.value.exchange.swapCancelledReason,
    FAILED: t.value.exchange.swapFailedReason,
    USER_CAP: t.value.exchange.swapUserCapReason,
    PLATFORM_CAP: t.value.exchange.swapPlatformCapReason,
    GEO_BLOCKED: t.value.exchange.swapGeoBlockedReason,
  }[order.status];
  toastIfRemoteScopeCurrent(scope, runScope, () => toast.error(
    reason ?? fmt(t.value.exchange.swapNotFilled, { status: order.status }),
    order.exchangeNo,
  ));
}

function refreshCommittedExchangeWalletProjection(
  order: ExchangeOrder,
  scope: ReturnType<typeof captureExchangeScope>,
  runScope: RuntimeRevisionScope,
) {
  void refreshWalletAfterCommittedExchange({
    status: order.status,
    isCurrent: () => remoteScopeCurrent(scope, runScope),
    refreshWallet: () => app.refreshRemoteFleet(),
  });
}

async function handleConfirm() {
  await pendingRecoveryRead?.catch(() => {});
  // 🔴 重入守卫排在最前:无守卫时连点两次会排队两条完整兑换链,而第二条的额度门
  // 读到的还是第一条 v3.record 之前的计数 —— 两笔都放行,日限直接翻倍。
  if (submitting.value || !exchangeSubmissionAllowed.value) return;
  input.value = canonicalExchangeAmount(input.value);
  if (!valid.value) return;
  const requestScope = captureExchangeScope();
  const requestRunScope = captureRuntimeRevision();

  // 🔴 **成交快照冻在第一个 await 之前**(范式同 wallet-withdraw.vue 的 snap)。
  // 方向 / 币种 / 金额 / 到账额 / 汇率 / USD 计值 / 账号 一次冻结;额度门、弹窗文案、
  // 扣款、入账、记账、日限计数全部只读这一份。
  // 此前它们全是活读,而「确认弹窗 + 900ms 结算延迟」这段窗口里:汇率每 15s 自己跳、
  // 用户还能翻方向 / 改金额 —— 实际成交与用户点「确认」时看到的不是同一笔;
  // 额度门更只在确认那一刻按当时的值校验过一次,确认后把金额改大即可绕过每日额度。
  // 币种取 store 的类型单源(SwapEvent),不让对象字面量把 "USDT"|"UVT" 宽化成 string。
  const snap = {
    direction: direction.value,
    fromSym: fromSym.value as SwapEvent["fromSym"],
    toSym: toSym.value as SwapEvent["toSym"],
    fromAmount: fromAmount.value,
    toAmount: toAmount.value,
    rate: rate.value,
    usd: swapUSDValue.value,
    account: app.accountKey,
    remoteBaseline: remoteState.value,
    feeUsdt: remoteQuote.value?.feeUsdt ?? 0,
  };
  submitting.value = true;
  // settled 记录「这笔到底成交了没有」—— 下面 catch 里那句资金断言必须跟它走,
  // 不能无条件说「一分没动」。见 catch 处注释。
  let settled = false;
  try {
    if (remoteApiEnabled) {
      const ok = await confirm({
        title: t.value.exchange.confirm,
        message: `${platformDisplayText(snap.fromSym)} ${amtLabel(snap.fromAmount)} → ${t.value.exchange.netReceive}: ${platformDisplayText(snap.toSym)} ${amtLabel(snap.toAmount)}\n${t.value.exchange.exchangeFee}: ${amtLabel(snap.feeUsdt)} USDT\n${t.value.exchange.quoteEstimate}`,
        icon: "info",
        confirmLabel: t.value.exchange.confirm,
      });
      // The native prompt is an await boundary: the 15-second authority refresh
      // may have paused swaps while it was open, so re-read the same submit gate.
      if (!ok || !exchangeSubmissionAllowed.value) return;
      if (!remoteScopeCurrent(requestScope, requestRunScope) || app.accountKey !== snap.account || !snap.remoteBaseline) {
        toastIfRemoteScopeCurrent(requestScope, requestRunScope, () => toast.error(
          t.value.exchange.quoteStaleTitle,
          t.value.exchange.quoteStaleContext,
        ));
        return;
      }
      const directionCode = snap.direction === "usdt2nex" ? "USDT_TO_UVT" : "UVT_TO_USDT";
      const intent: ExchangeSwapIntent = {
        direction: directionCode,
        fromAmount: snap.fromAmount,
        queueIfCapped: true,
      };
      const mutation = beginRemoteMutation(snap.account);
      let result;
      try {
        result = await executeExchangeSwap<ExchangeSnapshot>({
          pending: pendingExchangeMutations,
          accountKey: snap.account,
          intent,
          baseline: snap.remoteBaseline,
          swap: (idempotencyKey) => exchangeApi.swap(directionCode, snap.fromAmount, true, idempotencyKey),
          fetchState: () => exchangeApi.fetchState(),
          recover: lease => exchangeApi.recover(lease.intent.direction, lease.intent.fromAmount,
            lease.intent.queueIfCapped, lease.key),
          isCurrent: () => remoteScopeCurrent(requestScope, requestRunScope),
        });
      } finally {
        mutation.finish();
      }
      if (!remoteScopeCurrent(requestScope, requestRunScope) || app.accountKey !== snap.account) {
        const applied = await syncRemoteState(requestScope, requestRunScope).catch(() => false);
        if (!applied) return;
        toastIfRemoteScopeCurrent(requestScope, requestRunScope, () => toast.info(t.value.exchange.accountSwitchedRefreshed));
        return;
      }
      commitRemoteSnapshot(result.snapshot);
      remoteError.value = null;
      remoteSnapshotReceivedAt.value = Date.now();
      if (["COMPLETED", "SUCCESS", "QUEUED"].includes(result.order.status)) input.value = "";
      if (!remoteScopeCurrent(requestScope, requestRunScope)) return;
      refreshCommittedExchangeWalletProjection(result.order as ExchangeOrder, requestScope, requestRunScope);
      notifyRemoteSwapResult(result.order as ExchangeOrder, requestScope, requestRunScope);
      return;
    }
    // v3 gate: cap / queue —— 判的是**快照金额**,后面扣的也是它(同一个数)。
    // 兑换只受汇率、日限、平台额度与地理限制约束。
    const gate = v3.canExchange(snap.usd);
    if (!gate.ok) {
      if (gate.reason === "user-cap") {
        const queueIt = await confirm({
          title: t.value.exchange.capReachedTitle,
          message: fmt(t.value.exchange.capReachedMessage, {
            used: formatAmount(gate.usedToday),
            cap: formatAmount(gate.cap),
            amount: formatAmount(snap.usd),
          }),
          icon: "warn",
          confirmLabel: t.value.exchange.capReachedConfirm,
        });
        if (queueIt && remoteScopeCurrent(requestScope, requestRunScope)) {
          v3.enqueue({ amountUSD: snap.usd, direction: snap.direction });
          toastIfRemoteScopeCurrent(requestScope, requestRunScope, () => toast.info(
            t.value.exchange.queuedToastTitle,
            fmt(t.value.exchange.queuedToastBody, { amount: formatAmount(snap.usd), zone: businessOffsetLabel("LEGACY") }),
          ));
        }
        return;
      }
      if (gate.reason === "platform-cap") {
        toastIfRemoteScopeCurrent(requestScope, requestRunScope, () => toast.error(
          t.value.exchange.platformExhaustedTitle,
          fmt(t.value.exchange.platformExhaustedBody, { cap: formatAmount(gate.cap / 1000) }),
        ));
        return;
      }
    }

    const ok = await confirm({
      title: t.value.exchange.confirm,
      // 🔴 弹窗数字与到账数字必须逐位相同 —— 走同一个 amtLabel,不在这里另立取整规则。
      // 曾经这行对 NEX 取整到 0 位:1 USDT @0.085 展示「12 NEX」,实入 11.76,每笔差 0.24。
      message: `${platformDisplayText(snap.fromSym)} ${amtLabel(snap.fromAmount)} → ${platformDisplayText(snap.toSym)} ${amtLabel(snap.toAmount)}`,
      icon: "info",
      confirmLabel: t.value.exchange.confirm,
    });
    if (!ok || !remoteScopeCurrent(requestScope, requestRunScope)) return;

    // 结算延迟(MOCK:真实现是兑换提交 endpoint〔TBD;PRD 未定义〕的往返)。写成 await 而不是 setTimeout 回调 ——
    // 回调版的守卫在函数返回时就复位了,等于没守;await 让整条链留在同一个 try/finally 里。
    await new Promise((r) => setTimeout(r, 900));

    // 🔴 **确认后复验**:快照对**当前**权威值还成不成立。不成立一律拒单重报价,
    // 绝不静默按新值成交 —— 用户确认的是 A,扣的就必须是 A,否则宁可什么都不发生。
    //  ① 汇率:拿**当前**汇率按同一个 quoteTo 重算到账额;变了就是漂移。
    //     (反过来用快照汇率复验快照报价,等式恒成立,这道门等于没有。)
    if (quoteTo(snap.direction, snap.fromAmount, rate.value) !== snap.toAmount) {
      toastIfRemoteScopeCurrent(requestScope, requestRunScope, () => toast.error(
        t.value.exchange.quoteStaleTitle,
        t.value.exchange.quoteStaleRate,
      ));
      return;
    }
    //  ② 账号:确认期间换号 → 钱会扣在新账号头上,而弹窗展示的是旧账号的数。
    //  ③ 额度:再问一次同一个门(入参仍是快照金额)。
    //     ⚠️ 这只收口**本标签页**;计数器自身的跨标签页竞态是 exchange-v3.ts 的独立缺陷,不在本次范围。
    if (!remoteScopeCurrent(requestScope, requestRunScope) || app.accountKey !== snap.account || !v3.canExchange(snap.usd).ok) {
      toastIfRemoteScopeCurrent(requestScope, requestRunScope, () => toast.error(
        t.value.exchange.quoteStaleTitle,
        t.value.exchange.quoteStaleContext,
      ));
      return;
    }

    // ⚠️ MOCK-ONLY CROSS-STORE MUTATION (NON-ATOMIC):debit + credit + recordSwap +
    // bills + v3.record 是分开的写。PRODUCTION:POST /api/exchange/swap 单事务提交,
    // 带 Idempotency-Key(PRD §9.4.3;阈值走 GET /api/config/exchange/caps,
    //  全局暂停走 POST /api/admin/exchange/pause)。
    // 🔴 一进一出两腿 + 两条分录 = **一笔交易**,走多腿收口点一次提交(2026-08-04 R4)。
    // 原实现:debit → credit → 两次裸 billsStore.add。bills.add 写不进去时返回 null 且不抛
    // 异常、没人接 —— 钱两边都动了、弹「兑换完成」,账单页却只有半边甚至一条都没有。
    // 收口后:资金两腿与两条分录同生共死(分录一次落盘,不存在"落了一条"的中间态);
    // 任何一环失败 → restoreMoney 精确还原资金三元组(含 withdrawableUsdt)+ 明确报错。
    // recordSwap 放在提交成功之后:它是这笔交易的**流水快照**,交易没成就不该有这条记录。
    const swapMemo = `Swap ${snap.fromSym} → ${snap.toSym}`;
    const swapRef = `SWAP-${Date.now().toString(36).toUpperCase()}`;
    const posted = postMoneyBills([
      { type: "swap", amount: -snap.fromAmount, symbol: snap.fromSym, status: "posted", memo: swapMemo, ref: swapRef },
      { type: "swap", amount: snap.toAmount, symbol: snap.toSym, status: "posted", memo: swapMemo, ref: swapRef },
    ]);
    if (posted === "insufficient") {
      toastIfRemoteScopeCurrent(requestScope, requestRunScope, () => toast.error(
        t.value.exchange.insufficientTitle,
        t.value.exchange.insufficientMessage.replace("{sym}", platformDisplayText(snap.fromSym)),
      ));
      return;
    }
    if (posted !== "ok") return; // 落盘失败:资金已还原、账上无记录、收口点已提示
    settled = true; // 过了这行 = 资金真的动过,此后任何拒绝都不许再说「一分没动」

    exchange.recordSwap({
      fromSym: snap.fromSym,
      toSym: snap.toSym,
      fromAmount: snap.fromAmount,
      toAmount: snap.toAmount,
      rate: snap.rate,
    });

    // Commit to v3 daily counters + lifetime
    v3.record(snap.usd);

    toastIfRemoteScopeCurrent(requestScope, requestRunScope, () => toast.success(
      t.value.exchange.swapped,
      t.value.exchange.swappedDetail
        .replace("{from}", platformDisplayText(snap.fromSym))
        .replace("{fromAmt}", amtLabel(snap.fromAmount))
        .replace("{to}", platformDisplayText(snap.toSym))
        .replace("{toAmt}", amtLabel(snap.toAmount)),
    ));
    input.value = "";
  } catch (err) {
    if (remoteApiEnabled) {
      if (!remoteScopeCurrent(requestScope, requestRunScope)) return;
      if (err instanceof ExchangeRejectedError) {
        toast.error(t.value.exchange.swapFailedReason); return;
      }
      if (err instanceof ExchangeOutcomeUnknownError) {
        if (app.accountKey === snap.account && err.authoritativeState) {
          commitRemoteSnapshot(err.authoritativeState as ExchangeSnapshot);
          remoteSnapshotReceivedAt.value = Date.now();
        } else {
          const applied = await syncRemoteState(requestScope, requestRunScope).catch(() => false);
          if (!applied || !remoteScopeCurrent(requestScope, requestRunScope)) return;
        }
        if (!remoteScopeCurrent(requestScope, requestRunScope)) return;
        remoteError.value = "G2_SWAP_OUTCOME_UNKNOWN";
        toastIfRemoteScopeCurrent(requestScope, requestRunScope, () => toast.error(
          t.value.exchange.outcomeUnknownTitle,
          t.value.exchange.outcomeUnknownBody,
        ));
        return;
      }
      commitRemoteSnapshot(null);
      remoteError.value = "G2_REMOTE_AUTHORITY_UNAVAILABLE";
      // 这条路径失败的是用户刚提交的**兑换动作**,不是一次数据读取 —— 与 :268/:370 两处
      // 「拉取失败」共用一句「数据取不到,请稍后再试」会让用户以为刷新一下就好,
      // 而实际是这笔兑换没有成交(独立审查判为文案与实际状态不符)。
      toastIfRemoteScopeCurrent(requestScope, requestRunScope, () => toast.error(t.value.exchange.swapFailed));
      return;
    }
    if (!remoteScopeCurrent(requestScope, requestRunScope)) return;
    // A region refusal surfaces on this path as a rejected submit. Translate it
    // into a toast; anything else is not ours to swallow — rethrow so the
    // existing failure behaviour (and the `finally` unlock below) is unchanged.
    const geo = geoPolicyUserMessage(err, t.value.geoPolicy);
    if (!geo) throw err;
    // 资金那句必须跟事实走,不能跟期望走:本 catch 在生产形态下可能落在
    // 「已部分落账后重试」的下游,那时说「一分没动」就是当面撒谎(本仓在
    // wallet-repurchase.vue 已为同形错误踩过一次)。settled 为真即已成交过,
    // 此时只报拒绝原因、不做资金断言。
    toastIfRemoteScopeCurrent(requestScope, requestRunScope, () => toast.error(
      geo,
      settled ? undefined : t.value.geoPolicy.fundsSafeNote,
    ));
  } finally {
    // 所有出口(含取消 / 拒单 / 抛异常)统一解锁 —— 复位点只有一个,不会有分支漏掉。
    submitting.value = false;
    pendingExchangeRevision.value += 1;
  }
}

// ── derived labels ──
const minLabel = computed(() => exchangeSnapshotReady.value
  ? t.value.exchange.minAmount.replace("{n}", minFrom.value === null ? "—" : formatAmount(minFrom.value)).replace("{sym}", platformDisplayText(fromSym.value))
  : t.value.exchange.remoteNotProvided);
const fromBalLabel = computed(() => exchangeSnapshotReady.value
  ? formatAmount(fromBal.value)
  : "-");
const toAmountLabel = computed(() => !exchangeSnapshotReady.value || feeInvalid.value ? "—" : amtLabel(toAmount.value));
const rateLabel = computed(() => exchangeSnapshotReady.value
  ? t.value.exchange.rate.replace("{rate}", rate.value.toFixed(5))
  : "-");
const updatedLabel = computed(() => exchangeSnapshotReady.value
  ? t.value.exchange.rateLastUpdated.replace("{n}", String(secsAgo.value))
  : t.value.exchange.remoteNotProvided);
// Rate freshness ring: the share of the 15 s refresh window still ahead (resets on every refresh).
const rateFreshness = computed(() => exchangeSnapshotReady.value ? Math.max(0, 1 - Math.min(secsAgo.value, 15) / 15) : 0);
// Receive amount anatomy: cents in ink-3; "—" stays whole.
const toParts = computed<[string, string]>(() => {
  const text = toAmountLabel.value, at = text.lastIndexOf(".");
  return at < 0 ? [text, ""] : [text.slice(0, at), text.slice(at)];
});
const userCapPct = computed(() => displayUserCap.value > 0 ? Math.min(100, Math.max(0, Math.round(displayUserUsed.value / displayUserCap.value * 100))) : 0);
const errorLabel = computed(() =>
  overBalance.value
    ? t.value.exchange.insufficientMessage.replace("{sym}", platformDisplayText(fromSym.value))
    : feeInvalid.value ? t.value.exchange.belowFee
    : t.value.exchange.minAmount.replace("{n}", minFrom.value === null ? "—" : formatAmount(minFrom.value)).replace("{sym}", platformDisplayText(fromSym.value)),
);
const queuedLabel = computed(() => fmt(t.value.exchange.queuedLabel, { n: String(displayQueue.value.length) }));
// 历史行同样走 amtLabel:历史与余额对不上,多半就是这里自己又取了一次整。
function swapLine(h: SwapEvent): string {
  return `${amtLabel(h.fromAmount)} ${platformDisplayText(h.fromSym)} → ${amtLabel(h.toAmount)} ${platformDisplayText(h.toSym)}`;
}

// ── styles ──
// Recessed swap field (topup tone): surface-2 fill, no border — pay/receive read
// as a matched field pair around the flip control, numbers stay full-ink.
const errorStyle: CSSProperties = {
  margin: "12px 16px 0",
  padding: "8px 12px",
  borderRadius: "8px",
  background: "color-mix(in srgb, var(--v5-brand-2) 10%, transparent)",
  fontSize: "12px",
  color: "var(--v5-brand-2)",
};
// De-carded: the risk-control dashboard sits on the page floor; the mono title
// opens it and the inner queue hairlines carry the section breaks.
const queueWrapStyle: CSSProperties = {
  marginTop: "12px",
  paddingTop: "12px",
  borderTop: "1px solid var(--v5-border)",
};
const queueTitleStyle: CSSProperties = {
  marginBottom: "6px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  fontWeight: 500,
  letterSpacing: "0.06em",
  color: "var(--v5-warning)",
};
// Section label (de-card spec): 15px/600/ink at the 18px content edge.
const historyAuthorityStateStyle: CSSProperties = {
  padding: "16px 0",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
// Empty state (de-card white-list): dashed outline, no fill.
const historyEmptyStyle: CSSProperties = {
  border: "1px dashed var(--v5-border-strong)",
  borderRadius: "16px",
  padding: "24px",
  textAlign: "center",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
// Transparent hairline group: container border-top opens it, rows self-divide.


</script>

<style scoped>
/* P-46 exchange: pay/receive legs with a floating swap, fees well, UVT note, daily-cap ring card, history rows, fixed confirm. */
.ex-k { color: var(--v5-ink-3); font: 400 12px/16px var(--font-v5); }
.ex-mono { font-family: var(--font-metric); font-variant-numeric: tabular-nums; }
.ex-top { display: flex; align-items: center; justify-content: space-between; min-height: 44px; margin: -5px 16px 0; }
.ex-how { display: inline-flex; align-items: center; min-height: 44px; color: var(--v5-ink-3); font: 500 13px/18px var(--font-v5); cursor: pointer; }
.ex-fresh { display: flex; align-items: center; gap: 6px; }
.ex-fresh__ring { transform: rotate(-90deg); }
.ex-fresh__trk { fill: none; stroke: color-mix(in srgb, var(--v5-ink) 12%, transparent); stroke-width: 2.5; }
.ex-fresh__val { fill: none; stroke: var(--v5-brand); stroke-width: 2.5; stroke-linecap: round; stroke-dasharray: 44; transition: stroke-dashoffset .5s linear; }
.ex-refresh { display: grid; place-items: center; width: 44px; height: 44px; color: var(--v5-ink-3); cursor: pointer; }
.ex-refresh[aria-disabled="true"] { opacity: .5; }
.ex-pair { position: relative; display: flex; flex-direction: column; gap: 8px; margin: 0 16px; }
.ex-leg { padding: 16px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.ex-leg__h { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ex-leg__m { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 6px; }
.ex-leg__f { display: block; margin-top: 4px; }
.ex-leg__f > text { display: block; }
.ex-fresh__t { margin-right: 4px; }
.ex-max { position: relative; display: inline-flex; align-items: center; cursor: pointer; }
.ex-max::after { content: ""; position: absolute; inset: -14px -4px; }
.ex-max > text + text { margin-left: 4px; }
.ex-max > .ex-bal + .ex-bal { margin-left: 7px; }
.ex-bal { color: var(--v5-ink-2); font: 400 12px/16px var(--font-metric); }
.ex-bal--uvt { color: var(--v5-nex-ink); }
.ex-max__all { color: var(--v5-brand); font: 500 12px/16px var(--font-v5); }
.ex-amt-input, .ex-amt { flex: 1; min-width: 0; height: 44px; color: var(--v5-ink); font: 500 36px/44px var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.ex-amt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ex-dec { color: var(--v5-ink-3); }
.ex-coin { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px 0 6px; border-radius: var(--v5-radius-full); font: 500 14px/20px var(--font-v5); }
.ex-coin__i { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; font: 600 11px/1 var(--font-metric); }
.ex-coin--uvt { background: var(--v5-nex-soft); color: var(--v5-nex-ink); }
.ex-coin--uvt .ex-coin__i { background: var(--v5-nex); color: white; }
.ex-coin--usdt { background: var(--v5-surface-3); color: var(--v5-ink); }
.ex-coin--usdt .ex-coin__i { background: var(--v5-ink); color: var(--v5-bg); }
.ex-swap { position: absolute; left: 50%; top: 50%; z-index: 1; display: grid; place-items: center; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; --ui-button-fill: color-mix(in srgb, var(--v5-brand) 14%, transparent); color: var(--v5-brand); cursor: pointer;
  box-shadow: 0 0 0 4px var(--v5-bg), var(--ui-glass-edge-shadow); transition: transform 120ms cubic-bezier(.2,.8,.2,1); }
.ex-swap > svg { animation: ex-flip 700ms 520ms cubic-bezier(.2,.8,.2,1) both; }
@keyframes ex-flip { from { transform: rotate(-180deg); } }
.ex-swap:active { transform: scale(.97); }
.ex-fees { margin: 12px 16px 0; padding: 4px 16px; border-radius: 14px; background: color-mix(in srgb, var(--v5-ink) 4%, transparent); box-shadow: inset 0 2px 8px rgba(0,0,0,.45), inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .ex-fees { box-shadow: inset 0 1px 4px rgba(20,16,8,.10), inset 0 0 0 1px var(--v5-border); }
.ex-fees__r { display: flex; align-items: center; justify-content: space-between; min-height: 44px; }
.ex-fees__r + .ex-fees__r { border-top: 1px solid var(--v5-border); }
.ex-fees__v { color: var(--v5-ink); font: 500 14px/20px var(--font-metric); }
.ex-tag-ok { display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: var(--v5-radius-full); background: var(--v5-success-soft); color: var(--v5-success-ink); font: 500 12px/16px var(--font-v5); }
.ex-note { display: flex; align-items: flex-start; gap: 8px; margin: 12px 20px 0; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); }
.ex-note > svg { flex: none; margin-top: 2px; color: var(--v5-nex-ink); }
.ex-quota { margin: 16px 16px 0; padding: 16px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.ex-quota__top { display: flex; align-items: center; gap: 16px; }
.ex-ring { position: relative; flex: none; width: 60px; height: 60px; }
.ex-ring > svg { transform: rotate(-90deg); }
.ex-ring__trk { fill: none; stroke: var(--v5-surface-3); stroke-width: 6; }
.ex-ring__val { fill: none; stroke: var(--v5-brand); stroke-width: 6; stroke-linecap: round; stroke-dasharray: 163; animation: ex-ring-draw 1400ms cubic-bezier(.16,1,.3,1) both; }
@keyframes ex-ring-draw { from { stroke-dashoffset: 163; } }
.ex-ring__b { position: absolute; inset: 0; display: grid; place-items: center; color: var(--v5-ink); font: 500 12px/16px var(--font-metric); }
.ex-quota__grow { flex: 1; min-width: 0; }
.ex-quota__t { display: block; color: var(--v5-ink); font: 600 15px/22px var(--font-v5); }
.ex-quota__row { display: flex; flex-wrap: wrap; align-items: baseline; }
.ex-quota__row > .ex-k { padding-top: 4px; }
.ex-quota__v { order: -1; flex-basis: 100%; margin-top: 2px; color: var(--v5-ink); font: 500 15px/20px var(--font-metric); }
.ex-leg__label { display: block; }
.ex-quota__cap { margin-left: 6px; color: var(--v5-ink-3); }
.ex-hist { margin: 0 16px 24px; }
.ex-sec { display: block; margin: 32px 4px 12px; color: var(--v5-ink); font: 600 17px/24px var(--font-v5); }
.ex-rows { overflow: hidden; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.ex-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; }
.ex-row + .ex-row { border-top: 1px solid var(--v5-border); }
.ex-row__ico { display: grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: var(--ui-radius-icon); background: var(--v5-nex-soft); color: var(--v5-nex-ink); }
.ex-row__p { display: block; color: var(--v5-ink); font: 500 14px/20px var(--font-metric); font-variant-numeric: tabular-nums; }
.ex-bar-space { height: 110px; }
.ex-bar { position: absolute; left: 0; right: 0; bottom: 0; z-index: 36; padding: var(--v5-space-3) var(--v5-space-4) calc(30px + env(safe-area-inset-bottom)); background: linear-gradient(180deg, color-mix(in srgb, var(--ui-ticket-top) 70%, transparent), color-mix(in srgb, var(--ui-ticket-bottom) 94%, transparent)); border-top: 1px solid color-mix(in srgb, var(--v5-ink) 5%, transparent); backdrop-filter: blur(18px) saturate(160%); -webkit-backdrop-filter: blur(18px) saturate(160%); }
.ex-confirm { display: flex; align-items: center; justify-content: center; height: 48px; border-radius: var(--v5-radius-full); background: var(--v5-brand); color: var(--v5-on-brand); font: 500 15px/20px var(--font-v5); opacity: .5; cursor: default; }
.ex-confirm--on { opacity: 1; cursor: pointer; }
.ex-confirm--on:active { transform: scale(.98); }
@media (prefers-reduced-motion: reduce) { .ex-swap > svg, .ex-ring__val { animation: none; } .ex-swap:active, .ex-confirm--on:active { transform: none; } .ex-fresh__val { transition: none; } }
</style>
