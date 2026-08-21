import { describe, expect, it } from "vitest";
import { shouldClaimQuestOnRoute } from "./remote-quest-route";

describe("remote quest route authority", () => {
  it("does not claim setup_profile just because the profile page was visited", () => {
    expect(shouldClaimQuestOnRoute(true, "setup_profile")).toBe(false);
  });

  it("keeps route-based quest completion for other remote tasks", () => {
    expect(shouldClaimQuestOnRoute(true, "visit_store")).toBe(true);
  });
});
