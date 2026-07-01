<!--
  TrialPromoBanner — the idle free-trial promo, shared by Home and the Me page.
  Flat prompt: benefit headline + zero-commitment subtext (left) and a restrained
  soft-tint "Claim now" CTA (right), with generous top/bottom breathing so it reads
  as a light prompt amid the surrounding cards. No card chrome, no leading icon.
  Visible only while the trial is idle & startable; tapping anywhere opens the
  trial-claim sheet, where the full value, limits, and terms are shown.

  Single source of truth for this card — used by both pages/index/index.vue and
  components/me/trial-entry.vue so design tweaks land in one place.
-->
<template>
  <view v-if="visible" class="trial-promo-card block active:opacity-90" :style="bannerOuterStyle" role="button" tabindex="0" :aria-label="t.trial.entryBenefitTitle" @click="openClaim">
    <view class="trial-promo-body flex items-center" :style="bannerBodyStyle">
      <!-- Copy — left-aligned -->
      <view class="trial-promo-copy" style="flex: 1; min-width: 0">
        <text class="trial-promo-title block" :style="headlineStyle">{{ t.trial.entryBenefitTitle }}</text>
        <text class="trial-promo-sub block" :style="subStyle">{{ offerDesc }}</text>
      </view>

      <!-- CTA — right-aligned -->
      <view class="trial-promo-cta shrink-0 active:opacity-70" :style="claimBtnStyle">
        <view class="trial-promo-cta__content">
          <text class="trial-promo-cta__text">{{ t.trial.entryClaimCta }}</text>
          <view class="trial-promo-cta__arrow-frame">
            <svg class="trial-promo-cta__arrow" width="13.2" height="13.2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m8 4 8 8-8 8" /></svg>
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
import { useFreeTrial } from "@/store/free-trial";
import { useTrialClaimSheet } from "@/store/trial-claim-sheet";
import { useTrialConfig } from "@/store/trial-config";

const t = useT();
const trial = useFreeTrial();
const claimSheet = useTrialClaimSheet();
const trialConfig = useTrialConfig();

const isActive = computed(
  () => trial.status === "active" || trial.status === "grace" || trial.status === "extended",
);
const visible = computed(() => !isActive.value && trial.canStart());

const cfg = computed(() => trialConfig.config);
const offerDesc = computed(() => fmt(t.value.trial.entryDescription, { days: cfg.value.trialDays }));

function openClaim() {
  claimSheet.show();
}

// ── styles ──
const bannerOuterStyle: CSSProperties = {
  background: "var(--trial-promo-card-bg, var(--v5-surface-bg))",
  border: "1px solid var(--trial-promo-card-border, color-mix(in srgb, var(--v5-brand) 28%, transparent))",
  borderRadius: "16px",
  boxShadow: "var(--trial-promo-card-shadow, var(--v5-card-shadow-lift))",
  overflow: "hidden",
};
const bannerBodyStyle: CSSProperties = {
  gap: "14px",
  padding: "14px 16px",
};
const headlineStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "14px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.01em",
  lineHeight: 1.35,
};
const subStyle: CSSProperties = {
  marginTop: "4px",
  fontSize: "12.5px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.35,
};
const claimBtnStyle: CSSProperties = {
  height: "40px",
  padding: "0 14px",
  background: "var(--trial-promo-cta-bg, var(--v5-brand))",
  border: "1px solid var(--trial-promo-cta-border, transparent)",
  boxShadow: "var(--trial-promo-cta-shadow, none)",
  borderRadius: "999px",
  color: "var(--trial-promo-cta-ink, var(--v5-on-brand))",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};
</script>

<style scoped>
.trial-promo-cta__content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  line-height: 1;
}

.trial-promo-cta__text {
  color: currentColor;
  font-family: var(--font-v5);
  font-weight: 600;
  font-size: 13px;
  letter-spacing: -0.005em;
  line-height: 1;
  transform: translateX(4px);
}

.trial-promo-cta__arrow-frame {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
}

.trial-promo-cta__arrow {
  display: block;
  opacity: 0.9;
}

:global(html:not([data-theme="dark"])) .trial-promo-card {
  --trial-promo-card-bg:
    radial-gradient(120% 140% at 0% 0%, rgba(77, 139, 255, 0.12), transparent 68%),
    radial-gradient(100% 120% at 100% 100%, rgba(23, 109, 255, 0.08), transparent 66%), var(--v5-surface-bg);
  --trial-promo-card-border: rgba(77, 139, 255, 0.28);
  --trial-promo-card-shadow: 0 8px 22px rgba(24, 84, 180, 0.12);
}

:global(html[data-theme="dark"]) .trial-promo-card {
  --trial-promo-card-bg: #0B100A;
}

:global(html:not([data-theme="dark"])) .trial-promo-cta {
  background: var(--v5-cta-primary-bg) !important;
  border-color: var(--v5-cta-primary-border) !important;
  box-shadow: var(--v5-cta-primary-shadow) !important;
  color: var(--v5-cta-primary-ink) !important;
}

@media (max-width: 430px) {
  .trial-promo-body {
    display: flex !important;
    gap: 12px !important;
    align-items: center;
    padding: 14px 14px !important;
  }

  .trial-promo-copy {
    flex: 1 1 auto;
    min-width: 0;
  }

  .trial-promo-title {
    max-width: min(100%, 10.75em);
    line-height: 1.24 !important;
    text-wrap: balance;
  }

  .trial-promo-sub {
    margin-top: 6px !important;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trial-promo-cta {
    flex: 0 0 auto;
    height: 40px !important;
    padding: 0 14px !important;
  }
}

@media (max-width: 360px) {
  .trial-promo-body {
    gap: 10px !important;
    padding: 13px 12px !important;
  }
}
</style>
