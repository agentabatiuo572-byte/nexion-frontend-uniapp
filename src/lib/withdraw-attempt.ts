import { readAccountRow, writeAccountRow } from "@/store/account-scoped-storage";
import type { Withdrawal } from "@/store/types";

/**
 * 未确认的提现提交尝试(幂等键 + 冻结的请求体),按账号落盘。
 *
 * 🔴 为什么键不能只是「按意图缓存」:服务端幂等契约(`docs/specs/PAY-NexGrid_越南支付
 * 生产架构_v2.0-DRAFT.md` §幂等)是「同 key + 同 body 返回原结果;**同 key + 异 body
 * 返回 409 并记安全事件**」。键稳定而 body 跟着活值漂(费率刷新改 policyVersion、
 * 用户改金额/网络/抵扣开关),两种下场二选一:body 进指纹 → 换新键 → 同一笔钱建两张单;
 * body 不进指纹 → 撞 409。所以键与它那一次的 body 必须**一起冻、一起重放**。
 *
 * 🔴 为什么落盘而不是内存 Map:用户面对一个卡住的提交,最常做的三件事是杀 App、
 * 刷页面、开第二个标签页 —— 内存态在这三件事下全部蒸发,幂等键随之蒸发,重来就是第二张单。
 * H5 的 uni storage 就是 localStorage,同源多标签页共享,顺带把「两个标签页各铸一个键」
 * 也一起关掉。资金类幂等记录服务端永久保留(同上规格),故不设 TTL。
 *
 * ⚠️ 诚实边界:本仓没有 `GET /api/withdrawals` —— client 无法自己查「那张单到底建了没」。
 * 未确认的尝试只能靠重放拿到定局(成功 / 服务端明确拒绝 / 409)来收口。接了查询接口后,
 * 这里应改成先查权威再判,不再让用户重放。
 */
export interface WithdrawAttempt {
  /** 随请求上送的 Idempotency-Key。 */
  key: string;
  /** 以下五项 = POST /api/withdrawals 的请求体,重放时逐字段原样重发。 */
  amount: number;
  network: Withdrawal["network"];
  address: string;
  policyVersion: string;
  offset: boolean;
}

const TABLE_KEY = "nexgrid-withdraw-attempt-accounts-v1"; // { [accountKey]: WithdrawAttempt }

const NETWORKS: ReadonlyArray<Withdrawal["network"]> = ["USDT-TRC20", "USDT-BEP20", "USDT-ERC20"];

/** 读未收口的尝试。形状不完整一律当没有 —— 宁可多铸一个新键,也不拿半个 body 去重放。 */
export function readWithdrawAttempt(accountKey: string): WithdrawAttempt | null {
  const row = readAccountRow<Partial<WithdrawAttempt>>(TABLE_KEY, accountKey);
  if (!row) return null;
  const { key, amount, network, address, policyVersion, offset } = row;
  if (typeof key !== "string" || !key) return null;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  if (typeof network !== "string" || !NETWORKS.includes(network as Withdrawal["network"])) return null;
  if (typeof address !== "string" || !address) return null;
  if (typeof policyVersion !== "string" || !policyVersion) return null;
  if (typeof offset !== "boolean") return null;
  return { key, amount, network: network as Withdrawal["network"], address, policyVersion, offset };
}

/**
 * 落盘。🔴 必须在请求**发出之前**调用:请求在途时被杀进程正是这条链要兜的那一刻。
 * 🔴 返回值必须被检查:落盘失败(存储不可用 / 配额满)= 这一次没有重放保护,
 * 一旦超时就再也认不回那个键 —— 调用方此时应当**拒发**,而不是照发。
 */
export function rememberWithdrawAttempt(accountKey: string, attempt: WithdrawAttempt): boolean {
  return writeAccountRow<WithdrawAttempt>(TABLE_KEY, accountKey, attempt);
}

/** 退役。只在结果**定局**时调用:成功、服务端明确拒绝、或 409(键已被服务端占用)。 */
export function forgetWithdrawAttempt(accountKey: string): void {
  writeAccountRow<Record<string, never>>(TABLE_KEY, accountKey, {});
}

/** 新键。带随机熵 —— 纯时间戳 + 计数器在两个标签页的首笔上会撞出同一个字符串。 */
export function newWithdrawKey(): string {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `withdrawal:${suffix}`;
}
