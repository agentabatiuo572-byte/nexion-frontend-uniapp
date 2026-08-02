import type { ChainDepositChannel, Withdrawal, WithdrawalStatus } from "./types";

// 提现地址换绑纯逻辑(PAY-规格 [FEAT-PAY04] ③④)。零依赖(vue/pinia/uni 均不引),
// wallet-pairing store 与 scripts/selfcheck-rebind.mjs 共用同一实现。

// ── 参数(MOCK 单源常量)────────────────────────────────────────────
// rebindCooldownDays 走 config.withdrawRules(后台 D5/K3 可配);其余为 K3/服务端
// 侧参数,mock 以常量表达。PROD:server 下发,本段被配置拉取替换。

/** 换绑验证窗口:verifying 30 分钟倒计时,超时 expired。 */
export const REBIND_VERIFY_WINDOW_MS = 30 * 60 * 1000;
/** 换绑生效后提现冻结时长(freezeUntil = verifiedAt + 24h)。 */
export const REBIND_FREEZE_MS = 24 * 3600 * 1000;
/** 验证转账金额($1,从新地址转出)。 */
export const REBIND_VERIFY_AMOUNT_USDT = 1;
/** PAY04 异常4(K3 地址账龄信号):账龄阈值 7 天。 */
export const NEW_ADDRESS_AGE_DAYS = 7;
/** PAY04 异常4:大额阈值 $1,000(账龄不足 + ≥此额 → manual)。 */
export const NEW_ADDRESS_LARGE_AMOUNT_USDT = 1000;

// ── 模型 ───────────────────────────────────────────────────────────

/** 绑定状态机:verifying → active → revoked(server-canonical)。 */
export type WithdrawBindingStatus = "verifying" | "active" | "revoked";

/** 提现地址绑定(每用户同一时刻有且仅有一个 active;规格 ③ 数据字典)。 */
export interface WithdrawAddressBinding {
  /** server mint `AB-YYYYMMDD-NNNN`。 */
  bindingId: string;
  /** 链地址(与 KYC-Express 验证地址同一实体,换绑即更换 KYC 绑定地址)。 */
  address: string;
  /** 与提现网络枚举同源收窄(usdt-trc20/erc20/bep20)。 */
  network: ChainDepositChannel;
  status: WithdrawBindingStatus;
  createdAt: number;
  /** $1 验证完成时间 = 地址账龄起点(喂 K3)。 */
  verifiedAt?: number;
  /** = verifiedAt + 24h;冻结期内提现入口置灰。换绑生效的绑定才有(初始 KYC 配对不冻结)。 */
  freezeUntil?: number;
}

/** 换绑单状态机(规格 ④):initiated → verifying(30min)→ active / expired / cancelled。 */
export type RebindOrderStatus = "initiated" | "verifying" | "active" | "expired" | "cancelled";

/**
 * 换绑单。mock 里 initiated → verifying 在 startRebind 内同步完成(server 注册
 * 链上侦测即入窗口);pending 的新绑定字段(address/network)随单携带,activation
 * 时才落 bindings 行 —— 与规格 ③「binding 默认 status=verifying」1:1 可映射
 * (server 视角那行 = 本单),client 侧 bindings[] 只存已生效/已撤销的真绑定。
 */
export interface RebindOrder {
  /** 生效后即新绑定的 bindingId(AB- mint,单/绑定同号)。 */
  bindingId: string;
  address: string;
  network: ChainDepositChannel;
  status: RebindOrderStatus;
  createdAt: number;
  /** verifying 窗口终点 = createdAt + 30min。 */
  expiresAt: number;
  /** 异常2:侦测到验证转账来自其他地址(可重试,窗口不中断)。 */
  lastError?: "wrong-source" | null;
}

// ── 网络枚举映射(binding 用 server 收窄枚举;展示/提现单用既有大写形态)──

export const CHAIN_TO_WITHDRAW_NETWORK: Record<ChainDepositChannel, Withdrawal["network"]> = {
  "usdt-trc20": "USDT-TRC20",
  "usdt-erc20": "USDT-ERC20",
  "usdt-bep20": "USDT-BEP20",
};

export function fromWithdrawNetwork(network: Withdrawal["network"]): ChainDepositChannel {
  const entry = (Object.entries(CHAIN_TO_WITHDRAW_NETWORK) as [ChainDepositChannel, Withdrawal["network"]][]).find(
    ([, v]) => v === network,
  );
  return entry ? entry[0] : "usdt-trc20";
}

// ── 校验 / 铸造 ────────────────────────────────────────────────────

/**
 * 链地址格式校验。TRC20 = T + 33 字符;ERC20/BEP20 = 0x + 40 hex。
 * ponytail: mock 派生地址(deriveDepositAddress/mockExternalAddress)是「近似
 * base58 大写」形态,故 TRON 位用宽松字母数字而非严格 base58;PROD 换链上校验库。
 */
