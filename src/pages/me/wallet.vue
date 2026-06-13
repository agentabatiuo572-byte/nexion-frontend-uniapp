<!--
  Wallet — ported from Nexion-prototype/app/(main)/me/wallet/page.tsx.
  iOS-Wallet pattern, top→bottom: balance hero (USDT 48px + NEX link + 3 quick
  actions) → Earnings list (Today / Pending / All-time) → Activity list (Daily
  check-in / Transaction history / Bank cards / conditional in-flight withdrawal)
  → NEX boost footer callout.

  Reads useApp (user/earnings/latestWithdrawal) + useCommission (team lifetime).
  IOSList/IOSListItem (source components) are inlined as a local list primitive.
  Wrapped in <AppChassis active="me"> with an in-page back/title row (chassis
  header is a fixed brand row, like detail.vue/checkout.vue). The "Bank cards"
  count is a static placeholder (cards store not ported — see PORT report §7).
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink)">
      <!-- In-page header: back + title -->
      <view class="flex items-center" :style="headerStyle">
        <view class="grid place-items-center active:opacity-60" :style="backBtnStyle" @click="goBack">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </view>
        <view class="min-w-0 flex-1">
          <text class="block truncate" :style="headerTitleStyle">{{ t.wallet.title }}</text>
        </view>
      </view>

      <!-- Balance hero -->
      <view class="relative overflow-hidden" :style="heroStyle">
        <text class="block" :style="heroLabelStyle">USDT Balance</text>
        <text class="block tabular-nums" :style="heroNumStyle">${{ usdt.toFixed(2) }}</text>
        <view class="inline-flex items-center" style="margin-top: 8px; gap: 6px" @click="goNex">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="m16.71 13.88.7.71-2.82 2.82" /></svg>
          <text style="font-size: 13.5px; color: var(--v5-ink-3)">{{ nexLabel }} NEX</text>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </view>

        <view class="grid grid-cols-3" style="margin-top: 20px; gap: 8px">
          <view class="flex flex-col items-center active:opacity-70" style="gap: 6px" @click="goTopup">
            <view class="grid place-items-center" :style="actionIconStyle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17V3" /><path d="m6 11 6 6 6-6" /><path d="M19 21H5" /></svg>
            </view>
            <text :style="actionLabelStyle">{{ t.wallet.topUp }}</text>
          </view>
          <view class="flex flex-col items-center active:opacity-70" style="gap: 6px" @click="goWithdraw">
            <view class="grid place-items-center" :style="actionIconStyle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v14" /><path d="m6 9 6-6 6 6" /><path d="M19 21H5" /></svg>
            </view>
            <text :style="actionLabelStyle">{{ t.wallet.withdraw }}</text>
          </view>
          <view class="flex flex-col items-center active:opacity-70" style="gap: 6px" @click="goExchange">
            <view class="grid place-items-center" :style="actionIconStyle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>
            </view>
            <text :style="actionLabelStyle">{{ t.wallet.exchange }}</text>
          </view>
        </view>
      </view>

      <!-- Earnings list -->
      <text class="block" :style="listTitleStyle">{{ t.wallet.earningsSection }}</text>
      <view :style="listCardStyle">
        <WalletListRow icon-bg="var(--v5-success-soft)" :first="true" :label="t.wallet.todayLabel">
          <template #icon><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--v5-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></svg></template>
          <template #value><text class="tabular-nums" style="font-family: var(--font-v5); font-size: 15px; color: var(--v5-brand)">+${{ pending.toFixed(2) }}</text></template>
        </WalletListRow>
        <WalletListRow icon-bg="var(--v5-warning-soft)" :label="t.wallet.pending">
          <template #icon><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" /><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" /></svg></template>
          <template #value><text class="tabular-nums" style="font-family: var(--font-v5); font-size: 15px; color: var(--v5-ink)">${{ pending.toFixed(2) }}</text></template>
        </WalletListRow>
        <WalletListRow icon-bg="var(--v5-tech-cyan-soft)" :label="t.wallet.allTimeEarnings" :sublabel="allTimeSublabel">
          <template #icon><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" /><path d="M3 10h18" /></svg></template>
          <template #value><text class="tabular-nums" style="font-family: var(--font-v5); font-size: 15px; color: var(--v5-ink)">${{ allTimeEarned.toFixed(2) }}</text></template>
        </WalletListRow>
      </view>

      <!-- Activity list -->
      <text class="block" :style="listTitleStyle">{{ t.wallet.activitySection }}</text>
      <view :style="listCardStyle">
        <WalletListRow icon-bg="var(--v5-brand-2-soft)" :first="true" :label="t.wallet.dailyCheckin" :sublabel="t.wallet.dailyCheckinSub" chevron href="/pages/daily/daily">
          <template #icon><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg></template>
        </WalletListRow>
        <WalletListRow icon-bg="color-mix(in srgb, var(--v5-tech-cyan) 22%, transparent)" :label="t.wallet.transactionHistory" :sublabel="t.wallet.allCreditsDebits" chevron href="/pages/me/wallet-bills">
          <template #icon><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 17.5v-11" /></svg></template>
        </WalletListRow>
        <WalletListRow icon-bg="var(--v5-warning-soft)" label="My bank cards" :sublabel="cardsSub" chevron href="/pages/me/wallet-cards">
          <template #icon><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></svg></template>
        </WalletListRow>
        <WalletListRow v-if="showWithdrawal" icon-bg="color-mix(in srgb, var(--v5-warning) 22%, transparent)" :label="withdrawalRowLabel" :sublabel="withdrawalRowSub" chevron href="/pages/me/wallet-withdraw-tracking">
          <template #icon><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v14" /><path d="m6 9 6-6 6 6" /><path d="M19 21H5" /></svg></template>
          <template #value><text class="tabular-nums" style="font-family: var(--font-v5); font-size: 15px; color: var(--v5-danger)">-${{ latestWithdrawal!.amount.toFixed(2) }}</text></template>
        </WalletListRow>
      </view>

      <!-- NEX boost footer callout -->
      <view :style="nexCalloutStyle">
        <text class="block" :style="nexCalloutLabelStyle">NEX Boost Active</text>
        <view :style="nexCalloutBodyStyle">
          <text>Your {{ nexLabel }} NEX unlocks </text>
          <text style="color: var(--v5-brand); font-weight: 600">+10% earnings</text>
          <text>. Reach 5,000 NEX for fee discount.</text>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import WalletListRow from "@/components/me/wallet-list-row.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { useCommission } from "@/store/commission";
