<!--
  WalletWithdraw — 提现页，按网络直管提现地址。
  Top→bottom: dev-only ?dev=1 地址重置 → 换址冻结横幅(24h 倒计时,按所选网络)→
  compliance-hold banner (P5+) → amount input (Use Max) → 网络(只读标签,来自「选择提现网络」页的
  ?network=,每网络独立当前地址)→ 地址行(掩码中段 + 「管理」入口)/ 空态引导卡(添加提现地址)
  → fee summary (single network-confirm fee row + "?" fee-why bottom sheet) → warnings →
  StakeAlternativeCard (configured minimum) → NEX offset toggle (default OFF) → sticky submit.

  Gates: 该网络已设提现地址(payout-address store 单源), 换址冻结窗口 (submit greyed),
  amount within configured withdrawable limits. Eligibility quotes the fee, optional UVT offset
  and amount received. Confirmation freezes that quote with the request and idempotency key.
  POST /api/withdrawals is authoritative for the debit, the UVT burn and
  its own ledger, so this page never touches balances (D5). It only writes the local
  bill rows (postReceiptForAccount, numbers taken from the server receipt), because the
  bills store is still the app's only user-facing ledger.
  Then → withdraw-tracking. <AppChassis active="me">.
  Header is the shared sticky <SubPageHeader> (back=/pages/me/wallet-withdraw-network, title=t.wallet.withdraw,
  subtitle="USDT").
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/wallet-withdraw-network" :title="t.wallet.withdraw" subtitle="USDT" />
      <!-- B34 提现结果找回:一处横幅,按 withdrawalRecovery.state 只换图标、标题、正文和动作;原样重新提交在底栏(handleSubmit)。 -->
      <view v-if="recoveryBanner" class="wd-recover mx-4 mb-3" :class="`wd-recover--${recoveryBanner.tone}`" data-testid="withdraw-recovery" role="status" aria-live="polite">
        <view class="wd-recover__icon" aria-hidden="true">
          <svg v-if="recoveryBanner.tone === 'pending'" class="wd-recover__spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          <svg v-else-if="recoveryBanner.tone === 'retry'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
          <svg v-else-if="recoveryBanner.tone === 'rejected'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </view>
        <view class="wd-recover__main">
          <text class="wd-recover__title">{{ recoveryBanner.title }}</text>
          <text v-for="line in recoveryBanner.lines" :key="line" class="wd-recover__body">{{ line }}</text>
          <view v-if="recoveryBanner.trackingRoute || recoveryBanner.abandon" class="wd-recover__acts">
            <view v-if="recoveryBanner.trackingRoute" class="wd-recover__act" role="button" tabindex="0" @click="navTo(recoveryBanner.trackingRoute)" @keydown.enter.prevent="navTo(recoveryBanner.trackingRoute)" @keydown.space.prevent="navTo(recoveryBanner.trackingRoute)">
              <text>{{ t.walletV3.withdrawRecoveryTrackCta }}</text>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </view>
            <view v-if="recoveryBanner.abandon" class="wd-recover__act wd-recover__act--muted" role="button" tabindex="0" :aria-disabled="abandoningAttempt || submitting || confirmingSubmit ? 'true' : 'false'" :aria-busy="abandoningAttempt" @click="abandonPendingAttempt" @keydown.enter.prevent="abandonPendingAttempt" @keydown.space.prevent="abandonPendingAttempt">
              <text>{{ abandoningAttempt ? `${t.walletV3.withdrawAbandonAttemptCta}…` : t.walletV3.withdrawAbandonAttemptCta }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- dev-only tester reset(?dev=1):清空当前账号提现地址簿,复现空态引导 -->
      <view v-if="devMode" class="mx-4 mb-3 flex items-center justify-end">
        <view class="shrink-0 inline-flex items-center active:opacity-80" :style="resetBtnStyle" role="button" tabindex="0" :aria-label="t.walletV3.resetAddrLabel" @click="handleResetAddresses"  @keydown.enter.prevent="handleResetAddresses" @keydown.space.prevent="handleResetAddresses">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
          <text style="margin-left: 4px">{{ t.walletV3.resetAddrLabel }}</text>
        </view>
      </view>

      <!-- 换址后 24h 安全冻结横幅(RM01a ⑤ 报错/极限态:盾牌 + hh:mm:ss 真倒计时) -->
      <view v-if="frozenNow" class="nx-withdraw-freeze-banner mx-4 mb-3 flex items-start" :style="freezeBannerStyle">
        <view class="grid place-items-center shrink-0" :style="freezeIconStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>
        </view>
        <view class="flex-1 min-w-0" style="margin-left: 10px">
          <text class="block" style="font-size: 12px; color: var(--v5-danger); font-weight: 500; line-height: 1.4">{{ freezeBannerText }}</text>
        </view>
      </view>

      <!-- P-45: withdrawable balance card — amount anatomy (cents and the USDT unit in ink-3) plus what is held back. -->
      <view class="wd-bal mx-4">
        <text class="wd-k">{{ t.wallet.withdrawableLabel }}</text>
        <text v-if="withdrawalFactsDisplayable" class="wd-bal__amt">{{ amountParts(formatTruncatedAmount(maxWithdrawable))[0] }}<text class="wd-dec">{{ amountParts(formatTruncatedAmount(maxWithdrawable))[1] }}</text><text class="wd-unit">{{ '\u00A0USDT' }}</text></text>
        <text v-else class="wd-bal__amt">—</text>
        <view v-if="withdrawalFactsDisplayable && heldBuckets" class="wd-locks">
          <view class="wd-locks__i"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg><text>{{ t.wallet.heldReviewChip }}</text><text class="wd-locks__v">{{ formatTruncatedAmount(heldBuckets.review) + '\u00A0USDT' }}</text></view>
          <view class="wd-locks__i"><text>{{ t.wallet.heldLockedChip }}</text><text class="wd-locks__v">{{ formatTruncatedAmount(heldBuckets.locked) + '\u00A0USDT' }}</text></view>
          <text>{{ t.wallet.heldNotYet }}</text>
        </view>
        <view v-if="withdrawalFactsDisplayable && app.user.usdtBalance < 0" class="wd-debt" role="note"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg><text>{{ fmt(t.me.walletDebtNote, { amount: formatTruncatedAmount(-app.user.usdtBalance) }) }}</text></view>
      </view>

      <!-- Amount on a liquid-glass slab over the aura; the minimum sits right under it. -->
      <view class="wd-stage mx-4">
        <view class="wd-aura" aria-hidden="true"><view /><view /></view>
        <view class="wd-slab nx-tint">
          <view class="wd-slab__head">
            <text class="wd-k">{{ t.wallet.amountLabel }}</text>
            <view class="wd-max" role="button" tabindex="0" :aria-disabled="inputsLocked || !withdrawalActionsFresh" :aria-label="t.wallet.useMax" @click="useMax"  @keydown.enter.prevent="useMax" @keydown.space.prevent="useMax">
              <text>{{ t.wallet.useMax }}</text>
            </view>
          </view>
          <view class="wd-amtrow">
            <input class="wd-amtrow__input" :style="{ width: `calc(${Math.max(amount.length, 4)} * (1ch - .02em) + 4px)` }" type="text" inputmode="decimal" :value="remoteSessionReady ? amount : ''" :placeholder="remoteSessionReady ? '0.00' : ''" :aria-label="t.wallet.amountLabel" :disabled="inputsLocked" @input="onAmount" />
            <text class="wd-amtrow__unit">USDT</text>
          </view>
          <view class="wd-k wd-min"><text v-if="withdrawalFactsDisplayable">{{ minAmountLine }}</text><text v-else>—</text></view>
          <text v-if="(withdrawalFactsNeedsRetry || (!withdrawalQuoteRefreshing && !withdrawalActionsFresh))
            && !(submitHintVisible && !submitting && submitDisabledReason === withdrawalReadStatusText)"
            class="wd-line" role="status">{{ withdrawalReadStatusText }}</text>
          <text v-if="withdrawalFactsDisplayable && withdrawalRatioLine" class="wd-line">{{ withdrawalRatioLine }}</text>
          <text v-if="withdrawalFactsDisplayable && withdrawalPolicy && limitFacts.perWithdrawalMaximum < maxWithdrawable" class="wd-line">{{ perWithdrawalLimitText }}</text>
        </view>
      </view>

      <!-- 审核提示(小额免审线为 0,每笔都审核):只说结果和去哪看,不说判定机制;拒绝路由仍写它自己的标题和原因。 -->
      <view v-if="reviewNoticeVisible" class="wd-notice mx-4" :style="holdBannerStyle" role="status">
        <view class="wd-notice__icon grid place-items-center shrink-0" :style="holdIconStyle" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="10" /></svg>
        </view>
        <view class="wd-notice__main">
          <text v-if="rejectNotice" class="wd-notice__title">{{ riskNoticeTitle }}</text>
          <text class="wd-notice__t" :class="{ 'wd-notice__t--sub': rejectNotice }">{{ rejectNotice ? riskNoticeBody : reviewNoticeText }}</text>
        </view>
      </view>

      <!-- 收款信息卡:网络只读标签(在「选择提现网络」页选定)+ 当前网络地址掩码 + 「管理」;未设置 → 卡内引导(RM01a ③⑤) -->
      <view class="wd-route mx-4">
        <view class="wd-route__r">
          <text class="wd-k wd-route__k">{{ t.wallet.networkLabel }}</text>
          <text class="wd-net" data-testid="withdraw-network-tag">{{ remoteSessionReady ? network.slice(5) : '—' }}</text>
          <text v-if="remoteSessionReady" class="wd-route__note">{{ networkHint(network) }}</text>
        </view>
        <view class="wd-route__r">
          <text class="wd-k wd-route__k">{{ t.wallet.withdrawAddressLabel }}</text>
          <text v-if="!remoteSessionReady" class="wd-route__a wd-route__a--empty">—</text>
          <text v-else-if="pendingAttempt" class="wd-route__a">{{ boundAddressShort }}</text>
          <text v-else-if="payoutReadStatus === 'error'" class="wd-route__a wd-route__a--empty wd-route__a--error" role="status">{{ payoutReadCopy.addressUnavailable }}</text>
          <text v-else-if="payoutReadStatus !== 'ready'" class="wd-route__a wd-route__a--empty">—</text>
          <text v-else-if="boundAddress" class="wd-route__a">{{ boundAddressShort }}</text>
          <text v-else class="wd-route__a wd-route__a--empty">{{ t.addrRebind.emptyGuideTitle }}</text>
          <view
            v-if="remoteSessionReady && !pendingAttempt && payoutReadStatus === 'ready' && boundAddress"
            class="nx-withdraw-manage-entry wd-manage nx-frosted-button"
            role="button" tabindex="0"
            :aria-label="t.addrRebind.manageCta"
            @click="goManage"
            @keydown.enter.prevent="goManage" @keydown.space.prevent="goManage"
          >
            <text>{{ t.addrRebind.manageCta }}</text>
          </view>
        </view>
        <!-- 空状态引导(一次设置长期使用;非报错态) -->
        <view v-if="remoteSessionReady && !pendingAttempt && payoutReadStatus === 'ready' && !boundAddress" class="wd-route__guide">
          <text class="wd-route__guide-body">{{ t.addrRebind.emptyGuideBody }}</text>
          <view class="nx-withdraw-add-address-cta wd-add nx-frosted-button" role="button" tabindex="0" :aria-label="t.addrRebind.addCta" @click="goManage"  @keydown.enter.prevent="goManage" @keydown.space.prevent="goManage">
            <text>{{ t.addrRebind.addCta }}</text>
          </view>
        </view>
      </view>
      <text v-if="withdrawalChannelStatusText" class="wd-note mx-4">{{ withdrawalChannelStatusText }}</text>

      <!-- Summary: gross fee → NEX offset → net fee → receive (de-carded to floor) -->
      <!-- FEAT-WD01c ⑤ 明细区四态。费率不可用时不渲染数字，由策略读取自动恢复。 -->
      <!-- 明细井:网络确认费 → UVT 抵扣开关 → 实际到账(画板顺序);各态条件与原先一致。 -->
      <!-- Why 提交 is grey is said once, above it in the bar (03 §3.1); the well shows the fee row with 「—」 instead of repeating it
           (06 §6.1). With no withdrawal network open at all the well has nothing left to show. -->
      <view v-if="(withdrawalPolicyCurrent && !(networkClosed && !pendingAttempt && NETWORKS.length === 0)) || (feeConfigUsable && amountNum > 0 && !quoteBlocked)" class="wd-fee mx-4">
      <template v-if="withdrawalPolicyCurrent">
      <view v-if="withdrawalPolicyLoading" class="wd-fee__sk">
        <view v-for="i in 3" :key="i" class="flex items-center justify-between">
          <view :style="feeSkeletonLabelStyle" />
          <view :style="feeSkeletonValueStyle" />
        </view>
      </view>
      <view v-else-if="networkClosed && !pendingAttempt" class="wd-fee__msg">
        <view v-if="NETWORKS.length > 0" class="wd-link" role="button" tabindex="0" @click="chooseNetworkAgain" @keydown.enter.prevent="chooseNetworkAgain" @keydown.space.prevent="chooseNetworkAgain">
          <text>{{ t.bankWithdrawal.rechooseNetwork }}</text>
        </view>
      </view>
      <view v-else-if="!feeConfigUsable" class="wd-fee__msg"
        v-show="!(submitHintVisible && !submitting && submitDisabledReason === t.walletV3.submitReasonFeeConfigUnavailable)">
        <view class="flex items-center justify-between">
          <text class="wd-warn">{{ t.walletV3.feeConfigUnavailableTitle }}</text>
        </view>
        <text class="wd-line">{{ t.walletV3.feeConfigUnavailableBody }}</text>
      </view>
      <!-- 空状态:金额未输入 —— 给占位说明,不留空白也不显示 $0.00 假明细 -->
      <view v-else-if="amountNum <= 0" class="wd-fee__msg">
        <text class="wd-line">{{ t.walletV3.feeDetailPlaceholder }}</text>
      </view>
      <!-- FEAT-WD02:单行网络确认费(每笔固定;$0 显示 $0.00 不藏行)。「?」打开费用说明半屏。 -->
      <view v-else class="wd-fee__r">
        <view class="inline-flex items-center" style="gap: 2px">
          <text class="wd-k">{{ t.walletV3.feeConfirmRow }}</text>
          <view class="grid place-items-center active:opacity-60" style="min-width: 44px; min-height: 44px; flex-shrink: 0" role="button" tabindex="0" :aria-label="t.walletV3.feeWhyTitle" @click="feeWhyOpen = true"  @keydown.enter.prevent="feeWhyOpen = true" @keydown.space.prevent="feeWhyOpen = true">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
          </view>
        </view>
        <text class="wd-fee__v">{{ activeQuote ? '−' + formatTruncatedAmount(activeQuote.networkFee) + '\u00A0USDT' : '—' }}</text>
      </view>
      </template>
      <!-- NEX 抵扣开关(FEAT-WD02:用户自选,默认关)。🔴 费率不可用时整块隐藏:凡是吃费用数据的区块都挂 feeConfigUsable 门。 -->
      <view v-if="feeConfigUsable && amountNum > 0 && !quoteBlocked" class="wd-fee__offset">
        <view class="wd-fee__r">
          <text class="wd-k">{{ t.walletV3.feeOffsetToggle }}</text>
          <!-- 自绘开关(禁用原生 button/switch 元素,uni 默认样式过重):外层 44pt 热区,内层 track+knob。
               NEX=0 置灰不可开,原因写在下方 hint + 去赚 NEX 入口。 -->
          <view
            class="nx-fee-offset-switch grid place-items-center shrink-0"
            role="switch"
            :aria-checked="offsetWithNex ? 'true' : 'false'"
            :aria-disabled="inputsLocked || (offsetToggleDisabled && !offsetWithNex) ? 'true' : 'false'"
            :aria-label="t.walletV3.feeOffsetToggle"
            tabindex="0"
            :style="switchHitStyle"
            @click="toggleOffset"

            @keydown.enter.prevent="toggleOffset" @keydown.space.prevent="toggleOffset"
          >
            <NxSwitch :checked="offsetWithNex" />
          </view>
        </view>
        <text class="wd-fee__hint">{{ offsetHintText }}</text>
        <!-- NEX=0:开关置灰 + 去赚 NEX 入口(复用 earn 路由;去了再回来,页面实例保留,开关状态不丢) -->
        <view v-if="offsetToggleDisabled" class="wd-link" role="button" tabindex="0" :aria-label="t.walletV3.earnNexCta" @click="goEarnNex"  @keydown.enter.prevent="goEarnNex" @keydown.space.prevent="goEarnNex">
          <text class="nx-after-arrow">{{ t.walletV3.earnNexCta }}</text>
        </view>
      </view>
      <template v-if="withdrawalPolicyCurrent && feeDetailReady">
        <view v-if="nexBurned > 0 || (offsetWithNex && !activeQuote)" class="wd-fee__r">
          <text class="wd-k wd-k--brand">{{ t.walletV3.feeOffsetRow }}</text>
          <text class="wd-fee__v wd-fee__v--brand">{{ activeQuote ? '+' + formatTruncatedAmount(feeWaived) + '\u00A0USDT · ' + fmtNex(nexBurned) + '\u00A0UVT' : '—' }}</text>
        </view>
        <view v-if="offsetWithNex" class="wd-fee__r">
          <text class="wd-k">{{ t.walletV3.feeCharged }}</text>
          <text class="wd-fee__v" :class="{ 'wd-fee__v--brand': activeQuote && fee === 0 }">{{ activeQuote ? chargedFeeText : '—' }}</text>
        </view>
        <view class="wd-fee__r wd-fee__r--net">
          <text class="wd-k">{{ t.wallet.receiveLabel }}</text>
          <text v-if="activeQuote" class="wd-fee__net">{{ amountParts(formatTruncatedAmount(receive))[0] }}<text class="wd-dec">{{ amountParts(formatTruncatedAmount(receive))[1] }}</text><text class="wd-unit">{{ '\u00A0USDT' }}</text></text>
          <text v-else class="wd-fee__net">—</text>
        </view>
      </template>
      </view>

      <!-- 当日额度:圆点 = 每日笔数(已用为实心);「有没有这句话」与「闸生不生效」同一个条件(limitCount ≤0 不显示)。
           「提现说明 ›」在这一行右端,放不下时整个链接换到下一行右对齐;没有额度句时这一行只有链接。 -->
      <template v-if="withdrawalPolicyCurrent">
        <view v-if="(dailyFactsDisplayable && limitFacts.dailyLimitConfigured) || rulesReady" class="wd-quota mx-4">
          <view v-if="dailyFactsDisplayable && limitFacts.dailyLimitConfigured" class="wd-quota__use">
            <view v-for="i in Math.min(dailyFacts.limitCount, 10)" :key="i" class="wd-quota__pip" :class="{ 'wd-quota__pip--used': i <= limitFacts.dailyUsedCount }" aria-hidden="true" />
            <text>{{ dailyUsageText }}</text>
          </view>
          <NxButton v-if="rulesReady" class="wd-rules-link" variant="link" icon="chevron-right" :label="t.walletV3.withdrawRules.title" aria-haspopup="dialog" @click="rulesOpen = true" />
        </view>
      </template>

      <!-- Reverse-talk staking alternative -->
      <StakeAlternativeCard v-if="amountNum > 0 && amountNum >= minWithdrawable && !quoteBlocked && !remoteEligibilityFailed" :amount-num="amountNum" />

      <!-- 费用说明:用户点「?」主动查看的说明,底部 sheet(03 §3.5.1 选择级),共享 NxSheet 的标题、圆形关闭和退出。 -->
      <NxSheet :open="feeWhyOpen" :title="t.walletV3.feeWhyTitle" @close="feeWhyOpen = false">
        <view class="wd-why">
          <view class="wd-why__i"><text class="wd-why__t">{{ t.walletV3.feeWhyNetworkTitle }}</text><text class="wd-why__d">{{ t.walletV3.feeWhyNetworkBody }}</text></view>
          <view class="wd-why__i"><text class="wd-why__t">{{ t.walletV3.feeWhyOffsetTitle }}</text><text class="wd-why__d">{{ t.walletV3.feeWhyOffsetBody }}</text></view>
        </view>
      </NxSheet>

      <!-- 提现说明(只读):居中弹窗,只有正文滚动,「确认」关闭。提交时同样的条目放进提交确认框(handleSubmit)。 -->
      <NxNoticeDialog :open="rulesOpen && rulesReady" :title="t.walletV3.withdrawRules.title" :primary="t.ui.confirm" icon="none" scroll-body dismissible focus-title
        @primary="rulesOpen = false" @dismiss="rulesOpen = false">
        <NxRulesList :items="rulesItems" />
      </NxNoticeDialog>

      <view class="wd-bar-space" :style="barTrayHeight ? { height: barTrayHeight - 2 + 'px' } : undefined" />
    </view>
    <!-- 主操作在底部固定栏(DS-30);不可提交时原因写在按钮上方。 -->
    <template #pageFixed>
      <view ref="barTray" class="wd-bar nx-glass-bar">
        <text v-if="!canSubmitAction && !submitting && submitHintVisible" class="wd-bar__why nx-tray-note" role="status">{{ submitDisabledReason }}</text>
        <!-- The shared primary (03 §3.1 bottom bar): grey while it cannot submit, spinner with the width held while submitting. -->
        <NxButton class="nx-withdraw-submit-cta" variant="primary" :label="pendingAttempt ? (canRetryPendingAttempt ? t.walletV3.withdrawResendCta : t.walletV3.withdrawRecoveryWaitCta) : canSubmitAction ? t.walletV3.submitCtaPaired : t.walletV3.submitCtaDisabled"
          :busy="submitting" :busy-label="t.wallet.submitChecking" :disabled="!canSubmitAction" @click="handleSubmit" />
      </view>
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { useTrayHeight } from "@/composables/use-tray-height";
import { formatDisplayDateTime } from "@/lib/display-date";
import { formatFinanceAmount as formatAmount } from "@/lib/finance-amount-display";
import { formatGroupedAmount, formatTruncatedAmount } from "@/lib/amount-display";
import { ref, computed, onUnmounted, watch, type CSSProperties } from "vue";
import { platformDayIndex } from "@/store/withdrawal-eligibility-core";
import { foregroundReadAllowed } from "@/lib/foreground-read";
import { onLoad, onShow, onHide } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import StakeAlternativeCard from "@/components/me/stake-alternative-card.vue";
import NxButton from "@/components/ui/nx-button.vue";
import NxSheet from "@/components/ui/nx-sheet.vue";
import NxSwitch from "@/components/ui/nx-switch.vue";
import NxNoticeDialog from "@/components/ui/nx-notice-dialog.vue";
import NxRulesList from "@/components/ui/nx-rules-list.vue";
import { USDT_WITHDRAWAL_DISPLAY_MAX } from "@/lib/withdrawal-display-limits";
import { canSelectNewUsdtNetwork } from "@/lib/usdt-network-options";
import { useT } from "@/i18n/use-t";
import { dateLocale, fmt } from "@/i18n/format";
import { geoPolicyUserMessage } from "@/api/geo-policy-error";
import { forgetWithdrawAttempt, newWithdrawKey, readWithdrawAttempt, rememberWithdrawAttempt, type WithdrawAttempt } from "@/lib/withdraw-attempt";
import { createAbortController } from "@/lib/abort-controller-compat";
import { navBack, navTo, takeNavigationQuery } from "@/lib/route";
import { normalizeReviewWindowDays, normalizeSlaHours } from "@/store/withdrawal-arrival-core";
import { computeWithdrawalMaximum, formatWithdrawalRatioPercent, resolveWithdrawalUseMax } from "@/lib/withdrawal-use-max";
import { withdrawalLimitFacts } from "@/lib/withdrawal-limit-facts";
import { financialFactState, shouldRequestWithdrawalEligibility, withdrawalFactsActionsFresh } from "@/lib/withdrawal-facts-state";
import { isCurrentWithdrawalFactsRequest } from "@/lib/withdrawal-facts-request-fence";
import { riskReasonLines } from "@/lib/risk-reason-text";
import { useApp } from "@/store/app";
import { earningsReleaseHasSnapshot, earningsReleaseSnapshot, earningsReleaseStatus, refreshEarningsReleaseStatus } from "@/store/earning-release";
// 账单不再直连 useBills:提现的钱由服务端扣,只补收据 —— 走 postReceiptForAccount
// (postMoneyBill 会照 draft 符号再扣一次本地余额)。分录形状由 withdrawalBillDrafts 单源构造。
import { postReceiptForAccount } from "@/lib/money-receipt";
import { withdrawalBillDrafts } from "@/lib/withdrawal-bill-drafts";
import { usePayoutAddress } from "@/store/payout-address";
import { useFinanceReviewCopy } from "@/lib/finance-review-copy";
import { fundsServerEnabled, remoteApiEnabled, sessionVault, withdrawalApi } from "@/api/runtime";
import { binarySessionReady } from "@/lib/binary-session-ready";
import { useAuth } from "@/store/auth";
import { captureRuntimeRevision, isCurrentRuntimeRevision, subscribeRuntimeRevision } from "@/api/order-api";
import { formatClock, freezeRemainingMs, fromWithdrawNetwork, maskAddressMid } from "@/store/payout-address-core";
import { mockServerNow } from "@/store/server-time";
import { evaluateWithdrawal, requestWithdrawalEligibility, type WithdrawalEligibility } from "@/store/withdrawal-eligibility";
import { useProductPhase } from "@/composables/use-product-phase";
import { confirm as uiConfirm, toast, type RuleItem } from "@/store/ui";
import type { Withdrawal } from "@/store/types";
type CryptoNetwork = Exclude<Withdrawal["network"], "BANK-VND">;

// Submission failures share the exact refusal and original-attempt policy below.
import { ApiError } from "@/api/errors";
import { triageWithdrawFailure } from "@/lib/withdraw-failure-triage";
import { WithdrawalQuoteChangedError, type WithdrawalAttemptReadResult, type WithdrawalPolicy, type WithdrawalQuote } from "@/api/withdrawal-api";

const ALL_NETWORKS: { id: CryptoNetwork; label: string }[] = [
  { id: "USDT-TRC20", label: "TRC20" },
  { id: "USDT-BEP20", label: "BEP20" },
  { id: "USDT-ERC20", label: "ERC20" },
];

const t = useT();
const app = useApp();
const auth = useAuth();
// H5 restores its session before this page knows which account's attempt it must render.
// Reuse the protected-read gate for both loading that command and showing the form.
const remoteSessionReady = computed(() => binarySessionReady({
  remote: remoteApiEnabled,
  authenticated: auth.isAuthenticated,
  accountId: auth.accountId,
  appAccountKey: app.accountKey,
  sessionUserId: sessionVault.read()?.user.userId ?? null,
}));
const payout = usePayoutAddress();
const payoutReadStatus = computed(() => payout.readStatusFor(app.accountKey));
const payoutReadCopy = useFinanceReviewCopy();
const phase = useProductPhase();
const withdrawalPolicy = ref<WithdrawalPolicy | null>(null);
const withdrawalPolicyLoading = ref(false);
const withdrawalPolicyError = ref("");
let withdrawalPolicyRefreshSequence = 0;
const pendingAttempt = ref(remoteSessionReady.value ? readWithdrawAttempt(app.accountKey) : null);
const abandoningAttempt = ref(false);
const WITHDRAWAL_RECOVERY_INTERVAL_MS = 5000;
type RecoveredWithdrawal = { state: "COMMITTED"; withdrawalNo: string; trackingRoute: string; noticePending: boolean };
type WithdrawalRecovery = Exclude<WithdrawalAttemptReadResult, { state: "COMMITTED" }>
  | RecoveredWithdrawal | { state: "CHECKING" | "READ_FAILED" };
const recoveryResult = ref<{ key: string; outcome: WithdrawalRecovery } | null>(null);
const withdrawalRecoveryRuntimeEpoch = ref(0);
const withdrawalRecovery = computed<WithdrawalRecovery | null>(() => {
  const pending = pendingAttempt.value;
  if (!pending) return recoveryResult.value?.outcome ?? null;
  return recoveryResult.value?.key === pending.key ? recoveryResult.value.outcome : { state: "CHECKING" };
});
const canRetryPendingAttempt = computed(() => withdrawalPageVisible.value && foregroundReadAllowed()
  && remoteSessionReady.value && pendingAttempt.value !== null && withdrawalRecovery.value?.state === "NOT_SEEN");

const announcedWithdrawalNos = new Set<string>();

function takeRecoveredWithdrawalNotice(): { withdrawalNo: string; trackingRoute: string } | null {
  const result = recoveryResult.value;
  const outcome = withdrawalRecovery.value;
  if (!withdrawalPageVisible.value || !foregroundReadAllowed() || !remoteSessionReady.value
    || !result || outcome?.state !== "COMMITTED" || !outcome.noticePending) return null;
  recoveryResult.value = { key: result.key, outcome: { ...outcome, noticePending: false } };
  announcedWithdrawalNos.add(outcome.withdrawalNo);
  return { withdrawalNo: outcome.withdrawalNo, trackingRoute: outcome.trackingRoute };
}

// ── B34 视觉:找回横幅(只做呈现,不改找回逻辑) ──
// 追踪页入栈时保留本页实例，onHide 收起一次性提示，返回时只显示追踪入口。
const recoveredWithdrawalNotice = ref<{ withdrawalNo: string; trackingRoute: string } | null>(null);
watch(withdrawalRecovery, (outcome) => {
  if (outcome?.state === "COMMITTED") {
    if (outcome.noticePending) recoveredWithdrawalNotice.value = takeRecoveredWithdrawalNotice();
  } else {
    recoveredWithdrawalNotice.value = null;
  }
});
// 服务端拒绝原因 → 九语一句话;风控类与未列出的原因不写原因,只给通用收尾句。
const RECOVERY_REASON_COPY: Record<string, "withdrawRecoveryReasonAbandoned" | "withdrawRecoveryReasonDailyLimit"
  | "withdrawRecoveryReasonPaused" | "withdrawRecoveryReasonAddress" | "withdrawRecoveryReasonAmount"
  | "withdrawRecoveryReasonFee" | "withdrawRecoveryReasonBank"> = {
  WITHDRAWAL_ATTEMPT_ABANDONED: "withdrawRecoveryReasonAbandoned",
  WITHDRAWAL_DAILY_LIMIT_EXCEEDED: "withdrawRecoveryReasonDailyLimit",
  WITHDRAWAL_KILL_SWITCH_DISABLED: "withdrawRecoveryReasonPaused",
  WITHDRAWAL_NETWORK_DISABLED: "withdrawRecoveryReasonPaused",
  WITHDRAWAL_PAYOUT_ADDRESS_REQUIRED: "withdrawRecoveryReasonAddress",
  WITHDRAWAL_PAYOUT_ADDRESS_CHANGE_PENDING: "withdrawRecoveryReasonAddress",
  WITHDRAWAL_PAYOUT_ADDRESS_MISMATCH: "withdrawRecoveryReasonAddress",
  WITHDRAWAL_ADDRESS_INVALID: "withdrawRecoveryReasonAddress",
  WITHDRAWAL_BALANCE_LIMIT_EXCEEDED: "withdrawRecoveryReasonAmount",
  WITHDRAWAL_RELEASE_BUCKET_INSUFFICIENT: "withdrawRecoveryReasonAmount",
  WITHDRAWAL_MIN_AMOUNT_NOT_MET: "withdrawRecoveryReasonAmount",
  WITHDRAWAL_NET_AMOUNT_INVALID: "withdrawRecoveryReasonAmount",
  WITHDRAWAL_AMOUNT_INVALID: "withdrawRecoveryReasonAmount",
  WITHDRAWAL_POLICY_VERSION_CONFLICT: "withdrawRecoveryReasonFee",
  BANK_WITHDRAWAL_UNRESOLVED_INTENT: "withdrawRecoveryReasonBank",
};
// 「放弃」只在可能长期停住的状态出现(UNKNOWN / READ_FAILED)和可原样重试时;CHECKING / PROCESSING 只说等待。
const recoveryBanner = computed<{
  tone: "pending" | "retry" | "rejected" | "done"; title: string; lines: string[]; abandon: boolean; trackingRoute: string;
} | null>(() => {
  const outcome = withdrawalRecovery.value;
  const c = t.value.walletV3;
  if (!outcome) return null;
  switch (outcome.state) {
    case "COMMITTED":
      return recoveredWithdrawalNotice.value
        ? { tone: "done", title: c.withdrawRecoveryCommittedTitle, lines: [c.withdrawRecoveryCommittedBody], abandon: false, trackingRoute: outcome.trackingRoute }
        : { tone: "done", title: c.withdrawRecoveryCommittedSeenTitle, lines: [], abandon: false, trackingRoute: outcome.trackingRoute };
    case "REJECTED": {
      const reasonKey = RECOVERY_REASON_COPY[outcome.reason];
      return { tone: "rejected", title: c.withdrawRecoveryRejectedTitle,
        lines: [reasonKey ? c[reasonKey] : "", c.withdrawRecoveryRejectedNext].filter(Boolean), abandon: false, trackingRoute: "" };
    }
    case "NOT_SEEN":
      return { tone: "retry", title: c.withdrawRecoveryNotSeenTitle, lines: [c.withdrawRecoveryNotSeenBody], abandon: !!pendingAttempt.value, trackingRoute: "" };
    default:
      return { tone: "pending", title: c.withdrawRecoveryPendingTitle,
        lines: outcome.state === "READ_FAILED" ? [c.withdrawRecoveryPendingBody, c.withdrawRecoveryReadFailed] : [c.withdrawRecoveryPendingBody],
        abandon: !!pendingAttempt.value && (outcome.state === "UNKNOWN" || outcome.state === "READ_FAILED"), trackingRoute: "" };
  }
});

function refreshPendingAttempt() {
  pendingAttempt.value = remoteSessionReady.value ? readWithdrawAttempt(app.accountKey) : null;
}
watch([() => app.accountKey, () => app.accountBindingEpoch, remoteSessionReady], () => {
  recoveryResult.value = null;
  recoveredWithdrawalNotice.value = null;
  refreshPendingAttempt();
}, { flush: "sync" });

function showWithdrawReceipt(kind: "info" | "error", key: string, title: string, body?: string) {
  const otherAttempt = pendingAttempt.value && pendingAttempt.value.key !== key;
  toast[kind](otherAttempt ? fmt(t.value.walletV3.withdrawEarlierOutcome, { outcome: title }) : title,
    otherAttempt ? [body, t.value.walletV3.withdrawOtherPending].filter(Boolean).join(" ") : body);
}

async function abandonPendingAttempt() {
  const accountKey = app.accountKey;
  const bindingEpoch = app.accountBindingEpoch;
  const runtimeScope = captureRuntimeRevision();
  const scopeIsCurrent = () => remoteSessionReady.value && app.accountKey === accountKey
    && app.accountBindingEpoch === bindingEpoch && isCurrentRuntimeRevision(runtimeScope);
  if (!scopeIsCurrent()) return;
  const pending = readWithdrawAttempt(accountKey);
  if (!pending || abandoningAttempt.value || submitting.value || confirmingSubmit.value) return;
  abandoningAttempt.value = true;
  try {
    const confirmed = await uiConfirm({
      title: t.value.walletV3.withdrawAbandonAttemptTitle,
      message: t.value.walletV3.withdrawAbandonAttemptBody,
      danger: true,
      icon: "warn",
      confirmLabel: t.value.walletV3.withdrawAbandonAttemptCta,
    });
    if (!confirmed || !scopeIsCurrent() || readWithdrawAttempt(accountKey)?.key !== pending.key) return;
    recoveryResult.value = null;
    if (remoteApiEnabled) {
      const result = await withdrawalApi.abandonAttempt({
        idempotencyKey: pending.key,
        amount: pending.amount,
        chain: pending.network,
        address: pending.address,
        policyVersion: pending.policyVersion,
        useNexFeeOffset: pending.offset,
        confirmedQuote: pending.confirmedQuote,
      });
      if (!scopeIsCurrent()) return;
      forgetWithdrawAttempt(accountKey, pending.key);
      refreshPendingAttempt();
      if (result.state === "COMMITTED") {
        showWithdrawReceipt("info", pending.key, t.value.walletV3.withdrawAbandonAlreadyCommitted);
        await app.refreshRemoteFleet();
        if (!scopeIsCurrent()) return;
        navTo(`/pages/me/wallet-withdraw-tracking?id=${encodeURIComponent(result.withdrawal.withdrawalNo)}`);
      } else {
        showWithdrawReceipt("info", pending.key, t.value.walletV3.withdrawAbandonSuccess);
      }
    } else {
      if (!scopeIsCurrent()) return;
      forgetWithdrawAttempt(accountKey, pending.key);
      refreshPendingAttempt();
      showWithdrawReceipt("info", pending.key, t.value.walletV3.withdrawAbandonSuccess);
    }
  } catch {
    if (!scopeIsCurrent()) return;
    toast.error(t.value.walletV3.withdrawOutcomeUnknownTitle, t.value.walletV3.withdrawOutcomeUnknownBody);
  } finally {
    abandoningAttempt.value = false;
  }
}
const NETWORKS = computed(() => ALL_NETWORKS.filter((item) => canSelectNewUsdtNetwork(item.id)
  && (!fundsServerEnabled || withdrawalPolicy.value?.enabledNetworks.includes(item.id))));

function isCurrentWithdrawalFactsScope(
  accountKey: string,
  accountBindingEpoch: number,
  runtimeEpoch: number,
  sequence: number,
  currentSequence: number,
): boolean {
  return isCurrentWithdrawalFactsRequest(
    { accountKey, accountBindingEpoch, runtimeEpoch, sequence },
    {
      accountKey: app.accountKey,
      accountBindingEpoch: app.accountBindingEpoch,
      runtimeEpoch: captureRuntimeRevision().epoch,
      sequence: currentSequence,
    },
  );
}

async function loadWithdrawalPolicy(): Promise<void> {
  const requestedAccountKey = app.accountKey;
  const requestedAccountBindingEpoch = app.accountBindingEpoch;
  const runScope = captureRuntimeRevision();
  const refreshSequence = ++withdrawalPolicyRefreshSequence;
  withdrawalPolicyLoading.value = true;
  withdrawalPolicyError.value = "";
  try {
    const policy = await withdrawalApi.policy();
    if (!isCurrentWithdrawalFactsScope(
      requestedAccountKey, requestedAccountBindingEpoch, runScope.epoch, refreshSequence, withdrawalPolicyRefreshSequence,
    )) return;
    withdrawalPolicy.value = policy;
  } catch (cause) {
    if (!isCurrentWithdrawalFactsScope(
      requestedAccountKey, requestedAccountBindingEpoch, runScope.epoch, refreshSequence, withdrawalPolicyRefreshSequence,
    )) return;
    withdrawalPolicy.value = null;
    // 焦虑文案收口(2026-08-15):原始 message/错误码只进日志,用户面一律人话。
    console.warn("[withdraw] policy fetch failed:", cause);
    withdrawalPolicyError.value = t.value.walletV3.submitReasonServiceUnavailable;
  } finally {
    if (isCurrentWithdrawalFactsScope(
      requestedAccountKey, requestedAccountBindingEpoch, runScope.epoch, refreshSequence, withdrawalPolicyRefreshSequence,
    )) withdrawalPolicyLoading.value = false;
  }
}

const withdrawalPolicyStatus = computed<"idle" | "loading" | "ready" | "error">(() => {
  if (withdrawalPolicyLoading.value) return "loading";
  if (withdrawalPolicyError.value) return "error";
  return withdrawalPolicy.value ? "ready" : "idle";
});
const withdrawalPolicyCurrent = computed(() => withdrawalPolicyStatus.value === "ready");
const withdrawalFactsState = computed(() => financialFactState(remoteApiEnabled, [
  { hasSnapshot: app.remoteFleetHasSnapshot, status: app.remoteFleetStatus },
  { hasSnapshot: earningsReleaseHasSnapshot.value, status: earningsReleaseStatus.value },
  { hasSnapshot: withdrawalPolicy.value !== null, status: withdrawalPolicyStatus.value },
]));
const dailyFactsState = computed(() => financialFactState(remoteApiEnabled, [
  { hasSnapshot: app.remoteFleetHasSnapshot, status: app.remoteFleetStatus },
  { hasSnapshot: earningsReleaseHasSnapshot.value, status: earningsReleaseStatus.value },
  { hasSnapshot: withdrawalPolicy.value !== null, status: withdrawalPolicyStatus.value },
  { hasSnapshot: app.remoteWithdrawalListHasSnapshot, status: app.remoteWithdrawalListStatus },
]));
const withdrawalFactsDisplayable = computed(() => withdrawalFactsState.value === "ready" || withdrawalFactsState.value === "refreshing");
const withdrawalFactsFresh = computed(() => withdrawalFactsState.value === "ready");
const withdrawalFactsRefreshing = computed(() => withdrawalFactsState.value === "refreshing");
const withdrawalFactsStale = computed(() => withdrawalFactsState.value === "stale");
const withdrawalFactsNeedsRetry = computed(() =>
  withdrawalFactsState.value === "stale"
  || withdrawalFactsState.value === "unavailable"
  || dailyFactsState.value === "stale"
  || dailyFactsState.value === "unavailable",
);
const dailyFactsDisplayable = computed(() => dailyFactsState.value === "ready" || dailyFactsState.value === "refreshing");
const dailyFactsRefreshing = computed(() => dailyFactsState.value === "refreshing");
const withdrawalQuoteRefreshing = computed(() => withdrawalFactsRefreshing.value || dailyFactsRefreshing.value);
const withdrawalActionsFresh = computed(() => withdrawalFactsActionsFresh(
  withdrawalFactsState.value,
  dailyFactsState.value,
));
function factsStatusText(state: "ready" | "loading" | "refreshing" | "stale" | "unavailable"): string {
  if (state === "loading" || state === "refreshing") return t.value.help.loadingMore;
  if (state === "stale") return t.value.wallet.fundsStaleBody;
  return t.value.wallet.fundsUnavailableTitle;
}
const withdrawalFactsStatusText = computed(() => factsStatusText(withdrawalFactsState.value));
const dailyFactsStatusText = computed(() => factsStatusText(dailyFactsState.value));
const withdrawalActionStatusText = computed(() => withdrawalFactsFresh.value ? dailyFactsStatusText.value : withdrawalFactsStatusText.value);
const withdrawalReadStatusText = computed(() => {
  const failed = [withdrawalFactsState.value, dailyFactsState.value].find(state => state === "unavailable" || state === "stale");
  return failed ? factsStatusText(failed) : withdrawalActionStatusText.value;
});

const withdrawalPageVisible = ref(false);
let withdrawalEntryReadPending = true;
async function loadWithdrawalFacts(): Promise<void> {
  // A cold H5 load drops the access token and restores it through the refresh
  // cookie; a protected read started before that restore returns AUTH_REQUIRED
  // and left this page permanently on "钱包暂时无法刷新". Wait for the same
  // account binding the other F3 pages wait for, then read.
  if (!withdrawalPageVisible.value || (remoteApiEnabled && !remoteSessionReady.value)) return;
  const accountKey = app.accountKey;
  await Promise.allSettled([
    app.refreshRemoteFleet(),
    refreshEarningsReleaseStatus(accountKey),
    app.refreshRemoteWithdrawalList(accountKey),
    loadWithdrawalPolicy(),
  ]);
}

useAutoRecovery({
  failed: () => remoteApiEnabled && app.remoteFleetStatus === "error",
  retry: () => app.refreshRemoteFleet(),
  repeatMs: 30_000,
});
useAutoRecovery({
  failed: () => remoteApiEnabled && earningsReleaseStatus.value === "error",
  retry: () => refreshEarningsReleaseStatus(app.accountKey),
  repeatMs: 30_000,
});
useAutoRecovery({
  failed: () => remoteApiEnabled && app.remoteWithdrawalListStatus === "error",
  retry: () => app.refreshRemoteWithdrawalList(app.accountKey),
  repeatMs: 30_000,
});
useAutoRecovery({
  failed: () => remoteApiEnabled && !!withdrawalPolicyError.value && !withdrawalPolicyLoading.value,
  retry: loadWithdrawalPolicy,
  repeatMs: 30_000,
});
useAutoRecovery({
  failed: () => remoteApiEnabled && payout.readStatusFor(app.accountKey) === "error",
  retry: () => payout.refreshRemote(),
  repeatMs: 30_000,
});

function invalidateWithdrawalFacts(): void {
  // A retained policy/eligibility belongs to the previous account or bearer
  // generation. Clear it before the new reads start so neither Use Max nor a
  // submit preflight can act on an old account's financial projection.
  withdrawalPolicyRefreshSequence += 1;
  withdrawalPolicy.value = null;
  withdrawalPolicyError.value = "";
  withdrawalPolicyLoading.value = false;
  remoteEligibilityEpoch += 1;
  remoteEligibility.value = null;
  remoteEligibilityFailed.value = false;
  refreshedConflictVersion = "";
  defaultNetworkSettled = false;
}

// Cold entry retries as soon as session restore binds the visible page's account.
watch([() => app.accountBindingEpoch, remoteSessionReady], ([epoch, ready], [previousEpoch]) => {
  if (epoch !== previousEpoch) invalidateWithdrawalFacts();
  if (!withdrawalPageVisible.value || !ready || !foregroundReadAllowed()) return;
  if (remoteApiEnabled) void payout.refreshRemote();
  void loadWithdrawalFacts();
}, { flush: "post" });

const stopWithdrawalFactsRuntimeWatch = subscribeRuntimeRevision((_scope, reason) => {
  if (reason === "authority" || withdrawalRecovery.value?.state === "NOT_SEEN") recoveryResult.value = null;
  withdrawalRecoveryRuntimeEpoch.value += 1;
  invalidateWithdrawalFacts();
  if (foregroundReadAllowed()) void loadWithdrawalFacts();
});

// 2026-07-31 规则变更:充值本金也可提(按标准费率收费),故可提基数 = 钱包可用余额(usdtBalance)。
// 审核中与锁定金额都在这个余额之内:EarningsReleaseService.creditInternal 对每个分桶都记入钱包,所以这里要减掉
// (后端 withdrawableAmount = 钱包可用 − pending_review − bonus_locked,比例在下方 maxWithdrawable 施加)。
// 注意:这里读 usdtBalance 是本规则的正解。历史 P0(可提额度 > 总余额仍放行)的防线
// 已随 c37e642 的本地扣款链一并移除 —— **提交路径**上客户端不再扣款,超额请求由本
// computed 的 fail-closed 上限拦 + 服务端 reservation 拒;别再指望 app.ts 的提交函数里
// 有总余额门(建单**成功之后**的 applyWithdrawalDebit 另有一道扣款闸,那是另一段链)。
const preRatioWithdrawable = computed(() => {
  if (earningsReleaseSnapshot.value?.clusterRestricted) return 0;
  const buckets = earningsReleaseSnapshot.value?.buckets;
  if (!buckets) return 0;
  return Math.max(0, app.user.usdtBalance - buckets.pending_review - buckets.bonus_locked);
});
const maxWithdrawable = computed(() => {
  const ratio = withdrawalPolicy.value?.balanceMaxRatio ?? 0;
  return computeWithdrawalMaximum(preRatioWithdrawable.value, ratio);
});
const minWithdrawable = computed(() => withdrawalPolicy.value?.minAmount ?? 0);
const withdrawalRatioLine = computed(() => {
  const ratio = withdrawalPolicy.value?.balanceMaxRatio ?? 0;
  const held = Math.max(0, preRatioWithdrawable.value - maxWithdrawable.value);
  if (ratio <= 0 || ratio >= 0.999999 || held <= 0.000001) return "";
  return fmt(t.value.wallet.withdrawalRatioLine, {
    pct: formatWithdrawalRatioPercent(ratio),
    held: formatTruncatedAmount(held),
  });
});
/**
 * 🔴 日限的两件事实**只从这一个地方取**,文案与闸共用它 —— 说的那个 N 和拦人用的 N
 * 必须字面同源。此前文案取服务端 policy、判定取本地 config.withdrawRules(远端同步
 * 压根不覆盖 withdrawRules,永远是前端写死的 1):服务端配 3 笔而客户端按 1 笔拦,
 * 用户被自己的 App 挡在门外(z1 审计 P0-1 回源时发现的第二处缺陷)。
 *
 * 笔数不在这里算:把 app.withdrawals 原件交给 core 现算(平台日 UTC+7),
 * 页面不许自己 filter —— 判定留在 core 才有行为门覆盖得到。
 *
 * policy 取不到 → limitCount = 0 → 既有规则「上限 ≤0 视为未配置」→ 不限制。
 * 这个方向是**故意**的:后端不可达时宁可放行让服务端去拒,也不能把提现锁死。
 */
const dailyFacts = computed(() => ({
  limitCount: withdrawalPolicy.value?.dailyLimitCount ?? 0,
  withdrawals: app.withdrawals,
}));
const limitFacts = computed(() => withdrawalLimitFacts({
  perWithdrawalMaximum: maxWithdrawable.value,
  dailyLimitCount: dailyFacts.value.limitCount,
  withdrawals: dailyFacts.value.withdrawals,
  now: nowTick.value,
}));
const perWithdrawalLimitText = computed(() => fmt(t.value.wallet.perWithdrawalLimit, {
  amount: formatTruncatedAmount(limitFacts.value.perWithdrawalMaximum),
}));
const dailyUsageText = computed(() => fmt(t.value.wallet.dailyWithdrawalUsage, {
  used: String(limitFacts.value.dailyUsedCount),
  remaining: String(limitFacts.value.dailyRemainingCount ?? 0),
  limit: String(dailyFacts.value.limitCount),
}));
const withdrawalChannelStatusText = computed(() => {
  const policy = withdrawalPolicy.value;
  if (!policy) return "";
  // Only a closed channel needs a line; the chosen network is already the tag above.
  return !policy.withdrawalEnabled || policy.enabledNetworks.length === 0 ? t.value.wallet.withdrawalChannelsClosed : "";
});
/**
 * 🔴🔴 同一笔提现意图的幂等键(跨重试复用)。
 *
 * 同一笔意图重试要复用同一把键,让服务端的幂等去重生效(否则超时重试 = 第二笔真出账);
 * 而**换了任何一样「用户在要什么」的东西,就是另一笔意图**,必须换键。
 *
 * 签名 = 账号 | 网络 | 金额 | **收款地址** | NEX 抵扣开关。
 *
 * 🗑 **这条内存签名轨已于 2026-08-12 合并收口时删除**,只留下面这段判断。
 * 它与 `lib/withdraw-attempt` 的落盘轨是同一件事的两套实现:内存轨活不过刷新页面,
 * 而「请求在途时被杀进程 / 刷页面」正是这条链要兜住的那一刻。删除时
 * `currentIdempotencyKey()` 已零调用,`clearSubmitIntent()` 只清一份没人读的 ref。
 *
 * 🔴 两条判断必须接住,不许跟着代码一起消失:
 *
 * ① **policyVersion 不该改变「这是不是同一笔意图」**。旧轨把它排除在签名之外;
 *    新轨更强 —— 连同整个请求体一起冻结落盘,重放逐字节相同。殊途同归,
 *    都是为了不让后台的发布节奏在最不该换键的那一刻把键换掉。
 *
 * ② **换了收款地址,旧轨算「另一笔意图」,新轨不算** —— 这是一处**已知的口径变更**,
 *    不是遗漏,两条路各有各的风险:
 *      · 旧轨:改地址 → 换键 → 新单。风险是上一笔若已落库,**两笔都会出账**;
 *        且客户端拿新地址渲染、服务端按旧键返回旧地址那一单,界面与钱流向对不上。
 *      · 新轨:改地址 → 重放仍发**冻结的旧地址**。风险是钱打到用户已经放弃的地址。
 *    取新轨:重复出账不可逆,而旧地址在换绑之前本来就是用户自己确认过的收款地址,
 *    且重发弹窗会把那个冻结地址(掩码)原样展示出来再确认一次。
 *    2026-08-16 已补齐出口：页面调用服务端 abandon/readback；只有服务端确认
 *    ABANDONED 才清理本地尝试，若已 COMMITTED 则跳转真实订单，网络不确定继续保留。
 */

/** Daily-limit copy context; triage also requires the exact server 409 envelope. */
function isDailyLimitRejection(err: unknown): boolean {
  const msg = err instanceof ApiError ? err.message : "";
  if (!msg) return false;
  const upper = msg.toUpperCase();
  return upper.includes("DAILY_LIMIT") || upper.includes("DAILY_COUNT") || upper.includes("WITHDRAW_LIMIT_EXCEEDED");
}
// 今日笔数用完时的提示 + 下次可提时刻(平台日边界,按用户本地时钟展示)
const dailyLimitReachedText = computed(() => {
  // 🔴 给「MM-DD HH:mm」绝对时刻,不写「明日」。平台日按越南时区(UTC+7)切,
  // 用户本地时钟未必同一天 —— 独立验收实测本地 08-01 02:00 时重置点也在 08-01,
  // 文案却说「明日」。绝对时刻在任何时区都不会说错。
  const stamp = formatDisplayDateTime(eligibility.value.dailyCountResetAt, dateLocale());
  return fmt(t.value.walletV3.dailyLimitReached, { time: stamp });
});
// 重放时撞上日限,话术必须与首次提交不同:首次是「今天不能提了」,
// 重放是「今天不能提了,**而且先前那笔可能已经占掉了额度**」——
// 只说前半句会让用户以为先前那笔没成功,转头去开新的一笔,那正是要防的事。
const dailyLimitReachedWithPendingText = computed(() => t.value.walletV3.withdrawDailyLimitWithPending);
const minAmountLine = computed(() => fmt(t.value.wallet.minAmountDynamic, { n: formatTruncatedAmount(minWithdrawable.value) }));
const devMode = ref(false);
onLoad((options) => {
  devMode.value = import.meta.env.DEV && options?.dev === "1";
  // 网络由「选择提现网络」页带入(只读);无有效参数(深链 / 刷新 / 无栈返回)才用默认,见 settleDefaultNetwork。
  const requested = options?.network ?? new URLSearchParams(takeNavigationQuery("/pages/me/wallet-withdraw")).get("network");
  replacingHiddenNetwork = typeof requested === "string" && !canSelectNewUsdtNetwork(requested);
  const chosen = ALL_NETWORKS.find((n) => n.id === requested && canSelectNewUsdtNetwork(n.id));
  if (chosen) {
    selectedNetwork.value = chosen.id;
    networkChosen = true;
    return;
  }
  settleDefaultNetwork();
});

const amount = ref(pendingAttempt.value?.amount.toFixed(2) ?? "");
// The unresolved command owns the displayed route, including a closed network. Keep the query/default
// selection separately so resolving that command restores the ordinary network rules.
const selectedNetwork = ref<CryptoNetwork>("USDT-BEP20");
const network = computed(() => pendingAttempt.value?.network ?? selectedNetwork.value);
let networkChosen = false, defaultNetworkSettled = false, replacingHiddenNetwork = false;
// A closed network blocks new submissions; an unresolved command still has its exact replay path.
const networkClosed = computed(() => withdrawalPolicyCurrent.value && !NETWORKS.value.some((item) => item.id === network.value));
function chooseNetworkAgain() {
  if (pendingAttempt.value) return;
  navBack("/pages/me/wallet-withdraw-network");
}
// The only place that picks a network the user did not choose. Once the policy and this account's address book
// are both known it settles once: first open network with an address, else the first open one. Otherwise it only
// moves off a network the server closed. A chosen network is never touched, nor is anything changed while a submit
// is in flight.
function settleDefaultNetwork() {
  const open = NETWORKS.value;
  if (networkChosen || inputsLocked.value || open.length === 0) return;
  if (!defaultNetworkSettled && payout.readStatusFor(app.accountKey) === "ready") {
    const withAddress = replacingHiddenNetwork ? undefined : open.find((n) => payout.currentFor(fromWithdrawNetwork(n.id)));
    selectedNetwork.value = (withAddress ?? open[0]).id;
    defaultNetworkSettled = true;
  } else if (!open.some((item) => item.id === network.value)) {
    selectedNetwork.value = open[0].id;
  }
}
const chainNetwork = computed(() => fromWithdrawNetwork(network.value));
const boundAddress = computed(() => pendingAttempt.value?.address ?? payout.currentFor(chainNetwork.value)?.address ?? "");
// 掩码中段:与地址管理页共用 core.maskAddressMid 同一实现,不各写一份。
const boundAddressShort = computed(() => (boundAddress.value ? maskAddressMid(boundAddress.value) : "—"));

const amountNum = computed(() => parseFloat(amount.value) || 0);
const remoteEligibility = ref<WithdrawalEligibility | null>(null);
const remoteEligibilityFailed = ref(false);
let refreshedConflictVersion = "";
let remoteEligibilityEpoch = 0;

// ── 地址管理入口 + 换址后 24h 冻结(RM01a ⑤)──────────────────────
// 管理入口常开:在途单 / 频控拦截由地址管理页与 store 的**同一个**判据呈现
// (payout.changeBlockReason,问整张在途列表),提现页不自算第二份。
function goManage() {
  navTo(`/pages/me/wallet-address-rebind?network=${chainNetwork.value}`);
}
// 冻结倒计时(server 时钟 1s tick;归零自然放行)。
const nowTick = ref(mockServerNow());
let freezeTimer: ReturnType<typeof setInterval> | undefined;
function stopFreezeTimer() {
  if (freezeTimer !== undefined) clearInterval(freezeTimer);
  freezeTimer = undefined;
}
// 🔴 回前台 / 返回本页时重取策略。上一轮我把这条补给了追踪页,**加错页了**:
// 真正靠日限与最低额拦人的是**这一页**,而 App 端页面进栈后不销毁,不补拉就可能拿着
// 好几天前的限额判人(R2 跨端镜头点名)。loader 自带在途守卫,重复触发是安全的。
onShow(() => {
  withdrawalEntryReadPending = true;
  withdrawalPageVisible.value = true;
  stopFreezeTimer();
  nowTick.value = mockServerNow();
  freezeTimer = setInterval(() => (nowTick.value = mockServerNow()), 1000);
  refreshPendingAttempt();
});
watch([withdrawalPageVisible, foregroundReadAllowed], ([visible, allowed]) => {
  if (!visible || !allowed) return;
  if (!withdrawalEntryReadPending && app.remoteWithdrawalListHasSnapshot) {
    void app.refreshRemoteWithdrawalList();
    return;
  }
  withdrawalEntryReadPending = false;
  if (remoteApiEnabled && remoteSessionReady.value) void payout.refreshRemote();
  void loadWithdrawalFacts();
});
onHide(() => {
  withdrawalPageVisible.value = false;
  recoveredWithdrawalNotice.value = null;
  stopFreezeTimer();
});
onUnmounted(() => {
  withdrawalPageVisible.value = false;
  stopFreezeTimer();
  stopWithdrawalFactsRuntimeWatch();
});
const freezeLeftMs = computed(() => freezeRemainingMs(payout.stateFor(chainNetwork.value).freezeUntil, nowTick.value));
const frozenNow = computed(() => freezeLeftMs.value > 0);
const freezeBannerText = computed(() =>
  fmt(t.value.addrRebind.freezeBanner, { t: formatClock(freezeLeftMs.value, { hours: true }) }),
);

const complianceHoldEnabled = computed(() =>
  !pendingAttempt.value
  && (remoteEligibility.value?.complianceReviewRequired ?? withdrawalPolicy.value?.complianceHoldEnabled === true),
);
// Keep the balance hint stable while the service quote is being confirmed.
const submittingNexBalance = ref<number | null>(null);
const nexBalance = computed(() => submittingNexBalance.value ?? app.user.nexBalance);
const offsetWithNex = ref(pendingAttempt.value?.offset ?? false);
function restoreWithdrawInputs(attempt: WithdrawAttempt) {
  selectedNetwork.value = attempt.network;
  amount.value = attempt.amount.toFixed(2);
  offsetWithNex.value = attempt.offset;
}
watch(pendingAttempt, (pending, previous) => {
  if (pending) {
    amount.value = pending.amount.toFixed(2);
    offsetWithNex.value = pending.offset;
  } else if (previous) {
    amount.value = "";
    offsetWithNex.value = false;
  }
}, { flush: "sync" });
/** 按当前绑定网络取网络确认费键(网络派生自 pairing 响应式 —— 换绑回本页即时刷新)。 */
const NETWORK_FEE_KEY = {
  "USDT-TRC20": "trc20",
  "USDT-BEP20": "bep20",
  "USDT-ERC20": "erc20",
} as const;

// 🔴 费率可用性是**两个合取项**,少一个就等于回退写死值:
//   ① 配置真拉到了(!syncFailed)—— 拉取失败时 store 仍保留 DEFAULT_PLATFORM_CONFIG 种子,
//      光看值是「合法」的,只查值 = 按写死的 mock seed 算费并放行下单,正是规格禁止的回退。
//   ② 拉到的值本身合法(isNetworkFeeConfigUsable)。
// 与汇率牌价同口径:fx.ts 的 fxAvailable = !syncFailed && isFxQuoteUsable(...)。
const feeConfigUsable = computed(() => {
  const policy = withdrawalPolicy.value;
  // Replay still displays this network's fee; its original policyVersion remains the server's pricing authority.
  return policy !== null
    && (!!pendingAttempt.value || policy.enabledNetworks.includes(network.value))
    && policy.nexFeeOffsetRate > 0;
});
// 骨架条:形状对齐真实明细行(标签窄、数值宽),非通用转圈。
const feeSkeletonLabelStyle = "width: 72px; height: 12px; border-radius: 4px; background: var(--v5-surface-2)";
const feeSkeletonValueStyle = "width: 56px; height: 13px; border-radius: 4px; background: var(--v5-surface-2)";
const submittingQuote = ref<WithdrawalQuote | null>(null);
const activeQuote = computed(() => submittingQuote.value ?? (pendingAttempt.value
  ? pendingAttempt.value.confirmedQuote
  : remoteEligibility.value?.quote));
const networkConfirmUsd = computed(() => Number(activeQuote.value?.networkFee ?? 0));
const nexBurned = computed(() => Number(activeQuote.value?.nexBurned ?? 0));
const receive = computed(() => activeQuote.value?.netReceive);
const fee = computed(() => Number((amountNum.value - Number(receive.value ?? 0)).toFixed(6)));
const feeWaived = computed(() => Number((networkConfirmUsd.value - fee.value).toFixed(6)));
const chargedFeeText = computed(() => fee.value > 0 && fee.value < 0.01
  ? t.value.topupChrome.feeUnderCent : formatTruncatedAmount(fee.value) + "\u00A0USDT");
/** 开关置灰判据:没有 NEX 可抵(NEX=0 → 置灰 + 去赚 NEX 入口,规格 ② 异常1)。 */
const offsetToggleDisabled = computed(() => nexBalance.value <= 0);
function toggleOffset() {
  // 提交期间输入面全冻结(与金额输入 :disabled 同纪律 —— 开关也是报价的输入)。
  if (inputsLocked.value) return;
  // 置灰不可开:原因就写在下方 hint(NEX=0),旁边是去赚 NEX 出口。
  if (offsetToggleDisabled.value && !offsetWithNex.value) return;
  offsetWithNex.value = !offsetWithNex.value;
}
/** 开关下方的状态行:置灰原因 / 免费网络 / 关态说明 / 开态消耗数(全额或部分)。 */
const offsetHintText = computed(() => {
  if (offsetToggleDisabled.value) return t.value.walletV3.feeOffsetNoNex;
  if (!activeQuote.value) {
    return offsetWithNex.value ? "" : fmt(t.value.walletV3.feeOffsetOffHint, { n: fmtNex(nexBalance.value) });
  }
  if (networkConfirmUsd.value <= 0) return t.value.walletV3.feeOffsetFreeNetwork;
  if (!offsetWithNex.value) return fmt(t.value.walletV3.feeOffsetOffHint, { n: fmtNex(nexBalance.value) });
  if (fee.value === 0) return fmt(t.value.walletV3.feeOffsetOnFull, { nex: fmtNex(nexBurned.value) });
  return fmt(t.value.walletV3.feeOffsetOnPartial, {
    nex: fmtNex(nexBurned.value),
    waived: formatTruncatedAmount(feeWaived.value),
    rest: chargedFeeText.value,
  });
});
/** 费用说明半屏开合。 */
const feeWhyOpen = ref(false);
/**
 * 🔴 让判定**跨过时间边界时重算一次**。
 *
 * eligibility 的响应式依赖里原本没有时间(mockServerNow 就是 Date.now,不是响应源),
 * 于是两件事失灵:① 换绑冻结倒计时走到 00:00:00,顶部横幅消失了,判定却还停在 freeze ——
 * 「将进入审核」横幅把刚消失的冻结原因换个壳又说一遍,提交被一句无原因无下一步的兜底挡死;
 * ② 日限文案刚承诺「08-02 02:00 后可再提」,用户守到那一刻,判定不重算,照样拦着 —— 页面自己打自己脸。
 *
 * 但也不能直接依赖每秒 tick:evaluateWithdrawal 会同步读多行 localStorage,
 * 每秒跑一遍是白烧(输入框逐字符已经跑两遍了)。这里只取**边界穿越信号**:
 * 冻结到没到期、平台日切了没有 —— 值只在跨过边界那一刻变,变了才触发重算。
 */
const eligibilityClock = computed(() => {
  const now = nowTick.value;
  return `${freezeLeftMs.value > 0 ? 1 : 0}:${platformDayIndex(now)}`;
});
const eligibility = computed(() => {
  void eligibilityClock.value; // 建立对「时间边界」的依赖,不参与计算
  if (remoteApiEnabled) {
    return remoteEligibility.value ?? {
      canSubmit: false,
      maxWithdrawableUsdt: 0,
      route: "manual" as const,
      riskReasons: ["server-eligibility-pending"], fastLaneApplied: false, waivedGates: [], dailyLimitReached: false,
      complianceReviewRequired: false, complianceHoldApplies: false, complianceHoldDays: 0,
      dailyCountResetAt: Date.now(), configVersion: "remote-pending",
    };
  }
  return evaluateWithdrawal(app.accountKey, network.value, boundAddress.value, maxWithdrawable.value, dailyFacts.value, amountNum.value);
});
// 冻结期不重复挂风控横幅(专属冻结横幅已在顶部,避免双横幅噪声)。
const withdrawalRiskNotice = computed(
  () =>
    !pendingAttempt.value &&
    (!remoteApiEnabled || remoteEligibility.value !== null) &&
    !frozenNow.value &&
    boundAddress.value.length > 10 &&
    eligibility.value.route !== "pass" &&
    // reject 也要出横幅。它原本被排除在外,于是这条走廊上用户既看不到原因(共用地址等理由码有现成话术)、
    // 也没有下一步,全页只剩一句「当前暂不能提交」—— 而那句的语义是「等审核」,
    // 与 reject 的定义(永不建单、什么都不会发生)正好相反。
    true,
);
// SPEC-7: 提交进行中(风控校验加载态)。
const submitting = ref(false);
// FEAT-WD02 ⑥:确认弹窗在途守卫。弹窗打开期间 submitting 尚未置位,不挡的话
// 连点 CTA 会叠出第二个弹窗,两次确认 = 双重建单(mask 盖住 CTA 是第二道,这是第一道)。
const confirmingSubmit = ref(false);
const withdrawalCommandBusy = computed(() => submitting.value || confirmingSubmit.value || abandoningAttempt.value);
watch([
  withdrawalPageVisible, foregroundReadAllowed, remoteSessionReady,
  () => app.accountKey, () => app.accountBindingEpoch, () => pendingAttempt.value?.key,
  withdrawalCommandBusy, withdrawalRecoveryRuntimeEpoch,
], ([visible, foreground, ready, accountKey, bindingEpoch, key, busy], _previous, onCleanup) => {
  if (!visible || !foreground) {
    if (withdrawalRecovery.value?.state === "NOT_SEEN") recoveryResult.value = null;
    return;
  }
  if (!remoteApiEnabled || !ready || !key || busy) return;

  const attemptKey = key;
  const scope = captureRuntimeRevision();
  const controller = createAbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    controller.abort();
    clearTimeout(timer);
  });
  const isCurrent = () => !controller.signal.aborted && withdrawalPageVisible.value && foregroundReadAllowed()
    && remoteSessionReady.value && app.accountKey === accountKey && app.accountBindingEpoch === bindingEpoch
    && pendingAttempt.value?.key === attemptKey && !withdrawalCommandBusy.value && isCurrentRuntimeRevision(scope);
  const stillStored = () => {
    if (!isCurrent()) return false;
    const stored = readWithdrawAttempt(accountKey, true);
    if (stored?.key === attemptKey) return true;
    recoveryResult.value = null;
    pendingAttempt.value = stored;
    return false;
  };

  async function poll(): Promise<void> {
    try {
      const attempt = pendingAttempt.value;
      if (!attempt || !stillStored()) return;
      const result = await withdrawalApi.readAttempt(attemptKey, controller.signal);
      if (!stillStored()) return;
      if (result.state === "COMMITTED") {
        const { withdrawalNo } = result;
        const retired = forgetWithdrawAttempt(accountKey, attemptKey);
        if (withdrawalRecovery.value?.state !== "COMMITTED") {
          recoveryResult.value = { key: attemptKey, outcome: {
            state: "COMMITTED", withdrawalNo, noticePending: retired && !announcedWithdrawalNos.has(withdrawalNo),
            trackingRoute: `/pages/me/wallet-withdraw-tracking?id=${encodeURIComponent(withdrawalNo)}`,
          } };
          void app.refreshRemoteFleet();
          void app.refreshRemoteWithdrawalList(accountKey);
        }
        if (retired) {
          refreshPendingAttempt();
          return;
        }
      } else if (withdrawalRecovery.value?.state !== "COMMITTED") {
        recoveryResult.value = { key: attemptKey, outcome: result };
        if (result.state === "REJECTED") {
          forgetWithdrawAttempt(accountKey, attemptKey);
          refreshPendingAttempt();
          if (result.reasonCode === 409 && result.reason === "WITHDRAWAL_QUOTE_CHANGED" && !pendingAttempt.value) {
            recoveryResult.value = null;
            restoreWithdrawInputs(attempt);
            toast.info(t.value.walletV3.withdrawQuoteChanged);
          }
          return;
        }
      }
    } catch {
      if (isCurrent() && withdrawalRecovery.value?.state !== "COMMITTED") {
        recoveryResult.value = { key: attemptKey, outcome: { state: "READ_FAILED" } };
      }
    }
    if (isCurrent()) timer = setTimeout(() => void poll(), WITHDRAWAL_RECOVERY_INTERVAL_MS);
  }
  void poll();
}, { flush: "post" });
/**
 * 🔴 输入面冻结判据 = 账号绑定未就绪 **或** 未收口尝试 **或** 提交中 **或** 确认弹窗打开中。
 * 只看 submitting 的话,弹窗那几秒 submitting 还是 false —— 改金额的入口(输入框、
 * 「全部提现」、降额 CTA、抵扣开关)全都还活着,只靠 mask 挡手。快照已让改动动不了钱,
 * 但页面会立刻显示与刚确认的弹窗不同的数字,同一个提交出现两个口径。
 */
