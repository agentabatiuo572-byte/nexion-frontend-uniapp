/**
 * 资金 ⊗ 收据 —— 一条不变量,一个收口点(2026-08-04 R4「钱动了、账没记上」同族根治)。
 *
 * 🔴 不变量:**任何资金变更都必须与它的收据同生共死**。要么两边都落盘,要么资金被精确
 * 还原(含 withdrawableUsdt)、账上不留半条记录;无论哪种,调用方一定拿到结果、用户一定
 * 看到提示。绝不允许「扣了钱 → 弹成功 → 账单页查无此单」。
 *
 * 为什么必须收口成一个函数而不是每处各写各的:资金变更与账单是**两份独立存储**
 * (account-cloud 快照 vs bills 账号行),mock 期没有事务。失败是静默的
 * (`bills.add` 写不进去返回 null 而不抛异常),于是每个调用点都要自己记得「接返回值、
 * 精确退款、报错」—— 实测四处里有四处忘了(创世购买 / 结算 / 复投 / 资金原语本身)。
 * 把顺序与失败处置写在一处,新调用点从此**继承**正确行为,而不是重新发明它。
 *
 * 单据即指令:资金动作由 draft 的 `amount` 符号 + `symbol` 派生,所以经这条路
 * **不写收据就动不了钱**——这才是「一条不变量收全族」的机制,不是四个补丁。
 *
 * PRODUCTION:整条替换为服务端单事务(POST /api/... 同笔提交扣款 + 分录),
 * client 只消费返回值;本文件的三分支结果与那份 API 的语义一一对应。
 */
import { useApp, type MoneySnapshot } from "@/store/app";
import { useBills, type Bill } from "@/store/bills";
import { getT } from "@/i18n/use-t";
import { fmt } from "@/i18n/format";
import { mockServerId } from "@/store/mock-id";
import { toast } from "@/store/ui";

/** 账单入参(id / ts / balanceAfter 由 store 与服务端时钟负责)。 */
export type ReceiptDraft = Omit<Bill, "id" | "ts" | "balanceAfter">;

/**
 * - `ok`           两边都落盘。
 * - `insufficient` 余额不足 / 金额非法 —— **零副作用**,调用点用自己的既有文案报错。
 * - `failed`       落盘失败(资金或收据)—— 资金已还原、账上无记录、已弹通用失败提示。
 * - `stuck`        回滚**自己也失败了** —— 钱真的被扣着,已弹响亮终态 + 交易号并入待对账队列。
 */
export type MoneyReceiptOutcome = "ok" | "insufficient" | "failed" | "stuck";

/** 待对账条目:后端对账时按 `restoreTo` 把该账号的资金三元组还原回去。 */
export interface StuckFundsCase {
  /** 交易号 —— 用户报给客服的唯一凭据(也印在提示里)。 */
  id: string;
  at: number;
  /** 业务单号(账单 ref);没有就是空串。 */
  ref: string;
  restoreTo: MoneySnapshot;
}

/** 尽力持久化(storage 正是刚刚出故障的那一层,写不进去也只能认)。 */
const STUCK_KEY = "nexgrid-funds-stuck-v1";
const STUCK_CAP = 50;
const stuckQueue: StuckFundsCase[] = [];

/** 读队列 —— 仅供自检 / 将来的对账页,产品内不消费。 */
export function stuckFundsCases(): StuckFundsCase[] {
  return [...stuckQueue];
}

/**
 * 🔴 回滚失败的既定终态(2026-08-04 R5)。
 *
 * 资金与收据是两份独立存储、mock 期没有事务,所以补偿回滚**自己也会失败**;而回滚失败时
 * 钱是真的被扣走了,再弹通用的「交易未保存 · 余额没有变化」就是对用户撒谎(R4 修的是
 * 「弹成功、账本查无」,这里是它的镜像面:「弹失败、钱已扣」)。
 *
 * 🔴 这里**不做「回滚的回滚」** —— 那一层自己同样会失败,是无穷回归(见
 * docs/changes/2026-08-04-structural-reflection-r5.md 第二节)。客户端的能力上界就到这:
 * 让用户明确看见 + 留下可对账的凭据,残余风险显式交给后端对账。
 * PRODUCTION:整段消失 —— 服务端单事务里根本没有「回滚失败」这个状态。
 */
export function reportStuckFunds(restoreTo: MoneySnapshot, ref = ""): "stuck" {
  const record: StuckFundsCase = { id: mockServerId("FIX"), at: Date.now(), ref, restoreTo };
  stuckQueue.push(record);
  if (stuckQueue.length > STUCK_CAP) stuckQueue.splice(0, stuckQueue.length - STUCK_CAP);
  try {
    const prev = uni.getStorageSync(STUCK_KEY);
    uni.setStorageSync(STUCK_KEY, [...(Array.isArray(prev) ? prev : []), record].slice(-STUCK_CAP));
  } catch {
    // storage 不可用正是走到这里的原因之一 —— 内存队列 + 用户手上的交易号已是兜底。
  }
  toast.error(getT().errors.fundsStuckTitle, fmt(getT().errors.fundsStuckMsg, { id: record.id }));
  return "stuck";
}

