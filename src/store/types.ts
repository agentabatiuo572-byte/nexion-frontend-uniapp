import type { GpuTier, GpuTierId, WithdrawalRiskRoute } from "./config-types";
import type { EntrySurface } from "@/lib/entry-surface";

export type DeviceKind =
  | "phone"
  | "pc-gpu"
  | "stellarbox-s1"
  | "stellarbox-pro"
  | "stellarbox-pro-v2"
  | "stellarrack-p1"
  | "stellarrack-p2"
  | "cloud-share";

// "paused" was removed when manual device pause was dropped (a node is either
// running or involuntarily interrupted — no user opt-in pause). Involuntary
// gating is expressed via `pausedReason` + `interruptedAt`, never `status`.
export type DeviceStatus = "online" | "offline";

export type ThermalState = "nominal" | "fair" | "serious" | "critical";

// Mobile-only gating (v3.2). Both checks are universal hard requirements,
// no user opt-out:
//   - Charging — task pickup requires the phone to be plugged in. Protects
//     battery life and matches the intro hero promise "插上充电就开始接".
//   - Network — task pickup requires a reachable network (Wi-Fi OR
//     cellular both qualify; the scheduler ping-tests the inference
//     gateway before assigning each job).
// No `PhoneSettings` interface anymore: forcing either gate via a toggle
// would only let users break their own device, and the historical
// batteryThreshold knob was unreachable code once charging became
// universal (the no-charger branch always caught the !isCharging case).

// 6 AI workload categories per design doc §5.2.4
export type TaskCategory = "IG" | "VG" | "LL" | "FT" | "EM" | "SP";

export const TASK_CATEGORY_LABEL: Record<TaskCategory, string> = {
  IG: "Image Gen",
  VG: "Video Gen",
  LL: "LLM Inference",
  FT: "Fine-tune",
  EM: "Embedding",
  SP: "Speech",
};

export interface CurrentTask {
  id: string;          // e.g. "IG-A78234"  ({category}-A{counter})
  category: TaskCategory;
  type: string;        // human label, e.g. "Image Gen"
  model: string;       // e.g. "Flux.1 [dev]"
  client: string;      // e.g. "Mosaic Studios"
  location: string;    // e.g. "Berlin, DE"
  totalSec: number;
  startedAt: number;   // epoch ms
  reward: number;      // USDT
}

export interface CompletedTask extends CurrentTask {
  completedAt: number;
}

export interface Device {
  id: string;
  kind: DeviceKind;
  name: string;
  gpu: string;
  gpuTier?: GpuTierId;
  gpuModel?: string;
  vramTotal: number; // GB
  basePower: number; // W
  baseRate: number; // daily USDT (full-efficiency baseline; see lib/store/device-lifecycle.ts for current effective rate)
  baseRateNEX: number; // daily NEX (platform token, §8.1 80% of static yield)
  // Lifecycle (Sprint 2): set on device creation; drives the monthly efficiency
  // degradation curve in lib/store/device-lifecycle.ts. Cloud Share / phone are
  // exempt from degradation (compute is rented or co-located).
  purchasedAt: number; // epoch ms
  // Activation lifecycle (Sprint #146-1): null = purchased but inactive (not consuming a slot,
  // not contributing earnings/quest progress/promo variables);
  // number = epoch ms when user activated this device into one of the 6 slots.
  // Phone is auto-activated on signup; other devices start inactive and require user opt-in.
  activatedAt: number | null;
  // SPEC-1 §4.2 登记锚点: epoch ms of the last earnings settlement. Set on
  // activation (= registration), advanced by app.ts settle() on each accrual.
  // Earnings accrue by wall-clock (now - lastSettledAt), NOT by accumulated tick
  // time — so a closed/backgrounded gap is settled in one shot on reopen (mock;
  // PROD: the server holds this anchor and settles on the foreground call).
  // null = not currently earning (inactive / frozen); re-anchored on resume.
  lastSettledAt?: number | null;
  // Sprint #146-1 supplement: when user requests "deactivate after current task
  // completes" (instead of forfeit-and-deactivate-now), this flag stays true
  // until tick() sees currentTask transition complete → triggers deactivation.
  // Cleared by activateDevice() and by tick() after auto-deactivation fires.
  pendingDeactivate?: boolean;
  generation: number;  // 1 = original spec; 2 = post-trade-in upgrade (e.g. Pro v2 / Rack P2)
  status: DeviceStatus;
  // Live simulation state
  gpuUsage: number; // 0-100
  gpuTemp: number; // °C
  gpuPower: number; // W
  vramUsed: number; // GB
  currentTask: CurrentTask | null;
  recentTasks: CompletedTask[]; // last 10
  todayEarnings: number;
  todayEarningsNEX: number;
  // For NexionBox cards
  location?: string;
  hashRate?: number;
  dayCount?: number;
  // For phone kind (v3.2 mobile-first)
  batteryLevel?: number;       // 0-100 (%)
  isCharging?: boolean;
  /** True when the device has reachable network — Wi-Fi OR cellular both
   *  qualify. Reflects the heartbeat ping-test result; updated by the
   *  device agent on every workload assignment poll. Field name retained
   *  from v3.2 for storage compatibility; semantically "isOnline". */
  isWifiConnected?: boolean;
  thermalState?: ThermalState;
  // Computed each tick from runtime power/network state.
  // null = eligible (earnings accruing); string = paused, with the reason
  // surfaced in the device card status pill. Mirror "real" distributed-
  // compute apps which gate workload pickup on charge + network conditions.
  pausedReason?: "no-charger" | "no-network" | null;
  /** Epoch ms when the current power/network interruption began while a task
   *  was in flight; null/undefined = not interrupted. Drives the reconnect
   *  grace window (see lib/store/interrupt.ts): the task is held (suspended,
   *  no earnings) until conditions recover (same task resumes) or the window
   *  elapses (task cancelled → fresh task on recovery). Server-canonical in
   *  production; client mirrors only. */
  interruptedAt?: number | null;
  // ── Phone capability (calibration baseline) ──
  // Set by the calibration ritual via measureDeviceCapability() (or the legacy
  // fallback for an uncalibrated demo phone). Deterministic per login device →
  // displayed "算力" is monotonic with real device class and reproducible.
  /** Presented capability score 0–100 (typical phone ≈ 87). */
  capabilityScore?: number;
  /** Stable presented NPU throughput (TOPS) — the comparable "ceiling" number. */
  capabilityTops?: number;
  /** 1–5 capability tier. */
  capabilityTier?: number;
  /** Epoch ms when the phone began its CURRENT continuous mining run; null when
   *  paused/interrupted. Drives the live ContinuityFactor (stability bonus);
   *  reset by interruptAllTasks (session kick) and by new-device recalibration. */
  miningSince?: number | null;
}

