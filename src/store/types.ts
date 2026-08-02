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
  // PRD §6.11 登记锚点: epoch ms of the last earnings settlement. Set on
  // activation (= registration), advanced by app.ts settle() on each accrual.
  // Earnings accrue by wall-clock (now - lastSettledAt), NOT by accumulated tick
  // time — so a closed/backgrounded gap is settled in one shot on reopen (mock;
  // PROD: the server holds this anchor and settles on the foreground call).
  // null = not currently earning (inactive / frozen); re-anchored on resume.
  lastSettledAt?: number | null;
  // SPEC-1 R7: last resident device-agent heartbeat. This drives the online
  // factor tier; the shell used to view the account never does. PROD replaces
  // the mock timestamp with the server-canonical conclusion produced from the
  // candidate POST /api/device/:id/heartbeat contract (PRD §6.11/§12.2).
  onlineHeartbeatAt?: number | null;
  // Sprint #146-1 supplement: when user requests "deactivate after current task
  // completes" (instead of forfeit-and-deactivate-now), this flag stays true
  // until tick() sees currentTask transition complete → triggers deactivation.
  // Cleared by activateDevice() and by tick() after auto-deactivation fires.
  pendingDeactivate?: boolean;
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
  // FEAT-DEV02 置换阶梯分子: lifetime USD output of THIS device. Accrued ONLY by
  // app.ts settleDevice() in lockstep with todayEarnings; NEVER reset by
  // deactivation / today-zeroing. Multi-account snapshots merge it additively
  // (account-cloud ADDITIVE_NUMBER_KEYS three-way diff — no double count).
  // NEX output intentionally excluded from the trade-in base (FEAT-DEV02 ③).
  cumulativeEarningsUsdt: number;
  // FEAT-DEV02 置换阶梯分母: what the user actually paid (catalog price at
  // purchase today; promo pricing would write the actual paid amount). 0 =
  // free/gifted (phone, pc-gpu) → never trade-in eligible. Immutable once set.
  paidPriceUsdt: number;
  // For NexGridBox cards
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
  /** MOCK registration/reward idempotency receipts, merged with the same
   * account snapshot as the credited balances. PROD owns these on the
   * canonical reward transaction instead of client state. */
  appliedRewardKeys?: Record<string, true>;
  /** Lifetime sum of completed USDT deposits/topups. Used by tradein eligibility
   *  `cumulative-deposit-usdt` rule. Seeded 0; incremented ONLY by recordDeposit
   *  action (NOT earnings, NOT exchange, NOT trade-in credit, NOT KYC bonus,
   *  NOT weekly-quest reward).
   *  ⚠️ MOCK-ONLY: production server-canonical via
   *  GET /api/users/me.cumulativeDepositUsdt
   *  (TBD; candidate, not in PRD §9.11 — read endpoint name pending). */
  cumulativeDepositUsdt: number;
  /** 已核销的创世邀请码(FEAT-GEN08 资格通道4)。per-user 凭证,必须随
   *  account-cloud 快照按账号走(设备级存储会跨账号继承 → 资格门旁路)。
   *  null = 未核销。仅由 setGenesisInviteCode action 写入(格式校验)。
   *  ⚠️ MOCK-ONLY: production = POST /api/genesis/invite/redeem server 核销。 */
  genesisInviteCode: string | null;
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
  nodes: number;
  countries: number;
  uptime: number;
  activeJobs: number; // concurrent grid jobs (globe stat tile)
}

// SPEC-7 FEAT-RISK03 提现单状态机。主链 submitted → (review-pending →)
// review-passed → processing → sent → confirmed;异常态由风控路由/人工处置进入。
// "address-invalid" / "tx-failed" / "refunded" 为结构补全(mock 不驱动,PROD 服务端驱动)。
// Production: server is canonical; client polls `GET /api/withdrawals/:id`
// or subscribes to a websocket. Client never advances state.
export type WithdrawalStatus =
  | "submitted"
  | "review-pending" // K3 route manual/delay → D2 人工/延迟队列
  | "review-passed"
  | "processing"
  | "sent"
  | "confirmed"
  | "review-rejected" // 异常终态: 人工审核拒绝
  | "frozen" // 异常态: 风控/合规冻结(K3 route freeze 或 D2 处置)
  | "address-invalid"
  | "tx-failed"
  | "refunded";

export interface Withdrawal {
  id: string;
  amount: number;
  network: "USDT-TRC20" | "USDT-BEP20" | "USDT-ERC20";
  address: string;
  fee: number;
  status: WithdrawalStatus;
  riskRoute?: WithdrawalRiskRoute;
  riskReasons?: string[];
  /** FEAT-WD01a:本单是否命中小额免审快车道。 */
  fastLaneApplied?: boolean;
  /** FEAT-WD01a:被快车道免掉的闸名。必须随单落盘 —— 只算不存 = 事后审计与客服
   *  都还原不出「这单当时免了哪几道」,等于没做。与 riskReasons 同源同去处。 */
  waivedGates?: string[];
  submittedAt: number;
  estimatedCompletion: number;
  /** FEAT-WD01b:实际到账时刻(仅 confirmed 态有值)。推进逻辑见 withdrawal-arrival-core。 */
  confirmedAt?: number;
}

