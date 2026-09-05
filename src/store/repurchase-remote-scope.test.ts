import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { RepurchaseConfig, RepurchaseSnapshot } from "@/api/repurchase-api";
import { ApiError } from "@/api/errors";

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
  ordersPage: { total: 0, pageNum: 1, pageSize: 50 },
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
  const storage = new Map<string, unknown>();
  vi.stubGlobal("uni", {
    getStorageSync: vi.fn((key: string) => storage.get(key)),
    setStorageSync: vi.fn((key: string, value: unknown) => storage.set(key, structuredClone(value))),
  });
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
    store.bindAccount("account-a");

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
    remote.repurchaseApi.open.mockRejectedValue(new ApiError({ kind: "business", message: "DISCLOSURE_REQUIRED" }));
    const store = useRepurchase();
    store.bindAccount("account-a");

    await store.refresh();
    await expect(store.open(200)).rejects.toThrow("DISCLOSURE_REQUIRED");

    expect(store.config).toEqual(config);
    expect(store.walletBalanceUsdt).toBe(500);
    expect(store.error).toBe("");
    expect(store.pendingOpenAmount).toBeNull();
  });

  it("restores the original amount and key after a lost response and App restart, even after balance decreased", async () => {
    remote.repurchaseApi.fetchConfig.mockResolvedValue(config);
    remote.repurchaseApi.fetchOrders.mockResolvedValue(snapshot);
    remote.repurchaseApi.open.mockRejectedValueOnce(new Error("response lost"));
    const first = useRepurchase();
    first.bindAccount("account-a");
    await first.refresh();
    await expect(first.open(400)).rejects.toThrow("response lost");
    const key = remote.repurchaseApi.open.mock.calls[0][1];

    setActivePinia(createPinia());
    remote.repurchaseApi.fetchOrders.mockResolvedValue({ ...snapshot, walletBalanceUsdt: 100 });
    remote.repurchaseApi.open.mockResolvedValue({ ...snapshot, walletBalanceUsdt: 100 });
    const restored = useRepurchase();
    restored.bindAccount("account-a");
    await restored.refresh();
    expect(restored.pendingOpenAmount).toBe(400);
    await expect(restored.open(100)).rejects.toThrow("REPURCHASE_PENDING_RECOVERY_REQUIRED");
    await restored.open(400);
    expect(remote.repurchaseApi.open).toHaveBeenLastCalledWith(400, key);
    expect(remote.repurchaseApi.open).toHaveBeenCalledTimes(2);
    expect(restored.pendingOpenAmount).toBeNull();
  });

  it("does not discard an unknown earlier commit when a later replay is rejected", async () => {
    remote.repurchaseApi.fetchConfig.mockResolvedValue(config);
    remote.repurchaseApi.fetchOrders.mockResolvedValue(snapshot);
    remote.repurchaseApi.open.mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new ApiError({ kind: "business", message: "PRODUCT_DISABLED" }));
    const store = useRepurchase();
    store.bindAccount("account-a");
    await store.refresh();
    await expect(store.open(200)).rejects.toThrow();
    await expect(store.open(200)).rejects.toThrow();
    expect(store.pendingOpenAmount).toBe(200);
    expect(remote.repurchaseApi.open.mock.calls[1][1]).toBe(remote.repurchaseApi.open.mock.calls[0][1]);
  });

  it("never posts when durable storage is unavailable", async () => {
    remote.repurchaseApi.fetchConfig.mockResolvedValue(config);
    remote.repurchaseApi.fetchOrders.mockResolvedValue(snapshot);
    const store = useRepurchase();
    store.bindAccount("account-a");
    await store.refresh();
    vi.mocked(uni.setStorageSync).mockImplementation(() => { throw new Error("disk full"); });
    await expect(store.open(200)).rejects.toThrow("REMOTE_INTENT_PERSIST_FAILED");
    expect(remote.repurchaseApi.open).not.toHaveBeenCalled();
  });

  it("isolates unresolved operations and late receipts from another account", async () => {
    remote.repurchaseApi.fetchConfig.mockResolvedValue(config);
    remote.repurchaseApi.fetchOrders.mockResolvedValue(snapshot);
    let finish!: (value: RepurchaseSnapshot) => void;
    remote.repurchaseApi.open.mockReturnValue(new Promise<RepurchaseSnapshot>((resolve) => { finish = resolve; }));
    const store = useRepurchase();
    store.bindAccount("account-a");
    await store.refresh();
    const pending = store.open(200);
    store.bindAccount("account-b");
    await store.refresh();
    expect(store.pendingOpenAmount).toBeNull();
    finish({ ...snapshot, walletBalanceUsdt: 300 });
    await expect(pending).rejects.toThrow("REPURCHASE_ACCOUNT_CHANGED");
    expect(store.walletBalanceUsdt).toBe(500);
    store.bindAccount("account-a");
    expect(store.pendingOpenAmount).toBe(200);
  });
});
