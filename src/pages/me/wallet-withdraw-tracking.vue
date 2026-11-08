<!--
  Withdrawal tracking (ported from Nexion-prototype/app/(main)/me/wallet/withdraw/tracking/page.tsx).
  5-step status stepper. The visible page reads its current withdrawal's server state.
  四态(加载骨架 / 空 / 进行中 / 终态)见下方三个分支 + etaSub。
  Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view class="tr-page" :class="{ 'tr-page--id': !!wd }" style="padding-bottom: 16px">
      <SubPageHeader :back="'/pages/me/me'" :title="wd ? wd.id : t.wallet.withdrawalStatusSubtitle" />

      <!-- Exact deep-link reads wait for the authenticated account before presenting any absence. -->
      <view v-if="trackingReadPending && !wd" class="px-5" style="padding-top: 4px">
        <view :style="skelStyle('42%', '14px', '0')" />
        <view :style="skelStyle('66%', '34px', '8px')" />
        <view :style="skelStyle('88%', '14px', '12px')" />
      </view>
      <EmptyState v-else-if="trackingReadError && !wd" kind="recoverable-error" :title="t.empty.errorDesc" :cta-label="t.empty.errorCta" @cta="retryTrackedWithdrawal" />
      <!-- Empty — no top gap; the sub-page header already provides the 24px inset. -->
      <view v-else-if="!wd" class="px-5 text-center">
        <text class="block" :style="emptyTextStyle">{{ deepLinkMiss ? t.wallet.withdrawalNotFound : t.wallet.noActiveWithdrawal }}</text>
        <!-- 《07》tap≥44:空状态的行动链接独占一行,不吃 WCAG 2.5.8 的 inline 豁免 → 撑热区(原 88×22) -->
        <!-- 日限用尽时置灰 + 给原因(与「再提一笔」同判据同文案)。深链 miss 让本空态在
             「有单据+额度已满」时也可达,不加这道就是外观可点、点了没反应的死链接(审计双镜头 P1)。 -->
        <view :class="againDisabled ? '' : 'active:opacity-70'" :style="againDisabled ? 'opacity:0.4' : ''" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0 8px; margin-top: 4px" role="button" tabindex="0" :aria-disabled="againDisabled ? 'true' : 'false'" :aria-describedby="againDisabled ? 'wd-again-reason-empty' : undefined" :aria-label="t.wallet.submitNewWithdrawal" @click.stop="goWithdraw">
          <text :style="emptyLinkStyle">{{ t.wallet.submitNewWithdrawal }}</text>
        </view>
        <text v-if="againDisabled" id="wd-again-reason-empty" class="block text-center" :style="againReasonStyle">{{ againReasonText }}</text>
      </view>

      <template v-else>
        <!-- Single-theme continuous flow: page-floor blocks separated by 12px,
             hairlines open the stepper + ETA groups (de-carded). -->
        <view class="tr">
          <!-- P-45 tracking ticket: amount + status, tear line, timeline (only reached steps carry labels — DS-30). -->
          <view class="tr-ticket">
            <view class="tr-tk">
              <view class="tr-row1"><text class="tr-k">{{ t.wallet.trackAmountLabel }}</text><text class="tr-tag" :class="`tr-tag--${statusTone}`">{{ statusTag }}</text></view>
              <text class="tr-amt"><text class="tr-cur">$</text>{{ amountParts[0] }}<text class="tr-dec">{{ amountParts[1] }}</text></text>
              <text class="tr-note">{{ viaLine }}</text>
              <text class="tr-addr">{{ wd.address }}</text>
            </view>
            <!-- 失败终态不渲染步进条:五步全灰、连「已提交」都不打勾,而下方卡片说转账失败(对抗证伪坐实) -->
            <template v-if="!isFailedEnd">
              <view class="tr-tear" aria-hidden="true" />
              <view class="tr-tl" role="list" :aria-label="t.wallet.trackProgressLabel">
                <view
                  v-for="(step, i) in steps" :key="step.key" class="tr-st" role="listitem"
                  :class="i < doneUpTo ? 'tr-st--done' : i === currentIdx ? 'tr-st--cur' : 'tr-st--todo'"
                  :aria-current="i === currentIdx && i >= doneUpTo ? 'step' : undefined"
                  :aria-hidden="i > currentIdx && i >= doneUpTo ? 'true' : undefined"
                >
                  <view class="tr-nd" :class="{ 'tr-nd--live': i === currentIdx && i >= doneUpTo && showSpinner }">
                    <svg v-if="i < doneUpTo" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                    <view v-else class="tr-nd__dot" />
                  </view>
                  <view v-if="i < doneUpTo || i === currentIdx" class="tr-st__body">
                    <text class="tr-st__t">{{ step.label }}</text>
                    <text class="tr-st__d">{{ stepTimeText(i) ? `${step.hint} · ${stepTimeText(i)}` : step.hint }}</text>
                  </view>
                </view>
              </view>
            </template>
          </view>

          <!-- Estimated completion / SPEC-7 风控持有态(manual/delay=审核中,freeze=冻结)
               normal = floor note (hairline opens it); frozen = danger accent callout. -->
          <view class="flex items-start" :style="isFrozenHold || isFailedEnd ? etaFrozenCardStyle : etaCardStyle">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" :stroke="isFrozenHold || isFailedEnd ? 'var(--v5-danger)' : 'var(--v5-brand)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
            <view style="flex: 1">
              <text class="block" :style="etaTitleStyle">{{ etaTitle }}</text>
              <text class="block" :style="etaSubStyle">{{ etaSub }}</text>
              <view v-if="reasonLines.length" style="margin-top: 6px">
                <text v-for="line in reasonLines" :key="line" class="block" :style="reasonLineStyle">· {{ line }}</text>
              </view>
              <!-- 人工审核 / 冻结态给客服出口:告诉用户「不会自动放款」却不给人问,
                   等于把人钉在原地(业务链必须有下一步)。 -->
              <view v-if="needsSupport" class="active:opacity-70" :style="supportLinkStyle" role="button" tabindex="0" :aria-label="t.wallet.trackContactSupport" @click.stop="goSupport">
                <text :style="supportLinkTextStyle">{{ t.wallet.trackContactSupport }} →</text>
              </view>
            </view>
          </view>

          <!-- ⑥ 再提一笔:今日额度用完时置灰 + 说明为什么,不做死按钮 -->
          <view class="flex flex-col items-center" style="gap: 6px">
            <view
              class="flex items-center justify-center"
              :class="againDisabled ? '' : 'active:opacity-80'"
              :style="againBtnStyle"
              role="button"
              tabindex="0"
              :aria-disabled="againDisabled ? 'true' : 'false'"
              :aria-describedby="againDisabled ? 'wd-again-reason' : undefined"
              :aria-label="t.wallet.trackSubmitAnother"
              @click.stop="goWithdraw"
            >
              <text>{{ t.wallet.trackSubmitAnother }}</text>
            </view>
            <text v-if="againDisabled" id="wd-again-reason" class="block text-center" :style="againReasonStyle">{{ againReasonText }}</text>
          </view>

        </view>
        <view class="tr-bar-space" />
      </template>
    </view>
    <!-- Back to wallet is the page's main action, in the fixed bottom bar (DS-30). -->
    <template #pageFixed>
      <view v-if="wd && !trackingReadPending && !trackingReadError" class="tr-bar nx-glass-bar">
        <view class="tr-bar__btn" role="button" tabindex="0" :aria-label="t.wallet.trackBackToWallet" @click.stop="goWallet" @keydown.enter.prevent="goWallet" @keydown.space.prevent="goWallet">
          <text>{{ t.wallet.trackBackToWallet }}</text>
        </view>
      </view>
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { formatDisplayDateTime } from "@/lib/display-date";
import { formatFinanceAmount as formatAmount } from "@/lib/finance-amount-display";
import { computed, onUnmounted, ref, watch, type CSSProperties } from "vue";
import { onLoad, onShow, onHide } from "@dcloudio/uni-app";
import { apiRuntimeConfig, remoteApiEnabled, sessionVault, withdrawalApi } from "@/api/runtime";
import { toCanonicalWithdrawal, type WithdrawalDetailSnapshot, type WithdrawalPolicy } from "@/api/withdrawal-api";
import { mockServerNow } from "@/store/server-time";
import { platformDayIndex } from "@/store/withdrawal-eligibility-core";
import { occupiesWithdrawalSlot } from "@/store/withdrawal-arrival-core";
import EmptyState from "@/components/empty-state.vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { dateLocale, fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { foregroundReadAllowed } from "@/lib/foreground-read";
import type { Withdrawal, WithdrawalStatus } from "@/store/types";
import { navTo, navReplace } from "@/lib/route";
import { riskReasonLines, terminalReasonLine } from "@/lib/risk-reason-text";
import { dailyLimitStatus } from "@/store/withdrawal-eligibility";
import {
  createWithdrawalTrackingRead,
  resolveTrackedWithdrawal,
  type WithdrawalTrackingReadScope,
  type WithdrawalTrackingReadStatus,
} from "./wallet-withdraw-tracking-read";

