<template>
  <StandalonePageShell class="cn-root" :top-inset="4" :reserve-bottom="false" :style="{ '--cn-scan-delay': scanDelay + 'ms' }">
    <!-- #ifdef APP-PLUS -->
    <NativeGpuObserver :request="gpuRequest" @observation="gpuReader.receive" />
    <!-- #endif -->
    <!-- Standalone (recalibrate / login): sub-page nav only. Guided: back, step track, step label. -->
    <view v-if="standalone" class="ob-nav">
      <view class="ob-back" role="button" :tabindex="backLocked ? -1 : 0" :aria-disabled="backLocked" :aria-label="t.login.back" :class="{ 'ob-back--off': backLocked, 'ob-back--enable': enterFrom === 'scan' }" @click="leave" @keydown.enter.prevent="leave" @keydown.space.prevent="leave">
        <view class="ob-back__face nx-design-glass"><LiquidGlass :radius="20" tone="navigation" :blur="8" /><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></view>
      </view>
      <text class="ob-nav__t" role="heading" aria-level="1">{{ t.onboarding.calibrationTitle }}</text>
      <view />
    </view>
    <template v-else>
      <view class="ob-hd">
        <view class="ob-back" role="button" :tabindex="backLocked ? -1 : 0" :aria-disabled="backLocked" :aria-label="t.login.back" :class="{ 'ob-back--off': backLocked, 'ob-back--enable': enterFrom === 'scan' }" @click="leave" @keydown.enter.prevent="leave" @keydown.space.prevent="leave">
          <view class="ob-back__face nx-design-glass"><LiquidGlass :radius="20" tone="navigation" :blur="8" /><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></view>
        </view>
        <view class="ob-track" role="img" :aria-label="stepLabel">
          <view class="ob-track__seg ob-track__seg--done" />
          <view class="ob-track__seg" :class="isEstimate ? 'ob-track__seg--done' : 'ob-track__seg--cur'" />
          <view class="ob-track__seg" :class="{ 'ob-track__seg--cur': isEstimate }" />
        </view>
      </view>
      <text class="ob-eyebrow" aria-hidden="true">{{ stepLabel }}</text>
      <template v-if="estimateShown">
        <text class="ob-title" role="heading" aria-level="1">{{ t.onboarding.estimatorTitleH }}</text>
        <text class="ob-sub">{{ t.onboarding.estimatorHint }}</text>
      </template>
      <!-- Dial phases share one title cell (both titles laid out, one shown), so the dial below never moves. -->
      <view v-else-if="dialMode" class="ob-title cn-swap" :class="{ 'cn-swap--scan': enterFrom === 'scan' }" role="heading" aria-level="1">
        <view class="cn-swap__t" :class="dialMode === 'result' ? (entering ? 'cn-swap__t--out' : 'cn-swap__t--hide') : ''" :aria-hidden="dialMode === 'result'"><text>{{ t.onboarding.calibrationTitle }}</text></view>
        <view class="cn-swap__t" :class="dialMode !== 'result' ? 'cn-swap__t--hide' : entering ? 'cn-swap__t--in' : ''" :aria-hidden="dialMode !== 'result'">
          <text>{{ t.onboarding.resultTitle }}</text>
          <NxTag v-if="resultActive" tone="success">{{ t.onboarding.activeTag }}</NxTag>
        </view>
      </view>
    </template>

    <view class="ob-content" :class="{ 'cn-content--nav': standalone }" :style="{ paddingBottom: (dialMode ? dialClearance : barClearance) + 'px' }">
      <!-- One dial box for start, read-wait, scan and result (boards V1): position and size never change between them. -->
      <template v-if="dialMode">
        <!-- @vue-ignore: uni supplies dialView in the WebView. -->
        <view :id="dialHost" class="cn-dialwrap" :dial-motion="dialMotion" :change:dial-motion="dialView.update" :style="{ minHeight: dialGeo.min + 'px' }">
          <view class="cn-score" :class="['cn-score--' + dialMode, { 'cn-score--ready': dialReady, 'cn-score--anim': enterFrom === 'read', 'cn-score--from-scan': enterFrom === 'scan' }]"
            :role="dialMode === 'idle' ? undefined : 'img'" :aria-hidden="dialMode === 'idle'" :aria-label="dialMode === 'result' ? t.onboarding.resultTitle + ' ' + finalText + ' ' + t.onboarding.phoneComputeUnit : dialMode === 'scan' ? t.onboarding.detecting : undefined"
            :style="{ width: dialSize + 'px', height: dialSize + 'px' }">
            <view class="cn-score__glow" aria-hidden="true" />
            <view class="cn-score__lens" aria-hidden="true" :style="{ width: dialGeo.inner * 2 + 'px', height: dialGeo.inner * 2 + 'px' }" />
            <view class="cn-score__svg" aria-hidden="true"><svg width="100%" height="100%" :viewBox="`0 0 ${dialSize} ${dialSize}`" focusable="false">
              <g class="cn-ticks-base"><line v-for="(tick, i) in dialFace.ticks" :key="'b' + i" :class="tick.major ? 'cn-tick-major' : 'cn-tick-minor'" :style="{ '--i': i }" :x1="tick.x1" :y1="tick.y1" :x2="tick.x2" :y2="tick.y2" /></g>
              <g class="cn-ring-base"><path v-for="(arc, i) in dialFace.arcs" :key="'ba' + i" class="cn-arc" :d="arc" /><line v-for="(mark, i) in dialFace.marks" :key="'bm' + i" class="cn-mark" :x1="mark.x1" :y1="mark.y1" :x2="mark.x2" :y2="mark.y2" /><circle class="cn-inner" :cx="dialSize / 2" :cy="dialSize / 2" :r="dialGeo.inner" /></g>
              <g v-if="dialMode === 'scan' || enterFrom === 'scan'" class="cn-sweep"><path v-for="(arc, i) in dialFace.sweep" :key="'s' + i" class="cn-sweep__seg" :style="{ strokeOpacity: arc.o }" :d="arc.d" /></g>
              <g v-if="dialMode !== 'idle'" class="cn-ticks"><line v-for="(tick, i) in dialFace.ticks" :key="'r' + i" :class="tick.major ? 'cn-tick-major' : 'cn-tick-minor'" :style="{ '--i': i }" :x1="tick.x1" :y1="tick.y1" :x2="tick.x2" :y2="tick.y2" /></g>
              <g v-if="dialMode === 'result'" class="cn-ring"><path v-for="(arc, i) in dialFace.arcs" :key="'ra' + i" class="cn-arc" :d="arc" /><line v-for="(mark, i) in dialFace.marks" :key="'rm' + i" class="cn-mark" :x1="mark.x1" :y1="mark.y1" :x2="mark.x2" :y2="mark.y2" /><circle class="cn-inner" :cx="dialSize / 2" :cy="dialSize / 2" :r="dialGeo.inner" /></g>
              <g v-if="dialMode === 'result'" class="cn-burst"><circle :cx="dialSize / 2" :cy="dialSize / 2" :r="dialGeo.inner" /></g>
            </svg></view>
            <view class="cn-score__ctr" aria-hidden="true">
              <text v-if="dialMode === 'scan' || enterFrom === 'scan'" class="cn-score__scan-t">{{ t.onboarding.detecting }}</text>
              <svg v-else width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M11 18h2" /></svg>
            </view>
            <!-- Count while the entrance runs; under reduced motion the final value shows at once. -->
            <view v-if="dialMode === 'result' || scanTarget !== null" class="cn-score__num" aria-hidden="true">
              <view class="cn-score__value" :style="{ fontSize: dialNumberSize + 'px' }">
                <text class="cn-score__v cn-score__v--count">{{ entering && enterFrom === 'read' || dialMode === 'scan' ? zeroText : finalText }}</text>
                <text class="cn-score__v cn-score__v--final">{{ finalText }}</text>
              </view>
              <text class="cn-score__u" :style="{ fontSize: dialUnitSize + 'px', lineHeight: dialGeo.unitLh + 'px' }">{{ t.onboarding.phoneComputeUnit }}</text>
            </view>
          </view>
          <!-- Standalone result: success tag under the dial, placed absolutely so the dial box does not move; the dial already reads 校准完成. -->
          <NxTag v-if="standalone && dialMode === 'result'" tone="success" class="cn-dial-tag" :class="{ 'cn-dial-tag--anim': entering }" aria-hidden="true" :style="{ top: dialTagTop + 'px' }">
            <svg class="cn-dial-tag__icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>{{ t.onboarding.detected }}
          </NxTag>
        </view>
        <view class="cn-slot" :class="{ 'cn-slot--enter': enterFrom === 'read', 'cn-slot--scan-end': enterFrom === 'scan' }">
          <!-- Task rules (03 §3.5.1): one row, text and icon are one trigger. -->
          <!-- A tray with a note above its button is taller than the bar this slot reserves, so the rules row steps aside for it
               (the dial keeps its box). -->
          <view v-if="calibrationWritePending && dialMode === 'idle' && !calibrationResendAvailable" class="cn-rules cn-status" role="status"><view class="ob-spin cn-status__spin" aria-hidden="true" /><text>{{ t.onboarding.calibrationWritePending }}</text></view>
          <view v-else-if="standalone && dialMode === 'result' && !(bar.kind === 'tray' && bar.note)" class="cn-rules"><NxHintBubble :label="t.onboarding.policyTitle" :text="policyLines" /></view>
          <view v-if="(dialMode === 'scan' || enterFrom === 'scan') && iosPhone" class="cn-iostrack" role="list">
            <view class="cn-iostrack__nd" role="listitem"><view class="cn-iostrack__dot cn-iostrack__dot--cur" /><text class="cn-iostrack__lb">{{ t.onboarding.iosStepIdentify }}</text></view>
            <view class="cn-iostrack__nd" aria-hidden="true"><view class="cn-iostrack__dot" /></view>
            <view class="cn-iostrack__nd" aria-hidden="true"><view class="cn-iostrack__dot" /></view>
          </view>
        </view>
      </template>

      <!-- Result states: NxResultHead is the only title; links sit under it. -->
      <PhoneEarningsEstimate v-if="isEstimate && nativePhoneAvailable" v-show="estimateShown" :view="estimateView" :calibration="canonical" :shown="estimateShown && pageVisible" />
      <view v-if="estimateShown && !(bar.kind === 'tray' && bar.note)" class="cn-rules cn-rules--estimate"><NxHintBubble :label="t.onboarding.policyTitle" :text="policyLines" /></view>
      <view v-if="!dialMode && !estimateShown" class="ob-rh">
        <NxResultHead :tone="head.tone" :icon="head.icon" :title="head.title" :description="head.body">
          <view v-if="head.link === 'retry'" class="cn-link cn-link--brand" role="button" :tabindex="activationBusy ? -1 : 0" :aria-disabled="activationBusy" @click="onActivate" @keydown.enter.prevent="onActivate" @keydown.space.prevent="onActivate"><text>{{ t.onboarding.activationRetry }}</text></view>
          <view v-else-if="head.link === 'support'" class="cn-link" role="link" tabindex="0" @click="contactSupport" @keydown.enter.prevent="contactSupport" @keydown.space.prevent="contactSupport"><text>{{ t.onboarding.iosContactSupport }}</text><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></view>
        </NxResultHead>
      </view>
    </view>

    <!-- Read-wait → result: the grey button under the final bar; spinner out, label recentred, then the skins cross-fade. -->
    <view v-if="entering && enterFrom === 'read'" class="ob-bar nx-glass-bar cn-bar-under" :class="{ 'cn-bar-under--seq': bar.kind === 'tray' }" aria-hidden="true">
      <view class="ob-btn" role="button" aria-disabled="true"><view class="ob-spin" /><view class="cn-bar-under__lbl"><text>{{ resultActionLabel }}</text><svg v-if="!standalone && !resultActive" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg></view></view>
    </view>
    <!-- Bottom bar (04 §4.0), by source state and the action in flight. -->
    <view v-if="bar.kind !== 'none'" class="ob-bar nx-glass-bar" :aria-hidden="resultActionLocked || undefined" :class="{ 'cn-bar--enter': entering && enterFrom === 'read', 'cn-bar--seq': entering && enterFrom === 'read' && bar.kind === 'tray', 'cn-bar--rise': entering && enterFrom === 'scan' }">
      <view v-if="bar.kind === 'status'" class="nx-tray-status" role="status"><text>{{ bar.label }}</text></view>
      <template v-else-if="bar.kind === 'tray'">
        <text v-if="bar.note" class="nx-tray-note">{{ bar.note }}</text>
        <view class="ob-tray-row">
          <view v-if="bar.secondary" class="ob-tray-text nx-tray-text" role="button" :tabindex="bar.secondary.off || resultActionLocked ? -1 : 0" :aria-disabled="bar.secondary.off" :aria-busy="bar.secondary.busy" @click="runBar(bar.secondary, $event)" @keydown.enter.prevent="runBar(bar.secondary, $event)" @keydown.space.prevent="runBar(bar.secondary, $event)">
            <view v-if="bar.secondary.busy" class="ob-spin ob-spin--s" aria-hidden="true" /><text>{{ bar.secondary.label }}</text>
          </view>
          <view class="ob-btn" :class="{ 'ob-btn--primary': !bar.primary.off }" role="button" :tabindex="bar.primary.off || resultActionLocked ? -1 : 0" :aria-disabled="bar.primary.off" :aria-busy="bar.primary.busy" data-system-chrome-primary @click="runBar(bar.primary, $event)" @keydown.enter.prevent="runBar(bar.primary, $event)" @keydown.space.prevent="runBar(bar.primary, $event)">
            <view v-if="bar.primary.busy" class="ob-spin" aria-hidden="true" /><text>{{ bar.primary.label }}</text><template v-if="bar.primary.arrow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg></template>
          </view>
        </view>
      </template>
      <view v-else class="ob-btn" :class="{ 'ob-btn--primary': !bar.primary.off && !bar.primary.glass, 'ob-btn--glass nx-frosted-button': bar.primary.glass }" role="button" :tabindex="bar.primary.off || resultActionLocked ? -1 : 0" :aria-disabled="bar.primary.off" :aria-busy="bar.primary.busy" data-system-chrome-primary @click="runBar(bar.primary, $event)" @keydown.enter.prevent="runBar(bar.primary, $event)" @keydown.space.prevent="runBar(bar.primary, $event)">
        <view v-if="bar.primary.busy" class="ob-spin" aria-hidden="true" /><text>{{ bar.primary.label }}</text><template v-if="bar.primary.arrow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg></template>
      </view>
    </view>
    <!-- Bar reservation for the dial phases: the tallest bar any of them can show here. Guided step 2 shows at most one floating
         button (board: 48 + 22 + 16); the standalone result can show the iOS tray (it wraps on long languages). -->
    <view class="ob-bar nx-glass-bar cn-probe" aria-hidden="true">
      <view v-if="!standalone" class="ob-btn ob-btn--primary" role="button"><text>{{ t.onboarding.viewEstimate }}</text><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg></view>
      <view v-else class="ob-tray-row"><view class="ob-tray-text nx-tray-text"><text>{{ t.onboarding.iosActivateLater }}</text></view><view class="ob-btn ob-btn--primary"><text>{{ t.onboarding.activatePhone }}</text><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg></view></view>
    </view>
    <GlobalUi />
  </StandalonePageShell>
