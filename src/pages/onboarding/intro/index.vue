<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppShell from '@/components/AppShell.vue'
import {
  LOCALES,
  PRIORITY_LABELS,
  getIntroMessages,
  getLocaleEntry,
  getStoredLocale,
  setStoredLocale,
  type LocaleCode
} from '@/utils/i18n'

const paid = ref(1247893)
const devices = ref(28432)
const locale = ref<LocaleCode>(getStoredLocale())
const localeOpen = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const nodes = [
  { top: '8%', left: '12%', scale: 0.8, delay: '0s' },
  { top: '16%', left: '74%', scale: 1.1, delay: '.3s' },
  { top: '25%', left: '28%', scale: 0.7, delay: '.8s' },
  { top: '34%', left: '88%', scale: 0.9, delay: '1.1s' },
  { top: '43%', left: '8%', scale: 1.2, delay: '.5s' },
  { top: '52%', left: '68%', scale: 0.75, delay: '1.7s' },
  { top: '62%', left: '18%', scale: 1, delay: '2s' },
  { top: '68%', left: '82%', scale: 0.65, delay: '.9s' },
  { top: '74%', left: '42%', scale: 1.15, delay: '1.4s' },
  { top: '20%', left: '48%', scale: 0.6, delay: '2.2s' }
]

const currentLocale = computed(() => getLocaleEntry(locale.value))
const t = computed(() => getIntroMessages(locale.value))
const groupedLocales = computed(() => {
  return LOCALES.reduce(
    (acc, item) => {
      acc[item.priority].push(item)
      return acc
    },
    { 0: [], 1: [], 2: [], 3: [] } as Record<0 | 1 | 2 | 3, typeof LOCALES>
  )
})

