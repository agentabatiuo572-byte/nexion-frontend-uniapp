import { describe, expect, it } from "vitest";
import { isActiveSlotDevice, occupiesDeviceSlot } from "./device-slot-policy";

describe("device slot policy", () => {
  it("keeps Cloud Share visible but excludes it from the six physical activation slots", () => {
    expect(occupiesDeviceSlot("cloud-share")).toBe(false);
    expect(isActiveSlotDevice({ kind: "cloud-share", activatedAt: Date.now() })).toBe(false);
  });

  it("counts active phones, PC shares, boxes and racks as physical slot occupants", () => {
    expect(occupiesDeviceSlot("phone")).toBe(true);
    expect(occupiesDeviceSlot("pc-gpu")).toBe(true);
    expect(occupiesDeviceSlot("stellarbox-s1")).toBe(true);
    expect(occupiesDeviceSlot("stellarrack-p2")).toBe(true);
    expect(isActiveSlotDevice({ kind: "phone", activatedAt: null })).toBe(false);
  });
});
