<!--
  MarketBoard (Earn) — ported from Nexion-prototype/app/components/market-board.tsx.
  v3.1 §6.1 compute-price board. Two sections top→bottom:
    1. AI Workload Price Index (6 workloads · 24h delta)
    2. Device earnings ranking (5 tiers, phone last → upgrade pull)
  Distinct from home's MarketBoardCard (different data + layout). Static mock
  data (workload/model proper nouns untranslated). Ranking rows with an href
  route to that tier's store detail. Conversion role: feeds the tier-locked
  tasks banner below it on /earn.
-->
<template>
  <view class="mx-4">
    <view class="flex items-center justify-between mb-2 px-0">
      <text style="font-family: var(--font-v5); font-size: 15px; font-weight: 600; color: var(--v5-ink); letter-spacing: -0.012em">{{ t.market.title }}</text>
      <view class="flex items-center gap-1" style="font-size: 11.5px; color: var(--v5-ink-3)">
        <view class="market-board-live-dot" />
        <text>{{ t.market.liveLabel }}</text>
      </view>
    </view>

    <!-- Price Index -->
    <view>
      <text class="block" :style="sectionLabelStyle">{{ t.market.priceIndex }}</text>
      <view
        v-for="(w, i) in priceIndex"
        :key="w.code"
        class="py-2.5"
        :style="{ borderTop: i !== 0 ? '1px solid color-mix(in srgb, var(--v5-border) 60%, transparent)' : 'none' }"
      >
        <view class="flex items-center gap-2.5">
          <view class="shrink-0 grid place-items-center" :style="workloadIconBoxStyle">
            <svg width="20" height="20" :viewBox="workloadIconViewBox(w.code)" :fill="workloadIconFill(w.code)" :stroke="workloadIconStroke(w.code)" :stroke-width="workloadIconStrokeWidth(w.code)" stroke-linecap="round" stroke-linejoin="round">
              <path v-for="(path, pathIndex) in workloadIconPaths(w.code)" :key="pathIndex" :d="path" />
            </svg>
          </view>
          <view class="flex-1 min-w-0">
            <view class="flex items-baseline gap-1.5">
              <text class="truncate" style="font-size: 12.5px; font-weight: 500; color: var(--v5-ink)">{{ w.label }}</text>
              <text class="truncate" style="font-size: 10.5px; color: var(--v5-ink-4)">{{ w.unit }}</text>
            </view>
            <text v-if="w.flagship" class="block truncate" style="font-size: 10.5px; color: var(--v5-warning); margin-top: 2px">↳ {{ w.flagship.label }} <text class="tabular-nums" style="font-family: var(--font-v5)">↑{{ w.flagship.delta.toFixed(1) }}%</text></text>
          </view>
          <text class="tabular-nums shrink-0 text-right" style="font-family: var(--font-v5); font-size: 11.5px; color: var(--v5-ink-2); width: 64px">${{ formatPrice(w.price) }}</text>
          <text class="tabular-nums shrink-0 text-right" style="font-family: var(--font-v5); font-size: 11px; width: 48px" :style="{ color: arrowColor(w) }">{{ arrow(w) }} {{ Math.abs(w.delta).toFixed(1) }}%</text>
        </view>
      </view>
    </view>

    <!-- Device earnings ranking -->
    <view style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--v5-border)">
      <text class="block" :style="sectionLabelStyle">{{ t.market.deviceRanking }}</text>
      <view
        v-for="(d, i) in deviceRankings"
        :key="d.rank"
        class="flex items-center gap-3 py-2.5"
        :style="{ borderTop: i !== 0 ? '1px solid color-mix(in srgb, var(--v5-border) 60%, transparent)' : 'none' }"
        @click="d.kind ? goDetail(d.kind) : undefined"
      >
        <text class="tabular-nums text-center shrink-0" :style="rankingNumberStyle(d.rank)">{{ d.rank }}</text>
        <image v-if="d.imageSrc" class="shrink-0" :src="d.imageSrc" mode="aspectFill" style="width: 44px; height: 44px; border-radius: 6px; display: block" />
        <text v-else class="shrink-0 text-center" style="font-size: 14px; width: 32px">{{ d.emoji }}</text>
        <view class="flex-1 min-w-0">
          <text class="block truncate" :style="{ fontSize: '12.5px', color: d.isPhone ? 'var(--v5-ink-3)' : 'var(--v5-ink-2)', fontWeight: d.isPhone ? 400 : 500 }">{{ d.name }}<text v-if="d.rank === 1" style="margin-left: 6px; font-size: 10.5px; color: var(--v5-warning)">⭐ {{ t.market.bestBadge }}</text></text>
          <text v-if="d.bestFor" class="block truncate" style="font-size: 10.5px; color: var(--v5-ink-4); margin-top: 2px">{{ d.bestFor }}</text>
        </view>
        <text class="tabular-nums shrink-0" :style="{ fontFamily: 'var(--font-v5)', fontSize: '12.5px', fontWeight: 600, color: d.isPhone ? 'var(--v5-ink-3)' : 'var(--v5-brand)' }">${{ d.dailyEarn.toFixed(2) }}/d</text>
        <svg v-if="d.kind" class="shrink-0" style="color: var(--v5-ink-4)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import type { DeviceKind } from "@/store/types";

interface WorkloadPrice {
  code: "IG" | "VG" | "LL" | "FT" | "EM" | "SP";
  label: string;
  unit: string;
  price: number;
  delta: number;
  flagship?: { label: string; delta: number };
}

