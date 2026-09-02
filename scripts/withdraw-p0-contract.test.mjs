import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relative) => readFileSync(new URL(relative, root), "utf8");

test("withdrawal parser accepts backend strong-review route as manual", () => {
  const source = read("src/api/withdrawal-api.ts");
  assert.match(source, /case\s+"strong-review"\s*:\s*return\s+"manual"/);
});

test("server-backed withdrawal refresh is account-generation safe", () => {
  const source = read("src/store/app.ts");
  assert.match(source, /if\s*\(!remoteApiEnabled\) return \[\]/);
  assert.match(source, /const\s+expectedAccountKey\s*=\s*accountKey\.value/);
  assert.match(source, /expectedAccountKey\s*!==\s*accountKey\.value/);
  assert.match(source, /nexRefundedChanged|remote\.nexRefunded/);
});

test("address policy is server-projected instead of a local zero fallback", () => {
  const api = read("src/api/payout-address-api.ts");
  const page = read("src/pages/me/wallet-address-rebind.vue");
  assert.match(api, /changeCooldownDays/);
  assert.match(page, /payout\.[A-Za-z]*changeCooldownDays|nextChangeAllowedAt/);
  assert.doesNotMatch(page, /remote[A-Za-z]*\s*\?\?\s*0/);
});

test("risk disclosure and withdrawal pages consume the remote policy contract", () => {
  const disclosure = read("src/pages/me/risk-disclosure.vue");
  const withdraw = read("src/pages/me/wallet-withdraw.vue");
  assert.match(disclosure, /withdrawalApi\.policy\(\)/);
  assert.match(withdraw, /withdrawalApi\.policy\(\)/);
  assert.match(withdraw, /smallAmountThresholdUsd/);
});

test("risk disclosure keeps the two-step gate usable across H5 and App webviews", () => {
  const disclosure = read("src/pages/me/risk-disclosure.vue");

  // `scrolltolower` is the uni-app native path. The sentinel observer is the
  // H5/iOS-chassis fallback required by PRD 11.4a and P-019; either path may
  // mark the document as read, but neither may tick the acknowledgement.
  assert.match(disclosure, /@scrolltolower="onScrollToLower"/);
  assert.match(disclosure, /ref="sentinelRef"/);
  assert.match(disclosure, /new IntersectionObserver/);
  assert.match(disclosure, /\$el\s+instanceof\s+Element/);
  assert.match(disclosure, /observer\?\.disconnect\(\)/);
  assert.match(disclosure, /if\s*\(!disclosure\.value\)\s*return/);
  assert.match(disclosure, /async\s+function\s+reload\(\)[\s\S]*scrolledToBottom\.value\s*=\s*false[\s\S]*checked\.value\s*=\s*false[\s\S]*startBottomObserver\(\)/);

  // The legal acknowledgement remains a deliberate second action. The CTA
  // must not silently no-op when one of the two prerequisites is missing.
  assert.match(disclosure, /scrolledToBottom\.value\s*&&\s*checked\.value/);
  assert.match(disclosure, /if\s*\(!scrolledToBottom\.value\)/);
  assert.match(disclosure, /if\s*\(!checked\.value\)/);
  assert.match(disclosure, /@keydown\.enter\.prevent="toggleCheck"/);
  assert.match(disclosure, /@keydown\.space\.prevent="toggleCheck"/);
  assert.match(disclosure, /@keydown\.enter\.prevent="onAccept"/);
  assert.match(disclosure, /@keydown\.space\.prevent="onAccept"/);
});
