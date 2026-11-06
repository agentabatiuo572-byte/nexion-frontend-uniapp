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
      <SubPageHeader back="/pages/me/me" :title="t.trial.pageTitle" :subtitle="t.trial.pageHeaderSubtitle" />

      <view v-if="authorityScreenUnavailable" class="mx-4 trial-read-state" role="status" :aria-busy="freeTrial.authorityStatus === 'loading'">
        <view v-if="freeTrial.authorityStatus === 'loading'" class="trial-read-skeleton" aria-hidden="true"><view/><view/><view/></view>
        <text>{{ freeTrial.authorityStatus === 'loading' ? lifecycle.loading : lifecycle.unavailable }}</text>
        <view v-if="freeTrial.authorityStatus !== 'loading'" role="button" tabindex="0" class="trial-read-retry" @click="freeTrial.refreshRemote(true)"><text>{{ lifecycle.retry }}</text></view>
      </view>

      <!-- ═══ active / grace — running cycle ═══ -->
      <view v-else-if="isActiveCycle" class="trial-state" :class="{ 'trial-state--grace': isGrace }">
        <view class="trial-glow trial-glow--hero" aria-hidden="true" />
        <view class="trial-hero trial-rise">
          <view class="trial-hero__top">
            <NxTag :tone="isGrace ? 'warning' : 'brand'">{{ ribbon }}</NxTag>
            <view v-if="!isGrace" class="trial-online"><view class="trial-online__dot trial-detail__online" /><text>{{ t.earn.online }}</text></view>
          </view>
          <view class="trial-ring">
            <svg class="trial-ring__svg" width="208" height="208" viewBox="0 0 208 208" aria-hidden="true">
              <circle class="trial-ring__track" cx="104" cy="104" r="96" fill="none" stroke-width="6" />
              <circle class="trial-ring__arc" cx="104" cy="104" r="96" fill="none" stroke-width="6" stroke-linecap="round" :stroke-dasharray="RING_LENGTH" :stroke-dashoffset="ringOffset" transform="rotate(-90 104 104)" />
            </svg>
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
            <text class="trial-earned__value">{{ earnedParts[0] }}<text v-if="earnedParts[1]" class="trial-dim">.{{ earnedParts[1] }}</text></text>
            <text class="trial-earned__unit">USDT</text>
          </view>
          <text class="trial-earned__uvt">+ {{ visibility.mask(formatGroupedAmount(shadowNEX)) }}<text class="trial-unit-small"> UVT</text></text>
          <text class="trial-earned__note">{{ detail.withdrawAfterBuy }}</text>
        </view>

        <!-- FEAT-TRIAL05: every amount below is the server quote convert() will settle. -->
        <view v-if="purchaseQuote" class="trial-ticket trial-rise trial-rise--3" data-testid="trial-credit-summary">
          <view class="trial-ticket__body">
            <NxTag v-if="earlyQuote" class="trial-ticket__tag" tone="brand"><svg class="trial-ticket__tag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{{ detail.earlyTag }}</NxTag>
            <text class="trial-ticket__title" data-testid="trial-buy-title">{{ buyTitle }}</text>
            <text v-if="earlyQuote" class="trial-ticket__subtitle">{{ detail.earlySubtitle }}<text class="trial-ticket__estimate">{{ detail.earlyEstimate }}</text></text>

            <view class="trial-total">
              <text class="trial-total__breakdown">{{ totalBreakdown }}</text>
              <view class="trial-total__line">
                <text class="trial-total__label">{{ detail.totalLabel }}</text>
                <text class="trial-total__value">{{ totalParts[0] }}<text v-if="totalParts[1]" class="trial-total__dec">.{{ totalParts[1] }}</text></text>
                <text class="trial-unit-small trial-total__unit">USDT</text>
                <text v-if="purchaseQuote.rewardNEX > 0" class="trial-total__uvt">+ {{ visibility.mask(formatGroupedAmount(purchaseQuote.rewardNEX)) }}<text class="trial-unit-small"> UVT</text></text>
              </view>
            </view>

            <view class="trial-rows" role="group" :aria-label="purchase.payGroup">
              <view class="trial-row"><text class="trial-row__label">{{ detail.unitPrice }}</text><text class="trial-row__value">{{ usd(purchaseQuote.priceUSD) }}</text></view>
              <view v-if="purchaseQuote.promoDiscountUSD > 0" class="trial-row"><view class="trial-row__label">{{ promoLabel }}<NxTag class="trial-limit-tag" tone="warning">{{ detail.limitedTag }}</NxTag></view><text class="trial-row__value">−{{ usd(purchaseQuote.promoDiscountUSD) }}</text></view>
              <view v-if="earlyQuote && earlyQuote.earlyDiscountUSD > 0" class="trial-row"><text class="trial-row__label">{{ detail.earlyRow }}</text><text class="trial-row__value">−{{ usd(earlyQuote.earlyDiscountUSD) }}</text></view>
              <view v-if="purchaseQuote.offsetUSD > 0" class="trial-row"><view class="trial-row__label">{{ fmt(detail.offsetRow, { amount: visibility.mask(formatGroupedAmount(purchaseQuote.offsetUSD)) }) }}<NxTag class="trial-limit-tag" tone="warning">{{ detail.limitedTag }}</NxTag></view><text class="trial-row__value">{{ visibility.mask(`−${usd(purchaseQuote.offsetUSD)}`) }}</text></view>
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
                <text class="trial-credit__value" data-testid="trial-credit-after"><template v-if="purchaseQuote.remainderUSD > 0">{{ visibility.mask(formatGroupedAmount(purchaseQuote.remainderUSD)) }}<text class="trial-unit-small trial-dim"> USDT</text></template><text v-if="purchaseQuote.remainderUSD > 0 && purchaseQuote.rewardNEX > 0" class="trial-credit__sep"> · </text><text v-if="purchaseQuote.rewardNEX > 0" class="trial-credit__uvt">{{ visibility.mask(formatGroupedAmount(purchaseQuote.rewardNEX)) }}<text class="trial-unit-small"> UVT</text></text></text>
              </view>
            </view>
          </template>
        </view>
        <!-- Older servers without a quote keep the accrued-only presentation. -->
        <view v-else class="trial-ticket trial-ticket__body trial-rise trial-rise--3" data-testid="trial-credit-summary">
          <view class="trial-sum__row">
            <text class="trial-row__label">{{ lifecycle.availableOffsetLabel }}</text>
            <text class="trial-sum__discount">{{ visibility.mask(usd(trialOffset.offsetUSD)) }}</text>
          </view>
          <view class="trial-row trial-legacy-row"><text class="trial-row__label">{{ lifecycle.estimateTotalLabel }}</text><text class="trial-row__value">≈ {{ usd(estimatedOffsetUSD) }}</text></view>
          <text class="trial-legacy-note">{{ lifecycle.earlyPurchaseNote }}</text>
          <text v-if="trialOffset.remainderUSD > 0" class="trial-legacy-note">{{ offsetRemainderNote }}</text>
        </view>

        <view class="trial-links trial-rise trial-rise--4">
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
          <text class="trial-terminal-copy__title">{{ t.trial.idleTitleNew }}</text>
          <text v-if="idleBody" class="trial-terminal-copy__body">{{ idleBody }}</text>
        </view>
      </view>

      <!-- ═══ ended — credit expired terminal ═══ -->
      <view v-else-if="status === 'ended'" class="trial-state trial-state--terminal" data-testid="trial-ended">
        <view class="trial-ring trial-ring--terminal trial-ring--muted trial-rise">
          <svg class="trial-ring__svg" width="208" height="208" viewBox="0 0 208 208" aria-hidden="true"><circle class="trial-ring__track" cx="104" cy="104" r="96" fill="none" stroke-width="6" /></svg>
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
          <svg class="trial-ring__svg" width="208" height="208" viewBox="0 0 208 208" aria-hidden="true"><circle class="trial-ring__track" cx="104" cy="104" r="96" fill="none" stroke-width="6" /></svg>
          <CatalogMachineImage class="trial-ring__machine" :sku="trialProductId" :image-url="trialImageUrl" scope-key="trial-refunded" />
          <view class="trial-ring__badge" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></svg></view>
        </view>
        <view class="trial-terminal-copy trial-rise trial-rise--2">
          <text class="trial-terminal-copy__title">{{ purchase.refundedTitle }}</text>
          <text class="trial-terminal-copy__body">{{ purchase.refundedBody }}</text>
          <text v-if="freeTrial.authoritativeConversion?.rewardsReversed" class="trial-terminal-copy__note">{{ purchase.refundedRewards }}</text>
        </view>
      </view>

      <!-- ═══ converted — owned terminal ═══ -->
      <view v-else class="trial-state trial-state--terminal">
        <view class="trial-glow trial-glow--owned" aria-hidden="true" />
        <view class="trial-ring trial-ring--terminal trial-ring--owned trial-rise">
          <svg class="trial-ring__svg" width="208" height="208" viewBox="0 0 208 208" aria-hidden="true"><circle class="trial-ring__full" cx="104" cy="104" r="96" fill="none" stroke-width="6" /></svg>
          <CatalogMachineImage class="trial-ring__machine" :sku="trialProductId" :image-url="trialImageUrl" scope-key="trial-owned" />
          <view class="trial-ring__check" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg></view>
        </view>
        <view class="trial-terminal-copy trial-rise trial-rise--2">
          <text class="trial-terminal-copy__title">{{ t.trial.convertedTitle }}</text>
          <text class="trial-terminal-copy__body">{{ t.trial.convertedDesc }}</text>
        </view>
      </view>

      <!-- Reserves the bottom bar's height so the last row scrolls clear of it: the bar's own note and
           retry rows, invisible, wrap exactly as in the bar; the button, padding and safe area are fixed. -->
      <view v-if="!authorityScreenUnavailable" class="trial-bar-space" aria-hidden="true">
        <text v-if="barNote" class="trial-bar__note">{{ barNote }}</text>
        <view v-if="barRetry" class="trial-bar__retry trial-bar-space__retry" />
      </view>
    </view>

    <!-- Every state's main action sits in the thumb zone (DS-30). -->
    <template #pageFixed>
      <view v-if="!authorityScreenUnavailable" class="trial-bar" :class="{ 'trial-bar--pair': conversionRefunded }">
        <template v-if="isActiveCycle || (status === 'ended' && !claimVisible)">
          <text v-if="barNote" class="trial-bar__note">{{ barNote }}</text>
          <view v-if="barRetry" class="trial-bar__retry"><NxButton variant="text" size="small" :label="t.store.catalogRetry" @click="retryCatalog" /></view>
          <NxButton class="trial-bar__main" variant="primary" :label="trialBuyCtaText" :disabled="trialProductUnavailable && !trialCatalogLoading" :busy="trialCatalogLoading" @click="goCheckout">
            <svg v-if="isActiveCycle" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>
            <text>{{ trialBuyCtaText }}</text>
          </NxButton>
        </template>
        <template v-else-if="claimVisible">
          <!-- Ineligible → concrete reason above the disabled CTA (异常2) -->
          <text v-if="barNote" class="trial-bar__note">{{ barNote }}</text>
          <NxButton class="trial-bar__main" variant="primary" :label="t.trial.idleCta" :disabled="!canStartNow" @click="claim" />
        </template>
        <template v-else-if="conversionRefunded">
          <NxButton v-if="freeTrial.authoritativeConversion?.orderNo" class="trial-bar__side" variant="secondary" :label="purchase.refundOrderCta" @click="goRefundedOrder" />
          <NxButton class="trial-bar__wide" variant="primary" :label="purchase.shopCta" @click="goStore" />
        </template>
        <NxButton v-else class="trial-bar__main" variant="primary" :label="t.trial.convertedDevicesCta" @click="goDevices" />
      </view>
    </template>

    <!-- ═══ Rules half-sheet (spec ⑥「查看抵扣规则」) ═══ -->
    <view v-if="rulesOpen" class="trs-root" role="dialog" aria-modal="true">
      <view class="trs-backdrop" role="button" tabindex="0" @click="rulesOpen = false" />
      <view class="nx-glass-sheet trs-panel" @click.stop>
        <view class="flex items-center justify-between">
          <text style="font-family: var(--font-v5); font-size: var(--ui-type-section); font-weight: 600; color: var(--v5-ink)">{{ t.trial.rulesTitle }}</text>
          <view class="grid place-items-center active:opacity-70" style="width: 44px; height: 44px; border-radius: 999px; flex-shrink: 0" role="button" tabindex="0" :aria-label="t.trial.sheetCloseAria" @click="rulesOpen = false">
            <view class="rounded-full grid place-items-center" style="width: 36px; height: 36px; background: var(--v5-surface-2)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </view>
          </view>
        </view>
        <view style="margin-top: 14px; display: flex; flex-direction: column; gap: 10px">
          <view v-for="(line, i) in rulesLines" :key="i" class="flex items-start" style="gap: 8px">
            <view style="width: 6px; height: 6px; border-radius: 50%; background: var(--v5-brand); margin-top: 6px; flex-shrink: 0" />
            <text style="flex: 1; font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-2); line-height: 1.625; text-wrap: pretty">{{ line }}</text>
          </view>
        </view>
        <view class="w-full flex items-center justify-center active:scale-[0.98]" :style="rulesGotStyle" role="button" tabindex="0" :aria-label="t.trial.rulesGotCta" @click="rulesOpen = false">
          <text>{{ t.trial.rulesGotCta }}</text>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { formatAmount, formatGroupedAmount } from "@/lib/amount-display";
