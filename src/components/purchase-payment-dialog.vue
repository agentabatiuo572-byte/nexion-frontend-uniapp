<template>
  <view v-if="showResume && active && !s.open && (pending.length || showHistory && records.length)" class="purchase-payment-resume" :class="{ 'has-close': !showHistory }" :style="barBottom === null ? undefined : { bottom: barBottom + 'px' }" role="status">
    <view v-if="!showHistory" class="purchase-payment-resume__close nx-frosted-button" role="button" tabindex="0" :aria-label="copy.close" @click="payment.dismissResume(pending)" @keydown.enter.prevent="payment.dismissResume(pending)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
    </view>
    <!-- Outside Orders the bar is one line with the count (user 2026-11-22); Orders lists each payment to pick from. -->
    <view v-if="!showHistory" class="purchase-payment__row"><text>{{ fill(copy.resumeCount, { n: pending.length }) }}</text><NxButton :label="copy.viewProgress" variant="link" icon="chevron-right" @click="openPending" /></view>
    <view v-for="row in showHistory ? records : []" :key="row.commandKey" class="purchase-payment__row"><text :style="{ flexBasis: rowBasis(row) }">{{ row.summary }} · {{ rowLabel(row) }}</text><NxButton :label="copy.view" variant="text" @click="payment.resume(row)" /></view>
  </view>

  <!-- Step sheet: method → network / bank confirmation. -->
  <view v-if="sheetOpen && !s.notice" class="pp-mask nx-sheet-fade-in">
    <!-- The tap-to-close layer is a sibling under the sheet (as in NxSheet): uni H5 hands handlers plain-object targets, so
         @click.self never matched and a mask tap closed nothing. It dismisses the sheet; taps on the sheet never reach it. -->
    <view class="pp-scrim" aria-hidden="true" @click="payment.close" />
    <view id="pp-sheet" class="pp-sheet nx-glass-sheet nx-sheet-slide-up" role="dialog" aria-modal="true" :aria-label="sheetTitle">
      <view class="pp-head">
        <!-- Payment steps close only (user 2026-11-22): no back arrow; closing and paying again starts at the methods. -->
        <view class="pp-head__text">
          <text class="pp-title" role="heading">{{ sheetTitle }}</text>
          <view v-if="s.step === 'methods' && deadlineLeft !== null" class="pp-cd" :class="{ 'is-urgent': deadlineLeft < URGENT_MS }">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            <text>{{ fill(copy.closesIn, { t: clock(deadlineLeft) }) }}</text>
          </view>
        </view>
        <view class="pp-circ nx-frosted-button" role="button" tabindex="0" :aria-label="copy.close" @click="closeSheet" @keydown.enter.prevent="closeSheet">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </view>
      </view>

      <text v-if="s.step !== 'methods'" class="pp-steps">{{ fill(s.step === 'bank' ? copy.bankSteps : copy.networkSteps, { name: s.summary }) }}</text>
      <view class="pp-body">
        <template v-if="s.step === 'methods'">
          <view class="pp-prod">
            <image v-if="s.image" class="pp-prod__img" :src="s.image" mode="aspectFit" aria-hidden="true" />
            <view class="pp-prod__text"><text class="pp-prod__name">{{ s.summary }}</text><text v-if="s.orderNo" class="pp-prod__meta">{{ copy.orderNo }} <text class="pp-mono">{{ s.orderNo }}</text></text></view>
            <CheckoutAmount class="pp-prod__amt" :value="s.amount" currency="USD" />
          </view>
          <text class="pp-label">{{ copy.methodLabel }}</text>
          <view class="pp-opts" role="radiogroup" :aria-label="copy.methodLabel" @keydown.down.prevent="moveFocus($event, 1)" @keydown.right.prevent="moveFocus($event, 1)" @keydown.up.prevent="moveFocus($event, -1)" @keydown.left.prevent="moveFocus($event, -1)">
            <view class="pp-opt" :class="{ on: s.method === 'WALLET' }" role="radio" :tabindex="s.method === 'WALLET' ? 0 : -1" :aria-checked="s.method === 'WALLET'" @click="payment.choose('WALLET')" @keydown.enter.prevent="payment.choose('WALLET')">
              <view class="pp-opt__row">
                <view class="pp-opt__ic" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></svg></view>
                <view class="pp-opt__tx"><text class="pp-opt__t">{{ copy.wallet }}</text><text class="pp-opt__h">{{ !balanceKnown ? copy.walletUnavailable : app.user.usdtBalance < 0 ? fill(copy.walletDebt, { amt: walletAmount(-app.user.usdtBalance) }) : fill(copy.walletAvailable, { amt: walletAmount(app.user.usdtBalance) }) }}</text></view>
                <view class="pp-radio" aria-hidden="true" />
              </view>
              <view v-if="shortfall > 0" class="pp-short" @click.stop>
                <text class="pp-short__t">{{ fill(copy.short, { amt: walletAmount(shortfall) }) }}</text>
                <NxButton :label="copy.topup" variant="brand" size="small" @click="payment.topup(shortfall)" />
              </view>
            </view>
            <!-- Unconfigured channels are hidden, never shown as unavailable. -->
            <view v-if="payment.available('HDPAY_BANK')" class="pp-opt" role="radio" :tabindex="s.method === 'HDPAY_BANK' ? 0 : -1" aria-checked="false" @click="payment.choose('HDPAY_BANK')" @keydown.enter.prevent="payment.choose('HDPAY_BANK')">
              <view class="pp-opt__row">
                <view class="pp-opt__ic" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></svg></view>
                <view class="pp-opt__tx"><text class="pp-opt__t">{{ copy.bank }}</text><text class="pp-opt__h">{{ copy.bankHint }}</text></view>
                <view class="pp-radio" aria-hidden="true" />
              </view>
            </view>
            <view v-if="usdtAvailable" class="pp-opt" role="radio" :tabindex="s.method !== 'WALLET' && s.method !== 'HDPAY_BANK' ? 0 : -1" aria-checked="false" @click="payment.choose('USDT')" @keydown.enter.prevent="payment.choose('USDT')">
              <view class="pp-opt__row">
                <view class="pp-opt__ic" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8 8h8" /><path d="M12 8v9" /><path d="M7.5 12c0 1 2 1.6 4.5 1.6s4.5-.6 4.5-1.6" /></svg></view>
                <view class="pp-opt__tx"><text class="pp-opt__t">{{ copy.usdt }}</text><text class="pp-opt__h">{{ copy.usdtHint }}</text></view>
                <view class="pp-radio" aria-hidden="true" />
              </view>
            </view>
          </view>
        </template>

        <template v-else-if="s.step === 'network'">
          <text class="pp-label">{{ copy.networkLabel }}</text>
          <view class="pp-tabs" role="radiogroup" :aria-label="copy.networkLabel" @keydown.right.prevent="moveFocus($event, 1, true)" @keydown.down.prevent="moveFocus($event, 1, true)" @keydown.left.prevent="moveFocus($event, -1, true)" @keydown.up.prevent="moveFocus($event, -1, true)">
            <view v-for="tab in networks" :key="tab.id" class="pp-tab" :class="{ on: s.method === tab.id }" role="radio" :tabindex="!s.originalRecovery && s.method === tab.id ? 0 : -1"
              :aria-disabled="!!s.originalRecovery" :aria-checked="s.method === tab.id" @click="pickNetwork(tab.id)" @keydown.enter.prevent="pickNetwork(tab.id)">
              <view class="pp-opt__tx"><text class="pp-tab__a">{{ tab.title }}</text><text class="pp-tab__b">{{ tab.chain }}</text></view><view class="pp-radio" aria-hidden="true" />
            </view>
          </view>
        </template>

        <!-- Bank shows the same $ fee list as USDT, without a network fee; the ₫ amount stays on the payment page. -->
        <view v-if="s.step !== 'methods'" class="pp-fees">
          <!-- subtotalUsdt is the server's cent amount (business amount + rounding adjustment), so the rows add up to the total. -->
          <view class="pp-kv"><text class="pp-kv__k">{{ copy.subtotal }}</text><text class="pp-kv__v">{{ s.quote ? amount(s.quote.subtotalUsdt) : '—' }}</text></view>
          <view class="pp-kv"><text class="pp-kv__k">{{ copy.channelFee }}</text><text class="pp-kv__v">{{ s.quote ? amount(s.quote.channelFeeUsdt) : '—' }}</text></view>
          <view v-if="s.step === 'network'" class="pp-kv"><text class="pp-kv__k">{{ copy.networkFee }}</text><text class="pp-kv__v">{{ s.quote ? amount(s.quote.networkConfirmFeeUsdt) : '—' }}</text></view>
        </view>
      </view>

      <view class="pp-foot">
        <view class="pp-total" :class="{ 'is-ruled': s.step === 'methods' }">
          <text class="pp-total__k">{{ copy.total }}</text>
          <!-- Bank card amounts use $; USDT only on the wallet and USDT paths. -->
          <CheckoutAmount class="pp-total__v" :value="s.step === 'methods' ? s.amount : s.quote?.totalUsdt ?? null" :currency="s.step === 'bank' ? 'USD' : 'USDT'" />
        </view>
        <template v-if="s.step !== 'methods'">
          <text class="pp-note">{{ s.step === 'bank' ? copy.bankNote : s.method === 'CREGIS_USDT_TRC20' ? copy.gasTrc20 : s.method === 'CREGIS_USDT_ERC20' ? copy.gasErc20 : copy.gasBep20 }}</text>
          <view v-if="s.originalRecovery || s.quote || s.loading || s.retrying" class="pp-auto" role="status"><view class="pp-auto__dot" :class="{ 'is-retry': s.retrying && !s.originalRecovery }" aria-hidden="true" /><text>{{ quoteStatus }}</text></view>
        </template>
        <NxButton class="pp-cta" :label="s.step === 'methods' ? copy.confirm : copy.go" variant="primary" :busy="s.busy" :disabled="!!s.originalRecovery || (s.step === 'methods' ? !walletEnough : !s.quote || s.loading)" @click="s.step === 'methods' ? payment.confirm() : payment.proceed()" />
      </view>
    </view>
  </view>

  <!-- Payment page: USDT address, bank in progress, or funds received. -->
  <view v-if="pageOpen" id="pp-page" class="pp-page" role="dialog" aria-modal="true" :aria-label="pageTitle" :style="{ paddingTop: statusBar + 'px' }">
    <DeviceStatusBar />
    <view class="pp-nav">
      <!-- The funds-received status page shows no top control; 查看订单 is its way on. -->
      <view v-if="received" class="pp-nav__gap" aria-hidden="true" />
      <view v-else class="pp-circ nx-frosted-button" role="button" tabindex="0" :aria-label="copy.close" @click="leavePage" @keydown.enter.prevent="leavePage">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </view>
      <text class="pp-nav__t" role="heading">{{ pageTitle }}</text>
      <view class="pp-nav__gap" aria-hidden="true" />
    </view>

    <view v-if="received" class="pp-scroll pp-done">
      <NxResultHead tone="success" :title="copy.received" :description="copy.provisioning" />
      <view class="pp-track" role="list" :aria-label="copy.provisionTrack">
        <view class="pp-step" role="listitem"><view class="pp-seg is-done" /><view class="pp-dot is-done"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg></view><text class="pp-step__l">{{ copy.trackPaid }}</text></view>
        <view class="pp-step" role="listitem"><view class="pp-seg" /><view class="pp-dot is-current" /><text class="pp-step__l">{{ copy.trackProvision }}</text></view>
        <!-- Not reached yet: dot only (DS-30). -->
        <view class="pp-step" role="listitem" aria-hidden="true"><view class="pp-dot" /></view>
      </view>
      <view class="pp-receipt">
        <view class="pp-kv"><text class="pp-kv__k">{{ copy.paidAmount }}</text><CheckoutAmount class="pp-receipt__amt" :value="s.intent?.totalUsdt ?? null" :currency="isBank ? 'USD' : 'USDT'" /></view>
        <view class="pp-kv"><text class="pp-kv__k">{{ copy.paidMethod }}</text><text class="pp-kv__v">{{ methodName }}</text></view>
        <view class="pp-kv"><text class="pp-kv__k">{{ copy.product }}</text><text class="pp-kv__v">{{ s.summary }}</text></view>
        <view v-if="s.orderNo" class="pp-kv"><text class="pp-kv__k">{{ copy.orderNo }}</text><text class="pp-kv__v pp-mono">{{ s.orderNo }}</text></view>
      </view>
    </view>

    <view v-else class="pp-scroll pp-pay" :class="{ 'has-bar': (isBank || s.canResubmit) && !conclusion || networkPaused && s.orderNo }">
      <view class="pp-card pp-hero nx-tint">
        <text class="pp-hero__lab">{{ conclusion ? copy.total : copy.payable }}</text>
        <view class="pp-hero__row">
          <CheckoutAmount class="pp-hero__amt" :value="fees?.totalUsdt ?? null" :currency="isBank ? 'USD' : 'USDT'" />
          <view v-if="!isBank && !conclusion && fees" class="pp-copy pp-copy--plain" role="button" tabindex="0" :aria-label="copy.copyAmount" @click="copyAmount" @keydown.enter.prevent="copyAmount">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
          </view>
        </view>
        <view v-if="payLeft !== null && !confirming && !conclusion" class="pp-cd" :class="{ 'is-urgent': urgent }">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          <text>{{ fill(urgent ? (isBank ? copy.urgentBank : copy.urgent) : (isBank ? copy.payWithinBank : copy.payWithin), { t: clock(payLeft) }) }}</text>
        </view>
        <text v-if="confirming" class="pp-note" role="status">{{ copy.confirmWait }}</text>
        <text class="pp-hero__meta">{{ s.summary }}<template v-if="s.orderNo"> · {{ copy.orderNo }} <text class="pp-mono">{{ s.orderNo }}</text></template></text>
      </view>

      <view class="pp-card">
        <view class="pp-wait" :class="{ 'is-alone': isBank || conclusion, 'is-concluded': conclusion, 'is-paused': networkPaused }" role="status" :style="{ '--pp-st': waitTone }">
          <view class="pp-wait__head">
            <!-- Nothing runs while the page waits for the user to resend, so the spinner stays only for live checks (07 §7.1). -->
            <view v-if="!conclusion && !s.canResubmit" class="pp-wait__spin" aria-hidden="true" />
            <text class="pp-wait__t">{{ conclusion ? conclusion.title : waitTitle }}<template v-if="urgent && ready"> · <text class="pp-wait__em">{{ copy.urgentTag }}</text></template></text>
          </view>
          <text v-if="conclusion" class="pp-wait__s">{{ conclusion.body }}</text>
          <text v-else-if="ready && !waitingOffline" class="pp-wait__s">{{ urgent ? copy.urgentHint : isBank ? copy.waitingBank : copy.waitingUsdt }}</text>
        </view>
        <template v-if="!isBank && ready">
          <view class="pp-card__top"><text class="pp-card__t">{{ copy.address }}</text><NxTag tone="brand" :label="networkName" /></view>
          <view v-if="qrImage" class="pp-qr"><image class="pp-qr__img" :src="qrImage" mode="aspectFit" :aria-label="copy.addressQr" /></view>
          <text v-if="ready" class="pp-cap">{{ copy.scan }}</text>
          <view v-if="s.intent?.address" class="pp-addr">
            <NxCodeValue class="pp-addr__t" :value="s.intent.address" :label="copy.address" full :copyable="false" />
            <view class="pp-copy nx-frosted-button" role="button" tabindex="0" :aria-label="copy.copyAddress" @click="copyAddress" @keydown.enter.prevent="copyAddress">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
            </view>
          </view>
        </template>
      </view>

      <view v-if="fees" class="pp-card">
        <view class="pp-kv"><text class="pp-kv__k">{{ copy.subtotal }}</text><text class="pp-kv__v">{{ amount(fees.subtotalUsdt) }}</text></view>
        <view class="pp-kv"><text class="pp-kv__k">{{ copy.channelFee }}</text><text class="pp-kv__v">{{ amount(fees.channelFeeUsdt) }}</text></view>
        <view v-if="!isBank" class="pp-kv"><text class="pp-kv__k">{{ copy.networkFee }}</text><text class="pp-kv__v">{{ amount(fees.networkConfirmFeeUsdt) }}</text></view>
        <view class="pp-div" />
        <view class="pp-kv"><text class="pp-kv__k">{{ copy.total }}</text><text class="pp-kv__v">{{ isBank ? `$${amount(fees.totalUsdt)}` : `${amount(fees.totalUsdt)}\u00A0USDT` }}</text></view>
      </view>

      <view v-if="!conclusion" class="pp-warn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
        <text>{{ isBank ? copy.warnBank : (s.intent?.paymentMethod ?? s.pending?.paymentMethod) === 'CREGIS_USDT_TRC20' ? copy.warnTrc20 : (s.intent?.paymentMethod ?? s.pending?.paymentMethod) === 'CREGIS_USDT_ERC20' ? copy.warnErc20 : copy.warnBep20 }}</text>
      </view>
    </view>
    <!-- The page's main action sits in the thumb zone (DS-30). -->
    <view v-if="!received && (s.canResubmit || (isBank && cashierUrl)) && !conclusion" class="pp-bar nx-glass-bar">
      <NxButton v-if="s.canResubmit" class="pp-reopen" :label="copy.retryPay" variant="primary" :busy="s.busy" :disabled="s.reading" @click="payment.retryOriginal" />
      <NxButton v-else class="pp-reopen" :label="copy.reopen" variant="primary" :disabled="!ready" @click="payment.openCashier" />
    </view>
    <view v-if="received" class="pp-bar pp-bar--done nx-glass-bar">
      <text class="nx-tray-note">{{ copy.leaveOk }}</text>
      <NxButton :label="copy.viewOrder" variant="primary" @click="openPaidOrder" />
    </view>
    <view v-if="networkPaused && s.orderNo" class="pp-bar nx-glass-bar">
      <NxButton :label="copy.viewOrder" variant="primary" @click="payment.openOrder" />
    </view>
  </view>

  <!-- Bank payment page opened inside the App under a UVEL bar. -->
  <view v-if="active && s.open && s.cashier && cashierUrl" class="pp-cashier">
    <DeviceStatusBar />
    <view class="pp-cashier__bar" :style="{ paddingTop: statusBar + 'px' }">
      <view class="pp-cashier__row">
        <view class="pp-circ nx-frosted-button" role="button" tabindex="0" :aria-label="copy.closeCashier" @click="leaveCashier" @keydown.enter.prevent="leaveCashier">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </view>
        <view class="pp-cashier__mid">
          <text class="pp-cashier__t">{{ copy.cashierTitle }}</text>
          <view v-if="payLeft !== null" class="pp-cashier__cd" :class="{ 'is-urgent': urgent }">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            <text>{{ fill(copy.cashierCloses, { t: clock(payLeft) }) }}</text>
          </view>
        </view>
        <view class="pp-nav__gap" aria-hidden="true" />
      </view>
      <view class="pp-cashier__lock">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        <text>{{ copy.secure }}</text>
      </view>
    </view>
    <view class="pp-cashier__frame">
      <!-- #ifdef H5 -->
      <iframe :src="cashierUrl" :title="copy.bankPage" referrerpolicy="no-referrer" sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox" />
      <!-- #endif -->
    </view>
    <!-- The shared bottom tray (04 §4.0): note above, the save action as a plain text button, the primary on its right.
         The bank page ends above the tray's reserved space, so its QR code is never covered (CASHIER_FOOT).
         The bank page does not close itself; returning keeps the automatic checks running.
         Saving exists only in the native App, once the bank page has loaded. -->
    <view class="pp-cashier__foot" aria-hidden="true" />
    <view class="pp-cashier__tray nx-glass-bar">
      <text class="pp-cashier__note nx-tray-note">{{ copy.autoReturn }}</text>
      <view class="pp-cashier__row2">
        <NxButton v-if="canSaveCashierImage" variant="secondary" :label="copy.cashierSaveQr" :busy="savingQr" @click="saveQr" />
        <NxButton class="pp-cashier__done" :label="copy.paidReturn" variant="primary" @click="payment.closeCashier" />
      </view>
    </view>
  </view>

  <NxNoticeDialog v-if="active && s.open && notice && !acknowledgementOnly" :open="true" :title="notice.title" :body="notice.body" :primary="notice.primary" :secondary="notice.secondary"
    :icon="notice.icon" :tone="notice.tone" :busy="s.busy" @primary="notice.onPrimary" @secondary="notice.onSecondary" />
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue';
import { onShow, onHide, useVisibleInterval } from '@/composables/use-tab-page-lifecycle';
import { useDialogA11y } from '@/composables/use-dialog-a11y';
import NxButton from '@/components/ui/nx-button.vue';
import NxNoticeDialog from '@/components/ui/nx-notice-dialog.vue';
import NxResultHead from '@/components/ui/nx-result-head.vue';
import NxTag from '@/components/ui/nx-tag.vue';
import NxCodeValue from '@/components/ui/nx-code-value.vue';
import CheckoutAmount from '@/components/checkout/CheckoutAmount.vue';
import DeviceStatusBar from '@/components/device/device-status-bar.vue';
import { usePurchasePayment, purchaseConclusion, refreshPendingPayments, type PurchaseNotice } from '@/store/purchase-payment';
import { foregroundReadAllowed } from '@/lib/foreground-read';
import { useApp } from '@/store/app';
import { useLocaleStore } from '@/store/locale';
import { useT } from '@/i18n/use-t';
import { purchasePaymentCopy, paymentRowStatus, fillCopy as fill } from '@/lib/purchase-payment-copy';
import { checkoutFlowCopy } from '@/lib/checkout-flow-copy';
import { purchasePaymentTiming } from '@/lib/purchase-payment-timing';
import { appReadOnline } from '@/lib/foreground-read';
import { formatGroupedAmount } from '@/lib/amount-display';
import { validateHostedPaymentUrl } from '@/lib/hosted-payment';
import { h5DevicePreviewStatusBarHeight } from '@/lib/device-preview';
import { toast } from '@/store/ui';
import { navTo } from '@/lib/route';
import type { ExternalPaymentMethod } from '@/api/purchase-payment-api';
import qrcode from 'qrcode-generator';
const payment = usePurchasePayment(), s = payment.state, app = useApp(), locale = useLocaleStore();
// The order detail shows its own payment state in the hero, so it hides the floating bar.
const props = withDefaults(defineProps<{ showHistory?: boolean; showResume?: boolean }>(), { showHistory: false, showResume: true });
const URGENT_MS = 5 * 60000;
// Space the bank page leaves for the tray (04 §4.0 multi-row tray: its height + 38): tray 108 (8 + note 4 + 32 for two
// lines + gap 8 + button 48 + 8) + 22 off the screen bottom + 16 above it. Fixed whether or not the save button shows, so the native view never resizes.
const CASHIER_FOOT = 146;
const active = ref(true);
const copy = computed(() => purchasePaymentCopy(locale.code));
const t = useT();
const retryMessage = computed(() => s.retryNotice ? checkoutFlowCopy(locale.code)[s.retryNotice] : '');
const unsettled = computed(() => { app.accountKey; s.revision; return payment.pending(); });
// The bar counts payments still under way; a delivered one is finished and is found on its order.
const pending = computed(() => unsettled.value.filter(row => !row.businessDelivered && !payment.resumeDismissed(row)));
// One payment opens directly; several are listed on Orders.
function openPending() { if (pending.value.length === 1) void payment.resume(pending.value[0]); else void navTo('/pages/store/orders'); }
// A delivered purchase the caller already confirmed needs no follow-up, so it leaves the bar.
const records = computed(() => { app.accountKey; s.revision; return payment.records().filter(row => !row.validated); });
// Unfinished payments are read while a page that can show the bar is visible (03 §3.5.2), closed rows included: an ended
// payment leaves the bar, and a closed one returns when its status changes.
const resumeWatched = computed(() => props.showResume && active.value && !s.open && unsettled.value.length > 0);
function readResumeRows() { const accountKey = app.accountKey; void refreshPendingPayments(accountKey, () => resumeWatched.value && app.accountKey === accountKey && foregroundReadAllowed()); }
useVisibleInterval(readResumeRows, 15000, () => resumeWatched.value);
// The bar floats 12px above what sits at the bottom of the page, the tab bar, the floating support button or the
// page's action tray, so it never covers or touches them (02: nothing covers the support button); their heights differ by page and state, so they are measured while the bar shows.
const barShown = computed(() => props.showResume && active.value && !s.open && (pending.value.length > 0 || props.showHistory && records.value.length > 0));
const barBottom = ref<number | null>(null);
function placeBar() {
  uni.createSelectorQuery().selectAll('.nx-tabbar-pill, .nx-glass-bar, .nx-support-bubble').boundingClientRect(found => {
    const tops = (Array.isArray(found) ? found : [found]).filter(rect => rect && (rect.height ?? 0) > 0).map(rect => rect.top as number);
    barBottom.value = tops.length ? Math.max(0, uni.getSystemInfoSync().windowHeight - Math.min(...tops) + 12) : null;
  }).exec();
}
watch(() => barShown.value && s.revision, shown => { if (shown !== false) setTimeout(placeBar, 50); }, { immediate: true });
useVisibleInterval(placeBar, 2000, () => barShown.value);
const statusBar = (() => { try { return uni.getSystemInfoSync().statusBarHeight || h5DevicePreviewStatusBarHeight(); } catch { return h5DevicePreviewStatusBarHeight(); } })();

