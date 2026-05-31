<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '@/components/AppShell.vue'
import { useAuthStore } from '@/store/auth'
import { requireAuth } from '@/utils/auth-guard'
import {
  LOCALES,
  getIntroMessages,
  getLocaleEntry,
  getMeMessages,
  getPriorityLabels,
  setStoredLocale,
  useActiveLocale,
  type LocaleCode
} from '@/utils/i18n'

const auth = useAuthStore()
const locale = useActiveLocale()
const localeOpen = ref(false)

onShow(() => {
  requireAuth()
})

const initial = computed(() => auth.displayName.slice(0, 1).toUpperCase())
const userId = computed(() => auth.session?.userId || '-')
const referralCode = computed(() => auth.session?.referralCode || '-')
const level = computed(() => auth.session?.userLevel || 'L0')
const vRank = computed(() => auth.session?.vRank || 'V0')
const currentLocale = computed(() => getLocaleEntry(locale.value))
const languageSheetCopy = computed(() => getIntroMessages(locale.value))
const m = computed(() => getMeMessages(locale.value))
const priorityLabels = computed(() => getPriorityLabels(locale.value))
const walletTitle = computed(() => (locale.value === 'zh' ? m.value.walletTitle : 'My Wallet'))
const quickActionsLabel = computed(() => (locale.value === 'zh' ? '快捷操作' : 'Quick actions'))
const usdtBalanceLabel = computed(() => (locale.value === 'zh' ? 'USDT 余额' : 'USDT balance'))
const nexBalanceLabel = computed(() => (locale.value === 'zh' ? 'NEX 余额' : 'NEX balance'))
const billsShortLabel = computed(() => (locale.value === 'zh' ? m.value.bills : 'Bills'))
const billsMonthLabel = computed(() => (locale.value === 'zh' ? '本月' : 'this month'))
const slotLiveLabel = computed(() => (locale.value === 'zh' ? '在线' : 'live'))
const slotOpenLabel = computed(() => (locale.value === 'zh' ? '可用槽位' : 'slots open'))
const unlockLabel = computed(() => (locale.value === 'zh' ? '解锁' : 'Unlock'))
const moreLabel = computed(() => (locale.value === 'zh' ? '更多' : 'more'))
const addDeviceLabel = computed(() => (locale.value === 'zh' ? '添加设备 →' : 'Add device →'))
const groupedLocales = computed(() => {
  return LOCALES.reduce(
    (result, item) => {
      result[item.priority].push(item)
      return result
    },
    { 0: [], 1: [], 2: [], 3: [] } as Record<0 | 1 | 2 | 3, typeof LOCALES>
  )
})

function openLocaleSheet() {
  localeOpen.value = true
}

function openProfile() {
  uni.navigateTo({ url: '/pages/me/profile' })
}

function closeLocaleSheet() {
  localeOpen.value = false
}

function pickLocale(code: LocaleCode) {
  locale.value = code
  setStoredLocale(code)
  localeOpen.value = false
}

function logout() {
  uni.showModal({
    title: m.value.signOutTitle,
    content: m.value.signOutContent,
    confirmText: m.value.signOut,
    confirmColor: '#ff7b8a',
    success(result) {
      if (!result.confirm) return
      auth.logout()
      uni.reLaunch({ url: '/pages/auth/login' })
    }
  })
}

function comingSoon(label: string) {
  uni.showToast({ title: m.value.comingSoon(label), icon: 'none' })
}
</script>

