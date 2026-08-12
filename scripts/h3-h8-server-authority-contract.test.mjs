import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("weekly quest UI has no mock dispatch or local reward writes", () => {
  const files = [
    "src/store/weekly-quest.ts",
    "src/components/home/weekly-quest-hero.vue",
    "src/components/home/weekly-quest-list.vue",
  ].map(read).join("\n");
  assert.doesNotMatch(files, /@\/mock\/weekly-quests|postMoneyBillsOnce|markTier|claimTier|claimBonus/);
  assert.match(files, /questApi\.state\(\)/);
  assert.match(files, /authoritative\.status !== "CLAIMED"/);
});

test("H8 card consumes isolated server ledger facts and has an honest empty state", () => {
  const card = read("src/components/team/invite-earn-card.vue");
  const api = read("src/api/referral-reward-api.ts");
  const en = read("src/i18n/messages/en.ts");
  const zh = read("src/i18n/messages/zh.ts");
  assert.doesNotMatch(card, /TICKER_ITEMS|INVITER_REWARD_NEX|INVITER_REWARD_USDT_ESTIMATE|useCommission/);
  assert.match(card, /t\.team\.noSettledRewards/);
  assert.doesNotMatch(card, /No settled invitation rewards yet|暂无已结算的邀请奖励/);
  assert.match(en, /noSettledRewards:\s*"No settled invitation rewards yet"/);
  assert.match(zh, /noSettledRewards:\s*"暂无已结算的邀请奖励"/);
  assert.match(api, /\/api\/app\/referral-rewards\?limit=/);
  assert.match(api, /source === "ledger" && sourceEnvironment === "PRODUCTION"/);
  assert.match(api, /source === "mock" && sourceEnvironment === "SANDBOX"/);
  for (const fact of ["nx_referral_reward_settlement", "nx_wallet_ledger", "nx_earnings_release_entry", "nx_user_wallet"]) {
    assert.match(api, new RegExp(fact));
  }
});
