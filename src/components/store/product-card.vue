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
          <text>{{ t.store.cardYouEarn }}</text>
        </view>

        <!-- Line 1: daily earn -->
        <view class="mt-1 flex items-baseline gap-2 flex-wrap">
          <text class="tabular-nums" :style="bigEarnStyle">${{ dailyEarnText }}<text style="font-size: 14px; color: var(--v5-ink-3); font-weight: 500">{{ t.store.cardPerDaySuffix }}</text></text>
          <text class="font-mono-tabular tabular-nums" style="font-size: 13.5px; color: var(--v5-brand); font-weight: 500">{{ nexPerDayText }}</text>
        </view>

        <!-- Line 3: AI perf pills -->
        <view v-if="product.ai" class="mt-2.5 flex flex-wrap" style="gap: 6px">
          <SpecPill v-if="product.ai.imageGenPerMin" ai>{{ imagePerMinText }}</SpecPill>
          <SpecPill v-if="product.ai.llmTokensPerSec" ai>{{ llmTokText }}</SpecPill>
          <SpecPill v-if="product.ai.videoMinPerHour" ai>{{ videoText }}</SpecPill>
        </view>

        <!-- Purchase gate — locked state (等级门/锁额) -->
        <view v-if="gateLockedView" class="mt-2.5" :style="gateBoxStyle">
          <view class="flex items-center gap-1.5" :style="gateEyebrowStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            <text>{{ gate.soldOut ? t.store.gateSoldOut : t.store.gateLockedEyebrow }}</text>
          </view>
          <view v-if="!gate.soldOut" class="mt-1.5 flex flex-wrap" style="gap: 6px">
            <text v-for="(c, i) in gateCondTexts" :key="i" :style="gateCondStyle">{{ c }}</text>
          </view>
          <text v-if="!gate.soldOut" class="block" :style="gateMetaStyle">{{ gateModeText ? gateModeText + " · " : "" }}{{ gateProgressText }}</text>
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
        <text class="block font-mono-tabular" :style="priceEyebrowStyle">{{ t.store.cardPriceLabel }}</text>
        <view class="tabular-nums flex items-baseline" :style="priceRowStyle">
          <text style="font-size: 15px; color: var(--v5-ink-3); font-weight: 500">$</text>
          <text style="font-size: 26px; font-weight: 600">{{ priceText }}</text>
        </view>
      </view>
      <view class="inline-flex items-center justify-center whitespace-nowrap" :style="buyBtnDynStyle" @tap.stop="onBuy" @click.stop="onBuy">
        <svg v-if="gateLockedView" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; opacity: 0.9"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        <text @tap.stop="onBuy" @click.stop="onBuy">{{ buyLabel }}</text>
        <svg v-if="!gateLockedView" style="margin-left: 6px; opacity: 0.9" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import type { Product } from "@/mock/products";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import SpecPill from "./spec-pill.vue";
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
const multBase = computed(() =>
  props.product.dailyEarn > 0 ? Math.round(props.product.dailyEarn / 0.06) : null,
);
const showTradein = computed(
  () =>
    props.product.status === "legacy" &&
    !!props.product.supersededBy &&
    !!props.product.tradeinDiscount,
);

// ── Purchase gate (等级门 + 锁额) — locked state + Buy redirect ──
const { gate } = usePurchaseGate(() => props.product);
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

// Text helpers (toLocaleString / fmt) — kept out of template for clarity
const reviewsText = computed(() => props.product.reviews.toLocaleString());
const soldText = computed(() => props.product.sold.toLocaleString());
const multBaseText = computed(() => (multBase.value ?? 0).toLocaleString());
const dailyEarnText = computed(() => props.product.dailyEarn.toFixed(2));
const nexPerDayText = computed(() => fmt(t.value.store.cardNexPerDay, { n: props.product.dailyEarnNEX }));
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
  background: "var(--v5-surface-bg)",
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
  fontSize: "10.5px",
  letterSpacing: "0.22em",
  color: "var(--v5-tech-cyan)",
  lineHeight: 1,
  background: "rgba(255,255,255,0.85)",
  padding: "5px 9px",
  borderRadius: "4px",
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
const stockBoxStyle: CSSProperties = {
  gridTemplateColumns: "auto 1fr",
  gap: "10px",
};
const stockIconStyle: CSSProperties = {
  width: "22px",
  height: "22px",
  color: "var(--v5-brand-2)",
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
  fontSize: "11.5px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  color: "var(--v5-ink-3)",
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
  padding: "0 18px",
  gap: "6px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  borderRadius: "999px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13.5px",
  letterSpacing: "-0.005em",
};
// Locked Buy CTA = muted (soft surface, no brand) when gate blocks purchase.
const buyBtnDynStyle = computed<CSSProperties>(() =>
  gate.value.blocked
    ? { ...buyBtnStyle, background: "var(--v5-surface-2)", color: "var(--v5-ink-3)" }
    : buyBtnStyle,
);
const gateBoxStyle: CSSProperties = {
  padding: "8px 10px",
  background: "color-mix(in srgb, var(--v5-warning) 10%, transparent)",
  borderRadius: "10px",
};
const gateEyebrowStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "var(--v5-warning)",
  letterSpacing: "0.02em",
};
const gateCondStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  color: "var(--v5-ink-3)",
  background: "var(--v5-surface-2)",
  padding: "2px 8px",
  borderRadius: "6px",
};
const gateMetaStyle: CSSProperties = {
  marginTop: "6px",
  fontSize: "10.5px",
  color: "var(--v5-ink-4)",
};
</script>
