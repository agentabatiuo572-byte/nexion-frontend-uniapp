<template>
  <StandalonePageShell class="est-root" :top-inset="4" :reserve-bottom="false">
    <!-- #ifdef APP-PLUS -->
    <NativeGpuObserver :request="gpuRequest" @observation="gpuReader.receive" />
    <!-- #endif -->
    <!-- Guided header: back, the three-step track (done / current / upcoming), the step label. -->
    <view class="ob-hd">
      <view class="ob-back" role="button" :tabindex="deferBusy ? -1 : 0" :aria-disabled="deferBusy" :aria-label="t.login.back" :class="{ 'ob-back--off': deferBusy }" @click="leaveEstimator" @keydown.enter.prevent="leaveEstimator" @keydown.space.prevent="leaveEstimator">
        <view class="ob-back__face nx-design-glass">
          <LiquidGlass :radius="20" tone="navigation" :blur="8" />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </view>
      </view>
      <view class="ob-track" role="img" :aria-label="t.onboarding.step2of3">
        <view class="ob-track__seg ob-track__seg--done" /><view class="ob-track__seg ob-track__seg--cur" /><view class="ob-track__seg" />
      </view>
    </view>
    <text class="ob-eyebrow" aria-hidden="true">{{ t.onboarding.step2of3 }}</text>
    <!-- A result state has the result head as its only title (NxResultHead); the estimate keeps the page title. -->
    <template v-if="estimateShown">
      <text class="ob-title" role="heading" aria-level="1">{{ t.onboarding.estimatorTitleH }}</text>
      <text class="ob-sub">{{ t.onboarding.estimatorHint }}</text>
    </template>

    <view class="ob-content" :style="{ paddingBottom: barClearance + 'px' }">
      <template v-if="estimateShown">
        <!-- Focal card: the same five rows at fixed heights while loading, failed, pending or detected, so nothing moves. -->
        <view class="est-hero nx-soft-glass" :class="{ 'anim-up': view === 'detected' }">
          <view class="est-hero__art" aria-hidden="true">
            <view class="est-hero__floor" />
            <image class="est-hero__img" src="/static/img/home-glass-20260928/phone.webp" mode="aspectFit" />
          </view>
          <view class="est-hero__body">
            <view class="est-hero__top">
              <text class="est-hero__name">{{ t.onboarding.yourPhone }}</text>
              <NxTag tone="success" class="est-hero__tag" :class="{ 'est-hero__tag--skel': view === 'loading' || view === 'write-pending', 'est-hero__tag--ghost': view === 'read-failed' }" :aria-hidden="view !== 'detected'">
                <svg class="est-hero__tag-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>{{ t.onboarding.detected }}
              </NxTag>
            </view>
            <text class="est-hero__k">{{ t.bundle.estimatedDaily }}</text>
            <template v-if="view === 'loading' || view === 'write-pending'">
              <view class="est-amt"><view class="ob-skel" style="width: 112px; height: 32px" /></view>
              <view class="est-amt2"><view class="ob-skel" style="width: 72px; height: 14px" /></view>
              <view class="est-basis est-basis--status" role="status">
                <view class="ob-spin ob-spin--s est-basis__spin" aria-hidden="true" />
                <text class="est-basis__t">{{ view === 'write-pending' ? t.onboarding.calibrationWritePending : detectingText }}</text>
              </view>
            </template>
            <template v-else-if="view === 'read-failed'">
              <view class="est-amt est-amt--unknown" :aria-label="'—' + usdtPerDay"><text>—</text><text class="est-amt__u">{{ usdtPerDay }}</text></view>
              <view class="est-amt2" :aria-label="'—' + uvtPerDay"><text>—</text><text class="est-amt2__u">{{ uvtPerDay }}</text></view>
              <text class="est-basis"><text class="est-basis__v est-basis__v--unknown">—</text>{{ '\u00A0' + t.onboarding.phoneComputeUnit }}</text>
            </template>
            <template v-else>
              <view class="est-amt" :aria-label="phoneUsdtLabel + usdtPerDay">
                <text class="est-amt__int" aria-hidden="true">{{ phoneUsdtParts.int }}</text><text v-if="phoneUsdtParts.dec" class="est-amt__dec" aria-hidden="true">{{ phoneUsdtParts.dec }}</text><text class="est-amt__u" aria-hidden="true">{{ usdtPerDay }}</text>
              </view>
              <view class="est-amt2" :aria-label="phoneUvtLabel + uvtPerDay">
                <text aria-hidden="true">{{ phoneUvtLabel }}</text><text class="est-amt2__u" aria-hidden="true">{{ uvtPerDay }}</text>
              </view>
              <text class="est-basis"><text class="est-basis__v">{{ calibration?.computeValue ?? '—' }}</text>{{ '\u00A0' + t.onboarding.phoneComputeUnit }}</text>
            </template>
          </view>
        </view>

        <!-- Device comparison: text and a ratio bar per row (no SKU identity, so no device image); unit and period once in the column head. -->
        <template v-if="view !== 'detected' || compareRows.length">
          <text class="est-sec">{{ t.onboarding.unlockMore }}</text>
          <view class="est-list" :class="{ 'anim-up-delay': view === 'detected' }" :role="view === 'detected' ? 'list' : undefined">
            <view class="est-list__head" aria-hidden="true"><text>{{ t.onboarding.colModel }}</text><text>{{ 'USDT' + t.onboarding.perDay }}</text></view>
            <template v-if="view === 'detected'">
              <view v-for="row in compareRows" :key="row.key" class="est-row" role="listitem" :aria-label="row.label + ', ' + row.times + ', ' + row.value + usdtPerDay">
                <view class="est-row__t" aria-hidden="true">
                  <text class="est-row__n">{{ row.label }}</text>
                  <text class="est-row__s">{{ row.times }}</text>
                </view>
                <text class="est-row__v" aria-hidden="true">{{ row.value }}</text>
                <view v-if="compareRows.length > 1" class="est-row__bar nx-progress" aria-hidden="true" :aria-valuenow="row.pct"><view class="nx-progress__fill nx-viz-grow" :style="{ width: row.pct + '%' }" /></view>
              </view>
            </template>
            <template v-else>
              <view v-for="n in 2" :key="n" class="est-row est-row--skel" aria-hidden="true">
                <view class="est-row__t"><view class="est-row__n"><view class="ob-skel" style="width: 128px; height: 14px" /></view><view class="est-row__s"><view class="ob-skel" style="width: 96px; height: 12px" /></view></view>
                <view class="est-row__v"><view class="ob-skel" style="width: 36px; height: 16px" /></view>
                <view class="est-row__bar nx-progress" />
              </view>
            </template>
          </view>
        </template>
      </template>

      <!-- Result states: NxResultHead is the only title. -->
      <view v-else class="ob-rh">
        <NxResultHead v-if="view === 'nonnative'" tone="neutral" icon="alert" :title="t.onboarding.nonNativeTitle" />
        <NxResultHead v-else-if="view === 'deferred'" tone="neutral" icon="return" :title="t.onboarding.activationDeferredTitle" :description="t.onboarding.activationLaterBody" />
        <NxResultHead v-else tone="warning" :icon="pendingKind ? 'clock' : 'alert'" :title="unavailableTitle" :description="unavailableBody" />
      </view>
    </view>

    <!-- Bottom bar (04 §4.0): the shared layer picks the floating button, the status capsule or the tray from what is rendered. -->
    <view class="ob-bar nx-glass-bar" :class="{ 'ob-bar--tray': barIsTray }">
      <template v-if="view === 'nonnative'">
        <view class="ob-btn ob-btn--glass nx-frosted-button" role="button" tabindex="0" data-system-chrome-primary @click="leaveEstimator" @keydown.enter.prevent="leaveEstimator" @keydown.space.prevent="leaveEstimator"><text>{{ t.login.back }}</text></view>
      </template>
      <!-- A write the server never confirmed, after three read-backs: the same command can be sent again (03 §3.5.2). -->
      <template v-else-if="deferResendAvailable">
        <text class="nx-tray-note">{{ t.onboarding.activationDeferResendBody }}</text>
        <view class="ob-tray-row">
          <view class="ob-btn ob-btn--primary" role="button" tabindex="0" data-system-chrome-primary @click="resendDeferral" @keydown.enter.prevent="resendDeferral" @keydown.space.prevent="resendDeferral"><text>{{ t.onboarding.iosActivateLater }}</text></view>
        </view>
      </template>
      <view v-else-if="deferOutcome === 'unknown'" class="nx-tray-status" role="status"><text>{{ t.onboarding.activationDeferUnknown }}</text></view>
      <template v-else-if="view === 'deferred'">
        <view class="ob-tray-row">
          <view class="ob-tray-text nx-tray-text" role="button" :tabindex="deferBusy ? -1 : 0" :aria-disabled="deferBusy" :aria-busy="deferBusy" @click="deferPhoneActivation" @keydown.enter.prevent="deferPhoneActivation" @keydown.space.prevent="deferPhoneActivation">
            <view v-if="deferBusy" class="ob-spin ob-spin--s" aria-hidden="true" /><text>{{ t.ui.notFoundCta }}</text>
          </view>
          <view class="ob-btn" :class="{ 'ob-btn--primary': !deferBusy }" role="button" :tabindex="deferBusy ? -1 : 0" :aria-disabled="deferBusy" data-system-chrome-primary @click="retryCalibration" @keydown.enter.prevent="retryCalibration" @keydown.space.prevent="retryCalibration">
            <text>{{ t.onboarding.calibrationStart }}</text><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </view>
        </view>
      </template>
      <template v-else-if="view === 'unavailable'">
        <view class="ob-tray-row">
          <view class="ob-tray-text nx-tray-text" role="button" :tabindex="deferBusy ? -1 : 0" :aria-disabled="deferBusy" :aria-busy="deferBusy" @click="deferPhoneActivation" @keydown.enter.prevent="deferPhoneActivation" @keydown.space.prevent="deferPhoneActivation">
            <view v-if="deferBusy" class="ob-spin ob-spin--s" aria-hidden="true" /><text>{{ t.onboarding.iosActivateLater }}</text>
          </view>
          <view class="ob-btn" :class="{ 'ob-btn--primary': !deferBusy }" role="button" :tabindex="deferBusy ? -1 : 0" :aria-disabled="deferBusy" data-system-chrome-primary @click="retryCalibration" @keydown.enter.prevent="retryCalibration" @keydown.space.prevent="retryCalibration">
            <text>{{ t.onboarding.iosRecalibrate }}</text>
          </view>
        </view>
      </template>
      <template v-else-if="view === 'read-failed'">
        <text class="nx-tray-note">{{ t.onboarding.estimateReadFailed }}</text>
        <view class="ob-tray-row">
          <view class="ob-btn" role="button" tabindex="-1" aria-disabled="true"><text>{{ t.onboarding.startEarning }}</text><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg></view>
        </view>
      </template>
      <template v-else-if="calibrationResendAvailable">
        <text class="nx-tray-note">{{ t.onboarding.calibrationResendBody }}</text>
        <view class="ob-tray-row">
          <view class="ob-btn ob-btn--primary" role="button" tabindex="0" data-system-chrome-primary @click="resendCalibration" @keydown.enter.prevent="resendCalibration" @keydown.space.prevent="resendCalibration"><text>{{ t.onboarding.calibrationResendAction }}</text></view>
        </view>
      </template>
      <view v-else class="ob-btn" :class="{ 'ob-btn--primary': view === 'detected' }" role="button" :tabindex="view === 'detected' ? 0 : -1" :aria-disabled="view !== 'detected'" :aria-busy="view !== 'detected'" data-system-chrome-primary @click="goConnect" @keydown.enter.prevent="goConnect" @keydown.space.prevent="goConnect">
        <view v-if="view !== 'detected'" class="ob-spin" aria-hidden="true" /><text>{{ estimatePrimaryLabel }}</text><template v-if="!currentPhoneActive"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg></template>
      </view>
    </view>
    <ToastHost />
  </StandalonePageShell>
