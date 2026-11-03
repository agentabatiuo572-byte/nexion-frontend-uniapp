<!--
  GoalProgressBar — ported from me/goals/page.tsx GoalProgressBar.
  Per-goal bar with a scroll-grow entrance (each row owns its own
  IntersectionObserver, so this is a standalone component — a composable can't
  be called inside a v-for callback). Fill = warning→brand gradient that grows
  0 → pct on scroll-into-view (replays on re-entry). The composable resolves the
  track <view>'s $el for IO (P-019); `ref="elRef"` binds the node, matching the
  convention in vrank-card.vue / missed-income-banner.vue.
-->
<template>
  <view ref="elRef" :style="trackStyle">
    <view :style="fillStyle" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from "vue";
import {
  useScrollGrowProgress,
  PROGRESS_GROW_TRANSITION,
} from "@/composables/use-scroll-grow-progress";

const props = defineProps<{ pct: number }>();

const { elRef, inView } = useScrollGrowProgress();

const entered = ref(false);
watch(inView, value => { if (value) entered.value = true; }, {immediate:true});

const trackStyle: CSSProperties = {
  marginTop: "8px",
  height: "6px",
  borderRadius: "var(--v5-radius-full)",
  background: "var(--v5-surface-3)",
  overflow: "hidden",
};
const fillStyle = computed<CSSProperties>(() => ({
  height: "100%",
  width: `${props.pct}%`,
  transform: entered.value ? "scaleX(1)" : "scaleX(0)",
  transformOrigin: "left",
  background: "linear-gradient(to right, var(--v5-brand), var(--v5-brand))",
  transition: "transform 1400ms cubic-bezier(.16,1,.3,1)",

}));
</script>

<style scoped>@media (prefers-reduced-motion: reduce) { view > view { transition: none !important; transform: none !important; } }</style>
