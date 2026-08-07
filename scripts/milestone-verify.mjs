#!/usr/bin/env node
/** milestone-verify.mjs — definitive runtime proof the milestone poll fires. */
import { chromium } from "playwright";
import { collectAppConsoleErrors } from "./lib/console-origin-filter.mjs";
const BASE = process.env.UNI_BASE_URL || process.env.BASE_URL || "http://localhost:5173";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
const page = await ctx.newPage();
const errs = [];
page.on("console", collectAppConsoleErrors(errs, BASE));
page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(`${BASE}/?nx_device=off#/pages/index/index`, { waitUntil: "networkidle", timeout: 30000 });
// Fresh start: wipe milestone+quest persisted state, then reload so stores re-hydrate empty.
await page.evaluate(() => { localStorage.removeItem("nexgrid-milestones-v1"); localStorage.removeItem("nexgrid-quest-v1"); });
await page.reload({ waitUntil: "networkidle" });
await wait(5200); // first milestone poll @4s → overlay shows 5.2s

const overlayVisible = await page.evaluate(() => {
  const el = document.querySelector(".ms-overlay");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { present: true, w: Math.round(r.width), h: Math.round(r.height), text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100) };
});
const fired = await page.evaluate(() => localStorage.getItem("nexgrid-milestones-v1"));

console.log(JSON.stringify({ overlayVisible, firedIdsPersisted: fired, consoleErrors: errs }, null, 2));
await browser.close();
