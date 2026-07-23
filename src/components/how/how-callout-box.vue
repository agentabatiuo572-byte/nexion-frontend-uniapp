<!-- CalloutBox — accent-soft surface with accent border + ink-2 body (how-it-works/parts.tsx CalloutBox). -->
<template>
  <view :style="boxStyle">
    <text class="block" :style="titleStyle">{{ title }}</text>
    <text class="block" :style="bodyStyle">{{ body }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";

type Accent = "lemon" | "purple" | "amber" | "violet" | "nex";

const props = withDefaults(defineProps<{ title: string; body: string; tone?: Accent }>(), { tone: "amber" });

const ACCENT_TEXT: Record<Accent, string> = {
  nex: "var(--v5-nex)",
  lemon: "var(--v5-success)",
  purple: "var(--v5-brand)",
  amber: "var(--v5-warning)",
  violet: "var(--v5-brand-2)",
};
const ACCENT_SOFT: Record<Accent, string> = {
  nex: "var(--v5-nex-soft)",
  lemon: "var(--v5-success-soft)",
  purple: "var(--v5-brand-soft)",
  amber: "var(--v5-warning-soft)",
  violet: "var(--v5-brand-2-soft)",
};
// Callout boxes are the one sanctioned bg+border pairing (accent-callout exception).
const ACCENT_BORDER: Record<Accent, string> = {
  nex: "var(--v5-nex-border)",
  lemon: "color-mix(in srgb, var(--v5-success) 30%, transparent)",
  purple: "var(--v5-brand-border)",
  amber: "color-mix(in srgb, var(--v5-warning) 30%, transparent)",
  violet: "var(--v5-brand-2-border)",
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
