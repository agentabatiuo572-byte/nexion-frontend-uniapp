import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { ChainDepositChannel } from "./types";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";
import { mockServerNow } from "./server-time";
import { useApp } from "./app";
import { useConfig } from "./config";
import { recordWithdrawAddressUse } from "./risk-identity";
import {
  applyAddAddress,
  applyChangeAddress,
  CHAIN_TO_WITHDRAW_NETWORK,
  emptyBook,
  emptyNetworkState,
  eligibilityBindingFor,
  isChainAddressValid,
  migrateFromPairing,
  PAYOUT_NETWORKS,
  payoutChangeBlockReason,
  type LegacyPairingRow,
  type NetworkPayoutState,
  type PayoutAddressBook,
  type PayoutChangeBlockReason,
} from "./payout-address-core";

// 提现地址直管(FEAT-KYC-RM01a)。每网络至多一个当前地址,用户直填 + OTP 确认;
// $1 钱包配对 / KYC-Express 机制已删除(FEAT-KYC-RM01b),存量配对地址由
// migrateFromPairing 一次性自动迁移(source=migrated,无需重验、无新地址保护期)。
//
// server-canonical:PROD = GET /api/payout-addresses + POST(添加)/ PUT(更换,
// 服务端在事务内做 OTP 核验、在途单拦截、频控与冻结落库),本 store 整体被替换;
// client 只消费快照。按账号作用域存储(规格 ② 异常5:换号不继承)。
// ⚠️ 上述 endpoint 均为 TBD 候选命名:FEAT-KYC-RM01 未定义 API 层,PRD 接口章节待实现批次修订。

const ACCOUNTS_KEY = "nexgrid-payout-address-accounts-v1"; // { [accountKey]: PayoutAddressBook }
// 旧配对行只读消费(一次性迁移来源)。历史台账数据保留只读,不回写、不清洗、不删除。
const LEGACY_PAIRING_KEY = "nexgrid-wallet-pairing-accounts-v1";

/** 频控天数(后台 D5 可配;boot 早期 config store 不可用时回落种子同值 7)。 */
function cooldownDaysNow(): number {
  try {
    return useConfig().config.withdrawRules.rebindCooldownDays;
  } catch {
    return 7;
  }
}

function normalizeBook(row: Partial<PayoutAddressBook>): PayoutAddressBook {
  const book = emptyBook();
  for (const network of PAYOUT_NETWORKS) {
    const r = row[network];
    if (r && typeof r === "object") {
      book[network] = {
        current: r.current ?? null,
        history: Array.isArray(r.history) ? r.history : [],
        freezeUntil: typeof r.freezeUntil === "number" ? r.freezeUntil : null,
        nextChangeAt: typeof r.nextChangeAt === "number" ? r.nextChangeAt : null,
      };
    }
  }
  return book;
}

function hydrate(accountKey: string): PayoutAddressBook {
  const row = readAccountRow<Partial<PayoutAddressBook>>(ACCOUNTS_KEY, accountKey);
  if (row && typeof row === "object") return normalizeBook(row);

  // 新行缺席 → 尝试从旧配对行一次性迁移(幂等:成功即写新行,下次直接走上面分支)。
  const legacy = readAccountRow<LegacyPairingRow>(LEGACY_PAIRING_KEY, accountKey);
  const migrated = migrateFromPairing(legacy, cooldownDaysNow());
  if (migrated.status === "migrated") {
    writeAccountRow<PayoutAddressBook>(ACCOUNTS_KEY, accountKey, migrated.book);
    // 迁移地址按**原验证时刻**登记风控首见 —— 既有「新地址持有期」信号看到的是老地址,
    // 不产生新保护期(规格 ② 异常6:可直接提现、无需重验)。
    for (const network of PAYOUT_NETWORKS) {
      const current = migrated.book[network].current;
      if (current) {
        recordWithdrawAddressUse(accountKey, CHAIN_TO_WITHDRAW_NETWORK[network], current.address, current.addedAt);
      }
    }
    return migrated.book;
  }
  if (migrated.status === "corrupt") {
    // 🔴 有配对痕迹但取不出地址:不写空行(写了 = 把用户地址静默清掉且永不再重试)。
    // 内存维持空态,留痕;旧行原样保留,修复后的版本可重迁。
    console.error("[payout-address] legacy pairing row unmigratable — keeping in-memory empty, legacy row untouched");
  }
  return emptyBook();
}

