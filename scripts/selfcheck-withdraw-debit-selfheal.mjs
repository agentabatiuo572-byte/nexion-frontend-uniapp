#!/usr/bin/env node
// 提现扣款自愈门 —— BASE_URL=http://127.0.0.1:5399 node scripts/selfcheck-withdraw-debit-selfheal.mjs
//
// 🔴 守的不变量:**扣款落盘失败之后,5s 对账循环必须把那笔钱补扣回来。**
// 缺陷现场(2026-08-13 运行时复现):提现页建单成功后只调一次 applyWithdrawalDebit,
// 报假时只弹一条 toast 就再不重试;而扣款报假时幂等键 `wd-debit:` 根本没置位 ——
// 于是服务端已经扣了钱、本地余额一分没动,且**永远不会再补**。
// 用户看到的可提余额永久虚高,还能照这个虚高值再提一笔,一路放行到服务端才被拒。
//
// ⚠️ 本文件由当时的**证伪探针**反极性改成常设门:探针断言「缺陷仍在」,门断言「缺陷已消」。
// 前面 5 格【起点】/【活性】一字未改 —— 它们证明实验装置有效(注入真生效、循环真在跑、
// 对账真跑到了这个函数)。**没有这几格,最后一格无论红绿都不说明任何事。**
//
// 🔴 先证起点再证结果:如果对账循环压根没在跑,「余额没补」什么都证明不了。
// 所以每个场景都带一个**活性探针** —— 同在 reconcileBills 里的 ⓪ 格(单据在、账单缺 → 补写)。
// ⓪ 补上了 = 循环确实跑到了这个函数;此时余额仍没补,才是真的缺自愈。
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5399";
const WAIT_MS = 13_000; // ≥2 拍 5s 对账

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

