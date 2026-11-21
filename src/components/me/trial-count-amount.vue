<!--
  TrialCountAmount — one counting USDT figure on the trial page (accrued earnings, credit total).
  It owns the countUp renderjs module: uni binds a renderjs module to the component's root element, and
  the trial page's root is AppChassis, whose root view already carries the chassis renderjs owner.
  The page keeps the count config, the digits and the screen-reader text.
-->
<template>
  <text :id="config.hostId" :class="tone === 'earned' ? 'trial-earned__value' : 'trial-total__value'" aria-hidden="true" :count-up="config" :change:count-up="countUp.update"><text class="nx-count--int">{{ parts[0] }}</text><text v-if="parts[1]" :class="[tone === 'earned' ? 'trial-dim' : 'trial-total__dec', 'nx-count--frac']">.{{ parts[1] }}</text></text>
</template>

<script setup lang="ts">
import type { CountUpConfig } from "@/lib/count-up-view";

defineProps<{ config: CountUpConfig; parts: [string, string]; tone: "earned" | "total" }>();
</script>

<script module="countUp" lang="renderjs">
import { countUpView } from "@/lib/count-up-view";
// @ts-expect-error vue-tsc 1.x treats uni's renderjs custom block as a second normal script.
export default countUpView;
</script>

<style scoped>
.trial-earned__value { font:600 44px/50px var(--font-amount);font-variant-numeric:tabular-nums;letter-spacing:-0.024em;white-space:nowrap; }
.trial-dim { color:var(--v5-ink-3); }
.trial-total__value { color:var(--v5-brand);font:600 32px/38px var(--font-amount);font-variant-numeric:tabular-nums;letter-spacing:-0.02em;white-space:nowrap; }
.trial-total__dec { opacity:.72; }
</style>
