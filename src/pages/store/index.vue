<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppShell from '@/components/AppShell.vue'
import { requireAuth } from '@/utils/auth-guard'
import { getMainPageMessages, useActiveLocale } from '@/utils/i18n'

type ProductTier = 'Entry' | 'Pro' | 'Flagship' | 'Share'
type ProductStatus = 'active' | 'legacy'

interface AiPerformance {
  imageGenPerMin?: number
  llmTokensPerSec?: number
  videoMinPerHour?: number
  unlocks?: string
}

interface Product {
  id: string
  name: string
  tier: ProductTier
  badge?: string
  tagline: string
  photo: string
  tierCode: string
  dailyEarn: number
  dailyEarnNEX: number
  annualROI: number
  price: number
  sold: number
  stock?: number
  rating: number
  reviews: number
  gpu: string
  vram: string
  ai?: AiPerformance
  shareYieldMin?: number
  shareYieldMax?: number
  generation: number
  status: ProductStatus
  supersededBy?: string
  tradeinCredit?: number
  unlocksAtPhase?: 'P3' | 'P5'
}

onShow(() => {
  requireAuth()
})

const tickerIndex = ref(0)
const locale = useActiveLocale()
const copy = computed(() => getMainPageMessages(locale.value))
const t = computed(() => copy.value.store)
const v = computed(() => t.value.v5)
const common = computed(() => copy.value.common)

const fmtMoney = (value: number, digits = value < 1 ? 3 : 2) =>
  `$${value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}`

const fmtInt = (value: number) => value.toLocaleString('en-US')
const paybackDays = (product: Product) => Math.round(product.price / product.dailyEarn)
const yearOneNet = (product: Product) => Math.round(product.dailyEarn * 365 - product.price)
const multiplier = (product: Product) => Math.round(product.dailyEarn / 0.06)
const isShareProduct = (product: Product) => product.tier === 'Share'
const tx = (zh: string, en: string) => (locale.value === 'zh' ? zh : en)
const annualPaybackLabel = (product: Product) =>
  v.value.annualPayback
    .replace('{annual}', String(product.annualROI))
    .replace('{payback}', `${paybackDays(product)}d`)
const tradeInVerb = computed(() => tx('换购', 'Trade in'))
const minStakeLabel = computed(() => tx('最低认购 $199', 'Min stake $199'))
const annualYieldLabel = computed(() => tx('年化收益', 'Annual yield'))
const oneTimeStakeLabel = computed(() => tx('一次性认购', 'one-time stake'))
const yearOneNetLabel = computed(() => tx('首年净收益', 'Year 1 net'))
const paysBackLabel = (product: Product) => tx(`约 ${paybackDays(product)} 天回本`, `Pays back in ${paybackDays(product)}d`)
const reviewsLabel = (count: number) => tx(`${fmtInt(count)} 条评价`, `${fmtInt(count)} reviews`)
const soldLabel = (count: number) => tx(`${fmtInt(count)} 已售`, `${fmtInt(count)} sold`)
const vsPhoneLabel = computed(() => tx('对比手机', 'vs phone'))
const legacyLabel = (generation: number) => tx(`旧款 · 第 ${generation} 代`, `Legacy · Gen ${generation}`)
const tradeCreditLabel = (credit: number) => tx(`换购 · $${credit} 抵扣`, `Trade up · $${credit} credit`)
const dataCenterLabel = computed(() => tx('新加坡机房', 'Singapore DC'))
const redemptionLabel = computed(() => tx('30 天赎回', '30d redemption'))
const phaseProgressLabel = (current: number, total: number) => tx(`阶段 ${current}/${total} · 解锁进度`, `Phase ${current}/${total} · unlock progress`)
const notifyMeLabel = computed(() => tx('提醒我', 'Notify me'))
const inQueueLabel = computed(() => tx('排队中', 'in queue'))

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

