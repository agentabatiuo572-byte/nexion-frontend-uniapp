<!--
  Bundle checkout — ported from Nexion-prototype/app/(main)/store/bundle/page.tsx.
  Multi-product bundle builder for tiered discounts (2 items 5% / 3 items 8% /
  4+ items 12%). Sits parallel to /store/checkout (single-product flow).

  Top→bottom: in-page back header → Hero (tier-discount ladder, active tiers
  light up) → Items list (remove / clear) → Suggestions (tap to add) → Total
  summary (subtotal / discount / total / combined daily + checkout CTA).
  Reuses the bundle cart store (persisted) + products mock.

  Wrapped in <AppChassis active="store">; back + "Bundle" title live in the sticky
  chassis nav header via useSetPageHeader (mirrors the prototype's
  <SetPageHeader backHref="/store"/>, whose chassis Header fills in the route
  title headerTitles.storeBundle).

  结算分两档:
  - mock:余额直付——保留原型体验。
  - 远端:POST /api/orders/bundle 由服务端锁库存、计算阶梯折扣并创建一张 BUNDLE 订单；
    随后只能通过 UVEL 钱包扣款接口完成支付与设备激活，不拉起第三方收银台。
    客户端只展示预估，最终金额以服务器回执为准，结果未知时复用同一幂等键。
