import type { CurrentTask } from "@/store/types";
import { formatAmount } from "./amount-display";
import { formatUsd } from "./usd-display";

export function formatTaskReward(task: CurrentTask, showPlus = false, withUnit = true): string {
  if (task.executionMode !== "SIMULATED") return formatUsd(task.reward, "detail", showPlus);
  const amount = formatAmount(task.rewardAmount, "full");
  const signed = `${showPlus && amount !== "0" && amount !== "-" ? "+" : ""}${amount}`;
  return withUnit ? `${signed} ${taskRewardUnit(task)}` : signed;
}

// The trailing unit of a task reward; USD rewards carry a "$" prefix instead.
export function taskRewardUnit(task: CurrentTask): string | null {
  return task.executionMode === "SIMULATED" ? task.rewardAsset ?? "USDT" : null;
}
