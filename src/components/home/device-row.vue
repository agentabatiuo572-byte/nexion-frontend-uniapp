<!--
  DeviceRow — one row in ZONE 2 fleet's device list (below the slot rack):
  status dot · device name · today earnings. Status is the dot colour (green =
  truly online, dim = hosted/offline). No icon (those live in the rack above), no GPU
  spec, no task block — kept simple per design. Tapping opens detail / earn.
-->
<template>
  <view
    class="nx-device-row flex items-center justify-between active:opacity-70"
    :style="rowStyle"
    :data-online="isOnline ? 'true' : 'false'"
    role="button"
    tabindex="0"
    :aria-label="`${t.earn.deviceDetailTitle}: ${device.name}`"
    @click="go"
    @keydown.enter.prevent="go"
    @keydown.space.prevent="go"
  >
    <view class="flex items-center min-w-0" style="gap: 9px; flex: 1 1 auto">
      <view :style="dotStyle" />
      <text class="block" style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-v5); font-weight: 500; font-size: 14px; color: var(--v5-ink); letter-spacing: -0.01em">{{ device.name }}</text>
    </view>
    <text class="font-mono-tabular tabular-nums shrink-0" style="font-family: var(--font-v5); font-weight: 500; font-size: 14px; color: var(--v5-warning); margin-left: 12px">+${{ todayText }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { navTo } from "@/lib/route";
import { isDeviceOnline } from "@/lib/hashpower";
import type { Device } from "@/store/types";

const props = defineProps<{ device: Device; divider: boolean }>();
const t = useT();

const isOnline = computed(() => isDeviceOnline(props.device, Date.now()));
const rowStyle = computed<CSSProperties>(() => ({
  padding: "13px 14px",
  borderBottom: props.divider ? "1px solid var(--v5-border)" : "none",
}));
const dotStyle = computed<CSSProperties>(() => ({
  width: "7px",
  height: "7px",
  borderRadius: "50%",
  flexShrink: 0,
  background: isOnline.value ? "var(--v5-success)" : "var(--v5-ink-4)",
}));
const todayText = computed(() =>
  props.device.todayEarnings.toFixed(props.device.todayEarnings < 1 ? 3 : 2),
);

function go() {
  navTo(`/pages/earn/device-detail?id=${encodeURIComponent(props.device.id)}`);
}
</script>
