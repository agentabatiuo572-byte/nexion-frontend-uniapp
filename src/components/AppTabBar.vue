<script setup lang="ts">
import { computed } from 'vue'
import { getTabMessages, useActiveLocale } from '@/utils/i18n'

type TabKey = 'home' | 'earn' | 'store' | 'team' | 'me'

defineProps<{
  active: TabKey
}>()

const locale = useActiveLocale()
const labels = computed(() => getTabMessages(locale.value))
const tabs = computed<Array<{ key: TabKey; label: string; path: string; icon: string }>>(() => [
  { key: 'home', label: labels.value.home, path: '/pages/home/index', icon: '/src/static/icons/tab-home.svg' },
  { key: 'earn', label: labels.value.earn, path: '/pages/earn/index', icon: '/src/static/icons/tab-zap.svg' },
  { key: 'store', label: labels.value.store, path: '/pages/store/index', icon: '/src/static/icons/tab-bag.svg' },
  { key: 'team', label: labels.value.team, path: '/pages/team/index', icon: '/src/static/icons/tab-users.svg' },
  { key: 'me', label: labels.value.me, path: '/pages/me/index', icon: '/src/static/icons/tab-user.svg' }
])

function go(path: string) {
  uni.reLaunch({ url: path })
}
</script>

<template>
  <view class="tab-host">
    <view class="tab-pill">
      <view class="specular" />
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-item"
        :class="{ active: tab.key === active }"
        @click="go(tab.path)"
      >
        <view class="icon-mask" :style="{ '-webkit-mask-image': `url(${tab.icon})`, maskImage: `url(${tab.icon})` }" />
        <text>{{ tab.label }}</text>
      </view>
    </view>
    <view class="home-indicator" />
  </view>
</template>

<style scoped>
.tab-host {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 60;
  padding: 0 24rpx 10rpx;
  pointer-events: none;
}

.tab-pill {
  position: relative;
  display: flex;
  align-items: stretch;
  overflow: visible;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  pointer-events: auto;
}

.specular {
  display: none;
}

.tab-item {
  position: relative;
  display: flex;
  min-width: 0;
  height: 96rpx;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  padding: 0;
  border-radius: 24rpx;
  background: transparent;
  color: rgba(222, 229, 240, 0.72);
  font-size: 24rpx;
  font-weight: 560;
  line-height: 1;
}

.tab-item.active {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.26) 0%, rgba(255, 255, 255, 0.08) 100%),
    rgba(255, 255, 255, 0.04);
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  box-shadow:
    inset 0 1rpx 0 rgba(255, 255, 255, 0.30),
    0 8rpx 24rpx rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(42rpx) saturate(230%) brightness(1.2);
  -webkit-backdrop-filter: blur(42rpx) saturate(230%) brightness(1.2);
  color: #c6ff3a;
}

.icon-mask {
  width: 44rpx;
  height: 44rpx;
  background: currentColor;
  transform: translateY(-1rpx);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.home-indicator {
  width: 268rpx;
  height: 10rpx;
  margin: 10rpx auto 0;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.86);
}
</style>
