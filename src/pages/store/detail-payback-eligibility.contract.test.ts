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
/**
 * zentao #29:购买资格卡对「没有条件事实」的策略宣称「结果:已满足」。
 *
 * 后端在额度行缺失或未启用时下发 eligible=true + 空条件列表
 * (AppCanonicalBoundaryService: F4B_NOT_CONFIGURED / F4B_QUOTA_UNAVAILABLE)。
 * 原样渲染等于平台对购买资格作了一个自己无法兑现的承诺 —— 用户看到「已满足」
 * 却看不到任何额度、已售、剩余。没有事实支撑的结论不得上屏。
 */
describe("store detail eligibility never claims a met result without facts", () => {
  it("gates the met/unmet result on the presence of condition facts", () => {
    // 结果行必须与事实判据同条件;此前它无条件渲染。
    const gatedResult = detail.match(/v-if="eligibilityPolicyHasFacts\(policy\)"[\s\S]{0,220}?purchaseEligibilityPolicyMet/);
    expect(gatedResult, "结果行必须挂在 eligibilityPolicyHasFacts 判据下").not.toBeNull();
    expect(detail).toContain("purchaseEligibilityUnconfigured");
    // 不得再出现无条件的 eligible 三元结果行。
    expect(detail).not.toMatch(/<text class="block" style="margin-top: 3px; font-size: 12px" :style="eligibilityPolicyResultStyle\(policy\)">\{\{ policy\.eligible/);
  });

  it.each([en, zh, vi])("provides trilingual not-configured copy", (messages) => {
    expect(messages.store.purchaseEligibilityUnconfigured).toBeTruthy();
    // 三语必须各自成句,不能整份复制粘贴。
    const values = [en.store.purchaseEligibilityUnconfigured, zh.store.purchaseEligibilityUnconfigured, vi.store.purchaseEligibilityUnconfigured];
    expect(new Set(values).size).toBe(3);
  });

  it("keeps the missing-facts line so the operator-visible cause stays explicit", () => {
    expect(detail).toContain("t.store.purchaseEligibilityNoFacts");
  });
});
