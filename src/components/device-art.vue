<!-- Decorative machine artwork for a fleet device (exact storefront SKU) or a given image; the parent sizes it. -->
<template>
  <view class="device-art" aria-hidden="true">
    <image v-if="resolved" class="device-art__image" :src="resolved" mode="aspectFit" @error="onError" />
    <svg v-else class="device-art__fallback" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" /></svg>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Device } from "@/store/types";
import { useDeviceProductImage } from "@/composables/use-device-product-image";

const props = defineProps<{ device?: Device; src?: string | null }>();
// Without a fleet row (trial, ranking tier) the artwork comes from the given image instead.
const { imageSrc, imageError } = useDeviceProductImage(() => props.device ?? { kind: "phone", productCode: "", capacitySource: "server" });
const srcFailed = ref(false);
watch(() => props.src, () => { srcFailed.value = false; });
const resolved = computed(() => props.device ? imageSrc.value : srcFailed.value ? null : props.src ?? null);
function onError() {
  if (props.device) imageError();
  else srcFailed.value = true;
}
</script>

<style scoped>
.device-art { position: relative; display: grid; place-items: center; color: var(--v5-ink-3); }
.device-art__image { display: block; width: 100%; height: 100%; }
</style>
