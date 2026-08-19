import { describe, expect, it } from "vitest";
import type { CanonicalPromoBanner, CanonicalQuest } from "@/api/quest-api";
import { deriveHomeTaskCards, selectHomeWeeklySource } from "./home-task-carousel";

const weeklyQuest: CanonicalQuest = {
  questCode: "H3_LEARNING_COMPLETED",
  name: "Complete a learning course",
  layer: "WEEKLY_T1",
  rewardNex: 30,
  status: "PENDING",
};

const pausedPromo: CanonicalPromoBanner = {
  bannerCode: "HOME_WEEKLY_UPSELL",
  baseReward: 800,
  multiplier: 1.5,
  countdownDays: 4,
  countdownHours: 12,
  targetDevice: "StellarBox Pro",
  targetDaily: 1.5,
  status: "paused",
};

describe("home task carousel", () => {
  it("keeps the weekly slide when the server projects active weekly missions", () => {
    expect(deriveHomeTaskCards(false, {
      homeNewcomerTasksEnabled: true,
      homeWeeklyPromoEnabled: true,
    })).toEqual(["newcomer", "weekly"]);
  });

  it("fails closed when platform configuration is unavailable", () => {
    expect(deriveHomeTaskCards(true, {
      homeNewcomerTasksEnabled: true,
      homeWeeklyPromoEnabled: true,
    })).toEqual([]);
  });

  it("renders the configured weekly mission instead of a paused upsell banner", () => {
    expect(selectHomeWeeklySource([weeklyQuest], pausedPromo)).toEqual({
      kind: "quest",
      quest: weeklyQuest,
    });
  });

  it("falls back to an active promo only when no weekly mission exists", () => {
    expect(selectHomeWeeklySource([], { ...pausedPromo, status: "active" })).toEqual({
      kind: "promo",
      promo: { ...pausedPromo, status: "active" },
    });
    expect(selectHomeWeeklySource([], pausedPromo)).toBeNull();
  });
});
