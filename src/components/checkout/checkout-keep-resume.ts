import type { InjectionKey, ShallowRef } from "vue";
import type { PurchaseKind } from "@/api/purchase-payment-api";
import type { CapacityPending } from "@/lib/capacity-command-recovery";

export type CheckoutKeepResume = Readonly<{ target: string; commandKey: string; operation: CapacityPending["operation"] }>;
export type CheckoutCapacityRecovery = CheckoutKeepResume | Readonly<{ target: string; commandKey: null; operation: null }>;

export const checkoutKeepResumeKey: InjectionKey<ShallowRef<CheckoutKeepResume | null>> = Symbol("checkout-keep-resume");
export const reportCheckoutKeepResumeKey: InjectionKey<(resume: CheckoutKeepResume | null) => void> = Symbol("report-checkout-keep-resume");
export type OwnsCheckoutCapacityPayment = (row: { kind: PurchaseKind; commandKey: string }) => boolean;
export const ownsCheckoutCapacityPaymentKey: InjectionKey<OwnsCheckoutCapacityPayment> = Symbol("owns-checkout-capacity-payment");
