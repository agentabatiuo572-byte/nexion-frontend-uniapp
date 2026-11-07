<template>
  <!-- Design system 04 §4.0: only reached, current and stopped nodes carry a label; later nodes are bare dots. -->
  <view class="amb-track" :class="`amb-track--${size}`" role="list" :aria-label="label" :style="{ '--amb-current': presentation.current }">
    <view v-for="(step, index) in presentation.steps" :key="index" class="amb-track__step" :role="step.key ? 'listitem' : undefined" :aria-hidden="step.key ? undefined : 'true'">
      <view v-if="index < presentation.steps.length - 1" class="amb-track__seg"><view v-if="reached(presentation.steps[index + 1])" class="amb-track__fill nx-viz-grow" :style="{ animationDelay: vizStagger(index, 120) }" /></view>
      <view class="amb-track__dot" :class="`amb-track__dot--${step.state}`">
        <svg v-if="step.state === 'done' || step.state === 'end'" :width="size === 'hero' ? 14 : 12" :height="size === 'hero' ? 14 : 12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
        <svg v-else-if="step.state === 'stop'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 7v6M12 17h.01" /></svg>
        <svg v-else-if="step.state === 'fail'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </view>
      <text v-if="step.key" class="amb-track__label" :class="`amb-track__label--${step.state}`">{{ labels[step.key] }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { vizStagger } from "@/composables/use-scroll-grow-progress";
import type { AmbassadorPresentation, AmbassadorStep, AmbassadorStepKey } from "@/lib/ambassador-display";

defineProps<{ presentation: AmbassadorPresentation; labels: Record<AmbassadorStepKey, string>; label: string; size: "card" | "hero" }>();
// A segment fills up to the next reached node; a rejection ends the track without filling the gap before it.
const reached = (step: AmbassadorStep) => step.state !== "todo" && step.state !== "fail";
</script>

<style scoped>
.amb-track { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: var(--v5-space-4); }
.amb-track--hero { margin-top: var(--v5-space-5); }
.amb-track__step { position: relative; display: flex; flex-direction: column; align-items: center; gap: var(--v5-space-2); min-width: 0; text-align: center; }
.amb-track__seg { position: absolute; top: 9px; left: calc(50% + 14px); width: calc(100% - 28px); height: 2px; border-radius: var(--v5-radius-full); background: var(--v5-surface-3); overflow: hidden; }
.amb-track--hero .amb-track__seg { top: 11px; left: calc(50% + 16px); width: calc(100% - 32px); }
.amb-track__fill { width: 100%; height: 100%; background: var(--v5-brand); }
.amb-track__dot { position: relative; display: grid; place-items: center; box-sizing: border-box; width: 20px; height: 20px; border-radius: 50%; }
.amb-track--hero .amb-track__dot { width: 24px; height: 24px; }
.amb-track__dot--done, .amb-track__dot--end { background: var(--v5-brand); color: var(--v5-on-brand); }
.amb-track__dot--current { border: 2px solid var(--amb-current); }
.amb-track__dot--current::after, .amb-track__dot--todo::after { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--amb-current); }
.amb-track__dot--todo::after { background: var(--v5-surface-3); }
.amb-track--hero .amb-track__dot--todo::after { width: 10px; height: 10px; }
.amb-track__dot--stop { background: var(--v5-warning-ink); color: var(--v5-on-brand); }
.amb-track__dot--fail { background: var(--v5-danger); color: var(--v5-on-brand); }
.amb-track__label { max-width: 100%; font: var(--ui-type-chip-weight) var(--ui-type-chip)/var(--ui-type-chip-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: anywhere; }
.amb-track__label--current { color: var(--amb-current); }
.amb-track__label--stop { color: var(--v5-warning-ink); }
.amb-track__label--fail { color: var(--v5-danger); }
.amb-track__label--end { color: var(--v5-success-ink); }
</style>
