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

const firstName = computed(() => (auth.displayName || 'Stellar').split(/\s+/)[0] || 'Stellar')
const level = computed(() => auth.session?.userLevel || 'L0')
const vRank = computed(() => auth.session?.vRank || 'V0')
const referralCode = computed(() => auth.session?.referralCode || 'NXN-READY')
const copy = computed(() => getMainPageMessages(locale.value))
const t = computed(() => copy.value.home)
const common = computed(() => copy.value.common)

function comingSoon(label: string) {
  uni.showToast({ title: common.value.comingSoon(label), icon: 'none' })
}
</script>

<template>
  <AppShell active-tab="home">
    <scroll-view class="page" scroll-y>
      <view class="greeting">
        <view class="hello">{{ t.goodDay }}, {{ firstName }}</view>
        <view class="headline">
          {{ t.headlinePrefix }} <text>$0.06</text>{{ t.headlineSuffix }}
        </view>
      </view>

      <view class="money-card">
        <view class="card-top">
          <view>
            <view class="kicker">{{ t.earnings }}</view>
            <view class="balance">$0.000300</view>
          </view>
          <view class="live-chip"><text /> {{ t.live }}</view>
        </view>
        <view class="mini-grid">
          <view>
            <text class="mini-label">{{ t.pending }}</text>
            <text class="mini-value">$0.00</text>
          </view>
          <view>
            <text class="mini-label">NEX</text>
            <text class="mini-value">0</text>
          </view>
          <view>
            <text class="mini-label">{{ t.rank }}</text>
            <text class="mini-value">{{ vRank }}</text>
          </view>
        </view>
      </view>

      <view class="trial-card" @click="comingSoon(t.freeTrial)">
        <view class="trial-left">
          <view class="ticket-badge">{{ t.freeTrial }}</view>
          <view class="trial-title">{{ t.cloudShare }}</view>
          <view class="trial-desc">{{ t.trialDesc }}</view>
        </view>
        <view class="trial-right">
          <view class="trial-small">{{ t.earnUpTo }}</view>
          <view class="trial-money">$38</view>
        </view>
      </view>

      <view class="day-card">
        <view class="day-row">
          <view>
            <view class="kicker">{{ t.firstDayReward }}</view>
            <view class="reward">+500 <text>NEX</text></view>
          </view>
          <view class="countdown">
            <view class="kicker">{{ t.endsIn }}</view>
            <view>18:24:00</view>
          </view>
        </view>
        <view class="progress-track"><view class="progress-bar" /></view>
        <view class="task-list">
          <view class="task done"><text>✓</text> {{ t.connectWallet }} <b>+50</b></view>
          <view class="task done"><text>✓</text> {{ t.visitEarn }} <b>+30</b></view>
          <view class="task"><text>3</text> {{ t.seeProductRoi }} <b>+100</b></view>
        </view>
      </view>

      <view class="quick-grid">
        <button @click="comingSoon(t.store)">
          <text class="q-icon">□</text>
          <text>{{ t.store }}</text>
        </button>
        <button @click="comingSoon(t.devices)">
          <text class="q-icon">▣</text>
          <text>{{ t.devices }}</text>
        </button>
        <button @click="comingSoon(t.wallet)">
          <text class="q-icon">↧</text>
          <text>{{ t.wallet }}</text>
        </button>
        <button @click="comingSoon(t.team)">
          <text class="q-icon">◇</text>
          <text>{{ t.team }}</text>
        </button>
      </view>

      <view class="section-title">
        <text>{{ t.myFleet }}</text>
        <text class="section-count">{{ t.activeSlots }}</text>
      </view>
      <view class="fleet-card">
        <view class="device-icon">▯</view>
        <view class="fleet-main">
          <view>{{ t.gridSlots }}</view>
          <text>{{ t.gridSlotsDesc }}</text>
        </view>
        <view class="slots">
          <text v-for="i in 6" :key="i" />
        </view>
      </view>

      <view class="section-title">
        <text>{{ t.yourRank }}</text>
        <text class="section-count">{{ level }} · {{ vRank }}</text>
      </view>
      <view class="rank-card">
        <view class="rank-circle">{{ vRank }}</view>
        <view class="rank-main">
          <view class="rank-name">{{ common.rankCadet }}</view>
          <text>{{ t.rankDesc.replace('{code}', referralCode) }}</text>
        </view>
      </view>

      <view class="trust-card">
        <view class="trust-title">{{ t.audited }}</view>
        <view class="trust-tags">
          <text>NVIDIA</text>
          <text>Intel</text>
          <text>AMD</text>
          <text>SOC 2</text>
        </view>
      </view>
    </scroll-view>
  </AppShell>
</template>

<style scoped>
.page {
  max-height: calc(100vh - 260rpx);
}

.greeting {
  padding: 8rpx 4rpx 10rpx;
}

.hello {
  color: #99a3b3;
  font-size: 27rpx;
}

.headline {
  margin-top: 8rpx;
  color: #ffffff;
  font-size: 52rpx;
  font-weight: 760;
  letter-spacing: -1rpx;
  line-height: 1.12;
}

.headline text {
  color: #12c979;
}

.money-card,
.day-card,
.fleet-card,
.rank-card,
.trust-card {
  margin-top: 24rpx;
  border: 1rpx solid #232936;
  border-radius: 32rpx;
  background: #10141d;
}