import { computed, ref, onMounted, onUnmounted, type CSSProperties } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import CatalogMachineImage from "@/components/catalog-machine-image.vue";
import NxButton from "@/components/ui/nx-button.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import { useT } from "@/i18n/use-t";
import { dateLocale, fmt } from "@/i18n/format";
import { formatTrialDeadline } from "@/lib/trial-date";
import { geoPolicyErrorKind, geoPolicyUserMessage } from "@/api/geo-policy-error";
import { useFreeTrial, liveShadowUSD, liveShadowNEX, remainingMs } from "@/store/free-trial";
import { useTrialConfig, computeTrialOffset, resolveTrialCheckoutProductId } from "@/store/trial-config";
import { useTrialClaimSheet } from "@/store/trial-claim-sheet";
import { useDataVisibility } from "@/store/data-visibility";
import { getProduct } from "@/mock/products";
import { productCatalogState, refreshProductCatalog } from "@/store/product-catalog";
import { navTo } from "@/lib/route";
import { useDialogA11y } from "@/composables/use-dialog-a11y";
import { useCountUp } from "@/composables/use-count-up";
import { remoteApiEnabled } from "@/api/runtime";
import { useTrialLifecycleCopy } from "@/i18n/trial-lifecycle";
import { useTrialPurchaseCopy } from "@/i18n/trial-purchase";
import { useTrialDetailCopy } from "@/i18n/trial-detail";

