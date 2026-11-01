<!-- Earn stage for the free-trial device: amber credit gauge, time left, estimate and the existing cancel / buy-early flows. -->
<template>
  <view class="trial-stage" :class="{ 'trial-stage--online': online }" role="tabpanel" :aria-label="`${name} · ${copy.imageBadge}`" data-device-key="trial:current">
    <view class="trial-stage__top">
      <view class="trial-stage__name-row"><text class="trial-stage__name" role="heading" aria-level="3">{{ name }}</text><NxTag tone="brand">{{ copy.imageBadge }}</NxTag></view>
      <view class="trial-stage__status"><view class="trial-stage__dot" :class="{ 'nx-online-dot': online }" /><text>{{ statusText }}</text></view>
    </view>
    <JobGauge :progress="gaugeProgress" :live="online && gaugeProgress != null" tone="amber" :label="copy.availableCredit"><DeviceArt :src="art" /></JobGauge>
    <view class="trial-stage__credit">
      <text class="trial-stage__credit-label">{{ copy.availableCredit }}</text>
      <text class="trial-stage__credit-value">{{ money(presentation.offsetUSD.value) }}<text class="trial-stage__credit-estimate">/ {{ fmt(t.earn.trialEstimateShort, { amount: money(presentation.estimatedOffsetUSD.value) }) }}</text></text>
    </view>
    <view class="trial-stage__stats">
      <view class="trial-stage__stat"><text class="trial-stage__label">{{ presentation.status.value === 'grace' ? copy.creditRemaining : copy.remaining }}</text><text class="trial-stage__value">{{ remaining }}</text></view>
      <view class="trial-stage__stat"><text class="trial-stage__label">{{ copy.estimate }}</text><text class="trial-stage__value">{{ money(presentation.estimatedOffsetUSD.value) }}</text></view>
    </view>
    <text v-if="presentation.status.value === 'grace'" class="trial-stage__note">{{ copy.grace }}</text>
    <text class="trial-stage__note">{{ copy.creditNote }}</text>
    <view v-if="!presentation.presentationReady.value" class="trial-stage__notice nx-inline-recovery" role="status"><text class="nx-inline-recovery__copy">{{ copy.unknown }}</text><view class="trial-stage__retry nx-inline-recovery__action" role="button" tabindex="0" @click="presentation.refresh"><text>{{ copy.retry }}</text></view></view>
    <view class="trial-stage__actions">
      <view v-if="presentation.status.value === 'active'" class="trial-stage__cancel" role="button" :tabindex="presentation.actionsReady.value && !cancelBusy ? 0 : -1" :aria-disabled="!presentation.actionsReady.value || cancelBusy" @click="cancelTrial"><text>{{ cancelBusy ? copy.cancelBusy : copy.cancel }}</text></view>
      <view class="trial-stage__group">
        <view class="trial-stage__pill" role="button" tabindex="0" :aria-label="copy.details" @click="goDetails"><text class="trial-stage__pill-face nx-frosted-button">{{ copy.detailsAction }}</text></view>
        <view class="trial-stage__pill trial-stage__pill--brand" role="button" :tabindex="presentation.actionsReady.value ? 0 : -1" :aria-disabled="!presentation.actionsReady.value" @click="goBuy"><text class="trial-stage__pill-face nx-frosted-button">{{ presentation.status.value === 'grace' ? copy.buy : copy.buyEarly }} →</text></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useDataVisibility } from "@/store/data-visibility";
import { useTrialPresentation } from "@/composables/use-trial-presentation";
import { useTrialFleetCopy } from "@/i18n/trial-fleet";
import { formatTrialCountdown } from "@/i18n/trial-lifecycle";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { formatAmount } from "@/lib/amount-display";
import { getProductMedia } from "@/lib/product-media";
import { navTo } from "@/lib/route";
import { useApp } from "@/store/app";
import { useFreeTrial } from "@/store/free-trial";
import { confirm as uiConfirm, toast } from "@/store/ui";
import NxTag from "@/components/ui/nx-tag.vue";
import DeviceArt from "@/components/device-art.vue";
import JobGauge from "./job-gauge.vue";

const visibility = useDataVisibility();
const presentation = useTrialPresentation();
const copy = useTrialFleetCopy();
const t = useT();
const app = useApp();
const trial = useFreeTrial();
const cancelBusy = ref(false);

const name = computed(() => presentation.deviceName.value || "—");
const art = computed(() => getProductMedia(presentation.productId.value)?.src ?? null);
const online = computed(() => presentation.presentationReady.value && presentation.status.value === "active");
const statusText = computed(() => !presentation.presentationReady.value ? copy.value.statusUnknown
  : online.value ? t.value.earn.online : copy.value.grace);
const remaining = computed(() => presentation.remainingMs.value === null ? "—" : formatTrialCountdown(presentation.remainingMs.value));
const gaugeProgress = computed(() => visibility.hidden || presentation.offsetProgress.value === null ? null : Math.round(presentation.offsetProgress.value * 100));
function money(value: number | null) {
  return visibility.mask(value === null ? "—" : `$${formatAmount(value)}`);
}
function goDetails() { navTo("/pages/me/trial"); }
function goBuy() { if (presentation.actionsReady.value) goDetails(); }

