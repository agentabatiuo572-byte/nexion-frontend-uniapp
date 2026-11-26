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
    <!-- Activity bundle: the same layout (board B), with the activity strip on top; tiers are the policy this page reads. -->
    <PromotionBundle v-if="promotionActivityId" :key="promotionActivityId" ref="promotionBundle" :activity-id="promotionActivityId" :initial-items="promotionInitialItems" :policy="policy" />
    <template v-else>
    <!-- Chassis-nav pages (useSetPageHeader) don't get sub-page-header.vue's global
         24px .spv gap, so the nav→content breathing is supplied here once. -->
    <view class="bundle-page pb-6" style="color: var(--v5-ink); padding-top: 24px">
      <!-- Back + title live in the sticky chassis nav header (useSetPageHeader below). -->

      <!-- Remote and explicit sandbox catalogs start empty. Do not render the
           compatibility PRODUCTS array until the authoritative snapshot is
           ready; a cold first frame must never look like a real quote.
           The first load keeps the focal card's shape while later reads keep the catalog presentation. -->
      <view v-if="!hasCatalog && catalogStatus === 'loading'" data-testid="bundle-catalog-loading" class="bundle-skeleton nx-soft-glass" role="status" :aria-label="t.store.catalogLoadingTitle">
        <view class="bundle-skeleton__bar bundle-skeleton__bar--title" />
        <view class="bundle-skeleton__bar" />
        <view class="bundle-skeleton__grid"><view class="bundle-skeleton__tile" /><view class="bundle-skeleton__tile" /></view>
      </view>
      <EmptyState v-else-if="!hasCatalog && catalogStatus === 'error'" kind="recoverable-error" page :title="t.store.catalogErrorTitle" :desc="t.store.catalogErrorBody" :cta-label="t.ui.reload" @cta="retryCatalog" />
      <template v-else>

      <!-- Legacy receipt rewrite: the user's own submitted action, so it keeps its in-place retry, a text button (03 §3.5.2, 10.2). -->
      <view v-if="receiptWriteFailure" class="bundle-receipt mx-4">
        <text class="block" :style="catalogStateTitleStyle">{{ t.errors.billMissingTitle }}</text>
        <text class="block mt-1" :style="catalogStateBodyStyle">{{ t.errors.billMissingMsg }}</text>
        <NxButton class="bundle-receipt__retry" variant="text" size="small" :label="t.store.catalogRetry" :busy="receiptRetrying" @click="retryReceiptWrite" />
      </view>
      <template v-else>

      <BundleHero class="bundle-rise" :count="products.length" :tiers="activeDiscountTiers" :items="heroTiles" :rules="limitReached ? t.promotion.quantityLimit : t.bundle.sameModel" :daily="products.length ? `$${cumulativeDailyEarnText}${t.store.cardPerDaySuffix}` : ''" :addable="suggestions.length > 0" :add-disabled="limitReached || !catalogReady" @remove="remove" @add="jumpToSuggestions">
        <template #tile="{ item }">
          <text v-if="productById(item.id)?.productType === 'SHARE'" class="bundle-tile-note">{{ t.store.shareYieldDisclaimer }}</text>
          <text v-if="productById(item.id)?.taskLevels.length" class="bundle-tile-note">{{ productTaskLevelsText(t, productById(item.id)?.taskLevels ?? []) }}</text>
          <NxTag v-if="remoteApiEnabled && eligibilityUnavailable(item.id)" class="bundle-tile-tag" tone="unavailable" :label="t.bundle.tileOutOfStock" />
          <text v-else-if="remoteApiEnabled && !purchaseEligibilityStore.state(item.id).eligible" class="bundle-tile-note">{{ eligibilityLabel(item.id, t.store.purchaseEligibilityIneligible) }}</text>
        </template>
        <template #rules-end>
          <view v-if="products.length > 0" class="bundle-clear nx-reverse-action" role="button" tabindex="0" :aria-label="t.bundle.clear" @click.stop="clear" @keydown="activate($event, clear)"><text>{{ t.bundle.clear }}</text></view>
        </template>
      </BundleHero>
      <text v-if="products.length > 0" class="bundle-estimate-note">{{ t.store.cardEstimateNote }}</text>

      <BundleSuggestions v-if="suggestions.length > 0" class="bundle-section bundle-rise" anchor="bundle-more" :title="t.bundle.addMore" :items="suggestionRows" @add="addSuggestionById" @open="openDetail" />

      <!-- Room for the bottom action bar: a hidden copy of the tray's rows keeps the last row above it (04 §4.0). -->
      <view class="bundle-bar-space" aria-hidden="true">
        <text v-if="bundleTrayNote" class="bundle-bar-space__note">{{ bundleTrayNote }}</text>
        <view v-if="products.length > 0" class="bundle-bar-space__copy"><text class="bundle-bar-space__total">{{ totalText }}</text><text class="bundle-bar-space__meta">{{ trayMetaText }}</text></view>
        <text class="bundle-bar-space__cta">{{ ctaText }}</text>
      </view>
      </template>
      </template>
    </view>
    </template>
    <!-- Page main action in the shared bottom tray (04 §4.0, 03 §3.1): the total and 已省 in the price slot, one shared primary
         NxButton; when it cannot run the reason sits above it and the button is the tray's flat grey. -->
    <template #pageFixed>
      <!-- Activity with one model on sale: its one action as a lone floating button (the bar's floating form), the shared
           primary L button (03 §3.1); the arrow says it opens the next page. -->
      <view v-if="promotionActivityId && promotionBundle?.single" class="bundle-bar nx-glass-bar">
        <NxButton variant="primary" :label="promotionBundle.single.label" @click="promotionBundle.single.open"><text>{{ promotionBundle.single.label }}</text><NxIcon name="arrow-right" :size="20" /></NxButton>
      </view>
      <view v-if="promotionActivityId && promotionBundle?.footer" class="bundle-bar nx-glass-bar">
        <text v-if="promotionBundle.footer.note" class="nx-tray-note" role="status">{{ promotionBundle.footer.note }}</text>
        <template v-if="promotionBundle.footer.signedIn">
          <view v-if="promotionBundle.footer.showTotal" class="bundle-bar__copy nx-tray-copy">
            <CheckoutAmount class="bundle-bar__total" :value="promotionBundle.footer.total" currency="USD" />
            <text class="bundle-bar__meta"><template v-if="promotionBundle.footer.saved !== null">{{ savedParts[0] }}<text class="bundle-bar__saved">{{ moneyText(promotionBundle.footer.saved) }}</text>{{ savedParts[1] }}</template><template v-else>{{ t.bundle.total }}</template></text>
          </view>
          <NxButton variant="primary" :disabled="!promotionBundle.footer.canContinue" :label="promotionBundle.footer.total !== null && !promotionBundle.footer.devices ? fmt(t.bundle.checkoutAria, { amount: moneyText(promotionBundle.footer.total) }) : promotionBundle.footer.continueLabel" @click="promotionBundle.footer.continue"><text>{{ promotionBundle.footer.continueLabel }}</text><NxIcon v-if="promotionBundle.footer.canContinue" name="arrow-right" :size="20" /></NxButton>
        </template>
        <NxButton v-else variant="primary" :label="t.promotion.signIn" @click="promotionBundle.footer.signIn"><text>{{ t.promotion.signIn }}</text><NxIcon name="arrow-right" :size="20" /></NxButton>
      </view>
      <view v-if="!promotionActivityId && hasCatalog && !receiptWriteFailure" class="bundle-bar nx-glass-bar">
        <text v-if="bundleTrayNote" class="nx-tray-note" role="status">{{ bundleTrayNote }}</text>
        <view v-if="products.length > 0" class="bundle-bar__copy nx-tray-copy">
          <CheckoutAmount class="bundle-bar__total" :value="total" currency="USD" />
          <text class="bundle-bar__meta"><template v-if="discountUSD > 0">{{ savedParts[0] }}<text class="bundle-bar__saved">{{ moneyText(discountUSD) }}</text>{{ savedParts[1] }}</template><template v-else>{{ t.bundle.total }}</template></text>
        </view>
        <!-- Enabled whenever tapping does something: a new bundle to review, or an unpaid original to resume (its label
             says so); disabled only when nothing can run (03 §3.1, §3.4). -->
        <NxButton variant="primary" :disabled="checkoutUnavailable" :busy="checkoutBusy" :label="ctaLabel" @click="onCheckout"><text>{{ ctaText }}</text><NxIcon v-if="!checkoutUnavailable" name="arrow-right" :size="20" /></NxButton>
      </view>
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { useBundleDiscountPolicy } from "@/composables/use-bundle-discount-policy";
import { hasVisiblePullRefresh } from "@/lib/active-page-refresh";
import { promotionCheckoutHref, promotionDetailHref, validEntryItems } from "@/lib/promotion-entry";
function formatAmount(value: Parameters<typeof formatPlainAmount>[0]): string {
  return formatPlainAmount(value).replace(/\B(?=(\d{3})+\.)/g, ",");
}
import { formatAmount as formatPlainAmount } from "@/lib/amount-display";
import { productDailyEstimateRange } from "@/lib/product-estimates";
import { formatEstimateRange } from "@/lib/estimate-display";
import { productTaskLevelsText } from "@/lib/product-copy";
import { computed, ref, watch, type CSSProperties } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import PromotionBundle from '@/components/promotion/promotion-bundle.vue';
import { parseEntryItems,type EntryItem } from '@/lib/promotion-entry';
import EmptyState from "@/components/empty-state.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import NxButton from "@/components/ui/nx-button.vue";
import NxIcon from "@/components/ui/nx-icon.vue";
import CheckoutAmount from "@/components/checkout/CheckoutAmount.vue";
import BundleHero, { type BundleTile } from "@/components/store/bundle-hero.vue";
import BundleSuggestions, { type BundleSuggestion } from "@/components/store/bundle-suggestions.vue";
import { formatGroupedAmount } from "@/lib/amount-display";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useCart, bundleDiscountForCount, type BundleDiscountTier } from "@/store/cart";
import { PRODUCTS, evaluatePurchaseGate, type Product } from "@/mock/products";
import { useSetPageHeader } from "@/composables/use-page-header";
// 🔴 zentao #244:线上模式必须问**服务端**资格,本地门仅 mock 用 —— 与 detail.vue 同一口径。
import { purchaseEligibilityStore } from "@/store/purchase-eligibility";
import { useLocaleStore } from "@/store/locale";
import { useProductPhase } from "@/composables/use-product-phase";
import { productCatalogPresentation, productCatalogState, refreshProductCatalog } from "@/store/product-catalog";
import { bundleCatalogReady } from "@/store/bundle-catalog-guard";
import { isProductAvailable, productHasStock, productOutOfStock } from "@/store/product-availability";
import { ensureServerProductPhase, refreshServerProductPhase } from "@/store/server-product-phase";
import { confirm, toast } from "@/store/ui";
import { confirmInventoryPlacement, type InventoryPlacement } from "@/lib/inventory-placement-confirm";
import { bundleDiscountApi, bundleOrderApi, orderApi, remoteApiEnabled } from "@/api/runtime";
import { matchesBundleQuote, normalizeBundleExpectedAmountUsdt } from "@/api/bundle-order-api";
import { quoteBundleAmountUsdt } from "@/api/bundle-quote";
import { restoreBundleCommand, type PendingBundleCommand } from "@/api/bundle-command";
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
const catalogReady = computed(() => bundleCatalogReady(remoteApiEnabled, catalogStatus.value));
const hasCatalog = computed(() => catalogReady.value || !!productCatalogPresentation.value?.products.length);
const { policy, failed: policyReadFailed, refresh: refreshBundlePolicy } = useBundleDiscountPolicy();
const reviewVisit = ref(0);

