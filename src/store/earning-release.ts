import { normalizeAccountKey } from "@/store/account-cloud";
import { useConfig } from "@/store/config";
import { getRiskRecord } from "@/store/risk-identity";
import type { RiskClusterSummary } from "@/store/risk-cluster";

// SPEC-7 收益释放引擎(R1 整改核心)。
//
// 铁律: pending_review / bonus_locked → withdrawable 的释放源【只有两个】——
//   attest = App 在线证明达标(attestedOnlineMs ≥ appAttestationReleaseHours)
//   manual = D2 人工放行(mock: _dev 助手模拟服务端下发)
// 「观察期到达」不是释放源;pendingReleaseHours 只作熔断统计窗口与运营口径。
// 簇级熔断: 同簇释放窗口内已释放账户数 ≥ freePhoneSlotsPerCluster 时,
// 后续 pending 分录升格为 bonus_locked,不进 withdrawable。
//
// 记账分层: EarningBuckets(账户云快照)是资金聚合权威;本台账是释放判定用的
// 分录辅助账。⚠️ MOCK 简化: 跨端快照合并只合并聚合桶,本台账 per-origin 不合并,
// 释放金额一律 clamp 到当前桶余额,漂移在演示口径内容忍(PROD: 服务端单账本,无此层)。

const LEDGER_KEY = "nexion-earning-ledger-v1";

export type LedgerRoute = "pending_review" | "bonus_locked";
export type ReleaseSource = "attest" | "manual";

export interface EarningLedgerEntry {
  id: string;
  accountKey: string;
  clusterId: string;
  route: LedgerRoute;
  usdt: number;
  nex: number;
  bucketedAt: number;
  releasedAt?: number;
  releasedBy?: ReleaseSource;
  /** 熔断升格时间(pending_review → bonus_locked)。 */
  escalatedAt?: number;
}

interface LedgerTable {
  schema: 1;
  entries: EarningLedgerEntry[];
}

export interface ReleaseOutcome {
  /** 待审桶释放金额(→ 可提)。 */
  releasedPendingUsdt: number;
  releasedPendingNex: number;
  /** 锁定桶释放金额(→ 可提;仅 attest 可释放锁定)。 */
  releasedLockedUsdt: number;
  releasedLockedNex: number;
  /** 熔断升格金额(待审 → 锁定)。 */
  escalatedUsdt: number;
  escalatedNex: number;
  releasedBy: ReleaseSource | null;
}

function readLedger(): LedgerTable {
  try {
    const raw = uni.getStorageSync(LEDGER_KEY) as LedgerTable | "";
    if (raw && typeof raw === "object" && raw.schema === 1 && Array.isArray(raw.entries)) return raw;
  } catch {
    // storage unavailable
  }
  return { schema: 1, entries: [] };
}

function writeLedger(table: LedgerTable): boolean {
  try {
    uni.setStorageSync(LEDGER_KEY, table);
    return true;
  } catch {
    return false;
  }
}

const zeroOutcome = (): ReleaseOutcome => ({
  releasedPendingUsdt: 0,
  releasedPendingNex: 0,
  releasedLockedUsdt: 0,
  releasedLockedNex: 0,
  escalatedUsdt: 0,
  escalatedNex: 0,
  releasedBy: null,
});

function roundOutcome(o: ReleaseOutcome): ReleaseOutcome {
  return {
    ...o,
    releasedPendingUsdt: +o.releasedPendingUsdt.toFixed(2),
    releasedPendingNex: +o.releasedPendingNex.toFixed(2),
    releasedLockedUsdt: +o.releasedLockedUsdt.toFixed(2),
    releasedLockedNex: +o.releasedLockedNex.toFixed(2),
    escalatedUsdt: +o.escalatedUsdt.toFixed(2),
    escalatedNex: +o.escalatedNex.toFixed(2),
  };
}

export function hasReleaseEffect(o: ReleaseOutcome): boolean {
  return (
    o.releasedPendingUsdt > 0 || o.releasedPendingNex > 0 ||
    o.releasedLockedUsdt > 0 || o.releasedLockedNex > 0 ||
    o.escalatedUsdt > 0 || o.escalatedNex > 0
  );
}

