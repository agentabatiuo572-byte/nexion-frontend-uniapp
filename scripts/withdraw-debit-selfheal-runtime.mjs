#!/usr/bin/env node
// 提现**扣款腿**自愈 runtime 门 —— 真 store、真 5s 对账循环,只注入失败:
//   BASE_URL=http://localhost:5173 node scripts/withdraw-debit-selfheal-runtime.mjs
//
// 🔴 守的缺陷(2026-08-13 运行时复现,非推理):
//   提现页在建单成功后调一次 `app.applyWithdrawalDebit(wd)`,报假只弹一条 toast 就再不重试;
//   而扣款报假时幂等键 `wd-debit:` 根本没置位 —— 服务端已经扣了钱、本地余额一分没动,
//   且**永远不会再补**。用户看到的可提余额永久虚高,还能照这个虚高值再提一笔,
//   一路放行到服务端才被拒。App.vue 的对账循环当时给账单主行(⓪)和退款腿(②)都做了自愈,
//   唯独资金腿漏了 —— 同一个函数里,账上那一行补得回来,余额里那个数补不回来。
//
// 🔴 为什么静态门不够:接线门(selfcheck-fastlane)守的是「App.vue 里有没有这行调用」,
//   守不住「它到底补没补上」—— 扣款函数自己回了 false 却没人管、粗筛拿错判据、
//   补扣落在一条走不到的分支上,静态判据全绿。
//   本门是行为级:注入失败 → 等真实的 5s 对账跑 ≥2 拍 → 看余额那个数**真的**变了没有。
//
// 🔴 但本门也有守不到的一半,别把它当万能(2026-08-13 三个变异实跑对照):
//     · 整格删除 / 粗筛判据写反 → 本门与静态门**都红**;
//     · 把补扣格挪到 ② 退款腿之后 → 静态门红,而**本门 13/13 全绿**。
//       因为本门等的 13s 里跑了 ≥2 拍:失败单第一拍被多扣、第二拍就退回来了,
//       最终态照样收敛,那一拍的错误余额本门根本看不见。
//   顺序那条不变量由 selfcheck-fastlane 的接线门② 守。两道门互补,不是冗余。
//
// 🔴 先证起点再证结果(本仓家法):如果对账循环压根没在跑,「余额补上了」和「没补上」
//   都毫无意义。所以每轮都带一个**活性探针** —— 同在 reconcileBills 里的 ⓪ 格
//   (单据在、账单缺 → 补写)。⓪ 把被删掉的分录补回来了,才证明对账确实执行到了本函数;
//   此时再看资金腿,结论才成立。活性探针不过 = 整轮判红,不许拿「余额没变」当好消息。
//
// 🔴 三个入口都要守,别只守主人报的那一个:
//   A. 落盘失败(`persistAccountSnapshot()` 报假 → 回滚内存 → return false)。
//      ⚠️ 这条**只在 mock 档可达**:persistAccountSnapshot 第一行 `if (remoteApiEnabled) return true`,
//      远端档恒真、那条回滚分支进不去。
//   B. 余额闸判假(`authoritativeBalance < amount` → return false)。**这条在生产档 remote 下可达**,
//      也正是 app.ts 余额闸注释里那句「而扣款**没有自愈** = 余额永久虚高」说的那一格 ——
//      当时只绕开了一个具体触发(别写 min()),没有补自愈本身。
//   C. 失败终态的净额守恒。修法**刻意不排除**失败终态,靠顺序闭合:补扣格在 ② 退款腿之前,
//      失败单补扣 −N 之后退款腿当拍就退回 +N。这一格守那个闭环 —— 退款腿一旦被改坏
//      (例如加回 `if (remoteApiEnabled) return false`),补扣就从「净 0」变成「白扣用户的钱」,
//      那比原缺陷更坏。🔴 判据不能只看「余额没变」:什么都没发生时它同样成立(空集全过)。
//      必须同时断言两把幂等键都置位 —— 证明确实走了「扣了又退」,而不是「一步没走」。
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5173";
const WAIT_MS = 13_000; // ≥2 拍 5s 对账(ARRIVAL_TICK_MS = 5000)

const START = 5000;
const CTRL_AMOUNT = 50;   // 对照组:正常扣款,证明这条链在本环境下真的会动钱
const A_AMOUNT = 100;     // 场景 A:落盘失败
const B_AMOUNT = 200;     // 场景 B:余额闸判假(生产档可达)
const C_AMOUNT = 300;     // 场景 C:失败终态,补扣 + 退款净 0
const IDS = { CTRL: "WD-SELFHEAL-CTRL", A: "WD-SELFHEAL-STORAGE", B: "WD-SELFHEAL-BALANCE", C: "WD-SELFHEAL-FAILED" };

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

