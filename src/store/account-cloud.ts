import type { Device, EarningsState, UserState, Withdrawal } from "@/store/types";
import type { EntrySurface } from "@/lib/entry-surface";

const STORAGE_KEY = "nexgrid-account-cloud-v1";

export interface AccountCloudSnapshot {
  schema: 1;
  accountKey: string;
  entrySurface: EntrySurface;
  updatedAt: number;
  user: UserState;
  devices: Device[];
  earnings: EarningsState;
  /**
   * 🔴 提现单**列表**,不是「最新一条」。
   * 真后端 GET /api/withdrawals 返回的就是列表;此前只存最新一条(单槽)是与真后端
   * 不同构的 mock 简化,直接导致两个 P0:① 第二笔建单把第一笔整个顶掉(钱已扣、单据
   * 从此不可达、到账推进也永不再碰它)② 为兜这个洞加的「在途不许再提」闸,在人工审核
   * 单没有出口时把用户永久锁死。改成列表后两个问题从根上消失,也满足项目铁律
   * 「Mock 必须 100% 真后台结构、随时可接真后台零重写」。
   */
  withdrawals: Withdrawal[];
}

export interface AccountSnapshotWriteResult {
  snapshot: AccountCloudSnapshot;
  persisted: boolean;
}

type AccountCloudTable = Record<string, AccountCloudSnapshot>;
type JsonRecord = Record<string, unknown>;

const ADDITIVE_NUMBER_KEYS = new Set([
  "usdtBalance",
  "nexBalance",
  "pendingEarnings",
  "withdrawableUsdt",
  "pendingReviewUsdt",
  "bonusLockedUsdt",
  "lockedNex",
  "cumulativeDepositUsdt",
  "today",
  "todayNEX",
  "thisWeek",
  "thisMonth",
  "total",
  "todayEarnings",
  "todayEarningsNEX",
  // FEAT-DEV02: per-device lifetime output — additive three-way-diff merge,
  // same mechanics as todayEarnings (carrier deltas add, no double count).
  "cumulativeEarningsUsdt",
]);

const TIME_ANCHOR_KEYS = new Set([
  "joinedAt",
  "purchasedAt",
  "activatedAt",
  "lastSettledAt",
  "miningSince",
  // R7 heartbeat is a time anchor: concurrent carrier snapshots keep the
  // freshest beat so an older write cannot incorrectly mark a device stale.
  "onlineHeartbeatAt",
  "interruptedAt",
  "startedAt",
  "completedAt",
  "submittedAt",
  "estimatedCompletion",
  // FEAT-WD01b 实际到账时刻。漏加会让 merge 退化成 last-write-wins 而非取最新
  // (踩过:R7 心跳字段就是这么漏的),两端并发时到账时间会被旧快照写回。
  "confirmedAt",
  "lastBucketedAt",
]);

const WITHDRAWAL_STATUS_RANK: Record<Withdrawal["status"], number> = {
  submitted: 0,
  "review-pending": 1,
  "review-passed": 2,
  processing: 3,
  sent: 4,
  confirmed: 5,
  // 异常态视为服务端最终结论,合并时胜过主链中间态(同一单不会两异常态互比)。
  "review-rejected": 6,
  frozen: 6,
  "address-invalid": 6,
  "tx-failed": 6,
  refunded: 6,
};

export function normalizeAccountKey(raw: string): string {
  const key = (raw || "default").trim().toLowerCase();
  return key || "default";
}

function readTable(): AccountCloudTable {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY) as AccountCloudTable | "";
    if (raw && typeof raw === "object") return raw;
  } catch {
    // storage unavailable
  }
  return {};
}

function writeTable(table: AccountCloudTable): boolean {
  try {
    uni.setStorageSync(STORAGE_KEY, table);
    return true;
  } catch {
    // storage unavailable
    return false;
  }
}

