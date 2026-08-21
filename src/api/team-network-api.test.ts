import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api-client";
import { createTeamNetworkApi } from "./team-network-api";
import { setCurrentCommerceSandboxRun } from "./order-api";

const PRODUCTION_PROOF = { source: "server", sourceEnvironment: "PRODUCTION", runId: "", serverCanonical: true };
const SANDBOX_RUN = "TEAM-RUN-20260816";

beforeEach(() => {
  setCurrentCommerceSandboxRun(null);
});

describe("team network API", () => {
  it("accepts a server-owned seven-level projection", async () => {
    const request = vi.fn().mockResolvedValue({
      totalMembers: 1, directMembers: 1, activeMembers: 1,
      monthVolumeUsdt: 12.5, lifetimeVolumeUsdt: null,
      members: [{ id: "42", name: "Member 42", avatarUrl: null, vRank: 1, layer: 1,
        leg: "A", joinedAt: "2026-08-13T00:00:00Z",
        monthVolumeUsdt: 12.5, lifetimeVolumeUsdt: null, status: "ACTIVE", region: "SG" }],
      ...PRODUCTION_PROOF, generatedAt: "2026-08-13T00:00:00Z",
    });
    const api = createTeamNetworkApi({ request } as unknown as ApiClient, "prod");
    await expect(api.snapshot()).resolves.toMatchObject({ totalMembers: 1, members: [{ leg: "A" }] });
  });

  it("accepts only the current server-owned sandbox run", async () => {
    setCurrentCommerceSandboxRun(SANDBOX_RUN);
    const request = vi.fn().mockResolvedValue({
      totalMembers: 0, directMembers: 0, activeMembers: 0, monthVolumeUsdt: 0, lifetimeVolumeUsdt: null,
      members: [], source: "server", sourceEnvironment: "SANDBOX", runId: SANDBOX_RUN,
      serverCanonical: true, generatedAt: "2026-08-13T00:00:00Z",
    });
    const api = createTeamNetworkApi({ request } as unknown as ApiClient, "dev");
    await expect(api.snapshot()).resolves.toMatchObject({ sourceEnvironment: "SANDBOX", runId: SANDBOX_RUN });
  });

  it("rejects missing, cross-environment, and stale-run proof", async () => {
    setCurrentCommerceSandboxRun(SANDBOX_RUN);
    const payload = {
      totalMembers: 0, directMembers: 0, activeMembers: 0, monthVolumeUsdt: 0, lifetimeVolumeUsdt: null,
      members: [], source: "server", generatedAt: "2026-08-13T00:00:00Z",
    };
    const missingProof = createTeamNetworkApi({ request: vi.fn().mockResolvedValue(payload) } as unknown as ApiClient, "dev");
    await expect(missingProof.snapshot()).rejects.toMatchObject({ message: "TEAM_NETWORK_RESPONSE_INVALID" });

    const productionProof = createTeamNetworkApi({ request: vi.fn().mockResolvedValue({ ...payload, ...PRODUCTION_PROOF }) } as unknown as ApiClient, "dev");
    await expect(productionProof.snapshot()).rejects.toMatchObject({ message: "TEAM_NETWORK_RESPONSE_INVALID" });

    const staleRun = createTeamNetworkApi({ request: vi.fn().mockResolvedValue({ ...payload,
      sourceEnvironment: "SANDBOX", runId: "TEAM-RUN-20260815", serverCanonical: true }) } as unknown as ApiClient, "dev");
    await expect(staleRun.snapshot()).rejects.toMatchObject({ message: "TEAM_NETWORK_RESPONSE_INVALID" });
  });

  it("rejects internal sponsor identity fields instead of carrying them into the App", async () => {
    const request = vi.fn().mockResolvedValue({
      totalMembers: 1, directMembers: 1, activeMembers: 1, monthVolumeUsdt: 0, lifetimeVolumeUsdt: null,
      members: [{ id: "42", name: "Member 42", avatarUrl: null, vRank: 1, layer: 1, leg: null,
        sponsorId: "7", joinedAt: "2026-08-13T00:00:00Z", monthVolumeUsdt: 0,
        lifetimeVolumeUsdt: null, status: "ACTIVE", region: null }],
      ...PRODUCTION_PROOF, generatedAt: "2026-08-13T00:00:00Z",
    });
    const api = createTeamNetworkApi({ request } as unknown as ApiClient, "prod");
    await expect(api.snapshot()).rejects.toMatchObject({ message: "TEAM_NETWORK_RESPONSE_INVALID" });
  });

  it("rejects inconsistent member counts", async () => {
    const request = vi.fn().mockResolvedValue({ totalMembers: 2, directMembers: 0, activeMembers: 0,
      monthVolumeUsdt: 0, lifetimeVolumeUsdt: 0, members: [], ...PRODUCTION_PROOF, generatedAt: "2026-08-13T00:00:00Z" });
    const api = createTeamNetworkApi({ request } as unknown as ApiClient, "prod");
    await expect(api.snapshot()).rejects.toMatchObject({ message: "TEAM_NETWORK_RESPONSE_INVALID" });
  });
});
