import { ApiError, isAmbiguousEnvelopeOutcome, isApiRefusal } from "@/api/errors";

/**
 * 🔴🔴 提现提交失败的**唯一**判决处 —— 页面与机器门共用这一份,不许各写一份。
 *
 * 为什么必须抽出来(2026-08-12 第四轮独立审计的结论,实测出来的):
 * 上一版把规则写在页面的 catch 里,门在自己内部**重新推导了一遍**。于是门与实现分叉时
 * 门看不见 —— 实测三个必然出事的变异(「结果未知也退役键」「日限重放也退役」
 * 「地区拒单无条件退役」)让门 32/32 全绿。其中第一个正是这整套机制存在的唯一理由所要防的 bug。
 * 两个真理源 = 门给的是假保证。
 *
 * ── 判决的两个问题,顺序不能反 ──
 * ① **要判的是哪一次?** 首次提交问「这一次」,重放问「**上一次**那笔落库了没有」。
 *    401 鉴权、429 限流、地区策略都是**边缘层**拒绝,排在服务端幂等查询之前,
 *    对「上一次」零信息量 —— 拿它们退役键 ⇒ 下次新键 ⇒ 服务端出第二笔。
 * ② 已知业务拒绝核对 HTTP 状态与 envelope code；其余结果沿 api/errors.ts 的歧义判据。
 */
export type AttemptFate = "retire" | "keep";

export type TriageKind =
  | "daily-limit"        // 今日笔数已达上限
  | "geo"                // 地区策略拒绝(有专属话术)
  | "business"           // 服务端完整应答的业务拒绝
  | "declined"           // 其它定局拒绝
  | "resend-declined"    // 重放被拒,但先前那笔状态仍未知
  | "unknown";           // 结果未知:请求可能已落库

export interface TriageInput {
  /** 本次提交是否在重放一笔已落盘的未收口尝试 */
  isReplay: boolean;
  /** 服务端应答是否可识别为「今日笔数已满」。判据在页面(要读 i18n / 服务端文案) */
  isDailyLimit: boolean;
  /** 是否可识别为地区策略拒绝。同上,判据在页面 */
  isGeo: boolean;
}

export interface TriageDecision {
  /** 幂等键的去留。🔴 这是本文件唯一真正涉钱的输出 */
  fate: AttemptFate;
  /** 页面据此选文案 */
  kind: TriageKind;
  /**
   * 是否重新拉取费率策略。
   * 🔴 只在**非重放的定局拒绝**上为 true:刷了 policyVersion 就变,
   * 而重放的请求体里冻着旧的 policyVersion —— 刷完再重放就是「同 key 异 body」→ 409 + 安全事件。
   */
  refreshPolicy: boolean;
}

export function triageWithdrawFailure(err: unknown, ctx: TriageInput): TriageDecision {
  const { isReplay, isDailyLimit, isGeo } = ctx;
  if (isDailyLimit && isApiRefusal(err, 409, "WITHDRAWAL_DAILY_LIMIT_EXCEEDED")) {
    return { fate: isReplay ? "keep" : "retire", kind: "daily-limit", refreshPolicy: false };
  }

  const policyChanged = isApiRefusal(err, 409, "WITHDRAWAL_POLICY_VERSION_CONFLICT");
  const businessRefusal = isApiRefusal(err, 409,
    "WITHDRAWAL_KILL_SWITCH_DISABLED", "BANK_WITHDRAWAL_UNRESOLVED_INTENT",
    "WITHDRAWAL_NETWORK_DISABLED", "WITHDRAWAL_PAYOUT_ADDRESS_REQUIRED",
    "WITHDRAWAL_PAYOUT_ADDRESS_CHANGE_PENDING", "WITHDRAWAL_PAYOUT_ADDRESS_MISMATCH",
    "WITHDRAWAL_BALANCE_LIMIT_EXCEEDED", "WITHDRAWAL_CLUSTER_RESTRICTED",
    "WITHDRAWAL_RELEASE_BUCKET_INSUFFICIENT")
    || isApiRefusal(err, 422, "WITHDRAWAL_MIN_AMOUNT_NOT_MET", "WITHDRAWAL_NET_AMOUNT_INVALID");

  // A replay refusal cannot settle the original attempt. Its frozen key and body stay together.
  if (policyChanged || businessRefusal || !isAmbiguousEnvelopeOutcome(err)) {
    if (isReplay) return { fate: "keep", kind: "resend-declined", refreshPolicy: false };
    if (isGeo) return { fate: "retire", kind: "geo", refreshPolicy: false };
    if (businessRefusal || !policyChanged && err instanceof ApiError && err.kind === "business") {
      return { fate: "retire", kind: "business", refreshPolicy: false };
    }
    return { fate: "retire", kind: "declined", refreshPolicy: true };
  }

  // Unknown conflicts, throttling and failed responses retain the original command.
  return { fate: "keep", kind: "unknown", refreshPolicy: false };
}
