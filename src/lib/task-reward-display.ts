import type { CurrentTask } from "@/store/types";
import { formatAmount } from "./amount-display";

export function formatTaskReward(task: CurrentTask, showPlus = false): string {
  if (task.executionMode !== "SIMULATED") return `${showPlus && task.reward > 0 ? "+" : ""}$${formatAmount(task.reward, 6)}`;
  const amount = formatAmount(task.rewardAmount, 6);
  return `${showPlus && amount !== "0" && amount !== "-" ? "+" : ""}${amount} ${task.rewardAsset ?? "USDT"}`;
}
