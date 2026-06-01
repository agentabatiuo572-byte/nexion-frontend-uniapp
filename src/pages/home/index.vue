<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '@/components/AppShell.vue'
import { useAuthStore } from '@/store/auth'
import { requireAuth } from '@/utils/auth-guard'
import { getMainPageMessages, useActiveLocale } from '@/utils/i18n'

const auth = useAuthStore()
const liveTab = ref<'activity' | 'earnings'>('activity')
const dayTasksExpanded = ref(false)
const locale = useActiveLocale()
const copy = computed(() => getMainPageMessages(locale.value))
const t = computed(() => copy.value.home)
const v = computed(() => t.value.v5)
const common = computed(() => copy.value.common)

onShow(() => {
  requireAuth()
})

const firstName = computed(() => (auth.displayName || 'Stellar').split(/\s+/)[0] || 'Stellar')
const level = computed(() => auth.session?.userLevel || 'L0')
const vRank = computed(() => auth.session?.vRank || 'V0')

const headline = computed(() => v.value.headline.split('{amount}'))

const dayTasks = computed(() => [
  { label: v.value.connectWallet, cat: v.value.walletCat, reward: '+50', done: true, color: '#9b89e0' },
  { label: v.value.visitEarnTab, cat: v.value.exploreCat, reward: '+30', done: true, color: '#ff6b35' },
  { label: v.value.visitStore, cat: v.value.exploreCat, reward: '+50', done: true, color: '#ff6b35' },
  { label: v.value.seeProductRoi, cat: v.value.convertCat, reward: '+100', done: false, color: '#c6ff3a' },
  { label: v.value.setupProfile, cat: v.value.identityCat, reward: '+80', done: false, color: '#9b89e0' },
  { label: v.value.inviteFriend, cat: v.value.socialCat, reward: '+200', done: false, color: '#ff6b35' }
])

const activityRows = computed(() => [
  { ts: '+0:00', who: v.value.feedLock, msg: v.value.feedLockedJob, val: v.value.feedLocked, level: 'warn' },
  { ts: '+0:00', who: v.value.feedPeer, msg: 'Maya · ID — Llama 70B @ Helix Labs', val: '+$0.247', level: 'live' },
  { ts: '+0:00', who: v.value.feedLock, msg: v.value.feedLockedJob, val: v.value.feedLocked, level: 'warn' },
  { ts: '+0:00', who: v.value.feedPeer, msg: 'cypher.eth — Sora 8s @ Atrium AI', val: '+$0.612', level: 'live' },
  { ts: '+0:00', who: v.value.feedLock, msg: v.value.feedLockedJob, val: v.value.feedLocked, level: 'warn' },
  { ts: '+0:00', who: v.value.feedYou, msg: 'MobileBERT @ Vector Foundry', val: '+$0.00007', level: 'ok' }
])

const quickActions = computed(() => [
  { icon: '💎', label: v.value.quickStake, sub: '180% APY', tone: 'brand' },
  { icon: '👑', label: v.value.quickGenesis, sub: v.value.quickGenesisSub, tone: 'warm' },
  { icon: '🎯', label: v.value.quickMissions, sub: v.value.quickMissionsSub, tone: 'brand' },
  { icon: '🔥', label: v.value.quickDaily, sub: v.value.quickDailySub, tone: 'warm' }
])

const gridClients = computed(() => [
  { id: 'P', name: 'Pocket Studios', model: 'SDXL Turbo', city: 'Berlin', color: '#9b89e0', gpus: '30 GPUs' },
  { id: 'H', name: 'Helix Labs', model: 'Llama 3.2 3B', city: 'SF', color: '#12c979', gpus: '57 GPUs' },
  { id: 'E', name: 'Echo Earbuds', model: 'Whisper tiny', city: 'Tokyo', color: '#58e7ff', gpus: '84 GPUs' }
])

const earningRows = [
  { name: 'Sarah K.', product: 'NexionBox S1', amount: '+$29.90' },
  { name: 'Tom Wang', product: 'NexionBox Pro', amount: '+$89.90' },
  { name: 'Lisa Park', product: 'NexionRack P1', amount: '+$349.90' }
]

const ledgerRows = [
  { model: 'SDXL Turbo', who: 'Pocket Studios', amt: '+$0.00032', t: '2s' },
  { model: 'Whisper tiny', who: 'Echo Earbuds', amt: '+$0.00005', t: '14s' },
  { model: 'Llama 3.2 3B', who: 'Helix Labs', amt: '+$0.00021', t: '38s' },
  { model: 'Flux Schnell', who: 'Mosaic Studios', amt: '+$0.00048', t: '52s' },
  { model: 'MobileBERT', who: 'Vector Foundry', amt: '+$0.00009', t: '1m' }
]

const trustChips = ['NVIDIA', 'Intel', 'AMD', 'CertiK ✓', 'SOC 2', 'GDPR', 'ISO 27001']

function showSoon(label: string) {
  uni.showToast({ title: common.value.comingSoon(label), icon: 'none' })
}
</script>

