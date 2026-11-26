<template>
  <view v-if="sheet.open" class="tcs-root" role="dialog" aria-modal="true" :aria-label="activated ? copy.activationSuccessTitle : copy.activateTitle">
    <view class="tcs-backdrop" @click="hide" />
    <view class="nx-glass-sheet tcs-panel" @click.stop>
      <!-- The shared sheet close (as NxSheet): neutral glass M, round (03 §3.1 圆形关闭, 全站玻璃控件边缘). The wrapper only places it. -->
      <view class="tcs-close"><NxButton :label="t.trial.sheetCloseAria" size="medium" round @click="hide"><NxIcon name="close" :size="18" /></NxButton></view>

      <!-- Content scrolls under a pinned footer when it outgrows the screen, so the actions never leave it (03 §3.5 长内容). -->
      <view class="tcs-body" :class="{ 'tcs-body--alone': readFailView }">
        <!-- Nothing to show at all: the result alone, recovering on its own (03 §3.5.2, 04.5); only the close stays. -->
        <view v-if="readFailView" class="tcs-read-state" role="status">
          <view class="tcs-read-state__icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg></view>
          <text class="tcs-read-state__title">{{ copy.pageUnavailable }}</text>
          <text class="tcs-read-state__hint">{{ copy.autoRetrying }}</text>
        </view>
        <template v-else>
          <!-- Result head (03 §3.6.1, shared NxResultHead in its sheet size): 56px success circle, the overview-role title as a
               heading, one body line. No toast speaks while the sheet is open, so the head announces its appearance once. -->
          <view v-if="activated" class="tcs-result"><NxResultHead tone="success" size="sheet" announce :title="copy.activationSuccessTitle" :description="copy.activationSuccessBody" /></view>
          <!-- What is claimed: field name, device name, trial length (01 §1.1.1 字段名; 03 §3.8 NxTag). The same block stays after activation. -->
          <view class="tcs-head" :class="{ 'tcs-head--sub': activated }">
            <text class="tcs-eyebrow">{{ copy.productLabel }}</text>
            <text class="tcs-name"><text v-if="trialView.deviceName.value !== null">{{ trialView.deviceName.value }}</text><text v-else-if="loadingView" class="tcs-skel tcs-skel--name" aria-hidden="true" /><text v-else>—</text></text>
            <view class="tcs-tag-row"><text v-if="loadingView" class="tcs-skel tcs-skel--tag" aria-hidden="true" /><NxTag v-else tone="brand" :label="durationText" /></view>
          </view>
          <!-- The machine stands on the plinth (04 §4.1 底座图 1.5×; 01 §1.1.2 页面效果: grid, floor light). -->
          <view class="tcs-stage" :class="{ 'tcs-stage--sub': activated }">
            <view class="tcs-machine">
              <view v-if="!imageReady" class="tcs-machine__disc" aria-hidden="true" />
              <CatalogMachineImage class="tcs-machine__art" :sku="trialView.productId.value" :image-url="trialView.imageUrl.value" scope-key="trial-claim" @ready="imageReady = $event" />
            </view>
            <view class="tcs-plinth" :class="{ 'tcs-plinth--loading': loadingView }">
              <view class="tcs-plinth__grid" aria-hidden="true" /><view class="tcs-plinth__fade" aria-hidden="true" /><view class="tcs-plinth__floor" aria-hidden="true" />
              <template v-if="activated">
                <text class="tcs-plinth__label">{{ copy.remainingLabel }}</text>
                <text class="tcs-remaining font-mono-tabular">{{ remainingText }}</text>
              </template>
              <template v-else>
                <text class="tcs-plinth__label">{{ copy.estimateLabel }}</text>
                <view class="tcs-amount-row"><text v-if="estimateParts" class="tcs-amount"><text class="tcs-amount__cur">$</text>{{ estimateParts.int }}<text class="tcs-amount__dec">{{ estimateParts.dec }}</text></text><text v-else-if="loadingView" class="tcs-skel tcs-skel--amount" aria-hidden="true" /><text v-else class="tcs-amount tcs-amount--unknown">—</text></view>
                <text id="tcs-basis" class="tcs-estimate-note"><text v-for="(part, i) in estimateNoteParts" :key="i" :class="{ 'tcs-estimate-note__num': part.value }">{{ part.text }}</text></text>
              </template>
            </view>
          </view>
        </template>
      </view>

      <view v-if="!readFailView" class="tcs-foot">
        <!-- The line is a sheet status or hint line (10 §10.2): a result still being confirmed or a stale read is a status line
             (16px status icon, body ink); a refusal is a hint line (16px warning icon, primary ink). It sits above the one
             primary, which it describes when that is off (03 §3.1 禁用要有原因). -->
        <view v-if="reasonLine" id="tcs-reason" class="tcs-line" :class="lineIsStatus ? 'tcs-line--status' : 'tcs-line--hint'" role="alert">
          <svg v-if="lineIsStatus" class="tcs-line__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          <svg v-else class="tcs-line__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
          <text class="tcs-line__t">{{ retryHeld ? heldReasonText : claimErrorText }}</text>
        </view>
        <view class="tcs-ctas">
          <!-- Leaving for another page carries the 20px → (03 §3.1 箭头, L 图标 20); in-place actions do not. -->
          <template v-if="activated">
            <NxButton variant="primary" :label="copy.viewDevices" @click="goDevices"><text>{{ copy.viewDevices }}</text><NxIcon name="arrow-right" :size="20" /></NxButton>
            <NxButton variant="secondary" :label="fleetCopy.buy" @click="goTrial"><text>{{ fleetCopy.buy }}</text><NxIcon name="arrow-right" :size="20" /></NxButton>
          </template>
          <!-- One submit entry at a time: retrying the claim is this sheet's own primary (03 §3.1 例外: the retried action is
               the main one and already sits at the bottom), and a claim being sent or confirmed keeps its spinner here. -->
          <NxButton v-else variant="primary" :label="primaryLabel" :busy="primaryBusy" :busy-label="copy.activating" :disabled="claimDisabled" :aria-describedby="claimDisabled ? reasonLine ? 'tcs-reason' : loadingView ? 'tcs-basis' : undefined : undefined" @click="onClaim"><text>{{ primaryLabel }}</text><NxIcon v-if="primaryLeaves" name="arrow-right" :size="20" /></NxButton>
          <view class="tcs-dismiss" role="button" tabindex="0" :aria-label="dismissLabel" @click.stop="hide" @keydown.enter.stop.prevent="hide" @keydown.space.stop.prevent="hide"><text class="tcs-dismiss-t">{{ dismissLabel }}</text></view>
        </view>
      </view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import CatalogMachineImage from "@/components/catalog-machine-image.vue";
