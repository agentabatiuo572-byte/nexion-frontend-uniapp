<template>
  <AppChassis active="me">
    <template #pageFixed="{ top }">
    <view class="message-center message-page" :style="{ top: top + 'px' }">
      <view class="message-nav">
        <view class="message-button message-icon-button nx-design-glass" role="button" tabindex="0" :aria-label="t.profile.back" @click="navBack('/pages/me/me')"><LiquidGlass :radius="22" tone="navigation" rendering="frosted" /><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg></view>
        <view class="message-button message-icon-button nx-design-glass" role="button" tabindex="0" :aria-label="t.notifs.preferences" @click="navTo('/pages/me/preferences')"><LiquidGlass :radius="22" tone="navigation" rendering="frosted" /><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></view>
      </view>
      <view class="message-compact" :class="{ 'message-compact--visible': !headerState.title }" :aria-hidden="headerState.title"><text>{{ t.notifs.drawerTitle }} · {{ section === 'service' ? t.notifs.serviceTab : t.notifs.notificationsTab }}</text></view>
      <view class="message-collapse" :class="{ 'message-collapse--hidden': !headerState.title }" :style="collapseStyle('title')" :aria-hidden="!headerState.title" :inert="!headerState.title ? true : undefined" @focusin="headerFocused = true" @focusout="headerFocused = false">
        <view class="message-heading">
          <view class="message-heading-row">
            <text class="message-title" :class="{ 'message-title--hidden': !headerState.title }" :aria-hidden="!headerState.title" role="heading" aria-level="1">{{ t.notifs.drawerTitle }}</text>
            <view class="message-subtitle" role="status"><view v-if="center.totalUnread" class="message-status-dot" aria-hidden="true" /><text>{{ unreadLabel }}</text></view>
            <view v-if="canManageNotifications && notifs.unread > 0" class="message-button message-mark-all" role="button" :tabindex="headerState.title && !markingAll && !clearingRead ? 0 : -1" :aria-disabled="markingAll || clearingRead" :aria-label="t.notifs.markAll" @click="markAll"><text>{{ actionCopy.markAllShort }}</text></view>
          </view>
        </view>
      </view>
      <view class="message-collapse message-primary-wrap" :class="{ 'message-collapse--hidden': !headerState.primary }" :style="collapseStyle('primary')" :aria-hidden="!headerState.primary" :inert="!headerState.primary ? true : undefined" @focusin="headerFocused = true" @focusout="headerFocused = false">
        <view class="message-primary-inner"><GlassSegments v-model="section" :options="accessibleSectionOptions" :label="t.notifs.drawerTitle" surface="glass" selection="flat" class="message-primary">
          <template #option="{ option }"><text class="message-option-label">{{ option.label }}</text><view v-if="option.hasUnread" class="message-status-dot" aria-hidden="true" /></template>
        </GlassSegments></view>
      </view>
      <GlassSegments v-if="section !== 'service'" :label="t.notifs.filterGroupLabel" semantics="radio" v-model="filter" :options="filterOptions" layout="scroll" class="message-filters">
        <template #option="{ option }"><text class="message-option-label">{{ option.label }}</text><view v-if="option.hasUnread && option.value !== 'all'" class="message-category-dot" aria-hidden="true" /></template>
      </GlassSegments>
      <scroll-view :key="section" scroll-y class="message-scroll" :class="{ 'message-scroll--notifications': section === 'notifications' }" :show-scrollbar="false" @scroll="onMessageScroll" @wheel="onScrollInput" @touchmove="onScrollInput" @keydown.up="onScrollInput" @keydown.down="onScrollInput" @keydown.home="onScrollInput" @keydown.end="onScrollInput" @keydown.page-up="onScrollInput" @keydown.page-down="onScrollInput">
      <ServiceMessageList v-if="section === 'service'" :retry="serviceRecovery.retry" />
      <view v-else class="notification-feed" :class="{ 'notification-feed--failed': notifs.readFailedWithoutData }" :aria-busy="notifs.loading">
        <view v-if="!notifs.loading && !notifs.readFailedWithoutData && notifs.nextCursor && filtered.length === 0" role="status" class="message-state"><text>{{ t.notifs.moreToCheck }}</text></view>
        <EmptyState v-if="!notifs.loading && !notifs.readFailedWithoutData && !notifs.nextCursor && filtered.length === 0" kind="empty-list" :title="emptyTitle" :desc="notifs.items.length === 0 ? t.notifs.emptyBody : undefined" />
        <view v-for="(n, index) in filtered" :key="n.id" class="notification-item" :class="{ 'notification-item--read': !!n.readAt, 'notification-item--last': index === filtered.length - 1, 'notification-item--group-first': index === 0 || dateHeading(n.ts) !== dateHeading(filtered[index - 1].ts), 'notification-item--group-last': index === filtered.length - 1 || dateHeading(n.ts) !== dateHeading(filtered[index + 1].ts) }">
          <text v-if="index === 0 || dateHeading(n.ts) !== dateHeading(filtered[index - 1].ts)" class="notification-date" role="heading" aria-level="2">{{ dateHeading(n.ts) }}</text>
          <view class="notification-row" role="button" tabindex="0" :aria-label="n.earning ? earningRowLabel(n.earning) : platformDisplayText(n.title)" :aria-haspopup="n.earning ? 'dialog' : undefined" :aria-expanded="n.earning || directNotice(n) ? undefined : expandedId === n.id" @click="toggle(n)" @touchstart="onTouchStart(n, $event)" @touchend="onTouchEnd(n, $event)">
            <NxIconTile class="notification-tile" :tone="CATEGORY_TONES[notificationCategory(n)]" size="m"><view class="notification-glyph" v-html="kindIcon(n)" /></NxIconTile>
            <!-- Earnings credited (04.5): the amount takes the title slot; 收益到账 · device · job is the summary. -->
            <view v-if="n.earning" class="notification-content"><view class="notification-amounts"><text v-for="(amount, ai) in earningAmounts(n.earning)" :key="amount.unit" class="notification-amount">{{ amount.sign }}{{ amountsHidden ? '••••' : amount.value }}&nbsp;<text class="notification-amount__unit">{{ amount.unit }}</text><text v-if="ai === 0 && earningAmounts(n.earning).length > 1" class="notification-amount__sep">&nbsp;·</text></text></view><text class="notification-preview notification-earning-summary"><template v-for="(part, pi) in earningSummary(n.earning)" :key="pi"><text v-if="pi">&nbsp;· </text><text :class="{ 'notification-earning-device': part.device }">{{ part.text }}</text></template></text></view>
            <view v-else class="notification-content"><view class="notification-top"><view class="notification-heading"><text class="notification-title">{{ keepUnits(platformDisplayText(n.title)) }}</text><NxTag v-if="n.priority === 'critical' || n.priority === 'high'" tone="warning" :label="t.notifs.important" /></view></view><text v-if="n.body && expandedId !== n.id" class="notification-preview">{{ keepUnits(platformDisplayText(n.body)) }}</text></view>
