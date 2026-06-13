<!--
  ProductCard — the store's primary conversion unit (ported from store/page.tsx
  ProductCardV5 + ProductRender + ProductRibbon). The whole card taps to the
  detail page; the footer Buy/Stake CTA taps to checkout (stops propagation).

  Top→bottom:
    · ProductRender hero photo (S1/Pro/Rack) or cyan Cloud-Share schematic,
      with folded-corner badge ribbon + tier-code chip + Legacy chip overlay.
    · Body: name + rating row + ×vs-phone, spec pills, ROI 4-line hero
      (daily earn / conversion chips / AI pills / stock urgency / trade-in).
    · Footer: price + frosted Buy CTA.
-->
<template>
  <view class="relative overflow-hidden block" :style="cardStyle" role="button" tabindex="0" @tap="goDetail" @click="goDetail">
    <view v-if="featured" aria-hidden :style="featuredGlowStyle" />

    <!-- ───── Hero photo banner ───── -->
    <view class="relative overflow-hidden" :style="renderWrapStyle">
      <!-- Cloud Share schematic -->
      <view v-if="isShare" class="absolute inset-0 grid place-items-center" style="color: var(--v5-tech-cyan)">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2" /><rect width="6" height="6" x="9" y="9" rx="1" /><path d="M15 2v2" /><path d="M15 20v2" /><path d="M2 15h2" /><path d="M2 9h2" /><path d="M20 15h2" /><path d="M20 9h2" /><path d="M9 2v2" /><path d="M9 20v2" /></svg>
      </view>
      <!-- Real product photo -->
      <image v-else-if="photo" :src="photo.src" mode="aspectFill" style="position: absolute; inset: 0; width: 100%; height: 100%" />
      <!-- Fallback box icon -->
      <view v-else class="absolute inset-0 grid place-items-center" style="color: var(--v5-ink-3)">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
      </view>

      <!-- Mid-vignette + bottom fade -->
      <view v-if="photo" aria-hidden :style="vignetteStyle" />
      <view aria-hidden :style="fadeStyle" />

      <!-- Badge ribbon -->
      <view v-if="product.badge" class="absolute" :style="ribbonStyle">
        <text>{{ product.badge }}</text>
      </view>

      <!-- Tier-code chip + Legacy chip (photo) -->
      <view v-if="photo" class="absolute flex flex-col items-start gap-1.5" style="bottom: 12px; left: 14px; pointer-events: none">
        <text class="font-mono-tabular" :style="tierChipStyle">{{ photo.tierCode }}</text>
        <text v-if="product.status === 'legacy'" class="font-mono-tabular" :style="legacyChipStyle">{{ t.store.cardLegacyGen1 }}</text>
      </view>
      <!-- Cloud chip -->
      <view v-if="isShare" class="absolute" style="bottom: 28px; left: 14px; pointer-events: none">
        <text class="font-mono-tabular" :style="cloudChipStyle">{{ t.store.cardCloudDistributed }}</text>
      </view>
    </view>

    <!-- ───── Body ───── -->
    <view class="relative" style="padding: 14px 16px">
      <view class="grid items-start gap-3" style="grid-template-columns: 1fr auto">
        <view class="min-w-0">
          <text class="block" :style="nameStyle">{{ product.name }}</text>
          <view class="mt-1.5 flex items-center gap-1.5 font-mono-tabular" style="font-size: 12px; color: var(--v5-ink-3)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--v5-brand-2)" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5 14 8l6 .5-4.5 4 1.4 6L11.5 15l-5.4 3.5L7.5 12.5 3 8.5l6-.5z" /></svg>
            <text class="tabular-nums" style="color: var(--v5-ink); font-weight: 500">{{ product.rating.toFixed(1) }}</text>
            <text style="color: var(--v5-ink-4)">· {{ reviewsText }} {{ t.store.cardReviews }}</text>
            <text style="color: var(--v5-ink-4)">· {{ soldText }} {{ t.store.cardSold }}</text>
          </view>
        </view>
        <view v-if="multBase" class="text-right whitespace-nowrap">
          <text class="block tabular-nums" :style="multStyle">{{ multBaseText }}×</text>
          <text class="block font-mono-tabular" style="margin-top: 3px; font-size: 11px; color: var(--v5-ink-4)">{{ t.store.cardVsPhone }}</text>
        </view>
      </view>

      <!-- Spec pills -->
      <view class="mt-3 flex flex-wrap" style="gap: 6px">
        <SpecPill>{{ product.gpu }}</SpecPill>
        <SpecPill>{{ product.vram }}</SpecPill>
        <SpecPill>{{ t.store.cardSpecDc }}</SpecPill>
      </view>

      <!-- ROI 4-line hero -->
      <view class="mt-3 pt-3" style="border-top: 1px dashed var(--v5-border-strong)">
        <!-- Eyebrow -->
        <view class="font-mono-tabular inline-flex items-center gap-1.5" :style="earnEyebrowStyle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></svg>
          <text>{{ isShare ? t.store.cardAnnualYieldEyebrow : t.store.cardYouEarn }}</text>
        </view>

        <!-- Line 1: daily earn -->
        <view v-if="isShare" class="mt-1 flex items-baseline gap-2 flex-wrap">
          <text class="tabular-nums" :style="bigEarnStyle">{{ product.shareYieldMin }}–{{ product.shareYieldMax }}%</text>
          <text class="font-mono-tabular tabular-nums ml-auto" style="font-size: 12.5px; color: var(--v5-brand); font-weight: 500">+{{ product.dailyEarnNEX }} NEX/d</text>
        </view>
        <view v-else class="mt-1 flex items-baseline gap-2 flex-wrap">
          <text class="tabular-nums" :style="bigEarnStyle">${{ dailyEarnText }}<text style="font-size: 14px; color: var(--v5-ink-3); font-weight: 500">{{ t.store.cardPerDaySuffix }}</text></text>
          <text class="font-mono-tabular tabular-nums" style="font-size: 13px; color: var(--v5-brand); font-weight: 500">{{ nexPerDayText }}</text>
        </view>

        <!-- Line 2: conversion chips -->
        <view class="mt-2.5 flex gap-1.5 flex-wrap">
          <template v-if="isShare">
            <text class="font-mono-tabular whitespace-nowrap" :style="chipBrandStyle">{{ t.store.cardMinStake }}</text>
            <text class="font-mono-tabular whitespace-nowrap" :style="chipNeutralStyle">{{ t.store.card30dRedemption }}</text>
          </template>
          <template v-else>
            <view class="font-mono-tabular inline-flex items-center gap-1 whitespace-nowrap" :style="chipSuccessStyle">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9z" /></svg>
              <text>{{ paysBackText }}</text>
            </view>
            <text class="font-mono-tabular whitespace-nowrap" :style="chipInkStyle">{{ t.store.cardYear1Net }} <text style="color: var(--v5-success)">+${{ year1NetText }}</text></text>
          </template>
        </view>

        <!-- Line 3: AI perf pills -->
        <view v-if="product.ai" class="mt-2.5 flex flex-wrap" style="gap: 6px">
          <SpecPill v-if="product.ai.imageGenPerMin" ai>{{ imagePerMinText }}</SpecPill>
          <SpecPill v-if="product.ai.llmTokensPerSec" ai>{{ llmTokText }}</SpecPill>
          <SpecPill v-if="product.ai.videoMinPerHour" ai>{{ videoText }}</SpecPill>
        </view>

        <!-- Stock urgency -->
        <view v-if="stockLow" class="mt-2.5 grid items-center" :style="stockBoxStyle">
          <view class="flex items-center justify-center shrink-0" :style="stockIconStyle">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>
          </view>
          <view>
            <text class="block" :style="stockTextStyle">{{ t.store.cardOnly }} <text class="tabular-nums" style="font-weight: 600">{{ product.stock }}</text> {{ t.store.cardUnitsLeft }}</text>
            <view class="overflow-hidden" style="margin-top: 6px; height: 3px; border-radius: 2px; background: var(--v5-brand-2-soft)">
              <view :style="stockBarStyle" />
            </view>
          </view>
        </view>

        <!-- Trade-in callout (legacy) -->
        <view v-if="showTradein" class="mt-2.5 flex items-center justify-between gap-2 font-mono-tabular" :style="tradeinBoxStyle">
          <text>{{ t.store.cardTradeUp }} · <text style="color: var(--v5-success); font-weight: 500">{{ tradeCreditText }}</text></text>
          <text class="whitespace-nowrap" style="color: var(--v5-brand); font-weight: 500; font-family: var(--font-v5)" @tap.stop="goDevices" @click.stop="goDevices">{{ t.store.cardTradeInCta }}</text>
        </view>
      </view>
    </view>

    <!-- ───── Footer: price + Buy CTA ───── -->
    <view class="grid items-center gap-3" :style="footerStyle">
      <view class="min-w-0">
        <text class="block font-mono-tabular" :style="priceEyebrowStyle">{{ isShare ? t.store.cardFrom : t.store.cardPriceLabel }}</text>
        <view class="tabular-nums flex items-baseline" :style="priceRowStyle">
          <text style="font-size: 13px; color: var(--v5-ink-3); font-weight: 500">$</text>
          <text style="font-size: 22px; font-weight: 600">{{ priceText }}</text>
        </view>
        <text v-if="!isShare" class="block" style="margin-top: 5px; font-size: 12px; color: var(--v5-success); white-space: nowrap">{{ annualPaybackText }}</text>
        <text v-else class="block" style="margin-top: 5px; font-size: 12px; color: var(--v5-ink-3); white-space: nowrap">{{ t.store.cardOneTimeStake }}</text>
      </view>
      <view class="inline-flex items-center justify-center whitespace-nowrap" :style="buyBtnStyle" @tap.stop="goCheckout" @click.stop="goCheckout">
        <text @tap.stop="goCheckout" @click.stop="goCheckout">{{ t.store.cardBuyNow }}</text>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px; opacity: 0.9"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import type { Product } from "@/mock/products";
