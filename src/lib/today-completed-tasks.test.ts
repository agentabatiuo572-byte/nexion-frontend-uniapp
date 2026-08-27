import { describe, expect, it } from "vitest";
import type { CompletedTask } from "@/store/types";
import { todayCompletedTasks } from "./today-completed-tasks";

function task(id: string, completedAt: string): CompletedTask {
  return {
    id,
    model: `Model ${id}`,
    type: "LLM inference",
    category: "LL",
    client: "NexGrid",
    location: "",
    totalSec: 60,
    startedAt: Date.parse(completedAt) - 60_000,
    reward: 0.012,
    completedAt: Date.parse(completedAt),
    receiptNo: `R-${id}`,
  };
}

describe("today completed tasks", () => {
  it("uses the Asia/Shanghai business day and sorts the newest task first", () => {
    const serverNow = Date.parse("2026-08-25T16:30:00Z"); // 2026-08-26 00:30 in Shanghai
    const tasks = [
      task("previous", "2026-08-25T15:59:59Z"),
      task("newer", "2026-08-25T16:20:00Z"),
      task("older", "2026-08-25T16:05:00Z"),
    ];

    expect(todayCompletedTasks(tasks, serverNow).map((entry) => entry.id))
      .toEqual(["newer", "older"]);
  });

  it("returns every completed task from today without inventing a fixed count", () => {
    const serverNow = Date.parse("2026-08-25T08:00:00Z");
    const tasks = Array.from({ length: 5 }, (_, index) =>
      task(String(index + 1), `2026-08-25T0${index + 1}:00:00Z`),
    );

    expect(todayCompletedTasks(tasks, serverNow)).toHaveLength(5);
  });

  it("fails closed for invalid timestamps", () => {
    const invalid = { ...task("invalid", "2026-08-25T01:00:00Z"), completedAt: Number.NaN };
    expect(todayCompletedTasks([invalid], Date.parse("2026-08-25T08:00:00Z"))).toEqual([]);
  });
});
