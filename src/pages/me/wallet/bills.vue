<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getWalletLedgers } from '@/api/wallet'
import { useAuthStore } from '@/store/auth'
import type { WalletLedger } from '@/types/wallet'
import { requireAuth } from '@/utils/auth-guard'
import { useActiveLocale } from '@/utils/i18n'

type BillTab = 'all' | 'in' | 'out'
type BillType = 'earn' | 'refer' | 'bonus' | 'topup' | 'withdraw' | 'purchase' | 'swap' | 'kyc' | 'stake' | 'unstake' | 'achievement'
type BillStatus = 'posted' | 'pending' | 'failed'

interface BillRow {
  id: number
  type: BillType
  status: BillStatus
  memo: string
  ref: string
  symbol: string
  amount: number
  balanceAfter?: number
  ts: string
}

const auth = useAuthStore()
const locale = useActiveLocale()
const tab = ref<BillTab>('all')
const loading = ref(false)
const ledgers = ref<WalletLedger[]>([])

const copy = computed(() => {
  const zh = locale.value === 'zh'
  return {
    title: zh ? '账单' : 'Bills',
    tabAll: zh ? '全部' : 'All',
    tabIn: zh ? '入账' : 'Credit',
    tabOut: zh ? '出账' : 'Debit',
    empty: zh ? '暂无账单记录' : 'No bill records yet',
    footer: zh ? '余额和流水来自钱包服务，部分链上状态可能会有同步延迟。' : 'Balances and bills are served by wallet services. Some on-chain states can sync with a short delay.',
    rows: zh ? '条' : 'rows',
    runningBalance: zh ? '当前余额' : 'Running balance',
    status: {
      posted: zh ? '已入账' : 'posted',
      pending: zh ? '处理中' : 'pending',
      failed: zh ? '失败' : 'failed'
    },
    types: {
      earn: zh ? '算力收益' : 'Compute earning',
      refer: zh ? '推荐奖励' : 'Referral reward',
      bonus: zh ? '奖励' : 'Bonus',
      topup: zh ? '充值' : 'Top up',
      withdraw: zh ? '提现' : 'Withdraw',
      purchase: zh ? '购买' : 'Purchase',
      swap: zh ? '兑换' : 'Exchange',
      kyc: zh ? '身份验证' : 'KYC',
      stake: zh ? '质押' : 'Stake',
      unstake: zh ? '解除质押' : 'Unstake',
      achievement: zh ? '成就奖励' : 'Achievement'
    }
  }
})

const bills = computed(() => ledgers.value.map(toBillRow))
const filtered = computed(() => {
  if (tab.value === 'in') return bills.value.filter((item) => item.amount > 0)
  if (tab.value === 'out') return bills.value.filter((item) => item.amount < 0)
  return bills.value
})
const grouped = computed(() => groupByMonth(filtered.value))

onShow(async () => {
  requireAuth()
  await loadLedgers()
})

function goBack() {
  uni.navigateBack({ delta: 1 })
}

async function loadLedgers() {
  const userId = auth.session?.userId
  if (!userId) {
    ledgers.value = demoLedgers()
    return
  }

  loading.value = true
  try {
    const result = await getWalletLedgers({ userId, pageNum: 1, pageSize: 50 })
    ledgers.value = result.records?.length ? result.records : demoLedgers(userId)
  } catch {
    ledgers.value = demoLedgers(userId)
  } finally {
    loading.value = false
  }
}

function setTab(value: BillTab) {
  tab.value = value
}

function toBillRow(ledger: WalletLedger): BillRow {
  const direction = String(ledger.direction || '').toUpperCase()
  const amount = Number(ledger.amount || 0)
  const signedAmount = direction === 'OUT' ? -Math.abs(amount) : Math.abs(amount)

  return {
    id: Number(ledger.id),
    type: mapType(ledger.bizType),
    status: mapStatus(ledger.status),
    memo: ledger.remark || copy.value.types[mapType(ledger.bizType)],
    ref: ledger.bizNo,
    symbol: ledger.asset || 'USDT',
    amount: signedAmount,
    balanceAfter: ledger.balanceAfter === undefined || ledger.balanceAfter === null ? undefined : Number(ledger.balanceAfter),
    ts: ledger.createdAt || new Date().toISOString()
  }
}

