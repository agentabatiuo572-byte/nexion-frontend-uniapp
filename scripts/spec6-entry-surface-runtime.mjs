import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://localhost:5173";
const routes = [
  "/#/pages/entry-surfaces/index",
  "/#/pages/entry-surfaces/signed",
  "/#/pages/entry-surfaces/h5",
  "/#/pages/entry-surfaces/white?entry=white-app",
];
const forbiddenText = [
  "Lifetime earnings",
  "Earnings milestone",
  "$10,000+",
  "+3,000 NEX",
  "Milestone",
];
const businessStorageKeys = [
  "nexion-milestones-v1",
  "nexion-bills-v1",
  "nexion-account-cloud-v1",
  "nexion-account-sessions-v1",
  "nexion-device-id-v1",
];

function assertNoBusinessStorage(snapshot, route) {
  const milestone = snapshot["nexion-milestones-v1"] || "";
  const bills = snapshot["nexion-bills-v1"] || "";
  if (/earn-\d+/.test(milestone)) {
    throw new Error(`${route} wrote milestone fired state: ${milestone}`);
  }
  if (/MILESTONE-|Earnings milestone/.test(bills)) {
    throw new Error(`${route} wrote milestone bill state`);
  }
  const written = businessStorageKeys.filter((key) => snapshot[key]);
  if (written.length) {
    throw new Error(`${route} wrote business storage keys: ${written.join(", ")}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await page.addInitScript((keys) => {
      for (const key of keys) localStorage.removeItem(key);
    }, businessStorageKeys);
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
    await page.locator("body").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(4700);
    const text = await page.locator("body").innerText({ timeout: 5000 });
    const leaked = forbiddenText.filter((token) => text.includes(token));
    if (leaked.length) throw new Error(`${route} leaked business overlay text: ${leaked.join(", ")}`);
    const storage = await page.evaluate(() => {
      const out = {};
      for (const key of [
        "nexion-milestones-v1",
        "nexion-bills-v1",
        "nexion-account-cloud-v1",
        "nexion-account-sessions-v1",
        "nexion-device-id-v1",
      ]) out[key] = localStorage.getItem(key) || "";
      return out;
    });
    assertNoBusinessStorage(storage, route);
    await page.close();
  }

  await browser.close();
  console.log("SPEC-6 entry surfaces runtime PASS");
}

main().catch(async (err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
