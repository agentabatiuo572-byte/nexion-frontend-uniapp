<!--
  ConversionBanner — ZONE 1 upsell ("100% faithful v5 design draft", exact hex).
  Ported from mission-control.tsx ConversionBanner. Hero reward protagonist +
  72×72 product render (trial-hero.png, masked) + micro-stats + soft-tint CTA.
  Promo target follows the user's highest active device (derivePromoUpgrade).
  Whole card taps through to the upgrade target's store page.
-->
<template>
  <view class="block" :style="rootStyle" @click="goStore">
    <!-- Product render — sibling of content (z-index wins clean), masked fade -->
    <view :style="productFrameStyle">
      <image
        src="/static/img/marketing/nexionbox-s1-weekly.png"
        mode="aspectFit"
        :style="productImageStyle"
      />
    </view>

    <!-- Content wrapper (z-index 1 above the image) -->
    <view style="height: 100%; box-sizing: border-box; padding: 14px 16px 16px; position: relative; z-index: 1">
      <!-- Meta line: quest tag + countdown -->
      <view style="display: flex; justify-content: space-between; align-items: flex-start; font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px">
        <view class="inline-flex items-center" style="gap: 6px; padding: 3px 6px; margin: -3px -6px; border-radius: 8px; background: color-mix(in srgb, var(--v5-surface) 82%, transparent); backdrop-filter: blur(10px) saturate(140%); -webkit-backdrop-filter: blur(10px) saturate(140%); color: var(--v5-brand); font-weight: 500">
          <text style="display: block; width: fit-content; font-family: var(--font-v5); font-weight: 600; font-size: 15px; color: var(--v5-brand); letter-spacing: -0.012em">{{ t.home.weeklyQuestEyebrow }}</text>
          <text style="padding: 1px 6px; border-radius: 4px; background: var(--v5-brand-soft); font-size: 11px; color: var(--v5-brand)">{{ promoMult }}×</text>
        </view>
        <view class="weekly-countdown">
          <text style="font-family: var(--font-jet-mono), ui-monospace, monospace; font-weight: 500; font-size: 12px; color: #9B89E0; letter-spacing: 0.04em">{{ t.home.weeklyQuestEndsIn }}</text>
          <text style="font-family: var(--font-jet-mono), ui-monospace, monospace; font-weight: 500; font-size: 12px; color: #9B89E0; font-variant-numeric: tabular-nums; line-height: 1">{{ remainingLabel }}</text>
        </view>
      </view>

      <!-- Hero row: reward protagonist -->
      <view style="margin-top: 10px; padding-right: 96px">
        <view style="display: flex; align-items: baseline; gap: 5px; font-variant-numeric: tabular-nums; white-space: nowrap">
          <text style="font-family: var(--font-amount); font-weight: 600; color: var(--v5-ink); letter-spacing: -0.024em; line-height: 1; font-size: 34px">+{{ finalRewardText }}</text>
          <text style="font-family: var(--font-jet-mono), ui-monospace, monospace; color: var(--v5-brand); font-size: 13px; font-weight: 500">NEX</text>
        </view>
        <text class="block" style="margin-top: 7px; font-family: var(--font-v5); font-weight: 500; font-size: 13.5px; color: var(--v5-ink-3); letter-spacing: -0.008em">{{ subtitleText }}</text>
      </view>

      <!-- Supporting micro-stats -->
      <view style="margin-top: 12px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px; color: var(--v5-ink-4)">
        <text><text style="color: var(--v5-brand); font-weight: 500">${{ targetDailyText }}</text><text style="color: var(--v5-ink-4)">/d</text></text>
      </view>

      <!-- CTA — de-emphasized soft-tint pill, bottom-right -->
      <view style="position: absolute; right: 16px; bottom: 14px; display: flex; justify-content: flex-end">
        <view class="weekly-cta">
          <view class="weekly-cta__content">
            <text class="weekly-cta__text">{{ t.home.weeklyQuestGetNexionBox }}</text>
            <view class="weekly-cta__arrow-frame">
              <svg class="weekly-cta__arrow" width="13.2" height="13.2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m8 4 8 8-8 8" /></svg>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { derivePromoUpgrade } from "@/store/device-types";
import { useNow } from "@/composables/use-now";

const t = useT();
const app = useApp();
const nowTick = useNow();

const promoMult = 1.5;
const baseReward = 800;
const finalReward = Math.round(baseReward * promoMult);
const finalRewardText = computed(() => finalReward.toLocaleString());

const remainingLabel = computed(() => {
  const remainingMs = (4 * 86400 + 12 * 3600) * 1000 - ((nowTick.value * 1000) % 60_000);
  const days = Math.floor(remainingMs / 86400_000);
  const hours = Math.floor((remainingMs % 86400_000) / 3600_000);
  return `${days}d ${String(hours).padStart(2, "0")}h`;
});

const promo = computed(() => derivePromoUpgrade(app.devices));
const targetDailyText = computed(() => promo.value.targetDaily.toFixed(2));

const subtitleText = computed(() =>
  promo.value.multiplier > 0
    ? fmt(t.value.home.weeklyQuestActivateToClaim, { device: promo.value.targetName })
    : t.value.home.weeklyQuestAddCapacity,
);

const rootStyle: CSSProperties = {
  position: "relative",
  height: "190px",
  borderRadius: "16px",
  background: "linear-gradient(180deg, #111317 0%, #15181C 100%)",
  overflow: "hidden",
  color: "var(--v5-ink)",
  boxShadow: "var(--v5-card-shadow-lift)",
};

const PRODUCT_MASK =
  "radial-gradient(ellipse 200px 250px at calc(95% - 16px) 50%, #000 25%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.1) 82%, transparent 100%)";
const productFrameStyle: CSSProperties = {
  position: "absolute",
  top: "-30px",
  right: "-50px",
  width: "220px",
  height: "220px",
  pointerEvents: "none",
  zIndex: 0,
  overflow: "hidden",
  maskImage: PRODUCT_MASK,
  WebkitMaskImage: PRODUCT_MASK,
};
const productImageStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
};
function goStore() {
  uni.navigateTo({ url: `/pages/store/detail?id=${promo.value.targetKind}`, fail: () => {} });
}
</script>

<style scoped>
.weekly-countdown {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 3px 10px;
  margin: -3px -6px 0 0;
  border-radius: 999px;
  white-space: nowrap;
  background: rgba(245, 243, 252, 0.8);
}

html[data-theme="dark"] .weekly-countdown {
  background: transparent;
}

.weekly-cta {
  height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--v5-brand);
  border: 1px solid transparent;
  box-shadow: none;
  color: var(--v5-on-brand);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.weekly-cta__content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  line-height: 1;
}
.weekly-cta__text {
  color: currentColor;
  font-family: var(--font-v5);
  font-weight: 600;
  font-size: 13px;
  letter-spacing: -0.005em;
  line-height: 1;
  transform: translateX(4px);
}
.weekly-cta__arrow-frame {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
}
.weekly-cta__arrow {
  display: block;
  opacity: 0.9;
}

:global(html:not([data-theme="dark"])) .weekly-cta {
  background: var(--v5-cta-primary-bg);
  border-color: var(--v5-cta-primary-border);
  box-shadow: var(--v5-cta-primary-shadow);
  color: var(--v5-cta-primary-ink);
}

:global(html:not([data-theme="dark"])) .weekly-countdown {
  margin: -3px -6px 0 0;
}
</style>