export const usePayoutAddress = defineStore("payoutAddress", () => {
  // 账号维度。boot 期落 "default";账号确定后由 lib/account-scope 统一重绑。
  // 🔴 地址簿必按账号:设备级存储会让换号继承他人提现地址(资格旁路,规格 ② 异常5)。
  let boundKey = "default";
  const book = ref<PayoutAddressBook>(hydrate(boundKey));

  function persist(): boolean {
    return writeAccountRow<PayoutAddressBook>(ACCOUNTS_KEY, boundKey, book.value);
  }

  /** 账号切换重绑:装载该账号的地址簿(防跨账号继承地址与历史)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    book.value = hydrate(boundKey);
  }

  /** 单网络状态(缺省网络回落空态,不抛)。 */
  function stateFor(network: ChainDepositChannel): NetworkPayoutState {
    return book.value[network] ?? emptyNetworkState();
  }

  /** 当前地址(null = 未设置 → 提现页空态引导卡)。 */
  function currentFor(network: ChainDepositChannel) {
    return stateFor(network).current;
  }

  /** 喂风控判定的绑定快照(加工在 core 的 eligibilityBindingFor,行为哨兵覆盖)。 */
  function bindingFor(network: ChainDepositChannel) {
    return eligibilityBindingFor(stateFor(network));
  }

  /** 任一网络已设地址(钱包面「管理」入口态)。 */
  const hasAnyAddress = computed(() => PAYOUT_NETWORKS.some((network) => book.value[network]?.current));

  /**
   * 该网络是否有在途提现单。
   * 🔴 问**整张在途列表**(occupiesWithdrawalSlot 筛出的非终态集合)再按网络过滤,
   * 不读 latestWithdrawal —— 只看最新一笔时,一张在途单 + 一张更新的已到账单
   * 会把闸静默架空,收款地址能在放款前被换掉(2026-08-01 审计,资金安全级)。
   */
  function hasInFlightWithdrawalOn(network: ChainDepositChannel): boolean {
    return useApp().inFlightWithdrawals.some((w) => w.network === CHAIN_TO_WITHDRAW_NETWORK[network]);
  }

  /** 更换前的禁止动作判定(null = 可更换;页面与提交动作共用同一判据)。 */
  function changeBlockReason(network: ChainDepositChannel): PayoutChangeBlockReason | null {
    return payoutChangeBlockReason({
      now: mockServerNow(),
      hasInFlightWithdrawal: hasInFlightWithdrawalOn(network),
      nextChangeAt: stateFor(network).nextChangeAt,
    });
  }

  /**
   * 首次添加(OTP 已在页面侧走既有生命周期核验;PROD = POST /api/payout-addresses(TBD 候选命名)。
   * 生效即 current;新地址保护期经既有风控信号裁决(登记首见 = addedAt),不冻结不频控。
   */
  function addAddress(
    network: ChainDepositChannel,
    address: string,
  ): { ok: true } | { ok: false; reason: "invalid-address" | "already-set" | "persist-failed" } {
    if (!isChainAddressValid(network, address)) return { ok: false, reason: "invalid-address" };
    const now = mockServerNow();
    const next = applyAddAddress(stateFor(network), address, now);
    if (!next) return { ok: false, reason: "already-set" };
    const prev = book.value;
    book.value = { ...prev, [network]: next };
    if (!persist()) {
      book.value = prev; // 持久化失败回滚内存态(同 deposits.patchRecord 先例)
      return { ok: false, reason: "persist-failed" };
    }
    recordWithdrawAddressUse(boundKey, CHAIN_TO_WITHDRAW_NETWORK[network], next.current!.address, now);
    return { ok: true };
  }

  /**
   * 原子更换(OTP + 二次确认已在页面侧完成;PROD = PUT /api/payout-addresses/{network}(TBD 候选命名)。
   * 拦截优先级:在途单 > 频控;成功后旧址入历史、24h 冻结、频控锚点落库 —— 同一次
   * persist = 同事务,失败整体回滚。
   */
  function changeAddress(
    network: ChainDepositChannel,
    address: string,
  ):
    | { ok: true }
    | { ok: false; reason: PayoutChangeBlockReason | "invalid-address" | "no-current" | "same-address" | "persist-failed" } {
    const blocked = changeBlockReason(network);
    if (blocked) return { ok: false, reason: blocked };
    if (!isChainAddressValid(network, address)) return { ok: false, reason: "invalid-address" };
    const state = stateFor(network);
    if (!state.current) return { ok: false, reason: "no-current" };
    if (state.current.address === address.trim()) return { ok: false, reason: "same-address" };
    const now = mockServerNow();
    const next = applyChangeAddress(state, address, now, cooldownDaysNow());
    if (!next) return { ok: false, reason: "no-current" };
    const prev = book.value;
    book.value = { ...prev, [network]: next };
    if (!persist()) {
      book.value = prev;
      return { ok: false, reason: "persist-failed" };
    }
    recordWithdrawAddressUse(boundKey, CHAIN_TO_WITHDRAW_NETWORK[network], next.current!.address, now);
    return { ok: true };
  }

  /** ⚠️ DEV/DEMO-ONLY:tester 复位 —— 清除全部网络的冻结与频控(不动地址本身)。 */
  function _devClearRestrictions(): boolean {
    if (import.meta.env.PROD) return false; // dev-only reset, store-layer second guard
    const next = { ...book.value };
    for (const network of PAYOUT_NETWORKS) {
      next[network] = { ...next[network], freezeUntil: null, nextChangeAt: null };
    }
    book.value = next;
    persist();
    return true;
  }

  /** ⚠️ DEV/DEMO-ONLY:tester 复位 —— 清空当前账号地址簿(回到未设置空态)。 */
  function _devResetAddresses(): boolean {
    if (import.meta.env.PROD) return false;
    book.value = emptyBook();
    persist();
    return true;
  }

  // tester 驱动通道:DEV 挂 globalThis.__nxDev(PROD 不挂 —— guard 双层之外层)。
  if (!import.meta.env.PROD) {
    const g = globalThis as unknown as { __nxDev?: Record<string, unknown> };
    g.__nxDev = {
      ...(g.__nxDev ?? {}),
      payoutClearRestrictions: _devClearRestrictions,
      payoutResetAddresses: _devResetAddresses,
    };
  }

  return {
    book,
    hasAnyAddress,
    stateFor,
    currentFor,
    bindingFor,
    changeBlockReason,
    addAddress,
    changeAddress,
    bindAccount,
    _devClearRestrictions,
    _devResetAddresses,
  };
});