const inputsLocked = computed(() => !remoteSessionReady.value || !!pendingAttempt.value || submitting.value || confirmingSubmit.value);
// The default network settles as soon as the policy and address book are known, and waits out a submit.
watch([NETWORKS, () => payout.readStatusFor(app.accountKey), () => inputsLocked.value], settleDefaultNetwork);
/** 提交链结束(成功 / 任一拒单分支)统一解冻:三个状态必须成对清,漏一个页面就永久卡在冻结报价上。 */
function clearSubmitFreeze() {
  submitting.value = false;
  submittingQuote.value = null;
  submittingNexBalance.value = null;
}
// ⑤ 默认态: 审核中/锁定金额折叠展示(不参与可提最大值)。
// Held funds shown as chips on the balance card (confirming / pending release); nothing when both are zero.
const heldBuckets = computed(() => {
  const b = earningsReleaseSnapshot.value?.buckets;
  return !b || (b.pending_review <= 0 && b.bonus_locked <= 0) ? null : { review: b.pending_review, locked: b.bonus_locked };
});
// Amount anatomy: whole part and cents rendered separately so the cents can sit in ink-3.
function amountParts(text: string): [string, string] {
  const at = text.lastIndexOf(".");
  return at < 0 ? [text, ""] : [text.slice(0, at), text.slice(at)];
}
// 风控提示按命中原因给业务话术(工程码不直出;空时退回通用文案;码表单源 lib/risk-reason-text)。
// ── 🔴 小额免审快车道的**双向告知**(走查:能力在跑,但一个字都没告诉用户)──
/** 小额线(后台 D5 可配,禁写死 —— 运营调了这里必须跟着变)。 */
// Keep the server quote readable during background revalidation. An insufficient
// net amount is still a quote, and the user can adjust the amount or offset.
const quoteDisplayBlocked = computed(() =>
  !pendingAttempt.value && amountNum.value > 0
  && !withdrawalQuoteRefreshing.value
  && disabledReasonFor(amountNum.value, eligibility.value, true) !== "",
);
const quoteRowsVisible = computed(() => !!activeQuote.value || remoteEligibilityFailed.value || !!pendingAttempt.value);
const feeDetailReady = computed(() => (pendingAttempt.value || NETWORKS.value.length > 0)
  && feeConfigUsable.value && amountNum.value > 0 && !quoteBlocked.value && quoteRowsVisible.value);
