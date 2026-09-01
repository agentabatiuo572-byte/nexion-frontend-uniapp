import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { advanceRuntimeRevision } from "@/api/order-api";
import type { CanonicalCommissionConfig } from "@/api/commission-config-api";

const remote = vi.hoisted(() => ({
  remoteApiEnabled: true,
  apiRuntimeConfig: { environment: "dev", mode: "dev" },
  commissionConfigApi: { rates: vi.fn(), binary: vi.fn() },
  teamInsightsApi: { commissions: vi.fn() },
}));
vi.mock("@/api/runtime", () => remote);

const { useCommission } = await import("./commission");

function config(account: string, directRate = 0.1): CanonicalCommissionConfig {
  return {
    source: `server-${account}`, serverCanonical: true, sourceEnvironment: "SANDBOX", runId: "commission-run-20260817",
    unilevelUsdt: { 1: directRate, 2: 0.05, 3: 0.03, 4: 0.02, 5: 0.01, 6: 0.005, 7: 0.005 },
    unilevelNex: { 1: 50, 2: 20, 3: 10, 4: 5, 5: 2.5, 6: 1, 7: 1 },
    unilevelPaused: { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false },
    partnerThresholds: { standard: 0, verified: 5000, premium: 50000, diamond: 500000 },
    influenceClampMin: 1, influenceClampMax: 5, coolingDays: 30, promoMultiplier: 1,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  setActivePinia(createPinia());
  remote.commissionConfigApi.rates.mockReset();
  remote.commissionConfigApi.binary.mockResolvedValue({});
  remote.teamInsightsApi.commissions.mockResolvedValue({ events: [] });
  advanceRuntimeRevision("commission-run-20260817");
});

describe("commission config remote scope", () => {
  it("refreshes config and derives display rates from the server snapshot", async () => {
    remote.commissionConfigApi.rates.mockResolvedValue(config("a", 0.12));
    const store = useCommission();
    store.bindAccount("a");
    await vi.waitFor(() => expect(store.configStatus).toBe("ready"));
    expect(store.config?.unilevelUsdt[1]).toBe(0.12);
  });

  it("fails closed on rate errors and clears old config on account or RunID switch", async () => {
    remote.commissionConfigApi.rates.mockResolvedValueOnce(config("a"));
    const store = useCommission();
    store.bindAccount("a");
    await vi.waitFor(() => expect(store.configStatus).toBe("ready"));
    advanceRuntimeRevision("commission-run-20260818");
    expect(store.config).toBeNull();
    expect(store.configStatus).toBe("idle");
    remote.commissionConfigApi.rates.mockRejectedValueOnce(new Error("CONFIG_UNAVAILABLE"));
    store.bindAccount("b");
    await vi.waitFor(() => expect(store.configStatus).toBe("error"));
    expect(store.config).toBeNull();
  });

  it("drops a late refresh response from an older generation", async () => {
    const first = deferred<CanonicalCommissionConfig>();
    remote.commissionConfigApi.rates.mockReturnValueOnce(first.promise).mockResolvedValueOnce(config("new", 0.14));
    const store = useCommission();
    store.bindAccount("a");
    const latest = store.refreshCanonicalConfig();
    first.resolve(config("old", 0.11));
    await latest;
    expect(store.config?.unilevelUsdt[1]).toBe(0.14);
  });
});
