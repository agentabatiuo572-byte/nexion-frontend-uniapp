import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const remote = vi.hoisted(() => ({
  remoteApiEnabled: true,
  voucherApi: {
    state: vi.fn(),
    claim: vi.fn(),
  },
}));

vi.mock("@/api/runtime", () => remote);

const { useVoucher } = await import("./voucher");
const { setCurrentCommerceSandboxRun } = await import("@/api/order-api");

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function voucher(account: string, grantStatus: "UNCLAIMED" | "AVAILABLE" | "USED" | "EXPIRED" | "REVOKED" = "AVAILABLE") {
  return {
    id: `${account}-voucher`,
    name: `Voucher ${account}`,
    type: "fixed",
    amountUSD: 10,
    minPurchaseUSD: 0,
    applicableSkus: [],
    audience: "all",
    startAt: 0,
    endAt: 0,
    claimSurfaces: ["home"],
    popupEnabled: false,
    stackWithTrial: false,
    stackWithOthers: false,
    splittable: false,
    status: "active",
    definitionDeleted: false,
    grantId: grantStatus === "UNCLAIMED" ? null : `${account}-grant`,
    grantStatus,
    usedOrderNo: null,
    claimable: grantStatus === "UNCLAIMED",
    audienceEligible: true,
    popupCadence: {
      enabled: false, delayMs: 0, cooldownHours: 0, maxPerSession: 1,
      nextEligibleAt: 0, popupEligible: false, source: "nx_growth_voucher",
      sourceEnvironment: "PRODUCTION", runId: "",
    },
  };
}

function snapshot(account: string, grantStatus: "UNCLAIMED" | "AVAILABLE" | "USED" | "EXPIRED" | "REVOKED" = "AVAILABLE") {
  return { vouchers: [voucher(account, grantStatus)], source: "test" };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function createStore() {
  remote.voucherApi.state.mockResolvedValue({ vouchers: [], source: "test" });
  const store = useVoucher();
  await flush();
  remote.voucherApi.state.mockReset();
  remote.voucherApi.claim.mockReset();
  return store;
}

beforeEach(() => {
  setActivePinia(createPinia());
  remote.voucherApi.state.mockReset();
  remote.voucherApi.claim.mockReset();
});

afterEach(() => {
  setCurrentCommerceSandboxRun(null);
});

describe("voucher remote account scope", () => {
  it("drops a late state success after switching accounts", async () => {
    const store = await createStore();
    const stale = deferred<ReturnType<typeof snapshot>>();
    remote.voucherApi.state
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValue(snapshot("B"));

    store.bindAccount("A");
    store.bindAccount("B");
    await flush();
    expect(store.catalog.map((item) => item.name)).toEqual(["Voucher B"]);

    stale.resolve(snapshot("A"));
    await flush();

    expect(store.catalog.map((item) => item.name)).toEqual(["Voucher B"]);
  });

  it("drops a late state failure without clearing the next account", async () => {
    const store = await createStore();
    const stale = deferred<ReturnType<typeof snapshot>>();
    remote.voucherApi.state
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValue(snapshot("B"));

    store.bindAccount("A");
    store.bindAccount("B");
    await flush();
    stale.reject(new Error("account A failed"));
    await flush();

    expect(store.catalog.map((item) => item.name)).toEqual(["Voucher B"]);
  });

  it("does not read back a stale claim after switching accounts", async () => {
    const store = await createStore();
    remote.voucherApi.state.mockResolvedValue(snapshot("A"));
    store.bindAccount("A");
    await flush();

    const claim = deferred<{ status: "AVAILABLE" }>();
    remote.voucherApi.claim.mockReturnValue(claim.promise);
    remote.voucherApi.state.mockResolvedValue(snapshot("B"));
    const pending = store.claimRemote("A-voucher", "home");

    store.bindAccount("B");
    await flush();
    const stateCallsAfterRebind = remote.voucherApi.state.mock.calls.length;
    claim.resolve({ status: "AVAILABLE" });

    await expect(pending).resolves.toBe(false);
    await flush();
    expect(remote.voucherApi.state).toHaveBeenCalledTimes(stateCallsAfterRebind);
    expect(store.catalog.map((item) => item.name)).toEqual(["Voucher B"]);
  });

  it("drops a stale claim failure without clearing the next account", async () => {
    const store = await createStore();
    remote.voucherApi.state.mockResolvedValue(snapshot("A"));
    store.bindAccount("A");
    await flush();

    const claim = deferred<{ status: "AVAILABLE" }>();
    remote.voucherApi.claim.mockReturnValue(claim.promise);
    remote.voucherApi.state.mockResolvedValue(snapshot("B"));
    const pending = store.claimRemote("A-voucher", "home");

    store.bindAccount("B");
    await flush();
    claim.reject(new Error("account A failed"));

    await expect(pending).resolves.toBe(false);
    expect(store.catalog.map((item) => item.name)).toEqual(["Voucher B"]);
  });

  it("keeps the newest refresh for the same account", async () => {
    const store = await createStore();
    const older = deferred<ReturnType<typeof snapshot>>();
    remote.voucherApi.state.mockReturnValueOnce(older.promise).mockResolvedValue(snapshot("new"));
    const first = store.refreshRemote();
    const second = store.refreshRemote();
    await second;
    older.resolve(snapshot("old"));
    await first;
    expect(store.catalog.map((item) => item.name)).toEqual(["Voucher new"]);
  });

  it("drops a catalog when the sandbox RunID changes", async () => {
    setCurrentCommerceSandboxRun("voucher-run-a");
    const store = await createStore();
    const stale = deferred<ReturnType<typeof snapshot>>();
    remote.voucherApi.state.mockReturnValueOnce(stale.promise)
      .mockResolvedValue({ vouchers: [], source: "test" });
    const pending = store.refreshRemote();

    setCurrentCommerceSandboxRun("voucher-run-b");
    await flush();
    expect(store.catalog).toEqual([]);

    stale.resolve(snapshot("run-a"));
    await pending;
    await flush();
    expect(store.catalog).toEqual([]);
  });

  it("never exposes expired or revoked grants as redeemable checkout vouchers", async () => {
    const store = await createStore();
    remote.voucherApi.state.mockResolvedValue({
      vouchers: [voucher("expired", "EXPIRED"), voucher("revoked", "REVOKED")],
      source: "test",
    });
    await store.refreshRemote();

    expect(store.claimedUnused).toEqual([]);
    expect(store.bestVoucherFor("any-sku", 100)).toBeNull();
  });

  it("passes the visible entry surface to the canonical claim command", async () => {
    const store = await createStore();
    remote.voucherApi.claim.mockResolvedValue({ status: "AVAILABLE" });
    remote.voucherApi.state.mockResolvedValue({ vouchers: [], source: "test" });

    await store.claimRemote("store-voucher", "store");

    expect(remote.voucherApi.claim).toHaveBeenCalledWith(
      "store-voucher",
      "store",
      "h7-voucher-claim:store-voucher",
    );
  });
});
