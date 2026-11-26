<template>
  <StandalonePageShell class="cn-root" :top-inset="4" :reserve-bottom="false">
    <!-- #ifdef APP-PLUS -->
    <NativeGpuObserver :request="gpuRequest" @observation="gpuReader.receive" />
    <!-- #endif -->
    <!-- Standalone (recalibrate / login): sub-page nav only. Guided: back, step track, step label. -->
    <view v-if="standalone" class="ob-nav">
      <view class="ob-back" role="button" :tabindex="backLocked ? -1 : 0" :aria-disabled="backLocked" :aria-label="t.login.back" :class="{ 'ob-back--off': backLocked, 'ob-back--enable': enterFrom === 'scan' }" @click="leaveConnect" @keydown.enter.prevent="leaveConnect" @keydown.space.prevent="leaveConnect">
        <view class="ob-back__face nx-frosted-button"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></view>
      </view>
      <text class="ob-nav__t" role="heading" aria-level="1">{{ t.onboarding.calibrationTitle }}</text>
      <view />
    </view>
    <template v-else>
      <view class="ob-hd">
        <view class="ob-back" role="button" :tabindex="backLocked ? -1 : 0" :aria-disabled="backLocked" :aria-label="t.login.back" :class="{ 'ob-back--off': backLocked, 'ob-back--enable': enterFrom === 'scan' }" @click="leaveConnect" @keydown.enter.prevent="leaveConnect" @keydown.space.prevent="leaveConnect">
          <view class="ob-back__face nx-frosted-button"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></view>
        </view>
        <view class="ob-track" role="img" :aria-label="t.onboarding.step3of3">
          <view class="ob-track__seg ob-track__seg--done" /><view class="ob-track__seg ob-track__seg--done" /><view class="ob-track__seg ob-track__seg--cur" />
        </view>
      </view>
      <text class="ob-eyebrow" aria-hidden="true">{{ t.onboarding.step3of3 }}</text>
      <!-- Dial phases share one title cell (both titles laid out, one shown), so the dial below never moves. -->
      <view v-if="dialMode" class="ob-title cn-swap" role="heading" aria-level="1">
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
        <view class="cn-dialwrap" :style="{ minHeight: dialGeo.min + 'px' }">
          <view class="cn-score" :class="['cn-score--' + dialMode, { 'cn-score--ready': dialReady, 'cn-score--anim': entering && dialReady, 'cn-score--from-scan': enterFrom === 'scan' }]"
            :role="dialMode === 'idle' ? undefined : 'img'" :aria-hidden="dialMode === 'idle'" :aria-label="dialMode === 'result' ? t.onboarding.resultTitle + ' ' + finalText + ' ' + t.onboarding.phoneComputeUnit : dialMode === 'scan' ? t.onboarding.detecting : undefined"
            :style="{ width: dialSize + 'px', height: dialSize + 'px' }">
            <view class="cn-score__glow" aria-hidden="true" />
            <view class="cn-score__lens" aria-hidden="true" :style="{ width: dialGeo.inner * 2 + 'px', height: dialGeo.inner * 2 + 'px' }" />
            <view class="cn-score__svg" aria-hidden="true"><svg width="100%" height="100%" :viewBox="`0 0 ${dialSize} ${dialSize}`" focusable="false">
              <g class="cn-ticks-base"><line v-for="(tick, i) in dialFace.ticks" :key="'b' + i" :class="tick.major ? 'cn-tick-major' : 'cn-tick-minor'" :style="{ '--i': tickOrder(i) }" :x1="tick.x1" :y1="tick.y1" :x2="tick.x2" :y2="tick.y2" /></g>
              <g class="cn-ring-base"><path v-for="(arc, i) in dialFace.arcs" :key="'ba' + i" class="cn-arc" :d="arc" /><line v-for="(mark, i) in dialFace.marks" :key="'bm' + i" class="cn-mark" :x1="mark.x1" :y1="mark.y1" :x2="mark.x2" :y2="mark.y2" /><circle class="cn-inner" :cx="dialSize / 2" :cy="dialSize / 2" :r="dialGeo.inner" /></g>
              <g v-if="dialMode === 'scan' || enterFrom === 'scan'" class="cn-sweep"><path v-for="(arc, i) in dialFace.sweep" :key="'s' + i" class="cn-sweep__seg" :style="{ strokeOpacity: arc.o }" :d="arc.d" /></g>
              <g v-if="dialMode === 'result'" class="cn-ticks"><line v-for="(tick, i) in dialFace.ticks" :key="'r' + i" :class="tick.major ? 'cn-tick-major' : 'cn-tick-minor'" :style="{ '--i': tickOrder(i) }" :x1="tick.x1" :y1="tick.y1" :x2="tick.x2" :y2="tick.y2" /></g>
              <g v-if="dialMode === 'result'" class="cn-ring"><path v-for="(arc, i) in dialFace.arcs" :key="'ra' + i" class="cn-arc" :d="arc" /><line v-for="(mark, i) in dialFace.marks" :key="'rm' + i" class="cn-mark" :x1="mark.x1" :y1="mark.y1" :x2="mark.x2" :y2="mark.y2" /><circle class="cn-inner" :cx="dialSize / 2" :cy="dialSize / 2" :r="dialGeo.inner" /></g>
              <g v-if="dialMode === 'result'" class="cn-burst"><circle :cx="dialSize / 2" :cy="dialSize / 2" :r="dialGeo.inner" /></g>
            </svg></view>
            <view class="cn-score__ctr" aria-hidden="true">
              <text v-if="dialMode === 'scan' || enterFrom === 'scan'" class="cn-score__scan-t">{{ t.onboarding.detecting }}</text>
              <svg v-else width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M11 18h2" /></svg>
            </view>
            <!-- Count while the entrance runs; under reduced motion the final value shows at once. -->
            <view v-if="dialMode === 'result'" class="cn-score__num" aria-hidden="true">
              <view class="cn-score__value" :style="{ fontSize: dialNumberSize + 'px' }">
                <text class="cn-score__v cn-score__v--count">{{ shownScore }}</text>
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
        <view class="cn-slot" :class="{ 'cn-slot--enter': entering }">
          <!-- Task rules (03 §3.5.1): one row, text and icon are one trigger. -->
          <view v-if="dialMode === 'result'" class="cn-rules"><NxHintBubble :label="t.onboarding.policyTitle" :text="policyLines" /></view>
          <view v-else-if="dialMode === 'scan' && iosPhone" class="cn-iostrack" role="list">
            <view class="cn-iostrack__nd" role="listitem"><view class="cn-iostrack__dot cn-iostrack__dot--cur" /><text class="cn-iostrack__lb">{{ t.onboarding.iosStepIdentify }}</text></view>
            <view class="cn-iostrack__nd" aria-hidden="true"><view class="cn-iostrack__dot" /></view>
            <view class="cn-iostrack__nd" aria-hidden="true"><view class="cn-iostrack__dot" /></view>
          </view>
        </view>
      </template>

      <!-- Result states: NxResultHead is the only title; links sit under it. -->
      <view v-else class="ob-rh">
        <NxResultHead :tone="head.tone" :icon="head.icon" :title="head.title" :description="head.body">
          <view v-if="head.link === 'retry'" class="cn-link cn-link--brand" role="button" :tabindex="activationBusy ? -1 : 0" :aria-disabled="activationBusy" @click="onActivate" @keydown.enter.prevent="onActivate" @keydown.space.prevent="onActivate"><text>{{ t.onboarding.activationRetry }}</text></view>
          <view v-else-if="head.link === 'support'" class="cn-link" role="link" tabindex="0" @click="contactSupport" @keydown.enter.prevent="contactSupport" @keydown.space.prevent="contactSupport"><text>{{ t.onboarding.iosContactSupport }}</text><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></view>
        </NxResultHead>
      </view>
    </view>

    <!-- Read-wait → result: the grey button under the final bar; spinner out, label recentred, then the skins cross-fade. -->
    <view v-if="entering && enterFrom === 'read'" class="ob-bar nx-glass-bar cn-bar-under" :class="{ 'cn-bar-under--seq': bar.kind === 'tray' }" aria-hidden="true">
      <view class="ob-btn" role="button" aria-disabled="true"><view class="ob-spin" /><view class="cn-bar-under__lbl"><text>{{ t.onboarding.activatePhone }}</text><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg></view></view>
    </view>
    <!-- Bottom bar (04 §4.0), by source state and the action in flight. -->
    <view v-if="bar.kind !== 'none'" class="ob-bar nx-glass-bar" :class="{ 'cn-bar--enter': entering && enterFrom === 'read', 'cn-bar--seq': entering && enterFrom === 'read' && bar.kind === 'tray', 'cn-bar--rise': entering && enterFrom === 'scan' }">
      <view v-if="bar.kind === 'status'" class="nx-tray-status" role="status"><text>{{ bar.label }}</text></view>
      <template v-else-if="bar.kind === 'tray'">
        <text v-if="bar.note" class="nx-tray-note">{{ bar.note }}</text>
        <view class="ob-tray-row">
          <view v-if="bar.secondary" class="ob-tray-text nx-tray-text" role="button" :tabindex="bar.secondary.off ? -1 : 0" :aria-disabled="bar.secondary.off" :aria-busy="bar.secondary.busy" @click="bar.secondary.run" @keydown.enter.prevent="bar.secondary.run" @keydown.space.prevent="bar.secondary.run">
            <view v-if="bar.secondary.busy" class="ob-spin ob-spin--s" aria-hidden="true" /><text>{{ bar.secondary.label }}</text>
          </view>
          <view class="ob-btn" :class="{ 'ob-btn--primary': !bar.primary.off }" role="button" :tabindex="bar.primary.off ? -1 : 0" :aria-disabled="bar.primary.off" :aria-busy="bar.primary.busy" data-system-chrome-primary @click="bar.primary.run" @keydown.enter.prevent="bar.primary.run" @keydown.space.prevent="bar.primary.run">
            <view v-if="bar.primary.busy" class="ob-spin" aria-hidden="true" /><text>{{ bar.primary.label }}</text><template v-if="bar.primary.arrow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg></template>
          </view>
        </view>
      </template>
      <view v-else class="ob-btn" :class="{ 'ob-btn--primary': !bar.primary.off && !bar.primary.glass, 'ob-btn--glass nx-frosted-button': bar.primary.glass }" role="button" :tabindex="bar.primary.off ? -1 : 0" :aria-disabled="bar.primary.off" :aria-busy="bar.primary.busy" data-system-chrome-primary @click="bar.primary.run" @keydown.enter.prevent="bar.primary.run" @keydown.space.prevent="bar.primary.run">
        <view v-if="bar.primary.busy" class="ob-spin" aria-hidden="true" /><text>{{ bar.primary.label }}</text><template v-if="bar.primary.arrow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg></template>
      </view>
    </view>
    <!-- Bar reservation for the dial phases: the tallest bar any of them can show here, the iOS result tray (it wraps on long languages). -->
    <view class="ob-bar nx-glass-bar cn-probe" aria-hidden="true">
      <view class="ob-tray-row"><view class="ob-tray-text nx-tray-text"><text>{{ t.onboarding.iosActivateLater }}</text></view><view class="ob-btn ob-btn--primary"><text>{{ t.onboarding.activatePhone }}</text><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg></view></view>
    </view>
    <GlobalUi />
  </StandalonePageShell>
