import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { ChainDepositChannel, Withdrawal } from "./types";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";
import { mockServerNow } from "./server-time";
import { useApp } from "./app";
import { useConfig } from "./config";
import {
  applyRebindActivation,
  CHAIN_TO_WITHDRAW_NETWORK,
  fromWithdrawNetwork,
  isChainAddressValid,
  mintBindingId,
  rebindStartBlockReason,
  REBIND_VERIFY_WINDOW_MS,
  type RebindBlockReason,
  type RebindOrder,
  type WithdrawAddressBinding,
} from "./wallet-pairing-core";

// Wallet pairing state (v3.2 KYC-Express) + 提现地址换绑(PAY-规格 [FEAT-PAY04])。
//
// First-time withdrawals are gated behind a $1 USDT "wallet ownership
// verification" deposit. After the user completes KYC-Express top-up in
// /pages/me/wallet-topup?kyc=1, this store records the pairing so future
// withdraw visits skip the banner. Cross-store coupling: the topup page calls
// both complete() AND useApp.creditBalance($1) so the user's $1 is credited.
//
// 换绑(2026-07-24 A6):提现地址 = KYC 绑定地址(§4.4.3 单地址原则,无地址簿)。
// bindings[] 存已生效/已撤销的真绑定(同一时刻有且仅有一个 active);进行中的
// 换绑单在 rebindOrder(pending 新地址随单携带,生效才落 bindings 行)。
// MOCK 铁律:换绑单状态 server-canonical —— _devRebind* 扮演服务端(链上侦测
// $1 验证转账 → 原子换绑),页面/client 无写状态入口。PROD:POST /api/rebind-orders
// 建单、GET 轮询收敛、验证侦测与生效由 server 推进,本引擎整体删除。

export interface WalletPairingState {
  walletPaired: boolean;
  pairedWalletAddress?: string;
  pairedNetwork?: Withdrawal["network"];
  complianceCheckId?: string; // "KYC-2026-A78234" style
  pairedAt?: number; // epoch ms
  /** 绑定台账(active + revoked 历史;初始 KYC 配对即第一条 active)。 */
  bindings?: WithdrawAddressBinding[];
  /** 进行中/最近一张换绑单(expired/cancelled 留存供页面展示可重试)。 */
  rebindOrder?: RebindOrder | null;
  /** 最近一次换绑生效时间(7 天频控锚点;初始 KYC 配对不计)。 */
  lastRebindAt?: number;
}

// 旧设备级单键 "nexgrid-wallet-pairing-v1" 废弃(存量无账号归属,mock 可重建);KYC 配对按账号分行。
const ACCOUNTS_KEY = "nexgrid-wallet-pairing-accounts-v1"; // { [accountKey]: WalletPairingState }

// Stable id format mirroring §6.9 receipts: KYC-{YYYY}-A{seq}
let kycSeq = 78234;
function nextComplianceId(): string {
  kycSeq += 1;
  const year = new Date().getFullYear();
  return `KYC-${year}-A${kycSeq}`;
}

function hydrate(accountKey: string): WalletPairingState {
  const row = readAccountRow<Partial<WalletPairingState>>(ACCOUNTS_KEY, accountKey);
  if (row && typeof row.walletPaired === "boolean") {
    const state: WalletPairingState = {
      walletPaired: row.walletPaired,
      pairedWalletAddress: row.pairedWalletAddress,
      pairedNetwork: row.pairedNetwork,
      complianceCheckId: row.complianceCheckId,
      pairedAt: row.pairedAt,
      bindings: Array.isArray(row.bindings) ? row.bindings : [],
      rebindOrder: row.rebindOrder ?? null,
      lastRebindAt: row.lastRebindAt,
    };
    // 存量迁移:换绑上线前的旧行只有 pairedWalletAddress,无 bindings 台账 →
    // 由既有配对合成第一条 active 绑定(verifiedAt = pairedAt,喂 K3 账龄),
    // 并立即写回持久层(幂等:下次 hydrate 走上面分支,bindingId 不再每次重铸)。
    if (state.walletPaired && state.pairedWalletAddress && (state.bindings ?? []).length === 0) {
      state.bindings = [
        {
          bindingId: mintBindingId(state.pairedAt ?? Date.now()),
          address: state.pairedWalletAddress,
          network: fromWithdrawNetwork(state.pairedNetwork ?? "USDT-TRC20"),
          status: "active",
          createdAt: state.pairedAt ?? Date.now(),
          verifiedAt: state.pairedAt,
        },
      ];
      writeAccountRow<WalletPairingState>(ACCOUNTS_KEY, accountKey, state);
    }
    return state;
  }
  return { walletPaired: false, bindings: [], rebindOrder: null };
}

