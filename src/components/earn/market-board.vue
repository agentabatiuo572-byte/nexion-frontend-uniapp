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
        <!-- Empty (a read that succeeded with no workloads) is one short line; loading and a failed first read keep three
             still placeholder tiles with no status text, and the failed read recovers on its own (03 §3.4, §3.5.2). -->
        <text v-if="!priceIndex.length && marketState === 'empty'" class="earn-market__status">{{ t.empty.listTitle }}</text>
        <view v-else-if="!priceIndex.length" class="earn-market__grid" aria-hidden="true" :aria-busy="marketState === 'loading' ? 'true' : undefined" data-earn-market-placeholder="true">
          <view v-for="n in 3" :key="n" class="earn-market__tile earn-market__tile--placeholder"><view class="earn-market__face earn-market__face--on">
            <view class="earn-market__bar" style="width: 70%; margin-block: 3px" />
            <view class="earn-market__bar" style="width: 40%; margin-block: 3px" />
            <view class="earn-market__bar earn-market__bar--price" />
            <view class="earn-market__bar" style="width: 36%; margin-block: 3px" />
            <view class="earn-market__spark" />
          </view></view>
        </view>
        <!-- Three fixed tiles. With more than three workloads, tile i owns workloads i, i+3, … and every
             ROTATE_MS all three tiles switch to their next one at once, like a quote screen. Screen readers
             get the full list once; the rotating faces are hidden from them. -->
        <view v-else ref="rotationRef" class="earn-market__board" role="group" :aria-label="en.market.priceIndex">
          <view class="nx-sr-only" role="list"><text v-for="w in priceIndex" :key="w.code" role="listitem">{{ spokenWorkload(w) }}</text></view>
          <view class="earn-market__grid" aria-hidden="true">
          <view v-for="(slot, i) in slots" :key="i" class="earn-market__tile">
          <view v-for="(w, k) in slot" :key="w.code" class="earn-market__face" :class="{ 'earn-market__face--on': k === step % slot.length }">
            <text class="earn-market__name">{{ workloadCopy(w).name }}</text>
            <text class="earn-market__unit">{{ workloadCopy(w).unit }}</text>
            <text class="earn-market__price">{{ w.price === null ? "—" : formatUsd(w.price, 'detail') }}</text>
            <text class="earn-market__delta" :class="w.delta === null ? undefined : arrow(w)" :style="{ color: arrowColor(w) }"><text v-if="w.delta !== null && shownDelta(w.delta) !== 0" class="nx-sr-only">{{ w.delta > 0 ? "+" : "−" }}</text>{{ w.delta === null ? "—" : `${Math.abs(shownDelta(w.delta)).toFixed(1)}%` }}</text>
            <text v-if="w.flagshipDelta !== null" class="earn-market__flagship">{{ en.market.flagshipRow }} <text class="earn-market__flagship-delta" :class="trendClass(w.flagshipDelta)"><text v-if="trendClass(w.flagshipDelta)" class="nx-sr-only">{{ w.flagshipDelta > 0 ? "+" : "−" }}</text>{{ Math.abs(shownDelta(w.flagshipDelta)).toFixed(1) }}%</text></text>
            <view v-if="w.spark.length > 1" class="earn-market__spark"><svg data-native-svg class="earn-market-spark" width="100%" height="100%" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><polyline :points="sparkPoints(w.spark)" fill="none" :stroke="arrowColor(w)" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" /></svg></view>
          </view>
          </view>
          </view>
        </view>
      </view>

      <!-- Device earnings ranking -->
      <view class="earn-market__rank">
        <text class="earn-market__caption earn-market__caption--plain">{{ t.market.deviceRanking }}</text>
        <text v-if="!deviceRankings.length && marketState === 'empty'" class="earn-market__status">{{ t.empty.listTitle }}</text>
        <view v-else-if="!deviceRankings.length" aria-hidden="true" :aria-busy="marketState === 'loading' ? 'true' : undefined" data-earn-ranking-placeholder="true">
          <view v-for="n in 3" :key="n" class="earn-ranking-row earn-ranking-row--placeholder">
            <view class="earn-market__bar" style="width: 18px" />
            <view class="earn-market__bar earn-market__bar--art" />
            <view class="earn-market__bar" style="width: 64%" />
            <view class="earn-ranking-value"><view class="earn-market__bar" style="width: 56px" /><view class="earn-ranking-value__track nx-progress" /></view>
          </view>
        </view>
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
          <DeviceArt class="earn-ranking-row__art" :src="d.isPhone ? PHONE_ART : d.imageUrl" />
          <view class="earn-ranking-row__identity"><text class="earn-ranking-row__name">{{ d.name ?? t.market.yourPhone }}</text></view>
          <view class="earn-ranking-value">
            <text class="earn-ranking-value__amount">{{ d.dailyEarn === null ? "—" : `$${formatAmount(d.dailyEarn)}${t.coreReview.perDay}` }}</text>
            <!-- Decorative (the amount is read); aria-valuenow is the shared bar's state hook: no fill when unknown, no head dot at 0. -->
            <view class="earn-ranking-value__track nx-progress" aria-hidden="true" :aria-valuenow="d.dailyEarn === null ? undefined : Math.round(rankShare(d))"><view v-viz-inview class="nx-progress__fill nx-viz-grow" :style="{ width: `${rankShare(d)}%` }" /></view>
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
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useT } from "@/i18n/use-t";
import type { DeviceKind, TaskCategory } from "@/store/types";
import { useApp } from "@/store/app";
import { remoteApiEnabled } from "@/api/runtime";
import { compactMarketUnit, marketWorkloadCopy } from "@/lib/workload-label";
import { en } from "@/i18n/messages/en";
import { getProductMedia } from "@/lib/product-media";
import DeviceArt from "@/components/device-art.vue";
import { useLoopsInView } from "@/composables/use-loops-in-view";
import { marketBoardRotation } from "./market-board-rotation";

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
  imageUrl?: string;
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