function mapType(value: string): BillType {
  const type = String(value || '').toUpperCase()
  if (type.includes('EARNING') || type.includes('COMPUTE')) return 'earn'
  if (type.includes('REFER') || type.includes('COMMISSION')) return 'refer'
  if (type.includes('DEPOSIT') || type.includes('TOPUP') || type.includes('CREDIT')) return 'topup'
  if (type.includes('WITHDRAW')) return 'withdraw'
  if (type.includes('PURCHASE') || type.includes('ORDER')) return 'purchase'
  if (type.includes('SWAP') || type.includes('EXCHANGE')) return 'swap'
  if (type.includes('KYC')) return 'kyc'
  if (type.includes('UNSTAKE')) return 'unstake'
  if (type.includes('STAKE')) return 'stake'
  if (type.includes('ACHIEVEMENT')) return 'achievement'
  return 'bonus'
}

function mapStatus(value: string): BillStatus {
  const status = String(value || '').toUpperCase()
  if (status.includes('PENDING') || status.includes('REVIEW')) return 'pending'
  if (status.includes('FAIL') || status.includes('REJECT')) return 'failed'
  return 'posted'
}

function groupByMonth(rows: BillRow[]) {
  const groups = new Map<string, BillRow[]>()
  rows.forEach((row) => {
    const date = new Date(row.ts)
    const month = locale.value === 'zh'
      ? `${date.getFullYear()}年${date.getMonth() + 1}月`
      : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    groups.set(month, [...(groups.get(month) || []), row])
  })
  return Array.from(groups.entries()).map(([month, rows]) => ({ month, rows }))
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return locale.value === 'zh'
    ? date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatAmount(row: BillRow) {
  const abs = Math.abs(row.amount)
  const value = row.symbol === 'USDT' ? abs.toFixed(4) : Math.round(abs).toLocaleString()
  return `${row.amount >= 0 ? '+' : '-'}${value}`
}

function iconClass(type: BillType) {
  return `bill-icon icon-${type}`
}

function demoLedgers(userId = 10001): WalletLedger[] {
  const now = Date.now()
  return [
    demoRow(-1, userId, 'EARNING', 'USDT', 'IN', '2.310000', '128.640000', 'SUCCESS', 'Device earning · Phone node', 'DEMO-BILL-USDT-1', now - 15 * 60 * 1000),
    demoRow(-2, userId, 'EARNING', 'NEX', 'IN', '320.000000', '8420.000000', 'SUCCESS', 'NEX mining bonus', 'DEMO-BILL-NEX-1', now - 3 * 60 * 60 * 1000),
    demoRow(-3, userId, 'DEPOSIT', 'USDT', 'IN', '50.000000', '126.330000', 'SUCCESS', 'TRC20 top up confirmed', 'DEMO-TOPUP-USDT-1', now - 26 * 60 * 60 * 1000),
    demoRow(-4, userId, 'WITHDRAWAL', 'USDT', 'OUT', '20.000000', '76.330000', 'PENDING', 'Withdrawal review', 'DEMO-WITHDRAW-USDT-1', now - 31 * 60 * 60 * 1000),
    demoRow(-5, userId, 'EXCHANGE', 'NEX', 'OUT', '120.000000', '8100.000000', 'SUCCESS', 'USDT ⇄ NEX exchange', 'DEMO-SWAP-NEX-1', now - 4 * 24 * 60 * 60 * 1000),
    demoRow(-6, userId, 'REFERRAL_COMMISSION', 'NEX', 'IN', '200.000000', '8220.000000', 'SUCCESS', 'Referral network reward', 'DEMO-REFER-NEX-1', now - 6 * 24 * 60 * 60 * 1000)
  ]
}

function demoRow(
  id: number,
  userId: number,
  bizType: string,
  asset: string,
  direction: string,
  amount: string,
  balanceAfter: string,
  status: string,
  remark: string,
  bizNo: string,
  ts: number
): WalletLedger {
  return {
    id,
    userId,
    bizType,
    asset,
    direction,
    amount,
    balanceAfter,
    status,
    remark,
    bizNo,
    createdAt: new Date(ts).toISOString()
  }
}
</script>

<template>
  <view class="bills-page">
    <view class="page-header">
      <button class="back-button" :aria-label="copy.title" @click="goBack">
        <text />
      </button>
      <view class="header-title">{{ copy.title }}</view>
      <button class="bell-button" :aria-label="copy.title">
        <text />
        <i />
      </button>
    </view>

    <view class="tabs" :class="`active-${tab}`" role="tablist">
      <view class="tab-indicator" />
      <button :class="{ active: tab === 'all' }" @click="setTab('all')">{{ copy.tabAll }}</button>
      <button :class="{ active: tab === 'in' }" @click="setTab('in')">{{ copy.tabIn }}</button>
      <button :class="{ active: tab === 'out' }" @click="setTab('out')">{{ copy.tabOut }}</button>
    </view>

    <view v-if="!loading && filtered.length === 0" class="empty-card">
      <text>{{ copy.empty }}</text>
    </view>

    <scroll-view v-else class="bill-scroll" scroll-y>
      <view class="month-list">
        <section v-for="group in grouped" :key="group.month" class="month-card">
          <view class="month-head">{{ group.month }} · {{ group.rows.length }} {{ copy.rows }}</view>
          <view
            v-for="(bill, index) in group.rows"
            :key="bill.id"
            class="bill-row"
            :class="{ divided: index !== 0 }"
          >
            <view class="icon-chip" :class="`tone-${bill.type}`">
              <text :class="iconClass(bill.type)" />
            </view>
            <view class="bill-main">
              <view class="bill-title-line">
                <text class="bill-title">{{ copy.types[bill.type] }}</text>
                <text class="status-badge" :class="`status-${bill.status}`">{{ copy.status[bill.status] }}</text>
              </view>
              <view class="bill-memo">
                <text>{{ bill.memo }}</text>
                <text class="dot">·</text>
                <text class="ref">{{ bill.ref }}</text>
              </view>
              <view class="bill-time">{{ formatTime(bill.ts) }}</view>
            </view>
            <view class="amount-block">
              <view class="amount" :class="{ positive: bill.amount >= 0, negative: bill.amount < 0 }">
                <text>{{ formatAmount(bill) }}</text>
                <text>{{ bill.symbol }}</text>
              </view>
              <view v-if="bill.symbol === 'USDT' && bill.balanceAfter !== undefined" class="running">
                {{ copy.runningBalance }}: ${{ bill.balanceAfter.toFixed(2) }}
              </view>
            </view>
          </view>
        </section>
      </view>

      <view class="footer-note">{{ copy.footer }}</view>
    </scroll-view>
  </view>
</template>

<style scoped>
.bills-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 20rpx 32rpx 36rpx;
  background:
    radial-gradient(80% 42% at 50% -10%, rgba(198, 255, 58, 0.06), transparent 62%),
    #07080a;
  color: #ffffff;
}

