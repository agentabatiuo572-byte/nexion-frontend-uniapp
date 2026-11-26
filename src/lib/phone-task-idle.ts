import { projectServerNow } from "@/lib/server-deadline-clock";
import type { Device } from "@/store/types";

/** What the 当前作业 line says for a remote phone without a current task (PRD 6.11, BUG-526), most urgent first.
 * Shared by the earn stage, the device card and the device warehouse row; a running or paused task keeps its own row. */
export type PhoneIdleState = "restoring" | "notReady" | "expired" | "unknown" | "idle";

type PhoneIdleFacts = {
  nativePhoneTaskRecoveryDeviceId: string | null;
  nativePhoneConfigWaitDeviceId: string | null;
  remoteAssignmentStatus: "idle" | "loading" | "ready" | "error";
  remoteAssignmentHasSnapshot: boolean;
};

export function phoneIdleState(device: Device, app: PhoneIdleFacts, monotonicNow: number): PhoneIdleState {
  // Same order as the retired task card: this App's own wait for the task config first, then an unread or failed task
  // read (03 §3.5.2: no failure sentence, 状态待确认 like other devices) before any state taken from the last read.
  if (app.nativePhoneConfigWaitDeviceId === device.id) return "notReady";
  if (app.remoteAssignmentStatus === "error"
    || (!app.remoteAssignmentHasSnapshot && (app.remoteAssignmentStatus === "idle" || app.remoteAssignmentStatus === "loading"))) return "unknown";
  if (device.simulationState === "WAITING_CONFIG") return "notReady";
  // The run window closes on the server clock, projected from the last task read.
  if (device.simulationState === "EXPIRED" || (device.phoneValidUntil != null && device.taskServerNow != null
    && device.taskServerNowReceivedAt != null
    && projectServerNow(device.taskServerNow, device.taskServerNowReceivedAt, monotonicNow) >= device.phoneValidUntil)) return "expired";
  if (app.nativePhoneTaskRecoveryDeviceId === device.id || device.simulationState === "CLOSING") return "restoring";
  return "idle";
}

export function phoneIdleText(state: PhoneIdleState,
  phone: { restoring: string; notReady: string; expired: string },
  earn: { runtimeUnknown: string; noCurrentTask: string }): string {
  switch (state) {
    case "restoring": return phone.restoring;
    case "notReady": return phone.notReady;
    case "expired": return phone.expired;
    case "unknown": return earn.runtimeUnknown;
    default: return earn.noCurrentTask;
  }
}
