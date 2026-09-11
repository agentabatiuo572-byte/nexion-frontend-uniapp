import { expect, test } from "vitest";
import { resolvePurchaseEligibilityMessage } from "./purchase-eligibility-copy";

const base = {
  productNo: "stellarbox-pro-v2",
  policies: [
    { policy: "E1" as const, eligible: true, decisionCode: "ELIGIBLE", mode: "ALL" as const, conditions: [] },
    { policy: "F4B" as const, eligible: true, decisionCode: "F4B_NOT_CONFIGURED", mode: "ALL" as const, conditions: [] },
  ],
  evaluatedAt: 1786856400000,
  source: "nx_product + nx_admin_device_sku + nx_user" as const,
  sourceEnvironment: "PRODUCTION" as const,
  runId: null,
  serverCanonical: true as const,
};

test("maps only canonical server decision codes to deny copy", () => {
  expect(resolvePurchaseEligibilityMessage("ready", { ...base, eligible: false, decisionCode: "PURCHASE_GATE_NOT_MET" })).toBe("ineligible");
  expect(resolvePurchaseEligibilityMessage("ready", { ...base, eligible: false, decisionCode: "PURCHASE_GATE_SOLD_OUT" })).toBe("quotaDepleted");
  expect(resolvePurchaseEligibilityMessage("ready", { ...base, eligible: false, decisionCode: "F4B_REQUIREMENTS_NOT_MET" })).toBe("ineligible");
  expect(resolvePurchaseEligibilityMessage("ready", { ...base, eligible: false, decisionCode: "F4B_MONTHLY_QUOTA_EXHAUSTED" })).toBe("quotaDepleted");
});

test("unknown, malformed, or failed remote decisions map to error and never local gate copy", () => {
  expect(resolvePurchaseEligibilityMessage("error", null)).toBe("error");
  expect(resolvePurchaseEligibilityMessage("ready", { ...base, eligible: false, decisionCode: "CLIENT_GUESSED" })).toBe("error");
  expect(resolvePurchaseEligibilityMessage("ready", { ...base, eligible: true, decisionCode: "PURCHASE_GATE_NOT_MET" })).toBe("error");
  expect(resolvePurchaseEligibilityMessage("ready", { ...base, eligible: true, decisionCode: "ELIGIBLE" })).toBe("eligible");
});
