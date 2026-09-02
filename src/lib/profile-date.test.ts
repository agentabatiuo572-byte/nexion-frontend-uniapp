import { describe, expect, it } from "vitest";
import { formatJoinedDate } from "./profile-date";

describe("profile joined date", () => {
  it("does not render the Unix epoch when the backend has no join timestamp", () => {
    expect(formatJoinedDate(0, "en-US")).toBe("—");
    expect(formatJoinedDate(Number.NaN, "en-US")).toBe("—");
  });

  it("formats a valid join timestamp", () => {
    expect(formatJoinedDate(Date.UTC(2026, 8, 2), "en-US")).toContain("2026");
  });
});
