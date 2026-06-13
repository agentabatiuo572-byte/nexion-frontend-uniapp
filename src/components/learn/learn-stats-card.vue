<!--
  LearnStatsCard — "Your Learning" stats summary (ported from StatsCard in
  Nexion-prototype/app/(main)/learn/page.tsx).

  Surface w/ brand-2 radial glow + grad-cap icon + completed N/total row +
  earned-NEX right column + scroll-grow completion bar.
-->
<template>
  <view class="rounded-2xl" :style="cardStyle">
    <view class="flex items-center" style="gap: 12px">
      <view class="grid place-items-center shrink-0" :style="iconBoxStyle">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" /><path d="M22 10v6" /><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" /></svg>
      </view>
      <view class="flex-1 min-w-0">
        <text class="block font-mono-tabular" style="font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--v5-brand-2)">{{ t.learn.progressLabel }}</text>
        <text class="block" style="font-size: 12.5px; color: var(--v5-ink); margin-top: 2px">{{ completedRow }}</text>
      </view>
      <view style="text-align: right">
        <text class="block tabular-nums" style="font-size: 18px; font-weight: 600; color: var(--v5-brand); line-height: 1">+{{ earned }}</text>
        <text class="block" style="font-size: 10px; color: var(--v5-ink-3); margin-top: 4px">NEX earned</text>
      </view>
    </view>
    <view ref="barEl" class="mt-3 rounded-full overflow-hidden" style="height: 6px; background: var(--v5-surface-2)">
      <view class="h-full rounded-full" :style="barFillStyle" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useScrollGrowProgress, PROGRESS_GROW_TRANSITION } from "@/composables/use-scroll-grow-progress";

const props = defineProps<{ done: number; total: number; earned: number }>();

const t = useT();
const { elRef: barEl, inView: barInView } = useScrollGrowProgress();

const pct = computed(() => (props.total > 0 ? Math.min(100, (props.done / props.total) * 100) : 0));
const completedRow = computed(() => fmt(t.value.learn.completedRow, { n: props.done, total: props.total }));

const cardStyle: CSSProperties = {
  background:
    "radial-gradient(80% 60% at 80% 0%, color-mix(in oklab, var(--v5-brand-2) 14%, transparent) 0%, transparent 65%), var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  boxShadow: "var(--v5-card-shadow-lift-strong)",
  padding: "16px",
};
const iconBoxStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "12px",
  background: "color-mix(in srgb, var(--v5-brand-2) 22%, transparent)",
};
const barFillStyle = computed<CSSProperties>(() => ({
  width: `${barInView.value ? pct.value : 0}%`,
  background: "linear-gradient(90deg, var(--v5-tech-cyan), var(--v5-brand))",
  transition: barInView.value ? PROGRESS_GROW_TRANSITION : "none",
  willChange: "width",
}));
</script>