</template>

<script setup lang="ts">
import { navReset, navTo } from "@/lib/route";
import { hasNativeAndroidPhoneRuntime, hasNativePhoneRuntime, nativePhonePlatform } from "@/lib/native-phone-runtime";
import { ref, computed, getCurrentInstance, nextTick, onMounted, onUnmounted, watch } from "vue";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { captureRuntimeRevision, isCurrentRuntimeRevision } from "@/api/order-api";
import { onLoad, onBackPress, onShow, onHide } from "@dcloudio/uni-app";
import StandalonePageShell from "@/components/device/standalone-page-shell.vue";
import GlobalUi from "@/components/global-ui.vue";
import NxHintBubble from "@/components/ui/nx-hint-bubble.vue";
import NxResultHead from "@/components/ui/nx-result-head.vue";
import NxTag from "@/components/ui/nx-tag.vue";
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
const shownScore = ref("0");
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

const iosPending = computed(() => canonical.value?.calibrationStatus === "PENDING_VERIFICATION" && canonical.value.signals?.platform === "ios");
function contactSupport() { if (!activationBusy.value) navTo("/pages/support/messages"); }
const failureFeedback = computed(() => phoneActivationFeedback(failureCode.value));
const supportRequired = computed(() => activationOutcome.value === "idle" && failureFeedback.value?.action === "support");

