<!--
  Product detail — ported from Nexion-prototype/app/(main)/store/[productId]/
  {page.tsx + _client.tsx}. Dynamic [productId] → `?id=` query (onLoad).

  Wrapped in <AppChassis active="store">. Top→bottom:
    in-page header (back + product name) → Hero (ProductRender + badge +
    LiveSocialProof + name/tagline/mult + trust chips) → Vs-phone strip →
    ROI (qty stepper + 4-cell grid) → Hardware spec →
    Trust badges → FAQ accordion → sticky bottom Buy CTA.

  Phase-gated products (unlocksAtPhase not yet reached) render the shared
  <LockedProductCard> in place of the full page (mirrors ProductDetailGate).
  Spec-sheet labels and the FAQ are i18n copy. Trust material uses published
  disclosures; unavailable material is shown as unavailable.
-->
<template>
  <AppChassis active="store" class="product-detail-page">
    <!-- Chassis-nav pages (useSetPageHeader) don't get sub-page-header.vue's global
         24px .spv gap, so the nav→content breathing is supplied here once. -->
    <view style="color: var(--v5-ink); padding-top: 24px">
      <!-- Back + product name now live in the sticky chassis nav header
           (useSetPageHeader below) so they pin on scroll + frost content,
           mirroring the prototype's SetPageHeader. -->

      <view v-if="publicOnly" class="promotion promotion-main" data-testid="promotion-public-detail">
        <text class="promotion-title promotion-title--section">{{ activity?localized(activity.title,locale.code):promotionStatus==='ready'?t.promotion.disabled:promotionStatus==='error'?t.promotion.error:t.promotion.loading }}</text>
        <text v-if="!activity&&(promotionStatus==='loading'||promotionStatus==='idle')" class="promotion-copy" role="status">{{ t.promotion.loading }}</text>
        <text v-else-if="promotionStatus === 'error'" class="promotion-copy">—</text>
        <text v-else-if="activity&&promotionStatus==='ready'&&!promotionAvailable" class="promotion-copy">{{ localized(activity.eligibilityMessage,locale.code)||t.promotion.disabledNote }}</text>
        <PromotionProduct v-if="activity" :activity="activity" :product-no="id" expanded public-only />
        <view v-if="activity||voucherContext.voucherId" class="promotion-action primary" role="button" tabindex="0" @click="navTo('/pages/login/login?return='+encodeURIComponent(promotionDetailHref(id,activityId,voucherContext)))"><text>{{ t.promotion.signIn }}</text></view>
        <view class="promotion-link" role="button" tabindex="0" @click="navTo(promotionStoreHref())"><text>{{ t.promotion.allProducts }}</text></view>
      </view>
      <view v-else-if="catalogStatus === 'loading'" class="text-center" style="padding: var(--v5-space-10) var(--v5-space-4)">
        <text style="font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-3)">{{ t.store.catalogLoadingTitle }}</text>
      </view>

      <view v-else-if="catalogStatus === 'error'" class="text-center" style="padding: var(--v5-space-10) var(--v5-space-4)">
        <text class="block" style="font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-3); margin-bottom: var(--v5-space-3)">{{ t.store.catalogErrorTitle }}</text>
        <view data-testid="detail-catalog-retry" class="inline-flex items-center justify-center active:opacity-90" :style="catalogRetryStyle" role="button" tabindex="0" :aria-disabled="catalogRetrying" @click.stop="retryCatalog">
          <text>{{ catalogRetrying ? t.store.catalogLoadingTitle : t.store.catalogRetry }}</text>
        </view>
      </view>

      <!-- Product not found — plain floor text (matches checkout / order-detail). -->
      <view v-else-if="!product" class="text-center" style="padding: var(--v5-space-10) var(--v5-space-4)">
        <text style="font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-3)">{{ t.store.coProductNotFound }}</text>
      </view>

      <!-- Phase-gated → coming-soon lock card -->
      <template v-else-if="isLocked">
        <LockedProductCard :product="product" />
        <view aria-hidden style="height: 32px" />
      </template>

      <!-- The server has not certified the managed-service specification. Keep
           the detail readable, but never expose a purchase CTA for it. -->
      <template v-else-if="purchaseUnavailable">
        <view class="mx-4 rounded-2xl border" style="padding: var(--v5-space-6); border-color: var(--v5-border); background: var(--v5-surface)">
          <text class="block" style="font-size: 15px; font-weight: 600; color: var(--v5-ink)">{{ (product.name) }}</text>
          <text class="block" style="margin-top: var(--v5-space-2); font-size: var(--ui-type-list-subtitle); line-height: 1.6; color: var(--v5-ink-3)">{{ t.store.specUnavailable }}</text>
        </view>
        <view aria-hidden style="height: 32px" />
      </template>

      <!-- Full detail -->
      <template v-else>
        <!-- === Section 1: Hero === -->
        <!-- Tinted brand: the hero's colour used to come from a three-layer aurora wash. -->
        <view class="mx-4 nx-glass-card nx-tint overflow-hidden relative detail-hero" :class="{ 'detail-hero--credit': trialCreditEntry }" style="--nx-tint: var(--v5-brand)">

          <view class="relative border-b" style="border-color: var(--v5-border)">
            <ProductRender class="detail-product-render" :product-id="product.id" :tier="product.tier" :image-url="product.imageUrl" :video-url="product.videoUrl" />
            <ProductBadge v-if="copy.badge" :label="copy.badge" :kind="copy.badgeKind" detail />
            <!-- Live activity danmaku -->
            <LiveSocialProof :product="product" :placement="trialCreditEntry ? 'top-right' : 'bottom-left'" />
          </view>

          <view class="detail-summary relative">
            <text class="detail-summary__name">{{ product.name }}</text>
            <text class="detail-summary__tagline">{{ copy.tagline }}</text>

            <!-- Trial credit can buy this product (PLAN §2.3): an in-card info block (01 §1.3) that opens the trial detail with
                 this product chosen. The amount is the server quote for one unit, never recalculated here. -->
            <view v-if="trialCreditEntry" class="detail-trial-credit" data-testid="detail-trial-credit" role="link" tabindex="0"
              :aria-label="trialCreditEntry.ariaLabel" @click="openTrialCredit" @keydown.enter.prevent="openTrialCredit">
              <view class="detail-trial-credit__copy">
                <text class="detail-trial-credit__title">{{ t.store.buyWithTrialCredit }}</text>
                <text class="detail-trial-credit__note">{{ trialCreditEntry.limit }}</text>
              </view>
              <text class="detail-trial-credit__amount" aria-hidden="true"><text class="detail-trial-credit__currency">$</text>{{ trialCreditEntry.whole }}<text class="detail-trial-credit__fraction">{{ trialCreditEntry.fraction }}</text></text>
              <svg class="detail-trial-credit__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </view>

            <view class="detail-sales-proof">
              <view class="detail-sales-stat detail-sales-stat--sold">
                <view class="detail-sales-stat__value-row">
                  <text class="detail-sales-stat__value font-mono-tabular">{{ soldText }}</text>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                </view>
                <text class="detail-sales-stat__label">{{ t.store.liveProof.cumulativeSalesLabel }}</text>
              </view>
              <view v-if="stockUnavailable || (!isShare && product.stock != null && product.stock > 0)" class="detail-sales-stat detail-sales-stat--stock">
                <text v-if="stockUnavailable" class="detail-sales-stat__status">{{ t.store.temporarilyOutOfStock }}</text>
                <template v-else>
                  <text class="detail-sales-stat__value font-mono-tabular">{{ product.stock }}</text>
                  <text class="detail-sales-stat__label">{{ t.store.weeklyStockLabel }}</text>
                </template>
              </view>
            </view>
            <view v-if="computePointsLine" class="detail-compute-points">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="2.6" /><circle cx="5" cy="19" r="2.6" /><circle cx="19" cy="19" r="2.6" /><path d="M12 7.6v4.4M12 12l-5.2 5M12 12l5.2 5" /></svg>
              <text>{{ computePointsLine.before }}<text class="detail-compute-points__value">{{ computePointsLine.value }}</text>{{ computePointsLine.after }}</text>
            </view>
          </view>
        </view>

        <view v-if="voucherContext.voucherId" class="mx-4 mt-3 promotion promotion-flat"><text class="promotion-title">{{ t.promotion.eventVoucher }}</text><text class="promotion-copy">{{ t.promotion.eventVoucherTerms }}</text></view>
        <view v-if="activityId" class="mx-4 mt-3 promotion promotion-flat" data-testid="detail-promotion">
          <text class="promotion-title">{{ activity?t.promotion.gift:promotionStatus==='ready'?t.promotion.disabled:promotionStatus==='error'?t.promotion.error:t.promotion.loading }}</text>
          <text v-if="!activity&&(promotionStatus==='loading'||promotionStatus==='idle')" class="promotion-copy" role="status">{{ t.promotion.loading }}</text>
          <text v-else-if="promotionStatus === 'error'" class="promotion-copy">—</text>
          <text v-else-if="activity&&promotionStatus==='ready'&&(!promotionAvailable||!activity.productNos.includes(product.id))" class="promotion-copy">{{ localized(activity.eligibilityMessage,locale.code)||t.promotion.disabledNote }}</text>
          <PromotionProduct v-if="activity" :activity="activity" :product-no="product.id" expanded />
          <view v-if="bundleActivityVisible" :aria-disabled="!canBundleActivity" class="promotion-link" role="button" tabindex="0" @click="canBundleActivity && navTo(promotionBundleHref(activityId,[{productNo:product.id,quantity:qty}]))"><text>{{ t.promotion.bundle }}</text></view>
          <view class="promotion-link" role="button" tabindex="0" @click="navTo(promotionDetailHref(id))"><text>{{ t.promotion.ordinary }}</text></view>
        </view>

        <!-- Estimated returns: every product uses the Cloud Share card (user 2026-11-23), except a detail opened from an
             activity, which is an activity page (04 §4.6). Each figure shows the catalog's range when it sends one and its
             single estimate otherwise; all follow the selected quantity. -->
        <view v-if="!activityId" class="mx-4 mt-3 nx-glass-card detail-returns" data-testid="detail-returns">
          <text class="detail-returns__title">{{ t.bundle.estimatedDaily }}</text>
          <text v-if="isShare" class="detail-returns__description">{{ t.store.shareFlexibleDescription }}</text>
          <view class="detail-returns__rows">
            <view class="detail-returns__row">
              <text class="detail-returns__label">USDT</text>
              <view class="detail-returns__value detail-returns__value--key">
                <text v-for="part in dailyUsdtParts ?? ['—']" :key="part">{{ part }}</text>
              </view>
            </view>
            <view class="detail-returns__row">
              <text class="detail-returns__label">UVT</text>
              <view class="detail-returns__value">
                <text v-for="part in dailyUvtParts ?? ['—']" :key="part">{{ part }}</text>
              </view>
            </view>
            <view class="detail-returns__row">
              <text class="detail-returns__label">{{ t.store.detMonthly }}</text>
              <view class="detail-returns__value">
                <template v-if="monthlyUsdtParts">
                  <text v-for="(part, index) in monthlyUsdtParts" :key="part">{{ part }}<text v-if="index === monthlyUsdtParts.length - 1" class="detail-returns__unit">{{ usdtUnitSuffix }}</text></text>
                </template>
                <text v-else>—</text>
              </view>
            </view>
          </view>
          <text class="detail-returns__note">{{ isShare ? t.store.shareDailyEstimateNote : t.store.deviceDailyEstimateNote }}</text>
        </view>

        <!-- === Section 5: Hardware spec === -->
        <view style="padding: 22px 16px 4px"><SectionHeader :title="t.store.detHardware" /></view>
        <SpecTable :rows="hardwareSpecs" />
        <view v-if="copy.taskLevels" class="mx-4" style="padding: 12px 16px; font-size: 12px; line-height: 1.5; overflow-wrap: break-word; color: var(--v5-ink-3)"><text>{{ copy.taskLevels }}</text></view>


        <!-- === Section 7: Trust material === -->
        <template v-if="!remoteApiEnabled">
          <view style="padding: 22px 16px 4px"><SectionHeader :title="t.store.detTrustedBy" /></view>
          <view class="mx-4 nx-glass-card" :style="trustCardStyle">
            <text class="block" :style="trustBodyStyle">{{ t.store.relatedMaterialsEmpty }}</text>
          </view>
        </template>
        <template v-else>
          <view style="padding: 22px 16px 4px"><SectionHeader :title="productTrustTitle" /></view>
          <view class="mx-4 nx-glass-card" :style="trustCardStyle" data-testid="product-trust-material">
            <view v-if="productSpecDocument" class="active:opacity-70" :style="trustDisclosureRowStyle"
              role="link" tabindex="0" :aria-label="productSpecDocument.title"
              @click="openTrustUrl(productSpecDocument.url)" @keydown.enter.prevent="openTrustUrl(productSpecDocument.url)">
              <text class="block" :style="trustDisclosureTitleStyle">{{ productSpecDocument.title }}</text>
              <text class="block nx-after-external" :style="trustLinkStyle">{{ t.store.viewRelatedMaterial }}</text>
            </view>
            <text v-else-if="!hasTrustSnapshot && (trustStatus === 'loading' || trustStatus === 'idle')" class="block" :style="trustBodyStyle">{{ t.trust.loadingDisclosure }}</text>
            <template v-else-if="hasTrustSnapshot && productAuditRows.length">
              <view v-for="row in productAuditRows" :key="row.Primary" class="active:opacity-70" :style="trustDisclosureRowStyle"
                role="link" tabindex="0" :aria-label="row.Primary"
                @click="openTrustUrl(row.Url)" @keydown.enter.prevent="openTrustUrl(row.Url)">
                <text class="block" :style="trustDisclosureTitleStyle">{{ row.Primary }}</text>
                <text class="block" :style="trustBodyStyle">{{ row.Secondary }}</text>
                <text class="block nx-after-external" :style="trustLinkStyle">{{ t.trust.latest }}</text>
              </view>
            </template>
            <template v-else>
              <text class="block" :style="trustBodyStyle">{{ !hasTrustSnapshot && trustStatus === 'error' ? '—' : t.store.relatedMaterialsEmpty }}</text>

            </template>
          </view>
        </template>

        <!-- === Section 8: FAQ accordion === -->
        <view class="detail-faq mx-4" :style="faqCardStyle">
          <text class="block" style="padding-top: 14px; font-size: 13px; font-weight: 400; color: var(--v5-ink-2)">{{ t.store.detFaq }}</text>
          <view v-for="(f, i) in faqs" :key="i" :style="faqItemStyle(i)">
            <view class="w-full flex items-center justify-between text-left active:opacity-80" :style="faqQStyle" role="button" tabindex="0" :aria-label="f.q" :aria-expanded="openFaq === i" @click.stop="toggleFaq(i)">
              <text class="flex-1" style="padding-right: 8px">{{ f.q }}</text>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" :style="{ transform: openFaq === i ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }"><path d="m9 18 6-6-6-6" /></svg>
            </view>
            <view v-if="openFaq === i" style="padding-bottom: 12px; padding-right: 24px; margin-top: -4px">
              <text style="font-size: 12px; font-weight: 400; color: var(--v5-ink-2); line-height: 1.625; white-space: pre-line">{{ f.a }}</text>
            </view>
          </view>
        </view>

        <!-- Bottom spacer — clears the chassis-level <StickyCtaBar> (+24 for its one-line trial-credit note) (driven by
             useStickyCTA below; renders inside the bezel, absolute not fixed). -->
        <view aria-hidden data-testid="detail-cta-clearance" :style="{ height: `calc(${trialCreditEntry ? 204 : 180}px + env(safe-area-inset-bottom))`, flexShrink: 0 }" />
      </template>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { foregroundReadAllowed } from "@/lib/foreground-read";
