<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAuthStore } from '@/store/auth'
import { requireAuth } from '@/utils/auth-guard'
import { getProfileMessages, setStoredLocale, useActiveLocale } from '@/utils/i18n'

const REGIONS = ['Singapore', 'Hong Kong', 'Tokyo, JP', 'Seoul, KR', 'Berlin, DE', 'London, UK', 'Dubai, AE', 'New York, US']
const TIMEZONES = [
  'Asia/Singapore (UTC+8)',
  'Asia/Tokyo (UTC+9)',
  'Asia/Hong_Kong (UTC+8)',
  'Europe/Berlin (UTC+1)',
  'Europe/London (UTC+0)',
  'Asia/Dubai (UTC+4)',
  'America/New_York (UTC-5)'
]
const TIERS = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5']
const AVATAR_LIBRARY = [
  { key: 'mech:lime', accent: '#c6ff3a', glow: 'rgba(198, 255, 58, 0.22)' },
  { key: 'mech:cyan', accent: '#46e6ff', glow: 'rgba(70, 230, 255, 0.2)' },
  { key: 'mech:violet', accent: '#b89cff', glow: 'rgba(184, 156, 255, 0.22)' },
  { key: 'mech:amber', accent: '#ffb84d', glow: 'rgba(255, 184, 77, 0.22)' },
  { key: 'mech:rose', accent: '#ff7896', glow: 'rgba(255, 120, 150, 0.2)' }
]

const auth = useAuthStore()
const locale = useActiveLocale()
const t = computed(() => getProfileMessages(locale.value))
const saving = ref(false)
const joinedDate = ref('2026年5月1日')
const form = reactive({
  nickname: '',
  avatarUrl: '',
  bio: '',
  region: REGIONS[0],
  timezone: TIMEZONES[0]
})
const original = reactive({ nickname: '', avatarUrl: '', bio: '', region: REGIONS[0], timezone: TIMEZONES[0] })

const level = computed(() => auth.session?.userLevel || 'L2')
const nextTier = computed(() => {
  const index = TIERS.indexOf(level.value)
  return TIERS[Math.min(index < 0 ? 2 : index + 1, TIERS.length - 1)]
})
const tierLabel = computed(() => t.value.tierLabels[level.value] || level.value)
const nextTierLabel = computed(() => t.value.tierLabels[nextTier.value] || nextTier.value)
const dirty = computed(() =>
  form.nickname !== original.nickname ||
  form.avatarUrl !== original.avatarUrl ||
  form.bio !== original.bio ||
  form.region !== original.region ||
  form.timezone !== original.timezone
)
const displayName = computed(() => form.nickname || auth.displayName || 'Alex T.')
const phoneLine = computed(() => {
  const session = auth.session
  if (!session) return ''
  return maskPhone(session.countryCode, session.phone) || normalizeMaskedPhone(session.countryCode, session.phoneMasked)
})
const selectedAvatar = computed(() => AVATAR_LIBRARY.find((item) => item.key === form.avatarUrl) || defaultAvatar())
const avatarStyle = computed(() => ({
  '--avatar-accent': selectedAvatar.value.accent,
  '--avatar-glow': selectedAvatar.value.glow
}))

onShow(async () => {
  if (!requireAuth()) return
  uni.hideTabBar({ animation: false, fail: () => undefined })
  applySession()
  await loadProfileSilently()
})

function applySession() {
  form.nickname = auth.session?.nickname || 'Alex T.'
  form.avatarUrl = normalizeAvatarKey(auth.session?.avatarUrl)
  form.bio = 'Running an AI-friendly node from my phone. Always up for swapping notes on yield strategies.'
  form.region = REGIONS[0]
  form.timezone = TIMEZONES[0]
  snapshotOriginal()
}

function snapshotOriginal() {
  original.nickname = form.nickname
  original.avatarUrl = form.avatarUrl
  original.bio = form.bio
  original.region = form.region
  original.timezone = form.timezone
}

async function loadProfileSilently() {
  try {
    const profile = await auth.refreshProfile()
    form.nickname = profile.nickname || form.nickname
    form.avatarUrl = normalizeAvatarKey(profile.avatarUrl)
    form.region = profile.region || form.region
    form.bio = profile.bio || form.bio
    form.timezone = profile.timezone || form.timezone
    if (profile.createdAt) joinedDate.value = formatDate(profile.createdAt)
    snapshotOriginal()
  } catch {
    // Keep the high-fidelity page usable before the running backend includes /auth/users/me.
  }
}