import NxButton from "@/components/ui/nx-button.vue";
import NxIcon from "@/components/ui/nx-icon.vue";
import NxResultHead from "@/components/ui/nx-result-head.vue";
import NxTag from "@/components/ui/nx-tag.vue";
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
// First read with nothing to show yet: the sheet keeps its shape with skeletons (03 §3.4 初始加载). A known-unknown value stays 「—」.
const loadingView = computed(() => trialView.config.value === null && !stateReadFailed.value);
// The machine's placeholder disc shows until the catalog image is in (04 §4.1 中性占位).
const imageReady = ref(false);
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
const shownReason = computed<TrialStartFailure | undefined>(() => !claimErrorReason.value
  || claimErrorReason.value === "rejected" || claimErrorReason.value === "terms-changed"
  ? standingReason.value ?? claimErrorReason.value : claimErrorReason.value);
const claimOpensAnotherPage = computed(() => ["capacity-full", "converted", "in-progress", "used",
  "terms-required", "onboarding-required"].includes(shownReason.value ?? ""));
// The service refused for now (quota, campaign, risk, product): the reason stays, with nothing to retry.
const claimDenied = computed(() => isTrialStartDenied(shownReason.value));
const termsChanged = computed(() => shownReason.value === "terms-changed");
// An explicitly unreceived start has a saved retry but no pending receipt to poll.
const startNotRun = computed(() => freeTrial.pendingStart ? freeTrial.startRetryable
  : freeTrial.startNotSeen && !shownReason.value);
