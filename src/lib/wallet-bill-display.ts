import { fmt } from "@/i18n/format";

type DisplayBill = {
  memo: string;
  memoKey?: string;
  memoParams?: Record<string, string | number>;
};

/**
 * Server wallet rows carry a controlled presentation code. The stored ledger
 * remark remains an audit field and must never become user-facing fallback.
 */
export function resolveWalletBillMemo(bill: DisplayBill, memo: Record<string, string>): string {
  const keyed = bill.memoKey && Object.prototype.hasOwnProperty.call(memo, bill.memoKey) ? memo[bill.memoKey] : undefined;
  if (typeof keyed === "string" && keyed) return bill.memoParams ? fmt(keyed, bill.memoParams) : keyed;
  return memo.other ?? "Other ledger entry";
}
