import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { createPayoutAddressApi } from "./payout-address-api";

const productionSnapshot = {
  addresses: [],
  changeCooldownDays: 7,
  effectiveDelayHours: 24,
  inFlightWithdrawalBlocked: true,
  source: "server",
  sourceEnvironment: "PRODUCTION",
  runId: "",
  serverCanonical: true,
};

function clientReturning(value: unknown): ApiClient {
  return { request: vi.fn().mockResolvedValue(value) } as unknown as ApiClient;
}

describe("payout address Java provenance", () => {
  it.each(["dev", "prod"] as const)("accepts the production-shaped server projection in %s", async (mode) => {
    await expect(createPayoutAddressApi(clientReturning(productionSnapshot), mode).list())
      .resolves.toMatchObject({ source: "server", sourceEnvironment: "PRODUCTION", runId: "" });
  });

  it("rejects the retired sandbox projection in formal dev", async () => {
    const sandbox = {
      ...productionSnapshot,
      source: "mock",
      sourceEnvironment: "SANDBOX",
      runId: "sandbox-run-1",
    };
    await expect(createPayoutAddressApi(clientReturning(sandbox), "dev").list())
      .rejects.toMatchObject({ message: "PAYOUT_ADDRESS_PROVENANCE_INVALID" });
  });
});
