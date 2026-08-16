#!/usr/bin/env node
/**
 * pending-checkout-runtime.mjs — 结算「待支付会话 + 浮动条」运行时门(mock 档,真页面真点击)。
 *
 * 守的不变量(pkg/ad checkout-cancel,2026-08-16;独立审计 R1 P0 族 = 场景 C):
 *   A 扫码页不自行推进:进入链上付款步后停 15s,仍在扫码页、余额不变、不建单(原 12s 定时器自动
 *     emit complete 把「取消」变成 12 秒按钮 —— 静态哨兵在 verify.sh,这里是运行时那一半)。
 *   B 离开保留 + 同一笔恢复:按返回后浮动条出现(金额一致)、一次性提示已给(leftNoticeShown=true);
 *     点浮动条回来 = 同一地址、倒计时不重置。
 *   C 至多一张活票:把余额压到不够 → 「我已完成支付」→ 支付时刻守卫回弹(余额不足)→ 发票必须作废
 *     (storage 0 张)→ 再 Pay now → 只有 1 张、且是新地址;绝不并存两张(两张 = 两个地址同时催付、
 *     落单后旧票成孤儿拉人二次付款)。
 *   D 到点即死:把 expiresAt 注入成 3s 后 → 重载 → 浮动条先在、到点后消失、storage 剪成 0。
 *
 * 判据全部是构造性的(读页面文本 / storage / 订单数),不扫源码形状。
 * Usage: BASE_URL=http://127.0.0.1:<port> node scripts/pending-checkout-runtime.mjs
 */
import { chromium } from "playwright";
import { collectAppConsoleErrors } from "./lib/console-origin-filter.mjs";
import { directAppUrl } from "./lib/direct-app-url.mjs";
import { assertNoRuntimeErrors } from "./lib/probe-coverage.mjs";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const PRODUCT = "stellarbox-s1";
const CHECKOUT = `/#/pages/store/checkout?product=${PRODUCT}`;
const PENDING_KEY = "nexgrid-pending-checkout-accounts-v1";
const ORDERS_KEY = "nexgrid-orders-accounts-v1";
const CLOUD_KEY = "nexgrid-account-cloud-v1";
const NO_ADVANCE_WAIT_MS = 15_000;

function fail(msg) { throw new Error(`pending-checkout-runtime: ${msg}`); }

const browser = await chromium.launch();

async function openPage(initScript) {
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, colorScheme: "dark" });
  const page = await ctx.newPage();
  // Pin English so aria-label lookups are stable; the app auto-detects zh on the home page otherwise.
  await page.addInitScript(() => {
    if (!localStorage.getItem("nexgrid-locale-v1")) {
      localStorage.setItem("nexgrid-locale-v1", JSON.stringify({ type: "object", data: { code: "en", userSet: true } }));
    }
  });
  if (initScript) await page.addInitScript(initScript.fn, initScript.arg);
  const errors = [];
  page.on("console", collectAppConsoleErrors(errors, BASE));
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

/** Close any trade-in / slot sheets the mock account raises on checkout entry. */
async function dismissSheets(page) {
  for (let i = 0; i < 3; i++) {
    const closed = await page.evaluate(() => {
      const x = document.querySelector(".tis-root .tis-close");
      if (!x) return false;
      x.click();
      return true;
    });
    if (!closed) break;
    await page.waitForTimeout(350);
  }
}

async function tapButton(page, label) {
  const ok = await page.evaluate((l) => {
    const pages = [...document.querySelectorAll('uni-page[data-page="pages/store/checkout"]')];
    const scope = pages[pages.length - 1] ?? document;
    const btn = [...scope.querySelectorAll('[role="button"]')].find((b) => b.getAttribute("aria-label") === l);
    if (!btn) return false;
    btn.click();
    return true;
  }, label);
  if (!ok) fail(`button "${label}" not found on the checkout page`);
  await page.waitForTimeout(600);
}

