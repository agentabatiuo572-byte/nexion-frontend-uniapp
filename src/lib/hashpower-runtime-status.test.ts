import { describe, expect, it } from "vitest";
import { deviceOnlineState, isDeviceOnline } from "./hashpower";

describe("device online state", () => {
  it.each([
    ["ONLINE", "online"],
    ["OFFLINE", "offline"],
    ["UNKNOWN", "unknown"],
  ] as const)("displays server phone runtime %s without a local heartbeat", (runtimeStatus, state) => {
    const device = { kind: "phone", capacitySource: "server" as const, status: runtimeStatus === "ONLINE" ? "online" as const : "offline" as const, runtimeStatus, onlineHeartbeatAt: null };
    expect(deviceOnlineState(device, 10_000)).toBe(state);
    expect(isDeviceOnline(device, 10_000)).toBe(false);
  });

  it("reports retained server runtime as unknown after a failed fleet refresh", () => {
    expect(deviceOnlineState({ kind: "phone", capacitySource: "server", status: "online", runtimeStatus: "ONLINE" }, 10_000, false)).toBe("unknown");
  });

  it("keeps a deactivated server phone offline even if runtime says online", () => {
    expect(deviceOnlineState({ kind: "phone", capacitySource: "server", status: "offline", runtimeStatus: "ONLINE" }, 10_000)).toBe("offline");
  });

  it("retains the local heartbeat rule for mock phones", () => {
    const device = { kind: "phone", status: "online" as const, onlineHeartbeatAt: 9_000 };
    expect(deviceOnlineState(device, 10_000)).toBe("online");
    expect(deviceOnlineState(device, 200_000)).toBe("offline");
  });
});
