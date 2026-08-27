import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const appBaseUrl = process.env.NX_GENESIS_APP_URL || "http://127.0.0.1:5173";
const backendUrl = process.env.NX_GENESIS_BACKEND_URL || "http://127.0.0.1:8110";
const confirmSandboxPurchase = process.env.NX_GENESIS_CONFIRM_SANDBOX_PURCHASE === "1";
const evidenceDir = path.resolve(process.env.NX_GENESIS_EVIDENCE_DIR
  || "D:/workspace/bug-pic/genesis-cta-5173-20260826");
const stamp = Date.now();
const phone = `138${String(stamp % 100_000_000).padStart(8, "0")}`;
const password = `Nx!Genesis${String(stamp).slice(-8)}Aa`;
let purchasedOrderNo = "";
let purchaseRunId = "";
let purchasedUserId = "";
let cleanupComplete = false;
let walletBalanceBeforePurchase = "";
let walletBalanceAfterPurchase = "";
let walletBalanceOriginal = "";
let walletVersionOriginal = -1;
let walletVersionAfterSeed = -1;
let walletVersionAfterPurchase = -1;
let eligibilityFixtureActive = false;

fs.mkdirSync(evidenceDir, { recursive: true });

function safePathname(url) {
  try { return new URL(url).pathname; } catch { return url; }
}

async function readGenesisState() {
  const response = await fetch(`${backendUrl}/api/genesis/state`);
  const payload = await response.json();
  assert.equal(response.status, 200, "GENESIS_STATE_HTTP_NOT_200");
  assert.equal(payload?.code, 0, "GENESIS_STATE_ENVELOPE_NOT_SUCCESS");
  return payload.data;
}

