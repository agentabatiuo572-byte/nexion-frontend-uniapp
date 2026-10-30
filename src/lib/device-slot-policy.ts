import type { DeviceKind } from "@/store/types";

type SlotDevice = {
  kind: DeviceKind;
  activatedAt: number | null;
  activationUnconfirmed?: boolean;
  pendingDeactivate?: boolean;
};

/** Every activated device instance, including Cloud Share, uses one activation slot. */
export function isActiveSlotDevice(device: SlotDevice): boolean {
  return device.activatedAt !== null && !device.pendingDeactivate;
}

/** A remote lifecycle row without its activation timestamp must be reconciled before activation. */
export function requiresActivationConfirmation(device: Pick<SlotDevice, "activationUnconfirmed">): boolean {
  return device.activationUnconfirmed === true;
}

/** Phones activate through current-installation calibration, never as purchased inventory. */
export function isActivatableInventoryDevice(device: SlotDevice): boolean {
  return device.kind !== "phone" && device.activatedAt === null && !requiresActivationConfirmation(device);
}
