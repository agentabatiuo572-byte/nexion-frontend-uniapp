import { describe, expect, it } from "vitest";

const pageSource = (import.meta.glob("./commissions.vue", {
  query: "?raw",
  import: "default",
  eager: true,
})["./commissions.vue"] ?? "") as string;

describe("team commission sandbox presentation contract", () => {
  it("keeps simulated facts visibly non-withdrawable and run-scoped", () => {
    expect(pageSource).toContain('data-testid="team-commission-sandbox-banner"');
    expect(pageSource).toContain("SIMULATED");
    expect(pageSource).toContain("Not withdrawable");
    expect(pageSource).toContain("eventsEvidence");
    expect(pageSource).toContain("withdrawableLabel");
    const storeSource = (import.meta.glob("../../store/commission.ts", {
      query: "?raw",
      import: "default",
      eager: true,
    })["../../store/commission.ts"] ?? "") as string;
    expect(storeSource).toContain('e.withdrawable === false');
    expect(storeSource).toContain('e.settlementState === "SIMULATED"');
    expect(storeSource).toMatch(/async function refreshCanonicalEvents[\s\S]*?eventsEvidence\.value = null;/);
  });
});