onMounted(() => {
  timer = setInterval(() => {
    paid.value += Math.floor(Math.random() * 250) + 80
    devices.value += Math.floor(Math.random() * 3)
  }, 1800)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function goRegister() {
  uni.navigateTo({ url: '/pages/auth/register' })
}

function goLogin() {
  uni.navigateTo({ url: '/pages/auth/login' })
}

function toggleLocaleSheet() {
  localeOpen.value = !localeOpen.value
}

function closeLocaleSheet() {
  localeOpen.value = false
}

function pickLocale(code: LocaleCode) {
  locale.value = code
  setStoredLocale(code)
  localeOpen.value = false
}
</script>

<template>
  <AppShell :show-actions="false">
    <view class="intro-page">
      <view class="glow" />
      <view class="top-vignette" />
      <view class="dot-grid" />
      <view
        v-for="(node, index) in nodes"
        :key="index"
        class="pulse-node"
        :style="{
          top: node.top,
          left: node.left,
          transform: `scale(${node.scale})`,
          animationDelay: node.delay
        }"
      />

      <view class="locale-row">
        <button class="locale-button" @click="toggleLocaleSheet">
          <image class="locale-icon" src="/src/static/icons/globe.svg" mode="aspectFit" />
          <text>{{ currentLocale.code.toUpperCase() }}</text>
          <image
            class="locale-chevron"
            :class="{ open: localeOpen }"
            src="/src/static/icons/chevron-down.svg"
            mode="aspectFit"
          />
        </button>
      </view>

      <view class="orb-wrap">
        <view class="compute-orb">
          <view class="orbit outer">
            <view class="satellite top" />
            <view class="satellite right" />
            <view class="satellite bottom" />
            <view class="satellite left" />
            <view class="travel-node" />
          </view>
          <view class="pulse-ring one" />
          <view class="pulse-ring two" />
          <view class="orbit middle" />
          <view class="chip">
            <view class="pin-row top">
              <text v-for="i in 4" :key="i" />
            </view>
            <view class="pin-row bottom">
              <text v-for="i in 4" :key="i" />
            </view>
            <view class="pin-col left">
              <text v-for="i in 4" :key="i" />
            </view>
            <view class="pin-col right">
              <text v-for="i in 4" :key="i" />
            </view>
            <view class="die">N</view>
            <view class="led" />
          </view>
        </view>
      </view>

      <view class="copy">
        <view class="title">
          {{ t.title1 }}
          <br />
          {{ t.title2Line1 }} {{ t.title2Line2 }}
        </view>
        <view class="subtitle">
          {{ t.subtitleLine1 }}
          <br />
          {{ t.subtitleLine2 }}
        </view>

        <view class="stats-pill">
          <view class="stat-left">
            <text class="live-dot" />
            <text class="stat-strong">{{ devices.toLocaleString() }}</text>
            <text class="stat-muted">{{ t.statsDevices }}</text>
          </view>
          <text class="stat-split" />
          <view class="stat-left">
            <text class="stat-brand">${{ paid.toLocaleString() }}</text>
            <text class="stat-muted">{{ t.statsPaidToday }}</text>
          </view>
        </view>
      </view>

      <view class="actions">
        <button class="primary" @click="goRegister">
          {{ t.getStarted }} <text>→</text>
        </button>
        <button class="secondary" @click="goLogin">
          {{ t.signIn }}
        </button>
        <view class="terms">
          {{ t.termsLeft }} <text>{{ t.termsLink }}</text>
        </view>
      </view>

      <view v-if="localeOpen" class="locale-backdrop" @click="closeLocaleSheet" />
      <view v-if="localeOpen" class="locale-sheet">
        <view class="sheet-handle" />
        <view class="sheet-head">
          <view class="sheet-title">{{ t.languageTitle }}</view>
          <button class="sheet-close" @click="closeLocaleSheet">×</button>
        </view>
        <scroll-view class="locale-list" scroll-y>
          <view v-for="priority in [0, 1, 2, 3]" :key="priority" class="locale-group">
            <view class="group-title">{{ PRIORITY_LABELS[priority as 0 | 1 | 2 | 3] }}</view>
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
                <text>{{ item.englishName }} · {{ item.region }}{{ item.isRTL ? ' · RTL' : '' }}</text>
              </view>
              <text v-if="item.code === locale" class="check">✓</text>
            </button>
          </view>
          <view class="sheet-footnote">{{ t.languageFootnote }}</view>
        </scroll-view>
      </view>
    </view>
  </AppShell>
</template>

<style scoped>
.intro-page {
  position: relative;
  min-height: calc(100vh - 180rpx);
  overflow: hidden;
  margin: 0 -32rpx -48rpx;
  padding: 0 48rpx 60rpx;
}

.glow,
.top-vignette,
.dot-grid,
.pulse-node {
  pointer-events: none;
  position: absolute;
}

.glow {
  inset: -220rpx -160rpx auto;
  height: 560rpx;
  background: radial-gradient(80% 70% at 50% 0%, rgba(198, 255, 58, 0.22), transparent 64%);
}

.top-vignette {
  top: 0;
  left: -40rpx;
  right: -40rpx;
  height: 260rpx;
  background: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, .82) 32%, rgba(0, 0, 0, .42) 68%, transparent 100%);
}

.dot-grid {
  inset: 0;
  opacity: .24;
  background-image: radial-gradient(rgba(198, 255, 58, .28) 1rpx, transparent 1rpx);
  background-size: 34rpx 34rpx;
}

.pulse-node {
  z-index: 1;
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #c6ff3a;
  animation: pulse-node 2.8s ease-in-out infinite;
}

.locale-row {
  position: relative;
  z-index: 4;
  display: flex;
  justify-content: flex-end;
  padding: 8rpx 4rpx 0;
}

.locale-button {
  display: inline-flex;
  width: auto;
  height: 56rpx;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 0;
  border: 0;
  border-radius: 999rpx;
  background: transparent;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 800;
}

uni-button.locale-button {
  display: inline-flex;
  width: auto;
  height: 56rpx;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
}

.locale-icon {
  width: 34rpx;
  height: 34rpx;
}

.locale-chevron {
  width: 28rpx;
  height: 28rpx;
  transition: transform .16s ease;
}

.locale-chevron.open {
  transform: rotate(180deg);
}

.orb-wrap {
  position: relative;
  z-index: 3;
  display: grid;
  height: 410rpx;
  place-items: center;
  padding-top: 16rpx;
}

.compute-orb {
  position: relative;
  width: 480rpx;
  height: 480rpx;
  transform: scale(.92);
}

.compute-orb::after {
  position: absolute;
  left: 90rpx;
  right: 90rpx;
  bottom: 28rpx;
  height: 62rpx;
  border-radius: 999rpx;
  background: rgba(198, 255, 58, .18);
  filter: blur(28rpx);
  content: "";
}

.orbit {
  position: absolute;
  border-radius: 50%;
}