// Initial onboarding reuses the estimator's canonical result. Only an explicit
// warehouse remeasurement/resume can replace an existing calibration.
const calibrationFlow = createPhoneCalibrationFlow({ api: onboardingCalibrationApi,
  collect: collectCalibrationSignals, key: () => `onboarding:${requireCryptoUuid()}` });
const nativePhoneAvailable = hasNativePhoneRuntime();
const iosPhone = nativePhonePlatform() === "ios";
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
const finalText = computed(() => String(finalScore.value));
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
  const sweep = [[-48, -30, 0.12], [-32, -14, 0.3], [-16, 2, 0.6], [0, 16, 1]].map(([a0, a1, o]) => ({ d: arc(a0, a1), o }));
  return { ticks, arcs, marks, sweep };
});

// ── Placeholders for the logic round (report table: placeholder → meaning → board). Defaults keep today's behaviour. ──
/** C27: entering step 3 only reads the existing result (no collection): empty dial, back works, grey 「激活手机算力」 with a
 *  spinner. While false, the calibrating phase is the scan (C03, back locked) as today. */
const readOnlyWait = ref(false);
/** C32: reading the existing result failed and is retried on its own: empty dial, tray note, grey button, no retry button. */
const resultReadRecovering = ref(false);
/** C28: the receipt read came back empty (no record of this activation) and the phone is confirmed not ACTIVE: offer
 *  「重新激活」 with the original command. While false, an unconfirmed activation stays the read-only wait (C11). */
