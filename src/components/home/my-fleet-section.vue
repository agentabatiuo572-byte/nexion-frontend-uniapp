<template>
  <view style="padding-top: 12px">
    <view class="flex items-center justify-between" style="margin: 0 2px 16px">
      <view class="flex items-center min-w-0" style="gap: 7px">
        <text style="font-family: var(--font-v5); font-weight: 600; font-size: 15px; color: var(--v5-ink); letter-spacing: -0.012em">{{ t.home.myFleet }}</text>
        <text class="font-mono-tabular" style="font-size: 11.5px; font-weight: 500; color: var(--v5-ink-3)">{{ fleetCountText }}</text>
      </view>
      <view class="font-mono-tabular inline-flex items-center active:opacity-70" style="gap: 2px; font-size: 13px; color: var(--v5-brand); font-weight: 500" @click="goManage">
        <text>{{ t.home.fleetManage }}</text>
        <ChevronRightIcon />
      </view>
    </view>

    <view style="padding: 0 2px; border-top: 1px solid var(--v5-border)">
      <DeviceRow v-for="(d, index) in displayedDevices" :key="d.id" :device="d" :divider="index < renderedCount - 1 || showAddRow" :target="deviceTarget" />
      <AddDeviceRow v-if="showAddRow" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import { createDevice, MAX_DEVICES } from "@/store/device-types";
import type { Device, DeviceKind } from "@/store/types";
import ChevronRightIcon from "@/components/icons/chevron-right-icon.vue";
import DeviceRow from "./device-row.vue";
import AddDeviceRow from "./add-device-row.vue";

const t = useT();
const app = useApp();
const props = withDefaults(defineProps<{ context?: "home" | "earn"; maxItems?: number }>(), {
  context: "home",
});

const legacyDemoKinds: DeviceKind[] = ["cloud-share", "stellarbox-s1", "stellarbox-pro", "stellarrack-p1"];
const activeDevices = computed(() => app.visibleDevices.filter((d) => d.activatedAt !== null));
const hasLegacyDemoFleet = computed(() => legacyDemoKinds.every((kind) => activeDevices.value.some((d) => d.kind === kind)));
const devices = computed<Device[]>(() => {
  if (props.context === "earn") return activeDevices.value;
  if (!hasLegacyDemoFleet.value) return activeDevices.value;
  const phone = activeDevices.value.find((d) => d.kind === "phone") ?? createDevice("phone", "phone-1");
  return [{
    ...phone,
    name: "Your phone",
    gpu: "Mobile NPU · ~28.3 TOPS",
    baseRate: 0.06,
    baseRateNEX: 10,
    todayEarnings: 0.04,
    todayEarningsNEX: 6.2,
    status: "online",
    batteryLevel: 78,
    isCharging: true,
    isWifiConnected: true,
    thermalState: "nominal",
  }];
});
const maxRows = computed(() => props.maxItems ?? Number.POSITIVE_INFINITY);
const displayedDevices = computed(() => devices.value.slice(0, maxRows.value));
const renderedCount = computed(() => displayedDevices.value.length);
const totalCount = computed(() => devices.value.length);
const showAddRow = computed(() => totalCount.value < MAX_DEVICES);
const fleetCountText = computed(() => fmt(t.value.home.fleetOfMax, { n: totalCount.value }));
const deviceTarget = computed<"home" | "detail">(() => (props.context === "earn" ? "detail" : "home"));

function goManage() {
  uni.navigateTo({ url: "/pages/me/devices", fail: () => {} });
}
</script>
