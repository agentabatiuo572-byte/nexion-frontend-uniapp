<!--
  Checkout — ported from Nexion-prototype/app/(main)/store/checkout/page.tsx.
  Reads ?product=<id> (default stellarbox-s1) &/or ?id= via onLoad. Buy flow
  state machine, top→bottom: stepper → AnimatePresence step card.

  Steps: select-payment → confirm → pay-instructions (chain QR / card form) →
  awaiting → confirmed → activating → live. On entering "confirmed" the order is
  persisted ONCE (debit balance incl. card fee → orders.createOrder → bills.add),
  with first-order celebration. framer AnimatePresence → CSS @keyframes fade.

  Batch C trade-in intercept (ported): on first mount, for purchasable DEVICE
  products only, open the trade-in Choice sheet if the user owns a tradeable
  device, else the slot-full Replace sheet when active slots are capped, else
  fall through to the normal payment flow. Cross-store composition (eligibility
  reads app/v-rank/network/wallet-pairing) lives here at the page layer via the
  useDeviceEligibility composable (stores never import each other, P-031/032).
  Wrapped in <AppChassis active="store"> with an in-page back/title row (matches
  detail.vue, since the chassis header is a fixed brand row).
-->
<template>
  <AppChassis active="store">
    <view style="color: var(--v5-ink)">
      <!-- In-page header: back + title -->
      <view class="flex items-center" :style="headerStyle">
        <view class="grid place-items-center active:opacity-60" :style="backBtnStyle" role="button" tabindex="0" aria-label="Back to store" @tap.stop="goBack" @click.stop="goBack">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" @tap.stop="goBack" @click.stop="goBack"><path d="m15 18-6-6 6-6" /></svg>
        </view>
        <view class="min-w-0 flex-1">
          <text class="block truncate" :style="headerTitleStyle">{{ headerTitle }}</text>
        </view>
      </view>

      <!-- Product not found -->
      <view v-if="!product" class="text-center" style="padding: 20px">
        <text class="block" style="font-size: 13.5px; color: var(--v5-ink-3); margin-bottom: 12px">{{ t.store.coProductNotFound }}</text>
        <view class="inline-flex items-center justify-center active:opacity-90" :style="notFoundBtnStyle" role="button" tabindex="0" @tap.stop="goStore" @click.stop="goStore">
          <text @tap.stop="goStore" @click.stop="goStore">{{ t.store.coBackToStore }}</text>
        </view>
      </view>

      <template v-else>
        <!-- Stepper bars -->
        <view class="flex items-center" :style="stepperRowStyle">
          <view v-for="(s, i) in stepLabels" :key="s.key" class="flex-1">
            <view class="rounded-full overflow-hidden" style="height: 4px; background: var(--v5-surface-2)">
              <view class="h-full" :style="stepFillStyle(i)" />
            </view>
          </view>
        </view>
        <view class="flex justify-between" :style="stepLabelRowStyle">
          <text v-for="(s, i) in stepLabels" :key="s.key" :style="{ color: i <= stepDisplay ? 'var(--v5-brand)' : 'var(--v5-ink-3)', fontSize: '11.5px' }">{{ s.label }}</text>
        </view>

        <!-- === select-payment === -->
        <view v-if="step === 'select-payment'" class="mx-4 rounded-2xl border overflow-hidden nx-step-in" :style="surfaceCardStyle">
          <view class="border-b" :style="payHeadStyle">
            <view class="flex items-center justify-between">
              <text style="font-size: 12.5px; color: var(--v5-ink-3)">{{ t.store.coTotal }}</text>
              <text class="tabular-nums" :style="payTotalStyle">${{ priceText }}</text>
            </view>
            <text class="block" style="font-size: 12px; color: var(--v5-ink-3); margin-top: 4px">{{ paybackLine }}</text>
          </view>
          <view style="padding: 12px">
            <text class="block font-mono-tabular" style="font-size: 12px; color: var(--v5-ink-3); padding: 0 8px 8px">{{ t.store.coPaymentMethod }}</text>
            <view
              v-for="m in PAYMENT_METHODS"
              :key="m.id"
              class="w-full flex items-center rounded-xl border active:opacity-90"
              :style="methodRowStyle(payment === m.id)"
              role="button"
              tabindex="0"
              @tap.stop="selectPayment(m.id)"
              @click.stop="selectPayment(m.id)"
            >
              <view class="grid place-items-center shrink-0" :style="methodIconStyle(payment === m.id)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="payment === m.id ? 'var(--v5-brand)' : 'var(--v5-ink-3)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="m.iconPath" /><template v-if="m.iconPath2"><path :d="m.iconPath2" /></template></svg>
              </view>
              <view class="flex-1 min-w-0">
                <text class="block" style="font-size: 13.5px; font-weight: 500; color: var(--v5-ink)">{{ m.label }}</text>
                <text class="block" style="font-size: 12px; color: var(--v5-ink-3)">{{ m.hint }}</text>
              </view>
              <svg v-if="payment === m.id" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M20 6 9 17l-5-5" /></svg>
            </view>
          </view>
          <view class="border-t" :style="payFootStyle">
            <view v-if="capped" class="flex items-start rounded-lg" :style="cappedNoteStyle">
              <text style="margin-top: 1px">⚠</text>
              <text class="flex-1" style="margin-left: 6px">{{ slotsFullText }}</text>
            </view>
            <view class="w-full grid place-items-center active:opacity-90" :style="primaryBtnStyle" role="button" tabindex="0" :aria-label="t.store.coContinue" @tap.stop="goConfirm" @click.stop="goConfirm">
              <text @tap.stop="goConfirm" @click.stop="goConfirm">{{ t.store.coContinue }}</text>
            </view>
          </view>
        </view>

        <!-- === confirm === -->
        <view v-else-if="step === 'confirm'" class="mx-4 rounded-2xl border nx-step-in" :style="confirmCardStyle">
          <text class="block font-mono-tabular" style="font-size: 13.5px; color: var(--v5-ink-3)">{{ t.store.coReviewOrder }}</text>
          <view style="margin-top: 12px">
            <CheckoutRow :label="t.store.coRowProduct" :value="product.name" />
            <CheckoutRow :label="t.store.coRowQuantity" value="1" />
            <CheckoutRow :label="t.store.coRowPayment" :value="paymentLabel" />
            <CheckoutRow :label="t.store.coRowShipping" :value="t.store.coShippingValue" />
            <template v-if="isCard">
              <CheckoutRow :label="t.store.coRowSubtotal" :value="`$${priceText}`" />
              <CheckoutRow :label="t.store.coRowCardFee" :value="`$${cardFeeText}`" />
            </template>
            <CheckoutRow v-else :label="t.store.coRowNetworkFee" :value="t.store.coFeeFree" />
            <view style="height: 1px; background: var(--v5-border); margin: 4px 0" />
            <CheckoutRow :label="t.store.coRowTotal" :value="`$${confirmTotalText}`" big />
          </view>
          <view class="w-full grid place-items-center active:opacity-90" :style="confirmCtaStyle" role="button" tabindex="0" :aria-label="isCard ? t.store.coContinueToPayment : t.store.coPayNow" @tap.stop="onConfirmPay" @click.stop="onConfirmPay">
            <text @tap.stop="onConfirmPay" @click.stop="onConfirmPay">{{ isCard ? t.store.coContinueToPayment : t.store.coPayNow }}</text>
          </view>
          <view class="w-full grid place-items-center active:opacity-80" :style="changePayBtnStyle" role="button" tabindex="0" :aria-label="t.store.coChangePayment" @tap.stop="goSelectPayment" @click.stop="goSelectPayment">
            <text @tap.stop="goSelectPayment" @click.stop="goSelectPayment">{{ t.store.coChangePayment }}</text>
          </view>
        </view>

        <!-- === pay-instructions === -->
        <view v-else-if="step === 'pay-instructions'" class="mx-4 nx-step-in">
          <CardPayment v-if="isCard" :amount="product.price" @complete="goAwaiting" @cancel="goConfirm" />
          <ChainPayment v-else :method="(payment as 'usdt-trc20' | 'usdt-erc20' | 'btc')" :amount="product.price" @complete="goAwaiting" @cancel="goConfirm" />
        </view>

        <!-- === awaiting === -->
        <view v-else-if="step === 'awaiting'" class="mx-4 rounded-2xl border text-center nx-step-in" :style="centerCardStyle">
          <view class="mx-auto grid place-items-center nx-spin" :style="spinnerWrapStyle">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          </view>
          <text class="block" :style="centerTitleStyle">{{ t.store.coAwaiting }}</text>
          <text class="block" style="margin-top: 4px; font-size: 12px; color: var(--v5-ink-3); line-height: 1.4; padding: 0 8px">{{ isCard ? t.store.coAwaitingCard : t.store.coAwaitingChain }}</text>
        </view>

        <!-- === confirmed === -->
        <view v-else-if="step === 'confirmed'" class="mx-4 rounded-2xl border text-center relative overflow-hidden nx-pop-in" :style="centerCardStyle">
          <template v-if="firstOrderCelebrating">
            <view aria-hidden :style="celebrateGlowStyle" />
            <view class="relative">
              <view class="mx-auto grid place-items-center nx-pop-in" :style="medalStyle">
                <text style="font-size: 26px">🏅</text>
              </view>
              <text class="block" :style="centerTitleStyle" style="margin-top: 12px">{{ t.store.firstOrderTitle }}</text>
              <text class="block" style="margin-top: 4px; font-size: 12px; color: var(--v5-ink-2); line-height: 1.4">{{ t.store.firstOrderBody }}</text>
              <view class="inline-flex items-center justify-center" style="margin-top: 8px; gap: 4px; font-size: 11.5px; color: var(--v5-brand)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.94 14.34 12 22l2.06-7.66L22 12l-7.94-2.34L12 2 9.94 9.66 2 12z" /></svg>
                <text>{{ t.store.firstOrderAchievement }}</text>
              </view>
            </view>
          </template>
          <template v-else>
            <view class="mx-auto grid place-items-center" :style="spinnerWrapStyle">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </view>
            <text class="block" :style="centerTitleStyle" style="color: var(--v5-brand)">{{ t.store.coPaymentConfirmed }}</text>
            <text class="block" style="margin-top: 4px; font-size: 12px; color: var(--v5-ink-3)">{{ t.store.coConfirmedSub }}</text>
          </template>
        </view>

        <!-- === activating === -->
        <view v-else-if="step === 'activating'" class="mx-4 rounded-2xl border text-center nx-step-in" :style="centerCardStyle">
          <view class="mx-auto grid place-items-center nx-spin" :style="spinnerWrapStyle">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          </view>
          <text class="block" :style="centerTitleStyle">{{ t.store.coActivating }}</text>
          <text class="block" style="margin-top: 4px; font-size: 12px; color: var(--v5-ink-3)">{{ activatingSubText }}</text>
          <view class="mx-auto rounded-full overflow-hidden" style="margin-top: 16px; max-width: 200px; height: 6px; background: var(--v5-surface-2)">
            <view class="h-full nx-progress-fill" style="background: var(--v5-brand)" />
          </view>
        </view>

        <!-- === live === -->
        <view v-else-if="step === 'live'" class="mx-4 rounded-2xl border text-center nx-pop-in" :style="liveCardStyle">
          <view class="mx-auto grid place-items-center" :style="spinnerWrapStyle">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></svg>
          </view>
          <text class="block" :style="liveTitleStyle">{{ t.store.coOrderPlaced }}</text>
          <text class="block" style="margin-top: 4px; font-size: 12px; color: var(--v5-ink-3); line-height: 1.45; padding: 0 4px">{{ orderPlacedBody }}</text>
          <view class="flex" style="margin-top: 20px; gap: 8px">
            <view class="flex-1 grid place-items-center active:opacity-90" :style="trackBtnStyle" role="button" tabindex="0" :aria-label="t.store.coTrackOrder" @tap.stop="goTrack" @click.stop="goTrack">
              <text @tap.stop="goTrack" @click.stop="goTrack">{{ t.store.coTrackOrder }}</text>
            </view>
            <view class="grid place-items-center active:opacity-80" :style="doneBtnStyle" role="button" tabindex="0" :aria-label="t.store.coDone" @tap.stop="goStore" @click.stop="goStore">
              <text @tap.stop="goStore" @click.stop="goStore">{{ t.store.coDone }}</text>
            </view>
          </view>
        </view>
      </template>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, type CSSProperties } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import CheckoutRow from "@/components/store/checkout-row.vue";
