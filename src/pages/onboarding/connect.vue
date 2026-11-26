<template>
  <StandalonePageShell class="cn-root" :top-inset="24">
    <!-- #ifdef APP-PLUS -->
    <NativeGpuObserver :request="gpuRequest" @observation="gpuReader.receive" />
    <!-- #endif -->
    <!-- Progress (3/3 full) -->
    <view class="cn-bars">
      <view class="cn-back active:opacity-60" role="button" :tabindex="activationBusy || phase === 'calibrating' ? -1 : 0" :aria-disabled="activationBusy || phase === 'calibrating'" :aria-label="t.login.back" @click="leaveConnect" @keydown.enter.prevent="leaveConnect" @keydown.space.prevent="leaveConnect">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </view>
      <view class="cn-bar"><view class="cn-bar__fill cn-bar__fill--full" /></view>
      <view class="cn-bar"><view class="cn-bar__fill cn-bar__fill--full" /></view>
      <view class="cn-bar"><view class="cn-bar__fill cn-bar__fill--full" /></view>
    </view>

    <view>
      <text class="cn-step">{{ stepText }}</text>
      <text class="cn-title">{{ nativePhoneAvailable ? titleText : phoneActivationGuidance.title }}</text>
      <text v-if="!nativePhoneAvailable || (phase !== 'result' && phase !== 'error')" class="cn-sub">{{ nativePhoneAvailable ? subText : phoneActivationGuidance.body }}</text>
    </view>

    <view v-if="nativePhoneAvailable" class="cn-main">
      <!-- Phase: intro -->
      <view v-if="phase === 'intro'" key="intro" class="cn-phase">
        <view class="cn-why">
          <text class="cn-why__h">{{ t.onboarding.calibrationWhyTitle }}</text>
          <view class="cn-why__list">
            <view v-for="(p, i) in whyPoints" :key="i" class="cn-point">
              <view class="cn-point__ic">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" :stroke="p.color" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="p.icon" /></svg>
              </view>
              <text class="cn-point__t">{{ p.text }}</text>
            </view>
          </view>
        </view>
        <view class="cn-go cn-go--glow active:scale-[0.98]" role="button" tabindex="0" data-system-chrome-primary @click="phase = 'calibrating'" @keydown.enter.prevent="phase = 'calibrating'" @keydown.space.prevent="phase = 'calibrating'">
          <text class="cn-go__t">{{ t.onboarding.calibrationStart }}</text>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </view>
      </view>

      <!-- Phase: calibrating -->
      <view v-else-if="phase === 'calibrating' && iosPhone" key="calibrating-ios" class="cn-phase">
        <view class="cn-steps nx-glass-card" role="list">
          <view v-for="step in iosSteps" :key="step.label" class="cn-steps__row" role="listitem">
            <text class="cn-steps__label" :class="{ 'cn-steps__label--idle': !step.running }">{{ step.label }}</text>
            <text class="cn-steps__state" :class="{ 'cn-steps__state--running': step.running }">{{ step.state }}</text>
          </view>
        </view>
      </view>
      <view v-else-if="phase === 'calibrating'" key="calibrating" class="cn-phase">
        <view class="cn-prog-row">
          <svg class="cn-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          <text class="cn-prog-row__t">{{ t.onboarding.detecting }}</text>
        </view>

      </view>

      <!-- Phase: result: the server score is the only public calibration figure. -->
      <view v-else-if="phase === 'result' && iosPhone" key="result-ios" class="cn-phase anim-up">
        <view class="cn-ios-card nx-glass-card nx-glass-hero" role="group" :aria-label="`${t.onboarding.iosComputeEstimate} ${finalScore} ${t.onboarding.phoneComputeUnit}`">
          <text class="cn-ios-card__k">{{ t.onboarding.iosComputeEstimate }}</text>
          <view class="cn-ios-card__value">
            <text class="cn-ios-card__v">{{ shownScore }}</text>
            <text class="cn-ios-card__u">{{ t.onboarding.phoneComputeUnit }}<template v-if="canonical?.tierName"> · {{ canonical.tierName }}</template></text>
          </view>
        </view>
      </view>
      <!-- Calibration dial: tick ring, four arcs and the inner ring in brand colour only. The inner ring and the number keep
           their size; on a short screen only the outer dial moves in (down to dialGeo.min), then the page scrolls. -->
      <view v-else-if="phase === 'result'" key="result" class="cn-phase cn-phase--dial" :style="{ minHeight: dialGeo.min + 'px' }">
        <view class="cn-dial" :class="{ 'cn-dial--ready': dialReady }" role="img" :aria-label="`${t.onboarding.resultTitle} ${finalScore} ${t.onboarding.phoneComputeUnit}`"
          :style="{ width: dialSize + 'px', height: dialSize + 'px' }">
          <view class="cn-dial__glow" aria-hidden="true" />
          <view class="cn-dial__lens" aria-hidden="true" :style="{ width: dialGeo.inner * 2 + 'px', height: dialGeo.inner * 2 + 'px' }" />
          <view class="cn-dial__ticks" aria-hidden="true"><svg width="100%" height="100%" :viewBox="`0 0 ${dialSize} ${dialSize}`" focusable="false">
            <line v-for="(tick, i) in dialFace.ticks" :key="i" :class="tick.major ? 'cn-dial__major' : 'cn-dial__minor'" :x1="tick.x1" :y1="tick.y1" :x2="tick.x2" :y2="tick.y2" />
          </svg></view>
          <view class="cn-dial__ring" aria-hidden="true"><svg width="100%" height="100%" :viewBox="`0 0 ${dialSize} ${dialSize}`" focusable="false">
            <path v-for="(arc, i) in dialFace.arcs" :key="i" class="cn-dial__arc" :d="arc" />
            <line v-for="(mark, i) in dialFace.marks" :key="'m' + i" class="cn-dial__arc" :x1="mark.x1" :y1="mark.y1" :x2="mark.x2" :y2="mark.y2" />
            <circle class="cn-dial__inner" :cx="dialSize / 2" :cy="dialSize / 2" :r="dialGeo.inner" />
          </svg></view>
          <!-- The count is shown while it runs; under reduced motion the final value shows at once (also in the App, where
               the count runs on a timer). The dial's name carries the one value screen readers hear. -->
          <view class="cn-dial__num" aria-hidden="true">
            <view class="cn-dial__value" :style="{ fontSize: dialNumberSize + 'px' }">
              <text class="cn-dial__v cn-dial__v--count">{{ shownScore }}</text>
              <text class="cn-dial__v cn-dial__v--final">{{ finalScore }}</text>
            </view>
            <text class="cn-dial__unit" :style="{ fontSize: dialUnitSize + 'px', lineHeight: dialGeo.unitLh + 'px' }">{{ t.onboarding.phoneComputeUnit }}</text>
          </view>
        </view>
      </view>

      <!-- An iPhone waiting for verification: where to go next, never which model or rule was involved. -->
      <view v-else-if="iosPending" key="error-ios" class="cn-phase anim-up">
        <text class="cn-ios-body">{{ t.onboarding.phoneCalibrationPendingIosBody }}</text>
        <view class="cn-ios-card nx-glass-card">
          <text class="cn-ios-card__k">{{ t.onboarding.iosPendingHint }}</text>
        </view>
      </view>
      <!-- A failed calibration is a real terminal state until the user retries. -->
      <view v-else key="error" class="cn-phase anim-up">
        <view class="cn-policy">
          <view class="cn-policy__cap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
            <text class="cn-policy__cap-t">{{ failureTitle }}</text>
          </view>
          <text class="cn-policy__t">{{ failureDetail }}</text>
          <text v-if="canDefer" class="cn-policy__t cn-policy__t--spaced">{{ t.onboarding.activationDeferredHint }}</text>
          <text v-if="activationOutcome !== 'active'" class="cn-policy__t cn-policy__t--spaced">{{ t.onboarding.activationRewardGate }}</text>
        </view>
      </view>
    </view>

    <view v-if="!nativePhoneAvailable" class="cn-cta">
      <view class="cn-go cn-go--on active:scale-[0.98]" role="button" tabindex="0" data-system-chrome-primary @click="leaveConnect" @keydown.enter.prevent="leaveConnect" @keydown.space.prevent="leaveConnect">
        <text class="cn-go__t cn-go__t--on">{{ t.login.back }}</text>
      </view>
    </view>
    <view v-if="nativePhoneAvailable" class="cn-cta">
      <view v-if="phase === 'result'" :class="{ 'cn-error-actions': iosPhone }">
        <!-- Task rules (03 §3.5.1): one row, text and icon are one trigger; the bubble closes on a second tap, a tap outside or a scroll. -->
        <view class="cn-rules">
          <NxHintBubble :label="t.onboarding.policyTitle" :text="policyLines" />
        </view>
        <view class="cn-go cn-go--on active:scale-[0.98]" role="button" :tabindex="activationBusy ? -1 : 0" :aria-disabled="activationBusy" data-system-chrome-primary @click="activate" @keydown.enter.prevent="activate" @keydown.space.prevent="activate">
          <text class="cn-go__t cn-go__t--on" aria-live="polite">{{ activationBusy ? t.onboarding.activationProcessing : activateText }}</text>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </view>
        <view v-if="iosPhone && canDefer" class="cn-go cn-go--secondary active:scale-[0.98]" role="button" :tabindex="activationBusy ? -1 : 0" :aria-disabled="activationBusy" @click="deferPhoneActivation" @keydown.enter.prevent="deferPhoneActivation" @keydown.space.prevent="deferPhoneActivation">
          <text class="cn-go__t cn-go__t--secondary">{{ t.onboarding.iosActivateLater }}</text>
        </view>
      </view>
      <view v-else-if="phase === 'error' && iosPending" class="cn-error-actions">
        <view class="cn-go cn-go--on active:scale-[0.98]" role="button" :tabindex="activationBusy ? -1 : 0" :aria-disabled="activationBusy" data-system-chrome-primary @click="retryCalibration" @keydown.enter.prevent="retryCalibration" @keydown.space.prevent="retryCalibration">
          <text class="cn-go__t cn-go__t--on" aria-live="polite">{{ activationBusy ? t.onboarding.activationProcessing : t.onboarding.iosRecalibrate }}</text>
        </view>
        <view class="cn-go cn-go--secondary active:scale-[0.98]" role="button" :tabindex="activationBusy ? -1 : 0" :aria-disabled="activationBusy" @click="contactSupport" @keydown.enter.prevent="contactSupport" @keydown.space.prevent="contactSupport">
          <text class="cn-go__t cn-go__t--secondary">{{ t.onboarding.iosContactSupport }}</text>
        </view>
        <!-- Onboarding must still be able to continue without a phone. -->
        <view v-if="canDefer" class="cn-link active:opacity-60" role="button" :tabindex="activationBusy ? -1 : 0" :aria-disabled="activationBusy" @click="deferPhoneActivation" @keydown.enter.prevent="deferPhoneActivation" @keydown.space.prevent="deferPhoneActivation">
          <text class="cn-link__t">{{ t.onboarding.activationDefer }}</text>
        </view>
      </view>
      <view v-else-if="phase === 'error'" class="cn-error-actions">
        <view class="cn-go cn-go--on active:scale-[0.98]" role="button" :tabindex="activationBusy ? -1 : 0" :aria-disabled="activationBusy" data-system-chrome-primary @click="retryCalibration" @keydown.enter.prevent="retryCalibration" @keydown.space.prevent="retryCalibration">
          <text class="cn-go__t cn-go__t--on" aria-live="polite">{{ activationBusy ? t.onboarding.activationProcessing : failureActionText }}</text>
        </view>
        <view v-if="failureFeedback?.action === 'devices' && canDefer" class="cn-link active:opacity-60" role="button" :tabindex="activationBusy ? -1 : 0" :aria-disabled="activationBusy" @click="activate" @keydown.enter.prevent="activate" @keydown.space.prevent="activate">
          <text class="cn-link__t">{{ t.onboarding.activationRetry }}</text>
        </view>
        <view v-if="canDefer" class="cn-go cn-go--secondary active:scale-[0.98]" role="button" :tabindex="activationBusy ? -1 : 0" :aria-disabled="activationBusy" @click="deferPhoneActivation" @keydown.enter.prevent="deferPhoneActivation" @keydown.space.prevent="deferPhoneActivation">
          <text class="cn-go__t cn-go__t--secondary" aria-live="polite">{{ activationBusy ? t.onboarding.activationProcessing : t.onboarding.activationDefer }}</text>
        </view>
      </view>
    </view>
    <GlobalUi />
  </StandalonePageShell>
