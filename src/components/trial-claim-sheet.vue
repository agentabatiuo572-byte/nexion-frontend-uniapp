<template>
  <view v-if="sheet.open" class="tcs-root" role="dialog" aria-modal="true" :aria-label="activated ? copy.activationSuccessTitle : copy.activateTitle">
    <view class="tcs-backdrop" @click="hide" />
    <view class="nx-glass-sheet tcs-panel" @click.stop>
      <view v-if="activated" class="tcs-head">
        <view class="tcs-head-l">
          <view class="tcs-spark-box" :class="{ 'tcs-spark-box--success': activated }" aria-hidden="true">
            <svg v-if="activated" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6" /></svg>
          </view>
          <view class="tcs-head-meta">
            <text class="tcs-title">{{ copy.activationSuccessTitle }}</text>
          </view>
        </view>
      </view>
      <!-- The shared sheet close (as NxSheet): neutral glass M, round (03 §3.1 圆形关闭, 全站玻璃控件边缘). The wrapper only places it. -->
      <view class="tcs-close"><NxButton :label="t.trial.sheetCloseAria" size="medium" round @click="hide"><NxIcon name="close" :size="18" /></NxButton></view>

      <view class="tcs-device" :class="{ 'tcs-device--sub': activated }">
        <CatalogMachineImage class="tcs-device-art" :sku="trialView.productId.value" :image-url="trialView.imageUrl.value" scope-key="trial-claim" />
        <view class="tcs-device-meta"><text class="tcs-device-caption">{{ copy.productLabel }}</text><text class="tcs-device-name">{{ trialView.deviceName.value ?? '—' }}</text><text class="tcs-device-duration">{{ durationText }}</text></view>
      </view>

      <view v-if="activated" class="tcs-success" role="status" aria-live="polite">
        <text class="tcs-success-body">{{ copy.activationSuccessBody }}</text>
        <view class="tcs-success-time"><text>{{ copy.remainingLabel }}</text><text class="font-mono-tabular">{{ remainingText }}</text></view>
      </view>
      <template v-else>
        <view class="tcs-hero">
          <view aria-hidden="true" class="tcs-hero-grid" />
          <view class="tcs-hero-row"><text class="tcs-hero-label">{{ copy.estimateLabel }}</text></view>
          <view class="tcs-hero-num-row"><text v-if="estimateParts" class="tcs-hero-num"><text class="tcs-hero-num__cur">$</text>{{ estimateParts.int }}<text class="tcs-hero-num__dec">{{ estimateParts.dec }}</text></text><text v-else class="tcs-hero-num tcs-hero-num--unknown">—</text></view>
          <text class="tcs-estimate-note"><text v-for="(part, i) in estimateNoteParts" :key="i" :class="{ 'tcs-estimate-note__num': part.value }">{{ part.text }}</text></text>
        </view>
      </template>

      <!-- Retrying the user's own claim is a text button beside the reason (03 §3.1, 3.5.2), not a second full-width primary.
           The line itself is a sheet status or hint line (10 §10.2): a result still being confirmed is a status line (16px status
           icon, body ink); a refusal is a hint line (16px warning icon, primary ink). -->
      <view v-if="reasonLine" id="tcs-reason" class="tcs-error" :class="lineIsStatus ? 'tcs-error--status' : 'tcs-error--hint'" role="alert">
        <svg v-if="lineIsStatus" class="tcs-error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        <svg v-else class="tcs-error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
        <text class="tcs-error-t">{{ retryHeld ? heldReasonText : claimErrorText }}</text><NxButton v-if="showRetry" class="tcs-retry" variant="text" size="small" :label="t.trial.claimRetryCta" :busy="claiming" :busy-label="copy.activating" :disabled="claimDisabled" @click="onClaim" /></view>
      <!-- A failed read recovers on its own (03 §3.5.2, 04.5): warning icon, the result and the retry line, no button. -->
      <view v-else-if="!activated && !claiming && stateReadFailed" class="tcs-read-state" role="status">
        <view class="tcs-read-state__icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg></view>
        <text class="tcs-read-state__title">{{ copy.pageUnavailable }}</text>
        <text class="tcs-read-state__hint">{{ copy.autoRetrying }}</text>
      </view>

      <view class="tcs-ctas">
        <template v-if="activated">
          <NxButton variant="primary" :label="copy.viewDevices" @click="goDevices" />
          <NxButton variant="secondary" :label="fleetCopy.buy" @click="goTrial" />
        </template>
        <NxButton v-else-if="!showRetry" variant="primary" :label="claimCtaLabel" :busy="claiming" :busy-label="copy.activating" :disabled="claimDisabled" :aria-describedby="claimDisabled && reasonLine ? 'tcs-reason' : undefined" @click="onClaim" />
        <view class="tcs-dismiss" role="button" tabindex="0" :aria-label="dismissLabel" @click.stop="hide" @keydown.enter.stop.prevent="hide" @keydown.space.stop.prevent="hide"><text class="tcs-dismiss-t">{{ dismissLabel }}</text></view>
      </view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import CatalogMachineImage from "@/components/catalog-machine-image.vue";
