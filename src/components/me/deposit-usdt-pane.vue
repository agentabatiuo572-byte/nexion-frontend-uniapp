<!--
  DepositUsdtPane — 充值页「USDT 链上」通道段(PAY-规格 [FEAT-PAY01] ⑤⑥)。
  正式模式支持 BEP20 / ERC20 → 专属地址 QR + 复制 + 服务端费/最低额/确认数
  → 常驻错网络警示 → 指引/工单入口 → 最近入金
  列表(confirming n/N 实时进度 · credited / dust_hold / returned 态)。
  4 态:骨架(匹配形状)/ 空列表 / 断网 inline 重试;服务端报告未配置或已关闭的网络不显示。
  数据纯展示:状态 server-canonical(mock 引擎在 deposits store),本组件零写状态。
-->
<template>
  <view class="mx-4" style="padding: 0 2px">
      <!-- ── 网络:上下两行单选(选中 = 品牌描边 + 实心点)── -->
      <view v-if="visibleNets.length" class="nx-dep-nets" role="radiogroup" :aria-label="t.wallet.networkLabel">
        <view
          v-for="nw in visibleNets"
          :key="nw.id"
          :class="['nx-dep-net', `nx-dep-net-${nw.label.toLowerCase()}`, { 'nx-dep-net--on': net === nw.id }]"
          role="radio" tabindex="0"
          :aria-checked="net === nw.id"
          @click="pickNet(nw.id)" @keydown.enter.prevent="pickNet(nw.id)" @keydown.space.prevent="pickNet(nw.id)"
        >
          <view class="nx-dep-net__nm">
            <text class="nx-dep-net__name">{{ nw.label }}</text>
            <text v-if="nw.id === 'usdt-trc20'" class="nx-dep-net__sub">{{ t.topupChrome.netRecommended }}</text>
            <text v-else class="nx-dep-net__sub">{{ fmt(t.topupChrome.netFee, { fee: (addressRefreshFailed || (fundsServerEnabled && (!serverEnabled || nw.id !== net))) ? "—" : formatAmount(fundsServerEnabled ? feeUsdt : CHAIN_DEPOSIT_FEE_USDT[nw.id]) }) }}</text>
          </view>
          <view class="nx-dep-net__ck" aria-hidden="true" />
        </view>
      </view>


    <!-- ── 加载骨架(chip 行 / QR 区 / 入口区,匹配真实形状)── -->
    <view v-if="phase === 'loading'">
      <view class="nx-dep-sk" style="height: 300px; margin-top: 16px" />
      <view class="nx-dep-sk" style="height: 96px; margin-top: 16px" />
    </view>

    <view v-else-if="phase === 'preparing'" class="flex flex-col items-center" style="padding: 40px 0 32px" role="status">
      <view class="nx-dep-sk" style="width: 56px; height: 56px; border-radius: 50%" />
      <text style="margin-top: 16px; color: var(--v5-ink-2)">{{ t.topupChrome.addrPreparing }}</text>
    </view>

    <!-- ── 地址拉取失败(断网)→ inline 重试 ── -->
    <view v-else-if="phase === 'error'" class="flex flex-col items-center" style="padding: 40px 0 32px">
      <view class="grid place-items-center" :style="stateIconBoxStyle">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
      </view>
      <view><text class="block text-center" style="margin-top: 10px; font-size: 12px; color: var(--v5-ink-3)">{{ t.topupChrome.addrLoadFailed }}</text></view>
      <view class="nx-dep-retry-cta grid place-items-center active:opacity-80" :style="retryBtnStyle" role="button" tabindex="0" @click="refresh()">
        <text style="font: 600 13px/20px var(--font-v5); color: var(--v5-ink)">{{ t.ui.retry }}</text>
      </view>
    </view>

    <template v-else>
      <view v-if="addressRefreshFailed" class="nx-dep-background-error" role="status">
        <text :style="noteStyle">{{ t.topupChrome.addrLoadFailed }}</text>
        <view class="nx-dep-background-retry grid place-items-center active:opacity-80" :style="retryBtnStyle" role="button" tabindex="0" @click="refresh(true)"><text style="font-size: 13px; font-weight: 500; color: var(--v5-ink)">{{ t.ui.retry }}</text></view>
      </view>
      <!-- ── 专属地址票据:QR 白卡 + 撕线 + 地址井 + 三项事实 ── -->
      <view v-if="activeNet" class="nx-dep-ticket">
        <view class="nx-dep-ticket__top">
          <text class="nx-dep-via">{{ fmt(t.topupChrome.sendVia, { network: activeLabel }) }}</text>
          <view v-if="fundsServerEnabled && !serverCreditEnabled" class="nx-dep-credit-paused-note" :style="warnlineStyle">
            <text :style="warnTextStyle">{{ t.topupChrome.creditPausedNote }}</text>
          </view>
          <view v-if="address" class="nx-dep-qr-box">
            <image class="nx-dep-qr-image" :src="qrImage" mode="aspectFit" aria-hidden="true" />
          </view>
          <text class="nx-dep-scan">{{ t.topupChrome.scanOrCopy }}</text>
        </view>
        <view class="nx-dep-tear" aria-hidden="true" />
        <view class="nx-dep-ticket__bot">
          <view class="nx-dep-addr">
            <text class="nx-dep-addr__a">{{ shortAddr }}</text>
            <view :class="['nx-dep-copy-address-cta nx-frosted-button', { 'nx-dep-copy--done': copied }]" role="button" tabindex="0" :aria-label="copied ? t.topupChrome.addrCopied : t.topupChrome.copyAddress" @click="copyAddr">
              <svg v-if="copied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              <text>{{ t.bankPane.copyCta }}</text>
            </view>
          </view>
          <!-- 费用/最低额/确认数 — 服务端或 deposits-core 常量单源 -->
          <view class="nx-dep-trio">
            <view><text class="nx-dep-k">{{ t.topupChrome.minDeposit }}</text><text class="nx-dep-trio__v">${{ formatAmount(minDeposit) }}</text></view>
            <view><text class="nx-dep-k">{{ t.topupChrome.fee }}</text><text class="nx-dep-trio__v">{{ formatAmount(feeUsdt) }} USDT</text></view>
            <view><text class="nx-dep-k">{{ t.topupChrome.confirmationsLabel }}</text><text class="nx-dep-trio__v">{{ confirmations }}</text></view>
          </view>
        </view>
      </view>

      <!-- ── 可用专属地址警示:地址恒定 + 错网络不可找回(规格 ⑦ 语义)── -->
      <view v-if="activeNet && address" class="nx-dep-warnbox">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4M12 17h.01" /></svg>
        <text>{{ t.topupChrome.depositAddrNote }}</text>
      </view>
      <view v-if="activeNet" class="nx-dep-amount-note"><text>{{ t.topupChrome.amountAtSenderNote }}</text></view>

      <!-- ── 指引 / 工单入口 ── -->
      <view class="nx-dep-rows nx-dep-links">
        <view class="nx-dep-usdt-guide-link nx-dep-link" role="button" tabindex="0" @click="goGuide">
          <view class="nx-dep-link__ico nx-dep-link__ico--tech" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg></view>
          <text class="nx-dep-link__t">{{ t.topupChrome.howToGetUsdt }}</text>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </view>
        <view class="nx-dep-support-link nx-dep-link" role="button" tabindex="0" @click="goSupport">
          <view class="nx-dep-link__ico nx-dep-link__ico--warn" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" /></svg></view>
          <text class="nx-dep-link__t">{{ t.topupChrome.depositNotArrived }}</text>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </view>
      </view>

      <!-- ── 最近入金 ── -->
      <view>
        <text class="nx-dep-sec">{{ t.topupChrome.recentDeposits }}</text>

        <view v-if="bankHistoryStatus === 'idle' || bankHistoryStatus === 'loading'" class="nx-dep-history-loading nx-dep-sk" role="status" :aria-label="t.bankWithdrawal.loading" style="height: 56px; margin-top: 8px" />
        <view v-else-if="bankHistoryStatus === 'error'" style="margin-top: 8px">
          <text :style="noteStyle">{{ t.topupChrome.depositOpFailedNote }}</text>
          <view class="nx-dep-history-retry nx-card-recovery-action nx-card-recovery-action--quiet active:opacity-80" role="button" tabindex="0" @click="refreshBankHistory">
            <text>{{ t.ui.retry }}</text>
          </view>
        </view>

        <view v-if="fundsServerEnabled && chainHistoryFailed" style="margin-top: 8px">
          <text :style="noteStyle">{{ t.topupChrome.depositOpFailedNote }}</text>
          <view class="nx-dep-chain-history-retry nx-card-recovery-action nx-card-recovery-action--quiet active:opacity-80" role="button" tabindex="0" @click="refresh()"><text>{{ t.ui.retry }}</text></view>
        </view>
        <view v-else-if="fundsServerEnabled && !chainHistoryLoaded" class="nx-dep-chain-history-loading nx-dep-sk" role="status" :aria-label="t.bankWithdrawal.loading" style="height: 56px; margin-top: 8px" />

        <view v-if="sortedRecords.length === 0 && bankHistoryStatus === 'ready' && (!fundsServerEnabled || (chainHistoryLoaded && !chainHistoryFailed && !addressRefreshFailed))" class="flex flex-col items-center" style="padding: 26px 0 18px">
          <view class="grid place-items-center" :style="stateIconBoxStyle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></svg>
          </view>
          <view><text class="block text-center" style="margin-top: 8px; font-size: 12px; color: var(--v5-ink-4)">{{ t.topupChrome.noDepositsYet }}</text></view>
        </view>

        <view v-else-if="sortedRecords.length > 0" class="nx-dep-rows">
          <view
            v-for="r in sortedRecords"
            :key="r.depositId"
            class="nx-dep-record-row"
            :role="recordClickable(r) ? 'button' : undefined"
            :tabindex="recordClickable(r) ? 0 : undefined"
            v-on="recordRowOn(r)"
          >
            <view class="nx-dep-record-row__ico" :class="{ 'nx-dep-record-row__ico--ok': r.status === 'credited' }" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
            </view>
            <view class="nx-dep-record-row__main">
              <text class="nx-dep-record-row__title">{{ rowTitle(r) }}</text>
              <text class="nx-dep-record-row__sub">{{ netShort(r.channel) }} · {{ r.depositId }}</text>
              <view v-if="isInFlight(r) && r.requiredConfirmations != null" class="nx-dep-progress" :style="progTrackStyle"><view :style="progFillStyle(r)" /></view>
              <view v-if="noteText(r)"><text class="block" :style="noteStyle">{{ noteText(r) }}</text></view>
            </view>
            <view class="nx-dep-record-row__side">
              <text class="nx-dep-record-row__amt" :style="rowAmtStyle(r)">{{ r.status === "credited" ? "+" : "" }}{{ rowAmount(r) }}</text>
              <text v-if="stateText(r)" class="nx-dep-record-row__state" :style="stateTextStyle(r)">{{ stateText(r) }}</text>
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { formatAmount as formatBaseAmount } from "@/lib/amount-display";
import { exactDepositAmount } from "@/api/cregis-deposit-api";
const formatAmount = (value: number | string | null | undefined) => formatBaseAmount(value, 2);
import { ref, computed, onMounted, onUnmounted, watch, type CSSProperties } from "vue";
import { onShow, onHide } from "@dcloudio/uni-app";
import qrcode from "qrcode-generator";
import { cregisDepositApi, fundsServerEnabled, sessionVault } from "@/api/runtime";
import { binarySessionReady } from "@/lib/binary-session-ready";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { navTo } from "@/lib/route";
import { toast } from "@/store/ui";
import { useDeposits } from "@/store/deposits";
import { mockServerNow } from "@/store/server-time";
import {
  CHAIN_DEPOSIT_FEE_USDT,
  CHAIN_REQUIRED_CONFIRMATIONS,
  MIN_DEPOSIT_USDT,
  isChainChannel,
} from "@/store/deposits-core";
import type { ChainDepositChannel, DepositChannel, DepositRecord } from "@/store/types";

