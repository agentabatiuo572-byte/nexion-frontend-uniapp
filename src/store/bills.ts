import { defineStore } from "pinia";
import { ref } from "vue";
import { mockServerId } from "./mock-id";
import { mockServerNow } from "./server-time";
import { normalizeAccountKey } from "./account-cloud";
import { readAccountRow, writeAccountRow } from "./account-scoped-storage";

// Ported from Nexion-prototype/lib/store/bills.ts (zustand → Pinia).
// MOCK-ONLY: 30-day history fabricated client-side; production replaces seed
// with GET /api/bills and lets the server own ids + balanceAfter.
export type BillType =
  | "earn" | "refer" | "bonus" | "topup" | "withdraw"
  | "purchase" | "swap" | "kyc" | "stake" | "unstake" | "achievement";
export type BillStatus = "posted" | "pending" | "failed";

export interface Bill {
  id: string;
  type: BillType;
  amount: number; // signed: +credit, -debit
  symbol: "USDT" | "NEX";
  status: BillStatus;
  ts: number; // epoch ms
  /**
   * 已翻译好的文案。⚠️ 语言在写入那一刻被冻住 —— 切语言后旧账单仍是旧语言。
   * 新代码优先用 memoKey(渲染时才翻译);memo 保留给存量数据与暂未迁移的调用方。
   */
  memo: string;
  /**
   * i18n key(相对 t.bills.memo.*)。有它就以它为准渲染,memo 只作兜底。
   * 真后端返回的也应该是**码**而不是某一种语言的句子 —— 这个字段就是那个码位。
   */
  memoKey?: string;
  memoParams?: Record<string, string | number>;
  ref?: string;
  /** 链上转账条目的网络短码。🔴 必须大写(tx 页 `options.net in NET_LINES` 白名单,小写静默丢弃)。
   *  memo 正迁 memoKey(语言码位),网络不能永远靠 memo 文案正则反解 —— 这个字段就是网络的码位;
   *  非链上条目(奖励/兑换/NEX 等)不填。 */
  network?: "TRC20" | "ERC20" | "BEP20";
  balanceAfter?: number;
}

/**
 * Reward-type credits (activity bonus / referral commission / achievement;
 * CS compensation posts as `bonus`) — the "system rewards" family surfaced in
 * My Rewards (/me/rewards) AND its unread dot on the Me entry. Single source:
 * both consumers must share this predicate so the dot can never disagree with
 * the page content.
 */
export const REWARD_BILL_TYPES: readonly BillType[] = ["bonus", "refer", "achievement"];
export function isRewardBill(b: Bill): boolean {
  return REWARD_BILL_TYPES.includes(b.type) && b.amount > 0;
}

// 旧设备级单键 "nexgrid-bills-v1" 废弃(存量无账号归属,mock 可重建);账单按账号分行。
const ACCOUNTS_KEY = "nexgrid-bills-accounts-v1"; // { [accountKey]: { bills: Bill[] } }

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedBills(): Bill[] {
  const now = Date.now();
  const DAY = 24 * 3600 * 1000;
  const list: Omit<Bill, "id" | "balanceAfter">[] = [];
  const rngEarn = mulberry32(1);
  const rngRefer = mulberry32(2);

  for (let i = 30; i > 0; i--) {
    list.push({
      ts: now - i * DAY + 10 * 3600 * 1000,
      type: "earn",
      symbol: "USDT",
      amount: +(0.04 + rngEarn() * 0.08).toFixed(4),
      status: "posted",
      memo: "Daily AI inference earnings", memoKey: "earnDaily",
    });
  }
  for (let i = 26; i > 0; i -= 6) {
    list.push({
      ts: now - i * DAY + 14 * 3600 * 1000,
      type: "refer",
      symbol: "USDT",
      amount: +(0.18 + rngRefer() * 0.4).toFixed(4),
      status: "posted",
      memo: "Direct referral 5% commission", memoKey: "referDirect",
    });
  }
  list.push({ ts: now - 29 * DAY, type: "bonus", symbol: "USDT", amount: 5.0, status: "posted", memo: "Welcome bonus credited on activation", memoKey: "welcomeBonus" });
  list.push({ ts: now - 29 * DAY + 60 * 1000, type: "bonus", symbol: "NEX", amount: 10, status: "posted", memo: "Achievement · First Contribution", memoKey: "achFirstContribution" });
  list.push({ ts: now - 14 * DAY + 5 * 3600 * 1000, type: "achievement", symbol: "NEX", amount: 20, status: "posted", memo: "Achievement · First Dollar", memoKey: "achFirstDollar" });
  list.push({ ts: now - 7 * DAY, type: "kyc", symbol: "USDT", amount: 1.0, status: "posted", memo: "KYC-Express · wallet ownership verification", memoKey: "kycVerify", ref: "KYC-2026-A78214" });
  list.push({ ts: now - 12 * DAY, type: "topup", symbol: "USDT", amount: 50.0, status: "posted", memo: "Top-up · USDT-TRC20", memoKey: "topupTrc20", ref: "TX-20260503-7621" });
  // 🔴 种子不造 withdraw 行:提现账单行与提现单据(app.withdrawals)必须同源成对 ——
  // 只造账单行的话,追踪页按单号深链必「查无此单」(每个新账号都命中),
  // 还与提现页「这是你第一次提现」自相矛盾(证伪报告 C-2,2026-08-02 起删除)。

  return list.sort((a, b) => b.ts - a.ts).map((b) => ({ ...b, id: mockServerId("BL") }));
}