-->
<template>
  <AppChassis active="store">
    <PromotionBundle v-if="promotionActivityId" :key="promotionActivityId" ref="promotionBundle" :activity-id="promotionActivityId" :initial-items="promotionInitialItems" />
    <template v-else>
    <!-- Chassis-nav pages (useSetPageHeader) don't get sub-page-header.vue's global
         24px .spv gap, so the nav→content breathing is supplied here once. -->
    <view class="pb-6" style="color: var(--v5-ink); padding-top: 24px">
      <!-- Back + "Bundle" title now live in the sticky chassis nav header
           (useSetPageHeader below), mirroring the prototype's <SetPageHeader>. -->

      <!-- Remote and explicit sandbox catalogs start empty. Do not render the
           compatibility PRODUCTS array until the authoritative snapshot is
           ready; a cold first frame must never look like a real quote. -->
      <view v-if="catalogStatus === 'loading' || policyStatus === 'loading'" data-testid="bundle-catalog-loading" class="nx-glass-card mx-4" :style="catalogStateStyle">
        <text class="block" :style="catalogStateTitleStyle">{{ t.store.catalogLoadingTitle }}</text>
        <text class="block mt-1" :style="catalogStateBodyStyle">{{ t.store.catalogLoadingBody }}</text>
      </view>
      <EmptyState v-else-if="catalogStatus === 'error' || policyStatus === 'error'" kind="recoverable-error" :title="t.store.catalogErrorTitle" :desc="t.store.catalogErrorBody" :cta-label="t.store.catalogRetry" @cta="retryCatalog" />
      <template v-else>

      <view v-if="receiptWriteFailure" class="nx-glass-card mx-4 rounded-2xl text-center" :style="receiptFailureCardStyle">
        <text class="block" :style="catalogStateTitleStyle">{{ t.errors.billMissingTitle }}</text>
        <text class="block mt-1" :style="catalogStateBodyStyle">{{ t.errors.billMissingMsg }}</text>
        <view class="inline-flex mt-3 active:opacity-70" role="button" tabindex="0" :style="catalogRetryStyle" :aria-disabled="receiptRetrying" @click="retryReceiptWrite" @keydown="activate($event, retryReceiptWrite)">
          <text>{{ receiptRetrying ? t.store.catalogLoadingTitle : t.store.catalogRetry }}</text>
        </view>
      </view>
      <template v-else>

      <!-- Hero — the page's focal card, tinted brand (its colour used to come from an aurora wash);
           the total card below takes a brand-2 tint from its old corner glow. -->
      <view class="nx-tint mx-4 relative overflow-hidden" style="--nx-tint: var(--v5-brand); padding: 18px; border-radius: 20px">
        <view class="relative">
          <view class="flex items-center" style="gap: 6px; margin-bottom: 8px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>
            <text :style="heroLabelStyle">{{ t.bundle.heroLabel }}</text>
          </view>
          <text class="block" :style="heroTitleStyle">{{ t.bundle.heroTitle }}</text>
          <view class="grid grid-cols-3 gap-2" style="margin-top: 14px">
            <view v-for="tier in tiersReversed" :key="tier.minItems" class="p-2 text-center" :style="tierCellStyle(tier)">
              <text class="block" :style="tierLabelStyle(tier)">{{ tierText(tier) }}</text>
              <text class="block tabular-nums" :style="tierPctStyle(tier)">−{{ (tier.pct * 100).toFixed(0) }}%</text>
            </view>
          </view>
        </view>
      </view>

      <!-- Items -->
      <view class="nx-glass-card mx-4 mt-3 overflow-hidden" :style="cardStyle">
        <view class="px-4 py-2.5 flex items-center justify-between" style="border-bottom: 1px solid var(--v5-border)">
          <text :style="itemsHeadingStyle">{{ t.bundle.itemsHeading }}</text>
          <text v-if="products.length > 0" class="active:opacity-70" style="font-size: 12px; color: var(--v5-ink-3)" role="button" tabindex="0" :aria-label="t.bundle.clear" @click.stop="clear" @keydown="activate($event, clear)">{{ t.bundle.clear }}</text>
        </view>

        <!-- Empty state -->
        <EmptyState v-if="products.length === 0" kind="empty-list" :title="t.empty.listTitle" :desc="t.empty.listDesc" />

        <!-- Item rows -->
        <view
          v-for="(p, i) in products"
          v-else
          :key="p.id"
          class="px-4 py-2.5 flex items-center gap-3"
          :style="{ borderBottom: i === products.length - 1 ? 'none' : '1px solid var(--v5-border)' }"
        >
          <view class="flex-1 min-w-0">
            <text class="block" :style="itemNameStyle">{{ (p.name) }}</text>
            <text class="block" :style="itemMetaStyle">
              {{ t.uiChrome.price }} ${{ formatAmount(p.price) }}<text style="color: var(--v5-ink-4)"> · </text><text style="color: var(--v5-brand)">{{ bundleProductYieldText(p) }}</text>
            </text>
            <text v-if="p.productType === 'SHARE'" class="block" :style="itemMetaStyle">{{ t.store.shareYieldDisclaimer }}</text>
            <text v-if="p.taskLevels.length" class="block" :style="itemMetaStyle" style="overflow-wrap: anywhere">{{ productTaskLevelsText(t, p.taskLevels) }}</text>
            <NxTag v-if="remoteApiEnabled && eligibilityUnavailable(p.id)" tone="unavailable" :label="t.store.temporarilyOutOfStock" style="margin-top: 6px" />
            <text v-else-if="remoteApiEnabled && !purchaseEligibilityStore.state(p.id).eligible" class="block" :style="itemMetaStyle">{{ eligibilityLabel(p.id, t.store.purchaseEligibilityIneligible) }}</text>
          </view>
          <view class="shrink-0 rounded-full grid place-items-center active:opacity-70" style="width: 44px; height: 44px; flex-shrink: 0" role="button" tabindex="0" :aria-label="fmt(t.uiChrome.removeItem, { name: (p.name) })" @click.stop="remove(p.id)" @keydown="activate($event, () => remove(p.id))">
            <view class="rounded-full grid place-items-center" style="width: 28px; height: 28px; background: var(--v5-surface-2)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </view>
          </view>
        </view>
      </view>

      <!-- Suggestions -->
      <view v-if="suggestions.length > 0" class="mx-4" style="margin-top: var(--ui-space-section-gap)">
        <text class="block" :style="suggestionsHeadingStyle">{{ t.bundle.suggestionsHeading }}</text>
        <view class="nx-glass-card overflow-hidden" :style="cardStyle">
          <view
            v-for="(p, i) in suggestions"
            :key="p.id"
            class="w-full flex items-center gap-3"
            :class="{ 'active:opacity-80': !eligibilityUnavailable(p.id) }"
            :style="suggestionRowStyle(i === suggestions.length - 1)"
            role="button"
            :tabindex="eligibilityUnavailable(p.id) ? undefined : 0"
            :aria-disabled="eligibilityUnavailable(p.id) ? 'true' : undefined"
            :aria-label="eligibilityUnavailable(p.id) ? `${(p.name)} · ${t.store.temporarilyOutOfStock}`
              : remoteApiEnabled && purchaseEligibilityStore.state(p.id).status === 'ready' && !purchaseEligibilityStore.state(p.id).eligible
              ? `${(p.name)} · ${t.store.gateBlockedToast}` : fmt(t.uiChrome.addItem, { name: (p.name) })"
            @click.stop="onAddSuggestion(p)"
            @keydown="activate($event, () => onAddSuggestion(p))"
          >
            <view class="flex-1 min-w-0 text-left">
              <text class="block" :style="suggestionNameStyle">{{ (p.name) }}</text>
              <text class="block" :style="itemMetaStyle">
                {{ t.uiChrome.price }} ${{ formatAmount(p.price) }}<text style="color: var(--v5-ink-4)"> · </text><text style="color: var(--v5-brand)">{{ bundleProductYieldText(p) }}</text>
              </text>
              <NxTag v-if="remoteApiEnabled && eligibilityUnavailable(p.id)" tone="unavailable" :label="t.store.temporarilyOutOfStock" style="margin-top: 6px" />
              <text v-else-if="remoteApiEnabled && !purchaseEligibilityStore.state(p.id).eligible" class="block" :style="itemMetaStyle">{{ eligibilityLabel(p.id, t.store.gateBlockedToast) }}</text>
              <text v-if="p.taskLevels.length" class="block" :style="itemMetaStyle" style="overflow-wrap: anywhere">{{ productTaskLevelsText(t, p.taskLevels) }}</text>
            </view>
            <view v-if="!eligibilityUnavailable(p.id)" class="shrink-0 flex items-center" style="gap: 4px">
            <view class="rounded-full grid place-items-center" style="width: 28px; height: 28px; background: var(--v5-brand-soft); color: var(--v5-brand)">
              <svg v-if="remoteApiEnabled && purchaseEligibilityStore.state(p.id).status === 'ready' && !purchaseEligibilityStore.state(p.id).eligible" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
            </view>
            <NxIcon v-if="remoteApiEnabled && purchaseEligibilityStore.state(p.id).status === 'ready' && !purchaseEligibilityStore.state(p.id).eligible" name="chevron-right" :size="16" style="color: var(--v5-ink-4)" />
            </view>
          </view>
        </view>
      </view>

      <!-- Total summary -->
      <view v-if="products.length > 0" class="nx-glass-card nx-tint mx-4 relative overflow-hidden" style="margin-top: var(--ui-space-section-gap)" :style="heroStyle">
        <view class="relative">
          <!-- Subtotal -->
          <view class="flex items-center justify-between" style="min-height: 24px">
            <text :style="rowLabelStyle(false)">{{ t.bundle.subtotal }}</text>
            <text class="tabular-nums" :style="rowValueStyle()">${{ formatBundleUsdt(subtotal) }}</text>
          </view>
          <!-- Discount -->
          <view v-if="discountPct > 0" class="flex items-center justify-between" style="min-height: 24px">
            <text :style="rowLabelStyle(false)">{{ discountLabel }}</text>
            <text class="tabular-nums" :style="rowValueStyle('var(--v5-success)')">−${{ formatBundleUsdt(discountUSD) }}</text>
          </view>
          <!-- Divider -->
          <view style="height: 1px; background: var(--v5-border); margin-top: 10px; margin-bottom: 10px" />
          <!-- Total -->
          <view class="flex items-center justify-between" style="min-height: 24px">
            <text :style="rowLabelStyle(true)">{{ t.bundle.total }}</text>
            <text class="tabular-nums" :style="rowValueStyle(undefined, true)">${{ totalText }}</text>
          </view>
          <!-- Combined daily -->
          <view class="flex items-center justify-between" style="min-height: 24px">
            <text :style="rowLabelStyle(false)">{{ t.bundle.estimatedDaily }}</text>
            <text class="tabular-nums" :style="rowValueStyle('var(--v5-success)')">${{ cumulativeDailyEarnText }}{{ t.store.cardPerDaySuffix }}</text>
          </view>
        </view>
      </view>
      <!-- Room for the bottom action bar: the hidden note copy tracks the tray note's height. -->
      <view v-if="products.length > 0" class="bundle-bar-space" :class="{ 'bundle-bar-space--tray': checkoutUnavailable && checkoutHint }" aria-hidden="true">
        <text v-if="checkoutUnavailable && checkoutHint" class="bundle-bar-space__note">{{ checkoutHint }}</text>
      </view>
      </template>
      </template>
    </view>
    </template>
    <!-- Page main action in the shared bottom action bar (04 §4.0): a lone button floats; the
         disabled reason sits above the button in the tray. -->
    <template #pageFixed>
      <!-- Activity bundle: the quote step is a plain text button, the purchase the one primary; the reason the primary is
           disabled sits above both (03 §3.1, 04 §4.0). Signed out, signing in is the only action. -->
      <view v-if="promotionActivityId && promotionBundle?.footer" class="promotion-bar nx-glass-bar">
        <text v-if="promotionBundle.footer.note" class="nx-tray-note" role="status">{{ promotionBundle.footer.note }}</text>
        <template v-if="promotionBundle.footer.signedIn">
          <view class="promotion-bar__text nx-tray-text" role="button" :tabindex="promotionBundle.footer.canQuote ? 0 : -1" :aria-disabled="!promotionBundle.footer.canQuote" @click="promotionBundle.footer.quote" @keydown="activate($event, promotionBundle.footer.quote)"><text>{{ t.promotion.quote }}</text></view>
          <view class="promotion-bar__cta" role="button" :tabindex="promotionBundle.footer.canContinue ? 0 : -1" :aria-disabled="!promotionBundle.footer.canContinue" @click="promotionBundle.footer.continue" @keydown="activate($event, promotionBundle.footer.continue)"><text>{{ promotionBundle.footer.continueLabel }}</text><NxIcon name="arrow-right" :size="20" /></view>
        </template>
        <view v-else class="promotion-bar__cta" role="button" tabindex="0" @click="promotionBundle.footer.signIn" @keydown="activate($event, promotionBundle.footer.signIn)"><text>{{ t.promotion.signIn }}</text><NxIcon name="arrow-right" :size="20" /></view>
      </view>
      <view v-if="!promotionActivityId && catalogStatus !== 'loading' && policyStatus !== 'loading' && catalogStatus !== 'error' && policyStatus !== 'error' && !receiptWriteFailure && products.length > 0" class="bundle-bar nx-glass-bar">
        <text v-if="checkoutUnavailable && checkoutHint" class="nx-tray-note">{{ checkoutHint }}</text>
        <view
          class="bundle-bar__cta"
          role="button"
          tabindex="0"
          :aria-disabled="checkoutUnavailable"
          :aria-label="ctaText"
          @click.stop="onCheckout"
          @keydown="activate($event, onCheckout)"
        >
          <text>{{ ctaText }}</text>
          <NxIcon v-if="!checkoutUnavailable" name="arrow-right" :size="20" />
        </view>
      </view>
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { promotionCheckoutHref } from "@/lib/promotion-entry";
function formatAmount(value: Parameters<typeof formatPlainAmount>[0]): string {
  return formatPlainAmount(value).replace(/\B(?=(\d{3})+\.)/g, ",");
}
import { formatAmount as formatPlainAmount } from "@/lib/amount-display";
import { productDailyEstimateRange } from "@/lib/product-estimates";
import { productTaskLevelsText } from "@/lib/product-copy";
import { computed, ref, watch, type CSSProperties } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import PromotionBundle from '@/components/promotion/promotion-bundle.vue';
import { parseEntryItems,type EntryItem } from '@/lib/promotion-entry';
import EmptyState from "@/components/empty-state.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import NxIcon from "@/components/ui/nx-icon.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useCart, bundleDiscountForCount, type BundleDiscountTier } from "@/store/cart";
import { PRODUCTS, getProduct, evaluatePurchaseGate, type Product } from "@/mock/products";
import { useSetPageHeader } from "@/composables/use-page-header";
// 🔴 zentao #244:线上模式必须问**服务端**资格,本地门仅 mock 用 —— 与 detail.vue 同一口径。
import { purchaseEligibilityStore } from "@/store/purchase-eligibility";
import { isProductAvailable } from "@/store/product-availability";
import { useLocaleStore } from "@/store/locale";
import { useProductPhase } from "@/composables/use-product-phase";
import { productCatalogState, refreshProductCatalog } from "@/store/product-catalog";
import { bundleCatalogReady } from "@/store/bundle-catalog-guard";
import { refreshServerProductPhase } from "@/store/server-product-phase";
import { confirm, toast } from "@/store/ui";
import { bundleDiscountApi, bundleOrderApi, orderApi, remoteApiEnabled } from "@/api/runtime";
import { matchesBundleQuote, normalizeBundleExpectedAmountUsdt } from "@/api/bundle-order-api";
import { quoteBundleAmountUsdt } from "@/api/bundle-quote";
import { restoreBundleCommand, type PendingBundleCommand } from "@/api/bundle-command";
import type { BundleDiscountSnapshot } from "@/api/bundle-discount-api";
import { ApiError, asApiError, isAmbiguousOutcome } from "@/api/errors";
import { useApp } from "@/store/app";
import { useOrders, type Order } from "@/store/orders";
import { usePendingCheckout } from "@/store/pending-checkout";
import { postReceiptOnce, postReceiptOnly, reportStuckFunds, type ReceiptDraft } from "@/lib/money-receipt";
import { navTo,takeNavigationQuery } from "@/lib/route";
import { useVRank } from "@/store/v-rank";
import { useNetwork } from "@/store/network";
import { acquireAccountCommandKey, readAccountRow, writeAccountRow } from "@/store/account-scoped-storage";
import { PROMOTION_CHECKOUT_TABLE, selectPromotionCheckoutRecord, type PromotionCheckoutRecord } from "@/lib/promotion-checkout-session";
import { readCapacityPending } from "@/lib/capacity-command-recovery";
import { captureAccountScope, isCurrentAccountScope } from "@/lib/account-scope";
import { executeSelectedPurchase } from "@/lib/selected-purchase-payment";
import { paidOrderReceipt } from "@/api/order-api";
import { orderPaymentRejection } from "@/lib/order-payment-rejection";
import { beginOrderAction, readOrderAction, clearOrderAction, markOrderActionPaid } from "@/lib/order-command-fence";