</template>

<script setup lang="ts">
import { navReset, navTo } from "@/lib/route";
import { hasNativeAndroidPhoneRuntime, hasNativePhoneRuntime, nativePhonePlatform } from "@/lib/native-phone-runtime";
import { ref, computed, getCurrentInstance, nextTick, onMounted, onUnmounted, toRef, watch } from "vue";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { captureRuntimeRevision, isCurrentRuntimeRevision } from "@/api/order-api";
import StandalonePageShell from "@/components/device/standalone-page-shell.vue";
import PhoneEarningsEstimate from "./phone-earnings-estimate.vue";
import GlobalUi from "@/components/global-ui.vue";
import NxHintBubble from "@/components/ui/nx-hint-bubble.vue";
import NxResultHead from "@/components/ui/nx-result-head.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import LiquidGlass from "@/components/liquid-glass.vue";
import { useDialogBackHeld } from "@/composables/use-dialog-a11y";
import { useT } from "@/i18n/use-t";
import { useAuth } from "@/store/auth";
import { useApp } from "@/store/app";
import { useSession } from "@/store/session";
import { markAuthAccountOnboardingComplete } from "@/store/auth-account";
import { getDeviceId } from "@/lib/device-id";
import { collectDeviceSignals } from "@/lib/device-signals";
import { beginPhoneCommand, confirmedPhoneWriteRejection, createPhoneWriteReadback, finishPhoneCommand, readPhoneCommand, type PhoneCommand } from "@/lib/phone-onboarding-commands";
import { readCurrentPhoneActive, readReplacementSourceDevice } from "@/lib/phone-onboarding-authority";
import { apiRuntimeConfig, onboardingCalibrationApi, remoteApiEnabled } from "@/api/runtime";
import { phoneRecoveryCredential } from "@/lib/phone-recovery-credential";
import type { OnboardingCalibration } from "@/api/onboarding-calibration-api";
import { confirm as uiConfirm, toast, useUI } from "@/store/ui";
import { calibrationBelongsTo, createPhoneCalibrationFlow } from "@/lib/phone-calibration-flow";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import type { RemoteAccountRequest } from "@/lib/remote-account-epoch";
import { ApiError } from "@/api/errors";
import { phoneActivationFeedback, confirmedPhoneActivationRejection } from "@/lib/phone-activation-feedback";
import { confirmDeferredPhoneActivation, syncDeferredPhoneActivation } from "@/lib/defer-phone-activation";
import { isCurrentOnboardingCalibrationScope, type OnboardingCalibrationScope } from "@/lib/onboarding-calibration-scope";
import type { DialMotion, DialMotionReceipt } from "@/lib/calibration-dial-view";
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

const t = useT();
const auth = useAuth();
const props = defineProps<{ entry: "estimator" | "connect"; options: Record<string, string>; visible: boolean }>();
const CALIBRATION_PAGE = "/pages/onboarding/estimator";
const ESTIMATE_PAGE = "/pages/onboarding/connect";

// Only explicit remeasurement or a server-confirmed replacement is recalibration.
const isRecal = ref(props.entry === "connect" && props.options.mode === "recalibrate");
const isLogin = props.entry === "connect" && props.options.mode === "login";
const loginCheckNeeded = ref(isLogin);
let autoRecalibrate = props.entry === "estimator" && props.options.recalibrate === "1";
// A failed preflight read must not turn a requested remeasurement into a read-only result.
let recalibrationRequested = false;
const standalone = computed(() => isRecal.value || isLogin);
const isEstimate = computed(() => props.entry === "connect" && !standalone.value && props.options.mode !== "resume");
const stepLabel = computed(() => isEstimate.value ? t.value.onboarding.step3of3 : t.value.onboarding.step2of3);

type Phase = "intro" | "calibrating" | "result" | "error";
type FailedAction = "calibration" | "activate";
const phase = ref<Phase>(isEstimate.value ? "calibrating" : "intro");
const failedAction = ref<FailedAction>("calibration");
const failureCode = ref("");
const activationOutcome = ref<"idle" | "preflight-unconfirmed" | "unconfirmed" | "active">("idle");
const canDefer = computed(() => activationOutcome.value !== "unconfirmed" && activationOutcome.value !== "active"
  && deferOutcome.value !== "unknown" && !deferSyncPending.value && !currentPhoneActive.value && canonical.value?.activationStatus !== "ACTIVE"
  && (phase.value !== "result" || iosPhone || inFlight.value === "defer"
    || deferCalibrationRetry.value));

// Every runtime mode receives final facts from the authenticated server. The
// onboarding path intentionally has no local capability fallback, so mock,
// sandbox, and remote cannot turn device observations into business facts.
const canonical = ref<OnboardingCalibration | null>(null);
const calibrationBusy = ref(false);
const hasCalibration = computed(() => isMatched(canonical.value));
function isMatched(result: OnboardingCalibration | null): result is OnboardingCalibration {
  return !!result?.calibrationAvailable && result.calibrationStatus === "MATCHED";
}

let mounted = true;
const pageVisible = toRef(props, "visible");
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
  accountEpoch += 1;
  requestGeneration += 1;
  autoRecalibrate = false;
  recalibrationRequested = false;
  activationBusy.value = false;
  calibrationBusy.value = false;
  finishScanWait(false);
  finishEntrance();
  useUI().clearConfirmsBy(confirmOwner);
  calibrationFlow.reset();
  calibrationReadback.reset();
  deferReadback.reset();
  deferIntent = null;
  replacementSource.value = null;
  currentPhoneActive.value = false;
  activationIntent = null;
  activationOutcome.value = "idle"; activationCompleted = false;
  receiptNotFound.value = false;
  resultReadRecovering.value = false;
  calibrationWritePending.value = false;
  deferOutcome.value = null;
  deferSyncPending.value = false;
  deferNeedsCalibration.value = false;
  leaveAfterDeferral = false;
  canonical.value = null;
  failureCode.value = "";
  failedAction.value = "calibration";
  phase.value = "intro";
  if (next && nativePhoneAvailable && !standalone.value) void openFlow();
});

const iosPending = computed(() => canonical.value?.calibrationStatus === "PENDING_VERIFICATION" && canonical.value.signals?.platform === "ios");
function contactSupport() { if (!activationBusy.value) navTo("/pages/support/messages"); }
const failureFeedback = computed(() => failedAction.value === "activate" || isLogin || isRecal.value
  ? phoneActivationFeedback(failureCode.value) : undefined);
const supportRequired = computed(() => activationOutcome.value === "idle" && failureFeedback.value?.action === "support");

// Both entry points use the same account-scoped command store and read-back.
const calibrationFlow = createPhoneCalibrationFlow({ api: onboardingCalibrationApi,
  collect: collectCalibrationSignals });