function formatAmount(value: Parameters<typeof formatPlainAmount>[0]): string {
  return formatPlainAmount(value).replace(/\B(?=(\d{3})+\.)/g, ",");
}
import { formatAmount as formatPlainAmount, formatGroupedAmount } from "@/lib/amount-display";
import { productDailyEstimateRange, productDailyUvtRange } from "@/lib/product-estimates";
import { estimateRangeParts, formatEstimateRange } from "@/lib/estimate-display";
import { navTo, takeNavigationParameters } from "@/lib/route";
import { ref, computed, watch, onActivated, onDeactivated, onUnmounted, nextTick, type CSSProperties } from "vue";
import { onLoad, onHide, onShow, onUnload } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import SectionHeader from "@/components/store/section-header.vue";
import ProductRender from "@/components/store/product-render.vue";
import PromotionProduct from '@/components/promotion/promotion-product.vue';
import { usePromotionContext } from '@/composables/use-promotion-context';
import { promotionBundleHref,promotionCheckoutHref,promotionDetailHref,promotionStoreHref,canPreviewPromotion,voucherEntryContext,type VoucherEntryContext } from '@/lib/promotion-entry';
import { localized } from '@/lib/promotion-display';
import LiveSocialProof from "@/components/store/live-social-proof.vue";
import SpecTable from "@/components/store/spec-table.vue";
import LockedProductCard from "@/components/store/locked-product-card.vue";
import { useT } from "@/i18n/use-t";
import { useEarnConfig } from "@/store/earn-config";
import { useLocaleStore } from "@/store/locale";
import { storeHeatFigure } from "@/lib/platform-stats";
import { fmt } from "@/i18n/format";
import { formatComputePoints } from "@/i18n/compute-points";
import { getProduct, type Product } from "@/mock/products";
import { useProductPhase } from "@/composables/use-product-phase";
import { isProductAvailable, productOutOfStock } from "@/store/product-availability";
import { isBundleHardwareAvailable } from "@/store/bundle-catalog-guard";
import { useSetPageHeader } from "@/composables/use-page-header";
import { useStickyCTA } from "@/store/sticky-cta-bar";
import { warrantyMonths } from "@/lib/warranty-months";
import { productCopy, specRow, specText, type SpecRow } from "@/lib/product-copy";
import { productCatalogPresentation, productCatalogState, refreshProductCatalog } from "@/store/product-catalog";
import { useApp } from "@/store/app";
import { refreshServerProductPhase } from "@/store/server-product-phase";
import { dayOnePageObservationApi, h3ObservationApi, remoteApiEnabled, sessionVault } from "@/api/runtime";
import { toast } from "@/store/ui";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import { authenticatedPageObservationReporter } from "@/lib/authenticated-page-observation";
import { reportDayOnePageObservation } from "@/lib/day-one-page-observation";
import { usePurchaseGate } from "@/composables/use-purchase-gate";
import { useRemotePurchaseEligibility } from "@/store/purchase-eligibility";
import { monthlyQuotaExhausted, purchaseEligibilityUnlockHref, resolvePurchaseEligibilityMessage } from "@/lib/purchase-eligibility-copy";
import type { TrustLocale } from "@/api/trust-section-api";
import { trustNumberedRows } from "@/lib/trust-fields";
import { usePublishedTrust } from "@/composables/use-published-trust";
import { serverLanguage } from "@/i18n";
import ProductBadge from "@/components/store/product-badge.vue";
import { useTrialCreditOption, useTrialCreditOptionsRead } from "@/composables/use-trial-credit-option";
import { useFreeTrial } from "@/store/free-trial";
import { resolveTrialCheckoutProductId } from "@/store/trial-config";
import { useTrialCheckout } from "@/store/trial-checkout";
import { originalTrialCheckoutHref } from "@/lib/trial-topup-return";
import { trialExternalPaymentActive } from "@/store/purchase-payment";
import { trialOptionReadFailed, useTrialPurchaseOptions } from "@/store/trial-purchase-options";
import { trialPurchaseReasonMessage } from "@/lib/trial-purchase-reason";
import { useTrialDetailCopy } from "@/i18n/trial-detail";
import { useTrialLifecycleCopy } from "@/i18n/trial-lifecycle";
import { useTrialPurchaseCopy } from "@/i18n/trial-purchase";
import { registerActivePageRefresh } from "@/lib/active-page-refresh";