</template>

<script setup lang="ts">
import { toast } from "@/store/ui";
import ToastHost from "@/components/toast-host.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import NxResultHead from "@/components/ui/nx-result-head.vue";
import LiquidGlass from "@/components/liquid-glass.vue";
import { formatEstimate } from "@/lib/estimate-display";
import { navReset } from "@/lib/route";
import { onBackPress, onHide, onLoad, onShow } from "@dcloudio/uni-app";
import { ref, computed, getCurrentInstance, nextTick, onMounted, onUnmounted, watch } from "vue";
import StandalonePageShell from "@/components/device/standalone-page-shell.vue";
import { useT } from "@/i18n/use-t";
import { getDeviceId } from "@/lib/device-id";
import { hasNativeAndroidPhoneRuntime, hasNativePhoneRuntime, nativePhonePlatform } from "@/lib/native-phone-runtime";
import { onboardingCalibrationApi, remoteApiEnabled } from "@/api/runtime";
import type { OnboardingCalibration } from "@/api/onboarding-calibration-api";
import { useApp } from "@/store/app";
import { useSession } from "@/store/session";
import { useAuth } from "@/store/auth";
import { markAuthAccountOnboardingComplete } from "@/store/auth-account";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import type { RemoteAccountRequest } from "@/lib/remote-account-epoch";
import { createEstimatorScope, isCurrentEstimatorScope, type EstimatorScope } from "@/lib/estimator-scope";
import { createPhoneWriteReadback, finishPhoneCommand, readPhoneCommand, type PhoneCommand } from "@/lib/phone-onboarding-commands";
import { readCurrentPhoneActive } from "@/lib/phone-onboarding-authority";
import { confirmDeferredPhoneActivation, syncDeferredPhoneActivation } from "@/lib/defer-phone-activation";
import { phoneActivationFeedback } from "@/lib/phone-activation-feedback";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
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
import { calibrationBelongsTo, createPhoneCalibrationFlow } from "@/lib/phone-calibration-flow";

