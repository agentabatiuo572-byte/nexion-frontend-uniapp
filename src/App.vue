<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { useApp } from "@/store/app";
import {
  useFreeTrial,
  liveShadowUSD,
  liveShadowNEX,
  remainingMs,
  isHighQualityEligible,
  computeTrialOffset,
} from "@/store/free-trial";
import { useTrialConfig } from "@/store/trial-config";
import { useTrialExtensionSheet } from "@/store/trial-extension-sheet";
import { useBills } from "@/store/bills";
import { MAX_DEVICES } from "@/store/device-types";
import { tickOrders } from "@/store/orders";
import { useGenesis, GENESIS_ROYALTY_RATE } from "@/store/genesis";
import { useMilestones, nextUnfired } from "@/store/milestones";
import { useQuest, type QuestTaskId } from "@/store/quest";
import { useAuth } from "@/store/auth";
import { toast } from "@/store/ui";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";

// Simulation tick driver (ports SimulationProvider). Runs the client-side
// earnings/device simulation while the app is visible; pauses in background.
let tickTimer: ReturnType<typeof setInterval> | undefined;
let lastTick = Date.now();

function startTick() {
  stopTick();
  lastTick = Date.now();
  tickTimer = setInterval(() => {
    const now = Date.now();
    useApp().tick(now - lastTick);
    lastTick = now;
  }, 1000);
}
function stopTick() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = undefined;
  }
}

// ── Trial state-machine poll (ports SimulationProvider's TRIAL_TICK loop) ──
// uni's trial.vue only ticks `now` for display; nothing advanced the free-trial
// machine (active→grace→redeemed/failed/cancelled), so this is the sole driver.
// Runs at the App (component) layer so the terminal auto-redeem side effects can
// compose multiple stores (debit + device spawn + bills) — stores never import
// each other (P-031/032). Mirrors the prototype's TRIAL_TICK_MS = 4000.
const TRIAL_TICK_MS = 4000;
const URGENCY_24H_MS = 24 * 3_600_000;
const URGENCY_1H_MS = 60 * 60_000;
// Session-scoped fire flags so urgency toasts don't spam every poll.
const urgencyFired = { active24h: false, grace1h: false };
let trialTimer: ReturnType<typeof setInterval> | undefined;

function pollTrial() {
  const freeTrial = useFreeTrial();
  const before = freeTrial.status;
  const nowMs = Date.now();
  // Snapshot accrued shadow BEFORE poll potentially advances status to
  // `redeemed` (which keeps the frozen value); on conversion these accrued
  // earnings merge into the spendable balance.
  const shadowUSDBeforeRedeem = liveShadowUSD(nowMs);
  const shadowNEXBeforeRedeem = liveShadowNEX(nowMs);
  freeTrial.poll(nowMs);
  const after = freeTrial.status;
  const t = useT().value;

  if (before !== after) {
    if (after === "redeemed") {
      handleAutoRedeem(shadowUSDBeforeRedeem, shadowNEXBeforeRedeem);
    } else if (after === "failed") {
      toast.error(t.trial.toastAutoDebitFailed);
    } else if (after === "cancelled") {
      toast.info(t.trial.toastCancelled);
    } else if (after === "grace") {
      toast.info(t.trial.toastGraceStarted);
      urgencyFired.grace1h = false;
    } else if (after === "active") {
      urgencyFired.active24h = false;
      urgencyFired.grace1h = false;
    }
  }

  // ── MVP-D: high-quality extension sheet trigger ──
  // free-trial.poll() returns early (does NOT charge) when the grace boundary is
  // reached while the user is high-quality (shadow ≥ threshold) and the offer
  // hasn't been resolved. Surface the extension sheet once in that window.
  const st = useFreeTrial();
  if (
    st.status === "grace" &&
    !st.extensionGranted &&
    isHighQualityEligible() &&
    st.graceEndsAt !== null &&
    nowMs >= st.graceEndsAt
  ) {
    const sheet = useTrialExtensionSheet();
    if (!sheet.open) sheet.show();
  }

  // ── Urgency pushes — 24h left in active / 1h left in grace ──
  if (st.status === "active" && st.activeEndsAt !== null) {
    const left = remainingMs(nowMs);
    if (!urgencyFired.active24h && left > 0 && left <= URGENCY_24H_MS) {
      urgencyFired.active24h = true;
      toast.warn(fmt(t.trial.urgency24h, { amount: useTrialConfig().config.discountCapUSD }));
    }
  } else if (st.status === "grace" && st.graceEndsAt !== null) {
    const left = remainingMs(nowMs);
    if (!urgencyFired.grace1h && left > 0 && left <= URGENCY_1H_MS) {
      urgencyFired.grace1h = true;
      toast.warn(t.trial.urgency1h);
    }
  } else {
    urgencyFired.active24h = false;
    urgencyFired.grace1h = false;
  }
}

