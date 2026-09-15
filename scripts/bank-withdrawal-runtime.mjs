import assert from "node:assert/strict";

/** Runs only inside the existing isolated withdrawal browser harness. No live payment endpoint is contacted. */
export async function verifyBankWithdrawalPage(page, gotoProtected) {
  await page.evaluate(async () => {
    const rt = await import("/src/api/runtime.ts");
    const { ApiError } = await import("/src/api/errors.ts");
    const app = (await import("/src/store/app.ts")).useApp();
    const quote = { quoteNo: `BQ-${"a".repeat(32)}`, amountUsdt: 100, feeUsdt: 1, netUsdt: 99, rateVnd: 25000,
      amountVnd: 2475000, bankCode: "VCB", bankName: "Vietcombank", maskedAccount: "******6789", expiresAt: new Date(Date.now()+300000).toISOString() };
    const fixture = { status: "SENT", providerState: "PENDING", submits: 0, abandons: 0, enabled: true, key: `nexgrid.bank-withdraw.pending:${app.accountKey}` };
    window.__bankFixture = fixture;
    window.__bankRestore = rt.apiClient.request;
    const receipt = () => ({ state: "COMMITTED", withdrawalNo: "WD-BANKTEST123", providerState: fixture.providerState,
      withdrawal: { withdrawalNo: "WD-BANKTEST123", chain: "BANK-VND", status: fixture.status }, bank: quote });
    rt.apiClient.request = async request => {
      if (request.path === "/api/withdrawals/bank/config") return { enabled: fixture.enabled, banks: [{code:"VCB",name:"Vietcombank"}],
        beneficiary: { bankCode:"VCB",bankName:"Vietcombank",maskedAccount:"******6789",effectiveAt:"2026-09-01T00:00:00Z",nextChangeAt:"2026-09-08T00:00:00Z" } };
      if (request.path === "/api/withdrawals/bank/quotes") { assertAmount(request.body.amountUsdt); return quote; }
      if (request.path === "/api/withdrawals/bank/orders") {
        fixture.submits++;
        if (request.idempotencyKey !== `bank-submit:${quote.quoteNo}` || uni.getStorageSync(fixture.key) !== quote.quoteNo) throw new Error("BANK_RECOVERY_REFERENCE_NOT_DURABLE");
        throw new ApiError({kind:"network",message:"FIXTURE_RESPONSE_LOST",retryable:true});
      }
      if (request.path === `/api/withdrawals/bank/quotes/${quote.quoteNo}/abandon`) { fixture.abandons++; return {state:"ABANDONED"}; }
      if (request.path === `/api/withdrawals/bank/quotes/${quote.quoteNo}` || request.path === "/api/withdrawals/bank/orders/WD-BANKTEST123") return receipt();
      throw new ApiError({kind:"network",message:"NO_BACKEND_IN_GATE",retryable:true});
    };
    function assertAmount(amount) { if (amount !== "100") throw new Error("BANK_AMOUNT_INPUT_NOT_WIRED"); }
  });
  try {
    assert.equal((await gotoProtected("/pages/me/wallet-withdraw-bank")).landed,true);
    await page.locator('[data-testid="bank-amount"] input').fill("100");
    await page.locator('[data-testid="bank-quote"]').click();
    await page.locator('[data-testid="bank-submit"]').waitFor();
    assert.match(await page.locator(".bank-withdraw").innerText(),/2[,.]475[,.]000/);
    await page.locator('[data-testid="bank-submit"]').click();
    await page.waitForFunction(() => window.__bankFixture.submits === 1);
    // Uncertain submissions hide the form entirely; only readback / abandon remain available.
    await page.locator('[data-testid="bank-submit"]').waitFor({state:"hidden"});
    const pending = await page.evaluate(() => uni.getStorageSync(window.__bankFixture.key));
    assert.equal(pending,`BQ-${"a".repeat(32)}`);
    await page.locator('[data-testid="bank-refresh"]').click();
    await page.locator('[data-testid="bank-order-status"]').waitFor();
    assert.match(await page.locator('[data-testid="bank-order-status"]').innerText(),/processing|处理中|đang/i);
    assert.equal(await page.locator('[data-testid="bank-new"]').count(),0);
    assert.equal(await page.evaluate(() => window.__bankFixture.submits),1);
    await page.evaluate(() => { window.__bankFixture.status="CONFIRMED";window.__bankFixture.providerState="PAID"; });
    await page.locator('[data-testid="bank-refresh"]').click();
    await page.locator('[data-testid="bank-new"]').waitFor();
    await page.locator('[data-testid="bank-new"]').click();
    await page.locator('[data-testid="bank-amount"] input').fill("100");
    await page.locator('[data-testid="bank-quote"]').click();
    await page.locator('[data-testid="bank-abandon"]').click();
    await page.locator('[data-testid="bank-amount"] input').waitFor();
    assert.equal(await page.evaluate(() => window.__bankFixture.abandons),1);
    assert.equal(await page.evaluate(() => window.__bankFixture.submits),1);
    await page.evaluate(() => { window.__bankFixture.enabled=false; });
    await page.locator('[data-testid="bank-refresh"]').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="bank-quote"]')?.getAttribute("aria-disabled") === "true"
      || document.querySelector('[data-testid="bank-quote"]')?.getAttribute("disabled") != null);
    console.log("PASS bank withdrawal real page: quote, lost response recovery without resubmit, pending vs paid, abandon, closed gate");
  } finally {
    await page.evaluate(async () => {
      const rt = await import("/src/api/runtime.ts"); rt.apiClient.request=window.__bankRestore;
      uni.removeStorageSync(window.__bankFixture.key); delete window.__bankRestore; delete window.__bankFixture;
    });
  }
}