const nativePhoneAvailable = hasNativePhoneRuntime();
const iosPhone = nativePhonePlatform() === "ios";
type ActivationIntent = PhoneCommand<"activate">;
let activationIntent: ActivationIntent | null = null;
let deferIntent: PhoneCommand<"defer"> | null = null;
const currentPhoneActive = ref(false);
const calibrationReadback = createPhoneWriteReadback();
const deferReadback = createPhoneWriteReadback();
const replacementSource = ref<Awaited<ReturnType<typeof readReplacementSourceDevice>>>(null);
// A phone in the fleet is drawn with the phone artwork (use-device-product-image).
const PHONE_ART = "/static/img/home-glass-20260928/phone.webp";
const activationBusy = ref(false);
let activationCompleted = false;

function calibrationOptions(scope = currentScope()) {
  return { deviceId: getDeviceId(), accountKey: accountKey(), isCurrent: () => scopeIsCurrent(scope) };
}

async function acceptCalibration(result: OnboardingCalibration, options: ReturnType<typeof calibrationOptions>, knownActive?: boolean) {
  const active = knownActive ?? await readCurrentPhoneActive(result);
  if (!options.isCurrent()) return;
  currentPhoneActive.value = active;
  canonical.value = result;
  if (result.activationStatus === "DEFERRED") {
    finishDeferral(result);
    return;
  }
  if (!isMatched(result)) {
    if (isEstimate.value) { goToCalibration(); return; }
    failedAction.value = "calibration";
    phase.value = "error";
    return;
  }
  if (!isEstimate.value && phase.value === "calibrating" && !dialReady.value) {
    await waitForDial();
    if (!options.isCurrent()) return;
  }
  // A calibration already made shows its result at rest: the dial animates only while it really measures.
  phase.value = "result";
}

function restorePhoneWrite(options: ReturnType<typeof calibrationOptions>) {
  activationIntent = readPhoneCommand(options, "activate");
  if (activationIntent) {
    if (!standalone.value && !isEstimate.value) { goToEstimate(); return true; }
    activationOutcome.value = "unconfirmed";
    failActivation(null);
    void recoverActivation();
    return true;
  }
  deferIntent = readPhoneCommand(options, "defer");
  if (deferIntent) {
    leaveAfterDeferral = true;
    deferOutcome.value = "unknown";
    phase.value = isEstimate.value ? "calibrating" : "error";
    void deferRecovery.retry();
    return true;
  }
  if (!calibrationFlow.restore(options)) return false;
  if (isEstimate.value) { goToCalibration(); return true; }
  readOnlyWait.value = true;
  calibrationWritePending.value = true;
  phase.value = "calibrating";
  void resultRecovery.retry();
  return true;
}

async function openFlow() {
  if (!nativePhoneAvailable) return;
  const options = calibrationOptions();
  try {
    if (restorePhoneWrite(options)) return;
    if (loginCheckNeeded.value) {
      motionRun.value += 1;
      scanState.value = { kind: "scan" };
      readOnlyWait.value = false;
      phase.value = "calibrating";
      const status = await onboardingCalibrationApi.phoneLogin(options.deviceId);
      if (!options.isCurrent()) return;
      if (status === "BOUND") {
        navReset({ url: "/pages/index/index", fail: () => {} });
        return;
      }
      if (status !== "NEEDS_CALIBRATION" && status !== "REPLACEMENT_REQUIRED") throw new Error(status);
      isRecal.value = status === "REPLACEMENT_REQUIRED";
      loginCheckNeeded.value = false;
      scanState.value = { kind: "idle" };
      phase.value = "intro";
      return;
    }
    if (standalone.value) return;
    if (autoRecalibrate) {
      autoRecalibrate = false;
      void startCalibration({ force: true });
      return;
    }
    readOnlyWait.value = true;
    phase.value = "calibrating";
    await recoverCalibration();
  } catch (cause) {
    if (!options.isCurrent()) return;
    if (loginCheckNeeded.value) {
      failureCode.value = cause instanceof Error ? cause.message : "";
      phase.value = "error";
    } else resultReadRecovering.value = true;
  }
}

function beginCalibrationScan() {
  readOnlyWait.value = false;
  motionRun.value += 1;
  scanState.value = { kind: "scan" };
}

async function startCalibration({ force = false, resend = false, preflight }: {
  force?: boolean;
  resend?: boolean;
  preflight?: { current: OnboardingCalibration | null; active: boolean };
} = {}) {
  if (isEstimate.value || !nativePhoneAvailable || !pageVisible.value || calibrationBusy.value || activationBusy.value
      || activationOutcome.value !== "idle" || deferOutcome.value === "unknown" || deferSyncPending.value) return;
  if (loginCheckNeeded.value) { void openFlow(); return; }
  calibrationBusy.value = true;
  activationOutcome.value = "idle";
  failureCode.value = "";
  deferOutcome.value = null;
  deferNeedsCalibration.value = false;
  finishEntrance();
  resultReadRecovering.value = false;
  requestGeneration += 1;
  const options = calibrationOptions();
  recalibrationRequested ||= force || isRecal.value || canonical.value?.activationStatus === "DEFERRED";
  try {
    if (!resend && restorePhoneWrite(options)) return;
    currentPhoneActive.value = false;
    canonical.value = null;
    readOnlyWait.value = isLogin && !recalibrationRequested && !resend;
    phase.value = "calibrating";
    if (!readOnlyWait.value) beginCalibrationScan();
    let current: OnboardingCalibration | null;
    let active: boolean;
    try {
      current = preflight ? preflight.current : await calibrationFlow.read(options);
      active = preflight ? preflight.active : !!current && await readCurrentPhoneActive(current);
      if (!options.isCurrent()) return;
    } catch {
      if (!options.isCurrent()) return;
      if (!readOnlyWait.value) await waitForScanTurn(null);
      if (!options.isCurrent()) return;
      calibrationReadback.reset();
      readOnlyWait.value = true;
      if (!resend) resultReadRecovering.value = true;
      return;
    }
    let result = resend ? calibrationFlow.reconcile(current) : current && (active || !recalibrationRequested) ? current : null;
    if (!result) {
      if (readOnlyWait.value) beginCalibrationScan();
      result = await calibrationFlow.write(options, current, resend);
      if (!options.isCurrent()) return;
      active = await readCurrentPhoneActive(result);
    }
    if (!options.isCurrent()) return;
    const target = isMatched(result) && result.activationStatus !== "DEFERRED" ? String(result.computeValue) : null;
    const handoff = !readOnlyWait.value && await waitForScanTurn(target);
    if (!options.isCurrent()) return;
    recalibrationRequested = false;
    calibrationWritePending.value = false;
    if (handoff && target !== null) startEntrance("scan", handoff);
    await acceptCalibration(result, options, active);
  } catch (cause) {
    if (!options.isCurrent()) return;
    if (scanState.value.kind !== "idle") await waitForScanTurn(null);
    if (!options.isCurrent()) return;
    recalibrationRequested = false;
    if (calibrationFlow.hasPendingWrite()) {
      calibrationWritePending.value = true;
      readOnlyWait.value = true;
      return;
    }
    calibrationWritePending.value = false;
    failureCode.value = cause instanceof Error && confirmedPhoneWriteRejection(cause) ? cause.message : "";
    failedAction.value = "calibration";
    phase.value = "error";
  } finally {
    if (options.isCurrent()) {
      calibrationBusy.value = false;
      scanState.value = { kind: "idle" };
    }
  }
}

async function recoverCalibration() {
  const options = calibrationOptions();
  const pending = calibrationWritePending.value;
  try {
    const current = await calibrationFlow.read(options);
    if (!options.isCurrent()) return;
    const result = pending ? calibrationFlow.reconcile(current) : current;
    if (pending && !result) { calibrationReadback.observe(); return; }
    const active = result ? await readCurrentPhoneActive(result) : false;
    if (!options.isCurrent()) return;
    if (!pending && recalibrationRequested && !active) {
      calibrationReadback.reset();
      await startCalibration({ preflight: { current, active } });
      return;
    }
    recalibrationRequested = false;
    if (result && (pending || active || !isRecal.value)) {
      await acceptCalibration(result, options, active);
    } else if (isEstimate.value) {
      goToCalibration();
    } else {
      phase.value = "intro";
    }
    if (!options.isCurrent()) return;
    calibrationReadback.reset();
    resultReadRecovering.value = false;
    calibrationWritePending.value = false;
  } catch (cause) {
    if (!options.isCurrent()) return;
    calibrationReadback.reset();
    if (!calibrationFlow.hasPendingWrite()) {
      calibrationWritePending.value = false;
      resultReadRecovering.value = true;
    }
    throw cause;
  }
}

function resendCalibration() {
  if (!calibrationResendAvailable.value) return;
  calibrationReadback.reset();
  void startCalibration({ resend: true });
}

// Calibration dial geometry (boards B1–B8, V1). The 375 and 390 tiers share the 300px dial; the unit uses the body role.
const windowWidth = uni.getSystemInfoSync().windowWidth;
const dialGeo = windowWidth >= 375
  ? { max: 300, inner: 105.9, base: 52, unit: windowWidth >= 390 ? 15 : 14, unitLh: windowWidth >= 390 ? 22 : 21, min: 250 }
  : { max: 272, inner: 96, base: 48, unit: 14, unitLh: 21, min: 229 };
const DIAL_GAP = 6;   // number → unit
const DIAL_CLEAR = 4; // text corners stay this far inside the inner ring
const dialSize = ref(dialGeo.min);
const dialReady = ref(false);
const dialUnitSize = ref(dialGeo.unit);
const dialTagTop = ref(0);
const finalText = computed(() => scanTarget.value ?? String(canonical.value?.computeValue ?? 0));
// The number is sized from the final string (dot included), never the shorter count: JetBrains Mono advances 0.58em with the
// −0.02em tracking, the block (number, gap, unit line) is centred, and its far corner stays 4px inside the inner ring (10.2).
const dialNumberSize = computed(() => {
  const n = Math.max(1, finalText.value.length), half = (DIAL_GAP + dialGeo.unitLh) / 2, r = dialGeo.inner - DIAL_CLEAR;
  const a = (0.29 * n) ** 2 + 0.25;
  return Math.min(dialGeo.base, Math.floor((-half + Math.sqrt(half * half - 4 * a * (half * half - r * r))) / (2 * a)));
});
const dialFace = computed(() => {
  const d = dialSize.value, c = d / 2, margin = dialGeo.max * 0.03, rTick = c - margin, gap = rTick - dialGeo.inner;
  const rArc = dialGeo.inner + gap * 0.57, major = Math.min(dialGeo.max * 0.034, gap * 0.3);
  const at = (deg: number, r: number) => [c + Math.sin(deg * Math.PI / 180) * r, c - Math.cos(deg * Math.PI / 180) * r].map(v => +v.toFixed(2));
  const arc = (from: number, to: number) => { const [sx, sy] = at(from, rArc), [ex, ey] = at(to, rArc); return `M${sx} ${sy} A${rArc.toFixed(2)} ${rArc.toFixed(2)} 0 0 1 ${ex} ${ey}`; };
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const isMajor = i % 6 === 0, [x1, y1] = at(i * 5, rTick), [x2, y2] = at(i * 5, rTick - (isMajor ? major : major / 2));
    return { major: isMajor, x1, y1, x2, y2 };
  });
  const arcs = [0, 1, 2, 3].map(k => arc(k * 90 + 14, k * 90 + 76));
  const marks = [0, 1, 2, 3].map(k => {
    const [x1, y1] = at(k * 90, rArc - gap * 0.3), [x2, y2] = at(k * 90, rArc + gap * 0.16);
    return { x1, y1, x2, y2 };
  });
  // Scan sweep: a short comet of four arc segments, rotated as one group.
  const sweep = [[-64, -46, 0.12], [-48, -30, 0.3], [-32, -14, 0.6], [-16, 0, 1]].map(([a0, a1, o]) => ({ d: arc(a0, a1), o }));
  return { ticks, arcs, marks, sweep };
});

