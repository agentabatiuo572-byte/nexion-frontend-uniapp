import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const api = fs.readFileSync(new URL("../src/api/withdrawal-api.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../src/pages/me/wallet-withdraw.vue", import.meta.url), "utf8");

test("D5 policy requires the server-owned small amount and payout SLA fields", () => {
  assert.match(api, /smallAmountThresholdUsd:\s*number/);
  assert.match(api, /payoutSlaHours:\s*number/);
  assert.match(api, /const smallAmountThresholdUsd = number\(row\?\.smallAmountThresholdUsd\)/);
  assert.match(api, /const payoutSlaHours = number\(row\?\.payoutSlaHours/);
  assert.match(api, /smallAmountThresholdUsd === null/);
  assert.match(api, /payoutSlaHours === null/);
});

test("withdraw flow keeps WD01 fast-lane HOLD and never consumes local defaults", () => {
  assert.match(page, /const smallAmountLine = computed\(\(\) => 0\)/);
  assert.doesNotMatch(page, /cfg\.config\.withdrawRules\.smallAmountThresholdUsd/);
  assert.doesNotMatch(page, /withdrawalPolicy\.value\?\.smallAmountThresholdUsd/);
});
