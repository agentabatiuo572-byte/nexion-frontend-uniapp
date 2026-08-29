import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { RepurchaseConfig, RepurchaseSnapshot } from "@/api/repurchase-api";

const remote = vi.hoisted(() => ({
  remoteApiEnabled: true,
  apiRuntimeConfig: { environment: "prod", mode: "prod" },
  repurchaseApi: {
    fetchConfig: vi.fn(),
    fetchOrders: vi.fn(),
    open: vi.fn(),
    claim: vi.fn(),
    earlyWithdraw: vi.fn(),
  },
}));

vi.mock("@/api/runtime", () => remote);

const { useRepurchase } = await import("./repurchase");

const config: RepurchaseConfig = {
  apyPct: 35,
  lockDays: 90,
  nurtureMultiplier: 1.5,
  h1ReinvestMultiplier: 1,
  effectiveNurtureMultiplier: 1.5,
  ticketPerOrder: 1,
  presets: [100, 250],
  earlyPenaltyPct: 15,
  minAmountUsdt: 20,
  enabled: true,
  disclosureRequired: false,
  currentNexPriceUsdt: 0.02,
  g4LotteryCapacity: 10,
  g4TicketsIssuedThisMonth: 1,
  sourceEnvironment: "PRODUCTION",
  runId: "",
};

const snapshot: RepurchaseSnapshot = {
  orders: [],
  walletBalanceUsdt: 500,
  serverTime: Date.now(),
  sourceEnvironment: "PRODUCTION",
  runId: "",
};

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  setActivePinia(createPinia());
  for (const method of Object.values(remote.repurchaseApi)) method.mockReset();
});

describe("repurchase remote authority", () => {
  it("opens only through the server API after a canonical refresh", async () => {
    remote.repurchaseApi.fetchConfig.mockResolvedValue(config);
    remote.repurchaseApi.fetchOrders.mockResolvedValue(snapshot);
    remote.repurchaseApi.open.mockResolvedValue({
      ...snapshot,
      walletBalanceUsdt: 300,
      focusOrderNo: "R-1",
    });
    const store = useRepurchase();

    await store.refresh();
    await store.open(200);

    expect(remote.repurchaseApi.open).toHaveBeenCalledWith(200, expect.stringMatching(/^g7-open-/));
    expect(store.walletBalanceUsdt).toBe(300);
  });

  it("keeps the product unavailable when the backend is HOLD/503", async () => {
    remote.repurchaseApi.fetchConfig.mockRejectedValue(new Error("REPURCHASE_HOLD"));
    remote.repurchaseApi.fetchOrders.mockRejectedValue(new Error("503"));
    const store = useRepurchase();

    await store.refresh();
    await flush();

    expect(store.config).toBeNull();
    expect(store.orders).toEqual([]);
    expect(store.walletBalanceUsdt).toBe(0);
    expect(remote.repurchaseApi.open).not.toHaveBeenCalled();
  });

  it("keeps the last canonical screen usable when a command is rejected", async () => {
    remote.repurchaseApi.fetchConfig.mockResolvedValue(config);
    remote.repurchaseApi.fetchOrders.mockResolvedValue(snapshot);
    remote.repurchaseApi.open.mockRejectedValue(new Error("DISCLOSURE_REQUIRED"));
    const store = useRepurchase();

    await store.refresh();
    await expect(store.open(200)).rejects.toThrow("DISCLOSURE_REQUIRED");

    expect(store.config).toEqual(config);
    expect(store.walletBalanceUsdt).toBe(500);
    expect(store.error).toBe("");
  });
});
