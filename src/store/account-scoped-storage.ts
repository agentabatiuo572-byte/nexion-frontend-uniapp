import { normalizeAccountKey } from "@/store/account-cloud";

/**
 * 按账号分行的 uni storage 表(P2-8 存储作用域债修复)。
 * 设备级单键 → `{ [accountKey]: row }` 表,行随账号走,账号切换互不继承。
 * 写入走「现读现改现写」,与 account-cloud 表同款语义(窄竞态,多端各写各行)。
 * 真后台:行数据即 per-user 服务端资源,accountKey 即用户主键 —— 结构 backend-replaceable。
 */
export function readAccountRow<T>(tableKey: string, accountKey: string): T | null {
  try {
    const table = uni.getStorageSync(tableKey) as Record<string, T> | "";
    if (table && typeof table === "object") {
      const row = table[normalizeAccountKey(accountKey)];
      if (row && typeof row === "object") return row;
    }
  } catch {
    // storage unavailable
  }
  return null;
}

export function writeAccountRow<T>(tableKey: string, accountKey: string, row: T): boolean {
  try {
    const raw = uni.getStorageSync(tableKey) as Record<string, T> | "";
    const table = raw && typeof raw === "object" ? { ...raw } : ({} as Record<string, T>);
    table[normalizeAccountKey(accountKey)] = row;
    uni.setStorageSync(tableKey, table);
    return true;
  } catch {
    // storage unavailable
    return false;
  }
}

/** CAS 写结果。conflict 区分「版本被别处推进了」与「storage 根本写不进去」——调用方对这两种
 *  失败的处置不同(前者要重读/提示,后者是环境故障)。 */
export interface AccountRowCasResult {
  ok: boolean;
  conflict: boolean;
  /** 成功=落盘后的新版本;冲突=磁盘上的当前版本;storage 故障=原样回传 expectedRev。 */
  rev: number;
}

/** 读一行的版本号。行不存在、或是 CAS 上线前写的老行 → 0(老行天然从 0 起步,不需要迁移)。 */
export function accountRowRev(row: unknown): number {
  const rev = (row as { rev?: unknown } | null)?.rev;
  return typeof rev === "number" && Number.isFinite(rev) ? rev : 0;
}

/**
 * 乐观并发(CAS)写:磁盘上该行的 rev 仍等于 expectedRev 才落盘,落盘后 rev+1。
 *
 * 为什么需要:H5 端 uni storage 就是 localStorage,同源多标签页共享同一份;每个标签页的
 * store 是各自的内存副本,全仓又没有任何 storage 事件重新水合 —— 两个标签页只要都打开过
 * 同一个页面,状态就**永久不同步**(不是几毫秒的传播延迟)。谁后写,谁就用自己那份陈旧
 * 数组整个覆盖对方。落到涉钱链路上 = 同一笔资产被两个标签页各领一次,而 account-cloud 的
 * usdtBalance 是 ADDITIVE_NUMBER_KEYS(按增量三路合并)→ 两次入账都记 = 真·双花。
 *
 * 🔴 诚实边界:localStorage 没有锁,「比 rev」与「写回」终究是两步,亚毫秒级插队窗口无法
 * 在客户端消除(Web Locks 只有 H5 有,uni 多端不可用)。本机制根治的是真正会发生的那个
 * 窗口 ——「状态永久陈旧」;残余窗口要靠真后端单事务(接后端时本函数随 mock 一起退役)。
 *
 * 老调用方零影响:writeAccountRow 不读 rev、不写 rev,行为与 CAS 上线前逐字节一致。
 * 只有走 CAS 的表才带 rev 字段,且 rev 由本函数独占维护(调用方不要自己塞 rev)。
 */
export function writeAccountRowCas<T extends object>(
  tableKey: string,
  accountKey: string,
  row: T,
  expectedRev: number,
): AccountRowCasResult {
  try {
    const raw = uni.getStorageSync(tableKey) as Record<string, T> | "";
    const table = raw && typeof raw === "object" ? { ...raw } : ({} as Record<string, T>);
    const key = normalizeAccountKey(accountKey);
    const currentRev = accountRowRev(table[key]);
    if (currentRev !== expectedRev) return { ok: false, conflict: true, rev: currentRev };
    const nextRev = currentRev + 1;
    table[key] = { ...row, rev: nextRev };
    uni.setStorageSync(tableKey, table);
    return { ok: true, conflict: false, rev: nextRev };
  } catch {
    // storage unavailable
    return { ok: false, conflict: false, rev: expectedRev };
  }
}