// Which of the three non-content states the board is in when a section has no rows (03 §3.4).
const marketState = computed(() => !remoteApiEnabled || app.homeTruthStatus === "ready" ? "empty" : app.homeTruthStatus === "error" ? "failed" : "loading");
const priceIndex = computed<WorkloadPrice[]>(() => remoteApiEnabled
  ? (app.homeTruth?.marketBoard.workloads ?? []).map((row) => ({ code: row.code, name: row.name, unit: row.unit, price: row.price, delta: row.deltaPct, spark: row.sparkline ?? [], flagshipDelta: row.flagshipDeltaPct }))
  : PRICE_INDEX);
// Tile i shows workloads i, i+3, …; one shared step advances every tile. Faces are keyed by code, so a new
// summary read patches the numbers in place and the rotation keeps its position.
const ROTATE_MS = 6000;
const slots = computed(() => [0, 1, 2].map((i) => priceIndex.value.filter((_, j) => j % 3 === i)).filter((slot) => slot.length));
const rotating = computed(() => priceIndex.value.length > 3);
// The position survives a remount of the page, so the board continues where it was when it comes back.
const step = ref(marketBoardRotation.step);
watch(step, (value) => { marketBoardRotation.step = value; });
const { elRef: rotationRef, running: inView } = useLoopsInView(".earn-market__board");
// The board always rotates while the user can see it; it stops only off screen or on a hidden page (also the App in
// the background). Touch, focus, scrolling and reduced motion don't stop it: a swap is a plain text change.
const rotationActive = computed(() => rotating.value && inView.value);
// Every resume waits a full period before the next swap.
let rotationTimer: ReturnType<typeof setInterval> | undefined;
watch(rotationActive, (active) => {
  clearInterval(rotationTimer);
  rotationTimer = active ? setInterval(() => { step.value += 1; }, ROTATE_MS) : undefined;
}, { immediate: true });
onBeforeUnmount(() => clearInterval(rotationTimer));
const workloadCopy = (row: WorkloadPrice) => {
  const copy = marketWorkloadCopy(en, row.code, row.name, row.unit);
  return { name: copy.name, unit: compactMarketUnit(row.code, copy.unit) };
};
const deviceRankings = computed<DeviceRanking[]>(() => remoteApiEnabled
  ? (app.homeTruth?.marketBoard.deviceRankings ?? []).filter((row) => row.kind !== "cloud-share").map((row) => ({ rank: row.rank, name: row.name ? (row.name) : undefined, dailyEarn: row.dailyUsdt, imageUrl: row.imageUrl, kind: row.kind && row.kind !== "phone" ? row.kind : undefined, isPhone: row.kind === "phone" }))
  : DEVICE_RANKINGS.map(row => ({ ...row, imageUrl: getProductMedia(row.kind)?.src })));