export interface PostMoneyOptions {
  /**
   * 冲正模式:把资金**还原**到这份扣款前快照,而不是盲加一笔 credit。
   * 退款必须走它 —— 扣款会 clamp 掉 withdrawableUsdt,盲加的 credit 不还原可提额度,
   * 一次「扣款→失败→退款」就把用户的可提额度永久压低(审计场景:$8000 → $1)。
   */
  restoreTo?: MoneySnapshot;
}

/**
 * 资金变更 + 收据,原子提交(单条 = 一腿的交易)。
 *
 * @param draft 收据即指令:`amount < 0` = 扣款,`> 0` = 入账;`symbol` 决定 USDT / NEX。
 * @param opts  冲正时传 `restoreTo`(见 PostMoneyOptions)。
 */
export function postMoneyBill(draft: ReceiptDraft, opts: PostMoneyOptions = {}): MoneyReceiptOutcome {
  return postMoneyBills([draft], opts);
}

/**
 * 多腿交易的原子提交 —— 一进一出的兑换就是它(2026-08-04 R4 追加)。
 *
 * 🔴 为什么不是「循环调 postMoneyBill」:那样每条分录各落一次盘,于是存在
 * 「出账分录落了、入账分录没落,而两边的钱都已经动了」这个中间态 —— 用户看到「兑换完成」,
 * 账单里却只有扣、没有进。收口的选择是 **N 条分录一次落盘**(bills.addMany),
 * 那个中间态**根本不存在**:
 *   · 不需要「删掉第一条」—— 复式账本里已落盘的分录不改写,而且它压根没落盘;
 *   · 也不需要「补一条反向冲正分录」—— 冲正的前提是「已成事实」,这里没有事实可冲,
 *     补出来的两条只是账本噪声。
 * 资金侧的对称还原由 restoreMoney 兜住(它还原 usdt / nex / withdrawable 三元组,
 * 一进一出两腿动的正是其中两项)。与真后端「同一事务写这 N 条分录」逐字对应。
 *
 * 腿的顺序由调用方决定(出账在前、入账在后 = 与账本阅读顺序一致)。
 */
export function postMoneyBills(drafts: ReceiptDraft[], opts: PostMoneyOptions = {}): MoneyReceiptOutcome {
  const app = useApp();
  const bills = useBills();
  if (!drafts.length) return "insufficient";
  if (drafts.some((d) => !Number.isFinite(d.amount) || d.amount === 0)) return "insufficient";

  // 回滚基准必须在动钱**之前**取(取晚了就是拿动过的状态当"原状")。
  const undo: MoneySnapshot = app.captureMoney();

  let moved = true;
  if (opts.restoreTo) {
    moved = app.restoreMoney(opts.restoreTo);
  } else {
    // 余额不足与落盘失败必须分开报:前者用户可自解(充值 / 改金额),后者是系统故障。
    // 预检**按币种汇总全部扣款腿**再比 —— 逐腿比会放过「单腿够、合计不够」,变成
    // 扣了第一腿才发现第二腿不行。只读,与紧随其后的扣款之间同步,中间插不进写。
    const needUsdt = drafts.filter((d) => d.amount < 0 && d.symbol !== "NEX").reduce((s, d) => s - d.amount, 0);
    const needNex = drafts.filter((d) => d.amount < 0 && d.symbol === "NEX").reduce((s, d) => s - d.amount, 0);
    if (needUsdt > app.user.usdtBalance || needNex > app.user.nexBalance) return "insufficient";
    for (const d of drafts) {
      moved =
        d.amount < 0
          ? d.symbol === "NEX" ? app.debitNex(-d.amount) : app.debitBalance(-d.amount)
          : d.symbol === "NEX" ? app.creditNex(d.amount) : app.creditBalance(d.amount);
      if (!moved) break;
    }
  }
  if (!moved) {
    // 某一腿没落盘 → 把已经动过的腿一起还原(资金原语只保证自己那一次的对称)。
    // 🔴 回滚的返回值必须被消费(R5):回滚失败 = 钱真的扣着,那时的既定终态是响亮告知 +
    // 交易号 + 入待对账队列,而不是照旧弹「余额没有变化」。
    if (!app.restoreMoney(undo)) return reportStuckFunds(undo, drafts[0].ref ?? "");
    toast.error(getT().errors.txNotSavedTitle, getT().errors.txNotSavedMsg);
    return "failed";
  }

  if (!bills.addMany(drafts)) {
    // 钱已经落盘、收据没落盘 —— 正是本族要根治的那一格。资金精确还原到动钱之前
    // (含 withdrawableUsdt),账上一条记录都不留,用户拿到明确失败。
    if (!app.restoreMoney(undo)) return reportStuckFunds(undo, drafts[0].ref ?? "");
    toast.error(getT().errors.txNotSavedTitle, getT().errors.txNotSavedMsg);
    return "failed";
  }
  return "ok";
}

