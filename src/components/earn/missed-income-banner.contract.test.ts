import { describe, expect, it } from "vitest";
import source from "./missed-income-banner.vue?raw";

describe("earn missed-income server authority", () => {
  it("uses the Java Home projection and response timestamp in formal remote mode", () => {
    expect(source).toContain("app.homeTruth?.doTheMath");
    expect(source).toContain("app.homeTruth?.generatedAt");
    expect(source).toContain("if (remoteApiEnabled)");
    expect(source).toContain("if (!projection) return null");
    expect(source).toContain("app.user.joinedAt > 0");
    expect(source).toContain("app.user.joinedAt <= authoritativeNow.value");
    expect(source).toContain("&& joinedAtValid.value");
  });

  it("does not run the browser-time ticker in formal remote mode", () => {
    expect(source).toContain("if (remoteApiEnabled) return;");
    expect(source).toContain("if (!remoteApiEnabled) return localNow.value");
  });

  it("keeps today's missed income visible while a free trial is active", () => {
    expect(source).not.toContain("trialReservesSlotNow");
    expect(source).not.toContain("!trialActive.value");
  });

  it("keeps mock-only derivation isolated behind the non-remote branch", () => {
    const remoteBranch = source.indexOf("if (remoteApiEnabled) {");
    const localDerivation = source.indexOf("derivePromoUpgrade(app.visibleDevices)");
    expect(remoteBranch).toBeGreaterThanOrEqual(0);
    expect(localDerivation).toBeGreaterThan(remoteBranch);
  });
});