const readOnlyWait = ref(isEstimate.value);
const resultReadRecovering = ref(false);
const calibrationWritePending = ref(false);
const receiptNotFound = ref(false);
const deferOutcome = ref<"rejected" | "unknown" | null>(null);
const deferSyncPending = ref(false);
const deferNeedsCalibration = ref(false);
const deferCalibrationRetry = computed(() => deferOutcome.value === "rejected" && deferNeedsCalibration.value);
let leaveAfterDeferral = false;

const calibrationResendAvailable = computed(() => calibrationWritePending.value && calibrationReadback.resendAvailable.value);
const deferResendAvailable = computed(() => deferOutcome.value === "unknown" && deferReadback.resendAvailable.value && !activationBusy.value);

const resultRecovery = useAutoRecovery({
  failed: () => !calibrationBusy.value && readOnlyWait.value && (resultReadRecovering.value || calibrationWritePending.value),
  active: () => nativePhoneAvailable && pageVisible.value,
  retry: recoverCalibration,
  retryNotBefore: calibrationReadback.notBefore,
  repeatMs: 30_000,
});

const busyAction = ref<"activate" | "defer" | null>(null);
const inFlight = computed(() => activationBusy.value ? busyAction.value ?? "activate" : null);
function onActivate(event?: Event) {
  if (activationBusy.value) return;
  busyAction.value = "activate";
  void activate(event);
}
function onDefer() { void deferPhoneActivation(); }
function recalibrateNow() {
  if (activationBusy.value || deferOutcome.value === "unknown" || deferSyncPending.value) return;
  if (isEstimate.value) goToCalibration(true);
  else void startCalibration({ force: true });
}

type DialMode = "idle" | "scan" | "result";
const dialMode = computed<DialMode | null>(() => !nativePhoneAvailable || isEstimate.value ? null
  : resultReadRecovering.value ? "idle"
  : phase.value === "intro" ? "idle"
  : phase.value === "calibrating" ? (readOnlyWait.value ? "idle" : "scan")
  : phase.value === "result" ? "result" : null);
const resultActive = computed(() => phase.value === "result" && currentPhoneActive.value);
const estimateShown = computed(() => nativePhoneAvailable && isEstimate.value && phase.value !== "error");
const estimateView = computed(() => resultReadRecovering.value ? "read-failed" : hasCalibration.value ? "detected" : "loading");
const backLocked = computed(() => activationBusy.value || (phase.value === "calibrating" && !readOnlyWait.value));
const resultActionLabel = computed(() => resultActive.value ? t.value.ui.notFoundCta
  : isEstimate.value || standalone.value ? t.value.onboarding.activatePhone : t.value.onboarding.viewEstimate);

type HeadIcon = "check" | "return" | "clock" | "failed" | "alert";
type Head = { tone: "success" | "warning" | "neutral" | "danger"; icon: HeadIcon; title: string; body?: string; link?: "retry" | "support" };
const head = computed<Head>(() => {
  const o = t.value.onboarding;
  if (!nativePhoneAvailable) return { tone: "neutral", icon: "alert", title: o.nonNativeTitle };
  if (canonical.value?.activationStatus === "DEFERRED") return { tone: "neutral", icon: "return", title: o.activationDeferredTitle, body: o.activationLaterBody };
  if (activationOutcome.value === "active") return { tone: "success", icon: "check", title: o.phoneActivationSyncTitle, body: o.phoneActivationSync };
  if (activationOutcome.value === "unconfirmed") return receiptNotFound.value
    ? { tone: "warning", icon: "alert", title: o.reactivateTitle, body: o.reactivateBody }
    : { tone: "warning", icon: "clock", title: o.phoneActivationUnconfirmedTitle, body: o.phoneActivationUnconfirmed };
  if (activationOutcome.value === "preflight-unconfirmed") return { tone: "warning", icon: "alert", title: o.phoneActivationEligibilityUnavailableTitle, body: o.phoneActivationEligibilityUnavailable };
  const feedback = failureFeedback.value;
  if (feedback) {
    // Lighter, truer titles per reason group (onb3 decision 5); the reason line says what happened and what to do.
    const body = o[feedback.detail];
    if (feedback.detail === "phoneCalibrationPendingBody") return { tone: "warning", icon: "clock", title: o.phoneCalibrationPendingTitle, body };
    if (feedback.action === "devices") return { tone: "danger", icon: "failed", title: o.rejectTitleBlocked, body, link: canDefer.value ? "retry" : undefined };
    if (feedback.action === "support") return { tone: "danger", icon: "failed", title: o.rejectTitleSupport, body };
    if (feedback.action === "terms") return { tone: "warning", icon: "alert", title: o.rejectTitleTerms, body, link: "support" };
    if (feedback.action === "login") return { tone: "warning", icon: "alert", title: o.rejectTitleLogin, body, link: "support" };
    if (feedback.action === "recalibrate") return { tone: "warning", icon: "alert", title: o.rejectTitleRecal, body };
    const title = feedback.detail === "phoneReplacementCooldown" ? o.rejectTitleBlocked
      : feedback.detail === "phoneActivationConfirmationRequired" ? o.rejectTitleConfirm
      : feedback.detail === "phoneActivationServiceUnavailable" || feedback.detail === "phoneReplacementPolicyUnavailable" ? o.rejectTitleBusy
      : o.rejectTitleChanged;
    return { tone: "warning", icon: "alert", title, body };
  }
  if (iosPending.value) return { tone: "warning", icon: "clock", title: o.phoneCalibrationPendingIosTitle, body: o.phoneCalibrationPendingIosBody, link: "support" };
  if (canonical.value?.calibrationStatus === "PENDING_VERIFICATION") return { tone: "warning", icon: "clock", title: o.phoneCalibrationPendingTitle, body: o.phoneCalibrationPendingBody };
  if (loginCheckNeeded.value) return { tone: "warning", icon: "alert", title: o.phoneBindingReadUnavailableTitle, body: o.phoneBindingReadUnavailableBody };
  if (failedAction.value === "calibration") return { tone: "warning", icon: "alert", title: o.calibrationFailedTitle, body: o.activationLaterBody };
  return { tone: "danger", icon: "failed", title: o.activationFailedTitle, body: o.phoneActivationRejected };
});

type BarButton = { label: string; run: (event?: Event) => void; off?: boolean; busy?: boolean; arrow?: boolean; glass?: boolean };
type Bar = { kind: "none" } | { kind: "status"; label: string } | { kind: "float"; primary: BarButton }
  | { kind: "tray"; primary: BarButton; secondary?: BarButton; note?: string };
function runBar(button: BarButton, event?: Event) {
  if (!button.off && !resultActionLocked.value) button.run(event);
}
// The bar follows the source state and the action in flight: only the busy control spins, the others are locked (03 §3.1).
const bar = computed<Bar>(() => {
  const o = t.value.onboarding, busy = activationBusy.value;
  const later = (): BarButton | undefined => canDefer.value
    ? { label: o.iosActivateLater, run: onDefer, off: busy, busy: inFlight.value === "defer" } : undefined;
  const main = (label: string, run: BarButton["run"], arrow = false): BarButton => ({ label, run, arrow, off: busy, busy: inFlight.value === "activate" });
  const pair = (primary: BarButton): Bar => { const secondary = later(); return secondary ? { kind: "tray", primary, secondary } : { kind: "float", primary }; };
  if (!nativePhoneAvailable) return { kind: "float", primary: { label: t.value.login.back, run: leave, glass: true } };
  // A write the server never confirmed, after three read-backs: the user may send the same command again (03 §3.5.2).
  const deferResending = inFlight.value === "defer" && deferOutcome.value === "unknown";
  if (deferResendAvailable.value || deferResending) return {
    kind: "tray",
    note: o.activationDeferResendBody,
    primary: { label: o.iosActivateLater, run: resendDeferral, off: deferResending, busy: deferResending },
  };
  if (deferOutcome.value === "unknown") return { kind: "status", label: o.activationDeferUnknown };
  if (deferSyncPending.value) return { kind: "float", primary: main(o.phoneActivationSyncAction, () => { void deferRecovery.retry(); }) };
  if (phase.value === "error" && canonical.value?.activationStatus === "DEFERRED") return {
    kind: "tray",
    primary: main(o.calibrationStart, () => { void startCalibration({ force: true }); }),
    secondary: { label: t.value.ui.notFoundCta, run: goHome },
  };
  if (deferCalibrationRetry.value)
    return pair(main(o.iosRecalibrate, recalibrateNow));
  if (calibrationResendAvailable.value) return { kind: "tray", note: o.calibrationResendBody, primary: { label: o.calibrationResendAction, run: resendCalibration } };
  if (resultReadRecovering.value) return {
    kind: "tray",
    note: isEstimate.value ? o.estimateReadFailed : o.resultReadFailed,
    primary: { label: resultActionLabel.value, run: () => {}, off: true, arrow: !standalone.value && !isEstimate.value },
  };
  if (phase.value === "intro") return { kind: "float", primary: { label: o.calibrationStart, run: () => { void startCalibration(); } } };
  if (phase.value === "calibrating") return readOnlyWait.value
    ? { kind: "float", primary: { label: resultActionLabel.value, run: () => {}, off: true, busy: true, arrow: !standalone.value && !isEstimate.value } } : { kind: "none" };
  if (phase.value === "result") {
    if (resultActive.value) return { kind: "float", primary: main(resultActionLabel.value, onActivate) };
    if (!standalone.value && !isEstimate.value) return { kind: "float", primary: main(o.viewEstimate, goToEstimate, true) };
    const activating = inFlight.value === "activate";
    const primary = main(activating ? o.activationProcessing : o.activatePhone, onActivate);
    let secondary: BarButton | undefined;
    if (activating) {
      if (iosPhone && isEstimate.value && canonical.value?.activationStatus !== "ACTIVE")
        secondary = { label: o.iosActivateLater, run: onDefer, off: true };
    } else if (iosPhone || inFlight.value === "defer") {
      secondary = later();
    }
    return secondary ? { kind: "tray", primary, secondary } : { kind: "float", primary };
  }
  if (activationOutcome.value === "active") return { kind: "float", primary: main(o.phoneActivationSyncAction, () => { void retryCalibration(); }) };
  if (activationOutcome.value === "unconfirmed") return receiptNotFound.value ? { kind: "float", primary: main(o.reactivateAction, onActivate) } : { kind: "none" };
  const retry = (event?: Event) => {
    if (!activationBusy.value) { busyAction.value = "activate"; retryCalibration(event); }
  };
  if (activationOutcome.value === "preflight-unconfirmed") return pair(main(o.activationRetry, retry));
  const action = failureFeedback.value?.action;
  if (action === "devices") return pair(main(o.phoneActivationManageDevices, retry, true));
  if (supportRequired.value) return pair(main(o.iosContactSupport, retry, true));
  if (action === "terms") return pair(main(o.phoneActivationTermsAction, retry, true));
  if (action === "login") return pair(main(o.phoneActivationLoginAction, retry, true));
  if (action === "recalibrate" || iosPending.value || (!action && (failedAction.value === "calibration" || canonical.value?.calibrationStatus === "PENDING_VERIFICATION")))
    return pair(main(o.iosRecalibrate, retry));
  return pair(main(o.activationRetry, retry));
});

