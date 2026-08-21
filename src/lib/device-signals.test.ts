import { describe, expect, it, vi } from "vitest";
import { collectDeviceSignals } from "./device-signals";

describe("device signal collection", () => {
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
});
