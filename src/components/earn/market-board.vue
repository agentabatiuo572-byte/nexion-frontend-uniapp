<!--
  MarketBoard (Earn) — ported from Nexion-prototype/app/components/market-board.tsx.
  v3.1 §6.1 compute-price board. Two sections top→bottom:
    1. AI Workload Price Index (6 workloads · 24h delta · 7-pt sparkline)
    2. Device earnings ranking (5 tiers, phone last → upgrade pull)
  Distinct from home's MarketBoardCard (different data + layout). Static mock
  numbers; workload names/units come from t.market.workloads (shared with Task
  Center + device cards). Model names stay untranslated. Ranking rows with an href
  route to that tier's store detail. Rankings show earnings estimates only.
-->
<template>
  <view class="nx-earn-market-board">
    <view class="earn-market__head">
      <text class="earn-market__title" role="heading" aria-level="2">{{ t.market.title }}</text>
      <view v-if="!remoteApiEnabled || app.homeTruthStatus === 'ready'" class="earn-market__updated"><view class="earn-market__dot" aria-hidden="true" /><text>{{ t.market.liveLabel }}</text></view>
    </view>
    <view class="earn-market__card">
      <!-- Price Index -->
      <view class="earn-price-index" lang="en">
        <text class="earn-market__caption">{{ en.market.priceIndex }}</text>
        <text v-if="!priceIndex.length" class="earn-market__status">{{ app.homeTruthStatus === 'idle' || app.homeTruthStatus === 'loading' ? t.home.networkStatUpdating : t.uiChrome.unavailable }}</text>
        <view v-else class="earn-market__grid">
          <view v-for="w in priceIndex" :key="w.code" class="earn-market__tile">
            <text class="earn-market__name">{{ workloadCopy(w).name }}</text>
            <text class="earn-market__unit">{{ workloadCopy(w).unit }}</text>
            <text class="earn-market__price">{{ w.price === null ? "—" : formatUsd(w.price, 'detail') }}</text>
            <text class="earn-market__delta" :style="{ color: arrowColor(w) }">{{ w.delta === null ? "—" : `${arrow(w)} ${Math.abs(w.delta).toFixed(1)}%` }}</text>
            <text v-if="w.flagshipDelta !== null" class="earn-market__flagship">{{ en.market.flagshipRow }} <text class="earn-market__flagship-delta">{{ signedDelta(w.flagshipDelta) }}</text></text>
            <view v-if="w.spark.length > 1" class="earn-market__spark"><svg data-native-svg class="earn-market-spark" width="100%" height="100%" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><polyline :points="sparkPoints(w.spark)" fill="none" :stroke="arrowColor(w)" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" /></svg></view>
          </view>
        </view>
      </view>

      <!-- Device earnings ranking -->
      <view class="earn-market__rank">
        <text class="earn-market__caption earn-market__caption--plain">{{ t.market.deviceRanking }}</text>
        <text v-if="!deviceRankings.length" class="earn-market__status">{{ app.homeTruthStatus === 'idle' || app.homeTruthStatus === 'loading' ? t.home.networkStatUpdating : t.uiChrome.unavailable }}</text>
        <view
          v-for="d in deviceRankings"
          :key="d.rank"
          class="earn-ranking-row"
          :class="{ 'earn-ranking-row--link': d.kind }"
          :role="d.kind ? 'link' : undefined"
          :tabindex="d.kind ? 0 : undefined"
          @click="d.kind && goDetail(d.kind)"
          @keydown.enter.stop.prevent="d.kind && goDetail(d.kind)"
        >
          <text class="earn-ranking-row__no">#{{ d.rank }}</text>
          <DeviceArt class="earn-ranking-row__art" :src="d.isPhone ? PHONE_ART : d.kind ? getProductMedia(d.kind)?.src ?? null : null" />
          <view class="earn-ranking-row__identity"><text class="earn-ranking-row__name">{{ d.name ?? t.market.yourPhone }}</text></view>
          <view class="earn-ranking-value">
            <text class="earn-ranking-value__amount">{{ d.dailyEarn === null ? "—" : `$${formatAmount(d.dailyEarn)}${t.coreReview.perDay}` }}</text>
            <view class="earn-ranking-value__track" aria-hidden="true"><view v-viz-inview class="earn-ranking-value__fill nx-viz-grow" :style="{ width: `${rankShare(d)}%` }" /></view>
          </view>
        </view>
      </view>

    </view>
  </view>
</template>

<script setup lang="ts">
import { formatAmount } from "@/lib/amount-display";
import { formatUsd } from "@/lib/usd-display";
import { navTo } from "@/lib/route";
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import type { DeviceKind, TaskCategory } from "@/store/types";
import { useApp } from "@/store/app";
import { remoteApiEnabled } from "@/api/runtime";
import { compactMarketUnit, marketWorkloadCopy } from "@/lib/workload-label";
import { en } from "@/i18n/messages/en";
import { getProductMedia } from "@/lib/product-media";
import DeviceArt from "@/components/device-art.vue";

