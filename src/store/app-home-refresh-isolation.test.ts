// @ts-expect-error Vitest executes this structural contract in Node; the App tsconfig intentionally omits Node globals.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("./app.ts", import.meta.url), "utf8");
const ledgerSource = readFileSync(new URL("../components/home/earnings-ledger-card.vue", import.meta.url), "utf8");
const gridSource = readFileSync(new URL("../components/home/on-grid-section.vue", import.meta.url), "utf8");
const marketSource = readFileSync(new URL("../components/home/market-board-card.vue", import.meta.url), "utf8");

describe("App Home authority refresh isolation", () => {
  it("refreshes Home independently with account fencing and single-flight reuse", () => {
    expect(appSource).toContain("function refreshHomeTruth(request: RemoteAccountRequest");
    expect(appSource).toContain("if (homeTruthRefreshInFlight?.key === key) return homeTruthRefreshInFlight.request;");
    expect(appSource).toContain("if (!remoteAccountEpoch.isCurrent(request)) throw new Error(\"REMOTE_ACCOUNT_CHANGED\")");
  });

  it("commits Home with fleet and task-assignment reads as one account-scoped projection", () => {
    const projectionStart = appSource.indexOf("const [fleet, assignmentState, projection] = await Promise.all([");
    expect(projectionStart).toBeGreaterThan(-1);
    expect(appSource.indexOf("appHomeApi.fetch()", projectionStart)).toBeGreaterThan(projectionStart);
    expect(appSource.indexOf("homeTruth.value = projection;", projectionStart)).toBeGreaterThan(projectionStart);
  });

  it("gives every Home retry action the narrow Home-only refresh", () => {
    for (const source of [ledgerSource, gridSource, marketSource]) {
      expect(source).toContain("app.refreshHomeTruth()");
    }
  });

  it("renders grid clients only from the Java Home projection", () => {
    expect(gridSource).not.toContain("Pocket Studios");
    expect(gridSource).not.toContain("Helix Labs");
    expect(gridSource).not.toContain("Echo Earbuds");
    expect(gridSource).not.toContain("const GRID_CLIENTS");
    expect(gridSource).toContain("app.homeTruth?.onGrid.clients ?? []");
  });

  it("uses the company name as the grid row heading and hides the technical client id", () => {
    expect(gridSource).toContain("companyInitial(c.name)");
    expect(gridSource).toContain('{{ c.name ?? "—" }}');
    expect(gridSource).toContain('{{ c.model ?? "—" }}');
    expect(gridSource).not.toContain("{{ c.id }}</text>");
  });
});
