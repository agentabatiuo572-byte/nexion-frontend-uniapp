import { describe, expect, it } from "vitest";

import { normalizeQuestActionRoute } from "./quest-presentation";

describe("normalizeQuestActionRoute", () => {
  it.each([
    ["/pages/me/profile", "/pages/me/profile"],
    [" /pages/store/detail?id=stellarbox-s1 ", "/pages/store/detail?id=stellarbox-s1"],
  ])("accepts a PC-configured internal page route", (route, expected) => {
    expect(normalizeQuestActionRoute(route)).toBe(expected);
  });

  it.each([
    "https://example.com/phish",
    "//example.com/phish",
    "/pages/me/profile\\evil",
    "/pages/me/profile\n/pages/wallet",
    "/other/profile",
  ])("rejects an unsafe or non-App route: %s", (route) => {
    expect(() => normalizeQuestActionRoute(route)).toThrow("QUEST_ACTION_ROUTE_INVALID");
  });
});