import NxButton from "@/components/ui/nx-button.vue";
import NxIcon from "@/components/ui/nx-icon.vue";
import { remoteApiEnabled } from "@/api/runtime";
import { formatAmount } from "@/lib/amount-display";
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { navTo } from "@/lib/route";
import { useApp } from "@/store/app";
import { useTrialClaimSheet } from "@/store/trial-claim-sheet";
import { isTrialStartDenied, useFreeTrial, type TrialStartFailure } from "@/store/free-trial";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useDialogA11y } from "@/composables/use-dialog-a11y";
import { useTrialPresentation } from '@/composables/use-trial-presentation';
import { useTrialLifecycleCopy, formatTrialRemaining } from '@/i18n/trial-lifecycle';
import { useTrialFleetCopy } from '@/i18n/trial-fleet';

const sheet = useTrialClaimSheet();
const freeTrial = useFreeTrial();
const trialView = useTrialPresentation(() => sheet.open, { retainOnReadFailure: true });
const app = useApp();
const t = useT();
const copy = useTrialLifecycleCopy();
const fleetCopy = useTrialFleetCopy();

// The result stays up while recovery re-reads, so a retry does not blink it away.
const stateReadFailed = trialView.readFailedWithoutData;
const durationText = computed(() => trialView.config.value ? fmt(copy.value.durationDays, { days: trialView.config.value.trialDays }) : '—');
// Sheet main amount (10 §10.2): the whole part stays, the $ and the decimals take the auxiliary ink; unknown is a whole 「—」.
const estimateParts = computed(() => {
  if (trialView.estimatedOffsetUSD.value === null) return null;
  const [int, dec] = formatAmount(trialView.estimatedOffsetUSD.value).split('.');
  return { int, dec: dec === undefined ? '' : `.${dec}` };
});
// An empty offset cap means no cap: drop the "up to" clause instead of printing "$-".
// The estimate card holds catalog information only (03 §3.4); a failed refresh is said on the status line by the button.
// The basis line under the amount sets its figures in 500 (10 §10.2), so the sentence is split around its placeholders;
// a "$" written right before a placeholder belongs to the figure.
const estimateNoteParts = computed<{ text: string; value: boolean }[]>(() => {
  const config = trialView.config.value;
  if (!config) return stateReadFailed.value ? [] : [{ text: copy.value.loading, value: false }];
  if (config.shadowDailyUSD === null) return [];
  const values: Record<string, string> = { rate: formatAmount(config.shadowDailyUSD), days: String(config.trialDays), cap: formatAmount(config.trialOffsetCapUSD) };
  return (config.trialOffsetCapUSD === null ? copy.value.estimateNoteNoCap : copy.value.estimateNote).split(/(\$?\{\w+\})/).filter(Boolean).map((part) => {
    const match = /^(\$?)\{(\w+)\}$/.exec(part);
    return match && match[2] in values ? { text: match[1] + values[match[2]], value: true } : { text: part, value: false };
  });
});
const remainingText = computed(() => trialView.remainingMs.value === null ? '—' : formatTrialRemaining(trialView.remainingMs.value, copy.value.longRemaining));

