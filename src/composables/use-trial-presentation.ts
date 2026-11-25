import { computed, ref, shallowRef, watchEffect } from "vue";
import { remoteApiEnabled } from "@/api/runtime";
import { useApp } from "@/store/app";
import { liveShadowNEX, liveShadowUSD, useFreeTrial } from "@/store/free-trial";
import { computeTrialOffset, resolveTrialCheckoutProductId, resolveTrialDeviceName, useTrialConfig, type TrialConfig } from "@/store/trial-config";
import type { TrialRowSnapshot } from "@/store/trial-boundary";
import { useNow } from "./use-now";

/** A retained row is presentation only. Mutations must still require a fresh authority. */
export function useTrialPresentation(displayActive?: () => boolean, options: {
  retainOnReadFailure?: boolean;
  retainWhileConfirming?: () => boolean;
} = {}) {
  const app = useApp();
  const trial = useFreeTrial();
  const trialConfig = useTrialConfig();
  const now = useNow(displayActive);
  type TrialPresentationRow = Pick<TrialRowSnapshot, "status" | "startedAt" | "expiresAt" | "graceEndsAt">
    & { config: TrialConfig; offsetUSD: number | null };
  const retained = shallowRef<TrialPresentationRow | null>(null);
  let binding = `${app.accountKey}:${app.accountBindingEpoch}`;
  const authorityRead = computed(() => !remoteApiEnabled || trial.authorityServerState !== null);
  // A cancel still being confirmed holds its row until it settles, also after a read already shows the trial cancelled.
  const holding = ref(false);
  const presentationReady = computed(() => authorityRead.value && !holding.value);
  const displayReady = computed(() => presentationReady.value
    || (options.retainOnReadFailure === true && trial.transientReadFailure && retained.value !== null));
  const readFailedWithoutData = computed(() => remoteApiEnabled && trial.lastReadFailed && !displayReady.value);
  const actionsReady = computed(() => !remoteApiEnabled || (trial.authorityStatus === "ready" && !trial.authorityResultUnknown));

  // Run after the store finishes applying/clearing a receipt. A synchronous
  // observer could retain the intermediate `none` row while a failed read clears.
  watchEffect(() => {
    const nextBinding = `${app.accountKey}:${app.accountBindingEpoch}`;
    if (binding !== nextBinding) {
      retained.value = null;
      binding = nextBinding;
    }
    // While held the row reads as an unknown result, as when the read fails (03 §3.5.2); it leaves with the one
    // confirmation toast, as when the cancel receipt is read directly (04 §4.6 设备页试用行).
    const held = retained.value;
    const next = authorityRead.value ? trial.snapshot() : null;
    const hold = !!options.retainWhileConfirming?.() && !!trial.pendingCancel && (held?.status === "active" || held?.status === "grace")
      && next?.status !== "active" && next?.status !== "grace";
    holding.value = hold;
    if (hold) return;
    if (next) retained.value = {
      ...next,
      config: { ...trialConfig.config },
      offsetUSD: trial.authoritativeOffsetUSD,
    };
    else if (options.retainWhileConfirming?.() && trial.displayState) {
      const state = trial.displayState;
      retained.value = {
        status: state.status,
        startedAt: state.startedAt,
        expiresAt: state.expiresAt,
        graceEndsAt: state.serverState === "EXTENDED" ? state.extendedEndsAt ?? null : state.graceEndsAt,
        config: { ...trialConfig.config },
        offsetUSD: state.offsetUSD ?? null,
      };
    }
    else if (options.retainOnReadFailure && trial.lastReadFailed && !trial.transientReadFailure) retained.value = null;
  });

  const status = computed(() => retained.value?.status ?? null);
  const active = computed(() => status.value === "active" || status.value === "grace");
  const config = computed(() => displayReady.value ? retained.value?.config ?? null : null);
  const deviceName = computed(() => retained.value
    ? resolveTrialDeviceName(retained.value.config.trialProductId, retained.value.config.trialProductName) : null);
  const productId = computed(() => retained.value ? resolveTrialCheckoutProductId(retained.value.config.trialProductId) : null);
  const imageUrl = computed(() => retained.value?.config.imageUrl);
  const reservedSlots = computed(() => presentationReady.value && trial.authorityStatus !== "error" ? (active.value ? 1 : 0) : null);
  const remainingMs = computed(() => {
    if (!displayReady.value || !retained.value) return null;
    const boundary = status.value === "active" ? retained.value.expiresAt
      : status.value === "grace" ? retained.value.graceEndsAt : null;
    return boundary === null ? null : Math.max(0, boundary - trial.serverTimeAt(now.value * 1000));
  });
  const shadowUSD = computed(() => presentationReady.value ? liveShadowUSD(now.value * 1000) : null);
  const shadowNEX = computed(() => presentationReady.value ? liveShadowNEX(now.value * 1000) : null);
  const localOffset = computed(() => config.value && shadowUSD.value !== null
    ? computeTrialOffset(config.value, shadowUSD.value) : null);
  // Remote credit is a claim-owned amount. The current promotion policy cannot
  // reconstruct it when the server has not supplied a confirmed projection.
  const offsetUSD = computed(() => !displayReady.value ? null : remoteApiEnabled
    ? retained.value?.offsetUSD ?? null : localOffset.value?.offsetUSD ?? null);
  const remainderUSD = computed(() => !presentationReady.value ? null : remoteApiEnabled
    ? trial.authoritativeRemainderUSD : localOffset.value?.remainderUSD ?? null);
  const estimatedUSD = computed(() => {
    const row = retained.value;
    if (!displayReady.value || !row || !config.value || config.value.shadowDailyUSD === null) return null;
    const duration = !remoteApiEnabled && row.startedAt !== null && row.expiresAt !== null
      ? Math.max(0, row.expiresAt - row.startedAt) / 86_400_000 : config.value.trialDays;
    return duration * config.value.shadowDailyUSD;
  });
  const estimatedOffsetUSD = computed(() => config.value && estimatedUSD.value !== null
    ? computeTrialOffset(config.value, estimatedUSD.value).offsetUSD : null);
  const offsetProgress = computed(() => offsetUSD.value === null || estimatedOffsetUSD.value === null
    ? null : estimatedOffsetUSD.value > 0 ? Math.min(1, offsetUSD.value / estimatedOffsetUSD.value) : 0);

  return {
    presentationReady, displayReady, readFailedWithoutData, actionsReady, status, active, config, deviceName, productId, imageUrl, reservedSlots,
    remainingMs, shadowUSD, shadowNEX, offsetUSD, remainderUSD, estimatedUSD, estimatedOffsetUSD, offsetProgress,
    refresh: () => trial.poll(Date.now()),
  };
}