const t = useT();
const dep = useDeposits();
const app = useApp();
const auth = useAuth();
const remoteSessionReady = computed(() => {
  void app.accountBindingEpoch;
  return binarySessionReady({
    remote: fundsServerEnabled,
    authenticated: auth.isAuthenticated,
    accountId: auth.accountId,
    appAccountKey: app.accountKey,
    sessionUserId: sessionVault.read()?.user.userId ?? null,
  });
});

// ── 网络 chip(标签为链名专有名词,非文案)──
const NETWORKS: { id: ChainDepositChannel; label: string }[] = fundsServerEnabled ? [
  { id: "usdt-bep20", label: "BEP20" },
  { id: "usdt-erc20", label: "ERC20" },
] : [
  { id: "usdt-trc20", label: "TRC20" },
  { id: "usdt-bep20", label: "BEP20" },
  { id: "usdt-erc20", label: "ERC20" },
];
const CHANNEL_SHORT: Record<DepositChannel, string> = {
  "usdt-trc20": "TRC20",
  "usdt-bep20": "BEP20",
  "usdt-erc20": "ERC20",
  "bank-vietqr": "VietQR",
  "card-intl": "Card",
};
/** confirming 超过 30 分钟未走满 → 「网络拥堵」提示([FEAT-PAY01] ② 异常3)。 */
const CONFIRM_DELAY_NOTE_MS = 30 * 60 * 1000;

