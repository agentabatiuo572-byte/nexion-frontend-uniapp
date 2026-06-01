<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '@/components/AppShell.vue'
import { requireAuth } from '@/utils/auth-guard'
import { getMainPageMessages, useActiveLocale } from '@/utils/i18n'

type Range = 'Today' | 'Week' | 'Month' | 'All'

const range = ref<Range>('Today')
const taskTab = ref<'current' | 'history'>('current')
const locale = useActiveLocale()
const copy = computed(() => getMainPageMessages(locale.value))
const t = computed(() => copy.value.earn)
const v = computed(() => t.value.v5)
const common = computed(() => copy.value.common)
const rangeTabs: Range[] = ['Today', 'Week', 'Month', 'All']

onShow(() => {
  requireAuth()
})

const rangeLabels = computed<Record<Range, string>>(() => ({
  Today: v.value.today,
  Week: v.value.week,
  Month: v.value.month,
  All: v.value.all
}))

const totals: Record<Range, number> = {
  Today: 247.83,
  Week: 1247.65,
  Month: 4821.20,
  All: 18642.55
}

function sparkline(data: number[], height = 18) {
  const width = 100
  const min = Math.min(...data)
  const max = Math.max(...data)
  const rangeValue = max - min || 1
  return data.map((value, index) => {
    const x = index * (width / (data.length - 1))
    const y = height - 1 - ((value - min) / rangeValue) * (height - 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

const total = computed(() => totals[range.value])
const intPart = computed(() => Math.floor(total.value).toLocaleString())
const centsPart = computed(() => String(Math.floor(total.value * 100) % 100).padStart(2, '0'))
const rangeMeta = computed(() => {
  const sevenDays = locale.value === 'zh' ? '7 天' : '7d'
  if (range.value === 'Today') return `+5.2% · 14 ${v.value.jobs} · ${sevenDays} ${v.value.streak}`
  if (range.value === 'Week') return `+8.1% · 98 ${v.value.jobs} · ${sevenDays} ${v.value.streak}`
  if (range.value === 'Month') return `+12.4% · 412 ${v.value.jobs} · ${sevenDays} ${v.value.streak}`
  return `+47.3% · 1,247 ${v.value.jobs}`
})

const priceRows = [
  { emoji: '🖼', label: 'Image Gen', unit: 'per image', price: '$0.0030', delta: '↑ 4.2%', up: true, spark: sparkline([0.4, 0.5, 0.42, 0.55, 0.6, 0.7, 0.72]) },
  { emoji: '💬', label: 'LLM Inference', unit: 'per 1k tok', price: '$0.0024', delta: '↑ 18.7%', up: true, premium: '405B premium ↑32.1%', spark: sparkline([0.3, 0.35, 0.4, 0.42, 0.6, 0.78, 0.88]) },
  { emoji: '🎬', label: 'Video Gen', unit: 'per sec', price: '$0.180', delta: '↓ 1.2%', up: false, spark: sparkline([0.65, 0.7, 0.6, 0.55, 0.62, 0.58, 0.62]) },
  { emoji: '🔧', label: 'Fine-tune', unit: 'per job', price: '$0.060', delta: '→ 0.0%', neutral: true, spark: sparkline([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]) },
  { emoji: '📐', label: 'Embedding', unit: 'per 1k chunks', price: '$0.0008', delta: '↑ 2.1%', up: true, spark: sparkline([0.4, 0.45, 0.4, 0.5, 0.52, 0.55, 0.57]) },
  { emoji: '🎙', label: 'Speech', unit: 'per audio sec', price: '$0.0003', delta: '↑ 0.3%', up: true, spark: sparkline([0.5, 0.48, 0.5, 0.52, 0.5, 0.51, 0.52]) }
]

const deviceRankRows = computed(() => [
  { rank: 1, emoji: '🗄', name: 'NexionRack P1', best: 'Training + 405B LLM', daily: '$142.60/d', top: true },
  { rank: 2, emoji: '📦', name: 'NexionBox Pro', best: 'AI Premium pool', daily: '$76.00/d' },
  { rank: 3, emoji: '📦', name: 'NexionBox S1', best: 'LLM 70B', daily: '$38.50/d' },
  { rank: 4, emoji: '☁', name: 'Inference Share', best: 'Low barrier entry', daily: '$0.07/d' },
  { rank: 5, emoji: '📱', name: v.value.yourPhone, best: 'Mobile NPU tier', daily: '$0.06/d', phone: true }
])

const completedRows = [
  { model: 'SDXL Turbo', type: 'Image Gen', reward: '+$0.000', time: '2m ago' },
  { model: 'Whisper tiny', type: 'Speech', reward: '+$0.000', time: '8m ago' },
  { model: 'MobileBERT', type: 'Embedding', reward: '+$0.000', time: '19m ago' }
]

function showSoon(label: string) {
  uni.showToast({ title: common.value.comingSoon(label), icon: 'none' })
}
</script>

<template>
  <AppShell :title="t.title" version="" active-tab="earn">
    <scroll-view class="page" scroll-y>
      <view class="earn-stack">
        <view class="pill-tabs">
          <button
            v-for="item in rangeTabs"
            :key="item"
            :class="{ on: range === item }"
            @click="range = item"
          >
            {{ rangeLabels[item] }}
          </button>
        </view>

        <view class="total-card">
          <view class="earn-aurora" />
          <view class="dot-field">
            <i v-for="n in 5" :key="n" :style="{ left: `${8 + n * 17}%`, animationDelay: `${(n - 1) * 1.6}s` }" />
          </view>
          <view class="total-inner">
            <view class="total-top">
              <text>{{ v.computeEarned }} · {{ rangeLabels[range].toLowerCase() }}</text>
              <b>USDT</b>
            </view>
            <view class="total-money"><text>$</text>{{ intPart }}<i>.{{ centsPart }}</i></view>
            <view class="success-line">↑ {{ rangeMeta }}</view>
            <view class="breakdown">
              <view class="break-track"><i class="prod" /><i class="premium" /></view>
              <view class="break-grid">
                <view>
                  <text><i class="green-dot" />{{ v.production }}</text>
                  <b>${{ (total * 0.76).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</b>
                  <em>{{ v.productionSub }}</em>
                </view>
                <view>
                  <text><i class="brand-dot" />{{ v.aiPremium }}</text>
                  <b>${{ (total * 0.24).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</b>
                  <em>{{ v.aiPremiumSub }}</em>
                </view>
              </view>
            </view>
          </view>
        </view>

        <view class="missed-card">
          <view class="missed-label">↘ {{ v.missedIncome }}</view>
          <view class="missed-amount"><text>−$</text><b>38.44</b><i>{{ v.vsS1Ceiling }}</i></view>
          <view class="loss-bars">
            <view><text>{{ v.yourPhone }}</text><text>$0.06/d</text></view>
            <i><b class="phone" /></i>
            <view><text>NexionBox S1</text><text>$38.50/d</text></view>
            <i><b class="s1" /></i>
          </view>
          <view class="missed-foot">
            <view><text>{{ v.cumulativeMissed }}</text><b>−$1,384 <i>· 36d</i></b></view>
            <button @click="showSoon(v.stopBleeding)">{{ v.stopBleeding }} <text>→</text></button>
          </view>
        </view>

        <view class="trial-ticket" @click="showSoon(copy.home.freeTrial)">
          <view class="ticket-body">
            <view class="ticket-left">
              <text class="ticket-badge">★ {{ copy.home.freeTrial }}</text>
              <b>NexionBox S1 Trial</b>
              <text>Try hardware yield for 3 days</text>
            </view>
            <view class="ticket-cut" />
            <view class="ticket-value">
              <text>EST. 3D</text>
              <b><text>$</text>116</b>
              <i>$38.50/d × 3</i>
            </view>
          </view>
          <view class="ticket-bottom">
            <text><i />47 trials left</text>
            <b>{{ v.startTrial }} →</b>
          </view>
        </view>

        <view class="ghost-slot">
          <view class="ghost-icon">✦</view>
          <view>
            <b>{{ v.ghostSlot }}</b>
            <text>{{ v.ghostSlotDesc }}</text>
          </view>
          <i>0 / 1</i>
        </view>

        <view class="section-title">
          <b>{{ v.myDevices }}</b>
          <text>1 / 6</text>
        </view>

        <view class="device-card">
          <view class="device-head">
            <view class="device-id">
              <view class="device-icon">▯</view>
              <view><b>{{ v.phoneNode }}</b><text>Mobile NPU · 28 TOPS</text></view>
            </view>
            <view class="online"><i />{{ v.online || 'online' }}</view>
          </view>
          <view class="current-task">
            <text>{{ v.currentTask || 'Current Task' }}</text>
            <b>SDXL Turbo · Image Gen</b>
            <em>#NX-8421 · Pocket Studios · Berlin</em>
            <view class="task-progress"><view /></view>
            <view class="task-meta"><text>~0m 28s {{ v.remaining || 'remaining' }}</text><text>+ $0.000</text></view>
          </view>
          <view class="runtime-row">
            <text>🔋 82%</text>
            <text>⌁ {{ v.phoneNetOnline || 'online' }}</text>
          </view>
          <view class="locked-row">
            <text>🔒 {{ v.lockedTasksTitle || 'Locked AI tasks' }}</text>
            <b>−$157 <i>/d</i></b>
          </view>
          <view class="device-earnings">
            <view><text>{{ v.todayEarnings || 'Today earnings' }}</text><b>$0.060</b><i>+12.0 NEX</i></view>
            <view><text>{{ v.estThisHour || 'Est. this hour' }}</text><b>+$0.00</b><i>+0.5 NEX</i></view>
          </view>
        </view>

        <view class="empty-slots-card" @click="showSoon(v.fillSlots || v.addDevice)">
          <view class="capacity-bg" />
          <view class="capacity-label">↗ {{ v.slotsPotential || 'Potential daily' }}</view>
          <view class="capacity-money"><text>+$</text><b>192</b><i>/day</i><em>{{ v.slotsUntapped || 'untapped' }}</em></view>
          <view class="capacity-sub"><b>5</b> × NexionBox S1 @ $38.50/d</view>
          <view class="slot-grid">
            <view class="filled">▯</view>
            <view v-for="n in 5" :key="n" class="empty">＋</view>
          </view>
          <view class="capacity-stats">
            <view><b>1/6</b><text>{{ v.slotsFilled || 'filled' }}</text></view>
            <view><b>$143</b><text>{{ v.networkAvg || 'network avg' }}</text></view>
            <view><b>Top 6%</b><text>{{ v.rankIfFilled || 'if filled' }}</text></view>
          </view>
          <button>⚡ {{ v.fillSlots || 'Fill slots' }} <text>→</text></button>
        </view>

        <view class="lifecycle-card">
          <view class="life-label">⌁ {{ v.fleetLifecycle }}</view>
          <view class="life-number">98.2% <text>{{ v.lifecycleBody }}</text></view>
          <view class="life-bar"><view /></view>
          <view class="life-foot"><text>{{ v.lifecycleMonthlyLoss || 'monthly loss' }}</text><b>−$0.00 · 0d</b><button>{{ v.lifecycleCta || 'Review' }} →</button></view>
        </view>

        <view class="section-title">
          <b>{{ v.marketOverview }}</b>
          <text><i />{{ v.liveDemand }}</text>
        </view>
        <view class="market-board">
          <view class="market-heading">{{ v.priceIndex || 'AI Workload Price Index' }}</view>
          <view v-for="row in priceRows" :key="row.label" class="price-row">
            <text>{{ row.emoji }}</text>
            <view><b>{{ row.label }}</b><text>{{ row.unit }}</text><em v-if="row.premium">↳ {{ row.premium }}</em></view>
            <i>{{ row.price }}</i>
            <strong :class="{ down: row.up === false, neutral: row.neutral }">{{ row.delta }}</strong>
            <svg viewBox="0 0 100 18" preserveAspectRatio="none">
              <polyline :points="row.spark" fill="none" :stroke="row.up === false ? '#ff7a3d' : '#9EDC1D'" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </view>
        </view>

        <view class="market-board rank-board">
          <view class="market-heading">{{ v.deviceRanking || 'Device earnings ranking' }}</view>
          <view v-for="row in deviceRankRows" :key="row.rank" class="rank-row" :class="{ phone: row.phone }">
            <text>{{ row.rank }}</text>
            <i>{{ row.emoji }}</i>
            <view><b>{{ row.name }} <em v-if="row.top">⭐ Best</em></b><text>{{ row.best }}</text></view>
            <strong>{{ row.daily }}</strong>
            <span v-if="!row.phone">→</span>
          </view>
        </view>

        <view class="network-state">
          <view class="market-heading">{{ v.networkState || 'Network state' }}</view>
          <view><text>{{ v.activeJobs || 'Active jobs' }}</text><b>8,432 globally</b></view>
          <view><text>{{ v.llmQueue || 'LLM queue' }}</text><b>1,247 <i>high — premium pricing</i></b></view>
          <view><text>{{ v.peakHours || 'Peak hours' }}</text><b>14:00-22:00 UTC</b></view>
          <view><text>{{ v.nextDrop || 'Next drop' }}</text><b>Open model release <i>+30% LLM est.</i></b></view>
        </view>

        <view class="task-lock">
          <view class="lock-label">▣ {{ v.premiumLocked }}</view>
          <view class="lock-money">−$140 <text>{{ v.taskLockThisMonth || 'this month' }} · Llama 70B · Flux.1</text></view>
          <view class="lock-progress"><view /></view>
          <view class="lock-foot"><view><text>{{ v.taskLockCumulative || 'cumulative missed' }}</text><b>−$420</b></view><button>{{ v.taskLockCtaUpgrade || v.addDevice }} →</button></view>
        </view>

        <view class="section-title">
          <b>{{ v.taskCenter }}</b>
          <text><i />8,432 {{ v.jobsLive || 'jobs live' }}</text>
        </view>
        <view class="task-tabs">
          <button :class="{ on: taskTab === 'current' }" @click="taskTab = 'current'">{{ v.tabCurrent || 'Current' }}</button>
          <button :class="{ on: taskTab === 'history' }" @click="taskTab = 'history'">{{ v.tabHistory || 'History' }}</button>
        </view>
        <view class="task-center">
          <template v-if="taskTab === 'current'">
            <view class="task-heading">{{ v.currentlyProcessing || 'Currently processing' }}</view>
            <view class="empty-current">{{ v.noActive || 'No active task right now.' }}</view>
            <view class="task-heading lock-title">🔒 {{ v.upgradeUnlocks || 'Upgrade unlocks' }}</view>
            <view class="teaser-row"><text>💬</text><view><b>Llama 70B inference</b><i>{{ v.requires || 'requires' }} 16GB VRAM · S1 tier</i></view><em>+$110/d</em></view>
            <view class="teaser-row"><text>🖼</text><view><b>Flux.1 dev HD</b><i>{{ v.requires || 'requires' }} 12GB VRAM · S1 tier</i></view><em>+$38/d</em></view>
            <view class="task-heading done-title">{{ v.completedToday || 'Completed today' }}</view>
            <view v-for="row in completedRows" :key="row.model" class="completed-row">
              <text>✓</text><view>{{ row.model }} <i>· {{ row.type }}</i></view><b>{{ row.reward }}</b><em>{{ row.time }}</em>
            </view>
          </template>
          <template v-else>
            <view v-for="row in completedRows" :key="`h-${row.model}`" class="completed-row">
              <text>✓</text><view>{{ row.model }} <i>· {{ row.type }}</i></view><b>{{ row.reward }}</b><em>{{ row.time }}</em>
            </view>
          </template>
        </view>
      </view>
    </scroll-view>
  </AppShell>
</template>

<style scoped>
.page { height: 100vh; }
.earn-stack { padding-bottom: 180rpx; color: #f7f9fc; }
button { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; margin: 0; padding: 0; border: 0; line-height: normal; }
button::after { border: 0; }
.pill-tabs { display: flex; gap: 4rpx; margin-top: 24rpx; padding: 6rpx; border-radius: 24rpx; background: #1f1f1f; }
.pill-tabs button { flex: 1; height: 64rpx; border-radius: 18rpx; background: transparent; color: #9ba3b5; font-size: 26rpx; font-weight: 500; }
.pill-tabs .on { background: rgba(158,220,29,.20); color: #9edc1d; font-weight: 600; }
.total-card, .missed-card, .device-card, .market-board, .network-state, .task-lock, .task-center, .lifecycle-card { position: relative; overflow: hidden; margin-top: 24rpx; border: 1rpx solid rgba(255,255,255,.08); border-radius: 32rpx; background: #101010; box-sizing: border-box; }
.total-card { padding: 36rpx; box-shadow: 0 24rpx 80rpx rgba(0,0,0,.36); }
.earn-aurora { position: absolute; inset: -30% -10% auto -10%; height: 220%; background: radial-gradient(circle at 20% 0%, rgba(142,114,255,.18), transparent 40%), radial-gradient(circle at 86% 86%, rgba(255,122,61,.17), transparent 42%); filter: blur(28rpx); animation: drift 14s ease-in-out infinite alternate; }
.dot-field { position: absolute; inset: 0; overflow: hidden; }
.dot-field i { position: absolute; bottom: -8rpx; width: 8rpx; height: 8rpx; border-radius: 50%; background: #9edc1d; opacity: 0; animation: dot 8s linear infinite; }
.total-inner { position: relative; z-index: 1; }
.total-top { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; }
.total-top text { color: #6b7385; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22rpx; letter-spacing: 1rpx; }
.total-top b { padding: 4rpx 14rpx; border-radius: 8rpx; background: rgba(158,220,29,.2); color: #9edc1d; font-size: 21rpx; }
.total-money { display: flex; align-items: baseline; margin-top: 20rpx; color: #f5f7fa; font-size: 96rpx; font-weight: 640; line-height: 1; letter-spacing: -2rpx; }
.total-money text { color: #9ba3b5; font-size: 44rpx; font-weight: 500; }
.total-money i { color: #9ba3b5; font-size: 64rpx; font-style: normal; font-weight: 600; }
.success-line { margin-top: 16rpx; color: #9edc1d; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 24rpx; }
.breakdown { margin-top: 28rpx; padding-top: 28rpx; border-top: 1rpx dashed rgba(255,255,255,.14); }
.break-track { display: flex; height: 8rpx; overflow: hidden; border-radius: 999rpx; background: #2a2a2a; opacity: .7; }
.break-track i { height: 100%; }
.break-track .prod { flex: 76; background: #9edc1d; }
.break-track .premium { flex: 24; background: #9edc1d; opacity: .75; }
.break-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 24rpx; margin-top: 24rpx; }
.break-grid text { display: flex; align-items: center; gap: 10rpx; color: #9ba3b5; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 24rpx; }
.green-dot, .brand-dot { width: 14rpx; height: 14rpx; border-radius: 4rpx; background: #9edc1d; }
.break-grid b { display: block; margin-top: 8rpx; color: #f5f7fa; font-size: 30rpx; }
.break-grid view:last-child b { color: #9edc1d; }
.break-grid em { display: block; margin-top: 4rpx; color: #6b7385; font-size: 23rpx; font-style: normal; }
.missed-card { padding: 32rpx; background: radial-gradient(60% 80% at 92% 50%, rgba(255,122,61,.18), transparent 70%), linear-gradient(140deg, rgba(255,122,61,.12), #101010 58%); }
.missed-label, .life-label, .lock-label { color: #ff7a3d; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22rpx; font-weight: 600; letter-spacing: 2rpx; text-transform: uppercase; }
.missed-amount { display: flex; align-items: baseline; gap: 8rpx; margin-top: 16rpx; }
.missed-amount text, .missed-amount b { color: #ff7a3d; font-size: 60rpx; font-weight: 640; line-height: 1; }
.missed-amount text { font-size: 32rpx; opacity: .78; }
.missed-amount i { color: #8f98a8; font-size: 22rpx; font-style: normal; }
.loss-bars { margin-top: 24rpx; }
.loss-bars view { display: flex; justify-content: space-between; margin: 14rpx 0 8rpx; color: #8f98a8; font-size: 22rpx; }
.loss-bars view text:last-child { color: #f5f7fa; }
.loss-bars i { display: block; height: 8rpx; overflow: hidden; border-radius: 999rpx; background: #1f1f1f; }
.loss-bars b { display: block; height: 100%; border-radius: inherit; }
.loss-bars .phone { width: .2%; background: rgba(155,163,181,.45); }
.loss-bars .s1 { width: 100%; background: rgba(158,220,29,.45); }
.missed-foot, .life-foot, .lock-foot { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; margin-top: 28rpx; }
.missed-foot text, .life-foot text, .lock-foot text { display: block; color: #8f98a8; font-size: 22rpx; }
.missed-foot b, .life-foot b, .lock-foot b { display: block; margin-top: 4rpx; color: #ff7a3d; font-size: 30rpx; }
.missed-foot b i { color: #6b7385; font-size: 21rpx; font-style: normal; font-weight: 400; }
.missed-foot button, .life-foot button, .lock-foot button { gap: 8rpx; min-width: 0; height: 72rpx; padding: 0 28rpx; border-radius: 999rpx; background: #ff7a3d; color: #090d08; font-size: 25rpx; font-weight: 650; white-space: nowrap; }
.trial-ticket { position: relative; margin-top: 24rpx; overflow: hidden; border-radius: 32rpx; background: radial-gradient(70% 60% at 0 0, rgba(155,137,224,.18), transparent 60%), radial-gradient(80% 100% at 100% 100%, rgba(155,137,224,.12), transparent 65%), #101010; border: 1rpx solid rgba(255,255,255,.08); }
.ticket-body { display: grid; grid-template-columns: 1fr 28rpx auto; align-items: stretch; }
.ticket-left { min-width: 0; padding: 32rpx 8rpx 28rpx 32rpx; }
.ticket-badge { display: inline-flex; align-items: center; justify-content: center; min-height: 38rpx; padding: 0 18rpx; border: 1rpx solid rgba(155,137,224,.45); border-radius: 999rpx; background: rgba(155,137,224,.12); color: #9b89e0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22rpx; font-weight: 600; line-height: 1; text-transform: uppercase; }
.ticket-left b { display: block; margin-top: 18rpx; color: #f5f7fa; font-size: 38rpx; font-weight: 640; }
.ticket-left > text:last-child { display: block; margin-top: 8rpx; color: #9ba3b5; font-size: 26rpx; }
.ticket-cut { width: 2rpx; margin: 24rpx 0; background: repeating-linear-gradient(180deg, rgba(255,255,255,.18) 0 8rpx, transparent 8rpx 16rpx); }
.ticket-value { min-width: 220rpx; padding: 32rpx 32rpx 28rpx 8rpx; text-align: right; }
.ticket-value > text { color: #6b7385; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 21rpx; }
.ticket-value b { display: flex; justify-content: flex-end; align-items: baseline; margin-top: 12rpx; color: #f5f7fa; font-size: 72rpx; line-height: 1; }
.ticket-value b text { color: #9b89e0; font-size: 40rpx; }
.ticket-value i { display: block; margin-top: 10rpx; color: #6b7385; font-size: 22rpx; font-style: normal; }
.ticket-bottom { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; padding: 24rpx 32rpx; border-top: 1rpx dashed rgba(255,255,255,.16); }
.ticket-bottom text { display: flex; align-items: center; gap: 12rpx; color: #ff7a3d; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 25rpx; font-weight: 500; line-height: 1; }
.ticket-bottom text i { width: 12rpx; height: 12rpx; border-radius: 50%; background: #ff7a3d; box-shadow: 0 0 12rpx rgba(255,122,61,.7); }
.ticket-bottom b { display: inline-flex; align-items: center; justify-content: center; min-height: 62rpx; padding: 0 28rpx; border: 1rpx solid rgba(155,137,224,.45); border-radius: 999rpx; color: #9b89e0; font-size: 27rpx; line-height: 1; white-space: nowrap; }
.ghost-slot { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 22rpx; margin-top: 24rpx; padding: 30rpx 32rpx; border: 1rpx dashed rgba(158,220,29,.45); border-radius: 32rpx; background: #101010; }
.ghost-icon { display: grid; width: 80rpx; height: 80rpx; place-items: center; border-radius: 20rpx; background: rgba(158,220,29,.16); color: #9edc1d; font-size: 34rpx; }
.ghost-slot b, .device-id b { display: block; color: #f5f7fa; font-size: 28rpx; }
.ghost-slot text, .device-id text { display: block; margin-top: 6rpx; color: #8f98a8; font-size: 23rpx; }
.ghost-slot i { color: #8f98a8; font-size: 23rpx; font-style: normal; }
.section-title { display: flex; justify-content: space-between; align-items: center; margin: 42rpx 4rpx 18rpx; }
.section-title b { color: #f5f7fa; font-size: 30rpx; font-weight: 640; }
.section-title text { display: flex; align-items: center; gap: 8rpx; color: #8f98a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 23rpx; }
.section-title text i { width: 10rpx; height: 10rpx; border-radius: 50%; background: #9edc1d; box-shadow: 0 0 10rpx rgba(158,220,29,.45); }
.device-card { padding: 0; }
.device-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; padding: 32rpx 40rpx 24rpx; }
.device-id { display: flex; align-items: center; gap: 24rpx; }
.device-icon { display: grid; width: 72rpx; height: 72rpx; place-items: center; border-radius: 18rpx; background: #1f1f1f; color: #9edc1d; font-size: 32rpx; transform: rotate(90deg); }
.online { display: flex; align-items: center; justify-content: center; gap: 10rpx; min-height: 36rpx; color: #9edc1d; font-size: 23rpx; line-height: 1; }
.online i { width: 12rpx; height: 12rpx; border-radius: 50%; background: #9edc1d; box-shadow: 0 0 10rpx rgba(158,220,29,.6); }
.current-task { padding: 0 40rpx 28rpx; }
.current-task > text, .task-heading, .market-heading { display: block; color: #8f98a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22rpx; letter-spacing: 2rpx; text-transform: uppercase; }
.current-task b { display: block; margin-top: 12rpx; color: #f5f7fa; font-size: 27rpx; font-weight: 560; }
.current-task em { display: block; margin-top: 6rpx; color: #8f98a8; font-size: 23rpx; font-style: normal; }
.task-progress { height: 8rpx; margin-top: 20rpx; overflow: hidden; border-radius: 999rpx; background: #1f1f1f; }
.task-progress view { width: 42%; height: 100%; border-radius: inherit; background: rgba(158,220,29,.45); }
.task-meta { display: flex; justify-content: space-between; margin-top: 12rpx; color: #8f98a8; font-size: 23rpx; }
.task-meta text:last-child { color: #9edc1d; }
.runtime-row { display: flex; gap: 12rpx; padding: 0 40rpx 24rpx; }
.runtime-row text { display: inline-flex; align-items: center; justify-content: center; min-height: 54rpx; padding: 0 20rpx; border: 1rpx solid rgba(255,255,255,.08); border-radius: 999rpx; background: rgba(158,220,29,.12); color: #9edc1d; font-size: 22rpx; line-height: 1; }
.locked-row { padding: 24rpx 40rpx; border-top: 1rpx solid rgba(255,255,255,.07); }
.locked-row text { color: #8f98a8; font-size: 23rpx; }
.locked-row b { display: block; margin-top: 10rpx; color: #ff7a3d; font-size: 40rpx; }
.locked-row i { color: #8f98a8; font-size: 22rpx; font-style: normal; }
.device-earnings { display: flex; justify-content: space-between; gap: 24rpx; padding: 28rpx 40rpx 36rpx; border-top: 1rpx solid rgba(255,255,255,.07); }
.device-earnings text { display: block; color: #8f98a8; font-size: 22rpx; letter-spacing: 2rpx; text-transform: uppercase; }
.device-earnings b { display: block; margin-top: 10rpx; color: #9edc1d; font-size: 54rpx; line-height: 1; }
.device-earnings view:last-child { text-align: right; }
.device-earnings view:last-child b { color: #f5f7fa; font-size: 36rpx; }
.device-earnings i { display: block; margin-top: 8rpx; color: #8e72ff; font-size: 23rpx; font-style: normal; }
.empty-slots-card { position: relative; overflow: hidden; margin-top: 24rpx; padding: 32rpx; border: 1rpx solid rgba(255,255,255,.08); border-radius: 32rpx; background: #101010; }
.capacity-bg { position: absolute; inset: 0; background: radial-gradient(50% 60% at 12% 18%, rgba(158,220,29,.20), transparent 65%), radial-gradient(45% 55% at 88% 82%, rgba(142,114,255,.20), transparent 65%); filter: blur(20rpx); opacity: .85; }
.capacity-label, .market-heading { position: relative; color: #9edc1d; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 21rpx; font-weight: 500; letter-spacing: 2rpx; text-transform: uppercase; }
.capacity-money { position: relative; display: flex; align-items: baseline; gap: 10rpx; margin-top: 18rpx; color: #9edc1d; }
.capacity-money text { font-size: 52rpx; opacity: .78; }
.capacity-money b { font-size: 96rpx; line-height: 1; }
.capacity-money i { color: #8f98a8; font-size: 36rpx; font-style: normal; }
.capacity-money em { padding: 6rpx 16rpx; border-radius: 999rpx; background: rgba(158,220,29,.2); color: #9edc1d; font-size: 21rpx; font-style: normal; text-transform: uppercase; }
.capacity-sub { position: relative; margin-top: 16rpx; color: #8f98a8; font-size: 25rpx; }
.capacity-sub b { color: #f5f7fa; }
.slot-grid { position: relative; display: grid; grid-template-columns: repeat(6,1fr); gap: 12rpx; margin-top: 28rpx; }
.slot-grid view { display: grid; height: 88rpx; place-items: center; border-radius: 24rpx; line-height: 1; }
.slot-grid .filled { background: rgba(158,220,29,.16); color: #9edc1d; transform: rotate(90deg); }
.slot-grid .empty { border: 1rpx dashed rgba(142,114,255,.45); background: rgba(142,114,255,.08); color: #8e72ff; }
.capacity-stats { position: relative; display: grid; grid-template-columns: repeat(3,1fr); gap: 16rpx; margin-top: 28rpx; padding-top: 24rpx; border-top: 1rpx dashed rgba(255,255,255,.1); text-align: center; }
.capacity-stats view { display: flex; min-width: 0; flex-direction: column; align-items: center; justify-content: center; }
.capacity-stats b { display: flex; align-items: center; justify-content: center; min-height: 34rpx; color: #9edc1d; font-size: 30rpx; line-height: 1; }
.capacity-stats text { display: flex; align-items: center; justify-content: center; min-height: 24rpx; margin-top: 8rpx; color: #6b7385; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 20rpx; line-height: 1; text-align: center; }
.empty-slots-card button { position: relative; display: flex; align-items: center; justify-content: center; gap: 10rpx; width: 100%; height: 96rpx; margin-top: 28rpx; border-radius: 999rpx; background: #9edc1d; color: #090d08; font-size: 28rpx; font-weight: 650; }
.lifecycle-card, .task-lock { padding: 32rpx; }
.life-label { color: #8e72ff; }
.life-number { display: flex; align-items: baseline; gap: 16rpx; margin-top: 16rpx; color: #f5f7fa; font-size: 60rpx; font-weight: 640; }
.life-number text { color: #8f98a8; font-size: 22rpx; font-weight: 400; }
.life-bar, .lock-progress { height: 8rpx; margin-top: 24rpx; overflow: hidden; border-radius: 999rpx; background: #1f1f1f; }
.life-bar view { width: 98%; height: 100%; background: rgba(142,114,255,.55); }
.life-foot button { background: #8e72ff; color: #090d08; }
.market-board { padding-bottom: 10rpx; }
.market-heading { padding: 24rpx 32rpx 12rpx; color: #8f98a8; }
.price-row { display: grid; grid-template-columns: 38rpx 1fr 120rpx 90rpx 96rpx; align-items: center; gap: 14rpx; padding: 18rpx 32rpx; border-top: 1rpx solid rgba(255,255,255,.06); }
.price-row > text { display: flex; align-items: center; justify-content: center; width: 38rpx; height: 38rpx; font-size: 28rpx; line-height: 1; text-align: center; }
.price-row b, .rank-row b { display: block; overflow: hidden; color: #f5f7fa; font-size: 25rpx; font-weight: 520; white-space: nowrap; text-overflow: ellipsis; }
.price-row view text, .rank-row view text { color: #6b7385; font-size: 21rpx; }
.price-row view em { display: block; margin-top: 4rpx; color: #ffbe3d; font-size: 21rpx; font-style: normal; }
.price-row i, .price-row strong { display: flex; align-items: center; justify-content: flex-end; min-height: 32rpx; color: #f5f7fa; font-size: 23rpx; font-style: normal; line-height: 1; text-align: right; }
.price-row strong { color: #9edc1d; }
.price-row strong.down { color: #ff7a3d; }
.price-row strong.neutral { color: #8f98a8; }
.price-row svg { width: 96rpx; height: 32rpx; }
.rank-board { padding-bottom: 0; }
.rank-row { display: grid; grid-template-columns: 32rpx 38rpx 1fr auto 28rpx; align-items: center; gap: 16rpx; padding: 20rpx 32rpx; border-top: 1rpx solid rgba(255,255,255,.06); }
.rank-row > text { display: flex; align-items: center; justify-content: center; width: 32rpx; height: 32rpx; color: #6b7385; font-size: 22rpx; line-height: 1; text-align: center; }
.rank-row > i { display: flex; align-items: center; justify-content: center; width: 38rpx; height: 38rpx; font-style: normal; font-size: 28rpx; line-height: 1; text-align: center; }
.rank-row em { color: #ffbe3d; font-size: 21rpx; font-style: normal; }
.rank-row strong { display: flex; align-items: center; justify-content: flex-end; min-height: 34rpx; color: #9edc1d; font-size: 25rpx; line-height: 1; }
.rank-row span { display: flex; align-items: center; justify-content: center; width: 28rpx; height: 28rpx; color: #6b7385; line-height: 1; }
.rank-row.phone b, .rank-row.phone strong { color: #8f98a8; }
.network-state { padding: 0 32rpx 24rpx; }
.network-state view:not(.market-heading) { display: flex; align-items: center; justify-content: space-between; gap: 24rpx; padding: 8rpx 0; color: #8f98a8; font-size: 23rpx; }
.network-state b { color: #f5f7fa; font-weight: 500; }
.network-state i { color: #9edc1d; font-style: normal; font-size: 21rpx; }
.task-lock { background: linear-gradient(160deg, rgba(255,190,61,.12), #101010 70%); }
.lock-label { color: #ffbe3d; }
.lock-money { display: flex; align-items: baseline; gap: 16rpx; margin-top: 16rpx; color: #ffbe3d; font-size: 60rpx; font-weight: 640; }
.lock-money text { color: #8f98a8; font-size: 22rpx; font-weight: 400; }
.lock-progress view { width: 60%; height: 100%; background: rgba(255,190,61,.55); }
.lock-foot b { color: #ffbe3d; }
.lock-foot button { background: #ffbe3d; }
.task-tabs { display: flex; gap: 12rpx; margin: 0 4rpx 16rpx; }
.task-tabs button { height: 88rpx; padding: 0 32rpx; border: 1rpx solid transparent; border-radius: 999rpx; background: #1f1f1f; color: #8f98a8; font-size: 25rpx; line-height: 1; }
.task-tabs .on { border-color: rgba(158,220,29,.35); background: rgba(158,220,29,.15); color: #9edc1d; }
.task-center { padding-bottom: 24rpx; }
.task-heading { padding: 24rpx 32rpx 12rpx; }
.empty-current { padding: 0 32rpx 24rpx; color: #8f98a8; font-size: 24rpx; }
.lock-title, .done-title { border-top: 1rpx solid rgba(255,255,255,.07); }
.teaser-row { display: grid; grid-template-columns: 64rpx 1fr auto; align-items: center; gap: 18rpx; padding: 16rpx 32rpx; }
.teaser-row > text { display: grid; width: 64rpx; height: 64rpx; place-items: center; border-radius: 16rpx; background: rgba(142,114,255,.12); font-size: 28rpx; }
.teaser-row b { color: #f5f7fa; font-size: 25rpx; }
.teaser-row i { display: block; margin-top: 4rpx; color: #6b7385; font-size: 21rpx; font-style: normal; }
.teaser-row em { display: flex; align-items: center; justify-content: flex-end; min-height: 42rpx; color: #9edc1d; font-size: 30rpx; font-style: normal; font-weight: 640; line-height: 1; }
.completed-row { display: grid; grid-template-columns: 30rpx 1fr auto 90rpx; align-items: center; gap: 12rpx; padding: 10rpx 32rpx; color: #8f98a8; font-size: 23rpx; }
.completed-row > text { display: flex; align-items: center; justify-content: center; width: 30rpx; height: 30rpx; color: #9edc1d; line-height: 1; }
.completed-row view { overflow: hidden; color: #d1d5db; white-space: nowrap; text-overflow: ellipsis; }
.completed-row i { color: #8f98a8; font-style: normal; }
.completed-row b { display: flex; align-items: center; justify-content: flex-end; min-height: 30rpx; color: #9edc1d; font-weight: 500; line-height: 1; }
.completed-row em { display: flex; align-items: center; justify-content: flex-end; min-height: 30rpx; color: #8f98a8; font-style: normal; line-height: 1; text-align: right; }
@keyframes drift { from{transform:translateX(-14rpx)} to{transform:translate(18rpx,10rpx) scale(1.04)} }
@keyframes dot { 0%{opacity:0;transform:translateY(0)} 20%{opacity:.7} 100%{opacity:0;transform:translateY(-360rpx)} }
</style>
