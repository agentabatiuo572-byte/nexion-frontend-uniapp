import type { CanonicalE3Fleet } from "@/api/device-e3-api";
import { writeAccountRow } from "@/store/account-scoped-storage";

export const CHECKOUT_FLEET_TABLE = "nexgrid-checkout-fleet-v1";

/** A server-confirmed change to devices or reserved slots invalidates another tab's capacity quote. */
export function publishCheckoutFleet(accountKey: string, fleet: CanonicalE3Fleet): void {
  const devices = [...fleet.devices].sort((a, b) => a.id - b.id)
    .map(device => [device.id, device.status, device.activatedAt !== null]);
  writeAccountRow(CHECKOUT_FLEET_TABLE, accountKey, {
    slotCap: fleet.slotCap,
    slotsUsed: fleet.slotsUsed,
    reservedSlots: fleet.reservedSlotCount,
    trialSlots: fleet.trialSlotCount,
    devices,
  });
}
