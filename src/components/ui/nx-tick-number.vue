<!--
  NxTickNumber — a whole count with thousands separators (en-US grouping on every page and in every
  language, e.g. 2,968). When the value changes, only the digits that changed roll in from below; the
  rest stay put. Reduced motion shows the new figure without movement. Screen readers read the whole
  figure once instead of the separate digits. null renders "—".
-->
<template>
  <text class="nx-tick"><text class="nx-sr-only">{{ text }}</text><text v-for="c in chars" :key="c.key" class="nx-tick__ch" :class="{ 'nx-tick__ch--roll': c.roll }" aria-hidden="true">{{ c.ch }}</text></text>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = defineProps<{ value: number | null }>();
const text = computed(() => props.value === null ? "—" : props.value.toLocaleString("en-US"));
// Each character is keyed by its place counted from the right, so a changed digit is a new node and
// replays the roll, while unchanged digits keep their node. The first figure and "—" never roll.
const chars = ref<{ ch: string; key: string; roll: boolean }[]>([]);
watch(text, (next, previous) => {
  const before = previous === undefined || previous === "—" || next === "—" ? null : new Set(chars.value.map(c => c.key));
  chars.value = Array.from(next, (ch, i) => {
    const key = `${next.length - i}:${ch}`;
    return { ch, key, roll: before !== null && !before.has(key) };
  });
}, { immediate: true });
</script>

<style scoped>
.nx-tick { font-variant-numeric: tabular-nums; white-space: nowrap; }
.nx-tick__ch { display: inline-block; }
.nx-tick__ch--roll { animation: nx-tick-roll 360ms cubic-bezier(.2, .8, .2, 1) both; }
@keyframes nx-tick-roll { from { opacity: 0; transform: translateY(.55em); } }
@media (prefers-reduced-motion: reduce) {
  .nx-tick__ch--roll { animation: none; }
}
</style>
