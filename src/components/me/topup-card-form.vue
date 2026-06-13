<!--
  TopupCardForm — ported from me/wallet/topup/page.tsx CardPayForm.
  Stripe/Checkout.com-style hosted card page: amount input (USDT + 3.5% card fee
  → USD charged) + card form (number / expiry / CVV / holder / country / ZIP,
  brand auto-detect) + "Pay $X" CTA + PCI/3DS trust footer. Submit → processing →
  3DS → 90% success / 10% fail. On success calls useApp.recordDeposit + writes a
  topup bill (the source's Round-12 P0 fix). All data is mock; no real requests.
-->
<template>
  <view class="mx-4 space-y-3">
    <!-- Header row -->
    <view class="flex items-center justify-between" style="padding: 0 4px">
      <text class="font-mono-tabular" style="font-size: 11px; font-weight: 500; letter-spacing: 0.06em; color: var(--v5-ink-3)">Visa / Mastercard</text>
      <text style="font-size: 12px; color: var(--v5-ink-3)" @click="emit('changeChannel')">Change</text>
    </view>

    <!-- Processing / 3DS -->
    <view v-if="phase === 'processing' || phase === '3ds'" class="rounded-2xl border text-center" :style="centerCardStyle">
      <view :style="spinnerStyle" />
      <text class="block" :style="centerTitleStyle">{{ phase === 'processing' ? 'Authorizing card…' : '3D Secure verification' }}</text>
      <text class="block" :style="centerBodyStyle">{{ phase === 'processing' ? 'Submitting to issuing bank · do not close this window' : 'Your bank may text you a code · standing by for confirmation' }}</text>
      <view class="inline-flex items-center font-mono-tabular" :style="pciChipStyle">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>
        <text style="margin-left: 6px">PCI DSS Level 1 · 3DS 2.2</text>
      </view>
    </view>

    <!-- Success -->
    <view v-else-if="phase === 'success'" class="rounded-2xl border text-center" :style="centerCardStyle">
      <view :style="successIconStyle">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></svg>
      </view>
      <text class="block" :style="successTitleStyle">Payment successful</text>
      <text class="block" style="margin-top: 4px; font-size: 12px; color: var(--v5-ink-3)">${{ usdtAmount.toFixed(2) }} USDT credited to your wallet</text>
      <text class="block font-mono-tabular" style="margin-top: 12px; font-size: 11px; color: var(--v5-ink-4)">{{ receiptLine }}</text>
      <view class="inline-block w-full text-center active:opacity-90" :style="successBtnStyle" @click="goWallet">Back to wallet</view>
    </view>

    <!-- Fail -->
    <view v-else-if="phase === 'fail'" class="rounded-2xl border text-center" :style="centerCardStyle">
      <view :style="failIconStyle"><text style="font-size: 32px">⚠️</text></view>
      <text class="block" :style="failTitleStyle">Card declined</text>
      <text class="block font-mono-tabular" style="margin-top: 8px; font-size: 12px; color: var(--v5-brand-2)">Reason: do_not_honor (issuer)</text>
      <text class="block" style="margin-top: 4px; font-size: 11.5px; color: var(--v5-ink-3); line-height: 1.5; max-width: 280px; margin-left: auto; margin-right: auto">Contact your card issuer or try a different card. No charge was made.</text>
      <view class="w-full grid place-items-center active:opacity-70" :style="tryAgainBtnStyle" @click="phase = 'form'">Try again</view>
    </view>

    <!-- Form -->
    <template v-else>
      <!-- Amount preview -->
      <view class="rounded-2xl border" :style="amountCardStyle">
        <text class="block font-mono-tabular" style="font-size: 11px; font-weight: 500; color: var(--v5-ink-3); letter-spacing: 0.06em">You receive</text>
        <view class="flex items-baseline" style="margin-top: 4px; gap: 6px">
          <text style="font-family: var(--font-v5); font-size: 14px; color: var(--v5-ink-3)">$</text>
          <input class="flex-1 min-w-0 tabular-nums" :style="amountInputStyle" type="text" inputmode="decimal" :value="amount" placeholder="0.00" @input="onAmount" />
          <text class="font-mono-tabular" style="font-size: 14px; color: var(--v5-ink-3)">USDT</text>
        </view>
        <view class="grid grid-cols-2" :style="feeRowStyle">
          <text style="font-size: 11px; color: var(--v5-ink-3)">Card fee 3.5% · <text class="font-mono-tabular tabular-nums" style="color: var(--v5-ink-2)">${{ feeUSD.toFixed(2) }}</text></text>
          <text class="text-right" style="font-size: 11px"><text style="color: var(--v5-ink-3)">Card charged </text><text class="font-mono-tabular tabular-nums" style="font-weight: 600; color: var(--v5-ink)">${{ chargeUSD.toFixed(2) }}</text></text>
        </view>
      </view>

      <!-- Card form -->
      <view class="rounded-2xl border space-y-3" :style="formCardStyle">
        <view :style="fieldStyle">
          <text class="block font-mono-tabular" :style="fieldLabelStyle">{{ t.wallet.ffCardNumber }}</text>
          <view class="flex items-center" style="margin-top: 2px; gap: 8px">
            <input class="font-mono-tabular flex-1 min-w-0 tabular-nums" :style="fieldInputStyle" type="text" inputmode="numeric" :value="cardNum" placeholder="1234 5678 9012 3456" @input="onCardNum" />
            <CardBrandBadge :brand="brand" />
          </view>
        </view>

        <view class="grid grid-cols-2" style="gap: 8px">
          <view :style="fieldStyle">
            <text class="block font-mono-tabular" :style="fieldLabelStyle">{{ t.wallet.ffExpiry }}</text>
            <input class="font-mono-tabular w-full tabular-nums" :style="fieldInputStyle" type="text" inputmode="numeric" :value="expiry" placeholder="MM/YY" @input="onExpiry" />
          </view>
          <view :style="fieldStyle">
            <text class="block font-mono-tabular" :style="fieldLabelStyle">{{ t.wallet.ffCvv }}</text>
            <input class="font-mono-tabular w-full tabular-nums" :style="fieldInputStyle" type="text" inputmode="numeric" :value="cvv" placeholder="•••" @input="onCvv" />
          </view>
        </view>

        <view :style="fieldStyle">
          <text class="block font-mono-tabular" :style="fieldLabelStyle">{{ t.wallet.ffCardholder }}</text>
          <input class="w-full" :style="[fieldInputStyle, { letterSpacing: '0.04em' }]" type="text" :value="holder" :placeholder="t.wallet.cardNamePlaceholder" @input="onHolder" />
        </view>

        <view class="grid" style="grid-template-columns: 1fr 120px; gap: 8px">
          <view :style="fieldStyle">
            <text class="block font-mono-tabular" :style="fieldLabelStyle">{{ t.wallet.ffCountry }}</text>
            <picker mode="selector" :range="COUNTRY_LABELS" :value="countryIdx" @change="onCountry">
              <text class="block" :style="[fieldInputStyle, { marginTop: '2px' }]">{{ COUNTRY_LABELS[countryIdx] }}</text>
            </picker>
          </view>
          <view :style="fieldStyle">
            <text class="block font-mono-tabular" :style="fieldLabelStyle">{{ t.wallet.ffZip }}</text>
            <input class="font-mono-tabular w-full" :style="fieldInputStyle" type="text" :value="zip" placeholder="10001" @input="onZip" />
          </view>
        </view>
      </view>

      <!-- Submit -->
      <view class="w-full flex items-center justify-center active:opacity-90" :style="submitBtnStyle" @click="handleSubmit">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" :stroke="isValid ? 'var(--v5-ink)' : 'var(--v5-ink-4)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>
        <text style="margin-left: 6px">Pay ${{ chargeUSD.toFixed(2) }}</text>
      </view>

      <!-- Trust footer -->
      <view class="flex items-start" :style="trustFootStyle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 2px; flex-shrink: 0"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>
        <text style="margin-left: 8px; font-size: 10.5px; color: var(--v5-ink-3); line-height: 1.5">Card processed by Checkout.com (PCI DSS Level 1). Nexion never sees your full card number. 3D Secure 2.2 enforced for transactions over $50.</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import CardBrandBadge from "@/components/me/card-brand-badge.vue";

const emit = defineEmits<{ changeChannel: [] }>();

const t = useT();
const app = useApp();
const bills = useBills();

const amount = ref("50");
const cardNum = ref("");
const expiry = ref("");
const cvv = ref("");
const holder = ref("");
const zip = ref("");
const COUNTRY_LABELS = [
  "🇺🇸 United States",
  "🇬🇧 United Kingdom",
  "🇨🇦 Canada",
  "🇦🇺 Australia",
  "🇩🇪 Germany",
  "🇯🇵 Japan",
  "🇸🇬 Singapore",
  "🇭🇰 Hong Kong",
  "🇦🇪 UAE",
];
const countryIdx = ref(0);
const phase = ref<"form" | "processing" | "3ds" | "success" | "fail">("form");

const usdtAmount = computed(() => Math.max(0, parseFloat(amount.value) || 0));
const feeUSD = computed(() => usdtAmount.value * 0.035);
const chargeUSD = computed(() => usdtAmount.value + feeUSD.value);

const brand = computed<"visa" | "mc" | "amex" | "unknown">(() => {
  const d = cardNum.value.replace(/\s/g, "");
  if (d.startsWith("4")) return "visa";
  if (d.startsWith("5") || d.startsWith("2")) return "mc";
  if (d.startsWith("34") || d.startsWith("37")) return "amex";
  return "unknown";
});

const isValid = computed(
  () =>
    usdtAmount.value >= 10 &&
    cardNum.value.replace(/\s/g, "").length >= 13 &&
    /^\d{2}\/\d{2}$/.test(expiry.value) &&
    /^\d{3,4}$/.test(cvv.value) &&
    holder.value.trim().length >= 2 &&
    zip.value.trim().length >= 3,
);

const receiptLine = computed(() => {
  const receiptNo = Math.floor(Math.random() * 900000 + 100000);
  const last4 = cardNum.value.replace(/\s/g, "").slice(-4);
  return `Receipt #CK-${receiptNo} · Charged $${chargeUSD.value.toFixed(2)} to ••••${last4}`;
});

// ── input handlers (uni input event → e.detail.value) ──
function detailVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onAmount(e: Event) {
  amount.value = detailVal(e).replace(/[^\d.]/g, "");
}
function onCardNum(e: Event) {
  const d = detailVal(e).replace(/\D/g, "").slice(0, 19);
  cardNum.value = d.replace(/(.{4})/g, "$1 ").trim();
}
function onExpiry(e: Event) {
  const d = detailVal(e).replace(/\D/g, "").slice(0, 4);
  expiry.value = d.length <= 2 ? d : d.slice(0, 2) + "/" + d.slice(2);
}
function onCvv(e: Event) {
  cvv.value = detailVal(e).replace(/\D/g, "").slice(0, 4);
}
function onHolder(e: Event) {
  holder.value = detailVal(e).toUpperCase();
}
function onZip(e: Event) {
  zip.value = detailVal(e).toUpperCase().slice(0, 10);
}
function onCountry(e: Event) {
  countryIdx.value = Number(detailVal(e)) || 0;
}

async function handleSubmit() {
  if (!isValid.value) return;
  phase.value = "processing";
  await new Promise((r) => setTimeout(r, 1400));
  phase.value = "3ds";
  await new Promise((r) => setTimeout(r, 2400));
  if (Math.random() > 0.1) {
    app.recordDeposit(usdtAmount.value);
    // ⚠️ Round 12 P0 fix: write a bill for the card top-up (server-owned in
    // prod via PSP webhook on successful charge — POST /api/wallet/topup).
    bills.add({
      type: "topup",
      symbol: "USDT",
      amount: usdtAmount.value,
      status: "posted",
      memo: "Card top-up",
      ref: `TOPUP-${Date.now().toString(36).toUpperCase()}`,
    });
    phase.value = "success";
  } else {
    phase.value = "fail";
  }
}

function goWallet() {
  uni.reLaunch({ url: "/pages/me/wallet", fail: () => {} });
}

// ── styles ──
const centerCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "24px",
};
const spinnerStyle: CSSProperties = {
  width: "48px",
  height: "48px",
  margin: "0 auto",
  borderRadius: "50%",
  border: "2px solid color-mix(in srgb, var(--v5-brand-2) 30%, transparent)",
  borderTopColor: "var(--v5-tech-cyan)",
  animation: "spin 1s linear infinite",
};
const centerTitleStyle: CSSProperties = {
  marginTop: "14px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "14px",
  color: "var(--v5-ink)",
};
const centerBodyStyle: CSSProperties = {
  marginTop: "4px",
  fontSize: "11.5px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.6,
  maxWidth: "280px",
  marginLeft: "auto",
  marginRight: "auto",
};
const pciChipStyle: CSSProperties = {
  marginTop: "16px",
  padding: "4px 10px",
  borderRadius: "6px",
  background: "color-mix(in srgb, var(--v5-surface-2) 50%, transparent)",
  fontSize: "10px",
  color: "var(--v5-ink-3)",
};
const successIconStyle: CSSProperties = {
  width: "56px",
  height: "56px",
  margin: "0 auto",
  borderRadius: "50%",
  background: "color-mix(in srgb, var(--v5-brand) 15%, transparent)",
  display: "grid",
  placeItems: "center",
};
const successTitleStyle: CSSProperties = {
  marginTop: "14px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "18px",
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
};
const successBtnStyle: CSSProperties = {
  marginTop: "20px",
  height: "44px",
  lineHeight: "44px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  boxShadow: "var(--v5-spotlight-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "13px",
};
const failIconStyle: CSSProperties = {
  width: "56px",
  height: "56px",
  margin: "0 auto",
  borderRadius: "50%",
  background: "color-mix(in srgb, var(--v5-brand-2) 15%, transparent)",
  display: "grid",
  placeItems: "center",
};
const failTitleStyle: CSSProperties = {
  marginTop: "14px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "15px",
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
};
const tryAgainBtnStyle: CSSProperties = {
  marginTop: "20px",
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
  color: "var(--v5-ink)",
  fontSize: "14px",
  fontWeight: 600,
};
const amountCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "16px",
};
const amountInputStyle: CSSProperties = {
  background: "transparent",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "30px",
  letterSpacing: "-0.022em",
  color: "var(--v5-ink)",
};
const feeRowStyle: CSSProperties = {
  marginTop: "8px",
  paddingTop: "8px",
  gap: "8px",
  borderTop: "1px solid var(--v5-border)",
};
const formCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "16px",
};
const fieldStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: "8px",
  background: "var(--v5-surface-2)",
};
const fieldLabelStyle: CSSProperties = {
  fontSize: "10.5px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
const fieldInputStyle: CSSProperties = {
  marginTop: "2px",
  background: "transparent",
  fontSize: "14px",
  color: "var(--v5-ink)",
};
const submitBtnStyle = computed<CSSProperties>(() => ({
  gap: "6px",
  height: "50px",
  borderRadius: "999px",
  background: isValid.value ? "var(--v5-brand)" : "var(--v5-surface-2)",
  color: isValid.value ? "var(--v5-ink)" : "var(--v5-ink-4)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "14px",
  letterSpacing: "-0.005em",
}));
const trustFootStyle: CSSProperties = {
  padding: "12px",
  borderRadius: "12px",
  background: "var(--v5-surface-2)",
};
</script>