<view class="notification-meta"><text class="notification-time">{{ timeAgo(n.ts) }}</text><view v-if="!n.readAt" class="message-status-dot" aria-hidden="true" /></view>
          </view>
          <view v-if="expandedId === n.id" class="notification-detail"><text v-if="n.body" class="notification-body">{{ keepUnits(platformDisplayText(n.body)) }}</text><view v-if="n.ctaHref" class="message-button notification-cta" role="button" tabindex="0" :aria-label="platformDisplayText(n.ctaLabel || t.me.open)" @click.stop="onTap(n)"><LiquidGlass :radius="16" /><text>{{ platformDisplayText(n.ctaLabel || t.me.open) }}</text><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2"><path d="M4 12h16m-7-7 7 7-7 7" /></svg></view></view>
        </view>
        <view v-if="notifs.readFailedWithoutData" data-testid="notification-error" class="message-state" role="alert"><text>{{ notifsErrorText }}</text><view class="nx-card-recovery-action nx-card-recovery-action--quiet" role="button" :tabindex="notifs.loading ? -1 : 0" :aria-disabled="notifs.loading" :aria-label="t.ui.reload" @click="notificationRecovery.retry()"><text>{{ t.ui.reload }}</text></view></view>
        <view v-if="notifs.loading && !filtered.length && !notifs.readFailedWithoutData" class="message-state" role="status" aria-live="polite"><text>{{ t.help.loadingMore }}</text></view>
        <view v-if="notifs.nextCursor" class="message-more"><view class="message-button" role="button" :tabindex="notifs.loading ? -1 : 0" :aria-disabled="notifs.loading" :aria-label="t.notifs.loadMore" @click="loadMoreNotifications()"><LiquidGlass :radius="22" /><text>{{ notifs.loadingMore ? t.help.loadingMore : t.notifs.loadMore }}</text></view></view>
      </view>
      <view class="message-scroll-compensation" :style="{ height: headerCompensation + 'px' }" aria-hidden="true" />
      </scroll-view>
      <view v-if="canManageNotifications" class="notification-management">
        <NxButton variant="secondary" size="medium" :disabled="clearingRead || markingAll || notifs.loading" @click="confirmClearRead">{{ actionCopy.clearRead }}</NxButton>
      </view>
    </view>
    <ReceiptModal :receipt="earningDetail?.receipt ?? null" :state="earningDetail ? earningDetail.state : 'ready'" :title="earningCopy.detailTitle" :credited-amount="earningDetail?.earning" :view-all-label="earningCopy.viewAll" @view-all="viewAllEarnings" @close="earningDetail = null" />
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import { registerActivePageRefresh } from "@/lib/active-page-refresh";
import { useAutoRecovery } from "@/composables/use-auto-recovery";
import { displayTimestamp, formatDisplayDate } from "@/lib/display-date";
import { platformDisplayText } from "@/lib/brand-copy";
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { onShow, onHide, onLoad, onResize } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import NxButton from "@/components/ui/nx-button.vue";
import EmptyState from "@/components/empty-state.vue";
import NxIconTile from "@/components/ui/nx-icon-tile.vue";
import NxTag from "@/components/ui/nx-tag.vue";
import ReceiptModal from "@/components/me/receipt-modal.vue";
import { earningCreditCopy } from "@/i18n/earning-credit";
import { creditedAmounts } from "@/lib/amount-display";
import { workloadLabel } from "@/lib/workload-label";
import { useDataVisibility } from "@/store/data-visibility";
import type { NotificationEarning } from "@/api/notification-api";
import type { CanonicalComputeReceipt } from "@/api/task-assignment-api";
import { ApiError } from "@/api/errors";
import LiquidGlass from "@/components/liquid-glass.vue";
import ServiceMessageList from "@/components/support/service-message-list.vue";
import { useConversations } from "@/store/conversations";
import { useMessageDrawer, type MessageSection } from "@/store/message-drawer";
import { foregroundReadAllowed } from "@/lib/foreground-read";
import { notificationCategory, type NotificationCategory } from "@/lib/notification-category";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { fmt } from "@/i18n/format";
import { EARNING_NOTIFICATION_REMOVED, useNotifications, type Notification } from "@/store/notifications";
import { navTo, navBack, takeNavigationQuery } from "@/lib/route";
import { useHeaderSystemBack } from "@/composables/use-dialog-a11y";
import { remoteApiEnabled, taskAssignmentApi } from "@/api/runtime";
import { isLeftConversionSwipe, type SwipePoint } from "@/lib/notification-swipe";
import { useApp } from "@/store/app";
import { remoteAccountScope } from "@/lib/remote-account-epoch";
import { isDirectNotificationSummary } from "@/lib/notification-summary";
import { notificationActionsCopy } from "@/i18n/notification-actions";
import { confirm, toast, useUI } from "@/store/ui";
import { uiLocale } from "@/i18n";

