import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { Device, CompletedTask, UserState, EarningsState, GlobalStats, Withdrawal, EarningBucketRoute } from "./types";
import type { DeviceKind } from "./types";
import { ONE_DAY_MS, makeInitialDevices, createDevice, MAX_DEVICES, type CreateDeviceOptions } from "./device-types";
import { pickRandomTask } from "@/mock/tasks";
import { isDegradable, getEfficiency, getMonthsOwned } from "./device-lifecycle";
import { interruptInfo } from "./interrupt";
import { continuityFactor, thermalFactor, isDeviceOnline } from "@/lib/hashpower";
import { getCarrier } from "@/lib/carrier";
import { getEntrySurface, type EntrySurface } from "@/lib/entry-surface";
import { matchGpuTier } from "@/lib/gpu-tiers";
import { useConfig } from "@/store/config";
import { evaluateAccountCluster } from "@/store/risk-cluster";
import {
  appendLedgerEntry,
  evaluateAttestRelease,
  hasReleaseEffect,
  _devGrantManualRelease as _devGrantManualReleaseLedger,
  type ReleaseOutcome,
} from "@/store/earning-release";
import { recordAttestation } from "@/store/risk-identity";
import type { OnlineBonus, WithdrawalRiskRoute } from "@/store/config-types";
import type { DeviceCapability } from "@/lib/device-capability";
import { useReceipts } from "./receipts";
import { generateReceipt } from "@/mock/receipt";
import {
  normalizeAccountKey,
  mergeAndWriteAccountSnapshot,
  readAccountSnapshot,
  type AccountCloudSnapshot,
} from "./account-cloud";

// Ported from Nexion-prototype/lib/store/index.ts (useApp), zustand → Pinia.
// MOCK-ONLY: entire earnings simulation runs client-side. Production replaces
// tick() with an SSE/WebSocket subscription to server-pushed per-device yield.
// SPEC-4: user/devices/earnings now persist through the account-cloud mock, so
// the same accountKey can be rebound by H5 / signed app / white-app carriers.

const ONE_DAY = ONE_DAY_MS;

// ── module-level tick state (mirrors original module scope) ──
let globalTimer = 0;
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

