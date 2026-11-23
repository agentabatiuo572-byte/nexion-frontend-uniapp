<template>
  <view ref="elRef" class="growth-progress" :class="ring ? 'growth-progress--ring' : 'growth-progress--bar'" role="progressbar" :aria-label="label" :aria-valuenow="value === null ? undefined : value" aria-valuemin="0" aria-valuemax="100" :style="ring ? ringStyle : {}">
    <template v-if="ring">
      <svg :width="size" :height="size" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="growth-progress__track" cx="50" cy="50" :r="radius" :stroke-width="stroke" />
        <defs><clipPath :id="rightClip"><rect x="50" y="0" width="50" height="100" /></clipPath><clipPath :id="leftClip"><rect x="0" y="0" width="50" height="100" /></clipPath></defs>
        <g :clip-path="`url(#${rightClip})`"><path class="growth-progress__arc growth-progress__arc--first" :d="`M50 ${50-radius}a${radius} ${radius} 0 0 0 0 ${radius*2}`" :stroke-width="stroke" /></g>
        <g :clip-path="`url(#${leftClip})`"><path class="growth-progress__arc growth-progress__arc--second" :d="`M50 ${50+radius}a${radius} ${radius} 0 0 0 0-${radius*2}`" :stroke-width="stroke" /></g>
        <circle v-if="pct > 0" class="growth-progress__start" cx="50" :cy="50-radius" :r="stroke/2" />
      </svg>
      <view class="growth-progress__center"><slot /></view>
    </template>
    <view v-else class="growth-progress__fill" :style="{width: `${pct}%`, transform: `scaleX(${entered ? 1 : 0})`}" />
  </view>
</template>
<script setup lang="ts">
import { computed, getCurrentInstance, ref, watch } from 'vue';
import { useScrollGrowProgress, VIZ_RING_TRANSITION } from '@/composables/use-scroll-grow-progress';
const props = withDefaults(defineProps<{ value: number | null; label?: string; ring?: boolean; size?: number; radius?: number; stroke?: number }>(), {ring: false, size: 64, radius:44, stroke: 8});
// Two clipped semicircles sweep using only transform; no dash-offset or conic animation.
const uid = getCurrentInstance()!.uid;
const rightClip = `growth-right-${uid}`, leftClip = `growth-left-${uid}`;
const { elRef, inView } = useScrollGrowProgress({ nativeSelector: '.growth-progress' });
const entered = ref(false);
watch(inView, value => { if (value) entered.value = true; }, {immediate: true});
const pct = computed(() => Math.max(0, Math.min(100, props.value ?? 0)));
// Ring entrance (07 §7.1.1): the registered --nx-viz-ring sweeps 0 → value over 1400ms on the real root while the ring
// is in view, and resets to 0 when it leaves so it plays again on re-entry. Both half-arcs read that one value, so the
// sweep is a single curve. The svg markup never changes with it (the App writes it through NxNativeSvg).
// The --ui-growth-* values are the final state for reduced motion.
const ringStyle = computed(() => ({
  width: props.size + 'px',
  height: props.size + 'px',
  '--nx-viz-ring': inView.value === false ? 0 : pct.value,
  transition: inView.value === false ? 'none' : VIZ_RING_TRANSITION,
  '--ui-growth-angle-1': `${Math.min(180, pct.value * 3.6)}deg`,
  '--ui-growth-angle-2': `${Math.max(0, pct.value * 3.6 - 180)}deg`,
  '--ui-growth-on-1': pct.value > 0 ? 1 : 0,
  '--ui-growth-on-2': pct.value > 50 ? 1 : 0,
}));
</script>
<style scoped>
.growth-progress { position: relative; flex: none; }
.growth-progress--bar { height: 6px; border-radius: var(--v5-radius-full); overflow: hidden; background: var(--v5-surface-3); }
.growth-progress__fill { height: 100%; width: 100%; border-radius: inherit; background: var(--v5-brand); transform-origin: left; transition: transform 1400ms cubic-bezier(.16,1,.3,1); }
.growth-progress :deep(.growth-progress__track), .growth-progress :deep(.growth-progress__arc) { fill: none; }
.growth-progress :deep(.growth-progress__track) { stroke: var(--v5-surface-3); }
/* --nx-viz-ring is registered with inherits:false; the ring's nodes take it from the root explicitly. */
.growth-progress--ring :deep(*) { --nx-viz-ring: inherit; }
.growth-progress :deep(.growth-progress__arc) { stroke: var(--v5-brand); stroke-linecap: round; transform-origin: 50px 50px; }
.growth-progress :deep(.growth-progress__arc--first) { opacity: clamp(0, calc(var(--nx-viz-ring) * 1000), 1); transform: rotate(calc(min(var(--nx-viz-ring), 50) * 3.6deg)); }
.growth-progress :deep(.growth-progress__arc--second) { opacity: clamp(0, calc((var(--nx-viz-ring) - 50) * 1000), 1); transform: rotate(calc(max(calc(var(--nx-viz-ring) - 50), 0) * 3.6deg)); }
.growth-progress :deep(.growth-progress__start) { fill:var(--v5-brand); opacity: clamp(0, calc(var(--nx-viz-ring) * 1000), 1); }
.growth-progress__center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: var(--font-metric); }
@media (prefers-reduced-motion: reduce) { .growth-progress--ring, .growth-progress__fill { transition: none !important; }.growth-progress__fill { transform: none !important; }.growth-progress :deep(.growth-progress__arc--first) { opacity: var(--ui-growth-on-1) !important; transform: rotate(var(--ui-growth-angle-1)) !important; }.growth-progress :deep(.growth-progress__arc--second) { opacity: var(--ui-growth-on-2) !important; transform: rotate(var(--ui-growth-angle-2)) !important; }.growth-progress :deep(.growth-progress__start) { opacity: var(--ui-growth-on-1) !important; } }
</style>