const receiptNotFound = ref(false);
/** C19 / C30: how the last 「稍后激活」 ended: 'rejected' (toast, page keeps its state), 'unknown' (status capsule while it is read back). */
const deferOutcome = ref<"rejected" | "unknown" | null>(null);
/** Which action the shared activationBusy belongs to, so only that control shows the spinner (03 §3.1). Set by the
 *  controls before they call the existing handlers. */
const busyAction = ref<"activate" | "defer" | null>(null);
const inFlight = computed(() => activationBusy.value ? busyAction.value ?? "activate" : null);
function onActivate() { if (activationBusy.value) return; busyAction.value = "activate"; void activate(); }
function onDefer() { if (activationBusy.value) return; busyAction.value = "defer"; void deferPhoneActivation(); }
/** 「重新校准」 from a failed 「稍后激活」 (C19): the same restart retryCalibration takes for a recalibrate reason. */
function recalibrateNow() {
  if (activationBusy.value) return;
  activationIntent = null;
  calibrationFlow.reset();
  resumeDeferred.value = true;
  phase.value = "calibrating";
}

const standalone = computed(() => isRecal.value || isLogin.value);
type DialMode = "idle" | "scan" | "result";
const dialMode = computed<DialMode | null>(() => !nativePhoneAvailable ? null
  : resultReadRecovering.value ? "idle"
  : phase.value === "intro" ? "idle"
  : phase.value === "calibrating" ? (readOnlyWait.value ? "idle" : "scan")
  : phase.value === "result" ? "result" : null);
