import { describe, expect, it } from "vitest";

const source = (import.meta.glob("./unilevel.vue", { query: "?raw", import: "default", eager: true })["./unilevel.vue"] ?? "") as string;

describe("unilevel canonical commission consumer contract", () => {
  it("uses the commission store config in remote and sandbox display/calculation paths", () => {
    expect(source).toContain("commission.config");
    expect(source).toContain("commission.configStatus");
    expect(source).toContain("commission.unilevelRate");
    expect(source).not.toContain("UNILEVEL_USDT");
  });

  it("does not render remote content while commission config is loading or failed", () => {
    expect(source).toContain("commission.configStatus === 'ready'");
    expect(source).toContain("commission.configStatus === 'error'");
    expect(source).toContain("commission.configStatus !== 'ready'");
  });

  it("keeps canonical F2 rules visible when network facts are unavailable without inventing earnings", () => {
    expect(source).toContain("F2 canonical rules · server source");
    expect(source).toContain("commission.config.sourceEnvironment");
    expect(source).toContain("commission.config.runId");
    expect(source).toContain("remoteState === 'ready'");
    expect(source).toContain('v-else-if="!remoteApiEnabled"');
    expect(source).toContain("t.unilevel.serverRewardHold");
  });
});
