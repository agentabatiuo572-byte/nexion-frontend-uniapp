<!--
  WalletWithdraw — 提现页，按网络直管提现地址。
  Top→bottom: dev-only ?dev=1 地址重置 → 换址冻结横幅(24h 倒计时,按所选网络)→
  compliance-hold banner (P5+) → amount input (Use Max) → network chips(可选,
  每网络独立当前地址)→ 地址行(掩码中段 + 「管理」入口)/ 空态引导卡(添加提现地址)
  → fee summary (single network-confirm fee row + "?" fee-why bottom sheet) → warnings →
  StakeAlternativeCard (configured minimum) → NEX offset toggle (default OFF) → sticky submit.

  Gates: 该网络已设提现地址(payout-address store 单源), 换址冻结窗口 (submit greyed),
  amount within configured withdrawable limits. Fee model (FEAT-WD02):
  fee = withdrawRules.networkConfirmFeeUsd[network] — fixed per withdrawal, admin D5
  configurable ([0,25], seed TRC20/BEP20 $1 · ERC20 $5). NEX offset is OPT-IN
  (offsetWithNex, default off): on → burn min(userNex, ceil(fee/offsetRate)), pay the
  remainder; off → NEX is never burned. Submit freezes quote + toggle + amount,
  burns NEX only when toggled on, app.submitWithdrawal re-verifies the fee snapshot
  (server-shaped), bills.add; rolls burned NEX back if the USDT debit fails.
  Then → withdraw-tracking. <AppChassis active="me">.
  Header is the shared sticky <SubPageHeader> (back=/pages/me/wallet, title="USDT",
  subtitle=t.wallet.withdraw — mirrors the prototype's
  <SetPageHeader title="USDT" subtitle={t.wallet.withdraw} backHref="/me/wallet"/>).