// ── 入金(PAY-越南支付架构规格 v1.0 [FEAT-PAY01]③④ / [FEAT-PAY02]③)──────
// 全站唯一通道枚举,前后台单源(后台 D1 渠道配置 / C1 投入卡 channel 同源单写)。
export type DepositChannel =
  | "usdt-trc20"
  | "usdt-erc20"
  | "usdt-bep20"
  | "bank-vietqr"
  | "card-intl";

/** 链上三网络子集(专属地址 / txHash / 确认数仅链上通道适用)。 */
export type ChainDepositChannel = Extract<
  DepositChannel,
  "usdt-trc20" | "usdt-erc20" | "usdt-bep20"
>;

// [FEAT-PAY01] ④ 链上入金状态机:detected → confirming → credited(终态);
// 金额 < 最低额 → dust_hold → (credited | returned,后台人工处置)。
// credited/returned 终态禁任何再处置;status server-canonical,client 绝不本地推进。
export type DepositStatus = "detected" | "confirming" | "credited" | "dust_hold" | "returned";

/** 入金记录(三类通道共用;银行轨由意向单入账时生成并互相关联)。 */
export interface DepositRecord {
  /** server mint `DP-YYYYMMDD-NNNN`(与提现 WD- 同族),禁客户端造。 */
  depositId: string;
  channel: DepositChannel;
  /** 实收金额(链上按实际到账);两位小数。 */
  grossAmountUsdt: number;
  /** 按通道费率表(后台 D1 配置)server 计算;client 仅展示。 */
  feeUsdt: number;
  /** = gross − fee;入账额。 */
  creditedUsdt: number;
  /** 链上必:每用户 × 每网络专属充值地址(server 派发,恒定不轮换)。 */
  address?: string;
  /** 链上必:链上交易哈希 = 幂等键(同 txHash 重复上报 no-op)。 */
  txHash?: string;
  /** 卡轨必:收单方授权号 = 幂等键(同 authCode 重复回调 no-op)。 */
  authCode?: string;
  /** 链上必:当前确认数;server 推进。 */
  confirmations?: number;
  /** 链上必:默认 TRC20 20 · ERC20 12 · BEP20 15(后台 D1 可配)。 */
  requiredConfirmations?: number;
  status: DepositStatus;
  /** ms epoch,服务端时间戳。 */
  createdAt: number;
  creditedAt?: number;
}

// [FEAT-PAY02] ④ 银行轨意向单状态机(本文件只定形状;意向单生命周期动作归 A4)。
export type DepositIntentStatus =
  | "awaiting_payment"
  | "credited"
  | "expired"
  | "mismatch_review"
  | "cancelled"
  | "return_pending";

/** 入金意向单(VietQR 银行轨专用;入账时生成 DepositRecord 并互相关联)。 */
export interface DepositIntent {
  /** server mint `DP-YYYYMMDD-NNNN`(与链上同号段)。 */
  intentId: string;
  /** 用户输入;≥ $10 等值,≤ 单笔上限 $5,000(D1 可配)。 */
  usdtAmount: number;
  /** 下单锁定牌价([FEAT-PAY03] quoteRate);单上恒定,后续调价不影响在途单。 */
  fxRate: number;
  /** = round(usdtAmount × fxRate),精确到盾不凑整千;server 计算。 */
  vndAmount: number;
  /** server mint `NX-` + 6 位大写字母数字;在途期内全局唯一。 */
  memoCode: string;
  /** 收款账户池按轮换策略分配;server 派发(用户需完整账号转账,不脱敏)。 */
  bankAccount: { accountName: string; accountNumber: string; bankName: string };
  status: DepositIntentStatus;
  /** ms epoch;创建 + 30min 锁价窗(宽限 10min,D1 可配)。 */
  expireAt: number;
  /** 回单实收金额(VND)。 */
  receivedVnd?: number;
  /** 回单匹配时间(ms epoch)。 */
  matchedAt?: number;
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
  // FEAT-DEV02 upgrade trade-in — there is deliberately NO dedicated store
  // action: the checkout persist block composes it atomically (debit net →
  // remove old device → createOrder{tradeInCredit, tradeInDeviceId} → bill).
  // Credit = computeTradeInCredit(paidPriceUsdt, cumulativeEarningsUsdt,
  // targetPrice) — checkout-only, NEVER credited to balance. Production:
  // POST /api/orders carries tradeInDeviceId; server re-computes the credit
  // and retires the device in the same transaction.
  /** Atomic deposit: credits usdtBalance + bumps cumulativeDepositUsdt in ONE set.
   *  Topup page calls this instead of bare creditBalance so eligibility rules
   *  (`cumulative-deposit-usdt`) stay in sync with actual deposit flow. */
  recordDeposit: (amount: number) => boolean;
  /** 核销创世邀请码(格式校验,合法即写入 user.genesisInviteCode 并随快照持久)。 */
  setGenesisInviteCode: (raw: string) => boolean;
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
  ) => string | null; // fee = new-model actualFee (grossFee − NEX offset); null when insufficient balance or reject route
  /** ⚠️ DEV/DEMO-ONLY: 仅 pass 路由可推进主链状态(SPEC-7: client 不推进风控队列)。 */
  _devAdvanceWithdrawal: () => void;
  /** ⚠️ DEV/DEMO-ONLY: 模拟 D2 人工放行全部待审收益(mock 双端不打通,DR-7)。 */
  _devGrantManualRelease: () => void;
}
