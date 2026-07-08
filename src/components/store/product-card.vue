<!--
  ProductCard — the store's primary conversion unit (ported from store/page.tsx
  ProductCardV5 + ProductRender + ProductRibbon). The whole card taps to the
  detail page; the footer Buy/Stake CTA taps to checkout (stops propagation).

  Top→bottom:
    · ProductRender hero photo (S1/Pro/Rack) or cyan Cloud-Share schematic,
      with folded-corner badge ribbon + tier-code chip + Legacy chip overlay.
    · Body: name, ROI hero (daily earn / trade-in). Specs, ratings, and
      AI throughput stay on the detail page.
    · Footer: price + frosted Buy CTA.
-->
<template>
  <view
    class="product-card relative overflow-hidden block"
    :class="{ 'product-card--featured': featured }"
    :style="cardStyle"
    role="button"
    tabindex="0"
    @tap="goDetail"
    @click="goDetail"
  >
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

      <view
        v-if="featured"
        class="absolute inline-flex items-center justify-center"
        :style="detailButtonStyle"
        @tap.stop="goDetail"
        @click.stop="goDetail"
      >
        <text :style="detailButtonTextStyle">查看详情</text>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 5px"><path d="m9 18 6-6-6-6" /></svg>
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
    <view class="relative" :style="bodyStyle">
      <view>
        <view class="min-w-0">
          <text class="block" :style="nameStyle">{{ product.name }}</text>
        </view>
      </view>

      <view v-if="featured" class="mt-3 flex items-center justify-between gap-3">
        <text :style="compareStyle">对比手机 <text class="tabular-nums">117×</text></text>
        <text :style="generationStyle">S1 / {{ t.store.cardLegacyGen1 }}</text>
      </view>

      <view v-if="featured" class="mt-3 flex flex-wrap" style="gap: 8px">
        <text v-for="spec in featuredSpecs" :key="spec" :style="specPillStyle">{{ spec }}</text>
      </view>

      <!-- ROI 4-line hero -->
      <view class="mt-3 pt-3" :style="roiBlockStyle">
        <!-- Eyebrow -->
        <view class="font-mono-tabular inline-flex items-center gap-1.5" :style="earnEyebrowStyle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></svg>
          <text>{{ t.store.cardYouEarn }}</text>
        </view>

        <!-- Line 1: daily earn -->
        <view class="mt-1 flex items-baseline gap-2 flex-wrap">
          <text class="tabular-nums" :style="bigEarnStyle">${{ dailyEarnText }}<text :style="daySuffixStyle">{{ t.store.cardPerDaySuffix }}</text></text>
          <text class="font-mono-tabular tabular-nums" :style="nexPerDayStyle">{{ nexPerDayText }}</text>
          <text v-if="stockLow" class="font-mono-tabular tabular-nums" :style="stockHintStyle">{{ stockHintText }}</text>
        </view>

        <!-- Purchase gate — locked state (等级门/锁额) -->
        <view v-if="gateLockedView" class="mt-2.5" :style="gateBoxStyle">
          <view class="flex items-center justify-between" role="button" tabindex="0" @tap.stop="toggleGateDetails" @click.stop="toggleGateDetails">
            <view class="flex items-center gap-1.5" :style="gateEyebrowStyle">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              <text>{{ gate.soldOut ? t.store.gateSoldOut : t.store.gateLockedEyebrow }}</text>
            </view>
            <view v-if="!gate.soldOut" class="grid place-items-center" :style="gateToggleStyle">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </view>
          </view>
          <view v-if="!gate.soldOut && gateDetailsOpen" class="mt-1.5 flex flex-wrap" style="gap: 6px">
            <text v-for="(c, i) in gateCondTexts" :key="i" :style="gateCondStyle">{{ c }}</text>
          </view>
          <text v-if="!gate.soldOut && gateDetailsOpen" class="block" :style="gateMetaStyle">{{ gateModeText ? gateModeText + " · " : "" }}{{ gateProgressText }}</text>
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
        <text class="block font-mono-tabular" :style="priceEyebrowStyle">{{ t.store.cardPriceLabel }}</text>
        <view class="tabular-nums flex items-baseline" :style="priceRowStyle">
          <text :style="priceDollarStyle">$</text>
          <text :style="priceAmountStyle">{{ priceText }}</text>
        </view>
      </view>
      <view class="inline-flex items-center justify-center whitespace-nowrap" :style="buyBtnDynStyle" @tap.stop="onBuy" @click.stop="onBuy">
        <svg v-if="gateLockedView" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.9"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        <text @tap.stop="onBuy" @click.stop="onBuy">{{ buyLabel }}</text>
        <svg v-if="!gateLockedView" width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display: block; flex-shrink: 0; opacity: 0.95"><path d="M1 2l5 5-5 5" /></svg>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import type { Product } from "@/mock/products";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { navTo } from "@/lib/route";