import ChainPayment from "@/components/store/chain-payment.vue";
import CardPayment from "@/components/store/card-payment.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { getProduct, annualRoiPct, type Product } from "@/mock/products";
import { useApp } from "@/store/app";
import { useOrders, type Order } from "@/store/orders";
import { useBills } from "@/store/bills";
import { useTradeinSheet } from "@/store/tradein-sheet";
import { useDeviceEligibility } from "@/composables/use-device-eligibility";
import { navTo } from "@/lib/route";
import type { DeviceKind } from "@/store/types";
import { toast } from "@/store/ui";

// cap applies to ACTIVE slots, not inventory (source Sprint #146-1).
const MAX_DEVICES = 6;

type Step =
  | "select-payment"
  | "confirm"
  | "pay-instructions"
  | "awaiting"
  | "confirmed"
  | "activating"
  | "live";

interface PaymentMethod {
  id: string;
  label: string;
  hint: string;
  iconPath: string;
  iconPath2?: string;
}

const t = useT();
const app = useApp();
const orders = useOrders();
const bills = useBills();

// wallet icon path (lucide Wallet), bitcoin path, credit-card path
const WALLET_PATH = "M21 12V7H5a2 2 0 0 1 0-4h14v4";
const WALLET_PATH2 = "M3 5v14a2 2 0 0 0 2 2h16v-5";
const PAYMENT_METHODS = computed<PaymentMethod[]>(() => [
  { id: "usdt-trc20", label: "USDT (TRC20)", hint: "Lowest fee · 5 min", iconPath: WALLET_PATH, iconPath2: WALLET_PATH2 },
  { id: "usdt-erc20", label: "USDT (ERC20)", hint: "15 min", iconPath: WALLET_PATH, iconPath2: WALLET_PATH2 },
  { id: "btc", label: "Bitcoin", hint: "30 min", iconPath: "M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727" },
  { id: "card", label: "Card", hint: "Instant · +3.5% fee", iconPath: "M2 5h20a0 0 0 0 1 0 0v14a0 0 0 0 1 0 0H2a0 0 0 0 1 0 0V5a0 0 0 0 1 0 0z M2 10h20" },
]);