// Claim submission — loading guard against double taps (异常3; the store's
// start() is idempotent underneath, this just keeps the UI honest) + inline
// error with retry (spec ⑤: failure is never silent).
const claiming = ref(false);
const { activated } = storeToRefs(sheet);
const claimError = ref(false);
const claimErrorReason = ref<TrialStartFailure>();
// View state only: the service's settled answer while the claim cannot go ahead. A refusal that a re-read did not lift, and the
// current ineligibility when the sheet is reopened, show their reason and exit instead of a retry or a primary that cannot run
// (03 §3.1 禁用要有原因, §3.4 无权限／不可用).
const standingReason = computed<TrialStartFailure | undefined>(() => {
  if (activated.value || claiming.value || freeTrial.pendingStart || freeTrial.authorityStatus !== "ready" || freeTrial.canStart()) return undefined;
  const reason = freeTrial.eligibility().reason;
  return reason === "unknown" ? undefined : reason;
});
const shownReason = computed<TrialStartFailure | undefined>(() => !claimErrorReason.value || claimErrorReason.value === "rejected"
  ? standingReason.value ?? claimErrorReason.value : claimErrorReason.value);
const claimOpensAnotherPage = computed(() => ["capacity-full", "converted", "in-progress", "used",
  "terms-required", "onboarding-required"].includes(shownReason.value ?? ""));
// The service refused for now (quota, campaign, risk, product): the reason stays, with nothing to retry.
const claimDenied = computed(() => isTrialStartDenied(shownReason.value));
const claimRetryable = computed(() => freeTrial.pendingStart ? freeTrial.startRetryable
  : claimError.value && shownReason.value === claimErrorReason.value && !claimOpensAnotherPage.value && !claimDenied.value);
const claimDisabled = computed(() => claiming.value || claimDenied.value || (freeTrial.pendingStart
  ? !freeTrial.canStart() : !claimOpensAnotherPage.value && (!trialView.actionsReady.value || !freeTrial.canStart())));
// View state only: the control that sent the claim stays in place with the busy spinner (03 §3.1 处理中锁定宽度、加载指示),
// so a retry does not swap to the full-width primary, and the reason it sat beside stays up until the claim settles.
const claimFromRetry = ref(false);
const heldReasonText = ref("");
const heldStatusLine = ref(false);
const retryHeld = computed(() => claiming.value && claimFromRetry.value);
// A start found not to have run offers 重新领取, so its line says it did not start (a hint), not that it is confirming (03 §3.5.2).
const startNotRun = computed(() => !!freeTrial.pendingStart && freeTrial.startRetryable);
// The line's icon and ink follow the text it shows, so a held reason keeps its own kind while the retry runs.
const lineIsStatus = computed(() => retryHeld.value ? heldStatusLine.value : !!freeTrial.pendingStart && !startNotRun.value || staleRead.value);
const showRetry = computed(() => claiming.value ? claimFromRetry.value : claimRetryable.value);
// A refresh that failed over the shown data holds the claim: that is why 「免费激活」 is off, said as a status line beside it
// while recovery reads again on its own (03 §3.1 禁用要有原因, §3.5.2).
const staleRead = computed(() => freeTrial.transientReadFailure && trialView.displayReady.value && !freeTrial.pendingStart
  && !activated.value && !claiming.value && !claimError.value && !standingReason.value);
