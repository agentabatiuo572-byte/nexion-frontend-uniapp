<!--
  Earn tab — ported from Nexion-prototype/app/(main)/earn/page.tsx.
  Hybrid: V5 HERO (PillTabs + TotalEarnedCard) on top, V4 device-pool sections
  below. Conversion arc (earned → missed → trial escape → devices → fleet decay
  → market context → tier-locked tasks → footer):
    TrialHeroBanner / TrialGhostSlot
    → PillTabs (Today/Week/Month/All) + TotalEarnedCard (range total + breakdown)
    → MissedIncomeBanner
    → "My Devices" header + compact DeviceCardPC rows + add-device CTA
    → MarketBoard
    → TaskCenter.

  PillTabs + TotalEarnedCard inlined here (page-specific). Wrapped in
  <AppChassis active="earn">; entrance via <CardStagger>. Reads the same
  `earnings` aggregate Home reads so the Today pill matches Home exactly.
-->
<template>
  <AppChassis active="earn">
    <CardStagger class="pt-6 pb-4 earn-page" style="color: var(--v5-ink)">
      <!-- ===== Period switch ===== -->
      <view class="mx-4">
        <GlassSegments class="earn-range" :label="t.earn.rangeGroupLabel" semantics="radio" v-model="range" :options="rangeOptions"  />
      </view>

      <!-- ===== Bento: device earnings, completed jobs, latest settlement ===== -->
      <view class="earn-bento">
        <view class="earn-tile earn-tile--hero" role="group" :aria-label="auditCopy.deviceRevenue">
          <view class="earn-hero__row">
            <view class="earn-hero__label"><text>{{ auditCopy.deviceRevenue }} · {{ rangeLabel(range) }}</text><DataVisibilityToggle class="earn-hero__eye" /></view>
            <text class="earn-scope">{{ auditCopy.revenueScope }}</text>
          </view>
          <view class="earn-hero__amount">
            <text v-if="!visibility.hidden" class="earn-hero__currency">{{ totalPrefix || '$' }}</text>
            <text v-if="visibility.hidden" class="earn-hero__int">{{ visibility.mask(totalInt) }}</text>
            <text v-else class="earn-hero__int">{{ totalInt }}</text>
            <text v-if="totalKnown && !visibility.hidden" class="earn-hero__dec">.{{ totalCents }}</text>
          </view>
          <!-- 只有**确实请求失败**时才说不可用并给重试;零值已在上面显示为 0(#128)。 -->
          <view v-if="remoteApiEnabled && app.homeTruthStatus === 'error'" class="earn-hero__recovery" role="status" aria-live="polite">
            <view class="earn-hero__recovery-copy">
              <text class="earn-hero__recovery-title">{{ t.earn.summaryUnavailableTitle }}</text>
              <text class="earn-hero__recovery-body">{{ t.earn.summaryUnavailableBody }}</text>
            </view>
            <view class="earn-hero__retry" role="button" tabindex="0" @click="retrySummary" @keydown.enter.prevent="retrySummary" @keydown.space.prevent="retrySummary"><text>{{ t.ui.retry }}</text></view>
          </view>
          <text v-else class="earn-hero__nex">{{ visibility.mask(nexTotal === null ? '—' : `+${nexFmt}`) }}<text class="earn-hero__nex-unit">UVT</text></text>
        </view>
        <view class="earn-tile earn-tile--half" role="group" :aria-label="t.earn.completedJobs">
          <view class="earn-half__label"><view class="earn-half__icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7" /></svg></view><text>{{ t.earn.completedJobs }}</text></view>
          <text class="earn-half__count">{{ visibility.mask(jobsCount === null ? '—' : jobsCount.toLocaleString()) }}<text v-if="jobsCount !== null && !visibility.hidden && t.earn.completedJobsUnit" class="earn-half__unit">{{ t.earn.completedJobsUnit }}</text></text>
        </view>
        <view class="earn-tile earn-tile--half earn-tile--link" role="link" tabindex="0" :aria-label="latestLabel" @click="goLedger" @keydown.enter.stop.prevent="goLedger">
          <text class="earn-half__label">{{ t.earn.latestSettlement }}</text>
          <view v-if="latest" class="earn-half__latest"><text class="earn-half__amount">{{ visibility.mask(latest.amt) }}</text><text class="earn-half__who">{{ latest.model }} · {{ latest.who }}</text></view>
          <view v-else-if="!remoteApiEnabled || app.homeTruthStatus === 'idle' || (app.homeTruthStatus === 'loading' && !app.homeTruth)" class="earn-half__placeholder" aria-hidden="true" />
          <view v-else class="earn-half__latest"><text class="earn-half__amount earn-half__amount--none">—</text><text class="earn-half__who">{{ ledgerStatusText }}</text></view>
        </view>
      </view>

      <!-- ===== My compute fleet: slot ring, capacity explainer, device switcher + stage ===== -->
      <view class="earn-fleet-head">
        <text class="earn-fleet-head__title" role="heading" aria-level="2">{{ t.home.myFleet }}</text>
        <SlotRing />
        <LoopScope class="earn-capacity-info" role="button" tabindex="0" aria-haspopup="dialog" :aria-label="t.earn.taskPoolLineTitle" @click="openExplainer" @keydown.enter.stop.prevent="!$event.repeat && openExplainer()" @keydown.space.stop.prevent="!$event.repeat && openExplainer()">
          <svg class="earn-capacity-info__glyph" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <g class="earn-capacity-info__rocket">
              <path d="M8 14 5 17v3l4-2m7-4 3 3v3l-4-2" />
              <path d="M12 2c-3.3 2.7-4.7 7.5-3.5 13.5L10 18h4l1.5-2.5C16.7 9.5 15.3 4.7 12 2Z" fill="currentColor" fill-opacity=".12" />
              <circle cx="12" cy="9" r="2" />
              <path class="earn-capacity-info__flame" d="M10.2 18.5c-.7 1.5.2 3 1.8 4 1.6-1 2.5-2.5 1.8-4" fill="currentColor" stroke="none" />
              <path class="earn-capacity-info__exhaust" d="M8 21v1m8-1v1" stroke-width="1.2" />
            </g>
          </svg>
        </LoopScope>
      </view>
      <FleetStage />

      <EarningsLedgerCard class="mx-4 earn-block" />
      <MarketBoard class="earn-block" />
      <TaskCenter class="earn-block" />
      <!-- Lite has no phone compute way; staking is the only remaining way, so the section follows its visibility. -->
      <NxSection v-if="stakingVisible" class="mx-4 earn-block earn-more-ways" :title="auditCopy.moreWays">
        <EarnWayCard eyebrow="UVT" :title="remainderCopy.stakingTitle" :body="remainderCopy.earnWays.stakingBody"
          artwork="staking" :action="remainderCopy.stakingAction" @click="goStaking" />
      </NxSection>
      <!-- FEAT-DEV01: W-CAP1 任务产能说明弹层(单实例;设备卡/补贴 badge/提示线共用入口) -->
      <CapacityExplainerSheet />
    </CardStagger>
  </AppChassis>
</template>

<script setup lang="ts">
import { runPassiveTabRead } from "@/lib/passive-tab-read";
import { formatAmount } from "@/lib/amount-display";
import { formatUsdOverviewParts } from "@/lib/usd-display";
import { onUnmounted, computed, nextTick, ref, watch } from "vue";
import { onHide, onShow } from "@/composables/use-tab-page-lifecycle";
import { registerActivePageRefresh } from "@/lib/active-page-refresh";
import { useEarnConfig } from "@/store/earn-config";
import AppChassis from "@/components/tab-page-frame.vue";
import CardStagger from "@/components/card-stagger.vue";
import NxSection from "@/components/ui/nx-section.vue";
import EarnWayCard from "@/components/earn/earn-way-card.vue";
import EarningsLedgerCard from "@/components/home/earnings-ledger-card.vue";
import { useAuditUiCopy } from "@/i18n/audit-ui";
import { useRemainderUiCopy } from "@/i18n/remainder-ui";
import { useConfig } from "@/store/config";
import { navTo } from "@/lib/route";
import { useCountUp } from "@/composables/use-count-up";
import CapacityExplainerSheet from "@/components/earn/capacity-explainer-sheet.vue";

import FleetStage from "@/components/earn/fleet-stage.vue";
import SlotRing from "@/components/slot-ring.vue";
import LoopScope from "@/components/loop-scope.vue";
import { useEarningsLedger } from "@/composables/use-earnings-ledger";
import MarketBoard from "@/components/earn/market-board.vue";
import TaskCenter from "@/components/earn/task-center.vue";
import { useApp } from "@/store/app";
import { useT } from "@/i18n/use-t";
import { useCapacityExplainer } from "@/composables/use-capacity-explainer";
import { useFreeTrial } from "@/store/free-trial";
import { dayOnePageObservationApi, remoteApiEnabled, sessionVault } from "@/api/runtime";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import { reportDayOnePageObservation } from "@/lib/day-one-page-observation";
import { useDataVisibility } from "@/store/data-visibility";
import DataVisibilityToggle from "@/components/ui/data-visibility-toggle.vue";

type Range = "Today" | "Week" | "Month" | "All";
const RANGES: Range[] = ["Today", "Week", "Month", "All"];

const app = useApp();
const t = useT();
const visibility = useDataVisibility();
const auditCopy = useAuditUiCopy();
const remainderCopy = useRemainderUiCopy();
const config = useConfig();
const stakingVisible = computed(() => config.configStatus === "ready" && config.isEnabled("stakingVisible"));
function goStaking() {
  if (stakingVisible.value) navTo("/pages/staking/staking");
}
const range = ref<Range>("Today");
const freeTrial = useFreeTrial();
let earnPageVisible = false;
let earnObservationEpoch = 0;
let releaseActiveRefresh = () => {};
async function refreshVisibleEarn() {
  if (!earnPageVisible || !remoteApiEnabled) return;
  await Promise.allSettled([
    freeTrial.refreshRemote(), app.ensureRemoteFleet(), app.ensureHomeTruth(), useEarnConfig().ensure(),
  ]);
}

// The banner is the first discoverable H2 entry. Do not make a new user wait
// for the global poll before we know whether the server has made it eligible.
onShow(() => {
  earnPageVisible = true;
  releaseActiveRefresh();
  releaseActiveRefresh = registerActivePageRefresh(refreshVisibleEarn);
  app.setTaskReadPageVisible("earn", true);
  if (remoteApiEnabled) {
    void runPassiveTabRead('trial-state', () => freeTrial.refreshRemote());
    void app.ensureRemoteFleet().catch(() => undefined);
    void app.ensureHomeTruth().catch(() => undefined);
    void observeDayOneEarnPage();
  }
});

onHide(() => {
  releaseActiveRefresh();
  earnPageVisible = false;
  app.setTaskReadPageVisible("earn", false);
  earnObservationEpoch += 1;
});
onUnmounted(() => {
  releaseActiveRefresh();
  earnPageVisible = false;
  app.setTaskReadPageVisible("earn", false);
  earnObservationEpoch += 1;
});

async function observeDayOneEarnPage(): Promise<void> {
  if (!remoteApiEnabled || !earnPageVisible || app.homeTruthStatus !== "ready"
    || app.remoteFleetStatus !== "ready" || !app.homeTruth) return;
  const scope = captureAccountScope();
  const pageEpoch = earnObservationEpoch;
  await nextTick();
  if (!earnPageVisible || pageEpoch !== earnObservationEpoch || app.homeTruthStatus !== "ready"
    || app.remoteFleetStatus !== "ready" || !app.homeTruth) return;
  void reportDayOnePageObservation("visit_earn", {
    scope,
    session: sessionVault.read(),
    visible: () => earnPageVisible && pageEpoch === earnObservationEpoch,
    isCurrent: isCurrentAccountScope,
    submit: () => dayOnePageObservationApi.earnPage(),
  });
}

watch([() => app.homeTruthStatus, () => app.remoteFleetStatus, () => app.homeTruth], () => {
  void observeDayOneEarnPage();
});

/** Retry the summary read itself (Home overview), not just the fleet. */
function retrySummary() { void app.refreshHomeTruth().catch(() => undefined); }
function rangeLabel(r: Range): string { return r === "Today" ? t.value.earn.rangeToday : r === "Week" ? t.value.earn.rangeWeek : r === "Month" ? t.value.earn.rangeMonth : t.value.earn.rangeAll; }
/** 单选组的左右方向键:移一格并选上,焦点跟到新选中项(roving tabindex 的标准行为)。 */
function moveRange(index: number, delta: number): void {
  const next = RANGES[(index + delta + RANGES.length) % RANGES.length];
  if (!next) return;
  range.value = next;
  void nextTick(() => {
    if (typeof document === "undefined") return;
    document.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
  });
}

// Queue information opens the existing capacity explanation directly.
const capacityExplainer = useCapacityExplainer();
function openExplainer() {
  capacityExplainer.open();
}

// ── HERO total earned ──
const serverPeriod = computed(() => {
  // An explicit transient read failure may retain history; live guards still require ready.
  if (remoteApiEnabled && app.homeTruthStatus !== "ready" && app.homeTruthStatus !== "loading"
    && !(app.homeTruthStatus === "error" && app.homeTruthTransientFailure)) return null;
  const e = app.homeTruth?.earnings;
  if (!e) return null;
  return range.value === "Today" ? e.today : range.value === "Week" ? e.week : range.value === "Month" ? e.month : e.all;
});
/**
 * A successful Home overview encodes an empty settled-receipt period as three
 * nulls. That is a confirmed zero for every range; a failed/absent overview has
 * no period and stays unknown with the existing retry state. For a partial
 * Today projection, the device snapshot remains the zero-safe fallback. #249
 */
const serverPeriodValue = computed(() => {
  const period = serverPeriod.value;
  if (!period) return null;
  if (period.usdt === null && period.nex === null && period.jobCount === null) {
    return { usdt: 0, nex: 0, jobCount: 0 };
  }
  if (range.value !== "Today") return period;
  const fleet = app.remoteRealizedToday;
  return {
    ...period,
    usdt: period.usdt ?? fleet?.usdt ?? null,
    nex: period.nex ?? fleet?.nex ?? null,
    jobCount: period.jobCount ?? (fleet && fleet.usdt === 0 && fleet.nex === 0 ? 0 : null),
  };
});
const mockTotal = computed(() => {
  const e = app.earnings;
  return range.value === "Today" ? e.today : range.value === "Week" ? e.thisWeek : range.value === "Month" ? e.thisMonth : e.total;
});
const total = computed(() => remoteApiEnabled ? serverPeriodValue.value?.usdt ?? null : mockTotal.value);
// Only the first figure counts up; a later period switch shows its value directly.
const shownTotal = useCountUp(total);
const totalParts = computed(() => formatUsdOverviewParts(shownTotal.value));
const totalKnown = computed(() => totalParts.value !== null);
const totalPrefix = computed(() => totalParts.value?.prefix ?? "");
const totalInt = computed(() => totalParts.value?.integer ?? "—");
const totalCents = computed(() => totalParts.value?.fraction ?? "");
const nexTotal = computed(() => remoteApiEnabled ? serverPeriodValue.value?.nex ?? null : (() => { const e = app.earnings; const ratio = e.today > 0 ? e.todayNEX / e.today : 0; return mockTotal.value * ratio; })());
const shownNex = useCountUp(nexTotal);
const nexFmt = computed(() => shownNex.value === null ? "—" : formatAmount(shownNex.value));
const jobsCount = computed(() => {
  if (!remoteApiEnabled) return range.value === "Today" ? 14 : range.value === "Week" ? 98 : range.value === "Month" ? 412 : 1247;
  return serverPeriodValue.value?.jobCount ?? null;
});

// Latest settlement = the first row of the ledger below (same source); the tile opens the same "View all" page.
const { rows: ledgerRows, statusText: ledgerStatusText } = useEarningsLedger();
const latest = computed(() => ledgerRows.value[0] ?? null);
const latestLabel = computed(() => latest.value
  ? `${t.value.earn.latestSettlement} ${visibility.mask(latest.value.amt)}, ${latest.value.model} · ${latest.value.who}, ${t.value.home.earningsLedgerViewAll}`
  : `${t.value.earn.latestSettlement}, ${t.value.home.earningsLedgerViewAll}`);
function goLedger() { navTo("/pages/me/wallet-bills"); }

import GlassSegments from "@/components/glass-segments.vue";
const rangeOptions = computed(() => RANGES.map(value => ({ value, label: rangeLabel(value) })));
</script>

<style scoped>
.earn-page > .earn-bento { margin-top: 16px; }
.earn-bento { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0 16px; }
.earn-tile { position: relative; min-width: 0; box-sizing: border-box; overflow: hidden; border-radius: 22px; background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .earn-tile { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
/* The only ambient glow on Earn: a soft amber light in the big tile's corner. */
.earn-tile--hero { grid-column: 1 / -1; padding: 16px 18px 18px; border-radius: 24px; }
.earn-tile--hero::before { content: ""; position: absolute; right: -60px; top: -70px; width: 240px; height: 200px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-warning) 26%, transparent), transparent); pointer-events: none; }
[data-theme="light"] .earn-tile--hero::before { background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-warning) 16%, transparent), transparent); }
.earn-hero__row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.earn-hero__label { display: flex; align-items: center; gap: 2px; min-width: 0; font: 400 13px/18px var(--font-v5); color: var(--v5-ink-2); }
.earn-hero__eye { margin: -12px 0; color: var(--v5-ink-3); }
.earn-scope { color: var(--v5-ink-2); font: 400 12px/16px var(--font-v5); text-align: right; max-width: 50%; }
.earn-hero__amount { position: relative; display: flex; align-items: baseline; gap: 4px; margin-top: 10px; font-family: var(--font-amount); font-weight: 600; letter-spacing: -.024em; line-height: 1; color: var(--v5-ink); font-variant-numeric: tabular-nums; }
.earn-hero__currency { font-size: 20px; font-weight: 500; color: var(--v5-ink-3); }
/* -0.024em is set on each part so it scales with that part's size (em letter-spacing inherits as a fixed length). */
.earn-hero__int { font-size: 52px; letter-spacing: -.024em; }
.earn-hero__dec { font-size: 34px; color: var(--v5-ink-3); letter-spacing: -.024em; }
.earn-hero__nex { position: relative; display: block; margin-top: 10px; font: 600 15px/20px var(--font-metric); color: var(--v5-nex-ink); font-variant-numeric: tabular-nums; }
.earn-hero__nex-unit { margin-left: 3px; font: 500 12px/16px var(--font-v5); letter-spacing: .04em; }
.earn-hero__recovery { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; }
.earn-hero__recovery-copy { min-width: 0; }
.earn-hero__recovery-title { display: block; font: 500 12px/18px var(--font-v5); color: var(--v5-danger); }
.earn-hero__recovery-body { display: block; font: 400 12px/18px var(--font-v5); color: var(--v5-ink-3); }
/* Board spacing (2px); an invisible extension keeps the 44px touch target without taking layout width. */
.earn-hero__retry { position: relative; flex: none; display: inline-flex; align-items: center; min-height: 44px; padding: 0 2px; font: 500 13px/18px var(--font-v5); color: var(--v5-brand); cursor: pointer; }
.earn-hero__retry::after { content: ""; position: absolute; inset: 0 -8px; }
.earn-tile--half { display: flex; flex-direction: column; justify-content: space-between; gap: 8px; min-height: 116px; padding: 14px 14px 12px; }
.earn-tile--link { cursor: pointer; }
.earn-tile--link:active { opacity: .85; }
.earn-tile--link:focus-visible, .earn-hero__retry:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.earn-half__label { display: flex; align-items: center; gap: 6px; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.earn-half__icon { display: grid; place-items: center; width: 22px; height: 22px; flex: none; border-radius: 7px; background: color-mix(in srgb, var(--v5-tech-cyan) 16%, transparent); color: var(--v5-tech-cyan); }
.earn-half__count { font: 500 30px/34px var(--font-metric); color: var(--v5-ink); letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.earn-half__unit { margin-left: 4px; font: 400 13px/18px var(--font-v5); color: var(--v5-ink-3); letter-spacing: 0; }
.earn-half__latest { min-width: 0; }
.earn-half__amount { display: block; font: 500 19px/24px var(--font-metric); color: var(--v5-success-ink); white-space: nowrap; font-variant-numeric: tabular-nums; }
.earn-half__amount--none { color: var(--v5-ink-3); }
.earn-half__who { display: block; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.earn-half__placeholder { width: 80%; height: 14px; border-radius: 8px; background: color-mix(in srgb, var(--v5-ink) 8%, transparent); }

.earn-fleet-head { display: flex; align-items: center; gap: 10px; min-height: 44px; margin: 32px 18px 8px; }
.earn-fleet-head__title { font: var(--ui-type-section-weight) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); color: var(--v5-ink); white-space: nowrap; }
.earn-block { margin-top: 32px; }
.earn-capacity-info { width:44px; height:44px; margin-left:-8px; flex:none; display:grid; place-items:center; color:var(--v5-brand); background:transparent; cursor:pointer; }
/* App renders small SVGs through NxNativeSvg/v-html, so inner nodes need deep selectors. */
.earn-capacity-info :deep(.earn-capacity-info__glyph) { display:block; overflow:visible; }
.earn-capacity-info :deep(.earn-capacity-info__rocket) { animation:earn-rocket-hop 1.6s ease-in-out infinite; }
.earn-capacity-info :deep(.earn-capacity-info__flame) { transform-origin:12px 18.5px; animation:earn-rocket-flame .72s ease-in-out infinite; }
.earn-capacity-info :deep(.earn-capacity-info__exhaust) { animation:earn-rocket-exhaust .9s ease-out infinite; }
.earn-capacity-info.nx-loops-paused :deep(.earn-capacity-info__rocket), .earn-capacity-info.nx-loops-paused :deep(.earn-capacity-info__flame), .earn-capacity-info.nx-loops-paused :deep(.earn-capacity-info__exhaust) { animation-play-state: paused; }
@keyframes earn-rocket-hop { 0%,100% { transform:translateY(1px); } 50% { transform:translateY(-1.5px); } }
@keyframes earn-rocket-flame { 0%,100% { transform:scaleY(.6); opacity:.55; } 50% { transform:scaleY(1.15); opacity:1; } }
@keyframes earn-rocket-exhaust { 0% { transform:translateY(0); opacity:0; } 25% { opacity:.65; } 100% { transform:translateY(2.5px); opacity:0; } }
@media (prefers-reduced-motion:reduce) { .earn-capacity-info :deep(.earn-capacity-info__rocket),.earn-capacity-info :deep(.earn-capacity-info__flame),.earn-capacity-info :deep(.earn-capacity-info__exhaust) { animation:none; }.earn-capacity-info :deep(.earn-capacity-info__exhaust) { opacity:0; } }
.earn-capacity-info:focus-visible { outline:2px solid var(--v5-brand); outline-offset:-2px; border-radius:12px; }
.earn-more-ways :deep(.nx-section__title) { font-size: 20px; line-height: 1.25; }
/* The section heading box adds its own room above the title; 22px matches the board's gap. */
.earn-page > .earn-more-ways { margin-top: 22px; }
/* Short period names stay on one line (vi "Hôm nay" broke at 320). */
.earn-range :deep(.nx-glass-option__label) { white-space: nowrap; overflow-wrap: normal; }
@media (max-width: 374px) {
  .earn-fleet-head, .earn-block { margin-top: 24px; }
  .earn-page > .earn-more-ways { margin-top: 14px; }
  .earn-hero__int { font-size: 46px; }
}
</style>
