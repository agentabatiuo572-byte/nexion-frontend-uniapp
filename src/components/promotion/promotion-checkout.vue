<template>
  <view class="promotion promotion-main" :class="{'promotion-main--result':order?.paymentStatus==='PAID'}">
    <view v-if="!auth.isAuthenticated" class="promotion-flat"><text class="promotion-title">{{ p.signIn }}</text><PromotionAction class="promotion-action primary" role="button" tabindex="0" @click="signIn"><text>{{ p.signIn }}</text></PromotionAction></view>
    <view v-else-if="loading || reopenPaidOnEntry" class="promotion-flat" role="status" aria-live="polite"><text>{{ p.loading }}</text></view>
    <!-- The result's exits (查看设备, and 再买一台 via resultBuyAgain) sit in the page's bottom bar (checkout.vue #pageFixed, 04 §4.0). -->
    <CheckoutResult ref="resultView" v-else-if="order?.paymentStatus==='PAID'" :order-no="order.orderNo" payment-confirmed :state="resultState" :delivery="orders.getById(order.orderNo)?.deviceDelivery" :product-name="items.map(selectedItemName).join(' · ')" :product-image="items[0] ? items[0].imageUrl ?? getProduct(items[0].productNo)?.imageUrl : undefined" :product-images="resultImages" :amount="resultExactAmount??resultAmount?.value" :currency="resultAmount?.currency" :amount-precision="resultExactAmount?'full':undefined" :saved="bundleDiscount" :error="resultError" @devices="viewDevices" @support="contactResultSupport" @order="viewOrder" />
    <template v-else>
      <!-- Original purchase state: a page-floor hint (icon + text, no card, no stripe) above the products: the result, which purchase it is, what not to do. -->
      <view v-if="keepRecoveryTarget" class="checkout-keep-recovery" role="status">
        <svg class="checkout-keep-recovery__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><template v-if="keepRecoveryReadError"><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></template><template v-else><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></template></svg>
        <view class="promotion-grow">
          <text class="checkout-keep-recovery__title">{{ keepRecoveryNotice.title }}</text>
          <text v-if="keepRecoveryProduct">{{ capacityOrderLine(keepRecoveryProduct) }}</text>
          <text>{{ keepRecoveryNotice.note }}</text>
        </view>
      </view>
      <!-- P4: an external payment for this order is under way on this device. The page says so and what not to do; no
           button, and no pointer to the floating bar (it may be closed or show another payment). -->
      <view v-if="externalPaying" class="checkout-paying" role="status" data-testid="checkout-paying">
        <view class="checkout-paying__icon" aria-hidden="true"><NxIcon name="clock" :size="18" /></view>
        <view class="promotion-grow">
          <text class="checkout-paying__title">{{ flowCopy.payingTitle }}</text>
          <text class="checkout-paying__body">{{ flowCopy.payingBody }}</text>
          <view class="checkout-paying__foot">
            <view class="checkout-order-no"><text class="checkout-order-no__label">{{ p.orderNo }}</text><NxCodeValue class="checkout-order-no__code" :value="order!.orderNo" :label="p.orderNo" :copyable="false" /></view>
            <view class="checkout-order-link" role="link" tabindex="0" @click="viewOrder" @keydown.enter.prevent="viewOrder"><text class="nx-after-chevron">{{ p.viewOrder }}</text></view>
          </view>
        </view>
      </view>
      <view v-else-if="unknown" class="promotion-flat" role="status"><text class="promotion-title">{{ session.record.pending?.operation==='payOrder'?p.unknownTitle:p.orderUnknownTitle }}</text><text class="promotion-copy">{{ p.unknownBody }}</text></view>
      <!-- The original order's state line on the page floor, above the products (board CkPend): time left in the warning
           colour (or the state of a closed order), the way to the order, and its number. -->
      <view v-if="order&&!externalPaying" class="checkout-order-status" data-testid="checkout-order-status">
        <view class="checkout-order-status__row">
          <view v-if="order.paymentStatus==='PENDING'" class="checkout-order-status__state checkout-order-status__state--warning" role="status">
            <svg class="checkout-order-status__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><template v-if="payWindow!==true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></template><template v-else><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></template></svg>
            <text>{{ payWindow!==true ? p.unknown : fmt(t.orders.pendingCloseIn,{min:payMinutesLeft ?? '—'}) }}</text>
          </view>
          <text v-else class="checkout-order-status__state">{{ order.paymentStatus==='REFUNDED' ? p.refunded : order.paymentStatus==='CANCELLED' ? p.rewardCancelled : order.paymentStatus==='EXPIRED' ? t.orders.statusExpired : p.unavailable }}</text>
          <view class="checkout-order-link" role="link" tabindex="0" @click="viewOrder" @keydown.enter.prevent="viewOrder"><text class="nx-after-chevron">{{ p.viewOrder }}</text></view>
        </view>
        <view class="checkout-order-no"><text class="checkout-order-no__label">{{ p.orderNo }}</text><NxCodeValue class="checkout-order-no__code" :value="order.orderNo" :label="p.orderNo" :copyable="false" /></view>
      </view>
      <view v-if="error&&!unknown" class="promotion-notice" role="alert"><text>{{ error }}</text><view v-if="activityConflict" class="promotion-link" role="link" tabindex="0" @click="navTo('/pages/events/events')" @keydown.enter.prevent="navTo('/pages/events/events')" @keydown.space.prevent="navTo('/pages/events/events')"><text>{{ p.promotionList }}</text></view><view v-if="!quoteBlock&&!order&&!openedOriginal&&!session.record.pending&&!freshQuoteReady&&!busy" class="promotion-link" role="button" tabindex="0" @click="loadQuote()"><text>{{ t.empty.errorCta }}</text></view></view>
      <!-- Two or more models: one card, 已选 N 款 with the tier tag, and a two-column grid of model tiles (board CkNew):
           device art, name, line price, then 数量 with the stepper, or 数量 N once the order exists. One model keeps the row below. -->
      <view v-if="items.length>1" class="checkout-bundle" role="group" :aria-label="fmt(flowCopy.bundleSelected,{n:items.length})">
        <view class="checkout-bundle__head">
          <text class="checkout-bundle__title" role="heading">{{ fmt(flowCopy.bundleSelected,{n:items.length}) }}</text>
          <NxTag v-if="bundleTierPct!==null" class="checkout-bundle__tag" tone="brand" :label="fmt(flowCopy.bundleTierTag,{n:items.length,pct:bundleTierPct})" />
        </view>
        <view class="checkout-bundle__grid">
          <view v-for="item in items" :key="item.productNo" class="checkout-tile">
            <view class="checkout-tile__art" aria-hidden="true"><image v-if="(item.imageUrl??getProduct(item.productNo)?.imageUrl)&&!brokenImages.includes(item.productNo)" :src="item.imageUrl??getProduct(item.productNo)?.imageUrl" class="checkout-tile__image" mode="aspectFit" @error="brokenImages.push(item.productNo)" /></view>
            <text class="checkout-tile__name">{{ selectedItemName(item) }}</text>
            <CheckoutAmount v-if="displayQuote||order" class="checkout-tile__price" :value="itemSubtotal(item)" currency="USD" />
            <text v-if="order" class="checkout-tile__qty-label checkout-tile__qty-readonly">{{ p.quantity }}<text class="checkout-tile__qty-value">{{ item.quantity }}</text></text>
            <view v-else class="checkout-tile__qty">
              <text class="checkout-tile__qty-label" aria-hidden="true">{{ p.quantity }}</text>
              <view class="checkout-item-quantity checkout-tile__stepper" role="group" :aria-label="selectedItemName(item)+' · '+p.quantity">
                <view class="checkout-item-quantity-button" data-testid="checkout-item-decrease" role="button" :tabindex="canChangeQuantity(item.productNo,-1)?0:-1" :aria-disabled="!canChangeQuantity(item.productNo,-1)" :aria-label="t.uiChrome.decreaseQty" @click="changeQuantity(item.productNo,-1)" @keydown.enter.prevent="changeQuantity(item.productNo,-1,$event)" @keydown.space.prevent="changeQuantity(item.productNo,-1,$event)"><NxIcon name="minus" :size="18" /></view>
                <text class="checkout-item-quantity-value" aria-live="polite">{{ item.quantity }}</text>
                <view class="checkout-item-quantity-button" data-testid="checkout-item-increase" role="button" :tabindex="canChangeQuantity(item.productNo,1)?0:-1" :aria-disabled="!canChangeQuantity(item.productNo,1)" :aria-label="t.uiChrome.increaseQty" @click="changeQuantity(item.productNo,1)" @keydown.enter.prevent="changeQuantity(item.productNo,1,$event)" @keydown.space.prevent="changeQuantity(item.productNo,1,$event)"><NxIcon name="plus" :size="18" /></view>
              </view>
            </view>
          </view>
        </view>
      </view>
      <view v-else-if="items.length" class="checkout-group checkout-products" :aria-label="p.selected">
        <view v-for="item in items" :key="item.productNo" class="promotion-row checkout-product-line">
          <view class="checkout-product-art"><image v-if="item.imageUrl&&!brokenImages.includes(item.productNo)" :src="item.imageUrl" class="promotion-image" mode="aspectFit" aria-hidden="true" @error="brokenImages.push(item.productNo)" /></view>
          <view class="promotion-grow"><text class="checkout-item-name">{{ selectedItemName(item) }}</text>
            <CheckoutAmount v-if="displayQuote||order" class="checkout-line-price" :value="itemSubtotal(item)" currency="USD" />
          </view>
          <view class="checkout-item-quantity-row"><text class="promotion-copy">{{ p.quantity }}</text><view class="checkout-item-quantity" :aria-label="selectedItemName(item)+' · '+p.quantity">
            <view class="checkout-item-quantity-button" data-testid="checkout-item-decrease" role="button" :tabindex="canChangeQuantity(item.productNo,-1)?0:-1" :aria-disabled="!canChangeQuantity(item.productNo,-1)" :aria-label="t.uiChrome.decreaseQty" @click="changeQuantity(item.productNo,-1)" @keydown.enter.prevent="changeQuantity(item.productNo,-1,$event)" @keydown.space.prevent="changeQuantity(item.productNo,-1,$event)"><NxIcon name="minus" :size="20" /></view>
            <text class="checkout-item-quantity-value" aria-live="polite">{{ item.quantity }}</text>
            <view class="checkout-item-quantity-button" data-testid="checkout-item-increase" role="button" :tabindex="canChangeQuantity(item.productNo,1)?0:-1" :aria-disabled="!canChangeQuantity(item.productNo,1)" :aria-label="t.uiChrome.increaseQty" @click="changeQuantity(item.productNo,1)" @keydown.enter.prevent="changeQuantity(item.productNo,1,$event)" @keydown.space.prevent="changeQuantity(item.productNo,1,$event)"><NxIcon name="plus" :size="20" /></view>
          </view></view>
        </view>
      </view>
      <!-- Vouchers and activity rewards keep their own section; the discount amount itself is one row of 核对订单 below. -->
      <view v-if="(displayQuote||order||eventVoucherId)&&(eventVoucherId&&!order&&!openedOriginal&&!session.record.pending||!order&&items.length===1&&!openedOriginal&&!eventVoucherId||rewards.length)" class="checkout-section" data-testid="checkout-discounts">
        <text class="checkout-section-heading">{{ p.discount }}</text>
        <view class="checkout-group">
          <view v-if="eventVoucherId&&!order&&!openedOriginal&&!session.record.pending" class="checkout-discount-row" data-testid="checkout-event-voucher">
            <view class="checkout-discount-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 0 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" /><path d="M14 6v2m0 3v2m0 3v2" /></svg></view>
            <view class="promotion-grow"><text class="checkout-discount-title">{{ p.eventVoucher }}</text><text class="checkout-discount-description">{{ p.eventVoucherTerms }}</text>
              <PromotionAction v-if="eventVoucherStatus==='claimable'" class="promotion-action primary" role="button" tabindex="0" :aria-disabled="busy" @click="claimEventVoucher"><text>{{ p.claimEventVoucher }}</text></PromotionAction>
              <text v-else-if="eventVoucherStatus==='unavailable'" class="promotion-notice">{{ p.eventVoucherUnavailable }}</text>
            </view>
            <text v-if="voucherOnlyDiscount!==undefined" class="checkout-discount-value">{{ formatDiscount(voucherOnlyDiscount) }}</text>
          </view>
          <view v-if="!order&&items.length===1&&!openedOriginal&&!eventVoucherId" class="checkout-discount-row promotion-link checkout-voucher-row" role="button" :tabindex="busy||voucherLoading||session.record.pending?-1:0" :aria-disabled="busy||voucherLoading||!!session.record.pending" @click="chooseVoucher" @keydown.enter.prevent="chooseVoucher" @keydown.space.prevent="chooseVoucher">
            <view class="checkout-discount-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 0 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" /><path d="M14 6v2m0 3v2m0 3v2" /></svg></view>
            <view class="promotion-grow"><text class="checkout-discount-title">{{ p.voucher }}</text><text class="checkout-discount-description">{{ voucherLoading ? p.loading : selectedVoucherName }}</text></view>
            <text v-if="voucherOnlyDiscount!==undefined" class="checkout-discount-value">{{ formatDiscount(voucherOnlyDiscount) }}</text>
            <svg class="checkout-discount-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
          </view>
          <view v-if="rewards.length" class="checkout-rewards">
            <view v-if="compactGift" class="checkout-discount-row checkout-gift-summary" data-testid="checkout-gift-summary" role="button" tabindex="0" :aria-label="p.checkoutGiftTitle+' · '+compactGiftSummary+' · '+p.rulesLink" @click="termsOpen=true" @keydown.enter.prevent="termsOpen=true" @keydown.space.prevent="termsOpen=true">
              <view class="checkout-discount-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" /></svg></view>
              <view class="promotion-grow"><text class="checkout-discount-title">{{ p.checkoutGiftTitle }}</text><text class="checkout-discount-description">{{ compactGiftSummary }} · {{ p.checkoutGiftSettlement }}</text></view>
              <NxTag class="checkout-gift-badge" tone="brand" :label="p.checkoutGiftBadge" />
            </view>
            <view v-else class="checkout-discount-row checkout-rewards-heading">
              <view class="checkout-discount-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" /></svg></view>
              <view class="promotion-grow"><text class="checkout-discount-title">{{ rewardsReleased ? p.rewardCancelled : order ? (order.paymentStatus==='PENDING'?p.locked:p.orderRewards) : p.expected }}</text><text class="checkout-discount-description">{{ rewardsReleased ? reviewCopy.releasedRewards : p.rewardNote }}</text></view>
            </view>
            <RewardRows v-if="!compactGift&&!rewardsReleased" :expected="rewards" :lines="order?.items??displayQuote?.items" />
            <view v-if="!compactGift&&hasRewardTerms" class="promotion-link checkout-reward-terms" role="button" tabindex="0" @click="termsOpen=true" @keydown.enter.prevent="termsOpen=true" @keydown.space.prevent="termsOpen=true"><text>{{ p.rulesLink }}</text></view>
          </view>
        </view>
      </view>
      <view v-if="summary" class="checkout-section" data-testid="checkout-fees">
        <text class="checkout-section-heading">{{ t.store.coReviewOrder }}</text>
        <view class="checkout-group checkout-fees">
          <view class="promotion-summary"><text>{{ p.subtotal }}</text><CheckoutAmount class="checkout-fee-amount" :value="summary.subtotalUsdt" currency="USD" /></view>
          <view class="promotion-summary" data-testid="checkout-total-discount"><text>{{ bundleDiscountOnly ? flowCopy.bundleDiscount : p.discount }}</text><text class="checkout-discount-value">{{ formatDiscount(summary.discountUsdt) }}</text></view>
          <view class="promotion-summary total"><text>{{ p.total }}</text><CheckoutAmount :value="summary.amountUsdt" currency="USD" /></view>
        </view>
        <view v-if="!order&&promotion?.endsAt" class="promotion-row"><NxIcon class="promotion-row__icon" name="clock" :size="18" /><view class="promotion-grow"><text class="promotion-copy">{{ p.deadline }}</text><text class="promotion-copy">{{ displayDeadline(promotion.endsAt,locale.code) }}</text></view></view>
      </view>
      <!-- The wallet card names itself (UVEL 钱包), so it carries no section heading of its own. -->
      <view v-if="displayQuote || order" class="checkout-group checkout-wallet" data-testid="checkout-payment">
        <view class="checkout-wallet-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M16 12h6v4h-6z" /></svg></view>
        <view class="promotion-grow checkout-wallet-details"><text class="checkout-item-name">{{ p.wallet }}</text>
          <view class="checkout-wallet-balance" aria-live="polite" :aria-busy="walletState==='loading'">
            <text class="checkout-wallet-label">{{ t.wallet.usdtBalance }}</text>
            <text v-if="walletState==='ready' || (walletState==='loading' && app.remoteFleetHasSnapshot)" class="checkout-wallet-amount">{{ formatAmount(app.user.usdtBalance) }}</text>
            <text v-else class="checkout-wallet-state">{{ walletState==='loading' ? reviewCopy.walletLoading : '—' }}</text>
          </view>
        </view>
        <view class="checkout-wallet-topup" role="link" tabindex="0" @click="openWalletTopup" @keydown.enter.prevent="openWalletTopup"><text>{{ p.topup }}</text><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></view>
      </view>
      <!-- Notices sit in the bottom tray above its button (trayNotice, 04 §4.0); with no tray they stay on the page. -->
      <text v-if="!footer&&inventoryNotice" class="promotion-notice" role="status" data-testid="checkout-inventory-notice">{{ inventoryNotice }}</text>
      <view v-if="!footer&&displayQuote?.warnings.length" class="promotion-notice"><text v-for="(warning,index) in displayQuote.warnings" :key="index" class="promotion-copy">{{ localized(warning,locale.code) }}</text></view>
    </template>
    <slot v-if="order?.paymentStatus!=='PAID'" name="review-footer" />
    <!-- In-flow clearance for the host's bottom tray (04 §4.0), so the last line scrolls to 16 above it: the tray's own
         height + 38, whatever its rows (a long language wraps the button under the price). With the measured height the
         spacer takes it as is; without it, a lone button 48 + 22 + 16, a one-row tray 64 + 22 + 16, and an invisible copy
         of the note at the note's width and type reserving the lines the note really takes. -->
    <view v-if="footer&&order?.paymentStatus!=='PAID'" class="promotion-tray-space" :class="trayHeight ? 'promotion-tray-space--measured' : { 'promotion-tray-space--note': footer.note||trayNotice, 'promotion-tray-space--float': footer.amountless&&!(footer.note||trayNotice) }" :style="trayHeight ? { height: 'calc(' + trayHeight + 'px - 2px)' } : undefined" aria-hidden="true"><text v-if="!trayHeight&&(footer.note||trayNotice)" class="promotion-tray-space__note">{{ footer.note||trayNotice }}</text></view>
    <NxSheet :open="voucherOpen" :title="p.voucher" @close="voucherOpen=false">
      <view class="checkout-voucher-options" role="group" :aria-label="p.voucher">
        <PromotionAction class="promotion-action" role="button" tabindex="0" :aria-pressed="voucherId===null" @click="selectVoucher(null)" @keydown.enter.prevent="selectVoucher(null)" @keydown.space.prevent="selectVoucher(null)"><text>{{ p.noVoucher }}</text></PromotionAction>
        <PromotionAction v-for="option in voucherOptions" :key="option.def.id" class="promotion-action checkout-voucher-option" role="button" tabindex="0" :aria-pressed="voucherId===option.def.id" @click="selectVoucher(option.def.id)" @keydown.enter.prevent="selectVoucher(option.def.id)" @keydown.space.prevent="selectVoucher(option.def.id)">
          <text class="checkout-item-name">{{ option.def.name }}</text>
          <text class="promotion-copy">{{ fmt(p.voucherSaving,{amount:formatAmount(option.discount)}) }}</text>
          <text class="promotion-copy">{{ voucherCondition(option.def) }}</text>
        </PromotionAction>
      </view>
    </NxSheet>
    <PromotionTerms :open="termsOpen" :title="localized(promotion?.title,locale.code)" :terms="order ? '' : localized(promotion?.terms,locale.code)" :rules="firstPurchaseTermsRules(checkoutFirstPurchaseCondition,locale.code)" :disclosures="disclosures" @close="termsOpen=false" />
  </view>
</template>
<script setup lang="ts">
import { firstPurchaseTermsRules } from '@/lib/promotion-landing';
import NxIcon from "@/components/ui/nx-icon.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import NxCodeValue from "@/components/ui/nx-code-value.vue";
import { landingCopy } from '@/i18n/promotion-landing';
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { hasVisiblePullRefresh } from "@/lib/active-page-refresh";
import { formatGroupedAmount as formatAmount } from "@/lib/amount-display";
import { formatCheckoutReviewAmount } from '@/lib/checkout-review-amount';
import { commerceCopy } from '@/lib/commerce-review';
import PromotionAction from '@/components/promotion/promotion-action.vue';
import NxSheet from '@/components/ui/nx-sheet.vue';
import CheckoutPaymentSheet from '@/components/checkout/CheckoutPaymentSheet.vue';
import CheckoutResult from '@/components/checkout/CheckoutResult.vue';
import CheckoutAmount from '@/components/checkout/CheckoutAmount.vue';
import { computed,inject,ref,shallowRef,watch,onMounted,onBeforeUnmount } from 'vue';
import { capacityOrderLine, capacityRecoveryNotice, checkoutCapacityUnreadableTargetKey, checkoutKeepResumeKey, describeCapacityOriginal, type CheckoutCapacityRecovery, type CheckoutKeepResume } from '@/components/checkout/checkout-keep-resume';
// #ifdef H5
import { onBeforeRouteLeave } from 'vue-router';
// #endif
import { promotionApi,deviceE3Api,purchaseEligibilityApi,purchasePaymentApi,sessionVault } from '@/api/runtime';
import { captureRuntimeRevision,isCurrentRuntimeRevision } from '@/api/order-api';
import type { PublicPromotion,ExpectedReward } from '@/api/promotion-api';
import type { PromotionItem, PromotionOrder } from '@/api/promotion-api';
import { checkoutQuoteBlock, validatePromotionItems, type CheckoutCreateBlock, type CheckoutQuoteBlock } from '@/api/promotion-api';
import type { Quote } from '@/api/promotion-api';
import { useT } from '@/i18n/use-t';import { useLocaleStore } from '@/store/locale';import { useApp } from '@/store/app';import { useAuth } from '@/store/auth';
import { readCapacityPending } from '@/lib/capacity-command-recovery';
import { useTradeinSheet } from '@/store/tradein-sheet';
import type { DeviceKind } from '@/store/types';
import { useVoucher } from '@/store/voucher';
import { useOrders } from '@/store/orders';
import { computeVoucherDiscount,isVoucherValid,voucherAppliesToSku,type VoucherDef } from '@/mock/vouchers';
import { ApiError,asApiError,isApiRefusal } from '@/api/errors';
import { getProduct as readProduct } from '@/mock/products';import { refreshProductCatalog,settleProductCatalogRefresh,productCatalogState,productCatalogPresentation } from '@/store/product-catalog';
import { navTo,navBack,navReplace,navReset } from '@/lib/route';import { confirm,useUI } from '@/store/ui';
import { fmt } from '@/i18n/format';
import { PromotionCheckoutSession,selectPromotionCheckoutRecord,type PromotionCheckoutRecord,PROMOTION_CHECKOUT_TABLE } from '@/lib/promotion-checkout-session';
import { acquireAccountCommandKey,releaseAccountCommandKey,readAccountRow,writeAccountRow } from '@/store/account-scoped-storage';
import { registerCheckoutLeaveGuard } from '@/lib/promotion-leave-guard';
import { readTrustedMonotonicNowMs,projectServerNow } from '@/lib/server-deadline-clock';
import { checkoutQuoteBlockCopy,displayDeadline,localized,rewardSummary } from '@/lib/promotion-display';
import { promotionBundleHref, promotionCheckoutHref, promotionStoreHref, type PromotionDisclosure } from '@/lib/promotion-entry';
import { executeSelectedPurchase } from '@/lib/selected-purchase-payment';
import type { OrderTopupNetwork, OrderUsdtTopupRead } from '@/api/purchase-payment-api';
import { confirmOrderTopupPayment, hasUsdt, orderTopupHref, orderTopupPayable, orderTopupPaymentChanged } from '@/lib/order-usdt-topup';
import { onPurchaseRecordReleased, unfinishedOrderPayment, refusedPurchasePayment, replaceWithOrder } from '@/store/purchase-payment';
import { attributedBundleDiscount } from '@/api/bundle-quote';
import { orderPaymentRejection } from '@/lib/order-payment-rejection';
import { checkoutFlowCopy } from '@/lib/checkout-flow-copy';
import { openOrderAdvisorChat } from '@/lib/advisor-chat-route';
import { commerceOrderIsPaid, commercePaidOrderAmount } from '@/lib/commerce-review';
import { useConversations } from '@/store/conversations';
import RewardRows from './reward-rows.vue';import PromotionTerms from './promotion-terms.vue';
// trayHeight: the host's bottom tray as rendered (the host reads it); until it is read the tray spacer estimates from the footer.
const props=defineProps<{activityId:string;items:PromotionItem[];orderNo?:string;voucherId?:string;upgradeActivityId?:string;fromBundle?:boolean;trayHeight?:number;externalOrderNo?:string;leaveConfirmationOpen?:boolean;topupNetwork?:OrderTopupNetwork}>();
const emit=defineEmits<{
  (event:'cancel-blocked',orderNo:string,summary:string):void;
  (event:'resume-external'):void;
}>();
function formatDiscount(value: Parameters<typeof formatAmount>[0]): string {
  return formatCheckoutReviewAmount(value, 'USD', { discount: true });
}
function getProduct(id:string){void productCatalogState.status;return readProduct(id);}
const t=useT(),p=computed(()=>t.value.promotion),locale=useLocaleStore(),app=useApp(),auth=useAuth(),voucher=useVoucher(),orders=useOrders();
function selectedItemName(item:{productNo:string;productName?:string}){return (item.productName??getProduct(item.productNo)?.name??productCatalogPresentation.value?.products.find(product=>product.id===item.productNo)?.name??p.value.unknown);}
const reviewCopy=computed(()=>commerceCopy(locale.code));
const flowCopy=computed(()=>checkoutFlowCopy(locale.code));
const walletState=ref<'idle'|'loading'|'ready'|'error'>('idle');
useAutoRecovery({ failed: () => walletState.value === "error", retry: () => refreshWallet(true) });
let walletGeneration=0;
let walletTimer:ReturnType<typeof setInterval>|undefined;
let catalogRefresh:Promise<boolean>|null=null;
async function refreshWallet(coalesce=false,background=false){
  if(!current()||!visible.value||!auth.isAuthenticated)return;
  const generation=++walletGeneration;if(!background)walletState.value='loading';
  try{
    // Catalog completion advances the runtime fence. Capture the wallet read
    // afterwards, without delaying original-order or command recovery.
    if(catalogRefresh)await catalogRefresh;
    if(!current()||!visible.value||generation!==walletGeneration)return;
    const ok=await app.refreshRemoteFleet(app.captureRemoteAccountRequest(),{coalesce});
    if(current()&&visible.value&&generation===walletGeneration)walletState.value=ok&&app.remoteFleetHasSnapshot?'ready':'error';
  }catch{if(current()&&visible.value&&generation===walletGeneration)walletState.value='error';}
}
const visible=ref(true);
const account=app.accountKey,epoch=app.accountBindingEpoch;let alive=true,readGeneration=0,refreshOnIdle=false;const current=()=>alive&&app.accountKey===account&&app.accountBindingEpoch===epoch;
const readCurrent=(generation:number)=>current()&&visible.value&&generation===readGeneration;
const recoveryRead=shallowRef<Promise<boolean>|null>(null);
const recoveryReadFailed=ref(false);
const paymentEligibilityReadFailed=ref(false);
const paymentEligibilityRecoveryBusy=ref(false);
let recoveryGeneration:number|null=null;
const TABLE=PROMOTION_CHECKOUT_TABLE;
let storageReadable=true;let records:Record<string,PromotionCheckoutRecord>={};
try{records=readAccountRow<Record<string,PromotionCheckoutRecord>>(TABLE,account,true)??{};}catch{storageReadable=false;}
// A changed route cannot bypass an unresolved command from this same account.
const {intent,record:stored,openedOriginal}=selectPromotionCheckoutRecord(records,props);
const reopenPaidOnEntry=ref(!openedOriginal&&!props.orderNo&&props.items.length>0
  &&stored?.order?.paymentStatus==='PAID'&&!stored.pending);
const session=new PromotionCheckoutSession({api:promotionApi,isExternalPaymentRefused:key=>!!refusedPurchasePayment(account,key),current:()=>current()&&(recoveryGeneration===null||readCurrent(recoveryGeneration)),key:key=>acquireAccountCommandKey('nexgrid-promotion-commands-v1',account,key,'promotion'),releaseKey:(intent,key)=>releaseAccountCommandKey('nexgrid-promotion-commands-v1',account,intent,key),read:()=>readAccountRow<Record<string,PromotionCheckoutRecord>>(TABLE,account,true)?.[intent]??null,save:record=>{if(!storageReadable)throw new Error('STORAGE_UNAVAILABLE');const rows=readAccountRow<Record<string,PromotionCheckoutRecord>>(TABLE,account,true)??{};if(!writeAccountRow(TABLE,account,{...rows,[intent]:record}))throw new Error('STORAGE_UNAVAILABLE');}},stored);
const stopReleaseWatch=onPurchaseRecordReleased((accountKey,key)=>{if(accountKey===account&&current()&&session.releaseExternalPayment(key))revision.value++;});
const quotePresentation=shallowRef<{key:string;quote:Quote}|null>(null);
const freshQuoteReady=ref(false),revision=ref(0),quote=computed(()=>{revision.value;return session.record.pending||session.record.order||(freshQuoteReady.value&&quotePresentation.value?.key===quotePresentationKey())?session.record.quote:null;}),order=computed(()=>{revision.value;return session.record.order;}),unknown=computed(()=>{revision.value;return session.unknown;});
// Display memory never enters the executable session; refresh still invalidates that quote.
const displayQuote=computed(()=>current()&&visible.value&&auth.isAuthenticated ? quote.value??(quotePresentation.value?.key===quotePresentationKey()?quotePresentation.value.quote:null):null);
function quotePresentationKey(){return JSON.stringify([app.accountKey,app.accountBindingEpoch,auth.isAuthenticated,props.activityId,selection.value,eventVoucherId,props.upgradeActivityId??'',manualVoucher()?['manual',voucherId.value]:['auto'],locale.code]);}
const resultState=ref<'activated'|'inventory'|'processing'|'error'|'failed'>('processing'),resultError=ref(''),resultReading=ref(false);
// 再买一单 waits for a confirmed result as well as the finished presentation.
const resultSettled=computed(()=>resultState.value==='activated'||resultState.value==='inventory'||resultState.value==='failed');
const resultAmount = computed(() => {
  const receipt = order.value;
  if (receipt?.paymentStatus !== 'PAID') return undefined;
  const canonical = orders.visibleOrders.find(row => row.id === receipt.orderNo);
  if (canonical && commerceOrderIsPaid(canonical)) return commercePaidOrderAmount(canonical);
  return {
    value: receipt.paidTotalUsdt ?? receipt.amountUsdt,
    currency: receipt.paymentMethod === 'HDPAY_BANK' ? 'USD' as const : 'USDT' as const,
  };
});
// The order top-up path pays the exact amount due from the wallet, while paidTotalUsdt is two places by contract (B18):
// its result shows the amount the user confirmed and authorized, every digit (contract-b84 paidAmountUsdt). Display only.
const topupPaid=ref<{orderNo:string;amount:string}|null>(null);
const resultExactAmount=computed(()=>topupPaid.value&&topupPaid.value.orderNo===order.value?.orderNo?topupPaid.value.amount:undefined);
let resultGeneration=0;
watch(()=>order.value?.orderNo,()=>{
  resultGeneration++;resultReading.value=false;resultState.value='processing';resultError.value='';
  paymentEligibilityReadFailed.value=false;
},{flush:'sync'});
const receiptQuote=computed(()=>order.value?.promotionQuoteId===quote.value?.quoteId?quote.value:null);
const summary=computed(()=>order.value?{
  subtotalUsdt:order.value.subtotalUsdt??receiptQuote.value?.subtotalUsdt,
  discountUsdt:order.value.discountUsdt??receiptQuote.value?.discountUsdt,
  amountUsdt:order.value.amountUsdt,
}:displayQuote.value);
function itemSubtotal(item:{productNo:string;quantity:number;subtotalUsdt?:string}) {
  if(item.subtotalUsdt!==undefined)return item.subtotalUsdt;
  return (order.value?receiptQuote.value:displayQuote.value)?.items.find(line=>line.productNo===item.productNo&&line.quantity===item.quantity)?.subtotalUsdt;
}
const promotion=shallowRef<PublicPromotion|null>(null),loading=ref(true),writeBusy=ref(false),error=ref(''),activityConflict=ref(false),termsOpen=ref(false);
const quoteRead=ref<number|null>(null);
const busy=computed(()=>writeBusy.value||quoteRead.value!==null);
const createBlock=ref<CheckoutCreateBlock|null>(null);
const quoteBlock=ref<CheckoutQuoteBlock|null>(null);
const paymentSheetOpen=ref(false),paymentConfirming=ref(false),leaving=ref(false);
const paymentEntryChecking=ref(false);
const eventVoucherId=props.voucherId?.trim()??'';
const ordinaryMultiItemEntry = !openedOriginal && !props.orderNo && !props.activityId && !eventVoucherId
  && props.items.reduce((quantity, item) => quantity + item.quantity, 0) > 1;
const eventVoucherStatus=ref<'loading'|'claimable'|'available'|'unavailable'>('loading');
const voucherId=ref(session.record.voucherId??(openedOriginal?null:eventVoucherId||null));const selectedVoucherName=computed(()=>voucher.catalog.find(v=>v.id===voucherId.value)?.name??p.value.noVoucher);
// The API has no voucher-specific amount. Attribute the total to the selected
// voucher only when this quote explicitly reports zero promotion discount.
const voucherOnlyDiscount=computed(()=>!order.value&&!openedOriginal&&!!voucherId.value&&session.record.voucherId===voucherId.value
  &&items.value.length===1&&!(eventVoucherId&&session.record.pending)
  &&displayQuote.value?.promotionDiscountUsdt!==undefined&&formatAmount(displayQuote.value.promotionDiscountUsdt)==='0.00'
  ?displayQuote.value.discountUsdt:undefined);
const voucherOpen=ref(false),voucherLoading=ref(false);
const manualVoucher=()=>session.record.voucherMode==='manual'||(session.record.voucherMode===undefined&&session.record.voucherId!==undefined);
function eligibleVouchers(subtotal:number) {
  if(selection.value.length!==1||!Number.isFinite(subtotal))return [];
  return voucher.claimedUnused.filter(def=>isVoucherValid(def)&&voucherAppliesToSku(def,selection.value[0].productNo))
    .map(def=>({def,discount:computeVoucherDiscount(def,subtotal)})).filter(option=>option.discount>0);
}
const voucherOptions=computed(()=>eligibleVouchers(Number(quote.value?.subtotalUsdt)));
function voucherCondition(def:VoucherDef):string {
  const scope=def.applicableSkus.length?def.applicableSkus.map(id=>selectedItemName({productNo:id})).join(' / '):p.value.voucherAllProducts;
  return [scope,fmt(p.value.voucherMinimum,{amount:formatAmount(def.minPurchaseUSD??0)}),def.endAt?p.value.deadline+' · '+displayDeadline(new Date(def.endAt).toISOString(),locale.code):''].filter(Boolean).join(' · ');
}
const selection=ref(props.items.map(({productNo,quantity})=>({productNo,quantity})));
// A product image that fails to load is dropped, so its art column collapses like the single-item card's.
const brokenImages=ref<string[]>([]);
const tradein=useTradeinSheet();
const keepRecovery=shallowRef<CheckoutCapacityRecovery|null>(null);
const keepRecoveryTarget=computed(() => keepRecovery.value?.target ?? null);
const capacityUnreadableTarget = inject(checkoutCapacityUnreadableTargetKey, null);
const keepRecoveryReadError=computed(() => keepRecovery.value?.commandKey === null || (
  keepRecoveryTarget.value !== null && keepRecoveryTarget.value === capacityUnreadableTarget?.value
));
const keepRecoveryOperation=computed(() => keepRecovery.value?.operation ?? null);
const keepRecoveryProduct = computed(() => {
  const original = keepRecovery.value;
  return current() && original?.operation && !keepRecoveryReadError.value
    ? { productName: original.productName, payableUsdt: original.payableUsdt }
    : null;
});
const resolvingOriginalCapacity=computed(() => loading.value && !props.orderNo && !session.record.order && !session.record.pending);
const checkoutKeepResume = inject(checkoutKeepResumeKey, null);
const keepResumeAllowed = computed(() => {
  const resume = checkoutKeepResume?.value;
  const recovery = keepRecovery.value;
  return !!resume && current() && visible.value && auth.isAuthenticated
    && resume.target === recovery?.target && resume.commandKey === recovery.commandKey && resume.operation === recovery.operation;
});
const keepRecoveryNotice = computed(() => capacityRecoveryNotice(t.value, keepRecoveryReadError.value, keepRecoveryOperation.value, keepResumeAllowed.value));
function openKeepResume(): boolean {
  const resume = checkoutKeepResume?.value;
  if (!resume || !keepResumeAllowed.value || tradein.state.kind === 'keep-recovery') return false;
  return resume.kind === 'intent' ? resume.open() : recoverKeepBeforeNewPurchase(true, resume);
}
function recoverKeepBeforeNewPurchase(reopen=false, resume?: CheckoutKeepResume):boolean {
  // Original orders and commands always recover before any new purchase gate.
  if(props.orderNo||session.record.order||session.record.pending)return false;
  // Keep the current owner until the synchronous recheck determines the next one.
  for(const {productNo} of selection.value){
    if (resume && productNo !== resume.target) continue;
    let recovery: CheckoutCapacityRecovery = { target: productNo, commandKey: null, operation: null };
    try{
      const pending=readCapacityPending(account, productNo);
      if(!pending)continue;
      if (resume && (pending.operation !== resume.operation || pending.key !== resume.commandKey)) return false;
      if(refusedPurchasePayment(account,pending.key)){
        if (resume) return false;
        if(!reopen||!pending.quote)continue;
        keepRecovery.value = null;
        tradein.showCanonicalReplace(productNo as DeviceKind,pending.quote.payableUsdt,pending.quote);
        return true;
      }
      recovery = { ...describeCapacityOriginal(pending, t.value), commandKey: pending.key, operation: pending.operation };
    }
    catch{if (resume) return false;}
    keepRecovery.value=recovery;
    freshQuoteReady.value=false;quoteFresh.value=false;quotePresentation.value=null;
    if(resume)tradein.showKeepRecovery(productNo as DeviceKind);
    return true;
  }
  if (!resume) keepRecovery.value = null;
  return false;
}
function resumeAfterCapacityRecovery(target: string) {
  if (!current() || !visible.value || keepRecoveryTarget.value !== target) return;
  keepRecovery.value = null;
  if (tradein.state.kind === 'keep-recovery' && tradein.state.targetKind === target) tradein.hide();
  void loadQuote();
}
const rewardsReleased=computed(()=>!!order.value&&['CANCELLED','EXPIRED','REFUNDED'].includes(order.value.paymentStatus));
const items=computed<Array<{productNo:string;quantity:number;productName?:string;imageUrl?:string|null;subtotalUsdt?:string}>>(()=>order.value?.items??displayQuote.value?.items??selection.value);const rewards=computed(()=>order.value?.rewards??displayQuote.value?.expectedRewards??[]);
// Match the published device FAQ's scope in store/detail; do not extend it to SHARE.
const hasDevicePolicy=computed(()=>items.value.some(item=>{const product=getProduct(item.productNo);return !!product&&product.productType!=='SHARE';}));
function canChangeQuantity(productNo:string,delta:-1|1):boolean {
  const item=selection.value.find(item=>item.productNo===productNo);
  const product=getProduct(productNo);
  const stock=product?.inventoryMode==='FINITE'?product.stock:null;
  return current()&&visible.value&&auth.isAuthenticated&&!loading.value&&!busy.value
    &&!openedOriginal&&!props.orderNo&&!session.record.pending&&!order.value&&!unknown.value
    &&!!item&&item.quantity+delta>=1&&selection.value.reduce((sum,item)=>sum+item.quantity,0)+delta<=100
    &&(delta<0||stock==null||item.quantity+delta<=stock);
}
async function changeQuantity(productNo:string,delta:-1|1,event?:KeyboardEvent):Promise<void> {
  if(event?.repeat||!canChangeQuantity(productNo,delta))return;
  const next=selection.value.map(item=>item.productNo===productNo?{...item,quantity:item.quantity+delta}:item);
  validatePromotionItems(next);
  quoteBlock.value=null;
  selection.value=next;
  await loadQuote();
}
function disclosure(reward: ExpectedReward): PromotionDisclosure | null {
  const d = reward.disclosure;
  const complete = d && [d.title,d.terms,d.refundTerms,d.benefitDescription].every(
    text => text && (['zh','en','vi'] as const).every(lang => typeof text[lang] === 'string' && text[lang].trim()),
  );
  return complete ? { ...d, role: reward.beneficiaryRole } : null;
}
const disclosures=computed(()=>rewards.value.map(disclosure).filter((d):d is PromotionDisclosure=>!!d));const completeTerms=computed(()=>disclosures.value.length===rewards.value.length);
const checkoutFirstPurchaseCondition=computed(()=>{
  const activity=promotion.value;
  const reward=order.value?.rewards?.[0];
  const activityId=order.value?reward?.activityId:quote.value?.activityId;
  const version=order.value?reward?.version:quote.value?.activityVersion;
  if(activity && activity.activityId===activityId && activity.version===version)
    return activity.firstPurchaseCondition;
});
const hasRewardTerms=computed(()=>auth.isAuthenticated&&!loading.value&&disclosures.value.length>0);
// The compact gift row is only for a simple, eligible buyer gift before order
// creation. Multiple rewards, inviter benefits and receipt states keep their
// full breakdown; a short summary must never hide a condition or cancellation.
const compactGift=computed(()=>{
  const reward=rewards.value[0];
  return !order.value&&items.value.length===1&&rewards.value.length===1&&completeTerms.value&&hasRewardTerms.value
    &&reward.eligibility==='ELIGIBLE'&&!reward.message&&reward.beneficiaryRole==='BUYER'
    &&reward.reward.beneficiaryRole==='BUYER'&&reward.reward.type==='DEVICE' ? reward : null;
});
const compactGiftSummary=computed(()=>compactGift.value?rewardSummary(compactGift.value.reward,p.value,compactGift.value.disclosure.deviceName,compactGift.value.groups):'');
let receivedAt:number|null=null,promotionReceivedAt:number|null=null,orderClock:{serverNow:number;at:number}|null=null,clockGeneration=0;const quoteFresh=ref(false),payWindow=ref<boolean|null>(null),payMinutesLeft=ref<number|null>(null);let timer:ReturnType<typeof setInterval>|undefined;
watch(quotePresentationKey,()=>{
  quotePresentation.value=null;freshQuoteReady.value=false;receivedAt=null;quoteFresh.value=false;readGeneration++;
},{flush:'sync'});
watch(()=>locale.code,()=>{
  if(quoteBlock.value||!visible.value||!current()||openedOriginal||props.orderNo||session.record.pending||session.record.order||!auth.isAuthenticated)return;
  if(busy.value)refreshOnIdle=true;else void loadQuote();
},{flush:'post'});
function updateClock(){
  const now=readTrustedMonotonicNowMs();quoteFresh.value=!!quote.value&&receivedAt!==null&&now!==null&&projectServerNow(Date.parse(quote.value.serverTime),receivedAt,now)<Date.parse(quote.value.expiresAt);
  const sample=receivedAt!==null&&quote.value?{serverNow:Date.parse(quote.value.serverTime),at:receivedAt}:promotionReceivedAt!==null&&promotion.value?{serverNow:Date.parse(promotion.value.serverTime),at:promotionReceivedAt}:orderClock;
  const deadline=Date.parse(order.value?.payBy??'');
  payWindow.value=order.value?.paymentStatus==='PENDING'&&now!==null&&sample&&Number.isFinite(deadline)?projectServerNow(sample.serverNow,sample.at,now)<deadline:null;
  // Display only, for the state line's 剩 N 分钟自动关闭: minutes left on the same trusted projection as payWindow.
  payMinutesLeft.value=payWindow.value===true&&now!==null&&sample?Math.max(1,Math.ceil((deadline-projectServerNow(sample.serverNow,sample.at,now))/60000)):null;
}
async function loadOrderClock(){
  updateClock();if(!current()||order.value?.paymentStatus!=='PENDING'||payWindow.value!==null)return;
  const generation=++clockGeneration,read=readGeneration,sampledAt=readTrustedMonotonicNowMs();if(sampledAt===null)return;
  // Persisted quotes have no live monotonic anchor; an empty fleet still carries validated server time.
  const fleet=await deviceE3Api.fleet();if(!readCurrent(read)||generation!==clockGeneration)return;
  orderClock={serverNow:fleet.serverNow,at:sampledAt};updateClock();
}
watch(()=>productCatalogState.status,status=>{
  if(status==='error'&&current()&&visible.value&&freshQuoteReady.value&&!order.value&&!openedOriginal&&!session.record.pending&&!quoteBlock.value){
    quoteBlock.value='unavailable';
  }
});
const canCreate=computed(()=>current()&&visible.value&&auth.isAuthenticated&&!busy.value&&!createBlock.value&&!quoteBlock.value&&(session.retryOriginal||productCatalogState.status==='ready')&&!unknown.value&&!keepRecoveryTarget.value&&completeTerms.value&&(quoteFresh.value||session.retryOriginal)&&quote.value?.eligibility==='ELIGIBLE'&&session.canExecute(quote.value.items.length>1?'createBundle':'createOrder'));
const canPay=computed(()=>!busy.value&&!recoveryRead.value&&!recoveryReadFailed.value&&!paymentEligibilityRecoveryBusy.value&&!externalPaying.value&&!unknown.value&&completeTerms.value&&session.confirmed&&order.value?.paymentStatus==='PENDING'&&payWindow.value===true&&session.canExecute('payOrder'));
const canCancel=computed(()=>{revision.value;return !busy.value&&!unknown.value&&session.confirmed&&order.value?.paymentStatus==='PENDING'
  &&order.value.orderNo!==props.externalOrderNo&&session.canExecute('cancelOrder');});
const canStartNew=computed(()=>{revision.value;return !busy.value&&!unknown.value&&session.confirmed&&!session.record.pending&&!!order.value&&['PAID','CANCELLED','EXPIRED','REFUNDED'].includes(order.value.paymentStatus);});
function showOperationError(cause:unknown){
  const rejection=orderPaymentRejection(cause,locale.code);
  if(rejection)error.value=rejection;
  else{const message=asApiError(cause).message;activityConflict.value=message==='PROMOTION_EXCLUSIVE_ACTIVITY_CONFLICT';error.value=activityConflict.value?p.value.activityConflictNote:message==='PROMOTION_NOT_ELIGIBLE_OR_UNAVAILABLE'?p.value.disabledNote:message.includes('CAPACITY_UNAVAILABLE')?p.value.capacityUnavailable:message==='PROMOTION_ACCOUNT_UNAVAILABLE'?p.value.accountUnavailable:message.includes('QUOTE_EXPIRED')||message.includes('QUOTE_INPUT_CHANGED')?p.value.quoteExpired:message.includes('INSUFFICIENT')?p.value.balanceInsufficient:p.value.errorNote;}
}
async function run(action:()=>Promise<void>){
  if(busy.value||!current())return;
  writeBusy.value=true;error.value='';activityConflict.value=false;
  try{await action();}catch(cause){if(current())showOperationError(cause);}
  finally{if(current()){writeBusy.value=false;revision.value++;updateClock();}}
}
let foregroundQuoteAt = -Infinity;
function readCheckoutPromotion(activityId:string,generation:number,orderVersion?:number){
  const sampledAt=readTrustedMonotonicNowMs();
  void promotionApi.get(activityId,auth.isAuthenticated).then(value=>{
    if(!readCurrent(generation)||value.activityId!==activityId)return;
    const matches=orderVersion===undefined?value.state==='ACTIVE':value.version===orderVersion;
    promotion.value=matches?value:null;
    if(orderVersion===undefined){promotionReceivedAt=sampledAt;updateClock();}
  }).catch(()=>{});
}
async function loadQuote(recheckCapacity=false,foreground=false){
  const block=quoteBlock.value;
  if(block&&block!=='unavailable'&&!(recheckCapacity&&block==='capacity'))return;
  if(busy.value||!visible.value||!current()||openedOriginal||props.orderNo||session.record.pending||session.record.order||!auth.isAuthenticated)return;
  if(foreground&&createBlock.value)return;
  if(!foreground&&recoverKeepBeforeNewPurchase())return;
  createBlock.value=null;
  if(foreground)foregroundQuoteAt=Date.now();
  // A failed later read invalidates the successful catalog promise saved at mount.
  if(productCatalogState.status==='error')catalogRefresh=null;
  const generation=++readGeneration,inputKey=quotePresentationKey();
  quoteRead.value=generation;error.value='';activityConflict.value=false;
  if(quotePresentation.value?.key!==inputKey){quotePresentation.value=null;promotion.value=null;}
  if(!foreground){voucherOpen.value=false;freshQuoteReady.value=false;promotionReceivedAt=null;termsOpen.value=false;receivedAt=null;quoteFresh.value=false;}
  try{
    if(!foreground){
      try{session.invalidateQuote();revision.value++;}catch(cause){quotePresentation.value=null;throw cause;}
      // Publishing the catalog invalidates voucher reads. Quote only after this
      // checkout's catalog refresh has finished, as with its wallet read.
      catalogRefresh??=refreshProductCatalog(true);
      const catalogReady=await settleProductCatalogRefresh(catalogRefresh,{requireFresh:true});
      if(!readCurrent(generation))return;
      if(!catalogReady){
        catalogRefresh=null;quotePresentation.value=null;promotion.value=null;quoteBlock.value='unavailable';
        return;
      }
    }
    const sampledAt=readTrustedMonotonicNowMs();
    if(!foreground&&props.activityId)readCheckoutPromotion(props.activityId,generation);
    try{
      const requestedItems=selection.value.map(item=>({...item}));
      let result:Quote;
      let selectedId:string|null=voucherId.value;
      let activityId=props.activityId||null;
      if(!foreground&&eventVoucherId){
        eventVoucherStatus.value='loading';
        const refreshed=await voucher.refreshRemote();if(!readCurrent(generation))return;
        if(!refreshed)throw new Error('VOUCHER_STATE_UNAVAILABLE');
        const available=voucher.claimedUnused.some(offer=>offer.id===eventVoucherId);
        const claimable=voucher.claimableVouchers.some(offer=>offer.id===eventVoucherId&&(!offer.claimSurfaces.length||offer.claimSurfaces.includes('store')));
        eventVoucherStatus.value=requestedItems.length!==1?'unavailable':available?'available':claimable?'claimable':'unavailable';
        if(eventVoucherStatus.value!=='available'){quotePresentation.value=null;promotion.value=null;return;}
        voucherId.value=eventVoucherId;activityId=null;
        if(props.upgradeActivityId){
          const candidate=await promotionApi.get(props.upgradeActivityId,true);if(!readCurrent(generation))return;
          if(candidate.state==='ACTIVE'&&candidate.eligibility==='ESTIMATE_ELIGIBLE'&&candidate.productNos.includes(requestedItems[0].productNo)){
            activityId=candidate.activityId;promotion.value=candidate;promotionReceivedAt=sampledAt;
          }
        }
      }
      if(foreground){
        const previous=session.record.quote;
        const selectedActivity=previous?.activityId??(eventVoucherId?promotion.value?.activityId??null:activityId);
        result=await promotionApi.quote(requestedItems,selectedActivity,selectedId,!eventVoucherId);
      }else if(eventVoucherId){
        result=await promotionApi.quote(requestedItems,activityId,voucherId.value,false);
        selectedId=eventVoucherId;
      }else{
        result=await promotionApi.quote(requestedItems,props.activityId||null,manualVoucher()?voucherId.value:null);
        if(!readCurrent(generation))return;
        selectedId=manualVoucher()?voucherId.value:null;
        if(!manualVoucher()&&requestedItems.length===1){
          if(!await voucher.refreshRemote())throw new Error('VOUCHER_CATALOG_UNAVAILABLE');
          if(!readCurrent(generation))return;
          for(const option of eligibleVouchers(Number(result.subtotalUsdt))){
            try{
              const candidate=await promotionApi.quote(requestedItems,props.activityId||null,option.def.id);
              if(!readCurrent(generation))return;
              if(candidate.eligibility==='ELIGIBLE'&&(result.eligibility!=='ELIGIBLE'||Number(candidate.amountUsdt)<Number(result.amountUsdt))){
                result=candidate;selectedId=option.def.id;
              }
            }catch(cause){
              if(!readCurrent(generation))return;
              // A rejected coupon can be skipped; an unavailable quote cannot be charged.
              if(!isApiRefusal(cause,409,'VOUCHER_NOT_AVAILABLE_OR_NOT_APPLICABLE','VOUCHER_MIN_PURCHASE_NOT_MET',
                'VOUCHER_TYPE_UNSUPPORTED','VOUCHER_DISCOUNT_ZERO'))throw cause;
            }
          }
        }
      }
      if(!readCurrent(generation)||inputKey!==quotePresentationKey())return;
      if(result.items.length!==requestedItems.length||requestedItems.some(item=>!result.items.some(line=>line.productNo===item.productNo&&line.quantity===item.quantity)))throw new Error('QUOTE_INPUT_CHANGED');
      voucherId.value=selectedId;
      quoteBlock.value=null;
      session.setQuote(result,selectedId);quotePresentation.value={key:quotePresentationKey(),quote:result};freshQuoteReady.value=true;receivedAt=sampledAt;revision.value++;updateClock();
    }catch(cause){
      if(!readCurrent(generation))return;
      if(!(cause instanceof ApiError&&cause.kind==='network')){quotePresentation.value=null;promotion.value=null;}
      quoteBlock.value=checkoutQuoteBlock(cause);
      if(quoteBlock.value){if(foreground){freshQuoteReady.value=false;quoteFresh.value=false;}return;}
      throw cause;
    }
  }catch(cause){
    if(readCurrent(generation))showOperationError(cause);
  }finally{
    if(quoteRead.value===generation)quoteRead.value=null;
  }
}
useAutoRecovery({
  active:()=>visible.value&&current()&&auth.isAuthenticated,
  failed:()=>quoteBlock.value==='unavailable',
  retry:loadQuote,
  repeatMs:30_000,
  quiet:false,
});
async function claimEventVoucher(){
  if(!eventVoucherId||eventVoucherStatus.value!=='claimable'||busy.value||!visible.value||!current()||openedOriginal||session.record.pending||order.value)return;
  const generation=readGeneration;
  let claimed=false;
  await run(async()=>{claimed=await voucher.claimRemote(eventVoucherId,'store');if(!claimed&&readCurrent(generation))throw new Error('VOUCHER_CLAIM_FAILED');});
  // A repeated claim receipt is idempotent; only a fresh voucher-state read can authorize use.
  if((claimed||voucher.remoteStatus==='ready')&&readCurrent(generation))await loadQuote();
}
async function chooseVoucher(){
  if(eventVoucherId||openedOriginal||props.orderNo||busy.value||voucherLoading.value||session.record.pending||order.value||items.value.length!==1)return;
  const generation=readGeneration;
  const selectable=()=>readCurrent(generation)&&!busy.value&&!session.record.pending&&!order.value;
  voucherLoading.value=true;
  try{
    if(!await voucher.refreshRemote()){if(selectable())error.value=p.value.errorNote;return;}
    if(selectable())voucherOpen.value=true;
  }finally{voucherLoading.value=false;}
}
async function selectVoucher(id:string|null){
  if(!voucherOpen.value||!current()||!visible.value||openedOriginal||props.orderNo||busy.value||session.record.pending||order.value||unknown.value)return;
  if(id!==null&&!voucherOptions.value.some(option=>option.def.id===id))return;
  try{session.selectVoucher(id);}catch{error.value=p.value.errorNote;return;}
  if(voucherId.value!==id)quoteBlock.value=null;
  voucherId.value=id;voucherOpen.value=false;await loadQuote();
}
const inventoryNotice = computed(() => {
  const quote = displayQuote.value;
  if (!quote || order.value || openedOriginal || session.record.pending || unknown.value) return "";
  const slots = quote.assignableSlots ?? (app.remoteSlotsUsed === null ? null : Math.max(0, app.slotCap - app.remoteSlotsUsed));
  const quantity = quote.inventoryQuantity ?? (slots === null ? 0 : Math.max(0, quote.quantity - slots));
  if (quantity === 0) return "";
  return slots === 0 ? t.value.tradein.fullSlotsInventoryNotice
    : fmt(t.value.tradein.partialSlotsInventoryNotice, { count: quantity });
});
async function createOrder(){
  if(!current()||!visible.value||leaving.value||recoverKeepBeforeNewPurchase(true)||!canCreate.value)return;
  let orderRequested=false;
  await run(async()=>{
    createBlock.value=await session.create();
    orderRequested=true;
  });
  if(orderRequested&&canPay.value&&current()&&visible.value){paymentSheetOpen.value=true;void confirmPayment();}
}
const paymentDialogOwner=`promotion-payment:${Date.now()}:${Math.random()}`;
// Photo signatures can renew while payment terms stay the same.
function orderItemSignature(items:PromotionOrder['items']){return JSON.stringify(items?.map(({imageUrl,...line})=>line));}
function paymentEntryFence(expected:PromotionOrder):()=>boolean {
  const generation=readGeneration,runtime=captureRuntimeRevision(),sessionRevision=sessionVault.revision();
  const signature=JSON.stringify([expected.orderNo,expected.amountUsdt,expected.payBy,orderItemSignature(expected.items)]);
  return ()=>readCurrent(generation)&&auth.isAuthenticated&&isCurrentRuntimeRevision(runtime)
    &&(sessionVault.revision()===sessionRevision||sessionVault.isRefreshContinuation(sessionRevision))
    &&session.confirmed&&!session.unknown&&order.value?.paymentStatus==='PENDING'
    &&JSON.stringify([order.value.orderNo,order.value.amountUsdt,order.value.payBy,orderItemSignature(order.value.items)])===signature;
}
async function checkPaymentEligibility(expected:PromotionOrder,entryCurrent:()=>boolean){
  const productNos=[...new Set((expected.items??[]).map(item=>item.productNo))];
  const results=await Promise.allSettled(productNos.map(productNo=>purchaseEligibilityApi.get(productNo)));
  updateClock();if(!entryCurrent()||payWindow.value!==true)return;
  const blocks=results.map(item=>item.status==='rejected'
    ?checkoutQuoteBlock(item.reason,'eligibility')
    :item.value.eligible?null:checkoutQuoteBlock(item.value.decisionCode,'eligibility'));
  const reason=blocks.find(block=>block&&block!=='unavailable')??null;
  const rejected=results.some(item=>item.status==='rejected');
  const blocked=reason?checkoutQuoteBlockCopy(reason,t.value)
    :!rejected&&results.some(item=>item.status==='fulfilled'&&!item.value.eligible)?t.value.store.gateBlockedToast:'';
  paymentEligibilityReadFailed.value=!blocked&&blocks.includes('unavailable');
  if(blocked||rejected)error.value=blocked||t.value.store.purchaseEligibilityError;
  else if(error.value===t.value.store.purchaseEligibilityError)error.value='';
  return {ready:!blocked&&!rejected,blocked};
}
async function pay(){
  if(order.value?.paymentStatus==='PENDING'&&order.value.orderNo===props.externalOrderNo){
    emit('resume-external');return;
  }
  updateClock();if(paymentEntryChecking.value||paymentConfirming.value||leaving.value||!visible.value||!current()||!canPay.value)return;
  const network=props.topupNetwork;
  if(session.externalPaymentRefused){
    if(network)return;
    paymentSheetOpen.value=true;
    void confirmPayment();
    return;
  }
  paymentEntryChecking.value=true;
  const generation=readGeneration;
  const stillChecking=()=>readCurrent(generation)&&!props.leaveConfirmationOpen&&!leaving.value&&!nativeBackApproved;
  try{
    // Keep the original order amount. A current quote is not current purchase
    // permission: all original lines need fresh overall server decisions.
    const recovered=await recover();
    if(!stillChecking())return;
    if(recoveryReadFailed.value)error.value=flowCopy.value.queryFailed;
    if(!recovered||!canPay.value)return;
    const expectedOrder=order.value;
    if(!expectedOrder)return;
    const originalCurrent=paymentEntryFence(expectedOrder);
    const entryCurrent=()=>stillChecking()&&originalCurrent();
    error.value='';activityConflict.value=false;
    let facts:OrderUsdtTopupRead|undefined;
    if(network){
      if(expectedOrder.orderNo!==props.orderNo||!expectedOrder.promotionQuoteId)return;
      try{facts=await purchasePaymentApi.orderTopup(expectedOrder.orderNo,network);}
      catch{if(entryCurrent())error.value=flowCopy.value.queryFailed;return;}
      if(!entryCurrent())return;
      if(!orderTopupPayable(facts)||hasUsdt(facts.shortfallUsdt)){
        if(facts.state==='PAID')await recover();
        else await navTo(orderTopupHref(expectedOrder.orderNo,network,expectedOrder.items?.map(item=>item.productName).join(', ')??''));
        return;
      }
    }
    const result=await checkPaymentEligibility(expectedOrder,entryCurrent);
    if(!entryCurrent())return;
    if(result?.ready&&canPay.value){
      if(facts&&(!await confirmOrderTopupPayment(facts.amountDueUsdt,paymentDialogOwner)||!entryCurrent()))return;
      paymentSheetOpen.value=true;void confirmPayment(facts);
    }
    else if(result?.blocked&&canCancel.value){
      const cancel=await confirm({title:flowCopy.value.cannotPay,message:result.blocked,confirmLabel:p.value.cancelOrder,cancelLabel:p.value.keep,owner:paymentDialogOwner});
      if(cancel&&entryCurrent())await cancelOrder();
    }
  }catch(cause){if(stillChecking())showOperationError(cause);}
  finally{paymentEntryChecking.value=false;}
}
async function confirmPayment(topup?:OrderUsdtTopupRead){
  updateClock();if(!paymentSheetOpen.value||paymentConfirming.value||leaving.value||!visible.value||!current()||!canPay.value)return;
  const expectedOrder=order.value,generation=readGeneration,runtime=captureRuntimeRevision(),sessionRevision=sessionVault.revision();
  if(!expectedOrder)return;
  const {orderNo,amountUsdt}=expectedOrder;
  if(amountUsdt===undefined||!Number.isFinite(Number(amountUsdt)))return;
  const lines=orderItemSignature(expectedOrder.items),payBy=expectedOrder.payBy;
  const paymentCurrent=()=>readCurrent(generation)&&auth.isAuthenticated&&isCurrentRuntimeRevision(runtime)
    &&(sessionVault.revision()===sessionRevision||sessionVault.isRefreshContinuation(sessionRevision))
    &&order.value?.orderNo===orderNo&&order.value?.amountUsdt===amountUsdt&&orderItemSignature(order.value?.items)===lines&&order.value?.payBy===payBy
    &&order.value?.paymentStatus==='PENDING'&&payWindow.value===true&&!session.unknown&&(!topup||orderTopupPayable(topup));
  paymentConfirming.value=true;paymentSheetOpen.value=false;
  let rejection='',paymentDestination='',paymentReplace=false,topupChanged=false;paymentLeaveApproved=false;
  try{
    await run(async()=>{
      await executeSelectedPurchase({amount:topup?.amountDueUsdt??amountUsdt,currency:'USDT',summary:expectedOrder.items?.map(item=>item.productName).join(', ')||t.value.store.coConfirmPurchase,precision:topup?'full':undefined,
        details:expectedOrder.items?.map(item=>({name:item.productName,quantity:item.quantity}))},
        async authorization=>{
          try{
            updateClock();if(!paymentCurrent())return;
            // Set before the command: a lost response confirmed later through the original key shows the same exact amount.
            topupPaid.value=topup?{orderNo,amount:topup.amountDueUsdt}:null;
            await session.pay(authorization);
          }
          catch(cause){
            const failure=asApiError(cause);
            // The server answers a refusal with its code as the HTTP status; only a recorded outcome then decides the page.
            const refused=failure.kind==='business'||failure.kind==='http'&&failure.status===failure.code&&failure.status!<500;
            if(refused&&!failure.message.startsWith('PAYMENT_PASSWORD_'))rejection=failure.message;
            topupChanged=!!topup&&orderTopupPaymentChanged(cause);
            throw cause;
          }
        },
        paymentCurrent,{refusedPaymentKey:session.externalPaymentRefused?session.record.pending?.key:undefined,kind:'ORDER_PAY',payload:{orderNo},orderNo,deadlineAt:Date.parse(payBy!),
          navigate:(href,replace)=>{paymentDestination=href;paymentReplace=!!replace;paymentLeaveApproved=routeLeavesPurchase(href);},
          reorder:()=>{
            const fromOrdinaryBundle=props.fromBundle&&!openedOriginal&&!props.orderNo&&!props.activityId
              &&new Set(expectedOrder.items?.map(item=>item.productNo)).size>=2&&expectedOrder.rewards?.length===0;
            paymentDestination=fromOrdinaryBundle?promotionBundleHref():promotionStoreHref(props.activityId,props);
            paymentLeaveApproved=!!fromOrdinaryBundle;
            paymentReplace=false;
          },
          commandKey:()=>session.externalPaymentKey(),parseReceipt:async raw=>{await session.acceptExternalPayment(raw);}}, !!topup);
    });
    if(!readCurrent(generation)||paymentDestination)return;
    if(order.value?.paymentStatus==='PAID')await readActivation();
    else{
      const walletRefresh=refreshWallet();
      if(!rejection)return;
      await walletRefresh;
      const reason=error.value;
      const recovered=await recover();
      if(!recovered||!readCurrent(generation)||unknown.value)return;
      if(topupChanged&&props.topupNetwork){
        paymentDestination=orderTopupHref(orderNo,props.topupNetwork,expectedOrder.items?.map(item=>item.productName).join(', ')??'');
        return;
      }
      if(!canCancel.value)return;
      const cancel=await confirm({title:flowCopy.value.cannotPay,message:reason||p.value.disabledNote,confirmLabel:p.value.cancelOrder,cancelLabel:p.value.keep,owner:paymentDialogOwner});
      if(cancel&&readCurrent(generation))await cancelOrder();
    }
  }finally{
    paymentConfirming.value=false;
    // The order page replaces a finished checkout, so back does not return to it.
    if(paymentDestination&&readCurrent(generation))await (paymentReplace?replaceWithOrder:navTo)(paymentDestination);
  }
}
let recoveryReadGeneration=-1;
function recover(foreground=false):Promise<boolean>{
  if(!current()||!visible.value||busy.value)return Promise.resolve(false);
  if(recoveryRead.value){
    // Back can arrive while the foreground read is checking this same order.
    if(recoveryReadGeneration===readGeneration)return recoveryRead.value;
    // A read from before the page was hidden cannot answer for this visit: read again once it ends.
    return recoveryRead.value.then(()=>recover(foreground));
  }
  if(session.busy)return Promise.resolve(false);
  recoveryReadGeneration=readGeneration;
  recoveryRead.value=readCheckout(foreground).finally(()=>{recoveryRead.value=null;});
  return recoveryRead.value;
}
async function readCheckout(foreground=false):Promise<boolean>{
  const generation=readGeneration;
  recoveryGeneration=generation;
  const operation=session.record.pending?.operation;
  const recoveringCreation=operation==='createOrder'||operation==='createBundle';
  const clockOnly=order.value?.paymentStatus==='PENDING'&&payWindow.value===null&&session.confirmed
    &&!session.record.pending&&!unknown.value&&!recoveryReadFailed.value;
  try{
    if(!clockOnly)await session.recover();
    if(!readCurrent(generation))return false;
    if(recoveringCreation&&session.confirmed&&!session.record.pending&&session.record.order){
      error.value='';activityConflict.value=false;
    }else if(recoveryReadFailed.value&&error.value===flowCopy.value.queryFailed)error.value='';
    recoveryReadFailed.value=false;
    revision.value++;
    if(reopenPaidOnEntry.value){
      if(!session.confirmed||session.record.pending)return false;
      if(order.value?.paymentStatus==='PAID'&&canStartNew.value){
        recoveryGeneration=null;
        await Promise.all([startNewPurchase(),refreshWallet(true)]);
        reopenPaidOnEntry.value=false;
        return current()&&visible.value&&!unknown.value;
      }
      reopenPaidOnEntry.value=false;
    }
    const reward=order.value?.rewards?.[0];
    if(reward&&(promotion.value?.activityId!==reward.activityId||promotion.value.version!==reward.version))
      readCheckoutPromotion(reward.activityId,generation,reward.version);
    const unpaidOrderEnded = order.value?.paymentStatus === 'EXPIRED' || order.value?.paymentStatus === 'CANCELLED';
    // If recovery was part of Back, let that navigation finish.
    if (!foreground && openedOriginal && !leaving.value && session.confirmed && !session.record.pending && unpaidOrderEnded
      && (!props.orderNo || props.orderNo !== order.value?.orderNo)) {
      const requestedHref = props.orderNo
        ? '/pages/store/checkout?orderNo=' + encodeURIComponent(props.orderNo)
        : promotionCheckoutHref(props.items, props.activityId, props);
      return await navReplace(requestedHref);
    }
    const reopenPurchase = ordinaryMultiItemEntry && canStartNew.value && !session.record.quote?.activityId
      && !order.value?.rewards?.length && unpaidOrderEnded;
    if (!foreground && reopenPurchase) {
      // The replacement quote has its own read generation.
      recoveryGeneration=null;
      await Promise.all([startNewPurchase(),refreshWallet(true)]);
      return current()&&visible.value&&!unknown.value;
    }
    await loadOrderClock();
    if(!readCurrent(generation))return false;
    if(order.value?.paymentStatus==='PAID')await readActivation();
    else if(!clockOnly&&!foreground)await refreshWallet(true,true);
    return readCurrent(generation)&&!unknown.value;
  }catch{if(readCurrent(generation))recoveryReadFailed.value=true;return false;}
  finally{recoveryGeneration=null;}
}
const conversations=useConversations();
function contactResultSupport(){
  const orderNo=order.value?.orderNo;if(!orderNo)return;
  void openOrderAdvisorChat(conversations, orderNo, () => current() && visible.value);
}
async function readActivation(){
  if(!current()||!visible.value||resultReading.value||order.value?.paymentStatus!=='PAID')return;
  const orderNo=order.value.orderNo,generation=++resultGeneration;
  const valid=()=>current()&&visible.value&&generation===resultGeneration&&order.value?.orderNo===orderNo;
  resultReading.value=true;
  try{
    if(catalogRefresh)await catalogRefresh;
    if(!valid())return;
    // The order determines fulfillment. Refresh the wallet and fleet independently.
    void refreshWallet(true,true);
    const canonical=await orders.ensureRemoteOrder(orderNo);
    if(!valid())return;
    if(!canonical||canonical.id!==orderNo)throw new Error('ACTIVATION_READBACK_UNAVAILABLE');
    if(canonical.status==='provisioning_failed')resultState.value='failed';
    else if(canonical.status==='activated'||canonical.status==='inventory')resultState.value=canonical.status;
    else if(['paid','provisioning'].includes(canonical.status))resultState.value='processing';
    else throw new Error('ACTIVATION_READBACK_UNCONFIRMED');
    resultError.value='';
  }catch{
    if(valid()){
      if(!resultSettled.value){
        resultState.value='error';
        resultError.value=t.value.orders.walletPaymentConfirmedRefreshPending;
      }
    }
  }
  finally{if(generation===resultGeneration)resultReading.value=false;}
}
const purchaseReadBusy=()=>loading.value||busy.value||session.busy||!!recoveryRead.value||resultReading.value
  ||walletState.value==='loading'||paymentConfirming.value||paymentEntryChecking.value||paymentEligibilityRecoveryBusy.value
  ||paymentSheetOpen.value||leaving.value||voucherLoading.value;
useAutoRecovery({
  failed:()=>current()&&visible.value&&auth.isAuthenticated&&!purchaseReadBusy()&&paymentEligibilityReadFailed.value
    &&session.confirmed&&!unknown.value&&order.value?.paymentStatus==='PENDING'&&payWindow.value===true,
  retry:async()=>{
    const expected=order.value;
    if(!expected)return;
    paymentEligibilityRecoveryBusy.value=true;
    try{await checkPaymentEligibility(expected,paymentEntryFence(expected));}
    finally{paymentEligibilityRecoveryBusy.value=false;}
  },
  retryNotBefore:()=>Math.max(0,...(order.value?.items??[]).map(item=>purchaseEligibilityApi.readCooldownUntil(item.productNo))),
  repeatMs:30_000,
  repeatWhile:()=>!hasVisiblePullRefresh(),
});
useAutoRecovery({
  failed:()=>current()&&visible.value&&auth.isAuthenticated&&!purchaseReadBusy()&&!session.retryOriginal
    &&(unknown.value||recoveryReadFailed.value||!!order.value&&!session.confirmed
      ||order.value?.paymentStatus==='PENDING'&&payWindow.value!==true),
  retry:recover,
  repeatMs:15_000,
});
useAutoRecovery({
  failed:()=>current()&&visible.value&&auth.isAuthenticated&&!purchaseReadBusy()&&!unknown.value
    &&order.value?.paymentStatus==='PAID'&&['processing','error'].includes(resultState.value),
  retry:readActivation,
  repeatMs:15_000,
});
async function startNewPurchase(){if(!canStartNew.value||props.orderNo||openedOriginal)return;session.startNewPurchase();voucherId.value=props.voucherId?.trim()||null;revision.value++;await loadQuote();}
async function cancelOrder(explicitLeave=false):Promise<boolean|'payment-in-progress'>{
  if(!canCancel.value||!current()||!visible.value)return false;
  const original=order.value!.orderNo;
  const summary=order.value!.items?.map(selectedItemName).join(', ')||t.value.store.coConfirmPurchase;
  let verified=false,paymentInProgress=false;
  await run(async()=>{
    try{await session.cancel();}
    catch(cause){
      if(!isApiRefusal(cause,409,'ORDER_EXTERNAL_PAYMENT_IN_PROGRESS'))throw cause;
      paymentInProgress=true;
      if(current()&&visible.value)await session.readAfterExternalPaymentRefusal(original).catch(()=>undefined);
      return;
    }
    finally{
      if(!paymentInProgress&&current()){
        // A late payment may win the server's order lock. Read the original outcome even after a lost/409 cancel response.
        if(!explicitLeave||session.record.pending?.operation==='cancelOrder')await session.recover();
        verified=true;
      }
    }
  });
  if(current()&&visible.value&&!unknown.value&&order.value?.paymentStatus==='PAID'){error.value='';await readActivation();return false;}
  if(paymentInProgress&&current()&&visible.value){
    error.value='';emit('cancel-blocked',original,summary);return 'payment-in-progress';
  }
  const cancelled=verified&&current()&&visible.value&&order.value?.orderNo===original&&!unknown.value&&['CANCELLED','EXPIRED'].includes(order.value.paymentStatus);
  if(!cancelled&&current())error.value=flowCopy.value.cancelFailed;
  return cancelled;
}
function viewOrder(){if(order.value)void navTo('/pages/store/order-detail?id='+encodeURIComponent(order.value.orderNo));}
// Open the warehouse on a fresh stack: back returns to Me, never to this finished result.
function viewDevices(){if(current()&&visible.value&&order.value?.paymentStatus==='PAID')void navReset('/pages/me/devices');}
function openWalletTopup(){paymentSheetOpen.value=false;void navTo('/pages/me/wallet-topup');}
function signIn(){void navTo('/pages/login/login?return='+encodeURIComponent(promotionCheckoutHref(selection.value,props.activityId,props)));}
let disposeGuard:(()=>void)|null=null;
// A leave the user confirmed inside the payment flow keeps the order for later; it is not a checkout cancel.
let paymentLeaveApproved=false;
const backDisabled=computed(()=>writeBusy.value||paymentConfirming.value||leaving.value);
function canConfirmLeave():boolean{
  return current()&&visible.value&&!backDisabled.value&&session.confirmed&&!session.unknown&&!recoveryReadFailed.value
    &&!session.record.pending&&order.value?.paymentStatus==='PENDING'&&!externalPaying.value;
}
async function requestLeave(intent:'back'|'route'|'cancel'):Promise<boolean>{
  const explicitCancel=intent==='cancel';
  if(nativeBackApproved||paymentLeaveApproved)return true;
  if(order.value?.paymentStatus==='PAID')return !explicitCancel&&current()&&visible.value;
  if(!current()||!visible.value||backDisabled.value)return false;
  if(externalPaying.value)return !explicitCancel;
  const pending=session.record.pending;
  // A back can reconcile a cancellation the user already requested. All other commands stay with the order.
  if(!explicitCancel&&pending?.operation!=='cancelOrder')return true;
  leaving.value=true;paymentSheetOpen.value=false;
  try{
    const recovered=await recover();
    if(!recovered||!current()||unknown.value||session.record.pending&&!session.retryOriginal&&!session.externalPaymentRefused){if(current()&&visible.value)error.value=t.value.orders.resultReadback;return false;}
    const original=session.record.order;
    if(!original)return !session.record.pending;
    if(explicitCancel&&original.paymentStatus==='PAID')return false;
    if(original.paymentStatus!=='PENDING')return true;
    if(!explicitCancel&&session.record.pending?.key!==pending?.key)return true;
    // Missing trusted time cannot turn an unresolved original order into a
    // successful cancellation. Keep it visible until a read settles it.
    if(payWindow.value===null){error.value=p.value.unknown;return false;}
    if(explicitCancel&&(session.record.pending||externalPaying.value))return false;
    const cancelled=await cancelOrder(explicitCancel);
    if(cancelled==='payment-in-progress')return false;
    if(!cancelled&&current()&&visible.value&&session.record.order?.paymentStatus!=='PAID'&&!error.value)error.value=t.value.orders.resultReadback;
    return cancelled;
  }finally{leaving.value=false;}
}
function allowAuxiliaryNavigation():Promise<boolean>{
  // Recharge and legal links are auxiliary navigation, not checkout cancel.
  return Promise.resolve(order.value?.paymentStatus==='PAID' || !writeBusy.value&&!paymentConfirming.value&&!leaving.value);
}
function routeLeavesPurchase(path:string):boolean{
  return /\/(?:pages\/)?store(?:\/store|\/detail|\/bundle)?(?:\?|$)/.test(path);
}
// #ifdef H5
onBeforeRouteLeave(to=>routeLeavesPurchase(to.path)?requestLeave('route'):allowAuxiliaryNavigation());
// #endif
let nativeBackApproved=false;
function approveBack(){nativeBackApproved=true;}
function cancelForLeave(){return canConfirmLeave()?requestLeave('cancel'):Promise.resolve(false);}
function back():boolean{
  if(nativeBackApproved){nativeBackApproved=false;return false;}
  void requestLeave('back').then(ok=>{if(ok&&current()){nativeBackApproved=true;navBack('/store');}});
  return true;
}
let foregroundPaymentSignature:string|undefined;
function pauseBrowserTab(){
  if(walletTimer){clearInterval(walletTimer);walletTimer=undefined;}
  paymentSheetOpen.value=false;termsOpen.value=false;voucherOpen.value=false;
  useUI().clearConfirmsBy(paymentDialogOwner);
}
function resumeBrowserTab(){if(current()&&visible.value)startWalletTimer();}
function refreshForegroundReview():boolean{
  if(!current()||!visible.value||!auth.isAuthenticated||purchaseReadBusy())return false;
  try{
    const changed=session.restoreForegroundRecovery();
    const signature=order.value?JSON.stringify(unfinishedOrderPayment(order.value.orderNo)??null):undefined;
    const paymentChanged=signature!==foregroundPaymentSignature;
    foregroundPaymentSignature=signature;
    if(changed||paymentChanged){
      revision.value++;
      if(session.record.pending||session.record.order)void recover(true);
      return true;
    }
    if(session.record.pending||session.record.order||props.orderNo)return true;
    // The checkout host automatically reads any original command found here.
    if(!recoverKeepBeforeNewPurchase())void loadQuote(true,true);
  }catch{recoveryReadFailed.value=true;}
  return true;
}
function hide(){
  pauseBrowserTab();
  visible.value=false;quotePresentation.value=null;readGeneration++;walletGeneration++;resultGeneration++;resultReading.value=false;paymentSheetOpen.value=false;walletState.value='idle';refreshOnIdle=false;termsOpen.value=false;voucherOpen.value=false;promotion.value=null;promotionReceivedAt=null;
  quoteRead.value=null;
  useUI().clearConfirmsBy(paymentDialogOwner);
  if(current()&&!session.record.pending&&!session.record.order){
    freshQuoteReady.value=false;receivedAt=null;quoteFresh.value=false;
    try{if(session.record.quote)session.invalidateQuote();}catch{error.value=p.value.errorNote;}
    revision.value++;
  }
  disposeGuard?.();disposeGuard=null;
}
function show(){
  const recheckCapacity=!visible.value&&quoteBlock.value==='capacity';
  visible.value=true;nativeBackApproved=false;paymentLeaveApproved=false;if(!current())return;
  startWalletTimer();
  if(!disposeGuard)disposeGuard=registerCheckoutLeaveGuard(allowAuxiliaryNavigation);
  if(busy.value){refreshOnIdle=true;return;}
  if(session.record.pending||session.record.order)void recover();else if(!props.orderNo){void refreshWallet(true);if(!quoteBlock.value||recheckCapacity)void loadQuote(recheckCapacity);}
}
watch(busy,value=>{if(!value&&refreshOnIdle){refreshOnIdle=false;if(visible.value&&current())show();}});
const footer = computed(() => {
  if (loading.value || reopenPaidOnEntry.value || !auth.isAuthenticated || unknown.value || externalPaying.value || keepRecoveryTarget.value) return null;
  const rawAmount = order.value?.amountUsdt ?? displayQuote.value?.amountUsdt;
  const currency='USD' as const,amount=formatCheckoutReviewAmount(rawAmount,currency,{unit:true}),amountValue=rawAmount;
  if (order.value?.paymentStatus === 'PENDING') return { amount, amountValue, currency, label: t.value.orders.paymentInProgressContinue, disabled: rawAmount==null||!canPay.value||leaving.value||paymentConfirming.value||paymentEntryChecking.value, action: pay };
  if (!order.value && createBlock.value) {
    const block=createBlock.value;
    return { amount, amountValue, currency, disabled:busy.value||leaving.value,
      label:block==='capacity'?t.value.myDevices.inventoryTitle:t.value.store.coBrowseOtherDevices,
      action:()=>navTo(block==='capacity'?'/pages/me/devices':'/store'),
      note:block==='promotionIneligible'?landingCopy(locale.code).ineligibleGift
        :block==='promotionUnavailable'?p.value.disabled:checkoutQuoteBlockCopy(block,t.value) };
  }
  if (!order.value && quoteBlock.value === 'capacity') return { amount, amountValue, currency,
    label: t.value.myDevices.inventoryTitle, disabled: !visible.value||leaving.value,
    action: () => navTo('/pages/me/devices'), note: checkoutQuoteBlockCopy(quoteBlock.value,t.value) };
  if (!order.value) return { amount, amountValue, currency, label: p.value.confirmOrder, disabled: rawAmount==null||!canCreate.value||leaving.value, action: createOrder, note: checkoutQuoteBlockCopy(quoteBlock.value,t.value) };
  // Original order refunded, cancelled or expired: 再买一单 is the page's main action, so it sits in the bottom bar (04 §4.0)
  // as a lone floating button; the old order's amount is not this purchase's total, so the bar shows no amount.
  if (order.value.paymentStatus !== 'PAID' && !openedOriginal && !props.orderNo && props.items.length && canStartNew.value)
    return { amount, amountValue, currency, amountless: true, label: props.items.length>1 ? flowCopy.value.buyBundleAgain : p.value.buyAgain, disabled: busy.value||leaving.value, action: startNewPurchase };
  return null;
});
// The tray's note above its button (04 §4.0): one line, the most pressing of the page's notices (decision ⑦): cannot buy or
// quote expired > terms missing > goes to inventory > quote warning. Each keeps the condition it had on the page.
const trayNotice=computed(()=>{
  const current=quote.value;
  if(auth.isAuthenticated&&!order.value&&!unknown.value&&current){
    if(current.eligibility!=='ELIGIBLE')return p.value.disabledNote;
    if(!quoteFresh.value)return p.value.quoteExpired;
    if(!completeTerms.value)return p.value.termsMissing;
  }
  if(inventoryNotice.value)return inventoryNotice.value;
  const warning=displayQuote.value?.warnings[0];
  return warning?localized(warning,locale.code):'';
});
// The page title says 待支付 while the original order waits for payment (board CkPend).
const orderPending=computed(()=>order.value?.paymentStatus==='PENDING');
const externalPaying=computed(()=>{
  void revision.value;
  const original=order.value,pending=session.record.pending;
  return original?.paymentStatus==='PENDING'&&(original.orderNo===props.externalOrderNo
    ||pending?.operation==='payOrder'&&pending.paymentMethod==='EXTERNAL'&&!session.externalPaymentRefused
    ||!!unfinishedOrderPayment(original.orderNo));
});
// The quote carries a policy version but no tier rate.
const bundleTierPct=null;
const discountSource=computed(()=>order.value?.discountUsdt!==undefined&&order.value?.promotionDiscountUsdt!==undefined
  ?order.value:order.value?receiptQuote.value:displayQuote.value);
const bundleDiscount=computed(()=>attributedBundleDiscount(new Set(items.value.map(item=>item.productNo)).size,
  discountSource.value?.discountUsdt,discountSource.value?.promotionDiscountUsdt));
const bundleDiscountOnly=computed(()=>bundleDiscount.value!==undefined&&Number(discountSource.value?.promotionDiscountUsdt)===0);
// Result stage: every model of a bundle on the one base; one model keeps productImage.
// A receipt read back after payment can carry no image: the catalog image of the same model stands in.
const resultImages=computed(()=>items.value.length>1?items.value.map(item=>item.imageUrl??getProduct(item.productNo)?.imageUrl).filter((src):src is string=>!!src):undefined);
const resultVisible = computed(() => !reopenPaidOnEntry.value && order.value?.paymentStatus === 'PAID');
const resultView=ref<InstanceType<typeof CheckoutResult>|null>(null);
// 再买一台 waits for a settled result (PRD purchase payment, line 49); the page puts it in the bar beside 查看设备. A failure
// offers support instead, and a delivery to inventory has only its own two exits (替换一台在线设备, 稍后再说).
const resultBuyAgain=computed(()=>!openedOriginal&&!props.orderNo&&props.items.length>0&&canStartNew.value&&resultState.value==='activated');
defineExpose({back,approveBack,canConfirmLeave,cancelForLeave,hide,show,footer,trayNotice,orderPending,resultView,resultBuyAgain,startNewPurchase,hasDevicePolicy,hasRewardTerms,backDisabled,resultVisible,pauseBrowserTab,resumeBrowserTab,refreshForegroundReview,keepRecoveryTarget,keepRecovery,keepRecoveryOperation,keepRecoveryProduct,keepRecoveryReadError,resolvingOriginalCapacity,resumeAfterCapacityRecovery,keepResumeAllowed,openKeepResume});
function startWalletTimer(){
  if(walletTimer)return;
  walletTimer=setInterval(()=>{
    if(!visible.value||!current()||loading.value||busy.value||paymentConfirming.value||paymentSheetOpen.value||leaving.value||termsOpen.value||voucherOpen.value||voucherLoading.value)return;
    if(walletState.value!=='loading')void refreshWallet(true);
    if(Date.now()-foregroundQuoteAt>=30_000&&!createBlock.value&&!quoteBlock.value&&!session.record.order&&!session.record.pending)void loadQuote();
  },30000);
}
onMounted(async()=>{
  disposeGuard=registerCheckoutLeaveGuard(allowAuxiliaryNavigation);timer=setInterval(updateClock,1000);
  startWalletTimer();
  // Catalog and current campaign visibility cannot block an original order or
  // command receipt. Historical rewards always come from that receipt.
  if(auth.isAuthenticated)catalogRefresh=refreshProductCatalog(true).catch(()=>false);
  try {
    if(auth.isAuthenticated){
      if(props.orderNo&&!session.record.order&&!session.record.pending){
        const receipt=await promotionApi.findOrder(props.orderNo);if(!current())return;
        if(!receipt)throw new Error('ORIGINAL_ORDER_NOT_FOUND');
        session.resume(receipt);
        revision.value++;
      }
      if(session.record.pending||session.record.order)await recover();else await Promise.all([loadQuote(),refreshWallet(true)]);
    }
  }catch{if(current())error.value=p.value.error;}finally{if(current())loading.value=false;}
});
let topupPayRequested=false;
watch([canPay, loading], ([ready, pending])=>{
  if(!ready||pending||!props.topupNetwork||topupPayRequested)return;
  topupPayRequested=true;
  void pay();
});
onBeforeUnmount(()=>{hide();alive=false;stopReleaseWatch();if(timer)clearInterval(timer);if(walletTimer)clearInterval(walletTimer);});
</script>
<style src="./promotion.css"></style>

<style scoped>
.promotion-main { padding-bottom:140px; }
/* The purchase result fills the screen itself (CheckoutResult), so the wrapper adds no height or foot of its own. */
.promotion-main--result { box-sizing:border-box; }
/* Original purchase state: title in the main ink, order line and note in the description role (01 §1.1.1 pairing 2, 10.1); no query button (03 §3.5.2). */
.checkout-keep-recovery { display:flex; align-items:flex-start; gap:var(--v5-space-2); }
.checkout-keep-recovery__icon { flex:none; margin-top:1px; color:var(--v5-warning-ink); }
.checkout-keep-recovery text { display:block; color:var(--v5-ink-3); font:var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); text-wrap:pretty; }
.checkout-keep-recovery .checkout-keep-recovery__title { margin-bottom:var(--v5-space-1); color:var(--v5-ink); font:var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); }
/* Rhythm (01 §1.3): cards 12 apart, a titled section 32 below what precedes it (24 at ≤374). */
.promotion-main { gap:var(--ui-space-card-gap); }
/* The tray spacer replaces the page's foot. The chassis already pads tray bottom + 18 below the content, so the spacer
   adds the rest: tray height − 2 (a one-row tray 62; a lone button 46). With a note: tray padding 8 + note 4 + note +
   gap 8 + button 48 + padding 8, less 2; the note copy sits 16 in from the content (tray 12 + 8 + note 12 = 32 in all). */
