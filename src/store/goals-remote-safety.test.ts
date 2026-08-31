import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const remote = vi.hoisted(() => ({
  remoteApiEnabled: true,
  goalsApi: {
    list: vi.fn(),
    create: vi.fn(),
    recommendation: vi.fn(),
    setStatus: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("@/api/runtime", () => remote);

const { useGoals } = await import("./goals");

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function recommendation(targetUsdt: number) {
  return {
    serverCanonical: true as const,
    source: "nx_product",
    sourceEnvironment: "PRODUCTION" as const,
    runId: "",
    productNo: `sku-${targetUsdt}`,
    productName: `Goal ${targetUsdt}`,
    dailyEarn: 10,
    price: 1000,
    requiredDaily: targetUsdt / 30,
    targetUsdt,
    days: 30,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  Object.values(remote.goalsApi).forEach((mock) => mock.mockReset());
  remote.goalsApi.list.mockResolvedValue({
    serverCanonical: true,
    source: "nx_earning_goal",
    lifetimeEarningsUsdt: 0,
    goals: [],
  });
});

describe("earning-goal remote safety", () => {
  it("coalesces duplicate saves into one idempotent create command", async () => {
    const create = deferred<{
      id: number; targetUsdt: number; deadlineAt: number; createdAt: number;
      achieved: boolean; progressPct: number; lifetimeEarningsUsdt: number;
    }>();
    remote.goalsApi.create.mockReturnValue(create.promise);
    const store = useGoals();
    const input = { targetUSDT: 1000, deadlineMs: 1_900_000_000_000, idempotencyKey: "goal-save-1" };

    const first = store.setGoal(input);
    const second = store.setGoal(input);

    expect(remote.goalsApi.create).toHaveBeenCalledTimes(1);
    create.resolve({ id: 8, targetUsdt: 1000, deadlineAt: input.deadlineMs, createdAt: 1_800_000_000_000,
      achieved: false, progressPct: 0, lifetimeEarningsUsdt: 0 });
    await Promise.all([first, second]);
    expect(store.goals).toHaveLength(1);
  });

  it("keeps the newest recommendation when responses arrive out of order", async () => {
    const oldResponse = deferred<ReturnType<typeof recommendation>>();
    const newResponse = deferred<ReturnType<typeof recommendation>>();
    remote.goalsApi.recommendation
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(newResponse.promise);
    const store = useGoals();

    const oldRequest = store.refreshRecommendation(1000, 1_900_000_000_000);
    const newRequest = store.refreshRecommendation(2000, 1_910_000_000_000);
    newResponse.resolve(recommendation(2000));
    await newRequest;
    oldResponse.resolve(recommendation(1000));
    await oldRequest;

    expect(store.recommendation?.targetUsdt).toBe(2000);
  });

  it("drops a recommendation that belongs to the previous account epoch", async () => {
    const oldResponse = deferred<ReturnType<typeof recommendation>>();
    remote.goalsApi.recommendation.mockReturnValueOnce(oldResponse.promise);
    const store = useGoals();

    const pending = store.refreshRecommendation(1000, 1_900_000_000_000);
    store.bindAccount("account-b");
    oldResponse.resolve(recommendation(1000));
    await pending;

    expect(store.recommendation).toBeNull();
  });

  it("returns stale without mutating the new account after a save crosses an account switch", async () => {
    const create = deferred<{
      id: number; targetUsdt: number; deadlineAt: number; createdAt: number;
      achieved: boolean; progressPct: number; lifetimeEarningsUsdt: number;
    }>();
    remote.goalsApi.create.mockReturnValueOnce(create.promise);
    const store = useGoals();
    store.bindAccount("account-a");

    const pending = store.setGoal({
      targetUSDT: 1000, deadlineMs: 1_900_000_000_000, idempotencyKey: "goal-save-account-a",
    });
    store.bindAccount("account-b");
    create.resolve({ id: 8, targetUsdt: 1000, deadlineAt: 1_900_000_000_000, createdAt: 1_800_000_000_000,
      achieved: false, progressPct: 0, lifetimeEarningsUsdt: 0 });

    await expect(pending).resolves.toBe("stale");
    expect(store.goals).toEqual([]);
  });
});
