import { describe, expect, it } from "vitest";
import appSource from "./app.ts?raw";
import earnSource from "../pages/earn/earn.vue?raw";

describe("Earn server task progression refresh", () => {
  it("keeps every client environment read-only while refreshing task and earnings projections", () => {
    const start = appSource.indexOf("async function syncRemoteTaskAssignments()");
    const end = appSource.indexOf("// 权威不可达是常态输入", start);
    const sync = appSource.slice(start, end);

    expect(sync).not.toContain("taskAssignmentApi.claim");
    expect(sync).not.toContain("taskAssignmentApi.complete");
    expect(sync).not.toContain("trustedTaskProof");
    expect(sync).not.toContain("taskMutationKey");
    expect(sync).toContain("readRemoteTaskAssignments(request)");
    expect(sync).toContain("refreshRemoteFleet(request)");
    expect(sync).toContain("refreshHomeTruth(request)");

    const fleetStart = appSource.indexOf("async function refreshRemoteFleet");
    const fleetEnd = appSource.indexOf("function bindAccount", fleetStart);
    const fleet = appSource.slice(fleetStart, fleetEnd);
    expect(fleet).toContain("readRemoteTaskAssignments(request)");
    expect(fleet).not.toContain("taskAssignmentApi.state()");
    expect(appSource).toContain("receivedAt + REMOTE_TASK_SYNC_MS");
  });

  it("refreshes both device tasks and today earnings whenever Earn becomes visible", () => {
    const showStart = earnSource.indexOf("onShow(() => {");
    const showEnd = earnSource.indexOf("});", showStart);
    const onShow = earnSource.slice(showStart, showEnd);

    expect(onShow).toContain("app.refreshRemoteFleet()");
    expect(onShow).toContain("app.refreshHomeTruth()");
  });
});
