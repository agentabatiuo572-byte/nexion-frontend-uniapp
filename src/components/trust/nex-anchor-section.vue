<!--
  NexAnchorSection — pairs FDV / 24h volume (from market store) with the top AI
  clients consuming NEX, framing the token as backed by inference demand. Ported
  from the inline NexAnchorSection in Nexion-prototype trust/page.tsx.
-->
<template>
  <view :style="cardStyle">
    <text class="block" :style="heroStyle">{{ t.trust.nexAnchorHero }}</text>
    <text class="block" :style="subStyle">{{ t.trust.nexAnchorSubhero }}</text>

    <view class="flex items-center active:opacity-80" :style="howStyle" @click="goHow">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
      <text style="margin: 0 6px">{{ t.trust.nexHowEntry }}</text>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
    </view>

    <view class="grid grid-cols-3 text-center" :style="statsRowStyle">
      <Stat :label="t.trust.nexAnchorStat24h" :value="`$${(volume24h / 1_000_000).toFixed(2)}M`" tint="var(--v5-brand)" />
      <Stat :label="t.trust.nexAnchorStatFDV" :value="`$${(fdv / 1_000_000).toFixed(0)}M`" tint="var(--v5-tech-cyan)" />
      <Stat :label="t.trust.nexAnchorStatCirc" :value="`${(circulating / 1_000_000_000).toFixed(2)}B`" />
    </view>

    <view :style="clientsRowStyle">
      <view v-for="c in clients" :key="c.name" class="flex items-center justify-between" style="gap: 8px">
        <view class="flex items-center min-w-0" style="gap: 6px">
          <view :style="clientDotStyle" />
          <text class="truncate" :style="clientNameStyle">{{ c.name }}</text>
          <text class="shrink-0" :style="clientSepStyle">·</text>
          <text class="truncate" :style="clientCityStyle">{{ c.city }}</text>
        </view>
        <text class="shrink-0" :style="clientPaidStyle">{{ paidLabel(c.monthlyNex) }}</text>
      </view>
    </view>

    <view class="flex items-center justify-end" :style="clientsCtaStyle">
      <text>{{ clientsCta }}</text>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 4px"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import Stat from "@/components/trust/trust-stat.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useMarket } from "@/store/market";

const NEX_CLIENTS = [
  { name: "Helix Labs", city: "San Francisco", monthlyNex: 1_240_000 },
  { name: "Mosaic Studios", city: "Berlin", monthlyNex: 412_000 },
  { name: "Echo Earbuds", city: "Tokyo", monthlyNex: 287_000 },
];
const ACTIVE_AI_CLIENTS = 1247;

const t = useT();
const market = useMarket();
const clients = NEX_CLIENTS;

const volume24h = computed(() => market.volume24hUSDT);
const circulating = computed(() => market.circulating);
const fdv = computed(() => market.nexPriceUSDT * market.circulating);

const clientsCta = computed(() => fmt(t.value.trust.nexAnchorClientsCta, { n: ACTIVE_AI_CLIENTS.toLocaleString() }));
function paidLabel(monthlyNex: number): string {
  const n = monthlyNex >= 1_000_000 ? `${(monthlyNex / 1_000_000).toFixed(1)}M` : `${(monthlyNex / 1000).toFixed(0)}K`;
  return fmt(t.value.trust.nexAnchorClientPaid, { n });
}

function goHow() {
  uni.navigateTo({ url: "/pages/trust/nex", fail: () => {} });
}

const cardStyle: CSSProperties = {
  borderRadius: "16px",
  padding: "16px",
  background:
    "radial-gradient(70% 70% at 100% 0%, color-mix(in srgb, var(--v5-brand-2) 12%, transparent) 0%, transparent 65%), var(--v5-surface)",
  border: "1px solid color-mix(in srgb, var(--v5-brand-2) 24%, transparent)",
};
const heroStyle: CSSProperties = { fontSize: "12.5px", color: "color-mix(in srgb, var(--v5-ink) 90%, transparent)", lineHeight: 1.4 };
const subStyle: CSSProperties = { fontSize: "11px", color: "var(--v5-ink-3)", marginTop: "4px", lineHeight: 1.4 };
const howStyle: CSSProperties = {
  marginTop: "12px",
  display: "inline-flex",
  padding: "0 12px",
  minHeight: "44px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-brand-2) 12%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-brand-2) 35%, transparent)",
  fontSize: "11px",
  color: "var(--v5-brand-2)",
};
const statsRowStyle: CSSProperties = { marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--v5-border)", gap: "8px" };
const clientsRowStyle: CSSProperties = { marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--v5-border)", display: "flex", flexDirection: "column", gap: "6px" };
const clientDotStyle: CSSProperties = { width: "6px", height: "6px", borderRadius: "999px", background: "var(--v5-brand-2)", flexShrink: 0 };
const clientNameStyle: CSSProperties = { fontSize: "11.5px", color: "color-mix(in srgb, var(--v5-ink) 90%, transparent)", fontWeight: 500 };
const clientSepStyle: CSSProperties = { fontSize: "11.5px", color: "var(--v5-ink-4)" };
const clientCityStyle: CSSProperties = { fontSize: "11.5px", color: "var(--v5-ink-3)" };
const clientPaidStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "11.5px", color: "var(--v5-brand-2)" };
const clientsCtaStyle: CSSProperties = { marginTop: "12px", paddingTop: "8px", borderTop: "1px solid var(--v5-border)", fontSize: "11px", color: "var(--v5-brand)" };
</script>
