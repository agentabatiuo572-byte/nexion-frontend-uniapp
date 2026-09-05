import { describe, expect, it } from "vitest";
const sources = import.meta.glob([
  "../components/home/my-fleet-section.vue", "./earn/earn.vue",
  "../components/earn/market-board.vue", "../i18n/messages/*.ts",
], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const source = (file: string) => sources[file.startsWith("pages/") ? `./${file.slice(6)}` : `../${file}`] ?? "";
describe("audit display authority regressions", () => {
  it("does not present default capacity or an add slot while the remote fleet is unavailable", () => {
    for (const file of ["components/home/my-fleet-section.vue", "pages/earn/earn.vue"]) {
      expect(source(file)).toContain('const fleetReady = computed(() => !remoteApiEnabled || app.remoteFleetStatus === "ready")');
      expect(source(file)).toContain('fleetReady.value ? fmt(');
      expect(source(file)).toContain(': "— / —"');
    }
    expect(source("components/home/my-fleet-section.vue")).toContain('v-if="fleetReady && slotDevices.length < app.slotCap"');
    expect(source("pages/earn/earn.vue")).toContain('<EmptySlotsHint v-if="fleetReady">');
  });
  it("uses the configured fleet capacity at every fleet header and add entry", () => {
    for (const file of ["components/home/my-fleet-section.vue", "pages/earn/earn.vue"]) {
      expect(source(file)).toMatch(/max:\s*app\.slotCap/);
    }
    expect(source("components/home/my-fleet-section.vue")).toContain('slotDevices.length < app.slotCap');
    for (const locale of ["zh", "en", "vi"]) {
      expect(source(`i18n/messages/${locale}.ts`)).toMatch(/fleetOfMax:\s*"[^"\n]*\{max\}/);
    }
  });
  it("does not collapse distinct ranking rows into rank five or call an arbitrary item best", () => {
    const board = source("components/earn/market-board.vue");
    expect(board).not.toContain("Math.min(5, row.rank)");
    expect(board).not.toContain("t.uiChrome.best");
  });
  it("does not promise a fixed leaderboard prize in any language", () => {
    for (const locale of ["zh", "en", "vi"]) {
      const section = source(`i18n/messages/${locale}.ts`).split("leaderboardCard:")[1]?.split("}")[0];
      expect(section).toBeTruthy();
      expect(section).not.toMatch(/50K|50,000/);
    }
  });
});
