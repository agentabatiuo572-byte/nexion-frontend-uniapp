<!--
  WalletWithdraw — ported from Nexion-prototype/app/(main)/me/wallet/withdraw/page.tsx.
  Top→bottom: KYC-Express gate (banner until wallet paired / verified pill after,
  with a dev-only ?dev=1 reset) → compliance-hold banner (P5+) → amount input
  (Use Max) → network select → address input → fee/receive summary → warnings →
  StakeAlternativeCard (≥$20) → NEX burn gate (progress + daily-check-in /
  earn-NEX CTAs) → sticky submit.

  Gates: wallet-pairing (must be paired), amount ∈ [$20, balance], address.len
  > 10. NO hard NEX gate — NEX optionally OFFSETS the fee. Fee model:
  grossFee = amount × penaltyFeeRate (the no-NEX fee); burning NEX waives
  nexFeeOffsetRate USDT per NEX (favorable vs market). requiredNex fully waives;
  partial NEX offsets pro-rata, remainder paid in USDT. Both rates backend-
  configurable per phase. Submit burns nexBurned + app.submitWithdrawal + bills.add;
  rolls burned NEX back if the USDT debit fails. Then → withdraw-tracking. <AppChassis active="me">.
  Header is the shared sticky <SubPageHeader> (back=/pages/me/wallet, title="USDT",
  subtitle=t.wallet.withdraw — mirrors the prototype's
  <SetPageHeader title="USDT" subtitle={t.wallet.withdraw} backHref="/me/wallet"/>).
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/wallet" title="USDT" :subtitle="t.wallet.withdraw" />

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

      <!-- Summary: gross fee → NEX offset → net fee → receive -->
      <view class="mx-4 mt-3 rounded-2xl border space-y-1.5" :style="[surfaceCardStyle, { padding: '16px' }]">
        <view v-if="nexBurned > 0" class="flex items-center justify-between">
          <text style="font-size: 12px; color: var(--v5-ink-3)">{{ feeGrossLabel }}</text>
          <text class="tabular-nums" :style="{ fontSize: '12.5px', color: 'var(--v5-ink-3)', textDecoration: 'line-through' }">${{ grossFee.toFixed(2) }}</text>
        </view>
        <view v-if="nexBurned > 0" class="flex items-center justify-between">
          <text style="font-size: 12px; color: var(--v5-brand)">{{ t.walletV3.feeOffsetRow }}</text>
          <text class="tabular-nums" style="font-size: 12.5px; color: var(--v5-brand)">−${{ feeWaived.toFixed(2) }} · {{ fmtNex(nexBurned) }} NEX</text>
        </view>
        <view class="flex items-center justify-between">
          <text style="font-size: 12px; color: var(--v5-ink-2)">{{ t.walletV3.feeCharged }}</text>
          <text class="tabular-nums" :style="{ fontSize: '12.5px', fontWeight: 600, color: fee > 0 ? 'var(--v5-ink)' : 'var(--v5-brand)' }">${{ fee.toFixed(2) }}</text>
        </view>
        <view class="flex items-center justify-between" style="margin-top: 4px; padding-top: 10px; border-top: 1px solid var(--v5-border)">
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

      <!-- NEX fee-offset panel (NEX optionally waives the fee; no hard gate) -->
      <view v-if="amountNum > 0" class="mx-4 mt-3 rounded-2xl border" :style="nexGateStyle">
        <view class="flex items-center justify-between" style="margin-bottom: 10px">
          <view class="flex items-center" :style="nexGateLabelStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="fullyWaived ? 'var(--v5-brand)' : 'var(--v5-brand-2)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 3 1.9 4.6L16 9.5l-4.6 1.9L9.5 16l-1.9-4.6L3 9.5l4.6-1.9z" /></svg>
            <text style="margin-left: 6px">{{ t.walletV3.feeOffsetTitle }}</text>
          </view>
          <text class="font-mono-tabular tabular-nums" style="font-size: 11px; color: var(--v5-ink)">{{ fmtNex(nexBalance) }} / {{ fmtNex(requiredNex) }}</text>
        </view>
        <view class="rounded-full overflow-hidden" style="height: 8px; background: color-mix(in srgb, var(--v5-surface-2) 60%, transparent)">
          <view class="h-full rounded-full" :style="nexBarStyle" />
        </view>
        <view v-if="fullyWaived" style="margin-top: 8px">
          <text style="font-size: 11px; color: var(--v5-brand)">{{ fullyWaivedText }}</text>
        </view>
        <view v-else style="margin-top: 8px">
          <text class="block" style="font-size: 11.5px; color: var(--v5-ink); line-height: 1.4">{{ partialOffsetText }}</text>
          <view class="grid grid-cols-2" style="margin-top: 8px; gap: 8px">
            <view class="grid place-items-center active:opacity-70" :style="checkInBtnStyle" @click="goDailyCheckIn">
              <view class="inline-flex items-center" style="gap: 6px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                <text>{{ t.walletV3.dailyCheckIn }}</text>
              </view>
            </view>
            <view class="grid place-items-center active:scale-[0.97] transition-transform" :style="reinvestBtnStyle" @click="goEarnNex">
              <view class="inline-flex items-center" style="gap: 6px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
                <text>{{ t.walletV3.earnNexCta }}</text>
              </view>
            </view>
          </view>
          <text class="block" style="margin-top: 8px; font-size: 10.5px; color: var(--v5-ink-3); line-height: 1.4">{{ feeOffsetRuleText }}</text>
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
import SubPageHeader from "@/components/sub-page-header.vue";
import StakeAlternativeCard from "@/components/me/stake-alternative-card.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { useWalletPairing } from "@/store/wallet-pairing";
import { computeWithdrawFee } from "@/store/nex-faucet";
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
const addressPlaceholder = computed(() =>
  network.value === "BTC" ? "bc1q..." : network.value === "ETH" ? "0x..." : "TR7NHq...",
);