-->
<template>
  <AppChassis active="me">
    <view style="color: var(--v5-ink)">
      <SubPageHeader back="/pages/me/wallet" title="USDT" :subtitle="t.wallet.withdraw" />

      <!-- dev-only tester reset(?dev=1):清空当前账号提现地址簿,复现空态引导 -->
      <view v-if="devMode" class="mx-4 mb-3 flex items-center justify-end">
        <view class="shrink-0 inline-flex items-center active:opacity-80" :style="resetBtnStyle" @click="handleResetAddresses">
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

      <!-- Compliance-hold banner (P5+) -->
      <view v-if="complianceHoldEnabled" class="mx-4 mb-3 flex items-start" :style="holdBannerStyle">
        <view class="grid place-items-center shrink-0" :style="holdIconStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
        </view>
        <view class="flex-1 min-w-0" style="margin-left: 10px">
          <text class="block" style="font-size: 12px; color: var(--v5-warning); font-weight: 500">{{ t.walletV3.complianceHoldTitle }}</text>
          <text class="block" style="font-size: 12px; color: var(--v5-ink-3); margin-top: 2px; line-height: 1.4">{{ holdBody }}</text>
        </view>
      </view>

      <!-- Amount input — de-carded: the field sits on the page floor (topup tone). -->
      <view class="mx-4" style="padding: 0 2px">
        <view class="flex items-center justify-between">
          <text class="font-mono-tabular" :style="metaLabelStyle">{{ t.wallet.amountLabel }}</text>
          <view class="inline-flex items-center active:opacity-70" style="min-height: 44px; padding: 0 10px; margin: -12px -8px -12px 0" @click="useMax">
            <text style="font-size: 12px; color: var(--v5-brand)">{{ t.wallet.useMax }}</text>
          </view>
        </view>
        <view class="flex items-baseline" style="margin-top: 8px; gap: 8px">
          <text style="font-family: var(--font-v5); font-size: 26px; color: var(--v5-ink-3)" class="shrink-0">$</text>
          <input class="flex-1 min-w-0 tabular-nums" :style="amountInputStyle" type="text" inputmode="decimal" :value="amount" placeholder="0.00" :disabled="inputsLocked" @input="onAmount" />
          <text class="shrink-0" style="font-size: 12px; color: var(--v5-ink-3)">USDT</text>
        </view>
        <view class="flex items-center justify-between" style="margin-top: 8px; font-size: 12px; color: var(--v5-ink-3)">
          <text>{{ t.wallet.withdrawableAvailable }} <text class="tabular-nums" style="color: var(--v5-ink-2); font-family: var(--font-v5)">${{ maxWithdrawable.toFixed(2) }}</text></text>
          <text>{{ minAmountLine }}</text>
        </view>
        <!-- SPEC-7 ⑤ 默认态: 折叠展示不可提部分(审核中/锁定不参与最大值) -->
        <text v-if="heldLine" class="block tabular-nums" style="margin-top: 4px; font-size: 12px; color: var(--v5-ink-4)">{{ heldLine }}</text>
      </view>

      <!-- 🔴 小额免审快车道的正向态:免掉闸时**说出来**。走查实测,此前输 $30 页面一个字都没有,
           用户看不出自己刚享受了免审,只会以为「这平台就是这么快」——功能白做。 -->
      <view v-if="fastLaneOn" class="mx-4 mt-3 flex items-start" :style="fastLaneBoxStyle">
        <view class="grid place-items-center shrink-0" :style="fastLaneIconStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13 2-3 7h5l-3 7" /><circle cx="12" cy="12" r="10" /></svg>
        </view>
        <view class="flex-1 min-w-0" style="margin-left: 10px">
          <text class="block" style="font-size: 12px; color: var(--v5-brand); font-weight: 500">{{ t.wallet.fastLaneOnTitle }}</text>
          <text class="block" style="font-size: 12px; color: var(--v5-ink-3); margin-top: 2px; line-height: 1.4">{{ fastLaneBody }}</text>
        </view>
      </view>
      <view v-if="withdrawalRiskNotice" class="mx-4 mt-3 flex items-start" :style="holdBannerStyle">
        <view class="grid place-items-center shrink-0" :style="holdIconStyle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="10" /></svg>
        </view>
        <view class="flex-1 min-w-0" style="margin-left: 10px">
          <text class="block" style="font-size: 12px; color: var(--v5-warning); font-weight: 500">{{ riskNoticeTitle }}</text>
          <text class="block" style="font-size: 12px; color: var(--v5-ink-3); margin-top: 2px; line-height: 1.4">{{ riskNoticeBody }}</text>
          <!-- 🔴 反向态:说了「要审」就得给下一步。仅当降到小额线后判定真会免审时才出现,
               否则(风控闸命中,快车道免不掉)出现就是骗他白改一次金额。 -->
          <view v-if="fastLaneOverLine" class="active:opacity-70" :style="fastLaneCtaStyle" role="button" tabindex="0" :aria-label="fastLaneCta" @click.stop="useSmallAmountLine"
            @keydown.enter.prevent="useSmallAmountLine" @keydown.space.prevent="useSmallAmountLine">
            <text :style="fastLaneCtaTextStyle">{{ fastLaneCta }} →</text>
          </view>
          <view
            v-if="canUndoSmallAmount"
            class="active:opacity-70"
            :style="fastLaneCtaStyle"
            role="button"
            tabindex="0"
            :aria-label="t.wallet.fastLaneUndo"
            @click.stop="undoSmallAmountLine"
            @keydown.enter.prevent="undoSmallAmountLine"
            @keydown.space.prevent="undoSmallAmountLine"
          >
            <text :style="fastLaneUndoTextStyle">{{ t.wallet.fastLaneUndo }}</text>
          </view>
        </view>
      </view>

      <!-- 提现网络 — 可选(每网络各有独立当前地址;RM01a ③) -->
      <view class="mx-4 mt-4" style="padding: 0 2px">
        <text class="block font-mono-tabular" :style="metaLabelStyle">{{ t.wallet.networkLabel }}</text>
        <view class="flex" style="gap: 8px; margin-top: 8px">
          <view
            v-for="nw in NETWORKS"
            :key="nw.id"
            :class="['flex-1 grid place-items-center active:opacity-85', `nx-withdraw-net-${nw.id.slice(5)}`]"
            :style="netChipStyle(nw.id)"
            role="button"
            :aria-selected="network === nw.id"
            @click="pickNetwork(nw.id)"
          >
            <text :style="netChipLabelStyle(nw.id)">{{ nw.label }}</text>
          </view>
        </view>
        <text class="block" style="margin-top: 6px; font-size: 12px; color: var(--v5-ink-4); line-height: 1.4">{{ networkHint(network) }}</text>
      </view>

      <!-- 提现地址(RM01a ⑤:当前网络地址掩码中段 + 「管理」入口;未设置 → 内联引导卡,不是拦截态) -->
      <view class="mx-4 mt-4" style="padding: 0 2px">
        <text class="block font-mono-tabular" :style="metaLabelStyle">{{ t.wallet.withdrawAddressLabel }}</text>
        <view v-if="boundAddress" class="mt-2 flex items-center" :style="boundAddrRowStyle">
          <view class="flex-1 min-w-0">
            <text class="font-mono" style="font-size: 13px; color: var(--v5-ink); white-space: nowrap">{{ boundAddressShort }}</text>
          </view>
          <view
            class="nx-withdraw-manage-entry grid place-items-center shrink-0 active:opacity-80"
            role="button"
            :style="manageEntryStyle"
            @click="goManage"
          >
            <text :style="manageEntryTextStyle">{{ t.addrRebind.manageCta }}</text>
          </view>
        </view>
        <!-- 空状态引导卡(一次设置长期使用;非报错态) -->
        <view v-else class="mt-2" :style="addrGuideStyle">
          <view class="flex items-start" style="gap: 10px">
            <view class="shrink-0 grid place-items-center" :style="addrGuideIconStyle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
            </view>
            <view class="flex-1 min-w-0">
              <text class="block" style="font-size: 13px; font-weight: 600; color: var(--v5-ink)">{{ t.addrRebind.emptyGuideTitle }}</text>
              <text class="block" style="font-size: 12px; color: var(--v5-ink-3); margin-top: 4px; line-height: 1.4">{{ t.addrRebind.emptyGuideBody }}</text>
            </view>
          </view>
          <view class="nx-withdraw-add-address-cta mt-3 w-full grid place-items-center active:opacity-85" :style="addrGuideCtaStyle" role="button" @click="goManage">
            <text style="font-family: var(--font-v5); font-size: 13px; font-weight: 600">{{ t.addrRebind.addCta }}</text>
          </view>
        </view>
      </view>

      <!-- Summary: gross fee → NEX offset → net fee → receive (de-carded to floor) -->
      <!-- FEAT-WD01c ⑤ 明细区四态。优先级:失败 > 加载 > 未输入金额 > 默认。
           🔴 费率不可用时整块替换成失败态并给重试出口 —— 绝不在坏配置上渲染数字
           (否则会渲染出 $NaN,或按写死的种子值展示一个用户会当真的费用)。 -->
      <!-- 🔴 加载态必须排在失败态**前面**(2026-07-31 复验漏网点):
           重试只可能从失败态发起,若失败态 v-if 在前,骨架永远抢不到 —— 那是死 UI。
           顺序:加载中 > 不可用 > 未输入金额 > 默认。 -->
      <view v-if="feeConfigLoading" class="mx-4 mt-4 space-y-1.5" style="padding: 0 2px">
        <view v-for="i in 3" :key="i" class="flex items-center justify-between">
          <view :style="feeSkeletonLabelStyle" />
          <view :style="feeSkeletonValueStyle" />
        </view>
      </view>
      <view v-else-if="!feeConfigUsable" class="mx-4 mt-4" style="padding: 0 2px">
        <view class="flex items-center justify-between">
          <text style="font-size: 12px; color: var(--v5-warning)">{{ t.walletV3.feeConfigUnavailableTitle }}</text>
          <view class="inline-flex items-center active:opacity-70" style="min-height: 44px; padding: 0 10px; margin: -12px -8px"
            role="button" tabindex="0" :aria-label="t.walletV3.feeConfigRetry" @click="retryFeeConfig"
            @keydown.enter.prevent="retryFeeConfig" @keydown.space.prevent="retryFeeConfig">
            <text style="font-size: 12px; color: var(--v5-brand)">{{ t.walletV3.feeConfigRetry }}</text>
          </view>
        </view>
        <text class="block" style="font-size: 12px; color: var(--v5-ink-3); margin-top: 4px; line-height: 1.4">{{ t.walletV3.feeConfigUnavailableBody }}</text>
      </view>
      <!-- 空状态:金额未输入 —— 给占位说明,不留空白也不显示 $0.00 假明细 -->
      <view v-else-if="amountNum <= 0" class="mx-4 mt-4" style="padding: 0 2px">
        <text class="block" style="font-size: 12px; color: var(--v5-ink-4); line-height: 1.4">{{ t.walletV3.feeDetailPlaceholder }}</text>
      </view>
      <!-- 🔴 金额超出可提范围:**给原因,不给报价**(2026-08-01 走查 P0-3)。
           实测余额 $24,856 时输 99999,页面照样算完整套明细并写「你会收到 $84,750.20」,
           下面还接一张「质押 180 天将变成 $139,450」的预测卡 —— 一整屏精确到分的数字
           在给一个根本提交不了的金额背书,只有最底下按钮的小字说余额不够。
           低于最低额($19)同理。报价必须只对真能提交的金额出。 -->
      <view v-else-if="quoteBlocked" class="mx-4 mt-4" style="padding: 0 2px">
        <text class="block" style="font-size: 12px; color: var(--v5-warning); line-height: 1.4">{{ submitDisabledReason }}</text>
      </view>
      <view v-else class="mx-4 mt-4 space-y-1.5" style="padding: 0 2px">
        <!-- FEAT-WD02:单行网络确认费(每笔固定,按当前绑定网络取键;$0 显示 $0.00 不藏行)。
             「?」打开费用说明半屏(规格 ⑥ 新增交付物)。 -->
        <view class="flex items-center justify-between">
          <view class="inline-flex items-center" style="gap: 2px">
            <text style="font-size: 12px; color: var(--v5-ink-3)">{{ t.walletV3.feeConfirmRow }}</text>
            <view class="grid place-items-center active:opacity-60" style="min-width: 32px; min-height: 32px; margin: -10px 0" role="button" tabindex="0" :aria-label="t.walletV3.feeWhyTitle" @click="feeWhyOpen = true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
            </view>
          </view>
          <text class="tabular-nums" style="font-size: 13px; color: var(--v5-ink-3)">−${{ networkConfirmUsd.toFixed(2) }}</text>
        </view>
        <view v-if="nexBurned > 0" class="flex items-center justify-between">
          <text style="font-size: 12px; color: var(--v5-brand)">{{ t.walletV3.feeOffsetRow }}</text>
          <text class="tabular-nums" style="font-size: 13px; color: var(--v5-brand)">+${{ feeWaived.toFixed(2) }} · {{ fmtNex(nexBurned) }} NEX</text>
        </view>
        <view v-if="offsetWithNex" class="flex items-center justify-between">
          <text style="font-size: 12px; color: var(--v5-ink-2)">{{ t.walletV3.feeCharged }}</text>
          <text class="tabular-nums" :style="{ fontSize: '13px', fontWeight: 600, color: fee > 0 ? 'var(--v5-ink)' : 'var(--v5-brand)' }">${{ fee.toFixed(2) }}</text>
        </view>
        <view class="flex items-center justify-between" style="margin-top: 4px; padding-top: 10px; border-top: 1px solid var(--v5-border)">
          <text style="font-size: 12px; color: var(--v5-ink-2)">{{ t.wallet.receiveLabel }}</text>
          <text class="tabular-nums" style="font-size: 20px; font-weight: 600">${{ receive.toFixed(2) }}</text>
        </view>
      </view>

      <!-- Warnings -->
      <view class="mx-4 mt-3 rounded-2xl" :style="warnBoxStyle">
        <view class="flex items-start" style="gap: 8px; font-size: 12px; color: var(--v5-warning)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" style="margin-top: 2px"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
          <view class="space-y-1" style="line-height: 1.4">
            <!-- 🔴 首审提示必须**按这一笔真实的判定**显示,不能常显。走查实证:此前它无条件挂着,
                 于是小额免审横幅刚说「这笔立即处理」,下一行就说「首次提现审核 24 小时内」,
                 自相矛盾;已提过现的老用户也照样被吓一次。 -->
            <text v-if="firstTimeReviewApplies" class="block">{{ firstTimeReviewText }}</text>
            <!-- 最低额从配置插值(禁写死 —— 运营改成 $75 时这里必须跟着变,
                 否则同屏出现两个互相矛盾的最低额)。抵扣提示单独挂 feeConfigUsable 门:
                 费率不可用时上方已换成「费率更新中」,这句再说「上方手续费可抵扣」就是悬空指代。 -->
            <!-- 抵扣半句必须同时满足:费率可用 **且** 已输入金额。
                 少任一个都会变成悬空指代 —— 未输入金额时明细区是「输入金额后显示费用明细」,
                 上方并没有任何手续费可言;而这正是打开提现页的落地首屏,看的人最多。
                 分隔空格用 {{ ' ' }} 显式写,直接写在标签间的前导空格会被编译器吃掉
                 (实测渲染成 `$20.The fee…` 粘在一起)。 -->
            <text class="block">{{ minWithdrawNoteText }}<text v-if="feeConfigUsable && amountNum > 0 && !quoteBlocked">{{ t.wallet.minWithdrawNoteOffset }}</text></text>
            <!-- 笔数从配置插值(此前写死「1 笔/日」而代码里零计数 —— 空头承诺) -->
            <text class="block">{{ dailyLimitNoteText }}</text>
          </view>
        </view>
      </view>

      <!-- Reverse-talk staking alternative -->
      <StakeAlternativeCard v-if="amountNum > 0 && amountNum >= minWithdrawable && !quoteBlocked" :amount-num="amountNum" />

      <!-- NEX 抵扣开关(FEAT-WD02:用户自选,默认关;取代旧「强制自动抵扣 + 进度条」面板) -->
      <!-- 🔴 费率不可用时整块隐藏(历史漏网教训保留):
           本面板文案全从费用算出来,坏配置下会渲染 NaN;失败态下更糟 —— 上方写着
           「费率不可用、已暂停提交」,这里同屏还笃定显示抵扣数字,自相矛盾。
           凡是吃费用数据的区块,都必须挂同一个 feeConfigUsable 门,不能只给费用明细区加。 -->
      <view v-if="feeConfigUsable && amountNum > 0 && !quoteBlocked" class="mx-4 mt-3 rounded-2xl" :style="nexGateStyle">
        <view class="flex items-center justify-between" style="gap: 12px">
          <view class="flex items-center min-w-0" :style="nexGateLabelStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="offsetWithNex ? 'var(--v5-brand)' : 'var(--v5-brand-2)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 3 1.9 4.6L16 9.5l-4.6 1.9L9.5 16l-1.9-4.6L3 9.5l4.6-1.9z" /></svg>
            <text style="margin-left: 6px">{{ t.walletV3.feeOffsetToggle }}</text>
          </view>
          <!-- 自绘开关(禁用原生 button/switch 元素,uni 默认样式过重):外层 44pt 热区,内层 track+knob。
               NEX=0 置灰不可开,原因写在下方 hint + 去赚 NEX 入口。 -->
          <view
            class="nx-fee-offset-switch grid place-items-center shrink-0"
            role="switch"
            :aria-checked="offsetWithNex ? 'true' : 'false'"
            :aria-disabled="offsetToggleDisabled ? 'true' : 'false'"
            :aria-label="t.walletV3.feeOffsetToggle"
            tabindex="0"
            :style="switchHitStyle"
            @click="toggleOffset"
            @keydown.enter.prevent="toggleOffset"
            @keydown.space.prevent="toggleOffset"
          >
            <view :style="switchTrackStyle">
              <view :style="switchKnobStyle" />
            </view>
          </view>
        </view>
        <text class="block" style="margin-top: 8px; font-size: 12px; color: var(--v5-ink-3); line-height: 1.4">{{ offsetHintText }}</text>
        <!-- NEX=0:开关置灰 + 去赚 NEX 入口(复用 earn 路由;去了再回来,页面实例保留,开关状态不丢) -->
        <view v-if="offsetToggleDisabled" class="inline-flex items-center active:opacity-70" style="min-height: 44px; margin-top: 2px" role="button" tabindex="0" :aria-label="t.walletV3.earnNexCta" @click="goEarnNex">
          <text style="font-size: 12px; font-weight: 500; color: var(--v5-brand)">{{ t.walletV3.earnNexCta }} →</text>
        </view>
      </view>

      <!-- 费用说明半屏(规格 ⑥ 新增):仅网络确认费含义 + NEX 抵扣规则,无按金额比例的旧费率段落。
           范式同 device-deactivate-sheet(scrim z79 + slide-up panel z80,safe-area padding)。 -->
      <view v-if="feeWhyOpen">
        <view class="nx-sheet-fade-in" :style="feeWhyScrimStyle" @click="feeWhyOpen = false" />
        <view class="nx-sheet-slide-up" :style="feeWhySheetStyle">
          <view class="flex items-start justify-between" style="gap: 12px">
            <text class="block" :style="feeWhyTitleStyle">{{ t.walletV3.feeWhyTitle }}</text>
            <view class="grid place-items-center shrink-0 active:opacity-60" :style="feeWhyCloseStyle" role="button" tabindex="0" :aria-label="t.walletV3.feeWhyClose" @click="feeWhyOpen = false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </view>
          </view>
          <text class="block" :style="feeWhySectionTitleStyle">{{ t.walletV3.feeWhyNetworkTitle }}</text>
          <text class="block" :style="feeWhyBodyStyle">{{ t.walletV3.feeWhyNetworkBody }}</text>
          <text class="block" :style="feeWhySectionTitleStyle">{{ t.walletV3.feeWhyOffsetTitle }}</text>
          <text class="block" :style="feeWhyBodyStyle">{{ t.walletV3.feeWhyOffsetBody }}</text>
        </view>
      </view>

      <!-- Sticky submit -->
      <view class="mx-4 mt-4" style="padding-bottom: 12px">
        <!-- 未设地址/金额不合法时按不动:显式 aria-disabled + 可提交时给按下反馈(《05》§6.1 + 《08》§2) -->
        <view class="nx-withdraw-submit-cta w-full grid place-items-center" :class="{ 'active:opacity-90 transition-opacity': canSubmit }" role="button" :aria-disabled="canSubmit ? 'false' : 'true'" :style="submitBtnStyle" @click="handleSubmit">
          <view class="inline-flex items-center" style="gap: 8px">
            <template v-if="submitting">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              <text>{{ t.wallet.submitChecking }}</text>
            </template>
            <template v-else-if="canSubmit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              <text>{{ t.walletV3.submitCtaPaired }}</text>
            </template>
            <template v-else>
              <view class="grid place-items-center" style="gap: 2px">
                <text>{{ t.walletV3.submitCtaDisabled }}</text>
                <text v-if="submitDisabledReason" style="font-size: 12px; font-weight: 400; color: var(--v5-ink-3)">{{ submitDisabledReason }}</text>
              </view>
            </template>
          </view>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type CSSProperties } from "vue";