const t = useT();
const locale = useLocaleStore();
const phase = useProductPhase();
const trustLanguage = computed<TrustLocale>(() => serverLanguage(locale.code));
const { sections: trustSections, status: trustStatus, hasSnapshot: hasTrustSnapshot, refresh: refreshTrust } = usePublishedTrust();
function refreshTrustMaterial() { if (trustStatus.value === 'error') void refreshTrust(true); }
useAutoRecovery({ failed: () => trustStatus.value === "error", retry: () => refreshTrust(true) });

const app = useApp();
const id = ref("");
const activityId=ref('');
const voucherContext=ref<VoucherEntryContext>({});
const publicOnly=computed(()=>{void app.accountKey;void app.accountBindingEpoch;return !sessionVault.read();});
const {activity,status:promotionStatus,available:promotionAvailable,refresh:refreshPromotion}=usePromotionContext(activityId, true);
useAutoRecovery({ failed: () => promotionStatus.value === "error", retry: () => refreshPromotion() });
const catalogRetrying = ref(false);
const stickyPageVisible = ref(true);
let detailPageVisible = false;
let detailObservationEpoch = 0;
let detailFactsEpoch = 0;

function invalidateDetailFacts(): void {
  detailFactsEpoch += 1;
}

async function refreshDetailFacts(): Promise<void> {
  if(publicOnly.value)return;
  const readEpoch = ++detailFactsEpoch;
  const accountScope = captureAccountScope();
  // A forced catalog result advances the commerce runtime on both success and
  // failure. Trust must begin after that boundary or its valid public response
  // is discarded by the Trust generation fence.
  await refreshProductCatalog(true);
  await nextTick();
  if (readEpoch !== detailFactsEpoch || !isCurrentAccountScope(accountScope)) return;
  await Promise.all([
    remoteApiEnabled ? app.refreshRemoteFleet(app.captureRemoteAccountRequest(), { coalesce: true }) : Promise.resolve(true),
    earnConfig.refresh(),
    refreshServerProductPhase(true),
    remoteApiEnabled ? refreshTrust(true) : Promise.resolve(true),
  ]);
  if (readEpoch !== detailFactsEpoch || !isCurrentAccountScope(accountScope)) return;
  void observeCanonicalProductDetail();
}