const t = useT();
const locale = useLocaleStore();
const notifs = useNotifications();
const app = useApp();
const ui = useUI();
const actionCopy = computed(() => notificationActionsCopy[uiLocale(locale.code)]);
const earningCopy = computed(() => earningCreditCopy[uiLocale(locale.code)]);
const dataVisibility = useDataVisibility();
// Hidden amounts mask only the digits on these rows; units stay (03.10). The detail sheet is not masked.
const amountsHidden = computed(() => dataVisibility.hidden);
const clearingRead = ref(false);
const confirmOwner = `notification-center:${Date.now()}-${Math.random().toString(36).slice(2)}`;
let pageGeneration = 0;
const pageVisible = ref(false);
let disposed = false;
function captureIntent() {
  return { generation: pageGeneration, account: remoteAccountScope.snapshot() };
}
function isCurrentIntent(intent: ReturnType<typeof captureIntent>) {
  return !disposed && pageVisible.value && intent.generation === pageGeneration
    && remoteAccountScope.isCurrent(intent.account);
}
// store 保留机器码(SESSION_EXPIRED / NOTIFICATION_UNAVAILABLE / 服务端 envelope 原文…),
// 视图侧统一映射成用户文案 —— 裸插值会把工程码上屏,违反「页面文案禁止错误码」。
// 写法与 risk-disclosure.vue:108 同源。
const notifsErrorText = computed(() => notifs.readFailedWithoutData ? t.value.notifs.loadFailed : "");
watch(() => notifs.commandError, error => {
  if (!error || !pageVisible.value) return;
  if (error === EARNING_NOTIFICATION_REMOVED) toast.info(earningCopy.value.removed);
  else toast.error(t.value.notifs.loadFailed);
}, { flush: "sync" });

async function loadMoreNotifications() {
  const intent = captureIntent();
  if (!isCurrentIntent(intent)) return;
  if (await notifs.loadMoreRemote() === false && isCurrentIntent(intent)) toast.error(t.value.notifs.loadFailed);
}

