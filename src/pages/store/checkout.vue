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
  Wrapped in <AppChassis active="store">; the back + "Checkout" title live in the
  sticky chassis nav header via useSetPageHeader (mirrors the prototype's
  <SetPageHeader backHref={`/store/${product.id}`}/>, where the chassis Header
  fills in the route title headerTitles.storeCheckout).
-->
<template>
  <AppChassis active="store">
    <view style="color: var(--v5-ink)">
      <!-- Back + title now live in the sticky chassis nav header
           (useSetPageHeader below) so they pin on scroll, mirroring the
           prototype's <SetPageHeader>. -->

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
              <text class="tabular-nums" :style="payTotalStyle">${{ netPriceText }}</text>
            </view>
            <text class="block" style="font-size: 12px; color: var(--v5-ink-3); margin-top: 4px">{{ paybackLine }}</text>
            <view v-if="hasVoucher" class="flex items-center" style="gap: 5px; margin-top: 6px">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" /><path d="M13 5v14" /></svg>
              <text style="font-size: 11.5px; color: var(--v5-brand)">{{ t.voucher.checkoutRowLabel }} −${{ voucherDiscountText }}</text>
            </view>
            <view v-else-if="expiredVoucherForSku" class="flex items-center" style="gap: 5px; margin-top: 6px">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" /><path d="M13 5v14" /></svg>
              <text style="font-size: 11.5px; color: var(--v5-ink-4)">{{ t.voucher.expiredNote }}</text>
            </view>
            <!-- FEAT-DEV02:旧机抵扣行 + 移除出口(移除即恢复原价) -->
            <view v-if="hasTradein" class="flex items-center" style="gap: 5px; margin-top: 6px">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="m16 12-4-4-4 4" /><path d="M12 16V8" /></svg>
              <text class="flex-1" style="font-size: 11.5px; color: var(--v5-success)">{{ tradeinChipText }}</text>
              <text style="font-size: 11.5px; color: var(--v5-ink-4); padding: 4px 6px" @click="removeTradein">{{ t.tradein.checkoutRemove }}</text>
            </view>
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
            <view class="w-full grid place-items-center active:opacity-90 active:scale-[0.98]" :style="primaryBtnStyle" role="button" tabindex="0" :aria-label="t.store.coContinue" @tap.stop="goConfirm" @click.stop="goConfirm">
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
            <!-- Subtotal revealed when a voucher applies (to show the discount) or
                 when a card fee applies; voucher row sits between subtotal & fee. -->
            <CheckoutRow v-if="hasVoucher || isCard || hasTradein" :label="t.store.coRowSubtotal" :value="`$${priceText}`" />
            <CheckoutRow v-if="hasVoucher" :label="t.voucher.checkoutRowLabel" :value="`−$${voucherDiscountText}`" />
            <CheckoutRow v-if="hasTradein" :label="t.tradein.checkoutRowLabel" :value="`−$${tradeinCreditText}`" />
            <CheckoutRow v-if="isCard" :label="t.store.coRowCardFee" :value="`$${cardFeeText}`" />
            <CheckoutRow v-else :label="t.store.coRowNetworkFee" :value="t.store.coFeeFree" />
            <view style="height: 1px; background: var(--v5-border); margin: 4px 0" />
            <CheckoutRow :label="t.store.coRowTotal" :value="`$${confirmTotalText}`" big />
          </view>
          <view class="w-full grid place-items-center active:opacity-90 active:scale-[0.98]" :style="confirmCtaStyle" role="button" tabindex="0" :aria-label="isCard ? t.store.coContinueToPayment : t.store.coPayNow" @tap.stop="onConfirmPay" @click.stop="onConfirmPay">
            <text @tap.stop="onConfirmPay" @click.stop="onConfirmPay">{{ isCard ? t.store.coContinueToPayment : t.store.coPayNow }}</text>
          </view>
          <view class="w-full grid place-items-center active:bg-[var(--v5-surface-3)]" :style="changePayBtnStyle" role="button" tabindex="0" :aria-label="t.store.coChangePayment" @tap.stop="goSelectPayment" @click.stop="goSelectPayment">
            <text @tap.stop="goSelectPayment" @click.stop="goSelectPayment">{{ t.store.coChangePayment }}</text>
          </view>
        </view>

        <!-- === pay-instructions === -->
        <view v-else-if="step === 'pay-instructions'" class="mx-4 nx-step-in">
          <CardPayment v-if="isCard" :amount="netPrice" @complete="goAwaiting" @cancel="goConfirm" />
          <ChainPayment v-else :method="(payment as 'usdt-trc20' | 'usdt-erc20' | 'btc')" :amount="netPrice" @complete="goAwaiting" @cancel="goConfirm" />
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
          <view class="mx-auto grid place-items-center" :style="liveSpinnerWrapStyle">
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
import { computeTradeInCredit } from "@/mock/tradein-config";
import { voucherAppliesToSku } from "@/mock/vouchers";
import { useApp } from "@/store/app";
import { useOrders, type Order } from "@/store/orders";
import { useBills } from "@/store/bills";
import { useVoucher } from "@/store/voucher";
import { useTradeinSheet } from "@/store/tradein-sheet";
import { trialReservesSlotNow } from "@/store/free-trial";
import { useDeviceEligibility } from "@/composables/use-device-eligibility";
import { usePurchaseGate } from "@/composables/use-purchase-gate";
import { useSetPageHeader } from "@/composables/use-page-header";
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
const voucher = useVoucher();

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
  // Hard purchase gate (等级门/锁额): refuse checkout for ineligible / sold-out
  // SKUs — deep-link defense (store cards & detail already redirect blocked users
  // to /team/quota). Server re-checks on POST /api/orders (server-canonical).
  if (purchaseGate.value.blocked) {
    uni.showToast({
      title: purchaseGate.value.soldOut
        ? t.value.store.gateSoldOutToast
        : t.value.store.gateBlockedToast,
      icon: "none",
    });
    navTo("/pages/team/quota");
    return;
  }
  // Trade-in intercept must run AFTER productId resolves (so the eligibility
  // composable gets the real device kind). onLoad fires before onMounted in
  // uni pages, so this is the single earliest point the kind is known.
  fireTradeinIntercept();
});

