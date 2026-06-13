<!--
  Wallet Exchange — ported from Nexion-prototype/app/(main)/me/wallet/exchange/page.tsx.
  NEX↔USDT swap: pay/receive cards with live-jittered rate + flip, free network
  fee, plus the v3 risk-control dashboard (per-user $50/day cap, platform
  $20K/day pool, KYC trigger at $100 lifetime, queue). Confirm flow gates via
  useExchangeV3.canExchange → debit/credit app balances, recordSwap, write two
  bills (debit + credit), commit v3 counters.

  Ports the basic exchange store + the v3 risk store (both new — exchange.ts /
  exchange-v3.ts). Reuses app (credit/debit USDT+NEX), bills, wallet-pairing.
  useScrollGrowProgress + IntersectionObserver ($el) is dropped (P-018 precedent)
  — cap bars render at their final width directly. window.location.href → uni
  navigateTo. SSR mounted-guard dropped. Intervals cleaned in onUnmounted
  (page-level component, P-021). Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/wallet" :title="t.exchange.title" />

      <!-- How-it-works entry + refresh -->
      <view class="flex items-center" :style="topRowStyle">
        <view class="inline-flex items-center active:scale-[0.98]" :style="howStyle" @click="goHowItWorks">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>
          <text style="margin: 0 4px">{{ t.exchange.howItWorksEntry }}</text>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </view>
        <view class="grid place-items-center active:opacity-70" :style="refreshBtnStyle" @click="onRefresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
        </view>
      </view>

      <!-- Pay card -->
      <view :style="swapCardStyle">
        <text class="block" :style="cardLabelStyle">{{ t.exchange.pay }}</text>
        <view class="flex items-baseline" style="margin-top: 6px; gap: 4px">
          <input
            class="flex-1 min-w-0 tabular-nums"
            :style="amountInputStyle"
            type="text"
            inputmode="decimal"
            :value="input"
            placeholder="0"
            @input="onInput"
          />
          <text class="shrink-0" style="font-size: 14px; color: var(--v5-ink-3)">{{ fromSym }}</text>
        </view>
        <view class="flex items-center justify-between" style="margin-top: 6px">
          <text style="font-size: 11.5px; color: var(--v5-ink-4)">{{ minLabel }}</text>
          <view class="inline-flex items-center active:opacity-70" :style="maxBtnStyle" @click="setMax">
            <text style="color: var(--v5-brand)">{{ fromSym }} </text>
            <text class="tabular-nums" style="color: var(--v5-brand)">{{ fromBalLabel }}</text>
            <text style="color: var(--v5-brand)"> · MAX</text>
          </view>
        </view>
      </view>

      <!-- Flip -->
      <view class="flex justify-center" style="margin: 8px 0">
        <view class="grid place-items-center active:opacity-80" :style="flipBtnStyle" @click="flip">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" /></svg>
        </view>
      </view>

      <!-- Receive card -->
      <view :style="swapCardStyle">
        <text class="block" :style="cardLabelStyle">{{ t.exchange.receive }}</text>
        <view class="flex items-baseline" style="margin-top: 6px; gap: 4px">
          <text class="flex-1 min-w-0 tabular-nums truncate" :style="receiveValueStyle">{{ toAmountLabel }}</text>
          <text class="shrink-0" style="font-size: 14px; color: var(--v5-ink-3)">{{ toSym }}</text>
        </view>
        <view class="flex items-center justify-between" style="margin-top: 6px">
          <text style="font-size: 11.5px; color: var(--v5-ink-4)">{{ rateLabel }}</text>
          <text class="tabular-nums" style="font-size: 11.5px; color: var(--v5-ink-4)">{{ updatedLabel }}</text>
        </view>
      </view>

      <!-- Fee -->
      <view class="flex items-center justify-between" :style="feeRowStyle">
        <text style="font-size: 11.5px; color: var(--v5-ink-3)">{{ t.exchange.feeLabel }}</text>
        <text style="font-size: 11.5px; color: var(--v5-brand)">{{ t.exchange.feeFree }}</text>
      </view>

      <!-- Error -->
      <view v-if="overBalance || underMin" :style="errorStyle">
        <text>{{ errorLabel }}</text>
      </view>

      <!-- Confirm CTA -->
      <view style="margin: 16px 16px 0">
        <view class="grid place-items-center" :class="{ 'active:opacity-90': valid }" :style="confirmStyle" @click="handleConfirm">
          <text :style="confirmTextStyle">{{ t.exchange.confirm }}</text>
        </view>
      </view>

      <!-- NEX info -->
      <view class="flex items-start" :style="infoStyle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 2px; flex-shrink: 0"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
        <text style="margin-left: 8px">{{ t.exchange.nexInfo }}</text>
      </view>

      <!-- v3 risk-control dashboard -->
      <view :style="dashStyle">
        <view class="flex items-center justify-between" style="margin-bottom: 12px">
          <text :style="dashTitleStyle">{{ t.exchange.capsLabel }}</text>
          <text class="font-mono-tabular" style="font-size: 10px; color: var(--v5-ink-3)">{{ t.exchange.capsReset }}</text>
        </view>

        <!-- Per-user cap -->
        <view style="margin-bottom: 12px">
          <view class="flex items-center justify-between" style="margin-bottom: 4px">
            <text style="font-size: 11.5px; color: var(--v5-ink-2)">{{ t.exchange.yourDaily }}</text>
            <view class="font-mono-tabular tabular-nums" style="font-size: 11.5px; color: var(--v5-ink)">
              <text>${{ v3.todayUserUsedUSD.toFixed(2) }} </text>
              <text style="color: var(--v5-ink-3)">/ ${{ USER_DAILY_CAP_USD }}</text>
            </view>
          </view>
          <view :style="barTrackStyle">
            <view :style="userBarStyle" />
          </view>
        </view>

        <!-- Platform cap -->
        <view style="margin-bottom: 12px">
          <view class="flex items-center justify-between" style="margin-bottom: 4px">
            <text style="font-size: 11.5px; color: var(--v5-ink-2)">{{ t.walletV3.exchangePoolToday }}</text>
            <view class="font-mono-tabular tabular-nums" style="font-size: 11.5px; color: var(--v5-ink)">
              <text>${{ (v3.todayPlatformUsedUSD / 1000).toFixed(1) }}K </text>
              <text style="color: var(--v5-ink-3)">/ ${{ (PLATFORM_DAILY_CAP_USD / 1000).toFixed(0) }}K</text>
            </view>
          </view>
          <view :style="barTrackStyle">
            <view :style="platformBarStyle" />
          </view>
        </view>

        <!-- KYC status -->
        <view class="flex items-center" :style="kycRowStyle">
          <template v-if="v3.kycVerified">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
            <text style="margin-left: 8px; font-size: 11px; color: var(--v5-success); font-weight: 500">{{ t.exchange.kycVerified }}</text>
          </template>
          <template v-else>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
            <text style="margin-left: 8px; font-size: 11px; color: var(--v5-warning)">{{ kycUnverifiedLabel }}</text>
          </template>
          <text class="font-mono-tabular" style="margin-left: auto; font-size: 10px; color: var(--v5-ink-3)">{{ lifetimeLabel }}</text>
        </view>

        <!-- Queue -->
        <view v-if="v3.queue.length > 0" :style="queueWrapStyle">
          <view class="flex items-center" :style="queueTitleStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            <text style="margin-left: 6px">{{ queuedLabel }}</text>
          </view>
          <view v-for="q in v3.queue.slice(0, 3)" :key="q.id" class="flex items-center justify-between" style="padding: 4px 0">
            <text class="font-mono-tabular" style="font-size: 11px; color: var(--v5-ink-3)">{{ q.id }} · {{ q.direction === "nex2usdt" ? "NEX → USDT" : "USDT → NEX" }}</text>
            <text class="font-mono-tabular tabular-nums" style="font-size: 11px; color: var(--v5-ink)">${{ q.amountUSD.toFixed(2) }}</text>
          </view>
        </view>
      </view>

      <!-- History -->
      <view style="margin: 20px 16px 24px">
        <text class="block" :style="historyTitleStyle">{{ t.exchange.historyTitle }}</text>
        <view v-if="history.length === 0" :style="historyEmptyStyle">
          <text>{{ t.exchange.historyEmpty }}</text>
        </view>
        <view v-else :style="historyListStyle">
          <view v-for="(h, i) in history.slice(0, 6)" :key="h.id" class="flex items-center" :style="historyRowStyle(i)">
            <view class="grid place-items-center shrink-0" :style="historyIconStyle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <text class="block tabular-nums" :style="historyMainStyle">{{ swapLine(h) }}</text>
              <text class="block" :style="historySubStyle">@ {{ h.rate.toFixed(5) }} · {{ new Date(h.ts).toLocaleString() }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { toast, confirm } from "@/store/ui";
import { useApp } from "@/store/app";
import { useBills } from "@/store/bills";
import { useExchange, type SwapEvent } from "@/store/exchange";
import { useWalletPairing } from "@/store/wallet-pairing";
import {
  useExchangeV3,
  USER_DAILY_CAP_USD,
  PLATFORM_DAILY_CAP_USD,
  KYC_LIFETIME_THRESHOLD_USD,
  dailyUserPctUsed,
  dailyPlatformPctUsed,
} from "@/store/exchange-v3";

const t = useT();
const app = useApp();
const billsStore = useBills();
const exchange = useExchange();
const walletPairing = useWalletPairing();
const v3 = useExchangeV3();

const history = computed(() => exchange.history);
const rate = computed(() => exchange.rate);

const direction = ref<"usdt2nex" | "nex2usdt">("nex2usdt");
const input = ref("");
const secsAgo = ref(0);

// Sync v3 KYC mirror to wallet-pairing on mount (+ roll daily counters).
onMounted(() => {
  v3.resetIfNewDay();
  v3.setKycVerified(walletPairing.walletPaired);
});

// Periodic rate refresh (15s) + "n seconds ago" ticker (500ms). Page-level
// component → clean up in onUnmounted (P-021).
let rateTimer: ReturnType<typeof setInterval> | null = null;
let agoTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  rateTimer = setInterval(() => exchange.refreshRate(), 15000);
  agoTimer = setInterval(() => {
    secsAgo.value = Math.floor((Date.now() - exchange.rateUpdatedAt) / 1000);
  }, 500);
});
onUnmounted(() => {
  if (rateTimer) clearInterval(rateTimer);
  if (agoTimer) clearInterval(agoTimer);
});

