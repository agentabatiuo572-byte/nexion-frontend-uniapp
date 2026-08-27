import type { CompletedTask } from "@/store/types";

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

function shanghaiDayKey(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp < 0) return "";
  return new Date(timestamp + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}

export function todayCompletedTasks(tasks: readonly CompletedTask[], serverNow: number): CompletedTask[] {
  const today = shanghaiDayKey(serverNow);
  if (!today) return [];
  return tasks
    .filter((task) => shanghaiDayKey(task.completedAt) === today)
    .sort((left, right) => right.completedAt - left.completedAt);
}

export function shanghaiClockTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp < 0) return "—";
  return new Date(timestamp + SHANGHAI_OFFSET_MS).toISOString().slice(11, 16);
}