.orbit.outer {
  inset: 24rpx;
  border: 1rpx dashed rgba(255, 255, 255, .16);
}

.orbit.middle {
  inset: 96rpx;
  border: 1rpx solid rgba(255, 255, 255, .10);
}

.satellite {
  position: absolute;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #c6ff3a;
  box-shadow: 0 0 22rpx rgba(198, 255, 58, .6);
  animation: satellite 2.4s ease-in-out infinite;
}

.satellite.top { top: -6rpx; left: 50%; margin-left: -6rpx; }
.satellite.right { right: -6rpx; top: 50%; margin-top: -6rpx; animation-delay: .3s; }
.satellite.bottom { bottom: -6rpx; left: 50%; margin-left: -6rpx; animation-delay: .6s; }
.satellite.left { left: -6rpx; top: 50%; margin-top: -6rpx; animation-delay: .9s; }

.travel-node {
  position: absolute;
  top: -9rpx;
  left: 50%;
  width: 18rpx;
  height: 18rpx;
  margin-left: -9rpx;
  border-radius: 50%;
  background: #c6ff3a;
  box-shadow: 0 0 28rpx rgba(198, 255, 58, .7);
  transform-origin: 9rpx 225rpx;
  animation: travel 9s linear infinite;
}

.pulse-ring {
  position: absolute;
  inset: 156rpx;
  border: 2rpx solid rgba(198, 255, 58, .5);
  border-radius: 50%;
  animation: ring 2.6s ease-out infinite;
}

.pulse-ring.two {
  animation-delay: 1.3s;
}

.chip {
  position: absolute;
  top: 180rpx;
  left: 180rpx;
  display: grid;
  width: 120rpx;
  height: 120rpx;
  place-items: center;
  border: 1rpx solid rgba(198, 255, 58, .52);
  border-radius: 28rpx;
  background:
    radial-gradient(circle at 50% 36%, rgba(198, 255, 58, .16), transparent 54%),
    linear-gradient(180deg, #20242b, #070707);
  box-shadow: 0 0 90rpx rgba(198, 255, 58, .13);
}

.die {
  display: grid;
  width: 58rpx;
  height: 58rpx;
  place-items: center;
  border: 1rpx solid rgba(198, 255, 58, .58);
  border-radius: 10rpx;
  background: radial-gradient(circle, #171d1a, #000);
  color: #c6ff3a;
  font-size: 28rpx;
  font-weight: 800;
}

.led {
  position: absolute;
  top: 26rpx;
  left: 50%;
  width: 8rpx;
  height: 8rpx;
  margin-left: -4rpx;
  border-radius: 50%;
  background: #c6ff3a;
  animation: led 1.4s ease-in-out infinite;
}

.pin-row,
.pin-col {
  position: absolute;
  display: flex;
  gap: 18rpx;
}

.pin-row {
  left: 18rpx;
}

.pin-row.top { top: -8rpx; }
.pin-row.bottom { bottom: -8rpx; }

.pin-row text {
  width: 2rpx;
  height: 8rpx;
  background: rgba(198, 255, 58, .48);
}

.pin-col {
  top: 18rpx;
  flex-direction: column;
}

.pin-col.left { left: -8rpx; }
.pin-col.right { right: -8rpx; }

.pin-col text {
  width: 8rpx;
  height: 2rpx;
  background: rgba(198, 255, 58, .48);
}

.copy {
  position: relative;
  z-index: 3;
  text-align: center;
}

.title {
  color: #ffffff;
  font-size: 56rpx;
  font-weight: 760;
  letter-spacing: -1rpx;
  line-height: 1.13;
}

.subtitle {
  margin: 22rpx auto 0;
  max-width: 620rpx;
  color: #99a3b3;
  font-size: 27rpx;
  line-height: 1.55;
}

.stats-pill {
  display: inline-flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 36rpx;
  padding: 14rpx 24rpx;
  border: 1rpx solid #242a35;
  border-radius: 999rpx;
  background: rgba(15, 15, 15, .82);
  backdrop-filter: blur(12px);
}

.stat-left {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.live-dot,
.stat-split {
  border-radius: 50%;
}

.live-dot {
  width: 10rpx;
  height: 10rpx;
  background: #c6ff3a;
}

.stat-split {
  width: 5rpx;
  height: 5rpx;
  background: #3a4250;
}

.stat-strong,
.stat-brand {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 23rpx;
  font-weight: 800;
}

.stat-strong {
  color: #ffffff;
}

.stat-brand {
  color: #c6ff3a;
}

.stat-muted {
  color: #99a3b3;
  font-size: 22rpx;
}

.actions {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  padding: 72rpx 0 8rpx;
}

.primary,
.secondary {
  display: flex;
  width: 100%;
  height: 108rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  font-size: 29rpx;
  font-weight: 760;
}

uni-button.primary,
uni-button.secondary {
  display: flex;
  width: 100%;
  height: 108rpx;
  align-items: center;
  justify-content: center;
}

.primary {
  background: #c6ff3a;
  color: #10140a;
}

.secondary {
  border: 1rpx solid #242a35;
  background: #10141d;
  color: #ffffff;
}

.primary text {
  margin-left: 10rpx;
}

.terms {
  text-align: center;
  color: #697386;
  font-size: 23rpx;
}

.terms text {
  color: #99a3b3;
}

.locale-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(0, 0, 0, .62);
  backdrop-filter: blur(10px);
}

.locale-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 90;
  max-height: 80vh;
  overflow: hidden;
  border-top: 1rpx solid #2a2a2a;
  border-radius: 56rpx 56rpx 0 0;
  background: #0b0b0b;
  box-shadow: 0 -24rpx 80rpx rgba(0, 0, 0, .62);
}

.sheet-handle {
  width: 80rpx;
  height: 8rpx;
  margin: 16rpx auto 0;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, .15);
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 40rpx 22rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, .08);
}

