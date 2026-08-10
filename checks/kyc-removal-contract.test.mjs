import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const activeFiles = [
  "src/App.vue",
  "src/api/account-api.ts",
  "src/api/exchange-api.ts",
  "src/composables/use-remote-account-state.ts",
  "src/mock/faq.ts",
  "src/mock/tickets.ts",
  "src/pages/me/help.vue",
  "src/pages/me/wallet-topup.vue",
  "src/pages/me/wallet-withdraw.vue",
  "src/pages/me/wallet-exchange.vue",
];

test("official app has no active KYC route, gate, ticket, API, or copy", () => {
  for (const path of activeFiles) {
    const source = fs.readFileSync(path, "utf8").toLowerCase();
    assert.equal(source.includes("kyc"), false, path);
  }
});
