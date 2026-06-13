<!--
  LearnFeaturedHero — featured-lesson hero card (ported from the FeaturedHero
  in Nexion-prototype/app/(main)/learn/page.tsx).

  Surface w/ radial brand glow (lesson.tint) + top hairline + cap label +
  duration/format + title + emoji + reward pill + scroll-grow progress bar +
  CTA pill (start / continue / review by progress). lesson.tint hex used at
  runtime in color-mix/gradients (data value, not a theme token). The whole
  card is tappable → navigate to lesson.href (no-op if not yet ported).
-->
<template>
  <view class="block relative overflow-hidden rounded-2xl active:opacity-95" :style="cardStyle" @click="open">
    <!-- top hairline -->
    <view aria-hidden :style="hairlineStyle" />

    <view class="relative" style="padding: 20px">
      <!-- TOP — cap label + duration/format -->
      <view class="flex items-center justify-between">
        <view class="inline-flex items-center font-mono-tabular" :style="capLabelStyle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>
          {{ t.learn.heroLabel }}
        </view>
        <view class="inline-flex items-center font-mono-tabular tabular-nums" style="font-size: 11px; color: var(--v5-ink-2)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          <text>{{ lesson.durationMin }} {{ t.learn.minRead }}</text>
          <text style="color: var(--v5-ink-4)"> · {{ formatLabel }}</text>
        </view>
      </view>

      <!-- HERO row — title + emoji -->
      <view class="mt-4 flex items-start justify-between" style="gap: 12px">
        <view class="flex-1 min-w-0">
          <text class="block" :style="titleStyle">{{ lesson.title }}</text>
          <text class="block" style="font-size: 12.5px; color: var(--v5-ink-3); margin-top: 6px; line-height: 1.35">{{ lesson.subtitle }}</text>
        </view>
        <text aria-hidden class="shrink-0" style="font-size: 44px; line-height: 1">{{ lesson.emoji }}</text>
      </view>

      <!-- REWARD pill -->
      <view class="mt-4 inline-flex items-center" :style="rewardPillStyle">
        <text style="font-size: 14px; margin-right: 6px">🎁</text>
        <text style="font-family: var(--font-v5)">{{ t.learn.reward }} +{{ lesson.rewardNEX }} NEX</text>
      </view>

      <!-- PROGRESS -->
      <view v-if="showProgress" class="mt-4">
        <view class="flex items-center justify-between font-mono-tabular" style="font-size: 10.5px; margin-bottom: 6px">
          <text style="color: var(--v5-ink-3); text-transform: uppercase; letter-spacing: 0.08em">{{ t.learn.progressLabel }}</text>
          <text class="tabular-nums" :style="{ color: lesson.tint, fontWeight: 600 }">{{ progressPct }}%</text>
        </view>
        <view ref="barEl" class="h-2 rounded-full overflow-hidden" style="background: var(--v5-surface-2)">
          <view class="h-full rounded-full" :style="barFillStyle" />
        </view>
      </view>

      <!-- CTA pill -->
      <view class="mt-5 w-full rounded-full flex items-center justify-center" :style="ctaStyle">
        <svg v-if="lesson.progress >= 100" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M20 6 9 17l-5-5" /></svg>
        <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="var(--v5-on-brand)" stroke="none" style="margin-right: 6px"><path d="M6 3v18l15-9z" /></svg>
        <text style="font-size: 14px; font-weight: 600; color: var(--v5-on-brand)">{{ ctaLabel }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { useScrollGrowProgress, PROGRESS_GROW_TRANSITION } from "@/composables/use-scroll-grow-progress";
import { FORMAT_LABEL, type Lesson } from "@/mock/learn";

const props = defineProps<{ lesson: Lesson }>();

const t = useT();
const { elRef: barEl, inView: barInView } = useScrollGrowProgress();

const progressPct = computed(() => Math.max(0, Math.min(100, props.lesson.progress)));
const showProgress = computed(() => progressPct.value > 0 && progressPct.value < 100);
const formatLabel = computed(() => FORMAT_LABEL[props.lesson.format]);

const ctaLabel = computed(() => {
  if (props.lesson.progress >= 100) return t.value.learn.cta.review;
  if (props.lesson.progress > 0) return t.value.learn.cta.featured;
  return t.value.learn.cta.start;
});

function open() {
  if (props.lesson.href) uni.navigateTo({ url: props.lesson.href, fail: () => {} });
}

const cardStyle = computed<CSSProperties>(() => ({
  background:
    `radial-gradient(70% 80% at 100% 0%, color-mix(in srgb, ${props.lesson.tint} 20%, transparent) 0%, transparent 55%),` +
    `radial-gradient(120% 60% at 50% 130%, color-mix(in srgb, ${props.lesson.tint} 8%, transparent) 0%, transparent 70%),` +
    `var(--v5-surface)`,
  border: "1px solid var(--v5-border)",
  boxShadow: "var(--v5-card-shadow-lift-strong)",
}));
const hairlineStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  left: "0",
  right: "0",
  top: "0",
  height: "1px",
  background: `linear-gradient(90deg, transparent, ${props.lesson.tint}, transparent)`,
  opacity: 0.6,
}));
const capLabelStyle = computed<CSSProperties>(() => ({
  fontSize: "10.5px",
  letterSpacing: "0.18em",
  color: props.lesson.tint,
}));
const titleStyle: CSSProperties = {
  fontSize: "20px",
  fontWeight: 600,
  lineHeight: 1.15,
  color: "var(--v5-ink)",
  fontFamily: "var(--font-v5)",
  letterSpacing: "-0.012em",
};
const rewardPillStyle = computed<CSSProperties>(() => ({
  paddingLeft: "12px",
  paddingRight: "16px",
  paddingTop: "6px",
  paddingBottom: "6px",
  borderRadius: "999px",
  fontSize: "12.5px",
  fontWeight: 600,
  background: `color-mix(in srgb, ${props.lesson.tint} 10%, transparent)`,
  color: props.lesson.tint,
  border: `1px solid color-mix(in srgb, ${props.lesson.tint} 30%, transparent)`,
}));
const barFillStyle = computed<CSSProperties>(() => ({
  width: `${barInView.value ? progressPct.value : 0}%`,
  background: `linear-gradient(90deg, ${props.lesson.tint}, color-mix(in srgb, ${props.lesson.tint} 80%, transparent))`,
  boxShadow: `0 0 8px color-mix(in srgb, ${props.lesson.tint} 53%, transparent)`,
  transition: barInView.value ? PROGRESS_GROW_TRANSITION : "none",
  willChange: "width",
}));
const ctaStyle = computed<CSSProperties>(() => ({
  height: "48px",
  background: props.lesson.tint,
  boxShadow: `0 0 24px color-mix(in srgb, ${props.lesson.tint} 33%, transparent)`,
}));
</script>
