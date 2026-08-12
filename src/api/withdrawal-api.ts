import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import type { Withdrawal, WithdrawalStatus, WithdrawalTerminalReason } from "../store/types";
import type { WithdrawalRiskRoute } from "../store/config-types";

export type SupportedWithdrawalNetwork = "USDT-TRC20" | "USDT-BEP20" | "USDT-ERC20";

export interface WithdrawalSubmission {
  withdrawalNo: string;
  amount: number;
  chain: SupportedWithdrawalNetwork;
  status: string;
  holdUntil: string;
  networkConfirmUsd: number;
  networkFee: number;
  penaltyFee: number;
  grossFee: number;
  nexBurned: number;
  feeWaived: number;
  actualFee: number;
  netReceive: number;
  policyVersion: string;
  useNexFeeOffset: boolean;
  riskRoute: string;
  idSource: "server";
}

export interface WithdrawalPolicy {
  minAmount: number;
  dailyLimitCount: number;
  balanceMaxRatio: number;
  smallAmountThresholdUsd: number;
  payoutSlaHours: number;
  networkConfirmFeeUsd: Record<"trc20" | "bep20" | "erc20", number>;
  nexFeeOffsetRate: number;
  policyVersion: string;
  cooldownDays: number;
  complianceHoldEnabled: boolean;
  withdrawalEnabled: boolean;
  enabledNetworks: SupportedWithdrawalNetwork[];
  currentPhase: string;
  currentMonth: number;
  gateSource: "J1";
  source: "D5+H1";
}

/** 单据状态镜像 —— GET /api/withdrawals/:id (PRD §9.11f 的按 id 读单通式)。 */
export interface WithdrawalStatusSnapshot {
  withdrawalNo: string;
  status: WithdrawalStatus;
  /** 服务端记的实际到账时刻(仅 confirmed 有值);缺省由调用方回落到单据预计到账。 */
  confirmedAt: number | null;
  /** 终态原因(仅终态有值)。null = 服务端没给 / 非终态 —— 页面据此决定要不要出原因行。 */
  terminalReason: WithdrawalTerminalReason | null;
  /**
   * 服务端判定「用户能否就这笔重新发起」。null = 不适用 / 服务端没给。
   * 🔴 **不在客户端由原因码推导**:能不能重来是风控与人工处置的结论(同一个
   * `address-risk`,换个地址可以重提、命中黑名单则不能),客户端推一份等于第二个真理源。
   */
  retriable: boolean | null;
}

export interface WithdrawalApi {
  policy(): Promise<WithdrawalPolicy>;
  get(withdrawalNo: string): Promise<WithdrawalStatusSnapshot>;
  submit(
    amount: number,
    chain: SupportedWithdrawalNetwork,
    targetAddress: string,
    policyVersion: string,
    useNexFeeOffset: boolean,
    idempotencyKey: string,
  ): Promise<WithdrawalSubmission>;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown, min = 0): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= min ? parsed : null;
}

