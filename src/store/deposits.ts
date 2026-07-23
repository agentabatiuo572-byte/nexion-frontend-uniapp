import { defineStore } from "pinia";
import { ref } from "vue";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";
import { mockServerNow } from "./server-time";
import { useApp } from "./app";
import { useBills } from "./bills";
import {
  CHAIN_REQUIRED_CONFIRMATIONS,
  MIN_DEPOSIT_USDT,
  chainDepositFeeUsdt,
  computeCreditedUsdt,
  deriveDepositAddress,
  isDuplicateTxHash,
  mockChainTxHash,
  mockDepositId,
} from "./deposits-core";
import type { ChainDepositChannel, DepositIntent, DepositRecord } from "./types";

// 入金 store(PAY-规格 [FEAT-PAY01] 链上三网络;[FEAT-PAY02] 银行轨 intents
// 本任务只建骨架字段,意向单生命周期动作归 A4)。
//
// MOCK 铁律:status server-canonical——本文件的「到账引擎」扮演的是服务端
// (链上侦测 → 确认推进 → 入账),页面/client 无任何写状态入口(纯展示)。
// PROD 切换:引擎整体删除,client 改为轮询 GET /api/deposits 收敛状态;
// 入账(余额 + 账单)由 server 在 credited 落库事务内完成。

const ACCOUNTS_KEY = "nexgrid-deposits-accounts-v1"; // { [accountKey]: { records, intents } }

interface DepositsRow {
  records: DepositRecord[];
  intents: DepositIntent[];
}

function hydrate(accountKey: string): DepositsRow {
  const row = readAccountRow<Partial<DepositsRow>>(ACCOUNTS_KEY, accountKey);
  return {
    records: row && Array.isArray(row.records) ? row.records : [],
    intents: row && Array.isArray(row.intents) ? row.intents : [],
  };
}

/** bills memo 用通道标签(账单 memo 与既有 seed "Top-up · USDT-TRC20" 同款式)。 */
const CHANNEL_MEMO: Record<ChainDepositChannel, string> = {
  "usdt-trc20": "USDT-TRC20",
  "usdt-erc20": "USDT-ERC20",
  "usdt-bep20": "USDT-BEP20",
};

// 确认推进节奏(演示压缩;真链 TRC20 分钟级)。detected → 1.2s → confirming,
// 之后按 requiredConfirmations 均分 ~10s 逐一推进 → 全程 ~11s 落 credited。
const DETECT_TO_CONFIRM_MS = 1200;
const CONFIRM_WINDOW_MS = 10_000;

