import { readAccountRow, writeAccountRow } from "./account-scoped-storage";
import { claimDailySlot, isClaimOwner } from "./withdrawal-eligibility-core";

// FEAT-WD01b 每日提现笔数计数器(按账号分行落盘)。
//
// 🔴 为什么要落盘而不是放内存:并发面(两个标签页同时提交)必须以落盘值为准,
// 否则两边都读到「今天提过 1 笔」而各自放行,限额形同虚设。
//
// 🔴 为什么存「日序 + 计数」而不是存单据列表:
//  - 跨日归零是**读时判定**(日序对不上就当 0),不需要定时清理任务;
//  - 只占两个整数,不随提现次数增长;
//  - 判定逻辑在 core 的 todayCountFrom(纯函数,行为哨兵覆盖得到),这里只管读写。
//
// PROD:服务端按平台时区权威计数,client 这份仅作 UI 预判;
// 真正的拦截以 POST /api/withdrawals 的返回为准(client 计数可被绕过,服务端不可)。

const ACCOUNTS_KEY = "nexgrid-withdraw-daily-count-v1"; // { [accountKey]: DailyCount }

/**
 * 写入后等多久回读验证。
 *
 * localStorage 跨渲染进程的传播是异步的,实测危险窗口 ≈ 5ms(两次点击错开 25ms 就拦得住)。
 * 取 150ms = 30 倍余量;相对提交流程本来就有的 600ms 风控评估,用户无感。
 * 调小到接近传播时延会让两个标签页各自读到自己的令牌而双双放行 —— 宁大勿小。
 */
export const CLAIM_SETTLE_MS = 150;

export interface DailyCount {
  /** 平台时区的日序(见 core 的 platformDayIndex) */
  dayIndex: number;
  /** 该日已发起的提现笔数 */
  count: number;
  /** 最近一次占用者的唯一令牌(跨标签页竞争的胜负凭据,见 claimWithdrawSlot) */
  claimToken?: string;
}

/** 读当前落盘计数器。从未落盘返回 null(core 会当 0 处理)。 */
export function readWithdrawCounter(accountKey: string): DailyCount | null {
  const row = readAccountRow<Partial<DailyCount>>(ACCOUNTS_KEY, accountKey);
  // Number.isFinite 而不是 typeof === "number":后者放 NaN 过关。荒谬大值由 core 的
  // todayCountFrom 消毒(那边挡 NaN / 负数 / >上限 三种,消毒必须对称)。
  if (!row || !Number.isFinite(row.dayIndex) || !Number.isFinite(row.count)) return null;
  return {
    dayIndex: row.dayIndex as number,
    count: row.count as number,
    claimToken: typeof row.claimToken === "string" ? row.claimToken : undefined,
  };
}

/** 每次占用生成的唯一令牌。够唯一即可,不用于安全用途。 */
function newClaimToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 🔴 **占用**今日一个提现额度。必须在**建单之前** await 调用,准了才返回 true。
 *
 * 为什么是异步的、为什么要回读:
 * 「先查后建」中间隔着风控评估的 600ms 往返,两个标签页各自读到「今天还没提过」
 * 而都建单(首轮独立验收 3 轮 3 中)。改成「先占后建」后窗口压到 ~1ms,
 * 但**没有消除** —— Chrome 给独立标签页分不同渲染进程,localStorage 写入的传播是异步的,
 * 两边仍会在 ~1ms 内各自读到写入前的值(复验 12 轮 12 中)。
 *
 * 所以这里不再指望「读-改-写」原子:各写各的、带唯一令牌,等传播收敛(CLAIM_SETTLE_MS)
 * 后回读,**令牌还在的那一个才算占到**。收敛后全局只有一个胜者,只会建出一单。
 *
 * 判定全在 core(claimDailySlot / isClaimOwner,纯函数,行为哨兵覆盖得到),这里只管读写与等待。
 * PROD:服务端在事务里 `UPDATE ... WHERE count < limit`,整段可删。
 */
export async function claimWithdrawSlot(accountKey: string, limitCount: number, now: number): Promise<string | null> {
  const { allowed, next } = claimDailySlot(readWithdrawCounter(accountKey), limitCount, now);
  if (!allowed) return null;
  const token = newClaimToken();
  writeAccountRow<DailyCount>(ACCOUNTS_KEY, accountKey, { ...next, claimToken: token });
  await new Promise<void>((r) => setTimeout(r, CLAIM_SETTLE_MS));
  // 回读:令牌被别的标签页覆盖 = 这一格被人占走了,本次作废(不重试、不递减 ——
  // 递减会把胜者的占用一起抹掉)。
  return isClaimOwner(readWithdrawCounter(accountKey), token) ? token : null;
}

/**
 * 归还刚占用的额度 —— 仅用于「占完之后建单仍然失败」(如并发扣款把余额吃掉了)。
 * 只有令牌仍属于自己才归还:别人已经接手这一格时动它,等于替别人退票。
 * 🔴 被拒的提交不该白吃额度(这是一条 AC)。
 */
export function releaseWithdrawSlot(accountKey: string, token: string): void {
  const cur = readWithdrawCounter(accountKey);
  if (!isClaimOwner(cur, token) || !cur) return;
  writeAccountRow<DailyCount>(ACCOUNTS_KEY, accountKey, {
    dayIndex: cur.dayIndex,
    count: Math.max(0, cur.count - 1),
  });
}
