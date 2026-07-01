<!--
  TrialHeroBanner — idle free-trial coupon entry (ported from
  Nexion-prototype/app/components/trial-hero-banner.tsx; "100% faithful v5 design
  draft" → uses exact design hex #9B89E0 / #FF6B35, NOT the V5 token map).

  Coupon/ticket silhouette: circular notches at 62% (top + bottom via mask-image),
  3D Y-flip entrance gated on scroll-into-view (useScrollGrowProgress → `played`),
  one-shot diagonal shimmer. LEFT identity body · dashed perforation · RIGHT value
  stub · dashed separator · scarcity dot + Claim CTA. Hidden unless trial idle &
  canStart(). Tap opens the trial claim sheet. <button> → <view @click> (uni).
-->
<template>
  <view
    v-if="visible"
    ref="elRef"
    class="block w-full active:scale-[0.998] transition-transform"
    :style="rootStyle"
    @click="onClick"
  >
    <!-- Coupon body — frosted glass cyan theme -->
    <view :style="bodyStyle">
      <!-- Shimmer sweep (gated on played) -->
      <view :style="shimmerStyle" />

      <!-- Main row — left identity · perforation · right value stub -->
      <view style="position: relative; z-index: 1; display: grid; grid-template-columns: calc(62% - 7px) 14px calc(38% - 7px); gap: 0; align-items: stretch">
        <!-- LEFT body -->
        <view style="padding: 16px 4px 14px 16px; min-width: 0">
          <view
            class="inline-flex items-center"
            style="gap: 5px; padding: 3px 9px; border-radius: 999px; background: rgba(72, 202, 255, 0.13); box-shadow: inset 0 0 0 1px rgba(103, 218, 255, 0.42)"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#67D7FF">
              <path d="M12 2l2.6 7.2L22 10l-5.6 4.6L18 22l-6-4-6 4 1.6-7.4L2 10l7.4-.8z" />
            </svg>
            <text style="font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 11px; color: #67D7FF; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase">{{ t.trial.heroBadge }}</text>
          </view>
          <text
            class="block"
            style="margin-top: 9px; font-family: var(--font-v5); font-weight: 600; font-size: 19px; color: var(--v5-ink); letter-spacing: -0.014em; line-height: 1.15"
          >{{ t.trial.heroDeviceName }}</text>
          <text
            class="block"
            style="margin-top: 4px; font-family: var(--font-v5); font-weight: 500; font-size: 13px; color: var(--v5-ink-3); letter-spacing: -0.005em; line-height: 1.4"
          >{{ taglineText }}</text>
        </view>

        <!-- Perforated divider -->
        <view style="position: relative; min-height: 100%; display: flex; align-items: center; justify-content: center">
          <view style="width: 1px; align-self: stretch; margin: 12px 0; background: repeating-linear-gradient(180deg, rgba(111,232,255,.60) 0 4px, transparent 4px 8px)" />
        </view>

        <!-- RIGHT stub -->
        <view style="padding: 16px 16px 14px 4px; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; min-width: 116px">
          <text style="font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 10.5px; color: var(--v5-ink-4); letter-spacing: 0.06em">{{ earnLabelText }}</text>
          <view
            class="inline-flex items-baseline"
            style="margin-top: 6px; gap: 1px; font-family: var(--font-amount); font-weight: 600; color: #72F0AE; font-variant-numeric: tabular-nums; letter-spacing: -0.024em; line-height: 1"
          >
            <text style="font-size: 20px; font-weight: 500; color: #72F0AE">$</text>
            <text style="font-size: 36px">{{ est }}</text>
          </view>
          <text style="margin-top: 5px; font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 11px; color: var(--v5-ink-4)">{{ dailyEarnText }}</text>
        </view>
      </view>

      <!-- Horizontal perforation/separator -->
      <view style="position: relative; z-index: 1; height: 1px; background: repeating-linear-gradient(90deg, rgba(92,154,255,.52) 0 4px, transparent 4px 8px); margin: 0 10px" />

      <!-- Bottom strip: scarcity + Claim CTA -->
      <view style="position: relative; z-index: 1; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; gap: 10px">
        <view class="inline-flex items-center" style="gap: 6px; font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12.5px; color: #FF6B35; font-weight: 500">
          <view style="--v5-hb-pulse-color: rgba(255,107,53,.70); --v5-hb-pulse-color-clear: rgba(255,107,53,0); width: 6px; height: 6px; border-radius: 50%; background: #FF6B35; box-shadow: 0 0 6px rgba(255,107,53,.70); animation: v5-hb-pulse 1.8s ease-in-out infinite" />
          <text style="color: #FF6B35">{{ trialsLeftText }}</text>
        </view>
        <view
          class="inline-flex items-center"
          style="padding: 8px 14px; border-radius: 999px; background: linear-gradient(90deg, #31D7F3 0%, #79E78A 100%); color: #06110D; font-family: var(--font-v5); font-weight: 600; font-size: 13.5px; border: 1px solid rgba(116, 241, 193, 0.55); gap: 5px; letter-spacing: -0.005em; white-space: nowrap"
        >
          <text style="color: #06110D; margin-left: 8px">{{ t.trial.heroClaimCta }}</text>
          <svg style="color: #06110D" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from "vue";
import { useFreeTrial } from "@/store/free-trial";
import { useTrialConfig } from "@/store/trial-config";
import { useTrialClaimSheet } from "@/store/trial-claim-sheet";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useScrollGrowProgress } from "@/composables/use-scroll-grow-progress";

