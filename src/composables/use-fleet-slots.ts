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
  | { kind: "reserved" }
  | { kind: "empty" };

/**
 * Slot order shared by the Home "My devices" ring, avatars and reel and the Earn ring:
 * trial → Online devices → other occupied devices → slots being provisioned → empty slots.
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
    const list: FleetSlot[] = [...occupied.value,
      ...Array.from({ length: app.remoteSlotUsage?.reservedSlotCount ?? 0 }, (): FleetSlot => ({ kind: "reserved" }))];
    while (list.length < app.slotCap) list.push({ kind: "empty" });
    return list.slice(0, app.slotCap);
  });
  const freeSlots = computed(() => Math.max(0, app.slotCap - slotsUsed.value));
  return { trial, fleetReady, fleetVisible, countReady, slotsUsed, freeSlots, trialOnline, devices, occupied, slots };
}