const claimRetryable = computed(() => !termsChanged.value && (startNotRun.value || (!freeTrial.pendingStart
  && claimError.value && shownReason.value === claimErrorReason.value && !claimOpensAnotherPage.value && !claimDenied.value)));
const claimDisabled = computed(() => claiming.value || claimDenied.value || (freeTrial.pendingStart
  ? !freeTrial.canStart() : !claimOpensAnotherPage.value && (!trialView.actionsReady.value || !freeTrial.canStart())));
// View state only: a retry runs from the same bottom primary with its busy spinner (03 §3.1 处理中锁定宽度、加载指示), and the
// reason it answers stays up above it until the claim settles.
const claimFromRetry = ref(false);
const heldReasonText = ref("");
const heldStatusLine = ref(false);
const retryHeld = computed(() => claiming.value && claimFromRetry.value);
// The line's icon and ink follow the text it shows, so a held reason keeps its own kind while the retry runs.
const lineIsStatus = computed(() => retryHeld.value ? heldStatusLine.value : !!freeTrial.pendingStart && !startNotRun.value || staleRead.value);
const showRetry = computed(() => claiming.value ? claimFromRetry.value : claimRetryable.value);
// A refresh that failed over the shown data holds the claim: that is why 「免费激活」 is off, said as a status line beside it
// while recovery reads again on its own (03 §3.1 禁用要有原因, §3.5.2).
const staleRead = computed(() => freeTrial.transientReadFailure && trialView.displayReady.value && !freeTrial.pendingStart
  && !activated.value && !claiming.value && !claimError.value && !standingReason.value);
// The service is ready but cannot say whether this account may claim, with no submit error to explain it: the existing
// unknown-eligibility hint stands above the off primary, so it is never grey without a reason (03 §3.4 无权限／不可用).
const eligibilityUnknown = computed(() => !activated.value && !claiming.value && !freeTrial.pendingStart && !claimError.value && !staleRead.value
  && freeTrial.authorityStatus === "ready" && !freeTrial.canStart() && freeTrial.eligibility().reason === "unknown");
const reasonLine = computed(() => !!freeTrial.pendingStart || startNotRun.value || claimError.value || retryHeld.value || !!standingReason.value || staleRead.value
  || eligibilityUnknown.value);
