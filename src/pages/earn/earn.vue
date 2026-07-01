<!--
  Earn tab — ported from Nexion-prototype/app/(main)/earn/page.tsx.
  Hybrid: V5 HERO (PillTabs + TotalEarnedCard) on top, V4 device-pool sections
  below. Conversion arc (earned → missed → trial escape → devices → fleet decay
  → market context → tier-locked tasks → footer):
    PillTabs (Today/Week/Month/All) + TotalEarnedCard (range total + breakdown)
    → MissedIncomeBanner → TrialHeroBanner / TrialGhostSlot
    → "My Devices" header + DeviceCardPC × N (active fleet only)
    → EmptySlotsHint → DeviceLifecycleBanner → MarketBoard
    → TaskCenter.

  PillTabs + TotalEarnedCard inlined here (page-specific). Wrapped in
  <AppChassis active="earn">; entrance via <CardStagger>. Reads the same
  `earnings` aggregate Home reads so the Today pill matches Home exactly.
-->
<template>
  <AppChassis active="earn">
    <CardStagger class="pt-3 pb-4 space-y-6" style="color: var(--v5-ink)">
      <!-- ===== HERO: pill tabs ===== -->
      <view class="mx-4">
        <view class="flex gap-0.5" :style="pillTrackStyle">
          <view v-for="r in RANGES" :key="r" class="flex-1 grid place-items-center active:opacity-70" :style="pillStyle(r)" @click="range = r">
            <text :style="pillLabelStyle(r)">{{ rangeLabel(r) }}</text>
          </view>
        </view>
      </view>

      <!-- ===== HERO: total earned card ===== -->
      <view class="relative mx-4">
        <view
          aria-hidden
          class="earn-money-glow"
          style="position: absolute; inset: -18px -36px -8px -4px; filter: blur(24px); z-index: 0; pointer-events: none; animation: v5-aurora-drift 14s ease-in-out infinite alternate"
        />
        <view class="relative isolate overflow-hidden" :style="totalCardStyle" style="z-index: 1">
          <view
            style="position: absolute; inset: 0; background-image: linear-gradient(to right, color-mix(in oklab, var(--v5-brand) 9%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--v5-brand) 9%, transparent) 1px, transparent 1px); background-size: 24px 24px; -webkit-mask-image: radial-gradient(ellipse at center, #000 35%, transparent 85%); mask-image: radial-gradient(ellipse at center, #000 35%, transparent 85%); z-index: 0; pointer-events: none"
          />
          <!-- drifting dots: same background system as Home today's earnings -->
          <view aria-hidden style="position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden">
            <view v-for="(d, i) in HERO_DOTS" :key="i" :style="heroDotStyle(d)" />
          </view>

          <view class="relative" style="z-index: 1">
            <view class="flex justify-between items-center gap-2">
              <text class="font-mono-tabular" style="font-size: 11px; color: #8B94A3; letter-spacing: 0.04em">{{ t.earn.computeEarned }} · {{ rangeLabel(range) }}</text>
              <text class="font-mono-tabular" :style="usdtTagStyle">USDT</text>
            </view>

            <view class="mt-2.5 flex items-baseline gap-1" style="font-family: var(--font-amount); font-weight: 600; letter-spacing: -0.024em; line-height: 1; color: var(--v5-ink)">
              <text style="font-size: 20px; color: var(--v5-ink-3); font-weight: 500">$</text>
              <text class="tabular-nums" style="font-size: 48px">{{ totalInt }}<text style="font-size: 32px; color: var(--v5-ink-3); font-weight: 600">.{{ totalCents }}</text></text>
            </view>
            <text class="block mt-2 font-mono-tabular tabular-nums" style="font-size: 15px; color: var(--v5-brand); font-weight: 600">+{{ nexFmt }} <text style="font-size: 12px; font-weight: 500; letter-spacing: 0.06em">NEX</text></text>
            <text class="block mt-2 font-mono-tabular tabular-nums" style="font-size: 12px; color: #8B94A3">{{ jobsText }}</text>
          </view>
        </view>
      </view>

      <!-- Loss-aversion pair -->
      <MissedIncomeBanner />

      <!-- Trial entries -->
      <view class="mx-4">
        <TrialHeroBanner class="w-full" />
      </view>
      <TrialGhostSlot class="mx-4" />

      <!-- My devices header -->
      <view class="mx-4 mt-2 mb-1 px-1 flex items-center justify-between">
        <text style="font-family: var(--font-v5); font-size: 15px; font-weight: 600; color: var(--v5-ink); letter-spacing: -0.012em">{{ t.earn.myDevices }}</text>
        <text class="tabular-nums" style="font-family: var(--font-v5); font-size: 11.5px; color: var(--v5-ink-4)">{{ devices.length + trialSlot }} / {{ MAX_DEVICES }}</text>
      </view>
      <DeviceCardPC v-for="d in devices" :key="d.id" :device="d" />

      <EmptySlotsHint />
      <DeviceLifecycleBanner />
      <MarketBoard />
      <TaskCenter />
    </CardStagger>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import CardStagger from "@/components/card-stagger.vue";
