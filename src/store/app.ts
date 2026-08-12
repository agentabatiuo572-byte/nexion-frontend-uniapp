import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import type { Device, CompletedTask, UserState, EarningsState, GlobalStats, Withdrawal, WithdrawalFeeSnapshot, EarningBucketRoute } from "./types";
import type { DeviceKind } from "./types";
import { ONE_DAY_MS, makeInitialDevices, createDevice, backfillDeviceEconomics, MAX_DEVICES, type CreateDeviceOptions } from "./device-types";
import { pickRandomTask } from "@/mock/tasks";
import { isDegradable, getEfficiency, getMonthsOwned } from "./device-lifecycle";
import { interruptInfo } from "./interrupt";
import { continuityFactor, thermalFactor, isDeviceOnline } from "@/lib/hashpower";
import { accountTotalHashrate } from "@/lib/account-hashrate";
import { getCarrier, type Carrier } from "@/lib/carrier";
import { redeemGenesisInviteCode, type GenesisInviteRedeemResult } from "./genesis-invite";
import { getEntrySurface, type EntrySurface } from "@/lib/entry-surface";
import { matchGpuTier } from "@/lib/gpu-tiers";
import { publicStatsHealth } from "@/lib/platform-stats";
import { useConfig } from "@/store/config";
import { accumulateUsdAccrual, completedUsdCentDelta } from "@/lib/earnings-accrual";
import { evaluateAccountCluster } from "@/store/risk-cluster";
import {
  appendLedgerEntry,
  evaluateAttestRelease,
  hasReleaseEffect,
  _devGrantManualRelease as _devGrantManualReleaseLedger,
  type ReleaseOutcome,
} from "@/store/earning-release";
import { recordAttestation } from "@/store/risk-identity";
import { commitWithdrawal } from "@/store/withdrawal-eligibility";
import { advanceArrival, occupiesWithdrawalSlot } from "@/store/withdrawal-arrival-core";
import { mockServerNow } from "@/store/server-time";
import type { OnlineBonus, WithdrawalRiskRoute } from "@/store/config-types";
import type { DeviceCapability } from "@/lib/device-capability";
import { useReceipts } from "./receipts";
import { generateReceipt } from "@/mock/receipt";
import {
  normalizeAccountKey,
  mergeAndWriteAccountSnapshotResult,
  readAccountSnapshot,
  type AccountCloudSnapshot,
} from "./account-cloud";
import { remoteApiEnabled, withdrawalApi } from "@/api/runtime";
import { toCanonicalWithdrawal } from "@/api/withdrawal-api";

// Ported from Nexion-prototype/lib/store/index.ts (useApp), zustand → Pinia.
// MOCK-ONLY: entire earnings simulation runs client-side. Production replaces
// tick() with the candidate aggregate read + stream contract documented in PRD
// §9.11c.1 (`GET /api/me/earnings?range=…` + SSE `/api/me/earnings/stream`).
// SPEC-4: user/devices/earnings now persist through the account-cloud mock, so
// the same accountKey can be rebound by H5 / signed app / white-app carriers.

const ONE_DAY = ONE_DAY_MS;

// ── module-level tick state (mirrors original module scope) ──
const deviceTimers = new Map<string, { vital: number }>();
const lastTickAggregate = { usd: 0, nex: 0 };

function normalRandom(mean: number, std: number, min: number, max: number) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(min, Math.min(max, mean + z * std));
}

/** ms granularity floor for one settlement — throttles accrual to ≥1800ms windows
 *  and batches the market/variation jitter (as the old tick-time batch did).
 *  NOTE (pre-existing mock characteristic, predates SPEC-1, NOT fixed here): for a
 *  low daily-rate device (≲ $24/day USDT or ≲ 240/day NEX) one window's increment
 *  falls below the todayEarnings toFixed(3)/(2) rounding floor, so its steady-state
 *  per-device counter barely moves — only higher-rate devices and large reopen-Δ
 *  catch-ups register. A display-layer sub-cent carry would smooth this (product
 *  改进, out of SPEC-1 scope). A reopen produces one large Δ → settled in one shot
 *  (uncapped: PROD's server settle + daily reset bound it; mock leaves it raw). */
const SETTLE_MIN_MS = 1800;

function createEarningBuckets(withdrawableUsdt: number, now = Date.now()): UserState["earningBuckets"] {
  return {
    withdrawableUsdt,
    pendingReviewUsdt: 0,
    bonusLockedUsdt: 0,
    lockedNex: 0,
    policyVersion: "mock-seed-v1",
    lastBucketedAt: now,
  };
}

/**
 * 资金三元组快照 —— 冲正(退款 / 回滚)的基准。三个字段就是全部会被资金原语动到的量:
 * debitBalance 同时改 usdtBalance 与 withdrawableUsdt(clamp),debitNex 改 nexBalance。
 * 少一个字段,退款就还原不回扣款前(见 restoreMoney 头注)。
 *
 * `applied` 是**本标签页自己动过多少钱**的读数(见 restoreMoney 头注)。冲正按增量回滚
 * 而不是写绝对值,靠的就是它 —— 三个绝对值只用于 UI/日志与合法性校验,不参与算账。
 */
export interface MoneySnapshot {
  usdtBalance: number;
  nexBalance: number;
  withdrawableUsdt: number;
  applied: MoneyDelta;
}

/** 一次资金变更在**合并之前**对本地三元组产生的增量(正=加,负=减)。 */
interface MoneyDelta {
  usdtBalance: number;
  nexBalance: number;
  withdrawableUsdt: number;
}

function withDefaultEarningBuckets(user: UserState): UserState {
  return {
    ...user,
    appliedRewardKeys: user.appliedRewardKeys ?? {},
    earningBuckets: {
      ...createEarningBuckets(user.usdtBalance, user.joinedAt),
      ...(user.earningBuckets ?? {}),
    },
  };
}

function bucketUserEarnings(
  current: UserState,
  route: EarningBucketRoute,
  usdt: number,
  nex: number,
  policyVersion: string,
  now = Date.now(),
): UserState {
  const buckets = withDefaultEarningBuckets(current).earningBuckets;
  const nextBuckets = { ...buckets, policyVersion, lastBucketedAt: now };
  const nextUser: UserState = { ...current, earningBuckets: nextBuckets };
  if (usdt <= 0 && nex <= 0) return nextUser;
  if (route === "withdrawable") {
    nextBuckets.withdrawableUsdt = +(nextBuckets.withdrawableUsdt + usdt).toFixed(2);
    nextUser.usdtBalance = +(nextUser.usdtBalance + usdt).toFixed(2);
    nextUser.nexBalance = +(nextUser.nexBalance + nex).toFixed(2);
  } else if (route === "pending_review") {
    nextBuckets.pendingReviewUsdt = +(nextBuckets.pendingReviewUsdt + usdt).toFixed(2);
    nextBuckets.lockedNex = +(nextBuckets.lockedNex + nex).toFixed(2);
  } else if (route === "bonus_locked") {
    nextBuckets.bonusLockedUsdt = +(nextBuckets.bonusLockedUsdt + usdt).toFixed(2);
    nextBuckets.lockedNex = +(nextBuckets.lockedNex + nex).toFixed(2);
  }
  return nextUser;
}

function createInitialUser(email = "alex@nexgrid.ai"): UserState {
  const usdtBalance = 24856.56;
  return {
    email,
    tier: "L2",
    joinedAt: Date.now() - 30 * ONE_DAY,
    cumulativeDepositUsdt: 0,
    genesisInviteCode: null,
    referralCode: "NEXGRID-8K9X",
    usdtBalance,
    nexBalance: 1240,
    pendingEarnings: 2.31,
    earningBuckets: createEarningBuckets(usdtBalance),
  };
}

function createInitialEarnings(): EarningsState {
  const now = Date.now();
  return {
    today: 247.83,
    todayNEX: 612.4,
    thisWeek: 1247.65,
    thisMonth: 5184.62,
    total: 28452.18,
    history: [
      { ts: now - 1 * 3600 * 1000, amount: 0.23 },
      { ts: now - 2 * 3600 * 1000, amount: 0.19 },
      { ts: now - 3 * 3600 * 1000, amount: 0.21 },
      { ts: now - 4 * 3600 * 1000, amount: 0.18 },
    ],
  };
}

// Concurrent grid jobs seed — coherent with the regional throughput sum
// (51.2k jobs/hr global ⇒ ~5–6 min median job at this concurrency).
const ACTIVE_JOBS_SEED = 4812;

function createInitialGlobal(onlineBaseline: number): GlobalStats {
  return {
    activeDevices: onlineBaseline,
    nodes: 156,
    countries: 47,
    uptime: 99.7,
    activeJobs: ACTIVE_JOBS_SEED,
  };
}

// FEAT-DEV02: legacy persisted snapshots (pre trade-in economics fields) get
// their devices backfilled at the consumption gate — account-cloud stays
// value-import-free for the SPEC-4 VM sentinel (see device-types.ts).
function hydrateSnapshotEconomics(s: AccountCloudSnapshot | null): AccountCloudSnapshot | null {
  return s ? { ...s, devices: (s.devices ?? []).map(backfillDeviceEconomics) } : null;
}

function createSeedSnapshot(accountKey: string, email: string, entrySurface: EntrySurface): AccountCloudSnapshot {
  return {
    schema: 1,
    accountKey: normalizeAccountKey(accountKey),
    entrySurface,
    updatedAt: Date.now(),
    user: createInitialUser(email || accountKey || "alex@nexgrid.ai"),
    devices: makeInitialDevices(),
    earnings: createInitialEarnings(),
    withdrawals: [],
  };
}

/** PRD §6.11 — the single earnings-accrual path (settle-single-source).
 *  Accrues a device by the WALL-CLOCK Δ since its `lastSettledAt` anchor (NOT by
 *  accumulated tick time), then re-anchors to `now`. Driving accrual off the
 *  registration anchor is what decouples earnings from the page being open: a
 *  BACKGROUNDED gap is settled in one shot on the next settle(). The account-cloud
 *  mock persists and reloads this anchor across refreshes; PROD makes the server
 *  canonical for lastSettledAt and the resulting aggregate.
 *  R7 在线分层: a phone with a fresh device heartbeat accrues continuity×thermal;
 *  a missing/stale beat accrues the hosted baseline. The view carrier is never
 *  a factor source (display uses the same isDeviceOnline seam). */
