<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '@/components/AppShell.vue'
import { requireAuth } from '@/utils/auth-guard'
import { getMainPageMessages, useActiveLocale } from '@/utils/i18n'

const locale = useActiveLocale()
const t = computed(() => getMainPageMessages(locale.value).store)

onShow(() => {
  requireAuth()
})

const products = computed(() => [
  { name: 'NexionBox S1', price: '$299', daily: '$38.50/d', tag: t.value.starter },
  { name: 'NexionBox Pro', price: '$899', daily: '$128/d', tag: t.value.popular },
  { name: 'NexionRack P1', price: '$3,499', daily: '$480/d', tag: t.value.scale }
])
</script>

<template>
  <AppShell :title="t.title" version="" active-tab="store">
    <scroll-view class="page" scroll-y>
      <view class="hero-card">
        <view class="hero-kicker">{{ t.kicker }}</view>
        <view class="hero-title">{{ t.heroTitle }}</view>
        <view class="hero-sub">{{ t.heroSub }}</view>
      </view>

      <view class="filter-row">
        <text class="active">{{ t.hardware }}</text>
        <text>{{ t.cloudShare }}</text>
        <text>{{ t.genesis }}</text>
      </view>

      <view v-for="item in products" :key="item.name" class="product-card">
        <view class="product-art">
          <view class="device-face">
            <text />
            <text />
            <text />
          </view>
        </view>
        <view class="product-main">
          <view class="product-top">
            <view>
              <view class="product-name">{{ item.name }}</view>
              <text>{{ item.tag }} · {{ t.managedDeployment }}</text>
            </view>
            <view class="price">{{ item.price }}</view>
          </view>
          <view class="product-stats">
            <view>
              <text>{{ t.estimatedDaily }}</text>
              <b>{{ item.daily }}</b>
            </view>
            <view>
              <text>{{ t.payback }}</text>
              <b>{{ t.months }}</b>
            </view>
            <view>
              <text>{{ t.slot }}</text>
              <b>1</b>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </AppShell>
</template>

<style scoped>
.page {
  max-height: calc(100vh - 260rpx);
}

.hero-card,
.product-card {
  margin-top: 24rpx;
  border: 1rpx solid #232936;
  border-radius: 32rpx;
  background: #10141d;
}

.hero-card {
  padding: 34rpx;
  background:
    radial-gradient(circle at 88% 8%, rgba(198, 255, 58, 0.14), transparent 34%),
    radial-gradient(circle at 6% 88%, rgba(155, 137, 224, 0.18), transparent 38%),
    #10141d;
}

.hero-kicker {
  color: #c6ff3a;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 23rpx;
}

.hero-title {
  margin-top: 18rpx;
  color: #ffffff;
  font-size: 50rpx;
  font-weight: 760;
  line-height: 1.1;
}

.hero-sub {
  margin-top: 14rpx;
  color: #99a3b3;
  font-size: 26rpx;
}

.filter-row {
  display: flex;
  gap: 16rpx;
  margin-top: 28rpx;
}

.filter-row text {
  padding: 14rpx 22rpx;
  border: 1rpx solid #232936;
  border-radius: 999rpx;
  color: #99a3b3;
  font-size: 24rpx;
}

.filter-row .active {
  border-color: rgba(198, 255, 58, 0.42);
  background: rgba(198, 255, 58, 0.08);
  color: #c6ff3a;
}

.product-card {
  display: flex;
  gap: 24rpx;
  padding: 24rpx;
}

.product-art {
  display: grid;
  width: 148rpx;
  height: 148rpx;
  place-items: center;
  border-radius: 28rpx;
  background: radial-gradient(circle at 30% 20%, rgba(198, 255, 58, 0.18), transparent 52%), #0b0d13;
}

.device-face {
  width: 84rpx;
  height: 108rpx;
  padding: 14rpx;
  border: 1rpx solid #3a4251;
  border-radius: 18rpx;
  background: #151a23;
}

.device-face text {
  display: block;
  height: 10rpx;
  margin-top: 14rpx;
  border-radius: 999rpx;
  background: #c6ff3a;
}

.product-main {
  min-width: 0;
  flex: 1;
}

.product-top {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
}

.product-name,
.price {
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 740;
}

.product-top text {
  display: block;
  margin-top: 8rpx;
  color: #8f98a8;
  font-size: 23rpx;
}

.price {
  color: #c6ff3a;
}

.product-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 24rpx;
}

.product-stats view {
  padding: 14rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.05);
}

.product-stats text {
  color: #8f98a8;
  font-size: 20rpx;
}

.product-stats b {
  display: block;
  margin-top: 6rpx;
  color: #ffffff;
  font-size: 23rpx;
}
</style>