// NOTE: WalletPairingState (v3.2 KYC-Express §5.4.3.2.1) lives in its own
// store at lib/store/wallet-pairing.ts (zustand + persist) because it needs
// localStorage persistence independent of useApp.

export type UserTier = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";

export interface EarningBuckets {
  withdrawableUsdt: number;
  pendingReviewUsdt: number;
  bonusLockedUsdt: number;
  lockedNex: number;
  policyVersion: string;
  lastBucketedAt: number;
}

export type EarningBucketRoute = "withdrawable" | "pending_review" | "bonus_locked" | "no_issue";

export interface UserState {
  email: string;
  tier: UserTier;
  joinedAt: number; // epoch ms
  referralCode: string;
  usdtBalance: number;
  nexBalance: number;
  pendingEarnings: number;
  earningBuckets: EarningBuckets;
  /** Lifetime sum of completed USDT deposits/topups. Used by tradein eligibility
   *  `cumulative-deposit-usdt` rule. Seeded 0; incremented ONLY by recordDeposit
   *  action (NOT earnings, NOT exchange, NOT salvage refund, NOT KYC bonus,
   *  NOT weekly-quest reward).
   *  ⚠️ MOCK-ONLY: production server-canonical via
   *  GET /api/users/me.cumulativeDepositUsdt
   *  (TBD; candidate, not in PRD §9.11 — read endpoint name pending). */
  cumulativeDepositUsdt: number;
}

export interface EarningsState {
  today: number;             // USDT
  todayNEX: number;          // NEX (platform token)
  thisWeek: number;          // USDT rolling 7-day. (TBD; candidate `GET /api/me/earnings?range=week` per PRD §9.11c.1)
  thisMonth: number;
  total: number;
  history: { ts: number; amount: number }[]; // recent entries
}

export interface GlobalStats {
  activeDevices: number;
  paidToday: number;
  nodes: number;
  countries: number;
  uptime: number;
  todayIncrement: number;
}

// ⚠️ MOCK STATE MACHINE — INCOMPLETE FOR PRODUCTION
// Missing terminal/recoverable states a real on-chain withdrawal needs:
//   - "review-rejected"  // KYC mismatch / risk flag → user must contact support
//   - "address-invalid"  // bad checksum / wrong network → re-submit
//   - "tx-failed"        // on-chain tx broadcast but reverted → re-attempt
//   - "tx-orphaned"      // tx mined then re-orgged out → re-attempt
//   - "refunded"         // ops manual reverse → balance credited back
//   - "frozen"           // compliance hold (sanctions / OFAC) → indefinite
// Production: server is canonical; client polls `GET /api/withdrawals/:id`
// or subscribes to a websocket. Client never advances state.
export type WithdrawalStatus =
  | "submitted"
  | "review-passed"
  | "processing"
  | "sent"
  | "confirmed";

export interface Withdrawal {
  id: string;
  amount: number;
  network: "USDT-TRC20" | "USDT-ERC20" | "BTC" | "ETH";
  address: string;
  fee: number;
  status: WithdrawalStatus;
  riskRoute?: WithdrawalRiskRoute;
  riskReasons?: string[];
  submittedAt: number;
  estimatedCompletion: number;
}