import { platformDayIndex } from "@/store/withdrawal-eligibility-core";
import { onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import StakeAlternativeCard from "@/components/me/stake-alternative-card.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { geoPolicyUserMessage } from "@/api/geo-policy-error";
import { isIdempotencyConflict, isSettledRejection } from "@/api/errors";
import {
  forgetWithdrawAttempt,
  newWithdrawKey,
  readWithdrawAttempt,
  rememberWithdrawAttempt,
} from "@/lib/withdraw-attempt";
import { navTo } from "@/lib/route";
import { normalizeSlaHours } from "@/store/withdrawal-arrival-core";
import { riskReasonLines, waivedGateLines } from "@/lib/risk-reason-text";
import { useApp } from "@/store/app";
import { earningsReleaseSnapshot } from "@/store/earning-release";
import { useBills } from "@/store/bills";
import { usePayoutAddress } from "@/store/payout-address";
import { remoteApiEnabled } from "@/api/runtime";
import { formatClock, freezeRemainingMs, fromWithdrawNetwork, maskAddressMid } from "@/store/payout-address-core";
import { mockServerNow } from "@/store/server-time";
import {
  evaluateWithdrawal,
  dailyLimitStatus,
  requestWithdrawalEligibility,
  type WithdrawalEligibility,
} from "@/store/withdrawal-eligibility";
import { computeWithdrawFee, isWithdrawalFeeSnapshotValid, type WithdrawNetworkKey } from "@/store/nex-faucet";
import { useRiskDisclosure } from "@/store/risk-disclosure";
import { useProductPhase } from "@/composables/use-product-phase";
import { confirm as uiConfirm, toast } from "@/store/ui";
import type { Withdrawal, WithdrawalFeeSnapshot } from "@/store/types";
import { withdrawalApi } from "@/api/runtime";
import type { WithdrawalPolicy } from "@/api/withdrawal-api";

// 提现网络收窄裁决:仅 USDT 三网络(可选;每网络各有独立当前地址,RM01a)。
const NETWORKS: { id: Withdrawal["network"]; label: string }[] = [
  { id: "USDT-TRC20", label: "TRC20" },
  { id: "USDT-BEP20", label: "BEP20" },
  { id: "USDT-ERC20", label: "ERC20" },
];

const t = useT();
const app = useApp();
const bills = useBills();
const payout = usePayoutAddress();
const risk = useRiskDisclosure();
const phase = useProductPhase();
const withdrawalPolicy = ref<WithdrawalPolicy | null>(null);
const withdrawalPolicyLoading = ref(false);

async function loadWithdrawalPolicy(): Promise<void> {
  if (withdrawalPolicyLoading.value) return;
  withdrawalPolicyLoading.value = true;
  try {
    withdrawalPolicy.value = await withdrawalApi.policy();
  } catch {
    withdrawalPolicy.value = null;
  } finally {
    withdrawalPolicyLoading.value = false;
  }
}

// 2026-07-31 规则变更:充值本金也可提(按标准费率收费),故可提上限 = 总余额。
// pendingReviewUsdt / bonusLockedUsdt 本就账外(不计入 usdtBalance),风控扣留照旧生效。
// 注意:这里读 usdtBalance 是本规则的正解。历史 P0(可提额度 > 总余额仍放行)的防线
// 已随 c37e642 的本地扣款链一并移除 —— 客户端不再扣款,超额请求由本 computed 的
// fail-closed 上限拦 + 服务端 reservation 拒;别再指望 app.ts 有总余额门。
const maxWithdrawable = computed(() => {
  if (earningsReleaseSnapshot.value?.clusterRestricted) return 0;
  const buckets = earningsReleaseSnapshot.value?.buckets;
  if (!buckets) return 0;
  const serverWithdrawable = Math.max(0,
    app.user.usdtBalance - buckets.pending_review - buckets.bonus_locked);
  return serverWithdrawable * (withdrawalPolicy.value?.balanceMaxRatio ?? 0);
});
const minWithdrawable = computed(() => withdrawalPolicy.value?.minAmount ?? 0);
const dailyLimitNoteText = computed(() => fmt(t.value.wallet.dailyLimitNote, { n: String(withdrawalPolicy.value?.dailyLimitCount ?? 0) }));
// 今日笔数用完时的提示 + 下次可提时刻(平台日边界,按用户本地时钟展示)
const dailyLimitReachedText = computed(() => {
  // 🔴 给「MM-DD HH:mm」绝对时刻,不写「明日」。平台日按越南时区(UTC+7)切,
  // 用户本地时钟未必同一天 —— 独立验收实测本地 08-01 02:00 时重置点也在 08-01,
  // 文案却说「明日」。绝对时刻在任何时区都不会说错。
  const at = new Date(eligibility.value.dailyCountResetAt);
  const p2 = (n: number) => String(n).padStart(2, "0");
  const stamp = `${p2(at.getMonth() + 1)}-${p2(at.getDate())} ${p2(at.getHours())}:${p2(at.getMinutes())}`;
  return fmt(t.value.walletV3.dailyLimitReached, { time: stamp });
});
const minWithdrawNoteText = computed(() => fmt(t.value.wallet.minWithdrawNote, { n: minWithdrawable.value.toFixed(0) }));
const minAmountLine = computed(() => fmt(t.value.wallet.minAmountDynamic, { n: minWithdrawable.value.toFixed(0) }));
const devMode = ref(false);
onLoad((options) => {
  devMode.value = import.meta.env.DEV && options?.dev === "1";
  // 默认选中已设地址的网络(第一个);都没有则维持 TRC20(空态引导卡)。
  const withAddr = NETWORKS.find((n) => payout.currentFor(fromWithdrawNetwork(n.id)));
  if (withAddr) network.value = withAddr.id;
});

const amount = ref("");
// 提现网络可选;地址 = 该网络当前提现地址(payout-address store 单源,RM01a)。
const network = ref<Withdrawal["network"]>("USDT-TRC20");
const chainNetwork = computed(() => fromWithdrawNetwork(network.value));
const boundAddress = computed(() => payout.currentFor(chainNetwork.value)?.address ?? "");
// 掩码中段:与地址管理页共用 core.maskAddressMid 同一实现,不各写一份。
const boundAddressShort = computed(() => (boundAddress.value ? maskAddressMid(boundAddress.value) : "—"));

const amountNum = computed(() => parseFloat(amount.value) || 0);

// 网络也是报价/地址的输入 —— 提交在途一律冻结,与 useMax/useSmallAmountLine/toggleOffset
// 同一纪律(审计 P2:评估窗口内切网络会让本可成功的提交被确认后校验无谓拒绑)。
function pickNetwork(id: Withdrawal["network"]) {
  if (inputsLocked.value) return;
  network.value = id;
}

// ── 地址管理入口 + 换址后 24h 冻结(RM01a ⑤)──────────────────────
// 管理入口常开:在途单 / 频控拦截由地址管理页与 store 的**同一个**判据呈现
// (payout.changeBlockReason,问整张在途列表),提现页不自算第二份。
function goManage() {
  navTo(`/pages/me/wallet-address-rebind?network=${chainNetwork.value}`);
}
// 冻结倒计时(server 时钟 1s tick;归零自然放行)。
const nowTick = ref(mockServerNow());
let freezeTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  if (remoteApiEnabled) void payout.refreshRemote().catch(() => undefined);
  void loadWithdrawalPolicy();
  freezeTimer = setInterval(() => (nowTick.value = mockServerNow()), 1000);
});
onUnmounted(() => {
  if (freezeTimer) clearInterval(freezeTimer);
});
const freezeLeftMs = computed(() => freezeRemainingMs(payout.stateFor(chainNetwork.value).freezeUntil, nowTick.value));
const frozenNow = computed(() => freezeLeftMs.value > 0);
const freezeBannerText = computed(() =>
  fmt(t.value.addrRebind.freezeBanner, { t: formatClock(freezeLeftMs.value, { hours: true }) }),
);

