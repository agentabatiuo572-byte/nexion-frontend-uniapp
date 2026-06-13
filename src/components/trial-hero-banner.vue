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
    <!-- Coupon body — frosted glass purple theme -->
    <view :style="bodyStyle">
      <!-- Inner top-edge glass highlight -->
      <view :style="highlightStyle" />
      <!-- Top edge purple glow accent -->
      <view :style="accentStyle" />
      <!-- Shimmer sweep (gated on played) -->
      <view :style="shimmerStyle" />

      <!-- Main row — left identity · perforation · right value stub -->
      <view style="position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 14px auto; gap: 0; align-items: stretch">
        <!-- LEFT body -->
        <view style="padding: 16px 4px 14px 16px; min-width: 0">
          <view
            class="inline-flex items-center"
            style="gap: 5px; padding: 3px 9px; border-radius: 999px; background: rgba(155,137,224,0.12); border: 1px solid rgba(155,137,224,0.45)"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#9B89E0">
              <path d="M12 2l2.6 7.2L22 10l-5.6 4.6L18 22l-6-4-6 4 1.6-7.4L2 10l7.4-.8z" />
            </svg>
            <text style="font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 11px; color: #9B89E0; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase">{{ t.trial.heroBadge }}</text>
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
          <view style="width: 1px; align-self: stretch; margin: 12px 0; background: repeating-linear-gradient(180deg, var(--v5-border-strong) 0 4px, transparent 4px 8px)" />
        </view>

        <!-- RIGHT stub -->
        <view style="padding: 16px 16px 14px 4px; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; min-width: 116px">
          <text style="font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 10.5px; color: var(--v5-ink-4); letter-spacing: 0.06em">{{ earnLabelText }}</text>
          <view
            class="inline-flex items-baseline"
            style="margin-top: 6px; gap: 1px; font-family: var(--font-v5); font-weight: 600; color: var(--v5-ink); font-variant-numeric: tabular-nums; letter-spacing: -0.024em; line-height: 1"
          >
            <text style="font-size: 20px; font-weight: 500; color: #9B89E0">$</text>
            <text style="font-size: 36px">{{ est }}</text>
          </view>
          <text style="margin-top: 5px; font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 11px; color: var(--v5-ink-4)">{{ dailyEarnText }}</text>
        </view>
      </view>

      <!-- Horizontal perforation/separator -->
      <view style="position: relative; z-index: 1; height: 1px; background: repeating-linear-gradient(90deg, var(--v5-border-strong) 0 4px, transparent 4px 8px); margin: 0 10px" />

      <!-- Bottom strip: scarcity + Claim CTA -->
      <view style="position: relative; z-index: 1; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; gap: 10px">
        <view class="inline-flex items-center" style="gap: 6px; font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12.5px; color: #FF6B35; font-weight: 500">
          <view style="width: 6px; height: 6px; border-radius: 50%; background: #FF6B35; box-shadow: 0 0 6px rgba(255,107,53,0.70); animation: v5-hb-pulse 1.6s ease-in-out infinite" />
          <text style="color: #FF6B35">{{ trialsLeftText }}</text>
        </view>
        <view
          class="inline-flex items-center"
          style="padding: 8px 14px; border-radius: 999px; background: transparent; color: #9B89E0; font-family: var(--font-v5); font-weight: 600; font-size: 13.5px; border: 1px solid rgba(155,137,224,0.45); gap: 5px; letter-spacing: -0.005em; white-space: nowrap"
        >
          <text style="color: #9B89E0">{{ t.trial.heroClaimCta }}</text>
          <text style="font-family: var(--font-jet-mono), ui-monospace, monospace; opacity: 0.8; font-size: 12px; color: #9B89E0">→</text>
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
    "radial-gradient(70% 60% at 0% 0%, rgba(155,137,224,0.18), transparent 60%), " +
    "radial-gradient(80% 100% at 100% 100%, rgba(155,137,224,0.12), transparent 65%), " +
    "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  overflow: "hidden",
  position: "relative",
  boxShadow: "var(--v5-card-shadow-lift)",
};

const highlightStyle: CSSProperties = {
  position: "absolute",
  left: "16px",
  right: "16px",
  top: "0",
  height: "1px",
  background:
    "linear-gradient(90deg, transparent, var(--v5-border-strong) 40%, var(--v5-border-strong) 60%, transparent)",
  pointerEvents: "none",
};

const accentStyle: CSSProperties = {
  position: "absolute",
  left: "0",
  right: "0",
  top: "0",
  height: "1px",
  background: "linear-gradient(90deg, transparent, #9B89E0, transparent)",
  opacity: 0.6,
  zIndex: 1,
};

const shimmerStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  inset: "0",
  pointerEvents: "none",
  zIndex: 2,
  overflow: "hidden",
  background: "linear-gradient(100deg, transparent 25%, rgba(198,255,58,0.55) 50%, transparent 75%)",
  animation: played.value ? "v5-ticket-shimmer 1100ms ease-out 850ms 1 forwards" : "none",
  opacity: 0,
  mixBlendMode: "screen",
}));

function onClick() {
  claimSheet.show();
}
</script>