<template>
  <AppShell active-tab="home">
    <scroll-view class="page" scroll-y>
      <view class="home-stack">
        <view class="greeting">
          <text class="hello">{{ t.goodDay }}, {{ firstName }}</text>
          <view class="headline">{{ headline[0] }}<text>$0.06</text>{{ headline[1] }}</view>
        </view>

        <view class="money-card card">
          <view class="aurora" />
          <view class="card-top">
            <view>
              <view class="mono muted">{{ t.earnings }}</view>
              <view class="money"><text>$</text>247<text>.83</text></view>
              <view class="success-line">{{ v.todayJobsStreak }}</view>
            </view>
            <view class="live-chip"><i /> {{ t.live }}</view>
          </view>
          <view class="mini-grid">
            <view><text>{{ t.pending }}</text><b>$12.40</b></view>
            <view><text>NEX</text><b>1,842</b></view>
            <view><text>{{ t.rank }}</text><b>{{ vRank }}</b></view>
          </view>
        </view>

        <view class="trial-card card" @click="showSoon(t.freeTrial)">
          <view>
            <view class="ticket">{{ t.freeTrial }}</view>
            <view class="card-title">{{ t.cloudShare }}</view>
            <view class="body">{{ v.noHardwareTrial }}</view>
          </view>
          <view class="trial-side">
            <text>{{ t.earnUpTo }}</text>
            <b>$38</b>
          </view>
        </view>

        <view class="conversion-card card">
          <view>
            <view class="mono muted">{{ v.upgradeSignal }}</view>
            <view class="card-title">{{ v.upgradeSignalBody }}</view>
          </view>
          <button @click="showSoon(t.store)">{{ v.seeRoi }} <text>›</text></button>
        </view>

        <view class="weekly-quest-card card" @click="showSoon(v.weeklyQuestCta)">
          <image class="weekly-device" src="/src/static/products/nexionrack-p1-v2.png" mode="aspectFit" />
          <view class="weekly-content">
            <view class="weekly-meta">
              <view class="weekly-label">
                <text class="quest-icon">⌘</text>
                <text>{{ v.weeklyQuestEyebrow }}</text>
                <text class="mult-chip">1.5×</text>
              </view>
              <view class="weekly-countdown">
                <text>{{ v.weeklyQuestEndsIn }}</text>
                <b>4d 11h</b>
              </view>
            </view>
            <view class="weekly-reward"><text>+</text>1,200 <i>NEX</i></view>
            <view class="weekly-title">{{ v.weeklyQuestActivate }}</view>
            <view class="weekly-stats">
              <text><b>$38.50</b>/d</text>
              <i>·</i>
              <text><em>642×</em> {{ v.weeklyQuestYourPhone }}</text>
              <i>·</i>
              <text>{{ v.weeklyQuestPayback }} <em>~34d</em></text>
            </view>
            <button class="weekly-cta">{{ v.weeklyQuestCta }} <text>→</text></button>
          </view>
        </view>

        <view class="day-card card" :class="{ collapsed: !dayTasksExpanded }">
          <view class="day-head">
            <view>
              <view class="mono muted">{{ t.firstDayReward }}</view>
              <view class="reward"><text>+</text>500 <i>NEX</i></view>
            </view>
            <view class="timer">
              <text>{{ t.endsIn }}</text>
              <b>18:24:00</b>
            </view>
          </view>
          <view class="progress"><view /></view>
          <view class="day-foot">
            <text><b>3</b>/6 {{ v.doneSuffix }}</text>
            <text>+130 {{ v.earnedSuffix }}</text>
          </view>
          <view v-if="dayTasksExpanded" class="task-list">
            <view v-for="task in dayTasks" :key="task.label" class="task-row">
              <text class="task-dot" :class="{ done: task.done }" :style="{ borderColor: task.color, background: task.done ? task.color : 'transparent' }">{{ task.done ? '✓' : '' }}</text>
              <view>
                <b>{{ task.label }}</b>
                <text :style="{ color: task.color }">{{ task.cat }}</text>
              </view>
              <i>{{ task.reward }}</i>
            </view>
          </view>
          <button class="task-toggle" @click="dayTasksExpanded = !dayTasksExpanded">
            {{ dayTasksExpanded ? v.hideTasks : v.viewTasks.replace('{n}', '6') }}
            <text>{{ dayTasksExpanded ? '⌃' : '⌄' }}</text>
          </button>
        </view>

        <view class="live-card card">
          <view class="live-tabs">
            <view class="segmented">
              <button :class="{ on: liveTab === 'activity' }" @click="liveTab = 'activity'">{{ v.liveActivity }}</button>
              <button :class="{ on: liveTab === 'earnings' }" @click="liveTab = 'earnings'">{{ v.liveEarnings }}</button>
            </view>
            <view class="live-chip small live-feed-chip"><i /> {{ v.liveFeed }}</view>
          </view>
          <view v-if="liveTab === 'activity'" class="feed">
            <view v-for="row in activityRows" :key="`${row.ts}-${row.who}-${row.msg}`" class="feed-row">
              <text>{{ row.ts }}</text>
              <b :class="row.level">{{ row.who }}</b>
              <view>{{ row.msg }}</view>
              <i>{{ row.val }}</i>
            </view>
          </view>
          <view v-else class="feed">
            <view v-for="row in earningRows" :key="row.name" class="earn-row">
              <i />
              <b>{{ row.name }}</b>
              <view>{{ v.bought }} {{ row.product }}</view>
              <text>{{ row.amount }}</text>
            </view>
            <view class="see-all">{{ v.seeAll }} ›</view>
          </view>
        </view>

        <view class="quick-grid">
          <button
            v-for="item in quickActions"
            :key="item.label"
            :class="item.tone"
            @click="showSoon(item.label)"
          >
            <text>{{ item.icon }}</text>
            <b>{{ item.label }}</b>
            <i>{{ item.sub }}</i>
          </button>
        </view>

        <view class="fleet-title-row">
          <view><b>{{ v.myFleetTitle }}</b><text>1 of 6</text></view>
          <button @click="showSoon(v.manage)">{{ v.manage }} <text>→</text></button>
        </view>
        <view class="fleet-card card">
          <view class="fleet-row">
            <view class="device-icon">
              <text>▯</text>
              <i />
            </view>
            <view class="fleet-main">
              <view><b>{{ v.yourPhoneDevice }}</b><em>{{ v.earning }}</em></view>
              <text>Mobile NPU · 28 TOPS</text>
            </view>
            <view class="fleet-earn"><b>$0.040</b><text>{{ v.today }}</text></view>
          </view>
          <view class="phone-task">
            <view class="phone-task-top">
              <view>
                <b><i />SDXL Turbo</b>
                <text><strong>Pocket Studios</strong> · Berlin</text>
              </view>
              <em>+$0.00032</em>
            </view>
            <view class="task-progress"><view><i /></view></view>
            <view class="task-meta"><text><b>28%</b> · 28s {{ v.left }}</text><text>7d {{ v.streak }}</text></view>
          </view>
          <view class="add-device">
            <view class="add-icon">＋</view>
            <view><b>{{ v.addNexionBox }}</b><text>{{ v.paysBack34 }}</text></view>
            <em>$38.50<text>{{ v.estPerDay }}</text></em>
          </view>
        </view>

        <view class="on-grid-section">
          <view class="on-grid-title">
            <view>
              <text>{{ v.onGrid }}</text>
              <text class="grid-now">{{ v.gridNow }}</text>
            </view>
            <button @click="showSoon(v.gridMap)">{{ v.gridMap }} <text>→</text></button>
          </view>
          <view class="on-grid-card">
            <view v-for="client in gridClients" :key="client.id" class="on-grid-row">
              <view class="client-mark" :style="{ color: client.color }">{{ client.id }}</view>
              <view class="client-main">
                <b>{{ client.model }}</b>
                <text>{{ client.name }} <i>· {{ client.city }}</i></text>
              </view>
              <em>{{ client.gpus }}</em>
            </view>
            <view class="on-grid-footer">
              <text><b>28,432</b> {{ v.gridOnline }}</text>
              <text>+$215/sec</text>
            </view>
          </view>
        </view>

        <view class="pulse-card card">
          <view>
            <view class="mono muted">{{ v.networkPulse }}</view>
            <view class="card-title">{{ v.networkPulseBody }}</view>
          </view>
          <view class="spark">
            <i v-for="n in 12" :key="n" :style="{ height: `${18 + (n % 5) * 10}rpx` }" />
          </view>
        </view>

        <view class="stella-card">
          <view class="stella-avatar">S</view>
          <view class="stella-bubble">
            <view><b>Stella</b><text> · {{ v.stellaRole }}</text></view>
            <p>{{ v.stellaBody.split('{pct}')[0] }}<b>0.16</b>{{ v.stellaBody.split('{pct}')[1] }}</p>
            <i>{{ v.openChat }} →</i>
          </view>
        </view>

        <view class="rank-card card">
          <view class="rank-orb">{{ vRank }}</view>
          <view>
            <view class="card-title">{{ t.yourRank }}</view>
            <text>{{ level }} · {{ v.nextRankProgress }}</text>
            <view class="rank-progress"><view /></view>
          </view>
        </view>

        <view class="pool-card card">
          <view class="mono muted">{{ v.leadershipPool }}</view>
          <view class="pool-row">
            <b>$42,680</b>
            <text>{{ v.currentMonthlyPool }}</text>
          </view>
          <view class="pool-row">
            <b>V2</b>
            <text>{{ v.requiredToUnlock }}</text>
          </view>
        </view>

        <view class="math-card card">
          <view class="mono muted">{{ v.doTheMath }}</view>
          <view class="math-grid">
            <view><text>{{ v.phone }}</text><b>$0.06/d</b></view>
            <view><text>NexionBox S1</text><b>$38.50/d</b></view>
            <view><text>{{ v.multiplier }}</text><b>640x</b></view>
          </view>
        </view>

        <view class="section-title"><b>{{ v.earningsLedger }}</b><text>5 of 247</text></view>
        <view class="ledger-card card">
          <view v-for="row in ledgerRows" :key="row.model" class="ledger-row">
            <view><b>{{ row.model }}</b><text> · {{ row.who }}</text></view>
            <i>{{ row.amt }}</i>
            <text>{{ row.t }}</text>
          </view>
        </view>

        <view class="market-card card">
          <view class="market-top">
            <view>
              <view class="mono muted">{{ v.nexPrice }}</view>
              <view class="price-line">$0.0842</view>
            </view>
            <view class="success-line">+12.4% 24h</view>
          </view>
          <view class="market-bars"><i v-for="n in 18" :key="n" :style="{ height: `${12 + (n % 6) * 9}rpx` }" /></view>
        </view>

        <view class="trust-card card">
          <view class="trust-title">{{ t.audited }}</view>
          <view class="trust-tags">
            <text v-for="chip in trustChips" :key="chip">{{ chip }}</text>
          </view>
          <view class="trust-note">{{ v.reserveProof }} →</view>
        </view>
      </view>
    </scroll-view>
  </AppShell>