const balanceKnown = computed(() => Number.isFinite(app.user.usdtBalance) && app.remoteFleetHasSnapshot);
const walletEnough = computed(() => Number(s.amount) === 0 || balanceKnown.value && app.user.usdtBalance >= Number(s.amount));
const shortfall = computed(() => balanceKnown.value && Number(s.amount) > 0 ? Math.max(0, Number(s.amount) - app.user.usdtBalance) : 0);
const usdtAvailable = computed(() => payment.available('CREGIS_USDT_BSC') || payment.available('CREGIS_USDT_ERC20') || payment.available('CREGIS_USDT_TRC20'));
const networks = computed(() => [
  { id: 'CREGIS_USDT_ERC20' as const, title: copy.value.erc20, chain: copy.value.erc20Chain },
  { id: 'CREGIS_USDT_BSC' as const, title: copy.value.bep20, chain: copy.value.bep20Chain },
  { id: 'CREGIS_USDT_TRC20' as const, title: copy.value.trc20, chain: copy.value.trc20Chain },
].filter(tab => payment.available(tab.id)));
// A concluded payment has nothing left to offer behind its notice.
const sheetOpen = computed(() => active.value && s.open && !s.pending && !s.concluded);
const pageOpen = computed(() => active.value && s.open && !!s.pending && !s.concluded);
const sheetTitle = computed(() => s.step === 'network' ? copy.value.networkTitle : s.step === 'bank' ? copy.value.bankTitle : copy.value.title);
const fees = computed(() => s.intent ?? s.quote);
const isBank = computed(() => (s.intent?.paymentMethod ?? s.pending?.paymentMethod) === 'HDPAY_BANK');
const received = computed(() => s.intent?.status === 'FUNDS_CONFIRMED');
const ready = computed(() => timing.value.canPay && (isBank.value ? !!s.intent?.paymentUrl : !!s.intent?.address));
const networkName = computed(() => {
  const method = s.intent?.paymentMethod ?? s.pending?.paymentMethod ?? s.pausedPaymentMethod;
  return method === 'CREGIS_USDT_TRC20' ? copy.value.trc20 : method === 'CREGIS_USDT_ERC20' ? copy.value.erc20 : copy.value.bep20;
});
const methodName = computed(() => isBank.value ? copy.value.bank : networkName.value);
const pageTitle = computed(() => received.value ? copy.value.resultTitle : isBank.value ? copy.value.bankTitle : copy.value.usdtPage);
const cashierUrl = computed(() => timing.value.canPay && s.intent?.paymentUrl ? validateHostedPaymentUrl(s.intent.paymentUrl) ?? '' : '');
const qrImage = computed(() => { if (!s.intent?.address || !ready.value) return ''; const qr = qrcode(0, 'M'); qr.addData(s.intent.address); qr.make(); return qr.createDataURL(6, 1); });

