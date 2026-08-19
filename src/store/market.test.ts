import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchNex, fetchExternal } = vi.hoisted(() => ({
  fetchNex: vi.fn(),
  fetchExternal: vi.fn(),
}));

vi.mock("@/api/runtime", () => ({
  remoteApiEnabled: true,
  marketApi: { fetch: fetchNex, external: fetchExternal },
}));

vi.mock("@/api/order-api", () => ({
  subscribeCurrentCommerceSandboxRun: vi.fn(),
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
});
