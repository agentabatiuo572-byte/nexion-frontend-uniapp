<!--
  MarketBoardCard — homepage compute-price board. One row per model type with
  a live micro-ticker for price movement; rows route users to Earn for work.
-->
<template>
  <view class="market-board" :class="{ 'market-board--dark': theme.mode === 'dark' }">
    <view class="market-board__header">
      <view class="market-board__title-wrap">
        <text class="market-board__title">{{ t.home.marketBoardTitle }}</text>
        <text class="market-board__subtitle">{{ t.home.marketBoardPrices }}</text>
      </view>
      <view class="market-board__open" @click="goMarket">
        <text>{{ t.home.marketBoardOpen }}</text>
        <ChevronRightIcon />
      </view>
    </view>

    <view class="market-board__card">
      <view class="market-board__head market-board__grid">
        <text class="market-board__head-cell">{{ t.home.mbColTag }}</text>
        <text class="market-board__head-cell">{{ t.home.mbColModel }}</text>
        <text class="market-board__head-cell">{{ t.home.mbCol1h }}</text>
        <text class="market-board__head-cell">{{ t.home.mbColPrice }}</text>
        <text class="market-board__head-cell market-board__head-cell--change">{{ t.home.mbCol24h }}</text>
      </view>

      <view
        v-for="(r, i) in UNIQUE_ROWS"
        :key="r.name"
        class="market-board__row market-board__grid"
        :class="{ 'market-board__row--last': i === UNIQUE_ROWS.length - 1 }"
        @click="goEarn"
      >
        <view class="market-board__type-icon" :aria-label="r.tag">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" :stroke-width="iconStroke(r.tag)" stroke-linecap="round" stroke-linejoin="round">
            <path v-for="d in iconPaths(r.tag)" :key="d" :d="d" />
          </svg>
        </view>

        <view class="market-board__model">
          <text class="market-board__model-name">{{ r.name }}</text>
          <text class="market-board__vol">{{ volText(r) }}</text>
        </view>

        <view class="market-board__spark">
          <svg class="market-board__spark-svg market-board__spark-svg--default" viewBox="0 0 100 32" preserveAspectRatio="none">
            <polygon :points="areaPoints(r.spark, 32)" :fill="rowColor(r)" opacity="0.10" />
            <polyline :points="linePoints(r.spark, 32)" fill="none" :stroke="rowColor(r)" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" />
            <circle :cx="lastPoint(r.spark, 32).x" :cy="lastPoint(r.spark, 32).y" r="1.6" :fill="rowColor(r)" />
          </svg>
          <svg class="market-board__spark-svg market-board__spark-svg--small" viewBox="0 0 100 28" preserveAspectRatio="none">
            <polygon :points="areaPoints(r.spark, 28)" :fill="rowColor(r)" opacity="0.10" />
            <polyline :points="linePoints(r.spark, 28)" fill="none" :stroke="rowColor(r)" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" />
            <circle :cx="lastPoint(r.spark, 28).x" :cy="lastPoint(r.spark, 28).y" r="1.6" :fill="rowColor(r)" />
          </svg>
        </view>

        <view class="market-board__price">
          <text class="market-board__price-value">{{ fmtPrice(livePrice(r, i)) }}</text>
          <text class="market-board__price-unit">{{ r.unit }}</text>
        </view>

        <text class="market-board__change" :class="{ 'market-board__change--down': r.d < 0 }">{{ changeText(r) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useT } from "@/i18n/use-t";
import { useTicker } from "@/composables/use-ticker";
import { useTheme } from "@/store/theme";
import ChevronRightIcon from "@/components/icons/chevron-right-icon.vue";

interface MbRow {
  tag: "IMG" | "LLM" | "STT" | "EMB";
  name: string;
  unit: string;
  base: number;
  d: number;
  vol: string;
  spark: number[];
}

const t = useT();
const theme = useTheme();
const tick = useTicker(0, 1, 1600);

const ROWS: MbRow[] = [
  { tag: "IMG", name: "SDXL Turbo", unit: "image", base: 0.00032, d: 3.2, vol: "142k", spark: [3.0, 3.1, 3.0, 3.15, 3.2, 3.18, 3.22, 3.2] },
  { tag: "LLM", name: "Llama 70B", unit: "job", base: 0.247, d: -1.1, vol: "8.2k", spark: [25.0, 25.4, 25.1, 24.7, 24.6, 24.8, 24.7, 24.7] },
  { tag: "STT", name: "Whisper", unit: "60s", base: 0.00009, d: -0.4, vol: "3.1M", spark: [9.1, 9.0, 9.05, 9.0, 9.05, 9.0, 9.0, 9.0] },
  { tag: "EMB", name: "Embedding", unit: "chunk", base: 0.00007, d: 0.8, vol: "912k", spark: [6.9, 7.0, 7.0, 7.0, 7.05, 7.0, 7.0, 7.0] },
  { tag: "IMG", name: "Flux Schnell", unit: "image", base: 0.00048, d: 2.4, vol: "21k", spark: [4.6, 4.7, 4.7, 4.75, 4.8, 4.78, 4.8, 4.8] },
  { tag: "LLM", name: "Phi-3 mini", unit: "500 tok", base: 0.00021, d: 0.5, vol: "512k", spark: [2.05, 2.08, 2.1, 2.09, 2.1, 2.1, 2.1, 2.1] },
];

const UNIQUE_ROWS = ROWS.filter(
  (row, index, rows) => rows.findIndex((candidate) => candidate.tag === row.tag) === index,
);

const ICONS: Record<MbRow["tag"], string[]> = {
  IMG: [
    "M6.5 8a2 2 0 1 0 4 0a2 2 0 0 0-4 0m14.427 1.99c-6.61-.908-12.31 4-11.927 10.51",
    "M3 13.066c2.78-.385 5.275.958 6.624 3.1",
    "M3 9.4c0-2.24 0-3.36.436-4.216a4 4 0 0 1 1.748-1.748C6.04 3 7.16 3 9.4 3h5.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v5.2c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C17.96 21 16.84 21 14.6 21H9.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C3 17.96 3 16.84 3 14.6z",
  ],
  LLM: ["M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719", "M8 12h.01", "M12 12h.01", "M16 12h.01"],
  STT: [
    "M11.5 6C7.022 6 4.782 6 3.391 7.172S2 10.229 2 14s0 5.657 1.391 6.828S7.021 22 11.5 22c4.478 0 6.718 0 8.109-1.172S21 17.771 21 14c0-1.17 0-2.158-.041-3",
    "m18.5 2 .258.697c.338.914.507 1.371.84 1.704.334.334.791.503 1.705.841L22 5.5l-.697.258c-.914.338-1.371.507-1.704.84-.334.334-.503.791-.841 1.705L18.5 9l-.258-.697c-.338-.914-.507-1.371-.84-1.704-.334-.334-.791-.503-1.705-.841L15 5.5l.697-.258c.914-.338 1.371-.507 1.704-.84.334-.334.503-.791.841-1.705z",
    "M12 10v8m-3-6v4m-3-3v2m9-3v4m3-3v2",
  ],
  EMB: [
    "m13.11 7.664 1.78 2.672",
    "m14.162 12.788-3.324 1.424",
    "M20 4 13.94 5.515",
    "M3 3v16a2 2 0 0 0 2 2h16",
    "M12 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
    "M16 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
    "M9 15m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
  ],
};

function iconPaths(tag: MbRow["tag"]) {
  return ICONS[tag];
}

function iconStroke(tag: MbRow["tag"]) {
  if (tag === "LLM") return 2.25;
  return tag === "IMG" || tag === "STT" ? 1.5 : 2;
}

function rowColor(r: MbRow) {
  return r.d >= 0 ? "var(--v5-success)" : "#C26658";
}

function livePrice(r: MbRow, i: number) {
  return r.base * (1 + Math.sin((tick.value + i * 7) * 0.5) * 0.012);
}

function fmtPrice(n: number) {
  return `$${n.toFixed(6)}`;
}

function volText(r: MbRow) {
  return `${r.vol}/h`;
}

function changeText(r: MbRow) {
  return `${r.d >= 0 ? "+" : ""}${r.d.toFixed(1)}%`;
}

function sparkPoints(data: number[], height: number) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return data.map((v, i) => {
    const x = i * (100 / (data.length - 1));
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return { x: x.toFixed(2), y: y.toFixed(2) };
  });
}

