<!--
  WalletWithdraw — ported from Nexion-prototype/app/(main)/me/wallet/withdraw/page.tsx.
  Top→bottom: KYC-Express gate (banner until wallet paired / verified pill after,
  with a dev-only ?dev=1 reset) → compliance-hold banner (P5+) → amount input
  (Use Max) → network select → address input → fee/receive summary → warnings →
  StakeAlternativeCard (≥$20) → contribution-points gate (progress + check-in /
  re-invest CTAs) → sticky submit.

  Gates (all from ported stores): wallet-pairing (must be paired), amount ∈
  [$20, balance], address.len > 10, points ≥ pointsRequiredFor(amount, phase).
  Submit composes points.spend + app.submitWithdrawal (atomic debit) + bills.add
  (the source's cross-store handler; rolls back points if the debit fails). Then
  → /me/wallet/withdraw/tracking. Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink)">
      <!-- In-page header -->
      <view class="flex items-center" :style="headerStyle">
        <view class="grid place-items-center active:opacity-60" :style="backBtnStyle" @click="goBack">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </view>
        <view class="min-w-0 flex-1">
          <text class="block truncate" :style="headerTitleStyle">USDT</text>
          <text class="block truncate" style="font-size: 12px; color: var(--v5-ink-3)">{{ t.wallet.withdraw }}</text>
        </view>
      </view>

      <!-- KYC gate (unpaired) -->
      <view v-if="!walletPaired" class="mx-4 mb-3" :style="kycGateStyle">
        <view class="flex items-start" style="gap: 10px">
          <view class="shrink-0 grid place-items-center" :style="kycGateIconStyle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
          </view>
          <view class="flex-1 min-w-0">
            <text class="block" style="font-size: 13.5px; font-weight: 600; color: var(--v5-ink)">{{ t.walletV3.complianceHeroTitle }}</text>
            <text class="block" style="font-size: 11.5px; color: var(--v5-ink-3); margin-top: 4px; line-height: 1.4">{{ t.wallet.complianceGateBody }}</text>
          </view>
        </view>
        <view class="mt-3 w-full grid place-items-center active:opacity-85" :style="kycGateCtaStyle" @click="goKyc">
          <view class="inline-flex items-center" style="gap: 6px">
            <text>Complete KYC-Express ($1)</text>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </view>
        </view>
        <text class="block text-center" style="margin-top: 8px; font-size: 10.5px; color: var(--v5-ink-4); line-height: 1.4">🛡 Powered by Chainalysis KYT · SOC 2 Type II audited</text>
      </view>

      <!-- KYC verified pill -->
      <view v-else class="mx-4 mb-3 flex items-center" :style="kycPillStyle">
        <view class="grid place-items-center shrink-0" :style="kycPillIconStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
        </view>
        <view class="flex-1 min-w-0" style="margin-left: 10px">
          <text class="block" style="font-size: 12px; color: var(--v5-brand); font-weight: 500">KYC-Express verified</text>
          <text class="block truncate font-mono" style="font-size: 10.5px; color: var(--v5-ink-3); margin-top: 2px">{{ pairedAddressShort }}{{ pairedNetwork ? ' · ' + pairedNetwork : '' }}</text>
        </view>
        <view v-if="devMode" class="shrink-0 inline-flex items-center active:opacity-80" :style="resetBtnStyle" @click="handleResetKyc">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
          <text style="margin-left: 4px">Reset KYC</text>
        </view>
      </view>

      <!-- Compliance-hold banner (P5+) -->
      <view v-if="complianceHoldEnabled" class="mx-4 mb-3 flex items-start" :style="holdBannerStyle">
        <view class="grid place-items-center shrink-0" :style="holdIconStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
        </view>
        <view class="flex-1 min-w-0" style="margin-left: 10px">
          <text class="block" style="font-size: 12px; color: var(--v5-warning); font-weight: 500">{{ t.walletV3.complianceHoldTitle }}</text>
          <text class="block" style="font-size: 10.5px; color: var(--v5-ink-3); margin-top: 2px; line-height: 1.4">{{ holdBody }}</text>
        </view>
      </view>

      <!-- Amount input -->
      <view class="mx-4 rounded-2xl border" :style="surfaceCardStyle">
        <view class="flex items-center justify-between">
          <text class="font-mono-tabular" :style="metaLabelStyle">Amount</text>
          <view class="inline-flex items-center active:opacity-70" style="min-height: 44px; padding: 0 10px; margin: -12px -8px -12px 0" @click="useMax">
            <text style="font-size: 12px; color: var(--v5-brand)">Use Max</text>
          </view>
        </view>
        <view class="flex items-baseline" style="margin-top: 8px; gap: 8px">
          <text style="font-family: var(--font-v5); font-size: 24px; color: var(--v5-ink-3)" class="shrink-0">$</text>
          <input class="flex-1 min-w-0 tabular-nums" :style="amountInputStyle" type="text" inputmode="decimal" :value="amount" placeholder="0.00" @input="onAmount" />
          <text class="shrink-0" style="font-size: 12px; color: var(--v5-ink-3)">USDT</text>
        </view>
        <view class="flex items-center justify-between" style="margin-top: 8px; font-size: 12px; color: var(--v5-ink-3)">
          <text>Available: <text class="tabular-nums" style="color: var(--v5-ink-2); font-family: var(--font-v5)">${{ usdtBalance.toFixed(2) }}</text></text>
          <text>Min: $20</text>
        </view>
      </view>

      <!-- Network select -->
      <view class="mx-4 mt-3 rounded-2xl border overflow-hidden" :style="surfaceCardFlush">
        <text class="block font-mono-tabular" :style="[metaLabelStyle, { padding: '16px 20px 8px' }]">Network</text>
        <view
          v-for="(n, i) in NETWORKS"
          :key="n.id"
          class="w-full flex items-center active:opacity-90"
          :style="networkRowStyle(network === n.id, i !== 0)"
          @click="network = n.id"
        >
          <view class="grid place-items-center" :style="radioStyle(network === n.id)">
            <view v-if="network === n.id" style="width: 8px; height: 8px; border-radius: 50%; background: var(--v5-brand)" />
          </view>
          <view class="flex-1" style="margin-left: 12px">
            <view class="flex items-center" style="gap: 8px">
              <text style="font-size: 13.5px; font-weight: 500; color: var(--v5-ink)">{{ n.label }}</text>
              <text v-if="n.recommended" :style="recommendedChipStyle">Recommended</text>
            </view>
            <text class="block" style="font-size: 12px; color: var(--v5-ink-3); margin-top: 2px">{{ n.hint }}</text>
          </view>
        </view>
      </view>

      <!-- Address input -->
      <view class="mx-4 mt-3 rounded-2xl border" :style="surfaceCardStyle">
        <text class="block font-mono-tabular" :style="metaLabelStyle">Withdrawal Address</text>
        <input class="nx-withdraw-address-input mt-2 w-full font-mono" :style="addressInputStyle" type="text" :value="address" :placeholder="addressPlaceholder" @input="onAddress" />
      </view>

      <!-- Summary -->
      <view class="mx-4 mt-3 rounded-2xl border space-y-1.5" :style="[surfaceCardStyle, { padding: '16px' }]">
        <view class="flex items-center justify-between">
          <text style="font-size: 12px; color: var(--v5-ink-3)">{{ t.wallet.feeLabel }}</text>
          <text class="tabular-nums" style="font-size: 12.5px">${{ fee.toFixed(2) }}</text>
        </view>
        <view class="flex items-center justify-between">
          <text style="font-size: 12px; color: var(--v5-ink-2)">{{ t.wallet.receiveLabel }}</text>
          <text class="tabular-nums" style="font-size: 18px; font-weight: 600">${{ receive.toFixed(2) }}</text>
        </view>
      </view>

      <!-- Warnings -->
      <view class="mx-4 mt-3 rounded-2xl" :style="warnBoxStyle">
        <view class="flex items-start" style="gap: 8px; font-size: 12px; color: var(--v5-warning)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" style="margin-top: 2px"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
          <view class="space-y-1" style="line-height: 1.4">
            <text class="block">{{ t.wallet.firstTimeReview }}</text>
            <text class="block">{{ t.wallet.minWithdrawNote }}</text>
            <text class="block">{{ t.wallet.dailyLimitNote }}</text>
          </view>
        </view>
      </view>

      <!-- Reverse-talk staking alternative -->
      <StakeAlternativeCard v-if="amountNum >= 20" :amount-num="amountNum" />

      <!-- Contribution-points gate -->
      <view v-if="amountNum > 0" class="mx-4 mt-3 rounded-2xl border" :style="pointsGateStyle">
        <view class="flex items-center justify-between" style="margin-bottom: 10px">
          <view class="flex items-center" :style="pointsGateLabelStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="hasEnoughPoints ? 'var(--v5-brand)' : 'var(--v5-brand-2)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 3 1.9 4.6L16 9.5l-4.6 1.9L9.5 16l-1.9-4.6L3 9.5l4.6-1.9z" /></svg>
            <text style="margin-left: 6px">{{ t.walletV3.contribPoints }}</text>
          </view>
          <text class="font-mono-tabular tabular-nums" style="font-size: 11px; color: var(--v5-ink)">{{ pointsBalance }} / {{ requiredPoints }}</text>
        </view>
        <view class="rounded-full overflow-hidden" style="height: 8px; background: color-mix(in srgb, var(--v5-surface-2) 60%, transparent)">
          <view class="h-full rounded-full" :style="pointsBarStyle" />
        </view>
        <view v-if="hasEnoughPoints" style="margin-top: 8px">
          <text style="font-size: 11px; color: var(--v5-brand)">{{ enoughPointsText }}</text>
        </view>
        <view v-else style="margin-top: 8px">
          <text class="block" style="font-size: 11.5px; color: var(--v5-ink); line-height: 1.4">{{ needMoreText }}</text>
          <view class="grid grid-cols-2" style="margin-top: 8px; gap: 8px">
            <view class="grid place-items-center active:opacity-70" :style="checkInBtnStyle" @click="onCheckIn">
              <view class="inline-flex items-center" style="gap: 6px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                <text>{{ t.walletV3.dailyCheckIn }}</text>
              </view>
            </view>
            <view class="grid place-items-center active:opacity-90" :style="reinvestBtnStyle" @click="goReinvest">
              <view class="inline-flex items-center" style="gap: 6px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
                <text>{{ t.walletV3.reinvestNow }}</text>
              </view>
            </view>
          </view>
          <text class="block" style="margin-top: 8px; font-size: 10.5px; color: var(--v5-ink-3); line-height: 1.4">{{ t.walletV3.pointsRule }}</text>
        </view>
      </view>

      <!-- Sticky submit -->
      <view class="mx-4 mt-4" style="padding-bottom: 12px">
        <view class="nx-withdraw-submit-cta w-full grid place-items-center" :style="submitBtnStyle" @click="handleSubmit">
          <view class="inline-flex items-center" style="gap: 8px">
            <template v-if="!walletPaired">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>
              <text>{{ t.walletV3.submitCtaUnpaired }}</text>
            </template>
            <template v-else-if="canSubmit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              <text>{{ t.walletV3.submitCtaPaired }}</text>
            </template>
            <template v-else>
              <text>{{ t.walletV3.submitCtaDisabled }}</text>
            </template>
          </view>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, type CSSProperties } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import StakeAlternativeCard from "@/components/me/stake-alternative-card.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { useWalletPairing } from "@/store/wallet-pairing";
