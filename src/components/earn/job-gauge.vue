<!-- Quiet semicircle gauge on the Earn device stage: thin track, gradient progress arc and a small solid head dot (no glow).
     While a job is running (or a trial is accruing credit) soft ripples flow along the filled arc toward the head and the
     head pulses.
     Only the track is drawn in place. The filled arc, the ripple train, the head dot and its pulse are separate HTML layers
     moved by transform and opacity alone, so the compositor plays the loops, the entry sweep and every progress glide
     without repainting the gauge (an animation inside an SVG repaints the SVG every frame, and a glass bar over it has
     to re-blur). A progress step repaints only the two fade masks, once.
     The App draws SVG through NxNativeSvg (v-html), which rewrites markup whenever it changes. Progress therefore lives
     in CSS variables on the root, and no SVG markup depends on it. -->
<template>
  <view ref="loopRef" class="job-gauge" :class="{ 'job-gauge--paused': !loops.running.value, 'job-gauge--settled': settled }" :style="{ '--jg-end': `${endAngle}deg`, '--jg-fade': `${fadeEnd}%` }" :role="progress == null ? undefined : 'progressbar'" :aria-hidden="progress == null ? 'true' : undefined" :aria-label="progress == null ? undefined : label" :aria-valuenow="progress == null ? undefined : progress" :aria-valuemin="progress == null ? undefined : 0" :aria-valuemax="progress == null ? undefined : 100">
    <svg v-if="live && progress != null" data-native-svg class="job-gauge__defs" width="0" height="0" aria-hidden="true">
      <defs>
        <!-- One ripple crest, drawn at the top of the ring: bright in the middle, fading to nothing at both ends. -->
        <linearGradient :id="`${gradientId}-wave`" gradientUnits="userSpaceOnUse" x1="116.59" y1="0" x2="143.41" y2="0">
          <stop offset="0" :style="{ stopColor: color, stopOpacity: 0 }" />
          <stop offset="0.5" :style="{ stopColor: color, stopOpacity: 0.9 }" />
          <stop offset="1" :style="{ stopColor: color, stopOpacity: 0 }" />
        </linearGradient>
      </defs>
    </svg>
    <svg data-native-svg class="job-gauge__svg" width="100%" height="100%" viewBox="0 0 260 150" aria-hidden="true">
      <path class="job-gauge__track" d="M20 140 A110 110 0 0 1 240 140" fill="none" stroke-width="6" stroke-linecap="round" :stroke-dasharray="idle ? '2 9' : undefined" />
    </svg>
    <template v-if="progress != null">
      <!-- The completed part is cut out without a mask that moves. Each fill box holds the upper half (plus the round
           start cap) and fades from the start to the head: the arc from 12% to 70% colour, the ripple mask from 20% to
           100%. Inside it a half-plane turns with the head, so only the part behind the head shows, and a counter-turned
           box keeps the drawing itself in place. Arc, ripple and head share one entry sweep and one glide, so the crests
           are never ahead of the arc. -->
      <view class="job-gauge__fill job-gauge__fill--arc" aria-hidden="true">
        <view class="job-gauge__reveal">
          <view class="job-gauge__unturn">
            <svg data-native-svg class="job-gauge__layer-svg" width="100%" height="100%" viewBox="0 0 260 150" aria-hidden="true"><path d="M20 140 A110 110 0 0 1 240 140" fill="none" :stroke="color" stroke-width="6" stroke-linecap="round" /></svg>
          </view>
        </view>
      </view>
      <!-- Ripples: twelve soft crests (14° each, every 30°) on the same r=110 circle turn about the centre (130,140) by
           one spacing per loop, so the train flows toward the head without a start or end. -->
      <view v-if="live" class="job-gauge__fill job-gauge__ripple" aria-hidden="true">
        <view class="job-gauge__reveal">
          <view class="job-gauge__unturn">
            <view class="job-gauge__waves">
              <svg data-native-svg class="job-gauge__layer-svg" width="100%" height="100%" viewBox="17 27 226 226" aria-hidden="true">
                <path v-for="k in 12" :key="k" :transform="`rotate(${k * 30} 130 140)`" d="M116.59 30.82 A110 110 0 0 1 143.41 30.82" fill="none" :stroke="`url(#${gradientId}-wave)`" stroke-width="6" />
              </svg>
            </view>
          </view>
        </view>
      </view>
      <!-- The head turns about the centre with the arc. The pulse ring is drawn at its largest size and scaled down, so
           the compositor never enlarges a small bitmap. -->
      <view class="job-gauge__head" aria-hidden="true">
        <view class="job-gauge__dot">
          <svg data-native-svg class="job-gauge__layer-svg" width="100%" height="100%" viewBox="16 136 8 8" aria-hidden="true"><circle cx="20" cy="140" r="4" :fill="color" /></svg>
        </view>
        <view v-if="live" class="job-gauge__ring">
          <svg data-native-svg class="job-gauge__layer-svg" width="100%" height="100%" viewBox="6.8 126.8 26.4 26.4" aria-hidden="true"><circle cx="20" cy="140" r="11.55" fill="none" :stroke="color" stroke-width="3.3" /></svg>
        </view>
      </view>
    </template>
    <view v-if="$slots.default" class="job-gauge__art"><slot /><view class="job-gauge__floor" /></view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useLoopsInView } from "@/composables/use-loops-in-view";

