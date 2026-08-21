import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { createTeamInsightsApi } from "./team-insights-api";

describe("team unilevel API", () => {
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

  it("accepts stable server-generated development facts", async () => {
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

    await expect(api.commissions()).resolves.toMatchObject({
      sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true,
      factStatus: "SIMULATED", withdrawable: false, events: [{ id: "SB-CM-1", status: "simulated", withdrawable: false }],
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

  it("rejects sandbox commissions without the non-withdrawable simulated contract", async () => {
    const request = vi.fn().mockResolvedValue({
      source: "server", serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "",
      events: [], generatedAt: "2026-08-13T00:00:00Z",
    });
    const api = createTeamInsightsApi({ request } as unknown as ApiClient, "dev");

    await expect(api.commissions()).rejects.toMatchObject({ message: "TEAM_INSIGHTS_RESPONSE_INVALID" });
  });

});