<template>
  <AppShell :title="m.title" version="" active-tab="me">
    <scroll-view class="page" scroll-y>
      <view class="profile-row" @click="openProfile">
        <image v-if="auth.session?.avatarPreviewUrl" class="avatar avatar-image" :src="auth.session.avatarPreviewUrl" mode="aspectFill" />
        <view v-else class="avatar">{{ initial }}</view>
        <view class="profile-main">
          <view class="name">{{ auth.displayName }}</view>
          <view class="meta">ID {{ userId }} · {{ referralCode }}</view>
          <view class="chips">
            <text class="chip success">{{ m.kycPending }}</text>
            <text class="chip">{{ m.joinedOneDay }}</text>
          </view>
        </view>
      </view>

      <view class="wallet-section">
        <view class="wallet-section-head">
          <text>{{ walletTitle }}</text>
          <button @click="comingSoon(m.bills)">{{ billsShortLabel }}</button>
        </view>
        <view class="wallet-card">
          <view class="wallet-grid" />
          <view class="wallet-aurora" />
          <view class="wallet-dots">
            <text v-for="i in 5" :key="i" />
          </view>

          <view class="wallet-content">
            <view class="balance-label">{{ usdtBalanceLabel }}</view>
            <view class="usdt-row">
              <text class="currency-mark">$</text>
              <text class="wallet-balance">0<text>.00</text></text>
            </view>
            <view class="pending-line">+$0.00 {{ m.pending }} · auto-settles every 24h</view>

            <view class="nex-block">
              <view class="nex-head">
                <text>{{ nexBalanceLabel }}</text>
                <text>+20.4%</text>
              </view>
              <view class="nex-row">
                <text>0</text>
                <text>NEX</text>
              </view>
              <view class="nex-meta">
                <text>≈ $0.00 · 1 NEX = $0.171</text>
                <button @click="comingSoon(m.bills)">0 {{ billsMonthLabel }} ›</button>
              </view>
            </view>

            <view class="quick-block">
              <view class="quick-label">{{ quickActionsLabel }}</view>
              <view class="wallet-actions">
                <button class="primary" @click="comingSoon(m.topUp)">
                  <text class="action-icon">↓</text>
                  <text>{{ m.topUp }}</text>
                  <text>USDT</text>
                </button>
                <button @click="comingSoon(m.withdraw)">
                  <text class="action-icon">↑</text>
                  <text>{{ m.withdraw }}</text>
                  <text>USDT</text>
                </button>
                <button @click="comingSoon(m.exchange)">
                  <text class="action-icon">✦</text>
                  <text>{{ m.exchange }}</text>
                  <text>USDT ⇄ NEX</text>
                </button>
              </view>
            </view>

            <view class="slot-unlock">
              <view class="slot-copy">
                <view class="slot-live"><text />0 {{ slotLiveLabel }} · 6 {{ slotOpenLabel }}</view>
                <view class="slot-potential">
                  <text>{{ unlockLabel }}</text>
                  <b>+$0/d</b>
                  <text>{{ moreLabel }}</text>
                </view>
              </view>
              <button @click="comingSoon(addDeviceLabel)">{{ addDeviceLabel }}</button>
            </view>
          </view>
        </view>
      </view>

      <view class="warning-card">
        <view class="warning-icon">!</view>
        <view>
          <view>{{ m.withdrawalLocked }}</view>
          <text>{{ m.withdrawalLockedDesc }}</text>
        </view>
      </view>

      <view class="network-card">
        <view class="rank-badge">{{ vRank }}</view>
        <view class="network-main">
          <view>{{ m.yourRank }}</view>
          <text>{{ level }} · {{ m.rankDesc }}</text>
        </view>
      </view>

      <view class="section-title">
        <text>{{ m.myDevices }}</text>
        <text>0 / 6</text>
      </view>
      <view class="device-entry" @click="comingSoon(m.myDevices)">
        <view class="device-icon">▯</view>
        <view class="device-main">
          <view>{{ m.fleetStatus }}</view>
          <text>{{ m.fleetStatusDesc }}</text>
        </view>
        <view class="slot-bars">
          <text v-for="i in 6" :key="i" />
        </view>
      </view>

      <view class="section-title"><text>{{ m.earnExtras }}</text></view>
      <view class="settings-card">
        <view class="setting-row" @click="comingSoon(m.missions)">
          <text class="si green">★</text><text class="label">{{ m.missions }}</text><text class="value">{{ m.daily }}</text><text class="chev">›</text>
        </view>
        <view class="setting-row" @click="comingSoon(m.eventsCenter)">
          <text class="si orange">◆</text><text class="label">{{ m.eventsCenter }}</text><text class="value">{{ m.liveCount }}</text><text class="chev">›</text>
        </view>
        <view class="setting-row last" @click="comingSoon(m.achievements)">
          <text class="si">🏆</text><text class="label">{{ m.achievements }}</text><text class="value">0 / 24</text><text class="chev">›</text>
        </view>
      </view>

      <view class="section-title"><text>{{ m.account }}</text></view>
      <view class="settings-card">
        <view class="setting-row" @click="openProfile">
          <text class="si">◎</text><text class="label">{{ m.profile }}</text><text class="value">{{ auth.displayName }}</text><text class="chev">›</text>
        </view>
        <view class="setting-row" @click="comingSoon(m.identitySecurity)">
          <text class="si">◇</text><text class="label">{{ m.identitySecurity }}</text><text class="value danger">{{ m.no2fa }}</text><text class="chev">›</text>
        </view>
        <view class="setting-row last" @click="comingSoon(m.notifications)">
          <text class="si">◌</text><text class="label">{{ m.notifications }}</text><text class="value">0</text><text class="chev">›</text>
        </view>
      </view>

      <view class="section-title"><text>{{ m.preferences }}</text></view>
      <view class="settings-card">
        <view class="setting-row" @click="comingSoon(m.preferences)">
          <text class="si">◐</text><text class="label">{{ m.preferences }}</text><text class="chev">›</text>
        </view>
        <view class="theme-row">
          <text class="si">☼</text>
          <text class="label">{{ m.appearance }}</text>
          <view class="theme-toggle">
            <button class="active">{{ m.light }}</button>
            <button>{{ m.dark }}</button>
          </view>
        </view>
        <view class="setting-row last" @click="openLocaleSheet">
          <text class="si">◎</text><text class="label">{{ m.language }}</text><text class="value">{{ currentLocale.code.toUpperCase() }}</text><text class="chev">›</text>
        </view>
      </view>

      <view class="section-title"><text>{{ m.help }}</text></view>
      <view class="settings-card">
        <view class="setting-row" @click="comingSoon(m.replayTour)">
          <text class="si">↻</text><text class="label">{{ m.replayTour }}</text><text class="chev">›</text>
        </view>
        <view class="setting-row" @click="comingSoon(m.helpFaq)">
          <text class="si">?</text><text class="label">{{ m.helpFaq }}</text><text class="chev">›</text>
        </view>
        <view class="setting-row last" @click="comingSoon(m.liveSupport)">
          <text class="si green">●</text><text class="label">{{ m.liveSupport }}</text><text class="value green">{{ m.online }}</text><text class="chev">›</text>
        </view>
      </view>

      <button class="logout-button" @click="logout">{{ m.signOut }}</button>
      <view class="version">Nexion · v0.1.0 · uni-app</view>
    </scroll-view>

    <view v-if="localeOpen" class="locale-backdrop" @click="closeLocaleSheet" />
    <view v-if="localeOpen" class="locale-sheet">
      <view class="sheet-handle" />
      <view class="sheet-header">
        <view>
          <view class="sheet-title">{{ languageSheetCopy.languageTitle }}</view>
          <view class="sheet-subtitle">{{ currentLocale.nativeName }} · {{ currentLocale.region }}</view>
        </view>
        <button class="sheet-close" @click="closeLocaleSheet">{{ languageSheetCopy.close }}</button>
      </view>
      <scroll-view class="locale-list" scroll-y>
        <view v-for="priority in [0, 1, 2, 3]" :key="priority" class="locale-group">
          <view class="priority-label">{{ priorityLabels[priority as 0 | 1 | 2 | 3] }}</view>
          <button
            v-for="item in groupedLocales[priority as 0 | 1 | 2 | 3]"
            :key="item.code"
            class="locale-option"
            :class="{ active: item.code === locale }"
            @click="pickLocale(item.code)"
          >
            <text class="flag">{{ item.flag }}</text>
            <view class="locale-copy">
              <view>{{ item.nativeName }}</view>
              <text>{{ item.englishName }} · {{ item.region }}</text>
            </view>
            <text v-if="item.code === locale" class="check">✓</text>
          </button>
        </view>
        <view class="sheet-footnote">{{ languageSheetCopy.languageFootnote }}</view>
      </scroll-view>
    </view>
  </AppShell>