/**
 * 收据补记 —— 资金已在别处落定且**不可回滚**时用它(订单已建并进入履约、提现已提交)。
 *
 * 为什么保留这条路而不是一律回滚:回滚只还钱、还不回已经发出去的货(orders / genesis 的
 * 铸造没有 undo),一律回滚等于把「少一张收据」换成「白送一台设备」。这里的既定处置是
 * **让用户明确看见收据没记上**(与提现页同口径),而不是静默吞掉。
 *
 * @returns 收据是否落盘;false 时已弹提示。
 */
export function postReceiptOnly(draft: ReceiptDraft): boolean {
  if (useBills().add(draft)) return true;
  toast.error(getT().errors.billMissingTitle, getT().errors.billMissingMsg);
  return false;
}

/**
 * 幂等版收据补记 —— 语义同 postReceiptOnly(资金已落定、不可回滚),但按 `ref` 判重:
 * 同一笔入金被重放(mock 到账引擎重试 / 用户刷新 / 回调重投)时不会写出第二条分录。
 *
 * 三条入金轨(链上 / 银行 / 卡)的钱由 app.recordDeposit 落定 —— 它除了加余额还累计
 * cumulativeDepositUsdt,不是 postMoneyBill 的 creditBalance 能替代的;而入金是**外部
 * 已经到账**的事实,回滚等于把用户真的转进来的钱抹掉。所以这一族只补收据,不动钱。
 *
 * 为什么幂等键放在收口点而不是各调用点自己 addOnce:判重与失败处置是同一件事的两面,
 * 拆开的话下一个调用点又要重新发明一遍「接返回值 + 报错」——那正是本族缺陷的成因。
 *
 * @returns 收据是否已在账上(命中既有幂等键、没写出新行也算 true);false 时已弹提示。
 */
export function postReceiptOnce(draft: ReceiptDraft): boolean {
  if (useBills().addOnce(draft)) return true;
  toast.error(getT().errors.billMissingTitle, getT().errors.billMissingMsg);
  return false;
}

/**
 * 幂等版「动钱 ⊗ 记账」—— 按 `ref` 判重:同一个 ref 已经在账上就直接返回 ok,**不再发第二次**。
 *
 * 为什么需要它(2026-08-04 对抗审计 B-P1-3 / P1-4 同族):
 * 「领奖」这一族要同时满足两件互斥的事 —— 资格只能消费一次(防重复领),奖必须发到
 * (不能领了却没发)。两种顺序各有一个失效面:
 *   · 先消费资格 → 发钱失败,资格没了、奖归零(5 处现状,用户白白损失);
 *   · 先发钱 → 消费资格失败,下一拍**再发一次**(里程碑那处的实况,平台重复出钱)。
 * 只要发钱这一步**可以安全重放**,第二种顺序就没有失效面了:重放命中既有 ref,
 * 不动钱、不写第二条分录,直接当成功,调用方接着去消费资格。
 *
 * 🔴 因此 `ref` 必须是**稳定标识**(如「第几周 + 任务 id」),不能带时间戳 ——
 * 带时间戳的 ref 每次重放都是新值,判重永远不命中,这个函数就退化成 postMoneyBills。
 * 传空 ref 直接抛错,不静默降级(静默降级 = 一个看起来幂等其实不幂等的调用点)。
 *
 * @returns "ok"(含命中幂等键、没动钱那一路)/ "insufficient" / "failed" / "stuck"
 */
export function postMoneyBillsOnce(drafts: ReceiptDraft[], opts: PostMoneyOptions = {}): MoneyReceiptOutcome {
  const ref = drafts[0]?.ref;
  if (!ref) {
    throw new Error("postMoneyBillsOnce: 必须传稳定的 ref,否则判重永不命中 = 假幂等");
  }
  // 🔴 判重域的**诚实边界**:读的是 `bills.bills`,也就是**本标签页内存里**那份账单
  // (bills 只在 bindAccount 时 hydrate,之后不再回读磁盘)。于是:
  //   · 单标签页内的重放(重试 / 自愈补发 / 消费资格失败后再点)——完全可靠,这是本函数的主用途;
  //   · **跨标签页**并发领同一笔 —— 另一页刚写的分录这边看不见,判重会漏,可能发两次。
  // 后者不是本函数引入的:账单表本身走裸 writeAccountRow(无 CAS、无合并),跨标签页
  // 本来就会丢分录(实测靶 scripts/measure-bills-crosstab-loss.mjs)。两者同一个根因,
  // 归「完全版 A」存储重构一并解决(账单归属 + 事务边界),不在这里单独打补丁 ——
  // 单独把这里改成读磁盘,只会得到一个「判重准了但分录仍会被覆盖」的半吊子。
  if (useBills().bills.some((b) => b.ref === ref)) return "ok";
  return postMoneyBills(drafts, opts);
}