const PHONE_ART = "/static/img/home-glass-20260928/phone.webp";

interface WorkloadPrice {
  code: TaskCategory;
  name: string | null;
  unit: string | null;
  price: number | null;
  delta: number | null;
  spark: number[];
  flagshipDelta: number | null;
}

interface DeviceRanking {
  rank: number;
  /** 商品品牌名(不翻译);手机档没有商品名,走 t.market.yourPhone。 */
  name?: string;
  dailyEarn: number | null;
  isPhone?: boolean;
  kind?: Exclude<DeviceKind, "phone">;
}

const t = useT();
const app = useApp();

// Label + unit come from t.market.workloads[code] — the same key set the Task
// Center job rows and device cards read, so a workload is named identically
// everywhere. Only the numbers live here (flagship 行的文案走 t.market.flagshipRow)。
const PRICE_INDEX: WorkloadPrice[] = [
  { code: "IG", name: null, unit: null, price: 0.003, delta: 4.2, spark: [0.4, 0.5, 0.42, 0.55, 0.6, 0.7, 0.72], flagshipDelta: null },
  { code: "LL", name: null, unit: null, price: 0.0024, delta: 18.7, spark: [0.3, 0.35, 0.4, 0.42, 0.6, 0.78, 0.88], flagshipDelta: 32.1 },
  { code: "VG", name: null, unit: null, price: 0.18, delta: -1.2, spark: [0.65, 0.7, 0.6, 0.55, 0.62, 0.58, 0.62], flagshipDelta: null },
  { code: "FT", name: null, unit: null, price: 0.06, delta: 0.0, spark: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], flagshipDelta: null },
  { code: "EM", name: null, unit: null, price: 0.0008, delta: 2.1, spark: [0.4, 0.45, 0.4, 0.5, 0.52, 0.55, 0.57], flagshipDelta: null },
  { code: "SP", name: null, unit: null, price: 0.0003, delta: 0.3, spark: [0.5, 0.48, 0.5, 0.52, 0.5, 0.51, 0.52], flagshipDelta: null },
];

const DEVICE_RANKINGS: DeviceRanking[] = [
  { rank: 1, name: "UVELRack P1", dailyEarn: 45, kind: "stellarrack-p1" },
  { rank: 2, name: "UVELBox Pro", dailyEarn: 13, kind: "stellarbox-pro" },
  { rank: 3, name: "UVELBox S1", dailyEarn: 7, kind: "stellarbox-s1" },
  { rank: 4, dailyEarn: 0.06, isPhone: true },
];

const priceIndex = computed<WorkloadPrice[]>(() => remoteApiEnabled
  ? (app.homeTruth?.marketBoard.workloads ?? []).map((row) => ({ code: row.code, name: row.name, unit: row.unit, price: row.price, delta: row.deltaPct, spark: row.sparkline ?? [], flagshipDelta: row.flagshipDeltaPct }))
  : PRICE_INDEX);
const workloadCopy = (row: WorkloadPrice) => {
  const copy = marketWorkloadCopy(en, row.code, row.name, row.unit);
  return { name: copy.name, unit: compactMarketUnit(row.code, copy.unit) };
};
const deviceRankings = computed<DeviceRanking[]>(() => remoteApiEnabled
  ? (app.homeTruth?.marketBoard.deviceRankings ?? []).filter((row) => row.kind !== "cloud-share").map((row) => ({ rank: row.rank, name: row.name ? (row.name) : undefined, dailyEarn: row.dailyUsdt, kind: row.kind && row.kind !== "phone" ? row.kind : undefined, isPhone: row.kind === "phone" }))
  : DEVICE_RANKINGS);

function arrow(w: WorkloadPrice): string {
  return w.delta !== null && w.delta > 0.05 ? "↑" : w.delta !== null && w.delta < -0.05 ? "↓" : "→";
}
function arrowColor(w: WorkloadPrice): string {
  return w.delta !== null && w.delta > 0.05 ? "var(--v5-success-ink)" : w.delta !== null && w.delta < -0.05 ? "var(--v5-danger)" : "var(--v5-ink-4)";
}
// Same thresholds as the workload delta: ↑ rising, ↓ falling, no arrow when flat.
function signedDelta(delta: number): string {
  const sign = delta > 0.05 ? "↑" : delta < -0.05 ? "↓" : "";
  return `${sign}${Math.abs(delta).toFixed(1)}%`;
}
// Bars scale to the best tier; a non-zero tier always keeps a visible sliver.
const rankMax = computed(() => Math.max(0, ...deviceRankings.value.map((row) => row.dailyEarn ?? 0)));
function rankShare(row: DeviceRanking): number {
  return row.dailyEarn && rankMax.value > 0 ? Math.max(3, row.dailyEarn / rankMax.value * 100) : 0;
}
// 7-point line in a 100×24 box, 3px top/bottom inset.
function sparkPoints(data: number[]): string {
  const w = 100;
  const h = 24;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  return data
    .map((v, i) => `${(i * stepX).toFixed(2)},${(h - 3 - ((v - min) / range) * (h - 6)).toFixed(2)}`)
    .join(" ");
}

