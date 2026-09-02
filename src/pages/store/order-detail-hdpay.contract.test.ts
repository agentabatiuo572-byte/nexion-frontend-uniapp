import { describe, expect, it } from "vitest";
import detailSource from "./order-detail.vue?raw";

describe("HDPay pending commerce order recovery", () => {
  it("lets a placed remote order reopen the idempotent hosted payment session", () => {
    expect(detailSource).toContain("canOpenHostedPayment");
    expect(detailSource).toContain("orderApi.createPaymentSession");
    expect(detailSource).toContain("`hdpay-session:${requestOrderNo}`");
    expect(detailSource).toContain("openHostedPaymentPage(session.paymentUrl)");
  });

  it("validates the provider response against the visible order before redirecting", () => {
    const session = detailSource.indexOf("orderApi.createPaymentSession");
    const responseCheck = detailSource.indexOf("HDPAY_COMMERCE_SESSION_READBACK_MISMATCH");
    const redirect = detailSource.indexOf("openHostedPaymentPage(session.paymentUrl)");
    expect(session).toBeGreaterThan(-1);
    expect(responseCheck).toBeGreaterThan(session);
    expect(redirect).toBeGreaterThan(responseCheck);
  });

  it("keeps the hosted-payment CTA activatable from pointer and keyboard input", () => {
    expect(detailSource).toContain('@keydown.enter.prevent.stop="handleHostedPayment"');
    expect(detailSource).toContain('@keydown.space.prevent.stop="handleHostedPayment"');
    expect(detailSource).toContain('<text @click.stop="handleHostedPayment">{{ t.bankPane.hostedContinueCta }}</text>');
  });
});