const STEP_DELAY_MS = 3500;

const t = useT();
const app = useApp();
const auth = useAuth();
// 🔴 用**主单**(优先最早的在途单):只显示「最新一笔」时,在途的人工审核单
// 会被后提且已到账的那笔挤掉,用户查不到自己还在审核的钱(独立验收实测)。
// 深链(?id=)按单号精确定位;找不到走「查无此单」空态,**绝不回落主单** ——
// 回落等于把别的单渲染在这个单号名下(账单深链串数据 P0 同型,2026-08-02)。
const deepLinkId = ref<string | null>(null);
const trackedId = computed(() => deepLinkId.value ?? app.primaryWithdrawal?.id ?? null);
onLoad((options) => {
  deepLinkId.value = typeof options?.id === "string" && options.id ? options.id : null;
});
const trackedWithdrawal = ref<Withdrawal | null>(null);
// A newer canonical list row may supersede the detail snapshot.
const storeRowAtTrackedRead = ref<Withdrawal | null>(null);
const trackingReadStatus = ref<WithdrawalTrackingReadStatus>("waiting");
const trackingPageVisible = ref(false);
let trackingPageEpoch = 0;

function trackingReadScope(): WithdrawalTrackingReadScope | null {
  const withdrawalNo = trackedId.value;
  // A cold page can mount before the authenticated binding finishes. Hold the
  // exact read until the runtime has a concrete user scope; never query under
  // the bootstrap/default account and never reuse an earlier account response.
  const session = sessionVault.read();
  if (!remoteApiEnabled || !trackingPageVisible.value || !foregroundReadAllowed() || !auth.isAuthenticated || !withdrawalNo || !session?.accessToken
      || app.accountKey !== `user:${session.user.userId}`) return null;
  return {
    withdrawalNo,
    accountKey: app.accountKey,
    accountBindingEpoch: app.accountBindingEpoch,
    sessionRevision: sessionVault.revision(),
    apiOrigin: { ...apiRuntimeConfig },
    pageEpoch: trackingPageEpoch,
  };
}