const resultActive = computed(() => phase.value === "result" && canonical.value?.activationStatus === "ACTIVE");
const backLocked = computed(() => activationBusy.value || (phase.value === "calibrating" && !readOnlyWait.value));

type HeadIcon = "check" | "return" | "clock" | "failed" | "alert";
type Head = { tone: "success" | "warning" | "neutral" | "danger"; icon: HeadIcon; title: string; body?: string; link?: "retry" | "support" };
const head = computed<Head>(() => {
  const o = t.value.onboarding;
  if (!nativePhoneAvailable) return { tone: "neutral", icon: "alert", title: o.nonNativeTitle };
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
    if (feedback.action === "terms") return { tone: "danger", icon: "failed", title: o.rejectTitleTerms, body };
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
  // A failed 「稍后激活」 says only that; whether the server refused or the result is unknown is wired later (deferOutcome).
  if (failedAction.value === "defer") return { tone: "warning", icon: "alert", title: o.activationDeferRejectedTitle };
  if (failedAction.value === "calibration") return { tone: "warning", icon: "alert", title: o.calibrationFailedTitle, body: o.activationLaterBody };
  return { tone: "danger", icon: "failed", title: o.activationFailedTitle, body: o.phoneActivationRejected };
});

type BarButton = { label: string; run: () => void; off?: boolean; busy?: boolean; arrow?: boolean; glass?: boolean };
type Bar = { kind: "none" } | { kind: "status"; label: string } | { kind: "float"; primary: BarButton }
  | { kind: "tray"; primary: BarButton; secondary?: BarButton; note?: string };
// The bar follows the source state and the action in flight: only the busy control spins, the others are locked (03 §3.1).
const bar = computed<Bar>(() => {
  const o = t.value.onboarding, busy = activationBusy.value;
  const later = (): BarButton | undefined => canDefer.value
    ? { label: o.iosActivateLater, run: onDefer, off: busy, busy: inFlight.value === "defer" } : undefined;
  const main = (label: string, run: () => void, arrow = false): BarButton => ({ label, run, arrow, off: busy, busy: inFlight.value === "activate" });
  const pair = (primary: BarButton): Bar => { const secondary = later(); return secondary ? { kind: "tray", primary, secondary } : { kind: "float", primary }; };
  if (!nativePhoneAvailable) return { kind: "float", primary: { label: t.value.login.back, run: leaveConnect, glass: true } };
  if (resultReadRecovering.value) return { kind: "tray", note: o.resultReadFailed, primary: { label: o.activatePhone, run: () => {}, off: true, arrow: true } };
  if (phase.value === "intro") return { kind: "float", primary: { label: o.calibrationStart, run: () => { phase.value = "calibrating"; } } };
  if (phase.value === "calibrating") return readOnlyWait.value
    ? { kind: "float", primary: { label: o.activatePhone, run: () => {}, off: true, busy: true, arrow: true } } : { kind: "none" };
  if (phase.value === "result") {
    if (deferOutcome.value === "unknown") return { kind: "status", label: o.activationDeferUnknown };
    if (canonical.value?.activationStatus === "ACTIVE") return { kind: "float", primary: main(t.value.ui.notFoundCta, onActivate) };
    if (inFlight.value === "activate") return { kind: "float", primary: { label: o.activationProcessing, run: () => {}, off: true, busy: true } };
    const primary = main(o.activatePhone, onActivate, true);
    const secondary = iosPhone ? later() : undefined;
    return secondary ? { kind: "tray", primary, secondary } : { kind: "float", primary };
  }
  if (activationOutcome.value === "active") return { kind: "float", primary: main(o.phoneActivationSyncAction, () => { void retryCalibration(); }) };
  if (activationOutcome.value === "unconfirmed") return receiptNotFound.value ? { kind: "float", primary: main(o.reactivateAction, onActivate) } : { kind: "none" };
  const retry = () => { if (!activationBusy.value) { busyAction.value = "activate"; void retryCalibration(); } };
  if (activationOutcome.value === "preflight-unconfirmed") return pair(main(o.activationRetry, retry));
  const action = failureFeedback.value?.action;
  if (action === "devices") return pair(main(o.phoneActivationManageDevices, retry, true));
  if (supportRequired.value) return pair(main(o.iosContactSupport, retry, true));
  if (action === "terms") return pair(main(o.phoneActivationTermsAction, retry, true));
  if (action === "login") return pair(main(o.phoneActivationLoginAction, retry, true));
  if (action === "recalibrate" || iosPending.value || (!action && (failedAction.value === "calibration" || canonical.value?.calibrationStatus === "PENDING_VERIFICATION")))
    return pair(main(o.iosRecalibrate, retry));
  if (failedAction.value === "defer") return { kind: "tray", secondary: { label: o.iosActivateLater, run: retry, off: busy, busy: inFlight.value === "activate" }, primary: { label: o.iosRecalibrate, run: recalibrateNow, off: busy } };
  return pair(main(o.activationRetry, retry));
});

