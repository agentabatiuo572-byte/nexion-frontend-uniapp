import { getDeviceId, getDeviceIdentity } from "@/lib/device-id";
import { normalizeAccountKey } from "@/store/account-cloud";
import { mockServerUuid } from "@/store/mock-id";

// SPEC-7 风险身份注册表 — mock K1 的数据层(单一事实来源)。
//
// ⚠️ MOCK-ONLY: PROD 里这张表活在服务端(注册/绑卡/提现时服务端落 RiskIdentity,
// 敏感值只存 hash);client 永远只收 K1 的结论摘要,不持有原始表。
// 本模块与会话/账户云存储【故意分离】:登出、清会话、删账号都不清风险注册表 ——
// 这是「清缓存重铸身份」攻击面的 mock 防线(墨菲 §10)。清空整个 localStorage
// 在演示口径上等价于「换了一台设备/换了网络环境」,此时跨维度回溯(同推荐人/
// 同提现地址)仍可归簇(FEAT-RISK01 异常3 的验收路径)。

const REGISTRY_KEY = "nexion-risk-registry-v1";
const IP_BUCKET_KEY = "nexion-ip-bucket-v1";

export interface RiskHashUse {
  hash: string;
  firstSeenAt: number;
}

export interface RiskIdentityRecord {
  accountKey: string;
  // client device id 只是 hint(证据),mock 里兼任 serverDeviceId 的位置。
  deviceHint: string;
  // mock 无真 IP: 同一浏览器环境 = 同一 IP 桶(独立持久 key,清库=换网络环境)。
  ipBucket: string;
  uaFingerprint: string;
  sponsorId: string | null;
  registeredAt: number;
  withdrawAddresses: RiskHashUse[];
  paymentInstruments: RiskHashUse[];
  // R2 冷启动保守: 首次提现标记。
  hasWithdrawn: boolean;
  // App 在线证明累计时长(ms)。settle() 在 App 载体、设备真在线时累加;
  // 达 config.riskCluster.appAttestationReleaseHours 即具备释放资格(R1)。
  attestedOnlineMs: number;
}

interface RiskRegistry {
  schema: 1;
  accounts: Record<string, RiskIdentityRecord>;
}

function readRegistry(): RiskRegistry {
  try {
    const raw = uni.getStorageSync(REGISTRY_KEY) as RiskRegistry | "";
    if (raw && typeof raw === "object" && raw.schema === 1 && raw.accounts) return raw;
  } catch {
    // storage unavailable
  }
  return { schema: 1, accounts: {} };
}

function writeRegistry(registry: RiskRegistry): void {
  try {
    uni.setStorageSync(REGISTRY_KEY, registry);
  } catch {
    // storage unavailable
  }
}

// djb2 → base36. mock 只要稳定散列,不需要密码学强度。
export function riskHash(value: string): string {
  let h = 5381;
  const s = value.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function withdrawAddressHash(network: string, address: string): string {
  return riskHash(`${network}:${address}`);
}

/** 同一浏览器环境的稳定伪 IP 桶(mock)。 */
export function getIpBucket(): string {
  try {
    const cached = uni.getStorageSync(IP_BUCKET_KEY) as string | "";
    if (cached && typeof cached === "string") return cached;
  } catch {
    // first run
  }
  const bucket = `ipb-${riskHash(mockServerUuid())}`;
  try {
    uni.setStorageSync(IP_BUCKET_KEY, bucket);
  } catch {
    // storage unavailable
  }
  return bucket;
}

export function getUaFingerprint(): string {
  return riskHash(getDeviceIdentity().deviceName);
}

export function getRiskRecord(accountKey: string): RiskIdentityRecord | null {
  return readRegistry().accounts[normalizeAccountKey(accountKey)] ?? null;
}

export function listRiskRecords(): RiskIdentityRecord[] {
  return Object.values(readRegistry().accounts);
}

/** 构造一条「尚未注册」的候选记录(注册前评估用,不落表)。 */
export function buildCandidateRecord(accountKey: string, sponsorId: string | null): RiskIdentityRecord {
  return {
    accountKey: normalizeAccountKey(accountKey),
    deviceHint: getDeviceId(),
    ipBucket: getIpBucket(),
    uaFingerprint: getUaFingerprint(),
    sponsorId: sponsorId ? sponsorId.trim().toLowerCase() : null,
    registeredAt: Date.now(),
    withdrawAddresses: [],
    paymentInstruments: [],
    hasWithdrawn: false,
    attestedOnlineMs: 0,
  };
}

function upsert(accountKey: string, patch: (record: RiskIdentityRecord) => RiskIdentityRecord): void {
  const key = normalizeAccountKey(accountKey);
  const registry = readRegistry();
  const existing = registry.accounts[key] ?? buildCandidateRecord(key, null);
  registry.accounts = { ...registry.accounts, [key]: patch({ ...existing }) };
  writeRegistry(registry);
}

/** 注册落表(账户创建成功后调用;失败不落 = 不产生半成品身份)。 */
export function recordRegistration(accountKey: string, sponsorId: string | null): void {
  upsert(accountKey, (r) => ({
    ...r,
    sponsorId: sponsorId ? sponsorId.trim().toLowerCase() : r.sponsorId,
  }));
}

export function recordWithdrawAddressUse(accountKey: string, network: string, address: string): void {
  const hash = withdrawAddressHash(network, address);
  upsert(accountKey, (r) =>
    r.withdrawAddresses.some((a) => a.hash === hash)
      ? r
      : { ...r, withdrawAddresses: [...r.withdrawAddresses, { hash, firstSeenAt: Date.now() }] },
  );
}

export function recordPaymentInstrument(accountKey: string, instrument: string): void {
  const hash = riskHash(instrument);
  upsert(accountKey, (r) =>
    r.paymentInstruments.some((p) => p.hash === hash)
      ? r
      : { ...r, paymentInstruments: [...r.paymentInstruments, { hash, firstSeenAt: Date.now() }] },
  );
}

export function markWithdrawn(accountKey: string): void {
  upsert(accountKey, (r) => ({ ...r, hasWithdrawn: true }));
}

/** App 在线证明累计(P3: settle 在 App 载体、设备真在线时调用)。 */
export function recordAttestation(accountKey: string, deltaMs: number): void {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
  upsert(accountKey, (r) => ({ ...r, attestedOnlineMs: r.attestedOnlineMs + deltaMs }));
}
