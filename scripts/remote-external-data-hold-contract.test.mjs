import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("remote market renders only server NEX data and fails closed for external comparables", async () => {
  const page = await read("src/pages/market/market.vue");
  assert.match(page, /const nex = computed\(\(\) => market\.isMockMode \? NEX :/);
  assert.match(page, /<template v-if="market\.isMockMode">[\s\S]*?EXCHANGE LISTINGS[\s\S]*?TOKEN LIST[\s\S]*?<\/template>/);
  assert.match(page, /v-else data-testid="market-comparables-hold"/);
  assert.match(page, /comparablesHoldTitle/);
  assert.match(page, /comparablesHoldBody/);
  assert.match(page, /uni\.navigateTo\(\{ url: "\/pages\/me\/wallet-exchange"/);
});

test("remote transaction details never render locally derived chain facts", async () => {
  const page = await read("src/pages/tx/hash.vue");
  assert.match(page, /v-if="remoteApiEnabled"[\s\S]*?data-testid="tx-detail-hold"/);
  assert.match(page, /detailUnavailableTitle/);
  assert.match(page, /detailUnavailableBody/);
  assert.match(page, /<template v-else>[\s\S]*?blockNumber[\s\S]*?confirmations[\s\S]*?fromAddr[\s\S]*?gasLine[\s\S]*?<\/template>/);
});

test("all supported languages explain the authoritative-data HOLD", async () => {
  const files = await Promise.all([
    read("src/i18n/messages/en.ts"),
    read("src/i18n/messages/zh.ts"),
    read("src/i18n/messages/vi.ts"),
  ]);
  for (const source of files) {
    assert.match(source, /comparablesHoldTitle:/);
    assert.match(source, /comparablesHoldBody:/);
    assert.match(source, /detailUnavailableTitle:/);
    assert.match(source, /detailUnavailableBody:/);
  }
});
