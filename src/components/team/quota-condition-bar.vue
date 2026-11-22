<template>
  <view ref="elRef" class="quota-progress" role="progressbar" :aria-label="label" :aria-valuetext="valueText" :aria-valuenow="Math.round(progress * 100)" :aria-valuemin="0" :aria-valuemax="100">
    <view :class="{ 'quota-progress__fill--depleted': depleted }" :style="fillStyle" />
  </view>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useScrollGrowProgress, PROGRESS_GROW_TRANSITION } from '@/composables/use-scroll-grow-progress';
// depleted: a quota with nothing left. Its full bar is "used up", so it never shows in the brand colour that reads as available.
const props = defineProps<{ pct: number; met: boolean; tint: string; label?: string; valueText?: string; depleted?: boolean }>();
const { elRef, inView } = useScrollGrowProgress();
const progress = computed(() => Number.isFinite(props.pct) ? Math.max(0, Math.min(1, props.pct)) : 0);
const fillStyle = computed(() => ({ width: `${inView.value ? progress.value * 100 : 0}%`, transition: inView.value ? PROGRESS_GROW_TRANSITION : 'none' }));
</script>
<style scoped>
/* Static data bar (design-rules Progress, 03 §3.6): about 4px on an ink-8% track. */
.quota-progress { height:4px;margin-top:8px;border-radius:999px;background:color-mix(in srgb, var(--v5-ink) 8%, transparent);overflow:hidden; }
.quota-progress > view { height:100%;border-radius:inherit;background:var(--v5-brand); }
.quota-progress > .quota-progress__fill--depleted { background:var(--v5-ink-4); }
@media(prefers-reduced-motion:reduce) { .quota-progress > view { transition:none!important; } }
</style>