const fromSym = computed(() => (direction.value === "usdt2nex" ? "USDT" : "NEX"));
const toSym = computed(() => (direction.value === "usdt2nex" ? "NEX" : "USDT"));
const fromBal = computed(() => (direction.value === "usdt2nex" ? app.user.usdtBalance : app.user.nexBalance));
const minFrom = computed(() => (direction.value === "usdt2nex" ? 1 : 10));

const fromAmount = computed(() => {
  const n = parseFloat(input.value || "0");
  return isNaN(n) ? 0 : n;
});
const toAmount = computed(() => {
  if (fromAmount.value === 0) return 0;
  if (direction.value === "usdt2nex") return +(fromAmount.value / rate.value).toFixed(2);
  return +(fromAmount.value * rate.value).toFixed(4);
});
const overBalance = computed(() => fromAmount.value > fromBal.value);
const underMin = computed(() => fromAmount.value > 0 && fromAmount.value < minFrom.value);
const valid = computed(() => fromAmount.value > 0 && !overBalance.value && !underMin.value);
// USD value of this swap = the leg denominated in USDT
const swapUSDValue = computed(() => (direction.value === "usdt2nex" ? fromAmount.value : toAmount.value));

// uni input event → e.detail.value (typed Event; mirrors topup-card-form).
function detailVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onInput(e: Event) {
  input.value = detailVal(e).replace(/[^0-9.]/g, "");
}
function setMax() {
  input.value = String(fromBal.value);
}
function flip() {
  direction.value = direction.value === "usdt2nex" ? "nex2usdt" : "usdt2nex";
  input.value = "";
}

