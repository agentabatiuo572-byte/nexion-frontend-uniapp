<template>
  <view class="amb-icon" :class="`amb-icon--${size}`" :style="{ '--amb-tint': visual.tint }" aria-hidden="true">
    <svg :width="size === 'small' ? 16 : 20" :height="size === 'small' ? 16 : 20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path v-for="(path, index) in visual.paths" :key="index" :d="path" /></svg>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { AMBASSADOR_BUCKET_VISUALS, AMBASSADOR_NO_BUCKET_VISUAL, type AmbassadorBucketId } from "@/lib/ambassador-display";

const props = withDefaults(defineProps<{ bucket: AmbassadorBucketId | null; size?: "small" | "regular" }>(), { size: "regular" });
const visual = computed(() => props.bucket ? AMBASSADOR_BUCKET_VISUALS[props.bucket] : AMBASSADOR_NO_BUCKET_VISUAL);
</script>

<style scoped>
.amb-icon { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: var(--ui-radius-icon); background: color-mix(in srgb, var(--amb-tint) 16%, transparent); color: var(--amb-tint); }
.amb-icon--small { width: 28px; height: 28px; border-radius: var(--v5-radius-s); }
</style>
