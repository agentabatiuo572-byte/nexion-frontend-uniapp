<!--
  SubPageHeader — in-page back row for sub-pages (genesis / staking / daily …).

  The source uses <SetPageHeader backHref> which registers a back button in the
  chassis-level Header via a store. uni's chassis Header is a fixed brand row,
  so (mirroring store/detail.vue) the per-page back chevron + optional title
  lives here and scrolls with content. Back = navigateBack with a reLaunch
  fallback to `back` (when the page was opened cold / no history).
-->
<template>
  <view class="flex items-center" :style="rowStyle">
    <view class="grid place-items-center active:opacity-60" :style="backBtnStyle" @click="goBack">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
    </view>
    <view v-if="title" class="min-w-0 flex-1">
      <text class="block truncate" :style="titleStyle">{{ title }}</text>
      <text v-if="subtitle" class="block truncate" :style="subtitleStyle">{{ subtitle }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue";

const props = defineProps<{ back: string; title?: string; subtitle?: string }>();

function goBack() {
  uni.navigateBack({
    fail: () => uni.reLaunch({ url: props.back, fail: () => {} }),
  });
}

const rowStyle: CSSProperties = { gap: "8px", padding: "8px 14px 4px" };
const backBtnStyle: CSSProperties = { width: "36px", height: "36px", marginLeft: "-6px" };
const titleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "16px",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--v5-ink)",
};
const subtitleStyle: CSSProperties = {
  fontSize: "11.5px",
  color: "var(--v5-ink-3)",
  marginTop: "1px",
};
</script>
