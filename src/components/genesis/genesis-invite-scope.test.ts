import { describe, expect, it } from "vitest";
// @ts-expect-error Vitest executes this contract in Node; the App tsconfig intentionally omits Node globals.
import { readFileSync } from "node:fs";

const sheet = readFileSync(new URL("./eligibility-sheet.vue", import.meta.url), "utf8");
const app = readFileSync(new URL("../../store/app.ts", import.meta.url), "utf8");

describe("Genesis invite response fences", () => {
  it("fences account and component lifecycle before updating the app cache and mounted sheet UI", () => {
    expect(app).toContain("remoteAccountEpoch.isCurrent(request)");
    expect(sheet).toContain("sheetMounted");
    expect(sheet).toContain("inviteRequestGeneration");
    expect(sheet).toContain("accountKey !== app.accountKey");
    expect(sheet).not.toContain("isCurrentCommerceSandboxScope(runScope)");
  });
});
