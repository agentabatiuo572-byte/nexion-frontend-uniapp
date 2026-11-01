import { afterEach, expect, it, vi } from "vitest";
import { ref, computed, nextTick, watch, effectScope } from "vue";
import ts from "typescript";
import source from "./login.vue?raw";
import { ApiError } from "@/api/errors";
import { createAuthApi } from "@/api/auth-api";
import { createSessionVault } from "@/api/session-vault";
import { resolveRemoteLoginErrorKind } from "@/lib/remote-login-error";
import { en } from "@/i18n/messages/en";

it.each(["retryOriginalLogin", "recoverLoginResult"].flatMap(method => [false, true].map(newerSession => [method, newerSession] as const)))
  ("%s cleans up unmounted success by its exact revision (newer session: %s)", async (method, newerSession) => {
    const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
    const ast = ts.createSourceFile("login.ts", script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === method)!;
    const code = ts.transpileModule(fn.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
    const vault = createSessionVault();
    const request = vi.fn().mockResolvedValue(undefined);
    const auth = createAuthApi({ request } as never, vault);
    let complete!: (result: unknown) => void;
    const pending = new Promise(resolve => { complete = resolve; });
    const authApi = { pendingLogin: () => method === "recoverLoginResult", retryLogin: () => pending, recoverLogin: () => pending,
      discardSessionIfCurrent: vi.fn(auth.discardSessionIfCurrent) };
    const deps = { authApi, error: ref(null), loading: ref(false), replayAvailable: ref(true), retryContext: ref({ authMethod: "PASSWORD" }),
      retryNeedsPassword: ref(true), retryPassword: ref("private-input"), retryNeedsCode: ref(false), retryCode: ref(""),
      showCaptcha: ref(false), captchaPurpose: ref("replay"), syncLoginRecovery: vi.fn(), finishSignIn: vi.fn(), otpFlowVersion: 0 };
    const page = new Function(...Object.keys(deps), `let mounted = true; ${code}; return { invoke: ${method}, unmount() { mounted = false; } };`)(...Object.values(deps));
    const operation = page.invoke();
    page.unmount();
    const user = { userId: 1, countryCode: "+86", phone: "13800000001", nickname: "Test", onboardingComplete: true };
    const snapshot = { accessToken: "old-access", refreshToken: "old-refresh", tokenType: "Bearer", user };
    vault.save(snapshot);
    const issuedRevision = vault.revision();
    complete({ kind: "authenticated", user, vaultRevision: issuedRevision });
    if (newerSession) vault.save({ ...snapshot, accessToken: "new-access", refreshToken: "new-refresh", user: { ...user, userId: 2 } });
    await operation;
    expect(authApi.discardSessionIfCurrent).toHaveBeenCalledTimes(1);
    expect(authApi.discardSessionIfCurrent).toHaveBeenCalledWith(issuedRevision);
    expect(deps.finishSignIn).not.toHaveBeenCalled();
    expect(deps.syncLoginRecovery).not.toHaveBeenCalled();
    if (newerSession) {
      expect(vault.read()).toMatchObject({ accessToken: "new-access", user: { userId: 2 } });
      expect(request).not.toHaveBeenCalled();
    } else {
      expect(vault.read()).toBeNull();
      expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: "/auth/users/logout", body: { refreshToken: "old-refresh" } }));
    }
  });