/**
 * 🔴 只排序,**不再自己算 balanceAfter**(2026-08-01 走查 P0-1)。
 *
 * 原实现从 0 正向累加账单里 status==="posted" 的 USDT 行。两处结构性错误:
 *  ① 账单是**部分**流水 —— 不是每笔余额变动都写账单(收益按 tick 累加就不写),
 *    从 0 累加永远补不齐差额。实测账单写「余额 $60.31」而钱包写「$24,826.56」,
 *    差 400 倍,用户看对账单第一反应是「我的两万四被吞了」。
 *  ② 提现在 submitWithdrawal 里**当场扣款**、账单却落 status:"pending",
 *    只数 posted 等于把已经扣掉的钱又算回来。
 *
 * balanceAfter 的正主是服务端复式账本(见文件头注释:server owns ids + balanceAfter)。
 * mock 期由 wallet-bills 页以**当前真实余额为锚往回倒推**,store 不编造。
 */
function recomputeBalance(bills: Bill[]): Bill[] {
  return [...bills].sort((a, b) => b.ts - a.ts);
}

function hydrate(accountKey: string): Bill[] {
  const row = readAccountRow<{ bills?: Bill[] }>(ACCOUNTS_KEY, accountKey);
  if (row && Array.isArray(row.bills) && row.bills.length) {
    // 🔴 剥掉存量本地数据里的 balanceAfter。旧实现把**自己算错的**余额写进了每条账单并落盘
    // (实测盘上就有 balanceAfter: 60.3065,而真实余额是两万四)。现在这个字段只认服务端下发,
    // 不剥的话页面会把那批旧错值原样渲染出来 —— 等于把已修的 P0 换个方式放回去。
    // 顺带过一次排序:读盘这条路径原本直接 return,倒序只是「上次写盘时碰巧排过」的巧合。
    return recomputeBalance(row.bills.map(({ balanceAfter: _drop, ...rest }) => rest as Bill));
  }
  return recomputeBalance(seedBills());
}