.money-card {
  position: relative;
  overflow: hidden;
  padding: 34rpx;
}

.money-card::before {
  position: absolute;
  right: -60rpx;
  top: -80rpx;
  width: 260rpx;
  height: 260rpx;
  border-radius: 50%;
  background: rgba(198, 255, 58, 0.11);
  content: "";
}

.card-top,
.day-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.kicker {
  color: #8f98a8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 23rpx;
}

.balance {
  margin-top: 10rpx;
  color: #ffffff;
  font-size: 64rpx;
  font-weight: 780;
  letter-spacing: -2rpx;
}

.live-chip {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(88, 231, 255, 0.12);
  color: #58e7ff;
  font-size: 22rpx;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.live-chip text {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #58e7ff;
}

.mini-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-top: 34rpx;
}

.mini-grid view {
  display: flex;
  min-height: 112rpx;
  flex-direction: column;
  justify-content: center;
  padding: 0 22rpx;
  border-radius: 24rpx;
  background: #161b25;
}

.mini-label {
  color: #8f98a8;
  font-size: 22rpx;
}

.mini-value {
  margin-top: 10rpx;
  color: #c6ff3a;
  font-size: 32rpx;
  font-weight: 760;
}

.trial-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 28rpx;
  align-items: center;
  margin-top: 24rpx;
  padding: 30rpx 34rpx;
  border-radius: 32rpx;
  background:
    radial-gradient(circle at 0 100%, rgba(18, 201, 121, 0.12), transparent 58%),
    #10141d;
}

.ticket-badge {
  display: inline-flex;
  padding: 6rpx 14rpx;
  border: 1rpx dashed rgba(18, 201, 121, 0.45);
  border-radius: 8rpx;
  color: #12c979;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 19rpx;
  letter-spacing: 2rpx;
}

.trial-title {
  margin-top: 16rpx;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 760;
}

.trial-desc {
  margin-top: 8rpx;
  color: #99a3b3;
  font-size: 24rpx;
  line-height: 1.45;
}

.trial-right {
  text-align: right;
}

.trial-small {
  color: #8f98a8;
  font-size: 20rpx;
}

.trial-money {
  margin-top: 10rpx;
  color: #12c979;
  font-size: 54rpx;
  font-weight: 760;
}

.day-card {
  padding: 32rpx 34rpx;
}

.reward {
  margin-top: 8rpx;
  color: #ffffff;
  font-size: 58rpx;
  font-weight: 760;
}

.reward text {
  color: #c6ff3a;
  font-size: 25rpx;
}

.countdown {
  text-align: right;
  color: #9b89e0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 31rpx;
}

.progress-track {
  height: 16rpx;
  margin-top: 28rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: #242a35;
}

.progress-bar {
  width: 50%;
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, #c6ff3a, #58e7ff);
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 24rpx;
  padding-top: 22rpx;
  border-top: 1rpx dashed #303746;
}

.task {
  display: flex;
  align-items: center;
  gap: 14rpx;
  color: #d7dce6;
  font-size: 25rpx;
}

.task text {
  display: grid;
  width: 34rpx;
  height: 34rpx;
  place-items: center;
  border: 1rpx solid rgba(198, 255, 58, 0.35);
  border-radius: 50%;
  color: #c6ff3a;
  font-size: 20rpx;
}

.task.done text {
  background: #c6ff3a;
  color: #10140a;
}

.task b {
  margin-left: auto;
  color: #c6ff3a;
  font-weight: 700;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
  margin-top: 24rpx;
}

.quick-grid button {
  display: flex;
  height: 128rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  border: 1rpx solid #232936;
  border-radius: 28rpx;
  background: #10141d;
  color: #d7dce6;
  font-size: 23rpx;
}

.quick-grid button::after,
.quick-grid uni-button::after {
  border: 0;
}

.q-icon {
  color: #c6ff3a;
  font-size: 32rpx;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 42rpx 4rpx 18rpx;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 700;
}

.section-count {
  color: #8f98a8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 22rpx;
  font-weight: 400;
}

.fleet-card,
.rank-card {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 24rpx;
  padding: 28rpx 32rpx;
}

.device-icon,
.rank-circle {
  display: grid;
  width: 80rpx;
  height: 80rpx;
  place-items: center;
  border-radius: 22rpx;
  background: rgba(18, 201, 121, 0.12);
  color: #12c979;
  font-size: 34rpx;
  font-weight: 760;
}

.fleet-main view,
.rank-name {
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 700;
}

.fleet-main text,
.rank-main text {
  display: block;
  margin-top: 8rpx;
  color: #8f98a8;
  font-size: 22rpx;
}

.slots {
  display: flex;
  gap: 8rpx;
}

.slots text {
  width: 10rpx;
  height: 36rpx;
  border-radius: 4rpx;
  background: #303746;
}

.rank-card {
  grid-template-columns: auto 1fr;
}

.rank-circle {
  border-radius: 50%;
  background: #c6ff3a;
  color: #10140a;
}

.trust-card {
  margin-bottom: 24rpx;
  padding: 28rpx 32rpx;
}

.trust-title {
  color: #d7dce6;
  font-size: 25rpx;
  font-weight: 700;
}

.trust-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.trust-tags text {
  padding: 8rpx 16rpx;
  border: 1rpx solid #303746;
  border-radius: 999rpx;
  background: #161b25;
  color: #c8d0dc;
  font-size: 22rpx;
}
</style>