</template>

<script setup lang="ts">
import { navReset, navTo } from "@/lib/route";
import { hasNativeAndroidPhoneRuntime, hasNativePhoneRuntime, nativePhonePlatform } from "@/lib/native-phone-runtime";
import { resolvePhoneActivationGuidance } from "@/lib/phone-activation-guidance";
import { ref, computed, getCurrentInstance, nextTick, onMounted, onUnmounted, watch } from "vue";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { captureRuntimeRevision, isCurrentRuntimeRevision } from "@/api/order-api";
import { onLoad, onBackPress, onShow, onHide } from "@dcloudio/uni-app";
import StandalonePageShell from "@/components/device/standalone-page-shell.vue";
import GlobalUi from "@/components/global-ui.vue";
import NxHintBubble from "@/components/ui/nx-hint-bubble.vue";
import { useDialogBackHeld } from "@/composables/use-dialog-a11y";
import { useT } from "@/i18n/use-t";
import { useAuth } from "@/store/auth";
import { useApp } from "@/store/app";
import { useSession } from "@/store/session";
import { markAuthAccountOnboardingComplete } from "@/store/auth-account";
import { getDeviceId } from "@/lib/device-id";
import { collectDeviceSignals } from "@/lib/device-signals";
// #ifdef APP-PLUS
import NativeGpuObserver from "@/components/native-gpu-observer.vue";
import { createNativeGpuRequest } from "@/lib/native-gpu-request";
const gpuRequest = ref(0);
const gpuReader = createNativeGpuRequest(id => { gpuRequest.value = id; });
onUnmounted(() => gpuReader.dispose());
// #endif
async function collectCalibrationSignals() {
  // #ifdef APP-PLUS
  if (hasNativeAndroidPhoneRuntime()) {
    const observation = await gpuReader.read();
    if (observation.status !== "observed") console.warn("Phone GPU observation unavailable:", observation.status);
    return collectDeviceSignals(observation.renderer);
  }
  // #endif
  return collectDeviceSignals();
}
import { requireCryptoUuid } from "@/lib/secure-command-id";
import { apiRuntimeConfig, onboardingCalibrationApi, remoteApiEnabled } from "@/api/runtime";
import { phoneRecoveryCredential } from "@/lib/phone-recovery-credential";
import type { OnboardingCalibration, PhoneActivationVersions } from "@/api/onboarding-calibration-api";
import { confirm as uiConfirm, toast, useUI } from "@/store/ui";
import { calibrationBelongsTo, createPhoneCalibrationFlow } from "@/lib/phone-calibration-flow";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import type { RemoteAccountRequest } from "@/lib/remote-account-epoch";
import { ApiError } from "@/api/errors";
import { phoneActivationFeedback, confirmedPhoneActivationRejection } from "@/lib/phone-activation-feedback";
import { confirmDeferredPhoneActivation } from "@/lib/defer-phone-activation";
import { isCurrentOnboardingCalibrationScope, type OnboardingCalibrationScope } from "@/lib/onboarding-calibration-scope";