export const useBills = defineStore("bills", () => {
  // 账号维度。boot 期落 "default";账号确定后由 lib/account-scope 的
  // rebindAccountScopedStores 统一重绑(P-031 store 不互 import)。
  let boundKey = "default";
  const bills = ref<Bill[]>(hydrate(boundKey));

  function persist(): boolean {
    return writeAccountRow<{ bills: Bill[] }>(ACCOUNTS_KEY, boundKey, { bills: bills.value });
  }

  /** 账号切换重绑:装载该账号的账单行(变更处处即时 persist,旧账号无需先落盘)。 */
  function bindAccount(rawAccountKey: string) {
    boundKey = normalizeAccountKey(rawAccountKey);
    bills.value = hydrate(boundKey);
  }

  /**
   * 🔴 写到**指定账号**的账单行,不看当前绑定(R3 P1)。
   *
   * 为什么需要它:提现在 `await` 期间被换号时,钱已经扣在**旧账号**上,但 `add()` 只会写进
   * 当前绑定的那本账 —— 写就是别人的流水,不写则旧账号有扣款无凭证。二选一都是错的;正解是
   * 把这一笔写回**真正被扣的那个账号**。
   *
   * 目标账号即当前绑定时走 `add()`(要同步刷新内存态,页面才能立刻看到);不同才走直写。
   * 直写不碰 `bills.value` —— 那是当前账号的视图,把别人的流水塞进去正是本函数要避免的事。
   */
  function addForAccount(rawAccountKey: string, b: Omit<Bill, "id" | "ts" | "balanceAfter">): Bill | null {
    const target = normalizeAccountKey(rawAccountKey);
    if (target === boundKey) return add(b);
    const row = readAccountRow<{ bills?: Bill[] }>(ACCOUNTS_KEY, target);
    const existing = Array.isArray(row?.bills) ? (row!.bills as Bill[]) : [];
    const next: Bill = { ...b, id: mockServerId("BL"), ts: mockServerNow() };
    const merged = recomputeBalance([next, ...existing]);
    if (!writeAccountRow<{ bills: Bill[] }>(ACCOUNTS_KEY, target, { bills: merged })) return null;
    return next;
  }

  function add(b: Omit<Bill, "id" | "ts" | "balanceAfter">): Bill | null {
    // Server-clock domain — the rewards-seen watermark compares against ts,
    // so both must route through the same single time source.
    const next: Bill = { ...b, id: mockServerId("BL"), ts: mockServerNow() };
    const previous = bills.value;
    bills.value = recomputeBalance([next, ...previous]);
    if (!persist()) {
      bills.value = previous;
      return null;
    }
    return next;
  }

  /** Stable ref + type + symbol is the mock server idempotency key. */
  function addOnce(b: Omit<Bill, "id" | "ts" | "balanceAfter">): Bill | null {
    const existing = b.ref
      ? bills.value.find((bill) => bill.ref === b.ref && bill.type === b.type && bill.symbol === b.symbol)
      : null;
    return existing ?? add(b);
  }

  function seed() {
    bills.value = recomputeBalance(seedBills());
    persist();
  }

  /**
   * 按单号把在途账单行结算到终态。
   *
   * 🔴 为什么必须有:提现建单时写的是 `status: "pending"`,而账单页只把 `posted` 的行
   * 计进流水余额。到账推进以前只改提现单据的状态、不碰账单行 —— 结果是钱到账了、
   * 账单永远停在「处理中」,流水余额与真实余额长期差一整笔(审计 P0)。
   * PROD:服务端 confirm 时 post 这条分录,client 只消费。
   */
  function settleByRef(ref: string, status: Bill["status"]): boolean {
    if (!ref) return false;
    const previous = bills.value;
    let changed = false;
    const next = previous.map((b) => {
      // 🔴 只推进**在途(pending)**行。同一单号下可能还挂着已终态的行 —— NEX 燃烧行
      // 落 posted 即事实已发生,失败终态若把它一起翻成 failed,账单说「没烧」而余额里
      // NEX 当时真少了,两个口径必有一个是假(审计 P1,2026-08-02)。
      // 🔴 2026-08-04 修订:这条规则原本用「NEX 费按规则不退」论证,而 R1 已让失败提现
      // 退还烧掉的 NEX —— 那个前提没了,规则本身仍然成立,但理由换成复式账本的通用规矩:
      // **已终态分录是既成事实,冲正靠反向分录,不是改写原分录**。所以退还不改这一行,
      // 而是同单号补一条 +N NEX 的正向行(见 App.vue reconcileBills ②b),
      // 账单页两行相抵 = 钱包里 NEX 的净变化,账本与钱包对得上。
      if (b.ref !== ref || b.status !== "pending" || b.status === status) return b;
      changed = true;
      return { ...b, status };
    });
    if (!changed) return false;
    bills.value = recomputeBalance(next);
    if (!persist()) {
      bills.value = previous;
      return false;
    }
    return true;
  }

  return { bills, add, addForAccount, addOnce, seed, settleByRef, bindAccount };
});
