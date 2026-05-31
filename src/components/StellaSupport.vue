<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { getStellaMessages, useActiveLocale } from '@/utils/i18n'

const locale = useActiveLocale()
const t = computed(() => getStellaMessages(locale.value))
const isOpen = ref(false)
const mode = ref<'stella' | 'agent'>('stella')
const draft = ref('')
const unread = ref(2)
const messages = ref<Array<{ id: number; sender: 'stella' | 'user' | 'system'; text: string }>>([
  { id: 1, sender: 'stella', text: t.value.intro1 },
  { id: 2, sender: 'stella', text: t.value.intro2 }
])

const quickPrompts = computed(() => [
  { key: 'explain', emoji: '📈', label: t.value.qExplainToday },
  { key: 'boost', emoji: '🎯', label: t.value.qHowToBoost },
  { key: 'hot', emoji: '🔥', label: t.value.qWhatsHot },
  { key: 'jobs', emoji: '💎', label: t.value.qShowTopJobs }
])

function openDrawer() {
  isOpen.value = true
  unread.value = 0
}

function closeDrawer() {
  isOpen.value = false
}

function enterAgent() {
  mode.value = 'agent'
  messages.value.push({ id: Date.now(), sender: 'system', text: t.value.sysConnectedHuman })
}

function backToAi() {
  mode.value = 'stella'
  messages.value.push({ id: Date.now(), sender: 'system', text: t.value.sysBackToAi })
}

function send(text?: string) {
  const value = (text ?? draft.value).trim()
  if (!value) return
  draft.value = ''
  messages.value.push({ id: Date.now(), sender: 'user', text: value })
  nextTick(() => {
    setTimeout(() => {
      messages.value.push({
        id: Date.now() + 1,
        sender: 'stella',
        text: mode.value === 'agent' ? t.value.agentReply : t.value.demoReply
      })
    }, mode.value === 'agent' ? 700 : 420)
  })
}

watch(locale, () => {
  const onlyPreset = messages.value.length === 2 && messages.value[0]?.id === 1 && messages.value[1]?.id === 2
  if (!onlyPreset) return
  messages.value = [
    { id: 1, sender: 'stella', text: t.value.intro1 },
    { id: 2, sender: 'stella', text: t.value.intro2 }
  ]
})
</script>

<template>
  <view class="stella-support">
    <view v-if="!isOpen" class="stella-float">
      <button class="stella-button stella-pulse" aria-label="Open Stella" @click="openDrawer">
        <view class="avatar-wrap">
          <image class="avatar" src="/src/static/stella-avatar.png" mode="aspectFill" />
          <view class="avatar-halo" />
        </view>
        <text v-if="unread" class="badge">{{ unread > 9 ? '9+' : unread }}</text>
      </button>
    </view>

    <view v-if="isOpen" class="drawer-layer">
      <view class="drawer-backdrop" @click="closeDrawer" />
      <view class="drawer">
        <view class="handle" />
        <view class="drawer-head">
          <image v-if="mode === 'stella'" class="head-avatar" src="/src/static/stella-avatar.png" mode="aspectFill" />
          <view v-else class="agent-avatar">◎</view>
          <view class="identity">
            <text class="name">{{ mode === 'stella' ? t.name : t.liveAgent }}</text>
            <view class="role-row">
              <text class="online-dot" :class="{ agent: mode === 'agent' }" />
              <text>{{ mode === 'stella' ? t.role : t.agentRole }}</text>
            </view>
          </view>
          <button v-if="mode === 'stella'" class="switch-btn agent-switch" @click="enterAgent">
            <view class="support-icon headphones" />
            <text>{{ t.liveAgent }}</text>
          </button>
          <button v-else class="switch-btn" @click="backToAi">
            <view class="support-icon arrow-left" />
            <text>{{ t.backToAi }}</text>
          </button>
          <button class="close-btn" aria-label="Close" @click="closeDrawer">×</button>
        </view>

        <scroll-view class="messages" scroll-y>
          <view class="empty" v-if="!messages.length">
            <image class="empty-avatar" src="/src/static/stella-avatar.png" mode="aspectFill" />
            <text>{{ t.emptyHint }}</text>
          </view>
          <view
            v-for="item in messages"
            :key="item.id"
            class="message-line"
            :class="{ mine: item.sender === 'user', system: item.sender === 'system' }"
          >
            <text v-if="item.sender === 'system'" class="system-text">{{ item.text }}</text>
            <view v-else class="message-bubble" :class="{ user: item.sender === 'user', agent: mode === 'agent' && item.sender === 'stella' }">
              <text>{{ item.text }}</text>
            </view>
          </view>
        </scroll-view>

        <scroll-view v-if="mode === 'stella'" scroll-x class="quick-scroll" :show-scrollbar="false">
          <view class="quick-track">
            <button v-for="item in quickPrompts" :key="item.key" class="quick-chip" @click="send(item.label)">
              <text>{{ item.emoji }}</text>
              <text>{{ item.label }}</text>
            </button>
          </view>
        </scroll-view>

        <view class="input-row">
          <input
            v-model="draft"
            class="chat-input"
            :placeholder="mode === 'agent' ? t.agentInputPlaceholder : t.inputPlaceholder"
            confirm-type="send"
            @confirm="send()"
          />
          <button class="send-btn" :class="{ ready: draft.trim() }" :aria-label="t.send" @click="send()">
            <view class="send-icon" />
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.stella-support {
  pointer-events: none;
}