import { annualRoiPct } from "@/mock/products";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import SpecPill from "./spec-pill.vue";
import { navTo } from "@/lib/route";

const props = withDefaults(defineProps<{ product: Product; featured?: boolean }>(), {
  featured: false,
});
const t = useT();

const PRODUCT_PHOTO: Record<string, { src: string; tierCode: string }> = {
  "stellarbox-s1": { src: "/static/img/products/nexionbox-s1-v4.png", tierCode: "S1" },
  "stellarbox-pro": { src: "/static/img/products/nexionbox-pro-v2.png", tierCode: "Pro" },
  "stellarbox-pro-v2": { src: "/static/img/products/nexionbox-pro-v2.png", tierCode: "Pro v2" },
  "stellarrack-p1": { src: "/static/img/products/nexionrack-p1-v2.png", tierCode: "Rack P1" },
  "stellarrack-p2": { src: "/static/img/products/nexionrack-p1-v2.png", tierCode: "Rack P2" },
};

const isShare = computed(() => props.product.tier === "Share");
const photo = computed(() => (isShare.value ? null : PRODUCT_PHOTO[props.product.id] ?? null));

const paybackDays = computed(() =>
  !isShare.value ? Math.round(props.product.price / props.product.dailyEarn) : null,
);
const year1Net = computed(() =>
  !isShare.value ? Math.round(props.product.dailyEarn * 365 - props.product.price) : null,
);
const stockLow = computed(
  () => !isShare.value && props.product.stock != null && props.product.stock < 50,
);
const multBase = computed(() =>
  props.product.dailyEarn > 0 ? Math.round(props.product.dailyEarn / 0.06) : null,
);
const showTradein = computed(
  () =>
    props.product.status === "legacy" &&
    !!props.product.supersededBy &&
    !!props.product.tradeinDiscount,
);