.page-header {
  display: grid;
  grid-template-columns: 88rpx minmax(0, 1fr) 88rpx;
  align-items: center;
  min-height: 92rpx;
}

.back-button,
.bell-button,
.tabs button,
.tabs uni-button {
  margin: 0;
  padding: 0;
}

.back-button,
.bell-button {
  position: relative;
  display: grid;
  width: 72rpx;
  height: 72rpx;
  place-items: center;
  border: 1rpx solid #232936;
  border-radius: 20rpx;
  background: rgba(16, 20, 29, 0.82);
  box-shadow: 0 10rpx 34rpx rgba(0, 0, 0, 0.25);
}

.bell-button {
  justify-self: end;
}

.back-button text,
.bell-button text {
  width: 32rpx;
  height: 32rpx;
  background: #ffffff;
}

.back-button text {
  -webkit-mask: url("/static/icons/profile-chevron-left.svg") center / contain no-repeat;
  mask: url("/static/icons/profile-chevron-left.svg") center / contain no-repeat;
}

.bell-button text {
  width: 34rpx;
  height: 34rpx;
  background: #c8d0dc;
  -webkit-mask: url("/static/icons/profile-bell.svg") center / contain no-repeat;
  mask: url("/static/icons/profile-bell.svg") center / contain no-repeat;
}

