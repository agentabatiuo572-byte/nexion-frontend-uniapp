<template>
  <StandalonePageShell class="est-root" :top-inset="4">
    <!-- #ifdef APP-PLUS -->
    <NativeGpuObserver :request="gpuRequest" @observation="gpuReader.receive" />
    <!-- #endif -->
    <!-- Guided header: back, the three-step track (done / current / upcoming), the step label. -->
    <view class="ob-hd">
      <view class="ob-back" role="button" :tabindex="deferBusy ? -1 : 0" :aria-disabled="deferBusy" :aria-label="t.login.back" :class="{ 'ob-back--off': deferBusy }" @click="leaveEstimator" @keydown.enter.prevent="leaveEstimator" @keydown.space.prevent="leaveEstimator">
        <view class="ob-back__face nx-frosted-button">
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
              <view class="est-amt est-amt--unknown" :aria-label="'— USDT' + t.onboarding.perDay"><text>—</text><text class="est-amt__u">{{ ' USDT' + t.onboarding.perDay }}</text></view>
              <view class="est-amt2" :aria-label="'— UVT' + t.onboarding.perDay"><text>—</text><text class="est-amt2__u">{{ ' UVT' + t.onboarding.perDay }}</text></view>
              <text class="est-basis"><text class="est-basis__v est-basis__v--unknown">—</text> {{ t.onboarding.phoneComputeUnit }}</text>
            </template>
            <template v-else>
              <view class="est-amt" :aria-label="phoneUsdtLabel + ' USDT' + t.onboarding.perDay">
                <text class="est-amt__int" aria-hidden="true">{{ phoneUsdtParts.int }}</text><text v-if="phoneUsdtParts.dec" class="est-amt__dec" aria-hidden="true">{{ phoneUsdtParts.dec }}</text><text class="est-amt__u" aria-hidden="true">{{ ' USDT' + t.onboarding.perDay }}</text>
              </view>
              <view class="est-amt2" :aria-label="phoneUvtLabel + ' UVT' + t.onboarding.perDay">
                <text aria-hidden="true">{{ phoneUvtLabel }}</text><text class="est-amt2__u" aria-hidden="true">{{ ' UVT' + t.onboarding.perDay }}</text>
              </view>
              <text class="est-basis"><text class="est-basis__v">{{ calibration?.computeValue ?? '—' }}</text> {{ t.onboarding.phoneComputeUnit }}</text>
            </template>
          </view>
        </view>

        <!-- Device comparison: text and a ratio bar per row (no SKU identity, so no device image); unit and period once in the column head. -->
        <template v-if="view !== 'detected' || compareRows.length">
          <text class="est-sec">{{ t.onboarding.unlockMore }}</text>
          <view class="est-list" :class="{ 'anim-up-delay': view === 'detected' }" :role="view === 'detected' ? 'list' : undefined">
            <view class="est-list__head" aria-hidden="true"><text>{{ t.onboarding.colModel }}</text><text>{{ 'USDT' + t.onboarding.perDay }}</text></view>
            <template v-if="view === 'detected'">
              <view v-for="row in compareRows" :key="row.key" class="est-row" role="listitem" :aria-label="row.label + ', ' + row.times + ', ' + row.value + ' USDT' + t.onboarding.perDay">
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
      <view v-else class="ob-btn" :class="{ 'ob-btn--primary': view === 'detected' }" role="button" :tabindex="view === 'detected' ? 0 : -1" :aria-disabled="view !== 'detected'" :aria-busy="view !== 'detected'" data-system-chrome-primary @click="goConnect" @keydown.enter.prevent="goConnect" @keydown.space.prevent="goConnect">
        <view v-if="view !== 'detected'" class="ob-spin" aria-hidden="true" /><text>{{ t.onboarding.startEarning }}</text><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
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
import { formatEstimate } from "@/lib/estimate-display";
import { navReset } from "@/lib/route";
import { onBackPress, onLoad } from "@dcloudio/uni-app";
import { ref, computed, getCurrentInstance, nextTick, onMounted, onUnmounted, watch } from "vue";
import StandalonePageShell from "@/components/device/standalone-page-shell.vue";
import { useT } from "@/i18n/use-t";
import { getDeviceId } from "@/lib/device-id";
import { hasNativeAndroidPhoneRuntime, hasNativePhoneRuntime, nativePhonePlatform } from "@/lib/native-phone-runtime";
import { onboardingCalibrationApi, remoteApiEnabled } from "@/api/runtime";
import type { OnboardingCalibration } from "@/api/onboarding-calibration-api";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { useSession } from "@/store/session";
import { markAuthAccountOnboardingComplete } from "@/store/auth-account";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import type { RemoteAccountRequest } from "@/lib/remote-account-epoch";
import { createEstimatorScope, isCurrentEstimatorScope, type EstimatorScope } from "@/lib/estimator-scope";
import { requireCryptoUuid } from "@/lib/secure-command-id";
import { confirmDeferredPhoneActivation } from "@/lib/defer-phone-activation";
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
const deferFailed = ref(false);
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
let accountEpoch = 0;
let generation = 0;
let accountWatchKey = String(app.accountKey || "");
let deferIntent: { revision: number; idempotencyKey: string } | null = null;
const calibrationFlow = createPhoneCalibrationFlow({ api: onboardingCalibrationApi,
  collect: collectCalibrationSignals, key: () => `onboarding:${requireCryptoUuid()}` });
