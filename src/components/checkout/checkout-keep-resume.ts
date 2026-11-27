import type { InjectionKey, ShallowRef } from "vue";
import type { PurchaseKind } from "@/api/purchase-payment-api";
import { remoteApiEnabled } from "@/api/runtime";
import { readCapacityPending, type CapacityPending } from "@/lib/capacity-command-recovery";
import { productDisplayName } from "@/lib/product-display-name";
import { formatGroupedAmount } from "@/lib/amount-display";
import type { Messages } from "@/i18n/messages/en";
import { refusedPurchasePayment } from "@/store/purchase-payment";

type CheckoutCapacityIdentity = Readonly<{ target: string; commandKey: string; operation: CapacityPending["operation"] }>;
export type CheckoutKeepResume = CheckoutCapacityIdentity & (
  Readonly<{ kind: "command" }> | Readonly<{ kind: "intent"; open: () => boolean }>
);
type CheckoutCapacityDetails = Readonly<{ productName: string; payableUsdt: number }>;
export type CheckoutCapacityRecovery = (CheckoutCapacityIdentity & CheckoutCapacityDetails)
  | Readonly<{ target: string; commandKey: null; operation: null }>;

export function describeCapacityOriginal(original: CapacityPending, t: Messages) {
  const { targetProductNo: target, payableUsdt } = original.quote ?? original;
  const productName = productDisplayName(target, t.headerTitles.storeProduct, original.quote?.targetProductName);
  return { target, productName, payableUsdt };
}

/** Which purchase a recovery prompt is about: product · amount, the amount and unit kept on one line (03 §3.6.1). */
export function capacityOrderLine(order: CheckoutCapacityDetails): string {
  return `${order.productName} · ${formatGroupedAmount(order.payableUsdt)}\u00A0USDT`;
}

/** Title (the result) and note (what not to do) for the checkout's original-purchase state; both checkout pages show the same words. */
export function capacityRecoveryNotice(t: Messages, readError: boolean, operation: CapacityPending["operation"] | null, resumable: boolean) {
  const c = t.tradein;
  if (readError) return { title: c.recoveryUnreadableTitle, note: c.recoveryUnreadableNote };
  if (resumable) return { title: operation === "replace" ? c.recoveryUnpaid : c.keepRecoveryUnpaid, note: c.recoveryNoReorder };
  return { title: operation === "replace" ? c.recoveryCheckingTitle : c.keepRecoveryCheckingTitle, note: c.recoveryCheckingNote };
}

export function originalCapacityCheckoutHref(accountKey: string): string | null {
  const pending = remoteApiEnabled ? readCapacityPending(accountKey) : null;
  if (!pending || refusedPurchasePayment(accountKey, pending.key)) return null;
  const target = pending.quote ? pending.quote.targetProductNo : pending.targetProductNo;
  return capacityCheckoutHref(target);
}

export function capacityCheckoutHref(target: string): string {
  return `/pages/store/checkout?product=${encodeURIComponent(target)}`;
}

export const checkoutKeepResumeKey: InjectionKey<ShallowRef<CheckoutKeepResume | null>> = Symbol("checkout-keep-resume");
export const checkoutCapacityUnreadableTargetKey: InjectionKey<ShallowRef<string | null>> = Symbol("checkout-capacity-unreadable-target");
export const reportCheckoutKeepResumeKey: InjectionKey<(resume: CheckoutKeepResume | null) => void> = Symbol("report-checkout-keep-resume");
export type CheckoutCapacityPaymentRow = { kind: PurchaseKind; commandKey: string; intentNo?: string };
export type OwnsCheckoutCapacityPayment = (row: CheckoutCapacityPaymentRow) => boolean;
export const ownsCheckoutCapacityPaymentKey: InjectionKey<OwnsCheckoutCapacityPayment> = Symbol("owns-checkout-capacity-payment");
export const showsCheckoutCapacityResumeKey: InjectionKey<OwnsCheckoutCapacityPayment> = Symbol("shows-checkout-capacity-resume");
export const openCheckoutCapacityProgressKey: InjectionKey<(row: CheckoutCapacityPaymentRow) => boolean> = Symbol("open-checkout-capacity-progress");