it("restores an actionable challenge panel and never queries an unissued MFA result", async () => {
  const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
  const ast = ts.createSourceFile("login.ts", script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node)
    && ["syncLoginRecovery", "recoverLoginResult", "cancelLoginVerification"].includes(node.name?.text ?? ""))
    .map(node => node.getText(ast)).join("\n");
  const code = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const context = { authMethod: "OAUTH", pending: false, context: { provider: "TELEGRAM", challengeNo: "original" } };
  const authApi = { pendingLogin: () => false, pendingLoginContext: vi.fn().mockReturnValue(context),
    recoverLogin: vi.fn(), cancelLoginChallenge: vi.fn() };
  authApi.cancelLoginChallenge.mockImplementation(() => authApi.pendingLoginContext.mockReturnValue(null));
  const deps = { authApi, loading: ref(false), retryContext: ref(null), loginResultUnknown: ref(false),
    loginRecoveryPending: ref(false), replayAvailable: ref(false), mounted: true, error: ref(null),
    retryPassword: ref(""), retryCode: ref("000000"), showCaptcha: ref(false), remoteTwoFactorChallenge: ref(null), step: ref(1), otpFlowVersion: 0 };
  const page = new Function(...Object.keys(deps), `${code}; return { syncLoginRecovery, recoverLoginResult, cancelLoginVerification };`)(...Object.values(deps));
  page.syncLoginRecovery();
  expect(deps.loginRecoveryPending.value).toBe(true); expect(deps.replayAvailable.value).toBe(true);
  await page.recoverLoginResult();
  expect(authApi.recoverLogin).not.toHaveBeenCalled(); expect(deps.retryContext.value).toEqual(context);
  page.cancelLoginVerification();
  expect(deps.loginRecoveryPending.value).toBe(false); expect(deps.retryCode.value).toBe("");
  expect(source).not.toContain("t.login.recoverAttempt");
});

it("routes the existing captcha challenge back into the original-attempt retry without a fresh password login", async () => {
  const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
  const ast = ts.createSourceFile("login.ts", script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node)
    && ["retryOriginalLogin", "onCaptchaOk"].includes(node.name?.text ?? "")).map(node => node.getText(ast)).join("\n");
  const code = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const authApi = { pendingLogin: () => true, retryLogin: vi.fn()
    .mockRejectedValueOnce(new ApiError({ kind: "http", status: 428, message: "USER_CAPTCHA_REQUIRED" }))
    .mockResolvedValueOnce({ kind: "authenticated", vaultRevision: 1, user: { userId: 1, onboardingComplete: true } }) };
  const showCaptcha = ref(false), captchaPurpose = ref("otp"), retryPassword = ref("private-input"), retryCode = ref("");
  const finishSignIn = vi.fn(), signInWithPassword = vi.fn(), requestCode = vi.fn();
  const deps = { loading: ref(false), replayAvailable: ref(true), retryContext: ref({ authMethod: "PASSWORD", context: { countryCode: "+86", phone: "13800000001" } }),
    retryNeedsPassword: ref(true), retryNeedsCode: ref(false), retryPassword, retryCode, authApi, mounted: true,
    loginRecoveryPending: ref(true), country: ref("+84"), phone: ref("other"), password: ref(""), remoteTwoFactorChallenge: ref(null),
    mode: ref("password"), step: ref(1), code: ref([]), finishSignIn, authenticatedAccountId: () => "user:1",
    error: ref(null), syncLoginRecovery: vi.fn(), recoverLoginResult: vi.fn(), otpFlowVersion: 0,
    remoteLoginError: vi.fn(), ApiError, showCaptcha, captchaPurpose, signInWithPassword, requestCode };
  const names = Object.keys(deps);
  const page = new Function(...names, `${code}; return { retryOriginalLogin, onCaptchaOk };`)(...Object.values(deps));
  await page.retryOriginalLogin();
  expect(showCaptcha.value).toBe(true); expect(captchaPurpose.value).toBe("replay");
  expect(retryPassword.value).toBe("private-input");
  page.onCaptchaOk("server-issued-ticket");
  for (let i = 0; i < 8; i++) await nextTick();
  expect(authApi.retryLogin).toHaveBeenNthCalledWith(2, { password: "private-input", code: undefined, captchaTicket: "server-issued-ticket" });
  expect(finishSignIn).toHaveBeenCalledOnce(); expect(signInWithPassword).not.toHaveBeenCalled(); expect(requestCode).not.toHaveBeenCalled();
  expect(retryPassword.value).toBe("");
  expect(deps.recoverLoginResult).toHaveBeenCalledOnce();
});