const product = computed<Product | undefined>(() => getProduct(productId.value));
// Hard purchase gate (等级门 + 锁额) — single source via usePurchaseGate.
const { gate: purchaseGate } = usePurchaseGate(product);

// ─── Voucher redemption ──────────────────────────────────────────────────
// Best claimed-unused voucher applicable to this SKU at its base price. The
// discount applies to the device subtotal; the 3.5% card fee (if any) is then
// computed on the discounted subtotal. The voucher is marked used once the
// order persists (single-use). bestVoucherFor returns null when none applies.
// Stacking/性质 policy (后台可配,见 OpsVoucher): voucher is the SOLE discount in
// this checkout flow (trial-offset lives in the trial redeem flow; bundle
// discount in the bundle page), so stackWithTrial/stackWithOthers are honored
// trivially here. 不可提现 is inherent — the discount only reduces price, never
// credits the balance; 不可拆分 is inherent — one voucher applied whole, then markUsed.
// Real backend: redemption is server-side & atomic — the checkout sends `voucherId`
// in the POST /api/orders body; the server re-validates (claimed/unused/applicable/
// stacking) + marks it redeemed in the same transaction as order creation. The
// markUsed() below is the mock's optimistic mirror of that server effect.
const voucherMatch = computed(() => {
  const p = product.value;
  return p ? voucher.bestVoucherFor(p.id, p.price) : null;
});
const voucherDiscount = computed(() => voucherMatch.value?.discountUSD ?? 0);
const hasVoucher = computed(() => voucherDiscount.value > 0);
const voucherDiscountText = computed(() => voucherDiscount.value.toLocaleString());

// ─── FEAT-DEV02 旧机抵扣 ─────────────────────────────────────────────────
// retire 流(设备页下架)或本页 choice 弹层确认后,tradein.appliedTradein 携带
// {oldDeviceId, targetKind};仅当目标与本单 SKU 匹配且旧机仍在、无运行中任务时
// 生效。抵扣只减应付,永不入余额;真值 server-authoritative(POST /api/orders
// 服务端同事务复算+下架)。
const appliedTradeinView = computed(() => {
  const a = tradein.appliedTradein;
  const p = product.value;
  if (!a || !p || a.targetKind !== p.id) return null;
  const device = app.devices.find((d) => d.id === a.oldDeviceId);
  if (!device || device.currentTask) return null;
  const credit = computeTradeInCredit(
    device.paidPriceUsdt ?? 0,
    Math.max(0, device.cumulativeEarningsUsdt ?? 0),
    p.price,
  );
  return credit > 0 ? { device, credit } : null;
});
const tradeinCredit = computed(() => appliedTradeinView.value?.credit ?? 0);
const hasTradein = computed(() => tradeinCredit.value > 0);
const tradeinCreditText = computed(() => tradeinCredit.value.toLocaleString());
const tradeinChipText = computed(() => {
  const ti = appliedTradeinView.value;
  if (!ti) return "";
  return fmt(t.value.tradein.checkoutCreditChip, {
    name: ti.device.name,
    credit: tradeinCreditText.value,
  });
});
function removeTradein() {
  tradein.clearApplied();
}