const t = useT();
const auth = useAuth();

// Only explicit remeasurement or a server-confirmed replacement is recalibration.
const isRecal = ref(false);
const isLogin = ref(false);
const loginCheckNeeded = ref(false);
const resumeDeferred = ref(false);

type Phase = "intro" | "calibrating" | "result" | "error";
type FailedAction = "calibration" | "activate" | "defer";
const phase = ref<Phase>("intro");
const shownScore = ref(0);
let scoreTimer: ReturnType<typeof setInterval> | null = null;
const failedAction = ref<FailedAction>("calibration");
const failureCode = ref("");
const activationOutcome = ref<"idle" | "preflight-unconfirmed" | "unconfirmed" | "active">("idle");
const canDefer = computed(() => failedAction.value !== "defer" && activationOutcome.value !== "unconfirmed" && activationOutcome.value !== "active"
  && canonical.value?.activationStatus !== "ACTIVE");

// Every runtime mode receives final facts from the authenticated server. The
// onboarding path intentionally has no local capability fallback, so mock,
// sandbox, and remote cannot turn device observations into business facts.
const canonical = ref<OnboardingCalibration | null>(null);
const finalScore = computed(() => canonical.value?.computeValue ?? 0);

let mounted = true;
const pageVisible = ref(true);
onShow(() => { pageVisible.value = true; });
onHide(() => { pageVisible.value = false; });
let accountEpoch = 0;
let requestGeneration = 0;
function accountKey(): string { return auth.accountId || auth.email || "default"; }
type RequestScope = OnboardingCalibrationScope & { remote: RemoteAccountRequest };
function currentScope(): RequestScope {
  return { accountKey: accountKey(), accountEpoch, generation: requestGeneration, remote: captureAccountScope() };
}
function scopeIsCurrent(scope: RequestScope): boolean {
  return mounted && auth.isAuthenticated && isCurrentAccountScope(scope.remote)
    && isCurrentOnboardingCalibrationScope(scope, currentScope());
}
function acceptCurrentCanonical(scope: RequestScope, result: OnboardingCalibration): boolean {
  return scopeIsCurrent(scope) && calibrationBelongsTo(result, accountKey(), getDeviceId());
}
const authenticatedAccountKey = computed(() => auth.isAuthenticated ? accountKey() : "");
const confirmOwner = `phone-activation-${Date.now()}-${Math.random()}`;
watch(authenticatedAccountKey, (next, previous) => {
  if (next === previous) return;
  // Remote login hydrates the non-secret account routing key after the
  // authenticated page is already mounted. That one-way bootstrap is not an
  // account switch and must not invalidate an in-flight server calibration.
  if ((!previous || previous === "default") && next && next !== "default") return;
  activationBusy.value = false;
  accountEpoch += 1;
  requestGeneration += 1;
  useUI().clearConfirmsBy(confirmOwner);
  calibrationFlow.reset();
  activationIntent = null;
  activationOutcome.value = "idle"; activationCompleted = false;
  canonical.value = null;
  failureCode.value = "";
  if (phase.value !== "intro") phase.value = "error";
  failedAction.value = "calibration";
});

// Copy swaps: recalibrate vs first-time onboarding.
const stepText = computed(() => (isRecal.value ? t.value.onboarding.recalStep : t.value.onboarding.step3of3));
const titleText = computed(() => phase.value === "error" ? failureTitle.value
  : iosPhone && phase.value === "calibrating" ? t.value.onboarding.iosCalibrationTitle
  : iosPhone && phase.value === "result" ? t.value.onboarding.resultTitle
  : loginCheckNeeded.value ? t.value.onboarding.phoneBindingCheckTitle
  : isRecal.value ? t.value.onboarding.recalTitle : t.value.onboarding.calibrationTitle);
const subText = computed(() => iosPhone && phase.value === "calibrating" ? t.value.onboarding.iosIdentifying
  : loginCheckNeeded.value ? t.value.onboarding.phoneBindingCheckBody
  : isRecal.value ? t.value.onboarding.recalSubtitle : t.value.onboarding.calibrationSubtitle);
const activateText = computed(() => (isRecal.value ? t.value.onboarding.recalActivate : t.value.onboarding.activatePhone));
const iosPending = computed(() => canonical.value?.calibrationStatus === "PENDING_VERIFICATION" && canonical.value.signals?.platform === "ios");
const iosSteps = computed(() => [t.value.onboarding.iosStepIdentify, t.value.onboarding.iosStepResult, t.value.onboarding.iosStepActivate]
  .map((label, index) => ({ label, running: index === 0, state: index === 0 ? t.value.onboarding.iosStepRunning : t.value.onboarding.iosStepWaiting })));
function contactSupport() { if (!activationBusy.value) navTo("/pages/support/messages"); }
const failureFeedback = computed(() => phoneActivationFeedback(failureCode.value));
const supportRequired = computed(() => activationOutcome.value === "idle" && failureFeedback.value?.action === "support");
const failureActionText = computed(() => activationOutcome.value === "active" ? t.value.onboarding.phoneActivationSyncAction
  : activationOutcome.value === "unconfirmed" ? t.value.onboarding.activationRetry
  : activationOutcome.value === "preflight-unconfirmed" ? t.value.onboarding.activationRetry
  : failureFeedback.value?.action === "devices" ? t.value.onboarding.phoneActivationManageDevices
  : failureFeedback.value?.action === "login" ? t.value.onboarding.phoneActivationLoginAction
  : failureFeedback.value?.action === "terms" ? t.value.onboarding.phoneActivationTermsAction
  : failureFeedback.value?.action === "recalibrate" ? t.value.onboarding.iosRecalibrate
  : supportRequired.value ? t.value.onboarding.iosContactSupport : t.value.onboarding.activationRetry);