const tradein = useTradeinSheet();

const productId = ref("stellarbox-s1");
onLoad((options) => {
  const o = (options || {}) as Record<string, string>;
  // accept ?product= (canonical) or ?id= (per task spec)
  if (o.product) productId.value = o.product;
  else if (o.id) productId.value = o.id;
  // Trade-in intercept must run AFTER productId resolves (so the eligibility
  // composable gets the real device kind). onLoad fires before onMounted in
  // uni pages, so this is the single earliest point the kind is known.
  fireTradeinIntercept();
});

const product = computed<Product | undefined>(() => getProduct(productId.value));

// ─── Batch C trade-in intercept (one-shot) ───────────────────────────────
// Product ids that map to a real DeviceKind (mirrors source KNOWN_KINDS). The
// catalog-only ids "stellarbox-pro-v2" / "stellarrack-p2" are NOT in the
// eligibility/DEVICE_KINDS schema yet, so they take the plain checkout path
// (no intercept) — exactly as the source gates them. Fire on first mount only:
// choice (has an active tradeable device) → replace (slots capped) → fall
// through to normal payment. Non-device checkouts (the v2/P2 catalog ids) never
// intercept.
const KNOWN_KINDS: DeviceKind[] = [
  "phone",
  "stellarbox-s1",
  "stellarbox-pro",
  "stellarrack-p1",
  "cloud-share",
];
let interceptFired = false;
function fireTradeinIntercept() {
  if (interceptFired) return;
  interceptFired = true;
  const p = getProduct(productId.value);
  if (!p || !KNOWN_KINDS.includes(p.id as DeviceKind)) return;
  const kind = p.id as DeviceKind;
  // Compose eligibility from the stores at the page layer (P-031/032).
  const { canTradeIn, tradeInSources, capped } = useDeviceEligibility(kind);
  // Priority: trade-in (only with ≥1 active-tradein source) → slot-full
  // replace → normal flow.
  if (canTradeIn.value && tradeInSources.value.length > 0) {
    tradein.showChoice(kind, p.price, tradeInSources.value);
    return;
  }
  if (capped.value) {
    tradein.showReplace(kind, p.price);
  }
}
const headerTitle = computed(() => product.value?.name ?? t.value.store.coProductNotFound);