.bell-button i {
  position: absolute;
  top: 15rpx;
  right: 15rpx;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #ff7b8a;
}

.header-title {
  overflow: hidden;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 760;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tabs {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rpx;
  margin: 8rpx 0 24rpx;
  padding: 8rpx;
  border-radius: 32rpx;
  background: #161b25;
}

.tab-indicator {
  position: absolute;
  top: 8rpx;
  bottom: 8rpx;
  left: 8rpx;
  z-index: 0;
  width: calc((100% - 16rpx) / 3);
  border-radius: 20rpx;
  background: #c6ff3a;
  box-shadow: 0 8rpx 22rpx rgba(198, 255, 58, 0.2);
  transform: translate3d(0, 0, 0);
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tabs.active-in .tab-indicator {
  transform: translate3d(100%, 0, 0);
}

.tabs.active-out .tab-indicator {
  transform: translate3d(200%, 0, 0);
}

.tabs button,
.tabs uni-button {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  border-radius: 20rpx;
  background: transparent;
  color: #747f91;
  font-size: 25rpx;
  font-weight: 560;
  line-height: 1;
  letter-spacing: 0;
  text-align: center;
  transition: color 180ms ease, transform 180ms ease;
}

.tabs button.active,
.tabs uni-button.active {
  color: #0b0d13;
  font-weight: 720;
  transform: translateY(-1rpx);
}

.bill-scroll {
  max-height: calc(100vh - 238rpx);
}

.month-list {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.month-card,
.empty-card {
  overflow: hidden;
  border: 1rpx solid #232936;
  border-radius: 32rpx;
  background: #10141d;
}

.empty-card {
  display: grid;
  min-height: 220rpx;
  place-items: center;
  border-style: dashed;
  color: #8f98a8;
  font-size: 27rpx;
}

.month-head {
  padding: 16rpx 28rpx;
  border-bottom: 1rpx solid #232936;
  color: #747f91;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 22rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
  text-transform: uppercase;
}

.bill-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  min-height: 130rpx;
  padding: 18rpx 28rpx;
  box-sizing: border-box;
}

.bill-row.divided {
  border-top: 1rpx solid rgba(35, 41, 54, 0.62);
}

.icon-chip {
  display: grid;
  width: 72rpx;
  height: 72rpx;
  flex: 0 0 72rpx;
  place-items: center;
  border-radius: 18rpx;
  background: rgba(198, 255, 58, 0.1);
  color: #c6ff3a;
}

.bill-icon {
  width: 32rpx;
  height: 32rpx;
  background: currentColor;
}

.icon-earn { -webkit-mask: url("/static/icons/bill-coins.svg") center / contain no-repeat; mask: url("/static/icons/bill-coins.svg") center / contain no-repeat; }
.icon-refer { -webkit-mask: url("/static/icons/bill-sparkles.svg") center / contain no-repeat; mask: url("/static/icons/bill-sparkles.svg") center / contain no-repeat; }
.icon-bonus,
.icon-achievement { -webkit-mask: url("/static/icons/bill-award.svg") center / contain no-repeat; mask: url("/static/icons/bill-award.svg") center / contain no-repeat; }
.icon-topup { -webkit-mask: url("/static/icons/bill-arrow-down-left.svg") center / contain no-repeat; mask: url("/static/icons/bill-arrow-down-left.svg") center / contain no-repeat; }
.icon-withdraw { -webkit-mask: url("/static/icons/bill-arrow-up-right.svg") center / contain no-repeat; mask: url("/static/icons/bill-arrow-up-right.svg") center / contain no-repeat; }
.icon-purchase { -webkit-mask: url("/static/icons/bill-shopping-bag.svg") center / contain no-repeat; mask: url("/static/icons/bill-shopping-bag.svg") center / contain no-repeat; }
.icon-swap { -webkit-mask: url("/static/icons/bill-arrow-down-up.svg") center / contain no-repeat; mask: url("/static/icons/bill-arrow-down-up.svg") center / contain no-repeat; }
.icon-kyc { -webkit-mask: url("/static/icons/bill-shield-check.svg") center / contain no-repeat; mask: url("/static/icons/bill-shield-check.svg") center / contain no-repeat; }
.icon-stake { -webkit-mask: url("/static/icons/bill-wallet.svg") center / contain no-repeat; mask: url("/static/icons/bill-wallet.svg") center / contain no-repeat; }
.icon-unstake { -webkit-mask: url("/static/icons/bill-wrench.svg") center / contain no-repeat; mask: url("/static/icons/bill-wrench.svg") center / contain no-repeat; }

.tone-earn,
.tone-swap {
  background: rgba(198, 255, 58, 0.1);
  color: #c6ff3a;
}

.tone-refer {
  background: rgba(134, 232, 31, 0.1);
  color: #86e81f;
}

.tone-bonus,
.tone-achievement,
.tone-stake {
  background: rgba(255, 184, 77, 0.12);
  color: #ffb84d;
}

.tone-topup {
  background: rgba(61, 169, 255, 0.12);
  color: #3da9ff;
}

.tone-withdraw {
  background: rgba(255, 123, 138, 0.12);
  color: #ff7b8a;
}

.tone-purchase,
.tone-kyc {
  background: rgba(70, 230, 255, 0.12);
  color: #46e6ff;
}

.tone-unstake {
  background: rgba(153, 163, 179, 0.12);
  color: #99a3b3;
}

.bill-main {
  min-width: 0;
  flex: 1;
}

.bill-title-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12rpx;
}

.bill-title {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.9);
  font-size: 25rpx;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  padding: 4rpx 10rpx;
  border-radius: 8rpx;
  background: #161b25;
  color: #99a3b3;
  font-size: 20rpx;
  font-weight: 600;
  line-height: 1.2;
}

