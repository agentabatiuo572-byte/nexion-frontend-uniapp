<!--
  Withdrawal tracking (ported from Nexion-prototype/app/(main)/me/wallet/withdraw/tracking/page.tsx).
  5-step status stepper. Reads app.latestWithdrawal; empty state when none.
  Status is display-only here; backend/admin simulation owns progression.
  Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 16px">
      <SubPageHeader :back="'/pages/me/wallet'" :title="wd ? wd.id : t.wallet.withdrawalStatusSubtitle" />

      <!-- Empty — no top gap; the sub-page header already provides the 24px inset. -->
      <view v-if="!wd" class="px-5 text-center">
        <text class="block" :style="emptyTextStyle">{{ t.wallet.noActiveWithdrawal }}</text>
        <!-- 《07》tap≥44:空状态的行动链接独占一行,不吃 WCAG 2.5.8 的 inline 豁免 → 撑热区(原 88×22) -->
        <view class="active:opacity-70" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0 8px; margin-top: 4px" role="button" tabindex="0" :aria-label="t.wallet.submitNewWithdrawal" @click.stop="goWithdraw">
          <text :style="emptyLinkStyle">{{ t.wallet.submitNewWithdrawal }}</text>
        </view>
      </view>

      <template v-else>
        <!-- Single-theme continuous flow: page-floor blocks separated by 12px,
             hairlines open the stepper + ETA groups (de-carded). -->
        <view class="px-4" style="display: flex; flex-direction: column; gap: 12px">
          <!-- Amount hero — de-carded to the page floor (no surface/border; the
               floor glow + dot-grid are deleted, not re-tuned). -->
          <view :style="heroStyle">
            <text class="block" :style="amountLabelStyle">{{ t.wallet.trackAmountLabel }}</text>
            <text class="block" :style="amountStyle">${{ wd.amount.toFixed(2) }}</text>
            <text class="block" :style="viaStyle">{{ viaLine }}</text>
            <text class="block" :style="addrStyle">{{ wd.address }}</text>
          </view>

          <!-- Status stepper — outer card dropped, stepper structure kept;
               hairline opens the group. -->
          <view :style="stepperStyle">
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
                  <view v-else-if="i === currentIdx" class="grid place-items-center glow-green" :style="currentIconStyle">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                  </view>
                  <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2"><circle cx="12" cy="12" r="9" /></svg>
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

          <!-- Estimated completion / SPEC-7 风控持有态(manual/delay=审核中,freeze=冻结)
               normal = floor note (hairline opens it); frozen = danger accent callout. -->
          <view class="flex items-start" :style="isFrozenHold ? etaFrozenCardStyle : etaCardStyle">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" :stroke="isFrozenHold ? 'var(--v5-danger)' : 'var(--v5-brand)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
            <view style="flex: 1">
              <text class="block" :style="etaTitleStyle">{{ etaTitle }}</text>
              <text class="block" :style="etaSubStyle">{{ etaSub }}</text>
              <view v-if="heldReasonLines.length" style="margin-top: 6px">
                <text v-for="line in heldReasonLines" :key="line" class="block" :style="reasonLineStyle">· {{ line }}</text>
              </view>
            </view>
          </view>

          <!-- Back to wallet -->
          <view class="flex items-center justify-center active:opacity-80" :style="backBtnStyle" role="button" tabindex="0" :aria-label="t.wallet.trackBackToWallet" @click.stop="goWallet">
            <text>{{ t.wallet.trackBackToWallet }}</text>
          </view>
        </view>
      </template>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
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
const routeHeld = computed(() => !!wd.value?.riskRoute && wd.value.riskRoute !== "pass");
// SPEC-7: freeze 路由/冻结状态用独立危险态文案;manual/delay 用审核中文案。
const isFrozenHold = computed(() => wd.value?.riskRoute === "freeze" || wd.value?.status === "frozen");
// 命中原因 → 业务话术(工程 reason code 不直出;R5: 展示存单快照的服务端结论)。
const heldReasonLines = computed(() => {
  if (!routeHeld.value) return [] as string[];
  const dict = t.value.wallet.riskReasons as Record<string, string>;
  return (wd.value?.riskReasons ?? []).map((code) => dict[code]).filter(Boolean);
});
const viaLine = computed(() =>
  wd.value ? fmt(t.value.wallet.trackViaLine, { network: wd.value.network, fee: wd.value.fee.toFixed(2) }) : "",
);
const etaTitle = computed(() =>
  wd.value?.status === "confirmed"
    ? t.value.wallet.trackEtaDone
    : isFrozenHold.value
      ? t.value.wallet.routeHeldFrozenTitle
      : routeHeld.value
        ? t.value.wallet.withdrawRouteHeldTitle
        : t.value.wallet.trackEtaPending,
);
const etaSub = computed(() =>
  isFrozenHold.value
    ? t.value.wallet.routeHeldFrozenBody
    : routeHeld.value
      ? t.value.wallet.withdrawRouteHeldSub
      : t.value.wallet.trackReviewNote,
);