import { usePurchaseGate } from "@/composables/use-purchase-gate";

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

const stockLow = computed(
  () => !isShare.value && props.product.stock != null && props.product.stock < 50,
);
const showTradein = computed(
  () =>
    props.product.status === "legacy" &&
    !!props.product.supersededBy &&
    !!props.product.tradeinDiscount,
);

// ── Purchase gate (等级门 + 锁额) — locked state + Buy redirect ──
const { gate } = usePurchaseGate(() => props.product);
const gateDetailsOpen = ref(false);
let lastGateToggleAt = 0;
const gateLockedView = computed(() => gate.value.gated && gate.value.blocked);
const gateCondTexts = computed(() =>
  gate.value.conditions.map((c) => {
    if (c.kind === "rank") return fmt(t.value.store.gateCondRank, { n: c.need });
    if (c.kind === "activeDirect") return fmt(t.value.store.gateCondDirect, { n: c.need });
    return fmt(t.value.store.gateCondVolume, { n: c.need.toLocaleString() });
  }),
);
const gateModeText = computed(() =>
  gate.value.conditions.length > 1
    ? props.product.purchaseGate?.mode === "all"
      ? t.value.store.gateModeAll
      : t.value.store.gateModeAny
    : "",
);
const gateProgressText = computed(() =>
  fmt(t.value.store.gateProgress, { pct: Math.round(gate.value.progressPct * 100) }),
);
const buyLabel = computed(() =>
  gate.value.soldOut
    ? t.value.store.gateSoldOut
    : gate.value.blocked
      ? t.value.store.gateLockedEyebrow
      : t.value.store.cardBuyNow,
);
function onBuy() {
  if (gate.value.blocked) {
    navTo("/pages/team/quota");
    return;
  }
  goCheckout();
}
function toggleGateDetails() {
  const now = Date.now();
  if (now - lastGateToggleAt < 120) return;
  lastGateToggleAt = now;
  if (!gate.value.soldOut) gateDetailsOpen.value = !gateDetailsOpen.value;
}

