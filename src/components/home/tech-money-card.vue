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
    class="relative isolate"
    style="padding: 8px 2px 12px"
  >
    <!-- Left purple glow — soft radial, blurred so its edges feather into the black page bg -->
    <view
      class="tech-money-glow"
      style="position: absolute; inset: 0; filter: blur(24px); z-index: 0; pointer-events: none; animation: v5-aurora-drift 14s ease-in-out infinite alternate"
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
        <text style="font-family: var(--font-v5); font-weight: 600; font-size: 15px; color: var(--v5-ink); letter-spacing: -0.012em">{{ t.home.techTodaysEarnings }}</text>
        <view
          class="tech-money-live inline-flex items-center font-mono-tabular"
          style="gap: 6px; font-size: 10.5px; padding: 2px 7px; border-radius: 4px; font-weight: 500; letter-spacing: 0.04em; white-space: nowrap"
          :style="{ background: liveBg, color: liveColor }"
        >
          <PulseDot class="tech-money-live__dot" color="currentColor" :size="5" />
          <text class="tech-money-live__text">{{ t.home.techStreaming }}</text>
        </view>
      </view>

      <view
        class="mt-2.5 flex items-baseline gap-1"
        style="font-family: var(--font-amount); font-weight: 600; letter-spacing: -0.024em; line-height: 1; color: var(--v5-ink)"
      >
        <text style="font-size: 20px; color: var(--v5-ink-3); font-weight: 500">$</text>
        <text class="tabular-nums" style="font-size: 48px">{{ intPart }}<text style="font-size: 32px; color: var(--v5-ink-3); font-weight: 600">.{{ cents }}</text></text>
      </view>

      <text class="block mt-2 font-mono-tabular tabular-nums" style="font-size: 12px; color: var(--v5-success)">{{ t.home.techVsYesterday }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { useCommission } from "@/store/commission";
import { useTheme } from "@/store/theme";
import { useTicker } from "@/composables/use-ticker";
import PulseDot from "./pulse-dot.vue";

const t = useT();
const app = useApp();
const commission = useCommission();
const theme = useTheme();

const earningsToday = computed(() => app.earnings.today);
const commissionToday = computed(() => commission.todayUSDT());
const todayTotal = computed(() => earningsToday.value + commissionToday.value);

// Streaming number — ticks up; resyncs on a material jump (new commission / day rollover).
const display = useTicker(() => Math.max(todayTotal.value, 0.06), 0.0009, 1100);
const intPart = computed(() => Math.floor(display.value));
const cents = computed(() => String(Math.floor(display.value * 100) % 100).padStart(2, "0"));
const liveColor = computed(() => (theme.mode === "dark" ? "#8e72ff" : "var(--v5-success)"));
const liveBg = computed(() => (theme.mode === "dark" ? "rgba(142, 114, 255, 0.2)" : "var(--v5-success-soft)"));

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

<style scoped>
.tech-money-glow {
  background: radial-gradient(52% 80% at 14% 50%, color-mix(in srgb, var(--accent-purple) 45%, transparent) 0%, transparent 66%);
}

.tech-money-live {
  background: var(--v5-success-soft);
  color: var(--v5-success);
}

.tech-money-live__text {
  color: currentColor;
}

:global(html[data-theme="dark"]) .tech-money-live {
  background: rgba(142, 114, 255, 0.2);
  color: #8e72ff;
}

:global(html:not([data-theme="dark"])) .tech-money-glow {
  background: radial-gradient(52% 80% at 14% 50%, color-mix(in srgb, #246BFE 32%, transparent) 0%, transparent 66%);
}

:global(html:not([data-theme="dark"])) .tech-money-live {
  background: var(--v5-success-soft);
  color: var(--v5-success);
}
</style>
