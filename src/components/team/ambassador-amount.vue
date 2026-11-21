<template>
  <!-- Design system 01 §1.2: integer in ink, decimals and unit in the muted role; hidden data shows the mask. -->
  <view class="amb-amount" :class="[`amb-amount--${size}`, { 'amb-amount--long': !visibility.hidden && parts && (parts.integer + parts.fraction).length > 12 }]">
    <text class="amb-amount__number">
      <template v-if="visibility.hidden">{{ visibility.mask("") }}</template>
      <template v-else-if="parts">{{ parts.integer }}<text class="amb-amount__dec">{{ parts.fraction }}</text></template>
      <template v-else>—</template>
    </text>
    <text class="amb-amount__unit">USDT</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDataVisibility } from "@/store/data-visibility";
import { ambassadorAmountParts } from "@/lib/ambassador-display";

const props = withDefaults(defineProps<{ value: number | null; size?: "row" | "hero" }>(), { size: "row" });
const visibility = useDataVisibility();
const parts = computed(() => ambassadorAmountParts(props.value));
</script>

<style scoped>
.amb-amount { display: inline-flex; flex-wrap: wrap; align-items: baseline; justify-content: flex-end; gap: 0 var(--v5-space-1); min-width: 0; max-width: 100%; font: var(--ui-type-list-title-weight, 500) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); font-variant-numeric: tabular-nums; }
.amb-amount__number { min-width: 0; max-width: 100%; overflow-wrap: anywhere; }
.amb-amount__dec { color: var(--v5-ink-3); }
.amb-amount__unit { font: var(--ui-type-chip-weight) var(--ui-type-chip)/var(--ui-type-chip-lh) var(--font-v5); color: var(--v5-ink-3); }
.amb-amount--long { font-size: max(12px, calc(var(--ui-type-list-title) - 1px)); }
.amb-amount--hero { font-family: var(--font-amount); font-weight: 500; font-size: 28px; line-height: 34px; letter-spacing: -0.02em; }
.amb-amount--hero.amb-amount--long { font-size: 18px; line-height: 26px; }
.amb-amount--hero .amb-amount__unit { letter-spacing: 0; }
</style>
