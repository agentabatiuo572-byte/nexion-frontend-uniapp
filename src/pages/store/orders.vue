<!--
  Orders list — ported from Nexion-prototype/app/(main)/store/orders/page.tsx.
  Order list from the orders store: empty state (browse-store CTA) or a list of
  status-badged cards, each navigating to order-detail (?id=). Wrapped in
  <AppChassis active="store">; back + "Orders" title live in the sticky
  chassis nav header via useSetPageHeader (title-only — no subtitle: the
  platform is IDC-hosted colocation, nothing is physically shipped to the
  user, so a "track your shipment" line doesn't apply — see 更新日志 2026-07-08).
-->
<template>
  <AppChassis active="store" :scroll-load-key="`${statusFilter}:${app.accountBindingEpoch}`" @scroll-load-more="scrollPager.loadMoreManually()">
    <!-- Chassis-nav pages (useSetPageHeader) don't get sub-page-header.vue's global
         24px .spv gap, so the nav→content breathing is supplied here once. -->
    <view style="color: var(--v5-ink); padding-top: 24px">
      <view v-if="orderPanels.mainPresentation === 'loading'" class="mx-4 rounded-2xl" :style="remoteErrorStyle">
        <text :style="{ color: 'var(--v5-ink-3)', fontSize: '12px', lineHeight: '1.5' }">{{ t.store.catalogLoadingTitle }}</text>
      </view>

      <view v-if="orderPanels.showSourceOutage && !orderList.length && !wholeOrdersPageUnavailable" class="mx-4 rounded-2xl" :style="remoteErrorStyle"><text style="color:var(--v5-ink-3)">—</text></view>

      <!-- An empty claim requires every order source to have loaded successfully. -->
      <EmptyState
        v-if="wholeOrdersPageUnavailable || orderPanels.mainPresentation === 'empty' && !paymentCards.length && !hasMoreOrders"
        :kind="wholeOrdersPageUnavailable ? 'recoverable-error' : 'empty-list'" :page="wholeOrdersPageUnavailable"
        :title="wholeOrdersPageUnavailable ? t.orders.refreshFailed : t.empty.ordersTitle"
        :desc="wholeOrdersPageUnavailable ? undefined : t.empty.ordersDesc"
        :cta-label="wholeOrdersPageUnavailable ? t.ui.reload : t.empty.ordersCta"
        @cta="wholeOrdersPageUnavailable ? retryOrders() : goStore()"
      />

      <!-- Order list — transparent hairline group (row cards flattened; the
           container border-top opens the group, each row keeps a divider). -->
      <GlassSegments v-if="listShown" v-model="statusFilter" :options="filterOptions" layout="scroll" selection="flat" semantics="radio" :label="t.orders.filterGroupLabel" class="orders-filters mx-4">
        <template #option="{ option }"><text class="orders-filter__label">{{ option.label }}</text><text v-if="option.value === 'pending' && pendingCount > 0" class="orders-filter__badge">{{ pendingCount }}</text></template>
      </GlassSegments>
      <text v-if="listShown && filteredCards.length === 0" class="orders-filter-empty">{{ t.orders.filterEmpty }}</text>
      <!-- Order cards: machine art + status tag; the whole card opens the detail,
           the pending row's own button goes straight to payment. -->
      <view v-if="listShown && (filteredCards.length > 0)" class="orders-list">
        <template v-for="item in filteredCards" :key="item.kind === 'payment' ? item.key : item.id">
        <!-- Payments with no order card of their own (trade-in, slot capacity, trial purchase, or an order no longer awaiting
             payment) use the order card's layout; the whole card resumes that payment (user 2026-11-24). -->
        <view v-if="item.kind === 'payment'" class="order-card" role="button" tabindex="0" :aria-label="item.title + ' · ' + item.tag"
          @click="openPaymentCard(item)" @keydown.enter.prevent="!$event.repeat && openPaymentCard(item)" @keydown.space.prevent="!$event.repeat && openPaymentCard(item)">
          <view class="order-card__row">
            <LoopScope class="order-card__thumb" aria-hidden="true">
              <CatalogMachineImage class="order-card__image nx-home-art-float" :sku="item.sku" :image-url="item.imageUrl" :scope-key="item.key" />
            </LoopScope>
            <view class="order-card__info">
              <view class="order-card__top">
                <text class="order-card__title">{{ item.title }}</text>
                <NxTag :tone="item.tone" :label="item.tag" />
              </view>
              <view v-if="item.orderNo" class="order-card__meta order-card__code"><text class="order-card__code-label">{{ t.orders.orderId }}</text><NxCodeValue class="order-card__code-value" :value="item.orderNo" :label="t.orders.orderId" :copyable="false" /></view>
              <text v-else class="order-card__meta order-card__meta--wrap">{{ item.kindLabel }} · {{ item.method }}</text>
              <view class="order-card__bottom">
                <text v-if="item.startedAt !== undefined" class="order-card__date">{{ dateText(item.startedAt) }}</text>
                <CheckoutAmount class="order-card__amount" v-bind="item.amount" />
              </view>
            </view>
          </view>
        </view>
        <!-- Only an expired order swipes left to its delete action (03 §3.5); every other card keeps the same wrapper, inert. -->
        <ConversationSwipeRow v-else class="order-swipe" :class="{ 'order-swipe--live': swipeable(item) }"
          :label="commerceOrderTitle(item, locale.code) + ' · ' + item.id" :delete-label="t.orders.expiredDelete" :disabled="!swipeable(item)"
          :open="swipeOpenId === item.id" @update:open="swipeOpenId = $event ? item.id : ''" @delete="deleteTarget = item">
        <view
          class="order-card"
          :data-order-id="item.kind === 'commerce' ? item.id : undefined"
          :class="{ 'order-card--pending': item.kind === 'commerce' && item.status === 'placed', 'nx-tint': item.id === tintedPendingId }"
          :role="item.kind === 'genesis' ? undefined : 'button'"
          :tabindex="item.kind === 'genesis' ? undefined : 0"
          :aria-label="item.kind === 'genesis' ? undefined : orderCardLabel(item)"
          @click="item.kind !== 'genesis' && goOrder(item)"
        >
          <!-- A Genesis card opens the holdings overview, where this order number is not shown: only its main row
               opens it, and the order number with its copy button sits below, outside that tap area. -->
          <view class="order-card__row" :role="item.kind === 'genesis' ? 'button' : undefined" :tabindex="item.kind === 'genesis' ? 0 : undefined" :aria-label="item.kind === 'genesis' ? orderCardLabel(item) : undefined" @click="item.kind === 'genesis' && goOrder(item)">
            <LoopScope class="order-card__thumb" :class="{ 'order-card__thumb--genesis': item.kind === 'genesis' }" aria-hidden="true">
              <CatalogMachineImage v-if="item.kind === 'commerce'" class="order-card__image nx-home-art-float" :sku="item.lineItems?.[0]?.sku ?? item.productId" :image-url="orderImage(item)" :scope-key="item.id" />
              <image v-else class="order-card__image order-card__image--genesis nx-home-art-float" :src="GENESIS_MEDIA.showcase" mode="aspectFit" />
            </LoopScope>
            <view class="order-card__info">
              <view class="order-card__top">
                <text class="order-card__title">{{ commerceOrderTitle(item,locale.code) }}</text>
                <NxTag :tone="badge(item.status).tone" :label="badge(item.status).label" />
              </view>
              <view v-if="item.kind !== 'genesis'" class="order-card__meta order-card__code"><text class="order-card__code-label">{{ t.orders.orderId }}</text><NxCodeValue class="order-card__code-value" :value="item.id" :label="t.orders.orderId" :copyable="false" /></view>
              <text v-if="item.meta" class="order-card__meta">{{ item.meta }}</text>
              <view class="order-card__bottom">
                <text class="order-card__date">{{ dateText(item.placedAt) }}</text>
                <CheckoutAmount class="order-card__amount" v-bind="item.kind === 'commerce' ? commerceOrderAmount(item) : { value: item.total, currency: 'USDT' }" />
              </view>
            </view>
          </view>
          <view v-if="item.kind === 'genesis'" class="order-card__meta order-card__code order-card__code--copy"><text class="order-card__code-label">{{ t.orders.orderId }}</text><NxCodeValue class="order-card__code-value" :value="item.id" :label="t.orders.orderId" /></view>
          <view v-if="item.kind === 'commerce' && item.status === 'placed'" class="nx-card-footer order-card__pending">
            <view v-if="pendingCloseMinutes(item)" class="order-card__countdown">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              <text>{{ fmt(t.orders.pendingCloseIn, { min: pendingCloseMinutes(item)! }) }}</text>
            </view>
            <!-- Stops the tap here so the card does not also open the plain detail. -->
            <view class="order-card__pay" @click.stop>
              <view class="nx-card-action" role="button" tabindex="0" @click="goOrderPayment(item)" @keydown.enter.prevent="!$event.repeat && goOrderPayment(item)" @keydown.space.prevent="!$event.repeat && goOrderPayment(item)"><text>{{ t.orders.pendingContinue }}</text><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg></view>
            </view>
          </view>
        </view>
        </ConversationSwipeRow>
        </template>
      </view>
      <view v-if="orderPanels.mainPresentation === 'list' || hasMoreOrders" class="orders-pagination mx-4">
        <view ref="scrollAnchor" style="height: 1px" />
        <view
          v-if="remoteApiEnabled && orders.nextCursor"
          class="grid place-items-center active:opacity-80"
          :style="loadMoreBtnStyle"
          role="button"
          tabindex="0"
          :aria-disabled="orders.loadingMore ? 'true' : 'false'"
          @click.stop="loadMoreOrders"
          @keydown.enter.prevent.stop="loadMoreOrders"
          @keydown.space.prevent.stop="loadMoreOrders"
        >
          <text>{{ t.orders.loadMore }}{{ orders.loadingMore ? '…' : '' }}</text>
        </view>
        <view v-if="remoteApiEnabled && genesis.orderPage.cursor" class="active:opacity-70" :style="loadMoreBtnStyle" role="button" tabindex="0" :aria-disabled="genesis.orderPage.busy ? 'true' : 'false'" :aria-busy="genesis.orderPage.busy ? 'true' : 'false'" @click="loadMoreOrderPage()">
          <text>{{ t.orders.loadMore }} · {{ t.me.genesisNode }}</text>
        </view>
      </view>
    </view>
    <NxNoticeDialog :open="!!deleteTarget" :title="t.orders.expiredDeleteTitle" :body="t.orders.expiredDeleteBody" :primary="t.orders.expiredDelete" :secondary="t.ui.cancel"
      icon="trash" tone="danger" @primary="confirmDeleteExpired" @secondary="deleteTarget = null">
      <!-- The order being deleted (03 §3.5 明确对象): its full product name, and the order number as one long code (03 §3.6.1). -->
      <view v-if="deleteTarget" class="order-delete-target">
        <text class="order-delete-target__name">{{ commerceOrderTitle(deleteTarget, locale.code) }}</text>
        <view class="order-delete-target__code"><text class="order-delete-target__label">{{ t.orders.orderId }}</text><NxCodeValue class="order-delete-target__value" :value="deleteTarget.id" :label="t.orders.orderId" :copyable="false" /></view>
      </view>
    </NxNoticeDialog>
  </AppChassis>
</template>

<script setup lang="ts">
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { foregroundReadAllowed } from "@/lib/foreground-read";
import { toast } from "@/store/ui";
import { dateLocale, fmt } from "@/i18n/format";
import { commerceOrderAmount, commerceOrderTitle, commercePaymentCurrency } from "@/lib/commerce-review";
import { useLocaleStore } from "@/store/locale";
import { commerceAmount as formatAmount } from "@/lib/commerce-review";
import { computed, nextTick, ref, watch, onUnmounted, type CSSProperties } from "vue";
import { revalidateProductCatalog } from "@/store/product-catalog";
import CatalogMachineImage from "@/components/catalog-machine-image.vue";
import LoopScope from "@/components/loop-scope.vue";
import AppChassis from "@/components/app-chassis.vue";
import EmptyState from "@/components/empty-state.vue";
import GlassSegments from "@/components/glass-segments.vue";
import CheckoutAmount from "@/components/checkout/CheckoutAmount.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import NxNoticeDialog from "@/components/ui/nx-notice-dialog.vue";
import ConversationSwipeRow from "@/components/support/conversation-swipe-row.vue";
import { landFocusOnPage } from "@/composables/use-dialog-a11y";
import { hasUnfinishedOrderPayment, isOrdersPurchaseRecord, isUnfinishedPurchaseRecord, orderPaymentDeadline, purchaseRecordPayload, refreshPendingPayments, rememberOrderPaymentBeforeHide, usePurchasePayment } from "@/store/purchase-payment";
import { purchasePaymentCopy } from "@/lib/purchase-payment-copy";
import { useDeviceSlotReplacementCopy } from "@/i18n/device-slot-replacement";
import { GENESIS_MEDIA, getProductMedia, getOrderProductMedia } from "@/lib/product-media";
import { useT } from "@/i18n/use-t";
import { formatTrialDate } from "@/lib/trial-date";
import { useMeEntryRead } from "@/composables/use-me-entry-read";
import { latestMeOrders } from "@/lib/me-entry-facts";
import { useMeEntrySeen } from "@/store/me-entry-seen";
import { useOrders, type Order, type OrderStatus } from "@/store/orders";
import { useGenesis } from "@/store/genesis";
import { genesisOrderListItems, type GenesisOrderListItem } from "@/lib/genesis-order-list";
import { useSetPageHeader } from "@/composables/use-page-header";
import { useNow } from "@/composables/use-now";
import { useVisibleInterval } from "@/composables/use-tab-page-lifecycle";
import { navTo, takeNavigationQuery } from "@/lib/route";
import { onHide, onLoad, onShow } from "@dcloudio/uni-app";
import { remoteApiEnabled, sessionVault } from "@/api/runtime";
import { captureRuntimeRevision, isCurrentRuntimeRevision, subscribeRuntimeRevision } from "@/api/order-api";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { binarySessionReady } from "@/lib/binary-session-ready";
import NxCodeValue from "@/components/ui/nx-code-value.vue";
import { useManualScrollLoadMore } from "@/composables/use-manual-scroll-load-more";
import {
  createRemoteOrdersRefresh,
  isInitialOrderReadLoading,
  orderListPanels,
  remoteCommerceRequestCurrent,
  type OrderSourceAvailability,
} from "@/lib/remote-commerce-refresh";

const t = useT();
const locale = useLocaleStore();
const app = useApp();
const auth = useAuth();
const orders = useOrders();
const genesis = useGenesis();
async function loadMoreOrderPage() {
  if (genesis.orderPage.busy) return;
  const epoch = useApp().accountBindingEpoch;
  await genesis.loadMoreGenesisOrders();
  if (epoch === useApp().accountBindingEpoch && genesis.orderPage.error) toast.error(t.value.orders.refreshFailed);
}
// Cold H5 loads restore the bearer through the refresh cookie. A protected
// order read started before that returns AUTH_REQUIRED, which is what left the
// commerce and genesis panels on "暂时无法确认账号状态" until a reload.
const remoteSessionReady = computed(() => binarySessionReady({
  remote: remoteApiEnabled,
  authenticated: auth.isAuthenticated,
  accountId: auth.accountId,
  appAccountKey: app.accountKey,
  sessionUserId: sessionVault.read()?.user.userId ?? null,
}));
type CommerceOrderListItem = Order & { kind: "commerce"; meta?: string };
type OrderListItem = CommerceOrderListItem | GenesisOrderListItem;
const orderList = computed<OrderListItem[]>(() => [
  ...orders.visibleOrders.map((order): CommerceOrderListItem => ({ ...order, kind: "commerce" })),
  ...genesisOrderListItems(genesis.remoteOrders, t.value.me.genesisNode, t.value.orders.quantity),
]);
// Status categories. "To pay" matches the home to-do count (placed or payment failed).
function orderCategory(order: OrderListItem): Exclude<OrderFilter, "all"> {
  if (order.kind === "genesis") return "done";
  if (order.status === "placed" || order.status === "payment_failed") return "pending";
  if (order.status === "paid" || order.status === "provisioning") return "active";
  return order.status === "activated" || order.status === "inventory" ? "done" : "closed";
}
// Unfinished payments with no order card of their own (user 2026-11-24: Orders shows them instead of the floating bar).
const payment = usePurchasePayment();
const paymentCopy = computed(() => purchasePaymentCopy(locale.code));
const slotCopy = useDeviceSlotReplacementCopy();
type PaymentRow = ReturnType<typeof payment.records>[number];
type PaymentCard = { kind: "payment"; key: string; row: PaymentRow; title: string; tag: string; tone: "success" | "warning"; sku?: string; imageUrl?: string; orderNo?: string; kindLabel: string; method: string; startedAt?: number; amount: { value: string | number | null; currency: "USD" | "USDT" } };
const paymentRecords = computed(() => payment.records());
const paymentCards = computed<PaymentCard[]>(() => paymentRecords.value.flatMap((row): PaymentCard[] => {
  if (!isUnfinishedPurchaseRecord(row) || !isOrdersPurchaseRecord(row)) return [];
  const payload = purchaseRecordPayload(row), c = paymentCopy.value;
  const base = { kind: "payment" as const, key: row.commandKey, row, title: row.summary,
    tag: row.lastStatus === "MANUAL_REVIEW" ? c.confirming : row.lastStatus === "FUNDS_CONFIRMED" ? c.received : c.waiting,
    // Money received (03 §3.8) reads as success; waiting and confirmation stay warning.
    tone: row.lastStatus === "FUNDS_CONFIRMED" ? "success" as const : "warning" as const,
    startedAt: Number.isFinite(row.startedAt) ? row.startedAt : undefined };
  const currency = commercePaymentCurrency(row.paymentMethod);
  if (row.kind === "ORDER_PAY") {
    if (typeof payload.orderNo !== "string") return [];
    const order = orders.getById(payload.orderNo);
    // An absent order needs the expired order facts saved at hide confirmation.
    if (order?.status === "placed") return [];
    const details = order ? { sku: order.lineItems?.[0]?.sku ?? order.productId, imageUrl: getOrderProductMedia(order.productId, order.lineItems)?.src, amount: commerceOrderAmount(order) }
      : row.hiddenOrder && { sku: row.hiddenOrder.sku, imageUrl: getOrderProductMedia(row.hiddenOrder.sku)?.src, amount: { value: row.hiddenOrder.total, currency: "USD" as const } };
    if (!details) return [];
    // A resumed original payment has no local start time; it sorts and dates by its order.
    return [{ ...base, ...details, startedAt: base.startedAt ?? order?.placedAt ?? row.hiddenOrder?.placedAt, orderNo: payload.orderNo, kindLabel: "", method: "",
      amount: row.paymentMethod ? { ...details.amount, currency } : details.amount }];
  }
  const kindLabel = row.kind === "TRADE_IN" ? t.value.search.routes.tradeIn.label : row.kind === "CAPACITY_REPLACE" ? slotCopy.value.replace
    : row.kind === "CAPACITY_KEEP" ? c.kindCapacityKeep : c.kindTrialConvert;
  const method = row.paymentMethod === "HDPAY_BANK" ? c.bank : row.paymentMethod === "CREGIS_USDT_ERC20" ? c.erc20 : row.paymentMethod === "CREGIS_USDT_TRC20" ? c.trc20 : c.bep20;
  // The amount the purchase asked for, as saved with the payment (before channel and network fees).
  const amount = payload.expectedPayableUsdt ?? payload.expectedAmountUsdt;
  const productNo = payload.targetProductNo ?? payload.productNo;
  const sku = typeof productNo === "string" ? productNo : undefined;
  return [{ ...base, sku, imageUrl: getProductMedia(sku)?.src, kindLabel, method,
    amount: { value: typeof amount === "string" || typeof amount === "number" ? amount : null, currency } }];
}));
type ListCard = OrderListItem | PaymentCard;
function cardCategory(card: ListCard) {
  return card.kind === "payment" ? "pending" : orderCategory(card);
}
function cardTime(card: ListCard) {
  return card.kind === "payment" ? card.startedAt ?? 0 : card.placedAt;
}
const filteredCards = computed(() => [...orderList.value, ...paymentCards.value]
  .filter(card => statusFilter.value === "all" || cardCategory(card) === statusFilter.value)
  .sort((a, b) => cardTime(b) - cardTime(a)));
const hasMoreOrders = computed(() => remoteApiEnabled && Boolean(orders.nextCursor || genesis.orderPage.cursor));
// A next page can still provide orders even if every card on the current page was hidden.
const listShown = computed(() => orderPanels.value.mainPresentation === "list"
  || orderPanels.value.mainPresentation !== "loading" && (paymentCards.value.length > 0 || hasMoreOrders.value));
function openPaymentCard(card: PaymentCard) { void payment.resume(card.row); }
const pendingCount = computed(() => orderList.value.filter(order => orderCategory(order) === "pending").length + paymentCards.value.length);
const swipeOpenId = ref("");
const deleteTarget = ref<OrderListItem | null>(null);
const hidingOrderId = ref("");
function swipeable(order: OrderListItem): boolean {
  return remoteApiEnabled && order.kind === "commerce" && order.status === "expired" && order.id !== hidingOrderId.value
    && !hasUnfinishedOrderPayment(app.accountKey, order.id);
}
async function confirmDeleteExpired() {
  const id = deleteTarget.value?.id;
  deleteTarget.value = null;
  swipeOpenId.value = "";
  const order = orderList.value.find((item): item is CommerceOrderListItem => item.kind === "commerce" && item.id === id);
  if (!order || !swipeable(order) || hidingOrderId.value) return;
  const epoch = app.accountBindingEpoch;
  const commerceIds = filteredCards.value.flatMap(card => card.kind === "commerce" ? [card.id] : []);
  const at = commerceIds.indexOf(order.id);
  hidingOrderId.value = order.id;
  rememberOrderPaymentBeforeHide(app.accountKey, order);
  const hidden = await orders.hideExpiredOrder(order.id);
  if (epoch !== app.accountBindingEpoch) return;
  hidingOrderId.value = "";
  if (!hidden) toast.error(t.value.security.opFailed);
  // The swipe action that opened the dialog is gone either way (03 §3.5): focus the card now in its place (the next one,
  // or the one before when it was last), or the same card when it stays; the page title when no card is left.
  const target = hidden ? commerceIds[at + 1] ?? commerceIds[at - 1] : order.id;
  await nextTick();
  const card = target && typeof document !== "undefined"
    ? document.querySelector<HTMLElement>(`.order-card[data-order-id="${CSS.escape(target)}"]`) : null;
  if (card) card.focus({ preventScroll: true }); else landFocusOnPage();
}
// One tinted card per screen region (01 §1.1.2): only the first awaiting-payment card in the list carries the warning tint; the rest stay solid.
const tintedPendingId = computed(() => filteredCards.value.find((order): order is CommerceOrderListItem =>
  order.kind === "commerce" && order.status === "placed")?.id);
// Minutes left on an unpaid order's server deadline; null once it lapses or when unknown.
const nowSeconds = useNow();
function pendingCloseMinutes(order: OrderListItem): number | null {
  if (order.kind === "genesis" || order.status !== "placed" || order.expiresAt == null) return null;
  const left = order.expiresAt - nowSeconds.value * 1000;
  return left > 0 ? Math.ceil(left / 60000) : null;
}
const filterOptions = computed(() => ORDER_FILTERS.map(value => ({ value, label: t.value.orders.filters[value] })));
const remoteOrderAvailability = ref<OrderSourceAvailability>("ready");
const remoteOrdersRefreshing = ref(remoteApiEnabled);
const remoteOrdersResolved = ref(false);
const commerceOrdersUnavailable = ref(false);
const genesisOrdersUnavailable = ref(false);
const unavailableOrderSources = computed(() => [
  ...(commerceOrdersUnavailable.value ? [{ label: t.value.headerTitles.storeOrders, message: t.value.orders.refreshFailed }] : []),
  // Order history and Genesis eligibility are separate reads. An order-source
  // failure must not display the series opening status on the orders page.
  ...(genesisOrdersUnavailable.value ? [{
    label: t.value.me.genesisNode,
    message: t.value.orders.refreshFailed,
  }] : []),
]);
const orderPanels = computed(() => orderListPanels({
  loading: isInitialOrderReadLoading({
    loading: remoteOrdersRefreshing.value,
    hasResolved: remoteOrdersResolved.value,
  }),
  availability: remoteOrderAvailability.value,
  orderCount: orderList.value.length,
}));
const wholeOrdersPageUnavailable = computed(() => orderPanels.value.mainPresentation === "unavailable"
  && !orderList.value.length && !paymentCards.value.length && !hasMoreOrders.value);
const ordersReadFailed = ref(false);
let refreshEpoch = 0;
const ordersPageActive = ref(true);
const ordersEntryRead = useMeEntryRead(() => ordersPageActive.value);
const entrySeen = useMeEntrySeen();
// The server reconciles historical transfers separately, without a fixed
// acceptance cutoff. Limit the client's expired-intent snapshot reads to a day.
const latePaymentReadWindow = 24 * 60 * 60_000;
const orderPaymentReadKeys = computed(() => new Set(paymentRecords.value.filter(row => {
  // Any unfinished order payment is read here, also one only discovered: it keeps the delete guard true to its status.
  if (isUnfinishedPurchaseRecord(row)) return isOrdersPurchaseRecord(row) || row.kind === "ORDER_PAY";
  // An expired order payment is read again for a late transfer even when it was only discovered (not opened) here:
  // a confirmation then shows the floating bar and keeps the expired order from being deleted.
  if (row.kind !== "ORDER_PAY" || row.lastStatus !== "EXPIRED" || !row.intentNo || row.businessDelivered || row.validated) return false;
  const { orderNo } = purchaseRecordPayload(row);
  if (typeof orderNo !== "string") return false;
  const order = orders.getById(orderNo);
  if (order && order.status !== "expired") return false;
  const deadline = orderPaymentDeadline(row, order);
  return deadline !== undefined && nowSeconds.value * 1000 < deadline + latePaymentReadWindow;
}).map(row => row.commandKey)));
const watchesPayments = () => remoteSessionReady.value && orderPaymentReadKeys.value.size > 0 && !payment.state.open && foregroundReadAllowed();
useVisibleInterval(() => {
  const accountKey = app.accountKey;
  void nextTick(() => refreshPendingPayments(accountKey,
    () => ordersPageActive.value && watchesPayments(),
    row => orderPaymentReadKeys.value.has(row.commandKey), true));
}, 15000, watchesPayments);
async function refreshOrders() {
  if (!remoteApiEnabled || !remoteSessionReady.value) return;
  const request = { accountKey: app.accountKey, epoch: app.accountBindingEpoch };
  const runtime = captureRuntimeRevision();
  const currentRefresh = ++refreshEpoch;
  const current = () => ordersPageActive.value && currentRefresh === refreshEpoch && isCurrentRuntimeRevision(runtime) && remoteCommerceRequestCurrent(request, {
    accountKey: app.accountKey,
    epoch: app.accountBindingEpoch,
  });
  ordersReadFailed.value = false;
  remoteOrdersRefreshing.value = true;
  // Keep the previous source outcome during recovery. A new first read must
  // not present an empty list as a confirmed result.
  if (!remoteOrdersResolved.value) {
    remoteOrderAvailability.value = "ready";
    commerceOrdersUnavailable.value = false;
    genesisOrdersUnavailable.value = false;
  }
  const seenRead = ordersEntryRead.capture("orders");
  const firstPage = orders.refreshRemote();
  const outcome = await createRemoteOrdersRefresh({
    commerce: () => firstPage,
    genesis: () => genesis.syncRemote(),
    // BUG 174: Genesis 订单行来自**账号投影** (GET /api/genesis/account),
    // 不是资格判定。资格不可用(Genesis 未开放)时账号投影照常可读,
    // 订单源必须判「已读」;只有账号投影真的读失败才算这一源不可用 ——
    // 这样重试成功后错误能真正消失,而不是被资格状态永久钉住。
    genesisAccountUnavailable: () => genesis.remoteAccountReadState !== "ready",
    isCurrent: current,
  })();
  if (outcome.availability === "stale") return;
  ordersReadFailed.value = outcome.commerceUnavailable || outcome.genesisUnavailable;
  commerceOrdersUnavailable.value = outcome.commerceUnavailable;
  genesisOrdersUnavailable.value = outcome.genesisUnavailable;
  remoteOrderAvailability.value = outcome.availability;
  remoteOrdersResolved.value = true;
  remoteOrdersRefreshing.value = false;
  await nextTick();
  const shownPage = outcome.commerceUnavailable ? null : await firstPage;
  if (current() && seenRead.current() && shownPage?.isCurrent()) {
    entrySeen.record("orders", latestMeOrders(shownPage.visible), seenRead.scope, true);
  }
}
const { retry: retryOrders } = useAutoRecovery({
  failed: () => remoteApiEnabled && !remoteOrdersRefreshing.value && (ordersReadFailed.value || orders.failedOrderReadbacks.size > 0),
  retry: () => ordersReadFailed.value ? refreshOrders() : orders.retryOrderReadbacks(() => ordersPageActive.value && foregroundReadAllowed()),
});
async function loadMoreOrders() {
  if (orders.loadingMore || !orders.nextCursor) return;
  const request = { accountKey: app.accountKey, epoch: app.accountBindingEpoch };
  const requestedRefresh = refreshEpoch;
  const current = () => ordersPageActive.value && requestedRefresh === refreshEpoch && remoteCommerceRequestCurrent(request, {
    accountKey: app.accountKey,
    epoch: app.accountBindingEpoch,
  });
  try {
    await orders.loadMoreRemote();
    if (!current()) return;
    commerceOrdersUnavailable.value = false;
    remoteOrderAvailability.value = genesisOrdersUnavailable.value ? "partial" : "ready";
  } catch {
    if (!current()) return;
    toast.error(t.value.orders.refreshFailed);
    commerceOrdersUnavailable.value = true;
    remoteOrderAvailability.value = "partial";
  }
}
const scrollAnchor = ref<unknown>(null);
const scrollPager = useManualScrollLoadMore(scrollAnchor, {
  enabled: () => remoteApiEnabled && remoteSessionReady.value && ordersPageActive.value && !commerceOrdersUnavailable.value,
  hasMore: () => Boolean(orders.nextCursor),
  loading: () => remoteOrdersRefreshing.value || orders.loadingMore,
  loadMore: loadMoreOrders,
});
onShow(() => {
  ordersPageActive.value = true;
  if (remoteSessionReady.value) void revalidateProductCatalog();
  preserveOrdersOriginInH5();
  void refreshOrders();
});
onHide(() => {
  ordersPageActive.value = false;
  refreshEpoch += 1;
  remoteOrdersRefreshing.value = false;
});
onUnmounted(() => {
  ordersPageActive.value = false;
  refreshEpoch += 1;
  unsubscribeRuntimeRevision();
});
watch(() => app.accountBindingEpoch, () => {
  deleteTarget.value = null;
  swipeOpenId.value = "";
  hidingOrderId.value = "";
  remoteOrdersResolved.value = false;
  if (ordersPageActive.value) void refreshOrders();
});
// onShow can land before the cookie restore binds the account. The deferred
// read starts here instead, so the page never settles on an account-state error.
watch(remoteSessionReady, (ready, wasReady) => {
  if (ready && !wasReady && ordersPageActive.value) { void revalidateProductCatalog(); void refreshOrders(); }
});

// A later catalog response clears the shared orders without rebinding the account.
// Coalesce synchronous invalidations; a failed source never schedules a retry.
let runtimeRefreshQueued = false;
const unsubscribeRuntimeRevision = subscribeRuntimeRevision(() => {
  if (!remoteApiEnabled) return;
  refreshEpoch += 1;
  remoteOrdersResolved.value = false;
  remoteOrdersRefreshing.value = ordersPageActive.value;
  if (!ordersPageActive.value || runtimeRefreshQueued) return;
  runtimeRefreshQueued = true;
  void Promise.resolve().then(() => {
    runtimeRefreshQueued = false;
    if (ordersPageActive.value) void refreshOrders();
  });
});

const ordersBackHref = ref("/store");
type OrderFilter = "all" | "pending" | "active" | "done" | "closed";
const ORDER_FILTERS: OrderFilter[] = ["all", "pending", "active", "done", "closed"];
// The entry may preselect a category (the home to-do opens "pending").
const statusFilter = ref<OrderFilter>("all");
onLoad((options) => {
  const query = new URLSearchParams(takeNavigationQuery("/pages/store/orders"));
  const from = options?.from === "me" || options?.from === "store" ? options.from : query.get("from");
  ordersBackHref.value = from === "me" ? "/me" : "/store";
  const status = options?.status ?? query.get("status");
  if ((ORDER_FILTERS as string[]).includes(status ?? "")) statusFilter.value = status as OrderFilter;
  preserveOrdersOriginInH5();
});

function preserveOrdersOriginInH5() {
  // Uni H5 can drop navigateTo's query from the visible hash. Keep the source
  // in this history entry so a refresh retains the correct cold-open fallback.
  if (typeof window !== "undefined") {
    try {
      const hash = window.location.hash;
      if (!/^#\/pages\/store\/orders(?:\?|$)/.test(hash)) return;
      const question = hash.indexOf("?");
      const query = new URLSearchParams(question < 0 ? "" : hash.slice(question + 1));
      const from = ordersBackHref.value === "/me" ? "me" : "store";
      if (query.get("from") === from || (from === "store" && !query.has("from"))) return;
      query.set("from", from);
      const path = question < 0 ? hash : hash.slice(0, question);
      window.history.replaceState(window.history.state, "", `${window.location.href.slice(0, -hash.length)}${path}?${query}`);
    } catch { /* Native runtimes have no browser history. */ }
  }
}

// Sticky chassis nav header — back + "Orders" title, no subtitle (IDC-hosted
// colocation, nothing ships to the user, so the old "track your hardware
// shipments" subtitle was retired — deliberate product decision, see
// docs/前端产品更新日志.md 2026-07-08).
useSetPageHeader(() => ({
  title: t.value.headerTitles.storeOrders,
  backHref: ordersBackHref.value,
}));

// lucide outline paths per status (Clock / CheckCircle2 / Server / Cpu / XCircle)
interface Badge {
  label: string;
  tone: "neutral" | "brand" | "success" | "warning" | "danger";
  icon: string[];
}
// Tones follow the shared NxTag mapping (design system 03 §3.8).
function badge(status: OrderStatus): Badge {
  switch (status) {
    case "placed":
      return { label: t.value.orders.statusPlaced, tone: "warning", icon: ["M12 6v6l4 2", "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"] };
    case "paid":
      return { label: t.value.orders.statusPaid, tone: "brand", icon: ["M22 11.08V12a10 10 0 1 1-5.93-9.14", "m9 11 3 3L22 4"] };
    case "provisioning":
      return { label: t.value.orders.statusProvisioning, tone: "brand", icon: ["M5 2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z", "M5 14h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z", "M6 6h.01", "M6 18h.01"] };
    case "inventory":
    case "activated":
      return { label: status === "inventory" ? t.value.orders.statusInventory : t.value.orders.statusActivated, tone: "success", icon: ["M12 20v2", "M12 2v2", "M17 20v2", "M17 2v2", "M2 12h2", "M2 17h2", "M2 7h2", "M20 12h2", "M20 17h2", "M20 7h2", "M7 20v2", "M7 2v2", "M4 8h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z", "M8 12h8"] };
    case "cancelled":
      return { label: t.value.orders.cancelStatus, tone: "neutral", icon: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "m15 9-6 6", "m9 9 6 6"] };
    case "payment_failed":
    case "provisioning_failed":
      return { label: t.value.orders.statusFailedShort, tone: "danger", icon: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "m15 9-6 6", "m9 9 6 6"] };
    case "expired":
      return { label: t.value.orders.statusExpired, tone: "neutral", icon: ["M12 6v6l4 2", "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"] };
    case "refunded":
      return { label: t.value.orders.statusRefunded, tone: "neutral", icon: ["M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4"] };
    case "chargeback":
      return { label: t.value.orders.statusChargeback, tone: "danger", icon: ["M12 2v12m0 4v4m-7-5 3 3m11-3-3 3"] };
  }
}
// Use the same approved SKU main image as the storefront. A bundle shows its first line.
function orderImage(order: OrderListItem): string | undefined {
  if (order.kind === "genesis") return GENESIS_MEDIA.showcase;
  return getOrderProductMedia(order.productId, order.lineItems)?.src;
}