const net = ref<ChainDepositChannel>(fundsServerEnabled ? "usdt-bep20" : "usdt-trc20");
// Networks the server reported as not configured or turned off are not shown.
// The address read is the only per-network signal, so a network is known only once it has been read.
// The list is forgotten when the page shows again or the user retries, so a network turned back on returns;
// only the selected network is read (reading allocates an address).
const offNets = ref<ChainDepositChannel[]>([]);
const visibleNets = computed(() => NETWORKS.filter((nw) => fundsServerEnabled ? !offNets.value.includes(nw.id) : dep.chainChannelEnabled[nw.id] === true));

// ── 正式模式从服务端获取地址与记录；失败时只显示重试，不回退到模拟地址。──
const phase = ref<"loading" | "preparing" | "error" | "ready">("loading");
let loadTimer: ReturnType<typeof setTimeout> | undefined;
let pollTimer: ReturnType<typeof setInterval> | undefined;
let loadGeneration = 0;
let pageVisible = true;
const requestRunning = ref(false);
let nextPollAt = 0;
let pollFailures = 0;
function pollDelay(state: "preparing" | "ready" | "error", failures = 0): number {
  if (state === "preparing") return 5_000 + Math.floor(Math.random() * 5_001);
  if (state === "ready") return 30_000 + Math.floor(Math.random() * 15_001);
  return Math.min(60_000, 10_000 * 2 ** Math.min(failures, 2)) + Math.floor(Math.random() * 5_001);
}
const serverAddress = ref("");
const serverEnabled = ref(false);
const serverCreditEnabled = ref(false);
const chainHistoryLoaded = ref(false);
const chainHistoryFailed = ref(false);
const addressRefreshFailed = ref(false);
type PaneDepositRecord = Omit<DepositRecord, "status"> & {
  status: DepositRecord["status"] | "reorg_investigating" | "provider_conflict_hold" | "reorg_reversed";
  reviewHold?: boolean;
  grossExact?: string | null;
  creditedExact?: string | null;
};
const serverRecords = ref<PaneDepositRecord[]>([]);
const copied = ref(false);
const minDeposit = ref<string | number | null>(fundsServerEnabled ? null : MIN_DEPOSIT_USDT);
const feeUsdt = ref<string | number | null>(fundsServerEnabled ? null : 0);
const confirmations = ref(CHAIN_REQUIRED_CONFIRMATIONS["usdt-bep20"]);
function refresh(background = false): Promise<void> {
  offNets.value = [];
  return load(background);
}
async function refreshBankHistory(): Promise<void> {
  if (fundsServerEnabled && remoteSessionReady.value && dep.currentAccountKey() === app.accountKey
      && dep.remoteReceiptInitialStatus !== "loading") await dep.refreshRemoteVietQrDeposits();
}
async function load(background = false): Promise<void> {
  if (fundsServerEnabled && (!remoteSessionReady.value || !pageVisible)) return;
  if (background && requestRunning.value) return;
  const hadSnapshot = background && phase.value === "ready";
  if (!background) phase.value = "loading";
  if (loadTimer) clearTimeout(loadTimer);
  if (fundsServerEnabled) {
    if (!background) refreshBankHistory();
    const generation = ++loadGeneration;
    requestRunning.value = true;
    nextPollAt = Number.POSITIVE_INFINITY;
    const account = app.accountKey;
    const bindingEpoch = app.accountBindingEpoch;
    const selectedNetwork = net.value === "usdt-erc20" ? "ERC20" : "BEP20";
    await (async () => {
      try {
        const snapshot = await cregisDepositApi.address(selectedNetwork);
        if (generation !== loadGeneration || account !== app.accountKey
            || bindingEpoch !== app.accountBindingEpoch || !remoteSessionReady.value) return;
        if (snapshot.enabled && (snapshot.minDepositUsdt == null || !Number.isSafeInteger(Number(snapshot.minDepositUsdt))
            || Number(snapshot.minDepositUsdt) <= 0 || snapshot.feeUsdt == null || snapshot.confirmations == null)) throw new Error('CREGIS_DEPOSIT_POLICY_UNAVAILABLE');
        const selected = net.value;
        if (snapshot.enabled || snapshot.reason === "CREGIS_ADDRESS_PREPARING") {
          if (offNets.value.includes(selected)) offNets.value = offNets.value.filter((id) => id !== selected);
        } else {
          offNets.value = [...offNets.value.filter((id) => id !== selected), selected];
          const next = visibleNets.value[0];
          if (next) {
            pickNet(next.id);
            return;
          }
        }
        addressRefreshFailed.value = false;
        serverEnabled.value = snapshot.enabled;
        serverCreditEnabled.value = snapshot.creditEnabled === true;
        serverAddress.value = snapshot.enabled ? snapshot.address ?? "" : "";
        minDeposit.value = snapshot.minDepositUsdt == null ? null : exactDepositAmount(snapshot.minDepositUsdt, snapshot.minDepositUsdtExact);
        feeUsdt.value = snapshot.feeUsdt == null ? null : exactDepositAmount(snapshot.feeUsdt, snapshot.feeUsdtExact);
        confirmations.value = snapshot.confirmations ?? CHAIN_REQUIRED_CONFIRMATIONS["usdt-bep20"];
        phase.value = !snapshot.enabled && snapshot.reason === "CREGIS_ADDRESS_PREPARING" ? "preparing" : "ready";
        if (phase.value === "preparing") {
          nextPollAt = Date.now() + pollDelay(phase.value);
          return;
        }
        let deposits;
        try {
          deposits = await cregisDepositApi.list();
        } catch {
          if (generation === loadGeneration && account === app.accountKey
              && bindingEpoch === app.accountBindingEpoch && remoteSessionReady.value) {
            chainHistoryFailed.value = true;
            nextPollAt = Date.now() + pollDelay("error", pollFailures++);
          }
          return;
        }
        if (generation !== loadGeneration || account !== app.accountKey
            || bindingEpoch !== app.accountBindingEpoch || !remoteSessionReady.value) return;
        chainHistoryLoaded.value = true;
        chainHistoryFailed.value = false;
        serverRecords.value = deposits.map((row) => ({
          depositId: row.depositId, channel: row.network === "ERC20" ? "usdt-erc20" : "usdt-bep20", txHash: row.txHash,
          address: row.address, grossAmountUsdt: row.grossAmountUsdt,
          grossExact: exactDepositAmount(row.grossAmountUsdt, row.grossAmountUsdtExact),
          creditedExact: exactDepositAmount(row.creditedUsdt, row.creditedUsdtExact),
          feeUsdt: row.creditedUsdt > 0 ? row.grossAmountUsdt - row.creditedUsdt : 0,
          creditedUsdt: row.creditedUsdt,
          confirmations: row.confirmations, requiredConfirmations: row.requiredConfirmations ?? undefined,
          reviewHold: row.status === "REVIEW_HOLD",
          status: row.status === "CREDITED" ? "credited"
            : row.status === "REORG_INVESTIGATING" ? "reorg_investigating"
            : row.status === "PROVIDER_CONFLICT_HOLD" ? "provider_conflict_hold"
            : row.status === "REFUNDED" ? "returned"
            : row.status === "REORG_REVERSED" ? "reorg_reversed"
            : row.status === "CONFIRMING" ? "confirming" : "dust_hold",
          createdAt: row.createdAt, creditedAt: row.creditedAt ?? undefined,
        }));
        phase.value = !snapshot.enabled && snapshot.reason === "CREGIS_ADDRESS_PREPARING" ? "preparing" : "ready";
        pollFailures = 0;
        nextPollAt = Date.now() + pollDelay(phase.value);
      } catch {
        if (generation === loadGeneration && account === app.accountKey
            && bindingEpoch === app.accountBindingEpoch && remoteSessionReady.value) {
          serverAddress.value = "";
          serverEnabled.value = false;
          serverCreditEnabled.value = false;
          copied.value = false;
          addressRefreshFailed.value = hadSnapshot;
          phase.value = hadSnapshot ? "ready" : "error";
          nextPollAt = Date.now() + pollDelay("error", pollFailures++);
        }
      } finally {
        if (generation === loadGeneration) requestRunning.value = false;
      }
    })();
    return;
  }
  loadTimer = setTimeout(() => {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    phase.value = offline ? "error" : "ready";
  }, 650);
}
useAutoRecovery({
  failed: () => fundsServerEnabled && remoteSessionReady.value && !requestRunning.value
    && (phase.value === "error" || (phase.value === "ready" && (addressRefreshFailed.value || chainHistoryFailed.value))),
  retry: () => refresh(true),
});
useAutoRecovery({
  failed: () => fundsServerEnabled && remoteSessionReady.value && dep.remoteReceiptInitialStatus === "error",
  retry: refreshBankHistory,
});
watch([remoteSessionReady, () => app.accountKey, () => app.accountBindingEpoch], ([ready]) => {
  if (!fundsServerEnabled) return;
  loadGeneration++;
  serverAddress.value = "";
  serverEnabled.value = false;
  serverCreditEnabled.value = false;
  serverRecords.value = [];
  offNets.value = [];
  chainHistoryLoaded.value = false;
  chainHistoryFailed.value = false;
  addressRefreshFailed.value = false;
  copied.value = false;
  phase.value = "loading";
  if (ready) load();
}, { immediate: true, flush: "sync" });
onMounted(() => {
  if (!fundsServerEnabled) load();
  if (fundsServerEnabled) pollTimer = setInterval(() => {
    if (!pageVisible || (typeof document !== "undefined" && document.hidden)) return;
    if (phase.value !== "loading" && Date.now() >= nextPollAt) void load(true);
  }, 1_000);
});
onShow(() => { pageVisible = true; if (fundsServerEnabled) refresh(true); });
onHide(() => { pageVisible = false; loadGeneration++; requestRunning.value = false; });
onUnmounted(() => {
  pageVisible = false;
  loadGeneration++;
  if (loadTimer) clearTimeout(loadTimer);
  if (pollTimer) clearInterval(pollTimer);
});

