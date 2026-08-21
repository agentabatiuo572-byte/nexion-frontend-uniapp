<template>
  <StandalonePageShell class="cn-root" :top-inset="24">
    <!-- Progress (3/3 full) -->
    <view class="cn-bars">
      <view class="cn-back active:opacity-60" role="button" tabindex="0" :aria-label="t.login.back" @click="leaveConnect" @keydown.enter.prevent="leaveConnect" @keydown.space.prevent="leaveConnect">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </view>
      <view class="cn-bar"><view class="cn-bar__fill cn-bar__fill--full" /></view>
      <view class="cn-bar"><view class="cn-bar__fill cn-bar__fill--full" /></view>
      <view class="cn-bar"><view class="cn-bar__fill cn-bar__fill--full" /></view>
    </view>

    <view>
      <text class="cn-step">{{ stepText }}</text>
      <text class="cn-title">{{ titleText }}</text>
      <text class="cn-sub">{{ subText }}</text>
    </view>

    <transition name="cn-fade" mode="out-in">
      <!-- Phase: intro -->
      <view v-if="phase === 'intro'" key="intro" class="cn-phase">
        <view class="cn-why">
          <text class="cn-why__h">{{ t.onboarding.calibrationWhyTitle }}</text>
          <view class="cn-why__list">
            <view v-for="(p, i) in whyPoints" :key="i" class="cn-point">
              <view class="cn-point__ic">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" :stroke="p.color" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="p.icon" /><path v-if="p.icon2" :d="p.icon2" /></svg>
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
      <view v-else-if="phase === 'calibrating'" key="calibrating" class="cn-phase">
        <view class="cn-prog-row">
          <svg class="cn-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          <text class="cn-prog-row__t">{{ progressText }}</text>
        </view>
        <view v-for="(tc, i) in testCards" :key="i" class="cn-test">
          <view class="cn-test__top">
            <view class="cn-test__ic" :style="{ background: mix(tc.accent, 14), color: tc.accent }">
              <svg v-if="tc.progress < 1" width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="tc.accent" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="tc.icon" /><path v-if="tc.icon2" :d="tc.icon2" /></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="tc.accent" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </view>
            <view class="cn-test__body">
              <text class="cn-test__title">{{ tc.title }}</text>
              <text class="cn-test__metric">{{ tc.metric }}</text>
            </view>
          </view>
          <view class="cn-test__track">
            <view class="cn-test__fill" :style="{ width: (tc.progress * 100) + '%', background: tc.accent }" />
          </view>
        </view>
      </view>

      <!-- Phase: result -->
      <view v-else-if="phase === 'result'" key="result" class="cn-phase anim-up">
        <view class="cn-score">
          <view class="cn-score__cap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
            <text class="cn-score__cap-t">{{ t.onboarding.resultTitle }}</text>
          </view>
          <view class="cn-score__num">
            <text class="cn-score__v">{{ shownScore }}</text>
            <text class="cn-score__d">/100</text>
          </view>
          <text class="cn-score__tier">{{ tierLabel }}</text>
          <view class="cn-score__yield">
            <text class="cn-score__yield-cap">{{ t.onboarding.resultEstYield }}</text>
            <text class="cn-score__yield-v">${{ finalYield.toFixed(2) }}/d</text>
          </view>
        </view>

        <view class="cn-summary">
          <view v-for="(r, i) in resultRows" :key="i" class="cn-row">
            <view class="cn-row__check">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </view>
            <text class="cn-row__label">{{ r.label }}</text>
            <text class="cn-row__val">{{ r.value }}</text>
          </view>
        </view>

        <view class="cn-policy">
          <view class="cn-policy__cap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
            <text class="cn-policy__cap-t">{{ t.onboarding.policyTitle }}</text>
          </view>
          <view class="cn-policy__list">
            <view v-for="(l, i) in policyLines" :key="i" class="cn-policy__line">
              <view class="cn-policy__dot" />
              <text class="cn-policy__t">{{ l }}</text>
            </view>
          </view>
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
          <text class="cn-policy__t cn-policy__t--spaced">{{ t.onboarding.activationDeferredHint }}</text>
          <text class="cn-policy__t cn-policy__t--spaced">{{ t.onboarding.activationRewardGate }}</text>
        </view>
      </view>
    </transition>

    <view class="cn-cta">
      <view v-if="phase === 'result'" class="cn-go cn-go--on active:scale-[0.98]" role="button" tabindex="0" data-system-chrome-primary @click="activate" @keydown.enter.prevent="activate" @keydown.space.prevent="activate">
        <text class="cn-go__t cn-go__t--on">{{ activateText }}</text>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
      </view>
      <view v-else-if="phase === 'error'" class="cn-error-actions">
        <view class="cn-go cn-go--on active:scale-[0.98]" role="button" :tabindex="activationBusy ? -1 : 0" :aria-disabled="activationBusy" data-system-chrome-primary @click="retryCalibration" @keydown.enter.prevent="retryCalibration" @keydown.space.prevent="retryCalibration">
          <text class="cn-go__t cn-go__t--on">{{ t.onboarding.activationRetry }}</text>
        </view>
        <view class="cn-go cn-go--secondary active:scale-[0.98]" role="button" :tabindex="activationBusy ? -1 : 0" :aria-disabled="activationBusy" @click="deferPhoneActivation" @keydown.enter.prevent="deferPhoneActivation" @keydown.space.prevent="deferPhoneActivation">
          <text class="cn-go__t cn-go__t--secondary">{{ t.onboarding.activationDefer }}</text>
        </view>
      </view>
    </view>
  </StandalonePageShell>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import StandalonePageShell from "@/components/device/standalone-page-shell.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useAuth } from "@/store/auth";
