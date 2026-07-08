<!--
  VoucherBanner — top benefit lane injected by app-chassis. It hosts the voucher
  claim entry and the Home device-trial benefit in one lane. When both are shown,
  the track loops leftward by rendering the first card again at the end.
-->
<template>
  <view v-if="visible" class="vb-wrap">
    <view class="vb-viewport">
      <view class="vb-track" :class="{ 'vb-track--loop-2': cards.length === 2 }">
        <view v-for="(card, index) in loopCards" :key="`${card}-${index}`" class="vb-slide">
          <view
            v-if="card === 'voucher'"
            class="vb-card vb-card--voucher active:opacity-90"
            role="button"
            tabindex="0"
            :aria-label="t.voucher.bannerTitle"
            @click="openVoucher"
          >
            <image class="vb-voucher-img" src="/static/voucher/voucher-claim-banner.png?v=trim-3" mode="aspectFit" />
          </view>

          <view
            v-else-if="card === 'trial-idle'"
            class="vb-card vb-card--trial active:opacity-90"
            role="button"
            tabindex="0"
            :aria-label="t.trial.entryBenefitTitle"
            @click="openTrial"
          >
            <view class="vb-meta">
              <text class="vb-title">{{ t.trial.entryBenefitTitle }}</text>
              <text class="vb-sub">{{ trialOfferDesc }}</text>
            </view>
            <view class="vb-cta vb-cta--trial">
              <text class="vb-cta-t">{{ t.trial.entryClaimCta }}</text>
              <view class="vb-cta-arrow">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useVoucher } from "@/store/voucher";
import { useVoucherClaimSheet } from "@/store/voucher-claim-sheet";
import { useFreeTrial } from "@/store/free-trial";
import { useTrialClaimSheet } from "@/store/trial-claim-sheet";
import { useTrialConfig } from "@/store/trial-config";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import type { VoucherSurface } from "@/mock/vouchers";

const props = defineProps<{ surface: VoucherSurface }>();

const voucher = useVoucher();
const sheet = useVoucherClaimSheet();
const trial = useFreeTrial();
const trialSheet = useTrialClaimSheet();
const trialConfig = useTrialConfig();
const t = useT();

type BenefitCard = "voucher" | "trial-idle";

const voucherVisible = computed(() => voucher.hasClaimableForSurface(props.surface));
const trialIdleVisible = computed(() => (props.surface === "home" || props.surface === "earn" || props.surface === "store") && trial.canStart());
const cards = computed<BenefitCard[]>(() => {
  const out: BenefitCard[] = [];
  if (voucherVisible.value) out.push("voucher");
  if (trialIdleVisible.value) out.push("trial-idle");
  return out;
});
const loopCards = computed<BenefitCard[]>(() => (cards.value.length === 2 ? [...cards.value, cards.value[0]] : cards.value));
const visible = computed(() => cards.value.length > 0);
const trialOfferDesc = computed(() => fmt(t.value.trial.entryDescription, { days: trialConfig.config.trialDays }));

function openVoucher() {
  sheet.show();
}
function openTrial() {
  trialSheet.show();
}
</script>

<style scoped>
.vb-wrap {
  padding: 12px 0 0;
}
.vb-viewport {
  overflow: hidden;
  height: 84px;
}
.vb-track {
  display: flex;
  gap: 12px;
  padding: 0 24px;
  width: 100%;
  height: 84px;
  box-sizing: border-box;
  transform: translate3d(0, 0, 0);
  will-change: transform;
}
.vb-track--loop-2 {
  animation: vb-slide-left-2 8s cubic-bezier(0.32, 0.72, 0, 1) infinite;
}
.vb-slide {
  flex: 0 0 100%;
  height: 84px;
  min-width: 0;
  box-sizing: border-box;
}
.vb-card {
  box-sizing: border-box;
  height: 84px;
  display: flex;
  align-items: center;
  border-radius: 14px;
}
.vb-card--voucher {
  padding: 0;
  overflow: visible;
  background: transparent;
}
.vb-voucher-img {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.vb-meta {
  flex: 1;
  min-width: 0;
}
.vb-title {
  display: block;
  font-family: var(--font-v5);
  font-size: 13px;
  font-weight: 600;
  color: var(--v5-ink);
  letter-spacing: -0.008em;
  line-height: 1.3;
}
.vb-sub {
  display: block;
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--v5-ink-3);
  line-height: 1.3;
}
.vb-cta {
  flex-shrink: 0;
  min-height: 30px;
  padding: 0 13px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: var(--v5-brand);
}
.vb-cta-arrow {
  width: 12px;
  height: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.vb-cta--trial {
  min-height: 30px;
  padding: 0 13px;
  gap: 2px;
  background: var(--v5-brand);
}
.vb-cta-t {
  font-family: var(--font-v5);
  font-size: 12px;
  font-weight: 600;
  color: var(--v5-on-brand);
  letter-spacing: -0.005em;
}
.vb-card--voucher .vb-cta-t {
  transform: translateX(4px);
}
.vb-card--trial {
  --v5-surface-bg: var(--v5-surface);
  gap: 14px;
  overflow: hidden;
  border-radius: 16px;
  padding: 14px 16px;
  background:
    radial-gradient(120% 140% at 0% 0%, rgba(77,139,255,0.12), transparent 68%),
    radial-gradient(100% 120% at 100% 100%, rgba(23,109,255,0.08), transparent 66%),
    var(--v5-surface-bg);
  border: 1px solid rgba(77,139,255,0.28);
  box-shadow: 0 8px 22px rgba(24,84,180,0.12);
}
html[data-theme="dark"] .vb-card--trial {
  background: #0B100A;
  border: 1px solid color-mix(in srgb, var(--v5-brand) 28%, transparent);
  box-shadow: var(--v5-card-shadow-lift);
}
.vb-card--trial .vb-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
}
.vb-card--trial .vb-sub {
  margin-top: 4px;
  font-size: 12.5px;
  line-height: 1.35;
}
html:not([data-theme="dark"]) .vb-card--trial .vb-cta {
  background: var(--v5-brand);
  box-shadow: none;
}
.vb-card--trial .vb-cta-t {
  font-size: 12px;
  font-weight: 600;
  transform: translateX(4px);
}
.vb-card--trial .vb-cta-arrow {
  width: 12px;
  height: 12px;
  color: var(--v5-on-brand);
}
html:not([data-theme="dark"]) .vb-card--trial .vb-cta-t,
html:not([data-theme="dark"]) .vb-card--trial .vb-cta-arrow {
  color: #FFFFFF;
}

@keyframes vb-slide-left-2 {
  0%,
  36% {
    transform: translate3d(0, 0, 0);
  }
  50%,
  86% {
    transform: translate3d(calc(-100% + 36px), 0, 0);
  }
  100% {
    transform: translate3d(calc(-200% + 72px), 0, 0);
  }
}

@media (max-width: 390px) {
  .vb-card--trial {
    gap: 12px;
    padding: 14px 14px;
  }
  .vb-card--trial .vb-title {
    max-width: 10.75em;
  }
  .vb-card--trial .vb-sub {
    margin-top: 6px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

@media (max-width: 360px) {
  .vb-card--trial {
    gap: 10px;
    padding: 13px 12px;
  }
}
</style>
