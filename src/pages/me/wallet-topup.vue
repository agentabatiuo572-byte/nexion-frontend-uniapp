<!--
  WalletTopup — ported from Nexion-prototype/app/(main)/me/wallet/topup/page.tsx.
  Two flows selected by ?kyc=1 (onLoad):
   • Regular: channel list → chain QR deposit card OR Visa/MC card form.
   • KYC-Express ($1 wallet-ownership verification): compliance banner +
     phase machine select → awaiting (QR + 30min countdown + 12s auto-detect) →
     verifying (3-step animation) → complete (pairs wallet via useWalletPairing,
     credits $1 via useApp, writes a kyc bill, pushes nothing extra). On complete,
     "Continue to withdrawal" → /me/wallet/withdraw.

  Wrapped in <AppChassis active="me"> with an in-page back/title row. framer
  AnimatePresence → CSS nx-step-in keyframe (reused from checkout). Card form
  extracted to topup-card-form.vue.
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
          <text class="block truncate" :style="headerTitleStyle">{{ isKyc ? 'KYC-Express' : t.wallet.addFunds }}</text>
          <text class="block truncate" style="font-size: 12px; color: var(--v5-ink-3)">{{ isKyc ? t.wallet.complianceCheck : t.wallet.topUp }}</text>
        </view>
      </view>

      <!-- ════════ KYC-Express flow ════════ -->
      <template v-if="isKyc">
        <text class="block mx-4 mb-2" :style="kycH1Style">KYC-Express</text>

        <!-- Persistent compliance banner -->
        <view class="mx-4 mb-3 flex items-center" :style="complianceBannerStyle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
          <view class="flex-1 min-w-0" style="margin-left: 10px; font-size: 11.5px; line-height: 1.4">
            <text style="color: var(--v5-ink); font-weight: 500">Compliance check</text>
            <text style="color: var(--v5-ink-3); margin-left: 6px">· Powered by Chainalysis KYT · MiCA-aligned</text>
          </view>
        </view>

        <!-- select -->
        <view v-if="kycPhase === 'select'" class="nx-step-in">
          <view class="mx-4 rounded-2xl border" :style="surfaceCardStyle">
            <text class="block font-mono-tabular" :style="metaLabelStyle">{{ t.kycExpress.flow.verificationDeposit }}</text>
            <view class="flex items-baseline" style="margin-top: 8px; gap: 8px">
              <text class="tabular-nums" style="font-family: var(--font-v5); font-size: 28px; font-weight: 600; color: var(--v5-ink)">$1.00</text>
              <text style="font-size: 12px; color: var(--v5-ink-3)">USDT · locked</text>
            </view>
            <text class="block" style="margin-top: 8px; font-size: 11.5px; color: var(--v5-ink-4); line-height: 1.4">{{ t.kycExpress.flow.depositCreditHint }}</text>
          </view>

          <view class="mx-4 mt-3 rounded-2xl border overflow-hidden" :style="surfaceCardFlush">
            <text class="block font-mono-tabular" :style="[metaLabelStyle, { padding: '16px 20px 8px' }]">Network</text>
            <view
              v-for="(c, i) in KYC_CHANNELS"
              :key="c.id"
              class="w-full flex items-center active:opacity-90"
              :style="networkRowStyle(network === c.id, i !== 0)"
              @click="selectKycNetwork(c.id)"
            >
              <view class="grid place-items-center" :style="radioStyle(network === c.id)">
                <view v-if="network === c.id" style="width: 8px; height: 8px; border-radius: 50%; background: var(--v5-brand)" />
              </view>
              <view class="flex-1" style="margin-left: 12px">
                <text class="block" style="font-size: 13.5px; font-weight: 500; color: var(--v5-ink)">{{ c.label }}</text>
                <text class="block" style="font-size: 12px; color: var(--v5-ink-3); margin-top: 2px">Fee {{ c.fee }} · {{ c.time }}</text>
              </view>
            </view>
          </view>

          <view class="mx-4 mt-4 mb-2">
            <view class="nx-kyc-generate-address-cta w-full grid place-items-center active:opacity-90" :style="kycPrimaryBtnStyle" @click="kycPhase = 'awaiting'">
              <view class="inline-flex items-center" style="gap: 8px">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
                <text>{{ t.kycExpress.flow.generateAddressCta }}</text>
              </view>
            </view>
            <text class="block text-center" style="margin-top: 8px; font-size: 10.5px; color: var(--v5-ink-4); line-height: 1.4">Per MiCA Art. 22 · FATF Travel Rule · US FinCEN Rule 314(b)</text>
          </view>
        </view>

        <!-- awaiting -->
        <view v-else-if="kycPhase === 'awaiting'" class="mx-4 rounded-2xl border nx-step-in" :style="surfaceCardStyle">
          <view class="flex items-center justify-between">
            <text class="font-mono-tabular" :style="metaLabelStyle">Send $1.00 via {{ network }}</text>
            <text class="tabular-nums" style="font-size: 11px; color: var(--v5-ink-3); letter-spacing: 0.06em">{{ mm }}:{{ ss }}</text>
          </view>

          <!-- QR placeholder -->
          <view :style="qrBoxStyle">
            <view :style="qrInnerStyle" />
          </view>
          <text class="block text-center" style="margin-top: 8px; font-size: 11.5px; color: var(--v5-ink-3)">Scan with your wallet · or copy address below</text>

          <view class="flex items-center rounded-xl" :style="addressRowStyle">
            <text class="flex-1 font-mono" style="font-size: 12px; color: var(--v5-ink); word-break: break-all">{{ depositAddress }}</text>
            <view class="nx-kyc-copy-address-cta grid place-items-center shrink-0 active:opacity-80" :style="copyBtnStyle" @click="copyAddress">
              <svg v-if="copied" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
            </view>
          </view>

          <view class="flex items-center justify-between" style="margin-top: 12px; font-size: 12.5px">
            <text style="color: var(--v5-ink-3)">Send exactly</text>
            <text class="tabular-nums" style="font-family: var(--font-v5); font-weight: 600; color: var(--v5-brand)">1.00 USDT</text>
          </view>

          <view class="flex items-center rounded-xl" :style="awaitingBarStyle">
            <view :style="miniSpinnerStyle" />
            <text class="flex-1" style="margin-left: 8px; font-size: 12.5px; color: var(--v5-ink-3)">Awaiting on-chain confirmation…</text>
            <text style="font-size: 10.5px; color: var(--v5-ink-4)">auto-detect</text>
          </view>

          <view class="nx-kyc-payment-sent-cta w-full grid place-items-center active:opacity-80" :style="markSentBtnStyle" @click="kycPhase = 'verifying'">
            <text>{{ t.kycExpress.flow.paymentSentCta }}</text>
          </view>

          <text class="block" style="margin-top: 12px; font-size: 10.5px; color: var(--v5-ink-4); line-height: 1.4">Address valid for 30 minutes. Only send {{ network }} to this address — cross-chain transfers cannot be recovered.</text>
        </view>

        <!-- verifying -->
        <view v-else-if="kycPhase === 'verifying'" class="mx-4 rounded-2xl border nx-step-in" :style="surfaceCardStyle">
          <view class="flex items-center" style="gap: 6px; font-size: 12.5px; color: var(--v5-brand)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></svg>
            <text>Payment received from <text class="font-mono" style="color: var(--v5-ink)">{{ senderShort }}</text></text>
          </view>
          <text class="block" style="margin-top: 4px; font-size: 11.5px; color: var(--v5-ink-3)">1.00 USDT · {{ network }} · sender wallet</text>

          <view style="margin-top: 20px" class="space-y-3">
            <VerifyRow :step="1" :label="t.wallet.verifyReceiving" :done="step1Done" />
            <VerifyRow :step="2" :label="t.wallet.verifyKyt" :done="step2Done" :enabled="step1Done" />
            <VerifyRow :step="3" :label="t.wallet.verifyPairing" :done="false" :enabled="step2Done" pending-hint="finalizing" />
          </view>
        </view>

        <!-- complete -->
        <view v-else class="mx-4 relative overflow-hidden nx-step-in" :style="completeCardStyle">
          <view aria-hidden :style="completeWashStyle" />
          <view class="relative">
            <view :style="completeIconStyle">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></svg>
            </view>
            <text class="block text-center" :style="completeTitleStyle">{{ t.kycExpress.flow.verificationComplete }}</text>
            <text class="block text-center" style="margin-top: 4px; font-size: 12.5px; color: var(--v5-ink-3); line-height: 1.45">Wallet paired · $1.00 credited to your balance</text>

            <view style="margin-top: 16px" class="space-y-2">
              <CompleteRow k="Paired wallet" :v="senderShort" mono />
              <CompleteRow k="Network" :v="network" />
              <CompleteRow k="Compliance ID" :v="complianceId" mono accent />
              <CompleteRow k="Verified at" :v="verifiedAt" />
            </view>

            <view class="nx-kyc-continue-withdraw-cta w-full flex items-center justify-center active:opacity-85" :style="completeBtnStyle" @click="goWithdraw">
              <text>{{ t.kycExpress.flow.continueToWithdrawal }}</text>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </view>
          </view>
        </view>
      </template>

      <!-- ════════ Regular top-up flow ════════ -->
      <template v-else>
        <!-- channel list -->
        <view v-if="!selected" class="mx-4 rounded-2xl border overflow-hidden" :style="surfaceCardFlush">
          <text class="block font-mono-tabular" :style="[metaLabelStyle, { padding: '16px 20px 8px' }]">Select Channel</text>
          <view
            v-for="(c, i) in ALL_CHANNELS"
            :key="c.id"
            :class="['w-full flex items-center active:opacity-90', channelClass(c.id)]"
            :style="channelRowStyle(i !== 0)"
            @click="selected = c.id"
          >
            <view class="flex-1">
              <text class="block" style="font-size: 13.5px; font-weight: 500; color: var(--v5-ink)">{{ c.label }}</text>
              <text class="block" style="font-size: 12px; color: var(--v5-ink-3); margin-top: 2px">Fee {{ c.fee }} · {{ c.time }} · Min {{ c.min }}</text>
            </view>
            <text style="color: var(--v5-brand); font-size: 12px">Use →</text>
          </view>
        </view>

        <!-- card pay form -->
        <TopupCardForm v-else-if="selected === 'CARD'" @change-channel="selected = null" />

        <!-- chain deposit card -->
        <view v-else class="mx-4 rounded-2xl border" :style="surfaceCardStyle">
          <view class="flex items-center justify-between">
            <text class="font-mono-tabular" :style="metaLabelStyle">Send via {{ selected }}</text>
            <text style="font-size: 12px; color: var(--v5-ink-3)" @click="selected = null">Change</text>
          </view>
          <view :style="qrBoxStyle"><view :style="qrInnerStyle" /></view>
          <text class="block text-center" style="margin-top: 8px; font-size: 11.5px; color: var(--v5-ink-3)">Scan QR or copy the address below</text>
          <view class="flex items-center rounded-xl" :style="addressRowStyle">
            <text class="flex-1 font-mono" style="font-size: 12px; color: var(--v5-ink); word-break: break-all">{{ DEMO_ADDRESS }}</text>
            <view class="nx-topup-copy-address-cta grid place-items-center shrink-0 active:opacity-80" :style="copyBtnStyle" @click="copyDemoAddress">
              <svg v-if="copiedDemo" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
            </view>
          </view>
          <view class="flex items-center" style="margin-top: 16px; gap: 8px; font-size: 12.5px; color: var(--v5-ink-3)">
            <view :style="miniSpinnerStyle" />
            <text>Awaiting confirmation… (auto-detects within 5 minutes)</text>
          </view>
          <text class="block" style="margin-top: 16px; font-size: 11.5px; color: var(--v5-ink-4); line-height: 1.4">Address expires in 30:00 minutes. Send only the selected asset to this address — wrong-asset transfers cannot be recovered.</text>
        </view>
      </template>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, type CSSProperties } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import TopupCardForm from "@/components/me/topup-card-form.vue";