const center = useMessageDrawer();
const conversations = useConversations();
type Filter = "all" | NotificationCategory;
const filter = ref<Filter>("all");
let sectionLoaded = false;
let sectionAccountWasBound = app.accountKey !== "default";
const initialSectionAccountEpoch = app.accountBindingEpoch;
let sectionEntryAllowed = true;
let initialSection: MessageSection | null = sectionAccountWasBound ? null : center.section;
let initialFilter: Filter = "all";
const section = computed({ get: () => center.section, set: (value: MessageSection) => {
  center.section = value;
  if (!sectionAccountWasBound && sectionEntryAllowed) initialSection = value;
  preserveSectionInH5();
} });
const notificationRecovery = useAutoRecovery({
  failed: () => remoteApiEnabled && !!notifs.readError,
  retry: () => notifs.loading ? Promise.resolve() : notifs.refreshRemote(),
  // The fixed message feed has its own scroller outside the chassis pull surface.
  repeatMs: 30_000,
});
const serviceRecovery = useAutoRecovery({
  failed: () => remoteApiEnabled && !conversations.loading && !conversations.categoryLoading
    && (!!center.serviceReadError || conversations.managementUnavailable
      || (app.accountKey.startsWith("user:") && !conversations.unreadAvailable)),
  retry: () => center.refreshService(),
  repeatMs: 30_000,
});
function refreshHealthyNotifications() {
  if (remoteApiEnabled && !notifs.loading && !notifs.readError) {
    return notifs.refreshRemote();
  }
}
function refreshHealthyService() {
  if (!center.serviceReadError) return center.refreshService();
}
let releaseActiveRefresh = () => {};
function preserveSectionInH5() {
  if (!sectionLoaded || disposed || !pageVisible.value || typeof window === "undefined"
    || typeof window.history?.replaceState !== "function") return;
  const hash = window.location.hash.replace(/^#/, "");
  const question = hash.indexOf("?");
  const path = question < 0 ? hash : hash.slice(0, question);
  if (path !== "/pages/me/notifications") return;
  const query = new URLSearchParams(question < 0 ? "" : hash.slice(question + 1));
  if (query.get("section") === section.value) return;
  query.set("section", section.value);
  try {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${path}?${query}`);
  } catch { /* Unsupported history leaves the existing in-memory selection intact. */ }
}
onLoad(query => {
  const pending = new URLSearchParams(takeNavigationQuery("/pages/me/notifications"));
  const initial = query?.section ?? pending.get("section");
  sectionLoaded = true;
  if (sectionEntryAllowed && (initial === "notifications" || initial === "service")) {
    section.value = initial;
    if (initial === "notifications" && (query?.filter ?? pending.get("filter")) === "finance") {
      initialFilter = "finance";
      filter.value = initialFilter;
    }
  }
  else preserveSectionInH5();
});
const sectionOptions = computed(() => [
  { value: "notifications", label: t.value.notifs.notificationsTab, hasUnread: notifs.unread > 0 },
  { value: "service", label: t.value.notifs.serviceTab, hasUnread: center.serviceUnread > 0 },
]);
const unreadLabel = computed(() => {
  if (!center.unreadAvailable) return t.value.notifs.unreadUnavailable;
  if (center.totalUnread > 0) return fmt(t.value.notifs.unreadCount, { n: center.totalUnread });
  return t.value.notifs.allCaughtUp;
});
const filterIds: Filter[] = ["all", "finance", "device", "team", "rewards", "system"];
const visibleFilterIds = computed(() => filterIds);
const expandedId = ref<string | null>(null);
const categoryKeys = { finance: "categoryFinance", device: "categoryDevice", team: "kindTeam", rewards: "categoryRewards", system: "kindSystem" } as const;
const CATEGORY_TONES = { finance: "success", device: "device", team: "coral", rewards: "amber", system: "purple" } as const;
const categoryIcons: Record<NotificationCategory, string> = {
  finance: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><path d="M16 14h.01"/>',
  device: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  rewards: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  system: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
};
// Message text arrives with plain spaces; on screen an amount and its unit never split across lines (display only).
function keepUnits(text: string) { return text.replace(/(\d) (USDT|UVT|VND)\b/g, "$1\u00a0$2"); }
function kindIcon(n: Notification) { return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${categoryIcons[notificationCategory(n)]}</svg>`; }
function countOf(id: Filter) { return id === "all" ? notifs.items.length : notifs.items.filter(n => notificationCategory(n) === id).length; }
const filtered = computed(() => {
  const rows = filter.value === "all" ? notifs.items : notifs.items.filter(n => notificationCategory(n) === filter.value);
  if (!notifs.earningsReadConfirmed) return rows;
  // The existing row uses readAt for its dot and emphasis. Project it for display only.
  return rows.map(n => n.earning && n.readAt === null ? { ...n, readAt: n.ts } : n);
});
function filterLabel(id: Filter) { return id === "all" ? t.value.notifs.filterAll : t.value.notifs[categoryKeys[id]]; }
const emptyTitle = computed(() => filter.value === "all" ? t.value.notifs.emptyAllTitle : fmt(t.value.notifs.emptyFilterTitle, { filter: filterLabel(filter.value) }));
function directNotice(n: Notification) { return !!n.ctaHref && isDirectNotificationSummary(n.body); }
function toggle(n: Notification) {
  if (n.earning) { void openEarningDetail(n, n.earning); return; }
  if (directNotice(n)) { void onTap(n); return; }
  void notifs.markRead(n.id);
  expandedId.value = expandedId.value === n.id ? null : n.id;
}
const canManageNotifications = computed(() => section.value === "notifications" && !notifs.readFailedWithoutData);
const markingAll = ref(false);
async function markAll() { if (!canManageNotifications.value || markingAll.value || clearingRead.value) return; markingAll.value = true; try { await notifs.markAllRead(); } finally { markingAll.value = false; } }
async function confirmClearRead() {
  const intent = captureIntent();
  if (!isCurrentIntent(intent) || !canManageNotifications.value || clearingRead.value || markingAll.value || notifs.loading) return;
  clearingRead.value = true;
  try {
    const copy = actionCopy.value;
    const accepted = await confirm({ owner: confirmOwner, title: copy.title, message: copy.message,
      confirmLabel: copy.confirm, cancelLabel: copy.cancel, icon: 'warn', danger: true });
    if (accepted && isCurrentIntent(intent) && canManageNotifications.value) await notifs.clearRead();
  } finally {
    if (isCurrentIntent(intent)) clearingRead.value = false;
  }
}
watch(() => [app.accountKey, app.accountBindingEpoch] as const, ([nextKey, nextEpoch], [previousKey]) => {
  // Reapply only the first startup intent after the existing store reset.
  // A second bind (including the same account) is a real reset, even in one tick.
  const firstBinding = remoteApiEnabled && !sectionAccountWasBound && previousKey === "default"
    && nextKey !== "default" && nextEpoch === initialSectionAccountEpoch + 1;
  if (nextKey !== "default") sectionAccountWasBound = true;
  if (firstBinding && initialSection) section.value = initialSection;
  else if (!firstBinding) {
    sectionEntryAllowed = false;
    initialSection = null;
    initialFilter = "all";
    section.value = "notifications";
  }
  preserveSectionInH5();
  expandedId.value = null; filter.value = initialFilter; resetHeader();
  if (notifs.category !== filter.value) void notifs.selectCategory(filter.value);
  if (!disposed && pageVisible.value && foregroundReadAllowed()) {
    void refreshHealthyNotifications();
    void refreshHealthyService();
  }
});

function dateHeading(ts: number): string {
  if (displayTimestamp(ts) === null) return "—";
  const date = new Date(ts), today = new Date(), yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return t.value.notifs.today;
  if (date.toDateString() === yesterday.toDateString()) return t.value.notifs.yesterday;
  return formatDisplayDate(ts, locale.code);
}

function timeAgo(ts: number): string {
  if (displayTimestamp(ts) === null) return "—";
  const date = new Date(ts), now = new Date(), yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    const clock = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    return `${t.value.notifs.yesterday} ${clock}`;
  }
  // Compare local calendar dates, not elapsed 24-hour periods (including DST).
  const days = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    - Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) / 86_400_000);
  if (days > 1) return fmt(t.value.notifs.timeDaysAgo, { n: days });
  const mins = Math.max(1, Math.floor((now.getTime() - ts) / 60_000));
  if (mins < 60) return fmt(t.value.notifs.timeMinutesAgo, { n: mins });
  return fmt(t.value.notifs.timeHoursAgo, { n: Math.floor(mins / 60) });
}

