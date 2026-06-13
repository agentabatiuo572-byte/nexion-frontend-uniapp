<!--
  TxStat — bordered stat tile (label + value) for the tx explorer hero.
  Ported from the inline Stat in Nexion-prototype tx/[hash]/page.tsx.
-->
<template>
  <view :style="boxStyle">
    <text class="block" :style="labelStyle">{{ label }}</text>
    <text class="block" :style="valueStyle">{{ value }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";

const props = defineProps<{ label: string; value: string; tint?: string }>();

const boxStyle: CSSProperties = {
  borderRadius: "12px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  padding: "8px 0",
};
const labelStyle: CSSProperties = { fontSize: "10px", color: "var(--v5-ink-3)" };
const valueStyle = computed<CSSProperties>(() => ({
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 600,
  marginTop: "2px",
  color: props.tint ?? "var(--v5-ink)",
}));
</script>