const t = useT();
const freeTrial = useFreeTrial();
onShow(() => { void freeTrial.refreshVisible(); });
const trialConfig = useTrialConfig();
const visibility = useDataVisibility();
const lifecycle = useTrialLifecycleCopy();
const purchase = useTrialPurchaseCopy();
const detail = useTrialDetailCopy();
const authorityIncomplete = computed(() => (freeTrial.status === "active" || freeTrial.status === "grace")
  && (freeTrial.authoritativeOffsetUSD === null || freeTrial.authoritativeRemainderUSD === null));
const authorityUnavailable = computed(() => remoteApiEnabled && (freeTrial.authorityStatus !== "ready" || authorityIncomplete.value));
// Keep the confirmed page on screen during a trial read
// meanwhile instead of swapping in the read state. Actions still wait on authorityUnavailable.
const authorityScreenUnavailable = computed(() => remoteApiEnabled && (freeTrial.authorityServerState === null || authorityIncomplete.value));

const cfg = computed(() => trialConfig.config);
const status = computed(() => freeTrial.status);

const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  void refreshProductCatalog(true);
  ticker = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onUnmounted(() => {
  if (ticker) clearInterval(ticker);
  ticker = null;
});

const isActiveCycle = computed(() => status.value === "active" || status.value === "grace");
const isGrace = computed(() => status.value === "grace");
const trialProductId = computed(() => resolveTrialCheckoutProductId(cfg.value.trialProductId));
// The catalogue array is not reactive: read it only once a read has settled, so the lookup re-runs per read.
const trialProduct = computed(() => (productCatalogState.status === "ready" && trialProductId.value ? getProduct(trialProductId.value) : undefined));
const trialImageUrl = computed(() => trialProduct.value?.imageUrl);
const trialCatalogLoading = computed(() => productCatalogState.status !== "ready" && productCatalogState.status !== "error");
const trialProductUnavailable = computed(() => {
  if (productCatalogState.status !== "ready") return true;
  const product = trialProduct.value;
  if (!product || product.purchaseBlocked === true) return true;
  return product.productType !== "SHARE"
    && product.inventoryMode === "FINITE"
    && (product.stock ?? 0) <= 0;
});
const shadowUSD = computed(() => liveShadowUSD(now.value));
const shadowNEX = computed(() => liveShadowNEX(now.value));
const remainingMsValue = computed(() => remainingMs(now.value));
const trialOffset = computed(() => remoteApiEnabled
  ? { offsetUSD: freeTrial.authoritativeOffsetUSD ?? 0, remainderUSD: freeTrial.authoritativeRemainderUSD ?? 0 }
  : computeTrialOffset(cfg.value, shadowUSD.value));
