<!--
  Withdrawal tracking (ported from Nexion-prototype/app/(main)/me/wallet/withdraw/tracking/page.tsx).
  5-step status stepper auto-advancing on a 3.5s page-level interval (cleared via
  onUnmounted per P-021). Reads app.latestWithdrawal; empty state when none.
  Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 16px">
      <SubPageHeader :back="'/pages/me/wallet'" :title="wd ? wd.id : t.wallet.withdrawalStatusSubtitle" />

      <!-- Empty -->
      <view v-if="!wd" class="px-5 text-center" style="padding-top: 16px">
        <text class="block" :style="emptyTextStyle">{{ t.wallet.noActiveWithdrawal }}</text>
        <view class="active:opacity-70" style="display: inline-block; margin-top: 12px" role="button" tabindex="0" :aria-label="t.wallet.submitNewWithdrawal" @tap.stop="goWithdraw" @click.stop="goWithdraw">
          <text :style="emptyLinkStyle">{{ t.wallet.submitNewWithdrawal }}</text>
        </view>
      </view>

      <template v-else>
        <!-- Summary -->
        <view class="mx-4 relative overflow-hidden" :style="summaryStyle">
          <view :style="dotGridStyle" />
          <view class="relative text-center">
            <text class="block" :style="amountLabelStyle">{{ t.wallet.trackAmountLabel }}</text>
            <text class="block" :style="amountStyle">${{ wd.amount.toFixed(2) }}</text>
            <text class="block" :style="viaStyle">{{ viaLine }}</text>
            <text class="block" :style="addrStyle">{{ wd.address }}</text>
          </view>
        </view>

        <!-- Status stepper -->
        <view class="mx-4" :style="stepperCardStyle">
          <text class="block" :style="progressLabelStyle">{{ t.wallet.trackProgressLabel }}</text>
          <view class="relative">
            <view v-for="(step, i) in steps" :key="step.key" class="flex relative" :style="stepLiStyle(i === steps.length - 1)">
              <!-- connector -->
              <view v-if="i < steps.length - 1" :style="connectorStyle(i < currentIdx)" />
              <!-- icon -->
              <view class="grid place-items-center shrink-0" style="width: 24px; height: 24px">
                <view v-if="i < currentIdx" class="grid place-items-center" :style="doneIconStyle">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </view>
                <view v-else-if="i === currentIdx" class="grid place-items-center" :style="currentIconStyle">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                </view>
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2"><circle cx="12" cy="12" r="9" /></svg>
              </view>
              <!-- text -->
              <view style="flex: 1; padding-top: 2px">
                <text class="block" :style="stepLabelStyle(i > currentIdx)">{{ step.label }}</text>
                <text class="block" :style="stepHintStyle">{{ step.hint }}</text>
                <text v-if="i <= currentIdx" class="block" :style="stepTimeStyle">{{ relTime(wd.submittedAt + i * STEP_DELAY_MS) }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- Estimated completion -->
        <view class="mx-4 flex items-center" :style="etaCardStyle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
          <view style="flex: 1">
            <text class="block" :style="etaTitleStyle">{{ wd.status === "confirmed" ? t.wallet.trackEtaDone : t.wallet.trackEtaPending }}</text>
            <text class="block" :style="etaSubStyle">{{ t.wallet.trackReviewNote }}</text>
          </view>
        </view>

        <view class="mx-4" style="margin-top: 16px; margin-bottom: 8px">
          <view class="flex items-center justify-center active:opacity-80" :style="backBtnStyle" role="button" tabindex="0" :aria-label="t.wallet.trackBackToWallet" @tap.stop="goWallet" @click.stop="goWallet">
            <text>{{ t.wallet.trackBackToWallet }}</text>
          </view>
        </view>
      </template>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import type { WithdrawalStatus } from "@/store/types";
import { navTo } from "@/lib/route";

const STEP_DELAY_MS = 3500;

const t = useT();
const app = useApp();
const wd = computed(() => app.latestWithdrawal);

const steps = computed<{ key: WithdrawalStatus; label: string; hint: string }[]>(() => [
  { key: "submitted", label: t.value.wallet.submitted, hint: t.value.wallet.trackSubmittedHint },
  { key: "review-passed", label: t.value.wallet.reviewPassed, hint: t.value.wallet.trackReviewHint },
  { key: "processing", label: t.value.wallet.processing, hint: t.value.wallet.trackProcessingHint },
  { key: "sent", label: t.value.wallet.sent, hint: t.value.wallet.trackSentHint },
  { key: "confirmed", label: t.value.wallet.confirmed, hint: t.value.wallet.trackConfirmedHint },
]);

const currentIdx = computed(() => steps.value.findIndex((s) => s.key === wd.value?.status));
const viaLine = computed(() =>
  wd.value ? fmt(t.value.wallet.trackViaLine, { network: wd.value.network, fee: wd.value.fee.toFixed(2) }) : "",
);

let timer: ReturnType<typeof setTimeout> | null = null;
function scheduleAdvance() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const cur = wd.value;
  if (!cur || cur.status === "confirmed") return;
  timer = setTimeout(() => {
    app.advanceWithdrawal();
  }, STEP_DELAY_MS);
}
// Re-arm whenever the withdrawal status changes (mirrors the source status watcher).
watch(
  () => wd.value?.status,
  () => scheduleAdvance(),
  { immediate: true },
);
onUnmounted(() => {
  if (timer) clearTimeout(timer);
  timer = null;
});

