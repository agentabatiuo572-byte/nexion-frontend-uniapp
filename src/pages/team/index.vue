<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '@/components/AppShell.vue'
import { useAuthStore } from '@/store/auth'
import { requireAuth } from '@/utils/auth-guard'
import { getMainPageMessages, useActiveLocale } from '@/utils/i18n'

const auth = useAuthStore()
const locale = useActiveLocale()

onShow(() => {
  requireAuth()
})

const vRank = computed(() => auth.session?.vRank || 'V2')
const referralCode = computed(() => auth.session?.referralCode || 'NX279740')
const referralUrl = computed(() => `https://nexion.ai/ref/${referralCode.value}`)
const copy = computed(() => getMainPageMessages(locale.value))
const t = computed(() => copy.value.team)
const isZh = computed(() => locale.value === 'zh')

const teamSeed = {
  totalMembers: 50,
  directMembers: 8,
  extendedMembers: 42,
  leftVolume: 2695,
  rightVolume: 2456,
  binaryMatch: 8.19,
  monthUSDT: 312.8,
  monthNEX: 1840,
  lifetimeUSDT: 2948.2,
  directUSDT: 118.86,
  extendedUSDT: 193.94,
  settledUSDT: 186.3,
  coolingUSDT: 126.5,
  directPct: 38,
  extendedPct: 62,
  vProgressPct: 63
}

const tickerIndex = ref(0)
let tickerTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  tickerTimer = setInterval(() => {
    tickerIndex.value = (tickerIndex.value + 1) % tickerItems.value.length
  }, 4200)
})

onUnmounted(() => {
  if (tickerTimer) clearInterval(tickerTimer)
})

const pageCopy = computed(() => {
  const zh = isZh.value
  return {
    yourRank: zh ? '你的等级' : 'Your rank',
    directBonus: zh ? '直推奖' : 'Direct bonus',
    extendedRoyalty: zh ? '扩展网络版税' : 'Extended royalty',
    next: zh ? '下一阶:' : 'Next:',
    need: zh ? '仍需:' : 'Need:',
    prize: zh ? '奖品:' : 'Prize:',
    rankTitle: zh ? 'Operator 操作员' : 'Operator',
    nextRank: 'V3 Captain',
    missing: zh ? '$14,760 团队业绩' : '$14,760 more team volume',
    inviteEarn: zh ? '每邀请 1 位朋友赚' : 'Earn for each friend',
    earnedToday: zh ? '今日 247 人已领取' : '247 earned today',
    promo: zh ? '限时 · 本周邀请奖励 2×' : 'Limited time · 2× bonus this week',
    perFriend: zh ? '每位注册好友 · 30 天冷却' : 'per friend who signs up · 30-day cooldown',
    poster: zh ? '海报' : 'Poster',
    posterValue: zh ? '二维码 + 图' : 'QR + image',
    code: zh ? '邀请码' : 'Code',
    link: zh ? '链接' : 'Link',
    share: zh ? '分享赚' : 'Share & earn',
    copied: zh ? '已复制' : 'Copied',
    shared: zh ? '已打开分享' : 'Share opened',
    leaderboardTitle: zh ? '邀请榜' : 'Top Inviters',
    leaderboardSubtitle: zh ? '实时排名 · $50K 周奖池' : 'Live ranking · $50K weekly pool',
    sevenLayer: zh ? '版税网络' : 'Royalty network',
    direct: zh ? '直推' : 'Direct',
    extended: zh ? '扩展' : 'Extended',
    todayMatch: zh ? '今日对碰' : 'Today match',
    weeklyPool: zh ? '本周领导池' : 'Weekly pool',
    votes: zh ? '票' : 'votes',
    thisMonth: zh ? '本月' : 'This month',
    viewDetails: zh ? '查看明细' : 'View details',
    lifetime: zh ? '累计' : 'Lifetime',
    settled: zh ? '已结算' : 'Settled',
    coolingDown: zh ? '冷却中' : 'Cooling down',
    contributors: zh ? '贡献者' : 'contributors',
    composition: zh ? '影响力网络构成' : 'Influence network composition',
    genesisLabel: zh ? '创世节点 · 限量' : 'Genesis Node · limited',
    genesisHeadline: zh ? '永久分享网络成交额' : 'Permanent share of network volume',
    genesisPrice: zh ? '$9,999 · ~$1.5K/月收益' : '$9,999 · ~$1.5K/mo yield',
    genesisLeft: zh ? '1,000 张剩约 150' : '~150 left of 1,000',
    hardwareQuota: zh ? '硬件配额' : 'Hardware quota',
    quotaSubtitle: zh ? 'Pro / Rack 凭邀请解锁' : 'Pro / Rack unlocked by invites',
    ambassador: zh ? '区域大使' : 'Regional ambassador',
    ambassadorSubtitle: zh ? 'V5+ 区域预算' : 'V5+ regional budget',
    influenceNetwork: zh ? '影响力网络' : 'Influence network',
    orbitLiveMap: zh ? '实时轨道图' : 'Orbit live map',
    genealogy: zh ? '族谱' : 'Genealogy',
    genealogySubtitle: zh ? '7 层网络树' : '7-layer network tree'
  }
})