import { useApp } from "@/store/app";
import { useSession } from "@/store/session";
import { markAuthAccountOnboardingComplete } from "@/store/auth-account";
import { getDeviceId } from "@/lib/device-id";
import { collectDeviceSignals } from "@/lib/device-signals";
import { requireCryptoUuid } from "@/lib/secure-command-id";
import { onboardingCalibrationApi, remoteApiEnabled } from "@/api/runtime";
import { commitOnboardingSandboxRun, type CalibrationRequestSignals, type OnboardingCalibration } from "@/api/onboarding-calibration-api";
import { ApiError } from "@/api/errors";
import { isCurrentOnboardingCalibrationScope, type OnboardingCalibrationScope } from "@/lib/onboarding-calibration-scope";

const t = useT();
const auth = useAuth();

// Recalibrate mode (?mode=recalibrate) = new-device re-measure; otherwise the
// first-time onboarding calibration. Set in onLoad.
const isRecal = ref(false);

type Phase = "intro" | "calibrating" | "result" | "error";
type FailedAction = "calibration" | "activate" | "defer";
const phase = ref<Phase>("intro");
const failedAction = ref<FailedAction>("calibration");

const CALIBRATION_MS = 12_000;
// Every runtime mode receives final facts from the authenticated server. The
// onboarding path intentionally has no local capability fallback, so mock,
// sandbox, and remote cannot turn device observations into business facts.
const canonical = ref<OnboardingCalibration | null>(null);
const finalTops = computed(() => canonical.value?.tops ?? 0);
const finalScore = computed(() => canonical.value?.score ?? 0);
const finalTier = computed(() => canonical.value?.tier ?? 0);
const finalYield = computed(() => canonical.value?.baseRateUsdt ?? 0);
const finalPing = computed(() => canonical.value?.signals?.pingMs ?? null);
const finalBattery = computed(() => canonical.value?.signals?.batteryLevel ?? null);

let mounted = true;
let accountEpoch = 0;
let requestGeneration = 0;
function accountKey(): string { return auth.accountId || auth.email || "default"; }
function currentScope(): OnboardingCalibrationScope {
  return { accountKey: accountKey(), accountEpoch, generation: requestGeneration };
}
function scopeIsCurrent(scope: OnboardingCalibrationScope): boolean {
  return mounted && isCurrentOnboardingCalibrationScope(scope, currentScope());
}
function acceptCurrentCanonical(scope: OnboardingCalibrationScope, result: OnboardingCalibration): boolean {
  return scopeIsCurrent(scope) && commitOnboardingSandboxRun(result);
}
const authenticatedAccountKey = computed(() => auth.isAuthenticated ? accountKey() : "");
watch(authenticatedAccountKey, (next, previous) => {
  if (next === previous) return;
  // Remote login hydrates the non-secret account routing key after the
  // authenticated page is already mounted. That one-way bootstrap is not an
  // account switch and must not invalidate an in-flight server calibration.
  if ((!previous || previous === "default") && next && next !== "default") return;
  activationBusy.value = false;
  accountEpoch += 1;
  requestGeneration += 1;
  calibrationIntent = null;
  canonical.value = null;
  if (phase.value !== "intro") phase.value = "error";
  failedAction.value = "calibration";
});

