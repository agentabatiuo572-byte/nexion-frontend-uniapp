<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '@/components/AppShell.vue'
import { requireAuth } from '@/utils/auth-guard'
import { getMainPageMessages, useActiveLocale } from '@/utils/i18n'

const locale = useActiveLocale()
const t = computed(() => getMainPageMessages(locale.value).earn)

onShow(() => {
  requireAuth()
})
</script>

<template>
  <AppShell :title="t.title" version="" active-tab="earn">
    <scroll-view class="page" scroll-y>
      <view class="hero-card">
        <view class="hero-kicker">{{ t.kicker }}</view>
        <view class="hero-title">{{ t.heroTitle }}</view>
        <view class="hero-sub">{{ t.heroSub }}</view>
        <view class="earning-row">
          <view>
            <text>{{ t.today }}</text>
            <b>$0.06</b>
          </view>
          <view>
            <text>{{ t.uptime }}</text>
            <b>98%</b>
          </view>
          <view>
            <text>{{ t.tasks }}</text>
            <b>12</b>
          </view>
        </view>
      </view>

      <view class="section-title">
        <text>{{ t.liveTask }}</text>
        <text>{{ t.mobileNpu }}</text>
      </view>
      <view class="task-card">
        <view class="task-head">
          <view class="pulse" />
          <view>
            <view class="task-name">{{ t.taskName }}</view>
            <text>{{ t.taskDesc }}</text>
          </view>
          <view class="task-pay">+$0.0003</view>
        </view>
        <view class="track"><view /></view>
      </view>

      <view class="section-title">
        <text>{{ t.upgradeGap }}</text>
        <text>{{ t.vsPhone }}</text>
      </view>
      <view class="compare-card">
        <view class="bar-row">
          <text>{{ t.yourPhone }}</text>
          <view class="bar small" />
          <b>$0.06/d</b>
        </view>
        <view class="bar-row strong">
          <text>NexionBox S1</text>
          <view class="bar full" />
          <b>$38.50/d</b>
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
.task-card,
.compare-card {
  margin-top: 24rpx;
  border: 1rpx solid #232936;
  border-radius: 32rpx;
  background: #10141d;
}

.hero-card {
  overflow: hidden;
  padding: 34rpx;
  background:
    radial-gradient(circle at 10% 90%, rgba(255, 122, 61, 0.16), transparent 40%),
    radial-gradient(circle at 88% 12%, rgba(88, 231, 255, 0.14), transparent 34%),
    #10141d;
}

.hero-kicker,
.section-title,
.earning-row text,
.task-head text {
  color: #8f98a8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 23rpx;
}

.hero-title {
  margin-top: 18rpx;
  color: #ffffff;
  font-size: 52rpx;
  font-weight: 760;
  line-height: 1.1;
}

.hero-sub {
  margin-top: 14rpx;
  color: #99a3b3;
  font-size: 26rpx;
  line-height: 1.45;
}

.earning-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18rpx;
  margin-top: 34rpx;
}

.earning-row view {
  padding: 22rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.05);
}

.earning-row b {
  display: block;
  margin-top: 8rpx;
  color: #c6ff3a;
  font-size: 30rpx;
}

.section-title {
  display: flex;
  justify-content: space-between;
  margin-top: 32rpx;
}

.task-card,
.compare-card {
  padding: 28rpx;
}

.task-head {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.pulse {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: #c6ff3a;
  box-shadow: 0 0 30rpx rgba(198, 255, 58, 0.45);
}

.task-name {
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 720;
}

.task-pay {
  margin-left: auto;
  color: #12c979;
  font-weight: 760;
}

.track {
  height: 12rpx;
  margin-top: 28rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: #242a35;
}

.track view {
  width: 72%;
  height: 100%;
  border-radius: inherit;
  background: #c6ff3a;
}

.bar-row {
  display: grid;
  grid-template-columns: 150rpx 1fr 120rpx;
  align-items: center;
  gap: 18rpx;
  margin-top: 18rpx;
  color: #99a3b3;
  font-size: 24rpx;
}

.bar-row:first-child {
  margin-top: 0;
}

.bar-row b {
  color: #ffffff;
  text-align: right;
}

.bar {
  height: 14rpx;
  border-radius: 999rpx;
  background: #242a35;
}

.bar.small::after,
.bar.full::after {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #c6ff3a;
  content: "";
}

.bar.small::after { width: 8%; }
.bar.full::after { width: 100%; }
.strong text,
.strong b { color: #c6ff3a; }
</style>
