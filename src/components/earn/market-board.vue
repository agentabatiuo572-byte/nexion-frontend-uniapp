<!--
  MarketBoard (Earn) — ported from Nexion-prototype/app/components/market-board.tsx.
  v3.1 §6.1 compute-price board. Three sections top→bottom:
    1. AI Workload Price Index (6 workloads · 24h delta · 7-pt sparkline)
    2. Device earnings ranking (5 tiers, phone last → upgrade pull)
    3. Network state rows
  Distinct from home's MarketBoardCard (different data + layout). Static mock
  data (workload/model proper nouns untranslated). Ranking rows with an href
  route to that tier's store detail. Conversion role: feeds the tier-locked
  tasks banner below it on /earn.
-->
<template>
  <view class="mx-4">
    <view class="flex items-center justify-between mb-2.5 px-1">
      <text style="font-family: var(--font-v5); font-size: 13.5px; font-weight: 600; color: var(--v5-ink-3); letter-spacing: -0.01em">{{ t.market.title }}</text>
      <view class="flex items-center gap-1" style="font-size: 11.5px; color: var(--v5-ink-3)">
        <view style="width: 6px; height: 6px; border-radius: 50%; background: var(--v5-brand); box-shadow: 0 0 6px color-mix(in srgb, var(--v5-brand) 70%, transparent)" />
        <text>{{ t.market.liveLabel }}</text>
      </view>
    </view>

    <!-- Price Index -->
    <view style="background: var(--v5-surface); border-radius: 16px; border: 1px solid var(--v5-border); overflow: hidden">
      <text class="block" :style="sectionLabelStyle">{{ t.market.priceIndex }}</text>
      <view
        v-for="(w, i) in PRICE_INDEX"
        :key="w.code"
        class="px-4 py-2.5"
        :style="{ borderTop: i !== 0 ? '1px solid color-mix(in srgb, var(--v5-border) 60%, transparent)' : 'none' }"
      >
        <view class="flex items-center gap-2.5">
          <text class="shrink-0 text-center" style="font-size: 14px; width: 20px">{{ w.emoji }}</text>
          <view class="flex-1 min-w-0">
            <view class="flex items-baseline gap-1.5">
              <text class="truncate" style="font-size: 12.5px; font-weight: 500; color: var(--v5-ink)">{{ w.label }}</text>
              <text class="truncate" style="font-size: 10.5px; color: var(--v5-ink-4)">{{ w.unit }}</text>
            </view>
            <text v-if="w.premium" class="block truncate" style="font-size: 10.5px; color: var(--v5-warning); margin-top: 2px">↳ {{ w.premium.label }} <text class="tabular-nums" style="font-family: var(--font-v5)">↑{{ w.premium.delta.toFixed(1) }}%</text></text>
          </view>
          <text class="tabular-nums shrink-0 text-right" style="font-family: var(--font-v5); font-size: 11.5px; color: var(--v5-ink-2); width: 64px">${{ formatPrice(w.price) }}</text>
          <text class="tabular-nums shrink-0 text-right" style="font-family: var(--font-v5); font-size: 11px; width: 48px" :style="{ color: arrowColor(w) }">{{ arrow(w) }} {{ Math.abs(w.delta).toFixed(1) }}%</text>
          <svg class="shrink-0" width="48" height="16" viewBox="0 0 48 16">
            <polyline :points="sparkPoints(w.spark)" fill="none" :stroke="w.delta < -0.05 ? 'var(--v5-brand-2)' : 'var(--v5-brand)'" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" />
          </svg>
        </view>
      </view>
    </view>

    <!-- Device earnings ranking -->
    <view class="mt-3" style="background: var(--v5-surface); border-radius: 16px; border: 1px solid var(--v5-border); overflow: hidden">
      <text class="block" :style="sectionLabelStyle">{{ t.market.deviceRanking }}</text>
      <view
        v-for="(d, i) in DEVICE_RANKINGS"
        :key="d.rank"
        class="flex items-center gap-3 px-4 py-2.5"
        :style="{ borderTop: i !== 0 ? '1px solid color-mix(in srgb, var(--v5-border) 60%, transparent)' : 'none' }"
        @click="d.kind ? goDetail(d.kind) : undefined"
      >
        <text class="tabular-nums text-center shrink-0" style="font-family: var(--font-v5); font-size: 11px; color: var(--v5-ink-4); width: 16px">{{ d.rank }}</text>
        <text class="shrink-0 text-center" style="font-size: 14px; width: 20px">{{ d.emoji }}</text>
        <view class="flex-1 min-w-0">
          <text class="block truncate" :style="{ fontSize: '12.5px', color: d.isPhone ? 'var(--v5-ink-3)' : 'var(--v5-ink-2)', fontWeight: d.isPhone ? 400 : 500 }">{{ d.name }}<text v-if="d.rank === 1" style="margin-left: 6px; font-size: 10.5px; color: var(--v5-warning)">⭐ Best</text></text>
          <text v-if="d.bestFor" class="block truncate" style="font-size: 10.5px; color: var(--v5-ink-4); margin-top: 2px">{{ d.bestFor }}</text>
        </view>
        <text class="tabular-nums shrink-0" :style="{ fontFamily: 'var(--font-v5)', fontSize: '12.5px', fontWeight: 600, color: d.isPhone ? 'var(--v5-ink-3)' : 'var(--v5-brand)' }">${{ d.dailyEarn.toFixed(2) }}/d</text>
        <svg v-if="d.kind" class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
      </view>
    </view>

    <!-- Network state -->
    <view class="mt-3" style="background: var(--v5-surface); border-radius: 16px; border: 1px solid var(--v5-border); padding: 12px 16px">
      <text class="block" style="font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--v5-ink-3); margin-bottom: 8px">{{ t.market.networkState }}</text>
      <view class="space-y-1.5" style="font-size: 11.5px">
        <view class="flex items-center justify-between gap-3">
          <text class="truncate" style="color: var(--v5-ink-3)">{{ t.market.activeJobs }}</text>
          <text class="tabular-nums shrink-0" style="font-family: var(--font-v5); color: var(--v5-ink-2)">8,432 globally</text>
        </view>
        <view class="flex items-center justify-between gap-3">
          <text class="truncate" style="color: var(--v5-ink-3)">{{ t.market.llmQueue }}</text>
          <view class="flex items-center gap-1.5 shrink-0">
            <text class="tabular-nums" style="font-family: var(--font-v5); color: var(--v5-ink-2)">1,247</text>
            <text style="font-size: 10.5px; color: var(--v5-brand)">high — premium pricing</text>
          </view>
        </view>
        <view class="flex items-center justify-between gap-3">
          <text class="truncate" style="color: var(--v5-ink-3)">{{ t.market.peakHours }}</text>
          <text class="tabular-nums shrink-0" style="font-family: var(--font-v5); color: var(--v5-ink-2)">14:00–22:00 UTC</text>
        </view>
        <view class="flex items-center justify-between gap-3">
          <text class="truncate" style="color: var(--v5-ink-3)">{{ t.market.nextDrop }}</text>
          <view class="flex items-center gap-1.5 shrink-0">
            <text class="tabular-nums" style="font-family: var(--font-v5); color: var(--v5-ink-2)">{{ t.market.nextDropValue }}</text>
            <text style="font-size: 10.5px; color: var(--v5-warning)">+30% LLM est.</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import type { DeviceKind } from "@/store/types";