const step = ref<Step>("select-payment");
const payment = ref<string>("usdt-trc20");
const orderId = ref<string | null>(null);
// Re-entry guard for the confirm→pay tap (mirrors source confirmingRef) —
// prevents a double-tap from racing the step transition.
let confirming = false;
// Snapshot "was empty before this checkout" BEFORE createOrder increments it.
const wasEmptyBefore = ref(orders.orders.length === 0);
const firstOrderCelebrating = ref(false);

const isCard = computed(() => payment.value === "card");
const capped = computed(() => app.devices.filter((d) => d.activatedAt !== null).length >= MAX_DEVICES);

// ── derived text ──
const priceText = computed(() => (product.value?.price ?? 0).toLocaleString());
const cardFee = computed(() => (isCard.value && product.value ? +(product.value.price * 0.035).toFixed(2) : 0));
const cardFeeText = computed(() => cardFee.value.toLocaleString());
const confirmTotalText = computed(() => ((product.value?.price ?? 0) + cardFee.value).toLocaleString());
const paymentLabel = computed(() => PAYMENT_METHODS.value.find((m) => m.id === payment.value)?.label ?? "");
const paybackLine = computed(() => {
  const p = product.value;
  if (!p) return "";
  return fmt(t.value.store.coEstPayback, {
    days: Math.round(p.price / p.dailyEarn),
    roi: annualRoiPct(p),
  });
});
const slotsFullText = computed(() => fmt(t.value.store.coSlotsFull, { max: MAX_DEVICES }));
const activatingSubText = computed(() => {
  const p = product.value;
  const dc = p?.tier === "Flagship" ? t.value.store.coDcFrankfurt : t.value.store.coDcSingapore;
  return fmt(t.value.store.coActivatingSub, { dc });
});
const orderPlacedBody = computed(() => fmt(t.value.store.coOrderPlacedBody, { name: product.value?.name ?? "" }));