function goDetail(kind: Exclude<DeviceKind, "phone">) {
  navTo(`/pages/store/detail?id=${kind}`);
}

</script>
<style scoped>
.nx-earn-market-board { margin: 0 16px; color: var(--v5-ink); }
.earn-market__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; margin: 0 2px 8px; }
.earn-market__title { font: 600 17px/24px var(--font-v5); color: var(--v5-ink); }
.earn-market__updated { display: inline-flex; align-items: center; gap: 6px; font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.earn-market__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--v5-success); }
.earn-market__card { padding: 14px 14px 6px; border-radius: 22px; background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .earn-market__card { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
/* The board's caption line box sits 4.5px lower than its 14px line height. */
.earn-market__caption { display: block; padding-top: 4.5px; font: 500 11px/14px var(--font-v5); letter-spacing: .04em; text-transform: uppercase; color: var(--v5-ink-3); }
.earn-market__caption--plain { letter-spacing: 0; text-transform: none; }
.earn-market__status { display: block; padding: 10px 0; font: 400 12px/18px var(--font-v5); color: var(--v5-ink-3); }
.earn-market__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.earn-market__tile { display: flex; flex-direction: column; min-width: 0; padding: 10px 10px 8px; border-radius: 14px; background: var(--v5-surface-2); }
[data-theme="light"] .earn-market__tile { background: var(--v5-bg); }
.earn-market__name { font: 500 11px/14px var(--font-v5); color: var(--v5-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.earn-market__unit { font: 400 11px/14px var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.earn-market__price { margin-top: 8px; font: 500 15px/20px var(--font-metric); color: var(--v5-ink); white-space: nowrap; font-variant-numeric: tabular-nums; }
.earn-market__delta { font: 500 11px/14px var(--font-metric); white-space: nowrap; font-variant-numeric: tabular-nums; }
.earn-market__flagship { margin-top: 2px; font: 500 11px/14px var(--font-v5); color: var(--v5-warning-ink); overflow-wrap: anywhere; }
.earn-market__flagship-delta { font: 500 11px/14px var(--font-metric); font-variant-numeric: tabular-nums; white-space: nowrap; }
/* Sparklines sit on the tile floor so a taller tile (flagship line) keeps them aligned. The App draws the SVG
   through NxNativeSvg (v-html), so the SVG's own style reaches it through :deep() on this real wrapper. */
.earn-market__spark { height: 22px; margin-top: auto; padding-top: 6px; box-sizing: content-box; line-height: 0; }
.earn-market__spark :deep(.earn-market-spark) { display: block; width: 100%; height: 100%; overflow: visible; }
.earn-market__rank { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--v5-border); }
.earn-ranking-row { display: grid; grid-template-columns: 22px 28px minmax(0, 1fr) 96px; align-items: center; gap: 8px; min-height: 44px; }
.earn-ranking-row--link { cursor: pointer; }
.earn-ranking-row--link:active { opacity: .7; }
.earn-ranking-row--link:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.earn-ranking-row__no { font: 500 12px/16px var(--font-metric); color: var(--v5-ink-3); }
.earn-ranking-row__art { width: 28px; height: 24px; }
.earn-ranking-row__identity { display: flex; flex-direction: column; min-width: 0; }
.earn-ranking-row__name { min-width: 0; font: 500 13px/18px var(--font-v5); color: var(--v5-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.earn-ranking-value { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; min-width: 0; }
.earn-ranking-value__amount { font: 500 12px/16px var(--font-metric); color: var(--v5-warning-ink); white-space: nowrap; font-variant-numeric: tabular-nums; }
.earn-ranking-value__track { position: relative; width: 96px; height: 3px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.earn-ranking-value__fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: inherit; background: color-mix(in srgb, var(--v5-tech-cyan) 60%, transparent); }
@media (max-width: 374px) {
  .earn-market__tile { padding: 10px 8px 8px; }
  .earn-market__price { font-size: 13px; line-height: 18px; }
}
@media (max-width: 350px) {
  .earn-ranking-row { grid-template-columns: 22px 28px minmax(0, 1fr) 84px; }
  .earn-ranking-value__track { width: 84px; }
}
</style>
