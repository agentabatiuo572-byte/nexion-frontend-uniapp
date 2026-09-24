import { describe, expect, it } from "vitest";
// @ts-expect-error Vitest executes this structural contract in Node; the App tsconfig intentionally omits Node globals.
import { readFileSync } from "node:fs";
import { createPinia, setActivePinia } from "pinia";
import ts from "typescript";
import { fmt } from "@/i18n/format";
import { zh } from "@/i18n/messages/zh";
import { useUI } from "@/store/ui";

const source = readFileSync(new URL("./goals.vue", import.meta.url), "utf8");

describe("earning-goal save account fence", () => {
  it("keeps the submitted retry payload and fences success handling by account epoch", () => {
    expect(source).toMatch(/retryableSaveIntents/);
    expect(source).toMatch(/expectedAccountEpoch === goalsStore\.accountEpoch/);
  });

  it("disables editable goal controls while a save is pending", () => {
    expect(source).toMatch(/:disabled="editorBlocked"/);
    expect(source).toMatch(/editorBlocked = computed\(\(\) => savePending\.value/);
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
  it("keeps days unitless and groups default and custom amounts", () => {
    expect(source).toMatch(/savedToast, \{ amount: target\.value\.toLocaleString\("en-US"\), days: days\.value \}/);
    expect(fmt(zh.goals.savedToast, { amount: (1000).toLocaleString("en-US"), days: 90 }))
      .toBe("目标已保存 · 90 天达成 $1,000");
    expect(fmt(zh.goals.savedToast, { amount: (1234.56).toLocaleString("en-US"), days: 180 }))
      .toBe("目标已保存 · 180 天达成 $1,234.56");
  });

  it("shows both saved terms through the page-bound toast store after an async save", async () => {
    const pagePinia = createPinia();
    const pageUi = useUI(pagePinia);
    const otherPinia = createPinia();
    setActivePinia(otherPinia);
    const goals: Array<{ id: string; targetUSDT: number; deadlineMs: number; createdAt: number; achieved: boolean }> = [];
    const goalsStore = {
      accountEpoch: 1,
      goals,
      setGoal: async (intent: { targetUSDT: number; deadlineMs: number }) => {
        await Promise.resolve();
        goals.push({ id: String(goals.length + 1), targetUSDT: intent.targetUSDT,
          deadlineMs: intent.deadlineMs, createdAt: Date.now(), achieved: false });
        return "saved";
      },
      refreshRecommendation: async () => {},
    };
    const target = { value: 500 };
    const days = { value: 90 };
    const savePending = { value: false };
    const start = source.indexOf("async function onSave()");
    const end = source.indexOf("async function remove(", start);
    const implementation = ts.transpileModule(source.slice(start, end), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const makeSave = new Function("saveBlocked", "target", "days", "goalsStore", "savePending", "ui", "t", "fmt", "restoreEditorFromGoal", "ONE_DAY_MS",
      `let saveEpoch = 0; const retryableSaveIntents = new Map(); ${implementation}; return onSave;`);
    const save = makeSave({ value: false }, target, days, goalsStore, savePending, pageUi,
      { value: { goals: zh.goals } }, fmt, () => {}, 86_400_000) as () => Promise<void>;

    await save();
    expect(pageUi.toasts.at(-1)?.title).toBe("目标已保存 · 90 天达成 $500");
    days.value = 30;
    await save();
    expect(pageUi.toasts.at(-1)?.title).toBe("目标已保存 · 30 天达成 $500");
    expect(useUI(otherPinia).toasts).toEqual([]);
    expect(goals).toHaveLength(2);
    expect(savePending.value).toBe(false);
  });
});