// Earnings credited rows (04.5). Amount lines and summary are rendered here from the message's earning data.
function earningAmounts(earning: NotificationEarning) { return creditedAmounts(earning.usdt, earning.uvt); }
function earningSummary(earning: NotificationEarning) {
  return [{ text: earningCopy.value.credited, device: false },
    ...(earning.deviceName ? [{ text: earning.deviceName, device: true }] : []),
    ...(earning.taskClass ? [{ text: workloadLabel(t.value, earning.taskClass), device: false }] : [])];
}
// Screen readers get the same words as the screen, masked the same way.
function earningRowLabel(earning: NotificationEarning) {
  const amounts = earningAmounts(earning).map(({ sign, value, unit }) => `${sign}${amountsHidden.value ? "••••" : value}\u00a0${unit}`).join(" · ");
  return `${amounts}, ${earningSummary(earning).map(part => part.text).join(" · ")}`;
}
type EarningDetailState = "loading" | "ready" | "failed" | "unavailable";
const earningDetail = ref<{ notificationId: string; earning: NotificationEarning; state: EarningDetailState; receipt: CanonicalComputeReceipt | null } | null>(null);
let pendingEarningAction: ReturnType<typeof captureIntent> | null = null;
let detailReadGeneration = 0;
let earningReturnScroll: number | undefined;

async function readEarningDetail() {
  const detail = earningDetail.value;
  const intent = captureIntent();
  if (!detail || !isCurrentIntent(intent) || !foregroundReadAllowed()) return;
  const generation = ++detailReadGeneration;
  const isCurrent = () => generation === detailReadGeneration && earningDetail.value === detail
    && isCurrentIntent(intent) && foregroundReadAllowed();
  try {
    const receipt = await taskAssignmentApi.receipt(detail.earning.receiptNo);
    if (!isCurrent()) return;
    detail.receipt = receipt;
    detail.state = "ready";
  } catch (cause) {
    if (!isCurrent()) return;
    const unavailable = cause instanceof ApiError && (cause.status === 404 || cause.status === 403
      || (cause.kind === "business" && (cause.code === 404 || cause.code === 403 || cause.message === "TASK_RECEIPT_UNAVAILABLE")));
    detail.state = unavailable ? "unavailable" : "failed";
    if (!unavailable) throw cause;
  }
}

useAutoRecovery({
  active: () => pageVisible.value && earningDetail.value !== null,
  failed: () => earningDetail.value?.state === "failed",
  retry: readEarningDetail,
  repeatMs: 30_000,
});