</template>

<style scoped>
.page { height: 100vh; }
.home-stack { padding-bottom: 180rpx; color: #f7f9fc; }
.card { border: 1rpx solid rgba(255,255,255,.08); border-radius: 32rpx; background: #10141d; box-sizing: border-box; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .6rpx; }
.muted { color: #8f98a8; font-size: 23rpx; }
.greeting { padding: 8rpx 4rpx 4rpx; }
.hello { color: #99a3b3; font-size: 27rpx; }
.headline { margin-top: 8rpx; color: #fff; font-size: 52rpx; font-weight: 760; line-height: 1.12; }
.headline text, .success-line { color: #12c979; }
.money-card { position: relative; overflow: hidden; margin-top: 24rpx; padding: 34rpx; box-shadow: 0 24rpx 80rpx rgba(0,0,0,.24); }
.aurora { position: absolute; inset: -35% -10% auto -10%; height: 220%; background: radial-gradient(circle at 18% 72%, rgba(18,201,121,.2), transparent 42%), radial-gradient(circle at 86% 8%, rgba(198,255,58,.15), transparent 36%), radial-gradient(circle at 70% 92%, rgba(88,231,255,.14), transparent 40%); filter: blur(18rpx); animation: aurora 13s ease-in-out infinite alternate; }
.card-top, .day-head, .market-top { position: relative; z-index: 1; display: flex; justify-content: space-between; gap: 24rpx; }
.money { margin-top: 12rpx; color: #fff; font-size: 88rpx; font-weight: 760; line-height: 1; letter-spacing: -2rpx; }
.money text { color: #99a3b3; font-size: 40rpx; font-weight: 600; }
.live-chip { display: inline-flex; align-items: center; gap: 10rpx; height: 40rpx; padding: 0 16rpx; border-radius: 999rpx; background: rgba(88,231,255,.12); color: #58e7ff; font-size: 21rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.live-chip i { width: 9rpx; height: 9rpx; border-radius: 50%; background: #58e7ff; animation: pulse 1.6s infinite; }
.live-chip.small { height: 32rpx; font-size: 20rpx; }
.mini-grid, .math-grid { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(3,1fr); gap: 16rpx; margin-top: 30rpx; }
.mini-grid view, .math-grid view { min-height: 102rpx; padding: 18rpx; border-radius: 22rpx; background: rgba(255,255,255,.05); }
.mini-grid text, .math-grid text { display: block; color: #8f98a8; font-size: 21rpx; }
.mini-grid b, .math-grid b { display: block; margin-top: 8rpx; color: #c6ff3a; font-size: 30rpx; }
.trial-card, .conversion-card { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 24rpx; margin-top: 24rpx; padding: 30rpx 34rpx; background: radial-gradient(circle at 0 100%, rgba(18,201,121,.14), transparent 56%), #10141d; }
.ticket { display: inline-flex; padding: 6rpx 14rpx; border: 1rpx dashed rgba(18,201,121,.46); border-radius: 8rpx; color: #12c979; font-size: 19rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 2rpx; }
.card-title { margin-top: 10rpx; color: #fff; font-size: 32rpx; font-weight: 720; line-height: 1.25; }
.body { margin-top: 8rpx; color: #99a3b3; font-size: 24rpx; line-height: 1.45; }
.trial-side { text-align: right; }
.trial-side text { color: #8f98a8; font-size: 20rpx; }
.trial-side b { display: block; margin-top: 8rpx; color: #12c979; font-size: 54rpx; }
.conversion-card button { display: flex; align-items: center; gap: 8rpx; height: 72rpx; padding: 0 26rpx; border-radius: 999rpx; background: #c6ff3a; color: #10140a; font-size: 25rpx; font-weight: 700; }
.weekly-quest-card { position: relative; min-height: 404rpx; margin-top: 24rpx; overflow: hidden; border-color: rgba(198,255,58,.18); background: radial-gradient(circle at 84% 10%, rgba(155,137,224,.20), transparent 42%), radial-gradient(circle at 12% 88%, rgba(198,255,58,.12), transparent 54%), #101010; box-shadow: 0 22rpx 72rpx rgba(0,0,0,.34); }
.weekly-quest-card::after { content: ""; position: absolute; right: -10rpx; bottom: 0; left: -10rpx; height: 1rpx; background: linear-gradient(90deg, transparent, rgba(198,255,58,.55), transparent); }
.weekly-device { position: absolute; top: -64rpx; right: -116rpx; z-index: 0; width: 440rpx; height: 440rpx; opacity: .44; transform: rotate(-3deg); -webkit-mask-image: radial-gradient(ellipse 360rpx 450rpx at 90% 48%, #000 24%, rgba(0,0,0,.72) 45%, rgba(0,0,0,.34) 66%, transparent 100%); mask-image: radial-gradient(ellipse 360rpx 450rpx at 90% 48%, #000 24%, rgba(0,0,0,.72) 45%, rgba(0,0,0,.34) 66%, transparent 100%); }
.weekly-content { position: relative; z-index: 1; padding: 28rpx 48rpx 32rpx; }
.weekly-meta { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 23rpx; }
.weekly-label { display: inline-flex; align-items: center; min-width: 0; gap: 12rpx; color: #c6ff3a; font-weight: 560; }
.quest-icon { font-size: 25rpx; transform: translateY(-1rpx); }
.mult-chip { padding: 4rpx 12rpx; border: 1rpx solid rgba(198,255,58,.38); border-radius: 8rpx; background: rgba(198,255,58,.14); color: #c6ff3a; line-height: 1; }
.weekly-countdown { display: flex; align-items: center; gap: 10rpx; color: #687181; white-space: nowrap; }
.weekly-countdown b { color: #9b89e0; font-weight: 560; }
.weekly-reward { display: flex; align-items: baseline; gap: 8rpx; margin-top: 54rpx; color: #f8fafc; font-size: 70rpx; font-weight: 780; line-height: 1; letter-spacing: -2rpx; }
.weekly-reward text { color: #f8fafc; font-size: 56rpx; font-weight: 760; }
.weekly-reward i { color: #c6ff3a; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 28rpx; font-style: normal; font-weight: 560; letter-spacing: 0; }
.weekly-title { margin-top: 18rpx; max-width: 500rpx; color: #99a3b3; font-size: 28rpx; font-weight: 620; line-height: 1.25; }
.weekly-stats { display: flex; flex-wrap: wrap; align-items: center; gap: 20rpx; margin-top: 26rpx; color: #7f8898; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 25rpx; }
.weekly-stats b { color: #c6ff3a; font-weight: 650; }
.weekly-stats em { color: #ff7b3d; font-style: normal; font-weight: 650; }
.weekly-stats text:last-child em { color: #9b89e0; }
.weekly-stats i { color: rgba(127,136,152,.55); font-style: normal; }
.weekly-cta { display: flex; align-items: center; justify-content: center; gap: 18rpx; width: 100%; height: 96rpx; margin-top: 32rpx; border-radius: 999rpx; background: #9df20f; color: #090d08; font-size: 30rpx; font-weight: 780; letter-spacing: 0; box-shadow: 0 18rpx 50rpx rgba(157,242,15,.18); }
.weekly-cta text { font-size: 35rpx; transform: translateY(-1rpx); }
.day-card { position: relative; overflow: hidden; margin-top: 24rpx; padding: 32rpx 34rpx 0; background: radial-gradient(circle at 0 0, rgba(198,255,58,.12), transparent 55%), #10141d; }
.day-card.collapsed { padding-bottom: 0; border-color: rgba(198,255,58,.15); }
.reward { margin-top: 8rpx; color: #fff; font-size: 58rpx; font-weight: 760; }
.reward text { color: #8f98a8; font-size: 28rpx; }
.reward i { color: #c6ff3a; font-size: 25rpx; font-style: normal; }
.timer { text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.timer text { display: block; color: #8f98a8; font-size: 22rpx; }
.timer b { display: block; margin-top: 8rpx; color: #9b89e0; font-size: 31rpx; }
.progress { height: 16rpx; margin-top: 28rpx; overflow: hidden; border-radius: 999rpx; background: #242a35; }
.progress view { width: 50%; height: 100%; background: linear-gradient(90deg,#c6ff3a,#58e7ff); border-radius: inherit; }
.day-foot { display: flex; justify-content: space-between; margin-top: 12rpx; color: #8f98a8; font-size: 23rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.day-foot b, .day-foot text:last-child { color: #c6ff3a; }
.task-list { margin-top: 22rpx; padding-top: 20rpx; border-top: 1rpx dashed #303746; }
.task-row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 16rpx; padding: 10rpx 0; }
.task-dot { display: grid; width: 36rpx; height: 36rpx; place-items: center; border: 1rpx solid; border-radius: 50%; color: #10140a; font-size: 20rpx; font-weight: 800; }
.task-row b { display: block; color: #fff; font-size: 25rpx; }
.task-row view text { display: block; margin-top: 3rpx; font-size: 20rpx; }
.task-row i { color: #c6ff3a; font-style: normal; font-weight: 700; }
.task-toggle { display: flex; align-items: center; justify-content: center; gap: 8rpx; width: calc(100% + 68rpx); height: 62rpx; margin: 28rpx -34rpx 0; border-radius: 0 0 32rpx 32rpx; background: rgba(198,255,58,.18); border-top: 1rpx solid rgba(198,255,58,.13); color: #c6ff3a; font-size: 27rpx; font-weight: 650; }
.task-toggle text { font-size: 25rpx; transform: translateY(-1rpx); }
.live-card, .fleet-card, .pulse-card, .rank-card, .pool-card, .math-card, .ledger-card, .market-card, .trust-card { margin-top: 24rpx; padding: 24rpx 28rpx; }
.live-card { overflow: hidden; padding-bottom: 12rpx; border-radius: 32rpx; background: #101010; }
.live-tabs { display: flex; justify-content: space-between; align-items: center; }
.segmented { display: flex; align-items: center; gap: 4rpx; padding: 6rpx; border-radius: 18rpx; background: #161b25; }
.segmented button { display: flex; align-items: center; justify-content: center; min-width: 100rpx; height: 48rpx; margin: 0; padding: 0 24rpx; border: 0; border-radius: 12rpx; background: transparent; color: #8f98a8; font-size: 24rpx; font-weight: 560; line-height: 48rpx; text-align: center; }
.segmented button::after { border: 0; }
.segmented .on { background: #10141d; color: #fff; box-shadow: 0 1rpx 6rpx rgba(0,0,0,.3); }
.live-feed-chip { height: 36rpx; padding: 0 14rpx; border-radius: 8rpx; background: rgba(124,92,255,.24); color: #9b89e0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 21rpx; font-weight: 650; }
.live-feed-chip i { width: 9rpx; height: 9rpx; background: #9b89e0; box-shadow: 0 0 10rpx rgba(155,137,224,.5); }
.feed { margin-top: 10rpx; }
.feed-row { display: grid; grid-template-columns: 82rpx 68rpx 1fr auto; gap: 14rpx; align-items: center; padding: 17rpx 0; border-bottom: 1rpx solid rgba(255,255,255,.06); font-size: 22rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.feed-row text, .feed-row view { color: #8f98a8; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.feed-row view { color: #c8cdd6; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 25rpx; }
.feed-row b { padding: 3rpx 8rpx; text-align: center; border-radius: 6rpx; font-size: 20rpx; letter-spacing: .7rpx; }
.feed-row b.ok { color: #12c979; background: rgba(18,201,121,.12); }
.feed-row b.live { color: #9b89e0; background: rgba(155,137,224,.18); }
.feed-row b.warn { color: #ffcb4d; background: rgba(255,203,77,.18); }
.feed-row i, .earn-row text, .ledger-row i { color: #9df20f; font-style: normal; font-weight: 700; }
.feed-row i { color: #8790a2; }
.feed-row b.live + view + i { color: #9df20f; }
.earn-row { display: grid; grid-template-columns: auto auto 1fr auto; align-items: center; gap: 12rpx; padding: 15rpx 0; border-bottom: 1rpx solid rgba(255,255,255,.06); font-size: 23rpx; }
.earn-row i { width: 9rpx; height: 9rpx; border-radius: 50%; background: #12c979; }
.earn-row b { color: #fff; }
.earn-row view { color: #8f98a8; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.see-all { padding-top: 16rpx; text-align: right; color: #8f98a8; font-size: 22rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.quick-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14rpx; margin-top: 24rpx; }
.quick-grid button { display: flex; height: 118rpx; flex-direction: column; align-items: center; justify-content: center; gap: 6rpx; margin: 0; padding: 0; border: 1rpx solid rgba(198,255,58,.36); border-radius: 24rpx; background: #101010; text-align: center; line-height: 1; }
.quick-grid button::after { border: 0; }
.quick-grid button.warm { border-color: rgba(255,107,53,.46); }
.quick-grid text { display: block; width: 100%; font-size: 31rpx; line-height: 1; text-align: center; }
.quick-grid b { display: block; width: 100%; color: #f3f5f9; font-size: 25rpx; font-weight: 720; line-height: 1.05; text-align: center; }
.quick-grid i { display: block; width: 100%; color: #9df20f; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 21rpx; font-style: normal; font-weight: 650; line-height: 1.1; text-align: center; }
.quick-grid .warm i { color: #ff7b3d; }
.section-title { display: flex; justify-content: space-between; align-items: center; margin: 42rpx 4rpx 18rpx; }
.section-title b { color: #fff; font-size: 30rpx; }
.section-title text { color: #8f98a8; font-size: 22rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.fleet-title-row { display: flex; align-items: center; justify-content: space-between; margin: 24rpx 4rpx 12rpx; }
.fleet-title-row b { color: #fff; font-size: 34rpx; font-weight: 760; letter-spacing: -1rpx; }
.fleet-title-row view text { margin-left: 10rpx; color: #8f98a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 24rpx; }
.fleet-title-row button { display: flex; align-items: center; gap: 10rpx; margin: 0; padding: 0; border: 0; background: transparent; color: #9df20f; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 26rpx; font-weight: 650; line-height: 1; }
.fleet-title-row button::after { border: 0; }
.fleet-card { overflow: hidden; padding: 28rpx 32rpx 0; border-radius: 32rpx; background: #101010; }
.fleet-row { display: grid; grid-template-columns: 92rpx 1fr auto; align-items: center; gap: 22rpx; }
.device-icon, .rank-orb { display: grid; width: 74rpx; height: 74rpx; place-items: center; border-radius: 20rpx; background: rgba(157,242,15,.18); color: #9df20f; font-size: 34rpx; font-weight: 760; }
.device-icon { position: relative; }
.device-icon text { transform: rotate(90deg); font-size: 32rpx; }
.device-icon i { position: absolute; right: -4rpx; bottom: -4rpx; width: 18rpx; height: 18rpx; border: 4rpx solid #101010; border-radius: 50%; background: #9df20f; box-shadow: 0 0 12rpx rgba(157,242,15,.45); }
.fleet-main view { display: flex; align-items: center; gap: 10rpx; min-width: 0; }
.fleet-main b { color: #fff; font-size: 30rpx; font-weight: 740; }
.fleet-main em { padding: 3rpx 10rpx; border-radius: 6rpx; background: rgba(157,242,15,.22); color: #9df20f; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 21rpx; font-style: normal; font-weight: 650; }
.fleet-main text, .rank-card text { display: block; margin-top: 8rpx; color: #8f98a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 24rpx; }
.fleet-earn { text-align: right; }
.fleet-earn b { display: block; color: #9df20f; font-size: 32rpx; font-weight: 760; }
.fleet-earn text { color: #8f98a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 21rpx; font-weight: 650; }
.phone-task { margin-top: 24rpx; padding: 20rpx 24rpx; border-radius: 20rpx; background: rgba(255,255,255,.035); }
.phone-task-top { display: flex; justify-content: space-between; gap: 16rpx; }
.phone-task-top b { display: flex; align-items: center; gap: 12rpx; color: #f4f6fb; font-size: 28rpx; font-weight: 720; }
.phone-task-top b i { width: 13rpx; height: 13rpx; border-radius: 50%; background: #9df20f; box-shadow: 0 0 12rpx rgba(157,242,15,.55); }
.phone-task-top text { display: block; margin-top: 8rpx; color: #697386; font-size: 24rpx; }
.phone-task-top strong { color: #cdd3dd; font-weight: 560; }
.phone-task-top em { color: #9df20f; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 24rpx; font-style: normal; }
.task-progress { height: 10rpx; margin-top: 18rpx; overflow: hidden; border-radius: 999rpx; background: #252b36; }
.task-progress view { position: relative; width: 28%; height: 100%; overflow: hidden; border-radius: inherit; background: linear-gradient(90deg,#12c979,#58e7ff); }
.task-progress view i { position: absolute; inset: 0; background: linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent); animation: shimmer 1.8s ease-in-out infinite; }
.task-meta { display: flex; justify-content: space-between; margin-top: 10rpx; color: #8f98a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22rpx; }
.task-meta b, .task-meta text:last-child { color: #12c979; font-weight: 650; }
.add-device { display: grid; grid-template-columns: 74rpx 1fr auto; align-items: center; gap: 22rpx; margin-top: 8rpx; padding: 24rpx 0; border-top: 1rpx solid rgba(255,255,255,.06); }
.add-icon { display: grid; width: 74rpx; height: 74rpx; place-items: center; border: 2rpx dashed rgba(157,242,15,.45); border-radius: 20rpx; color: #9df20f; font-size: 34rpx; }
.add-device b { color: #fff; font-size: 28rpx; font-weight: 720; }
.add-device view text { display: block; margin-top: 8rpx; color: #8f98a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22rpx; }
.add-device em { color: #9df20f; text-align: right; font-size: 30rpx; font-style: normal; font-weight: 760; }
.add-device em text { display: block; color: #8f98a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 21rpx; font-weight: 560; }
.on-grid-section { margin-top: 24rpx; }
.on-grid-title { display: flex; align-items: center; justify-content: space-between; margin: 16rpx 4rpx 20rpx; }
.on-grid-title view { display: flex; align-items: baseline; gap: 10rpx; min-width: 0; }
.on-grid-title view > text:first-child { color: #f6f8fb; font-size: 30rpx; font-weight: 640; letter-spacing: 0; }
.grid-now { color: #7f8898; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 23rpx; font-weight: 420; }
.on-grid-title button { display: flex; align-items: center; gap: 8rpx; margin: 0; padding: 0; border: 0; background: transparent; color: #9b89e0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 26rpx; font-weight: 560; line-height: 1; }
.on-grid-title button::after { border: 0; }
.on-grid-title button text { transform: translateY(-1rpx); }
.on-grid-card { overflow: hidden; border: 1rpx solid rgba(255,255,255,.08); border-radius: 32rpx; background: #101010; }
.on-grid-row { display: grid; grid-template-columns: 60rpx 1fr auto; align-items: center; gap: 24rpx; min-height: 92rpx; padding: 15rpx 32rpx; border-bottom: 1rpx solid rgba(255,255,255,.07); }
.client-mark { display: grid; width: 60rpx; height: 60rpx; place-items: center; border-radius: 16rpx; background: rgba(155,137,224,.14); font-size: 24rpx; font-weight: 680; }
.client-main { min-width: 0; }
.client-main b { display: block; overflow: hidden; color: #f4f6fa; font-size: 27rpx; font-weight: 560; line-height: 1.25; white-space: nowrap; text-overflow: ellipsis; }
.client-main text { display: block; overflow: hidden; margin-top: 6rpx; color: #8f98a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 23rpx; line-height: 1.2; white-space: nowrap; text-overflow: ellipsis; }
.client-main i { color: #5e6674; font-style: normal; }
.on-grid-row em { color: #12c979; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 24rpx; font-style: normal; font-weight: 560; white-space: nowrap; }
.on-grid-footer { display: flex; align-items: center; justify-content: space-between; min-height: 66rpx; padding: 0 32rpx; border-top: 1rpx solid rgba(255,255,255,.06); background: rgba(255,255,255,.035); color: #8f98a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22rpx; }
.on-grid-footer b { color: #f4f6fb; font-weight: 560; }
.on-grid-footer text:last-child { color: #12c979; font-weight: 560; }
.pulse-card { display: grid; grid-template-columns: 1fr 170rpx; gap: 20rpx; align-items: end; }
.spark, .market-bars { display: flex; align-items: flex-end; gap: 6rpx; height: 70rpx; }
.spark i, .market-bars i { flex: 1; border-radius: 999rpx; background: linear-gradient(180deg,#58e7ff,#9b89e0); }
.stella-card { display: flex; align-items: flex-end; gap: 20rpx; margin-top: 26rpx; padding: 4rpx; }
.stella-avatar { display: grid; width: 88rpx; height: 88rpx; place-items: center; border-radius: 50%; background: #c6ff3a; color: #10140a; font-size: 36rpx; font-weight: 800; box-shadow: 0 0 36rpx rgba(198,255,58,.36); }
.stella-bubble { position: relative; flex: 1; min-width: 0; padding: 22rpx 26rpx; border: 1rpx solid rgba(255,255,255,.08); border-radius: 34rpx 34rpx 34rpx 8rpx; background: radial-gradient(circle at 5% 20%, rgba(198,255,58,.16), transparent 50%), radial-gradient(circle at 86% 80%, rgba(155,137,224,.18), transparent 56%), #10141d; overflow: hidden; }
.stella-bubble b { color: #c6ff3a; }
.stella-bubble text, .stella-bubble p { color: #d7dce6; font-size: 25rpx; line-height: 1.45; }
.stella-bubble p { margin: 10rpx 0 0; }
.stella-bubble i { display: block; margin-top: 12rpx; color: #c6ff3a; font-style: normal; font-size: 23rpx; }
.rank-card { grid-template-columns: auto 1fr; }
.rank-orb { border-radius: 50%; background: #c6ff3a; color: #10140a; }
.rank-progress { height: 9rpx; margin-top: 16rpx; overflow: hidden; border-radius: 999rpx; background: #242a35; }
.rank-progress view { width: 42%; height: 100%; background: #c6ff3a; }
.pool-row { display: flex; justify-content: space-between; padding: 18rpx 0; border-top: 1rpx solid rgba(255,255,255,.06); }
.pool-row b { color: #fff; font-size: 34rpx; }
.pool-row text { color: #8f98a8; font-size: 23rpx; }
.ledger-card { padding-top: 8rpx; padding-bottom: 8rpx; }
.ledger-row { display: grid; grid-template-columns: 1fr auto 50rpx; gap: 14rpx; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid rgba(255,255,255,.06); }
.ledger-row b { color: #fff; font-size: 25rpx; }
.ledger-row view text, .ledger-row > text { color: #8f98a8; font-size: 21rpx; }
.price-line { margin-top: 8rpx; color: #fff; font-size: 50rpx; font-weight: 760; }
.market-bars { margin-top: 24rpx; height: 90rpx; }
.trust-title { color: #d7dce6; font-size: 25rpx; font-weight: 700; }
.trust-tags { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 18rpx; }
.trust-tags text { padding: 8rpx 16rpx; border: 1rpx solid #303746; border-radius: 999rpx; background: #161b25; color: #c8d0dc; font-size: 22rpx; }
.trust-note { margin-top: 18rpx; color: #8f98a8; font-size: 22rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
@keyframes pulse { 0%,100%{opacity:.45;transform:scale(.8)} 50%{opacity:1;transform:scale(1.1)} }
@keyframes aurora { from{transform:translate3d(-10rpx,0,0) scale(1)} to{transform:translate3d(18rpx,10rpx,0) scale(1.05)} }
@keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
</style>