const nativePhoneAvailable = hasNativePhoneRuntime();
const iosPhone = nativePhonePlatform() === "ios";
const detectingText = computed(() => iosPhone ? t.value.onboarding.iosIdentifying : t.value.onboarding.detecting);

// ── Placeholders for the logic round (report table: placeholder → meaning → board). Defaults keep today's behaviour. ──
/** E12: the estimate read failed and the page recovers it on its own (read-only GET, no button). Until wired, a failed read
 *  falls through to E04 with 「重新校准」 as today. */
const estimateReadRecovering = ref(false);
/** E13: the calibration write's outcome is unknown and is being read back; the CTA stays grey with a spinner. */
const calibrationWritePending = ref(false);
/** E08 / E14: how the last 「稍后激活」 ended. 'rejected' = the server refused (toast, page unchanged); 'unknown' = the result is
 *  being read back (status capsule instead of the tray). */
const deferOutcome = ref<"rejected" | "unknown" | null>(null);

type EstimatorView = "nonnative" | "loading" | "write-pending" | "read-failed" | "detected" | "unavailable" | "deferred";
const view = computed<EstimatorView>(() => !nativePhoneAvailable ? "nonnative"
  : deferred.value ? "deferred"
  : estimateReadRecovering.value ? "read-failed"
  : loadFailed.value ? "unavailable"
  : calibrationWritePending.value ? "write-pending"
  : detected.value ? "detected" : "loading");
const estimateShown = computed(() => view.value === "loading" || view.value === "write-pending" || view.value === "read-failed" || view.value === "detected");
const pendingKind = computed(() => calibration.value?.calibrationStatus === "PENDING_VERIFICATION" ? (iosPending.value ? "ios" : "android") : null);
const unavailableTitle = computed(() => pendingKind.value === "ios" ? t.value.onboarding.phoneCalibrationPendingIosTitle
  : pendingKind.value === "android" ? t.value.onboarding.phoneCalibrationPendingTitle : t.value.onboarding.calibrationFailedTitle);
const unavailableBody = computed(() => pendingKind.value === "ios" ? t.value.onboarding.phoneCalibrationPendingIosBody
  : pendingKind.value === "android" ? t.value.onboarding.phoneCalibrationPendingBody : t.value.onboarding.activationLaterBody);
const barIsTray = computed(() => deferOutcome.value !== "unknown" && (view.value === "deferred" || view.value === "unavailable" || view.value === "read-failed"));
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
watch([view, deferOutcome, () => t.value.onboarding.iosActivateLater], () => { void nextTick(measureBar); }, { flush: "post" });

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