const failureDetail = computed(() => activationOutcome.value === "active" ? t.value.onboarding.phoneActivationSync
  : activationOutcome.value === "unconfirmed" ? t.value.onboarding.phoneActivationUnconfirmed
  : activationOutcome.value === "preflight-unconfirmed" ? t.value.onboarding.phoneActivationEligibilityUnavailable
  : failureFeedback.value ? t.value.onboarding[failureFeedback.value.detail]
  : iosPending.value ? t.value.onboarding.phoneCalibrationPendingIosBody
  : canonical.value?.calibrationStatus === "PENDING_VERIFICATION" ? t.value.onboarding.phoneCalibrationPendingBody
  : loginCheckNeeded.value ? t.value.onboarding.phoneBindingReadUnavailableBody
  : failedAction.value === "defer" ? t.value.onboarding.activationDeferFailed
  : failedAction.value === "calibration" ? t.value.onboarding.calibrationRetry
  : t.value.onboarding.phoneActivationRejected);
const failureTitle = computed(() => activationOutcome.value === "active" ? t.value.onboarding.phoneActivationSyncTitle
  : activationOutcome.value === "unconfirmed" ? t.value.onboarding.phoneActivationUnconfirmedTitle
  : activationOutcome.value === "preflight-unconfirmed" ? t.value.onboarding.phoneActivationEligibilityUnavailableTitle
  : iosPending.value ? t.value.onboarding.phoneCalibrationPendingIosTitle
  : canonical.value?.calibrationStatus === "PENDING_VERIFICATION" ? t.value.onboarding.phoneCalibrationPendingTitle
  : loginCheckNeeded.value ? t.value.onboarding.phoneBindingReadUnavailableTitle
  : failedAction.value === "calibration" ? t.value.onboarding.calibrationFailedTitle
  : failedAction.value === "defer" ? t.value.onboarding.activationDeferFailedTitle
  : t.value.onboarding.activationFailedTitle);

// lucide paths
const ICON = {
  cpu: "M12 20v2M12 2v2M17 20v2M17 2v2M2 12h2M2 17h2M2 7h2M20 12h2M20 17h2M20 7h2M7 20v2M7 2v2",
  cpu2: "M4 4h16v16H4zM9 9h6v6H9z",
};

const whyPoints = computed(() => [
  { icon: ICON.cpu2, color: "var(--v5-brand)", text: t.value.onboarding.calibrationWhyLine1 },
]);

// Initial onboarding reuses the estimator's canonical result. Only an explicit
// warehouse remeasurement/resume can replace an existing calibration.
const calibrationFlow = createPhoneCalibrationFlow({ api: onboardingCalibrationApi,
  collect: collectCalibrationSignals, key: () => `onboarding:${requireCryptoUuid()}` });
const nativePhoneAvailable = hasNativePhoneRuntime();
const iosPhone = nativePhonePlatform() === "ios";
const phoneActivationGuidance = computed(() => resolvePhoneActivationGuidance(nativePhoneAvailable, t.value.myDevices));
let activationIntent: { target: "ACTIVE" | "DEFERRED"; revision: number; idempotencyKey: string; versions?: PhoneActivationVersions; submitted?: boolean } | null = null;
const activationBusy = ref(false);
let activationCompleted = false;

async function startCalibration() {
  if (!nativePhoneAvailable || activationOutcome.value === "unconfirmed" || activationOutcome.value === "active") return;
  activationOutcome.value = "idle";
  failureCode.value = "";
  canonical.value = null;
  activationIntent = null;
  const requestScope = { ...currentScope(), generation: ++requestGeneration };
  try {
    if (loginCheckNeeded.value) {
      const status = await onboardingCalibrationApi.phoneLogin(getDeviceId());
      if (!scopeIsCurrent(requestScope)) return;
      if (status === "BOUND") {
        navReset({ url: "/pages/index/index", fail: () => {} });
        return;
      }
      if (status !== "NEEDS_CALIBRATION" && status !== "REPLACEMENT_REQUIRED") throw new Error(status);
      isRecal.value = status === "REPLACEMENT_REQUIRED";
      loginCheckNeeded.value = false;
      phase.value = "intro";
      return;
    }
    const result = await calibrationFlow.run({ deviceId: getDeviceId(), accountKey: accountKey(),
      isCurrent: () => scopeIsCurrent(requestScope), recalibrate: isRecal.value || resumeDeferred.value });
    if (!acceptCurrentCanonical(requestScope, result)) return;
    canonical.value = result;
    if (result.activationStatus === "DEFERRED") {
      resumeDeferred.value = true;
      phase.value = "intro";
      return;
    }
    if (!result.calibrationAvailable || result.calibrationStatus !== "MATCHED") {
      failedAction.value = "calibration";
      resumeDeferred.value = true;
      phase.value = "error";
      return;
    }
    phase.value = "result";
  } catch (cause) {
    if (!mounted || !isCurrentOnboardingCalibrationScope(requestScope, currentScope())) return;
    failureCode.value = cause instanceof Error ? cause.message : "";
    failedAction.value = "calibration";
    phase.value = "error";
  }
}

// The real API remains authoritative; animation only counts up to its confirmed score.
// Calibration dial geometry (design B1–B8). The 375 and 390 tiers share the 300px dial; the unit uses the body role.
const windowWidth = uni.getSystemInfoSync().windowWidth;
const dialGeo = windowWidth >= 375
  ? { max: 300, inner: 105.9, base: 52, unit: windowWidth >= 390 ? 15 : 14, unitLh: windowWidth >= 390 ? 22 : 21, min: 250 }
  : { max: 272, inner: 96, base: 48, unit: 14, unitLh: 21, min: 229 };
