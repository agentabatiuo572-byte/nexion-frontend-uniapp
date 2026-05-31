<script setup lang="ts">
import { computed } from 'vue'
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

const vRank = computed(() => auth.session?.vRank || 'V0')
const referralCode = computed(() => auth.session?.referralCode || 'NX279740')
const copy = computed(() => getMainPageMessages(locale.value))
const t = computed(() => copy.value.team)
const common = computed(() => copy.value.common)
const isZh = computed(() => locale.value === 'zh')

const pageCopy = computed(() => {
  const zh = isZh.value
  return {
    yourRank: zh ? '你的等级' : 'Your rank',
    directBonus: zh ? '直推奖' : 'Direct bonus',
    extendedRoyalty: zh ? '扩展网络版税' : 'Extended royalty',
    next: zh ? '下一阶' : 'Next',
    need: zh ? '还差' : 'Need',
    prize: zh ? '奖品' : 'Prize',
    nextRank: zh ? 'V1 Pilot' : 'V1 Pilot',
    missing: zh ? '$299 自购 · 1 个直推' : '$299 self-buy · 1 direct',
    inviteEarn: zh ? '邀请好友赚钱' : 'Earn for each friend',
    earnedToday: zh ? '今日 6 笔收益' : '6 earned today',
    promo: zh ? '限时 · 本周邀请奖励 2×' : 'Limited time bonus 2x',
    perFriend: zh ? '每位合格好友最高价值' : 'Per qualified friend',
    beFirst: zh ? '成为第一个收益用户' : 'Be the first',
    poster: zh ? '海报' : 'Poster',
    posterValue: zh ? '二维码 + 图' : 'QR + image',
    code: zh ? '邀请码' : 'Code',
    link: zh ? '链接' : 'Link',
    share: zh ? '分享赚' : 'Share & earn',
    tickerName: 'Sarah K.',
    tickerAction: zh ? '刚加入你的网络' : 'just joined your network',
    leaderboardTitle: zh ? '全球邀请榜' : 'Global leaderboard',
    leaderboardSubtitle: zh ? '你排第 248 名 · 再升 5 名解锁钻石等级' : 'Rank #248 · climb 5 spots to unlock Diamond',
    sevenLayer: zh ? '版税网络' : 'Royalty network',
    direct: zh ? '直推' : 'Direct',
    extended: zh ? '扩展' : 'Extended',
    todayMatch: zh ? '今日对碰' : 'Today match',
    weeklyPool: zh ? '周领导池' : 'Weekly pool',
    votes: zh ? '票' : 'votes',
    thisMonth: zh ? '本月' : 'This month',
    viewDetails: zh ? '查看明细' : 'View details',
    lifetime: zh ? '累计' : 'Lifetime',
    settled: zh ? '已结算' : 'Settled',
    coolingDown: zh ? '冷却中' : 'Cooling down',
    contributors: zh ? '贡献者' : 'contributors',
    composition: zh ? '影响力网络构成' : 'Influence network composition',
    genesisLabel: 'Genesis',
    genesisHeadline: zh ? '永久版税 · V5 直通' : 'Lifetime royalty · V5 fast-track',
    genesisPrice: zh ? '$999 起 · 0.1% 平台分红' : 'From $999 · 0.1% platform dividend',
    genesisLeft: zh ? '仅剩 148 席' : '148 left',
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

function comingSoon(label: string) {
  uni.showToast({ title: isZh.value ? `${label} 后续接入` : `${label} will be connected next`, icon: 'none' })
}
</script>

<template>
  <AppShell :title="t.title" version="" active-tab="team">
    <scroll-view class="page" scroll-y>
      <view class="rank-card" @click="comingSoon(pageCopy.yourRank)">
        <view class="orb-layer">
          <view class="orb-ring one" />
          <view class="orb-ring two" />
          <view class="orb-node n1" />
          <view class="orb-node n2" />
          <view class="orb-node n3" />
        </view>
        <view class="rank-top">
          <view>
            <view class="mono cyan">{{ pageCopy.yourRank }}</view>
            <view class="v-line">
              <view class="v-badge">{{ vRank }}</view>
              <view class="v-title">{{ common.rankCadet }}</view>
            </view>
            <view class="muted">{{ pageCopy.directBonus }} 5% · {{ pageCopy.extendedRoyalty }}</view>
          </view>
          <text class="chevron">›</text>
        </view>
        <view class="progress-block">
          <view class="progress-head">
            <text>{{ pageCopy.next }} <b>{{ pageCopy.nextRank }}</b></text>
            <text>18%</text>
          </view>
          <view class="progress-track"><view /></view>
          <view class="need-line">{{ pageCopy.need }} {{ pageCopy.missing }}</view>
          <view class="prize-pill">{{ pageCopy.prize }} · Apple Watch SE</view>
        </view>
      </view>

      <view class="invite-card">
        <view class="grid-overlay" />
        <view class="invite-head">
          <text>💰 {{ pageCopy.inviteEarn }}</text>
          <view><i />{{ pageCopy.earnedToday }}</view>
        </view>
        <view class="promo-pill">🔥 {{ pageCopy.promo }}</view>
        <view class="invite-body">
          <view class="invite-stats">
            <view class="reward-main"><text>$</text>400</view>
            <view class="reward-strike">$200</view>
            <view class="nex-reward">+ 400 NEX</view>
            <view class="muted">{{ pageCopy.perFriend }}</view>
            <view class="earned-pill">◆ {{ pageCopy.beFirst }}</view>
          </view>
          <view class="share-stack">
            <button @click="comingSoon(pageCopy.poster)"><text>▦</text><b>{{ pageCopy.poster }}</b><i>{{ pageCopy.posterValue }}</i></button>
            <button @click="comingSoon(pageCopy.code)"><text>#</text><b>{{ pageCopy.code }}</b><i>{{ referralCode }}</i></button>
            <button @click="comingSoon(pageCopy.link)"><text>↗</text><b>{{ pageCopy.link }}</b><i>nexion.ai/ref/…</i></button>
            <button class="share-primary" @click="comingSoon(pageCopy.share)">↗ {{ pageCopy.share }} <b>$400</b></button>
          </view>
        </view>
        <view class="ticker">
          <text>⚡</text>
          <b>{{ pageCopy.tickerName }}</b>
          <text>{{ pageCopy.tickerAction }}</text>
          <i>+$45.20</i>
        </view>
      </view>

      <view class="leader-card" @click="comingSoon(pageCopy.leaderboardTitle)">
        <view class="leader-icon">🏆</view>
        <view>
          <view class="mono warning">{{ pageCopy.leaderboardTitle }}</view>
          <text>{{ pageCopy.leaderboardSubtitle }}</text>
        </view>
        <text class="chevron">›</text>
      </view>

      <view class="quick-grid">
        <view class="quick-card" @click="comingSoon(pageCopy.sevenLayer)">
          <view class="quick-top"><text class="green">◉</text><text>↗</text></view>
          <view class="quick-num">47</view>
          <view class="quick-title">{{ pageCopy.sevenLayer }}</view>
          <view class="quick-meta">{{ pageCopy.direct }} · 12</view>
          <view class="quick-meta">{{ pageCopy.extended }} · 35</view>
        </view>
        <view class="quick-card" @click="comingSoon(pageCopy.todayMatch)">
          <view class="quick-top"><text class="orange">ϟ</text><text>↗</text></view>
          <view class="quick-num orange">+$128.40</view>
          <view class="quick-title">{{ pageCopy.todayMatch }}</view>
          <view class="quick-meta">A · $18,420</view>
          <view class="quick-meta">B · $12,880</view>
        </view>
        <view class="quick-card" @click="comingSoon(pageCopy.weeklyPool)">
          <view class="quick-top"><text class="cyan">♛</text><text>↗</text></view>
          <view class="quick-num">$0.00</view>
          <view class="quick-title">{{ pageCopy.weeklyPool }}</view>
          <view class="quick-meta">0 {{ pageCopy.votes }}</view>
          <view class="quick-meta">0.00%</view>
        </view>
      </view>

      <view class="ledger-card" @click="comingSoon(pageCopy.viewDetails)">
        <view class="grid-overlay" />
        <view class="aurora" />
        <view class="float-dots">
          <text v-for="i in 5" :key="i" />
        </view>
        <view class="ledger-content">
          <view class="ledger-head">
            <text>{{ pageCopy.thisMonth }}</text>
            <button>{{ pageCopy.viewDetails }} ›</button>
          </view>
          <view class="ledger-money"><text>$</text>312<text>.80</text><i>+ 1,840 NEX</i></view>
          <view class="ledger-sub">{{ pageCopy.lifetime }} $2,948.20 · 47 {{ pageCopy.contributors }} · <b>↑ +12.4%</b></view>
          <view class="split-bar"><view class="direct" /><view class="extended" /></view>
          <view class="split-grid">
            <view>
              <text class="green">{{ pageCopy.direct }} · 38%</text>
              <b>$118.86</b>
            </view>
            <view>
              <text class="orange">{{ pageCopy.extended }} · 62%</text>
              <b>$193.94</b>
            </view>
          </view>
          <view class="settle-grid">
            <view><text>{{ pageCopy.settled }}</text><b>$186.30</b></view>
            <view><text>{{ pageCopy.coolingDown }}</text><b>$126.50</b></view>
          </view>
        </view>
      </view>

      <view class="composition-card" @click="comingSoon(pageCopy.composition)">
        <view class="card-head">
          <text>{{ pageCopy.composition }}</text>
          <text>›</text>
        </view>
        <view class="comp-row">
          <text class="green">{{ pageCopy.direct }}</text>
          <view><i style="width: 26%" /></view>
          <b>12</b>
        </view>
        <view class="comp-row">
          <text class="cyan">{{ pageCopy.extended }}</text>
          <view><i style="width: 74%" /></view>
          <b>35</b>
        </view>
      </view>

      <view class="genesis-card" @click="comingSoon(pageCopy.genesisLabel)">
        <view class="genesis-head">
          <view class="genesis-icon">♛</view>
          <view>
            <view class="mono orange">{{ pageCopy.genesisLabel }}</view>
            <text>{{ pageCopy.genesisHeadline }}</text>
          </view>
          <text class="chevron">›</text>
        </view>
        <view class="genesis-meta">
          <text>{{ pageCopy.genesisPrice }}</text>
          <text>{{ pageCopy.genesisLeft }}</text>
        </view>
        <view class="genesis-progress"><view /></view>
      </view>

      <view class="two-grid">
        <view class="small-card" @click="comingSoon(pageCopy.hardwareQuota)">
          <view class="quick-top"><text class="orange">ϟ</text><text>↗</text></view>
          <b>{{ pageCopy.hardwareQuota }}</b>
          <text>{{ pageCopy.quotaSubtitle }}</text>
        </view>
        <view class="small-card" @click="comingSoon(pageCopy.ambassador)">
          <view class="quick-top"><text class="warning">♛</text><text>↗</text></view>
          <b>{{ pageCopy.ambassador }}</b>
          <text>{{ pageCopy.ambassadorSubtitle }}</text>
        </view>
      </view>

      <view class="two-grid">
        <view class="small-card" @click="comingSoon(pageCopy.influenceNetwork)">
          <view class="orbit-dot" />
          <b>{{ pageCopy.influenceNetwork }}</b>
          <text>{{ pageCopy.orbitLiveMap }}</text>
        </view>
        <view class="small-card" @click="comingSoon(pageCopy.genealogy)">
          <view class="quick-top"><text class="green">☷</text><text>↗</text></view>
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
  inset: 0;
  opacity: 0.34;
  pointer-events: none;
}

.orb-ring {
  position: absolute;
  border: 1rpx solid rgba(70, 230, 255, 0.35);
  border-radius: 50%;
}

.orb-ring.one {
  top: 28rpx;
  right: 42rpx;
  width: 170rpx;
  height: 170rpx;
}

.orb-ring.two {
  top: 58rpx;
  right: 72rpx;
  width: 110rpx;
  height: 110rpx;
  border-color: rgba(198, 255, 58, 0.26);
}

.orb-node {
  position: absolute;
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #c6ff3a;
  box-shadow: 0 0 18rpx rgba(198, 255, 58, 0.8);
}

.orb-node.n1 { top: 52rpx; right: 168rpx; }
.orb-node.n2 { top: 132rpx; right: 76rpx; background: #46e6ff; }
.orb-node.n3 { top: 178rpx; right: 188rpx; }

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

.progress-track view {
  width: 18%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #46e6ff, #c6ff3a);
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
  color: #c6ff3a;
  font-size: 23rpx;
  font-weight: 650;
}

.invite-head view {
  display: flex;
  align-items: center;
  gap: 8rpx;
  color: #8f98a8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 22rpx;
}

.invite-head i {
  position: relative;
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #12c979;
  box-shadow: 0 0 16rpx rgba(18, 201, 121, 0.7);
}

.promo-pill {
  background: rgba(255, 141, 74, 0.13);
  color: #ff8d4a;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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

.share-stack button text {
  color: #c6ff3a;
  font-size: 25rpx;
}

.share-stack button b {
  flex-shrink: 0;
  font-size: 23rpx;
}

.share-stack button i {
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
}

.ticker b {
  color: #ffffff;
}

.ticker i {
  margin-left: auto;
  color: #c6ff3a;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-style: normal;
  font-weight: 700;
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
  color: #7f8797;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 21rpx;
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
  height: 100%;
  border-radius: inherit;
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
