import { describe, expect, it } from "vitest";
import source from "./team.vue?raw";

describe("team tab return refresh", () => {
  it("refreshes every server-authoritative team projection when the tab becomes visible again", () => {
    expect(source).toContain('import { onLoad, onShow, onHide } from "@/composables/use-tab-page-lifecycle"');
    expect(source).toContain("onShow(() => {");
    expect(source).toContain("void vrank.ensureCanonicalVRank()");
    expect(source).toContain("void commission.refreshCanonicalBinary()");
    expect(source).toContain("void commission.ensureCanonicalEvents()");
    expect(source).toContain("void network.ensureCanonicalNetwork()");
    expect(source).toContain("void refreshRemotePool()");
  });
});