interface WorkloadPrice {
  code: "IG" | "VG" | "LL" | "FT" | "EM" | "SP";
  emoji: string;
  label: string;
  unit: string;
  price: number;
  delta: number;
  spark: number[];
  premium?: { label: string; delta: number };
}

interface DeviceRanking {
  rank: 1 | 2 | 3 | 4 | 5;
  name: string;
  emoji: string;
  dailyEarn: number;
  bestFor?: string;
  isPhone?: boolean;
  kind?: Exclude<DeviceKind, "phone">;
}

const t = useT();

const PRICE_INDEX: WorkloadPrice[] = [
  { code: "IG", emoji: "🖼", label: "Image Gen", unit: "per image", price: 0.003, delta: 4.2, spark: [0.4, 0.5, 0.42, 0.55, 0.6, 0.7, 0.72] },
  { code: "LL", emoji: "💬", label: "LLM Inference", unit: "per 1k tok", price: 0.0024, delta: 18.7, spark: [0.3, 0.35, 0.4, 0.42, 0.6, 0.78, 0.88], premium: { label: "405B premium", delta: 32.1 } },
  { code: "VG", emoji: "🎬", label: "Video Gen", unit: "per sec", price: 0.18, delta: -1.2, spark: [0.65, 0.7, 0.6, 0.55, 0.62, 0.58, 0.62] },
  { code: "FT", emoji: "🔧", label: "Fine-tune", unit: "per job", price: 0.06, delta: 0.0, spark: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
  { code: "EM", emoji: "📐", label: "Embedding", unit: "per 1k chunks", price: 0.0008, delta: 2.1, spark: [0.4, 0.45, 0.4, 0.5, 0.52, 0.55, 0.57] },
  { code: "SP", emoji: "🎙", label: "Speech", unit: "per audio sec", price: 0.0003, delta: 0.3, spark: [0.5, 0.48, 0.5, 0.52, 0.5, 0.51, 0.52] },
];

const DEVICE_RANKINGS: DeviceRanking[] = [
  { rank: 1, name: "NexionRack P1", emoji: "🗄", dailyEarn: 142.6, bestFor: "Training + 405B LLM", kind: "stellarrack-p1" },
  { rank: 2, name: "NexionBox Pro", emoji: "📦", dailyEarn: 76.0, bestFor: "AI Premium pool", kind: "stellarbox-pro" },
  { rank: 3, name: "NexionBox S1", emoji: "📦", dailyEarn: 38.5, bestFor: "LLM 70B", kind: "stellarbox-s1" },
  { rank: 4, name: "Inference Share", emoji: "☁", dailyEarn: 0.073, bestFor: "Low barrier entry", kind: "cloud-share" },
  { rank: 5, name: "Your phone", emoji: "📱", dailyEarn: 0.06, bestFor: "Mobile NPU tier", isPhone: true },
];

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
function sparkPoints(data: number[]): string {
  const w = 48;
  const h = 16;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  return data
    .map((v, i) => `${(i * stepX).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
}

function goDetail(kind: Exclude<DeviceKind, "phone">) {
  uni.navigateTo({ url: `/pages/store/detail?id=${kind}`, fail: () => {} });
}

const sectionLabelStyle: CSSProperties = {
  padding: "12px 16px 6px",
  fontSize: "11px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--v5-ink-3)",
};
</script>
