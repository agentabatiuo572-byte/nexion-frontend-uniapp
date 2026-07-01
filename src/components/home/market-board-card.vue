<!--
  MarketBoardCard — ZONE 6 compute-price board (ported from mission-control.tsx
  MarketBoardCard). Header + column row + 6 mock market rows (tag · model · vol ·
  sparkline · live price/unit · 24h). Price wiggles live via useTicker. Rows are
  mock data (model/tag/vol proper nouns, untranslated).
-->
<template>
  <view>
    <view class="flex items-center justify-between" style="margin: 8px 2px 10px">
      <text style="font-family: var(--font-v5); font-weight: 600; font-size: 15px; color: var(--v5-ink); letter-spacing: -0.012em">{{ t.home.marketBoardTitle }} <text class="font-mono-tabular" style="font-size: 11.5px; font-weight: 400; color: var(--v5-ink-3)">{{ t.home.marketBoardPrices }}</text></text>
      <text class="font-mono-tabular" style="font-size: 13px; color: var(--v5-brand); font-weight: 500" @click="goMarket">{{ t.home.marketBoardOpen }} →</text>
    </view>

    <view class="market-board-card">
      <view class="market-board-head market-board-grid font-mono-tabular">
        <text>{{ t.home.mbColTag }}</text>
        <text>{{ t.home.mbColModel }}</text>
        <text class="market-board-spark-head">{{ t.home.mbCol1h }}</text>
        <text class="market-board-price-head">{{ t.home.mbColPrice }}</text>
        <text class="market-board-change-head">{{ t.home.mbCol24h }}</text>
      </view>

      <view
        v-for="(r, i) in ROWS"
        :key="r.name"
        class="market-board-row market-board-grid"
        :style="{ borderBottom: i < ROWS.length - 1 ? '1px solid var(--v5-border)' : 'none' }"
        @click="goEarn"
      >
        <view class="market-board-tag" aria-hidden="true">
          <svg
            class="market-board-tag-icon"
            :viewBox="workloadIconViewBox(workloadIconCode(r.tag))"
            :fill="workloadIconFill(workloadIconCode(r.tag))"
            :stroke="workloadIconStroke(workloadIconCode(r.tag))"
            :stroke-width="workloadIconStrokeWidth(workloadIconCode(r.tag))"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path v-for="(path, pathIndex) in workloadIconPaths(workloadIconCode(r.tag))" :key="pathIndex" :d="path" />
          </svg>
        </view>
        <view class="market-board-model-cell">
          <text class="market-board-name">{{ r.name }}</text>
          <text class="market-board-vol block font-mono-tabular mt-0.5">{{ volText(r) }}</text>
        </view>
        <view class="market-board-spark">
          <HomeSparkline :data="r.spark" :color="r.d >= 0 ? 'var(--v5-success)' : '#C26658'" :height="32" />
        </view>
        <view class="market-board-price-cell tabular-nums">
          <text class="market-board-price">{{ fmtPrice(livePrice(r, i)) }}</text>
          <text class="market-board-unit font-mono-tabular">/{{ r.unit }}</text>
        </view>
        <text class="market-board-change font-mono-tabular" :style="{ color: r.d >= 0 ? 'var(--v5-success)' : '#C26658' }">{{ changeText(r) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useTicker } from "@/composables/use-ticker";
import HomeSparkline from "./home-sparkline.vue";

interface MbRow {
  tag: string;
  name: string;
  unit: string;
  base: number;
  d: number;
  vol: string;
  spark: number[];
}

type WorkloadIconCode = "IG" | "VG" | "LL" | "FT" | "EM" | "SP";

const t = useT();
const tick = useTicker(0, 1, 1600);

const ROWS: MbRow[] = [
  { tag: "IMG", name: "SDXL Turbo", unit: "image", base: 0.00032, d: 3.2, vol: "142k", spark: [3.0, 3.1, 3.0, 3.15, 3.2, 3.18, 3.22, 3.2] },
  { tag: "LLM", name: "Llama 70B", unit: "job", base: 0.247, d: -1.1, vol: "8.2k", spark: [25.0, 25.4, 25.1, 24.7, 24.6, 24.8, 24.7, 24.7] },
  { tag: "STT", name: "Whisper", unit: "60s", base: 0.00009, d: -0.4, vol: "3.1M", spark: [9.1, 9.0, 9.05, 9.0, 9.05, 9.0, 9.0, 9.0] },
  { tag: "EMB", name: "Embedding", unit: "chunk", base: 0.00007, d: 0.8, vol: "912k", spark: [6.9, 7.0, 7.0, 7.0, 7.05, 7.0, 7.0, 7.0] },
  { tag: "IMG", name: "Flux Schnell", unit: "image", base: 0.00048, d: 2.4, vol: "21k", spark: [4.6, 4.7, 4.7, 4.75, 4.8, 4.78, 4.8, 4.8] },
  { tag: "LLM", name: "Phi-3 mini", unit: "500 tok", base: 0.00021, d: 0.5, vol: "512k", spark: [2.05, 2.08, 2.1, 2.09, 2.1, 2.1, 2.1, 2.1] },
];

function livePrice(r: MbRow, i: number) {
  return r.base * (1 + Math.sin((tick.value + i * 7) * 0.5) * 0.012);
}
function fmtPrice(n: number) {
  return "$" + n.toFixed(6);
}
function volText(r: MbRow) {
  return fmt(t.value.home.marketBoardVol, { n: r.vol });
}
function changeText(r: MbRow) {
  return `${r.d >= 0 ? "+" : ""}${r.d.toFixed(1)}%`;
}
const workloadIconMap: Record<WorkloadIconCode, string[]> = {
  IG: [
    "M6.5 8a2 2 0 1 0 4 0a2 2 0 0 0-4 0m14.427 1.99c-6.61-.908-12.31 4-11.927 10.51",
    "M3 13.066c2.78-.385 5.275.958 6.624 3.1",
    "M3 9.4c0-2.24 0-3.36.436-4.216a4 4 0 0 1 1.748-1.748C6.04 3 7.16 3 9.4 3h5.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v5.2c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C17.96 21 16.84 21 14.6 21H9.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C3 17.96 3 16.84 3 14.6z",
  ],
  LL: ["M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", "M8 9h8", "M8 13h5"],
  VG: [
    "M3 2.5h10c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5H3A1.5 1.5 0 0 1 1.5 13V4c0-.83.67-1.5 1.5-1.5m-1.5 3h13",
    "m3.5 5.5 2-3m1.5 3 2-3m1.5 3 2-3M6.5 8v4l4-2z",
  ],
  FT: [
    "M224 160a64 64 0 0 0-64 64v576a64 64 0 0 0 64 64h576a64 64 0 0 0 64-64V224a64 64 0 0 0-64-64zm0-64h576a128 128 0 0 1 128 128v576a128 128 0 0 1-128 128H224A128 128 0 0 1 96 800V224A128 128 0 0 1 224 96",
    "M384 416a64 64 0 1 0 0-128a64 64 0 0 0 0 128m0 64a128 128 0 1 1 0-256a128 128 0 0 1 0 256",
    "M480 320h256q32 0 32 32t-32 32H480q-32 0-32-32t32-32m160 416a64 64 0 1 0 0-128a64 64 0 0 0 0 128m0 64a128 128 0 1 1 0-256a128 128 0 0 1 0 256",
    "M288 640h256q32 0 32 32t-32 32H288q-32 0-32-32t32-32",
  ],
  EM: [
    "m13.11 7.664 1.78 2.672",
    "m14.162 12.788-3.324 1.424",
    "m20 4-6.06 1.515",
    "M3 3v16a2 2 0 0 0 2 2h16",
    "M12 4a2 2 0 1 0 0 4a2 2 0 0 0 0-4",
    "M16 10a2 2 0 1 0 0 4a2 2 0 0 0 0-4",
    "M9 13a2 2 0 1 0 0 4a2 2 0 0 0 0-4",
  ],
  SP: [
    "M11.5 6C7.022 6 4.782 6 3.391 7.172S2 10.229 2 14s0 5.657 1.391 6.828S7.021 22 11.5 22c4.478 0 6.718 0 8.109-1.172S21 17.771 21 14c0-1.17 0-2.158-.041-3",
    "m18.5 2 .258.697c.338.914.507 1.371.84 1.704.334.334.791.503 1.705.841L22 5.5l-.697.258c-.914.338-1.371.507-1.704.84-.334.334-.503.791-.841 1.705L18.5 9l-.258-.697c-.338-.914-.507-1.371-.84-1.704-.334-.334-.791-.503-1.705-.841L15 5.5l.697-.258c.914-.338 1.371-.507 1.704-.84.334-.334.503-.791.841-1.705z",
    "M12 10v8m-3-6v4m-3-3v2m9-3v4m3-3v2",
  ],
};

function workloadIconCode(tag: string): WorkloadIconCode {
  if (tag === "IMG") return "IG";
  if (tag === "LLM") return "LL";
  if (tag === "STT") return "SP";
  if (tag === "EMB") return "EM";
  return "IG";
}
function workloadIconPaths(code: WorkloadIconCode): string[] {
  return workloadIconMap[code];
}
function workloadIconViewBox(code: WorkloadIconCode): string {
  if (code === "FT") return "0 0 1024 1024";
  return code === "VG" ? "0 0 16 16" : "0 0 24 24";
}
function workloadIconFill(code: WorkloadIconCode): string {
  return code === "FT" ? "currentColor" : "none";
}
function workloadIconStroke(code: WorkloadIconCode): string {
  return code === "FT" ? "none" : "currentColor";
}
function workloadIconStrokeWidth(code: WorkloadIconCode): number {
  if (code === "FT") return 0;
  if (code === "VG") return 1;
  return code === "IG" || code === "SP" ? 1.5 : 2.1;
}
function goMarket() {
  uni.navigateTo({ url: "/pages/market/market", fail: () => {} });
}
function goEarn() {
  uni.navigateTo({ url: "/pages/earn/earn", fail: () => {} });
}
</script>

<style scoped>
.market-board-card {
  background: var(--v5-surface-bg);
  border-radius: 16px;
  overflow: hidden;
}

.market-board-grid {
  display: grid;
  grid-template-columns: 40px 80px 64px 82px 42px;
  column-gap: 8px;
  justify-content: start;
  align-items: center;
  min-width: 0;
}

.market-board-head {
  padding: 9px 12px;
  background: var(--v5-surface-2);
  border-bottom: 1px solid var(--v5-border);
  font-size: 11px;
  color: var(--v5-ink-4);
}

.market-board-head > * {
  justify-self: start;
  text-align: left;
}

.market-board-row {
  min-height: 86px;
  padding: 14px 12px;
}

.market-board-tag {
  width: 36px;
  min-width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--v5-brand-soft);
  color: var(--v5-brand);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: start;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--v5-brand) 14%, transparent);
}