async function runEarningAction(n: Notification, earning: NotificationEarning, action: "cta" | "swipe_conversion") {
  const intent = captureIntent();
  if (!isCurrentIntent(intent) || pendingEarningAction || earningDetail.value || section.value !== "notifications") return;
  const requestedFilter = filter.value;
  pendingEarningAction = intent;
  try {
    const route = await (action === "cta" ? notifs.recordCta(n.id, earning.receiptNo)
      : notifs.recordSwipeConversion(n.id, earning.receiptNo));
    if (!route || !isCurrentIntent(intent) || requestedFilter !== filter.value || section.value !== "notifications") return;
    if (action === "swipe_conversion") {
      navTo(route);
      return;
    }
    earningDetail.value = { notificationId: n.id, earning, state: "loading", receipt: null };
    void readEarningDetail().catch(() => { /* The failed state starts read recovery. */ });
  } finally {
    if (pendingEarningAction === intent) pendingEarningAction = null;
  }
}

function openEarningDetail(n: Notification, earning: NotificationEarning) {
  if (suppressedClick?.id === n.id && Date.now() <= suppressedClick.until) {
    suppressedClick = null;
    return;
  }
  return runEarningAction(n, earning, "cta");
}

function earningMessageScroller() {
  if (typeof document === "undefined") return;
  return document.querySelector<HTMLElement>('.nx-chassis[data-page-visible="true"] .message-scroll .uni-scroll-view-scrollbar-hidden');
}

function viewAllEarnings() {
  // H5 may scroll the retained list when shared focus handling selects a heading on return.
  const scrollTop = earningMessageScroller()?.scrollTop;
  earningReturnScroll = scrollTop;
  earningDetail.value = null;
  void navTo("/pages/me/receipts").then(navigated => {
    if (!navigated && earningReturnScroll === scrollTop) earningReturnScroll = undefined;
  });
}

function restoreEarningReturnScroll() {
  const scrollTop = earningReturnScroll;
  earningReturnScroll = undefined;
  if (scrollTop === undefined) return;
  const intent = captureIntent();
  void nextTick(() => requestAnimationFrame(() => {
    if (!isCurrentIntent(intent)) return;
    const scroller = earningMessageScroller();
    if (scroller) scroller.scrollTop = scrollTop;
  }));
}

async function onTap(n: Notification) {
  const intent = captureIntent();
  if (!isCurrentIntent(intent)) return;
  if (suppressedClick?.id === n.id && Date.now() <= suppressedClick.until) {
    suppressedClick = null;
    return;
  }
  if (n.ctaHref) {
    if (remoteApiEnabled) {
      const canonicalRoute = await notifs.recordCta(n.id);
      if (canonicalRoute && isCurrentIntent(intent)) navTo(canonicalRoute);
    } else {
      await notifs.markRead(n.id);
      if (isCurrentIntent(intent)) navTo(n.ctaHref);
    }
    return;
  }
  await notifs.markRead(n.id);
  // Missing CTA is the PC operator's explicit "no navigation" choice.
}

type UniTouchEvent = { changedTouches?: ArrayLike<{ clientX: number; clientY: number }> };
const touchStarts = new Map<string, { point: SwipePoint; intent: ReturnType<typeof captureIntent> }>();
let suppressedClick: { id: string; until: number } | null = null;

function touchPoint(event: UniTouchEvent): SwipePoint | null {
  const touch = event.changedTouches?.[0];
  return touch ? { x: touch.clientX, y: touch.clientY, at: Date.now() } : null;
}

function onTouchStart(n: Notification, event: UniTouchEvent) {
  const intent = captureIntent();
  if (!isCurrentIntent(intent)) return;
  const point = touchPoint(event);
  if (point) touchStarts.set(n.id, { point, intent });
}

async function onTouchEnd(n: Notification, event: UniTouchEvent) {
  const start = touchStarts.get(n.id);
  touchStarts.delete(n.id);
  const end = touchPoint(event);
  if (!remoteApiEnabled) return;
  if (!start || !end || !isCurrentIntent(start.intent) || !isLeftConversionSwipe(start.point, end)) return;
  suppressedClick = { id: n.id, until: Date.now() + 800 };
  if (n.earning) {
    await runEarningAction(n, n.earning, "swipe_conversion");
    return;
  }
  const canonicalRoute = await notifs.recordSwipeConversion(n.id);
  if (canonicalRoute && isCurrentIntent(start.intent)) navTo(canonicalRoute);
}
function invalidatePendingIntents() {
  pageGeneration += 1;
  clearingRead.value = false;
  ui.clearConfirmsBy(confirmOwner);
  touchStarts.clear();
  suppressedClick = null;
  pendingEarningAction = null;
}
function invalidatePage() {
  pageVisible.value = false;
  releaseActiveRefresh();
  invalidatePendingIntents();
}
watch(() => [app.accountKey, app.accountBindingEpoch], () => {
  earningDetail.value = null;
  earningReturnScroll = undefined;
  invalidatePendingIntents();
}, { flush: "sync" });
onShow(() => {
  if (disposed) return;
  pageVisible.value = true;
  releaseActiveRefresh();
  releaseActiveRefresh = registerActivePageRefresh(refreshHealthyNotifications, "pages/me/notifications");
  preserveSectionInH5();
  restoreEarningReturnScroll();
});
watch([pageVisible, foregroundReadAllowed], ([visible, allowed], [wasVisible]) => {
  if (disposed || !visible || !allowed) return;
  if (earningDetail.value?.state === "loading") {
    void readEarningDetail().catch(() => { /* The failed state starts read recovery. */ });
  }
  void refreshHealthyNotifications();
  if (!wasVisible || section.value === "service") void refreshHealthyService();
});
onHide(invalidatePage);
onUnmounted(() => { disposed = true; invalidatePage(); });