// Dial: measured once when it first shows (the box is the same in every dial phase); one ready starts the CSS entrance and
// the count on Android and iOS alike.
const pageInstance = getCurrentInstance();
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
function measureBar() {
  if (!pageInstance?.proxy) return;
  uni.createSelectorQuery().in(pageInstance.proxy).select(".ob-bar:not(.cn-probe):not(.cn-bar-under)").boundingClientRect().exec((boxes: (UniApp.NodeInfo | null)[]) => {
    barClearance.value = boxes[0]?.height ? Math.ceil(boxes[0].height) + 38 : 24;
  });
}
watch([dialMode, () => bar.value.kind, () => t.value.onboarding.iosActivateLater], ([mode]) => {
  void nextTick(() => {
    if (mode && !dialMeasured) measureDial();
    if (!mode) measureBar();
    if (mode === "result") { dialUnitSize.value = dialGeo.unit; void nextTick(fitUnit); }
  });
}, { immediate: true, flush: "post" });

// Entrance (board S0): from the read-wait dial or from the live scan into the result, once; transform and opacity only.
const entering = ref(false);
const enterFrom = ref<"read" | "scan" | null>(null);
let enterTimer: ReturnType<typeof setTimeout> | null = null;
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
watch(phase, (next, previous) => {
  if (enterTimer) clearTimeout(enterTimer);
  enterTimer = null;
  if (next === "result" && previous === "calibrating" && !reducedMotion()) {
    enterFrom.value = readOnlyWait.value ? "read" : "scan";
    entering.value = true;
    enterTimer = setTimeout(() => { entering.value = false; enterFrom.value = null; }, 1400);
  } else {
    entering.value = false;
    enterFrom.value = null;
  }
});
// The count runs 100–1000ms with ease-out and the final value's decimals; the server value is the only figure shown at rest.
watch([phase, finalScore, entering, dialReady], ([next, score, running, ready]) => {
  if (scoreTimer) clearInterval(scoreTimer);
  scoreTimer = null;
  if (next !== "result") { shownScore.value = "0"; return; }
  const target = Math.max(0, score), places = (String(target).split(".")[1] ?? "").length;
  if (!running || !ready) { shownScore.value = String(target); return; }
  const start = Date.now();
  shownScore.value = (0).toFixed(places);
  scoreTimer = setInterval(() => {
    const progress = Math.max(0, Math.min(1, (Date.now() - start - 100) / 900));
    shownScore.value = progress === 1 ? String(target) : (target * (1 - (1 - progress) ** 3)).toFixed(places);
    if (progress === 1 && scoreTimer) { clearInterval(scoreTimer); scoreTimer = null; }
  }, 30);
}, { immediate: true });
// The sweep stops where it is and the tick conversion runs clockwise from its head (tick 11 at the frozen 55°).
const SCAN_HEAD = 11;
function tickOrder(i: number) { return enterFrom.value === "scan" ? (i - SCAN_HEAD + 72) % 72 : i; }
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
        toast.error(head.value.title, head.value.body);
      }
    } else if (outcome.rejection) {
      activationIntent = null; activationOutcome.value = "idle";
      failureCode.value = outcome.rejection; failedAction.value = "activate"; phase.value = "error";
      toast.error(head.value.title, head.value.body);
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
    toast.info(t.value.onboarding.activationDeferredToast, t.value.onboarding.activationDeferredToastBody);
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
  if (backLocked.value) return;
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
  if (enterTimer) clearTimeout(enterTimer);
  requestGeneration += 1;
});
</script>

