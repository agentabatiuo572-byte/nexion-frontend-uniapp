<!--
  StoreHero — store top hook (ported from store/page.tsx StoreHeroV5 +
  StoreHeroArt). The store's focal soft-glass card (01 §1.1.2) with its aurora drift + "Climb to 117× daily yield" + tier-ladder
  SVG schematic. SVG fill/stroke use var(--v5-*) tokens so it auto-themes.
-->
<template>
  <view
    class="nx-soft-glass relative overflow-hidden grid items-center"
    :style="rootStyle"
  >
    <view ref="auroraRef" aria-hidden class="store-hero__aurora" :class="{ 'is-paused': !auroraLoop.running.value }" />
    <view class="relative min-w-0">
      <text class="block font-mono-tabular" style="font-size: 12px; color: var(--v5-brand-2-ink)">{{ t.store.heroEyebrow }}</text>
      <text v-if="multiplier !== null" class="block" :style="titleStyle">{{ t.store.heroTitlePre }} <text style="color: var(--v5-brand-2-ink)">{{ multiplierText }}</text> {{ t.store.heroTitlePost }}</text>
      <text v-else class="block" :style="titleStyle">{{ t.store.secMoreTiers }}</text>
      <text class="block" style="margin-top: 8px; font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-3); line-height: 1.45">{{ t.store.heroSub }}</text>
    </view>
    <view class="relative">
      <!-- StoreHeroArt — tier ladder schematic -->
      <svg viewBox="0 0 100 110" width="100" height="110" aria-hidden>
        <rect x="6" y="78" width="24" height="22" rx="3" fill="var(--v5-surface-2)" stroke="var(--v5-border)" />
        <rect x="32" y="58" width="24" height="42" rx="3" fill="var(--v5-tech-cyan-soft)" />
        <rect x="58" y="30" width="24" height="70" rx="3" fill="var(--v5-tech-cyan)" />
        <circle cx="11" cy="84" r="1" fill="var(--v5-ink-4)" />
        <circle cx="37" cy="64" r="1" fill="var(--v5-tech-cyan)" />
        <circle cx="37" cy="68" r="1" fill="var(--v5-tech-cyan)" opacity="0.6" />
        <path d="M3,80 L9,73 M3,80 L9,86 M3,80 L88,28" fill="none" stroke="var(--v5-brand-2-ink)" stroke-width="1" stroke-dasharray="3 3" opacity="0.65" />
        <g transform="translate(86, 24)">
          <path d="M0,-4 L1,-1 L4,0 L1,1 L0,4 L-1,1 L-4,0 L-1,-1 Z" fill="var(--v5-brand-2)" />
        </g>
      </svg>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { useLoopsInView } from "@/composables/use-loops-in-view";

const t = useT();
const props = defineProps<{ multiplier: number | null }>();
const multiplierText = computed(() => props.multiplier === null ? "—×" : `${props.multiplier}×`);
// The aurora drifts only while it is on screen and the page is shown.
const auroraLoop = useLoopsInView(".store-hero__aurora");
const auroraRef = auroraLoop.elRef;

const rootStyle: CSSProperties = {
  borderRadius: "20px",
  padding: "20px",
  gridTemplateColumns: "minmax(0,1fr) 100px",
  gap: "12px",
};

const titleStyle: CSSProperties = {
  marginTop: "6px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "26px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.024em",
  lineHeight: 1.1,
};


</script>
<style scoped>
.store-hero__aurora {
  position: absolute; inset: -20%; pointer-events: none; opacity: .85; filter: blur(8px);
  background:
    radial-gradient(40% 50% at 80% 20%, var(--v5-tech-cyan-soft) 0%, transparent 60%),
    radial-gradient(40% 50% at 10% 80%, var(--v5-brand-soft) 0%, transparent 60%),
    radial-gradient(35% 45% at 70% 90%, rgba(255,203,148,0.25) 0%, transparent 60%);
  animation: v5-aurora-drift 14s ease-in-out infinite alternate;
}
.store-hero__aurora.is-paused { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .store-hero__aurora { animation: none; } }
</style>