// ── stepper ──
const stepLabels = computed(() => [
  { key: "select-payment", label: t.value.store.coStepPayment },
  { key: "confirm", label: t.value.store.coStepConfirm },
  { key: "pay-instructions", label: t.value.store.coStepPay },
  { key: "activating", label: t.value.store.coStepActivate },
  { key: "live", label: t.value.store.coStepLive },
]);
const stepDisplay = computed(() => {
  if (step.value === "awaiting" || step.value === "confirmed") return 2;
  const idx = stepLabels.value.findIndex((s) => s.key === step.value);
  return idx < 0 ? 0 : idx;
});

function selectPayment(id: string) {
  payment.value = id;
}

function goConfirm() {
  if (step.value === "pay-instructions" || step.value === "confirm") {
    step.value = "confirm";
    return;
  }
  if (step.value !== "select-payment") return;
  step.value = "confirm";
}

function goSelectPayment() {
  step.value = "select-payment";
}

function goAwaiting() {
  if (step.value !== "pay-instructions") return;
  step.value = "awaiting";
}

function onConfirmPay() {
  if (confirming || step.value !== "confirm") return;
  confirming = true;
  step.value = "pay-instructions";
  setTimeout(() => { confirming = false; }, 0);
}

// ── state-machine timers (mirror source useEffect auto-advance chain) ──
let advanceTimer: ReturnType<typeof setTimeout> | undefined;
function clearAdvance() {
  if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = undefined; }
}

