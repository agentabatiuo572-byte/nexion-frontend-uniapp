<!--
  Order detail — ported from Nexion-prototype/app/(main)/store/orders/[id]/
  page.tsx. Dynamic [id] → ?id= query (onLoad). Single-order tracking:
    hero status (color-keyed by status) → activated→Earn jump → order summary →
    4-stage deployment timeline → cancel action (only while "placed").

  While on this page, advanceOrder(id) ticks every 3s so the provisioning bar
  moves visibly. Cancel uses confirm() from the ui store (danger). Wrapped in
  <AppChassis active="store"> with an in-page back/title row (matches detail.vue).

  Status-color opacity tints use color-mix(... transparent) since uni can't do
  the source's `${color}10` hex-suffix on a CSS variable.
-->
<template>
  <AppChassis active="store">
    <view style="color: var(--v5-ink)">
      <!-- In-page header: back + title/subtitle -->
      <view class="flex items-center" :style="headerStyle">
        <view class="grid place-items-center active:opacity-60" :style="backBtnStyle" role="button" tabindex="0" aria-label="Back to orders" @tap.stop="goOrders" @click.stop="goOrders">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" @tap.stop="goOrders" @click.stop="goOrders"><path d="m15 18-6-6 6-6" /></svg>
        </view>
        <view class="min-w-0 flex-1">
          <text class="block truncate" :style="headerTitleStyle">{{ order ? order.id : t.orders.notFound }}</text>
          <text v-if="order" class="block font-mono-tabular" style="font-size: 11.5px; color: var(--v5-ink-3); margin-top: 1px">{{ t.orders.orderId }}</text>
        </view>
      </view>

      <!-- Order not found -->
      <view v-if="!order" class="text-center" style="padding: 20px">
        <text class="block" style="font-size: 13.5px; color: var(--v5-ink-3); margin-bottom: 12px">{{ t.orders.notFound }}</text>
        <view class="inline-flex items-center justify-center active:opacity-90" :style="notFoundBtnStyle" role="button" tabindex="0" :aria-label="t.orders.title" @tap.stop="goOrders" @click.stop="goOrders">
          <text>{{ t.orders.title }} →</text>
        </view>
      </view>

      <template v-else>
        <!-- Hero status -->
        <view class="mx-4 rounded-2xl border" :style="heroStyle">
          <view class="flex items-center" style="gap: 12px">
            <view class="grid place-items-center" :style="heroIconStyle">
              <svg v-if="isProvisioning" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nx-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" :stroke="statusColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, di) in statusIcon" :key="di" :d="d" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <text class="block" :style="heroLabelStyle">{{ statusLabel(order.status) }}</text>
              <text class="block truncate" style="font-size: 12px; color: var(--v5-ink-3); margin-top: 2px">{{ order.productName }}</text>
            </view>
          </view>

          <view v-if="order.status !== 'cancelled'" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--v5-border)">
            <view class="flex items-center justify-between" style="font-size: 11.5px">
              <text style="color: var(--v5-ink-3)">{{ t.orders.dataCenter }}</text>
              <text class="tabular-nums" style="color: var(--v5-ink)">{{ order.dataCenter }}</text>
            </view>
            <text v-if="order.status === 'provisioning' || order.status === 'activated'" class="block" :style="{ fontSize: '11px', marginTop: '8px', lineHeight: '1.5', color: statusColor }">{{ dynamicHint }}</text>
          </view>
        </view>

        <!-- Activated → Earn jump -->
        <view v-if="order.status === 'activated'" class="mx-4 rounded-2xl border" :style="summaryCardStyle" style="margin-top: 12px">
          <view class="flex items-center" style="gap: 12px">
            <view class="grid place-items-center" :style="earnIconStyle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2" /><rect width="6" height="6" x="9" y="9" rx="1" /><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <text class="block" style="font-size: 13.5px; font-weight: 600; color: var(--v5-ink)">{{ activatedHint }}</text>
            </view>
          </view>
          <view class="block text-center active:opacity-85" :style="earnBtnStyle" role="button" tabindex="0" aria-label="View on Earn" @tap.stop="goEarn" @click.stop="goEarn">
            <text>View on Earn →</text>
          </view>
        </view>

        <!-- Order summary -->
        <view class="mx-4 rounded-2xl border" :style="summaryCardStyle" style="margin-top: 12px">
          <text class="block" :style="sectionLabelStyle">{{ t.orders.orderSummary }}</text>
          <DetailRow :label="t.orders.orderIdLabel" :value="order.id" mono />
          <DetailRow :label="t.orders.quantity" :value="`${order.quantity}`" />
          <DetailRow :label="t.orders.unitPrice" :value="`$${order.unitPrice.toLocaleString()}`" />
          <DetailRow v-if="order.discount > 0" :label="t.orders.discount" :value="`-$${order.discount.toLocaleString()}`" brand />
          <DetailRow :label="t.orders.subtotal" :value="`$${(order.unitPrice * order.quantity).toLocaleString()}`" />
          <DetailRow :label="t.orders.total" :value="`$${order.total.toLocaleString()}`" big />
          <view class="grid" :style="tsGridStyle">
            <view>
              <text class="block" style="font-size: 11.5px; color: var(--v5-ink-4)">{{ t.orders.placedAt }}</text>
              <text class="block" style="font-size: 11.5px; color: var(--v5-ink-2); margin-top: 2px">{{ dt(order.placedAt) }}</text>
            </view>
            <view v-if="order.paidAt">
              <text class="block" style="font-size: 11.5px; color: var(--v5-ink-4)">{{ t.orders.paidAt }}</text>
              <text class="block" style="font-size: 11.5px; color: var(--v5-ink-2); margin-top: 2px">{{ dt(order.paidAt) }}</text>
            </view>
            <view v-if="order.activatedAt">
              <text class="block" style="font-size: 11.5px; color: var(--v5-ink-4)">{{ t.orders.activatedAt }}</text>
              <text class="block" style="font-size: 11.5px; color: var(--v5-ink-2); margin-top: 2px">{{ dt(order.activatedAt) }}</text>
            </view>
          </view>
        </view>

        <!-- Timeline -->
        <view class="mx-4 rounded-2xl border" :style="summaryCardStyle" style="margin-top: 12px">
          <text class="block" :style="sectionLabelStyle">{{ t.orders.timelineTitle }}</text>
          <view class="relative" :style="timelineWrapStyle">
            <view v-for="(stage, i) in stages" :key="stage" :style="{ marginTop: i !== 0 ? '12px' : '0' }">
              <view class="absolute rounded-full" :style="dotStyle(i)" />
              <view class="flex items-center" style="gap: 8px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" :stroke="i <= currentIdx && order.status !== 'cancelled' ? 'var(--v5-brand)' : 'var(--v5-ink-4)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, di) in stageIcon(stage)" :key="di" :d="d" /></svg>
                <text :style="{ fontSize: '12.5px', color: i <= currentIdx && order.status !== 'cancelled' ? 'var(--v5-ink)' : 'var(--v5-ink-4)' }">{{ statusLabel(stage) }}</text>
              </view>
              <text v-if="eventFor(stage)" class="block" style="font-size: 11px; color: var(--v5-ink-4); margin-top: 2px; margin-left: 22px">{{ eventText(stage) }}</text>
            </view>
          </view>
        </view>

        <!-- Cancel action (only while placed) -->
        <view v-if="cancellable" class="mx-4" style="margin-top: 12px; margin-bottom: 24px">
          <view class="w-full grid place-items-center active:opacity-80" :style="cancelBtnStyle" role="button" tabindex="0" :aria-label="t.orders.cancelOrder" @tap.stop="handleCancel" @click.stop="handleCancel">
            <text>{{ t.orders.cancelOrder }}</text>
          </view>
        </view>
        <view v-else style="height: 24px" />
      </template>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, type CSSProperties } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import DetailRow from "@/components/store/order-detail-row.vue";
