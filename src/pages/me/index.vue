<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '@/components/AppShell.vue'
import { useAuthStore } from '@/store/auth'
import { requireAuth } from '@/utils/auth-guard'

const auth = useAuthStore()

onShow(() => {
  requireAuth()
})

const initial = computed(() => auth.displayName.slice(0, 1).toUpperCase())
const userId = computed(() => auth.session?.userId || '-')
const referralCode = computed(() => auth.session?.referralCode || '-')
const level = computed(() => auth.session?.userLevel || 'L0')
const vRank = computed(() => auth.session?.vRank || 'V0')

function logout() {
  uni.showModal({
    title: 'Sign out',
    content: 'Sign out of this device?',
    confirmText: 'Sign out',
    confirmColor: '#ff7b8a',
    success(result) {
      if (!result.confirm) return
      auth.logout()
      uni.reLaunch({ url: '/pages/auth/login' })
    }
  })
}

function comingSoon(label: string) {
  uni.showToast({ title: `${label} will be connected next`, icon: 'none' })
}
</script>

<template>
  <AppShell title="Me" version="">
    <scroll-view class="page" scroll-y>
      <view class="profile-row" @click="comingSoon('Profile')">
        <view class="avatar">{{ initial }}</view>
        <view class="profile-main">
          <view class="name">{{ auth.displayName }}</view>
          <view class="meta">ID {{ userId }} · {{ referralCode }}</view>
          <view class="chips">
            <text class="chip success">KYC pending</text>
            <text class="chip">Joined 1d</text>
          </view>
        </view>
      </view>

      <view class="wallet-card">
        <view class="wallet-head">
          <view>
            <view class="card-label">My wallet</view>
            <view class="wallet-balance">$0.00</view>
          </view>
          <view class="pending">pending $0.00</view>
        </view>
        <view class="wallet-actions">
          <button @click="comingSoon('Top up')">Top up</button>
          <button @click="comingSoon('Withdraw')">Withdraw</button>
          <button @click="comingSoon('Exchange')">Exchange</button>
        </view>
        <view class="wallet-strip">
          <view>
            <text>Slots open</text>
            <b>6</b>
          </view>
          <view>
            <text>NEX</text>
            <b>0</b>
          </view>
          <view>
            <text>Bills</text>
            <b>0</b>
          </view>
        </view>
      </view>

      <view class="warning-card">
        <view class="warning-icon">!</view>
        <view>
          <view>Withdrawal locked</view>
          <text>Reach the minimum balance and complete verification first.</text>
        </view>
      </view>

      <view class="network-card">
        <view class="rank-badge">{{ vRank }}</view>
        <view class="network-main">
          <view>Your rank</view>
          <text>{{ level }} · Cadet · invite users to grow team volume.</text>
        </view>
      </view>

      <view class="section-title">
        <text>My devices</text>
        <text>0 / 6</text>
      </view>
      <view class="device-entry" @click="comingSoon('Devices')">
        <view class="device-icon">▯</view>
        <view class="device-main">
          <view>Fleet status</view>
          <text>0 online · 6 slots open</text>
        </view>
        <view class="slot-bars">
          <text v-for="i in 6" :key="i" />
        </view>
      </view>

      <view class="section-title"><text>Earn extras</text></view>
      <view class="settings-card">
        <view class="setting-row" @click="comingSoon('Missions')">
          <text class="si green">★</text><text class="label">Missions</text><text class="value">Daily</text><text class="chev">›</text>
        </view>
        <view class="setting-row" @click="comingSoon('Events')">
          <text class="si orange">◆</text><text class="label">Events center</text><text class="value">9 live</text><text class="chev">›</text>
        </view>
        <view class="setting-row last" @click="comingSoon('Achievements')">
          <text class="si">🏆</text><text class="label">Achievements</text><text class="value">0 / 24</text><text class="chev">›</text>
        </view>
      </view>

      <view class="section-title"><text>Account</text></view>
      <view class="settings-card">
        <view class="setting-row" @click="comingSoon('Profile')">
          <text class="si">◎</text><text class="label">Profile</text><text class="value">{{ auth.displayName }}</text><text class="chev">›</text>
        </view>
        <view class="setting-row" @click="comingSoon('Security')">
          <text class="si">◇</text><text class="label">Identity & security</text><text class="value danger">No 2FA</text><text class="chev">›</text>
        </view>
        <view class="setting-row last" @click="comingSoon('Notifications')">
          <text class="si">◌</text><text class="label">Notifications</text><text class="value">0</text><text class="chev">›</text>
        </view>
      </view>

      <view class="section-title"><text>Preferences</text></view>
      <view class="settings-card">
        <view class="setting-row" @click="comingSoon('Preferences')">
          <text class="si">◐</text><text class="label">Preferences</text><text class="chev">›</text>
        </view>
        <view class="theme-row">
          <text class="si">☼</text>
          <text class="label">Appearance</text>
          <view class="theme-toggle">
            <button class="active">Light</button>
            <button>Dark</button>
          </view>
        </view>
        <view class="setting-row last" @click="comingSoon('Language')">
          <text class="si">◎</text><text class="label">Language</text><text class="value">EN</text><text class="chev">›</text>
        </view>
      </view>

      <view class="section-title"><text>Help</text></view>
      <view class="settings-card">
        <view class="setting-row" @click="comingSoon('Replay tour')">
          <text class="si">↻</text><text class="label">Replay tour</text><text class="chev">›</text>
        </view>
        <view class="setting-row" @click="comingSoon('Help')">
          <text class="si">?</text><text class="label">Help & FAQ</text><text class="chev">›</text>
        </view>
        <view class="setting-row last" @click="comingSoon('Support')">
          <text class="si green">●</text><text class="label">Live support</text><text class="value green">online</text><text class="chev">›</text>
        </view>
      </view>

      <button class="logout-button" @click="logout">Sign out</button>
      <view class="version">Nexion · v0.1.0 · uni-app</view>
    </scroll-view>
  </AppShell>