.stella-float {
  position: fixed;
  right: 32rpx;
  bottom: 200rpx;
  z-index: 70;
  pointer-events: auto;
  animation: stella-float 3.4s ease-in-out infinite;
  will-change: transform;
}

.stella-button {
  position: relative;
  display: grid;
  width: 96rpx;
  height: 96rpx;
  padding: 0;
  place-items: center;
  border: 1rpx solid rgba(198, 255, 58, 0.45);
  border-radius: 50%;
  background: #0f0f0f;
  box-shadow: 0 0 48rpx rgba(198, 255, 58, 0.25);
  overflow: visible;
}

.avatar-wrap {
  position: relative;
  width: 72rpx;
  height: 72rpx;
}

.avatar,
.head-avatar,
.empty-avatar {
  display: block;
  border-radius: 50%;
  object-fit: cover;
}

.avatar {
  width: 72rpx;
  height: 72rpx;
  box-shadow:
    0 0 0 3rpx rgba(198, 255, 58, 0.34),
    0 8rpx 20rpx rgba(0, 0, 0, 0.35);
}

.avatar-halo {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  animation: stella-halo 1.8s ease-in-out infinite;
}

.badge {
  position: absolute;
  top: 0;
  right: -2rpx;
  display: grid;
  min-width: 34rpx;
  height: 34rpx;
  padding: 0 7rpx;
  box-sizing: border-box;
  place-items: center;
  border: 3rpx solid #050505;
  border-radius: 999rpx;
  background: #ff3b30;
  color: #ffffff;
  font-size: 18rpx;
  font-weight: 760;
  line-height: 1;
  box-shadow:
    0 0 0 1rpx rgba(255, 255, 255, 0.18),
    0 0 16rpx rgba(255, 59, 48, 0.58);
}

.drawer-layer {
  position: fixed;
  inset: 0;
  z-index: 90;
  pointer-events: auto;
}

.drawer-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(8, 8, 12, 0.45);
  backdrop-filter: blur(16rpx);
  -webkit-backdrop-filter: blur(16rpx);
}

.drawer {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  top: 18%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 48rpx 48rpx 0 0;
  background: #11151b;
  animation: drawer-in 360ms cubic-bezier(.2, .85, .22, 1) both;
}

.handle {
  width: 80rpx;
  height: 8rpx;
  margin: 16rpx auto 10rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.16);
}

.drawer-head {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 0 40rpx 24rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);
}

.head-avatar,
.agent-avatar {
  width: 80rpx;
  height: 80rpx;
  flex: 0 0 auto;
}

.head-avatar {
  box-shadow:
    0 0 0 3rpx rgba(198, 255, 58, 0.34),
    0 0 20rpx rgba(198, 255, 58, 0.18);
}

.agent-avatar {
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(124, 92, 255, 0.16);
  color: #7c5cff;
  font-size: 42rpx;
}

.identity {
  min-width: 0;
  flex: 1;
}

.name {
  display: block;
  overflow: hidden;
  color: #f8fafc;
  font-size: 28rpx;
  font-weight: 660;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 4rpx;
  color: rgba(232, 237, 248, 0.56);
  font-size: 23rpx;
}