function parseSubmission(value: unknown): WithdrawalSubmission {
  const row = record(value);
  const chain = row?.chain;
  const withdrawalNo = text(row?.withdrawalNo);
  const status = text(row?.status);
  const holdUntil = text(row?.holdUntil);
  const riskRoute = text(row?.riskRoute);
  const amount = number(row?.amount, Number.EPSILON);
  const networkConfirmUsd = number(row?.networkConfirmUsd);
  const networkFee = number(row?.networkFee);
  const penaltyFee = number(row?.penaltyFee);
  const grossFee = number(row?.grossFee);
  const nexBurned = number(row?.nexBurned);
  const feeWaived = number(row?.feeWaived);
  const actualFee = number(row?.actualFee);
  const netReceive = number(row?.netReceive);
  const policyVersion = text(row?.policyVersion);
  const allowedRiskRoutes = new Set([
    "fast-pass",
    "delay",
    "manual",
    "high-manual",
    "escalated-manual",
    "freeze",
  ]);
  if (!row || !withdrawalNo || !status || !holdUntil || !riskRoute
      || !allowedRiskRoutes.has(riskRoute.toLowerCase())
      || !["USDT-TRC20", "USDT-BEP20", "USDT-ERC20"].includes(String(chain))
      || amount === null || networkConfirmUsd === null || networkFee === null || penaltyFee === null || grossFee === null
      || nexBurned === null || feeWaived === null || actualFee === null || netReceive === null
      || !policyVersion || typeof row.useNexFeeOffset !== "boolean"
      || row.idSource !== "server"
      || Math.abs(networkConfirmUsd - networkFee) > 0.000001
      || Math.abs(networkFee + penaltyFee - grossFee) > 0.000001
      || Math.abs(grossFee - feeWaived - actualFee) > 0.000001
      || Math.abs(amount - actualFee - netReceive) > 0.000001) {
    throw new ApiError({ kind: "protocol", message: "WITHDRAWAL_RESPONSE_INVALID" });
  }
  return {
    withdrawalNo,
    amount,
    chain: chain as SupportedWithdrawalNetwork,
    status,
    holdUntil,
    networkConfirmUsd,
    networkFee,
    penaltyFee,
    grossFee,
    nexBurned,
    feeWaived,
    actualFee,
    netReceive,
    policyVersion,
    useNexFeeOffset: row.useNexFeeOffset,
    riskRoute,
    idSource: "server",
  };
}

function parsePolicy(value: unknown): WithdrawalPolicy {
  const row = record(value);
  const minAmount = number(row?.minAmount, Number.EPSILON);
  const dailyLimitCount = number(row?.dailyLimitCount, 1);
  const balanceMaxRatio = number(row?.balanceMaxRatio, Number.EPSILON);
  const smallAmountThresholdUsd = number(row?.smallAmountThresholdUsd);
  const payoutSlaHours = number(row?.payoutSlaHours, 1);
  const networkFees = record(row?.networkConfirmFeeUsd);
  const trc20 = number(networkFees?.trc20);
  const bep20 = number(networkFees?.bep20);
  const erc20 = number(networkFees?.erc20);
  const nexFeeOffsetRate = number(row?.nexFeeOffsetRate);
  const policyVersion = text(row?.policyVersion);
  const cooldownDays = number(row?.cooldownDays, 1);
  const currentPhase = text(row?.currentPhase);
  const currentMonth = number(row?.currentMonth, 1);
  const rawEnabledNetworks = row?.enabledNetworks;
  const enabledNetworks = Array.isArray(rawEnabledNetworks)
    ? rawEnabledNetworks.filter((item): item is SupportedWithdrawalNetwork =>
      item === "USDT-TRC20" || item === "USDT-BEP20" || item === "USDT-ERC20")
    : [];
  if (!row || minAmount === null || dailyLimitCount === null || !Number.isInteger(dailyLimitCount)
      || balanceMaxRatio === null || balanceMaxRatio > 1
      || smallAmountThresholdUsd === null || smallAmountThresholdUsd > 500
      || payoutSlaHours === null || payoutSlaHours > 168 || !Number.isInteger(payoutSlaHours)
      || trc20 === null || bep20 === null || erc20 === null
      || trc20 > 25 || bep20 > 25 || erc20 > 25
      || [trc20, bep20, erc20].some((fee) => Math.abs(fee * 2 - Math.round(fee * 2)) > 0.000001)
      || nexFeeOffsetRate === null || nexFeeOffsetRate <= 0 || !policyVersion
      || cooldownDays === null || !Number.isInteger(cooldownDays)
      || !currentPhase || currentMonth === null || !Number.isInteger(currentMonth)
      || typeof row.complianceHoldEnabled !== "boolean"
      || typeof row.withdrawalEnabled !== "boolean" || row.gateSource !== "J1"
      || enabledNetworks.length !== (rawEnabledNetworks as unknown[])?.length
      || enabledNetworks.length === 0 || row.source !== "D5+H1") {
    throw new ApiError({ kind: "protocol", message: "WITHDRAWAL_POLICY_INVALID" });
  }
  return {
    minAmount,
    dailyLimitCount,
    balanceMaxRatio,
    smallAmountThresholdUsd,
    payoutSlaHours,
    networkConfirmFeeUsd: { trc20, bep20, erc20 },
    nexFeeOffsetRate,
    policyVersion,
    cooldownDays,
    complianceHoldEnabled: row.complianceHoldEnabled,
    withdrawalEnabled: row.withdrawalEnabled,
    enabledNetworks,
    currentPhase,
    currentMonth,
    gateSource: "J1",
    source: "D5+H1",
  };
}