const now = ref(Date.now());
watch(() => active.value && s.open, open => { if (open) now.value = Date.now(); }, { flush: 'sync' });
useVisibleInterval(() => { now.value = Date.now(); }, 1000, () => active.value && s.open);
const deadlineLeft = computed(() => s.deadlineAt === null ? null : Math.max(0, s.deadlineAt - now.value));
const quoteLeft = computed(() => s.quote ? Math.max(0, Date.parse(s.quote.expiresAt) - now.value) : null);
// The payment page counts to whichever closes first: the intent or the order.
const timing = computed(() => purchasePaymentTiming(s.intent, now.value, s.deadlineAt));
const payLeft = computed(() => timing.value.left);
const confirming = computed(() => timing.value.confirming);
const networkPaused = computed(() => timing.value.networkPaused);
const urgent = computed(() => payLeft.value !== null && payLeft.value < URGENT_MS);
const waitingOffline = computed(() => !appReadOnline.value || s.disconnected);
const waitTone = computed(() => waitingOffline.value || conclusion.value ? 'var(--v5-warning)' : urgent.value && ready.value ? 'var(--v5-danger)' : 'var(--v5-brand)');
const quoteStatus = computed(() => {
  const c = copy.value;
  if (s.originalRecovery) return c.checkingOriginalPayment;
  if (retryMessage.value) return retryMessage.value;
  if (s.retrying) return c.retrying;
  return s.quote && quoteLeft.value !== null ? fill(c.quoteValid, { t: clock(quoteLeft.value) }) : c.loadingFees;
});
const waitTitle = computed(() => {
  const c = copy.value;
  if (waitingOffline.value && !retryMessage.value) return c.offline;
  if (s.originalRecovery) return c.checkingOriginalPayment;
  if (s.canResubmit) return c.originalPaymentNotFoundRetry;
  if (s.busy && !s.intent) return c.creating;
  if (retryMessage.value) return retryMessage.value;
  if (confirming.value) return c.confirming;
  return ready.value ? c.waiting : c.checkingOriginalPayment;
});
watch(() => timing.value.canPay, (canPay) => { if (!canPay && s.cashier) payment.closeCashier(); });

