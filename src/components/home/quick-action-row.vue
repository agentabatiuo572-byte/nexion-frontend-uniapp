<!--
  QuickActionRow — ZONE 2 four-up quick links (ported from mission-control.tsx
  QuickActionRow + QuickChip). Stake / Genesis / Missions / Daily, each a tappable
  chip with a provided SVG icon + label + live sub-stat. Icon color follows
  the chip tone accent token (no hardcoded hex).
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
      <view class="grid place-items-center" style="height: 24px">
        <!-- 质押 -->
        <svg v-if="c.icon === 'gem'" width="24" height="24" viewBox="0 0 24 24" :style="{ color: iconColor(c.tone) }">
          <path fill="currentColor" d="M11.175 19.688q-.4-.188-.7-.538L2.825 10q-.225-.275-.337-.6t-.113-.675q0-.225.038-.462t.162-.438L4.45 4.1q.275-.5.738-.8T6.225 3h11.55q.575 0 1.038.3t.737.8l1.875 3.725q.125.2.163.437t.037.463q0 .35-.112.675t-.338.6l-7.65 9.15q-.3.35-.7.538t-.825.187t-.825-.187M9.625 8h4.75l-1.5-3h-1.75zM11 16.675V10H5.45zm2 0L18.55 10H13zM16.6 8h2.65l-1.5-3H15.1zM4.75 8H7.4l1.5-3H6.25z" />
        </svg>
        <!-- 创世 -->
        <svg v-else-if="c.icon === 'crown'" width="24" height="24" viewBox="0 0 24 24" :style="{ color: iconColor(c.tone) }">
          <path fill="currentColor" d="M6 20q-.425 0-.712-.288T5 19t.288-.712T6 18h12q.425 0 .713.288T19 19t-.288.713T18 20zm.7-3.5q-.725 0-1.287-.475t-.688-1.2l-1-6.35q-.05 0-.112.013T3.5 8.5q-.625 0-1.062-.437T2 7t.438-1.062T3.5 5.5t1.063.438T5 7q0 .175-.038.325t-.087.275L8 9l3.125-4.275q-.275-.2-.45-.525t-.175-.7q0-.625.438-1.063T12 2t1.063.438T13.5 3.5q0 .375-.175.7t-.45.525L16 9l3.125-1.4q-.05-.125-.088-.275T19 7q0-.625.438-1.063T20.5 5.5t1.063.438T22 7t-.437 1.063T20.5 8.5q-.05 0-.112-.012t-.113-.013l-1 6.35q-.125.725-.687 1.2T17.3 16.5zm0-2h10.6l.65-4.175l-1.15.5q-.65.275-1.325.1t-1.1-.75L12 6.9l-2.375 3.275q-.425.575-1.1.75t-1.325-.1l-1.15-.5zm5.3 0" />
        </svg>
        <!-- 任务 -->
        <svg v-else-if="c.icon === 'target'" width="24" height="24" viewBox="0 0 24 24" :style="{ color: iconColor(c.tone) }">
          <path fill="currentColor" d="M12 3.75a8.25 8.25 0 1 0 0 16.5a8.25 8.25 0 0 0 0-16.5M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9M6 12a6 6 0 1 1 12 0a6 6 0 0 1-12 0m3.75 0a2.25 2.25 0 1 1 4.5 0a2.25 2.25 0 0 1-4.5 0" />
        </svg>
        <!-- 签到 -->
        <svg v-else width="24" height="24" viewBox="0 0 24 24" :style="{ color: iconColor(c.tone) }">
          <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5">
            <path d="M16 2v4M8 2v4m13 10v-4c0-3.771 0-5.657-1.172-6.828S16.771 4 13 4h-2C7.229 4 5.343 4 4.172 5.172S3 8.229 3 12v2c0 3.771 0 5.657 1.172 6.828S7.229 22 11 22h1M3 10h18" />
            <path d="M21 19.5h-6.5m2 2.5c-.506-.491-2.5-1.8-2.5-2.5s1.994-2.009 2.5-2.5" />
          </g>
        </svg>
      </view>
      <text class="block mt-1" style="font-family: var(--font-v5); font-weight: 600; font-size: 12px; color: var(--v5-ink)">{{ c.label }}</text>
      <text class="block font-mono-tabular" :style="{ fontSize: '11px', color: iconColor(c.tone), marginTop: '1px' }">{{ c.sub }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useNexFaucet } from "@/store/nex-faucet";
import { useGenesis } from "@/store/genesis";

const t = useT();
const faucet = useNexFaucet();
const genesis = useGenesis();

const chips = computed(() => [
  { href: "/pages/staking/staking", icon: "gem", label: t.value.home.quickStake, sub: t.value.home.quickStakeApy, tone: "brand" as const },
  { href: "/pages/genesis/genesis", icon: "crown", label: t.value.home.quickGenesisLabel, sub: fmt(t.value.home.quickGenesisLeft, { n: genesis.totalSlots - genesis.soldSlots }), tone: "warm" as const },
  { href: "/pages/missions/missions", icon: "target", label: t.value.home.quickMissions, sub: t.value.home.quickMissionsActive, tone: "brand" as const },
  { href: "/pages/daily/daily", icon: "flame", label: t.value.home.quickDaily, sub: fmt(t.value.home.quickDailyStreak, { n: faucet.signInStreak }), tone: "warm" as const },
]);

function iconColor(tone: "brand" | "warm"): string {
  return tone === "warm" ? "var(--v5-brand-2)" : "var(--v5-brand)";
}
function chipStyle(tone: "brand" | "warm"): CSSProperties {
  const accent = tone === "warm" ? "var(--v5-brand-2)" : "var(--v5-brand)";
  return {
    padding: "10px 8px",
    background: `color-mix(in srgb, ${accent} 14%, var(--v5-surface))`,
    borderRadius: "12px",
  };
}
function go(href: string) {
  uni.navigateTo({ url: href, fail: () => {} });
}
</script>
