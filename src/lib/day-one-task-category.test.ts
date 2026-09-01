import { describe, expect, it } from "vitest";

import { dayOneTaskCategory, dayOneTaskRoute } from "./day-one-task-category";

describe("dayOneTaskCategory", () => {
  it.each([
    ["bind_bank_card", "wallet"],
    ["visit_earn", "explore"],
    ["visit_store", "explore"],
    ["view_product_roi", "recommend"],
    ["setup_profile", "identity"],
    ["invite_friend", "social"],
  ] as const)("maps %s to the 5174 category %s", (questCode, expectedCategory) => {
    expect(dayOneTaskCategory(questCode)).toBe(expectedCategory);
  });

  it("keeps unknown PC-defined tasks visible under explore", () => {
    expect(dayOneTaskCategory("future_task")).toBe("explore");
  });

  it.each([
    ["bind_bank_card", "/pages/me/wallet-cards-new"],
    ["visit_earn", "/pages/earn/earn"],
    ["visit_store", "/pages/store/store"],
    ["view_product_roi", "/pages/store/detail?id=stellarbox-s1"],
    ["setup_profile", "/pages/me/profile"],
    ["invite_friend", "/pages/team/team"],
  ] as const)("routes %s directly to its completion page", (questCode, expectedRoute) => {
    expect(dayOneTaskRoute(questCode)).toBe(expectedRoute);
  });

  it("keeps unknown PC-defined tasks recoverable through the task center", () => {
    expect(dayOneTaskRoute("future_task")).toBe("/pages/missions/missions");
  });
});
