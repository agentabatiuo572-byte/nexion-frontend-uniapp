import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";
import type { ApiEnvironment } from "./runtime-config";

export interface VRankProvenance {
  serverCanonical: true;
  sourceEnvironment: "PRODUCTION" | "SANDBOX";
  runId: string;
}

/** 服务端能力位:某类收益今天是否真的会派发。与佣金指南同源,同一份事实。 */
export interface CommissionCapabilities {
  peer: boolean;
  genesis: boolean;
}

export interface CanonicalVRankRow {
  v: number;
  title: string;
  cnTitle: string;
  selfComputePoints?: number;
  directRefs?: number;
  teamComputePoints?: number;
  requiredDownlineRank?: number;
  requiredDownlineCount?: number;
  directBonus: number;
  purchaseL1Rate?: string;
  purchaseL2Rate?: string;
  monthlySalaryUsdt?: string;
  reviewRequired?: boolean;
  unilevelDepth: number;
  peerBonus: number;
  leadershipVotes: number;
  cultivationBonus: number;
  rewards: CanonicalVRankReward[];
  visible: boolean;
}

export interface MonetaryVRankReward {
  type: "USDT" | "UVT";
  amount: number;
  voucherId?: string;
  skuId?: string;
  customLabel?: string;
}

export interface EntitlementVRankReward {
  type: "VOUCHER" | "SKU" | "CUSTOM";
  amount?: number;
  voucherId?: string;
  skuId?: string;
  customLabel?: string;
  displayName?: string;
}

export type CanonicalVRankReward = MonetaryVRankReward | EntitlementVRankReward;

export interface CanonicalVRankLadder {
  source: string;
  prizeName: string;
  /**
   * 服务端能力位:某类收益今天是否真的会派发。
   *
   * 🔴 等级阶梯里的 peerBonus 是「该等级配置的比例」,不是「现在会发」。没有这个
   *   能力位,App 只能把配置比例当成已生效权益展示(V3–V8 逐级「平级 5%」),
   *   与玩法说明的「未开放」自相矛盾(zentao #79)。
   */
  capabilities: CommissionCapabilities;
  serverCanonical: true;
  sourceEnvironment: "PRODUCTION" | "SANDBOX";
  runId: string;
  ranks: CanonicalVRankRow[];
}

export interface RankSalaryAmount {
  month: string;
  rankCode: string;
  amountUsdt: string;
  claimableFrom: string;
}

export interface RankSalaryMonth extends RankSalaryAmount {
  status: "PENDING" | "CLAIMABLE" | "CLAIMED";
  expiresAt: string;
  claimNo?: string | null;
  claimedAt?: string | null;
}

export interface RankSalary {
  businessDate: string;
  months: RankSalaryMonth[];
  upcoming: RankSalaryAmount | null;
  nextClaimableFrom: string | null;
}

export interface RankSalaryClaim {
  month: string;
  amountUsdt: string;
}

export type RankSalaryReceipt =
  | { status: "NOT_FOUND" }
  | { status: "PROCESSING" }
  | { status: "SUCCEEDED"; month: string; rankCode: string; amountUsdt: string; claimNo: string }
  | { status: "REJECTED"; month: string; rejectionCode: string; amountUsdt?: string };

const SALARY_CLAIM_REJECTIONS = [
  { status: 409, code: 409, message: "SALARY_AMOUNT_CHANGED" },
  { status: 409, code: 409, message: "SALARY_ALREADY_CLAIMED" },
  { status: 422, code: 422, message: "COVERAGE_BELOW_REDLINE" },
  { status: 503, code: 503, message: "COVERAGE_UNAVAILABLE" },
  { status: 503, code: 503, message: "SALARY_CREDIT_UNAVAILABLE" },
] as const;

