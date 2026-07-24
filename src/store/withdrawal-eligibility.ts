import { normalizeAccountKey } from "@/store/account-cloud";
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
import { useWalletPairing } from "@/store/wallet-pairing";
import {
  isRebindFrozen,
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
  configVersion: string;
}

const ROUTE_SEVERITY: Record<WithdrawalRiskRoute, number> = {
  pass: 0,
  delay: 1,
  manual: 2,
  freeze: 3,
  reject: 4,
};

function worse(a: WithdrawalRiskRoute, b: WithdrawalRiskRoute): WithdrawalRiskRoute {
  return ROUTE_SEVERITY[b] > ROUTE_SEVERITY[a] ? b : a;
}

export function evaluateWithdrawal(
  accountKey: string,
  network: Withdrawal["network"],
  address: string,
  withdrawableUsdt: number,
  requestedUsdt?: number,
): WithdrawalEligibility {
  const cfg = useConfig().config;
  const rules = cfg.withdrawRules;
  const key = normalizeAccountKey(accountKey);
  const reasons: string[] = [];
  let route: WithdrawalRiskRoute = "pass";

  // 0. 换绑 24h 冻结(PAY04):UI 置灰之外的评估层硬闸(console 直调不可绕),
  // server-canonical 二层 guard 惯例。冻结期 route=freeze 且 canSubmit=false
  // (不建单不占资金,区别于簇冻结的 freeze 建单进队列)。
  const binding = useWalletPairing().activeBinding;
  const rebindFrozen = isRebindFrozen(binding?.freezeUntil, Date.now());
  if (rebindFrozen) {
    route = worse(route, "freeze");
    reasons.push("rebind-freeze");
  }

  // 1. 簇状态实时输入(R5)——即使余额已在可提桶,提现仍以当前簇为准。
  const cluster = evaluateAccountCluster(key);
  if (cluster.status === "frozen") {
    route = worse(route, "freeze");
    reasons.push("frozen-cluster");
  } else if (cluster.status === "flagged") {
    route = worse(route, "manual");
    reasons.push("flagged-cluster");
  }

  // 5. mock K4 分达冻结建议线 → 人工升级(冻结决策留给 K1/D2,K3 不越权)。
  if (cluster.score >= cfg.riskCluster.clusterFreezeSuggestThreshold) {
    route = worse(route, "manual");
    reasons.push("high-risk-score");
  }

  const trimmed = address.trim();
  if (trimmed) {
    const hash = withdrawAddressHash(network, trimmed);

    // 2. 同地址跨账户复用(强信号)。
    const reusedByOther = listRiskRecords().some(
      (r) => r.accountKey !== key && r.withdrawAddresses.some((a) => a.hash === hash),
    );
    if (reusedByOther) {
      route = worse(route, rules.sameAddressRoute);
      reasons.push("shared-address");
    }

    // 4. 新地址绑定期(R2): 未见过 = 本次首绑,同样落 hold。
    const own = getRiskRecord(key)?.withdrawAddresses.find((a) => a.hash === hash);
    const holdMs = rules.newAddressHoldHours * 3600 * 1000;
    if (!own || Date.now() - own.firstSeenAt < holdMs) {
      route = worse(route, "delay");
      reasons.push("new-address-hold");
    }
  }

  // 3. 首提必审(R2)——无论其它信号如何,新账户首提最低也是 manual。
  const hasWithdrawn = getRiskRecord(key)?.hasWithdrawn ?? false;
  if (rules.firstWithdrawalManual && !hasWithdrawn) {
    route = worse(route, "manual");
    reasons.push("first-withdrawal-review");
  }

  // 6. 换绑地址账龄(PAY04 异常4):verifiedAt 起账龄 < 7 天 + 请求金额 ≥ $1,000
  // → 强制 manual。绑定 store 已按账号重绑,与 accountKey 同源(mock 只评当前账号)。
  if (requestedUsdt !== undefined && binding?.verifiedAt !== undefined) {
    const ageMs = Date.now() - binding.verifiedAt;
    if (ageMs < NEW_ADDRESS_AGE_DAYS * 24 * 3600 * 1000 && requestedUsdt >= NEW_ADDRESS_LARGE_AMOUNT_USDT) {
      route = worse(route, "manual");
      reasons.push("new-address-large-amount");
    }
  }

  return {
    canSubmit: route !== "reject" && !rebindFrozen && withdrawableUsdt >= rules.minWithdrawableUsdt,
    maxWithdrawableUsdt: withdrawableUsdt,
    route,
    riskReasons: reasons,
    configVersion: `wr:${rules.minWithdrawableUsdt}/${rules.sameAddressRoute}/${rules.firstWithdrawalManual ? "first-manual" : "first-open"}/${rules.newAddressHoldHours}h · ${cluster.configVersion}`,
  };
}

/** 提现单创建成功后登记地址使用 + 首提标记(K1 回溯聚簇的强维输入)。 */
export function commitWithdrawal(accountKey: string, network: Withdrawal["network"], address: string): void {
  recordWithdrawAddressUse(accountKey, network, address);
  markWithdrawn(accountKey);
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
