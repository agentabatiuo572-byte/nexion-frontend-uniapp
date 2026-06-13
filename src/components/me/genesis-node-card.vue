<!--
  GenesisNodeCard — ported from me/page.tsx GenesisNodeCard.
  Strongest conversion anchor on /me: scarcity (seats left) + perpetual income
  (avg/month) + secondary-market floor (floor price) + social proof + gold CTA.
  Gold-tinted card (warning radial wash + top hairline). Reads useGenesis for
  live remaining()/soldSlots; mounted guard avoids a flash of stale persisted
  counts. Taps through to /genesis (not yet ported → nav fail:()=>{}).
-->
<template>
  <view class="relative overflow-hidden" :style="cardStyle">
    <!-- Top hairline gold fade -->
    <view aria-hidden :style="hairlineStyle" />

    <view class="relative" style="padding: 18px">
      <!-- TOP: cap label + crown -->
      <view class="flex items-start justify-between">
        <view class="inline-flex items-center font-mono-tabular" :style="capLabelStyle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" /></svg>
          <text style="margin-left: 6px">{{ t.me.genesisCardCap }}</text>
        </view>
        <text aria-hidden :style="crownStyle">👑</text>
      </view>

      <!-- HERO: title + subtitle -->
      <view style="margin-top: 12px">
        <text class="block" :style="titleStyle">{{ t.me.genesisNode }}</text>
        <text class="block" :style="subtitleStyle">{{ t.me.genesisCardSubtitle }}</text>
      </view>

      <!-- STAT GRID — 3 cells -->
      <view class="grid grid-cols-3" :style="statGridStyle">
        <StatCell :value="String(remaining)" :label="t.me.genesisCardStatRemainingLabel" big />
        <StatCell :value="`$${monthlyPerNode}`" :label="t.me.genesisCardStatMonthlyLabel" />
        <StatCell :value="`$${floorPriceK}K`" :label="t.me.genesisCardStatFloorLabel" />
      </view>

      <!-- Social proof -->
      <text class="block text-center" :style="socialProofStyle">{{ socialProofLine }}</text>

      <!-- CTA pill -->
      <view class="flex items-center justify-center active:opacity-90" :style="ctaStyle" @click="goGenesis">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" /></svg>
        <text style="margin: 0 8px">{{ t.me.genesisCardCta }}</text>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useGenesis } from "@/store/genesis";
import StatCell from "@/components/me/stat-cell.vue";

const t = useT();
const genesis = useGenesis();

// Mounted guard — useGenesis is persisted; avoid a flash of stale live counts.
const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});

const remaining = computed(() => (mounted.value ? genesis.remaining() : 153));
const sold = computed(() => (mounted.value ? genesis.soldSlots : 847));
const monthlyPerNode = 37;
const floorPriceK = 25;
const socialProofLine = computed(() => fmt(t.value.me.genesisCardSocialProof, { n: sold.value }));

function goGenesis() {
  uni.navigateTo({ url: "/pages/genesis/genesis", fail: () => {} });
}

const cardStyle: CSSProperties = {
  background:
    "radial-gradient(80% 100% at 100% 0%, color-mix(in oklab, var(--v5-warning) 18%, transparent) 0%, transparent 60%), radial-gradient(60% 70% at 0% 100%, color-mix(in oklab, var(--v5-warning) 8%, transparent) 0%, transparent 70%), var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  boxShadow: "var(--v5-card-shadow-lift-strong)",
};
const hairlineStyle: CSSProperties = {
  position: "absolute",
  left: "0",
  right: "0",
  top: "0",
  height: "1px",
  background: "linear-gradient(90deg, transparent, var(--v5-warning), transparent)",
  opacity: 0.75,
};
const capLabelStyle: CSSProperties = {
  fontSize: "10.5px",
  letterSpacing: "0.18em",
  color: "var(--v5-warning)",
};
const crownStyle: CSSProperties = {
  fontSize: "32px",
  lineHeight: 1,
  flexShrink: 0,
  marginTop: "-4px",
  filter: "drop-shadow(0 4px 14px color-mix(in oklab, var(--v5-warning) 55%, transparent))",
};
const titleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "20px",
  fontWeight: 600,
  letterSpacing: "-0.012em",
  color: "var(--v5-ink)",
  lineHeight: 1.15,
};
const subtitleStyle: CSSProperties = {
  marginTop: "4px",
  fontSize: "12.5px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.4,
  maxWidth: "280px",
};
const statGridStyle: CSSProperties = {
  marginTop: "16px",
  gap: "8px",
  background: "color-mix(in oklab, var(--v5-warning) 6%, transparent)",
  border: "1px solid color-mix(in oklab, var(--v5-warning) 20%, transparent)",
  borderRadius: "12px",
  padding: "10px 6px",
};
const socialProofStyle: CSSProperties = {
  marginTop: "12px",
  fontSize: "11px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.4,
};
const ctaStyle: CSSProperties = {
  marginTop: "16px",
  width: "100%",
  height: "48px",
  borderRadius: "999px",
  background: "var(--v5-warning)",
  color: "var(--v5-on-brand)",
  fontSize: "14px",
  fontWeight: 600,
  fontFamily: "var(--font-v5)",
};
</script>
