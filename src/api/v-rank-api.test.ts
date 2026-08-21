import { afterEach, describe, expect, it, vi } from "vitest";
import { setCurrentCommerceSandboxRun } from "./order-api";
import { createVRankApi } from "./v-rank-api";

const row = (v: number) => ({
  v, title: `V${v}`, cnTitle: `V${v}`, directBonus: 0.1, unilevelDepth: 1,
  peerBonus: 0, leadershipVotes: 0, cultivationBonus: 0, visible: true,
});
const ladder = () => Array.from({ length: 13 }, (_, v) => row(v));
const current = {
  source: "nx_team_member + server VRankPerformanceRepository",
  serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "",
  rankCode: "V2", progress: { selfBuyUSD: 100, directRefs: 2, teamVolumeUSD: 300, vDownlineCounts: {} },
};

afterEach(() => setCurrentCommerceSandboxRun(null));

describe("v-rank API authority provenance", () => {
  it("requires canonical production provenance in remote mode", async () => {
    const request = vi.fn().mockResolvedValue({
      source: "nx_v_rank_config", serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "", ranks: ladder(),
    });
    await expect(createVRankApi({ request } as never, "prod").ladder()).resolves.toMatchObject({
      serverCanonical: true, sourceEnvironment: "PRODUCTION", runId: "",
    });
  });

  it("rejects missing canonical marker or a cross-environment response", async () => {
    const request = vi.fn().mockResolvedValue({
      source: "nx_v_rank_config", sourceEnvironment: "SANDBOX", runId: "sandbox-run-20260816", ranks: ladder(),
    });
    await expect(createVRankApi({ request } as never, "prod").ladder())
      .rejects.toMatchObject({ message: "V_RANK_RESPONSE_INVALID" });
  });

  it("requires the current sandbox run on both ladder and current responses", async () => {
    setCurrentCommerceSandboxRun("sandbox-run-20260816");
    const request = vi.fn()
      .mockResolvedValueOnce({ source: "nx_v_rank_config", serverCanonical: true, sourceEnvironment: "SANDBOX", runId: "sandbox-run-stale", ranks: ladder() })
      .mockResolvedValueOnce({ ...current, sourceEnvironment: "SANDBOX", runId: "sandbox-run-20260816" });
    const api = createVRankApi({ request } as never, "dev");

    await expect(api.ladder()).rejects.toMatchObject({ message: "V_RANK_RESPONSE_INVALID" });
    await expect(api.current()).resolves.toMatchObject({ sourceEnvironment: "SANDBOX", runId: "sandbox-run-20260816" });
  });
});