const reasonLine = computed(() => !!freeTrial.pendingStart || claimError.value || retryHeld.value || !!standingReason.value || staleRead.value);
// Nothing left to decide once the claim is refused for now: the exit closes the sheet instead of 「我再想想」.
const dismissLabel = computed(() => activated.value || claimDenied.value ? copy.value.close : t.value.trial.sheetDismissCta);
useAutoRecovery({
  active: () => sheet.open && !claiming.value,
  failed: () => remoteApiEnabled && !freeTrial.authorityResultUnknown && freeTrial.authorityStatus !== "loading"
    && (freeTrial.authorityStatus === "error" || freeTrial.authorityIncomplete),
  retry: () => freeTrial.refreshRemote(),
  repeatMs: 30_000,
});
let claimSequence = 0;
const claimCtaLabel = computed(() => claiming.value ? copy.value.activating
  : shownReason.value === 'capacity-full' ? copy.value.manageDevices
  : shownReason.value === 'converted' ? copy.value.viewDevices
  : shownReason.value === 'in-progress' ? copy.value.viewTrial
  : shownReason.value === 'used' ? copy.value.buyDevice
  : shownReason.value === "onboarding-required" ? t.value.trial.claimOnboardingCta
  : shownReason.value === "terms-required" ? t.value.trial.claimTermsCta
  : copy.value.activateCta);
const claimErrorText = computed(() => freeTrial.pendingStart ? startNotRun.value ? t.value.trial.claimNotStartedInline : t.value.trial.claimUnknownInline
  : staleRead.value ? t.value.exchange.staleSnapshot
  : shownReason.value === "onboarding-required" ? t.value.trial.claimOnboardingRequired
  : shownReason.value === "terms-required" ? t.value.trial.claimTermsRequired
  : sheet.failureText(shownReason.value));

function hide() {
  claimError.value = false;
  claimErrorReason.value = undefined;
  sheet.hide();
}
function goDevices() { hide(); navTo('/pages/me/devices'); }
function goTrial() { hide(); navTo('/pages/me/trial'); }
async function onClaim() {
  if (claimDisabled.value || !sheet.open || activated.value) return;
  if (shownReason.value === 'capacity-full' || shownReason.value === 'converted') { goDevices(); return; }
  if (shownReason.value === 'in-progress' || shownReason.value === 'used') { goTrial(); return; }
  if (shownReason.value === "terms-required") { hide(); navTo("/pages/onboarding/terms"); return; }
  if (shownReason.value === "onboarding-required") {
    hide();
    // #ifdef H5
    navTo("/pages/register/success?setup=1");
    // #endif
    // #ifndef H5
    navTo("/pages/onboarding/estimator");
    // #endif
    return;
  }
  const requestedEpoch = app.accountBindingEpoch;
  const requestedSequence = ++claimSequence;
  claimFromRetry.value = claimRetryable.value;
  heldReasonText.value = claimErrorText.value;
  heldStatusLine.value = lineIsStatus.value;
  claiming.value = true;
  claimError.value = false;
  claimErrorReason.value = undefined;
  // Remote start first refreshes GET /api/trial/eligibility, then posts the
  // idempotent command and performs an authoritative readback.
  const r = await freeTrial.start();
  if (requestedSequence !== claimSequence) return;
  claiming.value = false;
  if (requestedEpoch !== app.accountBindingEpoch) return;
  if (!sheet.open) return;
  if (!r.ok) {
    if (r.reason === "read-failed" || r.reason === "confirming") return;
    claimErrorReason.value = r.reason;
    claimError.value = true; // inline error + retry CTA, stay in the sheet
    return;
  }
  claimError.value = false;
  claimErrorReason.value = undefined;
  if (!remoteApiEnabled) activated.value = true; // Local claims have no server claim number.
}

watch(() => freeTrial.confirmedStartDenial, reason => {
  if (!sheet.open || !reason) return;
  claimErrorReason.value = reason;
  claimError.value = true;
});
watch(() => app.accountBindingEpoch, () => {
  claimSequence++;
  claiming.value = false;
  activated.value = false;
  claimError.value = false;
  claimErrorReason.value = undefined;
  sheet.closeTransient();
}, { flush: 'sync' });
watch(() => sheet.open, open => {
  if (!open) return;
  claimError.value = false;
  claimErrorReason.value = undefined;
  activated.value = !claiming.value && !freeTrial.pendingStart && trialView.displayReady.value && trialView.active.value;
});
// 遮罩只拦指针不拦键盘:不接这一层,弹层打开后 Tab 会直接走到背景(那里有花钱的按钮),
// 且没有 Esc、关掉后焦点也回不到触发它的控件。
useDialogA11y(computed(() => sheet.open), ".tcs-root", hide);


