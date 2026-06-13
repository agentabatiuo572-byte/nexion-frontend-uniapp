<!--
  ReplayDemoAction — icon + title/hint + accent CTA chip row for the demo lifecycle
  panel. Ported from the inline DemoAction in Nexion-prototype me/replay-tour/page.tsx.
  Icon is an inline SVG string with `stroke` set by the caller. Emits `tap`.
-->
<template>
  <view class="w-full flex items-center active:scale-[0.99] active:opacity-90" :style="cardStyle" @click="emit('tap')">
    <view class="grid place-items-center shrink-0" :style="iconBoxStyle">
      <view v-html="icon" />
    </view>
    <view class="min-w-0" style="flex: 1">
      <text class="block" :style="titleStyle">{{ title }}</text>
      <text class="block" :style="hintStyle">{{ hint }}</text>
    </view>
    <view class="shrink-0 inline-flex items-center" :style="ctaStyle">
      <text>{{ ctaLabel }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";

const props = defineProps<{ icon: string; accent: string; title: string; hint: string; ctaLabel: string }>();
const emit = defineEmits<{ tap: [] }>();

const cardStyle: CSSProperties = {
  gap: "12px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  padding: "14px",
  textAlign: "left",
};
const iconBoxStyle = computed<CSSProperties>(() => ({
  width: "40px",
  height: "40px",
  borderRadius: "12px",
  background: `color-mix(in srgb, ${props.accent} 10%, transparent)`,
}));
const titleStyle: CSSProperties = { fontSize: "13.5px", fontWeight: 600, color: "var(--v5-ink)" };
const hintStyle: CSSProperties = { fontSize: "11px", color: "var(--v5-ink-3)", marginTop: "2px", lineHeight: 1.4 };
const ctaStyle = computed<CSSProperties>(() => ({
  height: "32px",
  padding: "0 12px",
  borderRadius: "999px",
  fontSize: "11.5px",
  fontWeight: 600,
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  background: `color-mix(in srgb, ${props.accent} 12%, transparent)`,
  color: props.accent,
}));
</script>