const tickerItems = computed(() => {
  const zh = isZh.value
  return [
    { name: 'Sarah K.', action: zh ? '刚加入你的网络' : 'just joined your network', amount: '+$45.20' },
    { name: 'Tom W.', action: zh ? '购买了 NexionBox S1' : 'bought NexionBox S1', amount: '+$130.00' },
    { name: 'Carlos R.', action: zh ? '升级到 V3 Captain' : 'upgraded to V3 Captain', amount: '+$28.40' },
    { name: 'Mei L.', action: zh ? '新增第二台设备' : 'added a second device', amount: '+$76.00' }
  ]
})

const activeTicker = computed(() => tickerItems.value[tickerIndex.value])

function notify(title: string) {
  uni.showToast({ title, icon: 'none' })
}

function copyText(value: string, label: string) {
  uni.setClipboardData({
    data: value,
    success: () => notify(`${label} ${pageCopy.value.copied}`)
  })
}

function openTab(url: string) {
  uni.switchTab({ url })
}

function openPage(url: string) {
  uni.navigateTo({ url })
}

function openBills() {
  openPage('/pages/team/commissions')
}

async function shareInvite() {
  const title = 'Nexion'
  const text = isZh.value ? `加入我的 Nexion 网络: ${referralUrl.value}` : `Join my Nexion network: ${referralUrl.value}`
  const nav = typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> })

  if (nav?.share) {
    try {
      await nav.share({ title, text, url: referralUrl.value })
      notify(pageCopy.value.shared)
      return
    } catch {
      return
    }
  }

  copyText(referralUrl.value, pageCopy.value.link)
}
</script>

