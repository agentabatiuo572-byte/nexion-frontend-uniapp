<template>
  <AppChassis active="me">
    <template #pageFixed="{ top }">
    <view class="message-center message-page" :style="{ top: top + 'px' }">
      <view class="message-nav">
        <view class="message-button message-icon-button" role="button" tabindex="0" :aria-label="t.profile.back" @click="navBack('/pages/me/me')"><LiquidGlass :radius="24" /><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m14 5-7 7 7 7" /></svg></view>
        <view class="message-button message-icon-button" role="button" tabindex="0" :aria-label="t.notifs.preferences" @click="navTo('/pages/me/preferences')"><LiquidGlass :radius="24" /><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/><circle cx="12" cy="12" r="3"/></svg></view>
      </view>
      <view v-if="!headerState.title" class="message-compact" role="button" tabindex="0" @click="revealSections"><LiquidGlass :radius="22" /><text>{{ t.notifs.drawerTitle }} · {{ section === 'service' ? t.notifs.serviceTab : t.notifs.notificationsTab }}</text></view>
      <view v-show="headerState.title" class="message-heading"><text class="message-title">{{ t.notifs.drawerTitle }}</text><view class="message-subtitle"><view v-if="center.totalUnread" class="message-status-dot" /><text>{{ unreadLabel }}</text></view></view>
      <view v-show="headerState.primary" class="message-primary-wrap" @focusin="headerFocused = true" @focusout="headerFocused = false"><GlassSegments v-model="section" :options="sectionOptions" :label="t.notifs.drawerTitle" class="message-primary" /></view>
      <GlassSegments v-if="section === 'service'" v-model="serviceFilter" :options="serviceFilters" layout="scroll" semantics="radio" :label="t.notifs.serviceFilterLabel" class="message-filters" />
      <GlassSegments v-else :label="t.notifs.filterGroupLabel" semantics="radio" v-model="filter" :options="filterOptions" layout="scroll" class="message-filters" />
      <scroll-view :key="section" scroll-y class="message-scroll" :show-scrollbar="false" @scroll="onMessageScroll">
      <ServiceMessageList v-if="section === 'service'" :filter="serviceFilter" hide-filters />
      <view v-else class="notification-feed">
        <view class="message-actions">
          <view v-if="hasRead" class="message-button message-action" role="button" tabindex="0" :aria-label="t.notifs.clearReadAria" @click="confirmClearRead"><LiquidGlass :radius="22" /><text>{{ t.notifs.clearReadAria }}</text></view>
          <view v-if="notifs.unread > 0" class="message-button message-action" role="button" :tabindex="markingAll ? -1 : 0" :aria-disabled="markingAll" :aria-label="t.notifs.markAll" @click="markAll"><LiquidGlass :radius="22" /><text>{{ t.notifs.markAll }}</text></view>
        </view>
        <view v-if="notifs.error" data-testid="notification-error" class="message-state" role="alert"><text>{{ notifsErrorText }}</text><view class="message-button" role="button" tabindex="0" :aria-label="t.ui.retry" @click="notifs.retryRemote()"><LiquidGlass :radius="22" /><text>{{ t.ui.retry }}</text></view></view>
        <view v-if="!notifs.loading && !notifs.error && notifs.nextCursor && filtered.length === 0" role="status" class="message-state"><text>{{ t.notifs.moreToCheck }}</text></view>
        <EmptyState v-if="!notifs.loading && !notifs.error && !notifs.nextCursor && filtered.length === 0" kind="empty-list" :title="emptyTitle" :desc="notifs.items.length === 0 ? t.notifs.emptyBody : undefined" />
        <view v-for="n in filtered" :key="n.id" class="notification-item" :class="{ 'notification-item--read': !!n.readAt }">
          <view class="notification-row" role="button" tabindex="0" :aria-label="n.title" :aria-expanded="expandedId === n.id" @click="toggle(n)" @touchstart="onTouchStart(n, $event)" @touchend="onTouchEnd(n, $event)">
            <view class="notification-icon" aria-hidden="true" v-html="kindIcon(n)" />
            <view class="notification-content"><view class="notification-top"><text class="notification-title">{{ n.title }}</text><text v-if="n.priority === 'critical' || n.priority === 'high'" class="notification-important">{{ t.notifs.important }}</text><text class="notification-time">{{ timeAgo(n.ts) }}</text><view v-if="!n.readAt" class="message-status-dot" /></view><text v-if="n.body" class="notification-preview">{{ n.body }}</text></view>
          </view>
          <view v-if="expandedId === n.id" class="notification-detail"><text v-if="n.body" class="notification-body">{{ n.body }}</text><view v-if="n.ctaLabel && n.ctaHref" class="message-button notification-cta" role="button" tabindex="0" :aria-label="n.ctaLabel" @click.stop="onTap(n)"><LiquidGlass :radius="22" /><text>{{ n.ctaLabel }}</text><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2"><path d="M4 12h16m-7-7 7 7-7 7" /></svg></view></view>
        </view>
        <view v-if="notifs.loading" class="message-state" role="status" aria-live="polite"><text>{{ t.help.loadingMore }}</text></view>
        <view v-if="notifs.nextCursor" class="message-more"><view class="message-button" role="button" :tabindex="notifs.loading ? -1 : 0" :aria-disabled="notifs.loading" :aria-label="t.notifs.loadMore" @click="notifs.loadMoreRemote()"><LiquidGlass :radius="22" /><text>{{ notifs.loading ? t.help.loadingMore : t.notifs.loadMore }}</text></view></view>
        <view v-if="remoteApiEnabled && notifs.items.length" class="message-original"><text>{{ t.notifs.originalTextNote }}</text></view>
      </view>
      <view :style="{ height: ((!headerState.title ? 92 : 0) + (!headerState.primary ? 64 : 0)) + 'px' }" aria-hidden="true" />
      </scroll-view>
    </view>
    </template>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { onShow, onHide, onLoad } from "@dcloudio/uni-app";