function loadCalibration(recalibrate = false) {
  if (!nativePhoneAvailable) return;
  const scope = scopePair();
  loadFailed.value = false;
  deferFailed.value = false;
  deferred.value = false;
  loading.value = true;
  void Promise.resolve().then(() => calibrationFlow.run({ deviceId: getDeviceId(), accountKey: auth.accountId,
    isCurrent: () => isCurrent(scope) && auth.isAuthenticated,
    recalibrate,
  })).then((result) => {
    if (!isCurrent(scope)) return;
    if (result.activationStatus === "DEFERRED") {
      calibration.value = result;
      detected.value = false;
      deferred.value = true;
      return;
    }
    if (!result.calibrationAvailable || result.calibrationStatus !== "MATCHED" || (result.activationStatus !== "CALIBRATED" && result.activationStatus !== "ACTIVE")) {
      calibration.value = result;
      detected.value = false;
      loadFailed.value = true;
      return;
    }
    calibration.value = result;
    scheduleReveal();
  }).catch(() => {
    if (!mounted || !isCurrentEstimatorScope(scope.estimator,
      createEstimatorScope(String(app.accountKey || ""), accountEpoch, generation))) return;
    calibration.value = null;
    detected.value = false;
    loadFailed.value = true;
  }).finally(() => {
    if (mounted && isCurrentEstimatorScope(scope.estimator,
      createEstimatorScope(String(app.accountKey || ""), accountEpoch, generation))) loading.value = false;
  });
}

function retryCalibration() {
  if (deferBusy.value) return;
  if (!nativePhoneAvailable) return;
  if (loading.value) return;
  if (deferFailed.value) { void deferPhoneActivation(); return; }
  if (deferred.value) {
    navReset({ url: "/pages/onboarding/connect?mode=resume", fail: () => {} });
    return;
  }
  generation += 1;
  if (timer) clearTimeout(timer);
  const needsCalibration = calibration.value !== null && calibration.value.calibrationStatus !== "MATCHED";
  detected.value = false;
  calibration.value = null;
  calibrationFlow.reset();
  loadCalibration(needsCalibration);
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
  deferIntent = null;
  calibrationFlow.reset();
  detected.value = false;
  loadFailed.value = false;
  deferFailed.value = false;
  deferred.value = false;
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
  if (!nativePhoneAvailable || !detected.value || !calibration.value?.calibrationAvailable) return;
  navReset({ url: "/pages/onboarding/connect", fail: () => {} });
}

