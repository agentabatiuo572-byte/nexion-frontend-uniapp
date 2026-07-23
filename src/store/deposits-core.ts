import type { ChainDepositChannel, DepositRecord } from "./types";

// 入金纯逻辑(PAY-规格 [FEAT-PAY01] ③)。零依赖(vue/pinia/uni 均不引),
// deposits store 与 scripts/selfcheck-deposits.mjs 共用同一实现。

// ── 通道配置(MOCK 单源常量)─────────────────────────────────────────
// 真后台 = 后台 D1 通道配置下发(client 拉取,拉取失败禁回退写死值);
// 此表仅 mock 种子,PROD 切换时整段被 GET /api/config/deposit-channels 替换。

/** 通道费(USDT)。 */
export const CHAIN_DEPOSIT_FEE_USDT: Record<ChainDepositChannel, number> = {
  "usdt-trc20": 1,
  "usdt-bep20": 1,
  "usdt-erc20": 5,
};

/** 入账所需确认数(TRC20 20 · ERC20 12 · BEP20 15;后台 D1 可配)。 */
export const CHAIN_REQUIRED_CONFIRMATIONS: Record<ChainDepositChannel, number> = {
  "usdt-trc20": 20,
  "usdt-erc20": 12,
  "usdt-bep20": 15,
};

/** 最低充值额(USD);低于此额 → dust_hold(后台 D1 可配)。 */
export const MIN_DEPOSIT_USDT = 10;

export function chainDepositFeeUsdt(network: ChainDepositChannel): number {
  return CHAIN_DEPOSIT_FEE_USDT[network];
}

/** 入账额 = gross − fee,两位小数(creditedUsdt 生成规则)。 */
export function computeCreditedUsdt(grossAmountUsdt: number, feeUsdt: number): number {
  return +(grossAmountUsdt - feeUsdt).toFixed(2);
}

// ── 每用户 × 每网络专属充值地址(确定性派生)────────────────────────
// wallet-pairing 的 mockExternalAddress 是「随机一次性」形态;充值地址必须
// 「同账号同网络恒定」(server 派发恒定不轮换),故同形态 + 确定性种子:
// seed = hash(accountKey|network) → 种子化 PRNG → 逐字符生成。
// PROD: GET /api/deposits/address?network= 返回 server 派发地址,本段整体删除。

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** 同账号同网络恒定;TRC20 = "T" + 33 位(34 位总长),EVM = "0x" + 40 hex。 */
export function deriveDepositAddress(accountKey: string, network: ChainDepositChannel): string {
  const rnd = mulberry32(fnv1a(`${accountKey}|${network}`));
  const hex = (n: number): string => {
    const chars = "0123456789abcdef";
    let s = "";
    for (let i = 0; i < n; i++) s += chars[Math.floor(rnd() * 16)];
    return s;
  };
  if (network === "usdt-trc20") {
    // TRON 形态:T + 33 字符(与 mockExternalAddress 同款近似 base58 大写)
    return "T" + hex(33).toUpperCase();
  }
  // ERC20 / BEP20 共用 EVM 0x 形态(按网络各派各的地址,规格「每网络专属」)
  return "0x" + hex(40);
}

// ── 幂等 ───────────────────────────────────────────────────────────

/** 同 txHash 已存在 → 重复上报 no-op([FEAT-PAY01] ④ 幂等键)。 */
export function isDuplicateTxHash(
  records: readonly Pick<DepositRecord, "txHash">[],
  txHash: string,
): boolean {
  if (!txHash) return false;
  return records.some((r) => r.txHash === txHash);
}

// ── MOCK 单号 / 哈希铸造 ───────────────────────────────────────────

/** ⚠️ MOCK-ONLY:`DP-YYYYMMDD-NNNN`(与 WD- 同族)。PROD = server mint,禁客户端造。 */
export function mockDepositId(now: number): string {
  const yyyymmdd = new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
  const seq = Math.floor(1000 + Math.random() * 9000);
  return `DP-${yyyymmdd}-${seq}`;
}

/** ⚠️ MOCK-ONLY:伪造链上 txHash(0x + 64 hex)。PROD:链上侦测服务回报真实哈希。 */
export function mockChainTxHash(): string {
  const chars = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 64; i++) s += chars[Math.floor(Math.random() * 16)];
  return "0x" + s;
}
