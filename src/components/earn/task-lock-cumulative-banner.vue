<!--
  TaskLockCumulativeBanner — ported from
  Nexion-prototype/app/components/task-lock-cumulative-banner.tsx.

  Surfaces the cumulative value of premium-tier tasks the user can't accept at
  their current device tier. Phase-keyed: P1-P2 ≈ $40/mo, P3-P4 ≈ $140/mo,
  P5-P6 ≈ $450/mo. Renders unconditionally (every user is missing something).
  Late-phase users (P3+) get a "Trade in" CTA → /me/devices; early phase get
  "See premium tiers" → /store. Warning-amber tone.

  Source rgba(255,190,61,…) literals → color-mix on var(--v5-warning) (token
  discipline). Interval re-render ramps the this-month number.
-->
<template>
  <view class="mx-4">
    <view class="block relative overflow-hidden rounded-2xl" :style="rootStyle" @click="goCta">
      <view class="absolute inset-0 pointer-events-none" :style="glowStyle" />

      <view class="relative flex items-center gap-1.5" :style="labelStyle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" /><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" /></svg>
        <text style="color: var(--v5-warning)">{{ t.earn.taskLockLabel }}</text>
      </view>

      <view class="relative mt-2 flex items-baseline gap-2 flex-wrap">
        <view class="flex items-baseline">
          <text class="tabular-nums" style="font-family: var(--font-v5); line-height: 1; color: var(--v5-warning); letter-spacing: -0.014em; font-size: 30px; font-weight: 600">−</text>
          <text class="tabular-nums" style="font-family: var(--font-v5); line-height: 1; font-size: 15px; font-weight: 500; color: var(--v5-warning); opacity: 0.75">$</text>
          <text class="tabular-nums" style="font-family: var(--font-v5); font-size: 30px; font-weight: 600; line-height: 1; color: var(--v5-warning); letter-spacing: -0.014em">{{ Math.round(summary.thisMonthUSD) }}</text>
        </view>
        <text class="text-[11px]" style="color: var(--v5-ink-3); line-height: 1.2">{{ t.earn.taskLockThisMonth }} · {{ examplePair }}</text>
      </view>

      <view class="relative mt-3 h-1 rounded-full overflow-hidden" style="background: var(--v5-surface-2)">
        <view class="h-full rounded-full" :style="barStyle" />
      </view>

      <view class="relative mt-4 flex items-center justify-between gap-3">
        <view class="min-w-0" style="font-size: 11px; color: var(--v5-ink-3); line-height: 1.35">
          <text class="block">{{ t.earn.taskLockCumulative }}</text>
          <text class="block tabular-nums" style="font-family: var(--font-v5); font-size: 15px; font-weight: 600; color: var(--v5-warning); margin-top: 2px">−${{ cumulativeRounded }}</text>
        </view>
        <view class="shrink-0 inline-flex items-center gap-1.5 active:scale-[0.97]" :style="ctaStyle">
          <text :style="ctaLabelStyle">{{ ctaLabel }}</text>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, type CSSProperties } from "vue";
import { useApp } from "@/store/app";
import { useT } from "@/i18n/use-t";
import { getTaskLockSummary, getInitialTaskLockSummary } from "@/store/task-lock";
import { getLockedTeasers } from "@/mock/tasks";

const ONE_MIN_MS = 60_000;

// VRAM ceiling per device kind — derives locked-teaser examples matching the
// user's current fleet.
const KIND_VRAM: Record<string, number> = {
  phone: 12,
  "stellarbox-s1": 96,
  "stellarbox-pro": 192,
  "stellarrack-p1": 640,
  "cloud-share": 12,
};

const app = useApp();
const t = useT();

const now = ref<number | null>(null);
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  now.value = Date.now();
  timer = setInterval(() => {
    now.value = Date.now();
  }, ONE_MIN_MS);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const maxVram = computed(() => {
  if (app.devices.length === 0) return KIND_VRAM.phone;
  return app.devices.reduce((m, d) => Math.max(m, KIND_VRAM[d.kind] ?? KIND_VRAM.phone), 0);
});
const teasers = computed(() => getLockedTeasers(maxVram.value, 2));

const summary = computed(() =>
  now.value === null ? getInitialTaskLockSummary() : getTaskLockSummary(app.user.joinedAt, now.value),
);

const examplePair = computed(() => {
  const list = teasers.value;
  return list.length >= 2
    ? `${list[0].model} · ${list[1].model}`
    : list[0]
      ? list[0].model
      : "Premium queue";
});

const cumulativeRounded = computed(() => Math.round(summary.value.cumulativeUSD).toLocaleString());

const isLatePhase = computed(() => {
  const id = summary.value.phase.id;
  return id === "P3" || id === "P4" || id === "P5" || id === "P6";
});
const ctaLabel = computed(() =>
  isLatePhase.value ? t.value.earn.taskLockCtaTradein : t.value.earn.taskLockCtaUpgrade,
);

function goCta() {
  const url = isLatePhase.value ? "/pages/me/devices" : "/pages/store/store";
  uni.navigateTo({ url, fail: () => {} });
}

const rootStyle: CSSProperties = {
  border: "1px solid var(--v5-border)",
  background: "linear-gradient(160deg, color-mix(in srgb, var(--v5-warning) 12%, transparent) 0%, var(--v5-surface) 70%)",
  padding: "16px",
};
const glowStyle: CSSProperties = {
  background: "radial-gradient(60% 80% at 95% 50%, color-mix(in srgb, var(--v5-warning) 18%, transparent), transparent 70%)",
};
const labelStyle: CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--v5-warning)",
  fontWeight: 500,
};
const barStyle = computed<CSSProperties>(() => ({
  width: `${Math.max(4, summary.value.monthProgress * 100)}%`,
  background: "var(--v5-warning)",
  opacity: 0.5,
}));
const ctaStyle: CSSProperties = {
  height: "36px",
  padding: "0 16px",
  borderRadius: "999px",
  background: "var(--v5-warning)",
};
const ctaLabelStyle: CSSProperties = {
  color: "var(--v5-on-brand)",
  fontSize: "12.5px",
  fontWeight: 600,
};
</script>