const estimatedOffsetUSD = computed(() => computeTrialOffset(cfg.value, cfg.value.shadowDailyUSD * cfg.value.trialDays).offsetUSD);
// FEAT-TRIAL05: the server quote convert() will settle. An early quote is shown only while
// the original term is still running. App's boundary read supplies the next quote.
const earlyQuoteLapsed = computed(() => {
  const quote = freeTrial.authoritativeQuote;
  return !!quote?.earlyPurchase && quote.earlyEndsAt !== null && freeTrial.serverTimeAt(now.value) >= quote.earlyEndsAt;
});
const purchaseQuote = computed(() => remoteApiEnabled && isActiveCycle.value && !earlyQuoteLapsed.value
  ? freeTrial.authoritativeQuote : null);
const earlyQuote = computed(() => status.value === "active" && purchaseQuote.value?.earlyPurchase ? purchaseQuote.value : null);

// Prices and discounts are dollars; earnings and credit are USDT (a quote counts 1 USDT as $1).
const usd = (value: number) => `$${formatGroupedAmount(value)}`;
// Caps and the headline discount read as whole dollars when they are ("$50", "$10").
const usdShort = (value: number) => (Number.isInteger(value) ? `$${value}` : usd(value));
const cents = (value: number) => Math.round(value * 100) / 100;
/** Integer and decimal digits of a grouped amount, so the decimals can take the secondary colour. */
function amountParts(value: number): [string, string] {
  const [whole, fraction = ""] = formatGroupedAmount(value).split(".");
  return [whole, fraction];
}