const products = computed<Product[]>(() => [
  {
    id: 'stellarbox-s1',
    name: 'NexionBox S1',
    tier: 'Entry',
    badge: v.value.bestSeller,
    tagline: v.value.personalBox,
    photo: '/src/static/products/nexionbox-s1-v4.png',
    tierCode: 'S1',
    dailyEarn: 38.5,
    dailyEarnNEX: 65,
    price: 1299,
    annualROI: 108,
    sold: 4821,
    stock: 47,
    rating: 4.8,
    reviews: 2847,
    gpu: '4x RTX 4090',
    vram: '96GB VRAM',
    ai: { imageGenPerMin: 320, llmTokensPerSec: 12400, videoMinPerHour: 18, unlocks: 'LLM 70B inference pool' },
    generation: 1,
    status: 'legacy',
    supersededBy: 'stellarbox-pro-v2',
    tradeinCredit: 300
  },
  {
    id: 'stellarbox-pro',
    name: 'NexionBox Pro',
    tier: 'Pro',
    badge: v.value.trending,
    tagline: v.value.proBox,
    photo: '/src/static/products/nexionbox-pro-v2.png',
    tierCode: 'Pro',
    dailyEarn: 76,
    dailyEarnNEX: 215,
    annualROI: 116,
    price: 2399,
    sold: 1842,
    stock: 23,
    rating: 4.9,
    reviews: 1124,
    gpu: '8x RTX 4090',
    vram: '192GB VRAM',
    ai: { imageGenPerMin: 720, llmTokensPerSec: 38000, videoMinPerHour: 12, unlocks: 'AI Premium pool' },
    generation: 1,
    status: 'legacy',
    supersededBy: 'stellarbox-pro-v2',
    tradeinCredit: 300
  },
  {
    id: 'stellarrack-p1',
    name: 'NexionRack P1',
    tier: 'Flagship',
    badge: v.value.flagship,
    tagline: v.value.rackBox,
    photo: '/src/static/products/nexionrack-p1-v2.png',
    tierCode: 'Rack P1',
    dailyEarn: 142.6,
    dailyEarnNEX: 950,
    annualROI: 58,
    price: 8999,
    sold: 287,
    stock: 8,
    rating: 4.9,
    reviews: 154,
    gpu: '8x NVIDIA A100',
    vram: '640GB VRAM',
    ai: { imageGenPerMin: 1800, llmTokensPerSec: 128000, videoMinPerHour: 60, unlocks: 'Training pool' },
    generation: 1,
    status: 'legacy',
    supersededBy: 'stellarrack-p2',
    tradeinCredit: 800
  },
  {
    id: 'cloud-share',
    name: 'Cloud Share',
    tier: 'Share',
    badge: v.value.lowBarrier,
    tagline: v.value.cloudShareLine,
    photo: '',
    tierCode: 'Cloud',
    dailyEarn: 0.073,
    dailyEarnNEX: 30,
    annualROI: 13,
    price: 199,
    sold: 12483,
    rating: 4.6,
    reviews: 3812,
    gpu: 'Distributed',
    vram: 'Network slice',
    shareYieldMin: 8,
    shareYieldMax: 15,
    ai: { unlocks: 'Fractional IG + EM + SP pools' },
    generation: 1,
    status: 'active'
  }
])

const featuredProduct = computed(() => products.value.find((p) => p.id === 'stellarbox-s1') ?? products.value[0])
const restProducts = computed(() => products.value.filter((p) => p.id !== featuredProduct.value?.id))

const lockedProducts = computed<Product[]>(() => [
  {
    id: 'stellarbox-pro-v2',
    name: 'NexionBox Pro v2',
    tier: 'Pro',
    badge: 'New Gen',
    tagline: v.value.newSilicon,
    photo: '/src/static/products/nexionbox-pro-v2.png',
    tierCode: 'Pro v2',
    dailyEarn: 96,
    dailyEarnNEX: 280,
    annualROI: 132,
    price: 2639,
    sold: 412,
    stock: 38,
    rating: 4.9,
    reviews: 187,
    gpu: '8x RTX 5090',
    vram: '256GB VRAM',
    generation: 2,
    status: 'active',
    tradeinCredit: 300,
    unlocksAtPhase: 'P3'
  },
  {
    id: 'stellarrack-p2',
    name: 'NexionRack P2',
    tier: 'Flagship',
    badge: 'New Gen',
    tagline: v.value.trainingUnlock,
    photo: '/src/static/products/nexionrack-p1-v2.png',
    tierCode: 'Rack P2',
    dailyEarn: 248,
    dailyEarnNEX: 1820,
    annualROI: 67,
    price: 14999,
    sold: 64,
    stock: 4,
    rating: 5,
    reviews: 41,
    gpu: '8x NVIDIA H100',
    vram: '1,024GB VRAM',
    generation: 2,
    status: 'active',
    tradeinCredit: 800,
    unlocksAtPhase: 'P5'
  }
])