export interface AppState {
  accountKey: string;
  entrySurface: EntrySurface;
  accountCloudUpdatedAt: number;
  user: UserState;
  devices: Device[];
  visibleDevices: Device[];
  slotDevices: Device[];
  activeSlotCount: number;
  earnings: EarningsState;
  global: GlobalStats;
  latestWithdrawal: Withdrawal | null;
  // Actions
  bindAccount: (accountKey: string, entrySurface?: EntrySurface) => void;
  persistAccountSnapshot: () => void;
  tick: (deltaMs: number) => void;
  /** Adds a new inventory (inactive) device. Returns the new device id so
   *  callers can sequentially activate / debit / bill without guessing
   *  which device is "the new one" via `.filter(kind).pop()` heuristics
   *  (Batch C Round 1 P0 #4 — pop() picked wrong device when inventory
   *  already had a same-kind device at higher array index). */
  addDevice: (kind: DeviceKind, options?: { gpuModel?: string; gpuTier?: GpuTier; gpuTiers?: GpuTier[] }) => string;
  // Sprint #146-1 — slot lifecycle. activateDevice sets activatedAt=now and
  // refuses if active count already at MAX_DEVICES. deactivateDevice clears
  // activatedAt + zeroes runtime telemetry so the device exits earnings/quest
  // contribution while remaining in inventory.
  activateDevice: (id: string, reservedSlots?: number) => boolean;  // returns false on cap hit / not found / already active
  connectComputeShareDevice: (gpuModel?: string, reservedSlots?: number) => {
    ok: boolean;
    deviceId?: string;
    reason?: "disabled" | "slots-full" | "activation-failed";
  };
  deactivateDevice: (id: string) => void;
  /** Marks device for deactivation after current task completes; tick() picks it up. */
  scheduleDeactivation: (id: string) => void;
  /** ⚠️ MOCK-ONLY: demo helper. Lets the UI toggle isCharging /
   *  isWifiConnected / batteryLevel on a phone device. Real backend pulls
   *  these from device-agent heartbeat — client must NOT mutate. */
  setPhoneRuntime: (
    id: string,
    patch: Partial<Pick<Device, "isCharging" | "isWifiConnected" | "batteryLevel">>,
  ) => void;
  // Sprint trade-in foundation (Batch B) — atomic device-array actions.
  // Composers (UI handlers) must wrap with bills + receipts + balance per
  // ⚠️ MOCK-ONLY CROSS-STORE block at the implementation site in
  // lib/store/index.ts (each action's JSDoc above the body documents the
  // composer pattern + production endpoint).
  /** Recycle a device for salvage credit. Removes from devices[], returns
   *  salvage amount in USDT. Does NOT touch balance. */
  recycleDevice: (id: string) => {
    ok: boolean;
    salvageCredit: number;
    ageMonths: number;
    removedDevice: Device | null;
    error?: string;
  };
  /** Atomic Path-A trade-in: recycle old + add new + activate new in ONE set.
   *  Returns salvageCredit so caller applies via debitBalance(price - salvage).
   *  NEVER credits balance directly (Architect invariant #M2). */
  replaceDevice: (oldId: string, newKind: DeviceKind) => {
    ok: boolean;
    salvageCredit: number;
    newDeviceId: string | null;
    ageMonths: number;
    /** Snapshot of removed device. Caller uses this to manually re-insert if
     *  the post-replace debit step fails. NEVER mutate this snapshot —
     *  treat as opaque rollback token. */
    removedDevice: Device | null;
    error?: string;
  };
  /** Path-B: send active device to inventory (zeroes telemetry, preserves
   *  device in array with activatedAt=null). Semantic alias of deactivateDevice. */
  moveToInventory: (id: string) => boolean;
  /** Atomic deposit: credits usdtBalance + bumps cumulativeDepositUsdt in ONE set.
   *  Topup page calls this instead of bare creditBalance so eligibility rules
   *  (`cumulative-deposit-usdt`) stay in sync with actual deposit flow. */
  recordDeposit: (amount: number) => boolean;
  // Sprint 2 third phase — prototype demo helpers (PM-facing, not user-facing)
  _devSeedLegacyDevice: (kind: DeviceKind, monthsAgo: number) => void;
  _devFastForwardAll: (months: number) => void;
  _devResetDevices: () => void;
  // Sprint A-1 / E.2 — bump lifetime earnings to trigger milestone celebrations on demand
  _devBumpEarningsTotal: (amountUSD: number) => void;
  creditBalance: (amount: number) => void;  // KYC-Express $1 credit (v3.2)
  debitBalance: (amount: number) => boolean; // returns false if insufficient
  creditNex: (amount: number) => void;
  debitNex: (amount: number) => boolean;
  creditRewardBucket: (route: EarningBucketRoute, usdt: number, nex?: number) => boolean;
  submitWithdrawal: (
    amount: number,
    network: Withdrawal["network"],
    address: string,
    fee: number,
    riskRoute?: WithdrawalRiskRoute,
    riskReasons?: string[],
  ) => string | null; // fee = new-model actualFee (grossFee − NEX offset); null when insufficient balance
  advanceWithdrawal: () => void;
}