const quoteBlocked = computed(() =>
  quoteDisplayBlocked.value || !withdrawalFactsDisplayable.value || !dailyFactsDisplayable.value,
);
// One review notice under the amount: the risk route's, or the policy's compliance review before the route is read.
const reviewNoticeVisible = computed(() => withdrawalRiskNotice.value || complianceHoldEnabled.value);
const rejectNotice = computed(() => withdrawalRiskNotice.value && eligibility.value.route === "reject");
// An extra compliance wait is said before submit (06 §6.5), as days only: the server's decision for this amount when read,
// else the policy guidance; the same applies-test the page used before.
const complianceHoldDays = computed(() => {
  const policy = withdrawalPolicy.value;
  if (!complianceHoldEnabled.value || !policy || amountNum.value <= 0) return 0;
  const applies = remoteEligibility.value?.complianceHoldApplies ?? amountNum.value > policy.complianceReviewThresholdUsdt;
  return normalizeReviewWindowDays(remoteEligibility.value?.complianceHoldDays ?? (applies ? policy.cooldownDays : 0));
});
const reviewNoticeText = computed(() => complianceHoldDays.value > 0
  // A full-width stop needs no space before the next sentence; Latin and Cyrillic sentences do.
  ? [t.value.walletV3.withdrawReviewNotice, fmt(t.value.walletV3.withdrawHoldNotice, { days: complianceHoldDays.value })]
    .join(t.value.walletV3.withdrawReviewNotice.endsWith("。") ? "" : " ")
  : t.value.walletV3.withdrawReviewNotice);