// ── Hero: ring = what is left of the current phase, from its real start and end ──
const RING_LENGTH = 603.19; // 2π × 96
const ribbon = computed(() => {
  if (freeTrial.authorityServerState === "EXTENDED") return t.value.trial.countdownExtendedRibbon;
  return isGrace.value ? t.value.trial.countdownGraceRibbon : t.value.trial.countdownActiveRibbon;
});
const ringOffset = computed(() => {
  const start = isGrace.value ? freeTrial.expiresAt : freeTrial.startedAt;
  const end = isGrace.value ? freeTrial.graceEndsAt : freeTrial.expiresAt;
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
  const at = isGrace.value ? freeTrial.graceEndsAt : freeTrial.expiresAt;
  if (at === null) return "";
  return fmt(isGrace.value ? detail.value.keptUntil : purchase.value.heroTermUntil, { time: formatTrialDeadline(at, dateLocale()) });
});
// Both counts follow the live source: a tick or quote re-read during the 900 ms entrance must not cut it short.
const earnedShown = useCountUp(() => (isActiveCycle.value && !authorityScreenUnavailable.value ? shadowUSD.value : null), { follow: true });
const earnedParts = computed<[string, string]>(() => (visibility.hidden ? [visibility.mask(0), ""] : amountParts(earnedShown.value ?? 0)));

