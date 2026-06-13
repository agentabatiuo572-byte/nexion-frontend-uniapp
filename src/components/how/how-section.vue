<!--
  HowSection — quiet light surface card with an accent icon chip + section
  title (ported from how-it-works/parts.tsx HowSection). The icon is provided
  via the `icon` slot (inline <svg stroke="currentColor">) so colour inherits
  the accent. Body content goes in the default slot.
  Accent: lemon=success / amber=warning / purple=brand.
-->
<template>
  <view class="mx-4 mt-4" :style="cardStyle">
    <view class="flex items-center" style="gap: 10px; margin-bottom: 14px">
      <view class="grid place-items-center shrink-0" :style="chipStyle">
        <slot name="icon" />
      </view>
      <text :style="titleStyle">{{ title }}</text>
    </view>
    <slot />
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";

type Accent = "lemon" | "purple" | "amber";

const props = withDefaults(defineProps<{ title: string; accent?: Accent }>(), { accent: "lemon" });

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

const cardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  padding: "18px",
};
const chipStyle = computed<CSSProperties>(() => ({
  width: "32px",
  height: "32px",
  borderRadius: "10px",
  background: ACCENT_SOFT[props.accent],
  border: `1px solid ${ACCENT_BORDER[props.accent]}`,
  color: ACCENT_TEXT[props.accent],
}));
const titleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 600,
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
};
</script>
