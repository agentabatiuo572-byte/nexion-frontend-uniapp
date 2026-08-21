export interface RemoteReceiptProjection {
  receiptNo?: string | null;
}

export interface RemoteDeviceProjection {
  recentTasks?: readonly RemoteReceiptProjection[] | null;
}

export interface RemoteAchievementProjection {
  status?: string | null;
}

export interface RemotePointsProjection {
  dailyMilestones?: readonly RemoteAchievementProjection[] | null;
  earningMilestones?: readonly RemoteAchievementProjection[] | null;
}

/**
 * Counts the union of server-issued payment and compute receipts. A null
 * source means the server projection has not been confirmed, so callers must
 * render an unavailable value rather than guessing zero.
 */
export function countRemoteReceipts(
  paymentReceipts: readonly RemoteReceiptProjection[] | null | undefined,
  devices: readonly RemoteDeviceProjection[] | null | undefined,
): number | null {
  if (!paymentReceipts || !devices) return null;
  const receiptNos = new Set<string>();
  for (const receipt of paymentReceipts) {
    if (typeof receipt.receiptNo === "string" && receipt.receiptNo.trim()) receiptNos.add(receipt.receiptNo.trim());
  }
  for (const device of devices) {
    for (const task of device.recentTasks ?? []) {
      if (typeof task.receiptNo === "string" && task.receiptNo.trim()) receiptNos.add(task.receiptNo.trim());
    }
  }
  return receiptNos.size;
}

/**
 * Points milestones are the server's achievement projection in remote mode.
 * Only terminal claimed/fired statuses count as unlocked achievements.
 */
export function summarizeRemoteAchievements(
  snapshot: RemotePointsProjection | null | undefined,
): { unlocked: number; total: number } | null {
  if (!snapshot || !Array.isArray(snapshot.dailyMilestones) || !Array.isArray(snapshot.earningMilestones)) return null;
  const rows = [...snapshot.dailyMilestones, ...snapshot.earningMilestones];
  return {
    unlocked: rows.filter((row) => row.status === "CLAIMED" || row.status === "FIRED").length,
    total: rows.length,
  };
}
