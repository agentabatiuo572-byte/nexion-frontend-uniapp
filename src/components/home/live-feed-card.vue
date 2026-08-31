<!--
  LiveFeedCard — ZONE 1 dual-tab live ticker (ported from mission-control.tsx
  LiveFeedCard). The formal App keeps the same dual-tab layout while projecting
  both views exclusively from the authenticated Home settlement ledger returned
  by Java. High-fidelity Mock data remains isolated in the 5174 prototype repo.
-->
<template>
  <view data-home-section="live-feed" data-feed-mode="CANONICAL">
    <!-- Tab switcher + see-all shortcut -->
    <view class="px-0.5 pt-1 pb-2.5 flex items-center justify-between gap-2">
      <!-- 轨道贴页面底:原 surface-2 与页面底同色不可辨(亮色 ΔE 2.2),改 L1。
           配套把选中 pill 从「白底+投影」换成 brand-soft 底(见 tabStyle),
           否则轨道和选中 pill 都是白的,等于修掉隐形又弄丢选中态。 -->
      <view class="flex gap-0.5" style="padding: 3px; background: var(--v5-surface); border-radius: 9px" role="tablist" :aria-label="`${t.home.liveFeedTabActivity} / ${t.home.liveFeedTabEarnings}`">
        <!-- 《08》§2 反馈恒定:选中态原先是空 class,按下去零反馈。
             切到自己虽然不改变什么,但用户仍需要「点到了」的确认。 -->
        <view
          id="home-live-feed-tab-activity"
          class="active:opacity-70 transition-opacity"
          :style="tabStyle('activity')"
          role="tab"
          :aria-selected="tab === 'activity'"
          aria-controls="home-live-feed-panel-activity"
          :tabindex="tab === 'activity' ? 0 : -1"
          @click="tab = 'activity'"
          @keydown.enter.stop.prevent="tab = 'activity'"
          @keydown.space.stop.prevent="tab = 'activity'"
          @keydown.left.stop.prevent="activateAdjacentTab('activity', -1)"
          @keydown.up.stop.prevent="activateAdjacentTab('activity', -1)"
          @keydown.right.stop.prevent="activateAdjacentTab('activity', 1)"
          @keydown.down.stop.prevent="activateAdjacentTab('activity', 1)"
          @keydown.home.stop.prevent="activateTabFromKeyboard('activity')"
          @keydown.end.stop.prevent="activateTabFromKeyboard('earnings')"
        >
          <text :style="{ color: tab === 'activity' ? 'var(--v5-brand)' : 'var(--v5-ink-3)', fontWeight: tab === 'activity' ? 600 : 500, fontFamily: 'var(--font-v5)', fontSize: '12px', letterSpacing: '-0.005em' }">{{ t.home.liveFeedTabActivity }}</text>
        </view>
        <view
          id="home-live-feed-tab-earnings"
          class="active:opacity-70 transition-opacity"
          :style="tabStyle('earnings')"
          role="tab"
          :aria-selected="tab === 'earnings'"
          aria-controls="home-live-feed-panel-earnings"
          :tabindex="tab === 'earnings' ? 0 : -1"
          @click="tab = 'earnings'"
          @keydown.enter.stop.prevent="tab = 'earnings'"
          @keydown.space.stop.prevent="tab = 'earnings'"
          @keydown.left.stop.prevent="activateAdjacentTab('earnings', -1)"
          @keydown.up.stop.prevent="activateAdjacentTab('earnings', -1)"
          @keydown.right.stop.prevent="activateAdjacentTab('earnings', 1)"
          @keydown.down.stop.prevent="activateAdjacentTab('earnings', 1)"
          @keydown.home.stop.prevent="activateTabFromKeyboard('activity')"
          @keydown.end.stop.prevent="activateTabFromKeyboard('earnings')"
        >
          <text :style="{ color: tab === 'earnings' ? 'var(--v5-brand)' : 'var(--v5-ink-3)', fontWeight: tab === 'earnings' ? 600 : 500, fontFamily: 'var(--font-v5)', fontSize: '12px', letterSpacing: '-0.005em' }">{{ t.home.liveFeedTabEarnings }}</text>
        </view>
      </view>
      <view v-if="tab === 'earnings'" class="inline-flex items-center gap-1 font-mono-tabular active:opacity-70 transition-opacity" style="min-height: 44px; font-size: 12px; color: var(--v5-ink-3)" role="link" tabindex="0" @click.stop="goEarnings" @keydown.enter.stop.prevent="goEarnings">
        <text style="color: var(--v5-ink-3)">{{ t.home.liveFeedSeeAll }}</text>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </view>
    </view>

    <!-- Activity tab -->
    <view v-show="tab === 'activity'" id="home-live-feed-panel-activity" class="font-mono-tabular" style="padding: 0 2px 6px; font-size: 12px" role="tabpanel" aria-labelledby="home-live-feed-tab-activity" :aria-hidden="tab !== 'activity'" :tabindex="tab === 'activity' ? 0 : -1">
      <view
        v-for="(r, i) in displayActivityRows"
        :key="r.k"
        data-home-live-activity-row="true"
        class="grid items-center gap-2.5 py-2 whitespace-nowrap"
        :style="{ gridTemplateColumns: whoColTemplate, borderBottom: i < displayActivityRows.length - 1 ? '1px solid var(--v5-border)' : 'none', animation: i === 0 ? 'v5-ledger-fade 0.5s ease' : 'none' }"
      >
        <text class="tabular-nums" style="font-size: 12px; color: var(--v5-ink-4)">{{ r.ts }}</text>
        <text class="text-center" :style="whoBadgeStyle(r)">{{ whoLabel(r.who) }}</text>
        <!-- 《02》§4 判定线:动态流是「浏览型」内容且设计上单行截断,归 caption 12
             (原 12.5→13 迁移使截断加剧,溢出探针实测 +6px,数据驱动回到 12) -->
        <text class="truncate" style="font-family: var(--font-v5); font-weight: 400; font-size: 12px; line-height: 16px; color: var(--v5-ink-2)">{{ r.msg }}</text>
        <text class="tabular-nums text-right" style="font-weight: 500" :style="{ color: valColor(r) }">{{ r.val === 'locked' ? t.home.feedValLocked : r.val }}</text>
      </view>
      <view v-if="displayActivityRows.length === 0" class="flex items-center justify-between px-1 py-3" style="gap: 12px">
        <text style="font-size: 12px; color: var(--v5-ink-3)">{{ remoteFeedStatusText }}</text>
        <text v-if="app.homeTruthStatus === 'error'" class="font-mono-tabular active:opacity-70" role="button" tabindex="0" style="font-size: 12px; color: var(--v5-brand); font-weight: 600" @click="retryHome" @keydown.enter.stop.prevent="retryHome" @keydown.space.stop.prevent="retryHome">{{ t.ui.retry }}</text>
      </view>
    </view>

    <!-- Earnings tab -->
    <view v-show="tab === 'earnings'" id="home-live-feed-panel-earnings" role="tabpanel" aria-labelledby="home-live-feed-tab-earnings" :aria-hidden="tab !== 'earnings'" :tabindex="tab === 'earnings' && displayEarningsItems.length === 0 ? 0 : -1">
      <view v-if="displayEarningsItems.length > 0" class="block active:opacity-90 transition-opacity" role="link" tabindex="0" @click="goEarnings" @keydown.enter.stop.prevent="goEarnings">
        <view
          v-for="(it, i) in displayEarningsItems"
          :key="it.id"
          data-home-live-earnings-row="true"
          class="px-0.5 py-2 flex items-center gap-2"
          :style="{ fontSize: '12px', borderBottom: i < displayEarningsItems.length - 1 ? '1px solid var(--v5-border)' : 'none', animation: i === 0 ? 'v5-ledger-fade 0.5s ease' : 'none' }"
        >
          <view style="width: 5px; height: 5px; border-radius: 50%; background: var(--v5-success); flex-shrink: 0" />
          <text style="font-family: var(--font-v5); font-weight: 600; color: var(--v5-ink)">{{ it.name }}</text>
          <text class="truncate flex-1" style="color: var(--v5-ink-3)">{{ it.product }}</text>
          <text class="font-mono-tabular tabular-nums whitespace-nowrap" style="color: var(--v5-success-ink); font-weight: 500">+${{ earningsAmount(it) }}</text>
        </view>
      </view>
      <view v-else class="flex items-center justify-between px-1 py-3" style="gap: 12px">
        <text style="font-size: 12px; color: var(--v5-ink-3)">{{ remoteFeedStatusText }}</text>
        <text v-if="app.homeTruthStatus === 'error'" class="font-mono-tabular active:opacity-70" role="button" tabindex="0" style="font-size: 12px; color: var(--v5-brand); font-weight: 600" @click="retryHome" @keydown.enter.stop.prevent="retryHome" @keydown.space.stop.prevent="retryHome">{{ t.ui.retry }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { navTo } from "@/lib/route";
import { computed, nextTick, ref, type CSSProperties } from "vue";
import { useT } from "@/i18n/use-t";
import { dateLocale } from "@/i18n/format";
import { useLocaleStore } from "@/store/locale";
import { useApp } from "@/store/app";
import { buildCanonicalHomeFeed } from "./home-live-feed";

interface FeedRow {
  k: number | string;
  lvl: "ok" | "live" | "warn";
  who: string;
  msg: string;
  val: string;
  ts: string;
}
interface EarningsItem {
  id: string;
  name: string;
  product: string;
  amount: number;
}

const t = useT();
const app = useApp();
const tab = ref<"activity" | "earnings">("activity");

const canonicalFeed = computed(() => buildCanonicalHomeFeed(app.homeTruth?.earningsLedger ?? []));

const tabOrder = ["activity", "earnings"] as const;

const displayActivityRows = computed<FeedRow[]>(() => {
  return canonicalFeed.value.activityRows.map((row) => ({
    k: row.id,
    lvl: "ok",
    who: "You",
    msg: `${row.model} @ ${row.client}`,
    val: `+$${row.rewardUsdt.toFixed(5)}`,
    ts: new Date(row.completedAt).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit", hour12: false }),
  }));
});
const displayEarningsItems = computed<EarningsItem[]>(() => {
  return canonicalFeed.value.earningsItems.map((row) => ({
    id: row.id,
    name: row.model,
    product: row.client,
    amount: row.amountUsdt,
  }));
});
const remoteFeedStatusText = computed(() => {
  if (app.homeTruthStatus === "loading" || app.homeTruthStatus === "idle") return t.value.home.networkStatUpdating;
  if (app.homeTruthStatus === "error") return t.value.uiChrome.unavailable;
  return tab.value === "activity" ? t.value.home.liveFeedEmpty : t.value.home.ledgerEmpty;
});

function tabStyle(id: "activity" | "earnings"): CSSProperties {
  const on = tab.value === id;
  return {
    // 《07》tap≥44:原 3px 纵向 padding 实测盒高仅 28px。用 min-height 撑热区,
    // 视觉高度靠 flex 居中维持紧凑观感(《03》§2 圆角上阶梯 6→12)。
    minHeight: "44px",
    display: "inline-flex",
    alignItems: "center",
    padding: "0 12px",
    borderRadius: "12px",
    // 选中态改用 brand-soft 底 + brand 文字 —— 与本仓库同类分段/排序控件一致
    // (genesis/marketplace 的 sortPillStyle、home/device-slot 的在线态)。
    // 原「白底 + 投影」在轨道提到 L1(白)之后会与轨道撞色,只剩一层淡投影可辨;
    // 且靠 box-shadow 表达选中本就违反《03》「不用 box-shadow 做层级」。
    background: on ? "var(--v5-brand-soft)" : "transparent",
    boxShadow: "none",
  };
}
// 身份徽章列宽按语言取值(包 G P2#2 选项 a):en「Peer」/zh「同伴」进 38px,
// vi「Thành viên」实测 ~62px,固定 38px 溢出 5px+;列宽仍是常量 → 跨行对齐不破。
const localeStore = useLocaleStore();
const whoColTemplate = computed(() => `44px ${localeStore.code === "vi" ? "66px" : "38px"} 1fr auto`);

function whoBadgeStyle(r: FeedRow): CSSProperties {
  const bg = r.lvl === "ok" ? "var(--v5-success-soft)" : r.lvl === "live" ? "var(--v5-tech-cyan-soft)" : "var(--v5-warning-soft)";
  const color = r.lvl === "ok" ? "var(--v5-success)" : r.lvl === "live" ? "var(--v5-tech-cyan)" : "var(--v5-warning)";
  return { fontSize: "12px", fontWeight: 500, padding: "1px 5px", borderRadius: "3px", letterSpacing: "0.04em", background: bg, color };
}
function valColor(r: FeedRow): string {
  return r.val === "locked" ? "var(--v5-ink-4)" : r.who === "You" ? "var(--v5-ink-3)" : "var(--v5-success)";
}
function whoLabel(who: string): string { return who === "You" ? t.value.home.feedWhoYou : who === "Peer" ? t.value.home.feedWhoPeer : who === "Lock" ? t.value.home.feedWhoLock : who; }
function activateAdjacentTab(current: "activity" | "earnings", offset: -1 | 1) {
  const currentIndex = tabOrder.indexOf(current);
  const nextIndex = (currentIndex + offset + tabOrder.length) % tabOrder.length;
  activateTabFromKeyboard(tabOrder[nextIndex]);
}
function activateTabFromKeyboard(nextTab: "activity" | "earnings") {
  tab.value = nextTab;
  void nextTick(() => {
    if (typeof document === "undefined") return;
    document.getElementById(`home-live-feed-tab-${nextTab}`)?.focus();
  });
}
function earningsAmount(it: EarningsItem): string {
  return it.amount.toFixed(5);
}
function retryHome() {
  void app.refreshHomeTruth();
}
function goEarnings() {
  navTo("/pages/me/wallet-bills");
}
</script>
