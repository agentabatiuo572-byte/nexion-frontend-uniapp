<template>
  <view ref="elRef" class="growth-progress" :class="ring ? 'growth-progress--ring' : 'growth-progress--bar'" role="progressbar" :aria-label="label" :aria-valuenow="value === null ? undefined : value" aria-valuemin="0" aria-valuemax="100" :style="ring ? {width: size + 'px', height: size + 'px'} : {}">
    <template v-if="ring">
      <svg :width="size" :height="size" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="growth-progress__track" cx="50" cy="50" :r="radius" :stroke-width="stroke" />
        <defs><clipPath :id="rightClip"><rect x="50" y="0" width="50" height="100" /></clipPath><clipPath :id="leftClip"><rect x="0" y="0" width="50" height="100" /></clipPath></defs>
        <g :clip-path="`url(#${rightClip})`"><path class="growth-progress__arc" :d="`M50 ${50-radius}a${radius} ${radius} 0 0 0 0 ${radius*2}`" :stroke-width="stroke" :style="{'--ui-growth-angle': `${Math.min(180,pct * 3.6)}deg`, opacity: pct > 0 ? 1 : 0, transform:`rotate(${entered ? Math.min(180,pct * 3.6) : 0}deg)`}" /></g>
        <g :clip-path="`url(#${leftClip})`"><path class="growth-progress__arc growth-progress__arc--second" :d="`M50 ${50+radius}a${radius} ${radius} 0 0 0 0-${radius*2}`" :stroke-width="stroke" :style="{'--ui-growth-angle': `${Math.max(0,pct * 3.6 - 180)}deg`, opacity: pct > 50 ? 1 : 0, transform:`rotate(${entered ? Math.max(0,pct * 3.6 - 180) : 0}deg)`}" /></g>
        <circle v-if="pct > 0" class="growth-progress__start" cx="50" :cy="50-radius" :r="stroke/2" :style="{opacity: entered ? 1 : 0}" />
      </svg>
      <view class="growth-progress__center"><slot /></view>
    </template>
    <view v-else class="growth-progress__fill" :style="{width: `${pct}%`, transform: `scaleX(${entered ? 1 : 0})`}" />
  </view>
</template>
<script setup lang="ts">
import { computed, getCurrentInstance, ref, watch } from 'vue';
import { useScrollGrowProgress } from '@/composables/use-scroll-grow-progress';
const props = withDefaults(defineProps<{ value: number | null; label?: string; ring?: boolean; size?: number; radius?: number; stroke?: number }>(), {ring: false, size: 64, radius:44, stroke: 8});
// Two clipped semicircles sweep using only transform; no dash-offset or conic animation.
const uid = getCurrentInstance()!.uid;
const rightClip = `growth-right-${uid}`, leftClip = `growth-left-${uid}`;
const { elRef, inView } = useScrollGrowProgress();
const entered = ref(false);
watch(inView, value => { if (value) entered.value = true; }, {immediate: true});
const pct = computed(() => Math.max(0, Math.min(100, props.value ?? 0)));
</script>
<style scoped>
.growth-progress { position: relative; flex: none; }
.growth-progress--bar { height: 6px; border-radius: var(--v5-radius-full); overflow: hidden; background: var(--v5-surface-3); }
.growth-progress__fill { height: 100%; width: 100%; border-radius: inherit; background: var(--v5-brand); transform-origin: left; transition: transform 1400ms cubic-bezier(.16,1,.3,1); }
.growth-progress__track, .growth-progress__arc { fill: none; }
.growth-progress__track { stroke: var(--v5-surface-3); }
.growth-progress__arc { stroke: var(--v5-brand); stroke-linecap: round; transform-origin: 50px 50px; transition: transform 700ms cubic-bezier(.16,1,.3,1); }
.growth-progress__arc--second { transition-delay: 350ms; }
.growth-progress__start { fill:var(--v5-brand); transition:opacity 150ms ease; }
.growth-progress__center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: var(--font-metric); }
@media (prefers-reduced-motion: reduce) { .growth-progress__start, .growth-progress__fill, .growth-progress__arc { transition: none; transform: none !important; }.growth-progress__arc { transform: rotate(var(--ui-growth-angle)) !important; } }
</style>
