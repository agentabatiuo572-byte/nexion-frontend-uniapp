import type { CanonicalQuest, QuestSnapshot } from "@/api/quest-api";
import type { CanonicalComputeReceiptSummary } from "@/api/task-assignment-api";
import type { SeenMissions, SeenOrders } from "@/store/me-entry-seen";
import type { Order } from "@/store/orders";
import type { Device } from "@/store/types";
import { isActionableQuest, isCurrentQuest } from "./actionable-quest";
import { dayOneClaimState } from "./day-one-claim-state";
import { isActivatableInventoryDevice, requiresActivationConfirmation } from "./device-slot-policy";
import { isStakingVisibilityRoute } from "./route";

export function latestMeOrders(orders: readonly Order[]): SeenOrders {
  const latestAt = orders.length ? Math.max(...orders.map(order => order.placedAt)) : null;
  return { latestAt, orderIds: orders.filter(order => order.placedAt === latestAt).map(order => order.id) };
}

export function hasNewMeOrders(current: SeenOrders, seen: SeenOrders): boolean {
  if (current.latestAt === null) return false;
  if (seen.latestAt === null || current.latestAt > seen.latestAt) return true;
  return current.latestAt === seen.latestAt && current.orderIds.some(id => !seen.orderIds.includes(id));
}

type MissionSnapshot = Pick<QuestSnapshot, "quests" | "dayOneRequiredTaskCount" | "dayOneSnapshotStatus">;

export function meMissionFacts(
  snapshot: MissionSnapshot,
  now: number,
  stakingVisible: boolean,
  weeklyTargetClosed: (quest: CanonicalQuest) => boolean,
): SeenMissions {
  const shown = snapshot.quests.filter(row => stakingVisible || !isStakingVisibilityRoute(row.actionRoute));
  const weekHero = shown.find(row => row.layer === "WEEKLY_T1" && isCurrentQuest(row, now));
  const actionable = shown.filter(row => (row.layer !== "WEEKLY_T1" || row === weekHero) && isActionableQuest(row, now));
  const identity = (row: QuestSnapshot["quests"][number]) => JSON.stringify([row.instanceKey, row.questCode]);
  const claimable = actionable.filter(row => row.layer !== "DAY_ONE" && (row.status === "COMPLETED" || row.status === "CLAIMABLE")).map(identity);
  if (dayOneClaimState(snapshot.quests, snapshot.dayOneRequiredTaskCount, snapshot.dayOneSnapshotStatus, now).claimCode) {
    const dayOne = snapshot.quests.find(row => row.layer === "DAY_ONE" && isActionableQuest(row, now));
    if (dayOne) claimable.push(JSON.stringify([dayOne.instanceKey]));
  }
  const participating = actionable
    .filter(row => row.status === "PENDING" && (row.layer === "DAY_ONE" || !weeklyTargetClosed(row)))
    .map(identity);
  return { participating, claimable };
}

export function latestMeReceipt(items: readonly CanonicalComputeReceiptSummary[]): number | null {
  return items.length ? items[0].completedAt : null;
}

export function isShownInventoryDevice(device: Device): boolean {
  return device.activatedAt !== null || isActivatableInventoryDevice(device) || requiresActivationConfirmation(device);
}