// Text helpers (toFixed / toLocaleString / fmt) — kept out of template for clarity
const dailyEarnText = computed(() => props.product.dailyEarn.toFixed(2));
const nexPerDayText = computed(() => fmt(t.value.store.cardNexPerDay, { n: props.product.dailyEarnNEX }));
const tradeCreditText = computed(() =>
  fmt(t.value.store.cardTradeCredit, { n: props.product.tradeinDiscount ?? 0 }),
);
const priceText = computed(() =>
  isShare.value ? String(props.product.price) : props.product.price.toLocaleString(),
);
const stockHintText = computed(() =>
  props.featured
    ? `仅剩 ${props.product.stock ?? 0} 台本周剩余`
    : fmt(t.value.store.cardStockCompact, { n: props.product.stock ?? 0 }),
);
const featuredSpecs = computed(() => [props.product.gpu, props.product.vram, "新加坡数据中心"]);

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
const cardStyle = computed<CSSProperties>(() => ({
  width: props.featured ? "366px" : undefined,
  maxWidth: props.featured ? "100%" : undefined,
  margin: props.featured ? "0 auto" : undefined,
  borderRadius: props.featured ? "18px" : "16px",
}));
const renderWrapStyle = computed<CSSProperties>(() => ({
  width: "100%",
  height: props.featured ? "200px" : "180px",
  borderRadius: props.featured ? "18px" : "0",
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
const fadeStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  inset: 0,
  background: props.featured
    ? "var(--store-featured-image-fade)"
    : "linear-gradient(180deg, transparent 78%, var(--v5-surface) 100%)",
  pointerEvents: "none",
}));
const ribbonStyle = computed<CSSProperties>(() => ({
  top: 0,
  left: "16px",
  padding: "3px 10px 4px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-numbers)",
  fontVariantNumeric: "tabular-nums",
  fontSize: "11px",
  fontWeight: 500,
  borderRadius: "0 0 6px 6px",
  letterSpacing: "-0.005em",
  zIndex: 2,
  pointerEvents: "none",
}));
const detailButtonStyle: CSSProperties = {
  right: "12px",
  bottom: "12px",
  minWidth: "0",
  height: "15px",
  padding: "0",
  borderRadius: "999px",
  background: "transparent",
  color: "var(--v5-brand)",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  fontWeight: 500,
  lineHeight: "12px",
  letterSpacing: "-0.005em",
  zIndex: 3,
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
};
const detailButtonTextStyle: CSSProperties = {
  fontSize: "12px",
  lineHeight: "12px",
  fontWeight: 500,
};
const tierChipStyle: CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.22em",
  color: "rgba(255,255,255,0.88)",
  lineHeight: 1,
  background: "rgba(0,0,0,0.55)",
  padding: "5px 9px",
  borderRadius: "4px",
};
const legacyChipStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-warning)",
  lineHeight: 1.4,
  background: "rgba(0,0,0,0.55)",
  padding: "3px 8px",
  borderRadius: "4px",
};
const cloudChipStyle: CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.22em",
  color: "var(--v5-tech-cyan)",
  lineHeight: 1,
  background: "rgba(255,255,255,0.85)",
  padding: "5px 9px",
  borderRadius: "4px",
  fontWeight: 600,
};
const bodyStyle = computed<CSSProperties>(() => ({
  padding: props.featured ? "18px 20px 12px" : "14px 16px",
}));
const nameStyle = computed<CSSProperties>(() => ({
  fontFamily: "var(--font-amount)",
  fontWeight: 600,
  fontSize: "20px",
  color: props.featured ? "var(--store-featured-card-color)" : "var(--v5-ink)",
  letterSpacing: "-0.022em",
  lineHeight: 1.15,
}));
const compareStyle = computed<CSSProperties>(() => ({
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--store-featured-text-2)",
  lineHeight: 1.2,
}));
const generationStyle = computed<CSSProperties>(() => ({
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--store-featured-text-3)",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
}));
const specPillStyle = computed<CSSProperties>(() => ({
  padding: "6px 9px",
  borderRadius: "999px",
  background: "var(--store-featured-pill-bg)",
  color: "var(--store-featured-text-2)",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  fontWeight: 500,
  lineHeight: 1,
}));
const roiBlockStyle = computed<CSSProperties>(() => ({
  borderTop: props.featured ? "1px dashed var(--store-featured-divider)" : "1px dashed var(--v5-border-strong)",
}));
const earnEyebrowStyle = computed<CSSProperties>(() => ({
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  color: props.featured ? "#9EDC1D" : "var(--v5-success)",
}));
const bigEarnStyle = computed<CSSProperties>(() => ({
  fontFamily: "var(--font-amount)",
  fontWeight: 600,
  fontSize: "26px",
  color: props.featured ? "#9EDC1D" : "var(--v5-success)",
  letterSpacing: "-0.022em",
  lineHeight: 1,
}));
const daySuffixStyle = computed<CSSProperties>(() => ({
  fontSize: "14px",
  color: props.featured ? "var(--store-featured-text-3)" : "var(--v5-ink-3)",
  fontWeight: 500,
}));
const nexPerDayStyle = computed<CSSProperties>(() => ({
  fontSize: "13.5px",
  color: props.featured ? "var(--store-featured-earn)" : "var(--v5-brand)",
  fontWeight: 500,
}));
const stockHintStyle = computed<CSSProperties>(() => ({
  marginLeft: "auto",
  fontFamily: "var(--font-v5)",
  fontSize: props.featured ? "12px" : "11px",
  fontWeight: 500,
  color: props.featured ? "var(--store-featured-text-3)" : "var(--v5-ink-4)",
  letterSpacing: "-0.005em",
  lineHeight: 1,
  whiteSpace: "nowrap",
}));
const tradeinBoxStyle: CSSProperties = {
  padding: "7px 10px",
  background: "var(--v5-brand-soft)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const footerStyle = computed<CSSProperties>(() => ({
  margin: "0",
  padding: props.featured ? "18px 32px 20px" : "13px 16px",
  background: props.featured ? "var(--store-featured-footer-bg)" : "var(--v5-surface-2)",
  borderTop: props.featured ? "1px solid var(--store-featured-divider)" : "1px solid var(--v5-border)",
  borderRadius: props.featured ? "0 0 18px 18px" : "0",
  gridTemplateColumns: "1fr auto",
  backdropFilter: props.featured ? "var(--store-featured-footer-filter)" : undefined,
  WebkitBackdropFilter: props.featured ? "var(--store-featured-footer-filter)" : undefined,
}));
const priceEyebrowStyle = computed<CSSProperties>(() => ({
  fontSize: "11.5px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  color: props.featured ? "var(--store-featured-text-3)" : "var(--v5-ink-3)",
  lineHeight: 1,
}));
const priceRowStyle = computed<CSSProperties>(() => ({
  fontFamily: "var(--font-amount)",
  letterSpacing: "-0.018em",
  lineHeight: 1,
  marginTop: "3px",
  color: props.featured ? "var(--store-featured-card-color)" : "var(--v5-ink)",
}));
const priceDollarStyle = computed<CSSProperties>(() => ({
  fontSize: "15px",
  color: props.featured ? "var(--store-featured-text-3)" : "var(--v5-ink-3)",
  fontWeight: 500,
}));
const priceAmountStyle: CSSProperties = {
  fontSize: "26px",
  fontWeight: 600,
};
const buyBtnStyle = computed<CSSProperties>(() => ({
  height: "44px",
  padding: "0 18px",
  gap: "8px",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  borderRadius: "999px",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "13.5px",
  letterSpacing: "-0.005em",
}));
// Locked Buy CTA = muted (soft surface, no brand) when gate blocks purchase.
const buyBtnDynStyle = computed<CSSProperties>(() =>
  gate.value.blocked
    ? { ...buyBtnStyle.value, background: "var(--v5-surface-2)", color: "var(--v5-ink-3)" }
    : buyBtnStyle.value,
);
const gateBoxStyle: CSSProperties = {
  padding: "8px 10px",
  background: "color-mix(in srgb, var(--v5-warning) 10%, transparent)",
  borderRadius: "10px",
};
const gateToggleBaseStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "999px",
  color: "var(--v5-warning)",
  background: "color-mix(in srgb, var(--v5-warning) 10%, transparent)",
  transition: "transform 160ms ease",
};
const gateToggleStyle = computed<CSSProperties>(() => ({
  ...gateToggleBaseStyle,
  transform: gateDetailsOpen.value ? "rotate(180deg)" : "rotate(0deg)",
}));
const gateEyebrowStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "var(--v5-warning)",
  letterSpacing: "0.02em",
};
const gateCondStyle: CSSProperties = {
  fontFamily: "var(--font-numbers)",
  fontSize: "11px",
  color: "var(--v5-ink-3)",
  background: "var(--v5-surface-2)",
  padding: "2px 8px",
  borderRadius: "6px",
};
const gateMetaStyle: CSSProperties = {
  marginTop: "6px",
  fontSize: "11px",
  color: "var(--v5-ink-4)",
};
</script>

