<template>
  <view v-if="presentation.active.value" class="trial-device-row" data-trial-device-row="true" data-device-key="trial:current">
    <view class="trial-device-row__heading">
      <view class="trial-device-row__icon" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01M6 18h.01M10 6h8M10 18h8"/></svg></view>
      <view class="trial-device-row__identity"><view class="trial-device-row__name-line"><text class="trial-device-row__name">{{ presentation.deviceName.value || '—' }}</text><text class="trial-device-row__badge">{{ copy.badge }}</text></view><text class="trial-device-row__state">{{ presentation.status.value === 'grace' ? copy.grace : copy.active }}</text></view>
    </view>
    <view class="trial-device-row__time"><text>{{ presentation.status.value === 'grace' ? copy.creditRemaining : copy.remaining }}</text><text class="font-mono-tabular">{{ presentation.remainingMs.value === null ? '—' : formatTrialRemaining(presentation.remainingMs.value, copy.longRemaining) }}</text></view>
    <view class="trial-device-row__credit"><text>{{ copy.availableCredit }}</text><text class="trial-device-row__amount font-mono-tabular">{{ money(presentation.offsetUSD.value) }}</text></view>
    <view class="trial-device-row__progress" role="progressbar" :aria-label="copy.availableCredit" :aria-valuenow="presentation.offsetProgress.value === null ? undefined : Math.round(presentation.offsetProgress.value * 100)" aria-valuemin="0" aria-valuemax="100"><view :style="{ width: `${(presentation.offsetProgress.value ?? 0) * 100}%` }" /></view>
    <view class="trial-device-row__estimate"><text>{{ copy.estimate }}</text><text class="font-mono-tabular">{{ money(presentation.estimatedOffsetUSD.value) }}</text></view>
    <text class="trial-device-row__note">{{ copy.creditNote }}</text>
    <view v-if="!presentation.actionsReady.value" class="trial-device-row__notice" role="status"><text>{{ presentation.presentationReady.value ? copy.loading : copy.unknown }}</text><view v-if="!presentation.presentationReady.value" class="trial-device-row__retry" role="button" tabindex="0" @click="presentation.refresh"><text>{{ copy.retry }}</text></view></view>
    <view class="trial-device-row__actions">
      <view class="trial-device-row__details" role="button" tabindex="0" @click="goDetails"><text>{{ copy.details }}</text></view>
      <view class="trial-device-row__buy" role="button" :tabindex="presentation.actionsReady.value ? 0 : -1" :aria-disabled="!presentation.actionsReady.value" @click="goBuy"><text>{{ presentation.status.value === 'grace' ? copy.buy : copy.buyEarly }}</text><text aria-hidden="true">→</text></view>
    </view>
    <view v-if="showCancel && presentation.status.value === 'active'" class="trial-device-row__cancel" role="button" :tabindex="presentation.actionsReady.value && !cancelBusy ? 0 : -1" :aria-disabled="!presentation.actionsReady.value || cancelBusy" @click="requestCancel"><text>{{ cancelBusy ? copy.cancelBusy : copy.cancel }}</text></view>
  </view>
</template>

<script setup lang="ts">
import { useTrialPresentation } from "@/composables/use-trial-presentation";
import { useTrialFleetCopy } from "@/i18n/trial-fleet";
import { formatTrialRemaining } from "@/i18n/trial-lifecycle";
import { formatAmount } from "@/lib/amount-display";
import { navTo } from "@/lib/route";

const props = defineProps<{ showCancel?: boolean; cancelBusy?: boolean }>();
const emit = defineEmits<{ (event: "cancel"): void }>();
const presentation = useTrialPresentation();
const copy = useTrialFleetCopy();
function money(value: number | null) { return value === null ? "—" : `$${formatAmount(value)}`; }
function goDetails() { navTo("/pages/me/trial"); }
function goBuy() { if (presentation.actionsReady.value) goDetails(); }
function requestCancel() { if (presentation.actionsReady.value && !props.cancelBusy) emit("cancel"); }
</script>

<style scoped>
.trial-device-row { padding:16px; background:var(--v5-surface); color:var(--v5-ink); min-width:0; }
.trial-device-row__heading { display:flex; align-items:center; gap:12px; }
.trial-device-row__icon { display:grid; place-items:center; width:48px; height:48px; flex-shrink:0; border-radius:14px; background:var(--v5-brand-soft); color:var(--v5-brand); }
.trial-device-row__identity { min-width:0; flex:1; }
.trial-device-row__name-line { display:flex; flex-wrap:wrap; align-items:center; gap:6px; }
.trial-device-row__name { font:600 15px/21px var(--font-v5); overflow-wrap:anywhere; }
.trial-device-row__badge { padding:2px 7px; border-radius:var(--v5-radius-full); background:var(--v5-brand-soft); color:var(--v5-brand); font:500 11px/17px var(--font-v5); }
.trial-device-row__state { display:block; margin-top:3px; color:var(--v5-ink-3); font:400 12px/18px var(--font-v5); overflow-wrap:anywhere; }
.trial-device-row__time,.trial-device-row__credit,.trial-device-row__estimate { display:flex; flex-wrap:wrap; align-items:baseline; justify-content:space-between; gap:5px 12px; margin-top:12px; font:400 12px/18px var(--font-v5); color:var(--v5-ink-3); }
.trial-device-row__time > text:last-child { color:var(--v5-ink); }
.trial-device-row__amount { color:var(--v5-brand); font-size:20px; line-height:26px; font-weight:600; }
.trial-device-row__progress { height:5px; margin-top:8px; overflow:hidden; border-radius:var(--v5-radius-full); background:var(--v5-surface-3); }
.trial-device-row__progress > view { height:100%; border-radius:inherit; background:var(--v5-brand); }
.trial-device-row__estimate { margin-top:6px; }
.trial-device-row__note { display:block; margin-top:8px; font:400 11px/17px var(--font-v5); color:var(--v5-ink-3); }
.trial-device-row__notice { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:6px; margin-top:8px; color:var(--v5-warning-ink); font:400 12px/18px var(--font-v5); }
.trial-device-row__retry { display:flex; align-items:center; min-height:44px; padding:0 8px; color:var(--v5-brand); }
.trial-device-row__actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
.trial-device-row__actions > view { display:flex; flex:1 1 110px; align-items:center; justify-content:center; min-height:44px; box-sizing:border-box; padding:10px 12px; border-radius:var(--v5-radius-full); font:500 13px/18px var(--font-v5); text-align:center; }
.trial-device-row__details { border:1px solid var(--v5-border); color:var(--v5-ink-2); }
.trial-device-row__buy { gap:8px; background:var(--v5-brand-soft); color:var(--v5-brand); }
.trial-device-row__buy[aria-disabled="true"],.trial-device-row__cancel[aria-disabled="true"] { opacity:.5; }
.trial-device-row__cancel { display:flex; align-items:center; justify-content:center; min-height:44px; margin-top:8px; border-top:1px solid var(--v5-border); color:var(--v5-ink-3); font:400 12px/18px var(--font-v5); }
[role="button"] { cursor:pointer; }
[role="button"]:focus-visible { outline:2px solid var(--v5-brand); outline-offset:2px; }
</style>
