<!-- Quiet semicircle gauge on the Earn device stage: thin track, gradient progress arc and a small solid head dot (no glow).
     While a job is running (or a trial is accruing credit) soft ripples flow along the filled arc toward the head and the
     head pulses.
     The App draws SVG through NxNativeSvg (v-html), which rewrites markup whenever it changes. Progress therefore lives
     in CSS variables on the root, so the drawn nodes (arc, ripple mask, head, pulse) stay in place and keep their loops
     and transitions; only the small paint-server SVG, whose gradients follow the head, is rewritten. -->
<template>
  <view ref="loopRef" class="job-gauge" :class="{ 'job-gauge--paused': !loops.running.value, 'job-gauge--settled': settled }" :style="{ '--jg-dash': `${arcLength} 400`, '--jg-end': `${endAngle}deg` }" :role="progress == null ? undefined : 'progressbar'" :aria-hidden="progress == null ? 'true' : undefined" :aria-label="progress == null ? undefined : label" :aria-valuenow="progress == null ? undefined : progress" :aria-valuemin="progress == null ? undefined : 0" :aria-valuemax="progress == null ? undefined : 100">
    <svg v-if="progress != null" data-native-svg class="job-gauge__defs" width="0" height="0" aria-hidden="true">
      <defs>
        <linearGradient :id="gradientId" gradientUnits="userSpaceOnUse" x1="20" y1="0" :x2="Math.max(21, head.x)" y2="0">
          <stop offset="0" :style="{ stopColor: color, stopOpacity: 0.12 }" />
          <stop offset="1" :style="{ stopColor: color, stopOpacity: 0.7 }" />
        </linearGradient>
        <!-- One ripple crest, drawn at the top of the ring: bright in the middle, fading to nothing at both ends. -->
        <linearGradient :id="`${gradientId}-wave`" gradientUnits="userSpaceOnUse" x1="116.59" y1="0" x2="143.41" y2="0">
          <stop offset="0" :style="{ stopColor: color, stopOpacity: 0 }" />
          <stop offset="0.5" :style="{ stopColor: color, stopOpacity: 0.9 }" />
          <stop offset="1" :style="{ stopColor: color, stopOpacity: 0 }" />
        </linearGradient>
        <!-- Ripple mask paint: faint near the start, full strength at the head, like the arc itself. -->
        <linearGradient :id="`${gradientId}-fade`" gradientUnits="userSpaceOnUse" x1="20" y1="0" :x2="Math.max(21, head.x)" y2="0">
          <stop offset="0" stop-color="#fff" stop-opacity="0.2" />
          <stop offset="1" stop-color="#fff" stop-opacity="1" />
        </linearGradient>
      </defs>
    </svg>
    <svg data-native-svg class="job-gauge__svg" width="100%" height="100%" viewBox="0 0 260 150" aria-hidden="true">
      <path class="job-gauge__track" d="M20 140 A110 110 0 0 1 240 140" fill="none" stroke-width="6" stroke-linecap="round" :stroke-dasharray="idle ? '2 9' : undefined" />
      <template v-if="progress != null">
        <path class="job-gauge__arc" d="M20 140 A110 110 0 0 1 240 140" fill="none" :stroke="`url(#${gradientId})`" stroke-width="6" stroke-linecap="round" />
        <!-- Ripples: twelve soft crests (14° each, every 30°) on the same r=110 circle turn about the centre (130,140)
             by one spacing per loop, so the train flows toward the head without a start or end. The mask is the filled
             arc itself, so crests only show inside the completed part; it lives in this SVG to keep its transition. -->
        <template v-if="live">
          <mask :id="`${gradientId}-mask`" maskUnits="userSpaceOnUse" x="0" y="0" width="260" height="150">
            <path class="job-gauge__fill" d="M20 140 A110 110 0 0 1 240 140" fill="none" :stroke="`url(#${gradientId}-fade)`" stroke-width="6" stroke-linecap="round" />
          </mask>
          <g class="job-gauge__ripple" :mask="`url(#${gradientId}-mask)`">
            <g class="job-gauge__waves">
              <path v-for="k in 12" :key="k" :transform="`rotate(${k * 30} 130 140)`" d="M116.59 30.82 A110 110 0 0 1 143.41 30.82" fill="none" :stroke="`url(#${gradientId}-wave)`" stroke-width="6" />
            </g>
          </g>
        </template>
        <g class="job-gauge__head">
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
// A state change (idle, running) still rewrites the App markup; once the entry sweep has played, the App drops it
// (and the loops' start delay) so such a rewrite never replays the arc from zero. H5 keeps the stock timings.
// It settles at 2.1s, after the ripple fade-in (1.4s + 600ms) has finished, so switching never cuts that fade short.
const settled = ref(false);
// #ifdef APP-PLUS
const settleTimer = setTimeout(() => { settled.value = true; }, 2100);
onUnmounted(() => clearTimeout(settleTimer));
// #endif
</script>

