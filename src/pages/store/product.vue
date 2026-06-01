<script setup lang="ts">
import AppShell from '@/components/AppShell.vue'
</script>

<template>
  <AppShell title="Product" version="" :show-actions="false">
    <view class="stub-page">
      <view class="stub-card">
        <text>Product detail</text>
        <b>Nexion hardware</b>
        <p>Detailed specs, ROI, eligibility, and checkout entry live here.</p>
      </view>
    </view>
  </AppShell>
</template>

<style scoped>
.stub-page { min-height: 100vh; padding: 132rpx 32rpx 80rpx; box-sizing: border-box; color: var(--v5-ink); background: var(--v5-bg); }
.stub-card { padding: 32rpx; border: 1rpx solid var(--v5-border); border-radius: 32rpx; background: var(--v5-surface); box-shadow: var(--v5-card-shadow-lift); }
.stub-card text { color: var(--v5-brand); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22rpx; }
.stub-card b { display: block; margin-top: 14rpx; font-size: 36rpx; }
.stub-card p { margin: 10rpx 0 0; color: var(--v5-ink-3); font-size: 25rpx; line-height: 1.45; }
</style>