try {
  await page.goto(`${baseUrl}/?nx_device=off#/pages/me/wallet`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => typeof window.uni !== "undefined" && document.querySelector("#app")?.children.length,
    null, { timeout: 20_000 },
  );
  await page.waitForTimeout(2500); // 让 onShow / 业务循环起来

  // ── 注入 ────────────────────────────────────────────────────────────────
  const setup = await page.evaluate(async () => {
    const [appMod, billsMod] = await Promise.all([
      import("/src/store/app.ts"), import("/src/store/bills.ts"),
    ]);
    const app = appMod.useApp();
    const bills = billsMod.useBills();

    const now = Date.now();
    const mkWd = (id, amount) => ({
      id, amount, network: "USDT-TRC20", address: "TProbeAddr000000000000000000000",
      fee: { networkConfirmUsd: 1, nexBurned: 0, actualFeeUsd: 1, feeWaivedUsd: 0 },
      status: "submitted", submittedAt: now, estimatedCompletion: now + 864e5, source: "server",
    });

    // 给足余额,让「余额不够」不成为干扰变量
    app.user = { ...app.user, usdtBalance: 5000 };
    const balanceStart = app.user.usdtBalance;

    // 场景 A(主人给的入口):storage 写失败 → 扣款报假
    const A = mkWd("WD-PROBE-STORAGE", 100);
    // 场景 C(对照组):同样一张单,不做任何注入 → 扣款该成功,证明靶子本身有效
    const C = mkWd("WD-PROBE-CONTROL", 50);
    app.withdrawals = [A, C, ...app.withdrawals];

    // 对照组先跑:证明这条链在本环境下真的会扣钱
    const controlReturned = app.applyWithdrawalDebit(C);
    const balanceAfterControl = app.user.usdtBalance;

    // 实验组:只在扣款这一瞬间让写盘失败
    const realSet = uni.setStorageSync;
    uni.setStorageSync = () => { throw new Error("PROBE_STORAGE_FULL"); };
    let debitReturned;
    try { debitReturned = app.applyWithdrawalDebit(A); }
    finally { uni.setStorageSync = realSet; }
    const balanceAfterFailedDebit = app.user.usdtBalance;

    const debitKeyOf = (id) => {
      const mem = !!app.user.appliedRewardKeys?.["wd-debit:" + id];
      const table = uni.getStorageSync("nexgrid-account-cloud-v1") || {};
      const disk = !!table[app.accountKey]?.user?.appliedRewardKeys?.["wd-debit:" + id];
      return { mem, disk };
    };

    // 活性探针:把 A 的账单分录全删掉,reconcileBills ⓪ 应该在下一拍补回来
    bills.bills = bills.bills.filter((b) => b.ref !== "WD-PROBE-STORAGE");

    return {
      balanceStart,
      controlReturned,
      balanceAfterControl,
      debitReturned,
      balanceAfterFailedDebit,
      keyA: debitKeyOf("WD-PROBE-STORAGE"),
      keyC: debitKeyOf("WD-PROBE-CONTROL"),
      billRowsA: bills.bills.filter((b) => b.ref === "WD-PROBE-STORAGE").length,
      loop: window.__nxBusinessLoopStatus ? window.__nxBusinessLoopStatus() : null,
    };
  });

  console.log(`\n注入完成 — 余额 ${setup.balanceStart} · 对照扣款返回 ${setup.controlReturned} · 实验扣款返回 ${setup.debitReturned}`);
  console.log(`业务循环:${JSON.stringify(setup.loop && { running: setup.loop.running, arrival: setup.loop.arrival })}\n`);

  await page.waitForTimeout(WAIT_MS);

  const after = await page.evaluate(async () => {
    const [appMod, billsMod] = await Promise.all([
      import("/src/store/app.ts"), import("/src/store/bills.ts"),
    ]);
    const app = appMod.useApp();
    const bills = billsMod.useBills();
    const debitKeyOf = (id) => {
      const mem = !!app.user.appliedRewardKeys?.["wd-debit:" + id];
      const table = uni.getStorageSync("nexgrid-account-cloud-v1") || {};
      const disk = !!table[app.accountKey]?.user?.appliedRewardKeys?.["wd-debit:" + id];
      return { mem, disk };
    };
    return {
      balance: app.user.usdtBalance,
      keyA: debitKeyOf("WD-PROBE-STORAGE"),
      billRowsA: bills.bills.filter((b) => b.ref === "WD-PROBE-STORAGE").length,
      stillListed: app.withdrawals.some((w) => w.id === "WD-PROBE-STORAGE"),
      loop: window.__nxBusinessLoopStatus ? window.__nxBusinessLoopStatus() : null,
    };
  });

  console.log("repro — 扣款报假之后,那笔钱会不会被对账补回来\n");

  // ── 起点:靶子与循环都得先证明是活的 ──────────────────────────────────
  check("【起点】对照组扣款成功且余额真的少了 100−50(靶子有效,不是整条链都不工作)",
    setup.controlReturned === true && setup.balanceAfterControl === setup.balanceStart - 50,
    `返回 ${setup.controlReturned} · 余额 ${setup.balanceStart}→${setup.balanceAfterControl}`);
  check("【起点】业务循环在跑(arrival timer 活着)",
    setup.loop?.running === true && setup.loop?.arrival === true, JSON.stringify(setup.loop));
  check("【起点】storage 注入生效:扣款报假、余额没动、幂等键没置位",
    setup.debitReturned === false
      && setup.balanceAfterFailedDebit === setup.balanceAfterControl
      && setup.keyA.mem === false && setup.keyA.disk === false,
    `返回 ${setup.debitReturned} · 余额 ${setup.balanceAfterFailedDebit} · 键 ${JSON.stringify(setup.keyA)}`);
  check("【起点】单据仍在列表里(对账每拍都看得见它)", after.stillListed === true);
  check("【活性】reconcileBills ⓪ 把被删掉的账单分录补回来了 —— 证明对账真的跑到了这个函数",
    setup.billRowsA === 0 && after.billRowsA > 0,
    `等待前 ${setup.billRowsA} 条 → 等待后 ${after.billRowsA} 条`);

  // ── 结论:同一个函数里,资金腿有没有被补 ────────────────────────────
  const expectedIfHealed = setup.balanceAfterControl - 100;
  check(`🔴【自愈】${WAIT_MS / 1000}s / ≥2 拍对账之后,那笔 100 必须已被补扣(否则余额永久虚高)`,
    after.balance === expectedIfHealed && after.keyA.mem === true && after.keyA.disk === true,
    `余额 ${after.balance}(应为 ${expectedIfHealed})· 幂等键 ${JSON.stringify(after.keyA)}`);

  console.log(`\n余额轨迹:${setup.balanceStart} →(对照扣款成功)${setup.balanceAfterControl} →(实验扣款报假)${setup.balanceAfterFailedDebit} →(等 ${WAIT_MS / 1000}s 对账)${after.balance}`);
  if (errors.length) console.log(`page errors: ${errors.slice(0, 3).join(" | ")}`);
  const FLOOR = 6;
if (pass + fail < FLOOR) {
  console.log(`FAIL  只跑了 ${pass + fail} 格,低于登记的 ${FLOOR} 格 —— 靶被删或没执行`);
  process.exitCode = 1;
}
console.log(`\n${pass} pass / ${fail} fail`);
if (fail > 0) process.exitCode = 1;
} finally {
  await browser.close();
}
process.exit(fail > 0 ? 1 : 0);