const t = useT();
const cart = useCart();
const phase = useProductPhase();
const app = useApp();
const promotionActivityId=ref('');
const promotionInitialItems=ref<EntryItem[]>([]);
const promotionBundle=ref<InstanceType<typeof PromotionBundle>|null>(null);
const orders = useOrders();
const pending = usePendingCheckout();

const catalogStatus = computed(() => productCatalogState.status);
const policy = ref<BundleDiscountSnapshot | null>(null);
const policyStatus = ref<"loading" | "ready" | "error">("loading");
const catalogReady = computed(() => bundleCatalogReady(remoteApiEnabled, catalogStatus.value)
  && policyStatus.value === "ready" && policy.value?.serverCanonical === true);

async function refreshBundlePolicy(): Promise<void> {
  policyStatus.value = "loading";
  try {
    policy.value = await bundleDiscountApi.current();
    policyStatus.value = "ready";
  } catch {
    policy.value = null;
    policyStatus.value = "error";
  }
}

onLoad(async (options) => {
  const query=(options??{}) as Record<string,string>;
  const fallback=new URLSearchParams(takeNavigationQuery('/pages/store/bundle'));
  promotionInitialItems.value=parseEntryItems(query.items||fallback.get('items'))??[];
  promotionActivityId.value=(query.activityId||fallback.get('activityId')||'').trim();
  await Promise.all([refreshProductCatalog(true), refreshServerProductPhase(true), refreshBundlePolicy()]);
});

onShow(() => {
  void refreshProductCatalog(true);
  void refreshServerProductPhase(true);
  void refreshBundlePolicy();
  void refreshBundleWallet();
  restoreReceiptRecovery();
});

// Sticky chassis nav header — back + "Bundle" title (mirrors the prototype's
// <SetPageHeader backHref="/store"/>, whose chassis Header resolves the route
// title headerTitles.storeBundle).
useSetPageHeader(() => ({
  title: t.value.headerTitles.storeBundle,
  backHref: "/store",
}));

const products = computed<Product[]>(() =>
  catalogReady.value
    ? cart.items
      .map((id) => getProduct(id))
      .filter((p): p is Product => !!p)
      .filter((p) => isProductAvailable(p, phase.value))
    : [],
);
const activeDiscountTiers = computed<ReadonlyArray<BundleDiscountTier>>(() => policy.value?.tiers ?? []);
const discountPct = computed(() => bundleDiscountForCount(products.value.length, activeDiscountTiers.value));
const bundleQuote = computed(() => quoteBundleAmountUsdt(
  products.value.map((product) => product.price), discountPct.value,
));
const subtotal = computed(() => bundleQuote.value?.subtotalUsdt ?? Number.NaN);
const discountUSD = computed(() => bundleQuote.value?.discountUsdt ?? Number.NaN);
const total = computed(() => bundleQuote.value?.amountUsdt ?? Number.NaN);
const cumulativeDailyEarnText = computed(() => {
  let low = 0, high = 0, hasShareEstimate = false;
  for (const product of products.value) {
    const estimate = productDailyEstimateRange(product);
    if (!estimate) continue;
    low += estimate.low;
    high += estimate.high;
    hasShareEstimate ||= product.productType === "SHARE";
  }
  const lowText = hasShareEstimate ? formatPlainAmount(low, 6) : formatAmount(low);
  const highText = hasShareEstimate ? formatPlainAmount(high, 6) : formatAmount(high);
  return lowText === highText ? lowText : `${lowText}–${highText}`;
});
function bundleProductYieldText(p: Product): string {
  const estimate = productDailyEstimateRange(p);
  if (estimate) {
    const low = p.productType === "SHARE" ? formatPlainAmount(estimate.low, 6) : formatAmount(estimate.low);
    const high = p.productType === "SHARE" ? formatPlainAmount(estimate.high, 6) : formatAmount(estimate.high);
    return `${t.value.bundle.estimatedDaily} · $${low === high ? low : `${low}–${high}`}`;
  }
  // No server estimate: "—", never an annual rate or a figure derived from one.
  return `${t.value.bundle.estimatedDaily} · —`;
}

