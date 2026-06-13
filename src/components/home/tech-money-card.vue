<!--
  TechMoneyCard — ZONE 1 home hero "Today's earnings" (ported from
  mission-control.tsx TechMoneyCard). CROSS-STREAM aggregate: device mining
  (earnings.today) + team commission credited since midnight (commission
  .todayUSDT()). surface-2 base + aurora + tech-grid + drifting dots make it the
  conversion focal point. Big streaming number + peer-avg / payback footer.
  Source hardcoded the labels; ported to t.home.tech* for bilingual parity.
-->
<template>
  <view
    class="relative overflow-hidden isolate"
    style="background: var(--v5-surface-2); border: 1px solid var(--v5-border-strong); border-radius: 16px; padding: 18px 18px 20px; box-shadow: var(--v5-card-shadow-lift-strong)"
  >
    <!-- Aurora wash (lemon top-right = conversion magnet per dark SKILL) -->
    <view
      style="position: absolute; inset: -30% -10% auto -10%; height: 220%; background: var(--v5-money-aurora); filter: blur(14px); z-index: 0; pointer-events: none; animation: v5-aurora-drift 14s ease-in-out infinite alternate"
    />
    <!-- Tech grid (brand-tinted, masked) -->
    <view
      style="position: absolute; inset: 0; background-image: linear-gradient(to right, color-mix(in oklab, var(--v5-brand) 9%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--v5-brand) 9%, transparent) 1px, transparent 1px); background-size: 24px 24px; -webkit-mask-image: radial-gradient(ellipse at center, #000 35%, transparent 85%); mask-image: radial-gradient(ellipse at center, #000 35%, transparent 85%); z-index: 0; pointer-events: none"
    />
    <!-- Drifting dots -->
    <view style="position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden">
      <view v-for="(d, i) in dots" :key="i" :style="dotStyle(d)" />
    </view>

    <view class="relative" style="z-index: 1">
      <view class="flex justify-between items-center gap-2">
        <text class="font-mono-tabular" style="font-size: 11px; color: var(--v5-ink-4); letter-spacing: 0.04em">{{ t.home.techTodaysEarnings }}</text>
        <text
          class="inline-flex items-center gap-1 font-mono-tabular"
          style="font-size: 10.5px; padding: 2px 7px; border-radius: 4px; background: var(--v5-tech-cyan-soft); color: var(--v5-tech-cyan); font-weight: 500; letter-spacing: 0.04em; white-space: nowrap"
        >{{ t.home.techStreaming }}</text>
      </view>

      <view
        class="mt-2.5 flex items-baseline gap-1"
        style="font-family: var(--font-v5); font-weight: 600; letter-spacing: -0.024em; line-height: 1; color: var(--v5-ink)"
      >
        <text style="font-size: 22px; color: var(--v5-ink-3); font-weight: 500">$</text>
        <text class="tabular-nums" style="font-size: 48px">{{ intPart }}<text style="font-size: 32px; color: var(--v5-ink-3); font-weight: 600">.{{ cents }}</text></text>
      </view>

      <text class="block mt-2 font-mono-tabular tabular-nums" style="font-size: 12px; color: var(--v5-success)">{{ t.home.techVsYesterday }}</text>

      <view
        class="mt-4 pt-3.5 grid gap-3.5"
        style="border-top: 2px solid rgba(255,255,255,0.12); box-shadow: inset 0 1px 0 rgba(0,0,0,0.45); grid-template-columns: 1fr 1fr"
      >
        <view>
          <text class="block font-mono-tabular" style="font-size: 11px; color: var(--v5-ink-4)">{{ peerAvgText }}</text>
          <text class="block tabular-nums" style="margin-top: 3px; font-family: var(--font-v5); font-weight: 500; font-size: 14px; color: var(--v5-tech-cyan)">{{ peerDailyText }}</text>
        </view>
        <view>
          <text class="block font-mono-tabular" style="font-size: 11px; color: var(--v5-ink-4)">{{ t.home.techPayback }}</text>
          <text class="block tabular-nums" style="margin-top: 3px; font-family: var(--font-v5); font-weight: 500; font-size: 14px; color: var(--v5-brand-2)">{{ paybackText }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useCommission } from "@/store/commission";
import { derivePromoUpgrade } from "@/store/device-types";
import { useTicker } from "@/composables/use-ticker";

const t = useT();
const app = useApp();
const commission = useCommission();

const earningsToday = computed(() => app.earnings.today);
const commissionToday = computed(() => commission.todayUSDT());
const promo = computed(() => derivePromoUpgrade(app.devices));
const todayTotal = computed(() => earningsToday.value + commissionToday.value);

// Streaming number — ticks up; resyncs on a material jump (new commission / day rollover).
const display = useTicker(() => Math.max(todayTotal.value, 0.06), 0.0009, 1100);
const intPart = computed(() => Math.floor(display.value));
const cents = computed(() => String(Math.floor(display.value * 100) % 100).padStart(2, "0"));

const peerAvgText = computed(() => fmt(t.value.home.techPeerAvg, { name: promo.value.targetName }));
const peerDailyText = computed(() => `$${promo.value.targetDaily.toFixed(2)}/d`);
const paybackText = computed(() => fmt(t.value.home.techPaybackDays, { n: promo.value.targetPayback }));

interface Dot {
  left: string;
  delay: number;
  color: string;
}
const dots: Dot[] = [
  { left: "12%", delay: 0, color: "var(--v5-tech-cyan)" },
  { left: "32%", delay: 1.6, color: "var(--v5-brand)" },
  { left: "54%", delay: 3.2, color: "var(--v5-brand-2)" },
  { left: "72%", delay: 4.8, color: "var(--v5-tech-cyan)" },
  { left: "88%", delay: 6.4, color: "var(--v5-brand)" },
];
function dotStyle(d: Dot): CSSProperties {
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
</script>