onLoad(async (options) => {
  const o = (options || {}) as Record<string, string>;
  const fallback = takeNavigationParameters("/pages/store/detail", ["id"]);
  id.value = (fallback.get('id') || o.id || "").trim();
  activityId.value=(o.activityId||fallback.get('activityId')||'').trim();
  voucherContext.value=voucherEntryContext({voucherId:o.voucherId||fallback.get('voucherId')||undefined,upgradeActivityId:o.upgradeActivityId||fallback.get('upgradeActivityId')||undefined});
  if(voucherContext.value.voucherId)activityId.value='';
  await refreshDetailFacts();
});

onShow(() => {
  detailPageVisible = true;
  void refreshDetailFacts();
});

watch([() => app.accountKey, () => app.accountBindingEpoch], () => {
  invalidateDetailFacts();
  if (detailPageVisible && remoteApiEnabled && app.accountKey !== "default") void refreshDetailFacts();
});

async function retryCatalog() {
  if (catalogRetrying.value) return;
  catalogRetrying.value = true;
  try {
    await refreshDetailFacts();
  } finally {
    catalogRetrying.value = false;
  }
}

const catalogStatus = computed(() => productCatalogState.status);
// PRODUCTS is a plain compatibility array: its server replacement cannot
// invalidate a computed that first ran while the cold-start catalog was empty.
const product = computed<Product | undefined>(() => publicOnly.value || !id.value || (remoteApiEnabled && catalogStatus.value !== "ready") ? undefined
  : remoteApiEnabled
    ? productCatalogPresentation.value?.products.find((entry) => entry.id === id.value)
    : getProduct(id.value));

async function observeCanonicalProductDetail(): Promise<void> {
  const canonicalProduct = product.value;
  if (!remoteApiEnabled || !detailPageVisible || catalogStatus.value !== "ready" || !canonicalProduct?.id) return;

  const scope = captureAccountScope();
  const pageEpoch = detailObservationEpoch;
  await nextTick();
  if (
    !detailPageVisible
    || pageEpoch !== detailObservationEpoch
    || catalogStatus.value !== "ready"
    || product.value !== canonicalProduct
  ) return;

  void authenticatedPageObservationReporter.report({
    subject: `store-detail:${canonicalProduct.id}`,
    scope,
    session: sessionVault.read(),
    visible: () => detailPageVisible && pageEpoch === detailObservationEpoch,
    isCurrent: isCurrentAccountScope,
    submit: () => h3ObservationApi.productDetail(canonicalProduct.id),
  });
  if (canonicalProduct.id !== "stellarbox-s1" || canonicalProduct.productType === "SHARE"
    || !Number.isFinite(canonicalProduct.price) || canonicalProduct.price <= 0
    || !Number.isFinite(canonicalProduct.dailyEarn) || canonicalProduct.dailyEarn <= 0) return;
  void reportDayOnePageObservation("view_product_roi", {
    scope,
    session: sessionVault.read(),
    visible: () => detailPageVisible && pageEpoch === detailObservationEpoch,
    isCurrent: isCurrentAccountScope,
    submit: () => dayOnePageObservationApi.s1Roi(),
  });
}

watch([catalogStatus, () => product.value?.id], () => {
  void observeCanonicalProductDetail();
});

const isShare = computed(() => product.value?.productType === "SHARE");
const earnConfig = useEarnConfig();
// Localized SKU copy (tagline / badge). Empty strings until `id` resolves —
// both consumers are inside `v-if="product"`, so the blanks never render.
const copy = computed(() =>
  product.value
    ? remoteApiEnabled
      ? productCopy(t.value, product.value, true, locale.code)
      : productCopy(t.value, product.value, false, locale.code)
    : { tagline: "", badge: "", badgeKind: "custom" as const, taskLevels: "" },
);

const purchaseUnavailable = computed(() => product.value?.purchaseBlocked === true
  && !productOutOfStock(product.value));

// Phase gate: a product with unlocksAtPhase not yet reached shows the lock card.
const isLocked = computed(() => {
  const p = product.value;
  if (!p || purchaseUnavailable.value) return false;
  return !isProductAvailable(p, phase.value);
});

// Per-user purchase gate — local V-rank/team snapshots are mock-only. Remote
// mode consumes only the account-scoped server eligibility response.
const localPurchaseGate = remoteApiEnabled ? null : usePurchaseGate(product);
const { eligibility, retry: retryEligibility } = useRemotePurchaseEligibility(
  () => product.value?.id ?? "",
  () => stickyPageVisible.value && foregroundReadAllowed(),
);
const stockUnavailable = computed(() => productOutOfStock(product.value) || eligibility.value.outOfStock);
const purchaseEligibilityMessage = computed(() => resolvePurchaseEligibilityMessage(
  eligibility.value.status,
  eligibility.value.snapshot,
));
useAutoRecovery({
  active: () => stickyPageVisible.value,
  failed: () => remoteApiEnabled && !stockUnavailable.value && (eligibility.value.status === "error"
    || eligibility.value.status === "ready" && purchaseEligibilityMessage.value === "error"),
  retry: retryEligibility,
});
const purchaseGate = computed(() => remoteApiEnabled
  ? {
      gated: true,
      eligible: eligibility.value.status === "ready" && eligibility.value.eligible,
      soldOut: false,
      blocked: eligibility.value.status !== "ready" || !eligibility.value.eligible,
      remaining: null,
      conditions: [],
      unmet: [],
      progressPct: eligibility.value.status === "ready" && eligibility.value.eligible ? 1 : 0,
    }
  : localPurchaseGate!.gate.value);

// Sticky chassis nav header (back + centered product name) — replaces the old
// in-page back row so it pins on scroll + frosts content (mirrors prototype
// SetPageHeader). Getter form: title resolves once the product loads (onLoad).
useSetPageHeader(() => ({
  title: publicOnly.value ? (activity.value ? localized(activity.value.title,locale.code) : t.value.promotion.events)
    : catalogStatus.value === "loading" ? t.value.store.catalogLoadingTitle
    : catalogStatus.value === "error" ? t.value.store.catalogErrorTitle
      : product.value?.name ?? t.value.store.coProductNotFound,
  subtitle: undefined,
  backHref: activityId.value||voucherContext.value.voucherId ? promotionStoreHref(activityId.value,voucherContext.value) : "/store",
}));

// ── derived ROI math (mirrors page.tsx + _client.tsx) ──
const qty = ref(1);
const maxQuantity = computed(() => Math.min(activityId.value ? 100 : 6,
  product.value?.inventoryMode === "FINITE" ? product.value.stock ?? Infinity : Infinity));
watch(maxQuantity, max => { if (max > 0 && qty.value > max) qty.value = max; });
const openFaq = ref(0);

const dailyYield = computed(() => (product.value?.dailyEarn ?? 0) * qty.value);
const monthlyYield = computed(() => (product.value?.monthlyEstimateUsdt ?? (product.value?.dailyEarn ?? 0) * 30) * qty.value);
const annualYield = computed(() => dailyYield.value * 365);
const totalPrice = computed(() => (product.value?.price ?? 0) * qty.value);