onLoad((options) => {
  const query=(options??{}) as Record<string,string>;
  const fallback=new URLSearchParams(takeNavigationQuery('/pages/store/bundle'));
  promotionInitialItems.value=parseEntryItems(query.items||fallback.get('items'))??[];
  promotionActivityId.value=(query.activityId||fallback.get('activityId')||'').trim();
});

onShow(() => {
  reviewVisit.value++;
  void refreshProductCatalog(true);
  void ensureServerProductPhase();
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

const hardware = computed(() => (remoteApiEnabled ? productCatalogPresentation.value?.products ?? [] : PRODUCTS)
  .filter(p => p.productType !== "SHARE" && isProductAvailable(p, phase.value)));
const products = computed(() => cart.items
  .map(id => hardware.value.find(p => p.id === id))
  .filter((p): p is Product => !!p));
const limitReached = computed(() => products.value.length >= 8);
const activeDiscountTiers = computed<ReadonlyArray<BundleDiscountTier> | null>(() => policy.value?.tiers ?? null);
const discountPct = computed(() => bundleDiscountForCount(products.value.length, activeDiscountTiers.value ?? []));
const bundleQuote = computed(() => activeDiscountTiers.value ? quoteBundleAmountUsdt(
  products.value.map((product) => product.price), discountPct.value,
) : null);
const discountUSD = computed(() => bundleQuote.value?.discountUsdt ?? Number.NaN);
const total = computed(() => bundleQuote.value?.amountUsdt ?? Number.NaN);
const cumulativeDailyEarnText = computed(() => {
  let low = 0, high = 0;
  for (const product of products.value) {
    const estimate = productDailyEstimateRange(product);
    if (!estimate) continue;
    low += estimate.low;
    high += estimate.high;
  }
  return formatEstimateRange(low, high, products.value.length > 1);
});
function estimateText(p: Product): string {
  const estimate = productDailyEstimateRange(p);
  // No server estimate: "—", never an annual rate or a figure derived from one.
  return estimate ? `$${formatEstimateRange(estimate.low, estimate.high)}${t.value.store.cardPerDaySuffix}` : "—";
}
const productById = (id: string) => products.value.find((p) => p.id === id);
const heroTiles = computed<BundleTile[]>(() => products.value.map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, price: p.price, estimate: estimateText(p) })));