export interface CanonicalVRankState {
  source: string;
  serverCanonical: true;
  sourceEnvironment: "PRODUCTION" | "SANDBOX";
  runId: string;
  rankCode: string;
  salary?: RankSalary | null;
  progress: {
    selfComputePoints: number;
    directRefs: number;
    teamComputePoints: number;
    vDownlineCounts: Record<string, number>;
  };
}

export interface VRankApi {
  ladder(): Promise<CanonicalVRankLadder>;
  current(): Promise<CanonicalVRankState>;
  claimSalary(key: string, claim: RankSalaryClaim): Promise<RankSalaryReceipt>;
  salaryReceipt(key: string, month: string): Promise<RankSalaryReceipt>;
}

function invalid(): never {
  throw new ApiError({ kind: "protocol", message: "V_RANK_RESPONSE_INVALID" });
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return invalid();
  return value.trim();
}

function number(value: unknown, minimum = 0): number {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed < minimum) return invalid();
  return parsed;
}

function optionalNumber(value: unknown, minimum = 0): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  return number(value, minimum);
}

/** Additive platform-count fields. Missing is unknown; never coerce money or strings. */
function optionalComputePoints(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  return computePoints(value);
}

function computePoints(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return invalid();
  return value;
}

function integer(value: unknown, minimum = 0): number {
  const parsed = number(value, minimum);
  if (!Number.isInteger(parsed)) return invalid();
  return parsed;
}

function optionalText(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  return text(value);
}

function salaryAmount(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9]{1,12}(\.[0-9]{1,6})?$/.test(value)) return invalid();
  return value;
}

// Jackson emits BigDecimal purchase rates as JSON numbers. Keep their decimal
// representation from the boundary onward, including an explicit zero rate.
function optionalPurchaseRate(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const rate = typeof value === "number" ? String(value) : value;
  if (typeof rate !== "string" || !/^(0(\.\d+)?|1(\.0+)?)$/.test(rate)) return invalid();
  return rate.replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");
}

function salaryInstant(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) || !Number.isFinite(Date.parse(value))) return invalid();
  return value;
}

function salaryEntry(source: Record<string, unknown>): RankSalaryAmount {
  const { month, rankCode } = source;
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    || typeof rankCode !== "string" || !/^V[0-8]$/.test(rankCode)) return invalid();
  return { month, rankCode, amountUsdt: salaryAmount(source.amountUsdt), claimableFrom: salaryInstant(source.claimableFrom) };
}

function salaryBusinessDate(businessDate: unknown): string {
  if (typeof businessDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) return invalid();
  const day = new Date(businessDate + "T00:00:00Z");
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== businessDate) return invalid();
  return businessDate;
}

function salaryMonth(value: unknown): RankSalaryMonth {
  const row = record(value);
  const { status } = row;
  if (status !== "PENDING" && status !== "CLAIMABLE" && status !== "CLAIMED") return invalid();
  const claimNo = row.claimNo == null && status !== "CLAIMED" ? row.claimNo : text(row.claimNo);
  const claimedAt = row.claimedAt == null && status !== "CLAIMED" ? row.claimedAt : salaryInstant(row.claimedAt);
  return { ...salaryEntry(row), status, expiresAt: salaryInstant(row.expiresAt), claimNo, claimedAt };
}

export interface RankSalaryAttempt {
  item: RankSalaryMonth;
  businessDate: string;
  amountExpiresAt?: string;
}

export function readRankSalaryAttempt(value: unknown): RankSalaryAttempt {
  const source = record(value);
  const item = salaryMonth(source.item);
  if (item.status !== "CLAIMABLE") return invalid();
  return { item, businessDate: salaryBusinessDate(source.businessDate),
    amountExpiresAt: source.amountExpiresAt === undefined ? undefined : salaryInstant(source.amountExpiresAt) };
}

function readSalary(value: unknown): RankSalary {
  const source = record(value);
  if (!Array.isArray(source.months)) return invalid();
  return {
    businessDate: salaryBusinessDate(source.businessDate),
    months: source.months.map(salaryMonth),
    upcoming: source.upcoming === null ? null : salaryEntry(record(source.upcoming)),
    nextClaimableFrom: source.nextClaimableFrom === null ? null : salaryInstant(source.nextClaimableFrom),
  };
}