export function isChainAddressValid(network: ChainDepositChannel, address: string): boolean {
  const a = address.trim();
  if (network === "usdt-trc20") return /^T[A-Za-z0-9]{33}$/.test(a);
  return /^0x[0-9a-fA-F]{40}$/.test(a);
}

/** ⚠️ MOCK-ONLY:`AB-YYYYMMDD-NNNN`(与 WD-/DP- 同族)。PROD = server mint。 */
export function mintBindingId(now: number): string {
  const yyyymmdd = new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
  const seq = Math.floor(1000 + Math.random() * 9000);
  return `AB-${yyyymmdd}-${seq}`;
}

// ── 频控 / 禁止动作(规格 ④)─────────────────────────────────────────

// 🔴 这里曾有一份「在途状态白名单」IN_FLIGHT_WITHDRAWAL_STATUSES = [submitted,
// review-pending, review-passed, processing] 和它的 isInFlightWithdrawal()。已删除。
//
// 删的理由(2026-08-01 审计,资金安全级):它漏了 sent 与 frozen 两个**占着单据槽**的状态,
// 于是「风控冻结中、钱已经扣了」的账户,换绑闸认不出来 → 可以在放款前自由改收款地址。
// 而同一个概念在 withdrawal-arrival-core 里已有正确实现 occupiesWithdrawalSlot(非终态即占用)。
//
// 结构上的教训:同一个概念**不许有两份判据**。而且白名单和黑名单的失败方向是相反的 ——
// 白名单漏一个新状态 = 默认「不在途」= 闸放行(危险);黑名单终态漏一个 = 默认「在途」= 闸拦住(保守)。
// 涉及钱的判据一律取保守那一侧。全站统一 occupiesWithdrawalSlot,本文件不再导出同义谓词。

export type RebindBlockReason = "withdrawal-in-flight" | "cooldown" | "order-in-progress";

/**
 * 发起换绑的禁止动作判定(null = 可发起)。
 * 优先级:在途单 > 进行中的换绑单 > 7 天频控(与页面提示一致:最硬的先报)。
 */
export function rebindStartBlockReason(input: {
  now: number;
  hasInFlightWithdrawal: boolean;
  order: RebindOrder | null;
  lastRebindAt?: number;
  cooldownDays: number;
}): RebindBlockReason | null {
  if (input.hasInFlightWithdrawal) return "withdrawal-in-flight";
  if (input.order && (input.order.status === "initiated" || input.order.status === "verifying")) {
    return "order-in-progress";
  }
  if (input.lastRebindAt !== undefined) {
    const cooldownMs = input.cooldownDays * 24 * 3600 * 1000;
    if (input.now - input.lastRebindAt < cooldownMs) return "cooldown";
  }
  return null;
}

// ── 原子换绑(规格 ④:新 active + 旧 revoked 同事务)───────────────────

/**
 * 纯函数事务体:verifying 单 → 生效。返回下一步 bindings(旧 active 全部置
 * revoked —— 防御性覆盖损坏数据里的多 active)+ 新 active 绑定(verifiedAt=now,
 * freezeUntil=now+24h)。终态单(active/expired/cancelled)禁再处置 → null。
 * 后置条件:结果里 active 有且仅有一个。持久化(同一次写 = 同事务)归调用方。
 */
export function applyRebindActivation(
  bindings: readonly WithdrawAddressBinding[],
  order: RebindOrder,
  now: number,
): { bindings: WithdrawAddressBinding[]; activated: WithdrawAddressBinding } | null {
  if (order.status !== "verifying") return null;
  const activated: WithdrawAddressBinding = {
    bindingId: order.bindingId,
    address: order.address,
    network: order.network,
    status: "active",
    createdAt: order.createdAt,
    verifiedAt: now,
    freezeUntil: now + REBIND_FREEZE_MS,
  };
  const next = bindings.map((b): WithdrawAddressBinding => (b.status === "active" ? { ...b, status: "revoked" } : b));
  return { bindings: [...next, activated], activated };
}

// ── 冻结 / 倒计时 ───────────────────────────────────────────────────

export function freezeRemainingMs(freezeUntil: number | undefined, now: number): number {
  if (freezeUntil === undefined) return 0;
  return Math.max(0, freezeUntil - now);
}

/** 换绑冻结期判定(UI 置灰与 K3 评估层共用同一判据,server-canonical 二层 guard)。 */
export function isRebindFrozen(freezeUntil: number | undefined, now: number): boolean {
  return freezeRemainingMs(freezeUntil, now) > 0;
}

/** 倒计时排版:hours=true → hh:mm:ss(冻结横幅),false → mm:ss(验证窗口)。 */
export function formatClock(ms: number, opts?: { hours?: boolean }): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const two = (n: number) => String(n).padStart(2, "0");
  if (opts?.hours) {
    return `${two(Math.floor(total / 3600))}:${two(Math.floor((total % 3600) / 60))}:${two(total % 60)}`;
  }
  return `${two(Math.floor(total / 60))}:${two(total % 60)}`;
}
