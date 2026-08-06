#!/usr/bin/env node
/**
 * trial-check.mjs — behavior-parity test for the Home trial-sheet auto-push
 * (BEHAVIOR-PARITY #1, the one 主人 flagged). Fresh context (no cooldown):
 *   · Home: after the autoPushDelayMs(1500) the TrialClaimSheet (.tcs-root) auto-opens.
 *   · /me (non-home tab): NO auto-push (confirms it is Home-specific, not global).
 * Usage: node scripts/trial-check.mjs
 */
import { chromium } from "playwright";
import { collectAppConsoleErrors } from "./lib/console-origin-filter.mjs";
const BASE = process.env.BASE_URL || "http://localhost:5173";

async function check(route) {
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, colorScheme: "dark" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", collectAppConsoleErrors(errors, BASE));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2600); // > 1500ms auto-push delay
  const open = await page.evaluate(() => !!document.querySelector(".tcs-root, .tcs-panel"));
  await ctx.close();
  return { route, sheetOpen: open, errors };
}

const browser = await chromium.launch();
const home = await check("/#/pages/index/index");
const me = await check("/#/pages/me/me");
console.log(JSON.stringify({
  home, me,
  autoPushOK: home.sheetOpen === true && me.sheetOpen === false,
}, null, 2));
await browser.close();
