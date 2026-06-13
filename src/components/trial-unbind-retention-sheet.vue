<!--
  TrialUnbindRetentionSheet — chassis-level bottom sheet (Sprint #146-2 MVP-C).
  Ported from Nexion-prototype/app/components/trial-unbind-retention-sheet.tsx.
    · framer slide-up / fade        → CSS @keyframes (tur-*)
    · lucide X/AlertTriangle/Sparkles/Clock → inline <svg>
    · 1s tick interval (live shadow + countdown) → onMounted/onUnmounted (P-021)
    · warning (amber) accent for header + loss block; retain CTA primary
      (lemon green + glow), unbind CTA weighted lighter per conversion priority.
    · fully i18n-routed (t.trialUnbind.* + t.trial.sheetCloseAria).
  Open trigger: the page owning the card list (e.g. /me cards) detects a delete
  on the active trial card and calls useTrialUnbindSheet().show(tokenId).
  Chassis mounts it always-on; confirm cancels trial + removes the card.
-->
<template>
  <view v-if="sheet.open" class="tur-root">
    <view class="tur-backdrop" @click="onKeep" />

    <view class="tur-panel" @click.stop>
      <!-- header — warning halo glow -->
      <view class="tur-head">
        <view class="tur-head-l">
          <view class="tur-warn-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
            <view aria-hidden class="tur-warn-halo" />
          </view>
          <view class="tur-head-meta">
            <text class="tur-cap">{{ t.trialUnbind.confirmCap }}</text>
            <text class="tur-title">{{ t.trialUnbind.title }}</text>
          </view>
        </view>
        <view class="tur-close" :aria-label="t.trial.sheetCloseAria" @click="onKeep">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </view>
      </view>

      <!-- loss anchor block — warning accent block (callout exception) -->
      <view class="tur-loss">
        <text class="tur-loss-label">{{ t.trialUnbind.lossLabel }}</text>

        <!-- accrued earnings — biggest visual weight -->
        <view class="tur-loss-num-row">
          <text class="tur-loss-num">${{ accruedUSD.toFixed(2) }}</text>
          <text v-if="accruedNEX > 0" class="tur-loss-nex">+ {{ accruedNEX }} NEX</text>
        </view>
        <text class="tur-loss-note">{{ t.trialUnbind.lossEarnNote }}</text>

        <!-- secondary loss items -->
        <view class="tur-loss-rows">
          <view v-if="remainingDays > 0" class="tur-loss-row">
            <svg class="tur-loss-row-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
            <text class="tur-loss-row-t">{{ lossDays }}</text>
          </view>
          <view class="tur-loss-row">
            <svg class="tur-loss-row-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
            <text class="tur-loss-row-t">{{ lossCooldown }}</text>
          </view>
        </view>
      </view>

      <!-- retain hook — restate the upside -->
      <view class="tur-retain">
        <view class="tur-retain-ico">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" /></svg>
        </view>
        <view class="tur-retain-meta">
          <text class="tur-retain-title">{{ t.trialUnbind.retainTitle }}</text>
          <text class="tur-retain-sub">{{ retainSub }}</text>
        </view>
      </view>

      <!-- CTAs — retain primary, unbind weighted lighter -->
      <view class="tur-ctas">
        <view class="tur-keep" @click="onKeep">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" /></svg>
          <text class="tur-keep-t">{{ t.trialUnbind.keepCta }}</text>
        </view>
        <view class="tur-unbind" @click="onConfirmUnbind">
          <text class="tur-unbind-t">{{ t.trialUnbind.unbindCta }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { useTrialUnbindSheet } from "@/store/trial-unbind-retention-sheet";
import { useFreeTrial, liveShadowUSD, liveShadowNEX, remainingMs } from "@/store/free-trial";
import { useTrialConfig } from "@/store/trial-config";
import { useCards } from "@/store/cards";
import { toast } from "@/store/ui";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

const sheet = useTrialUnbindSheet();
const freeTrial = useFreeTrial();
const trialConfig = useTrialConfig();
const cards = useCards();
const t = useT();

const cfg = computed(() => trialConfig.config);

// Live clock — re-rendered each second while open so accrued shadow + the
// remaining-days countdown stay fresh (mirrors the prototype's 1s tick).
const now = ref(Date.now());
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
      now.value = Date.now();
      timer = setInterval(() => {
        now.value = Date.now();
      }, 1000);
    }
  },
  { immediate: true },
);
onMounted(() => {
  now.value = Date.now();
});
onUnmounted(clearTimer);

// freeTrial referenced so the live-shadow helpers recompute when its state
// changes (they read useFreeTrial() internally); `now` drives the time term.
const accruedUSD = computed(() => {
  void freeTrial.status;
  return liveShadowUSD(now.value);
});
const accruedNEX = computed(() => {
  void freeTrial.status;
  return liveShadowNEX(now.value);
});
const remainingDays = computed(() => {
  void freeTrial.status;
  const ms = remainingMs(now.value);
  return Math.max(0, Math.ceil(ms / 86_400_000));
});

