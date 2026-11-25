<!--
  Free-trial detail page — P-59 redesign of the FEAT-TRIAL02 states:
    · active    → the device stands inside a countdown ring (remaining / full term), live
                  accrued earnings, and a quote ticket: total benefit, price breakdown and
                  what arrives after purchase. Buy now → checkout.
    · grace     → same structure in amber: production stopped, the ring counts the credit's
                  remaining validity (EXTENDED shares it under its own label).
    · none      → claim intro (bottom CTA opens the claim sheet; ineligible = disabled CTA
                  + concrete reason, 异常2). Also an ended trial that may be claimed again.
    · ended     → credit expired terminal + plain buy CTA.
    · converted → owned terminal (devices) / refunded terminal (refund order + store).
  Every state's main action sits in the bottom bar (DS-30). Every amount is the server
  quote convert() will settle — this page never debits; the money lives in checkout.
  The rules entry opens the in-page rules sheet (spec ⑥). Wrapped in <AppChassis active="me">.
-->
<template>
  <AppChassis active="me">
    <view class="trial-page">
      <SubPageHeader back="/pages/me/me" :title="t.trial.pageTitle" :subtitle="trialDeviceName || undefined" />

      <!-- Before the first answer the page keeps its shape (03 §3.4). An unknown command result is confirmed by automatic
           reads: a pending status, no query button. Only a read failure is the whole-page result with its one 重新加载 (03 §3.5.2). -->
      <view v-if="trialResultConfirming" class="trial-confirming nx-empty--page">
        <NxResultHead tone="warning" icon="clock" :title="lifecycle.resultConfirming" :description="lifecycle.resultConfirmingNote" />
      </view>
      <view v-else-if="authorityScreenUnavailable && authorityReadPending" class="trial-read-skeleton" role="status" aria-busy="true">
        <view class="trial-read-skeleton__ring" aria-hidden="true" />
        <view class="trial-read-skeleton__title" aria-hidden="true" />
        <view class="trial-read-skeleton__body" aria-hidden="true" />
        <text class="nx-sr-only">{{ lifecycle.loading }}</text>
      </view>
      <EmptyState v-else-if="authorityScreenUnavailable" kind="recoverable-error" page :title="lifecycle.pageUnavailable" :cta-label="t.ui.reload" :cta-busy="freeTrial.authorityStatus === 'loading'" @cta="freeTrial.refreshRemote()" />

      <!-- ═══ active / grace — running cycle ═══ -->
      <view v-else-if="isActiveCycle" class="trial-state" :class="{ 'trial-state--grace': isGrace }">
        <view class="trial-glow trial-glow--hero" aria-hidden="true" />
        <view class="trial-hero trial-rise">
          <view class="trial-hero__top">
            <NxTag :tone="isGrace ? 'warning' : 'brand'">{{ ribbon }}</NxTag>
            <view v-if="!isGrace" class="trial-online"><view class="trial-online__dot trial-detail__online" /><text>{{ t.earn.online }}</text></view>
          </view>
          <view class="trial-ring" :style="{ '--trial-ring-offset': ringOffset }">
            <view class="trial-ring__svg" aria-hidden="true"><svg width="208" height="208" viewBox="0 0 208 208">
              <circle class="trial-ring__track" cx="104" cy="104" r="96" fill="none" stroke-width="6" />
              <circle class="trial-ring__arc" cx="104" cy="104" r="96" fill="none" stroke-width="6" stroke-linecap="round" :stroke-dasharray="RING_LENGTH" transform="rotate(-90 104 104)" />
            </svg></view>
            <CatalogMachineImage class="trial-ring__machine" :sku="trialProductId" :image-url="trialImageUrl" scope-key="trial-hero" />
          </view>
          <view class="trial-countdown">
            <text class="trial-countdown__label">{{ isGrace ? detail.keptLabel : detail.remaining }}</text>
            <text class="trial-countdown__value">{{ countdownText }}</text>
          </view>
          <text v-if="deadlineText" class="trial-hero__deadline">{{ deadlineText }}</text>
        </view>

        <view class="trial-earned trial-rise trial-rise--2">
          <text class="trial-earned__label">{{ isGrace ? detail.graceAmountLabel : lifecycle.accruedLabel }}</text>
          <view class="trial-earned__amount">
            <text class="nx-sr-only">{{ earnedParts[1] ? `${earnedParts[0]}.${earnedParts[1]}` : earnedParts[0] }}</text>
            <TrialCountAmount :config="earnedCount.config.value" :parts="earnedParts" tone="earned" />
            <text class="trial-earned__unit">USDT</text>
          </view>
          <!-- Each figure carries its own use: the USDT offsets a purchase, the UVT arrives after one (04 §4.6). -->
          <text class="trial-earned__note">{{ detail.creditOnBuy }}</text>
          <text class="trial-earned__uvt">+ {{ visibility.mask(formatGroupedAmount(shadowNEX)) }}<text class="trial-unit-small">&nbsp;UVT</text><text class="trial-earned__uvt-after">&nbsp;·&nbsp;{{ detail.uvtAfterBuy }}</text></text>
        </view>

        <view v-if="originalPurchase || showDevicePicker" class="trial-select trial-rise trial-rise--3">
          <TrialOriginalPurchaseCard v-if="originalPurchase" :purchase="originalPurchase"
            :is-trial-device="originalPurchase.device.productNo === trialProductId" :now="serverNow" />
          <TrialDevicePicker v-if="showDevicePicker" :options="purchaseOptionsView.options"
            :selected-product-no="selectedProductNo" :status="purchaseOptionsView.status" :locked="!!originalPurchase"
            :estimates="purchaseEstimates" :condition-links="purchaseConditionLinks"
            @select="selectDevice" @open-conditions="openPurchaseConditions" />
        </view>

        <!-- FEAT-TRIAL05: every amount below is the server quote convert() will settle. -->
        <view v-if="purchaseQuote" class="trial-ticket trial-rise trial-rise--4" data-testid="trial-credit-summary">
          <view class="trial-ticket__body">
            <!-- The early-discount title and tag need a real discount; without it the first row names the device (board note 4). -->
            <NxTag v-if="earlySaving" class="trial-ticket__tag" tone="brand"><svg class="trial-ticket__tag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{{ detail.earlyTag }}</NxTag>
            <text v-if="buyTitle" class="trial-ticket__title" data-testid="trial-buy-title">{{ buyTitle }}</text>
            <text v-if="earlySaving" class="trial-ticket__subtitle">{{ detail.earlySubtitle }}<text class="trial-ticket__estimate">{{ detail.earlyEstimate }}</text></text>

            <view class="trial-total">
              <text class="trial-total__breakdown">{{ totalBreakdown }}</text>
              <view class="trial-total__line">
                <text class="trial-total__label">{{ detail.totalLabel }}</text>
                <text class="nx-sr-only">{{ totalParts[1] ? `${totalParts[0]}.${totalParts[1]}` : totalParts[0] }}</text>
                <TrialCountAmount :config="totalCount.config.value" :parts="totalParts" tone="total" />
                <text class="trial-unit-small trial-total__unit">USDT</text>
                <text v-if="purchaseQuote.rewardNEX > 0" class="trial-total__uvt">+ {{ visibility.mask(formatGroupedAmount(purchaseQuote.rewardNEX)) }}<text class="trial-unit-small">&nbsp;UVT</text></text>
              </view>
            </view>

            <view class="trial-rows" role="group" :aria-label="purchase.payGroup">
              <view class="trial-row"><view class="trial-row__label"><text>{{ earlySaving ? detail.unitPrice : ticketDeviceName }}</text><text v-if="claimPriceDiffers" class="trial-row__claim">{{ detail.claimPrice }}</text></view><text class="trial-row__value">{{ usd(purchaseQuote.priceUSD) }}</text></view>
              <view v-if="ticketDiscounts.promo > 0" class="trial-row"><view class="trial-row__label">{{ promoLabel }}<NxTag class="trial-limit-tag" tone="warning">{{ detail.limitedTag }}</NxTag></view><text class="trial-row__value">−{{ usd(ticketDiscounts.promo) }}</text></view>
              <view v-if="earlySaving" class="trial-row"><text class="trial-row__label">{{ detail.earlyRow }}</text><text class="trial-row__value">−{{ usd(ticketDiscounts.early) }}</text></view>
              <view v-if="ticketDiscounts.offset > 0" class="trial-row"><view class="trial-row__label">{{ detail.offsetRow }}<NxTag class="trial-limit-tag" tone="warning">{{ detail.limitedTag }}</NxTag></view><text class="trial-row__value">{{ visibility.mask(`−${usd(ticketDiscounts.offset)}`) }}</text></view>
            </view>
            <view class="trial-sum">
              <view class="trial-sum__row"><text class="trial-sum__label">{{ detail.discountTotal }}</text><text class="trial-sum__discount">{{ visibility.mask(`−${usd(discountTotal)}`) }}</text></view>
              <view class="trial-sum__row">
                <text class="trial-row__label">{{ detail.finalPrice }}</text>
                <view class="trial-sum__price">
                  <text class="trial-sum__strike">{{ usd(purchaseQuote.priceUSD) }}</text>
                  <text class="trial-sum__amount" data-testid="trial-amount-due"><text class="trial-sum__currency">$</text>{{ dueParts[0] }}<text class="trial-dim">.{{ dueParts[1] }}</text></text>
                </view>
              </view>
            </view>
          </view>

          <template v-if="purchaseQuote.remainderUSD > 0 || purchaseQuote.rewardNEX > 0">
            <view class="trial-perf" aria-hidden="true"><view class="trial-perf__notch trial-perf__notch--l" /><view class="trial-perf__notch trial-perf__notch--r" /><view class="trial-perf__line" /></view>
            <view class="trial-credit" role="group" :aria-label="purchase.creditGroup">
              <text class="trial-credit__label">{{ purchase.creditGroup }}</text>
              <view class="trial-credit__row">
                <text class="trial-credit__name">{{ detail.creditRow }}</text>
                <text class="trial-credit__value" data-testid="trial-credit-after"><template v-if="purchaseQuote.remainderUSD > 0">{{ visibility.mask(formatGroupedAmount(purchaseQuote.remainderUSD)) }}<text class="trial-unit-small trial-dim">&nbsp;USDT</text></template><text v-if="purchaseQuote.remainderUSD > 0 && purchaseQuote.rewardNEX > 0" class="trial-credit__sep"> · </text><text v-if="purchaseQuote.rewardNEX > 0" class="trial-credit__uvt">{{ visibility.mask(formatGroupedAmount(purchaseQuote.rewardNEX)) }}<text class="trial-unit-small">&nbsp;UVT</text></text></text>
              </view>
              <text class="trial-credit__note">{{ detail.creditNote }}</text>
            </view>
          </template>
        </view>
        <!-- Older servers without a quote keep the accrued-only presentation. -->
        <view v-else-if="!usePurchaseOptions && !originalPurchase" class="trial-ticket trial-ticket__body trial-rise trial-rise--4" data-testid="trial-credit-summary">
          <view class="trial-sum__row">
            <text class="trial-row__label">{{ lifecycle.availableOffsetLabel }}</text>
            <text class="trial-sum__discount">{{ visibility.mask(usd(trialOffset.offsetUSD)) }}</text>
          </view>
          <view class="trial-row trial-legacy-row"><text class="trial-row__label">{{ lifecycle.estimateTotalLabel }}</text><text class="trial-row__value">{{ estimatedOffsetUSD === null ? "—" : `≈ ${usd(estimatedOffsetUSD)}` }}</text></view>
          <text class="trial-legacy-note">{{ lifecycle.earlyPurchaseNote }}</text>
          <text v-if="trialOffset.remainderUSD > 0" class="trial-legacy-note">{{ offsetRemainderNote }}</text>
        </view>

        <view class="trial-links trial-rise trial-rise--5">
          <view class="trial-link" role="button" tabindex="0" :aria-label="detail.rulesRow" @click="rulesOpen = true" @keydown.enter.prevent="rulesOpen = true" @keydown.space.prevent="rulesOpen = true">
            <text>{{ detail.rulesRow }}</text>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </view>
          <view class="trial-link" role="button" tabindex="0" :aria-label="detail.earnRow" @click="goEarn" @keydown.enter.prevent="goEarn" @keydown.space.prevent="goEarn">
            <text>{{ detail.earnRow }}</text>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </view>
        </view>
      </view>

      <!-- ═══ none — claim intro ═══ -->
      <view v-else-if="claimVisible" class="trial-state trial-state--terminal">
        <view class="trial-glow trial-glow--claim" aria-hidden="true" />
        <view class="trial-slot trial-rise">
          <view class="trial-slot__ring" aria-hidden="true" />
          <CatalogMachineImage class="trial-slot__machine" :sku="trialProductId" :image-url="trialImageUrl" scope-key="trial-claim" />
          <NxTag class="trial-slot__tag" tone="brand">{{ fmt(detail.freeDays, { n: String(cfg.trialDays) }) }}</NxTag>
        </view>
        <view class="trial-terminal-copy trial-terminal-copy--claim trial-rise trial-rise--2">
          <text class="trial-terminal-copy__title">{{ fmt(t.trial.idleTitleNew, { device: trialDeviceNameKept }) }}</text>
          <text v-if="idleBody" class="trial-terminal-copy__body">{{ idleBody }}</text>
        </view>
      </view>

      <!-- ═══ ended — credit expired terminal ═══ -->
      <view v-else-if="status === 'ended'" class="trial-state trial-state--terminal" data-testid="trial-ended">
        <view class="trial-ring trial-ring--terminal trial-ring--muted trial-rise">
          <view class="trial-ring__svg" aria-hidden="true"><svg width="208" height="208" viewBox="0 0 208 208"><circle class="trial-ring__track" cx="104" cy="104" r="96" fill="none" stroke-width="6" /></svg></view>
          <CatalogMachineImage class="trial-ring__machine" :sku="trialProductId" :image-url="trialImageUrl" scope-key="trial-ended" />
          <view class="trial-ring__badge" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg></view>
        </view>
        <view class="trial-terminal-copy trial-rise trial-rise--2">
          <text class="trial-terminal-copy__title">{{ t.trial.endedTitle }}</text>
          <text class="trial-terminal-copy__body">{{ t.trial.endedDesc }}</text>
        </view>
      </view>

      <!-- ═══ converted, then refunded: the device is gone, say so ═══ -->
      <view v-else-if="conversionRefunded" class="trial-state trial-state--terminal" data-testid="trial-refunded">
        <view class="trial-ring trial-ring--terminal trial-ring--muted trial-rise">
          <view class="trial-ring__svg" aria-hidden="true"><svg width="208" height="208" viewBox="0 0 208 208"><circle class="trial-ring__track" cx="104" cy="104" r="96" fill="none" stroke-width="6" /></svg></view>
          <CatalogMachineImage class="trial-ring__machine" :sku="terminalProductNo" :image-url="terminalImageUrl" scope-key="trial-refunded" />
          <view class="trial-ring__badge" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></svg></view>
        </view>
        <view class="trial-terminal-copy trial-rise trial-rise--2">
          <text class="trial-terminal-copy__title">{{ purchase.refundedTitle }}</text>
          <text class="trial-terminal-copy__body">{{ purchase.refundedBody }}</text>
          <text v-if="displayState?.conversion?.rewardsReversed" class="trial-terminal-copy__note">{{ purchase.refundedRewards }}</text>
        </view>
      </view>

      <!-- ═══ converted — owned terminal ═══ -->
      <view v-else class="trial-state trial-state--terminal">
        <view class="trial-glow trial-glow--owned" aria-hidden="true" />
        <view class="trial-ring trial-ring--terminal trial-ring--owned trial-rise">
          <view class="trial-ring__svg" aria-hidden="true"><svg width="208" height="208" viewBox="0 0 208 208"><circle class="trial-ring__full" cx="104" cy="104" r="96" fill="none" stroke-width="6" /></svg></view>
          <CatalogMachineImage class="trial-ring__machine" :sku="terminalProductNo" :image-url="terminalImageUrl" scope-key="trial-owned" />
          <view class="trial-ring__check" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg></view>
        </view>
        <view class="trial-terminal-copy trial-rise trial-rise--2">
          <text class="trial-terminal-copy__title">{{ t.trial.convertedTitle }}</text>
          <text class="trial-terminal-copy__body">{{ fmt(t.trial.convertedDesc, { device: trialDeviceNameKept }) }}</text>
        </view>
      </view>

      <!-- Reserves the bottom bar's height so the last row scrolls clear of it: the bar's own note and
           retry rows, invisible, wrap exactly as in the bar; the button, padding and safe area are fixed. -->
      <view v-if="!authorityScreenUnavailable" class="trial-bar-space" aria-hidden="true">
        <view v-if="barNoteWarn" class="trial-bar__note trial-bar__note--warn"><view class="trial-bar__note-icon" /><text>{{ barNote }}</text></view>
        <text v-else-if="barNote" class="trial-bar__note">{{ barNote }}</text>
        <view v-if="barRetry" class="trial-bar__retry trial-bar-space__retry" />
      </view>
    </view>

    <!-- Every state's main action sits in the thumb zone (DS-30). -->
    <template #pageFixed>
      <view v-if="!authorityScreenUnavailable" class="trial-bar nx-glass-bar" :class="{ 'trial-bar--pair': conversionRefunded }">
        <template v-if="isActiveCycle || (status === 'ended' && !claimVisible)">
          <view v-if="barNoteWarn" class="trial-bar__note trial-bar__note--warn nx-tray-note" role="status"><svg class="trial-bar__note-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16.5v.01" /></svg><text>{{ barNote }}</text></view>
          <text v-else-if="barNote" class="trial-bar__note nx-tray-note" role="status">{{ barNote }}</text>
          <view v-if="barRetry" class="trial-bar__retry"><NxButton variant="text" size="small" :label="t.store.catalogRetry" @click="retryCatalog" /></view>
          <NxButton class="trial-bar__main" variant="primary" :label="trialBuyCtaText" :disabled="trialBuyDisabled" :busy="trialBuyBusy && !listLoading" :aria-busy="trialBuyBusy" @click="goCheckout">
            <!-- Reading the list keeps the label beside the spinner (board S6a); a press in progress uses the shared busy state. -->
            <view v-if="listLoading" class="trial-bar__spinner" aria-hidden="true" />
            <svg v-else-if="isActiveCycle && !originalPurchase && !trialBuyDisabled" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>
            <text>{{ trialBuyCtaText }}</text>
          </NxButton>
        </template>
        <template v-else-if="claimVisible">
          <!-- Ineligible → concrete reason above the disabled CTA (异常2) -->
          <text v-if="barNote" class="trial-bar__note nx-tray-note">{{ barNote }}</text>
          <NxButton class="trial-bar__main" variant="primary" :label="freeTrial.pendingStart ? t.trial.claimRetryCta : t.trial.idleCta" :disabled="!canStartNow" @click="claim" />
        </template>
        <template v-else-if="conversionRefunded">
          <NxButton v-if="displayState?.conversion?.orderNo" class="trial-bar__side" variant="secondary" :label="purchase.refundOrderCta" @click="goRefundedOrder" />
          <NxButton class="trial-bar__wide" variant="primary" :label="purchase.shopCta" @click="goStore" />
        </template>
        <NxButton v-else class="trial-bar__main" variant="primary" :label="t.trial.convertedDevicesCta" @click="goDevices" />
      </view>
    </template>

    <!-- ═══ Rules half-sheet (spec ⑥「查看抵扣规则」) ═══ -->
    <view v-if="rulesOpen" class="trs-root" role="dialog" aria-modal="true" aria-labelledby="trs-title">
      <view class="trs-backdrop" aria-hidden="true" @click="rulesOpen = false" />
      <view class="nx-glass-sheet trs-panel" @click.stop>
        <view class="trs-head">
          <text id="trs-title" class="trs-title">{{ t.trial.rulesTitle }}</text>
          <view class="trs-close" role="button" tabindex="0" :aria-label="t.trial.sheetCloseAria" @click="rulesOpen = false" @keydown.enter.stop.prevent="rulesOpen = false" @keydown.space.stop.prevent="rulesOpen = false">
            <view class="trs-close__face nx-frosted-button"><NxIcon name="close" :size="16" /></view>
          </view>
        </view>
        <view class="trs-list" role="list">
          <view v-for="(line, i) in rulesLines" :key="i" class="trs-line" role="listitem"><view class="trs-line__dot" aria-hidden="true" /><text class="trs-line__text">{{ line }}</text></view>
        </view>
        <NxButton class="trs-got" variant="secondary" :label="t.trial.rulesGotCta" @click="rulesOpen = false" />
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { formatAmount, formatGroupedAmount } from "@/lib/amount-display";
import { useVisibleInterval } from "@/composables/use-tab-page-lifecycle";
import { computed, ref, onMounted, provide, watch } from "vue";
import { onHide, onLoad, onShow } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import CatalogMachineImage from "@/components/catalog-machine-image.vue";
import NxButton from "@/components/ui/nx-button.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import NxIcon from "@/components/ui/nx-icon.vue";
import EmptyState from "@/components/empty-state.vue";
import NxResultHead from "@/components/ui/nx-result-head.vue";
import { appDeviceOffline, foregroundReadAllowed } from "@/lib/foreground-read";
import { hasVisiblePullRefresh, registerActivePageRefresh } from "@/lib/active-page-refresh";
import { useT } from "@/i18n/use-t";
import { dateLocale, fmt } from "@/i18n/format";
import { formatTrialDeadline } from "@/lib/trial-date";
import { geoPolicyErrorKind, geoPolicyUserMessage } from "@/api/geo-policy-error";
import { useFreeTrial, liveShadowUSD, liveShadowNEX } from "@/store/free-trial";
import { useTrialConfig, computeTrialOffset, formatTrialDiscountPercent, resolveTrialCheckoutProductId } from "@/store/trial-config";
import { useTrialClaimSheet } from "@/store/trial-claim-sheet";
import { useDataVisibility } from "@/store/data-visibility";
import { getProduct } from "@/mock/products";
import { productCatalogState, refreshProductCatalog } from "@/store/product-catalog";
import { navReplace, navTo, takeNavigationParameters } from "@/lib/route";
import { useDialogA11y } from "@/composables/use-dialog-a11y";
import { useViewCountUp } from "@/composables/use-count-up";
import TrialCountAmount from "@/components/me/trial-count-amount.vue";
import { remoteApiEnabled } from "@/api/runtime";
import { useTrialLifecycleCopy } from "@/i18n/trial-lifecycle";
import { useTrialPurchaseCopy } from "@/i18n/trial-purchase";
import { useTrialDetailCopy } from "@/i18n/trial-detail";
import { useTrialFleetCopy } from "@/i18n/trial-fleet";
import { useApp } from "@/store/app";
import { toast } from "@/store/ui";
import { useTrialCheckout } from "@/store/trial-checkout";
import { trialOrderResultKey, trialRefusalResultKey, useTrialPurchaseResult } from "@/store/trial-purchase-result";
import { useLocaleStore } from "@/store/locale";
import { trialOptionReadFailed, useTrialPurchaseOptions } from "@/store/trial-purchase-options";
import { useTrialCreditOptionsRead, useTrialPurchaseConfirmation } from "@/composables/use-trial-credit-option";
import { parseTrialConvertReceipt, trialPriceChanged } from "@/api/trial-api";
import { resumeTrialPurchasePayment, TRIAL_PAYMENT_CARD_KEY, usePurchasePayment } from "@/store/purchase-payment";
import TrialDevicePicker from "@/components/trial/trial-device-picker.vue";
import TrialOriginalPurchaseCard from "@/components/trial/trial-original-purchase-card.vue";
import { productDailyEstimateRange } from "@/lib/product-estimates";
import { trialDeviceNeedsReselection, trialPurchaseReasonMessage } from "@/lib/trial-purchase-reason";
import { trialDiscountDisplay } from "@/lib/trial-discount-display";

