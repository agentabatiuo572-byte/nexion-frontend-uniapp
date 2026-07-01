<!--
  RatingBar — a single review-distribution bar that grows 0 → pct when it
  scrolls into view (ported from _client.tsx RatingBar). Each instance owns its
  own IntersectionObserver via useScrollGrowProgress — the composable resolves
  the <view> ref through $el (P-019) so observe() gets a real DOM Element.
-->
<template>
  <view ref="elRef" class="flex-1 overflow-hidden" :style="trackStyle">
    <view :style="fillStyle" />
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import {
  useScrollGrowProgress,
  PROGRESS_GROW_TRANSITION,
} from "@/composables/use-scroll-grow-progress";

const props = defineProps<{ pct: number }>();
const { elRef, inView } = useScrollGrowProgress();

const trackStyle: CSSProperties = {
  height: "4px",
  borderRadius: "2px",
  background: "var(--v5-surface-3)",
};
const fillStyle = computed<CSSProperties>(() => ({
  height: "100%",
  width: `${inView.value ? props.pct : 0}%`,
  background: "var(--v5-warning)",
  borderRadius: "2px",
  transition: inView.value ? PROGRESS_GROW_TRANSITION : "none",
  willChange: "width",
}));
</script>