function onRefresh() {
  exchange.refreshRate();
  toast.info(t.value.exchange.quoteRefreshing);
}
function goHowItWorks() {
  uni.navigateTo({ url: "/pages/me/wallet-exchange-how", fail: () => {} });
}

async function handleConfirm() {
  if (!valid.value) return;

  // v3 gate: cap / KYC / queue
  const gate = v3.canExchange(swapUSDValue.value);
  if (!gate.ok) {
    if (gate.reason === "kyc-required") {
      const goKyc = await confirm({
        title: t.value.exchange.kycRequiredTitle,
        message: fmt(t.value.exchange.kycRequiredMessage, {
          lifetime: gate.lifetime.toFixed(2),
          threshold: String(gate.threshold),
        }),
        icon: "info",
        confirmLabel: t.value.exchange.kycRequiredConfirm,
      });
      if (goKyc) {
        // Reuse the KYC-Express flow on wallet-topup (?kyc=1)
        uni.navigateTo({ url: "/pages/me/wallet-topup?kyc=1", fail: () => {} });
      }
      return;
    }
    if (gate.reason === "user-cap") {
      const queueIt = await confirm({
        title: t.value.exchange.capReachedTitle,
        message: fmt(t.value.exchange.capReachedMessage, {
          used: gate.usedToday.toFixed(2),
          cap: String(gate.cap),
          amount: swapUSDValue.value.toFixed(2),
        }),
        icon: "warn",
        confirmLabel: t.value.exchange.capReachedConfirm,
      });
      if (queueIt) {
        v3.enqueue({ amountUSD: swapUSDValue.value, direction: direction.value });
        toast.info(
          t.value.exchange.queuedToastTitle,
          fmt(t.value.exchange.queuedToastBody, { amount: swapUSDValue.value.toFixed(2) }),
        );
      }
      return;
    }
    if (gate.reason === "platform-cap") {
      toast.error(
        t.value.exchange.platformExhaustedTitle,
        fmt(t.value.exchange.platformExhaustedBody, { cap: (gate.cap / 1000).toFixed(0) }),
      );
      return;
    }
  }

  const ok = await confirm({
    title: t.value.exchange.confirm,
    message: `${fromSym.value} ${fromAmount.value.toFixed(fromSym.value === "USDT" ? 2 : 0)} → ${toSym.value} ${toAmount.value.toFixed(toSym.value === "USDT" ? 4 : 0)}`,
    icon: "info",
    confirmLabel: t.value.exchange.confirm,
  });
  if (!ok) return;

  toast.info(t.value.exchange.confirmingToast);
  setTimeout(() => {
    const succ = direction.value === "usdt2nex" ? app.debitBalance(fromAmount.value) : app.debitNex(fromAmount.value);
    if (!succ) {
      toast.error(
        t.value.exchange.insufficientTitle,
        t.value.exchange.insufficientMessage.replace("{sym}", fromSym.value),
      );
      return;
    }
    if (direction.value === "usdt2nex") app.creditNex(toAmount.value);
    else app.creditBalance(toAmount.value);

    const evt = exchange.recordSwap({
      fromSym: fromSym.value,
      toSym: toSym.value,
      fromAmount: fromAmount.value,
      toAmount: toAmount.value,
      rate: rate.value,
    });

    // Bills: debit + credit
    billsStore.add({
      type: "swap",
      amount: -fromAmount.value,
      symbol: fromSym.value,
      status: "posted",
      memo: `Swap ${fromSym.value} → ${toSym.value}`,
      ref: evt.id,
    });
    billsStore.add({
      type: "swap",
      amount: toAmount.value,
      symbol: toSym.value,
      status: "posted",
      memo: `Swap ${fromSym.value} → ${toSym.value}`,
      ref: evt.id,
    });

    // Commit to v3 daily counters + lifetime
    v3.record(swapUSDValue.value);

    toast.success(
      t.value.exchange.swapped,
      t.value.exchange.swappedDetail
        .replace("{from}", fromSym.value)
        .replace("{fromAmt}", String(fromAmount.value))
        .replace("{to}", toSym.value)
        .replace("{toAmt}", String(toAmount.value)),
    );
    input.value = "";
  }, 900);
}

