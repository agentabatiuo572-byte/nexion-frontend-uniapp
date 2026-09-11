<template>
  <StandalonePageShell class="cn-root" :top-inset="24">
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
          <text class="cn-prog-row__t">{{ t.onboarding.detecting }}</text>
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
            <text class="cn-score__v">{{ finalScore }}</text>
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
            <view v-if="r.value !== '—'" class="cn-row__check">
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
      <view v-if="phase === 'result'" class="cn-go cn-go--on active:scale-[0.98]" role="button" :tabindex="activationBusy ? -1 : 0" :aria-disabled="activationBusy" data-system-chrome-primary @click="activate" @keydown.enter.prevent="activate" @keydown.space.prevent="activate">
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
import { navReset } from "@/lib/route";
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { onLoad, onBackPress } from "@dcloudio/uni-app";
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
import type { OnboardingCalibration } from "@/api/onboarding-calibration-api";
import { calibrationBelongsTo, createPhoneCalibrationFlow } from "@/lib/phone-calibration-flow";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import type { RemoteAccountRequest } from "@/lib/remote-account-epoch";
import { confirmDeferredPhoneActivation } from "@/lib/defer-phone-activation";
import { isCurrentOnboardingCalibrationScope, type OnboardingCalibrationScope } from "@/lib/onboarding-calibration-scope";

const t = useT();
const auth = useAuth();

// Recalibrate mode (?mode=recalibrate) = new-device re-measure; otherwise the
// first-time onboarding calibration. Set in onLoad.
const isRecal = ref(false);
const resumeDeferred = ref(false);

type Phase = "intro" | "calibrating" | "result" | "error";
type FailedAction = "calibration" | "activate" | "defer";
const phase = ref<Phase>("intro");
const failedAction = ref<FailedAction>("calibration");

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
watch(authenticatedAccountKey, (next, previous) => {
  if (next === previous) return;
  // Remote login hydrates the non-secret account routing key after the
  // authenticated page is already mounted. That one-way bootstrap is not an
  // account switch and must not invalidate an in-flight server calibration.
  if ((!previous || previous === "default") && next && next !== "default") return;
  activationBusy.value = false;
  accountEpoch += 1;
  requestGeneration += 1;
  calibrationFlow.reset();
  activationIntent = null;
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

// Initial onboarding reuses the estimator's canonical result. Only an explicit
// warehouse remeasurement/resume can replace an existing calibration.
const calibrationFlow = createPhoneCalibrationFlow({ api: onboardingCalibrationApi,
  collect: collectDeviceSignals, key: () => `onboarding:${requireCryptoUuid()}` });
let activationIntent: { target: "ACTIVE" | "DEFERRED"; revision: number; idempotencyKey: string } | null = null;
const activationBusy = ref(false);

async function startCalibration() {
  canonical.value = null;
  activationIntent = null;
  const requestScope = { ...currentScope(), generation: ++requestGeneration };
  try {
    const result = await calibrationFlow.run({ deviceId: getDeviceId(), accountKey: accountKey(),
      isCurrent: () => scopeIsCurrent(requestScope), recalibrate: isRecal.value || resumeDeferred.value });
    if (!acceptCurrentCanonical(requestScope, result)) return;
    canonical.value = result;
    if (result.activationStatus === "DEFERRED") {
      resumeDeferred.value = true;
      phase.value = "intro";
      return;
    }
    if (!result.calibrationAvailable) throw new Error("ONBOARDING_CALIBRATION_UNAVAILABLE");
    phase.value = "result";
  } catch {
    if (!mounted || !isCurrentOnboardingCalibrationScope(requestScope, currentScope())) return;
    failedAction.value = "calibration";
    phase.value = "error";
  }
}

const tierLabel = computed(() => fmt(t.value.onboarding.resultTier, { n: finalTier.value }));
const resultRows = computed(() => [
  { label: t.value.onboarding.testNpu, value: fmt(t.value.onboarding.resultComputeMetric, { n: finalTops.value }) },
  { label: t.value.onboarding.testNetwork, value: finalPing.value === null ? "—" : `${finalPing.value}ms` },
  { label: t.value.onboarding.testPower, value: finalBattery.value === null ? "—" : `${finalBattery.value}%` },
]);
const policyLines = computed(() => [
  t.value.onboarding.policyLine1,
  t.value.onboarding.policyLine2,
  t.value.onboarding.policyLine3,
]);

// start calibration when entering that phase
watch(phase, (p) => {
  if (p === "calibrating") startCalibration();
});

function retryCalibration() {
  if (activationBusy.value) return;
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

async function activate() {
  if (!mounted || !canonical.value?.calibrationAvailable || activationBusy.value) return;
  activationBusy.value = true;
  const requestScope = { ...currentScope() };
  const before = canonical.value;
  const command = activationCommand("ACTIVE", before.revision);
  const app = useApp();
  // Apply the server-confirmed baseline to the live phone device + record this
  // device as the account's calibrated device (so future logins on it skip
  // recalibration, while a different device triggers it).
  try {
    let activated: OnboardingCalibration;
    try {
      activated = await onboardingCalibrationApi.activate(before.deviceId, command.revision, command.idempotencyKey);
    } catch (cause) {
      if (!scopeIsCurrent(requestScope)) return;
      const readback = await onboardingCalibrationApi.result(before.deviceId);
      if (!acceptCurrentCanonical(requestScope, readback)) return;
      canonical.value = readback;
      if (!readback.calibrationAvailable || readback.activationStatus !== "ACTIVE") throw cause;
      activated = readback;
    }
    if (!acceptCurrentCanonical(requestScope, activated)) return;
    if (!activated.calibrationAvailable || activated.activationStatus !== "ACTIVE") throw new Error("PHONE_ACTIVATION_NOT_CONFIRMED");
    app.applyPhoneCalibration({ score: activated.score!, tier: activated.tier!, tops: activated.tops!,
      baseRateUsdt: activated.baseRateUsdt!, baseRateNex: activated.baseRateNex!, signals: activated.signals! });
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
    navReset({ url: "/pages/index/index", fail: () => {} });
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
    const current = await confirmDeferredPhoneActivation({
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
    uni.showToast({ title: t.value.onboarding.activationDeferredToast, icon: "none" });
    navReset({ url: isRecal.value ? "/pages/me/devices" : "/pages/index/index", fail: () => {} });
  } catch {
    if (scopeIsCurrent(requestScope)) {
      // A conflicting or uncertain write can leave the cached revision stale.
      // The next explicit retry must first read the latest server decision.
      canonical.value = null;
      failedAction.value = "defer";
      phase.value = "error";
    }
  } finally {
    if (scopeIsCurrent(requestScope)) activationBusy.value = false;
  }
}
function leaveConnect() {
  if (activationBusy.value || phase.value === "calibrating") return;
  requestGeneration += 1;
  navReset({ url: isRecal.value ? "/pages/me/devices" : "/pages/onboarding/estimator", fail: () => {} });
}

onLoad((options) => {
  const o = (options || {}) as Record<string, string>;
  if (o.mode === "recalibrate") isRecal.value = true;
  if (o.mode === "resume") resumeDeferred.value = true;
});
onMounted(() => {
  if (!isRecal.value && !resumeDeferred.value) phase.value = "calibrating";
});
onBackPress(() => { leaveConnect(); return true; });
onUnmounted(() => {
  mounted = false;
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
