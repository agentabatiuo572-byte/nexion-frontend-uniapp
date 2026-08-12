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
  | "purchase" | "swap" | "verification" | "stake" | "unstake" | "achievement";
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
 *  ② 提现在**提交那一刻**就把钱扣掉(2026-08-10 起扣款发生在服务端 `POST /api/withdrawals`,
 *    不在本地),账单却落 status:"pending" —— 只数 posted 等于把已经扣掉的钱又算回来。
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
   * 🔴 按 `ref` 判重地把 N 条分录写到**指定账号**,不看当前绑定(R3 P1 + z4 R1)。
   *
   * 为什么要「指定账号」:提现在 `await` 期间被换号时,钱已经扣在**旧账号**上,而 `add()`
   * 只会写进当前绑定的那本账 —— 写就是别人的流水,不写则旧账号有扣款无凭证。二选一都是错的;
   * 正解是把这一笔写回**真正被扣的那个账号**。
   *
   * 🔴 为什么判重 —— **纵深防御,不是修一个够得着的缺陷**(z4 R1/R2 的诚实结论)。
   * 三路独立审计都报「歧义重试会写出两条同单号的 −$X」,我一度也确认了;再往下追不成立:
   * 提交**成功**那一刻页面会 `clearSubmitIntent()` 换掉幂等键,服务端下次必开新单;
   * 而歧义失败那次根本没走到写账单。runtime 门在真页面上构造不出「两次都成功且返回同一张单」。
   * 判重仍然留着,理由是这条链上**别处全是幂等的**(`app.withdrawals` 按 id 去重、
   * 领奖按 ref 判重、入金按 txHash 判重),独缺账单这一环 = 一半幂等一半不幂等;
   * 而且 App.vue 的自愈补写要反复调它。**别把它当成「已修的 P0」记账。**
   *
   * 判重键 = `ref + type + symbol`(与 `addOnce` 同一把键),**逐腿判**不是整组判:
   * 全在 → 一条不写,返回既有行;全不在 → N 条一次落盘(原子,不存在半边账);
   * 🔴 部分在 → 只补缺的那几条。上一版整组判,于是「主行被跨标签页覆盖掉、NEX 腿还在」时
   * 同 ref 命中即整组跳过,自愈路径(App.vue ⓪)一辈子补不回那条主行 —— 而那一格正是它要救的
   * (z4 R2 独立审计点名)。「分录同生共死」说的是**新写**那一刻的原子性,不是「缺了也不许补」。
   *
   * 目标账号即当前绑定时走 `addMany()`(要同步刷新内存态,页面才能立刻看到);不同才走直写。
   * 直写不碰 `bills.value` —— 那是当前账号的视图,把别人的流水塞进去正是本函数要避免的事。
   */
  function addManyForAccountOnce(
    rawAccountKey: string,
    drafts: Omit<Bill, "id" | "ts" | "balanceAfter">[],
    /**
     * 🔴 **补记**这一笔时的事件时刻(不传 = 现在)。
     * 只给「把过去发生的事补进账本」用:自愈补写一笔三天前的提现时,若还盖当前时钟,
     * 那一行会落在账单页**今天**这一组的最上面 —— 账本给自己的历史标错日期。
     * 正常提交路径**不要**传:那一刻的「现在」就是事件时刻,由 mockServerNow 单时源给。
     */
    atMs?: number,
  ): Bill[] | null {
    if (!drafts.length) return [];
    const target = normalizeAccountKey(rawAccountKey);
    // 🔴 同一组分录必须共用一个 ref —— 判重键含 ref,混 ref 的一组会各判各的,
    // 「同生共死」当场失效。不静默降级,直接抛(与 postMoneyBillsOnce 空 ref 抛错同款)。
    const refs = new Set(drafts.map((d) => d.ref ?? ""));
    if (refs.size !== 1 || refs.has("")) throw new Error("BILLS_GROUP_REF_MUST_BE_SINGLE");
    // 🔴 键必须含**方向**(z4 R3 独立审计 P0):同一单号下 NEX 有两条腿 ——
    // 抵扣费的 `−N`(烧)与失败退还的 `+N`(冲正),两者 ref/type/symbol 全同。
    // 不含方向时它们撞成一条:主行被跨标签页覆盖后走自愈,`+N` 会把 `−N` 的位置占住,
    // 于是账上永远只剩「退还 +3 NEX」这条孤行 —— 正好是本包要修的那个形态换了个方向复发。
    const key = (b: { ref?: string; type: BillType; symbol: Bill["symbol"]; amount: number }) =>
      `${b.ref}|${b.type}|${b.symbol}|${b.amount < 0 ? "-" : "+"}`;
    const missing = (existing: Bill[]) => {
      const have = new Set(existing.map(key));
      return drafts.filter((d) => !have.has(key(d)));
    };
    if (target === boundKey) {
      const todo = missing(bills.value);
      if (!todo.length) return bills.value.filter((b) => drafts.some((d) => key(d) === key(b)));
      return addMany(todo, atMs);
    }
    // 🔴 基线走 `hydrate(target)`,不是「读盘,读不到就当空」(z4 R1 独立审计 + 本门 ⑧(e) 实测)。
    //
    // 目标账号如果还没**落过盘**(它的 30 天流水此刻只活在别的标签页内存里,或者压根还没被
    // 打开过),按空数组合并就会把整本账替换成这两条 —— 而 `hydrate` 之后只认「行存在且非空」,
    // 于是再也不会补种子:那个账号的账单页从此只剩这两条提现,历史凭空消失。
    // 实测 39 条 → 2 条。`hydrate` 同时剥掉存量 balanceAfter,与读盘那条路同口径。
    const existing = hydrate(target);
    const todo = missing(existing);
    if (!todo.length) return existing.filter((b) => drafts.some((d) => key(d) === key(b)));
    // 同一笔交易的分录共用一个 ts 并**一次落盘** —— 与 addMany 同一条纪律(半边账不存在)。
    const ts = atMs ?? mockServerNow();
    const next: Bill[] = todo.map((b) => ({ ...b, id: mockServerId("BL"), ts }));
    const merged = recomputeBalance([...next, ...existing]);
    if (!writeAccountRow<{ bills: Bill[] }>(ACCOUNTS_KEY, target, { bills: merged })) return null;
    return next;
  }

  /**
   * 🔴 一次落盘写 N 条分录 —— 复式账本里「一笔交易」的分录必须同生共死(2026-08-04 R4)。
   *
   * 为什么不是循环调 `add()`:add 每条各 persist 一次,于是存在「第一条落了、第二条没落」
   * 的中间态。兑换这种**一进一出**的交易一旦卡在那儿,账本上只剩半边,而钱两边都已经动了 ——
   * 用户看到「兑换完成」,账单里却只有扣、没有进。把 N 条一次性拼进数组再写一次盘,
   * 那个中间态**根本不存在**:要么 N 条全在,要么一条不留。调用方因此不需要
   * 「删掉第一条」或「补一条冲正分录」这类补丁 —— 没有既成事实要冲正。
   *
   * 同一笔交易的分录共用一个 ts(它们本来就发生在同一时刻)。
   * PROD:服务端在同一事务里写这 N 条分录,client 只消费。
   */
  function addMany(drafts: Omit<Bill, "id" | "ts" | "balanceAfter">[], atMs?: number): Bill[] | null {
    if (!drafts.length) return [];
    // Server-clock domain — the rewards-seen watermark compares against ts,
    // so both must route through the same single time source.
    // `atMs` 只给**补记历史事件**用(见 addManyForAccountOnce 的同名参数);不传即「现在」。
    const ts = atMs ?? mockServerNow();
    const next: Bill[] = drafts.map((b) => ({ ...b, id: mockServerId("BL"), ts }));
    const previous = bills.value;
    bills.value = recomputeBalance([...next, ...previous]);
    if (!persist()) {
      bills.value = previous;
      return null;
    }
    return next;
  }

  /** 单条 = N=1 的退化情形。走同一条实现,两者的落盘/回滚语义不可能各自漂移。 */
  function add(b: Omit<Bill, "id" | "ts" | "balanceAfter">): Bill | null {
    return addMany([b])?.[0] ?? null;
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

  return { bills, add, addMany, addManyForAccountOnce, addOnce, seed, settleByRef, bindAccount };
});
