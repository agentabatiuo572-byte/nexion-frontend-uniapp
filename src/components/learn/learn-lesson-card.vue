<!--
  LearnLessonCard — single lesson row card (ported from LessonCard in
  Nexion-prototype/app/(main)/learn/page.tsx).

  Surface + left tint hairline + emoji chip + category/format/level cap +
  title + subtitle + status chip (completed / %% in-progress / chevron) +
  bottom reward + duration + scroll-grow progress (in-progress only).
  lesson.tint hex used at runtime in color-mix (data value). Tappable →
  navigate to lesson.href (no-op if not yet ported).
-->
<template>
  <view class="block relative rounded-2xl overflow-hidden active:opacity-95" :style="cardStyle" @click="open">
    <!-- left tint hairline -->
    <view aria-hidden class="absolute" :style="hairlineStyle" />

    <view style="padding: 14px">
      <!-- HEADER row -->
      <view class="flex items-start" style="gap: 12px">
        <view class="grid place-items-center shrink-0" :style="emojiChipStyle">
          <text style="font-size: 22px">{{ lesson.emoji }}</text>
        </view>
        <view class="flex-1 min-w-0">
          <text class="block font-mono-tabular" :style="catLineStyle">{{ catLabel }}<text style="color: var(--v5-ink-4)"> · {{ formatLabel }} · {{ levelLabel }}</text></text>
          <text class="block" :style="titleStyle">{{ lesson.title }}</text>
          <text class="block" :style="subtitleStyle">{{ lesson.subtitle }}</text>
        </view>
        <!-- status chip -->
        <view v-if="statusChip" class="shrink-0 inline-flex items-center font-mono-tabular tabular-nums" :style="chipStyle">
          <svg v-if="statusChip.icon === 'check'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px"><path d="M20 6 9 17l-5-5" /></svg>
          <svg v-else-if="statusChip.icon === 'play'" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right: 4px"><path d="M6 3v18l15-9z" /></svg>
          <text>{{ statusChip.label }}</text>
        </view>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" style="margin-top: 2px"><path d="m9 18 6-6-6-6" /></svg>
      </view>

      <!-- REWARD + DURATION + PROGRESS row -->
      <view class="mt-3 flex items-center" style="gap: 12px">
        <view class="inline-flex items-center shrink-0" :style="rewardStyle">
          <text style="margin-right: 6px">🎁</text>
          <text>+{{ lesson.rewardNEX }} NEX</text>
        </view>
        <view v-if="inProgress" class="flex-1 flex items-center min-w-0" style="gap: 8px">
          <view ref="barEl" class="flex-1 rounded-full overflow-hidden" style="height: 4px; background: var(--v5-surface-2)">
            <view class="h-full rounded-full" :style="barFillStyle" />
          </view>
          <text class="font-mono-tabular tabular-nums shrink-0" style="font-size: 10px; color: var(--v5-ink-3)">{{ lesson.durationMin }} {{ t.learn.minRead }}</text>
        </view>
        <view v-else class="flex-1 flex items-center justify-end">
          <text class="font-mono-tabular tabular-nums" style="font-size: 10.5px; color: var(--v5-ink-3)">⏱ {{ lesson.durationMin }} {{ t.learn.minRead }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { useScrollGrowProgress, PROGRESS_GROW_TRANSITION } from "@/composables/use-scroll-grow-progress";
import { CATEGORIES, FORMAT_LABEL, type Lesson } from "@/mock/learn";

const props = defineProps<{ lesson: Lesson }>();

const t = useT();
const { elRef: barEl, inView: barInView } = useScrollGrowProgress();

const done = computed(() => props.lesson.progress >= 100);
const inProgress = computed(() => props.lesson.progress > 0 && props.lesson.progress < 100);
const progressPct = computed(() => Math.max(0, Math.min(100, props.lesson.progress)));
const cat = computed(() => CATEGORIES.find((c) => c.id === props.lesson.category)!);
const catLabel = computed(() => cat.value.label);
const formatLabel = computed(() => FORMAT_LABEL[props.lesson.format]);
const levelLabel = computed(() => {
  const labels = t.value.learn.levelLabel as Record<number, string>;
  return labels[props.lesson.level];
});

interface StatusChip { label: string; color: string; bg: string; icon?: "check" | "play" }
const statusChip = computed<StatusChip | null>(() => {
  if (done.value) {
    return { label: t.value.learn.completedChip, color: "var(--v5-brand)", bg: "var(--v5-brand-soft)", icon: "check" };
  }
  if (inProgress.value) {
    return {
      label: `${progressPct.value}%`,
      color: props.lesson.tint,
      bg: `color-mix(in srgb, ${props.lesson.tint} 10%, transparent)`,
      icon: "play",
    };
  }
  return null;
});

function open() {
  if (props.lesson.href) uni.navigateTo({ url: props.lesson.href, fail: () => {} });
}

const cardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
const hairlineStyle = computed<CSSProperties>(() => ({
  top: "0",
  left: "0",
  bottom: "0",
  width: "2px",
  background: `linear-gradient(180deg, transparent, ${props.lesson.tint}, transparent)`,
  opacity: 0.85,
}));
const emojiChipStyle = computed<CSSProperties>(() => ({
  width: "40px",
  height: "40px",
  borderRadius: "8px",
  background: `color-mix(in srgb, ${props.lesson.tint} 8%, transparent)`,
}));
const catLineStyle = computed<CSSProperties>(() => ({
  fontSize: "10px",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: props.lesson.tint,
  opacity: 0.85,
}));
const titleStyle: CSSProperties = {
  marginTop: "2px",
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  lineHeight: 1.15,
};
const subtitleStyle: CSSProperties = {
  fontSize: "11.5px",
  color: "var(--v5-ink-3)",
  marginTop: "2px",
  lineHeight: 1.35,
};
const chipStyle = computed<CSSProperties>(() => ({
  padding: "4px 8px",
  borderRadius: "6px",
  fontSize: "10.5px",
  fontWeight: 500,
  whiteSpace: "nowrap",
  background: statusChip.value!.bg,
  color: statusChip.value!.color,
}));
const rewardStyle = computed<CSSProperties>(() => ({
  fontSize: "12px",
  fontWeight: 600,
  color: props.lesson.tint,
  fontFamily: "var(--font-v5)",
}));
const barFillStyle = computed<CSSProperties>(() => ({
  width: `${barInView.value ? progressPct.value : 0}%`,
  background: props.lesson.tint,
  transition: barInView.value ? PROGRESS_GROW_TRANSITION : "none",
  willChange: "width",
}));
</script>
