<!--
  NxTickNumber — a platform display figure that is already formatted (a band such as 3.2K+ or $1.2M+, from
  networkPopulationBand / platformAmountBand). A roll starts only at the moment the text changes while this figure
  is on screen, its page is shown, the chassis is not scrolling and reduced motion is off; then only the changed
  characters roll in from below. Any other change swaps the text in place. The roll state is cleared when the
  roll ends or is cut short (the figure leaves view, the chassis starts scrolling), so coming back into view or
  scrolling never replays it. Screen readers read the whole figure once. null renders "—".
-->
<template>
  <text ref="elRef" class="nx-tick"><text class="nx-sr-only">{{ shown }}</text><text v-for="c in chars" :key="c.key" class="nx-tick__ch" :class="{ 'nx-tick__ch--roll': c.roll }" aria-hidden="true">{{ c.ch }}</text></text>
</template>

<script setup lang="ts">
import { computed, inject, onUnmounted, ref, watch } from "vue";
import { CHASSIS_SCROLLING, useLoopsInView } from "@/composables/use-loops-in-view";

const props = defineProps<{ text: string | null }>();
const shown = computed(() => props.text ?? "—");
const { elRef, running } = useLoopsInView(".nx-tick");
const scrolling = inject(CHASSIS_SCROLLING, null);
const ROLL_MS = 360;
let settle: ReturnType<typeof setTimeout> | undefined;

function reducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function clearRoll() {
  clearTimeout(settle);
  settle = undefined;
  if (chars.value.some(c => c.roll)) chars.value = chars.value.map(c => c.roll ? { ...c, roll: false } : c);
}

// Each character is keyed by its place counted from the right, so a changed character is a new node,
// while unchanged ones keep their node. The band's trailing "+" stays with the letter before it ("K+"),
// so it reads as part of the figure, not a separate sign.
const chars = ref<{ ch: string; key: string; roll: boolean }[]>([]);
watch(shown, (next, previous) => {
  clearRoll();
  const animate = previous !== undefined && previous !== "—" && next !== "—"
    && running.value && !scrolling?.value && !reducedMotion();
  const before = animate ? new Set(chars.value.map(c => c.key)) : null;
  const units = next.match(/.\+?/gsu) ?? [];
  chars.value = units.map((ch, i) => {
    const key = `${units.length - i}:${ch}`;
    return { ch, key, roll: before !== null && !before.has(key) };
  });
  if (chars.value.some(c => c.roll)) settle = setTimeout(clearRoll, ROLL_MS + 40);
}, { immediate: true });
// A roll cut short by leaving view or by scrolling ends there; it never resumes later.
watch(() => running.value && !scrolling?.value, active => { if (!active) clearRoll(); });
onUnmounted(() => clearTimeout(settle));
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
