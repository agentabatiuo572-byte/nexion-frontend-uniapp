<!--
  Earn tab — ported from Nexion-prototype/app/(main)/earn/page.tsx.
  Hybrid: V5 HERO (PillTabs + TotalEarnedCard) on top, V4 device-pool sections
  below. Conversion arc (earned → missed → trial escape → devices → fleet decay
  → market context → tier-locked tasks → footer):
    PillTabs (Today/Week/Month/All) + TotalEarnedCard (range total + breakdown)
    → MissedIncomeBanner → TrialHeroBanner / TrialGhostSlot
    → "My Devices" header + DeviceCardPC × N (active fleet only)
    → EmptySlotsHint → DeviceLifecycleBanner → MarketBoard
    → TaskLockCumulativeBanner → TaskCenter.

  PillTabs + TotalEarnedCard inlined here (page-specific). Wrapped in
  <AppChassis active="earn">; entrance via <CardStagger>. Reads the same
  `earnings` aggregate Home reads so the Today pill matches Home exactly.
-->
<template>
  <AppChassis active="earn">
    <CardStagger class="pt-3 pb-4 space-y-3" style="color: var(--v5-ink)">
      <!-- ===== HERO: pill tabs ===== -->
      <view class="mx-4">
        <view class="flex gap-0.5" style="background: var(--v5-surface-2); border-radius: 12px; padding: 3px">
          <view v-for="r in RANGES" :key="r" class="flex-1 grid place-items-center active:opacity-70" :style="pillStyle(r)" @click="range = r">
            <text :style="pillLabelStyle(r)">{{ r }}</text>
          </view>
        </view>
      </view>

      <!-- ===== HERO: total earned card ===== -->
      <view class="mx-4">
        <view class="relative overflow-hidden" :style="totalCardStyle">
          <!-- aurora -->
          <view aria-hidden :style="auroraStyle" />
          <!-- drifting dots -->
          <view aria-hidden style="position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden">
            <view v-for="(d, i) in HERO_DOTS" :key="i" :style="heroDotStyle(d)" />
          </view>

          <view class="relative" style="z-index: 1">
            <view class="flex justify-between items-center gap-2">
              <text class="font-mono-tabular" style="font-size: 11px; color: var(--v5-ink-4); letter-spacing: 0.04em">Compute earned · {{ rangeKey }}</text>
              <text class="font-mono-tabular" :style="usdtTagStyle">USDT</text>
            </view>

            <view class="mt-2.5 flex items-baseline gap-1" style="font-family: var(--font-v5); font-weight: 600; letter-spacing: -0.024em; line-height: 1; color: var(--v5-ink)">
              <text style="font-size: 22px; color: var(--v5-ink-3); font-weight: 500">$</text>
              <text class="tabular-nums" style="font-size: 48px">{{ totalInt }}<text style="font-size: 32px; color: var(--v5-ink-3); font-weight: 600">.{{ totalCents }}</text></text>
            </view>
            <text class="block mt-2 font-mono-tabular tabular-nums" style="font-size: 12px; color: var(--v5-success)">↑ {{ deltaPct }} · {{ jobsLine }}</text>

            <!-- breakdown -->
            <view class="mt-3.5 pt-3.5" style="border-top: 1px dashed var(--v5-border-strong)">
              <view class="flex h-1 rounded-full overflow-hidden" style="background: var(--v5-surface-3); opacity: 0.7">
                <view :style="{ flex: 76, background: 'var(--v5-success)' }" />
                <view :style="{ flex: 24, background: 'var(--v5-brand)' }" />
              </view>
              <view class="mt-3 grid grid-cols-2 gap-2.5">
                <view>
                  <view class="flex items-center gap-1.5">
                    <view style="width: 7px; height: 7px; border-radius: 2px; background: var(--v5-success)" />
                    <text class="font-mono-tabular" style="font-size: 12px; color: var(--v5-ink-3)">{{ t.earn.breakdownProduction }}</text>
                  </view>
                  <text class="block tabular-nums" :style="breakdownValStyle('var(--v5-ink)')">${{ fmtMoney(total * 0.76) }}</text>
                  <text class="block font-mono-tabular" style="font-size: 12px; color: var(--v5-ink-4); margin-top: 1px">{{ t.earn.breakdownProductionSub }}</text>
                </view>
                <view>
                  <view class="flex items-center gap-1.5">
                    <view style="width: 7px; height: 7px; border-radius: 2px; background: var(--v5-brand)" />
                    <text class="font-mono-tabular" style="font-size: 12px; color: var(--v5-ink-3)">AI Premium</text>
                  </view>
                  <text class="block tabular-nums" :style="breakdownValStyle('var(--v5-brand)')">${{ fmtMoney(total * 0.24) }}</text>
                  <text class="block font-mono-tabular" style="font-size: 12px; color: var(--v5-ink-4); margin-top: 1px">{{ t.earn.breakdownPremiumSub }}</text>
                </view>
              </view>
            </view>
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
        <text style="font-family: var(--font-v5); font-size: 13.5px; font-weight: 600; color: var(--v5-ink-3); letter-spacing: -0.01em">{{ t.earn.myDevices }}</text>
        <text class="tabular-nums" style="font-family: var(--font-v5); font-size: 11.5px; color: var(--v5-ink-4)">{{ devices.length + trialSlot }} / {{ MAX_DEVICES }}</text>
      </view>
      <DeviceCardPC v-for="d in devices" :key="d.id" :device="d" />

      <EmptySlotsHint />
      <DeviceLifecycleBanner />
      <MarketBoard />
      <TaskLockCumulativeBanner />
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
import TaskLockCumulativeBanner from "@/components/earn/task-lock-cumulative-banner.vue";
import TaskCenter from "@/components/earn/task-center.vue";
import { useApp } from "@/store/app";
import { MAX_DEVICES } from "@/store/device-types";
import { trialReservesSlotNow } from "@/store/free-trial";
import { useT } from "@/i18n/use-t";

