import { describe, expect, it } from "vitest";
import {
  formatCanonicalRankConditions,
  rankHowPresentation,
} from "@/lib/v-rank-how-policy";

const labels = {
  selfBuy: "Self-buy ≥ ${n}",
  directRefs: "Direct refs ≥ {n}",
  teamVol: "Team ${n}",
  register: "Register immediately",
  vDownlines: "{n}× V{v}",
};

describe("rank-how server policy boundary", () => {
  it("uses the canonical ladder in both development and production", () => {
    expect(rankHowPresentation("prod", true)).toBe("canonical-ladder");
    expect(rankHowPresentation("dev", true)).toBe("canonical-ladder");
    expect(rankHowPresentation("prod", false)).toBe("hold");
    expect(rankHowPresentation("dev", false)).toBe("hold");
  });

  it("formats only server-provided ladder conditions", () => {
    expect(formatCanonicalRankConditions({
      v: 4,
      conditions: { selfBuyUSD: 299, teamVolumeUSD: 50_000, vDownlines: { 2: 3 } },
    }, labels)).toEqual(["Self-buy ≥ $299", "Team $50,000", "3× V2"]);
    expect(formatCanonicalRankConditions({ v: 0, conditions: {} }, labels))
      .toEqual(["Register immediately"]);
  });
});

describe("rank-how page source contract", () => {
  const source = (import.meta.glob("./rank-how.vue", {
    query: "?raw",
    import: "default",
    eager: true,
  })["./rank-how.vue"] ?? "") as string;

  it("must branch every detailed section on server readiness", () => {
    expect(source).toContain("rankHowPresentation");
    expect(source).toContain("canonical-ladder");
    expect(source).toContain("policyHold");
    expect(source).toContain("v-if=\"!remoteApiEnabled\"");
    expect(source).toContain("formatCanonicalRankConditions");
  });

  it("must not render local detail arrays while server data is enabled", () => {
    expect(source).toContain("v-if=\"!remoteApiEnabled\"");
    expect(source).toContain("v-if=\"remoteApiEnabled\"");
  });
});