</template>

<style scoped>
.page {
  max-height: calc(100vh - 76rpx);
}

.profile-row {
  display: flex;
  align-items: center;
  gap: 28rpx;
  padding: 8rpx 0 18rpx;
}

.avatar {
  display: grid;
  width: 112rpx;
  height: 112rpx;
  place-items: center;
  border-radius: 50%;
  background: #c6ff3a;
  color: #10140a;
  font-size: 44rpx;
  font-weight: 760;
}

.profile-main {
  min-width: 0;
  flex: 1;
}

.name {
  overflow: hidden;
  color: #ffffff;
  font-size: 36rpx;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  margin-top: 6rpx;
  color: #99a3b3;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 24rpx;
}

.chips {
  display: flex;
  gap: 12rpx;
  margin-top: 12rpx;
}

.chip {
  padding: 5rpx 14rpx;
  border: 1rpx solid #303746;
  border-radius: 8rpx;
  background: #161b25;
  color: #c8d0dc;
  font-size: 21rpx;
}

.chip.success {
  border-color: rgba(18, 201, 121, 0.3);
  background: rgba(18, 201, 121, 0.1);
  color: #12c979;
}

.wallet-card,
.network-card,
.device-entry,
.settings-card,
.warning-card {
  border: 1rpx solid #232936;
  border-radius: 32rpx;
  background: #10141d;
}

.wallet-card {
  position: relative;
  overflow: hidden;
  padding: 34rpx;
}

.wallet-card::before {
  position: absolute;
  right: -80rpx;
  bottom: -100rpx;
  width: 280rpx;
  height: 280rpx;
  border-radius: 50%;
  background: rgba(198, 255, 58, 0.1);
  content: "";
}

.wallet-head {
  position: relative;
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
}

.card-label {
  color: #8f98a8;
  font-size: 24rpx;
}

.wallet-balance {
  margin-top: 8rpx;
  color: #ffffff;
  font-size: 64rpx;
  font-weight: 780;
  letter-spacing: -2rpx;
}

.pending {
  color: #99a3b3;
  font-size: 23rpx;
}

.wallet-actions {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
  margin-top: 28rpx;
}

.wallet-actions button {
  height: 76rpx;
  border-radius: 999rpx;
  background: #c6ff3a;
  color: #10140a;
  font-size: 24rpx;
  font-weight: 700;
}