const t = useT();
const app = useApp();
const freeTrial = useFreeTrial();
const claimSheet = useTrialClaimSheet();
const pageVisible = ref(false);
onShow(() => { pageVisible.value = true; void freeTrial.refreshVisible(); });
onHide(() => { pageVisible.value = false; });
const trialConfig = useTrialConfig();
const visibility = useDataVisibility();
const lifecycle = useTrialLifecycleCopy();
const purchase = useTrialPurchaseCopy();
const detail = useTrialDetailCopy();
const fleetCopy = useTrialFleetCopy();
const authorityUnavailable = computed(() => remoteApiEnabled && (freeTrial.authorityStatus !== "ready" || freeTrial.authorityIncomplete));
// The last complete snapshot belongs to this account and only supplies display values.
const displayState = computed(() => freeTrial.displayState);
const staleDisplay = computed(() => freeTrial.transientReadFailure && displayState.value !== null);
const authorityScreenUnavailable = computed(() => remoteApiEnabled && (!displayState.value || trialResultConfirming.value));
// A read is under way or about to start: the cold open before the first read, or a read with no failure behind it.
// A failed or incomplete read keeps its result up while recovery re-reads; an observed disconnect has nothing to wait for.
const authorityReadPending = computed(() => freeTrial.authorityStatus === "loading"
  ? !freeTrial.lastReadFailed && !freeTrial.authorityIncomplete
  : freeTrial.authorityStatus === "unknown" && freeTrial.authorityError === null && !appDeviceOffline.value);