function canonicalStatus(status: string): WithdrawalStatus {
  switch (status.trim().toUpperCase()) {
    case "REVIEW_PENDING":
    case "REVIEWING":
    case "EXTENDED_HOLD":
    case "DELAYED":
      return "review-pending";
    case "REVIEW_PASSED":
    case "PENDING_CHAIN":
      return "review-passed";
    case "PROCESSING":
      return "processing";
    case "SENT":
    case "CHAIN_SUBMITTED":
      return "sent";
    case "CONFIRMED":
    case "SUCCESS":
      return "confirmed";
    case "REJECTED":
    case "REVIEW_REJECTED":
      return "review-rejected";
    case "FROZEN":
      return "frozen";
    case "ADDRESS_INVALID":
      return "address-invalid";
    case "FAILED":
    case "TX_FAILED":
    // 🔴 孤块 / 死亡信件(后台 D2 的 TX_ORPHANED·DEAD)。两个码此前**一个都不认**,
    // 于是服务端一发这种终态,canonicalStatus 就抛 protocol → refreshRemoteWithdrawals
    // 的 `.catch(() => null)` 静默吞掉 → 这一单**永久停在「处理中」**,
    // 换绑入口与下一笔提现被连带永久拦死。立卡描述的症状正是以这个窄口径真实存活着。
    //
    // 归到既有 `tx-failed` 而不是新开一个客户端状态:对用户而言两者都是
    // 「转账没走成」,归过来即刻接上既有的失败终态处理(账单结算成失败 + 客服出口);
    // 新增状态要动 6 处枚举与三语文案,零用户可见收益。
    // ⚠️ 两处别把话说满(R1 复核时自查出来的,原文说满了):
    //   · 退款有**两条腿,状态不同**(2026-08-12 并入 z5 后复核):USDT 本金腿已由 z5 改走
    //     `refundWithdrawalDebit`(无远端早退,判据是「扣过才退」)—— **remote 下会真退**;
    //     NEX 抵扣费腿仍走 `creditRewardBucketOnce`,它 `if (remoteApiEnabled) return false`
    //     —— remote 下仍是空转,归 z6。所以这里只声称账单与客服出口,不替 NEX 那条腿打包票。
    //     (本包 fork 时整条腿都空转,那句话已过期;并入主线时复核后改的。)
    //   · **孤块与死亡信件坍缩后不可区分** —— terminalReason 的闭集里没有对应档位,
    //     它承载的是「为什么终结」(风控/地址/资料/撤回/其他),不是「哪一种链上失败」。
    //     用户侧两者本就同一句话;要区分得先在后台加码,那是新契约,不在本包。
    case "TX_ORPHANED":
    case "DEAD":
      return "tx-failed";
    case "REFUNDED":
      return "refunded";
    case "SUBMITTED":
    // PENDING 是后台状态表里 SUBMITTED 的别名(D2 statusLabel 第一行就并列写着)。
    // 漏它的后果和上面 TX_ORPHANED 那族一模一样,而且多一条更重的:建单响应回 PENDING 时,
    // toCanonicalWithdrawal 会在单据入表**之前**抛 —— 服务端已经扣了钱,客户端连单号都没留下,
    // 用户跳到追踪页看见「查无此单」。app.ts 为这个最坏态写的防御在抛点之后,够不着。
    case "PENDING":
      return "submitted";
    default:
      throw new ApiError({ kind: "protocol", message: "WITHDRAWAL_STATUS_INVALID" });
  }
}