type Notice = { title: string; body: string; primary: string; secondary?: string; icon: 'alert' | 'clock' | 'shield' | 'failed' | 'info'; tone: 'warning' | 'danger' | 'brand' | 'neutral'; onPrimary: () => void; onSecondary: () => void };
const dismiss = () => payment.notify('');
function noticeFor(kind: PurchaseNotice): Notice | null {
  const c = copy.value, order = s.kind === 'ORDER_PAY' && !!s.orderNo;
  // A reloaded payment has no way to order again (PRD §6).
  const refused = { icon: 'info' as const, tone: 'warning' as const, ...(s.coldResume
    ? { primary: c.viewOrder, secondary: c.close, onPrimary: payment.openOrder, onSecondary: payment.close }
    : { primary: c.reorder, secondary: c.viewOrder, onPrimary: payment.reorder, onSecondary: payment.openOrder }) };
  const toOrder = { secondary: order ? c.viewOrder : c.close, onSecondary: order ? payment.openOrder : payment.close };
  switch (kind) {
    // The order exists but no payment started yet: it stays for later and the close still ends on the store home.
    case 'keepOrder': return { icon: 'info', tone: 'warning', title: c.keepOrderTitle, body: c.keepOrderBody, primary: c.continuePay, secondary: c.leave, onPrimary: dismiss, onSecondary: payment.leaveToStore };
    case 'reminder': return s.method === 'HDPAY_BANK'
      ? { icon: 'shield', tone: 'brand', title: c.remindBankTitle, body: c.remindBank, primary: c.remindOk, secondary: c.back, onPrimary: payment.confirm, onSecondary: dismiss }
      : { icon: 'shield', tone: 'brand', title: c.remindUsdtTitle, body: fill(s.method === 'CREGIS_USDT_TRC20' ? c.remindTrc20 : s.method === 'CREGIS_USDT_ERC20' ? c.remindErc20 : c.remindBep20, { amt: s.quote ? amount(s.quote.totalUsdt) : '—' }), primary: c.remindOk, secondary: c.back, onPrimary: payment.confirm, onSecondary: dismiss };
    case 'timeShort': return { icon: 'clock', tone: 'warning', title: c.timeShortTitle, body: fill(c.timeShort, { n: Math.max(1, Math.ceil((deadlineLeft.value ?? 0) / 60000)) }), primary: c.useWallet, secondary: c.continueAnyway, onPrimary: () => { dismiss(); payment.back(); }, onSecondary: () => payment.notify('reminder') };
    case 'timeout': return order
      ? s.coldResume
        ? { icon: 'clock', tone: 'neutral', title: c.timeoutTitle, body: c.timeout, primary: c.viewOrder, secondary: c.close, onPrimary: payment.openOrder, onSecondary: payment.close }
        : { icon: 'clock', tone: 'neutral', title: c.timeoutTitle, body: c.timeout, primary: c.reorder, secondary: c.viewOrder, onPrimary: payment.reorder, onSecondary: payment.openOrder }
      : { icon: 'clock', tone: 'neutral', title: c.timeoutOtherTitle, body: c.timeoutOther, primary: c.ok, onPrimary: payment.close, onSecondary: payment.close };
    case 'bankFailed': return s.coldResume
      ? { icon: 'failed', tone: 'danger', title: c.bankFailedTitle, body: c.bankFailed, primary: order ? c.continuePay : c.ok, secondary: order ? c.viewOrder : c.close, onPrimary: order ? () => payment.restart('methods') : payment.close, onSecondary: order ? payment.openOrder : payment.close }
      : { icon: 'failed', tone: 'danger', title: c.bankFailedTitle, body: c.bankFailed, primary: c.retryPay, secondary: c.switchMethod, onPrimary: () => payment.restart('bank'), onSecondary: () => payment.restart('methods') };
    case 'review': return { icon: 'info', tone: 'warning', title: c.reviewTitle, body: s.intent?.reason === 'PAYMENT_AMOUNT_MISMATCH' ? c.reviewMismatch : c.reviewOther, primary: c.support, onPrimary: payment.support, ...toOrder };
    case 'late': return { icon: 'info', tone: 'warning', title: c.lateTitle, body: c.late, primary: c.support, onPrimary: payment.support, ...toOrder };
    case 'delivery': return { icon: 'alert', tone: 'warning', title: c.deliveryTitle, body: c.delivery, primary: c.support, onPrimary: payment.support, ...toOrder };
    case 'leave': return { icon: 'alert', tone: 'warning', title: networkPaused.value ? fill(c.networkPausedTitle, { network: networkName.value }) : c.leaveTitle,
      // Trial conversion, trade-in and capacity payments have no order page; they resume from Orders.
      body: networkPaused.value ? c.networkPaused : order ? c.leaveBody : c.leaveBodyNoOrder, primary: networkPaused.value ? c.back : c.continuePay, secondary: c.leave, onPrimary: networkPaused.value ? dismiss : continuePaying, onSecondary: payment.leaveToStore };
    case 'networkPaused': return { icon: 'info', tone: 'warning', title: fill(c.networkPausedTitle, { network: networkName.value }), body: c.networkPaused,
      primary: order ? c.viewOrder : c.ok, onPrimary: order ? payment.openOrder : payment.close,
      ...(order ? { secondary: c.close, onSecondary: payment.close } : { onSecondary: payment.close }) };
    // The sheet stays open on the new amount, so paying again is the second confirmation.
    case 'quoteChanged': return { icon: 'info', tone: 'warning', title: c.quoteChangedTitle,
      body: s.quote ? fill(c.quoteChanged, { amt: s.method === 'HDPAY_BANK' ? `$${amount(s.quote.totalUsdt)}` : `${amount(s.quote.totalUsdt)}\u00A0USDT` }) : c.changed,
      primary: c.ok, onPrimary: dismiss, onSecondary: dismiss };
    case 'changed': return { icon: 'info', tone: 'warning', title: c.changedTitle, body: c.changed, primary: order ? c.viewOrder : c.ok, onPrimary: order ? payment.openOrder : payment.close, ...(order ? { secondary: c.close, onSecondary: payment.close } : { onSecondary: payment.close }) };
    // A refusal with only one way out is told in a toast as the sheet closes (03 §3.5).
    case 'rejectTradeinBusy':
    case 'rejectTradeinWalletOnly':
    case 'rejectTradeinOwner':
    case 'rejectQuotaPaused':
    case 'rejectQuotaMonthFull':
    case 'rejectQuotaSoldOut':
    case 'rejectCapacitySourceChanged':
    case 'trialConversionClosed':
    case 'trialNotConvertible': {
      const flow = checkoutFlowCopy(locale.code);
      return { icon: 'info', tone: 'warning', title: flow[`${kind}Title`], body: flow[`${kind}Body`], primary: c.ok, onPrimary: payment.close, onSecondary: payment.close };
    }
    // A refusal with a next step asks: the action is the primary button, closing the quiet one.
    case 'rejectConditionsUnmet':
    case 'rejectGateConditionsUnmet':
    case 'rejectPurchaseSetup': {
      const flow = checkoutFlowCopy(locale.code), setup = kind === 'rejectPurchaseSetup';
      return { icon: 'info', tone: 'warning', title: setup ? flow.rejectPurchaseSetupTitle : flow.rejectConditionsUnmetTitle, body: flow.noCharge,
        primary: setup ? c.support : t.value.tradein.purchaseViewConditions, secondary: c.close,
        onPrimary: setup ? payment.support : payment.openConditions, onSecondary: payment.close };
    }
    case 'orderExpired': return { ...refused, title: c.orderExpiredTitle, body: c.orderExpired };
    case 'orderClosed': return { ...refused, title: c.orderClosedTitle, body: c.orderClosed };
    // There is no order to open, so only ordering again remains.
    case 'orderMissing': return s.coldResume
      ? { ...refused, title: c.orderMissingTitle, body: c.orderMissing, primary: c.close, secondary: undefined, onPrimary: payment.close }
      : { ...refused, title: c.orderMissingTitle, body: c.orderMissing, secondary: c.close, onSecondary: payment.close };
    case 'existing': return order
      ? { icon: 'info', tone: 'warning', title: c.existingTitle, body: c.existing, primary: c.viewOrder, secondary: c.support, onPrimary: payment.openOrder, onSecondary: payment.support }
      : { icon: 'info', tone: 'warning', title: c.existingTitle, body: c.existing, primary: c.ok, secondary: c.support, onPrimary: payment.close, onSecondary: payment.support };
    case 'originalUnavailable': return { icon: 'info', tone: 'neutral', title: c.originalPaymentUnavailableTitle,
      body: c.originalPaymentUnavailableBody, primary: c.choosePaymentMethodAgain, secondary: c.support, onPrimary: payment.choosePaymentMethodAgain, onSecondary: payment.support };
    case 'gone': return order
      ? { icon: 'info', tone: 'warning', title: c.goneTitle, body: c.gone, primary: c.viewOrder, secondary: c.close, onPrimary: payment.openOrder, onSecondary: payment.close }
      : { icon: 'info', tone: 'warning', title: c.goneTitle, body: c.gone, primary: c.ok, onPrimary: payment.close, onSecondary: payment.close };
    default: return null;
  }
}
const notice = computed(() => noticeFor(s.notice));
const TOAST_NOTICES: PurchaseNotice[] = ['timeout', 'gone', 'changed', 'orderMissing', 'networkPaused', 'quoteChanged', 'rejectTradeinBusy', 'rejectTradeinWalletOnly', 'rejectTradeinOwner',
  'rejectQuotaPaused', 'rejectQuotaMonthFull', 'rejectQuotaSoldOut', 'rejectCapacitySourceChanged', 'trialConversionClosed', 'trialNotConvertible'];