function readSalaryReceipt(value: unknown, month: string, httpStatus: number): RankSalaryReceipt {
  const row = record(value);
  const { status } = row;
  if (httpStatus === 200 && (status === "PROCESSING" || status === "NOT_FOUND")) return { status };
  if (row.month !== month) return invalid();
  if (httpStatus === 200 && status === "SUCCEEDED"
    && typeof row.rankCode === "string" && /^V[2-8]$/.test(row.rankCode)) {
    return { status, month, rankCode: row.rankCode, amountUsdt: salaryAmount(row.amountUsdt), claimNo: text(row.claimNo) };
  }
  if (status === "REJECTED") {
    const rejectionCode = text(row.rejectionCode);
    if (httpStatus !== 200 && !SALARY_CLAIM_REJECTIONS.some(entry =>
      entry.status === httpStatus && entry.message === rejectionCode && entry.code === row.httpStatus)) return invalid();
    const amountUsdt = rejectionCode === "SALARY_AMOUNT_CHANGED" ? salaryAmount(row.amountUsdt) : undefined;
    return { status, month, rejectionCode, amountUsdt };
  }
  return invalid();
}

function reward(value: unknown): CanonicalVRankReward {
  const source = record(value);
  const type = text(source.type).toUpperCase();
  if (type !== "USDT" && type !== "UVT" && type !== "VOUCHER" && type !== "SKU" && type !== "CUSTOM") return invalid();
  if (type === "USDT" || type === "UVT") {
    return { type, amount: number(source.amount), voucherId: optionalText(source.voucherId),
      skuId: optionalText(source.skuId), customLabel: optionalText(source.customLabel) };
  }
  const amount = optionalNumber(source.amount);
  const displayName = optionalText(source.displayName);
  return { type, ...(displayName === undefined ? {} : { displayName }), ...(amount === undefined ? {} : { amount }), voucherId: optionalText(source.voucherId),
    skuId: optionalText(source.skuId), customLabel: optionalText(source.customLabel) };
}

function rankRow(value: unknown): CanonicalVRankRow {
  const source = record(value);
  const v = integer(source.v);
  if (v > 8 || typeof source.visible !== "boolean") return invalid();
  const requiredRank = source.requiredDownlineRank == null || source.requiredDownlineRank === ""
    ? undefined
    : integer(String(source.requiredDownlineRank).replace(/^V/i, ""));
  if (!Array.isArray(source.rewards)) return invalid();
  if (source.reviewRequired !== undefined && typeof source.reviewRequired !== "boolean") return invalid();
  return {
    v,
    title: text(source.title),
    cnTitle: text(source.cnTitle),
    selfComputePoints: optionalComputePoints(source.selfComputePoints),
    directRefs: optionalNumber(source.directRefs),
    teamComputePoints: optionalComputePoints(source.teamComputePoints),
    requiredDownlineRank: requiredRank,
    requiredDownlineCount: optionalNumber(source.requiredDownlineCount),
    directBonus: number(source.directBonus),
    purchaseL1Rate: optionalPurchaseRate(source.purchaseL1Rate),
    purchaseL2Rate: optionalPurchaseRate(source.purchaseL2Rate),
    monthlySalaryUsdt: source.monthlySalaryUsdt === undefined ? undefined : salaryAmount(source.monthlySalaryUsdt),
    reviewRequired: source.reviewRequired,
    unilevelDepth: integer(source.unilevelDepth),
    peerBonus: number(source.peerBonus),
    leadershipVotes: integer(source.leadershipVotes),
    cultivationBonus: number(source.cultivationBonus),
    rewards: source.rewards.map(reward),
    visible: source.visible,
  };
}