function dateText(ts: number): string {
  return Number.isFinite(ts) && Number.isFinite(new Date(ts).getTime())
    ? formatTrialDate(ts, dateLocale())
    : "—";
}

function goStore() {
  navTo("/store");
}
function orderCardLabel(o: OrderListItem): string {
  return `${commerceOrderTitle(o, locale.code)} ${o.id}${pendingCloseMinutes(o) ? " · " + fmt(t.value.orders.pendingCloseIn, { min: pendingCloseMinutes(o)! }) : ""}`;
}
// The card always opens the detail; only the pending row's button asks it to open payment.
function goOrder(order: OrderListItem) {
  navTo(order.kind === "genesis" ? "/pages/genesis/holder" : `/pages/store/order-detail?id=${encodeURIComponent(order.id)}&from=${ordersBackHref.value === "/me" ? "me" : "store"}`);
}
function goOrderPayment(order: OrderListItem) {
  navTo(`/pages/store/order-detail?id=${encodeURIComponent(order.id)}&from=${ordersBackHref.value === "/me" ? "me" : "store"}&pay=1`);
}

const remoteErrorStyle: CSSProperties = {
  marginBottom: "12px",
  padding: "10px 12px",
  background: "color-mix(in srgb, var(--v5-warning) 8%, transparent)",
};
const loadMoreBtnStyle: CSSProperties = {
  minHeight: "44px",
  marginTop: "8px",
  borderRadius: "12px",
  background: "var(--v5-surface-2)",
  color: "var(--v5-ink-2)",
  fontSize: "13px",
  fontWeight: 600,
};