</script>

<style scoped>
.tcs-root { position:fixed;inset:0;z-index:790; }
.tcs-backdrop { position:absolute;inset:0;background:var(--v5-bg-color-mask);backdrop-filter:blur(8px) saturate(150%);-webkit-backdrop-filter:blur(8px) saturate(150%);animation:tcs-fade .24s ease-out; }
.tcs-panel { position:absolute;left:0;right:0;bottom:0;z-index:800;box-sizing:border-box;max-height:calc(100% - var(--nx-overlay-top));overflow-y:auto;border-radius:var(--nx-glass-radius) var(--nx-glass-radius) 0 0;box-shadow:var(--nx-glass-edge);background:var(--nx-glass-fill);border:none;padding:20px 16px var(--nx-overlay-bottom);animation:tcs-slide-up .36s cubic-bezier(.16,1,.3,1); }
@keyframes tcs-fade { from { opacity:0; } to { opacity:1; } }
@keyframes tcs-slide-up { from { transform:translateY(100%); } to { transform:translateY(0); } }
.tcs-head { display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding-right:56px;margin-bottom:16px; }
.tcs-head-l { display:flex;align-items:center;gap:10px;min-width:0; }
.tcs-spark-box { width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex-shrink:0;background:color-mix(in srgb,var(--v5-brand) 14%,transparent); }
.tcs-spark-box--success { box-shadow:0 0 24px color-mix(in srgb,var(--v5-brand) 14%,transparent);animation:tcs-success .4s ease-out; }
@keyframes tcs-success { from { transform:scale(.8);opacity:.4; } to { transform:scale(1);opacity:1; } }
.tcs-head-meta { display:flex;flex-direction:column;min-width:0; }
/* Sheet title and the device name it opens on: the overview-title role (03 §3.9 弹层标题, 10 §10.1). */
.tcs-title { font:var(--ui-type-hero-title-weight) var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5);letter-spacing:-.01em;color:var(--v5-ink);overflow-wrap:break-word; }
.tcs-close { position:absolute;right:16px;top:16px;z-index:1; }
.tcs-device { display:flex;align-items:center;gap:12px;padding:8px 0 12px;border-bottom:1px solid var(--v5-border); }
.tcs-device-art { width:200px;height:200px;flex:none; }
.tcs-device-meta { min-width:0;display:flex;flex-direction:column;gap:5px; }
.tcs-device-caption { font:var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5);color:var(--v5-ink-3); }
.tcs-device-name { font:var(--ui-type-hero-title-weight) var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5);letter-spacing:-.01em;color:var(--v5-ink);overflow-wrap:break-word; }
.tcs-title:lang(zh),.tcs-device-name:lang(zh) { letter-spacing:0; }
/* Once activated the sheet has its own title above, so the device name is a card title under it (03 §3.9). */
.tcs-device--sub .tcs-device-name { font:var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5);letter-spacing:0; }
.tcs-device-duration { font:500 var(--ui-type-list-subtitle)/1.5 var(--font-v5);color:var(--v5-brand);overflow-wrap:break-word; }
.tcs-hero { margin-top:16px;border-radius:16px;padding:16px;position:relative;overflow:hidden;background:color-mix(in srgb,var(--v5-brand) 6%,var(--v5-surface-2));border:none; }
.tcs-hero-grid { position:absolute;inset:0;pointer-events:none;opacity:.04;background-image:linear-gradient(var(--v5-brand) 1px,transparent 1px),linear-gradient(90deg,var(--v5-brand) 1px,transparent 1px);background-size:16px 16px; }
.tcs-hero-row,.tcs-hero-num-row { position:relative; }
/* The amount's field name: auxiliary ink, 400 (01 §1.1.1 字段名), 4px above the figure (01 §1.3). */
.tcs-hero-label { font:var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5);color:var(--v5-ink-3);overflow-wrap:break-word; }
.tcs-hero-num-row { margin-top:4px; }
/* Sheet main amount (10 §10.2): the wallet-amount size, Montserrat 500 (not the role's 550), $ and decimals auxiliary. */
.tcs-hero-num { display:block;font:500 var(--ui-type-wallet-amount)/var(--ui-type-wallet-amount-lh) var(--font-amount);letter-spacing:-.02em;color:var(--v5-brand);font-variant-numeric:tabular-nums;white-space:nowrap; }
/* line-height 1: the smaller symbol sits inside the figure's line instead of growing it. */
.tcs-hero-num__cur { color:var(--v5-ink-3);font-size:max(12px,.55em);line-height:1; }
.tcs-hero-num__dec { color:var(--v5-ink-3); }
.tcs-hero-num--unknown { color:var(--v5-ink-3); }
/* Basis line under the amount: auxiliary figure 12/16, its figures 500 (10 §10.2). */
.tcs-estimate-note { display:block;position:relative;margin-top:8px;font:var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);color:var(--v5-ink-3);overflow-wrap:break-word; }
.tcs-estimate-note__num { font-weight:500;font-variant-numeric:tabular-nums; }
.tcs-success { margin-top:16px;padding:16px;border-radius:16px;background:color-mix(in srgb,var(--v5-brand) 7%,var(--v5-surface-2));border:1px solid color-mix(in srgb,var(--v5-brand) 25%,transparent); }
.tcs-success-body { display:block;font:400 var(--ui-type-list-subtitle)/1.65 var(--font-v5);color:var(--v5-ink-2); }
.tcs-success-time { display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 12px;margin-top:14px;font:400 12px/1.5 var(--font-v5);color:var(--v5-ink-3); }
.tcs-success-time > text:last-child { font-size:22px;font-weight:500;color:var(--v5-brand); }
/* Sheet status / hint line (10 §10.2): description role 13/20, a 16px icon on the first line, no box. */
.tcs-error { display:flex;flex-wrap:wrap;align-items:flex-start;gap:4px 8px;margin-top:16px;font:var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.tcs-error-icon { flex:none;width:16px;height:16px;margin-top:calc((var(--ui-type-description-lh) - 16px) / 2); }
.tcs-error-t { display:block;flex:1 1 12em;min-width:0;overflow-wrap:break-word; }
.tcs-error--status { color:var(--v5-ink-2); }
.tcs-error--status .tcs-error-icon { color:var(--v5-ink-3); }
.tcs-error--hint { color:var(--v5-ink); }
.tcs-error--hint .tcs-error-icon { color:var(--v5-warning-ink); }
/* Read failure in the sheet: the receipt sheet's result block (03 §3.5.2, 04.5), centred, no button. */
.tcs-read-state { display:flex;flex-direction:column;align-items:center;padding:20px 24px 0;text-align:center; }
.tcs-read-state__icon { display:grid;place-items:center;width:56px;height:56px;border-radius:50%;color:var(--v5-warning-ink);background:var(--v5-warning-soft); }
.tcs-read-state__title { display:block;margin-top:12px;color:var(--v5-ink);font:var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5);overflow-wrap:break-word; }
.tcs-read-state__hint { display:block;margin-top:4px;color:var(--v5-ink-3);font:400 13px/18px var(--font-v5);overflow-wrap:break-word; }
.tcs-retry { margin-left:auto;align-self:flex-end;flex-shrink:0; }
.tcs-ctas { margin-top:20px;display:flex;flex-direction:column;gap:8px; }
.tcs-dismiss { width:100%;min-height:44px;display:flex;align-items:center;justify-content:center; }
.tcs-dismiss:active { opacity:.7; }
.tcs-dismiss-t { font:var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5);color:var(--v5-brand);text-align:center; }
.tcs-dismiss:focus-visible { outline:2px solid var(--v5-brand);outline-offset:3px; }
@media(max-width:350px) { .tcs-device-art { width:160px;height:160px; } }
@media(prefers-reduced-motion:reduce) { .tcs-panel,.tcs-backdrop,.tcs-spark-box--success { animation:none; } }
</style>