// Preserve the prototype's four spec slots while taking values from E1.
// An operator-authored uptime is displayed as online rate, not an SLA guarantee.
const hardwareSpecs = computed<SpecRow[]>(() => {
  const p = product.value;
  if (!p) return [];
  const s = t.value.store;
  // A Cloud Share is a share of pooled compute, so it shows no video memory or power (user 2026-11-21).
  const months = warrantyMonths(p.warranty);
  const share = p.productType === "SHARE";
  return [
    { k: s.specGpu, v: specText(t.value, p.gpu, "—") },
    share ? null : { k: s.specVram, v: specText(t.value, p.vram, "—", "vram") },
    share ? null : { k: s.specPower, v: specText(t.value, p.power, "—", "power") },
    { k: s.specOnlineRate, v: specText(t.value, p.uptime, "—") },
    months === undefined ? specRow(s.specWarranty, p.warranty) : { k: s.specWarrantyDuration, v: months },
  ].filter((r): r is SpecRow => r !== null);
});

const bundleActivityVisible = computed(()=>(productCatalogPresentation.value?.products??[]).filter(p=>activity.value?.productNos.includes(p.id)&&isBundleHardwareAvailable(p,phase.value)).length>=2);
const canBundleActivity = computed(() => promotionAvailable.value && bundleActivityVisible.value);

const productAuditSection = computed(() => trustSections.value.find((section) => section.sectionKey === "auditsReserves"));
const productTrustTitle = computed(() => t.value.store.detTrustedBy);
const productAuditRows = computed(() => trustNumberedRows(productAuditSection.value?.fields ?? [], "document", ["Primary", "Secondary", "Url"] as const, trustLanguage.value)
  .filter((row) => safeTrustUrl(row.Url)));

const productSpecDocument = computed(() => {
  const title = product.value?.specDocumentTitle?.trim();
  const url = safeTrustUrl(product.value?.specDocumentUrl ?? "");
  return title && url ? { title, url } : null;
});

function safeTrustUrl(raw: string): string | null {
  const value = raw.trim();
  if (/^\/pages\/[A-Za-z0-9/_-]+$/.test(value)) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : null;
  } catch { return null; }
}
function openTrustUrl(raw: string) {
  const href = safeTrustUrl(raw);
  if (!href) { toast.error(t.value.trust.linkUnavailable); return; }
  if (href.startsWith("/")) { navTo(href); return; }
  let opened = false;
  // #ifdef H5
  opened = !!window.open(href, "_blank");
  // #endif
  // #ifndef H5
  const runtime = (globalThis as { plus?: { runtime?: { openURL: (url: string) => void } } }).plus?.runtime;
  if (runtime) { runtime.openURL(href); opened = true; }
  // #endif
  if (!opened) toast.error(t.value.trust.openFailed);
}
const faqs = computed(() => {
  const f = t.value.store.faq;
  return [f.location, f.withdraw, f.demand, ...(!isShare.value ? [f.refund] : [])];
});

// ── text helpers (toFixed / toLocaleString / fmt out of template) ──
const stockLow = computed(
  () => !isShare.value && product.value?.stock != null && product.value.stock > 0 && product.value.stock < 50,
);
// Store heat figure: exact under 100, the platform band from 100 (storeHeatFigure).
const soldText = computed(() => storeHeatFigure(product.value?.sold ?? 0, locale.code));
// Per-unit team compute points: a quiet product fact, not personal data, so the hide-stats eye does not mask it.
const computePointsLine = computed(() => {
  const points = product.value?.computePoints;
  if (!points) return null;
  const [before, after] = (isShare.value ? t.value.store.computePointsPerShare : t.value.store.computePointsPerUnit).split("{n}");
  return { before, value: formatComputePoints(points, locale.code).split(" ")[0], after };
});
const dailyEarnText = computed(() => formatAmount(product.value?.dailyEarn ?? 0));
// Estimates use the shared estimate format (estimate-display.ts): two significant figures, a range only when the
// catalog sends one. Each range splits only at its dash and the monthly unit stays on the last figure (06 §6.2).
// A Share without the server's daily range shows "—", never a figure derived from an annual rate.
function rangeParts(low: number, high: number, calculated = false): string[] {
  return estimateRangeParts(low, high, calculated).map((part, index) => index ? `–${part}` : part);
}
const usdtUnitSuffix = "\u00A0USDT";
const dailyEstimate = computed(() => product.value ? productDailyEstimateRange(product.value) : null);
const hasUsdtRange = computed(() => product.value?.dailyEstimateLowUsdt != null && product.value?.dailyEstimateHighUsdt != null);
const dailyUsdtParts = computed(() => dailyEstimate.value
  ? rangeParts(dailyEstimate.value.low * qty.value, dailyEstimate.value.high * qty.value, qty.value !== 1) : null);
// The server's range is monthly target × (1 ∓ band) ÷ 30, so × 30 gives the month back on the same basis;
// a single estimate keeps the server's monthly figure.
const monthlyUsdtParts = computed(() => {
  const estimate = dailyEstimate.value;
  if (!estimate) return null;
  return hasUsdtRange.value
    ? rangeParts(estimate.low * 30 * qty.value, estimate.high * 30 * qty.value, true)
    : rangeParts(monthlyYield.value, monthlyYield.value);
});
const dailyUvtParts = computed(() => {
  if (!product.value) return null;
  const uvt = productDailyUvtRange(product.value);
  return rangeParts(uvt.low * qty.value, uvt.high * qty.value, qty.value !== 1);
});
// One string in the tray: the range keeps together and moves to the next line as a whole (03 §3.6.1).
const dailyEstimateLine = computed(() => dailyEstimate.value ? fmt(t.value.store.detDailyEstimateLine, {
  n: formatEstimateRange(dailyEstimate.value.low * qty.value, dailyEstimate.value.high * qty.value, qty.value !== 1) }) : undefined);
const annualYieldText = computed(() => formatAmount(annualYield.value));
const monthlyPctText = computed(() =>
  totalPrice.value > 0 ? ((monthlyYield.value / totalPrice.value) * 100).toFixed(1) : "0",
);
const annualPctText = computed(() =>
  totalPrice.value > 0 ? ((annualYield.value / totalPrice.value) * 100).toFixed(0) : "0",
);
const priceText = computed(() => product.value ? `$${formatAmount(product.value.price * qty.value)}` : "-");

