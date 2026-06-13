<!--
  GenesisPurchaseSheet — Genesis Node reserve/confirm sheet.

  Source: Nexion-prototype/app/components/genesis-sheet-host.tsx (chassis-level
  zustand host). uni has no chassis-level sheet host for sub-pages, so the sheet
  is embedded in genesis.vue and toggled via `v-model:open`. framer-motion
  slide-up → CSS <transition> (backdrop fade + panel slide).

  Cross-store side-effect (architecture铁律: stores don't import each other) —
  the purchase handler composes genesis.purchase() + app.debitBalance() +
  bills.add() here in the component.
-->
<template>
  <view v-if="open">
    <!-- Backdrop -->
    <transition name="nx-sheet-fade">
      <view v-if="open" class="nx-sheet-backdrop" @click="emitClose" />
    </transition>
    <!-- Panel -->
    <transition name="nx-sheet-slide">
      <view v-if="open" class="nx-sheet-panel" :style="panelStyle" @click.stop>
        <!-- Title row -->
        <view class="flex items-start justify-between" style="margin-bottom: 16px">
          <view>
            <text class="block" :style="titleStyle">{{ t.genesis.confirmTitle }}</text>
            <text class="block" :style="subtitleStyle">{{ subtitleText }}</text>
          </view>
          <view class="inline-flex items-center justify-center active:opacity-60" :style="closeBtnStyle" @click="emitClose">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </view>
        </view>

        <!-- Quantity stepper -->
        <view :style="stepperWrapStyle">
          <text class="block" :style="stepperLabelStyle">{{ t.genesis.quantity }}</text>
          <view class="flex items-center" style="margin-top: 8px; gap: 16px">
            <view class="flex items-center justify-center active:opacity-70" :style="minusBtnStyle" @click="dec">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /></svg>
            </view>
            <view class="flex-1 text-center">
              <text class="tabular-nums" :style="qtyStyle">{{ qty }}</text>
            </view>
            <view class="flex items-center justify-center active:opacity-70" :style="plusBtnStyle" @click="inc">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
            </view>
          </view>
        </view>

        <!-- Summary -->
        <view :style="summaryStyle">
          <view class="flex items-center justify-between">
            <text :style="rowLabelStyle">{{ t.genesis.subtotal }}</text>
            <text class="tabular-nums" :style="rowValStyle">${{ subtotalText }}</text>
          </view>
          <view class="flex items-center justify-between">
            <text :style="rowLabelMutedStyle">{{ t.genesis.networkFee }}</text>
            <text class="tabular-nums" :style="rowValStyle">{{ t.genesis.networkFeeFree }}</text>
          </view>
          <view class="flex items-center justify-between">
            <text :style="rowLabelStyle">{{ t.genesis.dailyDividendEst }}</text>
            <text class="tabular-nums" :style="rowValSuccessStyle">+${{ dividendText }}</text>
          </view>
          <view :style="dividerStyle" />
          <view class="flex items-center justify-between">
            <text :style="rowLabelStyle">{{ t.genesis.totalDue }}</text>
            <text class="tabular-nums" :style="rowValBoldStyle">${{ subtotalText }}</text>
          </view>
        </view>

        <!-- Submit -->
        <view class="w-full inline-flex items-center justify-center active:opacity-85" :style="submitStyle" @click="handlePurchase">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          <text>{{ t.genesis.confirmCta }}</text>
        </view>
        <text class="block text-center" :style="kycNoticeStyle">{{ t.genesis.kycNotice }}</text>
      </view>
    </transition>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { useGenesis } from "@/store/genesis";
import { toast } from "@/store/ui";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [boolean] }>();

const t = useT();
const app = useApp();
const bills = useBills();
const genesis = useGenesis();

const qty = ref(1);

const price = computed(() => genesis.unitPriceUSDT);
const remaining = computed(() => genesis.totalSlots - genesis.soldSlots);
// Q14 single source — same store-owned formula as /genesis + holder.
const dailyDividend = computed(() => genesis.currentDailyDividendPerNodeUSDT());

const subtitleText = computed(() => fmt(t.value.genesis.confirmSubtitle, { price: price.value.toLocaleString() }));
const subtotalText = computed(() => (qty.value * price.value).toLocaleString());
const dividendText = computed(() => (qty.value * dailyDividend.value).toFixed(2));

// Reset qty to 1 each time the sheet opens.
watch(
  () => props.open,
  (o) => {
    if (o) qty.value = 1;
  },
);

function dec() {
  qty.value = Math.max(1, qty.value - 1);
}
function inc() {
  qty.value = Math.min(remaining.value, qty.value + 1);
}
function emitClose() {
  emit("update:open", false);
}

