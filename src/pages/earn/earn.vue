<!--
  Earn tab — ported from Nexion-prototype/app/(main)/earn/page.tsx.
  Hybrid: V5 HERO (PillTabs + TotalEarnedCard) on top, V4 device-pool sections
  below. Conversion arc (earned → missed → trial escape → devices → fleet decay
  → market context → tier-locked tasks → footer):
    PillTabs (Today/Week/Month/All) + TotalEarnedCard (range total + breakdown)
    → MissedIncomeBanner → TrialHeroBanner / TrialGhostSlot
    → Home-style MyFleetSection (device rows route to detail)
    → DeviceLifecycleBanner → MarketBoard
    → TaskCenter.

  PillTabs + TotalEarnedCard inlined here (page-specific). Wrapped in
  <AppChassis active="earn">; entrance via <CardStagger>. Reads the same
  `earnings` aggregate Home reads so the Today pill matches Home exactly.
-->
<template>
  <AppChassis active="earn">
    <CardStagger class="pt-3 pb-4 space-y-6" style="color: var(--v5-ink)">
      <view style="display: flex; flex-direction: column; gap: 8px">
        <!-- ===== HERO: pill tabs ===== -->
        <view class="mx-4">
          <view class="earn-range-bar flex" :style="rangeBarStyle">
            <view
              v-for="r in ranges"
              :key="r.key"
              class="earn-range-pill flex-1 grid place-items-center active:opacity-70"
              :class="{ 'is-active': range === r.key }"
              :style="pillStyle(r)"
              @click="range = r.key"
            >
              <text :style="pillLabelStyle(r)">{{ r.label }}</text>
            </view>
          </view>
        </view>

        <!-- ===== HERO: total earned card ===== -->
        <view class="mx-4">
          <view class="relative isolate" :style="totalCardStyle">
            <!-- Left aurora glow, matched to Home today's earnings. -->
            <view
              aria-hidden
              :style="totalAuroraStyle"
            ></view>
            <!-- 24px tech grid -->
            <view
              aria-hidden
              style="position: absolute; inset: 0; background-image: linear-gradient(to right, color-mix(in oklab, var(--v5-brand) 9%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--v5-brand) 9%, transparent) 1px, transparent 1px); background-size: 24px 24px; -webkit-mask-image: radial-gradient(ellipse at center, #000 35%, transparent 85%); mask-image: radial-gradient(ellipse at center, #000 35%, transparent 85%); z-index: 0; pointer-events: none"
            ></view>
            <!-- drifting dots -->
            <view aria-hidden style="position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden">
              <view v-for="(d, i) in HERO_DOTS" :key="i" :style="heroDotStyle(d)" />
            </view>

            <view class="relative" style="z-index: 1">
              <view class="flex justify-between items-center gap-2">
                <text style="font-family: var(--font-v5); font-size: 11px; font-weight: 500; color: #8B94A3; letter-spacing: 0">{{ t.earn.computeEarnings }} · {{ rangeLabel }}</text>
                <text class="font-mono-tabular" :style="usdtTagStyle">USDT</text>
              </view>

              <view class="mt-2.5 flex items-baseline gap-1" style="font-family: var(--font-amount); font-weight: 600; letter-spacing: 0; line-height: 1; color: var(--v5-ink)">
                <text style="font-family: var(--font-amount); font-size: 20px; color: var(--v5-ink-3); font-weight: 500">$</text>
                <text class="tabular-nums" style="font-family: var(--font-amount); font-size: 48px; font-weight: 600">{{ totalInt }}<text style="font-family: var(--font-amount); font-size: 32px; color: var(--v5-ink-3); font-weight: 500">.{{ totalCents }}</text></text>
              </view>
              <text class="block mt-2 tabular-nums" style="font-family: var(--font-amount); font-size: 15px; color: var(--v5-brand); font-weight: 500; letter-spacing: 0">+{{ nexFmt }} <text style="font-size: 12px; font-weight: 500; letter-spacing: 0">NEX</text></text>
              <text class="block mt-2 font-mono-tabular tabular-nums" style="font-size: 12px; color: var(--v5-ink-3)">{{ jobsText }}</text>
            </view>
          </view>
        </view>
      </view>

      <TrialGhostSlot class="mx-4" />

      <!-- My devices — same compact list as Home; rows open the detail page. -->
      <view class="mx-4">
        <MyFleetSection context="earn" :max-items="3" />
      </view>

      <ComputeShareEntry />
      <DeviceLifecycleBanner />
      <!-- Loss-aversion — moved directly above the market board -->
      <MissedIncomeBanner />
      <MarketBoard />
      <TaskCenter />
    </CardStagger>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import CardStagger from "@/components/card-stagger.vue";
import TrialGhostSlot from "@/components/trial-ghost-slot.vue";
import MissedIncomeBanner from "@/components/earn/missed-income-banner.vue";
import ComputeShareEntry from "@/components/earn/compute-share-entry.vue";
import DeviceLifecycleBanner from "@/components/earn/device-lifecycle-banner.vue";
import MarketBoard from "@/components/earn/market-board.vue";
import TaskCenter from "@/components/earn/task-center.vue";
import MyFleetSection from "@/components/home/my-fleet-section.vue";
import { useApp } from "@/store/app";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