const acknowledgementOnly = computed(() => !!notice.value && !notice.value.secondary && TOAST_NOTICES.includes(s.notice));
// The notice's only exit runs at once (close, or stay on the sheet for a new quote), and a toast says what happened.
watch(() => active.value && s.open && acknowledgementOnly.value, show => {
  if (!show || !notice.value) return;
  const { title, body, onPrimary } = notice.value;
  onPrimary();
  toast.warn(title, body);
}, { immediate: true });
// Both final results and a reversible network pause hide all instructions to send funds.
const conclusion = computed(() => networkPaused.value
  ? { title: fill(copy.value.networkPausedTitle, { network: networkName.value }), body: copy.value.networkPaused }
  : noticeFor(purchaseConclusion(s.intent)));

type ResumeRow = ReturnType<typeof payment.records>[number];
function rowLabel(row: ResumeRow) { return paymentRowStatus(copy.value, row); }
// Footer rule (as in referral-progress): the note stays beside its action while it fits in two lines. Its basis is
// about half its one-line width (CJK about 1em, other scripts about 0.55em per character) plus 2.5em for word breaks,
// so the row wraps, putting the action at the bottom-right, only when the note would need a third line.
function rowBasis(row: ResumeRow) {
  let em = 2.5;
  for (const ch of `${row.summary} · ${rowLabel(row)}`) em += /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 0.5 : 0.275;
  return `${em.toFixed(1)}em`;
}
function amount(value: string | number) { return formatGroupedAmount(value); }
function walletAmount(value: number) { return formatGroupedAmount(value, app.user.usdtBalance < 0 ? 6 : 2); }
function clock(ms: number) { const total = Math.ceil(ms / 1000); return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; }
function pickNetwork(method: ExternalPaymentMethod) { if (s.method !== method) void payment.select(method); }
function copyText(data: string, message: string) { uni.setClipboardData({ data, showToast: false, success: () => toast.success(message) }); }
function copyAddress() { if (s.intent?.address) copyText(s.intent.address, copy.value.copied); }
function copyAmount() { const value = fees.value?.totalUsdt; if (value) copyText(value, copy.value.amountCopied); }
/** Arrow keys move through a radio group; in the network tabs they also choose the network. */
function moveFocus(event: KeyboardEvent, delta: number, choose = false) {
  const items = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])'));
  const next = items[(items.indexOf(document.activeElement as HTMLElement) + delta + items.length) % items.length];
  next?.focus();
  if (choose && next) next.click();
}
// The top close ends the payment on the store home; a payment already started asks first (user 2026-11-22).
function leavePage() { if (received.value) payment.leaveToStore(); else payment.notify('leave'); }
// The bank page sits in a native view above the notice, so it closes before the question is asked.
// The question opens after the bank page has closed and handed focus back, so the question keeps focus.
function leaveCashier() { payment.closeCashier(); void nextTick(() => payment.notify('leave')); }
// The method sheet's close ends on the store home too (user 2026-11-22); an order already placed asks first.
function closeSheet() { if (s.kind === 'ORDER_PAY' && s.orderNo) payment.notify('keepOrder'); else payment.leaveToStore(); }
// A payment without an order (trial, trade-in, capacity) is followed from Orders.
function openPaidOrder() { if (s.kind === 'ORDER_PAY' && s.orderNo) payment.openOrder(); else payment.openOrders(); }
// Continuing a bank payment means its bank page; other payments stay on their payment page.
function continuePaying() { dismiss(); if (isBank.value && ready.value) payment.openCashier(); }

