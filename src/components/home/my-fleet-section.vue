<!--
  MyFleetSection — ZONE 2 active-device fleet (ported from mission-control.tsx
  MyFleetSection). Shows ACTIVE devices only (inactive live in /me/devices).
  Header (My fleet · N of 6 · Manage) + device rows + an add-device row when
  under the 6-device cap.
-->
<template>
  <view>
    <view class="flex items-center justify-between" style="margin: 8px 2px 10px">
      <text style="font-family: var(--font-v5); font-weight: 600; font-size: 15px; color: var(--v5-ink); letter-spacing: -0.012em">{{ t.home.myFleet }} <text class="font-mono-tabular" style="font-size: 11.5px; font-weight: 400; color: var(--v5-ink-3)">{{ fleetCountText }}</text></text>
      <text class="font-mono-tabular" style="font-size: 13px; color: var(--v5-brand); font-weight: 500" @click="goManage">{{ t.home.fleetManage }} →</text>
    </view>

    <view style="background: var(--v5-surface); border: 1px solid var(--v5-border); border-radius: 16px; padding: 0 16px">
      <DeviceRow v-for="(d, i) in devices" :key="d.id" :device="d" :divider="i < devices.length - 1" />
      <AddDeviceRow v-if="devices.length < 6" :has-devices="devices.length > 0" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import DeviceRow from "./device-row.vue";
import AddDeviceRow from "./add-device-row.vue";

const t = useT();
const app = useApp();

const devices = computed(() => app.devices.filter((d) => d.activatedAt !== null));
const fleetCountText = computed(() => fmt(t.value.home.fleetOfMax, { n: devices.value.length }));

function goManage() {
  uni.navigateTo({ url: "/pages/earn/earn", fail: () => {} });
}
</script>