export const useWalletPairing = defineStore("walletPairing", () => {
  // 账号维度。boot 期落 "default";账号确定后由 lib/account-scope 统一重绑(P-031 store 不互 import)。
  // 🔴 KYC 配对必按账号:否则 wallet-exchange 的 setKycVerified(walletPaired) 镜像会把设备级
  // walletPaired 灌进换后账号的 exchange-v3.kycVerified,绕过 >$100 KYC 闸(P2-8 源头修复)。
  let boundKey = "default";
  const init = hydrate(boundKey);
  const walletPaired = ref(init.walletPaired);
  const pairedWalletAddress = ref<string | undefined>(init.pairedWalletAddress);
  const pairedNetwork = ref<Withdrawal["network"] | undefined>(init.pairedNetwork);
  const complianceCheckId = ref<string | undefined>(init.complianceCheckId);
  const pairedAt = ref<number | undefined>(init.pairedAt);
  const bindings = ref<WithdrawAddressBinding[]>(init.bindings ?? []);
  const rebindOrder = ref<RebindOrder | null>(init.rebindOrder ?? null);
  const lastRebindAt = ref<number | undefined>(init.lastRebindAt);

  function persist(): boolean {
    return writeAccountRow<WalletPairingState>(ACCOUNTS_KEY, boundKey, {
      walletPaired: walletPaired.value,
      pairedWalletAddress: pairedWalletAddress.value,
      pairedNetwork: pairedNetwork.value,
      complianceCheckId: complianceCheckId.value,
      pairedAt: pairedAt.value,
      bindings: bindings.value,
      rebindOrder: rebindOrder.value,
      lastRebindAt: lastRebindAt.value,
    });
  }

  /** 账号切换重绑:装载该账号的钱包配对/KYC/换绑状态(防跨账号继承 KYC 资格与绑定)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    const next = hydrate(boundKey);
    walletPaired.value = next.walletPaired;
    pairedWalletAddress.value = next.pairedWalletAddress;
    pairedNetwork.value = next.pairedNetwork;
    complianceCheckId.value = next.complianceCheckId;
    pairedAt.value = next.pairedAt;
    bindings.value = next.bindings ?? [];
    rebindOrder.value = next.rebindOrder ?? null;
    lastRebindAt.value = next.lastRebindAt;
  }

  function complete(input: { address: string; network: Withdrawal["network"] }) {
    const now = Date.now();
    walletPaired.value = true;
    pairedWalletAddress.value = input.address;
    pairedNetwork.value = input.network;
    complianceCheckId.value = nextComplianceId();
    pairedAt.value = now;
    // 初始 KYC 配对 = 第一条 active 绑定(verifiedAt=now 喂 K3 账龄;不设冻结 ——
    // 冻结是「换绑」的安全措施,KYC 完成即可继续提现是既有产品流)。
    bindings.value = [
      {
        bindingId: mintBindingId(now),
        address: input.address,
        network: fromWithdrawNetwork(input.network),
        status: "active",
        createdAt: now,
        verifiedAt: now,
      },
    ];
    persist();
  }

  function reset() {
    if (import.meta.env.PROD) return; // dev-only KYC reset, store-layer second guard
    walletPaired.value = false;
    pairedWalletAddress.value = undefined;
    pairedNetwork.value = undefined;
    complianceCheckId.value = undefined;
    pairedAt.value = undefined;
    bindings.value = [];
    rebindOrder.value = null;
    lastRebindAt.value = undefined;
    persist();
  }

  // ── 换绑(PAY04 ②阳光2 + 异常1-4 / ④ 状态机)──────────────────────

  /** 当前生效绑定(有且仅有一个;未 KYC = null)。 */
  const activeBinding = computed<WithdrawAddressBinding | null>(
    () => bindings.value.find((b) => b.status === "active") ?? null,
  );

  /** 冻结终点(生效绑定的 freezeUntil;无冻结/已过期由调用方按 now 判断)。 */
  const freezeUntil = computed<number | undefined>(() => activeBinding.value?.freezeUntil);

  function hasInFlightWithdrawal(): boolean {
    // 🔴 问**整张列表**:只看最新一笔时,人工审核单还没放款而后提的一笔已到账,
    // 换绑闸就被静默架空(独立验收实测)—— 收款地址能在放款前被换掉。
    // inFlightWithdrawals 本身就是按「非终态」筛出来的(occupiesWithdrawalSlot),非空即有单占着槽。
    // 曾经在这里再用一份白名单谓词二次过滤,把外层的正确性抵消掉 —— sent / frozen 被漏掉,
    // 风控冻结中、钱已扣的账户能改收款地址(2026-08-01 审计,资金安全级)。判据只留一份。
    return useApp().inFlightWithdrawals.length > 0;
  }

  /** 发起换绑前的禁止动作检查(null = 可发起;提现页/换绑页共用同一判定)。 */
  function rebindBlockReason(): RebindBlockReason | null {
    return rebindStartBlockReason({
      now: mockServerNow(),
      hasInFlightWithdrawal: hasInFlightWithdrawal(),
      order: rebindOrder.value,
      lastRebindAt: lastRebindAt.value,
      cooldownDays: useConfig().config.withdrawRules.rebindCooldownDays,
    });
  }

  /**
   * 发起换绑单:initiated → verifying 同步完成(mock server 即时注册链上侦测,
   * 30min 窗口开始)。失败返回 reason(在途单 / 频控 / 已有进行中单 / 地址非法)。
   */
  function startRebind(
    address: string,
    network: ChainDepositChannel,
  ): { ok: true; order: RebindOrder } | { ok: false; reason: RebindBlockReason | "invalid-address" } {
    const blocked = rebindBlockReason();
    if (blocked) return { ok: false, reason: blocked };
    if (!isChainAddressValid(network, address)) return { ok: false, reason: "invalid-address" };
    const now = mockServerNow();
    const order: RebindOrder = {
      bindingId: mintBindingId(now),
      address: address.trim(),
      network,
      status: "verifying",
      createdAt: now,
      expiresAt: now + REBIND_VERIFY_WINDOW_MS,
      lastError: null,
    };
    const previous = rebindOrder.value;
    rebindOrder.value = order;
    if (!persist()) {
      rebindOrder.value = previous; // 持久化失败回滚内存态(同 deposits.patchRecord 先例)
      return { ok: false, reason: "order-in-progress" };
    }
    return { ok: true, order };
  }

  /**
   * server-canonical 轮询形态:读取换绑单并应用到期过期(verifying 超 30min →
   * expired)。mock 里过期在读取时收敛(= client 轮询拿到 server 已判的终态);
   * 页面倒计时归零后调用即可,client 不主动推进其它状态。
   */
  function pollRebindOrder(): RebindOrder | null {
    const order = rebindOrder.value;
    if (order && order.status === "verifying" && mockServerNow() > order.expiresAt) {
      rebindOrder.value = { ...order, status: "expired" };
      persist();
    }
    return rebindOrder.value;
  }

  /** 取消换绑:initiated/verifying → cancelled(终态禁再处置)。 */
  function cancelRebind(): boolean {
    const order = pollRebindOrder();
    if (!order || (order.status !== "initiated" && order.status !== "verifying")) return false;
    const previous = rebindOrder.value;
    rebindOrder.value = { ...order, status: "cancelled" };
    if (!persist()) {
      rebindOrder.value = previous;
      return false;
    }
    return true;
  }

  /** ⚠️ DEV/DEMO-ONLY:模拟「侦测到 $1 验证转账、来源=新地址」→ 原子换绑。
   *  新绑定 active(verifiedAt=now,freezeUntil=now+24h)+ 旧绑定 revoked +
   *  换绑单 active + 镜像 pairedWalletAddress(换绑即更换 KYC 绑定地址)——
   *  同一次 persist = 同事务,失败整体回滚。PROD:server 在链上侦测回调事务内完成。 */
  function _devRebindVerified(): boolean {
    if (import.meta.env.PROD) return false;
    const order = pollRebindOrder();
    if (!order || order.status !== "verifying") return false; // expired/终态禁再处置
    const now = mockServerNow();
    const result = applyRebindActivation(bindings.value, order, now);
    if (!result) return false;
    const prev = {
      bindings: bindings.value,
      order: rebindOrder.value,
      lastRebindAt: lastRebindAt.value,
      address: pairedWalletAddress.value,
      network: pairedNetwork.value,
    };
    bindings.value = result.bindings;
    rebindOrder.value = { ...order, status: "active", lastError: null };
    lastRebindAt.value = now;
    pairedWalletAddress.value = result.activated.address;
    pairedNetwork.value = CHAIN_TO_WITHDRAW_NETWORK[result.activated.network];
    if (!persist()) {
      bindings.value = prev.bindings;
      rebindOrder.value = prev.order;
      lastRebindAt.value = prev.lastRebindAt;
      pairedWalletAddress.value = prev.address;
      pairedNetwork.value = prev.network;
      return false;
    }
    return true;
  }

  /** ⚠️ DEV/DEMO-ONLY:模拟「验证转账来自其他地址」(异常2)→ 失败可重试,窗口不中断。 */
  function _devRebindWrongSource(): boolean {
    if (import.meta.env.PROD) return false;
    const order = pollRebindOrder();
    if (!order || order.status !== "verifying") return false;
    rebindOrder.value = { ...order, lastError: "wrong-source" };
    persist();
    return true;
  }

  /** ⚠️ DEV/DEMO-ONLY:tester 复位 —— 清除冻结 + 频控锚点(不动绑定本身)。 */
  function _devRebindClearFreeze(): boolean {
    if (import.meta.env.PROD) return false;
    bindings.value = bindings.value.map((b) =>
      b.status === "active" && b.freezeUntil !== undefined ? { ...b, freezeUntil: undefined } : b,
    );
    lastRebindAt.value = undefined;
    persist();
    return true;
  }

  // tester 驱动通道:DEV 挂 globalThis.__nxDev(PROD 不挂 —— guard 双层之外层;同 deposits 先例)。
  if (!import.meta.env.PROD) {
    const g = globalThis as unknown as { __nxDev?: Record<string, unknown> };
    g.__nxDev = {
      ...(g.__nxDev ?? {}),
      rebindVerified: _devRebindVerified,
      rebindWrongSource: _devRebindWrongSource,
      rebindClearFreeze: _devRebindClearFreeze,
    };
  }

  return {
    walletPaired,
    pairedWalletAddress,
    pairedNetwork,
    complianceCheckId,
    pairedAt,
    bindings,
    rebindOrder,
    lastRebindAt,
    activeBinding,
    freezeUntil,
    complete,
    reset,
    bindAccount,
    rebindBlockReason,
    startRebind,
    pollRebindOrder,
    cancelRebind,
    _devRebindVerified,
    _devRebindWrongSource,
    _devRebindClearFreeze,
  };
});

// Generate a network-appropriate mock address (looks real, fully simulated).
export function mockExternalAddress(network: Withdrawal["network"]): string {
  const hex = (n: number) => {
    const chars = "0123456789abcdef";
    let s = "";
    for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 16)];
    return s;
  };
  switch (network) {
    case "USDT-TRC20":
      // TRON addresses: T + 33 base58 chars (approximate with mixed case)
      return "T" + hex(33).toUpperCase().slice(0, 33);
    case "USDT-ERC20":
    case "USDT-BEP20":
      // shared EVM-style 0x address form for ERC20 / BEP20
      return "0x" + hex(40);
  }
}