// 未正式上架的 SKU 不进组合建议(bundle 是可购组合面,走商城正门口径;审查 F12)。
const suggestions = computed(() =>
  catalogReady.value
    ? PRODUCTS.filter(
      (p) =>
        !cart.items.includes(p.id) &&
        p.productType !== "SHARE" &&
        isProductAvailable(p, phase.value),
    ).slice(0, 3)
    : [],
);
const eligibilityProductIds = computed(() => [...products.value, ...suggestions.value].map((p) => p.id));
watch([eligibilityProductIds, () => app.accountKey], ([ids, account], [previousIds, previousAccount]) => {
  if (!remoteApiEnabled) return;
  for (const id of ids) {
    if (account !== previousAccount || !previousIds?.includes(id)) void purchaseEligibilityStore.ensure(id, true);
  }
}, { immediate: true });

function eligibilityUnavailable(productNo: string): boolean {
  return purchaseEligibilityStore.state(productNo).status === "unavailable";
}

const failedEligibilityIds = computed(() => remoteApiEnabled
  ? eligibilityProductIds.value.filter((id) => purchaseEligibilityStore.state(id).status === "error")
  : []);
useAutoRecovery({
  failed: () => failedEligibilityIds.value.length > 0,
  retry: () => Promise.all(failedEligibilityIds.value.map((id) => purchaseEligibilityStore.ensure(id, true))),
});

function eligibilityLabel(productNo: string, ineligible: string): string {
  switch (purchaseEligibilityStore.state(productNo).status) {
    case "unavailable": return t.value.store.temporarilyOutOfStock;
    case "error": return t.value.store.purchaseEligibilityError;
    case "ready": return ineligible;
    default: return t.value.store.purchaseEligibilityLoading;
  }
}

async function retryCatalog() {
  await Promise.all([refreshProductCatalog(true), refreshServerProductPhase(true), refreshBundlePolicy()]);
}
useAutoRecovery({ failed: () => catalogStatus.value !== "loading" && policyStatus.value !== "loading" && (catalogStatus.value === "error" || policyStatus.value === "error"), retry: retryCatalog });

function retryReceiptWrite() {
  const failure = receiptWriteFailure.value;
  if (!failure || receiptRetrying.value) return;
  if (failure.accountKey !== orders.currentAccountKey()) {
    restoreReceiptRecovery();
    return;
  }
  receiptRetrying.value = true;
  try {
    if (!postReceiptOnce(failure.draft)) return; // 按 ref 幂等
    receiptWriteFailure.value = null;
    clearReceiptRecovery(failure.accountKey);
    cart.clear();
    toast.success(
      t.value.bundle.checkoutSuccessTitle,
      fmt(t.value.bundle.checkoutSuccessBody, { count: failure.orderIds.length }),
    );
    navTo("/pages/store/orders");
  } finally {
    receiptRetrying.value = false;
  }
}

const tiersReversed = computed(() => activeDiscountTiers.value.slice().reverse());

function activate(event: KeyboardEvent, action: () => void | Promise<void>) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  void action();
}

function formatBundleUsdt(value: number): string {
  return formatAmount(value);
}
const totalText = computed(() => formatBundleUsdt(total.value));
const discountLabel = computed(() => fmt(t.value.bundle.bundleDiscount, { pct: (discountPct.value * 100).toFixed(0) }));
const checkoutCtaText = computed(() => t.value.promotion.continue);
const submitting = ref(false);
const walletRefreshing = ref(false);
let walletRefreshSequence = 0;

async function refreshBundleWallet(): Promise<void> {
  if (!remoteApiEnabled) return;
  const request = app.captureRemoteAccountRequest();
  const sequence = ++walletRefreshSequence;
  walletRefreshing.value = true;
  try {
    await app.refreshRemoteFleet(request);
  } finally {
    if (sequence === walletRefreshSequence) walletRefreshing.value = false;
  }
}

const checkoutUnavailable = computed(() => submitting.value || walletRefreshing.value || products.value.length < 2
  || (remoteApiEnabled && products.value.some((p) => {
    const entry = purchaseEligibilityStore.state(p.id);
    return entry.status !== "ready" || !entry.eligible;
  })));
const ctaText = computed(() => (
  submitting.value || walletRefreshing.value ? "…" : checkoutUnavailable.value ? t.value.bundle.checkoutUnavailableCta : checkoutCtaText.value
));
const checkoutHint = computed(() => {
  if (products.value.length < 2) return t.value.bundle.checkoutUnavailableHint;
  if (!remoteApiEnabled) return "";
  const entries = products.value.map((p) => purchaseEligibilityStore.state(p.id));
  if (entries.some((entry) => entry.status === "unavailable")) return t.value.store.temporarilyOutOfStock;
  if (entries.some((entry) => entry.status === "error")) return t.value.store.purchaseEligibilityError;
  if (entries.some((entry) => entry.status !== "ready")) return t.value.store.purchaseEligibilityLoading;
  return entries.some((entry) => !entry.eligible) ? t.value.store.purchaseEligibilityIneligible : "";
});
const BUNDLE_RECEIPT_RECOVERY_KEY = "nexgrid-bundle-receipt-recovery-v1";
type BundleReceiptRecovery = { accountKey: string; draft: ReceiptDraft; orderIds: string[] };
const receiptWriteFailure = ref<BundleReceiptRecovery | null>(null);
const receiptRetrying = ref(false);

function restoreReceiptRecovery() {
  const accountKey = orders.currentAccountKey();
  const row = readAccountRow<BundleReceiptRecovery>(BUNDLE_RECEIPT_RECOVERY_KEY, accountKey);
  // 磁盘没有行时保留内存里同账号的卡(恢复行自己也可能写不进去,那张卡是唯一补写入口);换号才清。
  const memRow = receiptWriteFailure.value?.accountKey === accountKey ? receiptWriteFailure.value : null;
  receiptWriteFailure.value = (row?.accountKey === accountKey ? row : null) ?? memRow;
}

function persistReceiptRecovery(failure: BundleReceiptRecovery) {
  receiptWriteFailure.value = failure;
  if (!writeAccountRow<BundleReceiptRecovery>(BUNDLE_RECEIPT_RECOVERY_KEY, failure.accountKey, failure)) {
    reportStuckFunds(app.captureMoney(), failure.orderIds.join(","), "receipt");
  }
}

function clearReceiptRecovery(accountKey = orders.currentAccountKey()) {
  // persist-verdict-ok: 清不掉最多让卡多露一次;补写走 postReceiptOnce 按 ref 幂等
  writeAccountRow<BundleReceiptRecovery | null>(BUNDLE_RECEIPT_RECOVERY_KEY, accountKey, null);
}