import { usePoints } from "@/store/points";
import { useRiskDisclosure } from "@/store/risk-disclosure";
import { useProductPhase } from "@/composables/use-product-phase";
import { confirm as uiConfirm, toast } from "@/store/ui";
import type { Withdrawal } from "@/store/types";

const NETWORKS: { id: Withdrawal["network"]; label: string; hint: string; recommended?: boolean }[] = [
  { id: "USDT-TRC20", label: "USDT (TRC20)", hint: "Lowest fee · 5 min", recommended: true },
  { id: "USDT-ERC20", label: "USDT (ERC20)", hint: "15 min · for large amounts" },
  { id: "BTC", label: "Bitcoin", hint: "30 min" },
  { id: "ETH", label: "Ethereum", hint: "15 min" },
];

const t = useT();
const app = useApp();
const bills = useBills();
const pairing = useWalletPairing();
const points = usePoints();
const risk = useRiskDisclosure();
const phase = useProductPhase();

const usdtBalance = computed(() => app.user.usdtBalance);
const walletPaired = computed(() => pairing.walletPaired);
const pairedAddressShort = computed(() => {
  const a = pairing.pairedWalletAddress;
  return a ? `${a.slice(0, 8)}…${a.slice(-6)}` : "—";
});
const pairedNetwork = computed(() => pairing.pairedNetwork);

