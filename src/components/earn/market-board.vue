<!--
  MarketBoard (Earn) — ported from Nexion-prototype/app/components/market-board.tsx.
  v3.1 §6.1 compute-price board. Two sections top→bottom:
    1. Device earnings ranking (5 tiers, phone last → upgrade pull)
    2. AI Workload Price Index (6 workloads · 24h delta)
  Distinct from home's MarketBoardCard (different data + layout). Static mock
  data (workload/model proper nouns untranslated). Ranking rows with an href
  route to that tier's store detail. Conversion role: feeds the tier-locked
  tasks banner below it on /earn.
-->
<template>
  <view class="mx-4">
    <view class="flex items-center justify-between px-0" style="margin-bottom: 16px">
      <text style="font-family: var(--font-v5); font-size: 15px; font-weight: 600; color: var(--v5-ink); letter-spacing: 0">{{ t.market.title }}</text>
      <view class="flex items-center gap-1" style="font-size: 11.5px; color: var(--v5-ink-3)">
        <view style="width: 6px; height: 6px; border-radius: 50%; background: var(--v5-brand); animation: v5-hb-pulse 1.8s ease-in-out infinite" />
        <text>{{ t.market.liveLabel }}</text>
      </view>
    </view>

    <!-- Device earnings ranking -->
    <view>
      <text class="block" :style="sectionLabelStyle">{{ t.market.deviceRanking }}</text>
      <view
        v-for="(d, i) in deviceRankings"
        :key="d.rank"
        class="items-center"
        :style="rankingRowStyle(i)"
        @click="d.kind ? goDetail(d.kind) : undefined"
      >
        <text class="tabular-nums text-center" :style="{ fontFamily: 'var(--font-v5)', fontSize: '12.5px', lineHeight: '18px', color: rankColor(d.rank) }">{{ d.rank }}</text>
        <view :style="deviceThumbStyle(d)">
          <image v-if="d.image" :src="d.image" mode="aspectFill" style="width: 44px; height: 44px; border-radius: 6px" />
          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.5 19.5a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.3-2 4.5 4.5 0 0 0 .3 9h11" />
            <path d="M8 17h8" />
            <path d="M10 14h4" />
          </svg>
        </view>
        <view class="min-w-0">
          <text class="block truncate" style="font-size: 12.5px; color: var(--v5-ink); font-weight: 500">{{ d.name }}</text>
          <text class="block truncate" style="font-size: 10.5px; color: var(--v5-ink-4); margin-top: 2px">{{ d.bestFor }}</text>
        </view>
        <text class="tabular-nums text-right" style="font-family: var(--font-amount); font-size: 12.5px; font-weight: 600; color: var(--v5-brand); width: 74px">${{ d.dailyEarn.toFixed(2) }}/d</text>
        <svg v-if="d.kind" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        <view v-else style="width: 14px; height: 14px" />
      </view>
    </view>

    <!-- Price Index -->
    <view style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--v5-border)">
      <text class="block" :style="sectionLabelStyle">{{ t.market.priceIndex }}</text>
      <view
        v-for="(w, i) in priceIndex"
        :key="w.code"
        class="items-center"
        :style="priceRowStyle(i)"
      >
        <view class="grid place-items-center shrink-0" :style="workloadIconStyle">
          <svg
            width="18"
            height="18"
            :viewBox="workloadViewBox(w.code)"
            :fill="workloadFill(w.code)"
            :stroke="workloadStrokeColor(w.code)"
            :stroke-width="workloadStroke(w.code)"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path v-for="(p, pi) in w.paths" :key="pi" :d="p" />
          </svg>
        </view>
        <view class="flex-1 min-w-0">
          <text class="block truncate" style="font-size: 12.5px; font-weight: 500; color: var(--v5-ink)">{{ w.label }}</text>
          <text class="block truncate" style="font-size: 10.5px; color: var(--v5-ink-4); margin-top: 2px">{{ w.unit }}</text>
        </view>
        <text class="tabular-nums text-right" style="font-family: var(--font-amount); font-size: 12px; color: var(--v5-ink-2); width: 100%">${{ w.priceText }}</text>
        <text class="tabular-nums text-right" style="font-family: var(--font-v5); font-size: 12px; width: 100%" :style="{ color: trendColor(w.trend) }">{{ w.trend }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import type { DeviceKind } from "@/store/types";

type WorkloadCode = "IG" | "VG" | "LL" | "FT" | "EM" | "SP";

interface WorkloadPrice {
  code: WorkloadCode;
  label: string;
  unit: string;
  priceText: string;
  trend: string;
  paths: string[];
}

interface DeviceRanking {
  rank: 1 | 2 | 3 | 4 | 5;
  name: string;
  dailyEarn: number;
  bestFor?: string;
  isPhone?: boolean;
  image?: string;
  kind?: Exclude<DeviceKind, "phone">;
}

const t = useT();

const WORKLOAD_BASE: Array<Omit<WorkloadPrice, "label" | "unit">> = [
  { code: "IG", priceText: "0.0030", trend: "↑ 4.2%", paths: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2", "M9 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0", "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"] },
  { code: "LL", priceText: "0.0024", trend: "↑ 18.7%", paths: ["M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719", "M8 12h.01", "M12 12h.01", "M16 12h.01"] },
  {
    code: "VG",
    priceText: "0.180",
    trend: "↓ 1.2%",
    paths: [
      "M3 2.5h10c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5H3A1.5 1.5 0 0 1 1.5 13V4c0-.83.67-1.5 1.5-1.5m-1.5 3h13",
      "m3.5 5.5 2-3m1.5 3 2-3m1.5 3 2-3M6.5 8v4l4-2z",
    ],
  },
  {
    code: "FT",
    priceText: "0.060",
    trend: "→ 0.0%",
    paths: [
      "M224 160a64 64 0 0 0-64 64v576a64 64 0 0 0 64 64h576a64 64 0 0 0 64-64V224a64 64 0 0 0-64-64zm0-64h576a128 128 0 0 1 128 128v576a128 128 0 0 1-128 128H224A128 128 0 0 1 96 800V224A128 128 0 0 1 224 96",
      "M384 416a64 64 0 1 0 0-128a64 64 0 0 0 0 128m0 64a128 128 0 1 1 0-256a128 128 0 0 1 0 256",
      "M480 320h256q32 0 32 32t-32 32H480q-32 0-32-32t32-32m160 416a64 64 0 1 0 0-128a64 64 0 0 0 0 128m0 64a128 128 0 1 1 0-256a128 128 0 0 1 0 256",
      "M288 640h256q32 0 32 32t-32 32H288q-32 0-32-32t32-32",
    ],
  },
  {
    code: "EM",
    priceText: "0.0008",
    trend: "↑ 2.1%",
    paths: [
      "m13.11 7.664 1.78 2.672",
      "m14.162 12.788-3.324 1.424",
      "M20 4 13.94 5.515",
      "M3 3v16a2 2 0 0 0 2 2h16",
      "M12 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
      "M16 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
      "M9 15m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
    ],
  },
  {
    code: "SP",
    priceText: "0.0003",
    trend: "↑ 0.3%",
    paths: [
      "M11.5 6C7.022 6 4.782 6 3.391 7.172S2 10.229 2 14s0 5.657 1.391 6.828S7.021 22 11.5 22c4.478 0 6.718 0 8.109-1.172S21 17.771 21 14c0-1.17 0-2.158-.041-3",
      "m18.5 2 .258.697c.338.914.507 1.371.84 1.704.334.334.791.503 1.705.841L22 5.5l-.697.258c-.914.338-1.371.507-1.704.84-.334.334-.503.791-.841 1.705L18.5 9l-.258-.697c-.338-.914-.507-1.371-.84-1.704-.334-.334-.791-.503-1.705-.841L15 5.5l.697-.258c.914-.338 1.371-.507 1.704-.84.334-.334.503-.791.841-1.705z",
      "M12 10v8m-3-6v4m-3-3v2m9-3v4m3-3v2",
    ],
  },
];

const workloadLabelKey: Record<WorkloadCode, keyof typeof t.value.receipt> = {
  IG: "catIG",
  VG: "catVG",
  LL: "catLL",
  FT: "catFT",
  EM: "catEM",
  SP: "catSP",
};

const priceIndex = computed<WorkloadPrice[]>(() =>
  WORKLOAD_BASE.map((w) => ({
    ...w,
    label: t.value.receipt[workloadLabelKey[w.code]],
    unit: t.value.market.workloadUnits[w.code],
  })),
);

const deviceRankings = computed<DeviceRanking[]>(() => [
  { rank: 1, name: "NexionRack P1", dailyEarn: 45, bestFor: t.value.market.bestForTraining, image: "/static/img/products/nexionrack-p1-ranking.png", kind: "stellarrack-p1" },
  { rank: 2, name: "NexionBox Pro", dailyEarn: 13, bestFor: t.value.market.bestForFlagship, image: "/static/img/products/nexionbox-pro-ranking.png", kind: "stellarbox-pro" },
  { rank: 3, name: "NexionBox S1", dailyEarn: 7, bestFor: "LLM 70B", image: "/static/img/products/nexionbox-s1-ranking.png", kind: "stellarbox-s1" },
  { rank: 4, name: t.value.market.rankingShareName, dailyEarn: 0.19, bestFor: t.value.market.rankingShareBestFor, kind: "cloud-share" },
  { rank: 5, name: t.value.market.rankingPhoneName, dailyEarn: 0.06, bestFor: t.value.market.rankingPhoneBestFor, image: "/static/img/devices/real-phone-ui.png", isPhone: true },
]);

function goDetail(kind: Exclude<DeviceKind, "phone">) {
  uni.navigateTo({ url: `/pages/store/detail?id=${kind}`, fail: () => {} });
}

function rankingRowStyle(i: number): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "16px 44px minmax(0, 1fr) 74px 14px",
    columnGap: "12px",
    minHeight: "64px",
    padding: "8px 0",
    borderTop: i !== 0 ? "1px solid color-mix(in srgb, var(--v5-border) 60%, transparent)" : "none",
  };
}