async function readState(page) {
  return page.evaluate(({ PENDING_KEY, ORDERS_KEY }) => {
    const parse = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null")?.data ?? null; } catch { return null; } };
    const pending = parse(PENDING_KEY) ?? {};
    const orders = parse(ORDERS_KEY) ?? {};
    const sessions = Object.values(pending).flatMap((row) => row?.sessions ?? []);
    const orderCount = Object.values(orders).reduce((n, row) => n + (row?.orders?.length ?? 0), 0);
    const pages = [...document.querySelectorAll('uni-page[data-page="pages/store/checkout"]')];
    const scope = pages[pages.length - 1];
    const text = (scope?.innerText || "").replace(/\s+/g, " ");
    return {
      hash: location.hash,
      sessions: sessions.map((s) => ({ id: s.id, address: s.address, amountUsdt: s.amountUsdt, expiresAt: s.expiresAt, leftNoticeShown: s.leftNoticeShown })),
      orderCount,
      onPayStep: /completed the payment/.test(text),
      address: text.match(/T[0-9A-F]{33}|0x[0-9a-f]{40}/)?.[0] ?? null,
      countdown: text.match(/\b\d\d:\d\d\b/)?.[0] ?? null,
      pill: document.querySelector(".pcb-outer")?.textContent?.replace(/\s+/g, " ") ?? null,
      toast: [...document.querySelectorAll(".nx-toast")].map((t) => t.textContent).join(" | "),
      dialog: !!document.querySelector(".nx-mask--confirm"),
      reviewOrder: /Review order/.test(text),
    };
  }, { PENDING_KEY, ORDERS_KEY });
}

