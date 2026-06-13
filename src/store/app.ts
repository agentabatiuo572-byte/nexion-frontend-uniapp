import { defineStore } from "pinia";
import { ref } from "vue";
import type { Device, CompletedTask, UserState, EarningsState, GlobalStats, Withdrawal } from "./types";
import type { DeviceKind } from "./types";
import { ONE_DAY_MS, makeInitialDevices, createDevice, MAX_DEVICES } from "./device-types";
import { pickRandomTask } from "@/mock/tasks";
import { isDegradable, getEfficiency, getMonthsOwned } from "./device-lifecycle";
import { interruptInfo } from "./interrupt";
import { useReceipts } from "./receipts";
import { generateReceipt } from "@/mock/receipt";

// Ported from Nexion-prototype/lib/store/index.ts (useApp), zustand → Pinia.
// MOCK-ONLY: entire earnings simulation runs client-side. Production replaces
// tick() with an SSE/WebSocket subscription to server-pushed per-device yield.
// Intentionally NOT persisted (resets on refresh by design).

const ONE_DAY = ONE_DAY_MS;

// ── module-level tick state (mirrors original module scope) ──
let globalTimer = 0;
const deviceTimers = new Map<string, { vital: number; earnings: number }>();
const lastTickAggregate = { usd: 0, nex: 0 };

function normalRandom(mean: number, std: number, min: number, max: number) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(min, Math.min(max, mean + z * std));
}