const t = useT();
const app = useApp();
const auth = useAuth();
const detected = ref(false);
const loadFailed = ref(false);
const deferred = ref(false);
const loading = ref(false);
const deferBusy = ref(false);
const calibration = ref<OnboardingCalibration | null>(null);
const iosPending = computed(() => calibration.value?.calibrationStatus === "PENDING_VERIFICATION" && calibration.value.signals?.platform === "ios");
const comparison = (key: string) => computed(() => calibration.value?.comparisonConfig.find((item) => item.key === key) ?? null);
const phone = comparison("phone");
const s1 = comparison("s1");
const pro = comparison("pro");
const phoneRate = computed(() => calibration.value?.baseRateUsdt ?? phone.value?.dailyUsdt ?? null);
const phoneUvt = computed(() => calibration.value?.baseRateNex ?? phone.value?.dailyNex ?? null);
// Estimates show two significant figures (06 §6.2, formatEstimate); ratios and bars use the raw daily USDT.
const phoneUsdtLabel = computed(() => phoneRate.value === null ? "—" : formatEstimate(phoneRate.value));
const phoneUsdtParts = computed(() => { const [int, dec] = phoneUsdtLabel.value.split("."); return { int, dec: dec ? `.${dec}` : "" }; });
const phoneUvtLabel = computed(() => phoneUvt.value === null ? "—" : formatEstimate(phoneUvt.value));
// Number and unit never part (03 §3.6.1): the unit is joined with a no-break space, on screen and in the spoken label.
const usdtPerDay = computed(() => "\u00A0USDT" + t.value.onboarding.perDay);
const uvtPerDay = computed(() => "\u00A0UVT" + t.value.onboarding.perDay);
const compareRows = computed(() => {
  const rows = [s1.value, pro.value].filter((row): row is NonNullable<typeof row> => row !== null);
  const max = Math.max(0, ...rows.map((row) => row.dailyUsdt));
  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    value: formatEstimate(row.dailyUsdt),
    times: phoneRate.value ? t.value.onboarding.timesPhoneDaily.replace("{n}", String(Math.round(row.dailyUsdt / phoneRate.value))) : "",
    pct: max > 0 ? Math.round(row.dailyUsdt / max * 1000) / 10 : 0,
  }));
});

