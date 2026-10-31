// @ts-expect-error Vitest executes this structural contract in Node; the App tsconfig intentionally omits Node globals.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computed, reactive, ref } from "vue";
import ts from "typescript";

const source = readFileSync(new URL("./deposit-bank-pane.vue", import.meta.url), "utf8");

describe("VietQR live daily-capacity guard", () => {
  it("refreshes server-owned payment capacity before every remote create", () => {
    expect(source).toMatch(
      /async function completeCreateOrder[\s\S]{0,700}await fx\.load\(\)[\s\S]{0,1600}dep\.createRemoteBankIntent/,
    );
  });

  it("stops before creating when today's refreshed remaining capacity cannot cover the amount", () => {
    expect(source).toMatch(
      /usdt > todayRemainingDeposit\.value[\s\S]{0,500}dailyCapacityExceeded[\s\S]{0,500}return/,
    );
  });

  it("keeps per-transaction and daily-capacity limits as separate concepts", () => {
    expect(source).toMatch(/usdt > maxDeposit\.value[\s\S]{0,500}singleLimitExceeded/);
    expect(source).toMatch(/bankPane\.factTodayRemaining[\s\S]{0,200}todayRemainingFact/);
    expect(source).toMatch(/bankPane\.factSingleLimit[\s\S]{0,200}limitFact/);
    expect(source).toMatch(/dailyCapacityExhausted/);
  });

  it("shows configured per-transaction minimum and maximum independently from today's capacity", () => {
    expect(source).toMatch(/const limitFact = computed\([\s\S]{0,250}minDeposit[\s\S]{0,250}maxDeposit/);
    expect(source).toMatch(/const todayRemainingFact = computed\([\s\S]{0,120}dailyCapacityKnown/);
  });

  it("does not present a numeric transaction limit or today's capacity before they are known", () => {
    const start = source.indexOf("const limitFact = computed(");
    const end = source.indexOf("const feeFact", start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const code = ts.transpileModule(source.slice(start, end) + "; return { limitFact, todayRemainingFact };", {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const fx = reactive({ configReady: false });
    const minDeposit = ref(10), maxDeposit = ref(5000), dailyCapacityKnown = ref(false), todayRemainingDeposit = ref(0);
    const shortUsdt = (value: number) => `$${value.toLocaleString("en-US")}`;
    const usdtLabel = (value: number) => `$${value.toFixed(2)}`;
    const facts = new Function("computed", "fx", "minDeposit", "maxDeposit", "dailyCapacityKnown", "todayRemainingDeposit", "shortUsdt", "usdtLabel", code)(
      computed, fx, minDeposit, maxDeposit, dailyCapacityKnown, todayRemainingDeposit, shortUsdt, usdtLabel,
    );
    expect(facts.limitFact.value).toBe("—");
    expect(facts.todayRemainingFact.value).toBe("—");
    fx.configReady = true;
    expect(facts.limitFact.value).toBe("$10–$5,000");
    maxDeposit.value = 100;
    expect(facts.limitFact.value).toBe("$10–$100");
    dailyCapacityKnown.value = true;
    expect(facts.todayRemainingFact.value).toBe("$0.00");
    fx.configReady = false;
    expect(facts.limitFact.value).toBe("—");
  });

  it("returns credited users to the wallet while new top-up remains a separate reset action", () => {
    expect(source).toMatch(/async function finishCreditedFlow\(\)[\s\S]{0,600}await app\.refreshRemoteFleet[\s\S]{0,300}navBack\("\/pages\/me\/wallet"\)/);
    expect(source).toMatch(/function startNewTopup\(\)[\s\S]{0,250}viewIntentId\.value = null/);
  });

  it("turns a final server daily-capacity race into today's-limit guidance", () => {
    expect(source).toMatch(
      /VIETQR_DAILY_CAPACITY_EXCEEDED[\s\S]{0,700}await fx\.load\(\)[\s\S]{0,700}dailyCapacityExceeded/,
    );
  });
});
