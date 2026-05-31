<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '@/components/AppShell.vue'
import { useAuthStore } from '@/store/auth'
import { requireAuth } from '@/utils/auth-guard'

const auth = useAuthStore()
const liveTab = ref<'activity' | 'earnings'>('activity')

onShow(() => {
  requireAuth()
})

const firstName = computed(() => (auth.displayName || 'Stellar').split(/\s+/)[0] || 'Stellar')
const level = computed(() => auth.session?.userLevel || 'L0')
const vRank = computed(() => auth.session?.vRank || 'V0')

const dayTasks = [
  { label: 'Connect wallet', cat: 'Wallet', reward: '+50', done: true, color: '#9b89e0' },
  { label: 'Visit Earn tab', cat: 'Explore', reward: '+30', done: true, color: '#ff6b35' },
  { label: 'Visit Store', cat: 'Explore', reward: '+50', done: true, color: '#ff6b35' },
  { label: 'See product ROI', cat: 'Convert', reward: '+100', done: false, color: '#c6ff3a' },
  { label: 'Set up profile', cat: 'Identity', reward: '+80', done: false, color: '#9b89e0' },
  { label: 'Invite a friend', cat: 'Social', reward: '+200', done: false, color: '#ff6b35' }
]

const activityRows = [
  { ts: '+0:00', who: 'You', msg: 'phone node completed SDXL batch', val: '+$0.00032', level: 'ok' },
  { ts: '+0:08', who: 'Grid', msg: 'new inference job routed', val: 'live', level: 'live' },
  { ts: '+0:32', who: 'S1', msg: 'rack slot opened in Singapore', val: 'open', level: 'warn' },
  { ts: '+1:30', who: 'Team', msg: 'Sarah K. bought NexionBox S1', val: '+$29.90', level: 'ok' }
]

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
  uni.showToast({ title: `${label} coming soon`, icon: 'none' })
}
</script>