const DIAL_GAP = 6;   // number → unit
const DIAL_CLEAR = 4; // text corners stay this far inside the inner ring
const dialSize = ref(dialGeo.min);
const dialReady = ref(false);
const dialUnitSize = ref(dialGeo.unit);
// The number is sized from the final string (dot included), never the shorter count. JetBrains Mono advances 0.6em, less
// the −0.02em tracking: a string of n characters at size f is 0.58·n·f wide. The block (number at line-height 1, gap, unit
// line) is centred, so its far corner sits at (0.29·n·f, f/2 + (gap + unit line)/2); solving that distance for the inner
// ring less the clearance gives the largest size that stays inside, capped at the tier's 52/48.
const dialNumberSize = computed(() => {
  const n = Math.max(1, String(finalScore.value).length), half = (DIAL_GAP + dialGeo.unitLh) / 2, r = dialGeo.inner - DIAL_CLEAR;
  const a = (0.29 * n) ** 2 + 0.25;
  return Math.min(dialGeo.base, Math.floor((-half + Math.sqrt(half * half - 4 * a * (half * half - r * r))) / (2 * a)));
});
const dialFace = computed(() => {
  const d = dialSize.value, c = d / 2, margin = dialGeo.max * 0.03, rTick = c - margin, gap = rTick - dialGeo.inner;
  const rArc = dialGeo.inner + gap * 0.57, major = Math.min(dialGeo.max * 0.034, gap * 0.3);
  const at = (deg: number, r: number) => [c + Math.sin(deg * Math.PI / 180) * r, c - Math.cos(deg * Math.PI / 180) * r].map(v => +v.toFixed(2));
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const isMajor = i % 6 === 0, [x1, y1] = at(i * 5, rTick), [x2, y2] = at(i * 5, rTick - (isMajor ? major : major / 2));
    return { major: isMajor, x1, y1, x2, y2 };
  });
  const arcs = [0, 1, 2, 3].map(k => {
    const [sx, sy] = at(k * 90 + 14, rArc), [ex, ey] = at(k * 90 + 76, rArc);
    return `M${sx} ${sy} A${rArc.toFixed(2)} ${rArc.toFixed(2)} 0 0 1 ${ex} ${ey}`;
  });
  const marks = [0, 1, 2, 3].map(k => {
    const [x1, y1] = at(k * 90, rArc - gap * 0.3), [x2, y2] = at(k * 90, rArc + gap * 0.16);
    return { x1, y1, x2, y2 };
  });
  return { ticks, arcs, marks };
});
// The phase fills the height between the title and the rules row; the dial takes it, clamped to [min, max]. The unit
// keeps one line where the inner ring's chord at its height allows it, and steps its size down where it does not.
const pageInstance = getCurrentInstance();
function fitDial() {
  if (!pageInstance?.proxy) return;
  const query = uni.createSelectorQuery().in(pageInstance.proxy);
  query.select(".cn-phase--dial").boundingClientRect();
  query.select(".cn-dial__unit").boundingClientRect();
  query.exec((boxes: (UniApp.NodeInfo | null)[]) => {
    if (phase.value !== "result") return;
    const [box, unit] = boxes;
    if (box?.height) dialSize.value = Math.max(dialGeo.min, Math.min(dialGeo.max, Math.floor(box.height)));
    if (unit?.width) {
      const r = dialGeo.inner - DIAL_CLEAR, halfBlock = (dialNumberSize.value + DIAL_GAP + dialGeo.unitLh) / 2;
      const chord = 2 * Math.sqrt(r * r - halfBlock * halfBlock);
      if (unit.width > chord) dialUnitSize.value = Math.floor(dialGeo.unit * chord / unit.width);
    }
    dialReady.value = true;
  });
}
watch(phase, next => {
  dialReady.value = false;
  dialUnitSize.value = dialGeo.unit;
  if (next === "result" && !iosPhone) void nextTick(fitDial);
});
watch([phase, finalScore], ([next, score]) => {
  if (scoreTimer) clearInterval(scoreTimer);
  scoreTimer = null;
  shownScore.value = 0;
  if (next !== "result") return;
  const target = Math.max(0, score);
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    shownScore.value = target;
    return;
  }
  const start = Date.now();
  scoreTimer = setInterval(() => {
    const progress = Math.min(1, (Date.now() - start) / 900);
    shownScore.value = progress === 1 ? target : Math.round(progress * target);
    if (progress === 1 && scoreTimer) { clearInterval(scoreTimer); scoreTimer = null; }
  }, 30);
}, { immediate: true });
const policyLines = computed(() => [
  t.value.onboarding.policyLine1,
  t.value.onboarding.policyLine2,
  t.value.onboarding.policyLine3,
]);

// start calibration when entering that phase
watch(phase, (p) => {
  if (p === "calibrating") startCalibration();
});

async function retryCalibration() {
  await activationRead?.catch(() => {});
  if (!pageVisible.value || activationCompleted) return;
  if (!nativePhoneAvailable || activationBusy.value) return;
  if (activationOutcome.value !== "idle") {
    void activate();
    return;
  }
  if (failureFeedback.value?.action === "devices") { navTo("/pages/me/devices"); return; }
  if (failureFeedback.value?.action === "login") {
    auth.signOut();
    void navReset("/pages/login/login");
    return;
  }
  if (failureFeedback.value?.action === "terms") { navTo("/pages/onboarding/terms"); return; }
  if (supportRequired.value) {
    contactSupport();
    return;
  }
  if (failureFeedback.value?.action === "recalibrate") {
    activationIntent = null;
    calibrationFlow.reset();
    resumeDeferred.value = true;
    phase.value = "calibrating";
    return;
  }
  if (failedAction.value === "activate") {
    if (!canonical.value?.calibrationAvailable) {
      resumeDeferred.value = true;
      phase.value = "intro";
      return;
    }
    void activate();
    return;
  }
  if (failedAction.value === "defer") {
    void deferPhoneActivation();
    return;
  }
  phase.value = "calibrating";
}

function activationCommand(target: "ACTIVE" | "DEFERRED", revision: number) {
  if (!activationIntent || activationIntent.target !== target || activationIntent.revision !== revision) {
    activationIntent = {
      target,
      revision,
      idempotencyKey: `phone-activation:${target.toLowerCase()}:${requireCryptoUuid()}`,
    };
  }
  return activationIntent;
}

function completeOnboardingLocally(): boolean {
  if (isRecal.value) return true;
  if (!auth.completeOnboarding()) return false;
  // The phone account directory is a local mock/cache concern. In remote mode
  // the authenticated backend transition is authoritative and must not be
  // downgraded to a visible activation failure when this optional cache is
  // unavailable (private browsing, storage quota, or native bridge failure).
  if (markAuthAccountOnboardingComplete(auth.email || auth.accountId || "default") || remoteApiEnabled) return true;
  if (!auth.requireOnboarding()) auth.signOut();
  return false;
}

/** Reconcile the original operation before any new eligibility check or write. */
async function readActivationOutcome(idempotencyKey: string, deviceId: string, scope: RequestScope) {
  let rejection = "";
  let pending = false;
  try {
    const receipt = await onboardingCalibrationApi.activationReceipt(idempotencyKey);
    if (!scopeIsCurrent(scope)) return { rejection, pending, result: null };
    if (receipt?.status === "SUCCEEDED" && acceptCurrentCanonical(scope, receipt.result)) {
      return { rejection, pending, result: receipt.result };
    }
    if (receipt?.status === "FAILED") rejection = receipt.reason;
    pending = receipt?.status === "PENDING";
  } catch { /* An unavailable receipt does not settle the original operation. */ }
  if (!scopeIsCurrent(scope)) return { rejection, pending, result: null };
  try {
    const readback = await onboardingCalibrationApi.result(deviceId);
    if (acceptCurrentCanonical(scope, readback) && readback.calibrationAvailable && readback.activationStatus === "ACTIVE") {
      return { rejection, pending, result: readback };
    }
  } catch { /* Keep the original rejection or uncertainty, never this secondary read error. */ }
  return { rejection, pending, result: null };
}

