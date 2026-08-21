import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { setCurrentCommerceSandboxRun } from "@/api/order-api";
import type { ReferralRewardSnapshot } from "@/api/referral-reward-api";

const remote = vi.hoisted(() => ({
  remoteApiEnabled: true,
  referralRewardApi: { snapshot: vi.fn() },
}));

vi.mock("@/api/runtime", () => remote);

const { useReferralReward } = await import("./referral-reward");

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function snapshot(account: string): ReferralRewardSnapshot {
  return {
    referralCode: `REF-${account}`, inviterRewardNex: 10, invitedCount: 1, pendingCount: 0, settledCount: 1,
    lifetimeInviterNex: 10, walletNexAvailable: 20, recentRewards: [], limit: 10,
    source: "mock", sourceEnvironment: "SANDBOX", runId: "catalog-run-20260816",
    factSources: ["nx_h8_sandbox_referral_settlement", "nx_h8_sandbox_referral_ledger"],
    refreshedAt: "2026-08-16T00:00:00Z",
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  remote.referralRewardApi.snapshot.mockReset();
  setCurrentCommerceSandboxRun("catalog-run-20260816");
});

describe("referral reward remote scope", () => {
  it("drops a late success after the catalog RunID changes", async () => {
    const pending = deferred<ReferralRewardSnapshot>();
    remote.referralRewardApi.snapshot.mockReturnValue(pending.promise);
    const store = useReferralReward();
    const request = store.refresh();

    setCurrentCommerceSandboxRun("catalog-run-20260817");
    pending.resolve(snapshot("old-run"));

    await expect(request).resolves.toBe(false);
    expect(store.snapshot).toBeNull();
    expect(store.loading).toBe(false);
  });

  it("drops a late failure after the catalog RunID changes", async () => {
    const pending = deferred<ReferralRewardSnapshot>();
    remote.referralRewardApi.snapshot.mockReturnValue(pending.promise);
    const store = useReferralReward();
    const request = store.refresh();

    setCurrentCommerceSandboxRun("catalog-run-20260817");
    pending.reject(new Error("OLD_RUN_FAILURE"));

    await expect(request).resolves.toBe(false);
    expect(store.snapshot).toBeNull();
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
  });

  it("drops late success and failure after an account rebind", async () => {
    const first = deferred<ReferralRewardSnapshot>();
    remote.referralRewardApi.snapshot
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(snapshot("account-b"));
    const store = useReferralReward();
    store.bindAccount("account-a");
    store.bindAccount("account-b");
    first.resolve(snapshot("account-a"));

    await Promise.resolve();
    await Promise.resolve();
    expect(store.snapshot?.referralCode).toBe("REF-account-b");

    const failed = deferred<ReferralRewardSnapshot>();
    remote.referralRewardApi.snapshot
      .mockReturnValueOnce(failed.promise)
      .mockResolvedValueOnce(snapshot("account-c"));
    const pending = store.refresh();
    store.bindAccount("account-c");
    failed.reject(new Error("OLD_ACCOUNT_FAILURE"));
    await expect(pending).resolves.toBe(false);
    expect(store.snapshot?.referralCode).toBe("REF-account-c");
    expect(store.error).toBeNull();
  });
});