export const useApp = defineStore("app", () => {
  const user = ref<UserState>({
    email: "alex@nexion.ai",
    tier: "L2",
    joinedAt: Date.now() - 30 * ONE_DAY,
    cumulativeDepositUsdt: 0,
    referralCode: "NEXION-8K9X",
    usdtBalance: 24856.56,
    nexBalance: 1240,
    pendingEarnings: 2.31,
  });
  const devices = ref<Device[]>(makeInitialDevices());
  const earnings = ref<EarningsState>({
    today: 247.83,
    todayNEX: 612.4,
    thisWeek: 1247.65,
    thisMonth: 5184.62,
    total: 28452.18,
    history: [
      { ts: Date.now() - 1 * 3600 * 1000, amount: 0.23 },
      { ts: Date.now() - 2 * 3600 * 1000, amount: 0.19 },
      { ts: Date.now() - 3 * 3600 * 1000, amount: 0.21 },
      { ts: Date.now() - 4 * 3600 * 1000, amount: 0.18 },
    ],
  });
  const global = ref<GlobalStats>({
    activeDevices: 28432,
    paidToday: 1247893,
    nodes: 156,
    countries: 47,
    uptime: 99.7,
    todayIncrement: 1247,
  });
  const latestWithdrawal = ref<Withdrawal | null>(null);

  // seed per-device timers
  devices.value.forEach((d) => deviceTimers.set(d.id, { vital: 0, earnings: 0 }));

  function tick(deltaMs: number) {
    // ── Global platform stats jitter ──
    globalTimer += deltaMs;
    const globalUpdate: Partial<GlobalStats> = {
      activeDevices: global.value.activeDevices + Math.floor(Math.random() * 4),
      paidToday: global.value.paidToday + Math.floor(Math.random() * 280) + 60,
      todayIncrement: global.value.todayIncrement + Math.floor(Math.random() * 3),
    };

    // ── Per-device updates ──
    const newDevices = devices.value.map((d) => {
      if (d.activatedAt === null) return d;
      if (d.status !== "online" || d.kind === "cloud-share") return d;
      const timer = deviceTimers.get(d.id) ?? { vital: 0, earnings: 0 };
      timer.vital += deltaMs;
      timer.earnings += deltaMs;
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
          return next;
        }
        if (next.interruptedAt != null) {
          if (next.currentTask) {
            const heldMs = Date.now() - next.interruptedAt;
            next.currentTask = { ...next.currentTask, startedAt: next.currentTask.startedAt + heldMs };
          }
          next.interruptedAt = null;
        }
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

      // Earnings ~2s (USDT + NEX with lifecycle decay)
      if (timer.earnings >= 1800) {
        timer.earnings = 0;
        const marketMult = 0.95 + Math.random() * 0.1;
        const variation = 0.85 + Math.random() * 0.3;
        const lifeEff = isDegradable(d.kind) ? getEfficiency(getMonthsOwned(d.purchasedAt)) : 1;
        const inc = (d.baseRate * lifeEff * marketMult * variation * 1800) / ONE_DAY;
        const incNEX = (d.baseRateNEX * lifeEff * marketMult * variation * 1800) / ONE_DAY;
        next.todayEarnings = +(d.todayEarnings + inc).toFixed(3);
        next.todayEarningsNEX = +(d.todayEarningsNEX + incNEX).toFixed(2);
      }

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

    // ── Aggregate today's earnings + delta-add ──
    const aggregateToday = newDevices.reduce((sum, d) => sum + d.todayEarnings, 0);
    const aggregateTodayNEX = newDevices.reduce((sum, d) => sum + d.todayEarningsNEX, 0);
    const usdDelta = aggregateToday - lastTickAggregate.usd;
    const nexDelta = aggregateTodayNEX - lastTickAggregate.nex;
    lastTickAggregate.usd = aggregateToday;
    lastTickAggregate.nex = aggregateTodayNEX;
    const positiveUsdDelta = Math.max(0, usdDelta);
    const positiveNexDelta = Math.max(0, nexDelta);

    const nextTodayUSD = +(earnings.value.today + positiveUsdDelta).toFixed(2);
    const nextTodayNEX = +(earnings.value.todayNEX + positiveNexDelta).toFixed(2);

    devices.value = newDevices;
    global.value = { ...global.value, ...globalUpdate };
    earnings.value = {
      ...earnings.value,
      today: nextTodayUSD,
      todayNEX: nextTodayNEX,
      thisWeek: +(earnings.value.thisWeek + positiveUsdDelta).toFixed(2),
      thisMonth: +(earnings.value.thisMonth + positiveUsdDelta).toFixed(2),
      total: +(earnings.value.total + positiveUsdDelta).toFixed(2),
    };
    user.value = {
      ...user.value,
      pendingEarnings: nextTodayUSD,
      nexBalance: +(user.value.nexBalance + positiveNexDelta).toFixed(2),
    };
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
  }

  // ── Device lifecycle (slot CRUD) — ported from index.ts addDevice /
  // activateDevice / deactivateDevice / scheduleDeactivation.
  // orders.advanceOrder optional-chains addDevice + activateDevice, so adding
  // these here lights up the order→device-spawn probe.

  // New purchases land in inventory inactive and require explicit activation.
  // Returns the new device id so callers that chain activate/debit/bill use
  // the returned id, NOT `.filter(kind).pop()` (Batch C Round 1 P0 #4: pop()
  // picked the wrong same-kind device when inventory already held one).
  function addDevice(kind: DeviceKind): string {
    const id = `${kind}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const newDevice = createDevice(kind, id);
    deviceTimers.set(id, { vital: 0, earnings: 0 });
    devices.value = [...devices.value, newDevice];
    return id;
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
    const activeCount = devices.value.filter((d) => d.activatedAt !== null).length;
    if (activeCount + reservedSlots >= MAX_DEVICES) return false;
    devices.value = devices.value.map((d) =>
      d.id === id ? { ...d, activatedAt: Date.now(), pendingDeactivate: false } : d,
    );
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
  }

  // ── Balance primitives (register/login/wallet use these) ──
  function creditBalance(amount: number) {
    user.value = { ...user.value, usdtBalance: +(user.value.usdtBalance + amount).toFixed(2) };
  }
  function debitBalance(amount: number): boolean {
    if (user.value.usdtBalance < amount) return false;
    user.value = { ...user.value, usdtBalance: +(user.value.usdtBalance - amount).toFixed(2) };
    return true;
  }
  function creditNex(amount: number) {
    user.value = { ...user.value, nexBalance: +(user.value.nexBalance + amount).toFixed(2) };
  }
  function debitNex(amount: number): boolean {
    if (user.value.nexBalance < amount) return false;
    user.value = { ...user.value, nexBalance: +(user.value.nexBalance - amount).toFixed(2) };
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
  ): string | null {
    if (user.value.usdtBalance < amount) return null;
    const now = Date.now();
    const yyyymmdd = new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
    const seq = Math.floor(1000 + Math.random() * 9000);
    const id = `WD-${yyyymmdd}-${seq}`;
    const fee = Math.max(1, Math.min(20, amount * 0.02));
    const wd: Withdrawal = {
      id,
      amount,
      network,
      address,
      fee,
      status: "submitted",
      submittedAt: now,
      estimatedCompletion: now + 24 * 3600 * 1000,
    };
    latestWithdrawal.value = wd;
    user.value = { ...user.value, usdtBalance: +(user.value.usdtBalance - amount).toFixed(2) };
    return id;
  }

  // ⚠️ MOCK-ONLY: client unilaterally advances status through the queue.
  // PRODUCTION: status comes from server webhook/SSE/polling only; client never
  // mutates status. Ported from index.ts advanceWithdrawal (drives the
  // /me/wallet/withdraw/tracking stepper demo).
  function advanceWithdrawal() {
    const wd = latestWithdrawal.value;
    if (!wd) return;
    const order: Withdrawal["status"][] = [
      "submitted",
      "review-passed",
      "processing",
      "sent",
      "confirmed",
    ];
    const idx = order.indexOf(wd.status);
    if (idx >= order.length - 1) return;
    latestWithdrawal.value = { ...wd, status: order[idx + 1] };
  }

  return {
    user, devices, earnings, global, latestWithdrawal,
    tick, setPhoneRuntime, creditBalance, debitBalance, creditNex, debitNex, recordDeposit,
    submitWithdrawal, advanceWithdrawal,
    addDevice, activateDevice, deactivateDevice, scheduleDeactivation,
  };
});
