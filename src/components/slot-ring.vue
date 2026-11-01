<!-- Segmented slot ring after the Home "My devices" and Earn fleet titles: one arc per slot in fleet-slot order. -->
<template>
  <svg class="slot-ring" width="26" height="26" viewBox="0 0 26 26" :role="loading ? undefined : 'img'" :aria-hidden="loading ? 'true' : undefined" :aria-label="loading ? undefined : label">
    <circle v-for="(tone, i) in tones" :key="i" :class="'slot-ring__seg slot-ring__seg--' + tone" cx="13" cy="13" r="10" fill="none" stroke-width="3.6" :stroke-dasharray="dash" :transform="`rotate(${start + i * step} 13 13)`" :style="{ '--i': i }" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useDataVisibility } from "@/store/data-visibility";
import { useFleetSlots } from "@/composables/use-fleet-slots";

const t = useT();
const app = useApp();
const visibility = useDataVisibility();
const fleet = useFleetSlots();

const CIRCUMFERENCE = 2 * Math.PI * 10;
const GAP_DEG = 9;
const step = computed(() => 360 / Math.max(1, app.slotCap));
const start = computed(() => -90 + GAP_DEG / 2);
const dash = computed(() => {
  const arc = CIRCUMFERENCE * (step.value - GAP_DEG) / 360;
  return `${arc.toFixed(3)} ${(CIRCUMFERENCE - arc).toFixed(3)}`;
});
const loading = computed(() => !fleet.countReady.value);
// Hidden statistics and unconfirmed counts never reveal the ratio (design system 03.10).
const tones = computed(() => loading.value || visibility.hidden
  ? fleet.slots.value.map(() => "mask")
  : fleet.slots.value.map((slot) => slot.kind === "trial" || slot.kind === "device" ? (slot.online ? "on" : "off") : slot.kind === "reserved" ? "reserved" : "empty"));
const label = computed(() => visibility.hidden ? t.value.home.slotRingHidden
  : fmt(t.value.myDevices.inventorySlotMeter, { active: fleet.slotsUsed.value, max: app.slotCap }));
</script>

<style scoped>
.slot-ring { display: block; flex: none; overflow: visible; }
.slot-ring :deep(.slot-ring__seg) { animation: slot-ring-in 320ms ease-out both; animation-delay: calc(var(--i, 0) * 60ms); }
.slot-ring :deep(.slot-ring__seg--on) { stroke: var(--v5-success); }
.slot-ring :deep(.slot-ring__seg--off) { stroke: var(--v5-ink-4); }
.slot-ring :deep(.slot-ring__seg--reserved) { stroke: color-mix(in srgb, var(--v5-brand) 50%, transparent); }
.slot-ring :deep(.slot-ring__seg--empty) { stroke: color-mix(in srgb, var(--v5-ink) 14%, transparent); }
.slot-ring :deep(.slot-ring__seg--mask) { stroke: color-mix(in srgb, var(--v5-ink) 18%, transparent); }
@keyframes slot-ring-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .slot-ring :deep(.slot-ring__seg) { animation: none; } }
</style>
