<!--
  AppChassis — page shell (uni has no root layout / App.vue renders no template,
  P-004). Route-aware like the prototype's root layout (header.tsx + tab-bar.tsx):
    · TAB routes (home/earn/store/team/me): brand row (N badge + Nexion/title +
      search + bell-badge) + FLOATING frosted-glass pill TabBar (5 tabs, active =
      gradient brand pill) + home indicator. Liquid-Glass faithful to v5.
    · SUB routes (everything else): NO brand row + NO 5-tab pill (the page carries
      its own in-page back/title row); only the status bar + home indicator. This
      keeps all ~56 sub-pages correct with zero per-page edits.
  Route is read from getCurrentPages() so the chassis self-detects mode; the
  `active` prop is an optional fallback for the very first frame.
-->
<template>
  <view class="nx-chassis" style="background: var(--v5-bg)">
    <!-- Status bar safe area (real on device, ~0 on desktop H5) -->
    <view class="nx-statusbar" :style="{ height: statusBarHeight + 'px' }" />

    <!-- Header brand row — TAB routes only (sub-pages carry their own back row) -->
    <view v-if="isTabRoute" class="nx-header" :style="{ top: statusBarHeight + 'px' }">
      <view class="nx-header__l">
        <view class="nx-logo"><text class="nx-logo__n">N</text></view>
        <text v-if="isHome" class="nx-brand">Nexion</text>
        <text v-if="isHome" class="nx-ver">v3.2</text>
        <text v-else class="nx-title">{{ pageTitle }}</text>
      </view>
      <view class="nx-header__r">
        <view class="nx-icon-btn" @click="goSearch">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        </view>
        <view class="nx-icon-btn nx-bell" @click="goNotifications">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          <view v-if="unread > 0" class="nx-badge"><text class="nx-badge__t">{{ unreadLabel }}</text></view>
        </view>
      </view>
    </view>

    <!-- Scrollable content — a plain overflow:auto <view> (NOT <scroll-view>):
         uni's <scroll-view> renders on its own compositing layer, which makes
         the fixed chrome's backdrop-filter unable to frost the scrolled content
         (P-039) → chrome looks flat/opaque. A normal overflow:auto view shares
         the paint surface (exactly what the prototype's `absolute inset-0
         overflow-y-auto` div does) so the frosted glass renders. Pull-to-refresh
         is the prototype's own touch-gesture port (themed brand spinner). -->
    <view
      ref="scrollEl"
      class="nx-content nx-scroll"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <!-- themed pull-to-refresh indicator — anchored just below the header,
           centered in the pull gap. -->
      <view
        class="nx-refresher"
        :style="{ top: contentTop + 'px', transform: `translate(-50%, ${indicatorY / 2 - 18}px)`, opacity: refresherVisible ? 1 : 0, transition: pulling ? 'opacity .15s' : 'transform .28s cubic-bezier(.16,1,.3,1), opacity .2s' }"
      >
        <view class="nx-refresher-icon" :class="{ 'nx-spinning': refreshing }" :style="{ transform: refreshing ? '' : `rotate(${Math.min(1, pullY / 70) * 270}deg)` }">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 1 1-6.2-8.5" stroke="var(--v5-brand)" stroke-width="2.4" stroke-linecap="round" /><path d="M21 3v6h-6" stroke="var(--v5-brand)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </view>
      </view>
      <!-- pull translate wrapper — transform applies ONLY while pulling/refreshing.
           When idle it MUST carry NO transform: a lingering `translateY(0)`
           promotes this content to its own compositing layer, which the chrome's
           backdrop-filter cannot sample → the frosted glass shows nothing (looks
           opaque). Mirrors the prototype PullableContent ("transform must be
           ABSENT, not translateY(0), when idle"). (P-041) -->
      <view :style="pullActive ? { transform: `translateY(${indicatorY}px)`, transition: pulling ? 'none' : 'transform .28s cubic-bezier(.16,1,.3,1)', willChange: 'transform' } : {}">
        <!-- Padded so content sits BELOW the header / ABOVE the tabbar, while the
             scroll container (.nx-content) spans the FULL chassis (top:0/bottom:0).
             This is the crux: content then scrolls BEHIND the frosted chrome and
             actually gets frosted. With the old top:contentTop inset, .nx-content
             clipped everything above the header so there was nothing behind the
             chrome to frost → it read as solid black. (P-041) `backwards` fill on
             the entrance so no transform lingers. -->
        <view class="nx-page-enter" :style="{ paddingTop: contentTop + 'px', paddingBottom: contentBottom + 'px' }">
          <slot />
        </view>
      </view>
    </view>

    <!-- Bottom chrome: floating pill TabBar (tab routes) + home indicator (always) -->
    <view class="nx-tabbar-wrap">
      <view v-if="isTabRoute" class="nx-tabbar-pill">
        <view aria-hidden class="nx-tab-specular" />
        <view
          v-for="tab in tabs"
          :key="tab.key"
          class="nx-tab"
          :style="tab.key === activeTab ? activeTabStyle : { color: 'var(--v5-ink-3)' }"
          @click="go(tab)"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            :stroke="tab.key === activeTab ? 'var(--v5-brand)' : 'var(--v5-ink-3)'"
            :stroke-width="tab.key === activeTab ? 2.4 : 2" stroke-linecap="round" stroke-linejoin="round">
            <path :d="tab.icon" />
            <template v-if="tab.icon2"><path :d="tab.icon2" /></template>
          </svg>
          <text class="nx-tab__label" :style="{ color: tab.key === activeTab ? 'var(--v5-brand)' : 'var(--v5-ink-3)' }">{{ tab.label }}</text>
        </view>
      </view>
      <view class="nx-home-indicator" />
    </view>

    <!-- Nova 浮标 — floating Stella advisor entry + its drawer + push triggers.
         Tab routes only (chassis-gated); the button self-hides until unread>0. -->
    <StellaBubble v-if="isTabRoute" />

    <!-- Chassis-level overlays (each self-gates on its own store's open state,
         mirroring the prototype IOSFrame). Ported P-043. -->
    <TrialClaimSheet />
    <SlotActionSheet />
    <TradeinSheets />
    <LuckySpinSheet />
    <TrialExtensionSheet />
    <TrialUnbindRetentionSheet />
    <StickyCtaBar />
    <GenesisDockHost />
    <MessageDrawer />

    <!-- Global overlay host (toast / confirm / netError) -->
    <GlobalUi />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, type CSSProperties } from "vue";
import GlobalUi from "@/components/global-ui.vue";
import StellaBubble from "@/components/stella/stella-bubble.vue";
import TrialClaimSheet from "@/components/trial-claim-sheet.vue";
import SlotActionSheet from "@/components/slot-action-sheet.vue";
import StickyCtaBar from "@/components/sticky-cta-bar.vue";
import TradeinSheets from "@/components/tradein-sheets.vue";
import LuckySpinSheet from "@/components/lucky-spin-sheet.vue";
import TrialExtensionSheet from "@/components/trial-extension-sheet.vue";
import TrialUnbindRetentionSheet from "@/components/trial-unbind-retention-sheet.vue";
import GenesisDockHost from "@/components/genesis-dock-host.vue";
import MessageDrawer from "@/components/message-drawer.vue";
import { useT } from "@/i18n/use-t";
import { useNotifications } from "@/store/notifications";
import { useMessageDrawer } from "@/store/message-drawer";
import { useRefresh } from "@/store/refresh";
import { useTrialClaimSheet } from "@/store/trial-claim-sheet";

const props = defineProps<{ active?: "home" | "earn" | "store" | "team" | "me" }>();

const t = useT();
const notifications = useNotifications();
const messageDrawer = useMessageDrawer();
const refresh = useRefresh();
const trialClaimSheet = useTrialClaimSheet();

// ── Pull-to-refresh — touch gesture ported from the prototype's PullToRefresh
// (lib/store/refresh + ui/pull-to-refresh.tsx). The plain overflow:auto view
// (see template) needs its own gesture since we dropped <scroll-view>. Only
// fires when scrolled to top + not already refreshing. Brand-themed spinner.
const TRIGGER_PX = 70; // pull distance (damped) needed to fire
const MAX_PX = 110; // visual ceiling
const HOLD_PX = 56; // parked spinner position while loading
const DAMP = 0.5; // iOS-like resistance
const pullY = ref(0);
const pulling = ref(false);
// pullActive gates whether the content wrapper carries a transform at all. It
// stays true during the pull + ~340ms after release (so the spring-back still
// animates) then drops to false → transform removed → chrome backdrop-filter
// can frost the content again. (P-041)
const pullActive = ref(false);
let deactivateTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleDeactivate() {
  if (deactivateTimer) clearTimeout(deactivateTimer);
  deactivateTimer = setTimeout(() => {
    if (pullY.value === 0 && !refresh.isRefreshing) pullActive.value = false;
  }, 340);
}
const scrollEl = ref<unknown>(null);
let startY: number | null = null;

const refreshing = computed(() => refresh.isRefreshing);
const indicatorY = computed(() => (refreshing.value ? HOLD_PX : pullY.value));
const refresherVisible = computed(() => refreshing.value || pullY.value > 6);

// uni <view> template ref → DOM element via $el on H5 (P-019); read scrollTop
// directly so the pull only arms when the content is at the very top.
function currentScrollTop(): number {
  const raw = scrollEl.value as { $el?: HTMLElement } | HTMLElement | null;
  const el = (raw && typeof raw === "object" && "$el" in raw ? raw.$el : raw) as HTMLElement | null;
  return el?.scrollTop ?? 0;
}
function touchY(e: TouchEvent): number | null {
  const tp = e.touches?.[0] ?? e.changedTouches?.[0];
  return tp ? tp.clientY : null;
}
function onTouchStart(e: TouchEvent) {
  if (refreshing.value || currentScrollTop() > 0) { startY = null; return; }
  startY = touchY(e);
}
function onTouchMove(e: TouchEvent) {
  if (startY === null || refreshing.value) return;
  const y = touchY(e);
  if (y === null) return;
  const dy = y - startY;
  if (dy <= 0) { pullY.value = 0; pulling.value = false; return; }
  pulling.value = true;
  pullActive.value = true; // arm the transform layer only now (idle stays clean)
  if (deactivateTimer) { clearTimeout(deactivateTimer); deactivateTimer = null; }
  pullY.value = Math.min(MAX_PX, dy * DAMP);
}
async function onTouchEnd() {
  if (startY === null) return;
  const pulled = pullY.value;
  startY = null;
  pulling.value = false;
  if (pulled >= TRIGGER_PX && !refreshing.value) {
    pullY.value = HOLD_PX;
    await refresh.refresh();
  }
  pullY.value = 0;
  scheduleDeactivate(); // drop the transform after the spring-back finishes
}

// ── route self-detection (mirrors the prototype root layout) ──
const TAB_ROUTE_KEY: Record<string, "home" | "earn" | "store" | "team" | "me"> = {
  "pages/index/index": "home",
  "pages/earn/earn": "earn",
  "pages/store/store": "store",
  "pages/team/team": "team",
  "pages/me/me": "me",
};
function readRoute(): string {
  try {
    const ps = getCurrentPages();
    return ps.length ? ((ps[ps.length - 1] as { route?: string }).route ?? "") : "";
  } catch {
    return "";
  }
}
const route = ref(readRoute());
onMounted(() => {
  route.value = readRoute();
  const closeTransient = (trialClaimSheet as { closeTransient?: () => void }).closeTransient;
  if (typeof closeTransient === "function") closeTransient();
  else trialClaimSheet.open = false;
});

const routeTab = computed(() => TAB_ROUTE_KEY[route.value]);
// Tab route when the current route is one of the 5 mains. First-frame fallback:
// if the route isn't resolved yet but the page passed a tab `active` prop AND no
// route string, treat as tab (the 5 tab pages always pass it; sub-pages resolve
// their route synchronously so won't be mis-flagged).
const isTabRoute = computed(() => routeTab.value !== undefined || (route.value === "" && !!props.active));
const activeTab = computed(() => routeTab.value ?? props.active ?? "home");
const isHome = computed(() => activeTab.value === "home");

const pageTitle = computed(() => {
  const map: Record<string, string> = {
    earn: t.value.headerTitles.earn,
    store: t.value.headerTitles.store,
    team: t.value.headerTitles.team,
    me: t.value.headerTitles.me,
  };
  return map[activeTab.value] ?? "";
});

const unread = computed(() => notifications.unread);
const unreadLabel = computed(() => (unread.value > 99 ? "99+" : String(unread.value)));

// ── layout insets ──
const statusBarHeight = computed(() => {
  try {
    return uni.getSystemInfoSync().statusBarHeight || 0;
  } catch {
    return 0;
  }
});
const HEADER_H = 52;
const TABBAR_INSET = 92; // floating pill (64) + home indicator (22) + gap
const SUB_BOTTOM = 26; // home indicator only
const contentTop = computed(() => statusBarHeight.value + (isTabRoute.value ? HEADER_H : 0));
const contentBottom = computed(() => (isTabRoute.value ? TABBAR_INSET : SUB_BOTTOM));

// lucide-style outline paths (Home / Zap / ShoppingBag / Users / User)
const tabs = computed(() => [
  { key: "home", route: "/pages/index/index", label: t.value.tabs.home, icon: "M3 10.5 11.2 3.2a1.2 1.2 0 0 1 1.6 0L21 10.5", icon2: "M5 9.5V20a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V9.5" },
  { key: "earn", route: "/pages/earn/earn", label: t.value.tabs.earn, icon: "M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" },
  { key: "store", route: "/pages/store/store", label: t.value.tabs.store, icon: "M5 8h14l-1 12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z", icon2: "M9 8V6a3 3 0 0 1 6 0v2" },
  { key: "team", route: "/pages/team/team", label: t.value.tabs.team, icon: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", icon2: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M22 20v-2a4 4 0 0 0-3-3.8" },
  { key: "me", route: "/pages/me/me", label: t.value.tabs.me, icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", icon2: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" },
]);

// Liquid-Glass active-tab gradient pill (faithful to prototype tab-bar.tsx).
const activeTabStyle: CSSProperties = {
  color: "var(--v5-brand)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--v5-brand) 22%, transparent) 0%, color-mix(in srgb, var(--v5-brand) 8%, transparent) 100%)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.22)," +
    "inset 0 0 16px color-mix(in srgb, var(--v5-brand) 14%, transparent)," +
    "0 0 0 0.5px color-mix(in srgb, var(--v5-brand) 28%, transparent)",
};

function go(tab: { key: string; route: string }) {
  if (tab.key === activeTab.value) return;
  uni.reLaunch({ url: tab.route, fail: () => {} });
}
function goSearch() {
  uni.navigateTo({ url: "/pages/search/search", fail: () => {} });
}
// Bell → in-place slide-in MessageDrawer (now ported, P-043), matching the
// prototype. (Was routing to the full /pages/me/notifications page as a stopgap.)
function goNotifications() {
  messageDrawer.show();
}
</script>

<style scoped>
.nx-chassis {
  position: fixed;
  inset: 0;
  overflow: hidden;
}
.nx-statusbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 110;
  background: var(--v5-chrome-bg);
  backdrop-filter: saturate(180%) blur(24px);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
}
.nx-header {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 100;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--v5-chrome-bg);
  border-bottom: 1px solid var(--v5-chrome-border);
  backdrop-filter: saturate(180%) blur(24px);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
}
.nx-header__l {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.nx-logo {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: var(--v5-ink);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.nx-logo__n {
  color: var(--v5-bg);
  font-weight: 700;
  font-size: 15px;
  font-family: var(--font-v5);
  line-height: 1;
}
.nx-brand {
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--v5-ink);
}
.nx-ver {
  font-size: 11px;
  font-weight: 500;
  color: var(--v5-ink-4);
  margin-left: -2px;
}
.nx-title {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--v5-ink);
  font-family: var(--font-v5);
}
.nx-header__r {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.nx-icon-btn {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.nx-badge {
  position: absolute;
  top: 4px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--v5-brand-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.nx-badge__t {
  font-size: 9.5px;
  font-weight: 700;
  color: var(--v5-on-brand-2);
  font-family: var(--font-v5);
  line-height: 1;
}
.nx-content {
  /* absolute (NOT fixed) inside the fixed chassis — mirrors the prototype's
     `absolute inset-0 overflow-y-auto`. And NO -webkit-overflow-scrolling:touch:
     that promotes a separate iOS momentum compositing layer which (like
     <scroll-view>) the fixed/absolute chrome's backdrop-filter cannot frost.
     Plain absolute overflow:auto stays on the chassis paint surface → the
     frosted glass actually renders. (P-039 / P-040) */
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior-y: contain;
}
/* hide scrollbar (match the prototype's no-scrollbar utility) */
.nx-content::-webkit-scrollbar {
  display: none;
}
/* themed pull-to-refresh indicator — dark chip + brand spinner */
.nx-refresher {
  position: absolute;
  top: 0;
  left: 50%;
  z-index: 5;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--v5-surface);
  border: 1px solid var(--v5-border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  display: grid;
  place-items: center;
  pointer-events: none;
}
.nx-refresher-icon {
  display: grid;
  place-items: center;
  transition: transform 0.15s;
}
.nx-spinning {
  animation: nx-spin 0.8s linear infinite;
}
@keyframes nx-spin {
  to {
    transform: rotate(360deg);
  }
}
/* page entrance — fade + slight-y, re-fires on each page (chassis) mount.
   `backwards` (NOT `both`): applies the `from` state before start for a clean
   fade-in, but does NOT hold a `transform` after the animation ends — a lingering
   transform would composite the content and block the chrome's backdrop-filter
   frosting (P-041). After 0.36s the element reverts to its base (no transform). */
.nx-page-enter {
  animation: nx-page-in 0.36s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}
@keyframes nx-page-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.nx-tabbar-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  /* transparent wrapper — the pill's own backdrop blurs content behind it */
}
.nx-tabbar-pill {
  margin: 0 12px;
  display: flex;
  align-items: stretch;
  padding: 4px;
  border-radius: 22px;
  overflow: hidden;
  position: relative;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.02) 45%, transparent 100%),
    var(--v5-tabbar-bg);
  backdrop-filter: blur(40px) saturate(180%) brightness(1.05);
  -webkit-backdrop-filter: blur(40px) saturate(180%) brightness(1.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    inset 0 -1px 0 rgba(0, 0, 0, 0.12),
    0 10px 36px rgba(0, 0, 0, 0.4),
    0 0 0 0.5px rgba(255, 255, 255, 0.04);
}
.nx-tab-specular {
  position: absolute;
  left: 12%;
  right: 12%;
  top: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.45), transparent);
  opacity: 0.7;
  pointer-events: none;
}
.nx-tab {
  flex: 1;
  height: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 16px;
}
.nx-tab__label {
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font-v5);
  letter-spacing: -0.005em;
}
.nx-home-indicator {
  height: 22px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 8px;
}
.nx-home-indicator::after {
  content: "";
  width: 134px;
  height: 5px;
  border-radius: 3px;
  background: var(--v5-home-indicator);
}
</style>
