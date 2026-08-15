import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { createProofApi } from "./proof-api";

const valid = {
  source: "server", sourceEnvironment: "PRODUCTION", runId: "", generatedAt: "2026-08-15T00:00:00Z",
  joinedAt: "2026-01-01T00:00:00Z", activeDays: 100, onlineDevices: 2, topPercentile: 7,
  earningsTotalUsdt: 123.45, referralCode: "NXAB12CD34EF",
  referral: { invitedCount: 4, lifetimeInviterNex: 50 }, team: { totalMembers: 9, activeMembers: 6 },
};

describe("proof API", () => {
  it("accepts the server proof projection", async () => {
    const request = vi.fn().mockResolvedValue(valid);
    const api = createProofApi({ request } as unknown as ApiClient);
    await expect(api.snapshot()).resolves.toMatchObject({ topPercentile: 7, earningsTotalUsdt: 123.45 });
  });

  it("rejects fixed or client-only proof fields", async () => {
    const request = vi.fn().mockResolvedValue({ ...valid, topPct: 35 });
    const api = createProofApi({ request } as unknown as ApiClient);
    await expect(api.snapshot()).rejects.toMatchObject({ message: "PROOF_RESPONSE_INVALID" });
  });
});
