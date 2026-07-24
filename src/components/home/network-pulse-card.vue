<!--
  NetworkPulseCard — ZONE 2 global-grid live metrics (ported from
  mission-control.tsx NetworkPulseCard). Header + live $/sec (platform anchor ±
  wobble) + 2×2 metric grid (label · value · sub · sparkline). Money/fleet
  values derive from src/lib/platform-stats.ts + store fleet count (single
  anchor); subs are dense mock stat strings.
-->
<template>
  <view>
    <view class="flex items-center justify-between" style="margin: 8px 2px 10px">
      <text style="font-family: var(--font-v5); font-weight: 600; font-size: 15px; color: var(--v5-ink); letter-spacing: -0.012em">{{ t.home.networkPulseTitle }}</text>
      <text class="font-mono-tabular" style="font-size: 12px; color: var(--v5-tech-cyan-ink)">{{ t.home.networkLive }}</text>
    </view>

    <view style="background: var(--v5-surface); border-radius: 16px; overflow: hidden">
      <view class="px-3.5 py-2.5 flex justify-between items-center font-mono-tabular" style="border-bottom: 1px solid var(--v5-border); background: var(--v5-surface-2); font-size: 12px; color: var(--v5-ink-3)">
        <view class="inline-flex items-center gap-1.5">
          <PulseDot color="var(--v5-tech-cyan)" />
          <text>{{ t.home.networkGlobalGrid }}</text>
        </view>
        <text class="tabular-nums" style="color: var(--v5-success-ink); font-weight: 500">{{ perSecText }}</text>
      </view>

      <view class="grid grid-cols-2">
        <!-- 横向 padding 14 → 12:①《03》§1 8pt grid(14 不在阶梯,12=space-3)
             ②腾出 4px,修 h3 20px 指标值(如 #18,742)撑破容器 2px 的溢出 -->
        <view
          v-for="(m, i) in metrics"
          :key="m.k"
          class="grid items-center gap-2"
          :style="{ gridTemplateColumns: '1fr 60px', padding: '12px', borderRight: i % 2 === 0 ? '1px solid var(--v5-border)' : 'none', borderBottom: i < 2 ? '1px solid var(--v5-border)' : 'none', minWidth: 0 }"
        >
          <view class="min-w-0">
            <text class="block font-mono-tabular" style="font-size: 12px; color: var(--v5-ink-3)">{{ m.k }}</text>
            <text class="block mt-0.5 tabular-nums" :style="{ fontFamily: 'var(--font-v5)', fontWeight: 600, fontSize: '20px', color: m.tone, letterSpacing: '-0.014em', lineHeight: 1.05, whiteSpace: 'nowrap' }">{{ m.v }}</text>
            <text class="block mt-1 font-mono-tabular truncate" style="font-size: 12px; color: var(--v5-ink-4)">{{ m.sub }}</text>
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
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { DAILY_PAYOUT_USD, PAYOUT_PER_SEC_USD } from "@/lib/platform-stats";
import PulseDot from "./pulse-dot.vue";
import HomeSparkline from "./home-sparkline.vue";

const t = useT();
const app = useApp();

// Live $/sec — symmetric wobble around the anchor rate, RECOMPUTED each tick
// (never accumulated: the old drifting ticker extrapolated to $18.6M/day).
const perSec = ref(PAYOUT_PER_SEC_USD);
let perSecTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  perSecTimer = setInterval(() => {
    perSec.value = PAYOUT_PER_SEC_USD + (Math.random() - 0.5) * 0.6;
  }, 1600);
});
onUnmounted(() => {
  if (perSecTimer) clearInterval(perSecTimer);
});
const perSecText = computed(() => `+$${perSec.value.toFixed(1)}/sec`);

const dailyPaidText = `$${Math.round(DAILY_PAYOUT_USD / 1000)}K`; // $682K/day anchor

const metrics = computed(() => [
  { k: t.value.home.networkMembers, v: "1.42M", sub: "registered · +2.9% /mo", tone: "var(--v5-ink)", data: [1.38, 1.39, 1.4, 1.4, 1.41, 1.41, 1.42, 1.42], color: "var(--v5-brand)" },
  { k: t.value.home.networkPaidToday, v: dailyPaidText, sub: "+1.9% vs yest.", tone: "var(--v5-success)", data: [0.51, 0.55, 0.58, 0.61, 0.63, 0.65, 0.67, 0.68], color: "var(--v5-success-ink)" },
  { k: t.value.home.networkDevices, v: app.global.activeDevices.toLocaleString(), sub: "live · 51.2k jobs/hr", tone: "var(--v5-ink)", data: [27.8, 27.9, 28.0, 28.1, 28.1, 28.2, 28.3, 28.4], color: "var(--v5-tech-cyan-ink)" },
  { k: t.value.home.networkYourRank, v: "#18,742", sub: "↑ 12 in 24h", tone: "var(--v5-brand)", data: [-19, -19, -19, -18.9, -18.9, -18.85, -18.8, -18.74], color: "var(--v5-brand)" },
]);
</script>
