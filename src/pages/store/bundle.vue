<!--
  Bundle checkout — ported from Nexion-prototype/app/(main)/store/bundle/page.tsx.
  Multi-product bundle builder for tiered discounts (2 items 5% / 3 items 8% /
  4+ items 12%). Sits parallel to /store/checkout (single-product flow).

  Top→bottom: in-page back header → Hero (tier-discount ladder, active tiers
  light up) → Items list (remove / clear) → Suggestions (tap to add) → Total
  summary (subtotal / discount / total / combined daily + checkout CTA).
  Reuses the bundle cart store (persisted) + products mock.

  Wrapped in <AppChassis active="store"> with an in-page back header (mirrors
  detail.vue — uni chassis header is a fixed brand row, so per-page back/title
  scrolls with content). The checkout CTA is an INTENTIONAL placeholder: the
  bundle settlement flow is not wired yet, so it surfaces a "coming soon" toast
  instead of routing (single-product checkout works today).
-->
<template>
  <AppChassis active="store">
    <view class="pb-6" style="color: var(--v5-ink)">
      <!-- In-page header: back + title -->
      <view class="flex items-center" :style="headerStyle">
        <view class="grid place-items-center active:opacity-60" :style="backBtnStyle" role="button" tabindex="0" aria-label="Back to store" @tap.stop="goBack" @click.stop="goBack">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" @tap.stop="goBack" @click.stop="goBack"><path d="m15 18-6-6 6-6" /></svg>
        </view>
        <text class="min-w-0 flex-1 truncate" :style="headerTitleStyle">{{ t.bundle.navTitle }}</text>
      </view>

      <!-- Hero — v5 light surface + brand aurora -->
      <view class="mx-4 mt-2 relative overflow-hidden" :style="heroStyle">
        <view aria-hidden :style="heroAuroraStyle" />
        <view class="relative">
          <view class="flex items-center" style="gap: 6px; margin-bottom: 8px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>
            <text :style="heroLabelStyle">{{ t.bundle.heroLabel }}</text>
          </view>
          <text class="block" :style="heroTitleStyle">{{ t.bundle.heroTitle }}</text>
          <view class="grid grid-cols-3 gap-2" style="margin-top: 14px">
            <view v-for="tier in tiersReversed" :key="tier.minItems" class="p-2 text-center" :style="tierCellStyle(tier)">
              <text class="block" :style="tierLabelStyle(tier)">{{ tierText(tier) }}</text>
              <text class="block tabular-nums" :style="tierPctStyle(tier)">−{{ (tier.pct * 100).toFixed(0) }}%</text>
            </view>
          </view>
        </view>
      </view>

      <!-- Items -->
      <view class="mx-4 mt-3 overflow-hidden" :style="cardStyle">
        <view class="px-4 py-2.5 flex items-center justify-between" style="border-bottom: 1px solid var(--v5-border)">
          <text :style="itemsHeadingStyle">{{ t.bundle.itemsHeading }}</text>
          <text v-if="products.length > 0" class="active:opacity-70" style="font-size: 11.5px; color: var(--v5-ink-3)" role="button" tabindex="0" :aria-label="t.bundle.clear" @tap.stop="clear" @click.stop="clear">{{ t.bundle.clear }}</text>
        </view>

        <!-- Empty state -->
        <view v-if="products.length === 0" class="px-4 py-8 text-center">
          <text class="block" style="font-size: 36px; margin-bottom: 8px">🛒</text>
          <text class="block" :style="emptyTitleStyle">{{ t.bundle.emptyTitle }}</text>
          <text class="block" style="margin-top: 4px; font-size: 12px; color: var(--v5-ink-3); line-height: 1.4">{{ t.bundle.emptyBody }}</text>
        </view>

        <!-- Item rows -->
        <view
          v-for="(p, i) in products"
          v-else
          :key="p.id"
          class="px-4 py-2.5 flex items-center gap-3"
          :style="{ borderBottom: i === products.length - 1 ? 'none' : '1px solid var(--v5-border)' }"
        >
          <view class="flex-1 min-w-0">
            <text class="block truncate" :style="itemNameStyle">{{ p.name }}</text>
            <text class="block" :style="itemMetaStyle">
              <text style="color: var(--v5-ink-4)">Price </text>${{ p.price.toLocaleString() }}<text style="color: var(--v5-ink-4)"> · </text><text style="color: var(--v5-success)">Earns +${{ p.dailyEarn.toFixed(2) }}/d</text>
            </text>
          </view>
          <view class="shrink-0 rounded-full grid place-items-center active:opacity-70" style="width: 28px; height: 28px; background: var(--v5-surface-2)" role="button" tabindex="0" :aria-label="`Remove ${p.name}`" @tap.stop="remove(p.id)" @click.stop="remove(p.id)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </view>
        </view>
      </view>

      <!-- Suggestions -->
      <view v-if="suggestions.length > 0" class="mx-4 mt-3">
        <text class="block" :style="suggestionsHeadingStyle">{{ t.bundle.suggestionsHeading }}</text>
        <view class="space-y-2">
          <view
            v-for="p in suggestions"
            :key="p.id"
            class="w-full flex items-center gap-3 active:opacity-80"
            :style="suggestionRowStyle"
            role="button"
            tabindex="0"
            :aria-label="`Add ${p.name}`"
            @tap.stop="onAddSuggestion(p)"
            @click.stop="onAddSuggestion(p)"
          >
            <view class="flex-1 min-w-0 text-left">
              <text class="block truncate" :style="suggestionNameStyle">{{ p.name }}</text>
              <text class="block" :style="itemMetaStyle">
                <text style="color: var(--v5-ink-4)">Price </text>${{ p.price.toLocaleString() }}<text style="color: var(--v5-ink-4)"> · </text><text style="color: var(--v5-success)">Earns +${{ p.dailyEarn.toFixed(2) }}/d</text>
              </text>
            </view>
            <view class="shrink-0 rounded-full grid place-items-center" style="width: 28px; height: 28px; background: var(--v5-brand-soft); color: var(--v5-brand)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
            </view>
          </view>
        </view>
      </view>

      <!-- Total summary -->
      <view v-if="products.length > 0" class="mx-4 mt-3 relative overflow-hidden" :style="heroStyle">
        <view aria-hidden :style="totalAuroraStyle" />
        <view class="relative">
          <!-- Subtotal -->
          <view class="flex items-center justify-between" style="min-height: 24px">
            <text :style="rowLabelStyle(false)">{{ t.bundle.subtotal }}</text>
            <text class="tabular-nums" :style="rowValueStyle()">${{ subtotal.toLocaleString() }}</text>
          </view>
          <!-- Discount -->
          <view v-if="discountPct > 0" class="flex items-center justify-between" style="min-height: 24px">
            <text :style="rowLabelStyle(false)">{{ discountLabel }}</text>
            <text class="tabular-nums" :style="rowValueStyle('var(--v5-success)')">−${{ discountUSD.toFixed(0) }}</text>
          </view>
          <!-- Divider -->
          <view style="height: 1px; background: var(--v5-border); margin-top: 10px; margin-bottom: 10px" />
          <!-- Total -->
          <view class="flex items-center justify-between" style="min-height: 24px">
            <text :style="rowLabelStyle(true)">{{ t.bundle.total }}</text>
            <text class="tabular-nums" :style="rowValueStyle(undefined, true)">${{ totalText }}</text>
          </view>
          <!-- Combined daily -->
          <view class="flex items-center justify-between" style="min-height: 24px">
            <text :style="rowLabelStyle(false)">{{ t.bundle.combinedDaily }}</text>
            <text class="tabular-nums" :style="rowValueStyle('var(--v5-success)')">+${{ cumulativeDailyEarn.toFixed(2) }}/d</text>
          </view>
          <!-- Checkout CTA (intentional placeholder — see header comment) -->
          <view class="w-full flex items-center justify-center active:scale-[0.98]" :style="ctaStyle" role="button" tabindex="0" :aria-label="checkoutCtaText" @tap.stop="onCheckout" @click.stop="onCheckout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18" /><path d="M5 10l7-7 7 7" /><path d="M5 21h14" /></svg>
            <text :style="ctaLabelStyle">{{ checkoutCtaText }}</text>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </view>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useCart, bundleDiscountForCount, BUNDLE_DISCOUNT_TIERS, type BundleDiscountTier } from "@/store/cart";
