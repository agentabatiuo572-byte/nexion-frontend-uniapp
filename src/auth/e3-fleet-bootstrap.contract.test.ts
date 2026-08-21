// @ts-expect-error Vitest executes this structural contract in Node; the App tsconfig intentionally omits Node globals.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appShell = readFileSync(new URL("../App.vue", import.meta.url), "utf8");
const appStore = readFileSync(new URL("../store/app.ts", import.meta.url), "utf8");
const signIn = readFileSync(new URL("./complete-sign-in.ts", import.meta.url), "utf8");
const bootstrap = readFileSync(new URL("../lib/e3-fleet-bootstrap.ts", import.meta.url), "utf8");
const e3Api = readFileSync(new URL("../api/device-e3-api.ts", import.meta.url), "utf8");

describe("E3 fleet bootstrap and projection atomicity", () => {
  it("gates App cold start and onShow fleet refresh on the authenticated catalog", () => {
    expect(appShell).toContain("async function refreshAuthenticatedRemoteFleet()");
    expect(appShell).toContain("await refreshProductCatalog()");
    expect(appShell).toContain("return useApp().refreshRemoteFleet()");
    expect(appShell).not.toContain("if (canRefreshRemoteAccount(auth)) void useApp().refreshRemoteFleet();");
  });

  it("defers bind refresh until the authenticated bootstrap has selected the development catalog", () => {
    expect(appStore).not.toContain("void refreshRemoteFleet(); // 自吞降级");
    expect(signIn).toContain("app.bindAccount(options.identity);");
    expect(signIn).toContain("rebindAccountScopedStores(options.identity);");
    expect(signIn).toContain("refreshRemoteFleetAfterCatalog(options.identity)");
    expect(bootstrap).toContain("await refreshProductCatalog()");
    expect(bootstrap).toContain("return useApp().refreshRemoteFleet()");
  });

  it("commits fleet, assignments and Home only after all responses share the current account scope", () => {
    expect(appStore).toContain("const [fleet, assignmentState, projection] = await Promise.all([");
    expect(appStore).toContain("if (!remoteAccountEpoch.isCurrent(request)) throw new Error(\"REMOTE_ACCOUNT_CHANGED\");");
    expect(appStore).toContain("// Atomic projection commit: no visible fleet/home half-state.");
    expect(appStore).toContain("homeTruth.value = projection;");
  });

  it("keeps capacityPct inside the canonical 0..100 interval", () => {
    expect(e3Api).toContain("if (capacityPct > 100) return invalid();");
  });
});