const complianceHoldEnabled = computed(() => phase.value.complianceHoldEnabled);
const holdBody = computed(() => fmt(t.value.walletV3.complianceHoldBody, { days: phase.value.withdrawalCooldownDays }));

// ── Fee model: NEX optionally offsets the withdrawal fee (replaces old points/hard-burn gate) ──
// grossFee = amount × penaltyFeeRate; burning NEX waives nexFeeOffsetRate USDT/NEX (favorable vs
// ~market). No hard block — short NEX just means a higher actual fee. Both rates backend-configurable
// per phase (mirrors admin D.withdraw.penaltyFeeRate / nexFeeOffsetRate).
const nexBalance = computed(() => app.user.nexBalance);
const penaltyFeeRate = computed(() => phase.value.withdrawPenaltyFeeRate);
const nexFeeOffsetRate = computed(() => phase.value.nexFeeOffsetRate);
const feeCalc = computed(() =>
  computeWithdrawFee(amountNum.value, nexBalance.value, penaltyFeeRate.value, nexFeeOffsetRate.value),
);
const grossFee = computed(() => feeCalc.value.grossFee);
const requiredNex = computed(() => feeCalc.value.requiredNex);
const nexBurned = computed(() => feeCalc.value.nexBurned);
const feeWaived = computed(() => feeCalc.value.feeWaived);
const fee = computed(() => feeCalc.value.actualFee);
const receive = computed(() => feeCalc.value.netReceive);
const fullyWaived = computed(() => amountNum.value > 0 && fee.value <= 0.001);
const penaltyPctText = computed(() => `${(penaltyFeeRate.value * 100).toFixed(0)}%`);
const feeGrossLabel = computed(() => fmt(t.value.walletV3.feeGross, { rate: penaltyPctText.value }));
const fullyWaivedText = computed(() => fmt(t.value.walletV3.feeFullyWaived, { nex: fmtNex(nexBurned.value) }));
const partialOffsetText = computed(() =>
  fmt(t.value.walletV3.feePartial, { rate: penaltyPctText.value, gross: grossFee.value.toFixed(2) }),
);
const feeOffsetRuleText = computed(() =>
  fmt(t.value.walletV3.feeOffsetRule, {
    perNex: nexFeeOffsetRate.value.toFixed(2),
    required: fmtNex(requiredNex.value),
  }),
);