const suggestions = computed(() => hardware.value.filter(p => !cart.has(p.id)));
// Display rows for 「继续添加」: the trailing control follows the purchase eligibility read (add, locked → detail, none
// when out of stock); the handler stays onAddSuggestion.
const suggestionRows = computed<BundleSuggestion[]>(() => suggestions.value.map((p) => {
  const entry = purchaseEligibilityStore.state(p.id);
  const unavailable = remoteApiEnabled && eligibilityUnavailable(p.id);
  const locked = remoteApiEnabled && entry.status === "ready" && !entry.eligible;
  return {
    id: p.id, name: p.name, imageUrl: p.imageUrl, price: p.price, estimate: estimateText(p),
    notes: [
      ...(remoteApiEnabled && !unavailable && !entry.eligible ? [eligibilityLabel(p.id, t.value.store.gateBlockedToast)] : []),
      ...(p.taskLevels.length ? [productTaskLevelsText(t.value, p.taskLevels)] : []),
    ],
    tag: unavailable ? t.value.store.temporarilyOutOfStock : undefined,
    action: unavailable ? "none" : locked ? "locked" : "add",
    actionLabel: locked ? `${p.name} · ${t.value.store.gateBlockedToast}` : fmt(t.value.uiChrome.addItem, { name: p.name }),
    openable: true,
    disabled: limitReached.value || !catalogReady.value,
  };
}));
function addSuggestionById(id: string) {
  const product = suggestions.value.find((p) => p.id === id);
  if (product) void onAddSuggestion(product);
}
function openDetail(id: string) {
  void navTo(promotionDetailHref(id));
}
// The dashed 「添加」 tile scrolls to 「继续添加」 and moves focus there (same in-page jump as the rule guides' directory).
function jumpToSuggestions() {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (typeof document !== "undefined") {
    const target = document.getElementById("bundle-more");
    target?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    target?.focus({ preventScroll: true });
    return;
  }
  // #ifdef APP-PLUS
  const pages = getCurrentPages();
  const page = pages[pages.length - 1] as unknown as { $getAppWebview?: () => { evalJS: (script: string) => void } };
  page?.$getAppWebview?.().evalJS("var t=document.getElementById('bundle-more');if(t){t.scrollIntoView({block:'start',behavior:window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});t.focus({preventScroll:true});}");
  // #endif
}
const eligibilityProductIds = computed(() => [...products.value, ...suggestions.value].map((p) => p.id));
watch([eligibilityProductIds, () => app.accountKey], ([ids, account], [previousIds, previousAccount]) => {
  if (!remoteApiEnabled) return;
  for (const id of ids) {
    if (account !== previousAccount || !previousIds?.includes(id)) void purchaseEligibilityStore.ensure(id, true);
  }
}, { immediate: true });
watch(productCatalogPresentation, snapshot => {
  if (!remoteApiEnabled || promotionActivityId.value) return;
  for (const product of snapshot?.products ?? []) {
    if (eligibilityProductIds.value.includes(product.id) && productHasStock(product)
      && purchaseEligibilityStore.state(product.id).error === "PRODUCT_OUT_OF_STOCK") {
      void purchaseEligibilityStore.ensure(product.id, true);
    }
  }
});