// ── 服务端逐网络确认能力；切换时立即移除旧地址和二维码。──
function isEnabled(id: ChainDepositChannel): boolean {
  if (fundsServerEnabled) return id === net.value && serverEnabled.value && !!serverAddress.value;
  return dep.chainChannelEnabled[id] === true;
}
const activeNet = computed<ChainDepositChannel | null>(() => {
  if (isEnabled(net.value)) return net.value;
  if (fundsServerEnabled) return null;
  const fallback = NETWORKS.find((n) => isEnabled(n.id));
  return fallback ? fallback.id : null;
});
const activeLabel = computed(() => (activeNet.value ? CHANNEL_SHORT[activeNet.value] : ""));
function pickNet(id: ChainDepositChannel) {
  if (id === net.value) return;
  net.value = id;
  if (fundsServerEnabled) {
    serverAddress.value = ""; serverEnabled.value = false; serverCreditEnabled.value = false; copied.value = false;
    minDeposit.value = null; feeUsdt.value = null; addressRefreshFailed.value = false;
    load();
  }
}

// ── 专属地址(同账号同网络恒定;中段省略防溢出,复制取全量)──
const address = computed(() => fundsServerEnabled ? serverAddress.value
  : activeNet.value ? dep.depositAddress(activeNet.value) : "");
