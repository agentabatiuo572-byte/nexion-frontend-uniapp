import { describe, expect, it, vi } from "vitest";
import { createQuestApi } from "./quest-api";

const quest = {
  questCode: "setup_profile",
  name: "Set up profile",
  layer: "DAY_ONE",
  rewardNex: 80,
  status: "CLAIMABLE",
};

describe("quest API authority", () => {
  it("accepts the production mission projection only in remote mode", async () => {
    const request = vi.fn().mockResolvedValue({
      quests: [quest],
      promoBanner: {},
      questBonusMultiplier: 1,
      rhythmMonth: 1,
      serverCanonical: true,
      sourceEnvironment: "PRODUCTION",
      runId: "",
      source: "nx_mission + nx_user_mission",
    });
    const api = createQuestApi({ request } as never, "prod");

    await expect(api.state()).resolves.toMatchObject({ sourceEnvironment: "PRODUCTION", runId: "" });
  });

  it("accepts the same backend-canonical quest projection in development", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({
        quests: [quest],
        promoBanner: {},
        questBonusMultiplier: 1,
        rhythmMonth: 1,
        serverCanonical: true,
        sourceEnvironment: "PRODUCTION",
        runId: "",
        source: "nx_mission + nx_user_mission",
      })
      .mockResolvedValueOnce({
        questId: "setup_profile",
        rewardNex: 80,
        status: "CLAIMED",
        serverCanonical: true,
        sourceEnvironment: "PRODUCTION",
        runId: "",
      });
    const api = createQuestApi({ request } as never, "dev");

    await expect(api.state()).resolves.toMatchObject({ sourceEnvironment: "PRODUCTION", runId: "" });
    await expect(api.claim("setup_profile", "quest-claim-20260816")).resolves.toMatchObject({
      sourceEnvironment: "PRODUCTION",
      runId: "",
    });
  });

  it("rejects sandbox payloads in both development and production", async () => {
    const sandbox = {
      quests: [quest], promoBanner: {}, questBonusMultiplier: 1, rhythmMonth: 0,
      serverCanonical: true, sourceEnvironment: "SANDBOX", runId: "sandbox-run-20260816", source: "mock",
    };
    await expect(createQuestApi({ request: async () => sandbox } as never, "prod").state())
      .rejects.toMatchObject({ message: "QUEST_RESPONSE_INVALID" });
    await expect(createQuestApi({ request: async () => sandbox } as never, "dev").state())
      .rejects.toMatchObject({ message: "QUEST_RESPONSE_INVALID" });
  });
});
