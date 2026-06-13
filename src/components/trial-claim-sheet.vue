<!--
  TrialClaimSheet — chassis-level bottom sheet surfacing the free-trial offer +
  routing to card binding. Ported from
  Nexion-prototype/app/components/trial-claim-sheet.tsx.
    · framer slide-up      → CSS keyframes
    · lucide X/Sparkles/Clock → inline <svg>
    · zero-friction copy (no charge/cap/grace numbers — disclosure lives on the
      bind step ?trial=1 and /me/trial), fully i18n-routed (t.trial.sheet*).
  The triggers (trial-hero-banner / trial-entry) already call
  useTrialClaimSheet().show(); this is the missing UI that renders when open.
-->
<template>
  <view v-if="sheet.open" class="tcs-root">
    <view class="tcs-backdrop" @click="hide" />

    <view class="tcs-panel" @click.stop>
      <!-- header -->
      <view class="tcs-head">
        <view class="tcs-head-l">
          <view class="tcs-spark-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" /></svg>
          </view>
          <view class="tcs-head-meta">
            <text class="tcs-cap">{{ t.trial.sheetCapLabel }}</text>
            <text class="tcs-title">{{ t.trial.sheetTitle }}</text>
          </view>
        </view>
        <view class="tcs-close" role="button" tabindex="0" :aria-label="t.trial.sheetCloseAria" @click="hide">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </view>
      </view>

      <!-- hero shadow-potential block -->
      <view class="tcs-hero">
        <view aria-hidden class="tcs-hero-grid" />
        <view class="tcs-hero-row">
          <text class="tcs-hero-label">{{ t.trial.sheetPotentialLabel }}</text>
          <text class="tcs-hero-perday">{{ perDay }}</text>
        </view>
        <view class="tcs-hero-num-row">
          <text class="tcs-hero-num">${{ shadowTotal }}</text>
          <text class="tcs-hero-suffix">{{ totalSuffix }}</text>
        </view>
      </view>

      <!-- 3 value props -->
      <view class="tcs-props">
        <view class="tcs-prop">
          <view class="tcs-prop-ico tcs-ico-brand">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
          </view>
          <view class="tcs-prop-meta">
            <text class="tcs-prop-title">{{ t.trial.sheetProp1Title }}</text>
            <text class="tcs-prop-sub">{{ prop1Sub }}</text>
          </view>
        </view>
        <view class="tcs-prop">
          <view class="tcs-prop-ico tcs-ico-cyan">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" /></svg>
          </view>
          <view class="tcs-prop-meta">
            <text class="tcs-prop-title">{{ t.trial.sheetProp2Title }}</text>
            <text class="tcs-prop-sub">{{ t.trial.sheetProp2Sub }}</text>
          </view>
        </view>
        <view class="tcs-prop">
          <view class="tcs-prop-ico tcs-ico-brand">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" /></svg>
          </view>
          <view class="tcs-prop-meta">
            <text class="tcs-prop-title">{{ prop3Title }}</text>
            <text class="tcs-prop-sub">{{ prop3Sub }}</text>
          </view>
        </view>
      </view>

      <!-- CTAs -->
      <view class="tcs-ctas" @click="onClaim">
        <view class="tcs-claim" role="button" tabindex="0" :aria-label="t.trial.sheetClaimCta" @click.stop="onClaim">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" /></svg>
          <text class="tcs-claim-t">{{ t.trial.sheetClaimCta }}</text>
        </view>
        <view class="tcs-dismiss" role="button" tabindex="0" :aria-label="t.trial.sheetDismissCta" @click.stop="hide">
          <text class="tcs-dismiss-t">{{ t.trial.sheetDismissCta }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useTrialClaimSheet } from "@/store/trial-claim-sheet";
import { useTrialConfig } from "@/store/trial-config";
import { useFreeTrial } from "@/store/free-trial";
import { toast } from "@/store/ui";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { navTo } from "@/lib/route";

const sheet = useTrialClaimSheet();
const trialConfig = useTrialConfig();
const freeTrial = useFreeTrial();
const t = useT();

const cfg = computed(() => trialConfig.config);
const shadowTotal = computed(() => (cfg.value.shadowDailyUSD * cfg.value.trialDays).toFixed(0));
const perDay = computed(() => fmt(t.value.trial.sheetPerDay, { amount: cfg.value.shadowDailyUSD.toFixed(2) }));
const totalSuffix = computed(() => fmt(t.value.trial.sheetTotalSuffix, { days: String(cfg.value.trialDays) }));
const prop1Sub = computed(() => fmt(t.value.trial.sheetProp1Sub, { days: String(cfg.value.trialDays) }));
const prop3Title = computed(() => fmt(t.value.trial.sheetProp3Title, { amount: String(cfg.value.discountCapUSD) }));
const prop3Sub = computed(() => fmt(t.value.trial.sheetProp3Sub, { pct: (cfg.value.discountRate * 100).toFixed(0) }));