watch(step, (s) => {
  clearAdvance();
  if (s === "awaiting") {
    advanceTimer = setTimeout(() => { step.value = "confirmed"; }, 2400);
    return;
  }
  if (s === "confirmed") {
    const p = product.value;
    if (!p) return;
    // Persist order + spend bill — only ONCE per checkout (orderId guard).
    if (!orderId.value) {
      // Card payment charges the displayed total INCLUDING the 3.5% fee
      // (chain payments have no fee). Mock approximation of server-side PSP
      // debit — production: POST /api/orders does authorize+capture atomically.
      const fee = isCard.value ? +(p.price * 0.035).toFixed(2) : 0;
      const chargeTotal = +(p.price + fee).toFixed(2);
      const ok = app.debitBalance(chargeTotal);
      if (!ok) {
        // Insufficient balance — bail out of the auto-advance chain (402).
        step.value = "select-payment";
        return;
      }
      const ord = orders.createOrder({
        productId: p.id as Order["productId"],
        productName: p.name,
        unitPrice: p.price,
        paymentMethod: payment.value,
      });
      orderId.value = ord.id;
      bills.add({
        type: "purchase",
        symbol: "USDT",
        amount: -chargeTotal,
        status: "posted",
        memo:
          fee > 0
            ? `Purchase · ${p.name} (incl. 3.5% card fee $${fee})`
            : `Purchase · ${p.name}`,
        ref: ord.id,
      });
      if (wasEmptyBefore.value) firstOrderCelebrating.value = true;
    }
    // Timer lives OUTSIDE the !orderId guard, else the re-render from setting
    // orderId clears it and confirmed → activating never fires.
    advanceTimer = setTimeout(() => { step.value = "activating"; }, 1500);
    return;
  }
  if (s === "activating") {
    advanceTimer = setTimeout(() => { step.value = "live"; }, 3000);
    return;
  }
  if (s === "live" && product.value && orderId.value) {
    toast.success(
      t.value.store.coOrderPlaced,
      `Your ${product.value.name} is being provisioned in our data center.`,
    );
  }
});

function goBack() {
  navTo("/store");
}
function goStore() {
  navTo("/store");
}
function goTrack() {
  const url = orderId.value
    ? `/pages/store/order-detail?id=${orderId.value}`
    : "/pages/store/orders";
  navTo(url);
}

function cleanup() { clearAdvance(); }
onUnload(() => cleanup());
onUnmounted(() => cleanup());