// Copy swaps: recalibrate vs first-time onboarding.
const stepText = computed(() => (isRecal.value ? t.value.onboarding.recalStep : t.value.onboarding.step3of3));
const titleText = computed(() => phase.value === "error" && failedAction.value !== "calibration"
  ? t.value.onboarding.activationFailedTitle
  : isRecal.value ? t.value.onboarding.recalTitle : t.value.onboarding.calibrationTitle);
const subText = computed(() => (isRecal.value ? t.value.onboarding.recalSubtitle : t.value.onboarding.calibrationSubtitle));
const activateText = computed(() => (isRecal.value ? t.value.onboarding.recalActivate : t.value.onboarding.activatePhone));
const failureDetail = computed(() => failedAction.value === "calibration"
  ? t.value.onboarding.calibrationRetry
  : t.value.onboarding.activationBindRetry);
const failureTitle = computed(() => failedAction.value === "calibration"
  ? t.value.onboarding.calibrationFailedTitle
  : t.value.onboarding.activationFailedTitle);

// lucide paths
const ICON = {
  cpu: "M12 20v2M12 2v2M17 20v2M17 2v2M2 12h2M2 17h2M2 7h2M20 12h2M20 17h2M20 7h2M7 20v2M7 2v2",
  cpu2: "M4 4h16v16H4zM9 9h6v6H9z",
  globe: "M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  globe2: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
  battery: "M7 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7M11 7l-4 5h4l-4 5",
};

const whyPoints = computed(() => [
  { icon: ICON.cpu2, color: "var(--v5-brand)", text: t.value.onboarding.calibrationWhyLine1 },
  { icon: ICON.globe2, icon2: ICON.globe, color: "var(--v5-tech-cyan)", text: t.value.onboarding.calibrationWhyLine2 },
  { icon: ICON.battery, color: "var(--v5-warning)", text: t.value.onboarding.calibrationWhyLine3 },
]);

// ── calibrating tickers ──
const progress = ref(0);
const tops = ref(0);
const ping = ref<number | null>(null);
const battery = ref<number | null>(null);
let calInterval: ReturnType<typeof setInterval> | undefined;
let calTimeout: ReturnType<typeof setTimeout> | undefined;
let calibrationIntent: {
  deviceId: string;
  signals: CalibrationRequestSignals;
  expectedRevision: number | null;
  idempotencyKey: string;
} | null = null;
let activationIntent: { target: "ACTIVE" | "DEFERRED"; revision: number; idempotencyKey: string } | null = null;
const activationBusy = ref(false);