// ── derived labels ──
const minLabel = computed(() => t.value.exchange.minAmount.replace("{n}", String(minFrom.value)).replace("{sym}", fromSym.value));
const fromBalLabel = computed(() => (fromSym.value === "USDT" ? fromBal.value.toFixed(2) : fromBal.value.toLocaleString()));
const toAmountLabel = computed(() =>
  toAmount.value.toLocaleString(undefined, { maximumFractionDigits: toSym.value === "USDT" ? 4 : 0 }),
);
const rateLabel = computed(() => t.value.exchange.rate.replace("{rate}", rate.value.toFixed(5)));
const updatedLabel = computed(() => t.value.exchange.rateLastUpdated.replace("{n}", String(secsAgo.value)));
const errorLabel = computed(() =>
  overBalance.value
    ? t.value.exchange.insufficientMessage.replace("{sym}", fromSym.value)
    : t.value.exchange.minAmount.replace("{n}", String(minFrom.value)).replace("{sym}", fromSym.value),
);
const kycUnverifiedLabel = computed(() => fmt(t.value.exchange.kycUnverified, { n: String(KYC_LIFETIME_THRESHOLD_USD) }));
const lifetimeLabel = computed(() => fmt(t.value.exchange.lifetimeLabel, { n: v3.lifetimeExchangedUSD.toFixed(2) }));
const queuedLabel = computed(() => fmt(t.value.exchange.queuedLabel, { n: String(v3.queue.length) }));
function swapLine(h: SwapEvent): string {
  return `${h.fromAmount.toFixed(h.fromSym === "USDT" ? 2 : 0)} ${h.fromSym} → ${h.toAmount.toFixed(h.toSym === "USDT" ? 4 : 0)} ${h.toSym}`;
}