const cfg = computed(() => trialConfig.config);
const status = computed(() => displayState.value?.status ?? freeTrial.status);

const now = ref(Date.now());
useVisibleInterval(() => { now.value = Date.now(); }, 1000);
const serverNow = computed(() => freeTrial.serverTimeAt(now.value));
onMounted(() => { void refreshProductCatalog(true); });

const isActiveCycle = computed(() => status.value === "active" || status.value === "grace");
const isGrace = computed(() => status.value === "grace");
const trialProductId = computed(() => resolveTrialCheckoutProductId(cfg.value.trialProductId));
const terminalProductNo = computed(() => freeTrial.purchasedDevice?.productNo ?? trialProductId.value);
const terminalImageUrl = computed(() => freeTrial.purchasedDevice ? freeTrial.purchasedDevice.imageUrl : cfg.value.imageUrl);
// The catalogue array is not reactive: read it only once a read has settled, so the lookup re-runs per read.
const trialProduct = computed(() => (productCatalogState.status === "ready" && trialProductId.value ? getProduct(trialProductId.value) : undefined));
const trialImageUrl = computed(() => cfg.value.imageUrl);
const trialCatalogLoading = computed(() => productCatalogState.status !== "ready" && productCatalogState.status !== "error");
const trialProductUnavailable = computed(() => {
  if (productCatalogState.status !== "ready") return true;
  const product = trialProduct.value;
  if (!product || product.purchaseBlocked === true) return true;
  return product.productType !== "SHARE"
    && product.inventoryMode === "FINITE"
    && (product.stock ?? 0) <= 0;
});
const shadowUSD = computed(() => displayState.value?.shadowUSD ?? liveShadowUSD(now.value));
const shadowNEX = computed(() => displayState.value?.shadowNEX ?? liveShadowNEX(now.value));
const startedAt = computed(() => displayState.value?.startedAt ?? freeTrial.startedAt);
const expiresAt = computed(() => displayState.value?.expiresAt ?? freeTrial.expiresAt);
const graceEndsAt = computed(() => displayState.value?.serverState === "EXTENDED"
  ? displayState.value.extendedEndsAt ?? null : displayState.value?.graceEndsAt ?? freeTrial.graceEndsAt);
const boundary = computed(() => isGrace.value ? graceEndsAt.value : expiresAt.value);
const remainingMsValue = computed(() => boundary.value === null ? 0
  : Math.max(0, boundary.value - freeTrial.serverTimeAt(now.value)));