// Terminal auto-redeem side effects (cross-store, composed at App layer).
// Mirrors SimulationProvider's `after === "redeemed"` branch: auto-charge full
// price minus the capped trial-earnings offset, write the purchase bill, credit
// the earnings remainder + NEX, then spawn + activate the device. Maps to the
// server cron POST /api/trial/charge (atomic) in production.
function handleAutoRedeem(shadowUSDBeforeRedeem: number, shadowNEXBeforeRedeem: number) {
  const app = useApp();
  const bills = useBills();
  const freeTrial = useFreeTrial();
  const cfg = useTrialConfig().config;
  const t = useT().value;

  const { offsetUSD, remainderUSD } = computeTrialOffset(cfg, shadowUSDBeforeRedeem);
  const chargeAmount = +Math.max(0, cfg.trialPriceUSD - offsetUSD).toFixed(2);
  const debitOk = app.debitBalance(chargeAmount);
  if (!debitOk) {
    // Insufficient bound-card balance — flip to failed (keeps finishedAt so the
    // cooldown clock starts; never reset() which would bypass cooldown).
    freeTrial.markChargeFailed("insufficient_funds");
    toast.error(t.trial.toastAutoDebitFailed);
    return;
  }
  const purchaseRef = `TRIAL-${Date.now().toString(36).toUpperCase()}`;
  bills.add({
    type: "purchase",
    symbol: "USDT",
    amount: -chargeAmount,
    status: "posted",
    memo: `Trial converted · NexionBox S1 (auto-charge, earnings -$${offsetUSD})`,
    ref: purchaseRef,
  });
  if (remainderUSD > 0) {
    app.creditBalance(remainderUSD);
    bills.add({
      type: "bonus",
      symbol: "USDT",
      amount: remainderUSD,
      status: "posted",
      memo: "Trial earnings remainder → balance · NexionBox S1",
      ref: `${purchaseRef}-EARN-USDT`,
    });
  }
  if (shadowNEXBeforeRedeem > 0) {
    app.creditNex(shadowNEXBeforeRedeem);
    bills.add({
      type: "bonus",
      symbol: "NEX",
      amount: shadowNEXBeforeRedeem,
      status: "posted",
      memo: "Trial earnings → balance · NEX",
      ref: `${purchaseRef}-EARN-NEX`,
    });
  }
  const beforeDevices = app.devices.length;
  const activeCount = app.devices.filter((d) => d.activatedAt !== null).length;
  app.addDevice(cfg.trialProductId);
  const deviceAdded = app.devices.length > beforeDevices;
  const newId = deviceAdded ? app.devices[app.devices.length - 1]?.id : null;
  if (newId && activeCount < MAX_DEVICES) {
    app.activateDevice(newId);
  }
  const note =
    shadowUSDBeforeRedeem <= 0
      ? ""
      : remainderUSD > 0
        ? fmt(t.trial.toastConvertedNoteRemainder, { remainder: remainderUSD.toFixed(2) })
        : t.trial.toastConvertedNoteOffset;
  if (deviceAdded) {
    toast.success(fmt(t.trial.toastConverted, { note }));
  } else {
    toast.warn(t.trial.toastConvertedNoDevice, t.trial.toastConvertedNoDeviceSub);
  }
}

function startTrialPoll() {
  stopTrialPoll();
  trialTimer = setInterval(pollTrial, TRIAL_TICK_MS);
}
function stopTrialPoll() {
  if (trialTimer) {
    clearInterval(trialTimer);
    trialTimer = undefined;
  }
}

// ── ORDER_TICK 6s loop (ports SimulationProvider's ORDER_TICK loop) ──
// Single global driver for two unrelated simulations that share the 6s cadence
// in the prototype (simulation-provider.tsx:36-64):
//   (a) order auto-advance: placed → paid → provisioning → activated (tickOrders).
//   (b) Genesis secondary-market: a user's active listing randomly sells.
// Both compose across stores, so the orchestration lives here at the App layer —
// stores never import each other (P-031/032). Mirrors ORDER_TICK_MS = 6000.
// Production: order status arrives via SSE (GET /api/orders/:id); the Genesis
// resale fires server-side when a buyer fills the listing (no client gamble).
const ORDER_TICK_MS = 6000;
const GENESIS_SALE_CHANCE = 0.18;
let orderTimer: ReturnType<typeof setInterval> | undefined;