const netPrice = computed(() =>
  Math.max(0, +(((product.value?.price ?? 0) - voucherDiscount.value - tradeinCredit.value).toFixed(2))),
);
// P2-1: if the user CLAIMED a voucher that applies to this SKU but it has expired
// (so bestVoucherFor skipped it), surface a muted "已过期" note instead of silently
// showing no discount. Only when no active voucher applies.
const expiredVoucherForSku = computed(() => {
  const p = product.value;
  if (!p || hasVoucher.value) return null;
  return voucher.expiredVouchers.some((def) => voucherAppliesToSku(def, p.id));
});

// ─── Trade-in intercept (one-shot) ───────────────────────────────────────
// FEAT-DEV02: every catalog SKU is a real DeviceKind now (v2/P2 included), so
// all device checkouts intercept. Fire on first mount only: skip when a retire
// context already targets this SKU (arrived from the devices-page flow) →
// choice (owns ≥1 retirable device) → slot-full replace → normal payment.
const KNOWN_KINDS: DeviceKind[] = [
  "phone",
  "stellarbox-s1",
  "stellarbox-pro",
  "stellarbox-pro-v2",
  "stellarrack-p1",
  "stellarrack-p2",
  "cloud-share",
];
let interceptFired = false;
function fireTradeinIntercept() {
  if (interceptFired) return;
  interceptFired = true;
  const p = getProduct(productId.value);
  if (!p || !KNOWN_KINDS.includes(p.id as DeviceKind)) return;
  const kind = p.id as DeviceKind;
  if (tradein.appliedTradein?.targetKind === kind) return;
  // Compose eligibility from the stores at the page layer (P-031/032).
  const { canTradeIn, tradeInSources, capped } = useDeviceEligibility(kind);
  // Priority: trade-in (only with ≥1 active-tradein source) → slot-full
  // replace → normal flow.
  if (canTradeIn.value && tradeInSources.value.length > 0) {
    tradein.showChoice(kind, p.price, tradeInSources.value.map((d) => d.id));
    return;
  }
  if (capped.value) {
    tradein.showReplace(kind, p.price);
  }
}
// Sticky chassis nav header — back + "Checkout" title (mirrors the prototype's
// <SetPageHeader backHref={`/store/${product.id}`}/>, whose chassis Header
// resolves the route title headerTitles.storeCheckout). Getter form so backHref
// re-resolves once productId loads (onLoad). Back goes to the product detail
// page (uni: /pages/store/detail?id=) to match the source backHref, falling
// back to the store grid before the product resolves.
useSetPageHeader(() => ({
  title: t.value.headerTitles.storeCheckout,
  backHref: product.value ? `/pages/store/detail?id=${product.value.id}` : "/store",
}));

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
const reservedSlots = computed(() => (trialReservesSlotNow() ? 1 : 0));
const capped = computed(() => app.activeSlotCount + reservedSlots.value >= MAX_DEVICES);

