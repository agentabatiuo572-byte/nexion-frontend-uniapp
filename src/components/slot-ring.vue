<!-- Segmented slot ring after the Home "My devices" and Earn fleet titles: one arc per slot in fleet-slot order. -->
<template>
  <view class="slot-ring" :role="loading ? undefined : 'img'" :aria-hidden="loading ? 'true' : undefined" :aria-label="loading ? undefined : label">
    <svg class="slot-ring__svg" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <circle v-for="(tone, i) in tones" :key="i" class="slot-ring__seg" cx="13" cy="13" r="10" fill="none" stroke-width="3.6" :stroke-dasharray="dash" :transform="`rotate(${start + i * step} 13 13)`" :style="{ '--i': i, stroke: STROKES[tone] }" />
    </svg>
  </view>
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
// Strokes are inline so they survive the App's v-html SVG path, where scoped selectors cannot reach.
const STROKES = {
  on: "var(--v5-success)",
  off: "var(--v5-ink-4)",
  reserved: "color-mix(in srgb, var(--v5-brand) 50%, transparent)",
  empty: "color-mix(in srgb, var(--v5-ink) 14%, transparent)",
  mask: "color-mix(in srgb, var(--v5-ink) 18%, transparent)",
} as const;
const loading = computed(() => !fleet.countReady.value);
// Hidden statistics and unconfirmed counts never reveal the ratio (design system 03.10).
const tones = computed<(keyof typeof STROKES)[]>(() => loading.value || visibility.hidden
  ? fleet.slots.value.map(() => "mask")
  : fleet.slots.value.map((slot) => slot.kind === "trial" || slot.kind === "device" ? (slot.online ? "on" : "off")
    : slot.kind === "pending" ? "off" : slot.kind === "reserved" ? "reserved" : "empty"));
const label = computed(() => visibility.hidden ? t.value.home.slotRingHidden
  : fmt(t.value.myDevices.inventorySlotMeter, { active: fleet.slotsUsed.value, max: app.slotCap }));
</script>

<style scoped>
.slot-ring { display: block; flex: none; width: 26px; height: 26px; line-height: 0; }
.slot-ring :deep(.slot-ring__svg) { display: block; overflow: visible; }
.slot-ring :deep(.slot-ring__seg) { animation: slot-ring-in 320ms ease-out both; animation-delay: calc(var(--i, 0) * 60ms); }
@keyframes slot-ring-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .slot-ring :deep(.slot-ring__seg) { animation: none; } }
</style>
