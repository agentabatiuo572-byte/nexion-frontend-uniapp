<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '@/components/AppShell.vue'
import { requireAuth } from '@/utils/auth-guard'
import { getMainPageMessages, useActiveLocale } from '@/utils/i18n'

type Range = 'Today' | 'Week' | 'Month' | 'All'

const range = ref<Range>('Today')
const taskTab = ref<'current' | 'history'>('current')
const trialState = ref<'idle' | 'active' | 'grace' | 'extended'>('idle')
const quickMenuOpen = ref(false)
const phoneCharging = ref(true)
const phoneOnline = ref(true)
const locale = useActiveLocale()
const copy = computed(() => getMainPageMessages(locale.value))
const t = computed(() => copy.value.earn)
const v = computed(() => t.value.v5)
const common = computed(() => copy.value.common)
const rangeTabs: Range[] = ['Today', 'Week', 'Month', 'All']
const tx = (zh: string, en: string) => (locale.value === 'zh' ? zh : en)

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

const priceRows = computed(() => [
  { icon: 'image', label: v.value.priceImageGen || 'Image Gen', unit: v.value.pricePerImage || 'per image', price: '$0.0030', delta: '↑ 4.2%', up: true, spark: sparkline([0.4, 0.5, 0.42, 0.55, 0.6, 0.7, 0.72]) },
  { icon: 'message', label: v.value.priceLlmInference || 'LLM Inference', unit: v.value.pricePerTokens || 'per 1k tok', price: '$0.0024', delta: '↑ 18.7%', up: true, premium: '405B premium ↑32.1%', spark: sparkline([0.3, 0.35, 0.4, 0.42, 0.6, 0.78, 0.88]) },
  { icon: 'film', label: v.value.priceVideoGen || 'Video Gen', unit: v.value.pricePerSecond || 'per sec', price: '$0.180', delta: '↓ 1.2%', up: false, spark: sparkline([0.65, 0.7, 0.6, 0.55, 0.62, 0.58, 0.62]) },
  { icon: 'wrench', label: v.value.fineTune || 'Fine-tune', unit: v.value.pricePerJob || 'per job', price: '$0.060', delta: '→ 0.0%', neutral: true, spark: sparkline([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]) },
  { icon: 'database', label: v.value.priceEmbedding || 'Embedding', unit: v.value.pricePerChunks || 'per 1k chunks', price: '$0.0008', delta: '↑ 2.1%', up: true, spark: sparkline([0.4, 0.45, 0.4, 0.5, 0.52, 0.55, 0.57]) },
  { icon: 'mic', label: v.value.speech || 'Speech', unit: v.value.pricePerAudioSecond || 'per audio sec', price: '$0.0003', delta: '↑ 0.3%', up: true, spark: sparkline([0.5, 0.48, 0.5, 0.52, 0.5, 0.51, 0.52]) }
])

const deviceRankRows = computed(() => [
  { rank: 1, icon: 'server', name: 'NexionRack P1', best: 'Training + 405B LLM', daily: '$142.60/d', top: true },
  { rank: 2, icon: 'box', name: 'NexionBox Pro', best: 'AI Premium pool', daily: '$76.00/d' },
  { rank: 3, icon: 'box', name: 'NexionBox S1', best: 'LLM 70B', daily: '$38.50/d' },
  { rank: 4, icon: 'cloud', name: 'Inference Share', best: 'Low barrier entry', daily: '$0.07/d' },
  { rank: 5, icon: 'phone', name: v.value.yourPhone, best: locale.value === 'zh' ? '移动端 NPU 档位' : 'Mobile NPU tier', daily: '$0.06/d', phone: true }
])

const lockedTaskRows = computed(() => [
  { icon: 'message', model: 'Llama 70B inference', daily: '+$110/d', vram: '16 GB' },
  { icon: 'image', model: 'Flux.1 [dev] HD', daily: '+$38/d', vram: '12 GB' },
  { icon: 'image', model: 'SDXL Turbo bulk', daily: '+$9/d', vram: '8 GB' }
])

const completedRows = computed(() => [
  { icon: 'image', model: 'SDXL Turbo', type: v.value.priceImageGen || 'Image Gen', reward: '+$0.000', time: '2m ago', receipt: true },
  { icon: 'mic', model: 'Whisper tiny', type: v.value.speech || 'Speech', reward: '+$0.000', time: '8m ago' },
  { icon: 'database', model: 'MobileBERT', type: v.value.priceEmbedding || 'Embedding', reward: '+$0.000', time: '19m ago' }
])

const trialGhost = computed(() => {
  const map = {
    active: {
      ribbon: locale.value === 'zh' ? '免费体验中' : 'Trial active',
      tint: '#9edc1d',
      eta: locale.value === 'zh' ? '剩余 2d 18h' : '2d 18h left',
      shadow: '38.72',
      nex: '1,240'
    },
    grace: {
      ribbon: locale.value === 'zh' ? '保留期' : 'Grace period',
      tint: '#ffbe3d',
      eta: locale.value === 'zh' ? '剩余 6h 20m' : '6h 20m left',
      shadow: '101.44',
      nex: '3,248'
    },
    extended: {
      ribbon: locale.value === 'zh' ? '高质量延长' : 'Quality extension',
      tint: '#58e7ff',
      eta: locale.value === 'zh' ? '剩余 1d 04h' : '1d 04h left',
      shadow: '129.08',
      nex: '4,130'
    }
  } as const
  return trialState.value === 'idle' ? null : map[trialState.value]
})

const pausedReason = computed<'charger' | 'network' | ''>(() => {
  if (!phoneCharging.value) return 'charger'
  if (!phoneOnline.value) return 'network'
  return ''
})

function showSoon(label: string) {
  uni.showToast({ title: common.value.comingSoon(label), icon: 'none' })
}

function claimTrial() {
  trialState.value = 'active'
}

function cycleTrialState() {
  trialState.value = trialState.value === 'active'
    ? 'grace'
    : trialState.value === 'grace'
      ? 'extended'
      : trialState.value === 'extended'
        ? 'idle'
        : 'active'
}