watch(() => app.accountKey, () => {
  restoreReceiptRecovery();
  void refreshBundleWallet();
  // A direct H5 reload reaches onLoad/onShow before cookie session restore.
  // The account rebind clears the pre-auth failure back to "loading"; retry
  // these reads once the restored account owns a bearer session.
  if (remoteApiEnabled && app.accountKey !== "default") {
    void refreshProductCatalog(true);
    void refreshServerProductPhase(true);
    void refreshBundlePolicy();
  }
});

function tierIsActive(tier: BundleDiscountTier): boolean {
  return products.value.length >= tier.minItems;
}
function tierText(tier: BundleDiscountTier): string {
  return fmt(t.value.bundle.tier, { n: tier.minItems });
}

function remove(id: string) {
  cart.remove(id);
}
function clear() {
  cart.clear();
}
async function onAddSuggestion(p: Product) {
  if (remoteApiEnabled) {
    const entry = purchaseEligibilityStore.state(p.id);
    if (entry.status === "unavailable") return;
    if (entry.status === "ready" && !entry.eligible) {
      navTo(`/pages/store/detail?id=${encodeURIComponent(p.id)}`);
      return;
    }
    const scope = captureAccountScope();
    const eligible = await purchaseEligibilityStore.ensure(p.id, entry.status !== "loading");
    if (!isCurrentAccountScope(scope)) return;
    if (!eligible) {
      const status = purchaseEligibilityStore.state(p.id).status;
      if (status === "unavailable") return;
      if (status === "error") toast.warn(t.value.store.purchaseEligibilityError);
      else navTo(`/pages/store/detail?id=${encodeURIComponent(p.id)}`);
      return;
    }
  }
  if (!catalogReady.value || !isProductAvailable(p, phase.value) || cart.has(p.id)) return;
  cart.add(p.id);
  toast.success(fmt(t.value.bundle.addedToBundle, { name: (p.name) }));
}
interface PendingBundleCommands { commands: Record<string, PendingBundleCommand | string> }
const BUNDLE_COMMAND_KEY = "nexgrid-bundle-order-command-v1";
const BUNDLE_COMMAND_LEGACY_RECOVERY_REQUIRED = "BUNDLE_COMMAND_LEGACY_RECOVERY_REQUIRED";
function bundleFingerprint(list: Product[]): string {
  return list.map((item) => item.id).sort().join("|");
}
function acquireBundleCommand(list: Product[], accountKey: string, expectedAmountUsdt: number): PendingBundleCommand {
  const fingerprint = bundleFingerprint(list);
  const productNos = list.map((item) => item.id);
  const row = readAccountRow<PendingBundleCommands>(BUNDLE_COMMAND_KEY, accountKey, true);
  const existing = row?.commands?.[fingerprint];
  const restored = restoreBundleCommand(existing);
  if (restored && "recoveryKey" in restored) throw new Error(BUNDLE_COMMAND_LEGACY_RECOVERY_REQUIRED);
  if (restored) return restored.command;
  const normalizedAmount = normalizeBundleExpectedAmountUsdt(expectedAmountUsdt);
  if (normalizedAmount === null) throw new Error("BUNDLE_QUOTE_INVALID");
  // A legacy string is a prior durable command key. Reuse it for recovery, but
  // record the quote before issuing any request from this App version.
  const key = acquireAccountCommandKey(BUNDLE_COMMAND_KEY, accountKey, fingerprint, "bundle");
  const command = { key, expectedAmountUsdt: normalizedAmount, productNos };
  const commands = { ...(readAccountRow<PendingBundleCommands>(BUNDLE_COMMAND_KEY, accountKey, true)?.commands ?? {}), [fingerprint]: command };
  if (!writeAccountRow<PendingBundleCommands>(BUNDLE_COMMAND_KEY, accountKey, { commands })) {
    throw new Error("ACCOUNT_COMMAND_STORAGE_UNAVAILABLE");
  }
  const committed = readAccountRow<PendingBundleCommands>(BUNDLE_COMMAND_KEY, accountKey, true)?.commands?.[fingerprint];
  const committedCommand = restoreBundleCommand(committed);
  if (!committedCommand || "recoveryKey" in committedCommand || committedCommand.command.key !== command.key
      || committedCommand.command.expectedAmountUsdt !== command.expectedAmountUsdt
      || committedCommand.command.productNos.join("|") !== command.productNos.join("|")) {
    throw new Error("ACCOUNT_COMMAND_STORAGE_UNAVAILABLE");
  }
  return committedCommand.command;
}
function retireBundleKey(list: Product[], accountKey: string, expectedKey: string): void {
  const row = readAccountRow<PendingBundleCommands>(BUNDLE_COMMAND_KEY, accountKey);
  const commands = { ...(row?.commands ?? {}) };
  const current = commands[bundleFingerprint(list)];
  const currentKey = typeof current === "string"
    ? current
    : current && typeof current === "object" && typeof (current as PendingBundleCommand).key === "string"
      ? (current as PendingBundleCommand).key
      : undefined;
  if (currentKey !== expectedKey) return;
  delete commands[bundleFingerprint(list)];
  // persist-verdict-ok: 远端命令键耐久性归远端幂等设计(见 HANDOFF U-21)
  writeAccountRow(BUNDLE_COMMAND_KEY, accountKey, { commands });
}

async function offerBundleWalletTopup(requiredUsdt: number): Promise<void> {
  const accountScope = captureAccountScope();
  const accepted = await confirm({
    title: t.value.errors.insufficientBalanceTitle,
    message: fmt(t.value.errors.insufficientBalanceMsg, { amt: formatAmount(requiredUsdt) }),
    confirmLabel: t.value.me.topup,
    cancelLabel: t.value.store.coCancel,
    icon: "warn",
  });
  if (accepted && isCurrentAccountScope(accountScope)) navTo("/pages/me/wallet-topup");
}