<template>
  <AppShell :title="t.title" version="" active-tab="team">
    <scroll-view class="page" scroll-y>
      <view class="rank-card" @click="openPage('/pages/team/rank')">
        <view class="orb-layer">
          <view class="orb-core" />
          <view class="orb-direct-ring" />
          <view class="orb-group orb-outer">
            <view v-for="i in 14" :key="`outer-${i}`" class="orb-dot extended" />
          </view>
          <view class="orb-group orb-inner">
            <view v-for="i in 6" :key="`inner-${i}`" class="orb-spoke" />
            <view v-for="i in 6" :key="`direct-${i}`" class="orb-dot direct"><view /></view>
          </view>
        </view>
        <view class="rank-top">
          <view>
            <view class="mono cyan">{{ pageCopy.yourRank }}</view>
            <view class="v-line">
              <view class="v-badge">{{ vRank }}</view>
              <view class="v-title">{{ pageCopy.rankTitle }}</view>
            </view>
            <view class="muted">{{ pageCopy.directBonus }} 10% · {{ pageCopy.extendedRoyalty }}</view>
          </view>
          <i class="team-icon icon-chevron" />
        </view>
        <view class="progress-block">
          <view class="progress-head">
            <text>{{ pageCopy.next }} <b>{{ pageCopy.nextRank }}</b></text>
            <text>{{ teamSeed.vProgressPct }}%</text>
          </view>
          <view class="progress-track"><view class="grow-bar rank-grow" /></view>
          <view class="need-line">{{ pageCopy.need }} {{ pageCopy.missing }}</view>
          <view class="prize-pill">{{ pageCopy.prize }} · Apple Watch SE</view>
        </view>
      </view>

      <view class="invite-card">
        <view class="grid-overlay" />
        <view class="invite-head">
          <text><i class="money-emoji">💰</i> {{ pageCopy.inviteEarn }}</text>
          <view><i class="live-dot" />{{ pageCopy.earnedToday }}</view>
        </view>
        <view class="promo-pill">
          <i class="team-icon icon-flame" />
          <text>{{ pageCopy.promo }}</text>
        </view>
        <view class="invite-body">
          <view class="invite-stats">
            <view class="reward-main"><text>$</text>400</view>
            <view class="reward-strike">$200</view>
            <view class="nex-reward">+ 400 NEX</view>
            <view class="muted">{{ pageCopy.perFriend }}</view>
          </view>
          <view class="share-stack">
            <button @click.stop="copyText(referralUrl, pageCopy.poster)"><i class="team-icon icon-qr" /><b>{{ pageCopy.poster }}</b><i>{{ pageCopy.posterValue }}</i></button>
            <button @click.stop="copyText(referralCode, pageCopy.code)"><i class="team-icon icon-hash" /><b>{{ pageCopy.code }}</b><i>{{ referralCode }}</i></button>
            <button @click.stop="copyText(referralUrl, pageCopy.link)"><i class="team-icon icon-link" /><b>{{ pageCopy.link }}</b><i>nexion.ai/ref/...</i></button>
            <button class="share-primary" @click.stop="shareInvite"><i class="team-icon icon-send" /> {{ pageCopy.share }} <b>$400</b></button>
          </view>
        </view>
        <view class="ticker" :key="tickerIndex">
          <i class="team-icon icon-zap" />
          <b>{{ activeTicker.name }}</b>
          <text>{{ activeTicker.action }}</text>
          <i>{{ activeTicker.amount }}</i>
          <i class="team-icon icon-arrow-up" />
        </view>
      </view>

      <view class="leader-card" @click="openPage('/pages/team/leaderboard')">
        <view class="leader-icon"><i class="team-icon icon-trophy" /></view>
        <view>
          <view class="mono warning">{{ pageCopy.leaderboardTitle }}</view>
          <text>{{ pageCopy.leaderboardSubtitle }}</text>
        </view>
        <i class="team-icon icon-chevron" />
      </view>

      <view class="quick-grid">
        <view class="quick-card" @click="openPage('/pages/team/unilevel')">
          <view class="quick-top"><i class="team-icon icon-users brand" /><i class="team-icon icon-arrow-up" /></view>
          <view class="quick-num">{{ teamSeed.totalMembers }}</view>
          <view class="quick-title">{{ pageCopy.sevenLayer }}</view>
          <view class="quick-meta">{{ pageCopy.direct }} · {{ teamSeed.directMembers }}</view>
          <view class="quick-meta">{{ pageCopy.extended }} · {{ teamSeed.extendedMembers }}</view>
        </view>
        <view class="quick-card" @click="openPage('/pages/team/binary')">
          <view class="quick-top"><i class="team-icon icon-zap warning" /><i class="team-icon icon-arrow-up" /></view>
          <view class="quick-num orange">+${{ teamSeed.binaryMatch.toFixed(2) }}</view>
          <view class="quick-title">{{ pageCopy.todayMatch }}</view>
          <view class="quick-meta">A · ${{ teamSeed.leftVolume.toLocaleString() }}</view>
          <view class="quick-meta">B · ${{ teamSeed.rightVolume.toLocaleString() }}</view>
        </view>
        <view class="quick-card" @click="openPage('/pages/team/commissions')">
          <view class="quick-top"><i class="team-icon icon-crown tech" /><i class="team-icon icon-arrow-up" /></view>
          <view class="quick-num">$0.00</view>
          <view class="quick-title">{{ pageCopy.weeklyPool }}</view>
          <view class="quick-meta">0 {{ pageCopy.votes }}</view>
          <view class="quick-meta">0.00%</view>
        </view>
      </view>

      <view class="ledger-card" @click="openBills">
        <view class="grid-overlay" />
        <view class="aurora" />
        <view class="float-dots">
          <text v-for="i in 5" :key="i" />
        </view>
        <view class="ledger-content">
          <view class="ledger-head">
            <text>{{ pageCopy.thisMonth }}</text>
            <button @click.stop="openBills">{{ pageCopy.viewDetails }} <i class="team-icon icon-chevron" /></button>
          </view>
          <view class="ledger-money"><text>$</text>{{ Math.floor(teamSeed.monthUSDT) }}<text>.{{ teamSeed.monthUSDT.toFixed(2).slice(3) }}</text><i>+ {{ teamSeed.monthNEX.toLocaleString() }} NEX</i></view>
          <view class="ledger-sub">{{ pageCopy.lifetime }} ${{ teamSeed.lifetimeUSDT.toFixed(2) }} · {{ teamSeed.totalMembers }} {{ pageCopy.contributors }} · <b>+12.4%</b></view>
          <view class="split-bar"><view class="direct" /><view class="extended" /></view>
          <view class="split-grid">
            <view>
              <text class="green">{{ pageCopy.direct }} · {{ teamSeed.directPct }}%</text>
              <b>${{ teamSeed.directUSDT.toFixed(2) }}</b>
            </view>
            <view>
              <text class="orange">{{ pageCopy.extended }} · {{ teamSeed.extendedPct }}%</text>
              <b>${{ teamSeed.extendedUSDT.toFixed(2) }}</b>
            </view>
          </view>
          <view class="settle-grid">
            <view><text>{{ pageCopy.settled }}</text><b>${{ teamSeed.settledUSDT.toFixed(2) }}</b></view>
            <view><text>{{ pageCopy.coolingDown }}</text><b>${{ teamSeed.coolingUSDT.toFixed(2) }}</b></view>
          </view>
        </view>
      </view>

      <view class="composition-card" @click="openPage('/pages/team/unilevel')">
        <view class="card-head">
          <text>{{ pageCopy.composition }}</text>
          <i class="team-icon icon-chevron" />
        </view>
        <view class="comp-row">
          <text class="green">{{ pageCopy.direct }}</text>
          <view><i style="width: 16%" /></view>
          <b>{{ teamSeed.directMembers }}</b>
        </view>
        <view class="comp-row">
          <text class="cyan">{{ pageCopy.extended }}</text>
          <view><i style="width: 84%" /></view>
          <b>{{ teamSeed.extendedMembers }}</b>
        </view>
      </view>

      <view class="genesis-card" @click="openPage('/pages/genesis/index')">
        <view class="genesis-head">
          <view class="genesis-icon"><i class="team-icon icon-crown" /></view>
          <view>
            <view class="mono orange">{{ pageCopy.genesisLabel }}</view>
            <text>{{ pageCopy.genesisHeadline }}</text>
          </view>
          <i class="team-icon icon-chevron" />
        </view>
        <view class="genesis-meta">
          <text>{{ pageCopy.genesisPrice }}</text>
          <text>{{ pageCopy.genesisLeft }}</text>
        </view>
        <view class="genesis-progress"><view /></view>
      </view>

      <view class="two-grid">
        <view class="small-card" @click="openTab('/pages/store/index')">
          <view class="quick-top"><i class="team-icon icon-zap orange" /><i class="team-icon icon-arrow-up" /></view>
          <b>{{ pageCopy.hardwareQuota }}</b>
          <text>{{ pageCopy.quotaSubtitle }}</text>
        </view>
        <view class="small-card" @click="openPage('/pages/team/rank')">
          <view class="quick-top"><i class="team-icon icon-crown warning" /><i class="team-icon icon-arrow-up" /></view>
          <b>{{ pageCopy.ambassador }}</b>
          <text>{{ pageCopy.ambassadorSubtitle }}</text>
        </view>
      </view>

      <view class="two-grid">
        <view class="small-card" @click="openPage('/pages/team/unilevel')">
          <view class="orbit-dot" />
          <b>{{ pageCopy.influenceNetwork }}</b>
          <text>{{ pageCopy.orbitLiveMap }}</text>
        </view>
        <view class="small-card" @click="openPage('/pages/team/unilevel')">
          <view class="quick-top"><i class="team-icon icon-users green" /><i class="team-icon icon-arrow-up" /></view>
          <b>{{ pageCopy.genealogy }}</b>
          <text>{{ pageCopy.genealogySubtitle }}</text>
        </view>
      </view>
      <view class="bottom-spacer" />
    </scroll-view>
  </AppShell>
