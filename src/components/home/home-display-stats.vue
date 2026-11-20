<template>
  <view class="home-display-stats">
    <view class="home-display-item">
      <view class="home-display-dot" />
      <text class="home-display-number">{{ value ? value.online.toLocaleString('en-US') : '—' }}</text>
      <text>{{ t.intro.statsDevices }}</text>
    </view>
    <view class="home-display-separator" />
    <view class="home-display-item">
      <text class="home-display-number home-display-number--brand">{{ value ? `$${formatGroupedAmount(value.paid)}` : '—' }}</text>
      <text>{{ t.intro.statsPaidTotal }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useHomeDisplay } from "@/composables/use-home-display";
import { useT } from "@/i18n/use-t";
import { formatGroupedAmount } from "@/lib/amount-display";

const props = defineProps<{ active: boolean }>();
const t = useT();
const value = useHomeDisplay(() => props.active);
</script>

<style scoped>
.home-display-stats { display: inline-flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 20px; padding: 9px 16px; border-radius: 999px; background: var(--v5-surface); font-size: 12px; line-height: 1.5; color: var(--v5-ink-3); }
.home-display-item { display: flex; align-items: center; gap: 6px; }
.home-display-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--v5-brand); }
.home-display-number { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--v5-ink); }
.home-display-number--brand { color: var(--v5-brand); }
.home-display-separator { height: 12px; border-left: 1px solid var(--v5-border-strong); }
</style>