// NOTE (FEAT-DEV02): this module stays VALUE-IMPORT-FREE on purpose — the
// SPEC-4 merge sentinel transpiles it into a bare node VM where Vite aliases
// don't resolve. Legacy-snapshot backfill of the trade-in economics fields
// (cumulativeEarningsUsdt / paidPriceUsdt) therefore lives in
// device-types.ts backfillDeviceEconomics(), applied by app.ts at the two
// snapshot consumption points (boot + account switch). Merge handles missing
// fields gracefully (last-write), and the live state is always backfilled.
export function readAccountSnapshot(accountKey: string): AccountCloudSnapshot | null {
  const key = normalizeAccountKey(accountKey);
  const row = readTable()[key];
  return row && row.schema === 1 ? upgradeLegacyWithdrawals(row) : null;
}

/**
 * 老快照升级(读时升级,schema 不升版 —— 只补形,不做破坏性迁移;老用户的历史单不丢):
 *  ① 单条 latestWithdrawal → withdrawals 列表(2026-08-01 单槽→列表迁移);
 *  ② FEAT-WD02:数字 fee → 结构化快照 { networkConfirmUsd, nexBurned, actualFeeUsd }。
 *     🔴 归一必须对「已是列表」的行也做 —— ①已上线,存量行**全部**带 withdrawals 数组,
 *     归一只嵌在单槽分支里就对所有真实存量行失效(tracking 读 fee.actualFeeUsd → undefined 崩)。
 *     旧数字只承载实收费:actualFeeUsd = 旧数字;networkConfirmUsd/nexBurned 不可考记 0,
 *     🔴 禁按新规则重算(展示层只读 actualFeeUsd,无信息损失)。
 */
function upgradeLegacyWithdrawals(row: AccountCloudSnapshot): AccountCloudSnapshot {
  const legacy = (row as unknown as { latestWithdrawal?: Withdrawal | null }).latestWithdrawal;
  const list: Withdrawal[] = Array.isArray(row.withdrawals) ? row.withdrawals : legacy ? [legacy] : [];
  const needsUpgrade =
    !Array.isArray(row.withdrawals) || list.some((wd) => typeof (wd as { fee?: unknown }).fee === "number");
  if (!needsUpgrade) return row;
  const withdrawals = list.map((wd) => {
    const feeRaw = (wd as { fee?: unknown }).fee;
    return typeof feeRaw === "number"
      ? { ...wd, fee: { networkConfirmUsd: 0, nexBurned: 0, actualFeeUsd: feeRaw } }
      : wd;
  });
  return { ...row, withdrawals };
}