function startCalibration() {
  if (calInterval) clearInterval(calInterval);
  if (calTimeout) clearTimeout(calTimeout);
  canonical.value = null;
  activationIntent = null;
  progress.value = 0; tops.value = 0; ping.value = null; battery.value = null;
  const requestScope = { ...currentScope(), generation: ++requestGeneration };
  try {
    if (!calibrationIntent) {
      const deviceId = getDeviceId();
      calibrationIntent = {
        deviceId,
        signals: collectDeviceSignals(),
        expectedRevision: isRecal.value ? null : 0,
        idempotencyKey: `onboarding:${deviceId}:${requireCryptoUuid()}`,
      };
    }
  } catch {
    failedAction.value = "calibration";
    phase.value = "error";
    return;
  }
  const intent = calibrationIntent;
  const expectedRevision = intent.expectedRevision === null
    ? onboardingCalibrationApi.result(intent.deviceId)
      .then((current) => { intent.expectedRevision = current.revision; return current.revision; })
      .catch((error: unknown) => {
        // A deferred first-time detection can legitimately have no canonical
        // row yet. Re-entering from the warehouse creates revision 0; every
        // other result error remains fail-closed.
        if (!(error instanceof ApiError) || error.kind !== "http" || error.status !== 404) throw error;
        intent.expectedRevision = 0;
        return 0;
      })
    : Promise.resolve(intent.expectedRevision);
  const serverRequest = expectedRevision.then((revision) => {
    if (!scopeIsCurrent(requestScope)) throw new Error("ONBOARDING_CALIBRATION_SCOPE_STALE");
    return onboardingCalibrationApi.calibrate(intent.deviceId, intent.signals, revision, intent.idempotencyKey);
  });
  // Let the ritual animate toward the already-authoritative response as soon
  // as it arrives; the timeout below still gates the result screen.
  void serverRequest.then((result) => {
    if (acceptCurrentCanonical(requestScope, result)) canonical.value = result;
  }).catch(() => {});
  const start = Date.now();
  calInterval = setInterval(() => {
    const p = Math.min(1, (Date.now() - start) / CALIBRATION_MS);
    progress.value = p;
    const npuP = Math.min(1, p / 0.45);
    tops.value = +(npuP * finalTops.value).toFixed(1);
    if (p > 0.3) {
      const netP = Math.min(1, (p - 0.3) / 0.5);
      ping.value = finalPing.value === null ? null : Math.round(netP * finalPing.value);
    }
    if (p > 0.55) {
      battery.value = finalBattery.value === null ? null : Math.round(Math.min(1, (p - 0.55) / 0.3) * finalBattery.value);
    }
  }, 100);
  calTimeout = setTimeout(() => {
    if (calInterval) clearInterval(calInterval);
    serverRequest.then((result) => {
      if (!acceptCurrentCanonical(requestScope, result)) return;
      canonical.value = result;
      progress.value = 1;
      startResult();
      phase.value = "result";
    }).catch(() => {
      if (!scopeIsCurrent(requestScope)) return;
      failedAction.value = "calibration";
      phase.value = "error";
    });
  }, CALIBRATION_MS);
}

const progressText = computed(() =>
  fmt(t.value.onboarding.calibrationProgress, {
    n: Math.max(0, Math.ceil((1 - progress.value) * (CALIBRATION_MS / 1000))),
  })
);

const testCards = computed(() => {
  const npuP = Math.min(1, progress.value / 0.45);
  const netP = Math.min(1, Math.max(0, (progress.value - 0.3) / 0.5));
  const pwP = Math.min(1, Math.max(0, (progress.value - 0.55) / 0.3));
  return [
    { icon: ICON.cpu, title: t.value.onboarding.testNpu, metric: fmt(t.value.onboarding.testComputeMetric, { n: tops.value.toFixed(1) }), progress: npuP, accent: "var(--v5-brand)" },
    { icon: ICON.globe2, icon2: ICON.globe, title: t.value.onboarding.testNetwork, metric: ping.value === null ? "—" : fmt(t.value.onboarding.testNetworkPing, { sg: ping.value, tk: ping.value, us: ping.value }), progress: netP, accent: "var(--v5-tech-cyan)" },
    { icon: ICON.battery, title: t.value.onboarding.testPower, metric: battery.value === null ? "—" : fmt(t.value.onboarding.testPowerOK, { n: battery.value }), progress: pwP, accent: "var(--v5-warning)" },
  ];
});