function fmtNex(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const canSubmit = computed(
  () =>
    walletPaired.value &&
    amountNum.value >= 20 &&
    amountNum.value <= usdtBalance.value &&
    address.value.length > 10,
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

function goDailyCheckIn() {
  // 去签到页攒 NEX(签到水龙头与计入钱包在 daily 页统一处理)
  uni.navigateTo({ url: "/pages/daily/daily", fail: () => {} });
}
function goEarnNex() {
  // NEX 主来源 = 设备挖矿;引导去赚更多 NEX 才能解锁更大额提现
  uni.navigateTo({ url: "/pages/earn/earn", fail: () => {} });
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
  // ⚠️ MOCK-ONLY NON-ATOMIC cross-store handler (NEX burn + submitWithdrawal +
  // bills.add). Production = single POST /api/withdrawals tx that burns N NEX
  // server-side under an Idempotency-Key. debitNex is the friction gate (atomic,
  // returns false on insufficient); roll the burned NEX back if the USDT debit fails.
  // NEX is an optional fee-offset (no hard gate). Burn only what offsets the fee.
  const toBurn = nexBurned.value;
  if (toBurn > 0 && !app.debitNex(toBurn)) {
    // Balance changed under us — bail without charging; recompute re-clamps next tick.
    toast.error(t.value.walletV3.needMoreNexToast);
    return;
  }
  const withdrawalId = app.submitWithdrawal(amountNum.value, network.value, address.value, fee.value);
  if (!withdrawalId) {
    if (toBurn > 0) app.creditNex(toBurn); // rollback the burned NEX
    toast.error(t.value.wallet.withdrawInsufficient);
    return;
  }
  const charged = fee.value;
  bills.add({
    type: "withdraw",
    symbol: "USDT",
    amount: -amountNum.value,
    status: "pending",
    memo: `Withdraw to ${network.value} · fee $${charged.toFixed(2)}`,
    ref: withdrawalId,
  });
  if (toBurn > 0) {
    bills.add({
      type: "withdraw",
      symbol: "NEX",
      amount: -toBurn,
      status: "posted",
      memo: `Fee offset · ${fmtNex(toBurn)} NEX burned (−$${feeWaived.value.toFixed(2)} fee)`,
      ref: withdrawalId,
    });
  }
  uni.navigateTo({ url: "/pages/me/wallet-withdraw-tracking", fail: () => {} });
}

function goKyc() {
  uni.navigateTo({ url: "/pages/me/wallet-topup?kyc=1", fail: () => {} });
}

// ── styles ──
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
  // Prototype: border-[var(--v5-brand)]/30 (30%), not the 45% *-border token.
  border: "1px solid color-mix(in srgb, var(--v5-brand) 30%, transparent)",
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
const nexGateStyle = computed<CSSProperties>(() => ({
  padding: "16px",
  background: fullyWaived.value
    ? "color-mix(in srgb, var(--v5-brand) 8%, transparent)"
    : "color-mix(in srgb, var(--v5-brand-2) 10%, transparent)",
  // Prototype: enough = border-[var(--v5-brand)]/30, short = border-[var(--v5-brand-2)]/35
  // (the *-border tokens are 45% — too strong vs prototype).
  borderColor: fullyWaived.value
    ? "color-mix(in srgb, var(--v5-brand) 30%, transparent)"
    : "color-mix(in srgb, var(--v5-brand-2) 35%, transparent)",
}));
const nexGateLabelStyle = computed<CSSProperties>(() => ({
  gap: "6px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.06em",
  color: fullyWaived.value ? "var(--v5-brand)" : "var(--v5-brand-2)",
}));
const nexBarStyle = computed<CSSProperties>(() => ({
  width: `${Math.min(100, (nexBalance.value / Math.max(requiredNex.value, 1)) * 100)}%`,
  background: fullyWaived.value ? "var(--v5-brand)" : "var(--v5-brand-2)",
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