// Text helpers (toLocaleString / fmt) — kept out of template for clarity
const reviewsText = computed(() => props.product.reviews.toLocaleString());
const soldText = computed(() => props.product.sold.toLocaleString());
const multBaseText = computed(() => (multBase.value ?? 0).toLocaleString());
const dailyEarnText = computed(() => props.product.dailyEarn.toFixed(2));
const nexPerDayText = computed(() => fmt(t.value.store.cardNexPerDay, { n: props.product.dailyEarnNEX }));
const paysBackText = computed(() => fmt(t.value.store.cardPaysBackIn, { n: paybackDays.value ?? 0 }));
const year1NetText = computed(() => (year1Net.value ?? 0).toLocaleString());
const imagePerMinText = computed(() =>
  fmt(t.value.store.cardImagePerMin, { n: props.product.ai?.imageGenPerMin ?? 0 }),
);
const llmTokText = computed(() =>
  fmt(t.value.store.cardLlmTokens, { n: ((props.product.ai?.llmTokensPerSec ?? 0) / 1000).toFixed(1) }),
);
const videoText = computed(() =>
  fmt(t.value.store.cardVideoPerMin, { n: props.product.ai?.videoMinPerHour ?? 0 }),
);
const tradeCreditText = computed(() =>
  fmt(t.value.store.cardTradeCredit, { n: props.product.tradeinDiscount ?? 0 }),
);
const priceText = computed(() =>
  isShare.value ? String(props.product.price) : props.product.price.toLocaleString(),
);
const annualPaybackText = computed(() =>
  fmt(t.value.store.cardAnnualPayback, {
    roi: annualRoiPct(props.product),
    days: paybackDays.value ?? 0,
  }),
);
const stockPct = computed(() => Math.min(100, ((props.product.stock ?? 0) / 50) * 100));

