<!--
  NxTickNumber — a platform display figure that is already formatted (a band such as 3.2K+ or $1.2M+, from
  networkPopulationBand / platformAmountBand). When the text changes, only the characters that changed roll in from
  below; the rest stay put. A change while the owner is off-screen, its page hidden or the chassis scrolling swaps
  without the roll (device-presence.css), and reduced motion never rolls. Screen readers read the whole figure once.
  null renders "—".
-->
<template>
  <text class="nx-tick"><text class="nx-sr-only">{{ shown }}</text><text v-for="c in chars" :key="c.key" class="nx-tick__ch" :class="{ 'nx-tick__ch--roll': c.roll }" aria-hidden="true">{{ c.ch }}</text></text>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = defineProps<{ text: string | null }>();
const shown = computed(() => props.text ?? "—");
// Each character is keyed by its place counted from the right, so a changed character is a new node and
// replays the roll, while unchanged ones keep their node. The first figure and "—" never roll. The band's
// trailing "+" stays with the letter before it ("K+"), so it reads as part of the figure, not a separate sign.
const chars = ref<{ ch: string; key: string; roll: boolean }[]>([]);
watch(shown, (next, previous) => {
  const before = previous === undefined || previous === "—" || next === "—" ? null : new Set(chars.value.map(c => c.key));
  const units = next.match(/.\+?/gsu) ?? [];
  chars.value = units.map((ch, i) => {
    const key = `${units.length - i}:${ch}`;
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