// ── 提现说明:只在拿到 policy 且当前网络开放时出现;金额全部读 policy(单笔最高是展示常量)。──
const rulesOpen = ref(false);
const rulesReady = computed(() => withdrawalPolicyCurrent.value && !!withdrawalPolicy.value && !networkClosed.value);
function withdrawRulesItems(net: CryptoNetwork, networkFee: number): RuleItem[] {
  const r = t.value.walletV3.withdrawRules;
  const usdt = (value: number) => `${formatGroupedAmount(value, "full")}\u00A0USDT`;
  const label = ALL_NETWORKS.find((nw) => nw.id === net)!.label;
  return [
    { title: r.amountTitle, body: r.amountBody, figures: { range: `${formatGroupedAmount(minWithdrawable.value, "full")}–${formatGroupedAmount(USDT_WITHDRAWAL_DISPLAY_MAX, "full")}\u00A0USDT` } },
    { title: r.etaTitle, body: r.etaBody },
    formatGroupedAmount(networkFee, "full") === "0"
      ? { title: r.feeTitle, body: r.feeFreeBody, values: { network: label } }
      : { title: r.feeTitle, body: r.feeBody, values: { network: label }, figures: { fee: usdt(networkFee) } },
    { title: r.addressTitle, body: r.addressBody },
    { title: r.networkTitle, body: r.networkBody, values: { network: label } },
  ];
}
const rulesItems = computed(() => rulesReady.value
  ? withdrawRulesItems(network.value, withdrawalPolicy.value!.networkConfirmFeeUsd[NETWORK_FEE_KEY[network.value]])
  : []);