// ── Quote ticket ──
const discountTotal = computed(() => {
  const quote = purchaseQuote.value;
  return quote ? cents(quote.promoDiscountUSD + quote.earlyDiscountUSD + quote.offsetUSD) : 0;
});
const totalShown = useCountUp(() => (purchaseQuote.value && !authorityScreenUnavailable.value
  ? cents(discountTotal.value + purchaseQuote.value.remainderUSD) : null), { follow: true });
const totalParts = computed<[string, string]>(() => (visibility.hidden ? [visibility.mask(0), ""] : amountParts(totalShown.value ?? 0)));
const dueParts = computed(() => amountParts(purchaseQuote.value?.amountUSD ?? 0));
const deviceName = computed(() => trialProduct.value?.name ?? cfg.value.trialProductName);
const buyTitle = computed(() => {
  if (earlyQuote.value) return fmt(detail.value.earlyTitle, { device: deviceName.value, amount: usdShort(earlyQuote.value.earlyDiscountUSD) });
  return isGrace.value ? detail.value.graceTitle : purchase.value.accruedTitle;
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
  const pct = (cfg.value.discountRate * 100).toFixed(0);
  const cap = cfg.value.discountCapUSD;
  return cap === null ? fmt(detail.value.promoRowNoCap, { pct }) : fmt(detail.value.promoRow, { pct, cap: usdShort(cap) });
});
const conversionRefunded = computed(() => remoteApiEnabled && status.value === "converted"
  && freeTrial.authoritativeConversion?.refunded === true);

const w = computed(() => t.value.trial);
const idleBody = computed(() => freeTrial.authorityStatus === "mock" || freeTrial.authorityServerState !== null
  ? fmt(w.value.idleBody, { n: String(cfg.value.trialDays) })
  : "");
const offsetRemainderNote = computed(() => fmt(w.value.offsetRemainderNote, { remainder: visibility.mask(formatAmount(trialOffset.value.remainderUSD)) }));
const trialBuyCtaText = computed(() => {
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
const claimVisible = computed(() => status.value === "none" || (status.value === "ended" && canStartNow.value));
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
  if (r === "product-unavailable") return t.value.store.trialProductUnavailable;
  if (r === "capacity-full") return lifecycle.value.capacityFull;
  return w.value.eligReasonClosed;
});
const barRetry = computed(() => (isActiveCycle.value || status.value === "ended") && !claimVisible.value && productCatalogState.status === "error");
// The one line above the bottom button that says why it is disabled.
const barNote = computed(() => {
  if (claimVisible.value) return canStartNow.value ? "" : ineligibleReasonText.value;
  if ((isActiveCycle.value || status.value === "ended") && trialProductUnavailable.value && productCatalogState.status === "ready") {
    return t.value.store.trialProductUnavailable;
  }
  return "";
});

// Rules sheet (spec ⑥: pre-purchase offset / no cash-out / post-purchase
// remainder → balance / expiry).
const rulesOpen = ref(false);
const rulesLines = computed(() => [
  cfg.value.trialOffsetCapUSD === null ? detail.value.rulesBeforeNoCap
    : fmt(w.value.rulesBefore, { cap: formatGroupedAmount(cfg.value.trialOffsetCapUSD) }),
  w.value.rulesNoCash,
  w.value.rulesAfter,
  ...(earlyQuote.value ? [
    fmt(lifecycle.value.rulesEarly, { discount: formatGroupedAmount(earlyQuote.value.earlyDiscountConfiguredUSD) }),
    lifecycle.value.rulesRefund,
  ] : []),
  w.value.rulesExpiry,
]);

function claim() {
  if (!canStartNow.value) return; // disabled CTA — reason line explains why
  useTrialClaimSheet().show();
}