/** Apply only a confirmed activation; shared by explicit submission and GET recovery. */
function acceptActivation(activated: OnboardingCalibration, scope: RequestScope) {
  if (activationCompleted || !acceptCurrentCanonical(scope, activated)) return;
  // Server success survives local persistence errors; retry synchronizes this result without another POST.
  canonical.value = activated;
  activationOutcome.value = "active";
  activationIntent = null;
  if (!useSession().markCalibrated(auth.email || auth.accountId || "default") || !completeOnboardingLocally()) {
    throw new Error("PHONE_ACTIVATION_LOCAL_COMMIT_FAILED");
  }
  const app = useApp();
  app.acceptPhoneActivation();
  void app.refreshRemoteFleet();
  if (isRecal.value) app.resumeMining();
  activationCompleted = true;
  toast.success(t.value.onboarding.phoneActivationConfirmed);
  navReset({ url: "/pages/index/index", fail: () => {} });
}
const readingActivation = ref(false);
let activationRead: Promise<void> | null = null;
function recoverActivation(): Promise<void> {
  if (activationRead) return activationRead;
  const command = activationIntent, before = canonical.value;
  if (!pageVisible.value || activationBusy.value || activationOutcome.value !== "unconfirmed" || !command?.submitted || !before) return Promise.resolve();
  const scope = currentScope(), runtime = captureRuntimeRevision();
  const current = () => pageVisible.value && scopeIsCurrent(scope) && isCurrentRuntimeRevision(runtime) && activationIntent === command;
  readingActivation.value = true;
  const read = Promise.resolve().then(async () => {
    if (!current()) return;
    const outcome = await readActivationOutcome(command.idempotencyKey, before.deviceId, scope);
    if (!current()) return;
    if (outcome.result) {
      try { acceptActivation(outcome.result, scope); }
      catch (cause) {
        failureCode.value = cause instanceof Error ? cause.message : "";
        failedAction.value = "activate"; phase.value = "error";
        toast.error(failureTitle.value, failureDetail.value);
      }
    } else if (outcome.rejection) {
      activationIntent = null; activationOutcome.value = "idle";
      failureCode.value = outcome.rejection; failedAction.value = "activate"; phase.value = "error";
      toast.error(failureTitle.value, failureDetail.value);
    }
  }).finally(() => {
    if (activationRead === read) { activationRead = null; readingActivation.value = false; }
  });
  activationRead = read;
  return read;
}
useAutoRecovery({
  failed: () => pageVisible.value && activationOutcome.value === "unconfirmed" && !!activationIntent?.submitted
    && !activationBusy.value && !readingActivation.value,
  retry: recoverActivation, repeatMs: 15_000,
});
async function activate() {
  await activationRead?.catch(() => {});
  if (!pageVisible.value || activationCompleted) return;
  if (!nativePhoneAvailable || !mounted || !canonical.value?.calibrationAvailable
      || canonical.value.calibrationStatus !== "MATCHED" || activationBusy.value) return;
  activationBusy.value = true;
  const requestScope = { ...currentScope() };
  const before = canonical.value;
  try {
    let activated: OnboardingCalibration | null = before.activationStatus === "ACTIVE" ? before : null;
    if (!activated) {
      if (activationOutcome.value === "idle") activationOutcome.value = "preflight-unconfirmed";
      const command = activationCommand("ACTIVE", before.revision);
      if (command.submitted) {
        const outcome = await readActivationOutcome(command.idempotencyKey, before.deviceId, requestScope);
        if (!scopeIsCurrent(requestScope)) return;
        activated = outcome.result;
        if (!activated && outcome.rejection) {
          activationIntent = null;
          activationOutcome.value = "idle";
          throw new Error(outcome.rejection);
        }
        if (!activated && outcome.pending) throw new Error("PHONE_ACTIVATION_NOT_CONFIRMED");
      }
      if (!activated) {
        if (!command.versions) {
          let eligibility;
          try { eligibility = await onboardingCalibrationApi.activationEligibility(); }
          catch (cause) {
            if (scopeIsCurrent(requestScope) && confirmedPhoneActivationRejection(cause)) activationOutcome.value = "idle";
            throw cause;
          }
          if (!scopeIsCurrent(requestScope)) return;
          if (!eligibility.canActivate) {
            activationOutcome.value = "idle";
            throw new Error(eligibility.blockedReasons[0] || "PHONE_ACTIVATION_UNAVAILABLE");
          }
          const replacing = eligibility.binding !== null && (eligibility.binding.installationId !== before.deviceId
            || failureCode.value === "PHONE_REPLACEMENT_CONFIRMATION_REQUIRED");
          if (replacing) {
            const confirmed = await uiConfirm({ title: t.value.onboarding.replacementConfirmTitle,
              message: t.value.onboarding.replacementConfirmBody, confirmLabel: t.value.onboarding.replacementConfirmAction,
              owner: confirmOwner });
            if (!scopeIsCurrent(requestScope)) return;
            if (!confirmed) { activationOutcome.value = "idle"; return; }
          }
          command.versions = {
            expectedBindingVersion: eligibility.binding?.bindingVersion ?? null,
            expectedPolicyVersion: eligibility.policyVersion,
            replacementConfirmed: replacing,
            ...(eligibility.grantId ? { exceptionGrantId: eligibility.grantId } : {}),
          };
        }
        command.submitted = true;
        activationOutcome.value = "unconfirmed";
        try {
          const credential = phoneRecoveryCredential(apiRuntimeConfig.baseUrl, requestScope.accountKey);
          activated = await onboardingCalibrationApi.activate(before.deviceId, command.revision, command.idempotencyKey,
            command.versions, credential);
          if (!scopeIsCurrent(requestScope)) return;
          if (!acceptCurrentCanonical(requestScope, activated)) {
            throw new ApiError({ kind: "protocol", message: "ONBOARDING_CALIBRATION_SCOPE_INVALID" });
          }
          if (!activated.calibrationAvailable || activated.activationStatus !== "ACTIVE") {
            throw new Error("PHONE_ACTIVATION_NOT_CONFIRMED");
          }
        } catch (cause) {
          if (!scopeIsCurrent(requestScope)) return;
          const outcome = await readActivationOutcome(command.idempotencyKey, before.deviceId, requestScope);
          if (!scopeIsCurrent(requestScope)) return;
          activated = outcome.result;
          if (!activated) {
            if (outcome.rejection || confirmedPhoneActivationRejection(cause)) {
              activationIntent = null;
              activationOutcome.value = "idle";
              if (outcome.rejection && outcome.rejection !== "PHONE_ACTIVATION_FAILED") throw new Error(outcome.rejection);
            }
            throw cause;
          }
        }
      }
    }
    if (!activated || !acceptCurrentCanonical(requestScope, activated)) return;
    acceptActivation(activated, requestScope);
  } catch (cause) {
    if (scopeIsCurrent(requestScope)) {
      failureCode.value = cause instanceof Error ? cause.message : "";
      failedAction.value = "activate";
      phase.value = "error";
    }
  } finally {
    if (isCurrentOnboardingCalibrationScope(requestScope, currentScope())) activationBusy.value = false;
  }
}