function provenance(source: Record<string, unknown>, mode: ApiEnvironment): VRankProvenance {
  const sourceEnvironment = source.sourceEnvironment;
  const runId = source.runId;
  if ((mode !== "dev" && mode !== "prod") || source.serverCanonical !== true
      || sourceEnvironment !== "PRODUCTION" || runId !== "") {
    return invalid();
  }
  return { serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "" };
}

function ladder(value: unknown, mode: ApiEnvironment): CanonicalVRankLadder {
  const source = record(value);
  const proof = provenance(source, mode);
  if (!Array.isArray(source.ranks)) return invalid();
  const ranks = source.ranks.map(rankRow).sort((left, right) => left.v - right.v);
  if ((ranks.length < 1 || ranks.length > 13) || ranks.some((rank, index) => rank.v !== index)) return invalid();
  // 旧后端(尚未下发能力位)不能让整个阶梯判非法 —— 那会把等级页变成「数据不可用」,
  // 连配置比例都读不到。缺字段一律**失败关闭**为「不派发」:宁可少承诺,不能把配置
  // 比例写成已生效权益(#79)。字段在但类型不对属于协议违规,仍判非法。
  let capabilities: CommissionCapabilities = { peer: false, genesis: false };
  if (source.capabilities !== undefined && source.capabilities !== null) {
    const raw = record(source.capabilities);
    if (typeof raw.peer !== "boolean" || typeof raw.genesis !== "boolean") return invalid();
    capabilities = { peer: raw.peer, genesis: raw.genesis };
  }
  return {
    source: text(source.source), prizeName: text(source.prizeName),
    capabilities, ...proof, ranks,
  };
}

function current(value: unknown, mode: ApiEnvironment): CanonicalVRankState {
  const source = record(value);
  const proof = provenance(source, mode);
  const progress = record(source.progress);
  const rawCounts = record(progress.vDownlineCounts);
  const counts: Record<string, number> = {};
  for (const [key, count] of Object.entries(rawCounts)) {
    if (!/^[0-8]$/.test(key)) return invalid();
    counts[key] = integer(count);
  }
  const rankCode = text(source.rankCode).toUpperCase();
  if (!/^V[0-8]$/.test(rankCode)) return invalid();
  if (source.salary === null ? source.salaryUnavailable !== true : source.salaryUnavailable === true) return invalid();
  return {
    source: text(source.source),
    ...proof,
    rankCode,
    ...(source.salary === undefined ? {} : { salary: source.salary === null ? null : readSalary(source.salary) }),
    progress: {
      selfComputePoints: computePoints(progress.selfComputePoints),
      directRefs: integer(progress.directRefs),
      teamComputePoints: computePoints(progress.teamComputePoints),
      vDownlineCounts: counts,
    },
  };
}

export function createVRankApi(client: ApiClient, mode: ApiEnvironment = "prod"): VRankApi {
  return {
    async ladder() {
      return ladder(await client.request<unknown>({
        method: "GET",
        path: "/api/config/v-ranks",
        authenticated: false,
      }), mode);
    },
    async current() {
      return current(await client.request<unknown>({
        method: "GET",
        path: "/api/team/rank",
      }), mode);
    },
    claimSalary(key, claim) {
      return client.request<RankSalaryReceipt>({
        method: "POST",
        path: "/api/team/rank/salary/claim",
        // Only the user's explicit submit or resend may dispatch a claim.
        retryAfterAuth: false,
        idempotencyKey: key,
        body: claim,
        acceptedResponses: SALARY_CLAIM_REJECTIONS,
        parseResponseData: (value, status) => readSalaryReceipt(value, claim.month, status),
      });
    },
    salaryReceipt(key, month) {
      return client.request<RankSalaryReceipt>({
        method: "GET",
        path: `/api/team/rank/salary/claims/${encodeURIComponent(key)}`,
        parseResponseData: (value, status) => readSalaryReceipt(value, month, status),
      });
    },
  };
}
