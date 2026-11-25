#!/usr/bin/env node
// Keep the claim's locked price and the selected SKU's quote bound to its order.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { demoDefaults, demoFixture, demoProducts } from "./lib/prototype-demo-data.mjs";

const origin = "http://localhost";
const state = { ...demoDefaults, trialState: "active", trialPurchaseListState: "five" };
const trialState = () => demoFixture(new URL("/api/trial/state", origin), "zh", state, { method: () => "GET" });
const purchaseOptions = () => {
  const read = demoFixture(new URL("/api/trial/purchase-options", origin), "zh", state, { method: () => "GET" });
  assert.equal(read.claimNo, claim.claimNo, "list and authority must share the claim");
  const trial = read.options.find(option => option.productNo === trialSku);
  const rack = read.options.find(option => option.productNo === "stellarrack-p1");
  assert.ok(trial?.isTrialProduct && trial.canBuy && trial.quote, "missing buyable trial device");
  assert.ok(rack && !rack.isTrialProduct && rack.canBuy && rack.quote, "missing buyable Rack P1");
  return { trial, rack };
};
const claim = trialState();
const trialSku = claim.config.trialProductId;
assert.ok(claim.claimNo && trialSku && claim.quote, "preview has no live trial quote");
const before = purchaseOptions();
assert.equal(Number(before.trial.priceUsdt), Number(claim.quote.priceUsdt));
assert.equal(before.trial.quote.quoteVersion, claim.quote.quoteVersion);

state.trialPurchasePriceState = "trial-up";
const raisedTrial = purchaseOptions().trial;
assert.notEqual(raisedTrial.marketPriceUsdt, before.trial.marketPriceUsdt, "fixture must change the trial device's catalog price");
assert.equal(raisedTrial.priceUsdt, before.trial.priceUsdt, "trial device must keep its locked price");
assert.equal(Number(raisedTrial.quote.priceUsdt), Number(trialState().quote.priceUsdt));
assert.equal(raisedTrial.quote.quoteVersion, before.trial.quote.quoteVersion, "catalog change must not reprice the claim");

state.trialPurchasePriceState = "extra-up";
const { trial, rack } = purchaseOptions();
const rackProduct = demoProducts(state, origin).find(product => product.id === rack.productNo);
assert.equal(trial.priceUsdt, before.trial.priceUsdt);
assert.ok(rackProduct && Number(rack.priceUsdt) > Number(before.rack.priceUsdt), "fixture must reprice Rack P1");
assert.equal(Number(rack.priceUsdt), rackProduct.price);
assert.equal(Number(rack.quote.priceUsdt), rackProduct.price);
assert.notEqual(rack.quote.quoteVersion, before.rack.quote.quoteVersion);

function submit(productNo, quote, key) {
  const amountCents = (BigInt(quote.amountUsdt.replace(".", "")) + 5000n) / 10000n;
  return demoFixture(new URL("/api/trial/convert", origin), "zh", state, {
    method: () => "POST",
    headers: () => ({ "idempotency-key": key }),
    walletAuthorized: true,
    postDataJSON: () => ({ productNo, quoteVersion: quote.quoteVersion, expectedAmountUsdt: Number(amountCents) / 100,
      paymentMethod: "UVEL_USDT_WALLET" }),
  });
}
assert.throws(() => submit(rack.productNo, trial.quote, "parity-mismatch"),
  error => error.status === 409 && error.message === "TRIAL_QUOTE_CHANGED", "a different SKU's quote cannot settle Rack P1");
const receipt = submit(rack.productNo, rack.quote, "parity-confirmed");
const order = state.createdOrders?.find(order => order.orderNo === receipt.orderNo);
assert.equal(receipt.productNo, rack.productNo);
assert.ok(Number(receipt.amountUsdt) <= Number(rack.quote.amountUsdt), "accrual can only reduce the confirmed amount");
assert.equal(Number(receipt.amountUsdt), order?.amountUsdt);
assert.equal(state.lastTrialConversion?.serverQuoteVersion, rack.quote.quoteVersion);
assert.equal(order?.lineItems[0]?.sku, rack.productNo);
assert.equal(order?.lineItems[0]?.unitPriceUsdt, Number(rack.quote.priceUsdt));

const detail = readFileSync(new URL("../src/pages/me/trial.vue", import.meta.url), "utf8");
const checkout = readFileSync(new URL("../src/pages/store/checkout.vue", import.meta.url), "utf8");
assert.match(detail, /if \(!usePurchaseOptions\.value\) return displayState\.value\?\.quote[^\n]*\n[^\n]*selectedOption\.value\?\.quote/,
  "trial detail must use the selected SKU quote and only fall back on the legacy path");
assert.match(checkout, /trialOptions\.current\.options\.find\(row => row\.productNo === scope\.productNo\)/,
  "checkout must read the routed SKU from the current claim's options");
assert.match(checkout, /trialCheckout\.submit\(\{[\s\S]*?device:\s*\{\s*productNo[\s\S]*?quoteVersion:\s*shown\.quoteVersion/,
  "checkout submission must keep the reviewed SKU and version together");

console.log("PASS trial price parity: claim price survives catalog changes; Rack P1 quote, version and order agree");