function applyTrackedWithdrawal(detail: WithdrawalDetailSnapshot): void {
  const submission = detail.withdrawal;
  const canonical = toCanonicalWithdrawal(submission, submission.targetAddress ?? "", submission.createdAt);
  trackedWithdrawal.value = {
    ...canonical,
    status: detail.status,
    confirmedAt: detail.confirmedAt,
    ...(detail.terminalReason !== null ? { terminalReason: detail.terminalReason } : {}),
    ...(detail.retriable !== null ? { retriable: detail.retriable } : {}),
    ...(detail.nexRefunded !== null
      ? { nexRefunded: detail.nexRefunded, nexRefundedAt: detail.nexRefundedAt ?? canonical.nexRefundedAt }
      : {}),
  };
  storeRowAtTrackedRead.value = app.withdrawals.find((row) => row.id === submission.withdrawalNo) ?? null;
}

const trackedWithdrawalRead = createWithdrawalTrackingRead<WithdrawalDetailSnapshot>({
  read: withdrawalApi.get,
  currentScope: trackingReadScope,
  apply: applyTrackedWithdrawal,
  setStatus: (status) => { trackingReadStatus.value = status; },
});

const trackingReadPending = computed(() => remoteApiEnabled && (deepLinkId.value !== null
  ? trackingReadStatus.value === "waiting" || trackingReadStatus.value === "loading"
  : !app.remoteWithdrawalListHasSnapshot && app.remoteWithdrawalListStatus !== "ready" && app.remoteWithdrawalListStatus !== "error"));
const trackingReadError = computed(() => remoteApiEnabled && (deepLinkId.value !== null
  ? trackingReadStatus.value === "error" : app.remoteWithdrawalListStatus === "error"));
const wd = computed(() => {
  const id = trackedId.value;
  if (!id || (deepLinkId.value && remoteApiEnabled && trackingReadStatus.value === "not-found")) return null;
  const exact = trackedWithdrawal.value?.id === id ? trackedWithdrawal.value : null;
  if (deepLinkId.value && exact) return exact;
  return resolveTrackedWithdrawal(
    exact,
    app.withdrawals.find((row) => row.id === id) ?? null,
    storeRowAtTrackedRead.value,
  );
});
const deepLinkMiss = computed(() => deepLinkId.value !== null && !wd.value
  && (!remoteApiEnabled || trackingReadStatus.value === "not-found"));

let bankRedirecting = false;
function openBankTracking() {
  const row = wd.value;
  if (trackingPageVisible.value && !bankRedirecting && row?.network === "BANK-VND") {
    bankRedirecting = true;
    void navReplace(`/pages/me/wallet-withdraw-bank?order=${encodeURIComponent(row.id)}`)
      .then(ok => { if (!ok) bankRedirecting = false; });
  }
}
watch(() => wd.value, openBankTracking);

async function refreshTrackedWithdrawal(quiet = false, refreshPrimary = false): Promise<void> {
  if (!trackingPageVisible.value || !foregroundReadAllowed() || !auth.isAuthenticated) return;
  const reads: Promise<unknown>[] = [];
  if (trackedId.value) reads.push(trackedWithdrawalRead.refresh(quiet));
  // Entry and manual retry refresh the primary selection when no order was specified.
  if (remoteApiEnabled && (!app.remoteWithdrawalListHasSnapshot || (refreshPrimary && !deepLinkId.value))
      && app.remoteWithdrawalListStatus !== "loading") reads.push(app.refreshRemoteWithdrawalList());
  await Promise.all(reads);
}

function retryTrackedWithdrawal(): Promise<void> {
  return refreshTrackedWithdrawal(false, true);
}
useAutoRecovery({ failed: () => trackingReadError.value && trackingReadStatus.value !== "loading" && app.remoteWithdrawalListStatus !== "loading", retry: retryTrackedWithdrawal });

function canPollTrackedWithdrawal(): boolean {
  return remoteApiEnabled && trackingPageVisible.value && auth.isAuthenticated && foregroundReadAllowed()
    && occupiesWithdrawalSlot(wd.value?.status) && wd.value?.network !== "BANK-VND"
    && trackingReadStatus.value !== "not-found";
}