const phaseMeta: Record<'P3' | 'P5', { eta: string; current: number; total: number; pct: number; queue: number }> = {
  P3: { eta: 'Q3', current: 1, total: 3, pct: 33, queue: 1842 },
  P5: { eta: 'Q1 next year', current: 1, total: 5, pct: 20, queue: 614 }
}

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

function tryNavigate(url: string, fallbackLabel: string, fallbackUrl?: string) {
  uni.navigateTo({
    url,
    fail: () => {
      if (fallbackUrl) {
        uni.switchTab({
          url: fallbackUrl,
          fail: () => showSoon(fallbackLabel)
        })
        return
      }
      showSoon(fallbackLabel)
    }
  })
}

function openProduct(product: Product) {
  tryNavigate(`/pages/store/product?id=${product.id}`, product.name)
}

function buyProduct(product: Product) {
  tryNavigate(`/pages/store/checkout?product=${product.id}`, isShareProduct(product) ? 'Stake' : 'Checkout', '/pages/me/index')
}

function openTradeIn() {
  tryNavigate('/pages/me/devices', 'Trade in', '/pages/me/index')
}

function openOrders() {
  tryNavigate('/pages/store/orders', v.value.orders, '/pages/me/index')
}

function notifyLocked(product: Product) {
  uni.showToast({ title: `${product.name} notify list joined`, icon: 'none' })
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
            <text class="hero-spark" />
          </view>
        </view>

        <view class="section-title">
          <b>{{ v.networkLadder }} <text class="count">{{ v.fiveTiers }}</text></b>
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

        <view class="section-title">
          <b>{{ v.recommended }}</b>
          <text class="chip">{{ t.popular }}</text>
        </view>
        <view v-if="featuredProduct" class="product-card card featured" @click="openProduct(featuredProduct)">
          <view class="product-photo">
            <image v-if="featuredProduct.photo" :src="featuredProduct.photo" mode="aspectFill" />
            <view v-else class="cloud-art">CPU</view>
            <view class="ribbon">{{ featuredProduct.badge }}</view>
            <view class="tier-stack">
              <view class="tier-chip">{{ featuredProduct.tierCode }}</view>
              <view v-if="featuredProduct.status === 'legacy'" class="legacy-chip">{{ legacyLabel(featuredProduct.generation) }}</view>
            </view>
          </view>
          <view class="product-body">
            <view class="product-head dense">
              <view>
                <b>{{ featuredProduct.name }}</b>
                <view class="rating-row">
                  <text class="rating-star" />
                  <b>{{ featuredProduct.rating.toFixed(1) }}</b>
                  <i>· {{ reviewsLabel(featuredProduct.reviews) }}</i>
                  <i>· {{ soldLabel(featuredProduct.sold) }}</i>
                </view>
              </view>
              <view class="multiplier"><b>{{ fmtInt(multiplier(featuredProduct)) }}×</b><text>{{ vsPhoneLabel }}</text></view>
            </view>
            <view class="spec-row compact">
              <text>{{ featuredProduct.gpu }}</text>
              <text>{{ featuredProduct.vram }}</text>
              <text>{{ dataCenterLabel }}</text>
            </view>
            <view class="roi-hero">
              <view class="roi-eyebrow">↗ {{ v.youEarn }}</view>
              <view class="earn-line">
                <b>{{ fmtMoney(featuredProduct.dailyEarn) }}<i>/day</i></b>
                <text>+{{ featuredProduct.dailyEarnNEX }} NEX/d</text>
              </view>
              <view class="roi-chip-row">
                <text class="success"><i class="ui-symbol icon-zap" />{{ paysBackLabel(featuredProduct) }}</text>
                <text>{{ yearOneNetLabel }} <i>+${{ fmtInt(yearOneNet(featuredProduct)) }}</i></text>
              </view>
              <view v-if="featuredProduct.ai" class="ai-row">
                <text v-if="featuredProduct.ai.imageGenPerMin">Image · {{ featuredProduct.ai.imageGenPerMin }}/min</text>
                <text v-if="featuredProduct.ai.llmTokensPerSec">LLM · {{ (featuredProduct.ai.llmTokensPerSec / 1000).toFixed(1) }}k tok/s</text>
                <text v-if="featuredProduct.ai.videoMinPerHour">Video · {{ featuredProduct.ai.videoMinPerHour }}s/min</text>
              </view>
              <view v-if="featuredProduct.stock" class="stock-strip">
                <i class="stock-icon" />
                <view>
                  <b>{{ v.unitsLeft.replace('{n}', String(featuredProduct.stock)) }}</b>
                  <view><span :style="{ width: `${Math.min(100, (featuredProduct.stock / 50) * 100)}%` }" /></view>
                </view>
              </view>
              <view v-if="featuredProduct.status === 'legacy' && featuredProduct.tradeinCredit" class="tradeup-strip" @click.stop="openTradeIn">
                <text>{{ tradeCreditLabel(featuredProduct.tradeinCredit) }}</text>
                <i>{{ tradeInVerb }} →</i>
              </view>
            </view>
          </view>
          <view class="product-footer">
            <view>
              <text>{{ v.price }}</text>
              <b><text class="price-dollar">$</text>{{ fmtInt(featuredProduct.price) }}</b>
              <i>{{ annualPaybackLabel(featuredProduct) }}</i>
            </view>
            <button @click.stop="buyProduct(featuredProduct)">{{ v.buyNow }} <text>›</text></button>
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
        <view v-for="product in restProducts" :key="product.id" class="product-card card" @click="openProduct(product)">
          <view class="product-photo">
            <image v-if="product.photo" :src="product.photo" mode="aspectFill" />
            <view v-else class="cloud-art">CPU</view>
            <view class="ribbon">{{ product.badge }}</view>
            <view class="tier-stack">
              <view class="tier-chip">{{ product.tierCode }}</view>
              <view v-if="product.status === 'legacy'" class="legacy-chip">{{ legacyLabel(product.generation) }}</view>
            </view>
          </view>
          <view class="product-body">
            <view class="product-head dense">
              <view>
                <b>{{ product.name }}</b>
                <view class="rating-row">
                  <text class="rating-star" />
                  <b>{{ product.rating.toFixed(1) }}</b>
                  <i>· {{ reviewsLabel(product.reviews) }}</i>
                  <i>· {{ soldLabel(product.sold) }}</i>
                </view>
              </view>
              <view class="multiplier"><b>{{ fmtInt(multiplier(product)) }}×</b><text>{{ vsPhoneLabel }}</text></view>
            </view>
            <view class="spec-row compact">
              <text>{{ product.gpu }}</text>
              <text>{{ product.vram }}</text>
              <text>{{ isShareProduct(product) ? redemptionLabel : dataCenterLabel }}</text>
            </view>
            <view class="roi-hero">
              <view class="roi-eyebrow">↗ {{ isShareProduct(product) ? annualYieldLabel : v.youEarn }}</view>
              <view class="earn-line">
                <b v-if="isShareProduct(product)">{{ product.shareYieldMin }}-{{ product.shareYieldMax }}%<i></i></b>
                <b v-else>{{ fmtMoney(product.dailyEarn) }}<i>/day</i></b>
                <text>+{{ product.dailyEarnNEX }} NEX/d</text>
              </view>
              <view class="roi-chip-row">
                <text v-if="isShareProduct(product)" class="success">{{ minStakeLabel }}</text>
                <text v-else class="success"><i class="ui-symbol icon-zap" />{{ paysBackLabel(product) }}</text>
                <text v-if="isShareProduct(product)">{{ oneTimeStakeLabel }}</text>
                <text v-else>{{ yearOneNetLabel }} <i>+${{ fmtInt(yearOneNet(product)) }}</i></text>
              </view>
              <view v-if="product.ai" class="ai-row">
                <text v-if="product.ai.imageGenPerMin">Image · {{ product.ai.imageGenPerMin }}/min</text>
                <text v-if="product.ai.llmTokensPerSec">LLM · {{ (product.ai.llmTokensPerSec / 1000).toFixed(1) }}k tok/s</text>
                <text v-if="product.ai.videoMinPerHour">Video · {{ product.ai.videoMinPerHour }}s/min</text>
              </view>
              <view v-if="product.stock" class="stock-strip">
                <i class="stock-icon" />
                <view>
                  <b>{{ v.unitsLeft.replace('{n}', String(product.stock)) }}</b>
                  <view><span :style="{ width: `${Math.min(100, (product.stock / 50) * 100)}%` }" /></view>
                </view>
              </view>
              <view v-if="product.status === 'legacy' && product.tradeinCredit" class="tradeup-strip" @click.stop="openTradeIn">
                <text>{{ tradeCreditLabel(product.tradeinCredit) }}</text>
                <i>{{ tradeInVerb }} →</i>
              </view>
            </view>
          </view>
          <view class="product-footer">
            <view>
              <text>{{ isShareProduct(product) ? v.from : v.price }}</text>
              <b><text class="price-dollar">$</text>{{ fmtInt(product.price) }}</b>
              <i>{{ isShareProduct(product) ? v.oneTimeStake : annualPaybackLabel(product) }}</i>
            </view>
            <button @click.stop="buyProduct(product)">{{ isShareProduct(product) ? v.stake : v.buyNow }} <text>›</text></button>
          </view>
        </view>

        <view class="section-title">
          <b>{{ v.comingSoon }}</b>
          <text>{{ v.nextPhases }}</text>
        </view>
        <view class="locked-list">
          <view v-for="item in lockedProducts" :key="item.name" class="locked-card card">
            <view class="locked-aurora" />
            <view class="lock-icon">⌁<span /></view>
            <view>
              <em>{{ v.comingSoon }}</em>
              <b>{{ item.name }}</b>
              <text>{{ item.tagline }}</text>
              <view class="locked-specs"><text>{{ item.gpu }}</text><i>·</i><text>{{ item.vram }}</text></view>
              <view v-if="item.unlocksAtPhase" class="locked-progress">
                <view>
                  <text>{{ phaseProgressLabel(phaseMeta[item.unlocksAtPhase].current, phaseMeta[item.unlocksAtPhase].total) }}</text>
                  <b>{{ phaseMeta[item.unlocksAtPhase].pct }}%</b>
                </view>
                <span><i :style="{ width: `${phaseMeta[item.unlocksAtPhase].pct}%` }" /></span>
              </view>
              <view class="locked-actions">
                <button @click.stop="notifyLocked(item)">{{ notifyMeLabel }}</button>
                <text v-if="item.unlocksAtPhase"><b>{{ fmtInt(phaseMeta[item.unlocksAtPhase].queue) }}</b> {{ inQueueLabel }}</text>
              </view>
            </view>
            <i v-if="item.unlocksAtPhase">{{ phaseMeta[item.unlocksAtPhase].eta }}</i>
          </view>
        </view>

        <button class="orders-entry" @click="openOrders"><text class="ui-symbol icon-orders" /> {{ v.orders }}</button>
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
.hero-spark { position: absolute; right: 12rpx; top: 26rpx; width: 32rpx; height: 32rpx; background: #ff9b62; -webkit-mask: url("../../static/icons/wallet-sparkles.svg") center / contain no-repeat; mask: url("../../static/icons/wallet-sparkles.svg") center / contain no-repeat; animation: pulse 2.2s ease-in-out infinite; }
.section-title { display: flex; justify-content: space-between; align-items: center; margin: 42rpx 4rpx 18rpx; }
.section-title b { color: #fff; font-size: 30rpx; }
.section-title b .count { margin-left: 8rpx; color: #8f98a8; font-size: 23rpx; font-weight: 400; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
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
.purchase-ticker, .locked-card { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 18rpx; margin-top: 24rpx; padding: 24rpx 28rpx; }
.lock-icon { display: grid; width: 58rpx; height: 58rpx; place-items: center; border-radius: 18rpx; background: rgba(198,255,58,.12); color: #c6ff3a; font-size: 30rpx; }
.locked-card b { display: block; color: #fff; font-size: 26rpx; }
.locked-card text { display: block; margin-top: 6rpx; color: #99a3b3; font-size: 22rpx; line-height: 1.35; }
.locked-card i { color: #ff9b62; font-style: normal; font-size: 21rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
.locked-card em { display: block; margin-bottom: 6rpx; color: #ff9b62; font-style: normal; font-size: 20rpx; font-weight: 700; letter-spacing: 1rpx; text-transform: uppercase; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.product-card { overflow: hidden; margin-top: 20rpx; }
.product-card.featured { box-shadow: 0 30rpx 90rpx rgba(0,0,0,.28); }
.product-photo { position: relative; height: 360rpx; overflow: hidden; background: linear-gradient(135deg,#101216,#050608); }
.product-photo image { width: 100%; height: 100%; }
.cloud-art { display: grid; height: 100%; place-items: center; color: #58e7ff; font-size: 54rpx; background: repeating-linear-gradient(135deg, rgba(88,231,255,.08) 0 16rpx, transparent 16rpx 36rpx), linear-gradient(135deg, rgba(88,231,255,.18), #10141d); }
.product-photo::after { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 76%, #10141d 100%); content: ""; }
.ribbon { position: absolute; top: 0; left: 32rpx; z-index: 2; padding: 6rpx 20rpx 8rpx; border-radius: 0 0 12rpx 12rpx; background: #c6ff3a; color: #10140a; font-size: 21rpx; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.tier-stack { position: absolute; left: 28rpx; bottom: 24rpx; z-index: 2; display: flex; flex-direction: column; align-items: flex-start; gap: 10rpx; }
.tier-chip { padding: 10rpx 18rpx; border: 1rpx solid rgba(198,255,58,.32); border-radius: 8rpx; background: rgba(0,0,0,.55); color: rgba(255,255,255,.88); font-size: 21rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 3rpx; }
.legacy-chip { padding: 7rpx 16rpx; border: 1rpx solid rgba(255,203,77,.42); border-radius: 8rpx; background: rgba(0,0,0,.55); color: #ffcb4d; font-size: 21rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.product-body { padding: 28rpx 32rpx; }
.product-head { display: flex; justify-content: space-between; gap: 20rpx; }
.product-head.dense { align-items: flex-start; }
.product-head b { display: block; color: #fff; font-size: 32rpx; }
.product-head text { display: block; margin-top: 8rpx; color: #99a3b3; font-size: 23rpx; line-height: 1.35; }
.rating-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8rpx; margin-top: 10rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.rating-star { display: inline-block; width: 22rpx; height: 22rpx; margin: 0; background: #ff9b62; -webkit-mask: url("../../static/icons/wallet-sparkles.svg") center / contain no-repeat; mask: url("../../static/icons/wallet-sparkles.svg") center / contain no-repeat; }
.rating-row b { display: inline; color: #fff; font-size: 22rpx; font-weight: 600; }
.rating-row i { color: #8f98a8; font-style: normal; font-size: 21rpx; }
.daily { color: #12c979; font-size: 38rpx; font-weight: 760; text-align: right; white-space: nowrap; }
.daily text { display: inline; color: #8f98a8; font-size: 22rpx; }
.multiplier { flex-shrink: 0; text-align: right; }
.multiplier b { color: #ff9b62; font-size: 38rpx; line-height: 1; }
.multiplier text { display: block; margin-top: 6rpx; color: #8f98a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 21rpx; white-space: nowrap; }
.roi-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 16rpx; margin-top: 24rpx; }
.roi-grid view { padding: 18rpx; border-radius: 20rpx; background: rgba(255,255,255,.05); }
.roi-grid text { display: block; color: #8f98a8; font-size: 21rpx; }
.roi-grid b { display: block; margin-top: 8rpx; color: #fff; font-size: 31rpx; }
.roi-grid i { display: block; margin-top: 6rpx; color: #12c979; font-style: normal; font-size: 21rpx; }
.spec-row { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 22rpx; }
.spec-row text { padding: 10rpx 16rpx; border-radius: 14rpx; background: #161b25; color: #d7dce6; font-size: 21rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.spec-row.compact { margin-top: 22rpx; gap: 10rpx; }
.spec-row.compact text { border-radius: 12rpx; background: #171c25; color: #d7dce6; }
.roi-hero { margin-top: 24rpx; padding-top: 22rpx; border-top: 1rpx dashed rgba(255,255,255,.14); }
.roi-eyebrow { color: #12c979; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 21rpx; font-weight: 700; letter-spacing: 2rpx; text-transform: uppercase; }
.earn-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 16rpx; margin-top: 8rpx; }
.earn-line b { color: #12c979; font-size: 52rpx; font-weight: 720; letter-spacing: 0; line-height: 1; }
.earn-line b i { color: #8f98a8; font-size: 26rpx; font-style: normal; font-weight: 500; }
.earn-line text { color: #c6ff3a; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 25rpx; font-weight: 600; }
.roi-chip-row, .ai-row { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 18rpx; }
.roi-chip-row text, .ai-row text { padding: 8rpx 18rpx; border-radius: 12rpx; background: #171c25; color: #d7dce6; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 22rpx; }
.roi-chip-row .success { background: rgba(18,201,121,.12); color: #12c979; }
.roi-chip-row i { color: #12c979; font-style: normal; }
.ai-row text { background: rgba(88,231,255,.13); color: #58e7ff; }
.stock-strip { display: grid; grid-template-columns: auto 1fr; gap: 18rpx; align-items: center; margin-top: 22rpx; padding: 20rpx 22rpx; border-radius: 20rpx; background: rgba(255,155,98,.12); }
.stock-icon { display: grid; width: 44rpx; height: 44rpx; place-items: center; border-radius: 12rpx; background: #ff9b62; font-style: normal; }
.stock-icon::before { display: block; width: 24rpx; height: 24rpx; background: #120804; -webkit-mask: url("../../static/icons/tab-zap.svg") center / contain no-repeat; mask: url("../../static/icons/tab-zap.svg") center / contain no-repeat; content: ""; }
.ui-symbol { display: inline-block; flex-shrink: 0; width: 26rpx; height: 26rpx; background: currentColor; vertical-align: -4rpx; }
.icon-zap { margin-right: 6rpx; color: inherit; -webkit-mask: url("../../static/icons/tab-zap.svg") center / contain no-repeat; mask: url("../../static/icons/tab-zap.svg") center / contain no-repeat; }
.icon-refresh { color: inherit; -webkit-mask: url("../../static/icons/profile-refresh-cw.svg") center / contain no-repeat; mask: url("../../static/icons/profile-refresh-cw.svg") center / contain no-repeat; }
.icon-orders { color: inherit; -webkit-mask: url("../../static/icons/bill-shopping-bag.svg") center / contain no-repeat; mask: url("../../static/icons/bill-shopping-bag.svg") center / contain no-repeat; }
.stock-strip b { color: #ff9b62; font-size: 23rpx; }
.stock-strip view view { height: 6rpx; margin-top: 12rpx; overflow: hidden; border-radius: 999rpx; background: rgba(255,155,98,.16); }
.stock-strip span { display: block; height: 100%; background: #ff9b62; }
.tradeup-strip { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 20rpx; padding: 14rpx 18rpx; border-radius: 16rpx; background: rgba(198,255,58,.1); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.tradeup-strip text { color: #99a3b3; font-size: 22rpx; }
.tradeup-strip b { display: inline; color: #12c979; font-size: 22rpx; }
.tradeup-strip i { color: #c6ff3a; font-style: normal; font-size: 22rpx; font-weight: 700; white-space: nowrap; }
.product-footer { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 20rpx; padding: 26rpx 32rpx; border-top: 1rpx solid rgba(255,255,255,.08); background: #161b25; }
.product-footer text { display: block; color: #8f98a8; font-size: 20rpx; text-transform: uppercase; }
.product-footer b { display: block; margin-top: 6rpx; color: #fff; font-size: 40rpx; }
.product-footer b .price-dollar { display: inline; margin-right: 2rpx; color: #8f98a8; font-size: 24rpx; }
.product-footer i { display: block; margin-top: 8rpx; color: #12c979; font-style: normal; font-size: 22rpx; }
.product-footer button { display: flex; align-items: center; justify-content: center; gap: 8rpx; height: 88rpx; padding: 0 38rpx; border-radius: 999rpx; background: #c6ff3a; color: #10140a; font-size: 27rpx; font-weight: 760; white-space: nowrap; }
.product-footer button text { display: inline; color: #10140a; font-size: 32rpx; }
.purchase-ticker { grid-template-columns: auto 1fr auto; margin-top: 24rpx; }
.avatar { display: grid; width: 56rpx; height: 56rpx; place-items: center; border-radius: 50%; color: #fff; font-size: 25rpx; font-weight: 760; }
.purchase-ticker b { color: #fff; font-size: 24rpx; }
.purchase-ticker text { display: block; margin-top: 4rpx; color: #99a3b3; font-size: 22rpx; }
.purchase-ticker i { color: #8f98a8; font-style: normal; font-size: 21rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.locked-list .locked-card:first-child { margin-top: 0; }
.locked-card { position: relative; overflow: hidden; align-items: flex-start; padding: 30rpx; }
.locked-card > view:not(.locked-aurora), .locked-card > i { position: relative; z-index: 1; }
.locked-aurora { position: absolute; inset: -24%; background: radial-gradient(40% 48% at 86% 12%, rgba(255,122,61,.16), transparent 64%), radial-gradient(36% 44% at 12% 86%, rgba(88,231,255,.12), transparent 62%); filter: blur(18rpx); animation: drift 14s ease-in-out infinite alternate; }
.lock-icon { position: relative; background: linear-gradient(135deg, rgba(255,122,61,.14), rgba(88,231,255,.11)); color: #ff9b62; }
.lock-icon span { position: absolute; right: -3rpx; bottom: -3rpx; width: 14rpx; height: 14rpx; border: 4rpx solid #10141d; border-radius: 50%; background: #58e7ff; animation: pulse 2.4s ease-in-out infinite; }
.locked-specs { display: flex; align-items: center; flex-wrap: wrap; gap: 10rpx; margin-top: 12rpx; color: #8f98a8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.locked-specs text { display: inline; margin: 0; color: #d7dce6; font-size: 21rpx; }
.locked-specs i { color: #6b7385; font-style: normal; font-size: 20rpx; }
.locked-progress { margin-top: 22rpx; padding-top: 20rpx; border-top: 1rpx dashed rgba(255,255,255,.14); }
.locked-progress view { display: flex; justify-content: space-between; align-items: center; gap: 12rpx; }
.locked-progress view text { margin: 0; color: #99a3b3; font-size: 20rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.locked-progress view b { color: #ff9b62; font-size: 22rpx; }
.locked-progress > span { display: block; height: 8rpx; margin-top: 12rpx; overflow: hidden; border-radius: 999rpx; background: #242a35; }
.locked-progress > span i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg,#ff9b62,#58e7ff); }
.locked-actions { display: flex; align-items: center; gap: 18rpx; margin-top: 22rpx; }
.locked-actions button { flex: 1; height: 76rpx; border-radius: 999rpx; background: #ff9b62; color: #120804; font-size: 25rpx; font-weight: 760; }
.locked-actions text { margin: 0; color: #8f98a8; font-size: 20rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
.locked-actions text b { display: block; color: #ff9b62; font-size: 23rpx; }
.orders-entry { display: flex; align-items: center; justify-content: center; gap: 10rpx; width: 100%; height: 84rpx; margin-top: 28rpx; border: 1rpx solid rgba(255,255,255,.12); border-radius: 999rpx; background: #10141d; color: #d7dce6; font-size: 25rpx; }
.footer-note { margin-top: 18rpx; padding-bottom: 8rpx; text-align: center; color: #8f98a8; font-size: 23rpx; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
@keyframes drift { from{transform:translateX(-16rpx)} to{transform:translate(20rpx,10rpx) scale(1.05)} }
@keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
</style>