function pollOrders() {
  // (a) Advance every in-flight order one stage (gated internally per-order).
  tickOrders();

  // (b) Genesis resale — if the user has a live listing, it occasionally fills.
  const genesis = useGenesis();
  const listings = genesis.myListings;
  if (listings.length > 0 && Math.random() < GENESIS_SALE_CHANCE) {
    const sold = genesis.fulfillSale(listings[0].tokenId);
    if (sold) {
      const app = useApp();
      const bills = useBills();
      const t = useT().value;
      // Seller nets ask minus the network royalty (Q13).
      const net = +(sold.askPriceUSDT * (1 - GENESIS_ROYALTY_RATE)).toFixed(2);
      app.creditBalance(net);
      bills.add({
        type: "bonus",
        symbol: "USDT",
        amount: net,
        status: "posted",
        // Internal ledger record (not a UI-rendered i18n namespace) — kept literal.
        memo: `Genesis Node #${sold.tokenId} sold · −${(GENESIS_ROYALTY_RATE * 100).toFixed(1)}% royalty`,
        ref: `GENESIS-SOLD-${sold.tokenId}-${Date.now().toString(36).toUpperCase()}`,
      });
      toast.success(
        fmt(t.genesis.soldToastTitle, { id: sold.tokenId }),
        fmt(t.genesis.soldToastBody, { amount: net.toLocaleString() }),
      );
    }
  }
}

function startOrderPoll() {
  stopOrderPoll();
  orderTimer = setInterval(pollOrders, ORDER_TICK_MS);
}
function stopOrderPoll() {
  if (orderTimer) {
    clearInterval(orderTimer);
    orderTimer = undefined;
  }
}

// ── Earnings-milestone 4s poll (ports milestone-watcher.tsx) ──
// Reads life-to-date earnings each tick; when it crosses the next unfired
// threshold, fires exactly once: mark (idempotent guard) → credit NEX → write
// the bonus bill → open the celebration overlay. The overlay (mounted in
// global-ui.vue) owns its own confetti + 5.2s auto-dismiss; App.vue only calls
// show(). nextUnfired returns the lowest unfired step (one at a time, original
// "fire one per tick" semantics) so the next poll surfaces the next tier.
// Production: GET /api/config/milestones + atomic POST /api/me/milestones/:id/claim
// (PRD §9.11e). Cross-store composition stays here (stores import-free).
const MILESTONE_TICK_MS = 4000;
let milestoneTimer: ReturnType<typeof setInterval> | undefined;

function pollMilestones() {
  const app = useApp();
  const m = useMilestones();
  // Life-to-date = banked total + the still-accruing today bucket (matches the
  // prototype's lifetime figure used by milestone-watcher).
  const lifeToDate = (app.earnings.total ?? 0) + (app.earnings.today ?? 0);
  const step = nextUnfired(lifeToDate, m.firedIds);
  if (!step) return;
  // Mark first so a slow credit/bill never re-enters the same step next tick.
  m.markFired(step.id);
  app.creditNex(step.nexReward);
  useBills().add({
    type: "achievement",
    symbol: "NEX",
    amount: step.nexReward,
    status: "posted",
    memo: `Earnings milestone · $${step.thresholdUSD}`,
    ref: `MILESTONE-${step.id}`,
  });
  // Drive the global celebration overlay (label lets it resolve i18n copy).
  m.show({
    id: step.id,
    threshold: step.thresholdUSD,
    nexReward: step.nexReward,
    label: step.label,
  });
}

function startMilestonePoll() {
  stopMilestonePoll();
  milestoneTimer = setInterval(pollMilestones, MILESTONE_TICK_MS);
}
function stopMilestonePoll() {
  if (milestoneTimer) {
    clearInterval(milestoneTimer);
    milestoneTimer = undefined;
  }
}

