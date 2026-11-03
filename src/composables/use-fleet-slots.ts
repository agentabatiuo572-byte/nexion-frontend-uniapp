import { computed } from "vue";
import { remoteApiEnabled } from "@/api/runtime";
import { useApp } from "@/store/app";
import { isActiveSlotDevice } from "@/lib/device-slot-policy";
import { deviceOnlineState } from "@/lib/hashpower";
import { deviceTaskRecovering } from "@/lib/task-progress";
import type { Device } from "@/store/types";
import { useTrialPresentation } from "./use-trial-presentation";

export type FleetSlot =
  | { kind: "trial"; online: boolean }
  | { kind: "device"; device: Device; online: boolean }
  /** Occupied per the authoritative slot count but not yet classified (e.g. the trial read is still pending). */
  | { kind: "pending" }
  | { kind: "reserved" }
  | { kind: "empty" };

/**
 * Slot order shared by the Home "My devices" ring, avatars and reel and the Earn ring:
 * trial → Online devices → other occupied devices → occupied but unclassified → slots being provisioned → empty.
 * Once the count is confirmed the drawn breakdown follows the authoritative slot usage.
 */
export function useFleetSlots() {
  const app = useApp();
  const trial = useTrialPresentation();
  // Read-only presentation keeps the bound account's last confirmed fleet while a refresh is pending.
  const fleetReady = computed(() => !remoteApiEnabled || app.remoteFleetStatus === "ready"
    || (app.remoteFleetStatus === "loading" && app.remoteFleetHasSnapshot));
  const fleetVisible = computed(() => !remoteApiEnabled || app.remoteFleetHasSnapshot);
  const countReady = computed(() => fleetReady.value && (app.remoteSlotsUsed != null || trial.reservedSlots.value !== null));
  const slotsUsed = computed(() => app.remoteSlotsUsed ?? app.activeSlotCount + (trial.reservedSlots.value ?? 0));
  const trialOnline = computed(() => trial.presentationReady.value && trial.status.value === "active");
  const devices = computed(() => fleetVisible.value ? app.visibleDevices.filter(isActiveSlotDevice) : []);
  const occupied = computed<FleetSlot[]>(() => {
    const rows = devices.value.map((device): FleetSlot => ({ kind: "device", device,
      online: !deviceTaskRecovering(device) && deviceOnlineState(device, Date.now(), fleetReady.value) === "online" }));
    return [
      ...(trial.active.value ? [{ kind: "trial", online: trialOnline.value } as FleetSlot] : []),
      ...rows.filter((slot) => slot.kind === "device" && slot.online),
      ...rows.filter((slot) => slot.kind === "device" && !slot.online),
    ];
  });
  const slots = computed<FleetSlot[]>(() => {
    let classified = occupied.value;
    let reserved = app.remoteSlotUsage?.reservedSlotCount ?? 0;
    let pending = 0;
    if (countReady.value) {
      // The authoritative count wins in both directions. Fewer used slots than classified items means a stale
      // snapshot: the separately read trial goes first (devices arrive with the count itself), then the tail.
      const used = slotsUsed.value;
      if (classified.length > used) {
        const trialFirst = classified.findIndex((slot) => slot.kind === "trial");
        if (trialFirst >= 0) classified = classified.filter((_, index) => index !== trialFirst);
        classified = classified.slice(0, used);
      }
      reserved = Math.min(reserved, Math.max(0, used - classified.length));
      pending = Math.max(0, used - classified.length - reserved);
    }
    const list: FleetSlot[] = [...classified,
      ...Array.from({ length: pending }, (): FleetSlot => ({ kind: "pending" })),
      ...Array.from({ length: reserved }, (): FleetSlot => ({ kind: "reserved" }))];
    while (list.length < app.slotCap) list.push({ kind: "empty" });
    return list.slice(0, app.slotCap);
  });
  const freeSlots = computed(() => Math.max(0, app.slotCap - slotsUsed.value));
  return { trial, fleetReady, fleetVisible, countReady, slotsUsed, freeSlots, trialOnline, devices, occupied, slots };
}