// Trial-credit entry (PLAN §2.3, R13): only on the plain product page, not an activity or voucher entry, whose buy
// button is not the full-price purchase the tray note describes.
const trialCreditReadVisible = () => stickyPageVisible.value && !publicOnly.value;
const trialCreditRead = useTrialCreditOptionsRead(trialCreditReadVisible);
watch(trialCreditReadVisible, (visible, _, onCleanup) => {
  if (visible) onCleanup(registerActivePageRefresh(trialCreditRead.refresh, "pages/store/detail"));
}, { immediate: true });
const trialCredit = useTrialCreditOption(() => product.value?.id);
const trialConfirmationOption = useTrialCreditOption(() => product.value?.id, true);
const trialLifecycleCopy = useTrialLifecycleCopy();
const trialDetailCopy = useTrialDetailCopy();
const trialPurchaseCopy = useTrialPurchaseCopy();
const freeTrial = useFreeTrial();
const trialCheckout = useTrialCheckout();
const trialOptions = useTrialPurchaseOptions();
const ownTrialClaim = computed(() => {
  const state = freeTrial.displayState;
  if (!remoteApiEnabled || !state?.claimNo || (state.status !== "active" && state.status !== "grace")
      || qty.value !== 1 || activityId.value || voucherContext.value.voucherId) return null;
  return resolveTrialCheckoutProductId(state.config.trialProductId) === product.value?.id ? state.claimNo : null;
});
const ownTrialOriginal = computed(() => {
  const original = trialCheckout.originalPurchase;
  return original?.claimNo === ownTrialClaim.value && original.device.productNo === product.value?.id ? original : null;
});
// A payment for this trial is in progress, on this device or another one in the list.
const ownTrialPaymentLocked = computed(() => {
  const claim = ownTrialClaim.value;
  return !!claim && (!!trialCheckout.originalPurchase || trialExternalPaymentActive(claim) || freeTrial.legacyConversionPending);
});
const ownTrialBlock = computed(() => {
  const claim = ownTrialClaim.value;
  if (!claim) return "";
  if (ownTrialPaymentLocked.value) return trialDetailCopy.value.lockNote;
  if (freeTrial.authorityClaimNo !== claim || freeTrial.authorityStatus !== "ready"
      || trialOptions.claimNo !== claim || trialOptions.current.status !== "ready")
    return t.value.store.purchaseEligibilityLoading;
  const option = trialOptions.current.options.find(row => row.isTrialProduct && row.productNo === product.value?.id);
  if (!option || trialOptionReadFailed(option)) return t.value.store.purchaseEligibilityLoading;
  return option.canBuy ? "" : trialPurchaseReasonMessage(t.value, option.reasonCode, locale.code) ?? trialDetailCopy.value.optionUnavailable;
});
const trialCreditEntry = computed(() => {
  const option = trialCredit.value;
  if (!option?.quote || activityId.value || voucherContext.value.voucherId) return null;
  const [whole, fraction] = formatGroupedAmount(option.quote.amountUSD).split(".");
  const limit = option.productType === "SHARE" ? t.value.store.trialCreditLimitShare : t.value.store.trialCreditLimitDevice;
  return { productNo: option.productNo, limit, whole, fraction: fraction === undefined ? "" : `.${fraction}`,
    ariaLabel: `${t.value.store.buyWithTrialCredit} · ${limit} · $${whole}${fraction === undefined ? "" : `.${fraction}`}` };
});
function openTrialCredit() {
  // The trial detail chooses this product from the query; that preselection is the trial-detail item's.
  if (trialCreditEntry.value) navTo(`/pages/me/trial?product=${encodeURIComponent(trialCreditEntry.value.productNo)}`);
}

function dec() {
  if (qty.value > 1) qty.value -= 1;
}
function inc() {
  if (qty.value < maxQuantity.value) qty.value += 1;
}
function toggleFaq(i: number) {
  openFaq.value = openFaq.value === i ? -1 : i;
}
// Chassis-level sticky bottom Buy CTA (replaces the old page-level fixed-position
// bar, which positioned against the viewport — wrong inside the bezel). useStickyCTA
// → the chassis-mounted <StickyCtaBar> renders it correctly (absolute). Re-syncs as
// product/qty resolve; cached deactivation and Uni unload also clear this page's CTA.
const sticky = useStickyCTA();
const stickyOwner = Symbol("store-detail");
sticky.activate(stickyOwner);
function publishStickyCTA() {
    if (!stickyPageVisible.value || (remoteApiEnabled && catalogStatus.value !== "ready")) {
      sticky.hide(stickyOwner);
      return;
    }
    if (!product.value || isLocked.value || (!ownTrialClaim.value && purchaseUnavailable.value)) {
      sticky.hide(stickyOwner);
      return;
    }
    if (!ownTrialClaim.value && stockUnavailable.value) {
      sticky.show({
        href: `/pages/store/detail?id=${product.value.id}`,
        amount: `${priceText.value}`,
        amountSubtext: t.value.store.temporarilyOutOfStock,
        buttonLabel: t.value.store.temporarilyOutOfStock,
        disabled: true,
        showTabBar: false,
      }, stickyOwner);
      return;
    }
    if(activityId.value){
      const allowed=promotionAvailable.value&&activity.value?.productNos.includes(product.value.id);
      if(!allowed){
        const warming = promotionStatus.value === 'loading' && canPreviewPromotion(activity.value) && !!activity.value?.productNos.includes(product.value.id);
        const label = warming ? activity.value?.eligibility === 'SIGN_IN_REQUIRED' ? t.value.promotion.signIn : t.value.store.cardBuyNow : t.value.promotion.unavailable;
        sticky.show({href:'/pages/store/detail?id='+encodeURIComponent(product.value.id),amount:`${priceText.value}`,amountSubtext:warming ? dailyEstimateLine.value : t.value.promotion.disabledNote,buttonLabel:label,disabled:true,showTabBar:false},stickyOwner);
        return;
      }
      if(activity.value?.eligibility==='SIGN_IN_REQUIRED'){
        sticky.show({href:'/pages/login/login?return='+encodeURIComponent(promotionCheckoutHref([{productNo:product.value.id,quantity:qty.value}],activityId.value)),amount:`${priceText.value}`,buttonLabel:t.value.promotion.signIn,showTabBar:false},stickyOwner);
        return;
      }
    }
    if (ownTrialBlock.value || (!ownTrialClaim.value && remoteApiEnabled
        && (eligibility.value.status !== "ready" || purchaseEligibilityMessage.value === "error"))) {
      const original = ownTrialOriginal.value;
      const continuing = original?.kind === "EXTERNAL" && original.status === "AWAITING_PAYMENT" ? original : null;
      const checkingBalance = original?.kind === "BALANCE" && original.status === "PROCESSING";
      sticky.show({
        href: continuing ? originalTrialCheckoutHref(continuing) : `/pages/store/detail?id=${product.value.id}`,
        // Beside the lock note the catalog price would read as the amount of that payment, also when it is for another device.
        amount: ownTrialPaymentLocked.value ? undefined : `${priceText.value}`,
        // Loading and silent recovery read the same to the user: the reason sits above the disabled button (03 §3.1, 04 §4.0).
        // A balance result still being read has nothing to press: the bar is the lone status capsule, as on trial detail and checkout.
        status: checkingBalance ? trialPurchaseCopy.value.coConfirming : undefined,
        note: checkingBalance ? undefined : ownTrialBlock.value || t.value.store.purchaseEligibilityLoading,
        buttonLabel: checkingBalance ? undefined : continuing ? t.value.orders.pendingContinue : t.value.store.cardBuyNow,
        disabled: !continuing,
        showTabBar: false,
      }, stickyOwner);
      return;
    }
    if (!ownTrialClaim.value && remoteApiEnabled && !eligibility.value.eligible) {
      const quotaDepleted = purchaseEligibilityMessage.value === "quotaDepleted";
      sticky.show({
        // A rank-only product has no quota tier; take the user to rank progression.
        href: quotaDepleted ? `/pages/store/detail?id=${product.value.id}` : purchaseEligibilityUnlockHref(eligibility.value.snapshot!, product.value.id),
        amount: `${priceText.value}`,
        // Quota used up: the reason sits above the disabled button and the button keeps its short label (03 §3.1, §3.4).
        // The monthly allowance (F4B) and the sale allowance (E1) each say which one ran out.
        note: quotaDepleted
          ? monthlyQuotaExhausted(eligibility.value.snapshot) ? t.value.store.purchaseMonthlyQuotaDepleted : t.value.store.purchaseEligibilityQuotaDepleted
          : undefined,
        amountSubtext: quotaDepleted ? undefined : t.value.store.purchaseEligibilityIneligible,
        buttonLabel: quotaDepleted ? t.value.store.cardBuyNow : t.value.store.gateLockedCta,
        disabled: quotaDepleted,
        showTabBar: false,
      }, stickyOwner);
      return;
    }
    // Purchase gate blocks → CTA routes to /team/quota with locked label, not checkout.
    if (!ownTrialClaim.value && purchaseGate.value.blocked) {
      sticky.show({
        href: `/pages/team/quota?product=${encodeURIComponent(product.value.id)}`,
        amount: `${priceText.value}`,
        amountSubtext: purchaseGate.value.soldOut
          ? t.value.store.gateSoldOut
          : t.value.store.purchaseEligibilityIneligible,
        buttonLabel: purchaseGate.value.soldOut
          ? t.value.store.gateSoldOut
          : t.value.store.gateLockedCta,
        showTabBar: false,
      }, stickyOwner);
      return;
    }
    sticky.show({
      href: ownTrialClaim.value ? `/pages/store/checkout?product=${product.value.id}&source=trial`
        : isShare.value || activityId.value || voucherContext.value.voucherId || qty.value > 1 ? promotionCheckoutHref([{productNo:product.value.id,quantity:qty.value}],activityId.value,voucherContext.value) : `/pages/store/checkout?product=${product.value.id}`,
      quantity: { value:qty.value,min:1,max:maxQuantity.value,decrease:dec,increase:inc },
      amount: `${priceText.value}`,
      amountSubtext: dailyEstimateLine.value,
      // With the trial-credit entry on this page, say once that this button is the plain full-price purchase (PLAN §2.3).
      note: trialCreditEntry.value ? t.value.store.plainBuyNote
        : trialConfirmationOption.value && !activityId.value && !voucherContext.value.voucherId
          ? trialLifecycleCopy.value.resultConfirming : undefined,
      buttonLabel: t.value.store.cardBuyNow,
      showTabBar: false,
    }, stickyOwner);
}
watch(
  [stickyPageVisible, catalogStatus, product, isShare, isLocked, purchaseUnavailable, stockUnavailable, priceText, dailyEarnText, dailyEstimateLine, purchaseGate, eligibility, purchaseEligibilityMessage,activityId,promotionStatus,promotionAvailable,activity,qty,maxQuantity,voucherContext,trialCreditEntry,trialConfirmationOption,ownTrialClaim,ownTrialBlock,ownTrialOriginal,ownTrialPaymentLocked],
  publishStickyCTA,
  { immediate: true },
);
function showDetailStickyCTA() {
  detailPageVisible = true;
  sticky.activate(stickyOwner);
  stickyPageVisible.value = true;
  publishStickyCTA();
}
function hideDetailStickyCTA() {
  detailPageVisible = false;
  detailObservationEpoch += 1;
  invalidateDetailFacts();
  stickyPageVisible.value = false;
  sticky.hide(stickyOwner);
}
onShow(showDetailStickyCTA);
onActivated(showDetailStickyCTA);
onHide(hideDetailStickyCTA);
onUnload(hideDetailStickyCTA);
onDeactivated(hideDetailStickyCTA);
onUnmounted(hideDetailStickyCTA);

