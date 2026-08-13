#!/usr/bin/env node
// 诊断:新门全红而旧探针绿,差别到底在哪
import { chromium } from "playwright";
const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5399";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") pageErrors.push("console:" + m.text()); });
try {
  await page.goto(`${baseUrl}/?nx_device=off#/pages/me/wallet`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.uni !== "undefined" && document.querySelector("#app")?.children.length, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(async () => {
    const appMod = await import("/src/store/app.ts");
    const app = appMod.useApp();
    const now = Date.now();
    const mk = (id, amount, status) => ({
      id, amount, network: "USDT-TRC20", address: "TDiag0000000000000000000000000",
      fee: { networkConfirmUsd: 1, nexBurned: 0, actualFeeUsd: 1, feeWaivedUsd: 0 },
      status, submittedAt: now, estimatedCompletion: now + 864e5, source: "server",
    });
    const out = {};
    out.balance0 = app.user.usdtBalance;
    const seed = 5000 - app.user.usdtBalance;
    if (seed > 0) app.creditBalance(seed); else if (seed < 0) app.debitBalance(-seed);
    out.balanceSeeded = app.user.usdtBalance;

    const CTRL = mk("WD-DIAG-CTRL", 50, "submitted");
    const A = mk("WD-DIAG-A", 100, "submitted");
    app.withdrawals = [CTRL, A, ...app.withdrawals];
    out.ctrl = app.applyWithdrawalDebit(CTRL);
    out.balanceAfterCtrl = app.user.usdtBalance;

    // 复刻门里 B 的余额折腾
    app.debitBalance(out.balanceAfterCtrl - 1);
    out.balanceLow = app.user.usdtBalance;
    const diskLow = (uni.getStorageSync("nexgrid-account-cloud-v1") || {})[app.accountKey]?.user?.usdtBalance;
    out.diskLow = diskLow;
    app.creditBalance(out.balanceAfterCtrl - 1);
    out.balanceRestored = app.user.usdtBalance;
    out.diskRestored = (uni.getStorageSync("nexgrid-account-cloud-v1") || {})[app.accountKey]?.user?.usdtBalance;

    // 现在手工执行 ⓪b 的两行逻辑,看每一步
    out.hasFn = typeof app.withdrawalDebitApplied;
    out.appliedA = app.withdrawalDebitApplied ? app.withdrawalDebitApplied("WD-DIAG-A") : "NO_FN";
    out.debitReturnA = app.applyWithdrawalDebit(A);
    out.balanceAfterManual = app.user.usdtBalance;
    out.keysMem = Object.keys(app.user.appliedRewardKeys || {}).filter((k) => k.includes("DIAG"));
    return out;
  });
  console.log(JSON.stringify(r, null, 2));
  console.log("pageErrors:", pageErrors.slice(0, 5));
} finally { await browser.close(); }