import { useT } from "@/i18n/use-t";
import { useOrders, type OrderStatus, timelineFor } from "@/store/orders";
import { confirm as uiConfirm, toast } from "@/store/ui";
import { navTo } from "@/lib/route";

const t = useT();
const orders = useOrders();

const id = ref("");
onLoad((options) => {
  const o = (options || {}) as Record<string, string>;
  if (o.id) id.value = o.id;
});

const order = computed(() => orders.orders.find((o) => o.id === id.value));

// While on this page, tick orders every 3s so the provisioning bar moves
// visibly (the global sim also ticks; this gives a tighter feel here).
let tickTimer: ReturnType<typeof setInterval> | undefined;
function startTick() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    if (id.value) orders.advanceOrder(id.value);
  }, 3000);
}
startTick();

const stages = computed(() => (order.value ? timelineFor(order.value.productId) : []));
const currentIdx = computed(() => (order.value ? stages.value.indexOf(order.value.status) : -1));
// Cancellable ONLY before payment settles ("placed"). Checkout settles to
// "paid", so in practice no order rests at "placed" — kept faithful to source.
const cancellable = computed(() => order.value?.status === "placed");
const isProvisioning = computed(() => order.value?.status === "provisioning");

const STATUS_COLORS: Record<OrderStatus, string> = {
  placed: "var(--v5-ink-3)",
  paid: "var(--v5-brand)",
  provisioning: "var(--v5-warning)",
  activated: "var(--v5-brand)",
  cancelled: "var(--v5-brand-2)",
};
const statusColor = computed(() => (order.value ? STATUS_COLORS[order.value.status] : "var(--v5-ink-3)"));