// ── derived text ──
const priceText = computed(() => (product.value?.price ?? 0).toLocaleString());
// Header "Total" = device price after voucher (still excludes card fee, matching
// the pre-voucher convention). Card fee is computed on the discounted subtotal.
const netPriceText = computed(() => netPrice.value.toLocaleString());
const cardFee = computed(() => (isCard.value ? +(netPrice.value * 0.035).toFixed(2) : 0));
const cardFeeText = computed(() => cardFee.value.toLocaleString());
const confirmTotalText = computed(() => (netPrice.value + cardFee.value).toLocaleString());
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
      // Capture the voucher discount BEFORE markUsed mutates the wallet (which
      // would recompute voucherMatch → null). Discount applies to the device
      // subtotal; card fee (if any) is computed on the discounted subtotal.
      const discount = voucherDiscount.value;
      const usedVoucherId = voucherMatch.value?.def.id ?? null;
      // FEAT-DEV02:先快照抵扣上下文(clearApplied 会把 computed 归零),再走
      // 扣款→下架的同步原子块。抵扣只减应付;新机由订单履约管线 addDevice
      // 未激活入库,本块不生成设备。
      const ti = appliedTradeinView.value;
      const tradeInCredit = ti?.credit ?? 0;
      const net = Math.max(0, +(p.price - discount - tradeInCredit).toFixed(2));
      // Card payment charges the displayed total INCLUDING the 3.5% fee
      // (chain payments have no fee). Mock approximation of server-side PSP
      // debit — production: POST /api/orders does authorize+capture atomically.
      const fee = isCard.value ? +(net * 0.035).toFixed(2) : 0;
      const chargeTotal = +(net + fee).toFixed(2);
      const ok = app.debitBalance(chargeTotal);
      if (!ok) {
        // Insufficient balance — bail out of the auto-advance chain (402).
        step.value = "select-payment";
        return;
      }
      // 扣款成功后同步移除旧机(下架),再清抵扣上下文——全程同步无 await,
      // 不存在半执行窗口;失败路径(上面 return)未动任何状态。
      if (ti) {
        app.devices = app.devices.filter((d) => d.id !== ti.device.id);
        app.persistAccountSnapshot();
        tradein.clearApplied();
      }
      const ord = orders.createOrder({
        productId: p.id as Order["productId"],
        productName: p.name,
        unitPrice: p.price,
        paymentMethod: payment.value,
        discount,
        ...(ti && { tradeInCredit, tradeInDeviceId: ti.device.id }),
      });
      orderId.value = ord.id;
      // Consume the voucher (single-use) once the order is persisted.
      if (discount > 0 && usedVoucherId) voucher.markUsed(usedVoucherId);
      const memoParts: string[] = [];
      if (discount > 0) memoParts.push(`voucher -$${discount}`);
      if (ti) memoParts.push(`trade-in ${ti.device.name} -$${tradeInCredit}`);
      if (fee > 0) memoParts.push(`incl. 3.5% card fee $${fee}`);
      bills.add({
        type: "purchase",
        symbol: "USDT",
        amount: -chargeTotal,
        status: "posted",
        memo: memoParts.length ? `Purchase · ${p.name} (${memoParts.join(", ")})` : `Purchase · ${p.name}`,
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

function goStore() {
  navTo("/store");
}
function goTrack() {
  const url = orderId.value
    ? `/pages/store/order-detail?id=${orderId.value}`
    : "/pages/store/orders";
  navTo(url);
}

// 离开结算页即放弃未使用的抵扣上下文(内存态,无半执行风险)。
function cleanup() { clearAdvance(); tradein.clearApplied(); }
onUnload(() => cleanup());
onUnmounted(() => cleanup());

// ─── styles ───
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
const payHeadStyle: CSSProperties = { padding: "16px 20px", borderColor: "color-mix(in srgb, var(--v5-border) 70%, transparent)" };
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
    borderColor: active ? "var(--v5-brand-border)" : "color-mix(in srgb, var(--v5-border) 70%, transparent)",
  };
}
function methodIconStyle(active: boolean): CSSProperties {
  return {
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    background: active ? "var(--v5-brand-soft)" : "var(--v5-surface-2)",
  };
}
const payFootStyle: CSSProperties = { padding: "16px", borderColor: "color-mix(in srgb, var(--v5-border) 70%, transparent)" };
const cappedNoteStyle: CSSProperties = {
  marginBottom: "8px",
  padding: "8px 12px",
  fontSize: "12px",
  color: "var(--v5-warning)",
  background: "color-mix(in srgb, var(--v5-warning) 10%, transparent)",
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
// awaiting / activating / confirmed-check spinner — brand 15% (source).
const spinnerWrapStyle: CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  background: "color-mix(in srgb, var(--v5-brand) 15%, transparent)",
};
// live (rocket) spinner — brand 20% (source), matches the medal tier.
const liveSpinnerWrapStyle: CSSProperties = {
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
  // Source: bg-gradient-to-br from-brand/15 via-#0F0F0F to-brand/10. Middle stop
  // uses --v5-surface (not the source's hardcoded #0F0F0F) for dual-theme safety.
  background:
    "linear-gradient(to bottom right, color-mix(in srgb, var(--v5-brand) 15%, transparent), var(--v5-surface), color-mix(in srgb, var(--v5-brand) 10%, transparent))",
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
