import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchNex } = vi.hoisted(() => ({
  fetchNex: vi.fn(),
}));

vi.mock("@/api/runtime", () => ({
  remoteApiEnabled: true,
  marketApi: { fetch: fetchNex },
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
  history: [],
  historyMaxDays: 365,
  source: "G3 weekly_curve + nx_price_index sampled history",
  sourceEnvironment: "PRODUCTION" as const,
  runId: "",
};

describe("NEX market refresh concurrency", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchNex.mockReset();
  });

  it("joins concurrent NEX refreshes into one server request", async () => {
    const nex = deferred<typeof nexSnapshot>();
    fetchNex.mockReturnValue(nex.promise);
    const market = useMarket();

    const first = market.syncRemote();
    const second = market.syncRemote();
    nex.resolve(nexSnapshot);

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(fetchNex).toHaveBeenCalledTimes(1);
    expect(market.remoteReady).toBe(true);
    expect(market.nexPriceUSDT).toBe(0.125);
  });

  it("uses the seven-day PC curve until at least two real 24h samples exist", async () => {
    fetchNex.mockResolvedValue({
      ...nexSnapshot,
      history: [{ price: 0.125, sampledAt: "2026-08-20 12:08:11" }],
    });
    const market = useMarket();

    await expect(market.syncRemote()).resolves.toBe(true);

    expect(market.remoteReady).toBe(true);
    expect(market.klineHourly).toEqual(nexSnapshot.sparkline);
    expect(market.open24h).toBe(nexSnapshot.sparkline[0]);
  });

  it("does not refetch the complete market history on each three-second wallet tick", async () => {
    fetchNex.mockResolvedValue(nexSnapshot);
    const market = useMarket();

    await market.syncRemote();
    await market.tickPrice();
    await market.tickPrice();

    expect(fetchNex).toHaveBeenCalledTimes(1);
  });

  it("keeps one canonical request in flight without a sandbox-run reset", async () => {
    const oldNex = deferred<typeof nexSnapshot>();
    fetchNex.mockReturnValue(oldNex.promise);
    const market = useMarket();

    const first = market.syncRemote();
    const second = market.syncRemote();
    oldNex.resolve(nexSnapshot);

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(fetchNex).toHaveBeenCalledTimes(1);
    expect(market.marketRunId).toBe("");
    expect(market.nexPriceUSDT).toBe(0.125);
  });

  it("fails closed when the NEX authority is unavailable", async () => {
    fetchNex.mockRejectedValue(new Error("NEX timeout"));
    const market = useMarket();

    await expect(market.syncRemote()).resolves.toBe(false);

    expect(market.remoteReady).toBe(false);
    expect(market.nexPriceUSDT).toBe(0);
    expect(market.remoteError).toBe("G3_REMOTE_AUTHORITY_UNAVAILABLE");
  });
});