// A notice over the sheet owns Escape, Tab and back until it is answered.
useDialogA11y(computed(() => sheetOpen.value && !s.notice), '#pp-sheet', payment.close, true, 3);
useDialogA11y(computed(() => pageOpen.value && !s.cashier && !s.notice), '#pp-page', leavePage, true, 3);
useDialogA11y(computed(() => active.value && s.open && s.cashier), '.pp-cashier', payment.closeCashier, true, 4);

const visibleCashierUrl = computed(() => active.value && s.open && s.cashier ? cashierUrl.value : '');
const cashierLoaded = ref(false);
const canSaveCashierImage = computed(() => !!visibleCashierUrl.value && cashierLoaded.value);
type CashierImageResult = 'saved' | 'permission-denied' | 'failed' | 'unavailable';

async function saveCashierImage(): Promise<CashierImageResult> {
  // #ifdef APP-PLUS
  const view = cashierView;
  const Bitmap = plus.nativeObj.Bitmap;
  if (!view || !Bitmap || !canSaveCashierImage.value || savingCashierImage) return 'unavailable';
  savingCashierImage = true;
  let bitmap: PlusNativeObjBitmap | undefined;
  const id = `uvel-cashier-${Date.now()}`;
  const path = `_doc/${id}.png`;
  try {
    if (!await requestCashierWritePermission()) return 'permission-denied';
    if (cashierView !== view || !canSaveCashierImage.value) return 'unavailable';
    const capture = bitmap = new Bitmap(id);
    await new Promise<void>((resolve, reject) => view.draw(capture, resolve, reject, { check: true }));
    await new Promise<void>((resolve, reject) => capture.save(path, { format: 'png' }, () => resolve(), reject));
    try {
      await new Promise<void>((resolve, reject) => plus.gallery.save(path, () => resolve(), reject));
    } catch {
      // HTML5+ accepts the permission name as a string, though its declaration types the enum object.
      const galleryPermission = 'GALLERY' as unknown as PlusNavigatorPermissionNames;
      return plus.navigator.checkPermission(galleryPermission) === 'denied' ? 'permission-denied' : 'failed';
    }
    return 'saved';
  } catch {
    return 'failed';
  } finally {
    savingCashierImage = false;
    if (bitmap) {
      bitmap.clear();
      plus.io.resolveLocalFileSystemURL(path, entry => entry.remove(), () => {});
    }
  }
  // #endif
  // #ifndef APP-PLUS
  return 'unavailable';
  // #endif
}

defineExpose({ canSaveCashierImage, saveCashierImage });

const savingQr = ref(false);
async function saveQr() {
  savingQr.value = true;
  try {
    const result = await saveCashierImage();
    if (result === 'unavailable') return;
    const feedback = {
      saved: ['success', copy.value.cashierImageSaved],
      'permission-denied': ['warn', copy.value.cashierAlbumPermissionDenied],
      failed: ['error', copy.value.cashierImageSaveFailed],
    } as const;
    const [kind, title] = feedback[result];
    // #ifdef APP-PLUS
    // Exception to 03 §3.5.1: the native cashier is above the page's DOM toast.
    if (cashierView && visibleCashierUrl.value) {
      plus.nativeUI.toast(title, { verticalAlign: 'center', duration: kind === 'success' ? 'short' : 'long' });
      return;
    }
    // #endif
    toast[kind](title);
  } finally {
    savingQr.value = false;
  }
}

// #ifdef APP-PLUS
const cashierHttpsPattern = '^[Hh][Tt][Tt][Pp][Ss]://.*$';
const cashierHttps = new RegExp(cashierHttpsPattern);
let cashierView: PlusWebviewWebviewObject | null = null;
let savingCashierImage = false;

async function requestCashierWritePermission(): Promise<boolean> {
  if (plus.os.name !== 'Android' || plus.android.getAttribute('android.os.Build$VERSION', 'SDK_INT') >= 29) return true;
  const permission = 'android.permission.WRITE_EXTERNAL_STORAGE';
  return new Promise((resolve, reject) => {
    plus.android.requestPermissions([permission], result => resolve(result.granted.includes(permission)), reject);
  });
}

function closeNativeCashier() {
  const view = cashierView;
  cashierView = null;
  cashierLoaded.value = false;
  if (!view) return;
  view.removeFromParent();
  view.close();
}

watch(visibleCashierUrl, url => {
  closeNativeCashier();
  if (!url) return;
  // In App-vue, plus.webview.currentWebview() refers to the hidden logic-layer WebView.
  const pages = getCurrentPages();
  const page = pages[pages.length - 1] as { $getAppWebview?: () => PlusWebviewWebviewObject } | undefined;
  const parent = page?.$getAppWebview?.();
  if (!parent) return;
  const view = plus.webview.create('', `uvel-purchase-cashier-${Date.now()}`, {
    // Match the existing cashier frame: status bar + 56px header row + 26px secure row.
    top: `${statusBar + 82}px`, bottom: `${CASHIER_FOOT}px`, plusrequire: 'none',
    // Android leaves accelerated canvas out of view.draw(); the hosted QR is a canvas, so render this view in software.
    hardwareAccelerated: false,
  });
  cashierView = view;
  // The hosted URL was validated at entry. The cashier may then navigate to any HTTPS page.
  view.overrideUrlLoading({ mode: 'allow', match: cashierHttpsPattern }, (event: { url: string }) => {
    if (cashierView === view && !cashierHttps.test(event.url)) plus.runtime.openURL(event.url);
  });
  view.setJsFile('_www/static/app/cashier-navigation.js');
  function setLoaded(loaded: boolean) {
    if (cashierView === view) cashierLoaded.value = loaded;
  }
  view.addEventListener('loading', () => setLoaded(false));
  view.addEventListener('error', () => setLoaded(false));
  view.addEventListener('close', () => setLoaded(false));
  view.addEventListener('loaded', () => setLoaded(cashierHttps.test(view.getURL())));
  parent.append(view);
  view.loadURL(url);
});
onBeforeUnmount(closeNativeCashier);
// #endif