function eligibilityUnavailable(productNo: string): boolean {
  return productOutOfStock(hardware.value.find(product => product.id === productNo))
    || purchaseEligibilityStore.state(productNo).status === "unavailable";
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
useAutoRecovery({
  active: () => !promotionActivityId.value,
  failed: () => catalogStatus.value === "error",
  retry: () => refreshProductCatalog(true),
  repeatMs: 30_000,
  repeatWhile: () => !hasVisiblePullRefresh(),
});

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

function activate(event: KeyboardEvent, action: () => void | Promise<void>) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  void action();
}

const totalText = computed(() => Number.isFinite(total.value) ? formatAmount(total.value) : "—");
/** "$7,006.08" for the tray's 已省 and the button's screen-reader name; unknown is "—". */
function moneyText(value: number | string | null | undefined): string {
  const text = formatGroupedAmount(value);
  return text === "-" ? "—" : `$${text}`;
}
/** 「已省 {amount}」 split around the amount, so the amount alone takes the main ink in every language's word order. */
const savedParts = computed(() => {
  const [before = "", after = ""] = t.value.bundle.saved.split("{amount}");
  return [before, after];
});
const trayMetaText = computed(() => (discountUSD.value > 0 ? fmt(t.value.bundle.saved, { amount: moneyText(discountUSD.value) }) : t.value.bundle.total));
// An unpaid original of this selection (or an unresolved older command) is what the button resumes: say that, not 去结算.
const ctaText = computed(() => {
  const target = reviewTarget.value;
  if (target === "orders") return t.value.store.coOpenOriginalOrder;
  return target === "checkout-original" || target === "legacy-inline" ? t.value.promotion.resume : t.value.bundle.checkout;
});
const ctaLabel = computed(() => (!isRecoveryTarget(reviewTarget.value) && products.value.length > 0 && Number.isFinite(total.value)
  ? fmt(t.value.bundle.checkoutAria, { amount: moneyText(total.value) }) : ctaText.value));
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

