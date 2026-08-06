import { normalizeAccountKey } from "@/store/account-cloud";
import { GENESIS_INVITE_PATTERN } from "@/store/genesis";

/**
 * 创世邀请码码表(规格 FEAT-GEN11)—— 取代「只跑格式正则」的旧核销。
 *
 * 🔴 平台级表,**不按账号分行**:码是平台资源,一码一用必须跨账号生效。按账号分行等于
 * 每个账号一份自己的码表 —— 「换个账号用同一个码」会重新可用,正是本规格要根治的缺陷同型。
 * per-account 的那一半(user.genesisInviteCode)照旧随 account-cloud 快照走(切号不继承)。
 *
 * ⚠️ MOCK-ONLY:真后台 = POST /api/genesis/invite/redeem —— server 单事务核销,
 * 一码一用与并发互斥由事务承担。
 *
 * 🔴 **码表权威源 = 运营后台,发码面待两个后台合并后建**(主人 2026-08-04 拍板 C:不在
 * Nexion-admin-prototype 与 admin-ops 两条线上各建一遍)。前端这一侧不依赖后台就能独立
 * 成立:出厂 seed 提供一批「运营已发过的码」,核销逻辑与三种拒绝文案照真码表口径实现;
 * 后台建成后把 readRegistry 换成拉权威码表即可,本文件其余逻辑与所有调用方一行不用改。
 */

export type GenesisInviteStatus = "unused" | "used" | "void";

export interface GenesisInviteCode {
  code: string;
  status: GenesisInviteStatus;
  /** 核销账号(normalizeAccountKey 后)/ 时刻(ms epoch);仅 used 态非空。 */
  redeemedBy: string | null;
  redeemedAt: number | null;
}

/** 拒绝归因。四种拒绝各有各的文案,且**都不泄露核销者身份**(规格 ④ 禁止动作)。 */
export type GenesisInviteRejectReason = "invalid" | "used" | "void" | "already-held" | "failed";

export type GenesisInviteRedeemResult =
  | { ok: true; code: string }
  | { ok: false; reason: GenesisInviteRejectReason };

type GenesisInviteClaim =
  | { ok: true; code: string; rollback: () => void }
  | { ok: false; reason: Exclude<GenesisInviteRejectReason, "already-held"> };

export const GENESIS_INVITE_REGISTRY_KEY = "nexgrid-v3-genesis-invite-registry-v1";

/**
 * 出厂码表 —— mock 期的「运营已发过的那批码」。含一个已核销、一个已作废的存量码,
 * 让三种拒绝在真实环境里都可达(否则那两条分支是渲染不出来的死路径)。
 * 真后台接上后整份 seed 退役,码表由 server 下发。
 */
const SEED_CODES: readonly GenesisInviteCode[] = Object.freeze([
  { code: "NEXGRID-OG-7K3M", status: "unused", redeemedBy: null, redeemedAt: null },
  { code: "NEXGRID-OG-9QX4", status: "unused", redeemedBy: null, redeemedAt: null },
  { code: "NEXGRID-OG-A2VH", status: "unused", redeemedBy: null, redeemedAt: null },
  { code: "NEXGRID-OG-D8NP", status: "unused", redeemedBy: null, redeemedAt: null },
  { code: "NEXGRID-OG-5RTB", status: "used", redeemedBy: "og-holder-0142@nexgrid.io", redeemedAt: 1_754_000_000_000 },
  { code: "NEXGRID-OG-C6WY", status: "void", redeemedBy: null, redeemedAt: null },
]);

function isStatus(value: unknown): value is GenesisInviteStatus {
  return value === "unused" || value === "used" || value === "void";
}

/** 磁盘 → 内存。整表读不出 / 形态不认识 → 回落出厂表(空表也回落:空 = 没写过)。 */
function readRegistry(): GenesisInviteCode[] {
  try {
    const raw = uni.getStorageSync(GENESIS_INVITE_REGISTRY_KEY) as unknown;
    if (Array.isArray(raw) && raw.length) {
      const rows = raw
        .filter((row): row is GenesisInviteCode =>
          !!row && typeof row === "object"
          && typeof (row as GenesisInviteCode).code === "string"
          && isStatus((row as GenesisInviteCode).status))
        .map((row) => ({
          code: row.code,
          status: row.status,
          redeemedBy: row.status === "used" && typeof row.redeemedBy === "string" ? row.redeemedBy : null,
          redeemedAt: row.status === "used" && typeof row.redeemedAt === "number" ? row.redeemedAt : null,
        }));
      if (rows.length) return rows;
    }
  } catch {
    // storage unavailable
  }
  return SEED_CODES.map((row) => ({ ...row }));
}

