import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { setCurrentCommerceSandboxRun } from "./order-api";
import { createCommissionConfigApi } from "./commission-config-api";

const RUN = "commission-run-20260817";
const OTHER_RUN = "commission-run-20260818";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    source: "nx_commission_rule + nx_config_item",
    serverCanonical: true,
    sourceEnvironment: "PRODUCTION",
    runId: null,
    unilevel: [
      { level: "L1", usdtPct: 10, nexReward: 50 },
      { level: "L2", usdtPct: 5, nexReward: 20 },
      { level: "L3", usdtPct: 3, nexReward: 10 },
      { level: "L4", usdtPct: 2, nexReward: 5 },
      { level: "L5", usdtPct: 1, nexReward: 2.5 },
      { level: "L6", usdtPct: 0.5, nexReward: 1 },
      { level: "L7", usdtPct: 0.5, nexReward: 1 },
    ],
    partnerTiersJson: JSON.stringify({ standard: 0, verified: 5000, premium: 50000, diamond: 500000 }),
    influenceClampMin: 1,
    influenceClampMax: 5,
    coolingDays: 30,
    promoMultiplier: 1,
    ...overrides,
  };
}

afterEach(() => setCurrentCommerceSandboxRun(null));

describe("commission config provenance and protocol", () => {
  it("accepts canonical production rates and exposes every F2 field", async () => {
    const api = createCommissionConfigApi({ request: vi.fn().mockResolvedValue(payload()) } as unknown as ApiClient, "prod");
    await expect(api.rates()).resolves.toMatchObject({
      sourceEnvironment: "PRODUCTION", runId: null, coolingDays: 30, promoMultiplier: 1,
      partnerThresholds: { verified: 5000, premium: 50000 }, unilevelUsdt: { 1: 0.1, 7: 0.005 },
    });
  });

  it("accepts sandbox rates only for the current RunID and rejects production on sandbox", async () => {
    setCurrentCommerceSandboxRun(RUN);
    const api = createCommissionConfigApi({ request: vi.fn().mockResolvedValue(payload({
      source: "nx_commission_rule + nx_config_item", sourceEnvironment: "SANDBOX", runId: RUN,
    })) } as unknown as ApiClient, "dev");
    await expect(api.rates()).resolves.toMatchObject({ sourceEnvironment: "SANDBOX", runId: RUN });
    await expect(createCommissionConfigApi({ request: vi.fn().mockResolvedValue(payload({ sourceEnvironment: "SANDBOX", runId: OTHER_RUN })) } as unknown as ApiClient, "dev").rates()).rejects.toMatchObject({ kind: "protocol" });
    await expect(createCommissionConfigApi({ request: vi.fn().mockResolvedValue(payload()) } as unknown as ApiClient, "dev").rates()).rejects.toMatchObject({ kind: "protocol" });
  });

  it("rejects malformed or non-canonical responses instead of applying local defaults", async () => {
    const malformed = payload({ unilevel: [{ level: "L1", usdtPct: 10, nexReward: 50 }] });
    await expect(createCommissionConfigApi({ request: vi.fn().mockResolvedValue(malformed) } as unknown as ApiClient, "prod").rates()).rejects.toMatchObject({ kind: "protocol" });
    await expect(createCommissionConfigApi({ request: vi.fn().mockResolvedValue(payload({ serverCanonical: false })) } as unknown as ApiClient, "prod").rates()).rejects.toMatchObject({ kind: "protocol" });
    await expect(createCommissionConfigApi({ request: vi.fn().mockResolvedValue(payload({ coolingDays: "not-a-number" })) } as unknown as ApiClient, "prod").rates()).rejects.toMatchObject({ kind: "protocol" });
  });
});