let timer: ReturnType<typeof setTimeout> | undefined;
let mounted = false;
const pageVisible = ref(true);
onShow(() => { pageVisible.value = true; });
onHide(() => { pageVisible.value = false; });
let accountEpoch = 0;
let generation = 0;
let accountWatchKey = String(app.accountKey || "");
const calibrationFlow = createPhoneCalibrationFlow({ api: onboardingCalibrationApi,
  collect: collectCalibrationSignals });
const nativePhoneAvailable = hasNativePhoneRuntime();
const iosPhone = nativePhonePlatform() === "ios";
const detectingText = computed(() => iosPhone ? t.value.onboarding.iosIdentifying : t.value.onboarding.detecting);

const estimateReadRecovering = ref(false);
const calibrationWritePending = ref(false);
const deferOutcome = ref<"rejected" | "unknown" | null>(null);
const deferSyncPending = ref(false);
let deferNeedsCalibration = false;
let recalibrationRequested = false;
let deferIntent: PhoneCommand<"defer"> | null = null;
const calibrationReadback = createPhoneWriteReadback();
const deferReadback = createPhoneWriteReadback();
const calibrationResendAvailable = computed(() => calibrationWritePending.value && calibrationReadback.resendAvailable.value && !loading.value);
const deferResendAvailable = computed(() => deferOutcome.value === "unknown" && deferReadback.resendAvailable.value && !deferBusy.value);
const currentPhoneActive = ref(false);
const estimatePrimaryLabel = computed(() => currentPhoneActive.value ? t.value.ui.notFoundCta : t.value.onboarding.startEarning);
let leaveAfterDeferral = false;

type EstimatorView = "nonnative" | "loading" | "write-pending" | "read-failed" | "detected" | "unavailable" | "deferred";
const view = computed<EstimatorView>(() => !nativePhoneAvailable ? "nonnative"
  : deferred.value ? "deferred"
  : estimateReadRecovering.value ? "read-failed"
  : calibrationWritePending.value ? "write-pending"
  : loadFailed.value ? "unavailable"
  : detected.value ? "detected" : "loading");