.market-board-tag-icon {
  width: 20px;
  height: 20px;
  display: block;
}

.market-board-model-cell {
  min-width: 0;
  max-width: 80px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  justify-self: start;
  text-align: left;
}

.market-board-name {
  display: block;
  color: var(--v5-ink);
  font-family: var(--font-v5);
  font-size: 13.5px;
  font-weight: 500;
  letter-spacing: -0.008em;
  line-height: 18px;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.market-board-vol {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: var(--v5-ink-4);
  font-size: 11px;
  line-height: 15px;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-align: left;
}

.market-board-spark {
  min-width: 0;
  width: 64px;
  height: 32px;
  justify-self: start;
}

.market-board-spark-head {
  text-align: left;
}

.market-board-price-head,
.market-board-change-head {
  min-width: 0;
  text-align: left;
}

.market-board-price-cell {
  min-width: 0;
  text-align: left;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  justify-self: start;
}

.market-board-price {
  display: block;
  color: var(--v5-ink);
  font-family: var(--font-v5);
  font-size: 13px;
  font-weight: 500;
  line-height: 17px;
  white-space: nowrap;
  text-align: left;
}

.market-board-unit {
  margin-top: 5px;
  display: block;
  color: var(--v5-ink-4);
  font-size: 10.5px;
  line-height: 14px;
  white-space: nowrap;
  text-align: left;
}

.market-board-change {
  display: block;
  font-size: 12px;
  font-weight: 500;
  line-height: 14px;
  white-space: nowrap;
  justify-self: start;
  text-align: left;
}

@media (max-width: 390px) {
  .market-board-grid {
    grid-template-columns: 36px 80px 54px 72px 38px;
    column-gap: 8px;
  }

  .market-board-head {
    padding: 9px 10px;
  }

  .market-board-row {
    min-height: 90px;
    padding: 14px 10px;
  }

  .market-board-tag {
    width: 34px;
    min-width: 34px;
    height: 34px;
  }

  .market-board-tag-icon {
    width: 19px;
    height: 19px;
  }

  .market-board-name {
    font-size: 13px;
    line-height: 17px;
  }

  .market-board-spark {
    width: 54px;
    height: 28px;
  }

  .market-board-price {
    font-size: 12px;
    line-height: 16px;
  }

  .market-board-unit,
  .market-board-change {
    font-size: 10.5px;
    line-height: 12px;
  }
}
</style>