function writeRegistry(rows: GenesisInviteCode[]): boolean {
  try {
    uni.setStorageSync(GENESIS_INVITE_REGISTRY_KEY, rows);
    return true;
  } catch {
    // storage unavailable
    return false;
  }
}

/**
 * 占一个码(规格 异常5 并发核销:先占后改 + 单次落盘)。
 *
 * 前置条件在**当下从磁盘读到的最新码表**上复核 —— 不用任何内存副本,所以「另一个账号
 * 刚刚核销掉这个码」这一格拦得住:第二个提交读到 used 直接拒。
 *
 * 🔴 残余窗口如实声明:localStorage 没有锁,「读表比状态」与「写回」终究是两步。同源多标签页
 * 恰好卡在这两步之间同时提交,理论上仍可能双方都通过判定(亚毫秒级)。客户端消不掉这一格
 * (Web Locks 只有 H5 有,uni 多端不可用);真后台由 server 单事务(SELECT … FOR UPDATE /
 * 唯一约束)保证,本函数随 mock 一起退役。
 *
 * 返回 rollback:核销成功、但**把码写进用户账号那一步失败**时用来退回未使用 —— 那笔核销
 * 整体没发生,码不能被吞掉(用户永久失去一个限量凭证)。rollback 只翻自己占的那一行。
 */
export function claimGenesisInviteCode(raw: string, accountKey: string): GenesisInviteClaim {
  const code = raw.trim().toUpperCase();
  // 格式兜底:格式不对的串根本不会在码表里,与「码不存在」同归「无效」。
  if (!GENESIS_INVITE_PATTERN.test(code)) return { ok: false, reason: "invalid" };
  const account = normalizeAccountKey(accountKey);
  const before = readRegistry();
  const target = before.find((row) => row.code === code);
  // 异常1:不在码表(含格式正确但从未发放)。
  if (!target) return { ok: false, reason: "invalid" };
  // 异常2:非未使用态 —— 已作废 / 已被使用各自归因,文案在页面层分开。
  if (target.status === "void") return { ok: false, reason: "void" };
  if (target.status !== "unused") return { ok: false, reason: "used" };
  const claimedAt = Date.now();
  const next = before.map((row) =>
    row.code === code
      ? { ...row, status: "used" as const, redeemedBy: account, redeemedAt: claimedAt }
      : row);
  if (!writeRegistry(next)) return { ok: false, reason: "failed" };
  return {
    ok: true,
    code,
    rollback: () => {
      const current = readRegistry();
      writeRegistry(current.map((row) =>
        row.code === code && row.redeemedBy === account && row.redeemedAt === claimedAt
          ? { ...row, status: "unused" as const, redeemedBy: null, redeemedAt: null }
          : row));
    },
  };
}

/**
 * 本账号**真持有的那个已核销的码**(至多一个)。null = 没有。
 *
 * 🔴 这是「本账号已持码」的**单源**:资格门(规格 ⑦)与「已持码则拒收第二个码」(异常3)
 * 都问它,两处口径永不打架。判据落在码表侧而不是 `user.genesisInviteCode`,因为:
 *  - 码表每次现读磁盘 —— 另一个标签页刚核销过,这边立刻看得见(内存副本会永久陈旧,
 *    于是同一个账号能在两个标签页各占一个码);
 *  - 存量账号里可能留着旧实现(只校验格式)写下的、码表里根本没有的串 —— 那不是「已核销过」,
 *    不该把人卡死在「既不算持码、又不许再核销」的死角。
 * `user.genesisInviteCode` 仍写、仍是 per-account 凭证展示字段,但不再是判定依据。
 */
export function redeemedInviteCodeOf(accountKey: string): string | null {
  const account = normalizeAccountKey(accountKey);
  return readRegistry().find((row) => row.status === "used" && row.redeemedBy === account)?.code ?? null;
}
