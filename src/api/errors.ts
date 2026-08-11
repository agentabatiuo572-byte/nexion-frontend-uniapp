export type ApiErrorKind = "auth" | "business" | "http" | "network" | "protocol" | "configuration";

interface ApiErrorOptions {
  kind: ApiErrorKind;
  message: string;
  status?: number;
  code?: number;
  retryable?: boolean;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: number;
  readonly retryable: boolean;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = "ApiError";
    this.kind = options.kind;
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
  }
}

export function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError({ kind: "network", message: "NETWORK_UNAVAILABLE", retryable: true });
}

/**
 * 4xx 里**不能**当作「服务端已定局拒绝」的几个:语义都是「我可能已经收到了」。
 * 408 请求超时(服务端中途放弃,写入可能已落) · 409 幂等键冲突(记录已存在) ·
 * 425 太早(重放保护) · 429 限流(网关层拦下,但上游可能已转发过一次)。
 */
const UNSETTLED_4XX = new Set([408, 409, 425, 429]);

/**
 * 写请求失败后,这一次尝试在服务端的结果**是否已经定局**(= 确定没有落库)。
 *
 * 🔴 false 不等于「失败了」,而是「不知道」—— 幂等键必须原样留着重放,绝不能另铸新键,
 * 也绝不能把文案写成「请重试」诱导用户开新的一笔。归入不知道的:网络断/超时(传输层
 * 分不出「没送达」和「送达了但回执丢了」)、5xx、应答解析不了(那是服务端已经 200 之后
 * 才抛的,单据反而**一定存在**)、以及任何非 ApiError 的意外(按最安全的一侧算)。
 */
export function isSettledRejection(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  // auth:本仓三条 auth 路径都确定没建单 —— ① 发请求前刷新会话失败(SESSION_EXPIRED /
  // SESSION_CHANGED_DURING_REFRESH,请求根本没发出);② 这次 POST 被服务端明确判 401;
  // ③ SESSION_CHANGED_DURING_REQUEST 是在 ② 之后才做的客户端观察,前提仍是服务端已拒。
  // business:服务端完整应答并给了业务失败码。
  if (error.kind === "auth" || error.kind === "business") return true;
  if (error.kind !== "http" || typeof error.status !== "number") return false;
  return error.status >= 400 && error.status < 500 && !UNSETTLED_4XX.has(error.status);
}

/**
 * 409 = 这个幂等键服务端已有记录(同 key 异 body,见生产架构规格 §幂等)。
 * 它是**首次请求确实落库了**的证据:键已用掉,可以退役,但绝不能提示用户重来一次。
 */
export function isIdempotencyConflict(error: unknown): boolean {
  return error instanceof ApiError && error.kind === "http" && error.status === 409;
}