function formatDate(value: string) {
  if (locale.value === 'zh') {
    const date = value.slice(0, 10).split('-')
    return date.length === 3 ? `${date[0]}年${Number(date[1])}月${Number(date[2])}日` : value
  }
  return value.slice(0, 10)
}

function defaultAvatar() {
  const seed = Number(auth.session?.userId || 0)
  return AVATAR_LIBRARY[Math.abs(seed) % AVATAR_LIBRARY.length]
}

function normalizeAvatarKey(value?: string) {
  if (value && AVATAR_LIBRARY.some((item) => item.key === value)) return value
  return defaultAvatar().key
}

function normalizeMaskedPhone(countryCode?: string, value?: string) {
  if (!value) return ''
  const trimmed = value.trim()
  if (trimmed.startsWith('+')) return trimmed
  const normalizedCode = normalizeCountryCode(countryCode)
  return normalizedCode ? `${normalizedCode} ${trimmed}` : trimmed
}

function normalizeCountryCode(value?: string) {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`
}

function maskPhone(countryCode?: string, phone?: string) {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return ''
  const prefix = digits.length <= 7 ? digits.slice(0, 1) : digits.slice(0, 3)
  const suffix = digits.length <= 4 ? digits : digits.slice(-4)
  const stars = '*'.repeat(Math.max(4, digits.length - prefix.length - suffix.length))
  const normalizedCode = normalizeCountryCode(countryCode)
  return `${normalizedCode ? `${normalizedCode} ` : ''}${prefix}${stars}${suffix}`
}

function chooseAvatar() {
  const currentIndex = AVATAR_LIBRARY.findIndex((item) => item.key === form.avatarUrl)
  const offset = Math.floor(Math.random() * (AVATAR_LIBRARY.length - 1)) + 1
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + offset) % AVATAR_LIBRARY.length
  form.avatarUrl = AVATAR_LIBRARY[nextIndex].key
}

async function saveProfile() {
  if (!dirty.value || saving.value) return
  if (!form.nickname.trim()) {
    uni.showToast({ title: t.value.namePlaceholder, icon: 'none' })
    return
  }
  saving.value = true
  uni.showLoading({ title: t.value.saving, mask: true })
  try {
    await auth.updateProfile({
      nickname: form.nickname.trim(),
      avatarUrl: form.avatarUrl,
      language: locale.value,
      region: form.region,
      bio: form.bio.trim(),
      timezone: form.timezone
    })
    setStoredLocale(locale.value)
    snapshotOriginal()
    uni.showToast({ title: t.value.saved, icon: 'success' })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    uni.showToast({ title: message || t.value.saving, icon: 'none' })
  } finally {
    uni.hideLoading()
    saving.value = false
  }
}

function setBio(value: string) {
  form.bio = value.slice(0, 140)
}

function back() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/me/index' }) })
}
</script>

<template>
  <view class="profile-shell">
    <view class="nav-row">
      <button class="nav-hit" @click="back">
        <view class="nav-glass">
          <image class="chevron-image" src="/src/static/icons/profile-chevron-left.svg" mode="aspectFit" />
        </view>
      </button>
      <view class="page-title">{{ t.title }}</view>
      <button class="nav-hit bell-button">
        <view class="nav-glass">
          <image class="bell-image" src="/src/static/icons/profile-bell.svg" mode="aspectFit" />
        </view>
        <text />
      </button>
    </view>

    <scroll-view class="content" scroll-y>
      <view class="summary-card">
        <view class="avatar-wrap" @click="chooseAvatar">
          <view class="mech-avatar" :style="avatarStyle">
            <view class="rim-light" />
            <view class="shoulder left" />
            <view class="shoulder right" />
            <view class="neck">
              <view />
              <view />
              <view />
            </view>
            <view class="jaw">
              <view class="grille" />
              <view class="chin-led" />
            </view>
            <view class="antenna" />
            <view class="helmet">
              <view class="crest" />
              <view class="ridge" />
              <view class="bolt left top" />
              <view class="bolt right top" />
              <view class="bolt left bottom" />
              <view class="bolt right bottom" />
            </view>
            <view class="visor-glow" />
            <view class="visor"><view /></view>
          </view>
          <button class="avatar-action" @click.stop="chooseAvatar">
            <image src="/src/static/icons/profile-refresh-cw.svg" mode="aspectFit" />
          </button>
        </view>
        <view class="summary-copy">
          <view class="summary-name">{{ displayName }}</view>
          <view v-if="phoneLine" class="summary-email">{{ phoneLine }}</view>
          <view class="joined-line">◷ {{ t.joinedOn }} {{ joinedDate }}</view>
        </view>
      </view>

      <view class="form-card">
        <view class="section-kicker">{{ t.sectionPublic }}</view>

        <view class="field-block">
          <view class="field-label">
            <image class="pencil-icon" src="/src/static/icons/profile-pencil.svg" mode="aspectFit" />
            {{ t.displayName }}
          </view>
          <input v-model="form.nickname" class="field-input" :placeholder="t.namePlaceholder" :maxlength="32" />
          <view class="field-hint">{{ t.displayNameHint }}</view>
        </view>

        <view class="field-block">
          <view class="field-label">{{ t.bio }}</view>
          <textarea class="field-textarea" :value="form.bio" :placeholder="t.bioPlaceholder" :maxlength="140" @input="setBio($event.detail.value)" />
          <view class="field-between">
            <text>{{ t.bioHint }}</text>
            <text>{{ form.bio.length }}/140</text>
          </view>
        </view>

        <view class="two-grid">
          <view class="field-block compact">
            <view class="field-label">◎ {{ t.region }}</view>
            <picker :range="REGIONS" :value="Math.max(0, REGIONS.indexOf(form.region))" @change="form.region = REGIONS[Number($event.detail.value)]">
              <view class="picker-field">{{ form.region }} <text>⌄</text></view>
            </picker>
          </view>
          <view class="field-block compact">
            <view class="field-label">◷ {{ t.timezone }}</view>
            <picker :range="TIMEZONES" :value="Math.max(0, TIMEZONES.indexOf(form.timezone))" @change="form.timezone = TIMEZONES[Number($event.detail.value)]">
              <view class="picker-field">{{ form.timezone }} <text>⌄</text></view>
            </picker>
          </view>
        </view>
      </view>

      <view class="tier-card">
        <view class="tier-head">
          <text>{{ t.tierTitle }}</text>
          <b>{{ tierLabel }}</b>
        </view>
        <view class="tier-track"><view /></view>
        <view class="tier-copy">{{ t.tierProgress.replace('{next}', nextTierLabel) }} · 62%</view>
      </view>

      <view class="wallet-card">
        <view class="wallet-icon">▣</view>
        <view class="wallet-copy">
          <view>{{ t.walletAddress }}</view>
          <text>{{ t.walletEmpty }}</text>
        </view>
        <text class="wallet-action">{{ t.walletPair }}</text>
      </view>
    </scroll-view>

    <view class="save-dock">
      <button class="save-button" :class="{ dirty }" :disabled="!dirty || saving" @click="saveProfile">
        {{ t.saveChanges }}
      </button>
      <view class="home-indicator" />
    </view>
  </view>
</template>

<style scoped>
.profile-shell {
  min-height: 100vh;
  padding: calc(24rpx + env(safe-area-inset-top)) 32rpx 148rpx;
  box-sizing: border-box;
  background: #000000;
  color: #f7f8fb;
}

.nav-row {
  display: grid;
  grid-template-columns: 88rpx 1fr 88rpx;
  align-items: center;
  gap: 10rpx;
}

.nav-hit {
  position: relative;
  display: grid;
  width: 88rpx;
  height: 88rpx;
  place-items: center;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  line-height: 1;
}

.nav-glass {
  display: grid;
  width: 72rpx;
  height: 72rpx;
  place-items: center;
  border: 1rpx solid rgba(255, 255, 255, 0.12);
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20rpx) saturate(140%);
}

.bell-button {
  position: relative;
}

.bell-button text {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #ff7f46;
}

.bell-image {
  display: block;
  width: 36rpx;
  height: 36rpx;
}

.chevron-image {
  display: block;
  width: 36rpx;
  height: 36rpx;
}

.page-title {
  text-align: center;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 820;
}

.content {
  max-height: calc(100vh - 204rpx - env(safe-area-inset-top));
  margin-top: 32rpx;
}

.summary-card,
.form-card,
.tier-card,
.wallet-card {
  border: 1rpx solid #282a2e;
  border-radius: 28rpx;
  background: #151515;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 32rpx;
  padding: 36rpx 40rpx;
}

.avatar-wrap {
  position: relative;
  width: 128rpx;
  height: 128rpx;
  flex: 0 0 128rpx;
}

.mech-avatar {
  width: 128rpx;
  height: 128rpx;
  border-radius: 26rpx;
}

.mech-avatar {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 28% 18%, var(--avatar-glow), transparent 58%),
    linear-gradient(145deg, #1a1f2b 0%, #06080c 100%);
}

.rim-light {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 30% 20%, var(--avatar-glow), transparent 66%);
}

.shoulder {
  position: absolute;
  bottom: -2rpx;
  width: 38rpx;
  height: 30rpx;
  border: 1rpx solid #0a0c10;
  background: linear-gradient(#3d424e, #0f1217);
}

.shoulder.left {
  left: 4rpx;
  border-radius: 22rpx 18rpx 0 0;
  transform: skewY(-12deg);
}

.shoulder.right {
  right: 4rpx;
  border-radius: 18rpx 22rpx 0 0;
  transform: skewY(12deg);
}

.neck {
  position: absolute;
  bottom: 22rpx;
  left: 48rpx;
  z-index: 2;
  width: 32rpx;
  height: 18rpx;
  border: 1rpx solid #3a3f4a;
  border-radius: 3rpx;
  background: #1f232c;
}

.neck view {
  height: 2rpx;
  margin: 4rpx 6rpx 0;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.14);
}

.neck view:first-child {
  background: var(--avatar-accent);
  opacity: 0.55;
}

.jaw {
  position: absolute;
  bottom: 36rpx;
  left: 40rpx;
  z-index: 4;
  width: 48rpx;
  height: 28rpx;
  border: 1rpx solid #0a0c10;
  border-radius: 0 0 17rpx 17rpx;
  background: linear-gradient(#373c46, #15181e);
}

.grille {
  position: absolute;
  top: 13rpx;
  left: 13rpx;
  width: 22rpx;
  height: 8rpx;
  border-radius: 2rpx;
  background:
    repeating-linear-gradient(180deg, #2a2f38 0 1rpx, transparent 1rpx 3rpx),
    #0a0c10;
}

.chin-led {
  position: absolute;
  bottom: 2rpx;
  left: 50%;
  width: 4rpx;
  height: 4rpx;
  border-radius: 50%;
  background: var(--avatar-accent);
  box-shadow: 0 0 8rpx var(--avatar-accent);
  transform: translateX(-50%);
}

.antenna {
  position: absolute;
  top: 16rpx;
  left: 62rpx;
  z-index: 5;
  width: 4rpx;
  height: 12rpx;
  border-radius: 4rpx;
  background: #3a3f4a;
}

.antenna::before {
  content: '';
  position: absolute;
  top: -6rpx;
  left: 50%;
  width: 7rpx;
  height: 7rpx;
  border-radius: 50%;
  background: var(--avatar-accent);
  box-shadow: 0 0 14rpx var(--avatar-accent);
  transform: translateX(-50%);
}

.helmet {
  position: absolute;
  top: 28rpx;
  left: 35rpx;
  z-index: 3;
  width: 58rpx;
  height: 52rpx;
  border: 1rpx solid #0a0c10;
  border-radius: 30rpx 30rpx 8rpx 8rpx;
  background: linear-gradient(#525766 0%, #2b3038 55%, #13171f 100%);
}

.crest {
  position: absolute;
  top: 10rpx;
  left: 12rpx;
  width: 34rpx;
  height: 12rpx;
  border-top: 2rpx solid var(--avatar-accent);
  border-radius: 50%;
  opacity: 0.55;
}

.ridge {
  position: absolute;
  top: 2rpx;
  bottom: 15rpx;
  left: 50%;
  width: 1rpx;
  background: linear-gradient(#0a0c10, rgba(10, 12, 16, 0.35));
}

.bolt {
  position: absolute;
  width: 6rpx;
  height: 6rpx;
  border: 2rpx solid #0a0c10;
  border-radius: 50%;
  background: #3a3f4a;
}

.bolt.left {
  left: 7rpx;
}

.bolt.right {
  right: 7rpx;
}

.bolt.top {
  top: 17rpx;
}

.bolt.bottom {
  bottom: 7rpx;
}

.visor-glow {
  position: absolute;
  top: 52rpx;
  left: 34rpx;
  z-index: 5;
  width: 60rpx;
  height: 18rpx;
  border-radius: 50%;
  background: var(--avatar-accent);
  filter: blur(8rpx);
  opacity: 0.4;
}

.visor {
  position: absolute;
  top: 53rpx;
  left: 39rpx;
  z-index: 6;
  width: 50rpx;
  height: 11rpx;
  border: 1rpx solid #0a0c10;
  border-radius: 3rpx;
  background: #06080c;
}

.visor view {
  width: 42rpx;
  height: 5rpx;
  margin: 3rpx auto 0;
  border-radius: 3rpx;
  background: var(--avatar-accent);
  box-shadow: 0 0 13rpx var(--avatar-accent);
}

.avatar-action {
  position: absolute;
  right: -12rpx;
  bottom: -12rpx;
  display: grid;
  width: 56rpx;
  height: 56rpx;
  place-items: center;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #c6ff3a !important;
  color: #000000;
  box-shadow: none;
  line-height: 1;
}

.avatar-action image {
  width: 28rpx;
  height: 28rpx;
  display: block;
}

.summary-copy {
  min-width: 0;
  flex: 1;
}

.summary-name {
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 800;
}

.summary-email {
  margin-top: 10rpx;
  color: #a1a7b5;
  font-size: 24rpx;
}

.joined-line {
  margin-top: 10rpx;
  color: #7f8797;
  font-size: 21rpx;
}

.form-card {
  overflow: hidden;
  margin-top: 24rpx;
}

.section-kicker {
  padding: 25rpx 32rpx 20rpx;
  color: #8b93a2;
  font-size: 24rpx;
  letter-spacing: 2rpx;
}

.field-block {
  padding: 21rpx 32rpx;
  border-top: 1rpx solid rgba(44, 46, 51, 0.82);
}

.field-label {
  display: flex;
  align-items: center;
  gap: 10rpx;
  color: #a7afbf;
  font-size: 24rpx;
  font-weight: 520;
}

.pencil-icon {
  width: 24rpx;
  height: 24rpx;
  flex: 0 0 24rpx;
}

.field-input,
.field-textarea,
.picker-field {
  width: 100%;
  margin-top: 14rpx;
  box-sizing: border-box;
  border-radius: 16rpx;
  background: #222222;
  color: #f5f6fa;
  font-size: 28rpx;
}

.field-input,
.picker-field {
  height: 72rpx;
  padding: 0 24rpx;
  line-height: 72rpx;
}

.field-textarea {
  height: 162rpx;
  padding: 18rpx 24rpx;
  line-height: 1.45;
  overflow: hidden;
}

.field-hint,
.field-between {
  margin-top: 10rpx;
  color: #7f8797;
  font-size: 21rpx;
}

.field-between {
  display: flex;
  justify-content: space-between;
}

.two-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24rpx;
  padding: 21rpx 32rpx 25rpx;
  border-top: 1rpx solid rgba(44, 46, 51, 0.82);
}

.field-block.compact {
  min-width: 0;
  padding: 0;
  border-top: 0;
}

.picker-field {
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
}

.picker-field text {
  float: right;
}

.tier-card {
  margin-top: 24rpx;
  padding: 30rpx 32rpx;
}

.tier-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tier-head text {
  color: #9ca4b4;
  font-size: 25rpx;
}

.tier-head b {
  color: #9bf31e;
  font-size: 28rpx;
}

.tier-track {
  height: 16rpx;
  margin-top: 24rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: #242424;
}

.tier-track view {
  width: 62%;
  height: 100%;
  border-radius: inherit;
  background: #89ef20;
}

.tier-copy {
  margin-top: 20rpx;
  color: #7f8797;
  font-size: 24rpx;
}

.wallet-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-top: 24rpx;
  padding: 32rpx;
}

.wallet-icon {
  display: grid;
  width: 76rpx;
  height: 76rpx;
  place-items: center;
  border-radius: 22rpx;
  background: rgba(255, 127, 70, 0.13);
  color: #ff7f46;
  font-size: 34rpx;
}

.wallet-copy {
  min-width: 0;
  flex: 1;
}

.wallet-copy view {
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 780;
}

.wallet-copy text {
  display: block;
  margin-top: 8rpx;
  color: #8b93a2;
  font-size: 23rpx;
}

.wallet-action {
  color: #9bf31e;
  font-size: 24rpx;
  font-weight: 800;
}

.save-dock {
  position: fixed;
  right: 32rpx;
  bottom: 0;
  left: 32rpx;
  z-index: 30;
  padding: 18rpx 0 18rpx;
  border-radius: 26rpx 26rpx 0 0;
  background: rgba(34, 34, 34, 0.92);
  backdrop-filter: blur(26rpx);
}

.save-button {
  display: flex;
  height: 78rpx;
  align-items: center;
  justify-content: center;
  margin: 0;
  border-radius: 20rpx;
  background: #2a2a2a;
  color: #777f8d;
  font-size: 27rpx;
  font-weight: 820;
}

.save-button[disabled] {
  background: #2a2a2a !important;
  color: #777f8d !important;
  opacity: 1;
}

.save-button.dirty {
  background: #9bf31e;
  color: #000000;
}

.home-indicator {
  width: 140rpx;
  height: 8rpx;
  margin: 18rpx auto 0;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.78);
}

button::after,
uni-button::after {
  border: 0;
}
</style>
