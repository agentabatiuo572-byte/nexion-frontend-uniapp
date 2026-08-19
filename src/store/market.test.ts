import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchNex, fetchExternal, runListeners } = vi.hoisted(() => ({
  fetchNex: vi.fn(),
  fetchExternal: vi.fn(),
  runListeners: new Set<(scope: { runId: string | null; epoch: number }) => void>(),
}));

vi.mock("@/api/runtime", () => ({
  remoteApiEnabled: true,
  marketApi: { fetch: fetchNex, external: fetchExternal },
}));

vi.mock("@/api/order-api", () => ({
  subscribeCurrentCommerceSandboxRun: vi.fn((listener) => {
    runListeners.add(listener);
    return () => runListeners.delete(listener);
  }),
}));

import { useMarket } from "./market";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const nexSnapshot = {
  currentPrice: 0.125,
  costBasis: 0.085,
  sparkline: [0.1, 0.11, 0.12, 0.13, 0.12, 0.124, 0.125],
  history24h: [],
  source: "mock",
  sourceEnvironment: "SANDBOX" as const,
  runId: "market-concurrency-run-20260819",
};

const externalSnapshot = {
  availability: "AVAILABLE" as const,
  sampledAt: "2026-08-19T10:00:00Z",
  source: "mock",
  sourceEnvironment: "SANDBOX" as const,
  runId: "market-concurrency-run-20260819",
  quotes: [{
    symbol: "RNDR", name: "Render", category: "ai" as const, priceUsd: 7.84,
    change24hPct: 3.2, volume24hUsd: 184500000,
    sparkline: [7.5, 7.84], sampledAt: "2026-08-19T10:00:00Z",
  }],
};

describe("market refresh concurrency", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchNex.mockReset();
    fetchExternal.mockReset();
    runListeners.clear();
  });

  it("lets a global NEX refresh join an in-flight atomic market refresh", async () => {
    const nex = deferred<typeof nexSnapshot>();
    const external = deferred<typeof externalSnapshot>();
    fetchNex.mockReturnValue(nex.promise);
    fetchExternal.mockReturnValue(external.promise);
    const market = useMarket();

    const allRefresh = market.syncAll();
    const globalRefresh = market.syncRemote();
    nex.resolve(nexSnapshot);
    external.resolve(externalSnapshot);

    await expect(Promise.all([allRefresh, globalRefresh])).resolves.toEqual([true, true]);
    expect(fetchNex).toHaveBeenCalledTimes(1);
    expect(fetchExternal).toHaveBeenCalledTimes(1);
    expect(market.remoteReady).toBe(true);
    expect(market.externalReady).toBe(true);
    expect(market.externalQuotes).toHaveLength(1);
  });

  it("starts a fresh atomic refresh when the commerce Run changes during an old request", async () => {
    const oldNex = deferred<typeof nexSnapshot>();
    const oldExternal = deferred<typeof externalSnapshot>();
    fetchNex.mockReturnValueOnce(oldNex.promise);
    fetchExternal.mockReturnValueOnce(oldExternal.promise);
    const market = useMarket();

    const staleRefresh = market.syncAll();
    fetchNex.mockResolvedValueOnce({ ...nexSnapshot, runId: "next-market-run-20260819", currentPrice: 0.2 });
    fetchExternal.mockResolvedValueOnce({ ...externalSnapshot, runId: "next-market-run-20260819" });
    runListeners.forEach((listener) => listener({ runId: "next-market-run-20260819", epoch: 2 }));

    oldNex.resolve(nexSnapshot);
    oldExternal.resolve(externalSnapshot);

    await expect(staleRefresh).resolves.toBe(false);
    await vi.waitFor(() => expect(market.remoteReady).toBe(true));
    expect(fetchNex).toHaveBeenCalledTimes(2);
    expect(fetchExternal).toHaveBeenCalledTimes(2);
    expect(market.marketRunId).toBe("next-market-run-20260819");
    expect(market.nexPriceUSDT).toBe(0.2);
  });

  it("keeps a validated NEX snapshot when only the external quote request fails", async () => {
    fetchNex.mockResolvedValue(nexSnapshot);
    fetchExternal.mockRejectedValue(new Error("external timeout"));
    const market = useMarket();

    await expect(market.syncAll()).resolves.toBe(false);

    expect(market.remoteReady).toBe(true);
    expect(market.nexPriceUSDT).toBe(0.125);
    expect(market.remoteError).toBeNull();
    expect(market.externalReady).toBe(false);
    expect(market.externalError).toBe("EXTERNAL_MARKET_AUTHORITY_UNAVAILABLE");
  });
});
