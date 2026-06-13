<!--
  TrialEntry — ported from me/page.tsx TrialEntry (Sprint #146-2).
  Two states, self-deciding:
   • active/grace/extended → compact status row ("Trial · {state}" → /me/trial).
   • else if canStart()    → ticket-style claim offer (perforated edges via mask),
                             3-col grid (offer · perforation · $value) + urgency +
                             "Claim" CTA → opens the trial-claim sheet.
   • else                  → renders nothing.
  Reads useFreeTrial (status/canStart), useTrialClaimSheet (show), useTrialConfig.
-->
<template>
  <!-- Active-state row -->
  <view v-if="isActive" class="block active:opacity-90" :style="activeRowStyle" role="button" tabindex="0" :aria-label="activeTitle" @click="goTrial">
    <view style="flex: 1; min-width: 0">
      <text class="block" style="font-family: var(--font-v5); font-size: 13.5px; font-weight: 600; color: var(--v5-ink)">{{ activeTitle }}</text>
      <text class="block" style="font-size: 11.5px; color: var(--v5-ink-3); margin-top: 2px; font-family: var(--font-jet-mono), ui-monospace, monospace">{{ t.trial.entryDeviceName }}</text>
    </view>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
  </view>

  <!-- Claim ticket -->
  <view v-else-if="canStartNow" class="block active:opacity-90" :style="ticketOuterStyle" role="button" tabindex="0" :aria-label="t.trial.entryClaimCta" @click="openClaim">
    <view class="relative" :style="ticketBodyStyle">
      <!-- Soft success wash bottom-left -->
      <view aria-hidden :style="washStyle" />

      <!-- 3-col grid -->
      <view class="relative" :style="gridStyle">
        <!-- LEFT — offer copy -->
        <view style="min-width: 0">
          <view :style="badgeStyle">
            <text>{{ t.trial.entryBadge }}</text>
          </view>
          <text class="block" :style="offerTitleStyle">{{ t.trial.entryDeviceName }}</text>
          <text class="block" :style="offerDescStyle">{{ offerDesc }}</text>
        </view>

        <!-- MIDDLE — dashed perforation -->
        <view aria-hidden :style="perforationStyle" />

        <!-- RIGHT — value claim -->
        <view style="text-align: right; white-space: nowrap">
          <text class="block" :style="earnLabelStyle">{{ earnLabel }}</text>
          <view class="tabular-nums" :style="valueStyle">
            <text style="font-size: 16px; opacity: 0.7">$</text>
            <text style="font-size: 30px">{{ shadowTotal }}</text>
          </view>
        </view>
      </view>

      <!-- Bottom CTA strip -->
      <view class="relative" :style="ctaStripStyle">
        <text :style="urgencyStyle">{{ trialsLeftLabel }}</text>
        <view class="inline-flex items-center" :style="claimCtaStyle">
          <text>{{ t.trial.entryClaimCta }}</text>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
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

const status = computed(() => trial.status);
const isActive = computed(
  () => status.value === "active" || status.value === "grace" || status.value === "extended",
);
const canStartNow = computed(() => !isActive.value && trial.canStart());

const cfg = computed(() => trialConfig.config);
const shadowTotal = computed(() => (cfg.value.shadowDailyUSD * cfg.value.trialDays).toFixed(0));
const offerDesc = computed(() => fmt(t.value.trial.entryDescription, { days: cfg.value.trialDays }));
const earnLabel = computed(() => fmt(t.value.trial.entryEarnLabel, { days: cfg.value.trialDays }));

const stateLabel = computed(() =>
  status.value === "active"
    ? t.value.trial.activeStateActive
    : status.value === "grace"
      ? t.value.trial.activeStateGrace
      : t.value.trial.activeStateExtended,
);
const activeTitle = computed(() => fmt(t.value.trial.activeTitle, { state: stateLabel.value }));

// Mock urgency — server should drive this via /api/trial/availability.
const trialsLeftToday = 47;
const trialsLeftLabel = computed(() => fmt(t.value.trial.entryTrialsLeftToday, { n: trialsLeftToday }));

function goTrial() {
  uni.navigateTo({ url: "/pages/me/trial", fail: () => {} });
}
function openClaim() {
  claimSheet.show();
}

// ── styles ──
const activeRowStyle: CSSProperties = {
  marginTop: "10px",
  padding: "14px 16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
};
const ticketOuterStyle: CSSProperties = {
  marginTop: "10px",
  filter:
    "drop-shadow(0 0 0.5px var(--v5-border)) drop-shadow(0 0 0.5px var(--v5-border))",
};
const ticketBodyStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderRadius: "16px",
  padding: "16px 18px",
  overflow: "hidden",
  WebkitMaskImage:
    "radial-gradient(circle 9px at 0 50%, transparent 99%, #000 100%), radial-gradient(circle 9px at 100% 50%, transparent 99%, #000 100%)",
  maskImage:
    "radial-gradient(circle 9px at 0 50%, transparent 99%, #000 100%), radial-gradient(circle 9px at 100% 50%, transparent 99%, #000 100%)",
  WebkitMaskComposite: "source-in",
  maskComposite: "intersect",
};
const washStyle: CSSProperties = {
  position: "absolute",
  inset: "0",
  background:
    "radial-gradient(60% 100% at 0% 100%, color-mix(in srgb, var(--v5-success) 10%, transparent), transparent 60%)",
  pointerEvents: "none",
};
const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  gap: "16px",
  alignItems: "center",
};
const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "3px 8px",
  borderRadius: "4px",
  background: "var(--v5-success-soft)",
  border: "1px dashed color-mix(in srgb, var(--v5-success) 45%, transparent)",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "9.5px",
  color: "var(--v5-success)",
  fontWeight: 500,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};
const offerTitleStyle: CSSProperties = {
  marginTop: "10px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "17px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.014em",
  lineHeight: 1.15,
};
const offerDescStyle: CSSProperties = {
  marginTop: "5px",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.45,
};
const perforationStyle: CSSProperties = {
  width: "1px",
  height: "64px",
  backgroundImage: "linear-gradient(to bottom, var(--v5-border-strong) 50%, transparent 50%)",
  backgroundSize: "1px 6px",
};
const earnLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "9.5px",
  color: "var(--v5-ink-4)",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};
const valueStyle: CSSProperties = {
  marginTop: "8px",
  display: "inline-flex",
  alignItems: "baseline",
  gap: "1px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  color: "var(--v5-success)",
  letterSpacing: "-0.024em",
  lineHeight: 1,
};
const ctaStripStyle: CSSProperties = {
  marginTop: "14px",
  paddingTop: "12px",
  borderTop: "1px dashed var(--v5-border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};
const urgencyStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10.5px",
  color: "var(--v5-brand-2)",
  letterSpacing: "0.04em",
  fontWeight: 500,
};
const claimCtaStyle: CSSProperties = {
  gap: "5px",
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--v5-success)",
};
</script>