const estimateShown = computed(() => view.value === "loading" || view.value === "write-pending" || view.value === "read-failed" || view.value === "detected");
const pendingKind = computed(() => calibration.value?.calibrationStatus === "PENDING_VERIFICATION" ? (iosPending.value ? "ios" : "android") : null);
const unavailableTitle = computed(() => pendingKind.value === "ios" ? t.value.onboarding.phoneCalibrationPendingIosTitle
  : pendingKind.value === "android" ? t.value.onboarding.phoneCalibrationPendingTitle : t.value.onboarding.calibrationFailedTitle);
const unavailableBody = computed(() => pendingKind.value === "ios" ? t.value.onboarding.phoneCalibrationPendingIosBody
  : pendingKind.value === "android" ? t.value.onboarding.phoneCalibrationPendingBody : t.value.onboarding.activationLaterBody);
const barIsTray = computed(() => deferResendAvailable.value || calibrationResendAvailable.value
  || (deferOutcome.value !== "unknown" && (view.value === "deferred" || view.value === "unavailable" || view.value === "read-failed")));
// Content keeps clear of the bar: its measured height + 22 off the bottom + 16 (04 §4.0); the tray wraps on long languages.
const barClearance = ref(86);
const pageInstance = getCurrentInstance();
function measureBar() {
  if (!pageInstance?.proxy) return;
  uni.createSelectorQuery().in(pageInstance.proxy).select(".ob-bar").boundingClientRect().exec((boxes: (UniApp.NodeInfo | null)[]) => {
    const height = boxes[0]?.height;
    if (height) barClearance.value = Math.ceil(height) + 38;
  });
}
watch([view, deferOutcome, calibrationResendAvailable, deferResendAvailable, () => t.value.onboarding.iosActivateLater], () => { void nextTick(measureBar); }, { flush: "post" });

function scopePair(): { estimator: EstimatorScope; remote: RemoteAccountRequest } {
  return {
    estimator: createEstimatorScope(String(app.accountKey || ""), accountEpoch, generation),
    remote: captureAccountScope(),
  };
}

function isCurrent(scope: { estimator: EstimatorScope; remote: RemoteAccountRequest }): boolean {
  return mounted && isCurrentEstimatorScope(scope.estimator, createEstimatorScope(String(app.accountKey || ""), accountEpoch, generation))
    && isCurrentAccountScope(scope.remote);
}

function calibrationOptions(scope = scopePair()) {
  return {
    deviceId: getDeviceId(), accountKey: auth.accountId,
    isCurrent: () => isCurrent(scope) && auth.isAuthenticated,
  };
}

function resumePendingActivation(options: ReturnType<typeof calibrationOptions>): boolean {
  if (!options.isCurrent() || !readPhoneCommand(options, "activate")) return false;
  navReset({ url: "/pages/onboarding/connect", fail: () => {} });
  return true;
}

async function acceptEstimate(result: OnboardingCalibration, options: ReturnType<typeof calibrationOptions>, knownActive?: boolean | null) {
  const active = knownActive ?? await readCurrentPhoneActive(result);
  if (!options.isCurrent()) return;
  currentPhoneActive.value = active;
  calibration.value = result;
  if (result.activationStatus === "DEFERRED") {
    finishDeferral(result);
    return;
  }
  if (!result.calibrationAvailable || result.calibrationStatus !== "MATCHED") {
    loadFailed.value = true;
    return;
  }
  scheduleReveal();
}

async function loadCalibration(recalibrate = false, resend = false) {
  if (!nativePhoneAvailable) return;
  const scope = scopePair();
  const options = calibrationOptions(scope);
  recalibrationRequested = recalibrate;
  loadFailed.value = false;
  estimateReadRecovering.value = false;
  deferred.value = false;
  loading.value = true;
  try {
    if (resumePendingActivation(options)) return;
    if (!resend) {
      deferIntent = readPhoneCommand(options, "defer");
      if (deferIntent) {
        leaveAfterDeferral = true;
        loadFailed.value = true;
        deferOutcome.value = "unknown";
        return;
      }
      if (calibrationFlow.restore(options)) {
        calibrationWritePending.value = true;
        return;
      }
    }
    let current: OnboardingCalibration | null;
    try {
      current = await calibrationFlow.read(options);
      const active = current && await readCurrentPhoneActive(current);
      if (!options.isCurrent()) return;
      if (resend) {
        const result = calibrationFlow.reconcile(current);
        if (result) {
          calibrationWritePending.value = false;
          await acceptEstimate(result, options, active);
          return;
        }
      } else if (current && (!recalibrate || active)) {
        await acceptEstimate(current, options, active);
        return;
      }
    } catch {
      calibrationReadback.reset();
      if (isCurrent(scope) && !resend) estimateReadRecovering.value = true;
      return;
    }
    const result = await calibrationFlow.write(options, current, resend);
    if (options.isCurrent()) {
      calibrationWritePending.value = false;
      await acceptEstimate(result, options);
    }
  } catch {
    if (isCurrent(scope)) {
      calibrationWritePending.value = calibrationFlow.hasPendingWrite();
      loadFailed.value = !calibrationWritePending.value;
    }
  } finally {
    if (isCurrent(scope)) {
      loading.value = false;
      if (deferIntent && deferOutcome.value === "unknown") void deferRecovery.retry();
      if (!resend && calibrationWritePending.value && !calibrationReadback.notBefore()) void estimateRecovery.retry();
    }
  }
}

