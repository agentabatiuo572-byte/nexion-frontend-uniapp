<!--
  TeamLedgerCard — ported from Nexion-prototype/app/components/team/
  team-ledger-card.tsx. Aggregate "this month" commission card: big $ amount,
  direct/extended split bar, settled/cooling footer. Decorative 24px grid +
  aurora blob + drifting dots reuse v5-aurora-drift / v5-dot-drift keyframes
  (tokens.css, PITFALLS P-023). View-details → /team/commissions.
  i18n read directly via useT (parent passes numeric values as props).
  <div>→<view>; <span>→<text>; <Link>→<view @click>.
-->
<template>
  <view class="relative overflow-hidden" :style="rootStyle">
    <!-- 24px grid overlay -->
    <view aria-hidden="true" :style="gridStyle" />
    <!-- aurora blob -->
    <view aria-hidden="true" :style="auroraStyle" />
    <!-- drifting dots -->
    <view aria-hidden="true" :style="dotsLayerStyle">
      <view v-for="(d, i) in DOTS" :key="i" :style="dotStyle(d)" />
    </view>

    <view class="relative" style="z-index: 1">
      <view class="flex items-center justify-between" style="margin-bottom: 6px">
        <text class="font-mono-tabular" :style="capLabelStyle">{{ t.teamV3.thisMonth }}</text>
        <view class="nx-team-commissions-link inline-flex items-center active:opacity-70" style="gap: 2px" @click="goCommissions">
          <text :style="{ fontSize: '12px', color: 'var(--v5-ink-3)' }">{{ t.teamV3.viewDetails }}</text>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </view>
      </view>

      <view class="flex items-baseline" style="gap: 10px; flex-wrap: wrap">
        <view class="flex items-baseline" style="gap: 6px">
          <text class="font-display tabular-nums" :style="dollarSignStyle">$</text>
          <text class="font-display tabular-nums" :style="bigNumStyle">{{ intPart.toLocaleString() }}<text :style="fracStyle">.{{ fracPart }}</text></text>
        </view>
        <text class="font-mono-tabular" :style="nexStyle">+ {{ monthNEX.toLocaleString() }} NEX</text>
      </view>

      <text class="block font-mono-tabular" :style="lifetimeStyle">
        {{ t.teamV3.lifetime }} ${{ totalUSDTLifetime.toFixed(2) }} · {{ contributors }} contributors · <text :style="{ color: 'var(--v5-success)' }">↑ +12.4%</text>
      </text>

      <!-- split bar -->
      <view :style="splitWrapStyle">
        <view class="flex overflow-hidden" :style="splitBarStyle">
          <view :style="{ flex: String(directPct), background: 'var(--v5-brand)', transition: 'flex 0.4s ease' }" />
          <view :style="{ flex: String(extendedPct), background: 'var(--v5-brand-2)', transition: 'flex 0.4s ease' }" />
        </view>
        <view class="grid" :style="splitColsStyle">
          <view>
            <text class="block tabular-nums font-mono-tabular" :style="directLabelStyle">Direct · <text :style="{ fontWeight: 600 }">{{ directPct }}%</text></text>
            <text class="block tabular-nums font-display" :style="splitValStyle">${{ directUSDT.toFixed(2) }}</text>
          </view>
          <view>
            <text class="block tabular-nums font-mono-tabular" :style="extendedLabelStyle">Extended · <text :style="{ fontWeight: 600 }">{{ extendedPct }}%</text></text>
            <text class="block tabular-nums font-display" :style="splitValStyle">${{ extendedUSDT.toFixed(2) }}</text>
          </view>
        </view>
      </view>

      <!-- settled / cooling footer -->
      <view class="grid grid-cols-2 text-center" :style="footerStyle">
        <view>
          <text class="block font-mono-tabular" :style="footLabelStyle">{{ t.teamV3.settled }}</text>
          <text class="block tabular-nums font-display" :style="footValStyle('var(--v5-success)')">${{ unlockedUSDT.toFixed(2) }}</text>
        </view>
        <view>
          <text class="block font-mono-tabular" :style="footLabelStyle">{{ t.teamV3.coolingDown }}</text>
          <text class="block tabular-nums font-display" :style="footValStyle('var(--v5-brand-2)')">${{ coolingUSDT.toFixed(2) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";

const props = defineProps<{
  totalUSDTLifetime: number;
  contributors: number;
  directUSDT: number;
  extendedUSDT: number;
  monthUSDT: number;
  monthNEX: number;
  unlockedUSDT: number;
  coolingUSDT: number;
}>();

const t = useT();

const intPart = computed(() => Math.floor(props.monthUSDT));
const fracPart = computed(() => (props.monthUSDT - intPart.value).toFixed(2).slice(2));
const splitTotal = computed(() => Math.max(0.01, props.directUSDT + props.extendedUSDT));
const directPct = computed(() => Math.round((props.directUSDT / splitTotal.value) * 100));
const extendedPct = computed(() => 100 - directPct.value);

interface DotSeed {
  left: string;
  top: string;
  delay: string;
  bg: string;
}
const DOTS: DotSeed[] = [
  { left: "8%", top: "80%", delay: "0s", bg: "var(--v5-tech-cyan)" },
  { left: "28%", top: "88%", delay: "1.4s", bg: "var(--v5-brand)" },
  { left: "52%", top: "84%", delay: "3.2s", bg: "var(--v5-tech-cyan)" },
  { left: "72%", top: "90%", delay: "5.0s", bg: "var(--v5-success)" },
  { left: "90%", top: "82%", delay: "6.6s", bg: "var(--v5-brand-2)" },
];

function goCommissions() {
  uni.navigateTo({ url: "/pages/team/commissions", fail: () => {} });
}

// ─── styles ───
const rootStyle: CSSProperties = {
  padding: "18px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
};
const gridStyle: CSSProperties = {
  position: "absolute",
  inset: "0",
  backgroundImage:
    "linear-gradient(to right, rgba(15,21,42,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,21,42,0.04) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  pointerEvents: "none",
  zIndex: 0,
};
const auroraStyle: CSSProperties = {
  position: "absolute",
  inset: "-20%",
  background:
    "radial-gradient(40% 50% at 80% 20%, var(--v5-tech-cyan-soft) 0%, transparent 60%), radial-gradient(40% 50% at 10% 80%, var(--v5-brand-soft) 0%, transparent 60%), radial-gradient(35% 45% at 70% 90%, rgba(255,203,148,0.25) 0%, transparent 60%)",
  filter: "blur(8px)",
  pointerEvents: "none",
  zIndex: 0,
  opacity: 0.85,
  animation: "v5-aurora-drift 14s ease-in-out infinite",
};
const dotsLayerStyle: CSSProperties = {
  position: "absolute",
  inset: "0",
  pointerEvents: "none",
  overflow: "hidden",
  zIndex: 0,
};
function dotStyle(d: DotSeed): CSSProperties {
  return {
    position: "absolute",
    left: d.left,
    top: d.top,
    width: "3px",
    height: "3px",
    borderRadius: "50%",
    background: d.bg,
    opacity: 0,
    animation: "v5-dot-drift 8s linear infinite",
    animationDelay: d.delay,
  };
}
const capLabelStyle: CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--v5-ink-4)",
};
const dollarSignStyle: CSSProperties = {
  fontWeight: 500,
  fontSize: "15px",
  color: "var(--v5-ink-3)",
  opacity: 0.75,
};
const bigNumStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: "48px",
  letterSpacing: "-0.034em",
  lineHeight: 1,
  color: "var(--v5-brand)",
  whiteSpace: "nowrap",
};
const fracStyle: CSSProperties = { color: "var(--v5-ink-3)", fontSize: "26px", fontWeight: 500 };
const nexStyle: CSSProperties = { fontSize: "12.5px", color: "var(--v5-brand)" };
const lifetimeStyle: CSSProperties = {
  marginTop: "6px",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const splitWrapStyle: CSSProperties = {
  marginTop: "14px",
  paddingTop: "14px",
  borderTop: "1px dashed var(--v5-border-strong)",
};
const splitBarStyle: CSSProperties = { height: "6px", borderRadius: "3px", background: "var(--v5-surface-3)" };
const splitColsStyle: CSSProperties = {
  marginTop: "10px",
  gridTemplateColumns: "1fr 1fr",
  gap: "14px",
};
const directLabelStyle: CSSProperties = {
  fontSize: "11.5px",
  fontWeight: 500,
  color: "var(--v5-brand)",
  letterSpacing: "-0.005em",
};
const extendedLabelStyle: CSSProperties = {
  fontSize: "11.5px",
  fontWeight: 500,
  color: "var(--v5-brand-2)",
  letterSpacing: "-0.005em",
};
const splitValStyle: CSSProperties = {
  marginTop: "3px",
  fontWeight: 600,
  fontSize: "15px",
  letterSpacing: "-0.016em",
  color: "var(--v5-ink)",
  lineHeight: 1.2,
};
const footerStyle: CSSProperties = {
  marginTop: "14px",
  paddingTop: "14px",
  borderTop: "1px dashed var(--v5-border-strong)",
  gap: "14px",
};
const footLabelStyle: CSSProperties = {
  fontSize: "10.5px",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--v5-ink-4)",
};
function footValStyle(color: string): CSSProperties {
  return {
    marginTop: "4px",
    fontWeight: 600,
    fontSize: "18px",
    color,
    letterSpacing: "-0.014em",
    lineHeight: 1.2,
  };
}
</script>