</template>

<style scoped>
.page {
  max-height: calc(100vh - 260rpx);
}

.bottom-spacer {
  height: 180rpx;
}

.rank-card,
.invite-card,
.leader-card,
.quick-card,
.ledger-card,
.composition-card,
.genesis-card,
.small-card {
  position: relative;
  overflow: hidden;
  border: 1rpx solid #232936;
  border-radius: 32rpx;
  background: #10141d;
}

.rank-card {
  margin-top: 24rpx;
  padding: 32rpx;
  background:
    radial-gradient(80% 60% at 80% 0%, rgba(70, 230, 255, 0.11), transparent 65%),
    #10141d;
}

.orb-layer {
  position: absolute;
  top: 50%;
  right: -80rpx;
  width: 440rpx;
  height: 440rpx;
  opacity: 0.36;
  pointer-events: none;
  transform: translateY(-50%);
}

.orb-core {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(158, 220, 29, 0.32), rgba(158, 220, 29, 0.08) 60%, transparent 72%);
  animation: orb-breathe 4.4s ease-in-out infinite;
  transform: translate(-50%, -50%);
}

.orb-direct-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 116rpx;
  height: 116rpx;
  border: 1rpx solid rgba(158, 220, 29, 0.22);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.orb-group {
  position: absolute;
  inset: 0;
  transform-origin: center;
}

.orb-group::before {
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 50%;
  content: "";
}

.orb-outer {
  animation: orb-spin 42s linear infinite;
}

.orb-outer::before {
  width: 322rpx;
  height: 322rpx;
  border: 1rpx dashed rgba(142, 114, 255, 0.24);
  transform: translate(-50%, -50%);
}

.orb-inner {
  animation: orb-spin-reverse 28s linear infinite;
}

.orb-inner::before {
  width: 142rpx;
  height: 142rpx;
  border: 1rpx solid rgba(158, 220, 29, 0.22);
  transform: translate(-50%, -50%);
}

.orb-dot {
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 50%;
  transform-origin: center;
}

.orb-dot.extended {
  width: 6rpx;
  height: 6rpx;
  background: rgba(142, 114, 255, 0.9);
  box-shadow: 0 0 16rpx rgba(142, 114, 255, 0.52);
}

.orb-dot.direct {
  width: 8rpx;
  height: 8rpx;
}

.orb-dot.direct view {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: rgba(158, 220, 29, 0.92);
  box-shadow: 0 0 18rpx rgba(158, 220, 29, 0.62);
  transform: translate(-50%, -50%);
}

.orb-spoke {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 71rpx;
  height: 1rpx;
  background: linear-gradient(90deg, rgba(158, 220, 29, 0.2), rgba(158, 220, 29, 0));
  transform-origin: left center;
}