const devMode = ref(false);
onLoad((options) => {
  devMode.value = options?.dev === "1";
});

const amount = ref("");
const network = ref<Withdrawal["network"]>("USDT-TRC20");
const address = ref("");

const amountNum = computed(() => parseFloat(amount.value) || 0);
const fee = computed(() => Math.max(1, Math.min(20, amountNum.value * 0.02)));
const receive = computed(() => Math.max(0, amountNum.value - fee.value));
const addressPlaceholder = computed(() =>
  network.value === "BTC" ? "bc1q..." : network.value === "ETH" ? "0x..." : "TR7NHq...",
);

const complianceHoldEnabled = computed(() => phase.value.complianceHoldEnabled);
const holdBody = computed(() => fmt(t.value.walletV3.complianceHoldBody, { days: phase.value.withdrawalCooldownDays }));

const requiredPoints = computed(() => points.pointsRequiredFor(amountNum.value, phase.value.withdrawalPointsPer100));
const pointsBalance = computed(() => points.points);
const hasEnoughPoints = computed(() => pointsBalance.value >= requiredPoints.value);
const pointsShort = computed(() => Math.max(0, requiredPoints.value - pointsBalance.value));
const enoughPointsText = computed(() => fmt(t.value.walletV3.enoughPoints, { n: requiredPoints.value }));
const needMoreText = computed(() =>
  fmt(t.value.walletV3.needMorePoints, { n: pointsShort.value, amount: amountNum.value.toFixed(0) }),
);