const props = withDefaults(defineProps<{ progress?: number | null; idle?: boolean; live?: boolean; tone?: "brand" | "amber"; label?: string }>(), { progress: null, idle: false, live: false, tone: "brand", label: undefined });
const gradientId = `job-gauge-${Math.random().toString(36).slice(2, 10)}`;
const color = computed(() => props.tone === "amber" ? "var(--v5-warning)" : "var(--v5-brand)");
const endAngle = computed(() => (props.progress ?? 0) * 1.8);
const head = computed(() => {
  const angle = (props.progress ?? 0) / 100 * Math.PI;
  return { x: 130 - 110 * Math.cos(angle), y: 140 - 110 * Math.sin(angle) };
});
// The arc and ripple fades run from x 20 to the head (never shorter than 1 unit).
const fadeEnd = computed(() => (Math.max(21, head.value.x) / 260 * 100).toFixed(3));

const loops = useLoopsInView(".job-gauge");
const loopRef = loops.elRef;
// A state change (idle, running) still rewrites the App markup; once the entry sweep has played, the App drops it
// (and the loops' start delay) so such a rewrite never replays the arc from zero. H5 keeps the stock timings.
// It settles 2.1s after the last rewrite, once the ripple fade-in (1.4s + 600ms) of the nodes on screen has finished,
// so settling never cuts a fade short, however late those nodes appeared.
const settled = ref(false);
// #ifdef APP-PLUS
let settleTimer: ReturnType<typeof setTimeout> | undefined;
watch([() => props.progress != null, () => props.live, () => props.idle, () => props.tone], () => {
  if (settled.value) return;
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => { settled.value = true; }, 2100);
}, { immediate: true });
onUnmounted(() => clearTimeout(settleTimer));
// #endif
</script>