// Dial: measured once when it first shows (the box is the same in every dial phase); one ready starts the CSS entrance and
// the count on Android and iOS alike.
const pageInstance = getCurrentInstance();
const dialHost = `onboarding-dial-${pageInstance!.uid}`;
let dialMeasured = false;
function measureDial() {
  if (!pageInstance?.proxy) { dialReady.value = true; return; }
  const query = uni.createSelectorQuery().in(pageInstance.proxy);
  query.select(".cn-dialwrap").boundingClientRect();
  query.select(".cn-probe").boundingClientRect();
  query.exec((boxes: (UniApp.NodeInfo | null)[]) => {
    const [wrap, probe] = boxes;
    if (probe?.height) dialClearance.value = Math.ceil(probe.height) + 38;
    void nextTick(() => {
      uni.createSelectorQuery().in(pageInstance.proxy).select(".cn-dialwrap").boundingClientRect().exec((again: (UniApp.NodeInfo | null)[]) => {
        const box = again[0] ?? wrap;
        if (box?.height) {
          dialSize.value = Math.max(dialGeo.min, Math.min(dialGeo.max, Math.floor(box.height)));
          dialTagTop.value = Math.round((box.height + dialSize.value) / 2 + 12);
        }
        dialMeasured = true;
        dialReady.value = true;
      });
    });
  });
}
// The unit keeps one line where the inner ring's chord at its height allows it, and steps its size down where it does not.
function fitUnit() {
  if (!pageInstance?.proxy) return;
  uni.createSelectorQuery().in(pageInstance.proxy).select(".cn-score__u").boundingClientRect().exec((boxes: (UniApp.NodeInfo | null)[]) => {
    const unit = boxes[0];
    if (!unit?.width) return;
    const r = dialGeo.inner - DIAL_CLEAR, halfBlock = (dialNumberSize.value + DIAL_GAP + dialGeo.unitLh) / 2;
    const chord = 2 * Math.sqrt(r * r - halfBlock * halfBlock);
    if (unit.width > chord) dialUnitSize.value = Math.floor(dialGeo.unit * chord / unit.width);
  });
}
const dialClearance = ref(102);
const barClearance = ref(24);
function waitForDial() {
  return new Promise<void>(resolve => {
    const stop = watch(dialReady, ready => {
      if (!ready) return;
      clearTimeout(release);
      stop();
      resolve();
    });
    // A missing measurement leaves the existing minimum geometry usable.
    const release = setTimeout(() => { dialReady.value = true; }, 2000);
  });
}
function measureBar() {
  if (!pageInstance?.proxy) return;
  uni.createSelectorQuery().in(pageInstance.proxy).select(".ob-bar:not(.cn-probe):not(.cn-bar-under)").boundingClientRect().exec((boxes: (UniApp.NodeInfo | null)[]) => {
    barClearance.value = boxes[0]?.height ? Math.ceil(boxes[0].height) + 38 : 24;
  });
}
// The WebView owns scan/count timing. These releases cover missing bridge messages.
const SCAN_RELEASE_MS = 6500;
const ENTRANCE_RELEASE_MS = 3000;
const enterFrom = ref<"read" | "scan" | null>(null);
const entering = computed(() => enterFrom.value !== null);
const resultActionLocked = ref(false);
const motionRun = ref(0);
const scanState = ref<Omit<DialMotion, "host" | "run">>({ kind: "idle" });
const scanTarget = computed(() => scanState.value.kind === "scan-result" ? scanState.value.target ?? null : null);
const scanAt = ref(0);
const scanDelay = ref(0);
const zeroText = computed(() => (0).toFixed(finalText.value.split(".")[1]?.length ?? 0));
let resolveScan: ((at: number | false) => void) | null = null;
let scanRelease: ReturnType<typeof setTimeout> | null = null;
let entranceRelease: ReturnType<typeof setTimeout> | null = null;
function waitForScanTurn(target: string | null) {
  return new Promise<number | false>(resolve => {
    resolveScan = resolve;
    scanState.value = target === null ? { kind: "scan-stop" } : { kind: "scan-result", target };
    scanRelease = setTimeout(() => finishScanWait(false), SCAN_RELEASE_MS);
  });
}
function finishScanWait(at: number | false) {
  if (scanRelease) clearTimeout(scanRelease);
  scanRelease = null;
  const resolve = resolveScan;
  resolveScan = null;
  resolve?.(at);
}
const dialMotion = computed<DialMotion>(() => {
  const identity = { run: motionRun.value, host: dialHost };
  if (enterFrom.value === "scan" && dialMode.value === "result") return { kind: "handoff", at: scanAt.value, ...identity };
  if (enterFrom.value === "read" && dialMode.value === "result")
    return { kind: "read", target: finalText.value, readyAfter: bar.value.kind === "tray" ? 1100 : 1000, ...identity };
  return { ...(dialMode.value === "scan" ? scanState.value : { kind: "idle" as const }), ...identity };
});
function startEntrance(from: "read" | "scan", at = 0) {
  if (from === "read") motionRun.value += 1;
  scanAt.value = at;
  scanDelay.value = at ? -Math.max(0, Date.now() - at) : 0;
  enterFrom.value = from;
  resultActionLocked.value = true;
  if (entranceRelease) clearTimeout(entranceRelease);
  entranceRelease = setTimeout(finishEntrance, ENTRANCE_RELEASE_MS);
}
function finishEntrance() {
  if (entranceRelease) clearTimeout(entranceRelease);
  entranceRelease = null;
  enterFrom.value = null;
  resultActionLocked.value = false;
}

// App-Plus resolves renderjs callMethod on the component proxy.
defineOptions({ methods: {
  onDialMotionEnd(this: { $: { exposed: { receiveDialMotionEnd(receipt: DialMotionReceipt): void } | null } }, receipt: DialMotionReceipt) {
    this.$.exposed?.receiveDialMotionEnd(receipt);
  },
} });
function receiveDialMotionEnd(receipt: DialMotionReceipt) {
  if (receipt.run !== motionRun.value) return;
  if (receipt.kind === "scan") finishScanWait(receipt.at ?? false);
  if (receipt.kind === "ready") resultActionLocked.value = false;
  if (receipt.kind === "done") finishEntrance();
}

watch([dialMode, () => scanTarget.value, () => bar.value.kind, () => t.value.onboarding.iosActivateLater], ([mode]) => {
  void nextTick(() => {
    if (mode && !dialMeasured) measureDial();
    if (!mode) measureBar();
    if (mode === "result" || scanTarget.value !== null) {
      dialUnitSize.value = dialGeo.unit;
      void nextTick(fitUnit);
    }
  });
}, { immediate: true, flush: "post" });

const policyLines = computed(() => [
  t.value.onboarding.policyLine1,
  t.value.onboarding.policyLine2,
  t.value.onboarding.policyLine3,
]);

function retryCalibration(event?: Event) {
  if (!nativePhoneAvailable || !pageVisible.value || activationCompleted || activationBusy.value
      || deferOutcome.value === "unknown" || deferSyncPending.value) return;
  if (activationOutcome.value !== "idle") { onActivate(event); return; }
  if (failureFeedback.value?.action === "devices") { navTo("/pages/me/devices"); return; }
  if (failureFeedback.value?.action === "login") {
    auth.signOut();
    void navReset("/pages/login/login");
    return;
  }
  if (failureFeedback.value?.action === "terms") { navTo("/pages/onboarding/terms"); return; }
  if (supportRequired.value) { contactSupport(); return; }
  if (failureFeedback.value?.action === "recalibrate") { recalibrateNow(); return; }
  if (failedAction.value === "activate") {
    if (!canonical.value?.calibrationAvailable) {
      if (isEstimate.value) goToCalibration();
      else phase.value = "intro";
      return;
    }
    onActivate(event);
    return;
  }
  recalibrateNow();
}

function completeOnboardingLocally(signOutOnFailure = true): boolean {
  if (isRecal.value) return true;
  if (!auth.completeOnboarding()) return false;
  // The phone account directory is a local mock/cache concern. In remote mode
  // the authenticated backend transition is authoritative and must not be
  // downgraded to a visible activation failure when this optional cache is
  // unavailable (private browsing, storage quota, or native bridge failure).
  if (markAuthAccountOnboardingComplete(auth.email || auth.accountId || "default") || remoteApiEnabled) return true;
  if (signOutOnFailure && !auth.requireOnboarding()) auth.signOut();
  return false;
}

type ActivationReadOutcome =
  | { kind: "active"; result: OnboardingCalibration }
  | { kind: "completed-inactive"; result: OnboardingCalibration | null }
  | { kind: "rejected"; reason: string; calibration: OnboardingCalibration | null }
  | { kind: "pending" | "unconfirmed" | "not-found" };

/** Only a fresh, successful null receipt paired with a scoped non-ACTIVE phone authorizes replay. */
async function readActivationOutcome(command: ActivationIntent, scope: RequestScope): Promise<ActivationReadOutcome> {
  let receipt;
  try {
    receipt = await onboardingCalibrationApi.activationReceipt(command.idempotencyKey);
  } catch { /* The current phone facts can still confirm activation. */ }
  if (!scopeIsCurrent(scope)) return { kind: "unconfirmed" };
  if (receipt?.status === "PENDING") return { kind: "pending" };

  let calibration: OnboardingCalibration | null = null;
  try {
    if (receipt?.status === "SUCCEEDED") {
      if (!acceptCurrentCanonical(scope, receipt.result)) return { kind: "unconfirmed" };
      const active = await readCurrentPhoneActive(receipt.result);
      if (active) return { kind: "active", result: receipt.result };
      const current = await calibrationFlow.read({ ...calibrationOptions(scope), deviceId: command.deviceId });
      return { kind: "completed-inactive", result: current };
    }
    const result = await calibrationFlow.read({ ...calibrationOptions(scope), deviceId: command.deviceId });
    if (result && await readCurrentPhoneActive(result)) return { kind: "active", result };
    if (receipt === null && result) return { kind: "not-found" };
    if (result?.activationStatus === "CALIBRATED" && result.calibrationAvailable && result.calibrationStatus === "MATCHED") {
      calibration = result;
    }
  } catch { /* A failed result read cannot authorize replay. */ }
  return receipt?.status === "FAILED" ? { kind: "rejected", reason: receipt.reason, calibration } : { kind: "unconfirmed" };
}

function settleActivationCommand() {
  if (activationIntent) finishPhoneCommand("activate", activationIntent);
  activationIntent = null;
}