function relTime(ts: number): string {
  if (ts > Date.now()) return "—";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function goWithdraw() {
  navTo("/pages/me/wallet-withdraw");
}
function goWallet() {
  navTo("/me/wallet");
}

const emptyTextStyle: CSSProperties = { fontSize: "14px", color: "var(--v5-ink-2)" };
const emptyLinkStyle: CSSProperties = { fontSize: "12.5px", color: "var(--v5-brand)" };
const summaryStyle: CSSProperties = {
  borderRadius: "16px",
  border: "1px solid var(--v5-border)",
  background: "var(--v5-surface)",
  padding: "20px",
};
const dotGridStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  height: "80px",
  backgroundImage: "radial-gradient(color-mix(in srgb, var(--v5-ink) 12%, transparent) 1px, transparent 1px)",
  backgroundSize: "12px 12px",
  opacity: 0.5,
  maskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
  WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
};
const amountLabelStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "11px", fontWeight: 500, color: "var(--v5-ink-3)", letterSpacing: "0.06em" };
const amountStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "30px", fontWeight: 600, color: "var(--v5-ink)", marginTop: "4px" };
const viaStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", marginTop: "4px" };
const addrStyle: CSSProperties = { fontSize: "11.5px", color: "var(--v5-ink-4)", marginTop: "8px", fontFamily: "var(--font-jet-mono), ui-monospace, monospace", wordBreak: "break-all" };
const stepperCardStyle: CSSProperties = {
  marginTop: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  padding: "20px",
};
const progressLabelStyle: CSSProperties = { marginBottom: "14px", fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "11px", fontWeight: 500, color: "var(--v5-ink-3)", letterSpacing: "0.06em" };
function stepLiStyle(last: boolean): CSSProperties {
  return { gap: "12px", paddingBottom: last ? "0" : "20px" };
}
function connectorStyle(done: boolean): CSSProperties {
  return {
    position: "absolute",
    left: "11px",
    top: "28px",
    bottom: "4px",
    width: "1px",
    background: done ? "var(--v5-brand)" : "var(--v5-surface-2)",
  };
}
const doneIconStyle: CSSProperties = { width: "24px", height: "24px", borderRadius: "999px", background: "color-mix(in srgb, var(--v5-brand) 15%, transparent)" };
const currentIconStyle: CSSProperties = { width: "24px", height: "24px", borderRadius: "999px", background: "color-mix(in srgb, var(--v5-brand) 15%, transparent)" };
function stepLabelStyle(pending: boolean): CSSProperties {
  return { fontSize: "13.5px", fontWeight: 500, color: pending ? "var(--v5-ink-4)" : "var(--v5-ink)" };
}
const stepHintStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", marginTop: "2px" };
const stepTimeStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "11.5px", color: "var(--v5-ink-4)", marginTop: "2px" };
const etaCardStyle: CSSProperties = {
  marginTop: "12px",
  gap: "12px",
  background: "var(--v5-surface)",
  border: "1px solid color-mix(in srgb, var(--v5-border) 70%, transparent)",
  borderRadius: "16px",
  padding: "16px",
};
const etaTitleStyle: CSSProperties = { fontSize: "12.5px", fontWeight: 500, color: "var(--v5-ink)" };
const etaSubStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", marginTop: "2px" };
const backBtnStyle: CSSProperties = {
  width: "100%",
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
  fontSize: "13.5px",
  fontWeight: 500,
  color: "var(--v5-ink)",
};
</script>
