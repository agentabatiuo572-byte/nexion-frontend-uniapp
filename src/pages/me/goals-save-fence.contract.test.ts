import { describe, expect, it } from "vitest";
// @ts-expect-error Vitest executes this structural contract in Node; the App tsconfig intentionally omits Node globals.
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./goals.vue", import.meta.url), "utf8");

describe("earning-goal save account fence", () => {
  it("keeps the submitted retry payload and fences success handling by account epoch", () => {
    expect(source).toMatch(/retryableSaveIntents/);
    expect(source).toMatch(/expectedAccountEpoch === goalsStore\.accountEpoch/);
  });

  it("disables editable goal controls while a save is pending", () => {
    expect(source).toMatch(/:disabled="savePending"/);
    expect(source).toMatch(/selectTarget\(p\)/);
    expect(source).toMatch(/selectDays\(d\)/);
  });

  it("hides a server-confirmed recommendation when no purchase is required", () => {
    expect(source).toMatch(/recommendation\?\.purchaseRequired/);
    expect(source).toMatch(/recommendationStatus === 'ready'/);
  });

  it("explains an impossible catalog target without offering a purchase CTA", () => {
    expect(source).toMatch(/recommendationError === 'GOAL_NO_ELIGIBLE_PRODUCT'/);
    expect(source).toMatch(/t\.goals\.noEligibleProduct/);
    expect(source).toMatch(/purchaseRequired === true/);
  });

  it("does not round a positive required daily amount down to zero", () => {
    expect(source).toMatch(/function formatGoalDailyRate\(value: number\)/);
    expect(source).toMatch(/formatGoalDailyRate\(goalsStore\.recommendation\?\.requiredDaily/);
  });
});