const complianceHoldEnabled = computed(() => withdrawalPolicy.value?.complianceHoldEnabled === true);
const holdBody = computed(() => fmt(t.value.walletV3.complianceHoldBody, { days: withdrawalPolicy.value?.cooldownDays ?? 0 }));

// ── Fee model (FEAT-WD02): fixed per-network confirm fee + OPT-IN NEX offset ──
// fee = withdrawRules.networkConfirmFeeUsd[network](后台 D5 单源,[0,25]);
// 开关 offsetWithNex 默认关 —— 关着一枚 NEX 都不烧;开着烧 min(userNex, ceil(fee/offsetRate))。
// offsetRate 走 phase 派发(§13.4 权威,全档 $0.40)。配置读不到时不允许回退写死值 —— 见 feeConfigUsable 门。
// 提交期间连 NEX 余额一起冻:开关 hint 与抵扣行都从费用链渲染,
// 扣完 NEX 立刻重算会让页面在 spinner 期间自己改价(对抗证伪实测)。
// 冻结面必须覆盖**同一条数据链上的全部渲染点**。
/** 提交期间冻结的 NEX 余额(与报价同一时刻)。 */
const submittingNexBalance = ref<number | null>(null);
const nexBalance = computed(() => submittingNexBalance.value ?? app.user.nexBalance);
const nexFeeOffsetRate = computed(() => withdrawalPolicy.value?.nexFeeOffsetRate ?? 0);
/** FEAT-WD02:NEX 抵扣开关(规格 ③:默认关;server 侧无此意图永不烧 NEX)。 */
const offsetWithNex = ref(false);
/** 按当前绑定网络取网络确认费键(网络派生自 pairing 响应式 —— 换绑回本页即时刷新)。 */
const NETWORK_FEE_KEY: Record<Withdrawal["network"], WithdrawNetworkKey> = {
  "USDT-TRC20": "trc20",
  "USDT-BEP20": "bep20",
  "USDT-ERC20": "erc20",
};
const networkConfirmFee = computed(
  () => withdrawalPolicy.value?.networkConfirmFeeUsd[NETWORK_FEE_KEY[network.value]] ?? 0,
);
const feeCalc = computed(() =>
  computeWithdrawFee(
    amountNum.value,
    nexBalance.value,
    offsetWithNex.value,
    nexFeeOffsetRate.value,
    networkConfirmFee.value,
  ),
);
/**
 * 冻结报价对**当前**权威值是否仍成立 —— 与 app.ts 提交边界同一个纯函数、同一组入参
 * (5 参:含网络键与权威费率 map,fail-closed)。
 *
 * 🔴 这里读活值(nexFeeOffsetRate / policy.networkConfirmFeeUsd)是**故意**的:
 * 它就是「确认后校验」那一步 —— 拿冻结件去问权威值还认不认。与「await 之后一律用快照」
 * 不冲突:快照供扣款,活值只供判「要不要拒单」。反过来用冻结费率复验冻结报价,
 * 等式恒成立、判据恒为真 = 这道门等于没有。
 */
