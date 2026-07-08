import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5173";
const accountKey = "spec4-sync@nexion.ai";

function unwrap(raw, fallback) {
  if (!raw) return fallback;
  const parsed = JSON.parse(raw);
  return parsed && parsed.type && Object.prototype.hasOwnProperty.call(parsed, "data") ? parsed.data : parsed;
}

function wrap(data) {
  return JSON.stringify({ type: "object", data });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(err.message));

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.goto(`${baseUrl}/#/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

const result = await page.evaluate(
  async ({ accountKey, unwrapText, wrapText }) => {
    const unwrap = eval(`(${unwrapText})`);
    const wrap = eval(`(${wrapText})`);
    const { useApp } = await import("/src/store/app.ts");
    const app = useApp();

    app.bindAccount(accountKey);
    const cloudBefore = unwrap(localStorage.getItem("nexion-account-cloud-v1"), {});
    const row = cloudBefore[accountKey];
    if (!row) throw new Error("account cloud row missing after bindAccount");
    if (!row.devices.length) throw new Error("seed devices missing after bindAccount");

    const externalBalance = 999999.99;
    cloudBefore[accountKey] = {
      ...row,
      updatedAt: Date.now(),
      user: { ...row.user, usdtBalance: externalBalance },
    };
    localStorage.setItem("nexion-account-cloud-v1", wrap(cloudBefore));

    app.creditBalance(1);
    const afterFirst = unwrap(localStorage.getItem("nexion-account-cloud-v1"), {})[accountKey];
    app.creditBalance(1);
    const afterSecond = unwrap(localStorage.getItem("nexion-account-cloud-v1"), {})[accountKey];

    const deleteId = afterSecond.devices[0].id;
    app.devices = app.devices.filter((device) => device.id !== deleteId);
    app.persistAccountSnapshot();
    const afterDelete = unwrap(localStorage.getItem("nexion-account-cloud-v1"), {})[accountKey];

    return {
      firstBalance: afterFirst.user.usdtBalance,
      secondBalance: afterSecond.user.usdtBalance,
      appBalance: app.user.usdtBalance,
      deleteId,
      deletedStillInCloud: afterDelete.devices.some((device) => device.id === deleteId),
    };
  },
  { accountKey, unwrapText: unwrap.toString(), wrapText: wrap.toString() },
);

await browser.close();

if (result.firstBalance !== 1000000.99) {
  throw new Error(`first merged balance wrong: ${result.firstBalance}`);
}
if (result.secondBalance !== 1000001.99 || result.appBalance !== 1000001.99) {
  throw new Error(`merged snapshot was not adopted before second write: cloud=${result.secondBalance}, app=${result.appBalance}`);
}
if (result.deletedStillInCloud) {
  throw new Error(`device deletion did not persist to account cloud: ${result.deleteId}`);
}
if (errors.length) {
  throw new Error(`browser errors: ${errors.slice(0, 5).join(" | ")}`);
}

console.log("SPEC-4 account-cloud app sync PASS");
