<!--
  Notification Center (ported from Nexion-prototype/app/(main)/me/notifications/page.tsx).
  Filter pills by NotifKind family + unread badge + mark-all / clear-read actions +
  a timeline of routed events. Tapping a row marks it read and (if it carries a
  ctaHref) navigates. Wrapped in <AppChassis active="me">.

  Scope note: source used a gesture SwipeRow for swipe-to-delete / mark-read /
  conversion-shortcut actions. uni has no swipe primitive and the feed seeds empty
  (events are pushed by the simulation in the full app), so rows degrade to
  tap-to-read + ctaHref navigation; the conversion shortcut surfaces as the row's
  ctaLabel chip. The store keeps push/removeOne for when seeding lands.
-->
<template>
  <AppChassis active="me">
    <view style="padding-bottom: 24px">
      <SubPageHeader back="/pages/me/me" />

      <!-- unread badge + action buttons -->
      <view class="px-4 flex items-center justify-between" style="padding-bottom: 8px">
        <view class="flex items-center" style="gap: 4px">
          <text v-if="notifs.unread > 0" :style="unreadBadgeStyle">{{ notifs.unread }}</text>
        </view>
        <view class="flex items-center" style="gap: 4px">
          <view v-if="notifs.unread > 0" class="flex items-center active:opacity-70" :style="actionBtnStyle('var(--v5-brand)')" @click="notifs.markAllRead()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5" /><path d="m22 10-7.5 7.5L13 16" /></svg>
            <text style="margin-left: 4px">{{ t.notifs.markAll }}</text>
          </view>
          <view v-if="hasRead" class="flex items-center active:opacity-70" :style="actionBtnStyle('var(--v5-ink-3)')" @click="notifs.clearRead()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          </view>
        </view>
      </view>

      <!-- Filter pills -->
      <scroll-view scroll-x class="px-4" style="margin-bottom: 12px; white-space: nowrap">
        <template v-for="id in filterIds" :key="id">
          <view
            v-if="id === 'all' || countOf(id) > 0"
            class="active:opacity-70"
            :style="pillStyle(filter === id)"
            @click="filter = id"
          >
            <text>{{ filterLabel(id) }} ({{ countOf(id) }})</text>
          </view>
        </template>
      </scroll-view>

      <!-- Timeline -->
      <view class="px-4">
        <view v-if="filtered.length === 0" :style="emptyCardStyle">
          <view class="grid place-items-center" style="margin: 0 auto 8px">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" /></svg>
          </view>
          <text class="block" :style="emptyTitleStyle">{{ emptyTitle }}</text>
          <text class="block" :style="emptyBodyStyle">{{ t.notifs.emptyBody }}</text>
        </view>
        <view v-else :style="listStyle">
          <view
            v-for="(n, i) in filtered"
            :key="n.id"
            class="flex items-start active:opacity-90"
            :style="rowStyle(i !== filtered.length - 1, !n.readAt)"
            @click="onTap(n)"
          >
            <view class="relative shrink-0">
              <view class="grid place-items-center" :style="iconBoxStyle(n.kind)">
                <view v-html="kindIcon(n.kind)" />
              </view>
              <view v-if="!n.readAt" :style="unreadDotStyle" />
            </view>
            <view class="min-w-0" style="flex: 1">
              <view class="flex items-baseline justify-between" style="gap: 8px">
                <text class="truncate" :style="titleStyle(!n.readAt)">{{ n.title }}</text>
                <text class="shrink-0" :style="timeStyle">{{ timeAgo(n.ts) }}</text>
              </view>
              <text v-if="n.body" class="block" :style="bodyStyle">{{ n.body }}</text>
              <text v-if="n.ctaLabel" class="block" :style="ctaStyle(n.kind)">{{ n.ctaLabel }} →</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </AppChassis>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from "vue";
import AppChassis from "@/components/app-chassis.vue";
import SubPageHeader from "@/components/sub-page-header.vue";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { useNotifications, type NotifKind, type Notification } from "@/store/notifications";
import { navTo } from "@/lib/route";

const t = useT();
const notifs = useNotifications();

type Filter = "all" | NotifKind;
const filter = ref<Filter>("all");
const filterIds: Filter[] = ["all", "commission", "team", "staking", "market", "genesis", "system"];

const KIND_META: Record<NotifKind, { labelKey: string; tint: string; href: string }> = {
  commission: { labelKey: "kindMoney", tint: "var(--v5-success)", href: "/pages/me/wallet-repurchase" },
  team: { labelKey: "kindTeam", tint: "var(--v5-tech-cyan)", href: "/pages/team/team" },
  staking: { labelKey: "kindStaking", tint: "var(--v5-success)", href: "/pages/staking/staking" },
  market: { labelKey: "kindMarket", tint: "var(--v5-warning)", href: "/pages/market/market" },
  genesis: { labelKey: "kindGenesis", tint: "var(--v5-brand-2)", href: "/pages/genesis/marketplace" },
  system: { labelKey: "kindSystem", tint: "var(--v5-tech-cyan)", href: "" },
};