const trialOffset = computed(() => remoteApiEnabled
  ? { offsetUSD: displayState.value?.offsetUSD ?? 0, remainderUSD: displayState.value?.remainderUSD ?? 0 }
  : computeTrialOffset(cfg.value, shadowUSD.value));
const estimatedOffsetUSD = computed(() => cfg.value.shadowDailyUSD === null
  ? null : computeTrialOffset(cfg.value, cfg.value.shadowDailyUSD * cfg.value.trialDays).offsetUSD);
const trialOptions = useTrialPurchaseOptions();
const checkout = useTrialCheckout();
const trialResults = useTrialPurchaseResult();
const entryProductNo = ref<string>();
let entryAccountEpoch: number | null = null;
onLoad(query => {
  const from = takeNavigationParameters("/pages/me/trial", ["product"]).get("product");
  const product = from ?? query?.product;
  if (product) {
    entryProductNo.value = product;
    entryAccountEpoch = app.accountKey.startsWith("user:") ? app.accountBindingEpoch : null;
  }
});
const optionsRead = useTrialCreditOptionsRead(() => pageVisible.value, () => {
  const product = entryProductNo.value;
  entryProductNo.value = undefined;
  return product;
});
const purchaseClaim = computed(() => isActiveCycle.value ? displayState.value?.claimNo ?? null : null);
const originalPurchase = computed(() => purchaseClaim.value ? checkout.originalPurchase : null);
const purchaseConfirmation = useTrialPurchaseConfirmation();
const trialResultConfirming = computed(() => (freeTrial.authorityResultUnknown && !freeTrial.startRetryable)
  || (purchaseConfirmation.value && !originalPurchase.value));
provide(TRIAL_PAYMENT_CARD_KEY, () => {
  const original = originalPurchase.value;
  return pageVisible.value && !authorityScreenUnavailable.value && original?.kind === "EXTERNAL" ? original.paymentNo : null;
});
const hasScopedOptions = computed(() => purchaseClaim.value !== null && purchaseClaim.value === trialOptions.claimNo);
const purchaseOptionsView = computed(() => hasScopedOptions.value ? trialOptions.current : { status: "idle" as const, options: [] });
const waitingForReselection = computed(() => hasScopedOptions.value && !!trialOptions.current.invalidatedProductNo);
const selectedOption = computed(() => hasScopedOptions.value && !waitingForReselection.value && trialOptions.selectedOption?.canBuy
  ? trialOptions.selectedOption : null);
const selectedProductNo = computed(() => originalPurchase.value ? null : selectedOption.value?.productNo ?? null);
const usePurchaseOptions = computed(() => remoteApiEnabled && isActiveCycle.value && purchaseOptionsView.value.status !== "unsupported");
const purchaseOptionLoading = computed(() => usePurchaseOptions.value && !purchaseOptionsView.value.options.length
  && ["idle", "loading"].includes(purchaseOptionsView.value.status));
// Only the first read: a later failure keeps the rows, the selection and the ticket it already has.
const purchaseOptionsFailed = computed(() => usePurchaseOptions.value && purchaseOptionsView.value.status === "failed"
  && !purchaseOptionsView.value.options.length);
const noBuyableDevices = computed(() => usePurchaseOptions.value
  && (purchaseOptionsView.value.status === "ready" || purchaseOptionsView.value.options.length > 0)
  && !purchaseOptionsView.value.options.some(option => option.canBuy));
const showDevicePicker = computed(() => {
  if (!usePurchaseOptions.value) return false;
  const { options, status } = purchaseOptionsView.value;
  return options.length ? waitingForReselection.value || options.some(option => !option.isTrialProduct)
    : (purchaseOptionLoading.value || status === "failed") && hasScopedOptions.value && trialOptions.remembered.hasOtherDevices;
});
const purchaseEstimates = computed(() => {
  const estimates: Record<string, { low: number; high: number }> = {};
  if (productCatalogState.status !== "ready") return estimates;
  for (const option of purchaseOptionsView.value.options) {
    const product = getProduct(option.productNo);
    const estimate = product && productDailyEstimateRange(product);
    if (estimate) estimates[option.productNo] = estimate;
  }
  return estimates;
});
const purchaseConditionLinks = computed(() => productCatalogState.status === "ready"
  ? purchaseOptionsView.value.options.filter(option => getProduct(option.productNo)?.available !== false && !!getProduct(option.productNo))
    .map(option => option.productNo)
  : []);
function openPurchaseConditions(productNo: string) {
  if (purchaseConditionLinks.value.includes(productNo)) navTo(`/pages/store/detail?id=${encodeURIComponent(productNo)}`);
}
function selectDevice(productNo: string) {
  if (!originalPurchase.value && hasScopedOptions.value) trialOptions.select(productNo);
}
const ticketQuote = computed(() => {
  if (originalPurchase.value || !isActiveCycle.value) return null;
  if (!usePurchaseOptions.value) return displayState.value?.quote ?? null;
  if (waitingForReselection.value) return null;
  if (purchaseOptionLoading.value || purchaseOptionsFailed.value) {
    const requested = entryProductNo.value ?? (hasScopedOptions.value ? trialOptions.remembered.productNo : null);
    return !requested || requested === trialProductId.value ? displayState.value?.quote ?? null : null;
  }
  return selectedOption.value?.quote ?? null;
});
const earlyQuoteLapsed = computed(() => {
  const quote = ticketQuote.value;
  return !!quote?.earlyPurchase && quote.earlyEndsAt !== null && serverNow.value >= quote.earlyEndsAt;
});
const purchaseQuote = computed(() => remoteApiEnabled && isActiveCycle.value && !earlyQuoteLapsed.value
  ? ticketQuote.value : null);
watch(() => pageVisible.value && usePurchaseOptions.value && earlyQuoteLapsed.value && foregroundReadAllowed(), lapsed => {
  if (lapsed) void optionsRead.refresh().catch(() => {});
});
const earlyQuote = computed(() => status.value === "active" && purchaseQuote.value?.earlyPurchase ? purchaseQuote.value : null);

// Prices and discounts are dollars; earnings and credit are USDT (a quote counts 1 USDT as $1).
const usd = (value: number) => `$${formatGroupedAmount(value)}`;
// Caps and the headline discount read as whole dollars when they are ("$50", "$10").
const usdShort = (value: number) => (Number.isInteger(value) ? `$${value}` : usd(value));
/** Integer and decimal digits of a grouped amount, so the decimals can take the secondary colour. */
function amountParts(value: number): [string, string] {
  const [whole, fraction = ""] = formatGroupedAmount(value).split(".");
  return [whole, fraction];
}

