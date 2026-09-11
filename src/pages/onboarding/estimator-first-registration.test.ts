import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import ts from "typescript";
import source from "./estimator.vue?raw";
import { ApiError } from "@/api/errors";
import { estimatorCalibrationReadErrorState, estimatorCalibrationReadState } from "@/lib/estimator-calibration-read-state";

function mount() {
  const start = source.indexOf("function loadCalibration()");
  const end = source.indexOf("function retryCalibration()", start);
  const readState = ref("loading"), loadFailed = ref(false), calibration = ref<unknown>(null), detected = ref(false);
  let current = true;
  const result = vi.fn();
  const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const load = new Function("scopePair", "isCurrent", "readState", "loadFailed", "calibration", "detected",
    "onboardingCalibrationApi", "getDeviceId", "estimatorCalibrationReadErrorState", "estimatorCalibrationReadState", "scheduleReveal",
    `${code}\nreturn loadCalibration;`,
  )(() => ({}), () => current, readState, loadFailed, calibration, detected, { result }, () => "test-device",
    estimatorCalibrationReadErrorState, estimatorCalibrationReadState, () => { detected.value = true; });
  return { load, result, readState, loadFailed, calibration, detected, invalidate: () => { current = false; } };
}
async function settle() { await Promise.resolve(); await Promise.resolve(); }

describe("first registration estimator", () => {
  it("an authenticated missing calibration shows not started without attempting calibration or activation", async () => {
    const h = mount();
    h.result.mockRejectedValue(new ApiError({ kind: "http", status: 404, message: "ONBOARDING_CALIBRATION_NOT_FOUND" }));
    h.load(); await settle();
    expect(h.readState.value).toBe("not-started");
    expect(h.loadFailed.value).toBe(false);
    expect(h.detected.value).toBe(false);
    expect(h.calibration.value).toBeNull();
    expect(source).toContain("@click=\"goStartCalibration\"");
  });
  it("a confirmed deferred record remains distinct from a failed read", async () => {
    const h = mount();
    h.result.mockResolvedValue({ activationStatus: "DEFERRED", calibrationAvailable: false });
    h.load(); await settle();
    expect(h.readState.value).toBe("deferred");
    expect(h.calibration.value).toBeNull();
  });
  it("a service failure stays unavailable and a subsequent confirmed read recovers", async () => {
    const h = mount();
    h.result.mockRejectedValueOnce(new ApiError({ kind: "http", status: 503, message: "unavailable" }));
    h.load(); await settle();
    expect(h.readState.value).toBe("error");
    const canonical = { activationStatus: "CALIBRATED", calibrationAvailable: true };
    h.result.mockResolvedValueOnce(canonical);
    h.load(); await settle();
    expect(h.readState.value).toBe("ready");
    expect(h.calibration.value).toEqual(canonical);
    expect(h.detected.value).toBe(true);
  });
  it("an old account read cannot change the new page state", async () => {
    const h = mount();
    let reject!: (error: Error) => void;
    h.result.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    h.load(); h.invalidate();
    h.readState.value = "ready";
    reject(new ApiError({ kind: "http", status: 404, message: "ONBOARDING_CALIBRATION_NOT_FOUND" }));
    await settle();
    expect(h.readState.value).toBe("ready");
  });
});
