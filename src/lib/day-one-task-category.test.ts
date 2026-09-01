import { describe, expect, it } from "vitest";

import { dayOneTaskCategory } from "./day-one-task-category";

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
});
