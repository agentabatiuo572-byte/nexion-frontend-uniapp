<!-- CalloutBox — accent-soft surface with accent border + ink-2 body (how-it-works/parts.tsx CalloutBox). -->
<template>
  <view :style="boxStyle">
    <text class="block" :style="titleStyle">{{ title }}</text>
    <text class="block" :style="bodyStyle">{{ body }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";

type Accent = "lemon" | "purple" | "amber";

const props = withDefaults(defineProps<{ title: string; body: string; tone?: Accent }>(), { tone: "amber" });

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

const boxStyle = computed<CSSProperties>(() => ({
  marginTop: "10px",
  background: ACCENT_SOFT[props.tone],
  border: `1px solid ${ACCENT_BORDER[props.tone]}`,
  borderRadius: "12px",
  padding: "10px 14px",
}));
const titleStyle = computed<CSSProperties>(() => ({
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "12.5px",
  color: ACCENT_TEXT[props.tone],
}));
const bodyStyle: CSSProperties = {
  marginTop: "2px",
  fontSize: "12px",
  color: "var(--v5-ink-2)",
  lineHeight: 1.5,
};
</script>