const shortAddr = computed(() => {
  const a = address.value;
  return a.length > 24 ? `${a.slice(0, 12)}…${a.slice(-8)}` : a;
});
let copyTimer: ReturnType<typeof setTimeout> | undefined;
function copyAddr() {
  if (!address.value) return;
  uni.setClipboardData({
    data: address.value,
    showToast: false, // 关掉 uni 系统 toast(恒中文「内容已复制」),只留应用内三语 toast
    success: () => {
      uni.hideToast(); // 双保险:个别平台忽略 showToast:false 仍弹系统条
      copied.value = true;
      toast.success(t.value.topupChrome.addrCopied);
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied.value = false), 1500);
    },
    fail: () => {},
  });
}

const qrImage = computed(() => {
  if (!address.value) return "";
  const code = qrcode(0, "M");
  code.addData(address.value);
  code.make();
  // Keep black/white pixels and a four-module quiet zone inside the bitmap.
  return code.createDataURL(4, 16);
});

// ── 入口 ──
function goGuide() {
  navTo("/pages/me/usdt-guide");
}
function goSupport() {
  // cat=deposit:从充值场景进工单,预选「充值」分类(上下文随入口带过去)
  navTo("/pages/support/messages");
}

// ── 最近入金(复用本人银行记录与初始读取状态;收据翻页不改变历史完整性)──
const bankHistoryStatus = computed(() => {
  if (!fundsServerEnabled) return "ready";
  const status = dep.remoteReceiptInitialStatus;
  return remoteSessionReady.value && dep.currentAccountKey() === app.accountKey ? status : "idle";
});
const sortedRecords = computed(() => {
  if (!fundsServerEnabled) return [...dep.records].sort((a, b) => b.createdAt - a.createdAt);
  if (!remoteSessionReady.value) return [];
  const bankRecords = dep.records;
  return [...serverRecords.value, ...(dep.currentAccountKey() === app.accountKey
    ? bankRecords.filter(row => row.channel === "bank-vietqr") : [])]
    .sort((a, b) => b.createdAt - a.createdAt);
});
/** 法币轨(VietQR / 银行卡)入账后与链上记录同列此区,标题按通道分流。
 *  全键 Record 而非三元表达式:新增通道时 TS 强制补齐,不会静默落进 USDT 文案 ——
 *  卡轨接入本列表时正是先踩了这个(旧写法「非银行轨即 USDT」会把卡入金标成 USDT 充值)。 */
