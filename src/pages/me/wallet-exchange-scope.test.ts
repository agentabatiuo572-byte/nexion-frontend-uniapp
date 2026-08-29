import { describe, expect, it } from "vitest";
import { canShowExchangeToast } from "@/lib/exchange-scope-toast";

const source = (import.meta.glob("./wallet-exchange.vue", {
  query: "?raw",
  import: "default",
  eager: true,
})["./wallet-exchange.vue"] ?? "") as string;

describe("wallet exchange stale notification fences", () => {
  it.each([
    ["mounted account/run scope", true, true, true, true],
    ["unmounted page", false, true, true, false],
    ["changed account scope", true, false, true, false],
    ["changed commerce run scope", true, true, false, false],
  ])("allows a toast only for the current %s", (_label, mounted, accountScopeCurrent, runScopeCurrent, expected) => {
    expect(canShowExchangeToast({ mounted, accountScopeCurrent, runScopeCurrent })).toBe(expected);
  });

  it("keeps the original account/run scope through confirmation and submit stale branches", () => {
    expect(source).toMatch(/async function syncRemoteState\(\s*scope = captureAccountScope\(\),\s*runScope = captureRuntimeRevision\(\)/);
    expect(source).toMatch(/const requestScope = captureAccountScope\(\);[\s\S]*const requestRunScope = captureRuntimeRevision\(\);/);
    expect(source).toMatch(/syncRemoteState\(requestScope, requestRunScope\)/);
    expect(source).toMatch(/const applied = await syncRemoteState\(requestScope, requestRunScope\)\.catch\(\(\) => false\);[\s\S]{0,200}if \(!applied\) return;/);
    expect(source).toMatch(/if \(!applied\) return;/);
    expect(source).toContain("canShowExchangeToast");
    expect(source).toMatch(/function toastIfRemoteScopeCurrent\(/);
  });
});
