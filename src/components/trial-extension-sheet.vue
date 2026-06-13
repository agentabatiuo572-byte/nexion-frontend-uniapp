<!--
  TrialExtensionSheet — chassis-level bottom sheet (Sprint #146-2 MVP-D).
  Ported from Nexion-prototype/app/components/trial-extension-sheet.tsx.
    · framer slide-up / fade      → CSS @keyframes (tes-*)
    · lucide X/Crown/Sparkles/Clock → inline <svg>
    · 1s tick interval (countdown freshness) → onMounted/onUnmounted (P-021)
    · backdrop / X close = implicit decline (declineExtension) so the grace
      poll doesn't immediately re-open this sheet.
    · fully i18n-routed (t.trialExtension.* + t.trial.sheetCloseAria).
  Open trigger: simulation/grace boundary calls useTrialExtensionSheet().show();
  this is the UI that renders when open. Chassis mounts it always-on.
-->
<template>
  <view v-if="sheet.open" class="tes-root">
    <view class="tes-backdrop" @click="dismissAsDecline" />

    <view class="tes-panel" @click.stop>
      <!-- top accent bar — lemon green anchor -->
      <view aria-hidden class="tes-accent-bar" />

      <!-- header — crown halo for VIP framing -->
      <view class="tes-head">
        <view class="tes-head-l">
          <view class="tes-crown-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M5 16h14" /></svg>
            <view aria-hidden class="tes-crown-halo" />
          </view>
          <view class="tes-head-meta">
            <text class="tes-cap">{{ t.trialExtension.vipCap }}</text>
            <text class="tes-title">{{ title }}</text>
          </view>
        </view>
        <view class="tes-close" :aria-label="t.trial.sheetCloseAria" @click="dismissAsDecline">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </view>
      </view>

      <!-- accrued earnings anchor — large lemon green hero -->
      <view class="tes-hero">
        <view aria-hidden class="tes-hero-grid" />
        <text class="tes-hero-label">{{ t.trialExtension.accruedLabel }}</text>
        <view class="tes-hero-num-row">
          <text class="tes-hero-sign">$</text>
          <text class="tes-hero-num">{{ shadowUSD.toFixed(2) }}</text>
          <text v-if="shadowNEX > 0" class="tes-hero-nex">+ {{ shadowNEX }} NEX</text>
        </view>
      </view>

      <!-- value props -->
      <view class="tes-props">
        <view class="tes-prop">
          <view class="tes-prop-ico">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
          </view>
          <view class="tes-prop-meta">
            <text class="tes-prop-title">{{ prop1Title }}</text>
            <text class="tes-prop-sub">{{ t.trialExtension.prop1Sub }}</text>
          </view>
        </view>
        <view class="tes-prop">
          <view class="tes-prop-ico">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" /></svg>
          </view>
          <view class="tes-prop-meta">
            <text class="tes-prop-title">{{ prop2Title }}</text>
            <text class="tes-prop-sub">{{ prop2Sub }}</text>
          </view>
        </view>
      </view>

      <!-- CTAs — accept primary, decline ghost -->
      <view class="tes-ctas">
        <view class="tes-accept" @click="onAccept">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M5 16h14" /></svg>
          <text class="tes-accept-t">{{ acceptCta }}</text>
        </view>
        <view class="tes-decline" @click="onDecline">
          <text class="tes-decline-t">{{ t.trialExtension.declineCta }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { useTrialExtensionSheet } from "@/store/trial-extension-sheet";
import { useFreeTrial } from "@/store/free-trial";
import { useTrialConfig } from "@/store/trial-config";
import { toast } from "@/store/ui";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

const sheet = useTrialExtensionSheet();
const freeTrial = useFreeTrial();
const trialConfig = useTrialConfig();
const t = useT();

const cfg = computed(() => trialConfig.config);
const shadowUSD = computed(() => freeTrial.shadowFrozenAtUSD);
const shadowNEX = computed(() => freeTrial.shadowFrozenAtNEX);
const extensionHours = computed(() => cfg.value.extensionDays * 24);

const title = computed(() => fmt(t.value.trialExtension.title, { days: String(cfg.value.extensionDays) }));
const prop1Title = computed(() => fmt(t.value.trialExtension.prop1Title, { hours: String(extensionHours.value) }));
const prop2Title = computed(() => fmt(t.value.trialExtension.prop2Title, { pct: (cfg.value.discountRate * 100).toFixed(0) }));
const prop2Sub = computed(() => fmt(t.value.trialExtension.prop2Sub, { amount: String(cfg.value.discountCapUSD) }));
const acceptCta = computed(() => fmt(t.value.trialExtension.acceptCta, { days: String(cfg.value.extensionDays) }));

// Re-render each second while open so the accrued figures / framing stay
// fresh (mirrors the prototype's 1s tick). Component-level → onUnmounted (P-021).
const tick = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;
function clearTimer() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}
watch(
  () => sheet.open,
  (isOpen) => {
    clearTimer();
    if (isOpen) {
      timer = setInterval(() => {
        tick.value += 1;
      }, 1000);
    }
  },
  { immediate: true },
);
onMounted(() => {
  // tick is consumed to keep the binding live; value itself is incidental.
  void tick.value;
});
onUnmounted(clearTimer);

// Backdrop / X close marks the offer as resolved, otherwise the grace-boundary
// poll re-opens the sheet immediately. Mirrors POST /api/trial/extension
// { accept: false }.
function dismissAsDecline() {
  freeTrial.declineExtension();
  sheet.hide();
}

function onAccept() {
  // Defense in depth: acceptExtension early-returns when status !== "grace"
  // or extensionGranted is true. Don't toast success if state didn't advance.
  const ok = freeTrial.acceptExtension();
  if (!ok) {
    toast.warn(t.value.trialExtension.toastFailTitle, t.value.trialExtension.toastFailBody);
    sheet.hide();
    return;
  }
  toast.success(fmt(t.value.trialExtension.toastAccepted, { days: String(cfg.value.extensionDays) }));
  sheet.hide();
}

function onDecline() {
  freeTrial.declineExtension();
  sheet.hide();
}
</script>

<style scoped>
.tes-root {
  position: fixed;
  inset: 0;
  z-index: 790;
}
.tes-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(8, 8, 12, 0.45);
  backdrop-filter: blur(8px) saturate(150%);
  -webkit-backdrop-filter: blur(8px) saturate(150%);
  animation: tes-fade 0.24s ease-out;
}
.tes-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 800;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  background: var(--v5-surface);
  border: 1px solid var(--v5-border);
  border-bottom: none;
  padding: 22px 18px;
  padding-bottom: calc(env(safe-area-inset-bottom) + 38px);
  overflow: hidden;
  animation: tes-slide-up 0.36s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes tes-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes tes-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.tes-accent-bar {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 2px;
  pointer-events: none;
  opacity: 0.8;
  background: linear-gradient(90deg, transparent, var(--v5-brand), transparent);
}
.tes-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.tes-head-l {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tes-crown-box {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--v5-brand) 14%, transparent);
}
.tes-crown-halo {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  pointer-events: none;
  box-shadow: 0 0 18px color-mix(in srgb, var(--v5-brand) 30%, transparent);
}
.tes-head-meta {
  display: flex;
  flex-direction: column;
}
.tes-cap {
  font-size: 10.5px;
  font-family: var(--font-jet-mono), monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--v5-brand);
}
.tes-title {
  font-family: var(--font-v5);
  font-size: 15px;
  font-weight: 600;
  color: var(--v5-ink);
  margin-top: 2px;
  line-height: 1.2;
}
.tes-close {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--v5-surface-2);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.tes-hero {
  margin-top: 16px;
  border-radius: 16px;
  padding: 16px;
  position: relative;
  overflow: hidden;
  background: color-mix(in srgb, var(--v5-brand) 6%, var(--v5-surface-2));
  border: 1px solid color-mix(in srgb, var(--v5-brand) 28%, transparent);
}
.tes-hero-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.06;
  background-image:
    linear-gradient(var(--v5-brand) 1px, transparent 1px),
    linear-gradient(90deg, var(--v5-brand) 1px, transparent 1px);
  background-size: 16px 16px;
}
.tes-hero-label {
  position: relative;
  display: block;
  font-size: 10.5px;
  font-family: var(--font-jet-mono), monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--v5-brand);
}
.tes-hero-num-row {
  position: relative;
  margin-top: 6px;
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.tes-hero-sign {
  font-family: var(--font-v5);
  font-size: 22px;
  font-weight: 500;
  color: var(--v5-ink-3);
  line-height: 1;
}
.tes-hero-num {
  font-family: var(--font-v5);
  font-size: 38px;
  font-weight: 600;
  letter-spacing: -0.024em;
  line-height: 1;
  color: var(--v5-ink);
  font-variant-numeric: tabular-nums;
}
.tes-hero-nex {
  margin-left: 4px;
  font-family: var(--font-jet-mono), monospace;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--v5-ink-3);
  font-variant-numeric: tabular-nums;
}
.tes-props {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tes-prop {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.tes-prop-ico {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  margin-top: 1px;
  background: color-mix(in srgb, var(--v5-brand) 12%, transparent);
}
.tes-prop-meta {
  flex: 1;
  min-width: 0;
}
.tes-prop-title {
  font-family: var(--font-v5);
  font-size: 13.5px;
  font-weight: 600;
  color: var(--v5-ink);
  line-height: 1.35;
}
.tes-prop-sub {
  display: block;
  font-size: 11.5px;
  color: var(--v5-ink-3);
  margin-top: 4px;
  line-height: 1.5;
}
.tes-ctas {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tes-accept {
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
.tes-accept-t {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--v5-on-brand);
  font-family: var(--font-v5);
}
.tes-decline {
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tes-decline-t {
  font-size: 12.5px;
  font-weight: 400;
  color: var(--v5-ink-3);
}
</style>