type Range = "Today" | "Week" | "Month" | "All";
const RANGES: Range[] = ["Today", "Week", "Month", "All"];

const app = useApp();
const t = useT();
const range = ref<Range>("Today");

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
const rangeKey = computed(() => range.value.toLowerCase());
const totalInt = computed(() => Math.floor(total.value).toLocaleString());
const totalCents = computed(() => String(Math.floor(total.value * 100) % 100).padStart(2, "0"));
const jobsLine = computed(() =>
  range.value === "Today" ? "14 jobs · 7d streak"
    : range.value === "Week" ? "98 jobs · 7d streak"
      : range.value === "Month" ? "412 jobs · 7d streak"
        : "1,247 jobs",
);
const deltaPct = computed(() =>
  range.value === "Today" ? "+5.2%"
    : range.value === "Week" ? "+8.1%"
      : range.value === "Month" ? "+12.4%"
        : "+47.3%",
);

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// drifting hero dots
const HERO_DOTS = [
  { left: "12%", delay: 0, color: "var(--v5-tech-cyan)" },
  { left: "32%", delay: 1.6, color: "var(--v5-brand)" },
  { left: "54%", delay: 3.2, color: "var(--v5-brand-2)" },
  { left: "72%", delay: 4.8, color: "var(--v5-tech-cyan)" },
  { left: "88%", delay: 6.4, color: "var(--v5-brand)" },
];

// ── styles ──
function pillStyle(r: Range): CSSProperties {
  const on = range.value === r;
  return {
    height: "32px",
    background: on ? "var(--v5-brand-soft)" : "transparent",
    border: "1px solid transparent",
    borderRadius: "9px",
  };
}
function pillLabelStyle(r: Range): CSSProperties {
  const on = range.value === r;
  return {
    color: on ? "var(--v5-brand)" : "var(--v5-ink-3)",
    fontFamily: "var(--font-v5)",
    fontWeight: on ? 600 : 500,
    fontSize: "13px",
  };
}
const totalCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  padding: "18px 18px 20px",
  boxShadow: "var(--v5-card-shadow-lift-strong)",
};
const auroraStyle: CSSProperties = {
  position: "absolute",
  inset: "-30% -10% auto -10%",
  height: "220%",
  background: "var(--v5-earn-aurora)",
  filter: "blur(14px)",
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
  fontSize: "10.5px",
  padding: "2px 7px",
  borderRadius: "4px",
  background: "var(--v5-brand-soft)",
  color: "var(--v5-brand)",
  fontWeight: 500,
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
};
function breakdownValStyle(color: string): CSSProperties {
  return {
    marginTop: "4px",
    fontFamily: "var(--font-v5)",
    fontWeight: 600,
    fontSize: "15px",
    color,
    letterSpacing: "-0.010em",
  };
}
</script>
