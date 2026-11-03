import { describe, expect, it } from "vitest";
import type { CurrentTask } from "@/store/types";
import { deviceTaskRecovering, taskProgressPercent } from "./task-progress";

const startedAt = 1000;
const task: CurrentTask = {
  id: "T-1", category: "EM", type: "Embedding", model: "BGE-M3", client: "TEST", location: "TEST",
  totalSec: 10, startedAt, reward: 0.1, status: "RUNNING",
};

describe("task progress display", () => {
  it("keeps an expired legacy task's device in recovery without inventing a current task", () => {
    expect(deviceTaskRecovering({ currentTask: null, recoveryPending: true })).toBe(true);
    expect(deviceTaskRecovering({ currentTask: { status: "RECOVERING" } })).toBe(true);
    expect(deviceTaskRecovering({ currentTask: null })).toBe(false);
    expect(deviceTaskRecovering({ currentTask: task })).toBe(false);
  });
  it.each(["CLAIMED", "RUNNING", "PAUSED", "VERIFYING", undefined] as const)("never displays confirmed completion for %s", status => {
    const current = { ...task, status, pausedAt: startedAt + 20000 };
    expect(taskProgressPercent(current, startedAt + 9950)).toBe(99);
    expect(taskProgressPercent(current, startedAt + 20000)).toBe(99);
    expect(current.status).toBe(status);
  });

  it.each(["QUEUED", "RECOVERING", "FAILED", "CANCELLED"] as const)("hides progress for %s even after the estimate", status => {
    expect(taskProgressPercent({ ...task, status }, startedAt + 20000)).toBeNull();
  });

  it("allows 100 only with the completed server status", () => {
    expect(taskProgressPercent({ ...task, status: "COMPLETED" }, startedAt + 10000)).toBe(100);
    expect(taskProgressPercent({ ...task, status: "COMPLETED" }, startedAt + 20000)).toBe(100);
  });

  it("preserves pause, interruption and elapsed-time boundaries", () => {
    expect(taskProgressPercent({ ...task, status: "PAUSED", pausedAt: startedAt + 7000, pausedSeconds: 2 }, startedAt + 30000)).toBe(50);
    expect(taskProgressPercent(task, startedAt + 30000, startedAt + 5000)).toBe(50);
    expect(taskProgressPercent(task, startedAt - 1)).toBe(0);
    expect(taskProgressPercent({ ...task, startedAt: null }, startedAt + 30000)).toBeNull();
    expect(taskProgressPercent(null, startedAt + 30000)).toBeNull();
  });
});
