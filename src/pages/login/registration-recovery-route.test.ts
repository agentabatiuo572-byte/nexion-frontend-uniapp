import { expect, it, vi } from "vitest";
import { ref } from "vue";
import ts from "typescript";
import source from "./login.vue?raw";

function method(name: string) {
  const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
  const ast = ts.createSourceFile("login.ts", script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)!;
  const h5 = fn.getText(ast).replace(/\/\/ #ifndef H5[\s\S]*?\/\/ #endif/g, "");
  return ts.transpileModule(h5, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
}

const user = { userId: 37, countryCode: "+86", phone: "13800000037", nickname: "Recovery", onboardingComplete: false };
const receipt = { sponsorCode: "INVITE", sponsorDisplayName: "Sponsor", sourceEnvironment: "PRODUCTION" as const, welcomeRewardStatus: "PENDING" };

it.each(["retryOriginalLogin", "recoverLoginResult"])("%s retains the original registration context after completion clears it", async name => {
  const context = ref({ authMethod: "REGISTRATION", context: { language: "vi" } });
  const result = { kind: "authenticated", user, vaultRevision: 5, registrationReceipt: receipt };
  const authApi = { pendingLogin: () => true, retryLogin: vi.fn().mockResolvedValue(result), recoverLogin: vi.fn().mockResolvedValue(result) };
  const deps = { authApi, retryContext: context, loading: ref(false), replayAvailable: ref(true), retryNeedsPassword: ref(true),
    retryPassword: ref("newly-entered-password"), retryNeedsCode: ref(true), retryCode: ref("123456"), mounted: true,
    syncLoginRecovery: () => { context.value = null as never; }, finishSignIn: vi.fn(), authenticatedAccountId: () => "user:37",
    error: ref(null), showCaptcha: ref(false), captchaPurpose: ref("replay") };
  await new Function(...Object.keys(deps), `${method(name)}; return ${name}();`)(...Object.values(deps));
  expect(deps.finishSignIn).toHaveBeenCalledWith(expect.objectContaining({ recoveredRegistration: true, registrationReceipt: receipt,
    registrationLanguage: "vi", serverSessionRevision: 5 }));
});

it.each([true, false])("a recovered registration preserves the success/download route (completion succeeds: %s)", success => {
  const deps = { signInTimer: undefined, mounted: true, isCurrentOtpFlow: () => true, completeSignIn: vi.fn(() => success
    ? { ok: true } : { ok: false, error: "SERVER_PROFILE_REQUIRED" }), returnParam: ref("/pages/index/index"), refOnLogin: ref(null),
    stageRemoteRegistrationReceipt: vi.fn(), navReset: vi.fn(), loading: ref(true), error: ref(null), geoText: () => null,
    t: ref({ authOtp: { errorServiceUnavailable: "Unavailable" }, login: {} }) };
  const invoke = new Function(...Object.keys(deps), `${method("finishSignIn")}; return finishSignIn;`)(...Object.values(deps));
  invoke({ accountId: "user:37", onboardingComplete: false, serverProfile: user, serverSessionRevision: 5,
    recoveredRegistration: true, registrationReceipt: receipt, registrationLanguage: "vi" });
  expect(deps.completeSignIn).toHaveBeenCalledWith(expect.objectContaining({ deferNavigation: true, registrationLocale: "vi" }));
  if (success) {
    expect(deps.stageRemoteRegistrationReceipt).toHaveBeenCalledWith(receipt, "user:37");
    expect(deps.navReset).toHaveBeenCalledWith(expect.objectContaining({ url: "/pages/register/success" }));
  } else {
    expect(deps.stageRemoteRegistrationReceipt).not.toHaveBeenCalled();
    expect(deps.navReset).not.toHaveBeenCalled();
  }
});

it("an ordinary login never becomes a registration solely because a response contains a receipt", () => {
  const deps = { signInTimer: undefined, mounted: true, isCurrentOtpFlow: () => true, completeSignIn: vi.fn(() => ({ ok: true })),
    returnParam: ref("/pages/index/index"), refOnLogin: ref(null), stageRemoteRegistrationReceipt: vi.fn(), navReset: vi.fn() };
  const invoke = new Function(...Object.keys(deps), `${method("finishSignIn")}; return finishSignIn;`)(...Object.values(deps));
  invoke({ accountId: "user:37", onboardingComplete: false, serverProfile: user, registrationReceipt: receipt });
  expect(deps.completeSignIn).toHaveBeenCalledWith(expect.objectContaining({ returnTo: "/pages/index/index", deferNavigation: undefined }));
  expect(deps.stageRemoteRegistrationReceipt).not.toHaveBeenCalled();
  expect(deps.navReset).not.toHaveBeenCalled();
});