function rowTitle(r: PaneDepositRecord): string {
  const tc = t.value.topupChrome;
  const titles: Record<DepositChannel, string> = {
    "usdt-trc20": tc.usdtDeposit,
    "usdt-bep20": tc.usdtDeposit,
    "usdt-erc20": tc.usdtDeposit,
    "bank-vietqr": t.value.bankPane.bankDeposit,
    "card-intl": tc.cardDeposit,
  };
  return titles[r.channel];
}
function isRiskHold(r: PaneDepositRecord): boolean {
  return r.status === "reorg_investigating" || r.status === "provider_conflict_hold";
}
function rowAmount(r: PaneDepositRecord): string {
  const value = r.status === "reorg_reversed" || isRiskHold(r) || r.creditedUsdt > 0 ? r.creditedUsdt : r.grossAmountUsdt;
  return formatAmount("grossExact" in r ? (value === r.creditedUsdt ? r.creditedExact : r.grossExact) : value);
}
function netShort(c: DepositChannel): string {
  return CHANNEL_SHORT[c];
}
function isInFlight(r: PaneDepositRecord): boolean {
  return r.status === "detected" || r.status === "confirming";
}
function stateText(r: PaneDepositRecord): string {
  const tc = t.value.topupChrome;
  if (r.status === "reorg_investigating") return tc.reorgInvestigating;
  if (r.status === "provider_conflict_hold") return tc.providerConflictHold;
  if (r.status === "reorg_reversed") return t.value.commissions.reversedTag;
  if (r.status === "credited") return tc.depositCredited;
  if (r.status === "returned") return tc.depositReturned;
  if (isInFlight(r)) {
    return fmt(tc.confirmingProgress, { n: r.confirmations ?? 0, total: r.requiredConfirmations ?? "-" });
  }
  return ""; // dust_hold:右侧留空,整句人工处理说明走 note 行
}
function noteText(r: PaneDepositRecord): string {
  const tc = t.value.topupChrome;
  if (isRiskHold(r)) return fmt(tc.riskHoldNote, { amount: rowAmount(r) });
  if ("reviewHold" in r && r.reviewHold) return tc.reviewHoldNote;
  if (r.status === "dust_hold") return fundsServerEnabled ? tc.dustHoldServerNote : tc.dustHoldNote;
  if (r.status === "confirming" && mockServerNow() - r.createdAt > CONFIRM_DELAY_NOTE_MS) return tc.confirmDelayed;
  return "";
}
/** 法币轨恒可点(跳账单页);链上轨只有已入账(credited)有交易详情可看(与 goRecord 同判据)。 */
function recordClickable(r: PaneDepositRecord): boolean {
  return !isChainChannel(r.channel) || (r.status === "credited" && (!("grossExact" in r) || r.grossExact !== null));
}
/** 不可点记录行不注册 click 监听(同 wallet-bills.billRowOn:防 tap-feedback 门判死控件)。 */
function recordRowOn(r: PaneDepositRecord) {
  return recordClickable(r) ? { click: () => goRecord(r) } : {};
}
function goRecord(r: PaneDepositRecord) {
  // 法币轨(银行转账 / 银行卡)无链上哈希,tx 浏览器框架页语义不符 → 跳账单页
  // (银行轨成功态的「查看账单」同口径;卡轨成功态回钱包,此处统一到账单页)。
  // 判据取自 deposits-core 单源,新增法币轨自动排除。
  if (!isChainChannel(r.channel)) {
    navTo("/pages/me/wallet-bills");
    return;
  }
  // 🔴 在途/灰尘/退回的链上记录不进 tx 页:tx 页状态区恒渲「已确认」,对未到账记录是编造
  // (账单深链 P0 的入金侧同类,证伪报告 R1);行内已展示确认进度与说明,无更多详情可看。
  if (r.status !== "credited") return;
  // 带真实参数进交易详情:金额=链上转账额(gross,与费率行 gross−fee=credited 闭环)、
  // 网络、确认数、专属收款地址、发生时间——tx 页入参优先,防种子假数据与本笔矛盾。
  const p = new URLSearchParams({
    hash: r.txHash ?? r.depositId,
    amount: fundsServerEnabled ? (r.grossExact ?? String(r.grossAmountUsdt)) : r.grossAmountUsdt.toFixed(2),
    net: CHANNEL_SHORT[r.channel],
    confs: String(r.confirmations ?? 0),
    age: String(Math.max(1, Math.round((mockServerNow() - r.createdAt) / 60_000))),
  });
  if (r.address) p.set("to", r.address);
  navTo(`/pages/tx/hash?${p.toString()}`);
}