async function recoverCalibration() {
  const options = calibrationOptions();
  const pending = calibrationWritePending.value;
  try {
    if (resumePendingActivation(options)) return;
    const current = await calibrationFlow.read(options);
    if (!options.isCurrent()) return;
    const result = pending ? calibrationFlow.reconcile(current) : current;
    if (pending && !result) { calibrationReadback.observe(); return; }
    const active = result ? await readCurrentPhoneActive(result) : false;
    if (!options.isCurrent()) return;
    if (result && (pending || !recalibrationRequested || active)) {
      await acceptEstimate(result, options, active);
    } else {
      loadFailed.value = true;
    }
    if (!options.isCurrent()) return;
    calibrationReadback.reset();
    calibrationWritePending.value = false;
    estimateReadRecovering.value = false;
  } catch (cause) {
    calibrationReadback.reset();
    if (options.isCurrent() && !calibrationFlow.hasPendingWrite()) {
      calibrationWritePending.value = false;
      estimateReadRecovering.value = true;
    }
    throw cause;
  }
}

const estimateRecovery = useAutoRecovery({
  failed: () => !loading.value && (estimateReadRecovering.value || calibrationWritePending.value),
  active: () => nativePhoneAvailable && pageVisible.value,
  retry: recoverCalibration,
  retryNotBefore: calibrationReadback.notBefore,
  repeatMs: 30_000,
});

function resendCalibration() {
  if (!calibrationResendAvailable.value) return;
  calibrationReadback.reset();
  generation += 1;
  void loadCalibration(recalibrationRequested, true);
}

function retryCalibration() {
  if (!nativePhoneAvailable || loading.value || deferBusy.value || deferOutcome.value === "unknown") return;
  if (deferred.value) {
    navReset({ url: "/pages/onboarding/connect?mode=resume", fail: () => {} });
    return;
  }
  generation += 1;
  if (timer) clearTimeout(timer);
  const needsCalibration = recalibrationRequested || deferNeedsCalibration || (calibration.value !== null && calibration.value.calibrationStatus !== "MATCHED");
  deferOutcome.value = null;
  deferNeedsCalibration = false;
  detected.value = false;
  calibration.value = null;
  void loadCalibration(needsCalibration);
}

function scheduleReveal() {
  if (timer) clearTimeout(timer);
  const scope = scopePair();
  timer = setTimeout(() => {
    if (isCurrent(scope)) detected.value = true;
  }, 1200);
}

watch(() => String(app.accountKey || ""), (next) => {
  if (next === accountWatchKey) return;
  accountWatchKey = next;
  accountEpoch += 1;
  generation += 1;
  deferBusy.value = false;
  calibrationFlow.reset();
  deferIntent = null;
  currentPhoneActive.value = false;
  calibrationReadback.reset();
  deferReadback.reset();
  detected.value = false;
  loadFailed.value = false;
  deferred.value = false;
  estimateReadRecovering.value = false;
  calibrationWritePending.value = false;
  deferOutcome.value = null;
  deferSyncPending.value = false;
  deferNeedsCalibration = false;
  leaveAfterDeferral = false;
  calibration.value = null;
  loadCalibration();
});

onLoad(() => {
  // #ifdef H5
  navReset({ url: "/pages/register/success?download=1", fail: () => {} });
  // #endif
});
onMounted(() => {
  mounted = true;
  loadCalibration();
  void nextTick(measureBar);
});
onUnmounted(() => {
  if (timer) clearTimeout(timer);
  mounted = false;
  generation += 1;
});

onBackPress(() => {
  if (!mounted || deferBusy.value) return true;
  leaveEstimator();
  return true;
});

