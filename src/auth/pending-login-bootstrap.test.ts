import { expect, it, vi } from "vitest";
import ts from "typescript";
import source from "../App.vue?raw";

function bootstrap(pending: boolean, route = "pages/login/login") {
  const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
  const ast = ts.createSourceFile("App.ts", script, ts.ScriptTarget.Latest, true);
  const functions = ["beginServerSessionRestore", "checkAuthGuard"].map(name => ast.statements
    .find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)!.getText(ast)).join("\n");
  const authApi = { pendingLogin: () => pending, restore: vi.fn().mockResolvedValue(null) };
  const deps = { authApi, remoteApiEnabled: true, serverSessionRestoreEnabled: true,
    reportNativeSessionTiming: vi.fn(), reportNativeSessionStage: vi.fn(), prepareSessionVault: vi.fn(),
    sessionVault: { revision: () => 0, read: () => null }, useAuth: () => ({ isAuthenticated: false }),
    canRefreshRemoteAccount: () => false, hasServerAuthenticatedAccountTrace: () => false,
    clearInvalidRemoteSessionState: vi.fn(), readCurrentRoute: () => route,
    isAuthWhitelisted: (value: string) => /pages\/(login|register)\//.test(value) || value === "pages/onboarding/privacy",
    navReset: vi.fn(), ApiError: Error };
  const code = ts.transpileModule(`let serverSessionRestoreState = "idle", serverSessionRestoreInFlight = null;
    let serverSessionRestoreRetryAt = 0, serverSessionRestoreNoticeShown = false;
    let pendingServerSessionRecovery = false, serverAuthenticatedAccountTraceAtBoot = false, secureBrowserUnsupported = false;
    ${functions}
    return { restore: beginServerSessionRestore, guard: checkAuthGuard, state: () => serverSessionRestoreState };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return { ...new Function(...Object.keys(deps), code)(...Object.values(deps)), ...deps };
}

it("keeps an unresolved attempt ahead of the already-set refresh cookie after a cold boot", async () => {
  const app = bootstrap(true);
  await expect(app.restore()).resolves.toBe(false);
  expect(app.authApi.restore).not.toHaveBeenCalled();
  expect(app.prepareSessionVault).not.toHaveBeenCalled();
  expect(app.state()).toBe("ready");
  expect(app.guard()).toBe(false);
  expect(app.navReset).not.toHaveBeenCalled();
  // The next foreground guard must not restart cookie rotation either.
  await app.restore();
  expect(app.authApi.restore).not.toHaveBeenCalled();
});

it("keeps ordinary cookie restoration when no original attempt is unresolved", async () => {
  const app = bootstrap(false);
  await expect(app.restore()).resolves.toBe(false);
  expect(app.authApi.restore).toHaveBeenCalledOnce();
  expect(app.state()).toBe("failed");
});

it("routes a cold business deep link to the original login recovery without clearing it", async () => {
  const app = bootstrap(true, "pages/me/me");
  await app.restore();
  expect(app.guard()).toBe(true);
  expect(app.navReset).toHaveBeenCalledWith({ url: "/pages/login/login" });
  expect(app.clearInvalidRemoteSessionState).not.toHaveBeenCalled();
  expect(app.authApi.restore).not.toHaveBeenCalled();
});

it.each(["pages/register/register", "pages/onboarding/privacy"])("keeps the existing recovery or readable entry %s", async route => {
  const app = bootstrap(true, route);
  await app.restore();
  expect(app.guard()).toBe(false);
  expect(app.navReset).not.toHaveBeenCalled();
  expect(app.authApi.restore).not.toHaveBeenCalled();
});