import AppChassis from "@/components/app-chassis.vue";
import EmptyState from "@/components/empty-state.vue";
import LiquidGlass from "@/components/liquid-glass.vue";
import ServiceMessageList from "@/components/support/service-message-list.vue";
import { useMessageDrawer, type MessageSection } from "@/store/message-drawer";
import { notificationCategory, type NotificationCategory } from "@/lib/notification-category";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useNotifications, type Notification } from "@/store/notifications";
import { navTo, navBack, takeNavigationQuery } from "@/lib/route";
import { remoteApiEnabled } from "@/api/runtime";
import { isLeftConversionSwipe, type SwipePoint } from "@/lib/notification-swipe";
import { confirm as uiConfirm, useUI } from "@/store/ui";
import { useApp } from "@/store/app";
import { remoteAccountScope } from "@/lib/remote-account-epoch";

const t = useT();
const notifs = useNotifications();
const app = useApp();
const ui = useUI();
const confirmOwner = `notifications:${typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
let pageGeneration = 0;
let pageVisible = true;
let disposed = false;
function captureIntent() {
  return { generation: pageGeneration, account: remoteAccountScope.snapshot() };
}
function isCurrentIntent(intent: ReturnType<typeof captureIntent>) {
  return !disposed && pageVisible && intent.generation === pageGeneration
    && remoteAccountScope.isCurrent(intent.account);
}
// store 保留机器码(SESSION_EXPIRED / NOTIFICATION_UNAVAILABLE / 服务端 envelope 原文…),
// 视图侧统一映射成用户文案 —— 裸插值会把工程码上屏,违反「页面文案禁止错误码」。
// 写法与 risk-disclosure.vue:108 同源。
const notifsErrorText = computed(() => notifs.error ? t.value.notifs.loadFailed : "");

const center = useMessageDrawer();
const section = computed({ get: () => center.section, set: (value: MessageSection) => { center.section = value; } });
onLoad(query => {
  const pending = takeNavigationQuery("/pages/me/notifications");
  const initial = query?.section ?? new URLSearchParams(pending).get("section");
  if (initial === "notifications" || initial === "service") section.value = initial;
});
const sectionOptions = computed(() => [
  { value: "notifications", label: t.value.notifs.notificationsTab, count: notifs.unread > 99 ? "99+" : notifs.unread },
  { value: "service", label: t.value.notifs.serviceTab, count: center.serviceUnread > 99 ? "99+" : center.serviceUnread },
]);
const unreadLabel = computed(() => center.error ? t.value.notifs.unreadUnavailable : center.totalUnread > 0 ? fmt(t.value.notifs.unreadCount, { n: center.totalUnread }) : center.loading ? t.value.help.loadingMore : t.value.notifs.allCaughtUp);
type Filter = "all" | NotificationCategory;
const filter = ref<Filter>("all");
const filterIds: Filter[] = ["all", "finance", "device", "team", "rewards", "system"];
const visibleFilterIds = computed(() => filterIds);
const expandedId = ref<string | null>(null);
const categoryKeys = { finance: "categoryFinance", device: "categoryDevice", team: "kindTeam", rewards: "categoryRewards", system: "kindSystem" } as const;
const categoryIcons: Record<NotificationCategory, string> = {
  finance: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 14h2"/>',
  device: '<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8M12 16v5"/>',
  team: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 4a4 4 0 0 1 0 7M22 21v-2a6 6 0 0 0-3-5"/>',
  rewards: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8H7a3 3 0 1 1 3-3zm0 0h5a3 3 0 1 0-3-3z"/>',
  system: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
};
function kindIcon(n: Notification) { return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${categoryIcons[notificationCategory(n)]}</svg>`; }
const hasRead = computed(() => notifs.items.some(item => !!item.readAt));
function countOf(id: Filter) { return id === "all" ? notifs.items.length : notifs.items.filter(n => notificationCategory(n) === id).length; }
const filtered = computed(() => filter.value === "all" ? notifs.items : notifs.items.filter(n => notificationCategory(n) === filter.value));
function filterLabel(id: Filter) { return id === "all" ? t.value.notifs.filterAll : t.value.notifs[categoryKeys[id]]; }
const emptyTitle = computed(() => notifs.items.length === 0 ? t.value.notifs.emptyAllTitle : fmt(t.value.notifs.emptyFilterTitle, { filter: filterLabel(filter.value) }));
function toggle(n: Notification) { void notifs.markRead(n.id); expandedId.value = expandedId.value === n.id ? null : n.id; }
const markingAll = ref(false);
async function markAll() { if (markingAll.value) return; markingAll.value = true; try { await notifs.markAllRead(); } finally { markingAll.value = false; } }
watch(() => app.accountBindingEpoch, () => { expandedId.value = null; filter.value = "all"; serviceFilter.value = "all"; resetHeader(); });

