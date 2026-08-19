import { afterEach, describe, expect, it, vi } from "vitest";
import { createMarketApi } from "./market-api";
import { setCurrentCommerceSandboxRun } from "./order-api";

const productionNex = {
  asset: "NEX",
  currency: "USDT",
  currentPrice: 0.125,
  costBasis: 0.085,
  sparkline: [0.11, 0.12, 0.13, 0.12, 0.14, 0.13, 0.125],
  history24h: [],
  serverCanonical: true,
  source: "G3 weekly_curve + nx_price_index 24h history",
  sourceEnvironment: "PRODUCTION",
  runId: "",
};

describe("market API provenance", () => {
  afterEach(() => setCurrentCommerceSandboxRun(null));

  it("accepts the production NEX projection only on the production rail", async () => {
    const request = vi.fn().mockResolvedValue(productionNex);
    await expect(createMarketApi({ request } as never, "remote").fetch()).resolves.toMatchObject({
      currentPrice: 0.125,
      sourceEnvironment: "PRODUCTION",
    });
  });

  it("accepts only the current commerce run-scoped sandbox NEX projection", async () => {
    const current = { ...productionNex, source: "mock", sourceEnvironment: "SANDBOX", runId: "market-sandbox-run-20260819" };
    const stale = { ...current, runId: "market-sandbox-run-20260818" };
    const request = vi.fn().mockResolvedValueOnce(current).mockResolvedValueOnce(stale);
    const api = createMarketApi({ request } as never, "sandbox");
    setCurrentCommerceSandboxRun("market-sandbox-run-20260819");

    await expect(api.fetch()).resolves.toMatchObject({ runId: "market-sandbox-run-20260819" });
    await expect(api.fetch()).rejects.toMatchObject({ message: "NEX_MARKET_RESPONSE_INVALID" });
  });

  it("parses server-owned external quotes and rejects a mismatched commerce run", async () => {
    const snapshot = {
      serverCanonical: true,
      source: "mock",
      sourceEnvironment: "SANDBOX",
      runId: "market-sandbox-run-20260819",
      availability: "AVAILABLE",
      sampledAt: "2026-08-19T10:00:00Z",
      quotes: [{
        symbol: "RNDR", name: "Render", category: "ai", priceUsd: 7.84,
        change24hPct: 3.2, volume24hUsd: 184500000,
        sparkline: [7.5, 7.6, 7.55, 7.7, 7.84], sampledAt: "2026-08-19T10:00:00Z",
      }],
    };
    const request = vi.fn().mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot, runId: "market-sandbox-run-20260818" });
    const api = createMarketApi({ request } as never, "sandbox");
    setCurrentCommerceSandboxRun("market-sandbox-run-20260819");

    await expect(api.external()).resolves.toMatchObject({ availability: "AVAILABLE", quotes: [{ symbol: "RNDR" }] });
    await expect(api.external()).rejects.toMatchObject({ message: "EXTERNAL_MARKET_RESPONSE_INVALID" });
    expect(request).toHaveBeenCalledWith({ method: "GET", path: "/api/config/market/external", authenticated: false });
  });

  it("does not let a public market read establish the commerce run", async () => {
    const nex = { ...productionNex, source: "mock", sourceEnvironment: "SANDBOX", runId: "market-sandbox-run-20260819" };
    const external = {
      serverCanonical: true, source: "mock", sourceEnvironment: "SANDBOX",
      runId: "market-sandbox-run-20260818", availability: "UNAVAILABLE",
      sampledAt: "2026-08-19T10:00:00Z", quotes: [],
    };
    const api = createMarketApi({ request: vi.fn().mockResolvedValueOnce(nex).mockResolvedValueOnce(external) } as never, "sandbox");

    await expect(api.fetch()).resolves.toMatchObject({ runId: "market-sandbox-run-20260819" });
    await expect(api.external()).resolves.toMatchObject({ runId: "market-sandbox-run-20260818" });
  });
});
