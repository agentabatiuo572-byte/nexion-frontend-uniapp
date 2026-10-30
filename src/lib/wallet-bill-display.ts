import { formatAmount } from "./amount-display";
import { formatUsd } from "./usd-display";
import { fmt } from "@/i18n/format";
import type { BillType } from "@/store/bills";

type DisplayBill = {
  memo: string;
  memoKey?: string;
  memoParams?: Record<string, string | number>;
  ref?: string;
  amount?: number;
  amountExact?: string;
};

/**
 * Server wallet rows carry a controlled presentation code. The stored ledger
 * remark remains an audit field and must never become user-facing fallback.
 */
export function resolveWalletBillMemo(bill: DisplayBill, memo: Record<string, string>, courseTitles: Record<string, string> = {}): string {
  // The canonical Bill amount already encodes IN/OUT; missing direction stays neutral.
  const memoKey = bill.memoKey === "refer"
    ? typeof bill.amount !== "number" || !Number.isFinite(bill.amount) || bill.amount === 0
      ? "referNeutral"
      : bill.amount < 0 ? "referDebit" : "refer"
    : bill.memoKey;
  const keyed = memoKey && Object.prototype.hasOwnProperty.call(memo, memoKey) ? memo[memoKey] : undefined;
  if (typeof keyed === "string" && keyed) {
    const params = bill.memoParams && Object.fromEntries(Object.entries(bill.memoParams).map(([key, value]) => {
      const amount = key === "nex" && ["withdrawNexFee", "withdrawNexRefund"].includes(memoKey ?? "")
        ? bill.amountExact?.replace(/^-/, "") ?? (bill.amount === undefined ? value : Math.abs(bill.amount)) : value;
      return [key, ["amount", "nex", "usdt", "usd", "fee"].includes(key) ? formatAmount(amount) : value];
    }));
    const label = params ? fmt(keyed, params) : keyed;
    const courseTitle = bill.memoKey === "learningReward" && bill.ref ? courseTitles[bill.ref] : undefined;
    return bill.memoKey === "learningReward" && bill.ref
      ? `${label} · ${courseTitle || bill.ref}`
      : label;
  }
  return memo.other ?? "Other ledger entry";
}

/** Unsigned bill amount in the ledger's own precision (USDT detail, UVT overview); Vietnamese swaps the separators. */
export function formatWalletBillDecimal(exact: string | undefined, fallback: number, symbol: "USDT" | "UVT", locale: string): string {
  const amount = exact === undefined ? Math.abs(fallback) : exact.replace(/^-/, "");
  const formatted = formatUsd(amount, symbol === "USDT" ? "detail" : "overview").replace("$", "");
  return locale.startsWith("vi") ? formatted.replace(/[.,]/g, mark => mark === "." ? "," : ".") : formatted;
}

// Type accent colours. Most map to tokens; refer/topup use official accents
// (like the card-brand colours) kept literal on purpose.
export const WALLET_BILL_TYPE_COLOR: Record<BillType, string> = {
  earn: "var(--v5-brand)",
  refer: "#86E81F",
  bonus: "var(--v5-warning)",
  topup: "#3DA9FF",
  withdraw: "var(--v5-brand-2)",
  purchase: "var(--v5-tech-cyan)",
  refund: "var(--v5-tech-cyan)",
  swap: "var(--v5-brand)",
  verification: "var(--v5-tech-cyan)",
  stake: "var(--v5-warning)",
  unstake: "var(--v5-ink-3)",
  achievement: "var(--v5-warning)",
  other: "var(--v5-ink-3)",
};