// ── styles ──
const warnlineStyle: CSSProperties = {
  marginTop: "16px",
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
function rowAmtStyle(r: PaneDepositRecord): CSSProperties {
  return { color: r.status === "credited" ? "var(--v5-success-ink)" : "var(--v5-ink)" };
}
function stateTextStyle(r: PaneDepositRecord): CSSProperties {
  return {
    fontSize: "12px",
    whiteSpace: isRiskHold(r) ? "normal" : "nowrap",
    textAlign: "right",
    color: isRiskHold(r) ? "var(--v5-warning)" : r.status === "credited" ? "var(--v5-success-ink)" : ["returned", "reorg_reversed"].includes(r.status) ? "var(--v5-ink-4)" : "var(--v5-ink-3)",
  };
}
const progTrackStyle: CSSProperties = {
  height: "4px",
  marginTop: "8px",
  borderRadius: "999px",
  background: "var(--v5-surface-3)",
  overflow: "hidden",
};
function progFillStyle(r: PaneDepositRecord): CSSProperties {
  const total = Math.max(1, r.requiredConfirmations ?? 1);
  const pct = Math.max(4, Math.round(((r.confirmations ?? 0) / total) * 100));
  return {
    height: "100%",
    width: `${Math.min(100, pct)}%`,
    borderRadius: "999px",
    background: "var(--v5-brand)",
    transition: "width 0.4s ease",
  };
}
const noteStyle: CSSProperties = {
  marginTop: "4px",
  fontSize: "12px",
  color: "var(--v5-warning)",
  lineHeight: 1.4,
};
const stateIconBoxStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  borderRadius: "14px",
  // 图标框直接坐在页面底上,原 surface-2 与页面底同色不可辨,改 L1 surface。
  background: "var(--v5-surface)",
};
const retryBtnStyle: CSSProperties = {
  marginTop: "14px",
  minHeight: "44px",
  padding: "0 26px",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
};
</script>

