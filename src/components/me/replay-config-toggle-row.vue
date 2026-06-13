<!--
  ReplayConfigToggleRow — label + switch for the trial-config panel. Ported from
  the inline ConfigToggleRow in Nexion-prototype me/replay-tour/page.tsx. Knob is a
  hardware-replica white pill (intentional, both themes).
-->
<template>
  <view class="flex items-center justify-between" style="gap: 12px">
    <text :style="labelStyle" style="flex: 1">{{ label }}</text>
    <view class="relative active:opacity-90" :style="trackStyle" @click="emit('change', !value)">
      <view :style="knobStyle" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";

const props = defineProps<{ label: string; value: boolean }>();
const emit = defineEmits<{ change: [v: boolean] }>();

const labelStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "12px", color: "var(--v5-ink-2)", lineHeight: 1.4 };
const trackStyle = computed<CSSProperties>(() => ({
  height: "22px",
  width: "38px",
  borderRadius: "999px",
  background: props.value ? "var(--v5-brand)" : "var(--v5-surface-3)",
}));
const knobStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  top: "2px",
  width: "18px",
  height: "18px",
  borderRadius: "999px",
  background: "#FFFFFF",
  transform: props.value ? "translateX(18px)" : "translateX(2px)",
  transition: "transform 150ms ease",
  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
}));
</script>
