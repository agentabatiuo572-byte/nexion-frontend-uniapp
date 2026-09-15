import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** Isolated browser transport fixture; no real SMS, binding, bank, or payment request is sent. */
export async function verifyBankBindingPage(page, gotoProtected) {
  await page.evaluate(async () => {
    const rt = await import("/src/api/runtime.ts");
    const { ApiError } = await import("/src/api/errors.ts");
    const fixture = { beneficiary: null, binds: [], otps: 0, loseResponse: false, loadFails: false, supported: true };
    window.__bindingFixture = fixture; window.__bindingRestore = rt.apiClient.request;
    rt.apiClient.request = async request => {
      if (request.path === "/api/withdrawals/bank/config") {
        if (fixture.loadFails) throw new ApiError({kind:"network",message:"FIXTURE_OFFLINE"});
        return {enabled:false,banks:[],bankCodeRequired:!fixture.supported,bindingOtpRequired:!fixture.supported,payType:"BANKQR",beneficiary:fixture.beneficiary};
      }
      if (request.path === "/api/withdrawals/bank/beneficiary/otp") { fixture.otps++; throw new Error("BANK_BINDING_MUST_NOT_SEND_OTP"); }
      if (request.path === "/api/withdrawals/bank/beneficiary") {
        fixture.binds.push({body:request.body,key:request.idempotencyKey});
        if (Object.keys(request.body).sort().join(",")!=="account,bankCode,holder" || request.body.account!=="00123456789" || request.body.bankCode!=="") throw new Error("BANK_BINDING_FIELD_MAPPING_INVALID");
        fixture.beneficiary = {bankCode:"",bankName:"BANKQR",maskedAccount:"****6789",
          effectiveAt:new Date(Date.now()+86400000).toISOString(),nextChangeAt:new Date(Date.now()+604800000).toISOString()};
        if(fixture.loseResponse) { fixture.loseResponse=false; throw new ApiError({kind:"network",message:"FIXTURE_LOST_RESPONSE"}); }
        return {beneficiary:fixture.beneficiary};
      }
      throw new ApiError({kind:"network",message:"NO_BACKEND_IN_GATE"});
    };
  });
  const artifact = path.resolve(".verify-cache/bank-binding"); fs.mkdirSync(artifact,{recursive:true});
  try {
    assert.equal((await gotoProtected("/pages/me/wallet-cards")).landed,true);
    await page.waitForURL(url=>url.hash.split("?")[0]==="#/pages/me/wallet-cards-new");
    await page.getByTestId("bank-account-binding").waitFor();
    await page.evaluate(async () => { const theme=(await import("/src/store/theme.ts")).useTheme(); theme.setMode("dark"); });
    const account=page.locator('[data-testid="bank-account"] input'), holder=page.locator('[data-testid="bank-holder"] input');
    const submit=page.getByTestId("bank-bind-continue");
    assert.equal(await page.locator('[data-testid="bank-expiry"] input').isEditable(),false);
    assert.equal(await page.locator('[data-testid="bank-cvv"] input').isEditable(),false);
    assert.equal(await submit.getAttribute("aria-disabled"),"true");
    assert.equal(await page.locator('[data-testid="card-simulation-badge"], [data-testid="bank-select"], [data-testid="bank-otp"]').count(),0);
    await account.fill("00123456789"); await holder.fill("NGUYEN VAN A");
    await page.waitForFunction(()=>document.querySelector('[data-testid="bank-bind-continue"]')?.getAttribute("aria-disabled")==="false");
    await page.screenshot({path:path.join(artifact,"bank-form.png"),fullPage:true});
    await page.evaluate(()=>{window.__bindingFixture.loseResponse=true;});
    await submit.press("Enter");
    await page.waitForFunction(()=>window.__bindingFixture.binds.length===1);
    await page.locator(".error-note").waitFor();
    assert.equal(await account.isEditable(),false);
    assert.equal(await page.getByRole("dialog").count(),0);
    await submit.press("Enter");
    await page.getByTestId("bank-bind-saved").waitFor();
    await page.waitForFunction(()=>document.activeElement?.getAttribute('data-testid')==='bank-bind-done');
    const calls=await page.evaluate(()=>window.__bindingFixture.binds);
    assert.equal(calls.length,2); assert.deepEqual(calls[0],calls[1]);
    assert.equal(await account.count(),0);
    assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes("00123456789") || JSON.stringify(localStorage).includes("NGUYEN VAN A")),false);
    // Re-entry reads the saved account and enforces server cooldown, even without OTP.
    await gotoProtected("/pages/me/wallet"); await gotoProtected("/pages/me/wallet-cards-new");
    await page.locator(".bound-summary").waitFor(); assert.equal(await account.isEditable(),false);
    await submit.press("Enter"); assert.equal(await page.evaluate(()=>window.__bindingFixture.binds.length),2);
    // An old server must not allow incompatible direct binding. Empty bank choices alone do not block BANKQR.
    await gotoProtected("/pages/me/wallet"); await page.evaluate(()=>{window.__bindingFixture.beneficiary=null;window.__bindingFixture.supported=false;});
    await gotoProtected("/pages/me/wallet-cards-new"); await page.locator(".error-note").waitFor();
    await account.fill("00123456789"); await holder.fill("NGUYEN VAN A");
    assert.equal(await submit.getAttribute("aria-disabled"),"true");
    await gotoProtected("/pages/me/wallet"); await page.evaluate(()=>{window.__bindingFixture.supported=true;window.__bindingFixture.loadFails=true;});
    await gotoProtected("/pages/me/wallet-cards-new"); await page.locator(".error-note").waitFor();
    await account.fill("00123456789"); await holder.fill("NGUYEN VAN A");
    assert.equal(await submit.getAttribute("aria-disabled"),"true");
    await gotoProtected("/pages/me/wallet"); await gotoProtected("/pages/me/wallet-cards-new");
    assert.equal(await account.inputValue(),""); assert.equal(await holder.inputValue(),"");
    assert.equal(await page.evaluate(()=>window.__bindingFixture.otps),0);
    await page.setViewportSize({width:320,height:740});
    assert.equal(await page.evaluate(()=>document.scrollingElement.scrollWidth>document.scrollingElement.clientWidth+1),false);
    console.log("PASS bank binding actual page: no bank selector or OTP, direct account/holder submission, no expiry/CVV collection, same-request recovery, confirmed readback, cooldown, old-server/offline safety and draft cleanup");
  } finally {
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(async()=>{const rt=await import("/src/api/runtime.ts");rt.apiClient.request=window.__bindingRestore;delete window.__bindingRestore;delete window.__bindingFixture;});
  }
}
