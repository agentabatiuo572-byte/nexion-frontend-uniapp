import { requireCryptoUuid } from "@/lib/secure-command-id";
import { trialApi } from "@/api/runtime";
import type { TrialOriginalPurchase } from "@/api/trial-api";
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
  if (!readTrialTopup(target.accountKey, target.id)) return false;
  return writeAccountRow<TrialTopupRow>(TABLE, target.accountKey, { target: { ...target, page: "checkout" } });
}

export function originalTrialCheckoutHref(purchase: TrialOriginalPurchase): string {
  const query = new URLSearchParams({ source: "trial", product: purchase.device.productNo });
  if (purchase.kind === "BALANCE") query.set("trialResume", purchase.submissionNo);
  else query.set("trialPayment", purchase.paymentNo);
  return `${CHECKOUT}?${query}`;
}

export async function checkTrialTopup(target: TrialTopupReturn): Promise<
  | { status: "ready"; amountUSD: number }
  | { status: "redirect"; href: string }
> {
  const state = await trialApi.state();
  if (state.claimNo !== target.claimNo) return { status: "redirect", href: "/pages/me/trial" };
  if (state.originalPurchase) return { status: "redirect", href: originalTrialCheckoutHref(state.originalPurchase) };
  if (state.status === "converted" && state.conversion?.orderNo)
    return { status: "redirect", href: `/pages/store/order-detail?id=${encodeURIComponent(state.conversion.orderNo)}&result=trial` };
  if (state.status !== "active" && state.status !== "grace") return { status: "redirect", href: "/pages/me/trial" };
  const list = await trialApi.purchaseOptions();
  if (list.status === "ready" && list.claimNo !== state.claimNo) throw new Error("TRIAL_TOPUP_CLAIM_MISMATCH");
  const option = list.status === "ready" ? list.options.find(row => row.productNo === target.productNo) : undefined;
  if (option?.reasonCode === "TRIAL_PRODUCT_QUOTE_UNAVAILABLE")
    throw new Error("TRIAL_TOPUP_QUOTE_UNAVAILABLE");
  const quote = list.status === "unsupported" && state.config.trialProductId === target.productNo ? state.quote
    : option?.canBuy ? option.quote : null;
  if (quote) return { status: "ready", amountUSD: quote.amountUSD };
  if (list.status === "not-convertible") {
    const next = await trialApi.state();
    if (next.claimNo === target.claimNo && next.originalPurchase) return { status: "redirect", href: originalTrialCheckoutHref(next.originalPurchase) };
    if (next.claimNo === target.claimNo && next.status === "converted" && next.conversion?.orderNo)
      return { status: "redirect", href: `/pages/store/order-detail?id=${encodeURIComponent(next.conversion.orderNo)}&result=trial` };
    return { status: "redirect", href: "/pages/me/trial" };
  }
  if (list.status === "unsupported" && state.config.trialProductId === target.productNo)
    throw new Error("TRIAL_TOPUP_QUOTE_UNAVAILABLE");
  return { status: "redirect", href: `/pages/me/trial?product=${encodeURIComponent(target.productNo)}` };
}

/** Native cold launch can restore the last open leg for the same signed-in account. */
export async function pendingTrialTopupHref(accountKey: string, current: () => boolean): Promise<string | null> {
  const record = readAccountRow<TrialTopupRow>(TABLE, accountKey)?.target;
  const target = typeof record?.id === "string" ? readTrialTopup(accountKey, record.id) : null;
  if (!target) return null;
  const review = await checkTrialTopup(target);
  if (!current() || !readTrialTopup(accountKey, target.id)) return null;
  if (review.status === "redirect") {
    clearTrialTopup(accountKey, target.id);
    return review.href;
  }
  if (target.page === "checkout") return trialTopupCheckoutHref(target);
  return target.page === "topup" ? trialTopupHref(target.id) : null;
}

export function clearTrialTopup(accountKey: string, id: string | null): void {
  if (readTrialTopup(accountKey, id)) writeAccountRow(TABLE, accountKey, { target: null });
}
