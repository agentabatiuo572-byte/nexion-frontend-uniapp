<!--
  GenesisDockHost — chassis-level sticky Genesis CTA dock. Ported from
  Nexion-prototype/app/components/genesis-dock-host.tsx.
    · lucide Crown / ChevronRight → inline <svg>
    · framer-less; the sheen uses the shared `gen-sheen` @keyframes already in
      tokens.css (P-023), so no scoped/inline keyframe is needed.
    · <button onClick> → <view @click> (uni resets native button chrome, P-036)
    · all bare text wrapped in <text> (P-026)

  Visibility is driven by useGenesisDock (the /genesis page calls show() on mount
  / hide() on unmount). Sold/price come from useGenesis. Mounted once at the
  chassis level (like the prototype's <GenesisDockHost> inside <IOSFrame>), it
  pins to the chassis viewport bottom (bottom:0) — Genesis is a SUB route, so the
  5-tab pill is hidden and only the home-indicator ink bar shows beneath; the
  dock absorbs the safe area via its own 24px bottom padding.

  The prototype dispatches useGenesisSheet().openSheet(); the uni genesis page
  owns its purchase sheet via a local `v-model:open` ref (no chassis-level genesis
  sheet store), so this host emits `@reserve` — the orchestrator wires it to open
  that sheet. Sold-out → disabled (no emit).
-->
<template>
  <view v-if="dock.visible" class="gdh-root">
    <view class="gdh-bar">
      <view
        class="gdh-btn"
        :class="{ 'gdh-btn--sold': remaining === 0 }"
        :style="btnStyle"
        @click="onReserve"
      >
        <template v-if="remaining > 0">
          <!-- top specular reflection (curved highlight band) -->
          <view aria-hidden class="gdh-specular" />
          <!-- bottom rim brightness (gold hairline) -->
          <view aria-hidden class="gdh-rim" />
          <!-- sheen sweep (shared gen-sheen keyframes) -->
          <view aria-hidden class="gdh-sheen" />
        </template>

        <view class="gdh-label-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4AF5A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M5 20h14" /></svg>
          <text class="gdh-cta" :style="ctaTextStyle">{{ remaining > 0 ? t.genesis.ctaReserve : t.genesis.ctaSoldOut }}</text>
          <template v-if="remaining > 0">
            <view class="gdh-divider" />
            <text class="tabular-nums gdh-price">${{ priceText }}</text>
          </template>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4AF5A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { useGenesis } from "@/store/genesis";
import { useGenesisDock } from "@/store/genesis-dock";

const emit = defineEmits<{ reserve: [] }>();

const t = useT();
const genesis = useGenesis();
const dock = useGenesisDock();

const sold = computed(() => genesis.soldSlots);
const total = computed(() => genesis.totalSlots);
const price = computed(() => genesis.unitPriceUSDT);
const remaining = computed(() => total.value - sold.value);
const priceText = computed(() => price.value.toLocaleString());

// Liquid-Glass gold body (faithful to genesis-dock-host.tsx). Translucent
// gold-tinted material + backdrop blur/saturate so it refracts the dock gradient
// + chassis content underneath; specular/rim/glow shadows give the curved-glass
// read. Sold-out → flat recessed surface, not-allowed.
const btnStyle = computed<CSSProperties>(() => {
  const ok = remaining.value > 0;
  return {
    height: "54px",
    borderRadius: "999px",
    background: ok
      ? "linear-gradient(180deg, rgba(50,38,20,0.55) 0%, rgba(20,14,8,0.72) 100%)"
      : "var(--v5-surface-2)",
    backdropFilter: ok ? "blur(24px) saturate(200%)" : "",
    WebkitBackdropFilter: ok ? "blur(24px) saturate(200%)" : "",
    border: ok ? "1px solid rgba(212,175,90,0.55)" : "1px solid var(--v5-border)",
    color: ok ? "#F4E5C2" : "var(--v5-ink-4)",
    fontFamily: "var(--font-v5)",
    fontWeight: 500,
    fontSize: "14px",
    letterSpacing: "0.02em",
    boxShadow: ok
      ? [
          "inset 0 1px 0 rgba(255,255,255,0.40)",
          "inset 0 -1px 0 rgba(0,0,0,0.50)",
          "inset 0 0 0 1px rgba(212,175,90,0.18)",
          "0 0 24px rgba(212,175,90,0.20)",
          "0 14px 30px rgba(0,0,0,0.45)",
        ].join(", ")
      : "none",
  };
});
const ctaTextStyle = computed<CSSProperties>(() => ({
  color: remaining.value > 0 ? "#F4E5C2" : "var(--v5-ink-4)",
  fontWeight: 600,
}));

function onReserve() {
  if (remaining.value === 0) return;
  emit("reserve");
}
</script>

<style scoped>
.gdh-root {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 35;
}
.gdh-bar {
  padding: 12px 16px 24px;
  /* canonical sticky-bar tokens (cream in light, obsidian in dark) — matches the
     prototype StickyCTABar / GenesisDockHost so chassis bottom bars stay
     consistent across themes (a hardcoded cream rgba would break dark mode). */
  background: var(--v5-sticky-bar-bg);
  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  border-top: 1px solid var(--v5-sticky-bar-border);
}
.gdh-btn {
  position: relative;
  width: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.12s;
}
.gdh-btn:active {
  transform: scale(0.99);
}
.gdh-specular {
  position: absolute;
  top: 1px;
  left: 1px;
  right: 1px;
  height: 55%;
  border-radius: 999px 999px 200px 200px / 999px 999px 40px 40px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.06) 55%, transparent 100%);
  pointer-events: none;
}
.gdh-rim {
  position: absolute;
  left: 14%;
  right: 14%;
  bottom: 1px;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(212, 175, 90, 0.55) 50%, transparent 100%);
  pointer-events: none;
}
.gdh-sheen {
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, 0.18) 50%, transparent 70%);
  transform: translateX(-100%);
  animation: gen-sheen 4.5s ease-in-out infinite;
  pointer-events: none;
}
.gdh-label-row {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.gdh-cta {
  font-family: var(--font-v5);
}
.gdh-divider {
  width: 1px;
  height: 14px;
  background: rgba(212, 175, 90, 0.4);
  margin: 0 4px;
}
.gdh-price {
  color: #f4e5c2;
}
</style>