// Only a failed read with nothing to show leaves the result block alone; a reason or status line keeps its state (A09 order).
const readFailView = computed(() => !reasonLine.value && !activated.value && !claiming.value && stateReadFailed.value);
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
// View state only: the one primary is the retry when the claim can be sent again (A06), busy while it is sent and while a
// start the service took is still being confirmed (A07), so no greyed 「免费激活」 stands beside the status line.
const confirmingStart = computed(() => !!freeTrial.pendingStart && !startNotRun.value);
const primaryBusy = computed(() => claiming.value || confirmingStart.value);
const primaryLabel = computed(() => showRetry.value ? t.value.trial.claimRetryCta : claimCtaLabel.value);
const primaryLeaves = computed(() => !showRetry.value && claimOpensAnotherPage.value);
const claimErrorText = computed(() => termsChanged.value && !confirmingStart.value ? sheet.failureText("terms-changed")
  : startNotRun.value ? t.value.trial.claimNotStartedInline
  : freeTrial.pendingStart ? t.value.trial.claimUnknownInline
  : staleRead.value ? t.value.exchange.staleSnapshot
  : eligibilityUnknown.value ? t.value.trial.eligReasonUnknown
  : shownReason.value === "onboarding-required" ? t.value.trial.claimOnboardingRequired
  : shownReason.value === "terms-required" ? t.value.trial.claimTermsRequired
  // In place, beside 「重新领取」, the refusal drops its "try again" half; the toast after closing keeps the whole line.
  : shownReason.value === "rejected" ? copy.value.claimRejectedInline
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
  const config = trialView.config.value;
  if (!config) return;
  const confirmedTerms = {
    trialProductId: config.trialProductId,
    trialTermsVersion: config.trialTermsVersion,
    deviceName: trialView.deviceName.value,
    trialDays: config.trialDays,
    shadowDailyUSD: config.shadowDailyUSD,
    trialOffsetCapUSD: config.trialOffsetCapUSD,
  };
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
  const r = await freeTrial.start(confirmedTerms);
  if (requestedSequence !== claimSequence) return;
  claiming.value = false;
  if (requestedEpoch !== app.accountBindingEpoch) return;
  if (!sheet.open) return;
  if (!r.ok) {
    if (r.reason === "read-failed" || r.reason === "confirming") return;
    claimErrorReason.value = r.reason;
    claimError.value = true;
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
/* The shared sheet material (03 §3.5 弹层边缘与贴底): 28px top corners, one top highlight. A column: the body scrolls, the
   footer with the line and the actions stays pinned at the bottom (03 §3.5 长内容不把主动作挤出屏幕). */
.tcs-panel { position:absolute;left:0;right:0;bottom:0;z-index:800;box-sizing:border-box;display:flex;flex-direction:column;max-height:calc(100% - var(--nx-overlay-top));overflow:hidden;border-radius:var(--nx-glass-radius) var(--nx-glass-radius) 0 0;box-shadow:var(--nx-glass-edge);background:var(--nx-glass-fill);border:none;animation:tcs-slide-up .36s cubic-bezier(.16,1,.3,1); }
@keyframes tcs-fade { from { opacity:0; } to { opacity:1; } }
@keyframes tcs-slide-up { from { transform:translateY(100%); } to { transform:translateY(0); } }
.tcs-close { position:absolute;right:16px;top:16px;z-index:3; }
/* The 1.5x machine art reaches past the sheet's sides; its margins are transparent, so the body clips them. */
.tcs-body { flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;padding:20px 16px 0; }
.tcs-body--alone { padding-bottom:var(--nx-overlay-bottom); }
.tcs-foot { flex:none;padding:0 16px var(--nx-overlay-bottom); }

/* Places the result head after activation: 4px under the sheet top, clear of the close (44px each side). */
.tcs-result { padding:4px 44px 0; }

/* What is claimed, centred, clear of the close (52px each side). */
.tcs-head { padding:0 52px;text-align:center; }
.tcs-head--sub { margin-top:16px; }
.tcs-eyebrow { display:block;font:var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5);color:var(--v5-ink-3); }
/* Sheet title role for the device name (03 §3.9, 10 §10.1); a long name wraps in full (03 §3.6.1 长名称). */
.tcs-name { display:block;min-height:var(--ui-type-hero-title-lh);margin-top:4px;font:var(--ui-type-hero-title-weight) var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5);letter-spacing:-.01em;color:var(--v5-ink);overflow-wrap:break-word; }
/* Under the result head the device name is a card title (03 §3.9), so two 20px titles do not compete. */
.tcs-head--sub .tcs-name { min-height:var(--ui-type-card-title-lh);font:var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5);letter-spacing:0; }
.tcs-name:lang(zh) { letter-spacing:0; }
.tcs-tag-row { display:flex;justify-content:center;margin-top:8px; }
.tcs-skel { display:inline-block;vertical-align:middle;border-radius:8px;background:color-mix(in srgb,var(--v5-ink) 9%,transparent); }
.tcs-skel--name { width:148px;height:20px; }
.tcs-skel--tag { width:104px;height:24px;border-radius:999px; }
.tcs-skel--amount { width:104px;height:32px; }

