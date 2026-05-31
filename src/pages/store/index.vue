<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '@/components/AppShell.vue'
import { requireAuth } from '@/utils/auth-guard'
import { getMainPageMessages, useActiveLocale } from '@/utils/i18n'

onShow(() => {
  requireAuth()
})

const tickerIndex = ref(0)
const locale = useActiveLocale()
const copy = computed(() => getMainPageMessages(locale.value))
const t = computed(() => copy.value.store)
const v = computed(() => t.value.v5)
const common = computed(() => copy.value.common)

const tiers = computed(() => [
  { label: 'Rack P1', y: '$142.60', width: 100, hot: true },
  { label: 'Box Pro', y: '$76.00', width: 53 },
  { label: 'Box S1', y: '$38.50', width: 27 },
  { label: 'Share', y: '$0.07', width: 2 },
  { label: v.value.phone, y: '$0.06', width: 1, you: true }
])

const purchases = [
  { who: 'Maya', co: 'ID', prod: 'NexionBox S1', t: '3m', color: '#c68316' },
  { who: 'cypher.eth', co: 'US', prod: 'NexionRack P1', t: '7m', color: '#0833b8' },
  { who: 'Hideo', co: 'JP', prod: 'NexionBox Pro', t: '12m', color: '#0e8e4a' }
]

const products = computed(() => [
  {
    id: 'stellarbox-s1',
    name: 'NexionBox S1',
    tier: v.value.tierEntry,
    badge: v.value.bestSeller,
    tagline: v.value.personalBox,
    photo: '/src/static/products/nexionbox-s1-v4.png',
    daily: '$38.50',
    nex: '+65 NEX/d',
    price: '$1,299',
    annual: '108%',
    payback: '34d',
    sold: '4,821',
    stock: 47,
    specs: ['4x RTX 4090', '96GB VRAM', '320 img/min', '12.4k tok/s'],
    featured: true
  },
  {
    id: 'stellarbox-pro',
    name: 'NexionBox Pro',
    tier: v.value.tierPro,
    badge: v.value.trending,
    tagline: v.value.proBox,
    photo: '/src/static/products/nexionbox-pro-v2.png',
    daily: '$76.00',
    nex: '+215 NEX/d',
    price: '$2,399',
    annual: '116%',
    payback: '32d',
    sold: '1,842',
    stock: 23,
    specs: ['8x RTX 4090', '192GB VRAM', '720 img/min', '38k tok/s']
  },
  {
    id: 'stellarrack-p1',
    name: 'NexionRack P1',
    tier: v.value.tierFlagship,
    badge: v.value.flagship,
    tagline: v.value.rackBox,
    photo: '/src/static/products/nexionrack-p1-v2.png',
    daily: '$142.60',
    nex: '+950 NEX/d',
    price: '$8,999',
    annual: '58%',
    payback: '63d',
    sold: '287',
    stock: 8,
    specs: ['8x A100', '640GB VRAM', '1800 img/min', '128k tok/s']
  },
  {
    id: 'cloud-share',
    name: 'Cloud Share',
    tier: v.value.tierShare,
    badge: v.value.lowBarrier,
    tagline: v.value.cloudShareLine,
    photo: '',
    daily: '$0.073',
    nex: '+30 NEX/d',
    price: '$199',
    annual: '13%',
    payback: 'stake',
    sold: '12,483',
    stock: null,
    specs: [v.value.cloudInstant, v.value.cloudDistributed, v.value.cloudYield, v.value.cloudRedeem],
    isShare: true
  }
])

const featuredProducts = computed(() => products.value.filter((p) => p.featured))
const restProducts = computed(() => products.value.filter((p) => !p.featured))

const lockedProducts = computed(() => [
  { name: 'NexionBox Pro v2', phase: 'P3', line: v.value.newSilicon },
  { name: 'NexionRack P2', phase: 'P5', line: v.value.trainingUnlock }
])

let tickerTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  tickerTimer = setInterval(() => {
    tickerIndex.value = (tickerIndex.value + 1) % purchases.length
  }, 3400)
})

onUnmounted(() => {
  if (tickerTimer) clearInterval(tickerTimer)
})

function showSoon(label: string) {
  uni.showToast({ title: common.value.comingSoon(label), icon: 'none' })
}
</script>

