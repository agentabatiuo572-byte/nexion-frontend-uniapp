<template>
  <view :id="`device-card-${device.id}`" class="device-unclassified-card" :data-device-id="device.id" :data-device-key="`device:${device.id}`">
    <text class="device-unclassified-card__name">{{ device.name }}</text>
    <text class="device-unclassified-card__sku">{{ device.productCode }}</text>
    <view class="device-unclassified-card__metric"><text>{{ t.earn.todayEarnings }}</text><text>—</text></view>
    <view class="device-unclassified-card__metric"><text>{{ t.earn.capacityChipLabel }}</text><text>—</text></view>
  </view>
</template>

<script setup lang="ts">
import type { Device } from "@/store/types";
import { useT } from "@/i18n/use-t";

defineProps<{ device: Device }>();
const t = useT();
</script>

<style scoped>
.device-unclassified-card { padding: 20px; border-radius: var(--v5-radius-xl); background: var(--v5-surface); color: var(--v5-ink); }
.device-unclassified-card__name { display: block; font-weight: 600; overflow-wrap: anywhere; }
.device-unclassified-card__sku { display: block; margin-top: 4px; font-size: 12px; color: var(--v5-ink-3); overflow-wrap: anywhere; }
.device-unclassified-card__metric { display: flex; justify-content: space-between; gap: 12px; margin-top: 16px; font-size: 13px; color: var(--v5-ink-3); }
</style>
