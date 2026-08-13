import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`${process.env.BASE_URL}/?nx_device=off#/pages/me/wallet`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof window.uni !== "undefined" && document.querySelector("#app")?.children.length, null, { timeout: 20000 });
await page.waitForTimeout(2000);
const r = await page.evaluate(async () => {
  const app = (await import("/src/store/app.ts")).useApp();
  const table = uni.getStorageSync("nexgrid-account-cloud-v1") || {};
  const snap = table[app.accountKey];
  return {
    accountKey: app.accountKey,
    memWithdrawals: app.withdrawals.map((w) => `${w.id}:${w.status}:${w.amount}`),
    diskWithdrawals: (snap?.user ? snap.withdrawals || [] : []).map((w) => `${w.id}:${w.status}:${w.amount}`),
    debitKeys: Object.keys(snap?.user?.appliedRewardKeys || {}).filter((k) => k.startsWith("wd-debit:")),
    diskBalance: snap?.user?.usdtBalance,
  };
});
console.log(JSON.stringify(r, null, 2));
await browser.close();
