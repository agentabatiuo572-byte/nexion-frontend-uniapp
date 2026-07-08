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
    <view class="nx-top-chrome" :style="{ height: topChromeHeight + 'px' }" />

    <!-- Status bar safe area (real on device, ~0 on desktop H5) -->
    <view class="nx-statusbar" :style="{ height: statusBarHeight + 'px' }">
      <view v-if="showPreviewStatusBar" class="nx-statusbar__inner" aria-hidden="true">
        <text class="nx-statusbar__time">{{ statusTime }}</text>
        <view class="nx-statusbar__icons">
          <view class="nx-statusbar__signal">
            <view />
            <view />
            <view />
            <view />
          </view>
          <view class="nx-statusbar__wifi"><view /></view>
          <view class="nx-statusbar__battery" />
        </view>
      </view>
    </view>

    <!-- Header brand row — TAB routes only (sub-pages carry their own back row) -->
    <view v-if="isTabRoute" class="nx-header" :style="{ top: statusBarHeight + 'px' }">
      <view class="nx-header__l">
        <view class="nx-logo" aria-hidden="true">
          <image class="nx-logo-img nx-logo-img--light" src="/static/img/brand/header-logo-light.png" mode="aspectFit" />
          <image class="nx-logo-img nx-logo-img--dark" src="/static/img/brand/header-logo-dark.png" mode="aspectFit" />
        </view>
      </view>
      <view class="nx-header__center" />
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

    <!-- Page nav header — sub-pages that registered via useSetPageHeader. Sticky
         chassis row (NOT inside page content) so it pins on scroll + frosts the
         content behind it, mirroring the prototype Header nav row. Tab pages never
         set pageHeader, so this never shows for them (brand row stays untouched). -->
    <view v-if="!isTabRoute && navHeader" class="nx-navheader" :style="{ top: statusBarHeight + 'px', height: navHeaderH + 'px' }">
      <view class="nx-nav-side" @click="navBack">
        <view class="nx-nav-glass">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </view>
      </view>
      <view class="nx-nav-titlewrap">
        <text class="nx-nav-title">{{ navHeader.title }}</text>
        <text v-if="navHeader.subtitle" class="nx-nav-sub">{{ navHeader.subtitle }}</text>
      </view>
      <view class="nx-nav-side" @click="goNotifications">
        <view class="nx-nav-glass">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-2)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          <view class="nx-nav-belldot" />
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
          <slot name="pageTop" />
          <!-- Voucher fallback banner — chassis-injected at content top so the
               5 protected tab pages stay untouched (ALIGNMENT red-line). Self-
               hides unless a claimable voucher targets the current surface. -->
          <VoucherBanner v-if="bannerSurface" :surface="bannerSurface" />
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

    <!-- Nova 浮标 — floating Nova advisor entry + its drawer + push triggers.
         Tab routes only (chassis-gated); the button self-hides until unread>0. -->
    <NovaBubble v-if="isTabRoute" />

    <!-- Chassis-level overlays (each self-gates on its own store's open state,
         mirroring the prototype IOSFrame). Ported P-043. -->
    <template v-if="showBusinessOverlays">
      <TrialClaimSheet />
      <VoucherClaimSheet />
      <SlotActionSheet />
      <TradeinSheets />
      <LuckySpinSheet />
      <TrialExtensionSheet />
      <TrialUnbindRetentionSheet />
      <StickyCtaBar />
      <GenesisDockHost />
      <MessageDrawer />
    </template>

    <!-- Global overlay host (toast / confirm / netError) -->
    <GlobalUi />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, nextTick, type CSSProperties } from "vue";
import GlobalUi from "@/components/global-ui.vue";
import NovaBubble from "@/components/nova/nova-bubble.vue";
import TrialClaimSheet from "@/components/trial-claim-sheet.vue";
import SlotActionSheet from "@/components/slot-action-sheet.vue";
import StickyCtaBar from "@/components/sticky-cta-bar.vue";
import TradeinSheets from "@/components/tradein-sheets.vue";
import LuckySpinSheet from "@/components/lucky-spin-sheet.vue";
import TrialExtensionSheet from "@/components/trial-extension-sheet.vue";
import TrialUnbindRetentionSheet from "@/components/trial-unbind-retention-sheet.vue";
import GenesisDockHost from "@/components/genesis-dock-host.vue";
import MessageDrawer from "@/components/message-drawer.vue";
import VoucherClaimSheet from "@/components/voucher-claim-sheet.vue";
import VoucherBanner from "@/components/voucher-banner.vue";
import { useT } from "@/i18n/use-t";
import { useNotifications } from "@/store/notifications";
import { useMessageDrawer } from "@/store/message-drawer";
import { useRefresh } from "@/store/refresh";
import { useTrialClaimSheet } from "@/store/trial-claim-sheet";
import { usePageHeader } from "@/store/page-header";
import { useFreeTrial } from "@/store/free-trial";
import { useTrialConfig } from "@/store/trial-config";
import { useVoucher } from "@/store/voucher";
import { useVoucherClaimSheet } from "@/store/voucher-claim-sheet";
import { VOUCHER_POPUP } from "@/mock/vouchers";
import { navBack as navBackTo } from "@/lib/route";
import { isStaticReviewRoute } from "@/lib/static-review-routes";
import { h5DevicePreviewStatusBarHeight } from "@/lib/device-preview";
import { saveScrollPos, getScrollPos, dropScrollPos } from "@/lib/scroll-memory";

