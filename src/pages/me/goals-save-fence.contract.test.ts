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

/**
 * zentao #247:保存成功提示把 90 天期限显示成「$90 天」。
 *
 * 中文文案写成 `"目标已保存 · ${days} 天达成 ${amount}"` —— 把 `${amount}` 的 `$`
 * 复制到了天数上,而 `fmt` 把 `$` 当字面量原样留下。天数不是金额,$ 只属于金额。
 *
 * 判据是**行为**而非文本:用真实 fmt 渲染一遍,断言天数前没有 $、金额前有 $。
 */
describe("goal save toast placeholder contract", () => {
  it("never puts a currency sign in front of the day count", async () => {
    const { fmt } = await import("@/i18n/format");
    const { zh } = (await import("@/i18n/messages/zh")) as unknown as {
      zh: { goals: { savedToast: string } };
    };
    const rendered = fmt(zh.goals.savedToast, { amount: "1000", days: "90" });

    expect(rendered).toContain("90 天");
    expect(rendered).not.toContain("$90");
    // 金额仍必须带 $ —— 修的是位置,不是把货币符号一起删掉。
    expect(rendered).toContain("$1000");
  });
});