export function writeAccountSnapshot(snapshot: AccountCloudSnapshot): boolean {
  const key = normalizeAccountKey(snapshot.accountKey);
  const table = readTable();
  table[key] = { ...snapshot, accountKey: key, updatedAt: Date.now() };
  return writeTable(table);
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function identityKey(value: unknown): string | null {
  if (!isJsonRecord(value)) return null;
  const id = value.id;
  if (typeof id === "string" || typeof id === "number") return `id:${id}`;
  const ts = value.ts;
  if (typeof ts === "string" || typeof ts === "number") return `ts:${ts}`;
  return null;
}

function resolveIdentityValue(
  base: unknown,
  next: unknown,
  latest: unknown,
): { value: unknown } | null {
  const beforeId = identityKey(base);
  const afterId = identityKey(next);
  const currentId = identityKey(latest);
  if (!beforeId && !afterId && !currentId) return null;
  if (!beforeId && afterId && currentId && afterId === currentId) return { value: latest };
  if (afterId && currentId && afterId === currentId) return null;
  if (currentId && currentId !== beforeId && afterId !== currentId) return { value: latest };
  if (afterId && afterId !== beforeId && currentId === beforeId) return { value: next };
  if (beforeId && !currentId && afterId) return { value: latest };
  if (beforeId && !afterId && currentId === beforeId) return { value: next };
  return null;
}

function mergeArrayByIdentity(base: unknown[], next: unknown[], latest: unknown[]): unknown[] | null {
  const rows = [...base, ...next, ...latest];
  if (!rows.length || rows.some((row) => !identityKey(row))) return null;

  const baseByKey = new Map(base.map((row) => [identityKey(row) as string, row]));
  const mergedByKey = new Map(latest.map((row) => [identityKey(row) as string, row]));
  const order = latest.map((row) => identityKey(row) as string);

  next.forEach((row) => {
    const key = identityKey(row) as string;
    const hasBefore = baseByKey.has(key);
    const before = baseByKey.get(key);
    if (hasBefore && sameValue(before, row)) return;
    const hasCurrent = mergedByKey.has(key);
    const current = mergedByKey.get(key);
    if (!hasBefore && hasCurrent) return;
    if (hasBefore && !hasCurrent) return;
    if (isJsonRecord(before) && isJsonRecord(row) && isJsonRecord(current)) {
      mergedByKey.set(key, mergeFieldByDiff(before, row, current));
    } else {
      mergedByKey.set(key, row);
    }
    if (!order.includes(key)) order.push(key);
  });

  return order.map((key) => mergedByKey.get(key));
}

function mergeFieldByDiff<T extends JsonRecord>(base: T, next: T, latest: T): T {
  const merged: JsonRecord = { ...latest };
  Object.keys(next).forEach((key) => {
    const before = base[key];
    const after = next[key];
    if (sameValue(before, after)) return;

    const current = latest[key];
    if (Array.isArray(before) && Array.isArray(after) && Array.isArray(current)) {
      const mergedArray = mergeArrayByIdentity(before, after, current);
      if (mergedArray) {
        merged[key] = mergedArray;
        return;
      }
    }
    const identityResolution = resolveIdentityValue(before, after, current);
    if (identityResolution) {
      merged[key] = identityResolution.value;
      return;
    }
    if (isJsonRecord(before) && isJsonRecord(after) && isJsonRecord(current)) {
      merged[key] = mergeFieldByDiff(before, after, current);
      return;
    }
    // A future heartbeat is invalid (clock rollback/skew poison). If one carrier
    // writes a valid beat while another snapshot still holds a future value, the
    // valid beat must recover the account instead of losing to Math.max forever.
    if (key === "onlineHeartbeatAt" && typeof after === "number") {
      const mergeNow = Date.now();
      const valid = [after, current].filter(
        (value): value is number => typeof value === "number" && value <= mergeNow,
      );
      merged[key] = valid.length > 0 ? Math.max(...valid) : null;
      return;
    }
    // A newly introduced anchor often transitions from undefined/null to a
    // number on two carriers at once. Freshest-wins must also cover that first
    // write, not only the number→number case below.
    if (TIME_ANCHOR_KEYS.has(key) && typeof after === "number") {
      merged[key] = typeof current === "number" ? Math.max(current, after) : after;
      return;
    }
    if (typeof before === "number" && typeof after === "number" && typeof current === "number") {
      if (!ADDITIVE_NUMBER_KEYS.has(key)) {
        merged[key] = after;
        return;
      }
      const delta = after - before;
      merged[key] = +(current + delta).toFixed(6);
      return;
    }
    merged[key] = after;
  });
  return merged as T;
}

function mergeDeviceByDiff(base: Device | undefined, next: Device, latest: Device | undefined): Device {
  if (!base || !latest) return next;
  const merged = mergeFieldByDiff(
    base as unknown as JsonRecord,
    next as unknown as JsonRecord,
    latest as unknown as JsonRecord,
  ) as unknown as Device;

  if (next.todayEarnings !== base.todayEarnings && latest.todayEarnings !== base.todayEarnings) {
    merged.todayEarnings = Math.max(latest.todayEarnings, next.todayEarnings);
  }
  if (next.todayEarningsNEX !== base.todayEarningsNEX && latest.todayEarningsNEX !== base.todayEarningsNEX) {
    merged.todayEarningsNEX = Math.max(latest.todayEarningsNEX, next.todayEarningsNEX);
  }
  return merged;
}

function mergeDevicesByDiff(base: Device[], next: Device[], latest: Device[]): Device[] {
  const baseById = new Map(base.map((d) => [d.id, d]));
  const nextById = new Map(next.map((d) => [d.id, d]));
  const latestById = new Map(latest.map((d) => [d.id, d]));
  const order = latest.map((d) => d.id);

  base.forEach((device) => {
    if (!nextById.has(device.id)) {
      latestById.delete(device.id);
      const idx = order.indexOf(device.id);
      if (idx >= 0) order.splice(idx, 1);
    }
  });

  next.forEach((device) => {
    const baseDevice = baseById.get(device.id);
    if (!baseDevice && !order.includes(device.id)) order.push(device.id);
    if (!baseDevice || !sameValue(baseDevice, device)) {
      latestById.set(device.id, mergeDeviceByDiff(baseDevice, device, latestById.get(device.id)));
    }
  });

  return order.map((id) => latestById.get(id)).filter((d): d is Device => !!d);
}

/**
 * 提现单列表三路合并:**按单号取并集**,同一单的状态取 rank 更靠后的那份。
 *
 * 关键性质(单条版没有的):两端各自新建的单**都会保留**,不再互相顶掉。
 * 状态用 rank 单调而不是 last-write —— 跨渲染进程「读最新」可能读到旧值,
 * last-write 会把已到账的单退回处理中。
 */
function mergeWithdrawals(
  base: Withdrawal[],
  next: Withdrawal[],
  latest: Withdrawal[],
): Withdrawal[] {
  const byId = new Map<string, Withdrawal>();
  for (const w of [...latest, ...next]) {
    const prev = byId.get(w.id);
    if (!prev) {
      byId.set(w.id, w);
      continue;
    }
    const a = WITHDRAWAL_STATUS_RANK[prev.status] ?? 0;
    const c = WITHDRAWAL_STATUS_RANK[w.status] ?? 0;
    byId.set(w.id, c > a ? w : prev);
  }
  // base 里有、两边都没有的 = 被某一端显式删除;当前无删除路径,留此语义防将来复活死单
  const deleted = new Set(base.filter((w) => !byId.has(w.id)).map((w) => w.id));
  return [...byId.values()]
    .filter((w) => !deleted.has(w.id))
    .sort((x, y) => y.submittedAt - x.submittedAt);
}

export function mergeAccountSnapshots(
  base: AccountCloudSnapshot,
  next: AccountCloudSnapshot,
  latest: AccountCloudSnapshot,
): AccountCloudSnapshot {
  return {
    schema: 1,
    accountKey: normalizeAccountKey(next.accountKey),
    entrySurface: next.entrySurface,
    updatedAt: Date.now(),
    user: mergeFieldByDiff(
      base.user as unknown as JsonRecord,
      next.user as unknown as JsonRecord,
      latest.user as unknown as JsonRecord,
    ) as unknown as UserState,
    devices: mergeDevicesByDiff(base.devices, next.devices, latest.devices),
    earnings: mergeFieldByDiff(
      base.earnings as unknown as JsonRecord,
      next.earnings as unknown as JsonRecord,
      latest.earnings as unknown as JsonRecord,
    ) as unknown as EarningsState,
    withdrawals: mergeWithdrawals(base.withdrawals ?? [], next.withdrawals ?? [], latest.withdrawals ?? []),
  };
}

/** 资金不变量收口:余额类字段 clamp ≥0,且 withdrawableUsdt ≤ usdtBalance(可提额度 ⊆
 *  总余额)。ADDITIVE_NUMBER_KEYS 把余额字段当独立计数器做三路累加,多端并发扣款(各自
 *  本地合法)合并时两笔扣款都累加 → 总余额被扣穿为负 / 可提额度虚高于总余额(超卖)。真后端
 *  单事务天然不会;mock 层在写盘前统一收口,storage 与内存都不落负余额/虚高可提额度
 *  (与单会话 debitBalance clamp 同一不变量,补住 merge 层这条旁路)。 */
function clampAccountFundInvariants(snapshot: AccountCloudSnapshot): AccountCloudSnapshot {
  const u = snapshot.user;
  const usdtBalance = Math.max(0, u.usdtBalance);
  const nexBalance = Math.max(0, u.nexBalance);
  const b = u.earningBuckets;
  if (!b) return { ...snapshot, user: { ...u, usdtBalance, nexBalance } };
  return {
    ...snapshot,
    user: {
      ...u,
      usdtBalance,
      nexBalance,
      earningBuckets: {
        ...b,
        withdrawableUsdt: Math.min(Math.max(0, b.withdrawableUsdt), usdtBalance),
        pendingReviewUsdt: Math.max(0, b.pendingReviewUsdt),
        bonusLockedUsdt: Math.max(0, b.bonusLockedUsdt),
        lockedNex: Math.max(0, b.lockedNex),
      },
    },
  };
}

export function mergeAndWriteAccountSnapshot(
  base: AccountCloudSnapshot | null,
  next: AccountCloudSnapshot,
): AccountCloudSnapshot {
  return mergeAndWriteAccountSnapshotResult(base, next).snapshot;
}

/** Fail-aware variant used by money/reward flows that may not acknowledge a lost write. */
/** 只是「又过了一秒」的心跳时间戳 —— 内容比对时排除。
 *
 *  🔴 实测(不是推断):即使某一拍**一分钱收益都没产生**,`lastBucketedAt` 与
 *  `onlineHeartbeatAt` 仍被盖成当前时刻。第一版脏检查没排除它们,60 拍照写 60 次,零改善。
 *
 *  🔴 为什么排除它们是安全的:这两个字段**只表示「这一拍跑过了」**,不承载金额或状态 ——
 *  真有收益的那一拍必然伴随 `todayEarnings` / 桶余额 / `lastSettledAt` 的变化(实测那一拍
 *  有 24 项差异),那时照写不误。它们晚 N 秒落盘的唯一后果:强杀重开后 `isDeviceOnline`
 *  的 3 分钟判定窗口平移 N 秒,而 N 的上界就是「下一次真有变化的写盘」——活跃机队上是秒级。
 *
 *  🔴 **不排除 `lastSettledAt`**:它是计价锚点,与钱同生共死,少写一次就少付一段。 */
const HEARTBEAT_ONLY_KEYS = new Set(["lastBucketedAt", "onlineHeartbeatAt"]);

/** 稳定序列化(键排序 + 排除 `updatedAt` 与纯心跳戳)—— 只用于「内容变没变」的比对。
 *
 *  🔴 必须键排序:磁盘那份是 JSON.parse 出来的(键序 = 上次写入时的序),内存这份可能来自
 *  `{ ...next }` 展开或合并函数的对象字面量,两者键序未必一致。直接 JSON.stringify 比的
 *  就成了「键序一样吗」而不是「内容一样吗」—— 判据恒判"有变化",脏检查白做。 */
function stableJson(value: unknown, isRoot = true): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => stableJson(v, false)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => !(isRoot && k === "updatedAt") && !HEARTBEAT_ONLY_KEYS.has(k))
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k], false)}`).join(",")}}`;
}

