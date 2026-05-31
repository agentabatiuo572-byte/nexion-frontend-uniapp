<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getMediaPreviewUrl, uploadUserAvatar } from '@/api/auth'
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

const auth = useAuthStore()
const locale = useActiveLocale()
const t = computed(() => getProfileMessages(locale.value))
const uploading = ref(false)
const saving = ref(false)
const avatarPreview = ref('')
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
const emailOrCode = computed(() => auth.session?.referralCode || 'alex@nexion.app')

onShow(async () => {
  if (!requireAuth()) return
  uni.hideTabBar({ animation: false, fail: () => undefined })
  applySession()
  await loadProfileSilently()
})

function applySession() {
  form.nickname = auth.session?.nickname || 'Alex T.'
  form.avatarUrl = auth.session?.avatarUrl || ''
  form.bio = 'Running an AI-friendly node from my phone. Always up for swapping notes on yield strategies.'
  form.region = REGIONS[0]
  form.timezone = TIMEZONES[0]
  avatarPreview.value = auth.session?.avatarPreviewUrl || ''
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
    form.avatarUrl = profile.avatarUrl || ''
    form.region = profile.region || form.region
    if (profile.createdAt) joinedDate.value = formatDate(profile.createdAt)
    if (form.avatarUrl) await loadAvatarPreview(form.avatarUrl)
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

async function loadAvatarPreview(objectKey: string) {
  if (!objectKey) return
  if (/^https?:\/\//i.test(objectKey)) {
    avatarPreview.value = objectKey
    return
  }
  const response = await getMediaPreviewUrl(objectKey)
  avatarPreview.value = response.downloadUrl || ''
}

async function chooseAvatar() {
  try {
    const result = await uni.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
    const filePath = result.tempFilePaths[0]
    if (!filePath) return
    uploading.value = true
    const response = await uploadUserAvatar(filePath)
    form.avatarUrl = response.objectKey
    avatarPreview.value = response.downloadUrl || filePath
  } catch (error) {
    const message = error instanceof Error ? error.message : t.value.uploadFailed
    if (!String(message).toLowerCase().includes('cancel')) {
      uni.showToast({ title: message || t.value.uploadFailed, icon: 'none' })
    }
  } finally {
    uploading.value = false
  }
}

async function saveProfile() {
  if (!dirty.value || saving.value || uploading.value) return
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
      region: form.region
    })
    if (auth.session) auth.session.avatarPreviewUrl = avatarPreview.value
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
    <view class="status-row">
      <text>18:30</text>
      <view class="status-icons"><text class="bars">▮▮▮</text><text>⌁</text><text class="battery" /></view>
    </view>

    <view class="nav-row">
      <button class="nav-button" @click="back">‹</button>
      <view class="page-title">{{ t.title }}</view>
      <button class="nav-button bell-button">♧<text /></button>
    </view>

    <scroll-view class="content" scroll-y>
      <view class="summary-card">
        <view class="avatar-wrap" @click="chooseAvatar">
          <image v-if="avatarPreview" class="avatar-image" :src="avatarPreview" mode="aspectFill" />
          <view v-else class="mech-avatar">
            <view class="antenna" />
            <view class="helmet" />
            <view class="visor" />
            <view class="body" />
          </view>
          <button class="avatar-action" @click.stop="chooseAvatar">↻</button>
        </view>
        <view class="summary-copy">
          <view class="summary-name">{{ displayName }}</view>
          <view class="summary-email">{{ emailOrCode }}</view>
          <view class="joined-line">◷ {{ t.joinedOn }} {{ joinedDate }}</view>
        </view>
      </view>

      <view class="form-card">
        <view class="section-kicker">{{ t.sectionPublic }}</view>

        <view class="field-block">
          <view class="field-label">♢ {{ t.displayName }}</view>
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
      <button class="save-button" :class="{ dirty }" :disabled="!dirty || saving || uploading" @click="saveProfile">
        {{ t.saveChanges }}
      </button>
      <view class="home-indicator" />
    </view>
  </view>
</template>

<style scoped>
.profile-shell {
  min-height: 100vh;
  padding: 32rpx 32rpx 148rpx;
  box-sizing: border-box;
  background: #000000;
  color: #f7f8fb;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 54rpx;
  padding: 0 18rpx;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 800;
}

.status-icons {
  display: flex;
  align-items: center;
  gap: 18rpx;
  font-size: 22rpx;
}

.bars {
  color: #ffffff;
  font-size: 18rpx;
  letter-spacing: 2rpx;
}

.battery {
  display: block;
  width: 42rpx;
  height: 22rpx;
  border: 3rpx solid #ffffff;
  border-radius: 7rpx;
  box-shadow: inset -8rpx 0 0 rgba(255, 255, 255, 0.72);
}

.nav-row {
  display: grid;
  grid-template-columns: 72rpx 1fr 72rpx;
  align-items: center;
  gap: 18rpx;
  margin-top: 36rpx;
}

.nav-button {
  display: grid;
  width: 72rpx;
  height: 72rpx;
  place-items: center;
  border: 1rpx solid #2a2d34;
  border-radius: 20rpx;
  background: #161719;
  color: #d7dce6;
  font-size: 45rpx;
  line-height: 72rpx;
}

.bell-button {
  position: relative;
  font-size: 31rpx;
}

.bell-button text {
  position: absolute;
  top: 18rpx;
  right: 18rpx;
  width: 11rpx;
  height: 11rpx;
  border-radius: 50%;
  background: #ff7f46;
}

.page-title {
  text-align: center;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 820;
}

.content {
  max-height: calc(100vh - 260rpx);
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

.avatar-image,
.mech-avatar {
  width: 128rpx;
  height: 128rpx;
  border-radius: 26rpx;
}

.avatar-image {
  display: block;
  object-fit: cover;
}

.mech-avatar {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 12%, rgba(134, 232, 31, 0.2), transparent 42%),
    linear-gradient(145deg, #202630, #07090d);
}

.antenna {
  position: absolute;
  top: 18rpx;
  left: 62rpx;
  width: 4rpx;
  height: 28rpx;
  border-radius: 4rpx;
  background: #89ef20;
}

.helmet {
  position: absolute;
  top: 34rpx;
  left: 33rpx;
  width: 62rpx;
  height: 58rpx;
  border-radius: 26rpx 26rpx 12rpx 12rpx;
  background: linear-gradient(#525766, #151922);
  box-shadow: inset 0 0 0 2rpx #06080c;
}

.visor {
  position: absolute;
  top: 61rpx;
  left: 41rpx;
  z-index: 2;
  width: 46rpx;
  height: 11rpx;
  border-radius: 8rpx;
  background: #9bf31e;
  box-shadow: 0 0 16rpx rgba(155, 243, 30, 0.6);
}

.body {
  position: absolute;
  right: 15rpx;
  bottom: 5rpx;
  left: 15rpx;
  height: 38rpx;
  border-radius: 22rpx 22rpx 0 0;
  background: linear-gradient(90deg, #20242e, #06080c);
}

.avatar-action {
  position: absolute;
  right: -12rpx;
  bottom: -12rpx;
  display: grid;
  width: 56rpx;
  height: 56rpx;
  place-items: center;
  border-radius: 50%;
  background: #9bf31e;
  color: #000000;
  font-size: 32rpx;
  font-weight: 900;
  line-height: 56rpx;
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
  color: #a7afbf;
  font-size: 24rpx;
  font-weight: 520;
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
  height: 138rpx;
  padding: 18rpx 24rpx;
  line-height: 1.45;
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
