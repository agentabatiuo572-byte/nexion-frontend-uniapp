#!/usr/bin/env node
// Keep the claim's locked price and the selected SKU's quote bound to its order.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { demoDefaults, demoFixture, demoProducts } from "./lib/prototype-demo-data.mjs";

const origin = "http://localhost";
const state = { ...demoDefaults, trialState: "active", trialPurchaseListState: "device-discounts" };
const trialState = () => demoFixture(new URL("/api/trial/state", origin), "zh", state, { method: () => "GET" });
const purchaseOptions = () => {
  const read = demoFixture(new URL("/api/trial/purchase-options", origin), "zh", state, { method: () => "GET" });
  assert.equal(read.claimNo, claim.claimNo, "list and authority must share the claim");
  const trial = read.options.find(option => option.productNo === trialSku);
  const rack = read.options.find(option => option.productNo === "stellarrack-p1");
  assert.ok(trial?.originalTrialProduct && trial.canPurchase && trial.quote, "missing buyable trial device");
  assert.ok(rack && !rack.originalTrialProduct && rack.canPurchase && rack.quote, "missing buyable Rack P1");
  assert.equal(trial.quoteVersion, trial.quote.quoteVersion);
  assert.equal(rack.quoteVersion, rack.quote.quoteVersion);
  assert.deepEqual(trial.paymentMethods, ["WALLET", "CREGIS_USDT_BSC", "HDPAY_BANK"]);
  assert.deepEqual(rack.paymentMethods, ["WALLET"]);
  return { trial, rack, share: read.options.find(option => option.productNo === "cloud-share") };
};
const claim = trialState();
const trialSku = claim.config.trialProductId;
assert.ok(claim.claimNo && trialSku && claim.quote, "preview has no live trial quote");
const before = purchaseOptions();
assert.equal(Number(before.trial.priceUsdt), Number(claim.quote.priceUsdt));
assert.equal(before.trial.quote.quoteVersion, claim.quote.quoteVersion);
assert.equal(Number(before.trial.quote.discountRate), 15, "the original trial device keeps default discounts");
assert.equal(Number(before.trial.quote.earlyDiscountConfiguredUsdt), 10);
assert.equal(Number(before.rack.quote.earlyDiscountConfiguredUsdt), 0);
assert.equal(before.rack.quote.settlementPolicy, "FULL_TERM_ON_CONVERSION", "zero fixed discount still settles the full term");
assert.equal(Number(before.share?.quote?.discountRate), 0.5, "option rates use wire percentages");
assert.equal(Number(before.share?.quote?.promoDiscountUsdt), 1, "0.5% of the 200 USDT share is 1 USDT");

state.trialPurchasePriceState = "trial-up";
const raisedTrial = purchaseOptions().trial;
assert.notEqual(raisedTrial.storePriceUsdt, before.trial.storePriceUsdt, "fixture must change the trial device's catalog price");
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
      paymentMethod: "WALLET" }),
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
assert.match(detail, /if \(!usePurchaseOptions\.value\) return displayState\.value\?\.quote/,
  "trial detail must preserve the 404 path's claim quote");
assert.match(detail, /if \(purchaseOptionLoading\.value \|\| purchaseOptionsFailed\.value\) \{[^}]*!requested \|\| requested === trialProductId\.value \? displayState\.value\?\.quote[^}]*\}\s*return selectedOption\.value\?\.quote/,
  "trial detail must keep the routed SKU quote or fall back to its own claim only while the list is unavailable");
assert.match(checkout, /trialOptions\.current\.options\.find\(row => row\.productNo === scope\.productNo\)/,
  "checkout must read the routed SKU from the current claim's options");
assert.match(checkout, /trialCheckout\.submit\(\{[\s\S]*?device:\s*\{\s*productNo[\s\S]*?quoteVersion:\s*shown\.quoteVersion/,
  "checkout submission must keep the reviewed SKU and version together");

console.log("PASS trial price parity: claim price survives catalog changes; Rack P1 quote, version and order agree");
