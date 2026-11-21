<!--
  NxResultHead — centred head for result pages and terminal states (payment, withdrawal, top-up,
  exchange results). A 56px icon block in the status colour (14% fill + SVG glyph, DS 03 §3.5
  notice icon), the result as title, one short line for what happens next.
  Tone follows the status map (DS 03 §3.8): success = 已到账/已完成, warning = 等待/处理中/核对中,
  neutral = 已退回/已关闭, danger = 失败, brand = 下一步可继续. The icon defaults per tone.
  The title is the page's level-1 heading inside the live status region, so a polled change is read out;
  title-testid puts an e2e hook on it. Pass :live="false" for a state the page already announces
  another way (e.g. a toast with the same words), so one change is read out once. The icon pops once when it mounts or changes; static under
  reduced motion. Extra content (amount, note) goes in the default slot, centred under the line.
-->
<template>
  <view class="nx-result-head" :class="`nx-result-head--${tone}`">
    <view :key="glyph" class="nx-result-head__icon nx-viz-pop" aria-hidden="true">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path v-if="glyph === 'check'" d="M20 6 9 17l-5-5" />
        <template v-else-if="glyph === 'return'"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></template>
        <template v-else-if="glyph === 'clock'"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></template>
        <template v-else-if="glyph === 'shield'"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="M12 8v4" /><path d="M12 16h.01" /></template>
        <template v-else-if="glyph === 'failed'"><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></template>
        <template v-else><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></template>
      </svg>
    </view>
    <view class="nx-result-head__live" :role="speaks ? 'status' : undefined" :aria-live="speaks ? 'polite' : undefined" :aria-atomic="speaks ? 'true' : undefined"><text class="nx-result-head__title" role="heading" aria-level="1" :data-testid="titleTestid">{{ title }}</text></view>
    <text v-if="description" class="nx-result-head__desc">{{ description }}</text>
    <slot />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

type Tone = "success" | "warning" | "neutral" | "danger" | "brand";
type Icon = "check" | "return" | "clock" | "shield" | "failed" | "alert";
const props = withDefaults(defineProps<{ tone: Tone; title: string; description?: string; icon?: Icon; titleTestid?: string; live?: boolean }>(), { live: true });
const toneIcon: Record<Tone, Icon> = { success: "check", warning: "clock", neutral: "return", danger: "failed", brand: "check" };
const glyph = computed(() => props.icon ?? toneIcon[props.tone]);
// The region turns live after it is shown, so appearing (often next to a toast) is not read out; later changes are.
const armed = ref(false);
onMounted(() => { armed.value = true; });
const speaks = computed(() => props.live && armed.value);
</script>

<style scoped>
.nx-result-head { display: flex; flex-direction: column; align-items: center; padding: var(--v5-space-2) 0 0; text-align: center; color: var(--v5-ink); }
.nx-result-head__icon { flex: none; display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; color: var(--nx-result-tone); background: color-mix(in srgb, var(--nx-result-tone) 14%, transparent); }
.nx-result-head--success { --nx-result-tone: var(--v5-success-ink); }
.nx-result-head--warning { --nx-result-tone: var(--v5-warning-ink); }
.nx-result-head--danger { --nx-result-tone: var(--v5-danger); }
.nx-result-head--brand { --nx-result-tone: var(--v5-brand); }
.nx-result-head--neutral { --nx-result-tone: var(--v5-ink-2); }
.nx-result-head--neutral .nx-result-head__icon { background: color-mix(in srgb, var(--v5-ink-3) 18%, transparent); }
.nx-result-head__live { max-width: 100%; }
.nx-result-head__title { display: block; max-width: 100%; margin-top: var(--v5-space-4); font: var(--ui-type-page-title-weight) var(--ui-type-page-title)/var(--ui-type-page-title-lh) var(--font-v5); text-wrap: balance; }
.nx-result-head__desc { display: block; max-width: 320px; margin-top: var(--v5-space-1); color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); text-wrap: pretty; }
</style>