<template>
  <AppShell :title="t.title" version="" active-tab="store">
    <scroll-view class="page" scroll-y>
      <view class="store-stack">
        <view class="store-hero card">
          <view class="hero-bg" />
          <view class="hero-copy">
            <text>{{ v.heroKicker }}</text>
            <view>{{ v.heroTitlePrefix }} <b>{{ v.heroTitleHighlight }}</b> {{ v.heroTitleSuffix }}</view>
            <p>{{ v.heroSub }}</p>
          </view>
          <view class="hero-art">
            <view class="bar phone" />
            <view class="bar mid" />
            <view class="bar top" />
            <text>✦</text>
          </view>
        </view>

        <view class="section-title">
          <b>{{ v.networkLadder }}</b>
          <text>{{ v.fiveTiers }}</text>
        </view>
        <view class="ladder card">
          <view v-for="tier in tiers" :key="tier.label" class="tier-row" :class="{ you: tier.you }">
            <text>{{ tier.label }}<i v-if="tier.you">←{{ v.you }}</i></text>
            <view class="tier-track"><view :style="{ width: `${tier.width}%` }" /></view>
            <b>{{ tier.y }}<i>/d</i></b>
          </view>
        </view>

        <view class="vs-card card">
          <view>
            <text>{{ v.yourPhone }}</text>
            <b>$0.06<i>/d</i></b>
            <em>+12 NEX/d</em>
          </view>
          <view class="vs-mid">
            <span>→</span>
            <i>{{ v.more640 }}</i>
          </view>
          <view class="right">
            <text>NexionBox S1</text>
            <b>$38.50<i>/d</i></b>
            <em>+65 NEX/d</em>
          </view>
        </view>

        <view class="trade-card card">
          <view class="trade-icon">↻</view>
          <view>
            <b>{{ v.tradeWindow }}</b>
            <text>{{ v.tradeWindowBody }}</text>
          </view>
          <i>{{ v.phaseLive }}</i>
        </view>

        <view class="section-title">
          <b>{{ v.recommended }}</b>
          <text class="chip">{{ t.popular }}</text>
        </view>
        <view v-for="product in featuredProducts" :key="product.id" class="product-card card featured" @click="showSoon(product.name)">
          <view class="product-photo">
            <image v-if="product.photo" :src="product.photo" mode="aspectFill" />
            <view v-else class="cloud-art">CPU</view>
            <view class="ribbon">{{ product.badge }}</view>
            <view class="tier-chip">{{ product.tier }}</view>
          </view>
          <view class="product-body">
            <view class="product-head">
              <view>
                <b>{{ product.name }}</b>
                <text>{{ product.tagline }}</text>
              </view>
              <view class="daily">{{ product.daily }}<text>/d</text></view>
            </view>
            <view class="roi-grid">
              <view><text>{{ v.youEarn }}</text><b>{{ product.daily }}</b><i>{{ product.nex }}</i></view>
              <view><text>{{ v.yearRoi }}</text><b>{{ product.annual }}</b><i>{{ v.annualPayback.replace('{annual}', product.annual).replace('{payback}', product.payback) }}</i></view>
            </view>
            <view class="spec-row">
              <text v-for="spec in product.specs" :key="spec">{{ spec }}</text>
            </view>
            <view v-if="product.stock" class="stock-strip">
              <i>🔥</i>
              <view>
                <b>{{ v.unitsLeft.replace('{n}', String(product.stock)) }}</b>
                <view><span :style="{ width: `${Math.min(100, product.stock * 2)}%` }" /></view>
              </view>
            </view>
          </view>
          <view class="product-footer">
            <view>
              <text>{{ v.price }}</text>
              <b>{{ product.price }}</b>
              <i>{{ v.annualPayback.replace('{annual}', product.annual).replace('{payback}', product.payback) }}</i>
            </view>
            <button @click.stop="showSoon('Checkout')">{{ v.buyNow }} <text>›</text></button>
          </view>
        </view>

        <view class="purchase-ticker card">
          <view class="avatar" :style="{ background: purchases[tickerIndex].color }">{{ purchases[tickerIndex].who[0] }}</view>
          <view>
            <b>{{ purchases[tickerIndex].who }} · {{ purchases[tickerIndex].co }}</b>
            <text>{{ v.bought }} {{ purchases[tickerIndex].prod }}</text>
          </view>
          <i>{{ purchases[tickerIndex].t }} {{ v.ago }}</i>
        </view>

        <view class="section-title">
          <b>{{ v.moreTiers }}</b>
        </view>
        <view v-for="product in restProducts" :key="product.id" class="product-card card" @click="showSoon(product.name)">
          <view class="product-photo">
            <image v-if="product.photo" :src="product.photo" mode="aspectFill" />
            <view v-else class="cloud-art">CPU</view>
            <view class="ribbon">{{ product.badge }}</view>
            <view class="tier-chip">{{ product.tier }}</view>
          </view>
          <view class="product-body">
            <view class="product-head">
              <view>
                <b>{{ product.name }}</b>
                <text>{{ product.tagline }}</text>
              </view>
              <view class="daily">{{ product.daily }}<text>/d</text></view>
            </view>
            <view class="roi-grid">
              <view><text>{{ v.youEarn }}</text><b>{{ product.daily }}</b><i>{{ product.nex }}</i></view>
              <view><text>{{ v.liveCount }}</text><b>{{ product.sold }}</b><i>{{ v.operators }}</i></view>
            </view>
            <view class="spec-row">
              <text v-for="spec in product.specs" :key="spec">{{ spec }}</text>
            </view>
            <view v-if="product.stock" class="stock-strip">
              <i>🔥</i>
              <view>
                <b>{{ v.unitsLeft.replace('{n}', String(product.stock)) }}</b>
                <view><span :style="{ width: `${Math.min(100, product.stock * 2)}%` }" /></view>
              </view>
            </view>
          </view>
          <view class="product-footer">
            <view>
              <text>{{ product.isShare ? v.from : v.price }}</text>
              <b>{{ product.price }}</b>
              <i>{{ product.isShare ? v.oneTimeStake : v.annualPayback.replace('{annual}', product.annual).replace('{payback}', product.payback) }}</i>
            </view>
            <button @click.stop="showSoon('Checkout')">{{ product.isShare ? v.stake : v.buyNow }} <text>›</text></button>
          </view>
        </view>

        <view class="section-title">
          <b>{{ v.comingSoon }}</b>
          <text>{{ v.nextPhases }}</text>
        </view>
        <view class="locked-list">
          <view v-for="item in lockedProducts" :key="item.name" class="locked-card card">
            <view class="lock-icon">⌁</view>
            <view>
              <b>{{ item.name }}</b>
              <text>{{ item.line }}</text>
            </view>
            <i>{{ item.phase }}</i>
          </view>
        </view>

        <button class="orders-entry" @click="showSoon(v.orders)">▣ {{ v.orders }}</button>
        <view class="footer-note">{{ v.footerNote }}</view>
      </view>
    </scroll-view>
  </AppShell>