/** reject = 永不建单,和「进入审核队列」是两回事,标题必须分开说。 */
const riskNoticeTitle = computed(() =>
  eligibility.value.route === "reject" ? t.value.wallet.withdrawRouteRejectTitle : t.value.wallet.withdrawRouteReviewTitle,
);
const riskNoticeBody = computed(() => {
  const lines = riskReasonLines(t.value, eligibility.value.riskReasons);
  const fallback =
    eligibility.value.route === "reject"
      ? t.value.wallet.withdrawRouteRejectBody
      : t.value.wallet.withdrawRouteReviewBody;
  return lines.length ? lines.join(" · ") : fallback;
});
/**
 * 🔴 「这笔**提交得了吗**」的唯一判据,入参是金额。
 *
 * 为什么要带入参:降额 CTA 承诺的是「改成小额线就能立刻处理」,它必须能对**假设的那个金额**
 * 问同一个问题。此前 CTA 只看 decideWithdrawalRoute 的 route,而 route **不含**日限与费率可用性
 * (core 把 dailyLimitReached 单独返回、不并进 route)—— 于是日限已达时 CTA 照样劝你改成 $50,
 * 点完什么都不会发生,还把当天唯一一次机会的金额改小了(2026-08-01 审计 P0)。
 * 两个判据只要不是同一个源,迟早漂移。这里收成一个。
 */
