<!--
  CheckoutRow — label/value row for the checkout "Review order" summary
  (ported from the Row helper in checkout/page.tsx). `big` enlarges the total.
-->
<template>
  <view class="flex items-center justify-between">
    <text style="font-size: 12.5px; color: var(--v5-ink-3)">{{ label }}</text>
    <text class="tabular-nums" :style="valueStyle">{{ value }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";

const props = defineProps<{ label: string; value: string; big?: boolean }>();

const valueStyle = computed<CSSProperties>(() => ({
  fontSize: props.big ? "18px" : "13.5px",
  fontWeight: props.big ? 600 : 500,
  color: "var(--v5-ink)",
}));
</script>