<template>
  <AppShell active-tab="home">
    <scroll-view class="page" scroll-y>
      <view class="home-stack">
        <view class="greeting">
          <text class="hello">Good day, {{ firstName }}</text>
          <view class="headline">Your node earned <text>$0.06</text> today.</view>
        </view>

        <view class="money-card card">
          <view class="aurora" />
          <view class="card-top">
            <view>
              <view class="mono muted">Earnings</view>
              <view class="money"><text>$</text>247<text>.83</text></view>
              <view class="success-line">+5.2% today · 14 jobs · 7d streak</view>
            </view>
            <view class="live-chip"><i /> live</view>
          </view>
          <view class="mini-grid">
            <view><text>Pending</text><b>$12.40</b></view>
            <view><text>NEX</text><b>1,842</b></view>
            <view><text>Rank</text><b>{{ vRank }}</b></view>
          </view>
        </view>

        <view class="trial-card card" @click="showSoon('Free trial')">
          <view>
            <view class="ticket">FREE TRIAL</view>
            <view class="card-title">Try Cloud Share for 24h.</view>
            <view class="body">No hardware, no shipping. Start earning from a managed slice of the grid.</view>
          </view>
          <view class="trial-side">
            <text>earn up to</text>
            <b>$38</b>
          </view>
        </view>

        <view class="conversion-card card">
          <view>
            <view class="mono muted">Upgrade signal</view>
            <view class="card-title">Your phone is earning. Hardware makes the curve obvious.</view>
          </view>
          <button @click="showSoon('Store')">See ROI <text>›</text></button>
        </view>

        <view class="day-card card">
          <view class="day-head">
            <view>
              <view class="mono muted">First day reward</view>
              <view class="reward"><text>+</text>500 <i>NEX</i></view>
            </view>
            <view class="timer">
              <text>Ends in</text>
              <b>18:24:00</b>
            </view>
          </view>
          <view class="progress"><view /></view>
          <view class="day-foot">
            <text><b>3</b>/6 done</text>
            <text>+130 NEX earned</text>
          </view>
          <view class="task-list">
            <view v-for="task in dayTasks" :key="task.label" class="task-row">
              <text class="task-dot" :class="{ done: task.done }" :style="{ borderColor: task.color, background: task.done ? task.color : 'transparent' }">{{ task.done ? '✓' : '' }}</text>
              <view>
                <b>{{ task.label }}</b>
                <text :style="{ color: task.color }">{{ task.cat }}</text>
              </view>
              <i>{{ task.reward }}</i>
            </view>
          </view>
        </view>

        <view class="live-card card">
          <view class="live-tabs">
            <view class="segmented">
              <button :class="{ on: liveTab === 'activity' }" @click="liveTab = 'activity'">Activity</button>
              <button :class="{ on: liveTab === 'earnings' }" @click="liveTab = 'earnings'">Earnings</button>
            </view>
            <view class="live-chip small"><i /> live</view>
          </view>
          <view v-if="liveTab === 'activity'" class="feed">
            <view v-for="row in activityRows" :key="row.ts" class="feed-row">
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
              <view>bought {{ row.product }}</view>
              <text>{{ row.amount }}</text>
            </view>
            <view class="see-all">See all ›</view>
          </view>
        </view>

        <view class="quick-grid">
          <button @click="showSoon('Store')"><text>▣</text><b>Store</b></button>
          <button @click="showSoon('Devices')"><text>▤</text><b>Devices</b></button>
          <button @click="showSoon('Wallet')"><text>⇩</text><b>Wallet</b></button>
          <button @click="showSoon('Team')"><text>◇</text><b>Team</b></button>
        </view>

        <view class="section-title"><b>My fleet</b><text>0 / 6 active</text></view>
        <view class="fleet-card card">
          <view class="device-icon">▯</view>
          <view class="fleet-main">
            <b>Phone node</b>
            <text>On Nexion grid · mobile NPU earning</text>
          </view>
          <view class="slot-bars"><i v-for="n in 6" :key="n" :class="{ on: n === 1 }" /></view>
        </view>

        <view class="grid-card card">
          <view class="mono muted">On Nexion grid</view>
          <view class="grid-stats">
            <view><b>4,821</b><text>live boxes</text></view>
            <view><b>102ms</b><text>median route</text></view>
            <view><b>99.9%</b><text>uptime SLA</text></view>
          </view>
        </view>

        <view class="pulse-card card">
          <view>
            <view class="mono muted">Network pulse</view>
            <view class="card-title">Demand is above baseline in 3 regions.</view>
          </view>
          <view class="spark">
            <i v-for="n in 12" :key="n" :style="{ height: `${18 + (n % 5) * 10}rpx` }" />
          </view>
        </view>

        <view class="stella-card">
          <view class="stella-avatar">S</view>
          <view class="stella-bubble">
            <view><b>Stella</b><text> · AI advisor</text></view>
            <p>Your yield is in the top <b>0.16%</b> for phone-only nodes. Want a faster path?</p>
            <i>Open chat →</i>
          </view>
        </view>

        <view class="rank-card card">
          <view class="rank-orb">{{ vRank }}</view>
          <view>
            <view class="card-title">Your rank</view>
            <text>{{ level }} · next rank progress</text>
            <view class="rank-progress"><view /></view>
          </view>
        </view>

        <view class="pool-card card">
          <view class="mono muted">Leadership pool</view>
          <view class="pool-row">
            <b>$42,680</b>
            <text>current monthly pool</text>
          </view>
          <view class="pool-row">
            <b>V2</b>
            <text>required to unlock</text>
          </view>
        </view>

        <view class="math-card card">
          <view class="mono muted">Do the math</view>
          <view class="math-grid">
            <view><text>Phone</text><b>$0.06/d</b></view>
            <view><text>NexionBox S1</text><b>$38.50/d</b></view>
            <view><text>Multiplier</text><b>640x</b></view>
          </view>
        </view>

        <view class="section-title"><b>Earnings ledger</b><text>5 of 247</text></view>
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
              <view class="mono muted">NEX price</view>
              <view class="price-line">$0.0842</view>
            </view>
            <view class="success-line">+12.4% 24h</view>
          </view>
          <view class="market-bars"><i v-for="n in 18" :key="n" :style="{ height: `${12 + (n % 6) * 9}rpx` }" /></view>
        </view>

        <view class="trust-card card">
          <view class="trust-title">Independently audited</view>
          <view class="trust-tags">
            <text v-for="chip in trustChips" :key="chip">{{ chip }}</text>
          </view>
          <view class="trust-note">Reserve proof on-chain · 102.4% backed · Trust Center →</view>
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
.mini-grid, .grid-stats, .math-grid { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(3,1fr); gap: 16rpx; margin-top: 30rpx; }
.mini-grid view, .grid-stats view, .math-grid view { min-height: 102rpx; padding: 18rpx; border-radius: 22rpx; background: rgba(255,255,255,.05); }
.mini-grid text, .grid-stats text, .math-grid text { display: block; color: #8f98a8; font-size: 21rpx; }
.mini-grid b, .grid-stats b, .math-grid b { display: block; margin-top: 8rpx; color: #c6ff3a; font-size: 30rpx; }
.trial-card, .conversion-card { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 24rpx; margin-top: 24rpx; padding: 30rpx 34rpx; background: radial-gradient(circle at 0 100%, rgba(18,201,121,.14), transparent 56%), #10141d; }
.ticket { display: inline-flex; padding: 6rpx 14rpx; border: 1rpx dashed rgba(18,201,121,.46); border-radius: 8rpx; color: #12c979; font-size: 19rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 2rpx; }
.card-title { margin-top: 10rpx; color: #fff; font-size: 32rpx; font-weight: 720; line-height: 1.25; }
.body { margin-top: 8rpx; color: #99a3b3; font-size: 24rpx; line-height: 1.45; }
.trial-side { text-align: right; }
.trial-side text { color: #8f98a8; font-size: 20rpx; }
.trial-side b { display: block; margin-top: 8rpx; color: #12c979; font-size: 54rpx; }
.conversion-card button { display: flex; align-items: center; gap: 8rpx; height: 72rpx; padding: 0 26rpx; border-radius: 999rpx; background: #c6ff3a; color: #10140a; font-size: 25rpx; font-weight: 700; }
.day-card { margin-top: 24rpx; padding: 32rpx 34rpx; background: radial-gradient(circle at 0 0, rgba(198,255,58,.12), transparent 55%), #10141d; }
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
.live-card, .fleet-card, .grid-card, .pulse-card, .rank-card, .pool-card, .math-card, .ledger-card, .market-card, .trust-card { margin-top: 24rpx; padding: 24rpx 28rpx; }
.live-tabs { display: flex; justify-content: space-between; align-items: center; }
.segmented { display: flex; gap: 4rpx; padding: 6rpx; border-radius: 18rpx; background: #161b25; }
.segmented button { height: 48rpx; padding: 0 22rpx; border-radius: 12rpx; color: #8f98a8; font-size: 23rpx; }
.segmented .on { background: #10141d; color: #fff; box-shadow: 0 1rpx 6rpx rgba(0,0,0,.3); }
.feed { margin-top: 10rpx; }
.feed-row { display: grid; grid-template-columns: 72rpx 60rpx 1fr auto; gap: 12rpx; align-items: center; padding: 15rpx 0; border-bottom: 1rpx solid rgba(255,255,255,.06); font-size: 22rpx; }
.feed-row text, .feed-row view { color: #8f98a8; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.feed-row b { text-align: center; border-radius: 6rpx; font-size: 20rpx; }
.feed-row b.ok { color: #12c979; background: rgba(18,201,121,.12); }
.feed-row b.live { color: #58e7ff; background: rgba(88,231,255,.12); }
.feed-row b.warn { color: #ffcb4d; background: rgba(255,203,77,.12); }
.feed-row i, .earn-row text, .ledger-row i { color: #12c979; font-style: normal; font-weight: 700; }
.earn-row { display: grid; grid-template-columns: auto auto 1fr auto; align-items: center; gap: 12rpx; padding: 15rpx 0; border-bottom: 1rpx solid rgba(255,255,255,.06); font-size: 23rpx; }
.earn-row i { width: 9rpx; height: 9rpx; border-radius: 50%; background: #12c979; }
.earn-row b { color: #fff; }
.earn-row view { color: #8f98a8; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.see-all { padding-top: 16rpx; text-align: right; color: #8f98a8; font-size: 22rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.quick-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16rpx; margin-top: 24rpx; }
.quick-grid button { display: flex; height: 128rpx; flex-direction: column; align-items: center; justify-content: center; gap: 12rpx; border: 1rpx solid rgba(255,255,255,.08); border-radius: 28rpx; background: #10141d; }
.quick-grid text { color: #c6ff3a; font-size: 33rpx; }
.quick-grid b { color: #d7dce6; font-size: 23rpx; }
.section-title { display: flex; justify-content: space-between; align-items: center; margin: 42rpx 4rpx 18rpx; }
.section-title b { color: #fff; font-size: 30rpx; }
.section-title text { color: #8f98a8; font-size: 22rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.fleet-card, .rank-card { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 22rpx; }
.device-icon, .rank-orb { display: grid; width: 82rpx; height: 82rpx; place-items: center; border-radius: 22rpx; background: rgba(18,201,121,.12); color: #12c979; font-size: 34rpx; font-weight: 760; }
.fleet-main b { display: block; color: #fff; font-size: 27rpx; }
.fleet-main text, .rank-card text { display: block; margin-top: 8rpx; color: #8f98a8; font-size: 22rpx; }
.slot-bars { display: flex; gap: 8rpx; }
.slot-bars i { width: 10rpx; height: 36rpx; border-radius: 4rpx; background: #303746; }
.slot-bars .on { background: #12c979; }
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
</style>
