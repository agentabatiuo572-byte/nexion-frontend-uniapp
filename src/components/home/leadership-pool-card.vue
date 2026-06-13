<!--
  LeadershipPoolCard — ZONE 4 weekly leadership pool (ported from
  mission-control.tsx LeadershipPoolCard). Pool size + countdown + (unlocked at
  V3+) projected payout & share, else a "V3+ to unlock" gate chip.
-->
<template>
  <view class="block" style="background: var(--v5-surface); border: 1px solid var(--v5-border); border-radius: 16px; padding: 14px 16px; position: relative; overflow: hidden" @click="goPool">
    <view class="flex items-center justify-between font-mono-tabular" style="font-size: 12px; color: var(--v5-ink-3)">
      <view class="inline-flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
          <path d="M5 21h14" />
        </svg>
        <text>{{ t.home.poolTitle }}</text>
      </view>
      <text class="tabular-nums">{{ t.home.poolEndsIn }} <text style="color: var(--v5-ink); font-weight: 500">{{ days }}d</text></text>
    </view>

    <view class="mt-1.5 grid gap-3 items-end" style="grid-template-columns: 1fr auto">
      <view>
        <text class="block tabular-nums" style="font-family: var(--font-v5); font-weight: 600; font-size: 26px; color: var(--v5-ink); letter-spacing: -0.022em; line-height: 1">${{ poolKText }}K</text>
        <text class="block mt-1.5" style="font-size: 12px; color: var(--v5-ink-3); font-family: var(--font-v5)">{{ t.home.poolThisWeek }}</text>
      </view>
      <view v-if="unlocked" class="text-right whitespace-nowrap">
        <text class="block tabular-nums" style="font-family: var(--font-v5); font-weight: 600; font-size: 18px; color: var(--v5-success); letter-spacing: -0.014em; line-height: 1">+${{ payoutText }}</text>
        <text class="block mt-1 font-mono-tabular" style="font-size: 11.5px; color: var(--v5-ink-3)">{{ shareText }}</text>
      </view>
      <text v-else class="font-mono-tabular whitespace-nowrap" style="padding: 5px 10px; background: var(--v5-brand-2-soft); border-radius: 999px; font-size: 12px; color: var(--v5-brand-2); font-weight: 500">{{ t.home.poolV3Unlock }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useVRank } from "@/store/v-rank";
import { useLeadershipPool } from "@/store/leadership-pool";

const t = useT();
const vrank = useVRank();
const pool = useLeadershipPool();

const myRank = computed(() => vrank.myRank);
const poolUSDT = computed(() => pool.currentWeekPoolUSDT);
const myShare = computed(() => pool.mySharePct(myRank.value));
const myPayout = computed(() => pool.myProjectedPayout(myRank.value));
const days = computed(() => Math.max(0, Math.ceil((pool.nextPayoutTs() - Date.now()) / 86400000)));
const unlocked = computed(() => myRank.value >= 3);

const poolKText = computed(() => (poolUSDT.value / 1000).toFixed(1));
const payoutText = computed(() => myPayout.value.toFixed(2));
const shareText = computed(() => fmt(t.value.home.poolShare, { n: (myShare.value * 100).toFixed(3) }));

function goPool() {
  uni.navigateTo({ url: "/pages/team/leadership-pool", fail: () => {} });
}
</script>
