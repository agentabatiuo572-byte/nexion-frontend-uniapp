import { defineStore } from "pinia";
import { PLATFORM_UTC_OFFSET_HOURS } from "./withdrawal-eligibility-core";
import { computed, ref } from "vue";
import type { Device, CompletedTask, UserState, EarningsState, GlobalStats, Withdrawal, WithdrawalFeeSnapshot, EarningBucketRoute } from "./types";
import type { DeviceKind } from "./types";
import { isWithdrawalFeeSnapshotValid, type WithdrawNetworkKey } from "@/store/nex-faucet";
import { resolveActivePhase } from "@/store/product-phase";
import { ONE_DAY_MS, makeInitialDevices, createDevice, backfillDeviceEconomics, MAX_DEVICES, type CreateDeviceOptions } from "./device-types";
import { pickRandomTask } from "@/mock/tasks";
import { isDegradable, getEfficiency, getMonthsOwned } from "./device-lifecycle";
import { interruptInfo } from "./interrupt";
import { continuityFactor, thermalFactor, isDeviceOnline } from "@/lib/hashpower";
import { getCarrier, type Carrier } from "@/lib/carrier";
import { claimGenesisInviteCode, redeemedInviteCodeOf, type GenesisInviteRedeemResult } from "./genesis-invite";
import { getEntrySurface, type EntrySurface } from "@/lib/entry-surface";
import { matchGpuTier } from "@/lib/gpu-tiers";
import { FLEET_DEVICES } from "@/lib/platform-stats";
import { useConfig, currentNetworkConfirmFeeUsd } from "@/store/config";
import { evaluateAccountCluster } from "@/store/risk-cluster";
import {
  appendLedgerEntry,
  evaluateAttestRelease,
  hasReleaseEffect,
  _devGrantManualRelease as _devGrantManualReleaseLedger,
  type ReleaseOutcome,
} from "@/store/earning-release";
import { markWithdrawn, recordAttestation, recordWithdrawAddressUse } from "@/store/risk-identity";
import { advanceArrival, estimateArrivalAt, occupiesWithdrawalSlot } from "@/store/withdrawal-arrival-core";
import { NEW_ADDRESS_LARGE_AMOUNT_USDT } from "@/store/wallet-pairing-core";
import { CLAIM_SETTLE_MS, claimWithdrawSlot, releaseWithdrawSlot } from "@/store/withdraw-daily-count";
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

// 提现单网络标识 → 费率配置键(与 wallet-withdraw.vue 的 NETWORK_FEE_KEY 同名同表,
// server 侧做同一转换)。费用快照交叉核对(P1-A)按此从权威 map 取当前网络的费值。
const NETWORK_FEE_KEY: Record<Withdrawal["network"], WithdrawNetworkKey> = {
  "USDT-TRC20": "trc20",
  "USDT-BEP20": "bep20",
  "USDT-ERC20": "erc20",
};

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

