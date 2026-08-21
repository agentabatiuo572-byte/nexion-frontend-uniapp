import { afterEach, describe, expect, it, vi } from "vitest";
import { setCurrentCommerceSandboxRun } from "./order-api";
import { createPointsApi } from "./points-api";

const sandboxRun = "sandbox-run-20260816";

const state = {
  rewardAsset: "NEX",
  serverDate: "2026-08-16",
  nextResetAtUtc: "2026-08-17T00:00:00Z",
  streak: {
    currentStreak: 1,
    longestStreak: 1,
    streakSavers: 1,
    lastCheckInDate: null,
    checkedInToday: false,
  },
  dailyMilestones: [],
  earningMilestones: [],
  powerUps: [],
  rules: [],
  topStreakers: [],
  source: "nx_user_streak + nx_daily_check_in",
  serverCanonical: true,
  sourceEnvironment: "SANDBOX",
  runId: sandboxRun,
};

const production = { ...state, sourceEnvironment: "PRODUCTION", runId: "", source: "nx_user_streak" };

afterEach(() => setCurrentCommerceSandboxRun(null));

describe("points API provenance", () => {
  it("requires the current server sandbox run for state", async () => {
    setCurrentCommerceSandboxRun(sandboxRun);
    await expect(createPointsApi({ request: async () => state } as never, "dev").state())
      .resolves.toMatchObject({ sourceEnvironment: "SANDBOX", runId: sandboxRun });

    setCurrentCommerceSandboxRun("sandbox-run-other");
    await expect(createPointsApi({ request: async () => state } as never, "dev").state())
      .rejects.toMatchObject({ message: "DAILY_RESPONSE_INVALID" });
  });

  it("requires production provenance and an empty run id in remote mode", async () => {
    await expect(createPointsApi({ request: async () => production } as never, "prod").state())
      .resolves.toMatchObject({ sourceEnvironment: "PRODUCTION", runId: "" });
    await expect(createPointsApi({ request: async () => ({ ...production, runId: "stale-run" }) } as never, "prod").state())
      .rejects.toMatchObject({ message: "DAILY_RESPONSE_INVALID" });
  });

  it("fails closed for every points mutation when provenance is missing or mismatched", async () => {
    setCurrentCommerceSandboxRun(sandboxRun);
    const responses = [
      { checkInDate: "2026-08-16", baseNex: 1, rewardNex: 1, streakBonusNex: 0, multiplier: 1, streakDays: 1 },
      { milestoneId: 1, milestoneDay: 1, rewardType: "NEX", rewardAmount: 1, badgeCode: null, spinTickets: 0 },
      { restoredStreak: 1, streakSavers: 0, effectiveLastCheckInDate: "2026-08-15" },
      { powerUpId: 1, powerUpCode: "nex_boost", badgeCode: null, status: "ACTIVATED" },
    ].map((value) => ({ ...value, serverCanonical: true, sourceEnvironment: "SANDBOX", runId: sandboxRun }));
    const request = vi.fn()
      .mockResolvedValueOnce({ ...responses[0], sourceEnvironment: "PRODUCTION", runId: "" })
      .mockResolvedValueOnce({ ...responses[1], runId: "sandbox-run-other" })
      .mockResolvedValueOnce({ ...responses[2], serverCanonical: false })
      .mockResolvedValueOnce({ ...responses[3], sourceEnvironment: "PRODUCTION", runId: "" });
    const api = createPointsApi({ request } as never, "dev");

    await expect(api.checkIn("check-in-key")).rejects.toMatchObject({ message: "DAILY_CHECK_IN_RESPONSE_INVALID" });
    await expect(api.claimMilestone(1, "claim-key")).rejects.toMatchObject({ message: "DAILY_MILESTONE_CLAIM_RESPONSE_INVALID" });
    await expect(api.useSaver("saver-key")).rejects.toMatchObject({ message: "DAILY_STREAK_SAVER_RESPONSE_INVALID" });
    await expect(api.activatePowerUp(1, "power-up-key")).rejects.toMatchObject({ message: "DAILY_POWER_UP_ACTIVATION_RESPONSE_INVALID" });
  });
});