watch(canPollTrackedWithdrawal, (enabled, _, onCleanup) => {
  if (!enabled) return;
  const timer = setInterval(() => {
    if (canPollTrackedWithdrawal()) void trackedWithdrawalRead.refresh(true);
  }, 30_000);
  onCleanup(() => clearInterval(timer));
});

watch([trackingPageVisible, foregroundReadAllowed, () => auth.isAuthenticated], ([visible, allowed, authenticated], [wasVisible]) => {
  if (!visible || !allowed || !authenticated) {
    trackedWithdrawalRead.invalidate();
    return;
  }
  if (!wasVisible || !deepLinkId.value || canPollTrackedWithdrawal() || (!wd.value && trackingReadStatus.value !== "not-found")) {
    refreshTrackedWithdrawal(wasVisible && !!wd.value, true);
    if (!wasVisible || !withdrawalPolicy.value) void loadWithdrawalPolicy();
  }
});

watch(
  () => [trackedId.value, app.accountKey, app.accountBindingEpoch, apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl] as const,
  ([, account, epoch], [, previousAccount, previousEpoch]) => {
    trackedWithdrawal.value = null;
    storeRowAtTrackedRead.value = null;
    trackedWithdrawalRead.invalidate();
    if (!trackingPageVisible.value) return;
    refreshTrackedWithdrawal();
    if (account !== previousAccount || epoch !== previousEpoch) void loadWithdrawalPolicy();
  },
  { flush: "sync" },
);

const steps = computed<{ key: WithdrawalStatus; label: string; hint: string }[]>(() => [
  { key: "submitted", label: t.value.wallet.submitted, hint: t.value.wallet.trackSubmittedHint },
  { key: "review-passed", label: t.value.wallet.reviewPassed, hint: t.value.wallet.trackReviewHint },
  { key: "processing", label: t.value.wallet.processing, hint: t.value.wallet.trackProcessingHint },
  { key: "sent", label: t.value.wallet.sent, hint: t.value.wallet.trackSentHint },
  { key: "confirmed", label: t.value.wallet.confirmed, hint: t.value.wallet.trackConfirmedHint },
]);

// 🔴 失败终态。此前这四个态没有任何分支,全部掉进兜底渲染成「正在处理 · 预计 24 小时内完成」——
// 钱没打出去,页面却说一切正常,而且连客服入口都没有;同时钱包列表那行写的是「转账失败」,
// 列表与它自己的详情页互相打脸(审计 P0)。
const FAILED_STATUSES: WithdrawalStatus[] = ["review-rejected", "address-invalid", "tx-failed", "refunded"];
const isFailedEnd = computed(() => !!wd.value && FAILED_STATUSES.includes(wd.value.status));
const failedTitle = computed(() => {
  const s = wd.value?.status;
  const w = t.value.wallet;
  if (s === "review-rejected") return w.reviewRejected;
  if (s === "address-invalid") return w.statusAddressInvalid;
  if (s === "tx-failed") return w.statusTxFailed;
  if (s === "refunded") return w.statusRefunded;
  return "";
});
// 🔴 拦截/异常态一律要有客服出口。原判据只看 riskRoute,而 frozen 也可能由后台对一张
// pass 路由的在途单事后冻结(types.ts 明写「K3 route freeze 或 D2 处置」)——
// 那种单文案叫用户联系客服,页面上却没有客服入口。
const routeHeld = computed(() => !!wd.value
  && (wd.value.status === "review-pending" || wd.value.status === "frozen"
    || (wd.value.status === "submitted" && !!wd.value.riskRoute && wd.value.riskRoute !== "pass")));
const needsSupport = computed(() => routeHeld.value || isFrozenHold.value || isFailedEnd.value);
// 终态:5 步全部走满,最后一步不能还转圈 —— 转圈代表「进行中」,
// 钱都到账了还转,用户会以为卡住了。
const isTerminalDone = computed(() => wd.value?.status === "confirmed");
const currentIdx = computed(() => {
  const idx = steps.value.findIndex((s) => s.key === wd.value?.status);
  // review-pending / frozen 不在主链 5 步里,findIndex 返回 -1 会让整条步进条全灰
  // (看不出走到哪了)。按规格停在第 1 步:已提交,等审核。
  if (idx === -1 && wd.value) return 0;
  return idx;
});
/** 打勾的步数。终态时 = 全部 5 步;否则 = 当前步之前的都打勾。 */
const doneUpTo = computed(() => (isTerminalDone.value ? steps.value.length : Math.max(0, currentIdx.value)));
/** 失败终态 / 冻结态不再转圈:转圈代表「还在推进」,而它已经不会再推进了。 */
const showSpinner = computed(() => !isTerminalDone.value && !isFailedEnd.value && !isFrozenHold.value);

