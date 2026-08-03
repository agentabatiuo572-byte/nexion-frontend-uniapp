<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { useApp } from "@/store/app";
import {
  useFreeTrial,
  liveShadowUSD,
  remainingMs,
  trialReservesSlotNow,
} from "@/store/free-trial";
import { useTrialConfig } from "@/store/trial-config";
import { useBills } from "@/store/bills";
import { tickOrders } from "@/store/orders";
import { useMilestones, nextUnfired } from "@/store/milestones";
import { useQuest, type QuestTaskId } from "@/store/quest";
import { useAuth } from "@/store/auth";
import { useSession } from "@/store/session";
import { useTheme } from "@/store/theme";
import { toast } from "@/store/ui";
import { useT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { isStaticReviewRoute } from "@/lib/static-review-routes";
import { rebindAccountScopedStores } from "@/lib/account-scope";

// Simulation tick driver (ports SimulationProvider). Runs the client-side
// earnings/device simulation while the app is visible; pauses in background.
let tickTimer: ReturnType<typeof setInterval> | undefined;
let lastTick = Date.now();
let accountSessionBootstrapped = false;

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

// ── 提现到账推进轮询(FEAT-WD01b)──
// 追踪页只展示、不推进(SPEC-7),所以「用户点进追踪页发现已到账」这条路径要靠这个
// 定时器兜住 —— 5s 一次:一次调用就是一个纯函数判定 + 一次 null 判断,开销可忽略,
// 但用户不会盯着「处理中」干等半分钟。真正的离线缺口补齐发生在 onShow 那一下。
// PROD: 整块删掉,状态改由 SSE/webhook 推。
const ARRIVAL_TICK_MS = 5_000;
let arrivalTimer: ReturnType<typeof setInterval> | undefined;

/**
 * 到账推进 + 账单结算。两件事必须一起做:
 * 单据推到「已到账」而账单行还停在「处理中」的话,追踪页说到账了、账单页说处理中,
 * 同一笔钱两个说法;而且账单页的流水余额只累加已入账的行,这笔提现永远不进流水。
 * store 之间不互相 import(P-031),所以这个跨 store 编排放在 App 层。
 */
function advanceArrivalAndSettleBill() {
  const app = useApp();
  // 🔴 按**本次真正推进的那几笔**逐个结算,不能问「最新一笔是谁」——
  // 推进是全表扫,最新那笔未必是刚到账的那笔(独立验收实测:双向都会结算错单)。
  const advanced = app.advanceWithdrawalArrival();
  if (advanced.length) {
    const bills = useBills();
    for (const ref of advanced) bills.settleByRef(ref, "posted");
  }
  // 结算失败的那几笔不靠「记在内存里下次重试」找回来 —— 见 reconcileBills 的注释。
  reconcileBills();
}

/**
 * 🔴 对账:把「已到账的单据」和「还停在处理中的账单行」拉齐。
 *
 * 这里原本是一个模块级的 `pendingBillSettle` Set:结算失败就记下来、下一轮重试。
 * 问题是它**只在内存里**——用户刷新一次页面 / 关掉 App 重开,这个 Set 就没了,
 * 而到账推进本身是幂等的(推过的单不会再出现在返回数组里),于是那笔单**永远不会再被结算**:
 * 追踪页说「已到账」、账单页说「处理中」,正是注释自称要防的永久裂脑,防御却只覆盖同一个页面生命周期。
 *
 * 根治不是把那个 Set 持久化,而是**别记**:该做什么完全可以从现有数据推出来 ——
 * 单据是终态、账单行还没跟上,就是待办。这样刷新、换设备、隔一周回来都能自愈,零额外存储。
 */
function reconcileBills() {
  const app = useApp();
  const bills = useBills();
  // ① 已到账 → 账单入账
  for (const wd of app.withdrawals) {
    if (wd.status !== "confirmed") continue;
    const row = bills.bills.find((b) => b.ref === wd.id && b.symbol === "USDT");
    if (row && row.status !== "posted") bills.settleByRef(wd.id, "posted");
  }
  // ② 失败终态 → **先退款再置账单失败**,两件事必须成对。
  //    提现在提交那一刻就扣了款,「单子废了但钱没还」是最伤的一种不一致。
  for (const id of app.refundFailedWithdrawals()) bills.settleByRef(id, "failed");
  //    退款幂等,但账单可能上一轮没落盘成功 → 这里补一次(与①同样的自愈思路)
  for (const wd of app.withdrawals) {
    if (!["review-rejected", "address-invalid", "tx-failed", "refunded"].includes(wd.status)) continue;
    const row = bills.bills.find((b) => b.ref === wd.id && b.symbol === "USDT");
    if (row && row.status !== "failed") bills.settleByRef(wd.id, "failed");
  }
  // ②b NEX 抵扣费退还 → 补一条**正向反向分录**(2026-08-04 R2 P1-A)。
  //    退款只动了余额:钱包里 NEX 回来了,账单里那条「−N NEX(已入账)」却还孤零零挂着 ——
  //    按账单对账的用户会少算自己的 NEX。改写那条行不是解法(烧确实发生过,改写 = 账本说没烧),
  //    复式账本的规矩是**冲正靠反向分录**:同单号补一条 +N NEX,两行相抵 = 钱包净变化。
  //    🔴 判据取自账本自己(退款幂等键已落盘),不是「单据是失败终态」—— 钱还没真退就记账,
  //    等于账单抢在余额前面宣布退款,方向反了同样是裂脑。存在性判据 = 同单号的正向 NEX 行,
  //    没有才补,故刷新 / 换设备 / 上一轮写盘失败都能自愈(与 ① 同一套思路)。
  for (const wd of app.withdrawals) {
    const burned = wd.fee?.nexBurned;
    if (!(typeof burned === "number" && burned > 0)) continue;
    if (!app.user.appliedRewardKeys?.["refund-nex:" + wd.id]) continue;
    if (bills.bills.some((b) => b.ref === wd.id && b.symbol === "NEX" && b.amount > 0)) continue;
    bills.add({
      type: "withdraw",
      symbol: "NEX",
      amount: burned,
      status: "posted",
      // memoKey = 渲染时才翻译(切语言不留旧语);memo 只作兜底,与 bills.ts 的约定一致。
      memo: `Fee offset refunded · ${Number.isInteger(burned) ? burned : burned.toFixed(1)} NEX returned`,
      memoKey: "withdrawNexRefund",
      memoParams: { nex: Number.isInteger(burned) ? String(burned) : burned.toFixed(1) },
      ref: wd.id,
    });
  }
  // ③ 赠金:锁定 / 待审桶都空了 = 没有还锁着的赠金,那笔「处理中」的赠金账单该入账了。
  //    释放走 applyReleaseOutcome,它只动桶和余额、**不写账单**,
  //    于是账单里那行 +$5 会永远停在「处理中」。这里从数据推出它已经落地。
  const b = app.user.earningBuckets;
  if (b.pendingReviewUsdt <= 0 && b.bonusLockedUsdt <= 0) {
    for (const row of bills.bills) {
      if (row.type === "bonus" && row.status === "pending" && row.ref) bills.settleByRef(row.ref, "posted");
    }
  }
}

function startArrivalPoll() {
  stopArrivalPoll();
  arrivalTimer = setInterval(() => {
    if (!ensureBusinessLoopsAllowed()) return;
    advanceArrivalAndSettleBill();
  }, ARRIVAL_TICK_MS);
}
function stopArrivalPoll() {
  if (arrivalTimer) {
    clearInterval(arrivalTimer);
    arrivalTimer = undefined;
  }
}

// ── Trial state-machine poll (FEAT-TRIAL02 cardless machine) ──
// The 4s poll only advances the lifecycle (active→grace→ended) and surfaces
// toasts/urgency pushes. Spec ④ 禁止动作: NO auto-charge, NO auto-order — the
// grace→ended flip touches state only; conversion money + the order live in
// the checkout page (user-confirmed). Mirrors TRIAL_TICK_MS = 4000.
const TRIAL_TICK_MS = 4000;
const URGENCY_24H_MS = 24 * 3_600_000;
const URGENCY_1H_MS = 60 * 60_000;
// Session-scoped fire flags so urgency toasts don't spam every poll.
const urgencyFired = { active24h: false, grace24h: false, grace1h: false };
let trialTimer: ReturnType<typeof setInterval> | undefined;

function pollTrial() {
  if (!ensureBusinessLoopsAllowed()) return;
  const freeTrial = useFreeTrial();
  const before = freeTrial.status;
  const nowMs = Date.now();
  freeTrial.poll(nowMs);
  const after = freeTrial.status;
  const t = useT().value;

  if (before !== after) {
    if (after === "grace") {
      // Production stopped; the credit stays usable until graceEndsAt — always
      // hand the user the exact time + next step (spec ④).
      const until = freeTrial.graceEndsAt !== null ? new Date(freeTrial.graceEndsAt).toLocaleString() : "";
      toast.info(fmt(t.trial.graceStartToast, { time: until }));
      urgencyFired.grace24h = false;
      urgencyFired.grace1h = false;
    } else if (after === "ended") {
      toast.info(t.trial.endedToast);
    } else if (after === "active") {
      urgencyFired.active24h = false;
      urgencyFired.grace24h = false;
      urgencyFired.grace1h = false;
    }
  }

  // ── Urgency pushes — active: 24h left; grace: credit expiring in 24h / 1h ──
  const st = freeTrial;
  if (st.status === "active" && st.expiresAt !== null) {
    const left = remainingMs(nowMs);
    if (!urgencyFired.active24h && left > 0 && left <= URGENCY_24H_MS) {
      urgencyFired.active24h = true;
      toast.warn(fmt(t.trial.urgency24h, { amount: useTrialConfig().config.discountCapUSD }));
    }
  } else if (st.status === "grace" && st.graceEndsAt !== null) {
    const left = remainingMs(nowMs);
    const credit = liveShadowUSD(nowMs).toFixed(2);
    if (!urgencyFired.grace1h && left > 0 && left <= URGENCY_1H_MS) {
      urgencyFired.grace1h = true;
      urgencyFired.grace24h = true; // don't double-push inside the last hour
      toast.warn(fmt(t.trial.urgencyGrace1h, { amount: credit }));
    } else if (!urgencyFired.grace24h && left > 0 && left <= URGENCY_24H_MS) {
      urgencyFired.grace24h = true;
      toast.warn(fmt(t.trial.urgencyGrace24h, { amount: credit }));
    }
  } else {
    urgencyFired.active24h = false;
    urgencyFired.grace24h = false;
    urgencyFired.grace1h = false;
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
// Single global driver that advances every in-flight order one stage on the
// 6s cadence from the prototype (simulation-provider.tsx:36-64):
//   order auto-advance: placed → paid → provisioning → activated (tickOrders).
// Orchestration lives at the App layer so stores never import each other
// (P-031/032). Mirrors ORDER_TICK_MS = 6000.
// Production: order status arrives via SSE (GET /api/orders/:id).
const ORDER_TICK_MS = 6000;
let orderTimer: ReturnType<typeof setInterval> | undefined;

function pollOrders() {
  if (!ensureBusinessLoopsAllowed()) return;
  // Advance every in-flight order one stage (gated internally per-order).
  tickOrders(trialReservesSlotNow() ? 1 : 0);
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
// the bonus bill → queue the celebration (store.show() enqueues; the overlay
// host promotes via advance(), which suspends UI on money-flow routes —
// checkout / withdraw / trial — and replays each queued tier afterwards).
// 🔴 奖励/记账必须留在这里无条件执行,不许接路由门 / stopMilestonePoll:那会变成
// 「钱链路期间不发奖励」而非「不弹窗」。UI 挂起只住在 store.advance()。
// nextUnfired returns the lowest unfired step (one at a time, original
// "fire one per tick" semantics) so the next poll surfaces the next tier.
// Production: GET /api/config/milestones + atomic POST /api/me/milestones/:id/claim
// (PRD §9.11e). Cross-store composition stays here (stores import-free).
const MILESTONE_TICK_MS = 4000;
let milestoneTimer: ReturnType<typeof setInterval> | undefined;

function pollMilestones() {
  if (!ensureBusinessLoopsAllowed()) return;
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
  "pages/session/", // kicked screen — never auth/session-redirect away from it
];
function isAuthWhitelisted(route: string): boolean {
  return isStaticReviewRoute(route) || AUTH_WHITELIST_PREFIXES.some((p) => route.startsWith(p));
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

// ── Account session guard + new-device recalibration redirect ──
// Mirrors GET /api/auth/session: each 1s tick (and instantly via the cross-tab
// storage event) checks THIS session record. SPEC-4 allows the same account to
// stay active across signed App / H5 / white-app carriers; only self sign-out,
// deleted session, or ops revoke (killedAt) evicts this carrier. If a new device
// needs recalibration (different deviceId from the account's calibrated device)
// → reLaunch to the calibration ritual in recalibrate mode.
// Returns true if it redirected (caller bails). Production: identical logic
// against the server session endpoint; the storage event becomes an SSE/push.
function checkSession(): boolean {
  const route = readCurrentRoute();
  if (!route || isAuthWhitelisted(route)) return false; // flow pages exempt
  const auth = useAuth();
  if (!auth.isAuthenticated) return false; // auth guard handles unauth
  const session = useSession();
  const st = session.validate();
  if (st === "kicked" || st === "logged-out") {
    const reason = st === "kicked" ? "kicked" : "logged-out";
    stopBusinessLoops();
    useApp().interruptAllTasks(reason);
    session.kick(reason);
    // 踢出兜底:清全部账号级数据内存残留(P2-8 纵深防御)。app + 28 store 归 default。
    useApp().bindAccount("default");
    rebindAccountScopedStores("default");
    uni.reLaunch({ url: "/pages/session/kicked" });
    return true;
  }
  // Active session → ensure mining is running (resumes after a fresh re-login
  // that follows an eviction).
  const app = useApp();
  if (app.miningPaused) app.resumeMining();
  if (session.requiresRecalibration && auth.onboardingComplete) {
    uni.reLaunch({ url: "/pages/onboarding/connect?mode=recalibrate" });
    return true;
  }
  return false;
}

// Cross-tab instant session refresh: registry writes from another tab/device
// trigger a storage event so revokes/logouts are picked up immediately. H5 only
// (uni storage = localStorage).
let storageHandler: ((e: StorageEvent) => void) | undefined;
function attachSessionWatch() {
  // #ifdef H5
  if (storageHandler) return;
  storageHandler = (e: StorageEvent) => {
    if (e.key && (e.key.indexOf("nexgrid-account-sessions") >= 0 || e.key.indexOf("nexgrid-active-session") >= 0)) {
      checkSession();
    }
  };
  window.addEventListener("storage", storageHandler);
  // #endif
}
function detachSessionWatch() {
  // #ifdef H5
  if (storageHandler) {
    window.removeEventListener("storage", storageHandler);
    storageHandler = undefined;
  }
  // #endif
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

function readCurrentRouteOrHash(): string {
  const route = readCurrentRoute();
  if (route) return route;
  // #ifdef H5
  try {
    return window.location.hash || "";
  } catch {
    return "";
  }
  // #endif
  return "";
}

function bootstrapAccountSession() {
  if (accountSessionBootstrapped) return;
  accountSessionBootstrapped = true;
  // Bind the account-cloud snapshot and claim this carrier's session for an
  // already-authenticated account. Multi-carrier sessions coexist; forced
  // revokes are resolved by checkSession() once routes are ready.
  const auth = useAuth();
  if (auth.isAuthenticated) {
    const key = auth.email || auth.accountId || "default";
    const app = useApp();
    const session = useSession();
    app.bindAccount(key);
    rebindAccountScopedStores(key);
    const restored = session.resumeOrClaim(key);
    if (restored.status === "kicked" || restored.status === "logged-out") {
      const reason = restored.status === "kicked" ? "kicked" : "logged-out";
      stopBusinessLoops();
      app.interruptAllTasks(reason);
      session.kick(reason);
      // 踢出兜底:清全部账号级数据内存残留(P2-8 纵深防御)。app + 28 store 归 default。
      app.bindAccount("default");
      rebindAccountScopedStores("default");
      uni.reLaunch({ url: "/pages/session/kicked" });
    }
  }
}

function scheduleAccountSessionBootstrap(attempt = 0) {
  const route = readCurrentRouteOrHash();
  if (isStaticReviewRoute(route)) {
    stopBusinessLoops();
    return;
  }
  if (!route) {
    if (attempt < 10) setTimeout(() => scheduleAccountSessionBootstrap(attempt + 1), 50);
    return;
  }
  bootstrapAccountSession();
}

function questIdForRoute(route: string): QuestTaskId | null {
  if (route === "pages/earn/earn") return "visit_earn";
  if (route === "pages/store/store") return "visit_store";
  // Product detail page (store/detail). Excludes orders/checkout pages.
  if (route.startsWith("pages/store/detail")) return "view_product_roi";
  return null;
}

function checkQuestRoute() {
  const route = readCurrentRoute();
  if (isStaticReviewRoute(route)) {
    lastQuestRoute = route;
    stopBusinessLoops();
    return;
  }
  if (checkAuthGuard()) return; // unauth → redirected; don't credit quests
  if (checkSession()) return; // evicted / needs recalibration → redirected
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

function stopBusinessLoops() {
  stopTick();
  stopArrivalPoll();
  stopTrialPoll();
  stopOrderPoll();
  stopMilestonePoll();
  stopQuestWatch();
}

function canRunBusinessLoops(): boolean {
  const route = readCurrentRouteOrHash();
  if (!route || isAuthWhitelisted(route)) return false;
  const auth = useAuth();
  if (!auth.isAuthenticated || !auth.onboardingComplete) return false;
  return useSession().validate() === "active";
}

function ensureBusinessLoopsAllowed(): boolean {
  if (checkAuthGuard()) {
    stopBusinessLoops();
    return false;
  }
  if (checkSession()) {
    stopBusinessLoops();
    return false;
  }
  if (!canRunBusinessLoops()) {
    stopBusinessLoops();
    return false;
  }
  return true;
}

onLaunch(() => {
  // NexGrid defaults dark, but the persisted user choice drives H5 after launch.
  // `resolved` collapses the light/dark/system choice to the concrete theme
  // (system → OS scheme). Instantiating the store here also registers its live
  // OS-scheme listener for "system" mode.
  // #ifdef H5
  document.documentElement.setAttribute("data-theme", useTheme().resolved);
  // #endif
  if (isStaticReviewRoute(readCurrentRouteOrHash())) {
    stopBusinessLoops();
    return;
  }
  scheduleAccountSessionBootstrap();
});
onShow(() => {
  attachSessionWatch();
  if (!ensureBusinessLoopsAllowed()) return; // no business writes on auth/session flow pages
  useApp().settle(); // PRD §6.11: settle the backgrounded gap in one shot on foreground
  // FEAT-WD01b:前台第一时间补齐到账缺口 —— 关 App 三天再打开,这一下就补完
  // (纯函数只看「now ≥ 预计到账」,与离线时长无关;推进过的单再调是 no-op)。
  advanceArrivalAndSettleBill();
  startTick();
  startArrivalPoll();
  startTrialPoll();
  startOrderPoll();
  startMilestonePoll();
  startQuestWatch();
});
onHide(() => {
  detachSessionWatch();
  stopBusinessLoops();
});
</script>

<style>
/* Global app surface — token-driven, dark by default. */
page {
  background-color: var(--v5-bg);
}
</style>
