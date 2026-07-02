import type { Device, EarningsState, UserState, Withdrawal } from "@/store/types";
import type { EntrySurface } from "@/lib/entry-surface";

const STORAGE_KEY = "nexion-account-cloud-v1";

export interface AccountCloudSnapshot {
  schema: 1;
  accountKey: string;
  entrySurface: EntrySurface;
  updatedAt: number;
  user: UserState;
  devices: Device[];
  earnings: EarningsState;
  latestWithdrawal: Withdrawal | null;
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
]);

const TIME_ANCHOR_KEYS = new Set([
  "joinedAt",
  "purchasedAt",
  "activatedAt",
  "lastSettledAt",
  "miningSince",
  "interruptedAt",
  "startedAt",
  "completedAt",
  "submittedAt",
  "estimatedCompletion",
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

function writeTable(table: AccountCloudTable): void {
  try {
    uni.setStorageSync(STORAGE_KEY, table);
  } catch {
    // storage unavailable
  }
}

export function readAccountSnapshot(accountKey: string): AccountCloudSnapshot | null {
  const key = normalizeAccountKey(accountKey);
  const row = readTable()[key];
  return row && row.schema === 1 ? row : null;
}

export function writeAccountSnapshot(snapshot: AccountCloudSnapshot): void {
  const key = normalizeAccountKey(snapshot.accountKey);
  const table = readTable();
  table[key] = { ...snapshot, accountKey: key, updatedAt: Date.now() };
  writeTable(table);
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
    if (typeof before === "number" && typeof after === "number" && typeof current === "number") {
      if (TIME_ANCHOR_KEYS.has(key)) {
        merged[key] = Math.max(current, after);
        return;
      }
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

function mergeLatestWithdrawal(
  base: Withdrawal | null,
  next: Withdrawal | null,
  latest: Withdrawal | null,
): Withdrawal | null {
  if (sameValue(base, next)) return latest;
  if (!next) return next;
  if (!latest) return next;
  if (next.id !== latest.id) {
    return latest.submittedAt >= next.submittedAt ? latest : next;
  }
  const nextRank = WITHDRAWAL_STATUS_RANK[next.status] ?? 0;
  const latestRank = WITHDRAWAL_STATUS_RANK[latest.status] ?? 0;
  return latestRank >= nextRank ? latest : next;
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
    latestWithdrawal: mergeLatestWithdrawal(base.latestWithdrawal, next.latestWithdrawal, latest.latestWithdrawal),
  };
}

export function mergeAndWriteAccountSnapshot(
  base: AccountCloudSnapshot | null,
  next: AccountCloudSnapshot,
): AccountCloudSnapshot {
  const key = normalizeAccountKey(next.accountKey);
  const latest = readAccountSnapshot(key);
  const merged = base && latest ? mergeAccountSnapshots(base, next, latest) : { ...next, accountKey: key, updatedAt: Date.now() };
  writeAccountSnapshot(merged);
  return readAccountSnapshot(key) ?? merged;
}