// ─── styles ───
const catalogRetryStyle: CSSProperties = {
  minHeight: "36px",
  padding: "0 14px",
  borderRadius: "9999px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  fontSize: "13px",
  fontWeight: 600,
};
const heroCardStyle: CSSProperties = {
  background: "var(--v5-surface)",
  borderColor: "var(--v5-border)",
};
const multBadgeStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "20px",
  letterSpacing: "-0.024em",
  color: "var(--v5-brand-2)",
  whiteSpace: "nowrap",
};
const stepperStyle: CSSProperties = {
  borderRadius: "999px",
  border: "1px solid var(--v5-border)",
  background: "var(--v5-surface-2)",
  overflow: "hidden",
};
function qtyBtnStyle(disabled: boolean): CSSProperties {
  return {
    width: "36px",
    height: "36px",
    fontFamily: "var(--font-v5)",
    fontSize: "20px",
    fontWeight: 500,
    color: disabled ? "var(--v5-ink-4)" : "var(--v5-ink)",
    opacity: disabled ? 0.4 : 1,
  };
}
const qtyNumStyle: CSSProperties = {
  minWidth: "36px",
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "20px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.014em",
};
const trustCardStyle: CSSProperties = { padding: "var(--v5-space-4)" };
const mediaStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 500,
  fontSize: "var(--ui-type-list-subtitle)",
  color: "var(--v5-ink-2)",
};
const complianceChipStyle: CSSProperties = {
  padding: "var(--v5-space-1) 10px",
  borderRadius: "999px",
  background: "var(--v5-surface-2)",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--v5-ink-2)",
  letterSpacing: "-0.005em",
};
const trustDisclosureRowStyle: CSSProperties = { padding: "var(--v5-space-3) 0", borderBottom: "1px solid var(--v5-border)" };
const trustDisclosureTitleStyle: CSSProperties = { fontSize: "13px", fontWeight: 600, color: "var(--v5-ink)" };
const trustBodyStyle: CSSProperties = { marginTop: "4px", fontSize: "12px", lineHeight: 1.5, color: "var(--v5-ink-3)" };
const trustLinkStyle: CSSProperties = { marginTop: "6px", fontSize: "12px", fontWeight: 600, color: "var(--v5-brand)" };
const faqCardStyle: CSSProperties = {
  marginTop: "20px",
  padding: "0 16px",
  borderRadius: "var(--ui-radius-surface)",
  background: "var(--v5-surface)",
};
function faqItemStyle(i: number): CSSProperties {
  return { borderBottom: i < faqs.value.length - 1 ? "1px solid var(--v5-border)" : "none" };
}
const faqQStyle: CSSProperties = {
  padding: "var(--v5-space-3) 0",
  minHeight: "44px",
  boxSizing: "border-box",
  fontFamily: "var(--font-v5)",
  fontSize: "12px",
  fontWeight: 400,
  color: "var(--v5-ink-2)",
  letterSpacing: "-0.005em",
};


</script>
<style src="@/components/promotion/promotion.css"></style>
<style scoped>
.detail-summary { padding: var(--v5-space-5); }
/* The product name heads the detail hero: display-title role (10 §10.1, 26/34 600 at 390), -0.02em at 24px and up (01 §1.2). */
.detail-summary__name { display: block; overflow-wrap: break-word; color: var(--v5-ink); font: var(--ui-type-display-title-weight) var(--ui-type-display-title)/var(--ui-type-display-title-lh) var(--font-v5); letter-spacing: -0.02em; }
/* Chinese takes no negative tracking (01 §1.2). */
:lang(zh) .detail-summary__name { letter-spacing: 0; }
.detail-summary__tagline { display: block; margin-top: var(--v5-space-1); font-size: var(--ui-type-list-subtitle); line-height: var(--v5-type-body-s-lh); color: var(--v5-ink-3); }
/* Trial-credit entry: an in-card info block (01 §1.3: 12 radius, surface-2) laid out as a list row (10 §10.3: 64 high),
   title in the content-row list-title role, limit in the list-subtitle role, the quote as the card figure (10 §10.1, Montserrat
   per 01 §1.2) with the currency sign and decimals in supporting ink, chevron in disabled ink (03 §3.5). No scale on press. */
