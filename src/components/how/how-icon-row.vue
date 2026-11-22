<!-- IconRow — a line glyph in the shared tile + label + body (how-it-works/parts.tsx IconRow; 03 §3.6.1: no emoji as icons). -->
<template>
  <view :style="outerStyle">
    <view :style="gridStyle">
      <NxIconTile :tone="tone" size="m"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="icon" /></svg></NxIconTile>
      <view class="min-w-0">
        <text class="block" :style="labelStyle">{{ label }}</text>
        <text class="block" :style="bodyStyle">{{ body }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue";
import NxIconTile from "@/components/ui/nx-icon-tile.vue";

defineProps<{ icon: string; tone: "purple" | "sky" | "amber" | "teal"; label: string; body: string }>();

const outerStyle: CSSProperties = {
  background: "var(--v5-surface-2)",
  borderRadius: "12px",
  padding: "12px",
};
const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "40px 1fr",
  gap: "12px",
  alignItems: "flex-start",
};
// Typography pass 2026-07-08 — label 13.5, body 13/1.62 ink-2 (was a wall of text).
const labelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13px",
  lineHeight: 1.4,
  color: "var(--v5-ink)",
  letterSpacing: "-0.008em",
};
const bodyStyle: CSSProperties = {
  marginTop: "5px",
  fontSize: "var(--ui-type-long-form)",
  color: "var(--v5-ink-2)",
  lineHeight: "var(--ui-type-long-form-lh)",
};
</script>
