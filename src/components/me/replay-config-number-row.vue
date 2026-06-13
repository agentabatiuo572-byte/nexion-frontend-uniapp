<!--
  ReplayConfigNumberRow — label + stepper (−/value/+) for the trial-config panel.
  Ported from the inline ConfigNumberRow in Nexion-prototype me/replay-tour/page.tsx.
-->
<template>
  <view class="flex items-center justify-between" style="gap: 12px">
    <text :style="labelStyle" style="flex: 1">{{ label }}</text>
    <view class="flex items-center" style="gap: 6px">
      <view class="grid place-items-center active:scale-[0.92]" :style="btnStyle" @click="dec">
        <text :style="btnTextStyle">−</text>
      </view>
      <text :style="valueStyle">{{ value }}</text>
      <view class="grid place-items-center active:scale-[0.92]" :style="btnStyle" @click="inc">
        <text :style="btnTextStyle">+</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue";

const props = defineProps<{ label: string; value: number; step: number; min: number; max: number }>();
const emit = defineEmits<{ change: [v: number] }>();

function dec() {
  emit("change", Math.max(props.min, props.value - props.step));
}
function inc() {
  emit("change", Math.min(props.max, props.value + props.step));
}

const labelStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "12px", color: "var(--v5-ink-2)", lineHeight: 1.4 };
const btnStyle: CSSProperties = { width: "28px", height: "28px", borderRadius: "6px", background: "var(--v5-surface-2)" };
const btnTextStyle: CSSProperties = { fontSize: "14px", color: "var(--v5-ink-2)", lineHeight: 1 };
const valueStyle: CSSProperties = {
  minWidth: "44px",
  textAlign: "center",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12.5px",
  color: "var(--v5-ink)",
  fontWeight: 500,
};
</script>