</template>

<style scoped>
.page { height: 100vh; }
.store-stack { padding-bottom: 180rpx; color: #f7f9fc; }
.card { border: 1rpx solid rgba(255,255,255,.08); border-radius: 32rpx; background: #10141d; box-sizing: border-box; }
.store-hero { position: relative; display: grid; grid-template-columns: 1fr 200rpx; gap: 24rpx; align-items: center; overflow: hidden; margin-top: 24rpx; padding: 38rpx; }
.hero-bg { position: absolute; inset: -20%; background: radial-gradient(circle at 80% 20%, rgba(88,231,255,.16), transparent 44%), radial-gradient(circle at 8% 80%, rgba(198,255,58,.14), transparent 48%), radial-gradient(circle at 70% 90%, rgba(255,203,148,.14), transparent 48%); filter: blur(14rpx); animation: drift 14s ease-in-out infinite alternate; }
.hero-copy { position: relative; z-index: 1; }
.hero-copy text { color: #ff9b62; font-size: 23rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.hero-copy view { margin-top: 12rpx; color: #fff; font-size: 50rpx; font-weight: 760; line-height: 1.1; }
.hero-copy b { color: #ff9b62; }
.hero-copy p { margin: 16rpx 0 0; color: #99a3b3; font-size: 25rpx; line-height: 1.45; }
.hero-art { position: relative; z-index: 1; height: 220rpx; }
.bar { position: absolute; bottom: 20rpx; width: 48rpx; border-radius: 8rpx; }
.bar.phone { left: 8rpx; height: 44rpx; background: #242a35; border: 1rpx solid #303746; }
.bar.mid { left: 64rpx; height: 84rpx; background: rgba(88,231,255,.22); }
.bar.top { left: 120rpx; height: 140rpx; background: #9b89e0; }
.hero-art text { position: absolute; right: 12rpx; top: 26rpx; color: #ff9b62; animation: pulse 2.2s ease-in-out infinite; }
.section-title { display: flex; justify-content: space-between; align-items: center; margin: 42rpx 4rpx 18rpx; }
.section-title b { color: #fff; font-size: 30rpx; }
.section-title text { color: #8f98a8; font-size: 22rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.section-title .chip { padding: 4rpx 14rpx; border: 1rpx solid rgba(255,155,98,.36); border-radius: 8rpx; background: rgba(255,155,98,.12); color: #ff9b62; }
.ladder { padding: 24rpx 28rpx; }
.tier-row { display: grid; grid-template-columns: 150rpx 1fr 128rpx; align-items: center; gap: 20rpx; padding: 9rpx 0; }
.tier-row text { color: #fff; font-size: 25rpx; font-weight: 600; }
.tier-row text i { margin-left: 8rpx; color: #ff9b62; font-style: normal; font-size: 19rpx; }
.tier-row.you text, .tier-row.you b { color: #ff9b62; }
.tier-track { height: 10rpx; overflow: hidden; border-radius: 999rpx; background: #242a35; }
.tier-track view { height: 100%; border-radius: inherit; background: rgba(198,255,58,.7); }
.tier-row b { color: #fff; font-size: 25rpx; text-align: right; }
.tier-row b i { color: #8f98a8; font-style: normal; font-size: 20rpx; }
.vs-card { display: grid; grid-template-columns: 1fr auto 1fr; gap: 20rpx; align-items: center; margin-top: 24rpx; padding: 28rpx 32rpx; background: radial-gradient(circle at 90% 50%, rgba(198,255,58,.14), transparent 46%), radial-gradient(circle at 10% 50%, rgba(255,155,98,.14), transparent 46%), #10141d; }
.vs-card text { display: block; color: #8f98a8; font-size: 23rpx; }
.vs-card b { display: block; margin-top: 8rpx; color: #fff; font-size: 40rpx; }
.vs-card b i { color: #8f98a8; font-size: 24rpx; font-style: normal; }
.vs-card em { display: block; margin-top: 8rpx; color: #c6ff3a; font-style: normal; font-size: 22rpx; }
.vs-mid { display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.vs-mid span { color: #ff9b62; font-size: 30rpx; }
.vs-mid i { padding: 8rpx 18rpx; border-radius: 999rpx; background: #ff9b62; color: #180b05; font-style: normal; font-size: 23rpx; font-weight: 700; white-space: nowrap; }
.right { text-align: right; }
.trade-card, .purchase-ticker, .locked-card { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 18rpx; margin-top: 24rpx; padding: 24rpx 28rpx; }
.trade-icon, .lock-icon { display: grid; width: 58rpx; height: 58rpx; place-items: center; border-radius: 18rpx; background: rgba(198,255,58,.12); color: #c6ff3a; font-size: 30rpx; }
.trade-card b, .locked-card b { display: block; color: #fff; font-size: 26rpx; }
.trade-card text, .locked-card text { display: block; margin-top: 6rpx; color: #99a3b3; font-size: 22rpx; line-height: 1.35; }
.trade-card i, .locked-card i { color: #ff9b62; font-style: normal; font-size: 21rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
.product-card { overflow: hidden; margin-top: 20rpx; }
.product-card.featured { box-shadow: 0 30rpx 90rpx rgba(0,0,0,.28); }
.product-photo { position: relative; height: 360rpx; overflow: hidden; background: linear-gradient(135deg,#101216,#050608); }
.product-photo image { width: 100%; height: 100%; }
.cloud-art { display: grid; height: 100%; place-items: center; color: #58e7ff; font-size: 54rpx; background: repeating-linear-gradient(135deg, rgba(88,231,255,.08) 0 16rpx, transparent 16rpx 36rpx), linear-gradient(135deg, rgba(88,231,255,.18), #10141d); }
.product-photo::after { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 76%, #10141d 100%); content: ""; }
.ribbon { position: absolute; top: 0; left: 32rpx; z-index: 2; padding: 6rpx 20rpx 8rpx; border-radius: 0 0 12rpx 12rpx; background: #c6ff3a; color: #10140a; font-size: 21rpx; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.tier-chip { position: absolute; left: 28rpx; bottom: 24rpx; z-index: 2; padding: 10rpx 18rpx; border: 1rpx solid rgba(198,255,58,.32); border-radius: 8rpx; background: rgba(0,0,0,.55); color: rgba(255,255,255,.88); font-size: 21rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 3rpx; }
.product-body { padding: 28rpx 32rpx; }
.product-head { display: flex; justify-content: space-between; gap: 20rpx; }
.product-head b { display: block; color: #fff; font-size: 32rpx; }
.product-head text { display: block; margin-top: 8rpx; color: #99a3b3; font-size: 23rpx; line-height: 1.35; }
.daily { color: #12c979; font-size: 38rpx; font-weight: 760; text-align: right; white-space: nowrap; }
.daily text { display: inline; color: #8f98a8; font-size: 22rpx; }
.roi-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 16rpx; margin-top: 24rpx; }
.roi-grid view { padding: 18rpx; border-radius: 20rpx; background: rgba(255,255,255,.05); }
.roi-grid text { display: block; color: #8f98a8; font-size: 21rpx; }
.roi-grid b { display: block; margin-top: 8rpx; color: #fff; font-size: 31rpx; }
.roi-grid i { display: block; margin-top: 6rpx; color: #12c979; font-style: normal; font-size: 21rpx; }
.spec-row { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 22rpx; }
.spec-row text { padding: 10rpx 16rpx; border-radius: 14rpx; background: #161b25; color: #d7dce6; font-size: 21rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.stock-strip { display: grid; grid-template-columns: auto 1fr; gap: 18rpx; align-items: center; margin-top: 22rpx; padding: 20rpx 22rpx; border-radius: 20rpx; background: rgba(255,155,98,.12); }
.stock-strip > i { display: grid; width: 44rpx; height: 44rpx; place-items: center; border-radius: 12rpx; background: #ff9b62; font-style: normal; }
.stock-strip b { color: #ff9b62; font-size: 23rpx; }
.stock-strip view view { height: 6rpx; margin-top: 12rpx; overflow: hidden; border-radius: 999rpx; background: rgba(255,155,98,.16); }
.stock-strip span { display: block; height: 100%; background: #ff9b62; }
.product-footer { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 20rpx; padding: 26rpx 32rpx; border-top: 1rpx solid rgba(255,255,255,.08); background: #161b25; }
.product-footer text { display: block; color: #8f98a8; font-size: 20rpx; text-transform: uppercase; }
.product-footer b { display: block; margin-top: 6rpx; color: #fff; font-size: 40rpx; }
.product-footer i { display: block; margin-top: 8rpx; color: #12c979; font-style: normal; font-size: 22rpx; }
.product-footer button { display: flex; align-items: center; justify-content: center; gap: 8rpx; height: 88rpx; padding: 0 38rpx; border-radius: 999rpx; background: #c6ff3a; color: #10140a; font-size: 27rpx; font-weight: 760; white-space: nowrap; }
.product-footer button text { display: inline; color: #10140a; font-size: 32rpx; }
.purchase-ticker { grid-template-columns: auto 1fr auto; margin-top: 24rpx; }
.avatar { display: grid; width: 56rpx; height: 56rpx; place-items: center; border-radius: 50%; color: #fff; font-size: 25rpx; font-weight: 760; }
.purchase-ticker b { color: #fff; font-size: 24rpx; }
.purchase-ticker text { display: block; margin-top: 4rpx; color: #99a3b3; font-size: 22rpx; }
.purchase-ticker i { color: #8f98a8; font-style: normal; font-size: 21rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.locked-list .locked-card:first-child { margin-top: 0; }
.orders-entry { display: flex; align-items: center; justify-content: center; gap: 10rpx; width: 100%; height: 84rpx; margin-top: 28rpx; border: 1rpx solid rgba(255,255,255,.12); border-radius: 999rpx; background: #10141d; color: #d7dce6; font-size: 25rpx; }
.footer-note { margin-top: 18rpx; padding-bottom: 8rpx; text-align: center; color: #8f98a8; font-size: 23rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
@keyframes drift { from{transform:translateX(-16rpx)} to{transform:translate(20rpx,10rpx) scale(1.05)} }
@keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
</style>
