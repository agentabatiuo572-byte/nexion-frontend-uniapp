import type { Bill } from "@/store/bills";

/** Only the server-projected course reference may become a learning deep link. */
export function courseRewardId(bill: Pick<Bill, "memoKey" | "ref">): string | null {
  if (bill.memoKey !== "learningReward") return null;
  const match = /^([a-z0-9][a-z0-9-]{2,80})@([A-Za-z0-9][A-Za-z0-9._-]{0,31})$/.exec(bill.ref ?? "");
  return match?.[1] ?? null;
}
