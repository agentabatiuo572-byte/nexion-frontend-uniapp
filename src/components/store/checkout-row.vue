<!--
  CheckoutRow — label/value row for the checkout "Review order" summary
  (ported from the Row helper in checkout/page.tsx). `big` enlarges the total.
  `code`: the value is an internal number shown in place of a missing name (a product number, a voucher id): an
  NxCodeValue that gives way first, so the label wraps only once the code is at its floor (03 §3.6.1).
-->
<template>
  <view class="flex items-center justify-between" :class="{ 'checkout-row--code': code }">
    <text class="checkout-row__label" style="font-size: 14px; line-height: 20px; color: var(--v5-ink-2)">{{ label }}</text>
    <NxCodeValue v-if="code" :value="value" :label="label" fill />
    <text v-else class="tabular-nums" :style="valueStyle">{{ value }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import NxCodeValue from "@/components/ui/nx-code-value.vue";

const props = defineProps<{ label: string; value: string; big?: boolean; code?: boolean }>();

const valueStyle = computed<CSSProperties>(() => ({
  fontSize: props.big ? "18px" : "var(--ui-type-list-subtitle)",
  fontWeight: props.big ? 600 : 500,
  // big total stays full ink; normal rows use ink/90 (source).
  color: props.big ? "var(--v5-ink)" : "color-mix(in srgb, var(--v5-ink) 90%, transparent)",
}));
</script>

<style scoped>
.checkout-row--code { gap: var(--v5-space-3); }
.checkout-row--code .checkout-row__label { flex: 0 1 auto; min-width: 0; }
</style>