import VerifyRow from "@/components/me/verify-row.vue";
import CompleteRow from "@/components/me/complete-row.vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { useWalletPairing, mockExternalAddress } from "@/store/wallet-pairing";
import type { Withdrawal } from "@/store/types";

interface Channel {
  id: Withdrawal["network"] | "CARD";
  label: string;
  fee: string;
  time: string;
  min: string;
}
const ALL_CHANNELS: Channel[] = [
  { id: "USDT-TRC20", label: "USDT (TRC20)", fee: "1 USDT", time: "5 min", min: "$10" },
  { id: "USDT-ERC20", label: "USDT (ERC20)", fee: "5 USDT", time: "15 min", min: "$10" },
  { id: "BTC", label: "Bitcoin", fee: "0.5%", time: "30 min", min: "$20" },
  { id: "ETH", label: "Ethereum", fee: "0.5%", time: "15 min", min: "$20" },
  { id: "CARD", label: "Visa / Mastercard", fee: "3.5%", time: "Instant", min: "$10" },
];
const KYC_CHANNELS = ALL_CHANNELS.filter((c) => c.id === "USDT-TRC20" || c.id === "USDT-ERC20");

// c.id is typed Withdrawal["network"] | "CARD"; KYC_CHANNELS only ever holds
// USDT networks, so narrow back to Withdrawal["network"] for the `network` ref.
function selectKycNetwork(id: Channel["id"]) {
  if (id === "CARD") return;
  network.value = id;
}

