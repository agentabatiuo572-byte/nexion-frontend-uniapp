<!-- Quiet semicircle gauge on the Earn device stage: thin track, gradient progress arc and a small solid head dot (no glow).
     While a job is running (or a trial is accruing credit) a comet travels the filled arc and the head pulses.
     The App draws the SVG through NxNativeSvg (v-html), so every inner style goes through :deep() on the root. -->
<template>
  <view ref="loopRef" class="job-gauge" :class="{ 'job-gauge--paused': !loops.running.value, 'job-gauge--settled': settled }" :role="progress == null ? undefined : 'progressbar'" :aria-hidden="progress == null ? 'true' : undefined" :aria-label="progress == null ? undefined : label" :aria-valuenow="progress == null ? undefined : progress" :aria-valuemin="progress == null ? undefined : 0" :aria-valuemax="progress == null ? undefined : 100">
    <svg data-native-svg class="job-gauge__svg" width="100%" height="100%" viewBox="0 0 260 150" aria-hidden="true">
      <defs v-if="progress != null">
        <linearGradient :id="gradientId" gradientUnits="userSpaceOnUse" x1="20" y1="0" :x2="Math.max(21, head.x)" y2="0">
          <stop offset="0" :style="{ stopColor: color, stopOpacity: 0.12 }" />
          <stop offset="1" :style="{ stopColor: color, stopOpacity: 0.7 }" />
        </linearGradient>
        <linearGradient v-if="live" :id="`${gradientId}-comet`" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" :style="{ stopColor: color, stopOpacity: 0 }" />
          <stop offset="1" :style="{ stopColor: color, stopOpacity: 1 }" />
        </linearGradient>
      </defs>
      <path class="job-gauge__track" d="M20 140 A110 110 0 0 1 240 140" fill="none" stroke-width="6" stroke-linecap="round" :stroke-dasharray="idle ? '2 9' : undefined" />
      <template v-if="progress != null">
        <path class="job-gauge__arc" d="M20 140 A110 110 0 0 1 240 140" fill="none" :stroke="`url(#${gradientId})`" stroke-width="6" stroke-linecap="round" :stroke-dasharray="`${arcLength} 400`" />
        <!-- Comet: a 24×6 tangential segment at the arc start, rotated about the centre (130,140) to the head angle. -->
        <g v-if="live" class="job-gauge__comet" :style="{ '--end': `${endAngle}deg` }"><rect x="17" y="140" width="6" height="24" rx="3" :fill="`url(#${gradientId}-comet)`" /></g>
        <g class="job-gauge__head" :style="{ transform: `rotate(${endAngle}deg)` }">
          <circle cx="20" cy="140" r="4" :fill="color" />
          <circle v-if="live" class="job-gauge__ring" cx="20" cy="140" r="5.25" fill="none" :stroke="color" stroke-width="1.5" />
        </g>
      </template>
    </svg>
    <view v-if="$slots.default" class="job-gauge__art"><slot /><view class="job-gauge__floor" /></view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useLoopsInView } from "@/composables/use-loops-in-view";

const props = withDefaults(defineProps<{ progress?: number | null; idle?: boolean; live?: boolean; tone?: "brand" | "amber"; label?: string }>(), { progress: null, idle: false, live: false, tone: "brand", label: undefined });
const gradientId = `job-gauge-${Math.random().toString(36).slice(2, 10)}`;
const ARC = Math.PI * 110;
const color = computed(() => props.tone === "amber" ? "var(--v5-warning)" : "var(--v5-brand)");
const arcLength = computed(() => ((props.progress ?? 0) / 100 * ARC).toFixed(2));
const endAngle = computed(() => (props.progress ?? 0) * 1.8);
const head = computed(() => {
  const angle = (props.progress ?? 0) / 100 * Math.PI;
  return { x: 130 - 110 * Math.cos(angle), y: 140 - 110 * Math.sin(angle) };
});

const loops = useLoopsInView(".job-gauge");
const loopRef = loops.elRef;
// The App rewrites the SVG markup on every value change, which would restart the entry sweep from zero.
// Once the sweep has played, the App drops it (and the loops' start delay); H5 keeps live transitions.
const settled = ref(false);
// #ifdef APP-PLUS
const settleTimer = setTimeout(() => { settled.value = true; }, 1500);
onUnmounted(() => clearTimeout(settleTimer));
// #endif
</script>

<style scoped>
.job-gauge { position: relative; width: min(260px, 100%); aspect-ratio: 260 / 150; margin: 10px auto 0; }
.job-gauge :deep(.job-gauge__svg) { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.job-gauge :deep(.job-gauge__track) { stroke: color-mix(in srgb, var(--v5-ink) 8%, transparent); }
/* Sweep from zero once on entry; later value changes glide from the previous value. */
.job-gauge :deep(.job-gauge__arc) { animation: job-gauge-sweep 1400ms cubic-bezier(.16, 1, .3, 1) backwards; transition: stroke-dasharray 800ms cubic-bezier(.16, 1, .3, 1); }
.job-gauge :deep(.job-gauge__head) { transform-origin: 130px 140px; animation: job-gauge-turn 1400ms cubic-bezier(.16, 1, .3, 1) backwards; transition: transform 800ms cubic-bezier(.16, 1, .3, 1); }
/* In-progress loops start after the entry sweep (1.4s); transform and opacity only. */
.job-gauge :deep(.job-gauge__comet) { transform-origin: 130px 140px; opacity: 0; animation: job-gauge-comet 2.8s cubic-bezier(.4, 0, .2, 1) 1.4s infinite; }
.job-gauge :deep(.job-gauge__ring) { transform-origin: 20px 140px; opacity: 0; animation: job-gauge-pulse 2.4s ease-out 1.4s infinite; }
.job-gauge--paused :deep(.job-gauge__comet), .job-gauge--paused :deep(.job-gauge__ring) { animation-play-state: paused; }
.job-gauge--settled :deep(.job-gauge__arc), .job-gauge--settled :deep(.job-gauge__head) { animation: none; }
.job-gauge--settled :deep(.job-gauge__comet), .job-gauge--settled :deep(.job-gauge__ring) { animation-delay: 0s; }
.job-gauge__art { position: absolute; left: 21.15%; top: 29.33%; width: 57.7%; height: 72%; }
.job-gauge__art :deep(.device-art) { position: absolute; inset: 0; width: 100%; height: 100%; }
.job-gauge__floor { position: absolute; left: 20%; right: 20%; bottom: -4px; height: 10px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-bg) 65%, transparent), transparent); }
[data-theme="light"] .job-gauge__floor { background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-ink) 20%, transparent), transparent); }
@keyframes job-gauge-sweep { from { stroke-dasharray: 0 400; } }
@keyframes job-gauge-turn { from { transform: rotate(0deg); } }
@keyframes job-gauge-comet {
  0% { transform: rotate(0deg); opacity: 0; }
  12% { opacity: 1; }
  68% { opacity: 1; }
  80% { transform: rotate(var(--end)); opacity: 0; }
  100% { transform: rotate(var(--end)); opacity: 0; }
}
@keyframes job-gauge-pulse { 0% { transform: scale(.6); opacity: .55; } 100% { transform: scale(2.2); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .job-gauge :deep(.job-gauge__arc), .job-gauge :deep(.job-gauge__head) { animation: none; transition: none; }
  .job-gauge :deep(.job-gauge__comet), .job-gauge :deep(.job-gauge__ring) { animation: none; }
}
</style>