/* Stage: the machine stands on the plinth's upper edge. */
.tcs-stage { position:relative;--tcs-mach:248px;margin-top:-34px; }
.tcs-stage--sub { --tcs-mach:200px;margin-top:-28px; }
.tcs-machine { position:relative;z-index:2;width:var(--tcs-mach);height:var(--tcs-mach);margin:0 auto;pointer-events:none; }
/* Pedestal art keeps about 40% transparent margin, so it draws at 1.5x its slot (04 §4.1, as home-benefits). */
.tcs-machine__art { position:absolute;left:-25%;top:-25%;width:150%;height:150%; }
/* Neutral stand-in while the image is not in: a soft body over a disc (the board's placeholder), no outline. */
.tcs-machine__art :deep(.catalog-machine-image__placeholder) { inset:30% 32.7% 39.3%;border:none;border-radius:16px;background:color-mix(in srgb,var(--v5-ink) 7%,transparent); }
.tcs-machine__art :deep(.catalog-machine-image__placeholder svg), .tcs-machine__art :deep(.catalog-machine-image__placeholder .nx-native-svg) { width:40px;height:40px; }
.tcs-machine__disc { position:absolute;left:4%;right:4%;top:70%;height:20%;border-radius:50%;background:color-mix(in srgb,var(--v5-ink) 7%,transparent); }
/* The plinth: the trial sheet's brand-tinted solid (01 §1.1.2 纯色 · 试用领取弹层的展台), a faint brand grid fading out around
   the text, and a cyan floor light under the machine (01 §1.1.2 页面效果). No outline. */
.tcs-plinth { --tcs-pl:color-mix(in srgb,var(--v5-brand) 6%,var(--v5-surface-2));position:relative;z-index:1;margin-top:calc(var(--tcs-mach) * -.42);padding:calc(var(--tcs-mach) * .33 + 12px) 16px 20px;border-radius:24px;background:var(--tcs-pl);overflow:hidden;text-align:center; }
[data-theme="light"] .tcs-plinth { --tcs-pl:var(--v5-brand-soft); }
.tcs-plinth__grid { position:absolute;inset:0;pointer-events:none;opacity:.07;background-image:linear-gradient(var(--v5-brand) 1px,transparent 1px),linear-gradient(90deg,var(--v5-brand) 1px,transparent 1px);background-size:16px 16px;background-position:center -1px; }
.tcs-plinth__fade { position:absolute;inset:0;pointer-events:none;background:radial-gradient(75% 70% at 50% 18%,transparent 0%,var(--tcs-pl) 78%); }
.tcs-plinth__floor { position:absolute;left:50%;top:calc(var(--tcs-mach) * .23);width:300px;height:104px;transform:translate(-50%,-50%);pointer-events:none;background:radial-gradient(closest-side,color-mix(in srgb,var(--v5-tech-cyan) 30%,transparent),color-mix(in srgb,var(--v5-tech-cyan) 10%,transparent) 55%,transparent); }
[data-theme="light"] .tcs-plinth__floor { background:radial-gradient(closest-side,color-mix(in srgb,var(--v5-tech-cyan) 40%,transparent),color-mix(in srgb,var(--v5-tech-cyan) 14%,transparent) 55%,transparent); }
.tcs-plinth--loading .tcs-plinth__floor { display:none; }
.tcs-plinth > :not(.tcs-plinth__grid):not(.tcs-plinth__fade):not(.tcs-plinth__floor) { position:relative; }
/* Field names on the plinth: auxiliary ink, 400 (01 §1.1.1 字段名), 4px above the figure (01 §1.3). */
.tcs-plinth__label { display:block;font:var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5);color:var(--v5-ink-3);overflow-wrap:break-word; }
/* One amount-sized line: the skeleton sits on its middle like the figure would (board .amt). */
.tcs-amount-row { display:block;height:var(--ui-type-wallet-amount-lh);margin-top:4px;font:500 var(--ui-type-wallet-amount)/var(--ui-type-wallet-amount-lh) var(--font-amount); }
/* Sheet main amount (10 §10.2): the wallet-amount size, Montserrat 500, $ and decimals auxiliary; the key figure in brand (01 §1.1.1 规则 4). */
.tcs-amount { display:block;font:500 var(--ui-type-wallet-amount)/var(--ui-type-wallet-amount-lh) var(--font-amount);letter-spacing:-.02em;color:var(--v5-brand);font-variant-numeric:tabular-nums;white-space:nowrap; }
/* line-height 1: the smaller symbol sits inside the figure's line instead of growing it. */
.tcs-amount__cur { color:var(--v5-ink-3);font-size:max(12px,.55em);line-height:1; }
.tcs-amount__dec { color:var(--v5-ink-3); }
.tcs-amount--unknown { color:var(--v5-ink-3); }
/* Basis line under the amount: auxiliary figure 12/16, its figures 500 (10 §10.2). */
.tcs-estimate-note { display:block;min-height:var(--ui-type-meta-lh);margin-top:4px;font:var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);color:var(--v5-ink-3);overflow-wrap:break-word; }
.tcs-estimate-note__num { font-weight:500;font-variant-numeric:tabular-nums; }
/* Trial countdown: JetBrains Mono (.font-mono-tabular) in the metric role, 500, the plinth's one brand figure (01 §1.2, 10 §10.1). */
.tcs-remaining { display:block;margin-top:4px;font-size:var(--ui-type-metric-value);line-height:var(--ui-type-metric-value-lh);font-weight:var(--ui-type-metric-value-weight);color:var(--v5-brand);white-space:nowrap; }

