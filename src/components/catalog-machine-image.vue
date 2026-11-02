<template>
  <view class="catalog-machine-image" aria-hidden="true">
    <image v-if="imageSrc" :key="imageSrc" :src="imageSrc" mode="aspectFit" @error="failedImageUrl = imageUrl ?? ''" />
    <view v-else class="catalog-machine-image__placeholder">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="m12 2 9 5v10l-9 5-9-5V7Z" /><path d="m3 7 9 5 9-5M12 12v10" /></svg>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { catalogProductImageUrl } from "@/lib/product-image";

const props = defineProps<{ sku: string | null; imageUrl?: string; scopeKey: string }>();
const failedImageUrl = ref("");
watch(() => [props.sku, props.imageUrl, props.scopeKey], () => { failedImageUrl.value = ""; });
const imageSrc = computed(() => catalogProductImageUrl(props.imageUrl, failedImageUrl.value));
</script>

<style scoped>
.catalog-machine-image { position: relative; }
.catalog-machine-image > image, .catalog-machine-image__placeholder { width: 100%; height: 100%; }
.catalog-machine-image__placeholder { display: grid; place-items: center; color: var(--v5-ink-3); }
</style>