function canonicalRiskRoute(route: string): WithdrawalRiskRoute {
  const normalized = route.trim().toLowerCase();
  switch (normalized) {
    case "fast-pass":
      return "pass";
    case "delay":
      return "delay";
    case "manual":
    case "high-manual":
    case "escalated-manual":
      return "manual";
    case "freeze":
      return "freeze";
    default:
      throw new ApiError({ kind: "protocol", message: "WITHDRAWAL_RESPONSE_INVALID" });
  }
}

/**
 * 终态原因码归一。**故意与 canonicalStatus 不对称:未知码回落 `other`,不抛。**
 *
 * 🔴 判据是「这个值驱动什么」:status 驱动钱与状态机(退款、账单结算、单槽占用),
 * 认不出就必须抛、绝不能猜;terminalReason 只驱动**显示哪一句话**。让它抛的话,
 * 运营在后台加一个新原因码,全体客户端就会在解析这一步炸掉 → 整张单据镜像失败 →
 * 单据永久停在「处理中」—— 那正是本包 §Why 第 2 条要消灭的缺陷,不能自己再造一个。
 * 回落到 `other`(闭集里本来就有的兜底档)用户看到的是通用话术 + 客服出口,是诚实降级。
 *
 * 漂移的**预防**在机器门(withdraw-terminal-reason-parity),不在运行期抛异常。
 */
function canonicalTerminalReason(value: string): WithdrawalTerminalReason {
  switch (value.trim().toUpperCase()) {
    case "RISK_HIT":
      return "risk-hit";
    case "ADDRESS_RISK":
      return "address-risk";
    case "DATA_MISMATCH":
      return "data-mismatch";
    case "USER_CANCELLED":
      return "user-cancelled";
    default:
      return "other";
  }
}

export function toCanonicalWithdrawal(
  submission: WithdrawalSubmission,
  address: string,
  submittedAt = Date.now(),
): Withdrawal {
  const estimatedCompletion = Date.parse(submission.holdUntil);
  if (!address.trim() || !Number.isFinite(estimatedCompletion)) {
    throw new ApiError({ kind: "protocol", message: "WITHDRAWAL_RESPONSE_INVALID" });
  }
  return {
    id: submission.withdrawalNo,
    amount: submission.amount,
    network: submission.chain,
    address: address.trim(),
    // 主线 FEAT-WD02 把 fee 从单数字改成结构化快照;服务端契约字段同语义、异命名:
    // networkFee→networkConfirmUsd · actualFee→actualFeeUsd · nexBurned 同名。
    // penaltyUsd 按主线口径「仅历史单存在,新单不生成」,故只在 >0 时带出。
    fee: {
      networkConfirmUsd: submission.networkFee,
      nexBurned: submission.nexBurned,
      actualFeeUsd: submission.actualFee,
      // 🔴 feeWaived 必须带出来:账单行的「减免 $X」原本用「毛费 − 实付」重建,
      // 漏 penaltyUsd 时会渲染成负数,而且那个数指的是三个源(z4 R2 P1-3)。
      // 服务端这一个字段就是权威值,parseSubmission 已按 `grossFee − feeWaived == actualFee` 校过。
      feeWaivedUsd: submission.feeWaived,
      ...(submission.penaltyFee > 0 ? { penaltyUsd: submission.penaltyFee } : {}),
    },
    status: canonicalStatus(submission.status),
    riskRoute: canonicalRiskRoute(submission.riskRoute),
    riskReasons: [],
    submittedAt,
    estimatedCompletion,
  };
}

/**
 * 状态镜像解析。🔴 fail-closed:单号 / 状态任一不合法即抛,调用方保持原状再问一次 ——
 * 「问不到」绝不能降级成「自己判一个」,那正是本轮要消灭的东西。
 */