/** 结算/赠金入 pending 或 locked 桶时同步记分录(withdrawable 直入桶,不记)。 */
export function appendLedgerEntry(
  accountKey: string,
  clusterId: string,
  route: LedgerRoute,
  usdt: number,
  nex: number,
  idempotencyKey?: string,
): boolean {
  if (usdt <= 0 && nex <= 0) return true;
  const table = readLedger();
  const stableId = idempotencyKey?.trim() ? `EL-${idempotencyKey.trim()}` : null;
  if (stableId && table.entries.some((entry) => entry.id === stableId)) return true;
  const entry: EarningLedgerEntry = {
    id: stableId ?? `EL-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`,
    accountKey: normalizeAccountKey(accountKey),
    clusterId,
    route,
    usdt: +usdt.toFixed(2),
    nex: +nex.toFixed(2),
    bucketedAt: Date.now(),
  };
  return writeLedger({ schema: 1, entries: [...table.entries, entry] });
}

export function listLedgerEntries(accountKey: string): EarningLedgerEntry[] {
  const key = normalizeAccountKey(accountKey);
  return readLedger().entries.filter((e) => e.accountKey === key);
}

/** 簇级熔断判定: 释放窗口内该簇已有释放记录的【去重账户数】达免费槽上限。 */
function clusterBreakerTripped(table: LedgerTable, clusterId: string, exceptAccount: string): boolean {
  const cfg = useConfig().config.riskCluster;
  const windowMs = cfg.pendingReleaseHours * 3600 * 1000;
  const now = Date.now();
  const releasedAccounts = new Set(
    table.entries
      .filter(
        (e) =>
          e.clusterId === clusterId &&
          e.releasedAt != null &&
          now - e.releasedAt < windowMs &&
          e.accountKey !== exceptAccount,
      )
      .map((e) => e.accountKey),
  );
  return releasedAccounts.size >= cfg.freePhoneSlotsPerCluster;
}

/**
 * attest 释放评估 —— settle() 每轮调用(R5: cluster 为当轮实时评估结果)。
 * releaseMode=manual_only 或 attest 未达标 → 无动作;frozen 簇一律不释放。
 * attest 达标释放 pending + locked;熔断命中时 pending 升格 locked。
 */
export function evaluateAttestRelease(accountKey: string, cluster: RiskClusterSummary): ReleaseOutcome {
  const outcome = zeroOutcome();
  const cfg = useConfig().config.riskCluster;
  if (cluster.status === "frozen") return outcome;
  if (cfg.releaseMode !== "attest_or_manual") return outcome;

  const key = normalizeAccountKey(accountKey);
  const record = getRiskRecord(key);
  const attested = (record?.attestedOnlineMs ?? 0) >= cfg.appAttestationReleaseHours * 3600 * 1000;
  if (!attested) return outcome;

  const table = readLedger();
  const now = Date.now();
  const breakerTripped = clusterBreakerTripped(table, cluster.clusterId, key);
  let released = false;
  const entries = table.entries.map((e) => {
    if (e.accountKey !== key || e.releasedAt != null) return e;
    if (e.route === "pending_review" && breakerTripped) {
      outcome.escalatedUsdt += e.usdt;
      outcome.escalatedNex += e.nex;
      return { ...e, route: "bonus_locked" as LedgerRoute, escalatedAt: now };
    }
    if (e.route === "pending_review") {
      outcome.releasedPendingUsdt += e.usdt;
      outcome.releasedPendingNex += e.nex;
    } else {
      outcome.releasedLockedUsdt += e.usdt;
      outcome.releasedLockedNex += e.nex;
    }
    released = true;
    // 本账户一旦发生释放,窗口内后续账户的熔断统计立即把它计入。
    return { ...e, releasedAt: now, releasedBy: "attest" as ReleaseSource };
  });
  if (released || outcome.escalatedUsdt > 0 || outcome.escalatedNex > 0) {
    writeLedger({ schema: 1, entries });
    if (released) outcome.releasedBy = "attest";
  }
  return roundOutcome(outcome);
}

/**
 * ⚠️ DEV/DEMO-ONLY: 模拟 D2 人工放行(mock 双端不真打通,DR-7)。
 * 人工只放行 pending_review(locked 需 attest 或簇处置);人工判断绕过熔断。
 */
export function _devGrantManualRelease(accountKey: string): ReleaseOutcome {
  const outcome = zeroOutcome();
  const key = normalizeAccountKey(accountKey);
  const table = readLedger();
  const now = Date.now();
  const entries = table.entries.map((e) => {
    if (e.accountKey !== key || e.releasedAt != null || e.route !== "pending_review") return e;
    outcome.releasedPendingUsdt += e.usdt;
    outcome.releasedPendingNex += e.nex;
    return { ...e, releasedAt: now, releasedBy: "manual" as ReleaseSource };
  });
  if (outcome.releasedPendingUsdt > 0 || outcome.releasedPendingNex > 0) {
    writeLedger({ schema: 1, entries });
    outcome.releasedBy = "manual";
  }
  return roundOutcome(outcome);
}