function disabledReasonFor(amount: number, decision: WithdrawalEligibility, forQuoteDisplay = false): string {
  if (!withdrawalActionsFresh.value) return withdrawalActionStatusText.value;
  if (withdrawalPolicyError.value) return withdrawalPolicyError.value;
  if (NETWORKS.value.length === 0) return t.value.wallet.withdrawalChannelsClosed;
  if (networkClosed.value) return t.value.bankWithdrawal.networkUnavailable;
  // 费率可读与通道开放是两个独立事实。总开关关闭时仍展示服务端报价，
  // 但提交必须明确说明通道关闭，不能伪装成费率拉取失败。
  if (!feeConfigUsable.value) return t.value.walletV3.submitReasonFeeConfigUnavailable;
  if (withdrawalPolicy.value?.withdrawalEnabled !== true) return t.value.walletV3.submitReasonWithdrawalClosed;
  if (payoutReadStatus.value === "error") return payoutReadCopy.value.addressUnavailable;
  if (payoutReadStatus.value !== "ready") return payoutReadCopy.value.addressLoading;
  // RM01a:该网络未设提现地址 → 最根本的前置,先说它(页面上方是引导卡,不是报错)。
  if (boundAddress.value.trim().length <= 10) return t.value.walletV3.submitReasonAddressRequired;
  // No eligibility request is made until these inputs exist. Missing input is
  // not an in-flight request and must never be presented as perpetual loading.
  if (amount <= 0) return t.value.walletV3.submitReasonAmountRequired;
  if (amount < minWithdrawable.value) {
    return fmt(t.value.walletV3.submitReasonMinAmount, { n: formatTruncatedAmount(minWithdrawable.value) });
  }
  if (!forQuoteDisplay && remoteEligibilityFailed.value) {
    return decision.quote ? t.value.ui.refreshFailed : t.value.walletV3.submitReasonServiceUnavailable;
  }
  if (remoteApiEnabled && decision.configVersion === "remote-pending") {
    return forQuoteDisplay ? "" : t.value.help.loadingMore;
  }
  // 换址冻结:24h 内提交按钮置灰(横幅带真倒计时)。
  if (frozenNow.value) return t.value.addrRebind.submitFrozenReason;
  // FEAT-WD01b:今日笔数用完 → 置灰 + 告知何时重置(不建单不扣款)
  if (decision.dailyLimitReached) return dailyLimitReachedText.value;
  if (amount > decision.maxWithdrawableUsdt) {
    return fmt(t.value.walletV3.submitReasonMaxAmount, { n: formatTruncatedAmount(decision.maxWithdrawableUsdt) });
  }
  const netTooLow = decision.quote && Number(decision.quote.netReceive) <= 0;
  // Without UVT to spend, or with the offset already on, raising the amount is the only way on.
  if (netTooLow) return forQuoteDisplay ? "" : offsetToggleDisabled.value || offsetWithNex.value
    ? t.value.walletV3.netTooLowRaise : t.value.walletV3.netTooLow;
  if (!decision.canSubmit) return t.value.walletV3.submitReasonReviewBlocked;
  if (remoteApiEnabled && !decision.quote) return t.value.walletV3.submitReasonServiceUnavailable;
  return "";
}
const submitDisabledReason = computed(() => disabledReasonFor(amountNum.value, eligibility.value));
// Every reason a grey 提交 has is said above it in the bar (03 §3.1 bottom bar); a pending attempt's button says its own state.
const submitHintVisible = computed(() => !pendingAttempt.value && Boolean(submitDisabledReason.value));

function fmtNex(n: number): string {
  return formatTruncatedAmount(n);
}

const canSubmit = computed(() => submitDisabledReason.value === "");
const canSubmitAction = computed(() => remoteSessionReady.value && !withdrawalCommandBusy.value
  && (pendingAttempt.value ? canRetryPendingAttempt.value : canSubmit.value));
// The bar as rendered: a reason above the button, one or two lines, makes it taller, and the content clears it (04 §4.0).
const barTray = ref<unknown>(null);
const barTrayHeight = useTrayHeight(barTray, ".wd-bar", () => [submitDisabledReason.value, submitHintVisible.value, canSubmitAction.value, submitting.value]);

function networkHint(id: CryptoNetwork): string {
  switch (id) {
    case "USDT-TRC20":
      return t.value.wallet.networkHintTrc20;
    case "USDT-BEP20":
      return t.value.wallet.networkHintBep20;
    case "USDT-ERC20":
      return t.value.wallet.networkHintErc20;
  }
  return "";
}

function detailVal(e: Event): string {
  return (e as unknown as { detail: { value: string } }).detail.value;
}
function onAmount(e: Event) {
  // 只留数字与小数点,并把小数位**截到 2 位**(不是四舍五入 —— 进位会让金额超过用户输入的数)。
  // 不截的话:输 50.999,费用与到账按 51.00 算,而输入框还留着 50.999,两个数对不上。
  const raw = detailVal(e).replace(/[^0-9.]/g, "");
  const dot = raw.indexOf(".");
  amount.value = dot < 0 ? raw : raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, "").slice(0, 2);
}
function useMax() {
  if (inputsLocked.value) return;
  if (!withdrawalActionsFresh.value) {
    toast.info(withdrawalActionStatusText.value);
    return;
  }
  const decision = resolveWithdrawalUseMax(maxWithdrawable.value, minWithdrawable.value);
  if (decision.reason === "below-minimum") {
    toast.info(fmt(t.value.wallet.useMaxBelowMinimum, {
      max: formatTruncatedAmount(maxWithdrawable.value),
      min: formatTruncatedAmount(minWithdrawable.value),
    }));
    return;
  }
  amount.value = decision.amount ?? "";
}

function goEarnNex() {
  // NEX 主来源 = 设备算力任务;引导去赚更多 NEX 才能解锁更大额提现
  navTo("/pages/earn/earn");
}

async function handleResetAddresses() {
  const ok = await uiConfirm({
    title: t.value.walletV3.resetAddrTitle,
    message: t.value.walletV3.resetAddrMessage,
    danger: true,
    icon: "warn",
    confirmLabel: t.value.walletV3.resetAddrConfirm,
  });
  if (ok) {
    payout._devResetAddresses();
    toast.info(t.value.walletV3.resetAddrToastTitle, t.value.walletV3.resetAddrToastBody);
  }
}

async function readRemoteEligibility(): Promise<void> {
  const policyVersion = withdrawalPolicy.value?.policyVersion;
  if (withdrawalCommandBusy.value || pendingAttempt.value || !policyVersion || networkClosed.value
    || !withdrawalPageVisible.value || !foregroundReadAllowed() || !shouldRequestWithdrawalEligibility({
      remote: remoteApiEnabled, factsFresh: withdrawalActionsFresh.value, policyVersion,
      amount: amountNum.value, addressLength: boundAddress.value.length,
    })) return;

  const epoch = ++remoteEligibilityEpoch;
  const account = app.accountKey;
  const binding = app.accountBindingEpoch;
  const scope = captureRuntimeRevision();
  const isCurrent = () => isCurrentWithdrawalFactsScope(account, binding, scope.epoch, epoch, remoteEligibilityEpoch);
  try {
    const snapshot = await requestWithdrawalEligibility(account, network.value, boundAddress.value,
      maxWithdrawable.value, dailyFacts.value, amountNum.value, policyVersion, offsetWithNex.value);
    if (!isCurrent()) return;
    remoteEligibility.value = snapshot;
    remoteEligibilityFailed.value = false;
  } catch (cause) {
    if (!isCurrent()) return;
    remoteEligibilityFailed.value = true;
    if (cause instanceof ApiError && cause.message === "WITHDRAWAL_POLICY_VERSION_CONFLICT") {
      remoteEligibility.value = null;
      // A changed version starts a new read. Do not keep reloading an unchanged policy.
      if (refreshedConflictVersion !== policyVersion) {
        refreshedConflictVersion = policyVersion;
        await loadWithdrawalPolicy();
      }
    }
  }
}

const quoteInputs = computed(() => [amountNum.value, network.value, boundAddress.value, offsetWithNex.value,
  pendingAttempt.value?.key, app.accountBindingEpoch, withdrawalPolicy.value?.policyVersion] as const);
watch([quoteInputs, maxWithdrawable, dailyFacts, withdrawalActionsFresh, withdrawalPageVisible, foregroundReadAllowed],
  ([inputs], [previousInputs], onCleanup) => {
    remoteEligibilityEpoch += 1;
    // Only a refresh of the same inputs can retain the last quote on screen.
    if (!previousInputs || inputs.some((input, index) => input !== previousInputs[index])) {
      remoteEligibility.value = null;
      remoteEligibilityFailed.value = false;
    }
    // Recovery owns failed reads for unchanged quote inputs.
    if (remoteEligibilityFailed.value) return;
    const timer = setTimeout(() => void readRemoteEligibility(), 250);
    onCleanup(() => clearTimeout(timer));
  }, { immediate: true });