.orb-outer .orb-dot:nth-child(1) { transform: rotate(10deg) translateX(148rpx); }
.orb-outer .orb-dot:nth-child(2) { transform: rotate(36deg) translateX(164rpx); }
.orb-outer .orb-dot:nth-child(3) { transform: rotate(62deg) translateX(154rpx); }
.orb-outer .orb-dot:nth-child(4) { transform: rotate(88deg) translateX(170rpx); }
.orb-outer .orb-dot:nth-child(5) { transform: rotate(114deg) translateX(159rpx); }
.orb-outer .orb-dot:nth-child(6) { transform: rotate(140deg) translateX(147rpx); }
.orb-outer .orb-dot:nth-child(7) { transform: rotate(166deg) translateX(165rpx); }
.orb-outer .orb-dot:nth-child(8) { transform: rotate(192deg) translateX(155rpx); }
.orb-outer .orb-dot:nth-child(9) { transform: rotate(218deg) translateX(169rpx); }
.orb-outer .orb-dot:nth-child(10) { transform: rotate(244deg) translateX(151rpx); }
.orb-outer .orb-dot:nth-child(11) { transform: rotate(270deg) translateX(161rpx); }
.orb-outer .orb-dot:nth-child(12) { transform: rotate(296deg) translateX(146rpx); }
.orb-outer .orb-dot:nth-child(13) { transform: rotate(322deg) translateX(167rpx); }
.orb-outer .orb-dot:nth-child(14) { transform: rotate(348deg) translateX(156rpx); }

.orb-inner .orb-spoke:nth-child(1) { transform: rotate(-90deg); }
.orb-inner .orb-spoke:nth-child(2) { transform: rotate(-30deg); }
.orb-inner .orb-spoke:nth-child(3) { transform: rotate(30deg); }
.orb-inner .orb-spoke:nth-child(4) { transform: rotate(90deg); }
.orb-inner .orb-spoke:nth-child(5) { transform: rotate(150deg); }
.orb-inner .orb-spoke:nth-child(6) { transform: rotate(210deg); }
.orb-inner .orb-dot:nth-child(7) { transform: rotate(-90deg) translateX(71rpx); }
.orb-inner .orb-dot:nth-child(8) { transform: rotate(-30deg) translateX(71rpx); }
.orb-inner .orb-dot:nth-child(9) { transform: rotate(30deg) translateX(71rpx); }
.orb-inner .orb-dot:nth-child(10) { transform: rotate(90deg) translateX(71rpx); }
.orb-inner .orb-dot:nth-child(11) { transform: rotate(150deg) translateX(71rpx); }
.orb-inner .orb-dot:nth-child(12) { transform: rotate(210deg) translateX(71rpx); }
.orb-inner .orb-dot:nth-child(7) view { animation: node-grow 2.2s ease-in-out infinite; }
.orb-inner .orb-dot:nth-child(10) view { animation: node-grow 2.6s ease-in-out infinite 0.6s; }

@keyframes orb-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes orb-spin-reverse {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

@keyframes orb-breathe {
  0%, 100% { opacity: 0.75; transform: translate(-50%, -50%) scale(0.92); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
}

@keyframes node-grow {
  0%, 100% {
    opacity: 0.9;
    transform: translate(-50%, -50%) scale(1);
    box-shadow: 0 0 18rpx rgba(158, 220, 29, 0.62);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.62);
    box-shadow: 0 0 34rpx rgba(158, 220, 29, 0.95);
  }
}

.rank-top,
.invite-head,
.leader-card,
.genesis-head,
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22rpx;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 22rpx;
  letter-spacing: 1rpx;
}

