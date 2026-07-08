<!--
  DeviceInventoryRow — ported from me/devices/page.tsx DeviceRow.
  One device card (icon + name + "$rate/d · gpu" + pending-deactivate chip) with
  a full-width activate/deactivate action bar at the bottom. `active` switches
  icon tint + action label/colour; `disabled` (slots full, inventory rows only)
  greys the action. lucide Smartphone/Server/Power/PowerOff/Clock → inline svg.
-->
<template>
  <view class="overflow-hidden" :style="cardStyle">
    <view class="flex items-center active:opacity-80" style="gap: 12px; padding: 8px 16px" @click="goDetail">
      <view class="grid place-items-center shrink-0" :style="iconBoxStyle">
        <image v-if="deviceImage && !isPhone" :src="deviceImage" mode="aspectFill" style="width: 44px; height: 44px; border-radius: 6px" />
        <image v-else-if="isPhone" src="/static/img/devices/real-phone-ui.png" mode="aspectFit" style="width: 44px; height: 44px" />
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" :stroke="iconColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" /><line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" /></svg>
      </view>
      <view class="flex-1 min-w-0">
        <text class="block truncate" :style="nameStyle">{{ device.name }}</text>
        <text class="block truncate" :style="specStyle">${{ device.baseRate.toFixed(2) }}/天 · {{ device.gpu }}</text>
        <view v-if="device.pendingDeactivate" class="inline-flex items-center" :style="pendingChipStyle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          <text>{{ pendingChipLabel }}</text>
        </view>
      </view>
    </view>
    <view class="w-full flex items-center justify-center transition" :class="{ 'active:bg-[var(--v5-surface-2)]': !disabled }" :style="actionStyle" @click="onAction">
      <svg v-if="active" width="14" height="14" viewBox="0 0 24 24" fill="none" :stroke="actionColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64A9 9 0 0 1 20.77 15" /><path d="M6.16 6.16a9 9 0 1 0 12.68 12.68" /><path d="M12 2v4" /><line x1="2" x2="22" y1="2" y2="22" /></svg>
      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" :stroke="actionColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.77.04" /></svg>
      <text :style="actionLabelStyle">{{ actionLabel }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import type { Device } from "@/store/types";
import { rankingDeviceImage } from "@/lib/device-art";

const props = withDefaults(
  defineProps<{
    device: Device;
    active: boolean;
    disabled?: boolean;
    activateLabel: string;
    deactivateLabel: string;
    slotsFullLabel: string;
    pendingChipLabel: string;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{ (e: "toggle"): void }>();

const isPhone = computed(() => props.device.kind === "phone");
const deviceImage = computed(() => rankingDeviceImage(props.device.kind));
const iconColor = computed(() => (props.active ? "var(--v5-brand)" : "var(--v5-ink-3)"));
const actionColor = computed(() =>
  props.disabled ? "var(--v5-ink-4)" : props.active ? "var(--v5-brand-2)" : "var(--v5-brand)",
);
const actionLabel = computed(() =>
  props.active ? props.deactivateLabel : props.disabled ? props.slotsFullLabel : props.activateLabel,
);

function onAction() {
  if (props.disabled) return;
  emit("toggle");
}

function goDetail() {
  uni.navigateTo({ url: `/pages/earn/device-detail?id=${encodeURIComponent(props.device.id)}`, fail: () => {} });
}

const cardStyle: CSSProperties = {
  background: "linear-gradient(180deg, #111317 0%, #15181C 100%)",
  border: "1px solid var(--v5-border)",
  borderRadius: "16px",
};
const iconBoxStyle = computed<CSSProperties>(() => ({
  width: "44px",
  height: "44px",
  borderRadius: deviceImage.value ? "6px" : "8px",
  overflow: "hidden",
  background: deviceImage.value
    ? "transparent"
    : props.active
    ? "color-mix(in srgb, var(--v5-brand) 15%, transparent)"
    : "var(--v5-surface-2)",
}));
const nameStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "13.5px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const specStyle: CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-numbers)",
  fontSize: "11.5px",
  color: "var(--v5-ink-3)",
};
const pendingChipStyle: CSSProperties = {
  marginTop: "4px",
  gap: "4px",
  padding: "2px 6px",
  borderRadius: "6px",
  background: "color-mix(in srgb, var(--v5-warning) 12%, transparent)",
  color: "var(--v5-warning)",
  fontFamily: "var(--font-numbers)",
  fontSize: "11px",
};
const actionStyle: CSSProperties = {
  gap: "6px",
  height: "44px",
  borderTop: "1px solid var(--v5-border)",
};
const actionLabelStyle = computed<CSSProperties>(() => ({
  fontFamily: "var(--font-v5)",
  fontSize: "12.5px",
  fontWeight: 500,
  color: actionColor.value,
}));
</script>