// ── Hero: ring = what is left of the current phase, from its real start and end ──
const RING_LENGTH = 603.19; // 2π × 96
const ribbon = computed(() => {
  if (displayState.value?.serverState === "EXTENDED") return t.value.trial.countdownExtendedRibbon;
  return isGrace.value ? t.value.trial.countdownGraceRibbon : t.value.trial.countdownActiveRibbon;
});
const ringOffset = computed(() => {
  const start = isGrace.value ? expiresAt.value : startedAt.value;
  const end = boundary.value;
  if (start === null || end === null) return RING_LENGTH;
  const left = Math.min(1, Math.max(0, (end - now.value) / (end - start)));
  return +(RING_LENGTH * (1 - left)).toFixed(2);
});
// d + h:mm while a day or more is left; the final 24 hours tick to the second.
const countdownText = computed(() => {
  const ms = remainingMsValue.value;
  if (ms >= 86_400_000) {
    const minutes = Math.floor(ms / 60_000);
    return fmt(detail.value.countdownDays, { days: Math.floor(minutes / 1440), hours: Math.floor(minutes % 1440 / 60), minutes: String(minutes % 60).padStart(2, "0") });
  }
  const seconds = Math.floor(ms / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(v => String(v).padStart(2, "0")).join(":");
});
const deadlineText = computed(() => {
  const at = boundary.value;
  if (at === null) return "";
  return fmt(isGrace.value ? detail.value.keptUntil : purchase.value.heroTermUntil, { time: formatTrialDeadline(at, dateLocale()) });
});
// Both counts follow the live source: a tick or quote re-read during the 900 ms entrance must not cut it short.
const earnedSource = computed(() => (isActiveCycle.value && !authorityScreenUnavailable.value ? shadowUSD.value : null));
const earnedCount = useViewCountUp(earnedSource, "grouped", { follow: true });
const earnedParts = computed<[string, string]>(() => (visibility.hidden ? [visibility.mask(0), ""] : amountParts(earnedSource.value ?? 0)));

// ── Quote ticket ──
const ticketDiscounts = computed(() => {
  const quote = purchaseQuote.value;
  if (!quote) return { promo: 0, early: 0, offset: 0, total: 0 };
  const { promoDiscountUSD: promo, earlyDiscountUSD: early, offsetUSD: offset } = quote;
  if (!usePurchaseOptions.value) return { promo, early, offset, total: Number(formatAmount(promo + early + offset)) };
  return trialDiscountDisplay(quote);
});
const discountTotal = computed(() => ticketDiscounts.value.total);
const totalSource = computed(() => (purchaseQuote.value && !authorityScreenUnavailable.value
  ? Number(formatAmount(discountTotal.value + purchaseQuote.value.remainderUSD)) : null));
const totalCount = useViewCountUp(totalSource, "grouped", { follow: true });
const totalParts = computed<[string, string]>(() => (visibility.hidden ? [visibility.mask(0), ""] : amountParts(totalSource.value ?? 0)));
const dueParts = computed(() => amountParts(purchaseQuote.value?.amountUSD ?? 0));
// The discount this order really gets, at the two decimals its row shows.
const earlySaving = computed(() => !!earlyQuote.value && ticketDiscounts.value.early > 0);
const ticketDeviceName = computed(() => (selectedOption.value?.productName ?? trialDeviceName.value).replace(/ /g, "\u00A0"));
// The trial device keeps the price it was claimed at; say so when the store price differs.
const claimPriceDiffers = computed(() => {
  const option = selectedOption.value;
  return !!option?.isTrialProduct && option.marketPriceUSD !== undefined && option.marketPriceUSD !== option.priceUSD;
});
const buyTitle = computed(() => {
  if (earlySaving.value) return fmt(selectedOption.value && !selectedOption.value.isTrialProduct ? detail.value.earlyTitleOther : detail.value.earlyTitle, {
    device: ticketDeviceName.value, amount: usdShort(ticketDiscounts.value.early),
  });
  return isGrace.value ? detail.value.graceTitle : "";
});
// What arrives after purchase: USDT when there is some, otherwise the UVT (amounts never split across lines).
// Both figures carry the trial earnings, so the data-visibility mask hides them like the hero.
const totalBreakdown = computed(() => {
  const quote = purchaseQuote.value;
  if (!quote) return "";
  const discount = visibility.mask(usd(discountTotal.value));
  const credit = quote.remainderUSD > 0 ? `${visibility.mask(formatGroupedAmount(quote.remainderUSD))} USDT`
    : quote.rewardNEX > 0 ? `${visibility.mask(formatGroupedAmount(quote.rewardNEX))} UVT` : "";
  return credit ? fmt(detail.value.totalBreakdown, { discount, credit }) : fmt(detail.value.totalDiscountOnly, { discount });
});
const promoLabel = computed(() => {
  const pct = formatTrialDiscountPercent(cfg.value.discountRate);
  const cap = cfg.value.discountCapUSD;
  return cap === null ? fmt(detail.value.promoRowNoCap, { pct }) : fmt(detail.value.promoRow, { pct, cap: usdShort(cap) });
});
const conversionRefunded = computed(() => remoteApiEnabled && status.value === "converted"
  && displayState.value?.conversion?.refunded === true);

const w = computed(() => t.value.trial);
// B53: the header, claim title and owned note name the confirmed trial product: the current
// offer while claimable, the claimed product once running or bought. Nothing shows before the
// first confirmed read, so the boot default never flashes in; local mock keeps its own config.
const trialDeviceName = computed(() => (!remoteApiEnabled || displayState.value
  ? freeTrial.purchasedDevice?.productName ?? cfg.value.trialProductName : ""));
// Inside sentences the name never splits across lines ("UVELBox / Pro v2").
const trialDeviceNameKept = computed(() => trialDeviceName.value.replace(/ /g, "\u00A0"));
const idleBody = computed(() => !remoteApiEnabled || displayState.value
  ? fmt(w.value.idleBody, { n: String(cfg.value.trialDays) })
  : "");
const offsetRemainderNote = computed(() => fmt(w.value.offsetRemainderNote, { remainder: visibility.mask(formatAmount(trialOffset.value.remainderUSD)) }));
const openingPurchase = ref(false);
const trialBuyBusy = computed(() => openingPurchase.value || (originalPurchase.value ? false
  : usePurchaseOptions.value ? purchaseOptionLoading.value : trialCatalogLoading.value));
const listLoading = computed(() => purchaseOptionLoading.value && !originalPurchase.value);
const trialBuyDisabled = computed(() => authorityUnavailable.value || (originalPurchase.value ? false
  : usePurchaseOptions.value ? !selectedOption.value || !purchaseQuote.value
    : trialProductUnavailable.value && !trialCatalogLoading.value));
const trialBuyCtaText = computed(() => {
  const original = originalPurchase.value;
  if (original) return original.status === "AWAITING_PAYMENT" || original.status === "RESUMABLE"
    ? t.value.orders.pendingContinue : detail.value.viewProgress;
  if (usePurchaseOptions.value) {
    if (waitingForReselection.value) return detail.value.chooseDevice;
    return selectedOption.value && purchaseQuote.value
      ? fmt(detail.value.buyCta, { amount: usd(purchaseQuote.value.amountUSD) }) : fleetCopy.value.buy;
  }
  if (productCatalogState.status === "error") return t.value.store.catalogErrorTitle;
  if (trialCatalogLoading.value) return w.value.buyCtaPlain;
  if (trialProductUnavailable.value) return t.value.store.temporarilyOutOfStock;
  if (purchaseQuote.value) return fmt(detail.value.buyCta, { amount: usd(purchaseQuote.value.amountUSD) });
  return w.value.buyCtaPlain;
});
// none-state eligibility (异常2 — concrete reason, never a generic error).
const canStartNow = computed(() => {
  void now.value; // re-evaluate each tick (eligibility isn't reactive on config alone)
  return freeTrial.canStart();
});
const claimVisible = computed(() => status.value === "none" || (status.value === "ended" && (displayState.value?.canStart ?? canStartNow.value)));
const ineligibleReasonText = computed(() => {
  const r = freeTrial.eligibility().reason;
  // PROD: this reason is served by GET /api/trial/eligibility, so a region
  // refusal arrives here as the reason code. Translate it first; `null` means an
  // ordinary reason, which the named branches below still handle unchanged.
  // 本页没有重试控件；读取失败只说明暂不可用，不推断活动关闭。
  const geo = geoPolicyUserMessage(r, t.value.geoPolicy);
  if (geo) return geoPolicyErrorKind(r) === "unavailable" ? w.value.eligReasonClosed : geo;
  if (r === "converted") return w.value.eligReasonConverted;
  if (r === "used") return w.value.eligReasonUsed;
  if (r === "in-progress") return w.value.eligReasonInProgress;
  if (r === "risk") return w.value.eligReasonRisk;
  if (r === "quota-exhausted") return w.value.eligReasonQuota;
  if (r === "product-unavailable") return lifecycle.value.deviceUnclaimable;
  if (r === "capacity-full") return lifecycle.value.capacityFull;
  return w.value.eligReasonClosed;
});
const barRetry = computed(() => (isActiveCycle.value || status.value === "ended") && !claimVisible.value
  && !usePurchaseOptions.value && !originalPurchase.value && productCatalogState.status === "error");
// The one line above the bottom button that says why it is disabled.
const barNote = computed(() => {
  if (freeTrial.startRetryable) return t.value.trial.claimUnknownInline;
  if (staleDisplay.value && isActiveCycle.value) return t.value.exchange.staleSnapshot;
  if (staleDisplay.value) return lifecycle.value.autoRetrying;
  if (claimVisible.value) return canStartNow.value ? "" : ineligibleReasonText.value;
  if (originalPurchase.value) return originalPurchase.value.status === "RESUMABLE" ? purchase.value.coUnfinished : "";
  if (usePurchaseOptions.value) {
    const only = purchaseOptionsView.value.options[0];
    if (noBuyableDevices.value && purchaseOptionsView.value.options.length === 1 && only?.isTrialProduct) {
      return trialOptionReadFailed(only) ? detail.value.quoteFailed
        : trialPurchaseReasonMessage(t.value, only.reasonCode) ?? detail.value.optionUnavailable;
    }
    if (waitingForReselection.value) return "";
    if (purchaseOptionsFailed.value) return detail.value.listFailed;
    if (purchaseOptionsView.value.status === "not-convertible") return detail.value.optionUnavailable;
    if (noBuyableDevices.value) return isGrace.value ? detail.value.noneBuyableGrace : detail.value.noneBuyable;
    return purchaseOptionsView.value.status === "failed" ? t.value.exchange.staleSnapshot : "";
  }
  if ((isActiveCycle.value || status.value === "ended") && trialProductUnavailable.value && productCatalogState.status === "ready") {
    return t.value.store.trialProductUnavailable;
  }
  return "";
});

const barNoteWarn = computed(() => barNote.value !== "" && barNote.value === detail.value.listFailed);

// Rules sheet (spec ⑥: pre-purchase offset / no cash-out / post-purchase
// remainder → balance / expiry).
const rulesOpen = ref(false);
const rulesLines = computed(() => [
  cfg.value.trialOffsetCapUSD === null ? detail.value.rulesBeforeNoCap
    : fmt(w.value.rulesBefore, { cap: formatGroupedAmount(cfg.value.trialOffsetCapUSD) }),
  w.value.rulesNoCash,
  w.value.rulesAfter,
  ...(earlyQuote.value && earlyQuote.value.earlyDiscountConfiguredUSD > 0 ? [fmt(
    earlyQuote.value.settlementPolicy === "FULL_TERM_ON_CONVERSION" ? detail.value.rulesEarlyFull : detail.value.rulesEarly,
    { discount: usdShort(earlyQuote.value.earlyDiscountConfiguredUSD) },
  )] : []),
  lifecycle.value.rulesRefund,
  w.value.rulesExpiry,
]);

function claim() {
  if (!canStartNow.value) return; // disabled CTA — reason line explains why
  claimSheet.show();
}

function purchaseVisit(claimNo = displayState.value?.claimNo) {
  const binding = app.accountBindingEpoch;
  const sameClaim = () => binding === app.accountBindingEpoch && claimNo === displayState.value?.claimNo;
  return { sameClaim, current: () => pageVisible.value && sameClaim() };
}

function checkoutHref(productNo: string, recovery?: { kind: "resume" | "refusal"; submissionNo: string }) {
  const query = new URLSearchParams({ product: productNo, source: "trial" });
  if (recovery) query.set(recovery.kind === "resume" ? "trialResume" : "trialRefusal", recovery.submissionNo);
  return `/pages/store/checkout?${query}`;
}

async function goCheckout() {
  if (trialBuyDisabled.value || openingPurchase.value) return;
  const original = originalPurchase.value;
  const productNo = usePurchaseOptions.value ? selectedProductNo.value : trialProductId.value;
  if (!original && !productNo) return;
  const visit = purchaseVisit();
  openingPurchase.value = true;
  try {
    if (original?.kind === "EXTERNAL") {
      await resumeTrialPurchasePayment(original.paymentNo, original.claimNo, original.device.productNo, original.device.productName, visit.current, {
        onDelivered: completion => {
          if (visit.current()) checkout.settleExternal(original.claimNo, parseTrialConvertReceipt(completion.receipt));
        },
        onExpired: () => { if (visit.current()) void freeTrial.refreshRemote(); },
      });
    } else if (original?.kind === "BALANCE") {
      const legacy = freeTrial.pendingConversion(original.device.productNo)?.key === original.submissionNo;
      if (original.status === "RESUMABLE") await navTo(checkoutHref(original.device.productNo,
        legacy ? undefined : { kind: "resume", submissionNo: original.submissionNo }));
      else if (legacy) await freeTrial.recoverLegacyConversion();
      else await checkout.readSubmission();
    } else if (productNo) {
      if (usePurchaseOptions.value) {
        await trialOptions.refresh();
        if (!visit.current() || originalPurchase.value || authorityUnavailable.value) return;
        const options = trialOptions.current;
        if (options.status === "unsupported") {
          if (productNo !== trialProductId.value) toast.warn(detail.value.deviceGone);
          else if (!trialProductUnavailable.value) await navTo(checkoutHref(productNo));
          return;
        }
        if (options.status !== "ready" || options.selectedProductNo !== productNo || !purchaseQuote.value) return;
      }
      if (visit.current()) await navTo(checkoutHref(productNo));
    }
  } catch {
    if (!visit.current()) return;
    if (original?.kind === "EXTERNAL") toast.warn(purchase.value.coPurchaseUnavailable);
    else if (!original) toast.warn(detail.value.listFailed);
  } finally {
    if (visit.sameClaim()) openingPurchase.value = false;
  }
}

watch(() => app.accountBindingEpoch, (epoch) => {
  if (entryAccountEpoch !== null && entryAccountEpoch !== epoch) entryProductNo.value = undefined;
}, { flush: "sync" });
let observedOriginalClaim: string | null = null;
let handledRefusal: string | null = null;
let openingResult = false;
watch([() => app.accountBindingEpoch, () => displayState.value?.claimNo], () => {
  observedOriginalClaim = handledRefusal = null;
  openingPurchase.value = false;
}, { flush: "sync" });
watch(() => hasScopedOptions.value ? trialOptions.current.invalidatedProductNo : null, (invalidated) => {
  if (!invalidated || !pageVisible.value || originalPurchase.value) return;
  const outcome = checkout.outcome;
  if (outcome.status === "refused" && outcome.claimNo === purchaseClaim.value && outcome.productNo === invalidated) {
    const reason = outcome.refusal.reasonCode;
    const optionReason = trialOptions.current.options.find(option => option.productNo === invalidated)?.reasonCode;
    if ((reason === optionReason || reason === "TRIAL_PRODUCT_NOT_AVAILABLE" || trialDeviceNeedsReselection(reason))
        && trialResults.takeAnnouncedRefusal(trialRefusalResultKey(outcome.claimNo, outcome.submissionNo))) return;
  }
  toast.warn(detail.value.deviceGone);
}, { flush: "post" });
watch([pageVisible, originalPurchase, purchaseConfirmation], ([visible, original, confirming]) => {
  if (visible && (original || confirming)) observedOriginalClaim = original?.claimNo ?? displayState.value?.claimNo ?? null;
}, { flush: "post" });

async function openTrialResult(orderNo: string) {
  if (openingResult || !trialResults.consume(trialOrderResultKey(orderNo))) return;
  openingResult = true;
  try {
    if (await navReplace(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}&result=trial`)) {
      checkout.clearSettled(orderNo);
      freeTrial.clearLegacyConversionResult(orderNo);
    }
  } finally {
    openingResult = false;
  }
}

const pendingBalanceSubmission = computed(() => {
  const original = originalPurchase.value;
  return original?.kind === "BALANCE" && original.status === "PROCESSING" ? original.submissionNo : null;
});
watch([pageVisible, pendingBalanceSubmission, foregroundReadAllowed], ([visible, submissionNo, allowed]) => {
  if (visible && submissionNo && allowed) {
    const original = originalPurchase.value;
    const read = original && freeTrial.pendingConversion(original.device.productNo)?.key === submissionNo
      ? freeTrial.recoverLegacyConversion : checkout.readSubmission;
    void read().catch(() => {});
  }
});
const payment = usePurchasePayment();
useVisibleInterval(() => { if (foregroundReadAllowed()) void freeTrial.refreshRemote(); }, 15_000,
  () => originalPurchase.value?.kind === "EXTERNAL" && !payment.state.open);

watch([pageVisible, displayState, () => freeTrial.confirmedLegacyConversion, () => freeTrial.deniedLegacyConversion,
  () => checkout.outcome], ([visible, state, legacyResult, legacyDenial, outcome]) => {
  if (!visible || !state?.claimNo) return;
  if (legacyResult?.claimNo === state.claimNo && !state.conversion?.refunded) {
    void openTrialResult(legacyResult.orderNo);
    return;
  }
  if (legacyDenial?.claimNo === state.claimNo) {
    const key = trialRefusalResultKey(legacyDenial.claimNo, legacyDenial.key);
    if (!trialResults.wasDelivered(key)) {
      toast.warn(trialPurchaseReasonMessage(t.value, legacyDenial.reason, useLocaleStore().code) ?? purchase.value.coPurchaseUnavailable);
      trialResults.consume(key, true);
    }
  }
  if (outcome.status === "settled" && outcome.claimNo === state.claimNo) {
    void openTrialResult(outcome.receipt.orderNo);
  } else if (observedOriginalClaim === state.claimNo && state.status === "converted"
      && state.conversion?.orderNo && !state.conversion.refunded) {
    void openTrialResult(state.conversion.orderNo);
  } else if (outcome.status === "refused" && outcome.claimNo === state.claimNo && handledRefusal !== outcome.submissionNo) {
    const key = trialRefusalResultKey(outcome.claimNo, outcome.submissionNo);
    if (trialResults.wasDelivered(key)) return;
    handledRefusal = outcome.submissionNo;
    const reason = outcome.refusal.reasonCode;
    if (trialDeviceNeedsReselection(reason)) {
      if (trialOptions.claimNo === state.claimNo) trialOptions.invalidateSelection(outcome.productNo);
      toast.warn(detail.value.deviceGone);
      trialResults.consume(key, true);
      void optionsRead.refresh().catch(() => {});
    } else if (reason === "TRIAL_NOT_CONVERTIBLE") {
      toast.warn(trialPurchaseReasonMessage(t.value, reason, useLocaleStore().code) ?? purchase.value.coPurchaseUnavailable);
      trialResults.consume(key, true);
      void freeTrial.refreshRemote();
    } else if (reason === "TRIAL_WALLET_INSUFFICIENT" || trialPriceChanged(reason) || reason === "TRIAL_PRODUCT_NOT_AVAILABLE") {
      void navTo(checkoutHref(outcome.productNo, { kind: "refusal", submissionNo: outcome.submissionNo }));
    } else {
      toast.warn(trialPurchaseReasonMessage(t.value, reason, useLocaleStore().code) ?? purchase.value.coPurchaseUnavailable);
      trialResults.consume(key, true);
      void optionsRead.refresh().catch(() => {});
    }
  }
}, { flush: "post" });
watch(pageVisible, (visible, _, onCleanup) => {
  if (!visible) return;
  const unregisterPresenter = trialResults.registerPresenter(claimNo => displayState.value?.claimNo === claimNo);
  const unregisterRefresh = registerActivePageRefresh(async () => {
    if (purchaseClaim.value) {
      await freeTrial.refreshRemote();
      if (!purchaseConfirmation.value) await optionsRead.refresh();
    }
  }, "pages/me/trial");
  onCleanup(() => { unregisterPresenter(); unregisterRefresh(); });
});

useAutoRecovery({
  active: () => !claimSheet.open,
  failed: () => remoteApiEnabled && !freeTrial.authorityResultUnknown && !purchaseConfirmation.value
    && freeTrial.authorityStatus !== "loading"
    && (freeTrial.authorityStatus === "error" || freeTrial.authorityIncomplete),
  retry: () => freeTrial.refreshRemote(),
  repeatMs: 30_000,
  repeatWhile: () => !hasVisiblePullRefresh(),
});
useAutoRecovery({ failed: () => productCatalogState.status === "error", retry: () => refreshProductCatalog(true) });
function retryCatalog() {
  if (productCatalogState.status !== "error") return;
  void refreshProductCatalog(true);
}
function goEarn() {
  navTo("/pages/earn/earn");
}
function goDevices() {
  navTo("/pages/me/devices");
}
function goStore() {
  navTo("/store");
}
function goRefundedOrder() {
  const orderNo = displayState.value?.conversion?.orderNo;
  if (orderNo) navTo(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}`);
}

// 遮罩只拦指针不拦键盘:不接这一层,弹层打开后 Tab 会直接走到背景(那里有花钱的按钮),
// 且没有 Esc、关掉后焦点也回不到触发它的控件。
useDialogA11y(computed(() => rulesOpen.value), ".trs-root", () => { rulesOpen.value = false; }, true);
</script>

<style scoped>
/* Unknown command result: the shared pending result head in the page's free height (03 §3.5.2, 3.6.1). */
.trial-confirming { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px; }
/* Loading keeps the states' shape, still: the 208 ring track where every state's ring sits, then title and body lines (03 §3.4). */
.trial-read-skeleton { display:flex;flex-direction:column;align-items:center;padding-top:48px; }
.trial-read-skeleton__ring { width:198px;height:198px;margin:5px;box-sizing:border-box;border-radius:50%;border:6px solid color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.trial-read-skeleton__title { width:60%;max-width:220px;height:20px;margin-top:32px;border-radius:10px;background:color-mix(in srgb, var(--v5-ink) 6%, transparent); }
.trial-read-skeleton__body { width:44%;max-width:160px;height:14px;margin-top:10px;border-radius:7px;background:color-mix(in srgb, var(--v5-ink) 6%, transparent); }

/* ── Page frame: each state is a full-width column; its one ambient glow is clipped to the page. ── */
.trial-page { color:var(--v5-ink); }
.trial-state { position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;font-variant-numeric:tabular-nums; }
.trial-state > * { position:relative; }
.trial-state--terminal { padding-top:48px; }
.trial-glow { position:absolute !important;left:50%;border-radius:50%;pointer-events:none;animation:trial-fade 1.2s ease-out both; }
.trial-glow--hero { top:-8px;width:360px;height:360px;margin-left:-180px;background:radial-gradient(closest-side, color-mix(in srgb, var(--v5-tech-cyan) 24%, transparent), transparent); }
.trial-state--grace .trial-glow--hero { background:radial-gradient(closest-side, color-mix(in srgb, var(--v5-warning) 12%, transparent), transparent); }
.trial-glow--claim { top:22px;width:380px;height:380px;margin-left:-190px;background:radial-gradient(closest-side, color-mix(in srgb, var(--v5-tech-cyan) 22%, transparent), transparent); }
.trial-glow--owned { top:-8px;width:360px;height:360px;margin-left:-180px;background:radial-gradient(closest-side, color-mix(in srgb, var(--v5-tech-cyan) 22%, transparent), transparent); }
:global([data-theme="light"] .trial-glow--hero),
:global([data-theme="light"] .trial-glow--claim),
:global([data-theme="light"] .trial-glow--owned) { background:radial-gradient(closest-side, color-mix(in srgb, var(--v5-tech-cyan) 16%, transparent), transparent); }
:global([data-theme="light"] .trial-state--grace .trial-glow--hero) { background:radial-gradient(closest-side, color-mix(in srgb, var(--v5-warning) 10%, transparent), transparent); }

/* ── Hero: status row, countdown ring with the device inside, remaining time ── */
.trial-hero { align-self:stretch;display:flex;flex-direction:column;align-items:center;padding:0 16px; }
.trial-hero__top { align-self:stretch;display:flex;align-items:center;justify-content:space-between;height:24px; }
.trial-online { display:inline-flex;align-items:center;gap:6px;color:var(--v5-ink-3);font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.trial-online__dot { width:8px;height:8px;border-radius:50%;background:var(--v5-success); }
.trial-ring { position:relative;flex:none;width:208px;height:208px;margin-top:12px; }
.trial-ring--terminal { margin-top:0; }
/* The ring is drawn through NxNativeSvg on the App: inner nodes are reached with :deep(), and the
   remaining length comes in as a CSS variable so the per-second tick never rewrites the svg. */
.trial-ring__svg { position:absolute;inset:0; }
.trial-ring__svg :deep(svg) { display:block; }
.trial-ring :deep(.trial-ring__track) { stroke:color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.trial-ring :deep(.trial-ring__arc) { stroke:var(--v5-tech-cyan);stroke-dashoffset:var(--trial-ring-offset);animation:trial-ring-draw .9s cubic-bezier(.16,1,.3,1) .15s both; }
.trial-state--grace .trial-ring :deep(.trial-ring__arc) { stroke:var(--v5-warning); }
.trial-ring :deep(.trial-ring__full) { stroke:var(--v5-tech-cyan); }
.trial-ring__machine { position:absolute;left:24px;top:20px;width:160px;height:160px; }
.trial-state--grace .trial-ring__machine { filter:grayscale(1);opacity:.5; }
.trial-ring--muted .trial-ring__machine { filter:grayscale(1);opacity:.45; }
.trial-ring__badge { position:absolute;right:18px;bottom:18px;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--v5-surface-2);color:var(--v5-ink-3); }
.trial-ring__check { position:absolute;right:14px;bottom:14px;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--v5-brand);color:var(--v5-on-brand);animation:trial-pop .5s cubic-bezier(.16,1,.3,1) .35s both; }
.trial-countdown { display:flex;align-items:baseline;gap:8px;margin-top:12px; }
.trial-countdown__label { color:var(--v5-ink-3);font:400 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); }
.trial-countdown__value { font:500 22px/28px var(--font-jet-mono);font-variant-numeric:tabular-nums;white-space:nowrap; }
.trial-state--grace .trial-countdown__value { color:var(--v5-warning-ink); }
.trial-hero__deadline { margin-top:4px;color:var(--v5-ink-3);font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }

/* ── Accrued earnings ── */
.trial-earned { display:flex;flex-direction:column;align-items:center;margin-top:24px;padding:0 16px;text-align:center; }
.trial-earned__label { color:var(--v5-ink-3);font:400 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); }
.trial-earned__amount { display:flex;align-items:baseline;justify-content:center;gap:6px;margin-top:4px; }
.trial-earned__unit { color:var(--v5-ink-3);font:500 15px/20px var(--font-v5); }
.trial-earned__uvt { margin-top:8px;color:var(--v5-nex-ink);font:500 15px/20px var(--font-v5);font-variant-numeric:tabular-nums;white-space:nowrap; }
.trial-earned__uvt-after { color:var(--v5-ink-3);font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);white-space:nowrap; }
.trial-earned__note { margin-top:4px;color:var(--v5-ink-3);font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.trial-dim { color:var(--v5-ink-3); }
.trial-unit-small { font-size:12px;line-height:16px; }

/* ── Payment in progress and device list ── */
.trial-select { align-self:stretch;display:flex;flex-direction:column;gap:24px;margin:var(--ui-space-section-gap) 16px 0; }

/* ── Quote ticket ── */
.trial-ticket { align-self:stretch;margin:28px 16px 0;border-radius:var(--ui-radius-surface);background:var(--v5-surface);box-shadow:var(--v5-glass-shadow); }
.trial-ticket__body { padding:20px 20px 16px; }
.trial-ticket .trial-ticket__tag { display:flex;width:fit-content;margin-bottom:10px; }
.trial-ticket__tag-icon { display:inline-block;margin-right:4px;vertical-align:-2px; }
.trial-ticket__title { display:block;font:var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5);text-wrap:pretty; }
.trial-ticket__subtitle { display:block;margin-top:4px;color:var(--v5-ink-3);font:400 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); }
.trial-ticket__estimate { font-size:12px;line-height:16px; }
.trial-total { margin-top:16px;padding:14px 16px;border-radius:16px;background:var(--v5-surface-2); }
:global([data-theme="light"] .trial-total) { background:var(--v5-bg); }
/* No title above it (trial term without a discount): the benefit block starts the ticket. */
.trial-ticket__body > .trial-total:first-child { margin-top:0; }
.trial-total__breakdown { display:block;color:var(--v5-ink-3);font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);font-variant-numeric:tabular-nums; }
.trial-total__line { display:flex;flex-wrap:wrap;align-items:baseline;column-gap:8px;margin-top:6px; }
.trial-total__label { font:500 13px/18px var(--font-v5); }
.trial-total__unit { color:var(--v5-ink-3);font-weight:500; }
.trial-total__uvt { color:var(--v5-nex-ink);font:500 15px/20px var(--font-v5);font-variant-numeric:tabular-nums;white-space:nowrap; }
.trial-rows { display:flex;flex-direction:column;gap:10px;margin-top:16px; }
.trial-row { display:flex;align-items:center;justify-content:space-between;gap:12px;font:400 13px/18px var(--font-v5);font-variant-numeric:tabular-nums; }
.trial-row__label { flex:1;min-width:0;color:var(--v5-ink-3);font:400 13px/18px var(--font-v5);font-variant-numeric:tabular-nums;text-wrap:pretty; }
.trial-row .trial-row__label { display:flex;flex-wrap:wrap;align-items:center;column-gap:6px;row-gap:2px; }
.trial-row__claim { flex:none;font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);white-space:nowrap; }
.trial-row__value { flex:none;white-space:nowrap; }
.trial-ticket .trial-limit-tag { height:20px;padding:0 6px; }
.trial-sum { display:flex;flex-direction:column;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--v5-border); }
.trial-sum__row { display:flex;align-items:baseline;justify-content:space-between;gap:12px; }
.trial-sum__label { font:500 13px/18px var(--font-v5); }
.trial-sum__discount { flex:none;font:500 15px/20px var(--font-v5);font-variant-numeric:tabular-nums;white-space:nowrap; }
.trial-sum__price { flex:none;display:inline-flex;align-items:baseline;gap:8px;white-space:nowrap; }
.trial-sum__strike { color:var(--v5-ink-3);font:400 13px/18px var(--font-v5);font-variant-numeric:tabular-nums;text-decoration:line-through; }
.trial-sum__amount { font:600 24px/30px var(--font-amount);font-variant-numeric:tabular-nums;letter-spacing:-0.02em; }
.trial-sum__currency { color:var(--v5-ink-3);font-size:14px; }
.trial-perf { position:relative;height:20px; }
.trial-perf__notch { position:absolute;top:0;width:20px;height:20px;border-radius:50%;background:var(--v5-bg); }
.trial-perf__notch--l { left:-10px; }
.trial-perf__notch--r { right:-10px; }
.trial-perf__line { position:absolute;left:20px;right:20px;top:9px;border-top:1.5px dashed var(--v5-border-strong); }
.trial-credit { padding:12px 20px 20px; }
.trial-credit__label { display:block;color:var(--v5-ink-3);font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.trial-credit__row { display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-top:6px; }
.trial-credit__name { flex:1;min-width:0;color:var(--v5-ink-3);font:400 12px/16px var(--font-v5); }
.trial-credit__value { flex:none;font:500 15px/20px var(--font-v5);font-variant-numeric:tabular-nums;white-space:nowrap; }
.trial-credit__note { display:block;margin-top:4px;color:var(--v5-ink-3);font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.trial-credit__sep { color:var(--v5-ink-4); }
.trial-credit__uvt { color:var(--v5-nex-ink); }
.trial-legacy-row { margin-top:10px; }
.trial-legacy-note { display:block;margin-top:8px;color:var(--v5-ink-3);font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);text-wrap:pretty; }

/* ── Open list rows under the ticket ── */
.trial-links { align-self:stretch;margin:20px 16px 0; }
.trial-link { display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;padding:0 2px;border-top:1px solid var(--v5-border);font:400 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); }
.trial-link:active { opacity:.7; }
.trial-link:focus-visible { outline:2px solid var(--v5-brand);outline-offset:2px; }
.trial-link > svg, .trial-link > .nx-native-svg { flex:none; }

