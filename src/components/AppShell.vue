<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  version?: string
  showActions?: boolean
}>(), {
  title: 'Nexion',
  version: 'v3.2',
  showActions: true
})
</script>

<template>
  <view class="app-shell">
    <view class="app-header">
      <view class="brand-side">
        <view class="brand-mark">N</view>
        <view class="brand-title">{{ title }}</view>
        <view v-if="version" class="brand-version">{{ version }}</view>
      </view>
      <view v-if="showActions" class="header-actions">
        <image class="header-icon" src="/src/static/icons/search.svg" mode="aspectFit" />
        <image class="header-icon" src="/src/static/icons/bell.svg" mode="aspectFit" />
      </view>
    </view>
    <slot />
  </view>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  padding: 28rpx 32rpx 48rpx;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 18% -6%, rgba(198, 255, 58, 0.12), transparent 28%),
    radial-gradient(circle at 92% 8%, rgba(88, 231, 255, 0.08), transparent 28%),
    #000000;
  color: #f8fafc;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 116rpx;
  margin-bottom: 16rpx;
}

.brand-side {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 18rpx;
}

.brand-mark {
  display: grid;
  width: 48rpx;
  height: 48rpx;
  place-items: center;
  border-radius: 14rpx;
  background: #f4f6fb;
  color: #10141d;
  font-size: 25rpx;
  font-weight: 800;
}

.brand-title {
  color: #ffffff;
  font-size: 36rpx;
  font-weight: 780;
  letter-spacing: 0;
}

.brand-version {
  margin-left: 4rpx;
  color: #6f7788;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 23rpx;
  font-weight: 560;
  letter-spacing: 1.2rpx;
  transform: translateY(2rpx);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 28rpx;
}

.header-icon {
  width: 56rpx;
  height: 56rpx;
}
</style>