function timeAgo(ts: number): string {
  const mins = Math.max(1, Math.floor((Date.now() - ts) / 60_000));
  if (mins < 60) return fmt(t.value.tickets.timeMinutesAgo, { n: mins });
  if (mins < 1440) return fmt(t.value.tickets.timeHoursAgo, { n: Math.floor(mins / 60) });
  return fmt(t.value.tickets.timeDaysAgo, { n: Math.floor(mins / 1440) });
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

async function confirmClearRead() {
  const intent = captureIntent();
  if (!isCurrentIntent(intent)) return;
  const accepted = await uiConfirm({
    owner: confirmOwner,
    title: t.value.notifs.clearReadAria,
    message: t.value.notifs.clearReadAria,
    confirmLabel: t.value.notifs.clearReadAria,
    icon: "warn",
  });
  if (accepted && isCurrentIntent(intent)) await notifs.clearRead();
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
  const canonicalRoute = await notifs.recordSwipeConversion(n.id);
  if (canonicalRoute && isCurrentIntent(start.intent)) navTo(canonicalRoute);
}
function invalidatePendingIntents() {
  pageGeneration += 1;
  touchStarts.clear();
  suppressedClick = null;
  ui.clearConfirmsBy(confirmOwner);
}
function invalidatePage() {
  pageVisible = false;
  invalidatePendingIntents();
}
watch(() => [app.accountKey, app.accountBindingEpoch], invalidatePendingIntents, { flush: "sync" });
onMounted(() => { if (!disposed && pageVisible) void center.refresh(); });
onShow(() => {
  if (disposed) return;
  pageVisible = true;
  void center.refresh();
});
onHide(invalidatePage);
onUnmounted(() => { disposed = true; invalidatePage(); });

import GlassSegments from "@/components/glass-segments.vue";
const filterOptions = computed(() => visibleFilterIds.value.map(value => ({ value, label: filterLabel(value) })));

import { advanceMessageHeader, createMessageHeaderState } from "@/lib/message-header-scroll";
const headerState = ref(createMessageHeaderState());
const headerFocused = ref(false);
const serviceFilter = ref<"all" | "advisor" | "support" | "ticket">("all");
const serviceFilters = computed(() => [
  { value: "all", label: t.value.notifs.filterAll }, { value: "advisor", label: t.value.conversations.typeAdvisor },
  { value: "support", label: t.value.conversations.typeSupport }, { value: "ticket", label: t.value.notifs.ticketFilter },
]);
function onMessageScroll(event: { detail: { scrollTop: number } }) { headerState.value = advanceMessageHeader(headerState.value, event.detail.scrollTop, headerFocused.value); }
function revealSections() { headerState.value = { ...headerState.value, primary: true }; }
function resetHeader() { headerState.value = createMessageHeaderState(); }
watch(section, resetHeader);
</script>

<style src="@/styles/message-center.css"></style>