// ⑥ 「再提一笔」的可用性。
// 🔴 两件事实必须与提现页**同源**,否则这页说能提、那页说不能提(历史上真出过):
//   限额只认服务端 policy(提交时真正执行的那把尺子),笔数由 core 从 app.withdrawals 现算。
//   本页原先只能拿到本地 config 的写死值,是分裂的一半。
// policy 取不到 → 0 → 既有规则「上限 ≤0 视为未配置」→ 不置灰(fail-open,
// 后端不可达时不把用户的下一步堵死;真拦不拦由提现页与服务端说了算)。
const withdrawalPolicy = ref<WithdrawalPolicy | null>(null);
/**
 * 🔴 policy 拉取要能重来。只拉一次且失败静默吞的话,这一页实例**终身** fail-open:
 * 「再提一笔」永不置灰,点进提现页却被日限拦死 —— 正是本文上面那句「同源」要消灭的分裂,
 * 只是换了触发条件(R1 四份独立审计各自点名)。onShow 补拉:从提现页返回、切回前台都会重取。
 */
const withdrawalPolicyLoading = ref(false);
async function loadWithdrawalPolicy(): Promise<void> {
  // 🔴 在途守卫:抄提现页那份 loader 时我漏抄了它。onShow 与 onMounted 首次进入会各触发一次,
  // App 端每次回前台再叠一次 —— 没有守卫就会重复发请求,且**后到的响应覆盖先到的**。
  if (withdrawalPolicyLoading.value) return;
  // After an H5 reload the session is restored after the page shows; the account watch above reads it then.
  if (remoteApiEnabled && (!foregroundReadAllowed() || !sessionVault.read())) return;
  withdrawalPolicyLoading.value = true;
  try {
    withdrawalPolicy.value = await withdrawalApi.policy();
  } catch {
    // 🔴 失败时**什么都不做**——保留上一次拿到的好值。
    // 清空会让限额回落 0、判定按「不限制」放行:回前台那一刻网络抖一下,「再提一笔」就解灰,
    // 点进去却被提现页拦死。仓内同类钱路径配置的既有惯例是失败朝「关」(见 genesis-config 的
    // catch → marketOpenState:"closed")。设计上说的 fail-open 是「从没取到过」,
    // 不是「取到过又被抹掉」——这两件事被我上一版混成了一件。
  } finally {
    withdrawalPolicyLoading.value = false;
  }
}
/**
 * 🔴 平台日边界信号。判定里的「今天」走 mockServerNow(),它不是响应源 ——
 * 没有这个依赖,停在本页跨过平台日 0 点后按钮**不解灰**,理由行还念着一个已经过去的时刻,
 * 页面自己打自己脸(提现页为同一个失效专门建了 eligibilityClock,本页此前没跟上)。
 * 只取「日序」不取秒:值只在跨过边界那一刻变,不会每分钟触发重算。
 */
const nowTick = ref(mockServerNow());
let dayTimer: ReturnType<typeof setInterval> | undefined;
const stopDayTimer = () => { if (dayTimer) { clearInterval(dayTimer); dayTimer = undefined; } };
// 🔴 定时器起停挂 onShow/onHide **成对**,不能只挂 onUnmounted —— 仓内明文硬规则(P-063),
// 且隔壁 support/chat 就是这么写的。uni 页面栈会保活页面实例,前进离开时 onUnmounted 不触发:
// 每往返一次就多留一个常驻 60s tick。我抄追踪页这段时只抄了「加个定时器」,没抄那条约束。
onShow(() => {
  trackingPageVisible.value = true;
  openBankTracking();
  trackingPageEpoch += 1;
  nowTick.value = mockServerNow();
  stopDayTimer();
  dayTimer = setInterval(() => (nowTick.value = mockServerNow()), 60_000);
});
onHide(() => {
  trackingPageVisible.value = false;
  trackingPageEpoch += 1;
  trackedWithdrawalRead.invalidate();
  stopDayTimer();
});
onUnmounted(() => {
  trackingPageVisible.value = false;
  trackingPageEpoch += 1;
  trackedWithdrawalRead.invalidate();
  stopDayTimer();
}); // 兜底:onHide 不触发的场景(直接销毁)仍要清

// app.withdrawals 本身是响应源,提交完回到本页会自动重算 —— 不再需要 `void wd.value` 那种手动挂依赖。
const dailyLimit = computed(() => {
  void platformDayIndex(nowTick.value); // 建立对「平台日边界」的依赖,不参与计算
  return dailyLimitStatus({
    limitCount: withdrawalPolicy.value?.dailyLimitCount ?? 0,
    withdrawals: app.withdrawals,
  });
});
/**
 * 服务端对**这一笔**的结论:它还能不能被重新发起。
 *
 * 🔴 **不拿它去置灰「再提一笔」**(2026-08-11 独立审计 P1,我上一版就是这么写的,错了):
 * `retriable` 的作用域是**单据**,而「再提一笔」发起的是一笔**全新**提现 —— 作用域是账号。
 * 拿单据级结论去禁账号级动作有两处错:① 禁用理由与被禁的动作不是同一件事;
 * ② 失败单永久留在列表里、终态单又不再被回查,于是一张历史废单会把这个入口**永久**锁死,
 * 哪怕换个地址换个金额本来完全提得出来。真正该拦的地方是提现页自己的闸(限额/风控/地址),
 * 那里才拿得到账号级的当前结论。
 * 这里只做一件事:**如实把服务端的结论说给用户**,不替它扩大适用范围。
 * 缺省(服务端没给)不显示:没说过的话不替它说。
 */
