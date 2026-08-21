import { describe, expect, it } from "vitest";
import { homeGreetingName } from "./home-greeting";

describe("home greeting identity", () => {
  it("renders the complete server nickname instead of truncating at the first space", () => {
    expect(homeGreetingName("  Nexion 3775  ", "NexGrid")).toBe("Nexion 3775");
  });

  it("uses the explicit fallback only while no server nickname is available", () => {
    expect(homeGreetingName("", "NexGrid")).toBe("NexGrid");
  });
});
