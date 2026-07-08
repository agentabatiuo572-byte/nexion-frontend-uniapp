<!--
  NexPriceCard — ZONE 6 $NEX live price (ported from mission-control.tsx
  NexPriceCard). Pair label + live price + 24h change (tinted) + "exchange
  cleared" trust line + hourly kline sparkline. Reads useMarket (live, ticking).
-->
<template>
  <view class="nex-price-card" @click="goMarket">
    <text class="nex-price-card__title">行情</text>

    <view class="nex-price-card__body">
      <view class="nex-price-card__main">
        <view class="nex-price-card__pair font-mono-tabular">
          <text class="nex-price-card__symbol">$NEX</text>
          <text style="color: var(--v5-ink-4)">{{ t.home.nexPricePair }}</text>
        </view>
        <view class="nex-price-card__price-line">
          <text class="nex-price-card__price tabular-nums">${{ priceText }}</text>
          <text class="font-mono-tabular tabular-nums" :style="{ color: tint }" style="font-size: 12.5px; font-weight: 500">{{ changeText }}</text>
        </view>
      </view>
      <view class="nex-price-card__chart">
        <view class="nex-price-card__spark">
          <HomeSparkline :data="kline" :color="tint" :height="38" />
        </view>
        <view class="nex-price-card__trust font-mono-tabular">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
          <text style="color: var(--v5-success)">{{ t.home.nexPriceBinance }}</text>
        </view>
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
const tint = computed(() => (isUp.value ? "var(--v5-success)" : "#C26658"));

const priceText = computed(() => livePrice.value.toFixed(3));
const changeText = computed(() => `${isUp.value ? "+" : ""}${change.value.toFixed(1)}%`);

function goMarket() {
  uni.navigateTo({ url: "/pages/market/market", fail: () => {} });
}
</script>

<style scoped>
.nex-price-card {
  position: relative;
  overflow: hidden;
  display: block;
  min-height: 44px;
  padding: 14px 16px 16px;
  border-radius: 16px;
  background: var(--v5-surface-bg);
}

.nex-price-card:active {
  transform: scale(0.99);
}

.nex-price-card__title {
  display: block;
  color: var(--v5-ink);
  font-family: var(--font-v5);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 20px;
}

.nex-price-card__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}

.nex-price-card__main {
  min-width: 0;
}

.nex-price-card__pair {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  color: var(--v5-ink-3);
  font-size: 12px;
  line-height: 16px;
}

.nex-price-card__symbol {
  color: var(--v5-brand);
  font-family: var(--font-v5);
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: -0.005em;
}

.nex-price-card__price-line {
  display: flex;
  align-items: baseline;
  gap: 7px;
  margin-top: 6px;
}

.nex-price-card__price {
  color: var(--v5-ink);
  font-family: var(--font-amount);
  font-size: 22px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  line-height: 1;
}

.nex-price-card__trust {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 5px;
  color: var(--v5-success);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
}

.nex-price-card__chart {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 112px;
}

.nex-price-card__spark {
  width: 112px;
  height: 38px;
}
</style>
