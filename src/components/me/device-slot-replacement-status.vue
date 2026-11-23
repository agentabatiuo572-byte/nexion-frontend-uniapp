<template>
  <view v-for="item in pending" :key="item.oldDeviceId" class="slot-replacement-status" role="status">
    <text>{{ fmt(copy.oldWaiting, { old: item.oldDeviceName, new: item.newDeviceName }) }}</text>
    <text>{{ fmt(copy.newWaiting, { old: item.oldDeviceName, new: item.newDeviceName }) }}</text>
    <NxButton variant="text" size="small" :label="copy.cancel" @click="goToReplacement(item.newDeviceId)" />
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import NxButton from "@/components/ui/nx-button.vue";
import { fmt } from "@/i18n/format";
import { useDeviceSlotReplacementCopy } from "@/i18n/device-slot-replacement";
import { navTo } from "@/lib/route";
import { useApp } from "@/store/app";

const app = useApp();
const copy = useDeviceSlotReplacementCopy();
const pending = computed(() => app.visibleDevices.flatMap((device) =>
  device.replacement && String(device.replacement.oldDeviceId) === device.id ? [device.replacement] : []));

function goToReplacement(id: number) {
  navTo(`/pages/me/devices?cancelReplacementId=${encodeURIComponent(id)}`);
}
</script>

<style scoped>
.slot-replacement-status { display: grid; gap: 4px; padding: 12px; margin: 8px 0; background: var(--v5-surface-2); border-radius: var(--v5-radius-m); font: 400 13px/18px var(--font-v5); overflow-wrap: anywhere; }
.slot-replacement-status :deep(.nx-button) { justify-self: start; }
</style>
