/**
 * 提现 → 账单分录 —— **唯一**的构造处(z4 R2)。
 *
 * 🔴 为什么必须收成一个纯函数:这组分录有**两个**生产点 ——
 *   ① 提现页建单成功后当场写(`wallet-withdraw.vue`);
 *   ② App.vue 的对账在「单据在、账单缺」时补写(自愈)。
 * 两处各拼一份的话必然漂移:金额口径、memoKey、状态映射、NEX 腿要不要写,
 * 任何一项在一处改了另一处没跟,账本上就会出现两种形状的同类分录。
 * 本仓刚因为「同一个概念两处各自推导」栽过(费用减免额),不再重演。
 *
 * 🔴 为什么要有自愈那一路(R2 completeness critic 的 P0):
 * 账单表是**裸写整行、无 CAS**(2026-08-05 主人拍板不在前端修),跨标签页并发写会把
 * 刚落盘的分录整行覆盖掉。资金分录里只有这一族没有自愈路径 —— 冲正行(App.vue ②b)
 * 的存在性判据取自账本自身,丢了下一拍就补回来;而提现主行一旦被抹掉就**永久消失**,
 * 用户回到的正是本包要修的那个原状态,而所有门仍然全绿(门守的是「有没有生产者」,
 * 不是「那一行此刻在不在」)。把判据同样改成「从数据推出该有什么」,这一族才补齐。
 *
 * 纯函数、不碰 store、不依赖 i18n 运行时:memo 是英文兜底,渲染时以 memoKey 为准。
 * PRODUCTION:整个文件消失 —— 分录由服务端在建单同一事务里写,client 只消费 GET /api/bills。
 */
import type { ReceiptDraft } from "@/lib/money-receipt";
import type { Withdrawal } from "@/store/types";

/** NEX 数量展示:整数不带小数点,非整数保留一位(与提现页报价同口径)。 */
function fmtNex(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** 风控路由 → 账单摘要码位。显式穷举,不做动态拼串:漏一种会静默拿到 undefined,
 *  而 memoKey 落空只会**静默回落**成写入时那句英文(tsc 与 i18n 镜像门都抓不到)。 */
const WITHDRAW_MEMO_BY_ROUTE: Record<NonNullable<Withdrawal["riskRoute"]>, string> = {
  pass: "withdrawPass",
  delay: "withdrawReview",
  manual: "withdrawReview",
  freeze: "withdrawFrozen",
  // `reject` **构造上到不了这里**:它是客户端准入引擎的裁决,被拒的请求根本不会发出去;
  // 而服务端回执经 `canonicalRiskRoute` 只会产出 pass/delay/manual/freeze 四种(见 withdrawal-api.ts)。
  // 仍然显式列出而不是用 `Partial` + 兜底 —— tsc 的穷举检查正是靠它;
  // 万一哪天服务端真回了这一路,渲染成「审核中」也比静默回落成英文原文强。
  reject: "withdrawReview",
};

/** 单据终态 → 账单行状态。非终态一律在途,由 App.vue 的对账推进。 */
const FAILED_STATUSES: readonly Withdrawal["status"][] = [
  "review-rejected", "address-invalid", "tx-failed", "refunded",
];
export function billStatusForWithdrawal(status: Withdrawal["status"]): "posted" | "pending" | "failed" {
  if (status === "confirmed") return "posted";
  if (FAILED_STATUSES.includes(status)) return "failed";
  return "pending";
}

/**
 * 一笔提现应有的全部账单分录。
 *
 * - USDT 主行:负额 = 用户「提了多少钱」的唯一凭据;状态跟单据当前态(自愈补写时可能
 *   已经是终态了,写 pending 再等下一拍结算是多余的一步,也会让账单短暂说谎)。
 * - NEX 抵扣费行:只在服务端真烧了 NEX 时才有;恒 `posted` —— 烧是既成事实,
 *   提现失败时由 App.vue ②b 补一条 +N 的反向分录冲正,不改写这一条。
 *
 * 🔴 每个数字都取自单据(服务端回执),不接受调用方另传 —— 本仓禁令:显示的钱必须指到单源。
 */
export function withdrawalBillDrafts(wd: Withdrawal): ReceiptDraft[] {
  // 🔴 存量单的 `fee` 可能整个缺失(旧 schema / 半写)。同批的 App.vue 与 app.ts 对这个字段
  // 一律用可选链,这里直读会抛 —— 而调用点之一是 5s 轮询里的对账,一抛就把整轮打停
  // (z4 R3 独立审计 P1)。给个零值兜底:数字不编造(全 0 = 没有费用信息),行照样记得下。
  const fee = wd.fee ?? { networkConfirmUsd: 0, nexBurned: 0, actualFeeUsd: 0 };
  const drafts: ReceiptDraft[] = [{
    type: "withdraw",
    symbol: "USDT",
    amount: -wd.amount,
    status: billStatusForWithdrawal(wd.status),
    memo: `Withdraw to ${wd.network} · fee $${fee.actualFeeUsd.toFixed(2)}`,
    // 风控路由取**服务端裁决**(wd.riskRoute),不取客户端预检结果:两者可以不同,
    // 而账本该记的是服务端实际怎么判的。缺省(历史单无该字段)按 pass 渲染。
    // 🔴 三种结局三句话,不合成一句(R2 completeness critic):`freeze` 是**冻结**、
    // `delay` 是延迟放行、`manual` 才是人工审核 —— 上一版把三种都写成「追加审核」,
    // 账本用一句话盖住三种不同结局,而被冻结的用户最需要知道自己是被冻结了。
    // 每句都带网络与手续费:被审核的那笔恰恰是用户最想核对手续费的那笔。
    memoKey: WITHDRAW_MEMO_BY_ROUTE[wd.riskRoute ?? "pass"],
    memoParams: { network: wd.network, fee: fee.actualFeeUsd.toFixed(2) },
    ref: wd.id,
  }];
  if (fee.nexBurned > 0) {
    drafts.push({
      type: "withdraw",
      symbol: "NEX",
      amount: -fee.nexBurned,
      status: "posted",
      memo: `Fee offset · ${fmtNex(fee.nexBurned)} NEX used`,
      memoKey: "withdrawNexFee",
      memoParams: {
        nex: fmtNex(fee.nexBurned),
        // 🔴 减免额优先取服务端直接下发的 `feeWaivedUsd`,不用「毛费 − 实付」重建
        // (R2 P1-3:重建出来的数指的是三个源,不是一个源;而服务端契约里
        //  `grossFee − feeWaived == actualFee` 是已被 parseSubmission 校验过的等式)。
        //
        // 🔴 但**存量单据没有这个字段**,直接 `?? 0` 会把老单真实的减免显示成 $0.00 ——
        // 那比重建**更差**(重建对老单是对的)。所以取不到才回落到等价推导:
        // `feeWaived = grossFee − actualFee`,而 `grossFee = networkConfirmUsd + penaltyUsd`。
        // 这不是「两个源并列」,是「权威源 + 存量兼容路径」,回落这一支随存量单消失而消失。
        fee: (fee.feeWaivedUsd
          ?? Math.max(0, fee.networkConfirmUsd + (fee.penaltyUsd ?? 0) - fee.actualFeeUsd)
        ).toFixed(2),
      },
      ref: wd.id,
    });
  }
  return drafts;
}
