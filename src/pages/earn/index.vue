<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '@/components/AppShell.vue'
import { requireAuth } from '@/utils/auth-guard'

type Range = 'Today' | 'Week' | 'Month' | 'All'

const range = ref<Range>('Today')

onShow(() => {
  requireAuth()
})

const totals: Record<Range, number> = {
  Today: 247.83,
  Week: 1247.65,
  Month: 4821.20,
  All: 18642.55
}

const total = computed(() => totals[range.value])
const intPart = computed(() => Math.floor(total.value).toLocaleString())
const centsPart = computed(() => String(Math.floor(total.value * 100) % 100).padStart(2, '0'))

const rangeMeta = computed(() => {
  if (range.value === 'Today') return '+5.2% · 14 jobs · 7d streak'
  if (range.value === 'Week') return '+8.1% · 98 jobs · 7d streak'
  if (range.value === 'Month') return '+12.4% · 412 jobs · 7d streak'
  return '+47.3% · 1,247 jobs'
})

const devices = [
  { name: 'Phone node', sub: 'Mobile NPU · active', earned: '$0.06', uptime: '98%', pct: 42, icon: '▯' },
  { name: 'Cloud Share trial', sub: 'Managed slice · ready', earned: '$0.00', uptime: 'idle', pct: 0, icon: '◇' }
]

const marketRows = [
  { label: 'Image gen', demand: 'High', pay: '$0.00048/job', color: '#c6ff3a' },
  { label: 'LLM routing', demand: 'Live', pay: '$0.00021/job', color: '#58e7ff' },
  { label: 'Speech', demand: 'Stable', pay: '$0.00005/job', color: '#9b89e0' }
]

const tasks = [
  { title: 'Keep phone online for 30 min', reward: '+30 NEX', status: 'Ready' },
  { title: 'Review S1 ROI card', reward: '+100 NEX', status: 'Ready' },
  { title: 'Invite one qualified operator', reward: '+200 NEX + $1', status: 'Ready' }
]

function showSoon(label: string) {
  uni.showToast({ title: `${label} coming soon`, icon: 'none' })
}
</script>

<template>
  <AppShell title="Earn" version="" active-tab="earn">
    <scroll-view class="page" scroll-y>
      <view class="earn-stack">
        <view class="pill-tabs">
          <view v-for="item in ['Today', 'Week', 'Month', 'All']" :key="item" class="tab-pill" :class="{ on: range === item }" @click="range = item as Range">
            {{ item }}
          </view>
        </view>

        <view class="total-card card">
          <view class="aurora" />
          <view class="dot-field">
            <i v-for="n in 5" :key="n" :style="{ left: `${12 + n * 16}%`, animationDelay: `${n * 1.4}s` }" />
          </view>
          <view class="card-content">
            <view class="total-top">
              <text>Compute earned · {{ range.toLowerCase() }}</text>
              <b>USDT</b>
            </view>
            <view class="total-money"><text>$</text>{{ intPart }}<i>.{{ centsPart }}</i></view>
            <view class="success-line">↑ {{ rangeMeta }}</view>
            <view class="split-track"><view class="production" /><view class="premium" /></view>
            <view class="split-grid">
              <view>
                <text><i class="green" /> Production</text>
                <b>${{ (total * 0.76).toFixed(2) }}</b>
                <em>phone + box jobs</em>
              </view>
              <view>
                <text><i class="brand" /> AI Premium</text>
                <b>${{ (total * 0.24).toFixed(2) }}</b>
                <em>+NEX bonus</em>
              </view>
            </view>
          </view>
        </view>

        <view class="missed-card card">
          <view>
            <text class="mono muted">Missed income</text>
            <view class="card-title">$38.44 left on the table today.</view>
            <p>A dedicated NexionBox S1 can unlock the hardware pool while your phone stays in the mobile lane.</p>
          </view>
          <button @click="showSoon('Store')">Compare <text>›</text></button>
        </view>

        <view class="trial-card card">
          <view class="ticket">FREE TRIAL</view>
          <view class="card-title">Activate a managed Cloud Share slot.</view>
          <p>Start a 24h trial before buying hardware. Earnings and task history stay visible here.</p>
          <view class="trial-actions">
            <button @click="showSoon('Trial')">Start trial</button>
            <text>Instant activation</text>
          </view>
        </view>

        <view class="ghost-slot">
          <view class="ghost-icon">+</view>
          <view>
            <b>Trial ghost slot</b>
            <text>Reserved for your first cloud-share activation.</text>
          </view>
          <i>0 / 1</i>
        </view>

        <view class="section-title">
          <b>My devices</b>
          <text>0 / 6</text>
        </view>
        <view v-for="device in devices" :key="device.name" class="device-card card">
          <view class="device-icon">{{ device.icon }}</view>
          <view class="device-main">
            <view>
              <b>{{ device.name }}</b>
              <text>{{ device.sub }}</text>
            </view>
            <view class="device-meter"><view :style="{ width: `${device.pct}%` }" /></view>
          </view>
          <view class="device-stat">
            <b>{{ device.earned }}</b>
            <text>{{ device.uptime }}</text>
          </view>
        </view>

        <view class="empty-card card">
          <view>
            <text class="mono muted">Empty slots</text>
            <view class="card-title">5 hardware slots open.</view>
          </view>
          <button @click="showSoon('Add device')">Add device</button>
        </view>

        <view class="lifecycle-card card">
          <view class="mono muted">Fleet lifecycle</view>
          <view class="card-title">Keep active devices above 95% uptime to avoid yield decay.</view>
          <view class="lifecycle-grid">
            <view><b>Grace</b><text>24h</text></view>
            <view><b>Decay</b><text>-12%</text></view>
            <view><b>Recover</b><text>instant</text></view>
          </view>
        </view>

        <view class="section-title">
          <b>Market Overview</b>
          <text>live demand</text>
        </view>
        <view class="market-card card">
          <view v-for="row in marketRows" :key="row.label" class="market-row">
            <i :style="{ background: row.color }" />
            <view><b>{{ row.label }}</b><text>{{ row.demand }}</text></view>
            <em>{{ row.pay }}</em>
          </view>
        </view>

        <view class="lock-card card">
          <view>
            <text class="mono muted">Premium tasks above your tier</text>
            <view class="card-title">Hardware owners unlock AI Premium, fine-tune, and 405B inference queues.</view>
          </view>
          <view class="lock-grid">
            <text>Fine-tune</text>
            <text>Video gen</text>
            <text>405B LLM</text>
          </view>
        </view>

        <view class="section-title">
          <b>Task Center</b>
          <text>3 ready</text>
        </view>
        <view class="task-center card">
          <view v-for="task in tasks" :key="task.title" class="task-row">
            <view><b>{{ task.title }}</b><text>{{ task.status }}</text></view>
            <i>{{ task.reward }}</i>
          </view>
        </view>
      </view>
    </scroll-view>
  </AppShell>