<style scoped>
/* P-44 USDT channel: network radio rows, address ticket (white QR plate, tear line, address well), warning box, list cards. */
.nx-dep-nets { display: flex; flex-direction: column; gap: 8px; margin: 8px -2px 0; }
.nx-dep-net { position: relative; display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 16px; box-sizing: border-box; border-radius: var(--v5-radius-m); background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); cursor: pointer; transition: transform 120ms cubic-bezier(.2,.8,.2,1); }
.nx-dep-net:active { transform: scale(.97); }
.nx-dep-net:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.nx-dep-net--on { background: color-mix(in srgb, var(--v5-brand) 10%, var(--v5-surface)); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--v5-brand) 60%, transparent); }
.nx-dep-net__nm { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 10px; }
.nx-dep-net__name { color: var(--v5-ink); font: 500 15px/20px var(--font-v5); }
.nx-dep-net--on .nx-dep-net__name { color: var(--v5-brand); }
.nx-dep-net__sub { min-width: 0; overflow: hidden; color: var(--v5-ink-3); font: 400 12px/16px var(--font-v5); text-overflow: ellipsis; white-space: nowrap; }
.nx-dep-net__ck { position: relative; flex: none; width: 22px; height: 22px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--v5-ink-4); }
.nx-dep-net--on .nx-dep-net__ck { box-shadow: inset 0 0 0 2px var(--v5-brand); }
.nx-dep-net--on .nx-dep-net__ck::after { content: ""; position: absolute; inset: 5px; border-radius: 50%; background: var(--v5-brand); }
.nx-dep-ticket { position: relative; margin: 12px -2px 0; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.nx-dep-ticket__top { padding: 20px 20px 18px; text-align: center; }
.nx-dep-via { display: inline-flex; color: var(--v5-ink-3); font: 500 12px/16px var(--font-metric); letter-spacing: .04em; }
.nx-dep-qr-box { width: 184px; height: 184px; margin: 14px auto 0; padding: 10px; box-sizing: border-box; border-radius: 18px; background: #FFFFFF; box-shadow: 0 8px 24px rgba(0,0,0,.25); animation: nx-viz-pop 420ms cubic-bezier(.2,1.4,.4,1) 260ms both; }
.nx-dep-qr-image { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
.nx-dep-scan { display: block; margin-top: 12px; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); }
.nx-dep-tear { position: relative; height: 0; margin: 0 18px; border-top: 1.5px dashed var(--v5-border-strong); }
.nx-dep-tear::before, .nx-dep-tear::after { content: ""; position: absolute; top: -11px; width: 20px; height: 20px; border-radius: 50%; background: var(--v5-bg); }
.nx-dep-tear::before { left: -28px; } .nx-dep-tear::after { right: -28px; }
.nx-dep-ticket__bot { padding: 16px; }
.nx-dep-addr { display: flex; align-items: center; gap: 10px; padding: 10px 6px 10px 14px; border-radius: 14px; background: color-mix(in srgb, var(--v5-ink) 4%, transparent); box-shadow: inset 0 2px 8px rgba(0,0,0,.45), inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .nx-dep-addr { box-shadow: inset 0 1px 4px rgba(20,16,8,.10), inset 0 0 0 1px var(--v5-border); }
.nx-dep-addr__a { flex: 1; min-width: 0; overflow: hidden; color: var(--v5-ink); font: 500 13px/18px var(--font-metric); text-overflow: ellipsis; white-space: nowrap; }
.nx-dep-copy-address-cta { position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 32px; padding: 0 12px; border-radius: var(--v5-radius-full); --ui-button-fill: color-mix(in srgb, var(--v5-brand) 14%, transparent); --ui-button-ink: var(--v5-ink); color: var(--v5-ink); font: 500 13px/18px var(--font-v5); cursor: pointer; }
.nx-dep-copy-address-cta::after { content: ""; position: absolute; inset: -6px -2px; }
.nx-dep-copy-address-cta:active { transform: scale(.97); }
.nx-dep-trio { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 14px; text-align: center; }
.nx-dep-trio > view + view { border-left: 1px solid var(--v5-border); }
.nx-dep-k { display: block; color: var(--v5-ink-3); font: 400 12px/16px var(--font-v5); }
.nx-dep-trio .nx-dep-k { padding-top: 3px; }
.nx-dep-trio__v { display: block; margin-top: 2px; color: var(--v5-ink); font: 500 13px/18px var(--font-metric); font-variant-numeric: tabular-nums; }
.nx-dep-warnbox { display: flex; align-items: flex-start; gap: 10px; margin: 12px -2px 0; padding: 12px 14px; border-radius: 14px; background: color-mix(in srgb, var(--v5-warning) 16%, transparent); color: var(--v5-warning-ink); font: 400 13px/20px var(--font-v5); }
.nx-dep-warnbox > svg { flex: none; margin-top: 3px; }
.nx-dep-amount-note { margin-top: 10px; padding: 0 2px; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); }
.nx-dep-rows { margin: 16px -2px 0; overflow: hidden; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.nx-dep-link { display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 12px 16px; box-sizing: border-box; color: var(--v5-ink); cursor: pointer; }
.nx-dep-link__ico { display: grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: var(--ui-radius-icon); }
.nx-dep-link__ico--tech { background: var(--v5-tech-cyan-soft); color: var(--v5-tech-cyan); }
.nx-dep-link__ico--warn { background: var(--v5-warning-soft); color: var(--v5-warning-ink); }
.nx-dep-link__t { flex: 1; min-width: 0; font: 400 15px/20px var(--font-v5); }
.nx-dep-link + .nx-dep-link, .nx-dep-record-row + .nx-dep-record-row { border-top: 1px solid var(--v5-border); }
.nx-dep-link > svg { flex: none; color: var(--v5-ink-4); }
.nx-dep-link:active { opacity: .7; }
.nx-dep-sec { display: block; margin: 32px 2px 12px; color: var(--v5-ink); font: 600 17px/24px var(--font-v5); }
.nx-dep-sec + view > .nx-dep-rows, .nx-dep-sec ~ .nx-dep-rows { margin-top: 0; }
.nx-dep-record-row { display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 12px 16px; box-sizing: border-box; }
.nx-dep-record-row[role="button"]:active { opacity: .9; }
.nx-dep-record-row__ico { display: grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: var(--ui-radius-icon); background: var(--v5-surface-3); color: var(--v5-ink-2); }
.nx-dep-record-row__ico--ok { background: var(--v5-success-soft); color: var(--v5-success-ink); }
.nx-dep-record-row__main { flex: 1; min-width: 0; }
.nx-dep-record-row__title { display: block; color: var(--v5-ink); font: 500 15px/20px var(--font-v5); }
.nx-dep-record-row__sub { display: block; padding-top: 3px; overflow: hidden; color: var(--v5-ink-3); font: 400 12px/16px var(--font-metric); text-overflow: ellipsis; white-space: nowrap; }
.nx-dep-record-row__side { flex: none; max-width: 50%; text-align: right; }
.nx-dep-record-row__amt { display: block; font: 500 16px/20px var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.nx-dep-record-row__state { display: block; margin-top: 2px; font: 400 12px/16px var(--font-v5); }
@media (prefers-reduced-motion: reduce) { .nx-dep-net, .nx-dep-copy-address-cta { transition: none; } .nx-dep-net:active, .nx-dep-copy-address-cta:active { transform: none; } .nx-dep-qr-box { animation: none; } }
/* 骨架 shimmer(匹配形状占位;通用 spinner 禁用) */
.nx-dep-sk {
  border-radius: 16px;
  background: linear-gradient(90deg, var(--v5-surface-2) 25%, var(--v5-surface-3) 50%, var(--v5-surface-2) 75%);
  background-size: 200% 100%;
  animation: nx-dep-sk-sweep 1.2s linear infinite;
}
@keyframes nx-dep-sk-sweep {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
</style>
