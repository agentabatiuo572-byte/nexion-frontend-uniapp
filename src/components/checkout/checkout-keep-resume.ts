import type { InjectionKey, ShallowRef } from "vue";

export type CheckoutKeepResume = Readonly<{ target: string; commandKey: string }>;

export const checkoutKeepResumeKey: InjectionKey<ShallowRef<CheckoutKeepResume | null>> = Symbol("checkout-keep-resume");
export const reportCheckoutKeepResumeKey: InjectionKey<(resume: CheckoutKeepResume | null) => void> = Symbol("report-checkout-keep-resume");
