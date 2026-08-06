import { accountRowRev, readAccountRow, writeAccountRowCas } from "./account-scoped-storage";
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

/** 磁盘行 → 计数器。判据单源(读盘与带版本读盘共用一份,免得两处消毒长歪)。 */
function sanitize(row: Partial<DailyCount> | null): DailyCount | null {
  // Number.isFinite 而不是 typeof === "number":后者放 NaN 过关。荒谬大值由 core 的
  // todayCountFrom 消毒(那边挡 NaN / 负数 / >上限 三种,消毒必须对称)。
  if (!row || !Number.isFinite(row.dayIndex) || !Number.isFinite(row.count)) return null;
  return {
    dayIndex: row.dayIndex as number,
    count: row.count as number,
    claimToken: typeof row.claimToken === "string" ? row.claimToken : undefined,
  };
}

/** 读当前落盘计数器。从未落盘返回 null(core 会当 0 处理)。 */
export function readWithdrawCounter(accountKey: string): DailyCount | null {
  return sanitize(readAccountRow<Partial<DailyCount>>(ACCOUNTS_KEY, accountKey));
}

/** 同上,外带该行版本号 —— CAS 写要拿它当 expectedRev。 */
function readCounterWithRev(accountKey: string): { counter: DailyCount | null; rev: number } {
  const raw = readAccountRow<Partial<DailyCount>>(ACCOUNTS_KEY, accountKey);
  return { counter: sanitize(raw), rev: accountRowRev(raw) };
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
 * 🔴 CAS 与令牌是**两道互补的闸,谁也替不了谁**(2026-08-04 接 CAS 时的边界结论):
 *  - CAS 治「写覆盖」:同进程 / 传播已收敛的并发,后写的拿旧版本号会被挡下并**重判额度**;
 *    此前是覆盖式写,后写的把先写的计数整份顶掉 —— 限额白设。
 *  - CAS 治不了「读陈旧」:跨渲染进程时两边都读到写入前的版本号,各自 CAS 都过。
 *    那一格仍然只能靠写后等传播 + 回读验令牌来分胜负,故下面整段一个字不能删。
 *
 * 判定全在 core(claimDailySlot / isClaimOwner,纯函数,行为哨兵覆盖得到),这里只管读写与等待。
 * PROD:服务端在事务里 `UPDATE ... WHERE count < limit`,整段可删。
 */
export async function claimWithdrawSlot(accountKey: string, limitCount: number, now: number): Promise<string | null> {
  // 快速拒:额度本来就满了,连令牌都不必写(写了就要等 150ms 才能发现白等)。
  const { allowed } = claimDailySlot(readWithdrawCounter(accountKey), limitCount, now);
  if (!allowed) return null;
  const token = newClaimToken();
  // 带版本号占位:版本被推进过说明别处刚占过,重读**最新计数**再判一次额度(有界 3 次)。
  let wrote = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = readCounterWithRev(accountKey);
    const fresh = claimDailySlot(cur.counter, limitCount, now);
    if (!fresh.allowed) return null; // 别处刚把最后一格占走 —— 不写令牌,直接认输
    const w = writeAccountRowCas<DailyCount>(
      ACCOUNTS_KEY,
      accountKey,
      { ...fresh.next, claimToken: token },
      cur.rev,
    );
    if (w.ok) {
      wrote = true;
      break;
    }
    if (!w.conflict) break; // storage 写不进去:下面的回读必然认不到令牌,按占用失败收场
  }
  if (!wrote) return null;
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
  // 归还也走 CAS:覆盖式写会把「归还与另一端占用之间」那一格抹掉 —— 别人刚占的计数被
  // 我这次退票连坐减掉 = 限额白多放一笔。版本变了就重读重判(所有权可能已经易主)。
  for (let attempt = 0; attempt < 3; attempt++) {
    const { counter, rev } = readCounterWithRev(accountKey);
    if (!isClaimOwner(counter, token) || !counter) return;
    const w = writeAccountRowCas<DailyCount>(
      ACCOUNTS_KEY,
      accountKey,
      { dayIndex: counter.dayIndex, count: Math.max(0, counter.count - 1) },
      rev,
    );
    if (w.ok || !w.conflict) return;
  }
}