function spokenWorkload(w: WorkloadPrice): string {
  const copy = workloadCopy(w);
  const signed = (delta: number) => `${shownDelta(delta) > 0 ? "+" : shownDelta(delta) < 0 ? "−" : ""}${Math.abs(shownDelta(delta)).toFixed(1)}%`;
  const delta = w.delta === null ? "—" : signed(w.delta);
  const flagship = w.flagshipDelta === null ? "" : `, ${en.market.flagshipRow} ${signed(w.flagshipDelta)}`;
  return `${copy.name} ${copy.unit}: ${w.price === null ? "—" : formatUsd(w.price, "detail")}, ${delta}${flagship}`;
}
// The direction follows the shown one-decimal value: a change that rounds to 0.0 is flat, anything else keeps its sign
// (−0.04 → 0.0%, ±0.05 → ±0.1%), as on the home market table.
function shownDelta(delta: number): number {
  return Number(delta.toFixed(1));
}
function arrow(w: WorkloadPrice): string {
  return w.delta !== null && shownDelta(w.delta) > 0 ? "nx-before-arrow-up" : w.delta !== null && shownDelta(w.delta) < 0 ? "nx-before-arrow-down" : "nx-before-arrow-right";
}
function arrowColor(w: WorkloadPrice): string {
  return w.delta !== null && shownDelta(w.delta) > 0 ? "var(--v5-success-ink)" : w.delta !== null && shownDelta(w.delta) < 0 ? "var(--v5-danger)" : "var(--v5-ink-3)";
}
// Same rule as the workload delta: up arrow rising, down arrow falling, no arrow when it shows 0.0.
function trendClass(delta: number): string | undefined {
  return shownDelta(delta) > 0 ? "nx-before-arrow-up" : shownDelta(delta) < 0 ? "nx-before-arrow-down" : undefined;
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
.earn-market__title { font: var(--ui-type-section-weight) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); color: var(--v5-ink); }
.earn-market__updated { display: inline-flex; align-items: center; gap: 6px; font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.earn-market__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--v5-success); }
.earn-market__card { padding: 14px; border-radius: 22px; background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .earn-market__card { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
/* The board's caption line box sits 4.5px lower than its 14px line height. */
.earn-market__caption { display: block; padding-top: 4.5px; font: 500 11px/14px var(--font-v5); letter-spacing: .04em; text-transform: uppercase; color: var(--v5-ink-3); }
.earn-market__caption--plain { letter-spacing: 0; text-transform: none; }
.earn-market__status { display: block; padding: 10px 0; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
.earn-market__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
/* Every face of a tile shares one grid cell, so the tile keeps the tallest face's height. A swap shows the next face
   at once on all three tiles, like a quote board's tick: no fade, never a blank or half-transparent tile. */
/* An info block inside the card: 12px radius (01 §1.3). */
.earn-market__tile { display: grid; min-width: 0; padding: 10px 10px 8px; border-radius: 12px; background: var(--v5-surface-2); }
.earn-market__face { grid-area: 1 / 1; display: flex; flex-direction: column; min-width: 0; visibility: hidden; }
.earn-market__face--on { visibility: visible; }
[data-theme="light"] .earn-market__tile { background: var(--v5-bg); }
.earn-market__name { font: 500 11px/14px var(--font-v5); color: var(--v5-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.earn-market__unit { font: 400 11px/14px var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* Market list price: list-title size and line height, JetBrains Mono 500 (10.1, 01 §1.2). */
.earn-market__price { margin-top: 8px; font: 500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-metric); color: var(--v5-ink); white-space: nowrap; font-variant-numeric: tabular-nums; }
.earn-market__delta { font: 500 11px/14px var(--font-metric); white-space: nowrap; font-variant-numeric: tabular-nums; }
.earn-market__flagship { margin-top: 2px; font: 500 11px/14px var(--font-v5); color: var(--v5-warning-ink); overflow-wrap: break-word; }
.earn-market__flagship-delta { font: 500 11px/14px var(--font-metric); font-variant-numeric: tabular-nums; white-space: nowrap; }
/* Sparklines sit on the tile floor so a taller tile (flagship line) keeps them aligned. The App draws the SVG
   through NxNativeSvg (v-html), so the SVG's own style reaches it through :deep() on this real wrapper. */
.earn-market__spark { height: 22px; margin-top: auto; padding-top: 6px; box-sizing: content-box; line-height: 0; }
.earn-market__spark :deep(.earn-market-spark) { display: block; width: 100%; height: 100%; overflow: visible; }
.earn-market__rank { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--v5-border); }
.earn-ranking-row { display: grid; grid-template-columns: 22px 48px minmax(0, 1fr) 96px; align-items: center; gap: 8px; min-height: 48px; }
.earn-ranking-row--link { cursor: pointer; }
.earn-ranking-row--link:active { opacity: .7; }
.earn-ranking-row--link:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.earn-ranking-row__no { font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-metric); color: var(--v5-ink-3); }
/* The catalog art leaves about 40% empty around the machine: the square image is drawn larger than its 48×40 cell and
   its transparent margins overlap the row gaps, so the machine itself reads at about 34px. */
.earn-ranking-row__art { position: relative; width: 48px; height: 40px; }
.earn-ranking-row__art :deep(.device-art__image) { position: absolute; left: 50%; top: 50%; width: 60px; height: 60px; transform: translate(-50%, -50%); pointer-events: none; }
.earn-ranking-row__identity { display: flex; flex-direction: column; min-width: 0; }
/* A long name (the phone row in kk, ru…) wraps in full instead of being cut (03 §3.6.1); the row grows with it. */
.earn-ranking-row__name { min-width: 0; font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: break-word; }
.earn-ranking-value { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; min-width: 0; }
/* A plain estimate in the main ink: amber is the business hue for icons and graphics, not for amount text (01 §1.1.1, §1.1.2). */
.earn-ranking-value__amount { font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-metric); color: var(--v5-ink); white-space: nowrap; font-variant-numeric: tabular-nums; }
/* The bar is the shared thin progress (.nx-progress in tokens.css); the ranking only sets its width and the device hue. */
.earn-ranking-value__track { width: 96px; --nx-progress-hue: var(--v5-tech-cyan); }
/* Still placeholders (no shimmer) in the shape of the tiles and rows they stand for. */
.earn-market__bar { height: 8px; border-radius: 999px; background: color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.earn-market__bar--price { width: 62%; height: 14px; margin-top: 11px; margin-bottom: 3px; }
.earn-market__bar--art { width: 34px; height: 28px; border-radius: 8px; justify-self: center; }
.earn-ranking-row--placeholder .earn-ranking-value { gap: 8px; }
@media (max-width: 374px) {
  .earn-market__tile { padding: 10px 8px 8px; }
}
@media (max-width: 374px) {
  .earn-ranking-row { grid-template-columns: 22px 40px minmax(0, 1fr) 88px; }
  .earn-ranking-row__art { width: 40px; height: 36px; }
  .earn-ranking-row__art :deep(.device-art__image) { width: 52px; height: 52px; }
  .earn-ranking-value__track { width: 88px; }
}
@media (max-width: 350px) {
  .earn-ranking-row { grid-template-columns: 22px 40px minmax(0, 1fr) 84px; }
  .earn-ranking-value__track { width: 84px; }
}
</style>