const catalogNote = computed(() => catalogReady.value ? "" : catalogStatus.value === "error"
  ? t.value.store.catalogErrorTitle : t.value.store.catalogLoadingTitle);
const reviewTarget = computed(() => {
  void reviewVisit.value;
  void app.accountBindingEpoch;
  return bundleReviewTarget(products.value);
});
const checkoutBusy = computed(() => submitting.value || (walletRefreshing.value && !isRecoveryTarget(reviewTarget.value)));
const checkoutUnavailable = computed(() => checkoutBusy.value || !!checkoutBlock(products.value, reviewTarget.value));
function checkoutBlock(list: Product[], target: BundleReviewTarget): string {
  if (isRecoveryTarget(target)) return "";
  if (catalogNote.value) return catalogNote.value;
  if (list.length < 2) return t.value.promotion.selectTwo;
  if (list.length > 8) return t.value.promotion.quantityLimit;
  if (!remoteApiEnabled) return bundleQuote.value ? "" : t.value.store.coTotalQuoteChanged;
  const entries = list.map(p => purchaseEligibilityStore.state(p.id));
  if (list.some(product => eligibilityUnavailable(product.id))) return t.value.store.temporarilyOutOfStock;
  if (entries.some((entry) => entry.status === "error")) return t.value.store.purchaseEligibilityError;
  if (entries.some((entry) => entry.status !== "ready")) return t.value.store.purchaseEligibilityLoading;
  return entries.some((entry) => !entry.eligible) ? t.value.store.purchaseEligibilityIneligible : "";
}
const bundleInventoryPlacement = computed((): InventoryPlacement | null => {
  if (!remoteApiEnabled || products.value.length < 2 || app.remoteSlotsUsed === null) return null;
  const slots = Math.max(0, app.slotCap - app.remoteSlotsUsed);
  const inventory = products.value.length - slots;
  return inventory <= 0 ? null : { count: inventory, full: slots === 0 };
});
const bundleTrayNote = computed(() => {
  const reason = checkoutBlock(products.value, reviewTarget.value) || catalogNote.value;
  if (reason) return reason;
  const placement = bundleInventoryPlacement.value;
  if (!placement) return "";
  return placement.full ? t.value.tradein.fullSlotsInventoryNotice
    : fmt(t.value.tradein.partialSlotsInventoryNotice, { count: placement.count });
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
  }
});

