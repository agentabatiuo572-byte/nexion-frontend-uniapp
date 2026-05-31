<script setup lang="ts">
import { nextTick, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppTabBar from '@/components/AppTabBar.vue'

const props = withDefaults(defineProps<{
  title?: string
  version?: string
  showActions?: boolean
  activeTab?: 'home' | 'earn' | 'store' | 'team' | 'me'
}>(), {
  title: 'Nexion',
  version: 'v3.2',
  showActions: true,
  activeTab: undefined
})

function hideNativeTabBar() {
  if (!props.activeTab) return
  uni.hideTabBar({ animation: false, fail: () => undefined })
}

function hideNativeTabBarStable() {
  hideNativeTabBar()
  nextTick(hideNativeTabBar)
  setTimeout(hideNativeTabBar, 80)
  setTimeout(hideNativeTabBar, 240)
}

onMounted(hideNativeTabBarStable)
onShow(hideNativeTabBarStable)
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
    <view class="app-content">
      <slot />
    </view>
    <AppTabBar v-if="activeTab" :active="activeTab" />
  </view>
</template>

<style scoped>
.app-shell {
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  padding: 0;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 18% -6%, rgba(198, 255, 58, 0.12), transparent 28%),
    radial-gradient(circle at 92% 8%, rgba(88, 231, 255, 0.08), transparent 28%),
    #000000;
  color: #f8fafc;
}

.app-header {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 116rpx;
  padding: 28rpx 32rpx 16rpx;
  box-sizing: border-box;
  border-bottom: 0;
  background:
    radial-gradient(56% 120% at 82% 42%, rgba(255, 122, 61, 0.10), transparent 62%),
    radial-gradient(50% 110% at 16% 45%, rgba(158, 220, 29, 0.08), transparent 64%),
    linear-gradient(180deg, rgba(0, 0, 0, 0.82) 0%, rgba(0, 0, 0, 0.58) 68%, rgba(0, 0, 0, 0.20) 100%);
  backdrop-filter: blur(64rpx) saturate(210%) brightness(1.06);
  -webkit-backdrop-filter: blur(64rpx) saturate(210%) brightness(1.06);
  box-shadow: none;
}

.app-content {
  min-height: 100vh;
  padding: 0 32rpx;
  box-sizing: border-box;
}

.app-content :deep(.page) {
  height: 100vh;
  max-height: 100vh !important;
  padding-top: 152rpx;
  padding-bottom: 132rpx;
  box-sizing: border-box;
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
