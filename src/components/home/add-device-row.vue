<template>
  <view class="active:opacity-70" style="display: grid; grid-template-columns: 44px minmax(0, 1fr) max-content; column-gap: 12px; align-items: center; padding: 8px 0" @click="go">
    <view class="grid place-items-center" style="width: 44px; height: 44px; border-radius: 10px; border: 1.5px dashed var(--v5-brand-border)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
    </view>

    <view class="min-w-0">
      <text class="block truncate" style="font-family: var(--font-v5); font-size: 14px; line-height: 18px; font-weight: 600; color: var(--v5-ink); letter-spacing: -0.01em">{{ t.home.addNexionBox }}</text>
      <text class="block truncate" style="margin-top: 3px; font-size: 12px; line-height: 16px; color: var(--v5-ink-3)">NexionBox S1</text>
    </view>

    <view style="text-align: right">
      <text class="tabular-nums block" style="font-family: var(--font-amount); font-size: 15px; line-height: 18px; font-weight: 600; color: var(--v5-success)">$7.00/d</text>
      <text class="block" style="margin-top: 3px; font-size: 12px; line-height: 16px; color: var(--v5-ink-3)">{{ paybackText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

const t = useT();
const paybackText = computed(() => fmt(t.value.home.addBoxPayback, { n: 93 }));

function go() {
  uni.navigateTo({ url: "/pages/store/detail?id=stellarbox-s1", fail: () => {} });
}
</script>