function relTime(ts: number): string {
  if (ts > Date.now()) return t.value.wallet.timePending;
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return t.value.wallet.timeJustNow;
  if (m < 60) return fmt(t.value.wallet.timeMinutesAgo, { n: m });
  return fmt(t.value.wallet.timeHoursAgo, { n: Math.floor(m / 60) });
}

function goWithdraw() {
  navTo("/pages/me/wallet-withdraw");
}
function goWallet() {
  navTo("/me/wallet");
}

const emptyTextStyle: CSSProperties = { fontSize: "13px", color: "var(--v5-ink-2)" };
const emptyLinkStyle: CSSProperties = { fontSize: "13px", color: "var(--v5-brand)" };
// De-carded amount hero — left-aligned on the page floor (2px optical inset);
// no surface/border, and the floor glow + dot-grid element are deleted outright.
const heroStyle: CSSProperties = { padding: "0 2px" };
const amountLabelStyle: CSSProperties = { fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", fontWeight: 500, color: "var(--v5-ink-3)", letterSpacing: "0.06em" };
const amountStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "34px", fontWeight: 600, color: "var(--v5-ink)", marginTop: "4px", fontVariantNumeric: "tabular-nums" };
const viaStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", marginTop: "4px" };
const addrStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-4)", marginTop: "8px", fontFamily: "var(--font-jet-mono), ui-monospace, monospace", wordBreak: "break-all" };
// De-carded — the stepper structure is kept; a hairline opens the group and
// content sits at the 2px optical inset (no surface/border).
const stepperStyle: CSSProperties = { padding: "8px 2px 0", borderTop: "1px solid var(--v5-border)" };
const progressLabelStyle: CSSProperties = { marginBottom: "14px", fontFamily: "var(--font-jet-mono), ui-monospace, monospace", fontSize: "12px", fontWeight: 500, color: "var(--v5-ink-3)", letterSpacing: "0.06em" };
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
  return { fontSize: "13px", fontWeight: 500, color: pending ? "var(--v5-ink-4)" : "var(--v5-ink)" };
}
const stepHintStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", marginTop: "2px" };
const stepTimeStyle: CSSProperties = { fontFamily: "var(--font-v5)", fontSize: "12px", color: "var(--v5-ink-4)", marginTop: "2px", fontVariantNumeric: "tabular-nums" };
// Normal ETA — floor note; a hairline opens it (no surface/border).
const etaCardStyle: CSSProperties = { gap: "12px", padding: "8px 2px 0", borderTop: "1px solid var(--v5-border)" };
// Frozen/held ETA — danger accent callout (tint + border: the whitelisted
// accent-callout exception, reserved for a genuine alert state).
const etaFrozenCardStyle: CSSProperties = {
  gap: "12px",
  padding: "16px",
  borderRadius: "16px",
  background: "color-mix(in srgb, var(--v5-danger) 8%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-danger) 30%, transparent)",
};
const etaTitleStyle: CSSProperties = { fontSize: "13px", fontWeight: 500, color: "var(--v5-ink)" };
const etaSubStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", marginTop: "2px" };
const reasonLineStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-3)", lineHeight: 1.5 };
const backBtnStyle: CSSProperties = {
  width: "100%",
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--v5-ink)",
  transition: "opacity 150ms ease",
};
</script>