type RangeKey = "today" | "thisWeek" | "thisMonth" | "total";
interface RangeOption {
  key: RangeKey;
  label: string;
  jobs: string;
}
const app = useApp();
const t = useT();
const range = ref<RangeKey>("today");
const ranges = computed<RangeOption[]>(() => [
  { key: "today", label: t.value.earn.todayTab, jobs: "14" },
  { key: "thisWeek", label: t.value.earn.weekTab, jobs: "98" },
  { key: "thisMonth", label: t.value.earn.monthTab, jobs: "412" },
  { key: "total", label: t.value.earn.allTab, jobs: "1,247" },
]);

// ── HERO total earned ──
const total = computed(() => {
  return app.earnings[range.value];
});
const activeRange = computed(() => ranges.value.find((r) => r.key === range.value) ?? ranges.value[0]);
const rangeLabel = computed(() => activeRange.value.label);
const totalParts = computed(() =>
  total.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split("."),
);
const totalInt = computed(() => totalParts.value[0] ?? "0");
const totalCents = computed(() => totalParts.value[1] ?? "00");
// NEX earned for the range — backend gives per-range NEX; mock scales today's NEX by the USDT ratio.
const nexTotal = computed(() => {
  const e = app.earnings;
  const ratio = e.today > 0 ? e.todayNEX / e.today : 0;
  return total.value * ratio;
});
const nexFmt = computed(() => nexTotal.value.toLocaleString(undefined, { maximumFractionDigits: 1 }));
const jobsText = computed(() => fmt(t.value.earn.jobsCount, { n: activeRange.value.jobs }));

// drifting hero dots
const HERO_DOTS = [
  { left: "12%", delay: 0, color: "#0CC4D6" },
  { left: "32%", delay: 1.6, color: "var(--v5-brand)" },
  { left: "54%", delay: 3.2, color: "var(--v5-brand-2)" },
  { left: "72%", delay: 4.8, color: "#0CC4D6" },
  { left: "88%", delay: 6.4, color: "var(--v5-brand)" },
];

// ── styles ──
const rangeBarStyle = computed<CSSProperties>(() => ({
  borderRadius: "12px",
  padding: "3px",
  gap: "2px",
}));
function pillStyle(r: RangeOption): CSSProperties {
  const on = range.value === r.key;
  return {
    height: "32px",
    border: "0",
    borderRadius: "9px",
  };
}
function pillLabelStyle(r: RangeOption): CSSProperties {
  const on = range.value === r.key;
  return {
    color: on ? "var(--v5-brand)" : "var(--v5-ink-3)",
    fontFamily: "var(--font-v5)",
    fontWeight: on ? 600 : 500,
    fontSize: "13px",
  };
}
const totalCardStyle: CSSProperties = {
  padding: "8px 2px 12px",
};
const totalAuroraStyle: CSSProperties = {
  position: "absolute",
  inset: "0",
  background:
    "radial-gradient(52% 80% at 14% 50%, color-mix(in srgb, var(--accent-purple) 45%, transparent) 0%, transparent 66%)",
  filter: "blur(24px)",
  zIndex: 0,
  pointerEvents: "none",
  animation: "v5-aurora-drift 14s ease-in-out infinite alternate",
};
function heroDotStyle(d: { left: string; delay: number; color: string }): CSSProperties {
  return {
    position: "absolute",
    bottom: "-6px",
    left: d.left,
    width: "4px",
    height: "4px",
    borderRadius: "50%",
    background: d.color,
    opacity: 0,
    animation: "v5-dot-drift 8s linear infinite",
    animationDelay: `${d.delay}s`,
  };
}
const usdtTagStyle: CSSProperties = {
  fontSize: "10px",
  padding: "1px 6px",
  borderRadius: "3px",
  background: "var(--v5-brand-soft)",
  color: "var(--v5-brand)",
  fontWeight: 500,
  letterSpacing: "0",
  whiteSpace: "nowrap",
};
</script>

<style>
:root {
  --earn-range-bg:
    radial-gradient(120% 140% at 0% 0%, rgba(77,139,255,0.12), transparent 68%),
    radial-gradient(100% 120% at 100% 100%, rgba(23,109,255,0.08), transparent 66%),
    var(--v5-surface-bg);
  --earn-range-active-bg: var(--v5-brand-soft);
}

html[data-theme="dark"] {
  --earn-range-bg: linear-gradient(180deg, #111317 0%, #15181C 100%);
  --earn-range-active-bg: rgba(158, 220, 29, 0.18);
}

.earn-range-bar {
  background: var(--earn-range-bg);
}

.earn-range-pill {
  background: transparent;
}

.earn-range-pill.is-active {
  background: var(--earn-range-active-bg);
}
</style>