const lossDays = computed(() => fmt(t.value.trialUnbind.lossDays, { days: String(remainingDays.value) }));
const lossCooldown = computed(() => fmt(t.value.trialUnbind.lossCooldown, { days: String(cfg.value.cooldownDays) }));
const retainSub = computed(() => fmt(t.value.trialUnbind.retainSub, { amount: String(cfg.value.discountCapUSD) }));

function onKeep() {
  sheet.hide();
}

function onConfirmUnbind() {
  const tokenId = sheet.tokenId;
  if (!tokenId) {
    sheet.hide();
    return;
  }
  // ⚠️ MOCK-ONLY CROSS-STORE MUTATION (NON-ATOMIC): cancel + removeCard are two
  // store writes (composed at the component layer, stores never import each
  // other). Real backend: atomic POST /api/trial/cancel { reason:"unbind" }
  // + DELETE /api/cards/:tokenId in one tx, server enforces ordering.
  freeTrial.cancel("unbind");
  cards.remove(tokenId);
  toast.info(t.value.trialUnbind.toastUnbound);
  sheet.hide();
}
</script>

<style scoped>
.tur-root {
  position: fixed;
  inset: 0;
  z-index: 790;
}
.tur-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(8, 8, 12, 0.45);
  backdrop-filter: blur(8px) saturate(150%);
  -webkit-backdrop-filter: blur(8px) saturate(150%);
  animation: tur-fade 0.24s ease-out;
}
.tur-panel {
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
  animation: tur-slide-up 0.36s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes tur-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes tur-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.tur-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.tur-head-l {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tur-warn-box {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--v5-warning) 14%, transparent);
}
.tur-warn-halo {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  pointer-events: none;
  box-shadow: 0 0 16px color-mix(in srgb, var(--v5-warning) 24%, transparent);
}
.tur-head-meta {
  display: flex;
  flex-direction: column;
}
.tur-cap {
  font-size: 10.5px;
  font-family: var(--font-jet-mono), monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--v5-warning);
}
.tur-title {
  font-family: var(--font-v5);
  font-size: 15px;
  font-weight: 600;
  color: var(--v5-ink);
  margin-top: 2px;
  line-height: 1.2;
}
.tur-close {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--v5-surface-2);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.tur-loss {
  margin-top: 16px;
  border-radius: 16px;
  padding: 16px;
  position: relative;
  overflow: hidden;
  background: color-mix(in srgb, var(--v5-warning) 6%, var(--v5-surface-2));
  border: 1px solid color-mix(in srgb, var(--v5-warning) 28%, transparent);
}
.tur-loss-label {
  display: block;
  font-size: 10.5px;
  font-family: var(--font-jet-mono), monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--v5-warning);
}
.tur-loss-num-row {
  margin-top: 8px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.tur-loss-num {
  font-family: var(--font-v5);
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.022em;
  line-height: 1;
  color: var(--v5-ink);
  font-variant-numeric: tabular-nums;
}
.tur-loss-nex {
  font-size: 12.5px;
  font-family: var(--font-jet-mono), monospace;
  color: var(--v5-ink-3);
  font-variant-numeric: tabular-nums;
}
.tur-loss-note {
  display: block;
  font-size: 11.5px;
  color: var(--v5-ink-3);
  margin-top: 4px;
  line-height: 1.5;
}
.tur-loss-rows {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--v5-border) 40%, transparent);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tur-loss-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tur-loss-row-ico {
  flex-shrink: 0;
}
.tur-loss-row-t {
  font-size: 11.5px;
  color: var(--v5-ink-2);
  line-height: 1.35;
}
.tur-retain {
  margin-top: 12px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.tur-retain-ico {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  margin-top: 1px;
  background: color-mix(in srgb, var(--v5-brand) 12%, transparent);
}
.tur-retain-meta {
  flex: 1;
  min-width: 0;
}
.tur-retain-title {
  font-family: var(--font-v5);
  font-size: 13.5px;
  font-weight: 600;
  color: var(--v5-ink);
  line-height: 1.35;
}
.tur-retain-sub {
  display: block;
  font-size: 11.5px;
  color: var(--v5-ink-3);
  margin-top: 4px;
  line-height: 1.5;
}
.tur-ctas {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tur-keep {
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
.tur-keep-t {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--v5-on-brand);
  font-family: var(--font-v5);
}
.tur-unbind {
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tur-unbind-t {
  font-size: 12.5px;
  font-weight: 400;
  color: color-mix(in srgb, var(--v5-warning) 80%, transparent);
}
</style>