function hide() {
  sheet.hide();
}
function onClaim() {
  // Eligibility guard: surfaces that don't pre-check (auto-push) could open this
  // when the trial can't start — tell the user instead of routing to a bind that
  // would silently fail to activate.
  if (!freeTrial.canStart()) {
    sheet.hide();
    toast.info(t.value.trial.toastCannotStart);
    return;
  }
  sheet.hide();
  // returnTo keeps the trial=1 marker so /me/trial auto-starts after the bind
  // redirect; the top-level trial=1 lets the bind page show the disclosure.
  const returnTo = encodeURIComponent("/pages/me/trial?trial=1");
  navTo(`/pages/me/wallet-cards-new?returnTo=${returnTo}&trial=1`);
}
</script>

<style scoped>
.tcs-root {
  position: fixed;
  inset: 0;
  z-index: 790;
}
.tcs-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(8, 8, 12, 0.45);
  backdrop-filter: blur(8px) saturate(150%);
  -webkit-backdrop-filter: blur(8px) saturate(150%);
  animation: tcs-fade 0.24s ease-out;
}
.tcs-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 800;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  background: var(--v5-surface);
  border-top: 1px solid var(--v5-border);
  padding: 20px 16px;
  padding-bottom: calc(env(safe-area-inset-bottom) + 38px);
  animation: tcs-slide-up 0.36s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes tcs-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes tcs-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.tcs-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.tcs-head-l {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tcs-spark-box {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--v5-brand) 14%, transparent);
}
.tcs-head-meta {
  display: flex;
  flex-direction: column;
}
.tcs-cap {
  font-size: 10.5px;
  font-family: var(--font-jet-mono), monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--v5-brand);
}
.tcs-title {
  font-family: var(--font-v5);
  font-size: 15px;
  font-weight: 600;
  color: var(--v5-ink);
  margin-top: 2px;
  line-height: 1.2;
}
.tcs-close {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--v5-surface-2);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.tcs-hero {
  margin-top: 16px;
  border-radius: 16px;
  padding: 16px;
  position: relative;
  overflow: hidden;
  background: color-mix(in srgb, var(--v5-brand) 6%, var(--v5-surface-2));
  border: 1px solid color-mix(in srgb, var(--v5-brand) 32%, transparent);
}
.tcs-hero-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.06;
  background-image:
    linear-gradient(var(--v5-brand) 1px, transparent 1px),
    linear-gradient(90deg, var(--v5-brand) 1px, transparent 1px);
  background-size: 16px 16px;
}
.tcs-hero-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tcs-hero-label {
  font-size: 10.5px;
  font-family: var(--font-jet-mono), monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--v5-brand);
}
.tcs-hero-perday {
  font-size: 10.5px;
  font-family: var(--font-jet-mono), monospace;
  color: var(--v5-ink-4);
}
.tcs-hero-num-row {
  position: relative;
  margin-top: 6px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.tcs-hero-num {
  font-family: var(--font-v5);
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1;
  color: var(--v5-brand);
}
.tcs-hero-suffix {
  font-size: 11.5px;
  font-family: var(--font-jet-mono), monospace;
  color: var(--v5-ink-3);
}
.tcs-props {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tcs-prop {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.tcs-prop-ico {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  margin-top: 1px;
}
.tcs-ico-brand {
  background: color-mix(in srgb, var(--v5-brand) 12%, transparent);
}
.tcs-ico-cyan {
  background: color-mix(in srgb, var(--v5-tech-cyan) 12%, transparent);
}
.tcs-prop-meta {
  flex: 1;
  min-width: 0;
}
.tcs-prop-title {
  font-family: var(--font-v5);
  font-size: 13.5px;
  font-weight: 600;
  color: var(--v5-ink);
  line-height: 1.35;
}
.tcs-prop-sub {
  display: block;
  font-size: 11.5px;
  color: var(--v5-ink-3);
  margin-top: 3px;
  line-height: 1.5;
}
.tcs-ctas {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tcs-claim {
  width: 100%;
  height: 48px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--v5-brand);
  box-shadow: 0 0 24px color-mix(in srgb, var(--v5-brand) 24%, transparent);
}
.tcs-claim-t {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--v5-on-brand);
  font-family: var(--font-v5);
}
.tcs-dismiss {
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tcs-dismiss-t {
  font-size: 12.5px;
  font-weight: 400;
  color: var(--v5-ink-3);
}
</style>