// Existing durable commands stay in their original recovery path. New bundles
// use the shared items review, legal terms and explicit payment confirmation.
async function openBundleReview(list:Product[]):Promise<boolean> {
  if(receiptWriteFailure.value)return true;
  submitting.value=true;
  try {
    const rows=readAccountRow<PendingBundleCommands>(BUNDLE_COMMAND_KEY,orders.currentAccountKey(),true);
    const commands=rows?.commands??{};
    if(Object.keys(commands).length){
      if(commands[bundleFingerprint(list)])return false;
      toast.warn(t.value.bundle.checkoutOutcomeUnknown);void navTo('/pages/store/orders');return true;
    }
    const items=list.map(product=>({productNo:product.id,quantity:1}));
    // Unresolved originals (a checkout command, an unpaid original order, a
    // capacity KEEP/REPLACE command) resume in the checkout before any
    // new-purchase gate. If they cannot be read, the checkout shows that state.
    let original=true;
    try{
      const {record}=selectPromotionCheckoutRecord(readAccountRow<Record<string,PromotionCheckoutRecord>>(PROMOTION_CHECKOUT_TABLE,app.accountKey,true)??{},{activityId:'',items});
      original=!!record?.pending||record?.order?.paymentStatus==='PENDING'
        ||list.some(product=>!!readCapacityPending(app.accountKey,product.id));
    }catch{/* unreadable originals: the checkout reads them again and offers recovery */}
    if (!original && list.some((p) => eligibilityUnavailable(p.id))) return true;
    // Every device and Cloud Share takes one slot; the server refuses a bundle
    // larger than the free slots, so say so before the review page.
    const used=app.remoteSlotsUsed;
    if(!original&&used!==null&&list.length>app.slotCap-used){
      const scope=captureAccountScope();
      const manage=await confirm({
        title:t.value.bundle.slotsShortTitle,
        message:fmt(t.value.bundle.slotsShortBody,{count:list.length,free:Math.max(0,app.slotCap-used)}),
        confirmLabel:t.value.bundle.slotsShortManage,
        cancelLabel:t.value.bundle.slotsShortAdjust,
        icon:'warn',
      });
      if(manage&&isCurrentAccountScope(scope))void navTo('/pages/me/devices');
      return true;
    }
    await navTo(promotionCheckoutHref(items));
  }catch{toast.warn(t.value.bundle.checkoutOutcomeUnknown);}
  finally{submitting.value=false;}
  return true;
}
async function onCheckout() {
  const list = products.value;
  if (list.length < 2 || submitting.value || walletRefreshing.value) return;
  if (remoteApiEnabled) {
    if(await openBundleReview(list))return;
    if (list.some((p) => eligibilityUnavailable(p.id))) return;
    const submissionScope = captureAccountScope();
    const accountKey = orders.currentAccountKey();
    const scopeIsCurrent = () => isCurrentAccountScope(submissionScope)
      && orders.currentAccountKey() === accountKey;
    const walletReceiptScope = app.captureRemoteAccountRequest();
    const quotedTotal = normalizeBundleExpectedAmountUsdt(total.value);
    if (quotedTotal === null) {
      toast.warn(t.value.store.coTotalQuoteChanged);
      return;
    }
    submitting.value = true;
    try {
      const decisions = await Promise.all(list.map((p) => purchaseEligibilityStore.ensure(p.id, true)));
      if (!scopeIsCurrent()) return;
      const firstBlocked = decisions.findIndex((eligible) => !eligible);
      if (firstBlocked >= 0) {
        const status = purchaseEligibilityStore.state(list[firstBlocked].id).status;
        if (status === "unavailable") return;
        toast.warn(status === "error"
          ? t.value.store.purchaseEligibilityError : t.value.store.gateBlockedToast);
        return;
      }
      const latestPolicy = await bundleDiscountApi.current();
      if (!scopeIsCurrent()) return;
      if (!policy.value || latestPolicy.policyVersion !== policy.value.policyVersion) {
        policy.value = latestPolicy;
        policyStatus.value = "ready";
        toast.warn(t.value.bundle.policyChanged);
        return;
      }
      const command = acquireBundleCommand(list, accountKey, quotedTotal);
      let canonicalOrderCommitted = false;
      let paymentConfirmed = false;
      let confirmedOrderNo = "";
      let createdOrderNo = "";
      try {
        const created = await bundleOrderApi.create(
          command.productNos, latestPolicy.policyVersion, command.expectedAmountUsdt, command.key);
        if (!scopeIsCurrent()) return;
        canonicalOrderCommitted = true;
        createdOrderNo = created.orderNo;
        if (!matchesBundleQuote(created, command.productNos, command.expectedAmountUsdt)) {
          throw new ApiError({ kind: "protocol", message: "BUNDLE_QUOTE_RECEIPT_MISMATCH" });
        }
        if (readOrderAction(accountKey,created.orderNo)) {
          navTo(`/pages/store/order-detail?id=${encodeURIComponent(created.orderNo)}`);
          return;
        }
        const persisted=await orders.ensureRemoteOrder(created.orderNo);
        if (!scopeIsCurrent()) return;
        if (!persisted || persisted.total!==created.amountUsdt) throw new Error('BUNDLE_WALLET_PAYMENT_READBACK_MISMATCH');
        if (persisted.status!=='placed') {
          navTo(`/pages/store/order-detail?id=${encodeURIComponent(created.orderNo)}`);
          return;
        }
        let paymentKey:string|null=null;
        const paymentCurrent=()=>scopeIsCurrent()&&bundleFingerprint(products.value)===bundleFingerprint(list)
          &&normalizeBundleExpectedAmountUsdt(total.value)===command.expectedAmountUsdt
          &&policy.value?.policyVersion===latestPolicy.policyVersion;
        const paid = await executeSelectedPurchase({amount:command.expectedAmountUsdt,currency:'USDT',summary:list.map(product=>product.name).join(', ')},
          async authorization=>{
            if(!paymentCurrent())return null;
            const action=beginOrderAction(accountKey,'pay',created.orderNo,command.expectedAmountUsdt,'WALLET');paymentKey=action.key;
            try{return await orderApi.pay(created.orderNo,action.key,authorization);}
            catch(error){
              if (/^PAYMENT_PASSWORD_(INCORRECT|LOCKED|VERSION_CONFLICT|NOT_CONFIGURED|REQUIRED)$/.test(asApiError(error).message))
                clearOrderAction(accountKey,created.orderNo,action.key);
              throw error;
            }
          },paymentCurrent,{kind:'ORDER_PAY',payload:{orderNo:created.orderNo},orderNo:created.orderNo,deadlineAt:persisted.expiresAt,
            reorder:()=>void navTo('/pages/store/bundle'),
            commandKey:()=>{const action=beginOrderAction(accountKey,'pay',created.orderNo,command.expectedAmountUsdt,'EXTERNAL');paymentKey=action.key;return action.key;},parseReceipt:paidOrderReceipt});
        if (!paid) return;
        if (!scopeIsCurrent()) return;
        if (paid.orderNo !== created.orderNo) throw new Error("BUNDLE_WALLET_PAYMENT_RECEIPT_INVALID");
        markOrderActionPaid(accountKey,created.orderNo);
        if (paid.paymentMethod === "WALLET"
              && (paid.walletBalanceAfterUsdt === null
                || !app.adoptCommerceWallet(paid.walletBalanceAfterUsdt, walletReceiptScope))) {
          throw new Error("BUNDLE_WALLET_PAYMENT_RECEIPT_INVALID");
        }
        paymentConfirmed = true;
        confirmedOrderNo = created.orderNo;
        retireBundleKey(list, accountKey, command.key);
        cart.clear();
        await orders.refreshRemote();
        if (!scopeIsCurrent()) return;
        const settled = orders.orders.find((order) => order.id === created.orderNo);
        if (!settled || settled.status !== "activated") {
          throw new Error("BUNDLE_WALLET_PAYMENT_READBACK_MISMATCH");
        }
        if(paymentKey)clearOrderAction(accountKey,created.orderNo,paymentKey);
        // Order + wallet receipt are already canonical. Fleet projection is
        // best effort and must never cause a second payment submission.
        void app.refreshRemoteFleet(walletReceiptScope);
        toast.success(t.value.orders.statusActivated);
        navTo(`/pages/store/order-detail?id=${encodeURIComponent(created.orderNo)}`);
      } catch (error) {
        const policyStale = error instanceof ApiError && error.message === "BUNDLE_DISCOUNT_POLICY_STALE";
        const quoteStale = error instanceof ApiError && error.message === "BUNDLE_QUOTE_STALE";
        const idempotencyPayloadMismatch = error instanceof ApiError && error.message === "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH";
        const apiError = asApiError(error);
        if (!canonicalOrderCommitted && !idempotencyPayloadMismatch
            && (policyStale || quoteStale || !isAmbiguousOutcome(error))) {
          retireBundleKey(list, accountKey, command.key);
        }
        if (!scopeIsCurrent()) return;
        // A definitive refusal leaves the order unpaid; its detail page reads the
        // rejected command back and offers cancel or a fresh payment.
        const rejection = createdOrderNo && !paymentConfirmed ? orderPaymentRejection(error, useLocaleStore().code) : null;
        if (rejection) {
          toast.warn(rejection);
          navTo(`/pages/store/order-detail?id=${encodeURIComponent(createdOrderNo)}`);
          return;
        }
        if (paymentConfirmed) {
          toast.warn(t.value.orders.walletPaymentConfirmedRefreshPending);
          if (confirmedOrderNo) navTo(`/pages/store/order-detail?id=${encodeURIComponent(confirmedOrderNo)}`);
          return;
        }
        if (policyStale || quoteStale) {
          await Promise.all([refreshBundlePolicy(), refreshProductCatalog(true)]);
          toast.warn(quoteStale ? t.value.store.coTotalQuoteChanged : t.value.bundle.policyChanged);
          return;
        }
        if (idempotencyPayloadMismatch) {
          toast.warn(t.value.bundle.checkoutOutcomeUnknown);
          navTo("/pages/store/orders");
          return;
        }
        if (apiError.message === "BUNDLE_QUOTE_RECEIPT_MISMATCH") {
          toast.warn(t.value.bundle.checkoutOutcomeUnknown);
          if (createdOrderNo) navTo(`/pages/store/order-detail?id=${encodeURIComponent(createdOrderNo)}`);
          else navTo("/pages/store/orders");
          return;
        }
        if (apiError.message === "ACCOUNT_COMMAND_STORAGE_UNAVAILABLE") {
          toast.error(t.value.errors.txNotSavedTitle, t.value.errors.txNotSavedMsg);
        } else if (apiError.message === "ORDER_WALLET_INSUFFICIENT") {
          await offerBundleWalletTopup(quotedTotal);
        } else if (["ORDER_MONTHLY_QUOTA_PAUSED", "ORDER_MONTHLY_QUOTA_EXHAUSTED"].includes(apiError.message)) {
          toast.warn(t.value.quota.stockUnavailable);
        } else {
          toast.warn(isAmbiguousOutcome(error)
            ? t.value.bundle.checkoutOutcomeUnknown
            : t.value.tradein.errPurchaseFailed);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === BUNDLE_COMMAND_LEGACY_RECOVERY_REQUIRED) {
        toast.warn(t.value.bundle.checkoutOutcomeUnknown);
        navTo("/pages/store/orders");
        return;
      }
      policyStatus.value = "error";
      toast.warn(t.value.store.catalogErrorBody);
    } finally {
      submitting.value = false;
    }
    return;
  }
  // 购买资格门(等级门/锁额/售罄)——镜像单品 checkout 的门:suggestions 只挡上架节奏门
  // (unlocksAtPhase)、挡不住资格门,组合内任一 SKU 不达标即整单拒,防授权旁路(深链防线)。
  // 真后台仍以 POST /api/orders 服务端复检为准。
  const vRank = useVRank();
  const network = useNetwork();
  const gateCtx = {
    rank: vRank.myRank,
    activeDirect: network.members.filter((m) => m.layer === 1 && m.status === "active").length,
    teamComputePoints: vRank.teamComputePoints ?? 0,
  };
  const blocked = list.find((p) => evaluatePurchaseGate(p, gateCtx).blocked);
  if (blocked) {
    const g = evaluatePurchaseGate(blocked, gateCtx);
    toast.warn(g.soldOut ? t.value.store.gateSoldOutToast : t.value.store.gateBlockedToast);
    navTo("/pages/team/quota");
    return;
  }
  // 组合折扣已含在 total;一次扣平台余额(复用单品 checkout 的余额门),不足则拦截。
  const charge = total.value;
  // 与单品结算同一套两分支处置:数值闸 + 只读余额预检先出局(用户可自解),之后 debit 的 false 只剩落盘失败(系统故障)。
  if (!Number.isFinite(charge) || charge < 0) {
    toast.warn(t.value.store.coTotalQuoteChanged);
    return;
  }
  if (app.user.usdtBalance < charge) {
    toast.warn(fmt(t.value.errors.insufficientBalanceMsg, { amt: formatAmount(charge) }));
    return;
  }
  const beforePay = app.captureMoney();
  if (!app.debitBalance(charge)) {
    toast.error(t.value.errors.txNotSavedTitle, t.value.errors.txNotSavedMsg);
    return;
  }
  const pct = discountPct.value;
  // 逐商品建单;组合折扣按单价比例分摊到各单(展示净额)。
  // ponytail: 账本单源 = debitBalance(total)+bills;各单 net 之和的四舍五入分差不入账。
  // 一批一次落盘(store 保证):要么全部建成,要么一单不留 —— 不存在「前几单落了、后几单没落」的半执行态。
  const created = orders.createOrders(list.map((p) => ({
    productId: p.id as Order["productId"],
    productName: p.name,
    unitPrice: p.price,
    paymentMethod: "balance" as const,
    discount: +(p.price * pct).toFixed(2),
  })));
  // 这批成交 = 这些商品的购买意图已兑现:同账号仍在窗内的链上旧票一并作废(否则浮动条继续催第二笔)。
  // persist-verdict-ok: 作废不掉 = 票留在磁盘,浮动条继续露出,用户回去看到的是可取消的旧票
  if (created) for (const p of list) pending.settleProduct(p.id);
  if (!created) {
    // 整批没落盘:钱按快照精确冲正,冲不回去走响亮终态。
    if (app.restoreMoney(beforePay)) toast.error(t.value.errors.txNotSavedTitle, t.value.errors.txNotSavedMsg);
    else reportStuckFunds(beforePay);
    return;
  }
  // 🔴 走 postReceiptOnly 而不是 postMoneyBill(与 checkout.vue 主账单同口径):扣款必须
  // 发生在建单之前,而单子已经建好并进入履约 —— 收据写失败时回滚资金只还钱、还不回那几台设备。
  // 既定处置是让用户明确看见收据没记上,而不是像原来那样丢弃返回值静默吞掉。
  const receiptDraft: ReceiptDraft = {
    type: "purchase",
    symbol: "USDT",
    amount: -charge,
    status: "posted",
    memo: fmt(t.value.bundle.checkoutBillMemo, { count: list.length }),
    ref: created[0]?.id ?? "BUNDLE",
  };
  if (!postReceiptOnly(receiptDraft)) {
    persistReceiptRecovery({
      accountKey: orders.currentAccountKey(),
      draft: receiptDraft,
      orderIds: created.map((order) => order.id),
    });
    return;
  }
  cart.clear();
  toast.success(
    t.value.bundle.checkoutSuccessTitle,
    fmt(t.value.bundle.checkoutSuccessBody, { count: list.length }),
  );
  navTo("/pages/store/orders");
}

// ───── style objects ─────
const catalogStateStyle: CSSProperties = { boxShadow: "var(--nx-glass-edge)",
  padding: "18px 16px",
  borderRadius: "var(--nx-glass-radius)",
  background: "var(--nx-glass-fill)",
};
const catalogStateTitleStyle: CSSProperties = {
  fontSize: "var(--ui-type-card-title)",
  fontWeight: "var(--ui-type-card-title-weight)",
  color: "var(--v5-ink)",
};
const catalogStateBodyStyle: CSSProperties = {
  fontSize: "13px",
  lineHeight: "19px",
  color: "var(--v5-ink-3)",
};
const catalogRetryStyle: CSSProperties = {
  minHeight: "36px",
  alignItems: "center",
  padding: "0 14px",
  borderRadius: "9999px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  fontSize: "13px",
  fontWeight: 600,
};
const receiptFailureCardStyle: CSSProperties = { borderRadius: "var(--nx-glass-radius)", boxShadow: "var(--nx-glass-edge)",
  padding: "24px 20px",
  background: "var(--nx-glass-fill)",
};
const heroStyle: CSSProperties = {
  "--nx-tint": "var(--v5-brand-2)",
  padding: "18px",
  borderRadius: "var(--nx-glass-radius)",
} as CSSProperties;
const heroLabelStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--v5-brand)",
  letterSpacing: "0.06em",
};
const heroTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "20px",
  letterSpacing: "-0.014em",
  color: "var(--v5-ink)",
  lineHeight: 1.3,
};