async function waitUntil(check, message, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${message}${lastError ? `:${String(lastError)}` : ""}`);
}

function mysqlQuery(sql) {
  const mysqlBin = process.env.NX_GENESIS_MYSQL_BIN || "D:/software/MySQL/MySQL Server 8.0/bin/mysql.exe";
  const host = process.env.NX_GENESIS_DB_HOST || "127.0.0.1";
  const user = process.env.NX_GENESIS_DB_USER || "root";
  const database = process.env.NX_GENESIS_DB_NAME || "nexion";
  const allowedTarget = process.env.NX_GENESIS_ALLOW_DB_WRITE_TARGET || "";
  assert(fs.existsSync(mysqlBin), "GENESIS_CLEANUP_MYSQL_CLIENT_MISSING");
  assert(process.env.MYSQL_PWD, "GENESIS_CLEANUP_DB_CREDENTIAL_MISSING");
  assert(/^[A-Za-z0-9._:-]+$/.test(host), "GENESIS_CLEANUP_DB_HOST_INVALID");
  assert(/^[A-Za-z0-9_]+$/.test(user), "GENESIS_CLEANUP_DB_USER_INVALID");
  assert(/^[A-Za-z0-9_]+$/.test(database), "GENESIS_CLEANUP_DB_NAME_INVALID");
  assert(["127.0.0.1", "localhost", "::1"].includes(host), "GENESIS_FIXTURE_DB_HOST_NOT_LOOPBACK");
  assert.equal(database, "nexion", "GENESIS_FIXTURE_DB_NAME_NOT_ACCEPTANCE_DATABASE");
  assert.equal(allowedTarget, `${host}/${database}`, "GENESIS_FIXTURE_DB_WRITE_TARGET_NOT_ALLOWED");
  return execFileSync(mysqlBin, ["-h", host, `-u${user}`, "-N", "-B", database, "-e", sql], {
    encoding: "utf8",
    env: process.env,
    windowsHide: true,
  }).trim();
}

function visibleWalletSnapshot(userId) {
  assert(/^\d+$/.test(String(userId)), "GENESIS_FIXTURE_USER_ID_INVALID");
  const row = mysqlQuery(`SELECT CONCAT(CAST(usdt_available AS CHAR),'|',CAST(version AS CHAR)) FROM nx_user_wallet
 WHERE user_id=${userId} AND sandbox=1 AND is_deleted=0;`);
  const match = /^(\d+(?:\.\d+)?)\|(\d+)$/.exec(row);
  assert(match, "GENESIS_FIXTURE_WALLET_SNAPSHOT_INVALID");
  return { balance: match[1], version: Number(match[2]) };
}

function prepareVisibleSandboxWallet() {
  assert(confirmSandboxPurchase, "GENESIS_FIXTURE_WRITE_REQUIRES_EXPLICIT_CONFIRM_FLAG");
  assert.equal(mysqlQuery("SELECT DATABASE();"), process.env.NX_GENESIS_DB_NAME || "nexion", "GENESIS_FIXTURE_DATABASE_MISMATCH");
  assert(/^\d{11}$/.test(phone), "GENESIS_FIXTURE_PHONE_INVALID");
  const userText = mysqlQuery(`SELECT id FROM nx_user WHERE phone='${phone}' AND sandbox=1 AND is_deleted=0;`);
  assert(/^\d+$/.test(userText), "GENESIS_FIXTURE_USER_SCOPE_NOT_UNIQUE");
  purchasedUserId = userText;
  const original = visibleWalletSnapshot(userText);
  walletBalanceOriginal = original.balance;
  walletVersionOriginal = original.version;
  const seeded = mysqlQuery(`UPDATE nx_user_wallet w JOIN nx_user u ON u.id=w.user_id
 SET w.usdt_available=20000.000000,w.version=w.version+1,w.updated_at=NOW()
 WHERE w.user_id=${userText} AND w.sandbox=1 AND w.is_deleted=0
   AND w.version=${walletVersionOriginal} AND w.usdt_available=${walletBalanceOriginal}
   AND u.sandbox=1 AND u.is_deleted=0;
SELECT ROW_COUNT();`);
  assert.equal(seeded, "1", "GENESIS_FIXTURE_VISIBLE_WALLET_SEED_CONFLICT");
  const prepared = visibleWalletSnapshot(userText);
  walletBalanceBeforePurchase = prepared.balance;
  walletVersionAfterSeed = prepared.version;
  assert.equal(Number(walletBalanceBeforePurchase), 20000, "GENESIS_FIXTURE_VISIBLE_WALLET_NOT_FUNDED");
  assert.equal(walletVersionAfterSeed, walletVersionOriginal + 1, "GENESIS_FIXTURE_VISIBLE_WALLET_VERSION_INVALID");
  return { userId: userText, originalBalance: Number(walletBalanceOriginal), purchaseBalance: 20000 };
}

function cleanupSandboxPurchase() {
  if (!purchasedOrderNo || cleanupComplete) return evidence.cleanup ?? null;
  assert(/^G4-SBX-[A-F0-9]{32}$/.test(purchasedOrderNo), "GENESIS_CLEANUP_ORDER_NO_INVALID");
  assert(/^[A-Za-z0-9][A-Za-z0-9._-]{7,95}$/.test(purchaseRunId), "GENESIS_CLEANUP_RUN_ID_INVALID");
  const userText = mysqlQuery(`SELECT user_id FROM nx_genesis_sandbox_order WHERE run_id='${purchaseRunId}' AND order_no='${purchasedOrderNo}' AND order_type='PRIMARY' AND status='COMPLETED';`);
  assert(/^\d+$/.test(userText), "GENESIS_CLEANUP_ORDER_SCOPE_NOT_UNIQUE");
  if (purchasedUserId) assert.equal(userText,purchasedUserId,"GENESIS_CLEANUP_USER_CHANGED");
  purchasedUserId = userText;
  const amountText = mysqlQuery(`SELECT CAST(amount_usdt AS CHAR) FROM nx_genesis_sandbox_order WHERE run_id='${purchaseRunId}' AND user_id=${userText} AND order_no='${purchasedOrderNo}';`);
  assert(/^\d+(?:\.\d+)?$/.test(amountText),"GENESIS_CLEANUP_AMOUNT_INVALID");
  assert(/^\d+(?:\.\d+)?$/.test(walletBalanceBeforePurchase),"GENESIS_CLEANUP_BALANCE_BEFORE_MISSING");
  assert(/^\d+(?:\.\d+)?$/.test(walletBalanceOriginal),"GENESIS_CLEANUP_ORIGINAL_BALANCE_MISSING");
  const afterPurchase=visibleWalletSnapshot(userText);
  walletBalanceAfterPurchase=afterPurchase.balance;
  walletVersionAfterPurchase=afterPurchase.version;
  const canonicalLedgerBefore=Number(mysqlQuery(`SELECT COUNT(*) FROM nx_wallet_ledger WHERE user_id=${userText} AND biz_no='${purchasedOrderNo}' AND biz_type='GENESIS_PURCHASE' AND direction='OUT' AND status='SUCCESS' AND is_deleted=0;`));
  assert.equal(Number(walletBalanceAfterPurchase),Number(walletBalanceBeforePurchase)-Number(amountText),"GENESIS_VISIBLE_WALLET_NOT_DEBITED");
  assert.equal(walletVersionAfterPurchase,walletVersionAfterSeed+1,"GENESIS_VISIBLE_WALLET_VERSION_NOT_ADVANCED_ONCE");
  assert.equal(canonicalLedgerBefore,1,"GENESIS_VISIBLE_LEDGER_NOT_WRITTEN");
  const cleanupSql = `START TRANSACTION;
UPDATE nx_user_wallet w JOIN nx_user u ON u.id=w.user_id
 SET w.usdt_available=${walletBalanceOriginal},w.version=w.version+1,w.updated_at=NOW()
 WHERE w.user_id=${userText} AND w.sandbox=1 AND w.is_deleted=0
   AND w.version=${walletVersionAfterPurchase} AND w.usdt_available=${walletBalanceAfterPurchase}
   AND u.sandbox=1 AND u.is_deleted=0;
SET @genesis_wallet_restore_count=ROW_COUNT();
DELETE FROM nx_wallet_ledger WHERE @genesis_wallet_restore_count=1 AND user_id=${userText} AND biz_no='${purchasedOrderNo}' AND biz_type='GENESIS_PURCHASE';
DELETE FROM nx_genesis_sandbox_ledger WHERE @genesis_wallet_restore_count=1 AND run_id='${purchaseRunId}' AND user_id=${userText} AND biz_no='${purchasedOrderNo}';
DELETE FROM nx_genesis_sandbox_holding WHERE @genesis_wallet_restore_count=1 AND run_id='${purchaseRunId}' AND user_id=${userText} AND order_no='${purchasedOrderNo}';
DELETE FROM nx_genesis_sandbox_order WHERE @genesis_wallet_restore_count=1 AND run_id='${purchaseRunId}' AND user_id=${userText} AND order_no='${purchasedOrderNo}';
DELETE FROM nx_genesis_sandbox_wallet WHERE run_id='${purchaseRunId}' AND user_id=${userText}
 AND @genesis_wallet_restore_count=1
 AND NOT EXISTS (SELECT 1 FROM nx_genesis_sandbox_order o WHERE o.run_id='${purchaseRunId}' AND o.user_id=${userText})
 AND NOT EXISTS (SELECT 1 FROM nx_genesis_sandbox_holding h WHERE h.run_id='${purchaseRunId}' AND h.user_id=${userText});
COMMIT;
SELECT @genesis_wallet_restore_count;`;
  assert.equal(mysqlQuery(cleanupSql),"1","GENESIS_CLEANUP_VISIBLE_WALLET_CAS_CONFLICT");
  assert.equal(mysqlQuery(`SELECT COUNT(*) FROM nx_genesis_sandbox_order WHERE run_id='${purchaseRunId}' AND order_no='${purchasedOrderNo}';`), "0", "GENESIS_CLEANUP_ORDER_REMAINS");
  assert.equal(mysqlQuery(`SELECT COUNT(*) FROM nx_wallet_ledger WHERE user_id=${userText} AND biz_no='${purchasedOrderNo}';`),"0","GENESIS_CLEANUP_CANONICAL_LEDGER_REMAINS");
  assert.equal(Number(mysqlQuery(`SELECT CAST(usdt_available AS CHAR) FROM nx_user_wallet WHERE user_id=${userText} AND sandbox=1 AND is_deleted=0;`)),Number(walletBalanceOriginal),"GENESIS_CLEANUP_VISIBLE_WALLET_NOT_RESTORED");
  cleanupComplete = true;
  return { orderNo: purchasedOrderNo, runId: purchaseRunId, orderRemaining: 0,
    visibleWallet: { before: Number(walletBalanceBeforePurchase),after: Number(walletBalanceAfterPurchase),restored: Number(walletBalanceOriginal) },
    canonicalLedgerBefore,canonicalLedgerAfter:0 };
}

function finalizeSandboxCleanup() {
  if (!purchasedOrderNo || !purchaseRunId || !purchasedUserId) return null;
  assert(/^G4-SBX-[A-F0-9]{32}$/.test(purchasedOrderNo), "GENESIS_FINAL_CLEANUP_ORDER_NO_INVALID");
  assert(/^[A-Za-z0-9][A-Za-z0-9._-]{7,95}$/.test(purchaseRunId), "GENESIS_FINAL_CLEANUP_RUN_ID_INVALID");
  assert(/^\d+$/.test(purchasedUserId), "GENESIS_FINAL_CLEANUP_USER_INVALID");
  mysqlQuery(`DELETE FROM nx_genesis_sandbox_wallet WHERE run_id='${purchaseRunId}' AND user_id=${purchasedUserId}
 AND NOT EXISTS (SELECT 1 FROM nx_genesis_sandbox_order o WHERE o.run_id='${purchaseRunId}' AND o.user_id=${purchasedUserId})
 AND NOT EXISTS (SELECT 1 FROM nx_genesis_sandbox_holding h WHERE h.run_id='${purchaseRunId}' AND h.user_id=${purchasedUserId});`);
  const finalGenesisArtifacts = {
    orders: Number(mysqlQuery(`SELECT COUNT(*) FROM nx_genesis_sandbox_order WHERE run_id='${purchaseRunId}' AND user_id=${purchasedUserId} AND order_no='${purchasedOrderNo}';`)),
    holdings: Number(mysqlQuery(`SELECT COUNT(*) FROM nx_genesis_sandbox_holding WHERE run_id='${purchaseRunId}' AND user_id=${purchasedUserId} AND order_no='${purchasedOrderNo}';`)),
    ledger: Number(mysqlQuery(`SELECT COUNT(*) FROM nx_genesis_sandbox_ledger WHERE run_id='${purchaseRunId}' AND user_id=${purchasedUserId} AND biz_no='${purchasedOrderNo}';`)),
    wallets: Number(mysqlQuery(`SELECT COUNT(*) FROM nx_genesis_sandbox_wallet WHERE run_id='${purchaseRunId}' AND user_id=${purchasedUserId};`)),
    canonicalLedger: Number(mysqlQuery(`SELECT COUNT(*) FROM nx_wallet_ledger WHERE user_id=${purchasedUserId} AND biz_no='${purchasedOrderNo}';`)),
  };
  assert.deepEqual(finalGenesisArtifacts, { orders: 0, holdings: 0, ledger: 0, wallets: 0, canonicalLedger: 0 }, "GENESIS_FINAL_CLEANUP_ARTIFACTS_REMAIN");
  return finalGenesisArtifacts;
}

const before = await readGenesisState();
assert.equal(before.series.totalSupply, 1000, "GENESIS_TOTAL_SUPPLY_NOT_1000");
assert.equal(before.series.soldSupply, 0, "GENESIS_SOLD_SUPPLY_NOT_ZERO_BEFORE");
assert.equal(before.series.remainingSupply, 1000, "GENESIS_REMAINING_SUPPLY_NOT_1000_BEFORE");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "zh-CN", viewport: { width: 414, height: 896 } });
const page = await context.newPage();
page.setDefaultTimeout(45_000);

const evidence = {
  status: "RUNNING",
  app: "NX1.0-UniApp",
  port: 5173,
  assertions: {},
  genesisResponses: [],
  purchasePostCount: 0,
  runtimeErrors: [],
};

page.on("pageerror", (error) => evidence.runtimeErrors.push(`pageerror:${error.message}`));
page.on("console", (message) => {
  if (message.type() !== "error") return;
  if (/favicon|net::ERR_ABORTED|Failed to load resource/.test(message.text())) return;
  evidence.runtimeErrors.push(`console:${message.text()}`);
});
page.on("request", (request) => {
  if (request.method() === "POST" && safePathname(request.url()) === "/api/genesis/purchase") {
    evidence.purchasePostCount += 1;
  }
});
page.on("response", (response) => {
  const pathname = safePathname(response.url());
  if (!/^\/api\/genesis\/(?:state|account|eligibility|purchase)$/.test(pathname)) return;
  const entry = {
    method: response.request().method(),
    path: pathname,
    status: response.status(),
  };
  evidence.genesisResponses.push(entry);
  void response.json().then((payload) => {
    entry.code = payload?.code ?? null;
    if (pathname === "/api/genesis/eligibility") {
      entry.eligible = payload?.data?.eligible ?? null;
      entry.sourceEnvironment = payload?.data?.sourceEnvironment ?? null;
      entry.runId = payload?.data?.runId ?? null;
    }
    if (pathname === "/api/genesis/account") {
      entry.eligible = payload?.data?.eligibility?.eligible ?? null;
      entry.sourceEnvironment = payload?.data?.sourceEnvironment ?? null;
      entry.runId = payload?.data?.runId ?? null;
      entry.orderCount = payload?.data?.orders?.length ?? null;
    }
    if (pathname === "/api/genesis/purchase") {
      entry.message = payload?.message ?? null;
      entry.sourceEnvironment = payload?.data?.sourceEnvironment ?? null;
      entry.runId = payload?.data?.runId ?? null;
      entry.ownedCount = payload?.data?.holdings?.length ?? null;
      entry.orderCount = payload?.data?.orders?.length ?? null;
    }
  }).catch(() => undefined);
});

function appFrame() {
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame()
    && candidate.url().includes("nx_device_inner=1"));
  assert(frame, "APP_DEVICE_FRAME_UNAVAILABLE");
  return frame;
}

async function waitForFrame(selector = "body") {
  await waitUntil(async () => {
    try { return await appFrame().locator(selector).count() > 0; } catch { return false; }
  }, `APP_FRAME_NOT_READY:${selector}`);
  return appFrame();
}

async function genesisAccountSnapshot(frame) {
  return frame.evaluate(async () => {
    const runtime = await import("/src/api/runtime.ts");
    const account = await runtime.genesisApi.account();
    return {
      walletBalanceUsdt: account.walletBalanceUsdt,
      soldSupply: account.series.soldSupply,
      remainingSupply: account.series.remainingSupply,
      holdings: account.holdings.length,
      orders: account.orders.length,
    };
  });
}

async function installIneligibleFixture(frame) {
  // Mark active before sending. If the request fails before or after the server
  // accepts it, the caller's finally still issues an idempotent DELETE.
  eligibilityFixtureActive = true;
  return frame.evaluate(async () => {
    const runtime = await import("/src/api/runtime.ts");
    const session = runtime.sessionVault.read();
    const userId = session?.user?.userId;
    if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("GENESIS_FIXTURE_USER_ID_MISSING");
    return runtime.apiClient.request({
      path: "/api/genesis/sandbox-fixture",
      method: "POST",
      body: {
        runId: runtime.expectedGenesisSandboxRunId,
        holders: [{ userId, holdings: 20 }],
      },
    });
  });
}

async function clearIneligibleFixture(frame) {
  const result = await frame.evaluate(async () => {
    const runtime = await import("/src/api/runtime.ts");
    return runtime.apiClient.request({
      path: `/api/genesis/sandbox-fixture?runId=${encodeURIComponent(runtime.expectedGenesisSandboxRunId)}`,
      method: "DELETE",
    });
  });
  eligibilityFixtureActive = false;
  return result;
}

async function selectChina(frame, prefix) {
  const current = (await frame.locator(`${prefix}-phone__cc`).textContent())?.trim() || "";
  if (current.includes("+86")) return;
  await frame.locator(`${prefix}-phone__cc`).click();
  await frame.locator(".cc-row").filter({ hasText: "CN" }).first().click();
}

async function fillOtp(frame, selector, code) {
  const inputs = frame.locator(`${selector} input`);
  assert.equal(await inputs.count(), 6, "OTP_INPUT_COUNT_INVALID");
  for (let index = 0; index < 6; index += 1) await inputs.nth(index).fill(code[index]);
}

async function register() {
  await page.goto(`${appBaseUrl}/#/pages/register/register`, { waitUntil: "domcontentloaded" });
  let frame = await waitForFrame(".rg-root");
  await frame.evaluate(async () => (await import("/src/store/locale.ts")).useLocaleStore().setLocale("zh"));
  await selectChina(frame, ".rg");
  await frame.locator(".rg-phone__in input").fill(phone);
  const otpSent = page.waitForResponse((response) => response.request().method() === "POST"
    && safePathname(response.url()) === "/auth/users/register/otp/send");
  await frame.locator(".rg-cta").click();
  assert.equal((await otpSent).status(), 200, "REGISTER_OTP_SEND_FAILED");
  const hint = frame.getByTestId("development-otp-code");
  await hint.waitFor({ state: "visible" });
  const code = (await hint.innerText()).match(/\b(\d{6})\b/)?.[1];
  assert(code, "DEVELOPMENT_OTP_NOT_VISIBLE");
  await fillOtp(frame, ".rg-otp__in", code);
  await frame.locator(".rg-step3").waitFor({ state: "visible" });
  const passwords = frame.locator(".rg-step3 input");
  await passwords.nth(0).fill(password);
  await passwords.nth(1).fill(password);
  const registered = page.waitForResponse((response) => response.request().method() === "POST"
    && safePathname(response.url()) === "/auth/users/register");
  await frame.locator(".rg-cta").click();
  assert.equal((await registered).status(), 200, "REGISTER_COMMIT_FAILED");
  frame = await waitForFrame(".rs-root, .tos-root");
  if (await frame.locator(".tos-root").isVisible().catch(() => false)) {
    const acknowledged = page.waitForResponse((response) => response.request().method() === "POST"
      && safePathname(response.url()) === "/api/legal/terms/acknowledgment");
    await frame.locator(".tos-cta").click();
    assert.equal((await acknowledged).status(), 200, "TERMS_ACK_FAILED");
  }
}

