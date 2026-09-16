import { describe, expect, it } from "vitest";
import detail from "./detail.vue?raw";
import { en } from "@/i18n/messages/en";
import { zh } from "@/i18n/messages/zh";
import { vi } from "@/i18n/messages/vi";

describe("store detail payback and eligibility copy", () => {
  it("renders an unavailable payback without a day suffix and keeps CTA copy finite", () => {
    expect(detail).toContain("estimatePaybackDays");
    expect(detail).toContain("paybackDays === null");
    expect(detail).toContain("t.store.detPaybackUnavailable");
    expect(detail).not.toContain("Math.round(product.value.price / product.value.dailyEarn)");
  });

  it("uses unmet-condition copy for a known server denial while retaining fail-closed copy for unknown state", () => {
    expect(detail).toContain("eligibilityDenyBody");
    expect(detail).toContain("t.store.purchaseEligibilityFailClosed");
    expect(detail).toContain("t.value.store.purchaseEligibilityConditionsUnmet");
    expect(detail).toContain("v-if=\"purchaseEligibilityMessage === 'error'\"");
  });

  it.each([en, zh, vi])("provides trilingual unavailable-payback and known-denial copy", (messages) => {
    expect(messages.store.detPaybackUnavailable).toBeTruthy();
    expect(messages.store.detPaybackUnavailableNote).toBeTruthy();
    expect(messages.store.purchaseEligibilityConditionsUnmet).toBeTruthy();
  });
});