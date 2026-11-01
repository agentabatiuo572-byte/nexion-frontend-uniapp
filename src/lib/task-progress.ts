import type { CurrentTask } from "@/store/types";

/** Recovery can outlive the original task lease without creating another current task. */
export function deviceTaskRecovering(device: { recoveryPending?: boolean; currentTask?: Pick<CurrentTask, "status"> | null }): boolean {
  return device.recoveryPending === true || device.currentTask?.status === "RECOVERING";
}

/** Display estimate only; 100% requires the server's completed status. */
export function taskProgressPercent(task: CurrentTask | null | undefined, now: number, interruptedAt?: number | null): number | null {
  if (!task || task.startedAt === null || ["QUEUED", "RECOVERING", "FAILED", "CANCELLED"].includes(task.status ?? "")) return null;
  const progressNow = task.status === "PAUSED" ? task.pausedAt : interruptedAt ?? now;
  if (progressNow == null) return null;
  const elapsedSeconds = (progressNow - task.startedAt) / 1000 - (task.pausedSeconds ?? 0);
  const percent = Math.round(Math.min(1, Math.max(0, elapsedSeconds / task.totalSec)) * 100);
  return Math.min(task.status === "COMPLETED" ? 100 : 99, percent);
}
