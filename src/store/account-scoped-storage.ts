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