async function deferPhoneActivation() {
  await activationRead?.catch(() => {});
  if (!pageVisible.value || activationCompleted) return;
  if (!nativePhoneAvailable || !mounted || activationBusy.value
      || activationOutcome.value === "unconfirmed" || activationOutcome.value === "active") return;
  if (canonical.value?.activationStatus === "ACTIVE") { void navReset("/pages/index/index"); return; }
  activationOutcome.value = "idle";
  activationBusy.value = true;
  const requestScope = { ...currentScope() };
  try {
    if (isLogin.value) {
      // Login can mean replacing an existing phone. "NEEDS_CALIBRATION" alone
      // cannot distinguish that from an account which has never bound one.
      if (loginCheckNeeded.value || isRecal.value || canonical.value?.userDeviceId) {
        void navReset({ url: "/pages/index/index", fail: () => {} });
        return;
      }
      const hasBinding = await onboardingCalibrationApi.bindingStatus();
      if (!scopeIsCurrent(requestScope)) return;
      if (hasBinding) {
        void navReset({ url: "/pages/index/index", fail: () => {} });
        return;
      }
    }
    const current = await confirmDeferredPhoneActivation({
      ...(isLogin.value ? { initialOnly: true } : {}),
      current: canonical.value, deviceId: getDeviceId(),
      command: (revision) => activationCommand("DEFERRED", revision),
      isCurrent: () => scopeIsCurrent(requestScope),
      accept: (result) => acceptCurrentCanonical(requestScope, result),
    });
    if (!scopeIsCurrent(requestScope)) return;
    if (current.activationStatus !== "DEFERRED") throw new Error("PHONE_DEFER_NOT_CONFIRMED");
    canonical.value = current;
    const app = useApp();
    const phone = app.devices.find((device) => device.kind === "phone");
    const localPhoneStateCommitted = (remoteApiEnabled || !phone || app.deactivateDevice(phone.id))
      && useSession().markPhoneActivationDeferred(auth.email || auth.accountId || "default");
    if (!localPhoneStateCommitted && !remoteApiEnabled) {
      throw new Error("PHONE_DEFER_LOCAL_COMMIT_FAILED");
    }
    if (!completeOnboardingLocally()) throw new Error("ONBOARDING_LOCAL_COMMIT_FAILED");
    toast.info(t.value.onboarding.activationDeferredToast);
    navReset({ url: isRecal.value ? "/pages/me/devices" : "/pages/index/index", fail: () => {} });
  } catch (cause) {
    if (scopeIsCurrent(requestScope)) {
      // A conflicting or uncertain write can leave the cached revision stale.
      // The next explicit retry must first read the latest server decision.
      canonical.value = null;
      failureCode.value = cause instanceof Error ? cause.message : "";
      failedAction.value = "defer";
      phase.value = "error";
    }
  } finally {
    if (isCurrentOnboardingCalibrationScope(requestScope, currentScope())) activationBusy.value = false;
  }
}
function leaveConnect() {
  if (activationBusy.value || phase.value === "calibrating") return;
  requestGeneration += 1;
  // #ifdef H5
  navReset({ url: "/pages/index/index", fail: () => {} });
  // #endif
  // #ifndef H5
  navReset({ url: isLogin.value ? "/pages/index/index" : isRecal.value ? "/pages/me/devices" : "/pages/onboarding/estimator", fail: () => {} });
  // #endif
}

onLoad((options) => {
  // #ifdef H5
  navReset({ url: "/pages/register/success?download=1", fail: () => {} });
  return;
  // #endif
  const o = (options || {}) as Record<string, string>;
  isLogin.value = o.mode === "login";
  isRecal.value = o.mode === "recalibrate";
  resumeDeferred.value = o.mode === "resume";
  loginCheckNeeded.value = isLogin.value;
  phase.value = "intro";
});
onMounted(() => {
  if (nativePhoneAvailable && (isLogin.value || (!isRecal.value && !resumeDeferred.value))) phase.value = "calibrating";
});
// A dialog on the page (the replacement confirm) takes this press first (02 §2.7.1).
const dialogHoldsBack = useDialogBackHeld();
onBackPress((event) => { if (!dialogHoldsBack(event)) leaveConnect(); return true; });
onUnmounted(() => {
  mounted = false;
  useUI().clearConfirmsBy(confirmOwner);
  if (scoreTimer) clearInterval(scoreTimer);
  requestGeneration += 1;
});
</script>

<style scoped>
.cn-root {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: 24px 20px;
  background: var(--v5-bg);
  overflow-y: auto;
}
.cn-bars { min-height: 44px; display: flex; align-items: center; gap: 6px; margin-bottom: 20px; }
.cn-back { width: 44px; height: 44px; margin-left: -12px; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; border-radius: 9999px; }
.cn-bar { flex: 1; height: 4px; border-radius: 9999px; background: var(--v5-surface); overflow: hidden; }
.cn-bar__fill { height: 100%; width: 0; background: var(--v5-brand); }
.cn-bar__fill--full { width: 100%; }
.cn-step { display: block; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--v5-brand); }
.cn-title { display: block; font-family: var(--font-v5); margin-top: 4px; font-size: 20px; font-weight: 600; line-height: 1.25; color: var(--v5-ink); }
.cn-sub { display: block; margin-top: 4px; font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-3); }
.cn-phase { margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }

.cn-why { background: var(--v5-surface); border-radius: 16px; padding: 16px; }
.cn-why__h { display: block; font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--v5-brand); }
.cn-why__list { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
.cn-point { display: flex; align-items: flex-start; gap: 10px; }
.cn-point__ic { width: 24px; height: 24px; border-radius: 6px; background: var(--v5-surface-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
.cn-point__t { flex: 1; font-size: var(--ui-type-list-subtitle); line-height: 1.375; color: var(--v5-ink); }

.cn-prog-row { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
.cn-prog-row__t { font-size: 12px; color: var(--v5-ink-3); }
.cn-spin { animation: cn-spin 0.9s linear infinite; }
@keyframes cn-spin { to { transform: rotate(360deg); } }
.cn-test { border-radius: 12px; padding: 12px; background: var(--v5-surface); border: 1px solid var(--v5-border); }
.cn-test__top { display: flex; align-items: center; gap: 10px; }
.cn-test__ic { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cn-test__body { flex: 1; min-width: 0; }
.cn-test__title { display: block; font-size: 13px; font-weight: 600; color: var(--v5-ink); line-height: 1.25; }
.cn-test__metric { display: block; font-family: var(--font-jet-mono), ui-monospace, monospace; font-variant-numeric: tabular-nums; font-size: 12px; color: var(--v5-ink-3); margin-top: 2px; }
.cn-test__track { margin-top: 10px; height: 4px; border-radius: 9999px; background: var(--v5-surface-2); overflow: hidden; }
.cn-test__fill { height: 100%; border-radius: 9999px; transition: width 0.15s linear; }

.cn-score__cap { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--v5-brand); }
.cn-score__cap-t { font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px; letter-spacing: 0.18em; color: var(--v5-brand); }
.cn-score__tier { display: block; margin-top: 8px; font-size: 13px; font-weight: 600; color: var(--v5-ink); }
.cn-score__yield { margin: 12px auto 0; display: inline-flex; align-items: baseline; gap: 8px; padding: 6px 12px; border-radius: 9999px; background: color-mix(in oklab, var(--v5-brand) 14%, transparent); }
.cn-score__yield-cap { font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--v5-brand); }
.cn-score__yield-v { font-family: var(--font-v5); font-variant-numeric: tabular-nums; color: var(--v5-brand); font-size: 15px; font-weight: 600; }

.cn-summary { border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 8px; background: var(--v5-surface); }
.cn-row { display: flex; align-items: center; gap: 10px; font-size: var(--ui-type-list-subtitle); }
.cn-row__check { width: 24px; height: 24px; border-radius: 6px; background: color-mix(in oklab, var(--v5-brand) 14%, transparent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cn-row__label { color: var(--v5-ink-3); }
.cn-row__val { margin-left: auto; font-family: var(--font-jet-mono), ui-monospace, monospace; font-variant-numeric: tabular-nums; color: var(--v5-ink); font-weight: 600; }

.cn-policy { border-radius: 16px; padding: 14px; background: color-mix(in oklab, var(--v5-warning) 8%, transparent); border: 1px solid color-mix(in oklab, var(--v5-warning) 22%, transparent); }
.cn-policy__cap { display: flex; align-items: center; gap: 6px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--v5-warning); }
.cn-policy__cap-t { font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px; letter-spacing: 0.16em; color: var(--v5-warning); }
.cn-policy__list { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.cn-policy__line { display: flex; align-items: flex-start; gap: 6px; }
.cn-policy__dot { flex-shrink: 0; margin-top: 6px; width: 4px; height: 4px; border-radius: 9999px; background: color-mix(in oklab, var(--v5-warning) 55%, transparent); }
.cn-policy__t { flex: 1; font-size: 12px; line-height: 1.375; color: var(--v5-ink-2); }
.cn-policy__t--spaced { display: block; margin-top: 8px; }
/* iPhone calibration: flat content card for steps, glass hero only for the key result. */
.cn-steps { display: flex; flex-direction: column; gap: 14px; padding: 18px; }
.cn-steps__row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.cn-steps__label { font-size: 14px; color: var(--v5-ink); }
.cn-steps__label--idle, .cn-steps__state { color: var(--v5-ink-3); }
.cn-steps__state { flex: none; font-size: 13px; }
.cn-steps__state--running { color: var(--v5-brand); font-weight: 600; }
.cn-ios-body { display: block; margin-bottom: 16px; font-size: var(--ui-type-list-subtitle); line-height: 1.5; color: var(--v5-ink-2); }
.cn-ios-card { display: flex; flex-direction: column; gap: 6px; padding: 18px; }
.cn-ios-card__k { display: block; font-size: 12px; color: var(--v5-ink-3); }
.cn-ios-card__value { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
.cn-ios-card__v { font-family: var(--font-metric); font-variant-numeric: tabular-nums; font-size: 34px; font-weight: 700; color: var(--v5-ink); }
.cn-ios-card__u { font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-2); }
.cn-link { min-height: 44px; display: flex; align-items: center; justify-content: center; }
.cn-link__t { font-size: 13px; color: var(--v5-ink-3); text-decoration: underline; text-underline-offset: 3px; }

.cn-main { flex: 1 0 auto; display: flex; flex-direction: column; }
.cn-cta { margin-top: auto; padding-top: 24px; }
.cn-rules { display: flex; justify-content: center; margin-bottom: 4px; }
.cn-go { width: 100%; height: 48px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--v5-brand); transition: transform 0.15s ease; }
.cn-go--glow { box-shadow: 0 0 24px color-mix(in oklab, var(--v5-brand) 35%, transparent); }
.cn-go__t { font-size: var(--ui-type-button); font-weight: var(--ui-type-button-weight); color: var(--v5-on-brand); }
.cn-go__t--on { font-size: var(--ui-type-body); }
.cn-error-actions { display: flex; flex-direction: column; gap: 10px; }
.cn-go--secondary { background: var(--v5-surface); }
.cn-go__t--secondary { color: var(--v5-ink); }

.anim-up { animation: cn-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes cn-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* Calibration dial (design B1–B8): brand colour only. The phase takes the free height (min = the smallest dial); the dial
   sits in its middle at the size fitDial measured. Dark: a soft brand glow and a lens in the inner ring; light: the lens only. */
.cn-phase--dial { flex: 1 0 0; position: relative; }
.cn-dial { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); visibility: hidden; }
.cn-dial--ready { visibility: visible; }
.cn-dial__glow, .cn-dial__lens, .cn-dial__ticks, .cn-dial__ring, .cn-dial__num { position: absolute; }
.cn-dial__glow { inset: -14%; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-brand) 24%, transparent), color-mix(in srgb, var(--v5-brand) 9%, transparent) 48%, transparent 100%); }
[data-theme="light"] .cn-dial__glow { display: none; }
.cn-dial__lens { left: 50%; top: 50%; transform: translate(-50%, -50%); border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-brand) 9%, transparent), transparent); }
[data-theme="light"] .cn-dial__lens { background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-brand) 6%, transparent), transparent); }
.cn-dial__ticks, .cn-dial__ring { inset: 0; }
.cn-dial__ticks :deep(svg), .cn-dial__ring :deep(svg) { display: block; overflow: visible; }
.cn-dial__major { stroke: var(--v5-brand); stroke-opacity: .6; stroke-width: 1.6; stroke-linecap: round; }
.cn-dial__minor { stroke: var(--v5-ink); stroke-opacity: .18; stroke-width: 1; stroke-linecap: round; }
.cn-dial__arc { fill: none; stroke: var(--v5-brand); stroke-width: 2.4; stroke-linecap: round; }
.cn-dial__inner { fill: none; stroke: var(--v5-brand); stroke-opacity: .22; stroke-width: 1; }
.cn-dial__num { left: 0; right: 0; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; }
.cn-dial__value { display: grid; justify-items: center; }
.cn-dial__v { grid-area: 1 / 1; font-family: var(--font-metric); font-variant-numeric: tabular-nums; font-size: inherit; font-weight: 500; line-height: 1; letter-spacing: -0.02em; color: var(--v5-brand); white-space: nowrap; }
.cn-dial__v--final { visibility: hidden; }
.cn-dial__unit { display: block; max-width: 100%; margin-top: 6px; font-family: var(--font-v5); font-weight: 400; color: var(--v5-ink-3); text-align: center; white-space: nowrap; }
/* Entrance once (07 §7.1.1): ticks turn in, arcs lock, the glow fades in; transform and opacity only, no loop. */
@media (prefers-reduced-motion: no-preference) {
  .cn-dial--ready .cn-dial__glow { animation: cn-fade .6s ease-out both; }
  .cn-dial--ready .cn-dial__ring { animation: cn-lock .9s cubic-bezier(.16, 1, .3, 1) both; }
  .cn-dial--ready .cn-dial__ticks { animation: cn-dial-in 1.1s cubic-bezier(.16, 1, .3, 1) both; }
}
/* Reduced motion: no entrance, and the final value instead of the count. */
@media (prefers-reduced-motion: reduce) {
  .cn-dial__v--count { visibility: hidden; }
  .cn-dial__v--final { visibility: visible; }
}
@keyframes cn-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes cn-lock { from { opacity: 0; transform: scale(1.14); } to { opacity: 1; transform: none; } }
@keyframes cn-dial-in { from { opacity: 0; transform: rotate(-36deg); } to { opacity: 1; transform: none; } }
</style>
