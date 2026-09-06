import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LegalTermsCurrent } from "@/api/legal-terms-api";

const state = vi.hoisted(() => ({
  session: {
    accessToken: "token-a",
    user: { userId: 7 },
  } as { accessToken: string; user: { userId: number } } | null,
  revision: { epoch: 1, runId: "" },
  sessionRevision: 1,
  current: vi.fn<() => Promise<LegalTermsCurrent>>(),
}));

vi.mock("@/api/runtime", () => ({
  remoteApiEnabled: true,
  sessionVault: { read: () => state.session, revision: () => state.sessionRevision },
  legalTermsApi: { current: () => state.current() },
}));

vi.mock("@/store/locale", () => ({
  useLocaleStore: () => ({ code: "en" }),
}));

vi.mock("@/api/order-api", () => ({
  captureRuntimeRevision: () => state.revision,
}));

const snapshot = (acknowledged: boolean): LegalTermsCurrent => ({
  source: "server",
  sourceEnvironment: "PRODUCTION",
  runId: "",
  requestedLocale: "en",
  resolvedLocale: "en",
  requestedJurisdiction: "GLOBAL",
  resolvedJurisdiction: "GLOBAL",
  provenance: "exact:en/GLOBAL",
  version: "v4",
  effectiveAt: "2026-08-30T00:00:00",
  title: "Terms",
  summary: "Summary",
  sections: [],
  acknowledged,
  acknowledgedAt: acknowledged ? "2026-08-30T00:00:01" : null,
});

async function loadRuntime() {
  vi.resetModules();
  return import("./legal-terms-gate-runtime");
}

