import type { CurrentTask } from "@/store/types";
import { formatAmount } from "./amount-display";
import { formatUsd } from "./usd-display";

export function formatTaskReward(task: CurrentTask, showPlus = false): string {
  if (task.executionMode !== "SIMULATED") return formatUsd(task.reward, "detail", showPlus);
  const amount = formatAmount(task.rewardAmount, "full");
  return `${showPlus && amount !== "0" && amount !== "-" ? "+" : ""}${amount} ${task.rewardAsset ?? "USDT"}`;
}