const props = defineProps<{
  active?: "home" | "earn" | "store" | "team" | "me";
}>();

const t = useT();
const notifications = useNotifications();
const messageDrawer = useMessageDrawer();
const refresh = useRefresh();
const trialClaimSheet = useTrialClaimSheet();
const pageHeader = usePageHeader();
const freeTrial = useFreeTrial();
const trialConfig = useTrialConfig();
const voucher = useVoucher();
const voucherClaimSheet = useVoucherClaimSheet();
let autoPushTimer: ReturnType<typeof setTimeout> | null = null;
let voucherPushTimer: ReturnType<typeof setTimeout> | null = null;
let statusClockTimer: ReturnType<typeof setInterval> | null = null;

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
function chassisScrollDom(): HTMLElement | null {
  const raw = scrollEl.value as { $el?: HTMLElement } | HTMLElement | null;
  return (raw && typeof raw === "object" && "$el" in raw ? raw.$el : raw) as HTMLElement | null;
}
function currentScrollTop(): number {
  return chassisScrollDom()?.scrollTop ?? 0;
}

// ── scroll-position restore on back-navigation — uni hides stacked pages with
// display:none (zeroing this inner container's scrollTop) and only auto-restores
// PAGE-level scroll, so every navigateBack used to land the parent page at the
// top. Record continuously, restore on keep-alive re-activation; a fresh mount
// (forward navigation / reLaunch) intentionally starts clean at the top. ──
let scrollMemKey = "";
function pageScrollKey(): string {
  try {
    const ps = getCurrentPages();
    const top = ps.length ? (ps[ps.length - 1] as { $page?: { fullPath?: string }; route?: string }) : undefined;
    return top?.$page?.fullPath ?? top?.route ?? route.value;
  } catch {
    return route.value;
  }
}
function onChassisScroll() {
  const el = chassisScrollDom();
  if (el) saveScrollPos(scrollMemKey, el.scrollTop);
}
function restoreChassisScroll() {
  const saved = getScrollPos(scrollMemKey);
  if (saved === undefined || saved <= 0) return;
  void nextTick(() => {
    const el = chassisScrollDom();
    if (el) el.scrollTop = saved;
  });
}
onActivated(() => {
  scrollMemKey = pageScrollKey();
  restoreChassisScroll();
});
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
    const route = ps.length ? ((ps[ps.length - 1] as { route?: string }).route ?? "") : "";
    if (route) return route;
  } catch {
    // fall through to H5 hash fallback
  }
  // #ifdef H5
  try {
    return window.location.hash.replace(/^#\/?/, "").replace(/^\//, "");
  } catch {
    return "";
  }
  // #endif
  return "";
}
const route = ref(readRoute());
const statusTime = ref("9:41");
function updateStatusTime() {
  const now = new Date();
  statusTime.value = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
}
onMounted(() => {
  route.value = readRoute();
  // Fresh mount = fresh landing: start at top and wipe stale memory; only a
  // keep-alive re-activation (back-navigation) restores. H5-only listener —
  // App-side pages live in their own webview, which keeps scroll natively.
  scrollMemKey = pageScrollKey();
  dropScrollPos(scrollMemKey);
  const scrollDom = chassisScrollDom();
  if (scrollDom && typeof scrollDom.addEventListener === "function") {
    scrollDom.addEventListener("scroll", onChassisScroll, { passive: true });
  }
  updateStatusTime();
  statusClockTimer = setInterval(updateStatusTime, 30_000);
  const closeTransient = (trialClaimSheet as { closeTransient?: () => void }).closeTransient;
  if (typeof closeTransient === "function") closeTransient();
  else trialClaimSheet.open = false;
  voucherClaimSheet.closeTransient();

  // Home auto-push trial sheet — ported from the prototype mission-control.tsx
  // mount effect (the missing trigger: store + config were ported, the auto-push
  // was not). On Home mount, after autoPushDelayMs, fire tryAutoPush (cooldown +
  // session-cap gated in the store). Lives at the chassis with an isHome guard so
  // the protected index.vue page is never edited (ALIGNMENT red-line). Re-checks the
  // route at fire time so it never pops over a page navigated-to during the delay.
  if (isHome.value && trialConfig.config.autoPushEnabled && freeTrial.canStart()) {
    autoPushTimer = setTimeout(() => {
      // Defer to the voucher sheet (fires 1300ms < this 1500ms) — only one
      // auto-popup per Home visit; the trial fills in when no voucher opened.
      if (readRoute() === "pages/index/index" && !voucherClaimSheet.open) {
        trialClaimSheet.tryAutoPush({
          cooldownHours: trialConfig.config.autoPushCooldownHours,
          maxPerSession: trialConfig.config.autoPushMaxPerSession,
        });
      }
    }, trialConfig.config.autoPushDelayMs);
  }

  // Home auto-push voucher sheet — fires FIRST (VOUCHER_POPUP.autoPushDelayMs
  // 1300ms < trial 1500ms) so the voucher takes PRIORITY; the trial sheet defers
  // via its own !voucherClaimSheet.open guard (and fills in when no voucher is
  // claimable). The !trialClaimSheet.open check here is belt-and-suspenders
  // (trial can't be open yet at 1300ms unless manually shown). Cooldown +
  // session-cap gated in the store; re-checks route at fire time.
  if (isHome.value && voucher.claimableVouchers.some((v) => v.popupEnabled)) {
    voucherPushTimer = setTimeout(() => {
      if (readRoute() === "pages/index/index" && !trialClaimSheet.open) {
        voucherClaimSheet.tryAutoPush({
          cooldownHours: VOUCHER_POPUP.cooldownHours,
          maxPerSession: VOUCHER_POPUP.maxPerSession,
        });
      }
    }, VOUCHER_POPUP.autoPushDelayMs);
  }
});
onUnmounted(() => {
  const scrollDom = chassisScrollDom();
  if (scrollDom && typeof scrollDom.removeEventListener === "function") {
    scrollDom.removeEventListener("scroll", onChassisScroll);
  }
  if (autoPushTimer) {
    clearTimeout(autoPushTimer);
    autoPushTimer = null;
  }
  if (voucherPushTimer) {
    clearTimeout(voucherPushTimer);
    voucherPushTimer = null;
  }
  if (statusClockTimer) {
    clearInterval(statusClockTimer);
    statusClockTimer = null;
  }
});