/* ── Claim / terminal states ── */
.trial-slot { position:relative;flex:none;width:248px;height:248px; }
.trial-slot__ring { position:absolute;inset:0;border-radius:50%;border:2px dashed color-mix(in srgb, var(--v5-tech-cyan) 45%, transparent); }
:global([data-theme="light"] .trial-slot__ring) { border-color:color-mix(in srgb, var(--v5-tech-cyan) 55%, transparent); }
.trial-slot__machine { position:absolute;left:24px;top:20px;width:200px;height:200px; }
.trial-slot .trial-slot__tag { position:absolute;left:50%;bottom:-12px;padding:0 10px;transform:translateX(-50%); }
.trial-terminal-copy { display:flex;flex-direction:column;align-items:center;margin-top:28px;padding:0 24px;text-align:center; }
.trial-terminal-copy--claim { margin-top:36px; }
.trial-terminal-copy__title { font:var(--ui-type-hero-title-weight) var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5);text-wrap:balance;overflow-wrap:break-word; }
.trial-terminal-copy__body { margin-top:4px;color:var(--v5-ink-3);font:400 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5);text-wrap:pretty;overflow-wrap:break-word; }
.trial-terminal-copy__note { margin-top:8px;color:var(--v5-ink-3);font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);text-wrap:pretty; }

