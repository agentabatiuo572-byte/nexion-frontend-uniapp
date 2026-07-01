<!-- StepRow — numbered accent circle + title + body (how-it-works/parts.tsx StepRow). -->
<template>
  <view class="flex items-start" style="gap: 12px">
    <text class="block shrink-0 grid place-items-center font-mono-tabular" :style="numStyle">{{ n }}</text>
    <view class="min-w-0">
      <text class="block" :style="titleStyle">{{ title }}</text>
      <text class="block" :style="bodyStyle">{{ body }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";

type Accent = "lemon" | "purple" | "amber";

const props = withDefaults(defineProps<{ n: number; title: string; body: string; accent?: Accent }>(), {
  accent: "lemon",
});

const ACCENT_TEXT: Record<Accent, string> = {
  lemon: "var(--v5-success)",
  purple: "var(--v5-brand)",
  amber: "var(--v5-warning)",
};
const ACCENT_SOFT: Record<Accent, string> = {
  lemon: "var(--v5-success-soft)",
  purple: "var(--v5-brand-soft)",
  amber: "var(--v5-warning-soft)",
};
const ACCENT_BORDER: Record<Accent, string> = {
  lemon: "rgba(14,142,74,0.30)",
  purple: "var(--v5-brand-border)",
  amber: "rgba(198,131,22,0.30)",
};

const numStyle = computed<CSSProperties>(() => ({
  width: "28px",
  height: "28px",
  borderRadius: "999px",
  background: ACCENT_SOFT[props.accent],
  border: `1px solid ${ACCENT_BORDER[props.accent]}`,
  color: ACCENT_TEXT[props.accent],
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "12px",
  letterSpacing: "-0.005em",
}));
const titleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.008em",
};
const bodyStyle: CSSProperties = {
  marginTop: "3px",
  fontSize: "12.5px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.5,
};
</script>
