<!--
  TicketStatBox — tinted stat tile (icon + label + count) for the tickets list
  header. Ported from the inline StatBox in Nexion-prototype me/support/tickets/page.tsx.
  Icon is an inline SVG string with `stroke="currentColor"` so it inherits `tint`.
-->
<template>
  <view :style="boxStyle" role="button" tabindex="0" :aria-label="label" @click="emit('select')">
    <view class="flex items-center" :style="headStyle">
      <view v-html="icon" />
      <text class="truncate" style="margin-left: 4px">{{ label }}</text>
    </view>
    <text class="block" :style="valueStyle">{{ value }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";

const props = defineProps<{ tint: string; label: string; value: number; icon: string }>();
const emit = defineEmits<{ select: [] }>();

const boxStyle = computed<CSSProperties>(() => ({
  borderRadius: "16px",
  padding: "12px",
  background: `color-mix(in srgb, ${props.tint} 10%, transparent)`,
  border: `1px solid color-mix(in srgb, ${props.tint} 33%, transparent)`,
}));
const headStyle = computed<CSSProperties>(() => ({
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10px",
  color: props.tint,
}));
const valueStyle: CSSProperties = {
  marginTop: "4px",
  fontFamily: "var(--font-v5)",
  fontSize: "20px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  lineHeight: 1,
};
</script>