export function mergeAndWriteAccountSnapshotResult(
  base: AccountCloudSnapshot | null,
  next: AccountCloudSnapshot,
): AccountSnapshotWriteResult {
  const key = normalizeAccountKey(next.accountKey);
  const latest = readAccountSnapshot(key);
  const rawMerged = base && latest ? mergeAccountSnapshots(base, next, latest) : { ...next, accountKey: key, updatedAt: Date.now() };
  const merged = clampAccountFundInvariants(rawMerged);
  // 🔴 内容没变就不写盘(2026-08-04 完全版 A 第一步,行为中性)。
  //
  // 实测:静置 60 秒账户快照被写 **60 次**,而真正产生收益的只有 ~29 次
  // (settle 的 SETTLE_MIN_MS 是 1.8s)—— 一半以上的写盘内容一个字节都没变。
  // 而每次写盘是「读整表 + JSON.parse 全表 → 改一行 → 序列化整表写回」,空写也是全额代价。
  //
  // 🔴 只跳过**写**,绝不跳过前面的读 + 三路合并 —— 那一步是本页**收取其它标签页改动**的
  // 唯一时机(今天靠每秒一次 persist 顺带完成)。跳掉它,一个闲置标签页会永远看不到
  // 另一页刚充的钱。省的是写,不是同步。
  const sameAsDisk = latest !== null && stableJson(latest) === stableJson(merged);
  const writeSucceeded = sameAsDisk ? true : writeAccountSnapshot(merged);
  const stored = sameAsDisk ? latest : readAccountSnapshot(key);
  return {
    snapshot: stored ?? merged,
    persisted: writeSucceeded && stored !== null,
  };
}
