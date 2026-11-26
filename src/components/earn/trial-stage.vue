<!-- Earn stage for the free-trial device: amber credit gauge, time left, estimate and the existing buy-early flow. -->
<template>
  <view ref="loopRef" class="trial-stage" :class="{ 'trial-stage--online': online && !visibility.hidden, 'nx-loops-paused': !loops.running.value }" role="tabpanel" :aria-label="`${name} · ${copy.imageBadge}`" data-device-key="trial:current">
    <view class="trial-stage__top">
      <view class="trial-stage__name-row"><text class="trial-stage__name" role="heading" aria-level="3">{{ name }}</text><NxTag tone="brand">{{ copy.imageBadge }}</NxTag></view>
      <view class="trial-stage__status"><view class="trial-stage__dot" :class="{ 'nx-online-dot': online }" /><text>{{ statusText }}</text></view>
    </view>
    <JobGauge :progress="gaugeProgress" :live="online && gaugeProgress != null" tone="amber" :label="copy.availableCredit"><DeviceArt :src="art" /></JobGauge>
    <view class="trial-stage__credit">
      <text class="trial-stage__credit-label">{{ copy.availableCredit }}</text>
      <text class="trial-stage__credit-value">{{ money(presentation.offsetUSD.value) }}<text v-if="presentation.offsetUSD.value !== null" class="trial-stage__unit">&nbsp;USDT</text><text class="trial-stage__credit-estimate">/ {{ fmt(t.earn.trialEstimateShort, { amount: moneyText(presentation.estimatedOffsetUSD.value) }) }}</text></text>
    </view>
    <view class="trial-stage__stats">
      <view class="trial-stage__stat"><text class="trial-stage__label">{{ presentation.status.value === 'grace' ? copy.creditRemaining : copy.remaining }}</text><text class="trial-stage__value">{{ remaining }}</text></view>
      <view class="trial-stage__stat"><text class="trial-stage__label">{{ copy.estimate }}</text><text class="trial-stage__value">{{ money(presentation.estimatedOffsetUSD.value) }}<text v-if="presentation.estimatedOffsetUSD.value !== null" class="trial-stage__unit">&nbsp;USDT</text></text></view>
    </view>
    <text v-if="presentation.status.value === 'grace'" class="trial-stage__note">{{ copy.grace }}</text>
    <text class="trial-stage__note">{{ copy.creditNote }}</text>
    <view class="trial-stage__actions">
      <view class="trial-stage__group">
        <view class="trial-stage__pill" role="button" tabindex="0" :aria-label="copy.details" @click="goDetails"><text class="trial-stage__pill-face nx-frosted-button">{{ copy.detailsAction }}</text></view>
        <view class="trial-stage__pill trial-stage__pill--brand" role="button" :tabindex="presentation.actionsReady.value ? 0 : -1" :aria-disabled="!presentation.actionsReady.value" :aria-label="buyLabel" @click="goBuy"><text class="trial-stage__pill-face nx-frosted-button nx-after-arrow">{{ buyText }}</text></view>
      </view>
    </view>
    <!-- After a failed read the reason sits under the dimmed buy pill (03 §3.1, §3.4); it also covers a stage with no confirmed figures. -->
    <text v-if="trial.lastReadFailed && !presentation.actionsReady.value" class="trial-stage__reason">{{ presentation.displayReady.value ? copy.retainedCredit : copy.unknown }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useFreeTrial } from "@/store/free-trial";
import { useDataVisibility } from "@/store/data-visibility";
import { useTrialPresentation } from "@/composables/use-trial-presentation";
import { useTrialFleetCopy } from "@/i18n/trial-fleet";
import { formatTrialCountdown } from "@/i18n/trial-lifecycle";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { formatAmount } from "@/lib/amount-display";
import { getProductMedia } from "@/lib/product-media";
import { navTo } from "@/lib/route";
import NxTag from "@/components/ui/nx-tag.vue";
import DeviceArt from "@/components/device-art.vue";
import JobGauge from "./job-gauge.vue";
import { useLoopsInView } from "@/composables/use-loops-in-view";

const visibility = useDataVisibility();
const trial = useFreeTrial();
const presentation = useTrialPresentation(undefined, { retainOnReadFailure: true });
defineExpose({ readFailedWithoutData: presentation.readFailedWithoutData });
const copy = useTrialFleetCopy();
const t = useT();
// The online dot breathes only while the stage is on screen and the page is shown.
const loops = useLoopsInView(".trial-stage");
const loopRef = loops.elRef;

const name = computed(() => presentation.deviceName.value || "—");
const art = computed(() => getProductMedia(presentation.productId.value)?.src ?? null);
const online = computed(() => presentation.displayReady.value && presentation.status.value === "active");
const statusText = computed(() => !presentation.displayReady.value ? copy.value.statusUnknown
  : online.value ? t.value.earn.online : copy.value.grace);
