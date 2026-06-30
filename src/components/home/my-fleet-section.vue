<!--
  MyFleetSection — ZONE 2 active-device fleet. Header (My fleet · N of 6 ·
  Manage) over a horizontal slot rack (one icon bay per active device + an add
  bay while under the 6-device cap), then a device list card below (status dot ·
  name · today earnings). Shows ACTIVE devices only (inactive live in /me/devices).
-->
<template>
  <view>
    <view class="flex items-center justify-between" style="margin: 0 2px 12px">
      <text style="font-family: var(--font-v5); font-weight: 600; font-size: 15px; color: var(--v5-ink); letter-spacing: -0.012em">{{ t.home.myFleet }} <text class="font-mono-tabular" style="font-size: 11.5px; font-weight: 400; color: var(--v5-ink-3)">{{ fleetCountText }}</text></text>
      <text class="font-mono-tabular active:opacity-70" style="font-size: 13px; color: var(--v5-brand); font-weight: 500" @click="goManage">{{ t.home.fleetManage }} →</text>
    </view>

    <!-- Slot rack: icon bays -->
    <view class="flex items-center" style="gap: 9px; margin-bottom: 14px">
      <DeviceSlot v-for="d in devices" :key="d.id" :device="d" />
      <AddDeviceRow v-if="devices.length < 6" />
    </view>

    <!-- Device list: status dot · name · today earnings -->
    <view class="rounded-2xl overflow-hidden" style="border: 1px solid var(--v5-border); background: var(--v5-surface)">
      <DeviceRow v-for="(d, i) in devices" :key="d.id" :device="d" :divider="i < devices.length - 1" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useApp } from "@/store/app";
import DeviceSlot from "./device-slot.vue";
import DeviceRow from "./device-row.vue";
import AddDeviceRow from "./add-device-row.vue";

const t = useT();
const app = useApp();

const devices = computed(() => app.visibleDevices.filter((d) => d.activatedAt !== null));
const fleetCountText = computed(() => fmt(t.value.home.fleetOfMax, { n: devices.value.length }));

function goManage() {
  uni.navigateTo({ url: "/pages/earn/earn", fail: () => {} });
}
</script>
