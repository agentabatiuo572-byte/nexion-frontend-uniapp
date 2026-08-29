import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { advanceRuntimeRevision } from "@/api/order-api";
import { ApiError } from "@/api/errors";

const remote = vi.hoisted(() => ({
  remoteApiEnabled: true,
  teamNetworkApi: { snapshot: vi.fn() },
}));

vi.mock("@/api/runtime", () => remote);

const { useNetwork } = await import("./network");

const snapshot = (id: string) => ({
  totalMembers: 1, directMembers: 1, activeMembers: 1, monthVolumeUsdt: 10, lifetimeVolumeUsdt: null,
  members: [{ id, name: id, avatarUrl: null, vRank: 1, layer: 1 as const, leg: "A" as const,
    joinedAt: "2026-08-13T00:00:00Z", monthVolumeUsdt: 10, lifetimeVolumeUsdt: null,
    status: "ACTIVE" as const, region: "SG" }], source: "server" as const,
  sourceEnvironment: "SANDBOX" as const, runId: "TEAM-RUN-20260816", serverCanonical: true as const,
  generatedAt: "2026-08-13T00:00:00Z",
});

beforeEach(() => {
  setActivePinia(createPinia());
  remote.teamNetworkApi.snapshot.mockReset();
  advanceRuntimeRevision("TEAM-RUN-20260816");
});

describe("team network remote scope", () => {
  it("drops a response captured before the sandbox run changes", async () => {
    let resolve!: (value: ReturnType<typeof snapshot>) => void;
    remote.teamNetworkApi.snapshot
      .mockReturnValueOnce(new Promise((done) => { resolve = done; }))
      .mockReturnValueOnce(new Promise(() => {}));
    const store = useNetwork();
    const request = store.refreshCanonicalNetwork();

    advanceRuntimeRevision("TEAM-RUN-20260817");
    resolve(snapshot("run-a-member"));

    await expect(request).resolves.toBe(false);
    expect(store.members).toEqual([]);
    expect(store.totalMembers).toBe(0);
  });

  it("drops a response captured before the account epoch changes", async () => {
    let resolve!: (value: ReturnType<typeof snapshot>) => void;
    remote.teamNetworkApi.snapshot
      .mockReturnValueOnce(new Promise((done) => { resolve = done; }))
      .mockResolvedValue(snapshot("account-b-member"));
    const store = useNetwork();
    const request = store.refreshCanonicalNetwork();

    store.bindAccount("account-b");
    resolve(snapshot("account-a-member"));

    await expect(request).resolves.toBe(false);
    await Promise.resolve();
    expect(store.members[0]?.id).toBe("account-b-member");
  });

  it("keeps sandbox facts unavailable instead of falling back to the local seed", async () => {
    remote.teamNetworkApi.snapshot.mockRejectedValue(new ApiError({
      kind: "http", status: 503, message: "TEAM_NETWORK_SANDBOX_FACTS_UNAVAILABLE",
    }));
    const store = useNetwork();

    await expect(store.refreshCanonicalNetwork()).resolves.toBe(false);
    expect(store.remoteStatus).toBe("error");
    expect(store.members).toEqual([]);
    expect(store.totalMembers).toBe(0);
    expect(store.totalMonthVolumeUSD).toBe(0);
  });
});