/**
 * 🔴 抛不抛,判据是**这个字段驱动什么**(2026-08-11 R2 审计;上一版按「类型对不对」分,分错了)。
 *
 *   · 驱动钱与状态机的(`status`、单号身份)→ **fail-closed,认不出必抛**。猜一个 = 拿钱赌。
 *   · 只驱动**显示哪一句话**的(`confirmedAt` / `terminalReason` / `retriable`)
 *     → **坏值一律降级成「没给」,绝不抛**。
 *
 * 为什么显示字段不许抛:抛出去被调用方 `.catch(() => null)` 吞掉 → **整张单据镜像失败** →
 * 这一单永久停在「处理中」,换绑入口与下一笔提现连带永久拦死。代价却只是一句话没显示。
 * 上一版让 `retriable` 类型不对就抛,等于「为了不显示错一句话,把用户的单子锁死」——
 * 而这正是本包 §Why 要消灭的那个缺陷,不能自己再造一个。
 */
function parseStatusSnapshot(value: unknown, expectedWithdrawalNo: string): WithdrawalStatusSnapshot {
  const row = record(value);
  const withdrawalNo = text(row?.withdrawalNo);
  const status = text(row?.status);
  if (!row || !withdrawalNo || !status) {
    throw new ApiError({ kind: "protocol", message: "WITHDRAWAL_RESPONSE_INVALID" });
  }
  // 🔴 身份必须对上(R2 审计):响应里的单号此前解析出来就没人看过,而调用方是按**请求的**
  // 单号落补丁的 —— 服务端一旦串号(反代缓存 / 并发 bug),另一张单的状态会被写到这张单上,
  // 顺带触发按状态走的退款与账单结算。这是拿钱赌,归 fail-closed 那一档。
  if (withdrawalNo !== expectedWithdrawalNo) {
    throw new ApiError({ kind: "protocol", message: "WITHDRAWAL_RESPONSE_INVALID" });
  }
  // 到账时刻:毫秒数或 ISO 串。读不出来就当没给 —— 它只用来显示「几点到的」,
  // 而调用方对 null 本来就有回落(取预计到账)。`0` 是服务端最常见的「未设置」哨兵值,
  // 上一版把它判成协议错并抛,一个哨兵值就能把整张单据锁死(R2 审计)。
  const rawConfirmedAt = row.confirmedAt;
  let confirmedAt: number | null = null;
  if (rawConfirmedAt !== null && rawConfirmedAt !== undefined && rawConfirmedAt !== "") {
    const parsed = typeof rawConfirmedAt === "number" ? rawConfirmedAt : Date.parse(String(rawConfirmedAt));
    confirmedAt = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  // 终态原因:只认字符串码;非字符串(对象 / 数组 / 数字)一律当没给,**不当成码吞掉**
  // ——「不认识的码回落 other」说的是码,不是「任何垃圾都是码」。
  // 认识不了的**字符串**码回落 `other`(闭集里本就有的兜底档):运营加新码不该打死老客户端。
  const rawReason = row.terminalReason;
  const terminalReason: WithdrawalTerminalReason | null =
    typeof rawReason === "string" && rawReason.trim() ? canonicalTerminalReason(rawReason) : null;
  // 可重试:只认布尔;其余一律当没给(页面对 null 的处理就是「不显示这句话」)。
  const rawRetriable = row.retriable;
  const retriable: boolean | null = typeof rawRetriable === "boolean" ? rawRetriable : null;
  return { withdrawalNo, status: canonicalStatus(status), confirmedAt, terminalReason, retriable };
}

export function createWithdrawalApi(client: ApiClient): WithdrawalApi {
  return {
    policy: async () => parsePolicy(await client.request({
      method: "GET",
      path: "/api/withdrawals/policy",
    })),
    get: async (withdrawalNo) => parseStatusSnapshot(await client.request({
      method: "GET",
      path: `/api/withdrawals/${encodeURIComponent(withdrawalNo)}`,
    }), withdrawalNo),
    submit: async (amount, chain, targetAddress, policyVersion, useNexFeeOffset, idempotencyKey) =>
      parseSubmission(await client.request({
        method: "POST",
        path: "/api/withdrawals",
        body: { amount, chain, address: targetAddress, policyVersion, useNexFeeOffset },
        idempotencyKey,
        timeoutMs: 30_000,
      })),
  };
}