import { PRODUCTS, getProduct, type Product } from "@/mock/products";
import { navTo } from "@/lib/route";
import { toast } from "@/store/ui";

const t = useT();
const cart = useCart();

const products = computed<Product[]>(() =>
  cart.items.map((id) => getProduct(id)).filter((p): p is Product => !!p),
);
const subtotal = computed(() => products.value.reduce((s, p) => s + p.price, 0));
const discountPct = computed(() => bundleDiscountForCount(products.value.length));
const discountUSD = computed(() => subtotal.value * discountPct.value);
const total = computed(() => subtotal.value - discountUSD.value);
const cumulativeDailyEarn = computed(() => products.value.reduce((s, p) => s + p.dailyEarn, 0));

const suggestions = computed(() =>
  PRODUCTS.filter((p) => !cart.items.includes(p.id) && p.tier !== "Share").slice(0, 3),
);

const tiersReversed = computed(() => BUNDLE_DISCOUNT_TIERS.slice().reverse());

const totalText = computed(() => total.value.toLocaleString(undefined, { maximumFractionDigits: 0 }));
const discountLabel = computed(() => fmt(t.value.bundle.bundleDiscount, { pct: (discountPct.value * 100).toFixed(0) }));
const checkoutCtaText = computed(() => fmt(t.value.bundle.checkoutCta, { total: totalText.value }));

