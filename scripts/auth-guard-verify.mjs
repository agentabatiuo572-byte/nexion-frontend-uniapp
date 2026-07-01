#!/usr/bin/env node
/** auth-guard-verify.mjs — runtime proof the demo-friendly auth guard behaves. */
import { chromium } from "playwright";
const BASE = "http://localhost:5173";
const browser = await chromium.launch();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// uni H5 wraps stored objects as {type:"object",data:...}
const unauth = JSON.stringify({ type: "object", data: { isAuthenticated: false, email: "", onboardingComplete: false } });

async function routeAfter(seedUnauth, target) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#/pages/index/index`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.evaluate((u) => {
    localStorage.clear();
    if (u) localStorage.setItem("nexion-auth-v1", u);
  }, seedUnauth ? unauth : null);
  await page.goto(`${BASE}/#${target}`, { waitUntil: "networkidle", timeout: 30000 });
  await wait(1800); // onShow guard + one 1s tick
  const route = await page.evaluate(() => (location.hash || "").replace(/^#/, ""));
  await ctx.close();
  return route;
}

const r1 = await routeAfter(false, "/pages/earn/earn");       // default authed → stays
const r2 = await routeAfter(true, "/pages/earn/earn");        // signed out → redirected to intro
const r3 = await routeAfter(true, "/pages/onboarding/intro"); // unauth on funnel → no loop
console.log(JSON.stringify({
  defaultAuthed_staysOnEarn: r1,
  signedOut_redirectedFromEarn: r2,
  unauthOnOnboarding_noLoop: r3,
}, null, 2));
await browser.close();
