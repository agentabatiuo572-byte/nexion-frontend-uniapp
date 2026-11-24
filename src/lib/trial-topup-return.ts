import { requireCryptoUuid } from "@/lib/secure-command-id";
import { readAccountRow, writeAccountRow } from "@/store/account-scoped-storage";

const TABLE = "nexgrid-trial-topup-return-accounts-v1";
const CHECKOUT = "/pages/store/checkout";
const TOPUP = "/pages/me/wallet-topup";

interface TrialTopupReturn {
  id: string;
  accountKey: string;
  claimNo: string;
  productNo: string;
  productName: string;
  amountUSD: number;
  shortfallUSD: number | null;
  route: typeof CHECKOUT;
  page: "topup" | "checkout";
}

type TrialTopupInput = Omit<TrialTopupReturn, "id" | "route" | "page">;
interface TrialTopupRow { target: TrialTopupReturn | null }

export function rememberTrialTopup(input: TrialTopupInput): string {
  const target: TrialTopupReturn = { ...input, id: requireCryptoUuid(), route: CHECKOUT, page: "topup" };
  if (!writeAccountRow(TABLE, target.accountKey, { target })) throw new Error("TRIAL_TOPUP_RETURN_UNAVAILABLE");
  return trialTopupHref(target.id);
}

export function readTrialTopup(accountKey: string, id: string | null): TrialTopupReturn | null {
  if (!id) return null;
  const target = readAccountRow<TrialTopupRow>(TABLE, accountKey)?.target;
  return target?.id === id && target.accountKey === accountKey && target.route === CHECKOUT
    && typeof target.claimNo === "string" && !!target.claimNo
    && typeof target.productNo === "string" && !!target.productNo && typeof target.productName === "string"
    && Number.isFinite(target.amountUSD) && target.amountUSD > 0
    && (target.shortfallUSD === null || Number.isFinite(target.shortfallUSD) && target.shortfallUSD > 0)
    ? target : null;
}

function trialTopupHref(id: string): string {
  return `${TOPUP}?${new URLSearchParams({ trialTopup: id })}`;
}

export function trialTopupCheckoutHref(target: TrialTopupReturn): string {
  return `${target.route}?${new URLSearchParams({ source: "trial", product: target.productNo, trialTopup: target.id })}`;
}

export function markTrialTopupCheckout(target: TrialTopupReturn): boolean {
  return writeAccountRow<TrialTopupRow>(TABLE, target.accountKey, { target: { ...target, page: "checkout" } });
}

/** Native cold launch can restore the last open leg for the same signed-in account. */
export function pendingTrialTopupHref(accountKey: string): string | null {
  const record = readAccountRow<TrialTopupRow>(TABLE, accountKey)?.target;
  const target = typeof record?.id === "string" ? readTrialTopup(accountKey, record.id) : null;
  if (!target) return null;
  if (target.page === "checkout") return trialTopupCheckoutHref(target);
  return target.page === "topup" ? trialTopupHref(target.id) : null;
}

export function clearTrialTopup(accountKey: string, id: string | null): void {
  if (readTrialTopup(accountKey, id)) writeAccountRow(TABLE, accountKey, { target: null });
}