import TrialHeroBanner from "@/components/trial-hero-banner.vue";
import TrialGhostSlot from "@/components/trial-ghost-slot.vue";
import DeviceCardPC from "@/components/earn/device-card-pc.vue";
import MissedIncomeBanner from "@/components/earn/missed-income-banner.vue";
import EmptySlotsHint from "@/components/earn/empty-slots-hint.vue";
import DeviceLifecycleBanner from "@/components/earn/device-lifecycle-banner.vue";
import MarketBoard from "@/components/earn/market-board.vue";
import TaskCenter from "@/components/earn/task-center.vue";
import { useApp } from "@/store/app";
import { MAX_DEVICES } from "@/store/device-types";
import { trialReservesSlotNow } from "@/store/free-trial";
import { useTheme } from "@/store/theme";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

type Range = "Today" | "Week" | "Month" | "All";
const RANGES: Range[] = ["Today", "Week", "Month", "All"];

const app = useApp();
const t = useT();
const theme = useTheme();
const range = ref<Range>("Today");

function rangeLabel(r: Range): string {
  return r === "Today" ? t.value.earn.todayTab
    : r === "Week" ? t.value.earn.weekTab
      : r === "Month" ? t.value.earn.monthTab
        : t.value.earn.allTab;
}

// Earn shows ACTIVE fleet only (inventory lives in /me/devices).
const devices = computed(() => app.devices.filter((d) => d.activatedAt !== null));
const trialSlot = computed(() => (trialReservesSlotNow() ? 1 : 0));

// ── HERO total earned ──
const total = computed(() => {
  const e = app.earnings;
  return range.value === "Today" ? e.today
    : range.value === "Week" ? e.thisWeek
      : range.value === "Month" ? e.thisMonth
        : e.total;
});
const totalInt = computed(() => Math.floor(total.value).toLocaleString());
const totalCents = computed(() => String(Math.floor(total.value * 100) % 100).padStart(2, "0"));
// NEX earned for the range — backend gives per-range NEX; mock scales today's NEX by the USDT ratio.
const nexTotal = computed(() => {
  const e = app.earnings;
  const ratio = e.today > 0 ? e.todayNEX / e.today : 0;
  return total.value * ratio;
});
const nexFmt = computed(() => nexTotal.value.toLocaleString(undefined, { maximumFractionDigits: 1 }));
const jobsText = computed(() =>
  fmt(t.value.earn.jobsCount, {
    n: range.value === "Today" ? "14"
      : range.value === "Week" ? "98"
        : range.value === "Month" ? "412"
          : "1,247",
  }),
);

// drifting hero dots
const HERO_DOTS = [
  { left: "12%", delay: 0, color: "var(--v5-tech-cyan)" },
  { left: "32%", delay: 1.6, color: "var(--v5-brand)" },
  { left: "54%", delay: 3.2, color: "var(--v5-brand-2)" },
  { left: "72%", delay: 4.8, color: "var(--v5-tech-cyan)" },
  { left: "88%", delay: 6.4, color: "var(--v5-brand)" },
];

// ── styles ──
const pillTrackStyle = computed<CSSProperties>(() => (
  theme.mode === "dark"
    ? { background: "linear-gradient(180deg, #111317 0%, #15181C 100%)", borderRadius: "14px", padding: "3px" }
    : { background: "var(--v5-surface-2)", borderRadius: "12px", padding: "3px" }
));
function pillStyle(r: Range): CSSProperties {
  const on = range.value === r;
  if (theme.mode !== "dark") {
    return {
      height: "40px",
      minHeight: "40px",
      background: on ? "var(--v5-brand-soft)" : "transparent",
      border: "1px solid transparent",
      borderRadius: "9px",
    };
  }
  return {
    height: "40px",
    minHeight: "40px",
    background: on ? "rgba(158, 220, 29, 0.18)" : "transparent",
    border: "1px solid transparent",
    borderRadius: "11px",
  };
}
function pillLabelStyle(r: Range): CSSProperties {
  const on = range.value === r;
  if (theme.mode !== "dark") {
    return {
      color: on ? "var(--v5-brand)" : "var(--v5-ink-3)",
      fontFamily: "var(--font-v5)",
      fontWeight: on ? 600 : 500,
      fontSize: "13px",
    };
  }
  return {
    color: on ? "var(--v5-brand)" : "#9BA3B5",
    fontFamily: "var(--font-v5)",
    fontWeight: on ? 600 : 500,
    fontSize: "13px",
  };
}
const totalCardStyle: CSSProperties = {
  padding: "8px 2px 12px",
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
  lineHeight: 1.1,
  padding: "1px 6px",
  borderRadius: "3px",
  background: "var(--v5-brand-soft)",
  color: "var(--v5-brand)",
  fontWeight: 500,
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
};
</script>

<style scoped>
.earn-money-glow {
  background: radial-gradient(52% 80% at 14% 50%, color-mix(in srgb, #8E72FF 34%, transparent) 0%, transparent 66%);
}
</style>