.status-pending {
  background: rgba(255, 184, 77, 0.12);
  color: #ffb84d;
}

.status-failed {
  background: rgba(255, 123, 138, 0.12);
  color: #ff7b8a;
}

.bill-memo {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8rpx;
  margin-top: 5rpx;
  color: #747f91;
  font-size: 22rpx;
}

.bill-memo text:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dot {
  color: #4e5868;
}

.ref {
  overflow: hidden;
  max-width: 210rpx;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bill-time {
  margin-top: 4rpx;
  color: #5f6877;
  font-size: 21rpx;
}

.amount-block {
  flex: 0 0 180rpx;
  text-align: right;
}

.amount {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 7rpx;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 25rpx;
  font-weight: 760;
  letter-spacing: 0;
}

.amount text:last-child {
  color: #747f91;
  font-size: 20rpx;
  font-weight: 700;
}

.amount.positive text:first-child {
  color: #c6ff3a;
}

.amount.negative text:first-child {
  color: #ff7b8a;
}

.running {
  margin-top: 7rpx;
  color: #5f6877;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 20rpx;
  white-space: nowrap;
}

.footer-note {
  padding: 26rpx 26rpx 8rpx;
  color: #5f6877;
  font-size: 22rpx;
  line-height: 1.45;
  text-align: center;
}

.back-button::after,
uni-button.back-button::after,
.bell-button::after,
uni-button.bell-button::after,
.tabs button::after,
.tabs uni-button::after {
  border: 0;
}
</style>