const routeTab = computed(() => TAB_ROUTE_KEY[route.value]);
const showBusinessOverlays = computed(() => !!route.value && !isStaticReviewRoute(route.value));
// Tab route when the current route is one of the 5 mains. First-frame fallback:
// if the route isn't resolved yet but the page passed a tab `active` prop AND no
// route string, treat as tab (the 5 tab pages always pass it; sub-pages resolve
// their route synchronously so won't be mis-flagged).
const isTabRoute = computed(() => routeTab.value !== undefined || (route.value === "" && !!props.active));
const activeTab = computed(() => routeTab.value ?? props.active ?? "home");
const isHome = computed(() => activeTab.value === "home");

// Voucher fallback banner surface = current tab route (home/store/me/earn). team
// is not a configured claim surface. The VoucherBanner self-hides unless a
// claimable voucher targets the surface, so this only maps the route → surface.
const bannerSurface = computed<"home" | "store" | "me" | "earn" | null>(() => {
  // Tab pages only — sub-pages (checkout/detail/…) pass active="store" etc. but
  // must NOT carry the banner (it's scoped to the 4 first-level surfaces).
  if (!isTabRoute.value) return null;
  const tab = activeTab.value;
  return tab === "home" || tab === "store" || tab === "me" || tab === "earn" ? tab : null;
});

// Sub-page nav header (registered via useSetPageHeader). Null on tab routes → brand
// row. navHeaderH drives both the row height and the content-top inset, so only
// converted sub-pages get the inset (un-converted ones keep contentTop+0, unchanged).
const navHeader = computed(() => (isTabRoute.value ? null : pageHeader.header));
const navHeaderH = computed(() => (navHeader.value ? (navHeader.value.subtitle ? 56 : 44) : 0));
function navBack() {
  // Stack-aware back: pop real history (restores prev page + scroll), else fall
  // back to the declared backHref. navigateBack alone no-ops on cold-open (P-054).
  navBackTo(navHeader.value?.backHref);
}

const unread = computed(() => notifications.unread);
const unreadLabel = computed(() => (unread.value > 99 ? "99+" : String(unread.value)));