// ─── styles ───
// Empty state — dashed outline on the page floor, no fill (whitelist idiom).
const emptyCardStyle: CSSProperties = {
  border: "1px dashed var(--v5-border-strong)",
  padding: "32px",
};
const browseBtnStyle: CSSProperties = {
  marginTop: "16px",
  height: "48px",
  padding: "0 20px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
  color: "var(--v5-on-brand)",
  fontFamily: "var(--font-v5)",
  fontSize: "13px",
  fontWeight: 600,
};
</script>

<style scoped>
/* Five-way status rail without a sliding selection pill: the selected label is ink 600, others ink-3.
   Options grow to share the row; when long labels (vi/en on narrow screens) do not fit, the rail scrolls instead of overlapping. */
.orders-filters { margin-bottom: 12px; padding: 0; gap: 0; background: transparent; box-shadow: none; }
.orders-filters :deep(.nx-glass-indicator), .orders-filters :deep(.nx-glass-backdrop) { display: none; }
.orders-filters :deep(.nx-glass-option) { flex: 1 0 auto; min-height: 44px; padding: 0 6px; background: transparent; color: var(--v5-ink-3); font-weight: 500; }
.orders-filters :deep(.nx-glass-option--selected) { color: var(--v5-ink); font-weight: 500; background: transparent; }
.orders-filter__label { white-space: nowrap; font-size: var(--ui-type-segment); line-height: var(--ui-type-segment-lh); font-weight: inherit; color: inherit; }
.orders-filter__badge { min-width: 18px; height: 18px; box-sizing: border-box; margin-left: 1px; padding: 0 5px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: var(--ui-unread-badge); color: var(--ui-unread-badge-ink); font: 600 11px/18px var(--font-v5); }
/* Order cards (DS-28): solid surface, machine art as the anchor; the pending card adds one faint warning glow. */
.orders-list { display: flex; flex-direction: column; gap: var(--ui-space-card-gap); margin: 0 16px; }
.order-card { position: relative; overflow: hidden; padding: var(--ui-space-inset); border-radius: var(--ui-radius-surface); }
/* Only what opens a page shows a pointer: the whole commerce card, or the Genesis card's main row. */
.order-card[role="button"], .order-card__row[role="button"] { cursor: pointer; }
.order-card:not(.nx-tint) { background: var(--v5-content-surface); }
[data-theme="light"] .order-card:not(.nx-tint) { box-shadow: var(--v5-glass-shadow); }
/* Awaiting payment: tinted warning on the first such card only (it used to be a corner glow). */
.order-card--pending { --nx-tint: var(--v5-warning); }.order-card:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; }
.order-card__row { display: flex; gap: 14px; }
/* The machine is the card's main visual, with no box around it. The art keeps clear margin around the machine and its disc
   (machines span 31–83% of the art's height, racks up to 91% of its width), so a 104px art fills the 96px slot and sits 7px
   up to centre the machine; the floor shadow stays under the disc. */
