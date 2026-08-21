import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenesisApi, parseGenesisPublicState } from "./genesis-api";
import { setCurrentCommerceSandboxRun } from "./order-api";

describe("genesis remote truth contract", () => {
  beforeEach(() => setCurrentCommerceSandboxRun(null));
  it("reads eligibility from the dedicated server endpoint", async () => {
    const request = vi.fn().mockResolvedValue({
      serverCanonical: true,
      sourceEnvironment: "PRODUCTION",
      runId: "",
      eligible: false,
      reasons: ["ACCOUNT_AGE_REQUIRED"],
      ownedCount: 0,
      maxPerUser: 2,
      remainingCap: 2,
      minAccountAgeDays: 30,
      accountAgeDays: 1,
      hasGenesisInvite: false,
      status: "NOT_ELIGIBLE",
      reservedAllocation: null,
      reservedAllocationUnit: "NEX",
      priorityRank: null,
      priorityTier: "NONE",
      qualificationReasonCodes: ["ACCOUNT_AGE_REQUIRED", "NO_ACTIVE_HOLDINGS"],
      policyVersion: null,
      effectiveAt: null,
      asOf: "2026-08-17T00:00:00Z",
      serverTime: "2026-08-17T00:00:01Z",
      provenance: { source: "nx_genesis_holding+nx_config_item", environment: "PRODUCTION", runId: "" },
      mode: "any-of",
      appliesTo: "both",
      halted: false,
    });
    const api = createGenesisApi({ request } as never);

    await expect(api.eligibility()).resolves.toMatchObject({
      eligible: false,
      maxPerUser: 2,
      reasons: ["ACCOUNT_AGE_REQUIRED"],
    });
    expect(request).toHaveBeenCalledWith({
      method: "GET", path: "/api/genesis/eligibility", authenticated: true,
    });
  });

  it("keeps unavailable market metrics null and accepts a negative server floor delta", () => {
    const state = parseGenesisPublicState({
      serverCanonical: true,
      sourceEnvironment: "PRODUCTION",
      runId: "",
      halted: true,
      revision: "rev-17",
      source: "nx_emergency_control_setting:killswitch.genesis",
      series: {
        seriesCode: "genesis-main", name: "Genesis", totalSupply: 1000,
        soldSupply: 0, remainingSupply: 1000, priceUsdt: 9999,
        royaltyPct: 2.5, dailyEmissionRatePct: 0,
      },
      market: { enabled: true },
      emission: { open: false },
      sale: {
        serverCanonical: true, available: true, eligibilityEnabled: true,
        maxPerUser: 5, minAccountAgeDays: 0, presaleEnabled: false,
        showCountdown: false, unitPriceUsdt: 9999, open: true,
      },
      listings: [], transactions: [], tiers: [{ id: "tier-1", from: 0, to: 1000, priceUSDT: 9999 }],
      tiersVersion: 1, marketOpenState: "open", marketOpenStateVersion: 1,
      closedNoticeKey: "default", catalogAvailable: true, tradeAvailable: true,
      tradeBlockedReason: "NONE", marketStats: {
        floorUsdt: null, volume24hUsdt: null, owners: null,
        floorDeltaPct: -12.5, lastSaleUsdt: null,
      },
    });

    expect(state.marketStats).toEqual({
      floorUsdt: null, volume24hUsdt: null, owners: null,
      floorDeltaPct: -12.5, lastSaleUsdt: null,
    });
    expect(state.halted).toBe(true);
    expect(state.revision).toBe("rev-17");
    expect(state.source).toBe("nx_emergency_control_setting:killswitch.genesis");
  });

  it("accepts the PC-managed production Genesis projection in development", () => {
    expect(parseGenesisPublicState({
      serverCanonical: true,
      sourceEnvironment: "PRODUCTION",
      runId: "",
      halted: false,
      revision: "g4-config-v1",
      source: "nx_emergency_control_setting:killswitch.genesis",
      series: {
        seriesCode: "genesis-main", name: "Genesis", totalSupply: 1000,
        soldSupply: 0, remainingSupply: 1000, priceUsdt: 9999,
        royaltyPct: 2.5, dailyEmissionRatePct: 0,
      },
      market: { enabled: false }, emission: { open: false },
      sale: {
        serverCanonical: true, available: false, eligibilityEnabled: true,
        maxPerUser: 5, minAccountAgeDays: 0, presaleEnabled: false,
        showCountdown: false, unitPriceUsdt: 9999, open: false,
      },
      listings: [], transactions: [], tiers: [{ id: "t1", from: 0, to: 1000, priceUSDT: 9999 }], tiersVersion: 1,
      marketOpenState: "closed", marketOpenStateVersion: 1,
      closedNoticeKey: "default", catalogAvailable: true, tradeAvailable: false,
      tradeBlockedReason: "SALE_POLICY_UNAVAILABLE",
      marketStats: { floorUsdt: null, volume24hUsdt: null, owners: null, floorDeltaPct: null, lastSaleUsdt: null },
    }, "dev")).toMatchObject({
      sourceEnvironment: "PRODUCTION", runId: "", marketOpenState: "closed",
    });
  });

  it("strictly parses holder allocation, priority, reasons, policy version and provenance", async () => {
    const request = vi.fn().mockResolvedValue({
      serverCanonical: true,
      sourceEnvironment: "PRODUCTION",
      runId: "",
      eligible: true,
      reasons: ["HOLDINGS_CONFIRMED"],
      qualificationReasonCodes: ["HOLDINGS_CONFIRMED"],
      ownedCount: 2,
      maxPerUser: 5,
      remainingCap: 3,
      minAccountAgeDays: 0,
      accountAgeDays: 120,
      hasGenesisInvite: false,
      reservedAllocation: 251,
      reservedAllocationUnit: "NEX",
      priorityRank: 2,
      priorityTier: "TOP_3",
      policyVersion: "genesis-holder-v2",
      effectiveAt: "2026-07-01T00:00:00Z",
      asOf: "2026-08-17T00:00:00Z",
      serverTime: "2026-08-17T00:00:01Z",
      provenance: { source: "nx_genesis_holding+nx_config_item", environment: "PRODUCTION", runId: "" },
      status: "READY",
      mode: "any-of",
      appliesTo: "both",
      halted: false,
    });
    const api = createGenesisApi({ request } as never);
    await expect(api.eligibility()).resolves.toMatchObject({
      reservedAllocation: 251,
      reservedAllocationUnit: "NEX",
      priorityRank: 2,
      priorityTier: "TOP_3",
      policyVersion: "genesis-holder-v2",
      qualificationReasonCodes: ["HOLDINGS_CONFIRMED"],
    });
  });

  it("accepts a canonical production holding with zero acquisition price in development", async () => {
    const holder = {
      holdingNo: "G4-FIX-1",
      seriesCode: "GENESIS-MAIN",
      acquiredPriceUsdt: 0,
      status: "ACTIVE",
      listingPriceUsdt: null,
      acquiredAt: "2026-08-18T00:00:00Z",
      listedAt: null,
    };
    const eligibility = {
      eligible: true, reasons: ["HOLDINGS_CONFIRMED"], qualificationReasonCodes: ["HOLDINGS_CONFIRMED"],
      ownedCount: 1, maxPerUser: 20, remainingCap: 19, minAccountAgeDays: 0, accountAgeDays: 1,
      hasGenesisInvite: false, status: "READY", reservedAllocation: 80000.25, reservedAllocationUnit: "NEX",
      priorityRank: 1, priorityTier: "TOP_1", policyVersion: "genesis-holder-v1",
      effectiveAt: "2026-08-17T00:00:00Z", asOf: "2026-08-18T00:00:00Z", serverTime: "2026-08-18T00:00:00Z",
      provenance: { source: "nx_genesis_holding+nx_config_item", environment: "PRODUCTION", runId: "" },
      serverCanonical: true, source: "nx_genesis_holding+nx_config_item", sourceEnvironment: "PRODUCTION", runId: "",
    };
    const request = vi.fn().mockResolvedValue({
      sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true, source: "nx_genesis_holding+nx_config_item",
      series: { seriesCode: "GENESIS-MAIN", name: "Genesis", totalSupply: 1000, soldSupply: 0, remainingSupply: 1000, priceUsdt: 10, royaltyPct: 0, dailyEmissionRatePct: 0 },
      sale: { serverCanonical: true, available: true, eligibilityEnabled: true, maxPerUser: 20, minAccountAgeDays: 0, presaleEnabled: false, showCountdown: false, unitPriceUsdt: 10, open: true },
      marketEnabled: true, emissionOpen: false, holdings: [holder], emissions: [], walletBalanceUsdt: 1000, eligibility,
    });
    await expect(createGenesisApi({ request } as never, "dev").account()).resolves.toMatchObject({
      holdings: [{ holdingNo: "G4-FIX-1", acquiredPriceUsdt: 0 }],
      eligibility: { holderStatus: "READY", reservedAllocation: 80000.25 },
    });
  });

  it("rejects malformed holder facts instead of showing a generic verified badge", async () => {
    const request = vi.fn().mockResolvedValue({
      serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "", eligible: true,
      reasons: [], ownedCount: 1, maxPerUser: 5, remainingCap: 4,
      minAccountAgeDays: 0, accountAgeDays: 10, hasGenesisInvite: false,
    });
    await expect(createGenesisApi({ request } as never).eligibility())
      .rejects.toMatchObject({ message: "GENESIS_RESPONSE_INVALID" });
  });

  it("rejects a holder fact fenced to a different environment or run", async () => {
    const request = vi.fn().mockResolvedValue({
      serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "", eligible: true,
      reasons: [], qualificationReasonCodes: ["HOLDINGS_CONFIRMED"], ownedCount: 1, maxPerUser: 5,
      remainingCap: 4, minAccountAgeDays: 0, accountAgeDays: 10, hasGenesisInvite: false,
      status: "READY", reservedAllocation: 100, reservedAllocationUnit: "NEX", priorityRank: 1,
      priorityTier: "TOP_1", policyVersion: "v1", effectiveAt: "2026-07-01T00:00:00Z",
      asOf: "2026-08-17T00:00:00Z", serverTime: "2026-08-17T00:00:00Z",
      provenance: { source: "nx_genesis_holding+nx_config_item", environment: "SANDBOX", runId: "other-run" },
    });
    await expect(createGenesisApi({ request } as never).eligibility())
      .rejects.toMatchObject({ message: "GENESIS_RESPONSE_INVALID" });
  });

  it("rejects a public state without the canonical kill-switch projection", () => {
    expect(() => parseGenesisPublicState({})).toThrow("GENESIS_RESPONSE_INVALID");
  });

  it("rejects a sandbox HOLD projection from a previous run", () => {
    setCurrentCommerceSandboxRun("sandbox-run-2");
    expect(() => parseGenesisPublicState({
      serverCanonical: true,
      halted: true,
      revision: "sandbox:sandbox-run-1",
      source: "mock:server-genesis-sandbox-hold",
      sourceEnvironment: "SANDBOX",
      runId: "sandbox-run-1",
      series: { seriesCode: "GENESIS-SANDBOX-HOLD", name: "Genesis Sandbox (HOLD)", totalSupply: 0, soldSupply: 0, remainingSupply: 0, priceUsdt: 1, royaltyPct: 0, dailyEmissionRatePct: 0 },
      market: { enabled: false }, emission: { open: false }, listings: [], transactions: [],
      tiers: [], tiersVersion: 1, marketOpenState: "closed", marketOpenStateVersion: 1,
      closedNoticeKey: "GENESIS_SANDBOX_HOLD", catalogAvailable: false, tradeAvailable: false,
      tradeBlockedReason: "GENESIS_SANDBOX_HOLD", sale: {
        serverCanonical: true, available: false, eligibilityEnabled: true, maxPerUser: 0,
        minAccountAgeDays: 0, presaleEnabled: false, showCountdown: false, unitPriceUsdt: 1, open: false,
      }, marketStats: { floorUsdt: null, volume24hUsdt: null, owners: null, floorDeltaPct: null, lastSaleUsdt: null },
    }, "dev")).toThrow("GENESIS_RESPONSE_INVALID");
  });

  it("requires canonical environment provenance on invite redemption", async () => {
    const inviteCode = ["NEXGRID", "OG", "1234567890ABCDEF"].join("-");
    const missingAuthority = createGenesisApi({ request: vi.fn().mockResolvedValue({ code: inviteCode, status: "used" }) } as never);
    await expect(missingAuthority.redeem(inviteCode)).rejects.toThrow("GENESIS_RESPONSE_INVALID");

    const canonical = createGenesisApi({ request: vi.fn().mockResolvedValue({
      serverCanonical: true,
      sourceEnvironment: "PRODUCTION",
      runId: "",
      source: "nx_genesis_invite_code",
      code: inviteCode,
      status: "used",
    }) } as never);
    await expect(canonical.redeem(inviteCode)).resolves.toMatchObject({
      code: inviteCode,
      sourceEnvironment: "PRODUCTION",
      runId: "",
    });
  });
});
