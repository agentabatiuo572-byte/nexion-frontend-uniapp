import { computed, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import source from "./terms.vue?raw";
import { sameLegalTermsSession, sameLegalTermsRun } from "@/lib/legal-terms-gate";
import { en } from "@/i18n/messages/en";
import { zh } from "@/i18n/messages/zh";
import { vi as viMessages } from "@/i18n/messages/vi";

const compiled = ts.transpileModule(
  source.slice(source.indexOf("async function loadTerms()"), source.indexOf("</script>"))
    + "\nreturn { loadTerms, confirmTerms };",
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
).outputText;

function harness(messages = en) {
  const t = ref(messages);
  const errorKey = ref<"loadFailed" | "ackFailed" | "sessionChanged" | "runChanged" | "loginRequired" | null>(null);
  const current = { accessToken: "test-session", userId: 1, runEpoch: 1 };
  const snapshot = { source: "server", sourceEnvironment: "PRODUCTION", runId: "", version: "v1", acknowledged: false };
  const deps = {
    remoteApiEnabled: true, loaded: ref(false), loadErrorKey: errorKey, serverTerms: ref<any>(snapshot),
    t, confirming: ref(false), locale: { code: "en" }, returnTo: ref("/pages/me/me"), explicitReturn: ref(false),
    currentSessionFence: () => ({ ...current }), sameLegalTermsSession, sameLegalTermsRun,
    captureRuntimeRevision: () => ({ runId: "", epoch: current.runEpoch }),
    legalTermsApi: { current: vi.fn().mockResolvedValue(snapshot), acknowledge: vi.fn().mockResolvedValue(snapshot) },
    recordLegalTermsAcknowledged: vi.fn(), shouldBlockLegalTermsExit: vi.fn(() => true),
    navTo: vi.fn(), navBack: vi.fn(), buildLegalTermsLoginRoute: vi.fn(), buildLegalTermsRoute: vi.fn(),
    uni: { showToast: vi.fn() },
  };
  const handlers = new Function(...Object.keys(deps), compiled)(...Object.values(deps)) as {
    loadTerms(): Promise<void>; confirmTerms(): Promise<void>;
  };
  return { ...deps, ...handlers, current, snapshot, error: computed(() => errorKey.value ? t.value.terms[errorKey.value] : null) };
}

describe("terms localized failure behavior", () => {
  it.each([en, zh, viMessages])("never exposes the server exception on load or acknowledge", async (messages) => {
    const h = harness(messages);
    h.legalTermsApi.current.mockRejectedValue(new Error("internal SQL token=do-not-show"));
    await h.loadTerms();
    expect(h.error.value).toBe(messages.terms.loadFailed);
    expect(h.loaded.value).toBe(true);
    expect(h.serverTerms.value).toBeNull();
    h.serverTerms.value = h.snapshot;
    h.legalTermsApi.acknowledge.mockRejectedValue(new Error("internal SQL token=do-not-show"));
    await h.confirmTerms();
    expect(h.error.value).toBe(messages.terms.ackFailed);
    expect(h.confirming.value).toBe(false);
    expect(h.navBack).not.toHaveBeenCalled();
  });

  it("changes an existing error with the selected locale", async () => {
    const h = harness();
    h.legalTermsApi.current.mockRejectedValue(new Error("load failed"));
    await h.loadTerms();
    expect(h.error.value).toBe(en.terms.loadFailed);
    h.t.value = zh;
    expect(h.error.value).toBe(zh.terms.loadFailed);
  });

  it("rejects a response from an expired session and keeps duplicate confirmations single-flight", async () => {
    const h = harness();
    let resolve!: (value: any) => void;
    h.legalTermsApi.acknowledge.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const pending = h.confirmTerms();
    await h.confirmTerms();
    expect(h.legalTermsApi.acknowledge).toHaveBeenCalledOnce();
    h.current.runEpoch += 1;
    resolve({ ...h.snapshot, acknowledged: true });
    await pending;
    expect(h.error.value).toBe(en.terms.sessionChanged);
    expect(h.recordLegalTermsAcknowledged).not.toHaveBeenCalled();
    expect(h.navBack).not.toHaveBeenCalled();
  });
});
