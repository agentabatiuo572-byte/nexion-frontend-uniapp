import { describe, expect, it, vi } from "vitest";
import { readGenesisRemoteFacts } from "./genesis-remote-sync";
import type { GenesisAccountState, GenesisEligibility, GenesisPublicState } from "@/api/genesis-api";
import { ApiError } from "@/api/errors";

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
    const applyPublicState = vi.fn();
    const api = {
      state: vi.fn<() => Promise<GenesisPublicState>>().mockRejectedValue(new Error("PUBLIC_STATE_SCHEMA_MISMATCH")),
      account: vi.fn<() => Promise<GenesisAccountState>>().mockResolvedValue(account()),
      eligibility: vi.fn<() => Promise<GenesisEligibility>>().mockResolvedValue(eligibility()),
    };

    await expect(readGenesisRemoteFacts(api, {
      hasAuthority: () => true,
      isCurrent: () => true,
      clear: vi.fn(),
      clearAccount: vi.fn(),
      applyPublicState,
      applyAccount: (value) => { applied.account = value; },
      applyEligibility: (value) => { applied.eligibility = value; },
    })).resolves.toBe(true);

    expect(applied.account?.eligibility.holderStatus).toBe("READY");
    expect(applied.eligibility?.reservedAllocation).toBe(800002.5);
    expect(applyPublicState).not.toHaveBeenCalled();
  });

  it("applies the authenticated account projection after public state so its scoped supply stays visible", async () => {
    const calls: string[] = [];
    const api = {
      state: vi.fn<() => Promise<GenesisPublicState>>().mockResolvedValue({} as GenesisPublicState),
      account: vi.fn<() => Promise<GenesisAccountState>>().mockResolvedValue(account()),
      eligibility: vi.fn<() => Promise<GenesisEligibility>>().mockResolvedValue(eligibility()),
    };

    await readGenesisRemoteFacts(api, {
      hasAuthority: () => true,
      isCurrent: () => true,
      clear: vi.fn(),
      clearAccount: vi.fn(),
      applyPublicState: () => { calls.push("public"); },
      applyAccount: () => { calls.push("account"); },
      applyEligibility: () => { calls.push("eligibility"); },
    });

    expect(calls).toEqual(["public", "account", "eligibility"]);
  });

  it("keeps public supply facts when protected account projections are unavailable", async () => {
    const publicState = {} as GenesisPublicState;
    const clear = vi.fn();
    const clearAccount = vi.fn();
    const applyPublicState = vi.fn();
    const api = {
      state: vi.fn<() => Promise<GenesisPublicState>>().mockResolvedValue(publicState),
      account: vi.fn<() => Promise<GenesisAccountState>>().mockRejectedValue(new Error("ACCOUNT_UNAVAILABLE")),
      eligibility: vi.fn<() => Promise<GenesisEligibility>>().mockRejectedValue(new Error("ELIGIBILITY_UNAVAILABLE")),
    };

    await expect(readGenesisRemoteFacts(api, {
      hasAuthority: () => true,
      isCurrent: () => true,
      clear,
      clearAccount,
      applyPublicState,
      applyAccount: vi.fn(),
      applyEligibility: vi.fn(),
    })).resolves.toBe(true);

    expect(clear).not.toHaveBeenCalled();
    expect(clearAccount).toHaveBeenCalledOnce();
    expect(applyPublicState).toHaveBeenCalledWith(publicState);
  });

  it("preserves a stable RunID isolation reason instead of misreporting a policy rejection", async () => {
    const publicState = {} as GenesisPublicState;
    const applyEligibilityError = vi.fn();
    const isolationError = new ApiError({
      kind: "business",
      message: "GENESIS_SANDBOX_USER_RUN_CONFLICT",
      status: 409,
      code: 409,
    });
    const api = {
      state: vi.fn<() => Promise<GenesisPublicState>>().mockResolvedValue(publicState),
      account: vi.fn<() => Promise<GenesisAccountState>>().mockRejectedValue(isolationError),
      eligibility: vi.fn<() => Promise<GenesisEligibility>>().mockRejectedValue(isolationError),
    };

    await expect(readGenesisRemoteFacts(api, {
      hasAuthority: () => true,
      isCurrent: () => true,
      clear: vi.fn(),
      clearAccount: vi.fn(),
      applyEligibilityError,
      applyPublicState: vi.fn(),
      applyAccount: vi.fn(),
      applyEligibility: vi.fn(),
    })).resolves.toBe(true);

    expect(applyEligibilityError).toHaveBeenCalledWith("GENESIS_SANDBOX_USER_RUN_CONFLICT");
  });

  it("logs only stable protected-read categories and never raw backend messages", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const api = {
      state: vi.fn<() => Promise<GenesisPublicState>>().mockResolvedValue({} as GenesisPublicState),
      account: vi.fn<() => Promise<GenesisAccountState>>().mockRejectedValue(new Error("private gateway detail")),
      eligibility: vi.fn<() => Promise<GenesisEligibility>>().mockRejectedValue(new Error("internal SQL detail")),
    };

    await readGenesisRemoteFacts(api, {
      hasAuthority: () => true,
      isCurrent: () => true,
      clear: vi.fn(),
      clearAccount: vi.fn(),
      applyPublicState: vi.fn(),
      applyAccount: vi.fn(),
      applyEligibility: vi.fn(),
    });

    expect(warn).toHaveBeenCalledWith("GENESIS_PROTECTED_READ_UNAVAILABLE", {
      reason: "GENESIS_ELIGIBILITY_UNAVAILABLE",
      accountAvailable: false,
      eligibilityAvailable: false,
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private gateway detail");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("internal SQL detail");
    warn.mockRestore();
  });

  it("keeps public supply facts without issuing protected reads for an anonymous account", async () => {
    const publicState = {} as GenesisPublicState;
    const api = {
      state: vi.fn<() => Promise<GenesisPublicState>>().mockResolvedValue(publicState),
      account: vi.fn(),
      eligibility: vi.fn(),
    };
    const clear = vi.fn();
    const clearAccount = vi.fn();
    const applyPublicState = vi.fn();

    await expect(readGenesisRemoteFacts(api, {
      hasAuthority: () => false,
      isCurrent: () => true,
      clear,
      clearAccount,
      applyPublicState,
      applyAccount: vi.fn(),
      applyEligibility: vi.fn(),
    })).resolves.toBe(true);

    expect(clear).not.toHaveBeenCalled();
    expect(clearAccount).toHaveBeenCalledOnce();
    expect(applyPublicState).toHaveBeenCalledWith(publicState);
    expect(api.state).toHaveBeenCalledOnce();
    expect(api.account).not.toHaveBeenCalled();
    expect(api.eligibility).not.toHaveBeenCalled();
  });

  it("clears all remote facts when anonymous public state is unavailable", async () => {
    const api = {
      state: vi.fn<() => Promise<GenesisPublicState>>().mockRejectedValue(new Error("PUBLIC_STATE_UNAVAILABLE")),
      account: vi.fn(),
      eligibility: vi.fn(),
    };
    const clear = vi.fn();
    const clearAccount = vi.fn();

    await expect(readGenesisRemoteFacts(api, {
      hasAuthority: () => false,
      isCurrent: () => true,
      clear,
      clearAccount,
      applyPublicState: vi.fn(),
      applyAccount: vi.fn(),
      applyEligibility: vi.fn(),
    })).resolves.toBe(false);

    expect(clear).toHaveBeenCalledOnce();
    expect(clearAccount).not.toHaveBeenCalled();
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
      clearAccount: vi.fn(),
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
      clearAccount: vi.fn(),
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
