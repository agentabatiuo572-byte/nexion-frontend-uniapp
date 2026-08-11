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
