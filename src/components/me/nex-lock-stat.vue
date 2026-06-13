<!--
  NexLockStat — small tinted stat tile (label + value) for the NEX v2 lock hero.
  Ported from the inline Stat in Nexion-prototype me/wallet/nex-v2-lock/page.tsx.
-->
<template>
  <view class="text-center" :style="boxStyle">
    <text class="block" :style="labelStyle">{{ label }}</text>
    <text class="block" :style="valueStyle">{{ value }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";

const props = defineProps<{ label: string; value: string; tint: string }>();

const boxStyle = computed<CSSProperties>(() => ({
  padding: "10px",
  borderRadius: "10px",
  background: `color-mix(in oklab, ${props.tint} 12%, transparent)`,
  border: `1px solid color-mix(in oklab, ${props.tint} 26%, transparent)`,
}));
const labelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
const valueStyle = computed<CSSProperties>(() => ({
  marginTop: "4px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "15px",
  letterSpacing: "-0.014em",
  color: props.tint,
}));
</script>