export const useDeposits = defineStore("deposits", () => {
  // 账号维度。boot 期落 "default";账号确定后由 lib/account-scope 的
  // rebindAccountScopedStores 统一重绑(P-031 store 不互 import 的编排收口)。
  let boundKey = "default";
  const initial = hydrate(boundKey);
  const records = ref<DepositRecord[]>(initial.records);
  const intents = ref<DepositIntent[]>(initial.intents);

  // mock 到账引擎的在途定时器(depositId → timer)。账号切换即停:引擎跑在
  // client,跨账号继续推进会把钱记进新绑账号;PROD 服务端持续推进,
  // client 重新拉取即收敛(切回账号后记录停在 confirming,属 mock 已知边界)。
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function persist(): boolean {
    return writeAccountRow<DepositsRow>(ACCOUNTS_KEY, boundKey, {
      records: records.value,
      intents: intents.value,
    });
  }

  /** 账号切换重绑:装载该账号分行,停掉上一账号的在途引擎定时器。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    const row = hydrate(boundKey);
    records.value = row.records;
    intents.value = row.intents;
  }

  /** 专属充值地址:同账号同网络恒定(mock 确定性派生;PROD server 派发)。 */
  function depositAddress(network: ChainDepositChannel): string {
    return deriveDepositAddress(boundKey, network);
  }

  /** 延迟回调禁 stale 闭包:一律现读 records.value 现改现写(feedback_delayed_callback_stale_closure)。 */
  function patchRecord(depositId: string, patch: Partial<DepositRecord>): DepositRecord | null {
    let next: DepositRecord | null = null;
    records.value = records.value.map((r) => {
      if (r.depositId !== depositId) return r;
      next = { ...r, ...patch };
      return next;
    });
    if (next) persist();
    return next;
  }

  /** 入账(mock server 内部;confirming 走满 / dust 人工核销两条边共用)。
   *  幂等三重:状态机边界(仅 confirming|dust_hold 可入)+ recordDeposit 原子
   *  入账 + bills.addOnce 以 txHash 为 ref 判重。PROD:server 在同一事务内
   *  置 credited + 记账 + 写账单(复式分录见规格 §5)。 */
  function settleCredited(depositId: string): boolean {
    const rec = records.value.find((r) => r.depositId === depositId);
    if (!rec) return false;
    // credited/returned 终态禁再处置(server 409 形态);detected 不可直接入账。
    if (rec.status !== "confirming" && rec.status !== "dust_hold") return false;
    if (rec.creditedUsdt <= 0) return false; // gross ≤ fee 的 dust 不可核销入账,只能退回
    if (!useApp().recordDeposit(rec.creditedUsdt)) return false;
    useBills().addOnce({
      type: "topup",
      symbol: "USDT",
      amount: rec.creditedUsdt,
      status: "posted",
      memo: `Top-up · ${CHANNEL_MEMO[rec.channel as ChainDepositChannel] ?? rec.channel}`,
      ref: rec.txHash ?? rec.depositId,
    });
    patchRecord(depositId, { status: "credited", creditedAt: mockServerNow() });
    return true;
  }

  /** mock 到账引擎:detected → confirming(或 dust_hold 停住)→ 逐步推进
   *  确认数 → 走满调 settleCredited。每步回源读当前记录,终态即停。 */
  function scheduleConfirmations(depositId: string) {
    const key = boundKey;
    function queue(ms: number) {
      timers.set(depositId, setTimeout(step, ms));
    }
    function step() {
      timers.delete(depositId);
      if (boundKey !== key) return; // 账号已切换,mock 引擎停(见顶部注释)
      const rec = records.value.find((r) => r.depositId === depositId);
      if (!rec) return;
      if (rec.status === "detected") {
        if (rec.grossAmountUsdt < MIN_DEPOSIT_USDT) {
          patchRecord(depositId, { status: "dust_hold" }); // 停住等后台人工处置
          return;
        }
        patchRecord(depositId, { status: "confirming" });
        queue(stepDelay(rec.requiredConfirmations ?? 1));
        return;
      }
      if (rec.status !== "confirming") return; // 终态/dust_hold 不再推进
      const required = rec.requiredConfirmations ?? 1;
      const confs = Math.min(required, (rec.confirmations ?? 0) + 1);
      patchRecord(depositId, { confirmations: confs });
      if (confs >= required) {
        settleCredited(depositId);
        return;
      }
      queue(stepDelay(required));
    }
    function stepDelay(required: number): number {
      return Math.max(400, Math.round(CONFIRM_WINDOW_MS / Math.max(1, required)));
    }
    queue(DETECT_TO_CONFIRM_MS);
  }

  /** ⚠️ DEV/DEMO-ONLY:模拟「链上侦测到入账转账」(tester 驱动通道)。
   *  双层 guard 同 _devSetEligibilityTimeout 模式(globalThis 挂载层 + 本层)。
   *  同 txHash 重复上报 no-op 返 null([FEAT-PAY01] ④ 幂等)。
   *  PROD 无此入口:真实链路 = 链上侦测服务回报,server 推进状态。 */
  function _devSimulateIncomingTransfer(
    network: ChainDepositChannel,
    amountUsdt: number,
    txHash?: string,
  ): DepositRecord | null {
    if (import.meta.env.PROD) return null;
    if (!(network in CHAIN_REQUIRED_CONFIRMATIONS)) return null; // console 驱动,入参不可信
    if (!Number.isFinite(amountUsdt) || amountUsdt <= 0 || amountUsdt > 1e9) return null;
    const hash = txHash && txHash.trim() ? txHash.trim() : mockChainTxHash();
    if (isDuplicateTxHash(records.value, hash)) return null; // no-op
    const now = mockServerNow();
    const gross = +amountUsdt.toFixed(2);
    const fee = chainDepositFeeUsdt(network);
    const rec: DepositRecord = {
      depositId: mockDepositId(now),
      channel: network,
      grossAmountUsdt: gross,
      feeUsdt: fee,
      creditedUsdt: computeCreditedUsdt(gross, fee),
      address: depositAddress(network),
      txHash: hash,
      confirmations: 0,
      requiredConfirmations: CHAIN_REQUIRED_CONFIRMATIONS[network],
      status: "detected",
      createdAt: now,
    };
    records.value = [rec, ...records.value];
    persist();
    scheduleConfirmations(rec.depositId);
    return rec;
  }

  /** ⚠️ DEV/DEMO-ONLY(后台动作形态):dust_hold 人工处置——核销入账或登记退回。
   *  仅 dust_hold 可处置,终态拒绝(server 409 形态)。PROD:后台 D1 高敏动作
   *  (确认 + 理由 + 审计 + 失败态),endpoint 形态
   *  POST /api/admin/deposits/:id/resolve { action: "credit"|"return", reason };client 无入口。 */
  function _devResolveDustHold(depositId: string, resolution: "credit" | "return"): boolean {
    if (import.meta.env.PROD) return false;
    const rec = records.value.find((r) => r.depositId === depositId);
    if (!rec || rec.status !== "dust_hold") return false;
    if (resolution === "credit") return settleCredited(depositId);
    return patchRecord(depositId, { status: "returned" }) !== null;
  }

  // tester 驱动通道:DEV 挂 globalThis.__nxDev(PROD 不挂 —— guard 双层之外层)。
  // store 在 rebindAccountScopedStores(App 启动恢复/login/register)首次实例化时挂上。
  if (!import.meta.env.PROD) {
    const g = globalThis as unknown as { __nxDev?: Record<string, unknown> };
    g.__nxDev = {
      ...(g.__nxDev ?? {}),
      simulateIncomingTransfer: _devSimulateIncomingTransfer,
      resolveDustHold: _devResolveDustHold,
    };
  }

  return {
    records,
    intents,
    bindAccount,
    depositAddress,
    _devSimulateIncomingTransfer,
    _devResolveDustHold,
  };
});