function remove(id: string) {
  cart.remove(id);
}
function clear() {
  cart.clear();
}
async function onAddSuggestion(p: Product) {
  if (remoteApiEnabled) {
    const entry = purchaseEligibilityStore.state(p.id);
    if (eligibilityUnavailable(p.id)) return;
    if (entry.status === "ready" && !entry.eligible) {
      openDetail(p.id);
      return;
    }
    if (!catalogReady.value || limitReached.value) return;
    const scope = captureAccountScope();
    const eligible = await purchaseEligibilityStore.ensure(p.id, entry.status !== "loading");
    if (!isCurrentAccountScope(scope)) return;
    if (!eligible) {
      const status = purchaseEligibilityStore.state(p.id).status;
      if (status === "unavailable") return;
      if (status === "error") toast.warn(t.value.store.purchaseEligibilityError);
      else openDetail(p.id);
      return;
    }
  }
  if (!catalogReady.value || limitReached.value || !suggestions.value.some(product => product.id === p.id)) return;
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

type BundleReviewTarget = "new" | "checkout-original" | "legacy-inline" | "orders" | "storage-error";

function isRecoveryTarget(target: BundleReviewTarget): boolean {
  return target === "checkout-original" || target === "legacy-inline" || target === "orders";
}

function bundleReviewTarget(list: Product[]): BundleReviewTarget {
  if (!remoteApiEnabled) return "new";
  try {
    const rows=readAccountRow<PendingBundleCommands>(BUNDLE_COMMAND_KEY,orders.currentAccountKey(),true);
    const commands=rows?.commands??{};
    if (Object.keys(commands).length) return commands[bundleFingerprint(list)] ? "legacy-inline" : "orders";
  } catch {
    return "storage-error";
  }
  try {
    const items=list.map(product=>({productNo:product.id,quantity:1}));
    const {record}=selectPromotionCheckoutRecord(readAccountRow<Record<string,PromotionCheckoutRecord>>(PROMOTION_CHECKOUT_TABLE,app.accountKey,true)??{},{activityId:'',items});
    if (record?.pending || record?.order?.paymentStatus === 'PENDING'
      || list.some(product => !!readCapacityPending(app.accountKey, product.id))) return "checkout-original";
  } catch { /* The checkout reads its recovery storage again before allowing a new purchase. */ }
  return "new";
}

// Existing commands stay on their recovery path, while new bundles open the shared review.
async function openBundleReview(list: Product[], target: BundleReviewTarget): Promise<boolean> {
  if (receiptWriteFailure.value || target === "storage-error") {
    if (target === "storage-error") toast.warn(t.value.bundle.checkoutOutcomeUnknown);
    return true;
  }
  if (target === "legacy-inline") return false;
  submitting.value = true;
  try {
    const items = list.map(product => ({ productNo: product.id, quantity: 1 }));
    if (target === "orders" || !validEntryItems(items)) {
      toast.warn(t.value.bundle.checkoutOutcomeUnknown);
      await navTo("/pages/store/orders");
    } else {
      await navTo(promotionCheckoutHref(items, undefined, { fromBundle: true }));
    }
  }catch{toast.warn(t.value.bundle.checkoutOutcomeUnknown);}
  finally{submitting.value=false;}
  return true;
}
async function onCheckout() {
  const list = products.value;
  const target = bundleReviewTarget(list);
  if (submitting.value || (walletRefreshing.value && !isRecoveryTarget(target)) || checkoutBlock(list, target)) return;
  if (!isRecoveryTarget(target) && !validEntryItems(list.map(p => ({ productNo: p.id, quantity: 1 })), 2)) return;
  // Devices going to inventory (the tray note) need the user's confirmation before checkout (PRD §7.3).
  const placement = isRecoveryTarget(target) ? null : bundleInventoryPlacement.value;
  if (placement && (!await confirmInventoryPlacement(t.value, placement, "checkout") || submitting.value || checkoutBlock(list, target))) return;
  if (remoteApiEnabled) {
    if(await openBundleReview(list, target))return;
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
      if (latestPolicy.serverCanonical !== true) return;
      if (!policy.value || latestPolicy.policyVersion !== policy.value.policyVersion) {
        policy.value = latestPolicy;
        policyReadFailed.value = false;
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
        const paid = await executeSelectedPurchase({
          amount:command.expectedAmountUsdt,currency:'USDT',summary:list.map(product=>product.name).join(', '),
          details:persisted.lineItems?.map(item=>({name:item.name,quantity:item.quantity,amount:item.lineAmountUsdt})),
        },
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
        if (!settled || settled.status !== paid.canonicalStatus) {
          throw new Error("BUNDLE_WALLET_PAYMENT_READBACK_MISMATCH");
        }
        if(paymentKey)clearOrderAction(accountKey,created.orderNo,paymentKey);
        // Order + wallet receipt are already canonical. Fleet projection is
        // best effort and must never cause a second payment submission.
        void app.refreshRemoteFleet(walletReceiptScope);
        toast.success(settled.status === "inventory" ? t.value.orders.statusInventory : t.value.orders.statusActivated);
        const orderHref = "/pages/store/order-detail?id=" + encodeURIComponent(created.orderNo);
        navTo(settled.status === "inventory" ? orderHref + "&result=delivery" : orderHref);
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
      policyReadFailed.value = true;
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

</script>

<style scoped>
/* Section rhythm (01 §1.3): 32 between sections, 24 at ≤374 (--ui-space-section-gap). */
.bundle-section { display: block; margin-top: var(--ui-space-section-gap); }
/* Entrance once (07): the focal card, then the list, rise into place; transform and opacity only. */
.bundle-rise { animation: bundle-rise .42s cubic-bezier(.16,1,.3,1) both; }
.bundle-rise + .bundle-estimate-note + .bundle-rise, .bundle-rise + .bundle-rise { animation-delay: .06s; }
@keyframes bundle-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.bundle-estimate-note { display: block; margin: 8px 18px 0; color: var(--v5-ink-3); font: var(--ui-type-note-weight) var(--ui-type-note)/var(--ui-type-note-lh) var(--font-v5); overflow-wrap: break-word; }
.bundle-tile-note { display: block; margin-top: 2px; color: var(--v5-ink-3); font: var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); overflow-wrap: break-word; }
/* Out of stock on a chosen model: the shared neutral tag (03 §3.8), one short word; the reason is in the tray note. */
.bundle-tile-tag { align-self: flex-start; margin-top: 6px; }
/* 「全部清空」 is a reverse action (03 §3.1 .nx-reverse-action): quiet ink-3 text, 13/18 400, no container, 44 target. */
.bundle-clear { position: relative; flex: none; cursor: pointer; white-space: nowrap; -webkit-tap-highlight-color: transparent; }
.bundle-clear::after { content: ""; position: absolute; top: calc(50% - 22px); bottom: calc(50% - 22px); left: -10px; right: -10px; }
.bundle-clear:active { opacity: .6; }
.bundle-clear:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; border-radius: 8px; }
/* First load: a still placeholder in the focal card's shape (03 §3.4), no shimmer. */
.bundle-skeleton { margin: 0 16px; padding: 20px; border-radius: var(--ui-radius-surface); }
.bundle-skeleton__bar { width: 60%; height: 12px; border-radius: 6px; background: color-mix(in srgb, var(--v5-ink) 8%, transparent); }
.bundle-skeleton__bar--title { width: 40%; height: 20px; margin: 4px 0 12px; }
.bundle-skeleton__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
.bundle-skeleton__tile { min-height: 128px; border-radius: 16px; background: var(--v5-surface-2); }
.bundle-receipt { padding: 24px 20px; border-radius: var(--ui-radius-surface); background: var(--v5-surface); border: 1px solid var(--v5-border); text-align: center; }
.bundle-receipt__retry { margin-top: 4px; }
/* Bottom tray (04 §4.0): the shared .nx-glass-bar gives position, material and the disabled grey; the page sets layout.
   Price slot: total 20/24 Montserrat (the checkout total) over 「已省 $x」; the button keeps one line and moves to its
   own row, right-aligned, when the row cannot hold both (03 §3.6.1). */
.bundle-bar { position: absolute; z-index: 36; display: flex; flex-wrap: wrap; align-items: center; animation: bundle-bar-in .42s cubic-bezier(.16,1,.3,1) .2s both; }
.bundle-bar .nx-tray-note { flex: 1 1 100%; }
.bundle-bar__copy { flex: 1 1 auto; min-width: 0; }
.bundle-bar__total { display: block; color: var(--v5-ink); font: 500 20px/24px var(--font-amount); white-space: nowrap; }
.bundle-bar__meta { display: block; color: var(--v5-ink-3); font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); white-space: nowrap; }
.bundle-bar__saved { color: var(--v5-ink); font-weight: 500; font-variant-numeric: tabular-nums; }
/* The shared primary NxButton, L 48 (03 §3.1); the shared tray rules give its disabled grey and busy spinner. */
.bundle-bar > .nx-button { flex: 0 0 auto; min-width: 150px; margin-left: auto; }
.bundle-bar > .nx-tray-note + .nx-button, .bundle-bar > .nx-button:only-child { flex: 1 1 100%; }
/* Room for the tray: a hidden copy of its rows (same widths: 12 sides, 8 padding and gap). The page already ends 64
   below the last row (pb-6 24 + chassis 40); the tray needs its height + 22 + 16, so the copy gives back 26. */
.bundle-bar-space { visibility: hidden; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 12px -26px; padding: 8px; }
.bundle-bar-space__note { flex: 1 1 100%; padding: 4px 12px 0; font: var(--ui-type-meta-weight, 400) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); text-align: center; overflow-wrap: break-word; text-wrap: pretty; }
.bundle-bar-space__copy { flex: 1 1 auto; min-width: 0; padding: 0 12px; }
.bundle-bar-space__total { display: block; font: 500 20px/24px var(--font-amount); white-space: nowrap; }
.bundle-bar-space__meta { display: block; font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); white-space: nowrap; }
.bundle-bar-space__cta { flex: 0 0 auto; min-width: 150px; margin-left: auto; box-sizing: border-box; min-height: 48px; padding: 14px 46px 14px 20px; font: var(--ui-type-button-weight) var(--ui-type-button)/var(--ui-type-button-lh) var(--font-v5); white-space: nowrap; }
.bundle-bar-space__note + .bundle-bar-space__cta { flex: 1 1 100%; }
@keyframes bundle-bar-in { from { transform: translateY(100%); } to { transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .bundle-bar, .bundle-rise { animation: none; }
}
</style>