// lucide outline paths per status (Clock / CheckCircle2 / Server / Cpu / XCircle)
function iconFor(status: OrderStatus): string[] {
  switch (status) {
    case "placed": return ["M12 6v6l4 2", "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"];
    case "paid": return ["M22 11.08V12a10 10 0 1 1-5.93-9.14", "m9 11 3 3L22 4"];
    case "provisioning": return ["M5 2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z", "M5 14h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z", "M6 6h.01", "M6 18h.01"];
    case "activated": return ["M12 20v2", "M12 2v2", "M17 20v2", "M17 2v2", "M2 12h2", "M2 17h2", "M2 7h2", "M20 12h2", "M20 17h2", "M20 7h2", "M7 20v2", "M7 2v2", "M4 8h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z", "M8 12h8"];
    case "cancelled": return ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "m15 9-6 6", "m9 9 6 6"];
  }
}
const statusIcon = computed(() => (order.value ? iconFor(order.value.status) : []));
function stageIcon(stage: OrderStatus): string[] {
  return iconFor(stage);
}

function statusLabel(s: OrderStatus): string {
  switch (s) {
    case "placed": return t.value.orders.statusPlaced;
    case "paid": return t.value.orders.statusPaid;
    case "provisioning": return t.value.orders.statusProvisioning;
    case "activated": return t.value.orders.statusActivated;
    case "cancelled": return t.value.orders.cancelStatus;
  }
}

const dynamicHint = computed(() => {
  const o = order.value;
  if (!o) return "";
  const tmpl = o.status === "provisioning" ? t.value.orders.provisioningHint : t.value.orders.activatedHint;
  return tmpl.replace("{dc}", o.dataCenter);
});
const activatedHint = computed(() =>
  order.value ? t.value.orders.activatedHint.replace("{dc}", order.value.dataCenter) : "",
);

function eventFor(stage: OrderStatus) {
  return order.value?.timeline.find((e) => e.status === stage);
}
function eventText(stage: OrderStatus): string {
  const evt = eventFor(stage);
  if (!evt) return "";
  return `${dt(evt.ts)}${evt.note ? ` · ${evt.note}` : ""}`;
}

function dt(ts: number): string {
  return new Date(ts).toLocaleString();
}

async function handleCancel() {
  const ok = await uiConfirm({
    title: t.value.orders.cancelOrder,
    message: t.value.orders.cancelConfirm,
    danger: true,
    icon: "warn",
  });
  if (ok && order.value) {
    orders.cancelOrder(order.value.id);
    toast.warn(t.value.orders.cancelDoneToast);
  }
}

function goOrders() {
  navTo("/store/orders");
}
function goEarn() {
  navTo("/earn");
}

function cleanup() {
  if (tickTimer) clearInterval(tickTimer);
}
onUnload(() => cleanup());
onUnmounted(() => cleanup());

// ─── styles ───
function tint(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}
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
const heroStyle = computed<CSSProperties>(() => ({
  padding: "20px",
  background: tint(statusColor.value, 6),
  borderColor: tint(statusColor.value, 25),
}));
const heroIconStyle = computed<CSSProperties>(() => ({
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  background: tint(statusColor.value, 12),
}));
const heroLabelStyle = computed<CSSProperties>(() => ({
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: "1.2",
  color: statusColor.value,
}));
const summaryCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
  padding: "16px",
};
const earnIconStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "12px",
  background: "var(--v5-brand-soft)",
};
const earnBtnStyle: CSSProperties = {
  marginTop: "12px",
  height: "44px",
  lineHeight: "44px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "13px",
  letterSpacing: "-0.005em",
};
const sectionLabelStyle: CSSProperties = {
  marginBottom: "12px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
const tsGridStyle: CSSProperties = {
  marginTop: "12px",
  paddingTop: "12px",
  borderTop: "1px solid var(--v5-border)",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px",
};
const timelineWrapStyle: CSSProperties = {
  paddingLeft: "20px",
  borderLeft: "1px solid var(--v5-border)",
};
function dotStyle(i: number): CSSProperties {
  const done = i <= currentIdx.value && order.value?.status !== "cancelled";
  const current = i === currentIdx.value && order.value?.status !== "cancelled";
  return {
    left: "-7px",
    width: "12px",
    height: "12px",
    marginTop: "5px",
    background: done ? "var(--v5-brand)" : "var(--v5-surface-2)",
    border: done ? "none" : "1px solid var(--v5-border)",
    boxShadow: current ? "0 0 0 4px color-mix(in srgb, var(--v5-brand) 15%, transparent)" : "none",
  };
}
const cancelBtnStyle: CSSProperties = {
  height: "40px",
  borderRadius: "12px",
  background: "var(--v5-surface-2)",
  color: "var(--v5-brand-2)",
  fontSize: "12.5px",
  fontWeight: 500,
};
</script>

<style scoped>
.nx-spin {
  animation: nx-spin 1s linear infinite;
}
@keyframes nx-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .nx-spin { animation: none; }
}
</style>