function toggleQuickPause() {
  phoneOnline.value = !phoneOnline.value
  quickMenuOpen.value = false
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
          <view class="missed-label"><i class="ui-icon trend-down" /> {{ v.missedIncome }}</view>
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

        <view v-if="trialState === 'idle'" class="trial-ticket" @click="claimTrial">
          <view class="ticket-shine" />
          <view class="ticket-body">
            <view class="ticket-left">
              <text class="ticket-badge"><i class="ui-icon star" /> {{ tx('限时免费', 'FREE TRIAL') }}</text>
              <b>NexionBox S1</b>
              <text>{{ tx('免费试用 3 天,随时取消。', 'Try free for 3 days, cancel anytime.') }}</text>
            </view>
            <view class="ticket-cut" />
            <view class="ticket-value">
              <text>{{ tx('3 天预计收益', 'EST. 3D EARN') }}</text>
              <b><text>$</text>116</b>
              <i>$38.50/d × 3</i>
            </view>
          </view>
          <view class="ticket-bottom">
            <text><i class="ticket-scarcity-dot" />{{ tx('今日仅剩 47 张', '47 trials left today') }}</text>
            <b>{{ tx('立即领取', 'Claim trial') }} <i class="ui-icon arrow-right" /></b>
          </view>
        </view>
        <view
          v-else-if="trialGhost"
          class="trial-ghost-card"
          :style="{ '--trial-tint': trialGhost.tint }"
          @click="cycleTrialState"
        >
          <view class="ghost-icon"><i class="ui-icon star" /></view>
          <view class="ghost-body">
            <view class="ghost-ribbon">
              <text>{{ trialGhost.ribbon }}</text>
              <i>· {{ trialGhost.eta }}</i>
            </view>
            <view class="ghost-money"><text>$</text><b>{{ trialGhost.shadow }}</b><i>+ {{ trialGhost.nex }} NEX</i></view>
            <view class="ghost-desc">NexionBox S1 {{ v.cloudShareTrial || 'trial yield' }}</view>
          </view>
          <i class="ui-icon arrow-right ghost-arrow" />
        </view>

        <view class="section-title">
          <b>{{ v.myDevices }}</b>
          <text>1 / 6</text>
        </view>

        <view class="device-card" @longpress="quickMenuOpen = true">
          <view v-if="quickMenuOpen" class="quick-menu-mask" @click.stop="quickMenuOpen = false">
            <view class="quick-menu" @click.stop>
              <view class="quick-handle" />
              <view class="quick-device">{{ v.yourPhoneDevice || 'Your phone' }}</view>
              <button @click="toggleQuickPause">
                <i class="ui-icon" :class="phoneOnline ? 'pause' : 'play'" />
                {{ phoneOnline ? (locale === 'zh' ? '暂停接单' : 'Pause') : (locale === 'zh' ? '恢复接单' : 'Resume') }}
              </button>
              <button @click="quickMenuOpen = false">
                <i class="ui-icon bar-chart" />
                {{ locale === 'zh' ? '查看统计' : 'Stats' }}
              </button>
              <button @click="quickMenuOpen = false">
                <i class="ui-icon trash" />
                {{ locale === 'zh' ? '折旧换购' : 'Trade-in' }}
              </button>
              <button class="quick-cancel" @click="quickMenuOpen = false">{{ locale === 'zh' ? '取消' : 'Cancel' }}</button>
            </view>
          </view>
          <view class="device-head">
            <view class="device-id">
              <view class="device-icon"><i class="ui-icon phone" /></view>
              <view><b>{{ v.yourPhoneDevice || 'Your phone' }}</b><text>{{ v.phoneNpuSpec || 'Mobile NPU · ~28 TOPS' }}</text></view>
            </view>
            <view class="online" :class="{ paused: pausedReason || !phoneOnline }"><i />{{ pausedReason || !phoneOnline ? (locale === 'zh' ? '暂停' : 'paused') : (v.online || 'online') }}</view>
          </view>
          <view v-if="pausedReason" class="paused-block">
            <text>{{ v.currentTask || 'Current Task' }}</text>
            <view>
              <i class="ui-icon" :class="pausedReason === 'charger' ? 'plug' : 'wifi-off'" />
              <b>{{ pausedReason === 'charger' ? (locale === 'zh' ? '等待接入充电器' : 'Waiting for charger') : (locale === 'zh' ? '网络连接已断开' : 'Network disconnected') }}</b>
              <em>{{ pausedReason === 'charger' ? (locale === 'zh' ? '接入电源后才会重新接收后台任务。' : 'Plug in to resume background task intake.') : (locale === 'zh' ? '恢复网络后，调度器会在下一次 ping 后派发任务。' : 'Reconnect before the scheduler assigns the next job.') }}</em>
            </view>
          </view>
          <view v-else class="current-task">
            <text>{{ v.currentTask || 'Current Task' }}</text>
            <b>Whisper-base <span>·</span> Speech</b>
            <em><strong>#SP-A78237</strong> <span>·</span> VoxLane <span>·</span> Tokyo, JP</em>
            <view class="task-progress-row">
              <view class="task-progress"><view><i /></view></view>
              <text>30%</text>
            </view>
            <view class="task-meta"><text>~2m 12s {{ v.remaining || 'remaining' }}</text><text>{{ v.reward || 'Reward' }}: +$0.015</text></view>
          </view>
          <view class="background-mode">
            <view class="mode-title">{{ v.phoneSettingsTitle || 'Background mode' }}</view>
          </view>
          <view class="runtime-row">
            <button class="runtime-pill" :class="{ off: !phoneCharging }" @click="phoneCharging = !phoneCharging"><i class="ui-icon" :class="phoneCharging ? 'battery-charging' : 'battery'" />78%</button>
            <button class="runtime-pill" :class="{ off: !phoneOnline }" @click="phoneOnline = !phoneOnline"><i class="ui-icon" :class="phoneOnline ? 'wifi-lucide' : 'wifi-off'" />{{ phoneOnline ? (v.phoneNetOnline || 'online') : (locale === 'zh' ? '离线' : 'offline') }}</button>
          </view>
          <view class="runtime-hint">{{ v.phoneRequirementsHint || 'Charging + network must both stay available before accepting tasks. The scheduler ping-checks before every job.' }}</view>
          <view class="locked-row">
            <text><i class="ui-icon lock" />{{ v.lockedTasksBlocked || 'Tasks your phone cannot accept' }}</text>
            <b>−$157 <i>{{ v.lockedMissedDaily || 'lost daily' }}</i></b>
            <view class="locked-task-list">
              <view v-for="task in lockedTaskRows" :key="task.model">
                <span><i class="ui-icon lock small-lock" />{{ task.model }}</span>
                <strong>{{ task.daily }} <em>{{ task.vram }}</em></strong>
              </view>
            </view>
            <button class="unlock-more">{{ (v.unlockNMoreTasks || 'Unlock 142 more tasks').replace('{n}', '142') }}</button>
          </view>
          <view class="device-earnings">
            <view>
              <text>{{ v.todayEarnings || 'Today earnings' }}</text>
              <b>$0.062</b>
              <i>+1.9 NEX</i>
            </view>
            <view>
              <text>{{ v.estThisHour || 'Est. this hour' }}</text>
              <b>+$0.00</b>
              <i>+0.1 NEX</i>
            </view>
          </view>
        </view>

        <view class="empty-slots-card" @click="showSoon(v.fillSlots || v.addDevice)">
          <view class="capacity-bg" />
          <view class="capacity-grid-bg" />
          <view class="capacity-particles">
            <i v-for="n in 10" :key="n" :style="{ left: `${7 + ((n * 17) % 88)}%`, animationDelay: `${n * .9}s`, animationDuration: `${9 + (n % 4)}s` }" />
          </view>
          <view class="capacity-label"><i class="ui-icon trending-up" /> {{ v.slotsPotential || 'Potential daily' }}</view>
          <view class="capacity-money"><text>+$</text><b>192</b><i>/day</i><em>{{ v.slotsUntapped || 'untapped' }}</em></view>
          <view class="capacity-sub"><b>5</b> × NexionBox S1 @ $38.50/d</view>
          <view class="slot-grid">
            <view class="filled"><i class="ui-icon phone" /><em /></view>
            <view v-for="n in 5" :key="n" class="empty"><i class="ui-icon plus" /></view>
          </view>
          <view class="capacity-stats">
            <view><b>1/6</b><text>{{ v.slotsFilled || 'filled' }}</text></view>
            <view><b>$143</b><text>{{ v.networkAvg || 'network avg' }}</text></view>
            <view><b>Top 6%</b><text>{{ v.rankIfFilled || 'if filled' }}</text></view>
          </view>
          <button><i class="ui-icon zap" /> {{ v.fillSlots || 'Fill slots' }} <i class="ui-icon arrow-right" /></button>
          <view class="fleet-note">{{ (v.currentFleet || 'Current fleet {amount} / day').replace('{amount}', '$0.06') }}</view>
        </view>

        <view class="lifecycle-card">
          <view class="lifecycle-glow" />
          <view class="life-label"><i class="ui-icon activity" /> {{ v.fleetLifecycle || 'Fleet lifecycle' }}</view>
          <view class="life-number"><b>98.4%</b><text>{{ (locale === 'zh' ? '1 台可衰减设备' : '1 degradable device') }}</text></view>
          <view class="life-bar"><view /></view>
          <view class="life-foot">
            <view>
              <text>{{ v.lifecycleMonthlyLoss || 'monthly loss' }}</text>
              <b>−$0.61 <i>· {{ locale === 'zh' ? '12 天' : '12d' }}</i></b>
            </view>
            <button @click="showSoon(v.lifecycleCta || 'Review')">{{ v.lifecycleCta || 'Review' }} <i class="ui-icon arrow-right" /></button>
          </view>
        </view>

        <view class="section-title">
          <b>{{ v.marketOverview }}</b>
          <text><i />{{ v.liveDemand }}</text>
        </view>
        <view class="market-board">
          <view class="market-heading">{{ v.priceIndex || 'AI Workload Price Index' }}</view>
          <view v-for="row in priceRows" :key="row.label" class="price-row">
            <text><i class="ui-icon" :class="row.icon" /></text>
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
            <i><span class="ui-icon" :class="row.icon" /></i>
            <view><b>{{ row.name }} <em v-if="row.top">⭐ Best</em></b><text>{{ row.best }}</text></view>
            <strong>{{ row.daily }}</strong>
            <span v-if="!row.phone"><i class="ui-icon arrow-right" /></span>
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
          <view class="lock-label"><i class="ui-icon layers" /> {{ v.premiumLocked }}</view>
          <view class="lock-money">−$140 <text>{{ v.taskLockThisMonth || 'this month' }} · Llama 70B · Flux.1</text></view>
          <view class="lock-progress"><view /></view>
          <view class="lock-foot"><view><text>{{ v.taskLockCumulative || 'cumulative missed' }}</text><b>−$420</b></view><button>{{ v.taskLockCtaUpgrade || v.addDevice }} <i class="ui-icon arrow-right" /></button></view>
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
            <view class="task-heading lock-title"><i class="ui-icon lock" /> {{ v.upgradeUnlocks || 'Upgrade unlocks' }}</view>
            <view class="unlock-hint">{{ v.upgradeUnlocksHint || 'Higher VRAM devices can accept premium AI queues.' }}</view>
            <view class="teaser-row"><text><i class="ui-icon message" /></text><view><b>Llama 70B inference</b><i>{{ v.requires || 'requires' }} <strong>16GB VRAM</strong> · S1 tier</i></view><em>+$110/d <small>{{ v.upgradeNow || 'Upgrade now' }}</small></em></view>
            <view class="teaser-row"><text><i class="ui-icon image" /></text><view><b>Flux.1 dev HD</b><i>{{ v.requires || 'requires' }} <strong>12GB VRAM</strong> · S1 tier</i></view><em>+$38/d <small>{{ v.upgradeNow || 'Upgrade now' }}</small></em></view>
            <view class="task-heading done-title">{{ v.completedToday || 'Completed today' }}</view>
            <view v-for="row in completedRows" :key="row.model" class="completed-row">
              <text><i class="ui-icon check" /></text><view>{{ row.model }} <i>· {{ row.type }}</i></view><b>{{ row.reward }}</b><em>{{ row.time }}</em><span><i v-if="row.receipt" class="ui-icon receipt" /></span>
            </view>
          </template>
          <template v-else>
            <view v-for="row in completedRows" :key="`h-${row.model}`" class="completed-row">
              <text><i class="ui-icon check" /></text><view>{{ row.model }} <i>· {{ row.type }}</i></view><b>{{ row.reward }}</b><em>{{ row.time }}</em><span><i v-if="row.receipt" class="ui-icon receipt" /></span>
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
.ui-icon { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 1em; height: 1em; color: currentColor; line-height: 1; flex: none; }
.ui-icon::before, .ui-icon::after { content: ""; position: absolute; box-sizing: border-box; }
.arrow-right::before { width: .72em; height: .72em; border-top: .12em solid currentColor; border-right: .12em solid currentColor; transform: rotate(45deg); }
.arrow-right::after { width: .86em; height: .12em; background: currentColor; }
.trend-down::before { width: .86em; height: .12em; background: currentColor; transform: rotate(35deg); transform-origin: left center; }
.trend-down::after { right: .04em; bottom: .14em; width: .38em; height: .38em; border-right: .12em solid currentColor; border-bottom: .12em solid currentColor; transform: rotate(0deg); }
.trending-up::before { width: .86em; height: .12em; background: currentColor; transform: rotate(-35deg); transform-origin: left center; }
.trending-up::after { right: .02em; top: .12em; width: .38em; height: .38em; border-top: .12em solid currentColor; border-right: .12em solid currentColor; }
.star::before { width: .9em; height: .9em; background: currentColor; clip-path: polygon(50% 0,61% 35%,98% 35%,68% 56%,79% 92%,50% 70%,21% 92%,32% 56%,2% 35%,39% 35%); }
.phone::before { width: .62em; height: .95em; border: .12em solid currentColor; border-radius: .16em; }
.phone::after { bottom: .1em; width: .16em; height: .16em; border-radius: 50%; background: currentColor; }
.server::before { width: .92em; height: .82em; border: .12em solid currentColor; border-radius: .12em; box-shadow: inset 0 .28em 0 transparent, inset 0 .34em 0 currentColor; }
.server::after { right: .16em; bottom: .18em; width: .16em; height: .16em; border-radius: 50%; background: currentColor; }
.box::before { width: .84em; height: .74em; border: .12em solid currentColor; border-radius: .1em; transform: skewY(-8deg); }
.cloud::before { width: .9em; height: .45em; border: .12em solid currentColor; border-top: 0; border-radius: 0 0 .3em .3em; bottom: .2em; }
.cloud::after { width: .62em; height: .48em; border: .12em solid currentColor; border-bottom: 0; border-radius: .5em .5em 0 0; top: .18em; }
.image::before { width: .9em; height: .72em; border: .12em solid currentColor; border-radius: .1em; }
.image::after { width: .58em; height: .34em; border-left: .12em solid currentColor; border-bottom: .12em solid currentColor; transform: rotate(-45deg); bottom: .18em; }
.message::before { width: .92em; height: .68em; border: .12em solid currentColor; border-radius: .18em; }
.message::after { left: .22em; bottom: .08em; width: .28em; height: .28em; border-left: .12em solid currentColor; border-bottom: .12em solid currentColor; transform: rotate(-20deg); }
.film::before { width: .9em; height: .7em; border: .12em solid currentColor; border-radius: .08em; box-shadow: inset .2em 0 0 transparent, inset .28em 0 0 currentColor, inset -.28em 0 0 currentColor; }
.wrench::before { width: .75em; height: .18em; background: currentColor; border-radius: .1em; transform: rotate(-45deg); }
.wrench::after { right: .08em; top: .04em; width: .38em; height: .38em; border: .12em solid currentColor; border-left-color: transparent; border-radius: 50%; transform: rotate(-45deg); }
.database::before { width: .84em; height: .7em; border: .12em solid currentColor; border-radius: 50% / 24%; }
.database::after { width: .84em; height: .22em; border: .12em solid currentColor; border-bottom: 0; border-radius: 50% 50% 0 0 / 100% 100% 0 0; top: .12em; }
.mic::before { width: .46em; height: .72em; border: .12em solid currentColor; border-radius: .28em; top: .04em; }
.mic::after { width: .72em; height: .42em; border: .12em solid currentColor; border-top: 0; border-radius: 0 0 .38em .38em; bottom: .08em; }
.battery::before { width: .78em; height: .46em; border: .12em solid currentColor; border-radius: .08em; }
.battery::after { right: 0; width: .12em; height: .22em; background: currentColor; border-radius: .04em; }
.battery-charging { background: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M15 7h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2'/%3E%3Cpath d='M6 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1'/%3E%3Cpath d='m11 7-3 5h4l-3 5'/%3E%3Cline x1='22' x2='22' y1='11' y2='13'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M15 7h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2'/%3E%3Cpath d='M6 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1'/%3E%3Cpath d='m11 7-3 5h4l-3 5'/%3E%3Cline x1='22' x2='22' y1='11' y2='13'/%3E%3C/svg%3E") center / contain no-repeat; }
.battery-charging::before, .battery-charging::after { display: none; }
.wifi::before { width: .86em; height: .86em; border: .12em solid currentColor; border-left-color: transparent; border-bottom-color: transparent; border-radius: 50%; transform: rotate(-45deg); top: .18em; }
.wifi::after { bottom: .1em; width: .16em; height: .16em; border-radius: 50%; background: currentColor; }
.wifi-lucide { background: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 20h.01'/%3E%3Cpath d='M2 8.82a15 15 0 0 1 20 0'/%3E%3Cpath d='M5 12.86a10 10 0 0 1 14 0'/%3E%3Cpath d='M8.5 16.43a5 5 0 0 1 7 0'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 20h.01'/%3E%3Cpath d='M2 8.82a15 15 0 0 1 20 0'/%3E%3Cpath d='M5 12.86a10 10 0 0 1 14 0'/%3E%3Cpath d='M8.5 16.43a5 5 0 0 1 7 0'/%3E%3C/svg%3E") center / contain no-repeat; }
.wifi-lucide::before, .wifi-lucide::after { display: none; }
.wifi-off::before { width: .88em; height: .88em; border: .12em solid currentColor; border-left-color: transparent; border-bottom-color: transparent; border-radius: 50%; transform: rotate(-45deg); opacity: .75; }
.wifi-off::after { width: 1em; height: .12em; background: currentColor; transform: rotate(45deg); border-radius: .1em; }
.plug::before { width: .36em; height: .52em; border: .12em solid currentColor; border-top: 0; border-radius: 0 0 .12em .12em; top: .28em; }
.plug::after { top: .08em; width: .48em; height: .28em; border-left: .12em solid currentColor; border-right: .12em solid currentColor; }
.pause::before { width: .16em; height: .72em; background: currentColor; transform: translateX(-.16em); }
.pause::after { width: .16em; height: .72em; background: currentColor; transform: translateX(.16em); }
.play::before { width: .78em; height: .78em; background: currentColor; clip-path: polygon(20% 8%, 84% 50%, 20% 92%); }
.bar-chart::before { bottom: .12em; left: .18em; width: .14em; height: .42em; background: currentColor; box-shadow: .24em -.18em 0 currentColor, .48em -.3em 0 currentColor; }
.bar-chart::after { bottom: .08em; width: .82em; height: .12em; background: currentColor; opacity: .45; }
.trash::before { width: .62em; height: .62em; border: .12em solid currentColor; border-top: 0; border-radius: 0 0 .08em .08em; bottom: .08em; }
.trash::after { top: .16em; width: .78em; height: .12em; background: currentColor; box-shadow: 0 -.14em 0 -.03em currentColor; }
.lock::before { width: .76em; height: .52em; border: .12em solid currentColor; border-radius: .1em; bottom: .08em; }
.lock::after { width: .48em; height: .42em; border: .12em solid currentColor; border-bottom: 0; border-radius: .32em .32em 0 0; top: .04em; }
.small-lock { width: .9em; height: .9em; }
.zap::before { width: .72em; height: .96em; background: currentColor; clip-path: polygon(48% 0,92% 0,62% 42%,96% 42%,36% 100%,50% 55%,12% 55%); }
.activity::before { width: .92em; height: .92em; border: .12em solid currentColor; border-radius: 50%; }
.activity::after { width: .54em; height: .22em; border-left: .12em solid currentColor; border-bottom: .12em solid currentColor; transform: rotate(-18deg); }
.layers::before { width: .78em; height: .48em; border: .12em solid currentColor; transform: rotate(25deg) skew(-18deg); border-radius: .08em; }
.layers::after { width: .78em; height: .48em; border: .12em solid currentColor; transform: translateY(.22em) rotate(25deg) skew(-18deg); border-radius: .08em; opacity: .65; }
.plus::before { width: .72em; height: .12em; background: currentColor; }
.plus::after { width: .12em; height: .72em; background: currentColor; }
.check::before { width: .68em; height: .36em; border-left: .14em solid currentColor; border-bottom: .14em solid currentColor; transform: rotate(-45deg) translate(.05em,-.05em); }
.receipt::before { width: .72em; height: .9em; border: .12em solid currentColor; border-radius: .08em; }
.receipt::after { width: .38em; height: .12em; background: currentColor; box-shadow: 0 .22em 0 currentColor; }
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
.missed-label, .life-label, .lock-label { display: flex; align-items: center; gap: 10rpx; color: #ff7a3d; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22rpx; font-weight: 600; letter-spacing: 2rpx; text-transform: uppercase; }
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
.trial-ticket { position: relative; margin-top: 24rpx; overflow: hidden; border-radius: 32rpx; background: radial-gradient(70% 60% at 0 0, rgba(155,137,224,.18), transparent 60%), radial-gradient(80% 100% at 100% 100%, rgba(155,137,224,.12), transparent 65%), #101010; border: 1rpx solid rgba(255,255,255,.08); -webkit-mask-image: radial-gradient(circle at 62% 0, transparent 14rpx, #000 15rpx), radial-gradient(circle at 62% 100%, transparent 14rpx, #000 15rpx); -webkit-mask-composite: source-in; mask-image: radial-gradient(circle at 62% 0, transparent 14rpx, #000 15rpx), radial-gradient(circle at 62% 100%, transparent 14rpx, #000 15rpx); mask-composite: intersect; animation: ticketEnter .9s cubic-bezier(.22,1.2,.36,1) both; }
.trial-ticket::before { content: ""; position: absolute; left: 32rpx; right: 32rpx; top: 0; height: 2rpx; background: linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent); z-index: 3; }
.trial-ticket::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 2rpx; background: linear-gradient(90deg, transparent, #9b89e0, transparent); opacity: .6; z-index: 3; }
.ticket-shine { position: absolute; inset: 0; z-index: 2; pointer-events: none; background: linear-gradient(100deg, transparent 25%, rgba(198,255,58,.55) 50%, transparent 75%); mix-blend-mode: screen; opacity: 0; animation: ticketShimmer 1.1s ease-out .85s 1 forwards; }
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
.ticket-scarcity-dot { position: relative; display: inline-block; flex-shrink: 0; width: 12rpx; height: 12rpx; border-radius: 50%; background: #ff7a3d; box-shadow: 0 0 12rpx rgba(255,122,61,.7); }
.ticket-scarcity-dot::after { position: absolute; inset: -7rpx; border: 1rpx solid rgba(255,122,61,.62); border-radius: 50%; content: ""; animation: ticketDotPulse 1.6s ease-out infinite; }
.ticket-bottom b { display: inline-flex; align-items: center; justify-content: center; min-height: 62rpx; padding: 0 28rpx; border: 1rpx solid rgba(155,137,224,.45); border-radius: 999rpx; color: #9b89e0; font-size: 27rpx; line-height: 1; white-space: nowrap; }
.trial-ghost-card { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 22rpx; margin-top: 24rpx; padding: 30rpx 32rpx; border: 1rpx dashed var(--trial-tint); border-radius: 32rpx; background: radial-gradient(60% 80% at 96% 50%, rgba(158,220,29,.14), transparent 68%), #101010; box-sizing: border-box; }
.trial-ghost-card .ghost-icon { background: rgba(158,220,29,.16); color: var(--trial-tint); }
.ghost-body { min-width: 0; }
.ghost-ribbon { display: flex; align-items: center; gap: 8rpx; min-width: 0; }
.ghost-ribbon text { color: var(--trial-tint); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 21rpx; font-weight: 650; letter-spacing: 1rpx; text-transform: uppercase; }
.ghost-ribbon i { overflow: hidden; color: #6b7385; font-size: 21rpx; font-style: normal; white-space: nowrap; text-overflow: ellipsis; }
.ghost-money { display: flex; align-items: baseline; gap: 8rpx; margin-top: 8rpx; color: #f5f7fa; }
.ghost-money text { color: #9ba3b5; font-size: 26rpx; opacity: .75; }
.ghost-money b { font-size: 44rpx; font-weight: 660; line-height: 1; }
.ghost-money i { color: #58e7ff; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22rpx; font-style: normal; }
.ghost-desc { margin-top: 4rpx; color: #8f98a8; font-size: 22rpx; }
.ghost-arrow { color: #6b7385; font-size: 26rpx; }
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
.quick-menu-mask { position: absolute; inset: 0; z-index: 20; display: flex; align-items: flex-end; background: rgba(0,0,0,.55); backdrop-filter: blur(10rpx); }
.quick-menu { width: 100%; padding: 16rpx 24rpx 24rpx; border-top: 1rpx solid rgba(255,255,255,.08); border-radius: 32rpx 32rpx 0 0; background: #101010; box-sizing: border-box; }
.quick-handle { width: 80rpx; height: 8rpx; margin: 0 auto 12rpx; border-radius: 999rpx; background: rgba(255,255,255,.15); }
.quick-device { overflow: hidden; padding: 10rpx 8rpx 14rpx; color: #8f98a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 23rpx; white-space: nowrap; text-overflow: ellipsis; }
.quick-menu button { justify-content: flex-start; gap: 20rpx; width: 100%; height: 78rpx; padding: 0 20rpx; border-radius: 18rpx; background: transparent; color: #f5f7fa; font-size: 27rpx; }
.quick-menu button .ui-icon { color: #9edc1d; font-size: 30rpx; }
.quick-menu button:nth-of-type(2) .ui-icon { color: #58e7ff; }
.quick-menu button:nth-of-type(3) .ui-icon { color: #ff7a3d; }
.quick-menu .quick-cancel { justify-content: center; height: 80rpx; margin-top: 12rpx; border-radius: 999rpx; background: #1f1f1f; color: #d1d5db; font-size: 25rpx; }
.device-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; padding: 32rpx 40rpx 28rpx; }
.device-id { display: flex; align-items: center; gap: 24rpx; }
.device-icon { display: grid; width: 72rpx; height: 72rpx; place-items: center; border-radius: 18rpx; background: #1f1f1f; color: #9edc1d; font-size: 34rpx; }
.device-id b { font-size: 30rpx; font-weight: 680; }
.device-id text { margin-top: 8rpx; font-size: 25rpx; color: #9ba3b5; }
.online { display: flex; align-items: center; justify-content: center; gap: 10rpx; min-height: 36rpx; color: #9edc1d; font-size: 24rpx; font-weight: 640; line-height: 1; }
.online i { position: relative; width: 18rpx; height: 18rpx; border-radius: 50%; background: #9edc1d; box-shadow: 0 0 12rpx rgba(158,220,29,.85); }
.online i::after { content: ""; position: absolute; inset: -10rpx; border-radius: 50%; border: 2rpx solid rgba(158,220,29,.45); animation: onlinePulse 1.7s ease-out infinite; }
.online.paused { color: #ffbe3d; }
.online.paused i { background: #ffbe3d; box-shadow: 0 0 12rpx rgba(255,190,61,.55); }
.online.paused i::after { border-color: rgba(255,190,61,.35); }
.paused-block { padding: 0 40rpx 30rpx; }
.paused-block > text { display: block; color: #8f98a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22rpx; letter-spacing: 2rpx; text-transform: uppercase; }
.paused-block > view { display: flex; gap: 20rpx; margin-top: 18rpx; padding: 24rpx; border: 1rpx solid rgba(255,190,61,.24); border-radius: 24rpx; background: rgba(255,190,61,.08); }
.paused-block .ui-icon { flex: none; width: 56rpx; height: 56rpx; border-radius: 16rpx; background: rgba(255,190,61,.16); color: #ffbe3d; font-size: 30rpx; }
.paused-block b { display: block; color: #f5f7fa; font-size: 26rpx; line-height: 1.2; }
.paused-block em { display: block; margin-top: 8rpx; color: #9ba3b5; font-size: 22rpx; font-style: normal; line-height: 1.35; }
.current-task { padding: 0 40rpx 30rpx; }
.current-task > text, .task-heading, .market-heading { display: block; color: #8f98a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22rpx; letter-spacing: 2rpx; text-transform: uppercase; }
.current-task b { display: block; margin-top: 18rpx; color: #f5f7fa; font-size: 28rpx; font-weight: 680; }
.current-task b span, .current-task em span { color: #8f98a8; margin: 0 10rpx; }
.current-task em { display: block; margin-top: 10rpx; color: #9ba3b5; font-size: 24rpx; font-style: normal; }
.current-task em strong { color: #9edc1d; font-weight: 560; }
.task-progress-row { display: flex; align-items: center; gap: 24rpx; margin-top: 28rpx; }
.task-progress-row > text { width: 96rpx; color: rgba(245,247,250,.80); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 23rpx; line-height: 1; text-align: right; }
.task-progress { flex: 1; height: 8rpx; overflow: hidden; border-radius: 999rpx; background: #1f1f1f; }
.task-progress view { position: relative; width: 30%; height: 100%; overflow: hidden; border-radius: inherit; background: rgba(158,220,29,.42); }
.task-progress view i { position: absolute; inset: 0; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,.18) 50%, transparent 100%); background-size: 60% 100%; animation: scan 2.4s linear infinite; }
.task-meta { display: flex; justify-content: space-between; margin-top: 14rpx; color: #9ba3b5; font-size: 24rpx; }
.task-meta text:last-child { color: #9edc1d; }
.background-mode { padding: 0 40rpx 16rpx; }
.mode-title { color: #8f98a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 23rpx; font-weight: 500; letter-spacing: 2rpx; line-height: 1; text-transform: uppercase; }
.runtime-row { display: flex; align-items: center; gap: 12rpx; padding: 0 40rpx 22rpx; }
.runtime-pill { gap: 8rpx; height: 56rpx; padding: 0 18rpx; border: 1rpx solid rgba(255,255,255,.08); border-radius: 999rpx; background: rgba(158,220,29,.14); color: #9edc1d; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 21rpx; font-weight: 520; line-height: 1; }
.runtime-pill .ui-icon { width: 24rpx; height: 24rpx; }
.runtime-pill.off { background: #1f1f1f; color: #8f98a8; }
.runtime-hint { padding: 0 40rpx 34rpx; color: #7f8799; font-size: 23rpx; line-height: 1.45; }
.locked-row { padding: 28rpx 40rpx 34rpx; border-top: 0; }
.locked-row text { display: inline-flex; align-items: center; gap: 10rpx; color: #8f98a8; font-size: 24rpx; }
.locked-row > b { display: flex; align-items: baseline; gap: 14rpx; margin-top: 16rpx; color: #ff7a3d; font-size: 48rpx; line-height: 1; }
.locked-row > b i { color: #9ba3b5; font-size: 25rpx; font-style: normal; font-weight: 500; }
.locked-task-list { margin-top: 18rpx; }
.locked-task-list view { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; margin-top: 14rpx; color: rgba(245,247,250,.86); font-size: 24rpx; }
.locked-task-list span { display: flex; min-width: 0; align-items: center; gap: 10rpx; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.locked-task-list .small-lock { color: #9b89e0; }
.locked-task-list strong { display: flex; flex: none; align-items: baseline; gap: 22rpx; color: #9edc1d; font-size: 29rpx; font-weight: 760; }
.locked-task-list em { min-width: 54rpx; color: #6b7385; font-size: 23rpx; font-style: normal; font-weight: 400; text-align: right; }
.unlock-more { width: 100%; height: 96rpx; margin-top: 28rpx; border-radius: 999rpx; background: linear-gradient(90deg, #8e72ff, #9edc1d); color: #090d08; font-size: 28rpx; font-weight: 760; }
.device-earnings { display: flex; justify-content: space-between; gap: 24rpx; padding: 28rpx 40rpx 36rpx; border-top: 1rpx solid rgba(255,255,255,.07); }
.device-earnings text { display: block; color: #8f98a8; font-size: 22rpx; letter-spacing: 2rpx; text-transform: uppercase; }
.device-earnings b { display: block; margin-top: 10rpx; color: #9edc1d; font-size: 54rpx; line-height: 1; }
.device-earnings view:last-child { text-align: right; }
.device-earnings view:last-child b { color: #f5f7fa; font-size: 36rpx; }
.device-earnings i { display: block; margin-top: 8rpx; color: #8e72ff; font-size: 23rpx; font-style: normal; }
.empty-slots-card { position: relative; overflow: hidden; margin-top: 24rpx; padding: 32rpx; border: 1rpx solid rgba(255,255,255,.08); border-radius: 32rpx; background: #101010; }
.capacity-bg { position: absolute; inset: 0; background: radial-gradient(50% 60% at 12% 18%, rgba(158,220,29,.20), transparent 65%), radial-gradient(45% 55% at 88% 82%, rgba(88,231,255,.16), transparent 65%); filter: blur(24rpx); opacity: .85; animation: drift 14s ease-in-out infinite alternate; }
.capacity-grid-bg { position: absolute; inset: 0; background-image: linear-gradient(to right, rgba(255,255,255,.04) 1rpx, transparent 1rpx), linear-gradient(to bottom, rgba(255,255,255,.04) 1rpx, transparent 1rpx); background-size: 48rpx 48rpx; -webkit-mask-image: radial-gradient(ellipse at center, #000 30%, transparent 80%); mask-image: radial-gradient(ellipse at center, #000 30%, transparent 80%); }
.capacity-particles { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.capacity-particles i { position: absolute; bottom: -8rpx; width: 7rpx; height: 7rpx; border-radius: 50%; background: #58e7ff; opacity: 0; box-shadow: 0 0 8rpx currentColor; animation: dotTall 10s linear infinite; }
.capacity-label, .market-heading { position: relative; color: #9edc1d; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 21rpx; font-weight: 500; letter-spacing: 2rpx; text-transform: uppercase; }
.capacity-label { display: flex; align-items: center; gap: 10rpx; }
.capacity-money { position: relative; display: flex; align-items: baseline; gap: 10rpx; margin-top: 18rpx; color: #9edc1d; }
.capacity-money text { font-size: 52rpx; opacity: .78; }
.capacity-money b { font-size: 96rpx; line-height: 1; }
.capacity-money i { color: #8f98a8; font-size: 36rpx; font-style: normal; }
.capacity-money em { padding: 6rpx 16rpx; border-radius: 999rpx; background: rgba(158,220,29,.2); color: #9edc1d; font-size: 21rpx; font-style: normal; text-transform: uppercase; }
.capacity-sub { position: relative; margin-top: 16rpx; color: #8f98a8; font-size: 25rpx; }
.capacity-sub b { color: #f5f7fa; }
.slot-grid { position: relative; display: grid; grid-template-columns: repeat(6,1fr); gap: 12rpx; margin-top: 28rpx; }
.slot-grid view { display: grid; height: 88rpx; place-items: center; border-radius: 24rpx; line-height: 1; }
.slot-grid .filled { position: relative; background: rgba(158,220,29,.16); color: #9edc1d; }
.slot-grid .filled em { position: absolute; top: 8rpx; right: 8rpx; width: 10rpx; height: 10rpx; border-radius: 50%; background: #9edc1d; box-shadow: 0 0 12rpx #9edc1d; animation: pulse 2.4s ease-in-out infinite; }
.slot-grid .empty { border: 1rpx dashed rgba(142,114,255,.45); background: rgba(142,114,255,.08); color: #8e72ff; }
.capacity-stats { position: relative; display: grid; grid-template-columns: repeat(3,1fr); gap: 16rpx; margin-top: 28rpx; padding-top: 24rpx; border-top: 1rpx dashed rgba(255,255,255,.1); text-align: center; }
.capacity-stats view { display: flex; min-width: 0; flex-direction: column; align-items: center; justify-content: center; }
.capacity-stats b { display: flex; align-items: center; justify-content: center; min-height: 34rpx; color: #9edc1d; font-size: 30rpx; line-height: 1; }
.capacity-stats text { display: flex; align-items: center; justify-content: center; min-height: 24rpx; margin-top: 8rpx; color: #6b7385; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 20rpx; line-height: 1; text-align: center; }
.empty-slots-card button { position: relative; display: flex; align-items: center; justify-content: center; gap: 10rpx; width: 100%; height: 96rpx; margin-top: 28rpx; border-radius: 999rpx; background: #9edc1d; color: #090d08; font-size: 28rpx; font-weight: 650; }
.fleet-note { position: relative; margin-top: 16rpx; color: #6b7385; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 21rpx; text-align: center; }
.lifecycle-card, .task-lock { padding: 32rpx; }
.lifecycle-card { background: linear-gradient(160deg, rgba(88,231,255,.12), #101010 70%); border-color: rgba(88,231,255,.22); }
.lifecycle-glow { position: absolute; inset: 0; background: radial-gradient(60% 80% at 95% 50%, rgba(88,231,255,.18), transparent 70%); pointer-events: none; }
.life-label { color: #8e72ff; }
.lifecycle-card .life-label { position: relative; color: #58e7ff; }
.life-number { display: flex; align-items: baseline; gap: 16rpx; margin-top: 16rpx; color: #f5f7fa; font-size: 60rpx; font-weight: 640; }
.life-number b { position: relative; font-size: 60rpx; font-weight: 640; line-height: 1; }
.life-number text { color: #8f98a8; font-size: 22rpx; font-weight: 400; }
.life-bar, .lock-progress { height: 8rpx; margin-top: 24rpx; overflow: hidden; border-radius: 999rpx; background: #1f1f1f; }
.life-bar view { width: 98%; height: 100%; background: rgba(88,231,255,.55); }
.lifecycle-card .life-foot { position: relative; }
.life-foot b { color: #58e7ff; }
.life-foot b i { color: #6b7385; font-size: 21rpx; font-style: normal; font-weight: 400; }
.life-foot button { background: #8e72ff; color: #090d08; }
.lifecycle-card .life-foot button { background: #58e7ff; }
.market-board { padding-bottom: 10rpx; }
.market-heading { padding: 24rpx 32rpx 12rpx; color: #8f98a8; }
.price-row { display: grid; grid-template-columns: 38rpx 1fr 120rpx 90rpx 96rpx; align-items: center; gap: 14rpx; padding: 18rpx 32rpx; border-top: 1rpx solid rgba(255,255,255,.06); }
.price-row > text { display: flex; align-items: center; justify-content: center; width: 38rpx; height: 38rpx; font-size: 28rpx; line-height: 1; text-align: center; color: #d1d5db; }
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
.rank-row > i { display: flex; align-items: center; justify-content: center; width: 38rpx; height: 38rpx; color: #d1d5db; font-style: normal; font-size: 28rpx; line-height: 1; text-align: center; }
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
.task-heading { display: flex; align-items: center; gap: 10rpx; padding: 24rpx 32rpx 12rpx; }
.empty-current { padding: 0 32rpx 24rpx; color: #8f98a8; font-size: 24rpx; }
.unlock-hint { padding: 0 32rpx 12rpx; color: #6b7385; font-size: 22rpx; }
.lock-title, .done-title { border-top: 1rpx solid rgba(255,255,255,.07); }
.teaser-row { display: grid; grid-template-columns: 64rpx 1fr auto; align-items: center; gap: 18rpx; padding: 16rpx 32rpx; }
.teaser-row > text { display: grid; width: 64rpx; height: 64rpx; place-items: center; border-radius: 16rpx; background: rgba(142,114,255,.12); font-size: 28rpx; }
.teaser-row b { color: #f5f7fa; font-size: 25rpx; }
.teaser-row i { display: block; margin-top: 4rpx; color: #6b7385; font-size: 21rpx; font-style: normal; }
.teaser-row i strong { color: #58e7ff; font-weight: 600; }
.teaser-row em { display: flex; flex-direction: column; align-items: flex-end; justify-content: center; min-height: 42rpx; color: #9edc1d; font-size: 30rpx; font-style: normal; font-weight: 640; line-height: 1; }
.teaser-row small { margin-top: 8rpx; color: #8f98a8; font-size: 21rpx; font-weight: 400; }
.completed-row { display: grid; grid-template-columns: 30rpx 1fr auto 90rpx 48rpx; align-items: center; gap: 12rpx; padding: 10rpx 32rpx; color: #8f98a8; font-size: 23rpx; }
.completed-row > text { display: flex; align-items: center; justify-content: center; width: 30rpx; height: 30rpx; color: #9edc1d; line-height: 1; }
.completed-row view { overflow: hidden; color: #d1d5db; white-space: nowrap; text-overflow: ellipsis; }
.completed-row i { color: #8f98a8; font-style: normal; }
.completed-row b { display: flex; align-items: center; justify-content: flex-end; min-height: 30rpx; color: #9edc1d; font-weight: 500; line-height: 1; }
.completed-row em { display: flex; align-items: center; justify-content: flex-end; min-height: 30rpx; color: #8f98a8; font-style: normal; line-height: 1; text-align: right; }
.completed-row span { display: flex; align-items: center; justify-content: center; width: 48rpx; height: 48rpx; color: #8f98a8; }
@keyframes drift { from{transform:translateX(-14rpx)} to{transform:translate(18rpx,10rpx) scale(1.04)} }
@keyframes dot { 0%{opacity:0;transform:translateY(0)} 20%{opacity:.7} 100%{opacity:0;transform:translateY(-360rpx)} }
@keyframes dotTall { 0%{opacity:0;transform:translateY(0)} 18%{opacity:.45} 100%{opacity:0;transform:translateY(-520rpx)} }
@keyframes pulse { 0%,100%{opacity:.45;transform:scale(.85)} 50%{opacity:1;transform:scale(1.15)} }
@keyframes onlinePulse { 0%{opacity:.85;transform:scale(.35)} 70%,100%{opacity:0;transform:scale(1.75)} }
@keyframes scan { 0%{background-position:-100% 0} 100%{background-position:200% 0} }
@keyframes ticketEnter { from{opacity:0;transform:perspective(900rpx) rotateY(-92deg)} 70%{opacity:1;transform:perspective(900rpx) rotateY(8deg)} to{opacity:1;transform:perspective(900rpx) rotateY(0)} }
@keyframes ticketShimmer { 0%{opacity:0;transform:translateX(-120%)} 35%{opacity:.55} 100%{opacity:0;transform:translateX(120%)} }
@keyframes ticketDotPulse { 0%{opacity:.8;transform:scale(.45)} 70%,100%{opacity:0;transform:scale(1.9)} }
</style>
