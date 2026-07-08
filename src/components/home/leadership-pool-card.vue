<!--
  LeadershipPoolCard — ZONE 4 weekly leadership pool (ported from
  mission-control.tsx LeadershipPoolCard). Pool size + countdown + (unlocked at
  V3+) projected payout & share, else a "V3+ to unlock" gate chip.
-->
<template>
  <view class="home-pool-card" @click="goPool">
    <view class="home-pool-card__content">
      <view class="home-pool-card__info">
        <view class="home-pool-card__label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
          <path d="M5 21h14" />
        </svg>
          <text>{{ t.home.poolTitle }}</text>
        </view>

        <text class="home-pool-card__amount">${{ poolKText }}K</text>
        <text class="home-pool-card__desc">{{ t.home.poolThisWeek }}</text>
      </view>

      <view v-if="unlocked" class="home-pool-card__status">
        <view class="home-pool-card__payout">
          <text class="home-pool-card__payout-label">{{ t.home.poolProjectedLabel }}</text>
          <text class="home-pool-card__payout-amount">+${{ payoutText }}</text>
        </view>
        <text class="home-pool-card__share">{{ shareText }}</text>
      </view>

      <view v-else class="home-pool-card__status home-pool-card__status--locked">
        <view class="home-pool-card__unlock">
          <text>{{ t.home.poolV3Unlock }}</text>
          <text class="home-pool-card__arrow">›</text>
        </view>
      </view>
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
const unlocked = computed(() => myRank.value >= 3);

const poolKText = computed(() => (poolUSDT.value / 1000).toFixed(1));
const payoutText = computed(() => myPayout.value.toFixed(2));
const shareText = computed(() => fmt(t.value.home.poolShare, { n: (myShare.value * 100).toFixed(3) }));

function goPool() {
  uni.navigateTo({ url: "/pages/team/leadership-pool", fail: () => {} });
}
</script>

<style scoped>
.home-pool-card {
  position: relative;
  overflow: hidden;
  padding: 18px 16px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--v5-brand-2) 30%, transparent);
  background:
    radial-gradient(80% 60% at 50% 0%, color-mix(in srgb, var(--v5-brand-2) 18%, transparent) 0%, transparent 65%),
    linear-gradient(180deg, var(--v5-surface) 0%, var(--v5-bg) 100%);
  transition: transform 0.16s ease;
}

.home-pool-card:active {
  transform: scale(0.99);
}

.home-pool-card__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.home-pool-card__info {
  min-width: 0;
}

.home-pool-card__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--v5-brand-2);
  font-family: "JetBrains Mono", var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  line-height: 1;
}

.home-pool-card__label svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.home-pool-card__amount {
  display: block;
  margin-top: 10px;
  color: var(--v5-ink);
  font-family: var(--font-amount);
  font-size: 34px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.home-pool-card__desc {
  display: block;
  margin-top: 8px;
  color: var(--v5-ink-3);
  font-size: 12px;
  line-height: 16px;
  text-align: left;
}

.home-pool-card__status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--v5-surface-2) 72%, transparent);
}

.home-pool-card__status--locked {
  min-height: auto;
  padding: 0;
  background: color-mix(in srgb, var(--v5-surface-2) 60%, transparent);
}

.home-pool-card__unlock {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 18px;
  border-radius: 999px;
  background: var(--v5-brand-2-soft);
  color: var(--v5-brand-2);
  font-family: "JetBrains Mono", var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

.home-pool-card__arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 18px;
  line-height: 14px;
  transform: translateY(-0.5px);
}

.home-pool-card__payout-label {
  display: block;
  color: var(--v5-brand);
  font-family: "JetBrains Mono", var(--font-mono);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.12em;
  line-height: 1.2;
}

.home-pool-card__payout-amount {
  display: block;
  margin-top: 3px;
  color: var(--v5-success);
  font-family: var(--font-amount);
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.home-pool-card__share {
  color: var(--v5-ink-3);
  font-family: "JetBrains Mono", var(--font-mono);
  font-size: 11.5px;
  font-weight: 500;
  white-space: nowrap;
}

@media (max-width: 390px) {
  .home-pool-card__amount {
    font-size: 30px;
  }

  .home-pool-card__unlock {
    padding: 7px 14px;
  }

  .home-pool-card__status:not(.home-pool-card__status--locked) {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
