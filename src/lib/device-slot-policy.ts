import type { DeviceKind } from "@/store/types";

type SlotDevice = {
  kind: DeviceKind;
  activatedAt: number | null;
  pendingDeactivate?: boolean;
};

/** Cloud Share is virtual capacity; only physical/host devices use one of the six activation slots. */
export function occupiesDeviceSlot(kind: DeviceKind): boolean {
  return kind !== "cloud-share";
}

export function isActiveSlotDevice(device: SlotDevice): boolean {
  return device.activatedAt !== null && !device.pendingDeactivate && occupiesDeviceSlot(device.kind);
}