// Leaving for a wallet or bank app keeps the payment open and only pauses reads; navigating away closes it.
let appHidden = false;
const appHide = () => { appHidden = true; payment.pause(); };
const appShow = () => { appHidden = false; if (active.value && s.open) payment.wake(); };
function visibility() { if (typeof document === 'undefined' || !s.open) return; if (document.hidden) payment.pause(); else if (active.value) payment.wake(); }
watch(() => app.accountKey, () => payment.close());
watch(appReadOnline, online => {
  if (online && active.value && s.open && !appHidden && (typeof document === 'undefined' || !document.hidden)) void payment.query();
});
// Channel availability is read when the method sheet opens.
watch(() => active.value && s.open && !s.concluded && !s.pending && s.policy === null, load => { if (load) void payment.loadPolicy(); }, { immediate: true });
onShow(() => { active.value = true; if (s.open) payment.wake(); });
// Each page mounts its own dialog host. Close synchronously on route leave so
// the departing host cannot close the next page's automatically resumed intent.
onHide(() => {
  if (active.value && s.open) {
    if (appHidden || (typeof document !== 'undefined' && document.hidden)) payment.pause();
    else payment.close();
  }
  active.value = false;
});
onMounted(() => { uni.onAppHide(appHide); uni.onAppShow(appShow); if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility); });
onUnmounted(() => { uni.offAppHide(appHide); uni.offAppShow(appShow); if (active.value && s.open) payment.close(); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility); });
</script>
<style scoped>
.pp-mask { position: fixed; inset: 0; z-index: 900; display: flex; align-items: flex-end; justify-content: center; background: var(--v5-bg-color-mask); }
.pp-scrim { position: absolute; inset: 0; }
.pp-sheet { position: relative; display: flex; flex-direction: column; width: 100%; max-width: 480px; max-height: calc(100% - var(--nx-overlay-top)); box-sizing: border-box; padding: var(--v5-space-5) var(--v5-space-5) var(--nx-overlay-bottom); border-radius: var(--v5-radius-2xl) var(--v5-radius-2xl) 0 0; color: var(--v5-ink); }
.pp-head { flex: none; display: flex; align-items: center; gap: var(--v5-space-3); }
.pp-head__text { flex: 1; min-width: 0; }
.pp-title { display: block; font: 600 var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5); }
.pp-steps { flex: none; display: block; margin-top: 6px; color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.pp-circ { position: relative; flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; color: var(--v5-ink-2); }
/* 36px glass circle, 44px hit area (03 §3.1). */
.pp-circ::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; }
.pp-cd { display: flex; align-items: center; gap: 6px; margin-top: var(--v5-space-1); color: var(--v5-warning-ink); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.pp-cd.is-urgent { color: var(--v5-danger); font-weight: 500; }
.pp-body { min-height: 0; overflow-y: auto; }
.pp-prod { display: flex; align-items: center; gap: var(--v5-space-3); margin-top: var(--v5-space-4); padding: var(--v5-space-3); border-radius: var(--v5-radius-m); background: var(--v5-surface-2); }
.pp-prod__img { flex: none; width: 44px; height: 44px; }
.pp-prod__text { flex: 1; min-width: 0; }
.pp-prod__name { display: block; font: 500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); overflow-wrap: break-word; }
.pp-prod__meta { display: block; margin-top: 2px; color: var(--v5-ink-3); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.pp-prod .pp-prod__amt { flex: none; font-size: 17px; line-height: 24px; font-variant-numeric: normal; }
.pp-prod__amt :deep(.checkout-amount__symbol) { margin-right: 1px; }
.pp-mono { font-family: var(--font-jet-mono); letter-spacing: 0; white-space: nowrap; }
.pp-label { display: block; margin-top: var(--v5-space-5); color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.pp-opts { display: grid; gap: 10px; margin-top: var(--v5-space-2); }
.pp-opt { min-height: 68px; box-sizing: border-box; padding: var(--v5-space-3) 14px; border-radius: var(--v5-radius-l); background: var(--v5-surface-2); box-shadow: inset 0 0 0 1px var(--v5-border); display: flex; flex-direction: column; justify-content: center; }
.pp-opt.on { background: color-mix(in srgb, var(--v5-brand) 10%, var(--v5-surface-2)); box-shadow: inset 0 0 0 1.5px var(--v5-brand); }
.pp-opt__row { display: flex; align-items: center; gap: var(--v5-space-3); }
.pp-opt__ic { flex: none; width: 40px; height: 40px; border-radius: var(--v5-radius-s); display: grid; place-items: center; background: var(--v5-surface-3); color: var(--v5-ink-2); }
.pp-opt.on .pp-opt__ic { background: var(--v5-brand-soft); color: var(--v5-brand); }
.pp-opt__tx { flex: 1; min-width: 0; }
.pp-opt__t { display: block; font: 500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); }
.pp-opt__h { display: block; margin-top: 2px; font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
/* Picker radio (design-rules Controls): 22px, hollow 1.5px ring; selected = 2px brand ring + 12px brand dot. */
.pp-radio { flex: none; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; box-shadow: inset 0 0 0 1.5px var(--v5-ink-3); }
.pp-opt.on .pp-radio, .pp-tab.on .pp-radio { box-shadow: inset 0 0 0 2px var(--v5-brand); }
.pp-opt.on .pp-radio::after, .pp-tab.on .pp-radio::after { content: ""; width: 12px; height: 12px; border-radius: 50%; background: var(--v5-brand); }
.pp-short { display: flex; align-items: center; justify-content: space-between; gap: var(--v5-space-3); margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--v5-border); }
/* The 32px pill keeps its 44px hit area without adding visible space. */
.pp-short :deep(.nx-button) { margin: -6px 0; flex-shrink: 0; white-space: nowrap; }
.pp-short__t { min-width: 0; color: var(--v5-warning-ink); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); }
/* Network picker: stacked radio rows like the method rows (design-rules Controls), name left, radio right. */
.pp-tabs { display: grid; gap: 10px; margin-top: var(--v5-space-2); }
.pp-tab { display: flex; align-items: center; gap: var(--v5-space-3); min-height: 64px; box-sizing: border-box; padding: var(--v5-space-3) 14px; border-radius: var(--v5-radius-l); background: var(--v5-surface-2); box-shadow: inset 0 0 0 1px var(--v5-border); }
.pp-tab.on { background: color-mix(in srgb, var(--v5-brand) 10%, var(--v5-surface-2)); box-shadow: inset 0 0 0 1.5px var(--v5-brand); }
.pp-tab__a { display: block; font: 500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); }
.pp-tab__b { display: block; margin-top: 2px; font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
.pp-fees { margin-top: var(--v5-space-5); padding: var(--v5-space-1) var(--v5-space-4); border-radius: var(--v5-radius-l); background: var(--v5-surface-2); }
.pp-fees .pp-kv { min-height: 36px; }
.pp-fees .pp-kv + .pp-kv { border-top: 1px solid var(--v5-border); }
.pp-kv { display: flex; justify-content: space-between; align-items: center; gap: var(--v5-space-3); min-height: 32px; font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); }
.pp-kv__k { color: var(--v5-ink-3); }
.pp-kv__v { min-width: 0; font-weight: 500; color: var(--v5-ink); font-variant-numeric: tabular-nums; text-align: right; overflow-wrap: break-word; }
.pp-foot { flex: none; }
.pp-total { display: flex; align-items: baseline; justify-content: space-between; margin-top: var(--v5-space-4); }
.pp-total.is-ruled { margin-top: var(--v5-space-5); padding-top: var(--v5-space-4); border-top: 1px solid var(--v5-border); }
.pp-total__k { color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.pp-total .pp-total__v { font-size: 24px; line-height: 30px; font-variant-numeric: normal; }
.pp-note { display: block; margin-top: var(--v5-space-2); color: var(--v5-ink-3); font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); }
.pp-auto { display: flex; align-items: center; gap: 6px; margin-top: var(--v5-space-1); color: var(--v5-ink-3); font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); }
.pp-auto__dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--v5-brand); }
.pp-auto__dot.is-retry { background: var(--v5-warning); }
.pp-cta { display: flex; width: 100%; margin-top: var(--v5-space-4); }

