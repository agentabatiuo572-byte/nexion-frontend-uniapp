import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror:" + e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push("console:" + m.text().slice(0, 200)); });
await page.goto(`${process.env.BASE_URL}/?nx_device=off#/pages/me/wallet`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof window.uni !== "undefined" && document.querySelector("#app")?.children.length, null, { timeout: 20000 });
await page.waitForTimeout(2500);
await page.evaluate(async () => {
  const app = (await import("/src/store/app.ts")).useApp();
  const now = Date.now();
  const mk = (id, amount, status) => ({
    id, amount, network: "USDT-TRC20", address: "TDiag300000000000000000000000",
    fee: { networkConfirmUsd: 1, nexBurned: 0, actualFeeUsd: 1, feeWaivedUsd: 0 },
    status, submittedAt: now, estimatedCompletion: now + 864e5, source: "server",
  });
  const seed = 5000 - app.user.usdtBalance;
  if (seed > 0) app.creditBalance(seed); else if (seed < 0) app.debitBalance(-seed);
  const CTRL = mk("WD-D3-CTRL", 50, "submitted");
  const A = mk("WD-D3-A", 100, "submitted");
  const B = mk("WD-D3-B", 200, "submitted");
  const C = mk("WD-D3-C", 300, "tx-failed");
  app.withdrawals = [CTRL, A, B, C, ...app.withdrawals];
  app.applyWithdrawalDebit(CTRL);
  const realSet = uni.setStorageSync;
  uni.setStorageSync = () => { throw new Error("X"); };
  try { app.applyWithdrawalDebit(A); } finally { uni.setStorageSync = realSet; }
  const bal = app.user.usdtBalance;
  app.debitBalance(bal - 1); app.applyWithdrawalDebit(B); app.creditBalance(bal - 1);

  // 观测:包装两个函数,记录对账循环里的每次调用
  window.__log = [];
  const realApplied = app.withdrawalDebitApplied;
  const realDebit = app.applyWithdrawalDebit;
  app.withdrawalDebitApplied = (id) => { const r = realApplied(id); window.__log.push(`applied(${id})=${r}`); return r; };
  app.applyWithdrawalDebit = (wd) => { const r = realDebit(wd); window.__log.push(`debit(${wd.id},${wd.amount})=${r} bal=${app.user.usdtBalance}`); return r; };
  window.__snap = () => ({ bal: app.user.usdtBalance, ids: app.withdrawals.map((w) => w.id) });
});
await page.waitForTimeout(13000);
const out = await page.evaluate(() => ({ log: window.__log, ...window.__snap() }));
console.log(JSON.stringify(out, null, 2));
console.log("errs:", errs.slice(0, 5));
await browser.close();
