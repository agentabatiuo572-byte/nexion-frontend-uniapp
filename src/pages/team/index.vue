<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '@/components/AppShell.vue'
import { useAuthStore } from '@/store/auth'
import { requireAuth } from '@/utils/auth-guard'
import { getMainPageMessages, useActiveLocale } from '@/utils/i18n'

const auth = useAuthStore()
const locale = useActiveLocale()

onShow(() => {
  requireAuth()
})

const vRank = computed(() => auth.session?.vRank || 'V0')
const referralCode = computed(() => auth.session?.referralCode || 'NXN-READY')
const copy = computed(() => getMainPageMessages(locale.value))
const t = computed(() => copy.value.team)
const common = computed(() => copy.value.common)
</script>

<template>
  <AppShell :title="t.title" version="" active-tab="team">
    <scroll-view class="page" scroll-y>
      <view class="hero-card">
        <view class="hero-kicker">{{ t.kicker }}</view>
        <view class="hero-title">{{ t.heroTitle }}</view>
        <view class="invite-code">{{ referralCode }}</view>
      </view>

      <view class="rank-card">
        <view class="rank-badge">{{ vRank }}</view>
        <view class="rank-main">
          <view>{{ common.rankCadet }}</view>
          <text>{{ t.rankDesc }}</text>
        </view>
        <view class="rank-progress">
          <view />
        </view>
      </view>

      <view class="metrics">
        <view>
          <text>{{ t.members }}</text>
          <b>0</b>
        </view>
        <view>
          <text>{{ t.direct }}</text>
          <b>0</b>
        </view>
        <view>
          <text>{{ t.month }}</text>
          <b>$0</b>
        </view>
      </view>

      <view class="section-title">
        <text>{{ t.networkTools }}</text>
        <text>v3.2</text>
      </view>
      <view class="tool-grid">
        <view>
          <b>{{ t.influence }}</b>
          <text>{{ t.influenceDesc }}</text>
        </view>
        <view>
          <b>{{ t.binaryMatch }}</b>
          <text>{{ t.binaryMatchDesc }}</text>
        </view>
        <view>
          <b>{{ t.leadershipPool }}</b>
          <text>{{ t.leadershipPoolDesc }}</text>
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
.rank-card,
.metrics view,
.tool-grid view {
  border: 1rpx solid #232936;
  border-radius: 32rpx;
  background: #10141d;
}

.hero-card {
  margin-top: 24rpx;
  padding: 34rpx;
  background:
    radial-gradient(circle at 10% 20%, rgba(198, 255, 58, 0.12), transparent 36%),
    radial-gradient(circle at 92% 84%, rgba(88, 231, 255, 0.14), transparent 40%),
    #10141d;
}

.hero-kicker,
.section-title,
.metrics text,
.tool-grid text,
.rank-main text {
  color: #8f98a8;
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

.invite-code {
  display: inline-flex;
  margin-top: 28rpx;
  padding: 14rpx 20rpx;
  border-radius: 16rpx;
  background: rgba(198, 255, 58, 0.12);
  color: #c6ff3a;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 24rpx;
  font-weight: 700;
}

.rank-card {
  display: flex;
  align-items: center;
  gap: 22rpx;
  margin-top: 24rpx;
  padding: 28rpx;
}

.rank-badge {
  display: grid;
  width: 86rpx;
  height: 86rpx;
  place-items: center;
  border-radius: 28rpx;
  background: rgba(198, 255, 58, 0.12);
  color: #c6ff3a;
  font-weight: 780;
}

.rank-main {
  min-width: 0;
  flex: 1;
}

.rank-main view {
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 730;
}

.rank-progress {
  width: 96rpx;
  height: 12rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: #242a35;
}

.rank-progress view {
  width: 18%;
  height: 100%;
  background: #c6ff3a;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18rpx;
  margin-top: 24rpx;
}

.metrics view {
  padding: 24rpx;
}

.metrics b {
  display: block;
  margin-top: 8rpx;
  color: #ffffff;
  font-size: 34rpx;
}

.section-title {
  display: flex;
  justify-content: space-between;
  margin-top: 32rpx;
}

.tool-grid {
  display: grid;
  gap: 18rpx;
  margin-top: 18rpx;
}

.tool-grid view {
  padding: 28rpx;
}

.tool-grid b {
  display: block;
  color: #ffffff;
  font-size: 29rpx;
  margin-bottom: 8rpx;
}
</style>
