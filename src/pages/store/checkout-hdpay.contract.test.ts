import { describe, expect, it } from "vitest";
import checkoutSource from "./checkout.vue?raw";

describe("HDPay direct checkout", () => {
  it("creates the hosted session after the canonical order readback and before redirect", () => {
    const readback = checkoutSource.indexOf("E20_CAPACITY_AVAILABLE_ORDER_READBACK_MISMATCH");
    const session = checkoutSource.indexOf("orderApi.createPaymentSession");
    const redirect = checkoutSource.lastIndexOf("openHostedPaymentPage(");
    expect(readback).toBeGreaterThan(-1);
    expect(session).toBeGreaterThan(readback);
    expect(redirect).toBeGreaterThan(session);
  });

  it("persists the server order before leaving for the provider page", () => {
    expect(checkoutSource).toContain("persistRemoteHostedPayment");
    expect(checkoutSource).toContain("restoreRemoteHostedPayment");
  });
});