// Same confirmation, re-entry guard and account guard as the device warehouse trial card.
async function cancelTrial() {
  if (cancelBusy.value || !presentation.actionsReady.value || trial.status !== "active") return;
  const accountKey = app.accountKey;
  const bindingEpoch = app.accountBindingEpoch;
  cancelBusy.value = true;
  try {
    const ok = await uiConfirm({
      title: t.value.trial.cancelConfirmTitle,
      message: t.value.trial.cancelConfirmMsg,
      confirmLabel: t.value.trial.cancelConfirmOk,
      cancelLabel: t.value.trial.cancelConfirmKeep,
    });
    if (!ok || accountKey !== app.accountKey || bindingEpoch !== app.accountBindingEpoch
      || !presentation.actionsReady.value || trial.status !== "active") return;
    const result = await trial.cancel();
    if (accountKey !== app.accountKey || bindingEpoch !== app.accountBindingEpoch) return;
    if (result.ok) toast.info(t.value.trial.toastCancelled);
    else toast.warn(t.value.trial.cancelError);
  } finally {
    cancelBusy.value = false;
  }
}
</script>

<style scoped>
.trial-stage { position: relative; overflow: hidden; padding: 16px 18px 6px; border-radius: 24px; background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); color: var(--v5-ink); animation: trial-stage-in 280ms ease-out backwards; }
[data-theme="light"] .trial-stage { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.trial-stage--online::before { content: ""; position: absolute; left: 50%; top: 70px; width: 260px; height: 190px; margin-left: -130px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-success) 13%, transparent), transparent); pointer-events: none; }
.trial-stage__top { position: relative; }
.trial-stage__name-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.trial-stage__name { font: 600 20px/28px var(--font-v5); letter-spacing: -.01em; }
.trial-stage__status { display: flex; align-items: center; gap: 6px; margin-top: 2px; font: 400 13px/18px var(--font-v5); color: var(--v5-ink-3); }
.trial-stage__dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--v5-ink-4); }
.trial-stage__dot.nx-online-dot { background: var(--v5-success); }
.trial-stage__credit { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; margin-top: 10px; text-align: center; }
.trial-stage__credit-label { font: 400 13px/18px var(--font-v5); color: var(--v5-ink-2); }
.trial-stage__credit-value { font: 500 30px/34px var(--font-metric); color: var(--v5-ink); letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.trial-stage__credit-estimate { margin-left: 6px; font: 500 14px/20px var(--font-v5); color: var(--v5-ink-3); letter-spacing: 0; }
.trial-stage__stats { position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 16px; padding: 12px 0; border-top: 1px solid var(--v5-border); border-bottom: 1px solid var(--v5-border); }
.trial-stage__stat { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; padding: 0 4px; text-align: center; }
.trial-stage__stat + .trial-stage__stat { border-left: 1px solid var(--v5-border); }
.trial-stage__label { font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.trial-stage__value { font: 500 17px/22px var(--font-metric); color: var(--v5-ink); white-space: nowrap; font-variant-numeric: tabular-nums; }
.trial-stage__note { position: relative; display: block; margin-top: 10px; font: 400 12px/18px var(--font-v5); color: var(--v5-ink-3); text-align: center; }
.trial-stage__notice { position: relative; margin-top: 8px; color: var(--v5-warning-ink); font: 400 12px/18px var(--font-v5); }
.trial-stage__retry { display: flex; align-items: center; min-height: 44px; padding: 0 8px; color: var(--v5-brand); }
.trial-stage__actions { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 52px; margin-top: 6px; }
.trial-stage__cancel { display: inline-flex; align-items: center; min-height: 44px; font: 500 13px/18px var(--font-v5); color: var(--v5-ink-3); cursor: pointer; }
.trial-stage__group { display: flex; gap: 8px; margin-left: auto; }
/* 44px hit area; the visible glass pill stays a compact 32px. */
.trial-stage__pill { display: inline-flex; align-items: center; min-height: 44px; cursor: pointer; }
.trial-stage__pill-face { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 32px; padding: 0 12px; border-radius: 999px; font: 500 13px/18px var(--font-v5); white-space: nowrap; }
.trial-stage__pill--brand .trial-stage__pill-face { --ui-button-fill: color-mix(in srgb, var(--v5-brand) 14%, transparent); --ui-button-ink: var(--v5-brand); --ui-button-solid: color-mix(in srgb, var(--v5-brand) 12%, var(--v5-surface)); }
.trial-stage__pill[aria-disabled="true"], .trial-stage__cancel[aria-disabled="true"] { opacity: .5; }
.trial-stage__pill:active .trial-stage__pill-face { transform: scale(.97); }
[role="button"]:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; border-radius: 999px; }
@keyframes trial-stage-in { from { opacity: 0; transform: translateY(6px); } }
@media (prefers-reduced-motion: reduce) { .trial-stage { animation: none; } .trial-stage__pill:active .trial-stage__pill-face { transform: none; } }
</style>
