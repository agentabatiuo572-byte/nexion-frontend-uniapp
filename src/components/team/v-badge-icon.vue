<!--
  VBadgeIcon — ported from Nexion-prototype/app/components/v3/v-badge.tsx (VBadgeIcon).
  Square V-rank chip showing just the level digit; colour climbs with level.
  Used by rank-how.vue's 13-rank ladder. <div>→<view>, digit leaf→<text>.
-->
<template>
  <view class="rounded-xl grid place-items-center font-display tabular-nums" :style="boxStyle">
    <text :style="digitStyle">{{ v }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import type { VRank } from "@/store/v-rank";

const props = withDefaults(defineProps<{ v: VRank; size?: number }>(), { size: 32 });

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

const c = computed(() => COLORS[props.v]);

const boxStyle = computed<CSSProperties>(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  background: c.value.bg,
  boxShadow: `inset 0 0 0 1px ${c.value.ring}`,
  color: c.value.text,
}));
const digitStyle = computed<CSSProperties>(() => ({
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: `${props.size * 0.45}px`,
  color: c.value.text,
}));
</script>