function tierIsActive(tier: BundleDiscountTier): boolean {
  return products.value.length >= tier.minItems;
}
function tierText(tier: BundleDiscountTier): string {
  return fmt(t.value.bundle.tier, { n: tier.minItems });
}

function remove(id: string) {
  cart.remove(id);
}
function clear() {
  cart.clear();
}
function onAddSuggestion(p: Product) {
  cart.add(p.id);
  toast.success(fmt(t.value.bundle.addedToBundle, { name: p.name }));
}
function onCheckout() {
  toast.info(t.value.bundle.checkoutToast);
}

function goBack() {
  navTo("/store");
}

// ───── style objects ─────
const headerStyle: CSSProperties = { gap: "8px", padding: "8px 14px 4px" };
const backBtnStyle: CSSProperties = { width: "36px", height: "36px", marginLeft: "-6px" };
const headerTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "17px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  letterSpacing: "-0.014em",
};

const heroStyle: CSSProperties = {
  padding: "18px",
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
const heroAuroraStyle: CSSProperties = {
  position: "absolute",
  inset: "-20%",
  background:
    "radial-gradient(40% 50% at 80% 20%, var(--v5-brand-soft) 0%, transparent 60%)," +
    "radial-gradient(40% 50% at 10% 80%, var(--v5-success-soft) 0%, transparent 60%)",
  filter: "blur(8px)",
  pointerEvents: "none",
  opacity: 0.85,
};
const totalAuroraStyle: CSSProperties = {
  position: "absolute",
  top: "-40px",
  left: "-40px",
  width: "140px",
  height: "140px",
  borderRadius: "50%",
  background: "radial-gradient(circle, var(--v5-brand-2-soft), transparent 70%)",
  opacity: 0.6,
  pointerEvents: "none",
};
const heroLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-brand)",
  letterSpacing: "0.06em",
};
const heroTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "18px",
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
  lineHeight: 1.3,
};

function tierCellStyle(tier: BundleDiscountTier): CSSProperties {
  const active = tierIsActive(tier);
  return {
    borderRadius: "12px",
    background: active ? "var(--v5-brand-soft)" : "var(--v5-surface-2)",
    border: active ? "1px solid var(--v5-brand-border)" : "1px solid var(--v5-border)",
  };
}
function tierLabelStyle(_tier: BundleDiscountTier): CSSProperties {
  return {
    fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
    fontSize: "11px",
    fontWeight: 500,
    color: "var(--v5-ink-3)",
    letterSpacing: "0.06em",
  };
}
function tierPctStyle(tier: BundleDiscountTier): CSSProperties {
  const active = tierIsActive(tier);
  return {
    marginTop: "2px",
    fontFamily: "var(--font-v5)",
    fontWeight: 600,
    fontSize: "15px",
    letterSpacing: "-0.014em",
    color: active ? "var(--v5-brand)" : "var(--v5-ink)",
  };
}

const cardStyle: CSSProperties = {
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
const itemsHeadingStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
const emptyTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.008em",
};
const itemNameStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.008em",
};
const itemMetaStyle: CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10.5px",
  color: "var(--v5-ink-3)",
};

const suggestionsHeadingStyle: CSSProperties = {
  marginBottom: "10px",
  padding: "0 4px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
const suggestionRowStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "12px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
};
const suggestionNameStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "12.5px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.008em",
};

function rowLabelStyle(big: boolean): CSSProperties {
  return {
    fontFamily: "var(--font-v5)",
    fontSize: "12.5px",
    fontWeight: big ? 600 : 500,
    color: big ? "var(--v5-ink)" : "var(--v5-ink-3)",
  };
}
function rowValueStyle(tint?: string, big = false): CSSProperties {
  return {
    fontFamily: "var(--font-v5)",
    fontWeight: 600,
    fontSize: big ? "18px" : "13px",
    letterSpacing: big ? "-0.014em" : "-0.008em",
    color: tint ?? "var(--v5-ink)",
  };
}

const ctaStyle: CSSProperties = {
  marginTop: "14px",
  gap: "6px",
  height: "50px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  boxShadow: "var(--v5-spotlight-brand)",
  color: "var(--v5-on-brand)",
};
const ctaLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "14px",
  letterSpacing: "-0.005em",
  color: "var(--v5-on-brand)",
};
</script>