/** Apply only a confirmed activation; shared by explicit submission and GET recovery. */
function acceptActivation(activated: OnboardingCalibration, scope: RequestScope, announce = true) {
  if (activationCompleted || !acceptCurrentCanonical(scope, activated)) return;
  // Server success survives local persistence errors; retry synchronizes this result without another POST.
  canonical.value = activated;
  currentPhoneActive.value = true;
  activationOutcome.value = "active";
  receiptNotFound.value = false;
  settleActivationCommand();
  if (!useSession().markCalibrated(auth.email || auth.accountId || "default") || !completeOnboardingLocally()) {
    throw new Error("PHONE_ACTIVATION_LOCAL_COMMIT_FAILED");
  }
  const app = useApp();
  app.acceptPhoneActivation();
  void app.refreshRemoteFleet();
  if (isRecal.value) app.resumeMining();
  activationCompleted = true;
  if (announce) toast.success(t.value.onboarding.phoneActivationConfirmed);
  navReset({ url: "/pages/index/index", fail: () => {} });
}
function failActivation(cause: unknown) {
  failureCode.value = cause instanceof Error ? cause.message : "";
  failedAction.value = "activate";
  phase.value = "error";
}

async function applyActivationRead(outcome: ActivationReadOutcome, scope: RequestScope) {
  receiptNotFound.value = outcome.kind === "not-found";
  if (outcome.kind === "active") acceptActivation(outcome.result, scope);
  if (outcome.kind === "completed-inactive") {
    settleActivationCommand();
    activationOutcome.value = "idle";
    if (outcome.result) await acceptCalibration(outcome.result, calibrationOptions(scope), false);
    else if (isEstimate.value) goToCalibration();
    else phase.value = "intro";
  }
  if (outcome.kind === "rejected") {
    if (outcome.calibration) canonical.value = outcome.calibration;
    settleActivationCommand();
    activationOutcome.value = "idle";
    throw new Error(outcome.reason);
  }
}

let activationRead: Promise<void> | null = null;
function recoverActivation(): Promise<void> {
  if (activationRead) return activationRead;
  const command = activationIntent;
  if (!pageVisible.value || activationBusy.value || activationOutcome.value !== "unconfirmed" || !command) return Promise.resolve();
  const scope = currentScope(), runtime = captureRuntimeRevision();
  const current = () => pageVisible.value && scopeIsCurrent(scope) && isCurrentRuntimeRevision(runtime) && activationIntent === command;
  const read = Promise.resolve().then(async () => {
    if (!current()) return;
    const outcome = await readActivationOutcome(command, scope);
    if (!current()) return;
    try { await applyActivationRead(outcome, scope); }
    catch (cause) {
      failActivation(cause);
      toast.error(head.value.title, head.value.body);
    }
  }).finally(() => {
    if (activationRead === read) activationRead = null;
  });
  activationRead = read;
  return read;
}
useAutoRecovery({
  failed: () => activationOutcome.value === "unconfirmed" && !activationBusy.value,
  active: () => pageVisible.value,
  retry: recoverActivation,
  repeatMs: 15_000,
});

// The busy iOS bar can unmount the tapped control before the global dialog opens.
function replacementTrigger(event?: Event) {
  if (typeof document === "undefined") return null;
  const trigger = event?.currentTarget instanceof HTMLElement ? event.currentTarget : document.activeElement;
  if (!(trigger instanceof HTMLElement)) return null;
  const root = trigger.closest(".cn-root");
  return () => {
    const button = trigger.isConnected ? trigger : root?.querySelector<HTMLElement>(
      ".ob-bar:not(.cn-probe):not(.cn-bar-under) [data-system-chrome-primary]",
    );
    if (button?.getAttribute("aria-disabled") !== "true") button?.focus();
  };
}

async function activate(event?: Event) {
  const before = canonical.value;
  if (!pageVisible.value || activationCompleted || !nativePhoneAvailable || !mounted || activationBusy.value
      || (!isEstimate.value && !standalone.value && !currentPhoneActive.value)
      || deferOutcome.value === "unknown" || deferSyncPending.value
      || (!activationIntent && (!before?.calibrationAvailable || before.calibrationStatus !== "MATCHED"))) return;
  if (activationOutcome.value === "unconfirmed" && !receiptNotFound.value) return;
  const restoreTrigger = replacementTrigger(event);
  let replacementCancelled = false;
  const previousPhase = phase.value;
  const previousOutcome = activationOutcome.value;
  activationBusy.value = true;
  if (isEstimate.value && isMatched(before) && !activationIntent) phase.value = "result";
  const scope = currentScope();
  try {
    if (currentPhoneActive.value && before) { acceptActivation(before, scope, standalone.value || isEstimate.value); return; }

    let command = activationIntent;
    if (command) {
      await activationRead;
      if (!scopeIsCurrent(scope) || activationIntent !== command || !receiptNotFound.value) return;
      receiptNotFound.value = false;
      const outcome = await readActivationOutcome(command, scope);
      if (!scopeIsCurrent(scope)) return;
      await applyActivationRead(outcome, scope);
      if (outcome.kind !== "not-found" || !scopeIsCurrent(scope)) return;
    } else {
      if (!before) return;
      activationOutcome.value = "preflight-unconfirmed";
      let eligibility;
      try { eligibility = await onboardingCalibrationApi.activationEligibility(); }
      catch (cause) {
        if (scopeIsCurrent(scope) && confirmedPhoneActivationRejection(cause)) activationOutcome.value = "idle";
        throw cause;
      }
      if (!scopeIsCurrent(scope)) return;
      if (!eligibility.canActivate) {
        activationOutcome.value = "idle";
        throw new Error(eligibility.blockedReasons[0] || "PHONE_ACTIVATION_UNAVAILABLE");
      }
      const replacing = eligibility.binding !== null && (eligibility.binding.installationId !== before.deviceId
        || failureCode.value === "PHONE_REPLACEMENT_CONFIRMATION_REQUIRED");
      if (replacing) {
        replacementSource.value = await readReplacementSourceDevice(eligibility.binding?.userDeviceId ?? null);
        if (!scopeIsCurrent(scope)) return;
        // 03 §3.5: with the bound phone's own facts the sentence becomes its device row (art, name, number, where it goes)
        // and the cancelled jobs a consequence line; without them the general sentence stays.
        const source = replacementSource.value, o = t.value.onboarding;
        const confirmed = await uiConfirm({ title: o.replacementConfirmTitle, icon: "warn",
          ...(source
            ? { devices: [{ name: source.name, code: source.instanceNo, fate: o.replacementSourceStopsTasks, image: PHONE_ART }], note: o.replacementJobsCancelled }
            : { message: o.replacementConfirmBody }),
          confirmLabel: o.replacementConfirmAction, owner: confirmOwner });
        if (!scopeIsCurrent(scope)) return;
        replacementSource.value = null;
        if (!confirmed) {
          activationOutcome.value = previousOutcome;
          phase.value = previousPhase;
          replacementCancelled = true;
          return;
        }
      }
      const saved = beginPhoneCommand(calibrationOptions(scope), "activate", {
        revision: before.revision,
        versions: {
          expectedBindingVersion: eligibility.binding?.bindingVersion ?? null,
          expectedPolicyVersion: eligibility.policyVersion,
          replacementConfirmed: replacing,
          ...(eligibility.grantId ? { exceptionGrantId: eligibility.grantId } : {}),
        },
      });
      command = saved.value;
      activationIntent = command;
      if (saved.reused) {
        activationOutcome.value = "unconfirmed";
        failActivation(null);
        return;
      }
    }

    activationOutcome.value = "unconfirmed";
    receiptNotFound.value = false;
    let activated: OnboardingCalibration;
    try {
      activated = await onboardingCalibrationApi.activate(command.deviceId, command.revision, command.idempotencyKey,
        command.versions, phoneRecoveryCredential(apiRuntimeConfig.baseUrl, scope.accountKey));
      if (!scopeIsCurrent(scope)) return;
      if (!acceptCurrentCanonical(scope, activated) || !activated.calibrationAvailable || activated.activationStatus !== "ACTIVE")
        throw new ApiError({ kind: "protocol", message: "PHONE_ACTIVATION_NOT_CONFIRMED" });
    } catch (cause) {
      if (!scopeIsCurrent(scope)) return;
      const outcome = await readActivationOutcome(command, scope);
      if (!scopeIsCurrent(scope)) return;
      await applyActivationRead(outcome, scope);
      if (outcome.kind === "active" || outcome.kind === "completed-inactive") return;
      throw cause;
    }
    acceptActivation(activated, scope);
  } catch (cause) {
    if (scopeIsCurrent(scope)) failActivation(cause);
  } finally {
    if (isCurrentOnboardingCalibrationScope(scope, currentScope())) activationBusy.value = false;
    if (replacementCancelled && restoreTrigger) {
      await nextTick();
      if (pageVisible.value && scopeIsCurrent(scope)) restoreTrigger();
    }
  }
}

function finishDeferral(result: OnboardingCalibration) {
  if (deferIntent) finishPhoneCommand("defer", deferIntent);
  deferIntent = null;
  deferReadback.reset();
  currentPhoneActive.value = false;
  canonical.value = result;
  activationIntent = null;
  deferOutcome.value = null;
  deferNeedsCalibration.value = false;
  deferSyncPending.value = !syncDeferredPhoneActivation(auth.email || auth.accountId || "default") || !completeOnboardingLocally(false);
  if (deferSyncPending.value) {
    phase.value = "error";
    return;
  }
  if (leaveAfterDeferral) {
    leaveAfterDeferral = false;
    toast.info(t.value.onboarding.activationDeferredToast, t.value.onboarding.activationDeferredToastBody);
    navReset({ url: isRecal.value ? "/pages/me/devices" : "/pages/index/index", fail: () => {} });
  } else if (isEstimate.value) {
    goToCalibration();
  } else {
    phase.value = "error";
  }
}

const deferRecovery = useAutoRecovery({
  failed: () => !activationBusy.value && (deferOutcome.value === "unknown" || deferSyncPending.value),
  active: () => nativePhoneAvailable && pageVisible.value,
  async retry() {
    const options = calibrationOptions();
    try {
      const result = await calibrationFlow.read(options);
      if (!options.isCurrent() || activationBusy.value) return;
      if (result?.activationStatus === "DEFERRED") finishDeferral(result);
      else if (deferIntent) {
        if (result && !canonical.value) {
          canonical.value = result;
          if (result.calibrationAvailable && result.calibrationStatus === "MATCHED") phase.value = "result";
        }
        deferReadback.observe();
      }
    } catch (cause) {
      if (!options.isCurrent()) return;
      deferReadback.reset();
      throw cause;
    }
  },
  retryNotBefore: deferReadback.notBefore,
  repeatMs: 30_000,
});

function resendDeferral() {
  if (deferResendAvailable.value) void deferPhoneActivation(true);
}

