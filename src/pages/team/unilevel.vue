<template>
  <AppChassis active="team">
    <RewardPageSurface>
    <view class="pb-6" style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/team/team" :title="t.directReferral.title" :action-label="t.unilevel.howItWorksEntry" :action="openRules" plain />
      <view class="px-4" style="display: flex; flex-direction: column; gap: 16px">
        <EmptyState v-if="remoteState === 'error'" kind="recoverable-error" page :title="updateRequired ? t.directReferral.updateRequired : t.network.projectionErrorTitle" :desc="updateRequired ? t.directReferral.updateHint : t.network.projectionErrorDesc" :cta-label="updateRequired ? t.network.retry : t.ui.reload" @cta="retryRemote" />
        <template v-else>
        <!-- 首次加载（03 §3.4）：合计卡和记录卡按真实尺寸的静止占位，不闪烁。 -->
        <view v-if="remoteState !== 'ready' && !remoteSnapshot" class="nx-unilevel-loading" role="status" aria-busy="true" :aria-label="t.network.projectionLoadingTitle">
          <view class="nx-unilevel-loading__hero nx-tint" aria-hidden="true"><view class="nx-unilevel-loading__bar nx-unilevel-loading__bar--label" /><view class="nx-unilevel-loading__bar nx-unilevel-loading__bar--amount" /><view class="nx-unilevel-loading__bar nx-unilevel-loading__bar--uvt" /></view>
        </view>
        <template v-else-if="remoteSnapshot">
          <RewardHero class="nx-unilevel-hero nx-tint" kind="members">
            <text class="block nx-unilevel-hero-title">{{ filter === 'device_earning' ? t.directReferral.deviceEarning : t.directReferral.purchaseTotal }} · {{ visibility.mask(remoteGroupCount) }} {{ t.directReferral.settlementGroups }}</text>
            <view class="nx-royalty-totals" :class="{ 'nx-royalty-totals-large': wideAmount(remoteTotalUSDT) || wideAmount(remoteTotalNEX) }">
              <view><text class="block nx-num-amount nx-direct-amount nx-unilevel-main-amount"><text class="nx-unilevel-dollar">$</text>{{ totalAmountParts[0] }}<text v-if="totalAmountParts[1]" class="nx-unilevel-decimals">.{{ totalAmountParts[1] }}</text></text></view>
              <view><text class="block font-display tabular-nums nx-direct-amount" :style="{ fontSize: amount(remoteTotalNEX).length > 18 ? '20px' : '26px', fontWeight: 500, color: 'var(--v5-ink)' }">{{ visibility.mask(((remoteTotalNEX ?? 0) > 0 ? '+' : '') + formatAmount(remoteTotalNEX)) }}</text><text>UVT</text></view>
            </view>
          </RewardHero>
        </template>
        <view class="nx-unilevel-filters">
          <GlassSegments :label="t.directReferral.period" v-model="period" :options="periodOptions" layout="equal" surface="glass" selection="flat" />
          <!-- F2b: 来源筛选用共享次级分段控件（03 §3.7），放不下才滚动、选中项自动滚入可见。 -->
          <GlassSegments :label="t.directReferral.source" semantics="radio" v-model="filter" :options="filterOptions" layout="scroll" />
        </view>
        <view v-if="remoteState !== 'ready' && !remoteSnapshot" class="nx-unilevel-loading__card" aria-hidden="true">
          <view v-for="n in 3" :key="n" class="nx-unilevel-loading__row"><view class="nx-unilevel-loading__icon" /><view class="nx-unilevel-loading__lines"><view class="nx-unilevel-loading__bar nx-unilevel-loading__bar--name" /><view class="nx-unilevel-loading__bar nx-unilevel-loading__bar--meta" /></view><view class="nx-unilevel-loading__bar nx-unilevel-loading__bar--value" /></view>
        </view>
        <view v-if="(remoteState === 'ready' || remoteState === 'loading') && remoteSnapshot" class="nx-unilevel-ledger">
          <view v-for="day in eventDays" :key="day.key" class="nx-unilevel-day">
            <text class="nx-unilevel-day-label">{{ day.label }}</text>
            <view class="nx-unilevel-day-card">
            <view v-for="event in day.events" :key="event.id" class="nx-direct-event">
                <!-- F2 / F2b / F3 (DESIGN F2): icon tile | name and source · time | USDT line, UVT line when above 0, status as plain text under the amount. -->
                <view class="nx-unilevel-record-head">
                  <NxIconTile :tone="filter === 'device_earning' ? 'device' : 'sky'" size="s"><svg v-if="filter === 'device_earning'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" /></svg><svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6" /></svg></NxIconTile>
                  <view class="nx-unilevel-record-copy">
                    <text class="nx-unilevel-member">{{ event.sourceUserName }}</text>
                    <text class="nx-unilevel-source-label">{{ recordSource(event) }}</text>
                  </view>
                  <view class="nx-unilevel-record-amounts">
                    <text class="nx-direct-amount nx-unilevel-currency-row">{{ visibility.mask((event.amountUSDT > 0 ? '+' : '') + formatGroupedAmount(event.amountUSDT, 'full')) }}<text class="nx-unilevel-unit">{{ '\u00A0' }}USDT</text></text>
                    <text v-if="event.amountNEX > 0" class="nx-direct-amount nx-unilevel-uvt">{{ visibility.mask('+' + formatGroupedAmount(event.amountNEX, 'full')) }}{{ '\u00A0' }}UVT</text>
                    <text v-for="tag in statusTags(event)" :key="tag.key" class="nx-unilevel-status" :class="`nx-unilevel-status--${tag.tone}`">{{ tag.text }}</text>
                  </view>
                </view>
                <text v-if="event.status === 'recovery_pending'" class="nx-unilevel-recovery nx-direct-amount">{{ fmt(auditCopy.pendingRecovery, { usdt: '$' + amount(event.recoveryPendingUSDT), uvt: amount(event.recoveryPendingNEX) }) }}</text>
              </view>
            </view>
          </view>
          <EmptyState v-if="remoteSnapshot.totalRows === 0" kind="no-filter-results" :title="t.directReferral.empty" :desc="t.directReferral.emptyDesc" />
          <view v-if="remoteSnapshot.totalRows === 0" role="button" tabindex="0" class="nx-unilevel-focus reward-cta" @click="go('/pages/team/team')" @keydown.enter.prevent="go('/pages/team/team')" @keydown.space.prevent="go('/pages/team/team')"><text>{{ t.directReferral.invite }}</text></view>
          <view v-if="remoteSnapshot.events.length < remoteSnapshot.totalRows" class="nx-unilevel-load-more nx-unilevel-focus reward-cta reward-cta--wide" role="button" :tabindex="remoteState !== 'ready' || remoteLoadMoreStatus === 'loading' ? -1 : 0" :aria-disabled="remoteState !== 'ready' || remoteLoadMoreStatus === 'loading'"  @click="loadMoreRemote" @keydown.enter.prevent="loadMoreRemote" @keydown.space.prevent="loadMoreRemote"><text>{{ t.unilevel.loadMore }}</text></view>
        </view>
        <view v-if="policyState === 'error'" class="nx-unilevel-details"><text>{{ auditCopy.settlementDetails }}</text><text>—</text></view>
        <view v-else-if="policyState !== 'ready' && !policy" class="nx-unilevel-loading__bar nx-unilevel-loading__bar--policy" role="status" aria-busy="true" :aria-label="t.network.projectionLoadingTitle" />
        <view v-else-if="policy" style="display: flex; flex-direction: column; gap: 8px">
          <text v-if="!policy.configured" style="font-size: 12px; color: var(--v5-ink-3)">{{ t.directReferral.unconfigured }}</text>
          <text v-else-if="!devicePaused && policy.nexUsdtPrice === null" style="font-size: 12px; color: var(--v5-warning)">{{ t.directReferral.priceUnavailable }}</text>
        </view>
        <!-- Settlement fold (DESIGN F2): the closed title states the conclusion; the three sentences open on tap. -->
        <view role="button" tabindex="0" class="nx-unilevel-focus nx-unilevel-details-toggle" :aria-expanded="showSettlementDetails" @click="showSettlementDetails = !showSettlementDetails" @keydown.enter.prevent="showSettlementDetails = !showSettlementDetails" @keydown.space.prevent="showSettlementDetails = !showSettlementDetails"><text>{{ detailsSummary }}</text><NxIcon :name="showSettlementDetails ? 'minus' : 'plus'" /></view>
        <view v-if="showSettlementDetails" class="nx-unilevel-details">
          <text v-if="!devicePaused" class="block">{{ filter !== 'device_earning' ? rankCopy.f2Pays : deviceL2On ? rankCopy.f2DevPays : guideCopy.deviceBody }}</text>
          <template v-if="(policyState === 'ready' || policyState === 'loading') && policy">
            <text class="block">{{ ruleDescription }}</text>
          </template>
          <text class="block">{{ rankCopy.f2Net }}</text>
        </view>
        </template>
      </view>
    </view>
    </RewardPageSurface>
  </AppChassis>