import GlassSegments from "@/components/glass-segments.vue";
const filterOptions = computed(() => visibleFilterIds.value.map(value => {
  const count = value === 'all' ? notifs.unread : notifs.unreadByCategory[value];
  return { value, label: filterLabel(value), hasUnread: count > 0 };
}));

import { advanceMessageHeader, createMessageHeaderState } from "@/lib/message-header-scroll";
// Alone on the stack, the system back does what the header back does (02 §2.7.3).
useHeaderSystemBack(() => () => navBack('/pages/me/me'));
const headerState = ref(createMessageHeaderState());
const headerFocused = ref(false);
const headerInstance = getCurrentInstance();
const headerHeights = ref<{ title: number; primary: number } | null>(null);
const accessibleSectionOptions = computed(() => sectionOptions.value.map(option => ({ ...option, disabled: !headerState.value.primary })));
const headerCompensation = computed(() => headerHeights.value
  ? (headerState.value.title ? 0 : headerHeights.value.title) + (headerState.value.primary ? 0 : headerHeights.value.primary) : 0);
function collapseStyle(part: 'title' | 'primary') {
  return headerHeights.value ? { height: (headerState.value[part] ? headerHeights.value[part] : 0) + 'px' } : undefined;
}
// Measure the always-mounted inner content, even while its outer wrapper is
// clipped. The same heights drive the header and list-end compensation.
async function measureHeader() {
  await nextTick();
  if (disposed || typeof uni === 'undefined' || typeof uni.createSelectorQuery !== 'function' || !headerInstance?.proxy) return;
  uni.createSelectorQuery().in(headerInstance.proxy)
    .select('.message-heading').boundingClientRect()
    .select('.message-primary-inner').boundingClientRect()
    .exec((boxes: Array<{ height?: number } | null>) => {
      const title = boxes[0]?.height, primary = boxes[1]?.height;
      if (!disposed && typeof title === 'number' && title > 0 && typeof primary === 'number' && primary > 0) headerHeights.value = { title, primary };
    });
}
onMounted(measureHeader);
onResize(measureHeader);
watch([unreadLabel, sectionOptions, section, () => center.error], measureHeader);
let lastScrollInputAt = -Infinity;
function onScrollInput() { lastScrollInputAt = Date.now(); }
function onMessageScroll(event: { detail: { scrollTop: number } }) {
  const now = Date.now();
  headerState.value = advanceMessageHeader(headerState.value, event.detail.scrollTop, headerFocused.value, now, now - lastScrollInputAt < 160);
}
function resetHeader() { headerState.value = createMessageHeaderState(); }
watch(section, () => { resetHeader(); preserveSectionInH5(); });
watch(filter, value => {
  expandedId.value = null;
  resetHeader();
  void notifs.selectCategory(value);
}, { immediate: true });
</script>