const remaining = computed(() => presentation.remainingMs.value === null ? "—" : formatTrialCountdown(presentation.remainingMs.value));
const gaugeProgress = computed(() => visibility.hidden || presentation.offsetProgress.value === null ? null : Math.round(presentation.offsetProgress.value * 100));
// Amounts carry their unit USDT (01 §1.2, 03 §3.6.1): the template sets it after the figure; in a sentence it is joined by U+00A0.
function money(value: number | null) {
  return value === null ? "—" : visibility.mask(formatAmount(value));
}
function moneyText(value: number | null) {
  return value === null ? "—" : `${money(value)}\u00A0USDT`;
}
const buyText = computed(() => copy.value.buy);
// A failed trial read shows no strip (03 §3.4); the dimmed buy pill still tells screen readers why.
const buyLabel = computed(() => trial.lastReadFailed && !presentation.actionsReady.value ? `${buyText.value} · ${copy.value.unknown}` : undefined);
function goDetails() { navTo("/pages/me/trial"); }
function goBuy() { if (presentation.actionsReady.value) goDetails(); }

</script>

<style scoped>
.trial-stage { position: relative; overflow: hidden; padding: 16px 18px 6px; border-radius: 24px; background: var(--v5-surface); box-shadow: inset 0 0 0 1px var(--v5-border); color: var(--v5-ink); animation: trial-stage-in 280ms ease-out backwards; }
[data-theme="light"] .trial-stage { box-shadow: inset 0 0 0 1px var(--v5-border), var(--v5-glass-shadow); }
.trial-stage--online::before { content: ""; position: absolute; left: 50%; top: 70px; width: 260px; height: 190px; margin-left: -130px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-success) 13%, transparent), transparent); pointer-events: none; }
.trial-stage__top { position: relative; }
.trial-stage__name-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.trial-stage__name { font: 600 20px/28px var(--font-v5); }
.trial-stage__status { display: flex; align-items: center; gap: 6px; margin-top: 2px; font: 400 13px/18px var(--font-v5); color: var(--v5-ink-3); }
.trial-stage__dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--v5-ink-4); }
.trial-stage__dot.nx-online-dot { background: var(--v5-success); }
.trial-stage__credit { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; margin-top: 10px; text-align: center; }
.trial-stage__credit-label { font: 400 13px/18px var(--font-v5); color: var(--v5-ink-2); }
.trial-stage__credit-value { font: 500 30px/34px var(--font-metric); color: var(--v5-ink); letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
/* Unit after a figure (01 §1.2): max(12px, .4em) (12px for the 30px credit and the 17px stats), 500, auxiliary. */
.trial-stage__unit { font: 500 max(12px, .4em)/1 var(--font-v5); letter-spacing: 0; color: var(--v5-ink-3); }
.trial-stage__credit-estimate { margin-left: 6px; font: 500 14px/20px var(--font-v5); color: var(--v5-ink-3); letter-spacing: 0; }
.trial-stage__stats { position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 16px; padding: 12px 0; border-top: 1px solid var(--v5-border); border-bottom: 1px solid var(--v5-border); }
.trial-stage__stat { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; padding: 0 4px; text-align: center; }
.trial-stage__stat + .trial-stage__stat { border-left: 1px solid var(--v5-border); }
.trial-stage__label { font: 400 12px/16px var(--font-v5); color: var(--v5-ink-3); }
.trial-stage__value { font: 500 17px/22px var(--font-metric); color: var(--v5-ink); white-space: nowrap; font-variant-numeric: tabular-nums; }
.trial-stage__note { position: relative; display: block; margin-top: 10px; font: 400 12px/18px var(--font-v5); color: var(--v5-ink-3); text-align: center; }
.trial-stage__reason { position: relative; display: block; margin: calc(-1 * var(--v5-space-1)) 0 var(--v5-space-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); text-align: right; }
.trial-stage__actions { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 52px; margin-top: 6px; }
.trial-stage__group { display: flex; gap: 8px; margin-left: auto; }
/* 44px hit area; the visible glass pill stays a compact 32px. */
.trial-stage__pill { display: inline-flex; align-items: center; min-height: 44px; cursor: pointer; }
.trial-stage__pill-face { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 32px; padding: 0 12px; border-radius: 999px; font: 500 13px/18px var(--font-v5); white-space: nowrap; }
.trial-stage__pill--brand .trial-stage__pill-face { --ui-button-fill: color-mix(in srgb, var(--v5-brand) 14%, transparent); --ui-button-ink: var(--v5-brand); --ui-button-solid: color-mix(in srgb, var(--v5-brand) 12%, var(--v5-surface)); }
.trial-stage__pill[aria-disabled="true"] { opacity: .5; }
.trial-stage__pill:active .trial-stage__pill-face { transform: scale(.97); }
[role="button"]:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; border-radius: 999px; }
@keyframes trial-stage-in { from { opacity: 0; transform: translateY(6px); } }
@media (prefers-reduced-motion: reduce) { .trial-stage { animation: none; } .trial-stage__pill:active .trial-stage__pill-face { transform: none; } }
</style>