// ── styles ──
const topRowStyle: CSSProperties = { padding: "0 16px 8px", gap: "8px" };
const howStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 14px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-brand-2) 10%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-brand-2) 35%, transparent)",
  fontSize: "12px",
  color: "var(--v5-brand-2)",
};
const refreshBtnStyle: CSSProperties = {
  marginLeft: "auto",
  width: "44px",
  height: "44px",
  borderRadius: "999px",
  background: "var(--v5-surface)",
};
const swapCardStyle: CSSProperties = {
  margin: "0 16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  padding: "16px",
};
const cardLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.06em",
  color: "var(--v5-ink-3)",
};
const amountInputStyle: CSSProperties = {
  background: "transparent",
  fontFamily: "var(--font-v5)",
  fontSize: "28px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const receiveValueStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "28px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const maxBtnStyle: CSSProperties = {
  minHeight: "44px",
  margin: "-12px -8px -12px 0",
  padding: "0 10px",
  borderRadius: "6px",
  fontSize: "11.5px",
};
const flipBtnStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-brand) 15%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-brand) 30%, transparent)",
};
const feeRowStyle: CSSProperties = { margin: "8px 16px 0" };
const errorStyle: CSSProperties = {
  margin: "12px 16px 0",
  padding: "8px 12px",
  borderRadius: "8px",
  background: "color-mix(in srgb, var(--v5-brand-2) 10%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-brand-2) 30%, transparent)",
  fontSize: "11.5px",
  color: "var(--v5-brand-2)",
};
const confirmStyle = computed<CSSProperties>(() => ({
  height: "44px",
  borderRadius: "12px",
  background: valid.value ? "var(--v5-brand)" : "var(--v5-surface-2)",
}));
const confirmTextStyle = computed<CSSProperties>(() => ({
  fontSize: "13.5px",
  fontWeight: 600,
  color: valid.value ? "var(--v5-on-brand)" : "var(--v5-ink-4)",
}));
const infoStyle: CSSProperties = {
  margin: "16px 16px 0",
  padding: "10px 12px",
  borderRadius: "12px",
  background: "color-mix(in srgb, var(--v5-brand-2) 8%, transparent)",
  border: "1px solid color-mix(in srgb, var(--v5-brand-2) 20%, transparent)",
  fontSize: "11.5px",
  color: "color-mix(in srgb, var(--v5-brand-2) 90%, transparent)",
  lineHeight: 1.6,
};
const dashStyle: CSSProperties = {
  margin: "12px 16px 0",
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  padding: "16px",
};
const dashTitleStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.06em",
  color: "var(--v5-ink-3)",
};
const barTrackStyle: CSSProperties = {
  height: "6px",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
  overflow: "hidden",
};
const userBarStyle = computed<CSSProperties>(() => {
  const pct = dailyUserPctUsed(v3.todayUserUsedUSD);
  return {
    height: "100%",
    width: `${pct * 100}%`,
    borderRadius: "999px",
    background: pct >= 0.85 ? "var(--v5-brand-2)" : "var(--v5-brand)",
    transition: "width 600ms cubic-bezier(0.16,1,0.3,1)",
  };
});
const platformBarStyle = computed<CSSProperties>(() => ({
  height: "100%",
  width: `${dailyPlatformPctUsed(v3.todayPlatformUsedUSD) * 100}%`,
  borderRadius: "999px",
  background: "var(--v5-brand-2)",
  transition: "width 600ms cubic-bezier(0.16,1,0.3,1)",
}));
const kycRowStyle: CSSProperties = {
  paddingTop: "10px",
  borderTop: "1px solid var(--v5-border)",
};
const queueWrapStyle: CSSProperties = {
  marginTop: "12px",
  paddingTop: "12px",
  borderTop: "1px solid var(--v5-border)",
};
const queueTitleStyle: CSSProperties = {
  marginBottom: "6px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.06em",
  color: "var(--v5-warning)",
};
const historyTitleStyle: CSSProperties = {
  padding: "12px 8px 4px",
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--v5-ink-3)",
};
const historyEmptyStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px dashed var(--v5-border)",
  borderRadius: "16px",
  padding: "24px",
  textAlign: "center",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const historyListStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
  overflow: "hidden",
};
function historyRowStyle(i: number): CSSProperties {
  return {
    gap: "12px",
    padding: "12px 16px",
    borderTop: i !== 0 ? "1px solid color-mix(in srgb, var(--v5-border) 70%, transparent)" : "none",
  };
}
const historyIconStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "8px",
  background: "color-mix(in srgb, var(--v5-brand) 10%, transparent)",
};
const historyMainStyle: CSSProperties = {
  fontSize: "12.5px",
  fontWeight: 500,
  color: "color-mix(in srgb, var(--v5-ink) 90%, transparent)",
};
const historySubStyle: CSSProperties = { marginTop: "2px", fontSize: "11px", color: "var(--v5-ink-4)" };
</script>
