<!--
  NexPriceCard — ZONE 6 $NEX live price (ported from mission-control.tsx
  NexPriceCard). Pair label + live price + 24h change (tinted) + hourly kline
  sparkline. Reads useMarket (live, ticking).
  Hidden for current stage (owner 2026-07-09): not rendered on index.vue.
-->
<template>
  <view class="block" style="background: var(--v5-surface); border-radius: 16px; padding: 12px 14px; position: relative; overflow: hidden" @click="goMarket">
    <view class="grid items-center gap-3" style="grid-template-columns: 1fr 76px">
      <view class="min-w-0">
        <view class="flex items-baseline gap-1.5 font-mono-tabular" style="font-size: 12px; color: var(--v5-ink-3)">
          <text style="font-family: var(--font-v5); font-weight: 600; color: var(--v5-brand); letter-spacing: -0.005em; font-size: 12.5px">$NEX</text>
          <text style="color: var(--v5-ink-4)">{{ t.home.nexPricePair }}</text>
        </view>
        <view class="mt-1 flex items-baseline gap-1.5">
          <text class="tabular-nums" style="font-family: var(--font-v5); font-weight: 600; font-size: 20px; color: var(--v5-ink); letter-spacing: -0.020em; line-height: 1">${{ priceText }}</text>
          <text class="font-mono-tabular tabular-nums" :style="{ fontSize: '12.5px', color: tint, fontWeight: 500 }">{{ changeText }}</text>
        </view>
      </view>
      <view style="height: 36px">
        <HomeSparkline :data="kline" :color="tint" :height="36" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import { useMarket } from "@/store/market";
import HomeSparkline from "./home-sparkline.vue";

const t = useT();
const market = useMarket();

const change = computed(() => market.change24hPct);
const kline = computed(() => market.klineHourly);
const livePrice = computed(() => market.nexPriceUSDT);
const isUp = computed(() => change.value >= 0);
const tint = computed(() => (isUp.value ? "var(--v5-success)" : "var(--v5-danger)"));

const priceText = computed(() => livePrice.value.toFixed(3));
const changeText = computed(() => `${isUp.value ? "+" : ""}${change.value.toFixed(1)}%`);

function goMarket() {
  uni.navigateTo({ url: "/pages/market/market", fail: () => {} });
}
</script>