// ── result score tick ──
const shownScore = ref(0);
let raf = 0;
function startResult() {
  const start = Date.now();
  const tick = () => {
    const p = Math.min(1, (Date.now() - start) / 900);
    shownScore.value = Math.round(p * finalScore.value);
    if (p < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

const tierLabel = computed(() => fmt(t.value.onboarding.resultTier, { n: finalTier.value }));
const resultRows = computed(() => [
  { label: t.value.onboarding.testNpu, value: fmt(t.value.onboarding.resultComputeMetric, { n: finalTops.value }) },
  { label: t.value.onboarding.testNetwork, value: finalPing.value === null ? "—" : `${finalPing.value}ms · ${t.value.onboarding.resultLatencyGood}` },
  { label: t.value.onboarding.testPower, value: finalBattery.value === null ? "—" : fmt(t.value.onboarding.resultPowerReady, { n: finalBattery.value }) },
]);
const policyLines = computed(() => [
  t.value.onboarding.policyLine1,
  t.value.onboarding.policyLine2,
  t.value.onboarding.policyLine3,
]);

function mix(token: string, pct: number) {
  return `color-mix(in oklab, ${token} ${pct}%, transparent)`;
}

// start calibration when entering that phase
watch(phase, (p) => {
  if (p === "calibrating") startCalibration();
});

function retryCalibration() {
  if (activationBusy.value) return;
  if (failedAction.value === "activate") {
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

async function activate() {
  if (!mounted || !canonical.value?.calibrationAvailable || activationBusy.value) return;
  activationBusy.value = true;
  const requestScope = { ...currentScope() };
  const before = canonical.value;
  const command = activationCommand("ACTIVE", before.revision);
  const app = useApp();
  // Apply the freshly-measured baseline to the live phone device + record this
  // device as the account's calibrated device (so future logins on it skip
  // recalibration, while a different device triggers it).
  const cap = { score: before.score, tier: before.tier, tops: before.tops,
    baseRateUsdt: before.baseRateUsdt, baseRateNex: before.baseRateNex, signals: before.signals };
  try {
    const activated = await onboardingCalibrationApi.activate(before.deviceId, command.revision, command.idempotencyKey);
    if (!acceptCurrentCanonical(requestScope, activated)) return;
    if (activated.activationStatus !== "ACTIVE") throw new Error("PHONE_ACTIVATION_NOT_CONFIRMED");
    app.applyPhoneCalibration(cap);
    if (!useSession().markCalibrated(auth.email || auth.accountId || "default")
        || !completeOnboardingLocally()) {
      throw new Error("PHONE_ACTIVATION_LOCAL_COMMIT_FAILED");
    }
    canonical.value = activated;
    // Activation is already committed by the canonical endpoint. A secondary
    // fleet refresh must not turn that success into a false activation error;
    // App-level resilience owns refresh failure and the next page can retry it.
    void app.refreshRemoteFleet();
    if (isRecal.value) app.resumeMining();
    uni.reLaunch({ url: "/pages/index/index", fail: () => {} });
  } catch {
    if (scopeIsCurrent(requestScope)) {
      failedAction.value = "activate";
      phase.value = "error";
    }
  } finally {
    if (scopeIsCurrent(requestScope)) activationBusy.value = false;
  }
}

async function deferPhoneActivation() {
  if (!mounted || activationBusy.value) return;
  activationBusy.value = true;
  const requestScope = { ...currentScope() };
  try {
    let current = canonical.value;
    if (!current) {
      try {
        current = await onboardingCalibrationApi.result(calibrationIntent?.deviceId || getDeviceId());
        if (!acceptCurrentCanonical(requestScope, current)) return;
      } catch (error: unknown) {
        if (!scopeIsCurrent(requestScope)) return;
        // Detection can fail before the first calibration row exists. Only
        // that explicit absence may continue to the server's revision-0
        // DEFERRED tombstone command; every other read failure stays closed.
        if (!(error instanceof ApiError) || error.kind !== "http" || error.status !== 404) throw error;
        current = null;
      }
    }
    const deviceId = current?.deviceId || calibrationIntent?.deviceId || getDeviceId();
    const command = activationCommand("DEFERRED", current?.revision ?? 0);
    if (!scopeIsCurrent(requestScope)) return;
    try {
      current = await onboardingCalibrationApi.defer(deviceId, command.revision, command.idempotencyKey);
      if (!acceptCurrentCanonical(requestScope, current)) return;
    } catch (cause: unknown) {
      if (!scopeIsCurrent(requestScope)) return;
      const readback = await onboardingCalibrationApi.result(deviceId);
      if (!acceptCurrentCanonical(requestScope, readback)) return;
      if (readback.activationStatus !== "DEFERRED") {
        // Retry the exact same command. Reusing both revision and key lets
        // the server deduplicate a lost response and rejects a stale state.
        current = await onboardingCalibrationApi.defer(deviceId, command.revision, command.idempotencyKey);
        if (!acceptCurrentCanonical(requestScope, current)) return;
      } else {
        current = readback;
      }
      if (!current) throw cause;
    }
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
    uni.showToast({ title: t.value.onboarding.activationDeferredToast, icon: "none" });
    uni.reLaunch({ url: isRecal.value ? "/pages/me/devices" : "/pages/index/index", fail: () => {} });
  } catch {
    if (scopeIsCurrent(requestScope)) {
      failedAction.value = "defer";
      phase.value = "error";
    }
  } finally {
    if (scopeIsCurrent(requestScope)) activationBusy.value = false;
  }
}
function leaveConnect() {
  if (calInterval) clearInterval(calInterval);
  if (calTimeout) clearTimeout(calTimeout);
  requestGeneration += 1;
  uni.reLaunch({ url: isRecal.value ? "/pages/me/devices" : "/pages/onboarding/estimator", fail: () => {} });
}

onLoad((options) => {
  const o = (options || {}) as Record<string, string>;
  if (o.mode === "recalibrate") isRecal.value = true;
});
onUnmounted(() => {
  mounted = false;
  requestGeneration += 1;
  if (calInterval) clearInterval(calInterval);
  if (calTimeout) clearTimeout(calTimeout);
  if (raf) cancelAnimationFrame(raf);
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
.cn-sub { display: block; margin-top: 4px; font-size: 13px; color: var(--v5-ink-3); }
.cn-phase { margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }

.cn-why { background: var(--v5-surface); border-radius: 16px; padding: 16px; }
.cn-why__h { display: block; font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--v5-brand); }
.cn-why__list { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
.cn-point { display: flex; align-items: flex-start; gap: 10px; }
.cn-point__ic { width: 24px; height: 24px; border-radius: 6px; background: var(--v5-surface-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
.cn-point__t { flex: 1; font-size: 13px; line-height: 1.375; color: var(--v5-ink); }

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

.cn-score { position: relative; overflow: hidden; border-radius: 16px; padding: 20px; text-align: center; background: radial-gradient(70% 80% at 50% 0%, color-mix(in oklab, var(--v5-brand) 18%, transparent) 0%, transparent 60%), var(--v5-surface); border: 1px solid var(--v5-border); box-shadow: var(--v5-card-shadow-lift-strong); }
.cn-score__cap { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--v5-brand); }
.cn-score__cap-t { font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px; letter-spacing: 0.18em; color: var(--v5-brand); }
.cn-score__num { margin-top: 12px; display: flex; align-items: baseline; justify-content: center; gap: 4px; }
.cn-score__v { font-family: var(--font-v5); font-variant-numeric: tabular-nums; line-height: 1; letter-spacing: -0.025em; color: var(--v5-brand); font-size: 56px; font-weight: 600; }
.cn-score__d { font-family: var(--font-v5); font-variant-numeric: tabular-nums; color: var(--v5-ink-3); font-size: 20px; font-weight: 500; }
.cn-score__tier { display: block; margin-top: 8px; font-size: 13px; font-weight: 600; color: var(--v5-ink); }
.cn-score__yield { margin: 12px auto 0; display: inline-flex; align-items: baseline; gap: 8px; padding: 6px 12px; border-radius: 9999px; background: color-mix(in oklab, var(--v5-brand) 14%, transparent); }
.cn-score__yield-cap { font-family: var(--font-jet-mono), ui-monospace, monospace; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--v5-brand); }
.cn-score__yield-v { font-family: var(--font-v5); font-variant-numeric: tabular-nums; color: var(--v5-brand); font-size: 15px; font-weight: 600; }

.cn-summary { border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 8px; background: var(--v5-surface); }
.cn-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
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

.cn-cta { margin-top: auto; padding-top: 24px; }
.cn-go { width: 100%; height: 48px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--v5-brand); transition: transform 0.15s ease; }
.cn-go--glow { box-shadow: 0 0 24px color-mix(in oklab, var(--v5-brand) 35%, transparent); }
.cn-go__t { font-size: 15px; font-weight: 600; color: var(--v5-on-brand); }
.cn-go__t--on { font-size: 15px; }
.cn-error-actions { display: flex; flex-direction: column; gap: 10px; }
.cn-go--secondary { background: var(--v5-surface); border: 1px solid var(--v5-border); }
.cn-go__t--secondary { color: var(--v5-ink); }

.anim-up { animation: cn-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes cn-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.cn-fade-enter-active, .cn-fade-leave-active { transition: opacity 0.3s; }
.cn-fade-enter-from, .cn-fade-leave-to { opacity: 0; }
</style>