<style>
:root {
  --store-featured-card-bg: var(--v5-surface);
  --store-featured-card-color: var(--v5-ink);
  --store-featured-text-2: var(--v5-ink-2);
  --store-featured-text-3: var(--v5-ink-3);
  --store-featured-earn: var(--v5-success);
  --store-featured-pill-bg: var(--v5-surface-3);
  --store-featured-divider: var(--v5-border-strong);
  --store-featured-footer-bg: var(--v5-surface-2);
  --store-featured-footer-filter: none;
  --store-featured-image-fade: linear-gradient(180deg, transparent 72%, rgba(255,255,255,0.82) 100%);
}

.product-card {
  background: var(--v5-surface);
  color: var(--v5-ink);
}

.product-card--featured {
  background: var(--store-featured-card-bg);
  color: var(--store-featured-card-color);
}

html[data-theme="dark"] {
  --store-featured-card-bg: var(--v5-surface);
  --store-featured-card-color: #F7F8FA;
  --store-featured-text-2: rgba(247,248,250,0.78);
  --store-featured-text-3: rgba(247,248,250,0.58);
  --store-featured-earn: #9EDC1D;
  --store-featured-pill-bg: rgba(255,255,255,0.08);
  --store-featured-divider: rgba(255,255,255,0.12);
  --store-featured-footer-bg: var(--v5-surface-2);
  --store-featured-footer-filter: none;
  --store-featured-image-fade: linear-gradient(180deg, transparent 72%, var(--v5-surface) 100%);
}
</style>