function settleDevice(d: Device, now: number, onlineBonus: OnlineBonus): Device {
  // Not earning right now (idle / offline / cloud-share / phone gated) → drop a
  // stale anchor so the idle gap is never back-paid when the device resumes.
  if (
    d.activatedAt === null ||
    d.status !== "online" ||
    d.kind === "cloud-share" ||
    d.pausedReason != null ||
    (d.kind === "phone" && (d.isCharging === false || d.isWifiConnected === false))
  ) {
    return d.lastSettledAt == null ? d : { ...d, lastSettledAt: null };
  }
  // First sight after (re)activation: anchor without paying (登记 moment).
  if (d.lastSettledAt == null) return { ...d, lastSettledAt: now };

  const deltaMs = now - d.lastSettledAt;
  if (deltaMs < SETTLE_MIN_MS) return d;

  const marketMult = 0.95 + Math.random() * 0.1;
  const variation = 0.85 + Math.random() * 0.3;
  const lifeEff = isDegradable(d.kind) ? getEfficiency(getMonthsOwned(d.purchasedAt)) : 1;
  const phoneFactor =
    d.kind === "phone"
      ? isDeviceOnline(d, now)
        ? continuityFactor(now - (d.miningSince ?? now), onlineBonus.continuityFullHours * 60 * 60 * 1000) * thermalFactor(d.thermalState)
        : onlineBonus.h5BaseFactor
      : 1;
  const inc = (d.baseRate * lifeEff * phoneFactor * marketMult * variation * deltaMs) / ONE_DAY;
  const incNEX = (d.baseRateNEX * lifeEff * phoneFactor * marketMult * variation * deltaMs) / ONE_DAY;
  return {
    ...d,
    todayEarnings: +(d.todayEarnings + inc).toFixed(3),
    todayEarningsNEX: +(d.todayEarningsNEX + incNEX).toFixed(2),
    // FEAT-DEV02: lifetime output accrues in lockstep with the USD increment.
    // Deactivation / today-zeroing paths never touch this field (ladder numerator).
    cumulativeEarningsUsdt: +((d.cumulativeEarningsUsdt ?? 0) + inc).toFixed(3),
    lastSettledAt: now,
  };
}

/** Pure R7 batch transition. Settlement deliberately reads the OLD heartbeat;
 * only after that wall-clock delta is priced may the resident App stamp a new
 * beat for the next tick. This prevents a killed App from reopening and
 * back-paying the entire offline gap at the online rate. */
export function settleDeviceBatch(
  current: Device[],
  carrier: Carrier,
  now: number,
  onlineBonus: OnlineBonus,
  computeShareEnabled: boolean,
): { settled: Device[]; nextDevices: Device[] } {
  const settled = current.map((device) =>
    device.kind === "pc-gpu" && !computeShareEnabled
      ? freezeComputeShareDevice(device)
      : settleDevice(device, now, onlineBonus),
  );
  const nextDevices = carrier === "app"
    ? settled.map((device) =>
        device.kind === "phone" &&
        device.status === "online" &&
        device.pausedReason == null &&
        device.isCharging !== false &&
        device.isWifiConnected !== false &&
        device.activatedAt !== null
          ? { ...device, onlineHeartbeatAt: now }
          : device,
      )
    : settled;
  return { settled, nextDevices };
}

function freezeComputeShareDevice(d: Device): Device {
  if (d.kind !== "pc-gpu") return d;
  return {
    ...d,
    lastSettledAt: null,
    currentTask: null,
    gpuUsage: 0,
    gpuTemp: 0,
    gpuPower: 0,
    vramUsed: 0,
  };
}