<style src="@/styles/message-center.css"></style>
<style scoped>
.message-page { bottom:0!important; }
.message-center .message-nav { position:relative; z-index:41; height:70px; margin:-7px -4px 0; }
.message-center .message-nav .message-icon-button { color:var(--v5-ink); }
.message-nav .message-icon-button > svg, .message-nav .message-icon-button > .nx-native-svg { position:relative; z-index:1; }
.message-nav :deep(.nx-liquid-glass) { background:linear-gradient(145deg,var(--ui-button-sheen),transparent 38%,transparent 66%,var(--ui-button-sheen)),color-mix(in srgb,var(--v5-ink) 7%,transparent); box-shadow:var(--ui-glass-edge-shadow); backdrop-filter:blur(12px) saturate(125%); }
:global([data-theme="light"] .message-center .message-nav .nx-liquid-glass) { background-color:color-mix(in srgb,var(--v5-surface) 78%,transparent); box-shadow:var(--v5-glass-shadow),var(--ui-glass-edge-shadow); }
.message-center .message-heading { padding:0 4px; }
.message-center .message-heading-row { min-height:44px; gap:10px; }
.message-center .message-title { font-size:24px; line-height:32px; }
.message-center .message-subtitle { font-size:13px; line-height:18px; color:var(--v5-ink-3); gap:6px; }
.message-center .message-mark-all { font-size:13px; min-height:44px; padding-inline:0; font-weight:500; color:var(--v5-brand); }
.message-center .message-primary-inner { padding-top:12px; }
.message-center .message-primary { height:40px; box-sizing:border-box; padding:var(--v5-space-1); gap:var(--v5-space-1); }
.message-center .message-primary :deep(.nx-glass-track) { --v5-liquid-shadow:none; }
.message-center .message-primary :deep(.nx-glass-option) { min-height:32px; height:32px; padding:0 10px; gap:6px; font-size:14px; line-height:20px; font-weight:500; }
.message-primary .message-status-dot { width:5px; height:5px; }
.message-filters :deep(.nx-liquid-glass--selection) { background:linear-gradient(145deg,var(--ui-button-sheen),transparent 38%,transparent 66%,var(--ui-button-sheen)),color-mix(in srgb,var(--v5-brand) 14%,transparent); box-shadow:var(--ui-glass-edge-shadow); backdrop-filter:blur(12px) saturate(125%); }
.message-filters :deep(.nx-liquid-glass--selection .nx-liquid-tint) { background:none; box-shadow:none; }
.message-filters :deep(.nx-liquid-glass--selection .nx-liquid-rim) { box-shadow:none; }
.message-filters :deep(.nx-liquid-glass--selection .nx-liquid-specular) { background:none; }
.message-option-label, .message-category-dot { position: relative; z-index: 1; }
.message-center .message-filters { align-self:flex-start; width:fit-content; max-width:100%; box-sizing:border-box; height:44px; min-height:44px; margin:6px 0 -6px; padding:6px 0; gap:var(--v5-space-1); border-radius:0; background:transparent; }
.message-center .message-filters :deep(.nx-glass-option) { min-height:32px; height:32px; padding:0 12px; gap:var(--v5-space-1); border:0; border-radius:var(--v5-radius-full); font-size:13px; line-height:18px; font-weight:500; }
.message-center .message-filters :deep(.nx-glass-option:not(.nx-glass-option--selected)) { color:var(--v5-ink-3); }
.message-category-dot { width:5px; height:5px; border-radius:50%; background:var(--ui-unread-dot); flex-shrink:0; align-self:center; }
.message-center .message-scroll--notifications { width:calc(100% + 32px); margin-inline:-16px; }
.message-center .notification-feed { padding:0 16px 100px; }
.message-center .notification-item { border:0; }
.message-center .notification-date { margin:var(--v5-space-5) 4px 8px; font-size:var(--ui-type-message-meta); line-height:var(--ui-type-message-meta-lh); font-weight:500; }
.message-center .notification-row { padding:14px 16px; background:var(--v5-surface); }
.message-center .notification-item--group-first .notification-row { border-top-left-radius:22px; border-top-right-radius:22px; }
.message-center .notification-item--group-last .notification-row { border-bottom-left-radius:22px; border-bottom-right-radius:22px; }
.message-center .notification-item:not(.notification-item--group-first) .notification-row { border-top:1px solid var(--v5-border); }
.message-center .notification-tile { margin:0; }
.notification-glyph { display:grid; place-items:center; }
.message-center .notification-tile :deep(svg) { width:20px; height:20px; }
/* A long title keeps whole words: the 重要 tag drops below it instead of squeezing the title mid-word. */
.message-center .notification-heading { flex-wrap:wrap;gap:2px var(--v5-space-2); }
.message-center .notification-title { overflow-wrap:break-word; }
.message-center .notification-preview { margin-top:2px; font-size:var(--ui-type-message-preview); line-height:var(--ui-type-message-preview-lh); }
.message-center .notification-meta { flex-direction:column; align-items:flex-end; gap:var(--v5-space-2); margin:0; }
.message-center .notification-time { font-size:12px; line-height:16px; }
.message-center .notification-meta .message-status-dot { width:8px; height:8px; }
.message-center .notification-detail { padding:0 16px 14px 68px; background:var(--v5-surface); }
/* Earnings credited row (04.5, 10.1): each amount is the card figure in Montserrat and the success colour, its unit the
   auxiliary figure; an amount and its unit never split, a second amount wraps whole. */
.message-center .notification-amounts { display:flex; flex-wrap:wrap; align-items:baseline; column-gap:6px; min-width:0; }
.message-center .notification-amount { white-space:nowrap; color:var(--v5-success-ink); font:var(--ui-type-card-figure-weight) var(--ui-type-card-figure)/var(--ui-type-card-figure-lh) var(--font-amount); font-variant-numeric:tabular-nums; }
.message-center .notification-amount__unit { color:var(--v5-ink-3); font:var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); white-space:nowrap; }
.message-center .notification-amount__sep { color:var(--v5-ink-4); font:var(--ui-type-meta-weight) var(--ui-type-meta)/var(--ui-type-meta-lh) var(--font-v5); white-space:nowrap; }
.message-center .notification-earning-summary { margin-top:2px; }
/* A device name stays whole on its line; one longer than the line ends in an ellipsis (the row's label and the detail carry it in full). */
.message-center .notification-earning-device { display:inline-block; max-width:100%; vertical-align:bottom; }
/* uni-app puts the words in an inner span; the clip and ellipsis sit on it, the element that holds the text. */
.message-center .notification-earning-device :deep(span) { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.notification-management { position:absolute; right:16px; bottom:var(--nx-overlay-bottom); padding:0; }
:global([data-theme="light"] .message-center .notification-row) { box-shadow:var(--v5-glass-shadow); }
</style>