function createInitialGlobal(): GlobalStats {
  return {
    activeDevices: FLEET_DEVICES,
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
  const global = ref<GlobalStats>(createInitialGlobal());
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
  const cfg = useConfig();
  const computeShareEnabled = computed(() => cfg.isEnabled("computeShareEnabled"));
  const slotDevices = computed(() =>
    computeShareEnabled.value ? devices.value : devices.value.filter((d) => d.kind !== "pc-gpu"),
  );
  const visibleDevices = slotDevices;
  // Slot authority must count hidden active pc-gpu devices too. When the PC
  // share flag is off, UI hides those devices, but they still reserve backend
  // capacity; otherwise closing/reopening the flag can push the account past 6.
  const activeSlotCount = computed(() => devices.value.filter((d) => d.activatedAt !== null).length);
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
    global.value = {
      ...global.value,
      activeDevices: Math.min(FLEET_DEVICES + 24, Math.max(FLEET_DEVICES - 24, nextDevices)),
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

    const nextTodayUSD = +(earnings.value.today + positiveUsdDelta).toFixed(2);
    const nextTodayNEX = +(earnings.value.todayNEX + positiveNexDelta).toFixed(2);

    devices.value = nextDevices;
    earnings.value = {
      ...earnings.value,
      today: nextTodayUSD,
      todayNEX: nextTodayNEX,
      thisWeek: +(earnings.value.thisWeek + positiveUsdDelta).toFixed(2),
      thisMonth: +(earnings.value.thisMonth + positiveUsdDelta).toFixed(2),
      total: +(earnings.value.total + positiveUsdDelta).toFixed(2),
    };
    const routedUsd = +positiveUsdDelta.toFixed(2);
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
  function setGenesisInviteCode(raw: string): GenesisInviteRedeemResult {
    // 异常3:本账号已持码 → 拒绝;**已持有的码不受影响**(不覆盖、不释放),所以这一问
    // 必须排在占码之前 —— 排在后面等于先把新码占掉再拒,新码白白作废。
    // 问码表(单源 + 每次现读磁盘),不问可能陈旧的 user.value:另一个标签页刚核销过时,
    // 本页内存副本还是「没持码」,照它放行就能让同一个账号占掉第二个码。
    if (redeemedInviteCodeOf(accountKey.value) !== null) return { ok: false, reason: "already-held" };
    const claim = claimGenesisInviteCode(raw, accountKey.value);
    if (!claim.ok) return claim;
    const previousSnapshot = lastCloudSnapshot;
    user.value = { ...user.value, genesisInviteCode: claim.code };
    if (!persistAccountSnapshot()) {
      // 码已占、凭证没落到账号上 = 用户永久失去一个限量凭证。整笔退回,报失败。
      adoptAccountSnapshot(previousSnapshot);
      claim.rollback();
      return { ok: false, reason: "failed" };
    }
    return { ok: true, code: claim.code };
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
    // R1: 非可提的赠金也必须记台账分录,否则释放引擎(attest/manual)永远放不出它。
    if (route === "pending_review" || route === "bonus_locked") {
      const ledgerWritten = appendLedgerEntry(accountKey.value,
        evaluateAccountCluster(accountKey.value).clusterId,
        route,
        usdt,
        nex,
        idempotencyKey ?? undefined,
      );
      if (!ledgerWritten) return false;
    }
    user.value = nextUser;
    if (!persistAccountSnapshot()) {
      adoptAccountSnapshot(previousSnapshot);
      return false;
    }
    return true;
  }

  // ⚠️ MOCK-ONLY: withdrawal ID, fee, ETA, status transitions all client-side.
  // PRODUCTION: POST /api/withdrawals → server returns full withdrawal record
  // with authoritative id/fee/ETA in ONE atomic tx (debits balance + queues
  // on-chain tx + writes bill row + reserves fee). Status via SSE/polling
  // GET /api/withdrawals/:id. Returns null on insufficient funds (atomic debit
  // fails) so caller surfaces an error toast. Ported from index.ts submitWithdrawal
  // (Round 7 P0 fix: now debits balance — previously balance stayed full, an
  // infinite-mint vector).
  async function submitWithdrawal(
    amount: number,
    network: Withdrawal["network"],
    address: string,
    fee: WithdrawalFeeSnapshot,
    offsetWithNex: boolean,
    riskRoute: WithdrawalRiskRoute = "pass",
    riskReasons: string[] = [],
    // FEAT-WD01a:快车道留痕随单落盘 —— 只算不存的话,事后审计与客服都还原不出
    // 「这单当时免了哪几道闸」,等于没做。与 riskReasons 同源同去处。
    fastLaneApplied = false,
    waivedGates: string[] = [],
  ): Promise<string | null> {
    // SPEC-7 FEAT-RISK03: reject 路由禁止扣款建单;freeze/manual/delay 建单进
    // 对应队列(资金占用),状态由服务端/人工推进,client 不推进。
    if (riskRoute === "reject") return null;
    // 金额有效性守卫(对齐 debitBalance):NaN/±Infinity/≤0 一律拒 —— 负数会让下方
    // usdtBalance - amount 反向加钱,NaN 污染余额为 NaN 后一切校验恒过(无限钱)。
    if (!Number.isFinite(amount) || amount <= 0) return null;
    // 🔴 FEAT-WD02 费用快照复验(mock 同构 server 边界;PROD = server 以权威费率重算并拒不一致单):
    //  ① 意图守恒 —— offsetWithNex=false 时 nexBurned 必须为 0(无意图永不烧 NEX,规格 ③);
    //  ② 等式 |actualFeeUsd − max(0, networkConfirmUsd − nexBurned×offsetRate)| ≤ 0.0001;
    //  ③ 权威交叉核对(2026-08-03 资金 P1)—— 快照 networkConfirmUsd 必须与权威配置里
    //    当前网络的费值一致(容差同 ②)。只校 ①② 时任意自洽三元组(如全 0)一路放行 =
    //    客户端改配置即可 $0 费提现。权威值走 currentNetworkConfirmFeeUsd() 纯函数单源,
    //    fail-closed(配置 sync 失败 / 超值域 → null → 拒单,禁回退种子值);network 派生自
    //    绑定关系(pairing.pairedNetwork),不是用户表单可改的输入;本校验只在提交这一刻
    //    跑一次,不重放存量单 —— 历史单不受影响。
    // offsetRate 按提交时点 phase 派发(§13.4 权威,全 phase $0.40)。取值必须走
    // resolveActivePhase —— 与页面报价(use-product-phase)同一条解析路径:pin 优先、
    // 否则按注册月龄派生。曾在此直取时间派生 phase,pin 态下与页面报价分叉(审查 P2-2)。
    // 拼装错/过期报价一律 fail-closed 拒单。
    const offsetRateNow = resolveActivePhase(user.value.joinedAt).nexFeeOffsetRate;
    if (!isWithdrawalFeeSnapshotValid(fee, offsetWithNex, offsetRateNow, NETWORK_FEE_KEY[network], currentNetworkConfirmFeeUsd())) return null;
    // (单槽闸已删除:单据改成列表后,新单不再顶掉在途单 —— 那道闸本就是为兜单槽
    //  模型加的产品限制,真后端没有它,留着反而会在人工审核单无出口时把用户锁死。)
    const currentUser = withDefaultEarningBuckets(user.value);
    // 单门:总余额门。2026-07-31 规则变更 —— 充值本金允许提现(按标准费率收费),
    // 故不再以 withdrawableUsdt 为准入分母。pendingReviewUsdt / bonusLockedUsdt 本就
    // 账外(不计入 usdtBalance),风控扣留仍然生效:被扣留的收益压根不在总余额里。
    // 这一门同时是 negative-balance 最后防线 —— 任何情况下不放行超过总余额的提现。
    if (currentUser.usdtBalance < amount) return null;
    // 🔴 并发透支门(2026-07-31 审计 P0):内存余额可能是过期快照 —— account-cloud 把
    // usdtBalance 当加法计数器做三路 merge,两个标签页/端各自本地合法的扣款合并后会相加。
    // 门禁分母从 withdrawableUsdt(常年很小)换成 usdtBalance 后,可透支上限被放大到整个
    // 账户余额,故这里必须以**落盘的最新余额**再核一次(等价于真后端在事务内重读行)。
    // 读不到快照(首次/清缓存)时放行,由上面的内存门 + merge 层 clamp 兜底。
    // 🔴 全程钉死入口那一刻的账号。本函数跨多个 await(占额度 150ms + 重放 ≤450ms),
    // 期间 storage 事件 / 会话被踢 / 换号登录都会调 bindAccount 改掉 accountKey.value ——
    // 实测:A 发起提现、60ms 后切到 B,结果额度扣在 A、钱和单据落在 B(两个用户各自莫名其妙)。
    const acct = accountKey.value;
    const freshBalance = readAccountSnapshot(acct)?.user?.usdtBalance;
    if (Number.isFinite(freshBalance) && (freshBalance as number) < amount) return null;
    const now = mockServerNow();
    const rules = cfg.config.withdrawRules;
    // 🔴 FEAT-WD01b 每日笔数:**先占额度再建单**(与上面的并发透支门同源思路)。
    // 页面提交前的预判读的是 600ms 异步评估之前的计数,两个标签页会各自读到
    // 「今天还没提过」——独立验收实测 3 轮 3 中。这一行是真正的闸,预判只是 UI。
    // 放在所有拒绝条件之后:被拒的提交不该白占额度。
    // 占用是**异步**的(写入后要等跨进程传播收敛再回读验令牌,见 claimWithdrawSlot)——
    // 复验实测:纯同步的读-改-写在两个独立标签页之间 12 轮 12 中都拦不住。
    const claimToken = await claimWithdrawSlot(acct, rules.dailyWithdrawLimitCount, now);
    if (!claimToken) return null;
    // 占用等待期间余额可能被另一端花掉 —— 落盘余额再核一次;不过就把额度还回去
    // (被拒的提交不该白吃额度)。这之后本函数不再有失败路径。
    // await 期间账号被换掉 → 立刻收手并归还额度,绝不把钱记到新账号头上。
    if (accountKey.value !== acct) {
      releaseWithdrawSlot(acct, claimToken);
      return null;
    }
    const settledBalance = readAccountSnapshot(acct)?.user?.usdtBalance;
    if (Number.isFinite(settledBalance) && (settledBalance as number) < amount) {
      releaseWithdrawSlot(acct, claimToken);
      return null;
    }
    // 🔴 await 之后必须**重取**内存态:这 150ms 里本页的计息 / 结算 tick 可能已经改过
    // user.value。拿 await 之前的旧快照回写 = 把这期间的收益抹掉(自己丢自己的更新)。
    const settledUser = withDefaultEarningBuckets(user.value);
    if (settledUser.usdtBalance < amount) {
      releaseWithdrawSlot(acct, claimToken);
      return null;
    }
    // 🔴 单号里的日期用**平台日**(越南 UTC+7),与每日笔数上限、可再提时刻同一个「今天」。
    // 原本用 UTC 日:同一屏上单号写 20260731、提示写「08-02 02:00 后可再提」,
    // 用户拿单号问客服时两边对不上是哪一天的单。
    const yyyymmdd = new Date(now + PLATFORM_UTC_OFFSET_HOURS * 3600_000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const seq = Math.floor(1000 + Math.random() * 9000);
    const id = `WD-${yyyymmdd}-${seq}`;
    const initialStatus: Withdrawal["status"] =
      riskRoute === "freeze" ? "frozen" : riskRoute === "manual" || riskRoute === "delay" ? "review-pending" : "submitted";
    // fee = FEAT-WD02 结构化快照(networkConfirmUsd/nexBurned/actualFeeUsd),上方已按
    // server 等式复验;新单不含 penaltyUsd。PROD: server computes + returns it.
    const wd: Withdrawal = {
      id,
      amount,
      network,
      address,
      fee,
      status: initialStatus,
      riskRoute,
      riskReasons,
      fastLaneApplied,
      waivedGates,
      submittedAt: now,
      // FEAT-WD01b:到账时刻由后台 D5 参数算,不再写死 24h —— 写死的话运营调了
      // 「到账时效」页面照旧显示次日,承诺与实际两张皮。大额命中审查窗口时取更晚者。
      estimatedCompletion: estimateArrivalAt(now, amount, {
        payoutSlaHours: rules.payoutSlaHours,
        payoutReviewWindowDays: rules.payoutReviewWindowDays,
        largeAmountUsdt: NEW_ADDRESS_LARGE_AMOUNT_USDT,
      }),
    };
    withdrawals.value = [wd, ...withdrawals.value];
    // 扣款顺序:先耗已解锁收益,再耗充值本金(与 debitBalance 消费顺序相反 —— 消费时
    // 先耗本金保住可提额度,提现时先耗收益,两边都让 withdrawableUsdt 尽快归零而不会
    // 出现「可提额度 > 总余额」)。两个 clamp 缺一不可:max(0,…) 防提本金时可提额度
    // 转负;min(…, 扣后总余额) 保 withdrawableUsdt ≤ usdtBalance 不变量。
    // 🔴 两个 clamp 的**唯一**实现在下面的 applyDebit —— 此处曾留一份重构后没人用的
    // 副本,而哨兵正 pin 在那份死代码上:真 clamp 改坏了哨兵照样绿(审计实测)。
    // 🔴 本地权威副本。落盘后**内存态可能被回滚**:persistAccountSnapshot 会把合并结果
    // adopt 回 user.value / latestWithdrawal,而合并里「本页没改过的 key」取的是 latest,
    // 跨渲染进程读到的 latest 可能是别的标签页写的旧值 —— 于是本页刚提交的扣款和单据
    // 被自己 adopt 回旧状态。复验轨迹实测到这一幕:补写那一下写回去的就是被回滚后的旧值。
    // 所以重放必须以**这份不会被 adopt 动到的本地副本**为准,不能读 user.value。
    // 🔴 幂等键随扣款一起落盘(沿用 creditRewardBucketInternal 的既有范式)。
    // 判「这笔扣款到底落没落」不能看提现单槽 —— latestWithdrawal 只有**一个**槽位,
    // 并发的另一笔提现会占走它,本单的判据就永远不成立、重放空转三轮(审计 P0 第二形态)。
    const previousSnapshot = lastCloudSnapshot;
    const applyDebit = (base: UserState): UserState => {
      const u = withDefaultEarningBuckets(base);
      const usdt = +(u.usdtBalance - amount).toFixed(2);
      return {
        ...u,
        usdtBalance: usdt,
        earningBuckets: {
          ...u.earningBuckets,
          withdrawableUsdt: Math.min(Math.max(0, +(u.earningBuckets.withdrawableUsdt - amount).toFixed(2)), usdt),
          lastBucketedAt: now,
        },
        appliedRewardKeys: { ...u.appliedRewardKeys, [id]: true },
      };
    };
    const committedUser = applyDebit(settledUser);
    user.value = committedUser;
    if (!persistAccountSnapshot()) {
      // 落盘失败(配额满 / 隐私模式 / storage 被禁):回滚内存、归还额度,别返回成功单号 ——
      // 否则页面会照常写账单并跳转,刷新后「钱还在、账单在、单据没了」。
      adoptAccountSnapshot(previousSnapshot);
      releaseWithdrawSlot(acct, claimToken);
      return null;
    }
    // 风控台账与扣款同一个同步任务:这两笔登记原本在页面里、扣款之后 ~1.2s 才跑,
    // 用户在这段等待里关掉页面就会「钱扣了但首提标记没置位、共用地址没登记」——
    // 首提永远当第一次(每笔都 manual),跨账户共用收款地址的强信号也查不出来。
    recordWithdrawAddressUse(acct, network, address);
    markWithdrawn(acct);
    // 🔴 落盘收敛重放(独立验收两轮实测的资金 P0:单据在、账单在、余额一分没少 = 凭空提现)。
    // 判据是**单号**(唯一且只属于本次),所以重放只在「这单没落上」时发生,不可能重复扣款。
    // 最多 3 次、每次等一个传播周期:并发方在这个量级早已收工,收敛后就稳定;
    // 次数有上限,不会因为对方持续写而空转。
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise<void>((r) => setTimeout(r, CLAIM_SETTLE_MS));
      // 账号在重放期间被换掉就停手:再写下去就是往别人账上记账。
      if (accountKey.value !== acct) break;
      const stored = readAccountSnapshot(acct);
      // 判据是**幂等键**不是提现单槽:单槽只有一个位置,并发的另一笔提现会占走它,
      // 那样本单永远判不成立、三轮全空转(审计 P0 第二形态)。
      if (stored?.user?.appliedRewardKeys?.[id]) break;
      if (!stored) { persistAccountSnapshot(); continue; }
      // 🔴 重放必须**在落盘现状上重算扣款**,不能回写提交那一刻的绝对快照。
      // 合并层把余额当加法计数器(delta = next − base):先 adopt(stored) 再写绝对值,
      // delta 就等于「绝对值 − 落盘值」,合并结果被强行设成那个绝对值 ——
      // 并发方在这期间的余额变动(买设备 / 充值 / 领奖)会被整个抹平,方向为负时等于凭空造钱。
      // 改成从 stored 重新推导后,delta 恒等于 −amount,并发方的改动全部保留。
      // 🔴 重放也要核余额:主路径核了四次,这里一次不核 —— stored 余额在这期间缩水时
      // applyDebit 会算出负值,再被 merge 层 clamp 静默兜成 0(拒绝变成悄悄清零)。
      if (withDefaultEarningBuckets(stored.user).usdtBalance < amount) break;
      adoptAccountSnapshot(stored);
      user.value = applyDebit(stored.user);
      // 重放本单:列表里已有就替换,被并发方抹掉了就补回
      withdrawals.value = withdrawals.value.some((w) => w.id === id)
        ? withdrawals.value.map((w) => (w.id === id ? wd : w))
        : [wd, ...withdrawals.value];
      persistAccountSnapshot();
    }
    return id;
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
    const next = prev.map((w) => advanceArrival(w, now) ?? w);
    const advancedIds = next.filter((w, i) => w !== prev[i]).map((w) => w.id);
    if (!advancedIds.length) return [];
    withdrawals.value = next;
    // 诚实返回落盘结果:落盘失败时内存说已到账、磁盘还是处理中,而内存一旦置 confirmed
    // 后续轮询就恒返回 false 永不重试(只有整页重载才自愈)。失败即回滚内存,下个 tick 再试。
    if (!persistAccountSnapshot()) {
      withdrawals.value = prev;
      return [];
    }
    return advancedIds;
  }

  // ⚠️ DEV/DEMO-ONLY(SPEC-7 收编): 仅 pass 路由的提现可由 demo 驱动推进主链
  // 状态;manual/delay/freeze 的状态推进属于服务端/人工处置,client 永不推进。
  // PRODUCTION: status comes from server webhook/SSE/polling only.
  function _devAdvanceWithdrawal() {
    if (import.meta.env.PROD) return; // demo-only 状态推进,store 层二层 guard(硬规则5)
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
    user, devices, visibleDevices, slotDevices, activeSlotCount, earnings, global,
    withdrawals, latestWithdrawal, inFlightWithdrawals, primaryWithdrawal, miningPaused,
    bindAccount, persistAccountSnapshot,
    tick, settle, setPhoneRuntime, applyPhoneCalibration, interruptAllTasks, resumeMining,
    creditBalance, debitBalance, creditNex, debitNex, captureMoney, restoreMoney,
    recordDeposit, setGenesisInviteCode, creditRewardBucket, creditRewardBucketOnce,
    submitWithdrawal, advanceWithdrawalArrival, refundFailedWithdrawals, _devAdvanceWithdrawal, _devGrantManualRelease,
    addDevice, activateDevice, deactivateDevice, scheduleDeactivation, connectComputeShareDevice,
  };
});
