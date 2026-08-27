import assert from "node:assert/strict";
import test from "node:test";

const backendBaseUrl = process.env.NX_GENESIS_BACKEND_URL || "http://127.0.0.1:8110";

test("Genesis production data matches the approved 5174 baseline without fake purchases", async () => {
  const response = await fetch(`${backendBaseUrl}/api/genesis/state`);
  assert.equal(response.status, 200, "GENESIS_STATE_HTTP_NOT_200");

  const payload = await response.json();
  assert.equal(payload.code, 0, "GENESIS_STATE_API_FAILED");
  const state = payload.data;

  assert.equal(state.serverCanonical, true, "GENESIS_NOT_SERVER_CANONICAL");
  assert.equal(state.sourceEnvironment, "PRODUCTION", "GENESIS_NOT_PRODUCTION");
  assert.deepEqual(
    {
      totalSupply: state.series.totalSupply,
      soldSupply: state.series.soldSupply,
      remainingSupply: state.series.remainingSupply,
      priceUsdt: state.series.priceUsdt,
      royaltyPct: state.series.royaltyPct,
      dailyEmissionRatePct: state.series.dailyEmissionRatePct,
    },
    {
      totalSupply: 1_000,
      soldSupply: 0,
      remainingSupply: 1_000,
      priceUsdt: 9_999,
      royaltyPct: 2.5,
      dailyEmissionRatePct: 0.1,
    },
  );

  assert.deepEqual(
    state.tiers.map(({ from, to, priceUSDT }) => ({ from, to, priceUSDT })),
    [
      { from: 0, to: 100, priceUSDT: 7_999 },
      { from: 100, to: 550, priceUSDT: 9_999 },
      { from: 550, to: 1_000, priceUSDT: 11_999 },
    ],
    "GENESIS_TIERS_DO_NOT_MATCH_5174",
  );

  assert.deepEqual(
    {
      marketOpenState: state.marketOpenState,
      marketEnabled: state.market.enabled,
      eligibilityEnabled: state.sale.eligibilityEnabled,
      available: state.sale.available,
      open: state.sale.open,
      maxPerUser: state.sale.maxPerUser,
      minAccountAgeDays: state.sale.minAccountAgeDays,
      presaleEnabled: state.sale.presaleEnabled,
      showCountdown: state.sale.showCountdown,
      unitPriceUsdt: state.sale.unitPriceUsdt,
    },
    {
      marketOpenState: "open",
      marketEnabled: true,
      eligibilityEnabled: true,
      available: true,
      open: true,
      maxPerUser: 5,
      minAccountAgeDays: 0,
      presaleEnabled: false,
      // The stored 5174 preference is true, but public state deliberately
      // suppresses countdowns while presale itself is disabled.
      showCountdown: false,
      unitPriceUsdt: 9_999,
    },
  );

  assert.deepEqual(state.listings, [], "GENESIS_FAKE_LISTINGS_PRESENT");
  assert.deepEqual(state.transactions, [], "GENESIS_FAKE_TRANSACTIONS_PRESENT");
  assert.equal(state.marketStats.owners, 0, "GENESIS_FAKE_OWNER_PRESENT");
  assert.equal(state.marketStats.volume24hUsdt, 0, "GENESIS_FAKE_VOLUME_PRESENT");
});