/* ── Bottom action bar (DS-30): the shared glass bar ── */
.trial-bar { position:absolute;z-index:36;display:flex;flex-direction:column;animation:trial-bar-in .42s cubic-bezier(.16,1,.3,1) .3s both; }
.trial-bar--pair { flex-direction:row;flex-wrap:wrap; }
.trial-bar__note { margin:0;padding-top:4px;color:var(--v5-ink-3);font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);text-align:center; }
/* A failed read is an alert: warning ink with its icon. */
.trial-bar .trial-bar__note--warn, .trial-bar__note--warn { display:flex;align-items:flex-start;justify-content:center;gap:4px;color:var(--v5-warning-ink); }
.trial-bar__note-icon { flex:none;width:14px;height:14px;margin-top:1px; }
.trial-bar__spinner { flex:none;box-sizing:border-box;width:18px;height:18px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:trial-spin .8s linear infinite; }
.trial-bar__retry { display:flex;justify-content:center;margin:-8px 0 -4px; }
/* Tray text buttons are 48 tall at any size, in neutral ink (03 §3.1 tray rule). */
.trial-bar__retry :deep(.nx-button) { min-height:48px; color:var(--v5-ink); }
/* In-flow twin of the bar: 12 top + 48 button + 30 bottom (+ safe area) + a 20px gap, less the 40px the chassis already pads. */
.trial-bar-space { visibility:hidden;display:flex;flex-direction:column;padding:0 32px calc(70px + env(safe-area-inset-bottom)); }
.trial-bar-space__retry { height:48px; }
.trial-bar__main { display:flex;width:100%; }
.trial-bar__side { flex:1 1 0;min-width:fit-content; }
.trial-bar__wide { flex:2 1 0;min-width:fit-content; }
.trial-bar :deep(.nx-button__content) { white-space:nowrap;font-variant-numeric:tabular-nums; }
.trial-bar--pair :deep(.nx-button__surface) { padding-inline:15px; }