function tierCellStyle(tier: BundleDiscountTier): CSSProperties {
  const active = tierIsActive(tier);
  return {
    borderRadius: "12px",
    background: active ? "var(--v5-brand-soft)" : "var(--v5-surface-2)",
  };
}
function tierLabelStyle(_tier: BundleDiscountTier): CSSProperties {
  return {
    fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--v5-ink-3)",
    letterSpacing: "0.06em",
  };
}
function tierPctStyle(tier: BundleDiscountTier): CSSProperties {
  const active = tierIsActive(tier);
  return {
    marginTop: "2px",
    fontFamily: "var(--font-v5)",
    fontWeight: 600,
    fontSize: "15px",
    letterSpacing: "-0.014em",
    color: active ? "var(--v5-brand)" : "var(--v5-ink)",
  };
}

// Shared form-b container (items list + suggestions list): surface, no border,
// internal hairline rows. overflow-hidden on the element clips the row corners.
const cardStyle: CSSProperties = { boxShadow: "var(--nx-glass-edge)",
  borderRadius: "var(--nx-glass-radius)",
  background: "var(--nx-glass-fill)",
};
const itemsHeadingStyle: CSSProperties = {
  fontFamily: "var(--font-jet-mono), ui-monospace, monospace",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--v5-ink-3)",
  letterSpacing: "0.06em",
};
const emptyTitleStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: 600,
  fontSize: "13px",
  color: "var(--v5-ink)",
  letterSpacing: "-0.008em",
};
const itemNameStyle: CSSProperties = {
  fontFamily: "var(--font-v5)",
  fontWeight: "var(--ui-type-list-title-weight)",
  fontSize: "var(--ui-type-list-title)",
  lineHeight: "var(--ui-type-list-title-lh)",
  overflowWrap: "break-word",
  color: "var(--v5-ink)",
};
const itemMetaStyle: CSSProperties = {
  marginTop: "2px",
  fontFamily: "var(--font-v5)",
  fontWeight: "var(--ui-type-list-subtitle-weight)",
  fontSize: "var(--ui-type-list-subtitle)",
  lineHeight: "var(--ui-type-list-subtitle-lh)",
  fontVariantNumeric: "tabular-nums",
  color: "var(--v5-ink-3)",
};

