import { normalizeAccountKey } from "@/store/account-cloud";
import { mockServerNow } from "@/store/server-time";
import { useConfig } from "@/store/config";
import { evaluateAccountCluster } from "@/store/risk-cluster";
import {
  getRiskRecord,
  listRiskRecords,
  markWithdrawn,
  recordWithdrawAddressUse,
  withdrawAddressHash,
} from "@/store/risk-identity";
import type { Withdrawal } from "@/store/types";
import type { WithdrawalRiskRoute } from "@/store/config-types";
import { decideFromStores, isDailyLimitReached, nextDayResetAt } from "@/store/withdrawal-eligibility-core";
import { readWithdrawCounter } from "@/store/withdraw-daily-count";
import { useWalletPairing } from "@/store/wallet-pairing";
import {
  NEW_ADDRESS_AGE_DAYS,
  NEW_ADDRESS_LARGE_AMOUNT_USDT,
} from "@/store/wallet-pairing-core";

// SPEC-7 提现前置风控(mock K3,推倒重写版)。
//
// 六输入(FEAT-RISK03 + 整改 R2/R5 + PAY04 异常4):
//   1. 账户当前簇状态(R5: 每次评估现算,禁用注册缓存)
//   2. 同提现地址跨账户复用(强信号 → withdrawRules.sameAddressRoute)
//   3. 首次提现标记(R2 冷启动保守: firstWithdrawalManual 时无条件 manual)
//   4. 提现地址新绑定期(R2: 首见未满 newAddressHoldHours → delay)
//   5. mock K4 分(簇评估附带;达冻结建议线 → manual 升级)
//   6. 换绑地址账龄(PAY04 异常4: 绑定 verifiedAt 起账龄 < 7 天且请求金额
//      ≥ $1,000 → 强制 manual;对齐 K3「新地址持有期」既有输入,不新造维度)
// 路由优先级: reject > freeze > manual > delay > pass;reject 不建单不扣款,
// freeze/manual/delay 建单进对应队列(资金占用),由服务端/人工推进。
//
// PROD: 整个模块被 K3 服务端评估替换;client 只消费 WithdrawalEligibility。

export interface WithdrawalEligibility {
  canSubmit: boolean;
  maxWithdrawableUsdt: number;
  route: WithdrawalRiskRoute;
  /** 稳定 reason code(页面渲染时映射 i18n,禁直出工程码)。 */
  riskReasons: string[];
  /** FEAT-WD01a:本次是否命中小额免审快车道。 */
  fastLaneApplied: boolean;
  /** FEAT-WD01a:被快车道免掉的闸名(本会命中但因小额而未生效的);未命中时为空数组。 */
  waivedGates: string[];
  /** FEAT-WD01b:今日笔数是否已用完 */
  dailyLimitReached: boolean;
  /** FEAT-WD01b:下次可提时间(明日 0 点),用于文案插值 */
  dailyCountResetAt: number;
  configVersion: string;
}

// ROUTE_SEVERITY / worse() 已迁到 withdrawal-eligibility-core.ts —— 判定逻辑单源在那边,
// 这里留副本会让人以为改这里就能改行为(实际改了没用),故删净不留。

