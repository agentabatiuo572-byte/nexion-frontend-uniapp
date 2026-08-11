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
 * 🔴🔴 这次失败**有没有可能服务端已经把请求处理了**(歧义结局)。
 *
 * 用途:决定「重试时要不要复用同一把幂等键」。歧义 → 必须复用(重试才会命中服务端去重);
 * 确定 → 作废,下一次是新的一笔意图。**判错的代价是重复出账**,所以未知一律算歧义。
 *
 * 放在这里而不是页面里的两个理由:① 它问的是「这个错误意味着什么」,是接口层的知识;
 * ② 放页面里就只能用字符串匹配当门,而这条判断的每一格都需要拿**真的 ApiError** 去验
 * (`scripts/selfcheck-withdraw-failpaths.mjs` 现在就这么测)。
 *
 * 边界不是推出来的,是用本地假后端(`scripts/dev-stub-backend.mjs` 的 `createdThen504` 档:
 * 先建单、再让网关超时)端到端实测出来的:客户端拿到 `kind:"http" status:504`,
 * 若判成「确定」→ 换新键重试 → **服务端真的出第二笔**(台账 orderCount 2)。
 * 修正后同一实验 orderCount 恒为 1。
 *
 *  · network —— 连接断/超时,请求可能已到达并被处理 → 歧义
 *  · protocol —— 响应**已经回来**只是读不懂(未知状态值 / 坏时间戳),服务端多半已处理 → 歧义
 *  · http 5xx / 408 —— 服务端已收到,处理中出错或超时 → 歧义
 *  · http 4xx(除 408)—— 请求被拒绝而非被处理(含 429 限流与超额拒单)→ 确定
 *  · business / auth / configuration —— 明确拒绝或根本没处理 → 确定
 */
export function isAmbiguousOutcome(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true; // 不认识的错一律当歧义,保守方向是不重复出账
  switch (error.kind) {
    case "business":
    case "auth":
    case "configuration":
      return false;
    case "network":
    case "protocol":
      return true;
    case "http":
      return error.status === undefined || error.status >= 500 || error.status === 408;
    default:
      return true;
  }
}