.wallet-actions button::after,
.wallet-actions uni-button::after,
.logout-button::after,
uni-button.logout-button::after,
.theme-toggle button::after,
.theme-toggle uni-button::after {
  border: 0;
}

.wallet-strip {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
  margin-top: 24rpx;
}

.wallet-strip view {
  padding: 18rpx;
  border-radius: 20rpx;
  background: #161b25;
}

.wallet-strip text {
  display: block;
  color: #8f98a8;
  font-size: 21rpx;
}

.wallet-strip b {
  display: block;
  margin-top: 8rpx;
  color: #c6ff3a;
  font-size: 30rpx;
}

.warning-card {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  margin-top: 22rpx;
  padding: 24rpx 28rpx;
  border-color: rgba(255, 123, 138, 0.28);
  background: rgba(255, 123, 138, 0.08);
}

.warning-icon {
  display: grid;
  width: 38rpx;
  height: 38rpx;
  place-items: center;
  border-radius: 50%;
  background: #ff7b8a;
  color: #16090c;
  font-weight: 800;
}

.warning-card view view {
  color: #ffffff;
  font-size: 25rpx;
  font-weight: 700;
}

.warning-card text {
  display: block;
  margin-top: 6rpx;
  color: #ffb3bc;
  font-size: 22rpx;
}

.network-card,
.device-entry {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-top: 22rpx;
  padding: 28rpx 32rpx;
}

.rank-badge,
.device-icon {
  display: grid;
  width: 80rpx;
  height: 80rpx;
  place-items: center;
  border-radius: 50%;
  background: #c6ff3a;
  color: #10140a;
  font-size: 32rpx;
  font-weight: 800;
}

.network-main,
.device-main {
  min-width: 0;
  flex: 1;
}

.network-main view,
.device-main view {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
}

.network-main text,
.device-main text {
  display: block;
  margin-top: 8rpx;
  color: #8f98a8;
  font-size: 22rpx;
  line-height: 1.4;
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

.section-title text:last-child {
  color: #8f98a8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 22rpx;
  font-weight: 400;
}

.device-icon {
  border-radius: 22rpx;
  background: rgba(18, 201, 121, 0.12);
  color: #12c979;
}

.slot-bars {
  display: flex;
  gap: 7rpx;
}

.slot-bars text {
  width: 9rpx;
  height: 36rpx;
  border-radius: 4rpx;
  background: #303746;
}

.settings-card {
  overflow: hidden;
  padding: 0 28rpx;
}

.setting-row,
.theme-row {
  display: flex;
  min-height: 104rpx;
  align-items: center;
  gap: 22rpx;
  border-bottom: 1rpx solid #232936;
}

.setting-row.last,
.settings-card .last {
  border-bottom: 0;
}

.si {
  display: grid;
  width: 60rpx;
  height: 60rpx;
  place-items: center;
  border: 1rpx solid #303746;
  border-radius: 18rpx;
  background: #161b25;
  color: #c8d0dc;
  font-size: 25rpx;
}

.si.green,
.value.green {
  color: #12c979;
}

.si.orange {
  color: #ff8d4a;
}

.label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #ffffff;
  font-size: 27rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.value {
  max-width: 240rpx;
  overflow: hidden;
  color: #99a3b3;
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.value.danger {
  color: #ff7b8a;
}

.chev {
  color: #5f6877;
  font-size: 34rpx;
}

.theme-toggle {
  display: flex;
  gap: 4rpx;
  padding: 6rpx;
  border-radius: 999rpx;
  background: #161b25;
}

.theme-toggle button {
  height: 56rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  background: transparent;
  color: #8f98a8;
  font-size: 23rpx;
}

.theme-toggle button.active {
  background: #10141d;
  color: #ffffff;
  font-weight: 700;
}

.logout-button {
  display: flex;
  height: 88rpx;
  align-items: center;
  justify-content: center;
  margin-top: 32rpx;
  border: 1rpx solid rgba(255, 123, 138, 0.25);
  border-radius: 24rpx;
  background: #10141d;
  color: #ff7b8a;
  font-size: 28rpx;
  font-weight: 700;
}

.version {
  margin: 32rpx 0 16rpx;
  text-align: center;
  color: #5f6877;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 22rpx;
}
</style>