const trial = useFreeTrial();
const trialCfg = useTrialConfig();
const claimSheet = useTrialClaimSheet();
const t = useT();

// Entrance plays once the coupon scrolls into view (not on mount).
const { elRef, inView } = useScrollGrowProgress({ threshold: 0.25 });
const played = ref(false);
watch(inView, (v) => {
  if (v) played.value = true;
});

const visible = computed(() => trial.status === "idle" && trial.canStart());

const trialDays = computed(() => trialCfg.config.trialDays);
const dailyEarn = computed(() => trialCfg.config.shadowDailyUSD);
const est = computed(() => Math.round(trialDays.value * dailyEarn.value));
// Mock urgency — production drives via availability endpoint (PRD §9.11 pending).
const trialsLeft = 47;

const taglineText = computed(() => fmt(t.value.trial.heroTagline, { days: trialDays.value }));
const earnLabelText = computed(() => fmt(t.value.trial.heroEarnLabel, { days: trialDays.value }));
const trialsLeftText = computed(() => fmt(t.value.trial.heroTrialsLeft, { n: trialsLeft }));
const dailyEarnText = computed(() => `$${dailyEarn.value.toFixed(2)}/d × ${trialDays.value}`);

const COUPON_MASK =
  "radial-gradient(circle at 62% 0, transparent 7px, #000 7.5px), " +
  "radial-gradient(circle at 62% 100%, transparent 7px, #000 7.5px)";

const rootStyle = computed<CSSProperties>(() => ({
  position: "relative",
  marginTop: "12px",
  color: "var(--v5-ink)",
  transformOrigin: "50% 50%",
  transformStyle: "preserve-3d",
  backfaceVisibility: "hidden",
  // Before play: opacity 0 (no flash of finished state); on play: 3D Y-flip in.
  opacity: played.value ? undefined : 0,
  animation: played.value ? "v5-ticket-enter 900ms cubic-bezier(0.22, 1.2, 0.36, 1) both" : "none",
  WebkitMaskImage: COUPON_MASK,
  WebkitMaskComposite: "source-in",
  maskImage: COUPON_MASK,
  maskComposite: "intersect",
}));

const bodyStyle: CSSProperties = {
  borderRadius: "16px",
  background:
    "radial-gradient(72% 70% at 0% 0%, rgba(54, 198, 255, 0.22), transparent 62%), " +
    "radial-gradient(78% 90% at 100% 100%, rgba(111, 238, 143, 0.17), transparent 68%), " +
    "linear-gradient(135deg, rgba(11, 31, 42, 0.88), rgba(11, 14, 22, 0.92) 56%, rgba(9, 30, 36, 0.88)), " + "var(--v5-surface-bg)",
  overflow: "hidden",
  position: "relative",
  boxShadow: "inset 0 0 0 1px rgba(88, 197, 255, 0.34), var(--v5-card-shadow-lift)",
};

const shimmerStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  inset: "0",
  pointerEvents: "none",
  zIndex: 2,
  overflow: "hidden",
  background: "linear-gradient(100deg, transparent 25%, rgba(118, 244, 203, 0.50) 50%, transparent 75%)",
  animation: played.value ? "v5-ticket-shimmer 1100ms ease-out 850ms 1 forwards" : "none",
  opacity: 0,
  mixBlendMode: "screen",
}));

function onClick() {
  claimSheet.show();
}
</script>