const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => { for (const scope of scopes.splice(0)) scope.stop(); });
const testUser = { userId: 1, countryCode: "+86", phone: "13800000001", nickname: "Test", onboardingComplete: true };
const session = { accessToken: "test-access", refreshToken: "test-refresh", tokenType: "Bearer", user: testUser };
const networkError = () => new ApiError({ kind: "network", message: "response lost" });
function recoveryPage(request = vi.fn(), saved?: unknown) {
  let record = saved;
  const vault = createSessionVault();
  const authApi = createAuthApi({ request } as never, vault, { clientSurface: "APP", installationId: () => "install-original",
    attemptStorage: { get: () => record, set: value => { record = JSON.parse(JSON.stringify(value)); }, remove: () => { record = null; } } });
  const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
  const ast = ts.createSourceFile("login.ts", script, ts.ScriptTarget.Latest, true);
  const names = ["syncLoginRecovery", "cancelLoginVerification", "retryOriginalLogin", "recoverLoginResult", "remoteLoginError",
    "signInWithPassword", "isCurrentPasswordFlow", "isCurrentPasswordAttempt"];
  const derived = ["retryNeedsPassword", "retryNeedsCode", "canRetryOriginal"];
  const statements = ast.statements.filter(node => ts.isFunctionDeclaration(node) ? names.includes(node.name?.text ?? "")
    : ts.isVariableStatement(node) ? node.declarationList.declarations.some(d => derived.includes(d.name.getText(ast)))
    : ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(ast) === "watch");
  const compiled = ts.transpileModule(statements.map(node => node.getText(ast)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const state = { authApi, request, vault, ref, computed, watch, ApiError, resolveRemoteLoginErrorKind, t: ref(en), geoText: () => null,
    error: ref<string | null>(null), loading: ref(false), loginRecoveryPending: ref(false), loginResultUnknown: ref(false), replayAvailable: ref(false),
    retryContext: ref(null), retryPassword: ref(""), retryCode: ref(""), showCaptcha: ref(false), captchaPurpose: ref("otp"),
    phone: ref("13800000001"), phoneClean: ref("13800000001"), country: ref("+86"), fullPhone: ref("+8613800000001"),
    password: ref("private-input"), phoneOk: ref(true), pwdOk: ref(true), mode: ref("password"), step: ref(1),
    remoteTwoFactorChallenge: ref(null), code: ref<string[]>([]), focusIdx: ref(0),
    finishSignIn: vi.fn(), authenticatedAccountId: () => "user:1" };
  const scope = effectScope(); scopes.push(scope);
  const page = scope.run(() => new Function(...Object.keys(state), `let mounted = true, otpFlowVersion = 0, signInTimer;
    ${compiled}; return { ${names.join(",")}, canRetryOriginal, leave() { otpFlowVersion += 1; } };`)(...Object.values(state)))!;
  return { ...state, ...page, saved: () => record };
}
async function settleRecovery() { for (let i = 0; i < 8; i++) await nextTick(); }

it("keeps the normal form and actual error after a known invalid-password rejection", async () => {
  const page = recoveryPage(vi.fn().mockRejectedValue(new ApiError({ kind: "auth", status: 401, message: "USER_INVALID_CREDENTIALS" })));
  await page.signInWithPassword(); await settleRecovery();
  expect(page.loginRecoveryPending.value).toBe(false);
  expect(page.retryContext.value).toBeNull(); expect(page.error.value).toBe(en.login.errorInvalidCredentials);
  expect(page.request).toHaveBeenCalledOnce();
  expect(source).toContain('<view v-if="!loginRecoveryPending" class="lg-body">');
  expect(source).not.toContain("t.login.takeoverNotice");
});

it("automatically consumes a lost response once without issuing another login", async () => {
  const page = recoveryPage(vi.fn().mockRejectedValueOnce(networkError()).mockResolvedValueOnce(session));
  await page.signInWithPassword(); await settleRecovery();
  expect(page.request).toHaveBeenCalledTimes(2);
  expect(page.request.mock.calls[1][0].path).toContain("/recover");
  expect(page.finishSignIn).toHaveBeenCalledOnce(); expect(page.error.value).toBeNull();
  expect(page.authApi.pendingLogin()).toBe(false);
});

it("preserves the actual refusal from automatic recovery without discarding the unresolved original", async () => {
  const page = recoveryPage(vi.fn().mockRejectedValueOnce(networkError())
    .mockRejectedValueOnce(new ApiError({ kind: "http", status: 429, message: "USER_LOGIN_RATE_LIMITED" })));
  await page.signInWithPassword(); await settleRecovery();
  expect(page.request).toHaveBeenCalledTimes(2); expect(page.error.value).toBe(en.login.errorTemporarilyLocked);
  expect(page.authApi.pendingLogin()).toBe(true); expect(page.replayAvailable.value).toBe(true);
});

it("leaves actionable inputs after a failed read, and retries only the frozen original attempt", async () => {
  const page = recoveryPage(vi.fn().mockRejectedValueOnce(networkError()).mockRejectedValueOnce(networkError())
    .mockRejectedValueOnce(networkError()).mockResolvedValueOnce(session));
  await page.signInWithPassword(); await settleRecovery();
  expect(page.request).toHaveBeenCalledTimes(2); expect(page.loginRecoveryPending.value).toBe(true);
  expect(page.replayAvailable.value).toBe(true); expect(page.canRetryOriginal.value).toBe(false);
  expect(page.retryContext.value).toMatchObject({ context: { countryCode: "+86", phone: "13800000001" } });
  const original = page.request.mock.calls[0][0];
  const durable = JSON.stringify(page.saved());
  expect(durable).not.toContain("private-input");
  page.country.value = "+84"; page.phone.value = "other-account";
  page.retryPassword.value = "re-entered-private-input";
  expect(page.canRetryOriginal.value).toBe(true);
  await page.retryOriginalLogin(); await settleRecovery();
  expect(page.request).toHaveBeenCalledTimes(4);
  expect(page.request.mock.calls[2][0].path).toContain("/recover");
  expect(page.request.mock.calls[3][0]).toMatchObject({ path: original.path, headers: original.headers,
    body: { countryCode: "+86", phone: "13800000001", password: "re-entered-private-input" } });
  expect(page.finishSignIn).toHaveBeenCalledOnce(); expect(page.retryPassword.value).toBe("");
});

it("an explicit retry consumes a recovered issuance instead of replaying it", async () => {
  const page = recoveryPage(vi.fn().mockRejectedValueOnce(networkError()).mockRejectedValueOnce(networkError()).mockResolvedValueOnce(session));
  await page.signInWithPassword(); await settleRecovery(); page.retryPassword.value = "re-entered";
  await page.retryOriginalLogin(); await settleRecovery();
  expect(page.request).toHaveBeenCalledTimes(3);
  expect(page.request.mock.calls.slice(1).every(([call]: [{ path: string }]) => call.path.endsWith("/recover"))).toBe(true);
  expect(page.finishSignIn).toHaveBeenCalledOnce(); expect(page.retryPassword.value).toBe("");
});

it("cold restart automatically reads once, retaining proof and inputs when the read remains unavailable", async () => {
  const first = recoveryPage(vi.fn().mockRejectedValue(networkError()));
  await expect(first.authApi.login({ countryCode: "+86", phone: "13800000001", password: "not-persisted" })).rejects.toThrow();
  const saved = first.saved();
  const restarted = recoveryPage(vi.fn().mockRejectedValue(networkError()), saved);
  restarted.syncLoginRecovery(); await settleRecovery();
  expect(restarted.request).toHaveBeenCalledOnce(); expect(restarted.saved()).toEqual(saved);
  expect(restarted.replayAvailable.value).toBe(true); expect(restarted.loginResultUnknown.value).toBe(true);
  expect(restarted.retryContext.value).toMatchObject({ context: { phone: "13800000001" } });
  expect(restarted.retryPassword.value).toBe(""); expect(restarted.loading.value).toBe(false);
});

it("a recovery arriving after the page flow changes only discards its exact issuance", async () => {
  let resolve!: (result: unknown) => void;
  const page = recoveryPage(vi.fn().mockRejectedValueOnce(networkError()).mockImplementationOnce(() => new Promise(yes => { resolve = yes; })));
  await page.signInWithPassword(); await nextTick(); page.leave();
  resolve(session); await settleRecovery();
  expect(page.vault.read()).toBeNull(); expect(page.finishSignIn).not.toHaveBeenCalled();
  expect(page.request).toHaveBeenCalledTimes(3);
  expect(page.request.mock.calls[2][0].path).toBe("/auth/users/logout");
});