function goConnect() {
  if (!nativePhoneAvailable || !detected.value || deferOutcome.value === "unknown"
      || !calibration.value?.calibrationAvailable) return;
  const accountKey = auth.email || auth.accountId;
  if (currentPhoneActive.value && useSession().markCalibrated(accountKey) && auth.completeOnboarding()) {
    app.acceptPhoneActivation();
    void app.refreshRemoteFleet();
    navReset({ url: "/pages/index/index", fail: () => {} });
    return;
  }
  navReset({ url: "/pages/onboarding/connect", fail: () => {} });
}

function leaveEstimator() {
  if (!mounted || deferBusy.value) return;
  generation += 1;
  // #ifdef H5
  navReset({ url: "/pages/index/index", fail: () => {} });
  // #endif
  // #ifndef H5
  navReset({ url: "/pages/onboarding/intro", fail: () => {} });
  // #endif
}

function finishDeferral(result: OnboardingCalibration) {
  if (deferIntent) finishPhoneCommand("defer", deferIntent);
  deferIntent = null;
  deferReadback.reset();
  calibration.value = result;
  detected.value = false;
  deferred.value = true;
  deferOutcome.value = null;
  deferNeedsCalibration = false;
  const accountKey = auth.email || auth.accountId || "default";
  const synchronized = syncDeferredPhoneActivation(accountKey)
    && (auth.onboardingComplete || auth.completeOnboarding())
    && (markAuthAccountOnboardingComplete(accountKey) || remoteApiEnabled);
  deferSyncPending.value = !synchronized;
  if (!synchronized || !leaveAfterDeferral) return;
  leaveAfterDeferral = false;
  toast.info(t.value.onboarding.activationDeferredToast, t.value.onboarding.activationDeferredToastBody);
  navReset({ url: "/pages/index/index", fail: () => {} });
}

