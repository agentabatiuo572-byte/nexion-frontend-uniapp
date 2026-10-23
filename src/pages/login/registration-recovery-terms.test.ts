import { ref } from "vue";
import { beforeEach, expect, it, vi } from "vitest";
import ts from "typescript";
import loginSource from "./login.vue?raw";
import completionSource from "@/auth/complete-sign-in.ts?raw";
import { resolvePostSignInRoute } from "@/auth/post-sign-in-route";

const state = vi.hoisted(() => ({ current: vi.fn(), nav: vi.fn() }));
vi.mock("@/api/runtime", () => ({ remoteApiEnabled: true,
  sessionVault: { read: () => ({ accessToken: "fixture", user: { userId: 7 } }), revision: () => 1 },
  legalTermsApi: { current: (...args: unknown[]) => state.current(...args) } }));
vi.mock("@/store/locale", () => ({ useLocaleStore: () => ({ code: "vi" }) }));
vi.mock("@/api/order-api", () => ({ captureRuntimeRevision: () => ({ epoch: 1, runId: "" }) }));
vi.mock("@/lib/route", () => ({ navReset: (...args: unknown[]) => state.nav(...args) }));

function method(source: string, name: string, deps: Record<string, unknown>) {
  const script = source.includes("<script") ? source.split('<script setup lang="ts">')[1].split("</script>")[0] : source;
  const ast = ts.createSourceFile("fixture.ts", script, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)!;
  const body = fn.getText(ast).replace(/^export\s+/, "").replace(/\/\/ #ifndef H5[\s\S]*?\/\/ #endif/g, "");
  const code = ts.transpileModule(`${body}; return ${name};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(...Object.keys(deps), code)(...Object.values(deps));
}

const unacknowledged = { source: "server", sourceEnvironment: "PRODUCTION", runId: "", requestedLocale: "vi", resolvedLocale: "vi",
  requestedJurisdiction: "GLOBAL", resolvedJurisdiction: "GLOBAL", provenance: "fixture", version: "v6", acknowledged: false, acknowledgedAt: null };

beforeEach(() => {
  vi.resetModules(); state.current.mockReset(); state.nav.mockReset();
  vi.stubGlobal("uni", { showLoading: vi.fn(), hideLoading: vi.fn() });
});

it.each([false, true])("returns recovered registration to the download page through the real Terms gate (delayed=%s)", async delayed => {
  const gate = await import("@/lib/legal-terms-gate-runtime");
  let respond!: (value: typeof unacknowledged) => void;
  if (delayed) state.current.mockReturnValue(new Promise(done => { respond = done; }));
  else state.current.mockResolvedValue(unacknowledged);
  const completeSignIn = method(completionSource, "completeSignIn", {
    useAuth: () => ({ signIn: () => true, onboardingComplete: false }),
    useApp: () => ({ bindAccount: vi.fn(), projectServerIdentity: vi.fn(), setRemoteTaskForeground: vi.fn() }),
    useSession: () => ({ sessionId: "session", claim: () => ({ requiresRecalibration: false }) }),
    remoteApiEnabled: true, authApi: {}, completedSignIns: new Map(), IDEMPOTENCY_TTL_MS: 600_000,
    rebindAccountScopedStores: vi.fn(), readAccountSessionRecords: () => [{ sessionId: "session" }],
    useProfile: () => ({ projectServerIdentity: vi.fn() }), hydrateCurrentProfileLocale: vi.fn(),
    scheduleLegalTermsGate: gate.scheduleLegalTermsGate, hasPendingLegalTermsRequirement: gate.hasPendingLegalTermsRequirement,
    afterLegalTermsAcknowledged: gate.afterLegalTermsAcknowledged, resolvePostSignInRoute, navReset: state.nav,
  });
  const finish = method(loginSource, "finishSignIn", { signInTimer: undefined, mounted: true, completeSignIn,
    returnParam: ref("/pages/index/index"), refOnLogin: ref(null), stageRemoteRegistrationReceipt: vi.fn(), navReset: state.nav });
  finish({ accountId: "user:7", onboardingComplete: false, serverProfile: { userId: 7 }, serverSessionRevision: 1,
    recoveredRegistration: true, registrationLanguage: "vi" });
  expect(state.nav).toHaveBeenCalledWith(expect.objectContaining({ url: "/pages/register/success" }));
  await vi.waitFor(() => expect(state.current).toHaveBeenCalledOnce());
  if (delayed) respond(unacknowledged);
  const termsUrl = `/pages/onboarding/terms?return=${encodeURIComponent("/pages/register/success")}`;
  await vi.waitFor(() => expect(state.nav).toHaveBeenCalledWith(termsUrl));
  expect(gate.enforcePendingLegalTermsGate("/pages/login/login")).toBe(false);
  expect(gate.enforcePendingLegalTermsGate("/pages/register/success")).toBe(true);
  expect(state.nav.mock.calls.filter(([route]) => typeof route === "string")).toEqual([[termsUrl]]);
});