const canSubmit = computed(
  () =>
    walletPaired.value &&
    amountNum.value >= 20 &&
    amountNum.value <= usdtBalance.value &&
    address.value.length > 10 &&
    hasEnoughPoints.value,
);

function detailVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onAmount(e: Event) {
  amount.value = detailVal(e).replace(/[^0-9.]/g, "");
}
function onAddress(e: Event) {
  address.value = detailVal(e);
}
function useMax() {
  amount.value = usdtBalance.value.toFixed(2);
}

function onCheckIn() {
  const r = points.signIn();
  if (r.ok) {
    toast.success(
      fmt(t.value.walletV3.checkedInTitle, { n: r.gained }),
      fmt(t.value.walletV3.checkedInSubtitle, { n: r.streak }),
    );
  } else {
    toast.info(t.value.walletV3.alreadyChecked, t.value.walletV3.alreadyCheckedSubtitle);
  }
}
function goReinvest() {
  uni.navigateTo({ url: "/pages/me/wallet-repurchase", fail: () => {} });
}

async function handleResetKyc() {
  const ok = await uiConfirm({
    title: "Reset KYC-Express pairing?",
    message: "Reset your KYC-Express pairing? Withdrawals will be blocked until you complete KYC-Express again.",
    danger: true,
    icon: "warn",
    confirmLabel: "Reset",
  });
  if (ok) {
    pairing.reset();
    toast.info("KYC pairing reset", "Complete KYC-Express again to withdraw.");
  }
}

function handleSubmit() {
  if (!canSubmit.value) return;
  if (!risk.accepted) {
    // Source pushes to the risk-disclosure page (not yet ported) and returns.
    uni.navigateTo({ url: "/pages/me/risk-disclosure?return=/pages/me/wallet-withdraw", fail: () => {} });
    return;
  }
  // ⚠️ MOCK-ONLY NON-ATOMIC cross-store handler (points.spend + submitWithdrawal
  // + bills.add). Production = single POST /api/withdrawals tx with an
  // Idempotency-Key. Rolls back the spent points if the atomic debit fails.
  points.spend(requiredPoints.value, `Withdraw $${amountNum.value.toFixed(2)}`);
  const withdrawalId = app.submitWithdrawal(amountNum.value, network.value, address.value);
  if (!withdrawalId) {
    points.earn(requiredPoints.value, "Refund · withdraw failed");
    toast.error(t.value.wallet.withdrawInsufficient);
    return;
  }
  const f = Math.max(1, Math.min(20, amountNum.value * 0.02));
  bills.add({
    type: "withdraw",
    symbol: "USDT",
    amount: -amountNum.value,
    status: "pending",
    memo: `Withdraw to ${network.value} · fee $${f.toFixed(2)}`,
    ref: withdrawalId,
  });
  uni.navigateTo({ url: "/pages/me/wallet-withdraw-tracking", fail: () => {} });
}

function goBack() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: "/pages/me/wallet", fail: () => {} }) });
}
function goKyc() {
  uni.navigateTo({ url: "/pages/me/wallet-topup?kyc=1", fail: () => {} });
}