async function relaunch(route) {
  await page.waitForTimeout(3_000);
  await page.goto(`${appBaseUrl}/#${route}`, { waitUntil: "domcontentloaded" }).catch(async (error) => {
    if (!/interrupted by another navigation/.test(String(error))) throw error;
    await page.waitForTimeout(2_000);
    await page.goto(`${appBaseUrl}/#${route}`, { waitUntil: "domcontentloaded" });
  });
  await waitUntil(() => Promise.resolve(appFrame().url().includes(`#${route}`)), `ROUTE_NOT_REACHED:${route}`);
  return waitForFrame(".nx-genesis-dock");
}

try {
  await register();
  let frame = await relaunch("/pages/genesis/genesis");
  await waitUntil(() => Promise.resolve(evidence.genesisResponses.some((entry) => entry.path === "/api/genesis/account" && entry.status === 200)), "GENESIS_ACCOUNT_NOT_200");
  await waitUntil(() => Promise.resolve(evidence.genesisResponses.some((entry) => entry.path === "/api/genesis/eligibility" && entry.status === 200)), "GENESIS_ELIGIBILITY_NOT_200");
  await page.waitForTimeout(2_000);
  evidence.storeProjection = await frame.evaluate(async () => {
    const store = (await import("/src/store/genesis.ts")).useGenesis();
    const runtime = await import("/src/api/runtime.ts");
    return {
      remoteHalted: store.remoteHalted,
      remoteEligibility: store.remoteEligibility,
      soldSlots: store.soldSlots,
      totalSlots: store.totalSlots,
      expectedSandboxRunId: runtime.expectedGenesisSandboxRunId,
    };
  });
  assert.equal(
    evidence.storeProjection.remoteEligibility?.runId,
    evidence.storeProjection.expectedSandboxRunId,
    "GENESIS_SANDBOX_RUN_ID_MISMATCH",
  );
  assert.equal(evidence.storeProjection.remoteEligibility?.sourceEnvironment, "SANDBOX", "GENESIS_FIXTURE_BACKEND_NOT_SANDBOX");
  if (confirmSandboxPurchase) {
    evidence.visibleWalletFixture = prepareVisibleSandboxWallet();
    const walletRefreshed = await frame.evaluate(async () => {
      const app = (await import("/src/store/app.ts")).useApp();
      return app.refreshRemoteFleet();
    });
    assert.equal(walletRefreshed, true, "GENESIS_FIXTURE_VISIBLE_WALLET_REFRESH_FAILED");
  }

  const bodyText = await frame.locator("body").innerText();
  evidence.observedDockText = (await frame.locator(".nx-genesis-dock").innerText()).trim();
  evidence.assertions.cta = bodyText.includes("立即认购");
  evidence.assertions.noLockedCta = !bodyText.includes("查看认购资格");
  const initialSold = evidence.storeProjection.soldSlots;
  const initialTotal = evidence.storeProjection.totalSlots;
  const initialRemaining = initialTotal - initialSold;
  const initialBody = bodyText.replaceAll(",", "");
  evidence.assertions.totalAndSold = new RegExp(`${initialSold}\\s*\\/\\s*${initialTotal}`).test(initialBody);
  evidence.assertions.remaining = new RegExp(`${initialRemaining}\\s*剩余`).test(initialBody);
  evidence.assertions.tierPrices = ["7,999", "9,999", "11,999"].every((price) => bodyText.includes(price));
  assert(evidence.assertions.cta, "CTA_IMMEDIATE_SUBSCRIBE_NOT_VISIBLE");
  assert(evidence.assertions.noLockedCta, "LOCKED_ELIGIBILITY_CTA_STILL_VISIBLE");
  assert(evidence.assertions.totalAndSold, "TOTAL_AND_SOLD_COPY_INVALID");
  assert(evidence.assertions.remaining, "REMAINING_COPY_INVALID");
  assert(evidence.assertions.tierPrices, "TIER_PRICES_NOT_VISIBLE");
  await page.screenshot({ path: path.join(evidenceDir, "5173-创世节点-立即认购.png"), fullPage: true });

  // Use the server-owned, volatile acceptance fixture to produce a real
  // eligibility response with remainingCap=0. This proves the negative account
  // path without buying or writing production Genesis facts.
  evidence.ineligibleBaselineAccount = await genesisAccountSnapshot(frame);

  // Murphy probe: force an exception immediately after fixture installation,
  // then prove the dedicated finally restores the exact account baseline.
  let expectedFixtureFailureCaught = false;
  try {
    await installIneligibleFixture(frame);
    throw new Error("EXPECTED_GENESIS_FIXTURE_FAILURE_PROBE");
  } catch (error) {
    if (!String(error).includes("EXPECTED_GENESIS_FIXTURE_FAILURE_PROBE")) throw error;
    expectedFixtureFailureCaught = true;
  } finally {
    if (eligibilityFixtureActive) await clearIneligibleFixture(frame);
  }
  assert(expectedFixtureFailureCaught, "GENESIS_FIXTURE_FAILURE_PROBE_NOT_CAUGHT");
  evidence.ineligibleFailureProbeReadback = await genesisAccountSnapshot(frame);
  assert.deepEqual(
    evidence.ineligibleFailureProbeReadback,
    evidence.ineligibleBaselineAccount,
    "GENESIS_FIXTURE_FAILURE_PROBE_CLEANUP_MISMATCH",
  );
  evidence.assertions.fixtureFailureCleanup = true;

  await installIneligibleFixture(frame);
  try {
    evidence.ineligibleServerEligibility = await frame.evaluate(async () => {
      const runtime = await import("/src/api/runtime.ts");
      const store = (await import("/src/store/genesis.ts")).useGenesis();
      const serverEligibility = await runtime.genesisApi.eligibility();
      await store.syncRemote();
      return {
        eligible: serverEligibility.eligible,
        remainingCap: serverEligibility.remainingCap,
        sourceEnvironment: serverEligibility.sourceEnvironment,
        runId: serverEligibility.runId,
        storeEligible: store.remoteEligibility?.eligible ?? null,
      };
    });
    assert.deepEqual(evidence.ineligibleServerEligibility, {
      eligible: false,
      remainingCap: 0,
      sourceEnvironment: "SANDBOX",
      runId: evidence.storeProjection.expectedSandboxRunId,
      storeEligible: false,
    }, "GENESIS_SERVER_INELIGIBLE_PROJECTION_INVALID");
    await waitUntil(async () => {
      const projection = await frame.evaluate(async () => {
        const store = (await import("/src/store/genesis.ts")).useGenesis();
        return store.remoteEligibility?.eligible;
      });
      return projection === false;
    }, "GENESIS_INELIGIBLE_PROJECTION_NOT_APPLIED");
    evidence.ineligibleObservedDockText = (await frame.locator(".nx-genesis-dock").innerText()).trim();
    evidence.assertions.ineligibleCtaStillImmediate = evidence.ineligibleObservedDockText.includes("立即认购")
      && !evidence.ineligibleObservedDockText.includes("查看认购资格");
    assert(evidence.assertions.ineligibleCtaStillImmediate, "INELIGIBLE_CTA_CHANGED_COPY");
    await frame.locator(".nx-genesis-dock").click();
    await frame.getByText("认购资格", { exact: true }).waitFor({ state: "visible" });
    evidence.assertions.ineligibleOpensEligibilitySheet = true;
    evidence.assertions.ineligibleDoesNotOpenPurchaseSheet = await frame.getByText("确认认购", { exact: true }).count() === 0;
    assert(evidence.assertions.ineligibleDoesNotOpenPurchaseSheet, "INELIGIBLE_OPENED_PURCHASE_SHEET");
    assert.equal(evidence.purchasePostCount, 0, "INELIGIBLE_CLICK_SENT_PURCHASE_POST");
    await page.screenshot({ path: path.join(evidenceDir, "5173-立即认购-未达资格分流.png"), fullPage: true });
  } finally {
    if (eligibilityFixtureActive) await clearIneligibleFixture(frame);
  }
  evidence.ineligibleFixtureCleanup = await genesisAccountSnapshot(frame);
  assert.deepEqual(
    evidence.ineligibleFixtureCleanup,
    evidence.ineligibleBaselineAccount,
    "GENESIS_INELIGIBLE_FIXTURE_CLEANUP_READBACK_MISMATCH",
  );

  // A hard reload creates a fresh Pinia instance and restores the
  // server-authoritative eligibility before verifying the eligible path.
  await page.reload({ waitUntil: "domcontentloaded" });
  frame = await waitForFrame(".nx-genesis-dock");
  await waitUntil(async () => frame.evaluate(async () => {
    const store = (await import("/src/store/genesis.ts")).useGenesis();
    return store.remoteEligibility?.eligible === true;
  }), "GENESIS_ELIGIBILITY_NOT_RESTORED_AFTER_RELOAD");

  await frame.locator(".nx-genesis-dock").click();
  await frame.locator(".nx-sheet-panel").waitFor({ state: "visible" });
  await frame.getByText("确认认购", { exact: true }).waitFor({ state: "visible" });
  evidence.assertions.purchaseSheetOpened = true;
  await page.screenshot({ path: path.join(evidenceDir, "5173-立即认购-购买确认未提交.png"), fullPage: true });

  await page.waitForTimeout(1_000);
  const acceptanceModal = frame.locator(".uni-modal").filter({ hasText: "Acceptance observation credential" }).first();
  evidence.acceptanceModalVisible = await acceptanceModal.isVisible().catch(() => false);
  if (evidence.acceptanceModalVisible) {
    await acceptanceModal.getByText("确定", { exact: true }).click();
  }
  if (confirmSandboxPurchase) {
    const purchaseResponse = page.waitForResponse((response) => response.request().method() === "POST"
      && safePathname(response.url()) === "/api/genesis/purchase");
    await frame.getByText("确认认购", { exact: true }).click();
    const response = await purchaseResponse;
    const payload = await response.json();
    evidence.confirmedSandboxPurchase = {
      status: response.status(),
      code: payload?.code ?? null,
      message: payload?.message ?? null,
      sourceEnvironment: payload?.data?.sourceEnvironment ?? null,
      runId: payload?.data?.runId ?? null,
      ownedCount: payload?.data?.holdings?.length ?? null,
      orderNo: payload?.data?.orderNo ?? null,
      orderCount: payload?.data?.orders?.length ?? null,
      walletBalanceUsdt: payload?.data?.walletBalanceUsdt ?? null,
    };
    await page.waitForTimeout(1_000);
    evidence.visibleAfterConfirm = await frame.locator("body").innerText();
    assert.equal(response.status(), 200, "SANDBOX_PURCHASE_HTTP_NOT_200");
    assert.equal(payload?.code, 0, "SANDBOX_PURCHASE_ENVELOPE_NOT_SUCCESS");
    assert.equal(payload?.data?.sourceEnvironment, "SANDBOX", "PURCHASE_ESCAPED_SANDBOX_ENVIRONMENT");
    assert.equal(payload?.data?.walletBalanceUsdt,12001,"PURCHASE_VISIBLE_WALLET_RECEIPT_INVALID");
    assert.equal(
      payload?.data?.runId,
      evidence.storeProjection.expectedSandboxRunId,
      "PURCHASE_SANDBOX_RUN_ID_MISMATCH",
    );
    assert(!evidence.visibleAfterConfirm.includes("连不上服务器"), "SANDBOX_PURCHASE_FALSE_SERVER_UNAVAILABLE");
    assert(!evidence.acceptanceModalVisible, "ACCEPTANCE_CREDENTIAL_MODAL_MUST_NOT_BE_USER_VISIBLE");
    const expectedSold = evidence.storeProjection.soldSlots + 1;
    const expectedRemaining = evidence.storeProjection.totalSlots - expectedSold;
    const visibleAfterConfirm = evidence.visibleAfterConfirm.replaceAll(",", "");
    evidence.assertions.sandboxSupplyDecremented = new RegExp(`${expectedSold}\\s*\\/\\s*${evidence.storeProjection.totalSlots}`).test(visibleAfterConfirm)
      && new RegExp(`${expectedRemaining}\\s*剩余`).test(visibleAfterConfirm);
    evidence.sandboxSupply = { beforeSold: evidence.storeProjection.soldSlots, afterSold: expectedSold,
      beforeRemaining: evidence.storeProjection.totalSlots - evidence.storeProjection.soldSlots,
      afterRemaining: expectedRemaining };
    assert(evidence.assertions.sandboxSupplyDecremented, "SANDBOX_VISIBLE_SUPPLY_NOT_DECREMENTED");
    await page.screenshot({ path: path.join(evidenceDir, "5173-创世节点-认购后余量递减.png"), fullPage: true });
    const orderNo = payload?.data?.orderNo;
    assert.equal(typeof orderNo, "string", "SANDBOX_PURCHASE_ORDER_NO_MISSING");
    assert(payload?.data?.orders?.some((order) => order.orderNo === orderNo), "SANDBOX_PURCHASE_ORDER_NOT_IN_ACCOUNT");
    purchasedOrderNo = orderNo;
    purchaseRunId = payload.data.runId;

    await page.goto(`${appBaseUrl}/#/pages/me/wallet`, { waitUntil: "domcontentloaded" });
    await waitUntil(() => Promise.resolve(appFrame().url().includes("#/pages/me/wallet")), "WALLET_ROUTE_NOT_REACHED");
    const walletFrame = await waitForFrame("body");
    await waitUntil(async () => /12,?001(?:\.00)?/.test(await walletFrame.locator("body").innerText()), "GENESIS_WALLET_BALANCE_NOT_VISIBLE");
    evidence.walletPageText = await walletFrame.locator("body").innerText();
    evidence.assertions.walletDebited = /12,?001(?:\.00)?/.test(evidence.walletPageText);
    assert(evidence.assertions.walletDebited,"GENESIS_WALLET_BALANCE_NOT_DEBITED");
    await page.screenshot({ path: path.join(evidenceDir, "5173-钱包-创世节点认购后余额.png"), fullPage: true });

    await page.goto(`${appBaseUrl}/#/pages/me/wallet-bills`, { waitUntil: "domcontentloaded" });
    await waitUntil(() => Promise.resolve(appFrame().url().includes("#/pages/me/wallet-bills")), "WALLET_BILLS_ROUTE_NOT_REACHED");
    const billsFrame = await waitForFrame("body");
    await waitUntil(async () => (await billsFrame.locator("body").innerText()).includes(orderNo), "GENESIS_WALLET_BILL_NOT_VISIBLE");
    evidence.walletBillsPageText = await billsFrame.locator("body").innerText();
    evidence.assertions.billVisible = evidence.walletBillsPageText.includes(orderNo)
      && /7,?999(?:\.00)?/.test(evidence.walletBillsPageText)
      && /12,?001(?:\.00)?/.test(evidence.walletBillsPageText);
    assert(evidence.assertions.billVisible,"GENESIS_WALLET_BILL_ROW_INCOMPLETE");
    await page.screenshot({ path: path.join(evidenceDir, "5173-账单流水-创世节点支出.png"), fullPage: true });

    await page.goto(`${appBaseUrl}/#/pages/store/orders`, { waitUntil: "domcontentloaded" });
    await waitUntil(() => Promise.resolve(appFrame().url().includes("#/pages/store/orders")), "ORDERS_ROUTE_NOT_REACHED");
    const ordersFrame = await waitForFrame("body");
    await waitUntil(async () => (await ordersFrame.locator("body").innerText()).includes(orderNo), "GENESIS_ORDER_NOT_VISIBLE");
    evidence.ordersPageText = await ordersFrame.locator("body").innerText();
    evidence.assertions.orderVisible = evidence.ordersPageText.includes("创世节点")
      && evidence.ordersPageText.includes(orderNo)
      && /数量\s*×\s*1/.test(evidence.ordersPageText)
      && /\$7,999/.test(evidence.ordersPageText);
    assert(evidence.assertions.orderVisible, "GENESIS_ORDER_ROW_INCOMPLETE");
    await page.screenshot({ path: path.join(evidenceDir, "5173-我的订单-创世节点认购记录.png"), fullPage: true });
    evidence.cleanup = cleanupSandboxPurchase();
    const cleanupReadback = await ordersFrame.evaluate(async ({ orderNo: cleanedOrderNo }) => {
      const runtime = await import("/src/api/runtime.ts");
      const account = await runtime.genesisApi.account();
      return {
        soldSupply: account.series.soldSupply,
        remainingSupply: account.series.remainingSupply,
        matchingOrders: account.orders.filter((order) => order.orderNo === cleanedOrderNo).length,
        holdings: account.holdings.length,
      };
    }, { orderNo });
    evidence.cleanup.accountReadback = cleanupReadback;
    assert.equal(cleanupReadback.soldSupply, evidence.storeProjection.soldSlots, "GENESIS_CLEANUP_SOLD_NOT_RESTORED");
    assert.equal(cleanupReadback.remainingSupply, evidence.storeProjection.totalSlots - evidence.storeProjection.soldSlots, "GENESIS_CLEANUP_REMAINING_NOT_RESTORED");
    assert.equal(cleanupReadback.matchingOrders, 0, "GENESIS_CLEANUP_ORDER_STILL_VISIBLE");
    assert.equal(cleanupReadback.holdings, 0, "GENESIS_CLEANUP_HOLDING_REMAINS");
    evidence.cleanup.finalGenesisArtifacts = finalizeSandboxCleanup();
  } else {
    assert.equal(evidence.purchasePostCount, 0, "PURCHASE_POST_MUST_NOT_BE_SENT");
  }
  const after = await readGenesisState();
  evidence.assertions.publicSupplyUnchanged = after.series.totalSupply === 1000
    && after.series.soldSupply === 0
    && after.series.remainingSupply === 1000;
  assert(evidence.assertions.publicSupplyUnchanged, "GENESIS_PUBLIC_SUPPLY_CHANGED_DURING_SANDBOX_PURCHASE");
  assert.equal(after.listings.length, 0, "GENESIS_LISTINGS_CHANGED");
  assert.equal(after.transactions.length, 0, "GENESIS_TRANSACTIONS_CHANGED");
  assert.equal(evidence.runtimeErrors.length, 0, `RUNTIME_ERRORS:${evidence.runtimeErrors.join("|")}`);
  evidence.status = "PASS";
  evidence.publicSupply = { total: 1000, sold: 0, remaining: 1000 };
  fs.writeFileSync(path.join(evidenceDir, "evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
} catch (error) {
  evidence.status = "FAIL";
  evidence.error = String(error?.stack || error);
  fs.writeFileSync(path.join(evidenceDir, "evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  throw error;
} finally {
  if (eligibilityFixtureActive) {
    try {
      const cleanupFrame = page.frames().find((candidate) => candidate !== page.mainFrame()
        && candidate.url().includes("nx_device_inner=1"));
      if (!cleanupFrame) throw new Error("GENESIS_FIXTURE_CLEANUP_FRAME_UNAVAILABLE");
      await clearIneligibleFixture(cleanupFrame);
      evidence.ineligibleFixtureCleanupAfterFailure = true;
    } catch (fixtureCleanupError) {
      evidence.ineligibleFixtureCleanupError = String(fixtureCleanupError?.stack || fixtureCleanupError);
      process.exitCode = 1;
    }
    fs.writeFileSync(path.join(evidenceDir, "evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (purchasedOrderNo) {
    try {
      if (!cleanupComplete) evidence.cleanup = cleanupSandboxPurchase();
      const finalGenesisArtifacts = finalizeSandboxCleanup();
      if (finalGenesisArtifacts) evidence.cleanup.finalGenesisArtifacts = finalGenesisArtifacts;
    } catch (cleanupError) {
      evidence.cleanupError = String(cleanupError?.stack || cleanupError);
    }
    fs.writeFileSync(path.join(evidenceDir, "evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  }
  if (!purchasedOrderNo && purchasedUserId && /^\d+$/.test(purchasedUserId)
      && /^\d+(?:\.\d+)?$/.test(walletBalanceOriginal) && walletVersionAfterSeed >= 0) {
    try {
      const restored = mysqlQuery(`UPDATE nx_user_wallet w JOIN nx_user u ON u.id=w.user_id
 SET w.usdt_available=${walletBalanceOriginal},w.version=w.version+1,w.updated_at=NOW()
 WHERE w.user_id=${purchasedUserId} AND w.sandbox=1 AND w.is_deleted=0
   AND w.version=${walletVersionAfterSeed} AND w.usdt_available=${walletBalanceBeforePurchase}
   AND u.sandbox=1 AND u.is_deleted=0;
SELECT ROW_COUNT();`);
      assert.equal(restored,"1","GENESIS_FIXTURE_FAILURE_RESTORE_CAS_CONFLICT");
      evidence.visibleWalletFixtureRestoredAfterFailure = true;
    } catch (restoreError) {
      evidence.visibleWalletFixtureRestoreError = String(restoreError?.stack || restoreError);
    }
    fs.writeFileSync(path.join(evidenceDir, "evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  }
  await browser.close();
}
