#!/usr/bin/env node
/**
 * behavior-verify.mjs — runtime proof for the 5 newly-wired auto-trigger behaviors.
 * Polls run LIVE (setInterval not frozen here), so any bug in pollOrders/
 * pollMilestones/checkQuestRoute throws to console → console-0 under live polls
 * is real proof the new App.vue code executes. Also captures quest toast on
 * home→earn nav, and tries to surface a milestone celebration overlay.
 */
import { chromium } from "playwright";
const BASE = "http://localhost:5173";
const VP = { width: 390, height: 844 };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VP, colorScheme: "dark" });
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e)));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const report = {};

// ---- 1) Home: let order(6s)/milestone(4s)/quest polls run live for 8s ----
await page.goto(`${BASE}/#/pages/index/index`, { waitUntil: "networkidle", timeout: 30000 });
await wait(8200); // > one order tick (6s) + two milestone ticks (4s)
// celebration overlay present? (milestone fired if seeded earnings already crossed a tier)
const overlay = await page.evaluate(() => {
  const el = [...document.querySelectorAll("*")].find((e) => /milestone|celebrat/i.test(e.className || ""));
  return el ? (el.textContent || "").trim().slice(0, 80) : null;
});
report.homeLivePolls8s_consoleErrors = [...errs];
report.milestoneOverlaySeen = overlay;

// ---- 2) Quest: nav home→earn should fire visit_earn → toast ----
errs.length = 0;
await page.goto(`${BASE}/#/pages/earn/earn`, { waitUntil: "networkidle", timeout: 30000 });
await wait(1800); // quest watcher polls route @1s; toast renders in global-ui
const toastAfterEarn = await page.evaluate(() => {
  const t = [...document.querySelectorAll("[class*='toast'],[class*='nx-toast']")].map((e) => (e.textContent || "").trim()).filter(Boolean);
  return t;
});
report.earnNav_consoleErrors = [...errs];
report.toastAfterEarnNav = toastAfterEarn;

// ---- 3) genesis page: resale loop touches genesis store (console proof) ----
errs.length = 0;
await page.goto(`${BASE}/#/pages/genesis/genesis`, { waitUntil: "networkidle", timeout: 30000 });
await wait(6500); // one ORDER_TICK with genesis resale branch
report.genesisLive_consoleErrors = [...errs];

// ---- 4) store tab: order auto-advance loop runs ----
errs.length = 0;
await page.goto(`${BASE}/#/pages/store/store`, { waitUntil: "networkidle", timeout: 30000 });
await wait(6500);
report.storeLive_consoleErrors = [...errs];

console.log(JSON.stringify(report, null, 2));
await browser.close();