import { useCards } from "@/store/cards";

const t = useT();
const app = useApp();
const commission = useCommission();
const cards = useCards();

const usdt = computed(() => app.user.usdtBalance);
const nexLabel = computed(() => app.user.nexBalance.toLocaleString());
const pending = computed(() => app.user.pendingEarnings);
const teamLifetimeUSD = computed(() => commission.totalUSDTLifetime());
const allTimeEarned = computed(() => app.earnings.total + teamLifetimeUSD.value);
const allTimeSublabel = computed(() =>
  fmt(t.value.wallet.allTimeSublabel, {
    c: app.earnings.total.toFixed(2),
    tm: teamLifetimeUSD.value.toFixed(2),
  }),
);
// Bank cards: dynamic count from cards store (mirrors prototype `${n} 张已绑定`
// vs reuse hint). Label + these sub-strings are hardcoded in the prototype too
// (no i18n key) — see PORT report for the missing wallet.myBankCards keys.
const cardsCount = computed(() => cards.cards.length);
const cardsSub = computed(() =>
  cardsCount.value > 0
    ? `${cardsCount.value} cards bound`
    : "Reused at checkout, no re-entry",
);

const latestWithdrawal = computed(() => app.latestWithdrawal);
const showWithdrawal = computed(
  () => !!latestWithdrawal.value && latestWithdrawal.value.status !== "confirmed",
);
const withdrawalRowLabel = computed(() =>
  latestWithdrawal.value ? fmt(t.value.wallet.withdrawalRow, { network: latestWithdrawal.value.network }) : "",
);
const withdrawalRowSub = computed(() => {
  const w = latestWithdrawal.value;
  if (!w) return "";
  return `${statusLabel(w.status)} · ${fmtTime(w.submittedAt)}`;
});

function statusLabel(s: string): string {
  return s.replace(/-/g, " ");
}
function fmtTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function goBack() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: "/pages/me/me", fail: () => {} }) });
}
function goNex() {
  uni.navigateTo({ url: "/pages/me/wallet-nex", fail: () => {} });
}
function goTopup() {
  uni.navigateTo({ url: "/pages/me/wallet-topup", fail: () => {} });
}
function goWithdraw() {
  uni.navigateTo({ url: "/pages/me/wallet-withdraw", fail: () => {} });
}
function goExchange() {
  uni.navigateTo({ url: "/pages/me/wallet-exchange", fail: () => {} });
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
const heroStyle: CSSProperties = {
  margin: "0 16px 20px",
  borderRadius: "12px",
  background: "color-mix(in srgb, var(--v5-surface-2) 85%, transparent)",
  backgroundImage: "var(--v5-ambient-overlay-brand)",
  backdropFilter: "blur(12px)",
  boxShadow: "var(--v5-card-shadow-lift-strong)",
  padding: "20px",
};
const heroLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
const heroNumStyle: CSSProperties = {
  marginTop: "6px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "48px",
  letterSpacing: "-0.034em",
  color: "var(--v5-ink)",
  lineHeight: 1,
};
const actionIconStyle: CSSProperties = {
  width: "48px",
  height: "48px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
};
const actionLabelStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--v5-ink-2)",
};
const listTitleStyle: CSSProperties = {
  margin: "0 32px 6px",
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--v5-ink-3)",
};
const listCardStyle: CSSProperties = {
  margin: "0 16px 20px",
  background: "color-mix(in srgb, var(--v5-surface) 85%, transparent)",
  backdropFilter: "blur(12px)",
  borderRadius: "12px",
  overflow: "hidden",
};
const nexCalloutStyle: CSSProperties = {
  margin: "0 16px 20px",
  padding: "12px 16px",
  borderRadius: "12px",
  background: "var(--v5-brand-2-soft)",
};
const nexCalloutLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-brand-2)",
  letterSpacing: "0.06em",
};
const nexCalloutBodyStyle: CSSProperties = {
  marginTop: "4px",
  fontSize: "13.5px",
  color: "var(--v5-ink-2)",
  lineHeight: 1.45,
};
</script>
