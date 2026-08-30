import { describe, expect, it } from "vitest";
import { isValidEventHref } from "./events-api";

describe("isValidEventHref", () => {
  it.each([
    "",
    "/pages/store/store",
    "/pages/me/wallet-repurchase",
    "/pages/team/leaderboard",
  ])("accepts the supported in-app event route %s", (href) => {
    expect(isValidEventHref(href)).toBe(true);
  });

  it.each([
    "https://example.com",
    "javascript:alert(1)",
    "//example.com/path",
    "/pages/../store/store",
    "/pages/store/./detail",
    "/pages//store",
  ])("rejects an unsafe or ambiguous event route %s", (href) => {
    expect(isValidEventHref(href)).toBe(false);
  });
});