// Conversion CTA → checkout. Trial pricing still derives from authoritative
// state (status ∈ active|grace ∧ product = trialProductId); the URL marker only
// controls safe return copy when the canonical catalogue omits the trial SKU.
function goCheckout() {
  if (authorityUnavailable.value || trialProductUnavailable.value) return;
  const productId = trialProductId.value;
  if (!productId) return; // applyAuthoritative already rejects unknown policy ids
  navTo(`/pages/store/checkout?product=${productId}&source=trial`);
}
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
  const orderNo = freeTrial.authoritativeConversion?.orderNo;
  if (orderNo) navTo(`/pages/store/order-detail?id=${encodeURIComponent(orderNo)}`);
}

const rulesGotStyle: CSSProperties = { marginTop: "18px", height: "48px", borderRadius: "999px", background: "var(--v5-brand)", color: "var(--v5-on-brand)", fontSize: "13px", fontWeight: 600 };

// 遮罩只拦指针不拦键盘:不接这一层,弹层打开后 Tab 会直接走到背景(那里有花钱的按钮),
// 且没有 Esc、关掉后焦点也回不到触发它的控件。
useDialogA11y(computed(() => rulesOpen.value), ".trs-root", () => { rulesOpen.value = false; }, true);
</script>

<style scoped>
.trial-read-state { display:flex;flex-direction:column;gap:16px;padding:24px 0;color:var(--v5-ink-3);font-size:13px; }
.trial-read-skeleton { display:flex;flex-direction:column;gap:14px; }
.trial-read-skeleton > view { height:24px;width:70%;border-radius:8px;background:var(--v5-surface-2); }
.trial-read-skeleton > view:first-child { height:100px;width:100%;border-radius:20px; }
.trial-read-retry { min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:999px;background:var(--v5-surface-2);color:var(--v5-ink);font:600 13px/20px var(--font-v5); }

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
.trial-ring__svg { position:absolute;inset:0; }
.trial-ring__track { stroke:color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.trial-ring__arc { stroke:var(--v5-tech-cyan);animation:trial-ring-draw .9s cubic-bezier(.16,1,.3,1) .15s both; }
.trial-state--grace .trial-ring__arc { stroke:var(--v5-warning); }
.trial-ring__full { stroke:var(--v5-tech-cyan); }
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
.trial-earned__value { font:600 44px/50px var(--font-amount);font-variant-numeric:tabular-nums;letter-spacing:-0.024em;white-space:nowrap; }
.trial-earned__unit { color:var(--v5-ink-3);font:500 15px/20px var(--font-v5); }
.trial-earned__uvt { margin-top:4px;color:var(--v5-nex-ink);font:500 15px/20px var(--font-v5);font-variant-numeric:tabular-nums;white-space:nowrap; }
.trial-earned__note { margin-top:8px;color:var(--v5-ink-3);font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.trial-dim { color:var(--v5-ink-3); }
.trial-unit-small { font-size:12px;line-height:16px; }

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
.trial-total__breakdown { display:block;color:var(--v5-ink-3);font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);font-variant-numeric:tabular-nums;text-wrap:pretty; }
.trial-total__line { display:flex;flex-wrap:wrap;align-items:baseline;column-gap:8px;margin-top:6px; }
.trial-total__label { font:500 13px/18px var(--font-v5); }
.trial-total__value { color:var(--v5-brand);font:600 32px/38px var(--font-amount);font-variant-numeric:tabular-nums;letter-spacing:-0.02em;white-space:nowrap; }
.trial-total__dec { opacity:.72; }
.trial-total__unit { color:var(--v5-ink-3);font-weight:500; }
.trial-total__uvt { color:var(--v5-nex-ink);font:500 15px/20px var(--font-v5);font-variant-numeric:tabular-nums;white-space:nowrap; }
.trial-rows { display:flex;flex-direction:column;gap:10px;margin-top:16px; }
.trial-row { display:flex;align-items:center;justify-content:space-between;gap:12px;font:400 13px/18px var(--font-v5);font-variant-numeric:tabular-nums; }
.trial-row__label { flex:1;min-width:0;color:var(--v5-ink-3);font:400 13px/18px var(--font-v5);font-variant-numeric:tabular-nums;text-wrap:pretty; }
.trial-row .trial-row__label { display:flex;flex-wrap:wrap;align-items:center;column-gap:6px;row-gap:2px; }
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
.trial-credit__sep { color:var(--v5-ink-4); }
.trial-credit__uvt { color:var(--v5-nex-ink); }
.trial-legacy-row { margin-top:10px; }
.trial-legacy-note { display:block;margin-top:8px;color:var(--v5-ink-3);font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);text-wrap:pretty; }

