<!--
  NetworkPulseCard — ZONE 2 global-grid live metrics (ported from
  mission-control.tsx NetworkPulseCard). Header + live $/sec ticker + 2×2 metric
  grid (label · value · sub · sparkline). Metric labels keyed; values/subs are
  dense mock stat strings (kept faithful).
-->
<template>
  <view class="network-pulse">
    <view class="network-pulse__header">
      <text class="network-pulse__title">{{ t.home.networkPulseTitle }}</text>
      <view class="network-live-chip">
        <view class="network-live-chip__dot" />
        <text>{{ t.home.networkLive }}</text>
      </view>
    </view>

    <view class="network-card">
      <view class="network-card__top">
        <view class="network-card__global">
          <PulseDot color="var(--v5-tech-cyan)" :size="5" />
          <text>{{ t.home.networkGlobalGrid }}</text>
        </view>
        <text class="network-card__rate">{{ perSecText }}</text>
      </view>

      <view class="network-grid">
        <view
          v-for="(m, i) in metrics"
          :key="m.k"
          class="network-metric"
          :class="{ 'network-metric--right-divider': i % 2 === 0, 'network-metric--bottom-divider': i < 2 }"
        >
          <view class="network-metric__main">
            <text class="network-metric__name">{{ m.k }}</text>
            <text class="network-metric__value" :style="{ color: m.tone }">{{ m.v }}</text>
            <text class="network-metric__sub">{{ m.sub }}</text>
          </view>
          <view class="network-metric__spark">
            <HomeSparkline :data="m.data" :color="m.color" :height="32" />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import { useTicker } from "@/composables/use-ticker";
import PulseDot from "./pulse-dot.vue";
import HomeSparkline from "./home-sparkline.vue";

const t = useT();
const tickerUsd = useTicker(215, 1, 1600);
const perSecText = computed(() => `+$${Math.round(tickerUsd.value)}/sec`);

const metrics = computed(() => [
  { k: t.value.home.networkPhones, v: "1.42M", sub: "online · +2.1% /1h", tone: "var(--v5-ink)", data: [1.38, 1.39, 1.4, 1.4, 1.41, 1.41, 1.42, 1.42], color: "var(--v5-brand)" },
  { k: t.value.home.networkPaidToday, v: "$1.24M", sub: "+8.2% vs yest.", tone: "var(--v5-success)", data: [0.92, 0.98, 1.04, 1.1, 1.14, 1.18, 1.22, 1.24], color: "var(--v5-success)" },
  { k: t.value.home.networkHubs, v: "28,432", sub: "live · 4,820 jobs/s", tone: "var(--v5-ink)", data: [27.8, 27.9, 28.0, 28.1, 28.1, 28.2, 28.3, 28.4], color: "var(--v5-tech-cyan)" },
  { k: t.value.home.networkYourRank, v: "18,742", sub: "↑ 12 in 24h", tone: "var(--v5-brand)", data: [-19, -19, -19, -18.9, -18.9, -18.85, -18.8, -18.74], color: "var(--v5-brand)" },
]);
</script>

<style scoped>
.network-pulse__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 2px 16px;
}

.network-pulse__title {
  font-family: var(--font-v5);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--v5-ink);
}

.network-live-chip {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 24px;
  padding: 0 7px;
  border-radius: 4px;
  background: var(--v5-success-soft);
  color: var(--v5-success);
  font-family: "JetBrains Mono", var(--font-mono);
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1;
}

.network-live-chip__dot {
  display: inline-block;
  flex-shrink: 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  animation: network-live-pulse 1.6s ease-in-out infinite;
}

html[data-theme="dark"] .network-live-chip {
  background: rgba(142,114,255,0.2);
  color: #8e72ff;
}

html[data-theme="dark"] .network-live-chip__dot {
  animation-name: network-live-pulse-dark;
}

@keyframes network-live-pulse {
  0% { box-shadow: 0 0 0 0 rgba(14,142,74,0.45); }
  70% { box-shadow: 0 0 0 7px rgba(14,142,74,0); }
  100% { box-shadow: 0 0 0 0 rgba(14,142,74,0); }
}

@keyframes network-live-pulse-dark {
  0% { box-shadow: 0 0 0 0 rgba(142,114,255,0.5); }
  70% { box-shadow: 0 0 0 7px rgba(142,114,255,0); }
  100% { box-shadow: 0 0 0 0 rgba(142,114,255,0); }
}

.network-card {
  background: var(--v5-surface-bg);
  border-radius: 16px;
  overflow: hidden;
}

.network-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--v5-border);
  background: var(--v5-surface-2);
  color: var(--v5-ink-3);
  font-family: "JetBrains Mono", var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

html[data-theme="dark"] .network-card__top {
  background: #1B1F24;
}

.network-card__global {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.network-card__rate {
  color: var(--v5-success);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.network-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.network-metric {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 60px;
  align-items: center;
  gap: 8px;
  min-height: 88px;
  padding: 8px 14px;
  min-width: 0;
}

.network-metric--right-divider {
  border-right: 1px solid var(--v5-border);
}

.network-metric--bottom-divider {
  border-bottom: 1px solid var(--v5-border);
}

.network-metric__main {
  min-width: 0;
}

.network-metric__name {
  display: block;
  font-family: "JetBrains Mono", var(--font-mono);
  font-size: 11.5px;
  color: var(--v5-ink-3);
  line-height: 1.2;
}

.network-metric__value {
  display: block;
  margin-top: 2px;
  font-family: var(--font-v5);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.014em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.network-metric__sub {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: "JetBrains Mono", var(--font-mono);
  font-size: 11.5px;
  color: var(--v5-ink-4);
  line-height: 1.2;
}

.network-metric__spark {
  width: 60px;
  height: 32px;
  min-width: 60px;
}
</style>