.cyan { color: #46e6ff; }
.green { color: #12c979; }
.orange { color: #ff8d4a; }
.warning { color: #ffb84d; }
.brand { color: #9edc1d; }
.tech { color: #8e72ff; }
.team-icon {
  display: inline-block;
  width: 28rpx;
  height: 28rpx;
  flex-shrink: 0;
  background: currentColor;
  vertical-align: middle;
}
.icon-chevron { width: 30rpx; height: 30rpx; color: #5f6877; -webkit-mask: url("../../static/icons/wallet-chevron-right.svg") center / contain no-repeat; mask: url("../../static/icons/wallet-chevron-right.svg") center / contain no-repeat; }
.icon-arrow-up { color: #687284; -webkit-mask: url("../../static/icons/bill-arrow-up-right.svg") center / contain no-repeat; mask: url("../../static/icons/bill-arrow-up-right.svg") center / contain no-repeat; }
.icon-coins { color: #c6ff3a; -webkit-mask: url("../../static/icons/bill-coins.svg") center / contain no-repeat; mask: url("../../static/icons/bill-coins.svg") center / contain no-repeat; }
.icon-spark { -webkit-mask: url("../../static/icons/wallet-sparkles.svg") center / contain no-repeat; mask: url("../../static/icons/wallet-sparkles.svg") center / contain no-repeat; }
.icon-crown { -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a2 2 0 0 1-1.927 1.467H6.78a2 2 0 0 1-1.927-1.467L2.019 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z'/%3E%3Cpath d='M5 21h14'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a2 2 0 0 1-1.927 1.467H6.78a2 2 0 0 1-1.927-1.467L2.019 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z'/%3E%3Cpath d='M5 21h14'/%3E%3C/svg%3E") center / contain no-repeat; }
.icon-flame { width: 24rpx; height: 24rpx; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8.5 14.5A2.5 2.5 0 0 0 11 17c2 0 3-1.5 3-3.5 0-2-1-3.5-3-5.5-.8 1.4-2 2.5-3.5 3.5C6 12.5 5 14 5 16a7 7 0 0 0 14 0c0-3-1.5-5.5-4-7.5.2 1.5-.2 2.8-1.1 3.8'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8.5 14.5A2.5 2.5 0 0 0 11 17c2 0 3-1.5 3-3.5 0-2-1-3.5-3-5.5-.8 1.4-2 2.5-3.5 3.5C6 12.5 5 14 5 16a7 7 0 0 0 14 0c0-3-1.5-5.5-4-7.5.2 1.5-.2 2.8-1.1 3.8'/%3E%3C/svg%3E") center / contain no-repeat; }
.icon-trophy { -webkit-mask: url("../../static/icons/bill-award.svg") center / contain no-repeat; mask: url("../../static/icons/bill-award.svg") center / contain no-repeat; }
.icon-users { -webkit-mask: url("../../static/icons/tab-users.svg") center / contain no-repeat; mask: url("../../static/icons/tab-users.svg") center / contain no-repeat; }
.icon-zap { -webkit-mask: url("../../static/icons/tab-zap.svg") center / contain no-repeat; mask: url("../../static/icons/tab-zap.svg") center / contain no-repeat; }
.icon-send { color: #10140a; -webkit-mask: url("../../static/icons/support-send.svg") center / contain no-repeat; mask: url("../../static/icons/support-send.svg") center / contain no-repeat; }
.icon-link { color: #46e6ff; -webkit-mask: url("../../static/icons/wallet-arrow-up-from-line.svg") center / contain no-repeat; mask: url("../../static/icons/wallet-arrow-up-from-line.svg") center / contain no-repeat; }
.icon-qr { color: #ffb84d; -webkit-mask: url("../../static/icons/search.svg") center / contain no-repeat; mask: url("../../static/icons/search.svg") center / contain no-repeat; }
.icon-hash { color: #c6ff3a; -webkit-mask: url("../../static/icons/key.svg") center / contain no-repeat; mask: url("../../static/icons/key.svg") center / contain no-repeat; }
.muted {
  color: #8f98a8;
  font-size: 24rpx;
  line-height: 1.45;
}

.v-line {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 14rpx;
}

.v-badge {
  display: grid;
  min-width: 78rpx;
  height: 54rpx;
  place-items: center;
  border-radius: 18rpx;
  background: #c6ff3a;
  color: #10140a;
  font-size: 30rpx;
  font-weight: 820;
}

.v-title {
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 780;
}

.chevron {
  color: #5f6877;
  font-size: 38rpx;
}

.progress-block {
  position: relative;
  margin-top: 32rpx;
}

.progress-head,
.ledger-head,
.genesis-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #9ba6b8;
  font-size: 23rpx;
}

.progress-head b,
.progress-head text:last-child {
  color: #c6ff3a;
}

.progress-track,
.genesis-progress {
  height: 12rpx;
  margin-top: 14rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: #242a35;
}

.progress-track view,
.genesis-progress view {
  height: 100%;
  border-radius: inherit;
}

.progress-track view {
  width: 63%;
  background: linear-gradient(90deg, #46e6ff, #c6ff3a);
}

.grow-bar,
.genesis-progress view {
  transform-origin: left center;
  animation: progress-grow 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes progress-grow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

.need-line {
  margin-top: 14rpx;
  color: #8f98a8;
  font-size: 22rpx;
}

.prize-pill,
.promo-pill,
.earned-pill {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 18rpx;
  padding: 8rpx 16rpx;
  border-radius: 10rpx;
  background: rgba(198, 255, 58, 0.13);
  color: #c6ff3a;
  font-size: 21rpx;
  font-weight: 700;
}

.invite-card,
.ledger-card {
  margin-top: 24rpx;
  padding: 32rpx;
  background:
    radial-gradient(70% 80% at 0% 0%, rgba(198, 255, 58, 0.10), transparent 60%),
    radial-gradient(70% 80% at 100% 100%, rgba(70, 230, 255, 0.10), transparent 60%),
    #10141d;
}

.grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.03) 1rpx, transparent 1rpx),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1rpx, transparent 1rpx);
  background-size: 48rpx 48rpx;
}

.invite-head,
.invite-body,
.ticker,
.ledger-content {
  position: relative;
  z-index: 1;
}

.invite-head > text {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  color: #c6ff3a;
  font-size: 23rpx;
  font-weight: 650;
}

.money-emoji {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28rpx;
  height: 28rpx;
  font-size: 23rpx;
  font-style: normal;
  line-height: 1;
}

.invite-head view {
  display: flex;
  align-items: center;
  gap: 8rpx;
  color: #8f98a8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 22rpx;
}

.invite-head .live-dot {
  position: relative;
  display: inline-block;
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #12c979;
  box-shadow: 0 0 16rpx rgba(18, 201, 121, 0.7);
}

.invite-head .live-dot::after {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: #12c979;
  opacity: 0.7;
  animation: live-ping 1.6s ease-out infinite;
  content: "";
}

@keyframes live-ping {
  0% { opacity: 0.7; transform: scale(1); }
  78%, 100% { opacity: 0; transform: scale(2.55); }
}

.promo-pill {
  background: rgba(255, 141, 74, 0.13);
  color: #ff8d4a;
  font-size: 23rpx;
  font-weight: 500;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: nowrap;
}

.promo-pill text {
  display: inline-flex;
  align-items: center;
  color: currentColor;
  line-height: 1;
}

.invite-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 316rpx;
  gap: 24rpx;
  margin-top: 24rpx;
}

.reward-main {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
  color: #ffffff;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 62rpx;
  font-weight: 820;
  letter-spacing: 0;
  line-height: 1;
}

.reward-main text {
  color: #8f98a8;
  font-size: 30rpx;
}

.reward-strike {
  margin-top: 2rpx;
  color: #5f6877;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 23rpx;
  text-decoration: line-through;
}

.nex-reward {
  margin-top: 8rpx;
  color: #46e6ff;
  font-size: 27rpx;
  font-weight: 700;
}

.earned-pill {
  background: rgba(70, 230, 255, 0.12);
  color: #46e6ff;
}

.share-stack {
  display: grid;
  gap: 12rpx;
}

.share-stack button {
  display: flex;
  height: 88rpx;
  align-items: center;
  gap: 10rpx;
  margin: 0;
  padding: 0 18rpx;
  border-radius: 16rpx;
  background: #171c26;
  color: #f7f8fb;
  line-height: 1;
}

.share-stack button::after,
uni-button::after {
  border: 0;
}

.share-stack button b {
  flex-shrink: 0;
  font-size: 23rpx;
}

.share-stack button i:not(.team-icon) {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #7f8797;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 21rpx;
  font-style: normal;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-stack .share-primary {
  justify-content: center;
  border-radius: 999rpx;
  background: #c6ff3a;
  color: #10140a;
  font-size: 25rpx;
  font-weight: 720;
}

.share-stack .share-primary .team-icon {
  color: #10140a;
}

.ticker {
  display: flex;
  align-items: center;
  gap: 10rpx;
  height: 48rpx;
  margin-top: 24rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #232936;
  color: #8f98a8;
  font-size: 22rpx;
  animation: ticker-rise 280ms ease both;
}

.ticker b {
  color: #ffffff;
}

.ticker i:not(.team-icon) {
  margin-left: auto;
  color: #c6ff3a;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-style: normal;
  font-weight: 700;
}

.ticker .team-icon:first-child {
  color: #ffb84d;
}

.ticker .team-icon:last-child {
  margin-left: 4rpx;
}

@keyframes ticker-rise {
  from { opacity: 0; transform: translateY(10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

.leader-card {
  margin-top: 24rpx;
  padding: 28rpx 32rpx;
  background:
    radial-gradient(80% 60% at 80% 0%, rgba(255, 184, 77, 0.12), transparent 65%),
    #10141d;
}

.leader-icon,
.genesis-icon {
  display: grid;
  width: 80rpx;
  height: 80rpx;
  flex-shrink: 0;
  place-items: center;
  border-radius: 24rpx;
  background: rgba(255, 184, 77, 0.15);
  color: #ffb84d;
  font-size: 36rpx;
}

.leader-icon .team-icon,
.genesis-icon .team-icon {
  width: 38rpx;
  height: 38rpx;
}

.leader-card view text,
.genesis-head view text {
  display: block;
  margin-top: 4rpx;
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 720;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 24rpx;
}

.quick-card,
.small-card {
  padding: 26rpx;
}

.quick-top {
  display: flex;
  justify-content: space-between;
  color: #687284;
  font-size: 27rpx;
}

.quick-num {
  margin-top: 24rpx;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 760;
  letter-spacing: 0;
  line-height: 1;
}

.quick-title {
  margin-top: 10rpx;
  color: #aeb7c8;
  font-size: 22rpx;
  line-height: 1.25;
}

.quick-meta {
  margin-top: 9rpx;
  color: #9ba3b5;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 21rpx;
  line-height: 1.28;
}

.aurora {
  position: absolute;
  inset: -20%;
  opacity: 0.85;
  background:
    radial-gradient(40% 50% at 80% 20%, rgba(70, 230, 255, 0.16), transparent 60%),
    radial-gradient(40% 50% at 10% 80%, rgba(198, 255, 58, 0.16), transparent 60%),
    radial-gradient(35% 45% at 70% 90%, rgba(255, 184, 77, 0.15), transparent 60%);
  filter: blur(16rpx);
}

.float-dots text {
  position: absolute;
  bottom: 30rpx;
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: #46e6ff;
  opacity: 0;
  animation: dot-rise 8s linear infinite;
}

.float-dots text:nth-child(1) { left: 8%; animation-delay: 0s; }
.float-dots text:nth-child(2) { left: 28%; background: #c6ff3a; animation-delay: 1.4s; }
.float-dots text:nth-child(3) { left: 52%; animation-delay: 3.2s; }
.float-dots text:nth-child(4) { left: 72%; background: #12c979; animation-delay: 5s; }
.float-dots text:nth-child(5) { left: 90%; background: #ff8d4a; animation-delay: 6.6s; }

@keyframes dot-rise {
  0% { opacity: 0; transform: translateY(0) scale(0.72); }
  14% { opacity: 0.8; }
  70% { opacity: 0.62; }
  100% { opacity: 0; transform: translateY(-300rpx) scale(1.08); }
}

.ledger-head text,
.ledger-head button {
  color: #7f8797;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 22rpx;
  letter-spacing: 1rpx;
  text-transform: uppercase;
}

.ledger-head button {
  margin: 0;
  padding: 0;
  background: transparent;
  line-height: 1;
  text-transform: none;
}

.ledger-money {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  margin-top: 18rpx;
  color: #c6ff3a;
  font-size: 92rpx;
  font-weight: 760;
  letter-spacing: 0;
  line-height: 1;
}

.ledger-money text:first-child {
  color: #8f98a8;
  font-size: 30rpx;
}

.ledger-money text:nth-child(2) {
  color: #8f98a8;
  font-size: 52rpx;
}

.ledger-money i {
  color: #c6ff3a;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 24rpx;
  font-style: normal;
}

.ledger-sub {
  margin-top: 12rpx;
  color: #8f98a8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 23rpx;
}

.ledger-sub b {
  color: #12c979;
}

.split-bar {
  display: flex;
  height: 12rpx;
  margin-top: 28rpx;
  overflow: hidden;
  border-radius: 6rpx;
  background: #242a35;
}

.split-bar .direct {
  width: 38%;
  background: #c6ff3a;
}

.split-bar .extended {
  flex: 1;
  background: #ff8d4a;
}

.split-grid,
.settle-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 28rpx;
  margin-top: 20rpx;
}

.split-grid text,
.settle-grid text {
  color: #8f98a8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 22rpx;
}

.split-grid b,
.settle-grid b {
  display: block;
  margin-top: 8rpx;
  color: #ffffff;
  font-size: 30rpx;
}

.settle-grid {
  padding-top: 24rpx;
  border-top: 1rpx dashed #303746;
  text-align: center;
}

.settle-grid view:first-child b {
  color: #12c979;
}

.settle-grid view:last-child b {
  color: #ff8d4a;
}

.composition-card,
.genesis-card {
  margin-top: 24rpx;
  padding: 32rpx;
}

.card-head text:first-child {
  color: #8f98a8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 22rpx;
}

.comp-row {
  display: grid;
  grid-template-columns: 150rpx minmax(0, 1fr) 52rpx;
  gap: 16rpx;
  align-items: center;
  margin-top: 24rpx;
  font-size: 23rpx;
}

.comp-row > view {
  height: 16rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: #242a35;
}

.comp-row i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(198, 255, 58, 0.7), #c6ff3a);
}

.comp-row:nth-child(3) i {
  background: linear-gradient(90deg, rgba(70, 230, 255, 0.7), #46e6ff);
}

.comp-row b {
  color: #ffffff;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  text-align: right;
}

.genesis-card {
  background:
    radial-gradient(80% 60% at 80% 0%, rgba(255, 141, 74, 0.13), transparent 65%),
    #10141d;
}

.genesis-meta {
  margin-top: 24rpx;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.genesis-meta text:last-child {
  color: #ffb84d;
}

.genesis-progress view {
  width: 85%;
  background: linear-gradient(90deg, #ff8d4a, #ffb84d);
}

.two-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin-top: 24rpx;
}

.small-card b {
  display: block;
  margin-top: 20rpx;
  color: #ffffff;
  font-size: 27rpx;
  line-height: 1.25;
}

.small-card > text {
  display: block;
  margin-top: 10rpx;
  color: #8f98a8;
  font-size: 22rpx;
  line-height: 1.35;
}

.orbit-dot {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #c6ff3a 0%, #46e6ff 70%, transparent 100%);
}
</style>
