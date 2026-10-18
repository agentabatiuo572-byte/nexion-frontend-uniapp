import { describe, expect, it } from "vitest";
import ts from "typescript";

const source = (import.meta.glob("./proof.vue", {
  query: "?raw",
  import: "default",
  eager: true,
})["./proof.vue"] ?? "") as string;

describe("Proof remote snapshot scope", () => {
  it("counts only confirmed online non-phone devices and keeps unread facts unknown", () => {
    const ast = ts.createSourceFile("proof.ts", source.split('<script setup lang="ts">')[1].split('</script>')[0], ts.ScriptTarget.Latest, true);
    let callback = "";
    ast.forEachChild(node => {
      if (!ts.isVariableStatement(node)) return;
      for (const declaration of node.declarationList.declarations) {
        if (declaration.name.getText(ast) === "onlineDevices" && declaration.initializer && ts.isCallExpression(declaration.initializer))
          callback = declaration.initializer.arguments[0].getText(ast);
      }
    });
    const count = new Function("app", "remoteSnapshot", "isDeviceOnline", `const remoteApiEnabled = true; return (${callback})();`);
    const app = { remoteFleetStatus: "ready", visibleDevices: [
      { kind: "phone", activatedAt: 1, online: true }, { kind: "stellarbox-s1", activatedAt: 1, online: true },
      { kind: "cloud-share", activatedAt: 1, online: true }, { kind: "stellarbox-pro", activatedAt: 1, online: false },
    ] };
    const snapshot = { value: {} as object | null };
    const online = (device: { online: boolean }) => device.online;
    expect(count(app, snapshot, online)).toBe(2);
    for (const status of ["loading", "error"]) { app.remoteFleetStatus = status; expect(count(app, snapshot, online)).toBeNull(); }
    app.remoteFleetStatus = "ready";
    app.visibleDevices = app.visibleDevices.filter(device => device.kind === "phone");
    expect(count(app, snapshot, online)).toBe(0);
    snapshot.value = null;
    expect(count(app, snapshot, online)).toBeNull();
  });
  it("invalidates and clears the snapshot on account changes and same-account rebinds", () => {
    expect(source).toMatch(/watch\(\[\(\) => String\(app\.accountKey\), \(\) => app\.accountBindingEpoch\]/);
    expect(source).toMatch(/watch\(\[\(\) => String\(app\.accountKey\), \(\) => app\.accountBindingEpoch\][\s\S]{0,500}remoteRequest \+= 1;[\s\S]{0,300}remoteSnapshot\.value = null;[\s\S]{0,200}remoteError\.value = false;/);
  });

  it("fences late account/run responses and invalidates the page lifecycle", () => {
    expect(source).toMatch(/captureRuntimeRevision/);
    expect(source).toMatch(/isCurrentRuntimeRevision/);
    expect(source).toMatch(/remoteMounted && request === remoteRequest/);
    expect(source).toMatch(/onUnload\(invalidateRemoteProof\)/);
    expect(source).toMatch(/onUnmounted\(invalidateRemoteProof\)/);
  });
});