// ─── styles ───
const headerStyle: CSSProperties = { gap: "8px", padding: "8px 14px 8px" };
const backBtnStyle: CSSProperties = { width: "36px", height: "36px", marginLeft: "-6px" };
const headerTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "17px",
  fontWeight: 600,
  color: "var(--v5-ink)",
  letterSpacing: "-0.014em",
};
const notFoundBtnStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 20px",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
  color: "var(--v5-ink)",
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 600,
};
const stepperRowStyle: CSSProperties = { margin: "0 16px 12px", gap: "6px" };
const stepLabelRowStyle: CSSProperties = { margin: "0 16px 12px" };
function stepFillStyle(i: number): CSSProperties {
  const w = i < stepDisplay.value ? "100%" : i === stepDisplay.value ? "50%" : "0%";
  return { width: w, background: "var(--v5-brand)", transition: "width 0.5s" };
}
const surfaceCardStyle: CSSProperties = { background: "var(--v5-surface)", borderColor: "var(--v5-border)" };
const payHeadStyle: CSSProperties = { padding: "16px 20px", borderColor: "var(--v5-border)" };
const payTotalStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "20px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
function methodRowStyle(active: boolean): CSSProperties {
  return {
    marginTop: "8px",
    padding: "12px",
    gap: "12px",
    borderRadius: "12px",
    background: active ? "var(--v5-brand-soft)" : "var(--v5-surface-2)",
    borderColor: active ? "var(--v5-brand-border)" : "var(--v5-border)",
  };
}
function methodIconStyle(active: boolean): CSSProperties {
  return {
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    background: active ? "var(--v5-brand-soft)" : "var(--v5-surface)",
  };
}
const payFootStyle: CSSProperties = { padding: "16px", borderColor: "var(--v5-border)" };
const cappedNoteStyle: CSSProperties = {
  marginBottom: "8px",
  padding: "8px 12px",
  fontSize: "12px",
  color: "var(--v5-warning)",
  background: "var(--v5-warning-soft)",
};
const primaryBtnStyle: CSSProperties = {
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontSize: "14px",
  fontWeight: 600,
};
const confirmCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "20px",
};
const confirmCtaStyle: CSSProperties = {
  marginTop: "20px",
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontSize: "14px",
  fontWeight: 600,
};
const changePayBtnStyle: CSSProperties = {
  marginTop: "8px",
  height: "40px",
  borderRadius: "12px",
  background: "var(--v5-surface-2)",
  color: "var(--v5-ink-2)",
  fontSize: "12.5px",
};
const centerCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "24px",
};
const spinnerWrapStyle: CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  background: "var(--v5-brand-soft)",
};
const centerTitleStyle: CSSProperties = {
  marginTop: "16px",
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const celebrateGlowStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "radial-gradient(60% 70% at 50% 0%, var(--v5-brand-soft), transparent 70%)",
  pointerEvents: "none",
};
const medalStyle: CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  background: "var(--v5-brand-soft)",
};
const liveCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "24px",
};
const liveTitleStyle: CSSProperties = {
  marginTop: "16px",
  fontFamily: "var(--font-v5)",
  fontSize: "18px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const trackBtnStyle: CSSProperties = {
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontSize: "14px",
  fontWeight: 600,
};
const doneBtnStyle: CSSProperties = {
  height: "44px",
  padding: "0 16px",
  borderRadius: "12px",
  background: "var(--v5-surface-2)",
  color: "var(--v5-ink-2)",
  fontSize: "13.5px",
};
</script>

<style scoped>
.nx-step-in {
  animation: nx-step-in 0.28s var(--ease-out, ease-out) both;
}
@keyframes nx-step-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.nx-pop-in {
  animation: nx-pop-in 0.3s var(--ease-out, ease-out) both;
}
@keyframes nx-pop-in {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.nx-spin {
  animation: nx-spin 1s linear infinite;
}
@keyframes nx-spin {
  to { transform: rotate(360deg); }
}
.nx-progress-fill {
  width: 0%;
  animation: nx-progress-fill 3s linear forwards;
}
@keyframes nx-progress-fill {
  to { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .nx-step-in, .nx-pop-in, .nx-spin, .nx-progress-fill { animation: none; }
  .nx-progress-fill { width: 100%; }
}
</style>
