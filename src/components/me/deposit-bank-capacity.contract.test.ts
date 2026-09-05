// @ts-expect-error Vitest executes this structural contract in Node; the App tsconfig intentionally omits Node globals.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
    expect(source).toMatch(/todayRemainingNote/);
    expect(source).toMatch(/dailyCapacityExhausted/);
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