async function deferPhoneActivation(resend = false) {
  if (!pageVisible.value || activationCompleted || !nativePhoneAvailable || !mounted || activationBusy.value
      || (resend ? !deferResendAvailable.value : !canDefer.value)) return;
  const current = deferOutcome.value === "rejected" ? null : canonical.value;
  if (isEstimate.value && hasCalibration.value) phase.value = "result";
  if (!resend) deferOutcome.value = null;
  busyAction.value = "defer";
  activationBusy.value = true;
  if (resend) requestGeneration += 1;
  const scope = currentScope();
  const options = calibrationOptions(scope);
  let checking = resend;
  try {
    if (resend) {
      deferReadback.reset();
      const latest = await calibrationFlow.read(options);
      if (!options.isCurrent()) return;
      if (latest?.activationStatus === "DEFERRED") { finishDeferral(latest); return; }
      checking = false;
    } else if (isLogin) {
      // Login can mean replacing an existing phone. "NEEDS_CALIBRATION" alone
      // cannot distinguish that from an account which has never bound one.
      if (loginCheckNeeded.value || isRecal.value || canonical.value?.userDeviceId) {
        void navReset({ url: "/pages/index/index", fail: () => {} });
        return;
      }
      const hasBinding = await onboardingCalibrationApi.bindingStatus();
      if (!scopeIsCurrent(scope)) return;
      if (hasBinding) {
        void navReset({ url: "/pages/index/index", fail: () => {} });
        return;
      }
    }
    leaveAfterDeferral = true;
    const result = await confirmDeferredPhoneActivation({
      ...options, initialOnly: isLogin, current,
      accept: (result) => acceptCurrentCanonical(scope, result),
    }, command => { deferIntent = command; }, resend ? deferIntent ?? undefined : undefined);
    if (!options.isCurrent()) return;
    if (result) finishDeferral(result);
    else deferOutcome.value = "unknown";
  } catch (cause) {
    if (!options.isCurrent()) return;
    if (checking) {
      deferOutcome.value = "unknown";
      return;
    }
    deferIntent = null;
    leaveAfterDeferral = false;
    deferOutcome.value = "rejected";
    const code = cause instanceof Error ? cause.message : "";
    deferNeedsCalibration.value = phoneActivationFeedback(code)?.action === "recalibrate";
    const o = t.value.onboarding;
    toast.warn(o.activationDeferRejectedTitle, code === "ONBOARDING_CALIBRATION_REVISION_CONFLICT" ? o.activationDeferRejectedBody : undefined);
  } finally {
    if (isCurrentOnboardingCalibrationScope(scope, currentScope())) activationBusy.value = false;
  }
}
function goHome() {
  navReset({ url: "/pages/index/index", fail: () => {} });
}

function goToEstimate() {
  navReset({ url: ESTIMATE_PAGE, fail: () => {} });
}

function goToCalibration(recalibrate = false) {
  navReset({ url: CALIBRATION_PAGE + (recalibrate ? "?recalibrate=1" : ""), fail: () => {} });
}

function leave() {
  if (backLocked.value) return;
  requestGeneration += 1;
  if (isLogin) goHome();
  else if (isRecal.value) navReset({ url: "/pages/me/devices", fail: () => {} });
  else if (activationIntent) goHome();
  else if (isEstimate.value) goToCalibration();
  else navReset({ url: "/pages/onboarding/intro", fail: () => {} });
}

onMounted(() => { void openFlow(); });
const dialogHoldsBack = useDialogBackHeld();
defineExpose({
  handleBack(event: Parameters<typeof dialogHoldsBack>[0]) {
    if (!dialogHoldsBack(event)) leave();
  },
  receiveDialMotionEnd,
});
onUnmounted(() => {
  mounted = false;
  useUI().clearConfirmsBy(confirmOwner);
  finishScanWait(false);
  finishEntrance();
  requestGeneration += 1;
});
</script>

<script module="dialView" lang="renderjs">
import { calibrationDialView } from "@/lib/calibration-dial-view";
// @ts-expect-error vue-tsc 1.x treats the renderjs block as a second normal script.
export default calibrationDialView;
</script>

<style scoped>
.cn-root { position: fixed; inset: 0; display: flex; flex-direction: column; padding-right: 16px; padding-left: 16px; background: var(--v5-bg); overflow-x: hidden; overflow-y: auto; }

/* Shared onboarding chrome (boards-onboarding; 03 §3.1, 04 §4.0, 10 §10.1). */
.ob-hd { display: flex; align-items: center; gap: 10px; height: 44px; flex: none; }
.ob-back { position: relative; width: 44px; height: 44px; margin-left: -2px; display: grid; place-items: center; flex: none; color: var(--v5-ink); }
/* 03 §3.1 顶部图标动作: its own Liquid Glass round face, as on every sub-page back (SubPageHeader); 40 face, 44 target. */
.ob-back__face { position: relative; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; transition: transform 100ms cubic-bezier(.2, .8, .2, 1); }
.ob-back__face > svg, .ob-back__face > .nx-native-svg { position: relative; z-index: 1; }
[data-theme="light"] .ob-back__face { --ui-control-shadow: var(--v5-glass-shadow); }
.ob-back:active .ob-back__face { transform: scale(.92); }
.ob-back--off { opacity: .5; }
.ob-track { flex: 1; display: flex; gap: 6px; padding-right: 4px; }
/* Step track: done = brand, current = brand 40%, upcoming = ink 8%; one shape, three tones. */
.ob-track__seg { flex: 1; height: 4px; border-radius: 999px; background: color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.ob-track__seg--done { background: var(--v5-brand); }
.ob-track__seg--cur { background: color-mix(in srgb, var(--v5-brand) 40%, transparent); }
.ob-eyebrow { display: block; margin-top: 16px; font: var(--ui-type-chip-weight) var(--ui-type-chip)/var(--ui-type-chip-lh) var(--font-v5); color: var(--v5-brand); white-space: nowrap; }
.ob-title { display: flex; align-items: center; gap: 8px; margin-top: 4px; font: var(--ui-type-page-title-weight) var(--ui-type-page-title)/var(--ui-type-page-title-lh) var(--font-v5); letter-spacing: -.02em; color: var(--v5-ink); }
:lang(zh) .ob-title { letter-spacing: 0; }
.ob-sub { display: block; margin-top: 4px; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
.ob-content { position: relative; flex: 1 0 auto; display: flex; flex-direction: column; margin-top: 20px; }
.ob-rh { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 12px 24px; }
.ob-spin { flex: none; width: 18px; height: 18px; box-sizing: border-box; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: ob-spin .8s linear infinite; }
.ob-spin--s { width: 14px; height: 14px; border-width: 1.8px; }
@keyframes ob-spin { to { transform: rotate(360deg); } }
/* Bottom bar: position here; material, disabled grey glass and tray text come from the shared .nx-glass-bar layer. */
.ob-bar { position: fixed; z-index: 30; display: flex; flex-direction: column; }
.ob-tray-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0 8px; }
.ob-tray-row .ob-btn { flex: 1 0 auto; }
.ob-btn { position: relative; box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 20px; border-radius: 999px; font: var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5); white-space: nowrap; color: var(--ui-tray-disabled-ink); }
.ob-btn :deep(svg), .ob-tray-text :deep(svg) { flex: none; }
.ob-btn--primary { background: var(--v5-brand); color: var(--v5-on-brand); }
.ob-btn--primary:active { transform: scale(.98); }
.ob-btn--glass { color: var(--v5-ink); }
.ob-tray-text { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 12px; flex: none; font: var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5); white-space: nowrap; }
/* The busy secondary keeps full ink (03 §3.1 tray busy); the shared layer greys the disabled view itself, so set it on the children. */
.ob-tray-text[aria-busy="true"] > * { color: var(--v5-ink); }
.ob-btn :deep(text), .ob-tray-text :deep(text), .ob-btn :deep(uni-text), .ob-tray-text :deep(uni-text) { white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .ob-spin { animation: none; } .ob-btn--primary:active, .ob-back:active .ob-back__face { transform: none; } }