// ── Auth/onboarding route guard (ports auth-guard.tsx) ──
// Demo-friendly: auth defaults to authenticated+onboarded (store/auth.ts), so
// this guard is dormant in normal use and the app opens to home (5-page baseline
// unaffected). It only bites after an explicit signOut() — then any protected
// route reLaunches to the onboarding flow. No-shell pages (onboarding/login/
// register/ref/tx) are whitelisted so the flow itself never self-redirects
// (no loop). Runs every route tick + on app show. Never edits the 5 tab pages.
// Production: replace the local auth store with the real session (the guard
// logic is identical against GET /api/auth/session).
const AUTH_WHITELIST_PREFIXES = [
  "pages/onboarding/",
  "pages/login/",
  "pages/register/",
  "pages/ref/",
  "pages/tx/",
];
function isAuthWhitelisted(route: string): boolean {
  return AUTH_WHITELIST_PREFIXES.some((p) => route.startsWith(p));
}
// Returns true if it redirected (callers bail so they don't act on a route the
// user is being kicked off of).
function checkAuthGuard(): boolean {
  const route = readCurrentRoute();
  if (!route || isAuthWhitelisted(route)) return false; // no route yet / flow page
  const auth = useAuth();
  if (!auth.isAuthenticated) {
    uni.reLaunch({ url: "/pages/onboarding/intro" });
    return true;
  }
  if (!auth.onboardingComplete) {
    uni.reLaunch({ url: "/pages/onboarding/estimator" });
    return true;
  }
  return false;
}

// ── Quest route watcher (ports quest-route-watcher.tsx) ──
// Auto-completes route-based first-day quest tasks when the user lands on the
// matching page. The prototype watches logical routes (/earn, /store,
// /store/:id); uni's physical routes are /pages/… (no leading slash from
// getCurrentPages().route), so map physical → task id here. On a FIRST
// completion: credit the reward(s) + toast. Idempotent in the store (re-visits
// return firstTime:false), so polling the route is safe. day-one-quest-card.vue
// (protected home page) is NOT touched — only the data/reward side.
// Production: POST /api/quest/complete returns { firstTime, rewardNex, rewardUsdt }.
const QUEST_TICK_MS = 1000;
let questTimer: ReturnType<typeof setInterval> | undefined;
let lastQuestRoute = "";

// getCurrentPages().route has NO leading slash (e.g. "pages/store/store").
function readCurrentRoute(): string {
  try {
    const ps = getCurrentPages();
    return ps.length ? ((ps[ps.length - 1] as { route?: string }).route ?? "") : "";
  } catch {
    return "";
  }
}

function questIdForRoute(route: string): QuestTaskId | null {
  if (route === "pages/earn/earn") return "visit_earn";
  if (route === "pages/store/store") return "visit_store";
  // Product detail page (store/detail). Excludes orders/checkout pages.
  if (route.startsWith("pages/store/detail")) return "view_product_roi";
  return null;
}

function checkQuestRoute() {
  if (checkAuthGuard()) return; // unauth → redirected; don't credit quests
  const route = readCurrentRoute();
  if (route === lastQuestRoute) return; // only act on route change
  lastQuestRoute = route;
  const id = questIdForRoute(route);
  if (!id) return;
  const r = useQuest().markComplete(id);
  if (!r.firstTime) return;
  const app = useApp();
  if (r.rewardNex > 0) app.creditNex(r.rewardNex);
  if (r.rewardUsdt > 0) app.creditBalance(r.rewardUsdt);
  const t = useT().value;
  toast.success(fmt(t.quest.routeToast, { n: r.rewardNex }));
}

function startQuestWatch() {
  stopQuestWatch();
  lastQuestRoute = readCurrentRoute(); // seed without firing for the landing page
  questTimer = setInterval(checkQuestRoute, QUEST_TICK_MS);
}
function stopQuestWatch() {
  if (questTimer) {
    clearInterval(questTimer);
    questTimer = undefined;
  }
}

onLaunch(() => {
  // Nexion is a dark-default design system (matches prototype theme-provider:
  // SSR renders <html data-theme="dark">). Apply on H5; App theming at packaging.
  // #ifdef H5
  document.documentElement.setAttribute("data-theme", "dark");
  // #endif
});
onShow(() => {
  checkAuthGuard(); // immediate gate on app foreground (before the 1s tick)
  startTick();
  startTrialPoll();
  startOrderPoll();
  startMilestonePoll();
  startQuestWatch();
});
onHide(() => {
  stopTick();
  stopTrialPoll();
  stopOrderPoll();
  stopMilestonePoll();
  stopQuestWatch();
});
</script>

<style>
/* Global app surface — token-driven, dark by default. */
page {
  background-color: var(--v5-bg);
}
</style>