// ── styles ──
const headerStyle: CSSProperties = { gap: "8px", padding: "10px 12px 6px" };
const backBtnStyle: CSSProperties = { width: "36px", height: "36px", borderRadius: "10px" };
const headerTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "17px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const kycGateStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--v5-brand-2) 10%, transparent)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  padding: "16px",
};
const kycGateIconStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "10px",
  background: "color-mix(in srgb, var(--v5-brand-2) 20%, transparent)",
};
const kycGateCtaStyle: CSSProperties = {
  height: "48px",
  borderRadius: "999px",
  background: "var(--v5-brand-2)",
  color: "var(--v5-ink)",
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 600,
};
const kycPillStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--v5-brand) 8%, transparent)",
  border: "1px solid var(--v5-brand-border)",
  borderRadius: "12px",
  padding: "10px 12px",
};
const kycPillIconStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "8px",
  background: "color-mix(in srgb, var(--v5-brand) 20%, transparent)",
};
const resetBtnStyle: CSSProperties = {
  height: "28px",
  padding: "0 8px",
  borderRadius: "6px",
  background: "var(--v5-surface-2)",
  fontSize: "10.5px",
  color: "var(--v5-ink-3)",
};
const holdBannerStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--v5-warning) 8%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-warning) 30%, transparent)",
  borderRadius: "12px",
  padding: "10px 12px",
};
const holdIconStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "8px",
  background: "color-mix(in srgb, var(--v5-warning) 20%, transparent)",
};
const surfaceCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "20px",
};
const surfaceCardFlush: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
};
const metaLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
const amountInputStyle: CSSProperties = {
  background: "transparent",
  fontFamily: "var(--font-v5)",
  fontSize: "28px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
function networkRowStyle(active: boolean, divider: boolean): CSSProperties {
  return {
    padding: "12px 20px",
    borderTop: divider ? "1px solid color-mix(in srgb, var(--v5-border) 70%, transparent)" : "none",
    background: active ? "color-mix(in srgb, var(--v5-brand) 6%, transparent)" : "transparent",
  };
}
function radioStyle(active: boolean): CSSProperties {
  return {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    border: `2px solid ${active ? "var(--v5-brand)" : "var(--v5-border)"}`,
    background: active ? "color-mix(in srgb, var(--v5-brand) 20%, transparent)" : "transparent",
  };
}
const recommendedChipStyle: CSSProperties = {
  padding: "2px 7px",
  borderRadius: "6px",
  background: "var(--v5-brand-soft)",
  color: "var(--v5-brand)",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.06em",
};
const addressInputStyle: CSSProperties = {
  width: "100%",
  minHeight: "48px",
  background: "var(--v5-surface)",
  borderRadius: "12px",
  padding: "12px",
  boxSizing: "border-box",
  fontSize: "13.5px",
  color: "var(--v5-ink)",
  border: "1px solid color-mix(in srgb, var(--v5-border) 70%, transparent)",
};
const warnBoxStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--v5-warning) 10%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-warning) 30%, transparent)",
  padding: "16px",
};
const pointsGateStyle = computed<CSSProperties>(() => ({
  padding: "16px",
  background: hasEnoughPoints.value
    ? "color-mix(in srgb, var(--v5-brand) 8%, transparent)"
    : "color-mix(in srgb, var(--v5-brand-2) 10%, transparent)",
  borderColor: hasEnoughPoints.value
    ? "var(--v5-brand-border)"
    : "var(--v5-brand-2-border)",
}));
const pointsGateLabelStyle = computed<CSSProperties>(() => ({
  gap: "6px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.06em",
  color: hasEnoughPoints.value ? "var(--v5-brand)" : "var(--v5-brand-2)",
}));
const pointsBarStyle = computed<CSSProperties>(() => ({
  width: `${Math.min(100, (pointsBalance.value / Math.max(requiredPoints.value, 1)) * 100)}%`,
  background: hasEnoughPoints.value ? "var(--v5-brand)" : "var(--v5-brand-2)",
}));
const checkInBtnStyle: CSSProperties = {
  height: "40px",
  borderRadius: "12px",
  background: "var(--v5-surface-2)",
  color: "var(--v5-ink)",
  fontSize: "12px",
  fontWeight: 600,
};
const reinvestBtnStyle: CSSProperties = {
  height: "40px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  fontSize: "12px",
  fontWeight: 600,
};
const submitBtnStyle = computed<CSSProperties>(() => ({
  height: "48px",
  borderRadius: "999px",
  background: canSubmit.value ? "var(--v5-brand)" : "var(--v5-surface-2)",
  color: canSubmit.value ? "var(--v5-ink)" : "var(--v5-ink-4)",
  fontFamily: "var(--font-v5)",
  fontSize: "14px",
  fontWeight: 600,
}));
</script>

<style scoped>
:deep(.nx-withdraw-address-input .uni-input-input) {
  min-height: 22px;
  height: 22px;
  line-height: 22px;
}
</style>