</template>

<style scoped>
.page { height: 100vh; }
.earn-stack { padding-bottom: 180rpx; color: #f7f9fc; }
.card { border: 1rpx solid rgba(255,255,255,.08); border-radius: 32rpx; background: #10141d; box-sizing: border-box; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.muted { color: #8f98a8; font-size: 23rpx; }
.pill-tabs { display: flex; gap: 4rpx; margin-top: 24rpx; padding: 6rpx; border-radius: 24rpx; background: #161b25; }
.tab-pill { display: flex; flex: 1; height: 64rpx; align-items: center; justify-content: center; border-radius: 18rpx; background: transparent; color: #99a3b3; font-size: 25rpx; font-weight: 560; }
.pill-tabs .on { background: rgba(198,255,58,.12); color: #c6ff3a; box-shadow: 0 0 34rpx rgba(198,255,58,.12); }
.total-card { position: relative; overflow: hidden; margin-top: 24rpx; padding: 34rpx; box-shadow: 0 30rpx 90rpx rgba(0,0,0,.28); }
.aurora { position: absolute; inset: -30% -10% auto -10%; height: 220%; background: radial-gradient(circle at 20% 0%, rgba(88,231,255,.16), transparent 40%), radial-gradient(circle at 86% 86%, rgba(255,107,53,.16), transparent 42%), radial-gradient(circle at 48% 40%, rgba(198,255,58,.12), transparent 45%); filter: blur(18rpx); animation: drift 14s ease-in-out infinite alternate; }
.dot-field { position: absolute; inset: 0; overflow: hidden; }
.dot-field i { position: absolute; bottom: -8rpx; width: 8rpx; height: 8rpx; border-radius: 50%; background: #c6ff3a; opacity: 0; animation: dot 8s linear infinite; }
.card-content { position: relative; z-index: 1; }
.total-top { display: flex; justify-content: space-between; align-items: center; gap: 20rpx; }
.total-top text { color: #8f98a8; font-size: 22rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.total-top b { padding: 4rpx 14rpx; border-radius: 8rpx; background: rgba(198,255,58,.12); color: #c6ff3a; font-size: 21rpx; }
.total-money { display: flex; align-items: baseline; margin-top: 22rpx; color: #fff; font-size: 92rpx; font-weight: 760; line-height: 1; letter-spacing: -2rpx; }
.total-money text { color: #99a3b3; font-size: 42rpx; font-weight: 560; }
.total-money i { color: #99a3b3; font-size: 58rpx; font-style: normal; }
.success-line { margin-top: 12rpx; color: #12c979; font-size: 24rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.split-track { display: flex; height: 8rpx; margin-top: 28rpx; overflow: hidden; border-radius: 999rpx; background: #242a35; opacity: .85; }
.production { flex: 76; background: #12c979; }
.premium { flex: 24; background: #c6ff3a; }
.split-grid, .lifecycle-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 20rpx; margin-top: 24rpx; }
.split-grid text { display: flex; align-items: center; gap: 10rpx; color: #99a3b3; font-size: 23rpx; }
.split-grid text i { width: 12rpx; height: 12rpx; border-radius: 4rpx; }
.split-grid .green { background: #12c979; }
.split-grid .brand { background: #c6ff3a; }
.split-grid b { display: block; margin-top: 8rpx; color: #fff; font-size: 29rpx; }
.split-grid em { display: block; margin-top: 4rpx; color: #8f98a8; font-style: normal; font-size: 22rpx; }
.missed-card, .empty-card { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 22rpx; margin-top: 24rpx; padding: 28rpx 32rpx; background: radial-gradient(circle at 100% 0, rgba(255,203,77,.12), transparent 50%), #10141d; }
.card-title { margin-top: 8rpx; color: #fff; font-size: 31rpx; font-weight: 720; line-height: 1.28; }
p { margin: 10rpx 0 0; color: #99a3b3; font-size: 24rpx; line-height: 1.45; }
button { height: 72rpx; padding: 0 28rpx; border-radius: 999rpx; background: #c6ff3a; color: #10140a; font-size: 25rpx; font-weight: 700; white-space: nowrap; }
.trial-card, .ghost-slot, .lifecycle-card, .lock-card, .task-center, .market-card { margin-top: 24rpx; padding: 30rpx 32rpx; }
.ticket { display: inline-flex; padding: 6rpx 14rpx; border: 1rpx dashed rgba(18,201,121,.46); border-radius: 8rpx; color: #12c979; font-size: 19rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 2rpx; }
.trial-actions { display: flex; align-items: center; gap: 20rpx; margin-top: 24rpx; }
.trial-actions text { color: #8f98a8; font-size: 22rpx; }
.ghost-slot { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 20rpx; border: 1rpx dashed rgba(198,255,58,.22); border-radius: 32rpx; background: rgba(198,255,58,.04); }
.ghost-icon { display: grid; width: 72rpx; height: 72rpx; place-items: center; border-radius: 22rpx; background: rgba(198,255,58,.12); color: #c6ff3a; font-size: 36rpx; }
.ghost-slot b, .device-main b, .market-row b, .task-row b { display: block; color: #fff; font-size: 26rpx; }
.ghost-slot text, .device-main text, .market-row text, .task-row text { display: block; margin-top: 6rpx; color: #8f98a8; font-size: 22rpx; }
.ghost-slot i { color: #8f98a8; font-style: normal; font-size: 22rpx; }
.section-title { display: flex; justify-content: space-between; align-items: center; margin: 42rpx 4rpx 18rpx; }
.section-title b { color: #fff; font-size: 30rpx; }
.section-title text { color: #8f98a8; font-size: 22rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.device-card { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 20rpx; margin-top: 16rpx; padding: 26rpx 30rpx; }
.device-icon { display: grid; width: 76rpx; height: 76rpx; place-items: center; border-radius: 22rpx; background: rgba(88,231,255,.12); color: #58e7ff; font-size: 34rpx; }
.device-meter { height: 9rpx; margin-top: 16rpx; overflow: hidden; border-radius: 999rpx; background: #242a35; }
.device-meter view { height: 100%; border-radius: inherit; background: linear-gradient(90deg,#c6ff3a,#58e7ff); }
.device-stat { text-align: right; }
.device-stat b { color: #12c979; font-size: 27rpx; }
.device-stat text { display: block; margin-top: 6rpx; color: #8f98a8; font-size: 21rpx; }
.lifecycle-grid { grid-template-columns: repeat(3,1fr); }
.lifecycle-grid view { padding: 18rpx; border-radius: 20rpx; background: rgba(255,255,255,.05); }
.lifecycle-grid b { color: #fff; font-size: 25rpx; }
.lifecycle-grid text { display: block; margin-top: 8rpx; color: #c6ff3a; font-size: 24rpx; }
.market-card { padding-top: 8rpx; padding-bottom: 8rpx; }
.market-row, .task-row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 16rpx; padding: 22rpx 0; border-bottom: 1rpx solid rgba(255,255,255,.06); }
.market-row i { width: 12rpx; height: 12rpx; border-radius: 50%; }
.market-row em, .task-row i { color: #12c979; font-style: normal; font-size: 23rpx; font-weight: 700; }
.lock-grid { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 24rpx; }
.lock-grid text { padding: 10rpx 16rpx; border-radius: 999rpx; background: rgba(155,137,224,.14); color: #9b89e0; font-size: 22rpx; }
@keyframes drift { from{transform:translateX(-14rpx)} to{transform:translate(18rpx,10rpx) scale(1.04)} }
@keyframes dot { 0%{opacity:0;transform:translateY(0)} 20%{opacity:.7} 100%{opacity:0;transform:translateY(-360rpx)} }
</style>
