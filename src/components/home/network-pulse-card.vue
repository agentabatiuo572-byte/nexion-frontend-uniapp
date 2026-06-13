<!--
  NetworkPulseCard — ZONE 2 global-grid live metrics (ported from
  mission-control.tsx NetworkPulseCard). Header + live $/sec ticker + 2×2 metric
  grid (label · value · sub · sparkline). Metric labels keyed; values/subs are
  dense mock stat strings (kept faithful).
-->
<template>
  <view>
    <view class="flex items-center justify-between" style="margin: 8px 2px 10px">
      <text style="font-family: var(--font-v5); font-weight: 600; font-size: 15px; color: var(--v5-ink); letter-spacing: -0.012em">{{ t.home.networkPulseTitle }}</text>
      <text class="font-mono-tabular" style="font-size: 11.5px; color: var(--v5-tech-cyan)">{{ t.home.networkLive }}</text>
    </view>

    <view style="background: var(--v5-surface); border: 1px solid var(--v5-border); border-radius: 16px; overflow: hidden">
      <view class="px-3.5 py-2.5 flex justify-between items-center font-mono-tabular" style="border-bottom: 1px solid var(--v5-border); background: var(--v5-surface-2); font-size: 12px; color: var(--v5-ink-3)">
        <view class="inline-flex items-center gap-1.5">
          <PulseDot color="var(--v5-tech-cyan)" />
          <text>{{ t.home.networkGlobalGrid }}</text>
        </view>
        <text class="tabular-nums" style="color: var(--v5-success); font-weight: 500">{{ perSecText }}</text>
      </view>

      <view class="grid grid-cols-2">
        <view
          v-for="(m, i) in metrics"
          :key="m.k"
          class="grid items-center gap-2"
          :style="{ gridTemplateColumns: '1fr 60px', padding: '12px 14px', borderRight: i % 2 === 0 ? '1px solid var(--v5-border)' : 'none', borderBottom: i < 2 ? '1px solid var(--v5-border)' : 'none', minWidth: 0 }"
        >
          <view class="min-w-0">
            <text class="block font-mono-tabular" style="font-size: 11.5px; color: var(--v5-ink-3)">{{ m.k }}</text>
            <text class="block mt-0.5 tabular-nums" :style="{ fontFamily: 'var(--font-v5)', fontWeight: 600, fontSize: '18px', color: m.tone, letterSpacing: '-0.014em', lineHeight: 1.05, whiteSpace: 'nowrap' }">{{ m.v }}</text>
            <text class="block mt-1 font-mono-tabular truncate" style="font-size: 11.5px; color: var(--v5-ink-4)">{{ m.sub }}</text>
          </view>
          <view style="height: 32px">
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
  { k: t.value.home.networkYourRank, v: "#18,742", sub: "↑ 12 in 24h", tone: "var(--v5-brand)", data: [-19, -19, -19, -18.9, -18.9, -18.85, -18.8, -18.74], color: "var(--v5-brand)" },
]);
</script>