<style scoped>
.cn-root { position: fixed; inset: 0; display: flex; flex-direction: column; padding-right: 16px; padding-left: 16px; background: var(--v5-bg); overflow-x: hidden; overflow-y: auto; }

/* Shared onboarding chrome (boards-onboarding; 03 §3.1, 04 §4.0, 10 §10.1). */
.ob-hd { display: flex; align-items: center; gap: 10px; height: 44px; flex: none; }
.ob-back { position: relative; width: 44px; height: 44px; margin-left: -2px; display: grid; place-items: center; flex: none; color: var(--v5-ink); }
.ob-back__face { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; }
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
.ob-skel { display: inline-block; vertical-align: middle; border-radius: 8px; background: color-mix(in srgb, var(--v5-ink) 9%, transparent); }
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
@media (prefers-reduced-motion: reduce) { .ob-spin { animation: none; } .ob-btn--primary:active { transform: none; } }

/* Standalone sub-page nav: back, centred nav title (10.1 子页导航标题, one line in nine languages at 360). */
.ob-nav { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; height: 44px; flex: none; }
.ob-nav__t { text-align: center; font: var(--ui-type-nav-title-weight) var(--ui-type-nav-title)/var(--ui-type-nav-title-lh) var(--font-v5); color: var(--v5-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cn-content--nav { margin-top: 8px; }
.ob-back--enable { animation: cn-unoff 160ms ease-out both; }
/* Title cell: both titles laid out in one grid cell, only one shown, so the row keeps the taller height in every phase. */
.cn-swap { display: grid; }
.cn-swap__t { grid-area: 1 / 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
.cn-swap__t--hide { visibility: hidden; }
.cn-swap__t--out { animation: cn-out 150ms ease-out 800ms both; }
.cn-swap__t--in { animation: cn-rise4 250ms cubic-bezier(.16, 1, .3, 1) 900ms both; }
/* Dial box: fills the height between the title and the 52px slot; the same box in every dial phase. */
.cn-dialwrap { position: relative; flex: 1 1 auto; display: flex; align-items: center; justify-content: center; }
.cn-slot { flex: none; height: 52px; display: flex; justify-content: center; align-items: flex-start; }
.cn-slot--enter > * { animation: cn-rise4 300ms cubic-bezier(.16, 1, .3, 1) 950ms both; }
.cn-rules { display: flex; justify-content: center; margin-top: 8px; }
.cn-dial-tag { position: absolute; left: 50%; transform: translateX(-50%); }
.cn-dial-tag__icon { flex: none; margin-right: 4px; }
.cn-dial-tag--anim { animation: cn-fade 300ms ease-out 900ms both; }
.cn-score { position: relative; flex: none; visibility: hidden; }
.cn-score--ready { visibility: visible; }
.cn-score__glow, .cn-score__lens, .cn-score__svg, .cn-score__ctr, .cn-score__num { position: absolute; }
.cn-score__glow { inset: -14%; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-brand) 24%, transparent), color-mix(in srgb, var(--v5-brand) 9%, transparent) 48%, transparent 100%); }
[data-theme="light"] .cn-score__glow { display: none; }
.cn-score--idle .cn-score__glow, .cn-score--scan .cn-score__glow { display: none; }
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
.cn-score__svg :deep(.cn-ticks .cn-tick-minor) { stroke: var(--v5-ink); stroke-opacity: .18; stroke-width: 1; stroke-linecap: round; }
.cn-score__svg :deep(.cn-ring .cn-arc) { fill: none; stroke: var(--v5-brand); stroke-width: 2.4; stroke-linecap: round; }
.cn-score__svg :deep(.cn-ring .cn-mark) { stroke: var(--v5-brand); stroke-width: 2.4; stroke-linecap: round; }
.cn-score__svg :deep(.cn-ring .cn-inner) { fill: none; stroke: var(--v5-brand); stroke-opacity: .22; stroke-width: 1; }
.cn-score__svg :deep(.cn-sweep__seg) { fill: none; stroke: var(--v5-brand); stroke-width: 2.4; stroke-linecap: round; }
.cn-score__svg :deep(.cn-burst circle) { fill: none; stroke: var(--v5-brand); stroke-width: 2; }
.cn-score__svg :deep(.cn-ring), .cn-score__svg :deep(.cn-sweep), .cn-score__svg :deep(.cn-burst) { transform-origin: 50% 50%; transform-box: view-box; }
.cn-score__svg :deep(.cn-burst) { opacity: 0; }
.cn-score--result .cn-score__svg :deep(.cn-ticks-base), .cn-score--result .cn-score__svg :deep(.cn-ring-base), .cn-score--result .cn-score__ctr { opacity: 0; }
.cn-score--result .cn-score__svg :deep(.cn-sweep) { opacity: 0; }
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
.cn-probe { visibility: hidden; pointer-events: none; }
/* Scan: the sweep turns until the result returns (the only loop on this page). */
.cn-score--scan .cn-score__svg :deep(.cn-sweep) { animation: cn-spin 1.6s linear infinite; }
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
.cn-score--anim.cn-score--from-scan .cn-score__svg :deep(.cn-sweep) { opacity: 1; transform: rotate(38deg); animation: cn-out 160ms ease-out both; }
/* Bars during the entrance: from the read-wait, the grey button stays under the final bar (spinner out 0–200ms, label
   recentred by (18 spinner + 8 gap) / 2), then the two cross-fade 1000–1300ms; a tray fades in after the grey button has
   gone (different shapes). From the scan there is no bar yet, so the final bar rises in. */