// ── layout insets ──
const statusBarHeight = computed(() => {
  try {
    return uni.getSystemInfoSync().statusBarHeight || h5DevicePreviewStatusBarHeight();
  } catch {
    return h5DevicePreviewStatusBarHeight();
  }
});
const showPreviewStatusBar = computed(() => h5DevicePreviewStatusBarHeight() > 0);
const HEADER_H = 52;
const TABBAR_INSET = 92; // floating pill (64) + home indicator (22) + gap
const SUB_BOTTOM = 26; // home indicator only
const contentTop = computed(() => statusBarHeight.value + (isTabRoute.value ? HEADER_H : navHeaderH.value));
const contentBottom = computed(() => (isTabRoute.value ? TABBAR_INSET : SUB_BOTTOM));
const topChromeHeight = computed(() => contentTop.value);

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
.nx-top-chrome {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 90;
  background: var(--v5-chrome-bg);
  backdrop-filter: saturate(180%) blur(24px);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  pointer-events: none;
}
.nx-statusbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 110;
}
.nx-statusbar__inner {
  position: absolute;
  top: 13px;
  left: 28px;
  right: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--v5-ink);
  pointer-events: none;
}
.nx-statusbar__time {
  min-width: 58px;
  text-align: center;
  font-family: var(--font-v5);
  font-size: 15px;
  font-weight: 650;
  line-height: 1;
}
.nx-statusbar__icons {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 76px;
  justify-content: flex-end;
}
.nx-statusbar__signal {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 13px;
}
.nx-statusbar__signal view {
  width: 3px;
  border-radius: 2px;
  background: currentColor;
}
.nx-statusbar__signal view:nth-child(1) {
  height: 5px;
}
.nx-statusbar__signal view:nth-child(2) {
  height: 7px;
}
.nx-statusbar__signal view:nth-child(3) {
  height: 10px;
}
.nx-statusbar__signal view:nth-child(4) {
  height: 13px;
}
.nx-statusbar__wifi {
  position: relative;
  width: 18px;
  height: 13px;
  overflow: hidden;
}
.nx-statusbar__wifi::before,
.nx-statusbar__wifi::after {
  content: "";
  position: absolute;
  left: 50%;
  border: 2px solid currentColor;
  border-color: currentColor transparent transparent transparent;
  border-radius: 999px;
  transform: translateX(-50%);
}
.nx-statusbar__wifi::before {
  top: 0;
  width: 18px;
  height: 18px;
}
.nx-statusbar__wifi::after {
  top: 5px;
  width: 10px;
  height: 10px;
}
.nx-statusbar__wifi view {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: currentColor;
  transform: translateX(-50%);
}
.nx-statusbar__battery {
  position: relative;
  width: 25px;
  height: 12px;
  border: 1.6px solid currentColor;
  border-radius: 4px;
}
.nx-statusbar__battery::before {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 17px;
  height: 6px;
  border-radius: 2px;
  background: currentColor;
}
.nx-statusbar__battery::after {
  content: "";
  position: absolute;
  top: 3px;
  right: -4px;
  width: 2px;
  height: 5px;
  border-radius: 0 2px 2px 0;
  background: currentColor;
  opacity: 0.75;
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
  border-bottom: 1px solid var(--v5-chrome-border);
}
/* Page nav header (sub-pages) — its OWN chrome surface so the brand row
   (.nx-header) stays byte-identical for the 5 tab pages. Mirrors the prototype
   Header nav row: 44/56 tall, back + centered title + bell, frosted. */
.nx-navheader {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-bottom: 1px solid var(--v5-chrome-border);
}
.nx-nav-side {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.nx-nav-side:active {
  opacity: 0.7;
}
.nx-nav-glass {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: var(--v5-glass-bg);
  border: 1px solid var(--v5-glass-border);
  box-shadow: var(--v5-glass-shadow);
  backdrop-filter: blur(10px) saturate(140%);
  -webkit-backdrop-filter: blur(10px) saturate(140%);
}
.nx-nav-titlewrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.nx-nav-title {
  max-width: 100%;
  font-family: var(--font-v5);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.014em;
  color: var(--v5-ink);
  line-height: 1.2;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.nx-nav-sub {
  max-width: 100%;
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.2;
  color: var(--v5-ink-3);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.nx-nav-belldot {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--v5-brand-2);
}
.nx-header__l {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 104px;
  flex-shrink: 0;
}
.nx-header__center {
  position: absolute;
  left: 50%;
  top: 0;
  height: 52px;
  max-width: calc(100% - 208px);
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  text-align: center;
  pointer-events: none;
}
.nx-logo {
  position: relative;
  width: 96px;
  height: 27px;
  display: block;
  flex-shrink: 0;
}
.nx-logo-img {
  width: 100%;
  height: 100%;
  display: block;
}
.nx-logo-img--dark {
  display: none;
}
html[data-theme="dark"] .nx-logo-img--light {
  display: none;
}
html[data-theme="dark"] .nx-logo-img--dark {
  display: block;
}
.nx-brand {
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--v5-ink);
  white-space: nowrap;
}
.nx-ver {
  font-size: 11px;
  font-weight: 500;
  color: var(--v5-ink-4);
  white-space: nowrap;
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