/* ── Motion (DS-29): blocks rise once, the ring draws once, the bar slides up once ── */
.trial-rise { animation:trial-rise .52s cubic-bezier(.16,1,.3,1) both; }
.trial-rise--2 { animation-delay:.08s; }
.trial-rise--3 { animation-delay:.16s; }
.trial-rise--4 { animation-delay:.24s; }
.trial-rise--5 { animation-delay:.32s; }
@keyframes trial-rise { from { opacity:0;transform:translateY(14px); } to { opacity:1;transform:none; } }
@keyframes trial-fade { from { opacity:0; } to { opacity:1; } }
@keyframes trial-ring-draw { from { stroke-dashoffset:603.19; } }
@keyframes trial-bar-in { from { transform:translateY(100%); } to { transform:none; } }
@keyframes trial-spin { to { transform:rotate(360deg); } }
@keyframes trial-pop { 0% { opacity:0;transform:scale(.6); } 70% { opacity:1;transform:scale(1.08); } 100% { opacity:1;transform:scale(1); } }
@media (prefers-reduced-motion: reduce) {
  .trial-rise, .trial-glow, .trial-ring__check, .trial-bar, .trial-bar__spinner { animation:none; }
  .trial-ring :deep(.trial-ring__arc) { animation:none; }
}

.trs-root {
  position: fixed;
  inset: 0;
  z-index: 790;
}
.trs-backdrop {
  position: absolute;
  inset: 0;
  background: var(--v5-bg-color-mask);
  backdrop-filter: blur(8px) saturate(150%);
  -webkit-backdrop-filter: blur(8px) saturate(150%);
  animation: trs-fade 0.24s ease-out;
}
.trs-panel { border-radius: var(--nx-glass-radius) var(--nx-glass-radius) 0 0;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 800;


  background: var(--nx-glass-fill); box-shadow: var(--nx-glass-edge);

  padding: 20px 16px;
  padding-bottom: var(--nx-overlay-bottom);
  box-sizing: border-box;
  max-height: calc(100% - var(--nx-overlay-top));
  overflow-y: auto;
  animation: trs-slide-up 0.36s cubic-bezier(0.16, 1, 0.3, 1);
}
.trs-head { display:flex;align-items:center;justify-content:space-between;gap:12px; }
.trs-title { min-width:0;color:var(--v5-ink);font:var(--ui-type-hero-title-weight) var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5);overflow-wrap:break-word; }
.trs-close { flex:none;display:grid;place-items:center;width:44px;height:44px;margin-right:-4px;border-radius:50%;cursor:pointer; }
.trs-close__face { display:grid;place-items:center;width:36px;height:36px;border-radius:50%; }
.trs-close:active .trs-close__face { opacity:.7; }
.trs-close:focus-visible { outline:2px solid var(--v5-brand);outline-offset:-2px; }
.trs-list { display:flex;flex-direction:column;gap:10px;margin-top:14px; }
.trs-line { display:flex;align-items:flex-start;gap:8px; }
.trs-line__dot { flex:none;width:6px;height:6px;margin-top:8px;border-radius:50%;background:var(--v5-brand); }
.trs-line__text { flex:1;min-width:0;color:var(--v5-ink-2);font:var(--ui-type-guide-body-weight) var(--ui-type-guide-body)/var(--ui-type-guide-body-lh) var(--font-v5);overflow-wrap:break-word;text-wrap:balance; }
.trs-got { display:flex;width:100%;margin-top:18px; }
@keyframes trs-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes trs-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .trs-backdrop, .trs-panel { animation: none; }
}
</style>