</template>

<style scoped>
.page {
  max-height: calc(100vh - 260rpx);
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

.avatar-image {
  display: block;
  background: #10141d;
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

.network-card,
.device-entry,
.settings-card,
.warning-card {
  border: 1rpx solid #232936;
  border-radius: 32rpx;
  background: #10141d;
}

.wallet-section {
  margin-top: 2rpx;
}

.wallet-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 4rpx 16rpx;
}

.wallet-section-head text {
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 760;
}

.wallet-section-head button {
  min-width: 92rpx;
  height: 52rpx;
  margin: 0;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: #151a23;
  color: #9ba6b8;
  font-size: 23rpx;
  font-weight: 700;
  line-height: 52rpx;
}

.wallet-card {
  position: relative;
  overflow: hidden;
  border: 1rpx solid #303746;
  border-radius: 32rpx;
  background: radial-gradient(80% 60% at 50% 0%, rgba(198, 255, 58, 0.08), transparent 55%), #151a23;
  box-shadow: 0 18rpx 60rpx rgba(0, 0, 0, 0.34);
}

.wallet-grid {
  position: absolute;
  inset: 0;
  opacity: 0.36;
  background-image:
    linear-gradient(to right, rgba(80, 91, 112, 0.16) 1rpx, transparent 1rpx),
    linear-gradient(to bottom, rgba(80, 91, 112, 0.16) 1rpx, transparent 1rpx);
  background-size: 48rpx 48rpx;
}

.wallet-aurora {
  position: absolute;
  inset: -24%;
  opacity: 0.82;
  background:
    radial-gradient(40% 50% at 80% 20%, rgba(61, 214, 255, 0.16), transparent 60%),
    radial-gradient(40% 50% at 10% 80%, rgba(198, 255, 58, 0.18), transparent 60%),
    radial-gradient(35% 45% at 72% 92%, rgba(255, 184, 77, 0.16), transparent 60%);
  filter: blur(14rpx);
}

.wallet-dots {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.wallet-dots text {
  position: absolute;
  bottom: 22rpx;
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: #46e6ff;
  opacity: 0.75;
}

.wallet-dots text:nth-child(1) { left: 8%; background: #46e6ff; }
.wallet-dots text:nth-child(2) { left: 28%; background: #c6ff3a; }
.wallet-dots text:nth-child(3) { left: 52%; background: #46e6ff; }
.wallet-dots text:nth-child(4) { left: 72%; background: #12c979; }
.wallet-dots text:nth-child(5) { left: 90%; background: #ff8d4a; }

.wallet-content {
  position: relative;
  z-index: 1;
  padding: 36rpx;
}

.balance-label,
.quick-label,
.nex-head text:first-child {
  color: #747f91;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 22rpx;
}

.usdt-row,
.nex-row {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
}

.currency-mark {
  color: #8f98a8;
  font-size: 40rpx;
  font-weight: 600;
}

.wallet-balance {
  margin-top: 8rpx;
  color: #ffffff;
  font-size: 88rpx;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1;
}

.wallet-balance text {
  color: #8f98a8;
  font-size: 58rpx;
}

.pending-line {
  margin-top: 8rpx;
  color: #12c979;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 23rpx;
}

.nex-block,
.quick-block,
.slot-unlock {
  margin-top: 28rpx;
  padding-top: 28rpx;
  border-top: 1rpx dashed #3a4251;
}

.nex-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.nex-head text:last-child {
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background: rgba(198, 255, 58, 0.13);
  color: #c6ff3a;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 21rpx;
  font-weight: 700;
}

.nex-row text:first-child {
  color: #ffffff;
  font-size: 64rpx;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1;
}

.nex-row text:last-child {
  color: #c6ff3a;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 25rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}

.nex-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 10rpx;
}

.nex-meta text,
.nex-meta button {
  color: #8f98a8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 22rpx;
}

.nex-meta text {
  min-width: 0;
  flex: 1;
}

.nex-meta button {
  min-width: 136rpx;
  height: 44rpx;
  margin: 0;
  padding: 0;
  background: transparent;
  line-height: 44rpx;
  text-align: right;
}

.wallet-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-top: 14rpx;
}

.wallet-actions button {
  display: flex;
  min-width: 0;
  min-height: 138rpx;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 8rpx;
  margin: 0;
  padding: 0 4rpx;
  background: transparent;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 650;
  line-height: 1.1;
}

.wallet-actions button text:nth-child(3) {
  color: #747f91;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 19rpx;
  font-weight: 600;
  letter-spacing: 0.6rpx;
}

.action-icon {
  display: grid;
  width: 88rpx;
  height: 88rpx;
  place-items: center;
  border: 1rpx solid #303746;
  border-radius: 50%;
  background: #151a23;
  color: #c6ff3a;
  font-size: 34rpx;
  font-weight: 800;
}

.wallet-actions button.primary .action-icon {
  border-color: transparent;
  background: #c6ff3a;
  color: #0b0d13;
  box-shadow: 0 8rpx 28rpx rgba(198, 255, 58, 0.28);
}

.wallet-actions button::after,
.wallet-actions uni-button::after,
.wallet-section-head button::after,
.wallet-section-head uni-button::after,
.nex-meta button::after,
.nex-meta uni-button::after,
.slot-unlock button::after,
.slot-unlock uni-button::after,
.logout-button::after,
uni-button.logout-button::after,
.sheet-close::after,
uni-button.sheet-close::after,
.locale-option::after,
uni-button.locale-option::after,
.theme-toggle button::after,
.theme-toggle uni-button::after {
  border: 0;
}

.slot-unlock {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16rpx;
}

.slot-copy {
  min-width: 0;
}

.slot-live {
  display: flex;
  align-items: center;
  gap: 10rpx;
  color: #8f98a8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 22rpx;
}

.slot-live text {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #46e6ff;
  box-shadow: 0 0 18rpx rgba(70, 230, 255, 0.5);
}

.slot-potential {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  margin-top: 8rpx;
}

.slot-potential text {
  color: #c8d0dc;
  font-size: 25rpx;
}

.slot-potential b {
  color: #ff8d4a;
  font-size: 36rpx;
  font-weight: 750;
  letter-spacing: 0;
}

.slot-unlock button {
  height: 74rpx;
  margin: 0;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #ff8d4a;
  color: #1c0d04;
  font-size: 24rpx;
  font-weight: 750;
  line-height: 74rpx;
  white-space: nowrap;
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

.locale-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(0, 0, 0, 0.54);
}

.locale-sheet {
  position: fixed;
  right: 24rpx;
  bottom: 24rpx;
  left: 24rpx;
  z-index: 90;
  display: flex;
  max-height: 78vh;
  flex-direction: column;
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 40rpx;
  background: #10141d;
  box-shadow: 0 -24rpx 80rpx rgba(0, 0, 0, 0.45);
}

.sheet-handle {
  width: 72rpx;
  height: 8rpx;
  margin: 18rpx auto 8rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.24);
}

.sheet-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  padding: 18rpx 28rpx 20rpx;
}

.sheet-title {
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 760;
}

.sheet-subtitle {
  margin-top: 8rpx;
  color: #99a3b3;
  font-size: 23rpx;
}

.sheet-close {
  min-width: 108rpx;
  height: 56rpx;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.08);
  color: #c8d0dc;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 56rpx;
}

.locale-list {
  max-height: 60vh;
  padding: 0 20rpx 22rpx;
  box-sizing: border-box;
}

.locale-group {
  padding-top: 18rpx;
}

.priority-label {
  padding: 0 10rpx 12rpx;
  color: #5f6877;
  font-size: 22rpx;
  font-weight: 700;
  text-transform: uppercase;
}

.locale-option {
  display: flex;
  width: 100%;
  min-height: 92rpx;
  align-items: center;
  gap: 18rpx;
  margin: 0 0 10rpx;
  padding: 0 20rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 28rpx;
  background: #0b0d13;
  color: #ffffff;
  line-height: 1;
  text-align: left;
}

.locale-option.active {
  border-color: rgba(198, 255, 58, 0.72);
  background: rgba(198, 255, 58, 0.08);
}

.flag {
  width: 52rpx;
  font-size: 34rpx;
}

.locale-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}

.locale-copy view {
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 700;
}

.locale-copy text {
  overflow: hidden;
  color: #99a3b3;
  font-size: 22rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.check {
  color: #c6ff3a;
  font-size: 30rpx;
  font-weight: 800;
}

.sheet-footnote {
  padding: 8rpx 12rpx 18rpx;
  color: #6f7886;
  font-size: 22rpx;
  line-height: 1.45;
}
</style>
