import type { InjectionKey, ShallowRef } from "vue";
import type { PurchaseKind } from "@/api/purchase-payment-api";
import type { CapacityPending } from "@/lib/capacity-command-recovery";

type CheckoutCapacityIdentity = Readonly<{ target: string; commandKey: string; operation: CapacityPending["operation"] }>;
export type CheckoutKeepResume = CheckoutCapacityIdentity & (
  Readonly<{ kind: "command" }> | Readonly<{ kind: "intent"; open: () => boolean }>
);
export type CheckoutCapacityRecovery = CheckoutCapacityIdentity | Readonly<{ target: string; commandKey: null; operation: null }>;

export const checkoutKeepResumeKey: InjectionKey<ShallowRef<CheckoutKeepResume | null>> = Symbol("checkout-keep-resume");
export const reportCheckoutKeepResumeKey: InjectionKey<(resume: CheckoutKeepResume | null) => void> = Symbol("report-checkout-keep-resume");
export type OwnsCheckoutCapacityPayment = (row: { kind: PurchaseKind; commandKey: string }) => boolean;
export const ownsCheckoutCapacityPaymentKey: InjectionKey<OwnsCheckoutCapacityPayment> = Symbol("owns-checkout-capacity-payment");
export const showsCheckoutCapacityResumeKey: InjectionKey<OwnsCheckoutCapacityPayment> = Symbol("shows-checkout-capacity-resume");
