<template>
  <view class="active:opacity-70" :style="rowStyle" @click="go">
    <view class="grid place-items-center" :style="iconFrameStyle">
      <image v-if="deviceImage" :src="deviceImage" mode="aspectFill" style="width: 44px; height: 44px; border-radius: 6px" />
      <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
        <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
        <line x1="6" x2="6.01" y1="6" y2="6" />
        <line x1="6" x2="6.01" y1="18" y2="18" />
      </svg>
    </view>

    <view class="min-w-0">
      <text class="block truncate" style="font-family: var(--font-v5); font-weight: 600; font-size: 14px; line-height: 18px; color: var(--v5-ink); letter-spacing: -0.01em">{{ order.productName }}</text>
      <text class="block truncate" style="margin-top: 3px; font-size: 12px; line-height: 16px; color: var(--v5-ink-3)">{{ order.dataCenter }}</text>
    </view>

    <view style="text-align: right">
      <text class="block" :style="statusStyle">{{ statusText }}</text>
      <text class="font-mono-tabular block" style="margin-top: 3px; font-size: 11.5px; line-height: 15px; color: var(--v5-ink-3)">{{ shortId }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import type { Order } from "@/store/orders";
import { useT } from "@/i18n/use-t";
import { rankingDeviceImage } from "@/lib/device-art";

const props = defineProps<{ order: Order; divider?: boolean }>();
const t = useT();
const deviceImage = computed(() => rankingDeviceImage(props.order.productId));

const rowStyle = computed<CSSProperties>(() => ({
  display: "grid",
  gridTemplateColumns: "44px minmax(0, 1fr) max-content",
  columnGap: "12px",
  alignItems: "center",
  padding: "8px 0",
  borderBottom: props.divider ? "1px solid var(--v5-border)" : "none",
}));
const iconFrameStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  borderRadius: "6px",
  overflow: "hidden",
  background: "var(--v5-warning-soft)",
};
const statusText = computed(() => {
  switch (props.order.status) {
    case "placed": return t.value.orders.statusPlaced;
    case "paid": return t.value.orders.statusPaid;
    case "provisioning": return t.value.orders.statusProvisioning;
    default: return t.value.orders.statusPaid;
  }
});
const statusStyle = computed<CSSProperties>(() => ({
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "12.5px",
  lineHeight: "18px",
  color: props.order.status === "provisioning" ? "var(--v5-warning)" : "var(--v5-brand)",
}));
const shortId = computed(() => props.order.id.split("-").slice(-1)[0] ?? props.order.id);

function go() {
  uni.navigateTo({ url: `/pages/store/order-detail?id=${encodeURIComponent(props.order.id)}`, fail: () => {} });
}
</script>