useAutoRecovery({ failed: () => remoteEligibilityFailed.value, retry: readRemoteEligibility, repeatMs: 30_000 });

async function handleSubmit() {
  if (!remoteSessionReady.value || withdrawalCommandBusy.value) return;
  // 🔴 **上一次没确认结果的提交,必须先收口,才允许开始新的一笔**(2026-08-11 独立审计 P0)。
  // 幂等键此前在本函数里每次点击现铸 → 超时重试 = 服务端第二张单,而幂等键存在的唯一场景
  // 正是这个场景。键与它那一次的 body 一起冻在 lib/withdraw-attempt(落盘,理由见该文件),
  // 存在未收口尝试时,本次提交 = **原样重放那一笔**,不是按当前输入开新的一笔:
  // 这样用户改金额/换网络/切抵扣开关也无法绕过幂等键去建第二张单。
  const pending = readWithdrawAttempt(app.accountKey);
  pendingAttempt.value = pending;
  if (pending && !canRetryPendingAttempt.value) return;
  // 重放路径绕开 canSubmit:它判的是「当前输入能不能开新的一笔」(费率拉不到、金额被清空、
  // 今日额度用完都会为 false),而重放要发的是一笔**已经通过过这道门**的旧请求 ——
  // 拿新意图的门去锁旧请求,等于把唯一的收口路径锁死。
  if (!pending && !canSubmit.value) {
    toast.info(submitDisabledReason.value || t.value.walletV3.submitCtaDisabled);
    return;
  }
  if (pending) {
    // Re-read storage at submit and keep the displayed inputs on that same frozen command.
    amount.value = pending.amount.toFixed(2);
    offsetWithNex.value = pending.offset;
  }
  // Freeze the request inputs before the asynchronous eligibility check. A replay
  // uses the stored inputs and quote, and bypasses today's eligibility entirely.
  const snap = {
    account: app.accountKey,
    binding: app.accountBindingEpoch,
    network: pending?.network ?? network.value,
    address: pending?.address ?? boundAddress.value,
    amount: pending?.amount ?? amountNum.value,
    offset: pending?.offset ?? offsetWithNex.value,
    policyVersion: pending?.policyVersion ?? withdrawalPolicy.value!.policyVersion,
    idempotencyKey: pending?.key ?? newWithdrawKey(),
    maxWithdrawable: maxWithdrawable.value,
    daily: dailyFacts.value,
  };
  const ownsRequest = () => remoteSessionReady.value && app.accountKey === snap.account
    && app.accountBindingEpoch === snap.binding;
  let fresh: WithdrawalEligibility | null = null;
  let confirmedQuote = pending?.confirmedQuote;

  confirmingSubmit.value = true;
  try {
    if (!pending) {
      remoteEligibilityEpoch += 1;
      submitting.value = true;
      try {
        fresh = await requestWithdrawalEligibility(snap.account, snap.network, snap.address,
          snap.maxWithdrawable, snap.daily, snap.amount, snap.policyVersion, snap.offset);
      } catch (err) {
        if (!ownsRequest()) return;
        if (err instanceof ApiError && err.message === "WITHDRAWAL_POLICY_VERSION_CONFLICT") {
          remoteEligibility.value = null;
          remoteEligibilityFailed.value = true;
          await loadWithdrawalPolicy();
          toast.info(t.value.walletV3.withdrawFeeStale);
        } else {
          const geo = geoPolicyUserMessage(err, t.value.geoPolicy);
          if (geo) toast.error(geo, t.value.geoPolicy.fundsSafeNote);
          else toast.error(t.value.wallet.riskCheckTimeoutTitle, t.value.wallet.riskCheckTimeoutBody);
        }
        return;
      } finally {
        submitting.value = false;
      }
      if (!ownsRequest() || network.value !== snap.network || boundAddress.value !== snap.address) {
        toast.error(t.value.walletV3.withdrawContextStale);
        return;
      }
      remoteEligibility.value = fresh;
      remoteEligibilityFailed.value = false;
      if (fresh.route === "reject" || !fresh.canSubmit || snap.amount > fresh.maxWithdrawableUsdt
        || !fresh.quote || Number(fresh.quote.netReceive) <= 0) {
        toast.error(disabledReasonFor(snap.amount, fresh) || t.value.walletV3.submitReasonReviewBlocked);
        return;
      }
      confirmedQuote = fresh.quote;
      snap.policyVersion = fresh.configVersion;
    }

    submittingQuote.value = confirmedQuote ?? null;
    submittingNexBalance.value = app.user.nexBalance;
    const usdt = (value: string | number) => formatTruncatedAmount(value) + "\u00A0USDT";
    const amountRow = { label: t.value.walletV3.withdrawRowAmount, value: usdt(snap.amount) };
    const networkRow = { label: t.value.wallet.networkLabel, value: ALL_NETWORKS.find((nw) => nw.id === snap.network)!.label };
    const addressRow = { label: t.value.wallet.withdrawAddressLabel, value: snap.address, code: true };
    const confirmRows = !pending && confirmedQuote ? [
      amountRow,
      { label: t.value.walletV3.feeConfirmRow, value: "−" + usdt(confirmedQuote.networkFee) },
      ...(nexBurned.value > 0 ? [{ label: t.value.walletV3.feeOffsetRow, value: "+" + usdt(feeWaived.value) + " · " + fmtNex(nexBurned.value) + "\u00A0UVT" }] : []),
      networkRow,
      addressRow,
      { label: t.value.wallet.receiveLabel, value: usdt(confirmedQuote.netReceive), amount: true },
    ] : [amountRow, networkRow, addressRow];
    const confirmed = await uiConfirm({
      title: pending ? t.value.walletV3.withdrawResendTitle : t.value.walletV3.withdrawConfirmTitle,
      message: pending ? t.value.walletV3.withdrawResendBody : undefined,
      rows: confirmRows,
      glyph: "withdraw",
      rules: pending ? undefined : { title: t.value.walletV3.withdrawRules.title, items: withdrawRulesItems(snap.network, networkConfirmUsd.value) },
      confirmLabel: pending ? t.value.walletV3.withdrawResendCta : t.value.walletV3.withdrawConfirmCta,
    });
    if (!confirmed || (pending && !canRetryPendingAttempt.value)) return;
    submitting.value = true;
  } finally {
    confirmingSubmit.value = false;
    if (!submitting.value) clearSubmitFreeze();
  }
  // Check account ownership before adopting anything from its storage row.
  if (!ownsRequest()) {
    clearSubmitFreeze();
    toast.error(t.value.walletV3.withdrawContextStale);
    return;
  }
  // BUG-398: another tab may have changed the shared attempt while confirmation / eligibility awaited.
  // Decide this before live network / address checks: adopting that command can change those displayed values.
  // Keep the path from this final storage read to rememberWithdrawAttempt synchronous.
  const storedAttempt = readWithdrawAttempt(snap.account);
  if (storedAttempt?.key !== pending?.key) {
    pendingAttempt.value = storedAttempt;
    clearSubmitFreeze();
    toast.info(storedAttempt ? t.value.bankWithdrawal.resumeUsdt : t.value.walletV3.withdrawHandledElsewhere);
    return;
  }
  // 🔴 **确认后校验** —— 快照纪律的另一半。冻结件与当前权威值不符即拒单,绝不静默按新值扣款。
  //  ① 身份三元组(账号 / 网络 / 收款地址)。确认期间换号 → 下面的 debitNex 与账单会全落到
  //     新账号,而弹窗展示的是旧账号的数字;地址 / 网络若变了,等于把钱打到用户没确认过的地方。
  //     store 层 submitWithdrawal 也钉死账号,但它管不到本页的 debitNex 与建单入参 —— 两层各管一段。
  //     重放例外只放在**收款地址**这一项上:冻结件里的地址就是上一次真正发出去的那个,
  //     期间换绑过地址不改变「那笔可能已经落库」这个事实,拿新地址去否掉重放,等于把
  //     唯一的收口路径锁死 —— 而重放的地址由服务端按原键的原 body 认。账号与网络不放行。
  if (network.value !== snap.network || (!pending && boundAddress.value !== snap.address)) {
    clearSubmitFreeze();
    toast.error(t.value.walletV3.withdrawContextStale);
    return;
  }
  // Real D5 submit. The server is the sole authority for wallet reservation,
  // fee calculation, optional NEX burn, release-bucket checks and ledger writes.
  // No local balance/bill mutation is allowed before or after this call.
  // 🔴 键与 body 落盘必须在请求**发出之前**:请求在途时被杀进程 / 刷页面,正是这条链
  // 要兜住的那一刻;等回执回来再写,等于没写。
  // 🔴 写不进去就**不发**(fail closed):落盘失败 = 这一次没有重放保护,超时之后再也认不回
  // 那个键,用户一重试就是第二张单。宁可这一笔发不出去(钱一分没动、原因和下一步都给了),
  // 也不发一笔「出了事没人认得回来」的。
  if (!rememberWithdrawAttempt(snap.account, {
    key: snap.idempotencyKey,
    amount: snap.amount,
    network: snap.network,
    address: snap.address,
    policyVersion: snap.policyVersion,
    offset: snap.offset,
    confirmedQuote,
  })) {
    clearSubmitFreeze();
    toast.error(t.value.walletV3.withdrawNotSentTitle, t.value.walletV3.withdrawNotSentBody);
    return;
  }
  recoveryResult.value = null;
  try {
    const wd = await app.submitWithdrawal(
      snap.amount,
      snap.network,
      snap.address,
      snap.offset,
      snap.policyVersion,
      snap.idempotencyKey,
      confirmedQuote,
    );
    forgetWithdrawAttempt(snap.account, snap.idempotencyKey);
    refreshPendingAttempt();
    clearSubmitFreeze();
    // (这里原本有一条 `if (!wd)` 的余额不足分支。submitWithdrawal 自 2026-08-10 起
    //  没有任何 return null 路径 —— 拒单全在服务端、一律抛 ApiError 走下面的 catch 分诊。
    //  留着那条死分支会让人以为余额闸还在客户端。z4 R2 P2-5。)
    // 🔴 提现曾是唯一一笔「**本该**进账单却不进」的资金动作(2026-08-11 z4;缺陷全貌与
    // 三处连带后果见 scripts/selfcheck-bill-producers.mjs 头注,那道门守着这里不再消失)。
    // (收益按 tick 累加、佣金结算同样不写分录 —— 但那是 bills.ts 头注写明的有意设计:
    //  账单是**部分**流水。提现不是,它一直有渲染面、有对账逻辑,只是没人生产。)
    //
    // 🔴 走 postReceiptForAccount 而不是 postMoneyBill:钱由服务端在 POST /api/withdrawals
    // 里扣,本地余额一分不动 —— postMoneyBill 会照着 draft 的符号**再扣一次**(本地重复扣款)。
    // 这一族的语义正是「资金已在别处落定且不可回滚,只补收据」。
    //
    // 🔴 账号取 snap.account(发起提交时冻结的那个),不是当前绑定:submit 的 await 窗口
    // 最长 30s,期间跨标签页登出 / 吊销 / 重新登录都会 rebind,而服务端扣的是**发起时**
    // 那个账号。写进当前账号 = 把别人的流水记到你头上,不写 = 被扣的账号有扣款无凭证。
    //
    // 🔴 分录形状由 `withdrawalBillDrafts(wd)` **单源**构造 —— 同一组分录还有第二个生产点
    // (App.vue 对账的自愈补写),两处各拼一份必然漂移(z4 R2)。
    // 账单金额和风控结论取自服务端回执。
    // 写失败必须让用户知道:钱已经在服务端动了,台账却没这一笔 —— 静默吞掉等于让用户
    // 在账单页查不到自己的钱去哪了。收口点**有意不弹**通用提示(见它的头注):这里给的是
    // 带下一步的提现专属文案,两条一起弹正是 2026-08-04 修过的同型缺陷。不阻断跳转。
    // (即便这里写失败,App.vue 的对账下一拍也会把它补回来 —— 但用户此刻该知道。)
    // 服务端账本随提现提交入账；只有本地账本需要补写收据。
    if (!fundsServerEnabled && !postReceiptForAccount(snap.account, withdrawalBillDrafts(wd))) {
      toast.error(t.value.wallet.withdrawBillWriteFailed);
    }
    // Remote wallet balance is server-owned. Re-read the E3 fleet snapshot
    // after the server transaction; never apply a local shadow debit.
    if (app.accountKey === snap.account) await app.refreshRemoteFleet();
    // 换号后不跳追踪页:那笔单属于旧账号,当前账号的追踪页查不到它(深链会落空态)。
    // 🔴 但必须给话:提交成功了、钱在旧账号动了,静默 return 会让新账号的用户以为什么都没发生
    // (业务链必须有下一步 —— z4 R1 独立审计)。
    if (app.accountKey !== snap.account) {
      toast.info(t.value.wallet.withdrawSubmittedOtherAccountTitle, t.value.wallet.withdrawSubmittedOtherAccountBody);
      return;
    }
    navTo(`/pages/me/wallet-withdraw-tracking?id=${wd.id}`);
    return;
  } catch (err) {
    clearSubmitFreeze();
    // 🔴🔴 判决**不在这里做** —— 调 lib/withdraw-failure-triage 的 triageWithdrawFailure。
    //
    // 为什么(2026-08-12 第四轮独立审计实测出来的):上一版把规则写在这个 catch 里,
    // 而机器门在它自己内部**重新推导了一遍**。两个真理源 ⇒ 门与实现分叉时门看不见。
    // 实测三个必然出事的变异让门 32/32 全绿,其中一个是「结果未知也退役键」——
    // 正是这整套机制存在的唯一理由所要防的那个 bug。
    // 现在页面只做两件事:**给上下文**(这次是不是重放 / 认不认得出日限与地区),
    // 和**按判决选文案**。键的去留一个字都不在这里决定。
    const geo = geoPolicyUserMessage(err, t.value.geoPolicy);
    const verdict = triageWithdrawFailure(err, {
      isReplay: pending !== null,
      isDailyLimit: isDailyLimitRejection(err),
      isGeo: geo !== null,
    });
    if (verdict.fate === "retire") {
      forgetWithdrawAttempt(snap.account, snap.idempotencyKey);
      refreshPendingAttempt();
    } else {
      refreshPendingAttempt();
    }
    // 🔴 刷费率只跟着判决走:重放时刷了 policyVersion 就变,而重放的 body 冻着旧版本,
    // 刷完再重放 = 同 key 异 body → 409 + 安全事件。
    if (verdict.refreshPolicy) await loadWithdrawalPolicy();
    switch (verdict.kind) {
      case "quote-changed":
        if (ownsRequest() && !pendingAttempt.value) {
          if (pending) restoreWithdrawInputs(pending);
          if (err instanceof WithdrawalQuoteChangedError && err.quote && err.policyVersion === snap.policyVersion
            && network.value === snap.network && boundAddress.value === snap.address && fresh) {
            remoteEligibilityEpoch += 1;
            remoteEligibility.value = { ...fresh, quote: err.quote, canSubmit: Number(err.quote.netReceive) > 0 };
            remoteEligibilityFailed.value = false;
          } else {
            remoteEligibility.value = null;
            void readRemoteEligibility();
          }
        }
        showWithdrawReceipt("info", snap.idempotencyKey, t.value.walletV3.withdrawQuoteChanged);
        return;
      case "daily-limit":
        showWithdrawReceipt("error", snap.idempotencyKey, verdict.fate === "keep" ? dailyLimitReachedWithPendingText.value : dailyLimitReachedText.value);
        return;
      case "geo":
        showWithdrawReceipt("error", snap.idempotencyKey, geo ?? t.value.walletV3.withdrawDeclinedTitle, t.value.geoPolicy.fundsSafeNote);
        return;
      case "business":
        showWithdrawReceipt("error", snap.idempotencyKey, t.value.walletV3.submitReasonReviewBlocked);
        return;
      case "resend-declined":
        showWithdrawReceipt("error", snap.idempotencyKey, t.value.walletV3.withdrawResendDeclinedTitle, t.value.walletV3.withdrawResendDeclinedBody);
        return;
      case "declined":
        showWithdrawReceipt("error", snap.idempotencyKey, t.value.walletV3.withdrawDeclinedTitle, t.value.walletV3.withdrawDeclinedBody);
        return;
      default:
        showWithdrawReceipt("error", snap.idempotencyKey, t.value.walletV3.withdrawOutcomeUnknownTitle, t.value.walletV3.withdrawOutcomeUnknownBody);
    }
    return;
  }

}