/* Sheet status / hint line (10 §10.2): description role 13/20, a 16px icon on the first line, no box. */
.tcs-line { display:flex;align-items:flex-start;gap:8px;margin-top:16px;font:var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.tcs-line__icon { flex:none;width:16px;height:16px;margin-top:calc((var(--ui-type-description-lh) - 16px) / 2); }
.tcs-line__t { display:block;flex:1 1 auto;min-width:0;overflow-wrap:break-word; }
.tcs-line--status { color:var(--v5-ink-2); }
.tcs-line--status .tcs-line__icon { color:var(--v5-ink-3); }
.tcs-line--hint { color:var(--v5-ink); }
.tcs-line--hint .tcs-line__icon { color:var(--v5-warning-ink); }
/* Nothing readable: the receipt sheet's result block (03 §3.5.2, 04.5), centred, 56px warning circle 14%, no button. */
.tcs-read-state { display:flex;flex-direction:column;align-items:center;padding:64px 24px 48px;text-align:center; }
.tcs-read-state__icon { display:grid;place-items:center;width:56px;height:56px;border-radius:50%;color:var(--v5-warning-ink);background:color-mix(in srgb,var(--v5-warning-ink) 14%,transparent); }
.tcs-read-state__title { display:block;margin-top:12px;color:var(--v5-ink);font:var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5);overflow-wrap:break-word; }
.tcs-read-state__hint { display:block;margin-top:4px;color:var(--v5-ink-3);font:var(--ui-type-empty-note-weight) var(--ui-type-empty-note)/var(--ui-type-empty-note-lh) var(--font-v5);overflow-wrap:break-word; }
.tcs-ctas { margin-top:16px;display:flex;flex-direction:column;gap:8px; }
.tcs-dismiss { width:100%;min-height:44px;display:flex;align-items:center;justify-content:center; }
.tcs-dismiss:active { opacity:.7; }
.tcs-dismiss-t { font:var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5);color:var(--v5-brand);text-align:center;white-space:nowrap; }
.tcs-dismiss:focus-visible { outline:2px solid var(--v5-brand);outline-offset:3px; }
/* Entrance (07 §7.1): once, transform and opacity only. */
.tcs-machine { animation:tcs-rise .6s .12s cubic-bezier(.16,1,.3,1) both; }
.tcs-plinth__floor { animation:tcs-floor .6s .2s ease-out both; }
@keyframes tcs-rise { from { opacity:0;transform:translateY(12px); } to { opacity:1;transform:none; } }
@keyframes tcs-floor { from { opacity:0; } to { opacity:1; } }
@media(prefers-reduced-motion:reduce) { .tcs-panel,.tcs-backdrop,.tcs-machine,.tcs-plinth__floor { animation:none; } }
</style>
