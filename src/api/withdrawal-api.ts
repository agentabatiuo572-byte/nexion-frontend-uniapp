import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import type { Withdrawal, WithdrawalStatus } from "../store/types";
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
  /** FEAT-WD01 §4.6:服务端已退还的已烧 NEX(既成事实)。后端未上该字段时解析为 0。 */
  nexRefunded: number;
  /**
   * FEAT-WD01 §4.6:退款**发生**的时刻。**线上是 ISO-8601 字符串**,本字段是解析后的 epoch ms
   * (与 `Withdrawal.submittedAt` / `confirmedAt` 同口径,便于直接比较)。
   *
   * 🔴 缺失 / 不可解析 = `undefined`,**不是 0**:0 是 1970-01-01,下游会把它当成一个真时刻,
   * 冲正行落进 1970 年那一组 —— 比它要修的那个 bug 还远。「没有」必须长得不像「有」。
   */
  nexRefundedAt?: number;
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

export interface WithdrawalApi {
  policy(): Promise<WithdrawalPolicy>;
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
  // 🔴 FEAT-WD01 §4.6 已退还 NEX ——「宽松解析」是刻意的,理由与 §4.5 第二批字段同一条:
  // 严格必填 = 后端还没上这个字段就整单被拒,**而钱已经扣了**(异常6,本规格最贵的失败模式)。
  // 坏值一律读作 0 = 没退,这是安全侧:漏记一条冲正可自愈(下次取到就补),凭空写一条是造假。
  //
  // 🔴 **不能复用共用的 `number()`**(2026-08-11 独立审计实测):它内部是 `Number(value)`,于是
  // `true → 1`、`"3" → 3`、`[3] → 3`、`2.5 → 2.5` 全部通过。后端若发规格 §4.6③ 明确否掉的
  // boolean 形状,客户端会读成 **1**,在烧 3 退 3 的单上落一条「退回 1 NEX」——
  // 账本上那个数指不到任何源,而钱包实收 3。宽松解析赖以成立的「坏值 = 安全侧」前提当场被破。
  // 上一版注释写的正是「非数字一律读作 0」,与实际行为相反(本仓第四次栽在
  // 「注释声称了没验证过的行为」上,这次栽在我自己手上)。
  //
  // 故这里**只认真正的 JSON number**,并按 §4.6② 的值域收口:非有限数 / 负数 / 非整数一律 0。
  // 整数在解析层判(而不是留给消费方):它是**契约值域**,越界即协议不合,与「≤ nexBurned」
  // 那条**跨字段**不变量不同 —— 后者依赖 fee 且存量单走不同来路,仍收在消费点一处。
  const rawNexRefunded = row?.nexRefunded;
  const nexRefunded = typeof rawNexRefunded === "number"
      && Number.isFinite(rawNexRefunded) && Number.isInteger(rawNexRefunded) && rawNexRefunded >= 0
    ? rawNexRefunded
    : 0;
  // 🔴 §4.6 退款**发生时刻**(线上 ISO-8601 字符串 → 这里转 epoch ms)。宽松档同上一段:
  // 缺失 / 坏值一律当「没给」,**绝不抛协议错** —— 严格必填 = 后端没上该字段就整单被拒,而钱已经扣了。
  //
  // 🔴 不能只靠 `Date.parse`:它对非 ISO 串出奇地宽容 —— `Date.parse("3")` 在 V8 上是
  // **2003-01-01**、`Date.parse("2026")` 是 2026-01-01,后端错发一个裸数字串就能把这条冲正行
  // 扔进 2003 年那一组,而门与 tsc 全绿。这与同批 `nexRefunded` 栽的那一下同型(`Number(true) === 1`)。
  // 故先按契约声明的形状卡一道:必须以 ISO-8601 的**日历日** `YYYY-MM-DD` 起头才进 `Date.parse`。
  //
  // 🔴 门槛划在「到日」而不是「到分」:这个值的唯一用途是给冲正行定日期,而账单页按**月**分组 ——
  // 后端只发到日(`2026-08-05`)时月份仍然是准的,拒掉它反而回落到观测时刻、可能落到别的月去。
  // 宽松说的是「可以没有」,不是「什么都收」:形状不对 = 当没给,而不是硬解一个数出来。
  const rawNexRefundedAt = text(row?.nexRefundedAt);
  const parsedNexRefundedAt = rawNexRefundedAt && /^\d{4}-\d{2}-\d{2}/.test(rawNexRefundedAt)
    ? Date.parse(rawNexRefundedAt)
    : Number.NaN;
  const nexRefundedAt = Number.isFinite(parsedNexRefundedAt) && parsedNexRefundedAt > 0
    ? parsedNexRefundedAt
    : undefined;
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
    nexRefunded,
    nexRefundedAt,
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
      return "tx-failed";
    case "REFUNDED":
      return "refunded";
    case "SUBMITTED":
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
    // 🔴 顶层带出,不进 `fee`(fee 是报价快照,请求/响应同构;退款是事后事件)。
    // 提交回执上它**几乎恒为 0** —— 提交那一刻就被拒的单按规格是「零副作用、不烧 NEX」,
    // 没 NEX 可退。真正会带非 0 值的是**状态回查**端点。
    //
    // 🔴 **别指望那条端点会自动带上这个字段**(2026-08-11 独立审计当场证伪了我上一版的断言)。
    // 上一版这里写的是「那条端点复用本函数,字段自然跟着走,届时无需再改这里」——
    // 而回查端点已经在并行包 z7 里写完了:它有**自己的**响应类型与解析器
    // (`WithdrawalStatusSnapshot` / `parseStatusSnapshot`),只回 withdrawalNo/status/
    // confirmedAt/terminalReason/retriable 五个字段,**不经过本函数**,也就不带 `nexRefunded`。
    // 两包各自合入主线后,这条冲正照样一次都不会触发 —— 与本包声称修好的缺陷完全同形。
    // 我把「另一层会配合」当成了事实写进注释,这正是本包审计出的根因。
    // 现状与需要谁做什么,见 HANDOFF U-9;跨包判据由 `selfcheck-withdraw-nex-refund.mjs`
    // 的「回查响应字段 ⊇ 冲正判据字段」一格盯着。
    nexRefunded: submission.nexRefunded,
    // 🔴 时刻与金额**必须一起带出**:账单页按 `ts` 分月分组,冲正行只有拿到退款发生的时刻
    // 才落得进正确那个月。少带它,冲正行就只能盖提交时刻 —— 7 月提交、8 月退还会显示成 7 月的事
    // (见 lib/withdrawal-bill-drafts 的 `nexRefundAtMs`)。二者是同一件事实的两个面,别拆开传。
    nexRefundedAt: submission.nexRefundedAt,
  };
}

export function createWithdrawalApi(client: ApiClient): WithdrawalApi {
  return {
    policy: async () => parsePolicy(await client.request({
      method: "GET",
      path: "/api/withdrawals/policy",
    })),
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
