import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const remote = vi.hoisted(() => ({
  remoteApiEnabled: true,
  questApi: { state: vi.fn(), claim: vi.fn() },
}));

vi.mock("@/api/runtime", () => remote);

import { useWeeklyQuest } from "./weekly-quest";
import { ApiError } from "@/api/errors";
import { peekWeeklyQuestCommandKey } from "@/lib/weekly-quest-command-key";

const current = {
  questCode: "H3_DEVICE_ACTIVATED",
  name: "Activate a device",
  layer: "WEEKLY_T1" as const,
  rewardNex: 100,
  status: "CLAIMABLE" as const,
  category: "explore" as const,
  actionRoute: "/pages/device/list",
  instanceKey: "WEEK:2026-W36",
  eligibleFrom: "2026-08-31T00:00:00+08:00",
  eligibleUntil: "2099-09-07T00:00:00+08:00",
  eligible: true,
};

function snapshot(status: "CLAIMABLE" | "CLAIMED" = "CLAIMABLE") {
  return {
    quests: [{ ...current, status }], promoBanner: null, questBonusMultiplier: 1,
    rhythmMonth: 7, source: "nx_mission + nx_user_mission", serverCanonical: true as const,
    sourceEnvironment: "PRODUCTION" as const, runId: "",
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("weekly quest remote claim recovery", () => {
  let storage: Map<string, unknown>;

  beforeEach(() => {
    storage = new Map();
    vi.stubGlobal("uni", {
      getStorageSync: (key: string) => storage.get(key),
      setStorageSync: (key: string, value: unknown) => storage.set(key, value),
      removeStorageSync: (key: string) => storage.delete(key),
    });
    remote.questApi.state.mockReset();
    remote.questApi.claim.mockReset();
    setActivePinia(createPinia());
  });

  afterEach(() => vi.unstubAllGlobals());

  it("reuses the original key after an ambiguous response and Pinia restart", async () => {
    remote.questApi.state.mockResolvedValueOnce(snapshot()).mockRejectedValueOnce(new Error("readback unavailable"));
    const firstStore = useWeeklyQuest();
    firstStore.bindAccount("user:a");
    await flush();
    remote.questApi.claim.mockRejectedValueOnce(new Error("connection reset after send"));

    await expect(firstStore.claim(current)).resolves.toBe(false);
    const retained = peekWeeklyQuestCommandKey("user:a", current.questCode, current.instanceKey);
    expect(retained).toBeTruthy();

    setActivePinia(createPinia());
    remote.questApi.state.mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(snapshot("CLAIMED"));
    remote.questApi.claim.mockResolvedValueOnce({
      questId: current.questCode, rewardNex: 100, status: "CLAIMED",
      instanceKey: current.instanceKey, serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "",
    });
    const restarted = useWeeklyQuest();
    restarted.bindAccount("user:a");
    await flush();

    await expect(restarted.claim(current)).resolves.toBe(true);
    expect(remote.questApi.claim).toHaveBeenLastCalledWith(current.questCode, retained, current.instanceKey);
    expect(peekWeeklyQuestCommandKey("user:a", current.questCode, current.instanceKey)).toBeNull();
  });

  it("retires a retained key when authoritative refresh already reports claimed", async () => {
    const pendingStore = useWeeklyQuest();
    remote.questApi.state.mockResolvedValueOnce(snapshot()).mockRejectedValueOnce(new Error("readback unavailable"));
    pendingStore.bindAccount("user:a");
    await flush();
    remote.questApi.claim.mockRejectedValueOnce(new Error("connection reset after send"));
    await pendingStore.claim(current);
    expect(peekWeeklyQuestCommandKey("user:a", current.questCode, current.instanceKey)).toBeTruthy();

    setActivePinia(createPinia());
    remote.questApi.state.mockResolvedValueOnce(snapshot("CLAIMED"));
    const recovered = useWeeklyQuest();
    recovered.bindAccount("user:a");
    await flush();

    expect(recovered.snapshot?.quests[0]?.status).toBe("CLAIMED");
    expect(peekWeeklyQuestCommandKey("user:a", current.questCode, current.instanceKey)).toBeNull();
    expect(remote.questApi.claim).toHaveBeenCalledTimes(1);
  });

  it("retires a terminal unknown key only after the same instance is authoritatively still claimable", async () => {
    remote.questApi.state.mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(snapshot());
    remote.questApi.claim.mockRejectedValueOnce(new ApiError({
      kind: "business", message: "IDEMPOTENCY_RESULT_UNKNOWN", code: 409,
    }));
    const store = useWeeklyQuest();
    store.bindAccount("user:a");
    await flush();

    await expect(store.claim(current)).resolves.toBe(false);
    expect(store.error).toBe("WEEKLY_QUEST_CLAIM_RETRY_REQUIRED");
    expect(peekWeeklyQuestCommandKey("user:a", current.questCode, current.instanceKey)).toBeNull();

    remote.questApi.state.mockResolvedValueOnce(snapshot("CLAIMED"));
    remote.questApi.claim.mockResolvedValueOnce({
      questId: current.questCode, rewardNex: 100, status: "CLAIMED",
      instanceKey: current.instanceKey, serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "",
    });
    await expect(store.claim(current)).resolves.toBe(true);
    expect(remote.questApi.claim.mock.calls[1]?.[1]).not.toBe(remote.questApi.claim.mock.calls[0]?.[1]);
  });

  it("keeps the same key while the idempotency request is still in progress", async () => {
    remote.questApi.state.mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(snapshot());
    remote.questApi.claim.mockRejectedValueOnce(new ApiError({
      kind: "business", message: "IDEMPOTENCY_REQUEST_IN_PROGRESS", code: 409,
    }));
    const store = useWeeklyQuest();
    store.bindAccount("user:a");
    await flush();

    await expect(store.claim(current)).resolves.toBe(false);
    expect(store.error).toBe("WEEKLY_QUEST_CLAIM_OUTCOME_UNKNOWN");
    expect(peekWeeklyQuestCommandKey("user:a", current.questCode, current.instanceKey)).toBeTruthy();
  });

  it("keeps a pending prior-week command isolated from the current-week claim", async () => {
    const prior = { ...current, instanceKey: "WEEK:2026-W35" };
    remote.questApi.state.mockResolvedValueOnce(snapshot()).mockRejectedValueOnce(new Error("readback unavailable"));
    remote.questApi.claim.mockRejectedValueOnce(new Error("connection reset after send"));
    const store = useWeeklyQuest();
    store.bindAccount("user:a");
    await flush();
    await store.claim(prior);
    const priorKey = peekWeeklyQuestCommandKey("user:a", prior.questCode, prior.instanceKey);

    remote.questApi.state.mockResolvedValueOnce(snapshot("CLAIMED"));
    remote.questApi.claim.mockResolvedValueOnce({
      questId: current.questCode, rewardNex: 100, status: "CLAIMED",
      instanceKey: current.instanceKey, serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "",
    });
    await expect(store.claim(current)).resolves.toBe(true);

    expect(priorKey).toBeTruthy();
    expect(remote.questApi.claim).toHaveBeenLastCalledWith(
      current.questCode, expect.not.stringMatching(String(priorKey)), current.instanceKey,
    );
    expect(peekWeeklyQuestCommandKey("user:a", prior.questCode, prior.instanceKey)).toBe(priorKey);
  });

  it("does not post a claim when durable command storage is unavailable", async () => {
    remote.questApi.state.mockResolvedValueOnce(snapshot());
    const store = useWeeklyQuest();
    store.bindAccount("user:a");
    await flush();
    vi.stubGlobal("uni", {
      getStorageSync: () => { throw new Error("storage unavailable"); },
      setStorageSync: () => { throw new Error("storage unavailable"); },
      removeStorageSync: () => { throw new Error("storage unavailable"); },
    });

    await expect(store.claim(current)).resolves.toBe(false);
    expect(store.error).toBe("WEEKLY_QUEST_COMMAND_STORAGE_UNAVAILABLE");
    expect(remote.questApi.claim).not.toHaveBeenCalled();
  });

  it("does not leak an old account recovery error into a newly bound account", async () => {
    let resolveRecovery: (value: ReturnType<typeof snapshot>) => void = () => undefined;
    const delayedRecovery = new Promise<ReturnType<typeof snapshot>>((resolve) => {
      resolveRecovery = resolve;
    });
    const accountB = {
      ...snapshot(), quests: [{ ...current, name: "Account B quest" }],
    };
    remote.questApi.state
      .mockResolvedValueOnce(snapshot())
      .mockImplementationOnce(() => delayedRecovery)
      .mockResolvedValueOnce(accountB);
    remote.questApi.claim.mockRejectedValueOnce(new Error("connection reset after send"));
    const store = useWeeklyQuest();
    store.bindAccount("user:a");
    await flush();

    const oldClaim = store.claim(current);
    await flush();
    store.bindAccount("user:b");
    await flush();
    resolveRecovery(snapshot());

    await expect(oldClaim).resolves.toBe(false);
    expect(store.error).toBeNull();
    expect(store.snapshot?.quests[0]?.name).toBe("Account B quest");
    expect(peekWeeklyQuestCommandKey("user:a", current.questCode, current.instanceKey)).toBeTruthy();
  });

  it("keeps the last confirmed weekly snapshot when a refresh fails", async () => {
    remote.questApi.state.mockResolvedValueOnce(snapshot());
    const store = useWeeklyQuest();
    store.bindAccount("user:a");
    await flush();
    const confirmed = store.snapshot;

    remote.questApi.state.mockRejectedValueOnce(new Error("weekly service unavailable"));
    await expect(store.refresh()).resolves.toBe(false);

    expect(store.snapshot).toBe(confirmed);
    expect(store.snapshot?.quests[0]?.status).toBe("CLAIMABLE");
    expect(store.error).toBe("weekly service unavailable");
  });
});