</template>

<script setup lang="ts">
import NxIcon from "@/components/ui/nx-icon.vue";
import NxIconTile from "@/components/ui/nx-icon-tile.vue";
import { useVRank } from "@/store/v-rank";
import { useCommission } from "@/store/commission";
import { teamRuleGuideCopy } from "@/components/team/team-rule-guide-copy";
import { deviceLevel2On, deviceLevel2RatePct } from "@/lib/device-earning-level2";
import { creditsAtOnce, purchaseCoolingDays } from "@/lib/reward-cooling";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { teamLogicCopy } from "@/i18n/team-logic-copy";
import { formatAmount, formatGroupedAmount } from "@/lib/amount-display";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { toast } from "@/store/ui";
import AppChassis from "@/components/app-chassis.vue";
import RewardHero from "@/components/team/reward-compact-hero.vue";
import RewardPageSurface from "@/components/team/reward-page-surface.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import EmptyState from "@/components/empty-state.vue";
import GlassSegments from "@/components/glass-segments.vue";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { useDataVisibility } from "@/store/data-visibility";
import { networkReauditCopy } from "@/i18n/network-reaudit";
import { fmt, dateLocale } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { apiClient, apiRuntimeConfig, expectedApiEnvironment, remoteApiEnabled, sessionVault } from "@/api/runtime";
import { createDirectReferralApi, type DirectReferralPolicy, type DirectReferralSnapshot, type DirectReferralEvent, type DirectReferralPeriod } from "@/api/direct-referral-api";
import { createTeamInsightsApi, type TeamUnilevelSnapshot, type TeamUnilevelEvent } from "@/api/team-insights-api";
import { binarySessionReady as accountSessionReady } from "@/lib/binary-session-ready";
import { createScopedReadCoalescer } from "@/lib/binary-read-coalescer";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import { captureRuntimeRevision, isCurrentRuntimeRevision, subscribeRuntimeRevision } from "@/api/order-api";
import { navTo } from "@/lib/route";
import { formatHowNumber, formatRankPurchaseRate } from "@/lib/rank-how-content";

