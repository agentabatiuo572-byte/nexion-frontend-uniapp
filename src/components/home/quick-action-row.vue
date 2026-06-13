<!--
  QuickActionRow — ZONE 2 four-up quick links (ported from mission-control.tsx
  QuickActionRow + QuickChip). Stake / Genesis / Missions / Daily, each a tappable
  chip with emoji + label + live sub-stat (genesis remaining, daily points).
-->
<template>
  <view class="grid grid-cols-4 gap-2">
    <view
      v-for="c in chips"
      :key="c.href"
      class="text-center"
      :style="chipStyle(c.tone)"
      @click="go(c.href)"
    >
      <text class="block" style="font-size: 20px; line-height: 1">{{ c.icon }}</text>
      <text class="block mt-1" style="font-family: var(--font-v5); font-weight: 600; font-size: 12px; color: var(--v5-ink)">{{ c.label }}</text>
      <text class="block font-mono-tabular" :style="{ fontSize: '10px', color: c.tone === 'warm' ? 'var(--v5-brand-2)' : 'var(--v5-brand)', marginTop: '1px' }">{{ c.sub }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { usePoints } from "@/store/points";
import { useGenesis } from "@/store/genesis";

const t = useT();
const points = usePoints();
const genesis = useGenesis();

const chips = computed(() => [
  { href: "/pages/staking/staking", icon: "💎", label: t.value.home.quickStake, sub: t.value.home.quickStakeApy, tone: "brand" as const },
  { href: "/pages/genesis/genesis", icon: "👑", label: t.value.home.quickGenesisLabel, sub: fmt(t.value.home.quickGenesisLeft, { n: genesis.totalSlots - genesis.soldSlots }), tone: "warm" as const },
  { href: "/pages/missions/missions", icon: "🎯", label: t.value.home.quickMissions, sub: t.value.home.quickMissionsActive, tone: "brand" as const },
  { href: "/pages/daily/daily", icon: "🔥", label: t.value.home.quickDaily, sub: fmt(t.value.home.quickDailyPts, { n: points.points }), tone: "warm" as const },
]);

function chipStyle(tone: "brand" | "warm"): CSSProperties {
  return {
    padding: "10px 8px",
    background: "var(--v5-surface)",
    border: `1px solid ${tone === "warm" ? "var(--v5-brand-2-border)" : "var(--v5-brand-border)"}`,
    borderRadius: "12px",
  };
}
function go(href: string) {
  uni.navigateTo({ url: href, fail: () => {} });
}
</script>
