// @ts-expect-error Node-only SFC harness.
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as vue from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { zh } from "@/i18n/messages/zh";
import { ApiError } from "@/api/errors";
import * as flow from "@/lib/phone-calibration-flow";
import * as estimatorScope from "@/lib/estimator-scope";
import * as calibrationScope from "@/lib/onboarding-calibration-scope";
import * as format from "@/i18n/format";

const raw = { memGB: null, cores: null, model: "", brand: "", gpu: "", pxDensity: null,
  pingMs: null, batteryLevel: null, charging: null, networkReachable: null };
const record = { userId: 42, deviceId: "phone-1", serverCanonical: true, source: "server", sourceEnvironment: "PRODUCTION",
  runId: "", revision: 3, configRevision: 1, activationStatus: "CALIBRATED", calibrationAvailable: true,
  score: 62, tier: 1, tierName: "Tier 1", tops: 8, baseRateUsdt: 0.04, baseRateNex: 6, signals: raw, comparisonConfig: [] };
const missing = () => new ApiError({ kind: "http", status: 404, message: "ONBOARDING_CALIBRATION_NOT_FOUND" });
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function settle() { for (let n = 0; n < 15; n++) await vue.nextTick(); }

function mount(name: "connect" | "estimator", api: any, query: Record<string, string> = {}) {
  const hooks: Record<string, (...args: any[]) => void> = {};
  const auth = vue.reactive({ accountId: "user:42", email: "", isAuthenticated: true,
    completeOnboarding: vi.fn(() => true), requireOnboarding: vi.fn(), signOut: vi.fn() });
  const app = vue.reactive({ accountKey: "user:42", devices: [], applyPhoneCalibration: vi.fn(),
    refreshRemoteFleet: vi.fn(async () => {}), resumeMining: vi.fn() });
  const navReset = vi.fn();
  const confirmDeferredPhoneActivation = vi.fn();
  let epoch = 0;
  const modules: Record<string, unknown> = {
    vue: { ...vue, onMounted: (fn: () => void) => { hooks.mount = fn; }, onUnmounted: (fn: () => void) => { hooks.unmount = fn; } },
    "@dcloudio/uni-app": { onLoad: (fn: any) => { hooks.load = fn; }, onBackPress: (fn: any) => { hooks.back = fn; } },
    "@/lib/route": { navReset }, "@/store/auth": { useAuth: () => auth }, "@/store/app": { useApp: () => app },
    "@/i18n/use-t": { useT: () => vue.ref(zh) }, "@/i18n/format": format,
    "@/store/session": { useSession: () => ({ markCalibrated: () => true, markPhoneActivationDeferred: () => true }) },
    "@/store/auth-account": { markAuthAccountOnboardingComplete: () => true },
    "@/lib/secure-command-id": { requireCryptoUuid: () => "fixed-unique-command" },
    "@/lib/device-id": { getDeviceId: () => "phone-1" },
    "@/lib/device-signals": { collectDeviceSignals: () => raw },
    "@/api/runtime": { onboardingCalibrationApi: api, remoteApiEnabled: true },
    "@/lib/account-scope": { captureAccountScope: () => ({ epoch }), isCurrentAccountScope: (scope: any) => scope.epoch === epoch },
    "@/lib/estimator-scope": estimatorScope, "@/lib/onboarding-calibration-scope": calibrationScope,
    "@/lib/phone-calibration-flow": flow,
    "@/lib/defer-phone-activation": { confirmDeferredPhoneActivation },
  };
  vi.stubGlobal("uni", { showToast: vi.fn() });
  const source = readFileSync(new URL(`./${name}.vue`, import.meta.url), "utf8").split('<script setup lang="ts">')[1].split("</script>")[0];
  const fields = name === "connect" ? "phase, canonical, retryCalibration, activate, leaveConnect, deferPhoneActivation" : "detected, loadFailed, deferred, calibration, retryCalibration, goConnect";
  const code = ts.transpileModule(`${source}\nexport const page = { ${fields} };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports: any = {};
  const scope = vue.effectScope();
  scope.run(() => new Function("require", "exports", code)((id: string) => modules[id] ?? {}, exports));
  hooks.load?.(query); hooks.mount?.();
  cleanups.push(() => { hooks.unmount?.(); scope.stop(); });
  return { page: exports.page, auth, app, navReset, confirmDeferredPhoneActivation, back: hooks.back, invalidate: () => { epoch++; } };
}

describe("real onboarding page workers", () => {
  it("automatically creates an estimate on first registration and enables the next step", async () => {
    vi.useFakeTimers();
    const api = { result: vi.fn().mockRejectedValue(missing()), calibrate: vi.fn().mockResolvedValue(record), activate: vi.fn() };
    const { page, navReset } = mount("estimator", api);
    await settle(); await vi.advanceTimersByTimeAsync(1200);
    expect(api.calibrate).toHaveBeenCalledExactlyOnceWith("phone-1", raw, 0, "onboarding:fixed-unique-command");
    expect(page.detected.value).toBe(true); expect(page.loadFailed.value).toBe(false);
    page.goConnect(); expect(navReset).toHaveBeenCalledWith(expect.objectContaining({ url: "/pages/onboarding/connect" }));
    expect(api.activate).not.toHaveBeenCalled();
  });
  it("connect reuses that result and waits for an explicit activation click", async () => {
    const api = { result: vi.fn().mockResolvedValue(record), calibrate: vi.fn(),
      activate: vi.fn().mockResolvedValue({ ...record, revision: 4, activationStatus: "ACTIVE" }) };
    const { page, app, navReset } = mount("connect", api);
    await settle(); expect(page.phase.value).toBe("result");
    expect(api.calibrate).not.toHaveBeenCalled(); expect(api.activate).not.toHaveBeenCalled();
    await page.activate();
    expect(api.activate).toHaveBeenCalledWith("phone-1", 3, "phone-activation:active:fixed-unique-command");
    expect(app.applyPhoneCalibration).toHaveBeenCalledOnce();
    expect(navReset).toHaveBeenCalledWith(expect.objectContaining({ url: "/pages/index/index" }));
  });
  it("warehouse recalibration starts only on click and uses the latest revision", async () => {
    const api = { result: vi.fn().mockResolvedValue(record), calibrate: vi.fn().mockResolvedValue({ ...record, revision: 4 }) };
    const { page } = mount("connect", api, { mode: "recalibrate" });
    await settle(); expect(api.result).not.toHaveBeenCalled();
    page.phase.value = "calibrating"; await settle();
    expect(api.calibrate).toHaveBeenCalledWith("phone-1", raw, 3, "onboarding:fixed-unique-command");
    expect(page.phase.value).toBe("result");
  });
  it("confirms a lost activation response by readback without a second activation", async () => {
    const api = { result: vi.fn().mockResolvedValueOnce(record).mockResolvedValue({ ...record, revision: 4, activationStatus: "ACTIVE" }),
      calibrate: vi.fn(), activate: vi.fn().mockRejectedValue(new ApiError({ kind: "network", message: "lost response" })) };
    const { page, app, navReset } = mount("connect", api); await settle(); await page.activate();
    expect(api.activate).toHaveBeenCalledOnce(); expect(app.applyPhoneCalibration).toHaveBeenCalledOnce();
    expect(navReset).toHaveBeenCalledWith(expect.objectContaining({ url: "/pages/index/index" }));
  });
  it("does not keep retrying an obsolete activation revision after a conflict", async () => {
    const api = { result: vi.fn().mockResolvedValueOnce(record).mockResolvedValue({ ...record, revision: 5 }), calibrate: vi.fn(),
      activate: vi.fn().mockRejectedValueOnce(new ApiError({ kind: "http", status: 409, message: "REVISION_CONFLICT" }))
        .mockResolvedValue({ ...record, revision: 6, activationStatus: "ACTIVE" }) };
    const { page, app } = mount("connect", api); await settle(); await page.activate();
    expect(page.phase.value).toBe("error"); expect(app.applyPhoneCalibration).not.toHaveBeenCalled();
    page.retryCalibration(); await settle();
    expect(api.activate.mock.calls[1][1]).toBe(5); expect(app.applyPhoneCalibration).toHaveBeenCalledOnce();
  });
  it("rereads server state on the next explicit defer retry after an uncertain write", async () => {
    const api = { result: vi.fn().mockResolvedValue(record), calibrate: vi.fn() };
    const { page, confirmDeferredPhoneActivation, navReset } = mount("connect", api); await settle();
    confirmDeferredPhoneActivation.mockRejectedValueOnce(new Error("revision conflict"))
      .mockResolvedValue({ ...record, revision: 5, activationStatus: "DEFERRED" });
    await page.deferPhoneActivation(); expect(page.phase.value).toBe("error");
    expect(navReset).not.toHaveBeenCalled(); page.retryCalibration(); await settle();
    expect(confirmDeferredPhoneActivation.mock.calls[1][0].current).toBeNull();
    expect(navReset).toHaveBeenCalledWith(expect.objectContaining({ url: "/pages/index/index" }));
  });
  it("keeps a previous defer out of the failure screen", async () => {
    const api = { result: vi.fn().mockResolvedValue({ ...record, activationStatus: "DEFERRED" }), calibrate: vi.fn() };
    const { page, navReset } = mount("estimator", api); await settle();
    expect(page.deferred.value).toBe(true); expect(page.loadFailed.value).toBe(false);
    expect(api.calibrate).not.toHaveBeenCalled(); page.retryCalibration();
    expect(navReset).toHaveBeenCalledWith(expect.objectContaining({ url: "/pages/onboarding/connect?mode=resume" }));
  });
  it("blocks visual and hardware back while a recalibration may disable the previous phone", async () => {
    let resolve!: (value: unknown) => void;
    const api = { result: vi.fn().mockResolvedValue(record), calibrate: vi.fn(() => new Promise(r => { resolve = r; })) };
    const { page, navReset, back } = mount("connect", api, { mode: "recalibrate" });
    page.phase.value = "calibrating"; await settle();
    page.leaveConnect(); back(); expect(navReset).not.toHaveBeenCalled();
    resolve({ ...record, revision: 4 }); await settle();
    expect(page.phase.value).toBe("result"); page.leaveConnect(); expect(navReset).toHaveBeenCalledOnce();
  });
  it("makes an invalidated same-account estimator request retryable without exposing its result", async () => {
    let resolve!: (value: unknown) => void;
    const api = { result: vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue(record), calibrate: vi.fn() };
    const { page, invalidate } = mount("estimator", api); await settle();
    invalidate(); resolve(record); await settle();
    expect(page.calibration.value).toBeNull(); expect(page.loadFailed.value).toBe(true);
    page.retryCalibration(); await settle();
    expect(api.result).toHaveBeenCalledTimes(2); expect(page.calibration.value).toEqual(record);
  });
  it("discards a late result after a same-account session rebind", async () => {
    let resolve!: (value: unknown) => void;
    const api = { result: vi.fn(() => new Promise(r => { resolve = r; })), calibrate: vi.fn() };
    const { page, invalidate } = mount("connect", api); await settle();
    invalidate(); resolve(record); await settle();
    expect(page.canonical.value).toBeNull(); expect(page.phase.value).not.toBe("result");
    expect(api.calibrate).not.toHaveBeenCalled();
  });
  it("retries a failed initial read through the complete flow", async () => {
    const api = { result: vi.fn().mockRejectedValueOnce(new ApiError({ kind: "network", message: "offline" })).mockRejectedValue(missing()),
      calibrate: vi.fn().mockResolvedValue(record) };
    const { page } = mount("connect", api); await settle(); expect(page.phase.value).toBe("error");
    page.retryCalibration(); await settle(); expect(page.phase.value).toBe("result");
    expect(api.calibrate).toHaveBeenCalledOnce();
  });
});
