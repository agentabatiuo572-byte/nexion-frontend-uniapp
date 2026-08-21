import { describe, expect, it, vi } from "vitest";
import { readGenesisRemoteFacts } from "./genesis-remote-sync";
import type { GenesisAccountState, GenesisEligibility, GenesisPublicState } from "@/api/genesis-api";

function eligibility(): GenesisEligibility {
  return {
    sourceEnvironment: "SANDBOX",
    runId: "seven-closures-20260817",
    eligible: true,
    reasons: ["HOLDINGS_CONFIRMED"],
    ownedCount: 10,
    maxPerUser: 20,
    remainingCap: 10,
    minAccountAgeDays: 0,
    accountAgeDays: 1,
    hasGenesisInvite: false,
    holderStatus: "READY",
    reservedAllocation: 800002.5,
    reservedAllocationUnit: "NEX",
    priorityRank: 1,
    priorityTier: "TOP_1",
    qualificationReasonCodes: ["HOLDINGS_CONFIRMED", "POLICY_CONFIRMED"],
    policyVersion: "genesis-holder-v1",
    effectiveAt: Date.parse("2026-08-17T00:00:00Z"),
    asOf: Date.parse("2026-08-18T07:18:13Z"),
    serverTime: Date.parse("2026-08-18T07:18:13Z"),
    provenance: {
      source: "nx_genesis_sandbox_holding+nx_config_item",
      environment: "SANDBOX",
      runId: "seven-closures-20260817",
    },
  };
}

function account(): GenesisAccountState {
  return { eligibility: eligibility() } as GenesisAccountState;
}

describe("Genesis remote fact orchestration", () => {
  it("keeps holder facts when the unrelated public state projection is unavailable", async () => {
    const applied: { account?: GenesisAccountState; eligibility?: GenesisEligibility } = {};
    const api = {
      state: vi.fn<() => Promise<GenesisPublicState>>().mockRejectedValue(new Error("PUBLIC_STATE_SCHEMA_MISMATCH")),
      account: vi.fn<() => Promise<GenesisAccountState>>().mockResolvedValue(account()),
      eligibility: vi.fn<() => Promise<GenesisEligibility>>().mockResolvedValue(eligibility()),
    };

    await expect(readGenesisRemoteFacts(api, {
      hasAuthority: () => true,
      isCurrent: () => true,
      clear: vi.fn(),
      applyPublicState: vi.fn(),
      applyAccount: (value) => { applied.account = value; },
      applyEligibility: (value) => { applied.eligibility = value; },
    })).resolves.toBe(true);

    expect(applied.account?.eligibility.holderStatus).toBe("READY");
    expect(applied.eligibility?.reservedAllocation).toBe(800002.5);
  });

  it("fails closed before any request for the wrong account", async () => {
    const api = {
      state: vi.fn(),
      account: vi.fn(),
      eligibility: vi.fn(),
    };
    const clear = vi.fn();

    await expect(readGenesisRemoteFacts(api, {
      hasAuthority: () => false,
      isCurrent: () => true,
      clear,
      applyPublicState: vi.fn(),
      applyAccount: vi.fn(),
      applyEligibility: vi.fn(),
    })).resolves.toBe(false);

    expect(clear).toHaveBeenCalledOnce();
    expect(api.state).not.toHaveBeenCalled();
    expect(api.account).not.toHaveBeenCalled();
    expect(api.eligibility).not.toHaveBeenCalled();
  });

  it("drops a response after the account or RunID scope becomes stale", async () => {
    let current = true;
    let resolveAccount!: (value: GenesisAccountState) => void;
    const accountPromise = new Promise<GenesisAccountState>((resolve) => { resolveAccount = resolve; });
    const api = {
      state: vi.fn<() => Promise<GenesisPublicState>>().mockResolvedValue({} as GenesisPublicState),
      account: vi.fn<() => Promise<GenesisAccountState>>().mockReturnValue(accountPromise),
      eligibility: vi.fn<() => Promise<GenesisEligibility>>().mockResolvedValue(eligibility()),
    };
    const applyAccount = vi.fn();
    const applyEligibility = vi.fn();

    const pending = readGenesisRemoteFacts(api, {
      hasAuthority: () => true,
      isCurrent: () => current,
      clear: vi.fn(),
      applyPublicState: vi.fn(),
      applyAccount,
      applyEligibility,
    });
    current = false;
    resolveAccount(account());
    const result = await pending;

    expect(result).toBe(false);
    expect(applyAccount).not.toHaveBeenCalled();
    expect(applyEligibility).not.toHaveBeenCalled();
  });

  it("clears instead of committing when the bearer becomes unauthorized mid-flight", async () => {
    let authorized = true;
    let resolveAccount!: (value: GenesisAccountState) => void;
    const api = {
      state: vi.fn<() => Promise<GenesisPublicState>>().mockResolvedValue({} as GenesisPublicState),
      account: vi.fn<() => Promise<GenesisAccountState>>().mockImplementation(() => new Promise((resolve) => { resolveAccount = resolve; })),
      eligibility: vi.fn<() => Promise<GenesisEligibility>>().mockResolvedValue(eligibility()),
    };
    const clear = vi.fn();
    const applyAccount = vi.fn();

    const pending = readGenesisRemoteFacts(api, {
      hasAuthority: () => authorized,
      isCurrent: () => true,
      clear,
      applyPublicState: vi.fn(),
      applyAccount,
      applyEligibility: vi.fn(),
    });
    authorized = false;
    resolveAccount(account());

    await expect(pending).resolves.toBe(false);
    expect(clear).toHaveBeenCalledOnce();
    expect(applyAccount).not.toHaveBeenCalled();
  });
});
