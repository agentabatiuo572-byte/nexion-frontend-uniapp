<!--
  StickyCTABar — chassis-level sticky bottom CTA. Ported from
  Nexion-prototype/app/components/mobile/sticky-cta-bar.tsx.
  Mounted as a direct chassis child (absolute positioning) so it stays inside
  the device bezel and respects overflow:hidden + rounded corners.
    · renders only when store.cta !== null
    · Link → <view @click> + shared navTo (P-036: no native <button>/<a>)
    · lucide ArrowRight → inline <svg stroke="currentColor">
    · useHaptic("medium") → uni.vibrateShort
    · soft glass via the shared .nx-glass-bar material (tokens.css)
  All display text (amount / subtext / buttonLabel) is caller-supplied via the
  payload; the price eyebrow is static via i18n (t.stickyCta.priceLabel).
-->
<template>
  <view v-if="cta" class="scb-outer" :style="outerStyle">
    <view class="scb-bar nx-glass-bar">
      <text v-if="cta.note" class="scb-note nx-tray-note" role="status">{{ cta.note }}</text>
      <view class="scb-info nx-tray-copy">
        <!-- Eyebrow — explicitly labels the number as PRICE so it isn't
             confused with yield/earnings shown elsewhere on the page. -->
        <text class="scb-eyebrow">{{ t.stickyCta.priceLabel }}</text>
        <!-- Price — small dim $ prefix + big bold number. -->
        <view class="scb-price">
          <template v-if="hasDollarPrefix">
            <text class="scb-price-dollar">$</text>
            <text class="scb-price-num">{{ amountBody }}</text>
          </template>
          <text v-else class="scb-price-num">{{ cta.amount }}</text>
        </view>
        <text v-if="cta.amountSubtext" class="scb-subtext" :style="subtextStyle">{{ cta.amountSubtext }}</text>
      </view>

      <view v-if="cta.quantity" class="scb-quantity" role="group" :aria-label="t.store.detQuantity">
        <NxButton size="small" :label="t.uiChrome.decreaseQty" :disabled="cta.quantity.value <= cta.quantity.min || cta.disabled" @click="cta.quantity.decrease"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14" /></svg></NxButton>
        <text aria-live="polite">{{ cta.quantity.value }}</text>
        <NxButton size="small" :label="t.uiChrome.increaseQty" :disabled="cta.quantity.value >= cta.quantity.max || cta.disabled" @click="cta.quantity.increase"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg></NxButton>
      </view>
      <view
        class="scb-cta"
        :style="ctaStyle"
        role="button"
        :tabindex="cta.disabled ? -1 : 0"
        :aria-disabled="cta.disabled ? 'true' : 'false'"
        @click="onTap"
        @keydown.enter.prevent="onTap"
        @keydown.space.prevent="onTap"
      >
        <text class="scb-cta-t">{{ cta.buttonLabel }}</text>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import NxButton from "@/components/ui/nx-button.vue";
import { navTo } from "@/lib/route";
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { useStickyCTA } from "@/store/sticky-cta-bar";

const t = useT();
const sticky = useStickyCTA();
const cta = computed(() => sticky.cta);

const accentColor = computed(() => cta.value?.accentColor ?? "var(--v5-brand)");
const subColor = computed(() => cta.value?.subtextColor ?? "var(--v5-ink-3)");


const hasDollarPrefix = computed(() => cta.value?.amount.startsWith("$") ?? false);
const amountBody = computed(() => (cta.value ? cta.value.amount.slice(1) : ""));

// Floating tray (04 §4.0): where the nav pill sits, or 8px above it when the tab bar shows.
const outerStyle = computed<CSSProperties>(() => ({
  bottom: (cta.value?.showTabBar ?? true) ? "calc(var(--nx-tray-bottom) + var(--nx-tabbar-height) + 8px)" : "var(--nx-tray-bottom)",
}));
const subtextStyle = computed<CSSProperties>(() => ({ color: subColor.value }));
const ctaStyle = computed<CSSProperties>(() => (cta.value?.disabled ? {} : { background: accentColor.value }));

function onTap() {
  if (!cta.value || cta.value.disabled) return;
  uni.vibrateShort({ fail: () => {} });
  navTo(cta.value.href);
}
</script>

<style scoped>
.scb-outer {
  position: absolute;
  left: 12px;
  right: 12px;
  z-index: 35;
  pointer-events: none;
}
.scb-bar {
  pointer-events: auto;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.scb-note {
  flex: 1 1 100%;
}
.scb-info {
  flex: 1 1 auto;
  min-width: 0;
  padding-top: 4px;
}
.scb-eyebrow {
  display: block;
  font: 400 12px/16px var(--font-v5);
  color: var(--v5-ink-3);
}
.scb-price {
  display: flex;
  align-items: baseline;
  margin-top: 2px;
  font-family: var(--font-v5);
  color: var(--v5-ink);
  white-space: nowrap;
}
.scb-price-dollar {
  font: 500 15px/20px var(--font-v5);
  color: var(--v5-ink-3);
}
.scb-price-num {
  font: 500 26px/32px var(--font-amount);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.scb-subtext {
  display: block;
  font-size: 12px;
  line-height: 16px;
}
.scb-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 48px;
  padding: 0 20px;
  border-radius: 999px;
  flex-shrink: 0;
}
.scb-cta:active {
  opacity: 0.85;
}
.scb-cta[aria-disabled="true"] :is(.scb-cta-t, svg) {
  color: var(--ui-tray-disabled-ink);
  stroke: currentColor;
}
.scb-cta-t {
  font: var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5);
  color: var(--v5-on-brand);
  white-space: normal;
}
.scb-cta { max-width:100%; box-sizing:border-box; min-height:48px; height:auto; padding-block:10px; text-align:center; }
.scb-cta svg { flex:none; }
@media(max-width:350px) { .scb-cta { flex:1 1 100%; } }
</style>

<style scoped>.scb-quantity { display:flex;align-items:center;gap:12px;color:var(--v5-ink);font:500 15px/20px var(--font-metric);font-variant-numeric:tabular-nums; }.scb-quantity :deep(.nx-button) { font:inherit; }.scb-quantity :deep(.nx-button__surface) { width:44px;min-height:36px;padding:0; }.scb-bar:has(.scb-quantity) { flex-wrap:wrap;gap:12px 8px; }.scb-bar:has(.scb-quantity) .scb-info { flex:1;min-width:110px; }.scb-bar:has(.scb-quantity) .scb-cta { width:100%; }</style>
