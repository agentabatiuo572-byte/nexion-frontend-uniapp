import { describe, expect, it, vi } from "vitest";
import { createQuestApi } from "./quest-api";

const quest = {
  questCode: "setup_profile",
  name: "Set up profile",
  layer: "DAY_ONE",
  rewardNex: 80,
  status: "CLAIMABLE",
  category: "identity",
  actionRoute: "/pages/me/profile",
  instanceKey: "DAY_ONE:20260901T000000",
  eligibleFrom: "2026-09-01T00:00:00+08:00",
  eligibleUntil: "2026-09-04T00:00:00+08:00",
  eligible: true,
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
        instanceKey: quest.instanceKey,
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

  it.each([
    [{ category: undefined }, "missing category"],
    [{ category: "unknown" }, "unknown category"],
    [{ actionRoute: undefined }, "missing route"],
    [{ actionRoute: "https://example.com/phish" }, "external route"],
    [{ instanceKey: "WEEK:2026-W36" }, "wrong instance kind"],
    [{ eligibleUntil: "2026-08-31T23:59:59+08:00" }, "reversed eligibility window"],
    [{ eligible: false, status: "PENDING" }, "ineligible pending state"],
  ])("rejects a quest with %s", async (override, _reason) => {
    const payload = {
      quests: [{ ...quest, ...override }],
      promoBanner: {},
      questBonusMultiplier: 1,
      rhythmMonth: 1,
      serverCanonical: true,
      sourceEnvironment: "PRODUCTION",
      runId: "",
      source: "nx_mission + nx_user_mission",
    };
    await expect(createQuestApi({ request: async () => payload } as never, "prod").state())
      .rejects.toMatchObject({ message: "QUEST_RESPONSE_INVALID" });
  });

  it("accepts an expired Day-One instance as a visible but ineligible row", async () => {
    const payload = {
      quests: [{ ...quest, status: "EXPIRED", eligible: false }],
      promoBanner: {},
      questBonusMultiplier: 1,
      rhythmMonth: 1,
      serverCanonical: true,
      sourceEnvironment: "PRODUCTION",
      runId: "",
      source: "nx_mission + nx_user_mission",
    };
    await expect(createQuestApi({ request: async () => payload } as never, "prod").state())
      .resolves.toMatchObject({ quests: [{ status: "EXPIRED", eligible: false }] });
  });
});
