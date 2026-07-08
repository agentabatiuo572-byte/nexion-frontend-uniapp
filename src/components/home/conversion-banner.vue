<!--
  ConversionBanner — Home weekly task upsell for NexionBox S1.
  Whole card taps through to the S1 store detail page.
-->
<template>
  <view class="conversion-banner active:opacity-90" role="button" tabindex="0" @click="goStore">
    <image
      class="conversion-product"
      src="/static/img/marketing/nexionbox-s1-weekly.png"
      mode="aspectFit"
    />

    <view class="conversion-content">
      <view class="conversion-top">
        <view class="conversion-title-pill">
          <text class="conversion-title">{{ t.home.weeklyQuestEyebrow }}</text>
          <text class="conversion-mult">{{ promoMult }}×</text>
        </view>
        <view class="conversion-countdown">
          <text class="conversion-countdown-label">{{ t.home.weeklyQuestEndsIn }}</text>
          <text class="conversion-countdown-time">{{ remainingLabel }}</text>
        </view>
      </view>

      <view class="conversion-reward">
        <view class="conversion-amount-row">
          <text class="conversion-amount">+{{ finalRewardText }}</text>
          <text class="conversion-unit">NEX</text>
        </view>
        <text class="conversion-desc">{{ subtitleText }}</text>
      </view>

      <view class="conversion-daily">
        <text>
          <text class="conversion-daily-value">${{ targetDailyText }}</text>
          <text class="conversion-daily-unit">/d</text>
        </text>
      </view>

      <view class="conversion-cta">
        <text class="conversion-cta-text">{{ t.home.weeklyQuestGetNexionBox }}</text>
        <view class="conversion-cta-arrow">
          <svg width="13.2" height="13.2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { DEVICE_SPECS } from "@/store/device-types";

const t = useT();

const promoMult = 1.5;
const baseReward = 800;
const finalReward = Math.round(baseReward * promoMult);
const finalRewardText = computed(() => finalReward.toLocaleString());
const remainingLabel = "4d 11h";
const targetKind = "stellarbox-s1";
const targetSpec = DEVICE_SPECS[targetKind];

const targetDailyText = computed(() => targetSpec.baseRate.toFixed(2));

const subtitleText = computed(() =>
  fmt(t.value.home.weeklyQuestActivateToClaim, { device: targetSpec.name }),
);

function goStore() {
  uni.navigateTo({ url: `/pages/store/detail?id=${targetKind}`, fail: () => {} });
}
</script>

<style scoped>
.conversion-banner {
  position: relative;
  height: 190px;
  border-radius: 16px;
  overflow: hidden;
  background:
    radial-gradient(120% 140% at 0% 0%, rgba(77,139,255,0.12), transparent 68%),
    radial-gradient(100% 120% at 100% 100%, rgba(23,109,255,0.08), transparent 66%),
    var(--v5-surface-bg);
  color: var(--v5-ink);
  box-shadow: var(--v5-card-shadow-lift);
}

html[data-theme="dark"] .conversion-banner {
  background: linear-gradient(180deg, #111317 0%, #15181C 100%);
}

.conversion-content {
  position: relative;
  z-index: 1;
  height: 100%;
  box-sizing: border-box;
  padding: 14px 16px 16px;
}

.conversion-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-family: var(--font-numbers);
  font-size: 12px;
}

.conversion-title-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  margin: -3px -6px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--v5-surface) 82%, transparent);
  backdrop-filter: blur(10px) saturate(140%);
  -webkit-backdrop-filter: blur(10px) saturate(140%);
  color: var(--v5-brand);
}

.conversion-title {
  font-family: var(--font-v5);
  font-size: 15px;
  font-weight: 600;
  color: var(--v5-brand);
  letter-spacing: -0.012em;
  line-height: 1.3;
}

.conversion-mult {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--v5-brand-soft);
  font-family: var(--font-numbers);
  font-size: 11px;
  font-weight: 500;
  color: var(--v5-brand);
  line-height: 1.35;
}

.conversion-countdown {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 3px 10px;
  margin: -3px -6px 0 0;
  border-radius: 999px;
  white-space: nowrap;
  background: rgba(245,243,252,0.8);
  font-family: var(--font-numbers);
  font-size: 12px;
  font-weight: 500;
  color: #9B89E0;
  letter-spacing: 0.04em;
}

html[data-theme="dark"] .conversion-countdown {
  background: transparent;
}

.conversion-countdown-label,
.conversion-countdown-time {
  font-family: var(--font-numbers);
  font-size: 12px;
  font-weight: 500;
  color: #9B89E0;
}

.conversion-countdown-time {
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.conversion-reward {
  margin-top: 10px;
  padding-right: 96px;
}

.conversion-amount-row {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.conversion-amount {
  font-family: var(--font-amount);
  font-size: 34px;
  font-weight: 600;
  color: var(--v5-ink);
  letter-spacing: -0.024em;
  line-height: 1;
}

.conversion-unit {
  font-family: var(--font-numbers);
  font-size: 13px;
  font-weight: 500;
  color: var(--v5-brand);
}

.conversion-desc {
  display: block;
  margin-top: 7px;
  font-family: var(--font-v5);
  font-size: 13.5px;
  font-weight: 500;
  color: var(--v5-ink-3);
  letter-spacing: -0.008em;
  line-height: 1.35;
}

.conversion-daily {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
  font-family: var(--font-numbers);
  font-size: 12px;
  color: var(--v5-ink-4);
}

.conversion-daily-value {
  color: var(--v5-brand);
  font-weight: 500;
}

.conversion-daily-unit {
  color: var(--v5-ink-4);
}

.conversion-product {
  position: absolute;
  top: -30px;
  right: -50px;
  width: 220px;
  height: 220px;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  mask-image: radial-gradient(ellipse 200px 250px at calc(95% - 16px) 50%, #000 25%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.1) 82%, transparent 100%);
  -webkit-mask-image: radial-gradient(ellipse 200px 250px at calc(95% - 16px) 50%, #000 25%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.1) 82%, transparent 100%);
}

.conversion-cta {
  position: absolute;
  right: 16px;
  bottom: 14px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  background: linear-gradient(135deg, #4D8BFF 0%, #176DFF 100%);
  border: 1px solid rgba(77,139,255,0.75);
  box-shadow: 0 0 18px rgba(77,139,255,0.32);
  color: #FFFFFF;
}

html[data-theme="dark"] .conversion-cta {
  background: var(--v5-brand);
  border-color: transparent;
  box-shadow: none;
  color: var(--v5-on-brand);
}

.conversion-cta-text {
  font-family: var(--font-v5);
  font-size: 13px;
  font-weight: 600;
  color: currentColor;
  letter-spacing: -0.005em;
  line-height: 1;
  transform: translateX(4px);
}

.conversion-cta-arrow {
  width: 14px;
  height: 14px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: currentColor;
  opacity: 0.9;
}
</style>