const suggestionsHeadingStyle: CSSProperties = {
  marginBottom: "12px",
  fontFamily: "var(--font-v5)",
  fontWeight: "var(--ui-type-section-weight)",
  fontSize: "var(--ui-type-section)",
  lineHeight: "var(--ui-type-section-lh)",
  color: "var(--v5-ink)",
};
// Suggestion rows now live in one form-b container → hairline-separated rows.
function suggestionRowStyle(isLast: boolean): CSSProperties {
  return {
    padding: "12px 16px",
    borderBottom: isLast ? "none" : "1px solid var(--v5-border)",
  };
}
const suggestionNameStyle = itemNameStyle;

function rowLabelStyle(big: boolean): CSSProperties {
  return {
    fontFamily: "var(--font-v5)",
    fontSize: "var(--ui-type-list-subtitle)",
    fontWeight: big ? 600 : 500,
    color: big ? "var(--v5-ink)" : "var(--v5-ink-3)",
  };
}
function rowValueStyle(tint?: string, big = false): CSSProperties {
  return {
    fontFamily: "var(--font-v5)",
    fontWeight: 600,
    fontSize: big ? "18px" : "13px",
    letterSpacing: big ? "-0.014em" : "-0.008em",
    color: tint ?? "var(--v5-ink)",
  };
}

</script>

<style scoped>
.bundle-bar { position: absolute; z-index: 36; display: flex; flex-direction: column; animation: bundle-bar-in .42s cubic-bezier(.16,1,.3,1) .2s both; }
/* Primary L 48 (03 §3.1); the shared bar rules restyle it while aria-disabled. */
.bundle-bar__cta { display: flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; width: 100%; min-height: 48px; padding: 0 20px; border-radius: 999px; background: var(--v5-brand); color: var(--v5-on-brand); font: var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5); white-space: nowrap; }
.bundle-bar__cta :deep(uni-text), .bundle-bar__cta :deep(text) { white-space: nowrap; }
.bundle-bar__cta[aria-disabled="false"]:active { transform: scale(.98); }
.bundle-bar__cta:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 3px; }
/* Sub-page content already ends 64px above the screen bottom (pb-6 24 + chassis 40). Floating: 48 + 22 + 16;
   tray: 8 + note + 8 + 48 + 8, plus 22 + 16. */
.bundle-bar-space { visibility: hidden; padding: 0 32px 22px; }
.bundle-bar-space--tray { padding-bottom: 46px; }
.bundle-bar-space__note { display: block; padding-top: 4px; font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); text-align: center; overflow-wrap: anywhere; text-wrap: pretty; }
.promotion-bar { position: absolute; z-index: 36; display: flex; flex-wrap: wrap; align-items: center; animation: bundle-bar-in .42s cubic-bezier(.16,1,.3,1) .2s both; }
.promotion-bar .nx-tray-note { flex: 1 1 100%; }
/* Each button keeps its label on one line; when both do not fit one row they stack full width (03 §3.6.1). */
.promotion-bar__text, .promotion-bar__cta { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; min-height: 48px; border-radius: 999px; font: var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5); white-space: nowrap; }
.promotion-bar__text { padding: 0 12px; }
.promotion-bar__cta { padding: 0 20px; background: var(--v5-brand); color: var(--v5-on-brand); }
.promotion-bar :deep(uni-text), .promotion-bar :deep(text) { white-space: nowrap; }
.promotion-bar .nx-tray-note :deep(uni-text), .promotion-bar .nx-tray-note { white-space: normal; }
.promotion-bar__text[aria-disabled="false"]:active { opacity: .6; }
.promotion-bar__cta[aria-disabled="false"]:active, .promotion-bar__cta:not([aria-disabled]):active { transform: scale(.98); }
.promotion-bar__text:focus-visible, .promotion-bar__cta:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 3px; }
@keyframes bundle-bar-in { from { transform: translateY(100%); } to { transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .bundle-bar, .promotion-bar { animation: none; }
  .promotion-bar__cta:active { transform: none; }
  .bundle-bar__cta[aria-disabled="false"]:active { transform: none; }
}
</style>