const retryBlockedLine = computed(() =>
  (isFailedEnd.value && wd.value?.retriable === false ? t.value.wallet.trackRetryBlocked : null));
const againDisabled = computed(() => dailyLimit.value.reached);
const againReasonText = computed(() => {
  const stamp = formatDisplayDateTime(dailyLimit.value.resetAt, dateLocale());
  return fmt(t.value.walletV3.dailyLimitReached, { time: stamp });
});
// SPEC-7: freeze 路由/冻结状态用独立危险态文案;manual/delay 用审核中文案。
const isFrozenHold = computed(() => wd.value?.status === "frozen");
// 命中原因 → 业务话术(工程 reason code 不直出;R5: 展示存单快照的服务端结论)。
const heldReasonLines = computed(() => {
  if (!routeHeld.value) return [] as string[];
  // 码表单源 lib/risk-reason-text:含 PAY04 换绑扩展码(new-address-large-amount),
  // 各页散抄 dict 会静默吞新增码(filter(Boolean) 无痕丢行)。
  return riskReasonLines(t.value, wd.value?.riskReasons);
});
/**
 * 失败终态的原因行 —— 服务端 GET /api/withdrawals/:id 的 terminalReason 翻成业务话术。
 * 在此之前失败单只有一句「审核未通过」,为什么被拒**页面上一个字都没有**,
 * 用户与客服都只能猜。码不直出(工程枚举值禁上页面),翻译走 lib/risk-reason-text 单源。
 */
const failedReasonLine = computed(() =>
  (isFailedEnd.value ? terminalReasonLine(t.value, wd.value?.terminalReason) : null));
/**
 * 两类原因合流到同一个渲染槽:一张 manual 路由的单被拒时,既有「当初为什么被拦下来」
 * (riskReasons)也有「最后为什么没成」(terminalReason),两句都该给。
 * 去重是因为 v-for 用文案本身作 key —— 两边恰好给出同一句时会撞 key。
 */
const reasonLines = computed(() => [...new Set([
  ...heldReasonLines.value,
  ...(failedReasonLine.value ? [failedReasonLine.value] : []),
  // 「这笔不能再发起,请联系客服」和原因行同处一块 —— 那块下面就挂着客服入口
  // (needsSupport 对失败终态恒真),叫用户联系客服的那句话与入口在同一屏,不是死胡同文案。
  ...(retryBlockedLine.value ? [retryBlockedLine.value] : []),
])]);
// FEAT-WD02:fee 是结构化快照,展示只读 actualFeeUsd(旧单读盘时已归一,禁重算)。
// Ticket header: amount anatomy and a status tag that names where the withdrawal stands.
const amountParts = computed<[string, string]>(() => {
  const text = wd.value ? formatAmount(wd.value.amount) : "", at = text.lastIndexOf(".");
  return at < 0 ? [text, ""] : [text.slice(0, at), text.slice(at)];
});
const statusTag = computed(() => isTerminalDone.value ? steps.value[steps.value.length - 1]!.label
  : isFailedEnd.value ? failedTitle.value : isFrozenHold.value ? etaTitle.value : steps.value[currentIdx.value]?.label ?? "");
const statusTone = computed(() => isTerminalDone.value ? "ok" : isFailedEnd.value ? "bad" : isFrozenHold.value ? "warn" : "brand");
const viaLine = computed(() =>
  wd.value ? fmt(t.value.wallet.trackViaLine, { network: wd.value.network, fee: formatAmount(wd.value.fee.actualFeeUsd) }) : "",
);
const etaTitle = computed(() =>
  wd.value?.status === "confirmed"
    ? t.value.wallet.trackEtaDone
    : isFailedEnd.value
      ? failedTitle.value
      : isFrozenHold.value
      ? t.value.wallet.routeHeldFrozenTitle
      : routeHeld.value
        ? t.value.wallet.withdrawRouteHeldTitle
        // 🔴 标题必须用**不带插值**的 key。这里原来直接取 trackEtaPending,而那条
        // 文案在改成「预计 {n} 小时内完成」之后带了占位符 —— 没过 fmt 就直出,
        // 用户看到的是标题「预计 {n} 小时内完成」+ 副标题「预计 24 小时内完成」
        // (同一句两遍,其中一遍是坏的)。改一个 key 的插值形态必须扫全部消费者。
        : t.value.wallet.trackEtaTitlePending,
);
const etaSub = computed(() => {
  // 失败终态不给「预计到账」——钱没走成,给的是原因 + 客服出口(见 needsSupport)。
  if (isFailedEnd.value) return t.value.wallet.trackFailedBody;
  if (isFrozenHold.value) return t.value.wallet.routeHeldFrozenBody;
  if (routeHeld.value) {
    const current = wd.value!;
    if (current.complianceReviewRequired) {
      return current.complianceHoldApplies && (current.complianceHoldDays ?? 0) > 0
        && typeof current.reviewHoldUntil === "number" && Number.isFinite(current.reviewHoldUntil)
        ? fmt(t.value.walletV3.complianceHoldUntilBody, { time: absTime(current.reviewHoldUntil) })
        : t.value.walletV3.complianceReviewRequired;
    }
    return t.value.wallet.withdrawRouteHeldSub;
  }
  // 终态给实际到账时刻；进行中只显示服务端订单快照中的预计时刻。
  if (isTerminalDone.value && wd.value) {
    const at = wd.value.confirmedAt;
    return typeof at === "number" && Number.isFinite(at)
      ? fmt(t.value.wallet.trackArrivedAt, { time: absTime(at) }) : t.value.wallet.confirmed;
  }
  const at = wd.value?.estimatedCompletion;
  return Number.isFinite(at) ? fmt(t.value.wallet.trackExpectedAt, { time: absTime(at as number) }) : t.value.wallet.trackReviewNote;
});

