import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { createPayoutAddressApi } from "./payout-address-api";
import { setCurrentCommerceSandboxRun } from "./order-api";

beforeEach(() => setCurrentCommerceSandboxRun(null));

const row = {
  network: "USDT-TRC20",
  address: `T${"A".repeat(33)}`,
  status: "ACTIVE",
  effectiveAt: "2026-08-17T00:00:00",
  createdAt: "2026-08-16T00:00:00",
  nextChangeAllowedAt: "2026-08-23T00:00:00",
  changePending: true,
};

describe("payout address API provenance", () => {
  it("accepts a run-scoped server sandbox snapshot", async () => {
    setCurrentCommerceSandboxRun("sandbox-run-1");
    const request = vi.fn().mockResolvedValue({
      addresses: [{ ...row, source: "mock", sourceEnvironment: "SANDBOX", runId: "sandbox-run-1", serverCanonical: true }],
      source: "mock", sourceEnvironment: "SANDBOX", runId: "sandbox-run-1", serverCanonical: true,
      changeCooldownDays: 7, effectiveDelayHours: 24, inFlightWithdrawalBlocked: true,
    });
    const api = createPayoutAddressApi({ request } as unknown as ApiClient, "dev");

    await expect(api.list()).resolves.toMatchObject({
      source: "mock", sourceEnvironment: "SANDBOX", runId: "sandbox-run-1", serverCanonical: true,
      addresses: [{ network: "USDT-TRC20" }],
    });
    expect(request).toHaveBeenCalledWith({ method: "GET", path: "/api/payout-addresses" });
  });

  it("rejects a valid-looking snapshot from a previous sandbox run", async () => {
    setCurrentCommerceSandboxRun("sandbox-run-2");
    const request = vi.fn().mockResolvedValue({
      addresses: [{ ...row, source: "mock", sourceEnvironment: "SANDBOX", runId: "sandbox-run-1", serverCanonical: true }],
      source: "mock", sourceEnvironment: "SANDBOX", runId: "sandbox-run-1", serverCanonical: true,
      changeCooldownDays: 7, effectiveDelayHours: 24, inFlightWithdrawalBlocked: true,
    });
    const api = createPayoutAddressApi({ request } as unknown as ApiClient, "dev");

    await expect(api.list()).rejects.toMatchObject({ message: "PAYOUT_ADDRESS_PROVENANCE_INVALID" });
  });

  it("rejects a row whose provenance does not match the snapshot", async () => {
    const request = vi.fn().mockResolvedValue({
      addresses: [{ ...row, source: "server", sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true }],
      source: "mock", sourceEnvironment: "SANDBOX", runId: "sandbox-run-1", serverCanonical: true,
      changeCooldownDays: 7, effectiveDelayHours: 24, inFlightWithdrawalBlocked: true,
    });
    const api = createPayoutAddressApi({ request } as unknown as ApiClient, "prod");

    await expect(api.list()).rejects.toMatchObject({ message: "PAYOUT_ADDRESS_PROVENANCE_INVALID" });
  });

  it("rejects an address row without server provenance", async () => {
    const request = vi.fn().mockResolvedValue({
      addresses: [row],
      source: "mock", sourceEnvironment: "SANDBOX", runId: "sandbox-run-1", serverCanonical: true,
      changeCooldownDays: 7, effectiveDelayHours: 24, inFlightWithdrawalBlocked: true,
    });
    const api = createPayoutAddressApi({ request } as unknown as ApiClient, "prod");

    await expect(api.list()).rejects.toMatchObject({ message: "PAYOUT_ADDRESS_PROVENANCE_INVALID" });
  });

  it("requires provenance on OTP responses", async () => {
    const request = vi.fn().mockResolvedValue({ challengeNo: "PAYOUT-ABC123", expiresInSeconds: 300 });
    const api = createPayoutAddressApi({ request } as unknown as ApiClient, "prod");

    await expect(api.sendOtp()).rejects.toMatchObject({ message: "PAYOUT_ADDRESS_PROVENANCE_INVALID" });
  });
});