const KIND_ICON: Record<NotifKind, string> = {
  commission: `<path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />`,
  team: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />`,
  staking: `<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />`,
  market: `<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />`,
  genesis: `<path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /><path d="M2 9h20" />`,
  system: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" />`,
};
function kindIcon(k: NotifKind): string {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${KIND_META[k].tint}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${KIND_ICON[k]}</svg>`;
}

const hasRead = computed(() => notifs.items.some((i) => i.readAt));
function countOf(id: Filter): number {
  return id === "all" ? notifs.items.length : notifs.items.filter((x) => x.kind === id).length;
}
const filtered = computed(() =>
  filter.value === "all" ? notifs.items : notifs.items.filter((x) => x.kind === filter.value),
);

function filterLabelKey(id: Filter): string {
  return id === "all" ? "filterAll" : KIND_META[id].labelKey;
}
function filterLabel(id: Filter): string {
  return (t.value.notifs as unknown as Record<string, string>)[filterLabelKey(id)];
}
const emptyTitle = computed(() =>
  notifs.items.length === 0
    ? t.value.notifs.emptyAllTitle
    : fmt(t.value.notifs.emptyFilterTitle, { filter: filterLabel(filter.value).toLowerCase() }),
);

function timeAgo(ts: number): string {
  const mins = Math.max(1, Math.floor((Date.now() - ts) / 60_000));
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

function onTap(n: Notification) {
  notifs.markRead(n.id);
  const href = n.ctaHref ?? KIND_META[n.kind].href;
  if (href) navTo(href); // ctaHref may be a prototype logical path (/team/commissions, /genesis…) seeded by stella-bubble — navTo maps it; /pages/ hrefs pass through (P-046)
}

const unreadBadgeStyle: CSSProperties = {
  fontSize: "10px",
  background: "var(--v5-danger)",
  color: "var(--v5-on-brand)",
  padding: "2px 6px",
  borderRadius: "999px",
  fontWeight: 600,
};
function actionBtnStyle(color: string): CSSProperties {
  return { height: "36px", padding: "0 10px", borderRadius: "999px", fontSize: "11.5px", fontWeight: 600, color };
}
function pillStyle(active: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: "36px",
    padding: "0 16px",
    marginRight: "6px",
    borderRadius: "999px",
    fontSize: "11.5px",
    fontWeight: 600,
    background: active ? "var(--v5-brand)" : "var(--v5-surface-2)",
    color: active ? "var(--v5-on-brand)" : "var(--v5-ink-3)",
  };
}
const emptyCardStyle: CSSProperties = {
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  padding: "32px",
  textAlign: "center",
};
const emptyTitleStyle: CSSProperties = { fontSize: "13.5px", color: "var(--v5-ink)" };
const emptyBodyStyle: CSSProperties = { fontSize: "11px", color: "var(--v5-ink-3)", marginTop: "4px", lineHeight: 1.4 };
const listStyle: CSSProperties = {
  borderRadius: "16px",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-border)",
  overflow: "hidden",
};
function rowStyle(divider: boolean, unread: boolean): CSSProperties {
  return {
    gap: "12px",
    padding: "12px 16px",
    borderBottom: divider ? "1px solid var(--v5-border)" : "none",
    background: unread ? "var(--v5-surface-2)" : "transparent",
  };
}
function iconBoxStyle(k: NotifKind): CSSProperties {
  return {
    width: "36px",
    height: "36px",
    borderRadius: "12px",
    background: `color-mix(in srgb, ${KIND_META[k].tint} 18%, transparent)`,
  };
}
const unreadDotStyle: CSSProperties = {
  position: "absolute",
  top: "-2px",
  right: "-2px",
  width: "8px",
  height: "8px",
  borderRadius: "999px",
  background: "var(--v5-brand)",
};
function titleStyle(unread: boolean): CSSProperties {
  return {
    fontSize: "12.5px",
    color: unread ? "var(--v5-ink)" : "var(--v5-ink-2)",
    fontWeight: unread ? 600 : 400,
  };
}
const timeStyle: CSSProperties = { fontSize: "10px", color: "var(--v5-ink-3)" };
const bodyStyle: CSSProperties = { fontSize: "11px", color: "var(--v5-ink-3)", marginTop: "2px", lineHeight: 1.4 };
function ctaStyle(k: NotifKind): CSSProperties {
  return { fontSize: "10.5px", fontWeight: 600, color: KIND_META[k].tint, marginTop: "6px" };
}
</script>