.order-card__thumb { position: relative; flex: none; width: 96px; height: 80px; display: grid; place-items: center; }
.order-card__thumb::after { content: ""; position: absolute; left: 18px; right: 18px; bottom: 7px; height: 10px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, #000 55%, transparent), transparent); }
[data-theme="light"] .order-card__thumb::after { background: radial-gradient(closest-side, rgba(20,16,8,.16), transparent); }
.order-card__image { position: relative; z-index: 1; flex: none; width: 104px; height: 104px; margin-top: -14px; }
/* Genesis art is a full-bleed photo with its own floor, so it sits as an 80px rounded tile (01 §1.3 inner block radius 12). */
.order-card__image--genesis { width: 80px; height: 80px; margin-top: 0; border-radius: 12px; overflow: hidden; }
.order-card__thumb--genesis::after { content: none; }
.order-card__info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
/* A long status tag moves under the title instead of squeezing it. */
.order-card__top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 8px; }
.order-card__title { flex: 1 1 96px; min-width: 0; overflow-wrap: break-word; color: var(--v5-ink); font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); }
.order-card__meta { display: block; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--v5-ink-3); font: 400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
/* Order number: one monospace line, shortened in the middle so its end stays visible; the whole row opens the order, so no separate copy button. */
.order-card__code { display: flex; align-items: baseline; gap: 4px; overflow: visible; }
.order-card__code-label { flex: none; white-space: nowrap; }
.order-card__code-value { font-size: var(--ui-type-meta); line-height: var(--ui-type-meta-lh); color: var(--v5-ink-3); }
/* Genesis: the order-number row sits under the tappable row, aligned with the text column; its copy button has a 44px target and does not open the card. */
.order-delete-target { align-self: stretch; margin-top: var(--v5-space-4); padding: var(--v5-space-3) var(--v5-space-4); border-radius: var(--v5-radius-l); background: var(--v5-surface-2); display: flex; flex-direction: column; align-items: center; gap: var(--v5-space-1); min-width: 0; }
.order-delete-target__name { font: var(--ui-type-list-title-weight) var(--ui-type-list-title)/var(--ui-type-list-title-lh) var(--font-v5); color: var(--v5-ink); overflow-wrap: break-word; }
.order-delete-target__code { display: flex; align-items: baseline; justify-content: center; gap: var(--v5-space-1); max-width: 100%; min-width: 0; }
.order-delete-target__label { flex: none; white-space: nowrap; font: var(--ui-type-list-subtitle-weight) var(--ui-type-list-subtitle)/var(--ui-type-list-subtitle-lh) var(--font-v5); color: var(--v5-ink-3); }
.order-delete-target__value { color: var(--v5-ink-2); }
.order-card__code--copy { align-items: center; min-height: 44px; margin: 4px 0 -10px; padding-left: 110px; cursor: default; }
.order-card__code--copy :deep(.copy-code-button) { width: 44px; height: 44px; margin: 0 -10px 0 auto; }
.order-card__row[role="button"]:focus-visible { outline: 2px solid var(--v5-brand); outline-offset: 2px; border-radius: 12px; }
/* Narrow screens: the amount drops to its own right-aligned line instead of clipping. */
.order-card__bottom { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 8px; margin-top: auto; }
.order-card__date { color: var(--v5-ink-3); font: 400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.order-card__amount { margin-left: auto; color: var(--v5-ink); font-size: 18px; line-height: 24px; letter-spacing: -.01em; }
.order-card__amount :deep(.checkout-amount__symbol) { font-size: 12px; }
/* Unit per 01 §1.2: 12/16, 500, muted. */
.order-card__amount :deep(.checkout-amount__unit) { font: 500 12px/16px var(--font-v5); letter-spacing: 0; }
/* Shared card footer (03 §3.1 P-67): the same 16px above and below the divider and under the action. */
.order-card__pending { margin-top: var(--ui-space-inset); }
.order-card__countdown { display: flex; align-items: center; gap: 6px; min-width: 0; color: var(--v5-warning-ink); font: 400 var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); }
.order-card__pay { flex: none; margin-left: auto; }
/* Payment cards: the kind and method line wraps in long languages instead of hiding its end. */
.order-card__meta--wrap { white-space: normal; overflow: visible; overflow-wrap: break-word; }
/* Every order sits in the swipe wrapper; only an expired order's wrapper clips and rounds, so the delete zone it reveals
   meets the card with a straight edge and both share the card's corners (board 我的订单 · 左滑). */
.orders-list .order-swipe { overflow: visible; }
.orders-list .order-swipe :deep(.conversation-swipe__content) { background: transparent; }
.orders-list .order-swipe--live { overflow: hidden; border-radius: var(--ui-radius-surface); }
[data-theme="light"] .orders-list .order-swipe--live { box-shadow: var(--v5-glass-shadow); }
.order-swipe--live .order-card { border-radius: 0; }
[data-theme="light"] .order-swipe--live .order-card:not(.nx-tint) { box-shadow: none; }
.order-swipe--live .order-card:focus-visible { outline-offset: -2px; }
.orders-list .order-swipe--live :deep(.conversation-swipe__delete) { inset: 0 0 0 auto; }
.orders-filter-empty { display: block; padding: 32px 16px; text-align: center; color: var(--v5-ink-3); font: 400 var(--ui-type-description)/var(--ui-type-description-lh) var(--font-v5); }
</style>