/* ── Open list rows under the ticket ── */
.trial-links { align-self:stretch;margin:20px 16px 0; }
.trial-link { display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;padding:0 2px;border-top:1px solid var(--v5-border);font:400 var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); }
.trial-link:active { opacity:.7; }
.trial-link:focus-visible { outline:2px solid var(--v5-brand);outline-offset:2px; }
.trial-link > svg { flex:none; }

/* ── Claim / terminal states ── */
.trial-slot { position:relative;flex:none;width:248px;height:248px; }
.trial-slot__ring { position:absolute;inset:0;border-radius:50%;border:2px dashed color-mix(in srgb, var(--v5-tech-cyan) 45%, transparent); }
:global([data-theme="light"] .trial-slot__ring) { border-color:color-mix(in srgb, var(--v5-tech-cyan) 55%, transparent); }
.trial-slot__machine { position:absolute;left:24px;top:20px;width:200px;height:200px; }
.trial-slot .trial-slot__tag { position:absolute;left:50%;bottom:-12px;padding:0 10px;transform:translateX(-50%); }
.trial-terminal-copy { display:flex;flex-direction:column;align-items:center;margin-top:28px;padding:0 24px;text-align:center; }
.trial-terminal-copy--claim { margin-top:36px; }
.trial-terminal-copy__title { font:var(--ui-type-hero-title-weight) var(--ui-type-hero-title)/var(--ui-type-hero-title-lh) var(--font-v5);text-wrap:balance; }
.trial-terminal-copy__body { margin-top:4px;color:var(--v5-ink-3);font:400 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5);text-wrap:pretty; }
.trial-terminal-copy__note { margin-top:8px;color:var(--v5-ink-3);font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);text-wrap:pretty; }

/* ── Bottom action bar (DS-30): the store purchase bar material ── */
.trial-bar { position:absolute;left:0;right:0;bottom:0;z-index:36;display:flex;flex-direction:column;padding:12px 16px calc(30px + env(safe-area-inset-bottom));background:var(--v5-sticky-bar-bg);box-shadow:inset 0 1px 0 var(--v5-sticky-bar-border);backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);animation:trial-bar-in .42s cubic-bezier(.16,1,.3,1) .3s both; }
.trial-bar--pair { flex-direction:row;flex-wrap:wrap;gap:12px; }
.trial-bar__note { margin:0 0 10px;color:var(--v5-ink-3);font:400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5);text-align:center;text-wrap:pretty; }
.trial-bar__retry { display:flex;justify-content:center;margin:-6px 0 4px; }
/* In-flow twin of the bar: 12 top + 48 button + 30 bottom (+ safe area) + a 20px gap, less the 40px the chassis already pads. */
.trial-bar-space { visibility:hidden;display:flex;flex-direction:column;padding:0 16px calc(70px + env(safe-area-inset-bottom)); }
.trial-bar-space__retry { height:44px; }
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
@keyframes trial-rise { from { opacity:0;transform:translateY(14px); } to { opacity:1;transform:none; } }
@keyframes trial-fade { from { opacity:0; } to { opacity:1; } }
@keyframes trial-ring-draw { from { stroke-dashoffset:603.19; } }
@keyframes trial-bar-in { from { transform:translateY(100%); } to { transform:none; } }
@keyframes trial-pop { 0% { opacity:0;transform:scale(.6); } 70% { opacity:1;transform:scale(1.08); } 100% { opacity:1;transform:scale(1); } }
@media (prefers-reduced-motion: reduce) {
  .trial-rise, .trial-glow, .trial-ring__arc, .trial-ring__check, .trial-bar { animation:none; }
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
  padding-bottom: calc(env(safe-area-inset-bottom) + 38px);
  box-sizing: border-box;
  max-height: calc(100% - var(--nx-overlay-top));
  overflow-y: auto;
  animation: trs-slide-up 0.36s cubic-bezier(0.16, 1, 0.3, 1);
}
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