const t = useT(), app = useApp(), auth = useAuth();
const locale = useLocaleStore();
const visibility = useDataVisibility();
const logicCopy = computed(() => teamLogicCopy(locale.code));
const auditCopy = computed(() => networkReauditCopy(locale.code));
const showSettlementDetails = ref(false);
const rankCopy = computed(() => t.value.myRank);
const vrank = useVRank();
const commission = useCommission();
const readEnvironment = [apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl] as const;
let environmentInvalidated = false;
watch(() => [apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl] as const, () => { environmentInvalidated = true; }, { flush: 'sync' });
const environmentCurrent = () => !environmentInvalidated && readEnvironment[0] === apiRuntimeConfig.environment && readEnvironment[1] === apiRuntimeConfig.baseUrl;
const directApi = createDirectReferralApi(apiClient, expectedApiEnvironment);
const purchaseApi = createTeamInsightsApi(apiClient, expectedApiEnvironment);
let readCoalescer = createScopedReadCoalescer();
const period = ref<DirectReferralPeriod>("month");
const filter = ref<"direct" | "extended" | "device_earning">("direct");
const remoteSnapshot = ref<TeamUnilevelSnapshot | DirectReferralSnapshot | null>(null);
const policy = ref<DirectReferralPolicy | null>(null);
const remoteState = ref<"loading" | "ready" | "error">("loading");
const policyState = ref<"loading" | "ready" | "error">("loading");
const remoteLoadMoreStatus = ref<"idle" | "loading" | "error">("idle");
const updateRequired = ref(false);
let remoteRequest = 0, mounted = true, querySnapshotAt: string | null = null;
const remoteSessionReady = computed(() => accountSessionReady({
  remote: remoteApiEnabled, authenticated: auth.isAuthenticated, accountId: auth.accountId,
  appAccountKey: app.accountKey, sessionUserId: sessionVault.read()?.user.userId ?? null,
}));
function readPage(page = 1, pageSize = 20) {
  return filter.value === "device_earning"
    ? directApi.snapshot(period.value, page, pageSize, querySnapshotAt, "device_earning")
    : purchaseApi.unilevel(period.value, page, pageSize, querySnapshotAt, filter.value);
}
async function loadRemote() {
  if (!remoteSessionReady.value || !mounted || !environmentCurrent()) return;
  const request = ++remoteRequest, accountKey = app.accountKey, selectedPeriod = period.value, selectedFilter = filter.value;
  const accountScope = captureAccountScope(), runScope = captureRuntimeRevision();
  remoteState.value = "loading"; policyState.value = "loading"; remoteLoadMoreStatus.value = "idle"; updateRequired.value = false;
  const readLocale = locale.code;
  const current = () => mounted && request === remoteRequest && accountKey === app.accountKey && selectedPeriod === period.value && selectedFilter === filter.value
    && isCurrentAccountScope(accountScope) && isCurrentRuntimeRevision(runScope) && readLocale === locale.code && environmentCurrent();
  await Promise.all([
    readPage().then(snapshot => { if (current()) { querySnapshotAt = snapshot.snapshotAt; remoteSnapshot.value = snapshot; remoteState.value = "ready"; } })
      .catch((error: unknown) => { if (current()) { remoteSnapshot.value = null; updateRequired.value = error instanceof Error && ["TEAM_SCHEMA_UPDATE_REQUIRED", "TEAM_SCHEMA_VERSION_UNSUPPORTED", "DIRECT_REFERRAL_SCHEMA_VERSION_UNSUPPORTED"].includes(error.message); remoteState.value = "error"; } }),
    directApi.policy().then(snapshot => { if (current()) { policy.value = snapshot; policyState.value = "ready"; } })
      .catch(() => { if (current()) { policy.value = null; policyState.value = "error"; } }),
  ]);
}
async function loadMoreRemote() {
  const snapshot = remoteSnapshot.value;
  if (!mounted || !remoteSessionReady.value || remoteState.value !== "ready" || !snapshot
    || remoteLoadMoreStatus.value === "loading" || snapshot.events.length >= snapshot.totalRows) return;
  const request = remoteRequest, accountKey = app.accountKey, accountScope = captureAccountScope(), runScope = captureRuntimeRevision(), readLocale = locale.code;
  const current = () => mounted && request === remoteRequest && remoteSnapshot.value === snapshot && accountKey === app.accountKey
    && isCurrentAccountScope(accountScope) && isCurrentRuntimeRevision(runScope);
  remoteLoadMoreStatus.value = "loading";
  try {
    const next = await readPage(snapshot.page + 1, snapshot.pageSize);
    if (!current()) return;
    if (next.page !== snapshot.page + 1 || next.snapshotAt !== snapshot.snapshotAt || next.totalRows !== snapshot.totalRows) throw new Error("REWARD_PAGE_MISMATCH");
    const seen = new Set(snapshot.events.map(event => event.id));
    const events = [...snapshot.events, ...(next.events as (TeamUnilevelEvent | DirectReferralEvent)[]).filter(event => !seen.has(event.id))];
    remoteSnapshot.value = { ...next, events } as TeamUnilevelSnapshot | DirectReferralSnapshot;
    remoteLoadMoreStatus.value = "idle";
  } catch { if (current()) { remoteLoadMoreStatus.value = "error"; toast.error(t.value.network.projectionErrorDesc); } }
}
function retryRemote() {
  if (!remoteSessionReady.value || !mounted) return Promise.resolve();
  return readCoalescer.run({ accountKey: app.accountKey, accountBindingEpoch: app.accountBindingEpoch, runtime: captureRuntimeRevision() }, loadRemote);
}
function invalidate(resetSnapshot = true) {
  showSettlementDetails.value = false;
  remoteRequest++; remoteSnapshot.value = null; policy.value = null; remoteState.value = "loading"; policyState.value = "loading"; remoteLoadMoreStatus.value = "idle";
  if (resetSnapshot) querySnapshotAt = null;
  readCoalescer = createScopedReadCoalescer();
}
watch(() => [app.accountKey, app.accountBindingEpoch] as const, () => { invalidate(); retryRemote(); }, { flush: "sync" });
watch(remoteSessionReady, ready => { if (ready) retryRemote(); else invalidate(); }, { immediate: true, flush: "post" });
watch(period, () => { invalidate(); retryRemote(); }, { flush: 'sync' });
watch(filter, () => { invalidate(false); retryRemote(); }, { flush: 'sync' });
watch(() => [locale.code, apiRuntimeConfig.environment, apiRuntimeConfig.baseUrl] as const, () => { invalidate(); retryRemote(); }, { flush: 'sync' });
const unsubscribeRuntimeRevision = subscribeRuntimeRevision(() => { remoteRequest++; readCoalescer = createScopedReadCoalescer(); querySnapshotAt = null; retryRemote(); });
onMounted(retryRemote); onShow(() => {
  querySnapshotAt = null;
  retryRemote();
  if (remoteSessionReady.value) void vrank.ensureCanonicalVRank();
});
onUnmounted(() => { mounted = false; invalidate(); unsubscribeRuntimeRevision(); });
const totals = computed(() => {
  const snapshot = remoteSnapshot.value;
  if (!snapshot) return { amountUSDT: 0, amountNEX: 0, count: 0 };
  if ("direct" in snapshot.split) {
    const { direct, extended } = snapshot.split;
    return { amountUSDT: direct.amountUSDT + extended.amountUSDT, amountNEX: direct.amountNEX + extended.amountNEX, count: direct.count + extended.count };
  }
  return snapshot.split.deviceEarning;
});
const remoteTotalUSDT = computed(() => totals.value.amountUSDT), remoteTotalNEX = computed(() => totals.value.amountNEX), remoteGroupCount = computed(() => totals.value.count);
const currentRank = computed(() => vrank.remoteReady ? vrank.ladder[vrank.myRank] : undefined);
watch(currentRank, rank => {
  if (remoteApiEnabled && rank && (rank.purchaseL1Rate === undefined || rank.purchaseL2Rate === undefined)) void commission.ensureCanonicalConfig();
}, { immediate: true });
const deviceL2On = computed(() => deviceLevel2On(policy.value));
const devicePaused = computed(() => filter.value === "device_earning" && policy.value?.deviceEarning.enabled === false);
const guideCopy = computed(() => teamRuleGuideCopy(locale.code));
const pctText = (value: number | null | undefined) => value === null || value === undefined || !Number.isFinite(value) ? "—" : `${formatHowNumber(value, dateLocale())}%`;
const purchaseDays = computed(() => purchaseCoolingDays(policy.value));
const detailsSummary = computed(() => {
  const days = filter.value === "device_earning" ? policy.value?.deviceEarning.coolingDays ?? null : purchaseDays.value;
  const device = filter.value === "device_earning", copy = rankCopy.value;
  if (devicePaused.value || days === null) return copy.f2Details;
  if (creditsAtOnce(days)) return device ? copy.f2DevDetailsSumNow : copy.f2DetailsSumNow;
  return fmt(device ? copy.f2DevDetailsSum : copy.f2DetailsSum, { d: days });
});
const ruleDescription = computed(() => {
  const p = policy.value;
  if (!p) return "";
  if (filter.value !== "device_earning") {
    const reference = p.sevenLayerReference;
    if (p.settlementMode === "SEVEN_V2" && (p.purchaseSplitConfigured === false || !reference || reference.coolingDays === null
      || (reference.purchaseBaseRateSource !== "BENEFICIARY_RANK" && reference.baseRatePct === null))) return t.value.directReferral.purchaseUnconfigured;
    const current = currentRank.value;
    const legacy = commission.config?.unilevelUsdt;
    return fmt(creditsAtOnce(purchaseDays.value) ? rankCopy.value.f2RuleNow : rankCopy.value.f2Rule, {
      r: visibility.mask(current ? `V${current.v}` : "—"),
      a: formatRankPurchaseRate(current?.purchaseL1Rate ?? legacy?.[1], dateLocale()),
      b: formatRankPurchaseRate(current?.purchaseL2Rate ?? legacy?.[2], dateLocale()),
      d: purchaseDays.value ?? "—",
    });
  }
  const device = p.deviceEarning;
  if (!device.enabled) return t.value.directReferral.disabled;
  const values = { a: pctText(device.totalRatePct), b: pctText(deviceLevel2RatePct(p)), u: formatHowNumber(device.usdtSharePct, dateLocale()), n: formatHowNumber(100 - device.usdtSharePct, dateLocale()), d: device.coolingDays };
  const now = creditsAtOnce(device.coolingDays);
  return fmt(deviceL2On.value ? (now ? rankCopy.value.f2DevRuleNow : rankCopy.value.f2DevRule) : (now ? rankCopy.value.f2DevRuleL1Now : rankCopy.value.f2DevRuleL1), values);
});
// Records grouped by local calendar day, newest group first (events arrive newest first).
const eventDays = computed(() => {
  const days: { key: string; label: string; events: (DirectReferralEvent | TeamUnilevelEvent)[] }[] = [];
  (remoteSnapshot.value?.events ?? []).forEach(event => {
    const date = new Date(event.ts);
    const key = event.ts > 0 ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : 'unknown';
    let day = days.find(day => day.key === key);
    if (!day) {
      day = { key, label: event.ts > 0 ? `${date.toLocaleDateString(dateLocale(), { month: "numeric", day: "numeric" })} · ${date.toLocaleDateString(dateLocale(), { weekday: "short" })}` : logicCopy.value.dateUnavailable, events: [] };
      days.push(day);
    }
    day.events.push(event);
  });
  return days;
});
const periodOptions = computed(() => (["today", "week", "month", "all"] as const).map(value => ({ value, label: t.value.unilevel.periods[value] })));
const filterOptions = computed(() => [
  { value: "direct", label: rankCopy.value.chipBuy },
  { value: "extended", label: rankCopy.value.chipTeam },
  { value: "device_earning", label: rankCopy.value.chipDev },
] as const);
function amount(value: number | null | undefined) { return visibility.mask(formatAmount(value)); }
const totalAmountParts = computed(() => amount(remoteTotalUSDT.value).split('.'));
function wideAmount(value: number) { return amount(value).length > 12; }
function recordTime(ts: number) { return ts > 0 ? new Date(ts).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit', hour12: false }) : logicCopy.value.dateUnavailable; }
// Source line: friend layer for purchases ("好友 · 14:32"), "好友的好友购买" for layer 2, device layers by name.
function recordSource(event: DirectReferralEvent | TeamUnilevelEvent) {
  const copy = rankCopy.value, time = recordTime(event.ts);
  if (filter.value === 'device_earning') return fmt(event.layer === 2 ? copy.f2DevL2 : copy.f2DevL1, { t: time });
  if (filter.value === 'direct') return `${copy.l1} · ${time}`;
  return event.layer === 2 ? fmt(copy.f2L2, { t: time }) : `${t.value.directReferral.networkPurchase} · ${time}`;
}
// One tag per status, so each carries its own colour (03 §3.8); USDT and UVT get a tag each when they differ.
function statusTags(event: DirectReferralEvent | TeamUnilevelEvent) {
  const { statusUSDT, statusNEX } = event as TeamUnilevelEvent;
  return statusUSDT && statusNEX && statusUSDT !== statusNEX
    ? [{ key: "usdt", text: `USDT ${statusLabel(event, statusUSDT)}`, tone: statusTone(statusUSDT) }, { key: "uvt", text: `UVT ${statusLabel(event, statusNEX)}`, tone: statusTone(statusNEX) }]
    : [{ key: "all", text: statusLabel(event), tone: statusTone(event.status) }];
}
// 03 §3.8: pending payout → warning, credited → success, withdrawn → neutral, reversed or not paid → error. Frozen money is held, so warning.
function statusTone(status: DirectReferralEvent["status"]) {
  return status === "unlocked" ? "success" as const
    : status === "withdrawn" ? "neutral" as const
    : status === "reversed" || status === "rejected" ? "danger" as const
    : "warning" as const;
}
function statusLabel(event: DirectReferralEvent | TeamUnilevelEvent, status = event.status) {
  if (status === "cooling") return rankCopy.value.cooling;
  return status === "unlocked" ? rankCopy.value.credited
    : status === "waiting_calculation" ? t.value.directReferral.waitingCalculation
    : status === "withdrawn" ? t.value.commissions.withdrawnTag
    : status === "frozen" ? t.value.commissions.frozenTag
    : status === "reversed" ? t.value.commissions.reversedTag
    : status === "recovery_pending" ? t.value.directReferral.recoveryPending : t.value.commissions.rejectedTag;
}
function go(url: string) { navTo(url); }
function openRules() { go('/pages/team/unilevel-how'); }
useAutoRecovery({ failed: () => remoteApiEnabled && !updateRequired.value && remoteState.value !== "loading" && policyState.value !== "loading" && (remoteState.value === "error" || policyState.value === "error"), retry: retryRemote });
</script>

<style scoped>
.nx-direct-amount { overflow-wrap: break-word; }
/* Hero (P-41): flat surface with a faint brand tint; USDT total in the amount font, UVT in metric. */
:deep(.nx-unilevel-hero) { --nx-tint: var(--v5-brand); padding: var(--v5-space-5); border: 0; border-radius: 28px; }
.nx-unilevel-hero-title { font-size: 13px; line-height: 18px; font-weight: 500; color: var(--v5-ink-2); }
:deep(.nx-unilevel-hero .reward-hero__art) { display: none; }
.nx-royalty-totals { display: flex; flex-direction: column; gap: 2px; margin-top: var(--ui-space-row-y); }
.nx-unilevel-main-amount { font-size: 40px; line-height: 48px; font-weight: 500; letter-spacing: -0.03em; }
.nx-unilevel-dollar { margin-right: 2px; font-size: 22px; color: var(--v5-ink-3); }
.nx-unilevel-decimals { color: var(--v5-ink-3); }
.nx-royalty-totals > view + view { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; }
.nx-royalty-totals > view + view > text { font-family: var(--font-metric); color: var(--v5-brand) !important; }
.nx-royalty-totals > view + view > text { font-size: 14px !important; font-weight: 500 !important; }
.nx-royalty-totals-large > view:first-child > text { font-size: 26px !important; line-height: 34px; }

.nx-unilevel-filters { display: flex; flex-direction: column; gap: var(--ui-space-inline); }
/* First-load placeholder: the hero and one day card at their own sizes with still neutral bars (03 §3.4). */
.nx-unilevel-loading { display: flex; flex-direction: column; gap: var(--v5-space-4); }
.nx-unilevel-loading__hero { --nx-tint: var(--v5-brand); display: flex; flex-direction: column; box-sizing: border-box; padding: var(--v5-space-5); border-radius: 28px; }
.nx-unilevel-loading__bar { height: 12px; border-radius: 999px; background: color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.nx-unilevel-loading__bar--label { width: 120px; }
.nx-unilevel-loading__bar--amount { width: 168px; height: 36px; margin: var(--v5-space-4) 0 var(--v5-space-2); border-radius: 12px; }
.nx-unilevel-loading__bar--uvt { width: 88px; }
.nx-unilevel-loading__card { padding: var(--v5-space-1) var(--ui-space-inset); border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); }
.nx-unilevel-loading__row { display: flex; align-items: center; gap: var(--v5-space-3); min-height: 64px; }
.nx-unilevel-loading__row + .nx-unilevel-loading__row { border-top: 1px solid var(--v5-border); }
.nx-unilevel-loading__icon { flex: none; width: 32px; height: 32px; border-radius: 10px; background: color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.nx-unilevel-loading__lines { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--v5-space-2); }
.nx-unilevel-loading__bar--name { width: 96px; }
.nx-unilevel-loading__bar--meta { width: 132px; height: 10px; }
.nx-unilevel-loading__bar--value { width: 72px; }
.nx-unilevel-loading__bar--policy { width: 180px; margin: var(--v5-space-2) 0; }
.nx-unilevel-ledger { display: flex; flex-direction: column; gap: var(--ui-space-inset); }
.nx-unilevel-day { display: flex; flex-direction: column; gap: var(--v5-space-2); }
.nx-unilevel-day-label { padding: 0 var(--v5-space-1); font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.nx-unilevel-day-card { padding: 4px var(--ui-space-inset); border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); }
:global([data-theme="light"]) .nx-unilevel-day-card { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.nx-direct-event { padding: 12px 0; }
.nx-direct-event + .nx-direct-event { border-top: 1px solid var(--v5-border); }
/* Record row (DESIGN F2, 03 §3.6.1, 03.8): content-row title 500, subtitle ink-3, amount right with its unit,
   UVT under it when above 0, status as 12/16 text in the 03.8 colour (cooling warning, credited success). */
.nx-unilevel-record-head { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; gap: 12px; align-items: center; }
.nx-unilevel-record-copy { display: flex; flex-direction: column; min-width: 0; }
.nx-unilevel-member { min-width: 0; color: var(--v5-ink); font: 500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); overflow-wrap: break-word; }
.nx-unilevel-record-amounts { display: flex; flex-direction: column; align-items: flex-end; min-width: 0; text-align: right; font-variant-numeric: tabular-nums; }
.nx-unilevel-currency-row { display: block; font: 500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); white-space: nowrap; }
.nx-unilevel-unit { font: 500 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.nx-unilevel-uvt { display: block; color: var(--v5-ink-3); font: 400 12px/16px var(--font-v5); white-space: nowrap; }
.nx-unilevel-status { display: block; font: 400 12px/16px var(--font-v5); white-space: nowrap; }
.nx-unilevel-status--warning { color: var(--v5-warning-ink); }
.nx-unilevel-status--success { color: var(--v5-success-ink); }
.nx-unilevel-status--neutral { color: var(--v5-ink-3); }
.nx-unilevel-status--danger { color: var(--v5-danger); }
.nx-unilevel-source-label { display: block; margin-top: 2px; color: var(--v5-ink-3); font: 400 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); overflow-wrap: break-word; }
.nx-unilevel-recovery { display: block; margin: var(--v5-space-2) 0 0 48px; color: var(--v5-ink-2); font-size: 12px; line-height: 1.6; }
.nx-unilevel-focus:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.nx-unilevel-details-toggle { min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-inline); color: var(--v5-ink-2); font: 500 13px/18px var(--font-v5); }
.nx-unilevel-details { display: flex; flex-direction: column; gap: 6px; margin-top: -8px; color: var(--v5-ink-3); font: 400 var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); overflow-wrap: break-word; }
</style>
