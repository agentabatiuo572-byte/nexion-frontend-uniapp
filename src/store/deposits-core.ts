import type { ChainDepositChannel, DepositIntent, DepositRecord } from "./types";

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

/** FNV-1a 32 位哈希(地址派生种子;deposit-usdt-pane 的 QR 点阵 seed 复用同源)。 */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 种子化 PRNG(与 fnv1a 配对;QR 点阵/地址派生共用)。 */
export function mulberry32(seed: number): () => number {
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

// ── 银行轨([FEAT-PAY02] ③ mock 种子)──────────────────────────────
// 真后台 = D1 银行轨参数(单笔上限/容差)+ 收款账户池(启停/日限/熔断/轮换);
// client 拉取,拉取失败禁回退写死值。最低额与链上共用 MIN_DEPOSIT_USDT($10 等值)。

/** 单笔上限(USD 等值;后台 D1 可配,2026-07-24 拍板 $5,000)。 */
export const BANK_MAX_DEPOSIT_USDT = 5000;

/** 回单金额容差(±₫;差异超此值 → mismatch_review,后台 D1 可配)。 */
export const BANK_VND_TOLERANCE = 1000;

/** 附言码字符集:无易混字符(去 0/O/1/I/L/2/Z/5/S/B/G/Q/U/V,同原型)。 */
const MEMO_CHARSET = "346789ACDEFHJKMNPRTWXY";

/** ⚠️ MOCK-ONLY:附言码 `NX-` + 6 位(在途唯一性由 store 兜底重摇)。PROD = server mint。 */
export function mockMemoCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += MEMO_CHARSET[Math.floor(Math.random() * MEMO_CHARSET.length)];
  return `NX-${s}`;
}

/** 收款账户池行:派发字段 + 启停位(enabled=false 覆盖 admin bank-rail 的
 *  停用与熔断两种语义,uniapp 侧不细分;移出轮换即可)。 */
export type BankReceiveAccount = DepositIntent["bankAccount"] & { enabled: boolean };

/** ⚠️ MOCK-ONLY:收款账户池(轮询轮换)。真后台 = D1 收款账户池 server 派发
 *  (启停/日限/熔断);银行/户名/尾号与 admin bank-rail 种子同风格;
 *  用户转账需完整账号,不脱敏。 */
export const BANK_RECEIVE_ACCOUNTS: ReadonlyArray<BankReceiveAccount> = [
  { accountName: "CTY TNHH NEXGRID VIETNAM", accountNumber: "1023 8829 5501", bankName: "Vietcombank", enabled: true },
  { accountName: "CTY TNHH NEXGRID VIETNAM", accountNumber: "1903 6688 8842", bankName: "Techcombank", enabled: true },
  { accountName: "CTY TNHH NEXGRID VIETNAM", accountNumber: "0355 8020 2074", bankName: "MB Bank", enabled: true },
];

/** 轮询取号:先滤掉停用/熔断户,再按 rotation 取模(负数/越界防御);
 *  全禁用 → null(通道维护,[FEAT-PAY02] ⑤ 空状态);返回值剥掉 enabled 位,
 *  意向单只存派发字段。 */
export function pickBankAccount(
  rotation: number,
  accounts: ReadonlyArray<BankReceiveAccount> = BANK_RECEIVE_ACCOUNTS,
): DepositIntent["bankAccount"] | null {
  const pool = accounts.filter((a) => a.enabled);
  const n = pool.length;
  if (n === 0) return null;
  const { accountName, accountNumber, bankName } = pool[((Math.trunc(rotation) % n) + n) % n];
  return { accountName, accountNumber, bankName };
}

/** 确定性 QR 装饰点阵(n×n 伪随机 + 三角定位块;银行轨 seed = 附言码)。
 *  ponytail: 拟真非真编码,与 deposit-usdt-pane 内联实现同构;PROD 接真 QR 库后删除。 */
export function qrDotMatrix(seed: string, n = 21): boolean[] {
  // 标准定位块:7×7 外环暗 + 中环亮 + 3×3 内心暗
  const finderDark = (dx: number, dy: number): boolean => {
    const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
    return ring === 3 || ring <= 1;
  };
  const rnd = mulberry32(fnv1a(seed || "nexgrid"));
  const cells: boolean[] = [];
  for (let cy = 0; cy < n; cy++) {
    for (let cx = 0; cx < n; cx++) {
      if (cx < 7 && cy < 7) cells.push(finderDark(cx, cy));
      else if (cx >= n - 7 && cy < 7) cells.push(finderDark(cx - (n - 7), cy));
      else if (cx < 7 && cy >= n - 7) cells.push(finderDark(cx, cy - (n - 7)));
      else cells.push(rnd() > 0.52);
    }
  }
  return cells;
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
