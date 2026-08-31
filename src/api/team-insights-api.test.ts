import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { createTeamInsightsApi } from "./team-insights-api";

const COMMISSION_KINDS = ["unilevel", "binary", "peer", "cultivation", "leadership", "genesis"] as const;
function commissionAggregate(overrides: Record<string, unknown> = {}) {
  return {
    totalUSDT: 0, totalNEX: 0, directUSDT: 0, extendedUSDT: 0, contributorCount: 0,
    monthUSDT: 0, monthNEX: 0, todayUSDT: 0, unlockedUSDT: 0, unlockedNEX: 0, coolingUSDT: 0,
    eventCount: 0, nextUnlockAt: null,
    byKind: Object.fromEntries(COMMISSION_KINDS.map((kind) => [kind, { usdt: 0, nex: 0, count: 0 }])),
    ...overrides,
  };
}

describe("team unilevel API", () => {
  it("keeps server-wide commission totals and real contributors separate from the recent event feed", async () => {
    const request = vi.fn().mockResolvedValue({
      source: "server", serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "",
      events: [], generatedAt: "2026-08-13T00:00:00Z",
      aggregate: commissionAggregate({
        totalUSDT: 150, totalNEX: 20, directUSDT: 30, extendedUSDT: 120, contributorCount: 4,
        monthUSDT: 30, monthNEX: 5, todayUSDT: 5, unlockedUSDT: 30, unlockedNEX: 10, coolingUSDT: 120,
        eventCount: 101,
        byKind: {
          unilevel: { usdt: 30, nex: 10, count: 100 }, binary: { usdt: 120, nex: 10, count: 1 },
          peer: { usdt: 0, nex: 0, count: 0 }, cultivation: { usdt: 0, nex: 0, count: 0 },
          leadership: { usdt: 0, nex: 0, count: 0 }, genesis: { usdt: 0, nex: 0, count: 0 },
        },
      }),
    });

    await expect(createTeamInsightsApi({ request } as unknown as ApiClient).commissions()).resolves.toMatchObject({
      aggregate: { totalUSDT: 150, extendedUSDT: 120, contributorCount: 4 },
    });
  });

  it("keeps a full-history aggregate when the recent event feed is capped below it", async () => {
    const request = vi.fn().mockResolvedValue({
      source: "server", serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "",
      events: [], generatedAt: "2026-08-13T00:00:00Z",
      aggregate: commissionAggregate({
        totalUSDT: 150, totalNEX: 20, directUSDT: 30, extendedUSDT: 120, contributorCount: 4,
        monthUSDT: 30, monthNEX: 5, todayUSDT: 5, eventCount: 101,
        byKind: {
          unilevel: { usdt: 30, nex: 10, count: 100 }, binary: { usdt: 120, nex: 10, count: 1 },
          peer: { usdt: 0, nex: 0, count: 0 }, cultivation: { usdt: 0, nex: 0, count: 0 },
          leadership: { usdt: 0, nex: 0, count: 0 }, genesis: { usdt: 0, nex: 0, count: 0 },
        },
      }),
    });

    await expect(createTeamInsightsApi({ request } as unknown as ApiClient).commissions()).resolves.toMatchObject({
      events: [], aggregate: { eventCount: 101, monthUSDT: 30, byKind: { unilevel: { count: 100 } } },
    });
  });

  it("fails closed when full-history totals and kind buckets disagree", async () => {
    const request = vi.fn().mockResolvedValue({
      source: "server", serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "",
      events: [], generatedAt: "2026-08-13T00:00:00Z",
      aggregate: commissionAggregate({ totalUSDT: 1, directUSDT: 1, eventCount: 1 }),
    });

    await expect(createTeamInsightsApi({ request } as unknown as ApiClient).commissions())
      .rejects.toMatchObject({ message: "TEAM_INSIGHTS_RESPONSE_INVALID" });
  });

  it("accepts configured leadership eligibility and the cron-derived next settlement time", async () => {
    const request = vi.fn().mockResolvedValue({
      source: "server", serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "",
      currentWeekPoolUSDT: 100, myRank: 4, myVotes: 0, totalVotes: 0, mySharePct: 0,
      projectedPayoutUSDT: 0, distribution: [], history: [], nextPayoutAt: "2026-08-16T23:59:00Z",
      unlockRank: 5, injectRate: 0.05,
    });

    await expect(createTeamInsightsApi({ request } as unknown as ApiClient).leadershipPool()).resolves.toMatchObject({
      unlockRank: 5, injectRate: 0.05, nextPayoutAt: "2026-08-16T23:59:00Z",
    });
  });

  it("accepts server-owned cycle, source, layer and currency split", async () => {
    const request = vi.fn().mockResolvedValue({
      source: "server", serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "", period: "week",
      events: [{ id: "CM-21", source: "network", sourceUserName: "Bob", cycle: "2026-W33",
        layer: 1, orderId: "ORD-1", orderAmountUSD: 99, amountUSDT: 9.9, amountNEX: 50,
        currency: "USDT", status: "cooling", ts: 1755043200000, unlockAt: 1757635200000 }],
      split: { direct: { amountUSDT: 9.9, amountNEX: 50, count: 1 },
        extended: { amountUSDT: 0, amountNEX: 0, count: 0 } },
      generatedAt: "2026-08-13T00:00:00Z",
    });
    const api = createTeamInsightsApi({ request } as unknown as ApiClient);
    await expect(api.unilevel("week")).resolves.toMatchObject({
      period: "week", events: [{ cycle: "2026-W33", layer: 1 }], split: { direct: { count: 1 } },
    });
    expect(request).toHaveBeenCalledWith({ path: "/api/app/team/insights/unilevel?period=week" });
  });

  it("rejects unilevel events that expose source user ids", async () => {
    const request = vi.fn().mockResolvedValue({
      source: "server", serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "", period: "week",
      events: [{ id: "CM-21", source: "network", sourceUserId: "8", sourceUserName: "Bob", cycle: "2026-W33",
        layer: 1, orderId: null, orderAmountUSD: 0, amountUSDT: 1, amountNEX: 0, currency: "USDT",
        status: "cooling", ts: 1755043200000, unlockAt: 1757635200000 }],
      split: { direct: { amountUSDT: 1, amountNEX: 0, count: 1 }, extended: { amountUSDT: 0, amountNEX: 0, count: 0 } },
      generatedAt: "2026-08-13T00:00:00Z",
    });
    const api = createTeamInsightsApi({ request } as unknown as ApiClient);
    await expect(api.unilevel("week")).rejects.toMatchObject({ message: "TEAM_INSIGHTS_RESPONSE_INVALID" });
  });

  it("accepts canonical business settlement facts in development mode", async () => {
    const request = vi.fn().mockResolvedValue({
      source: "server", serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "",
      events: [{ id: "CM-1", kind: "unilevel", sourceUserName: "Alice", layer: 1,
        orderId: "ORD-1", orderAmountUSD: 99, amountUSDT: 9.9, amountNEX: 50,
        ts: 1755043200000, unlockAt: 1757635200000, status: "unlocked",
        settlementState: "CANONICAL", withdrawable: true }],
      aggregate: commissionAggregate({
        totalUSDT: 9.9, totalNEX: 50, directUSDT: 9.9, extendedUSDT: 0, contributorCount: 1,
        monthUSDT: 9.9, monthNEX: 50, todayUSDT: 9.9, unlockedUSDT: 9.9, unlockedNEX: 50, eventCount: 1,
        byKind: {
          unilevel: { usdt: 9.9, nex: 50, count: 1 }, binary: { usdt: 0, nex: 0, count: 0 },
          peer: { usdt: 0, nex: 0, count: 0 }, cultivation: { usdt: 0, nex: 0, count: 0 },
          leadership: { usdt: 0, nex: 0, count: 0 }, genesis: { usdt: 0, nex: 0, count: 0 },
        },
      }),
      generatedAt: "2026-08-13T00:00:00Z",
    });
    const api = createTeamInsightsApi({ request } as unknown as ApiClient, "dev");

    await expect(api.commissions()).resolves.toMatchObject({
      sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true,
      events: [{ id: "CM-1", status: "unlocked", withdrawable: true }],
    });
    expect(request).toHaveBeenCalledWith({ path: "/api/app/team/insights/commissions" });
  });

  it("rejects team facts without explicit server canonical provenance", async () => {
    const request = vi.fn().mockResolvedValue({
      source: "server", sourceEnvironment: "PRODUCTION", runId: "",
      factStatus: "SIMULATED", withdrawable: false, payoutStatus: "NON_WITHDRAWABLE",
      events: [], generatedAt: "2026-08-13T00:00:00Z",
    });
    const api = createTeamInsightsApi({ request } as unknown as ApiClient, "dev");

    await expect(api.commissions()).rejects.toMatchObject({ message: "TEAM_INSIGHTS_RESPONSE_INVALID" });
  });

  it("rejects retired simulated settlement facts in development mode", async () => {
    const request = vi.fn().mockResolvedValue({
      source: "server", serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "",
      factStatus: "SIMULATED", withdrawable: false, payoutStatus: "NON_WITHDRAWABLE",
      events: [{ id: "SB-CM-1", kind: "unilevel", sourceUserName: "Sandbox A1", layer: 1,
        orderId: "SB-ORD-1", orderAmountUSD: 99, amountUSDT: 9.9, amountNEX: 50,
        ts: 1755043200000, unlockAt: 1757635200000, status: "SIMULATED",
        settlementState: "SIMULATED", withdrawable: false }],
      generatedAt: "2026-08-13T00:00:00Z",
    });
    const api = createTeamInsightsApi({ request } as unknown as ApiClient, "dev");

    await expect(api.commissions()).rejects.toMatchObject({ message: "TEAM_INSIGHTS_RESPONSE_INVALID" });
  });

});