.promotion-main:has(> .promotion-tray-space) { padding-bottom:0; }
.promotion-tray-space { flex:none; margin-top:calc(-1 * var(--ui-space-card-gap)); height:calc(var(--nx-tray-clearance) - var(--nx-tray-bottom) - 18px); visibility:hidden; pointer-events:none; }
.promotion-tray-space--float { height:calc(48px + 16px - 18px); }
.promotion-tray-space--note { height:auto; padding:12px 16px calc(8px + 48px + 8px - 2px); }
.promotion-tray-space--measured { padding:0; }
.promotion-tray-space__note { display:block; font:var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); text-align:center; overflow-wrap:break-word; text-wrap:pretty; }
.checkout-group { overflow:hidden; min-width:0; border:1px solid color-mix(in srgb,var(--v5-border) 40%,transparent); border-radius:var(--ui-radius-surface); background:var(--ui-content-surface); }
[data-theme="light"] .checkout-group, [data-theme="light"] .checkout-bundle, [data-theme="light"] .checkout-paying { box-shadow:var(--v5-glass-shadow); }
.checkout-section { min-width:0; margin-top:calc(var(--ui-space-section-gap) - var(--ui-space-card-gap)); }
.checkout-section-heading { display:block; margin-bottom:var(--v5-space-3); color:var(--v5-ink); font:var(--ui-type-section-weight) var(--ui-type-section)/var(--ui-type-section-lh) var(--font-v5); }
/* Original order state line on the page floor (board CkPend): warning time or closed state, the order link, the number. */
.checkout-order-status { min-width:0; margin-bottom:var(--v5-space-1); }
.checkout-order-status__row { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--v5-space-1) var(--v5-space-3); }
.checkout-order-status__state { display:inline-flex; align-items:center; gap:6px; min-width:0; color:var(--v5-ink-2); font:var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); }
.checkout-order-status__state--warning { color:var(--v5-warning-ink); }
.checkout-order-status__icon { flex:none; }
.checkout-order-link { position:relative; flex:none; display:inline-flex; align-items:center; color:var(--v5-ink-3); font:var(--ui-type-text-link-weight) var(--ui-type-text-link)/var(--ui-type-text-link-lh) var(--font-v5); white-space:nowrap; cursor:pointer; }
.checkout-order-link::after { content:""; position:absolute; top:calc(50% - 22px); bottom:calc(50% - 22px); left:-8px; right:-8px; }
.checkout-order-link:focus-visible { outline:2px solid var(--v5-brand); outline-offset:3px; }
.checkout-order-no { display:flex; align-items:baseline; gap:var(--v5-space-1); min-width:0; margin-top:6px; color:var(--v5-ink-3); font:var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.checkout-order-no__label { flex:none; }
.checkout-order-no .checkout-order-no__code { color:var(--v5-ink-2); font-size:var(--ui-type-meta); line-height:var(--ui-type-meta-lh); }
/* P4 (board CkExt): a solid card, warning clock in a 14% circle, the result, what not to do, then the order and its link. */
.checkout-paying { display:flex; align-items:flex-start; gap:var(--v5-space-3); padding:var(--ui-space-inset); border:1px solid color-mix(in srgb,var(--v5-border) 40%,transparent); border-radius:var(--ui-radius-surface); background:var(--ui-content-surface); }
.checkout-paying__icon { display:grid; place-items:center; flex:none; width:36px; height:36px; border-radius:50%; background:var(--v5-warning-soft); color:var(--v5-warning-ink); }
.checkout-paying__title { display:block; color:var(--v5-ink); font:var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); }
.checkout-paying__body { display:block; margin-top:var(--v5-space-1); color:var(--v5-ink-3); font:var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); text-wrap:pretty; }
.checkout-paying__foot { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--v5-space-1) var(--v5-space-3); margin-top:10px; }
.checkout-paying__foot .checkout-order-no { margin-top:0; }
/* Bundle card (board CkNew): solid card, 已选 N 款 + tier tag, two-column grid of model tiles on the inner surface. */
.checkout-bundle { min-width:0; padding:var(--ui-space-inset); border:1px solid color-mix(in srgb,var(--v5-border) 40%,transparent); border-radius:var(--ui-radius-surface); background:var(--ui-content-surface); }
.checkout-bundle__head { display:flex; align-items:center; justify-content:space-between; gap:var(--v5-space-3); }
.checkout-bundle__title { min-width:0; color:var(--v5-ink); font:var(--ui-type-card-title-weight) var(--ui-type-card-title)/var(--ui-type-card-title-lh) var(--font-v5); }
.checkout-bundle__tag { flex:none; }
.checkout-bundle__grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--v5-space-2); margin-top:var(--v5-space-3); }
.checkout-tile { position:relative; min-width:0; padding:10px 12px 12px; border-radius:16px; background:var(--ui-content-surface-2); }
.checkout-tile__art { position:absolute; left:4px; top:-6px; width:84px; height:84px; pointer-events:none; }
.checkout-tile__image { width:84px; height:84px; }
.checkout-tile__name { display:block; margin-top:62px; color:var(--v5-ink); font:var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); overflow-wrap:break-word; }
/* Line price in ordinary figures (01 §1.2): one colour, the $ at full size. */
.checkout-tile .checkout-tile__price { display:block; margin-top:2px; color:var(--v5-ink); font:500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.checkout-tile .checkout-tile__price :deep(.checkout-amount__symbol) { margin-right:0; font-size:1em; color:inherit; }
.checkout-tile .checkout-tile__price :deep(.checkout-amount__fraction) { color:inherit; }
.checkout-tile__qty { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--v5-space-1) var(--v5-space-2); margin-top:10px; }
.checkout-tile__qty-label { display:block; color:var(--v5-ink-3); font:var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); white-space:nowrap; }
.checkout-tile__qty-readonly { margin-top:var(--v5-space-2); }
.checkout-tile__qty-value { margin-left:var(--v5-space-1); color:var(--v5-ink); font-weight:500; font-variant-numeric:tabular-nums; }
/* Tile stepper: a 32 pill on the deeper surface; visible buttons 36 (32 at ≤374, so 数量 fits beside it), each with a 44 target. */
.checkout-item-quantity.checkout-tile__stepper { height:32px; margin-right:0; border-radius:999px; background:var(--v5-surface-3); }
.checkout-tile__stepper .checkout-item-quantity-button { position:relative; width:36px; height:32px; min-height:32px; }
.checkout-tile__stepper .checkout-item-quantity-button::after { content:""; position:absolute; top:-6px; bottom:-6px; left:-4px; right:-4px; }
.checkout-tile__stepper .checkout-item-quantity-value { font:500 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-metric); }
/* Same product summary as checkout.vue: device image as the main visual, quantity on its own full-width row. */
.checkout-product-line { --checkout-art:120px; --checkout-art-h:76px; --checkout-art-image:128px; display:grid; grid-template-columns:var(--checkout-art) minmax(0,1fr); align-items:center; gap:0 var(--v5-space-3); padding:var(--ui-space-inset-hero) var(--ui-space-inset-hero) var(--v5-space-1); border-color:color-mix(in srgb,var(--v5-border) 40%,transparent); }
.checkout-product-art { position:relative; width:var(--checkout-art); height:var(--checkout-art-h); }
.checkout-product-art .promotion-image { position:absolute; left:50%; top:50%; width:var(--checkout-art-image); height:var(--checkout-art-image); transform:translate(-50%, -57%); pointer-events:none; }
.checkout-product-line:has(> .checkout-product-art:empty) { grid-template-columns:minmax(0,1fr); }
.checkout-product-art:empty { display:none; }
.checkout-discount-row { display:flex; align-items:center; gap:var(--ui-space-inline); min-height:64px; box-sizing:border-box; padding:var(--ui-space-inline) var(--ui-space-inset); border-bottom:1px solid color-mix(in srgb,var(--v5-border) 40%,transparent); }
.checkout-discount-row:last-child { border-bottom:0; }
.checkout-discount-icon { display:grid; place-items:center; flex:none; width:36px; height:36px; border-radius:12px; background:var(--ui-content-surface-2); color:var(--v5-ink-2); }
.checkout-discount-title { display:block; font:500 var(--ui-type-list-title)/20px var(--font-v5); overflow-wrap:break-word; }
.checkout-discount-description { display:block; margin-top:2px; font:400 13px/18px var(--font-v5); color:var(--v5-ink-3); overflow-wrap:break-word; }
.checkout-discount-chevron { flex:none; color:var(--v5-ink-4); }
.checkout-voucher-row { gap:12px; color:var(--v5-ink); }
.checkout-voucher-row[aria-disabled="true"] { opacity:.45; }
.checkout-rewards-heading { border-bottom:0; }
.checkout-gift-summary { cursor:pointer; }
.checkout-gift-summary:focus-visible { outline:2px solid var(--v5-brand); outline-offset:-2px; }
.checkout-gift-badge { flex-shrink:0; }
.checkout-rewards :deep(.promotion-row) { align-items:center; min-height:64px; box-sizing:border-box; padding:10px 16px; }
.checkout-rewards :deep(.promotion-symbol) { display:grid; place-items:center; width:36px; height:36px; border-radius:12px; background:var(--ui-content-surface-2); color:var(--v5-ink-2); }
.checkout-rewards :deep(.promotion-symbol svg) { width:18px; height:18px; }
.checkout-rewards :deep(.promotion-grow > text:not([class])),.checkout-rewards :deep(.promotion-grow > uni-text:not([class])) { font:500 var(--ui-type-list-title)/20px var(--font-v5) !important; }
.checkout-rewards :deep(.promotion-copy) { margin-top:2px; font:400 var(--ui-type-list-subtitle)/18px var(--font-v5); }
.checkout-reward-terms { margin:0 16px 0 64px; }
.checkout-discount-value { color:var(--v5-ink); font-weight:500; font-variant-numeric:tabular-nums; white-space:nowrap; }
.checkout-discount-row .checkout-discount-value { flex-shrink:0; max-width:45%; overflow-wrap:break-word; text-align:right; font:600 15px/20px var(--font-v5); }
.checkout-wallet { display:grid; grid-template-columns:36px minmax(0,1fr) auto; align-items:center; gap:var(--v5-space-3); padding:14px var(--ui-space-inset); }
.checkout-wallet-icon { display:grid; place-items:center; width:36px; height:36px; border-radius:var(--ui-radius-icon); color:var(--v5-ink-2); background:var(--ui-content-surface-2); }
.checkout-wallet-details { min-width:0; }
/* Balance on one line under the name: label in the muted ink, the figure in ordinary 500 figures (01 §1.2). */
.checkout-wallet-balance { display:flex; flex-wrap:wrap; align-items:baseline; gap:0 var(--v5-space-1); margin-top:2px; }
.checkout-wallet-label,.checkout-wallet-state { font:var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); color:var(--v5-ink-3); overflow-wrap:break-word; }
.checkout-wallet-amount { font:500 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); font-variant-numeric:tabular-nums; color:var(--v5-ink); overflow-wrap:break-word; }
.checkout-wallet-topup { display:flex; align-items:center; justify-content:flex-end; gap:var(--v5-space-1); min-width:44px; min-height:44px; color:var(--v5-brand); font:500 var(--ui-type-list-subtitle)/18px var(--font-v5); cursor:pointer; }
.checkout-wallet-topup svg { flex:none; }
.checkout-wallet-topup:focus-visible { outline:2px solid var(--v5-brand); outline-offset:2px; }
.checkout-wallet-recovery { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--v5-space-2); margin:0 var(--ui-space-inset); border-top:1px solid var(--v5-border); color:var(--v5-ink-3); font:400 var(--ui-type-list-subtitle)/18px var(--font-v5); }
/* 核对订单 (board CkNew): field rows 13/18, name muted, figure 500 in the main ink; one rule above 应付金额. */
.checkout-fees { padding:4px var(--ui-space-inset); }
.checkout-fees .promotion-summary { box-sizing:border-box; align-items:baseline; min-height:0; padding:11px 0; color:var(--v5-ink); font:500 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); font-variant-numeric:tabular-nums; }
.checkout-fees .promotion-summary > :first-child { color:var(--v5-ink-3); font-weight:400; }
.checkout-fees .promotion-summary > :last-child { max-width:65%; }
.checkout-fees .checkout-fee-amount { font-family:var(--font-v5); }
.checkout-fees .checkout-fee-amount :deep(.checkout-amount__symbol) { margin-right:0; font-size:1em; color:inherit; }
.checkout-fees .checkout-fee-amount :deep(.checkout-amount__fraction) { color:inherit; }
.checkout-fees .promotion-summary.total { align-items:center; min-height:0; padding:14px 0 13px; border-top:1px solid var(--v5-border); }
.checkout-fees .promotion-summary.total > :first-child { color:var(--v5-ink); font:var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); }
.checkout-fees .promotion-summary.total > :last-child { font-size:20px; line-height:24px; }
.checkout-item-name { display:block; font:var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); overflow-wrap:break-word; }
.checkout-line-price { display:block; margin-top:var(--v5-space-2); font-size:var(--ui-type-list-title); line-height:var(--ui-type-list-title-lh); }
.checkout-line-price :deep(.checkout-amount__symbol) { font-size:max(12px, .55em); }
.checkout-voucher-options { display:flex; flex-direction:column; gap:var(--ui-space-inline); }
.checkout-voucher-option { align-items:flex-start; flex-direction:column; gap:6px; text-align:left; }
.checkout-voucher-options [aria-pressed="true"] { background:var(--v5-brand-soft); box-shadow:inset 0 0 0 1px var(--v5-brand); }
.checkout-item-quantity-row { grid-column:1 / -1; display:flex; align-items:center; justify-content:space-between; gap:var(--v5-space-3); min-height:52px; margin-top:var(--v5-space-4); border-top:1px solid var(--v5-border); }
.checkout-item-quantity-row .promotion-copy { line-height:var(--ui-type-list-subtitle-lh); }
/* 20px glyphs in 44px targets: pull the row right so the + stroke, not its hit area, meets the divider end. */
.checkout-item-quantity { display:flex; flex:none; align-items:center; margin-right:-16px; }
.checkout-item-quantity-button { display:grid; place-items:center; width:44px; min-height:44px; border-radius:999px; color:var(--v5-ink); cursor:pointer; }
.checkout-item-quantity-button[aria-disabled="true"] { opacity:.5; cursor:default; }
.checkout-item-quantity-button:focus-visible { outline:2px solid var(--v5-brand); outline-offset:-2px; }
.checkout-item-quantity-value { min-width:24px; text-align:center; font:var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); font-variant-numeric:tabular-nums; }
@media(max-width:374px) {
  .checkout-product-line { --checkout-art:104px; --checkout-art-h:66px; --checkout-art-image:112px; }
  .checkout-tile__qty { column-gap:var(--v5-space-1); }
  .checkout-tile__stepper .checkout-item-quantity-button { width:32px; }
  .checkout-tile__stepper .checkout-item-quantity-button::after { left:-6px; right:-6px; }
}
@media(prefers-reduced-motion:reduce) { .promotion-action:active { transform:none; } }
</style>
