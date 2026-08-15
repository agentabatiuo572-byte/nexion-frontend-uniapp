import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("account scope exposes the shared request fence and advances it on rebind", () => {
  const scope = read("src/lib/account-scope.ts");
  assert.match(scope, /createRemoteAccountEpoch/);
  assert.match(scope, /captureAccountScope/);
  assert.match(scope, /isCurrentAccountScope/);
  assert.match(scope, /remoteAccountScope\.bind\(accountKey\)/);
});

test("a late checkout eligibility or capacity response cannot open account B's sheet", () => {
  const checkout = read("src/pages/store/checkout.vue");
  const intercept = checkout.slice(checkout.indexOf("function fireTradeinIntercept"));
  assert.match(checkout, /const requestScope = captureAccountScope\(\);/);
  assert.match(checkout, /Promise\.all\(\[[\s\S]{0,260}isCurrentAccountScope\(requestScope\)/);
  assert.ok(intercept.indexOf("if (!isCurrentAccountScope(requestScope)) return;")
    < intercept.indexOf("tradein.showChoice"));
  assert.ok(intercept.indexOf("if (!isCurrentAccountScope(requestScope)) return;")
    < intercept.indexOf("tradein.showCanonicalReplace"));
  assert.match(checkout, /catch\(\(\) => \{\s*if \(!isCurrentAccountScope\(requestScope\)\) return;/);
});

test("a late trade-in eligibility or quote response cannot write account B's canonical quote", () => {
  const sheets = read("src/components/tradein-sheets.vue");
  assert.match(sheets, /const requestScope = captureAccountScope\(\);/);
  assert.match(sheets, /deviceE3Api\.eligibility\(targetKind\)[\s\S]{0,180}isCurrentAccountScope\(requestScope\)/);
  assert.match(sheets, /deviceE3Api\.quote\(Number\(oldDevice\.id\), targetKind\)[\s\S]{0,180}isCurrentAccountScope\(requestScope\)/);
  assert.match(sheets, /isCurrentAccountScope\(requestScope\)[\s\S]{0,100}canonicalQuote\.value = null/);
  assert.match(sheets, /capacityQuote\(s\.targetKind\)[\s\S]{0,180}isCurrentAccountScope\(requestScope\)/);
});
