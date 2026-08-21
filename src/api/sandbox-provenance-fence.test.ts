import { describe, expect, it, vi } from "vitest";
import { createTeamInsightsApi } from "./team-insights-api";
import { createProofApi } from "./proof-api";
import { createGenesisPointsApi } from "./genesis-points-api";
import { createDeveloperAccessApi } from "./developer-access-api";
import { createDeveloperResourcesApi } from "./developer-resources-api";

const RUN = "catalog-run-20260816";
const OTHER_RUN = "catalog-run-20260817";
const generatedAt = "2026-08-16T00:00:00Z";

const teamPool = (environment: "PRODUCTION" | "SANDBOX", runId: string) => ({
  source: "server", serverCanonical: true, sourceEnvironment: environment, runId,
  currentWeekPoolUSDT: 100, myRank: 3, myVotes: 10, totalVotes: 100,
  mySharePct: 0.1, projectedPayoutUSDT: 10,
  distribution: [{ vRank: 3, people: 1, votes: 10 }],
  history: [{ weekId: "2026-W33", payoutUSDT: 5 }],
  nextPayoutAt: "2026-08-23T00:00:00Z",
});

const proof = (environment: "PRODUCTION" | "SANDBOX", runId: string) => ({
  source: "server", serverCanonical: true, sourceEnvironment: environment, runId, generatedAt, joinedAt: generatedAt,
  serverTime: generatedAt, asOf: "2026-08-16",
  provenance: { source: "server", environment, runId, timeZone: "Asia/Ho_Chi_Minh", streakRule: "rule", percentileRule: "rule" },
  activeDays: 1, onlineDevices: 1, currentStreak: 1, longestStreak: 1, topPercentile: 1, earningsTotalUsdt: 1,
  referralCode: "NXAB12CD34EF", referral: { invitedCount: 1, lifetimeInviterNex: 1 },
  team: { totalMembers: 1, activeMembers: 1 },
  availability: { status: "READY" },
});

const genesis = (environment: "PRODUCTION" | "SANDBOX", runId: string) => ({
  source: "nx_genesis_holding", sourceEnvironment: environment, runId,
  pointsPerHolding: 1000, leaderboard: [{ rank: 1, handle: "Ali***", points: 1000, holdings: 1 }],
  currentUser: { rank: 1, points: 1000, holdings: 1 }, generatedAt,
});

const access = (environment: "PRODUCTION" | "SANDBOX", runId: string) => ({
  requestNo: "DEV-1", idempotencyKey: "idem-1", status: "PENDING", submittedAt: generatedAt,
  source: "server", sourceEnvironment: environment, runId,
});

const key = (environment: "PRODUCTION" | "SANDBOX", runId: string) => ({
  id: 1, keyId: "key-1", name: "build", prefix: "sk_live_", last4: "wxyz", status: "ACTIVE",
  source: "server", sourceEnvironment: environment, runId, createdAt: generatedAt,
});

describe("development and production provenance fence", () => {
  it("requires production APIs to return PRODUCTION with an empty runId", async () => {
    const cases = [
      ["team", createTeamInsightsApi({ request: vi.fn().mockResolvedValue(teamPool("SANDBOX", RUN)) } as never), (api: ReturnType<typeof createTeamInsightsApi>) => api.leadershipPool()],
      ["proof", createProofApi({ request: vi.fn().mockResolvedValue(proof("SANDBOX", RUN)) } as never), (api: ReturnType<typeof createProofApi>) => api.snapshot()],
      ["genesis", createGenesisPointsApi({ request: vi.fn().mockResolvedValue(genesis("SANDBOX", RUN)) } as never), (api: ReturnType<typeof createGenesisPointsApi>) => api.projection()],
      ["access", createDeveloperAccessApi({ request: vi.fn().mockResolvedValue(access("SANDBOX", RUN)) } as never), (api: ReturnType<typeof createDeveloperAccessApi>) => api.latest()],
      ["resources", createDeveloperResourcesApi({ request: vi.fn().mockResolvedValue([key("SANDBOX", RUN)]) } as never), (api: ReturnType<typeof createDeveloperResourcesApi>) => api.listKeys()],
    ] as const;
    for (const [, api, call] of cases) await expect(call(api as never)).rejects.toMatchObject({ kind: "protocol" });
  });

  it("rejects the retired sandbox rail in development as well", async () => {
    const cases = [
      [createTeamInsightsApi({ request: vi.fn().mockResolvedValue(teamPool("SANDBOX", OTHER_RUN)) } as never), (api: ReturnType<typeof createTeamInsightsApi>) => api.leadershipPool()],
      [createProofApi({ request: vi.fn().mockResolvedValue(proof("SANDBOX", OTHER_RUN)) } as never), (api: ReturnType<typeof createProofApi>) => api.snapshot()],
      [createGenesisPointsApi({ request: vi.fn().mockResolvedValue(genesis("SANDBOX", OTHER_RUN)) } as never), (api: ReturnType<typeof createGenesisPointsApi>) => api.projection()],
      [createDeveloperAccessApi({ request: vi.fn().mockResolvedValue(access("SANDBOX", OTHER_RUN)) } as never), (api: ReturnType<typeof createDeveloperAccessApi>) => api.latest()],
      [createDeveloperResourcesApi({ request: vi.fn().mockResolvedValue([key("SANDBOX", OTHER_RUN)]) } as never), (api: ReturnType<typeof createDeveloperResourcesApi>) => api.listKeys()],
    ] as const;
    for (const [api, call] of cases) await expect(call(api as never)).rejects.toMatchObject({ kind: "protocol" });
  });

  it("accepts only the production authority rail in either build environment", async () => {
    await expect(createProofApi({ request: vi.fn().mockResolvedValue(proof("PRODUCTION", "")) } as never, "prod").snapshot()).resolves.toBeTruthy();
    await expect(createProofApi({ request: vi.fn().mockResolvedValue(proof("PRODUCTION", "")) } as never, "dev").snapshot()).resolves.toBeTruthy();
  });
});
