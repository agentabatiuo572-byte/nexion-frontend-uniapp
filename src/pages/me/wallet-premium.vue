<!--
  Premium subscription (ported from Nexion-prototype/app/(main)/me/wallet/premium/page.tsx).
  Phase-gated (premiumSubscriptionAvailable): pre-phase shows a locked card; in-phase
  shows the $99/mo pitch with 50% off first month. Subscribe is a local stub flag +
  toast (renewal/payment land later). Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 24px">
      <SubPageHeader back="/pages/me/wallet" />

      <!-- Hero -->
      <view class="mx-4 relative overflow-hidden" :style="heroStyle">
        <view class="flex items-center" style="gap: 8px; margin-bottom: 8px">
          <view class="grid place-items-center" :style="heroIconBoxStyle">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" /></svg>
          </view>
          <text :style="heroLabelStyle">{{ w.heroLabel }}</text>
        </view>
        <text class="block" :style="heroTitleStyle">{{ w.heroTitle }}</text>
        <text class="block" :style="heroSubStyle">{{ w.heroSubtitle }}</text>
      </view>

      <!-- Pricing card / locked -->
      <view class="mx-4" style="margin-top: 12px">
        <view v-if="!available" :style="lockedCardStyle">
          <view class="grid place-items-center" :style="lockBoxStyle">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </view>
          <text class="block" :style="lockedTitleStyle">{{ w.lockedTitle }}</text>
          <text class="block" :style="lockedBodyStyle">{{ w.lockedBody }}</text>
          <view class="flex items-center" :style="lockedEtaStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /></svg>
            <text>{{ w.lockedEta }}</text>
          </view>
        </view>

        <view v-else :style="priceCardStyle">
          <view class="flex items-center" :style="offBannerStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>
            <text :style="offTextStyle">{{ w.firstMonthOff }}</text>
          </view>
          <view class="text-center" style="padding: 20px">
            <view class="flex items-baseline justify-center" style="gap: 8px">
              <text :style="priceStyle">${{ firstMonthPrice }}</text>
              <text :style="perStyle">/ {{ w.firstMonth }}</text>
            </view>
            <text class="block" :style="normalPriceStyle">{{ normalPrice }}</text>
          </view>
          <view style="padding: 0 20px 20px; display: flex; flex-direction: column; gap: 10px">
            <view v-for="b in benefits" :key="b.title" class="flex items-start" style="gap: 10px">
              <view class="grid place-items-center shrink-0" :style="benefitIconBoxStyle">
                <view v-html="b.icon" />
              </view>
              <view class="min-w-0" style="flex: 1">
                <text class="block" :style="benefitTitleStyle">{{ b.title }}</text>
                <text class="block" :style="benefitBodyStyle">{{ b.body }}</text>
              </view>
            </view>
          </view>
          <view class="w-full flex items-center justify-center active:opacity-85" :style="subBtnStyle" @click="subscribe">
            <template v-if="subscribed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M20 6 9 17l-5-5" /></svg>
              <text>{{ w.subscribedLabel }}</text>
            </template>
            <template v-else>
              <text>{{ subscribeCta }}</text>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </template>
          </view>
          <text class="block text-center" :style="cancelAnytimeStyle">{{ w.cancelAnytime }}</text>
        </view>
      </view>

      <text class="block mx-4" :style="footerStyle">{{ w.footer }}</text>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast } from "@/store/ui";
import { useProductPhase } from "@/composables/use-product-phase";

const MONTHLY_PRICE = 99;
const FIRST_MONTH_DISCOUNT = 0.5;

const t = useT();
const w = computed(() => t.value.premium);
const phase = useProductPhase();
const subscribed = ref(false);

const available = computed(() => phase.value.premiumSubscriptionAvailable);
const firstMonthPrice = Math.round(MONTHLY_PRICE * (1 - FIRST_MONTH_DISCOUNT));
const normalPrice = computed(() => fmt(w.value.normalPrice, { price: MONTHLY_PRICE }));
const subscribeCta = computed(() => fmt(w.value.subscribeCta, { price: firstMonthPrice }));

const zapSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>`;
const crownSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" /></svg>`;
const shieldSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>`;

const benefits = computed(() => [
  { title: w.value.benefit1Title, body: w.value.benefit1Body, icon: zapSvg },
  { title: w.value.benefit2Title, body: w.value.benefit2Body, icon: crownSvg },
  { title: w.value.benefit3Title, body: w.value.benefit3Body, icon: shieldSvg },
]);

function subscribe() {
  if (subscribed.value) return;
  subscribed.value = true;
  toast.success(fmt(w.value.subscribeToast, { price: firstMonthPrice }));
}

const heroStyle: CSSProperties = {
  marginTop: "8px",
  borderRadius: "16px",
  padding: "20px",
  background:
    "radial-gradient(80% 60% at 90% 0%, color-mix(in srgb, var(--v5-warning) 22%, transparent) 0%, transparent 60%), var(--v5-surface)",
  border: "1px solid color-mix(in srgb, var(--v5-warning) 40%, transparent)",
};
const heroIconBoxStyle: CSSProperties = { width: "40px", height: "40px", borderRadius: "999px", background: "color-mix(in srgb, var(--v5-warning) 22%, transparent)" };
const heroLabelStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "11px", fontWeight: 500, color: "var(--v5-warning)", letterSpacing: "0.06em" };
const heroTitleStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "20px", fontWeight: 600, color: "var(--v5-ink)", lineHeight: 1.25 };
const heroSubStyle: CSSProperties = { marginTop: "6px", fontSize: "12.5px", color: "var(--v5-ink-3)", lineHeight: 1.6 };
const lockedCardStyle: CSSProperties = {
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  padding: "20px",
  textAlign: "center",
};
const lockBoxStyle: CSSProperties = { width: "48px", height: "48px", borderRadius: "999px", background: "var(--v5-surface-2)", margin: "0 auto 12px" };
const lockedTitleStyle: CSSProperties = { fontSize: "14px", fontWeight: 600, color: "var(--v5-ink)" };
const lockedBodyStyle: CSSProperties = { marginTop: "4px", fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.4 };
const lockedEtaStyle: CSSProperties = {
  marginTop: "12px",
  display: "inline-flex",
  padding: "4px 10px",
  borderRadius: "6px",
  background: "color-mix(in srgb, var(--v5-warning) 12%, transparent)",
  color: "var(--v5-warning)",
  fontSize: "10.5px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
};
const priceCardStyle: CSSProperties = {
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid color-mix(in srgb, var(--v5-warning) 30%, transparent)",
  overflow: "hidden",
};
const offBannerStyle: CSSProperties = {
  background: "linear-gradient(90deg, color-mix(in srgb, var(--v5-warning) 18%, transparent), color-mix(in srgb, var(--v5-warning) 8%, transparent))",
  padding: "8px 16px",
  borderBottom: "1px solid color-mix(in srgb, var(--v5-warning) 20%, transparent)",
};
const offTextStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "11px", fontWeight: 500, color: "var(--v5-warning)", letterSpacing: "0.06em" };
const priceStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "30px", fontWeight: 600, color: "var(--v5-ink)", lineHeight: 1 };
const perStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)" };
const normalPriceStyle: CSSProperties = { marginTop: "4px", fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "11px", color: "var(--v5-ink-4)" };
const benefitIconBoxStyle: CSSProperties = { width: "32px", height: "32px", borderRadius: "8px", background: "color-mix(in srgb, var(--v5-warning) 15%, transparent)" };
const benefitTitleStyle: CSSProperties = { fontSize: "12.5px", fontWeight: 600, color: "var(--v5-ink)" };
const benefitBodyStyle: CSSProperties = { fontSize: "11px", color: "var(--v5-ink-3)", marginTop: "2px", lineHeight: 1.4 };
const subBtnStyle = computed<CSSProperties>(() => ({
  width: "100%",
  height: "50px",
  background: subscribed.value ? "var(--v5-surface-2)" : "var(--v5-warning)",
  color: subscribed.value ? "var(--v5-ink-4)" : "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "14px",
}));
const cancelAnytimeStyle: CSSProperties = { padding: "8px 16px", fontSize: "10px", color: "var(--v5-ink-4)", background: "var(--v5-surface)" };
const footerStyle: CSSProperties = { marginTop: "16px", fontSize: "11px", color: "var(--v5-ink-3)", lineHeight: 1.6 };
</script>
