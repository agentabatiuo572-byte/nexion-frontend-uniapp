<!--
  Orders list — ported from Nexion-prototype/app/(main)/store/orders/page.tsx.
  Order list from the orders store: empty state (browse-store CTA) or a list of
  status-badged cards, each navigating to order-detail (?id=). Wrapped in
  <AppChassis active="store"> with an in-page back/title row (matches detail.vue).
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
          <text class="block truncate" :style="headerTitleStyle">{{ t.orders.title }}</text>
        </view>
      </view>

      <!-- Empty state -->
      <view v-if="orderList.length === 0" class="mx-4 rounded-2xl text-center active:opacity-95" :style="emptyCardStyle" role="button" tabindex="0" :aria-label="t.orders.browseStore" @tap.stop="goStore" @click.stop="goStore">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto"><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
        <text class="block" style="font-size: 13.5px; color: var(--v5-ink-2); margin-top: 12px">{{ t.orders.empty }}</text>
        <text class="block" style="font-size: 11.5px; color: var(--v5-ink-3); margin-top: 6px; line-height: 1.5">{{ t.orders.emptyHint }}</text>
        <view class="inline-flex items-center justify-center active:opacity-85" :style="browseBtnStyle" @tap.stop="goStore" @click.stop="goStore">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
          <text @tap.stop="goStore" @click.stop="goStore">{{ t.orders.browseStore }}</text>
        </view>
      </view>

      <!-- Order list -->
      <view v-else class="mx-4" style="padding-bottom: 16px">
        <view
          v-for="o in orderList"
          :key="o.id"
          class="block rounded-2xl border active:opacity-90"
          :style="orderCardStyle"
          role="button"
          tabindex="0"
          :aria-label="`${o.productName} ${o.id}`"
          @tap.stop="goDetail(o.id)"
          @click.stop="goDetail(o.id)"
        >
          <view class="flex items-start" style="gap: 12px">
            <view class="grid place-items-center shrink-0" :style="iconBoxStyle(o.status)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" :stroke="badge(o.status).color" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, di) in badge(o.status).icon" :key="di" :d="d" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <view class="flex items-center justify-between" style="gap: 8px">
                <text class="truncate" style="font-size: 13.5px; font-weight: 600; color: var(--v5-ink)">{{ o.productName }}</text>
                <text class="shrink-0" :style="statusChipStyle(o.status)">{{ badge(o.status).label }}</text>
              </view>
              <text class="block truncate" style="font-size: 11.5px; color: var(--v5-ink-3); margin-top: 4px">{{ t.orders.orderId }} <text class="font-mono">{{ o.id }}</text></text>
              <view class="flex items-center justify-between" style="margin-top: 6px">
                <text style="font-size: 11px; color: var(--v5-ink-4)">{{ dateText(o.placedAt) }}</text>
                <text class="tabular-nums" style="font-family: var(--font-v5); font-size: 13.5px; font-weight: 600; color: var(--v5-ink)">${{ o.total.toLocaleString() }}</text>
              </view>
            </view>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" style="margin-top: 8px"><path d="m9 18 6-6-6-6" /></svg>
          </view>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import { useT } from "@/i18n/use-t";
import { useOrders, type OrderStatus } from "@/store/orders";
import { navTo } from "@/lib/route";

const t = useT();
const orders = useOrders();
const orderList = computed(() => orders.orders);

// lucide outline paths per status (Clock / CheckCircle2 / Server / Cpu / XCircle)
interface Badge {
  label: string;
  color: string;
  bg: string;
  icon: string[];
}
function badge(status: OrderStatus): Badge {
  switch (status) {
    case "placed":
      return { label: t.value.orders.statusPlaced, color: "var(--v5-ink-3)", bg: "var(--v5-surface-2)", icon: ["M12 6v6l4 2", "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"] };
    case "paid":
      return { label: t.value.orders.statusPaid, color: "var(--v5-brand)", bg: "var(--v5-brand-soft)", icon: ["M22 11.08V12a10 10 0 1 1-5.93-9.14", "m9 11 3 3L22 4"] };
    case "provisioning":
      return { label: t.value.orders.statusProvisioning, color: "var(--v5-warning)", bg: "var(--v5-warning-soft)", icon: ["M5 2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z", "M5 14h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z", "M6 6h.01", "M6 18h.01"] };
    case "activated":
      return { label: t.value.orders.statusActivated, color: "var(--v5-brand)", bg: "var(--v5-brand-soft)", icon: ["M12 20v2", "M12 2v2", "M17 20v2", "M17 2v2", "M2 12h2", "M2 17h2", "M2 7h2", "M20 12h2", "M20 17h2", "M20 7h2", "M7 20v2", "M7 2v2", "M4 8h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z", "M8 12h8"] };
    case "cancelled":
      return { label: t.value.orders.cancelStatus, color: "var(--v5-brand-2)", bg: "var(--v5-brand-2-soft)", icon: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "m15 9-6 6", "m9 9 6 6"] };
  }
}

function dateText(ts: number): string {
  return new Date(ts).toLocaleDateString();
}

function goBack() {
  navTo("/store");
}
function goStore() {
  navTo("/store");
}
function goDetail(id: string) {
  navTo(`/pages/store/order-detail?id=${id}`);
}

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
const emptyCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  border: "1px dashed var(--v5-border)",
  padding: "32px",
};
const browseBtnStyle: CSSProperties = {
  marginTop: "16px",
  height: "48px",
  padding: "0 20px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 600,
};
const orderCardStyle: CSSProperties = {
  marginBottom: "10px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  padding: "16px",
};
function iconBoxStyle(status: OrderStatus): CSSProperties {
  return {
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    background: badge(status).bg,
  };
}
function statusChipStyle(status: OrderStatus): CSSProperties {
  const b = badge(status);
  return {
    fontSize: "10px",
    padding: "2px 6px",
    borderRadius: "4px",
    background: b.bg,
    color: b.color,
  };
}
</script>