<style scoped>
/* Layer boxes are in gauge units (viewBox 260×150) as percentages of their parent, so they scale with the gauge. */
.job-gauge { position: relative; width: min(260px, 100%); aspect-ratio: 260 / 150; margin: 10px auto 0; }
.job-gauge :deep(.job-gauge__defs) { position: absolute; width: 0; height: 0; overflow: hidden; }
.job-gauge :deep(.job-gauge__svg), .job-gauge :deep(.job-gauge__layer-svg) { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.job-gauge :deep(.job-gauge__track) { stroke: color-mix(in srgb, var(--v5-ink) 8%, transparent); }
/* Fill box y 0–143, faded from x 20 to the head, and kept to the upper half (y < 140) plus the left half, so the round
   start cap (3 units below the centre line) shows and the right end never does. */
.job-gauge__fill { position: absolute; left: 0; top: 0; width: 100%; height: 95.3333%; overflow: hidden; pointer-events: none; --jg-solid: linear-gradient(#000, #000); --jg-fade-mask: linear-gradient(to right, rgba(0, 0, 0, var(--jg-from)) 7.6923%, rgba(0, 0, 0, var(--jg-to)) var(--jg-fade)); -webkit-mask-image: var(--jg-fade-mask), var(--jg-solid), var(--jg-solid); mask-image: var(--jg-fade-mask), var(--jg-solid), var(--jg-solid); -webkit-mask-size: 100% 100%, 100% 97.9021%, 50% 100%; mask-size: 100% 100%, 100% 97.9021%, 50% 100%; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-composite: source-in, source-over, source-over; mask-composite: intersect, add, add; }
.job-gauge__fill--arc { --jg-from: .12; --jg-to: .7; }
.job-gauge__ripple { --jg-from: .2; --jg-to: 1; }
/* Half-plane x 10–250, y 140–260, turned about (130,140); at 0° it lies wholly below the centre line. */
.job-gauge__reveal { position: absolute; left: 3.8462%; top: 97.9021%; width: 92.3077%; height: 83.9161%; overflow: hidden; transform-origin: 50% 0; }
/* Back in the gauge box (0,0)–(260,150). */
.job-gauge__unturn { position: absolute; left: -4.1667%; top: -116.6667%; width: 108.3333%; height: 125%; transform-origin: 50% 93.3333%; }
/* The full ring of crests, (17,27)–(243,253). */
.job-gauge__waves { position: absolute; left: 6.5385%; top: 18%; width: 86.9231%; height: 150.6667%; transform-origin: 50% 50%; }
.job-gauge__head { position: absolute; inset: 0; transform-origin: 50% 93.3333%; pointer-events: none; }
.job-gauge__dot { position: absolute; left: 6.1538%; top: 90.6667%; width: 3.0769%; height: 5.3333%; }
/* Ring box (6.8,126.8)–(33.2,153.2) around the head at (20,140). */
.job-gauge__ring { position: absolute; left: 2.6154%; top: 84.5333%; width: 10.1538%; height: 17.6%; transform-origin: 50% 50%; }
/* Sweep from zero once on entry; later value changes glide from the previous value. The half-plane, its counter-turn
   and the head all turn by the arc end angle. */
.job-gauge__head, .job-gauge__reveal { transform: rotate(var(--jg-end)); }
.job-gauge__unturn { transform: rotate(calc(-1 * var(--jg-end))); }
.job-gauge__head, .job-gauge__reveal, .job-gauge__unturn { animation: job-gauge-turn 1400ms cubic-bezier(.16, 1, .3, 1) backwards; transition: transform 800ms cubic-bezier(.16, 1, .3, 1); }
/* In-progress loops start after the entry sweep (1.4s); transform and opacity only. */
.job-gauge__ripple { opacity: 0; animation: job-gauge-fade-in 600ms ease-out 1.4s forwards; }
/* The waves turn from mount with no delay (hidden until the ripple fades in), so settling never shifts their phase. */
.job-gauge__waves { animation: job-gauge-flow 2s linear infinite; }
.job-gauge__ring { opacity: 0; animation: job-gauge-pulse 2.4s ease-out 1.4s infinite; }
.job-gauge--paused .job-gauge__waves, .job-gauge--paused .job-gauge__ring { animation-play-state: paused; }
.job-gauge--settled .job-gauge__head, .job-gauge--settled .job-gauge__reveal, .job-gauge--settled .job-gauge__unturn { animation: none; }
/* Settled: new nodes after a rewrite start at once. The fade has already finished on the running nodes, and the pulse
   delay moves back by exactly one 2.4s cycle (1.4s → -1s), so a running pulse keeps its phase instead of jumping. */
.job-gauge--settled .job-gauge__ripple { animation-delay: 0s; }
.job-gauge--settled .job-gauge__ring { animation-delay: -1s; }
.job-gauge__art { position: absolute; left: 21.15%; top: 29.33%; width: 57.7%; height: 72%; }
.job-gauge__art :deep(.device-art) { position: absolute; inset: 0; width: 100%; height: 100%; }
.job-gauge__floor { position: absolute; left: 20%; right: 20%; bottom: -4px; height: 10px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-bg) 65%, transparent), transparent); }
[data-theme="light"] .job-gauge__floor { background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-ink) 20%, transparent), transparent); }
@keyframes job-gauge-turn { from { transform: rotate(0deg); } }
@keyframes job-gauge-fade-in { to { opacity: 1; } }
/* One crest spacing (30°) per loop, so the end frame matches the start. */
@keyframes job-gauge-flow { from { transform: rotate(0deg); } to { transform: rotate(30deg); } }
/* The ring is drawn at 2.2×: scale .6 → 2.2 of the 5.25 ring is .2727 → 1 of the drawn one. */
@keyframes job-gauge-pulse { 0% { transform: scale(.2727); opacity: .55; } 100% { transform: scale(1); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .job-gauge__head, .job-gauge__reveal, .job-gauge__unturn { animation: none; transition: none; }
  /* The ripple stays hidden (opacity 0 without its fade-in); the pulse ring too. */
  .job-gauge__ripple, .job-gauge__waves, .job-gauge__ring { animation: none; }
}
</style>