function handlePurchase() {
  const cost = qty.value * price.value;
  if (!app.debitBalance(cost)) {
    toast.error(
      t.value.genesis.purchaseError,
      fmt(t.value.genesis.purchaseErrorSubtitle, {
        cost: cost.toLocaleString(),
        balance: app.user.usdtBalance.toFixed(2),
      }),
    );
    return;
  }
  // ⚠️ MOCK-ONLY CROSS-STORE MUTATION (NON-ATOMIC): debit + purchase + bill are
  // separate writes. PRODUCTION: POST /api/genesis/purchase (PRD §9.11e) is one
  // atomic transaction returning {balance, ownedTokenIds, billId}.
  const r = genesis.purchase(qty.value);
  if (r.ok) {
    bills.add({
      type: "purchase",
      symbol: "USDT",
      amount: -cost,
      status: "posted",
      memo: `Genesis primary · ${qty.value} slot${qty.value > 1 ? "s" : ""} @ $${price.value}`,
      ref: `GENESIS-PRIM-${Date.now().toString(36).toUpperCase()}`,
    });
    toast.success(
      fmt(t.value.genesis.purchaseSuccess, { n: qty.value, s: qty.value > 1 ? "s" : "" }),
      fmt(t.value.genesis.purchaseSubtitle, { amount: (qty.value * dailyDividend.value).toFixed(2) }),
    );
    emitClose();
  } else {
    toast.error(fmt(t.value.genesis.onlyNLeft, { n: remaining.value }), t.value.genesis.reduceQty);
  }
}

const panelStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderTop: "1px solid var(--v5-border)",
  padding: "18px 16px calc(env(safe-area-inset-bottom) + 38px)",
};
const titleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "20px",
  fontWeight: 600,
  letterSpacing: "-0.018em",
  color: "var(--v5-ink)",
  lineHeight: 1.2,
};
const subtitleStyle: CSSProperties = {
  marginTop: "4px",
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  color: "var(--v5-ink-3)",
};
const closeBtnStyle: CSSProperties = { width: "40px", height: "40px", borderRadius: "999px", color: "var(--v5-ink-3)" };
const stepperWrapStyle: CSSProperties = { background: "var(--v5-surface-2)", borderRadius: "16px", padding: "16px" };
const stepperLabelStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "12.5px",
  color: "var(--v5-ink-3)",
  fontWeight: 500,
};
const minusBtnStyle = computed<CSSProperties>(() => ({
  width: "44px",
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  color: qty.value <= 1 ? "var(--v5-ink-4)" : "var(--v5-ink)",
}));
const plusBtnStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  boxShadow: "var(--v5-spotlight-brand)",
  color: "var(--v5-on-brand)",
};
const qtyStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "48px",
  letterSpacing: "-0.034em",
  color: "var(--v5-ink)",
  lineHeight: 1,
};
const summaryStyle: CSSProperties = {
  marginTop: "12px",
  background: "var(--v5-surface-2)",
  borderRadius: "14px",
  padding: "16px",
  fontSize: "13.5px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};
const rowLabelStyle: CSSProperties = { color: "var(--v5-ink-3)" };
const rowLabelMutedStyle: CSSProperties = { color: "var(--v5-ink-4)" };
const rowValStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "13.5px",
  letterSpacing: "-0.005em",
  color: "var(--v5-ink)",
};
const rowValSuccessStyle: CSSProperties = { ...rowValStyle, color: "var(--v5-success)" };
const rowValBoldStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "18px",
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
};
const dividerStyle: CSSProperties = { height: "1px", background: "var(--v5-border)", margin: "0" };
const submitStyle: CSSProperties = {
  marginTop: "16px",
  height: "50px",
  padding: "0 28px",
  borderRadius: "999px",
  gap: "8px",
  background: "var(--v5-brand)",
  boxShadow: "var(--v5-spotlight-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "15px",
  letterSpacing: "-0.005em",
};
const kycNoticeStyle: CSSProperties = {
  marginTop: "12px",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.45,
};
</script>

<style scoped>
.nx-sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 79;
  background: rgba(8, 8, 12, 0.45);
  backdrop-filter: blur(8px);
}
.nx-sheet-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 80;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
}
.nx-sheet-fade-enter-active,
.nx-sheet-fade-leave-active {
  transition: opacity 0.24s cubic-bezier(0.32, 0.72, 0, 1);
}
.nx-sheet-fade-enter-from,
.nx-sheet-fade-leave-to {
  opacity: 0;
}
.nx-sheet-slide-enter-active {
  transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
}
.nx-sheet-slide-leave-active {
  transition: transform 0.24s cubic-bezier(0.32, 0.72, 0, 1);
}
.nx-sheet-slide-enter-from,
.nx-sheet-slide-leave-to {
  transform: translateY(100%);
}
</style>