<style scoped>
.job-gauge { position: relative; width: min(260px, 100%); aspect-ratio: 260 / 150; margin: 10px auto 0; }
.job-gauge :deep(.job-gauge__defs) { position: absolute; width: 0; height: 0; overflow: hidden; }
.job-gauge :deep(.job-gauge__svg) { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.job-gauge :deep(.job-gauge__track) { stroke: color-mix(in srgb, var(--v5-ink) 8%, transparent); }
/* Sweep from zero once on entry; later value changes glide from the previous value. */
.job-gauge :deep(.job-gauge__arc), .job-gauge :deep(.job-gauge__fill) { stroke-dasharray: var(--jg-dash); animation: job-gauge-sweep 1400ms cubic-bezier(.16, 1, .3, 1) backwards; transition: stroke-dasharray 800ms cubic-bezier(.16, 1, .3, 1); }
.job-gauge :deep(.job-gauge__head) { transform: rotate(var(--jg-end)); transform-origin: 130px 140px; animation: job-gauge-turn 1400ms cubic-bezier(.16, 1, .3, 1) backwards; transition: transform 800ms cubic-bezier(.16, 1, .3, 1); }
/* In-progress loops start after the entry sweep (1.4s); transform and opacity only. */
.job-gauge :deep(.job-gauge__ripple) { opacity: 0; animation: job-gauge-fade-in 600ms ease-out 1.4s forwards; }
/* The waves turn from mount with no delay (hidden until the ripple fades in), so settling never shifts their phase. */
.job-gauge :deep(.job-gauge__waves) { transform-origin: 130px 140px; animation: job-gauge-flow 2s linear infinite; }
.job-gauge :deep(.job-gauge__ring) { transform-origin: 20px 140px; opacity: 0; animation: job-gauge-pulse 2.4s ease-out 1.4s infinite; }
.job-gauge--paused :deep(.job-gauge__waves), .job-gauge--paused :deep(.job-gauge__ring) { animation-play-state: paused; }
.job-gauge--settled :deep(.job-gauge__arc), .job-gauge--settled :deep(.job-gauge__fill), .job-gauge--settled :deep(.job-gauge__head) { animation: none; }
/* Settled: new nodes after a rewrite start at once. The fade has already finished on the running nodes, and the pulse
   delay moves back by exactly one 2.4s cycle (1.4s → -1s), so a running pulse keeps its phase instead of jumping. */
.job-gauge--settled :deep(.job-gauge__ripple) { animation-delay: 0s; }
.job-gauge--settled :deep(.job-gauge__ring) { animation-delay: -1s; }
.job-gauge__art { position: absolute; left: 21.15%; top: 29.33%; width: 57.7%; height: 72%; }
.job-gauge__art :deep(.device-art) { position: absolute; inset: 0; width: 100%; height: 100%; }
.job-gauge__floor { position: absolute; left: 20%; right: 20%; bottom: -4px; height: 10px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-bg) 65%, transparent), transparent); }
[data-theme="light"] .job-gauge__floor { background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-ink) 20%, transparent), transparent); }
@keyframes job-gauge-sweep { from { stroke-dasharray: 0 400; } }
@keyframes job-gauge-turn { from { transform: rotate(0deg); } }
@keyframes job-gauge-fade-in { to { opacity: 1; } }
/* One crest spacing (30°) per loop, so the end frame matches the start. */
@keyframes job-gauge-flow { from { transform: rotate(0deg); } to { transform: rotate(30deg); } }
@keyframes job-gauge-pulse { 0% { transform: scale(.6); opacity: .55; } 100% { transform: scale(2.2); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .job-gauge :deep(.job-gauge__arc), .job-gauge :deep(.job-gauge__fill), .job-gauge :deep(.job-gauge__head) { animation: none; transition: none; }
  /* The ripple stays hidden (opacity 0 without its fade-in); the pulse ring too. */
  .job-gauge :deep(.job-gauge__ripple), .job-gauge :deep(.job-gauge__waves), .job-gauge :deep(.job-gauge__ring) { animation: none; }
}
</style>
