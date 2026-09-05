import source from "../../scripts/lib/harness-stubs.mjs?raw";
import { describe, expect, it } from "vitest";

describe("publication harness regression", () => {
  it("both shared Vue stubs expose shallowReactive and preserve object identity", async () => {
    const stubs = await import(`data:text/javascript,${encodeURIComponent(source)}`);
    for (const name of ["VUE_STUB_PLAIN", "VUE_STUB_NXREF"]) {
      const vue = await import(`data:text/javascript,${encodeURIComponent(stubs[name])}`);
      expect(typeof vue.shallowReactive).toBe("function");
      const state = { items: [], busy: false };
      expect(vue.shallowReactive(state)).toBe(state);
    }
  });
});
