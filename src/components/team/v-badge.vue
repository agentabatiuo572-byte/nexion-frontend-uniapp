<!--
  VBadge — ported from Nexion-prototype/app/components/v3/v-badge.tsx.
  V-rank title pill (V0-V12); colour climbs with level. showTitle toggles the
  english title text. Gradient badges (V10+) add a text-shadow for legibility.
  Reused by team.vue + binary.vue. <span>→<text> (badge is inline text).
-->
<template>
  <text class="nx-vbadge font-mono-tabular" :style="badgeStyle">
    <text :style="vTextStyle">V{{ v }}</text>
    <text v-if="showTitle" class="font-display" :style="titleStyle">{{ def.title }}</text>
  </text>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { V_RANKS, type VRank } from "@/store/v-rank";

const props = withDefaults(
  defineProps<{ v: VRank; size?: "sm" | "md" | "lg"; showTitle?: boolean }>(),
  { size: "md", showTitle: true },
);

interface ColorSpec {
  bg: string;
  ring: string;
  text: string;
}

const COLORS: Record<number, ColorSpec> = {
  0: { bg: "rgba(138,149,168,0.15)", ring: "rgba(138,149,168,0.35)", text: "var(--v5-ink-3)" },
  1: { bg: "rgba(138,149,168,0.18)", ring: "rgba(138,149,168,0.40)", text: "#B0B8C5" },
  2: { bg: "rgba(138,149,168,0.20)", ring: "rgba(138,149,168,0.45)", text: "#D0D5DE" },
  3: { bg: "rgba(198,255,58,0.12)", ring: "rgba(198,255,58,0.35)", text: "var(--v5-brand)" },
  4: { bg: "rgba(198,255,58,0.16)", ring: "rgba(198,255,58,0.45)", text: "#D4FF55" },
  5: { bg: "rgba(124,92,255,0.18)", ring: "rgba(124,92,255,0.40)", text: "var(--v5-tech-cyan)" },
  6: { bg: "rgba(124,92,255,0.22)", ring: "rgba(124,92,255,0.50)", text: "#A88FFF" },
  7: { bg: "rgba(245,165,36,0.18)", ring: "rgba(245,165,36,0.40)", text: "var(--v5-warning)" },
  8: { bg: "rgba(245,165,36,0.22)", ring: "rgba(245,165,36,0.50)", text: "#FFCB5F" },
  9: { bg: "rgba(245,165,36,0.26)", ring: "rgba(245,165,36,0.55)", text: "#FFD982" },
  10: { bg: "linear-gradient(135deg,var(--v5-brand) 0%,var(--v5-tech-cyan) 100%)", ring: "rgba(255,255,255,0.35)", text: "var(--v5-ink)" },
  11: { bg: "linear-gradient(135deg,var(--v5-tech-cyan) 0%,var(--v5-warning) 100%)", ring: "rgba(255,255,255,0.35)", text: "var(--v5-ink)" },
  12: { bg: "linear-gradient(135deg,var(--v5-warning) 0%,var(--v5-brand-2) 50%,var(--v5-brand) 100%)", ring: "rgba(255,255,255,0.45)", text: "var(--v5-ink)" },
};

const SIZES = {
  sm: { padding: "2px 6px", fontSize: "10px", gap: "4px" },
  md: { padding: "3px 8px", fontSize: "11px", gap: "4px" },
  lg: { padding: "4px 10px", fontSize: "13.5px", gap: "6px" },
} as const;

const def = computed(() => V_RANKS[props.v]);
const c = computed(() => COLORS[props.v]);
const sz = computed(() => SIZES[props.size]);
const isGradient = computed(() => c.value.bg.startsWith("linear"));

const badgeStyle = computed<CSSProperties>(() => ({
  display: "inline-flex",
  alignItems: "center",
  gap: sz.value.gap,
  padding: sz.value.padding,
  borderRadius: "6px",
  fontWeight: 600,
  letterSpacing: "0.05em",
  fontSize: sz.value.fontSize,
  background: c.value.bg,
  boxShadow: `inset 0 0 0 1px ${c.value.ring}`,
  color: c.value.text,
}));

const vTextStyle = computed<CSSProperties>(() => ({
  color: c.value.text,
  textShadow: isGradient.value ? "0 1px 2px rgba(0,0,0,0.4)" : undefined,
}));

const titleStyle = computed<CSSProperties>(() => ({
  fontWeight: 600,
  color: c.value.text,
  textShadow: isGradient.value ? "0 1px 2px rgba(0,0,0,0.4)" : undefined,
}));
</script>