// ── styles ──
// 空态引导卡(brand soft tint,非报错态;卡内嵌套零 border)。
const resetBtnStyle: CSSProperties = {
  height: "28px",
  padding: "0 8px",
  borderRadius: "6px",
  background: "var(--v5-surface-2)",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
};
const holdBannerStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--v5-warning) 8%, transparent)",
  borderRadius: "12px",
  padding: "10px 12px",
};
const holdIconStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "8px",
  background: "color-mix(in srgb, var(--v5-warning) 20%, transparent)",
};
// 地址行(L1 零描边)+ 「管理」入口(tap ≥ 44)。
// 冻结横幅(danger soft tint;prototype wd-freeze 同款语汇)。
const freezeBannerStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--v5-danger) 8%, transparent)",
  borderRadius: "12px",
  padding: "10px 12px",
};
const freezeIconStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "8px",
  background: "color-mix(in srgb, var(--v5-danger) 16%, transparent)",
};
// 抵扣面板:soft tint 无描边(卡内嵌套禁 border);开着且全额抵扣 → brand,其余 → brand-2。
// 开关:外层热区 ≥44pt(负 margin 不撑行高),里面是全站共用的 NxSwitch(03 §3.3);不可用时整颗 50%(03 §3.1)。
const switchHitStyle: CSSProperties = { minWidth: "56px", minHeight: "44px", margin: "-9px -6px" };





</script>

<style scoped>
/* P-45 USDT withdrawal: balance card, amount on liquid glass, route card, recessed fee well, quota pips, fixed submit. */
.wd-k { display: block; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.wd-k--brand { color: var(--v5-brand); }
/* USDT after the amount (06 §6.2, not a $ prefix): 01.2 unit, max(12px, .4em), 500, secondary ink. */
.wd-unit { color: var(--v5-ink-3); font: 500 max(12px, .4em)/1 var(--font-v5); letter-spacing: 0; }
.wd-dec { color: var(--v5-ink-3); }
.wd-bal { margin-top: 15px; padding: 16px 16px 14px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.wd-bal > .wd-k { padding-top: 3px; }
.wd-bal__amt { display: block; margin-top: 4px; color: var(--v5-ink); font: 500 30px/36px var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.wd-locks { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-top: 10px; color: var(--v5-ink-3); font: 400 12px/16px var(--font-v5); }
.wd-locks__i { display: inline-flex; align-items: center; gap: 4px; }
.wd-debt { display: flex; align-items: flex-start; gap: 6px; margin-top: 10px; color: var(--v5-ink-2); font: 400 12px/18px var(--font-v5); overflow-wrap: break-word; }
.wd-debt svg { flex-shrink: 0; margin-top: 2px; color: var(--v5-warning-ink); }
.wd-locks__v { color: var(--v5-ink-2); font: 500 12px/16px var(--font-metric); }
.wd-stage { position: relative; margin-top: 12px; }
.wd-aura { position: absolute; inset: -8px -6px; pointer-events: none; }
.wd-aura > view { position: absolute; width: 180px; height: 140px; border-radius: 50%; filter: blur(42px); }
.wd-aura > view:first-child { left: -10px; top: -6px; background: color-mix(in srgb, var(--v5-warning) 22%, transparent); }
.wd-aura > view:last-child { right: -14px; bottom: 10px; background: color-mix(in srgb, var(--v5-brand-2) 26%, transparent); }
[data-theme="light"] .wd-aura > view:first-child { background: color-mix(in srgb, var(--v5-warning) 14%, transparent); }
[data-theme="light"] .wd-aura > view:last-child { background: color-mix(in srgb, var(--v5-brand-2) 16%, transparent); }
/* Step focus block: its amber as one uniform tint (.nx-tint) over the outer aura. */
.wd-slab { --nx-tint: var(--v5-warning); position: relative; padding: 18px 20px 16px; border-radius: var(--v5-radius-xl); }
.wd-slab__head { display: flex; align-items: center; justify-content: space-between; }
.wd-max { position: relative; display: inline-flex; align-items: center; height: 32px; padding: 0 4px; color: var(--v5-brand); font: 500 13px/18px var(--font-v5); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.wd-max::after { content: ""; position: absolute; inset: -6px -8px; }
/* Locked: the shared 50% disabled state of in-card text actions (03 §3.1 P-67). */
.wd-max[aria-disabled="true"] { opacity: .5; cursor: default; }
.wd-amtrow { display: flex; align-items: baseline; margin-top: 4px; }
.wd-amtrow__input { flex: 0 1 auto; min-width: 0; max-width: calc(100% - 64px); height: 48px; padding: 0; border: 0; outline: 0; background: transparent; color: var(--v5-ink); caret-color: var(--v5-brand); font: 500 40px/48px var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.wd-amtrow__unit { margin-left: 6px; color: var(--v5-ink-3); font: 500 12px/16px var(--font-v5); }
.wd-min { margin-top: 2px; }
.wd-line { display: block; margin-top: 4px; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); font-variant-numeric: tabular-nums; }
.wd-route { margin-top: 12px; padding: 4px 16px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); box-shadow: var(--v5-glass-shadow); }
.wd-route__r { display: flex; align-items: center; gap: 12px; min-height: 52px; }
.wd-route__r + .wd-route__r { border-top: 1px solid var(--v5-border); }
/* Labels keep at least the zh width; long-language labels grow and wrap by word instead of running under the value. */
.wd-route__k { flex: none; width: min-content; min-width: 52px; max-width: 72px; overflow-wrap: break-word; }
.wd-net { flex: none; display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: var(--v5-radius-full); background: var(--v5-brand-soft); color: var(--v5-brand); font: 500 12px/16px var(--font-v5); }
.wd-manage:focus-visible, .wd-add:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.wd-route__note { flex: 1; min-width: 0; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); }
.wd-route__a { flex: 1; min-width: 0; overflow: hidden; color: var(--v5-ink); font: 500 14px/20px var(--font-metric); text-overflow: ellipsis; white-space: nowrap; }
.wd-route__a--empty { color: var(--v5-ink-3); font: 400 13px/20px var(--font-v5); }
.wd-route__a--error { color: var(--v5-danger); white-space: normal; }
.wd-manage, .wd-add { position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center; height: 32px; padding: 0 12px; border-radius: var(--v5-radius-full); color: var(--v5-ink); font: 500 13px/18px var(--font-v5); cursor: pointer; }
.wd-manage::after, .wd-add::after { content: ""; position: absolute; inset: -6px -2px; }
.wd-route__guide { padding: 0 0 14px; }
.wd-route__guide-body { display: block; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); }
.wd-add { margin-top: 10px; --ui-button-fill: color-mix(in srgb, var(--v5-brand) 14%, transparent); --ui-button-ink: var(--v5-brand); color: var(--v5-brand); }
.wd-note { display: block; margin-top: 6px; padding: 0 4px; color: var(--v5-ink-4); font: 400 12px/18px var(--font-v5); }
.wd-fee { margin-top: 12px; padding: 4px 16px; border-radius: 14px; background: color-mix(in srgb, var(--v5-ink) 4%, transparent); box-shadow: inset 0 2px 8px rgba(0,0,0,.45), inset 0 0 0 1px var(--v5-border); }
[data-theme="light"] .wd-fee { box-shadow: inset 0 1px 4px rgba(20,16,8,.10), inset 0 0 0 1px var(--v5-border); }
.wd-fee__r { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; border-top: 1px solid var(--v5-border); }
.nx-fee-offset-switch[aria-disabled="true"] { opacity: .5; }
.wd-fee > .wd-fee__r:first-child, .wd-fee > .wd-fee__offset:first-child > .wd-fee__r, .wd-fee__r--net { border-top: 0; }
.wd-fee__v { color: var(--v5-ink); font: 500 14px/20px var(--font-metric); font-variant-numeric: tabular-nums; white-space: nowrap; }
.wd-fee__v--brand { color: var(--v5-brand); }
.wd-fee__hint { display: block; margin: -4px 0 10px; color: var(--v5-ink-3); font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); }
.wd-fee__net { color: var(--v5-ink); font: 500 22px/28px var(--font-amount); letter-spacing: -.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.wd-fee__msg, .wd-fee__sk { padding: 12px 0; }
.wd-fee__sk { display: flex; flex-direction: column; gap: 8px; }
.wd-warn { display: block; color: var(--v5-warning-ink); font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); }
.wd-quota { display: flex; flex-wrap: wrap; align-items: center; column-gap: 12px; margin-top: 14px; padding: 0 4px; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); }
.wd-quota__use { display: flex; align-items: center; gap: 8px; }
/* The link keeps the row's right end; when it does not fit beside the quota line it moves whole to the next line, still right. */
.wd-rules-link { flex: none; margin-left: auto; }
.wd-rules-link :deep(text) { white-space: nowrap; }
/* Review notice: one line in main ink at the 辅助说明 size, warning-ink icon (the 12px warning-colour title failed contrast). */
.wd-notice { display: flex; align-items: flex-start; gap: 10px; margin-top: 12px; }
.wd-notice__icon { color: var(--v5-warning-ink); }
.wd-notice__main { flex: 1; min-width: 0; padding-top: calc((28px - var(--ui-type-description-lh)) / 2); }
.wd-notice__title { display: block; color: var(--v5-ink); font: 500 var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); overflow-wrap: break-word; }
.wd-notice__t { display: block; color: var(--v5-ink); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); overflow-wrap: break-word; }
.wd-notice__t--sub { color: var(--v5-ink-3); }
/* Fee sheet items: 小标题 + 长篇规则 (10.1), 16px apart. */
.wd-why { display: flex; flex-direction: column; gap: 16px; }
.wd-why__i { display: flex; flex-direction: column; gap: 4px; }
.wd-why__t { color: var(--v5-ink); font: var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); }
.wd-why__d { color: var(--v5-ink-2); font: var(--ui-type-long-form-weight) var(--ui-type-long-form)/var(--ui-type-long-form-lh) var(--font-v5); overflow-wrap: break-word; }
.wd-quota__pip { flex: none; width: 8px; height: 8px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--v5-ink-4); }
.wd-quota__pip--used { background: var(--v5-ink-3); box-shadow: none; }
/* Content clearance under the bar (04 §4.0): the tray's height + 38 from the screen bottom, so the last card scrolls to 16
   above it. The chassis already pads tray bottom + 18 below the content, so the space is the measured bar height − 2
   (barTrayHeight); until it is read, room for a reason line over the button. */
.wd-bar-space { height: 120px; }
.wd-bar { position: absolute; z-index: 36; display: flex; flex-direction: column; }
/* B34 找回横幅:与页内合规/冻结横幅同一语汇(8% 色底 + 28px 图标块),色只按状态换。 */
.wd-recover { --wd-recover-hue: var(--v5-warning); display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px 4px; border-radius: 12px; background: color-mix(in srgb, var(--wd-recover-hue) 8%, transparent); }
.wd-recover--rejected { --wd-recover-hue: var(--v5-danger); }
.wd-recover--done { --wd-recover-hue: var(--v5-success); }
.wd-recover__icon { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; background: color-mix(in srgb, var(--wd-recover-hue) 20%, transparent); color: var(--wd-recover-hue); }
.wd-recover__spin { animation: spin 1.6s linear infinite; }
.wd-recover__main { flex: 1; min-width: 0; padding-bottom: 6px; }
.wd-recover__title { display: block; color: var(--v5-ink); font: 600 13px/18px var(--font-v5); overflow-wrap: break-word; }
.wd-recover__body { display: block; margin-top: 3px; color: var(--v5-ink-3); font: 400 12px/18px var(--font-v5); overflow-wrap: break-word; }
.wd-recover__acts { display: flex; flex-wrap: wrap; align-items: center; column-gap: 20px; margin: 2px 0 -6px; }
.wd-recover__act { display: inline-flex; align-items: center; gap: 2px; min-height: 44px; color: var(--v5-brand); font: 500 13px/18px var(--font-v5); white-space: nowrap; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.wd-recover__act--muted { color: var(--v5-ink-2); }
.wd-recover__act:active { opacity: .6; }
.wd-recover__act[aria-disabled="true"] { opacity: .5; cursor: default; }
.wd-recover__act:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; border-radius: 6px; }
@media (prefers-reduced-motion: reduce) { .wd-recover__spin { animation: none; } .wd-recover__act:active { opacity: 1; } }
</style>
