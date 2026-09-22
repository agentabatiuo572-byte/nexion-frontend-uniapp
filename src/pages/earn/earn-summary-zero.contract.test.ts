// #128/#249 regression: evaluate earn.vue's real hero computeds against the
// successful-empty overview shape versus an absent failed-read snapshot.
// @ts-expect-error Vitest executes this structural contract in Node; the App tsconfig intentionally omits Node globals.
import { readFileSync } from "node:fs";
import ts from "typescript";
import { computed, reactive, ref } from "vue";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./earn.vue", import.meta.url), "utf8");
const start = source.indexOf("const serverPeriod = computed(");
const end = source.indexOf("// drifting hero dots", start);
const code = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function hero(range: "Today" | "Week" | "Month" | "All", homeTruth: unknown, realized: { usdt: number; nex: number } | null) {
  const app = reactive({ homeTruth, remoteRealizedToday: realized });
  const t = ref({ earn: { jobsCount: "{n} tasks" } });
  const fmt = (template: string, params: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (_m, key: string) => params[key] ?? "");
  const rangeRef = ref(range);
  return new Function("computed", "ref", "app", "t", "fmt", "remoteApiEnabled", "range", "mockTotalFallback",
    `${code}\nreturn { total, totalKnown, totalInt, nexTotal, jobsCount, jobsText };`,
  )(computed, ref, app, t, fmt, true, rangeRef, computed(() => 0));
}

const emptyPeriod = { usdt: null, nex: null, jobCount: null };
const emptyTruth = { earnings: { today: emptyPeriod, week: emptyPeriod, month: emptyPeriod, all: emptyPeriod } };

describe("BUG 249 earn hero: confirmed empty periods vs failed read", () => {
  it("renders the fleet's zero-safe realized total when the overview reports no value", () => {
    const view = hero("Today", emptyTruth, { usdt: 0, nex: 0 });
    expect(view.total.value).toBe(0);
    expect(view.totalKnown.value).toBe(true);
    expect(view.totalInt.value).toBe("0");
    expect(view.nexTotal.value).toBe(0);
    expect(view.jobsCount.value).toBe(0);
    expect(view.jobsText.value).toBe("0 tasks");
  });

  it("renders successful empty Week, Month, and All periods as zero", () => {
    for (const range of ["Week", "Month", "All"] as const) {
      const view = hero(range, emptyTruth, null);
      expect(view.total.value).toBe(0);
      expect(view.nexTotal.value).toBe(0);
      expect(view.jobsCount.value).toBe(0);
      expect(view.jobsText.value).toBe("0 tasks");
    }
  });

  it("keeps values unknown when the overview request has no confirmed snapshot", () => {
    const view = hero("Week", null, null);
    expect(view.total.value).toBeNull();
    expect(view.totalKnown.value).toBe(false);
    expect(view.totalInt.value).toBe("—");
    expect(view.nexTotal.value).toBeNull();
    expect(view.jobsCount.value).toBeNull();
    expect(view.jobsText.value).toBe("—");
  });

  it("keeps a non-zero server figure authoritative over the fleet witness", () => {
    const view = hero("Today", { earnings: { today: { usdt: 12.5, nex: 3, jobCount: 4 }, week: emptyPeriod, month: emptyPeriod, all: emptyPeriod } }, { usdt: 0, nex: 0 });
    expect(view.total.value).toBe(12.5);
    expect(view.jobsCount.value).toBe(4);
  });

  it("does not borrow today's device snapshot for a partially unavailable Week range", () => {
    const partialTruth = { earnings: { ...emptyTruth.earnings, week: { usdt: null, nex: null, jobCount: 2 } } };
    const view = hero("Week", partialTruth, { usdt: 0, nex: 0 });
    expect(view.total.value).toBeNull();
    expect(view.jobsCount.value).toBe(2);
  });
});