.online-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #12c979;
  animation: tiny-pulse 1.6s ease-in-out infinite;
}

.online-dot.agent {
  background: #7c5cff;
}

.switch-btn,
.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 72rpx;
  border: 0;
  border-radius: 999rpx;
}

.switch-btn {
  gap: 10rpx;
  padding: 0 22rpx;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(232, 237, 248, 0.72);
  font-size: 24rpx;
  font-weight: 560;
}

.agent-switch {
  background: rgba(124, 92, 255, 0.14);
  color: #9b89e0;
}

.support-icon,
.send-icon {
  width: 28rpx;
  height: 28rpx;
  background: currentColor;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.support-icon.headphones {
  -webkit-mask-image: url('/static/icons/support-headphones.svg');
  mask-image: url('/static/icons/support-headphones.svg');
}

.support-icon.arrow-left {
  -webkit-mask-image: url('/static/icons/support-arrow-left.svg');
  mask-image: url('/static/icons/support-arrow-left.svg');
}

.close-btn {
  width: 72rpx;
  flex: 0 0 auto;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(232, 237, 248, 0.56);
  font-size: 40rpx;
}

.messages {
  min-height: 0;
  flex: 1;
  padding: 28rpx 32rpx;
  box-sizing: border-box;
}

.empty {
  display: grid;
  justify-items: center;
  gap: 18rpx;
  padding: 48rpx 32rpx;
  color: rgba(232, 237, 248, 0.56);
  font-size: 25rpx;
  line-height: 1.55;
  text-align: center;
}

.empty-avatar {
  width: 112rpx;
  height: 112rpx;
}

.message-line {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 20rpx;
}

.message-line.mine {
  justify-content: flex-end;
}

.message-line.system {
  justify-content: center;
}

.system-text {
  color: rgba(232, 237, 248, 0.38);
  font-size: 22rpx;
}

.message-bubble {
  max-width: 82%;
  padding: 18rpx 24rpx;
  border-radius: 36rpx;
  background: rgba(255, 255, 255, 0.07);
  color: #f8fafc;
  font-size: 25rpx;
  line-height: 1.55;
}

.message-bubble.user {
  background: #c6ff3a;
  color: #10140a;
}

.message-bubble.agent {
  background: rgba(124, 92, 255, 0.14);
  color: #b9aef8;
}

.quick-scroll {
  width: 100%;
  padding: 16rpx 24rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.08);
  box-sizing: border-box;
  white-space: nowrap;
}

.quick-track {
  display: inline-flex;
  gap: 12rpx;
}

.quick-chip {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  height: 64rpx;
  padding: 0 24rpx;
  border: 0;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(232, 237, 248, 0.78);
  font-size: 24rpx;
  font-weight: 560;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx 76rpx;
  box-sizing: border-box;
}

.chat-input {
  height: 88rpx;
  min-width: 0;
  flex: 1;
  padding: 0 32rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.07);
  color: #f8fafc;
  font-size: 26rpx;
}

.send-btn {
  display: grid;
  width: 88rpx;
  height: 88rpx;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(232, 237, 248, 0.38);
}

.send-btn.ready {
  background: #c6ff3a;
  color: #10140a;
}

.send-icon {
  width: 32rpx;
  height: 32rpx;
  -webkit-mask-image: url('/static/icons/support-send.svg');
  mask-image: url('/static/icons/support-send.svg');
}

@keyframes stella-float {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, -8rpx, 0); }
}

@keyframes stella-pulse {
  0%, 100% {
    box-shadow:
      0 0 48rpx rgba(198, 255, 58, 0.28),
      0 0 0 0 rgba(198, 255, 58, 0.45);
  }
  70% {
    box-shadow:
      0 0 48rpx rgba(198, 255, 58, 0.28),
      0 0 0 28rpx rgba(198, 255, 58, 0);
  }
}

.stella-pulse {
  animation: stella-pulse 2s ease-out infinite;
}

@keyframes stella-halo {
  0% { box-shadow: 0 0 0 0 rgba(198, 255, 58, 0.6); }
  70% { box-shadow: 0 0 0 20rpx rgba(198, 255, 58, 0); }
  100% { box-shadow: 0 0 0 0 rgba(198, 255, 58, 0); }
}

@keyframes drawer-in {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes tiny-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(1.3); }
}
</style>