async function settleGate(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("legal terms runtime gate", () => {
  beforeEach(() => {
    vi.useRealTimers();
    state.session = { accessToken: "token-a", user: { userId: 7 } };
    state.revision = { epoch: 1, runId: "" };
    state.sessionRevision = 1;
    state.current.mockReset();
    vi.stubGlobal("uni", {
      reLaunch: vi.fn(),
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
    });
  });

  it("re-enforces an unacknowledged requirement after leaving Terms", async () => {
    state.current.mockResolvedValue(snapshot(false));
    const runtime = await loadRuntime();

    runtime.scheduleLegalTermsGate("/pages/me/me");
    await settleGate();

    expect(uni.reLaunch).toHaveBeenCalledTimes(1);
    expect(runtime.enforcePendingLegalTermsGate("/pages/me/me")).toBe(true);
    expect(uni.reLaunch).toHaveBeenLastCalledWith(expect.objectContaining({
      url: "/pages/onboarding/terms?return=%2Fpages%2Fme%2Fme",
    }));
    expect(runtime.enforcePendingLegalTermsGate("/pages/onboarding/terms")).toBe(false);
    expect(runtime.enforcePendingLegalTermsGate("/pages/me/risk-disclosure")).toBe(false);
    expect(runtime.hasPendingLegalTermsRequirement()).toBe(true);
  });

  it("keeps the obligation and permits a later retry after both reset attempts fail", async () => {
    vi.useFakeTimers();
    state.current.mockResolvedValue(snapshot(false));
    const showToast = vi.fn();
    vi.stubGlobal("uni", {
      reLaunch: vi.fn((options: { fail?: () => void }) => options.fail?.()),
      showLoading: vi.fn(), hideLoading: vi.fn(), showToast,
    });
    const runtime = await loadRuntime();
    runtime.scheduleLegalTermsGate("/pages/me/me");
    await settleGate();
    expect(uni.reLaunch).toHaveBeenCalledTimes(2);
    expect(runtime.hasPendingLegalTermsRequirement()).toBe(true);
    expect(runtime.enforcePendingLegalTermsGate("/pages/me/me")).toBe(true);
    expect(runtime.enforcePendingLegalTermsGate("/pages/me/me")).toBe(true);
    expect(runtime.enforcePendingLegalTermsGate("/pages/me/me")).toBe(true);
    expect(uni.reLaunch).toHaveBeenCalledTimes(2);
    expect(showToast).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(runtime.enforcePendingLegalTermsGate("/pages/me/me")).toBe(true);
    expect(uni.reLaunch).toHaveBeenCalledTimes(4);
    expect(showToast).toHaveBeenCalledTimes(2);
    expect(runtime.hasPendingLegalTermsRequirement()).toBe(true);
    vi.useRealTimers();
  });

  it("fails closed synchronously while a fresh session is still being verified", async () => {
    let resolveCurrent!: (value: LegalTermsCurrent) => void;
    state.current.mockReturnValue(new Promise((resolve) => { resolveCurrent = resolve; }));
    const runtime = await loadRuntime();

    runtime.scheduleLegalTermsGate("/pages/store/store");

    expect(runtime.hasPendingLegalTermsRequirement()).toBe(true);
    expect(runtime.enforcePendingLegalTermsGate("/pages/store/store")).toBe(true);
    expect(uni.showLoading).toHaveBeenCalledWith({ title: "", mask: true });
    expect(uni.reLaunch).not.toHaveBeenCalled();

    resolveCurrent(snapshot(true));
    await settleGate();

    expect(runtime.hasPendingLegalTermsRequirement()).toBe(false);
    expect(uni.hideLoading).toHaveBeenCalled();
    expect(uni.reLaunch).not.toHaveBeenCalled();
  });

  it("also pauses an already-verified session during a later authoritative recheck", async () => {
    state.current.mockResolvedValueOnce(snapshot(true));
    const runtime = await loadRuntime();
    runtime.scheduleLegalTermsGate("/pages/index/index");
    await settleGate();

    let resolveRecheck!: (value: LegalTermsCurrent) => void;
    state.current.mockReturnValueOnce(new Promise((resolve) => { resolveRecheck = resolve; }));
    runtime.scheduleLegalTermsGate("/pages/store/store");

    expect(runtime.hasPendingLegalTermsRequirement()).toBe(true);
    expect(runtime.enforcePendingLegalTermsGate("/pages/store/store")).toBe(true);
    expect(uni.reLaunch).not.toHaveBeenCalled();

    resolveRecheck(snapshot(true));
    await settleGate();
    expect(runtime.hasPendingLegalTermsRequirement()).toBe(false);
  });

  it("verifies a direct risk-disclosure entry but preserves an existing acknowledgement gate", async () => {
    let resolveCurrent!: (value: LegalTermsCurrent) => void;
    state.current.mockReturnValueOnce(new Promise((resolve) => { resolveCurrent = resolve; }));
    const runtime = await loadRuntime();

    runtime.scheduleLegalTermsGate("/pages/me/risk-disclosure");
    expect(runtime.hasPendingLegalTermsRequirement()).toBe(true);
    expect(runtime.enforcePendingLegalTermsGate("/pages/me/risk-disclosure")).toBe(true);

    resolveCurrent(snapshot(false));
    await settleGate();
    expect(uni.reLaunch).toHaveBeenLastCalledWith(expect.objectContaining({
      url: "/pages/onboarding/terms?return=%2Fpages%2Fme%2Frisk-disclosure",
    }));

    runtime.scheduleLegalTermsGate("/pages/me/risk-disclosure");
    expect(state.current).toHaveBeenCalledTimes(1);
    expect(runtime.hasPendingLegalTermsRequirement()).toBe(true);
  });

  it("clears the pending requirement only after an authoritative acknowledgement", async () => {
    state.current.mockResolvedValue(snapshot(false));
    const runtime = await loadRuntime();
    runtime.scheduleLegalTermsGate("/pages/me/me");
    await settleGate();

    runtime.recordLegalTermsAcknowledged(snapshot(false));
    expect(runtime.enforcePendingLegalTermsGate("/pages/me/me")).toBe(true);

    runtime.recordLegalTermsAcknowledged(snapshot(true));
    expect(runtime.enforcePendingLegalTermsGate("/pages/me/me")).toBe(false);
  });

  it("fails closed after the current-terms request fails", async () => {
    state.current.mockRejectedValue(new Error("offline"));
    const runtime = await loadRuntime();
    runtime.scheduleLegalTermsGate("/pages/index/index");
    await settleGate();

    expect(runtime.enforcePendingLegalTermsGate("/pages/team/team")).toBe(true);
    expect(uni.reLaunch).toHaveBeenLastCalledWith(expect.objectContaining({
      url: "/pages/onboarding/terms?return=%2Fpages%2Fteam%2Fteam",
    }));

    state.current.mockClear();
    runtime.scheduleLegalTermsGate("/pages/team/team");
    expect(state.current).not.toHaveBeenCalled();
    expect(runtime.enforcePendingLegalTermsGate("/pages/team/team")).toBe(true);
  });

  it("does not carry an account obligation into another session", async () => {
    state.current.mockResolvedValue(snapshot(false));
    const runtime = await loadRuntime();
    runtime.scheduleLegalTermsGate("/pages/me/me");
    await settleGate();

    state.session = { accessToken: "token-b", user: { userId: 8 } };
    expect(runtime.enforcePendingLegalTermsGate("/pages/me/me")).toBe(false);
  });

  it("ignores a late response after the session changes", async () => {
    let resolveCurrent!: (value: LegalTermsCurrent) => void;
    state.current.mockReturnValue(new Promise((resolve) => { resolveCurrent = resolve; }));
    const runtime = await loadRuntime();
    runtime.scheduleLegalTermsGate("/pages/me/me");

    state.session = { accessToken: "token-b", user: { userId: 8 } };
    resolveCurrent(snapshot(false));
    await settleGate();

    expect(uni.reLaunch).not.toHaveBeenCalled();
    expect(runtime.enforcePendingLegalTermsGate("/pages/me/me")).toBe(false);
  });

  it("does not invalidate authenticated terms when the product catalog refreshes mid-request", async () => {
    let resolveOld!: (value: LegalTermsCurrent) => void;
    state.current
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(snapshot(true));
    const runtime = await loadRuntime();
    runtime.scheduleLegalTermsGate("/pages/index/index");

    state.revision = { epoch: 2, runId: "" };
    resolveOld(snapshot(true));
    await settleGate();
    await settleGate();

    expect(state.current).toHaveBeenCalledTimes(1);
    expect(runtime.hasPendingLegalTermsRequirement()).toBe(false);
    expect(uni.reLaunch).not.toHaveBeenCalled();
  });

  it("rejects a late acknowledgement after logout and same-credential re-login", async () => {
    let resolveOld!: (value: LegalTermsCurrent) => void;
    state.current.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(snapshot(false));
    const runtime = await loadRuntime();
    const pending = runtime.scheduleLegalTermsGate("/pages/index/index");
    state.sessionRevision += 2;
    resolveOld(snapshot(true));
    await pending;
    expect(state.current).toHaveBeenCalledTimes(2);
    expect(runtime.hasPendingLegalTermsRequirement()).toBe(true);
  });

  it("rechecks the same user after an access-token rotation during verification", async () => {
    let resolveOld!: (value: LegalTermsCurrent) => void;
    state.current
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(snapshot(true));
    const runtime = await loadRuntime();

    runtime.scheduleLegalTermsGate("/pages/index/index");
    state.session = { accessToken: "token-b", user: { userId: 7 } };
    resolveOld(snapshot(true));
    await settleGate();
    await settleGate();

    expect(state.current).toHaveBeenCalledTimes(2);
    expect(runtime.hasPendingLegalTermsRequirement()).toBe(false);
  });
});