function linePoints(data: number[], height: number) {
  return sparkPoints(data, height).map((p) => `${p.x},${p.y}`).join(" ");
}

function areaPoints(data: number[], height: number) {
  return `0,${height} ${linePoints(data, height)} 100,${height}`;
}

function lastPoint(data: number[], height: number) {
  const pts = sparkPoints(data, height);
  return pts[pts.length - 1];
}

function goMarket() {
  uni.navigateTo({ url: "/pages/market/market", fail: () => {} });
}

function goEarn() {
  uni.navigateTo({ url: "/pages/earn/earn", fail: () => {} });
}
</script>

<style scoped>
.market-board__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 2px 16px;
}

.market-board__title-wrap {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.market-board__title {
  font-family: var(--font-v5);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--v5-ink);
}

.market-board__subtitle {
  font-size: 11.5px;
  font-weight: 400;
  color: var(--v5-ink-3);
}

.market-board__open {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--v5-brand);
}

.market-board__open:active {
  opacity: 0.7;
}

.market-board__card {
  overflow: hidden;
  border-radius: 16px;
  background: var(--v5-surface-bg);
}

.market-board__grid {
  display: grid;
  grid-template-columns: 40px minmax(0, 48px) 44px minmax(70px, 1fr) 44px;
  column-gap: 12px;
  align-items: center;
}

