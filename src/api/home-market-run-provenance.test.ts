import { describe, expect, it } from "vitest";
import { parseNexMarketSnapshot } from "./market-api";

const RUN = "home-market-run-20260819";
const snapshot = {
  asset: "NEX",
  currency: "USDT",
  serverCanonical: true,
  source: "mock",
  sourceEnvironment: "SANDBOX",
  runId: RUN,
  currentPrice: 0.125,
  costBasis: 0.085,
  sparkline: [0.113, 0.117, 0.121, 0.125, 0.129, 0.126, 0.125],
  history24h: [{ price: 0.125, sampledAt: "2026-08-19 13:33:00" }],
};

describe("Home NEX market Run provenance", () => {
  it("keeps removed Sandbox market data closed", () => {
    expect(() => parseNexMarketSnapshot(snapshot, "dev")).toThrow("NEX_MARKET_RESPONSE_INVALID");
  });

  it("validates backend DATETIME values without browser-dependent parsing", () => {
    const canonical = { ...snapshot, source: "G3 weekly_curve + nx_price_index 24h history", sourceEnvironment: "PRODUCTION", runId: "" };
    expect(parseNexMarketSnapshot(canonical, "dev").history24h[0]?.sampledAt).toBe("2026-08-19 13:33:00");
    expect(() => parseNexMarketSnapshot({
      ...canonical,
      history24h: [{ price: 0.125, sampledAt: "2026-02-31 13:33:00" }],
    }, "dev")).toThrow("NEX_MARKET_RESPONSE_INVALID");
  });
});