export function evaluateWithdrawal(
  accountKey: string,
  network: Withdrawal["network"],
  address: string,
  withdrawableUsdt: number,
  requestedUsdt?: number,
): WithdrawalEligibility {
  // 本函数只做一件事:**从各 store 把事实取齐**,然后交给纯函数判定。
  // 判定逻辑一行都不在这里 —— 见 withdrawal-eligibility-core.ts 的 decideWithdrawalRoute。
  // 这样拆的原因(2026-07-31 熔断结论):判定是纯函数才能被行为测试直接跑,
  // 而「小额免审不得越过风控」是行为约束,只有行为测试守得住(源码结构哨兵被连续攻破四种绕法)。
  const cfg = useConfig().config;
  const rules = cfg.withdrawRules;
  const key = normalizeAccountKey(accountKey);

  // 🔴 本段**只许转发 store 原始对象**,不许有任何表达式(判空 / 三元 / 查找 / 遍历都不行)。
  // 第 4 轮复验实证:外壳只要还留着表达式,原攻击就能一字不改地搬过来
  // (S4 = 原 Bypass C 搬到外壳,五个外壳注入全绿全是真免闸)。
  // 取字段、判空、找元素、跨账户比对全在 core 的 toRawFacts 里 —— 那边行为哨兵覆盖得到。
  const cluster = evaluateAccountCluster(key);
  const decision = decideFromStores({
    now: mockServerNow(),
    binding: useWalletPairing().activeBinding,
    ownRecord: getRiskRecord(key),
    allRecords: listRiskRecords(),
    accountKey: key,
    addressHash: withdrawAddressHash(network, address.trim()),
    address,
    cluster,
    freezeSuggestThreshold: cfg.riskCluster.clusterFreezeSuggestThreshold,
    newAddressHoldHours: rules.newAddressHoldHours,
    newAddressAgeDays: NEW_ADDRESS_AGE_DAYS,
    largeAmountUsdt: NEW_ADDRESS_LARGE_AMOUNT_USDT,
    requestedUsdt,
    withdrawableUsdt,
    smallAmountThresholdUsd: rules.smallAmountThresholdUsd,
    minWithdrawableUsdt: rules.minWithdrawableUsdt,
    sameAddressRoute: rules.sameAddressRoute,
    firstWithdrawalManual: rules.firstWithdrawalManual,
    withdrawCounter: readWithdrawCounter(key),
    dailyWithdrawLimitCount: rules.dailyWithdrawLimitCount,
  });

  return {
    canSubmit: decision.canSubmit,
    maxWithdrawableUsdt: withdrawableUsdt,
    route: decision.route,
    riskReasons: decision.riskReasons,
    // FEAT-WD01a:是否走了小额快车道 + 被免掉的闸名(审计与客服解释用)。
    // PROD:server 权威回传,client 仅 UI cache。
    fastLaneApplied: decision.fastLaneApplied,
    waivedGates: decision.waivedGates,
    dailyLimitReached: decision.dailyLimitReached,
    dailyCountResetAt: nextDayResetAt(mockServerNow()),
    configVersion: `wr:${rules.minWithdrawableUsdt}/${rules.sameAddressRoute}/${rules.firstWithdrawalManual ? "first-manual" : "first-open"}/${rules.newAddressHoldHours}h/fl:${rules.smallAmountThresholdUsd} · ${cluster.configVersion}`,
  };
}

/**
 * FEAT-WD01b:今日额度状态(**纯查询,不占用**)。追踪页「再提一笔」判置灰用。
 * 本段同样只转发,判据在 core 的 isDailyLimitReached。
 */
export function dailyLimitStatus(accountKey: string): { reached: boolean; resetAt: number } {
  const now = mockServerNow();
  return {
    reached: isDailyLimitReached(
      readWithdrawCounter(normalizeAccountKey(accountKey)),
      useConfig().config.withdrawRules.dailyWithdrawLimitCount,
      now,
    ),
    resetAt: nextDayResetAt(now),
  };
}

/** 提现单创建成功后登记地址使用 + 首提标记(K1 回溯聚簇的强维输入)。 */
export function commitWithdrawal(accountKey: string, network: Withdrawal["network"], address: string): void {
  recordWithdrawAddressUse(accountKey, network, address);
  markWithdrawn(accountKey);
  // 🔴 每日笔数**不在这里** +1。曾经挂在这儿(建单成功后),被独立验收 3 轮 3 中
  // 复现出并发绕过:「查 → 600ms 风控评估 → 建单 → 才写计数」中间的窗口太长。
  // 现在改成建单前 claimWithdrawSlot 先占额度(app.ts submitWithdrawal),
  // 挪回来就等于把漏洞放回去。
}

// ── 提交时点的服务端评估形态(⑤ 加载态 + 异常3 超时)────────────────────
// PROD: POST /api/withdrawals/eligibility → 服务端 K3 评估;client 只消费。
// 显示层可用同步 evaluateWithdrawal 做预览,但「提交」必须走本异步形态,
// 超时不乐观扣款(reject 由调用方 catch 后提示重试)。
let devEligibilityTimeout = false;

/** ⚠️ DEV/DEMO-ONLY: 模拟 K3 评估超时(FEAT-RISK03 异常3)。 */
export function _devSetEligibilityTimeout(value: boolean): void {
  if (import.meta.env.PROD) return; // 提现前置评估入口,store 层二层 guard(硬规则5)
  devEligibilityTimeout = value;
}

export function requestWithdrawalEligibility(
  accountKey: string,
  network: Withdrawal["network"],
  address: string,
  withdrawableUsdt: number,
  requestedUsdt?: number,
): Promise<WithdrawalEligibility> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (devEligibilityTimeout) {
        reject(new Error("risk-check-timeout"));
        return;
      }
      resolve(evaluateWithdrawal(accountKey, network, address, withdrawableUsdt, requestedUsdt));
    }, 600);
  });
}