/* Standalone sub-page nav: back, centred nav title (10.1 子页导航标题, one line in nine languages at 360). */
.ob-nav { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; height: 44px; flex: none; }
.ob-nav__t { text-align: center; font: var(--ui-type-nav-title-weight) var(--ui-type-nav-title)/var(--ui-type-nav-title-lh) var(--font-v5); color: var(--v5-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cn-content--nav { margin-top: 8px; }
.ob-back--enable { animation: cn-unoff 160ms ease-out both; }
.ob-back--enable { animation-delay: var(--cn-scan-delay); }
/* Title cell: both titles laid out in one grid cell, only one shown, so the row keeps the taller height in every phase. */
.cn-swap { display: grid; }
.cn-swap__t { grid-area: 1 / 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
.cn-swap__t--hide { visibility: hidden; }
.cn-swap__t--out { animation: cn-out 150ms ease-out 800ms both; }
.cn-swap__t--in { animation: cn-rise4 250ms cubic-bezier(.16, 1, .3, 1) 900ms both; }
.cn-swap--scan .cn-swap__t--out { animation-delay: var(--cn-scan-delay); }
.cn-swap--scan .cn-swap__t--in { animation-delay: calc(100ms + var(--cn-scan-delay)); }
/* Dial box: fills the height between the title and the 52px slot; the same box in every dial phase. */
.cn-dialwrap { position: relative; flex: 1 1 auto; display: flex; align-items: center; justify-content: center; }
.cn-slot { position: relative; flex: none; height: 52px; display: flex; justify-content: center; align-items: flex-start; }
/* The rules row rises in from 950ms; like the bar, it is hidden until then, so it can't be tapped, focused or read. */
.cn-slot--enter > * { animation: cn-slot-rise 300ms cubic-bezier(.16, 1, .3, 1) 950ms both; }
.cn-rules { display: flex; justify-content: center; margin-top: 8px; }
.cn-rules--estimate { margin-top: auto; }
/* Pending-write status row (board E13; 10.2 status line): 16px brand spinner, the description role in body ink. */
.cn-status { align-items: center; gap: 8px; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-2); text-align: center; }
.cn-status__spin { width: 16px; height: 16px; color: var(--v5-brand); }
.cn-dial-tag { position: absolute; left: 50%; transform: translateX(-50%); }
.cn-dial-tag__icon { flex: none; margin-right: 4px; }
.cn-dial-tag--anim { animation: cn-fade 300ms ease-out 900ms both; }
.cn-score--from-scan + .cn-dial-tag--anim { animation-duration: 250ms; animation-delay: calc(100ms + var(--cn-scan-delay)); }
.cn-score { position: relative; flex: none; visibility: hidden; }
.cn-score--ready { visibility: visible; }
.cn-score__glow, .cn-score__lens, .cn-score__svg, .cn-score__ctr, .cn-score__num { position: absolute; }
.cn-score__glow { inset: -14%; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-brand) 24%, transparent), color-mix(in srgb, var(--v5-brand) 9%, transparent) 48%, transparent 100%); }
[data-theme="light"] .cn-score__glow { display: none; }
.cn-score--idle .cn-score__glow { display: none; }
.cn-score--scan .cn-score__glow { opacity: var(--cn-glow-opacity, 0); }
.cn-score__lens { left: 50%; top: 50%; transform: translate(-50%, -50%); border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-brand) 9%, transparent), transparent); }
[data-theme="light"] .cn-score__lens { background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-brand) 6%, transparent), transparent); }
.cn-score__svg { inset: 0; }
.cn-score__svg :deep(svg) { display: block; overflow: visible; }
/* Empty dial (start, read-wait, scan): ink ticks and arcs. Result: brand ticks, arcs and inner ring (B1–B8). */
.cn-score__svg :deep(.cn-ticks-base .cn-tick-major) { stroke: var(--v5-ink); stroke-opacity: .3; stroke-width: 1.6; stroke-linecap: round; }
.cn-score__svg :deep(.cn-ticks-base .cn-tick-minor) { stroke: var(--v5-ink); stroke-opacity: .14; stroke-width: 1; stroke-linecap: round; }
.cn-score__svg :deep(.cn-ring-base .cn-arc) { fill: none; stroke: var(--v5-ink); stroke-opacity: .14; stroke-width: 2.4; stroke-linecap: round; }
.cn-score__svg :deep(.cn-ring-base .cn-mark) { stroke: var(--v5-ink); stroke-opacity: .2; stroke-width: 2.4; stroke-linecap: round; }
.cn-score__svg :deep(.cn-ring-base .cn-inner) { fill: none; stroke: var(--v5-ink); stroke-opacity: .12; stroke-width: 1; }
.cn-score__svg :deep(.cn-ticks .cn-tick-major) { stroke: var(--v5-brand); stroke-opacity: .6; stroke-width: 1.6; stroke-linecap: round; }
.cn-score__svg :deep(.cn-ticks .cn-tick-minor) { stroke: var(--v5-brand); stroke-opacity: .32; stroke-width: 1; stroke-linecap: round; }
.cn-score__svg :deep(.cn-ring .cn-arc) { fill: none; stroke: var(--v5-brand); stroke-width: 2.4; stroke-linecap: round; }
.cn-score__svg :deep(.cn-ring .cn-mark) { stroke: var(--v5-brand); stroke-width: 2.4; stroke-linecap: round; }
.cn-score__svg :deep(.cn-ring .cn-inner) { fill: none; stroke: var(--v5-brand); stroke-opacity: .22; stroke-width: 1; }
.cn-score__svg :deep(.cn-sweep__seg) { fill: none; stroke: var(--v5-brand); stroke-width: 2.4; stroke-linecap: round; }
.cn-score__svg :deep(.cn-burst circle) { fill: none; stroke: var(--v5-brand); stroke-width: 2; }
.cn-score__svg :deep(.cn-ring), .cn-score__svg :deep(.cn-sweep), .cn-score__svg :deep(.cn-burst) { transform-origin: 50% 50%; transform-box: view-box; }
.cn-score__svg :deep(.cn-burst) { opacity: 0; }
.cn-score--result .cn-score__svg :deep(.cn-ticks-base), .cn-score--result .cn-score__svg :deep(.cn-ring-base), .cn-score--result .cn-score__ctr { opacity: 0; }
.cn-score--result .cn-score__svg :deep(.cn-sweep) { opacity: 0; }
.cn-score--scan .cn-score__svg :deep(.cn-ticks line) { opacity: 0; }
.cn-score--scan .cn-score__svg :deep(.cn-sweep) { transform: rotate(var(--cn-sweep-at, 0deg)); opacity: var(--cn-sweep-opacity, 1); }
.cn-score--scan .cn-score__ctr { opacity: var(--cn-detecting-opacity, 1); }
.cn-score--scan .cn-score__num { opacity: var(--cn-number-opacity, 0); }
.cn-score__ctr { left: 0; right: 0; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; color: var(--v5-ink-3); }
.cn-score__scan-t { font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; }
.cn-score__num { left: 0; right: 0; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; }
.cn-score__value { display: grid; justify-items: center; }
/* 10.2 校准结果主数字: JetBrains Mono 500, brand, line-height 1; size from the final string. */
.cn-score__v { grid-area: 1 / 1; font-family: var(--font-metric); font-variant-numeric: tabular-nums; font-size: inherit; font-weight: 500; line-height: 1; letter-spacing: -0.02em; color: var(--v5-brand); white-space: nowrap; }
.cn-score__v--final { visibility: hidden; }
.cn-score__u { display: block; max-width: 100%; margin-top: 6px; font-family: var(--font-v5); font-weight: 400; color: var(--v5-ink-3); text-align: center; white-space: nowrap; }
.cn-link { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 2px; height: 44px; margin-top: 8px; padding: 0 8px; font: var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; }
.cn-link--brand { color: var(--v5-brand); }
/* iOS scan: three-node track, only the current node is labelled (04 §4.0). */
.cn-iostrack { display: flex; justify-content: center; margin-top: 8px; }
.cn-iostrack__nd { position: relative; width: 96px; display: flex; flex-direction: column; align-items: center; }
.cn-iostrack__nd::before { content: ""; position: absolute; top: 7px; left: 50%; width: 96px; height: 2px; background: color-mix(in srgb, var(--v5-ink) 10%, transparent); }
.cn-iostrack__nd:last-child::before { display: none; }
.cn-iostrack__dot { position: relative; width: 6px; height: 6px; margin: 5px 0; border-radius: 50%; background: var(--v5-ink-4); }
.cn-iostrack__dot--cur { width: 16px; height: 16px; margin: 0; background: transparent; box-shadow: inset 0 0 0 2px var(--v5-brand); }
.cn-iostrack__dot--cur::after { content: ""; position: absolute; left: 4px; top: 4px; width: 8px; height: 8px; border-radius: 50%; background: var(--v5-brand); }
.cn-iostrack__lb { margin-top: 6px; font: var(--ui-type-chip-weight) var(--ui-type-chip)/var(--ui-type-chip-lh) var(--font-v5); color: var(--v5-brand); white-space: nowrap; }
.cn-slot--scan-end .cn-iostrack { position: absolute; animation: cn-out 150ms linear var(--cn-scan-delay) both; }
.cn-slot--scan-end .cn-rules { animation: cn-slot-rise 300ms cubic-bezier(.16, 1, .3, 1) calc(150ms + var(--cn-scan-delay)) both; }
.cn-probe { visibility: hidden; pointer-events: none; }
/* Result entrance (board S0, once): ink ticks cross-fade into result ticks one by one, the ink ring fades while the brand
   ring turns in and locks, the centre icon fades, the number fades in and counts, the glow fades in, one lock pulse. */
.cn-score--anim.cn-score--result .cn-score__svg :deep(.cn-ticks-base), .cn-score--anim.cn-score--result .cn-score__svg :deep(.cn-ring-base), .cn-score--anim.cn-score--result .cn-score__ctr { opacity: 1; }
.cn-score--anim .cn-score__glow { animation: cn-fade 600ms ease-out both; }
.cn-score--anim .cn-score__svg :deep(.cn-ticks line) { animation: cn-fade 160ms linear both; animation-delay: calc(var(--i) * 8ms); }
.cn-score--anim .cn-score__svg :deep(.cn-ticks-base line) { animation: cn-out 160ms linear both; animation-delay: calc(var(--i) * 8ms); }
.cn-score--anim .cn-score__svg :deep(.cn-ring) { animation: cn-lock 550ms cubic-bezier(.16, 1, .3, 1) 250ms both; }
.cn-score--anim .cn-score__svg :deep(.cn-ring-base) { animation: cn-out 550ms ease-out 250ms both; }
.cn-score--anim .cn-score__ctr { animation: cn-out 120ms ease-out both; }
.cn-score--anim .cn-score__svg :deep(.cn-burst) { animation: cn-burst 450ms ease-out 900ms forwards; }
.cn-score--anim .cn-score__num { animation: cn-fade 250ms ease-out 80ms both; }
.cn-score--from-scan .cn-score__svg :deep(.cn-sweep) { animation: cn-out 160ms linear var(--cn-scan-delay) both; }
.cn-score--from-scan .cn-score__svg :deep(.cn-ring) { animation: cn-lock 350ms cubic-bezier(.16, 1, .3, 1) var(--cn-scan-delay) both; }
.cn-score--from-scan .cn-score__svg :deep(.cn-ring-base) { animation: cn-out 350ms linear var(--cn-scan-delay) both; }
.cn-score--from-scan .cn-score__svg :deep(.cn-burst) { animation: cn-burst 400ms ease-out calc(100ms + var(--cn-scan-delay)) forwards; }
/* Bars during the entrance: from the read-wait, the grey button stays under the final bar (spinner out 0–200ms, label
   recentred by (18 spinner + 8 gap) / 2), then the two cross-fade 1000–1300ms; a tray fades in after the grey button has
   gone (different shapes). From the scan there is no bar yet, so the final bar rises in.
   Board S0: the entrance itself gates the final bar. Its keyframes hold visibility: hidden until the bar starts to show
   (1000ms, the tray 1100ms), so until then it can't be tapped, focused or read; a discrete step, nothing is
   interpolated but opacity and transform. Under reduced motion there is no entrance, so the bar is usable at once.
   The view layer decides this; the App page script cannot read the reduced-motion setting. */
.cn-bar-under { animation: cn-out 300ms ease-out 1000ms both; }
.cn-bar-under--seq { animation: cn-out 150ms ease-out 1000ms both; }
.cn-bar-under .ob-spin { animation: cn-out 200ms ease-out both; }
.cn-bar-under__lbl { display: flex; align-items: center; gap: 8px; animation: cn-shift 250ms cubic-bezier(.16, 1, .3, 1) both; }
.cn-bar--enter { animation: cn-bar-in 300ms ease-out 1000ms both; }
.cn-bar--seq { animation: cn-bar-in 200ms ease-out 1100ms both; }
.cn-bar--rise { animation: cn-bar-rise 300ms cubic-bezier(.16, 1, .3, 1) calc(150ms + var(--cn-scan-delay)) both; }
@keyframes cn-bar-in { from { visibility: hidden; opacity: 0; } to { visibility: visible; opacity: 1; } }
@keyframes cn-bar-rise { from { visibility: hidden; opacity: 0; transform: translateY(8px); } to { visibility: visible; opacity: 1; transform: none; } }
@keyframes cn-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes cn-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes cn-lock { 0% { opacity: 0; transform: rotate(-20deg) scale(1.06); } 100% { opacity: 1; transform: none; } }
@keyframes cn-burst { 0% { opacity: .55; transform: scale(1); } 100% { opacity: 0; transform: scale(1.16); } }
@keyframes cn-rise4 { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes cn-slot-rise { from { visibility: hidden; opacity: 0; transform: translateY(4px); } to { visibility: visible; opacity: 1; transform: none; } }
@keyframes cn-unoff { from { opacity: .5; } to { opacity: 1; } }
@keyframes cn-shift { from { transform: none; } to { transform: translateX(-13px); } }
/* Reduced motion: no entrance, no sweep; the final value at once. */
@media (prefers-reduced-motion: reduce) {
  .cn-score__v--count { visibility: hidden; }
  .cn-score__v--final { visibility: visible; }
  .cn-swap__t--out, .cn-bar-under { display: none; }
  .cn-swap__t--in, .cn-slot--enter > *, .cn-bar--enter, .cn-bar--seq, .cn-bar--rise, .ob-back--enable, .cn-dial-tag--anim { animation: none; }
}
</style>