.sheet-title {
  color: #ffffff;
  font-size: 31rpx;
  font-weight: 760;
}

.sheet-close {
  display: grid;
  width: 88rpx;
  height: 88rpx;
  place-items: center;
  margin-right: -24rpx;
  border-radius: 50%;
  background: transparent;
  color: rgba(255, 255, 255, .6);
  font-size: 42rpx;
}

uni-button.sheet-close {
  display: grid;
  width: 88rpx;
  height: 88rpx;
  place-items: center;
  background: transparent;
  color: rgba(255, 255, 255, .6);
}

.locale-list {
  max-height: calc(80vh - 136rpx);
  padding: 6rpx 16rpx 32rpx;
  box-sizing: border-box;
}

.locale-group {
  margin-top: 16rpx;
}

.group-title {
  padding: 18rpx 24rpx 10rpx;
  color: #5f6a7e;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 21rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
  text-transform: uppercase;
}

.locale-option {
  display: flex;
  width: 100%;
  height: 112rpx;
  align-items: center;
  gap: 22rpx;
  padding: 0 24rpx;
  border-radius: 24rpx;
  background: transparent;
  color: #ffffff;
  text-align: left;
}

uni-button.locale-option {
  display: flex;
  width: 100%;
  height: 112rpx;
  align-items: center;
  gap: 22rpx;
  padding: 0 24rpx;
}

.locale-option.active {
  background: rgba(198, 255, 58, .08);
}

.flag {
  width: 48rpx;
  font-size: 38rpx;
  line-height: 1;
}

.locale-copy {
  min-width: 0;
  flex: 1;
}

.locale-copy view {
  overflow: hidden;
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.locale-option.active .locale-copy view {
  color: #c6ff3a;
}

.locale-copy text {
  display: block;
  overflow: hidden;
  margin-top: 7rpx;
  color: #5f6a7e;
  font-size: 23rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.check {
  color: #c6ff3a;
  font-size: 34rpx;
  font-weight: 800;
}

.sheet-footnote {
  padding: 22rpx 24rpx 36rpx;
  color: #5f6a7e;
  font-size: 22rpx;
  line-height: 1.45;
}

@keyframes pulse-node {
  0%, 100% { opacity: .18; box-shadow: 0 0 0 rgba(198, 255, 58, 0); }
  50% { opacity: 1; box-shadow: 0 0 24rpx rgba(198, 255, 58, .65); }
}

@keyframes satellite {
  0%, 100% { opacity: .35; }
  50% { opacity: 1; }
}

@keyframes travel {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes ring {
  from { transform: scale(.55); opacity: .58; }
  75%, to { transform: scale(2.2); opacity: 0; }
}

@keyframes led {
  0%, 100% { opacity: 1; }
  50% { opacity: .25; }
}
</style>