/** 按界面语言显示包含年份的本地时刻。到账是**确定发生过的事**,给绝对时间比「3 小时前」可核对。 */
function absTime(ts: number): string {
  return formatDisplayDateTime(ts, dateLocale());
}

/**
 * 每步的时间行。最后一步在终态显示**实际到账时刻**(来自单据的 confirmedAt,
 * 不是这里现编的);其余步沿用 demo 的相对时间阶梯。
 */
function stepTimeText(i: number): string {
  const w = wd.value;
  if (!w) return "";
  if (isTerminalDone.value && i === steps.value.length - 1) {
    const at = w.confirmedAt;
    return typeof at === "number" && Number.isFinite(at)
      ? fmt(t.value.wallet.trackArrivedAt, { time: absTime(at) }) : "";
  }
  // 🔴 只给单据里**真有**的时刻:提交(第 1 步)与实际到账(末步)。
  // 中间三步没有任何时间戳,原先用 3.5 秒假阶梯现编 —— 跨整点时会渲染成
  // 「73h/73h/72h/72h」,等于对一件从未发生过的事(链上广播)做时间断言;
  // 而生产路径本来就是 submitted 直接跳 confirmed,中间三步从不被进入。
  if (i === 0) return relTime(w.submittedAt);
  return "";
}

function relTime(ts: number): string {
  if (ts > Date.now()) return t.value.wallet.timePending;
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return t.value.wallet.timeJustNow;
  if (m < 60) return fmt(t.value.wallet.timeMinutesAgo, { n: m });
  return fmt(t.value.wallet.timeHoursAgo, { n: Math.floor(m / 60) });
}

function goWithdraw() {
  if (againDisabled.value) return; // 置灰按钮不能靠视觉拦,点击也得真的不走
  navTo("/pages/me/wallet-withdraw-method");
}
function goWallet() {
  navTo("/pages/me/me");
}
function goSupport() {
  navTo("/pages/me/support");
}

/** ⑤ 骨架块。与真实结构同尺寸,加载完不跳版。 */
function skelStyle(w: string, h: string, mt = "0", radius = "6px"): CSSProperties {
  return { width: w, height: h, marginTop: mt, borderRadius: radius, background: "var(--v5-surface-2)", opacity: 0.6 };
}

const emptyTextStyle: CSSProperties = { fontSize: "var(--ui-type-list-subtitle)", color: "var(--v5-ink-2)" };
const emptyLinkStyle: CSSProperties = { fontSize: "13px", color: "var(--v5-brand)" };
// De-carded amount hero — left-aligned on the page floor (2px optical inset);
// no surface/border, and the floor glow + dot-grid element are deleted outright.
// De-carded — the stepper structure is kept; a hairline opens the group and
// content sits at the 2px optical inset (no surface/border).
// Normal ETA — floor note; a hairline opens it (no surface/border).
const etaCardStyle: CSSProperties = { gap: "12px", padding: "8px 2px 0", borderTop: "1px solid var(--v5-border)" };
// Frozen/held ETA — danger accent callout (tint + border: the whitelisted
// accent-callout exception, reserved for a genuine alert state).
const etaFrozenCardStyle: CSSProperties = {
  gap: "12px",
  padding: "16px",
  borderRadius: "16px",
  background: "color-mix(in srgb, var(--v5-danger) 8%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-danger) 30%, transparent)",
};
const etaTitleStyle: CSSProperties = { fontSize: "var(--ui-type-list-subtitle)", fontWeight: 500, color: "var(--v5-ink)" };
const etaSubStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", marginTop: "2px" };
const reasonLineStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.5 };
// 客服出口 —— 独占一行的行动链接,撑到 44px 热区(《07》tap≥44,不吃 inline 豁免)。
const supportLinkStyle: CSSProperties = { display: "inline-flex", alignItems: "center", minHeight: "44px", marginTop: "2px" };
const supportLinkTextStyle: CSSProperties = { fontSize: "12px", fontWeight: 500, color: "var(--v5-brand)" };
// 「再提一笔」= 主行动,但在追踪页不抢主 CTA 的位置(用描边而非实心品牌色);
// 置灰态压低对比并去掉 active 反馈,视觉上就说明「现在按不了」。
// "再提一笔" is secondary here (返回钱包 is the page's single primary in the bar): quiet ink text on a 44px row.
const againBtnStyle = computed<CSSProperties>(() => ({
  width: "100%",
  height: "44px",
  borderRadius: "999px",
  background: "transparent",
  color: againDisabled.value ? "var(--v5-ink-4)" : "var(--v5-ink-2)",
  fontSize: "13px",
  fontWeight: 500,
  opacity: againDisabled.value ? 0.6 : 1,
  transition: "opacity 150ms ease",
}));
const againReasonStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.5 };
</script>