function completeOnboardingLocally(): boolean {
  if (!auth.completeOnboarding()) return false;
  if (markAuthAccountOnboardingComplete(auth.email || auth.accountId || "default") || remoteApiEnabled) return true;
  if (!auth.requireOnboarding()) auth.signOut();
  return false;
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

async function deferPhoneActivation() {
  if (!nativePhoneAvailable || !mounted || deferBusy.value || loading.value) return;
  deferBusy.value = true;
  const scope = scopePair();
  const deviceId = getDeviceId();
  try {
    const deferred = await confirmDeferredPhoneActivation({
      current: calibration.value,
      deviceId,
      command: (revision) => {
        if (!deferIntent || deferIntent.revision !== revision) {
          deferIntent = {
            revision,
            idempotencyKey: `phone-activation:deferred:${requireCryptoUuid()}`,
          };
        }
        return deferIntent;
      },
      isCurrent: () => isCurrent(scope),
      accept: (result) => isCurrent(scope) && calibrationBelongsTo(result, auth.accountId, deviceId),
    });
    if (!isCurrent(scope) || deferred.activationStatus !== "DEFERRED") return;

    calibration.value = deferred;
    const phoneDevice = app.devices.find((device) => device.kind === "phone");
    const localPhoneStateCommitted = (remoteApiEnabled || !phoneDevice || app.deactivateDevice(phoneDevice.id))
      && useSession().markPhoneActivationDeferred(auth.email || auth.accountId || "default");
    if (!localPhoneStateCommitted && !remoteApiEnabled) throw new Error("PHONE_DEFER_LOCAL_COMMIT_FAILED");
    if (!completeOnboardingLocally()) throw new Error("ONBOARDING_LOCAL_COMMIT_FAILED");

    toast.info(t.value.onboarding.activationDeferredToast, t.value.onboarding.activationDeferredToastBody);
    navReset({ url: "/pages/index/index", fail: () => {} });
  } catch {
    if (isCurrent(scope)) {
      calibration.value = null;
      deferFailed.value = true;
      loadFailed.value = true;
      toast.warn(t.value.onboarding.activationDeferRejectedTitle);
    }
  } finally {
    if (isCurrent(scope)) deferBusy.value = false;
  }
}
</script>

<style scoped>
.est-root { position: fixed; inset: 0; display: flex; flex-direction: column; padding-right: 16px; padding-left: 16px; background: var(--v5-bg); overflow-x: hidden; overflow-y: auto; }

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
.ob-content { position: relative; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; margin-top: 20px; }
.ob-rh { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 12px 24px; }
.ob-skel { display: inline-block; vertical-align: middle; border-radius: 8px; background: color-mix(in srgb, var(--v5-ink) 9%, transparent); }
.ob-spin { flex: none; width: 18px; height: 18px; box-sizing: border-box; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: ob-spin .8s linear infinite; }
.ob-spin--s { width: 14px; height: 14px; border-width: 1.8px; }
@keyframes ob-spin { to { transform: rotate(360deg); } }
/* Bottom bar: position here; material, disabled grey glass and tray text come from the shared .nx-glass-bar layer. */
.ob-bar { position: fixed; z-index: 30; display: flex; flex-direction: column; }
.ob-tray-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0 8px; }
.nx-tray-note + .ob-tray-row { margin-top: 8px; }
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
/* Main amount (01 §1.2, 10.2 弹层主金额 size): Montserrat 500, integer brand (the card's one key figure), decimals and unit ink-3. */
.est-amt { display: flex; align-items: baseline; height: var(--ui-type-wallet-amount-lh); margin-top: 4px; font: 500 var(--ui-type-wallet-amount)/var(--ui-type-wallet-amount-lh) var(--font-amount); letter-spacing: -.02em; color: var(--v5-brand); white-space: nowrap; }
.est-amt__dec { color: var(--v5-ink-3); }
.est-amt__u { font: 500 max(12px, .4em)/1 var(--font-v5); letter-spacing: 0; color: var(--v5-ink-3); white-space: pre; }
.est-amt--unknown { color: var(--v5-ink-3); }
.est-amt2 { display: flex; align-items: baseline; height: var(--ui-type-subheading-lh); margin-top: 2px; font: 500 var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-amount); color: var(--v5-ink-3); white-space: nowrap; }
.est-amt2__u { font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink-3); white-space: pre; }
.est-basis { display: block; height: var(--ui-type-description-lh); margin-top: 4px; white-space: nowrap; font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); color: var(--v5-ink-3); }
.est-basis__v { font-weight: 500; color: var(--v5-ink); }
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
.est-row__v { justify-self: end; align-self: start; font: var(--ui-type-card-figure-weight, 500) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-metric); font-variant-numeric: tabular-nums; color: var(--v5-ink); white-space: nowrap; }
.est-row__bar { grid-column: 1 / 3; margin: 1px 0; --nx-progress-hue: var(--v5-tech-cyan); }
/* entrance, once */
.anim-up { animation: est-up .32s cubic-bezier(.16, 1, .3, 1) both; }
.anim-up-delay { animation: est-up .32s cubic-bezier(.16, 1, .3, 1) .15s both; }
@keyframes est-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .anim-up, .anim-up-delay { animation: none; } }
</style>