const deferRecovery = useAutoRecovery({
  failed: () => !deferBusy.value && (deferOutcome.value === "unknown" || deferSyncPending.value),
  active: () => nativePhoneAvailable && pageVisible.value,
  async retry() {
    const options = calibrationOptions();
    try {
      const result = await calibrationFlow.read(options);
      if (!options.isCurrent() || deferBusy.value) return;
      if (result?.activationStatus === "DEFERRED") finishDeferral(result);
      else if (deferIntent) deferReadback.observe();
    } catch (cause) {
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

async function deferPhoneActivation(resend: boolean | Event = false) {
  const retry = resend === true;
  if (!nativePhoneAvailable || !mounted || deferBusy.value || loading.value || calibrationWritePending.value
      || (retry ? !deferResendAvailable.value : deferOutcome.value === "unknown")
      || currentPhoneActive.value) return;
  leaveAfterDeferral = true;
  if (deferSyncPending.value) { void deferRecovery.retry(); return; }
  const current = deferOutcome.value === "rejected" ? null : calibration.value;
  deferOutcome.value = null;
  deferBusy.value = true;
  if (retry) generation += 1;
  const options = calibrationOptions();
  let checking = retry;
  try {
    if (retry) {
      deferReadback.reset();
      const latest = await calibrationFlow.read(options);
      if (!options.isCurrent()) return;
      if (latest?.activationStatus === "DEFERRED") { finishDeferral(latest); return; }
      checking = false;
    }
    const result = await confirmDeferredPhoneActivation({
      ...options, current,
      accept: (result) => options.isCurrent() && calibrationBelongsTo(result, options.accountKey, options.deviceId),
    }, command => { deferIntent = command; }, retry ? deferIntent ?? undefined : undefined);
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
    deferNeedsCalibration = phoneActivationFeedback(code)?.action === "recalibrate";
    const o = t.value.onboarding;
    toast.warn(o.activationDeferRejectedTitle, code === "ONBOARDING_CALIBRATION_REVISION_CONFLICT" ? o.activationDeferRejectedBody : undefined);
  } finally {
    if (options.isCurrent()) deferBusy.value = false;
  }
}
</script>

<style scoped>
.est-root { position: fixed; inset: 0; display: flex; flex-direction: column; padding-right: 16px; padding-left: 16px; background: var(--v5-bg); overflow-x: hidden; overflow-y: auto; }

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
@media (prefers-reduced-motion: reduce) { .ob-spin { animation: none; } .ob-btn--primary:active, .ob-back:active .ob-back__face { transform: none; } }

/* Focal card (01 §1.1.2 soft glass, no blur): phone art left, five fixed-height rows right. */
.est-hero { position: relative; flex: none; display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: var(--ui-radius-surface, 22px); overflow: hidden; }
.est-hero__art { position: relative; flex: none; width: 92px; height: 104px; }
.est-hero__img { position: absolute; left: -25%; top: -22%; width: 150%; height: 150%; object-fit: contain; z-index: 1; }
.est-hero__floor { position: absolute; left: -10px; right: -10px; bottom: -4px; height: 30px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-tech-cyan) 30%, transparent), transparent); }
[data-theme="light"] .est-hero__floor { background: radial-gradient(closest-side, color-mix(in srgb, var(--v5-tech-cyan) 26%, transparent), transparent); }
.est-hero__body { flex: 1; min-width: 0; }
.est-hero__top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 8px; }
.est-hero__name { flex: 0 1 auto; min-width: 0; font: var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: break-word; }
.est-hero__tag-icon { flex: none; margin-right: 4px; }
.est-hero__tag--skel { background: color-mix(in srgb, var(--v5-ink) 9%, transparent); color: transparent; }
.est-hero__tag--skel .est-hero__tag-icon, .est-hero__tag--ghost { visibility: hidden; }
.est-hero__k { display: block; margin-top: 12px; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
/* Main amount (01 §1.2, 10.2 弹层主金额 size): Montserrat 500, decimals and unit ink-3. The integer is the card's one brand key
   figure (01 §1.1.1 rule 4), the same composition as the trial claim card's 预计收益 (04.1 主金额字体、主题色; 01 §1.2 同一指标跨页同一组成). */
.est-amt { display: flex; align-items: baseline; height: var(--ui-type-wallet-amount-lh); margin-top: 4px; font: 500 var(--ui-type-wallet-amount)/var(--ui-type-wallet-amount-lh) var(--font-amount); letter-spacing: -.02em; color: var(--v5-brand); }
.est-amt__dec { color: var(--v5-ink-3); }
.est-amt__u { font: 500 max(12px, .4em)/1 var(--font-v5); letter-spacing: 0; color: var(--v5-ink-3); }
.est-amt--unknown { color: var(--v5-ink-3); }
.est-amt2 { display: flex; align-items: baseline; height: var(--ui-type-subheading-lh); margin-top: 2px; font: 500 var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-amount); color: var(--v5-ink-3); }
.est-amt2__u { font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); }
.est-basis { display: block; height: var(--ui-type-description-lh); margin-top: 4px; white-space: nowrap; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
/* 10.1 行内数值: a non-amount metric inline, JetBrains Mono 500 (01 §1.2); the row keeps its line height so all states stay level. */
.est-basis__v { font-family: var(--font-metric); font-size: var(--ui-type-inline-figure); font-weight: var(--ui-type-inline-figure-weight); font-variant-numeric: tabular-nums; color: var(--v5-ink); }
.est-basis__v--unknown { color: var(--v5-ink-3); }
.est-basis--status { display: flex; align-items: center; gap: 8px; color: var(--v5-ink-2); }
.est-basis__spin { color: var(--v5-brand); }
/* Comparison: section title, one solid card, column head written once. */
.est-sec { display: block; margin-top: var(--ui-space-section-gap); font: var(--ui-type-section-weight) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); color: var(--v5-ink); }
.est-list { flex: none; margin-top: 12px; padding: 0 16px; border-radius: var(--ui-radius-surface, 22px); background: var(--v5-surface); }
[data-theme="light"] .est-list { box-shadow: var(--v5-glass-shadow); }
.est-list__head { display: flex; justify-content: space-between; gap: 12px; padding-top: 12px; font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); white-space: nowrap; }
.est-row { display: grid; grid-template-columns: 1fr auto; column-gap: 12px; row-gap: 10px; align-items: center; padding: 14px 0; }
.est-list__head + .est-row { padding-top: 8px; }
.est-row + .est-row { border-top: 1px solid var(--v5-border); }
.est-row__t { min-width: 0; }
.est-row__n { display: block; font: 500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: break-word; }
.est-row__s { display: block; margin-top: 2px; font: var(--ui-type-list-subtitle-weight, 400) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
.est-row--skel .est-row__n, .est-row--skel .est-row__s, .est-row--skel .est-row__v { white-space: nowrap; }
.est-row__v { justify-self: end; align-self: start; font: var(--ui-type-card-figure-weight, 500) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-metric); font-variant-numeric: tabular-nums; color: var(--v5-ink); }
.est-row__bar { grid-column: 1 / 3; margin: 1px 0; --nx-progress-hue: var(--v5-tech-cyan); }
/* entrance, once */
.anim-up { animation: est-up .32s cubic-bezier(.16, 1, .3, 1) both; }
.anim-up-delay { animation: est-up .32s cubic-bezier(.16, 1, .3, 1) .15s both; }
@keyframes est-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .anim-up, .anim-up-delay { animation: none; } }
</style>
