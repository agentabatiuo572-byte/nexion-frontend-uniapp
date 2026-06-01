<script setup lang="ts">
import AppShell from '@/components/AppShell.vue'
</script>

<template>
  <AppShell title="Genesis" version="" :show-actions="false">
    <view class="stub-page"><view class="stub-card genesis"><text>Genesis node</text><b>$9,999 · ~$1.5K/mo</b><p>Genesis holder access and network royalty details will appear here.</p></view></view>
  </AppShell>
</template>

<style scoped>
.stub-page { min-height: 100vh; padding: 132rpx 32rpx 80rpx; box-sizing: border-box; color: var(--v5-ink); background: var(--v5-bg); }
.stub-card { padding: 32rpx; border: 1rpx solid var(--v5-border); border-radius: 32rpx; background: var(--v5-surface); box-shadow: var(--v5-card-shadow-lift); }
.stub-card.genesis { background: radial-gradient(60% 80% at 85% 0%, rgba(212,175,90,.18), transparent 68%), var(--v5-surface); }
.stub-card text { color: #d4af5a; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22rpx; }
.stub-card b { display: block; margin-top: 14rpx; font-size: 36rpx; }
.stub-card p { margin: 10rpx 0 0; color: var(--v5-ink-3); font-size: 25rpx; line-height: 1.45; }
</style>