.pp-page { position: fixed; inset: 0; z-index: 950; display: flex; flex-direction: column; box-sizing: border-box; background: var(--v5-bg); color: var(--v5-ink); }
.pp-nav { position: relative; z-index: 120; flex: none; height: 44px; padding: 0 var(--v5-space-4); display: flex; align-items: center; justify-content: space-between; }
.pp-nav__t { flex: 1; min-width: 0; text-align: center; font: 600 var(--ui-type-nav-title)/var(--ui-type-nav-title-lh) var(--font-v5); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.pp-nav__gap { flex: none; width: 36px; height: 36px; }
.pp-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.pp-pay { display: flex; flex-direction: column; gap: var(--v5-space-3); padding: var(--v5-space-6) var(--v5-space-4) var(--v5-space-8); }
.pp-card { padding: var(--v5-space-4); border-radius: var(--ui-radius-surface); }
.pp-card:not(.nx-tint) { background: var(--v5-surface); }
/* Amount card: tinted brand (its colour used to come from a corner glow). */
.pp-hero { --nx-tint: var(--v5-brand); padding: var(--v5-space-5); }
.pp-hero__lab { display: block; color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.pp-hero__row { display: flex; align-items: center; justify-content: space-between; gap: var(--v5-space-3); margin-top: var(--v5-space-1); }
.pp-hero__amt { min-width: 0; font: 500 32px/40px var(--font-amount); letter-spacing: -.02em; white-space: nowrap; color: var(--v5-ink); }
.pp-hero .pp-cd { margin-top: 10px; }
.pp-hero__meta { display: block; margin-top: var(--v5-space-3); padding-top: var(--v5-space-3); border-top: 1px solid var(--v5-border); color: var(--v5-ink-3); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.pp-copy { flex: none; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; color: var(--v5-ink-2); }
/* Inside the tinted amount card the copy control is a bare icon with a 44px target (P-67). */
.pp-copy--plain { width: 44px; height: 44px; margin-right: -10px; cursor: pointer; }
.pp-copy--plain:active { opacity: .6; }
.pp-wait { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 10px; margin-bottom: 14px; padding: 0 2px 14px; border-bottom: 1px solid var(--v5-border); }
/* Spinner and status stay together; a long status wraps beside the spinner, which sits on its first line. */
.pp-wait__head { flex: 0 1 auto; min-width: 0; display: flex; align-items: flex-start; gap: 10px; }
.pp-wait__spin { flex: none; margin-top: calc((var(--ui-type-list-title-lh) - 16px) / 2); width: 16px; height: 16px; box-sizing: border-box; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--pp-st) 22%, transparent); border-top-color: var(--pp-st); border-right-color: var(--pp-st); animation: pp-spin 1s linear infinite; }
@keyframes pp-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .pp-wait__spin { animation: none; } }
.pp-wait__t { min-width: 0; overflow-wrap: break-word; text-wrap: pretty; font: 500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); }
.pp-wait__em { color: var(--pp-st); }
.pp-wait__s { margin-left: auto; text-align: right; color: var(--v5-ink-3); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.pp-card__top { display: flex; align-items: center; justify-content: space-between; gap: var(--v5-space-2); }
.pp-card__t { display: block; font: 600 var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); }
.pp-qr { width: 200px; height: 200px; margin: var(--v5-space-4) auto 0; padding: var(--v5-space-3); box-sizing: border-box; border-radius: var(--v5-radius-m); background: #fff; box-shadow: inset 0 0 0 1px var(--v5-border); }
.pp-qr__img { display: block; width: 176px; height: 176px; }
.pp-cap { display: block; margin-top: var(--v5-space-2); text-align: center; color: var(--v5-ink-3); font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); }
.pp-addr { display: flex; align-items: center; gap: var(--v5-space-2); margin-top: var(--v5-space-3); padding: 6px 6px 6px 14px; border-radius: var(--v5-radius-m); background: var(--v5-surface-2); }
/* The full address wraps evenly in mono (NxCodeValue full, 03 §3.6.1); the copy control beside it copies the whole address. */
.pp-addr__t { flex: 1; }
.pp-wait.is-alone { margin: 0; padding: 0 2px; border: 0; }
/* While the address is still being prepared nothing follows the status, so it keeps no divider. */
.pp-wait:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: 0; }
.pp-wait.is-concluded .pp-wait__s { width: 100%; margin-left: 0; text-align: left; }
.pp-wait.is-paused { justify-content: center; text-align: center; }
.pp-wait.is-paused .pp-wait__s { text-align: center; }
.pp-pay.has-bar { padding-bottom: 120px; }
.pp-bar { position: absolute; z-index: 2; display: flex; }
.pp-reopen { display: flex; flex: 1; }
/* A lone bar action spans the bar like the bank page's reopen button. */
.pp-bar > .nx-button { flex: 1; }
.pp-div { height: 1px; margin: 6px 0; background: var(--v5-border); }
.pp-warn { display: flex; gap: var(--v5-space-2); padding: var(--v5-space-3) 14px; border-radius: var(--v5-radius-m); background: color-mix(in srgb, var(--v5-warning-soft) 60%, transparent); color: var(--v5-warning-ink); font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); }
.pp-warn > :first-child { flex: none; margin-top: 2px; }

/* Bottom clearance for the note + button tray (04 §4.0: tray height + 38). */
.pp-done { display: flex; flex-direction: column; padding: 48px var(--v5-space-4) 136px; }
.pp-bar--done { flex-direction: column; align-items: stretch; }
.pp-track { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 36px; }
.pp-step { position: relative; display: flex; flex-direction: column; align-items: center; gap: var(--v5-space-2); text-align: center; }
.pp-seg { position: absolute; top: 11px; left: calc(50% + 16px); width: calc(100% - 32px); height: 2px; border-radius: var(--v5-radius-full); background: var(--v5-surface-3); }
.pp-seg.is-done { background: var(--v5-brand); }
.pp-dot { width: 24px; height: 24px; box-sizing: border-box; border-radius: 50%; display: grid; place-items: center; background: var(--v5-surface-3); }
.pp-dot.is-done { background: var(--v5-brand); color: var(--v5-on-brand); }
.pp-dot.is-current { border: 2px solid var(--v5-brand); background: transparent; box-shadow: 0 0 0 4px color-mix(in srgb, var(--v5-brand) 18%, transparent); }
.pp-dot.is-current::after { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--v5-brand); }
.pp-step__l { font: 500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color: var(--v5-ink); }
.pp-receipt { margin-top: 36px; padding: var(--v5-space-4); border-radius: var(--ui-radius-surface); background: var(--v5-surface); }
.pp-receipt .pp-receipt__amt { font-size: 20px; line-height: 28px; font-variant-numeric: normal; }

.pp-cashier { position: fixed; inset: 0; z-index: 955; display: flex; flex-direction: column; background: var(--v5-bg); color: var(--v5-ink); }
.pp-cashier__bar { flex: none; background: var(--v5-surface); box-shadow: 0 1px 0 var(--v5-border); }
.pp-cashier__row { position: relative; z-index: 120; height: 56px; padding: 0 var(--v5-space-4); display: flex; align-items: center; gap: var(--v5-space-3); }
.pp-cashier__mid { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; text-align: center; }
.pp-cashier__t { font: 600 var(--ui-type-nav-title)/var(--ui-type-nav-title-lh) var(--font-v5); }
.pp-cashier__cd { display: inline-flex; align-items: center; gap: var(--v5-space-1); color: var(--v5-warning-ink); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.pp-cashier__cd.is-urgent { color: var(--v5-danger); }
.pp-cashier__lock { position: relative; z-index: 120; height: 26px; display: flex; align-items: center; justify-content: center; gap: var(--v5-space-1); color: var(--v5-ink-3); font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.pp-cashier__frame { flex: 1; min-height: 0; background: #fff; }
.pp-cashier__frame iframe { display: block; width: 100%; height: 100%; border: 0; }
/* Reserved space under the bank page (CASHIER_FOOT); the native bank webview ends where it starts. */
.pp-cashier__foot { flex: none; height: 146px; }
.pp-cashier__tray { position: fixed; z-index: 1; display: flex; flex-direction: column; }
/* The note keeps two lines in every language so the tray height never changes. */
.pp-cashier__note { box-sizing: content-box; height: 32px; display: flex; align-items: center; justify-content: center; overflow-wrap: break-word; }
.pp-cashier__row2 { display: flex; gap: 8px; }
.pp-cashier__done { flex: 1; }

/* One line sits in a 56px row with equal space above and below; the 48px text action keeps its touch height inside it. */
.purchase-payment__row { display: flex; align-items: center; justify-content: space-between; gap: var(--v5-space-3); min-height: 56px; box-sizing: border-box; padding: 4px 0; color: var(--v5-ink-2); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.purchase-payment__row > text { flex: 1; min-width: 0; padding-block: 6px; }
/* The text action's own 8px inline padding sits in the bar padding, so its label keeps the same 16px inset as the row text. */
.purchase-payment__row > :last-child { flex-shrink: 0; white-space: nowrap; margin-right: -8px; }
/* The text action's hit area stops short of the close mark's 44px target. */
.purchase-payment-resume.has-close { padding-right: 56px; }
.purchase-payment-resume__close { position: absolute; top: 14px; right: var(--v5-space-3); width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; color: var(--v5-ink-2); }
.purchase-payment-resume__close::after { content: ''; position: absolute; inset: -8px; }
.purchase-payment-resume { position: fixed; z-index: 890; left: var(--v5-space-4); right: var(--v5-space-4); bottom: calc(var(--nx-overlay-safe-bottom, 24px) + 78px); display: grid; max-height: 160px; overflow: auto; padding: 0 var(--v5-space-4); border: 1px solid var(--v5-border); border-radius: var(--v5-radius-m); background: var(--v5-surface); color: var(--v5-ink); font-size: var(--ui-type-description); }

.purchase-payment-resume:not(.has-close) .purchase-payment__row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0 var(--v5-space-3); padding: var(--v5-space-3) 0; border-bottom: 1px solid color-mix(in srgb, var(--v5-ink) 5%, transparent); color: var(--v5-ink-2); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.purchase-payment-resume:not(.has-close) .purchase-payment__row > text { flex: 1; min-width: 0; }
.purchase-payment-resume:not(.has-close) .purchase-payment__row > :last-child { flex-shrink: 0; margin-left: auto; white-space: nowrap; }
.purchase-payment-resume:not(.has-close) .purchase-payment__row:last-child { border-bottom: 0; }
</style>
