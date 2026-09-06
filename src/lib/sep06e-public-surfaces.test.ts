import { describe, expect, it } from "vitest";
import * as stats from "./platform-stats";
const sources = import.meta.glob(["../App.vue", "../pages/me/language.vue", "../pages/onboarding/intro.vue"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
describe("public config and localized surfaces", () => {
  it("derives online devices rather than displaying total fleet", () => {
    expect(stats).toHaveProperty("onlineDevicesOf");
    const online = (stats as unknown as { onlineDevicesOf(ps: { fleetDevices: number; onlineRatePct: number }): number }).onlineDevicesOf;
    expect(online({ fleetDevices: 28432, onlineRatePct: 80 })).toBe(22746);
    expect(sources["../pages/onboarding/intro.vue"]).toContain("onlineDevicesOf(cfg.config.publicStats)");
  });
  it("refreshes PC platform config on foreground", () => {
    expect(sources["../App.vue"].slice(sources["../App.vue"].indexOf("onShow(() =>"))).toContain("useConfig().load()");
  });
  it("resolves group headings from the current locale", () => {
    expect(sources["../pages/me/language.vue"]).toContain("computed(() => t.value.language.priorityLabels)");
  });
});
