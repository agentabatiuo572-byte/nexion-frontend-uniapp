import type { InjectionKey, ShallowRef } from "vue";
import type { PurchaseKind } from "@/api/purchase-payment-api";
import { remoteApiEnabled } from "@/api/runtime";
import { readCapacityPending, type CapacityPending } from "@/lib/capacity-command-recovery";
import { deviceNameByKind } from "@/lib/device-copy";
import { getProduct } from "@/mock/products";
import { DEVICE_SPECS } from "@/store/device-types";
import { refusedPurchasePayment } from "@/store/purchase-payment";
import type { DeviceKind } from "@/store/types";

type CheckoutCapacityIdentity = Readonly<{ target: string; commandKey: string; operation: CapacityPending["operation"] }>;
export type CheckoutKeepResume = CheckoutCapacityIdentity & (
  Readonly<{ kind: "command" }> | Readonly<{ kind: "intent"; open: () => boolean }>
);
type CheckoutCapacityDetails = Readonly<{ productName: string; payableUsdt: number }>;
export type CheckoutCapacityRecovery = (CheckoutCapacityIdentity & CheckoutCapacityDetails)
  | Readonly<{ target: string; commandKey: null; operation: null }>;

export function describeCapacityOriginal(original: CapacityPending, t: Parameters<typeof deviceNameByKind>[0]) {
  if (original.quote) {
    const { targetProductNo: target, targetProductName: productName, payableUsdt } = original.quote;
    return { target, productName, payableUsdt };
  }
  const { targetProductNo: target, payableUsdt } = original;
  const kind = target as DeviceKind;
  const productName = getProduct(target)?.name ?? deviceNameByKind(t, kind, DEVICE_SPECS[kind]?.name ?? target);
  return { target, productName, payableUsdt };
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
