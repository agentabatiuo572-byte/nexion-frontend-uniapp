import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({ state: vi.fn() }));

vi.mock("@/api/runtime", () => ({
  remoteApiEnabled: true,
  questApi: { state, claim: vi.fn() },
}));

import { useQuest } from "./quest";

describe("PC-managed H3 quest catalogue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    state.mockReset();
  });

  it("keeps the canonical quest rows so the home card can render PC task names and rewards", async () => {
    state.mockResolvedValue({
      quests: [
        { questCode: "H3_FIRST_ORDER_STARTED", name: "Start your first order", layer: "DAY_ONE", rewardNex: 50, status: "PENDING" },
        { questCode: "H3_REFERRAL_SETTLED", name: "Complete a qualified referral", layer: "DAY_ONE", rewardNex: 200, status: "PENDING" },
        { questCode: "H3_DEVICE_ACTIVATED", name: "Activate a device", layer: "WEEKLY_T1", rewardNex: 100, status: "PENDING" },
      ],
    });
    const quest = useQuest();

    await expect(quest.refreshRemote()).resolves.toBe(true);

    expect(quest.remoteQuests).toHaveLength(3);
    expect(quest.remoteQuests.filter((row) => row.layer === "DAY_ONE"))
      .toMatchObject([
        { questCode: "H3_FIRST_ORDER_STARTED", rewardNex: 50 },
        { questCode: "H3_REFERRAL_SETTLED", rewardNex: 200 },
      ]);
  });
});