.market-board__head {
  padding: 9px 12px;
  border-bottom: 1px solid var(--v5-border);
  background: var(--v5-surface-2);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--v5-ink-3);
  text-align: left;
}

.market-board__head-cell {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.market-board__head-cell--change {
  justify-self: start;
  text-align: left;
}

.market-board--dark .market-board__head {
  background: #1B1F24;
  color: var(--v5-ink-4);
}

.market-board__row {
  box-sizing: border-box;
  height: 53px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--v5-border);
}

.market-board__row--last {
  border-bottom: 0;
}

.market-board__row:active {
  opacity: 0.9;
}

.market-board__type-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--v5-brand-soft);
  color: var(--v5-brand);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--v5-brand) 14%, transparent);
}

.market-board__type-icon svg {
  width: 20px;
  height: 20px;
}

.market-board__model {
  min-width: 0;
  max-width: none;
  overflow: hidden;
}

.market-board__model-name {
  display: block;
  overflow: hidden;
  font-family: var(--font-v5);
  font-size: 13.5px;
  font-weight: 500;
  line-height: 18px;
  letter-spacing: -0.008em;
  color: var(--v5-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.market-board__vol {
  display: block;
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 15px;
  color: var(--v5-ink-4);
}

.market-board__spark {
  width: 44px;
  height: 32px;
}

.market-board__spark-svg {
  display: block;
  width: 44px;
  height: 32px;
  overflow: visible;
}

.market-board__spark-svg--small {
  display: none;
}

.market-board__price {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  overflow: hidden;
  height: 36px;
}

.market-board__price-value {
  display: block;
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  color: var(--v5-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.market-board__price-unit {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 10.5px;
  line-height: 12px;
  color: var(--v5-ink-4);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.market-board__change {
  justify-self: start;
  min-width: 0;
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  line-height: 14px;
  font-variant-numeric: tabular-nums;
  color: var(--v5-success);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.market-board__change--down {
  color: #C26658;
}

@media (max-width: 390px) {
  .market-board__grid {
    grid-template-columns: 36px minmax(0, 52px) 42px minmax(66px, 1fr) 42px;
    column-gap: 12px;
  }

  .market-board__row {
    height: 51px;
    padding: 8px 10px;
  }

  .market-board__type-icon {
    width: 34px;
    height: 34px;
  }

  .market-board__type-icon svg {
    width: 19px;
    height: 19px;
  }

  .market-board__model-name {
    font-size: 13px;
    line-height: 17px;
  }

  .market-board__spark,
  .market-board__spark-svg {
    width: 42px;
    height: 28px;
  }

  .market-board__spark-svg--default {
    display: none;
  }

  .market-board__spark-svg--small {
    display: block;
  }

  .market-board__price-value {
    font-size: 12px;
    line-height: 15px;
  }

  .market-board__price {
    height: 34px;
  }

  .market-board__price-unit {
    line-height: 11px;
  }

  .market-board__change {
    font-size: 10.5px;
    line-height: 12px;
  }
}
</style>
