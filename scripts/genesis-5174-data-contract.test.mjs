import assert from "node:assert/strict";
import test from "node:test";

const backendBaseUrl = process.env.NX_GENESIS_BACKEND_URL || "http://127.0.0.1:8110";

test("Genesis production data keeps the approved 5174 policy while sales remain server-owned", async () => {
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
      priceUsdt: state.series.priceUsdt,
      royaltyPct: state.series.royaltyPct,
      dailyEmissionRatePct: state.series.dailyEmissionRatePct,
    },
    {
      totalSupply: 1_000,
      priceUsdt: 9_999,
      royaltyPct: 2.5,
      dailyEmissionRatePct: 0.1,
    },
  );
  assert.ok(Number.isSafeInteger(state.series.soldSupply) && state.series.soldSupply >= 0);
  assert.equal(state.series.remainingSupply, state.series.totalSupply - state.series.soldSupply);

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

  assert.ok(state.sources.includes("nx_genesis_holding"), "GENESIS_HOLDING_SOURCE_MISSING");
  assert.ok(state.sources.includes("nx_genesis_order"), "GENESIS_ORDER_SOURCE_MISSING");
  for (const transaction of state.transactions) {
    assert.match(transaction.orderNo, /\S/);
    assert.ok(["PRIMARY", "SECONDARY"].includes(transaction.orderType));
    assert.ok(Number.isSafeInteger(transaction.quantity) && transaction.quantity > 0);
    assert.ok(Number.isFinite(transaction.amountUsdt) && transaction.amountUsdt > 0);
  }
  assert.ok(Number.isSafeInteger(state.marketStats.owners) && state.marketStats.owners >= 0);
  assert.ok(Number.isFinite(state.marketStats.volume24hUsdt) && state.marketStats.volume24hUsdt >= 0);
});