function goDetail() {
  navTo(`/pages/store/detail?id=${props.product.id}`);
}
function goCheckout() {
  navTo(`/pages/store/checkout?product=${props.product.id}`);
}
function goDevices() {
  navTo("/pages/me/devices");
}

// ───── styles ─────
const cardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
};
const featuredGlowStyle: CSSProperties = {
  position: "absolute",
  inset: "-20%",
  background: "radial-gradient(40% 50% at 80% 0%, var(--v5-tech-cyan-soft) 0%, transparent 60%)",
  filter: "blur(12px)",
  opacity: 0.6,
  pointerEvents: "none",
};
const renderWrapStyle = computed<CSSProperties>(() => ({
  width: "100%",
  height: "180px",
  background: isShare.value
    ? "repeating-linear-gradient(135deg, rgba(12,196,214,0.08) 0 8px, transparent 8px 18px)," +
      "linear-gradient(135deg, var(--v5-tech-cyan-soft) 0%, var(--v5-surface-2) 100%)"
    : photo.value
      ? "linear-gradient(135deg, #101216 0%, #0A0B0E 60%, #000000 100%)"
      : "var(--v5-surface-2)",
}));
const vignetteStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.28) 78%, rgba(0,0,0,0.32) 88%)",
  pointerEvents: "none",
};
const fadeStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(180deg, transparent 78%, var(--v5-surface) 100%)",
  pointerEvents: "none",
};
const ribbonStyle: CSSProperties = {
  top: 0,
  left: "16px",
  padding: "3px 10px 4px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontVariantNumeric: "tabular-nums",
  fontSize: "11px",
  fontWeight: 500,
  borderRadius: "0 0 6px 6px",
  letterSpacing: "-0.005em",
  zIndex: 2,
  pointerEvents: "none",
};
const tierChipStyle: CSSProperties = {
  fontSize: "10.5px",
  letterSpacing: "0.22em",
  color: "rgba(255,255,255,0.88)",
  lineHeight: 1,
  background: "rgba(0,0,0,0.55)",
  padding: "5px 9px",
  borderRadius: "4px",
  border: "1px solid rgba(198,255,58,0.30)",
};
const legacyChipStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-warning)",
  lineHeight: 1.4,
  background: "rgba(0,0,0,0.55)",
  padding: "3px 8px",
  borderRadius: "4px",
  border: "1px solid rgba(255,203,77,0.45)",
};
const cloudChipStyle: CSSProperties = {
  fontSize: "10.5px",
  letterSpacing: "0.22em",
  color: "var(--v5-tech-cyan)",
  lineHeight: 1,
  background: "rgba(255,255,255,0.85)",
  padding: "5px 9px",
  borderRadius: "4px",
  border: "1px solid var(--v5-tech-cyan-border)",
  fontWeight: 600,
};
const nameStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "20px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.022em",
  lineHeight: 1.15,
};
const multStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "19px",
  color: "var(--v5-brand-2)",
  letterSpacing: "-0.018em",
  lineHeight: 1,
};
const earnEyebrowStyle: CSSProperties = {
  fontSize: "10.5px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  color: "var(--v5-success)",
  textTransform: "uppercase",
};
const bigEarnStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "26px",
  color: "var(--v5-success)",
  letterSpacing: "-0.022em",
  lineHeight: 1,
};
const chipBrandStyle: CSSProperties = {
  padding: "4px 9px",
  borderRadius: "6px",
  background: "var(--v5-brand-soft)",
  fontSize: "12px",
  color: "var(--v5-brand)",
  fontWeight: 500,
};
const chipNeutralStyle: CSSProperties = {
  padding: "4px 9px",
  borderRadius: "6px",
  background: "var(--v5-surface-2)",
  fontSize: "12px",
  color: "var(--v5-ink-2)",
  fontWeight: 500,
};
const chipSuccessStyle: CSSProperties = {
  padding: "4px 9px",
  borderRadius: "6px",
  background: "var(--v5-success-soft)",
  fontSize: "12px",
  color: "var(--v5-success)",
  fontWeight: 500,
};
const chipInkStyle: CSSProperties = {
  padding: "4px 9px",
  borderRadius: "6px",
  background: "var(--v5-surface-2)",
  fontSize: "12px",
  color: "var(--v5-ink)",
  fontWeight: 500,
};
const stockBoxStyle: CSSProperties = {
  padding: "10px 12px",
  gridTemplateColumns: "auto 1fr",
  gap: "10px",
  background: "var(--v5-brand-2-soft)",
  borderRadius: "10px",
};
const stockIconStyle: CSSProperties = {
  width: "22px",
  height: "22px",
  borderRadius: "6px",
  background: "var(--v5-brand-2)",
  color: "var(--v5-on-brand-2)",
};
const stockTextStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--v5-brand-2)",
  letterSpacing: "-0.005em",
};
const stockBarStyle = computed<CSSProperties>(() => ({
  height: "100%",
  borderRadius: "2px",
  background: "var(--v5-brand-2)",
  width: `${stockPct.value}%`,
}));
const tradeinBoxStyle: CSSProperties = {
  padding: "7px 10px",
  background: "var(--v5-brand-soft)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const footerStyle: CSSProperties = {
  padding: "13px 16px",
  background: "var(--v5-surface-2)",
  borderTop: "1px solid var(--v5-border)",
  gridTemplateColumns: "1fr auto",
};
const priceEyebrowStyle: CSSProperties = {
  fontSize: "10.5px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  color: "var(--v5-ink-4)",
  textTransform: "uppercase",
  lineHeight: 1,
};
const priceRowStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  letterSpacing: "-0.018em",
  lineHeight: 1,
  marginTop: "3px",
  color: "var(--v5-ink)",
};
const buyBtnStyle: CSSProperties = {
  height: "44px",
  padding: "0 22px",
  gap: "6px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  borderRadius: "999px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "14px",
  letterSpacing: "-0.005em",
};
</script>