async function goToPayStep(page) {
  await page.goto(directAppUrl(BASE, CHECKOUT), { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  await dismissSheets(page);
  await tapButton(page, "Continue");
  await tapButton(page, "Pay now");
  await page.waitForTimeout(400);
  const st = await readState(page);
  if (!st.onPayStep || !st.address || st.sessions.length !== 1) fail(`could not reach the pay step: ${JSON.stringify(st)}`);
  return st;
}

async function goBack(page) {
  await page.evaluate(() => document.querySelector(".nx-navheader .nx-nav-side")?.click());
  await page.waitForTimeout(1200);
}

const report = {};
try {
  // ── A + B: no auto-advance · leave keeps the invoice · resume is the same invoice ──
  {
    const { ctx, page, errors } = await openPage(null);
    const t0 = await goToPayStep(page);
    await page.waitForTimeout(NO_ADVANCE_WAIT_MS);
    const t1 = await readState(page);
    if (!t1.onPayStep) fail(`A: pay step advanced on its own within ${NO_ADVANCE_WAIT_MS}ms (hash=${t1.hash})`);
    if (t1.orderCount !== t0.orderCount) fail(`A: an order was created without user action (${t0.orderCount} → ${t1.orderCount})`);
    if (t1.address !== t0.address) fail(`A: address changed while waiting (${t0.address} → ${t1.address})`);
    // B: back → bar + one-shot notice; resume → same address, countdown continuous
    await goBack(page);
    const left = await readState(page);
    if (!left.pill || !left.pill.includes(String(t0.sessions[0].amountUsdt).replace(/\B(?=(\d{3})+(?!\d))/g, ","))) fail(`B: floating bar missing/wrong after leaving: ${left.pill}`);
    if (left.sessions.length !== 1 || left.sessions[0].leftNoticeShown !== true) fail(`B: invoice not kept / notice not marked: ${JSON.stringify(left.sessions)}`);
    const pillCountdown = left.pill.match(/\b\d\d:\d\d\b/)?.[0] ?? null;
    await page.evaluate(() => document.querySelector(".pcb-pill")?.click());
    await page.waitForTimeout(2000);
    const back = await readState(page);
    if (!back.hash.includes("resume=")) fail(`B: bar tap did not open the resume route (${back.hash})`);
    if (back.address !== t0.address) fail(`B: resumed invoice shows a different address (${t0.address} → ${back.address})`);
    if (back.pill !== null) fail("B: bar still visible on the page that shows the invoice");
    if (pillCountdown && back.countdown && back.countdown > pillCountdown) fail(`B: countdown reset (${pillCountdown} → ${back.countdown})`);
    report.AB = { address: t0.address, waitedMs: NO_ADVANCE_WAIT_MS, pill: left.pill, resumedCountdown: back.countdown, errors };
    assertNoRuntimeErrors(errors, "pending-checkout A/B");
    await ctx.close();
  }

  // ── C: settlement guard bounce voids the invoice; next Pay now opens ONE fresh invoice ──
  {
    const { ctx, page, errors } = await openPage({
      fn: (CLOUD_KEY) => {
        // squeeze the mock balance below any device price so the pay-time guard bounces
        const raw = localStorage.getItem(CLOUD_KEY);
        if (!raw) return;
        try {
          const wrapped = JSON.parse(raw);
          for (const row of Object.values(wrapped.data ?? {})) {
            if (row?.user) { row.user.usdtBalance = 1; if (row.user.earningBuckets) row.user.earningBuckets.withdrawableUsdt = 1; }
          }
          localStorage.setItem(CLOUD_KEY, JSON.stringify(wrapped));
        } catch { /* leave storage as is */ }
      },
      arg: CLOUD_KEY,
    });
    // First visit seeds storage; reload so the init script can squeeze the seeded balance.
    await page.goto(directAppUrl(BASE, "/#/pages/store/store"), { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(800);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const first = await goToPayStep(page);
    await tapButton(page, "I've completed the payment →");
    await page.waitForTimeout(4000); // awaiting (2.4s) → confirmed → balance guard bounce
    const bounced = await readState(page);
    if (bounced.orderCount !== first.orderCount) fail(`C: order created despite insufficient balance (${first.orderCount} → ${bounced.orderCount})`);
    if (bounced.onPayStep) fail("C: still on the pay step after the settlement guard bounce (balance squeeze did not take?)");
    if (bounced.sessions.length !== 0) fail(`C: bounced invoice not voided (sessions=${bounced.sessions.length}) — a second Pay now would mint a duplicate`);
    if (bounced.pill !== null) fail(`C: bar shows a voided invoice: ${bounced.pill}`);
    await tapButton(page, "Continue");
    await tapButton(page, "Pay now");
    await page.waitForTimeout(500);
    const second = await readState(page);
    if (second.dialog) fail("C: collision dialog raised although the previous invoice was voided");
    if (second.sessions.length !== 1) fail(`C: expected exactly one live invoice after re-opening, got ${second.sessions.length}`);
    if (second.address === first.address) fail("C: re-opened invoice reused the voided address");
    report.C = { firstAddress: first.address, secondAddress: second.address, sessionsAfter: second.sessions.length, errors };
    assertNoRuntimeErrors(errors, "pending-checkout C");
    await ctx.close();
  }

  // ── D: deadline passes → bar disappears, storage pruned ──
  {
    const { ctx, page, errors } = await openPage(null);
    const t0 = await goToPayStep(page);
    await goBack(page);
    await page.evaluate((PENDING_KEY) => {
      const wrapped = JSON.parse(localStorage.getItem(PENDING_KEY));
      for (const row of Object.values(wrapped.data)) for (const s of row.sessions ?? []) s.expiresAt = Date.now() + 3000;
      localStorage.setItem(PENDING_KEY, JSON.stringify(wrapped));
    }, PENDING_KEY);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const before = await readState(page);
    if (!before.pill) fail("D: bar missing right after reload with a still-live invoice");
    await page.waitForTimeout(4000);
    const after = await readState(page);
    if (after.pill !== null) fail(`D: bar still shows an expired invoice: ${after.pill}`);
    if (after.sessions.length !== 0) fail(`D: expired invoice not pruned from storage (${after.sessions.length})`);
    report.D = { address: t0.address, pillBefore: before.pill, errors };
    assertNoRuntimeErrors(errors, "pending-checkout D");
    await ctx.close();
  }

  console.log(JSON.stringify(report, null, 2));
  console.log("PENDING-CHECKOUT-RUNTIME: PASS (A no-auto-advance 15s · B leave/resume same invoice · C bounce voids + single live · D expiry prune)");
} finally {
  await browser.close();
}