try {
  await page.goto(`${baseUrl}/?nx_device=off#/pages/me/wallet`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => typeof window.uni !== "undefined" && document.querySelector("#app")?.children.length,
    null, { timeout: 20_000 },
  );
  await page.waitForTimeout(2500); // 让 onShow / 业务循环起来

  // 🔴 常量整包传进去,别手抄一个子集(2026-08-13 本门自己踩过):
  // 漏传 A_AMOUNT/B_AMOUNT/C_AMOUNT 时三张单的 amount 全是 undefined,扣款函数按脏数据
  // 正确地 return false —— 于是「注入生效:扣款报假」那三格**照样 PASS**,后面五格全红,
  // 看上去像实现坏了,其实是靶子根本没进被测分支。下面 setup 里那格 amount 断言就是为此加的。
  const CONST = { START, CTRL_AMOUNT, A_AMOUNT, B_AMOUNT, C_AMOUNT, IDS };

  const setup = await page.evaluate(async (c) => {
    const [appMod, billsMod] = await Promise.all([
      import("/src/store/app.ts"), import("/src/store/bills.ts"),
    ]);
    const app = appMod.useApp();
    const bills = billsMod.useBills();
    const now = Date.now();
    const mkWd = (id, amount, status) => ({
      id, amount, network: "USDT-TRC20", address: "TSelfHealGateAddr00000000000000",
      // nexBurned: 0 —— 让 NEX 退还腿不参与,本门只测 USDT 资金腿
      fee: { networkConfirmUsd: 1, nexBurned: 0, actualFeeUsd: 1, feeWaivedUsd: 0 },
      status, submittedAt: now, estimatedCompletion: now + 864e5, source: "server",
    });

    // 🔴 起点余额走 store 自己的 action,不裸改 user.value:裸改绕过 clamp 与落盘合并,
    // 造出一个真实世界到不了的状态,后面所有判据就都是在测一个幻觉。
    const seed = c.START - app.user.usdtBalance;
    if (seed > 0) app.creditBalance(seed);
    else if (seed < 0) app.debitBalance(-seed);
    const balanceStart = app.user.usdtBalance;

    const CTRL = mkWd(c.IDS.CTRL, c.CTRL_AMOUNT, "submitted");
    const A = mkWd(c.IDS.A, c.A_AMOUNT, "submitted");
    const B = mkWd(c.IDS.B, c.B_AMOUNT, "submitted");
    const C = mkWd(c.IDS.C, c.C_AMOUNT, "tx-failed");
    app.withdrawals = [CTRL, A, B, C, ...app.withdrawals];

    // ── 对照组:不注入任何失败,扣款该成功 ────────────────────────────────
    const ctrlReturned = app.applyWithdrawalDebit(CTRL);
    const balanceAfterCtrl = app.user.usdtBalance;

    // ── A:只在扣款这一瞬间让写盘失败 ──────────────────────────────────
    const realSet = uni.setStorageSync;
    uni.setStorageSync = () => { throw new Error("GATE_STORAGE_FULL"); };
    let aReturned;
    try { aReturned = app.applyWithdrawalDebit(A); }
    finally { uni.setStorageSync = realSet; }

    // ── B:把余额压到不够,让余额闸判假,再把钱补回来 ──────────────────
    //    (余额闸取的是**磁盘**值,所以要走真 action 落盘,不能只改内存)
    app.debitBalance(balanceAfterCtrl - 1);
    const bReturned = app.applyWithdrawalDebit(B);
    app.creditBalance(balanceAfterCtrl - 1);
    const balanceAfterInjection = app.user.usdtBalance;

    const keysOf = (id) => {
      const table = uni.getStorageSync("nexgrid-account-cloud-v1") || {};
      const disk = table[app.accountKey]?.user?.appliedRewardKeys || {};
      const mem = app.user.appliedRewardKeys || {};
      return {
        debit: !!(mem["wd-debit:" + id] || disk["wd-debit:" + id]),
        refund: !!(mem["wd-refund:" + id] || disk["wd-refund:" + id]),
      };
    };

    // 活性探针:抹掉 A 的账单分录,reconcileBills ⓪ 应当在下一拍补回来
    bills.bills = bills.bills.filter((b) => b.ref !== c.IDS.A);

    return {
      balanceStart, ctrlReturned, balanceAfterCtrl, aReturned, bReturned, balanceAfterInjection,
      keys: { A: keysOf(c.IDS.A), B: keysOf(c.IDS.B), C: keysOf(c.IDS.C) },
      billRowsA: bills.bills.filter((b) => b.ref === c.IDS.A).length,
      loop: window.__nxBusinessLoopStatus ? window.__nxBusinessLoopStatus() : null,
      // 夹具自证:四张单进列表时带的就是构造的那几个数(不是 undefined / 被合并层改写)
      amounts: Object.fromEntries(Object.entries(c.IDS)
        .map(([k, id]) => [k, app.withdrawals.find((w) => w.id === id)?.amount])),
    };
  }, CONST);

  await page.waitForTimeout(WAIT_MS);

  const after = await page.evaluate(async (c) => {
    const [appMod, billsMod] = await Promise.all([
      import("/src/store/app.ts"), import("/src/store/bills.ts"),
    ]);
    const app = appMod.useApp();
    const bills = billsMod.useBills();
    const keysOf = (id) => {
      const table = uni.getStorageSync("nexgrid-account-cloud-v1") || {};
      const disk = table[app.accountKey]?.user?.appliedRewardKeys || {};
      const mem = app.user.appliedRewardKeys || {};
      return {
        debit: !!(mem["wd-debit:" + id] || disk["wd-debit:" + id]),
        refund: !!(mem["wd-refund:" + id] || disk["wd-refund:" + id]),
      };
    };
    return {
      balance: app.user.usdtBalance,
      diskBalance: (uni.getStorageSync("nexgrid-account-cloud-v1") || {})[app.accountKey]?.user?.usdtBalance,
      keys: { A: keysOf(c.IDS.A), B: keysOf(c.IDS.B), C: keysOf(c.IDS.C) },
      billRowsA: bills.bills.filter((b) => b.ref === c.IDS.A).length,
      listed: Object.values(c.IDS).filter((id) => app.withdrawals.some((w) => w.id === id)).length,
    };
  }, { IDS });

  console.log("withdraw-debit-selfheal-runtime — 扣款报假之后,对账把那笔钱补回来了没有\n");

  // ── 起点:靶子、循环、注入三样都得先证明是活的 ──────────────────────
  check("【起点】对照组扣款成功、余额真的少了(靶子有效,不是整条链都不工作)",
    setup.ctrlReturned === true && setup.balanceAfterCtrl === setup.balanceStart - CTRL_AMOUNT,
    `返回 ${setup.ctrlReturned} · 余额 ${setup.balanceStart}→${setup.balanceAfterCtrl}(期望 ${setup.balanceStart - CTRL_AMOUNT})`);
  check("【起点】业务循环在跑(arrival timer 活着)",
    setup.loop?.running === true && setup.loop?.arrival === true, JSON.stringify(setup.loop));
  check("【起点】四张单都还在列表里(对账每拍都看得见它们)", after.listed === 4, `${after.listed}/4`);
  // 🔴 夹具自证:金额必须是构造的那几个数。amount 一旦是 undefined/0,扣款函数会按
  // 「脏数据」这条**完全不同的**分支 return false —— 下面「注入生效」三格照样绿,
  // 而被测的注入路径一步没走(本门 2026-08-13 首次运行就是这么假绿的)。
  check("【起点】夹具金额构造正确(不是 undefined —— 否则扣款走的是脏数据分支,不是被测分支)",
    setup.amounts.CTRL === CTRL_AMOUNT && setup.amounts.A === A_AMOUNT
      && setup.amounts.B === B_AMOUNT && setup.amounts.C === C_AMOUNT,
    JSON.stringify(setup.amounts));
  check("【起点】A 注入生效:落盘失败让扣款报假、幂等键没置位",
    setup.aReturned === false && setup.keys.A.debit === false, `返回 ${setup.aReturned} · 键 ${JSON.stringify(setup.keys.A)}`);
  check("【起点】B 注入生效:余额闸判假让扣款报假、幂等键没置位",
    setup.bReturned === false && setup.keys.B.debit === false, `返回 ${setup.bReturned} · 键 ${JSON.stringify(setup.keys.B)}`);
  check("【起点】注入过程本身没动钱(两次报假都是全有或全无)",
    setup.balanceAfterInjection === setup.balanceAfterCtrl,
    `${setup.balanceAfterCtrl} → ${setup.balanceAfterInjection}`);
  check("【活性】reconcileBills ⓪ 把抹掉的账单分录补回来了 —— 证明对账真的执行到了本函数",
    setup.billRowsA === 0 && after.billRowsA > 0,
    `等待前 ${setup.billRowsA} 条 → 等待后 ${after.billRowsA} 条`);

  // ── 结论:同一个函数里,资金腿补没补 ────────────────────────────────
  const expected = setup.balanceAfterCtrl - A_AMOUNT - B_AMOUNT; // C 净 0
  check(`🔴 A 落盘失败的那笔 ${A_AMOUNT} 被对账补扣了(幂等键置位)`,
    after.keys.A.debit === true, JSON.stringify(after.keys.A));
  check(`🔴 B 余额闸判假的那笔 ${B_AMOUNT} 在余额回升后被对账补扣了(生产档可达的那个入口)`,
    after.keys.B.debit === true, JSON.stringify(after.keys.B));
  check(`🔴 C 失败终态净额守恒:补扣与退款成对发生(两把键都置位,不是「一步没走」)`,
    after.keys.C.debit === true && after.keys.C.refund === true, JSON.stringify(after.keys.C));
  check(`🔴 余额落到 ${expected}(补扣 A+B、C 扣了又退净 0)`,
    after.balance === expected, `实测 ${after.balance}`);
  check("🔴 补扣**真落盘**(只在内存 = 刷新即回退,用户眼里钱又变回来了)",
    after.diskBalance === expected, `盘上 ${after.diskBalance}`);

  console.log(`\n余额轨迹:${setup.balanceStart} →(对照扣款)${setup.balanceAfterCtrl} →(两次注入报假)${setup.balanceAfterInjection} →(等 ${WAIT_MS / 1000}s 对账)${after.balance}`);
  if (pageErrors.length) console.log(`page errors: ${pageErrors.slice(0, 3).join(" | ")}`);
  console.log(`\n${pass} pass / ${fail} fail`);
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