interface DeviceRanking {
  rank: 1 | 2 | 3 | 4 | 5;
  name: string;
  emoji: string;
  imageSrc?: string;
  dailyEarn: number;
  bestFor?: string;
  isPhone?: boolean;
  kind?: Exclude<DeviceKind, "phone">;
}

const t = useT();

const priceIndex = computed<WorkloadPrice[]>(() => [
  { code: "IG", label: t.value.market.workloadImageGen, unit: t.value.market.unitPerImage, price: 0.003, delta: 4.2 },
  { code: "LL", label: t.value.market.workloadLLMInference, unit: t.value.market.unitPer1kTok, price: 0.0024, delta: 18.7, flagship: { label: t.value.market.flagship405B, delta: 32.1 } },
  { code: "VG", label: t.value.market.workloadVideoGen, unit: t.value.market.unitPerSec, price: 0.18, delta: -1.2 },
  { code: "FT", label: t.value.market.workloadFineTune, unit: t.value.market.unitPerJob, price: 0.06, delta: 0.0 },
  { code: "EM", label: t.value.market.workloadEmbedding, unit: t.value.market.unitPer1kChunks, price: 0.0008, delta: 2.1 },
  { code: "SP", label: t.value.market.workloadSpeech, unit: t.value.market.unitPerAudioSec, price: 0.0003, delta: 0.3 },
]);

type WorkloadCode = WorkloadPrice["code"];

const workloadIconMap: Record<WorkloadCode, string[]> = {
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

function workloadIconPaths(code: WorkloadCode): string[] {
  return workloadIconMap[code];
}

function workloadIconViewBox(code: WorkloadCode): string {
  if (code === "FT") return "0 0 1024 1024";
  return code === "VG" ? "0 0 16 16" : "0 0 24 24";
}

function workloadIconFill(code: WorkloadCode): string {
  return code === "FT" ? "currentColor" : "none";
}

function workloadIconStroke(code: WorkloadCode): string {
  return code === "FT" ? "none" : "currentColor";
}

function workloadIconStrokeWidth(code: WorkloadCode): number {
  if (code === "FT") return 0;
  if (code === "VG") return 1;
  return code === "IG" || code === "SP" ? 1.5 : 2.1;
}

const deviceRankings = computed<DeviceRanking[]>(() => [
  { rank: 1, name: "NexionRack P1", emoji: "🗄", imageSrc: "/static/img/products/nexionrack-p1-ranking.png", dailyEarn: 45, bestFor: t.value.market.rankingTraining405B, kind: "stellarrack-p1" },
  { rank: 2, name: "NexionBox Pro", emoji: "📦", imageSrc: "/static/img/products/nexionbox-pro-ranking.png", dailyEarn: 13, bestFor: t.value.market.rankingFlagshipCompute, kind: "stellarbox-pro" },
  { rank: 3, name: "NexionBox S1", emoji: "📦", imageSrc: "/static/img/products/nexionbox-s1-ranking.png", dailyEarn: 7, bestFor: t.value.market.rankingLLM70B, kind: "stellarbox-s1" },
  { rank: 4, name: t.value.market.rankingInferenceShare, emoji: "☁", dailyEarn: 0.19, bestFor: t.value.market.rankingLowBarrier, kind: "cloud-share" },
  { rank: 5, name: t.value.earn.yourPhone, emoji: "📱", dailyEarn: 0.06, bestFor: t.value.market.rankingMobileNpuTier, isPhone: true },
]);

function formatPrice(n: number): string {
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(3);
  return n.toFixed(4);
}
function arrow(w: WorkloadPrice): string {
  return w.delta > 0.05 ? "↑" : w.delta < -0.05 ? "↓" : "→";
}
function arrowColor(w: WorkloadPrice): string {
  return w.delta > 0.05 ? "var(--v5-brand)" : w.delta < -0.05 ? "var(--v5-brand-2)" : "var(--v5-ink-4)";
}

function goDetail(kind: Exclude<DeviceKind, "phone">) {
  uni.navigateTo({ url: `/pages/store/detail?id=${kind}`, fail: () => {} });
}

function rankingNumberStyle(rank: DeviceRanking["rank"]): CSSProperties {
  const colors: Record<DeviceRanking["rank"], string> = {
    1: "var(--v5-brand)",
    2: "#54E9C4",
    3: "#22D7E8",
    4: "var(--v5-ink-4)",
    5: "var(--v5-ink-4)",
  };
  return {
    width: "16px",
    fontFamily: "var(--font-v5)",
    fontSize: "12.5px",
    lineHeight: "18px",
    fontWeight: rank <= 3 ? 600 : 500,
    color: colors[rank],
  };
}

const sectionLabelStyle: CSSProperties = {
  padding: "0 0 8px",
  fontSize: "11px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--v5-ink-3)",
};

const workloadIconBoxStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "8px",
  color: "var(--v5-success)",
  background: "color-mix(in srgb, var(--v5-success) 11%, #111719)",
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--v5-success) 10%, transparent)",
};
</script>

<style scoped>
.market-board-live-dot {
  --v5-hb-pulse-color: color-mix(in srgb, var(--v5-brand) 70%, transparent);
  --v5-hb-pulse-color-clear: color-mix(in srgb, var(--v5-brand) 0%, transparent);
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--v5-brand);
  animation: v5-hb-pulse 1.8s ease-in-out infinite;
}
</style>
