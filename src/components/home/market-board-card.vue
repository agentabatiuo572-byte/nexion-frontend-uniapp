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

    <view style="background: var(--v5-surface); border: 1px solid var(--v5-border); border-radius: 16px; overflow: hidden">
      <view class="grid gap-2 font-mono-tabular" style="grid-template-columns: 36px 1fr 60px 76px 58px; padding: 9px 14px; background: var(--v5-surface-2); border-bottom: 1px solid var(--v5-border); font-size: 11px; color: var(--v5-ink-4)">
        <text>{{ t.home.mbColTag }}</text>
        <text>{{ t.home.mbColModel }}</text>
        <text class="text-right">{{ t.home.mbCol1h }}</text>
        <text class="text-right">{{ t.home.mbColPrice }}</text>
        <text class="text-right">{{ t.home.mbCol24h }}</text>
      </view>

      <view
        v-for="(r, i) in ROWS"
        :key="r.name"
        class="grid items-center gap-2"
        :style="{ gridTemplateColumns: '36px 1fr 60px 76px 58px', padding: '10px 14px', borderBottom: i < ROWS.length - 1 ? '1px solid var(--v5-border)' : 'none', minWidth: 0 }"
        @click="goEarn"
      >
        <text class="font-mono-tabular" style="font-size: 11px; color: var(--v5-brand); background: var(--v5-brand-soft); border-radius: 4px; padding: 2px 4px; text-align: center; justify-self: start; font-weight: 500">{{ r.tag }}</text>
        <view class="min-w-0">
          <text class="block truncate" style="font-family: var(--font-v5); font-weight: 500; font-size: 13.5px; color: var(--v5-ink); letter-spacing: -0.008em">{{ r.name }}</text>
          <text class="block font-mono-tabular mt-0.5" style="font-size: 11px; color: var(--v5-ink-4)">{{ volText(r) }}</text>
        </view>
        <view class="min-w-0">
          <HomeSparkline :data="r.spark" :color="r.d >= 0 ? 'var(--v5-success)' : '#C26658'" :height="18" :fill="false" />
        </view>
        <view class="text-right whitespace-nowrap tabular-nums">
          <text style="font-family: var(--font-v5); font-weight: 500; font-size: 13px; color: var(--v5-ink)">{{ fmtPrice(livePrice(r, i)) }}</text>
          <text class="block font-mono-tabular mt-0.5" style="font-size: 11px; color: var(--v5-ink-4)">/{{ r.unit }}</text>
        </view>
        <text class="text-right tabular-nums font-mono-tabular" :style="{ fontSize: '12.5px', color: r.d >= 0 ? 'var(--v5-success)' : '#C26658', fontWeight: 500 }">{{ changeText(r) }}</text>
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
  return n < 0.001 ? "$" + n.toFixed(7).replace(/0+$/, "").replace(/\.$/, ".0") : "$" + n.toFixed(3);
}
function volText(r: MbRow) {
  return fmt(t.value.home.marketBoardVol, { n: r.vol });
}
function changeText(r: MbRow) {
  return `${r.d >= 0 ? "+" : ""}${r.d.toFixed(1)}%`;
}
function goMarket() {
  uni.navigateTo({ url: "/pages/market/market", fail: () => {} });
}
function goEarn() {
  uni.navigateTo({ url: "/pages/earn/earn", fail: () => {} });
}
</script>