.cn-bar-under { animation: cn-out 300ms ease-out 1000ms both; }
.cn-bar-under--seq { animation: cn-out 150ms ease-out 1000ms both; }
.cn-bar-under .ob-spin { animation: cn-out 200ms ease-out both; }
.cn-bar-under__lbl { display: flex; align-items: center; gap: 8px; animation: cn-shift 250ms cubic-bezier(.16, 1, .3, 1) both; }
.cn-bar--enter { animation: cn-fade 300ms ease-out 1000ms both; }
.cn-bar--seq { animation: cn-fade 200ms ease-out 1100ms both; }
.cn-bar--rise { animation: cn-rise8 300ms cubic-bezier(.16, 1, .3, 1) 1000ms both; }
@keyframes cn-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes cn-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes cn-lock { 0% { opacity: 0; transform: rotate(-20deg) scale(1.06); } 100% { opacity: 1; transform: none; } }
@keyframes cn-burst { 0% { opacity: .55; transform: scale(1); } 100% { opacity: 0; transform: scale(1.16); } }
@keyframes cn-spin { to { transform: rotate(360deg); } }
@keyframes cn-rise4 { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes cn-rise8 { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes cn-unoff { from { opacity: .5; } to { opacity: 1; } }
@keyframes cn-shift { from { transform: none; } to { transform: translateX(-13px); } }
/* Reduced motion: no entrance, no sweep; the final value at once. */
@media (prefers-reduced-motion: reduce) {
  .cn-score__v--count { visibility: hidden; }
  .cn-score__v--final { visibility: visible; }
  .cn-score--scan .cn-score__svg :deep(.cn-sweep) { animation: none; }
  .cn-swap__t--out, .cn-bar-under { display: none; }
  .cn-swap__t--in, .cn-slot--enter > *, .cn-bar--enter, .cn-bar--seq, .cn-bar--rise, .ob-back--enable, .cn-dial-tag--anim { animation: none; }
}
</style>