<style scoped>
/* P-45 withdrawal tracking: ticket with amount + status, tear line, timeline; back to wallet in the fixed bar. */
/* The order number in the header reads as an identifier (mono, as on the board). */
.tr-page--id :deep(.spv-title) { font-family: var(--font-metric); }
.tr { display: flex; flex-direction: column; gap: 12px; padding: 0 16px; }
.tr-ticket { position: relative; margin-top: 3px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.tr-tk { padding: 18px 20px 16px; }
.tr-row1 { display: flex; align-items: center; justify-content: space-between; }
.tr-k { color: var(--v5-ink-3); font: 400 12px/16px var(--font-v5); }
.tr-tag { display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: var(--v5-radius-full); font: 500 12px/16px var(--font-v5); white-space: nowrap; }
.tr-tag--brand { background: var(--v5-brand-soft); color: var(--v5-brand); }
.tr-tag--ok { background: var(--v5-success-soft); color: var(--v5-success-ink); }
.tr-tag--warn { background: var(--v5-warning-soft); color: var(--v5-warning-ink); }
.tr-tag--bad { background: var(--v5-danger-soft); color: var(--v5-danger); }
.tr-amt { display: block; margin-top: 6px; color: var(--v5-ink); font: 500 36px/44px var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tr-cur { margin-right: 2px; color: var(--v5-ink-3); font-size: .55em; letter-spacing: 0; }
.tr-dec { color: var(--v5-ink-3); }
.tr-note { display: block; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); }
.tr-addr { display: block; margin-top: 6px; color: var(--v5-ink-3); font: 400 12px/18px var(--font-metric); word-break: break-all; }
.tr-tear { position: relative; height: 0; margin: 0 18px; border-top: 1.5px dashed var(--v5-border-strong); }
.tr-tear::before, .tr-tear::after { content: ""; position: absolute; top: -11px; width: 20px; height: 20px; border-radius: 50%; background: var(--v5-bg); }
.tr-tear::before { left: -28px; } .tr-tear::after { right: -28px; }
.tr-tl { padding: 18px 20px 20px; }
.tr-st { position: relative; display: flex; gap: 14px; padding-bottom: 20px; }
.tr-st:last-child { padding-bottom: 0; }
.tr-st::before { content: ""; position: absolute; left: 11px; top: 26px; bottom: 2px; width: 2px; border-radius: 2px; background: var(--v5-surface-3); }
.tr-st--done::before { background: var(--v5-brand); }
.tr-st:last-child::before { display: none; }
.tr-st--todo { min-height: 4px; }
.tr-nd { position: relative; display: grid; place-items: center; flex: none; width: 24px; height: 24px; border-radius: 50%; }
.tr-st--done .tr-nd { background: var(--v5-brand); color: var(--v5-on-brand); }
.tr-st--cur .tr-nd { background: var(--v5-brand-soft); box-shadow: inset 0 0 0 2px var(--v5-brand); }
.tr-nd__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--v5-ink-4); }
.tr-st--cur .tr-nd__dot { background: var(--v5-brand); }
/* Live state only: the current step breathes while the withdrawal is still moving. */
.tr-nd--live::after { content: ""; position: absolute; inset: -5px; border-radius: 50%; border: 2px solid var(--v5-brand); opacity: 0; animation: tr-pulse 1.8s ease-out infinite; }
@keyframes tr-pulse { 0% { transform: scale(.8); opacity: .7; } 100% { transform: scale(1.3); opacity: 0; } }
.tr-st__t { display: block; color: var(--v5-ink); font: 500 15px/22px var(--font-v5); }
.tr-st--cur .tr-st__t { color: var(--v5-brand); }
.tr-st__d { display: block; color: var(--v5-ink-3); font: 400 13px/20px var(--font-v5); }
.tr-bar-space { height: 110px; }
.tr-bar { position: absolute; left: 0; right: 0; bottom: 0; z-index: 36; padding: var(--v5-space-3) var(--v5-space-4) calc(30px + env(safe-area-inset-bottom)); }
.tr-bar__btn { display: flex; align-items: center; justify-content: center; height: 48px; border-radius: var(--v5-radius-full); background: var(--v5-brand); color: var(--v5-on-brand); font: 500 15px/20px var(--font-v5); cursor: pointer; }
.tr-bar__btn:active { transform: scale(.98); }
.tr-bar__btn:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .tr-nd--live::after { animation: none; } .tr-bar__btn:active { transform: none; } }
</style>
