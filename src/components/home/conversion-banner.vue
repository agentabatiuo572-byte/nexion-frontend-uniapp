<!--
  ConversionBanner — ZONE 1 upsell ("100% faithful v5 design draft", exact hex).
  Ported from mission-control.tsx ConversionBanner. Hero reward protagonist +
  72×72 product render (trial-hero.png, masked) + micro-stats + soft-tint CTA.
  Promo target follows the user's highest active device (derivePromoUpgrade).
  Whole card taps through to the upgrade target's store page.
-->
<template>
  <view class="block" :style="rootStyle" @click="goStore">
    <!-- Top edge brand accent -->
    <view :style="accentStyle" />

    <!-- Product render — sibling of content (z-index wins clean), masked fade -->
    <image
      src="/static/img/marketing/trial-hero.png"
      mode="aspectFit"
      :style="productStyle"
    />

    <!-- Content wrapper (z-index 1 above the image) -->
    <view style="padding: 14px 16px 16px; position: relative; z-index: 1">
      <!-- Meta line: quest tag + countdown -->
      <view style="display: flex; justify-content: space-between; align-items: center; font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px">
        <view class="inline-flex items-center" style="gap: 6px; color: var(--v5-brand); font-weight: 500">
          <text style="color: var(--v5-brand)">{{ t.home.weeklyQuestEyebrow }}</text>
          <text style="padding: 1px 6px; border-radius: 4px; background: var(--v5-brand-soft); border: 1px solid var(--v5-brand-border); font-size: 11px; color: var(--v5-brand)">{{ promoMult }}×</text>
        </view>
        <text style="color: var(--v5-ink-4); font-weight: 400">{{ t.home.weeklyQuestEndsIn }} <text style="color: #9B89E0; font-weight: 500; font-variant-numeric: tabular-nums">{{ remainingLabel }}</text></text>
      </view>

      <!-- Hero row: reward protagonist -->
      <view style="margin-top: 10px; padding-right: 96px">
        <view style="display: flex; align-items: baseline; gap: 5px; font-variant-numeric: tabular-nums; white-space: nowrap">
          <text style="font-family: var(--font-v5); font-weight: 600; color: var(--v5-ink); letter-spacing: -0.024em; line-height: 1; font-size: 34px">+{{ finalRewardText }}</text>
          <text style="font-family: var(--font-jet-mono), ui-monospace, monospace; color: var(--v5-brand); font-size: 13px; font-weight: 500">NEX</text>
        </view>
        <text class="block" style="margin-top: 7px; font-family: var(--font-v5); font-weight: 500; font-size: 13.5px; color: var(--v5-ink-3); letter-spacing: -0.008em">{{ subtitleText }}</text>
      </view>

      <!-- Supporting micro-stats -->
      <view style="margin-top: 12px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px; color: var(--v5-ink-4)">
        <text><text style="color: var(--v5-brand); font-weight: 500">${{ targetDailyText }}</text><text style="color: var(--v5-ink-4)">/d</text></text>
        <text style="color: var(--v5-ink-4); opacity: 0.5">·</text>
        <text><text style="color: var(--v5-brand-2); font-weight: 500">{{ multLabel }}</text> {{ multSuffix }}</text>
        <text style="color: var(--v5-ink-4); opacity: 0.5">·</text>
        <text>{{ t.home.weeklyQuestPaybackLabel }} <text style="color: #9B89E0; font-weight: 500">~{{ promo.targetPayback }}d</text></text>
      </view>

      <!-- CTA — de-emphasized soft-tint pill, bottom-right -->
      <view style="margin-top: 14px; display: flex; justify-content: flex-end">
        <view class="inline-flex items-center" style="padding: 7px 14px; border-radius: 999px; background: var(--v5-brand-soft); color: var(--v5-brand); font-family: var(--font-v5); font-weight: 600; font-size: 13px; gap: 5px; letter-spacing: -0.005em">
          <text style="color: var(--v5-brand)">{{ t.home.weeklyQuestGetNexionBox }}</text>
          <text style="font-family: var(--font-jet-mono), ui-monospace, monospace; opacity: 0.7; font-size: 12px; color: var(--v5-brand)">→</text>
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
const multLabel = computed(() =>
  promo.value.multiplier > 0 ? `${promo.value.multiplier}×` : t.value.home.weeklyQuestAnchor,
);
const multSuffix = computed(() =>
  promo.value.multiplier > 0
    ? fmt(t.value.home.weeklyQuestYourBase, { base: promo.value.baseName.replace(/^Your\s+/i, "") })
    : t.value.home.weeklyQuestPricing,
);

const rootStyle: CSSProperties = {
  marginTop: "12px",
  position: "relative",
  borderRadius: "16px",
  background:
    "radial-gradient(50% 60% at 100% 0%, var(--v5-brand-soft), transparent 70%), var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  overflow: "hidden",
  color: "var(--v5-ink)",
  boxShadow: "var(--v5-card-shadow-lift)",
};

const accentStyle: CSSProperties = {
  position: "absolute",
  left: "0",
  right: "0",
  top: "0",
  height: "1px",
  background: "linear-gradient(90deg, transparent, var(--v5-brand), transparent)",
  opacity: 0.45,
};

const PRODUCT_MASK =
  "radial-gradient(ellipse 200px 250px at 95% 50%, #000 25%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.1) 82%, transparent 100%)";
const productStyle: CSSProperties = {
  position: "absolute",
  top: "-36px",
  right: "-50px",
  width: "220px",
  height: "220px",
  pointerEvents: "none",
  zIndex: 0,
  maskImage: PRODUCT_MASK,
  WebkitMaskImage: PRODUCT_MASK,
};

function goStore() {
  uni.navigateTo({ url: `/pages/store/detail?id=${promo.value.targetKind}`, fail: () => {} });
}
</script>
