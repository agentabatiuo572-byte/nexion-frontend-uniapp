import { afterEach, describe, expect, it, vi } from "vitest";
import { collectDeviceSignals } from "./device-signals";

describe("device signal collection", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("leaves unavailable battery, network, and latency observations unknown", () => {
vi.stubGlobal("uni", { getSystemInfoSync: vi.fn(() => ({ model: "Test", brand: "TestBrand" })) });
    vi.stubGlobal("navigator", {});
    expect(collectDeviceSignals()).toMatchObject({
      batteryLevel: null,
      charging: null,
      networkReachable: null,
      pingMs: null,
      memGB: null,
      cores: null,
      pxDensity: null,
    });
  });
  it("keeps unsupported or out-of-contract observations unknown", () => {
    vi.stubGlobal("uni", { getSystemInfoSync: () => ({ model: "M".repeat(200), brand: "B".repeat(200), batteryLevel: -1 }) });
    vi.stubGlobal("navigator", { deviceMemory: 500, hardwareConcurrency: 1.5 });
    vi.stubGlobal("window", { devicePixelRatio: 100, screen: { width: 1000, height: 1000 } });
    const result = collectDeviceSignals();
    expect(result).toMatchObject({ memGB: null, cores: null, batteryLevel: null, pxDensity: null });
    expect(result.model).toHaveLength(128); expect(result.brand).toHaveLength(128);
  });
  it("still returns a valid raw observation payload when every browser probe is unavailable", () => {
    vi.stubGlobal("uni", { getSystemInfoSync: () => { throw new Error("unsupported"); } });
    vi.stubGlobal("navigator", undefined); vi.stubGlobal("window", undefined); vi.stubGlobal("document", undefined);
    expect(collectDeviceSignals()).toEqual({ memGB: null, cores: null, model: "", brand: "", gpu: "",
      pxDensity: null, pingMs: null, batteryLevel: null, charging: null, networkReachable: null });
  });
});