export const useApp = defineStore("app", () => {
  const bootSurface = getEntrySurface();
  const bootSnapshot = hydrateSnapshotEconomics(readAccountSnapshot("default")) ?? createSeedSnapshot("default", "alex@nexgrid.ai", bootSurface);
  const accountKey = ref(bootSnapshot.accountKey);
  const entrySurface = ref<EntrySurface>(bootSnapshot.entrySurface);
  const accountCloudUpdatedAt = ref(bootSnapshot.updatedAt);
  const user = ref<UserState>(bootSnapshot.user);
  const devices = ref<Device[]>(bootSnapshot.devices);
  const earnings = ref<EarningsState>(bootSnapshot.earnings);
  // 🔴 在线设备锚改由展示配置驱动(规格 FEAT-HOME02 ③:「既有硬编码常量改为由此配置驱动」)。
  //   在线数 = 舰队规模 × 在线率;呼吸带 = ±onlineJitter(只影响视觉,不进任何金额派生)。
  //   配置非法时回退编译期锚 —— 全局条不许因单个参数坏而冻结(异常3 的「单项坏不拖垮」);
  //   首页脉搏卡的「该格占位」判定读配置本体,不读这里的回退值,两层各管各的。
  const cfg = useConfig();
  //   ⚠️ publicStats 整段可能缺席:若干机器门用最小配置桩装载本 store(邀请码门实测炸在这),
  //   老持久行升级期同理 —— 缺席按「配置未知」走编译期锚回退,不许在 setup 期抛。
  //   🔴 收留判据 = publicStatsHealth(R2 审计 P1:上一版 isFinite&&>0 会把
  //   「非法但为正」的越域值收留进 global.activeDevices,而 on-grid/trust/globe 三处
  //   裸消费它 —— 同一行页脚里 200 万在线 × 按 2.8 万舰队算的 $/sec。根修这一个生产点,
  //   消费者自动收敛;域判定与卡片占位共用同一个函数,两层永不打架)。
  const pulseOnlineBaseline = (): number => {
    const ps = cfg.config.publicStats;
    // R3 P2:jitter 只属呼吸带(band 自己会回退 24),越域不该把合法舰队基线拖回种子
    const h = publicStatsHealth(ps ?? null);
    if (!ps || !h.fleetOk || !h.rateOk) return 0;
    return Math.round(ps.fleetDevices * (ps.onlineRatePct / 100));
  };
  const pulseJitterBand = (): number => {
    const ps = cfg.config.publicStats;
    if (!ps || !publicStatsHealth(ps).jitterOk) return 0;
    return ps.onlineJitter;
  };
  const global = ref<GlobalStats>(createInitialGlobal(pulseOnlineBaseline()));
  // 真后端模式下 config 是异步装载的；global 比它更早创建，不能永久保留启动时的 0。
  // 只重基线展示快照，不启动本地抖动，也不把客户端值写回任何业务状态。
  if (remoteApiEnabled) {
    watch(
      () => [
        cfg.syncFailed,
        cfg.config.publicStats.fleetDevices,
        cfg.config.publicStats.onlineRatePct,
      ],
      () => {
        const activeDevices = cfg.syncFailed ? 0 : pulseOnlineBaseline();
        if (global.value.activeDevices !== activeDevices) {
          global.value = { ...global.value, activeDevices };
        }
      },
      { immediate: true },
    );
  }
  /**
   * 🔴 提现单**列表**是源真理(与真后端 GET /api/withdrawals 同构)。
   * 此前只存最新一条,第二笔建单会把第一笔整个顶掉 —— 钱已扣、单据不可达、
   * 到账推进也永不再碰它。列表化后并发/跨日的多笔各自独立推进,互不覆盖。
   */
  const withdrawals = ref<Withdrawal[]>(bootSnapshot.withdrawals ?? []);
  /**
   * 🔴 在途单(非终态)列表。**列表级的问题必须问它,不能问 latestWithdrawal** ——
   * 独立验收实测:模型改成列表后,三个消费者仍拿「只问最新一条」的老问法去问
   * 列表级问题,于是「一张在途单 + 一张更新的已到账单」这个组合下全部答错:
   * 账单结算结算错单、钱包入口整行消失、换绑闸被静默架空。
   */
  const inFlightWithdrawals = computed(() => withdrawals.value.filter((w) => occupiesWithdrawalSlot(w.status)));
  /**
   * 展示面的**主单**:优先最早的在途单(用户最关心还没到账的那笔),
   * 都结清了才退回最近一笔。钱包入口与追踪页共用它,口径才不会打架。
   */
  const primaryWithdrawal = computed<Withdrawal | null>(() => {
    const pending = inFlightWithdrawals.value;
    if (pending.length) return pending.reduce((a, b) => (b.submittedAt < a.submittedAt ? b : a));
    return latestWithdrawal.value;
  });
  /** 最近一笔(按提交时刻)。派生值,不是独立状态。 */
  const latestWithdrawal = computed<Withdrawal | null>(() =>
    withdrawals.value.length
      ? withdrawals.value.reduce((a, b) => (b.submittedAt > a.submittedAt ? b : a))
      : null,
  );
  let lastCloudSnapshot: AccountCloudSnapshot = bootSnapshot;
  /** 提现回读的在途闸:两拍叠加时,迟到的旧结论会带着更大的 mirroredAt 赢下合并裁决。 */
  let mirrorInFlight = false;
  // cfg 声明已随「在线设备锚配置化」上移到 global 初始化之前(同一个实例,别再声明第二个)
  const computeShareEnabled = computed(() => cfg.isEnabled("computeShareEnabled"));
  const slotDevices = computed(() =>
    computeShareEnabled.value ? devices.value : devices.value.filter((d) => d.kind !== "pc-gpu"),
  );
  const visibleDevices = slotDevices;
  // Slot authority must count hidden active pc-gpu devices too. When the PC
  // share flag is off, UI hides those devices, but they still reserve backend
  // capacity; otherwise closing/reopening the flag can push the account past 6.
  const activeSlotCount = computed(() => devices.value.filter((d) => d.activatedAt !== null).length);
  /**
   * FEAT-HOME02 ③ 首页「你的排名」的入参:本账号全部在产设备的**有效算力之和**(TOPS)。
   * 口径与聚合全在 lib/account-hashrate.ts(复用既有单台模型,不新造第二套)。
   *
   * 🔴 **收 now 入参,不写成 computed**:`Date.now()` 不是响应式源。写成
   * `computed(() => accountTotalHashrate(..., Date.now(), ...))` 时 Vue 只在 devices /
   * 配置变化时才重算,而 tick() 在会话被顶号 / 登出 / 吊销时早退(见 miningPaused),
   * devices 不再被重新赋值 —— 这个值就永久冻在最后一次重算的那一刻:掉线三分钟以上的
   * 手机仍按满档计进排名,而设备卡早已翻成离线(它用的是自己那个会走的 now ref)。
   * 让调用方传自己的时钟(composables/use-now.ts 或组件的 now ref),依赖就是显式的,
   * 页面时间一走值就跟着走。
   *
   * 问 visibleDevices 而不是 devices:电脑算力开关关掉时那些设备被冻结不产出
   * (tick/settleDevice 的 freezeComputeShareDevice),算力自然也不该计。
   *
   * 0 = 没有在产设备。**「未上榜」不在这里判** —— 三态(ranked/unranked/unavailable)
   * 是 lib/network-rank.ts 的事,这里只给一个数。
   */
  function myTotalHashrateAt(now: number): number {
    // GPU 档位表从配置 store 穿进去(运营在 E6 改档 / 加识别词,排名要跟着走),
    // 与 connectComputeShareDevice / download 页同一单源 —— 禁读编译期常量。
    return accountTotalHashrate(visibleDevices.value, now, cfg.config.onlineBonus, cfg.config.computeShare.gpuTiers);
  }
  // When the session is invalidated (logged in elsewhere / logged out / admin
  // revoked), mining freezes: tick() early-returns so no earnings accrue while
  // this carrier has no valid session. Cleared by resumeMining() once a fresh
  // session is established. App.vue also gates tick on session state, so this is
  // belt-and-suspenders.
  const miningPaused = ref(false);

  function syncDeviceRuntime(nextDevices: Device[], resetTimers = false) {
    const nextIds = new Set(nextDevices.map((d) => d.id));
    if (resetTimers) {
      deviceTimers.clear();
    } else {
      Array.from(deviceTimers.keys()).forEach((id) => {
        if (!nextIds.has(id)) deviceTimers.delete(id);
      });
    }
    nextDevices.forEach((d) => {
      if (!deviceTimers.has(d.id)) deviceTimers.set(d.id, { vital: 0 });
    });
    // Seed the aggregate baseline to the devices' pre-earned today totals so the
    // next settle() doesn't treat stored/cloud counters as new local earnings.
    lastTickAggregate.usd = nextDevices.reduce((s, d) => s + d.todayEarnings, 0);
    lastTickAggregate.nex = nextDevices.reduce((s, d) => s + d.todayEarningsNEX, 0);
  }

  // seed per-device timers
  function reseedDeviceRuntime(nextDevices: Device[]) {
    syncDeviceRuntime(nextDevices, true);
  }

  function adoptAccountSnapshot(snapshot: AccountCloudSnapshot, resetRuntime = false) {
    const normalizedSnapshot = { ...snapshot, user: withDefaultEarningBuckets(snapshot.user) };
    user.value = normalizedSnapshot.user;
    devices.value = snapshot.devices;
    earnings.value = snapshot.earnings;
    withdrawals.value = snapshot.withdrawals ?? [];
    syncDeviceRuntime(snapshot.devices, resetRuntime);
    lastCloudSnapshot = normalizedSnapshot;
    accountCloudUpdatedAt.value = normalizedSnapshot.updatedAt;
  }

  reseedDeviceRuntime(devices.value);

  function persistAccountSnapshot(): boolean {
    const snapshot: AccountCloudSnapshot = {
      schema: 1,
      accountKey: accountKey.value,
      entrySurface: entrySurface.value,
      updatedAt: Date.now(),
      user: user.value,
      devices: devices.value,
      earnings: earnings.value,
      withdrawals: withdrawals.value,
    };
    const result = mergeAndWriteAccountSnapshotResult(lastCloudSnapshot, snapshot);
    adoptAccountSnapshot(result.snapshot);
    return result.persisted;
  }

  function bindAccount(rawAccountKey: string, surface: EntrySurface = getEntrySurface()) {
    const key = normalizeAccountKey(rawAccountKey);
    const snapshot = hydrateSnapshotEconomics(readAccountSnapshot(key)) ?? createSeedSnapshot(key, rawAccountKey, surface);
    accountKey.value = snapshot.accountKey;
    entrySurface.value = surface;
    const boundSnapshot: AccountCloudSnapshot = {
      ...snapshot,
      entrySurface: surface,
      user: { ...snapshot.user, email: snapshot.user.email || rawAccountKey || "alex@nexgrid.ai" },
    };
    miningPaused.value = false;
    adoptAccountSnapshot(boundSnapshot, true);
    persistAccountSnapshot();
  }

  function tick(deltaMs: number) {
    if (remoteApiEnabled) return;
    // ── Global platform stats jitter ──
    // Runs even while the personal session is paused — platform-wide figures
    // must not freeze on an individual's mining state. Symmetric BOUNDED
    // wobble only: the fleet/jobs figures are anchors and must not
    // extrapolate (the old always-add tick implied +130k devices/day; see
    // docs/changes/2026-07-24-platform-stats-single-anchor.md). Bands clamp
    // the O(√t) drift of an unbounded symmetric walk over long dwells.
    const devDrift = Math.random();
    const nextDevices = global.value.activeDevices + (devDrift > 0.8 ? 1 : devDrift < 0.2 ? -1 : 0);
    const nextJobs = global.value.activeJobs + Math.floor(Math.random() * 5) - 2;
    // 呼吸带跟配置走(运营改了舰队/在线率/抖幅,已开着的会话在带内自然漂过去)
    const devBase = pulseOnlineBaseline();
    const devBand = pulseJitterBand();
    global.value = {
      ...global.value,
      activeDevices: Math.min(devBase + devBand, Math.max(devBase - devBand, nextDevices)),
      activeJobs: Math.min(ACTIVE_JOBS_SEED + 36, Math.max(ACTIVE_JOBS_SEED - 36, nextJobs)),
    };
    if (miningPaused.value) return;

    // ── Per-device updates ──
    const newDevices = devices.value.map((d) => {
      if (d.kind === "pc-gpu" && !computeShareEnabled.value) return freezeComputeShareDevice(d);
      if (d.activatedAt === null) return d;
      if (d.status !== "online" || d.kind === "cloud-share") return d;
      const timer = deviceTimers.get(d.id) ?? { vital: 0 };
      timer.vital += deltaMs;
      deviceTimers.set(d.id, timer);

      const next: Device = { ...d };

      // Phone charging + network gating
      if (d.kind === "phone") {
        let reason: Device["pausedReason"] = null;
        if (d.isCharging === false) reason = "no-charger";
        else if (!d.isWifiConnected) reason = "no-network";
        next.pausedReason = reason;
        if (reason !== null) {
          if (next.currentTask) {
            const startedInterrupt = next.interruptedAt ?? Date.now();
            if (interruptInfo(startedInterrupt, Date.now()).expired) {
              next.currentTask = null;
              next.interruptedAt = null;
            } else {
              next.interruptedAt = startedInterrupt;
            }
          } else {
            next.interruptedAt = null;
          }
          next.gpuUsage = 0;
          next.miningSince = null; // paused → continuous-online run ends, stability bonus resets
          return next;
        }
        if (next.interruptedAt != null) {
          if (next.currentTask) {
            const heldMs = Date.now() - next.interruptedAt;
            next.currentTask = { ...next.currentTask, startedAt: next.currentTask.startedAt + heldMs };
          }
          next.interruptedAt = null;
        }
        // Running (charging + online): start a fresh continuity run if none.
        if (next.miningSince == null) next.miningSince = Date.now();
      } else {
        next.pausedReason = null;
      }

      // GPU vitals refresh ~3s
      if (timer.vital >= 3000) {
        timer.vital = 0;
        next.gpuUsage = Math.round(normalRandom(82, 6, 65, 97));
        next.gpuTemp = Math.round(55 + next.gpuUsage * 0.18 + (Math.random() * 6 - 3));
        next.gpuPower = Math.round(d.basePower * (0.85 + (next.gpuUsage / 100) * 0.2));
        next.vramUsed = +(d.vramTotal * (0.7 + Math.random() * 0.2)).toFixed(1);
      }

      // Earnings accrual moved to settle() (PRD §6.11): yield is settled by
      // wall-clock Δ since lastSettledAt — not accumulated tick time — so a
      // closed/backgrounded gap catches up on reopen. Telemetry stays per-tick
      // here; settle() runs once below after this telemetry pass commits.

      // Task progress / rotation
      if (next.currentTask) {
        const elapsedSec = (Date.now() - next.currentTask.startedAt) / 1000;
        if (elapsedSec >= next.currentTask.totalSec) {
          const completed: CompletedTask = { ...next.currentTask, completedAt: Date.now() };
          next.recentTasks = [completed, ...next.recentTasks].slice(0, 10);
          useReceipts().add(generateReceipt(completed, d));
          if (next.pendingDeactivate) {
            next.activatedAt = null;
            next.pendingDeactivate = false;
            next.lastSettledAt = null;
            next.onlineHeartbeatAt = null;
            next.gpuUsage = 0;
            next.gpuTemp = 0;
            next.gpuPower = 0;
            next.vramUsed = 0;
            next.currentTask = null;
            next.todayEarnings = 0;
            next.todayEarningsNEX = 0;
            return next;
          }
          next.currentTask = pickRandomTask(d.vramTotal);
        }
      } else {
        next.currentTask = pickRandomTask(d.vramTotal);
      }

      return next;
    });

    // Telemetry committed; earnings settled separately via the single source.
    devices.value = newDevices;
    settle();
  }

  /** PRD §6.11 — settle every device by wall-clock Δ (settleDevice), then roll
   *  the aggregate today/week/month/total + NEX balance forward by the positive
   *  delta. Called by tick() (steady state) and on app foreground (App.vue onShow)
   *  so a backgrounded / reopened session catches its offline gap up in one shot.
   *  The SINGLE mock accrual path — PROD replaces it with the candidate aggregate
   *  GET/SSE contract in PRD §9.11c.1; no settle mutation endpoint is frozen. */
  function settle() {
    // 🔴 与上面的 tick() 同一道闸(此前只 tick 有,settle 漏了 —— 而 settle 是**唯一**的
    // 计收路径,且 App.vue 的 ensureBusinessLoopsRunning / connectComputeShareDevice 都直调它)。
    // 远端模式下这里每跑一次就凭设备墙钟给自己发一次钱:earnings.* 之外还经 bucketUserEarnings +
    // applyReleaseOutcome 直写 usdtBalance / nexBalance / withdrawableUsdt。收益归服务端
    // (GET /api/me/earnings —— PRD §9.11c.1),client 不自算。
    if (remoteApiEnabled) return;
    if (miningPaused.value) return;
    const cfgStore = useConfig();
    // FEAT-RISK02 异常3: 配置同步失败 → 暂停结算并由钱包显示失败态;
    // 禁止回退到前端写死默认值继续结算。
    if (cfgStore.syncFailed) return;
    const now = Date.now();
    const carrier = getCarrier();
    const onlineBonus = cfgStore.config.onlineBonus;
    // R5 簇状态实时性: 每轮结算现算当前簇,禁用注册时缓存的状态。
    const clusterEval = evaluateAccountCluster(accountKey.value);
    // R7: settle from the pre-existing heartbeat first, then stamp the App
    // heartbeat for the next tick. Reversing these two steps overpays a stale
    // offline gap after the App is reopened.
    const sourceDevices = devices.value;
    const anchorBefore = new Map(sourceDevices.map((d) => [d.id, d.lastSettledAt ?? null]));
    const onlineBefore = new Map(sourceDevices.map((d) => [d.id, isDeviceOnline(d, now)]));
    const { settled, nextDevices } = settleDeviceBatch(
      sourceDevices,
      carrier,
      now,
      onlineBonus,
      computeShareEnabled.value,
    );
    // Only a delta that was already backed by a fresh device heartbeat counts
    // as App online attestation. A stale reopen tick is baseline and attests 0.
    // 用 settleDevice 实际推进的锚点差(after > before 才是真结算的墙钟那一拍),
    // 与收益累计同源;首次登记(before=null)/未达结算间隔(锚点未动)都不计,
    // 修 audit U1「复用外层旧锚点每 tick 重算全量差 → 系统性多计 ~1.5x」。
    // R7: onlineBefore is the device-heartbeat signal; carrier only proves this
    // mock tick originated from the resident App.
    if (carrier === "app") {
      for (const d of settled) {
        if (d.kind !== "phone" || d.pausedReason != null || !onlineBefore.get(d.id)) continue;
        const before = anchorBefore.get(d.id) ?? null;
        const after = d.lastSettledAt ?? null;
        if (before != null && after != null && after > before) {
          recordAttestation(accountKey.value, after - before);
        }
      }
    }

    const aggregateToday = settled.reduce((sum, d) => sum + d.todayEarnings, 0);
    const aggregateTodayNEX = settled.reduce((sum, d) => sum + d.todayEarningsNEX, 0);
    const positiveUsdDelta = Math.max(0, aggregateToday - lastTickAggregate.usd);
    const positiveNexDelta = Math.max(0, aggregateTodayNEX - lastTickAggregate.nex);
    lastTickAggregate.usd = aggregateToday;
    lastTickAggregate.nex = aggregateTodayNEX;

    const currentTodayUSD = earnings.value.today;
    const nextTodayUSD = accumulateUsdAccrual(currentTodayUSD, positiveUsdDelta);
    const nextTodayNEX = +(earnings.value.todayNEX + positiveNexDelta).toFixed(2);

    devices.value = nextDevices;
    earnings.value = {
      ...earnings.value,
      today: nextTodayUSD,
      todayNEX: nextTodayNEX,
      thisWeek: accumulateUsdAccrual(earnings.value.thisWeek, positiveUsdDelta),
      thisMonth: accumulateUsdAccrual(earnings.value.thisMonth, positiveUsdDelta),
      total: accumulateUsdAccrual(earnings.value.total, positiveUsdDelta),
    };
    const routedUsd = completedUsdCentDelta(currentTodayUSD, nextTodayUSD);
    const routedNex = +positiveNexDelta.toFixed(2);
    user.value = {
      ...bucketUserEarnings(
        user.value,
        clusterEval.bucketRoute,
        routedUsd,
        routedNex,
        clusterEval.configVersion,
        now,
      ),
      pendingEarnings: nextTodayUSD,
    };
    // R1: 非可提路线的入账记分录 —— 释放引擎只认 attest/manual,不认时间。
    if (clusterEval.bucketRoute === "pending_review" || clusterEval.bucketRoute === "bonus_locked") {
      appendLedgerEntry(accountKey.value, clusterEval.clusterId, clusterEval.bucketRoute, routedUsd, routedNex);
    }
    // R1 释放判定: attest 达标 → 释放待审/锁定;熔断命中 → 待审升锁定。
    user.value = applyReleaseOutcome(user.value, evaluateAttestRelease(accountKey.value, clusterEval), now);
    persistAccountSnapshot();
  }

  /** 把释放引擎的结果落到资金桶(台账为辅助账,金额 clamp 到桶余额,漂移容忍)。 */
  function applyReleaseOutcome(current: UserState, outcome: ReleaseOutcome, now: number): UserState {
    if (!hasReleaseEffect(outcome)) return current;
    const buckets = { ...withDefaultEarningBuckets(current).earningBuckets, lastBucketedAt: now };
    // 待审 → 可提
    const relPendUsd = Math.min(outcome.releasedPendingUsdt, buckets.pendingReviewUsdt);
    buckets.pendingReviewUsdt = +(buckets.pendingReviewUsdt - relPendUsd).toFixed(2);
    // 锁定 → 可提
    const relLockUsd = Math.min(outcome.releasedLockedUsdt, buckets.bonusLockedUsdt);
    buckets.bonusLockedUsdt = +(buckets.bonusLockedUsdt - relLockUsd).toFixed(2);
    // 熔断: 待审 → 锁定(在释放之后应用,操作的是未释放余量)
    const escUsd = Math.min(outcome.escalatedUsdt, buckets.pendingReviewUsdt);
    buckets.pendingReviewUsdt = +(buckets.pendingReviewUsdt - escUsd).toFixed(2);
    buckets.bonusLockedUsdt = +(buckets.bonusLockedUsdt + escUsd).toFixed(2);
    // NEX 锁定 → 余额
    const relNex = Math.min(outcome.releasedPendingNex + outcome.releasedLockedNex, buckets.lockedNex);
    buckets.lockedNex = +(buckets.lockedNex - relNex).toFixed(2);
    const relUsd = +(relPendUsd + relLockUsd).toFixed(2);
    buckets.withdrawableUsdt = +(buckets.withdrawableUsdt + relUsd).toFixed(2);
    return {
      ...current,
      earningBuckets: buckets,
      usdtBalance: +(current.usdtBalance + relUsd).toFixed(2),
      nexBalance: +(current.nexBalance + relNex).toFixed(2),
    };
  }

  /** ⚠️ DEV/DEMO-ONLY: 模拟 D2 人工放行本账户全部待审收益(mock 双端不打通,DR-7)。 */
  function _devGrantManualRelease() {
    if (import.meta.env.PROD) return; // 资金释放入口,store 层二层 guard(硬规则5)
    user.value = applyReleaseOutcome(user.value, _devGrantManualReleaseLedger(accountKey.value), Date.now());
    persistAccountSnapshot();
  }

  // ⚠️ MOCK-ONLY demo helper (ported from index.ts setPhoneRuntime). Lets the
  // device card toggle isCharging / isWifiConnected / batteryLevel on a phone so
  // reviewers can simulate unplugging / losing network and watch the gating fire.
  // Real backend pulls these from candidate POST /api/device/:id/heartbeat
  // (PRD §6.11/§12.2) — client must NOT mutate. Only patches phone-kind devices.
  function setPhoneRuntime(
    id: string,
    patch: Partial<Pick<Device, "isCharging" | "isWifiConnected" | "batteryLevel">>,
  ) {
    devices.value = devices.value.map((d) => {
      if (d.id !== id || d.kind !== "phone") return d;
      const next = { ...d, ...patch };
      const pausedReason: Device["pausedReason"] =
        next.isCharging === false ? "no-charger" : next.isWifiConnected === false ? "no-network" : null;
      return pausedReason == null
        ? { ...next, pausedReason }
        : {
            ...next,
            pausedReason,
            miningSince: null,
            lastSettledAt: null,
            onlineHeartbeatAt: null,
          };
    });
    persistAccountSnapshot();
  }

  // Apply a calibration result to the phone device: refreshes its yield baseline
  // + displayed NPU spec from the (deterministic, per-device) capability, and
  // starts a fresh continuity run. Called by the onboarding/recalibration ritual
  // after measureDeviceCapability(). PROD: GET /api/onboarding/calibrate/result
  // returns score/tier/yield baseline; the client applies that result here.
  function applyPhoneCalibration(cap: DeviceCapability) {
    devices.value = devices.value.map((d) =>
      d.kind === "phone"
        ? {
            ...d,
            baseRate: cap.baseRateUsdt,
            baseRateNEX: cap.baseRateNex,
            gpu: `Mobile NPU · ~${cap.tops} TOPS`,
            capabilityScore: cap.score,
            capabilityTops: cap.tops,
            capabilityTier: cap.tier,
            miningSince: Date.now(),
            onlineHeartbeatAt: null,
          }
        : d,
    );
    persistAccountSnapshot();
  }

  // Session invalidated (self logged-out / admin revoked): immediately cancel
  // every in-flight task across the fleet WITHOUT a grace window and WITHOUT
  // issuing a receipt — the in-progress job's reward is forfeited (the
  // "回退"/rollback), mirroring interrupt.ts cancel semantics but triggered by
  // auth, not connectivity. Freezes mining until resumeMining().
  function interruptAllTasks(_reason: "kicked" | "logged-out") {
    miningPaused.value = true;
    devices.value = devices.value.map((d) =>
      d.activatedAt !== null
        ? { ...d, currentTask: null, interruptedAt: null, miningSince: null, lastSettledAt: null, onlineHeartbeatAt: null }
        : d,
    );
    persistAccountSnapshot();
  }

  // Re-arm the simulation after a fresh session is established (re-login /
  // recalibration complete). tick() resumes assigning tasks + accruing.
  function resumeMining() {
    miningPaused.value = false;
    persistAccountSnapshot();
  }

  // ── Device lifecycle (slot CRUD) — ported from index.ts addDevice /
  // activateDevice / deactivateDevice / scheduleDeactivation.
  // orders.advanceOrder optional-chains addDevice + activateDevice, so adding
  // these here lights up the order→device-spawn probe.

  // New purchases land in inventory inactive and require explicit activation.
  // Returns the new device id so callers that chain activate/debit/bill use
  // the returned id, NOT `.filter(kind).pop()` (Batch C Round 1 P0 #4: pop()
  // picked the wrong same-kind device when inventory already held one).
  function addDevice(kind: DeviceKind, options: CreateDeviceOptions = {}): string {
    const id = `${kind}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const newDevice = createDevice(kind, id, options);
    deviceTimers.set(id, { vital: 0 });
    devices.value = [...devices.value, newDevice];
    persistAccountSnapshot();
    return id;
  }

  function connectComputeShareDevice(gpuModel = "NVIDIA GeForce RTX 4070", reservedSlots = 0): {
    ok: boolean;
    deviceId?: string;
    reason?: "disabled" | "slots-full" | "activation-failed";
  } {
    if (!computeShareEnabled.value) return { ok: false, reason: "disabled" };
    if (activeSlotCount.value + reservedSlots >= MAX_DEVICES) return { ok: false, reason: "slots-full" };

    const normalizedModel = gpuModel.trim() || "NVIDIA GeForce RTX 4070";
    const gpuTier = matchGpuTier(normalizedModel, cfg.config.computeShare.gpuTiers);
    const deviceId = addDevice("pc-gpu", { gpuModel: normalizedModel, gpuTier });
    const ok = activateDevice(deviceId, reservedSlots);
    if (!ok) {
      devices.value = devices.value.filter((d) => d.id !== deviceId);
      deviceTimers.delete(deviceId);
      persistAccountSnapshot();
      return { ok: false, reason: "activation-failed" };
    }
    settle();
    return { ok: true, deviceId };
  }

  // Sprint #146-1 — activation toggle. Slot cap (MAX_DEVICES) applies to ACTIVE
  // devices only. `reservedSlots` lets the caller fold in non-device slot
  // holders (e.g. a running trial reserves a shadow slot) without app.ts
  // importing the trial store — stores never import each other; the page
  // composes the reserved count. Returns false on cap hit / not found / already
  // active so the caller can surface a toast.
  function activateDevice(id: string, reservedSlots = 0): boolean {
    const device = devices.value.find((d) => d.id === id);
    if (!device || device.activatedAt !== null) return false;
    if (device.kind === "pc-gpu" && !computeShareEnabled.value) return false;
    if (activeSlotCount.value + reservedSlots >= MAX_DEVICES) return false;
    devices.value = devices.value.map((d) =>
      d.id === id
        ? { ...d, activatedAt: Date.now(), lastSettledAt: Date.now(), onlineHeartbeatAt: null, pendingDeactivate: false }
        : d,
    );
    persistAccountSnapshot();
    return true;
  }

  // Clears activatedAt + zeroes runtime telemetry so the device exits earnings
  // contribution while staying in inventory. Per spec the current-task reward
  // is forfeited (currentTask → null without dispatching its reward).
  function deactivateDevice(id: string) {
    devices.value = devices.value.map((d) =>
      d.id === id
        ? {
            ...d,
            activatedAt: null,
            pendingDeactivate: false,
            lastSettledAt: null,
            onlineHeartbeatAt: null,
            gpuUsage: 0,
            gpuTemp: 0,
            gpuPower: 0,
            vramUsed: 0,
            currentTask: null,
            todayEarnings: 0,
            todayEarningsNEX: 0,
          }
        : d,
    );
    persistAccountSnapshot();
  }

  // Sprint #146-1 supplement: graceful deactivation. Marks the device for
  // deactivation after its current task completes; tick() fires the actual
  // deactivate when it sees currentTask transition complete with
  // pendingDeactivate=true. If currentTask is already null, deactivate now.
  function scheduleDeactivation(id: string) {
    devices.value = devices.value.map((d) =>
      d.id === id
        ? d.currentTask === null
          ? {
              ...d,
              activatedAt: null,
              pendingDeactivate: false,
              lastSettledAt: null,
              onlineHeartbeatAt: null,
              gpuUsage: 0,
              gpuTemp: 0,
              gpuPower: 0,
              vramUsed: 0,
              todayEarnings: 0,
              todayEarningsNEX: 0,
            }
          : { ...d, pendingDeactivate: true }
        : d,
    );
    persistAccountSnapshot();
  }

  // ── Balance primitives (register/login/wallet use these) ──
  /**
   * 🔴 提现进入失败终态时把钱退回去(幂等)。
   *
   * 提现在提交那一刻就扣了款(applyDebit),所以任何「这笔最终没打出去」的终态
   * —— 驳回 / 地址无效 / 上链失败 / 已退款 —— 都必须把钱还给用户。
   * 全仓此前**没有任何退款实现**,而账单也不会被置为 failed:
   * 两个缺口分开看都像「反正 mock 里走不到」,合起来就是「钱扣了、单子废了、没人还」。
   * 退款与置账单失败必须在**同一处**完成,否则接后端时必然只做一半(审计明确点名)。
   *
   * 🔴 退的是两种币(2026-08-03 资金 P1):USDT 本金之外,用户勾选 NEX 抵扣时页面在提交前
   * 已 debitNex 真扣了 NEX —— 单据废了 = 网络费从没真付过,只退 USDT 不退 NEX 就是白烧。
   * 幂等键**必须拆两个**(USDT 用 refund:、NEX 用 refund-nex:):复用单键会让
   * 「USDT 退过 → NEX 因同键判已处理 → 永久跳过」。历史单 fee 是纯数字
   * (account-cloud 读盘会归一出 nexBurned:0,但内存态不保证都走过归一),
   * 故可选链取值且 >0 才退 —— undefined/0 = 本来无需退,绝不能被当成「退款失败」。
   *
   * 幂等靠 appliedRewardKeys(与赠金入账同一套):同一张单每种币各退一次。
   * 返回本次真正退了款的单号,供 App 层同步把账单行置 failed。
   */
  function refundFailedWithdrawals(): string[] {
    const FAILED: Withdrawal["status"][] = ["review-rejected", "address-invalid", "tx-failed", "refunded"];
    const done: string[] = [];
    for (const wd of withdrawals.value) {
      if (!FAILED.includes(wd.status)) continue;
      if (!(wd.amount > 0)) continue;
      // 🔴 复用 creditRewardBucketOnce,不要自己拼 user.value 的绝对值:
      // account-cloud 把余额当**增量计数器**做三方合并,直接写绝对值会被合并算回去
      // (实测:可提桶加上了、总余额纹丝不动 —— 一半生效比不生效更难查)。
      // 这个 action 同时加总余额与可提桶,且自带 appliedRewardKeys 幂等,正是退款要的语义。
      if (creditRewardBucketOnce("refund:" + wd.id, "withdrawable", wd.amount)) done.push(wd.id);
      // NEX 抵扣费退还:独立幂等键;usdt 参数位传 0、NEX 走第 4 参(方向搞反 = 把 NEX
      // 个数当美元退)。与 USDT 行互不阻塞:任一落盘失败,各自幂等键在下次调用重放补齐。
      const burnedNex = wd.fee?.nexBurned;
      if (Number.isFinite(burnedNex) && burnedNex > 0) {
        creditRewardBucketOnce("refund-nex:" + wd.id, "withdrawable", 0, burnedNex);
      }
    }
    return done;
  }

  /**
   * 🔴 四个资金原语:落盘失败必须让调用方看见(2026-08-04 R4「钱动了、账没记上」同族根治)。
   *
   * 原实现都是「改内存 → persistAccountSnapshot() → **丢弃返回值**」。落盘失败时磁盘还是
   * 旧值、内存已是新值 —— 刷新即回退,用户眼里就是「钱凭空回来 / 凭空消失」;而调用方按
   * 「一定成功」继续铸货、写账单、弹成功提示。修法直接沿用本文件既有范式(recordDeposit /
   * creditRewardBucketInternal):失败即 adoptAccountSnapshot(previousSnapshot) 把内存退回
   * 与磁盘一致的那一份,并报假。
   *
   * 🔴 成功路径逐字节等价:守卫、clamp、金额计算、赋值内容与写盘顺序一个字没改;新增的只有
   * 「失败时回滚 + 返回 false」这条原本不存在的分支。credit 两函数由 void 拓宽为 boolean —
   * 全部既有调用点都在语句位丢弃返回值,行为不变。
   */
  function creditBalance(amount: number): boolean {
    // NaN/Infinity/负数守卫(对齐 recordDeposit):脏 amount 会把余额污染成 NaN,
    // 此后一切 debit 检查恒过 = 无限钱(审计 P2-5)。
    if (!Number.isFinite(amount) || amount < 0) return false;
    const previousSnapshot = lastCloudSnapshot;
    const before = moneyValues();
    user.value = { ...user.value, usdtBalance: +(user.value.usdtBalance + amount).toFixed(2) };
    const applied = moneyDeltaSince(before);
    if (!persistAccountSnapshot()) {
      adoptAccountSnapshot(previousSnapshot);
      return false;
    }
    addMoneyApplied(applied);
    return true;
  }
  function debitBalance(amount: number): boolean {
    if (!Number.isFinite(amount) || amount < 0) return false;
    if (user.value.usdtBalance < amount) return false;
    const previousSnapshot = lastCloudSnapshot;
    const before = moneyValues();
    const nextUsdt = +(user.value.usdtBalance - amount).toFixed(2);
    // 维护不变量 withdrawableUsdt ≤ usdtBalance:花钱先消耗不可提部分(如充值本金),
    // 花穿后才吃可提收益,可提额度随之收敛到剩余总余额。缺此 clamp,提现门(submitWithdrawal
    // 只看 withdrawableUsdt)会放行超过总余额的提现 → usdtBalance 变负(凭空取钱,原 P0)。
    const buckets = withDefaultEarningBuckets(user.value).earningBuckets;
    user.value = {
      ...user.value,
      usdtBalance: nextUsdt,
      earningBuckets: { ...buckets, withdrawableUsdt: Math.min(buckets.withdrawableUsdt, nextUsdt) },
    };
    const applied = moneyDeltaSince(before);
    if (!persistAccountSnapshot()) {
      adoptAccountSnapshot(previousSnapshot);
      return false;
    }
    addMoneyApplied(applied);
    return true;
  }
  function creditNex(amount: number): boolean {
    // NaN/Infinity/负数守卫(对齐 creditBalance):脏 amount 会把 nexBalance 污染成 NaN,
    // 此后一切 debitNex 检查恒过 = 无限 NEX。
    if (!Number.isFinite(amount) || amount < 0) return false;
    const previousSnapshot = lastCloudSnapshot;
    const before = moneyValues();
    user.value = { ...user.value, nexBalance: +(user.value.nexBalance + amount).toFixed(2) };
    const applied = moneyDeltaSince(before);
    if (!persistAccountSnapshot()) {
      adoptAccountSnapshot(previousSnapshot);
      return false;
    }
    addMoneyApplied(applied);
    return true;
  }
  function debitNex(amount: number): boolean {
    // 对齐 debitBalance:负数 amount 会让 `bal < amount` 恒 false 而反向增币,NaN 污染余额。
    if (!Number.isFinite(amount) || amount < 0) return false;
    if (user.value.nexBalance < amount) return false;
    const previousSnapshot = lastCloudSnapshot;
    const before = moneyValues();
    user.value = { ...user.value, nexBalance: +(user.value.nexBalance - amount).toFixed(2) };
    const applied = moneyDeltaSince(before);
    if (!persistAccountSnapshot()) {
      adoptAccountSnapshot(previousSnapshot);
      return false;
    }
    addMoneyApplied(applied);
    return true;
  }

  /**
   * 🔴 本标签页自己动过的资金累计(**合并前**的本地增量之和,单调累加、永不清零)。
   *
   * 为什么需要它:account-cloud 把余额当计数器做三路合并(delta = next − base,见
   * ADDITIVE_NUMBER_KEYS),而 base 是本页的 lastCloudSnapshot —— 它在 capture 之后
   * 会**吸收别的标签页的扣款**(每次 persist 都 adopt 合并结果)。此时若冲正照旧写
   * 「扣款前的绝对值」,delta 就等于「我的那笔 + 别人的那笔」,别人那笔被我一起"退"给了
   * 用户:两个标签页各扣一次、各回滚一次,余额比开始时还多(审计实测 $100 → $130,凭空造钱)。
   * 单页场景两者恒等,所以这条洞在单实例下永远测不出来 —— 必须双实例并发靶。
   *
   * 为什么是一个单调计数器而不是日志:冲正只需要「我自己动了多少」这一个差值,
   * 快照记下自己那一刻的读数即可(嵌套 capture 各记各的),无需保留每笔明细、也就没有
   * 清理与生命周期问题。别的标签页写了多少完全不进这个数,所以它天生与并发无关。
   */
  const moneyApplied: MoneyDelta = { usdtBalance: 0, nexBalance: 0, withdrawableUsdt: 0 };
  /** 当前三元组(只读)。算本地增量与写快照共用一处,免得两边各读各的读出分歧。 */
  function moneyValues(): MoneyDelta {
    const u = withDefaultEarningBuckets(user.value);
    return { usdtBalance: u.usdtBalance, nexBalance: u.nexBalance, withdrawableUsdt: u.earningBuckets.withdrawableUsdt };
  }
  /**
   * 本地增量 = 现在 − before。🔴 **必须在 persistAccountSnapshot 之前取**:落盘会把
   * 合并结果 adopt 回内存,之后再算就把别的标签页的增量也算进"我自己动的"里。
   */
  function moneyDeltaSince(before: MoneyDelta): MoneyDelta {
    const now = moneyValues();
    return {
      usdtBalance: +(now.usdtBalance - before.usdtBalance).toFixed(6),
      nexBalance: +(now.nexBalance - before.nexBalance).toFixed(6),
      withdrawableUsdt: +(now.withdrawableUsdt - before.withdrawableUsdt).toFixed(6),
    };
  }
  /** 只在**落盘成功后**记账:失败路径已 adopt 回滚,本地等于什么都没动过。 */
  function addMoneyApplied(d: MoneyDelta) {
    moneyApplied.usdtBalance = +(moneyApplied.usdtBalance + d.usdtBalance).toFixed(6);
    moneyApplied.nexBalance = +(moneyApplied.nexBalance + d.nexBalance).toFixed(6);
    moneyApplied.withdrawableUsdt = +(moneyApplied.withdrawableUsdt + d.withdrawableUsdt).toFixed(6);
  }

  /** 资金三元组快照 —— 冲正(退款)唯一正确的基准。 */
  function captureMoney(): MoneySnapshot {
    return { ...moneyValues(), applied: { ...moneyApplied } };
  }

  /**
   * 🔴 精确冲正:把资金三元组**还原**到扣款前那份快照,而不是反向调一次 creditBalance。
   *
   * 为什么非有不可:debitBalance 会把 withdrawableUsdt clamp 到扣款后的总余额,而
   * creditBalance 只加总余额、**不还原可提额度** —— 「扣款 → 后续失败 → 退款」走一遍,
   * 用户的可提额度就被永久压低一次(审计场景:可提 $8000 的账号买一次创世节点失败退款后
   * 只剩 $1,钱回来了但提不出去)。退款语义必须与扣款语义对称,对称的唯一实现是还原快照。
   *
   * 🔴 **按增量回滚,不写绝对值**(2026-08-04 R5 并发靶):合并层把余额当计数器,写绝对值时
   * delta = 绝对值 − 本页 base,而 base 在 capture 之后会吸收别的标签页的扣款(见
   * moneyApplied 头注)—— 那部分会被这一笔冲正一起"还"给用户。改成「从**当前**值里减去
   * 我自己动过的那部分」后,delta 恒等于我那一笔的反向增量,别人的改动一分不动。
   * 与提现落盘重放同一条纪律:先取现状,再基于它推导增量(见 submitWithdrawal 重放段)。
   *
   * 副作用:期间本页发生的**别的**入账(挖矿结算 / 奖励)不再被这一笔冲正抹平 —— 它们不在
   * moneyApplied 的这段差值里(那些路径不走这四个原语),写绝对值时则会被一起回退。
   */
  function restoreMoney(snap: MoneySnapshot): boolean {
    if (![snap.usdtBalance, snap.nexBalance, snap.withdrawableUsdt].every((v) => Number.isFinite(v) && v >= 0)) return false;
    // 「我自己动了多少」= 现在的读数 − 快照那一刻的读数。别的标签页写多少都不进这个数。
    const owedUsdt = moneyApplied.usdtBalance - snap.applied.usdtBalance;
    const owedNex = moneyApplied.nexBalance - snap.applied.nexBalance;
    const owedWithdrawable = moneyApplied.withdrawableUsdt - snap.applied.withdrawableUsdt;
    // 一分钱都没动过(第一腿就落盘失败、它自己已经 adopt 回滚了)→ 无事可做,直接成功。
    // 🔴 不能在这里空转写一次盘:storage 正坏着,那一次写必然失败,于是「什么都没发生」
    // 会被报成「回滚失败 = 钱卡住了」,凭空吓用户一跳并污染待对账队列。
    if (owedUsdt === 0 && owedNex === 0 && owedWithdrawable === 0) return true;
    const previousSnapshot = lastCloudSnapshot;
    const before = moneyValues();
    const target = {
      usdtBalance: +(before.usdtBalance - owedUsdt).toFixed(2),
      nexBalance: +(before.nexBalance - owedNex).toFixed(2),
      withdrawableUsdt: +(before.withdrawableUsdt - owedWithdrawable).toFixed(2),
    };
    if (!Object.values(target).every((v) => Number.isFinite(v))) return false;
    const current = withDefaultEarningBuckets(user.value);
    user.value = {
      ...current,
      usdtBalance: target.usdtBalance,
      nexBalance: target.nexBalance,
      earningBuckets: { ...current.earningBuckets, withdrawableUsdt: target.withdrawableUsdt },
    };
    const applied = moneyDeltaSince(before);
    if (!persistAccountSnapshot()) {
      adoptAccountSnapshot(previousSnapshot);
      return false;
    }
    addMoneyApplied(applied);
    return true;
  }
  /**
   * 核销创世邀请码(规格 FEAT-GEN11)。per-account:随 account-cloud 快照走,
   * 切号/新注册不继承(设备级存储会造成资格门跨账号旁路,审计 P1)。
   *
   * 由「只跑格式正则」改为查码表 + 三态校验:格式对但从未发放的串一律拒(旧缺陷本体 ——
   * 任何 NEXGRID-OG-XXXX 都通过、同一码可被无限账号使用)。
   * 真后台 = POST /api/genesis/invite/redeem(server 事务核销,一码一用由事务保证)。
   */
  async function setGenesisInviteCode(raw: string): Promise<GenesisInviteRedeemResult> {
    const result = await redeemGenesisInviteCode(raw);
    if (result.ok) {
      // Display cache only. Eligibility and one-time redemption are enforced by
      // the server transaction and are rechecked by every Genesis mutation.
      user.value = { ...user.value, genesisInviteCode: result.code };
    }
    return result;
  }

  function recordDeposit(amount: number): boolean {
    // Input validation mirrors source: reject NaN/±Infinity/≤0/absurd (>1e9).
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) return false;
    // 落盘结果必须接:此前丢弃返回值无条件 return true,调用方(三条入金轨的 settle)
    // 据此认为钱已入账并继续写账单/改状态,而落盘失败时余额其实被 adopt 回滚了 ——
    // 「返回成功但钱没加」。对齐 creditRewardBucketInternal 的既有范式:失败即回滚 + 报假。
    //
    // 🔴 **刻意不进 moneyApplied 账**(2026-08-04 对抗审计 P2-3,钉死这条不变量):
    // 四个资金原语都会 addMoneyApplied,而入金**不能**——moneyApplied 是 restoreMoney 的
    // 冲正基准,入金一旦记进去,别处一次冲正就会把用户**真的转进来的钱**一起退掉。
    // 入金是外部已到账的事实,不属于「本标签页动过的钱」那本账。
    // 下一个照着 creditBalance 给这里补 addMoneyApplied 的人,会造出一个很难查的丢钱路径。
    const previousSnapshot = lastCloudSnapshot;
    user.value = {
      ...user.value,
      usdtBalance: +(user.value.usdtBalance + amount).toFixed(2),
      cumulativeDepositUsdt: +(user.value.cumulativeDepositUsdt + amount).toFixed(2),
    };
    if (!persistAccountSnapshot()) {
      adoptAccountSnapshot(previousSnapshot);
      return false;
    }
    return true;
  }
  function creditRewardBucket(route: EarningBucketRoute, usdt: number, nex = 0): boolean {
    return creditRewardBucketInternal(route, usdt, nex, null);
  }

  /**
   * Registration/reward recovery path. The receipt key and balance delta live
   * in the same account-cloud snapshot, so replay after a crash is a no-op.
   */
  function creditRewardBucketOnce(idempotencyKey: string, route: EarningBucketRoute, usdt: number, nex = 0): boolean {
    const key = idempotencyKey.trim();
    if (!key) return false;
    return creditRewardBucketInternal(route, usdt, nex, key);
  }

  function creditRewardBucketInternal(
    route: EarningBucketRoute,
    usdt: number,
    nex: number,
    idempotencyKey: string | null,
  ): boolean {
    if (remoteApiEnabled) return false;
    if (!Number.isFinite(usdt) || !Number.isFinite(nex) || usdt < 0 || nex < 0) return false;
    if (route === "no_issue") return true;
    if (idempotencyKey) {
      const stored = readAccountSnapshot(accountKey.value);
      if (stored?.user.appliedRewardKeys?.[idempotencyKey]) {
        adoptAccountSnapshot(stored);
        return true;
      }
    }
    const previousSnapshot = lastCloudSnapshot;
    const currentUser = withDefaultEarningBuckets(user.value);
    if (idempotencyKey && currentUser.appliedRewardKeys?.[idempotencyKey]) return true;
    const buckets = currentUser.earningBuckets;
    const nextBuckets = { ...buckets, lastBucketedAt: Date.now() };
    const nextUser: UserState = {
      ...currentUser,
      earningBuckets: nextBuckets,
      appliedRewardKeys: idempotencyKey
        ? { ...currentUser.appliedRewardKeys, [idempotencyKey]: true }
        : currentUser.appliedRewardKeys,
    };
    if (route === "withdrawable") {
      nextBuckets.withdrawableUsdt = +(nextBuckets.withdrawableUsdt + usdt).toFixed(2);
      nextUser.usdtBalance = +(nextUser.usdtBalance + usdt).toFixed(2);
      nextUser.nexBalance = +(nextUser.nexBalance + nex).toFixed(2);
    } else if (route === "pending_review") {
      nextBuckets.pendingReviewUsdt = +(nextBuckets.pendingReviewUsdt + usdt).toFixed(2);
      nextBuckets.lockedNex = +(nextBuckets.lockedNex + nex).toFixed(2);
    } else {
      nextBuckets.bonusLockedUsdt = +(nextBuckets.bonusLockedUsdt + usdt).toFixed(2);
      nextBuckets.lockedNex = +(nextBuckets.lockedNex + nex).toFixed(2);
    }
    // R1 台账现由服务端持有,客户端 appendLedgerEntry 是恒 false 的过渡空壳 ——
    // 与 settle 路径同形 fire-and-forget,不得再拿它的返回值判死:
    // 否则 mock 模式下 held 两路由的入桶(风控标记账号的赠金/奖励)无条件失败
    // (z1 判决包 B8,register 重试链实锤)。
    if (route === "pending_review" || route === "bonus_locked") {
      appendLedgerEntry(accountKey.value,
        evaluateAccountCluster(accountKey.value).clusterId,
        route,
        usdt,
        nex,
        idempotencyKey ?? undefined,
      );
    }
    user.value = nextUser;
    if (!persistAccountSnapshot()) {
      adoptAccountSnapshot(previousSnapshot);
      return false;
    }
    return true;
  }

  // D5: create the withdrawal exclusively through the real backend transaction.
  async function submitWithdrawal(
    amount: number,
    network: Withdrawal["network"],
    address: string,
    fee: WithdrawalFeeSnapshot,
    offsetWithNex: boolean,
    policyVersion: string,
    idempotencyKey: string,
    riskRoute: WithdrawalRiskRoute = "pass",
    riskReasons: string[] = [],
    // FEAT-WD01a:快车道留痕随单落盘 —— 只算不存的话,事后审计与客服都还原不出
    // 「这单当时免了哪几道闸」,等于没做。与 riskReasons 同源同去处。
    fastLaneApplied = false,
    waivedGates: string[] = [],
  ): Promise<string | null> {
    // D5 real boundary: the backend re-prices the request under policyVersion and
    // commits wallet reservation, optional NEX burn, order and ledgers atomically.
    // The local store only mirrors the returned order for rendering; it never
    // debits balances or chooses a fee bucket.
    const submission = await withdrawalApi.submit(
      amount,
      network,
      address,
      policyVersion,
      offsetWithNex,
      idempotencyKey,
    );
    const canonical = toCanonicalWithdrawal(submission, address);
    withdrawals.value = [canonical, ...withdrawals.value.filter((item) => item.id !== canonical.id)];
    // 🔴 建单成功**必须落盘**。此前这里只改内存:刷新一次单据就没了,而它同时是
    // 「今日提了几笔」的唯一凭据(日限预检)与「有没有在途单」的唯一凭据(换址闸)——
    // 按一下 F5 两道闸一起失效(z2 R1 独立审计实测)。本函数之外没有兜底:
    // 全文件的周期性落盘在 remote 模式下早退,到账推进要等几小时后到点才写盘。
    //
    // 🔴 落盘失败要把这一单**放回内存**,而不是任其消失。
    //
    // 这里必须显式做,不能只写注释:`persistAccountSnapshot()` 内部**无条件**
    // `adoptAccountSnapshot(result.snapshot)`,而 account-cloud 在写失败时返回的
    // `snapshot` 是**磁盘上的旧行**(`stored ?? merged`)—— 于是刚建的这一单会被
    // 静默地从内存抹掉。R2 独立审计两路各自注入实测复现;此前这段注释写的是
    // 「失败不回滚」,与实际行为完全相反(本包第三次「注释声称了不存在的行为」)。
    //
    // 为什么是放回而不是接受回滚:单据是**服务端已经创建**的既成事实,抹掉它会让
    // 用户跳到追踪页看见「查无此单」,而钱已经动了;这一单也会同时退出日限计数与
    // 在途判定,连带把「在途期间禁止更换收款地址」那道闸一起架空。
    // 落盘失败只是「刷新后会丢」,是降级;丢单是错乱,后者严重得多。
    // 代价:内存有、磁盘无,直到下一次成功落盘补上。真闸在服务端,不会因此放行超额提现。
    if (!persistAccountSnapshot()) {
      withdrawals.value = [canonical, ...withdrawals.value.filter((item) => item.id !== canonical.id)];
      // 🔴🔴 基准也要一起补,否则「放回内存」只活到下一次资金写为止。
      // 兄弟资金原语(creditBalance / debitBalance / 奖励入账…)失败时一律
      // `adoptAccountSnapshot(previousSnapshot)`,而 previousSnapshot 就是这个
      // lastCloudSnapshot —— 它此刻还是**磁盘上那份不含本单的旧行**,回滚一次就把单又抹掉。
      // 而触发它的条件(存储写不进去)与触发本分支的条件是**同一个**,所以必然连着发生。
      // R3 独立审计在沙箱复现,我在真 store 上复验:放回=true → creditBalance 失败回滚 → 仍在=false。
      lastCloudSnapshot = { ...lastCloudSnapshot, withdrawals: withdrawals.value };
    }
    // Client-side risk ledger (first-withdrawal mark + address use) feeds the local
    // pre-check engine; the server keeps its own authoritative copy.
    commitWithdrawal(accountKey.value, network, address);
    return canonical.id;
  }

  /**
   * FEAT-WD01b 到账推进:到点把 pass 路由单据补齐到 confirmed。
   *
   * 由 App 层在前台轮询 + onShow 调用 —— 关 App 三天再打开时,一次调用就补齐,
   * 不按天数循环推进(判定只看「now ≥ 预计到账」,与离线多久无关)。
   * 幂等性在纯函数里:推进过的单再进来返回 null,这里 null 就不写盘、不通知。
   *
   * 🔴 只改状态与到账时间,**不碰余额**:钱在提交时已扣,推进不是记账事件。
   * PROD:整块删掉,状态改由 GET /api/withdrawals/:id(或 SSE)权威回传。
   */
  /**
   * 到点推进,返回**本次真正推进了哪几笔的单号**(空数组 = 没有可推进的)。
   * 🔴 返回 boolean 不够:推进是全表扫,而调用方要按单号去结算对应的账单行 ——
   * 只回一个 true 会让调用方退回去问「最新一笔是谁」,于是结算结到别的单上
   * (独立验收实测:到账那笔账单永远处理中,还在处理的那笔反被标成已入账)。
   */
  function advanceWithdrawalArrival(): string[] {
    // 🔴 全表扫:每一笔各自到点各自推进。单条版只看最新一笔,
    // 前面那笔到点了也永远推不动(列表化后这个洞自动消失)。
    const now = mockServerNow();
    const prev = withdrawals.value;
    // 🔴 远端模式交给 advanceArrival 自己拒绝(必填 ctx),不在这里 early-return:
    // 判据留在纯函数里,才有一个能 node 直跑的落点(见 remote-authority-simulation.test.mjs)。
    const next = prev.map((w) => advanceArrival(w, now, { serverAuthoritative: remoteApiEnabled }) ?? w);
    const advancedIds = next.filter((w, i) => w !== prev[i]).map((w) => w.id);
    if (!advancedIds.length) return [];
    withdrawals.value = next;
    // 诚实返回落盘结果:落盘失败时内存说已到账、磁盘还是处理中,而内存一旦置 confirmed
    // 后续轮询就恒返回 false 永不重试(只有整页重载才自愈)。失败即回滚内存,下个 tick 再试。
    if (!persistAccountSnapshot()) {
      withdrawals.value = prev;
      // 🔴🔴 与 refreshRemoteWithdrawals / submitWithdrawal 同形:基准一起还原。
      // 写失败时 persistAccountSnapshot 内部已把 lastCloudSnapshot 换成磁盘旧行,
      // 只还原内存 = 下一次资金写失败回滚时按被污染的基准把单据抹掉(硬规则:修一处补全同形)。
      lastCloudSnapshot = { ...lastCloudSnapshot, withdrawals: withdrawals.value };
      return [];
    }
    return advancedIds;
  }

  /**
   * 远端模式的**替代品**:把服务端单据状态镜像回本地(GET /api/withdrawals/:id,
   * PRD §9.11f)。没有这一步,单纯关掉本地推进会把一个缺陷换成另一个 ——
   * 在途单永不终结 → occupiesWithdrawalSlot 恒真 → 收款地址换绑入口
   * (payout-address.hasInFlightWithdrawalOn)与「同时只能有一笔」的下一笔提现
   * **永久**被拦,账单行也永远停在处理中。
   *
   * 只读不裁决:状态、到账时刻全取服务端值;拉不到就保持原样(下一拍再试),
   * 绝不因为「问不到」就自己判一个。返回本次真正变动的单号,与
   * advanceWithdrawalArrival 同形状,供 App 层按单号结算对应账单行。
   */
  async function refreshRemoteWithdrawals(): Promise<string[]> {
    if (!remoteApiEnabled) return [];
    // 🔴 在途守卫(2026-08-11 R2 审计):5s 轮询与 onShow 都 fire-and-forget 调本函数,
    // 而单次请求可以跑到 12s(api-client 默认 timeout)。没有这道闸时两拍会真叠加,
    // 后发的先回、先发的后回,而 mirroredAt 记的是**收到响应的时刻** ——
    // 迟到的旧结论会带着更大的时间戳赢下合并裁决,把已到账的单退回冻结。
    // 闸放在这里(而不是给 mirroredAt 找一个服务端时刻)是因为服务端契约里没有那个字段;
    // 已写进后端交接书:若能下发服务端结论时刻,这里应改用它。
    if (mirrorInFlight) return [];
    mirrorInFlight = true;
    try {
      return await runRemoteWithdrawalMirror();
    } finally {
      mirrorInFlight = false;
    }
  }

  async function runRemoteWithdrawalMirror(): Promise<string[]> {
    const targets = inFlightWithdrawals.value;
    if (!targets.length) return [];
    const mirrors = await Promise.all(targets.map((w) =>
      withdrawalApi.get(w.id).catch(() => null)));
    const patches = new Map<string, Withdrawal>();
    targets.forEach((target, i) => {
      const remote = mirrors[i];
      if (!remote) return;
      // 🔴 基底取 **await 之后的当前行**,不是发请求那一刻捕获的那份(R2 审计):
      // `...w` 展开陈旧整行会把这段时间里别处(另一个 tab 合并回来、或上一拍)写入的
      // confirmedAt / terminalReason / retriable 一并抹掉,而且抹掉的那一版还带着更大的
      // mirroredAt,连磁盘一起覆盖。单据一进终态就不再被回查 —— 抹掉即永久。
      const w = withdrawals.value.find((row) => row.id === target.id);
      if (!w) return; // 这段时间里单据没了(换账号 / 被合并掉)——本拍的结论不再适用
      // 🔴 判「变没变」要把**三个字段**都算上,不能只看 status:状态没动、只有终态原因
      // 或可重试判定变了的那一拍,只比 status 会被整个丢掉。
      // 这样写是为了**不依赖一个没写进契约的服务端假设**(「原因一定和终态状态同一个响应发」)。
      // ⚠️ 但它救不了终态:单据一进终态就离开 inFlightWithdrawals,之后根本不会再被回查 ——
      // 服务端晚发的原因确实补不回来。那一半的责任在服务端,已写进后端交接书 U-9 让后端同发。
      // 本判据实际覆盖的是仍在途的单(如 frozen 被人工改写结论)。
      const reasonChanged = remote.terminalReason !== null && remote.terminalReason !== w.terminalReason;
      const retriableChanged = remote.retriable !== null && remote.retriable !== w.retriable;
      if (remote.status === w.status && !reasonChanged && !retriableChanged) return;
      patches.set(w.id, {
        ...w,
        status: remote.status,
        // 🔴 盖上「这份结论是什么时候从服务端问来的」。没有它,三路合并在平局时只能留磁盘旧行,
        // 上面那套判据就全是空转(独立审计实测:同状态改原因 100% 丢失)。
        // 用本机时钟即可:它只在**本机自己的两份快照之间**比大小,不与服务端时间对齐。
        mirroredAt: Date.now(),
        // 服务端没给到账时刻就不编一个:仍按「到点即已到」记 estimatedCompletion,
        // 与 mock 推进同口径(见 advanceArrival 的 confirmedAt 注释)。
        ...(remote.status === "confirmed"
          ? { confirmedAt: remote.confirmedAt ?? w.estimatedCompletion }
          : {}),
        // 🔴 `null`(没给)与 `false`/具体码是两回事:没给就**保留已存的旧值**,不覆盖成空。
        // 覆盖的话,一次「服务端这拍没带原因」就把客服唯一能查的那条线索抹了。
        ...(remote.terminalReason !== null ? { terminalReason: remote.terminalReason } : {}),
        ...(remote.retriable !== null ? { retriable: remote.retriable } : {}),
      });
    });
    if (!patches.size) return [];
    const prev = withdrawals.value;
    withdrawals.value = prev.map((w) => patches.get(w.id) ?? w);
    // 落盘失败即回滚内存 —— 与 advanceWithdrawalArrival 同一套「诚实返回落盘结果」。
    if (!persistAccountSnapshot()) {
      withdrawals.value = prev;
      // 🔴🔴 基准也要一起还原(R2 审计;submitWithdrawal 早就为**同一个坑**补过这一行)。
      // persistAccountSnapshot 无条件 adoptAccountSnapshot(result.snapshot),而写失败时
      // 那份 snapshot 是**磁盘旧行** —— 于是 lastCloudSnapshot 已被改写。只还原
      // withdrawals.value 的话,下一次任意资金原语写失败时会 adopt 这份被污染的基准,
      // 把单据从内存里抹掉:追踪页「查无此单」,而服务端已经扣款持单。
      lastCloudSnapshot = { ...lastCloudSnapshot, withdrawals: withdrawals.value };
      return [];
    }
    return [...patches.keys()];
  }

  // ⚠️ DEV/DEMO-ONLY(SPEC-7 收编): 仅 pass 路由的提现可由 demo 驱动推进主链
  // 状态;manual/delay/freeze 的状态推进属于服务端/人工处置,client 永不推进。
  // PRODUCTION: status comes from server webhook/SSE/polling only.
  function _devAdvanceWithdrawal() {
    if (import.meta.env.PROD) return; // demo-only 状态推进,store 层二层 guard(硬规则5)
    // 🔴 PROD 构建 ≠ 远端模式:remote 是默认档(runtime-config.ts),dev 构建里这个
    // demo 驱动照样在线,一按就把服务端单据在本地改成已到账。两条闸各挡一面。
    if (remoteApiEnabled) return;
    const wd = latestWithdrawal.value;
    if (!wd) return;
    const pos = withdrawals.value.findIndex((w) => w.id === wd.id);
    if (pos < 0) return;
    if (wd.riskRoute && wd.riskRoute !== "pass") return;
    const order: Withdrawal["status"][] = [
      "submitted",
      "review-passed",
      "processing",
      "sent",
      "confirmed",
    ];
    const idx = order.indexOf(wd.status);
    if (idx === -1 || idx >= order.length - 1) return;
    const nextStatus = order[idx + 1];
    // demo 手动推到 confirmed 时也要记到账时间,否则追踪页的「实际到账」是空的
    // (真实推进路径在 advanceWithdrawalArrival,两条路必须产出同形状的单)。
    const updated: Withdrawal =
      nextStatus === "confirmed" ? { ...wd, status: nextStatus, confirmedAt: wd.estimatedCompletion } : { ...wd, status: nextStatus };
    withdrawals.value = withdrawals.value.map((w, i) => (i === pos ? updated : w));
    persistAccountSnapshot();
  }

  return {
    accountKey, entrySurface, accountCloudUpdatedAt,
    user, devices, visibleDevices, slotDevices, activeSlotCount, myTotalHashrateAt, earnings, global,
    withdrawals, latestWithdrawal, inFlightWithdrawals, primaryWithdrawal, miningPaused,
    bindAccount, persistAccountSnapshot,
    tick, settle, setPhoneRuntime, applyPhoneCalibration, interruptAllTasks, resumeMining,
    creditBalance, debitBalance, creditNex, debitNex, captureMoney, restoreMoney,
    recordDeposit, setGenesisInviteCode, creditRewardBucket, creditRewardBucketOnce,
    submitWithdrawal, advanceWithdrawalArrival, refreshRemoteWithdrawals, refundFailedWithdrawals,
    _devAdvanceWithdrawal, _devGrantManualRelease,
    addDevice, activateDevice, deactivateDevice, scheduleDeactivation, connectComputeShareDevice,
  };
});
