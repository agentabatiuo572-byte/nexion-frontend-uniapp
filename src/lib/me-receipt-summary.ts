import { taskAssignmentApi } from "@/api/runtime";
import { invalidatePassiveTabRead, rememberPassiveTabRead, runPassiveTabRead } from "./passive-tab-read";
import { latestMeReceipt } from "./me-entry-facts";

const RESOURCE = "me-compute-receipt-summary";

export function readMeReceiptSummary(force: boolean): Promise<{ latestAt: number | null }> {
  if (force) invalidatePassiveTabRead(RESOURCE);
  return runPassiveTabRead(RESOURCE, async () => ({
    latestAt: latestMeReceipt((await taskAssignmentApi.receipts(0, 1)).items),
  }));
}

export function rememberMeReceiptSummary(latestAt: number | null): void {
  invalidatePassiveTabRead(RESOURCE);
  void rememberPassiveTabRead(RESOURCE, Promise.resolve({ latestAt }));
}