.detail-trial-credit { display: flex; align-items: center; gap: var(--v5-space-3); box-sizing: border-box; min-height: 64px; margin-top: var(--v5-space-4); padding: var(--v5-space-3) var(--v5-space-3) var(--v5-space-3) var(--v5-space-4); border-radius: 12px; background: var(--v5-surface-2); cursor: pointer; }
.detail-trial-credit:active { opacity: .6; }
.detail-trial-credit:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.detail-trial-credit__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.detail-trial-credit__title { color: var(--v5-ink); font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); overflow-wrap: break-word; }
.detail-trial-credit__note { color: var(--v5-ink-3); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); overflow-wrap: break-word; }
.detail-trial-credit__amount { flex: none; color: var(--v5-ink); font: var(--ui-type-card-figure-weight) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-amount); font-variant-numeric: tabular-nums; white-space: nowrap; }
.detail-trial-credit__currency, .detail-trial-credit__fraction { color: var(--v5-ink-3); }
.detail-trial-credit__currency { font-size: max(12px, .55em); }
.detail-trial-credit__chevron { flex: none; color: var(--v5-ink-4); }
.detail-sales-proof { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: var(--v5-space-6); margin-top: var(--v5-space-5); }
.detail-sales-stat { display: flex; flex-direction: column; gap: var(--v5-space-1); min-width: 0; }
.detail-sales-stat--sold { color: var(--v5-success); }
.detail-sales-stat--stock { align-items: flex-end; color: var(--v5-brand-2); text-align: right; }
.detail-sales-stat__value-row { display: flex; align-items: center; gap: var(--v5-space-2); min-width: 0; }
.detail-sales-stat__value-row svg { flex: none; }
.detail-sales-stat__value { font-size: var(--ui-type-metric-value); font-weight: var(--ui-type-metric-value-weight); line-height: var(--ui-type-metric-value-lh); overflow-wrap: break-word; }
.detail-sales-stat__label { color: var(--v5-ink-3); font: 400 var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); overflow-wrap: break-word; }
.detail-sales-stat__status { font: 500 var(--ui-type-list-subtitle)/var(--ui-type-metric-value-lh) var(--font-v5); overflow-wrap: break-word; }
/* A lone sales figure spans the row but keeps the figure-over-label stack of the two-column layout. */
.detail-sales-stat:only-child { grid-column: 1 / -1; }
.detail-compute-points { display: flex; align-items: flex-start; gap: 5px; margin-top: 14px; color: var(--v5-ink-3); font: 400 12px/16px var(--font-v5); }
.detail-compute-points svg { flex: none; margin-top: 2px; }
.detail-compute-points__value { margin: 0 2px; color: var(--v5-ink-2); font-family: var(--font-metric); font-weight: 500; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
/* Estimated returns: content card, 16px inset (01 §1.3), role variables only (10 §10.1). Two text weights and three
   sizes per card (10 §10.1): the title takes the subheading role (15, 500), figures the list-title size in JetBrains
   Mono like row prices (15, 500), text 400 at 13/12. Field names in supporting ink (01 §1.1.1 rule 1); the daily USDT
   figure is the card's one brand figure (rule 4). A detail opened from an activity is an activity page: no card (04 §4.6). */
.detail-returns { padding: var(--ui-space-inset); }
.detail-returns__title { display: block; color: var(--v5-ink); font: var(--ui-type-subheading-weight) var(--ui-type-subheading)/var(--ui-type-subheading-lh) var(--font-v5); }
.detail-returns__description { display: block; margin-top: var(--v5-space-1); color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.detail-returns__rows { display: flex; flex-direction: column; gap: var(--v5-space-3); margin: var(--v5-space-4) 0; }
.detail-returns__row { display: flex; align-items: baseline; justify-content: space-between; gap: var(--v5-space-3); }
.detail-returns__label { flex: none; color: var(--v5-ink-3); font: var(--ui-type-description-weight) var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
.detail-returns__value { display: flex; flex-wrap: wrap; justify-content: flex-end; min-width: 0; color: var(--v5-ink); text-align: right; font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-metric); font-variant-numeric: tabular-nums; }
/* A range breaks only at its dash, never inside a figure. */
.detail-returns__value text { white-space: nowrap; }
.detail-returns__value--key { color: var(--v5-brand); }
/* A unit under a 30px figure takes the supporting-numeral role in supporting ink (01 §1.2). */
.detail-returns__unit { color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.detail-returns__note { display: block; padding-top: var(--v5-space-3); border-top: 1px solid var(--v5-border); color: var(--v5-ink-3); font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); }
/* One outer corner clip; the catalog image and its pedestal keep their full size. */
.detail-hero :deep(.detail-product-render) { border-radius:0 !important; }
/* The trial-credit entry stays clear of the purchase tray: the art gives up the height the screen lacks, down to 216px,
   and down to 184px when less than 700px is visible (04 商城入口). 463 = header, name block with the entry and the tray
   with its note; Chinese needs 441. Lite has no native status bar above its header, so both sit 47px under the App's
   510/488, which still leaves the three-line Russian entry 16px above the tray at 384×686.
   The clamp() is the floor: 216px, stepping to 184px below a 699px visible height.
   No custom property: a dvh value inside one would void the vh fallback where dvh is unsupported. */
.detail-hero--credit :deep(.detail-product-render) { max-height:max(clamp(184px, calc(184px + (100vh - 699px) * 1000), 216px), calc(100vh - 463px)); max-height:max(clamp(184px, calc(184px + (100dvh - 699px) * 1000), 216px), calc(100dvh - 463px)); }
:lang(zh) .detail-hero--credit :deep(.detail-product-render) { max-height:max(clamp(184px, calc(184px + (100vh - 699px) * 1000), 216px), calc(100vh - 441px)); max-height:max(clamp(184px, calc(184px + (100dvh - 699px) * 1000), 216px), calc(100dvh - 441px)); }
.detail-hero :deep(.detail-product-render > [aria-hidden]:not(:first-child)) {
  background:linear-gradient(to top, var(--v5-content-surface) 0%, color-mix(in srgb, var(--v5-content-surface) 60%, transparent) 50%, transparent 100%) !important;
}
.detail-hero :deep(.detail-product-render .text-right > :last-child) { color:var(--v5-ink-2) !important; }
.detail-hero :deep(.detail-product-render :is(image, uni-image)) { animation:detail-machine-float 5s ease-in-out infinite; }
@keyframes detail-machine-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-4px); } }
.product-detail-page[data-page-visible="false"] :deep(.detail-product-render :is(image, uni-image)),
.product-detail-page[data-scrolling="true"] :deep(.detail-product-render :is(image, uni-image)) { animation-play-state:paused; }
@media (prefers-reduced-motion:reduce) {
  .detail-hero :deep(.detail-product-render :is(image, uni-image)) { animation:none; transform:none; }
}
.promotion-quantity-stepper { display:flex;align-items:center;border:1px solid var(--v5-border);border-radius:999px;overflow:hidden; }
.promotion-quantity-stepper view { min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;font-size:20px;background:var(--v5-surface-2); }
.promotion-quantity-stepper text { min-width:36px;text-align:center;font-variant-numeric:tabular-nums; }
.promotion-quantity-stepper [aria-disabled=true] { opacity:.4; }
</style>