function channelClass(id: Channel["id"]): string {
  return `nx-topup-channel-${String(id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

const KYC_DETECT_MS = 12_000;
const KYC_PHASE_1_MS = 2_500;
const KYC_PHASE_2_MS = 4_000;
const DEMO_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

const t = useT();
const app = useApp();
const bills = useBills();
const pairing = useWalletPairing();

const isKyc = ref(false);

function routeHasKyc(options?: Record<string, unknown>): boolean {
  if (options?.kyc === "1") return true;
  // H5 can keep the same page instance when only the hash query changes.
  if (typeof window === "undefined") return false;
  const [, query = ""] = window.location.hash.split("?");
  return new URLSearchParams(query).get("kyc") === "1";
}
function syncKycRoute(options?: Record<string, unknown>) {
  isKyc.value = routeHasKyc(options);
}
onLoad((options) => {
  syncKycRoute(options as Record<string, unknown> | undefined);
});

// ── Regular flow state ──
const selected = ref<string | null>(null);
const copiedDemo = ref(false);
function copyDemoAddress() {
  uni.setClipboardData({
    data: DEMO_ADDRESS,
    success: () => {
      copiedDemo.value = true;
      setTimeout(() => (copiedDemo.value = false), 1500);
    },
    fail: () => {},
  });
}

// ── KYC flow state ──
type KycPhase = "select" | "awaiting" | "verifying" | "complete";
const kycPhase = ref<KycPhase>("select");
const network = ref<Withdrawal["network"]>("USDT-TRC20");
const copied = ref(false);

const depositAddress = computed(() =>
  network.value === "USDT-TRC20"
    ? "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
    : "0x4f7a2c8e9b1d3f5a6c8e0b2d4f6a8c0e21abcdef",
);
// Mock "user's external wallet" — what we'd see arriving on-chain (stable per phase).
const senderAddress = ref(mockExternalAddress("USDT-TRC20"));
const senderShort = computed(() => `${senderAddress.value.slice(0, 6)}…${senderAddress.value.slice(-4)}`);
const complianceId = computed(() => pairing.complianceCheckId ?? "KYC-PENDING");
const verifiedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

function copyAddress() {
  uni.setClipboardData({
    data: depositAddress.value,
    success: () => {
      copied.value = true;
      setTimeout(() => (copied.value = false), 1500);
    },
    fail: () => {},
  });
}

// ── 30-min countdown (awaiting) ──
const secLeft = ref(30 * 60);
const mm = computed(() => String(Math.floor(secLeft.value / 60)).padStart(2, "0"));
const ss = computed(() => String(secLeft.value % 60).padStart(2, "0"));
let countdownTimer: ReturnType<typeof setInterval> | undefined;
let detectTimer: ReturnType<typeof setTimeout> | undefined;
let verifyTimer: ReturnType<typeof setTimeout> | undefined;
let step1Timer: ReturnType<typeof setTimeout> | undefined;
let step2Timer: ReturnType<typeof setTimeout> | undefined;
let hashRouteListener: (() => void) | undefined;

const step1Done = ref(false);
const step2Done = ref(false);

onMounted(() => {
  syncKycRoute();
  if (typeof window !== "undefined") {
    hashRouteListener = () => syncKycRoute();
    window.addEventListener("hashchange", hashRouteListener);
  }
  countdownTimer = setInterval(() => {
    secLeft.value = Math.max(0, secLeft.value - 1);
  }, 1000);
});
onUnmounted(() => {
  if (hashRouteListener && typeof window !== "undefined") window.removeEventListener("hashchange", hashRouteListener);
  if (countdownTimer) clearInterval(countdownTimer);
  if (detectTimer) clearTimeout(detectTimer);
  if (verifyTimer) clearTimeout(verifyTimer);
  if (step1Timer) clearTimeout(step1Timer);
  if (step2Timer) clearTimeout(step2Timer);
});

// awaiting → auto-detect after KYC_DETECT_MS → verifying
function startAwaitingDetect() {
  if (detectTimer) clearTimeout(detectTimer);
  detectTimer = setTimeout(() => {
    kycPhase.value = "verifying";
  }, KYC_DETECT_MS);
}
// verifying → run 3-step animation + commit pairing/credit/bill → complete
function startVerifying() {
  step1Done.value = false;
  step2Done.value = false;
  step1Timer = setTimeout(() => (step1Done.value = true), KYC_PHASE_1_MS);
  step2Timer = setTimeout(() => (step2Done.value = true), KYC_PHASE_1_MS + KYC_PHASE_2_MS);
  verifyTimer = setTimeout(() => {
    pairing.complete({ address: senderAddress.value, network: network.value });
    app.creditBalance(1);
    // ⚠️ Round 12 P0 fix: write the KYC-Express $1 compliance-bonus bill.
    bills.add({
      type: "kyc",
      symbol: "USDT",
      amount: 1,
      status: "posted",
      memo: "KYC-Express compliance bonus",
      ref: `KYC-${pairing.complianceCheckId ?? "PENDING"}`,
    });
    kycPhase.value = "complete";
  }, KYC_PHASE_1_MS + KYC_PHASE_2_MS + 800);
}

// Watch phase transitions (replaces the source's per-phase mount effects).
watch(kycPhase, (p, prev) => {
  if (p === "awaiting") {
    secLeft.value = 30 * 60;
    senderAddress.value = mockExternalAddress(network.value);
    startAwaitingDetect();
  }
  if (p === "verifying" && prev !== "verifying") startVerifying();
});

function goBack() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: "/pages/me/wallet", fail: () => {} }) });
}
function goWithdraw() {
  uni.reLaunch({ url: "/pages/me/wallet-withdraw", fail: () => {} });
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
const kycH1Style: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "22px",
  letterSpacing: "-0.018em",
  color: "var(--v5-ink)",
  lineHeight: 1.2,
};
const complianceBannerStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--v5-brand-2) 8%, transparent)",
  border: "1px solid var(--v5-brand-2-border)",
  borderRadius: "16px",
  padding: "12px 16px",
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
function networkRowStyle(active: boolean, divider: boolean): CSSProperties {
  return {
    padding: "12px 20px",
    borderTop: divider ? "1px solid color-mix(in srgb, var(--v5-border) 70%, transparent)" : "none",
    background: active ? "color-mix(in srgb, var(--v5-brand) 6%, transparent)" : "transparent",
  };
}
function channelRowStyle(divider: boolean): CSSProperties {
  return {
    padding: "12px 20px",
    gap: "12px",
    borderTop: divider ? "1px solid color-mix(in srgb, var(--v5-border) 70%, transparent)" : "none",
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
const kycPrimaryBtnStyle: CSSProperties = {
  height: "48px",
  borderRadius: "999px",
  background: "var(--v5-brand-2)",
  color: "var(--v5-ink)",
  fontFamily: "var(--font-v5)",
  fontSize: "14px",
  fontWeight: 600,
};
const qrBoxStyle: CSSProperties = {
  width: "160px",
  height: "160px",
  margin: "16px auto 0",
  borderRadius: "16px",
  background: "#ffffff",
  padding: "8px",
  display: "grid",
  placeItems: "center",
};
const qrInnerStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "8px",
  backgroundImage:
    "radial-gradient(circle, rgba(0,0,0,0.85) 25%, #fff 25%, #fff 50%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.85) 75%, #fff 75%)",
  backgroundSize: "12px 12px",
};
const addressRowStyle: CSSProperties = {
  marginTop: "16px",
  padding: "12px",
  gap: "8px",
  background: "var(--v5-surface-2)",
};
const copyBtnStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "8px",
  background: "var(--v5-surface)",
};
const awaitingBarStyle: CSSProperties = {
  marginTop: "16px",
  padding: "12px",
  background: "color-mix(in srgb, var(--v5-brand-2) 8%, transparent)",
  border: "1px solid var(--v5-brand-2-border)",
};
const markSentBtnStyle: CSSProperties = {
  marginTop: "12px",
  height: "40px",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
  color: "var(--v5-ink-2)",
  fontSize: "12.5px",
};
const miniSpinnerStyle: CSSProperties = {
  width: "16px",
  height: "16px",
  borderRadius: "50%",
  border: "2px solid color-mix(in srgb, var(--v5-brand-2) 30%, transparent)",
  borderTopColor: "var(--v5-brand-2)",
  animation: "spin 1s linear infinite",
  flexShrink: 0,
};
const completeCardStyle: CSSProperties = {
  padding: "20px",
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid color-mix(in srgb, var(--v5-success) 30%, transparent)",
};
const completeWashStyle: CSSProperties = {
  position: "absolute",
  inset: "-20%",
  background: "radial-gradient(40% 50% at 50% 0%, var(--v5-success-soft) 0%, transparent 60%)",
  filter: "blur(8px)",
  pointerEvents: "none",
  opacity: 0.85,
};
const completeIconStyle: CSSProperties = {
  width: "56px",
  height: "56px",
  margin: "0 auto",
  borderRadius: "50%",
  background: "var(--v5-success-soft)",
  display: "grid",
  placeItems: "center",
};
const completeTitleStyle: CSSProperties = {
  marginTop: "14px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "15px",
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
};
const completeBtnStyle: CSSProperties = {
  marginTop: "20px",
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  boxShadow: "var(--v5-spotlight-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "13px",
};
</script>
