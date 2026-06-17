#!/usr/bin/env node
/**
 * backnav-check.mjs — empirical test that the chassis nav header survives uni's
 * page-stack back-navigation (the onActivated linchpin for the SubPageHeader
 * registrar). A→B via uni.navigateTo, then uni.navigateBack → A's header must
 * re-appear. Usage: node scripts/backnav-check.mjs <hashRouteA> <uniRouteB>
 */
import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://localhost:5173";
const routeA = process.argv[2] || "/#/pages/team/rank";
const routeB = process.argv[3] || "/pages/team/rank-how";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 }, colorScheme: "dark" });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
const title = () => page.$eval(".nx-nav-title", (e) => e.textContent.trim()).catch(() => null);

await page.goto(BASE + routeA, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1200);
const tA = await title();
await page.evaluate((r) => uni.navigateTo({ url: r }), routeB);
await page.waitForTimeout(1200);
const tB = await title();
await page.evaluate(() => uni.navigateBack());
await page.waitForTimeout(1200);
const tBack = await title();

console.log(JSON.stringify({
  routeA, routeB, titleA: tA, titleB: tB, titleBackToA: tBack,
  backNavOK: tBack !== null && tBack === tA && tBack !== tB,
  consoleErrors: errors,
}, null, 2));
await browser.close();