function withDefaultEarningBuckets(user: UserState): UserState {
  return {
    ...user,
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

function createInitialUser(email = "alex@nexion.ai"): UserState {
  const usdtBalance = 24856.56;
  return {
    email,
    tier: "L2",
    joinedAt: Date.now() - 30 * ONE_DAY,
    cumulativeDepositUsdt: 0,
    referralCode: "NEXION-8K9X",
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

function createInitialGlobal(): GlobalStats {
  return {
    activeDevices: 28432,
    paidToday: 1247893,
    nodes: 156,
    countries: 47,
    uptime: 99.7,
    todayIncrement: 1247,
  };
}

function createSeedSnapshot(accountKey: string, email: string, entrySurface: EntrySurface): AccountCloudSnapshot {
  return {
    schema: 1,
    accountKey: normalizeAccountKey(accountKey),
    entrySurface,
    updatedAt: Date.now(),
    user: createInitialUser(email || accountKey || "alex@nexion.ai"),
    devices: makeInitialDevices(),
    earnings: createInitialEarnings(),
    latestWithdrawal: null,
  };
}

function normalizeDefaultFleetSnapshot(snapshot: AccountCloudSnapshot): AccountCloudSnapshot {
  const legacyDemoKinds: DeviceKind[] = ["cloud-share", "stellarbox-s1", "stellarbox-pro", "stellarrack-p1"];
  const hasLegacyDemoFleet = legacyDemoKinds.every((kind) => snapshot.devices.some((d) => d.kind === kind));
  const hasLegacySeedIds = snapshot.devices.some((d) => d.id.endsWith("-seed"));
  if (!hasLegacySeedIds && !hasLegacyDemoFleet) return snapshot;
  const seededPhone = makeInitialDevices()[0];
  const existingPhone = snapshot.devices.find((d) => d.kind === "phone");
  const phone: Device = { ...seededPhone, id: existingPhone?.id ?? seededPhone.id };
  return {
    ...snapshot,
    devices: [phone, ...snapshot.devices.filter((d) => d.kind !== "phone" && !d.id.endsWith("-seed") && !legacyDemoKinds.includes(d.kind))],
  };
}

/** SPEC-1 §4.2 — the single earnings-accrual path (settle-single-source).
 *  Accrues a device by the WALL-CLOCK Δ since its `lastSettledAt` anchor (NOT by
 *  accumulated tick time), then re-anchors to `now`. Driving accrual off the
 *  registration anchor is what decouples earnings from the page being open: a
 *  BACKGROUNDED gap (the in-memory anchor survives onHide→onShow) is settled in one
 *  shot on the next settle(). The mock store is NOT persisted, so a full page reload
 *  resets state — true closed-tab catch-up is the PROD server's job (it holds
 *  lastSettledAt and settles on the foreground call).
 *  R7 在线分层: phone online (fresh heartbeat) accrues continuity×thermal (在线加成);
 *  phone offline (no/stale beat) = flat 基础托管 (h5BaseFactor); non-phone = 1 —
 *  factor source = isDeviceOnline(d, now), NOT the view carrier (same 口径 as
 *  lib/hashpower.ts display; accrual uses this bounded subset). */
function settleDevice(d: Device, now: number, onlineBonus: OnlineBonus): Device {
  // Not earning right now (idle / offline / cloud-share / phone gated) → drop a
  // stale anchor so the idle gap is never back-paid when the device resumes.
  if (
    d.activatedAt === null ||
    d.status !== "online" ||
    d.kind === "cloud-share" ||
    d.pausedReason != null
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
    lastSettledAt: now,
  };
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
  const bootSnapshot = normalizeDefaultFleetSnapshot(readAccountSnapshot("default") ?? createSeedSnapshot("default", "alex@nexion.ai", bootSurface));
  const accountKey = ref(bootSnapshot.accountKey);
  const entrySurface = ref<EntrySurface>(bootSnapshot.entrySurface);
  const accountCloudUpdatedAt = ref(bootSnapshot.updatedAt);
  const user = ref<UserState>(bootSnapshot.user);
  const devices = ref<Device[]>(bootSnapshot.devices);
  const earnings = ref<EarningsState>(bootSnapshot.earnings);
  const global = ref<GlobalStats>(createInitialGlobal());
  const latestWithdrawal = ref<Withdrawal | null>(bootSnapshot.latestWithdrawal);
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
    latestWithdrawal.value = snapshot.latestWithdrawal;
    syncDeviceRuntime(snapshot.devices, resetRuntime);
    lastCloudSnapshot = normalizedSnapshot;
    accountCloudUpdatedAt.value = normalizedSnapshot.updatedAt;
  }

  reseedDeviceRuntime(devices.value);

  function persistAccountSnapshot() {
    const snapshot: AccountCloudSnapshot = {
      schema: 1,
      accountKey: accountKey.value,
      entrySurface: entrySurface.value,
      updatedAt: Date.now(),
      user: user.value,
      devices: devices.value,
      earnings: earnings.value,
      latestWithdrawal: latestWithdrawal.value,
    };
    const merged = mergeAndWriteAccountSnapshot(lastCloudSnapshot, snapshot);
    adoptAccountSnapshot(merged);
  }

  function bindAccount(rawAccountKey: string, surface: EntrySurface = getEntrySurface()) {
    const key = normalizeAccountKey(rawAccountKey);
    const snapshot = readAccountSnapshot(key) ?? createSeedSnapshot(key, rawAccountKey, surface);
    accountKey.value = snapshot.accountKey;
    entrySurface.value = surface;
    const boundSnapshot: AccountCloudSnapshot = {
      ...snapshot,
      entrySurface: surface,
      user: { ...snapshot.user, email: snapshot.user.email || rawAccountKey || "alex@nexion.ai" },
    };
    miningPaused.value = false;
    adoptAccountSnapshot(boundSnapshot, true);
    persistAccountSnapshot();
  }

  function tick(deltaMs: number) {
    if (miningPaused.value) return;
    // ── Global platform stats jitter ──
    globalTimer += deltaMs;
    const globalUpdate: Partial<GlobalStats> = {
      activeDevices: global.value.activeDevices + Math.floor(Math.random() * 4),
      paidToday: global.value.paidToday + Math.floor(Math.random() * 280) + 60,
      todayIncrement: global.value.todayIncrement + Math.floor(Math.random() * 3),
    };

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

      // Earnings accrual moved to settle() (SPEC-1 §4.2): yield is settled by
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
    global.value = { ...global.value, ...globalUpdate };
    settle();
  }

  /** SPEC-1 §4.2 — settle every device by wall-clock Δ (settleDevice), then roll
   *  the aggregate today/week/month/total + NEX balance forward by the positive
   *  delta. Called by tick() (steady state) and on app foreground (App.vue onShow)
   *  so a backgrounded / reopened session catches its offline gap up in one shot.
   *  The SINGLE earnings-accrual path — PROD swaps it for the server's settle
   *  endpoint (same lastSettledAt anchor), zero shape change. */
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
    // R7: App 载体是 mock 的设备在线心跳源 —— 为在跑的手机刷 onlineHeartbeatAt(模拟常驻
    // App agent 上报;PROD = 服务端收设备心跳落此戳)。收益/显示因子只读这个设备态
    // (isDeviceOnline),不读 getCarrier(),故「用哪个端查看」不再改因子;H5 载体不刷 →
    // 心跳陈旧 → 基础托管。心跳只碰 onlineHeartbeatAt,不动 lastSettledAt/attest 锚点。
    // ⚠️ 此心跳 gate(phone+status online+!paused+activated)必须与 settleDevice 的 phone
    // earning gate 保持一致 —— 改一处同步另一处,否则会「不赚钱却标 online」致 display/accrual 脱节。
    const beated =
      carrier === "app"
        ? devices.value.map((d) =>
            d.kind === "phone" && d.status === "online" && d.pausedReason == null && d.activatedAt !== null
              ? { ...d, onlineHeartbeatAt: now }
              : d,
          )
        : devices.value;
    // 结算前锚点快照(用于下方 attest 累计的墙钟差,避免复用会跳跃重锚的锚点重复计)。
    const anchorBefore = new Map(beated.map((d) => [d.id, d.lastSettledAt ?? null]));
    const settled = beated.map((d) =>
      d.kind === "pc-gpu" && !computeShareEnabled.value
        ? freezeComputeShareDevice(d)
        : settleDevice(d, now, onlineBonus),
    );
    // App 载体 + 手机设备真在跑 → 累计「App 在线证明」(R1 attest 释放源,SPEC-7 口径)。
    // 用 settleDevice 实际推进的锚点差(after > before 才是真结算的墙钟那一拍),
    // 与收益累计同源;首次登记(before=null)/未达结算间隔(锚点未动)都不计,
    // 修 audit U1「复用外层旧锚点每 tick 重算全量差 → 系统性多计 ~1.5x」。
    // (R7: 因子源已改设备心跳 isDeviceOnline;attestation 是 SPEC-7 独立口径,仍按 App 载体在跑累计。)
    if (carrier === "app") {
      for (const d of settled) {
        if (d.kind !== "phone" || d.pausedReason != null) continue;
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

    devices.value = settled;
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
  // Real backend pulls these from the device-agent heartbeat — client must NOT
  // mutate. Only patches phone-kind devices.
  function setPhoneRuntime(
    id: string,
    patch: Partial<Pick<Device, "isCharging" | "isWifiConnected" | "batteryLevel">>,
  ) {
    devices.value = devices.value.map((d) =>
      d.id === id && d.kind === "phone" ? { ...d, ...patch } : d,
    );
    persistAccountSnapshot();
  }

  // Apply a calibration result to the phone device: refreshes its yield baseline
  // + displayed NPU spec from the (deterministic, per-device) capability, and
  // starts a fresh continuity run. Called by the onboarding/recalibration ritual
  // after measureDeviceCapability(). PROD: server returns the device's tier on
  // POST /api/auth/signin; client applies the same shape.
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
        ? { ...d, currentTask: null, interruptedAt: null, miningSince: null, lastSettledAt: null }
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
      d.id === id ? { ...d, activatedAt: Date.now(), lastSettledAt: Date.now(), pendingDeactivate: false } : d,
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
  function creditBalance(amount: number) {
    user.value = { ...user.value, usdtBalance: +(user.value.usdtBalance + amount).toFixed(2) };
    persistAccountSnapshot();
  }
  function debitBalance(amount: number): boolean {
    if (user.value.usdtBalance < amount) return false;
    user.value = { ...user.value, usdtBalance: +(user.value.usdtBalance - amount).toFixed(2) };
    persistAccountSnapshot();
    return true;
  }
  function creditNex(amount: number) {
    user.value = { ...user.value, nexBalance: +(user.value.nexBalance + amount).toFixed(2) };
    persistAccountSnapshot();
  }
  function debitNex(amount: number): boolean {
    if (user.value.nexBalance < amount) return false;
    user.value = { ...user.value, nexBalance: +(user.value.nexBalance - amount).toFixed(2) };
    persistAccountSnapshot();
    return true;
  }
  function recordDeposit(amount: number): boolean {
    // Input validation mirrors source: reject NaN/±Infinity/≤0/absurd (>1e9).
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) return false;
    user.value = {
      ...user.value,
      usdtBalance: +(user.value.usdtBalance + amount).toFixed(2),
      cumulativeDepositUsdt: +(user.value.cumulativeDepositUsdt + amount).toFixed(2),
    };
    persistAccountSnapshot();
    return true;
  }
  function creditRewardBucket(route: EarningBucketRoute, usdt: number, nex = 0): boolean {
    if (!Number.isFinite(usdt) || !Number.isFinite(nex) || usdt < 0 || nex < 0) return false;
    if (route === "no_issue") return true;
    const buckets = withDefaultEarningBuckets(user.value).earningBuckets;
    const nextBuckets = { ...buckets, lastBucketedAt: Date.now() };
    const nextUser: UserState = { ...user.value, earningBuckets: nextBuckets };
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
      appendLedgerEntry(accountKey.value, evaluateAccountCluster(accountKey.value).clusterId, route, usdt, nex);
    }
    user.value = nextUser;
    persistAccountSnapshot();
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
  function submitWithdrawal(
    amount: number,
    network: Withdrawal["network"],
    address: string,
    fee: number,
    riskRoute: WithdrawalRiskRoute = "pass",
    riskReasons: string[] = [],
  ): string | null {
    // SPEC-7 FEAT-RISK03: reject 路由禁止扣款建单;freeze/manual/delay 建单进
    // 对应队列(资金占用),状态由服务端/人工推进,client 不推进。
    if (riskRoute === "reject") return null;
    const currentUser = withDefaultEarningBuckets(user.value);
    if (currentUser.earningBuckets.withdrawableUsdt < amount) return null;
    const now = Date.now();
    const yyyymmdd = new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
    const seq = Math.floor(1000 + Math.random() * 9000);
    const id = `WD-${yyyymmdd}-${seq}`;
    const initialStatus: Withdrawal["status"] =
      riskRoute === "freeze" ? "frozen" : riskRoute === "manual" || riskRoute === "delay" ? "review-pending" : "submitted";
    // fee = authoritative new-model withdrawal fee (grossFee − NEX offset), passed
    // by the caller from computeWithdrawFee. PROD: server computes + returns it.
    const wd: Withdrawal = {
      id,
      amount,
      network,
      address,
      fee,
      status: initialStatus,
      riskRoute,
      riskReasons,
      submittedAt: now,
      estimatedCompletion: now + 24 * 3600 * 1000,
    };
    latestWithdrawal.value = wd;
    user.value = {
      ...currentUser,
      usdtBalance: +(currentUser.usdtBalance - amount).toFixed(2),
      earningBuckets: {
        ...currentUser.earningBuckets,
        withdrawableUsdt: +(currentUser.earningBuckets.withdrawableUsdt - amount).toFixed(2),
        lastBucketedAt: now,
      },
    };
    persistAccountSnapshot();
    return id;
  }

  // ⚠️ DEV/DEMO-ONLY(SPEC-7 收编): 仅 pass 路由的提现可由 demo 驱动推进主链
  // 状态;manual/delay/freeze 的状态推进属于服务端/人工处置,client 永不推进。
  // PRODUCTION: status comes from server webhook/SSE/polling only.
  function _devAdvanceWithdrawal() {
    if (import.meta.env.PROD) return; // demo-only 状态推进,store 层二层 guard(硬规则5)
    const wd = latestWithdrawal.value;
    if (!wd) return;
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
    latestWithdrawal.value = { ...wd, status: order[idx + 1] };
    persistAccountSnapshot();
  }

  return {
    accountKey, entrySurface, accountCloudUpdatedAt,
    user, devices, visibleDevices, slotDevices, activeSlotCount, earnings, global, latestWithdrawal, miningPaused,
    bindAccount, persistAccountSnapshot,
    tick, settle, setPhoneRuntime, applyPhoneCalibration, interruptAllTasks, resumeMining,
    creditBalance, debitBalance, creditNex, debitNex, recordDeposit, creditRewardBucket,
    submitWithdrawal, _devAdvanceWithdrawal, _devGrantManualRelease,
    addDevice, activateDevice, deactivateDevice, scheduleDeactivation, connectComputeShareDevice,
  };
});