function priceRowStyle(i: number): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "36px minmax(0, 1fr) 86px 74px",
    columnGap: "10px",
    minHeight: "52px",
    padding: "8px 0",
    borderTop: i === 0 ? "none" : "1px solid color-mix(in srgb, var(--v5-border) 60%, transparent)",
  };
}

function rankColor(rank: DeviceRanking["rank"]): string {
  if (rank === 1) return "var(--v5-brand)";
  if (rank === 2) return "#54E9C4";
  if (rank === 3) return "#22D7E8";
  return "var(--v5-ink-4)";
}

function trendColor(trend: string): string {
  if (trend.startsWith("↓")) return "var(--v5-brand-2)";
  if (trend.startsWith("→")) return "var(--v5-ink-4)";
  return "var(--v5-brand)";
}

function workloadStroke(code: WorkloadCode): number {
  if (code === "LL") return 2.25;
  if (code === "FT") return 0;
  if (code === "VG") return 1;
  return code === "SP" ? 1.5 : 1.9;
}

function workloadViewBox(code: WorkloadCode): string {
  if (code === "VG") return "0 0 16 16";
  return code === "FT" ? "0 0 1024 1024" : "0 0 24 24";
}

function workloadFill(code: WorkloadCode): string {
  return code === "FT" ? "currentColor" : "none";
}

function workloadStrokeColor(code: WorkloadCode): string {
  return code === "FT" ? "none" : "var(--v5-success)";
}

function deviceThumbStyle(d: DeviceRanking): CSSProperties {
  return {
    width: "44px",
    height: "44px",
    borderRadius: "6px",
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
    background: d.image ? "transparent" : "color-mix(in srgb, var(--v5-brand) 10%, transparent)",
  };
}

const sectionLabelStyle: CSSProperties = {
  padding: "0 0 6px",
  fontSize: "12px",
  letterSpacing: "0.16em",
  color: "var(--v5-ink)",
  fontWeight: 500,
};

const workloadIconStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "8px",
  color: "var(--v5-success)",
  background: "color-mix(in srgb, var(--v5-success) 11%, var(--v5-surface-2))",
};
</script>
