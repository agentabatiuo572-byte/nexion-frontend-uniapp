<!-- Decorative hardware bay inside the single DeviceRow action. Clicks bubble to that action. -->
<template>
  <view class="nx-device-slot" :data-online="online ? 'true' : 'false'" aria-hidden="true">
    <BusinessImage :src="device.kind === 'phone' ? '/static/img/home-glass-20260928/phone.webp' : device.imageUrl" class="nx-home-art" :class="{ 'nx-home-art-float': online }">
      <view class="hf-computer">
        <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" /></svg>
        <view class="nx-home-empty-plinth" />
      </view>
    </BusinessImage>
  </view>
</template>

<script setup lang="ts">
import BusinessImage from "@/components/business-image.vue";
import type { Device } from "@/store/types";

defineProps<{ device: Device; online: boolean }>();
</script>

<style scoped>
.nx-device-slot { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); place-items: center; height: 126px; width: 100%; }
.nx-device-slot :deep(.nx-home-art) { width: 136px; max-width: 100%; height: 100%; background-image: none; pointer-events: none; }
.hf-computer { position: relative; display: grid; place-items: center; width: 100%; height: 116px; color: var(--v5-ink-2); }
.hf-computer svg { z-index: 1; margin-bottom: 10px; }
</style>
