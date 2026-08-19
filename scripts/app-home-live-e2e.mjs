#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const base = process.env.UNI_BASE_URL ?? "http://127.0.0.1:5173";
const screenshot = process.env.APP_HOME_SCREENSHOT ?? "D:/workspace/bug-pic/app-home-final-live.png";
const resultPath = process.env.APP_HOME_E2E_RESULT ?? "D:/workspace/bug-pic/app-home-final-live.json";
const expectedRunId = process.env.APP_HOME_EXPECTED_RUN_ID?.trim() ?? "";
const candidateTree = process.env.APP_HOME_CANDIDATE_TREE?.trim() ?? "";
if (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,95}$/.test(expectedRunId)) {
  throw new Error("APP_HOME_EXPECTED_RUN_ID_REQUIRED");
}
if (!/^[0-9a-f]{40,64}$/.test(candidateTree)) throw new Error("APP_HOME_CANDIDATE_TREE_REQUIRED");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const responses = [];
const consoleErrors = [];
const pageErrors = [];

page.on("response", (response) => {
  const url = response.url();
  if ([
    "/api/config/market/", "/api/content/trust/", "/api/store/catalog",
    "/api/app/home/overview", "/api/config/platform",
  ].some((path) => url.includes(path))) {
    responses.push({ url, status: response.status() });
  }
});
page.on("console", (message) => {
  // Sandbox intentionally returns 503 for the unscoped Home projection; the
  // card's explicit unavailable state is what this probe verifies. Browser
  // resource diagnostics therefore are evidence, not JavaScript failures.
  if (message.type() === "error" && !/Failed to load resource/i.test(message.text())) {
    consoleErrors.push(message.text());
  }
});
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto(`${base}/?nx_device_inner=1#/pages/login/login`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.getByText("Passkey", { exact: true }).click({ timeout: 15_000 });
  await page.waitForTimeout(1_500);
  // The acceptance account may still require the legal-terms screen. The
  // server session already exists after Passkey, so visit Home directly to
  // verify this task without changing the account's legal acceptance state.
  await page.evaluate(() => { location.hash = "#/pages/index/index"; });
  await page.waitForTimeout(5_000);

  // Promotions can open sequentially after the home data resolves. Dismiss
  // every non-mutating overlay so the screenshot proves the home cards rather
  // than a voucher/trial modal; never trigger a claim CTA.
  for (let attempt = 0; attempt < 16; attempt += 1) {
    for (const selector of [".tcs-dismiss", ".vcs-dismiss", ".tcs-close", ".vcs-close"]) {
      const dismiss = page.locator(selector);
      if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
    }
    const milestone = page.locator(".ms-overlay");
    if (await milestone.isVisible().catch(() => false)) {
      await milestone.click({ position: { x: 5, y: 5 } });
    }
    await page.waitForTimeout(250);
  }
  const observationConfirm = page.getByText("确定", { exact: true }).last();
  if (await observationConfirm.isVisible().catch(() => false)) await observationConfirm.click();

  const scroller = page.locator(".nx-scroll");
  await scroller.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await page.waitForTimeout(1_200);
  const body = await page.locator("body").innerText();
  const livePayloads = await page.evaluate(async () => {
    const paths = {
      platform: "/api/config/platform",
      nex: "/api/config/market/nex",
      external: "/api/config/market/external",
      trust: "/api/content/trust/sections/current",
    };
    return Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => {
      const response = await fetch(path);
      return [key, { status: response.status, body: await response.json() }];
    })));
  });
  const platformPayload = livePayloads.platform;
  const publicStats = platformPayload.body?.data?.publicStats;
  const nexMarket = livePayloads.nex.body?.data;
  const externalMarket = livePayloads.external.body?.data;
  await page.screenshot({ path: screenshot, fullPage: true });

  const overviewResponsesBeforeRetry = responses.filter(({ url }) => url.includes("/api/app/home/overview")).length;
  const computeRetry = page.locator('[data-home-action="compute-market-retry"]');
  await computeRetry.focus();
  const keyboardRetryResponse = page.waitForResponse((response) => response.url().includes("/api/app/home/overview"));
  await page.keyboard.press("Space");
  await keyboardRetryResponse;
  const keyboardRetry = responses.filter(({ url }) => url.includes("/api/app/home/overview")).length > overviewResponsesBeforeRetry;

  const externalMarketLink = page.locator('[data-home-action="external-market-link"]');
  await externalMarketLink.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/#\/pages\/market\/market/, { timeout: 10_000 });
  const keyboardLink = /#\/pages\/market\/market/.test(page.url());
  await page.evaluate(() => { location.hash = "#/pages/index/index"; });
  await page.waitForURL(/#\/pages\/index\/index/, { timeout: 10_000 });

  const checks = {
    networkPulse: /网络脉搏|Network pulse|Nhịp mạng/.test(body)
      && body.includes(Number(publicStats?.values?.fleetDevices).toLocaleString())
      && /1\.4\dM/.test(body),
    platformProvenance: platformPayload.status === 200
      && publicStats?.serverCanonical === true
      && publicStats?.sourceEnvironment === "SANDBOX"
      && publicStats?.runId === expectedRunId,
    externalMarket: /外部行情|External market|Thị trường ngoài/.test(body)
      && ["RNDR", "TAO", "AKT", "FIL", "GRT"].every((symbol) => externalMarket?.quotes?.some((quote) => quote.symbol === symbol))
      && externalMarket?.quotes?.length === 5,
    marketProvenance: livePayloads.nex.status === 200 && livePayloads.external.status === 200
      && nexMarket?.serverCanonical === true && externalMarket?.serverCanonical === true
      && nexMarket?.sourceEnvironment === "SANDBOX" && externalMarket?.sourceEnvironment === "SANDBOX"
      && nexMarket?.runId === expectedRunId && externalMarket?.runId === expectedRunId,
    productTrust: /商品信任资料|Product trust profile|Hồ sơ tin cậy sản phẩm/.test(body)
      && body.includes("StellarBox Pro"),
    trustCms: /算力需求支持的 NEX|Demand-backed NEX/.test(body) && body.includes("$128.4M"),
    computeMarketTerminal: /算力市场|Compute market|Thị trường tính toán/.test(body)
      && /暂不可用|Unavailable|unavailable|không khả dụng|重试|Retry|Thử lại/.test(body),
    warrantyIsNotInvented: /待后台配置|Not configured|Chưa cấu hình/.test(body),
    keyboardRetry,
    keyboardLink,
    endpointStatuses: livePayloads.platform.status === 200
      && livePayloads.trust.status === 200
      && responses.some(({ url, status }) => url.includes("/api/store/catalog") && status === 200)
      && responses.some(({ url, status }) => url.includes("/api/app/home/overview") && status === 503),
  };
  const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  const result = {
    executedAt: new Date().toISOString(),
    candidateTree,
    url: page.url(),
    checks,
    publicStats: {
      fleetDevices: publicStats?.values?.fleetDevices,
      registeredUsersBase: publicStats?.values?.registeredUsersBase,
      serverCanonical: publicStats?.serverCanonical,
      sourceEnvironment: publicStats?.sourceEnvironment,
      runId: publicStats?.runId,
    },
    market: {
      nexRunId: nexMarket?.runId,
      externalRunId: externalMarket?.runId,
      externalSymbols: externalMarket?.quotes?.map((quote) => quote.symbol),
    },
    responses,
    coverageScope: "authenticated-home-data-only",
    consoleErrors,
    pageErrors,
    screenshot,
  };
  await mkdir(dirname(resultPath), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (failures.length || consoleErrors.length || pageErrors.length) {
    throw new Error(`APP_HOME_LIVE_E2E_FAILED:${[...failures, ...consoleErrors, ...pageErrors].join("|")}`);
  }
} finally {
  await browser.close();
}