function quoteStillValid(fee: WithdrawalFeeSnapshot, offset: boolean, net: Withdrawal["network"]): boolean {
  return isWithdrawalFeeSnapshotValid(
    fee,
    offset,
    nexFeeOffsetRate.value,
    NETWORK_FEE_KEY[net],
    withdrawalPolicy.value?.networkConfirmFeeUsd ?? null,
  );
}
// 🔴 费率可用性是**两个合取项**,少一个就等于回退写死值:
//   ① 配置真拉到了(!syncFailed)—— 拉取失败时 store 仍保留 DEFAULT_PLATFORM_CONFIG 种子,
//      光看值是「合法」的,只查值 = 按写死的 mock seed 算费并放行下单,正是规格禁止的回退。
//   ② 拉到的值本身合法(isNetworkFeeConfigUsable)。
// 与汇率牌价同口径:fx.ts 的 fxAvailable = !syncFailed && isFxQuoteUsable(...)。
const feeConfigUsable = computed(() => {
  const policy = withdrawalPolicy.value;
  return policy !== null
    && policy.enabledNetworks.includes(network.value)
    && policy.nexFeeOffsetRate > 0;
});
// 重试出口(规格 ⑤ 报错态必须给下一步)。PROD:重拉 GET /api/config/platform。
const feeConfigLoading = ref(false);
async function retryFeeConfig() {
  if (feeConfigLoading.value) return;
  feeConfigLoading.value = true;
  try {
    await loadWithdrawalPolicy();
  } finally {
    feeConfigLoading.value = false;
  }
}
// 骨架条:形状对齐真实明细行(标签窄、数值宽),非通用转圈。
const feeSkeletonLabelStyle = "width: 72px; height: 12px; border-radius: 4px; background: var(--v5-surface-2)";
const feeSkeletonValueStyle = "width: 56px; height: 13px; border-radius: 4px; background: var(--v5-surface-2)";
// 🔴 提交期间**冻结报价**。feeCalc 依赖 nexBalance,而提交链的第一步就是扣 NEX ——
// 扣完之后整条链立刻重算,抵扣消失、费用跳回原价。两个后果:
//  ① 页面在用户盯着 spinner 的这 ~1 秒里自己改价(明细两行消失、到账数字掉下来);
//  ② 更严重的是拿重算后的值去下单(见 handleSubmit 里的 snap.quote)。
// 报价一旦要展示给用户确认就必须定死,直到本次提交结束 —— 冻结点在**确认弹窗打开之前**,
// 弹窗文案、页面明细、扣款入参共用同一份 snap.quote(R2 P1-B:确认 A 报价被扣 B 报价)。
const submittingQuote = ref<ReturnType<typeof computeWithdrawFee> | null>(null);
const activeFee = computed(() => submittingQuote.value ?? feeCalc.value);
const networkConfirmUsd = computed(() => activeFee.value.networkConfirmUsd);
const nexBurned = computed(() => activeFee.value.nexBurned);
const feeWaived = computed(() => activeFee.value.feeWaived);
const fee = computed(() => activeFee.value.actualFee);
const receive = computed(() => activeFee.value.netReceive);
const fullyWaived = computed(() => amountNum.value > 0 && fee.value <= 0.001);
/** 开关置灰判据:没有 NEX 可抵(NEX=0 → 置灰 + 去赚 NEX 入口,规格 ② 异常1)。 */
const offsetToggleDisabled = computed(() => nexBalance.value <= 0);
function toggleOffset() {
  // 提交期间输入面全冻结(与金额输入 :disabled 同纪律 —— 开关也是报价的输入)。
  if (inputsLocked.value) return;
  // 置灰不可开:原因就写在下方 hint(NEX=0),旁边是去赚 NEX 出口。
  if (offsetToggleDisabled.value) return;
  offsetWithNex.value = !offsetWithNex.value;
}
/** 开关下方的状态行:置灰原因 / 免费网络 / 关态说明 / 开态消耗数(全额或部分)。 */
const offsetHintText = computed(() => {
  if (offsetToggleDisabled.value) return t.value.walletV3.feeOffsetNoNex;
  if (networkConfirmUsd.value <= 0) return t.value.walletV3.feeOffsetFreeNetwork;
  if (!offsetWithNex.value) return fmt(t.value.walletV3.feeOffsetOffHint, { n: fmtNex(nexBalance.value) });
  if (fee.value <= 0.0001) return fmt(t.value.walletV3.feeOffsetOnFull, { nex: fmtNex(nexBurned.value) });
  return fmt(t.value.walletV3.feeOffsetOnPartial, {
    nex: fmtNex(nexBurned.value),
    waived: feeWaived.value.toFixed(2),
    rest: fee.value.toFixed(2),
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
  return evaluateWithdrawal(app.accountKey, network.value, boundAddress.value, maxWithdrawable.value, amountNum.value);
});
// 冻结期不重复挂风控横幅(专属冻结横幅已在顶部,避免双横幅噪声)。
const withdrawalRiskNotice = computed(
  () =>
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
/**
 * 🔴 输入面冻结判据 = 提交中 **或** 确认弹窗打开中。
 * 只看 submitting 的话,弹窗那几秒 submitting 还是 false —— 改金额的入口(输入框、
 * 「全部提现」、降额 CTA、抵扣开关)全都还活着,只靠 mask 挡手。快照已让改动动不了钱,
 * 但页面会立刻显示与刚确认的弹窗不同的数字,同一个提交出现两个口径。
 */
const inputsLocked = computed(() => submitting.value || confirmingSubmit.value);
/** 提交链结束(成功 / 任一拒单分支)统一解冻:三个状态必须成对清,漏一个页面就永久卡在冻结报价上。 */
function clearSubmitFreeze() {
  submitting.value = false;
  submittingQuote.value = null;
  submittingNexBalance.value = null;
}
// ⑤ 默认态: 审核中/锁定金额折叠展示(不参与可提最大值)。
const heldLine = computed(() => {
  const b = earningsReleaseSnapshot.value?.buckets;
  if (!b || (b.pending_review <= 0 && b.bonus_locked <= 0)) return "";
  return fmt(t.value.wallet.heldBucketsLine, {
    p: b.pending_review.toFixed(2),
    l: b.bonus_locked.toFixed(2),
  });
});
// 风控提示按命中原因给业务话术(工程码不直出;空时退回通用文案;码表单源 lib/risk-reason-text)。
// ── 🔴 小额免审快车道的**双向告知**(走查:能力在跑,但一个字都没告诉用户)──
/** 小额线(后台 D5 可配,禁写死 —— 运营调了这里必须跟着变)。 */
/**
 * 小额线的**落地值**:向下取到 2 位小数。
 * 金额输入框只接受 2 位小数,所以「点 CTA 会填进去的那个数」必须先按 2 位定死,
 * 再拿它去比较和显示 —— 三处用同一个值。
 * 原来比较用原值、写入 toFixed(2)、显示 toFixed(0),运营配 49.999 时写进去的 50.00 反而**超过**原值,
 * 快车道不生效而 CTA 判据仍成立 → 一个点多少次都没反应、也永不消失的按钮。
 * 向下取整(不是四舍五入)才不会越线。
 */
// WD01 is HOLD: the backend does not yet execute the advertised review/address bypass.
// Keep the fast-lane branch unreachable instead of treating a persisted/displayed value as effective.
const smallAmountLine = computed(() => 0);
/**
 * 正向态:这笔**真的**免掉了闸,才值得说。
 * 🔴 判据用 waivedGates 而不是 fastLaneApplied —— 后者只表示「金额在小额线内」,
 * 老用户提 $10 也是 true,但一道闸都没免,弹「已免去:」会是句空话。
 */
const waivedLines = computed(() => waivedGateLines(t.value, eligibility.value.waivedGates));
/**
 * 🔴 说「这笔可立即处理」的前提有三层,少一层就是假承诺:
 *  ① 真免掉了闸(waivedGates 非空)—— 否则老用户会看到一句空的「已免去:」;
 *  ② 最终路由是放行 —— 共用地址等风控闸快车道免不掉,免了冷启动闸 ≠ 这笔能走;
 *  ③ **这笔现在真的提交得了** —— 判据取页面统一的拦截单源 submitDisabledReason,
 *     它把「低于最低额 / 今日笔数用完 / 超过可提额 / 换绑冻结 / 费率不可用…」全收在一处。
 *     独立验收实测两个默认配置就能复现的对打:输 $5(≤ 小额线但 < 最低额 $20)、
 *     以及当日额度已用完时提 $30 —— 两种情况 route 都是 pass,横幅喊「立即处理」,
 *     同屏提交按钮却灰着说「最低提现 $20」/「今日已达上限」。
 *     ⚠️ 这里不能改挂 core 的 canSubmit:它比的是**余额**与最低额(withdrawableUsdt >=
 *     minWithdrawableUsdt),压根不看用户输了多少,$5 那个场景它照样是 true。
 */
const fastLaneOn = computed(
  () => waivedLines.value.length > 0 && eligibility.value.route === "pass" && submitDisabledReason.value === "",
);
/**
 * 反向态:降到小额线后,路由**会不会真的**变成免审。
 * 🔴 不用 `amount > line` 这种启发式 —— 那会在换绑冻结 / 共用地址等风控闸命中时
 * 照样劝他「改小就能立刻处理」,而快车道压根免不掉风控闸,等于骗他白改一次金额。
 * 直接把小额线代进同一个判定函数问一次,答案是什么就说什么。
 */
const smallLineDecision = computed(() =>
  evaluateWithdrawal(app.accountKey, network.value, boundAddress.value, maxWithdrawable.value, smallAmountLine.value),
);
const fastLaneOverLine = computed(
  () =>
    smallAmountLine.value > 0 &&
    amountNum.value !== smallAmountLine.value &&
    // 🔴 判据 = 「把小额线代进**同一个** disabledReasonFor 后,一个拦截原因都不剩」。
    //    这一条同时覆盖:路由要不要审、日限用没用完、费率可不可用、小额线本身在不在
    //    [最低提现额, 可提余额] 区间内 —— 全部由那一个函数负责,CTA 这里不再自己列条件。
    //    只看 route 的旧写法漏掉了日限与费率两类(它们不并进 route),会给出点了没用的假引导。
    disabledReasonFor(smallAmountLine.value, smallLineDecision.value) === ""
);
const fastLaneBody = computed(() => fmt(t.value.wallet.fastLaneOnBody, { g: waivedLines.value.join(" · ") }));
/**
 * 首审提示是否适用于**这一笔**。判据取判定结果里的原因码,和横幅同一个源 ——
 * 分开算必然出现「横幅说免了、提示说要审」的对打(走查现场就是这样)。
 */
/**
 * 🔴 报价是对「你提交后会发生什么」的承诺 —— **提交不了就没有会发生什么**。
 * 判据直接取页面统一的拦截单源,不另起一套:另起必然漂移成「明细区说能提、按钮说不能提」。
 * 覆盖低于最低额 / 超过可提余额 / 今日笔数用完 / 换绑冻结 / 费率不可用等全部原因。
 * (金额为空由前一个分支的占位说明接管,不走这里。)
 */
const quoteBlocked = computed(() => amountNum.value > 0 && submitDisabledReason.value !== "");
const firstTimeReviewApplies = computed(() => eligibility.value.riskReasons.includes("first-withdrawal-review"));
/**
 * 🔴 这里**不给时间承诺**。
 *
 * 原文写死「24 小时内」;我一度把它换成新配置项 manualReviewSlaHours,以为这样就算「接了单源」——
 * 审计证明那是自欺:后台 D5 参数集里没有这个字段(运营根本改不了)、PRD 零命中,
 * 而且系统对人工复核**没有任何推进机制**(advanceArrival 对非 pass 路由恒不推进,
 * 实测把时间推到十年后仍不动)。等于把写死的 24 从文案挪进配置文件,承诺照样兑现不了。
 *
 * 能诚实说的只有「这一笔要人工确认」本身,以及怎么绕开它 —— 旁边那条降额 CTA 就是出口。
 */
const firstTimeReviewText = computed(() => t.value.wallet.firstTimeReview);
// 文案里的数字必须 = 点下去真会填进输入框的那个数。
// 原来文案 toFixed(0)、落地 toFixed(2):线配成 20.5 时按钮写「改为 $21 提现」而实际填 20.50,
// 用户照字面手输 21 反而超线、快车道不生效 —— 按钮上的数字自己把用户送出了免审区间。
const smallAmountLineText = computed(() =>
  Number.isInteger(smallAmountLine.value) ? smallAmountLine.value.toFixed(0) : smallAmountLine.value.toFixed(2),
);
const fastLaneCta = computed(() => fmt(t.value.wallet.fastLaneCta, { n: smallAmountLineText.value }));
/**
 * 误点降额后的撤销出口。项目不变量要求业务链有取消出口,而这个 CTA 是**藏在警告横幅里的**
 * 下调建议 —— 用户输了 $500 顺手点到,原值不可恢复的话代价不对称(useMax 是用户主动要全提,不同)。
 */
const previousAmount = ref("");
const canUndoSmallAmount = computed(() => previousAmount.value !== "" && amount.value !== previousAmount.value);
function undoSmallAmountLine() {
  if (submitting.value) return;
  amount.value = previousAmount.value;
  previousAmount.value = "";
}
/** 一键把金额降到小额线 —— 只说「改小就行」而不让他一键改,等于没给下一步。 */
function useSmallAmountLine() {
  // 提交期间禁止改金额:输入框有 :disabled,这两个裸 <view @click> 入口没有。
  if (inputsLocked.value) return;
  previousAmount.value = amount.value;   // 记下原值,给撤销用
  amount.value = smallAmountLine.value.toFixed(2);
}
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
function disabledReasonFor(amount: number, decision: WithdrawalEligibility): string {
  // 费率可读与通道开放是两个独立事实。总开关关闭时仍展示服务端报价，
  // 但提交必须明确说明通道关闭，不能伪装成费率拉取失败。
  if (!feeConfigUsable.value) return t.value.walletV3.submitReasonFeeConfigUnavailable;
  if (withdrawalPolicy.value?.withdrawalEnabled !== true) return t.value.walletV3.submitReasonWithdrawalClosed;
  // RM01a:该网络未设提现地址 → 最根本的前置,先说它(页面上方是引导卡,不是报错)。
  if (boundAddress.value.trim().length <= 10) return t.value.walletV3.submitReasonAddressRequired;
  // 换址冻结:24h 内提交按钮置灰(横幅带真倒计时)。
  if (frozenNow.value) return t.value.addrRebind.submitFrozenReason;
  // FEAT-WD01b:今日笔数用完 → 置灰 + 告知何时重置(不建单不扣款)
  if (decision.dailyLimitReached) return dailyLimitReachedText.value;
  if (amount <= 0) return t.value.walletV3.submitReasonAmountRequired;
  if (amount < minWithdrawable.value) {
    return fmt(t.value.walletV3.submitReasonMinAmount, { n: minWithdrawable.value.toFixed(0) });
  }
  if (amount > decision.maxWithdrawableUsdt) {
    return fmt(t.value.walletV3.submitReasonMaxAmount, { n: decision.maxWithdrawableUsdt.toFixed(2) });
  }
  if (!decision.canSubmit) return t.value.walletV3.submitReasonReviewBlocked;
  return "";
}
const submitDisabledReason = computed(() => disabledReasonFor(amountNum.value, eligibility.value));

function fmtNex(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const canSubmit = computed(() => submitDisabledReason.value === "");

function networkHint(id: Withdrawal["network"]): string {
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
  amount.value = maxWithdrawable.value.toFixed(2);
}

function goEarnNex() {
  // NEX 主来源 = 设备挖矿;引导去赚更多 NEX 才能解锁更大额提现
  uni.navigateTo({ url: "/pages/earn/earn", fail: () => {} });
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

async function handleSubmit() {
  if (submitting.value || confirmingSubmit.value) return;
  // 🔴 **上一次没确认结果的提交,必须先收口,才允许开始新的一笔**(2026-08-11 独立审计 P0)。
  // 幂等键此前在本函数里每次点击现铸 → 超时重试 = 服务端第二张单,而幂等键存在的唯一场景
  // 正是这个场景。键与它那一次的 body 一起冻在 lib/withdraw-attempt(落盘,理由见该文件),
  // 存在未收口尝试时,本次提交 = **原样重放那一笔**,不是按当前输入开新的一笔:
  // 这样用户改金额/换网络/切抵扣开关也无法绕过幂等键去建第二张单。
  const pending = readWithdrawAttempt(app.accountKey);
  // 重放路径绕开 canSubmit:它判的是「当前输入能不能开新的一笔」(费率拉不到、金额被清空、
  // 今日额度用完都会为 false),而重放要发的是一笔**已经通过过这道门**的旧请求 ——
  // 拿新意图的门去锁旧请求,等于把唯一的收口路径锁死。
  if (!pending && !canSubmit.value) {
    toast.info(submitDisabledReason.value || t.value.walletV3.submitCtaDisabled);
    return;
  }
  if (pending) {
    // 表单回填到冻结件:发出去的是上一次那笔,页面就必须显示上一次那笔,
    // 否则弹窗/明细与真正发出的不是同一笔(地址是按网络派生的 computed,回填不了,
    // 故弹窗里显式打出冻结的那个地址)。
    amount.value = pending.amount.toFixed(2);
    network.value = pending.network;
    offsetWithNex.value = pending.offset;
  }
  if (!risk.accepted) {
    // Source pushes to the risk-disclosure page (not yet ported) and returns.
    uni.navigateTo({ url: "/pages/me/risk-disclosure?return=/pages/me/wallet-withdraw", fail: () => {} });
    return;
  }
  // 🔴 **一份提交快照收全族**(2026-08-04 R2 三条 P1 同一个根:跨 await 的状态漂移)。
  //
  // 参与这次提交的每一个输入 —— 账号 / 网络 / 收款地址 / 金额 / 可提上限 / 抵扣开关 / 报价 ——
  // 在**第一个 await 之前**一次冻结;弹窗文案、扣款、建单、账单、拒单归因全部只读这一份。
  // 此前只冻了金额,报价与账号却取在 `await uiConfirm` **之后**:
  //  · 报价:feeCalc 依赖费率 / 网络确认费 / NEX 余额,而这些由后台配置同步、挖矿 tick、
  //    阶段换档在任意时刻改写 —— 遮罩只挡用户的手,挡不住后台数据流。用户确认的是 A 报价,
  //    实际扣的是 B 报价(R2 P1-B);
  //  · 账号:确认期间换号 → debitNex 与账单全落到新账号,弹窗展示的却是旧账号的数字(R2 P1-C)。
  // 不变量:首个 await 之后一律读 snap,不再读任何活值;活值只在下面「确认后校验」里
  // 用来判「快照过期了没有」,判完不符即拒,绝不静默按新值扣款。
  // 存在未收口尝试时,快照的每一项都取冻结件(而不是活值)—— 重放必须与首次逐字节相同,
  // 否则撞上服务端「同 key + 异 body → 409 + 安全事件」。policyVersion 尤其:
  // 它由后台发布节奏改写,用户看不见,却是 body 的一部分。
  const q = feeCalc.value;
  const snap = {
    account: app.accountKey,
    network: pending?.network ?? network.value,
    address: pending?.address ?? boundAddress.value,
    amount: pending?.amount ?? amountNum.value,
    maxWithdrawable: maxWithdrawable.value,
    offset: pending?.offset ?? offsetWithNex.value,
    policyVersion: pending?.policyVersion ?? withdrawalPolicy.value!.policyVersion,
    idempotencyKey: pending?.key ?? newWithdrawKey(),
    quote: q,
    // server 形状的费用快照(建单入参 + 复验入参同一份,不再各拼一次)
    fee: { networkConfirmUsd: q.networkConfirmUsd, nexBurned: q.nexBurned, actualFeeUsd: q.actualFee } as WithdrawalFeeSnapshot,
  };
  // 页面显示也钉在同一份快照上(弹窗 = 页面 = 扣款,一份)。遮罩后面的费用明细若还跟着活值走,
  // 用户点完确认抬头就会看到与刚才弹窗不一样的数。
  submittingQuote.value = snap.quote;
  submittingNexBalance.value = app.user.nexBalance;
  // FEAT-WD02 ⑥「提交提现 → 现有确认弹窗」:金额 / 单行网络确认费 / NEX 抵扣消耗(开了才显)
  // / 到手金额;取消 = 弹窗自带 Cancel,退出且不建单(业务链取消出口)。
  // message 为纯文本(ui store MVP text-only),费用行以 i18n 拼串表达,不动 ConfirmOptions。
  const confirmBody =
    snap.quote.nexBurned > 0
      ? fmt(t.value.walletV3.withdrawConfirmBodyNex, {
          amount: snap.amount.toFixed(2),
          fee: snap.quote.networkConfirmUsd.toFixed(2),
          waived: snap.quote.feeWaived.toFixed(2),
          nex: fmtNex(snap.quote.nexBurned),
          receive: snap.quote.netReceive.toFixed(2),
        })
      : fmt(t.value.walletV3.withdrawConfirmBody, {
          amount: snap.amount.toFixed(2),
          fee: snap.quote.networkConfirmUsd.toFixed(2),
          receive: snap.quote.netReceive.toFixed(2),
        });
  // 重放走**另一份**确认文案:用户点的是「提现」,发出去的却是上一笔 —— 不明说等于替他做主。
  // 这里打冻结件的金额/网络/地址,不打新报价:重放的费用由服务端按冻结的 policyVersion 定,
  // 客户端此刻算出来的价不是那笔的价,展示它就是第二个口径。
  const resendBody = pending
    ? fmt(t.value.walletV3.withdrawResendBody, {
        amount: snap.amount.toFixed(2),
        network: NETWORKS.find((n) => n.id === snap.network)?.label ?? "",
        address: maskAddressMid(snap.address),
      })
    : "";
  confirmingSubmit.value = true;
  let confirmed = false;
  try {
    confirmed = await uiConfirm({
      title: pending ? t.value.walletV3.withdrawResendTitle : t.value.walletV3.withdrawConfirmTitle,
      message: pending ? resendBody : confirmBody,
      confirmLabel: pending ? t.value.walletV3.withdrawResendCta : t.value.walletV3.withdrawConfirmCta,
    });
  } finally {
    confirmingSubmit.value = false;
  }
  if (!confirmed) {
    clearSubmitFreeze();
    return;
  }
  // SPEC-7 ⑤ 加载态: 提交先走服务端形态的前置评估;拿到路由前不扣款不跳页。
  // R5: 提交时点重新评估(显示层 computed 只是预览)。异常3: 超时不乐观扣款。
  submitting.value = true;
  // 🔴 重放**不进**前置评估:它是给「新的一笔」用的前置过滤(判当前额度/风控放不放行),
  // 而重放要送的那笔可能**已经在服务端落库了** —— 拿今天的额度去否掉它,并不能把它撤回来,
  // 只会让未收口的那笔永远收不了口(实景实测:可提额跌到冻结金额以下,重放每次都被这里挡住)。
  // 重放的权威是服务端的幂等记录:真不该放行,服务端会明确拒绝,那才是定局、才退役键。
  let fresh: WithdrawalEligibility | null = null;
  if (!pending) {
    try {
      fresh = await requestWithdrawalEligibility(
        snap.account,
        snap.network,
        snap.address,
        snap.maxWithdrawable,
        snap.amount,
      );
    } catch (err) {
      clearSubmitFreeze();
      // The eligibility call is the one server round-trip on this path, so a region
      // refusal surfaces here as a rejection. Translate it; `null` = not a region
      // refusal, so keep the existing timeout message rather than mislabelling a
      // genuine timeout as a region block.
      const geo = geoPolicyUserMessage(err, t.value.geoPolicy);
      // 钱路径上被拦,先说钱的下落 —— 用户第一个念头是「我那笔钱呢」,不是「哪些功能开了」。
      if (geo) toast.error(geo, t.value.geoPolicy.fundsSafeNote);
      else toast.error(t.value.wallet.riskCheckTimeoutTitle, t.value.wallet.riskCheckTimeoutBody);
      return;
    }
    if (fresh.route === "reject" || !fresh.canSubmit || snap.amount > fresh.maxWithdrawableUsdt) {
      clearSubmitFreeze();
      // 拦截必须给原因 + 下一步。并发场景下这条分支最常见的成因是「另一个标签页刚把
      // 今日额度用掉了」——笼统的「暂不能提交」既没原因也没下一步(验收实测三标签页
      // 下 7/10 都落到这句)。额度用完是可判定的,就说清楚它。
      toast.error(fresh.dailyLimitReached ? dailyLimitReachedText.value : t.value.walletV3.submitReasonReviewBlocked);
      return;
    }
  }
  // 🔴 **确认后校验** —— 快照纪律的另一半。冻结件与当前权威值不符即拒单,绝不静默按新值扣款。
  //  ① 身份三元组(账号 / 网络 / 收款地址)。确认期间换号 → 下面的 debitNex 与账单会全落到
  //     新账号,而弹窗展示的是旧账号的数字;地址 / 网络若变了,等于把钱打到用户没确认过的地方。
  //     store 层 submitWithdrawal 也钉死账号,但它管不到本页的 debitNex 与建单入参 —— 两层各管一段。
  //     重放例外只放在**收款地址**这一项上:冻结件里的地址就是上一次真正发出去的那个,
  //     期间换绑过地址不改变「那笔可能已经落库」这个事实,拿新地址去否掉重放,等于把
  //     唯一的收口路径锁死 —— 而重放的地址由服务端按原键的原 body 认。账号与网络不放行。
  if (app.accountKey !== snap.account || network.value !== snap.network || (!pending && boundAddress.value !== snap.address)) {
    clearSubmitFreeze();
    toast.error(t.value.walletV3.withdrawContextStale);
    return;
  }
  //  ② 报价。用与 store 提交边界同一个纯函数复验冻结报价;不成立就走既有「费率已更新,请重试」
  //     分支 —— 重试会按新费率重新报价,由用户重新确认。放在 debitNex **之前**:
  //     让 store 拒单后再回滚 NEX 也能对上账,但那条路多烧一次余额写盘,能不进就不进。
  //     重放不进这道门:冻结件的权威是它自己那份 policyVersion(服务端按它定价并按原键
  //     返回原结果),拿**今天**的费率去复验**上一次**的报价,费率一变就恒不成立 ——
  //     那不是拦住一笔错价单,是让未收口的那笔永远收不了口。
  if (!pending && !quoteStillValid(snap.fee, snap.offset, snap.network)) {
    clearSubmitFreeze();
    toast.error(t.value.walletV3.withdrawFeeStale);
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
  })) {
    clearSubmitFreeze();
    toast.error(t.value.walletV3.withdrawNotSentTitle, t.value.walletV3.withdrawNotSentBody);
    return;
  }
  try {
    const withdrawalId = await app.submitWithdrawal(
      snap.amount,
      snap.network,
      snap.address,
      snap.fee,
      snap.offset,
      snap.policyVersion,
      snap.idempotencyKey,
      // 重放没有本次前置评估(见上),这四项退回默认值。它们只喂本地留痕,
      // 不进 POST body —— 换句话说重放的 body 仍与首次逐字节相同(app.ts submitWithdrawal)。
      fresh?.route ?? "pass",
      fresh?.riskReasons ?? [],
      fresh?.fastLaneApplied ?? false,
      fresh?.waivedGates ?? [],
    );
    forgetWithdrawAttempt(snap.account);
    clearSubmitFreeze();
    if (!withdrawalId) {
      toast.error(t.value.wallet.withdrawInsufficient);
      return;
    }
    uni.navigateTo({ url: `/pages/me/wallet-withdraw-tracking?id=${withdrawalId}`, fail: () => {} });
    return;
  } catch (err) {
    clearSubmitFreeze();
    // 🔴 **按结果分层,不再一律报「费率已更新,请重试」**(2026-08-11 独立审计 P0 的另一半):
    // 那句话把超时/断网/服务端 5xx 全归因成计价问题,并主动把用户推去重试 —— 而重试正是
    // 建出第二张单的动作。三档的分水岭只有一条:这一次在服务端**定局了没有**。
    if (isIdempotencyConflict(err)) {
      // 409 = 服务端这个键已有记录 ⇒ 上一次确实落库了。键已用掉,退役;但绝不能说「再试一次」。
      forgetWithdrawAttempt(snap.account);
      toast.error(t.value.walletV3.withdrawAlreadyOnFileTitle, t.value.walletV3.withdrawAlreadyOnFileBody);
      return;
    }
    if (isSettledRejection(err)) {
      // 服务端完整应答并拒绝 ⇒ 没建单、余额没动。键作废,下一笔重新铸;此时刷费率才对症
      // (计价参数确实可能是被拒的原因)。
      forgetWithdrawAttempt(snap.account);
      await loadWithdrawalPolicy();
      toast.error(t.value.walletV3.withdrawDeclinedTitle, t.value.walletV3.withdrawDeclinedBody);
      return;
    }
    // 结果未知(超时 / 断网 / 5xx / 应答解析不了):请求**可能已经落库**。
    // 键与 body 原样留着 —— 下次点提交按原样重放,服务端同 key 同 body 返回原结果。
    // 🔴 这一支绝不能调 loadWithdrawalPolicy:刷了 policyVersion 就变,重放的 body 跟着变,
    // 正好撞上「同 key + 异 body → 409 + 安全事件」。
    toast.error(t.value.walletV3.withdrawOutcomeUnknownTitle, t.value.walletV3.withdrawOutcomeUnknownBody);
    return;
  }

}

// ── styles ──
// 空态引导卡(brand soft tint,非报错态;卡内嵌套零 border)。
const addrGuideStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--v5-brand) 8%, transparent)",
  borderRadius: "16px",
  padding: "16px",
};
const addrGuideIconStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "10px",
  background: "color-mix(in srgb, var(--v5-brand) 15%, transparent)",
};
const addrGuideCtaStyle: CSSProperties = {
  height: "48px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  // 🔴 亮底文字必须用 --v5-on-brand(主 CTA 同规)。
  color: "var(--v5-on-brand)",
};
// 网络 chips(与地址管理页同语汇;选中 brand-soft,未选 surface)。
function netChipStyle(id: Withdrawal["network"]): CSSProperties {
  const on = network.value === id;
  return {
    minHeight: "44px",
    borderRadius: "12px",
    padding: "8px 6px",
    background: on ? "var(--v5-brand-soft)" : "var(--v5-surface)",
  };
}
function netChipLabelStyle(id: Withdrawal["network"]): CSSProperties {
  return {
    fontSize: "13px",
    fontWeight: 600,
    color: network.value === id ? "var(--v5-brand)" : "var(--v5-ink-2)",
  };
}
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
const metaLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
const amountInputStyle: CSSProperties = {
  background: "transparent",
  fontFamily: "var(--font-v5)",
  fontSize: "26px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
// 地址行(L1 零描边)+ 「管理」入口(tap ≥ 44)。
const boundAddrRowStyle: CSSProperties = {
  minHeight: "48px",
  // 该行贴在页面底上:原 surface-3 对页面底亮色仅 ΔE 2.7(分不出),改 L1
  // (与 goals 的目标输入框同型处理)。行内那颗改绑按钮仍是 surface-2/brand-soft,
  // 对新的白底 ΔE 4.6,不撞色。
  background: "var(--v5-surface)",
  borderRadius: "12px",
  padding: "2px 2px 2px 12px",
  boxSizing: "border-box",
  gap: "8px",
};
const manageEntryStyle: CSSProperties = {
  minHeight: "44px", // tap ≥ 44
  minWidth: "64px",
  padding: "0 14px",
  borderRadius: "999px",
  background: "var(--v5-brand-soft)",
};
const manageEntryTextStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--v5-brand)",
};
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
const warnBoxStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--v5-warning) 10%, transparent)",
  padding: "16px",
};
// 抵扣面板:soft tint 无描边(卡内嵌套禁 border);开着且全额抵扣 → brand,其余 → brand-2。
const nexGateStyle = computed<CSSProperties>(() => ({
  padding: "14px 16px",
  background: offsetWithNex.value && fullyWaived.value
    ? "color-mix(in srgb, var(--v5-brand) 8%, transparent)"
    : "color-mix(in srgb, var(--v5-brand-2) 10%, transparent)",
}));
const nexGateLabelStyle = computed<CSSProperties>(() => ({
  gap: "6px",
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  fontWeight: 500,
  letterSpacing: "0.06em",
  color: offsetWithNex.value ? "var(--v5-brand)" : "var(--v5-brand-2)",
}));
// 自绘开关:外层热区 ≥44pt(负 margin 不撑行高),内层 track 44×26 + knob 20。
const switchHitStyle: CSSProperties = { minWidth: "56px", minHeight: "44px", margin: "-9px -6px" };
const switchTrackStyle = computed<CSSProperties>(() => ({
  width: "44px",
  height: "26px",
  borderRadius: "999px",
  padding: "3px",
  boxSizing: "border-box",
  transition: "background 160ms ease",
  background: offsetToggleDisabled.value
    ? "var(--v5-surface-2)"
    : offsetWithNex.value
      ? "var(--v5-brand)"
      : "var(--v5-surface-3)",
  opacity: offsetToggleDisabled.value ? 0.55 : 1,
}));
const switchKnobStyle = computed<CSSProperties>(() => ({
  width: "20px",
  height: "20px",
  borderRadius: "999px",
  background: offsetToggleDisabled.value
    ? "var(--v5-ink-4)"
    : offsetWithNex.value
      ? "var(--v5-on-brand)"
      : "var(--v5-ink-3)",
  transform: offsetWithNex.value ? "translateX(18px)" : "translateX(0)",
  transition: "transform 160ms ease",
}));
// 费用说明半屏(scrim z79 + panel z80,同 device-deactivate-sheet 范式)。
const feeWhyScrimStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 79,
  background: "rgba(8,8,12,0.45)",
  backdropFilter: "blur(8px) saturate(150%)",
};
const feeWhySheetStyle: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 80,
  borderTopLeftRadius: "16px",
  borderTopRightRadius: "16px",
  background: "var(--v5-surface)",
  borderTop: "1px solid var(--v5-border)",
  padding: "18px 16px calc(env(safe-area-inset-bottom) + 38px)",
};
const feeWhyTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const feeWhyCloseStyle: CSSProperties = {
  width: "32px",
  height: "32px",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
};
const feeWhySectionTitleStyle: CSSProperties = {
  marginTop: "14px",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
const feeWhyBodyStyle: CSSProperties = {
  marginTop: "4px",
  fontSize: "12px",
  color: "var(--v5-ink-3)",
  lineHeight: 1.5,
};
const submitBtnStyle = computed<CSSProperties>(() => ({
  height: "48px",
  borderRadius: "999px",
  background: canSubmit.value ? "var(--v5-brand)" : "var(--v5-surface-2)",
  // 🔴 页面主 CTA。用 --v5-ink 实测对比度 **1.54:1**(暗色主题下亮绿底配浅色字),
  // 换成 --v5-on-brand 是 11.98:1。禁用态是灰底灰字,不走 on-brand。
  color: canSubmit.value ? "var(--v5-on-brand)" : "var(--v5-ink-4)",
  fontFamily: "var(--font-v5)",
  fontSize: "15px",
  fontWeight: 600,
}));
// 快车道提示 —— 品牌色浅底(正向信息,不用告警色);超线时那条 CTA 独占一行撑 44px 热区
const fastLaneBoxStyle: CSSProperties = {
  padding: "12px",
  borderRadius: "16px",
  background: "color-mix(in srgb, var(--v5-brand) 8%, transparent)",
  display: "flex",
};
const fastLaneIconStyle: CSSProperties = {
  width: "24px", height: "24px", borderRadius: "999px",
  background: "color-mix(in srgb, var(--v5-brand) 15%, transparent)",
};
const fastLaneCtaStyle: CSSProperties = { display: "inline-flex", alignItems: "center", minHeight: "44px", marginTop: "2px" };
const fastLaneCtaTextStyle: CSSProperties = { fontSize: "12px", fontWeight: 500, color: "var(--v5-brand)" };
// 撤销是次要动作:同样可点,但视觉权重明显弱于那条建议(转化场景 cancel 必须弱于主 CTA)。
const fastLaneUndoTextStyle: CSSProperties = { fontSize: "12px", color: "var(--v5-ink-4)" };


</script>
